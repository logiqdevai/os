import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { ProjectsService } from './services/projects.service';
import { ProjectItemsService } from './services/project-items.service';
import { ProjectTimelineService } from './services/project-timeline.service';
import { PortfolioTimelineQuerySchema, ProjectTimelineToolSchema } from './dto/project-timeline.schema';
import { ProjectGovernanceService } from './services/project-governance.service';
import { CloseProjectToolSchema, CreateGateToolSchema, CreateHandoverToolSchema, CreateReviewToolSchema, DecideGateToolSchema, ProjectIdSchema, UpdateChecklistItemToolSchema } from './dto/project-governance.schema';
import { CreateProjectSchema, UpdateProjectSchema } from './dto/create-project.dto';
import { LookupQuerySchema, MilestoneQuerySchema, ProjectQuerySchema, RaidQuerySchema } from './dto/project-query.schema';
import { CreateIssueSchema, CreateMilestoneSchema, CreateRiskSchema, CreateStatusUpdateSchema, UpdateMilestoneSchema } from './dto/project-items.dto';

const id = z.object({ id: z.string().uuid() });

/** MCP tools for 05 Projects — same service methods and validation as REST. */
@Injectable()
export class ProjectsMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly projects: ProjectsService,
        private readonly items: ProjectItemsService,
        private readonly timeline: ProjectTimelineService,
        private readonly governance: ProjectGovernanceService,
    ) { }

    onModuleInit() {
        const base = { module: ModuleKey.PROJECTS, resource_type: 'project' };
        this.registry.registerMany([
            { ...base, name: 'projects_projects_list', description: 'List projects in scope. Filters: search, status_category (PLANNED,IN_PROGRESS,…), health, owner_id ("me"), company_id, favorites.', permission: 'projects.projects.read', input: ProjectQuerySchema, handler: (ctx, a) => this.projects.findAll(ctx, a) },
            { ...base, name: 'projects_projects_lookup', description: 'Find projects by name or code (small picker result).', permission: 'projects.projects.read', input: LookupQuerySchema, handler: (ctx, a) => this.projects.lookup(ctx, a) },
            { ...base, name: 'projects_projects_get', description: 'Get one project with members, task/milestone counts, open risks and the latest status update.', permission: 'projects.projects.read', input: id, handler: (ctx, a) => this.projects.findOne(ctx, a.id) },
            { ...base, name: 'projects_projects_create', description: 'Create a project, optionally from a template (template_id) and for a customer (company_id).', permission: 'projects.projects.create', input: CreateProjectSchema, handler: (ctx, a) => this.projects.create(ctx, a) },
            {
                ...base, name: 'projects_projects_update', description: 'Update a project (name, status_id following allowed transitions, health, dates, owner, priority).', permission: 'projects.projects.update', input: UpdateProjectSchema,
                handler: (ctx, { id: projectId, ...dto }) => this.projects.update(ctx, projectId, dto),
            },
            { ...base, name: 'projects_projects_complete', description: 'Complete a project (blocking gates must be passed).', permission: 'projects.projects.complete', sensitive: true, input: id, handler: (ctx, a) => this.projects.complete(ctx, a.id) },
            { ...base, name: 'projects_portfolio_read', description: 'Portfolio summary: projects by status and health, at-risk projects, upcoming and overdue milestones, hours vs budget.', permission: 'projects.projects.read', input: z.object({}), handler: (ctx) => this.projects.portfolio(ctx) },
            { ...base, resource_type: 'project_milestone', name: 'projects_milestones_list', description: 'Milestones across projects (filters: project_id, status, overdue, billing, from, to).', permission: 'projects.projects.read', input: MilestoneQuerySchema, handler: (ctx, a) => this.projects.milestones(ctx, a) },
            {
                ...base, resource_type: 'project_milestone', name: 'projects_milestones_create', description: 'Add a milestone to a project.', permission: 'projects.milestones.manage', input: CreateMilestoneSchema,
                handler: (ctx, { project_id, ...dto }) => this.items.create(ctx, project_id, 'milestones', dto),
            },
            {
                ...base, resource_type: 'project_milestone', name: 'projects_milestones_update', description: 'Update a milestone (planned_date, status COMPLETED completes it).', permission: 'projects.milestones.manage', input: UpdateMilestoneSchema,
                handler: (ctx, { project_id, id: milestoneId, ...dto }) => this.items.update(ctx, project_id, 'milestones', milestoneId, dto),
            },
            { ...base, name: 'projects_timeline_read', description: 'Portfolio timeline: projects in scope with planned_start/target_completion, milestones, workstreams and dependencies (filters: search, company_id, owner_id, include_closed).', permission: 'projects.projects.read', input: PortfolioTimelineQuerySchema, handler: (ctx, a) => this.timeline.portfolio(ctx, a) },
            {
                ...base, name: 'projects_project_timeline_read', description: 'One project timeline: workstreams, milestones, dated tasks, task and project dependencies, unscheduled tasks.', permission: 'projects.projects.read', input: ProjectTimelineToolSchema,
                handler: (ctx, { project_id, ...q }) => this.timeline.project(ctx, project_id, q),
            },
            { ...base, resource_type: 'project_gate', name: 'projects_gates_list', description: 'Approval and quality gates of a project (status PENDING/PASSED/FAILED/WAIVED, blocks_completion, approver).', permission: 'projects.projects.read', input: ProjectIdSchema, handler: (ctx, a) => this.governance.listGates(ctx, a.project_id) },
            {
                ...base, resource_type: 'project_gate', name: 'projects_gates_create', description: 'Add an APPROVAL or QUALITY gate; blocks_completion=true stops completion until it is passed or waived.', permission: 'projects.projects.update', input: CreateGateToolSchema,
                handler: (ctx, { project_id, ...dto }) => this.governance.createGate(ctx, project_id, dto),
            },
            {
                ...base, resource_type: 'project_gate', name: 'projects_gates_decide', description: 'Pass, fail or waive a gate (FAILED / WAIVED need a comment).', permission: 'projects.gates.decide', sensitive: true, input: DecideGateToolSchema,
                handler: (ctx, { project_id, id, ...dto }) => this.governance.decideGate(ctx, project_id, id, dto),
            },
            { ...base, resource_type: 'project_review', name: 'projects_reviews_list', description: 'Reviews and retrospectives of a project with their actions.', permission: 'projects.projects.read', input: ProjectIdSchema, handler: (ctx, a) => this.governance.listReviews(ctx, a.project_id) },
            {
                ...base, resource_type: 'project_review', name: 'projects_reviews_create', description: 'Record a review or retrospective (type KICKOFF, MILESTONE, DELIVERY, QUALITY, CUSTOMER, POST_PROJECT, RETROSPECTIVE) with findings, lessons and actions.', permission: 'projects.projects.update', input: CreateReviewToolSchema,
                handler: (ctx, { project_id, ...dto }) => this.governance.createReview(ctx, project_id, dto),
            },
            { ...base, resource_type: 'project_checklist', name: 'projects_checklists_list', description: 'Phase checklists (kickoff … closeout) with items; required open items block completion.', permission: 'projects.projects.read', input: ProjectIdSchema, handler: (ctx, a) => this.governance.listChecklists(ctx, a.project_id) },
            {
                ...base, resource_type: 'project_checklist_item', name: 'projects_checklist_items_update', description: 'Tick or untick a checklist item (is_completed) or edit it.', permission: 'projects.projects.update', input: UpdateChecklistItemToolSchema,
                handler: (ctx, { project_id, checklist_id, id, ...dto }) => this.governance.updateItem(ctx, project_id, checklist_id, id, dto),
            },
            {
                ...base, resource_type: 'project_handover', name: 'projects_handovers_create', description: 'Plan a handover (e.g. delivery_to_support) to a team and/or new owner, with a checklist and notes.', permission: 'projects.projects.update', input: CreateHandoverToolSchema,
                handler: (ctx, { project_id, ...dto }) => this.governance.createHandover(ctx, project_id, dto),
            },
            { ...base, resource_type: 'project_closeout', name: 'projects_closeout_read', description: 'Closeout record and completion requirements (which gates / required checklist items still block completion).', permission: 'projects.projects.read', input: ProjectIdSchema, handler: (ctx, a) => this.governance.closeout(ctx, a.project_id) },
            {
                ...base, resource_type: 'project_closeout', name: 'projects_closeout_close', description: 'Save the closeout record (summary, lessons, outcome) and complete the project.', permission: 'projects.projects.complete', sensitive: true, input: CloseProjectToolSchema,
                handler: (ctx, { project_id, ...dto }) => this.governance.close(ctx, project_id, dto),
            },
            { ...base, resource_type: 'project_risk', name: 'projects_raid_list', description: 'RAID log across projects: kind=risks|issues|decisions|dependencies, open=true for open items.', permission: 'projects.projects.read', input: RaidQuerySchema, handler: (ctx, a) => this.projects.raid(ctx, a) },
            {
                ...base, resource_type: 'project_risk', name: 'projects_risks_create', description: 'Log a project risk (probability and impact 1–5 derive the severity).', permission: 'projects.risks.manage', input: CreateRiskSchema,
                handler: (ctx, { project_id, ...dto }) => this.items.create(ctx, project_id, 'risks', dto),
            },
            {
                ...base, resource_type: 'project_issue', name: 'projects_issues_create', description: 'Log a project issue or blocker (kind=BLOCKER).', permission: 'projects.issues.manage', input: CreateIssueSchema,
                handler: (ctx, { project_id, ...dto }) => this.items.create(ctx, project_id, 'issues', dto),
            },
            {
                ...base, resource_type: 'project_status_update', name: 'projects_status_updates_publish', description: 'Write a project status update (publish=true publishes it and sets the project health/progress).', permission: 'projects.status_updates.publish', input: CreateStatusUpdateSchema,
                handler: (ctx, { project_id, ...dto }) => this.items.create(ctx, project_id, 'status-updates', dto),
            },
        ]);
    }
}
