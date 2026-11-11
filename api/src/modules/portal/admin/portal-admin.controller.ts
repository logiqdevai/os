import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { PortalAdminService } from './portal-admin.service';
import {
    CreatePortalInvitationDto,
    EnableClientDto,
    PortalActivityQuery,
    PortalActivityQuerySchema,
    PortalApprovalQuery,
    PortalApprovalQuerySchema,
    PortalClientQuery,
    PortalClientQuerySchema,
    PortalInvitationQuery,
    PortalInvitationQuerySchema,
    PortalUserProjectsDto,
    PortalUserQuery,
    PortalUserQuerySchema,
    ProfileChangeQuery,
    ProfileChangeQuerySchema,
    ReviewProfileChangeDto,
    UpdateClientSettingsDto,
    UpdatePortalSettingsDto,
    UpdatePortalUserDto,
} from './dto/portal-admin.dto';

const VIEW = ['portal.users.read', 'portal.users.manage', 'portal.settings.manage', 'portal.activity.read'];

@ApiTags('Client portal · Admin')
@ApiBearerAuth()
@Controller('portal/admin')
@UseGuards(JwtGuard, PermissionsGuard)
export class PortalAdminController {
    constructor(private readonly admin: PortalAdminService) { }

    @Get('overview')
    @RequireAnyPermission(...VIEW)
    @ApiOperation({ summary: 'Portal overview counts' })
    overview(@CurrentOrg() ctx: OrgContext) {
        return this.admin.overview(ctx);
    }

    @Get('settings')
    @RequireAnyPermission(...VIEW)
    @ApiOperation({ summary: 'Portal settings, feature toggles and branding' })
    settings(@CurrentOrg() ctx: OrgContext) {
        return this.admin.settings(ctx);
    }

    @Patch('settings')
    @RequirePermission('portal.settings.manage')
    @ApiOperation({ summary: 'Update portal settings and branding' })
    updateSettings(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdatePortalSettingsDto) {
        return this.admin.updateSettings(ctx, dto);
    }

    @Get('clients')
    @RequireAnyPermission('portal.users.read', 'portal.users.manage', 'portal.settings.manage')
    @ApiOperation({ summary: 'Customers with their portal status and user counts' })
    clients(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PortalClientQuerySchema)) q: PortalClientQuery) {
        return this.admin.clients(ctx, q);
    }

    @Get('clients/:companyId')
    @RequireAnyPermission('portal.users.read', 'portal.users.manage', 'portal.settings.manage')
    @ApiOperation({ summary: 'One client: portal settings, users, invitations, projects' })
    client(@CurrentOrg() ctx: OrgContext, @Param('companyId', ParseUUIDPipe) companyId: string) {
        return this.admin.client(ctx, companyId);
    }

    @Post('clients/:companyId/enable')
    @RequirePermission('portal.settings.manage')
    @ApiOperation({ summary: 'Enable the portal for a client (optionally invite people; that needs portal.users.manage)' })
    enable(@CurrentOrg() ctx: OrgContext, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: EnableClientDto) {
        return this.admin.enableClient(ctx, companyId, dto);
    }

    @Post('clients/:companyId/disable')
    @RequirePermission('portal.settings.manage')
    @ApiOperation({ summary: 'Switch the portal off for a client (pending invitations are cancelled)' })
    disable(@CurrentOrg() ctx: OrgContext, @Param('companyId', ParseUUIDPipe) companyId: string) {
        return this.admin.disableClient(ctx, companyId);
    }

    @Patch('clients/:companyId/settings')
    @RequirePermission('portal.settings.manage')
    @ApiOperation({ summary: 'Per-client overrides (features, default role, welcome message)' })
    clientSettings(@CurrentOrg() ctx: OrgContext, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: UpdateClientSettingsDto) {
        return this.admin.updateClientSettings(ctx, companyId, dto);
    }

    @Get('users')
    @RequireAnyPermission('portal.users.read', 'portal.users.manage')
    @ApiOperation({ summary: 'Portal users across clients' })
    users(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PortalUserQuerySchema)) q: PortalUserQuery) {
        return this.admin.users(ctx, q);
    }

    @Get('users/:id')
    @RequireAnyPermission('portal.users.read', 'portal.users.manage')
    @ApiOperation({ summary: 'One portal user with project access and activity' })
    user(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.user(ctx, id);
    }

    @Patch('users/:id')
    @RequirePermission('portal.users.manage')
    @ApiOperation({ summary: 'Change role or status (suspend, deactivate, reactivate)' })
    updateUser(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePortalUserDto) {
        return this.admin.updateUser(ctx, id, dto);
    }

    @Put('users/:id/projects')
    @RequirePermission('portal.users.manage')
    @ApiOperation({ summary: 'Limit a portal user to specific projects (empty = all customer-visible projects)' })
    userProjects(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PortalUserProjectsDto) {
        return this.admin.setUserProjects(ctx, id, dto.project_ids);
    }

    @Get('roles')
    @RequireAnyPermission('portal.users.read', 'portal.users.manage', 'portal.settings.manage')
    @ApiOperation({ summary: 'Customer roles with their portal.* permissions' })
    roles(@CurrentOrg() ctx: OrgContext) {
        return this.admin.roles(ctx);
    }

    @Get('invitations')
    @RequireAnyPermission('portal.users.read', 'portal.users.manage')
    @ApiOperation({ summary: 'Portal invitations' })
    invitations(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PortalInvitationQuerySchema)) q: PortalInvitationQuery) {
        return this.admin.invitationsList(ctx, q);
    }

    @Post('invitations')
    @RequirePermission('portal.users.manage')
    @ApiOperation({ summary: 'Invite people of a client to the portal' })
    invite(@CurrentOrg() ctx: OrgContext, @Body() dto: CreatePortalInvitationDto) {
        return this.admin.invite(ctx, dto);
    }

    @Post('invitations/:id/resend')
    @RequirePermission('portal.users.manage')
    @ApiOperation({ summary: 'Resend an invitation (new link)' })
    resend(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.resend(ctx, id);
    }

    @Post('invitations/:id/cancel')
    @RequirePermission('portal.users.manage')
    @ApiOperation({ summary: 'Cancel an invitation' })
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.cancel(ctx, id);
    }

    @Get('profile-changes')
    @RequirePermission('portal.profile_changes.review')
    @ApiOperation({ summary: 'Customer profile change requests' })
    profileChanges(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ProfileChangeQuerySchema)) q: ProfileChangeQuery) {
        return this.admin.profileChanges(ctx, q);
    }

    @Post('profile-changes/:id/approve')
    @RequirePermission('portal.profile_changes.review')
    @ApiOperation({ summary: 'Approve and apply to the CRM record (needs crm.companies.update / crm.contacts.update)' })
    approve(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewProfileChangeDto) {
        return this.admin.reviewProfileChange(ctx, id, true, dto.review_note);
    }

    @Post('profile-changes/:id/reject')
    @RequirePermission('portal.profile_changes.review')
    @ApiOperation({ summary: 'Reject a profile change' })
    reject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewProfileChangeDto) {
        return this.admin.reviewProfileChange(ctx, id, false, dto.review_note);
    }

    @Get('activity')
    @RequirePermission('portal.activity.read')
    @ApiOperation({ summary: 'What portal users did (audit events)' })
    activity(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PortalActivityQuerySchema)) q: PortalActivityQuery) {
        return this.admin.activity(ctx, q);
    }

    @Get('approvals')
    @RequirePermission('projects.projects.read')
    @ApiOperation({ summary: 'Customer-visible deliverables awaiting or past customer review' })
    approvals(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(PortalApprovalQuerySchema)) q: PortalApprovalQuery) {
        return this.admin.approvals(ctx, q);
    }
}
