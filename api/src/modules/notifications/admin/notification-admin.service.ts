import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, NotificationChannel, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { emailLayout, renderVars } from '../utils/delivery.utils';
import { NotificationRulesService } from '../delivery/notification-rules.service';
import { NotificationDeliveryService } from '../delivery/notification-delivery.service';
import { NotificationWebhookEvents } from '../delivery/notification-webhook-events.service';
import { DEFAULT_NOTIFICATION_RETENTION_DAYS } from '../retention/notification-retention.service';
import {
    CreateDeliveryRuleInput, CreateEventTypeInput, CreateTemplateInput, EventTypeQuery, PreviewTemplateInput, SetOrgDefaultInput, TemplateQuery, UpdateDeliveryRuleInput,
    UpdateEventTypeInput, UpdateOrgSettingsInput, UpdateTemplateInput,
} from '../dto/notification-admin.dto';

const NOT_FOUND = (what: string, code: string) => new NotFoundException({ message: `${what} not found`, code });
const ORG_DEFAULT_SETTINGS = {
    enabled_channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL], portal_enabled_channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL], email_sender_identity_id: null,
    sms_sender_identity_id: null, default_level: 'ALL', default_digest_frequency: 'IMMEDIATE', default_digest_hour: 8, default_digest_weekday: 1, hide_previews_by_default: false,
    max_delivery_attempts: 5, retry_backoff_seconds: 60, retention_days: DEFAULT_NOTIFICATION_RETENTION_DAYS, webhook_events_enabled: false,
} as const;

/**
 * 14 §4, §6, §9, §10, §14 — organization administration of notifications: event catalog (platform rows read-only,
 * organization rows editable), templates with version history, organization defaults / mandatory events, delivery rules
 * and organization settings. Every write is audited and published; mandatory changes are flagged sensitive.
 */
@Injectable()
export class NotificationAdminService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly rules: NotificationRulesService,
        private readonly delivery: NotificationDeliveryService,
        private readonly webhooks: NotificationWebhookEvents,
    ) { }

    private visibleType(ctx: OrgContext): Prisma.NotificationEventTypeWhereInput {
        return { OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] };
    }

    private publish(ctx: OrgContext, event_key: string, entity_kind: string, entity_id: string, payload: Record<string, unknown> = {}) {
        this.events.publish(ctx, { event_key, module: ModuleKey.NOTIFICATIONS, entity_kind, entity_id, payload });
    }

    // ================================================================ event catalog

    async listEventTypes(ctx: OrgContext, q: EventTypeQuery) {
        const where: Prisma.NotificationEventTypeWhereInput = {
            AND: [
                this.visibleType(ctx),
                ...(q.scope === 'platform' ? [{ organization_id: null }] : q.scope === 'organization' ? [{ organization_id: ctx.organization_id }] : []),
                ...(q.module ? [{ module: q.module }] : []),
                ...(q.category ? [{ category: q.category }] : []),
                ...(q.mandatory !== undefined ? [{ mandatory_by_default: q.mandatory }] : []),
                ...(q.active !== undefined ? [{ is_active: q.active, ...(q.active ? { deprecated_at: null } : {}) }] : []),
                ...(q.search ? [{ OR: [{ key: { contains: q.search, mode: 'insensitive' as const } }, { name: { contains: q.search, mode: 'insensitive' as const } }] }] : []),
            ],
        };
        const [rows, total, defaults] = await Promise.all([
            this.prisma.notificationEventType.findMany({ where, ...skipTake(q), orderBy: [{ module: 'asc' }, { sort_order: 'asc' }, { key: 'asc' }], include: { _count: { select: { templates: { where: { organization_id: ctx.organization_id } } } } } }),
            this.prisma.notificationEventType.count({ where }),
            this.prisma.notificationOrgDefault.findMany({ where: { organization_id: ctx.organization_id, event_type_id: { not: null } }, select: { event_type_id: true, is_mandatory: true, enabled: true } }),
        ]);
        const stats = await this.prisma.notificationEventType.groupBy({ by: ['mandatory_by_default', 'customer_visible'], where: this.visibleType(ctx), _count: { _all: true } });
        return {
            ...paginate(rows.map((t) => {
                const d = defaults.find((x) => x.event_type_id === t.id);
                return { ...t, scope: t.organization_id ? 'organization' : 'platform', org_mandatory: !!d?.is_mandatory, org_enabled: d ? d.enabled : null, org_template_count: t._count.templates };
            }), total, q),
            stats: {
                total: stats.reduce((s, x) => s + x._count._all, 0),
                mandatory: stats.filter((x) => x.mandatory_by_default).reduce((s, x) => s + x._count._all, 0),
                customer_visible: stats.filter((x) => x.customer_visible).reduce((s, x) => s + x._count._all, 0),
            },
        };
    }

    async getEventType(ctx: OrgContext, id: string) {
        const t = await this.prisma.notificationEventType.findFirst({ where: { id, ...this.visibleType(ctx) } });
        if (!t) throw NOT_FOUND('Event type', 'event_type_not_found');
        const since = new Date(Date.now() - 30 * 86_400_000);
        const [templates, orgDefault, recent, rules, sent] = await Promise.all([
            this.prisma.notificationTemplate.findMany({ where: { event_type_id: id, OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] }, orderBy: [{ channel: 'asc' }, { locale: 'asc' }] }),
            this.prisma.notificationOrgDefault.findFirst({ where: { organization_id: ctx.organization_id, event_type_id: id } }),
            this.prisma.notificationEvent.findMany({ where: { organization_id: ctx.organization_id, event_type_id: id }, orderBy: { received_at: 'desc' }, take: 20, select: { id: true, status: true, entity_type: true, entity_label: true, notification_count: true, idempotency_key: true, received_at: true, error: true } }),
            this.prisma.notificationDeliveryRule.findMany({ where: { organization_id: ctx.organization_id, event_type_id: id } }),
            this.prisma.notification.count({ where: { organization_id: ctx.organization_id, event_type_id: id, created_at: { gte: since } } }),
        ]);
        return { ...t, scope: t.organization_id ? 'organization' : 'platform', editable: !!t.organization_id, templates, org_default: orgDefault, recent_events: recent, rules, stats: { notifications_30d: sent } };
    }

    async createEventType(ctx: OrgContext, dto: CreateEventTypeInput) {
        try {
            const row = await this.prisma.notificationEventType.create({ data: { ...dto, organization_id: ctx.organization_id, default_channels: dto.default_channels ?? [NotificationChannel.IN_APP] } });
            await this.audit.record(ctx, 'notification.event_type_created', { resource_type: 'notification_event_type', resource_id: row.id, metadata: { after: dto, sensitive: !!dto.mandatory_by_default } });
            this.publish(ctx, 'notification.event_type.created', 'notification_event_type', row.id, { key: row.key });
            return row;
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'An event type with this key already exists', code: 'event_type_key_taken' });
            throw e;
        }
    }

    private async ownType(ctx: OrgContext, id: string) {
        const t = await this.prisma.notificationEventType.findFirst({ where: { id, ...this.visibleType(ctx) } });
        if (!t) throw NOT_FOUND('Event type', 'event_type_not_found');
        if (!t.organization_id) throw new ForbiddenException({ message: 'Platform event types are defined by the platform; use organization defaults and templates to adapt them', code: 'platform_event_type_read_only' });
        return t;
    }

    async updateEventType(ctx: OrgContext, id: string, dto: UpdateEventTypeInput) {
        const before = await this.ownType(ctx, id);
        const row = await this.prisma.notificationEventType.update({ where: { id }, data: dto });
        await this.audit.record(ctx, 'notification.event_type_updated', {
            resource_type: 'notification_event_type', resource_id: id,
            metadata: { before: { name: before.name, mandatory_by_default: before.mandatory_by_default, default_channels: before.default_channels, is_active: before.is_active }, after: dto, sensitive: dto.mandatory_by_default !== undefined && dto.mandatory_by_default !== before.mandatory_by_default },
        });
        this.publish(ctx, 'notification.event_type.updated', 'notification_event_type', id, { key: row.key });
        return row;
    }

    async deprecateEventType(ctx: OrgContext, id: string) {
        await this.ownType(ctx, id);
        const row = await this.prisma.notificationEventType.update({ where: { id }, data: { deprecated_at: new Date(), is_active: false } });
        await this.audit.record(ctx, 'notification.event_type_deprecated', { resource_type: 'notification_event_type', resource_id: id, metadata: { key: row.key } });
        this.publish(ctx, 'notification.event_type.deprecated', 'notification_event_type', id, { key: row.key });
        return row;
    }

    // ================================================================ templates

    async listTemplates(ctx: OrgContext, q: TemplateQuery) {
        const where: Prisma.NotificationTemplateWhereInput = {
            AND: [
                q.scope === 'platform' ? { organization_id: null } : q.scope === 'organization' ? { organization_id: ctx.organization_id } : { OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] },
                { event_type: this.visibleType(ctx) },
                ...(q.event_type_id ? [{ event_type_id: q.event_type_id }] : []),
                ...(q.channel ? [{ channel: q.channel }] : []),
                ...(q.search ? [{ OR: [{ title: { contains: q.search, mode: 'insensitive' as const } }, { event_type: { key: { contains: q.search, mode: 'insensitive' as const } } }] }] : []),
            ],
        };
        const [rows, total] = await Promise.all([
            this.prisma.notificationTemplate.findMany({ where, ...skipTake(q), orderBy: orderBy(q, ['updated_at', 'created_at'], 'updated_at'), include: { event_type: { select: { id: true, key: true, name: true, module: true } } } }),
            this.prisma.notificationTemplate.count({ where }),
        ]);
        return paginate(rows.map((t) => ({ ...t, scope: t.organization_id ? 'organization' : 'platform', editable: !!t.organization_id })), total, q);
    }

    async getTemplate(ctx: OrgContext, id: string) {
        const t = await this.prisma.notificationTemplate.findFirst({
            where: { id, OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] },
            include: { event_type: { select: { id: true, key: true, name: true, module: true, payload_schema: true } }, versions: { orderBy: { version: 'desc' }, take: 30 } },
        });
        if (!t) throw NOT_FOUND('Template', 'template_not_found');
        return { ...t, scope: t.organization_id ? 'organization' : 'platform', editable: !!t.organization_id };
    }

    /** Organization template (a new one, or a customized copy of a platform default: same event type, channel and locale). */
    async createTemplate(ctx: OrgContext, dto: CreateTemplateInput) {
        const type = await this.prisma.notificationEventType.findFirst({ where: { id: dto.event_type_id, ...this.visibleType(ctx) }, select: { id: true, key: true } });
        if (!type) throw NOT_FOUND('Event type', 'event_type_not_found');
        const exists = await this.prisma.notificationTemplate.findFirst({ where: { organization_id: ctx.organization_id, event_type_id: dto.event_type_id, channel: dto.channel, locale: dto.locale ?? null }, select: { id: true } });
        if (exists) throw new ConflictException({ message: 'This organization already has a template for this event, channel and language', code: 'template_exists', template_id: exists.id });
        const row = await this.prisma.notificationTemplate.create({ data: { ...dto, locale: dto.locale ?? null, organization_id: ctx.organization_id, created_by_membership_id: ctx.membership_id, updated_by_membership_id: ctx.membership_id } });
        await this.audit.record(ctx, 'notification.template_created', { resource_type: 'notification_template', resource_id: row.id, metadata: { event_key: type.key, channel: dto.channel, locale: dto.locale ?? null } });
        this.publish(ctx, 'notification.template.created', 'notification_template', row.id, { event_key: type.key, channel: dto.channel });
        return row;
    }

    private async ownTemplate(ctx: OrgContext, id: string) {
        const t = await this.prisma.notificationTemplate.findFirst({ where: { id, OR: [{ organization_id: null }, { organization_id: ctx.organization_id }] } });
        if (!t) throw NOT_FOUND('Template', 'template_not_found');
        if (!t.organization_id) throw new ForbiddenException({ message: 'Platform templates are read-only; customize to create an organization copy', code: 'platform_template_read_only' });
        return t;
    }

    /** Each save snapshots the previous content as a NotificationTemplateVersion and bumps `version`. */
    async updateTemplate(ctx: OrgContext, id: string, dto: UpdateTemplateInput) {
        const before = await this.ownTemplate(ctx, id);
        const row = await this.prisma.$transaction(async (tx) => {
            await tx.notificationTemplateVersion.create({
                data: {
                    organization_id: ctx.organization_id, template_id: id, version: before.version, subject: before.subject, title: before.title, body: before.body, html_body: before.html_body,
                    cta_label: before.cta_label, cta_url: before.cta_url, variables: (before.variables ?? undefined) as Prisma.InputJsonValue | undefined, changed_by_membership_id: ctx.membership_id,
                },
            });
            return tx.notificationTemplate.update({ where: { id }, data: { ...dto, version: { increment: 1 }, updated_by_membership_id: ctx.membership_id } });
        });
        await this.audit.record(ctx, 'notification.template_updated', { resource_type: 'notification_template', resource_id: id, metadata: { version: row.version, before: { subject: before.subject, title: before.title, body: before.body, is_active: before.is_active }, after: dto } });
        this.publish(ctx, 'notification.template.updated', 'notification_template', id, { version: row.version });
        return row;
    }

    async restoreTemplateVersion(ctx: OrgContext, id: string, version: number) {
        await this.ownTemplate(ctx, id);
        const v = await this.prisma.notificationTemplateVersion.findUnique({ where: { template_id_version: { template_id: id, version } } });
        if (!v) throw NOT_FOUND('Version', 'template_version_not_found');
        return this.updateTemplate(ctx, id, { subject: v.subject, title: v.title, body: v.body, html_body: v.html_body, cta_label: v.cta_label, cta_url: v.cta_url });
    }

    async deleteTemplate(ctx: OrgContext, id: string) {
        const t = await this.ownTemplate(ctx, id);
        await this.prisma.notificationTemplate.delete({ where: { id } });
        await this.audit.record(ctx, 'notification.template_deleted', { resource_type: 'notification_template', resource_id: id, metadata: { event_type_id: t.event_type_id, channel: t.channel, locale: t.locale } });
        this.publish(ctx, 'notification.template.deleted', 'notification_template', id);
        return { success: true };
    }

    /** Render with a sample payload (no send). */
    async previewTemplate(ctx: OrgContext, dto: PreviewTemplateInput) {
        const org = await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { display_name: true } });
        const sample: Record<string, unknown> = {
            title: 'WEB-142 was assigned to you', body: 'Rebuild pricing page hero', entity_label: 'WEB-142', url: 'https://app.example.com/tasks/WEB-142', link: 'https://app.example.com/tasks/WEB-142',
            actor: { name: 'Marco Silva' }, recipient: { name: 'Anna Meyer' }, organization: { name: org?.display_name ?? 'Your organization' }, ...(dto.sample ?? {}),
        };
        const title = renderVars(dto.title, sample);
        const body = renderVars(dto.body, sample);
        const missing = [...new Set([...(dto.subject ?? '').matchAll(/\{\{\s*([\w.]+)\s*\}\}/g), ...dto.title.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g), ...dto.body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))]
            .filter((k) => k.split('.').reduce<unknown>((o, p) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[p] : undefined), sample) === undefined);
        return {
            subject: renderVars(dto.subject ?? dto.title, sample),
            title,
            body,
            html: emailLayout({ orgName: org?.display_name ?? '', heading: title, paragraphs: [body], cta: { label: renderVars(dto.cta_label ?? 'Open', sample), url: String(sample.url) }, footer: 'Preview with sample data.' }),
            missing_variables: missing,
        };
    }

    // ================================================================ organization defaults

    async listDefaults(ctx: OrgContext) {
        const [rows, settings] = await Promise.all([
            this.prisma.notificationOrgDefault.findMany({ where: { organization_id: ctx.organization_id }, include: { event_type: { select: { id: true, key: true, name: true, module: true, mandatory_by_default: true } } }, orderBy: [{ module: 'asc' }, { created_at: 'asc' }] }),
            this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: ctx.organization_id }, select: { enabled_channels: true, portal_enabled_channels: true } }),
        ]);
        return {
            modules: rows.filter((r) => r.module && !r.event_type_id),
            events: rows.filter((r) => r.event_type_id),
            enabled_channels: settings?.enabled_channels ?? ORG_DEFAULT_SETTINGS.enabled_channels,
            portal_enabled_channels: settings?.portal_enabled_channels ?? ORG_DEFAULT_SETTINGS.portal_enabled_channels,
            available_modules: ctx.effective.modules.length ? ctx.effective.modules : Object.values(ModuleKey),
        };
    }

    async setDefault(ctx: OrgContext, dto: SetOrgDefaultInput) {
        if (dto.event_type_id && !(await this.prisma.notificationEventType.findFirst({ where: { id: dto.event_type_id, ...this.visibleType(ctx) }, select: { id: true } }))) throw NOT_FOUND('Event type', 'event_type_not_found');
        const data = {
            enabled: dto.enabled, channels: [...new Set([NotificationChannel.IN_APP, ...dto.channels])], portal_channels: dto.portal_channels, delivery_mode: dto.delivery_mode,
            digest_frequency: dto.digest_frequency, is_mandatory: dto.is_mandatory, updated_by_membership_id: ctx.membership_id,
        };
        const existing = await this.prisma.notificationOrgDefault.findFirst({ where: { organization_id: ctx.organization_id, ...(dto.event_type_id ? { event_type_id: dto.event_type_id } : { module: dto.module, event_type_id: null }) } });
        const row = existing
            ? await this.prisma.notificationOrgDefault.update({ where: { id: existing.id }, data })
            : await this.prisma.notificationOrgDefault.create({ data: { ...data, organization_id: ctx.organization_id, module: dto.event_type_id ? null : dto.module ?? null, event_type_id: dto.event_type_id ?? null } });
        const mandatoryChanged = (existing?.is_mandatory ?? false) !== row.is_mandatory;
        await this.audit.record(ctx, mandatoryChanged ? 'notification.default_mandatory_changed' : 'notification.default_set', {
            resource_type: 'notification_org_default', resource_id: row.id,
            metadata: { before: existing ? { enabled: existing.enabled, channels: existing.channels, is_mandatory: existing.is_mandatory, delivery_mode: existing.delivery_mode } : null, after: dto, sensitive: mandatoryChanged },
        });
        this.publish(ctx, 'notification.default.updated', 'notification_org_default', row.id, { module: row.module, event_type_id: row.event_type_id, is_mandatory: row.is_mandatory });
        return row;
    }

    async removeDefault(ctx: OrgContext, id: string) {
        const row = await this.prisma.notificationOrgDefault.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw NOT_FOUND('Default', 'default_not_found');
        await this.prisma.notificationOrgDefault.delete({ where: { id } });
        await this.audit.record(ctx, 'notification.default_removed', { resource_type: 'notification_org_default', resource_id: id, metadata: { module: row.module, event_type_id: row.event_type_id, sensitive: row.is_mandatory } });
        this.publish(ctx, 'notification.default.removed', 'notification_org_default', id);
        return { success: true };
    }

    // ================================================================ delivery rules

    async listRules(ctx: OrgContext) {
        return this.prisma.notificationDeliveryRule.findMany({ where: { organization_id: ctx.organization_id }, include: { event_type: { select: { id: true, key: true, name: true } } }, orderBy: [{ priority: 'asc' }, { created_at: 'asc' }] });
    }

    private async assertRuleRefs(ctx: OrgContext, dto: { event_type_id?: string | null }) {
        if (dto.event_type_id && !(await this.prisma.notificationEventType.findFirst({ where: { id: dto.event_type_id, ...this.visibleType(ctx) }, select: { id: true } }))) throw NOT_FOUND('Event type', 'event_type_not_found');
    }

    async createRule(ctx: OrgContext, dto: CreateDeliveryRuleInput) {
        await this.assertRuleRefs(ctx, dto);
        const row = await this.prisma.notificationDeliveryRule.create({ data: { ...dto, conditions: (dto.conditions ?? undefined) as Prisma.InputJsonValue | undefined, organization_id: ctx.organization_id, created_by_membership_id: ctx.membership_id } });
        this.rules.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'notification.delivery_rule_created', { resource_type: 'notification_delivery_rule', resource_id: row.id, metadata: { after: dto } });
        this.publish(ctx, 'notification.delivery_rule.created', 'notification_delivery_rule', row.id, { kind: row.kind });
        return row;
    }

    async updateRule(ctx: OrgContext, id: string, dto: UpdateDeliveryRuleInput) {
        const before = await this.prisma.notificationDeliveryRule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw NOT_FOUND('Rule', 'delivery_rule_not_found');
        await this.assertRuleRefs(ctx, dto);
        const merged = { ...before, ...dto };
        if (merged.event_type_id && merged.module) throw new BadRequestException({ message: 'Choose an event type or a module, not both', code: 'validation_failed' });
        if (merged.kind !== 'SUPPRESS' && !merged.window_seconds) throw new BadRequestException({ message: 'Set a window for this kind of rule', code: 'validation_failed' });
        if (merged.kind === 'THROTTLE' && !merged.max_per_window) throw new BadRequestException({ message: 'Set the maximum per window', code: 'validation_failed' });
        const row = await this.prisma.notificationDeliveryRule.update({ where: { id }, data: { ...dto, conditions: dto.conditions === undefined ? undefined : dto.conditions === null ? Prisma.DbNull : (dto.conditions as Prisma.InputJsonValue) } });
        this.rules.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'notification.delivery_rule_updated', { resource_type: 'notification_delivery_rule', resource_id: id, metadata: { before: { name: before.name, kind: before.kind, is_active: before.is_active, priority: before.priority }, after: dto } });
        this.publish(ctx, 'notification.delivery_rule.updated', 'notification_delivery_rule', id, { kind: row.kind });
        return row;
    }

    async deleteRule(ctx: OrgContext, id: string) {
        const before = await this.prisma.notificationDeliveryRule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw NOT_FOUND('Rule', 'delivery_rule_not_found');
        await this.prisma.notificationDeliveryRule.delete({ where: { id } });
        this.rules.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'notification.delivery_rule_deleted', { resource_type: 'notification_delivery_rule', resource_id: id, metadata: { name: before.name, kind: before.kind } });
        this.publish(ctx, 'notification.delivery_rule.deleted', 'notification_delivery_rule', id);
        return { success: true };
    }

    // ================================================================ organization settings

    async getSettings(ctx: OrgContext) {
        const [row, emailConnected, smsConnected, senders, devices] = await Promise.all([
            this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: ctx.organization_id } }),
            this.delivery.emailAvailable(ctx.organization_id),
            this.delivery.smsAvailable(ctx.organization_id),
            this.prisma.commSenderIdentity.findMany({ where: { organization_id: ctx.organization_id, channel: { in: ['EMAIL', 'SMS'] } }, select: { id: true, channel: true, address: true, display_name: true, status: true }, orderBy: { address: 'asc' } }),
            // Organizations only see counts of their members' browsers (devices are user-level, mockup 14 "Devices").
            this.prisma.notificationPushDevice.count({ where: { disabled_at: null, platform: 'WEB', user: { memberships: { some: { organization_id: ctx.organization_id, status: 'ACTIVE' } } } } }),
        ]);
        return {
            ...(row ?? { organization_id: ctx.organization_id, ...ORG_DEFAULT_SETTINGS }),
            providers: {
                email: { connected: emailConnected, reason: emailConnected ? null : 'No email provider connected. Connect Resend in Admin → Integrations.' },
                sms: { connected: smsConnected, reason: smsConnected ? null : 'No SMS provider connected. Connect Twilio in Admin → Integrations.' },
                push: { connected: true, reason: null, active_browsers: devices },
            },
            sender_identities: senders.filter((x) => x.channel === 'EMAIL'),
            sms_sender_identities: senders.filter((x) => x.channel === 'SMS'),
        };
    }

    async updateSettings(ctx: OrgContext, dto: UpdateOrgSettingsInput) {
        if (dto.email_sender_identity_id && !(await this.prisma.commSenderIdentity.findFirst({ where: { id: dto.email_sender_identity_id, organization_id: ctx.organization_id, channel: 'EMAIL' }, select: { id: true } }))) {
            throw NOT_FOUND('Sender identity', 'sender_identity_not_found');
        }
        if (dto.sms_sender_identity_id && !(await this.prisma.commSenderIdentity.findFirst({ where: { id: dto.sms_sender_identity_id, organization_id: ctx.organization_id, channel: 'SMS' }, select: { id: true } }))) {
            throw NOT_FOUND('SMS sender', 'sender_identity_not_found');
        }
        const enabled = dto.enabled_channels ? [...new Set([NotificationChannel.IN_APP, ...dto.enabled_channels])] : undefined;
        const before = await this.prisma.notificationOrgSettings.findUnique({ where: { organization_id: ctx.organization_id } });
        await this.prisma.notificationOrgSettings.upsert({
            where: { organization_id: ctx.organization_id },
            update: { ...dto, enabled_channels: enabled, updated_by_membership_id: ctx.membership_id },
            create: { ...dto, enabled_channels: enabled, organization_id: ctx.organization_id, updated_by_membership_id: ctx.membership_id },
        });
        this.webhooks.invalidate(ctx.organization_id);
        await this.audit.record(ctx, 'notification.org_settings_updated', { resource_type: 'notification_org_settings', resource_id: ctx.organization_id, metadata: { before, after: dto } });
        this.publish(ctx, 'notification.settings.updated', 'notification_org_settings', ctx.organization_id, { changes: Object.keys(dto) });
        return this.getSettings(ctx);
    }
}
