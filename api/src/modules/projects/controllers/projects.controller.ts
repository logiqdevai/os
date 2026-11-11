import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ProjectsService } from '../services/projects.service';
import { AddProjectMemberDto, CreateProjectDto, ReopenProjectDto, UpdateProjectDto, UpdateProjectMemberDto } from '../dto/create-project.dto';
import {
    LookupQuery,
    LookupQuerySchema,
    MilestoneQuery,
    MilestoneQuerySchema,
    ProjectQuery,
    ProjectQuerySchema,
    RaidQuery,
    RaidQuerySchema,
    WorkloadQuery,
    WorkloadQuerySchema,
} from '../dto/project-query.schema';

/** 05 Projects — project records, lifecycle, members, favorites and cross-project views. Static paths come before `:id`. */
@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtGuard, PermissionsGuard)
export class ProjectsController {
    constructor(private readonly projects: ProjectsService) { }

    @Get()
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List projects in the caller scope (filters: status, health, type, owner, customer, team, favorites)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ProjectQuerySchema)) query: ProjectQuery) {
        return this.projects.findAll(ctx, query);
    }

    @Get('lookup')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Project picker for other modules (id, name, code, customer)' })
    lookup(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LookupQuerySchema)) query: LookupQuery) {
        return this.projects.lookup(ctx, query);
    }

    @Get('people')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Active members for owner / member pickers' })
    people(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LookupQuerySchema)) query: LookupQuery) {
        return this.projects.people(ctx, query.search);
    }

    @Get('favorites')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Projects starred by the caller' })
    favorites(@CurrentOrg() ctx: OrgContext) {
        return this.projects.favorites(ctx);
    }

    @Get('portfolio')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Portfolio KPIs: counts by status and health, at-risk projects, milestones, overdue work, hours vs budget' })
    portfolio(@CurrentOrg() ctx: OrgContext) {
        return this.projects.portfolio(ctx);
    }

    @Get('milestones')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Milestones across projects in scope' })
    milestones(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(MilestoneQuerySchema)) query: MilestoneQuery) {
        return this.projects.milestones(ctx, query);
    }

    @Get('raid')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'RAID log across projects (kind=risks|issues|decisions|dependencies)' })
    raid(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(RaidQuerySchema)) query: RaidQuery) {
        return this.projects.raid(ctx, query);
    }

    @Get('workload')
    @RequireAnyPermission('projects.portfolio.read', 'projects.members.manage')
    @ApiOperation({ summary: 'Planned allocation per person across projects in scope' })
    workload(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(WorkloadQuerySchema)) query: WorkloadQuery) {
        return this.projects.workload(ctx, query);
    }

    @Post()
    @RequirePermission('projects.projects.create')
    @ApiOperation({ summary: 'Create a project (optionally from a template)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateProjectDto) {
        return this.projects.create(ctx, dto);
    }

    @Get(':id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get a project with members and a delivery summary' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.projects.findOne(ctx, id);
    }

    @Patch(':id')
    @RequirePermission('projects.projects.update')
    @ApiOperation({ summary: 'Update a project (status follows allowed transitions)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
        return this.projects.update(ctx, id, dto);
    }

    @Delete(':id')
    @RequirePermission('projects.projects.delete')
    @ApiOperation({ summary: 'Delete a project permanently' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.projects.remove(ctx, id);
    }

    @Post(':id/archive')
    @RequirePermission('projects.projects.archive')
    @ApiOperation({ summary: 'Archive a project' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.projects.archive(ctx, id);
    }

    @Post(':id/restore')
    @RequirePermission('projects.projects.archive')
    @ApiOperation({ summary: 'Restore an archived project' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.projects.restore(ctx, id);
    }

    @Post(':id/complete')
    @RequirePermission('projects.projects.complete')
    @ApiOperation({ summary: 'Complete a project (blocking gates must be passed or waived)' })
    complete(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.projects.complete(ctx, id);
    }

    @Post(':id/reopen')
    @RequirePermission('projects.projects.reopen')
    @ApiOperation({ summary: 'Reopen a completed or cancelled project' })
    reopen(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReopenProjectDto) {
        return this.projects.reopen(ctx, id, dto.reason);
    }

    @Post(':id/favorite')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Star a project' })
    favorite(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.projects.setFavorite(ctx, id, true);
    }

    @Delete(':id/favorite')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Unstar a project' })
    unfavorite(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.projects.setFavorite(ctx, id, false);
    }

    @Get(':id/members')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Project members' })
    members(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.projects.listMembers(ctx, id);
    }

    @Post(':id/members')
    @RequireAnyPermission('projects.members.manage', 'projects.projects.manage_members')
    @ApiOperation({ summary: 'Add a member to a project' })
    addMember(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddProjectMemberDto) {
        return this.projects.addMember(ctx, id, dto);
    }

    @Patch(':id/members/:membershipId')
    @RequireAnyPermission('projects.members.manage', 'projects.projects.manage_members')
    @ApiOperation({ summary: 'Change a member role or allocation' })
    updateMember(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('membershipId', ParseUUIDPipe) membershipId: string, @Body() dto: UpdateProjectMemberDto) {
        return this.projects.updateMember(ctx, id, membershipId, dto);
    }

    @Delete(':id/members/:membershipId')
    @RequireAnyPermission('projects.members.manage', 'projects.projects.manage_members')
    @ApiOperation({ summary: 'Remove a member from a project' })
    removeMember(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('membershipId', ParseUUIDPipe) membershipId: string) {
        return this.projects.removeMember(ctx, id, membershipId);
    }
}
