import { Injectable } from '@nestjs/common';
import {
    ModuleKey, NotificationChannel, NotificationCoalesceKey, NotificationDeliveryRule, NotificationDeliveryRuleKind, NotificationDeliveryStatus, NotificationSkipReason, Prisma,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

export interface RuleSubject {
    organization_id: string;
    event_type_id: string;
    event_key: string;
    module: ModuleKey;
    entity_type?: string | null;
    entity_id?: string | null;
    actor_membership_id?: string | null;
}

export interface CoalesceUpdate {
    title: string;
    body?: string | null;
    link?: string | null;
}

const CACHE_MS = 30_000;

/**
 * 14 §9, §16 — organization delivery rules evaluated before delivery, lowest priority number first:
 * SUPPRESS drops, DEDUPLICATE skips the same event + record inside the window, THROTTLE caps per recipient and window,
 * COALESCE (in-app) folds the event into the recipient's unread notification of the same key. Mandatory events are never
 * filtered (callers skip this service for them).
 */
@Injectable()
export class NotificationRulesService {
    private readonly cache = new Map<string, { at: number; rules: Promise<NotificationDeliveryRule[]> }>();

    constructor(private readonly prisma: PrismaService) { }

    invalidate(organizationId: string) {
        this.cache.delete(organizationId);
    }

    private rules(organizationId: string) {
        const hit = this.cache.get(organizationId);
        if (hit && Date.now() - hit.at < CACHE_MS) return hit.rules;
        const rules = this.prisma.notificationDeliveryRule.findMany({ where: { organization_id: organizationId, is_active: true }, orderBy: [{ priority: 'asc' }, { created_at: 'asc' }] });
        this.cache.set(organizationId, { at: Date.now(), rules });
        rules.catch(() => this.cache.delete(organizationId));
        return rules;
    }

    /** Rules that apply to this event on this channel. */
    async matching(subject: RuleSubject, channel: NotificationChannel) {
        const all = await this.rules(subject.organization_id);
        return all.filter((r) =>
            (!r.channel || r.channel === channel)
            && (r.event_type_id ? r.event_type_id === subject.event_type_id : r.module ? r.module === subject.module : true)
            && this.conditionsMatch(r.conditions, subject));
    }

    /** Minimal conditions: `{ "actor": "none" | "member" }`, `{ "entity_type": "TASK" }`. Unknown keys never match. */
    private conditionsMatch(conditions: Prisma.JsonValue | null, s: RuleSubject) {
        if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return true;
        return Object.entries(conditions).every(([k, v]) => {
            if (k === 'actor') return v === 'none' ? !s.actor_membership_id : v === 'member' ? !!s.actor_membership_id : false;
            if (k === 'entity_type') return s.entity_type === v;
            if (k === 'event_key') return s.event_key === v;
            return false;
        });
    }

    private since(rule: NotificationDeliveryRule) {
        return new Date(Date.now() - Math.max(1, rule.window_seconds ?? 3600) * 1000);
    }

    private sameRecord(s: RuleSubject): Prisma.NotificationWhereInput {
        return s.entity_id ? { event_key: s.event_key, entity_id: s.entity_id } : { event_key: s.event_key };
    }

    private coalesceWhere(rule: NotificationDeliveryRule, s: RuleSubject): Prisma.NotificationWhereInput | null {
        switch (rule.coalesce_key ?? NotificationCoalesceKey.RECORD) {
            case NotificationCoalesceKey.RECORD:
                return s.entity_id ? { entity_type: s.entity_type as never, entity_id: s.entity_id } : null;
            case NotificationCoalesceKey.RECORD_AND_ACTOR:
                return s.entity_id ? { entity_type: s.entity_type as never, entity_id: s.entity_id, actor_membership_id: s.actor_membership_id ?? null } : null;
            case NotificationCoalesceKey.EVENT_TYPE:
                return { event_type_id: s.event_type_id };
            default:
                return rule.event_type_id ? { event_type_id: rule.event_type_id } : rule.module ? { module: rule.module } : {};
        }
    }

    /**
     * In-app: returns the recipients that still get a NEW notification. Coalesced recipients have their existing unread
     * notification refreshed (count + 1, newest title, unread again).
     */
    async applyInApp(subject: RuleSubject, recipientIds: string[], update: CoalesceUpdate): Promise<Set<string>> {
        const keep = new Set(recipientIds);
        const rules = await this.matching(subject, NotificationChannel.IN_APP);
        for (const rule of rules) {
            if (!keep.size) break;
            const ids = [...keep];
            const base: Prisma.NotificationWhereInput = { organization_id: subject.organization_id, recipient_membership_id: { in: ids }, created_at: { gte: this.since(rule) } };
            if (rule.kind === NotificationDeliveryRuleKind.SUPPRESS) {
                keep.clear();
            } else if (rule.kind === NotificationDeliveryRuleKind.DEDUPLICATE) {
                const dup = await this.prisma.notification.findMany({ where: { ...base, ...this.sameRecord(subject) }, select: { recipient_membership_id: true }, distinct: ['recipient_membership_id'] });
                dup.forEach((d) => keep.delete(d.recipient_membership_id as string));
            } else if (rule.kind === NotificationDeliveryRuleKind.THROTTLE && rule.max_per_window) {
                const scope: Prisma.NotificationWhereInput = rule.event_type_id ? { event_type_id: rule.event_type_id } : rule.module ? { module: rule.module } : {};
                const counts = await this.prisma.notification.groupBy({ by: ['recipient_membership_id'], where: { ...base, ...scope }, _count: { _all: true } });
                counts.filter((c) => c._count._all >= (rule.max_per_window as number)).forEach((c) => keep.delete(c.recipient_membership_id as string));
            } else if (rule.kind === NotificationDeliveryRuleKind.COALESCE) {
                const key = this.coalesceWhere(rule, subject);
                if (!key) continue;
                const open = await this.prisma.notification.findMany({
                    where: { ...base, ...key, archived_at: null, read_at: null },
                    orderBy: { last_event_at: 'desc' },
                    select: { id: true, recipient_membership_id: true },
                });
                const seen = new Set<string>();
                for (const n of open) {
                    const who = n.recipient_membership_id as string;
                    if (seen.has(who) || !keep.has(who)) continue;
                    seen.add(who);
                    await this.prisma.notification.update({
                        where: { id: n.id },
                        data: { title: update.title.slice(0, 300), body: update.body?.slice(0, 2000) ?? undefined, action_url: update.link ?? undefined, coalesced_count: { increment: 1 }, last_event_at: new Date(), seen_at: null },
                    });
                    keep.delete(who);
                }
            }
        }
        return keep;
    }

    /** Email (and other external channels): the skip reason for one recipient, or null to deliver. */
    async externalSkip(subject: RuleSubject, channel: NotificationChannel, recipientId: string): Promise<{ reason: NotificationSkipReason; detail: string } | null> {
        const rules = await this.matching(subject, channel);
        for (const rule of rules) {
            const base: Prisma.NotificationDeliveryWhereInput = {
                organization_id: subject.organization_id,
                channel,
                created_at: { gte: this.since(rule) },
                status: { in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.QUEUED, NotificationDeliveryStatus.SENT, NotificationDeliveryStatus.DELIVERED, NotificationDeliveryStatus.DIGESTED] },
                notification: { recipient_membership_id: recipientId },
            };
            if (rule.kind === NotificationDeliveryRuleKind.SUPPRESS) return { reason: NotificationSkipReason.CHANNEL_DISABLED, detail: `Suppressed by rule “${rule.name}”` };
            if (rule.kind === NotificationDeliveryRuleKind.DEDUPLICATE || rule.kind === NotificationDeliveryRuleKind.COALESCE) {
                const dup = await this.prisma.notificationDelivery.count({ where: { ...base, notification: { recipient_membership_id: recipientId, ...this.sameRecord(subject) } } });
                // The notification being delivered already has its own row: anything beyond it is a duplicate.
                if (dup > 1) return { reason: rule.kind === NotificationDeliveryRuleKind.COALESCE ? NotificationSkipReason.COALESCED : NotificationSkipReason.DEDUPLICATED, detail: `Rule “${rule.name}”` };
            }
            if (rule.kind === NotificationDeliveryRuleKind.THROTTLE && rule.max_per_window) {
                const scope: Prisma.NotificationWhereInput = rule.event_type_id ? { event_type_id: rule.event_type_id } : rule.module ? { module: rule.module } : {};
                const sent = await this.prisma.notificationDelivery.count({ where: { ...base, notification: { recipient_membership_id: recipientId, ...scope } } });
                if (sent > rule.max_per_window) return { reason: NotificationSkipReason.THROTTLED, detail: `Rule “${rule.name}”: max ${rule.max_per_window} per ${rule.window_seconds ?? 3600}s` };
            }
        }
        return null;
    }
}
