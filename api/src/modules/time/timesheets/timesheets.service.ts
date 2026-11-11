import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, Timesheet, TimesheetActionType, TimesheetApproverPolicy, TimesheetStatus, TimeEntryStatus, TimeTrackingSettings } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { MEMBER_SELECT, TimeAccessService } from '../common/time-access.service';
import { TimeLedgerService } from '../common/time-ledger.service';
import { isoDate, toDateOnly, todayUtc, weekPeriod } from '../common/time-dates';
import { ENTRY_INCLUDE } from '../entries/time-entries.service';
import { BulkTimesheetDto, TimesheetQuery, WeekQuery } from './dto/timesheet.dto';

const APPROVE = 'time.timesheets.approve';

const SHEET_INCLUDE = {
    membership: { select: MEMBER_SELECT },
    approver: { select: MEMBER_SELECT },
    approved_by: { select: MEMBER_SELECT },
    rejected_by: { select: MEMBER_SELECT },
} satisfies Prisma.TimesheetInclude;

/**
 * 18 §2, §5 — weekly timesheets: lazy creation, submit → approve / reject, reopen, lock on approval and unlock.
 * State machine: OPEN → SUBMITTED → APPROVED | REJECTED; REJECTED → OPEN; APPROVED → LOCKED (lock_on_approval);
 * LOCKED / APPROVED → OPEN (unlock with reason). Every transition writes a TimesheetAction + audit event + event.
 */
@Injectable()
export class TimesheetsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: TimeAccessService,
        private readonly ledger: TimeLedgerService,
    ) { }

    /** The week grid: a member's period, its timesheet (null until the first entry) and its entries. */
    async week(ctx: OrgContext, query: WeekQuery) {
        const settings = await this.access.settings(ctx.organization_id);
        const membershipId = query.membership_id ?? this.access.requireMembership(ctx);
        if (membershipId !== ctx.membership_id) {
            const ids = await this.access.memberIds(ctx, this.access.maxScope(ctx) ?? 'mine');
            if (ids && !ids.includes(membershipId)) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        }
        const { period_start, period_end } = weekPeriod(query.period_start ? toDateOnly(query.period_start) : todayUtc(), settings.week_start);
        const [timesheet, entries, expected, member] = await Promise.all([
            this.prisma.timesheet.findUnique({
                where: { membership_id_period_start_period_end: { membership_id: membershipId, period_start, period_end } },
                include: { ...SHEET_INCLUDE, actions: { include: { actor: { select: MEMBER_SELECT } }, orderBy: { created_at: 'desc' } } },
            }),
            this.prisma.timeEntry.findMany({ where: { membership_id: membershipId, organization_id: ctx.organization_id, deleted_at: null, date: { gte: period_start, lte: period_end } }, include: ENTRY_INCLUDE, orderBy: [{ date: 'asc' }, { created_at: 'asc' }] }),
            this.access.expectedWeeklyMinutes(ctx.organization_id, [membershipId], Number(settings.default_expected_hours_per_week)),
            this.prisma.membership.findUnique({ where: { id: membershipId }, select: MEMBER_SELECT }),
        ]);
        return {
            membership: member,
            period_start: isoDate(period_start),
            period_end: isoDate(period_end),
            timesheet,
            expected_minutes: timesheet?.expected_minutes ?? expected.get(membershipId) ?? 0,
            entries: entries.map((e) => this.access.stripAmounts(ctx, e)),
            rules: { max_hours_per_day: settings.max_hours_per_day, allow_future_entries: settings.allow_future_entries, require_approval: settings.require_approval },
        };
    }

    async findAll(ctx: OrgContext, query: TimesheetQuery) {
        const ids = await this.access.memberIds(ctx, this.access.effectiveScope(ctx, query.scope));
        const where: Prisma.TimesheetWhereInput = {
            organization_id: ctx.organization_id,
            ...(ids && { membership_id: { in: ids } }),
            ...(query.membership_id && { AND: [{ membership_id: query.membership_id }] }),
            ...(query.period_start && { period_start: weekPeriod(toDateOnly(query.period_start), (await this.access.settings(ctx.organization_id)).week_start).period_start }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.team_id && { membership: { teams: { some: { team_id: query.team_id, ended_at: null } } } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.timesheet.findMany({ where, ...skipTake(query), orderBy: [orderBy(query, ['period_start', 'submitted_at', 'total_minutes'], 'period_start'), { created_at: 'desc' }], include: SHEET_INCLUDE }),
            this.prisma.timesheet.count({ where }),
        ]);
        return paginate(items.map((t) => this.access.stripAmounts(ctx, t)), total, query);
    }

    /** Team compliance for one week: every member in scope, with their timesheet or "not started". */
    async team(ctx: OrgContext, query: WeekQuery) {
        const settings = await this.access.settings(ctx.organization_id);
        const { period_start, period_end } = weekPeriod(query.period_start ? toDateOnly(query.period_start) : todayUtc(), settings.week_start);
        const scope = this.access.effectiveScope(ctx, query.scope ?? 'all');
        const ids = await this.access.memberIds(ctx, scope);
        const members = await this.prisma.membership.findMany({
            where: { organization_id: ctx.organization_id, status: 'ACTIVE', type: 'INTERNAL', ...(ids && { id: { in: ids } }), ...(query.team_id && { teams: { some: { team_id: query.team_id, ended_at: null } } }) },
            select: MEMBER_SELECT,
        });
        const memberIds = members.map((m) => m.id);
        const [sheets, logged, expected] = await Promise.all([
            this.prisma.timesheet.findMany({ where: { membership_id: { in: memberIds }, period_start, period_end }, include: { approver: { select: MEMBER_SELECT } } }),
            this.prisma.timeEntry.groupBy({ by: ['membership_id'], where: { membership_id: { in: memberIds }, deleted_at: null, date: { gte: period_start, lte: period_end } }, _sum: { duration_minutes: true, billable_minutes: true } }),
            this.access.expectedWeeklyMinutes(ctx.organization_id, memberIds, Number(settings.default_expected_hours_per_week)),
        ]);
        const sheetBy = new Map(sheets.map((s) => [s.membership_id, s]));
        const loggedBy = new Map(logged.map((l) => [l.membership_id, l._sum]));
        const rows = members
            .map((m) => {
                const sheet = sheetBy.get(m.id) ?? null;
                const sum = loggedBy.get(m.id);
                return {
                    membership: m,
                    timesheet: sheet ? this.access.stripAmounts(ctx, sheet) : null,
                    status: sheet?.status ?? 'NOT_STARTED',
                    total_minutes: sum?.duration_minutes ?? 0,
                    billable_minutes: sum?.billable_minutes ?? 0,
                    expected_minutes: sheet?.expected_minutes ?? expected.get(m.id) ?? 0,
                };
            })
            .filter((r) => !query.status || r.status === query.status)
            .sort((a, b) => (a.membership.user.first_name ?? '').localeCompare(b.membership.user.first_name ?? ''));
        const counts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
        return { period_start: isoDate(period_start), period_end: isoDate(period_end), scope, rows, counts };
    }

    async findOne(ctx: OrgContext, id: string) {
        const sheet = await this.prisma.timesheet.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: {
                ...SHEET_INCLUDE,
                actions: { include: { actor: { select: MEMBER_SELECT } }, orderBy: { created_at: 'desc' } },
                entries: { where: { deleted_at: null }, include: ENTRY_INCLUDE, orderBy: [{ date: 'asc' }, { created_at: 'asc' }] },
            },
        });
        if (!sheet || !(await this.visible(ctx, sheet.membership_id))) throw new NotFoundException({ message: 'Timesheet not found', code: 'timesheet_not_found' });
        const settings = await this.access.settings(ctx.organization_id);
        return {
            ...this.access.stripAmounts(ctx, { ...sheet, entries: sheet.entries.map((e) => this.access.stripAmounts(ctx, e)) }),
            can_approve: sheet.status === TimesheetStatus.SUBMITTED && ctx.can(APPROVE) && (sheet.membership_id !== ctx.membership_id || settings.allow_self_approval) && (await this.canApprove(ctx, sheet)),
        };
    }

    /** Approvals queue: submitted timesheets the caller may decide. */
    async approvals(ctx: OrgContext, query: TimesheetQuery) {
        const settings = await this.access.settings(ctx.organization_id);
        const orgWide = ctx.scopeOf(APPROVE)?.organization ?? false;
        const teamIds = !orgWide && ctx.membership_id ? await this.access.teamMemberIds(ctx.organization_id, ctx.membership_id) : [];
        const where: Prisma.TimesheetWhereInput = {
            organization_id: ctx.organization_id,
            status: query.status?.length ? { in: query.status } : TimesheetStatus.SUBMITTED,
            ...(!settings.allow_self_approval && ctx.membership_id && { membership_id: { not: ctx.membership_id } }),
            ...(!orgWide && { OR: [{ approver_membership_id: ctx.membership_id ?? '__none__' }, { membership_id: { in: teamIds } }] }),
            ...(query.membership_id && { AND: [{ membership_id: query.membership_id }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.timesheet.findMany({ where, ...skipTake(query), orderBy: { submitted_at: 'asc' }, include: SHEET_INCLUDE }),
            this.prisma.timesheet.count({ where }),
        ]);
        // Per-project breakdown so the approver sees what they approve.
        const breakdown = items.length
            ? await this.prisma.timeEntry.groupBy({ by: ['timesheet_id', 'project_id'], where: { timesheet_id: { in: items.map((i) => i.id) }, deleted_at: null }, _sum: { duration_minutes: true, billable_minutes: true } })
            : [];
        const projectIds = [...new Set(breakdown.map((b) => b.project_id).filter((p): p is string => !!p))];
        const projects = projectIds.length ? await this.prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true, code: true } }) : [];
        const projectBy = new Map(projects.map((p) => [p.id, p]));
        return paginate(
            items.map((t) => ({
                ...this.access.stripAmounts(ctx, t),
                projects: breakdown.filter((b) => b.timesheet_id === t.id).map((b) => ({ project: b.project_id ? projectBy.get(b.project_id) ?? null : null, minutes: b._sum.duration_minutes ?? 0, billable_minutes: b._sum.billable_minutes ?? 0 })),
            })),
            total,
            query,
        );
    }

    async submit(ctx: OrgContext, periodStart: string, comment?: string) {
        const membershipId = this.access.requireMembership(ctx);
        const settings = await this.access.settings(ctx.organization_id);
        const date = toDateOnly(periodStart);
        const sheet = await this.prisma.$transaction((tx) => this.ledger.openTimesheet(tx, ctx, membershipId, date, settings));
        const entries = await this.prisma.timeEntry.findMany({ where: { timesheet_id: sheet.id, deleted_at: null }, select: { id: true, project_id: true, status: true } });
        if (!entries.length) throw new BadRequestException({ message: 'There is no time in this week to submit', code: 'nothing_to_submit' });

        const approvers = await this.resolveApprovers(ctx, settings, membershipId, entries.map((e) => e.project_id));
        const now = new Date();
        const autoApprove = !settings.require_approval;
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.timeEntry.updateMany({ where: { timesheet_id: sheet.id, deleted_at: null, status: { in: [TimeEntryStatus.DRAFT, TimeEntryStatus.REJECTED] } }, data: { status: TimeEntryStatus.SUBMITTED, submitted_at: now, rejection_reason: null } });
            await this.ledger.recompute(tx, sheet.id);
            let row = await tx.timesheet.update({
                where: { id: sheet.id },
                data: { status: TimesheetStatus.SUBMITTED, submitted_at: now, submission_comment: comment ?? null, approver_membership_id: approvers[0] ?? null, rejected_at: null, rejection_comment: null },
            });
            await tx.timesheetAction.create({ data: { timesheet_id: sheet.id, action: TimesheetActionType.SUBMITTED, actor_membership_id: ctx.membership_id, comment, from_status: sheet.status, to_status: TimesheetStatus.SUBMITTED } });
            if (autoApprove) row = await this.applyApproval(tx, ctx, settings, row, 'Approval not required');
            return row;
        });
        await this.audit.record(ctx, 'time.timesheet.submitted', { resource_type: 'timesheet', resource_id: sheet.id, metadata: { period_start: isoDate(sheet.period_start), entries: entries.length, approver_membership_ids: approvers, auto_approved: autoApprove } });
        this.events.publish(ctx, {
            event_key: 'time.timesheet.submitted', module: ModuleKey.TIME_TRACKING, entity_type: 'TIMESHEET', entity_id: sheet.id,
            payload: { owner_membership_id: membershipId, approver_membership_ids: autoApprove ? [] : approvers, period_start: isoDate(sheet.period_start), period_end: isoDate(sheet.period_end), total_minutes: updated.total_minutes },
            activity: { summary: `Submitted timesheet for the week of ${isoDate(sheet.period_start)}`, entity_label: `Timesheet ${isoDate(sheet.period_start)}` },
        });
        return this.findOne(ctx, sheet.id);
    }

    async approve(ctx: OrgContext, id: string, comment?: string) {
        const { sheet, settings } = await this.loadForDecision(ctx, id);
        await this.prisma.$transaction((tx) => this.applyApproval(tx, ctx, settings, sheet, comment));
        await this.audit.record(ctx, 'time.timesheet.approved', { resource_type: 'timesheet', resource_id: id, metadata: { comment, locked: settings.lock_on_approval } });
        this.events.publish(ctx, {
            event_key: 'time.timesheet.approved', module: ModuleKey.TIME_TRACKING, entity_type: 'TIMESHEET', entity_id: id,
            payload: { owner_membership_id: sheet.membership_id, period_start: isoDate(sheet.period_start), comment: comment ?? null },
        });
        return this.findOne(ctx, id);
    }

    async reject(ctx: OrgContext, id: string, comment: string) {
        if (!comment?.trim()) throw new BadRequestException({ message: 'A comment is required to reject', code: 'comment_required' });
        const { sheet } = await this.loadForDecision(ctx, id);
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.timeEntry.updateMany({ where: { timesheet_id: id, deleted_at: null, status: TimeEntryStatus.SUBMITTED }, data: { status: TimeEntryStatus.REJECTED, rejected_at: now, rejected_by_membership_id: ctx.membership_id, rejection_reason: comment } });
            await tx.timesheet.update({ where: { id }, data: { status: TimesheetStatus.REJECTED, rejected_at: now, rejected_by_membership_id: ctx.membership_id, rejection_comment: comment } });
            await tx.timesheetAction.create({ data: { timesheet_id: id, action: TimesheetActionType.REJECTED, actor_membership_id: ctx.membership_id, comment, from_status: sheet.status, to_status: TimesheetStatus.REJECTED } });
        });
        await this.audit.record(ctx, 'time.timesheet.rejected', { resource_type: 'timesheet', resource_id: id, metadata: { comment } });
        this.events.publish(ctx, {
            event_key: 'time.timesheet.rejected', module: ModuleKey.TIME_TRACKING, entity_type: 'TIMESHEET', entity_id: id,
            payload: { owner_membership_id: sheet.membership_id, period_start: isoDate(sheet.period_start), comment },
        });
        return this.findOne(ctx, id);
    }

    /** Owner withdraws a submitted sheet or reopens a rejected one; an approver can reopen an approved (unlocked) one. */
    async reopen(ctx: OrgContext, id: string, comment?: string) {
        const sheet = await this.prisma.timesheet.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!sheet || !(await this.visible(ctx, sheet.membership_id))) throw new NotFoundException({ message: 'Timesheet not found', code: 'timesheet_not_found' });
        const own = sheet.membership_id === ctx.membership_id;
        const allowed =
            (own && ([TimesheetStatus.SUBMITTED, TimesheetStatus.REJECTED] as TimesheetStatus[]).includes(sheet.status) && ctx.can('time.timesheets.submit_own')) ||
            (!own && sheet.status === TimesheetStatus.APPROVED && ctx.can(APPROVE) && (await this.canApprove(ctx, sheet))) ||
            (!own && sheet.status === TimesheetStatus.SUBMITTED && ctx.can(APPROVE) && (await this.canApprove(ctx, sheet)));
        if (!allowed) throw new ConflictException({ message: sheet.status === TimesheetStatus.LOCKED ? 'This timesheet is locked. Unlock it instead.' : `A ${sheet.status.toLowerCase()} timesheet cannot be reopened by you`, code: 'timesheet_not_reopenable' });
        await this.prisma.$transaction(async (tx) => {
            await tx.timeEntry.updateMany({ where: { timesheet_id: id, deleted_at: null, status: { in: [TimeEntryStatus.SUBMITTED, TimeEntryStatus.APPROVED] }, is_locked: false }, data: { status: TimeEntryStatus.DRAFT, approved_at: null, approved_by_membership_id: null } });
            await tx.timesheet.update({ where: { id }, data: { status: TimesheetStatus.OPEN, approved_at: null, approved_by_membership_id: null } });
            await tx.timesheetAction.create({ data: { timesheet_id: id, action: TimesheetActionType.REOPENED, actor_membership_id: ctx.membership_id, comment, from_status: sheet.status, to_status: TimesheetStatus.OPEN } });
        });
        await this.audit.record(ctx, 'time.timesheet.reopened', { resource_type: 'timesheet', resource_id: id, metadata: { from: sheet.status, comment } });
        this.events.publish(ctx, { event_key: 'time.timesheet.reopened', module: ModuleKey.TIME_TRACKING, entity_type: 'TIMESHEET', entity_id: id, payload: { owner_membership_id: sheet.membership_id, from_status: sheet.status } });
        return this.findOne(ctx, id);
    }

    async unlock(ctx: OrgContext, id: string, reason: string) {
        const sheet = await this.prisma.timesheet.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!sheet || !(await this.visible(ctx, sheet.membership_id))) throw new NotFoundException({ message: 'Timesheet not found', code: 'timesheet_not_found' });
        if (!([TimesheetStatus.LOCKED, TimesheetStatus.APPROVED] as TimesheetStatus[]).includes(sheet.status)) throw new ConflictException({ message: 'Only approved or locked timesheets can be unlocked', code: 'timesheet_not_locked' });
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.timeEntry.updateMany({
                where: { timesheet_id: id, deleted_at: null, invoice_id: null, status: { in: [TimeEntryStatus.APPROVED, TimeEntryStatus.LOCKED] } },
                data: { status: TimeEntryStatus.DRAFT, is_locked: false, unlocked_at: now, unlocked_by_membership_id: ctx.membership_id, unlock_reason: reason, approved_at: null, approved_by_membership_id: null },
            });
            await tx.timesheet.update({ where: { id }, data: { status: TimesheetStatus.OPEN, unlocked_at: now, unlocked_by_membership_id: ctx.membership_id, unlock_reason: reason, approved_at: null } });
            await tx.timesheetAction.create({ data: { timesheet_id: id, action: TimesheetActionType.UNLOCKED, actor_membership_id: ctx.membership_id, comment: reason, from_status: sheet.status, to_status: TimesheetStatus.OPEN } });
        });
        await this.audit.record(ctx, 'time.timesheet.unlocked', { resource_type: 'timesheet', resource_id: id, metadata: { reason } });
        this.events.publish(ctx, { event_key: 'time.timesheet.unlocked', module: ModuleKey.TIME_TRACKING, entity_type: 'TIMESHEET', entity_id: id, payload: { owner_membership_id: sheet.membership_id, reason } });
        return this.findOne(ctx, id);
    }

    async bulk(ctx: OrgContext, dto: BulkTimesheetDto) {
        if (dto.action === 'reject' && !dto.comment?.trim()) throw new BadRequestException({ message: 'A comment is required to reject', code: 'comment_required' });
        const results: { id: string; ok: boolean; message?: string }[] = [];
        for (const id of dto.ids) {
            try {
                if (dto.action === 'approve') await this.approve(ctx, id, dto.comment);
                else await this.reject(ctx, id, dto.comment as string);
                results.push({ id, ok: true });
            } catch (error) {
                const res = (error as { getResponse?: () => unknown }).getResponse?.() as { message?: string } | undefined;
                results.push({ id, ok: false, message: res?.message ?? (error as Error).message });
            }
        }
        await this.audit.record(ctx, 'time.timesheet.bulk_decided', { resource_type: 'timesheet', metadata: { action: dto.action, ids: dto.ids, succeeded: results.filter((r) => r.ok).length } });
        return { results, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
    }

    // --- helpers ---------------------------------------------------------------------------

    private async applyApproval(tx: Prisma.TransactionClient, ctx: OrgContext, settings: TimeTrackingSettings, sheet: Timesheet, comment?: string) {
        const now = new Date();
        const lock = settings.lock_on_approval;
        await tx.timeEntry.updateMany({
            where: { timesheet_id: sheet.id, deleted_at: null, status: TimeEntryStatus.SUBMITTED },
            data: { status: TimeEntryStatus.APPROVED, approved_at: now, approved_by_membership_id: ctx.membership_id, ...(lock && { is_locked: true, locked_at: now, locked_by_membership_id: ctx.membership_id }) },
        });
        const row = await tx.timesheet.update({
            where: { id: sheet.id },
            data: { status: lock ? TimesheetStatus.LOCKED : TimesheetStatus.APPROVED, approved_at: now, approved_by_membership_id: ctx.membership_id, ...(lock && { locked_at: now, locked_by_membership_id: ctx.membership_id }) },
        });
        await tx.timesheetAction.create({ data: { timesheet_id: sheet.id, action: TimesheetActionType.APPROVED, actor_membership_id: ctx.membership_id, comment, from_status: TimesheetStatus.SUBMITTED, to_status: TimesheetStatus.APPROVED } });
        if (lock) await tx.timesheetAction.create({ data: { timesheet_id: sheet.id, action: TimesheetActionType.LOCKED, actor_membership_id: ctx.membership_id, from_status: TimesheetStatus.APPROVED, to_status: TimesheetStatus.LOCKED } });
        return row;
    }

    private async loadForDecision(ctx: OrgContext, id: string) {
        const sheet = await this.prisma.timesheet.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!sheet || !(await this.visible(ctx, sheet.membership_id, true))) throw new NotFoundException({ message: 'Timesheet not found', code: 'timesheet_not_found' });
        const settings = await this.access.settings(ctx.organization_id);
        if (sheet.status !== TimesheetStatus.SUBMITTED) throw new ConflictException({ message: `This timesheet is already ${sheet.status.toLowerCase()}`, code: 'timesheet_already_decided', status: sheet.status });
        if (sheet.membership_id === ctx.membership_id && !settings.allow_self_approval) throw new ForbiddenException({ message: 'You cannot approve or reject your own timesheet', code: 'self_approval_blocked' });
        if (!(await this.canApprove(ctx, sheet))) throw new ForbiddenException({ message: 'You are not an approver for this timesheet', code: 'not_approver' });
        return { sheet, settings };
    }

    private async canApprove(ctx: OrgContext, sheet: Pick<Timesheet, 'membership_id' | 'approver_membership_id'>) {
        if (!ctx.can(APPROVE)) return false;
        if (ctx.scopeOf(APPROVE)?.organization) return true;
        if (sheet.approver_membership_id && sheet.approver_membership_id === ctx.membership_id) return true;
        if (!ctx.membership_id) return false;
        return (await this.access.teamMemberIds(ctx.organization_id, ctx.membership_id)).includes(sheet.membership_id);
    }

    private async visible(ctx: OrgContext, membershipId: string, forApproval = false) {
        if (forApproval && ctx.can(APPROVE)) return true;
        const ids = await this.access.memberIds(ctx, this.access.maxScope(ctx) ?? 'mine');
        if (ids === null || ids.includes(membershipId)) return true;
        return ctx.can(APPROVE) && (await this.prisma.timesheet.count({ where: { membership_id: membershipId, approver_membership_id: ctx.membership_id ?? '__none__' } })) > 0;
    }

    /** Approvers per TimesheetApproverPolicy; project overrides (TimeProjectSettings.approver_membership_id) are added. */
    private async resolveApprovers(ctx: OrgContext, settings: TimeTrackingSettings, membershipId: string, projectIds: (string | null)[]) {
        const out: string[] = [];
        const pids = [...new Set(projectIds.filter((p): p is string => !!p))];
        if (pids.length) {
            const overrides = await this.prisma.timeProjectSettings.findMany({ where: { project_id: { in: pids }, approver_membership_id: { not: null } }, select: { approver_membership_id: true } });
            out.push(...overrides.map((o) => o.approver_membership_id as string));
        }
        switch (settings.approver_policy) {
            case TimesheetApproverPolicy.SPECIFIC_MEMBER:
                if (settings.default_approver_membership_id) out.push(settings.default_approver_membership_id);
                break;
            case TimesheetApproverPolicy.MANAGER: {
                const emp = await this.prisma.employee.findUnique({ where: { membership_id: membershipId }, select: { manager: { select: { membership_id: true } } } });
                if (emp?.manager?.membership_id) out.push(emp.manager.membership_id);
                break;
            }
            case TimesheetApproverPolicy.TEAM_LEAD: {
                const leads = await this.prisma.teamMembership.findMany({
                    where: { is_lead: true, ended_at: null, membership_id: { not: membershipId }, team: { members: { some: { membership_id: membershipId, ended_at: null } } } },
                    select: { membership_id: true },
                });
                out.push(...leads.map((l) => l.membership_id));
                break;
            }
            case TimesheetApproverPolicy.PROJECT_OWNER: {
                if (pids.length) {
                    const owners = await this.prisma.project.findMany({ where: { id: { in: pids }, owner_membership_id: { not: null } }, select: { owner_membership_id: true } });
                    out.push(...owners.map((o) => o.owner_membership_id as string));
                }
                break;
            }
        }
        if (!out.length && settings.default_approver_membership_id) out.push(settings.default_approver_membership_id);
        const unique = [...new Set(out)];
        return settings.allow_self_approval ? unique : unique.filter((m) => m !== membershipId);
    }
}
