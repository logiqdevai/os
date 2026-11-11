import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { AnalyticsQuery, AnalyticsQuerySchema, SupportAnalyticsService } from './analytics.service';

@ApiTags('Support · Analytics')
@ApiBearerAuth()
@Controller('support/analytics')
@UseGuards(JwtGuard, PermissionsGuard)
export class SupportAnalyticsController {
    constructor(private readonly analytics: SupportAnalyticsService) { }

    @Get('overview')
    @RequirePermission('support.analytics.read')
    @ApiOperation({ summary: 'Volume, first response, resolution, SLA compliance, CSAT, backlog and breakdowns (scope-limited)' })
    overview(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(AnalyticsQuerySchema)) q: AnalyticsQuery) {
        return this.analytics.overview(ctx, q);
    }
}
