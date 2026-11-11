import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { SupportSettingsService } from './support-settings.service';
import { UpdateSupportSettingsDto } from './dto/support-settings.dto';

@ApiTags('Support · Settings')
@ApiBearerAuth()
@Controller('support/settings')
@UseGuards(JwtGuard, PermissionsGuard)
export class SupportSettingsController {
    constructor(private readonly settings: SupportSettingsService) { }

    @Get()
    @RequireAnyPermission('support.settings.manage', 'support.ai.configure', 'support.tickets.read', 'support.conversations.read')
    @ApiOperation({ summary: 'Support settings (created with defaults on first read)' })
    get(@CurrentOrg() ctx: OrgContext) {
        return this.settings.get(ctx);
    }

    @Patch()
    @RequireAnyPermission('support.settings.manage', 'support.ai.configure')
    @ApiOperation({ summary: 'Update support settings (AI fields need support.ai.configure)' })
    update(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateSupportSettingsDto) {
        return this.settings.update(ctx, dto);
    }
}
