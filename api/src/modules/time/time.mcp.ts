import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { TimeEntriesService } from './entries/time-entries.service';
import { TimersService } from './timers/timers.service';
import { TimesheetsService } from './timesheets/timesheets.service';
import { BillingRatesService } from './rates/billing-rates.service';
import { TimeReportsService } from './reports/time-reports.service';
import { CreateTimeEntrySchema, UpdateTimeEntrySchema } from './entries/dto/time-entry.dto';
import { TimeEntryQuerySchema } from './entries/dto/time-entry-query.schema';
import { StartTimerSchema } from './timers/dto/timer.dto';
import { DecideTimesheetSchema, RejectTimesheetSchema, SubmitTimesheetSchema, TimesheetQuerySchema } from './timesheets/dto/timesheet.dto';
import { BillingRateQuerySchema, ResolveRateQuerySchema } from './rates/dto/billing-rate.dto';
import { TimeReportQuerySchema, UnbilledQuerySchema } from './reports/dto/time-report.dto';
import { AcceptSuggestionSchema, GenerateSuggestionsSchema, SuggestionQuerySchema, TimeSuggestionsService } from './suggestions/time-suggestions.service';
import { ScheduleSchema, TimeReportSchedulesService } from './schedules/time-report-schedules.service';

const M = ModuleKey.TIME_TRACKING;

/** 18 Time Tracking MCP tools — thin adapters over the same services as REST; scope is narrowed inside the services. */
@Injectable()
export class TimeMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly entries: TimeEntriesService,
        private readonly timers: TimersService,
        private readonly sheets: TimesheetsService,
        private readonly rates: BillingRatesService,
        private readonly reports: TimeReportsService,
        private readonly suggestions: TimeSuggestionsService,
        private readonly schedules: TimeReportSchedulesService,
    ) { }

    onModuleInit() {
        this.registry.registerMany([
            { name: 'time_entries_list', description: 'List time entries (scope mine|team|all, date range, project, member, status, billable).', permission: 'time.entries.read_own', module: M, resource_type: 'time_entry', input: TimeEntryQuerySchema, handler: (ctx, a) => this.entries.findAll(ctx, a) },
            { name: 'time_entries_get', description: 'Get one time entry.', permission: 'time.entries.read_own', module: M, resource_type: 'time_entry', input: z.object({ id: z.string().uuid() }), handler: (ctx, a) => this.entries.findOne(ctx, a.id) },
            { name: 'time_entries_create', description: 'Log time (date + duration or start/end, optional project, task, activity, description, billable).', permission: 'time.entries.create_own', module: M, resource_type: 'time_entry', input: CreateTimeEntrySchema, handler: (ctx, a) => this.entries.create(ctx, a) },
            { name: 'time_entries_update', description: 'Edit a draft or rejected time entry.', permission: 'time.entries.update_own', module: M, resource_type: 'time_entry', input: UpdateTimeEntrySchema, handler: (ctx, { id, ...dto }) => this.entries.update(ctx, id, dto) },
            { name: 'time_entries_delete', description: 'Delete a draft or rejected own time entry.', permission: 'time.entries.delete_own', module: M, resource_type: 'time_entry', sensitive: true, input: z.object({ id: z.string().uuid() }), handler: (ctx, a) => this.entries.remove(ctx, a.id) },
            { name: 'time_timers_current', description: 'The caller\'s running timer, if any.', permission: 'time.entries.read_own', module: M, resource_type: 'timer', input: z.object({}), handler: (ctx) => this.timers.current(ctx) },
            { name: 'time_timers_start', description: 'Start a timer (optionally stop the running one first).', permission: 'time.entries.create_own', module: M, resource_type: 'timer', input: StartTimerSchema, handler: (ctx, a) => this.timers.start(ctx, a) },
            { name: 'time_timers_stop', description: 'Stop the running timer and save it as a time entry.', permission: 'time.entries.create_own', module: M, resource_type: 'timer', input: z.object({ id: z.string().uuid() }), handler: (ctx, a) => this.timers.stop(ctx, a.id) },
            { name: 'time_timesheets_week', description: 'A member\'s week: timesheet status, expected hours and entries.', permission: 'time.entries.read_own', module: M, resource_type: 'timesheet', input: z.object({ period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), membership_id: z.string().uuid().optional() }), handler: (ctx, a) => this.sheets.week(ctx, a) },
            { name: 'time_timesheets_list', description: 'List timesheets in the caller\'s scope.', permission: 'time.entries.read_own', module: M, resource_type: 'timesheet', input: TimesheetQuerySchema, handler: (ctx, a) => this.sheets.findAll(ctx, a) },
            { name: 'time_timesheets_submit', description: 'Submit the caller\'s week for approval.', permission: 'time.timesheets.submit_own', module: M, resource_type: 'timesheet', input: SubmitTimesheetSchema, handler: (ctx, a) => this.sheets.submit(ctx, a.period_start, a.comment) },
            { name: 'time_timesheets_approvals', description: 'Submitted timesheets waiting for the caller\'s approval.', permission: 'time.timesheets.approve', module: M, resource_type: 'timesheet', input: TimesheetQuerySchema, handler: (ctx, a) => this.sheets.approvals(ctx, a) },
            { name: 'time_timesheets_approve', description: 'Approve a submitted timesheet.', permission: 'time.timesheets.approve', module: M, resource_type: 'timesheet', sensitive: true, input: DecideTimesheetSchema, handler: (ctx, a) => this.sheets.approve(ctx, a.id, a.comment) },
            { name: 'time_timesheets_reject', description: 'Reject a submitted timesheet with a comment.', permission: 'time.timesheets.approve', module: M, resource_type: 'timesheet', sensitive: true, input: RejectTimesheetSchema, handler: (ctx, a) => this.sheets.reject(ctx, a.id, a.comment) },
            { name: 'time_rates_list', description: 'List billing and cost rate cards.', permission: 'time.rates.read', module: M, resource_type: 'billing_rate', input: BillingRateQuerySchema, handler: (ctx, a) => this.rates.findAll(ctx, a) },
            { name: 'time_rates_resolve', description: 'Resolve the billing and cost rate for a member, project and activity on a date.', permission: 'time.rates.read', module: M, resource_type: 'billing_rate', input: ResolveRateQuerySchema, handler: (ctx, a) => this.rates.resolve(ctx, a) },
            { name: 'time_reports_read', description: 'Hours report grouped by project, member, customer, activity, task or day.', permission: 'time.reports.read', module: M, resource_type: 'time_report', input: TimeReportQuerySchema, handler: (ctx, a) => this.reports.summary(ctx, a) },
            { name: 'time_reports_utilization', description: 'Utilization per member (logged vs expected hours).', permission: 'time.reports.read', module: M, resource_type: 'time_report', input: TimeReportQuerySchema, handler: (ctx, a) => this.reports.utilization(ctx, a) },
            { name: 'time_suggestions_list', description: 'My suggested time entries (from calendar events and task status changes).', permission: 'time.entries.create_own', module: M, resource_type: 'time_suggestion', input: SuggestionQuerySchema, handler: (ctx, a) => this.suggestions.list(ctx, a) },
            { name: 'time_suggestions_generate', description: 'Scan my calendar and task activity for new suggestions (last 14 days by default).', permission: 'time.entries.create_own', module: M, resource_type: 'time_suggestion', input: GenerateSuggestionsSchema, handler: (ctx, a) => this.suggestions.generate(ctx, a) },
            { name: 'time_suggestions_accept', description: 'Accept a suggestion (optionally edited); creates a draft time entry.', permission: 'time.entries.create_own', module: M, resource_type: 'time_suggestion', input: AcceptSuggestionSchema.extend({ id: z.string().uuid() }), handler: (ctx, { id, ...dto }) => this.suggestions.accept(ctx, id, dto) },
            { name: 'time_suggestions_dismiss', description: 'Dismiss a suggestion so it is not proposed again.', permission: 'time.entries.create_own', module: M, resource_type: 'time_suggestion', input: z.object({ id: z.string().uuid() }), handler: (ctx, a) => this.suggestions.dismiss(ctx, a.id) },
            { name: 'time_report_schedules_list', description: 'Scheduled e-mailed time reports.', permission: 'time.entries.export', module: M, resource_type: 'time_report_schedule', input: z.object({}), handler: (ctx) => this.schedules.list(ctx) },
            { name: 'time_report_schedules_create', description: 'Schedule an e-mailed time report (runs as you).', permission: 'time.entries.export', module: M, resource_type: 'time_report_schedule', sensitive: true, input: ScheduleSchema, handler: (ctx, a) => this.schedules.create(ctx, a) },
            { name: 'time_unbilled_list', description: 'Approved billable time not yet invoiced, grouped by customer and project.', permission: 'time.entries.read_all', module: M, resource_type: 'time_entry', input: UnbilledQuerySchema, handler: (ctx, a) => this.reports.unbilled(ctx, a) },
        ]);
    }
}
