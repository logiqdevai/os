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
import { LookupQuery, LookupQuerySchema } from '../companies/dto/company-query.schema';
import { CrmContactsService } from './contacts.service';
import { ContactQuery, ContactQuerySchema, CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@ApiTags('CRM · Contacts')
@ApiBearerAuth()
@Controller('crm/contacts')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmContactsController {
    constructor(private readonly contacts: CrmContactsService) { }

    @Get()
    @RequirePermission('crm.contacts.read')
    @ApiOperation({ summary: 'List contacts (scoped)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ContactQuerySchema)) query: ContactQuery) {
        return this.contacts.findAll(ctx, query);
    }

    @Get('lookup')
    @RequirePermission('crm.contacts.read')
    @ApiOperation({ summary: 'Contact picker for other modules' })
    lookup(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(LookupQuerySchema)) query: LookupQuery) {
        return this.contacts.search(ctx, query);
    }

    @Get('duplicates')
    @RequireAnyPermission('crm.contacts.create', 'crm.contacts.update')
    @ApiOperation({ summary: 'Possible duplicates by email or full name' })
    duplicates(@CurrentOrg() ctx: OrgContext, @Query() q: { email?: string; first_name?: string; last_name?: string; exclude_id?: string }) {
        return this.contacts.findDuplicates(ctx, q);
    }

    @Get('export')
    @RequirePermission('crm.contacts.export')
    @ApiOperation({ summary: 'Export contacts as CSV (sensitive, audited)' })
    async export(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ContactQuerySchema)) query: ContactQuery, @Res() res: Response) {
        sendCsv(res, await this.contacts.export(ctx, query));
    }

    @Get(':id')
    @RequirePermission('crm.contacts.read')
    @ApiOperation({ summary: 'Get a contact' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.contacts.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('crm.contacts.create')
    @ApiOperation({ summary: 'Create a contact (409 possible_duplicates unless allow_duplicate)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateContactDto) {
        return this.contacts.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('crm.contacts.update')
    @ApiOperation({ summary: 'Update a contact' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto) {
        return this.contacts.update(ctx, id, dto);
    }

    @Post(':id/assign')
    @RequirePermission('crm.contacts.assign')
    @ApiOperation({ summary: 'Change the owner' })
    assign(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignOwnerDto) {
        return this.contacts.assign(ctx, id, dto.owner_membership_id);
    }

    @Post(':id/archive')
    @RequirePermission('crm.contacts.archive')
    @ApiOperation({ summary: 'Archive a contact' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.contacts.archive(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('crm.contacts.archive')
    @ApiOperation({ summary: 'Restore a contact' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.contacts.archive(ctx, id, false);
    }

    @Delete(':id')
    @RequirePermission('crm.contacts.delete')
    @ApiOperation({ summary: 'Delete a contact (sensitive)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.contacts.remove(ctx, id);
    }
}
