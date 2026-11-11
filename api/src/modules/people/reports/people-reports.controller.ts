import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { P } from '../common/people.utils';
import { PeopleReportsService } from './people-reports.service';
import { CapacityQuery, CapacityQuerySchema, CapacityService } from '../capacity/capacity.service';

@ApiTags('People · Reports')
@ApiBearerAuth()
@Controller('people')
@UseGuards(JwtGuard, PermissionsGuard)
export class PeopleReportsController {
    constructor(private readonly reports: PeopleReportsService, private readonly capacity: CapacityService) { }

    @Get('reports/overview')
    @RequireAnyPermission(P.read, P.leaveReadAll, P.attReadAll, P.capacity, P.perfReadAll)
    @ApiOperation({ summary: 'People dashboard: blocks the caller may read (others are null)' })
    overview(@CurrentOrg() ctx: OrgContext) {
        return this.reports.overview(ctx);
    }

    @Get('capacity')
    @RequirePermission(P.capacity)
    @ApiOperation({ summary: 'Weekly capacity per employee: available (schedule − holidays − leave), planned (05), logged (18)' })
    weeks(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CapacityQuerySchema)) query: CapacityQuery) {
        return this.capacity.weeks(ctx, query);
    }
}
