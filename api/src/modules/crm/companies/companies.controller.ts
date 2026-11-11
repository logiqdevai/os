import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { sendCsv } from '../common/send-csv';
import { CrmCompaniesService } from './companies.service';
import { AssignOwnerDto, CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { CompanyQuery, CompanyQuerySchema, LookupQuery, LookupQuerySchema } from './dto/company-query.schema';

@ApiTags('CRM · Companies')
@ApiBearerAuth()
@Controller('crm/companies')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmCompaniesController {
    constructor(private readonly companies: CrmCompaniesService) { }

    @Get()
    @RequirePermission('crm.companies.read')
    @ApiOperation({ summary: 'List companies (scoped; money only with crm.financials.read)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CompanyQuerySchema)) query: CompanyQuery) {
        return this.companies.findAll(ctx, query);
    }

    @Get('lookup')
    @RequirePermission('crm.companies.read')
    @ApiOperation({ summary: 'Customer picker for other modules (id, name, type, website)' })
    lookup(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LookupQuerySchema)) query: LookupQuery) {
        return this.companies.search(ctx, query);
    }

    @Get('duplicates')
    @RequireAnyPermission('crm.companies.create', 'crm.companies.update')
    @ApiOperation({ summary: 'Possible duplicates for a name / website / email (02 §22)' })
    duplicates(@CurrentOrg() ctx: OrgContext, @Query() q: { name?: string; website?: string; email?: string; exclude_id?: string }) {
        return this.companies.findDuplicates(ctx, q);
    }

    @Get('export')
    @RequirePermission('crm.companies.export')
    @ApiOperation({ summary: 'Export companies as CSV (sensitive, audited)' })
    async export(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CompanyQuerySchema)) query: CompanyQuery, @Res() res: Response) {
        sendCsv(res, await this.companies.export(ctx, query));
    }

    @Get(':id')
    @RequirePermission('crm.companies.read')
    @ApiOperation({ summary: 'Get a company with its Customer 360 summary' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.companies.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('crm.companies.create')
    @ApiOperation({ summary: 'Create a company (409 possible_duplicates unless allow_duplicate)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateCompanyDto) {
        return this.companies.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('crm.companies.update')
    @ApiOperation({ summary: 'Update a company (owner change needs crm.companies.assign)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
        return this.companies.update(ctx, id, dto);
    }

    @Post(':id/assign')
    @RequirePermission('crm.companies.assign')
    @ApiOperation({ summary: 'Change the owner' })
    assign(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignOwnerDto) {
        return this.companies.assign(ctx, id, dto.owner_membership_id);
    }

    @Post(':id/archive')
    @RequirePermission('crm.companies.archive')
    @ApiOperation({ summary: 'Archive a company' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.companies.archive(ctx, id);
    }

    @Post(':id/restore')
    @RequirePermission('crm.companies.archive')
    @ApiOperation({ summary: 'Restore an archived company' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.companies.restore(ctx, id);
    }

    @Delete(':id')
    @RequirePermission('crm.companies.delete')
    @ApiOperation({ summary: 'Delete a company without deals (sensitive)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.companies.remove(ctx, id);
    }
}
