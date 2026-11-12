import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZBody } from '@/modules/finance-shared/zod-body.pipe';
import { InboxesService } from './inboxes.service';
import { ChannelAiConfig, ChannelAiConfigSchema, OfficeHoursConfig, OfficeHoursSchema } from '../common/channel-config.utils';
import { CreateChannelDto, CreateInboxDto, UpdateAgentProfileDto, UpdateChannelDto, UpdateInboxDto } from './dto/inbox.dto';

@ApiTags('Support · Inboxes & channels')
@ApiBearerAuth()
@Controller('support')
@UseGuards(JwtGuard, PermissionsGuard)
export class InboxesController {
    constructor(private readonly inboxes: InboxesService) { }

    @Get('inboxes')
    @RequireAnyPermission('support.inboxes.read', 'support.inboxes.manage', 'support.conversations.read', 'support.tickets.read')
    @ApiOperation({ summary: 'List inboxes (pickers and setup)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query('archived') archived?: string) {
        return this.inboxes.findAll(ctx, archived === 'true');
    }

    @Get('inboxes/:id')
    @RequireAnyPermission('support.inboxes.read', 'support.inboxes.manage')
    @ApiOperation({ summary: 'Get an inbox with its channels' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.inboxes.findOne(ctx, id);
    }

    @Post('inboxes')
    @RequirePermission('support.inboxes.manage')
    @ApiOperation({ summary: 'Create an inbox' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateInboxDto) {
        return this.inboxes.create(ctx, dto);
    }

    @Patch('inboxes/:id')
    @RequirePermission('support.inboxes.manage')
    @ApiOperation({ summary: 'Update an inbox' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInboxDto) {
        return this.inboxes.update(ctx, id, dto);
    }

    @Post('inboxes/:id/archive')
    @RequirePermission('support.inboxes.manage')
    @ApiOperation({ summary: 'Archive an inbox (its channels are deactivated)' })
    archive(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.inboxes.archive(ctx, id);
    }

    @Get('channels')
    @RequireAnyPermission('support.inboxes.read', 'support.inboxes.manage')
    @ApiOperation({ summary: 'List connected channels' })
    channels(@CurrentOrg() ctx: OrgContext) {
        return this.inboxes.channels(ctx);
    }

    @Get('channels/:id')
    @RequireAnyPermission('support.inboxes.read', 'support.inboxes.manage')
    @ApiOperation({ summary: 'Get a channel' })
    channel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.inboxes.channel(ctx, id);
    }

    @Post('channels')
    @RequirePermission('support.inboxes.manage')
    @ApiOperation({ summary: 'Connect a channel to an inbox' })
    createChannel(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateChannelDto) {
        return this.inboxes.createChannel(ctx, dto);
    }

    @Patch('channels/:id')
    @RequirePermission('support.inboxes.manage')
    @ApiOperation({ summary: 'Update a channel (the `ai` and `office_hours` config keys are kept; use the dedicated endpoints)' })
    updateChannel(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateChannelDto) {
        return this.inboxes.updateChannel(ctx, id, dto);
    }

    @Get('channels/:id/automation')
    @RequireAnyPermission('support.inboxes.read', 'support.inboxes.manage', 'support.ai.configure')
    @ApiOperation({ summary: 'AI auto-answer settings and office hours of a channel, with the live open / closed state' })
    automation(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.inboxes.channelAutomation(ctx, id);
    }

    @Put('channels/:id/ai-agent')
    @RequirePermission('support.ai.configure')
    @ApiOperation({ summary: 'AI auto-answer on this channel: mode OFF | SUGGEST | AUTO_REPLY, min_confidence, max_turns, handover_phrases' })
    setAiAgent(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(ChannelAiConfigSchema)) dto: ChannelAiConfig) {
        return this.inboxes.setAiAgent(ctx, id, dto);
    }

    @Put('channels/:id/office-hours')
    @RequirePermission('support.inboxes.manage')
    @ApiOperation({ summary: 'Office hours of a widget / live chat channel (outside them visitors get a "we will reply by email" form)' })
    setOfficeHours(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(ZBody(OfficeHoursSchema)) dto: OfficeHoursConfig) {
        return this.inboxes.setOfficeHours(ctx, id, dto);
    }

    @Post('channels/:id/verify')
    @RequirePermission('support.inboxes.manage')
    @ApiOperation({ summary: 'Mark a channel verified' })
    verify(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.inboxes.verifyChannel(ctx, id);
    }

    @Post('channels/:id/rotate-widget-key')
    @RequirePermission('support.inboxes.manage')
    @ApiOperation({ summary: 'Rotate the widget embed key' })
    rotate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.inboxes.rotateWidgetKey(ctx, id);
    }

    @Get('agents')
    @RequireAnyPermission('support.conversations.read', 'support.tickets.read', 'support.inboxes.read')
    @ApiOperation({ summary: 'Members with routing profile and open load (assignee pickers)' })
    agents(@CurrentOrg() ctx: OrgContext, @Query('search') search?: string) {
        return this.inboxes.agents(ctx, search);
    }

    @Patch('agents/:membershipId')
    @RequireAnyPermission('support.conversations.read', 'support.tickets.read', 'support.inboxes.manage')
    @ApiOperation({ summary: 'Update an agent profile (own profile, or others with support.inboxes.manage)' })
    updateAgent(@CurrentOrg() ctx: OrgContext, @Param('membershipId', ParseUUIDPipe) membershipId: string, @Body() dto: UpdateAgentProfileDto) {
        return this.inboxes.updateAgentProfile(ctx, membershipId, dto);
    }
}
