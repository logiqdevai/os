import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboundWebhookStatus, Prisma, WebhookDeliveryStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { EventsService, PublishedEvent } from '@/shared/events/events.service';
import { decryptSecret } from '@/shared/utils/crypto/secret-box.utils';
import { assertSafeUrl, backoffSeconds, matchesEventKey, signPayload } from '../engine/engine.utils';

const MAX_BODY_LOG = 4000;

/**
 * 20 §6, §12 — outbound webhook delivery: fan-out of bus events to subscribed endpoints, CALL_WEBHOOK steps,
 * HMAC signing, retries with exponential backoff, dead-letter and auto-disable after repeated failures.
 */
@Injectable()
export class WebhookDeliveryService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(WebhookDeliveryService.name);
    private readonly listener = (event: PublishedEvent) => void this.fanOut(event);

    constructor(
        private readonly prisma: PrismaService,
        private readonly events: EventsService,
    ) { }

    onModuleInit() {
        this.events.bus.on('event', this.listener);
    }

    onModuleDestroy() {
        this.events.bus.off('event', this.listener);
    }

    /** Body every endpoint receives. */
    static envelope(event: { id: string | null; event_key: string; organization_id: string; occurred_at?: Date | string; entity_type?: string | null; entity_kind?: string | null; entity_id?: string | null; payload?: unknown; changes?: unknown }) {
        return {
            id: event.id,
            type: event.event_key,
            organization_id: event.organization_id,
            occurred_at: event.occurred_at ? new Date(event.occurred_at).toISOString() : new Date().toISOString(),
            data: {
                entity_type: event.entity_type ?? event.entity_kind ?? null,
                entity_id: event.entity_id ?? null,
                object: event.payload ?? {},
                changes: event.changes ?? null,
            },
        };
    }

    /** Subscribed endpoints for one event → one delivery each. */
    async fanOut(event: PublishedEvent) {
        try {
            const hooks = await this.prisma.outboundWebhook.findMany({
                where: { organization_id: event.organization_id, status: OutboundWebhookStatus.ACTIVE },
                select: { id: true, subscribed_events: true, max_attempts: true },
            });
            const targets = hooks.filter((h) => matchesEventKey(h.subscribed_events, event.event_key));
            if (targets.length) {
                const payload = WebhookDeliveryService.envelope({ ...event, id: event.id }) as unknown as Prisma.InputJsonValue;
                for (const hook of targets) {
                    const delivery = await this.prisma.webhookDelivery.create({
                        data: { organization_id: event.organization_id, webhook_id: hook.id, event_id: event.id, event_key: event.event_key, payload, max_attempts: hook.max_attempts },
                    });
                    void this.attempt(delivery.id);
                }
            }
            // Only organizations with endpoints pay for the extra write.
            if (hooks.length) await this.prisma.platformEvent.update({ where: { id: event.id }, data: { webhooks_processed_at: new Date() } }).catch(() => undefined);
        } catch (error) {
            this.logger.warn(`webhook fan-out failed for ${event.event_key}: ${(error as Error).message}`);
        }
    }

    /** CALL_WEBHOOK step and "send test": one delivery, attempted now; the result is returned. */
    async deliverNow(input: { organization_id: string; webhook_id: string; event_key: string; payload: unknown; run_step_id?: string | null; event_id?: string | null; max_attempts?: number }) {
        const delivery = await this.prisma.webhookDelivery.create({
            data: {
                organization_id: input.organization_id,
                webhook_id: input.webhook_id,
                event_key: input.event_key,
                event_id: input.event_id ?? null,
                run_step_id: input.run_step_id ?? null,
                payload: input.payload as Prisma.InputJsonValue,
                // Steps retry through the run, so the delivery itself is attempted once.
                max_attempts: input.max_attempts ?? 1,
            },
        });
        return this.attempt(delivery.id);
    }

    /** One HTTP attempt; updates delivery + endpoint counters; schedules a retry or dead-letters. */
    async attempt(deliveryId: string) {
        const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { webhook: true } });
        if (!delivery) return null;
        const hook = delivery.webhook;
        if (delivery.status === WebhookDeliveryStatus.SUCCEEDED || delivery.status === WebhookDeliveryStatus.DEAD_LETTERED) return delivery;

        const attempt = delivery.attempt + 1;
        const body = JSON.stringify(delivery.payload);
        const started = Date.now();
        let status: number | null = null;
        let responseBody: string | null = null;
        let responseHeaders: Record<string, string> | null = null;
        let error: string | null = null;
        const requestHeaders: Record<string, string> = {
            'content-type': hook.content_type || 'application/json',
            'user-agent': 'LogiqdevOS-Webhooks/1.0',
            'x-logiqdev-event': delivery.event_key,
            'x-logiqdev-delivery': delivery.delivery_key,
            ...(hook.api_version ? { 'x-logiqdev-api-version': hook.api_version } : {}),
            ...((hook.headers as Record<string, string> | null) ?? {}),
        };

        const unsafe = assertSafeUrl(hook.url);
        if (unsafe) error = unsafe;
        else if (hook.status !== OutboundWebhookStatus.ACTIVE && !delivery.run_step_id && delivery.event_key !== 'webhook.test') error = `Endpoint is ${hook.status.toLowerCase()}`;
        else {
            try {
                requestHeaders['x-logiqdev-signature'] = signPayload(decryptSecret(hook.secret), body);
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), Math.max(1, hook.timeout_seconds) * 1000);
                try {
                    const res = await fetch(hook.url, { method: 'POST', headers: requestHeaders, body, signal: controller.signal, redirect: 'manual' });
                    status = res.status;
                    responseHeaders = Object.fromEntries(res.headers.entries());
                    responseBody = (await res.text()).slice(0, MAX_BODY_LOG);
                    if (status < 200 || status >= 300) error = `HTTP ${status}`;
                } finally {
                    clearTimeout(timer);
                }
            } catch (e) {
                error = (e as Error).name === 'AbortError' ? `Timed out after ${hook.timeout_seconds}s` : (e as Error).message;
            }
        }

        const ok = !error;
        const now = new Date();
        const exhausted = attempt >= delivery.max_attempts;
        const nextStatus = ok ? WebhookDeliveryStatus.SUCCEEDED : exhausted ? (delivery.max_attempts > 1 ? WebhookDeliveryStatus.DEAD_LETTERED : WebhookDeliveryStatus.FAILED) : WebhookDeliveryStatus.RETRY_SCHEDULED;
        delete requestHeaders['x-logiqdev-signature'];

        const updated = await this.prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
                attempt,
                status: nextStatus,
                response_status_code: status,
                response_body: responseBody,
                response_headers: (responseHeaders ?? undefined) as Prisma.InputJsonValue | undefined,
                request_headers: requestHeaders as Prisma.InputJsonValue,
                error_message: error,
                duration_ms: Date.now() - started,
                last_attempt_at: now,
                delivered_at: ok ? now : null,
                next_retry_at: nextStatus === WebhookDeliveryStatus.RETRY_SCHEDULED ? new Date(now.getTime() + backoffSeconds(hook.retry_backoff_seconds, attempt) * 1000) : null,
                dead_lettered_at: nextStatus === WebhookDeliveryStatus.DEAD_LETTERED ? now : null,
            },
        });

        const failures = ok ? 0 : hook.consecutive_failures + 1;
        const autoDisable = !ok && hook.disable_after_failures !== null && failures >= hook.disable_after_failures && hook.status === OutboundWebhookStatus.ACTIVE;
        await this.prisma.outboundWebhook.update({
            where: { id: hook.id },
            data: {
                last_delivery_at: now,
                ...(ok ? { last_success_at: now, consecutive_failures: 0 } : { last_failure_at: now, consecutive_failures: failures }),
                ...(autoDisable ? { status: OutboundWebhookStatus.DISABLED, disabled_at: now, disabled_reason: `Disabled after ${failures} consecutive failed deliveries` } : {}),
            },
        });
        return updated;
    }

    /** Worker tick: attempt deliveries whose retry time passed. */
    async retryDue(limit = 25) {
        const due = await this.prisma.webhookDelivery.findMany({
            where: { status: WebhookDeliveryStatus.RETRY_SCHEDULED, next_retry_at: { lte: new Date() } },
            select: { id: true },
            take: limit,
            orderBy: { next_retry_at: 'asc' },
        });
        for (const d of due) {
            // Claim: only one worker moves it to PENDING.
            const claimed = await this.prisma.webhookDelivery.updateMany({ where: { id: d.id, status: WebhookDeliveryStatus.RETRY_SCHEDULED }, data: { status: WebhookDeliveryStatus.PENDING } });
            if (claimed.count) await this.attempt(d.id);
        }
        return due.length;
    }
}
