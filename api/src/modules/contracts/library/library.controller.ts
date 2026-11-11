import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ContractLibraryService } from './library.service';
import {
    ClauseVersionDto, CreateApprovalRuleDto, CreateContractClauseDto, CreateContractTemplateDto, CreateContractTypeDto, LibraryQuery, LibraryQuerySchema,
    TemplateVersionDto, UpdateApprovalRuleDto, UpdateContractClauseDto, UpdateContractTemplateDto, UpdateContractTypeDto,
} from './dto/library.dto';

const READ = 'contracts.contracts.read';

@ApiTags('Contracts · Library')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class ContractLibraryController {
    constructor(private readonly library: ContractLibraryService) { }

    // Types
    @Get('contract-types') @RequirePermission(READ) @ApiOperation({ summary: 'List contract types' })
    listTypes(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LibraryQuerySchema)) q: LibraryQuery) { return this.library.listTypes(ctx, q); }

    @Get('contract-types/:id') @RequirePermission(READ) @ApiOperation({ summary: 'Get a contract type' })
    getType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.library.getType(ctx, id); }

    @Post('contract-types') @RequirePermission('contracts.types.manage') @ApiOperation({ summary: 'Create a contract type' })
    createType(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateContractTypeDto) { return this.library.createType(ctx, dto); }

    @Patch('contract-types/:id') @RequirePermission('contracts.types.manage') @ApiOperation({ summary: 'Update a contract type' })
    updateType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractTypeDto) { return this.library.updateType(ctx, id, dto); }

    @Post('contract-types/:id/archive') @RequirePermission('contracts.types.manage') @ApiOperation({ summary: 'Archive a contract type' })
    archiveType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.library.archiveType(ctx, id, true); }

    @Post('contract-types/:id/restore') @RequirePermission('contracts.types.manage') @ApiOperation({ summary: 'Restore a contract type' })
    restoreType(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.library.archiveType(ctx, id, false); }

    // Templates
    @Get('contract-templates') @RequirePermission(READ) @ApiOperation({ summary: 'List contract templates' })
    listTemplates(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LibraryQuerySchema)) q: LibraryQuery) { return this.library.listTemplates(ctx, q); }

    @Get('contract-templates/:id') @RequirePermission(READ) @ApiOperation({ summary: 'Get a template with its versions' })
    getTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.library.getTemplate(ctx, id); }

    @Post('contract-templates') @RequirePermission('contracts.templates.manage') @ApiOperation({ summary: 'Create a template (first version)' })
    createTemplate(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateContractTemplateDto) { return this.library.createTemplate(ctx, dto); }

    @Patch('contract-templates/:id') @RequirePermission('contracts.templates.manage') @ApiOperation({ summary: 'Update template metadata' })
    updateTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractTemplateDto) { return this.library.updateTemplate(ctx, id, dto); }

    @Post('contract-templates/:id/versions') @RequirePermission('contracts.templates.manage') @ApiOperation({ summary: 'Add a template version' })
    addTemplateVersion(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TemplateVersionDto) { return this.library.addTemplateVersion(ctx, id, dto); }

    @Post('contract-templates/:id/versions/:versionId/publish') @RequirePermission('contracts.templates.manage') @ApiOperation({ summary: 'Publish a template version' })
    publishTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string) { return this.library.publishTemplateVersion(ctx, id, versionId); }

    @Post('contract-templates/:id/deprecate') @RequirePermission('contracts.templates.manage') @ApiOperation({ summary: 'Deprecate a template' })
    deprecateTemplate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.library.deprecateTemplate(ctx, id); }

    // Clauses
    @Get('contract-clauses') @RequirePermission(READ) @ApiOperation({ summary: 'List library clauses' })
    listClauses(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LibraryQuerySchema)) q: LibraryQuery) { return this.library.listClauses(ctx, q); }

    @Get('contract-clauses/:id') @RequirePermission(READ) @ApiOperation({ summary: 'Get a clause with its versions' })
    getClause(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.library.getClause(ctx, id); }

    @Get('contract-clauses/:id/usage') @RequirePermission(READ) @ApiOperation({ summary: 'Contracts that embed this clause' })
    clauseUsage(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.library.clauseUsage(ctx, id); }

    @Post('contract-clauses') @RequirePermission('contracts.clauses.manage') @ApiOperation({ summary: 'Create a clause' })
    createClause(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateContractClauseDto) { return this.library.createClause(ctx, dto); }

    @Patch('contract-clauses/:id') @RequirePermission('contracts.clauses.manage') @ApiOperation({ summary: 'Update clause metadata / status' })
    updateClause(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractClauseDto) { return this.library.updateClause(ctx, id, dto); }

    @Post('contract-clauses/:id/versions') @RequirePermission('contracts.clauses.manage') @ApiOperation({ summary: 'New clause text version' })
    addClauseVersion(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ClauseVersionDto) { return this.library.addClauseVersion(ctx, id, dto); }

    // Approval rules
    @Get('contract-approval-rules') @RequirePermission('contracts.approval_rules.manage') @ApiOperation({ summary: 'List approval rules' })
    listRules(@CurrentOrg() ctx: OrgContext) { return this.library.listRules(ctx); }

    @Post('contract-approval-rules') @RequirePermission('contracts.approval_rules.manage') @ApiOperation({ summary: 'Create an approval rule' })
    createRule(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateApprovalRuleDto) { return this.library.createRule(ctx, dto); }

    @Patch('contract-approval-rules/:id') @RequirePermission('contracts.approval_rules.manage') @ApiOperation({ summary: 'Update an approval rule' })
    updateRule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApprovalRuleDto) { return this.library.updateRule(ctx, id, dto); }

    @Delete('contract-approval-rules/:id') @RequirePermission('contracts.approval_rules.manage') @ApiOperation({ summary: 'Delete an approval rule' })
    deleteRule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.library.deleteRule(ctx, id); }
}
