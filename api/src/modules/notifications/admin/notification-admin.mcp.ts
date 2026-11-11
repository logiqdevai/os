import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleKey } from 'generated/prisma';
import { z } from 'zod';
import { McpRegistry } from '@/core/mcp/mcp.registry';
import { NotificationAdminService } from './notification-admin.service';
import { NotificationLogService } from './notification-log.service';
import { CreateDeliveryRuleSchema, DeliveryQuerySchema, EventTypeQuerySchema, SetOrgDefaultSchema, UpdateDeliveryRuleSchema } from '../dto/notification-admin.dto';

/** MCP adapter for the 14 administration (same services and schemas as REST). */
@Injectable()
export class NotificationAdminMcp implements OnModuleInit {
    constructor(
        private readonly registry: McpRegistry,
        private readonly admin: NotificationAdminService,
        private readonly log: NotificationLogService,
    ) { }

    onModuleInit() {
        const M = ModuleKey.NOTIFICATIONS;
        this.registry.registerMany([
            {
                name: 'notifications_event_types_list',
                description: 'List the notification event catalog (platform + organization event types) with organization overrides.',
                permission: 'notifications.defaults.manage', module: M, resource_type: 'notification_event_type',
                input: EventTypeQuerySchema,
                handler: (ctx, args) => this.admin.listEventTypes(ctx, args),
            },
            {
                name: 'notifications_defaults_manage',
                description: 'Set the organization default of a module or an event type: enabled, channels (IN_APP, EMAIL), delivery mode, digest frequency, mandatory.',
                permission: 'notifications.defaults.manage', module: M, resource_type: 'notification_org_default', sensitive: true,
                input: SetOrgDefaultSchema,
                handler: (ctx, args) => this.admin.setDefault(ctx, args),
            },
            {
                name: 'notifications_delivery_rules_list',
                description: 'List delivery rules (deduplicate, coalesce, throttle, suppress) in evaluation order.',
                permission: 'notifications.delivery_rules.manage', module: M, resource_type: 'notification_delivery_rule',
                input: z.object({}),
                handler: (ctx) => this.admin.listRules(ctx),
            },
            {
                name: 'notifications_delivery_rules_create',
                description: 'Create a delivery rule for an event type or module (window_seconds required except SUPPRESS; max_per_window for THROTTLE).',
                permission: 'notifications.delivery_rules.manage', module: M, resource_type: 'notification_delivery_rule',
                input: CreateDeliveryRuleSchema,
                handler: (ctx, args) => this.admin.createRule(ctx, args),
            },
            {
                name: 'notifications_delivery_rules_update',
                description: 'Update, activate or deactivate a delivery rule.',
                permission: 'notifications.delivery_rules.manage', module: M, resource_type: 'notification_delivery_rule',
                input: UpdateDeliveryRuleSchema.extend({ id: z.string().uuid() }),
                handler: (ctx, { id, ...dto }) => this.admin.updateRule(ctx, id, dto),
            },
            {
                name: 'notifications_audit_read',
                description: 'Delivery log: why a notification was (not) delivered — status, skip reason, attempts per channel. Filter by status, channel, skip_reason, event_key, membership_id.',
                permission: 'notifications.audit.read', module: M, resource_type: 'notification_delivery', sensitive: true,
                input: DeliveryQuerySchema,
                handler: (ctx, args) => this.log.deliveries(ctx, args),
            },
            {
                name: 'notifications_deliveries_retry',
                description: 'Retry a failed email delivery (or one skipped because no email provider was connected).',
                permission: 'notifications.deliveries.retry', module: M, resource_type: 'notification_delivery', sensitive: true,
                input: z.object({ id: z.string().uuid() }),
                handler: (ctx, args) => this.log.retry(ctx, args.id),
            },
        ]);
    }
}
