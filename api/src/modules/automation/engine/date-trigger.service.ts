import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AutomationRule, AutomationRunMode, AutomationTriggerKind, PlatformEventSource, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { DATE_SOURCE_BY_TRIGGER_KEY, dateConfig } from '../catalog/date-trigger-catalog';
import { AutomationSettingsService } from '../settings/automation-settings.service';
import { AutomationEngineService, eventSnapshot } from './automation-engine.service';

const DAY = 86_400_000;
/** Missed days are caught up within this window (e.g. the API was down overnight); the dedupe key prevents repeats. */
const CATCH_UP_DAYS = 2;

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * 20 §3 — DATE_RELATIVE triggers ("3 days before task due date"). An hourly scanner finds, for every PUBLISHED + enabled
 * rule, the records whose watched date is `offset_days` away, and for each one writes a per-record PlatformEvent
 * (`date.<source>`, source SCHEDULED_JOB) with dedupe key `daterel:<rule>:<record>:<date>` and starts a run. The same
 * record and date never fire twice for a rule; when the date moves, the record fires again for the new date.
 */
@Injectable()
export class DateTriggerService {
    private readonly logger = new Logger(DateTriggerService.name);
    private busy = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly engine: AutomationEngineService,
        private readonly settings: AutomationSettingsService,
    ) { }

    @Interval('automation-date-triggers', 3600_000)
    async scanAll() {
        if (this.busy) return;
        this.busy = true;
        try {
            const rules = await this.prisma.automationRule.findMany({
                where: { trigger_kind: AutomationTriggerKind.DATE_RELATIVE, status: 'PUBLISHED', enabled: true, archived_at: null },
            });
            for (const rule of rules) {
                try {
                    await this.scanRule(rule);
                } catch (error) {
                    this.logger.warn(`date trigger scan failed for rule ${rule.id}: ${(error as Error).message}`);
                }
            }
        } finally {
            this.busy = false;
        }
    }

    /** Scan one rule now (also called when a date-relative rule is published or enabled). Returns the runs started. */
    async scanRule(rule: AutomationRule, now = new Date()) {
        if (rule.trigger_kind !== AutomationTriggerKind.DATE_RELATIVE || rule.status !== 'PUBLISHED' || !rule.enabled) return { started: 0, matched: 0 };
        const source = DATE_SOURCE_BY_TRIGGER_KEY.get(rule.trigger_key);
        if (!source) return { started: 0, matched: 0 };
        const config = dateConfig(rule.trigger_config);

        // The principal must be able to read the watched records (20 §10); skip silently otherwise.
        const ctx = await this.engine.principalContext(rule, await this.settings.forOrganization(rule.organization_id));
        if (!ctx || !ctx.can(source.required_permission) || !ctx.effective.modules.includes(source.module)) return { started: 0, matched: 0 };

        // Fire day = record date − offset (before) / + offset (after). Fire on fire days in [today − catch-up, today],
        // never earlier than the day the rule was enabled (no burst of past reminders when switching a rule on).
        const today = startOfUtcDay(now);
        const enabledDay = rule.enabled_at ? startOfUtcDay(rule.enabled_at) : today;
        const firstFireDay = new Date(Math.max(today.getTime() - CATCH_UP_DAYS * DAY, enabledDay.getTime()));
        const shift = (config.direction === 'after' ? -1 : 1) * config.offset_days * DAY;
        const from = new Date(firstFireDay.getTime() + shift);
        const to = new Date(today.getTime() + shift);
        if (from > to) return { started: 0, matched: 0 };

        const records = await source.find(this.prisma, rule.organization_id, from, to);
        let started = 0;
        for (const record of records) {
            const dateKey = record.date.toISOString().slice(0, 10);
            const event = await this.prisma.platformEvent.create({
                data: {
                    organization_id: rule.organization_id,
                    event_key: rule.trigger_key,
                    module: source.module,
                    source: PlatformEventSource.SCHEDULED_JOB,
                    entity_type: source.entity_type,
                    entity_id: record.id,
                    payload: { ...record.payload, days_offset: config.offset_days, direction: config.direction, rule_id: rule.id } as Prisma.InputJsonValue,
                    actor_type: 'SYSTEM',
                    dedupe_key: `daterel:${rule.id}:${record.id}:${dateKey}`,
                    // Consumed right here (only this rule listens to it): the missed-event sweep must not pick it up.
                    rules_processed_at: new Date(),
                    rules_matched_count: 1,
                },
            }).catch((error) => {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null; // already fired
                throw error;
            });
            if (!event) continue;
            const run = await this.engine.startRun(rule, { mode: AutomationRunMode.LIVE, event: eventSnapshot(event), idempotency_key: `event:${event.id}` });
            if (run) started++;
        }
        if (records.length) this.logger.log(`date trigger ${rule.trigger_key} (${rule.id}): ${records.length} record(s), ${started} run(s)`);
        await this.prisma.automationRule.update({ where: { id: rule.id }, data: { next_run_at: new Date(Date.now() + 3600_000) } });
        return { started, matched: records.length };
    }

    /** Builder preview: records that would fire today with this source and offset (read-only, caller's own org). */
    async preview(organizationId: string, triggerKey: string, rawConfig: unknown) {
        const source = DATE_SOURCE_BY_TRIGGER_KEY.get(triggerKey);
        if (!source) return { records: [], total: 0 };
        const config = dateConfig(rawConfig);
        const today = startOfUtcDay(new Date());
        const target = new Date(today.getTime() + (config.direction === 'after' ? -1 : 1) * config.offset_days * DAY);
        const records = await source.find(this.prisma, organizationId, target, target);
        return { date: target.toISOString().slice(0, 10), total: records.length, records: records.slice(0, 10).map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), label: String(r.payload.title ?? r.payload.name ?? r.payload.number ?? r.id) })) };
    }
}
