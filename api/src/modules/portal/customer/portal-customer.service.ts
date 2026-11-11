import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliverableStatus, ModuleKey, Prisma, SupportMessageKind } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { TicketsService } from '@/modules/support/tickets/tickets.service';
import { ConversationsService } from '@/modules/support/conversations/conversations.service';
import { KnowledgeService } from '@/modules/support/knowledge/knowledge.service';
import { CsatService } from '@/modules/support/csat/csat.service';
import { SupportSetupService } from '@/modules/support/common/support-setup.service';
import { PortalContext, PortalFeature } from '../common/portal-context';
import { PortalInvitationsService } from '../common/portal-invitations.service';
import { applyChangeSet, buildChangeSet, COMPANY_EDITABLE, CONTACT_EDITABLE } from '../common/profile-changes.utils';
import {
    CreatePortalRequestDto,
    DeliverableReviewDto,
    PortalListQuery,
    PortalTeamInviteDto,
    PortalTeamUpdateDto,
    ProfileChangeRequestDto,
    StartPortalConversationDto,
    UpdatePortalRequestDto,
} from './dto/portal-customer.dto';

const M = ModuleKey.CUSTOMER_PORTAL;
/** Message kinds a customer may ever see. INTERNAL_NOTE and SYSTEM are never returned. */
const PUBLIC_KINDS: SupportMessageKind[] = ['CUSTOMER', 'AGENT', 'AI_AGENT'];
const OPEN_CATS = ['NEW', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD'] as const;
const AWAITING: DeliverableStatus[] = ['READY_FOR_REVIEW', 'SUBMITTED'];
const VISIBLE_PROPOSAL_STATUSES = ['SENT', 'VIEWED', 'CHANGES_REQUESTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;
const HIDDEN_CONTRACT_STATUSES = ['DRAFT', 'INTERNAL_REVIEW', 'APPROVAL_REQUIRED', 'CANCELLED'] as const;
const HIDDEN_INVOICE_STATUSES = ['DRAFT', 'SCHEDULED'] as const;

/** Agency people are shown with name and photo only (07 §3). */
const AGENT_PUBLIC = { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, profile_photo_url: true } } } } as const;
const USER_PUBLIC = { select: { id: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } } as const;

const TICKET_PUBLIC_SELECT = {
    id: true, reference: true, subject: true, type: true, priority: true, created_at: true, updated_at: true, resolved_at: true, closed_at: true,
    last_agent_reply_at: true, last_customer_reply_at: true, assignee_membership_id: true, requester_user_id: true, requester_name: true,
    status: { select: { name: true, customer_label: true, category: true, color: true } },
    project: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

const presentTicket = <T extends { status: { name: string; customer_label: string | null; category: string; color: string | null } | null; assignee_membership_id: string | null }>(t: T) => {
    const { assignee_membership_id, status, ...rest } = t;
    return {
        ...rest,
        status: status ? { label: status.customer_label || status.name, category: status.category, color: status.color } : null,
        assigned: !!assignee_membership_id,
    };
};

/**
 * The customer side of the portal (07). Every query is pinned to the caller's organization and customer
 * (CRM Company) from PortalContext, re-checked on every read, and returns only customer-visible records and
 * customer-safe fields: no internal notes, internal fields, costs, or other customers' data.
 */
@Injectable()
export class PortalCustomerService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly tickets: TicketsService,
        private readonly conversations: ConversationsService,
        private readonly knowledge: KnowledgeService,
        private readonly csat: CsatService,
        private readonly supportSetup: SupportSetupService,
        private readonly invitations: PortalInvitationsService,
    ) { }

    private feature(p: PortalContext, f: PortalFeature) {
        if (!p.features[f]) throw new ForbiddenException({ message: 'This part of the portal is switched off', code: 'portal_feature_disabled', feature: f });
    }

    // ---------------------------------------------------------------------------------------------
    // Session
    // ---------------------------------------------------------------------------------------------

    /** Every active portal membership of the signed-in user (company picker). */
    async memberships(userId: string) {
        const rows = await this.prisma.customerPortalMembership.findMany({
            where: { user_id: userId, status: 'ACTIVE', organization: { deleted_at: null } },
            include: { organization: { select: { id: true, display_name: true, logo_url: true, slug: true } }, role: { select: { name: true } } },
            orderBy: { last_active_at: { sort: 'desc', nulls: 'last' } },
        });
        const companies = await this.prisma.crmCompany.findMany({ where: { id: { in: rows.map((r) => r.customer_id) } }, select: { id: true, name: true } });
        return rows.map((r) => ({ id: r.id, organization: r.organization, company: companies.find((c) => c.id === r.customer_id) ?? null, role: r.role?.name ?? null, last_active_at: r.last_active_at }));
    }

    async me(p: PortalContext) {
        const [user, org, company, settings, client] = await Promise.all([
            this.prisma.user.findUnique({ where: { id: p.user_id }, select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true, timezone: true, locale: true } }),
            this.prisma.organization.findUnique({ where: { id: p.organization_id }, select: { id: true, display_name: true, slug: true, logo_url: true, branding: true, default_currency: true } }),
            this.prisma.crmCompany.findUnique({ where: { id: p.customer_id }, select: { id: true, name: true, website: true } }),
            this.prisma.customerPortalSettings.findUnique({ where: { organization_id: p.organization_id }, select: { branding: true, welcome_message: true, support_email: true, profile_changes_require_approval: true } }),
            this.prisma.customerPortalClientSettings.findUnique({ where: { organization_id_company_id: { organization_id: p.organization_id, company_id: p.customer_id } }, select: { branding: true, welcome_message: true } }),
        ]);
        const branding = {
            ...((org?.branding as Record<string, unknown>) ?? {}),
            ...((settings?.branding as Record<string, unknown>) ?? {}),
            ...((client?.branding as Record<string, unknown>) ?? {}),
        };
        return {
            user,
            membership_id: p.portal_membership_id,
            organization: org ? { id: org.id, display_name: org.display_name, slug: org.slug, logo_url: (branding.logo_url as string) ?? org.logo_url, default_currency: org.default_currency } : null,
            branding,
            company,
            role: p.role,
            permissions: p.permissions,
            features: p.features,
            welcome_message: client?.welcome_message ?? settings?.welcome_message ?? null,
            support_email: settings?.support_email ?? null,
            profile_changes_require_approval: settings?.profile_changes_require_approval ?? true,
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Projects
    // ---------------------------------------------------------------------------------------------

    /** Projects this portal user may see: the company's CUSTOMER_VISIBLE projects, narrowed by explicit access rows. */
    private async projectWhere(p: PortalContext): Promise<Prisma.ProjectWhereInput> {
        const access = await this.prisma.customerPortalMembershipProject.findMany({ where: { portal_membership_id: p.portal_membership_id }, select: { project_id: true } });
        return {
            organization_id: p.organization_id,
            company_id: p.customer_id,
            visibility: 'CUSTOMER_VISIBLE',
            archived_at: null,
            ...(access.length && { id: { in: access.map((a) => a.project_id) } }),
        };
    }

    private async visibleProjectIds(p: PortalContext) {
        const rows = await this.prisma.project.findMany({ where: await this.projectWhere(p), select: { id: true } });
        return rows.map((r) => r.id);
    }

    async projects(p: PortalContext, q: PortalListQuery) {
        this.feature(p, 'projects');
        const where: Prisma.ProjectWhereInput = { ...(await this.projectWhere(p)), ...(q.search && { name: { contains: q.search, mode: 'insensitive' } }) };
        const [rows, total] = await Promise.all([
            this.prisma.project.findMany({
                where,
                ...skipTake(q),
                orderBy: [{ completed_at: { sort: 'desc', nulls: 'first' } }, { updated_at: 'desc' }],
                select: {
                    id: true, name: true, code: true, description: true, health: true, progress_percent: true, planned_start: true, actual_start: true,
                    target_completion: true, customer_deadline: true, completed_at: true, color: true,
                    status: { select: { name: true, category: true, color: true } },
                    _count: { select: { deliverables: { where: { customer_visible: true, status: { in: AWAITING } } } } },
                },
            }),
            this.prisma.project.count({ where }),
        ]);
        return paginate(rows.map(({ _count, ...r }) => ({ ...r, approvals_waiting: _count.deliverables })), total, q);
    }

    async project(p: PortalContext, id: string) {
        this.feature(p, 'projects');
        const project = await this.prisma.project.findFirst({
            where: { ...(await this.projectWhere(p)), id },
            select: {
                id: true, name: true, code: true, description: true, health: true, progress_percent: true, planned_start: true, actual_start: true,
                target_completion: true, customer_deadline: true, completed_at: true, color: true,
                status: { select: { name: true, category: true, color: true } },
                milestones: { where: { customer_visible: true }, orderBy: [{ sort_order: 'asc' }, { planned_date: 'asc' }], select: { id: true, name: true, description: true, status: true, planned_date: true, actual_date: true, progress_percent: true, completed_at: true } },
                deliverables: {
                    where: { customer_visible: true, status: { not: 'CANCELLED' } },
                    orderBy: [{ sort_order: 'asc' }, { due_date: 'asc' }],
                    select: { id: true, name: true, description: true, status: true, due_date: true, submitted_at: true, accepted_at: true, milestone_id: true, approval_mode: true, reviews: { orderBy: { decided_at: 'desc' }, take: 5, select: { decision: true, comment: true, decided_at: true, reviewer_user_id: true } } },
                },
                status_updates: { where: { customer_visible: true, published_at: { not: null } }, orderBy: { published_at: 'desc' }, take: 20, select: { id: true, summary: true, completed_work: true, current_work: true, upcoming_work: true, progress_percent: true, health: true, required_actions: true, published_at: true } },
                tasks: { where: { customer_visible: true, archived_at: null }, orderBy: { updated_at: 'desc' }, take: 100, select: { id: true, title: true, due_date: true, completed_at: true, status: { select: { name: true, category: true } } } },
                members: { where: { is_active: true }, select: { role_label: true, membership: AGENT_PUBLIC } },
            },
        });
        if (!project) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        return { ...project, can_approve: p.can('portal.deliverables.approve') };
    }

    // ---------------------------------------------------------------------------------------------
    // Deliverable approvals (05 §47, 07 §7)
    // ---------------------------------------------------------------------------------------------

    async approvals(p: PortalContext, q: PortalListQuery) {
        this.feature(p, 'projects');
        const projectIds = await this.visibleProjectIds(p);
        const statuses: DeliverableStatus[] = q.status === 'decided' ? ['ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED'] : AWAITING;
        const where: Prisma.ProjectDeliverableWhereInput = { project_id: { in: projectIds }, customer_visible: true, status: { in: statuses } };
        const [rows, total] = await Promise.all([
            this.prisma.projectDeliverable.findMany({
                where,
                ...skipTake(q),
                orderBy: [{ due_date: { sort: 'asc', nulls: 'last' } }, { submitted_at: 'desc' }],
                select: {
                    id: true, name: true, description: true, status: true, due_date: true, submitted_at: true, accepted_at: true, approval_mode: true,
                    project: { select: { id: true, name: true } },
                    approvers: { select: { portal_membership_id: true, required: true } },
                    reviews: { orderBy: { decided_at: 'desc' }, take: 5, select: { decision: true, comment: true, decided_at: true, reviewer_user_id: true } },
                },
            }),
            this.prisma.projectDeliverable.count({ where }),
        ]);
        return paginate(
            rows.map(({ approvers, ...d }) => ({ ...d, you_can_decide: this.mayDecide(p, approvers) && AWAITING.includes(d.status), approver_count: approvers.length })),
            total,
            q,
        );
    }

    private mayDecide(p: PortalContext, approvers: { portal_membership_id: string }[]) {
        if (!p.can('portal.deliverables.approve')) return false;
        return !approvers.length || approvers.some((a) => a.portal_membership_id === p.portal_membership_id);
    }

    async reviewDeliverable(p: PortalContext, id: string, dto: DeliverableReviewDto) {
        this.feature(p, 'projects');
        const projectIds = await this.visibleProjectIds(p);
        const d = await this.prisma.projectDeliverable.findFirst({ where: { id, project_id: { in: projectIds }, customer_visible: true }, include: { approvers: true, project: { select: { id: true, name: true, organization_id: true } } } });
        if (!d) throw new NotFoundException({ message: 'Deliverable not found', code: 'deliverable_not_found' });
        if (!AWAITING.includes(d.status)) throw new ConflictException({ message: 'This deliverable is not waiting for your review', code: 'deliverable_not_awaiting' });
        if (!this.mayDecide(p, d.approvers)) throw new ForbiddenException({ message: 'You are not an approver of this deliverable', code: 'deliverable_not_approver' });
        if (dto.decision !== 'ACCEPTED' && !dto.comment?.trim()) throw new BadRequestException({ message: 'Tell the team what to change', code: 'deliverable_comment_required' });

        const result = await this.prisma.$transaction(async (tx) => {
            await tx.projectDeliverableReview.create({ data: { organization_id: p.organization_id, deliverable_id: id, decision: dto.decision, comment: dto.comment ?? null, reviewer_user_id: p.user_id } });
            let status: DeliverableStatus = dto.decision;
            if (dto.decision === 'ACCEPTED' && d.approval_mode === 'ALL' && d.approvers.length) {
                // Every required approver must have accepted since the last submission.
                const since = d.submitted_at ?? d.created_at;
                const required = d.approvers.filter((a) => a.required);
                const members = await tx.customerPortalMembership.findMany({ where: { id: { in: required.map((a) => a.portal_membership_id) } }, select: { user_id: true } });
                const accepted = await tx.projectDeliverableReview.findMany({ where: { deliverable_id: id, decision: 'ACCEPTED', decided_at: { gte: since } }, select: { reviewer_user_id: true } });
                const done = members.every((m) => accepted.some((a) => a.reviewer_user_id === m.user_id));
                if (!done) status = d.status;
            }
            await tx.projectDeliverable.update({
                where: { id },
                data: {
                    status,
                    ...(status === 'ACCEPTED' && { accepted_at: new Date(), acceptance_record: { portal_user_id: p.user_id, portal_membership_id: p.portal_membership_id, comment: dto.comment ?? null, decided_at: new Date().toISOString() } }),
                },
            });
            return status;
        });
        await this.audit.record(p.actor, 'portal.deliverable.reviewed', { resource_type: 'project_deliverable', resource_id: id, metadata: { decision: dto.decision, resulting_status: result, project_id: d.project_id, portal_membership_id: p.portal_membership_id } });
        this.events.publish(p.actor, {
            event_key: result === 'ACCEPTED' ? 'projects.deliverable.accepted' : dto.decision === 'ACCEPTED' ? 'projects.deliverable.approval_recorded' : dto.decision === 'REJECTED' ? 'projects.deliverable.rejected' : 'projects.deliverable.changes_requested',
            module: ModuleKey.PROJECTS,
            entity_kind: 'project_deliverable',
            entity_id: id,
            payload: { name: d.name, project_id: d.project_id, decision: dto.decision, comment: dto.comment, customer_id: p.customer_id },
            activity: { summary: `Customer ${dto.decision === 'ACCEPTED' ? 'approved' : dto.decision === 'REJECTED' ? 'rejected' : 'requested changes to'} "${d.name}"`, project_id: d.project_id, company_id: p.customer_id, customer_visible: true },
        });
        return { id, status: result };
    }

    // ---------------------------------------------------------------------------------------------
    // Requests (tickets, 13 §5)
    // ---------------------------------------------------------------------------------------------

    private requestWhere(p: PortalContext): Prisma.TicketWhereInput {
        return { organization_id: p.organization_id, company_id: p.customer_id, customer_visible: true, archived_at: null, merged_into_ticket_id: null };
    }

    async requests(p: PortalContext, q: PortalListQuery) {
        this.feature(p, 'requests');
        const where: Prisma.TicketWhereInput = {
            ...this.requestWhere(p),
            ...(q.status === 'open' && { status: { category: { in: [...OPEN_CATS] } } }),
            ...(q.status === 'closed' && { status: { category: { in: ['RESOLVED', 'CLOSED'] } } }),
            ...(q.project_id && { project_id: q.project_id }),
            ...(q.search && { OR: [{ subject: { contains: q.search, mode: 'insensitive' } }, { reference: { contains: q.search, mode: 'insensitive' } }] }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.ticket.findMany({ where, ...skipTake(q), orderBy: { updated_at: 'desc' }, select: TICKET_PUBLIC_SELECT }),
            this.prisma.ticket.count({ where }),
        ]);
        return paginate(rows.map(presentTicket), total, q);
    }

    async request(p: PortalContext, idOrRef: string) {
        this.feature(p, 'requests');
        const isUuid = /^[0-9a-f-]{36}$/i.test(idOrRef);
        const t = await this.prisma.ticket.findFirst({
            where: { ...this.requestWhere(p), ...(isUuid ? { id: idOrRef } : { reference: { equals: idOrRef, mode: 'insensitive' } }) },
            select: {
                ...TICKET_PUBLIC_SELECT,
                description: true,
                conversation_id: true,
                conversations: { select: { conversation_id: true } },
                requester_user: USER_PUBLIC,
                task_links: { where: { task: { customer_visible: true } }, select: { task: { select: { title: true, completed_at: true, status: { select: { name: true, category: true } } } } } },
                csat_ratings: { orderBy: { requested_at: 'desc' }, take: 1, select: { id: true, rating: true, comment: true, submitted_at: true, requested_at: true, expires_at: true } },
            },
        });
        if (!t) throw new NotFoundException({ message: 'Request not found', code: 'request_not_found' });
        const convIds = [t.conversation_id, ...t.conversations.map((c) => c.conversation_id)].filter(Boolean) as string[];
        const messages = convIds.length
            ? await this.prisma.supportMessage.findMany({
                where: { conversation_id: { in: convIds }, kind: { in: PUBLIC_KINDS }, deleted_at: null },
                orderBy: { created_at: 'asc' },
                select: { id: true, kind: true, body: true, created_at: true, author: AGENT_PUBLIC, author_user: USER_PUBLIC, author_name: true, attachments: { select: { id: true, file_name: true, mime_type: true, size_bytes: true, document_id: true } } },
            })
            : [];
        const { conversation_id, conversations, csat_ratings, task_links, ...rest } = t;
        void conversation_id; void conversations;
        const rating = csat_ratings[0];
        const now = new Date();
        return {
            ...presentTicket(rest),
            messages: messages.map((m) => ({ ...m, author_name: m.kind === 'CUSTOMER' ? m.author_name : null, mine: m.author_user?.id === p.user_id })),
            linked_work: task_links.map((l) => l.task),
            can_edit: !rest.assignee_membership_id && rest.status?.category === 'NEW' && p.can('portal.requests.create'),
            can_reply: p.can('portal.requests.create') && rest.status?.category !== 'CLOSED',
            rating: rating
                ? { submitted: !!rating.submitted_at, rating: rating.rating, comment: rating.comment, can_rate: !rating.submitted_at && rating.requested_at <= now && (!rating.expires_at || rating.expires_at > now) }
                : null,
        };
    }

    async createRequest(p: PortalContext, dto: CreatePortalRequestDto) {
        this.feature(p, 'requests');
        if (dto.project_id) {
            const ids = await this.visibleProjectIds(p);
            if (!ids.includes(dto.project_id)) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        }
        await this.supportSetup.ensureDefaults(p.organization_id);
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: p.user_id }, select: { email: true, display_name: true, first_name: true, last_name: true } });
        const name = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
        const ticket = await this.tickets.create(
            p.actor,
            { subject: dto.subject, description: dto.description, type: dto.type, priority: dto.priority ?? 'NORMAL', project_id: dto.project_id, customer_visible: true },
            { user_id: p.user_id, customer_id: p.customer_id, name, email: user.email },
        );
        await this.audit.record(p.actor, 'portal.request.created', { resource_type: 'ticket', resource_id: ticket.id, metadata: { reference: ticket.reference, portal_membership_id: p.portal_membership_id } });
        return this.request(p, ticket.id);
    }

    async updateRequest(p: PortalContext, id: string, dto: UpdatePortalRequestDto) {
        const t = await this.request(p, id);
        if (!t.can_edit) throw new ConflictException({ message: 'The team is already working on this request. Add a reply instead', code: 'request_locked' });
        await this.prisma.ticket.update({ where: { id: t.id }, data: dto });
        await this.audit.record(p.actor, 'portal.request.updated', { resource_type: 'ticket', resource_id: t.id, metadata: { after: dto } });
        this.events.publish(p.actor, { event_key: 'support.ticket.updated', module: ModuleKey.SUPPORT, entity_type: 'TICKET', entity_id: t.id, payload: { reference: t.reference, via: 'portal' }, changes: dto as Record<string, unknown> });
        return this.request(p, t.id);
    }

    async replyToRequest(p: PortalContext, id: string, body: string) {
        const t = await this.request(p, id);
        if (!t.can_reply) throw new ConflictException({ message: 'This request is closed. Open a new request instead', code: 'request_closed' });
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: p.user_id }, select: { email: true, display_name: true, first_name: true, last_name: true } });
        const name = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
        await this.prisma.$transaction(async (tx) => {
            const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: t.id } });
            let convId = ticket.conversation_id;
            if (!convId) {
                const c = await tx.supportConversation.create({ data: { organization_id: p.organization_id, inbox_id: ticket.inbox_id, channel_type: 'PORTAL', subject: ticket.subject, company_id: p.customer_id, customer_user_id: p.user_id, customer_name: name, customer_email: user.email, assignee_membership_id: ticket.assignee_membership_id, team_id: ticket.team_id } });
                await tx.ticket.update({ where: { id: ticket.id }, data: { conversation_id: c.id } });
                convId = c.id;
            }
            await this.conversations.addMessage(tx, convId, { kind: 'CUSTOMER', body, author_user_id: p.user_id, author_name: name, author_email: user.email, channel_type: 'PORTAL' });
        });
        await this.audit.record(p.actor, 'portal.request.replied', { resource_type: 'ticket', resource_id: t.id });
        this.events.publish(p.actor, { event_key: 'support.ticket.customer_replied', module: ModuleKey.SUPPORT, entity_type: 'TICKET', entity_id: t.id, payload: { reference: t.reference, via: 'portal' } });
        return this.request(p, t.id);
    }

    async rateRequest(p: PortalContext, id: string, rating: number, comment?: string) {
        const t = await this.request(p, id);
        const row = await this.prisma.supportCsatRating.findFirst({ where: { ticket_id: t.id, organization_id: p.organization_id, submitted_at: null }, orderBy: { requested_at: 'desc' } });
        if (!row || row.requested_at > new Date()) throw new ConflictException({ message: 'There is nothing to rate yet', code: 'csat_not_requested' });
        return this.csat.submit(row, rating, comment, p.user_id);
    }

    // ---------------------------------------------------------------------------------------------
    // Support conversations (messages, 13 §5)
    // ---------------------------------------------------------------------------------------------

    private conversationWhere(p: PortalContext): Prisma.SupportConversationWhereInput {
        return {
            organization_id: p.organization_id,
            merged_into_conversation_id: null,
            OR: [{ customer_user_id: p.user_id }, { company_id: p.customer_id, channel_type: 'PORTAL' }],
        };
    }

    async conversationsList(p: PortalContext, q: PortalListQuery) {
        this.feature(p, 'conversations');
        const where = this.conversationWhere(p);
        const [rows, total] = await Promise.all([
            this.prisma.supportConversation.findMany({
                where,
                ...skipTake(q),
                orderBy: [{ last_message_at: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
                select: {
                    id: true, subject: true, status: true, channel_type: true, last_message_at: true, created_at: true, customer_last_read_at: true, last_agent_message_at: true,
                    primary_tickets: { where: { customer_visible: true }, select: { id: true, reference: true }, take: 1 },
                    messages: { where: { kind: { in: PUBLIC_KINDS }, deleted_at: null }, orderBy: { created_at: 'desc' }, take: 1, select: { body: true, kind: true, created_at: true } },
                },
            }),
            this.prisma.supportConversation.count({ where }),
        ]);
        return paginate(
            rows.map(({ messages, primary_tickets, ...c }) => ({
                ...c,
                status: c.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN',
                ticket: primary_tickets[0] ?? null,
                last_message: messages[0] ? { ...messages[0], body: messages[0].body.slice(0, 200) } : null,
                unread: !!c.last_agent_message_at && (!c.customer_last_read_at || c.customer_last_read_at < c.last_agent_message_at),
            })),
            total,
            q,
        );
    }

    async conversation(p: PortalContext, id: string) {
        this.feature(p, 'conversations');
        const c = await this.prisma.supportConversation.findFirst({
            where: { ...this.conversationWhere(p), id },
            select: {
                id: true, subject: true, status: true, channel_type: true, created_at: true,
                primary_tickets: { where: { customer_visible: true }, select: { id: true, reference: true }, take: 1 },
                messages: {
                    where: { kind: { in: PUBLIC_KINDS }, deleted_at: null },
                    orderBy: { created_at: 'asc' },
                    select: { id: true, kind: true, body: true, created_at: true, author: AGENT_PUBLIC, author_user: USER_PUBLIC, author_name: true },
                },
            },
        });
        if (!c) throw new NotFoundException({ message: 'Conversation not found', code: 'conversation_not_found' });
        await this.prisma.supportConversation.update({ where: { id }, data: { customer_last_read_at: new Date() } });
        const { primary_tickets, ...rest } = c;
        return { ...rest, status: c.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN', ticket: primary_tickets[0] ?? null, messages: c.messages.map((m) => ({ ...m, author_name: m.kind === 'CUSTOMER' ? m.author_name : null, mine: m.author_user?.id === p.user_id })) };
    }

    async startConversation(p: PortalContext, dto: StartPortalConversationDto) {
        this.feature(p, 'conversations');
        const settings = await this.supportSetup.settings(p.organization_id);
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: p.user_id }, select: { email: true, display_name: true, first_name: true, last_name: true } });
        const name = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
        const conv = await this.prisma.$transaction(async (tx) => {
            const c = await tx.supportConversation.create({ data: { organization_id: p.organization_id, inbox_id: settings.default_inbox_id, channel_type: 'PORTAL', subject: dto.subject, company_id: p.customer_id, customer_user_id: p.user_id, customer_name: name, customer_email: user.email } });
            await this.conversations.addMessage(tx, c.id, { kind: 'CUSTOMER', body: dto.body, author_user_id: p.user_id, author_name: name, author_email: user.email, channel_type: 'PORTAL' });
            return c;
        });
        await this.audit.record(p.actor, 'portal.conversation.started', { resource_type: 'support_conversation', resource_id: conv.id });
        this.events.publish(p.actor, { event_key: 'support.conversation.created', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: conv.id, payload: { subject: dto.subject, channel_type: 'PORTAL', company_id: p.customer_id, via: 'portal' }, activity: { summary: `New portal message: ${dto.subject}`, company_id: p.customer_id } });
        return this.conversation(p, conv.id);
    }

    async postConversationMessage(p: PortalContext, id: string, body: string) {
        await this.conversation(p, id);
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: p.user_id }, select: { email: true, display_name: true, first_name: true, last_name: true } });
        const name = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
        await this.prisma.$transaction((tx) => this.conversations.addMessage(tx, id, { kind: 'CUSTOMER', body, author_user_id: p.user_id, author_name: name, author_email: user.email, channel_type: 'PORTAL' }));
        await this.audit.record(p.actor, 'portal.conversation.replied', { resource_type: 'support_conversation', resource_id: id });
        this.events.publish(p.actor, { event_key: 'support.conversation.customer_replied', module: ModuleKey.SUPPORT, entity_type: 'SUPPORT_CONVERSATION', entity_id: id, payload: { via: 'portal' } });
        return this.conversation(p, id);
    }

    // ---------------------------------------------------------------------------------------------
    // Documents, proposals, contracts, invoices
    // ---------------------------------------------------------------------------------------------

    async documents(p: PortalContext, q: PortalListQuery) {
        this.feature(p, 'documents');
        const projectIds = await this.visibleProjectIds(p);
        const where: Prisma.DocumentWhereInput = {
            organization_id: p.organization_id,
            customer_visible: true,
            deleted_at: null,
            archived_at: null,
            OR: [{ company_id: p.customer_id }, { project_id: { in: projectIds } }],
            ...(q.project_id && { project_id: q.project_id }),
            ...(q.search && { AND: [{ OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { filename: { contains: q.search, mode: 'insensitive' } }] }] }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.document.findMany({ where, ...skipTake(q), orderBy: { created_at: 'desc' }, select: { id: true, title: true, filename: true, mimetype: true, size: true, url: true, created_at: true, updated_at: true, uploaded_via_portal: true, project: { select: { id: true, name: true } } } }),
            this.prisma.document.count({ where }),
        ]);
        return paginate(rows.map((d) => ({ ...d, size: d.size === null ? null : Number(d.size) })), total, q);
    }

    async proposals(p: PortalContext, q: PortalListQuery) {
        this.feature(p, 'proposals');
        const where: Prisma.ProposalWhereInput = { organization_id: p.organization_id, company_id: p.customer_id, archived_at: null, status: { in: [...VISIBLE_PROPOSAL_STATUSES] } };
        const [rows, total] = await Promise.all([
            this.prisma.proposal.findMany({ where, ...skipTake(q), orderBy: { sent_at: { sort: 'desc', nulls: 'last' } }, select: { id: true, number: true, title: true, status: true, currency: true, gross_total: true, recurring_monthly: true, valid_until: true, sent_at: true, accepted_at: true, rejected_at: true } }),
            this.prisma.proposal.count({ where }),
        ]);
        return paginate(rows.map((r) => ({ ...r, can_accept: p.can('portal.proposals.accept') && ['SENT', 'VIEWED'].includes(r.status) })), total, q);
    }

    async contracts(p: PortalContext, q: PortalListQuery) {
        this.feature(p, 'contracts');
        const where: Prisma.ContractWhereInput = { organization_id: p.organization_id, primary_company_id: p.customer_id, customer_visible: true, archived_at: null, status: { notIn: [...HIDDEN_CONTRACT_STATUSES] } };
        const [rows, total] = await Promise.all([
            this.prisma.contract.findMany({ where, ...skipTake(q), orderBy: { updated_at: 'desc' }, select: { id: true, number: true, title: true, status: true, currency: true, total_value: true, start_date: true, end_date: true, renewal_date: true, signature_date: true } }),
            this.prisma.contract.count({ where }),
        ]);
        return paginate(rows.map((r) => ({ ...r, awaiting_signature: ['READY_FOR_SIGNATURE', 'PARTIALLY_SIGNED', 'CUSTOMER_REVIEW'].includes(r.status) })), total, q);
    }

    async invoices(p: PortalContext, q: PortalListQuery) {
        this.feature(p, 'billing');
        const where: Prisma.InvoiceWhereInput = {
            organization_id: p.organization_id,
            company_id: p.customer_id,
            status: { notIn: [...HIDDEN_INVOICE_STATUSES] },
            ...(q.status === 'outstanding' && { status: { in: ['OPEN', 'PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } }),
            ...(q.status === 'paid' && { status: 'PAID' }),
        };
        const [rows, total, outstanding] = await Promise.all([
            this.prisma.invoice.findMany({
                where,
                ...skipTake(q),
                orderBy: [{ issue_date: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
                select: {
                    id: true, number: true, status: true, currency: true, issue_date: true, due_date: true, total: true, amount_paid: true, amount_due: true, paid_at: true, hosted_invoice_url: true,
                    project: { select: { id: true, name: true } },
                    payment_links: { where: { status: 'ACTIVE' }, select: { url: true }, take: 1 },
                },
            }),
            this.prisma.invoice.count({ where }),
            this.prisma.invoice.groupBy({ by: ['currency'], where: { organization_id: p.organization_id, company_id: p.customer_id, status: { in: ['OPEN', 'PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } }, _sum: { amount_due: true }, _count: { _all: true } }),
        ]);
        const canPay = p.can('portal.invoices.pay');
        return {
            ...paginate(
                rows.map(({ payment_links, hosted_invoice_url, ...i }) => ({
                    ...i,
                    pay_url: canPay && ['OPEN', 'PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(i.status) ? hosted_invoice_url ?? payment_links[0]?.url ?? null : null,
                })),
                total,
                q,
            ),
            outstanding: outstanding.map((o) => ({ currency: o.currency, amount_due: o._sum.amount_due, count: o._count._all })),
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Knowledge base (PUBLIC + CUSTOMERS articles)
    // ---------------------------------------------------------------------------------------------

    async knowledgeHome(p: PortalContext) {
        this.feature(p, 'knowledge');
        const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: p.organization_id }, select: { id: true, display_name: true, slug: true, logo_url: true } });
        return this.knowledge.helpCenterFor(org, true);
    }

    async knowledgeArticles(p: PortalContext, q: PortalListQuery & { category?: string }) {
        this.feature(p, 'knowledge');
        return this.knowledge.publicArticles('', { page: q.page, limit: q.limit, order_direction: 'desc', search: q.search, category: q.category }, true, p.organization_id);
    }

    async knowledgeArticle(p: PortalContext, slug: string) {
        this.feature(p, 'knowledge');
        return this.knowledge.publicArticle('', slug, true, p.organization_id);
    }

    async knowledgeFeedback(p: PortalContext, slug: string, isHelpful: boolean, comment?: string) {
        this.feature(p, 'knowledge');
        return this.knowledge.feedback('', slug, { is_helpful: isHelpful, comment }, p.user_id, true, p.organization_id);
    }

    // ---------------------------------------------------------------------------------------------
    // Company & team
    // ---------------------------------------------------------------------------------------------

    async company(p: PortalContext) {
        const [company, contacts, pending] = await Promise.all([
            this.prisma.crmCompany.findFirst({ where: { id: p.customer_id, organization_id: p.organization_id }, select: { id: true, name: true, legal_name: true, website: true, email: true, phone: true, vat_number: true, tax_id: true, registration_number: true, address: true } }),
            this.prisma.crmContact.findMany({ where: { company_id: p.customer_id, organization_id: p.organization_id, archived_at: null }, select: { id: true, first_name: true, last_name: true, job_title: true, email: true, phone: true, mobile: true }, orderBy: { first_name: 'asc' }, take: 100 }),
            this.prisma.customerPortalProfileChangeRequest.findMany({ where: { organization_id: p.organization_id, company_id: p.customer_id, status: 'PENDING' }, select: { id: true, contact_id: true, changes: true, created_at: true }, orderBy: { created_at: 'desc' } }),
        ]);
        if (!company) throw new NotFoundException({ message: 'Company not found', code: 'company_not_found' });
        return { company, contacts, pending_changes: pending, can_edit: p.can('portal.users.manage') || p.can('portal.settings.manage'), editable_company_fields: COMPANY_EDITABLE, editable_contact_fields: CONTACT_EDITABLE };
    }

    async requestProfileChange(p: PortalContext, dto: ProfileChangeRequestDto) {
        let current: Record<string, unknown>;
        if (dto.contact_id) {
            const c = await this.prisma.crmContact.findFirst({ where: { id: dto.contact_id, company_id: p.customer_id, organization_id: p.organization_id } });
            if (!c) throw new NotFoundException({ message: 'Contact not found', code: 'contact_not_found' });
            current = c as unknown as Record<string, unknown>;
        } else {
            const c = await this.prisma.crmCompany.findFirst({ where: { id: p.customer_id, organization_id: p.organization_id } });
            if (!c) throw new NotFoundException({ message: 'Company not found', code: 'company_not_found' });
            current = c as unknown as Record<string, unknown>;
        }
        const changes = buildChangeSet(current, dto.changes, dto.contact_id ? CONTACT_EDITABLE : COMPANY_EDITABLE);
        const settings = await this.prisma.customerPortalSettings.findUnique({ where: { organization_id: p.organization_id }, select: { profile_changes_require_approval: true } });
        const auto = settings ? !settings.profile_changes_require_approval : false;
        const row = await this.prisma.$transaction(async (tx) => {
            const r = await tx.customerPortalProfileChangeRequest.create({
                data: { organization_id: p.organization_id, company_id: p.customer_id, contact_id: dto.contact_id ?? null, requested_by_user_id: p.user_id, changes: changes as Prisma.InputJsonValue, status: auto ? 'AUTO_APPLIED' : 'PENDING', ...(auto && { reviewed_at: new Date() }) },
            });
            if (auto) await applyChangeSet(tx, r);
            return r;
        });
        await this.audit.record(p.actor, auto ? 'portal.profile_change.auto_applied' : 'portal.profile_change.requested', { resource_type: 'customer_portal_profile_change_request', resource_id: row.id, metadata: { company_id: p.customer_id, contact_id: dto.contact_id, changes } });
        this.events.publish(p.actor, { event_key: auto ? 'portal.profile_change.applied' : 'portal.profile_change.requested', module: M, entity_kind: 'customer_portal_profile_change_request', entity_id: row.id, payload: { company_id: p.customer_id, fields: Object.keys(changes) }, activity: { summary: `Customer ${auto ? 'updated' : 'proposed changes to'} ${dto.contact_id ? 'contact' : 'company'} details`, company_id: p.customer_id } });
        return row;
    }

    async team(p: PortalContext) {
        const [members, invitations, roles] = await Promise.all([
            this.prisma.customerPortalMembership.findMany({
                where: { organization_id: p.organization_id, customer_id: p.customer_id, status: { in: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] } },
                select: { id: true, status: true, joined_at: true, last_active_at: true, user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } }, role: { select: { id: true, name: true, slug: true } } },
                orderBy: { joined_at: 'asc' },
            }),
            p.can('portal.users.manage') ? this.invitations.list(p.organization_id, { company_id: p.customer_id, status: 'PENDING', take: 50 }) : Promise.resolve(null),
            p.can('portal.users.manage') ? this.invitations.customerRoles(p.organization_id) : Promise.resolve([]),
        ]);
        return {
            members: members.map((m) => ({ ...m, is_me: m.user.id === p.user_id })),
            invitations: invitations?.rows.map(({ invited_by, ...i }) => ({ ...i, invited_by: invited_by ? { display_name: invited_by.display_name } : null })) ?? [],
            roles: roles.map(({ organization_id, ...r }) => { void organization_id; return r; }),
            can_manage: p.can('portal.users.manage'),
        };
    }

    async inviteColleagues(p: PortalContext, dto: PortalTeamInviteDto) {
        if (dto.role_id) {
            // A customer may not hand out more portal access than they hold themselves.
            const role = (await this.invitations.customerRoles(p.organization_id)).find((r) => r.id === dto.role_id);
            if (!role) throw new NotFoundException({ message: 'Role not found', code: 'customer_role_not_found' });
            const extra = role.permissions.filter((k) => !p.can(k));
            if (extra.length) throw new ForbiddenException({ message: 'You cannot give more access than you have', code: 'portal_role_escalation', permissions: extra });
        }
        const res = await this.invitations.invite(p.actor, { company_id: p.customer_id, emails: dto.emails, role_id: dto.role_id, message: dto.message });
        // Invite links are returned only to agency admins; customers rely on the email.
        return { results: res.results.map(({ invite_url, ...r }) => { void invite_url; return r; }) };
    }

    async cancelInvitation(p: PortalContext, id: string) {
        return this.invitations.cancel(p.actor, id, p.customer_id);
    }

    async updateTeamMember(p: PortalContext, id: string, dto: PortalTeamUpdateDto) {
        const m = await this.prisma.customerPortalMembership.findFirst({ where: { id, organization_id: p.organization_id, customer_id: p.customer_id } });
        if (!m) throw new NotFoundException({ message: 'Team member not found', code: 'portal_user_not_found' });
        if (m.user_id === p.user_id) throw new ForbiddenException({ message: 'You cannot change your own access', code: 'portal_self_change' });
        if (dto.role_id) {
            const role = (await this.invitations.customerRoles(p.organization_id)).find((r) => r.id === dto.role_id);
            if (!role) throw new NotFoundException({ message: 'Role not found', code: 'customer_role_not_found' });
            const extra = role.permissions.filter((k) => !p.can(k));
            if (extra.length) throw new ForbiddenException({ message: 'You cannot give more access than you have', code: 'portal_role_escalation', permissions: extra });
        }
        const row = await this.prisma.customerPortalMembership.update({
            where: { id },
            data: { ...(dto.role_id && { role_id: dto.role_id }), ...(dto.status && { status: dto.status, deactivated_at: dto.status === 'DEACTIVATED' ? new Date() : null }) },
            select: { id: true, status: true, role: { select: { id: true, name: true } } },
        });
        await this.audit.record(p.actor, dto.status === 'DEACTIVATED' ? 'portal.user.deactivated' : dto.status === 'ACTIVE' ? 'portal.user.active' : 'portal.user.role_changed', { resource_type: 'customer_portal_membership', resource_id: id, metadata: { before: { role_id: m.role_id, status: m.status }, after: dto, by_portal_membership_id: p.portal_membership_id } });
        this.events.publish(p.actor, { event_key: 'portal.user.updated', module: M, entity_kind: 'customer_portal_membership', entity_id: id, changes: dto as Record<string, unknown>, payload: { customer_id: p.customer_id } });
        return row;
    }

    // ---------------------------------------------------------------------------------------------
    // Dashboard (07 §3)
    // ---------------------------------------------------------------------------------------------

    async dashboard(p: PortalContext) {
        const show = (f: PortalFeature, key: string) => p.features[f] && p.can(key);
        const [projects, approvals, requests, invoices, documents, conversations, incidents] = await Promise.all([
            show('projects', 'portal.projects.read') ? this.projects(p, { page: 1, limit: 5, order_direction: 'desc' }) : null,
            show('projects', 'portal.deliverables.approve') ? this.approvals(p, { page: 1, limit: 5, order_direction: 'desc' }) : null,
            show('requests', 'portal.requests.create') ? this.requests(p, { page: 1, limit: 5, order_direction: 'desc', status: 'open' }) : null,
            show('billing', 'portal.invoices.read') ? this.invoices(p, { page: 1, limit: 5, order_direction: 'desc', status: 'outstanding' }) : null,
            show('documents', 'portal.documents.read') ? this.documents(p, { page: 1, limit: 5, order_direction: 'desc' }) : null,
            show('conversations', 'portal.conversations.participate') ? this.conversationsList(p, { page: 1, limit: 5, order_direction: 'desc' }) : null,
            this.prisma.supportIncidentUpdate.findMany({
                where: { organization_id: p.organization_id, customer_visible: true, created_at: { gte: new Date(Date.now() - 14 * 86400_000) }, incident: { status: { not: 'DISMISSED' } } },
                orderBy: { created_at: 'desc' },
                take: 3,
                select: { id: true, status: true, body: true, created_at: true, incident: { select: { title: true, severity: true, status: true } } },
            }),
        ]);
        return {
            projects: projects ? { items: projects.data, total: projects.pagination.total } : null,
            approvals: approvals ? { items: approvals.data, total: approvals.pagination.total } : null,
            requests: requests ? { items: requests.data, total: requests.pagination.total } : null,
            invoices: invoices ? { items: invoices.data, total: invoices.pagination.total, outstanding: invoices.outstanding } : null,
            documents: documents ? { items: documents.data, total: documents.pagination.total } : null,
            conversations: conversations ? { items: conversations.data, unread: conversations.data.filter((c) => c.unread).length } : null,
            announcements: incidents,
        };
    }
}
