import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Employee, ModuleKey, RecordEntityType, WikiChecklistKind, WikiChecklistRunStatus, WikiChecklistTrigger } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { DocsChecklistsService } from '@/modules/docs/services/checklists.service';
import { PeopleAccessService } from '../common/people-access.service';
import { P, personName } from '../common/people.utils';

/**
 * Onboarding / offboarding checklists of an employee. The checklist definitions, runs and item state belong to
 * 15 Business Docs (WikiChecklist / WikiChecklistRun); People only picks the matching checklists, starts runs for the
 * employee (on hire, on offboarding, or manually) through DocsChecklistsService and shows the progress on the profile.
 */
@Injectable()
export class EmployeeChecklistsService {
    private readonly logger = new Logger(EmployeeChecklistsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: PeopleAccessService,
        private readonly checklists: DocsChecklistsService,
    ) { }

    /** Runs of the employee (own record: employees.directory.read is enough) with item counts and progress. */
    async list(ctx: OrgContext, employeeId: string) {
        const e = await this.access.employeeOrThrow(ctx, employeeId, P.read, P.directoryRead);
        const runs = await this.prisma.wikiChecklistRun.findMany({
            where: { organization_id: ctx.organization_id, OR: [{ employee_id: e.id }, { subject_membership_id: e.membership_id }] },
            orderBy: { created_at: 'desc' },
            include: {
                checklist: { select: { id: true, name: true, kind: true, description: true } },
                items: {
                    select: {
                        id: true, status: true, completed_at: true, skipped_reason: true, task_id: true,
                        checklist_item: { select: { id: true, title: true, description: true, is_required: true, sort_order: true, due_offset_days: true, assignee_kind: true, assignee_membership_id: true, page_id: true, form_id: true } },
                    },
                },
            },
        });
        const me = ctx.membership_id;
        return runs.map((r) => {
            const items = [...r.items].sort((a, b) => a.checklist_item.sort_order - b.checklist_item.sort_order).map((i) => {
                const due = r.started_at && i.checklist_item.due_offset_days != null ? new Date(r.started_at.getTime() + i.checklist_item.due_offset_days * 86_400_000) : null;
                return {
                    ...i,
                    due_on: due,
                    overdue: !!due && due < new Date() && i.status !== 'COMPLETED' && i.status !== 'SKIPPED',
                    // Same rule the Docs service enforces on complete / reopen.
                    can_complete: ctx.can('docs.checklists.manage') || r.subject_membership_id === me || (!!me && i.checklist_item.assignee_membership_id === me),
                };
            });
            return {
                id: r.id, status: r.status, triggered_by: r.triggered_by, progress_percent: r.progress_percent, started_at: r.started_at, due_at: r.due_at, completed_at: r.completed_at, cancelled_at: r.cancelled_at,
                checklist: r.checklist,
                done_count: items.filter((i) => i.status === 'COMPLETED' || i.status === 'SKIPPED').length,
                total_count: items.length,
                overdue_count: items.filter((i) => i.overdue).length,
                items,
            };
        });
    }

    /** Active checklists of a kind that can be started (picker). */
    async available(ctx: OrgContext, kind: WikiChecklistKind) {
        return this.prisma.wikiChecklist.findMany({
            where: { organization_id: ctx.organization_id, kind, is_active: true, archived_at: null, items: { some: {} } },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, description: true, kind: true, department_id: true, role_id: true, branch_id: true, auto_assign: true, _count: { select: { items: true } } },
        });
    }

    /** Start a checklist for the employee. Onboarding needs employees.employees.update, offboarding employees.employees.offboard. */
    async start(ctx: OrgContext, employeeId: string, dto: { checklist_id: string; due_at?: string }) {
        const checklist = await this.prisma.wikiChecklist.findFirst({ where: { id: dto.checklist_id, organization_id: ctx.organization_id }, select: { id: true, kind: true, name: true } });
        if (!checklist) throw new NotFoundException({ message: 'Checklist not found', code: 'wiki_checklist_not_found' });
        const key = checklist.kind === WikiChecklistKind.OFFBOARDING ? P.offboard : P.update;
        if (!ctx.can(key)) throw new ForbiddenException({ message: `You need ${key} to start this checklist`, code: 'permission_denied', permissions: [key] });
        const e = await this.access.employeeOrThrow(ctx, employeeId, key);
        const trigger = checklist.kind === WikiChecklistKind.OFFBOARDING ? WikiChecklistTrigger.MEMBER_OFFBOARDING : WikiChecklistTrigger.MEMBER_ONBOARDING;
        const run = await this.checklists.startRun(ctx, checklist.id, { subject_membership_id: e.membership_id, due_at: dto.due_at }, trigger, e.id);
        await this.audit.record(ctx, checklist.kind === WikiChecklistKind.OFFBOARDING ? 'employee.offboarding_checklist_started' : 'employee.onboarding_checklist_started', {
            resource_type: 'employee', resource_id: e.id, branch_id: e.primary_branch_id, metadata: { checklist_id: checklist.id, run_id: run.id },
        });
        this.publish(ctx, e, checklist, run.id);
        return run;
    }

    /** Complete / reopen an item from the profile; the Docs service decides who may (manager of checklists, subject, assignee). */
    async setItem(ctx: OrgContext, employeeId: string, runId: string, itemId: string, done: boolean) {
        const e = await this.access.employeeOrThrow(ctx, employeeId, P.read, P.directoryRead);
        const run = await this.prisma.wikiChecklistRun.findFirst({ where: { id: runId, organization_id: ctx.organization_id, OR: [{ employee_id: e.id }, { subject_membership_id: e.membership_id }] }, select: { id: true } });
        if (!run) throw new NotFoundException({ message: 'Run not found', code: 'wiki_checklist_run_not_found' });
        if (done) await this.checklists.completeItem(ctx, runId, itemId);
        else await this.checklists.reopenItem(ctx, runId, itemId);
        return (await this.list(ctx, employeeId)).find((r) => r.id === runId);
    }

    /**
     * Auto-start on hire / offboarding: every active auto_assign checklist of the kind whose department, branch and role
     * filters match the employee. Failures are logged, never block the HR action.
     */
    async autoStart(ctx: OrgContext, employee: Employee, kind: WikiChecklistKind) {
        try {
            const roleIds = (await this.prisma.roleAssignment.findMany({ where: { membership_id: employee.membership_id }, select: { role_id: true } })).map((r) => r.role_id);
            const candidates = await this.prisma.wikiChecklist.findMany({
                where: {
                    organization_id: employee.organization_id, kind, is_active: true, auto_assign: true, archived_at: null, items: { some: {} },
                    AND: [
                        { OR: [{ department_id: null }, ...(employee.department_team_id ? [{ department_id: employee.department_team_id }] : [])] },
                        { OR: [{ branch_id: null }, ...(employee.primary_branch_id ? [{ branch_id: employee.primary_branch_id }] : [])] },
                        { OR: [{ role_id: null }, ...(roleIds.length ? [{ role_id: { in: roleIds } }] : [])] },
                    ],
                    runs: { none: { subject_membership_id: employee.membership_id, status: { in: [WikiChecklistRunStatus.NOT_STARTED, WikiChecklistRunStatus.IN_PROGRESS] } } },
                },
                select: { id: true, kind: true, name: true },
            });
            const trigger = kind === WikiChecklistKind.OFFBOARDING ? WikiChecklistTrigger.MEMBER_OFFBOARDING : WikiChecklistTrigger.MEMBER_ONBOARDING;
            for (const c of candidates) {
                const run = await this.checklists.startRun(ctx, c.id, { subject_membership_id: employee.membership_id }, trigger, employee.id);
                this.publish(ctx, employee, c, run.id);
            }
            return candidates.length;
        } catch (error) {
            this.logger.warn(`Auto-start of ${kind} checklists failed for employee ${employee.id}: ${(error as Error).message}`);
            return 0;
        }
    }

    private publish(ctx: OrgContext, e: Employee, checklist: { id: string; kind: WikiChecklistKind; name: string }, runId: string) {
        this.events.publish(ctx, {
            event_key: checklist.kind === WikiChecklistKind.OFFBOARDING ? 'employees.offboarding.checklist_started' : 'employees.onboarding.checklist_started',
            module: ModuleKey.EMPLOYEES, entity_type: RecordEntityType.EMPLOYEE, entity_id: e.id,
            payload: { checklist_id: checklist.id, run_id: runId, owner_membership_id: e.membership_id, link: `/people/employees/${e.id}?tab=onboarding` },
            activity: { summary: `Started the ${checklist.kind === WikiChecklistKind.OFFBOARDING ? 'offboarding' : 'onboarding'} checklist ${checklist.name}`, entity_label: personName(e as any), branch_id: e.primary_branch_id },
        });
    }

    static assertKind(kind: string): WikiChecklistKind {
        if (kind !== 'ONBOARDING' && kind !== 'OFFBOARDING') throw new BadRequestException({ message: 'kind must be ONBOARDING or OFFBOARDING', code: 'invalid_kind' });
        return kind;
    }
}
