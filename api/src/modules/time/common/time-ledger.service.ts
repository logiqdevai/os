import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TimeEntry, TimeEntrySource, TimeEntryStatus, TimeNonBillableCategory, TimeRateKind, TimeRoundingMode, TimesheetStatus, TimeTrackingSettings } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { TimeAccessService } from './time-access.service';
import { addDays, isoDate, round2, toDateOnly, todayUtc, weekPeriod } from './time-dates';

export interface EntryInput {
    membership_id: string;
    date: string | Date;
    start_at?: string | Date | null;
    end_at?: string | Date | null;
    duration_minutes?: number | null;
    project_id?: string | null;
    task_id?: string | null;
    activity_type_id?: string | null;
    description?: string | null;
    is_billable?: boolean;
    billable_override_reason?: string | null;
    non_billable_category?: TimeNonBillableCategory | null;
    source?: TimeEntrySource;
}

/** Statuses an entry can still be edited in (18 §3). */
export const EDITABLE_STATUSES: TimeEntryStatus[] = [TimeEntryStatus.DRAFT, TimeEntryStatus.REJECTED];
/** Timesheet statuses that accept new or changed entries. */
const OPEN_SHEET: TimesheetStatus[] = [TimesheetStatus.OPEN, TimesheetStatus.REJECTED];

/**
 * The rules every write of a TimeEntry goes through (manual form, week grid, timer stop, MCP): settings validation
 * (18 §4–§5), billability defaults (18 §6), rate snapshots (18 §3, §7), lazy timesheet assignment and totals.
 */
@Injectable()
export class TimeLedgerService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: TimeAccessService,
    ) { }

    /** Validates the input and returns the TimeEntry columns to write (without organization / timesheet). */
    async prepare(ctx: OrgContext, input: EntryInput, opts: { excludeEntryId?: string; settings?: TimeTrackingSettings } = {}) {
        const settings = opts.settings ?? (await this.access.settings(ctx.organization_id));
        const date = toDateOnly(input.date);
        const today = todayUtc();
        const fail = (message: string, code: string, field?: string): never => {
            throw new BadRequestException({ message, code, ...(field && { field }) });
        };

        if (!settings.allow_future_entries && date > today) fail('Time cannot be logged for a future day', 'future_date', 'date');
        if (settings.locked_before_date && date < settings.locked_before_date) {
            throw new ConflictException({ message: `Time before ${isoDate(settings.locked_before_date)} is locked`, code: 'period_locked' });
        }
        if (settings.edit_window_days !== null && date < addDays(today, -settings.edit_window_days) && !ctx.can('time.entries.update_team')) {
            throw new ConflictException({ message: `Entries older than ${settings.edit_window_days} days can no longer be changed`, code: 'edit_window_closed' });
        }

        // Duration: start + end wins, otherwise the duration as entered.
        const start = input.start_at ? new Date(input.start_at) : null;
        const end = input.end_at ? new Date(input.end_at) : null;
        let minutes: number;
        if (start && end) {
            if (end <= start) fail('End time must be after the start time', 'invalid_range', 'end_at');
            minutes = Math.round((end.getTime() - start.getTime()) / 60000);
        } else {
            if (!input.duration_minutes) fail('Enter a duration or a start and end time', 'duration_required', 'duration_minutes');
            minutes = input.duration_minutes as number;
        }
        minutes = this.round(minutes, settings.rounding_increment_minutes, settings.rounding_mode);
        if (minutes < 1) fail('The duration must be at least 1 minute', 'duration_too_short', 'duration_minutes');
        if (minutes > 1440) fail('The duration cannot exceed 24 hours', 'duration_too_long', 'duration_minutes');
        if (settings.min_entry_minutes && minutes < settings.min_entry_minutes) fail(`Entries must be at least ${settings.min_entry_minutes} minutes`, 'duration_too_short', 'duration_minutes');

        // Task → project consistency.
        let projectId = input.project_id ?? null;
        const task = input.task_id
            ? await this.prisma.task.findFirst({ where: { id: input.task_id, organization_id: ctx.organization_id }, select: { id: true, project_id: true, workstream_id: true, milestone_id: true } })
            : null;
        if (input.task_id && !task) throw new NotFoundException({ message: 'Task not found', code: 'task_not_found' });
        if (task?.project_id) {
            if (projectId && projectId !== task.project_id) fail('The task belongs to another project', 'task_project_mismatch', 'task_id');
            projectId = task.project_id;
        }

        const project = projectId
            ? await this.prisma.project.findFirst({
                where: { id: projectId, organization_id: ctx.organization_id },
                select: { id: true, owner_membership_id: true, archived_at: true, branch_id: true, time_settings: true, members: { where: { membership_id: input.membership_id, is_active: true }, select: { id: true } } },
            })
            : null;
        if (projectId && !project) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        const ps = project?.time_settings ?? null;
        if (project) {
            if (ps && !ps.time_tracking_enabled) fail('Time tracking is disabled for this project', 'project_tracking_disabled', 'project_id');
            // members_only is enforced once the project has a TimeProjectSettings row (created lazily by 05 / settings).
            if (ps?.members_only && project.owner_membership_id !== input.membership_id && !project.members.length) {
                throw new ForbiddenException({ message: 'Only project members can log time on this project', code: 'not_project_member' });
            }
        }

        const activity = input.activity_type_id
            ? await this.prisma.timeActivityType.findFirst({ where: { id: input.activity_type_id, organization_id: ctx.organization_id } })
            : null;
        if (input.activity_type_id && !activity) throw new NotFoundException({ message: 'Activity type not found', code: 'activity_type_not_found' });

        if (settings.require_project && !projectId) fail('Pick a project', 'project_required', 'project_id');
        if ((settings.require_task_or_ticket || ps?.require_task) && projectId && !input.task_id) fail('Pick a task for this project', 'task_required', 'task_id');
        if (settings.require_activity_type && !activity) fail('Pick an activity type', 'activity_type_required', 'activity_type_id');
        if (settings.require_description && !input.description?.trim()) fail('Add a description', 'description_required', 'description');

        // Billability (18 §6): activity type → project → organization; internal time is non-billable.
        const defaultBillable = activity?.default_billable ?? ps?.default_billable ?? (projectId ? settings.default_billable : false);
        const isBillable = input.is_billable ?? defaultBillable;
        const overridden = isBillable !== defaultBillable;
        if (overridden && settings.require_billable_override_reason && !input.billable_override_reason?.trim() && (input.source ?? 'MANUAL') === 'MANUAL') {
            fail(`Explain why this entry is ${isBillable ? 'billable' : 'not billable'} (the default is ${defaultBillable ? 'billable' : 'non-billable'})`, 'billable_override_reason_required', 'billable_override_reason');
        }
        const nonBillableCategory = isBillable
            ? null
            : input.non_billable_category ?? activity?.default_non_billable_category ?? ps?.default_non_billable_category ?? (projectId ? null : TimeNonBillableCategory.INTERNAL);

        // Daily maximum and overlaps.
        const sameDay = await this.prisma.timeEntry.findMany({
            where: { membership_id: input.membership_id, date, deleted_at: null, ...(opts.excludeEntryId && { id: { not: opts.excludeEntryId } }) },
            select: { duration_minutes: true, start_at: true, end_at: true },
        });
        if (settings.max_hours_per_day !== null) {
            const total = sameDay.reduce((s, e) => s + e.duration_minutes, 0) + minutes;
            const max = Number(settings.max_hours_per_day) * 60;
            if (total > max) fail(`This day would total ${round2(total / 60)}h, over the ${Number(settings.max_hours_per_day)}h daily maximum`, 'max_hours_per_day', 'duration_minutes');
        }
        if (!settings.allow_overlapping_entries && start && end) {
            const overlap = sameDay.some((e) => e.start_at && e.end_at && e.start_at < end && e.end_at > start);
            if (overlap) throw new ConflictException({ message: 'This entry overlaps another entry with a start and end time', code: 'entry_overlap' });
        }

        // Rate snapshots.
        const [billing, cost] = await Promise.all([
            isBillable ? this.access.resolveRate(ctx.organization_id, TimeRateKind.BILLING, { membership_id: input.membership_id, project_id: projectId, activity_type_id: activity?.id ?? null, date }) : null,
            this.access.resolveRate(ctx.organization_id, TimeRateKind.COST, { membership_id: input.membership_id, project_id: projectId, activity_type_id: activity?.id ?? null, date }),
        ]);

        return {
            membership_id: input.membership_id,
            date,
            start_at: start,
            end_at: end,
            duration_minutes: minutes,
            billable_minutes: isBillable ? minutes : 0,
            project_id: projectId,
            workstream_id: task?.workstream_id ?? null,
            milestone_id: task?.milestone_id ?? null,
            task_id: input.task_id ?? null,
            activity_type_id: activity?.id ?? null,
            description: input.description?.trim() || null,
            is_billable: isBillable,
            billable_overridden: overridden,
            billable_override_reason: overridden ? input.billable_override_reason?.trim() || null : null,
            non_billable_category: nonBillableCategory,
            billing_rate_id: billing?.id ?? null,
            billing_rate_amount: billing ? billing.hourly_rate : null,
            billing_currency: billing?.currency ?? null,
            billable_amount: billing ? round2((minutes / 60) * billing.hourly_rate) : null,
            cost_rate_id: cost?.id ?? null,
            cost_rate_amount: cost ? cost.hourly_rate : null,
            cost_currency: cost?.currency ?? null,
            cost_amount: cost ? round2((minutes / 60) * cost.hourly_rate) : null,
            rates_snapshotted_at: new Date(),
            branch_id: project?.branch_id ?? (await this.access.memberBranchId(input.membership_id)),
            source: input.source ?? TimeEntrySource.MANUAL,
        } satisfies Partial<Prisma.TimeEntryUncheckedCreateInput>;
    }

    round(minutes: number, increment: number, mode: TimeRoundingMode) {
        if (mode === TimeRoundingMode.NONE || increment <= 1) return Math.round(minutes);
        const q = minutes / increment;
        const r = mode === TimeRoundingMode.UP ? Math.ceil(q) : mode === TimeRoundingMode.DOWN ? Math.floor(q) : Math.round(q);
        return Math.max(increment, r * increment);
    }

    /** Timesheet of the period containing `date` (created lazily). Refuses periods that are submitted / approved / locked. */
    async openTimesheet(tx: Prisma.TransactionClient, ctx: OrgContext, membershipId: string, date: Date, settings?: TimeTrackingSettings) {
        const s = settings ?? (await this.access.settings(ctx.organization_id));
        const { period_start, period_end } = weekPeriod(date, s.week_start);
        let sheet = await tx.timesheet.findUnique({ where: { membership_id_period_start_period_end: { membership_id: membershipId, period_start, period_end } } });
        if (!sheet) {
            const expected = await this.access.expectedWeeklyMinutes(ctx.organization_id, [membershipId], Number(s.default_expected_hours_per_week));
            sheet = await tx.timesheet.create({
                data: { organization_id: ctx.organization_id, membership_id: membershipId, period_type: 'WEEKLY', period_start, period_end, expected_minutes: expected.get(membershipId) ?? null },
            });
        }
        if (!OPEN_SHEET.includes(sheet.status)) {
            throw new ConflictException({ message: `The timesheet for the week of ${isoDate(period_start)} is ${sheet.status.toLowerCase()}. Reopen it to change time.`, code: 'timesheet_closed', timesheet_id: sheet.id });
        }
        return sheet;
    }

    async recompute(tx: Prisma.TransactionClient | PrismaService, timesheetId: string | null | undefined) {
        if (!timesheetId) return;
        const entries = await tx.timeEntry.findMany({ where: { timesheet_id: timesheetId, deleted_at: null }, select: { duration_minutes: true, billable_minutes: true, billable_amount: true, billing_currency: true } });
        const total = entries.reduce((s, e) => s + e.duration_minutes, 0);
        const billable = entries.reduce((s, e) => s + e.billable_minutes, 0);
        const amount = entries.reduce((s, e) => s + Number(e.billable_amount ?? 0), 0);
        await tx.timesheet.update({
            where: { id: timesheetId },
            data: { total_minutes: total, billable_minutes: billable, non_billable_minutes: total - billable, billable_amount: round2(amount), currency: entries.find((e) => e.billing_currency)?.billing_currency ?? null },
        });
    }

    /** 409 when the entry can no longer be changed (submitted, approved, invoiced or locked). */
    assertEditable(entry: Pick<TimeEntry, 'status' | 'is_locked' | 'invoice_id'>) {
        if (entry.invoice_id || entry.status === TimeEntryStatus.INVOICED) throw new ConflictException({ message: 'This entry has been invoiced and cannot be changed', code: 'entry_invoiced' });
        if (entry.is_locked || entry.status === TimeEntryStatus.LOCKED) throw new ConflictException({ message: 'This entry is locked. Unlock it first.', code: 'entry_locked' });
        if (!EDITABLE_STATUSES.includes(entry.status)) throw new ConflictException({ message: `This entry is ${entry.status.toLowerCase()} and cannot be changed`, code: 'entry_not_editable' });
    }
}
