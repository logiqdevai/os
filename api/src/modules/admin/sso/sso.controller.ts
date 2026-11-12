import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { AdminBody } from '../shared/zod-body.pipe';
import { SsoService } from './sso.service';
import {
    CreateSsoConfigurationInput,
    CreateSsoConfigurationSchema,
    GroupMappingInput,
    GroupMappingSchema,
    UpdateGroupMappingInput,
    UpdateGroupMappingSchema,
    UpdateSsoConfigurationInput,
    UpdateSsoConfigurationSchema,
} from './dto/sso.dto';

const KEY = 'organizations.sso.manage';

/** SSO identity providers + group mappings (01 §68–71). Secrets are write-only. */
@ApiTags('Admin · SSO')
@ApiBearerAuth()
@Controller('sso-configurations')
@UseGuards(JwtGuard, PermissionsGuard)
export class SsoController {
    constructor(private readonly sso: SsoService) { }

    @Get()
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'List identity providers with their group mappings' })
    findAll(@CurrentOrg() ctx: OrgContext) {
        return this.sso.findAll(ctx);
    }

    @Get(':id')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Get one identity provider' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.sso.get(ctx, id);
    }

    @Post()
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Add a SAML or OIDC identity provider' })
    create(@CurrentOrg() ctx: OrgContext, @Body(AdminBody(CreateSsoConfigurationSchema)) dto: CreateSsoConfigurationInput) {
        return this.sso.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Update settings or replace the client secret' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(AdminBody(UpdateSsoConfigurationSchema)) dto: UpdateSsoConfigurationInput) {
        return this.sso.update(ctx, id, dto);
    }

    @Delete(':id')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Delete an identity provider and its mappings' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.sso.remove(ctx, id);
    }

    @Post(':id/group-mappings')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Map an IdP group to a role / team / branch / modules' })
    addMapping(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(AdminBody(GroupMappingSchema)) dto: GroupMappingInput) {
        return this.sso.addMapping(ctx, id, dto);
    }

    @Patch(':id/group-mappings/:mappingId')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Change a group mapping' })
    updateMapping(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('mappingId', ParseUUIDPipe) mappingId: string, @Body(AdminBody(UpdateGroupMappingSchema)) dto: UpdateGroupMappingInput) {
        return this.sso.updateMapping(ctx, id, mappingId, dto);
    }

    @Delete(':id/group-mappings/:mappingId')
    @RequirePermission(KEY)
    @ApiOperation({ summary: 'Remove a group mapping' })
    removeMapping(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('mappingId', ParseUUIDPipe) mappingId: string) {
        return this.sso.removeMapping(ctx, id, mappingId);
    }
}
