import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { TimeSettingsService } from './time-settings.service';
import { TimeLookupsService } from '../common/time-lookups.service';
import { CreateActivityTypeDto, UpdateActivityTypeDto, UpdateProjectTimeSettingsDto, UpdateTimeSettingsDto } from './dto/time-settings.dto';
import { TIME_ANY_READ } from '../common/time-permissions';

const LookupQuerySchema = z.object({ search: z.string().trim().optional(), project_id: z.string().uuid().optional(), scope: z.enum(['mine', 'team', 'all']).optional(), include_archived: z.enum(['true', 'false']).optional() });
type LookupQuery = z.infer<typeof LookupQuerySchema>;

@ApiTags('Time · Settings')
@ApiBearerAuth()
@Controller('time')
@UseGuards(JwtGuard, PermissionsGuard)
export class TimeSettingsController {
    constructor(
        private readonly settings: TimeSettingsService,
        private readonly lookups: TimeLookupsService,
    ) { }

    @Get('settings')
    @RequireAnyPermission(...TIME_ANY_READ, 'time.settings.manage')
    @ApiOperation({ summary: 'Organization time-tracking settings (rules the entry form enforces)' })
    get(@CurrentOrg() ctx: OrgContext) {
        return this.settings.get(ctx);
    }

    @Patch('settings')
    @RequirePermission('time.settings.manage')
    @ApiOperation({ summary: 'Update time-tracking settings' })
    update(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateTimeSettingsDto) {
        return this.settings.update(ctx, dto);
    }

    @Get('activity-types')
    @RequireAnyPermission(...TIME_ANY_READ, 'time.settings.manage')
    @ApiOperation({ summary: 'List activity types' })
    activityTypes(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LookupQuerySchema)) q: LookupQuery) {
        return this.settings.listActivityTypes(ctx, q.include_archived === 'true');
    }

    @Post('activity-types')
    @RequirePermission('time.settings.manage')
    @ApiOperation({ summary: 'Create an activity type' })
    createActivityType(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateActivityTypeDto) {
        return this.settings.createActivityType(ctx, dto);
    }

    @Patch('activity-types/:id')
    @RequirePermission('time.settings.manage')
    @ApiOperation({ summary: 'Update an activity type' })
    updateActivityType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateActivityTypeDto) {
        return this.settings.updateActivityType(ctx, id, dto);
    }

    @Post('activity-types/:id/archive')
    @RequirePermission('time.settings.manage')
    @ApiOperation({ summary: 'Archive an activity type' })
    archiveActivityType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.settings.archiveActivityType(ctx, id);
    }

    @Post('activity-types/:id/restore')
    @RequirePermission('time.settings.manage')
    @ApiOperation({ summary: 'Restore an archived activity type' })
    restoreActivityType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.settings.archiveActivityType(ctx, id, true);
    }

    @Get('project-settings')
    @RequirePermission('time.settings.manage')
    @ApiOperation({ summary: 'Active projects with their time settings and logged hours vs budget' })
    listProjectSettings(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LookupQuerySchema)) q: LookupQuery) {
        return this.settings.listProjectSettings(ctx, q.search);
    }

    @Get('project-settings/:projectId')
    @RequireAnyPermission('time.settings.manage', 'projects.projects.read')
    @ApiOperation({ summary: 'Per-project time settings with the resolved default billability' })
    projectSettings(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string) {
        return this.settings.getProjectSettings(ctx, projectId);
    }

    @Patch('project-settings/:projectId')
    @RequirePermission('time.settings.manage')
    @ApiOperation({ summary: 'Update per-project time settings' })
    updateProjectSettings(@CurrentOrg() ctx: OrgContext, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: UpdateProjectTimeSettingsDto) {
        return this.settings.updateProjectSettings(ctx, projectId, dto);
    }

    @Get('lookups/projects')
    @RequireAnyPermission('time.entries.create_own', 'time.entries.create_team', ...TIME_ANY_READ)
    @ApiOperation({ summary: 'Projects time can be logged against (picker)' })
    projects(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LookupQuerySchema)) q: LookupQuery) {
        return this.lookups.projects(ctx, q.search);
    }

    @Get('lookups/tasks')
    @RequireAnyPermission('time.entries.create_own', 'time.entries.create_team', ...TIME_ANY_READ)
    @ApiOperation({ summary: 'Tasks of a project (picker)' })
    tasks(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LookupQuerySchema)) q: LookupQuery) {
        return this.lookups.tasks(ctx, q.project_id, q.search);
    }

    @Get('lookups/members')
    @RequireAnyPermission(...TIME_ANY_READ)
    @ApiOperation({ summary: 'Members visible in the caller\'s time scope (picker)' })
    members(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LookupQuerySchema)) q: LookupQuery) {
        return this.lookups.members(ctx, q.scope ?? 'all');
    }
}
