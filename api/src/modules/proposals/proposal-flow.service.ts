import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
    ContractPartyType, ModuleKey, Prisma, ProposalApprovalDecision, ProposalDeliveryChannel, ProposalDeliveryStatus, ProposalEventType, ProposalStatus, ProposalVersionStatus,
} from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ContractsService } from '@/modules/contracts/contracts/contracts.service';
import { personName } from './utils/person-name.utils';
import { CLOSED_STATUSES, INTERNAL_COMMENTS, LIVE_STATUSES, MEMBER_SELECT, ProposalsService } from './proposals.service';
import { ProposalMailer } from './proposal-mailer.service';
import { ProposalPdfService } from './proposal-pdf.service';
import { ApprovalDecisionDto, ConvertProposalDto, CreateProposalCommentDto, SendProposalDto, SubmitForReviewDto } from './dto/proposal.dto';
import { ProposalAnalyticsQuery } from './dto/proposal-query.schema';
import { addDays, dateOnly, issueAccessToken, num, revokeAccessTokens, round2, sha256 } from './utils/proposal.utils';

interface RuleCondition { field: string; operator: string; value: number | string | boolean }
interface RuleStep { step: number; name?: string; approver_membership_id?: string; approver?: { membership_id?: string } }

/**
 * 03 Proposals — internal review & approval, sending (delivery + public link), comments, conversion to a contract, analytics.
 */
@Injectable()
export class ProposalFlowService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly proposals: ProposalsService,
        private readonly contracts: ContractsService,
        private readonly mailer: ProposalMailer,
        private readonly pdf: ProposalPdfService,
    ) { }

    // --- Approval rules ----------------------------------------------------------------------------

    private metrics(version: { net_total: unknown; discount_total: unknown; gross_total: unknown; recurring_monthly: unknown }, proposal: { currency: string; requires_contract: boolean }) {
        const net = num(version.net_total);
        const discount = num(version.discount_total);
        return {
            gross_total: num(version.gross_total),
            net_total: net,
            discount_total: discount,
            discount_percent: net + discount > 0 ? round2((discount / (net + discount)) * 100) : 0,
            recurring_monthly: num(version.recurring_monthly),
            currency: proposal.currency,
            requires_contract: proposal.requires_contract,
        } as Record<string, number | string | boolean>;
    }

    private matches(c: RuleCondition, metrics: Record<string, number | string | boolean>) {
        const actual = metrics[c.field];
        if (actual === undefined) return false;
        if (typeof actual === 'number') {
            const v = Number(c.value);
            switch (c.operator) {
                case '>': return actual > v;
                case '>=': return actual >= v;
                case '<': return actual < v;
                case '<=': return actual <= v;
                case '=': return actual === v;
                case '!=': return actual !== v;
            }
            return false;
        }
        const a = String(actual).toLowerCase();
        const v = String(c.value).toLowerCase();
        return c.operator === '!=' ? a !== v : c.operator === '=' ? a === v : false;
    }

    /** Rules whose conditions all match this version, and the approval steps they request. */
    async evaluateRules(ctx: OrgContext, proposalId: string, versionId: string) {
        const proposal = await this.proposals.getRecord(ctx, proposalId);
        const version = await this.proposals.getVersion(proposalId, versionId);
        const rules = await this.prisma.proposalApprovalRule.findMany({ where: { organization_id: ctx.organization_id, enabled: true }, orderBy: { priority: 'asc' } });
        const metrics = this.metrics(version, proposal);
        const matched = rules.filter((r) => ((r.conditions ?? []) as unknown as RuleCondition[]).every((c) => this.matches(c, metrics)));
        const steps: { step: number; name: string; approver_membership_id: string; rule_id: string; rule_name: string }[] = [];
        for (const r of matched) {
            for (const s of (r.steps ?? []) as unknown as RuleStep[]) {
                const approver = s.approver_membership_id ?? s.approver?.membership_id;
                if (!approver) continue;
                if (steps.some((x) => x.step === s.step && x.approver_membership_id === approver)) continue;
                steps.push({ step: s.step, name: s.name ?? `Step ${s.step}`, approver_membership_id: approver, rule_id: r.id, rule_name: r.name });
            }
        }
        steps.sort((a, b) => a.step - b.step);
        const members = await this.prisma.membership.findMany({ where: { id: { in: steps.map((s) => s.approver_membership_id) }, organization_id: ctx.organization_id }, select: MEMBER_SELECT });
        return {
            metrics,
            matched_rules: matched.map((r) => ({ id: r.id, name: r.name, priority: r.priority })),
            steps: steps.filter((s) => members.some((m) => m.id === s.approver_membership_id)).map((s) => ({ ...s, approver: members.find((m) => m.id === s.approver_membership_id) })),
        };
    }

    async submitForReview(ctx: OrgContext, proposalId: string, versionId: string, dto: SubmitForReviewDto) {
        const proposal = await this.proposals.getRecord(ctx, proposalId, 'proposals.proposals.update');
        if (CLOSED_STATUSES.includes(proposal.status)) throw new ConflictException({ message: 'This proposal is closed', code: 'proposal_closed' });
        const version = await this.proposals.getVersion(proposalId, versionId);
        if (version.status !== ProposalVersionStatus.DRAFT) throw new ConflictException({ message: `Version ${version.version_number} is ${version.status.toLowerCase()}`, code: 'proposal_version_not_draft' });
        if (proposal.current_version_id !== versionId) throw new ConflictException({ message: 'Only the current version can be submitted', code: 'proposal_version_not_current' });

        const { steps } = await this.evaluateRules(ctx, proposalId, versionId);
        const manualStep = (steps[steps.length - 1]?.step ?? 0) + 1;
        const manual = (dto.approver_membership_ids ?? []).filter((id) => !steps.some((s) => s.approver_membership_id === id));
        if (manual.length) {
            const found = await this.prisma.membership.count({ where: { id: { in: manual }, organization_id: ctx.organization_id, status: 'ACTIVE' } });
            if (found !== manual.length) throw new NotFoundException({ message: 'Approver not found', code: 'approver_not_found' });
        }
        const rows = [
            ...steps.map((s) => ({ step: s.step, approver_membership_id: s.approver_membership_id, rule_id: s.rule_id })),
            ...manual.map((id) => ({ step: manualStep, approver_membership_id: id, rule_id: null as string | null })),
        ];
        const live = LIVE_STATUSES.includes(proposal.status);
        const autoApproved = rows.length === 0;

        await this.prisma.$transaction(async (tx) => {
            await tx.proposalApproval.deleteMany({ where: { version_id: versionId } });
            if (rows.length) {
                await tx.proposalApproval.createMany({ data: rows.map((r) => ({ ...r, version_id: versionId, due_at: dto.due_at ? new Date(dto.due_at) : null })) });
            }
            await tx.proposalVersion.update({ where: { id: versionId }, data: { status: autoApproved ? ProposalVersionStatus.APPROVED : ProposalVersionStatus.IN_REVIEW } });
            if (!live) await tx.proposal.update({ where: { id: proposalId }, data: { status: autoApproved ? ProposalStatus.APPROVED : ProposalStatus.PENDING_APPROVAL } });
            await tx.proposalEvent.create({ data: { proposal_id: proposalId, version_id: versionId, type: autoApproved ? ProposalEventType.APPROVED : ProposalEventType.SUBMITTED_FOR_REVIEW, actor_user_id: ctx.user_id, metadata: { note: dto.note ?? null, steps: rows.length } } });
            if (dto.note) await tx.proposalComment.create({ data: { proposal_id: proposalId, version_id: versionId, author_membership_id: ctx.membership_id, author_user_id: ctx.user_id, is_internal: true, body: dto.note } });
            await this.audit.record(ctx, 'proposal.submitted_for_review', { resource_type: 'proposal', resource_id: proposalId, metadata: { version_id: versionId, approvals: rows, auto_approved: autoApproved } }, tx);
        });
        const firstStep = rows.length ? Math.min(...rows.map((r) => r.step)) : null;
        this.events.publish(ctx, {
            event_key: autoApproved ? 'proposals.proposal.approved' : 'proposals.proposal.approval_requested',
            module: ModuleKey.PROPOSALS,
            entity_kind: 'proposal',
            entity_id: proposalId,
            payload: {
                number: proposal.number, title: proposal.title, version_id: versionId, version_number: version.version_number,
                owner_membership_id: proposal.owner_membership_id,
                approver_membership_ids: rows.filter((r) => r.step === firstStep).map((r) => r.approver_membership_id),
            },
            activity: { summary: autoApproved ? `Proposal ${proposal.number} approved (no rule required approval)` : `Proposal ${proposal.number} v${version.version_number} submitted for approval`, entity_label: proposal.title, company_id: proposal.company_id },
        });
        return this.proposals.findOne(ctx, proposalId, versionId);
    }

    async getApproval(ctx: OrgContext, proposalId: string, approvalId: string) {
        await this.proposals.getRecord(ctx, proposalId);
        const approval = await this.prisma.proposalApproval.findFirst({
            where: { id: approvalId, version: { proposal_id: proposalId } },
            include: { approver: { select: MEMBER_SELECT }, version: { select: { id: true, version_number: true, status: true, gross_total: true, discount_total: true, net_total: true } } },
        });
        if (!approval) throw new NotFoundException({ message: 'Approval not found', code: 'proposal_approval_not_found' });
        return approval;
    }

    /** Approver decides one step. Steps run in order; any rejection returns the version to DRAFT. */
    async decide(ctx: OrgContext, proposalId: string, approvalId: string, dto: ApprovalDecisionDto) {
        const proposal = await this.proposals.getRecord(ctx, proposalId);
        const approval = await this.getApproval(ctx, proposalId, approvalId);
        if (approval.approver_membership_id !== ctx.membership_id) throw new ForbiddenException({ message: 'Only the assigned approver can decide this step', code: 'not_the_approver' });
        if (approval.decision !== ProposalApprovalDecision.PENDING) throw new ConflictException({ message: 'This step is already decided', code: 'approval_already_decided' });
        if (approval.version.status !== ProposalVersionStatus.IN_REVIEW) throw new ConflictException({ message: 'The version is no longer in review', code: 'proposal_version_not_in_review' });
        const earlier = await this.prisma.proposalApproval.count({ where: { version_id: approval.version_id, step: { lt: approval.step }, decision: { not: ProposalApprovalDecision.APPROVED } } });
        if (earlier) throw new ConflictException({ message: 'Earlier approval steps are still open', code: 'approval_step_blocked' });
        if (dto.decision !== ProposalApprovalDecision.APPROVED && !dto.comment?.trim()) throw new BadRequestException({ message: 'Explain what needs to change', code: 'approval_comment_required' });

        const live = LIVE_STATUSES.includes(proposal.status);
        const result = await this.prisma.$transaction(async (tx) => {
            await tx.proposalApproval.update({ where: { id: approvalId }, data: { decision: dto.decision, comment: dto.comment ?? null, decided_at: new Date() } });
            let outcome: 'approved' | 'rejected' | 'pending' = 'pending';
            if (dto.decision === ProposalApprovalDecision.APPROVED) {
                const open = await tx.proposalApproval.count({ where: { version_id: approval.version_id, decision: { not: ProposalApprovalDecision.APPROVED } } });
                if (!open) {
                    outcome = 'approved';
                    await tx.proposalVersion.update({ where: { id: approval.version_id }, data: { status: ProposalVersionStatus.APPROVED } });
                    if (!live) await tx.proposal.update({ where: { id: proposalId }, data: { status: ProposalStatus.APPROVED } });
                    await tx.proposalEvent.create({ data: { proposal_id: proposalId, version_id: approval.version_id, type: ProposalEventType.APPROVED, actor_user_id: ctx.user_id } });
                }
            } else {
                outcome = 'rejected';
                await tx.proposalApproval.updateMany({ where: { version_id: approval.version_id, decision: ProposalApprovalDecision.PENDING }, data: { decision: ProposalApprovalDecision.REJECTED, comment: `Closed: step ${approval.step} was ${dto.decision === 'REJECTED' ? 'rejected' : 'sent back for changes'}`, decided_at: new Date() } });
                await tx.proposalVersion.update({ where: { id: approval.version_id }, data: { status: ProposalVersionStatus.DRAFT } });
                if (!live) await tx.proposal.update({ where: { id: proposalId }, data: { status: ProposalStatus.DRAFT } });
            }
            if (dto.comment) await tx.proposalComment.create({ data: { proposal_id: proposalId, version_id: approval.version_id, author_membership_id: ctx.membership_id, author_user_id: ctx.user_id, is_internal: true, body: `[${dto.decision.replace('_', ' ').toLowerCase()}] ${dto.comment}` } });
            await this.audit.record(ctx, dto.decision === ProposalApprovalDecision.APPROVED ? 'proposal.approval.approved' : 'proposal.approval.rejected', {
                resource_type: 'proposal', resource_id: proposalId, metadata: { approval_id: approvalId, step: approval.step, decision: dto.decision, version_id: approval.version_id },
            }, tx);
            return outcome;
        });
        const nextStep = result === 'pending'
            ? await this.prisma.proposalApproval.findMany({ where: { version_id: approval.version_id, decision: ProposalApprovalDecision.PENDING }, orderBy: { step: 'asc' } })
            : [];
        const next = nextStep.filter((a) => a.step === nextStep[0]?.step).map((a) => a.approver_membership_id);
        this.events.publish(ctx, {
            event_key: result === 'approved' ? 'proposals.proposal.approved' : result === 'rejected' ? 'proposals.proposal.approval_rejected' : 'proposals.proposal.approval_requested',
            module: ModuleKey.PROPOSALS,
            entity_kind: 'proposal',
            entity_id: proposalId,
            payload: { number: proposal.number, title: proposal.title, version_id: approval.version_id, decision: dto.decision, comment: dto.comment ?? null, owner_membership_id: proposal.owner_membership_id, approver_membership_ids: next },
            activity: result === 'pending' ? undefined : { summary: `Proposal ${proposal.number} ${result === 'approved' ? 'approved' : 'sent back by an approver'}`, entity_label: proposal.title, company_id: proposal.company_id },
        });
        return this.proposals.findOne(ctx, proposalId, approval.version_id);
    }

    /** Approval steps waiting for the caller (only steps whose earlier steps are approved). */
    async myApprovals(ctx: OrgContext) {
        if (!ctx.membership_id) return [];
        const rows = await this.prisma.proposalApproval.findMany({
            where: { approver_membership_id: ctx.membership_id, decision: ProposalApprovalDecision.PENDING, version: { status: ProposalVersionStatus.IN_REVIEW, proposal: { organization_id: ctx.organization_id } } },
            include: { version: { select: { id: true, version_number: true, gross_total: true, proposal: { select: { id: true, number: true, title: true, currency: true, company: { select: { name: true } } } } } } },
            orderBy: { requested_at: 'asc' },
        });
        const out: typeof rows = [];
        for (const r of rows) {
            const blocked = await this.prisma.proposalApproval.count({ where: { version_id: r.version_id, step: { lt: r.step }, decision: { not: ProposalApprovalDecision.APPROVED } } });
            if (!blocked) out.push(r);
        }
        return out;
    }

    // --- Send ----------------------------------------------------------------------------------------

    /** Pre-send checklist. `ready` is false when any blocking item fails. */
    async sendPreview(ctx: OrgContext, proposalId: string, versionId?: string) {
        const detail = await this.proposals.findOne(ctx, proposalId, versionId);
        const v = detail.version;
        if (!v) throw new NotFoundException({ message: 'Version not found', code: 'proposal_version_not_found' });
        const rules = await this.evaluateRules(ctx, proposalId, v.id);
        const base = num(v.gross_total);
        const fixed = v.payment_schedule.filter((p) => p.trigger !== 'RECURRING');
        const allocated = fixed.reduce((a, p) => a + (p.percentage !== null ? num(p.percentage) : base > 0 ? (num(p.amount) / base) * 100 : 0), 0);
        const isResend = v.status === ProposalVersionStatus.SENT && detail.sent_version_id === v.id && LIVE_STATUSES.includes(detail.status);
        const checks = [
            { key: 'customer', ok: !!detail.company_id, blocking: true, label: 'Customer selected', detail: detail.company?.name ?? 'Choose the company the proposal is addressed to' },
            { key: 'contact', ok: !!detail.contact?.email, blocking: false, label: 'Primary contact with email', detail: detail.contact?.email ?? 'Add a contact or extra recipient emails' },
            { key: 'content', ok: v.sections.some((s) => !s.is_internal && (s.body ?? '').trim().length > 0), blocking: true, label: 'Customer-visible content', detail: `${v.sections.filter((s) => !s.is_internal).length} sections` },
            { key: 'pricing', ok: v.line_items.length > 0, blocking: true, label: 'Pricing has at least one line', detail: `${v.line_items.length} lines` },
            { key: 'schedule', ok: fixed.length === 0 || Math.abs(allocated - 100) < 0.5, blocking: true, label: 'Payment schedule adds up to 100%', detail: fixed.length ? `${round2(allocated)}% allocated` : 'No schedule (payment terms only)' },
            {
                key: 'approval',
                ok: v.status === ProposalVersionStatus.APPROVED || isResend || (v.status === ProposalVersionStatus.DRAFT && rules.steps.length === 0),
                blocking: true,
                label: 'Approved for sending',
                detail: v.status === ProposalVersionStatus.APPROVED ? 'Approved' : v.status === ProposalVersionStatus.IN_REVIEW ? 'Waiting for approvers' : rules.steps.length ? `Approval required: ${rules.matched_rules.map((r) => r.name).join(', ')}` : 'No approval rule matched',
            },
            { key: 'status', ok: !CLOSED_STATUSES.includes(detail.status) && (v.status !== ProposalVersionStatus.SENT || isResend) && v.status !== ProposalVersionStatus.SUPERSEDED, blocking: true, label: 'Version can be sent', detail: `v${v.version_number} · ${v.status}` },
        ];
        return {
            version_id: v.id,
            version_number: v.version_number,
            is_resend: isResend,
            ready: checks.every((c) => c.ok || !c.blocking),
            checks,
            email_enabled: this.mailer.enabled,
            default_valid_until: dateOnly(addDays(new Date(), v.validity_days ?? 30)).toISOString().slice(0, 10),
            recipients: detail.contact ? [{ contact_id: detail.contact.id, name: `${detail.contact.first_name} ${detail.contact.last_name ?? ''}`.trim(), email: detail.contact.email }] : [],
        };
    }

    async send(ctx: OrgContext, proposalId: string, dto: SendProposalDto) {
        const proposal = await this.proposals.getRecord(ctx, proposalId, 'proposals.proposals.send');
        const versionId = dto.version_id ?? proposal.current_version_id;
        if (!versionId) throw new BadRequestException({ message: 'Nothing to send', code: 'proposal_no_version' });
        if (versionId !== proposal.current_version_id && versionId !== proposal.sent_version_id) throw new ConflictException({ message: 'Only the current version can be sent', code: 'proposal_version_not_current' });

        const preview = await this.sendPreview(ctx, proposalId, versionId);
        const failing = preview.checks.filter((c) => c.blocking && !c.ok);
        if (failing.length) throw new ConflictException({ message: `Cannot send yet: ${failing.map((c) => `${c.label} (${c.detail})`).join('; ')}`, code: 'proposal_send_blocked', checks: preview.checks });

        const contacts = dto.recipient_contact_ids?.length
            ? await this.prisma.crmContact.findMany({ where: { id: { in: dto.recipient_contact_ids }, organization_id: ctx.organization_id }, select: { id: true, email: true, first_name: true, last_name: true } })
            : [];
        if (contacts.length !== (dto.recipient_contact_ids?.length ?? 0)) throw new NotFoundException({ message: 'Recipient contact not found', code: 'reference_not_found' });
        const recipients = [
            ...contacts.filter((c) => c.email).map((c) => ({ contact_id: c.id as string | null, email: c.email as string, name: `${c.first_name} ${c.last_name ?? ''}`.trim() })),
            ...(dto.extra_emails ?? []).map((e) => ({ contact_id: null as string | null, email: e.toLowerCase(), name: e })),
        ].filter((r, i, all) => all.findIndex((x) => x.email === r.email) === i);
        if (dto.channels.includes(ProposalDeliveryChannel.EMAIL) && !recipients.length) throw new BadRequestException({ message: 'Add at least one recipient with an email address', code: 'proposal_no_recipients' });

        const validUntil = dto.valid_until ? dateOnly(new Date(dto.valid_until)) : new Date(preview.default_valid_until);
        if (validUntil.getTime() < dateOnly(new Date()).getTime()) throw new BadRequestException({ message: 'Valid until must be today or later', code: 'proposal_valid_until_past' });

        const full = await this.prisma.proposalVersion.findUniqueOrThrow({
            where: { id: versionId },
            include: { sections: { orderBy: { sort_order: 'asc' } }, line_items: { orderBy: { sort_order: 'asc' } }, payment_schedule: { orderBy: { sort_order: 'asc' } } },
        });
        const variables = await this.resolveVariables(ctx.organization_id, proposalId, validUntil);
        const contentHash = sha256(JSON.stringify({ s: full.sections.map((s) => [s.type, s.title, s.body, s.is_internal]), l: full.line_items.map((l) => [l.name, l.quantity, l.unit_price, l.discount_amount, l.tax_percent, l.is_optional]), p: full.payment_schedule.map((p) => [p.name, p.trigger, p.percentage, p.amount]), t: full.gross_total, variables }));
        const now = new Date();
        let token = '';
        const isResend = preview.is_resend;

        const deliveries = await this.prisma.$transaction(async (tx) => {
            if (!isResend) {
                if (proposal.sent_version_id && proposal.sent_version_id !== versionId) {
                    await tx.proposalVersion.update({ where: { id: proposal.sent_version_id }, data: { status: ProposalVersionStatus.SUPERSEDED } });
                }
                await tx.proposalVersion.update({ where: { id: versionId }, data: { status: ProposalVersionStatus.SENT, locked_at: now, sent_at: now, variables, content_hash: contentHash } });
            }
            await tx.proposal.update({
                where: { id: proposalId },
                data: {
                    status: isResend && proposal.status !== ProposalStatus.SENT ? proposal.status : ProposalStatus.SENT,
                    sent_version_id: versionId,
                    sent_at: now,
                    valid_until: validUntil,
                    ...(dto.reminder_days && { reminder_days: dto.reminder_days }),
                    ...(dto.link_access_mode && { link_access_mode: dto.link_access_mode }),
                    net_total: full.net_total, discount_total: full.discount_total, tax_total: full.tax_total, gross_total: full.gross_total, recurring_monthly: full.recurring_monthly, recurring_annual: full.recurring_annual,
                },
            });
            // One link per send; links from earlier sends keep working (rotate the link to cut them off).
            token = (await issueAccessToken(tx, { organization_id: ctx.organization_id, proposal_id: proposalId, source: 'SEND', recipient_email: recipients.length === 1 ? recipients[0].email : null })).token;
            const rows: Prisma.ProposalDeliveryCreateManyInput[] = [];
            for (const channel of dto.channels) {
                if (channel === ProposalDeliveryChannel.EMAIL) {
                    for (const r of recipients) rows.push({ proposal_id: proposalId, version_id: versionId, channel, status: ProposalDeliveryStatus.QUEUED, recipient_contact_id: r.contact_id, recipient_email: r.email, sent_by_user_id: ctx.user_id, message: dto.message ?? null });
                } else {
                    rows.push({ proposal_id: proposalId, version_id: versionId, channel, status: ProposalDeliveryStatus.SENT, recipient_contact_id: proposal.contact_id, sent_by_user_id: ctx.user_id, message: dto.message ?? null, sent_at: now });
                }
            }
            await tx.proposalDelivery.createMany({ data: rows });
            await tx.proposalEvent.create({ data: { proposal_id: proposalId, version_id: versionId, type: ProposalEventType.SENT, actor_user_id: ctx.user_id, metadata: { channels: dto.channels, recipients: recipients.map((r) => r.email), resend: isResend, valid_until: validUntil.toISOString().slice(0, 10) } } });
            await this.audit.record(ctx, 'proposal.sent', { resource_type: 'proposal', resource_id: proposalId, branch_id: proposal.branch_id, metadata: { version_id: versionId, channels: dto.channels, recipients: recipients.map((r) => r.email), content_hash: contentHash, resend: isResend } }, tx);
            return tx.proposalDelivery.findMany({ where: { proposal_id: proposalId, version_id: versionId, created_at: { gte: now } } });
        });

        const publicUrl = this.mailer.appUrl(`/p/${token}`);
        if (dto.channels.includes(ProposalDeliveryChannel.PDF)) {
            // The sent version is locked: render it once and store it in Files (ProposalVersion.pdf_document_id).
            try {
                const file = await this.pdf.forVersion(ctx, ctx.organization_id, proposalId, versionId);
                file.stream.resume();
                if (!file.document_id) {
                    const stored = await this.prisma.proposalVersion.findUnique({ where: { id: versionId }, select: { pdf_document_id: true } });
                    if (!stored?.pdf_document_id) throw new Error('The PDF could not be stored (documents.documents.create needed)');
                }
            } catch (error) {
                await this.prisma.proposalDelivery.updateMany({ where: { id: { in: deliveries.filter((d) => d.channel === ProposalDeliveryChannel.PDF).map((d) => d.id) } }, data: { status: ProposalDeliveryStatus.FAILED, failed_reason: (error as Error).message.slice(0, 500) } });
            }
        }
        if (dto.channels.includes(ProposalDeliveryChannel.EMAIL)) {
            const org = await this.prisma.organization.findUnique({ where: { id: ctx.organization_id }, select: { display_name: true } });
            for (const d of deliveries.filter((x) => x.channel === ProposalDeliveryChannel.EMAIL)) {
                if (!this.mailer.enabled) {
                    await this.prisma.proposalDelivery.update({ where: { id: d.id }, data: { status: ProposalDeliveryStatus.FAILED, failed_reason: 'Email is not configured for this environment; share the link instead' } });
                    continue;
                }
                try {
                    await this.mailer.send(
                        d.recipient_email as string,
                        dto.subject || `Proposal ${proposal.number}: ${proposal.title}`,
                        [dto.message || `${org?.display_name ?? 'We'} sent you the proposal "${proposal.title}". It is valid until ${validUntil.toISOString().slice(0, 10)}.`],
                        { label: 'View proposal', url: publicUrl },
                    );
                    await this.prisma.proposalDelivery.update({ where: { id: d.id }, data: { status: ProposalDeliveryStatus.SENT, sent_at: new Date() } });
                } catch (error) {
                    await this.prisma.proposalDelivery.update({ where: { id: d.id }, data: { status: ProposalDeliveryStatus.FAILED, failed_reason: (error as Error).message.slice(0, 500) } });
                }
            }
        }

        this.events.publish(ctx, {
            event_key: 'proposals.proposal.sent',
            module: ModuleKey.PROPOSALS,
            entity_kind: 'proposal',
            entity_id: proposalId,
            payload: { number: proposal.number, title: proposal.title, version_id: versionId, channels: dto.channels, valid_until: validUntil.toISOString().slice(0, 10), owner_membership_id: proposal.owner_membership_id, deal_id: proposal.deal_id, company_id: proposal.company_id, gross_total: num(full.gross_total) },
            activity: { summary: `Proposal ${proposal.number} sent`, entity_label: proposal.title, company_id: proposal.company_id, branch_id: proposal.branch_id },
        });
        const finalDeliveries = await this.prisma.proposalDelivery.findMany({ where: { id: { in: deliveries.map((d) => d.id) } } });
        return { public_url: publicUrl, email_enabled: this.mailer.enabled, deliveries: finalDeliveries, proposal: await this.proposals.getRecord(ctx, proposalId) };
    }

    /** New public link for a live proposal (the token is shown once; the old link stops working). */
    async rotateLink(ctx: OrgContext, proposalId: string) {
        const proposal = await this.proposals.getRecord(ctx, proposalId, 'proposals.proposals.send');
        if (!proposal.sent_version_id || !(LIVE_STATUSES.includes(proposal.status) || proposal.status === ProposalStatus.ACCEPTED)) {
            throw new ConflictException({ message: 'Only a sent proposal has a customer link', code: 'proposal_not_sent' });
        }
        const { token } = await this.prisma.$transaction(async (tx) => {
            await revokeAccessTokens(tx, proposalId);
            return issueAccessToken(tx, { organization_id: ctx.organization_id, proposal_id: proposalId, source: 'ROTATION' });
        });
        await this.audit.record(ctx, 'proposal.link_rotated', { resource_type: 'proposal', resource_id: proposalId });
        return { public_url: this.mailer.appUrl(`/p/${token}`) };
    }

    private async resolveVariables(organizationId: string, proposalId: string, validUntil: Date) {
        const p = await this.prisma.proposal.findUniqueOrThrow({
            where: { id: proposalId },
            include: { company: { select: { name: true } }, contact: { select: { first_name: true, last_name: true, email: true } }, owner: { select: MEMBER_SELECT }, organization: { select: { display_name: true, legal_name: true } } },
        });
        const project = p.project_id ? await this.prisma.project.findFirst({ where: { id: p.project_id, organization_id: organizationId }, select: { name: true } }) : null;
        const contactName = p.contact ? `${p.contact.first_name} ${p.contact.last_name ?? ''}`.trim() : '';
        return {
            'organization.name': p.organization.display_name,
            'company.name': p.company?.name ?? '',
            'customer.name': p.company?.name ?? '',
            'contact.name': contactName,
            'contact.first_name': p.contact?.first_name ?? '',
            'contact.email': p.contact?.email ?? '',
            'proposal.number': p.number,
            'proposal.title': p.title,
            'proposal.valid_until': validUntil.toISOString().slice(0, 10),
            'proposal.owner': p.owner ? personName(p.owner.user) : '',
            'project.name': project?.name ?? '',
            'project.manager': p.owner ? personName(p.owner.user) : '',
        } as Record<string, string>;
    }

    // --- Comments ------------------------------------------------------------------------------------

    async comments(ctx: OrgContext, proposalId: string, q: { version_id?: string; section_id?: string; resolved?: boolean }) {
        await this.proposals.getRecord(ctx, proposalId);
        return this.prisma.proposalComment.findMany({
            where: {
                proposal_id: proposalId,
                ...(ctx.can(INTERNAL_COMMENTS) ? {} : { is_internal: false }),
                ...(q.version_id && { version_id: q.version_id }),
                ...(q.section_id && { section_id: q.section_id }),
                ...(q.resolved !== undefined && { resolved_at: q.resolved ? { not: null } : null }),
            },
            include: { author: { select: MEMBER_SELECT }, section: { select: { id: true, title: true } }, version: { select: { version_number: true } } },
            orderBy: { created_at: 'asc' },
        });
    }

    async addComment(ctx: OrgContext, proposalId: string, dto: CreateProposalCommentDto) {
        const proposal = await this.proposals.getRecord(ctx, proposalId);
        const internal = dto.is_internal ?? true;
        if (internal && !ctx.can(INTERNAL_COMMENTS)) throw new ForbiddenException({ message: 'Internal comments need proposals.comments.internal.read', code: 'permission_denied' });
        if (!internal && !ctx.can('proposals.proposals.update')) throw new ForbiddenException({ message: 'Replying to the customer needs proposals.proposals.update', code: 'permission_denied' });
        if (dto.version_id) await this.proposals.getVersion(proposalId, dto.version_id);
        if (dto.section_id && !(await this.prisma.proposalSection.findFirst({ where: { id: dto.section_id, version: { proposal_id: proposalId } } }))) throw new NotFoundException({ message: 'Section not found', code: 'reference_not_found' });
        if (dto.parent_comment_id && !(await this.prisma.proposalComment.findFirst({ where: { id: dto.parent_comment_id, proposal_id: proposalId } }))) throw new NotFoundException({ message: 'Comment not found', code: 'reference_not_found' });
        const comment = await this.prisma.proposalComment.create({
            data: { proposal_id: proposalId, version_id: dto.version_id ?? proposal.current_version_id, section_id: dto.section_id ?? null, parent_comment_id: dto.parent_comment_id ?? null, author_membership_id: ctx.membership_id, author_user_id: ctx.user_id, is_internal: internal, body: dto.body },
            include: { author: { select: MEMBER_SELECT } },
        });
        await this.audit.record(ctx, 'proposal.comment.created', { resource_type: 'proposal', resource_id: proposalId, metadata: { comment_id: comment.id, is_internal: internal } });
        this.events.publish(ctx, { event_key: 'proposals.proposal.commented', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: proposalId, payload: { number: proposal.number, comment_id: comment.id, is_internal: internal, owner_membership_id: proposal.owner_membership_id } });
        return comment;
    }

    async resolveComment(ctx: OrgContext, proposalId: string, commentId: string, resolved: boolean) {
        await this.proposals.getRecord(ctx, proposalId, 'proposals.proposals.update');
        const c = await this.prisma.proposalComment.findFirst({ where: { id: commentId, proposal_id: proposalId } });
        if (!c || (c.is_internal && !ctx.can(INTERNAL_COMMENTS))) throw new NotFoundException({ message: 'Comment not found', code: 'proposal_comment_not_found' });
        const updated = await this.prisma.proposalComment.update({ where: { id: commentId }, data: { resolved_at: resolved ? new Date() : null } });
        await this.audit.record(ctx, resolved ? 'proposal.comment.resolved' : 'proposal.comment.reopened', { resource_type: 'proposal', resource_id: proposalId, metadata: { comment_id: commentId } });
        return updated;
    }

    // --- Conversion -----------------------------------------------------------------------------------

    /**
     * Accepted proposal → DRAFT contract (04) bound to the exact accepted version. The contract is created by the owning
     * module (ContractsService.create: numbering, parties, sections from the proposal or a template, audit, events); this
     * method adds the proposal-specific parts: value from the accepted totals, the customer contact as signatory, the link back.
     */
    async convert(ctx: OrgContext, proposalId: string, dto: ConvertProposalDto) {
        if (!ctx.can('contracts.contracts.create')) throw new ForbiddenException({ message: 'Creating the contract needs contracts.contracts.create', code: 'permission_denied', permissions: ['contracts.contracts.create'] });
        const proposal = await this.proposals.getRecord(ctx, proposalId, 'proposals.proposals.convert');
        if (proposal.status !== ProposalStatus.ACCEPTED || !proposal.accepted_version_id) throw new ConflictException({ message: 'Only an accepted proposal can be converted', code: 'proposal_not_accepted' });
        if (proposal.contract_id) {
            const existing = await this.prisma.contract.findFirst({ where: { id: proposal.contract_id, organization_id: ctx.organization_id }, select: { id: true, number: true } });
            if (existing) throw new ConflictException({ message: `Already converted to contract ${existing.number}`, code: 'proposal_already_converted', contract_id: existing.id });
        }
        const [version, company, contact, org] = await Promise.all([
            this.prisma.proposalVersion.findUniqueOrThrow({ where: { id: proposal.accepted_version_id } }),
            proposal.company_id ? this.prisma.crmCompany.findFirst({ where: { id: proposal.company_id, organization_id: ctx.organization_id }, select: { id: true, name: true, legal_name: true } }) : null,
            proposal.contact_id ? this.prisma.crmContact.findFirst({ where: { id: proposal.contact_id, organization_id: ctx.organization_id }, select: { id: true, first_name: true, last_name: true, email: true, job_title: true } }) : null,
            this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization_id }, select: { display_name: true, legal_name: true } }),
        ]);
        const recurringMonthly = num(version.recurring_monthly);
        const oneTime = round2(num(version.gross_total) - recurringMonthly * 12);
        const projectId = proposal.converted_project_id ?? proposal.project_id;

        const contract = await this.contracts.create(ctx, {
            title: dto.contract_title ?? proposal.title,
            type_id: dto.contract_type_id,
            template_id: dto.contract_template_id,
            primary_company_id: proposal.company_id ?? undefined,
            owner_membership_id: proposal.owner_membership_id ?? undefined,
            branch_id: proposal.branch_id ?? undefined,
            proposal_id: proposal.id,
            proposal_version_id: version.id,
            currency: proposal.currency,
            language: proposal.language,
            total_value: num(version.gross_total),
            one_time_value: oneTime > 0 ? oneTime : num(version.gross_total),
            recurring_value: recurringMonthly > 0 ? recurringMonthly : undefined,
            billing_frequency: recurringMonthly > 0 ? 'monthly' : undefined,
            payment_terms: version.payment_terms?.slice(0, 500) ?? undefined,
            project_ids: projectId ? [projectId] : undefined,
            variables: Object.fromEntries(Object.entries((version.variables ?? {}) as Record<string, string>).filter(([, v]) => typeof v === 'string')),
            parties: [
                { party_type: ContractPartyType.AGENCY, legal_name: org.legal_name || org.display_name },
                ...(company
                    ? [{
                        party_type: ContractPartyType.CUSTOMER, company_id: company.id, legal_name: company.legal_name || company.name,
                        signatories: contact?.email ? [{ contact_id: contact.id, name: `${contact.first_name} ${contact.last_name ?? ''}`.trim(), email: contact.email, title: contact.job_title ?? undefined }] : [],
                    }]
                    : []),
            ],
        });

        await this.prisma.$transaction(async (tx) => {
            await tx.proposal.update({ where: { id: proposalId }, data: { contract_id: contract.id, converted_at: new Date() } });
            await tx.proposalEvent.create({ data: { proposal_id: proposalId, version_id: version.id, type: ProposalEventType.CONVERTED, actor_user_id: ctx.user_id, metadata: { contract_id: contract.id, contract_number: contract.number } } });
            await this.audit.record(ctx, 'proposal.converted', { resource_type: 'proposal', resource_id: proposalId, metadata: { contract_id: contract.id, contract_number: contract.number, version_id: version.id } }, tx);
        });
        this.events.publish(ctx, {
            event_key: 'proposals.proposal.converted', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: proposalId,
            payload: { number: proposal.number, contract_id: contract.id, contract_number: contract.number, owner_membership_id: proposal.owner_membership_id },
            activity: { summary: `Proposal ${proposal.number} converted to contract ${contract.number}`, entity_label: proposal.title, company_id: proposal.company_id },
        });
        return { contract_id: contract.id, contract_number: contract.number };
    }

    // --- Analytics --------------------------------------------------------------------------------------

    async analytics(ctx: OrgContext, q: ProposalAnalyticsQuery) {
        await this.proposals.expireOverdue(ctx.organization_id);
        const to = q.to ? new Date(q.to) : new Date();
        const from = q.from ? new Date(q.from) : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 11, 1));
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new BadRequestException({ message: 'Invalid date range', code: 'invalid_range' });
        const rows = await this.prisma.proposal.findMany({
            where: {
                organization_id: ctx.organization_id,
                ...this.proposals.scopeWhere(ctx, 'proposals.analytics.read'),
                ...(q.owner_membership_id && { owner_membership_id: q.owner_membership_id }),
                OR: [{ created_at: { gte: from, lte: to } }, { sent_at: { gte: from, lte: to } }, { accepted_at: { gte: from, lte: to } }],
            },
            select: { id: true, status: true, gross_total: true, currency: true, created_at: true, sent_at: true, accepted_at: true, rejected_at: true, expired_at: true, lost_reason: true, owner_membership_id: true, view_count: true, first_viewed_at: true },
            take: 10000,
        });
        const inRange = (d: Date | null) => !!d && d >= from && d <= to;
        const sent = rows.filter((r) => inRange(r.sent_at));
        const accepted = rows.filter((r) => r.status === ProposalStatus.ACCEPTED && inRange(r.accepted_at));
        const lost = rows.filter((r) => (r.status === ProposalStatus.REJECTED && inRange(r.rejected_at)) || (r.status === ProposalStatus.EXPIRED && inRange(r.expired_at)));
        const decided = accepted.length + lost.length;
        const acceptedValue = accepted.reduce((a, r) => a + num(r.gross_total), 0);
        const daysToAccept = accepted.filter((r) => r.sent_at && r.accepted_at).map((r) => ((r.accepted_at as Date).getTime() - (r.sent_at as Date).getTime()) / 86_400_000);
        const viewed = sent.filter((r) => r.first_viewed_at);

        const byStatus: Record<string, number> = {};
        for (const r of rows.filter((x) => inRange(x.created_at))) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
        const lostReasons: Record<string, number> = {};
        for (const r of lost) lostReasons[r.lost_reason ?? 'UNSPECIFIED'] = (lostReasons[r.lost_reason ?? 'UNSPECIFIED'] ?? 0) + 1;

        const months: { month: string; created: number; sent: number; accepted: number; accepted_value: number }[] = [];
        for (let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)); d <= to; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
            const key = d.toISOString().slice(0, 7);
            const same = (x: Date | null) => !!x && x.toISOString().slice(0, 7) === key;
            months.push({
                month: key,
                created: rows.filter((r) => same(r.created_at)).length,
                sent: rows.filter((r) => same(r.sent_at)).length,
                accepted: accepted.filter((r) => same(r.accepted_at)).length,
                accepted_value: round2(accepted.filter((r) => same(r.accepted_at)).reduce((a, r) => a + num(r.gross_total), 0)),
            });
        }
        const ownerIds = [...new Set(rows.map((r) => r.owner_membership_id).filter(Boolean))] as string[];
        const owners = await this.prisma.membership.findMany({ where: { id: { in: ownerIds } }, select: MEMBER_SELECT });
        const byOwner = ownerIds.map((id) => {
            const mine = (list: typeof rows) => list.filter((r) => r.owner_membership_id === id);
            const a = mine(accepted);
            const l = mine(lost);
            return {
                owner: owners.find((o) => o.id === id) ?? null,
                sent: mine(sent).length,
                accepted: a.length,
                lost: l.length,
                accepted_value: round2(a.reduce((s, r) => s + num(r.gross_total), 0)),
                win_rate: a.length + l.length ? round2((a.length / (a.length + l.length)) * 100) : null,
            };
        }).sort((x, y) => y.accepted_value - x.accepted_value);

        return {
            range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
            created: rows.filter((r) => inRange(r.created_at)).length,
            sent: sent.length,
            viewed_rate: sent.length ? round2((viewed.length / sent.length) * 100) : null,
            accepted: accepted.length,
            lost: lost.length,
            win_rate: decided ? round2((accepted.length / decided) * 100) : null,
            accepted_value: round2(acceptedValue),
            avg_accepted_value: accepted.length ? round2(acceptedValue / accepted.length) : null,
            avg_days_to_accept: daysToAccept.length ? round2(daysToAccept.reduce((a, b) => a + b, 0) / daysToAccept.length) : null,
            by_status: byStatus,
            lost_reasons: lostReasons,
            months,
            by_owner: byOwner,
            currencies: [...new Set(rows.map((r) => r.currency))],
        };
    }

    /**
     * 07 Customer portal — a fresh customer link for a signed-in portal user of the proposal's company. Rotates the public
     * token (only its sha256 is stored; earlier emailed links stop working) and, for EMAIL_VERIFIED links, pre-verifies access
     * because the portal login already proved the user's email. The portal guard checked portal.proposals.read / .accept.
     */
    async portalLink(input: { organization_id: string; company_id: string; proposal_id: string; user_id: string; email: string; ip?: string | null }) {
        const p = await this.prisma.proposal.findFirst({
            where: { id: input.proposal_id, organization_id: input.organization_id, company_id: input.company_id, archived_at: null, sent_version_id: { not: null } },
            select: { id: true, status: true, number: true, link_access_mode: true, branch_id: true },
        });
        if (!p) throw new NotFoundException({ message: 'Proposal not found', code: 'proposal_not_found' });
        if (!(LIVE_STATUSES.includes(p.status) || p.status === ProposalStatus.ACCEPTED || p.status === ProposalStatus.REJECTED)) {
            throw new ConflictException({ message: 'This proposal can no longer be opened', code: 'proposal_not_open' });
        }
        // A separate link for the portal user, so the links already emailed to the customer keep working.
        const token = await issueAccessToken(this.prisma, { organization_id: input.organization_id, proposal_id: p.id, source: 'PORTAL', recipient_email: input.email });
        let access: string | null = null;
        if (p.link_access_mode === 'EMAIL_VERIFIED') {
            const row = await this.prisma.verificationCode.create({
                data: { organization_id: input.organization_id, purpose: 'PROPOSAL_ACCESS', channel: 'EMAIL', proposal_id: p.id, recipient: input.email.toLowerCase(), code_hash: sha256(`portal:${p.id}:${token.token}`), expires_at: new Date(), verified_at: new Date(), ip_address: input.ip ?? null },
                select: { id: true },
            });
            access = row.id;
        }
        await this.audit.record(
            { organization_id: input.organization_id, user_id: input.user_id, membership_id: null, service_account_id: null, api_key_id: null, actor_type: 'USER', channel: 'ui', ip_address: input.ip ?? null, effective: { permissions: {}, modules: [] }, can: () => false, scopeOf: () => null },
            'proposal.portal_link_issued',
            { resource_type: 'proposal', resource_id: p.id, branch_id: p.branch_id, metadata: { via: 'portal', number: p.number } },
        );
        return { path: `/p/${token.token}`, url: this.mailer.appUrl(`/p/${token.token}`), access, token_prefix: token.token.slice(0, 16) };
    }
}
