import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto, IntegrationQuery, IntegrationQuerySchema, ReplaceSecretsDto, UpdateIntegrationDto } from './dto/integration.dto';

const READ = 'organizations.integrations.read';
const MANAGE = 'organizations.integrations.manage';

@ApiTags('Admin · Integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(JwtGuard, PermissionsGuard)
export class IntegrationsController {
    constructor(private readonly integrations: IntegrationsService) { }

    @Get('providers')
    @RequirePermission(READ)
    @ApiOperation({ summary: 'Supported providers with their secret and config fields' })
    providers() {
        return this.integrations.providers();
    }

    @Get()
    @RequirePermission(READ)
    @ApiOperation({ summary: 'Connections (key hints only, never secrets)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(IntegrationQuerySchema)) query: IntegrationQuery) {
        return this.integrations.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission(READ)
    @ApiOperation({ summary: 'Connection detail with 30-day usage' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.integrations.findOne(ctx, id);
    }

    @Post()
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Connect a provider with the organization\'s own credentials (verified right away)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateIntegrationDto) {
        return this.integrations.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Update name, configuration, branch or usage limits' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIntegrationDto) {
        return this.integrations.update(ctx, id, dto);
    }

    @Put(':id/secrets')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Replace secret values (re-verifies)' })
    secrets(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceSecretsDto) {
        return this.integrations.replaceSecrets(ctx, id, dto.secrets);
    }

    @Post(':id/verify')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Test the stored credentials against the provider' })
    verify(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.integrations.verify(ctx, id);
    }

    @Post(':id/default')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Make this the default connection of its category' })
    setDefault(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.integrations.setDefault(ctx, id);
    }

    @Post(':id/enable')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Enable a disabled connection' })
    enable(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.integrations.setEnabled(ctx, id, true);
    }

    @Post(':id/disable')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Disable (secret kept)' })
    disable(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.integrations.setEnabled(ctx, id, false);
    }

    @Delete(':id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Disconnect and destroy the secret' })
    disconnect(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.integrations.disconnect(ctx, id);
    }
}
