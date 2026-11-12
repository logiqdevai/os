import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { RulesService } from './rules.service';
import { CreateRuleDto, CreateTemplateDto, DatePreviewDto, ImportRuleDto, PublishRuleDto, RuleQuery, RuleQuerySchema, RunRuleDto, TestRuleDto, UpdateRuleDto } from './dto/rule.dto';

const TemplateQuerySchema = z.object({ module: z.nativeEnum(ModuleKey).optional(), category: z.string().optional(), search: z.string().optional() });

@ApiTags('Automation · Workflows')
@ApiBearerAuth()
@Controller('automation')
@UseGuards(JwtGuard, PermissionsGuard)
export class RulesController {
    constructor(private readonly rules: RulesService) { }

    @Get('rules')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'List workflows (scoped to the caller)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(RuleQuerySchema)) query: RuleQuery) {
        return this.rules.findAll(ctx, query);
    }

    @Post('rules')
    @RequirePermission('automation.rules.create')
    @ApiOperation({ summary: 'Create a workflow (DRAFT, disabled). Pass template_id to start from a template.' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateRuleDto) {
        return this.rules.create(ctx, dto as unknown as Record<string, unknown>);
    }

    @Post('rules/date-preview')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'Date-relative trigger preview: records that would fire today (needs the read key of the watched records)' })
    datePreview(@CurrentOrg() ctx: OrgContext, @Body() dto: DatePreviewDto) {
        return this.rules.previewDateTrigger(ctx, dto.trigger_key, dto.trigger_config ?? {});
    }

    @Post('rules/import')
    @RequirePermission('automation.rules.create')
    @ApiOperation({ summary: 'Import a workflow from an export file (creates a DRAFT)' })
    import(@CurrentOrg() ctx: OrgContext, @Body() dto: ImportRuleDto) {
        return this.rules.import(ctx, dto.rule);
    }

    @Get('rules/:id')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'Get a workflow with its live definition and unpublished draft' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.findOne(ctx, id);
    }

    @Patch('rules/:id')
    @RequirePermission('automation.rules.update')
    @ApiOperation({ summary: 'Edit a workflow. Published workflows keep running; edits are saved as a draft until published.' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRuleDto) {
        return this.rules.update(ctx, id, dto as unknown as Record<string, unknown>);
    }

    @Post('rules/:id/discard-draft')
    @RequirePermission('automation.rules.update')
    @ApiOperation({ summary: 'Discard unpublished changes' })
    discardDraft(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.discardDraft(ctx, id);
    }

    @Post('rules/:id/publish')
    @RequirePermission('automation.rules.enable')
    @ApiOperation({ summary: 'Publish the draft as a new version' })
    publish(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishRuleDto) {
        return this.rules.publish(ctx, id, dto.change_summary);
    }

    @Post('rules/:id/enable')
    @RequirePermission('automation.rules.enable')
    @ApiOperation({ summary: 'Enable a published workflow' })
    enable(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.setEnabled(ctx, id, true);
    }

    @Post('rules/:id/disable')
    @RequirePermission('automation.rules.enable')
    @ApiOperation({ summary: 'Disable a workflow' })
    disable(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.setEnabled(ctx, id, false);
    }

    @Post('rules/:id/duplicate')
    @RequirePermission('automation.rules.create')
    @ApiOperation({ summary: 'Duplicate as a new DRAFT workflow' })
    duplicate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.duplicate(ctx, id);
    }

    @Post('rules/:id/archive')
    @RequirePermission('automation.rules.delete')
    @ApiOperation({ summary: 'Archive (disables the workflow)' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.archive(ctx, id);
    }

    @Post('rules/:id/restore')
    @RequirePermission('automation.rules.update')
    @ApiOperation({ summary: 'Restore an archived workflow (stays disabled)' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.restore(ctx, id);
    }

    @Delete('rules/:id')
    @RequirePermission('automation.rules.delete')
    @ApiOperation({ summary: 'Delete a workflow permanently (runs are deleted with it)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.remove(ctx, id);
    }

    @Get('rules/:id/versions')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'Published versions' })
    versions(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.versions(ctx, id);
    }

    @Post('rules/:id/versions/:version/restore')
    @RequirePermission('automation.rules.update', 'automation.rules.enable')
    @ApiOperation({ summary: 'Publish an old version again as a new version' })
    restoreVersion(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('version', ParseIntPipe) version: number) {
        return this.rules.restoreVersion(ctx, id, version);
    }

    @Get('rules/:id/export')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'Export the workflow definition as JSON' })
    export(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.export(ctx, id);
    }

    @Post('rules/:id/run')
    @RequirePermission('automation.rules.run')
    @ApiOperation({ summary: 'Run a published workflow now (LIVE)' })
    run(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RunRuleDto) {
        return this.rules.runNow(ctx, id, dto);
    }

    @Post('rules/:id/test')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'Dry run (nothing executes) or test run (TEST, needs automation.rules.update) with a sample event' })
    test(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TestRuleDto) {
        return this.rules.test(ctx, id, dto);
    }

    @Get('templates')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'Workflow templates (system + organization)' })
    templates(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TemplateQuerySchema)) query: z.infer<typeof TemplateQuerySchema>) {
        return this.rules.templates(ctx, query);
    }

    @Post('templates')
    @RequirePermission('automation.templates.manage')
    @ApiOperation({ summary: 'Publish a workflow as an organization template' })
    createTemplate(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateTemplateDto) {
        return this.rules.createTemplate(ctx, dto);
    }

    @Delete('templates/:id')
    @RequirePermission('automation.templates.manage')
    @ApiOperation({ summary: 'Unpublish an organization template' })
    removeTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rules.removeTemplate(ctx, id);
    }
}
