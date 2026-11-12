import {
    ModuleKey, NotificationCategory, NotificationChannel, NotificationCoalesceKey, NotificationDeliveryMode, NotificationDeliveryRuleKind, NotificationDeliveryStatus,
    NotificationDigestFrequency, NotificationDigestStatus, NotificationEventStatus, NotificationLevel, NotificationPriority, NotificationSkipReason,
} from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema } from '@/shared/utils/pagination/pagination.utils';

/**
 * 14 admin (event catalog, templates, organization defaults, delivery rules, delivery log, organization settings).
 * Bodies are validated with these zod schemas on REST (ZodBodyPipe) and MCP alike.
 */

const csvOf = <T extends z.ZodTypeAny>(item: T) => z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(item)).optional();
const bool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean()).optional();
const channels = z.array(z.nativeEnum(NotificationChannel)).max(5);

// ---------------------------------------------------------------- event catalog

export const EventTypeQuerySchema = BaseListQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    module: z.nativeEnum(ModuleKey).optional(),
    category: z.nativeEnum(NotificationCategory).optional(),
    scope: z.enum(['platform', 'organization']).optional(),
    mandatory: bool,
    active: bool,
});
export type EventTypeQuery = z.infer<typeof EventTypeQuerySchema>;

export const CreateEventTypeSchema = z.object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/, 'lowercase, dot-separated, e.g. agency.client_review_due').max(120),
    module: z.nativeEnum(ModuleKey),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).nullable().optional(),
    category: z.nativeEnum(NotificationCategory).optional(),
    priority: z.nativeEnum(NotificationPriority).optional(),
    default_channels: channels.optional(),
    forced_channels: channels.optional(),
    mandatory_by_default: z.boolean().optional(),
    customer_visible: z.boolean().optional(),
    supports_digest: z.boolean().optional(),
    can_coalesce: z.boolean().optional(),
    coalesce_window_seconds: z.number().int().min(10).max(86_400).nullable().optional(),
    default_expiry_minutes: z.number().int().min(1).max(525_600).nullable().optional(),
    available_actions: z.array(z.string().trim().max(40)).max(10).optional(),
    is_active: z.boolean().optional(),
});
export type CreateEventTypeInput = z.infer<typeof CreateEventTypeSchema>;
export const UpdateEventTypeSchema = CreateEventTypeSchema.omit({ key: true, module: true }).partial();
export type UpdateEventTypeInput = z.infer<typeof UpdateEventTypeSchema>;

// ---------------------------------------------------------------- templates

export const TemplateQuerySchema = BaseListQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    event_type_id: z.string().uuid().optional(),
    channel: z.nativeEnum(NotificationChannel).optional(),
    scope: z.enum(['platform', 'organization']).optional(),
});
export type TemplateQuery = z.infer<typeof TemplateQuerySchema>;

const templateFields = {
    subject: z.string().max(250).nullable().optional(),
    title: z.string().trim().min(1).max(300),
    body: z.string().max(10_000),
    html_body: z.string().max(100_000).nullable().optional(),
    cta_label: z.string().max(60).nullable().optional(),
    cta_url: z.string().max(500).nullable().optional(),
    is_active: z.boolean().optional(),
};
export const CreateTemplateSchema = z.object({
    event_type_id: z.string().uuid(),
    channel: z.nativeEnum(NotificationChannel),
    locale: z.string().trim().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'e.g. en or el').nullable().optional(),
    ...templateFields,
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export const UpdateTemplateSchema = z.object(templateFields).partial();
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
export const PreviewTemplateSchema = z.object({
    subject: z.string().max(250).nullable().optional(),
    title: z.string().max(300),
    body: z.string().max(10_000),
    cta_label: z.string().max(60).nullable().optional(),
    sample: z.record(z.string(), z.unknown()).optional(),
});
export type PreviewTemplateInput = z.infer<typeof PreviewTemplateSchema>;

// ---------------------------------------------------------------- organization defaults

export const SetOrgDefaultSchema = z.object({
    module: z.nativeEnum(ModuleKey).nullable().optional(),
    event_type_id: z.string().uuid().nullable().optional(),
    enabled: z.boolean(),
    channels: channels,
    portal_channels: channels.optional(),
    delivery_mode: z.nativeEnum(NotificationDeliveryMode).optional(),
    digest_frequency: z.nativeEnum(NotificationDigestFrequency).optional(),
    is_mandatory: z.boolean().optional(),
}).refine((v) => !!v.module !== !!v.event_type_id, { message: 'Set exactly one of module or event_type_id', path: ['module'] });
export type SetOrgDefaultInput = z.infer<typeof SetOrgDefaultSchema>;

// ---------------------------------------------------------------- delivery rules

const ruleBase = z.object({
    name: z.string().trim().min(1).max(120),
    kind: z.nativeEnum(NotificationDeliveryRuleKind),
    event_type_id: z.string().uuid().nullable().optional(),
    module: z.nativeEnum(ModuleKey).nullable().optional(),
    channel: z.nativeEnum(NotificationChannel).nullable().optional(),
    window_seconds: z.number().int().min(10).max(7 * 86_400).nullable().optional(),
    max_per_window: z.number().int().min(1).max(1000).nullable().optional(),
    coalesce_key: z.nativeEnum(NotificationCoalesceKey).nullable().optional(),
    conditions: z.record(z.string(), z.string()).nullable().optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    is_active: z.boolean().optional(),
});
type RuleInput = Partial<z.infer<typeof ruleBase>>;
const ruleChecks = (s: typeof ruleBase) => s
    .refine((v: RuleInput) => !(v.event_type_id && v.module), { message: 'Choose an event type or a module, not both', path: ['module'] })
    .refine((v: RuleInput) => v.kind === 'SUPPRESS' || !!v.window_seconds, { message: 'Set a window for this kind of rule', path: ['window_seconds'] })
    .refine((v: RuleInput) => v.kind !== 'THROTTLE' || !!v.max_per_window, { message: 'Set the maximum per window', path: ['max_per_window'] });
export const CreateDeliveryRuleSchema = ruleChecks(ruleBase);
export type CreateDeliveryRuleInput = z.infer<typeof ruleBase>;
export const UpdateDeliveryRuleSchema = ruleBase.partial();
export type UpdateDeliveryRuleInput = z.infer<typeof UpdateDeliveryRuleSchema>;

// ---------------------------------------------------------------- delivery log

const range = { from: z.string().optional(), to: z.string().optional() };
export const DeliveryQuerySchema = BaseListQuerySchema.extend({
    status: csvOf(z.nativeEnum(NotificationDeliveryStatus)),
    channel: z.nativeEnum(NotificationChannel).optional(),
    skip_reason: z.nativeEnum(NotificationSkipReason).optional(),
    event_key: z.string().max(120).optional(),
    membership_id: z.string().uuid().optional(),
    ...range,
});
export type DeliveryQuery = z.infer<typeof DeliveryQuerySchema>;
export const EventLogQuerySchema = BaseListQuerySchema.extend({ status: z.nativeEnum(NotificationEventStatus).optional(), event_key: z.string().max(120).optional(), ...range });
export type EventLogQuery = z.infer<typeof EventLogQuerySchema>;
export const DigestQuerySchema = BaseListQuerySchema.extend({ status: z.nativeEnum(NotificationDigestStatus).optional(), membership_id: z.string().uuid().optional(), ...range });
export type DigestQuery = z.infer<typeof DigestQuerySchema>;

// ---------------------------------------------------------------- organization settings

export const UpdateOrgSettingsSchema = z.object({
    enabled_channels: channels.optional(),
    portal_enabled_channels: channels.optional(),
    email_sender_identity_id: z.string().uuid().nullable().optional(),
    sms_sender_identity_id: z.string().uuid().nullable().optional(),
    default_level: z.nativeEnum(NotificationLevel).optional(),
    default_digest_frequency: z.nativeEnum(NotificationDigestFrequency).optional(),
    default_digest_hour: z.number().int().min(0).max(23).optional(),
    default_digest_weekday: z.number().int().min(0).max(6).optional(),
    hide_previews_by_default: z.boolean().optional(),
    max_delivery_attempts: z.number().int().min(1).max(10).optional(),
    retry_backoff_seconds: z.number().int().min(10).max(3600).optional(),
    retention_days: z.number().int().min(7).max(3650).nullable().optional(),
    webhook_events_enabled: z.boolean().optional(),
});
export type UpdateOrgSettingsInput = z.infer<typeof UpdateOrgSettingsSchema>;
