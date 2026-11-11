import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireOrgMember, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { ActivityService } from './activity.service';
import { AnnouncementsService } from './announcements.service';
import { InboxActionsService } from './inbox-actions.service';
import { BulkNotificationDto, NotificationActionDto, NotificationQuery, NotificationQuerySchema, ReadAllNotificationsDto, UpdateNotificationDto } from './dto/notification.dto';
import { SetEventPreferenceDto, SetSubscriptionDto, UpdateRecipientSettingsDto } from './dto/notification-preference.dto';
import { ActivityQuery, ActivityQuerySchema, MyActivityQuery, MyActivityQuerySchema } from './dto/activity-query.schema';
import { AnnouncementQuery, AnnouncementQuerySchema, CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';

const PREFS = 'notifications.preferences.manage_own';

/** Own preferences (14 §6). Registered before the inbox controller so `/notifications/preferences` never hits `/:id`. */
@ApiTags('Notifications · Preferences')
@ApiBearerAuth()
@Controller('notifications/preferences')
@UseGuards(JwtGuard, PermissionsGuard)
export class NotificationPreferencesController {
    constructor(private readonly prefs: NotificationPreferencesService) { }

    @Get('settings')
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'My global notification settings (level, channels, quiet hours, digest)' })
    getSettings(@CurrentOrg() ctx: OrgContext) {
        return this.prefs.getSettings(ctx);
    }

    @Patch('settings')
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'Update my global notification settings' })
    updateSettings(@CurrentOrg() ctx: OrgContext, @Body() dto: UpdateRecipientSettingsDto) {
        return this.prefs.updateSettings(ctx, dto);
    }

    @Get('events')
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'Event types with my effective channel settings (own / organization / platform)' })
    listEvents(@CurrentOrg() ctx: OrgContext) {
        return this.prefs.listEventPreferences(ctx);
    }

    @Put('events/:eventTypeId')
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'Turn a channel on or off for one event type' })
    setEvent(@CurrentOrg() ctx: OrgContext, @Param('eventTypeId', ParseUUIDPipe) eventTypeId: string, @Body() dto: SetEventPreferenceDto) {
        return this.prefs.setEventPreference(ctx, eventTypeId, dto);
    }

    @Delete('events/:eventTypeId')
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'Reset an event type to the organization / platform default' })
    resetEvent(@CurrentOrg() ctx: OrgContext, @Param('eventTypeId', ParseUUIDPipe) eventTypeId: string) {
        return this.prefs.resetEventPreference(ctx, eventTypeId);
    }

    @Get('subscriptions')
    @RequirePermission(PREFS)
    @ApiQuery({ name: 'state', required: false, enum: ['following', 'muted'] })
    @ApiOperation({ summary: 'Records I follow or muted' })
    listSubscriptions(@CurrentOrg() ctx: OrgContext, @Query('state') state?: 'following' | 'muted') {
        return this.prefs.listSubscriptions(ctx, state === 'following' || state === 'muted' ? state : undefined);
    }

    @Put('subscriptions')
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'Follow or mute a record (used by every module’s Follow / Mute button)' })
    setSubscription(@CurrentOrg() ctx: OrgContext, @Body() dto: SetSubscriptionDto) {
        return this.prefs.setSubscription(ctx, dto);
    }

    @Delete('subscriptions/:id')
    @RequirePermission(PREFS)
    @ApiOperation({ summary: 'Stop following / unmute a record' })
    removeSubscription(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.prefs.removeSubscription(ctx, id);
    }
}

/**
 * Own inbox (14 §7). Reading the own inbox needs no key (implicit for every recipient): @RequireOrgMember and the
 * service restricts every query to recipient_membership_id = caller.
 */
@ApiTags('Notifications · Inbox')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtGuard, PermissionsGuard)
export class NotificationsController {
    constructor(
        private readonly notifications: NotificationsService,
        private readonly actions: InboxActionsService,
    ) { }

    @Get()
    @RequireOrgMember()
    @ApiOperation({ summary: 'My notifications (state = unread | read | all | archived | snoozed | action)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(NotificationQuerySchema)) query: NotificationQuery) {
        return this.notifications.findAll(ctx, query);
    }

    @Get('unread-count')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Badge counts: unread, unseen, waiting on me' })
    counts(@CurrentOrg() ctx: OrgContext) {
        return this.notifications.counts(ctx);
    }

    @Post('read-all')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Mark all (or one module’s) unread notifications read' })
    readAll(@CurrentOrg() ctx: OrgContext, @Body() dto: ReadAllNotificationsDto) {
        return this.notifications.readAll(ctx, dto);
    }

    @Post('seen')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Mark everything seen (clears the bell badge, keeps unread)' })
    seen(@CurrentOrg() ctx: OrgContext) {
        return this.notifications.markSeen(ctx);
    }

    @Post('bulk')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Read / unread / archive / unarchive several notifications' })
    bulk(@CurrentOrg() ctx: OrgContext, @Body() dto: BulkNotificationDto) {
        return this.notifications.bulk(ctx, dto);
    }

    @Get(':id')
    @RequireOrgMember()
    @ApiOperation({ summary: 'One of my notifications (404 for anyone else’s)' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.notifications.findOne(ctx, id);
    }

    @Patch(':id')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Mark read / unread, archive, snooze' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNotificationDto) {
        return this.notifications.update(ctx, id, dto);
    }

    @Post(':id/open')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Mark read and return the deep link to open' })
    open(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.notifications.open(ctx, id);
    }

    @Post(':id/actions')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Take an inline action offered by the notification (e.g. acknowledge)' })
    act(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NotificationActionDto) {
        return this.actions.act(ctx, id, dto.action);
    }
}

/** Activity feed (14 §7) — organization / project / customer scope; plus the caller's own recent actions. */
@ApiTags('Notifications · Activity')
@ApiBearerAuth()
@Controller('activity')
@UseGuards(JwtGuard, PermissionsGuard)
export class ActivityController {
    constructor(private readonly activity: ActivityService) { }

    @Get()
    @RequirePermission('notifications.activity.read')
    @ApiOperation({ summary: 'Activity feed (scope-limited to what the caller may see)' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(ActivityQuerySchema)) query: ActivityQuery) {
        return this.activity.findAll(ctx, query);
    }

    @Get('mine')
    @RequireOrgMember()
    @ApiOperation({ summary: 'My own recent actions (Home → Recent)' })
    mine(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(MyActivityQuerySchema)) query: MyActivityQuery) {
        return this.activity.mine(ctx, query);
    }
}

/** System announcements (14 §4). Managing needs notifications.announcements.manage*; any member reads and acknowledges their own. */
@ApiTags('Notifications · Announcements')
@ApiBearerAuth()
@Controller('announcements')
@UseGuards(JwtGuard, PermissionsGuard)
export class AnnouncementsController {
    constructor(private readonly announcements: AnnouncementsService) { }

    @Get('live')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Live announcements addressed to me, with my acknowledgement' })
    live(@CurrentOrg() ctx: OrgContext) {
        return this.announcements.live(ctx);
    }

    @Get()
    @RequirePermission('notifications.announcements.manage')
    @ApiOperation({ summary: 'List announcements' })
    findAll(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(AnnouncementQuerySchema)) query: AnnouncementQuery) {
        return this.announcements.findAll(ctx, query);
    }

    @Get('audience-options')
    @RequirePermission('notifications.announcements.manage')
    @ApiOperation({ summary: 'Members, teams and branches for the audience picker' })
    audienceOptions(@CurrentOrg() ctx: OrgContext) {
        return this.announcements.audienceOptions(ctx);
    }

    @Get(':id')
    @RequirePermission('notifications.announcements.manage')
    @ApiOperation({ summary: 'Announcement with acknowledgements' })
    findOne(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.announcements.findOne(ctx, id);
    }

    @Post()
    @RequirePermission('notifications.announcements.manage')
    @ApiOperation({ summary: 'Create a draft (or scheduled) announcement' })
    create(@CurrentOrg() ctx: OrgContext, @Body() dto: CreateAnnouncementDto) {
        return this.announcements.create(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('notifications.announcements.manage')
    @ApiOperation({ summary: 'Edit a draft or scheduled announcement' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAnnouncementDto) {
        return this.announcements.update(ctx, id, dto);
    }

    @Delete(':id')
    @RequirePermission('notifications.announcements.manage')
    @ApiOperation({ summary: 'Delete a draft or scheduled announcement' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.announcements.remove(ctx, id);
    }

    @Post(':id/publish')
    @RequirePermission('notifications.announcements.manage')
    @ApiOperation({ summary: 'Publish now: one notification per audience member' })
    publish(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.announcements.publish(ctx, id);
    }

    @Post(':id/withdraw')
    @RequirePermission('notifications.announcements.manage')
    @ApiOperation({ summary: 'Withdraw: removes it from every inbox' })
    withdraw(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.announcements.withdraw(ctx, id);
    }

    @Post(':id/acknowledge')
    @RequireOrgMember()
    @ApiOperation({ summary: 'Acknowledge an announcement addressed to me' })
    acknowledge(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.announcements.acknowledge(ctx, id);
    }
}
