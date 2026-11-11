import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { BillingRatesService } from './billing-rates.service';
import { BillingRateQuery, BillingRateQuerySchema, CreateBillingRateDto, ResolveRateQuery, ResolveRateQuerySchema, UpdateBillingRateDto } from './dto/billing-rate.dto';

/** /time/rates — sensitive (money): read needs time.rates.read, writes time.rates.manage. */
@ApiTags('Time · Rates')
@ApiBearerAuth()
@Controller('time/rates')
@UseGuards(JwtGuard, PermissionsGuard)
export class BillingRatesController {
    constructor(private readonly rates: BillingRatesService) { }

    @Get()
    @RequirePermission('time.rates.read')
    @ApiOperation({ summary: 'List billing and cost rates (status=active|scheduled|expired|archived|all)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(BillingRateQuerySchema)) query: BillingRateQuery) {
        return this.rates.findAll(ctx, query);
    }

    @Get('resolve')
    @RequirePermission('time.rates.read')
    @ApiOperation({ summary: 'Which billing / cost rate applies for a member, project and activity on a date' })
    resolve(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ResolveRateQuerySchema)) query: ResolveRateQuery) {
        return this.rates.resolve(ctx, query);
    }

    @Get(':id')
    @RequirePermission('time.rates.read')
    @ApiOperation({ summary: 'Get a rate' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rates.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('time.rates.manage')
    @ApiOperation({ summary: 'Create a rate (overlapping periods for the same target are refused)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateBillingRateDto) {
        return this.rates.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('time.rates.manage')
    @ApiOperation({ summary: 'Update a rate (used rates: name, notes and end date only)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBillingRateDto) {
        return this.rates.update(ctx, id, dto);
    }

    @Post(':id/archive')
    @RequirePermission('time.rates.manage')
    @ApiOperation({ summary: 'Archive a rate' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.rates.archive(ctx, id);
    }
}
