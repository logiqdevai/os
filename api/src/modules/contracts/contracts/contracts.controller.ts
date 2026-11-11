import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ContractsService } from './contracts.service';
import {
    AmendContractDto, ContractQuery, ContractQuerySchema, CreateContractDto, LinkProjectDto, RenewContractDto, RenewalDecisionDto, RenewalsQuery, RenewalsQuerySchema, SetPartiesDto,
    TerminateContractDto, UpdateContractDto,
} from './dto/contract.dto';

const READ = 'contracts.contracts.read';

/** 04 Contracts — contract records. Static routes (dashboard, renewals) are declared before `:id`. */
@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
@UseGuards(JwtGuard, PermissionsGuard)
export class ContractsController {
    constructor(private readonly contracts: ContractsService) { }

    @Get('dashboard') @RequirePermission(READ) @ApiOperation({ summary: 'Dashboard aggregates (status counts, expiring, signatures, obligations, value)' })
    dashboard(@CurrentOrg() ctx: OrgContext) { return this.contracts.dashboard(ctx); }

    @Get('renewals') @RequirePermission(READ) @ApiOperation({ summary: 'Contracts with end / renewal / notice dates inside the window' })
    renewals(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(RenewalsQuerySchema)) q: RenewalsQuery) { return this.contracts.renewals(ctx, q); }

    @Get('lookups/:kind') @RequireAnyPermission('contracts.contracts.create', 'contracts.contracts.update', 'contracts.obligations.manage') @ApiOperation({ summary: 'Pickers for contract forms: members | companies | contacts | projects (id + label only)' })
    lookup(@CurrentOrg() ctx: OrgContext, @Param('kind') kind: string, @Query('search') search?: string, @Query('company_id') companyId?: string) {
        if (!['members', 'companies', 'contacts', 'projects'].includes(kind)) throw new BadRequestException({ message: 'Unknown lookup', code: 'unknown_lookup' });
        return this.contracts.lookup(ctx, kind as 'members', search, companyId);
    }

    @Get() @RequirePermission(READ) @ApiOperation({ summary: 'List contracts (scoped to the caller)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ContractQuerySchema)) q: ContractQuery) { return this.contracts.findAll(ctx, q); }

    @Get(':id') @RequirePermission(READ) @ApiOperation({ summary: 'Get a contract with parties, versions and lineage' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.contracts.findOne(ctx, id); }

    @Get(':id/history') @RequirePermission(READ) @ApiOperation({ summary: 'Audit and signature timeline' })
    history(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.contracts.history(ctx, id); }

    @Post() @RequirePermission('contracts.contracts.create') @ApiOperation({ summary: 'Create a contract (from template, proposal version or blank)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateContractDto) { return this.contracts.create(ctx, dto); }

    @Patch(':id') @RequirePermission('contracts.contracts.update') @ApiOperation({ summary: 'Update contract metadata' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) { return this.contracts.update(ctx, id, dto); }

    @Put(':id/parties') @RequirePermission('contracts.contracts.update') @ApiOperation({ summary: 'Replace parties and signatories' })
    setParties(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPartiesDto) { return this.contracts.setParties(ctx, id, dto); }

    @Post(':id/projects') @RequirePermission('contracts.contracts.update') @ApiOperation({ summary: 'Link a project' })
    linkProject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkProjectDto) { return this.contracts.linkProject(ctx, id, dto); }

    @Delete(':id/projects/:projectId') @RequirePermission('contracts.contracts.update') @ApiOperation({ summary: 'Unlink a project' })
    unlinkProject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('projectId', ParseUUIDPipe) projectId: string) { return this.contracts.unlinkProject(ctx, id, projectId); }

    @Post(':id/archive') @RequirePermission('contracts.contracts.archive') @ApiOperation({ summary: 'Archive' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.contracts.archive(ctx, id, true); }

    @Post(':id/restore') @RequirePermission('contracts.contracts.archive') @ApiOperation({ summary: 'Restore from archive' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.contracts.archive(ctx, id, false); }

    @Delete(':id') @RequirePermission('contracts.contracts.delete') @ApiOperation({ summary: 'Delete an unsent draft' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.contracts.remove(ctx, id); }

    @Post(':id/renewal-decision') @RequirePermission('contracts.contracts.renew') @ApiOperation({ summary: 'Record renew / do-not-renew decision' })
    renewalDecision(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RenewalDecisionDto) { return this.contracts.renewalDecision(ctx, id, dto); }

    @Post(':id/renewals') @RequirePermission('contracts.contracts.renew') @ApiOperation({ summary: 'Create the renewal contract' })
    renew(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RenewContractDto) { return this.contracts.renew(ctx, id, dto); }

    @Post(':id/amendments') @RequirePermission('contracts.contracts.amend') @ApiOperation({ summary: 'Create an amendment, change order or SOW' })
    amend(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AmendContractDto) { return this.contracts.amend(ctx, id, dto); }

    @Post(':id/terminate') @RequirePermission('contracts.contracts.terminate') @ApiOperation({ summary: 'Terminate the contract' })
    terminate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TerminateContractDto) { return this.contracts.terminate(ctx, id, dto); }
}
