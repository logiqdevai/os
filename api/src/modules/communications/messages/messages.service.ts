import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { CommChannel, CommMessageKind, CommMessageSource, CommMessageStatus, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { branchScopeWhere, htmlToText, normalizeAddress, notFound, renderTemplate } from '../common/comm.utils';
import { CommDispatchService } from '../delivery/comm-dispatch.service';
import { CampaignRunnerService } from '../campaigns/campaign-runner.service';
import { SendersService } from '../senders/senders.service';
import { TemplatesService } from '../templates/templates.service';
import { MessageQuery, SendMessageDto } from './dto/message.dto';
import { CommThreadsService } from '../threads/comm-threads.service';

const READ = 'communications.messages.read';
const SEND = 'communications.messages.send';

/** One-off email / SMS and the communication history (11 "Email Management", "SMS Management", "Communication History"). */
@Injectable()
export class MessagesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly dispatch: CommDispatchService,
        private readonly runner: CampaignRunnerService,
        private readonly senders: SendersService,
        private readonly templates: TemplatesService,
        private readonly threads: CommThreadsService,
    ) { }

    private scope(ctx: OrgContext): Prisma.CommMessageWhereInput {
        return branchScopeWhere(ctx, READ, ['sent_by_membership_id', 'owner_membership_id']) as Prisma.CommMessageWhereInput;
    }

    /** Notification sends of module 14 are operational logs; only communication admins see them. */
    private kindFilter(ctx: OrgContext, kinds?: CommMessageKind[]): Prisma.CommMessageWhereInput {
        const allowed = ctx.can('communications.settings.manage') ? Object.values(CommMessageKind) : Object.values(CommMessageKind).filter((k) => k !== CommMessageKind.NOTIFICATION);
        const wanted = kinds?.length ? kinds.filter((k) => allowed.includes(k)) : allowed;
        return { kind: { in: wanted } };
    }

    async findAll(ctx: OrgContext, query: MessageQuery) {
        const day = (v: string | undefined, end = false) => (v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${end ? '23:59:59.999' : '00:00:00.000'}Z` : v) : undefined);
        const where: Prisma.CommMessageWhereInput = {
            organization_id: ctx.organization_id,
            deleted_at: null,
            ...this.scope(ctx),
            ...this.kindFilter(ctx, query.kind),
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(!query.include_tests && { is_test: false }),
            ...(query.channel && { channel: query.channel }),
            ...(query.source && { source: query.source }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.campaign_id && { campaign_id: query.campaign_id }),
            ...(query.contact_id && { recipient_contact_id: query.contact_id }),
            ...(query.company_id && { company_id: query.company_id }),
            ...(query.project_id && { project_id: query.project_id }),
            ...((query.from || query.to) && { created_at: { ...(query.from && { gte: day(query.from) }), ...(query.to && { lte: day(query.to, true) }) } }),
            ...(query.search && {
                OR: [
                    { subject: { contains: query.search, mode: 'insensitive' } },
                    { to_address: { contains: query.search, mode: 'insensitive' } },
                    { to_name: { contains: query.search, mode: 'insensitive' } },
                    { body_text: { contains: query.search, mode: 'insensitive' } },
                ],
            }),
        };
        const [items, total] = await Promise.all([
            this.prisma.commMessage.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['created_at', 'sent_at', 'scheduled_at'], 'created_at'),
                select: {
                    id: true, channel: true, kind: true, source: true, status: true, subject: true, to_address: true, to_name: true, from_address: true,
                    scheduled_at: true, sent_at: true, delivered_at: true, first_opened_at: true, first_clicked_at: true, failure_reason: true, open_count: true, click_count: true,
                    created_at: true, is_test: true, category: true,
                    campaign: { select: { id: true, name: true } },
                    recipient_contact: { select: { id: true, first_name: true, last_name: true } },
                    company: { select: { id: true, name: true } },
                    sent_by: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } },
                },
            }),
            this.prisma.commMessage.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const message = await this.prisma.commMessage.findFirst({
            where: { id, organization_id: ctx.organization_id, deleted_at: null, ...this.scope(ctx), ...this.kindFilter(ctx) },
            include: {
                recipients: { orderBy: { role: 'asc' } },
                attachments: true,
                links: true,
                delivery_events: { orderBy: { occurred_at: 'asc' }, select: { id: true, type: true, occurred_at: true, url: true, reason: true, bounce_type: true, provider: true } },
                campaign: { select: { id: true, name: true, status: true } },
                template: { select: { id: true, name: true } },
                sender_identity: { select: { id: true, address: true, display_name: true } },
                recipient_contact: { select: { id: true, first_name: true, last_name: true, email: true } },
                company: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
                sent_by: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } },
            },
        });
        if (!message) throw notFound('Message', 'message_not_found');
        const { search_vector: _s, unsubscribe_token: _u, render_context: _r, ...rest } = message as typeof message & { search_vector?: unknown };
        return rest;
    }

    /**
     * Compose and (optionally) send a one-off message. Sending needs communications.messages.send (checked here, not only on the route).
     * Other modules sending their own transactional messages (proposal reminders, signing reminders) pass
     * `authorized_by_permission`: the caller's key for that business action (e.g. proposals.proposals.send) authorizes the send.
     */
    async create(ctx: OrgContext, dto: SendMessageDto, opts: { authorized_by_permission?: string } = {}) {
        const send = dto.send !== false;
        const moduleAuthorized = !!opts.authorized_by_permission && ctx.can(opts.authorized_by_permission) && dto.kind === CommMessageKind.TRANSACTIONAL;
        if (send && !ctx.can(SEND) && !moduleAuthorized) throw new ForbiddenException({ message: 'You do not have permission to send messages (communications.messages.send)', code: 'permission_denied', permissions: [SEND] });
        let contact: Prisma.CrmContactGetPayload<{ include: { company: { select: { id: true; name: true } } } }> | null = null;
        if (dto.contact_id) {
            contact = await this.prisma.crmContact.findFirst({ where: { id: dto.contact_id, organization_id: ctx.organization_id }, include: { company: { select: { id: true, name: true } } } });
            if (!contact) throw notFound('Contact', 'contact_not_found');
        }
        const rawAddress = dto.to_address ?? (dto.channel === CommChannel.EMAIL ? contact?.email : contact?.mobile ?? contact?.phone);
        const to = normalizeAddress(dto.channel, rawAddress);
        if (!to) throw new BadRequestException({ message: dto.channel === CommChannel.EMAIL ? 'Enter a valid recipient email address' : 'Enter the recipient phone number in E.164 format (+306912345678)', code: 'invalid_address' });
        if (dto.company_id && !(await this.prisma.crmCompany.findFirst({ where: { id: dto.company_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw notFound('Company', 'company_not_found');
        if (dto.project_id && !(await this.prisma.project.findFirst({ where: { id: dto.project_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw notFound('Project', 'project_not_found');

        let subject = dto.subject ?? null;
        let body_html = dto.body_html ?? null;
        let body_text = dto.body_text ?? null;
        let template_version_id: string | null = null;
        let category = dto.category ?? null;
        let senderId = dto.sender_identity_id ?? null;
        if (dto.template_id) {
            const t = await this.prisma.commTemplate.findFirst({ where: { id: dto.template_id, organization_id: ctx.organization_id, archived_at: null }, include: { current_version: true } });
            if (!t) throw notFound('Template', 'template_not_found');
            if (t.channel !== dto.channel) throw new BadRequestException({ message: 'The template is for another channel', code: 'template_channel_mismatch' });
            if (!t.current_version) throw new BadRequestException({ message: 'Publish the template before sending it', code: 'template_not_published' });
            subject = subject ?? t.current_version.subject;
            body_html = body_html ?? t.current_version.body_html;
            body_text = body_text ?? t.current_version.body_text;
            template_version_id = t.current_version.id;
            category = category ?? t.category;
            senderId = senderId ?? t.default_sender_identity_id;
        }
        if (dto.channel === CommChannel.EMAIL && !subject) throw new BadRequestException({ message: 'Add a subject', code: 'subject_required' });
        if (!body_html && !body_text) throw new BadRequestException({ message: 'Add the message content', code: 'body_required' });
        if (dto.channel === CommChannel.SMS) body_html = null;
        if (senderId) {
            const s = await this.prisma.commSenderIdentity.findFirst({ where: { id: senderId, organization_id: ctx.organization_id, channel: dto.channel }, select: { id: true } });
            if (!s) throw notFound('Sender identity', 'sender_identity_not_found');
        } else {
            senderId = (await this.senders.defaultIdentity(ctx.organization_id, dto.channel, dto.branch_id))?.id ?? null;
        }

        const context = { ...(await this.templates.contextFor(ctx, contact?.id)), ...(contact ? {} : { first_name: dto.to_name?.split(' ')[0] ?? '', full_name: dto.to_name ?? '', email: to }) };
        delete (context as Record<string, unknown>).unsubscribe_url;
        const scheduledAt = dto.scheduled_at ? new Date(dto.scheduled_at) : null;
        if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) throw new BadRequestException({ message: 'The send time is in the past', code: 'schedule_in_past' });
        const status = !send ? CommMessageStatus.DRAFT : scheduledAt ? CommMessageStatus.SCHEDULED : CommMessageStatus.QUEUED;
        const kind = dto.kind ?? CommMessageKind.CUSTOMER;
        const toName = dto.to_name ?? (contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : null);
        const renderedHtml = body_html ? renderTemplate(body_html, context, 'html') : null;

        const threadId = await this.threads.resolveFor(ctx, { channel: dto.channel, subject: subject ? renderTemplate(subject, context) : null, contact_id: contact?.id ?? null, company_id: dto.company_id ?? contact?.company?.id ?? null, project_id: dto.project_id ?? null, to_address: to, in_reply_to_message_id: dto.in_reply_to_message_id ?? null });
        const message = await this.prisma.commMessage.create({
            data: {
                organization_id: ctx.organization_id,
                branch_id: dto.branch_id ?? null,
                channel: dto.channel,
                thread_id: threadId,
                in_reply_to_message_id: dto.in_reply_to_message_id ?? null,
                kind,
                source: ctx.channel === 'ui' ? CommMessageSource.MANUAL : ctx.channel === 'automation' ? CommMessageSource.AUTOMATION : CommMessageSource.API,
                status,
                template_id: dto.template_id ?? null,
                template_version_id,
                category,
                subject: subject ? renderTemplate(subject, context) : null,
                body_html: renderedHtml,
                body_text: body_text ? renderTemplate(body_text, context) : renderedHtml ? htmlToText(renderedHtml) : null,
                render_context: context as Prisma.InputJsonValue,
                sender_identity_id: senderId,
                reply_to_address: dto.reply_to_address ?? null,
                sent_by_membership_id: ctx.membership_id,
                owner_membership_id: ctx.membership_id,
                recipient_kind: contact ? 'CRM_CONTACT' : 'EXTERNAL',
                to_address: to,
                to_name: toName,
                recipient_contact_id: contact?.id ?? null,
                company_id: dto.company_id ?? contact?.company?.id ?? null,
                project_id: dto.project_id ?? null,
                scheduled_at: scheduledAt,
                queued_at: status === CommMessageStatus.QUEUED ? new Date() : null,
                created_by_user_id: ctx.user_id,
                recipients: { create: { role: 'TO', kind: contact ? 'CRM_CONTACT' : 'EXTERNAL', address: to, name: toName, contact_id: contact?.id ?? null } },
                ...((contact || dto.company_id || dto.project_id) && {
                    links: {
                        create: [
                            ...(contact ? [{ entity_type: RecordEntityType.CRM_CONTACT, entity_id: contact.id, relation: 'about' }] : []),
                            ...((dto.company_id ?? contact?.company?.id) ? [{ entity_type: RecordEntityType.CRM_COMPANY, entity_id: (dto.company_id ?? contact?.company?.id)!, relation: 'about' }] : []),
                            ...(dto.project_id ? [{ entity_type: RecordEntityType.PROJECT, entity_id: dto.project_id, relation: 'related' }] : []),
                        ],
                    },
                }),
            },
        });
        await this.audit.record(ctx, status === CommMessageStatus.DRAFT ? 'communications.message.drafted' : 'communications.message.sent', {
            resource_type: 'comm_message', resource_id: message.id, branch_id: message.branch_id,
            metadata: { channel: dto.channel, kind, to, scheduled_at: scheduledAt?.toISOString() ?? null, template_id: dto.template_id ?? null, sensitive: status !== CommMessageStatus.DRAFT },
        });
        if (status === CommMessageStatus.QUEUED) await this.dispatch.dispatch(message.id);
        const result = await this.findOne(ctx, message.id);
        this.events.publish(ctx, {
            event_key: status === CommMessageStatus.DRAFT ? 'communications.message.drafted' : scheduledAt ? 'communications.message.scheduled' : 'communications.message.sent',
            module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.COMM_MESSAGE, entity_id: message.id,
            payload: { channel: dto.channel, kind, status: result.status, contact_id: contact?.id ?? null, company_id: message.company_id, failure_reason: result.failure_reason },
            ...(status !== CommMessageStatus.DRAFT && {
                activity: { summary: `${dto.channel === CommChannel.EMAIL ? 'Email' : 'SMS'} ${scheduledAt ? 'scheduled' : 'sent'} to ${toName ?? to}`, entity_label: message.subject ?? to, company_id: message.company_id, project_id: message.project_id },
            }),
        });
        return result;
    }

    /** Send a DRAFT. */
    async send(ctx: OrgContext, id: string) {
        const message = await this.findOne(ctx, id);
        if (message.status !== CommMessageStatus.DRAFT) throw new ConflictException({ message: 'Only drafts can be sent', code: 'message_not_draft' });
        const scheduled = message.scheduled_at && message.scheduled_at.getTime() > Date.now();
        await this.prisma.commMessage.update({ where: { id }, data: { status: scheduled ? CommMessageStatus.SCHEDULED : CommMessageStatus.QUEUED, queued_at: new Date(), sent_by_membership_id: ctx.membership_id } });
        await this.audit.record(ctx, 'communications.message.sent', { resource_type: 'comm_message', resource_id: id, metadata: { channel: message.channel, to: message.to_address, sensitive: true } });
        if (!scheduled) await this.dispatch.dispatch(id);
        const result = await this.findOne(ctx, id);
        this.events.publish(ctx, { event_key: 'communications.message.sent', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.COMM_MESSAGE, entity_id: id, payload: { channel: message.channel, status: result.status } });
        return result;
    }

    /** Send a failed / bounced / cancelled message again as a new message (history stays intact). */
    async resend(ctx: OrgContext, id: string) {
        const m = await this.prisma.commMessage.findFirst({ where: { id, organization_id: ctx.organization_id, deleted_at: null, ...this.scope(ctx) } });
        if (!m) throw notFound('Message', 'message_not_found');
        if (!([CommMessageStatus.FAILED, CommMessageStatus.BOUNCED, CommMessageStatus.CANCELLED] as CommMessageStatus[]).includes(m.status)) {
            throw new ConflictException({ message: 'Only failed, bounced or cancelled messages can be resent', code: 'message_not_resendable' });
        }
        const copy = await this.prisma.commMessage.create({
            data: {
                organization_id: m.organization_id, branch_id: m.branch_id, channel: m.channel, kind: m.kind, source: m.source, status: CommMessageStatus.QUEUED,
                thread_id: m.thread_id, template_id: m.template_id, template_version_id: m.template_version_id, category: m.category, subject: m.subject, preheader: m.preheader,
                body_html: m.body_html, body_text: m.body_text, render_context: (m.render_context ?? undefined) as Prisma.InputJsonValue, sender_identity_id: m.sender_identity_id,
                from_address: m.from_address, from_name: m.from_name, reply_to_address: m.reply_to_address, sent_by_membership_id: ctx.membership_id, owner_membership_id: m.owner_membership_id,
                recipient_kind: m.recipient_kind, to_address: m.to_address, to_name: m.to_name, recipient_contact_id: m.recipient_contact_id, company_id: m.company_id, project_id: m.project_id,
                tracking_enabled: m.tracking_enabled, queued_at: new Date(), created_by_user_id: ctx.user_id,
                recipients: { create: { role: 'TO', kind: m.recipient_kind, address: m.to_address, name: m.to_name, contact_id: m.recipient_contact_id } },
            },
        });
        await this.audit.record(ctx, 'communications.message.resent', { resource_type: 'comm_message', resource_id: copy.id, metadata: { original_message_id: id, sensitive: true } });
        await this.dispatch.dispatch(copy.id);
        const result = await this.findOne(ctx, copy.id);
        this.events.publish(ctx, { event_key: 'communications.message.sent', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.COMM_MESSAGE, entity_id: copy.id, payload: { channel: m.channel, status: result.status, resent_from: id } });
        return result;
    }

    async cancel(ctx: OrgContext, id: string) {
        const message = await this.findOne(ctx, id);
        const res = await this.prisma.commMessage.updateMany({
            where: { id, status: { in: [CommMessageStatus.SCHEDULED, CommMessageStatus.QUEUED, CommMessageStatus.DRAFT] } },
            data: { status: CommMessageStatus.CANCELLED, cancelled_at: new Date() },
        });
        if (!res.count) throw new ConflictException({ message: 'The message was already sent', code: 'message_not_cancellable' });
        await this.audit.record(ctx, 'communications.message.cancelled', { resource_type: 'comm_message', resource_id: id });
        this.events.publish(ctx, { event_key: 'communications.message.cancelled', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.COMM_MESSAGE, entity_id: id, payload: { channel: message.channel } });
        return this.findOne(ctx, id);
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        await this.findOne(ctx, id);
        await this.prisma.commMessage.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'communications.message.archived' : 'communications.message.restored', { resource_type: 'comm_message', resource_id: id });
        this.events.publish(ctx, { event_key: archived ? 'communications.message.archived' : 'communications.message.restored', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.COMM_MESSAGE, entity_id: id, payload: {} });
        return this.findOne(ctx, id);
    }

    /** Follow-up in a conversation thread: same channel and recipient as the last message, "Re:" subject. */
    async replyInThread(
        ctx: OrgContext,
        thread: { id: string; channel: CommChannel; subject: string | null; contact_id: string | null; company_id: string | null; project_id: string | null; messages: { id: string; to_address: string; to_name: string | null }[] },
        dto: { subject?: string; body_html?: string; body_text?: string; sender_identity_id?: string },
    ) {
        const last = thread.messages[thread.messages.length - 1];
        if (!last) throw notFound('Message', 'message_not_found');
        const base = thread.subject ?? '';
        return this.create(ctx, {
            channel: thread.channel,
            contact_id: thread.contact_id ?? undefined,
            to_address: last.to_address,
            to_name: last.to_name ?? undefined,
            subject: thread.channel === CommChannel.EMAIL ? dto.subject ?? (/^re:/i.test(base) ? base : `Re: ${base}`.trim()) : undefined,
            body_html: dto.body_html,
            body_text: dto.body_text,
            sender_identity_id: dto.sender_identity_id,
            company_id: thread.company_id ?? undefined,
            project_id: thread.project_id ?? undefined,
            in_reply_to_message_id: last.id,
        });
    }

    /** Ask the runner to pick up scheduled messages (used after creating scheduled sends via automation). */
    kick() {
        this.runner.kick();
    }
}
