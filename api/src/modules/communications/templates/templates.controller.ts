import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, PreviewTemplateDto, TemplateContentDto, TemplateQuery, TemplateQuerySchema, UpdateTemplateDto } from './dto/template.dto';

@ApiTags('Communications · Templates')
@ApiBearerAuth()
@Controller('communications/templates')
@UseGuards(JwtGuard, PermissionsGuard)
export class TemplatesController {
    constructor(private readonly templates: TemplatesService) { }

    @Get()
    @RequirePermission('communications.templates.read')
    @ApiOperation({ summary: 'List email / SMS templates' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TemplateQuerySchema)) query: TemplateQuery) {
        return this.templates.findAll(ctx, query);
    }

    @Post('preview')
    @RequirePermission('communications.templates.read')
    @ApiOperation({ summary: 'Render content or a version with sample or contact data' })
    preview(@CurrentOrg() ctx: OrgContext, @Body() dto: PreviewTemplateDto) {
        return this.templates.preview(ctx, dto);
    }

    @Get(':id')
    @RequirePermission('communications.templates.read')
    @ApiOperation({ summary: 'Get a template with versions and the open draft' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.findOne(ctx, id);
    }

    @Get(':id/versions/:versionId')
    @RequirePermission('communications.templates.read')
    @ApiOperation({ summary: 'Get one template version' })
    version(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string) {
        return this.templates.getVersion(ctx, id, versionId);
    }

    @Post()
    @RequirePermission('communications.templates.create')
    @ApiOperation({ summary: 'Create a template (version 1 as draft)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTemplateDto) {
        return this.templates.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('communications.templates.update')
    @ApiOperation({ summary: 'Update template settings; content changes go to the draft version' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto) {
        return this.templates.update(ctx, id, dto);
    }

    @Post(':id/versions')
    @RequirePermission('communications.templates.update')
    @ApiOperation({ summary: 'Save content into the draft version' })
    saveDraft(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TemplateContentDto) {
        return this.templates.saveDraft(ctx, id, dto);
    }

    @Post(':id/versions/:versionId/publish')
    @RequirePermission('communications.templates.update')
    @ApiOperation({ summary: 'Publish a version (becomes the current version)' })
    publish(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string) {
        return this.templates.publish(ctx, id, versionId);
    }

    @Post(':id/duplicate')
    @RequirePermission('communications.templates.create')
    @ApiOperation({ summary: 'Duplicate a template' })
    duplicate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.duplicate(ctx, id);
    }

    @Post(':id/archive')
    @RequirePermission('communications.templates.archive')
    @ApiOperation({ summary: 'Archive a template' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.archive(ctx, id);
    }

    @Post(':id/restore')
    @RequirePermission('communications.templates.archive')
    @ApiOperation({ summary: 'Restore an archived template' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.restore(ctx, id);
    }

    @Delete(':id')
    @RequirePermission('communications.templates.delete')
    @ApiOperation({ summary: 'Delete a template' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.remove(ctx, id);
    }
}
