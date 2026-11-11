import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { CsatQuery, CsatQuerySchema, CsatService } from './csat.service';

@ApiTags('Support · CSAT')
@ApiBearerAuth()
@Controller('support/csat')
@UseGuards(JwtGuard, PermissionsGuard)
export class CsatController {
    constructor(private readonly csat: CsatService) { }

    @Get('summary')
    @RequirePermission('support.csat.read')
    @ApiOperation({ summary: 'CSAT summary (average, distribution, response rate; per agent with support.analytics.read)' })
    summary(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CsatQuerySchema)) q: CsatQuery) {
        return this.csat.summary(ctx, q);
    }

    @Get('ratings')
    @RequirePermission('support.csat.read')
    @ApiOperation({ summary: 'Submitted CSAT ratings' })
    ratings(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CsatQuerySchema)) q: CsatQuery) {
        return this.csat.ratings(ctx, q);
    }
}
