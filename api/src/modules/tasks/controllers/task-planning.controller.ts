import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { boolish } from '@/shared/utils/pagination/pagination.utils';
import { TaskConfigService } from '../services/task-config.service';
import { CyclesService } from '../services/cycles.service';
import { ReleasesService } from '../services/releases.service';
import {
    ArchiveTaskStatusDto,
    CompleteCycleDto,
    CreateCycleDto,
    CreateDeploymentDto,
    CreateReleaseDto,
    CreateTaskLabelDto,
    CreateTaskStatusDto,
    CreateTaskTypeDto,
    ReleaseTasksDto,
    ReorderStatusesDto,
    UpdateCycleDto,
    UpdateReleaseDto,
    UpdateTaskLabelDto,
    UpdateTaskStatusDto,
    UpdateTaskTypeDto,
} from '../dto/task-config.dto';
import { CycleQuery, CycleQuerySchema, ReleaseQuery, ReleaseQuerySchema, StatusQuery, StatusQuerySchema } from '../dto/task-query.schema';

const ArchivedSchema = z.object({ include_archived: boolish });
type Archived = z.infer<typeof ArchivedSchema>;

/** 06 §3 — workflows (statuses per team), task types and labels. Reading is open to task readers; changes need tasks.workflows.manage. */
@ApiTags('Tasks · Setup')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class TaskConfigController {
    constructor(private readonly config: TaskConfigService) { }

    @Get('task-statuses')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Statuses of a team workflow (team_id) or the organization workflow; defaults are created on first use' })
    statuses(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(StatusQuerySchema)) q: StatusQuery) {
        return this.config.listStatuses(ctx, q.team_id && q.team_id !== 'none' ? q.team_id : null, !!q.include_archived);
    }

    @Get('task-statuses/workflows')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Every team workflow at once (pickers that span teams)' })
    workflows(@CurrentOrg() ctx: OrgContext) {
        return this.config.workflows(ctx);
    }

    @Post('task-statuses')
    @RequirePermission('tasks.workflows.manage')
    @ApiOperation({ summary: 'Add a status to a workflow' })
    createStatus(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTaskStatusDto) {
        return this.config.createStatus(ctx, dto);
    }

    @Post('task-statuses/reorder')
    @RequirePermission('tasks.workflows.manage')
    @ApiOperation({ summary: 'Reorder the statuses of one workflow' })
    reorder(@CurrentOrg() ctx: OrgContext, @Body() dto: ReorderStatusesDto) {
        return this.config.reorderStatuses(ctx, dto);
    }

    @Patch('task-statuses/:id')
    @RequirePermission('tasks.workflows.manage')
    @ApiOperation({ summary: 'Rename, recolor or change transitions of a status' })
    updateStatus(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskStatusDto) {
        return this.config.updateStatus(ctx, id, dto);
    }

    @Post('task-statuses/:id/archive')
    @RequirePermission('tasks.workflows.manage')
    @ApiOperation({ summary: 'Archive (moving its tasks to a replacement) or restore a status' })
    archiveStatus(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ArchiveTaskStatusDto) {
        return this.config.archiveStatus(ctx, id, dto);
    }

    @Get('task-types')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Task types' })
    types(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ArchivedSchema)) q: Archived) {
        return this.config.listTypes(ctx, !!q.include_archived);
    }

    @Post('task-types')
    @RequirePermission('tasks.workflows.manage')
    @ApiOperation({ summary: 'Create a task type' })
    createType(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTaskTypeDto) {
        return this.config.createType(ctx, dto);
    }

    @Patch('task-types/:id')
    @RequirePermission('tasks.workflows.manage')
    @ApiOperation({ summary: 'Update a task type' })
    updateType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskTypeDto) {
        return this.config.updateType(ctx, id, dto);
    }

    @Post('task-types/:id/archive')
    @RequirePermission('tasks.workflows.manage')
    @ApiOperation({ summary: 'Archive or restore a task type' })
    archiveType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.config.archiveType(ctx, id);
    }

    @Get('task-labels')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Task labels' })
    labels(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ArchivedSchema)) q: Archived) {
        return this.config.listLabels(ctx, !!q.include_archived);
    }

    @Post('task-labels')
    @RequirePermission('tasks.workflows.manage')
    @ApiOperation({ summary: 'Create a label' })
    createLabel(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTaskLabelDto) {
        return this.config.createLabel(ctx, dto);
    }

    @Patch('task-labels/:id')
    @RequirePermission('tasks.workflows.manage')
    @ApiOperation({ summary: 'Update a label' })
    updateLabel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskLabelDto) {
        return this.config.updateLabel(ctx, id, dto);
    }

    @Post('task-labels/:id/archive')
    @RequirePermission('tasks.workflows.manage')
    @ApiOperation({ summary: 'Archive or restore a label' })
    archiveLabel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.config.archiveLabel(ctx, id);
    }
}

/** 06 §4 — cycles (sprints). */
@ApiTags('Tasks · Cycles')
@ApiBearerAuth()
@Controller('cycles')
@UseGuards(JwtGuard, PermissionsGuard)
export class CyclesController {
    constructor(private readonly cycles: CyclesService) { }

    @Get()
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'List cycles with progress' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CycleQuerySchema)) q: CycleQuery) {
        return this.cycles.list(ctx, q);
    }

    @Get(':id')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Cycle with tasks, progress and burndown' })
    get(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.cycles.get(ctx, id);
    }

    @Post()
    @RequirePermission('tasks.cycles.manage')
    @ApiOperation({ summary: 'Create a cycle' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateCycleDto) {
        return this.cycles.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('tasks.cycles.manage')
    @ApiOperation({ summary: 'Update or start a cycle' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCycleDto) {
        return this.cycles.update(ctx, id, dto);
    }

    @Post(':id/complete')
    @RequirePermission('tasks.cycles.manage')
    @ApiOperation({ summary: 'Complete a cycle and carry over unfinished tasks' })
    complete(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteCycleDto) {
        return this.cycles.complete(ctx, id, dto);
    }
}

/** 06 §9 — releases and deployments. */
@ApiTags('Tasks · Releases')
@ApiBearerAuth()
@Controller('releases')
@UseGuards(JwtGuard, PermissionsGuard)
export class ReleasesController {
    constructor(private readonly releases: ReleasesService) { }

    @Get()
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'List releases with progress and latest deployments' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ReleaseQuerySchema)) q: ReleaseQuery) {
        return this.releases.list(ctx, q);
    }

    @Get(':id')
    @RequirePermission('tasks.tasks.read')
    @ApiOperation({ summary: 'Release with tasks and deployments' })
    get(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.releases.get(ctx, id);
    }

    @Post()
    @RequirePermission('tasks.releases.manage')
    @ApiOperation({ summary: 'Create a release' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateReleaseDto) {
        return this.releases.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('tasks.releases.manage')
    @ApiOperation({ summary: 'Update a release (status RELEASED marks it shipped)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReleaseDto) {
        return this.releases.update(ctx, id, dto);
    }

    @Post(':id/tasks')
    @RequirePermission('tasks.releases.manage')
    @ApiOperation({ summary: 'Add tasks to a release' })
    addTasks(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReleaseTasksDto) {
        return this.releases.setTasks(ctx, id, dto, true);
    }

    @Post(':id/tasks/remove')
    @RequirePermission('tasks.releases.manage')
    @ApiOperation({ summary: 'Remove tasks from a release' })
    removeTasks(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReleaseTasksDto) {
        return this.releases.setTasks(ctx, id, dto, false);
    }

    @Post(':id/deployments')
    @RequirePermission('tasks.releases.manage')
    @ApiOperation({ summary: 'Record a deployment' })
    deploy(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDeploymentDto) {
        return this.releases.addDeployment(ctx, id, dto);
    }
}
