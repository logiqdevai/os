import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
    CampaignApprovalDecision, CampaignAudienceMode, CampaignStatus, CommChannel, CommMessageKind, CommMessageSource, CommMessageStatus,
    CommRecipientStatus, CommSenderIdentityStatus, ModuleKey, Prisma, RecordEntityType,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { branchScopeWhere, extractVariables, htmlToText, normalizeAddress, notFound, renderTemplate, SAMPLE_CONTEXT, smsSegments } from '../common/comm.utils';
import { AudienceService } from '../audience/audience.service';
import { CommProviderService } from '../delivery/comm-provider.service';
import { CommDispatchService } from '../delivery/comm-dispatch.service';
import { CampaignRunnerService } from './campaign-runner.service';
import {
    CampaignAudienceInputDto, CampaignQuery, CampaignRecipientQuery, CreateCampaignDto, ScheduleCampaignDto, SubmitCampaignDto, UpdateCampaignDto,
} from './dto/campaign.dto';

const READ = 'communications.campaigns.read';
const EDITABLE: CampaignStatus[] = [CampaignStatus.DRAFT, CampaignStatus.PENDING_APPROVAL, CampaignStatus.APPROVED];
const LIVE: CampaignStatus[] = [CampaignStatus.SCHEDULED, CampaignStatus.SENDING, CampaignStatus.PAUSED];

export interface PreflightIssue {
    kind: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
}

const PERSON = { select: { id: true, user: { select: { display_name: true, first_name: true, last_name: true, email: true, profile_photo_url: true } } } } as const;

/**
 * Campaigns (11 "Marketing Campaigns", "Scheduling", "Internal Collaboration"): draft → (approval) → schedule / send now →
 * background runner (CampaignRunnerService) resolves the audience, creates one CommMessage per recipient and sends in batches.
 */
@Injectable()
export class CampaignsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly audience: AudienceService,
        private readonly providers: CommProviderService,
        private readonly dispatch: CommDispatchService,
        private readonly runner: CampaignRunnerService,
    ) { }

    private scope(ctx: OrgContext): Prisma.CampaignWhereInput {
        return branchScopeWhere(ctx, READ, ['owner_membership_id', 'created_by_membership_id']) as Prisma.CampaignWhereInput;
    }

    async findAll(ctx: OrgContext, query: CampaignQuery) {
        const where: Prisma.CampaignWhereInput = {
            organization_id: ctx.organization_id,
            is_template: false,
            ...this.scope(ctx),
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            ...(query.status?.length && { status: { in: query.status } }),
            ...(query.channel && { channel: query.channel }),
            ...(query.owner_membership_id && { owner_membership_id: query.owner_membership_id }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { subject: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.campaign.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['name', 'created_at', 'updated_at', 'scheduled_at', 'started_at', 'sent_count'], 'updated_at'),
                include: { owner: PERSON, template: { select: { id: true, name: true } } },
            }),
            this.prisma.campaign.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const campaign = await this.prisma.campaign.findFirst({
            where: { id, organization_id: ctx.organization_id, ...this.scope(ctx) },
            include: {
                owner: PERSON,
                created_by: PERSON,
                approved_by: PERSON,
                branch: { select: { id: true, name: true } },
                template: { select: { id: true, name: true, current_version_id: true } },
                template_version: { select: { id: true, version: true } },
                sender_identity: { select: { id: true, address: true, display_name: true, status: true, reply_to_address: true } },
                audiences: {
                    orderBy: { sort_order: 'asc' },
                    include: { list: { select: { id: true, name: true, member_count: true } }, segment: { select: { id: true, name: true, last_count: true, entity_type: true } } },
                },
                approvals: { orderBy: { requested_at: 'desc' }, include: { approver: PERSON } },
                runs: { orderBy: { run_number: 'desc' }, take: 10 },
            },
        });
        if (!campaign) throw notFound('Campaign', 'campaign_not_found');
        const settings = await this.prisma.commSettings.findUnique({ where: { organization_id: ctx.organization_id } });
        return { ...campaign, approval_required: this.approvalNeeded(settings, campaign.audience_count) };
    }

    private approvalNeeded(settings: { approval_required: boolean; approval_min_recipients: number | null } | null, audienceCount: number) {
        if (!settings?.approval_required) return false;
        return settings.approval_min_recipients === null || audienceCount >= settings.approval_min_recipients;
    }

    private assertEditable(campaign: { status: CampaignStatus }) {
        if (!EDITABLE.includes(campaign.status)) throw new ConflictException({ message: `A ${campaign.status.toLowerCase().replace('_', ' ')} campaign cannot be edited`, code: 'campaign_not_editable' });
    }

    /** Copy the published template version into the campaign (snapshot: later template edits do not change a reviewed campaign). */
    private async templateContent(ctx: OrgContext, templateId: string, channel: CommChannel) {
        const template = await this.prisma.commTemplate.findFirst({ where: { id: templateId, organization_id: ctx.organization_id, archived_at: null }, include: { current_version: true } });
        if (!template) throw notFound('Template', 'template_not_found');
        if (template.channel !== channel) throw new BadRequestException({ message: `This is an ${template.channel} template; the campaign sends ${channel}`, code: 'template_channel_mismatch' });
        const v = template.current_version;
        if (!v) throw new BadRequestException({ message: 'Publish the template before using it in a campaign', code: 'template_not_published' });
        return { template_version_id: v.id, subject: v.subject, preheader: v.preheader, body_html: v.body_html, body_text: v.body_text, sender_identity_id: template.default_sender_identity_id };
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateCampaignDto, channel: CommChannel) {
        if (dto.branch_id && !(await this.prisma.branch.findFirst({ where: { id: dto.branch_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw notFound('Branch', 'branch_not_found');
        if (dto.topic_id && !(await this.prisma.commTopic.findFirst({ where: { id: dto.topic_id, organization_id: ctx.organization_id }, select: { id: true } }))) throw notFound('Topic', 'topic_not_found');
        if (dto.sender_identity_id) {
            const s = await this.prisma.commSenderIdentity.findFirst({ where: { id: dto.sender_identity_id, organization_id: ctx.organization_id }, select: { channel: true } });
            if (!s) throw notFound('Sender identity', 'sender_identity_not_found');
            if (s.channel !== channel) throw new BadRequestException({ message: 'The sender identity is for another channel', code: 'sender_channel_mismatch' });
        }
    }

    private async writeAudiences(ctx: OrgContext, tx: Prisma.TransactionClient, campaignId: string, audiences: CampaignAudienceInputDto[]) {
        const listIds = audiences.map((a) => a.list_id).filter((x): x is string => !!x);
        const segmentIds = audiences.map((a) => a.segment_id).filter((x): x is string => !!x);
        const [lists, segments] = await Promise.all([
            tx.commRecipientList.count({ where: { id: { in: listIds }, organization_id: ctx.organization_id } }),
            tx.segment.count({ where: { id: { in: segmentIds }, organization_id: ctx.organization_id } }),
        ]);
        if (lists !== new Set(listIds).size || segments !== new Set(segmentIds).size) throw notFound('List or segment', 'audience_source_not_found');
        for (const a of audiences) if (!!a.list_id === !!a.segment_id) throw new BadRequestException({ message: 'Each audience entry needs exactly one of list_id or segment_id', code: 'audience_invalid' });
        await tx.campaignAudience.deleteMany({ where: { campaign_id: campaignId } });
        const seen = new Set<string>();
        await tx.campaignAudience.createMany({
            data: audiences
                .filter((a) => {
                    const k = a.list_id ?? a.segment_id!;
                    if (seen.has(k)) return false;
                    seen.add(k);
                    return true;
                })
                .map((a, i) => ({ campaign_id: campaignId, mode: a.mode ?? CampaignAudienceMode.INCLUDE, list_id: a.list_id ?? null, segment_id: a.segment_id ?? null, sort_order: i })),
        });
    }

    async create(ctx: OrgContext, dto: CreateCampaignDto) {
        await this.assertRefs(ctx, dto, dto.channel);
        const fromTemplate = dto.template_id && !dto.body_html && !dto.body_text ? await this.templateContent(ctx, dto.template_id, dto.channel) : null;
        const { audiences, utm, ...rest } = dto;
        const campaign = await this.prisma.$transaction(async (tx) => {
            const c = await tx.campaign.create({
                data: {
                    ...rest,
                    utm: (utm ?? undefined) as Prisma.InputJsonValue,
                    ...(fromTemplate && { ...fromTemplate, sender_identity_id: dto.sender_identity_id ?? fromTemplate.sender_identity_id }),
                    body_text: dto.body_text ?? fromTemplate?.body_text ?? (dto.body_html ? htmlToText(dto.body_html) : null),
                    organization_id: ctx.organization_id,
                    owner_membership_id: ctx.membership_id,
                    created_by_membership_id: ctx.membership_id,
                },
            });
            if (audiences?.length) await this.writeAudiences(ctx, tx, c.id, audiences);
            return c;
        });
        await this.audit.record(ctx, 'communications.campaign.created', { resource_type: 'campaign', resource_id: campaign.id, branch_id: campaign.branch_id, metadata: { after: { name: dto.name, channel: dto.channel, template_id: dto.template_id } } });
        this.events.publish(ctx, {
            event_key: 'communications.campaign.created', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: campaign.id,
            payload: { name: campaign.name, channel: campaign.channel }, activity: { summary: `Campaign "${campaign.name}" created`, entity_label: campaign.name, branch_id: campaign.branch_id },
        });
        return this.findOne(ctx, campaign.id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateCampaignDto) {
        const before = await this.findOne(ctx, id);
        this.assertEditable(before);
        if (dto.channel && dto.channel !== before.channel) throw new BadRequestException({ message: 'The channel of a campaign cannot change', code: 'campaign_channel_locked' });
        await this.assertRefs(ctx, dto, before.channel);
        const templateChanged = dto.template_id && dto.template_id !== before.template_id && !dto.body_html && !dto.body_text;
        const fromTemplate = templateChanged ? await this.templateContent(ctx, dto.template_id!, before.channel) : null;
        const { audiences, utm, channel: _c, ...rest } = dto;
        const contentChanged = ['subject', 'preheader', 'body_html', 'body_text', 'template_id', 'sender_identity_id'].some((k) => k in dto) || !!audiences;
        await this.prisma.$transaction(async (tx) => {
            await tx.campaign.update({
                where: { id },
                data: {
                    ...rest,
                    ...(utm !== undefined && { utm: utm as Prisma.InputJsonValue }),
                    ...(fromTemplate && { ...fromTemplate, sender_identity_id: dto.sender_identity_id ?? fromTemplate.sender_identity_id ?? before.sender_identity_id }),
                    ...(dto.body_html !== undefined && dto.body_text === undefined && { body_text: htmlToText(dto.body_html) }),
                    // Changing a reviewed campaign sends it back to draft (a new approval is needed).
                    ...(contentChanged && before.status !== CampaignStatus.DRAFT && { status: CampaignStatus.DRAFT, approved_at: null, approved_by_membership_id: null, submitted_for_approval_at: null }),
                },
            });
            if (contentChanged && before.status !== CampaignStatus.DRAFT) await tx.campaignApproval.deleteMany({ where: { campaign_id: id, decision: CampaignApprovalDecision.PENDING } });
            if (audiences) await this.writeAudiences(ctx, tx, id, audiences);
        });
        await this.audit.record(ctx, 'communications.campaign.updated', {
            resource_type: 'campaign', resource_id: id, branch_id: before.branch_id,
            metadata: { before: { name: before.name, subject: before.subject, status: before.status }, after: { ...rest, audiences: audiences?.length } },
        });
        this.events.publish(ctx, { event_key: 'communications.campaign.updated', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: id, payload: { name: dto.name ?? before.name }, changes: rest as Record<string, unknown> });
        return this.findOne(ctx, id);
    }

    async setAudience(ctx: OrgContext, id: string, audiences: CampaignAudienceInputDto[]) {
        return this.update(ctx, id, { audiences });
    }

    /** Dry run of the audience: counts, exclusions by reason, a sample of recipients. */
    async resolveAudience(ctx: OrgContext, id: string) {
        const campaign = await this.findOne(ctx, id);
        const resolved = await this.audience.resolveCampaign(ctx.organization_id, campaign);
        if (EDITABLE.includes(campaign.status)) {
            await this.prisma.campaign.update({ where: { id }, data: { audience_count: resolved.counts.included, excluded_count: resolved.counts.excluded } });
        }
        return {
            counts: resolved.counts,
            sample: resolved.included.slice(0, 20).map(({ context: _c, ...r }) => r),
            excluded_sample: resolved.excluded.slice(0, 50),
        };
    }

    async preflight(ctx: OrgContext, id: string) {
        const campaign = await this.findOne(ctx, id);
        const issues: PreflightIssue[] = [];
        if (!campaign.audiences.some((a) => a.mode === CampaignAudienceMode.INCLUDE)) issues.push({ kind: 'audience', severity: 'error', message: 'Choose at least one list or segment to send to.' });
        const resolved = campaign.audiences.length ? await this.audience.resolveCampaign(ctx.organization_id, campaign) : null;
        if (resolved && resolved.counts.included === 0 && campaign.audiences.length) issues.push({ kind: 'audience_empty', severity: 'error', message: 'No recipient is left after suppression and consent checks.' });
        if (resolved?.counts.by_reason.no_consent) issues.push({ kind: 'consent', severity: 'info', message: `${resolved.counts.by_reason.no_consent} contact(s) without opt-in will be skipped.` });
        if (resolved?.counts.by_reason.suppressed) issues.push({ kind: 'suppressed', severity: 'info', message: `${resolved.counts.by_reason.suppressed} suppressed address(es) will be skipped.` });
        if (campaign.channel === CommChannel.EMAIL) {
            if (!campaign.subject) issues.push({ kind: 'subject', severity: 'error', message: 'Add a subject line.' });
            if (!campaign.body_html && !campaign.body_text) issues.push({ kind: 'content', severity: 'error', message: 'Add the email content.' });
            if (campaign.body_html && !/\{\{\s*unsubscribe_url/.test(campaign.body_html)) issues.push({ kind: 'unsubscribe', severity: 'info', message: 'An unsubscribe footer will be added automatically.' });
            const insecure = [...(campaign.body_html ?? '').matchAll(/href="(http:\/\/[^"]+)"/gi)].length;
            if (insecure) issues.push({ kind: 'links', severity: 'warning', message: `${insecure} link(s) use http instead of https.` });
            if (campaign.subject && campaign.subject.length > 90) issues.push({ kind: 'subject_length', severity: 'warning', message: 'Long subject lines are cut off on phones (keep it under 60 characters).' });
        } else {
            if (!campaign.body_text) issues.push({ kind: 'content', severity: 'error', message: 'Add the SMS text.' });
            const segments = smsSegments(campaign.body_text ?? '');
            if (segments > 3) issues.push({ kind: 'sms_length', severity: 'warning', message: `The message is ${segments} SMS segments long; each segment is billed.` });
        }
        const variables = extractVariables(campaign.subject, campaign.body_html, campaign.body_text);
        const unknown = variables.filter((v) => !(v in SAMPLE_CONTEXT));
        if (unknown.length) issues.push({ kind: 'variables', severity: 'warning', message: `Unknown variables will render empty: ${unknown.map((v) => `{{${v}}}`).join(', ')}` });
        const provider = await this.providers.status(ctx.organization_id);
        const channelStatus = campaign.channel === CommChannel.EMAIL ? provider.email : provider.sms;
        if (!channelStatus.connected) issues.push({ kind: 'provider', severity: 'error', message: this.providers.noProviderReason(campaign.channel) });
        if (campaign.sender_identity) {
            if (campaign.sender_identity.status !== CommSenderIdentityStatus.VERIFIED) issues.push({ kind: 'sender', severity: 'error', message: `The sender ${campaign.sender_identity.address} is not verified.` });
        } else if (campaign.channel === CommChannel.EMAIL && !('default_from' in channelStatus && channelStatus.default_from)) {
            issues.push({ kind: 'sender', severity: 'error', message: 'Choose a verified sender identity.' });
        }
        const settings = await this.prisma.commSettings.findUnique({ where: { organization_id: ctx.organization_id } });
        const approvalRequired = this.approvalNeeded(settings, resolved?.counts.included ?? campaign.audience_count);
        if (approvalRequired && campaign.status !== CampaignStatus.APPROVED) issues.push({ kind: 'approval', severity: 'warning', message: 'This campaign needs approval before it can be sent.' });
        const now = new Date();
        await this.prisma.campaign.update({
            where: { id },
            data: {
                preflight: { checked_at: now.toISOString(), issues } as unknown as Prisma.InputJsonValue,
                preflight_checked_at: now,
                ...(resolved && EDITABLE.includes(campaign.status) && { audience_count: resolved.counts.included, excluded_count: resolved.counts.excluded }),
            },
        });
        return { checked_at: now, issues, approval_required: approvalRequired, counts: resolved?.counts ?? null, ok: !issues.some((i) => i.severity === 'error') };
    }

    async submit(ctx: OrgContext, id: string, dto: SubmitCampaignDto) {
        const campaign = await this.findOne(ctx, id);
        if (campaign.status !== CampaignStatus.DRAFT) throw new ConflictException({ message: 'Only draft campaigns can be submitted for approval', code: 'campaign_not_draft' });
        const approvers = dto.approver_membership_ids?.length
            ? await this.prisma.membership.findMany({ where: { id: { in: dto.approver_membership_ids }, organization_id: ctx.organization_id, status: 'ACTIVE' }, select: { id: true } })
            : [];
        await this.prisma.$transaction(async (tx) => {
            await tx.campaign.update({ where: { id }, data: { status: CampaignStatus.PENDING_APPROVAL, submitted_for_approval_at: new Date() } });
            if (approvers.length) await tx.campaignApproval.createMany({ data: approvers.map((a) => ({ campaign_id: id, approver_membership_id: a.id, comment: dto.comment ?? null })) });
        });
        await this.audit.record(ctx, 'communications.campaign.submitted', { resource_type: 'campaign', resource_id: id, branch_id: campaign.branch_id, metadata: { approvers: approvers.map((a) => a.id), comment: dto.comment } });
        this.events.publish(ctx, {
            event_key: 'communications.campaign.approval_requested', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: id,
            payload: { name: campaign.name, approver_membership_ids: approvers.map((a) => a.id) }, activity: { summary: `Campaign "${campaign.name}" submitted for approval`, entity_label: campaign.name },
        });
        return this.findOne(ctx, id);
    }

    async decide(ctx: OrgContext, id: string, approve: boolean, comment?: string) {
        const campaign = await this.findOne(ctx, id);
        if (campaign.status !== CampaignStatus.PENDING_APPROVAL) throw new ConflictException({ message: 'The campaign is not waiting for approval', code: 'campaign_not_pending' });
        if (!ctx.membership_id) throw new BadRequestException({ message: 'Approvals are decided by a member', code: 'approval_member_required' });
        const decision = approve ? CampaignApprovalDecision.APPROVED : CampaignApprovalDecision.REJECTED;
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            const mine = await tx.campaignApproval.findFirst({ where: { campaign_id: id, approver_membership_id: ctx.membership_id!, decision: CampaignApprovalDecision.PENDING } });
            if (mine) await tx.campaignApproval.update({ where: { id: mine.id }, data: { decision, comment: comment ?? mine.comment, decided_at: now } });
            else await tx.campaignApproval.create({ data: { campaign_id: id, approver_membership_id: ctx.membership_id!, decision, comment: comment ?? null, decided_at: now } });
            await tx.campaign.update({
                where: { id },
                data: approve
                    ? { status: CampaignStatus.APPROVED, approved_at: now, approved_by_membership_id: ctx.membership_id }
                    : { status: CampaignStatus.DRAFT, submitted_for_approval_at: null },
            });
        });
        await this.audit.record(ctx, approve ? 'communications.campaign.approved' : 'communications.campaign.rejected', { resource_type: 'campaign', resource_id: id, branch_id: campaign.branch_id, metadata: { comment, sensitive: true } });
        this.events.publish(ctx, {
            event_key: approve ? 'communications.campaign.approved' : 'communications.campaign.rejected', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: id,
            payload: { name: campaign.name, owner_membership_id: campaign.owner_membership_id, comment }, activity: { summary: `Campaign "${campaign.name}" ${approve ? 'approved' : 'sent back to draft'}`, entity_label: campaign.name },
        });
        return this.findOne(ctx, id);
    }

    /** Schedule (or send now when scheduled_at is omitted). Sensitive: requires communications.campaigns.send. */
    async schedule(ctx: OrgContext, id: string, dto: ScheduleCampaignDto) {
        const campaign = await this.findOne(ctx, id);
        if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.APPROVED) {
            throw new ConflictException({ message: campaign.status === CampaignStatus.PENDING_APPROVAL ? 'The campaign is waiting for approval' : `A ${campaign.status.toLowerCase()} campaign cannot be scheduled`, code: 'campaign_not_schedulable' });
        }
        const check = await this.preflight(ctx, id);
        const errors = check.issues.filter((i) => i.severity === 'error');
        if (errors.length) throw new BadRequestException({ message: errors.map((e) => e.message).join(' '), code: 'campaign_preflight_failed', issues: errors });
        if (check.approval_required && campaign.status !== CampaignStatus.APPROVED) throw new ConflictException({ message: 'This campaign needs approval before it can be sent. Submit it for approval first.', code: 'campaign_approval_required' });
        const scheduledAt = dto.scheduled_at ? new Date(dto.scheduled_at) : new Date();
        if (scheduledAt.getTime() < Date.now() - 60_000) throw new BadRequestException({ message: 'The send time is in the past', code: 'schedule_in_past' });
        await this.prisma.campaign.update({ where: { id }, data: { status: CampaignStatus.SCHEDULED, scheduled_at: scheduledAt, schedule_timezone: dto.schedule_timezone ?? campaign.schedule_timezone, next_run_at: scheduledAt } });
        const now = !dto.scheduled_at;
        await this.audit.record(ctx, 'communications.campaign.scheduled', { resource_type: 'campaign', resource_id: id, branch_id: campaign.branch_id, metadata: { scheduled_at: scheduledAt.toISOString(), send_now: now, audience_count: check.counts?.included, sensitive: true } });
        this.events.publish(ctx, {
            event_key: 'communications.campaign.scheduled', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: id,
            payload: { name: campaign.name, scheduled_at: scheduledAt.toISOString(), audience_count: check.counts?.included },
            activity: { summary: now ? `Campaign "${campaign.name}" is being sent` : `Campaign "${campaign.name}" scheduled`, entity_label: campaign.name },
        });
        if (now) this.runner.kick();
        return this.findOne(ctx, id);
    }

    async unschedule(ctx: OrgContext, id: string) {
        const campaign = await this.findOne(ctx, id);
        if (campaign.status !== CampaignStatus.SCHEDULED) throw new ConflictException({ message: 'Only scheduled campaigns can be unscheduled', code: 'campaign_not_scheduled' });
        const res = await this.prisma.campaign.updateMany({ where: { id, status: CampaignStatus.SCHEDULED }, data: { status: campaign.approved_at ? CampaignStatus.APPROVED : CampaignStatus.DRAFT, scheduled_at: null, next_run_at: null } });
        if (!res.count) throw new ConflictException({ message: 'The campaign already started sending', code: 'campaign_started' });
        await this.audit.record(ctx, 'communications.campaign.unscheduled', { resource_type: 'campaign', resource_id: id, branch_id: campaign.branch_id });
        this.events.publish(ctx, { event_key: 'communications.campaign.unscheduled', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: id, payload: { name: campaign.name } });
        return this.findOne(ctx, id);
    }

    async pause(ctx: OrgContext, id: string) {
        const campaign = await this.findOne(ctx, id);
        const res = await this.prisma.campaign.updateMany({ where: { id, status: CampaignStatus.SENDING }, data: { status: CampaignStatus.PAUSED, paused_at: new Date() } });
        if (!res.count) throw new ConflictException({ message: 'Only sending campaigns can be paused', code: 'campaign_not_sending' });
        await this.audit.record(ctx, 'communications.campaign.paused', { resource_type: 'campaign', resource_id: id, branch_id: campaign.branch_id });
        this.events.publish(ctx, { event_key: 'communications.campaign.paused', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: id, payload: { name: campaign.name } });
        return this.findOne(ctx, id);
    }

    async resume(ctx: OrgContext, id: string) {
        const campaign = await this.findOne(ctx, id);
        const res = await this.prisma.campaign.updateMany({ where: { id, status: CampaignStatus.PAUSED }, data: { status: CampaignStatus.SENDING, paused_at: null } });
        if (!res.count) throw new ConflictException({ message: 'Only paused campaigns can be resumed', code: 'campaign_not_paused' });
        await this.audit.record(ctx, 'communications.campaign.resumed', { resource_type: 'campaign', resource_id: id, branch_id: campaign.branch_id, metadata: { sensitive: true } });
        this.events.publish(ctx, { event_key: 'communications.campaign.resumed', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: id, payload: { name: campaign.name } });
        this.runner.kick();
        return this.findOne(ctx, id);
    }

    async cancel(ctx: OrgContext, id: string) {
        const campaign = await this.findOne(ctx, id);
        if (!LIVE.includes(campaign.status)) throw new ConflictException({ message: 'Only scheduled, sending or paused campaigns can be cancelled', code: 'campaign_not_live' });
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.campaign.update({ where: { id }, data: { status: CampaignStatus.CANCELLED, cancelled_at: now, next_run_at: null } });
            await tx.commMessage.updateMany({ where: { campaign_id: id, status: { in: [CommMessageStatus.QUEUED, CommMessageStatus.SCHEDULED] } }, data: { status: CommMessageStatus.CANCELLED, cancelled_at: now } });
            await tx.campaignRecipient.updateMany({ where: { campaign_id: id, status: { in: [CommRecipientStatus.PENDING, CommRecipientStatus.QUEUED] } }, data: { status: CommRecipientStatus.EXCLUDED, exclusion_reason: 'cancelled' } });
            await tx.campaignRun.updateMany({ where: { campaign_id: id, status: { in: ['PENDING', 'RUNNING'] } }, data: { status: 'CANCELLED', completed_at: now } });
        });
        await this.audit.record(ctx, 'communications.campaign.cancelled', { resource_type: 'campaign', resource_id: id, branch_id: campaign.branch_id, metadata: { sent_count: campaign.sent_count } });
        this.events.publish(ctx, {
            event_key: 'communications.campaign.cancelled', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: id,
            payload: { name: campaign.name }, activity: { summary: `Campaign "${campaign.name}" cancelled`, entity_label: campaign.name },
        });
        return this.findOne(ctx, id);
    }

    async duplicate(ctx: OrgContext, id: string) {
        const s = await this.findOne(ctx, id);
        const copy = await this.prisma.$transaction(async (tx) => {
            const c = await tx.campaign.create({
                data: {
                    organization_id: ctx.organization_id, branch_id: s.branch_id, name: `${s.name} (copy)`.slice(0, 200), description: s.description, channel: s.channel, campaign_type: s.campaign_type,
                    duplicated_from_campaign_id: s.id, template_id: s.template_id, template_version_id: s.template_version_id, subject: s.subject, preheader: s.preheader,
                    body_html: s.body_html, body_text: s.body_text, sender_identity_id: s.sender_identity_id, from_name: s.from_name, reply_to_address: s.reply_to_address,
                    tracking_enabled: s.tracking_enabled, utm: (s.utm ?? undefined) as Prisma.InputJsonValue, language: s.language, require_consent: s.require_consent,
                    topic_id: s.topic_id, send_rate_per_hour: s.send_rate_per_hour, schedule_timezone: s.schedule_timezone,
                    owner_membership_id: ctx.membership_id, created_by_membership_id: ctx.membership_id,
                },
            });
            if (s.audiences.length) await tx.campaignAudience.createMany({ data: s.audiences.map((a) => ({ campaign_id: c.id, mode: a.mode, list_id: a.list_id, segment_id: a.segment_id, sort_order: a.sort_order })) });
            return c;
        });
        await this.audit.record(ctx, 'communications.campaign.duplicated', { resource_type: 'campaign', resource_id: copy.id, metadata: { source_campaign_id: id } });
        this.events.publish(ctx, { event_key: 'communications.campaign.created', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: copy.id, payload: { name: copy.name, duplicated_from: id } });
        return this.findOne(ctx, copy.id);
    }

    async archive(ctx: OrgContext, id: string, archived: boolean) {
        const campaign = await this.findOne(ctx, id);
        if (archived && LIVE.includes(campaign.status)) throw new ConflictException({ message: 'Cancel the campaign before archiving it', code: 'campaign_live' });
        const row = await this.prisma.campaign.update({ where: { id }, data: { archived_at: archived ? new Date() : null } });
        await this.audit.record(ctx, archived ? 'communications.campaign.archived' : 'communications.campaign.restored', { resource_type: 'campaign', resource_id: id, branch_id: campaign.branch_id });
        this.events.publish(ctx, { event_key: archived ? 'communications.campaign.archived' : 'communications.campaign.restored', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: id, payload: { name: campaign.name } });
        return row;
    }

    async remove(ctx: OrgContext, id: string) {
        const campaign = await this.findOne(ctx, id);
        if (LIVE.includes(campaign.status)) throw new ConflictException({ message: 'Cancel the campaign before deleting it', code: 'campaign_live' });
        if (campaign.sent_count > 0) throw new ConflictException({ message: 'Campaigns that sent messages are kept for history; archive it instead', code: 'campaign_has_history' });
        await this.prisma.campaign.delete({ where: { id } });
        await this.audit.record(ctx, 'communications.campaign.deleted', { resource_type: 'campaign', resource_id: id, branch_id: campaign.branch_id, metadata: { before: { name: campaign.name, status: campaign.status } } });
        this.events.publish(ctx, { event_key: 'communications.campaign.deleted', module: ModuleKey.COMMUNICATION, entity_type: RecordEntityType.CAMPAIGN, entity_id: id, payload: { name: campaign.name } });
        return { success: true };
    }

    /** Send test copies (rendered with sample values) to up to 5 addresses. Test sends never count in analytics. */
    async testSend(ctx: OrgContext, id: string, addresses: string[]) {
        const campaign = await this.findOne(ctx, id);
        if (!campaign.body_html && !campaign.body_text) throw new BadRequestException({ message: 'Add content before sending a test', code: 'campaign_no_content' });
        const org = await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { display_name: true } });
        const context = { ...SAMPLE_CONTEXT, organization_name: org?.display_name ?? '', unsubscribe_url: '#test-unsubscribe' };
        const results: { address: string; status: CommMessageStatus | 'INVALID'; reason?: string | null; message_id?: string }[] = [];
        for (const raw of addresses) {
            const address = normalizeAddress(campaign.channel, raw);
            if (!address) {
                results.push({ address: raw, status: 'INVALID', reason: 'Invalid address' });
                continue;
            }
            const message = await this.prisma.commMessage.create({
                data: {
                    organization_id: ctx.organization_id, branch_id: campaign.branch_id, channel: campaign.channel, kind: CommMessageKind.CAMPAIGN, source: CommMessageSource.CAMPAIGN,
                    status: CommMessageStatus.QUEUED, is_test: true, tracking_enabled: false, campaign_id: null,
                    subject: campaign.subject ? `[Test] ${renderTemplate(campaign.subject, context)}` : null,
                    preheader: renderTemplate(campaign.preheader, context) || null,
                    body_html: campaign.body_html ? renderTemplate(campaign.body_html, context, 'html') : null,
                    body_text: renderTemplate(campaign.body_text, context) || null,
                    sender_identity_id: campaign.sender_identity_id, from_name: campaign.from_name, reply_to_address: campaign.reply_to_address,
                    recipient_kind: 'EXTERNAL', to_address: address, sent_by_membership_id: ctx.membership_id, created_by_user_id: ctx.user_id, queued_at: new Date(),
                    recipients: { create: { role: 'TO', kind: 'EXTERNAL', address } },
                },
            });
            const status = await this.dispatch.dispatch(message.id);
            const after = await this.prisma.commMessage.findUnique({ where: { id: message.id }, select: { failure_reason: true, last_error: true } });
            results.push({ address, status, reason: after?.failure_reason ?? after?.last_error, message_id: message.id });
        }
        await this.audit.record(ctx, 'communications.campaign.test_sent', { resource_type: 'campaign', resource_id: id, metadata: { addresses: results.map((r) => r.address), statuses: results.map((r) => r.status) } });
        return { results };
    }

    async recipients(ctx: OrgContext, id: string, query: CampaignRecipientQuery) {
        await this.findOne(ctx, id);
        const statuses = (query.status ?? '').split(',').filter((s) => (Object.values(CommRecipientStatus) as string[]).includes(s)) as CommRecipientStatus[];
        const where: Prisma.CampaignRecipientWhereInput = {
            campaign_id: id,
            ...(statuses.length && { status: { in: statuses } }),
            ...(query.search && { OR: [{ address: { contains: query.search, mode: 'insensitive' } }, { name: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.campaignRecipient.findMany({
                where,
                ...skipTake(query),
                orderBy: { created_at: 'asc' },
                include: { message: { select: { id: true, status: true, sent_at: true, delivered_at: true, first_opened_at: true, first_clicked_at: true, failure_reason: true, open_count: true, click_count: true } } },
            }),
            this.prisma.campaignRecipient.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async stats(ctx: OrgContext, id: string) {
        const c = await this.findOne(ctx, id);
        const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
        const delivered = c.delivered_count || c.sent_count;
        const events = await this.prisma.commDeliveryEvent.findMany({
            where: { message: { campaign_id: id, is_test: false }, type: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'UNSUBSCRIBED'] } },
            select: { type: true, occurred_at: true },
            orderBy: { occurred_at: 'asc' },
            take: 100_000,
        });
        const first = events[0]?.occurred_at ?? c.started_at;
        const last = events[events.length - 1]?.occurred_at ?? new Date();
        const hourly = first && last.getTime() - first.getTime() < 3 * 24 * 3600 * 1000;
        const bucket = (d: Date) => (hourly ? `${d.toISOString().slice(0, 13)}:00:00.000Z` : `${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
        const series = new Map<string, Record<string, number>>();
        for (const e of events) {
            const k = bucket(e.occurred_at);
            const row = series.get(k) ?? { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
            row[e.type.toLowerCase()] = (row[e.type.toLowerCase()] ?? 0) + 1;
            series.set(k, row);
        }
        const links = await this.prisma.commTrackedLink.findMany({ where: { campaign_id: id }, orderBy: { click_count: 'desc' }, take: 20, select: { id: true, original_url: true, label: true, click_count: true, unique_click_count: true, last_clicked_at: true } });
        const statusCounts = await this.prisma.campaignRecipient.groupBy({ by: ['status'], where: { campaign_id: id }, _count: { _all: true } });
        return {
            counters: {
                audience: c.audience_count, excluded: c.excluded_count, sent: c.sent_count, delivered: c.delivered_count, opened: c.opened_count, clicked: c.clicked_count,
                replied: c.replied_count, bounced: c.bounced_count, failed: c.failed_count, complained: c.complained_count, unsubscribed: c.unsubscribed_count,
            },
            rates: {
                delivery_rate: rate(c.delivered_count, c.sent_count),
                open_rate: rate(c.opened_count, delivered),
                click_rate: rate(c.clicked_count, delivered),
                click_to_open_rate: rate(c.clicked_count, c.opened_count),
                bounce_rate: rate(c.bounced_count, c.sent_count),
                unsubscribe_rate: rate(c.unsubscribed_count, delivered),
            },
            granularity: hourly ? 'hour' : 'day',
            series: [...series.entries()].map(([t, v]) => ({ t, ...v })),
            links,
            recipients_by_status: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
        };
    }
}
