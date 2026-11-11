import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { RolesService } from './roles.service';
import { CreateRoleDto, PublishRoleDto, RoleQuery, RoleQuerySchema, UpdateRoleDto } from './dto/role.dto';

@ApiTags('Admin · Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(JwtGuard, PermissionsGuard)
export class RolesController {
    constructor(private readonly roles: RolesService) { }

    @Get()
    @RequirePermission('users.roles.read')
    @ApiOperation({ summary: 'List system templates and the organization\'s custom roles' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(RoleQuerySchema)) query: RoleQuery) {
        return this.roles.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('users.roles.read')
    @ApiOperation({ summary: 'Role with permissions and published versions' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.roles.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('users.roles.manage')
    @ApiOperation({ summary: 'Create a custom role (draft), optionally cloned from a template' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateRoleDto) {
        return this.roles.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('users.roles.manage')
    @ApiOperation({ summary: 'Edit a custom role (permissions replace the current set)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
        return this.roles.update(ctx, id, dto);
    }

    @Post(':id/publish')
    @HttpCode(200)
    @RequirePermission('users.roles.manage')
    @ApiOperation({ summary: 'Publish the role (new version; takes effect for every holder)' })
    publish(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishRoleDto) {
        return this.roles.publish(ctx, id, dto.note);
    }

    @Post(':id/deprecate')
    @HttpCode(200)
    @RequirePermission('users.roles.manage')
    @ApiOperation({ summary: 'Deprecate a role (no new assignments)' })
    deprecate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.roles.deprecate(ctx, id);
    }
}
