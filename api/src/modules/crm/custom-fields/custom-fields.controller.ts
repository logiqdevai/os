import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { CrmCustomFieldsService } from './custom-fields.service';
import {
    CreateCustomFieldInput, CreateCustomFieldSchema, CreateFieldGroupInput, CreateFieldGroupSchema, CustomFieldQuery, CustomFieldQuerySchema,
    ReorderFieldsSchema, UpdateCustomFieldInput, UpdateCustomFieldSchema, UpdateFieldGroupInput, UpdateFieldGroupSchema,
} from './dto/custom-field.dto';

const MANAGE = 'platform.custom_fields.manage';
/** Forms and detail pages of every CRM record type need the definitions. */
const READERS = ['crm.companies.read', 'crm.contacts.read', 'crm.leads.read', 'crm.deals.read', MANAGE];

/** 02 §24–26 — custom field definitions (values are written through each record's create/update endpoint). */
@ApiTags('Platform · Custom fields')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmCustomFieldsController {
    constructor(private readonly fields: CrmCustomFieldsService) { }

    @Get('custom-fields')
    @RequireAnyPermission(...READERS)
    @ApiOperation({ summary: 'Custom field definitions (filter by entity_type; include_archived=true for settings)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CustomFieldQuerySchema)) query: CustomFieldQuery) {
        return this.fields.findAll(ctx, query);
    }

    @Get('custom-field-groups')
    @RequireAnyPermission(...READERS)
    @ApiOperation({ summary: 'Custom field groups' })
    groups(@CurrentOrg() ctx: OrgContext) {
        return this.fields.groups(ctx);
    }

    @Post('custom-field-groups')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Create a field group' })
    createGroup(@CurrentOrg() ctx: OrgContext, @Body(ZBody(CreateFieldGroupSchema)) dto: CreateFieldGroupInput) {
        return this.fields.createGroup(ctx, dto);
    }

    @Patch('custom-field-groups/:id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Rename / reorder a field group' })
    updateGroup(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(UpdateFieldGroupSchema)) dto: UpdateFieldGroupInput) {
        return this.fields.updateGroup(ctx, id, dto);
    }

    @Delete('custom-field-groups/:id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Delete a field group (its fields become ungrouped)' })
    removeGroup(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.fields.removeGroup(ctx, id);
    }

    @Put('custom-fields/order')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Set the display order of fields' })
    reorder(@CurrentOrg() ctx: OrgContext, @Body(ZBody(ReorderFieldsSchema)) dto: { ids: string[] }) {
        return this.fields.reorder(ctx, dto.ids);
    }

    @Get('custom-fields/:id')
    @RequireAnyPermission(...READERS)
    @ApiOperation({ summary: 'One definition with its usage count' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.fields.findOne(ctx, id);
    }

    @Post('custom-fields')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Create a custom field (key is the immutable API identifier)' })
    create(@CurrentOrg() ctx: OrgContext, @Body(ZBody(CreateCustomFieldSchema)) dto: CreateCustomFieldInput) {
        return this.fields.create(ctx, dto);
    }

    @Patch('custom-fields/:id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Update a custom field (type is locked once values exist)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(UpdateCustomFieldSchema)) dto: UpdateCustomFieldInput) {
        return this.fields.update(ctx, id, dto);
    }

    @Post('custom-fields/:id/archive')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Archive a field (values are kept, hidden from forms and exports)' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.fields.archive(ctx, id, true);
    }

    @Post('custom-fields/:id/restore')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Restore an archived field' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.fields.archive(ctx, id, false);
    }

    @Delete('custom-fields/:id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Delete an unused field (sensitive)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.fields.remove(ctx, id);
    }
}
