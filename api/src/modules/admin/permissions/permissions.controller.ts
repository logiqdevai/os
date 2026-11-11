import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { PermissionsService } from './permissions.service';
import { CreateGrantDto, GrantQuery, GrantQuerySchema, PermissionQuery, PermissionQuerySchema, SimulateDto } from './dto/permission.dto';

@ApiTags('Admin · Permissions')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class PermissionsController {
    constructor(private readonly permissions: PermissionsService) { }

    @Get('permissions')
    @RequirePermission('users.permissions.read')
    @ApiOperation({ summary: 'Permission catalog (read-only; defined in code)' })
    catalog(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PermissionQuerySchema)) query: PermissionQuery) {
        return this.permissions.catalog(ctx, query);
    }

    @Post('permissions/simulate')
    @HttpCode(200)
    @RequirePermission('users.permissions.simulate')
    @ApiOperation({ summary: 'Explain whether a member may do something (read-only)' })
    simulate(@CurrentOrg() ctx: OrgContext, @Body() dto: SimulateDto) {
        return this.permissions.simulate(ctx, dto);
    }

    @Get('permission-grants')
    @RequirePermission('users.permissions.read')
    @ApiOperation({ summary: 'Active per-member allow / deny grants' })
    grants(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(GrantQuerySchema)) query: GrantQuery) {
        return this.permissions.grants(ctx, query);
    }

    @Post('permission-grants')
    @RequirePermission('users.permissions.grant')
    @ApiOperation({ summary: 'Allow or deny one permission for a member (deny wins)' })
    createGrant(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateGrantDto) {
        return this.permissions.createGrant(ctx, dto);
    }

    @Delete('permission-grants/:id')
    @RequirePermission('users.permissions.grant')
    @ApiOperation({ summary: 'Revoke a grant or deny' })
    revokeGrant(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.permissions.revokeGrant(ctx, id);
    }
}
