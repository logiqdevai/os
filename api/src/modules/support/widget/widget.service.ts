import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { ModuleKey, SupportMessageKind } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { externalContext, RateLimiter } from '@/modules/proposals/utils/system-context.utils';
import { ConversationsService } from '../conversations/conversations.service';
import { StartWidgetConversationDto, WidgetMessagesQuery } from './dto/widget.dto';
import { officeHoursStatus, readAiConfig, readOfficeHours } from '../common/channel-config.utils';
import { AI_REPLY_LABEL } from '../common/support.constants';

export interface WidgetRequestMeta {
    ip?: string | null;
    user_agent?: string | null;
    /** Browser Origin header of the page that embeds the widget. */
    origin?: string | null;
}

/** Messages a visitor may ever see. Internal notes and system events never leave the agency API. */
const PUBLIC_KINDS: SupportMessageKind[] = ['CUSTOMER', 'AGENT', 'AI_AGENT'];
const WIDGET_TYPES = ['WIDGET', 'LIVE_CHAT'] as const;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Visible config keys of SupportChannel.config for widget channels (no secrets are ever stored there). */
export interface WidgetAppearance {
    title?: string;
    welcome_message?: string;
    color?: string;
    position?: 'right' | 'left';
    require_email?: boolean;
}

/**
 * Website chat widget (13 §1, §5) — the public side. A visitor starts a conversation on a WIDGET / LIVE_CHAT
 * channel identified by its public embed key. The response carries a conversation token `<conversation_id>.<secret>`;
 * only sha256(secret) is stored (SupportConversation.visitor_key). Every later call (REST and Socket.IO) presents it.
 * Rate limited per IP; origins are checked against SupportChannel.allowed_origins (empty list = any site).
 */
@Injectable()
export class SupportWidgetService {
    private readonly limiter = new RateLimiter(60, 60_000);
    private readonly startLimiter = new RateLimiter(5, 10 * 60_000);
    private readonly postLimiter = new RateLimiter(20, 60_000);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly conversations: ConversationsService,
    ) { }

    private throttle(limiter: RateLimiter, key: string) {
        if (!limiter.allow(key)) throw new HttpException({ message: 'Too many requests. Try again in a minute.', code: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    /** Active widget channel by embed key, with the origin check. 404 for unknown / inactive keys. */
    async channelByKey(key: string, origin?: string | null) {
        if (!key || key.length > 80) throw new NotFoundException({ message: 'Chat is not available', code: 'widget_not_found' });
        const channel = await this.prisma.supportChannel.findUnique({
            where: { widget_key: key },
            include: { inbox: { select: { id: true, archived_at: true } }, organization: { select: { id: true, display_name: true, logo_url: true, deleted_at: true, business_hours: true, working_days: true, default_timezone: true } } },
        });
        if (!channel || !channel.is_active || !WIDGET_TYPES.includes(channel.type as (typeof WIDGET_TYPES)[number]) || channel.inbox.archived_at || channel.organization.deleted_at) {
            throw new NotFoundException({ message: 'Chat is not available', code: 'widget_not_found' });
        }
        const module = await this.prisma.organizationModule.findUnique({ where: { organization_id_module: { organization_id: channel.organization_id, module: ModuleKey.SUPPORT } }, select: { enabled: true } });
        if (module && !module.enabled) throw new NotFoundException({ message: 'Chat is not available', code: 'widget_not_found' });
        if (origin && channel.allowed_origins.length && !channel.allowed_origins.map((o) => o.replace(/\/+$/, '').toLowerCase()).includes(origin.replace(/\/+$/, '').toLowerCase())) {
            throw new ForbiddenException({ message: 'This site may not use this chat', code: 'widget_origin_not_allowed' });
        }
        return channel;
    }

    appearance(config: unknown): WidgetAppearance {
        const c = (config && typeof config === 'object' && !Array.isArray(config) ? config : {}) as Record<string, unknown>;
        const color = typeof c.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.color) ? c.color : undefined;
        return {
            title: typeof c.title === 'string' ? c.title.slice(0, 80) : undefined,
            welcome_message: typeof c.welcome_message === 'string' ? c.welcome_message.slice(0, 500) : undefined,
            color,
            position: c.position === 'left' ? 'left' : 'right',
            require_email: c.require_email === true,
        };
    }

    /** Office hours of a widget channel right now (13 §5): closed → the widget shows the "we'll reply by email" form. */
    officeHours(channel: { config: unknown; organization: { business_hours: unknown; working_days: unknown; default_timezone: string | null } }) {
        const oh = readOfficeHours(channel.config);
        const status = officeHoursStatus(oh, channel.organization);
        return {
            ...status,
            offline_message: status.open ? null : oh.offline_message || "We're away right now. Leave your email and message — we'll reply by email as soon as we're back.",
        };
    }

    /** Public appearance of the widget (no ids beyond the key, no secrets). */
    async config(key: string, meta: WidgetRequestMeta) {
        this.throttle(this.limiter, meta.ip ?? 'unknown');
        const channel = await this.channelByKey(key, meta.origin);
        const look = this.appearance(channel.config);
        const ai = readAiConfig(channel.config);
        return {
            office_hours: this.officeHours(channel),
            /** The AI assistant may answer first; the widget tells visitors before they write (13 §3 transparency). */
            ai_assistant: channel.ai_agent_enabled && ai.mode === 'AUTO_REPLY' ? { enabled: true, notice: AI_REPLY_LABEL } : { enabled: false, notice: null },
            title: look.title ?? channel.organization.display_name,
            welcome_message: look.welcome_message ?? 'Hi! Ask us anything — we usually reply within a few minutes during office hours.',
            color: look.color ?? '#2563eb',
            position: look.position,
            require_email: look.require_email,
            organization: { name: channel.organization.display_name, logo_url: channel.organization.logo_url },
        };
    }

    async start(key: string, dto: StartWidgetConversationDto, meta: WidgetRequestMeta) {
        this.throttle(this.limiter, meta.ip ?? 'unknown');
        this.throttle(this.startLimiter, `${meta.ip ?? 'unknown'}:${key}`);
        const channel = await this.channelByKey(key, meta.origin);
        const look = this.appearance(channel.config);
        const hours = this.officeHours(channel);
        if ((look.require_email || !hours.open) && !dto.email) {
            throw new HttpException({ message: hours.open ? 'Enter your email so we can reply' : "Enter your email — we're offline and will reply by email", code: 'widget_email_required' }, HttpStatus.BAD_REQUEST);
        }
        // Outside office hours the conversation is answered by email when the inbox has an active email channel.
        const replyByEmail = !hours.open && !!(await this.prisma.supportChannel.findFirst({ where: { organization_id: channel.organization_id, inbox_id: channel.inbox_id, type: 'EMAIL', is_active: true, email_address: { not: null } }, select: { id: true } }));

        const email = dto.email?.trim().toLowerCase() || null;
        const name = dto.name?.trim() || null;
        // A claimed email is matched to a CRM contact for context; agents see it as unverified (widget channel).
        const contact = email
            ? await this.prisma.crmContact.findFirst({ where: { organization_id: channel.organization_id, email: { equals: email, mode: 'insensitive' } }, select: { id: true, company_id: true, first_name: true, last_name: true } })
            : null;
        const secret = randomBytes(24).toString('base64url');
        const body = dto.body.trim();
        const subject = body.split('\n')[0].slice(0, 80);
        const conv = await this.prisma.$transaction(async (tx) => {
            const c = await tx.supportConversation.create({
                data: {
                    organization_id: channel.organization_id,
                    inbox_id: channel.inbox_id,
                    channel_id: channel.id,
                    channel_type: replyByEmail ? 'EMAIL' : channel.type,
                    subject,
                    visitor_key: sha256(secret),
                    customer_name: name ?? (contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : null),
                    customer_email: email,
                    contact_id: contact?.id ?? null,
                    company_id: contact?.company_id ?? null,
                },
            });
            await this.conversations.addMessage(tx, c.id, { kind: 'CUSTOMER', body: dto.page_url ? `${body}\n\n— sent from ${dto.page_url.slice(0, 300)}` : body, author_name: name, author_email: email, channel_type: channel.type });
            return c;
        });
        const ctx = externalContext(channel.organization_id, meta);
        await this.audit.record(ctx, 'support_conversation.created', { resource_type: 'support_conversation', resource_id: conv.id, metadata: { via: 'widget', channel_id: channel.id, visitor_email: email, origin: meta.origin ?? null, outside_office_hours: !hours.open, reply_by_email: replyByEmail } });
        this.events.publish(ctx, {
            event_key: 'support.conversation.created',
            module: ModuleKey.SUPPORT,
            entity_type: 'SUPPORT_CONVERSATION',
            entity_id: conv.id,
            payload: { subject, channel_type: conv.channel_type, inbox_id: channel.inbox_id, company_id: conv.company_id, via: 'widget', outside_office_hours: !hours.open },
            activity: { summary: `New chat${name ? ` from ${name}` : ''}: ${subject}`, company_id: conv.company_id },
        });
        return { token: `${conv.id}.${secret}`, offline: !hours.open, reply_by_email: replyByEmail, ...(await this.thread(conv.id)) };
    }

    /** Resolve `<conversation_id>.<secret>` for this widget key (401 when it does not match). */
    async verify(key: string, token: string | undefined | null) {
        const [id, secret] = (token ?? '').split('.');
        if (!id || !secret || !/^[0-9a-f-]{36}$/i.test(id)) throw new UnauthorizedException({ message: 'Chat session expired', code: 'widget_token_invalid' });
        const conv = await this.prisma.supportConversation.findFirst({
            where: { id, channel: { widget_key: key } },
            select: { id: true, organization_id: true, visitor_key: true, status: true, merged_into_conversation_id: true, channel_type: true, customer_name: true, customer_email: true },
        });
        if (!conv?.visitor_key || !safeEqual(conv.visitor_key, sha256(secret))) throw new UnauthorizedException({ message: 'Chat session expired', code: 'widget_token_invalid' });
        return conv;
    }

    /** Public thread for the visitor: customer, agent and AI messages only; agents appear by first name. */
    private async thread(conversationId: string, after?: Date) {
        const conv = await this.prisma.supportConversation.findUniqueOrThrow({
            where: { id: conversationId },
            select: {
                id: true, status: true, merged_into_conversation_id: true,
                messages: {
                    where: { kind: { in: PUBLIC_KINDS }, deleted_at: null, ...(after && { created_at: { gt: after } }) },
                    orderBy: { created_at: 'asc' },
                    take: 200,
                    select: { id: true, kind: true, body: true, created_at: true, author_name: true, author: { select: { user: { select: { display_name: true, first_name: true, profile_photo_url: true } } } } },
                },
            },
        });
        return {
            conversation: { id: conv.id, status: conv.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN' },
            messages: conv.messages.map((m) => ({
                id: m.id,
                from: m.kind === 'CUSTOMER' ? 'visitor' : 'team',
                /** Written by the AI assistant — the widget labels these messages (13 §3). */
                is_ai: m.kind === 'AI_AGENT',
                author_name: m.kind === 'CUSTOMER' ? m.author_name : m.kind === 'AI_AGENT' ? 'AI assistant' : (m.author?.user.first_name || m.author?.user.display_name || 'Support'),
                author_photo_url: m.kind === 'AGENT' ? m.author?.user.profile_photo_url ?? null : null,
                body: m.body,
                created_at: m.created_at,
            })),
        };
    }

    async messages(key: string, token: string | undefined, q: WidgetMessagesQuery, meta: WidgetRequestMeta) {
        this.throttle(this.limiter, meta.ip ?? 'unknown');
        await this.channelByKey(key, meta.origin);
        const conv = await this.verify(key, token);
        await this.prisma.supportConversation.update({ where: { id: conv.id }, data: { customer_last_read_at: new Date() } });
        return this.thread(conv.merged_into_conversation_id ?? conv.id, q.after);
    }

    async post(key: string, token: string | undefined, body: string, meta: WidgetRequestMeta) {
        this.throttle(this.limiter, meta.ip ?? 'unknown');
        this.throttle(this.postLimiter, `${meta.ip ?? 'unknown'}:${key}`);
        const channel = await this.channelByKey(key, meta.origin);
        const conv = await this.verify(key, token);
        const targetId = conv.merged_into_conversation_id ?? conv.id;
        const message = await this.prisma.$transaction((tx) =>
            this.conversations.addMessage(tx, targetId, { kind: 'CUSTOMER', body: body.trim(), author_name: conv.customer_name, author_email: conv.customer_email, channel_type: channel.type }),
        );
        const ctx = externalContext(conv.organization_id, meta);
        await this.audit.record(ctx, 'support_message.customer_received', { resource_type: 'support_conversation', resource_id: targetId, metadata: { via: 'widget', message_id: message.id } });
        this.events.publish(ctx, { event_key: 'support.conversation.customer_replied', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: targetId, payload: { via: 'widget', message_id: message.id, channel_type: channel.type } });
        return this.thread(targetId);
    }
}
