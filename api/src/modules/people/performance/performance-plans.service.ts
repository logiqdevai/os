import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Employee, ModuleKey, PerformanceImprovementPlanStatus, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { PeopleAccessService } from '../common/people-access.service';
import { P, addDays, dates, defined, num, personName, toDay, today, userSelect } from '../common/people.utils';
import {
    CalibrateReviewDto, ClosePipDto, DeclineFeedbackRequestDto, FeedbackRequestDto, FeedbackRequestQuery, PipDto, PipItemDto, PipQuery, SubmitFeedbackRequestDto, UpdatePipDto, UpdatePipItemDto,
} from './performance-plans.dto';

const employeeSelect = { id: true, employee_number: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership_id: true, job_title: true, membership: { select: { user: { select: userSelect } } } } as const;
const memberSelect = { id: true, user: { select: userSelect } } as const;
const OPEN_PIP: PerformanceImprovementPlanStatus[] = ['DRAFT', 'ACTIVE'];

/**
 * 10 "Performance Management" — improvement plans (PIP + measurable items), feedback requests (360 / peer feedback
 * answered as PerformanceFeedback) and cycle calibration (PerformanceCalibration; the latest row per review is written
 * back to PerformanceReview.overall_rating). Managing needs employees.performance.manage over the employee (scope or
 * line manager); reading needs read_all scope, or the employee's own record once the plan is active.
 */
@Injectable()
export class PerformancePlansService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: PeopleAccessService,
    ) { }

    // ================================================================ improvement plans

    async plans(ctx: OrgContext, query: PipQuery) {
        const where: Prisma.PerformanceImprovementPlanWhereInput = {
            organization_id: ctx.organization_id,
            AND: [this.planVisibility(ctx)],
            ...(query.employee_id && { employee_id: query.employee_id }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.search && { OR: [{ title: { contains: query.search, mode: 'insensitive' } }, { employee: { preferred_name: { contains: query.search, mode: 'insensitive' } } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.performanceImprovementPlan.findMany({ where, ...skipTake(query), orderBy: [{ status: 'asc' }, { end_date: 'asc' }], include: this.planInclude() }),
            this.prisma.performanceImprovementPlan.count({ where }),
        ]);
        return paginate(items.map((p) => this.shapePlan(ctx, p)), total, query);
    }

    async plan(ctx: OrgContext, id: string) {
        const p = await this.prisma.performanceImprovementPlan.findFirst({ where: { id, organization_id: ctx.organization_id, AND: [this.planVisibility(ctx)] }, include: this.planInclude() });
        if (!p) throw new NotFoundException({ message: 'Improvement plan not found', code: 'pip_not_found' });
        return this.shapePlan(ctx, p);
    }

    async createPlan(ctx: OrgContext, dto: PipDto) {
        const e = await this.managedEmployee(ctx, dto.employee_id);
        if (this.access.isOwn(ctx, e)) throw new ForbiddenException({ message: 'You cannot open an improvement plan for yourself', code: 'self_pip' });
        if (toDay(dto.end_date) < toDay(dto.start_date)) throw new BadRequestException({ message: 'The plan ends before it starts', code: 'invalid_range' });
        if (await this.prisma.performanceImprovementPlan.count({ where: { employee_id: e.id, status: { in: OPEN_PIP } } })) {
            throw new ConflictException({ message: 'This employee already has an open improvement plan', code: 'pip_open' });
        }
        await this.assertMembers(ctx, [dto.manager_membership_id, dto.hr_membership_id]);
        const manager = dto.manager_membership_id ?? (e.manager_employee_id ? (await this.prisma.employee.findUnique({ where: { id: e.manager_employee_id }, select: { membership_id: true } }))?.membership_id : null) ?? ctx.membership_id;
        const { items, ...fields } = dto;
        const row = await this.prisma.performanceImprovementPlan.create({
            data: {
                ...(dates(fields, ['start_date', 'end_date']) as any),
                organization_id: ctx.organization_id, manager_membership_id: manager, created_by_user_id: ctx.user_id,
                items: items?.length ? { create: items.map((it, i) => ({ ...(dates(it, ['due_date']) as any), sort_order: i })) } : undefined,
            },
        });
        await this.audit.record(ctx, 'performance_pip.created', { resource_type: 'performance_improvement_plan', resource_id: row.id, metadata: { employee_id: e.id, items: items?.length ?? 0 } });
        this.events.publish(ctx, { event_key: 'employees.pip.created', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_improvement_plan', entity_id: row.id, payload: { employee_id: e.id, status: row.status } });
        return this.plan(ctx, row.id);
    }

    async updatePlan(ctx: OrgContext, id: string, dto: UpdatePipDto) {
        const before = await this.writablePlan(ctx, id);
        if (!OPEN_PIP.includes(before.status)) throw new ConflictException({ message: 'This plan is closed', code: 'pip_closed' });
        await this.assertMembers(ctx, [dto.manager_membership_id, dto.hr_membership_id]);
        const { items: _items, employee_id: _employee, ...fields } = dto;
        const data = dates(defined(fields), ['start_date', 'end_date', 'next_check_in_on']) as Prisma.PerformanceImprovementPlanUncheckedUpdateInput;
        const row = await this.prisma.performanceImprovementPlan.update({ where: { id }, data });
        if (row.end_date < row.start_date) throw new BadRequestException({ message: 'The plan ends before it starts', code: 'invalid_range' });
        await this.audit.record(ctx, 'performance_pip.updated', { resource_type: 'performance_improvement_plan', resource_id: id, metadata: { before: { title: before.title, end_date: before.end_date }, after: fields } });
        return this.plan(ctx, id);
    }

    /** DRAFT → ACTIVE: the employee now sees the plan and is notified; the first check-in is scheduled. */
    async activatePlan(ctx: OrgContext, id: string) {
        const p = await this.writablePlan(ctx, id);
        if (p.status !== 'DRAFT') throw new ConflictException({ message: 'Only a draft plan can be activated', code: 'pip_not_draft' });
        const items = await this.prisma.performanceImprovementPlanItem.count({ where: { plan_id: id } });
        if (!items) throw new BadRequestException({ message: 'Add at least one measurable item first', code: 'pip_no_items' });
        const start = p.start_date > today() ? p.start_date : today();
        await this.prisma.performanceImprovementPlan.update({ where: { id }, data: { status: 'ACTIVE', next_check_in_on: p.check_in_frequency_days ? addDays(start, p.check_in_frequency_days) : null } });
        await this.audit.record(ctx, 'performance_pip.activated', { resource_type: 'performance_improvement_plan', resource_id: id, metadata: { employee_id: p.employee_id } });
        this.events.publish(ctx, {
            event_key: 'employees.pip.activated', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_improvement_plan', entity_id: id,
            payload: { employee_id: p.employee_id, recipient_membership_ids: [p.employee.membership_id, ...(p.hr_membership_id ? [p.hr_membership_id] : [])], notification_title: 'An improvement plan was shared with you', link: '/people/performance?tab=plans' },
        });
        return this.plan(ctx, id);
    }

    /** Close with an outcome; a note is required (spec). Open items are left as they are. */
    async closePlan(ctx: OrgContext, id: string, dto: ClosePipDto) {
        const p = await this.writablePlan(ctx, id);
        if (!OPEN_PIP.includes(p.status)) throw new ConflictException({ message: 'This plan is already closed', code: 'pip_closed' });
        if (p.status === 'DRAFT' && dto.outcome !== 'CANCELLED') throw new ConflictException({ message: 'A draft plan can only be cancelled', code: 'pip_not_active' });
        await this.prisma.performanceImprovementPlan.update({ where: { id }, data: { status: dto.outcome, outcome_note: dto.outcome_note, closed_at: new Date(), next_check_in_on: null } });
        await this.audit.record(ctx, 'performance_pip.closed', { resource_type: 'performance_improvement_plan', resource_id: id, metadata: { outcome: dto.outcome, employee_id: p.employee_id } });
        this.events.publish(ctx, {
            event_key: 'employees.pip.closed', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_improvement_plan', entity_id: id,
            payload: { employee_id: p.employee_id, outcome: dto.outcome, ...(p.status === 'ACTIVE' && { recipient_membership_ids: [p.employee.membership_id], link: '/people/performance?tab=plans' }) },
        });
        return this.plan(ctx, id);
    }

    async addItem(ctx: OrgContext, id: string, dto: PipItemDto) {
        const p = await this.writablePlan(ctx, id);
        if (!OPEN_PIP.includes(p.status)) throw new ConflictException({ message: 'This plan is closed', code: 'pip_closed' });
        const count = await this.prisma.performanceImprovementPlanItem.count({ where: { plan_id: id } });
        await this.prisma.performanceImprovementPlanItem.create({ data: { ...(dates(dto, ['due_date']) as any), plan_id: id, sort_order: count } });
        await this.audit.record(ctx, 'performance_pip.item_added', { resource_type: 'performance_improvement_plan', resource_id: id, metadata: { title: dto.title } });
        return this.plan(ctx, id);
    }

    /** Evaluate (MET / NOT_MET) or edit an item; evaluation stamps evaluated_at. */
    async updateItem(ctx: OrgContext, id: string, itemId: string, dto: UpdatePipItemDto) {
        const p = await this.writablePlan(ctx, id);
        if (!OPEN_PIP.includes(p.status)) throw new ConflictException({ message: 'This plan is closed', code: 'pip_closed' });
        const item = await this.prisma.performanceImprovementPlanItem.findFirst({ where: { id: itemId, plan_id: id } });
        if (!item) throw new NotFoundException({ message: 'Item not found', code: 'pip_item_not_found' });
        const data = dates(defined(dto), ['due_date']) as Prisma.PerformanceImprovementPlanItemUpdateInput;
        if (dto.status && dto.status !== item.status) data.evaluated_at = dto.status === 'OPEN' ? null : new Date();
        await this.prisma.performanceImprovementPlanItem.update({ where: { id: itemId }, data });
        // A check-in happened: schedule the next one.
        if (dto.status && p.status === 'ACTIVE' && p.check_in_frequency_days) {
            await this.prisma.performanceImprovementPlan.update({ where: { id }, data: { next_check_in_on: addDays(today(), p.check_in_frequency_days) } });
        }
        await this.audit.record(ctx, 'performance_pip.item_updated', { resource_type: 'performance_improvement_plan', resource_id: id, metadata: { item_id: itemId, before: { status: item.status }, after: dto } });
        return this.plan(ctx, id);
    }

    // ================================================================ feedback requests

    async requests(ctx: OrgContext, query: FeedbackRequestQuery) {
        const me = ctx.membership_id ?? '__none__';
        const all = this.access.scopeWhere(ctx, P.perfReadAll);
        const boxWhere: Prisma.PerformanceFeedbackRequestWhereInput =
            query.box === 'sent' ? { requested_by_membership_id: me }
                : query.box === 'all' ? { OR: [...(all ? [{ employee: all }] : []), { requested_by_membership_id: me }, { requested_from_membership_id: me }] }
                    : { requested_from_membership_id: me };
        const where: Prisma.PerformanceFeedbackRequestWhereInput = {
            organization_id: ctx.organization_id,
            AND: [boxWhere],
            ...(query.employee_id && { employee_id: query.employee_id }),
            ...(query.status?.length && { status: { in: query.status } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.performanceFeedbackRequest.findMany({
                where, ...skipTake(query), orderBy: [{ status: 'asc' }, { due_date: 'asc' }, { created_at: 'desc' }],
                include: { employee: { select: employeeSelect }, requested_by: { select: memberSelect }, requested_from: { select: memberSelect }, review: { select: { id: true, title: true } }, cycle: { select: { id: true, name: true } } },
            }),
            this.prisma.performanceFeedbackRequest.count({ where }),
        ]);
        const now = today();
        return paginate(items.map((r) => ({
            ...r,
            employee: { ...r.employee, name: personName(r.employee) },
            is_recipient: r.requested_from_membership_id === ctx.membership_id,
            is_requester: r.requested_by_membership_id === ctx.membership_id,
            overdue: r.status === 'PENDING' && !!r.due_date && r.due_date < now,
            // The answer is linked by id only; it is read through the feedback list with its own visibility rules.
            feedback_id: r.feedback_id,
        })), total, query);
    }

    /** Ask colleagues for feedback about an employee: performance.manage over them, or the employee asking about themselves. */
    async createRequests(ctx: OrgContext, dto: FeedbackRequestDto) {
        const e = await this.prisma.employee.findFirst({ where: { id: dto.employee_id, organization_id: ctx.organization_id } });
        if (!e) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        const own = this.access.isOwn(ctx, e);
        if (!own) await this.managedEmployee(ctx, e.id);
        else if (!ctx.can(P.perfReadOwn)) throw new ForbiddenException({ message: 'You cannot request feedback', code: 'forbidden' });
        const recipients = [...new Set(dto.requested_from_membership_ids)].filter((m) => m !== e.membership_id);
        if (!recipients.length) throw new BadRequestException({ message: 'Pick at least one colleague other than the employee', code: 'no_recipients' });
        const found = await this.prisma.membership.count({ where: { id: { in: recipients }, organization_id: ctx.organization_id, status: 'ACTIVE' } });
        if (found !== recipients.length) throw new NotFoundException({ message: 'A selected member was not found or is not active', code: 'membership_not_found' });
        if (dto.review_id && !(await this.prisma.performanceReview.count({ where: { id: dto.review_id, employee_id: e.id } }))) throw new NotFoundException({ message: 'Review not found', code: 'review_not_found' });
        if (dto.cycle_id && !(await this.prisma.performanceReviewCycle.count({ where: { id: dto.cycle_id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Review cycle not found', code: 'cycle_not_found' });
        const open = await this.prisma.performanceFeedbackRequest.findMany({ where: { employee_id: e.id, status: 'PENDING', requested_from_membership_id: { in: recipients } }, select: { requested_from_membership_id: true } });
        const skip = new Set(open.map((o) => o.requested_from_membership_id));
        const targets = recipients.filter((r) => !skip.has(r));
        const due = dto.due_date ? toDay(dto.due_date) : null;
        await this.prisma.performanceFeedbackRequest.createMany({
            data: targets.map((r) => ({
                organization_id: ctx.organization_id, employee_id: e.id, requested_by_membership_id: ctx.membership_id, requested_from_membership_id: r,
                review_id: dto.review_id ?? null, cycle_id: dto.cycle_id ?? null, due_date: due, message: dto.message ?? null, is_anonymous: dto.is_anonymous ?? false,
            })),
        });
        await this.audit.record(ctx, 'performance_feedback_request.created', { resource_type: 'employee', resource_id: e.id, metadata: { recipients: targets.length, already_pending: skip.size } });
        if (targets.length) {
            this.events.publish(ctx, {
                event_key: 'employees.feedback_request.created', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_feedback_request', entity_id: null,
                payload: { employee_id: e.id, recipient_membership_ids: targets, notification_category: 'APPROVAL', notification_title: `Feedback requested about ${personName(e as any)}`, link: '/people/performance?tab=requests' },
            });
        }
        return { created: targets.length, already_pending: skip.size };
    }

    /** The recipient answers: a PerformanceFeedback row (PEER_FEEDBACK) is created and linked. */
    async submitRequest(ctx: OrgContext, id: string, dto: SubmitFeedbackRequestDto) {
        const r = await this.ownRequest(ctx, id);
        const own = r.requested_by_membership_id === r.employee.membership_id; // the employee asked about themselves
        const result = await this.prisma.$transaction(async (tx) => {
            const fb = await tx.performanceFeedback.create({
                data: {
                    organization_id: ctx.organization_id, employee_id: r.employee_id, author_membership_id: ctx.membership_id, review_id: r.review_id, kind: 'PEER_FEEDBACK',
                    visibility: own ? 'EMPLOYEE_VISIBLE' : 'MANAGERS_ONLY', title: dto.title, body: dto.body, rating: dto.rating, is_anonymous: r.is_anonymous, occurred_on: today(),
                },
            });
            const claimed = await tx.performanceFeedbackRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'SUBMITTED', feedback_id: fb.id, responded_at: new Date() } });
            if (!claimed.count) throw new ConflictException({ message: 'This request was already answered', code: 'feedback_request_closed' });
            return fb;
        });
        await this.audit.record(ctx, 'performance_feedback_request.submitted', { resource_type: 'performance_feedback', resource_id: result.id, metadata: { request_id: id, employee_id: r.employee_id, anonymous: r.is_anonymous } });
        this.events.publish(ctx, {
            event_key: 'employees.feedback_request.submitted', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_feedback_request', entity_id: id,
            payload: { employee_id: r.employee_id, ...(r.requested_by_membership_id && { recipient_membership_ids: [r.requested_by_membership_id] }), notification_title: `Feedback received about ${personName(r.employee)}`, link: '/people/performance?tab=feedback' },
        });
        return { request_id: id, feedback_id: result.id };
    }

    async declineRequest(ctx: OrgContext, id: string, dto: DeclineFeedbackRequestDto) {
        const r = await this.ownRequest(ctx, id);
        await this.prisma.performanceFeedbackRequest.update({ where: { id: r.id }, data: { status: 'DECLINED', decline_reason: dto.reason, responded_at: new Date() } });
        await this.audit.record(ctx, 'performance_feedback_request.declined', { resource_type: 'performance_feedback_request', resource_id: id, metadata: { employee_id: r.employee_id } });
        if (r.requested_by_membership_id) {
            this.events.publish(ctx, {
                event_key: 'employees.feedback_request.declined', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_feedback_request', entity_id: id,
                payload: { employee_id: r.employee_id, recipient_membership_ids: [r.requested_by_membership_id], notification_title: 'A feedback request was declined', link: '/people/performance?tab=requests' },
            });
        }
        return { success: true };
    }

    /** The requester (or performance.manage over the employee) withdraws a pending request. */
    async cancelRequest(ctx: OrgContext, id: string) {
        const r = await this.prisma.performanceFeedbackRequest.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!r) throw new NotFoundException({ message: 'Request not found', code: 'feedback_request_not_found' });
        if (r.requested_by_membership_id !== ctx.membership_id) await this.managedEmployee(ctx, r.employee_id);
        if (r.status !== 'PENDING') throw new ConflictException({ message: 'Only pending requests can be cancelled', code: 'feedback_request_closed' });
        await this.prisma.performanceFeedbackRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
        await this.audit.record(ctx, 'performance_feedback_request.cancelled', { resource_type: 'performance_feedback_request', resource_id: id });
        return { success: true };
    }

    // ================================================================ calibration

    /** Reviews of a cycle in the caller's manage scope with their rating, calibration history and the distribution. */
    async calibration(ctx: OrgContext, cycleId: string) {
        const cycle = await this.prisma.performanceReviewCycle.findFirst({ where: { id: cycleId, organization_id: ctx.organization_id } });
        if (!cycle) throw new NotFoundException({ message: 'Review cycle not found', code: 'cycle_not_found' });
        const scope = this.access.scopeWhere(ctx, P.perfManage);
        if (!scope) throw new ForbiddenException({ message: 'Calibration needs employees.performance.manage', code: 'permission_denied', permissions: [P.perfManage] });
        const reviews = await this.prisma.performanceReview.findMany({
            where: { cycle_id: cycleId, organization_id: ctx.organization_id, status: { not: 'CANCELLED' }, employee: scope },
            include: {
                employee: { select: { ...employeeSelect, department: { select: { id: true, name: true } } } },
                reviewer: { select: memberSelect },
                calibrations: { orderBy: { created_at: 'desc' } },
            },
            orderBy: { overall_rating: 'desc' },
        });
        const max = Number((cycle.template as { rating_scale_max?: number } | null)?.rating_scale_max ?? 5);
        const buckets = Array.from({ length: max }, (_, i) => ({ rating: i + 1, count: 0 }));
        for (const r of reviews) {
            if (r.overall_rating === null) continue;
            const b = Math.min(max, Math.max(1, Math.round(num(r.overall_rating))));
            buckets[b - 1].count++;
        }
        const rated = reviews.filter((r) => r.overall_rating !== null);
        return {
            cycle: { id: cycle.id, name: cycle.name, status: cycle.status, rating_scale_max: max },
            distribution: buckets,
            average: rated.length ? Math.round((rated.reduce((s, r) => s + num(r.overall_rating), 0) / rated.length) * 100) / 100 : null,
            reviews: reviews.map((r) => ({
                id: r.id, status: r.status, overall_rating: r.overall_rating, rating_scale_max: r.rating_scale_max,
                employee: { ...r.employee, name: personName(r.employee) }, reviewer: r.reviewer,
                calibrations: r.calibrations,
                can_calibrate: !['ACKNOWLEDGED', 'CANCELLED', 'DRAFT', 'SELF_ASSESSMENT'].includes(r.status),
            })),
        };
    }

    /** Adjust a review's rating with a reason; the original rating is kept in the calibration row. */
    async calibrate(ctx: OrgContext, reviewId: string, dto: CalibrateReviewDto) {
        const r = await this.prisma.performanceReview.findFirst({ where: { id: reviewId, organization_id: ctx.organization_id }, include: { employee: true } });
        if (!r) throw new NotFoundException({ message: 'Review not found', code: 'review_not_found' });
        await this.managedEmployee(ctx, r.employee_id);
        if (!r.cycle_id) throw new BadRequestException({ message: 'Only reviews of a cycle can be calibrated', code: 'review_not_in_cycle' });
        if (['ACKNOWLEDGED', 'CANCELLED', 'DRAFT', 'SELF_ASSESSMENT'].includes(r.status)) throw new ConflictException({ message: 'This review cannot be calibrated now', code: 'review_not_calibratable', status: r.status });
        if (dto.calibrated_rating > r.rating_scale_max) throw new BadRequestException({ message: `The rating scale ends at ${r.rating_scale_max}`, code: 'rating_out_of_scale' });
        if (this.access.isOwn(ctx, r.employee)) throw new ForbiddenException({ message: 'You cannot calibrate your own review', code: 'self_calibration' });
        const row = await this.prisma.$transaction(async (tx) => {
            const c = await tx.performanceCalibration.create({
                data: { organization_id: ctx.organization_id, cycle_id: r.cycle_id!, review_id: r.id, original_rating: r.overall_rating, calibrated_rating: dto.calibrated_rating, reason: dto.reason, calibrated_by_membership_id: ctx.membership_id },
            });
            await tx.performanceReview.update({ where: { id: r.id }, data: { overall_rating: dto.calibrated_rating } });
            return c;
        });
        await this.audit.record(ctx, 'performance_review.calibrated', { resource_type: 'performance_review', resource_id: r.id, metadata: { before: { overall_rating: r.overall_rating }, after: { overall_rating: dto.calibrated_rating }, reason: dto.reason } });
        this.events.publish(ctx, { event_key: 'employees.review.calibrated', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_review', entity_id: r.id, payload: { cycle_id: r.cycle_id, employee_id: r.employee_id } });
        return row;
    }

    // ================================================================ helpers

    /** Plans: read_all scope, the line manager / HR partner of the plan, or the employee once it is no longer a draft. */
    private planVisibility(ctx: OrgContext): Prisma.PerformanceImprovementPlanWhereInput {
        const me = ctx.membership_id ?? '__none__';
        const all = this.access.scopeWhere(ctx, P.perfReadAll);
        return {
            OR: [
                ...(all ? [{ employee: all }] : []),
                { manager_membership_id: me },
                { hr_membership_id: me },
                ...(ctx.can(P.perfReadOwn) ? [{ employee: { membership_id: me }, status: { not: 'DRAFT' as const } }] : []),
            ],
        };
    }

    private planInclude() {
        return {
            employee: { select: employeeSelect },
            items: { orderBy: { sort_order: 'asc' as const } },
            review: { select: { id: true, title: true } },
        } satisfies Prisma.PerformanceImprovementPlanInclude;
    }

    private shapePlan(ctx: OrgContext, p: any) {
        const own = this.access.isOwn(ctx, p.employee);
        return {
            ...p,
            employee: { ...p.employee, name: personName(p.employee) },
            is_mine: own,
            met_count: p.items.filter((i: any) => i.status === 'MET').length,
            check_in_due: p.status === 'ACTIVE' && !!p.next_check_in_on && p.next_check_in_on <= today(),
        };
    }

    private async writablePlan(ctx: OrgContext, id: string) {
        const p = await this.prisma.performanceImprovementPlan.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { employee: true } });
        if (!p) throw new NotFoundException({ message: 'Improvement plan not found', code: 'pip_not_found' });
        if (p.manager_membership_id !== ctx.membership_id && p.hr_membership_id !== ctx.membership_id) await this.managedEmployee(ctx, p.employee_id);
        else if (!ctx.can(P.perfManage)) throw new ForbiddenException({ message: 'You need employees.performance.manage', code: 'permission_denied', permissions: [P.perfManage] });
        return p;
    }

    /** employees.performance.manage over the employee: scope, or the caller is their (indirect) manager. 404 otherwise. */
    private async managedEmployee(ctx: OrgContext, employeeId: string): Promise<Employee> {
        const e = await this.prisma.employee.findFirst({ where: { id: employeeId, organization_id: ctx.organization_id } });
        if (!e || !ctx.can(P.perfManage)) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        const scope = this.access.scopeWhere(ctx, P.perfManage);
        if (scope && (await this.prisma.employee.count({ where: { id: employeeId, ...scope } }))) return e;
        if (await this.access.isManagerOf(ctx, employeeId)) return e;
        throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
    }

    private async ownRequest(ctx: OrgContext, id: string) {
        const r = await this.prisma.performanceFeedbackRequest.findFirst({ where: { id, organization_id: ctx.organization_id, requested_from_membership_id: ctx.membership_id ?? '__none__' }, include: { employee: { select: employeeSelect } } });
        if (!r) throw new NotFoundException({ message: 'Request not found', code: 'feedback_request_not_found' });
        if (r.status !== 'PENDING') throw new ConflictException({ message: `This request is ${r.status.toLowerCase()}`, code: 'feedback_request_closed' });
        return r;
    }

    private async assertMembers(ctx: OrgContext, ids: (string | undefined)[]) {
        const list = ids.filter((x): x is string => !!x);
        if (!list.length) return;
        const n = await this.prisma.membership.count({ where: { id: { in: list }, organization_id: ctx.organization_id } });
        if (n !== new Set(list).size) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
    }
}
