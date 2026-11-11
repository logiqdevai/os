import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContractApprovalDecision, ContractReviewDecision, ContractStatus, ContractVersionStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { ContractsService } from '../contracts/contracts.service';
import { INTERNAL_COMMENTS_READ, MEMBER_SELECT, matchesConditions, sectionsHash } from '../shared/contracts.utils';
import {
    ApprovalDecisionDto, CommentsQuery, CompareQuery, CreateCommentDto, CreateVersionDto, RequestReviewDto, ResolveCommentDto, ReviewDecisionDto, SubmitApprovalDto, UpdateSectionsDto, UpdateVersionDto,
} from './dto/version.dto';

type DiffLine = { op: 'same' | 'add' | 'del'; text: string };

/** Line diff (LCS) — section bodies are small enough for O(n·m). */
function lineDiff(a: string, b: string): DiffLine[] {
    const x = a.split('\n'), y = b.split('\n');
    const n = x.length, m = y.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out: DiffLine[] = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
        if (x[i] === y[j]) { out.push({ op: 'same', text: x[i] }); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: 'del', text: x[i++] });
        else out.push({ op: 'add', text: y[j++] });
    }
    while (i < n) out.push({ op: 'del', text: x[i++] });
    while (j < m) out.push({ op: 'add', text: y[j++] });
    return out;
}

const EDITABLE_CONTRACT: ContractStatus[] = [ContractStatus.DRAFT, ContractStatus.INTERNAL_REVIEW, ContractStatus.CUSTOMER_REVIEW, ContractStatus.APPROVAL_REQUIRED, ContractStatus.READY_FOR_SIGNATURE];

/**
 * 04 §19–29 — contract versions and sections, compare, review requests, approval chain, comments.
 * Approvals and reviews are bound to one exact version (approving v0.2 never approves v0.3).
 */
@Injectable()
export class ContractVersionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly contracts: ContractsService,
    ) { }

    private async loadVersion(ctx: OrgContext, contractId: string, versionId: string) {
        const contract = await this.contracts.assertContract(ctx, contractId);
        const version = await this.prisma.contractVersion.findFirst({ where: { id: versionId, contract_id: contractId } });
        if (!version) throw new NotFoundException({ message: 'Version not found', code: 'contract_version_not_found' });
        return { contract, version };
    }

    async getVersion(ctx: OrgContext, contractId: string, versionId: string) {
        await this.loadVersion(ctx, contractId, versionId);
        const v = await this.prisma.contractVersion.findUniqueOrThrow({
            where: { id: versionId },
            include: {
                sections: { orderBy: { sort_order: 'asc' }, include: { clause_version: { select: { id: true, version_number: true, clause: { select: { id: true, key: true, name: true } } } } } },
                approvals: { orderBy: [{ step: 'asc' }, { requested_at: 'asc' }], include: { approver: { select: MEMBER_SELECT } } },
                reviews: { orderBy: { requested_at: 'asc' }, include: { reviewer: { select: MEMBER_SELECT }, reviewer_contact: { select: { id: true, first_name: true, last_name: true, email: true } } } },
                template_version: { select: { id: true, version_number: true, template: { select: { id: true, name: true } } } },
                signature_requests: { orderBy: { created_at: 'desc' }, select: { id: true, status: true, created_at: true, completed_at: true } },
            },
        });
        const blocking = await this.prisma.contractComment.count({ where: { version_id: versionId, is_blocking: true, resolved_at: null } });
        return { ...v, unresolved_blocking_comments: blocking, editable: v.status === ContractVersionStatus.DRAFT };
    }

    /** New draft version from the current one (or restore an older one). Signed/active contracts need an amendment instead. */
    async createVersion(ctx: OrgContext, contractId: string, dto: CreateVersionDto) {
        const contract = await this.contracts.assertContract(ctx, contractId);
        if (!EDITABLE_CONTRACT.includes(contract.status)) {
            throw new ConflictException({ message: 'This contract is signed or closed. Create an amendment to change it.', code: 'contract_not_editable' });
        }
        const sourceId = dto.from_version_id ?? contract.current_version_id;
        const source = sourceId ? await this.prisma.contractVersion.findFirst({ where: { id: sourceId, contract_id: contractId } }) : null;
        if (dto.from_version_id && !source) throw new NotFoundException({ message: 'Source version not found', code: 'contract_version_not_found' });
        if (contract.current_version_id) {
            const current = await this.prisma.contractVersion.findUnique({ where: { id: contract.current_version_id } });
            if (current?.status === ContractVersionStatus.LOCKED_FOR_SIGNATURE) {
                throw new ConflictException({ message: 'The current version is out for signature. Cancel the signature request first.', code: 'version_locked' });
            }
        }
        const sections = await this.contracts.copySections(source?.id ?? null);
        const last = await this.prisma.contractVersion.findFirst({ where: { contract_id: contractId }, orderBy: { version_number: 'desc' } });
        const n = (last?.version_number ?? 0) + 1;
        const version = await this.prisma.$transaction(async (tx) => {
            if (contract.current_version_id) {
                await tx.contractVersion.updateMany({
                    where: { id: contract.current_version_id, status: { in: [ContractVersionStatus.DRAFT, ContractVersionStatus.IN_REVIEW, ContractVersionStatus.APPROVED] } },
                    data: { status: ContractVersionStatus.SUPERSEDED },
                });
            }
            const v = await tx.contractVersion.create({
                data: {
                    contract_id: contractId, version_number: n, label: `v0.${n}`, parent_version_id: source?.id, status: ContractVersionStatus.DRAFT,
                    change_summary: dto.change_summary ?? (dto.from_version_id && source ? `Restored from ${source.label}` : null),
                    template_version_id: source?.template_version_id, variables: (source?.variables ?? undefined) as Prisma.InputJsonValue,
                    content_hash: sectionsHash(sections), created_by_user_id: ctx.user_id,
                    sections: { create: sections.map((s) => ({ key: s.key, title: s.title, body: s.body, clause_version_id: s.clause_version_id ?? null, is_appendix: s.is_appendix ?? false, sort_order: s.sort_order })) },
                },
            });
            await tx.contract.update({ where: { id: contractId }, data: { current_version_id: v.id, status: ContractStatus.DRAFT } });
            return v;
        });
        await this.audit.record(ctx, 'contract.version_created', { resource_type: 'contract', resource_id: contractId, metadata: { version_id: version.id, label: version.label, from_version_id: source?.id } });
        this.events.publish(ctx, { event_key: 'contracts.version.created', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId, payload: { number: contract.number, version_id: version.id, label: version.label, owner_membership_id: contract.owner_membership_id } });
        return this.getVersion(ctx, contractId, version.id);
    }

    async updateVersion(ctx: OrgContext, contractId: string, versionId: string, dto: UpdateVersionDto) {
        await this.loadVersion(ctx, contractId, versionId);
        await this.prisma.contractVersion.update({ where: { id: versionId }, data: dto });
        await this.audit.record(ctx, 'contract.version_updated', { resource_type: 'contract', resource_id: contractId, metadata: { version_id: versionId, after: dto } });
        return this.getVersion(ctx, contractId, versionId);
    }

    /** Replace the sections of a DRAFT version (autosave). Signed / locked versions are immutable (04 §39). */
    async updateSections(ctx: OrgContext, contractId: string, versionId: string, dto: UpdateSectionsDto) {
        const { contract, version } = await this.loadVersion(ctx, contractId, versionId);
        if (version.status !== ContractVersionStatus.DRAFT) {
            throw new ConflictException({ message: `Version ${version.label} is ${version.status.toLowerCase().replace(/_/g, ' ')} and cannot be edited. Create a new version.`, code: 'version_not_editable' });
        }
        const keys = new Set<string>();
        for (const s of dto.sections) {
            if (keys.has(s.key)) throw new BadRequestException({ message: `Duplicate section key "${s.key}"`, code: 'duplicate_section_key' });
            keys.add(s.key);
        }
        const clauseIds = dto.sections.map((s) => s.clause_version_id).filter(Boolean) as string[];
        if (clauseIds.length) {
            const ok = await this.prisma.contractClauseVersion.count({ where: { id: { in: clauseIds }, clause: { organization_id: ctx.organization_id } } });
            if (ok !== new Set(clauseIds).size) throw new NotFoundException({ message: 'Clause version not found', code: 'clause_version_not_found' });
        }
        const sections = dto.sections.map((s, i) => ({ ...s, body: s.body ?? '', sort_order: i }));
        const before = await this.prisma.contractSection.findMany({ where: { version_id: versionId }, select: { key: true } });
        await this.prisma.$transaction(async (tx) => {
            // Keep section ids stable (comments and obligations point at them): upsert by key, delete the rest.
            const existing = await tx.contractSection.findMany({ where: { version_id: versionId } });
            for (const s of sections) {
                const row = existing.find((e) => e.key === s.key);
                const data = { title: s.title, body: s.body, clause_version_id: s.clause_version_id ?? null, is_appendix: s.is_appendix ?? false, sort_order: s.sort_order };
                if (row) await tx.contractSection.update({ where: { id: row.id }, data });
                else await tx.contractSection.create({ data: { ...data, version_id: versionId, key: s.key } });
            }
            await tx.contractSection.deleteMany({ where: { version_id: versionId, key: { notIn: sections.map((s) => s.key) } } });
            await tx.contractVersion.update({ where: { id: versionId }, data: { content_hash: sectionsHash(sections) } });
        });
        await this.audit.record(ctx, 'contract.sections_updated', {
            resource_type: 'contract', resource_id: contractId,
            metadata: { version_id: versionId, sections: sections.length, removed: before.filter((b) => !keys.has(b.key)).map((b) => b.key), added: [...keys].filter((k) => !before.some((b) => b.key === k)) },
        });
        this.events.publish(ctx, { event_key: 'contracts.version.updated', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId, payload: { number: contract.number, version_id: versionId, owner_membership_id: contract.owner_membership_id } });
        return this.getVersion(ctx, contractId, versionId);
    }

    async compare(ctx: OrgContext, contractId: string, query: CompareQuery) {
        await this.contracts.assertContract(ctx, contractId);
        const [from, to] = await Promise.all(
            [query.from, query.to].map((id) => this.prisma.contractVersion.findFirst({ where: { id, contract_id: contractId }, include: { sections: { orderBy: { sort_order: 'asc' } } } })),
        );
        if (!from || !to) throw new NotFoundException({ message: 'Version not found', code: 'contract_version_not_found' });
        const keys = [...new Set([...from.sections.map((s) => s.key), ...to.sections.map((s) => s.key)])];
        const sections = keys.map((key) => {
            const a = from.sections.find((s) => s.key === key);
            const b = to.sections.find((s) => s.key === key);
            const status = !a ? 'added' : !b ? 'removed' : a.title === b.title && (a.body ?? '') === (b.body ?? '') ? 'same' : 'changed';
            return {
                key, status, title: b?.title ?? a?.title ?? key, from_title: a?.title ?? null, to_title: b?.title ?? null,
                diff: status === 'changed' ? lineDiff(a?.body ?? '', b?.body ?? '') : status === 'added' ? lineDiff('', b?.body ?? '') : status === 'removed' ? lineDiff(a?.body ?? '', '') : [],
            };
        });
        const pick = (v: typeof from) => ({ id: v.id, label: v.label, version_number: v.version_number, status: v.status, content_hash: v.content_hash, created_at: v.created_at });
        return {
            from: pick(from), to: pick(to), sections,
            summary: { added: sections.filter((s) => s.status === 'added').length, removed: sections.filter((s) => s.status === 'removed').length, changed: sections.filter((s) => s.status === 'changed').length, same: sections.filter((s) => s.status === 'same').length },
        };
    }

    // --- Review ------------------------------------------------------------------------------

    async requestReview(ctx: OrgContext, contractId: string, versionId: string, dto: RequestReviewDto) {
        const { contract, version } = await this.loadVersion(ctx, contractId, versionId);
        if (!([ContractVersionStatus.DRAFT, ContractVersionStatus.IN_REVIEW] as ContractVersionStatus[]).includes(version.status)) {
            throw new ConflictException({ message: 'Only draft versions can be sent for review', code: 'version_not_reviewable' });
        }
        const members = dto.reviewer_membership_ids ?? [];
        const contacts = dto.reviewer_contact_ids ?? [];
        if (!members.length && !contacts.length) throw new BadRequestException({ message: 'Choose at least one reviewer', code: 'reviewers_required' });
        const [mCount, cCount] = await Promise.all([
            members.length ? this.prisma.membership.count({ where: { id: { in: members }, organization_id: ctx.organization_id } }) : 0,
            contacts.length ? this.prisma.crmContact.count({ where: { id: { in: contacts }, organization_id: ctx.organization_id } }) : 0,
        ]);
        if (mCount !== new Set(members).size || cCount !== new Set(contacts).size) throw new NotFoundException({ message: 'Reviewer not found', code: 'reviewer_not_found' });
        const due = dto.due_at ? new Date(dto.due_at) : null;
        await this.prisma.$transaction([
            ...members.map((m) => this.prisma.contractReview.create({ data: { version_id: versionId, reviewer_membership_id: m, is_internal: true, comment: dto.comment, requested_by_user_id: ctx.user_id, due_at: due } })),
            ...contacts.map((c) => this.prisma.contractReview.create({ data: { version_id: versionId, reviewer_contact_id: c, is_internal: false, comment: dto.comment, requested_by_user_id: ctx.user_id, due_at: due } })),
            this.prisma.contractVersion.update({ where: { id: versionId }, data: { status: ContractVersionStatus.IN_REVIEW } }),
            this.prisma.contract.update({ where: { id: contractId }, data: { status: members.length ? ContractStatus.INTERNAL_REVIEW : ContractStatus.CUSTOMER_REVIEW } }),
        ]);
        await this.audit.record(ctx, 'contract.review_requested', { resource_type: 'contract', resource_id: contractId, metadata: { version_id: versionId, reviewer_membership_ids: members, reviewer_contact_ids: contacts, due_at: dto.due_at } });
        this.events.publish(ctx, {
            event_key: 'contracts.contract.review_requested', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId,
            payload: { number: contract.number, title: contract.title, version_id: versionId, label: version.label, owner_membership_id: contract.owner_membership_id, approver_membership_ids: members, reviewer_contact_ids: contacts },
        });
        return this.getVersion(ctx, contractId, versionId);
    }

    async decideReview(ctx: OrgContext, contractId: string, reviewId: string, dto: ReviewDecisionDto) {
        const contract = await this.contracts.assertContract(ctx, contractId);
        const review = await this.prisma.contractReview.findFirst({ where: { id: reviewId, version: { contract_id: contractId } }, include: { version: true } });
        if (!review) throw new NotFoundException({ message: 'Review not found', code: 'contract_review_not_found' });
        if (review.reviewer_membership_id !== ctx.membership_id) throw new ForbiddenException({ message: 'Only the requested reviewer can decide this review', code: 'not_the_reviewer' });
        if (review.decision !== ContractReviewDecision.PENDING) throw new ConflictException({ message: 'This review was already decided', code: 'review_decided' });
        await this.prisma.contractReview.update({ where: { id: reviewId }, data: { decision: dto.decision, comment: dto.comment ?? review.comment, decided_at: new Date() } });
        if (dto.decision !== 'APPROVED' && review.version.status === ContractVersionStatus.IN_REVIEW) {
            await this.prisma.$transaction([
                this.prisma.contractVersion.update({ where: { id: review.version_id }, data: { status: ContractVersionStatus.DRAFT } }),
                this.prisma.contract.update({ where: { id: contractId }, data: { status: ContractStatus.DRAFT } }),
            ]);
        }
        await this.audit.record(ctx, 'contract.review_decided', { resource_type: 'contract', resource_id: contractId, metadata: { review_id: reviewId, version_id: review.version_id, decision: dto.decision, comment: dto.comment } });
        this.events.publish(ctx, {
            event_key: 'contracts.contract.review_decided', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId,
            payload: { number: contract.number, title: contract.title, decision: dto.decision, owner_membership_id: contract.owner_membership_id },
        });
        return this.getVersion(ctx, contractId, review.version_id);
    }

    // --- Approval ------------------------------------------------------------------------------

    /** Which approval steps a version would need (matching rules by priority, else the contract type workflow). */
    async approvalPreview(ctx: OrgContext, contractId: string, versionId: string) {
        const { contract } = await this.loadVersion(ctx, contractId, versionId);
        const term = contract.start_date && contract.end_date ? Math.round((contract.end_date.getTime() - contract.start_date.getTime()) / (30.44 * 86_400_000)) : null;
        const facts: Record<string, unknown> = {
            total_value: contract.total_value?.toNumber() ?? null, one_time_value: contract.one_time_value?.toNumber() ?? null, recurring_value: contract.recurring_value?.toNumber() ?? null,
            type_id: contract.type_id, risk_level: contract.risk_level, renewal_type: contract.renewal_type, relation_kind: contract.relation_kind, currency: contract.currency,
            processes_personal_data: contract.processes_personal_data, term_months: term,
        };
        const rules = await this.prisma.contractApprovalRule.findMany({ where: { organization_id: ctx.organization_id, enabled: true }, orderBy: { priority: 'asc' } });
        const matched = rules.filter((r) => matchesConditions(r.conditions, facts));
        let source: 'rules' | 'type' | 'none' = matched.length ? 'rules' : 'none';
        let rawSteps: { step: number; name?: string; approver: { membership_id?: string; team_id?: string }; rule_id?: string; rule_name?: string }[] =
            matched.flatMap((r) => ((r.steps as unknown as { step: number; name?: string; approver: { membership_id?: string; team_id?: string } }[]) ?? []).map((s) => ({ ...s, rule_id: r.id, rule_name: r.name })));
        if (!rawSteps.length && contract.type_id) {
            const type = await this.prisma.contractType.findUnique({ where: { id: contract.type_id } });
            const wf = (Array.isArray(type?.approval_workflow) ? type!.approval_workflow : []) as unknown as typeof rawSteps;
            if (wf.length) { rawSteps = wf; source = 'type'; }
        }
        const steps: { step: number; step_name: string | null; approver_membership_id: string; rule_id: string | null; rule_name: string | null }[] = [];
        for (const s of rawSteps) {
            let membershipId = s.approver?.membership_id ?? null;
            if (!membershipId && s.approver?.team_id) {
                const lead = await this.prisma.teamMembership.findFirst({ where: { team_id: s.approver.team_id, ended_at: null, team: { organization_id: ctx.organization_id } }, orderBy: [{ is_lead: 'desc' }, { created_at: 'asc' }] });
                membershipId = lead?.membership_id ?? null;
            }
            if (!membershipId) continue;
            if (!steps.some((x) => x.step === s.step && x.approver_membership_id === membershipId)) {
                steps.push({ step: s.step, step_name: s.name ?? null, approver_membership_id: membershipId, rule_id: s.rule_id ?? null, rule_name: s.rule_name ?? null });
            }
        }
        steps.sort((a, b) => a.step - b.step);
        const members = await this.prisma.membership.findMany({ where: { id: { in: steps.map((s) => s.approver_membership_id) } }, select: MEMBER_SELECT });
        return {
            source, matched_rules: matched.map((r) => ({ id: r.id, name: r.name })),
            steps: steps.map((s) => ({ ...s, approver: members.find((m) => m.id === s.approver_membership_id) ?? null })),
        };
    }

    async submitForApproval(ctx: OrgContext, contractId: string, versionId: string, dto: SubmitApprovalDto) {
        const { contract, version } = await this.loadVersion(ctx, contractId, versionId);
        if (contract.current_version_id !== versionId) throw new ConflictException({ message: 'Only the current version can be submitted', code: 'version_not_current' });
        if (!([ContractVersionStatus.DRAFT, ContractVersionStatus.IN_REVIEW] as ContractVersionStatus[]).includes(version.status)) {
            throw new ConflictException({ message: `Version ${version.label} is already ${version.status.toLowerCase().replace(/_/g, ' ')}`, code: 'version_not_submittable' });
        }
        const type = contract.type_id ? await this.prisma.contractType.findUnique({ where: { id: contract.type_id } }) : null;
        const required = (Array.isArray(type?.required_metadata) ? type!.required_metadata : []) as string[];
        const missing = required.filter((k) => { const v = (contract as Record<string, unknown>)[k]; return v === null || v === undefined || v === ''; });
        if (missing.length) throw new BadRequestException({ message: `Fill in the required fields first: ${missing.join(', ')}`, code: 'required_metadata_missing', missing });

        let steps: { step: number; step_name: string | null; approver_membership_id: string; rule_id: string | null }[];
        if (dto.steps?.length) {
            const ids = [...new Set(dto.steps.map((s) => s.approver_membership_id))];
            const ok = await this.prisma.membership.count({ where: { id: { in: ids }, organization_id: ctx.organization_id } });
            if (ok !== ids.length) throw new NotFoundException({ message: 'Approver not found', code: 'approver_not_found' });
            steps = dto.steps.map((s) => ({ step: s.step, step_name: s.step_name ?? null, approver_membership_id: s.approver_membership_id, rule_id: null }));
        } else {
            steps = (await this.approvalPreview(ctx, contractId, versionId)).steps;
        }

        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.contractApproval.deleteMany({ where: { version_id: versionId, decision: { not: ContractApprovalDecision.APPROVED } } });
            for (const s of steps) {
                await tx.contractApproval.upsert({
                    where: { version_id_approver_membership_id_step: { version_id: versionId, approver_membership_id: s.approver_membership_id, step: s.step } },
                    update: {},
                    create: { version_id: versionId, step: s.step, step_name: s.step_name, approver_membership_id: s.approver_membership_id, rule_id: s.rule_id, comment: null, requested_at: now },
                });
            }
            if (!steps.length) {
                await tx.contractVersion.update({ where: { id: versionId }, data: { status: ContractVersionStatus.APPROVED, approved_at: now } });
                await tx.contract.update({ where: { id: contractId }, data: { status: ContractStatus.READY_FOR_SIGNATURE, approval_date: now } });
            } else {
                await tx.contractVersion.update({ where: { id: versionId }, data: { status: ContractVersionStatus.IN_REVIEW } });
                await tx.contract.update({ where: { id: contractId }, data: { status: ContractStatus.APPROVAL_REQUIRED } });
            }
        });
        await this.audit.record(ctx, 'contract.approval_requested', { resource_type: 'contract', resource_id: contractId, metadata: { version_id: versionId, steps, comment: dto.comment, auto_approved: !steps.length } });
        if (steps.length) {
            const first = Math.min(...steps.map((s) => s.step));
            this.events.publish(ctx, {
                event_key: 'contracts.contract.approval_requested', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId,
                payload: { number: contract.number, title: contract.title, version_id: versionId, label: version.label, step: first, owner_membership_id: contract.owner_membership_id, approver_membership_ids: steps.filter((s) => s.step === first).map((s) => s.approver_membership_id) },
            });
        } else {
            this.events.publish(ctx, { event_key: 'contracts.contract.approved', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId, payload: { number: contract.number, title: contract.title, version_id: versionId, owner_membership_id: contract.owner_membership_id, auto: true } });
        }
        return this.getVersion(ctx, contractId, versionId);
    }

    async decideApproval(ctx: OrgContext, contractId: string, approvalId: string, dto: ApprovalDecisionDto) {
        const contract = await this.contracts.assertContract(ctx, contractId);
        const approval = await this.prisma.contractApproval.findFirst({ where: { id: approvalId, version: { contract_id: contractId } }, include: { version: true } });
        if (!approval) throw new NotFoundException({ message: 'Approval not found', code: 'contract_approval_not_found' });
        if (approval.approver_membership_id !== ctx.membership_id) throw new ForbiddenException({ message: 'Only the assigned approver can decide this step', code: 'not_the_approver' });
        if (approval.decision !== ContractApprovalDecision.PENDING) throw new ConflictException({ message: 'This approval was already decided', code: 'approval_decided' });
        if (approval.version.status !== ContractVersionStatus.IN_REVIEW) throw new ConflictException({ message: 'This version is no longer awaiting approval', code: 'version_not_in_approval' });
        const earlierPending = await this.prisma.contractApproval.count({ where: { version_id: approval.version_id, step: { lt: approval.step }, decision: ContractApprovalDecision.PENDING } });
        if (earlierPending) throw new ConflictException({ message: 'An earlier approval step is still pending', code: 'approval_step_not_current' });

        const now = new Date();
        await this.prisma.contractApproval.update({ where: { id: approvalId }, data: { decision: dto.decision, comment: dto.comment, decided_at: now } });
        let outcome: 'approved' | 'rejected' | 'next_step' = 'next_step';
        let nextApprovers: string[] = [];
        let nextStep: number | null = null;
        if (dto.decision === 'REJECTED') {
            outcome = 'rejected';
            await this.prisma.$transaction([
                this.prisma.contractVersion.update({ where: { id: approval.version_id }, data: { status: ContractVersionStatus.DRAFT } }),
                this.prisma.contract.update({ where: { id: contractId }, data: { status: ContractStatus.DRAFT } }),
            ]);
        } else {
            const pending = await this.prisma.contractApproval.findMany({ where: { version_id: approval.version_id, decision: ContractApprovalDecision.PENDING }, orderBy: { step: 'asc' } });
            if (!pending.length) {
                outcome = 'approved';
                await this.prisma.$transaction([
                    this.prisma.contractVersion.update({ where: { id: approval.version_id }, data: { status: ContractVersionStatus.APPROVED, approved_at: now } }),
                    this.prisma.contract.update({ where: { id: contractId }, data: { status: ContractStatus.READY_FOR_SIGNATURE, approval_date: now } }),
                ]);
            } else if (pending[0].step > approval.step) {
                nextStep = pending[0].step;
                nextApprovers = pending.filter((p) => p.step === nextStep).map((p) => p.approver_membership_id);
            }
        }
        await this.audit.record(ctx, `contract.approval_${dto.decision.toLowerCase()}`, { resource_type: 'contract', resource_id: contractId, metadata: { approval_id: approvalId, version_id: approval.version_id, step: approval.step, comment: dto.comment } });
        const base = { number: contract.number, title: contract.title, version_id: approval.version_id, owner_membership_id: contract.owner_membership_id };
        if (outcome === 'rejected') this.events.publish(ctx, { event_key: 'contracts.contract.approval_rejected', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId, payload: { ...base, comment: dto.comment } });
        if (outcome === 'approved') this.events.publish(ctx, { event_key: 'contracts.contract.approved', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId, payload: base, activity: { summary: `Contract ${contract.number} approved`, entity_label: contract.title, company_id: contract.primary_company_id } });
        if (nextApprovers.length) this.events.publish(ctx, { event_key: 'contracts.contract.approval_requested', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId, payload: { ...base, step: nextStep, approver_membership_ids: nextApprovers } });
        return this.getVersion(ctx, contractId, approval.version_id);
    }

    /** Approvals waiting on me (approver inbox). */
    async myApprovals(ctx: OrgContext) {
        if (!ctx.membership_id) return { data: [] };
        const rows = await this.prisma.contractApproval.findMany({
            where: { approver_membership_id: ctx.membership_id, decision: ContractApprovalDecision.PENDING, version: { status: ContractVersionStatus.IN_REVIEW, contract: { organization_id: ctx.organization_id } } },
            orderBy: { requested_at: 'asc' },
            include: { version: { select: { id: true, label: true, contract: { select: { id: true, number: true, title: true, status: true } } } } },
        });
        return { data: rows };
    }

    // --- Comments ------------------------------------------------------------------------------

    async listComments(ctx: OrgContext, contractId: string, query: CommentsQuery) {
        const contract = await this.contracts.assertContract(ctx, contractId);
        const rows = await this.prisma.contractComment.findMany({
            where: {
                version: { contract_id: contractId },
                ...(query.version_id && { version_id: query.version_id }),
                ...(query.section_id && { section_id: query.section_id }),
                ...(query.resolved === true && { resolved_at: { not: null } }),
                ...(query.resolved === false && { resolved_at: null }),
                ...(!ctx.can(INTERNAL_COMMENTS_READ) && { is_internal: false }),
            },
            orderBy: { created_at: 'asc' },
            include: { author: { select: MEMBER_SELECT }, section: { select: { id: true, key: true, title: true } }, version: { select: { id: true, label: true } } },
        });
        return { data: rows, current_version_id: contract.current_version_id };
    }

    async createComment(ctx: OrgContext, contractId: string, dto: CreateCommentDto) {
        const contract = await this.contracts.assertContract(ctx, contractId);
        const isInternal = dto.is_internal ?? true;
        if (isInternal && !ctx.can(INTERNAL_COMMENTS_READ)) throw new ForbiddenException({ message: 'You cannot write internal comments', code: 'internal_comments_forbidden' });
        const versionId = dto.version_id ?? contract.current_version_id;
        const version = versionId ? await this.prisma.contractVersion.findFirst({ where: { id: versionId, contract_id: contractId } }) : null;
        if (!version) throw new NotFoundException({ message: 'Version not found', code: 'contract_version_not_found' });
        if (dto.section_id && !(await this.prisma.contractSection.findFirst({ where: { id: dto.section_id, version_id: version.id } }))) {
            throw new NotFoundException({ message: 'Section not found in this version', code: 'section_not_found' });
        }
        if (dto.parent_comment_id) {
            const parent = await this.prisma.contractComment.findFirst({ where: { id: dto.parent_comment_id, version_id: version.id } });
            if (!parent || parent.is_internal !== isInternal) throw new BadRequestException({ message: 'Replies must stay in the same thread and visibility', code: 'invalid_parent_comment' });
        }
        const row = await this.prisma.contractComment.create({
            data: { version_id: version.id, section_id: dto.section_id, parent_comment_id: dto.parent_comment_id, author_membership_id: ctx.membership_id, author_user_id: ctx.user_id, is_internal: isInternal, is_blocking: dto.is_blocking ?? false, body: dto.body },
            include: { author: { select: MEMBER_SELECT }, section: { select: { id: true, key: true, title: true } } },
        });
        await this.audit.record(ctx, 'contract.comment_created', { resource_type: 'contract', resource_id: contractId, metadata: { comment_id: row.id, version_id: version.id, is_internal: isInternal, is_blocking: row.is_blocking } });
        this.events.publish(ctx, { event_key: 'contracts.comment.created', module: ModuleKey.CONTRACTS, entity_kind: 'contract', entity_id: contractId, payload: { number: contract.number, comment_id: row.id, is_internal: isInternal, is_blocking: row.is_blocking, owner_membership_id: contract.owner_membership_id } });
        return row;
    }

    async resolveComment(ctx: OrgContext, contractId: string, commentId: string, dto: ResolveCommentDto) {
        await this.contracts.assertContract(ctx, contractId);
        const c = await this.prisma.contractComment.findFirst({ where: { id: commentId, version: { contract_id: contractId } } });
        if (!c || (c.is_internal && !ctx.can(INTERNAL_COMMENTS_READ))) throw new NotFoundException({ message: 'Comment not found', code: 'comment_not_found' });
        const row = await this.prisma.contractComment.update({ where: { id: commentId }, data: dto.resolved ? { resolved_at: new Date(), resolved_by_user_id: ctx.user_id } : { resolved_at: null, resolved_by_user_id: null } });
        await this.audit.record(ctx, dto.resolved ? 'contract.comment_resolved' : 'contract.comment_reopened', { resource_type: 'contract', resource_id: contractId, metadata: { comment_id: commentId } });
        return row;
    }

    /** Used by the signature service before locking a version. */
    async assertReadyForSignature(versionId: string) {
        const blocking = await this.prisma.contractComment.count({ where: { version_id: versionId, is_blocking: true, resolved_at: null } });
        if (blocking) throw new ConflictException({ message: `Resolve ${blocking} blocking comment(s) before sending for signature`, code: 'blocking_comments' });
        const pending = await this.prisma.contractApproval.count({ where: { version_id: versionId, decision: { not: ContractApprovalDecision.APPROVED } } });
        if (pending) throw new ConflictException({ message: 'This version still has approvals that are not approved', code: 'approval_incomplete' });
    }
}
