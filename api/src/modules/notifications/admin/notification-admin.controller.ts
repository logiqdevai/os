import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequireAnyPermission, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { ZodBodyPipe } from '@/modules/finance-shared/zod-body.pipe';
import { NotificationAdminService } from './notification-admin.service';
import { NotificationLogService } from './notification-log.service';
import {
    CreateDeliveryRuleInput, CreateDeliveryRuleSchema, CreateEventTypeInput, CreateEventTypeSchema, CreateTemplateInput, CreateTemplateSchema, DeliveryQuery, DeliveryQuerySchema, DigestQuery,
    DigestQuerySchema, EventLogQuery, EventLogQuerySchema, EventTypeQuery, EventTypeQuerySchema, PreviewTemplateInput, PreviewTemplateSchema, SetOrgDefaultInput, SetOrgDefaultSchema,
    TemplateQuery, TemplateQuerySchema, UpdateDeliveryRuleInput, UpdateDeliveryRuleSchema, UpdateEventTypeInput, UpdateEventTypeSchema, UpdateOrgSettingsInput, UpdateOrgSettingsSchema,
    UpdateTemplateInput, UpdateTemplateSchema,
} from '../dto/notification-admin.dto';

/** Viewing the catalog is open to anyone who administers any part of notifications (mockup 14 "Event catalog"). */
const CATALOG_VIEW = ['notifications.defaults.manage', 'notifications.event_types.manage', 'notifications.templates.manage', 'notifications.delivery_rules.manage'];

/** 14 §4, §14 — event catalog. Platform rows (organization_id null) are read-only. */
@ApiTags('Notifications · Admin')
@ApiBearerAuth()
@Controller('notification-event-types')
@UseGuards(JwtGuard, PermissionsGuard)
export class NotificationEventTypesController {
    constructor(private readonly admin: NotificationAdminService) { }

    @Get()
    @RequireAnyPermission(...CATALOG_VIEW)
    @ApiOperation({ summary: 'Event catalog (platform + organization event types) with organization overrides' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(EventTypeQuerySchema)) q: EventTypeQuery) {
        return this.admin.listEventTypes(ctx, q);
    }

    @Get(':id')
    @RequireAnyPermission(...CATALOG_VIEW)
    @ApiOperation({ summary: 'Event type with templates, organization default, recent events and rules' })
    get(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.getEventType(ctx, id);
    }

    @Post()
    @RequirePermission('notifications.event_types.manage')
    @ApiOperation({ summary: 'Register an organization event type (key unique per organization)' })
    create(@CurrentOrg() ctx: OrgContext, @Body(new ZodBodyPipe(CreateEventTypeSchema)) dto: CreateEventTypeInput) {
        return this.admin.createEventType(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('notifications.event_types.manage')
    @ApiOperation({ summary: 'Edit an organization event type' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodBodyPipe(UpdateEventTypeSchema)) dto: UpdateEventTypeInput) {
        return this.admin.updateEventType(ctx, id, dto);
    }

    @Post(':id/deprecate')
    @RequirePermission('notifications.event_types.manage')
    @ApiOperation({ summary: 'Deprecate an organization event type (history kept, no new emits)' })
    deprecate(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.deprecateEventType(ctx, id);
    }
}

/** 14 §10 — templates per event type, channel and locale (+ version history). */
@ApiTags('Notifications · Admin')
@ApiBearerAuth()
@Controller('notification-templates')
@UseGuards(JwtGuard, PermissionsGuard)
export class NotificationTemplatesController {
    constructor(private readonly admin: NotificationAdminService) { }

    @Get()
    @RequirePermission('notifications.templates.manage')
    @ApiOperation({ summary: 'Templates (platform defaults and organization overrides)' })
    list(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(TemplateQuerySchema)) q: TemplateQuery) {
        return this.admin.listTemplates(ctx, q);
    }

    @Post('preview')
    @RequirePermission('notifications.templates.manage')
    @ApiOperation({ summary: 'Render a template with sample data (lists unknown variables)' })
    preview(@CurrentOrg() ctx: OrgContext, @Body(new ZodBodyPipe(PreviewTemplateSchema)) dto: PreviewTemplateInput) {
        return this.admin.previewTemplate(ctx, dto);
    }

    @Get(':id')
    @RequirePermission('notifications.templates.manage')
    @ApiOperation({ summary: 'Template with its version history' })
    get(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.getTemplate(ctx, id);
    }

    @Post()
    @RequirePermission('notifications.templates.manage')
    @ApiOperation({ summary: 'Create an organization template (or customize a platform default)' })
    create(@CurrentOrg() ctx: OrgContext, @Body(new ZodBodyPipe(CreateTemplateSchema)) dto: CreateTemplateInput) {
        return this.admin.createTemplate(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('notifications.templates.manage')
    @ApiOperation({ summary: 'Save a new version of an organization template' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodBodyPipe(UpdateTemplateSchema)) dto: UpdateTemplateInput) {
        return this.admin.updateTemplate(ctx, id, dto);
    }

    @Post(':id/versions/:version/restore')
    @RequirePermission('notifications.templates.manage')
    @ApiOperation({ summary: 'Restore an earlier version (saved as a new version)' })
    restore(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Param('version', ParseIntPipe) version: number) {
        return this.admin.restoreTemplateVersion(ctx, id, version);
    }

    @Delete(':id')
    @RequirePermission('notifications.templates.manage')
    @ApiOperation({ summary: 'Delete an organization template (the platform default applies again)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.deleteTemplate(ctx, id);
    }
}

/** 14 §6 layer 4 — organization defaults per module / event type and mandatory events. */
@ApiTags('Notifications · Admin')
@ApiBearerAuth()
@Controller('notification-defaults')
@UseGuards(JwtGuard, PermissionsGuard)
export class NotificationDefaultsController {
    constructor(private readonly admin: NotificationAdminService) { }

    @Get()
    @RequirePermission('notifications.defaults.manage')
    @ApiOperation({ summary: 'Organization defaults (module rows and event overrides)' })
    list(@CurrentOrg() ctx: OrgContext) {
        return this.admin.listDefaults(ctx);
    }

    @Put()
    @RequirePermission('notifications.defaults.manage')
    @ApiOperation({ summary: 'Set the default of a module or an event type (mandatory changes are sensitive)' })
    set(@CurrentOrg() ctx: OrgContext, @Body(new ZodBodyPipe(SetOrgDefaultSchema)) dto: SetOrgDefaultInput) {
        return this.admin.setDefault(ctx, dto);
    }

    @Delete(':id')
    @RequirePermission('notifications.defaults.manage')
    @ApiOperation({ summary: 'Remove an organization default (falls back to the module / platform default)' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.removeDefault(ctx, id);
    }
}

/** 14 §9, §16 — dedup / coalesce / throttle / suppress rules. */
@ApiTags('Notifications · Admin')
@ApiBearerAuth()
@Controller('notification-delivery-rules')
@UseGuards(JwtGuard, PermissionsGuard)
export class NotificationDeliveryRulesController {
    constructor(private readonly admin: NotificationAdminService) { }

    @Get()
    @RequirePermission('notifications.delivery_rules.manage')
    @ApiOperation({ summary: 'Delivery rules in evaluation order' })
    list(@CurrentOrg() ctx: OrgContext) {
        return this.admin.listRules(ctx);
    }

    @Post()
    @RequirePermission('notifications.delivery_rules.manage')
    @ApiOperation({ summary: 'Create a delivery rule' })
    create(@CurrentOrg() ctx: OrgContext, @Body(new ZodBodyPipe(CreateDeliveryRuleSchema)) dto: CreateDeliveryRuleInput) {
        return this.admin.createRule(ctx, dto);
    }

    @Patch(':id')
    @RequirePermission('notifications.delivery_rules.manage')
    @ApiOperation({ summary: 'Update a delivery rule (also activate / deactivate, reorder)' })
    update(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodBodyPipe(UpdateDeliveryRuleSchema)) dto: UpdateDeliveryRuleInput) {
        return this.admin.updateRule(ctx, id, dto);
    }

    @Delete(':id')
    @RequirePermission('notifications.delivery_rules.manage')
    @ApiOperation({ summary: 'Delete a delivery rule' })
    remove(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.admin.deleteRule(ctx, id);
    }
}

/** 14 §9, §13 — delivery log (sensitive). */
@ApiTags('Notifications · Admin')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, PermissionsGuard)
export class NotificationLogController {
    constructor(private readonly log: NotificationLogService) { }

    @Get('notification-deliveries')
    @RequirePermission('notifications.audit.read')
    @ApiOperation({ summary: 'Per-channel deliveries with status / skip reason (+ 24 h stats)' })
    deliveries(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DeliveryQuerySchema)) q: DeliveryQuery) {
        return this.log.deliveries(ctx, q);
    }

    @Get('notification-deliveries/:id')
    @RequirePermission('notifications.audit.read')
    @ApiOperation({ summary: 'One delivery with rendered content (viewing is audited)' })
    delivery(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.log.delivery(ctx, id);
    }

    @Post('notification-deliveries/:id/retry')
    @RequirePermission('notifications.deliveries.retry')
    @ApiOperation({ summary: 'Retry a failed email delivery (or one skipped because no provider was connected)' })
    retry(@CurrentOrg() ctx: OrgContext, @Param('id', ParseUUIDPipe) id: string) {
        return this.log.retry(ctx, id);
    }

    @Get('notification-events')
    @RequirePermission('notifications.audit.read')
    @ApiOperation({ summary: 'Ingested notification events' })
    events(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(EventLogQuerySchema)) q: EventLogQuery) {
        return this.log.eventLog(ctx, q);
    }

    @Get('notification-digests')
    @RequirePermission('notifications.audit.read')
    @ApiOperation({ summary: 'Digests (daily / weekly summaries)' })
    digests(@CurrentOrg() ctx: OrgContext, @Query(new ZodValidationPipe(DigestQuerySchema)) q: DigestQuery) {
        return this.log.digests(ctx, q);
    }
}

/** 14 §5, §8, §11 — organization notification settings. */
@ApiTags('Notifications · Admin')
@ApiBearerAuth()
@Controller('notification-settings')
@UseGuards(JwtGuard, PermissionsGuard)
export class NotificationSettingsController {
    constructor(private readonly admin: NotificationAdminService) { }

    @Get()
    @RequirePermission('notifications.settings.manage')
    @ApiOperation({ summary: 'Organization settings with email provider status (BYOK Resend)' })
    get(@CurrentOrg() ctx: OrgContext) {
        return this.admin.getSettings(ctx);
    }

    @Patch()
    @RequirePermission('notifications.settings.manage')
    @ApiOperation({ summary: 'Update organization notification settings' })
    update(@CurrentOrg() ctx: OrgContext, @Body(new ZodBodyPipe(UpdateOrgSettingsSchema)) dto: UpdateOrgSettingsInput) {
        return this.admin.updateSettings(ctx, dto);
    }
}
