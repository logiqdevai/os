import { Injectable } from '@nestjs/common';
import { CommChannel, CommMessageKind, ModuleKey, Prisma } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { BaseListQuerySchema, boolish, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { branchScopeWhere, notFound } from '../common/comm.utils';

const READ = 'communications.messages.read';

export const ThreadQuerySchema = BaseListQuerySchema.extend({
    channel: z.nativeEnum(CommChannel).optional(),
    contact_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    archived: boolish,
});
export type ThreadQuery = z.infer<typeof ThreadQuerySchema>;

/** "Re: Fwd: Hello" → "hello" (thread matching ignores reply prefixes and case). */
export const normalizeSubject = (s: string | null | undefined) =>
    (s ?? '').replace(/^(\s*(re|fwd?|aw|wg|sv|antw)\s*:\s*)+/i, '').trim().toLowerCase();

const PERSON = { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } as const;

/**
 * Conversation threads of one-off email / SMS (11 "Communication History", CommThread): every customer message joins a
 * thread — the thread of the message it replies to, else the open thread with the same contact (or address) and subject.
 * Campaign sends are not threaded. Inbound replies arrive through 13 Support (support_conversation_id).
 */
@Injectable()
export class CommThreadsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    /** Messages of a thread the caller may see (branch scope; notification sends only for communication admins). */
    private messageScope(ctx: OrgContext): Prisma.CommMessageWhereInput {
        return {
            deleted_at: null,
            is_test: false,
            ...(branchScopeWhere(ctx, READ, ['sent_by_membership_id', 'owner_membership_id']) as Prisma.CommMessageWhereInput),
            ...(!ctx.can('communications.settings.manage') && { kind: { not: CommMessageKind.NOTIFICATION } }),
        };
    }

    /** Thread for a new outgoing message (created when none matches). */
    async resolveFor(ctx: OrgContext, m: { channel: CommChannel; subject: string | null; contact_id: string | null; company_id: string | null; project_id: string | null; to_address: string; in_reply_to_message_id: string | null }): Promise<string> {
        if (m.in_reply_to_message_id) {
            const parent = await this.prisma.commMessage.findFirst({ where: { id: m.in_reply_to_message_id, organization_id: ctx.organization_id, ...this.messageScope(ctx) }, select: { id: true, thread_id: true, subject: true, channel: true, recipient_contact_id: true, company_id: true, project_id: true } });
            if (!parent) throw notFound('Message', 'message_not_found');
            if (parent.thread_id) return parent.thread_id;
            const t = await this.prisma.commThread.create({ data: { organization_id: ctx.organization_id, channel: parent.channel, subject: parent.subject, contact_id: parent.recipient_contact_id, company_id: parent.company_id, project_id: parent.project_id, message_count: 1, last_message_at: new Date() } });
            await this.prisma.commMessage.update({ where: { id: parent.id }, data: { thread_id: t.id } });
            return t.id;
        }
        const subject = normalizeSubject(m.subject);
        const candidates = await this.prisma.commThread.findMany({
            where: {
                organization_id: ctx.organization_id,
                channel: m.channel,
                archived_at: null,
                ...(m.contact_id ? { contact_id: m.contact_id } : { contact_id: null, messages: { some: { to_address: m.to_address } } }),
            },
            orderBy: { last_message_at: 'desc' },
            take: 20,
            select: { id: true, subject: true },
        });
        // SMS has no subject: one running thread per contact / number.
        const match = m.channel === CommChannel.SMS ? candidates[0] : candidates.find((t) => normalizeSubject(t.subject) === subject);
        if (match) return match.id;
        const t = await this.prisma.commThread.create({
            data: { organization_id: ctx.organization_id, channel: m.channel, subject: m.channel === CommChannel.SMS ? null : m.subject, contact_id: m.contact_id, company_id: m.company_id, project_id: m.project_id },
        });
        return t.id;
    }

    async findAll(ctx: OrgContext, query: ThreadQuery) {
        const scope = this.messageScope(ctx);
        const where: Prisma.CommThreadWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.channel && { channel: query.channel }),
            ...(query.contact_id && { contact_id: query.contact_id }),
            ...(query.company_id && { company_id: query.company_id }),
            ...(query.project_id && { project_id: query.project_id }),
            messages: { some: scope },
            ...(query.search && {
                OR: [
                    { subject: { contains: query.search, mode: 'insensitive' } },
                    { contact: { OR: [{ first_name: { contains: query.search, mode: 'insensitive' } }, { last_name: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] } },
                    { messages: { some: { ...scope, to_address: { contains: query.search, mode: 'insensitive' } } } },
                ],
            }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.commThread.findMany({
                where,
                ...skipTake(query),
                orderBy: [{ last_message_at: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
                include: {
                    contact: { select: { id: true, first_name: true, last_name: true, email: true } },
                    company: { select: { id: true, name: true } },
                    messages: { where: scope, orderBy: { created_at: 'desc' }, take: 1, select: { id: true, subject: true, body_text: true, status: true, to_address: true, to_name: true, created_at: true, sent_at: true, replied_at: true } },
                    _count: { select: { messages: { where: scope } } },
                },
            }),
            this.prisma.commThread.count({ where }),
        ]);
        return paginate(
            rows.map(({ messages, _count, ...t }) => ({ ...t, visible_message_count: _count.messages, last_message: messages[0] ? { ...messages[0], body_text: messages[0].body_text?.slice(0, 200) ?? null } : null })),
            total,
            query,
        );
    }

    async findOne(ctx: OrgContext, id: string) {
        const scope = this.messageScope(ctx);
        const thread = await this.prisma.commThread.findFirst({
            where: { id, organization_id: ctx.organization_id, messages: { some: scope } },
            include: {
                contact: { select: { id: true, first_name: true, last_name: true, email: true, mobile: true } },
                company: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
                messages: {
                    where: scope,
                    orderBy: { created_at: 'asc' },
                    take: 200,
                    select: {
                        id: true, channel: true, kind: true, status: true, subject: true, body_html: true, body_text: true, to_address: true, to_name: true, from_address: true, from_name: true,
                        in_reply_to_message_id: true, created_at: true, scheduled_at: true, sent_at: true, delivered_at: true, first_opened_at: true, replied_at: true, failure_reason: true,
                        sent_by: PERSON,
                    },
                },
            },
        });
        if (!thread) throw notFound('Thread', 'thread_not_found');
        return thread;
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        await this.findOne(ctx, id);
        const row = await this.prisma.commThread.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'communications.thread.archived' : 'communications.thread.restored', { resource_type: 'comm_thread', resource_id: id });
        this.events.publish(ctx, { event_key: archived ? 'communications.thread.archived' : 'communications.thread.restored', module: ModuleKey.COMMUNICATION, entity_kind: 'comm_thread', entity_id: id, payload: {} });
        return row;
    }
}
