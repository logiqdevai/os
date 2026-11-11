import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, PipeTransform, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CrmSettingsService } from './settings.service';
import { CreateSettingItemDto, ReorderSettingDto, SETTING_KINDS, SettingKind, UpdateSettingItemDto } from './dto/setting.dto';

class SettingKindPipe implements PipeTransform<string, SettingKind> {
    transform(value: string): SettingKind {
        if (!(SETTING_KINDS as readonly string[]).includes(value)) throw new BadRequestException({ message: `Unknown settings list ${value}`, code: 'invalid_kind' });
        return value as SettingKind;
    }
}

const ANY_CRM_READ = ['crm.deals.read', 'crm.leads.read', 'crm.companies.read', 'crm.contacts.read', 'crm.activities.read', 'crm.settings.manage'];

@ApiTags('CRM · Settings')
@ApiBearerAuth()
@Controller('crm')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmSettingsController {
    constructor(private readonly settings: CrmSettingsService) { }

    @Get('settings')
    @RequireAnyPermission(...ANY_CRM_READ)
    @ApiOperation({ summary: 'Lead sources, lead statuses, lifecycle stages and loss reasons (creates defaults on first use)' })
    all(@CurrentOrg() ctx: OrgContext, @Query('archived') archived?: string) {
        return this.settings.all(ctx, archived === 'true' && ctx.can('crm.settings.manage'));
    }

    @Get('members')
    @RequireAnyPermission(...ANY_CRM_READ)
    @ApiOperation({ summary: 'Active members for owner and assignee pickers' })
    members(@CurrentOrg() ctx: OrgContext, @Query('search') search?: string) {
        return this.settings.members(ctx, search);
    }

    @Post('settings/:kind')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Add an option (kind = lead-sources | lead-statuses | lifecycle-stages | loss-reasons)' })
    create(@CurrentOrg() ctx: OrgContext, @Param('kind', SettingKindPipe) kind: SettingKind, @Body() dto: CreateSettingItemDto) {
        return this.settings.create(ctx, kind, dto);
    }

    @Put('settings/:kind/order')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Reorder options' })
    reorder(@CurrentOrg() ctx: OrgContext, @Param('kind', SettingKindPipe) kind: SettingKind, @Body() dto: ReorderSettingDto) {
        return this.settings.reorder(ctx, kind, dto.ids);
    }

    @Patch('settings/:kind/:id')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Rename or change flags of an option' })
    update(@CurrentOrg() ctx: OrgContext, @Param('kind', SettingKindPipe) kind: SettingKind, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSettingItemDto) {
        return this.settings.update(ctx, kind, id, dto);
    }

    @Post('settings/:kind/:id/archive')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Archive an option (stays on old records)' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('kind', SettingKindPipe) kind: SettingKind, @Param('id', ParseUUIDPipe) id: string) {
        return this.settings.archive(ctx, kind, id, true);
    }

    @Post('settings/:kind/:id/restore')
    @RequirePermission('crm.settings.manage')
    @ApiOperation({ summary: 'Restore an archived option' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('kind', SettingKindPipe) kind: SettingKind, @Param('id', ParseUUIDPipe) id: string) {
        return this.settings.archive(ctx, kind, id, false);
    }
}
