import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ModuleKey, Prisma, RecordEntityType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

export interface PublishEventInput {
    /** Stable key from the trigger catalog, e.g. `crm.deal.stage_changed`. */
    event_key: string;
    module: ModuleKey;
    entity_type?: RecordEntityType | null;
    entity_kind?: string | null;
    entity_id?: string | null;
    payload?: Record<string, unknown>;
    changes?: Record<string, unknown> | null;
    /** When set, also writes an ActivityEvent (14 activity feed). */
    activity?: {
        summary: string;
        entity_label?: string | null;
        project_id?: string | null;
        company_id?: string | null;
        branch_id?: string | null;
        customer_visible?: boolean;
    };
    dedupe_key?: string | null;
}

export interface PublishedEvent extends PublishEventInput {
    id: string;
    organization_id: string;
    actor_membership_id: string | null;
}

/**
 * Event bus publisher (20 §2). Writes PlatformEvent (consumed by automation rules, notifications and
 * outbound webhooks) and optionally the human-readable ActivityEvent feed row. Never blocks the request:
 * call `publish` after the write committed.
 */
@Injectable()
export class EventsService {
    private readonly logger = new Logger(EventsService.name);
    /** In-process subscribers (automation engine, notifications fan-out, websocket push). */
    readonly bus = new EventEmitter();

    constructor(private readonly prisma: PrismaService) {
        this.bus.setMaxListeners(50);
    }

    publish(ctx: OrgContext, input: PublishEventInput) {
        setImmediate(async () => {
            try {
                const event = await this.prisma.platformEvent.create({
                    data: {
                        organization_id: ctx.organization_id,
                        event_key: input.event_key,
                        module: input.module,
                        source: ctx.channel === 'automation' ? 'AUTOMATION' : ctx.channel === 'ui' ? 'MODULE' : 'API',
                        entity_type: input.entity_type ?? null,
                        entity_kind: input.entity_kind ?? null,
                        entity_id: input.entity_id ?? null,
                        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
                        changes: (input.changes ?? undefined) as Prisma.InputJsonValue,
                        actor_type: ctx.actor_type,
                        actor_user_id: ctx.user_id,
                        actor_membership_id: ctx.membership_id,
                        actor_service_account_id: ctx.service_account_id,
                        dedupe_key: input.dedupe_key ?? null,
                    },
                });
                if (input.activity) {
                    await this.prisma.activityEvent.create({
                        data: {
                            organization_id: ctx.organization_id,
                            event_key: input.event_key,
                            module: input.module,
                            summary: input.activity.summary,
                            entity_type: input.entity_type ?? null,
                            entity_id: input.entity_id ?? null,
                            entity_label: input.activity.entity_label ?? null,
                            actor_membership_id: ctx.membership_id,
                            actor_user_id: ctx.user_id,
                            project_id: input.activity.project_id ?? null,
                            company_id: input.activity.company_id ?? null,
                            branch_id: input.activity.branch_id ?? null,
                            customer_visible: input.activity.customer_visible ?? false,
                            data: (input.payload ?? {}) as Prisma.InputJsonValue,
                        },
                    });
                }
                const published: PublishedEvent = { ...input, id: event.id, organization_id: ctx.organization_id, actor_membership_id: ctx.membership_id };
                this.bus.emit('event', published);
            } catch (error) {
                this.logger.warn(`event ${input.event_key} not published: ${(error as Error).message}`);
            }
        });
    }
}
