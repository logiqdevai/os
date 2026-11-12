import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { AutomationInsightsService } from './automation-insights.service';
import { AutomationSettingsService } from './automation-settings.service';
import { UpdateAutomationSettingsDto } from './dto/update-automation-settings.dto';

const CatalogQuerySchema = z.object({ module: z.nativeEnum(ModuleKey).optional(), search: z.string().optional() });
const ScopeQuerySchema = z.object({ search: z.string().max(100).optional() });
const UsageQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(90).optional().default(30) });

@ApiTags('Automation · Catalog & settings')
@ApiBearerAuth()
@Controller('automation')
@UseGuards(JwtGuard, PermissionsGuard)
export class AutomationSettingsController {
    constructor(
        private readonly settings: AutomationSettingsService,
        private readonly insights: AutomationInsightsService,
    ) { }

    @Get('overview')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'Dashboard aggregates (run numbers need automation.runs.read)' })
    overview(@CurrentOrg() ctx: OrgContext) {
        return this.insights.overview(ctx);
    }

    @Get('usage')
    @RequirePermission('automation.runs.read')
    usage(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(UsageQuerySchema)) query: z.infer<typeof UsageQuerySchema>) {
        return this.insights.usage(ctx, query.days);
    }

    @Get('agents')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'AI agents & MCP overview: tool-call stats (needs organizations.mcp_calls.read) and service accounts used by workflows' })
    agents(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(UsageQuerySchema)) query: z.infer<typeof UsageQuerySchema>) {
        return this.insights.agentsOverview(ctx, query.days);
    }

    @Get('triggers')
    @RequireAnyPermission('automation.rules.read', 'automation.webhooks.read')
    @ApiOperation({ summary: 'Trigger catalog + event keys discovered on the bus (also the event picker of outbound webhooks)' })
    triggers(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CatalogQuerySchema)) query: z.infer<typeof CatalogQuerySchema>) {
        return this.insights.triggers(ctx, query);
    }

    @Get('actions')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'Action catalog with availability and the permissions each action needs' })
    actions(@CurrentOrg() ctx: OrgContext) {
        return this.insights.actions(ctx);
    }

    @Get('tools')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'MCP tools the "Run any tool" step can call (only tools the caller holds)' })
    tools(@CurrentOrg() ctx: OrgContext) {
        return this.insights.tools(ctx);
    }

    @Get('scope-options')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'Branches, teams, roles and projects (caller scope) for the workflow builder and approval policies' })
    scopeOptions(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ScopeQuerySchema)) query: z.infer<typeof ScopeQuerySchema>) {
        return this.insights.scopeOptions(ctx, query.search);
    }

    @Get('settings')
    @RequirePermission('automation.rules.read')
    @ApiOperation({ summary: 'Engine settings (read)' })
    get(@CurrentOrg() ctx: OrgContext) {
        return this.settings.get(ctx);
    }

    @Patch('settings')
    @RequirePermission('automation.settings.manage')
    @ApiOperation({ summary: 'Update limits, safety, retention and defaults' })
    update(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateAutomationSettingsDto) {
        return this.settings.update(ctx, dto);
    }
}
