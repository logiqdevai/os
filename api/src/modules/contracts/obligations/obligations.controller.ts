import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContractObligationStatus } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ContractObligationsService } from './obligations.service';
import { CreateObligationDto, ObligationQuery, ObligationQuerySchema, UpdateObligationDto } from './dto/obligation.dto';

const READ = 'contracts.contracts.read';
const MANAGE = 'contracts.obligations.manage';

@ApiTags('Contracts · Obligations')
@ApiBearerAuth()
@Controller('contract-obligations')
@UseGuards(JwtGuard, PermissionsGuard)
export class ContractObligationsController {
    constructor(private readonly obligations: ContractObligationsService) { }

    @Get() @RequirePermission(READ) @ApiOperation({ summary: 'List obligations across contracts' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ObligationQuerySchema)) q: ObligationQuery) { return this.obligations.findAll(ctx, q); }

    @Get(':id') @RequirePermission(READ) @ApiOperation({ summary: 'Get an obligation' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.obligations.findOne(ctx, id); }

    @Post() @RequirePermission(MANAGE) @ApiOperation({ summary: 'Create an obligation' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateObligationDto) { return this.obligations.create(ctx, dto); }

    @Patch(':id') @RequirePermission(MANAGE) @ApiOperation({ summary: 'Update an obligation' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateObligationDto) { return this.obligations.update(ctx, id, dto); }

    @Post(':id/fulfil') @RequirePermission(MANAGE) @ApiOperation({ summary: 'Mark fulfilled' })
    fulfil(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.obligations.setStatus(ctx, id, ContractObligationStatus.FULFILLED); }

    @Post(':id/waive') @RequirePermission(MANAGE) @ApiOperation({ summary: 'Waive' })
    waive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.obligations.setStatus(ctx, id, ContractObligationStatus.WAIVED); }

    @Delete(':id') @RequirePermission(MANAGE) @ApiOperation({ summary: 'Delete an obligation' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) { return this.obligations.remove(ctx, id); }
}
