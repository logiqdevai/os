import { Injectable, Logger } from '@nestjs/common';
import { AuditOutcome, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';

export interface AuditRecordInput {
    resource_type?: string | null;
    resource_id?: string | null;
    branch_id?: string | null;
    metadata?: Record<string, unknown> | null;
    outcome?: AuditOutcome;
}

const SECRET_KEYS = /(password|secret|token|key_hash|api_key|credential|authorization)/i;

/** Strip anything that looks like a secret before it reaches the audit table. */
function redact(value: unknown, depth = 0): unknown {
    if (depth > 6 || value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
    if (typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1);
        }
        return out;
    }
    if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}…`;
    return value;
}

/**
 * Writes immutable audit events (01 §99). Every write from every channel goes through here.
 * `channel` and the credential id are always added to metadata.
 */
@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private readonly prisma: PrismaService) { }

    async record(ctx: OrgContext | null, eventType: string, input: AuditRecordInput = {}, tx?: Prisma.TransactionClient) {
        const client = tx ?? this.prisma;
        const metadata = {
            ...(redact(input.metadata ?? {}) as Record<string, unknown>),
            channel: ctx?.channel ?? 'system',
            ...(ctx?.api_key_id ? { api_key_id: ctx.api_key_id } : {}),
            ...(ctx?.membership_id ? { actor_membership_id: ctx.membership_id } : {}),
        };
        try {
            return await client.auditEvent.create({
                data: {
                    organization_id: ctx?.organization_id ?? null,
                    actor_type: ctx?.actor_type ?? 'SYSTEM',
                    actor_user_id: ctx?.user_id ?? null,
                    actor_service_account_id: ctx?.service_account_id ?? null,
                    event_type: eventType,
                    resource_type: input.resource_type ?? null,
                    resource_id: input.resource_id ?? null,
                    branch_id: input.branch_id ?? null,
                    outcome: input.outcome ?? AuditOutcome.SUCCESS,
                    metadata: metadata as Prisma.InputJsonValue,
                    ip_address: ctx?.ip_address ?? null,
                    user_agent: ctx?.user_agent ?? null,
                },
            });
        } catch (error) {
            this.logger.error(`audit write failed for ${eventType}: ${(error as Error).message}`);
            if (tx) throw error;
            return null;
        }
    }

    /** Fire-and-forget audit (outside a transaction). */
    recordAsync(ctx: OrgContext | null, eventType: string, input: AuditRecordInput = {}) {
        setImmediate(async () => {
            try {
                await this.record(ctx, eventType, input);
            } catch {
                /* never surfaces */
            }
        });
    }

    recordDenied(ctx: OrgContext, permissions: string[], route: string) {
        this.recordAsync(ctx, 'authorization.denied', { outcome: AuditOutcome.DENIED, metadata: { permissions, route } });
    }
}
