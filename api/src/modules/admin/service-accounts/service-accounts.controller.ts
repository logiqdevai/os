import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceAccountStatus } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ServiceAccountsService } from './service-accounts.service';
import { CreateServiceAccountDto, ServiceAccountQuery, ServiceAccountQuerySchema, ServiceAccountRoleDto, UpdateServiceAccountDto } from './dto/service-account.dto';

const MANAGE = 'organizations.service_accounts.manage';

@ApiTags('Admin · Service accounts')
@ApiBearerAuth()
@Controller('service-accounts')
@UseGuards(JwtGuard, PermissionsGuard)
export class ServiceAccountsController {
    constructor(private readonly accounts: ServiceAccountsService) { }

    @Get()
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'List service accounts' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ServiceAccountQuerySchema)) query: ServiceAccountQuery) {
        return this.accounts.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Service account with roles and API keys' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.accounts.findOne(ctx, id);
    }

    @Post()
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Create a service account (optionally with a role)' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateServiceAccountDto) {
        return this.accounts.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Update name, purpose, owner or expiry' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceAccountDto) {
        return this.accounts.update(ctx, id, dto);
    }

    @Post(':id/suspend')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Suspend (its keys stop working until reactivated)' })
    suspend(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.accounts.setStatus(ctx, id, ServiceAccountStatus.SUSPENDED);
    }

    @Post(':id/reactivate')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Reactivate a suspended service account' })
    reactivate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.accounts.setStatus(ctx, id, ServiceAccountStatus.ACTIVE);
    }

    @Post(':id/revoke')
    @HttpCode(200)
    @RequirePermission(MANAGE)
    @ApiOperation({ summary: 'Revoke permanently (also revokes its API keys)' })
    revoke(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.accounts.setStatus(ctx, id, ServiceAccountStatus.REVOKED);
    }

    @Post(':id/role-assignments')
    @RequirePermission(MANAGE, 'users.roles.assign')
    @ApiOperation({ summary: 'Assign a role to the service account' })
    assignRole(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ServiceAccountRoleDto) {
        return this.accounts.assignRole(ctx, id, dto);
    }

    @Delete(':id/role-assignments/:assignmentId')
    @RequirePermission(MANAGE, 'users.roles.assign')
    @ApiOperation({ summary: 'Remove a role from the service account' })
    removeRole(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('assignmentId', ParseUUIDPipe) assignmentId: string) {
        return this.accounts.removeRole(ctx, id, assignmentId);
    }
}
