import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { CommChannel, CommMessageKind, CommMessageSource, CommMessageStatus, ModuleKey, Prisma, RecordEntityType, SupportMessageDeliveryStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService, PublishedEvent } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { decryptSecret, encryptSecret } from '@/shared/utils/crypto/secret-box.utils';
import { CommDispatchService } from '@/modules/communications/delivery/comm-dispatch.service';
import { CommProviderService } from '@/modules/communications/delivery/comm-provider.service';
import { externalContext, RateLimiter } from '@/modules/proposals/utils/system-context.utils';
import { ConversationsService } from '../conversations/conversations.service';
import {
    domainOf, htmlToPlain, messageIds, parseAddress, parseReplyToken, plusAddress, replyToken, stripQuotedReply, textToHtml, tokenCandidates, verifyGenericSignature, verifySvixSignature,
} from './email-threading.utils';

/** Normalized inbound email (generic JSON format, or mapped from a Resend `email.received` webhook). */
export interface InboundEmail {
    from: string;
    to: string[];
    subject?: string | null;
    text?: string | null;
    html?: string | null;
    message_id?: string | null;
    in_reply_to?: string | null;
    references?: string | string[] | null;
}

export interface InboundRequest {
    raw_body: string;
    headers: Record<string, string | undefined>;
    ip?: string | null;
    user_agent?: string | null;
}

const COMM_TO_SUPPORT: Partial<Record<CommMessageStatus, SupportMessageDeliveryStatus>> = {
    SENT: 'SENT',
    DELIVERED: 'DELIVERED',
    BOUNCED: 'BOUNCED',
    FAILED: 'FAILED',
    CANCELLED: 'FAILED',
};

/**
 * Email in/out for EMAIL support channels (13 §1, §10).
 * Out: every public agent reply on an EMAIL conversation (event `support.conversation.replied`, any channel: UI, API, MCP, automation)
 * becomes a TRANSACTIONAL CommMessage (11) sent through the organization's own Resend connection by CommDispatchService — suppression,
 * history and delivery tracking stay in module 11. Threading headers (Message-ID / In-Reply-To / References), a plus-addressed Reply-To
 * and a `[#token]` subject tag let replies find their conversation.
 * In: `POST /support/email/inbound/:channelId` (public) verified with the channel's inbound secret — Svix headers (Resend inbound
 * webhooks) or `X-Logiq-Signature` (generic forwarders). Threads by reply token, then In-Reply-To / References, else opens a conversation.
 */
@Injectable()
export class SupportEmailService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(SupportEmailService.name);
    private readonly limiter = new RateLimiter(120, 60_000);
    private readonly listener = (e: PublishedEvent) => this.onEvent(e);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly config: ConfigService,
        private readonly dispatch: CommDispatchService,
        private readonly providers: CommProviderService,
        private readonly conversations: ConversationsService,
    ) { }

    onModuleInit() {
        this.events.bus.on('event', this.listener);
    }

    onModuleDestroy() {
        this.events.bus.off('event', this.listener);
    }

    private get secret() {
        return this.config.get<string>('JWT_SECRET') ?? 'dev-secret';
    }

    private get apiBase() {
        return (this.config.get<string>('API_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
    }

    inboundUrl(channelId: string) {
        return `${this.apiBase}/support/email/inbound/${channelId}`;
    }

    // ---------------------------------------------------------------------------------------------
    // Setup (agency side)
    // ---------------------------------------------------------------------------------------------

    private async emailChannel(ctx: OrgContext, id: string) {
        const ch = await this.prisma.supportChannel.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!ch) throw new NotFoundException({ message: 'Channel not found', code: 'channel_not_found' });
        if (ch.type !== 'EMAIL') throw new BadRequestException({ message: 'Only email channels receive and send email', code: 'channel_not_email' });
        return ch;
    }

    private configOf(config: Prisma.JsonValue | null) {
        return (config && typeof config === 'object' && !Array.isArray(config) ? config : {}) as Record<string, unknown>;
    }

    /** How to connect the channel: inbound webhook URL, whether a signing secret exists, sending status. Never returns the secret. */
    async setup(ctx: OrgContext, id: string) {
        const ch = await this.emailChannel(ctx, id);
        const cfg = this.configOf(ch.config);
        const [provider, last] = await Promise.all([
            this.providers.resolve(ctx.organization_id, CommChannel.EMAIL),
            this.prisma.supportMessage.findFirst({ where: { organization_id: ctx.organization_id, conversation: { channel_id: id }, kind: 'CUSTOMER', external_message_id: { not: null } }, orderBy: { created_at: 'desc' }, select: { created_at: true } }),
        ]);
        return {
            channel_id: ch.id,
            email_address: ch.email_address,
            inbound_url: this.inboundUrl(ch.id),
            has_inbound_secret: typeof cfg.inbound_secret === 'string',
            inbound_secret_set_at: typeof cfg.inbound_secret_set_at === 'string' ? cfg.inbound_secret_set_at : null,
            last_inbound_at: last?.created_at ?? null,
            verified_at: ch.verified_at,
            outbound: provider ? { connected: true, connection_name: provider.connection_name } : { connected: false, reason: this.providers.noProviderReason(CommChannel.EMAIL) },
        };
    }

    /**
     * Set the inbound signing secret. Paste the `whsec_…` secret of a Resend inbound webhook, or omit it to generate one for a
     * generic forwarder (returned once). Stored encrypted (AES-GCM) in the channel config.
     */
    async setInboundSecret(ctx: OrgContext, id: string, provided?: string) {
        const ch = await this.emailChannel(ctx, id);
        const secret = provided?.trim() || `lqin_${randomBytes(24).toString('base64url')}`;
        const cfg = { ...this.configOf(ch.config), inbound_secret: encryptSecret(secret), inbound_secret_set_at: new Date().toISOString() };
        await this.prisma.supportChannel.update({ where: { id }, data: { config: cfg as Prisma.InputJsonValue } });
        await this.audit.record(ctx, 'support_channel.inbound_secret_set', { resource_type: 'support_channel', resource_id: id, metadata: { generated: !provided, sensitive: true } });
        return { inbound_url: this.inboundUrl(id), secret: provided ? null : secret };
    }

    // ---------------------------------------------------------------------------------------------
    // Outbound
    // ---------------------------------------------------------------------------------------------

    private onEvent(e: PublishedEvent) {
        if (e.event_key !== 'support.conversation.replied') return;
        const p = (e.payload ?? {}) as Record<string, unknown>;
        if (p.channel_type !== 'EMAIL' || (p.kind !== 'AGENT' && p.kind !== 'AI_AGENT') || typeof p.message_id !== 'string') return;
        const messageId = p.message_id;
        setImmediate(() => this.sendReply(e.organization_id, messageId).catch((err) => this.logger.warn(`support email ${messageId} not sent: ${(err as Error).message}`)));
    }

    /** Send one public agent reply as an email. Idempotent: only a PENDING message without a CommMessage is claimed. */
    async sendReply(organizationId: string, supportMessageId: string) {
        const msg = await this.prisma.supportMessage.findFirst({
            where: { id: supportMessageId, organization_id: organizationId },
            include: {
                author: { select: { user: { select: { display_name: true, first_name: true, last_name: true } } } },
                conversation: { include: { channel: true, inbox: { select: { name: true, signature: true } }, organization: { select: { display_name: true } } } },
            },
        });
        if (!msg || !['AGENT', 'AI_AGENT'].includes(msg.kind) || msg.comm_message_id) return null;
        const conv = msg.conversation;
        const fail = (reason: string) => this.prisma.supportMessage.update({ where: { id: msg.id }, data: { delivery_status: 'FAILED', delivery_error: reason } });
        if (!conv.customer_email) return fail('The conversation has no customer email address');
        const channel = conv.channel?.type === 'EMAIL' ? conv.channel : await this.prisma.supportChannel.findFirst({ where: { organization_id: organizationId, inbox_id: conv.inbox_id ?? undefined, type: 'EMAIL', is_active: true } });
        if (!channel?.email_address) return fail('No active email channel with an address for this inbox');

        const claimed = await this.prisma.supportMessage.updateMany({ where: { id: msg.id, comm_message_id: null, delivery_status: 'PENDING' }, data: { delivery_error: null } });
        if (!claimed.count) return null;

        const token = replyToken(conv.id, this.secret);
        const ownId = `<support-${msg.id}@${domainOf(channel.email_address)}>`;
        const previous = await this.prisma.supportMessage.findMany({
            where: { conversation_id: conv.id, external_message_id: { not: null }, id: { not: msg.id } },
            orderBy: { created_at: 'asc' },
            select: { external_message_id: true },
            take: 20,
        });
        const refs = [...new Set([conv.email_thread_key, ...previous.map((p) => p.external_message_id)].filter((x): x is string => !!x))];
        const inReplyTo = previous.length ? previous[previous.length - 1].external_message_id : conv.email_thread_key;
        const baseSubject = (conv.subject ?? 'Your request').replace(/\s*\[#[0-9a-f]{42}\]\s*$/i, '');
        const subject = `${/^re:/i.test(baseSubject) ? '' : 'Re: '}${baseSubject} [#${token}]`;
        const agentName = msg.author?.user.display_name || [msg.author?.user.first_name, msg.author?.user.last_name].filter(Boolean).join(' ') || null;
        const signature = conv.inbox?.signature ? `\n\n${conv.inbox.signature}` : '';
        const text = `${msg.body}${signature}`;
        const fromName = agentName ? `${agentName} · ${conv.organization.display_name}` : conv.organization.display_name;

        const comm = await this.prisma.commMessage.create({
            data: {
                organization_id: organizationId,
                channel: CommChannel.EMAIL,
                kind: CommMessageKind.TRANSACTIONAL,
                source: CommMessageSource.MODULE,
                status: CommMessageStatus.QUEUED,
                subject,
                body_text: text,
                body_html: textToHtml(text),
                sender_identity_id: channel.sender_identity_id,
                from_address: channel.email_address,
                from_name: fromName,
                reply_to_address: plusAddress(channel.email_address, token),
                sent_by_membership_id: msg.author_membership_id,
                recipient_kind: conv.contact_id ? 'CRM_CONTACT' : 'EXTERNAL',
                to_address: conv.customer_email,
                to_name: conv.customer_name,
                recipient_contact_id: conv.contact_id,
                company_id: conv.company_id,
                source_entity_type: RecordEntityType.SUPPORT_CONVERSATION,
                source_entity_id: conv.id,
                tracking_enabled: false,
                queued_at: new Date(),
                provider_metadata: { headers: { 'Message-ID': ownId, ...(inReplyTo && { 'In-Reply-To': inReplyTo }), ...(refs.length && { References: refs.join(' ') }) } } as Prisma.InputJsonValue,
                recipients: { create: { role: 'TO', kind: conv.contact_id ? 'CRM_CONTACT' : 'EXTERNAL', address: conv.customer_email, name: conv.customer_name, contact_id: conv.contact_id } },
            },
        });
        await this.prisma.supportMessage.update({ where: { id: msg.id }, data: { comm_message_id: comm.id, external_message_id: ownId, in_reply_to_message_id: inReplyTo ?? null } });
        if (!conv.email_thread_key) await this.prisma.supportConversation.update({ where: { id: conv.id }, data: { email_thread_key: ownId } });
        await this.dispatch.dispatch(comm.id);
        return this.syncOne(msg.id);
    }

    /** Copy the 11 delivery state of the CommMessage onto the support message. */
    private async syncOne(supportMessageId: string) {
        const m = await this.prisma.supportMessage.findUnique({ where: { id: supportMessageId }, select: { id: true, comm_message_id: true, delivery_status: true } });
        if (!m?.comm_message_id) return m;
        const comm = await this.prisma.commMessage.findUnique({ where: { id: m.comm_message_id }, select: { status: true, last_error: true, failure_reason: true, sent_at: true, delivered_at: true } });
        if (!comm) return m;
        const status = COMM_TO_SUPPORT[comm.status] ?? 'PENDING';
        if (status === m.delivery_status) return m;
        return this.prisma.supportMessage.update({
            where: { id: m.id },
            data: { delivery_status: status, delivered_at: comm.delivered_at ?? comm.sent_at ?? null, delivery_error: status === 'FAILED' || status === 'BOUNCED' ? (comm.failure_reason ?? comm.last_error ?? 'Not delivered') : null },
            select: { id: true, comm_message_id: true, delivery_status: true },
        });
    }

    /** Retries and provider webhooks update the CommMessage later; mirror those onto pending / sent support replies. */
    @Interval('support-email-delivery-sync', 60_000)
    async syncPending() {
        try {
            const rows = await this.prisma.supportMessage.findMany({
                where: { comm_message_id: { not: null }, delivery_status: { in: ['PENDING', 'SENT'] }, created_at: { gte: new Date(Date.now() - 3 * 86_400_000) } },
                select: { id: true },
                take: 200,
            });
            for (const r of rows) await this.syncOne(r.id);
        } catch (error) {
            this.logger.warn(`support email sync failed: ${(error as Error).message}`);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Inbound
    // ---------------------------------------------------------------------------------------------

    async inbound(channelId: string, req: InboundRequest) {
        if (!this.limiter.allow(`${channelId}:${req.ip ?? 'unknown'}`)) throw new HttpException({ message: 'Too many requests', code: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
        const channel = /^[0-9a-f-]{36}$/i.test(channelId) ? await this.prisma.supportChannel.findUnique({ where: { id: channelId } }) : null;
        if (!channel || channel.type !== 'EMAIL' || !channel.is_active) throw new NotFoundException({ message: 'Not found', code: 'channel_not_found' });
        const cfg = this.configOf(channel.config);
        if (typeof cfg.inbound_secret !== 'string') throw new UnauthorizedException({ message: 'Inbound email is not configured for this channel', code: 'inbound_not_configured' });
        let secret: string;
        try {
            secret = decryptSecret(cfg.inbound_secret);
        } catch {
            throw new UnauthorizedException({ message: 'Inbound email is not configured for this channel', code: 'inbound_not_configured' });
        }
        const h = req.headers;
        const svix = h['svix-signature'] || h['webhook-signature'];
        const valid = svix
            ? verifySvixSignature(secret, { id: h['svix-id'] || h['webhook-id'], timestamp: h['svix-timestamp'] || h['webhook-timestamp'], signature: svix }, req.raw_body)
            : verifyGenericSignature(secret, h['x-logiq-signature'], req.raw_body);
        if (!valid) throw new UnauthorizedException({ message: 'Invalid signature', code: 'invalid_signature' });

        let payload: Record<string, unknown>;
        try {
            payload = JSON.parse(req.raw_body);
        } catch {
            throw new BadRequestException({ message: 'Body must be JSON', code: 'invalid_json' });
        }
        const email = await this.normalize(channel.organization_id, payload);
        if (!email) return { received: true, ignored: 'not_an_email' };
        return this.ingest(channel, email, req);
    }

    /** Generic format as-is; Resend `email.received` mapped (body fetched with the org's Resend key when the webhook omits it). */
    private async normalize(organizationId: string, payload: Record<string, unknown>): Promise<InboundEmail | null> {
        const str = (v: unknown) => (typeof v === 'string' ? v : null);
        const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []);
        if (typeof payload.type === 'string') {
            if (payload.type !== 'email.received') return null;
            const d = (payload.data ?? {}) as Record<string, unknown>;
            const headers = (d.headers ?? {}) as Record<string, unknown>;
            const email: InboundEmail = {
                from: str(d.from) ?? '',
                to: list(d.to),
                subject: str(d.subject),
                text: str(d.text),
                html: str(d.html),
                message_id: str(d.message_id) ?? str(headers['message-id']),
                in_reply_to: str(d.in_reply_to) ?? str(headers['in-reply-to']),
                references: str(d.references) ?? str(headers['references']),
            };
            if (!email.text && !email.html && typeof d.email_id === 'string') Object.assign(email, await this.fetchResendBody(organizationId, d.email_id));
            return email.from ? email : null;
        }
        const from = str(payload.from);
        if (!from) throw new BadRequestException({ message: '`from` is required', code: 'from_required' });
        return {
            from,
            to: list(payload.to),
            subject: str(payload.subject),
            text: str(payload.text),
            html: str(payload.html),
            message_id: str(payload.message_id),
            in_reply_to: str(payload.in_reply_to),
            references: Array.isArray(payload.references) ? list(payload.references) : str(payload.references),
        };
    }

    private async fetchResendBody(organizationId: string, emailId: string): Promise<Partial<InboundEmail>> {
        try {
            const provider = await this.providers.resolve(organizationId, CommChannel.EMAIL);
            if (!provider?.secrets.api_key) return {};
            const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${provider.secrets.api_key}` } });
            if (!res.ok) return {};
            const d = (await res.json()) as Record<string, unknown>;
            const headers = (d.headers ?? {}) as Record<string, unknown>;
            const s = (v: unknown) => (typeof v === 'string' ? v : null);
            return { text: s(d.text), html: s(d.html), in_reply_to: s(headers['in-reply-to']), references: s(headers['references']), message_id: s(d.message_id) ?? s(headers['message-id']) };
        } catch (error) {
            this.logger.warn(`Resend inbound body fetch failed: ${(error as Error).message}`);
            return {};
        }
    }

    private async ingest(channel: { id: string; organization_id: string; inbox_id: string; verified_at: Date | null }, email: InboundEmail, req: InboundRequest) {
        const org = channel.organization_id;
        const sender = parseAddress(email.from);
        if (!sender.email) throw new BadRequestException({ message: 'Invalid sender address', code: 'invalid_from' });
        const messageId = messageIds(email.message_id)[0] ?? null;
        if (messageId) {
            const dup = await this.prisma.supportMessage.findFirst({ where: { organization_id: org, external_message_id: messageId }, select: { id: true, conversation_id: true } });
            if (dup) return { received: true, duplicate: true, conversation_id: dup.conversation_id };
        }
        const rawText = email.text ?? (email.html ? htmlToPlain(email.html) : '');
        const body = stripQuotedReply(rawText).slice(0, 50_000) || '(empty message)';
        const subject = (email.subject ?? '').replace(/\s*\[#[0-9a-f]{42}\]\s*/gi, ' ').trim() || null;

        // 1. reply token, 2. In-Reply-To / References, 3. new conversation.
        let conversationId: string | null = null;
        for (const t of tokenCandidates(email.to, email.subject)) {
            const id = parseReplyToken(t, this.secret);
            if (id && (await this.prisma.supportConversation.findFirst({ where: { id, organization_id: org }, select: { id: true } }))) {
                conversationId = id;
                break;
            }
        }
        const parents = [...messageIds(email.in_reply_to), ...messageIds(email.references)];
        if (!conversationId && parents.length) {
            const hit =
                (await this.prisma.supportMessage.findFirst({ where: { organization_id: org, external_message_id: { in: parents } }, orderBy: { created_at: 'desc' }, select: { conversation_id: true } }))?.conversation_id ??
                (await this.prisma.supportConversation.findFirst({ where: { organization_id: org, email_thread_key: { in: parents } }, select: { id: true } }))?.id;
            conversationId = hit ?? null;
        }
        if (conversationId) {
            const conv = await this.prisma.supportConversation.findUniqueOrThrow({ where: { id: conversationId }, select: { merged_into_conversation_id: true } });
            conversationId = conv.merged_into_conversation_id ?? conversationId;
        }

        const ctx = externalContext(org, { ip: req.ip, user_agent: req.user_agent });
        const created = !conversationId;
        const contact = await this.prisma.crmContact.findFirst({ where: { organization_id: org, email: { equals: sender.email, mode: 'insensitive' } }, select: { id: true, company_id: true, first_name: true, last_name: true } });
        const name = sender.name ?? (contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : null);
        const result = await this.prisma.$transaction(async (tx) => {
            const convId =
                conversationId ??
                (
                    await tx.supportConversation.create({
                        data: {
                            organization_id: org,
                            inbox_id: channel.inbox_id,
                            channel_id: channel.id,
                            channel_type: 'EMAIL',
                            subject: subject?.slice(0, 300) ?? body.split('\n')[0].slice(0, 80),
                            customer_email: sender.email,
                            customer_name: name,
                            contact_id: contact?.id ?? null,
                            company_id: contact?.company_id ?? null,
                            email_thread_key: messageId,
                        },
                    })
                ).id;
            const msg = await this.conversations.addMessage(tx, convId, { kind: 'CUSTOMER', body, author_name: name, author_email: sender.email, channel_type: 'EMAIL' });
            await tx.supportMessage.update({
                where: { id: msg.id },
                data: { external_message_id: messageId, in_reply_to_message_id: messageIds(email.in_reply_to)[0] ?? null, body_html: email.html ? email.html.slice(0, 200_000) : null },
            });
            return { conversation_id: convId, message_id: msg.id };
        });
        if (!channel.verified_at) await this.prisma.supportChannel.update({ where: { id: channel.id }, data: { verified_at: new Date() } });
        await this.audit.record(ctx, created ? 'support_conversation.created' : 'support_message.customer_received', {
            resource_type: 'support_conversation',
            resource_id: result.conversation_id,
            metadata: { via: 'email', channel_id: channel.id, from: sender.email, message_id: result.message_id, threaded: !created },
        });
        this.events.publish(ctx, {
            event_key: created ? 'support.conversation.created' : 'support.conversation.customer_replied',
            module: ModuleKey.SUPPORT,
            entity_type: 'SUPPORT_CONVERSATION',
            entity_id: result.conversation_id,
            payload: { via: 'email', channel_type: 'EMAIL', message_id: result.message_id, inbox_id: channel.inbox_id, company_id: contact?.company_id ?? null, ...(created && { subject }) },
            ...(created && { activity: { summary: `New email from ${name ?? sender.email}${subject ? `: ${subject}` : ''}`, company_id: contact?.company_id ?? null } }),
        });
        return { received: true, conversation_id: result.conversation_id, created };
    }
}
