import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleKey } from 'generated/prisma';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { MembersService } from './members.service';
import { AssignRoleDto, MemberBranchDto, ModuleAccessDto, ModuleKeyParam, OffboardMemberDto, UpdateMemberDto } from './dto/member.dto';
import { MemberQuery, MemberQuerySchema } from './dto/member-query.schema';

@ApiTags('Admin · Members')
@ApiBearerAuth()
@Controller('members')
@UseGuards(JwtGuard, PermissionsGuard)
export class MembersController {
    constructor(private readonly members: MembersService) { }

    @Get()
    @RequirePermission('users.members.read')
    @ApiOperation({ summary: 'List members (scoped to the caller)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(MemberQuerySchema)) query: MemberQuery) {
        return this.members.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('users.members.read')
    @ApiOperation({ summary: 'Member detail with roles, branches, teams and module access' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.members.findOne(ctx, id);
    }

    @Get(':id/effective-permissions')
    @RequirePermission('users.members.read', 'users.permissions.read')
    @ApiOperation({ summary: 'Effective permissions of a member with the source of each one' })
    effective(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.members.effectivePermissions(ctx, id);
    }

    @Patch(':id')
    @RequirePermission('users.members.manage')
    @ApiOperation({ summary: 'Update job title, type and defaults' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMemberDto) {
        return this.members.update(ctx, id, dto);
    }

    @Post(':id/suspend')
    @HttpCode(200)
    @RequirePermission('users.members.manage')
    @ApiOperation({ summary: 'Suspend a member (access stops immediately)' })
    suspend(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.members.suspend(ctx, id);
    }

    @Post(':id/reactivate')
    @HttpCode(200)
    @RequirePermission('users.members.manage')
    @ApiOperation({ summary: 'Reactivate a suspended or offboarded member' })
    reactivate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.members.reactivate(ctx, id);
    }

    @Post(':id/offboard')
    @HttpCode(200)
    @RequirePermission('users.members.offboard')
    @ApiOperation({ summary: 'Offboard a member: revoke roles, branches, teams and API keys' })
    offboard(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OffboardMemberDto) {
        return this.members.offboard(ctx, id, dto);
    }

    @Post(':id/role-assignments')
    @RequirePermission('users.roles.assign')
    @ApiOperation({ summary: 'Assign a role with a scope and optional expiry' })
    assignRole(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRoleDto) {
        return this.members.assignRole(ctx, id, dto);
    }

    @Delete(':id/role-assignments/:assignmentId')
    @RequirePermission('users.roles.assign')
    @ApiOperation({ summary: 'Remove a role assignment' })
    removeRole(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('assignmentId', ParseUUIDPipe) assignmentId: string) {
        return this.members.removeRole(ctx, id, assignmentId);
    }

    @Post(':id/branches')
    @RequirePermission('organizations.branches.members.manage')
    @ApiOperation({ summary: 'Add the member to a branch' })
    addBranch(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MemberBranchDto) {
        return this.members.addBranch(ctx, id, dto);
    }

    @Delete(':id/branches/:branchId')
    @RequirePermission('organizations.branches.members.manage')
    @ApiOperation({ summary: 'Remove the member from a branch' })
    removeBranch(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('branchId', ParseUUIDPipe) branchId: string) {
        return this.members.removeBranch(ctx, id, branchId);
    }

    @Put(':id/module-access/:module')
    @RequirePermission('users.members.manage')
    @ApiOperation({ summary: 'Enable or block one module for this member' })
    setModule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('module', new ZodValidationPipe(ModuleKeyParam)) module: ModuleKey, @Body() dto: ModuleAccessDto) {
        return this.members.setModuleAccess(ctx, id, module, dto.enabled);
    }

    @Delete(':id/module-access/:module')
    @RequirePermission('users.members.manage')
    @ApiOperation({ summary: 'Remove the per-member override (follow the organization setting)' })
    resetModule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('module', new ZodValidationPipe(ModuleKeyParam)) module: ModuleKey) {
        return this.members.resetModuleAccess(ctx, id, module);
    }
}
