import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Employee, ModuleKey, PerformanceReviewStatus, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { BaseListQuery, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { PeopleAccessService } from '../common/people-access.service';
import { P, dates, defined, num, personName, round2, toDay, userSelect } from '../common/people.utils';
import {
    CycleDto, FeedbackDto, FeedbackQuery, GoalDto, GoalQuery, GoalUpdateDto, LaunchCycleDto, ReviewDto, ReviewQuery, UpdateCycleDto, UpdateGoalDto, UpdateReviewDto,
} from './performance.dto';

const employeeSelect = { id: true, employee_number: true, preferred_name: true, legal_first_name: true, legal_last_name: true, membership_id: true, job_title: true, manager_employee_id: true, membership: { select: { user: { select: userSelect } } } } as const;
const MANAGER_FIELDS = ['manager_assessment', 'ratings', 'overall_rating', 'strengths', 'improvement_areas', 'summary', 'due_date', 'next_review_date', 'reviewer_membership_id'] as const;
const EDITABLE: PerformanceReviewStatus[] = ['DRAFT', 'SELF_ASSESSMENT', 'MANAGER_ASSESSMENT', 'SUBMITTED'];

/**
 * 10 "Performance Management": cycles, reviews (DRAFT → SELF_ASSESSMENT → MANAGER_ASSESSMENT → SUBMITTED → COMPLETED →
 * ACKNOWLEDGED), goals / OKRs with check-ins, and feedback. read_all is scoped (managers see their reports);
 * read_own lets an employee see their own reviews (manager assessment hidden until COMPLETED) and visible goals.
 */
@Injectable()
export class PerformanceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: PeopleAccessService,
    ) { }

    // ================================================================ cycles

    async cycles(ctx: OrgContext, query: BaseListQuery) {
        const where: Prisma.PerformanceReviewCycleWhereInput = { organization_id: ctx.organization_id, ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }) };
        const [items, total] = await Promise.all([
            this.prisma.performanceReviewCycle.findMany({ where, ...skipTake(query), orderBy: { period_start: 'desc' } }),
            this.prisma.performanceReviewCycle.count({ where }),
        ]);
        const counts = await this.prisma.performanceReview.groupBy({ by: ['cycle_id', 'status'], where: { cycle_id: { in: items.map((c) => c.id) } }, _count: { _all: true } });
        return paginate(items.map((c) => {
            const rows = counts.filter((r) => r.cycle_id === c.id);
            const total_reviews = rows.reduce((s, r) => s + r._count._all, 0);
            const done = rows.filter((r) => ['COMPLETED', 'ACKNOWLEDGED'].includes(r.status)).reduce((s, r) => s + r._count._all, 0);
            return { ...c, review_count: total_reviews, completed_count: done, by_status: Object.fromEntries(rows.map((r) => [r.status, r._count._all])) };
        }), total, query);
    }

    async createCycle(ctx: OrgContext, dto: CycleDto) {
        if (toDay(dto.period_end) < toDay(dto.period_start)) throw new BadRequestException({ message: 'The period ends before it starts', code: 'invalid_range' });
        const row = await this.prisma.performanceReviewCycle.create({
            data: { ...(dates(dto, ['period_start', 'period_end', 'due_date']) as any), template: (dto.template ?? DEFAULT_TEMPLATE) as Prisma.InputJsonValue, organization_id: ctx.organization_id, created_by_user_id: ctx.user_id },
        });
        await this.audit.record(ctx, 'performance_cycle.created', { resource_type: 'performance_cycle', resource_id: row.id, metadata: { after: dto } });
        this.events.publish(ctx, { event_key: 'employees.performance_cycle.created', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_cycle', entity_id: row.id, payload: { name: row.name } });
        return row;
    }

    async updateCycle(ctx: OrgContext, id: string, dto: UpdateCycleDto) {
        const before = await this.cycle(ctx, id);
        const row = await this.prisma.performanceReviewCycle.update({ where: { id }, data: { ...(dates(defined(dto), ['period_start', 'period_end', 'due_date']) as any), ...(dto.template && { template: dto.template as Prisma.InputJsonValue }) } });
        await this.audit.record(ctx, 'performance_cycle.updated', { resource_type: 'performance_cycle', resource_id: id, metadata: { before: { status: before.status, name: before.name }, after: dto } });
        if (dto.status === 'COMPLETED' && before.status !== 'COMPLETED') {
            this.events.publish(ctx, { event_key: 'employees.performance_cycle.completed', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_cycle', entity_id: id, payload: { name: row.name } });
        }
        return row;
    }

    /** One review per employee (in the caller's scope), reviewer = the employee's manager; employees start with the self assessment. */
    async launch(ctx: OrgContext, id: string, dto: LaunchCycleDto) {
        const cycle = await this.cycle(ctx, id);
        if (['COMPLETED', 'CANCELLED'].includes(cycle.status)) throw new ConflictException({ message: 'This cycle is closed', code: 'cycle_closed' });
        const scope = this.access.scopeWhere(ctx, P.perfManage) ?? { id: '__none__' };
        const employees = await this.prisma.employee.findMany({
            where: { organization_id: ctx.organization_id, archived_at: null, employment_status: { in: ['ACTIVE', 'ON_LEAVE'] }, ...scope, ...(dto.employee_ids?.length && { id: { in: dto.employee_ids } }), performance_reviews: { none: { cycle_id: id } } },
            include: { manager: { select: { membership_id: true } } },
        });
        const max = Number((cycle.template as any)?.rating_scale_max ?? 5);
        await this.prisma.$transaction([
            ...employees.map((e) => this.prisma.performanceReview.create({
                data: {
                    organization_id: ctx.organization_id, employee_id: e.id, cycle_id: id, reviewer_membership_id: e.manager?.membership_id ?? ctx.membership_id,
                    type: cycle.type, status: 'SELF_ASSESSMENT', title: cycle.name, period_start: cycle.period_start, period_end: cycle.period_end, due_date: cycle.due_date,
                    rating_scale_max: max, created_by_user_id: ctx.user_id,
                },
            })),
            this.prisma.performanceReviewCycle.update({ where: { id }, data: { status: 'ACTIVE' } }),
        ]);
        await this.audit.record(ctx, 'performance_cycle.launched', { resource_type: 'performance_cycle', resource_id: id, metadata: { reviews: employees.length } });
        for (const e of employees) {
            this.events.publish(ctx, {
                event_key: 'employees.review.assigned', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_review', entity_id: null,
                payload: { cycle_id: id, cycle: cycle.name, employee_id: e.id, owner_membership_id: e.membership_id, approver_membership_ids: e.manager?.membership_id ? [e.manager.membership_id] : [] },
            });
        }
        return { launched: employees.length };
    }

    // ================================================================ reviews

    async reviews(ctx: OrgContext, query: ReviewQuery) {
        const me = ctx.membership_id ?? '__none__';
        const where: Prisma.PerformanceReviewWhereInput = {
            organization_id: ctx.organization_id,
            AND: [this.reviewVisibility(ctx)],
            ...(query.cycle_id && { cycle_id: query.cycle_id }),
            ...(query.employee_id && { employee_id: query.employee_id }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.mine === 'employee' && { employee: { membership_id: me } }),
            ...(query.mine === 'reviewer' && { reviewer_membership_id: me }),
            ...(query.search && { employee: { OR: [{ preferred_name: { contains: query.search, mode: 'insensitive' } }, { membership: { user: { OR: [{ first_name: { contains: query.search, mode: 'insensitive' } }, { last_name: { contains: query.search, mode: 'insensitive' } }] } } }] } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.performanceReview.findMany({
                where, ...skipTake(query), orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
                include: { employee: { select: employeeSelect }, reviewer: { select: { id: true, user: { select: userSelect } } }, cycle: { select: { id: true, name: true } } },
            }),
            this.prisma.performanceReview.count({ where }),
        ]);
        return paginate(items.map((r) => this.shapeReview(ctx, r)), total, query);
    }

    async review(ctx: OrgContext, id: string) {
        const r = await this.prisma.performanceReview.findFirst({
            where: { id, organization_id: ctx.organization_id, AND: [this.reviewVisibility(ctx)] },
            include: {
                employee: { select: employeeSelect }, reviewer: { select: { id: true, user: { select: userSelect } } }, cycle: true,
                goals: { orderBy: { created_at: 'asc' } },
                feedback: { where: { deleted_at: null }, orderBy: { created_at: 'desc' }, include: { author: { select: { id: true, user: { select: userSelect } } } } },
            },
        });
        if (!r) throw new NotFoundException({ message: 'Review not found', code: 'review_not_found' });
        return this.shapeReview(ctx, r);
    }

    async createReview(ctx: OrgContext, dto: ReviewDto) {
        const e = await this.employeeFor(ctx, dto.employee_id, P.perfManage);
        if (dto.cycle_id) await this.cycle(ctx, dto.cycle_id);
        const manager = e.manager_employee_id ? await this.prisma.employee.findUnique({ where: { id: e.manager_employee_id }, select: { membership_id: true } }) : null;
        const row = await this.prisma.performanceReview.create({
            data: {
                ...(dates(dto, ['period_start', 'period_end', 'due_date']) as any), organization_id: ctx.organization_id, status: 'DRAFT',
                reviewer_membership_id: dto.reviewer_membership_id ?? manager?.membership_id ?? ctx.membership_id, created_by_user_id: ctx.user_id,
            },
        });
        await this.audit.record(ctx, 'performance_review.created', { resource_type: 'performance_review', resource_id: row.id, metadata: { employee_id: e.id } });
        return row;
    }

    /** Employee writes the self assessment / comment on their own review; the reviewer (performance.manage) writes the rest. */
    async updateReview(ctx: OrgContext, id: string, dto: UpdateReviewDto) {
        const r = await this.reviewRow(ctx, id);
        const own = this.access.isOwn(ctx, r.employee);
        const data: Record<string, unknown> = {};
        if (dto.self_assessment !== undefined) {
            if (!own) throw new ForbiddenException({ message: 'Only the employee writes the self assessment', code: 'not_self' });
            if (!['DRAFT', 'SELF_ASSESSMENT'].includes(r.status)) throw new ConflictException({ message: 'The self assessment is closed', code: 'review_locked' });
            data.self_assessment = dto.self_assessment;
        }
        if (dto.employee_comment !== undefined) {
            if (!own) throw new ForbiddenException({ message: 'Only the employee comments on the review', code: 'not_self' });
            data.employee_comment = dto.employee_comment;
        }
        const managerChanges = MANAGER_FIELDS.filter((f) => dto[f] !== undefined);
        if (managerChanges.length) {
            if (own || !(await this.canManageReview(ctx, r))) throw new ForbiddenException({ message: 'Only the reviewer can change these fields', code: 'not_reviewer' });
            if (!EDITABLE.includes(r.status)) throw new ConflictException({ message: 'The review is completed', code: 'review_locked' });
            for (const f of managerChanges) data[f] = (dates({ [f]: dto[f] } as any, ['due_date', 'next_review_date']) as any)[f];
            if (dto.ratings && dto.overall_rating === undefined) {
                const values = Object.values(dto.ratings).map(Number).filter((n) => !Number.isNaN(n));
                if (values.length) data.overall_rating = round2(values.reduce((s, n) => s + n, 0) / values.length);
            }
        }
        if (!Object.keys(data).length) throw new BadRequestException({ message: 'Nothing to change', code: 'no_changes' });
        const row = await this.prisma.performanceReview.update({ where: { id }, data: data as Prisma.PerformanceReviewUncheckedUpdateInput });
        await this.audit.record(ctx, 'performance_review.updated', { resource_type: 'performance_review', resource_id: id, metadata: { fields: Object.keys(data) } });
        return row;
    }

    async transition(ctx: OrgContext, id: string, action: 'submit-self' | 'submit' | 'complete' | 'acknowledge') {
        const r = await this.reviewRow(ctx, id);
        const own = this.access.isOwn(ctx, r.employee);
        const now = new Date();
        let data: Prisma.PerformanceReviewUncheckedUpdateInput;
        let notify: string | null = null;
        switch (action) {
            case 'submit-self':
                if (!own) throw new ForbiddenException({ message: 'Only the employee submits the self assessment', code: 'not_self' });
                if (!['DRAFT', 'SELF_ASSESSMENT'].includes(r.status)) throw new ConflictException({ message: 'Already submitted', code: 'review_wrong_status', status: r.status });
                if (!r.self_assessment?.trim()) throw new BadRequestException({ message: 'Write your self assessment first', code: 'self_assessment_required' });
                data = { status: 'MANAGER_ASSESSMENT', self_submitted_at: now };
                notify = r.reviewer_membership_id;
                break;
            case 'submit':
                if (own || !(await this.canManageReview(ctx, r))) throw new ForbiddenException({ message: 'Only the reviewer submits the review', code: 'not_reviewer' });
                if (!['DRAFT', 'SELF_ASSESSMENT', 'MANAGER_ASSESSMENT'].includes(r.status)) throw new ConflictException({ message: 'Already submitted', code: 'review_wrong_status', status: r.status });
                if (r.overall_rating === null || !r.manager_assessment?.trim()) throw new BadRequestException({ message: 'Add the assessment and an overall rating first', code: 'review_incomplete' });
                data = { status: 'SUBMITTED', manager_submitted_at: now };
                break;
            case 'complete':
                if (own || !(await this.canManageReview(ctx, r))) throw new ForbiddenException({ message: 'Only the reviewer completes the review', code: 'not_reviewer' });
                if (r.status !== 'SUBMITTED') throw new ConflictException({ message: 'Submit the review first', code: 'review_wrong_status', status: r.status });
                data = { status: 'COMPLETED', completed_at: now };
                notify = r.employee.membership_id;
                break;
            case 'acknowledge':
                if (!own) throw new ForbiddenException({ message: 'Only the employee acknowledges the review', code: 'not_self' });
                if (r.status !== 'COMPLETED') throw new ConflictException({ message: 'The review is not completed yet', code: 'review_wrong_status', status: r.status });
                data = { status: 'ACKNOWLEDGED', acknowledged_at: now };
                notify = r.reviewer_membership_id;
                break;
        }
        const row = await this.prisma.performanceReview.update({ where: { id }, data });
        await this.audit.record(ctx, `performance_review.${action.replace('-', '_')}`, { resource_type: 'performance_review', resource_id: id, metadata: { from: r.status, to: row.status } });
        this.events.publish(ctx, {
            event_key: 'employees.review.status_changed', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_review', entity_id: id,
            payload: { from: r.status, to: row.status, employee_id: r.employee_id, owner_membership_id: r.employee.membership_id, approver_membership_ids: notify && notify !== r.employee.membership_id ? [notify] : [], notify_membership_id: notify },
        });
        return row;
    }

    // ================================================================ goals

    async goals(ctx: OrgContext, query: GoalQuery) {
        const where: Prisma.PerformanceGoalWhereInput = {
            organization_id: ctx.organization_id,
            AND: [this.ownedVisibility(ctx)],
            ...(query.employee_id && { employee_id: query.employee_id }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.kind && { kind: query.kind }),
            ...(query.review_id && { review_id: query.review_id }),
            ...(query.search && { title: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.performanceGoal.findMany({
                where, ...skipTake(query), orderBy: [{ parent_goal_id: { sort: 'asc', nulls: 'first' } }, { due_date: 'asc' }],
                include: { employee: { select: employeeSelect }, updates: { orderBy: { created_at: 'desc' }, take: 3 }, project: { select: { id: true, name: true } }, _count: { select: { children: true } } },
            }),
            this.prisma.performanceGoal.count({ where }),
        ]);
        return paginate(items.map((g) => ({ ...g, employee: { ...g.employee, name: personName(g.employee) }, is_mine: this.access.isOwn(ctx, g.employee) })), total, query);
    }

    async createGoal(ctx: OrgContext, dto: GoalDto) {
        const e = await this.employeeFor(ctx, dto.employee_id, P.perfManage, ctx.can(P.perfReadOwn));
        if (dto.parent_goal_id && !(await this.prisma.performanceGoal.count({ where: { id: dto.parent_goal_id, employee_id: e.id } }))) throw new NotFoundException({ message: 'Parent goal not found', code: 'goal_not_found' });
        if (dto.project_id && !(await this.prisma.project.count({ where: { id: dto.project_id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        const row = await this.prisma.performanceGoal.create({
            data: { ...(dates(dto, ['start_date', 'due_date']) as any), kind: dto.kind ?? (dto.parent_goal_id ? 'KEY_RESULT' : 'GOAL'), organization_id: ctx.organization_id, created_by_membership_id: ctx.membership_id },
        });
        await this.audit.record(ctx, 'performance_goal.created', { resource_type: 'performance_goal', resource_id: row.id, metadata: { employee_id: e.id, title: row.title } });
        this.events.publish(ctx, { event_key: 'employees.goal.created', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_goal', entity_id: row.id, payload: { employee_id: e.id, owner_membership_id: e.membership_id, title: row.title } });
        return row;
    }

    async updateGoal(ctx: OrgContext, id: string, dto: UpdateGoalDto) {
        const g = await this.goalRow(ctx, id, true);
        const { employee_id: _e, ...rest } = dto;
        const row = await this.prisma.performanceGoal.update({
            where: { id },
            data: { ...(dates(defined(rest), ['start_date', 'due_date']) as any), ...(dto.status === 'ACHIEVED' && !g.completed_at && { completed_at: new Date(), progress_percent: 100 }) },
        });
        if (row.parent_goal_id) await this.rollUp(row.parent_goal_id);
        await this.audit.record(ctx, 'performance_goal.updated', { resource_type: 'performance_goal', resource_id: id, metadata: { after: rest } });
        return row;
    }

    async removeGoal(ctx: OrgContext, id: string) {
        const g = await this.goalRow(ctx, id, true);
        await this.prisma.performanceGoal.delete({ where: { id } });
        if (g.parent_goal_id) await this.rollUp(g.parent_goal_id);
        await this.audit.record(ctx, 'performance_goal.deleted', { resource_type: 'performance_goal', resource_id: id, metadata: { title: g.title } });
        return { success: true };
    }

    /** Check-in: progress / value / status with a note; parent objectives roll up by weight. */
    async addGoalUpdate(ctx: OrgContext, id: string, dto: GoalUpdateDto) {
        const g = await this.goalRow(ctx, id, true);
        let progress = dto.progress_percent;
        if (progress === undefined && dto.current_value !== undefined && g.target_value && num(g.target_value) !== 0) progress = Math.min(100, Math.max(0, round2((dto.current_value / num(g.target_value)) * 100)));
        const status = dto.status ?? (progress === 100 ? 'ACHIEVED' : g.status === 'NOT_STARTED' && progress ? 'IN_PROGRESS' : undefined);
        const [update] = await this.prisma.$transaction([
            this.prisma.performanceGoalUpdate.create({ data: { goal_id: id, author_membership_id: ctx.membership_id, progress_percent: progress, current_value: dto.current_value, status, note: dto.note } }),
            this.prisma.performanceGoal.update({
                where: { id },
                data: { ...(progress !== undefined && { progress_percent: progress }), ...(dto.current_value !== undefined && { current_value: dto.current_value }), ...(status && { status }), ...(status === 'ACHIEVED' && { completed_at: new Date() }) },
            }),
        ]);
        if (g.parent_goal_id) await this.rollUp(g.parent_goal_id);
        await this.audit.record(ctx, 'performance_goal.progress_updated', { resource_type: 'performance_goal', resource_id: id, metadata: { progress, status } });
        this.events.publish(ctx, { event_key: 'employees.goal.updated', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_goal', entity_id: id, payload: { employee_id: g.employee_id, owner_membership_id: g.employee.membership_id, progress_percent: progress ?? null, status: status ?? g.status } });
        return update;
    }

    // ================================================================ feedback

    async feedback(ctx: OrgContext, query: FeedbackQuery) {
        const me = ctx.membership_id ?? '__none__';
        const all = this.access.scopeWhere(ctx, P.perfReadAll);
        const where: Prisma.PerformanceFeedbackWhereInput = {
            organization_id: ctx.organization_id, deleted_at: null,
            OR: [
                ...(all ? [{ employee: all }] : []),
                { employee: { membership_id: me }, visibility: { in: ['EMPLOYEE_VISIBLE', 'PUBLIC'] } },
                { author_membership_id: me },
                { visibility: 'PUBLIC' },
            ],
            ...(query.employee_id && { employee_id: query.employee_id }),
            ...(query.kind && { kind: query.kind }),
        };
        const [items, total] = await Promise.all([
            this.prisma.performanceFeedback.findMany({ where, ...skipTake(query), orderBy: { created_at: 'desc' }, include: { employee: { select: employeeSelect }, author: { select: { id: true, user: { select: userSelect } } } } }),
            this.prisma.performanceFeedback.count({ where }),
        ]);
        return paginate(items.map((f) => ({
            ...f,
            employee: { ...f.employee, name: personName(f.employee) },
            author: f.is_anonymous && f.author_membership_id !== ctx.membership_id ? null : f.author,
            author_membership_id: f.is_anonymous && f.author_membership_id !== ctx.membership_id ? null : f.author_membership_id,
        })), total, query);
    }

    /** Manager notes need performance.manage; peer feedback, achievements and recognition can be given by any performance user (not about yourself). */
    async addFeedback(ctx: OrgContext, dto: FeedbackDto) {
        const managerKinds = ['MANAGER_FEEDBACK', 'PERFORMANCE_NOTE'];
        const e = managerKinds.includes(dto.kind)
            ? await this.employeeFor(ctx, dto.employee_id, P.perfManage)
            : await this.prisma.employee.findFirst({ where: { id: dto.employee_id, organization_id: ctx.organization_id } });
        if (!e) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        if (this.access.isOwn(ctx, e) && dto.kind !== 'EMPLOYEE_FEEDBACK') throw new ForbiddenException({ message: 'You cannot give this feedback about yourself', code: 'self_feedback' });
        const row = await this.prisma.performanceFeedback.create({
            data: {
                ...(dates(dto, ['occurred_on']) as any), organization_id: ctx.organization_id, author_membership_id: ctx.membership_id,
                visibility: dto.visibility ?? (dto.kind === 'RECOGNITION' ? 'PUBLIC' : managerKinds.includes(dto.kind) ? 'MANAGERS_ONLY' : 'EMPLOYEE_VISIBLE'),
            },
        });
        await this.audit.record(ctx, 'performance_feedback.created', { resource_type: 'performance_feedback', resource_id: row.id, metadata: { employee_id: e.id, kind: row.kind, visibility: row.visibility } });
        this.events.publish(ctx, {
            event_key: 'employees.feedback.created', module: ModuleKey.EMPLOYEES, entity_kind: 'performance_feedback', entity_id: row.id,
            payload: { employee_id: e.id, owner_membership_id: row.visibility === 'MANAGERS_ONLY' ? null : e.membership_id, kind: row.kind },
            activity: row.visibility === 'PUBLIC' ? { summary: `${row.kind === 'RECOGNITION' ? 'Recognized' : 'Feedback for'} ${personName(e as any)}`, entity_label: row.title ?? undefined } : undefined,
        });
        return row;
    }

    // ================================================================ helpers

    /** Reviews: in read_all scope, my own (read_own), or where I am the reviewer. */
    private reviewVisibility(ctx: OrgContext): Prisma.PerformanceReviewWhereInput {
        const me = ctx.membership_id ?? '__none__';
        const all = this.access.scopeWhere(ctx, P.perfReadAll);
        return { OR: [...(all ? [{ employee: all }] : []), ...(ctx.can(P.perfReadOwn) ? [{ employee: { membership_id: me }, status: { not: 'DRAFT' as const } }] : []), { reviewer_membership_id: me }] };
    }

    private ownedVisibility(ctx: OrgContext): Prisma.PerformanceGoalWhereInput {
        const me = ctx.membership_id ?? '__none__';
        const all = this.access.scopeWhere(ctx, P.perfReadAll);
        return { OR: [...(all ? [{ employee: all }] : []), ...(ctx.can(P.perfReadOwn) ? [{ employee: { membership_id: me }, employee_visible: true }] : []), { employee: { manager: { membership_id: me } } }] };
    }

    /** The employee sees the manager assessment only once the review is COMPLETED. */
    private shapeReview(ctx: OrgContext, r: any) {
        const own = this.access.isOwn(ctx, r.employee);
        const hidden = own && !['COMPLETED', 'ACKNOWLEDGED'].includes(r.status);
        const out = { ...r, employee: { ...r.employee, name: personName(r.employee) }, is_mine: own, is_reviewer: r.reviewer_membership_id === ctx.membership_id };
        if (hidden) for (const f of ['manager_assessment', 'ratings', 'overall_rating', 'strengths', 'improvement_areas', 'summary']) out[f] = null;
        if (out.feedback && own) out.feedback = out.feedback.filter((f: any) => f.visibility !== 'MANAGERS_ONLY');
        return out;
    }

    private async reviewRow(ctx: OrgContext, id: string) {
        const r = await this.prisma.performanceReview.findFirst({ where: { id, organization_id: ctx.organization_id, AND: [this.reviewVisibility(ctx)] }, include: { employee: true } });
        if (!r) throw new NotFoundException({ message: 'Review not found', code: 'review_not_found' });
        return r;
    }

    /** Reviewer of record, or performance.manage over the employee. */
    private async canManageReview(ctx: OrgContext, r: { reviewer_membership_id: string | null; employee_id: string }) {
        if (!ctx.can(P.perfManage)) return false;
        if (r.reviewer_membership_id === ctx.membership_id) return true;
        const scope = this.access.scopeWhere(ctx, P.perfManage);
        return !!scope && (await this.prisma.employee.count({ where: { id: r.employee_id, ...scope } })) > 0;
    }

    private async goalRow(ctx: OrgContext, id: string, forWrite: boolean) {
        const g = await this.prisma.performanceGoal.findFirst({ where: { id, organization_id: ctx.organization_id, AND: [this.ownedVisibility(ctx)] }, include: { employee: true } });
        if (!g) throw new NotFoundException({ message: 'Goal not found', code: 'goal_not_found' });
        if (forWrite && !this.access.isOwn(ctx, g.employee)) {
            const scope = this.access.scopeWhere(ctx, P.perfManage);
            const manager = await this.access.isManagerOf(ctx, g.employee_id);
            if (!manager && (!scope || !(await this.prisma.employee.count({ where: { id: g.employee_id, ...scope } })))) throw new ForbiddenException({ message: 'You cannot change this goal', code: 'forbidden' });
        }
        return g;
    }

    private async employeeFor(ctx: OrgContext, id: string, key: string, allowOwn = false): Promise<Employee> {
        const e = await this.prisma.employee.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!e) throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
        if (allowOwn && this.access.isOwn(ctx, e)) return e;
        const scope = this.access.scopeWhere(ctx, key);
        if (scope && (await this.prisma.employee.count({ where: { id, ...scope } }))) return e;
        if (key === P.perfManage && (await this.access.isManagerOf(ctx, id)) && ctx.can(P.perfManage)) return e;
        throw new NotFoundException({ message: 'Employee not found', code: 'employee_not_found' });
    }

    private async cycle(ctx: OrgContext, id: string) {
        const c = await this.prisma.performanceReviewCycle.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!c) throw new NotFoundException({ message: 'Review cycle not found', code: 'cycle_not_found' });
        return c;
    }

    /** Objective progress = weighted average of its key results (equal weights when none are set). */
    private async rollUp(parentId: string) {
        const children = await this.prisma.performanceGoal.findMany({ where: { parent_goal_id: parentId, status: { not: 'CANCELLED' } }, select: { progress_percent: true, weight_percent: true } });
        if (!children.length) return;
        const weights = children.map((c) => (c.weight_percent ? num(c.weight_percent) : 1));
        const sum = weights.reduce((s, w) => s + w, 0);
        const progress = round2(children.reduce((s, c, i) => s + num(c.progress_percent) * weights[i], 0) / sum);
        await this.prisma.performanceGoal.update({ where: { id: parentId }, data: { progress_percent: progress, ...(progress > 0 && { status: progress >= 100 ? 'ACHIEVED' : 'IN_PROGRESS' }) } });
    }
}

const DEFAULT_TEMPLATE = {
    rating_scale_max: 5,
    criteria: [
        { key: 'delivery', label: 'Delivery & quality' },
        { key: 'collaboration', label: 'Collaboration' },
        { key: 'ownership', label: 'Ownership' },
        { key: 'growth', label: 'Growth & learning' },
    ],
};
