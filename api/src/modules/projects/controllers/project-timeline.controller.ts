import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ProjectTimelineService } from '../services/project-timeline.service';
import { PortfolioTimelineQuery, PortfolioTimelineQuerySchema, ProjectTimelineQuery, ProjectTimelineQuerySchema } from '../dto/project-timeline.schema';

/**
 * 05 §24–26 — Gantt data. Registered before ProjectsController so `/projects/timeline` is not read as a project id.
 * Rescheduling uses the owning PATCH endpoints (project, milestone, workstream, task) and their permission keys.
 */
@ApiTags('Projects · Timeline')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtGuard, PermissionsGuard)
export class ProjectTimelineController {
    constructor(private readonly timeline: ProjectTimelineService) { }

    @Get('timeline')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Portfolio timeline: projects in scope with milestones, workstreams and dependencies' })
    portfolio(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PortfolioTimelineQuerySchema)) query: PortfolioTimelineQuery) {
        return this.timeline.portfolio(ctx, query);
    }

    @Get(':projectId/timeline')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Project timeline: workstreams, milestones, dated tasks (task scope applies), dependencies and unscheduled tasks' })
    project(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Query(new ZodValidationPipe(ProjectTimelineQuerySchema)) query: ProjectTimelineQuery) {
        return this.timeline.project(ctx, projectId, query);
    }
}
