import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { AdminBody } from '../shared/zod-body.pipe';
import { DelegationsService } from './delegations.service';
import { CreateDelegationInput, CreateDelegationSchema, DelegationQuery, DelegationQuerySchema, RevokeDelegationInput, RevokeDelegationSchema } from './dto/delegation.dto';

/** Temporary delegations (01 §94). Organization-wide holders see all; others only their own. */
@ApiTags('Admin · Delegations')
@ApiBearerAuth()
@Controller('delegations')
@UseGuards(JwtGuard, PermissionsGuard)
export class DelegationsController {
    constructor(private readonly delegations: DelegationsService) { }

    @Get()
    @RequirePermission('users.delegations.manage')
    @ApiOperation({ summary: 'List delegations (status is computed from the dates)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DelegationQuerySchema)) query: DelegationQuery) {
        return this.delegations.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('users.delegations.manage')
    @ApiOperation({ summary: 'Get one delegation' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.delegations.get(ctx, id);
    }

    @Post()
    @RequirePermission('users.delegations.manage')
    @ApiOperation({ summary: 'Delegate permissions or roles to a member for a period' })
    create(@CurrentOrg() ctx: OrgContext, @Body(AdminBody(CreateDelegationSchema)) dto: CreateDelegationInput) {
        return this.delegations.create(ctx, dto);
    }

    @Post(':id/revoke')
    @HttpCode(200)
    @RequirePermission('users.delegations.manage')
    @ApiOperation({ summary: 'End a delegation now' })
    revoke(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(AdminBody(RevokeDelegationSchema)) dto: RevokeDelegationInput) {
        return this.delegations.revoke(ctx, id, dto);
    }
}
