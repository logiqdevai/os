import { Body, Controller, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { OrganizationService } from './organization.service';
import { ModuleToggleDto, UpdateBrandingDto, UpdateOrganizationDto } from './dto/organization.dto';

@ApiTags('Admin · Organization')
@ApiBearerAuth()
@Controller('organization')
@UseGuards(JwtGuard, PermissionsGuard)
export class OrganizationController {
    constructor(private readonly organization: OrganizationService) { }

    @Get()
    @RequireAnyPermission('organizations.settings.manage', 'organizations.branding.manage')
    @ApiOperation({ summary: 'Organization profile, defaults and branding' })
    get(@CurrentOrg() ctx: OrgContext) {
        return this.organization.get(ctx);
    }

    @Patch()
    @RequirePermission('organizations.settings.manage')
    @ApiOperation({ summary: 'Update the organization profile and defaults' })
    update(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateOrganizationDto) {
        return this.organization.update(ctx, dto);
    }

    @Patch('branding')
    @RequirePermission('organizations.branding.manage')
    @ApiOperation({ summary: 'Update branding (colors, logos); empty string clears a field' })
    branding(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateBrandingDto) {
        return this.organization.updateBranding(ctx, dto);
    }

    @Get('modules')
    @RequirePermission('organizations.modules.manage')
    @ApiOperation({ summary: 'Every module with its enablement for the organization' })
    modules(@CurrentOrg() ctx: OrgContext) {
        return this.organization.modules(ctx);
    }

    @Put('modules/:module')
    @RequirePermission('organizations.modules.manage')
    @ApiOperation({ summary: 'Enable or disable a module for the whole organization' })
    setModule(@CurrentOrg() ctx: OrgContext, @Param('module', new ZodValidationPipe(z.nativeEnum(ModuleKey))) module: ModuleKey, @Body() dto: ModuleToggleDto) {
        return this.organization.setModule(ctx, module, dto.enabled);
    }
}
