import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ProposalTemplatesService } from './proposal-templates.service';
import { CreateApprovalRuleDto, CreateProposalTemplateDto, UpdateApprovalRuleDto, UpdateProposalTemplateDto } from './dto/proposal-template.dto';
import { ProposalTemplateQuery, ProposalTemplateQuerySchema } from './dto/proposal-query.schema';

@ApiTags('Proposals · Templates')
@ApiBearerAuth()
@Controller('proposal-templates')
@UseGuards(JwtGuard, PermissionsGuard)
export class ProposalTemplatesController {
    constructor(private readonly templates: ProposalTemplatesService) { }

    @Get()
    @RequireAnyPermission('proposals.templates.manage', 'proposals.proposals.create')
    @ApiOperation({ summary: 'List templates (also used by the "New proposal" picker)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ProposalTemplateQuerySchema)) query: ProposalTemplateQuery) {
        return this.templates.findAll(ctx, query);
    }

    @Get(':id')
    @RequireAnyPermission('proposals.templates.manage', 'proposals.proposals.create')
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('proposals.templates.manage')
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateProposalTemplateDto) {
        return this.templates.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('proposals.templates.manage')
    @ApiOperation({ summary: 'Update; a content change writes a new template version' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProposalTemplateDto) {
        return this.templates.update(ctx, id, dto);
    }

    @Post(':id/duplicate')
    @RequirePermission('proposals.templates.manage')
    duplicate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.duplicate(ctx, id);
    }

    @Post(':id/archive')
    @RequirePermission('proposals.templates.manage')
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.archive(ctx, id);
    }

    @Post(':id/restore')
    @RequirePermission('proposals.templates.manage')
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.archive(ctx, id, true);
    }
}

@ApiTags('Proposals · Approval rules')
@ApiBearerAuth()
@Controller('proposal-approval-rules')
@UseGuards(JwtGuard, PermissionsGuard)
export class ProposalApprovalRulesController {
    constructor(private readonly templates: ProposalTemplatesService) { }

    @Get()
    @RequirePermission('proposals.approval_rules.manage')
    findAll(@CurrentOrg() ctx: OrgContext) {
        return this.templates.rules(ctx);
    }

    @Post()
    @RequirePermission('proposals.approval_rules.manage')
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateApprovalRuleDto) {
        return this.templates.createRule(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('proposals.approval_rules.manage')
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApprovalRuleDto) {
        return this.templates.updateRule(ctx, id, dto);
    }

    @Delete(':id')
    @RequirePermission('proposals.approval_rules.manage')
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.templates.deleteRule(ctx, id);
    }
}
