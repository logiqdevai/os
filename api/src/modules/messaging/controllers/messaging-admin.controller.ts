import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, Public, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { CreateRestrictionInput, CreateRestrictionSchema, DecideReportInput, DecideReportSchema, MessagingModerationService, ReportQuery, ReportQuerySchema } from '../services/moderation.service';
import {
    ExportInput, ExportSchema, LegalHoldInput, LegalHoldSchema, MessagingGovernanceService, RetentionPolicyInput, RetentionPolicySchema,
} from '../services/governance.service';
import {
    GuestQuery, GuestQuerySchema, InboundHookInput, InboundHookSchema, IntegrationInput, IntegrationSchema, MessagingAdminService, MessagingSettingsInput, MessagingSettingsSchema,
    OverviewQuery, OverviewQuerySchema, UpdateGuestInput, UpdateGuestSchema, UpdateIntegrationInput, UpdateIntegrationSchema,
} from '../services/messaging-admin.service';

const Flag = z.object({ include_released: z.enum(['true', 'false']).optional(), active: z.enum(['true', 'false']).optional() });

/** Messaging administration: overview, moderation, retention / legal hold / export, guests, settings, integrations (12 §49–55, §80–82). */
@ApiTags('Messaging · Admin')
@ApiBearerAuth()
@Controller('messaging')
@UseGuards(JwtGuard, PermissionsGuard)
export class MessagingAdminController {
    constructor(
        private readonly admin: MessagingAdminService,
        private readonly moderation: MessagingModerationService,
        private readonly governance: MessagingGovernanceService,
    ) { }

    // --- overview
    @Get('admin/overview')
    @RequireAnyPermission('messaging.analytics.read', 'messaging.settings.manage')
    @ApiOperation({ summary: 'Usage overview: messages, DMs, threads, files, calls, guests, moderation (aggregates only)' })
    overview(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(OverviewQuerySchema)) q: OverviewQuery) {
        return this.admin.overview(ctx, q);
    }

    // --- moderation
    @Get('reports')
    @RequirePermission('messaging.moderation.manage')
    reports(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ReportQuerySchema)) q: ReportQuery) {
        return this.moderation.reports(ctx, q);
    }

    @Get('reports/:id')
    @RequirePermission('messaging.moderation.manage')
    @ApiOperation({ summary: 'Report with the reported message and a little context' })
    report(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.moderation.reportDetail(ctx, id);
    }

    @Patch('reports/:id')
    @RequirePermission('messaging.moderation.manage')
    @ApiOperation({ summary: 'Decide a report: dismiss, or hide / delete the message, mute / ban the author' })
    decide(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(DecideReportSchema)) dto: DecideReportInput) {
        return this.moderation.decide(ctx, id, dto);
    }

    @Get('restrictions')
    @RequirePermission('messaging.moderation.manage')
    restrictions(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(Flag)) q: { active?: string }) {
        return this.moderation.restrictions(ctx, q.active !== 'false');
    }

    @Post('restrictions')
    @RequirePermission('messaging.moderation.manage')
    @ApiOperation({ summary: 'Mute or ban a member in a channel or everywhere (channel_id null)' })
    restrict(@CurrentOrg() ctx: OrgContext, @Body(ZBody(CreateRestrictionSchema)) dto: CreateRestrictionInput) {
        return this.moderation.restrict(ctx, dto);
    }

    @Post('restrictions/:id/lift')
    @RequirePermission('messaging.moderation.manage')
    lift(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.moderation.lift(ctx, id);
    }

    // --- retention, legal holds, exports
    @Get('retention-policies')
    @RequireAnyPermission('messaging.retention.manage', 'messaging.audit.read')
    policies(@CurrentOrg() ctx: OrgContext) {
        return this.governance.policies(ctx);
    }

    @Post('retention-policies')
    @RequirePermission('messaging.retention.manage')
    createPolicy(@CurrentOrg() ctx: OrgContext, @Body(ZBody(RetentionPolicySchema)) dto: RetentionPolicyInput) {
        return this.governance.createPolicy(ctx, dto);
    }

    @Put('retention-policies/:id')
    @RequirePermission('messaging.retention.manage')
    updatePolicy(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(RetentionPolicySchema)) dto: RetentionPolicyInput) {
        return this.governance.updatePolicy(ctx, id, dto);
    }

    @Delete('retention-policies/:id')
    @RequirePermission('messaging.retention.manage')
    deletePolicy(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.governance.deletePolicy(ctx, id);
    }

    @Post('retention-policies/:id/preview')
    @RequirePermission('messaging.retention.manage')
    @ApiOperation({ summary: 'Dry run: how many messages / files / channels the policy would affect now' })
    preview(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.governance.runPolicy(ctx, id, true);
    }

    @Post('retention-policies/:id/run')
    @RequirePermission('messaging.retention.manage')
    @ApiOperation({ summary: 'Apply the policy now (legal holds are respected; deletions are permanent)' })
    run(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.governance.runPolicy(ctx, id, false);
    }

    @Get('legal-holds')
    @RequireAnyPermission('messaging.retention.manage', 'messaging.audit.read')
    holds(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(Flag)) q: { include_released?: string }) {
        return this.governance.holds(ctx, q.include_released === 'true');
    }

    @Post('legal-holds')
    @RequirePermission('messaging.retention.manage')
    createHold(@CurrentOrg() ctx: OrgContext, @Body(ZBody(LegalHoldSchema)) dto: LegalHoldInput) {
        return this.governance.createHold(ctx, dto);
    }

    @Post('legal-holds/:id/release')
    @RequirePermission('messaging.retention.manage')
    releaseHold(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.governance.releaseHold(ctx, id);
    }

    @Get('exports')
    @RequirePermission('messaging.data.export')
    exports(@CurrentOrg() ctx: OrgContext) {
        return this.governance.exports(ctx);
    }

    @Post('exports')
    @RequirePermission('messaging.data.export')
    @ApiOperation({ summary: 'Request an export (JSON / CSV / HTML) of messages by channel, kind, person and dates' })
    requestExport(@CurrentOrg() ctx: OrgContext, @Body(ZBody(ExportSchema)) dto: ExportInput) {
        return this.governance.requestExport(ctx, dto);
    }

    @Get('exports/:id/download')
    @RequirePermission('messaging.data.export')
    download(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.governance.exportDownload(ctx, id);
    }

    // --- guests
    @Get('guests')
    @RequirePermission('messaging.external_users.manage')
    guests(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(GuestQuerySchema)) q: GuestQuery) {
        return this.admin.guests(ctx, q);
    }

    @Patch('guests/:memberId')
    @RequirePermission('messaging.external_users.manage')
    updateGuest(@CurrentOrg() ctx: OrgContext, @Param('memberId', ParseUUIDPipe) id: string, @Body(ZBody(UpdateGuestSchema)) dto: UpdateGuestInput) {
        return this.admin.updateGuest(ctx, id, dto);
    }

    @Delete('guests/:memberId')
    @RequirePermission('messaging.external_users.manage')
    removeGuest(@CurrentOrg() ctx: OrgContext, @Param('memberId', ParseUUIDPipe) id: string) {
        return this.admin.removeGuest(ctx, id);
    }

    @Post('invitations/:id/revoke')
    @RequirePermission('messaging.external_users.manage')
    revoke(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.revokeInvitation(ctx, id);
    }

    // --- settings
    @Get('settings')
    @RequireAnyPermission('messaging.settings.manage', 'messaging.audit.read')
    settings(@CurrentOrg() ctx: OrgContext) {
        return this.admin.getSettings(ctx);
    }

    @Patch('settings')
    @RequirePermission('messaging.settings.manage')
    updateSettings(@CurrentOrg() ctx: OrgContext, @Body(ZBody(MessagingSettingsSchema)) dto: MessagingSettingsInput) {
        return this.admin.updateSettings(ctx, dto);
    }

    // --- integrations
    @Get('integrations')
    @RequirePermission('messaging.integrations.manage')
    integrations(@CurrentOrg() ctx: OrgContext) {
        return this.admin.integrations(ctx);
    }

    @Post('integrations')
    @RequirePermission('messaging.integrations.manage')
    @ApiOperation({ summary: 'Create an inbound webhook / bot; the token is returned once' })
    createIntegration(@CurrentOrg() ctx: OrgContext, @Body(ZBody(IntegrationSchema)) dto: IntegrationInput) {
        return this.admin.createIntegration(ctx, dto);
    }

    @Patch('integrations/:id')
    @RequirePermission('messaging.integrations.manage')
    updateIntegration(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(UpdateIntegrationSchema)) dto: UpdateIntegrationInput) {
        return this.admin.updateIntegration(ctx, id, dto);
    }

    @Post('integrations/:id/rotate-token')
    @RequirePermission('messaging.integrations.manage')
    rotate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.rotateToken(ctx, id);
    }

    @Post('integrations/:id/test')
    @RequirePermission('messaging.integrations.manage')
    test(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.testIntegration(ctx, id);
    }

    @Delete('integrations/:id')
    @RequirePermission('messaging.integrations.manage')
    disconnect(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.disconnectIntegration(ctx, id);
    }
}

/** Public inbound webhook of messaging integrations (the token in the path is the credential; only its sha256 is stored). */
@ApiTags('Messaging · Hooks')
@Controller('messaging/hooks')
export class MessagingHooksController {
    constructor(private readonly admin: MessagingAdminService) { }

    @Post(':token')
    @Public()
    @HttpCode(200)
    @ApiExcludeEndpoint()
    inbound(@Param('token') token: string, @Body(ZBody(InboundHookSchema)) dto: InboundHookInput) {
        return this.admin.inbound(token, dto);
    }
}
