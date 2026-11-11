import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { DocsTemplatesService } from '../services/templates.service';
import { CreateTemplateDto, TemplateQuery, TemplateQuerySchema, UpdateTemplateDto } from '../dto/template.dto';

@ApiTags('Docs · Templates')
@ApiBearerAuth()
@Controller('docs/templates')
@UseGuards(JwtGuard, PermissionsGuard)
export class DocsTemplatesController {
    constructor(private readonly templates: DocsTemplatesService) { }

    @Get()
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'List page templates (system + organization)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TemplateQuerySchema)) query: TemplateQuery) {
        return this.templates.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('docs.pages.read')
    @ApiOperation({ summary: 'Get a template' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Create a template' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTemplateDto) {
        return this.templates.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Update an organization template' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto) {
        return this.templates.update(ctx, id, dto);
    }

    @Post(':id/duplicate')
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Duplicate a template (also for system templates)' })
    duplicate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.duplicate(ctx, id);
    }

    @Post(':id/archive')
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Archive a template' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.setArchived(ctx, id, true);
    }

    @Post(':id/unarchive')
    @RequirePermission('docs.spaces.manage')
    @ApiOperation({ summary: 'Unarchive a template' })
    unarchive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.setArchived(ctx, id, false);
    }
}
