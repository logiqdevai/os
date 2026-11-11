import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InboundWebhookAuthScheme, InboundWebhookStatus, ModuleKey, OutboundWebhookStatus, PlatformEventSource, Prisma, WebhookDeliveryStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService, PublishedEvent } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { decryptSecret, encryptSecret, secretHint } from '@/shared/utils/crypto/secret-box.utils';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { assertSafeUrl, newSecret, safeEqual, verifyHmac } from '../engine/engine.utils';
import { CreateInboundWebhookDto, CreateOutboundWebhookDto, DeliveryQuery, OutboundQuery, UpdateInboundWebhookDto, UpdateOutboundWebhookDto } from './dto/webhook.dto';
import { WebhookDeliveryService } from './webhook-delivery.service';

const MAX_INBOUND_BYTES = 256 * 1024;

/** 20 §12 — outbound endpoints (subscriptions, signing secrets, deliveries) and inbound endpoints (signed triggers). */
@Injectable()
export class WebhooksService {
    /** Sliding one-minute counters for inbound rate limits (per endpoint, per instance). */
    private readonly inboundHits = new Map<string, { window: number; count: number }>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly deliveries: WebhookDeliveryService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Outbound
    // ---------------------------------------------------------------------------------------------

    private present<T extends { secret: string; previous_secret?: string | null }>(hook: T) {
        const { secret, previous_secret: _p, ...rest } = hook;
        let hint = '…';
        try {
            hint = secretHint(decryptSecret(secret));
        } catch { /* rotated key */ }
        return { ...rest, secret_hint: hint };
    }

    async listOutbound(ctx: OrgContext, query: OutboundQuery) {
        const where: Prisma.OutboundWebhookWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status && { status: query.status }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { url: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.outboundWebhook.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['name', 'created_at', 'last_delivery_at'], 'created_at') }),
            this.prisma.outboundWebhook.count({ where }),
        ]);
        return paginate(items.map((h) => this.present(h)), total, query);
    }

    async getOutbound(ctx: OrgContext, id: string) {
        const hook = await this.prisma.outboundWebhook.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!hook) throw new NotFoundException({ message: 'Webhook endpoint not found', code: 'webhook_not_found' });
        const since = new Date(Date.now() - 7 * 86400_000);
        const stats = await this.prisma.webhookDelivery.groupBy({ by: ['status'], where: { webhook_id: id, created_at: { gte: since } }, _count: { _all: true } });
        return { ...this.present(hook), stats_7d: Object.fromEntries(stats.map((s) => [s.status, s._count._all])) };
    }

    async createOutbound(ctx: OrgContext, dto: CreateOutboundWebhookDto) {
        this.assertUrl(dto.url);
        const secret = newSecret('whsec');
        const hook = await this.prisma.outboundWebhook.create({
            data: { ...dto, headers: dto.headers as Prisma.InputJsonValue, organization_id: ctx.organization_id, secret: encryptSecret(secret), created_by_membership_id: ctx.membership_id },
        });
        await this.audit.record(ctx, 'automation.webhook.created', { resource_type: 'outbound_webhook', resource_id: hook.id, metadata: { after: { name: dto.name, url: dto.url, subscribed_events: dto.subscribed_events } } });
        this.events.publish(ctx, { event_key: 'automation.webhook.created', module: ModuleKey.AUTOMATION, entity_kind: 'outbound_webhook', entity_id: hook.id, payload: { name: hook.name } });
        // The signing secret is shown once.
        return { ...this.present(hook), secret };
    }

    async updateOutbound(ctx: OrgContext, id: string, dto: UpdateOutboundWebhookDto) {
        const before = await this.getOutbound(ctx, id);
        if (dto.url) this.assertUrl(dto.url);
        const hook = await this.prisma.outboundWebhook.update({ where: { id }, data: { ...dto, headers: dto.headers as Prisma.InputJsonValue | undefined } });
        await this.audit.record(ctx, 'automation.webhook.updated', { resource_type: 'outbound_webhook', resource_id: id, metadata: { before: { url: before.url, subscribed_events: before.subscribed_events }, after: dto } });
        return this.present(hook);
    }

    async setOutboundStatus(ctx: OrgContext, id: string, status: OutboundWebhookStatus) {
        await this.getOutbound(ctx, id);
        const hook = await this.prisma.outboundWebhook.update({
            where: { id },
            data: { status, ...(status === OutboundWebhookStatus.ACTIVE ? { consecutive_failures: 0, disabled_at: null, disabled_reason: null } : {}) },
        });
        await this.audit.record(ctx, status === OutboundWebhookStatus.ACTIVE ? 'automation.webhook.resumed' : 'automation.webhook.paused', { resource_type: 'outbound_webhook', resource_id: id });
        return this.present(hook);
    }

    async rotateOutboundSecret(ctx: OrgContext, id: string) {
        const hook = await this.getOutbound(ctx, id);
        const current = await this.prisma.outboundWebhook.findUniqueOrThrow({ where: { id }, select: { secret: true } });
        const secret = newSecret('whsec');
        const now = new Date();
        await this.prisma.outboundWebhook.update({
            where: { id },
            data: { secret: encryptSecret(secret), previous_secret: current.secret, secret_rotated_at: now, previous_secret_expires_at: new Date(now.getTime() + 24 * 3600_000) },
        });
        await this.audit.record(ctx, 'automation.webhook.secret_rotated', { resource_type: 'outbound_webhook', resource_id: hook.id });
        return { id, secret, previous_secret_expires_at: new Date(now.getTime() + 24 * 3600_000) };
    }

    async removeOutbound(ctx: OrgContext, id: string) {
        const hook = await this.getOutbound(ctx, id);
        await this.prisma.outboundWebhook.delete({ where: { id } });
        await this.audit.record(ctx, 'automation.webhook.deleted', { resource_type: 'outbound_webhook', resource_id: id, metadata: { before: { name: hook.name, url: hook.url } } });
        return { success: true };
    }

    async sendTest(ctx: OrgContext, id: string) {
        const hook = await this.getOutbound(ctx, id);
        const payload = WebhookDeliveryService.envelope({ id: null, event_key: 'webhook.test', organization_id: ctx.organization_id, payload: { message: 'Test delivery from Logiqdev OS', webhook: hook.name } });
        const delivery = await this.deliveries.deliverNow({ organization_id: ctx.organization_id, webhook_id: id, event_key: 'webhook.test', payload });
        await this.audit.record(ctx, 'automation.webhook.test_sent', { resource_type: 'outbound_webhook', resource_id: id, metadata: { status: delivery?.status, response_status_code: delivery?.response_status_code } });
        return delivery;
    }

    async listDeliveries(ctx: OrgContext, query: DeliveryQuery) {
        const where: Prisma.WebhookDeliveryWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.webhook_id && { webhook_id: query.webhook_id }),
            ...(query.status && { status: query.status }),
            ...(query.event_key && { event_key: query.event_key }),
        };
        const [items, total] = await Promise.all([
            this.prisma.webhookDelivery.findMany({
                where,
                ...skipTake(query),
                orderBy: { created_at: 'desc' },
                select: { id: true, webhook_id: true, event_id: true, run_step_id: true, event_key: true, status: true, attempt: true, max_attempts: true, next_retry_at: true, response_status_code: true, error_message: true, duration_ms: true, delivered_at: true, created_at: true, webhook: { select: { id: true, name: true, url: true } } },
            }),
            this.prisma.webhookDelivery.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async getDelivery(ctx: OrgContext, id: string) {
        const d = await this.prisma.webhookDelivery.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { webhook: { select: { id: true, name: true, url: true } } } });
        if (!d) throw new NotFoundException({ message: 'Delivery not found', code: 'delivery_not_found' });
        return d;
    }

    async retryDelivery(ctx: OrgContext, id: string) {
        const d = await this.getDelivery(ctx, id);
        if (d.status === WebhookDeliveryStatus.SUCCEEDED) throw new ConflictException({ message: 'The delivery already succeeded', code: 'delivery_succeeded' });
        await this.prisma.webhookDelivery.update({ where: { id }, data: { status: WebhookDeliveryStatus.PENDING, max_attempts: d.attempt + 1, dead_lettered_at: null, next_retry_at: null } });
        await this.audit.record(ctx, 'automation.webhook.delivery_retried', { resource_type: 'webhook_delivery', resource_id: id });
        return this.deliveries.attempt(id);
    }

    private assertUrl(url: string) {
        const problem = assertSafeUrl(url);
        if (problem) throw new BadRequestException({ message: problem, code: 'webhook_url_invalid' });
    }

    // ---------------------------------------------------------------------------------------------
    // Inbound
    // ---------------------------------------------------------------------------------------------

    private presentInbound<T extends { secret: string; slug: string }>(hook: T) {
        const { secret: _s, ...rest } = hook;
        return { ...rest, url_path: `/automation/hooks/in/${hook.slug}`, event_key: `inbound_webhook.${hook.slug}` };
    }

    async listInbound(ctx: OrgContext) {
        const items = await this.prisma.automationInboundWebhook.findMany({ where: { organization_id: ctx.organization_id }, orderBy: { created_at: 'desc' }, include: { rule: { select: { id: true, name: true } } } });
        return items.map((h) => this.presentInbound(h));
    }

    async getInbound(ctx: OrgContext, id: string) {
        const hook = await this.prisma.automationInboundWebhook.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { rule: { select: { id: true, name: true } } } });
        if (!hook) throw new NotFoundException({ message: 'Inbound endpoint not found', code: 'inbound_webhook_not_found' });
        return this.presentInbound(hook);
    }

    async createInbound(ctx: OrgContext, dto: CreateInboundWebhookDto) {
        if (dto.rule_id) await this.assertRule(ctx, dto.rule_id);
        const slug = dto.slug ?? `${dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'hook'}-${randomBytes(4).toString('hex')}`;
        const secret = newSecret('whin');
        try {
            const hook = await this.prisma.automationInboundWebhook.create({
                data: {
                    organization_id: ctx.organization_id,
                    name: dto.name,
                    description: dto.description ?? null,
                    slug,
                    auth_scheme: dto.auth_scheme ?? InboundWebhookAuthScheme.HMAC_SHA256,
                    signature_header: dto.signature_header ?? (dto.auth_scheme === InboundWebhookAuthScheme.BEARER_TOKEN ? 'authorization' : 'x-signature'),
                    secret: encryptSecret(secret),
                    rule_id: dto.rule_id ?? null,
                    allowed_ip_ranges: dto.allowed_ip_ranges ?? [],
                    rate_limit_per_minute: dto.rate_limit_per_minute ?? null,
                    created_by_membership_id: ctx.membership_id,
                },
            });
            await this.audit.record(ctx, 'automation.inbound_webhook.created', { resource_type: 'inbound_webhook', resource_id: hook.id, metadata: { slug, auth_scheme: hook.auth_scheme } });
            return { ...this.presentInbound(hook), secret };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ message: 'This slug is already used', code: 'slug_taken' });
            throw error;
        }
    }

    async updateInbound(ctx: OrgContext, id: string, dto: UpdateInboundWebhookDto) {
        const before = await this.getInbound(ctx, id);
        if (before.status === InboundWebhookStatus.REVOKED) throw new ConflictException({ message: 'A revoked endpoint cannot be changed', code: 'inbound_revoked' });
        if (dto.rule_id) await this.assertRule(ctx, dto.rule_id);
        if (dto.slug && dto.slug !== before.slug) throw new BadRequestException({ message: 'The slug cannot change; create a new endpoint', code: 'slug_immutable' });
        const hook = await this.prisma.automationInboundWebhook.update({ where: { id }, data: { ...dto, slug: undefined } });
        await this.audit.record(ctx, 'automation.inbound_webhook.updated', { resource_type: 'inbound_webhook', resource_id: id, metadata: { after: dto } });
        return this.presentInbound(hook);
    }

    async rotateInboundSecret(ctx: OrgContext, id: string) {
        await this.getInbound(ctx, id);
        const secret = newSecret('whin');
        await this.prisma.automationInboundWebhook.update({ where: { id }, data: { secret: encryptSecret(secret), secret_rotated_at: new Date() } });
        await this.audit.record(ctx, 'automation.inbound_webhook.secret_rotated', { resource_type: 'inbound_webhook', resource_id: id });
        return { id, secret };
    }

    async revokeInbound(ctx: OrgContext, id: string) {
        await this.getInbound(ctx, id);
        const hook = await this.prisma.automationInboundWebhook.update({ where: { id }, data: { status: InboundWebhookStatus.REVOKED, revoked_at: new Date() } });
        await this.audit.record(ctx, 'automation.inbound_webhook.revoked', { resource_type: 'inbound_webhook', resource_id: id });
        return this.presentInbound(hook);
    }

    private async assertRule(ctx: OrgContext, ruleId: string) {
        const rule = await this.prisma.automationRule.findFirst({ where: { id: ruleId, organization_id: ctx.organization_id } });
        if (!rule) throw new NotFoundException({ message: 'Workflow not found', code: 'rule_not_found' });
        if (!ctx.can('automation.rules.update')) throw new ForbiddenException({ message: 'Linking a workflow needs automation.rules.update', code: 'permission_denied' });
    }

    /**
     * Public receiver `POST /automation/hooks/in/:slug`. Verifies the signature / token, applies the endpoint's
     * IP allow-list and rate limit, and publishes `inbound_webhook.<slug>` (source INBOUND_WEBHOOK) on the bus.
     */
    async receive(slug: string, input: { rawBody: string; body: unknown; headers: Record<string, string | string[] | undefined>; ip: string | null }) {
        const hook = await this.prisma.automationInboundWebhook.findUnique({ where: { slug } });
        if (!hook || hook.status === InboundWebhookStatus.REVOKED) throw new NotFoundException({ message: 'Not found', code: 'not_found' });
        const reject = async (status: number, reason: string, code: string) => {
            await this.prisma.automationInboundWebhook.update({ where: { id: hook.id }, data: { rejected_count: { increment: 1 }, last_rejected_at: new Date(), last_rejection_reason: reason } }).catch(() => undefined);
            throw new HttpException({ message: reason, code }, status);
        };
        if (hook.status === InboundWebhookStatus.PAUSED) await reject(HttpStatus.SERVICE_UNAVAILABLE, 'Endpoint is paused', 'endpoint_paused');
        if (Buffer.byteLength(input.rawBody) > MAX_INBOUND_BYTES) await reject(HttpStatus.PAYLOAD_TOO_LARGE, 'Payload too large', 'payload_too_large');
        if (hook.allowed_ip_ranges.length && !(input.ip && hook.allowed_ip_ranges.some((r) => ipMatches(input.ip as string, r)))) await reject(HttpStatus.FORBIDDEN, `IP ${input.ip} is not allowed`, 'ip_not_allowed');

        const limit = hook.rate_limit_per_minute ?? 120;
        const window = Math.floor(Date.now() / 60_000);
        const hit = this.inboundHits.get(hook.id);
        const count = hit && hit.window === window ? hit.count + 1 : 1;
        this.inboundHits.set(hook.id, { window, count });
        if (count > limit) await reject(HttpStatus.TOO_MANY_REQUESTS, 'Rate limit exceeded', 'rate_limited');

        const header = (name: string | null) => {
            const v = name ? input.headers[name.toLowerCase()] : undefined;
            return Array.isArray(v) ? v[0] : v;
        };
        let secret: string;
        try {
            secret = decryptSecret(hook.secret);
        } catch {
            return reject(HttpStatus.INTERNAL_SERVER_ERROR, 'Endpoint secret unreadable', 'secret_error');
        }
        let ok = false;
        switch (hook.auth_scheme) {
            case InboundWebhookAuthScheme.HMAC_SHA256:
                ok = verifyHmac(secret, input.rawBody, header(hook.signature_header ?? 'x-signature'));
                break;
            case InboundWebhookAuthScheme.BEARER_TOKEN: {
                const v = header(hook.signature_header ?? 'authorization') ?? '';
                ok = safeEqual(v.replace(/^Bearer\s+/i, ''), secret);
                break;
            }
            case InboundWebhookAuthScheme.BASIC: {
                const v = header('authorization') ?? '';
                const decoded = v.startsWith('Basic ') ? Buffer.from(v.slice(6), 'base64').toString('utf8') : '';
                ok = safeEqual(decoded.split(':').slice(1).join(':'), secret);
                break;
            }
            case InboundWebhookAuthScheme.NONE:
                ok = true;
                break;
        }
        if (!ok) {
            await reject(HttpStatus.UNAUTHORIZED, 'Invalid signature', 'invalid_signature');
            throw new UnauthorizedException();
        }

        const payload = (input.body && typeof input.body === 'object' ? input.body : { raw: input.rawBody.slice(0, 10_000) }) as Record<string, unknown>;
        const event = await this.prisma.platformEvent.create({
            data: {
                organization_id: hook.organization_id,
                event_key: `inbound_webhook.${hook.slug}`,
                module: ModuleKey.AUTOMATION,
                source: PlatformEventSource.INBOUND_WEBHOOK,
                entity_kind: 'inbound_webhook',
                entity_id: hook.id,
                payload: { body: payload } as Prisma.InputJsonValue,
                actor_type: 'SYSTEM',
                inbound_webhook_id: hook.id,
                dedupe_key: header('idempotency-key') ? `inbound:${hook.id}:${header('idempotency-key')}` : null,
            },
        }).catch((error) => {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null; // duplicate delivery
            throw error;
        });
        await this.prisma.automationInboundWebhook.update({ where: { id: hook.id }, data: { received_count: { increment: 1 }, last_received_at: new Date() } });
        if (!event) return { accepted: true, duplicate: true };
        const published: PublishedEvent = { id: event.id, organization_id: hook.organization_id, actor_membership_id: null, event_key: event.event_key, module: ModuleKey.AUTOMATION, entity_kind: 'inbound_webhook', entity_id: hook.id, payload: { body: payload } };
        this.events.bus.emit('event', published);
        return { accepted: true, event_id: event.id };
    }
}

/** IPv4 CIDR or exact match. */
function ipMatches(ip: string, range: string) {
    const clean = ip.replace(/^::ffff:/, '');
    if (!range.includes('/')) return clean === range;
    const [base, bitsStr] = range.split('/');
    const bits = Number(bitsStr);
    const toInt = (a: string) => a.split('.').reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(clean) || !/^\d+\.\d+\.\d+\.\d+$/.test(base)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (toInt(clean) & mask) === (toInt(base) & mask);
}
