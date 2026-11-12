import { Injectable } from '@nestjs/common';
import { ModuleKey, Prisma, ProjectHealth, RecordEntityType, TaskStatusCategory } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { OrgAiService } from '@/integrations/ai/services/org-ai.service';
import { TasksService } from '@/modules/tasks/services/tasks.service';
import { taskIdentifier } from '@/modules/tasks/utils/task-number.utils';
import { addDays, startOfDay, toDate } from '../utils/projects.utils';
import { ProjectsService } from './projects.service';

export const DraftStatusUpdateSchema = z.object({
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type DraftStatusUpdateInput = z.infer<typeof DraftStatusUpdateSchema>;
export const DraftStatusUpdateToolSchema = DraftStatusUpdateSchema.extend({ project_id: z.string().uuid() });

const OPEN_TASK: Prisma.TaskWhereInput = { OR: [{ status_id: null }, { status: { category: { notIn: [TaskStatusCategory.DONE, TaskStatusCategory.CANCELLED] } } }] };
const FIELDS = ['summary', 'completed_work', 'current_work', 'upcoming_work', 'risks_summary', 'blockers_summary', 'decisions_summary', 'required_actions'] as const;
type DraftFields = Record<(typeof FIELDS)[number], string> & { health: ProjectHealth };

const bullets = (rows: string[], empty = '') => (rows.length ? rows.map((r) => `- ${r}`).join('\n') : empty);
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : 'no date');

/**
 * 05 §39–40 — AI draft of a project status update from facts (completed and current tasks, milestone changes, open
 * risks, blockers, decisions, approved changes). Runs on the organization's own OpenAI key (BYOK) through OrgAiService.
 * The draft is ALWAYS unpublished (is_ai_generated = true) until a human edits and publishes it. Without an AI
 * connection nothing is written: the facts and a fact-based starting point come back with a clear message.
 */
@Injectable()
export class ProjectAiService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly projects: ProjectsService,
        private readonly tasks: TasksService,
        private readonly ai: OrgAiService,
    ) { }

    async draftStatusUpdate(ctx: OrgContext, projectId: string, dto: DraftStatusUpdateInput) {
        const project = await this.projects.assertAccess(ctx, projectId, 'projects.status_updates.publish');
        const facts = await this.facts(ctx, projectId, dto);
        const fallback = this.fallback(facts);

        const result = await this.ai.generateText(ctx.organization_id, {
            system: [
                'You write weekly project status updates for a software agency. Use only the facts given; never invent work, dates or numbers.',
                'Be concise and specific: short sentences or "- " bullet lists, plain language a customer understands.',
                'Respond with ONLY a JSON object with these string keys: summary (2-3 sentences), completed_work, current_work, upcoming_work,',
                'risks_summary, blockers_summary, decisions_summary, required_actions (what is needed from the customer or stakeholders; empty string if nothing),',
                'and health: one of HEALTHY, AT_RISK, BLOCKED, CRITICAL.',
            ].join(' '),
            prompt: `Project: ${project.name}\nPeriod: ${facts.period.start} to ${facts.period.end}\nSuggested health from rules: ${facts.suggested_health}\n\nFacts (JSON):\n${JSON.stringify(facts.prompt_facts, null, 1)}`,
            temperature: 0.2,
            maxTokens: 1200,
        });
        if (result.available === false) {
            return { available: false as const, reason: result.reason, message: result.message, facts: facts.summary, fallback };
        }
        const fields = this.parse(result.text, fallback);
        const draft = await this.prisma.projectStatusUpdate.create({
            data: {
                project_id: projectId,
                period_start: toDate(facts.period.start) as Date,
                period_end: toDate(facts.period.end) as Date,
                ...Object.fromEntries(FIELDS.map((k) => [k, fields[k] || null])),
                summary: fields.summary || fallback.summary,
                health: fields.health,
                progress_percent: facts.progress_percent,
                author_membership_id: ctx.membership_id,
                customer_visible: false,
                is_ai_generated: true,
            },
        });
        await this.audit.record(ctx, 'project_status_update.ai_drafted', {
            resource_type: 'project_status_update', resource_id: draft.id, branch_id: project.branch_id,
            metadata: { project_id: projectId, model: result.model, input_tokens: result.input_tokens, output_tokens: result.output_tokens, cost: result.cost, period: facts.period },
        });
        // No activity entry: an unpublished draft is not news.
        this.events.publish(ctx, { event_key: 'projects.status_update.drafted', module: ModuleKey.PROJECTS, entity_type: RecordEntityType.PROJECT, entity_id: projectId, payload: { project_id: projectId, status_update_id: draft.id, is_ai_generated: true } });
        return { available: true as const, draft, model: result.model, facts: facts.summary, fallback };
    }

    private parse(text: string, fallback: DraftFields): DraftFields {
        try {
            const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Record<string, unknown>;
            const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 10_000) : Array.isArray(v) ? bullets(v.map(String)) : '');
            const health = (Object.values(ProjectHealth) as string[]).includes(String(json.health)) && json.health !== 'UNKNOWN' ? (json.health as ProjectHealth) : fallback.health;
            return { ...(Object.fromEntries(FIELDS.map((k) => [k, str(json[k])])) as Record<(typeof FIELDS)[number], string>), health };
        } catch {
            return { ...fallback, summary: text.trim().slice(0, 4000) };
        }
    }

    /** A deterministic draft from the facts — the starting point when no AI provider is connected. */
    private fallback(f: Awaited<ReturnType<ProjectAiService['facts']>>): DraftFields {
        const s = f.summary;
        return {
            summary: `${s.completed_tasks} task${s.completed_tasks === 1 ? '' : 's'} completed and ${s.milestones_completed} milestone${s.milestones_completed === 1 ? '' : 's'} reached between ${f.period.start} and ${f.period.end}.${s.open_blockers ? ` ${s.open_blockers} open blocker${s.open_blockers === 1 ? '' : 's'}.` : ''}`,
            completed_work: bullets([...f.prompt_facts.milestones_completed.map((m) => `Milestone reached: ${m.name}`), ...f.prompt_facts.completed_tasks.map((t) => t.title)]),
            current_work: bullets(f.prompt_facts.in_progress_tasks.map((t) => t.title)),
            upcoming_work: bullets([...f.prompt_facts.upcoming_milestones.map((m) => `${m.name} (${m.planned_date})`), ...f.prompt_facts.upcoming_tasks.map((t) => `${t.title} (due ${t.due_date})`)]),
            risks_summary: bullets(f.prompt_facts.open_risks.map((r) => `${r.title} — ${r.severity.toLowerCase()}${r.mitigation ? `; mitigation: ${r.mitigation}` : ''}`)),
            blockers_summary: bullets(f.prompt_facts.open_issues.filter((i) => i.kind === 'BLOCKER').map((i) => i.title)),
            decisions_summary: bullets(f.prompt_facts.decisions.map((d) => d.title)),
            required_actions: '',
            health: f.suggested_health,
        };
    }

    private async facts(ctx: OrgContext, projectId: string, dto: DraftStatusUpdateInput) {
        const today = startOfDay();
        const last = await this.prisma.projectStatusUpdate.findFirst({ where: { project_id: projectId, published_at: { not: null } }, orderBy: { published_at: 'desc' }, select: { period_end: true, published_at: true } });
        const start = dto.period_start ? (toDate(dto.period_start) as Date) : last?.period_end ? addDays(last.period_end, 1) : last?.published_at ? startOfDay(last.published_at) : addDays(today, -7);
        const end = dto.period_end ? (toDate(dto.period_end) as Date) : today;
        const endExcl = addDays(end, 1);
        const canTasks = ctx.can('tasks.tasks.read');
        const taskWhere = (extra: Prisma.TaskWhereInput): Prisma.TaskWhereInput => ({ AND: [{ organization_id: ctx.organization_id, project_id: projectId, archived_at: null, is_template: false }, this.tasks.scopeWhere(ctx), extra] });
        const taskSelect = { number: true, title: true, due_date: true, team: { select: { task_key: true } } } satisfies Prisma.TaskSelect;
        const none = Promise.resolve([] as Prisma.TaskGetPayload<{ select: typeof taskSelect }>[]);
        const [completed, inProgress, upcoming, totals, done, msDone, msUpcoming, msOverdue, risks, issues, decisions, changes] = await Promise.all([
            canTasks ? this.prisma.task.findMany({ where: taskWhere({ completed_at: { gte: start, lt: endExcl } }), take: 40, orderBy: { completed_at: 'asc' }, select: taskSelect }) : none,
            canTasks ? this.prisma.task.findMany({ where: taskWhere({ status: { category: { in: [TaskStatusCategory.IN_PROGRESS, TaskStatusCategory.IN_REVIEW] } } }), take: 25, select: taskSelect }) : none,
            canTasks ? this.prisma.task.findMany({ where: taskWhere({ AND: [OPEN_TASK, { due_date: { gte: endExcl, lte: addDays(end, 14) } }] }), take: 25, orderBy: { due_date: 'asc' }, select: taskSelect }) : none,
            this.prisma.task.count({ where: { project_id: projectId, archived_at: null, is_template: false, OR: [{ status_id: null }, { status: { category: { not: TaskStatusCategory.CANCELLED } } }] } }),
            this.prisma.task.count({ where: { project_id: projectId, archived_at: null, is_template: false, status: { category: TaskStatusCategory.DONE } } }),
            this.prisma.projectMilestone.findMany({ where: { project_id: projectId, completed_at: { gte: start, lt: endExcl } }, select: { name: true, completed_at: true } }),
            this.prisma.projectMilestone.findMany({ where: { project_id: projectId, status: { in: ['PLANNED', 'IN_PROGRESS', 'AT_RISK'] }, planned_date: { gte: today, lte: addDays(today, 30) } }, orderBy: { planned_date: 'asc' }, select: { name: true, planned_date: true, status: true } }),
            this.prisma.projectMilestone.findMany({ where: { project_id: projectId, status: { in: ['PLANNED', 'IN_PROGRESS', 'AT_RISK'] }, planned_date: { lt: today } }, select: { name: true, planned_date: true } }),
            this.prisma.projectRisk.findMany({ where: { project_id: projectId, status: { in: ['OPEN', 'MONITORING'] } }, orderBy: { severity: 'desc' }, take: 15, select: { title: true, severity: true, mitigation: true } }),
            this.prisma.projectIssue.findMany({ where: { project_id: projectId, status: { in: ['OPEN', 'IN_PROGRESS'] } }, take: 15, select: { title: true, kind: true, severity: true } }),
            this.prisma.projectDecision.findMany({ where: { project_id: projectId, decided_at: { gte: start, lt: endExcl } }, take: 15, select: { title: true, decided_at: true } }),
            this.prisma.projectChangeRequest.findMany({ where: { project_id: projectId, approved_at: { gte: start, lt: endExcl } }, take: 10, select: { number: true, title: true, timeline_impact_days: true } }),
        ]);
        const blockers = issues.filter((i) => i.kind === 'BLOCKER').length;
        const severeRisks = risks.filter((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH').length;
        const suggested: ProjectHealth = blockers ? ProjectHealth.BLOCKED : msOverdue.length || risks.some((r) => r.severity === 'CRITICAL') ? ProjectHealth.AT_RISK : severeRisks > 2 ? ProjectHealth.AT_RISK : ProjectHealth.HEALTHY;
        const t = (rows: typeof completed) => rows.map((r) => ({ id: taskIdentifier(r), title: r.title, due_date: day(r.due_date) }));
        return {
            period: { start: day(start), end: day(end) },
            progress_percent: totals ? Math.round((done / totals) * 100) : null,
            suggested_health: suggested,
            summary: {
                completed_tasks: completed.length, in_progress_tasks: inProgress.length, upcoming_tasks: upcoming.length, milestones_completed: msDone.length,
                milestones_upcoming: msUpcoming.length, milestones_overdue: msOverdue.length, open_risks: risks.length, high_risks: severeRisks, open_issues: issues.length - blockers,
                open_blockers: blockers, decisions: decisions.length, approved_changes: changes.length, tasks_included: canTasks,
            },
            prompt_facts: {
                completed_tasks: t(completed),
                in_progress_tasks: t(inProgress),
                upcoming_tasks: t(upcoming),
                milestones_completed: msDone.map((m) => ({ name: m.name, completed_at: day(m.completed_at) })),
                upcoming_milestones: msUpcoming.map((m) => ({ name: m.name, planned_date: day(m.planned_date), status: m.status })),
                overdue_milestones: msOverdue.map((m) => ({ name: m.name, planned_date: day(m.planned_date) })),
                open_risks: risks.map((r) => ({ title: r.title, severity: r.severity, mitigation: r.mitigation })),
                open_issues: issues.map((i) => ({ title: i.title, kind: i.kind, severity: i.severity })),
                decisions: decisions.map((d) => ({ title: d.title, decided_at: day(d.decided_at) })),
                approved_changes: changes.map((c) => ({ title: `CR-${c.number} ${c.title}`, timeline_impact_days: c.timeline_impact_days })),
                progress_percent: totals ? Math.round((done / totals) * 100) : null,
            },
        };
    }
}
