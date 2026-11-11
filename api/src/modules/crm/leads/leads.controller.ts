import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { sendCsv } from '../common/send-csv';
import { AssignOwnerDto } from '../companies/dto/company.dto';
import { CrmLeadsService } from './leads.service';
import { ConvertLeadDto, CreateLeadDto, LeadQuery, LeadQuerySchema, LeadStatusDto, UpdateLeadDto } from './dto/lead.dto';

@ApiTags('CRM · Leads')
@ApiBearerAuth()
@Controller('crm/leads')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmLeadsController {
    constructor(private readonly leads: CrmLeadsService) { }

    @Get()
    @RequirePermission('crm.leads.read')
    @ApiOperation({ summary: 'List leads (state=open|converted|lost|all)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LeadQuerySchema)) query: LeadQuery) {
        return this.leads.findAll(ctx, query);
    }

    @Get('duplicates')
    @RequireAnyPermission('crm.leads.create', 'crm.leads.update')
    @ApiOperation({ summary: 'Leads with the same email' })
    duplicates(@CurrentOrg() ctx: OrgContext, @Query() q: { email?: string; exclude_id?: string }) {
        return this.leads.findDuplicates(ctx, q);
    }

    @Get('export')
    @RequirePermission('crm.leads.export')
    @ApiOperation({ summary: 'Export leads as CSV (sensitive, audited)' })
    async export(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LeadQuerySchema)) query: LeadQuery, @Res() res: Response) {
        sendCsv(res, await this.leads.export(ctx, query));
    }

    @Get(':id')
    @RequirePermission('crm.leads.read')
    @ApiOperation({ summary: 'Get a lead' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.leads.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('crm.leads.create')
    @ApiOperation({ summary: 'Create a lead (409 possible_duplicates on the same email)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateLeadDto) {
        return this.leads.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('crm.leads.update')
    @ApiOperation({ summary: 'Update a lead' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
        return this.leads.update(ctx, id, dto);
    }

    @Post(':id/status')
    @RequirePermission('crm.leads.update')
    @ApiOperation({ summary: 'Change the lead status (lost statuses need lost_reason_id)' })
    status(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LeadStatusDto) {
        return this.leads.setStatus(ctx, id, dto);
    }

    @Post(':id/assign')
    @RequirePermission('crm.leads.assign')
    @ApiOperation({ summary: 'Change the lead owner' })
    assign(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignOwnerDto) {
        return this.leads.assign(ctx, id, dto.owner_membership_id);
    }

    @Get(':id/convert-preview')
    @RequirePermission('crm.leads.convert')
    @ApiOperation({ summary: 'Duplicate candidates and defaults for conversion' })
    convertPreview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.leads.convertPreview(ctx, id);
    }

    @Post(':id/convert')
    @RequirePermission('crm.leads.convert')
    @ApiOperation({ summary: 'Convert to company / contact / deal (needs the create key of each record created)' })
    convert(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertLeadDto) {
        return this.leads.convert(ctx, id, dto);
    }

    @Post(':id/archive')
    @RequirePermission('crm.leads.archive')
    @ApiOperation({ summary: 'Archive a lead' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.leads.archive(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('crm.leads.archive')
    @ApiOperation({ summary: 'Restore a lead' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.leads.archive(ctx, id, false);
    }

    @Delete(':id')
    @RequirePermission('crm.leads.delete')
    @ApiOperation({ summary: 'Delete a lead (sensitive)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.leads.remove(ctx, id);
    }
}
