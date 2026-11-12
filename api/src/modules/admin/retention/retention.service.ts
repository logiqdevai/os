import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
    InvitationStatus,
    ModuleKey,
    OrganizationRetentionAction,
    OrganizationRetentionDataClass,
    OrganizationRetentionPolicy,
    Prisma,
    WebhookDeliveryStatus,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { RETENTION_ACTIONS, RETENTION_MIN_DAYS, UpdateRetentionPolicyInput } from './dto/retention.dto';

const CLASSES = Object.values(OrganizationRetentionDataClass);
const DEFAULT_ACTION: Record<OrganizationRetentionDataClass, OrganizationRetentionAction> = {
    AUDIT_EVENTS: OrganizationRetentionAction.ARCHIVE,
    SESSIONS: OrganizationRetentionAction.DELETE,
    INVITATIONS: OrganizationRetentionAction.DELETE,
    WEBHOOK_DELIVERIES: OrganizationRetentionAction.DELETE,
};

type RunResult = { data_class: OrganizationRetentionDataClass; action: OrganizationRetentionAction; affected: number; skipped?: 'legal_hold' | 'keep_forever' | 'archive_not_available' };

/**
 * Retention of platform data owned by module 01 (01 §100, §134; mockup 01-admin `retention`), one policy per data class.
 * A daily job (and "Run now") applies the policies: sessions / invitations / webhook deliveries older than the period are
 * deleted; audit events are never deleted — ANONYMIZE scrubs ip_address and user_agent, ARCHIVE keeps them in place until
 * an archive store exists. legal_hold suspends every purge for the class. Documents (17) and messages (12) own their policies.
 */
@Injectable()
export class RetentionService {
    private readonly logger = new Logger(RetentionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
    ) { }

    async findAll(ctx: OrgContext) {
        const rows = await this.prisma.organizationRetentionPolicy.findMany({
            where: { organization_id: ctx.organization_id },
            include: { updated_by: { select: { id: true, user: { select: { display_name: true, email: true } } } } },
        });
        const data = await Promise.all(
            CLASSES.map(async (data_class) => {
                const row = rows.find((r) => r.data_class === data_class);
                const policy = row ?? { data_class, retention_days: null, action: DEFAULT_ACTION[data_class], legal_hold: false, legal_hold_reason: null, last_run_at: null, updated_at: null, updated_by: null };
                return {
                    ...policy,
                    is_default: !row,
                    allowed_actions: RETENTION_ACTIONS[data_class],
                    min_days: RETENTION_MIN_DAYS[data_class],
                    eligible: policy.retention_days ? await this.count(ctx.organization_id, data_class, this.cutoff(policy.retention_days)) : 0,
                };
            }),
        );
        return { data };
    }

    async update(ctx: OrgContext, dataClass: OrganizationRetentionDataClass, dto: UpdateRetentionPolicyInput) {
        const before = await this.prisma.organizationRetentionPolicy.findUnique({ where: { organization_id_data_class: { organization_id: ctx.organization_id, data_class: dataClass } } });
        const action = dto.action ?? before?.action ?? DEFAULT_ACTION[dataClass];
        if (!RETENTION_ACTIONS[dataClass].includes(action)) {
            throw new BadRequestException({ message: `${dataClass} supports: ${RETENTION_ACTIONS[dataClass].join(', ')}`, code: 'retention_action_invalid' });
        }
        if (dto.retention_days !== undefined && dto.retention_days !== null && dto.retention_days < RETENTION_MIN_DAYS[dataClass]) {
            throw new BadRequestException({ message: `Keep this data at least ${RETENTION_MIN_DAYS[dataClass]} days`, code: 'retention_too_short' });
        }
        const legalHold = dto.legal_hold ?? before?.legal_hold ?? false;
        if (dto.legal_hold && !(dto.legal_hold_reason ?? before?.legal_hold_reason)) {
            throw new BadRequestException({ message: 'Say why the legal hold is needed', code: 'legal_hold_reason_required' });
        }
        const data = {
            retention_days: dto.retention_days === undefined ? before?.retention_days ?? null : dto.retention_days,
            action,
            legal_hold: legalHold,
            legal_hold_reason: legalHold ? dto.legal_hold_reason ?? before?.legal_hold_reason ?? null : null,
            updated_by_membership_id: ctx.membership_id,
        };
        const saved = await this.prisma.organizationRetentionPolicy.upsert({
            where: { organization_id_data_class: { organization_id: ctx.organization_id, data_class: dataClass } },
            update: data,
            create: { organization_id: ctx.organization_id, data_class: dataClass, ...data },
        });
        await this.recordChange(ctx, before, saved);
        return (await this.findAll(ctx)).data.find((p) => p.data_class === dataClass);
    }

    /** One switch for every class (mockup "Suspend all deletion"). */
    async setLegalHold(ctx: OrgContext, enabled: boolean, reason?: string | null) {
        if (enabled && !reason?.trim()) throw new BadRequestException({ message: 'Say why the legal hold is needed', code: 'legal_hold_reason_required' });
        for (const dataClass of CLASSES) {
            const before = await this.prisma.organizationRetentionPolicy.findUnique({ where: { organization_id_data_class: { organization_id: ctx.organization_id, data_class: dataClass } } });
            if (!before && !enabled) continue;
            const data = { legal_hold: enabled, legal_hold_reason: enabled ? reason!.trim() : null, updated_by_membership_id: ctx.membership_id };
            const saved = await this.prisma.organizationRetentionPolicy.upsert({
                where: { organization_id_data_class: { organization_id: ctx.organization_id, data_class: dataClass } },
                update: data,
                create: { organization_id: ctx.organization_id, data_class: dataClass, action: DEFAULT_ACTION[dataClass], ...data },
            });
            await this.recordChange(ctx, before, saved);
        }
        return this.findAll(ctx);
    }

    /** Apply the organization's policies now (same code as the daily job). */
    async runNow(ctx: OrgContext) {
        const results = await this.runForOrganization(ctx.organization_id);
        await this.audit.record(ctx, 'retention.purged', { resource_type: 'organization_retention_policy', resource_id: ctx.organization_id, metadata: { manual: true, results } });
        return { results };
    }

    @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'admin-retention-daily' })
    async runDaily() {
        const orgs = await this.prisma.organizationRetentionPolicy.findMany({ where: { retention_days: { not: null } }, select: { organization_id: true }, distinct: ['organization_id'] });
        for (const { organization_id } of orgs) {
            try {
                const results = await this.runForOrganization(organization_id);
                if (results.some((r) => r.affected > 0)) {
                    const ctx = await this.authorization.contextFor({ organization_id, channel: 'automation' });
                    await this.audit.record({ ...ctx, actor_type: 'SYSTEM' }, 'retention.purged', { resource_type: 'organization_retention_policy', resource_id: organization_id, metadata: { manual: false, results } });
                }
            } catch (error) {
                this.logger.warn(`retention run failed for ${organization_id}: ${(error as Error).message}`);
            }
        }
    }

    private async runForOrganization(organizationId: string): Promise<RunResult[]> {
        const policies = await this.prisma.organizationRetentionPolicy.findMany({ where: { organization_id: organizationId } });
        const results: RunResult[] = [];
        for (const p of policies) {
            if (p.legal_hold) { results.push({ data_class: p.data_class, action: p.action, affected: 0, skipped: 'legal_hold' }); continue; }
            if (!p.retention_days) { results.push({ data_class: p.data_class, action: p.action, affected: 0, skipped: 'keep_forever' }); continue; }
            const cutoff = this.cutoff(p.retention_days);
            let affected = 0;
            switch (p.data_class) {
                case OrganizationRetentionDataClass.AUDIT_EVENTS:
                    if (p.action === OrganizationRetentionAction.ANONYMIZE) {
                        affected = (await this.prisma.auditEvent.updateMany({ where: { ...this.auditWhere(organizationId, cutoff), OR: [{ ip_address: { not: null } }, { user_agent: { not: null } }] }, data: { ip_address: null, user_agent: null } })).count;
                    } else {
                        results.push({ data_class: p.data_class, action: p.action, affected: 0, skipped: 'archive_not_available' });
                        continue;
                    }
                    break;
                case OrganizationRetentionDataClass.SESSIONS:
                    affected = (await this.prisma.userSession.deleteMany({ where: this.sessionWhere(organizationId, cutoff) })).count;
                    break;
                case OrganizationRetentionDataClass.INVITATIONS:
                    affected = (await this.prisma.invitation.deleteMany({ where: this.invitationWhere(organizationId, cutoff) })).count;
                    break;
                case OrganizationRetentionDataClass.WEBHOOK_DELIVERIES:
                    affected = (await this.prisma.webhookDelivery.deleteMany({ where: this.deliveryWhere(organizationId, cutoff) })).count;
                    break;
            }
            await this.prisma.organizationRetentionPolicy.update({ where: { id: p.id }, data: { last_run_at: new Date() } });
            results.push({ data_class: p.data_class, action: p.action, affected });
        }
        return results;
    }

    // Selection rules per class (also used for the "eligible" preview count).
    private auditWhere(org: string, cutoff: Date): Prisma.AuditEventWhereInput {
        return { organization_id: org, created_at: { lt: cutoff } };
    }
    /** Sessions are user-level: the organization's are those started in it; only ended ones (revoked or expired). */
    private sessionWhere(org: string, cutoff: Date): Prisma.UserSessionWhereInput {
        return { active_organization_id: org, OR: [{ revoked_at: { lt: cutoff } }, { expires_at: { lt: cutoff } }] };
    }
    private invitationWhere(org: string, cutoff: Date): Prisma.InvitationWhereInput {
        return { organization_id: org, status: { not: InvitationStatus.PENDING }, updated_at: { lt: cutoff } };
    }
    private deliveryWhere(org: string, cutoff: Date): Prisma.WebhookDeliveryWhereInput {
        return { organization_id: org, created_at: { lt: cutoff }, status: { in: [WebhookDeliveryStatus.SUCCEEDED, WebhookDeliveryStatus.FAILED, WebhookDeliveryStatus.DEAD_LETTERED] } };
    }

    private async count(org: string, dataClass: OrganizationRetentionDataClass, cutoff: Date) {
        switch (dataClass) {
            case OrganizationRetentionDataClass.AUDIT_EVENTS:
                return this.prisma.auditEvent.count({ where: this.auditWhere(org, cutoff) });
            case OrganizationRetentionDataClass.SESSIONS:
                return this.prisma.userSession.count({ where: this.sessionWhere(org, cutoff) });
            case OrganizationRetentionDataClass.INVITATIONS:
                return this.prisma.invitation.count({ where: this.invitationWhere(org, cutoff) });
            case OrganizationRetentionDataClass.WEBHOOK_DELIVERIES:
                return this.prisma.webhookDelivery.count({ where: this.deliveryWhere(org, cutoff) });
        }
    }

    private cutoff(days: number) {
        return new Date(Date.now() - days * 86400_000);
    }

    private async recordChange(ctx: OrgContext, before: OrganizationRetentionPolicy | null, after: OrganizationRetentionPolicy) {
        const pick = (p: OrganizationRetentionPolicy | null) => p && { retention_days: p.retention_days, action: p.action, legal_hold: p.legal_hold, legal_hold_reason: p.legal_hold_reason };
        const holdChanged = (before?.legal_hold ?? false) !== after.legal_hold;
        await this.audit.record(ctx, holdChanged ? 'retention.legal_hold_changed' : 'retention.policy_changed', {
            resource_type: 'organization_retention_policy',
            resource_id: after.id,
            metadata: { data_class: after.data_class, before: pick(before), after: pick(after) },
        });
        this.events.publish(ctx, {
            event_key: holdChanged ? 'organizations.retention.legal_hold_changed' : 'organizations.retention.policy_changed',
            module: ModuleKey.ADMINISTRATION,
            entity_kind: 'organization_retention_policy',
            entity_id: after.id,
            payload: { data_class: after.data_class, legal_hold: after.legal_hold },
        });
    }
}
