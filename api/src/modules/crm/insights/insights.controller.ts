import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { CrmInsightsService, DashboardQuery, DashboardQuerySchema, ForecastQuery, ForecastQuerySchema } from './insights.service';

@ApiTags('CRM · Dashboard & forecast')
@ApiBearerAuth()
@Controller('crm')
@UseGuards(JwtGuard, PermissionsGuard)
export class CrmInsightsController {
    constructor(private readonly insights: CrmInsightsService) { }

    @Get('dashboard')
    @RequirePermission('crm.dashboards.read')
    @ApiOperation({ summary: 'CRM KPIs: pipeline value, weighted value, won this month, win rate, conversion (money needs crm.financials.read)' })
    dashboard(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DashboardQuerySchema)) query: DashboardQuery) {
        return this.insights.dashboard(ctx, query);
    }

    @Get('forecast')
    @RequirePermission('crm.forecast.read')
    @ApiOperation({ summary: 'Open deals by expected close month (total, weighted, commit / best case / pipeline)' })
    forecast(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ForecastQuerySchema)) query: ForecastQuery) {
        return this.insights.forecast(ctx, query);
    }
}
