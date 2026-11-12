import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import {
    Channel, ChannelKind, DocumentSource, MessagingExportFormat, MessagingExportStatus, MessagingRetentionAction, MessagingRetentionPolicy, MessagingRetentionScope, ModuleKey, Prisma,
} from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { DocumentsService } from '@/modules/files/services/documents.service';
import { personName } from './messaging-access.service';

// ---------------------------------------------------------------------------------------------- schemas

export const RetentionPolicySchema = z
    .object({
        name: z.string().trim().min(1).max(120),
        scope: z.nativeEnum(MessagingRetentionScope).default(MessagingRetentionScope.ORGANIZATION),
        branch_id: z.string().uuid().nullable().optional(),
        team_id: z.string().uuid().nullable().optional(),
        channel_kind: z.nativeEnum(ChannelKind).nullable().optional(),
        /** CHANNEL scope: channels that use this policy. */
        channel_ids: z.array(z.string().uuid()).max(200).optional(),
        action: z.nativeEnum(MessagingRetentionAction),
        retention_days: z.number().int().min(1).max(36500).nullable().optional(),
        applies_to_attachments: z.boolean().optional(),
        applies_to_reactions: z.boolean().optional(),
        applies_to_metadata: z.boolean().optional(),
        is_default: z.boolean().optional(),
    })
    .superRefine((v, ctx) => {
        if (v.action !== MessagingRetentionAction.UNLIMITED && !v.retention_days) ctx.addIssue({ code: 'custom', path: ['retention_days'], message: 'Set the number of days' });
        if (v.scope === MessagingRetentionScope.BRANCH && !v.branch_id) ctx.addIssue({ code: 'custom', path: ['branch_id'], message: 'Pick a branch' });
        if (v.scope === MessagingRetentionScope.TEAM && !v.team_id) ctx.addIssue({ code: 'custom', path: ['team_id'], message: 'Pick a team' });
        if (v.scope === MessagingRetentionScope.CHANNEL_KIND && !v.channel_kind) ctx.addIssue({ code: 'custom', path: ['channel_kind'], message: 'Pick a channel kind' });
    });
export type RetentionPolicyInput = z.infer<typeof RetentionPolicySchema>;

export const LegalHoldSchema = z.object({
    name: z.string().trim().min(1).max(120),
    reason: z.string().trim().min(1).max(2000),
    channel_ids: z.array(z.string().uuid()).max(500).default([]),
    membership_ids: z.array(z.string().uuid()).max(500).default([]),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).refine((v) => v.channel_ids.length || v.membership_ids.length, { message: 'Hold at least one channel or person', path: ['channel_ids'] });
export type LegalHoldInput = z.infer<typeof LegalHoldSchema>;

export const ExportSchema = z.object({
    format: z.nativeEnum(MessagingExportFormat).default(MessagingExportFormat.JSON),
    channel_ids: z.array(z.string().uuid()).max(200).default([]),
    channel_kinds: z.array(z.nativeEnum(ChannelKind)).max(10).default([]),
    membership_id: z.string().uuid().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    include_threads: z.boolean().default(true),
    include_reactions: z.boolean().default(false),
    include_attachments_metadata: z.boolean().default(true),
});
export type ExportInput = z.infer<typeof ExportSchema>;

const MAX_EXPORT_MESSAGES = 50_000;
const RETENTION_BATCH = 5_000;
const SPECIFICITY: Record<MessagingRetentionScope, number> = { CHANNEL: 5, CHANNEL_KIND: 4, TEAM: 3, BRANCH: 2, ORGANIZATION: 1 };

type ChannelRef = Pick<Channel, 'id' | 'kind' | 'team_id' | 'branch_id' | 'retention_policy_id'>;

/** Most specific policy wins: CHANNEL > CHANNEL_KIND > TEAM > BRANCH > ORGANIZATION (12 §54). */
export function effectivePolicy(channel: ChannelRef, policies: MessagingRetentionPolicy[]): MessagingRetentionPolicy | null {
    const matches = policies.filter((p) => {
        switch (p.scope) {
            case MessagingRetentionScope.CHANNEL: return channel.retention_policy_id === p.id;
            case MessagingRetentionScope.CHANNEL_KIND: return p.channel_kind === channel.kind;
            case MessagingRetentionScope.TEAM: return !!channel.team_id && p.team_id === channel.team_id;
            case MessagingRetentionScope.BRANCH: return !!channel.branch_id && p.branch_id === channel.branch_id;
            default: return true;
        }
    });
    return matches.sort((a, b) => SPECIFICITY[b.scope] - SPECIFICITY[a.scope] || Number(b.is_default) - Number(a.is_default))[0] ?? null;
}

const csvCell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Retention policies, legal holds and data exports of 12 Messaging (§54–55, §106).
 * - A nightly job applies DELETE policies (content erased, delete_reason "retention") and ARCHIVE policies (inactive channels
 *   archived). Messages under an active legal hold are never touched.
 * - Export jobs run in the background and store the file as a sensitive Document (17); downloads use a signed URL.
 */
@Injectable()
export class MessagingGovernanceService {
    private readonly logger = new Logger(MessagingGovernanceService.name);
    private exporting = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly documents: DocumentsService,
    ) { }

    // ------------------------------------------------------------------ retention policies

    async policies(ctx: OrgContext) {
        const rows = await this.prisma.messagingRetentionPolicy.findMany({
            where: { organization_id: ctx.organization_id },
            include: { branch: { select: { id: true, name: true } }, team: { select: { id: true, name: true } }, channels: { select: { id: true, name: true, kind: true } } },
            orderBy: [{ scope: 'asc' }, { name: 'asc' }],
        });
        return { data: rows };
    }

    private async assertRefs(ctx: OrgContext, dto: RetentionPolicyInput) {
        if (dto.branch_id && !(await this.prisma.branch.findFirst({ where: { id: dto.branch_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' });
        if (dto.team_id && !(await this.prisma.team.findFirst({ where: { id: dto.team_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
        if (dto.channel_ids?.length) {
            const n = await this.prisma.channel.count({ where: { id: { in: dto.channel_ids }, organization_id: ctx.organization_id } });
            if (n !== new Set(dto.channel_ids).size) throw new NotFoundException({ message: 'Channel not found', code: 'channel_not_found' });
        }
    }

    private policyData(dto: RetentionPolicyInput) {
        return {
            name: dto.name,
            scope: dto.scope,
            branch_id: dto.scope === MessagingRetentionScope.BRANCH ? dto.branch_id ?? null : null,
            team_id: dto.scope === MessagingRetentionScope.TEAM ? dto.team_id ?? null : null,
            channel_kind: dto.scope === MessagingRetentionScope.CHANNEL_KIND ? dto.channel_kind ?? null : null,
            action: dto.action,
            retention_days: dto.action === MessagingRetentionAction.UNLIMITED ? null : dto.retention_days ?? null,
            applies_to_attachments: dto.applies_to_attachments ?? true,
            applies_to_reactions: dto.applies_to_reactions ?? true,
            applies_to_metadata: dto.applies_to_metadata ?? false,
            is_default: dto.is_default ?? false,
        };
    }

    async createPolicy(ctx: OrgContext, dto: RetentionPolicyInput) {
        await this.assertRefs(ctx, dto);
        const policy = await this.prisma.$transaction(async (tx) => {
            const p = await tx.messagingRetentionPolicy.create({ data: { organization_id: ctx.organization_id, created_by_user_id: ctx.user_id, ...this.policyData(dto) } });
            if (dto.scope === MessagingRetentionScope.CHANNEL && dto.channel_ids?.length) await tx.channel.updateMany({ where: { id: { in: dto.channel_ids }, organization_id: ctx.organization_id }, data: { retention_policy_id: p.id } });
            return p;
        });
        await this.audit.record(ctx, 'messaging.retention_policy.created', { resource_type: 'messaging_retention_policy', resource_id: policy.id, metadata: { after: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.retention_policy.created', module: ModuleKey.MESSAGING, entity_kind: 'messaging_retention_policy', entity_id: policy.id, payload: { name: dto.name, action: dto.action, retention_days: dto.retention_days ?? null } });
        return policy;
    }

    async updatePolicy(ctx: OrgContext, id: string, dto: RetentionPolicyInput) {
        const before = await this.prisma.messagingRetentionPolicy.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Policy not found', code: 'policy_not_found' });
        await this.assertRefs(ctx, dto);
        const policy = await this.prisma.$transaction(async (tx) => {
            const p = await tx.messagingRetentionPolicy.update({ where: { id }, data: this.policyData(dto) });
            if (dto.channel_ids) {
                await tx.channel.updateMany({ where: { retention_policy_id: id, id: { notIn: dto.channel_ids } }, data: { retention_policy_id: null } });
                if (dto.scope === MessagingRetentionScope.CHANNEL && dto.channel_ids.length) await tx.channel.updateMany({ where: { id: { in: dto.channel_ids }, organization_id: ctx.organization_id }, data: { retention_policy_id: id } });
            }
            return p;
        });
        await this.audit.record(ctx, 'messaging.retention_policy.updated', { resource_type: 'messaging_retention_policy', resource_id: id, metadata: { before: { action: before.action, retention_days: before.retention_days, scope: before.scope }, after: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.retention_policy.updated', module: ModuleKey.MESSAGING, entity_kind: 'messaging_retention_policy', entity_id: id, payload: { name: dto.name } });
        return policy;
    }

    async deletePolicy(ctx: OrgContext, id: string) {
        const before = await this.prisma.messagingRetentionPolicy.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!before) throw new NotFoundException({ message: 'Policy not found', code: 'policy_not_found' });
        await this.prisma.messagingRetentionPolicy.delete({ where: { id } });
        await this.audit.record(ctx, 'messaging.retention_policy.deleted', { resource_type: 'messaging_retention_policy', resource_id: id, metadata: { before: { name: before.name, action: before.action, retention_days: before.retention_days }, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.retention_policy.deleted', module: ModuleKey.MESSAGING, entity_kind: 'messaging_retention_policy', entity_id: id, payload: { name: before.name } });
        return { success: true };
    }

    /** Where-clause excluding messages under an active legal hold. */
    private async heldWhere(organizationId: string): Promise<Prisma.MessageWhereInput[]> {
        const holds = await this.prisma.messagingLegalHold.findMany({ where: { organization_id: organizationId, released_at: null } });
        return holds.map((h) => {
            const who: Prisma.MessageWhereInput[] = [];
            if (h.channel_ids.length) who.push({ channel_id: { in: h.channel_ids } });
            if (h.membership_ids.length) who.push({ author_membership_id: { in: h.membership_ids } });
            const range: Prisma.DateTimeFilter = {};
            if (h.date_from) range.gte = h.date_from;
            if (h.date_to) range.lte = new Date(h.date_to.getTime() + 86_400_000 - 1);
            return { AND: [{ OR: who }, ...(h.date_from || h.date_to ? [{ created_at: range }] : [])] };
        });
    }

    /** What a run would do now (counts per policy), or do it. */
    async applyRetention(organizationId: string, opts: { dryRun: boolean; ctx?: OrgContext | null; policyId?: string }) {
        const policies = await this.prisma.messagingRetentionPolicy.findMany({ where: { organization_id: organizationId } });
        const channels = await this.prisma.channel.findMany({ where: { organization_id: organizationId, status: { not: 'DELETED' } }, select: { id: true, kind: true, team_id: true, branch_id: true, retention_policy_id: true, status: true, last_message_at: true } });
        const held = await this.heldWhere(organizationId);
        const result = new Map<string, { policy_id: string; name: string; action: MessagingRetentionAction; messages: number; attachments: number; channels_archived: number; held_skipped: number }>();
        const now = Date.now();
        for (const ch of channels) {
            const p = effectivePolicy(ch, policies);
            if (!p || p.action === MessagingRetentionAction.UNLIMITED || !p.retention_days) continue;
            if (opts.policyId && p.id !== opts.policyId) continue;
            const cutoff = new Date(now - p.retention_days * 86_400_000);
            const row = result.get(p.id) ?? { policy_id: p.id, name: p.name, action: p.action, messages: 0, attachments: 0, channels_archived: 0, held_skipped: 0 };
            result.set(p.id, row);
            if (p.action === MessagingRetentionAction.ARCHIVE) {
                if (ch.status === 'ACTIVE' && ch.kind !== ChannelKind.DIRECT && ch.kind !== ChannelKind.GROUP_DIRECT && ch.last_message_at && ch.last_message_at < cutoff) {
                    row.channels_archived += 1;
                    if (!opts.dryRun) await this.prisma.channel.update({ where: { id: ch.id }, data: { status: 'ARCHIVED', archived_at: new Date(), archive_reason: 'retention' } });
                }
                continue;
            }
            const base: Prisma.MessageWhereInput = { channel_id: ch.id, created_at: { lt: cutoff }, NOT: { delete_reason: 'retention' } };
            const where: Prisma.MessageWhereInput = held.length ? { ...base, AND: held.map((h) => ({ NOT: h })) } : base;
            const [count, total] = await Promise.all([this.prisma.message.count({ where }), held.length ? this.prisma.message.count({ where: base }) : Promise.resolve(0)]);
            row.held_skipped += held.length ? total - count : 0;
            if (!count) continue;
            if (opts.dryRun) {
                row.messages += count;
                row.attachments += p.applies_to_attachments ? await this.prisma.messageAttachment.count({ where: { message: where } }) : 0;
                continue;
            }
            const ids = (await this.prisma.message.findMany({ where, select: { id: true }, take: RETENTION_BATCH })).map((m) => m.id);
            const ops: Prisma.PrismaPromise<unknown>[] = [
                this.prisma.message.updateMany({
                    where: { id: { in: ids } },
                    data: { body: '', body_plain: '', body_rich: Prisma.DbNull, deleted_at: new Date(), delete_reason: 'retention', status: 'DELETED', pinned_at: null, ...(p.applies_to_metadata && { metadata: Prisma.DbNull }) },
                }),
                this.prisma.channelPin.deleteMany({ where: { message_id: { in: ids } } }),
                this.prisma.messageVersion.deleteMany({ where: { message_id: { in: ids } } }),
            ];
            if (p.applies_to_reactions) ops.push(this.prisma.messageReaction.deleteMany({ where: { message_id: { in: ids } } }));
            if (p.applies_to_attachments) {
                row.attachments += await this.prisma.messageAttachment.count({ where: { message_id: { in: ids } } });
                ops.push(this.prisma.messageAttachment.deleteMany({ where: { message_id: { in: ids } } }));
            }
            await this.prisma.$transaction(ops);
            row.messages += ids.length;
        }
        const summary = [...result.values()];
        if (!opts.dryRun) {
            const applied = [...result.keys()];
            if (applied.length) await this.prisma.messagingRetentionPolicy.updateMany({ where: { id: { in: applied } }, data: { last_applied_at: new Date() } });
            const touched = summary.some((s) => s.messages || s.channels_archived);
            if (touched || opts.ctx) {
                await this.audit.record(opts.ctx ?? this.systemCtx(organizationId), 'messaging.retention.applied', { resource_type: 'messaging_retention_policy', resource_id: opts.policyId ?? null, metadata: { summary, sensitive: true } });
            }
        }
        return { dry_run: opts.dryRun, held_by: held.length, policies: summary };
    }

    private systemCtx(organizationId: string) {
        return { organization_id: organizationId, user_id: null, membership_id: null, service_account_id: null, api_key_id: null, actor_type: 'SYSTEM', channel: 'automation' } as unknown as OrgContext;
    }

    /** Nightly: apply every organization's retention policies (legal holds respected). */
    @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'messaging-retention' })
    async retentionJob() {
        const orgs = await this.prisma.messagingRetentionPolicy.findMany({ where: { action: { not: MessagingRetentionAction.UNLIMITED } }, distinct: ['organization_id'], select: { organization_id: true } });
        for (const { organization_id } of orgs) {
            try {
                await this.applyRetention(organization_id, { dryRun: false });
            } catch (error) {
                this.logger.error(`retention for ${organization_id} failed: ${(error as Error).message}`);
            }
        }
    }

    async runPolicy(ctx: OrgContext, id: string, dryRun: boolean) {
        const p = await this.prisma.messagingRetentionPolicy.findFirst({ where: { id, organization_id: ctx.organization_id }, select: { id: true } });
        if (!p) throw new NotFoundException({ message: 'Policy not found', code: 'policy_not_found' });
        return this.applyRetention(ctx.organization_id, { dryRun, ctx: dryRun ? null : ctx, policyId: id });
    }

    // ------------------------------------------------------------------ legal holds

    async holds(ctx: OrgContext, includeReleased = false) {
        const rows = await this.prisma.messagingLegalHold.findMany({ where: { organization_id: ctx.organization_id, ...(includeReleased ? {} : { released_at: null }) }, orderBy: { created_at: 'desc' } });
        const channelIds = [...new Set(rows.flatMap((r) => r.channel_ids))];
        const memberIds = [...new Set(rows.flatMap((r) => r.membership_ids))];
        const [channels, members] = await Promise.all([
            this.prisma.channel.findMany({ where: { id: { in: channelIds } }, select: { id: true, name: true, kind: true } }),
            this.prisma.membership.findMany({ where: { id: { in: memberIds } }, select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } }),
        ]);
        return {
            data: rows.map((r) => ({
                ...r,
                channels: channels.filter((c) => r.channel_ids.includes(c.id)),
                members: members.filter((m) => r.membership_ids.includes(m.id)).map((m) => ({ id: m.id, name: personName(m.user) })),
            })),
        };
    }

    async createHold(ctx: OrgContext, dto: LegalHoldInput) {
        if (dto.channel_ids.length && (await this.prisma.channel.count({ where: { id: { in: dto.channel_ids }, organization_id: ctx.organization_id } })) !== new Set(dto.channel_ids).size) throw new NotFoundException({ message: 'Channel not found', code: 'channel_not_found' });
        if (dto.membership_ids.length && (await this.prisma.membership.count({ where: { id: { in: dto.membership_ids }, organization_id: ctx.organization_id } })) !== new Set(dto.membership_ids).size) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        const hold = await this.prisma.messagingLegalHold.create({
            data: {
                organization_id: ctx.organization_id, name: dto.name, reason: dto.reason, channel_ids: dto.channel_ids, membership_ids: dto.membership_ids,
                date_from: dto.date_from ? new Date(`${dto.date_from}T00:00:00Z`) : null, date_to: dto.date_to ? new Date(`${dto.date_to}T00:00:00Z`) : null, created_by_user_id: ctx.user_id,
            },
        });
        await this.audit.record(ctx, 'messaging.legal_hold.created', { resource_type: 'messaging_legal_hold', resource_id: hold.id, metadata: { name: dto.name, channels: dto.channel_ids.length, members: dto.membership_ids.length, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.legal_hold.created', module: ModuleKey.MESSAGING, entity_kind: 'messaging_legal_hold', entity_id: hold.id, payload: { name: dto.name } });
        return hold;
    }

    async releaseHold(ctx: OrgContext, id: string) {
        const hold = await this.prisma.messagingLegalHold.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!hold) throw new NotFoundException({ message: 'Legal hold not found', code: 'legal_hold_not_found' });
        if (hold.released_at) throw new ConflictException({ message: 'This hold was already released', code: 'legal_hold_released' });
        const row = await this.prisma.messagingLegalHold.update({ where: { id }, data: { released_at: new Date(), released_by_user_id: ctx.user_id } });
        await this.audit.record(ctx, 'messaging.legal_hold.released', { resource_type: 'messaging_legal_hold', resource_id: id, metadata: { name: hold.name, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.legal_hold.released', module: ModuleKey.MESSAGING, entity_kind: 'messaging_legal_hold', entity_id: id, payload: { name: hold.name } });
        return row;
    }

    // ------------------------------------------------------------------ exports

    async exports(ctx: OrgContext) {
        const rows = await this.prisma.messagingExportJob.findMany({
            where: { organization_id: ctx.organization_id },
            include: { requested_by: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } } },
            orderBy: { created_at: 'desc' },
            take: 50,
        });
        const now = new Date();
        return { data: rows.map((r) => ({ ...r, status: r.status === MessagingExportStatus.COMPLETED && r.expires_at && r.expires_at < now ? MessagingExportStatus.EXPIRED : r.status })) };
    }

    async requestExport(ctx: OrgContext, dto: ExportInput) {
        if (!ctx.membership_id) throw new BadRequestException({ message: 'Exports are requested by a member', code: 'export_member_required' });
        if (dto.channel_ids.length && (await this.prisma.channel.count({ where: { id: { in: dto.channel_ids }, organization_id: ctx.organization_id } })) !== new Set(dto.channel_ids).size) throw new NotFoundException({ message: 'Channel not found', code: 'channel_not_found' });
        const job = await this.prisma.messagingExportJob.create({ data: { organization_id: ctx.organization_id, requested_by_membership_id: ctx.membership_id, format: dto.format, filters: dto as unknown as Prisma.InputJsonValue } });
        await this.audit.record(ctx, 'messaging.export.requested', { resource_type: 'messaging_export_job', resource_id: job.id, metadata: { filters: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'messaging.export.requested', module: ModuleKey.MESSAGING, entity_kind: 'messaging_export_job', entity_id: job.id, payload: { format: dto.format } });
        setImmediate(() => void this.processExports());
        return job;
    }

    async exportDownload(ctx: OrgContext, id: string) {
        const job = await this.prisma.messagingExportJob.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!job) throw new NotFoundException({ message: 'Export not found', code: 'export_not_found' });
        if (job.status !== MessagingExportStatus.COMPLETED || !job.result_document_id) throw new ConflictException({ message: 'The export is not ready', code: 'export_not_ready' });
        if (job.expires_at && job.expires_at < new Date()) throw new ConflictException({ message: 'The export expired; request a new one', code: 'export_expired' });
        const url = await this.documents.issueRecordDownloadUrl(ctx.organization_id, job.result_document_id, 'attachment');
        await this.audit.record(ctx, 'messaging.export.downloaded', { resource_type: 'messaging_export_job', resource_id: id, metadata: { sensitive: true } });
        return url;
    }

    @Interval(30_000)
    async processExports() {
        if (this.exporting) return;
        this.exporting = true;
        try {
            for (let i = 0; i < 3; i++) {
                const job = await this.prisma.messagingExportJob.findFirst({ where: { status: MessagingExportStatus.PENDING }, orderBy: { created_at: 'asc' } });
                if (!job) break;
                const claimed = await this.prisma.messagingExportJob.updateMany({ where: { id: job.id, status: MessagingExportStatus.PENDING }, data: { status: MessagingExportStatus.RUNNING, started_at: new Date() } });
                if (!claimed.count) continue;
                await this.runExport(job.id).catch(async (error) => {
                    this.logger.error(`export ${job.id} failed: ${(error as Error).message}`);
                    await this.prisma.messagingExportJob.update({ where: { id: job.id }, data: { status: MessagingExportStatus.FAILED, error: (error as Error).message.slice(0, 1000), completed_at: new Date() } });
                });
            }
        } finally {
            this.exporting = false;
        }
    }

    private async runExport(jobId: string) {
        const job = await this.prisma.messagingExportJob.findUniqueOrThrow({ where: { id: jobId } });
        const f = ExportSchema.parse(job.filters ?? {});
        // The export runs as the requester; it is cancelled if they lost messaging.data.export meanwhile.
        const ctx = job.requested_by_membership_id ? await this.authorization.contextFor({ organization_id: job.organization_id, membership_id: job.requested_by_membership_id, channel: 'automation' }).catch(() => null) : null;
        if (!ctx || !ctx.can('messaging.data.export')) throw new Error('The requester no longer has permission to export messaging data');
        const where: Prisma.MessageWhereInput = {
            organization_id: job.organization_id,
            ...(f.channel_ids.length || f.channel_kinds.length ? { channel: { ...(f.channel_ids.length && { id: { in: f.channel_ids } }), ...(f.channel_kinds.length && { kind: { in: f.channel_kinds } }) } } : {}),
            ...(f.membership_id && { author_membership_id: f.membership_id }),
            ...(!f.include_threads && { parent_message_id: null }),
            ...((f.date_from || f.date_to) && { created_at: { ...(f.date_from && { gte: new Date(`${f.date_from}T00:00:00Z`) }), ...(f.date_to && { lte: new Date(`${f.date_to}T23:59:59.999Z`) }) } }),
        };
        const rows = await this.prisma.message.findMany({
            where,
            orderBy: [{ channel_id: 'asc' }, { created_at: 'asc' }],
            take: MAX_EXPORT_MESSAGES,
            select: {
                id: true, channel_id: true, kind: true, body_plain: true, body: true, parent_message_id: true, created_at: true, edited_at: true, deleted_at: true, delete_reason: true,
                channel: { select: { name: true, kind: true } },
                author: { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } },
                ...(f.include_reactions && { reactions: { select: { emoji: true, membership_id: true } } }),
                ...(f.include_attachments_metadata && { attachments: { select: { file_name: true, mime_type: true, size_bytes: true, document_id: true } } }),
            },
        });
        const flat = rows.map((r) => ({
            id: r.id,
            channel: r.channel.name ?? r.channel.kind,
            channel_id: r.channel_id,
            author: r.author ? personName(r.author.user) : r.kind,
            author_email: r.author?.user.email ?? null,
            created_at: r.created_at.toISOString(),
            thread_root_id: r.parent_message_id,
            text: r.deleted_at ? `[removed: ${r.delete_reason ?? 'deleted'}]` : r.body_plain ?? r.body,
            edited_at: r.edited_at?.toISOString() ?? null,
            ...('reactions' in r ? { reactions: (r.reactions as { emoji: string }[]).map((x) => x.emoji).join(' ') } : {}),
            ...('attachments' in r ? { attachments: (r.attachments as { file_name: string }[]).map((a) => a.file_name).join('; ') } : {}),
        }));
        let content: string;
        let mimetype: string;
        let ext: string;
        if (job.format === MessagingExportFormat.CSV) {
            const cols = Object.keys(flat[0] ?? { id: '', channel: '', author: '', created_at: '', text: '' });
            content = [cols.join(','), ...flat.map((r) => cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(','))].join('\n');
            mimetype = 'text/csv';
            ext = 'csv';
        } else if (job.format === MessagingExportFormat.HTML) {
            content = `<!doctype html><html><head><meta charset="utf-8"><title>Messaging export</title></head><body><h1>Messaging export</h1><p>${flat.length} messages · ${new Date().toISOString()}</p>${flat
                .map((r) => `<article><p><strong>${esc(r.author)}</strong> in #${esc(String(r.channel))} · ${r.created_at}</p><p>${esc(String(r.text ?? ''))}</p></article>`)
                .join('')}</body></html>`;
            mimetype = 'text/html';
            ext = 'html';
        } else {
            content = JSON.stringify({ exported_at: new Date().toISOString(), filters: f, truncated: rows.length >= MAX_EXPORT_MESSAGES, messages: flat }, null, 2);
            mimetype = 'application/json';
            ext = 'json';
        }
        const stamp = new Date().toISOString().slice(0, 10);
        const doc = await this.documents.upload(
            ctx,
            { buffer: Buffer.from(content, 'utf8'), originalname: `messaging-export-${stamp}.${ext}`, mimetype },
            { title: `Messaging export ${stamp}`, is_sensitive: true, description: 'Generated by Messages → Retention & export' },
            { source: DocumentSource.GENERATED, source_module: ModuleKey.MESSAGING, authorized_by_module: true },
        );
        await this.prisma.messagingExportJob.update({
            where: { id: jobId },
            data: { status: MessagingExportStatus.COMPLETED, completed_at: new Date(), result_document_id: doc.id, expires_at: new Date(Date.now() + 7 * 86_400_000), message_count: flat.length, channel_count: new Set(flat.map((r) => r.channel_id)).size },
        });
        await this.audit.record(ctx, 'messaging.export.completed', { resource_type: 'messaging_export_job', resource_id: jobId, metadata: { messages: flat.length, document_id: doc.id, sensitive: true } });
        this.events.publish(ctx, {
            event_key: 'messaging.export.completed', module: ModuleKey.MESSAGING, entity_kind: 'messaging_export_job', entity_id: jobId,
            payload: { messages: flat.length, recipient_membership_ids: job.requested_by_membership_id ? [job.requested_by_membership_id] : [], notification_title: 'Your messaging export is ready', link: '/messages/admin/retention?tab=exports' },
        });
    }
}
