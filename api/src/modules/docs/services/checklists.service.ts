import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, WikiChecklistItemStatus, WikiChecklistRunStatus, WikiChecklistTrigger } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import {
    ChecklistItemInputDto,
    ChecklistQuery,
    CreateChecklistDto,
    RunQuery,
    StartChecklistRunDto,
    UpdateChecklistDto,
} from '../dto/checklist.dto';
import { MEMBER_SELECT } from '../utils/docs.utils';

const MANAGE = 'docs.checklists.manage';
const DAY = 86_400_000;

/**
 * Onboarding / offboarding checklists and their runs (15 §3). Definitions need `docs.checklists.manage`;
 * every reader sees their own runs, managers see all. Generated Tasks (06) are linked by id once the
 * Tasks module exposes its service (task_id stays null until then).
 */
@Injectable()
export class DocsChecklistsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // --- Definitions ---------------------------------------------------------------------

    async findAll(ctx: OrgContext, query: ChecklistQuery) {
        const where: Prisma.WikiChecklistWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.kind && { kind: query.kind }),
            ...(query.department_id && { department_id: query.department_id }),
            ...(query.role_id && { role_id: query.role_id }),
            ...(query.is_active !== undefined && { is_active: query.is_active }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.wikiChecklist.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'created_at', 'updated_at'], 'name'),
                include: {
                    department: { select: { id: true, name: true } },
                    role: { select: { id: true, name: true } },
                    guide_page: { select: { id: true, title: true } },
                    _count: { select: { items: true, runs: { where: { status: { in: [WikiChecklistRunStatus.NOT_STARTED, WikiChecklistRunStatus.IN_PROGRESS] } } } } },
                },
            }),
            this.prisma.wikiChecklist.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const checklist = await this.prisma.wikiChecklist.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                department: { select: { id: true, name: true } },
                role: { select: { id: true, name: true } },
                guide_page: { select: { id: true, title: true } },
                items: { orderBy: { sort_order: 'asc' }, include: { page: { select: { id: true, title: true } }, form: { select: { id: true, name: true } } } },
            },
        });
        if (!checklist) throw new NotFoundException({ message: 'Checklist not found', code: 'wiki_checklist_not_found' });
        return checklist;
    }

    async create(ctx: OrgContext, dto: CreateChecklistDto) {
        const { items, ...data } = dto;
        await this.assertRefs(ctx, data, items ?? []);
        const checklist = await this.prisma.$transaction(async (tx) => {
            const created = await tx.wikiChecklist.create({
                data: { ...data, organization_id: ctx.organization_id, owner_membership_id: data.owner_membership_id ?? ctx.membership_id, created_by_user_id: ctx.user_id },
            });
            if (items?.length) {
                await tx.wikiChecklistItem.createMany({ data: items.map((it, i) => ({ ...this.itemData(it), checklist_id: created.id, sort_order: i })) });
            }
            await this.audit.record(ctx, 'wiki_checklist.created', { resource_type: 'wiki_checklist', resource_id: created.id, metadata: { after: { ...data, items: items?.length ?? 0 } } }, tx);
            return created;
        });
        this.events.publish(ctx, { event_key: 'docs.checklist.created', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'wiki_checklist', entity_id: checklist.id, payload: { name: checklist.name, kind: checklist.kind } });
        return this.findOne(ctx, checklist.id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateChecklistDto) {
        const before = await this.findOne(ctx, id);
        await this.assertRefs(ctx, dto, []);
        const row = await this.prisma.wikiChecklist.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'wiki_checklist.updated', { resource_type: 'wiki_checklist', resource_id: id, metadata: { before: { name: before.name, is_active: before.is_active }, after: dto } });
        this.events.publish(ctx, { event_key: 'docs.checklist.updated', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'wiki_checklist', entity_id: id, payload: { name: row.name }, changes: dto as Record<string, unknown> });
        return row;
    }

    /** Replace the ordered item list. Items already used by runs are kept (deactivated from the list order) to preserve history. */
    async replaceItems(ctx: OrgContext, id: string, items: ChecklistItemInputDto[]) {
        const checklist = await this.findOne(ctx, id);
        await this.assertRefs(ctx, {}, items);
        const keepIds = items.map((i) => i.id).filter((x): x is string => !!x);
        const foreign = keepIds.filter((k) => !checklist.items.some((it) => it.id === k));
        if (foreign.length) throw new BadRequestException({ message: 'Item does not belong to this checklist', code: 'wiki_checklist_item_mismatch' });
        await this.prisma.$transaction(async (tx) => {
            const removed = checklist.items.filter((it) => !keepIds.includes(it.id)).map((it) => it.id);
            if (removed.length) {
                const used = await tx.wikiChecklistRunItem.findMany({ where: { checklist_item_id: { in: removed } }, select: { checklist_item_id: true }, distinct: ['checklist_item_id'] });
                const usedIds = new Set(used.map((u) => u.checklist_item_id));
                const deletable = removed.filter((r) => !usedIds.has(r));
                if (deletable.length) await tx.wikiChecklistItem.deleteMany({ where: { id: { in: deletable } } });
                if (usedIds.size) throw new ConflictException({ message: 'Some removed items are used by existing runs. Cancel or finish those runs first.', code: 'wiki_checklist_item_in_use' });
            }
            for (const [i, it] of items.entries()) {
                if (it.id) await tx.wikiChecklistItem.update({ where: { id: it.id }, data: { ...this.itemData(it), sort_order: i } });
                else await tx.wikiChecklistItem.create({ data: { ...this.itemData(it), checklist_id: id, sort_order: i } });
            }
            await this.audit.record(ctx, 'wiki_checklist.items_replaced', { resource_type: 'wiki_checklist', resource_id: id, metadata: { before: checklist.items.length, after: items.length } }, tx);
        });
        return this.findOne(ctx, id);
    }

    async setArchived(ctx: OrgContext, id: string, archived: boolean) {
        await this.findOne(ctx, id);
        const row = await this.prisma.wikiChecklist.update({ where: { id }, data: { archived_at: archived ? new Date() : null, ...(archived && { is_active: false }) } });
        await this.audit.record(ctx, archived ? 'wiki_checklist.archived' : 'wiki_checklist.unarchived', { resource_type: 'wiki_checklist', resource_id: id });
        return row;
    }

    // --- Runs ----------------------------------------------------------------------------

    async startRun(ctx: OrgContext, checklistId: string, dto: StartChecklistRunDto, trigger: WikiChecklistTrigger = WikiChecklistTrigger.MANUAL) {
        const checklist = await this.findOne(ctx, checklistId);
        if (checklist.archived_at || !checklist.is_active) throw new BadRequestException({ message: 'This checklist is not active', code: 'wiki_checklist_inactive' });
        if (!checklist.items.length) throw new BadRequestException({ message: 'Add items before starting a run', code: 'wiki_checklist_empty' });
        const subject = await this.prisma.membership.findFirst({ where: { id: dto.subject_membership_id, organization_id: ctx.organization_id }, select: { id: true } });
        if (!subject) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        const open = await this.prisma.wikiChecklistRun.findFirst({ where: { checklist_id: checklistId, subject_membership_id: subject.id, status: { in: [WikiChecklistRunStatus.NOT_STARTED, WikiChecklistRunStatus.IN_PROGRESS] } } });
        if (open) throw new ConflictException({ message: 'This member already has an open run of this checklist', code: 'wiki_checklist_run_open', run_id: open.id });
        const now = new Date();
        const maxOffset = Math.max(0, ...checklist.items.map((i) => i.due_offset_days ?? 0));
        const run = await this.prisma.$transaction(async (tx) => {
            const created = await tx.wikiChecklistRun.create({
                data: {
                    organization_id: ctx.organization_id,
                    checklist_id: checklistId,
                    subject_membership_id: subject.id,
                    status: WikiChecklistRunStatus.IN_PROGRESS,
                    triggered_by: trigger,
                    started_at: now,
                    due_at: dto.due_at ? new Date(dto.due_at) : maxOffset ? new Date(now.getTime() + maxOffset * DAY) : null,
                    created_by_user_id: ctx.user_id,
                },
            });
            for (const item of checklist.items) {
                const runItem = await tx.wikiChecklistRunItem.create({ data: { run_id: created.id, checklist_item_id: item.id } });
                if (item.page_id && item.requires_acknowledgement) {
                    await tx.wikiPageAcknowledgement.upsert({
                        where: { page_id_membership_id: { page_id: item.page_id, membership_id: subject.id } },
                        update: { checklist_run_item_id: runItem.id, acknowledged_at: null },
                        create: { page_id: item.page_id, membership_id: subject.id, checklist_run_item_id: runItem.id, required_by: item.due_offset_days != null ? new Date(now.getTime() + item.due_offset_days * DAY) : null },
                    });
                }
            }
            await this.audit.record(ctx, 'wiki_checklist_run.started', { resource_type: 'wiki_checklist_run', resource_id: created.id, metadata: { checklist_id: checklistId, subject_membership_id: subject.id, trigger } }, tx);
            return created;
        });
        this.events.publish(ctx, {
            event_key: 'docs.checklist_run.started', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'wiki_checklist_run', entity_id: run.id,
            payload: { checklist_id: checklistId, checklist_name: checklist.name, kind: checklist.kind, subject_membership_id: subject.id, due_at: run.due_at },
            activity: { summary: `started the ${checklist.kind.toLowerCase()} checklist ${checklist.name}`, entity_label: checklist.name },
        });
        return this.findRun(ctx, run.id);
    }

    async findRuns(ctx: OrgContext, query: RunQuery) {
        const all = ctx.can(MANAGE) && !query.mine;
        if (!all && !ctx.membership_id) return paginate([], 0, query);
        const where: Prisma.WikiChecklistRunWhereInput = {
            organization_id: ctx.organization_id,
            ...(!all && { subject_membership_id: ctx.membership_id as string }),
            ...(query.status && { status: query.status }),
            ...(query.checklist_id && { checklist_id: query.checklist_id }),
            ...(query.subject_id && all && { subject_membership_id: query.subject_id }),
            ...(query.kind && { checklist: { kind: query.kind } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.wikiChecklistRun.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['created_at', 'due_at', 'progress_percent'], 'created_at'),
                include: { checklist: { select: { id: true, name: true, kind: true } }, subject: { select: MEMBER_SELECT }, _count: { select: { items: true } } },
            }),
            this.prisma.wikiChecklistRun.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findRun(ctx: OrgContext, id: string) {
        const run = await this.prisma.wikiChecklistRun.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                checklist: { select: { id: true, name: true, kind: true, description: true, guide_page: { select: { id: true, title: true } } } },
                subject: { select: MEMBER_SELECT },
                items: {
                    include: {
                        checklist_item: { include: { page: { select: { id: true, title: true } }, form: { select: { id: true, name: true } } } },
                    },
                },
            },
        });
        if (!run) throw new NotFoundException({ message: 'Run not found', code: 'wiki_checklist_run_not_found' });
        if (!ctx.can(MANAGE) && run.subject_membership_id !== ctx.membership_id && !run.items.some((i) => i.checklist_item.assignee_membership_id === ctx.membership_id)) {
            throw new NotFoundException({ message: 'Run not found', code: 'wiki_checklist_run_not_found' });
        }
        const items = [...run.items].sort((a, b) => a.checklist_item.sort_order - b.checklist_item.sort_order);
        return { ...run, items, can_manage: ctx.can(MANAGE) };
    }

    async completeItem(ctx: OrgContext, runId: string, itemId: string) {
        const run = await this.findRun(ctx, runId);
        this.assertOpen(run.status);
        const item = run.items.find((i) => i.id === itemId || i.checklist_item_id === itemId);
        if (!item) throw new NotFoundException({ message: 'Item not found', code: 'wiki_checklist_item_not_found' });
        const allowed = ctx.can(MANAGE) || run.subject_membership_id === ctx.membership_id || item.checklist_item.assignee_membership_id === ctx.membership_id;
        if (!allowed) throw new ForbiddenException({ message: 'Only the assignee can complete this item', code: 'wiki_checklist_item_not_assignee' });
        await this.prisma.wikiChecklistRunItem.update({ where: { id: item.id }, data: { status: WikiChecklistItemStatus.COMPLETED, completed_at: new Date(), completed_by_membership_id: ctx.membership_id, skipped_reason: null } });
        await this.audit.record(ctx, 'wiki_checklist_run.item_completed', { resource_type: 'wiki_checklist_run', resource_id: runId, metadata: { item_id: item.id, title: item.checklist_item.title } });
        return this.recompute(ctx, runId);
    }

    async reopenItem(ctx: OrgContext, runId: string, itemId: string) {
        const run = await this.findRun(ctx, runId);
        const item = run.items.find((i) => i.id === itemId || i.checklist_item_id === itemId);
        if (!item) throw new NotFoundException({ message: 'Item not found', code: 'wiki_checklist_item_not_found' });
        const allowed = ctx.can(MANAGE) || run.subject_membership_id === ctx.membership_id || item.checklist_item.assignee_membership_id === ctx.membership_id;
        if (!allowed) throw new ForbiddenException({ message: 'Only the assignee can reopen this item', code: 'wiki_checklist_item_not_assignee' });
        if (run.status === WikiChecklistRunStatus.CANCELLED) throw new BadRequestException({ message: 'This run was cancelled', code: 'wiki_checklist_run_closed' });
        await this.prisma.wikiChecklistRunItem.update({ where: { id: item.id }, data: { status: WikiChecklistItemStatus.PENDING, completed_at: null, completed_by_membership_id: null, skipped_reason: null } });
        await this.audit.record(ctx, 'wiki_checklist_run.item_reopened', { resource_type: 'wiki_checklist_run', resource_id: runId, metadata: { item_id: item.id } });
        return this.recompute(ctx, runId);
    }

    async skipItem(ctx: OrgContext, runId: string, itemId: string, reason: string) {
        const run = await this.findRun(ctx, runId);
        this.assertOpen(run.status);
        const item = run.items.find((i) => i.id === itemId || i.checklist_item_id === itemId);
        if (!item) throw new NotFoundException({ message: 'Item not found', code: 'wiki_checklist_item_not_found' });
        await this.prisma.wikiChecklistRunItem.update({ where: { id: item.id }, data: { status: WikiChecklistItemStatus.SKIPPED, skipped_reason: reason, completed_by_membership_id: ctx.membership_id, completed_at: new Date() } });
        await this.audit.record(ctx, 'wiki_checklist_run.item_skipped', { resource_type: 'wiki_checklist_run', resource_id: runId, metadata: { item_id: item.id, reason } });
        return this.recompute(ctx, runId);
    }

    async cancelRun(ctx: OrgContext, runId: string) {
        const run = await this.findRun(ctx, runId);
        this.assertOpen(run.status);
        await this.prisma.wikiChecklistRun.update({ where: { id: runId }, data: { status: WikiChecklistRunStatus.CANCELLED, cancelled_at: new Date() } });
        await this.audit.record(ctx, 'wiki_checklist_run.cancelled', { resource_type: 'wiki_checklist_run', resource_id: runId });
        this.events.publish(ctx, { event_key: 'docs.checklist_run.cancelled', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'wiki_checklist_run', entity_id: runId, payload: { checklist_id: run.checklist_id, subject_membership_id: run.subject_membership_id } });
        return this.findRun(ctx, runId);
    }

    private async recompute(ctx: OrgContext, runId: string) {
        const run = await this.findRun(ctx, runId);
        const done = run.items.filter((i) => i.status === WikiChecklistItemStatus.COMPLETED || i.status === WikiChecklistItemStatus.SKIPPED);
        const progress = run.items.length ? Math.round((done.length / run.items.length) * 100) : 0;
        const requiredOpen = run.items.some((i) => i.checklist_item.is_required && i.status !== WikiChecklistItemStatus.COMPLETED && i.status !== WikiChecklistItemStatus.SKIPPED);
        const completed = !requiredOpen && run.status !== WikiChecklistRunStatus.CANCELLED;
        const wasCompleted = run.status === WikiChecklistRunStatus.COMPLETED;
        await this.prisma.wikiChecklistRun.update({
            where: { id: runId },
            data: {
                progress_percent: progress,
                status: completed ? WikiChecklistRunStatus.COMPLETED : WikiChecklistRunStatus.IN_PROGRESS,
                completed_at: completed ? (run.completed_at ?? new Date()) : null,
            },
        });
        if (completed && !wasCompleted) {
            await this.audit.record(ctx, 'wiki_checklist_run.completed', { resource_type: 'wiki_checklist_run', resource_id: runId });
            this.events.publish(ctx, {
                event_key: 'docs.checklist_run.completed', module: ModuleKey.BUSINESS_DOCS, entity_kind: 'wiki_checklist_run', entity_id: runId,
                payload: { checklist_id: run.checklist_id, checklist_name: run.checklist.name, kind: run.checklist.kind, subject_membership_id: run.subject_membership_id },
                activity: { summary: `completed the checklist ${run.checklist.name}`, entity_label: run.checklist.name },
            });
        }
        return this.findRun(ctx, runId);
    }

    private assertOpen(status: WikiChecklistRunStatus) {
        if (status === WikiChecklistRunStatus.CANCELLED || status === WikiChecklistRunStatus.COMPLETED) {
            throw new BadRequestException({ message: `This run is ${status.toLowerCase()}`, code: 'wiki_checklist_run_closed' });
        }
    }

    private itemData(it: ChecklistItemInputDto) {
        return {
            title: it.title,
            description: it.description ?? null,
            page_id: it.page_id ?? null,
            requires_acknowledgement: it.requires_acknowledgement ?? false,
            form_id: it.form_id ?? null,
            due_offset_days: it.due_offset_days ?? null,
            assignee_kind: it.assignee_kind ?? 'SUBJECT',
            assignee_membership_id: it.assignee_membership_id ?? null,
            is_required: it.is_required ?? true,
        };
    }

    private async assertRefs(ctx: OrgContext, dto: Partial<CreateChecklistDto>, items: ChecklistItemInputDto[]) {
        const org = ctx.organization_id;
        const checks: Promise<unknown>[] = [];
        if (dto.department_id) checks.push(this.prisma.team.findFirstOrThrow({ where: { id: dto.department_id, organization_id: org } }));
        if (dto.team_id) checks.push(this.prisma.team.findFirstOrThrow({ where: { id: dto.team_id, organization_id: org } }));
        if (dto.branch_id) checks.push(this.prisma.branch.findFirstOrThrow({ where: { id: dto.branch_id, organization_id: org } }));
        if (dto.role_id) checks.push(this.prisma.role.findFirstOrThrow({ where: { id: dto.role_id, OR: [{ organization_id: org }, { organization_id: null }] } }));
        if (dto.guide_page_id) checks.push(this.prisma.wikiPage.findFirstOrThrow({ where: { id: dto.guide_page_id, organization_id: org } }));
        if (dto.owner_membership_id) checks.push(this.prisma.membership.findFirstOrThrow({ where: { id: dto.owner_membership_id, organization_id: org } }));
        for (const it of items) {
            if (it.page_id) checks.push(this.prisma.wikiPage.findFirstOrThrow({ where: { id: it.page_id, organization_id: org } }));
            if (it.form_id) checks.push(this.prisma.customForm.findFirstOrThrow({ where: { id: it.form_id, organization_id: org } }));
            if (it.assignee_membership_id) checks.push(this.prisma.membership.findFirstOrThrow({ where: { id: it.assignee_membership_id, organization_id: org } }));
        }
        try {
            await Promise.all(checks);
        } catch {
            throw new BadRequestException({ message: 'A referenced department, role, page, form or member was not found', code: 'reference_not_found' });
        }
    }
}
