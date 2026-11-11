import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { boolish } from '@/shared/utils/pagination/pagination.utils';
import { ProjectSettingsService } from '../services/project-settings.service';
import {
    CreateProjectStatusDto,
    CreateProjectTemplateDto,
    CreateProjectTypeDto,
    PublishTemplateVersionDto,
    UpdateProjectStatusDto,
    UpdateProjectTemplateDto,
    UpdateProjectTypeDto,
} from '../dto/project-settings.dto';

const IncludeArchivedSchema = z.object({ include_archived: boolish });
type IncludeArchived = z.infer<typeof IncludeArchivedSchema>;

/** 05 §2, §4, §36–37 — project types, statuses and templates. Reading is open to project readers (pickers); changes need projects.settings.manage. */
@ApiTags('Projects · Setup')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class ProjectSettingsController {
    constructor(private readonly settings: ProjectSettingsService) { }

    @Get('project-types')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List project types (defaults are created on first use)' })
    listTypes(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(IncludeArchivedSchema)) q: IncludeArchived) {
        return this.settings.listTypes(ctx, !!q.include_archived);
    }

    @Post('project-types')
    @RequirePermission('projects.settings.manage')
    @ApiOperation({ summary: 'Create a project type' })
    createType(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateProjectTypeDto) {
        return this.settings.createType(ctx, dto);
    }

    @Patch('project-types/:id')
    @RequirePermission('projects.settings.manage')
    @ApiOperation({ summary: 'Update a project type' })
    updateType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectTypeDto) {
        return this.settings.updateType(ctx, id, dto);
    }

    @Post('project-types/:id/archive')
    @RequirePermission('projects.settings.manage')
    @ApiOperation({ summary: 'Archive or restore a project type (toggle)' })
    archiveType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.settings.archiveType(ctx, id);
    }

    @Get('project-statuses')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List project statuses (defaults are created on first use)' })
    listStatuses(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(IncludeArchivedSchema)) q: IncludeArchived) {
        return this.settings.listStatuses(ctx, !!q.include_archived);
    }

    @Post('project-statuses')
    @RequirePermission('projects.settings.manage')
    @ApiOperation({ summary: 'Create a project status' })
    createStatus(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateProjectStatusDto) {
        return this.settings.createStatus(ctx, dto);
    }

    @Patch('project-statuses/:id')
    @RequirePermission('projects.settings.manage')
    @ApiOperation({ summary: 'Update a project status and its allowed transitions' })
    updateStatus(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectStatusDto) {
        return this.settings.updateStatus(ctx, id, dto);
    }

    @Post('project-statuses/:id/archive')
    @RequirePermission('projects.settings.manage')
    @ApiOperation({ summary: 'Archive or restore a project status (toggle)' })
    archiveStatus(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.settings.archiveStatus(ctx, id);
    }

    @Get('project-templates')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'List project templates with their current version' })
    listTemplates(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(IncludeArchivedSchema)) q: IncludeArchived) {
        return this.settings.listTemplates(ctx, !!q.include_archived);
    }

    @Get('project-templates/:id')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Get a template with its version history' })
    getTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.settings.getTemplate(ctx, id);
    }

    @Post('project-templates')
    @RequirePermission('projects.settings.manage')
    @ApiOperation({ summary: 'Create a template (version 1)' })
    createTemplate(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateProjectTemplateDto) {
        return this.settings.createTemplate(ctx, dto);
    }

    @Patch('project-templates/:id')
    @RequirePermission('projects.settings.manage')
    @ApiOperation({ summary: 'Rename, retype or deactivate a template' })
    updateTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectTemplateDto) {
        return this.settings.updateTemplate(ctx, id, dto);
    }

    @Post('project-templates/:id/versions')
    @RequirePermission('projects.settings.manage')
    @ApiOperation({ summary: 'Publish a new immutable template version' })
    publishVersion(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishTemplateVersionDto) {
        return this.settings.publishVersion(ctx, id, dto);
    }
}
