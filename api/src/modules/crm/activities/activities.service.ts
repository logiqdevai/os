import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CrmActivityStatus, ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { COMPANY_REF_SELECT, MEMBER_SELECT } from '../common/crm.constants';
import { activityScopeWhere, ownerFilter, pick } from '../common/crm-scope.utils';
import { CrmRefsService } from '../common/crm-refs.service';
import { ActivityQuery, CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';

const READ = 'crm.activities.read';

const INCLUDE = {
    owner: { select: MEMBER_SELECT },
    company: { select: COMPANY_REF_SELECT },
    deal: { select: { id: true, name: true } },
    lead: { select: { id: true, name: true } },
    participants: { include: { contact: { select: { id: true, first_name: true, last_name: true, email: true } } } },
} satisfies Prisma.CrmActivityInclude;

/** 02 §12–15 — calls, meetings, emails, follow-ups and reminders logged against CRM records. */
@Injectable()
export class CrmActivitiesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly refs: CrmRefsService,
    ) { }

    private where(ctx: OrgContext, query: ActivityQuery): Prisma.CrmActivityWhereInput {
        const now = new Date();
        const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay.getTime() + 86400_000);
        const due: Prisma.CrmActivityWhereInput =
            query.due === 'overdue' ? { status: 'PLANNED', starts_at: { lt: now } }
                : query.due === 'today' ? { status: 'PLANNED', starts_at: { gte: startOfDay, lt: endOfDay } }
                    : query.due === 'upcoming' ? { status: 'PLANNED', starts_at: { gte: now } }
                        : query.due === 'open' ? { status: 'PLANNED' }
                            : {};
        return {
            organization_id: ctx.organization_id,
            AND: [
                activityScopeWhere(ctx, READ),
                due,
                query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] } : {},
                query.contact_id ? { OR: [{ contact_id: query.contact_id }, { participants: { some: { contact_id: query.contact_id } } }] } : {},
            ],
            ...(query.type?.length && { type: { in: query.type } }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...ownerFilter(ctx, query.owner),
            ...(query.company_id && { company_id: query.company_id }),
            ...(query.lead_id && { lead_id: query.lead_id }),
            ...(query.deal_id && { deal_id: query.deal_id }),
            ...((query.from || query.to) && { starts_at: { ...(query.from && { gte: new Date(query.from) }), ...(query.to && { lte: new Date(query.to) }) } }),
        };
    }

    async findAll(ctx: OrgContext, query: ActivityQuery) {
        const where = this.where(ctx, query);
        const sort = query.due && query.due !== 'overdue' ? { starts_at: 'asc' as const } : orderBy(query, ['starts_at', 'created_at', 'completed_at', 'priority'], 'created_at');
        const [items, total] = await Promise.all([
            this.prisma.crmActivity.findMany({ where, ...skipTake(query), orderBy: sort, include: INCLUDE }),
            this.prisma.crmActivity.count({ where }),
        ]);
        const contactIds = [...new Set(items.map((i) => i.contact_id).filter((x): x is string => !!x))];
        const contacts = contactIds.length ? await this.prisma.crmContact.findMany({ where: { id: { in: contactIds } }, select: { id: true, first_name: true, last_name: true } }) : [];
        const byId = new Map(contacts.map((c) => [c.id, c]));
        const now = Date.now();
        return paginate(items.map((a) => ({ ...a, contact: a.contact_id ? byId.get(a.contact_id) ?? null : null, is_overdue: a.status === 'PLANNED' && !!a.starts_at && a.starts_at.getTime() < now })), total, query);
    }

    /** Counts for the activities header and the dashboard (caller's own open work). */
    async summary(ctx: OrgContext) {
        const base = { organization_id: ctx.organization_id, ...activityScopeWhere(ctx, READ), owner_membership_id: ctx.membership_id ?? '__none__', status: CrmActivityStatus.PLANNED };
        const now = new Date();
        const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay.getTime() + 86400_000);
        const [open, overdue, today] = await Promise.all([
            this.prisma.crmActivity.count({ where: base }),
            this.prisma.crmActivity.count({ where: { ...base, starts_at: { lt: now } } }),
            this.prisma.crmActivity.count({ where: { ...base, starts_at: { gte: startOfDay, lt: endOfDay } } }),
        ]);
        return { open, overdue, today };
    }

    async findOne(ctx: OrgContext, id: string) {
        const a = await this.prisma.crmActivity.findFirst({ where: { id, organization_id: ctx.organization_id, ...activityScopeWhere(ctx, READ) }, include: INCLUDE });
        if (!a) throw new NotFoundException({ message: 'Activity not found', code: 'activity_not_found' });
        const contact = a.contact_id ? await this.prisma.crmContact.findUnique({ where: { id: a.contact_id }, select: { id: true, first_name: true, last_name: true } }) : null;
        return { ...a, contact };
    }

    private async validateLinks(ctx: OrgContext, dto: UpdateActivityDto) {
        await this.refs.assert(ctx, {
            company: dto.company_id, contact: [dto.contact_id, ...(dto.participant_contact_ids ?? [])],
            membership: [dto.owner_membership_id, ...(dto.participant_membership_ids ?? [])],
        });
        const checks: Promise<unknown>[] = [];
        if (dto.lead_id) checks.push(this.prisma.crmLead.findFirstOrThrow({ where: { id: dto.lead_id, organization_id: ctx.organization_id } }));
        if (dto.deal_id) checks.push(this.prisma.crmDeal.findFirstOrThrow({ where: { id: dto.deal_id, organization_id: ctx.organization_id } }));
        try { await Promise.all(checks); } catch { throw new NotFoundException({ message: 'Referenced lead or deal not found', code: 'reference_not_found' }); }
        if (dto.starts_at && dto.ends_at && new Date(dto.ends_at) < new Date(dto.starts_at)) throw new BadRequestException({ message: 'The end must be after the start', code: 'invalid_dates' });
    }

    /** When a deal or contact is given without a company, inherit the company so the 360 view sees it. */
    private async inheritCompany(dto: UpdateActivityDto): Promise<string | undefined> {
        if (dto.company_id) return dto.company_id;
        if (dto.deal_id) return (await this.prisma.crmDeal.findUnique({ where: { id: dto.deal_id }, select: { company_id: true } }))?.company_id ?? undefined;
        if (dto.contact_id) return (await this.prisma.crmContact.findUnique({ where: { id: dto.contact_id }, select: { company_id: true } }))?.company_id ?? undefined;
        return undefined;
    }

    async create(ctx: OrgContext, dto: CreateActivityDto) {
        await this.validateLinks(ctx, dto);
        const { participant_contact_ids, participant_membership_ids, ...data } = dto;
        const company_id = await this.inheritCompany(dto);
        const completed = data.status === 'COMPLETED';
        const activity = await this.prisma.$transaction(async (tx) => {
            const a = await tx.crmActivity.create({
                data: {
                    ...data,
                    company_id,
                    starts_at: data.starts_at ? new Date(data.starts_at) : undefined,
                    ends_at: data.ends_at ? new Date(data.ends_at) : undefined,
                    owner_membership_id: data.owner_membership_id ?? ctx.membership_id,
                    organization_id: ctx.organization_id,
                    created_by_user_id: ctx.user_id,
                    ...(completed && { completed_at: new Date() }),
                    participants: {
                        create: [
                            ...[...new Set(participant_membership_ids ?? [])].map((membership_id) => ({ membership_id })),
                            ...[...new Set(participant_contact_ids ?? [])].map((contact_id) => ({ contact_id })),
                        ],
                    },
                },
            });
            await this.touch(tx, a, completed);
            await this.audit.record(ctx, 'crm.activity.created', { resource_type: 'crm_activity', resource_id: a.id, metadata: { after: { type: a.type, title: a.title, status: a.status, deal_id: a.deal_id, company_id: a.company_id } } }, tx);
            return a;
        });
        const assignees = [...new Set([activity.owner_membership_id, ...(participant_membership_ids ?? [])].filter((x): x is string => !!x))];
        this.events.publish(ctx, {
            event_key: completed ? 'crm.activity.logged' : 'crm.activity.created', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_ACTIVITY, entity_id: activity.id,
            payload: { title: activity.title, type: activity.type, due_at: activity.starts_at, deal_id: activity.deal_id, company_id: activity.company_id, lead_id: activity.lead_id, owner_membership_id: activity.owner_membership_id, assignee_membership_ids: assignees },
            activity: { summary: `${completed ? 'logged' : 'scheduled'} ${activity.type.toLowerCase().replace('_', ' ')} "${activity.title}"`, entity_label: activity.title, company_id: activity.company_id },
        });
        return this.findOne(ctx, activity.id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateActivityDto) {
        const before = await this.getForWrite(ctx, id, 'crm.activities.update');
        await this.validateLinks(ctx, dto);
        const { participant_contact_ids, participant_membership_ids, ...data } = dto;
        const completing = data.status === 'COMPLETED' && before.status !== 'COMPLETED';
        const activity = await this.prisma.$transaction(async (tx) => {
            const a = await tx.crmActivity.update({
                where: { id },
                data: {
                    ...data,
                    ...(data.starts_at !== undefined && { starts_at: data.starts_at ? new Date(data.starts_at) : null }),
                    ...(data.ends_at !== undefined && { ends_at: data.ends_at ? new Date(data.ends_at) : null }),
                    ...(completing && { completed_at: new Date() }),
                    ...(data.status && data.status !== 'COMPLETED' && { completed_at: null }),
                },
            });
            if (participant_contact_ids || participant_membership_ids) {
                await tx.crmActivityParticipant.deleteMany({ where: { activity_id: id, ...(participant_contact_ids && !participant_membership_ids ? { contact_id: { not: null } } : {}), ...(participant_membership_ids && !participant_contact_ids ? { membership_id: { not: null } } : {}) } });
                await tx.crmActivityParticipant.createMany({
                    data: [
                        ...[...new Set(participant_membership_ids ?? [])].map((membership_id) => ({ activity_id: id, membership_id })),
                        ...[...new Set(participant_contact_ids ?? [])].map((contact_id) => ({ activity_id: id, contact_id })),
                    ],
                    skipDuplicates: true,
                });
            }
            if (completing) await this.touch(tx, a, true);
            await this.audit.record(ctx, completing ? 'crm.activity.completed' : 'crm.activity.updated', { resource_type: 'crm_activity', resource_id: id, metadata: { before: pick(before, Object.keys(data)), after: data } }, tx);
            return a;
        });
        this.events.publish(ctx, {
            event_key: completing ? 'crm.activity.completed' : 'crm.activity.updated', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_ACTIVITY, entity_id: id,
            payload: { title: activity.title, type: activity.type, status: activity.status, deal_id: activity.deal_id, company_id: activity.company_id, owner_membership_id: activity.owner_membership_id, assignee_membership_ids: activity.owner_membership_id ? [activity.owner_membership_id] : [] },
            changes: data as Record<string, unknown>,
            ...(completing && { activity: { summary: `completed ${activity.type.toLowerCase().replace('_', ' ')} "${activity.title}"`, entity_label: activity.title, company_id: activity.company_id } }),
        });
        return this.findOne(ctx, id);
    }

    async complete(ctx: OrgContext, id: string, outcome?: string) {
        const before = await this.getForWrite(ctx, id, 'crm.activities.update');
        if (before.status === 'COMPLETED') throw new ConflictException({ message: 'The activity is already completed', code: 'activity_completed' });
        return this.update(ctx, id, { status: 'COMPLETED', ...(outcome !== undefined && { outcome }) });
    }

    async remove(ctx: OrgContext, id: string) {
        const before = await this.getForWrite(ctx, id, 'crm.activities.delete');
        await this.prisma.$transaction(async (tx) => {
            await tx.crmActivity.delete({ where: { id } });
            await this.audit.record(ctx, 'crm.activity.deleted', { resource_type: 'crm_activity', resource_id: id, metadata: { before: { type: before.type, title: before.title } } }, tx);
        });
        this.events.publish(ctx, { event_key: 'crm.activity.deleted', module: ModuleKey.CRM, entity_type: RecordEntityType.CRM_ACTIVITY, entity_id: id, payload: { title: before.title } });
        return { success: true };
    }

    /** Keep last/next activity timestamps on the linked records current (lists sort by them). */
    private async touch(tx: Prisma.TransactionClient, a: { company_id: string | null; contact_id: string | null; deal_id: string | null; lead_id: string | null }, completed: boolean) {
        if (!completed) return;
        const now = new Date();
        const ops: Promise<unknown>[] = [];
        if (a.company_id) ops.push(tx.crmCompany.updateMany({ where: { id: a.company_id }, data: { last_activity_at: now } }));
        if (a.contact_id) ops.push(tx.crmContact.updateMany({ where: { id: a.contact_id }, data: { last_activity_at: now } }));
        if (a.deal_id) ops.push(tx.crmDeal.updateMany({ where: { id: a.deal_id }, data: { last_activity_at: now } }));
        if (a.lead_id) ops.push(tx.crmLead.updateMany({ where: { id: a.lead_id }, data: { last_activity_at: now } }));
        await Promise.all(ops);
    }

    async getForWrite(ctx: OrgContext, id: string, key: string) {
        const a = await this.prisma.crmActivity.findFirst({ where: { id, organization_id: ctx.organization_id, ...activityScopeWhere(ctx, key) } });
        if (!a) throw new NotFoundException({ message: 'Activity not found', code: 'activity_not_found' });
        return a;
    }
}
