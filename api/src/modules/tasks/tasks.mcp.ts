import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { TasksService } from './services/tasks.service';
import { TaskDetailsService } from './services/task-details.service';
import { CyclesService } from './services/cycles.service';
import { TaskConfigService } from './services/task-config.service';
import { AssignTaskSchema, BulkTaskSchema, CommentTaskSchema, CreateTaskSchema, UpdateTaskSchema } from './dto/create-task.dto';
import { CycleQuerySchema, TaskLookupSchema, TaskQuerySchema, TaskWorkloadSchema } from './dto/task-query.schema';

const key = z.object({ id: z.string().min(1).describe('Task uuid or identifier such as WEB-142') });

/** MCP tools for 06 Tasks — same service methods and validation as REST. */
@Injectable()
export class TasksMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly tasks: TasksService,
        private readonly details: TaskDetailsService,
        private readonly cycles: CyclesService,
        private readonly config: TaskConfigService,
    ) { }

    onModuleInit() {
        const base = { module: ModuleKey.TASKS, resource_type: 'task' };
        this.registry.registerMany([
            { ...base, name: 'tasks_tasks_list', description: 'List tasks. Filters: mine, assignee (uuid|me|none), status_category (BACKLOG,TODO,IN_PROGRESS,IN_REVIEW,DONE), project_id, team_id, cycle_id, label_id, priority, due (overdue|today|week), open, search.', permission: 'tasks.tasks.read', input: TaskQuerySchema, handler: (ctx, a) => this.tasks.findAll(ctx, a) },
            { ...base, name: 'tasks_tasks_lookup', description: 'Find tasks by identifier or title (small picker result).', permission: 'tasks.tasks.read', input: TaskLookupSchema, handler: (ctx, a) => this.tasks.lookup(ctx, a) },
            { ...base, name: 'tasks_tasks_get', description: 'Get one task by uuid or identifier (WEB-142) with sub-tasks, checklist, links and allowed statuses.', permission: 'tasks.tasks.read', input: key, handler: (ctx, a) => this.tasks.findOne(ctx, a.id) },
            { ...base, name: 'tasks_tasks_create', description: 'Create a task. team_id gives the identifier prefix and workflow; status defaults to the workflow default.', permission: 'tasks.tasks.create', input: CreateTaskSchema, handler: (ctx, a) => this.tasks.create(ctx, a) },
            {
                ...base, name: 'tasks_tasks_update', description: 'Update a task: title, description, status_id (must be allowed by the workflow), priority, due_date, estimate, project, cycle, labels.', permission: 'tasks.tasks.update', input: UpdateTaskSchema,
                handler: (ctx, { id, ...dto }) => this.tasks.update(ctx, id, dto),
            },
            { ...base, name: 'tasks_tasks_assign', description: 'Assign a task to a member (or null to unassign).', permission: 'tasks.tasks.assign', input: AssignTaskSchema, handler: (ctx, a) => this.tasks.assign(ctx, a.id, { assignee_membership_id: a.assignee_membership_id }) },
            {
                ...base, name: 'tasks_comments_create', description: 'Comment on a task (visibility INTERNAL or CUSTOMER_VISIBLE; mentions are membership ids).', permission: 'tasks.tasks.update', input: CommentTaskSchema,
                handler: (ctx, { id, ...dto }) => this.details.createComment(ctx, id, dto),
            },
            { ...base, name: 'tasks_tasks_delete', description: 'Delete a task permanently.', permission: 'tasks.tasks.delete', sensitive: true, input: key, handler: (ctx, a) => this.tasks.remove(ctx, a.id) },
            { ...base, name: 'tasks_bulk_execute', description: 'Bulk change status/priority/assignee/cycle/project/due date, add or remove labels, archive or delete up to 200 tasks.', permission: 'tasks.bulk.execute', sensitive: true, input: BulkTaskSchema, handler: (ctx, a) => this.tasks.bulk(ctx, a) },
            { ...base, name: 'tasks_workload_read', description: 'Open tasks per person: in progress, overdue, blocked, points, due this week.', permission: 'tasks.workload.read', input: TaskWorkloadSchema, handler: (ctx, a) => this.tasks.workload(ctx, a) },
            { ...base, resource_type: 'cycle', name: 'tasks_cycles_list', description: 'List cycles (sprints) with progress.', permission: 'tasks.tasks.read', input: CycleQuerySchema, handler: (ctx, a) => this.cycles.list(ctx, a) },
            { ...base, resource_type: 'task_status', name: 'tasks_workflows_read', description: 'Statuses of every team workflow (use the ids for status_id).', permission: 'tasks.tasks.read', input: z.object({}), handler: (ctx) => this.config.workflows(ctx) },
        ]);
    }
}
