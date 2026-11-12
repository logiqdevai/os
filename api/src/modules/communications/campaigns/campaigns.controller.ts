import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { CampaignsService } from './campaigns.service';
import { CampaignVariantsService } from './campaign-variants.service';
import {
    CampaignDecisionDto, CampaignQuery, CampaignQuerySchema, CampaignRecipientQuery, CampaignRecipientQuerySchema, CreateCampaignDto, ScheduleCampaignDto,
    SetAudienceDto, SetVariantsInput, SetVariantsSchema, SubmitCampaignDto, TestSendDto, UpdateCampaignDto,
} from './dto/campaign.dto';

@ApiTags('Communications · Campaigns')
@ApiBearerAuth()
@Controller('communications/campaigns')
@UseGuards(JwtGuard, PermissionsGuard)
export class CampaignsController {
    constructor(
        private readonly campaigns: CampaignsService,
        private readonly variantsService: CampaignVariantsService,
    ) { }

    @Get()
    @RequirePermission('communications.campaigns.read')
    @ApiOperation({ summary: 'List campaigns (status=SENDING,SCHEDULED, channel, owner, search)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(CampaignQuerySchema)) query: CampaignQuery) {
        return this.campaigns.findAll(ctx, query);
    }

    @Get(':id')
    @RequirePermission('communications.campaigns.read')
    @ApiOperation({ summary: 'Get a campaign with audiences, approvals and runs' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.findOne(ctx, id);
    }

    @Get(':id/stats')
    @RequirePermission('communications.campaigns.read')
    @ApiOperation({ summary: 'Counters, rates, time series and top links of a campaign' })
    stats(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.stats(ctx, id);
    }

    @Get(':id/recipients')
    @RequirePermission('communications.campaigns.read')
    @ApiOperation({ summary: 'Resolved recipients with delivery status' })
    recipients(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(CampaignRecipientQuerySchema)) query: CampaignRecipientQuery) {
        return this.campaigns.recipients(ctx, id, query);
    }

    @Get(':id/variants')
    @RequirePermission('communications.campaigns.read')
    @ApiOperation({ summary: 'A/B variants with sent / open / click counts and the winner state' })
    variants(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.variantsService.list(ctx, id);
    }

    @Put(':id/variants')
    @RequirePermission('communications.campaigns.update')
    @ApiOperation({ summary: 'Replace the A/B variants (2–5; empty list turns the test off)' })
    setVariants(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(SetVariantsSchema)) dto: SetVariantsInput) {
        return this.variantsService.replace(ctx, id, dto);
    }

    @Post(':id/variants/:variantId/winner')
    @RequirePermission('communications.campaigns.send')
    @ApiOperation({ summary: 'Pick the A/B winner now; it is sent to the rest of the audience' })
    chooseWinner(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('variantId', ParseUUIDPipe) variantId: string) {
        return this.variantsService.chooseWinner(ctx, id, variantId);
    }

    @Post()
    @RequirePermission('communications.campaigns.create')
    @ApiOperation({ summary: 'Create a draft campaign' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateCampaignDto) {
        return this.campaigns.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('communications.campaigns.update')
    @ApiOperation({ summary: 'Update a draft campaign (a reviewed campaign goes back to draft)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCampaignDto) {
        return this.campaigns.update(ctx, id, dto);
    }

    @Put(':id/audience')
    @RequirePermission('communications.campaigns.update')
    @ApiOperation({ summary: 'Replace the audience (lists and segments, include / exclude)' })
    setAudience(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetAudienceDto) {
        return this.campaigns.setAudience(ctx, id, dto.audiences);
    }

    @Post(':id/audience/resolve')
    @RequirePermission('communications.campaigns.read')
    @ApiOperation({ summary: 'Dry run: count recipients and exclusions (suppressed, no consent, invalid)' })
    resolveAudience(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.resolveAudience(ctx, id);
    }

    @Post(':id/preflight')
    @RequirePermission('communications.campaigns.read')
    @ApiOperation({ summary: 'Pre-send checks (audience, content, sender, provider, approval)' })
    preflight(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.preflight(ctx, id);
    }

    @Post(':id/test')
    @RequirePermission('communications.campaigns.update')
    @ApiOperation({ summary: 'Send test copies to up to 5 addresses' })
    testSend(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TestSendDto) {
        return this.campaigns.testSend(ctx, id, dto.addresses);
    }

    @Post(':id/submit')
    @RequirePermission('communications.campaigns.update')
    @ApiOperation({ summary: 'Submit for approval' })
    submit(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitCampaignDto) {
        return this.campaigns.submit(ctx, id, dto);
    }

    @Post(':id/approve')
    @RequirePermission('communications.campaigns.approve')
    @ApiOperation({ summary: 'Approve a campaign' })
    approve(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CampaignDecisionDto) {
        return this.campaigns.decide(ctx, id, true, dto.comment);
    }

    @Post(':id/reject')
    @RequirePermission('communications.campaigns.approve')
    @ApiOperation({ summary: 'Reject a campaign (back to draft)' })
    reject(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CampaignDecisionDto) {
        return this.campaigns.decide(ctx, id, false, dto.comment);
    }

    @Post(':id/schedule')
    @RequirePermission('communications.campaigns.send')
    @ApiOperation({ summary: 'Schedule the campaign, or send now when scheduled_at is omitted' })
    schedule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ScheduleCampaignDto) {
        return this.campaigns.schedule(ctx, id, dto);
    }

    @Post(':id/unschedule')
    @RequirePermission('communications.campaigns.send')
    unschedule(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.unschedule(ctx, id);
    }

    @Post(':id/pause')
    @RequirePermission('communications.campaigns.send')
    pause(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.pause(ctx, id);
    }

    @Post(':id/resume')
    @RequirePermission('communications.campaigns.send')
    resume(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.resume(ctx, id);
    }

    @Post(':id/cancel')
    @RequirePermission('communications.campaigns.send')
    cancel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.cancel(ctx, id);
    }

    @Post(':id/duplicate')
    @RequirePermission('communications.campaigns.create')
    duplicate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.duplicate(ctx, id);
    }

    @Post(':id/archive')
    @RequirePermission('communications.campaigns.archive')
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.archive(ctx, id, true);
    }

    @Post(':id/restore')
    @RequirePermission('communications.campaigns.archive')
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.archive(ctx, id, false);
    }

    @Delete(':id')
    @RequirePermission('communications.campaigns.delete')
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.campaigns.remove(ctx, id);
    }
}
