import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleKey, ProposalCustomerDecision, ProposalEventType, ProposalLinkAccessMode, ProposalStatus, VerificationChannel, VerificationPurpose } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { LIVE_STATUSES, ProposalsService } from './proposals.service';
import { ProposalMailer } from './proposal-mailer.service';
import { PublicCommentDto, PublicDecisionDto } from './dto/proposal.dto';
import { computeTotals, dateOnly, hashToken, maskEmail, newCode, num, renderVariables } from './utils/proposal.utils';
import { externalContext, RateLimiter } from './utils/system-context.utils';

export interface PublicRequestMeta {
    ip?: string | null;
    user_agent?: string | null;
    /** Verified access id for EMAIL_VERIFIED links (header X-Proposal-Access). */
    access?: string | null;
}

const ACCESS_TTL_MS = 24 * 3_600_000;
const CODE_TTL_MS = 10 * 60_000;

/**
 * Customer-facing proposal link (`/p/:token`). Possession of the unguessable token = read access to the SENT version only.
 * Only the sha256 of the token is stored. Internal sections, internal comments, costs and staff data are never returned.
 */
@Injectable()
export class ProposalPublicService {
    private readonly limiter = new RateLimiter(60, 60_000);
    private readonly codeLimiter = new RateLimiter(5, 15 * 60_000);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly proposals: ProposalsService,
        private readonly mailer: ProposalMailer,
        private readonly config: ConfigService,
    ) { }

    private throttle(meta: PublicRequestMeta) {
        if (!this.limiter.allow(meta.ip ?? 'unknown')) throw new HttpException({ message: 'Too many requests. Try again in a minute.', code: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    private async load(token: string) {
        if (!token || token.length < 20) throw new NotFoundException({ message: 'This link is not valid', code: 'proposal_link_invalid' });
        const p = await this.prisma.proposal.findUnique({
            where: { public_token_hash: hashToken(token) },
            include: {
                organization: { select: { id: true, display_name: true, logo_url: true } },
                company: { select: { name: true } },
                contact: { select: { id: true, first_name: true, last_name: true, email: true } },
            },
        });
        if (!p || !p.sent_version_id) throw new NotFoundException({ message: 'This link is not valid', code: 'proposal_link_invalid' });
        // Lazy expiry (the hourly job does the same for proposals nobody opens).
        if (LIVE_STATUSES.includes(p.status) && p.valid_until && p.valid_until < dateOnly(new Date())) {
            await this.prisma.proposal.update({ where: { id: p.id }, data: { status: ProposalStatus.EXPIRED, expired_at: new Date() } });
            await this.prisma.proposalEvent.create({ data: { proposal_id: p.id, type: ProposalEventType.EXPIRED, metadata: { by: 'system' } } });
            p.status = ProposalStatus.EXPIRED;
        }
        return p;
    }

    private async assertAccess(p: Awaited<ReturnType<ProposalPublicService['load']>>, meta: PublicRequestMeta) {
        if (p.link_access_mode !== ProposalLinkAccessMode.EMAIL_VERIFIED) return true;
        if (!meta.access) return false;
        const code = await this.prisma.verificationCode.findFirst({ where: { id: meta.access, proposal_id: p.id, purpose: VerificationPurpose.PROPOSAL_ACCESS, verified_at: { not: null } } });
        return !!code && (code.verified_at as Date).getTime() + ACCESS_TTL_MS > Date.now();
    }

    private stateOf(status: ProposalStatus) {
        if (status === ProposalStatus.CANCELLED) return 'CANCELLED';
        if (status === ProposalStatus.EXPIRED) return 'EXPIRED';
        if (status === ProposalStatus.ACCEPTED || status === ProposalStatus.REJECTED) return 'DECIDED';
        return 'ACTIVE';
    }

    async view(token: string, meta: PublicRequestMeta) {
        this.throttle(meta);
        const p = await this.load(token);
        const state = this.stateOf(p.status);
        const header = {
            organization: { name: p.organization.display_name, logo_url: p.organization.logo_url },
            proposal: { number: p.number, title: p.title, currency: p.currency, language: p.language, valid_until: p.valid_until, status: p.status, requires_contract: p.requires_contract },
        };
        if (state === 'CANCELLED') return { state, ...header };
        if (!(await this.assertAccess(p, meta))) {
            const email = p.contact?.email;
            return { state: 'VERIFICATION_REQUIRED', ...header, hint: email ? maskEmail(email) : null };
        }

        const version = await this.prisma.proposalVersion.findUniqueOrThrow({
            where: { id: p.sent_version_id as string },
            include: {
                sections: { where: { is_internal: false }, orderBy: { sort_order: 'asc' } },
                line_items: { orderBy: { sort_order: 'asc' } },
                payment_schedule: { orderBy: { sort_order: 'asc' } },
            },
        });
        const vars = (version.variables ?? {}) as Record<string, string>;
        const [decision, comments] = await Promise.all([
            this.prisma.proposalAcceptance.findFirst({ where: { proposal_id: p.id, version_id: version.id }, orderBy: { created_at: 'desc' }, select: { decision: true, signer_name: true, signer_title: true, created_at: true, feedback: true, selected_optional_item_ids: true } }),
            this.prisma.proposalComment.findMany({ where: { proposal_id: p.id, is_internal: false }, orderBy: { created_at: 'asc' }, select: { id: true, body: true, created_at: true, section_id: true, author_contact_id: true, author_membership_id: true } }),
        ]);

        if (state === 'ACTIVE') {
            const recent = await this.prisma.proposalEvent.findFirst({ where: { proposal_id: p.id, type: ProposalEventType.VIEWED, ip_address: meta.ip ?? null, created_at: { gte: new Date(Date.now() - 30 * 60_000) } } });
            const now = new Date();
            await this.prisma.proposal.update({
                where: { id: p.id },
                data: { view_count: { increment: 1 }, last_viewed_at: now, ...(p.first_viewed_at ? {} : { first_viewed_at: now }), ...(p.status === ProposalStatus.SENT && { status: ProposalStatus.VIEWED }) },
            });
            if (!recent) {
                await this.prisma.proposalEvent.create({ data: { proposal_id: p.id, version_id: version.id, type: ProposalEventType.VIEWED, actor_contact_id: p.contact_id, ip_address: meta.ip ?? null, user_agent: meta.user_agent ?? null } });
                if (!p.first_viewed_at) {
                    this.events.publish(externalContext(p.organization_id, meta), {
                        event_key: 'proposals.proposal.viewed', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: p.id,
                        payload: { number: p.number, title: p.title, first_view: true, owner_membership_id: p.owner_membership_id },
                        activity: { summary: `Proposal ${p.number} opened by the customer`, entity_label: p.title, company_id: p.company_id },
                    });
                }
            }
        }

        const lines = version.line_items.map((l) => ({
            id: l.id, group_name: l.group_name, name: l.name, description: l.description, quantity: l.quantity, unit: l.unit, unit_price: l.unit_price,
            discount_percent: l.discount_percent, discount_amount: l.discount_amount, tax_percent: l.tax_percent, net_amount: l.net_amount, tax_amount: l.tax_amount, gross_amount: l.gross_amount,
            is_recurring: l.is_recurring, billing_frequency: l.billing_frequency, is_optional: l.is_optional, selected_by_customer: l.selected_by_customer,
        }));
        return {
            state,
            ...header,
            recipient: { company: p.company?.name ?? null, contact: p.contact ? `${p.contact.first_name} ${p.contact.last_name ?? ''}`.trim() : null, email: p.contact?.email ?? null },
            version: {
                version_number: version.version_number,
                sent_at: version.sent_at,
                payment_terms: renderVariables(version.payment_terms, vars),
                sections: version.sections.map((s) => ({ id: s.id, type: s.type, title: s.title, body: renderVariables(s.body, vars) })),
                line_items: lines,
                payment_schedule: version.payment_schedule.map((s) => ({ name: s.name, trigger: s.trigger, percentage: s.percentage, amount: s.amount, due_date: s.due_date, milestone_name: s.milestone_name, frequency: s.frequency })),
                totals: this.quote(version.line_items, decision?.selected_optional_item_ids ?? version.line_items.filter((l) => l.is_optional && l.selected_by_customer).map((l) => l.id)),
            },
            decision,
            comments: comments.map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, section_id: c.section_id, from: c.author_membership_id ? 'agency' : 'customer' })),
        };
    }

    private quote(lines: { id: string; quantity: unknown; unit_price: unknown; discount_percent: unknown; discount_amount: unknown; tax_percent: unknown; is_optional: boolean; is_recurring: boolean; billing_frequency: string | null }[], selected: string[]) {
        return computeTotals(lines.map((l) => ({
            quantity: num(l.quantity), unit_price: num(l.unit_price), discount_percent: num(l.discount_percent), discount_amount: num(l.discount_amount), tax_percent: num(l.tax_percent),
            is_optional: l.is_optional, is_recurring: l.is_recurring, billing_frequency: l.billing_frequency, selected_by_customer: selected.includes(l.id),
        })));
    }

    private async activeOrThrow(token: string, meta: PublicRequestMeta) {
        this.throttle(meta);
        const p = await this.load(token);
        if (!(await this.assertAccess(p, meta))) throw new ForbiddenException({ message: 'Verify your email first', code: 'proposal_verification_required' });
        if (this.stateOf(p.status) !== 'ACTIVE') throw new ConflictException({ message: p.status === ProposalStatus.EXPIRED ? 'This proposal has expired. Ask for a new one.' : 'A decision was already recorded for this proposal', code: 'proposal_not_active', status: p.status });
        return p;
    }

    private async optionalIds(versionId: string, ids: string[]) {
        const optional = await this.prisma.proposalLineItem.findMany({ where: { version_id: versionId, is_optional: true }, select: { id: true } });
        const allowed = new Set(optional.map((o) => o.id));
        const bad = ids.filter((id) => !allowed.has(id));
        if (bad.length) throw new BadRequestException({ message: 'Only optional items can be selected', code: 'not_optional_item' });
        return [...new Set(ids)];
    }

    /** Price for a selection of optional items (nothing is stored until the customer decides). */
    async select(token: string, ids: string[], meta: PublicRequestMeta) {
        const p = await this.activeOrThrow(token, meta);
        const selected = await this.optionalIds(p.sent_version_id as string, ids);
        const lines = await this.prisma.proposalLineItem.findMany({ where: { version_id: p.sent_version_id as string } });
        await this.prisma.proposalEvent.create({ data: { proposal_id: p.id, version_id: p.sent_version_id, type: ProposalEventType.OPTIONAL_ITEM_TOGGLED, actor_contact_id: p.contact_id, ip_address: meta.ip ?? null, user_agent: meta.user_agent ?? null, metadata: { selected_optional_item_ids: selected } } });
        return { totals: this.quote(lines, selected), selected_optional_item_ids: selected };
    }

    async decide(token: string, dto: PublicDecisionDto, meta: PublicRequestMeta) {
        const p = await this.activeOrThrow(token, meta);
        if (dto.decision === ProposalCustomerDecision.ACCEPTED && !dto.terms_accepted) throw new BadRequestException({ message: 'Please confirm that you accept the terms', code: 'terms_not_accepted' });
        if (dto.decision !== ProposalCustomerDecision.ACCEPTED && !dto.feedback?.trim()) throw new BadRequestException({ message: 'Tell us what you would like to change or why you decline', code: 'feedback_required' });
        const versionId = p.sent_version_id as string;
        const selected = await this.optionalIds(versionId, dto.selected_optional_item_ids ?? []);
        const now = new Date();
        const ctx = externalContext(p.organization_id, meta);
        const status = dto.decision === ProposalCustomerDecision.ACCEPTED ? ProposalStatus.ACCEPTED : dto.decision === ProposalCustomerDecision.REJECTED ? ProposalStatus.REJECTED : ProposalStatus.CHANGES_REQUESTED;
        const eventType = dto.decision === ProposalCustomerDecision.ACCEPTED ? ProposalEventType.ACCEPTED : dto.decision === ProposalCustomerDecision.REJECTED ? ProposalEventType.REJECTED : ProposalEventType.CHANGES_REQUESTED;

        const acceptance = await this.prisma.$transaction(async (tx) => {
            const a = await tx.proposalAcceptance.create({
                data: {
                    proposal_id: p.id, version_id: versionId, decision: dto.decision, contact_id: p.contact_id,
                    signer_name: dto.signer_name.trim(), signer_email: dto.signer_email.toLowerCase(), signer_title: dto.signer_title ?? null,
                    terms_accepted: !!dto.terms_accepted, selected_optional_item_ids: selected, feedback: dto.feedback ?? null,
                    signature_metadata: { method: 'typed_name', typed_name: dto.signer_name.trim(), accepted_at: now.toISOString() },
                    ip_address: meta.ip ?? null, user_agent: meta.user_agent ?? null,
                },
            });
            await tx.proposal.update({
                where: { id: p.id },
                data: {
                    status,
                    ...(status === ProposalStatus.ACCEPTED && { accepted_at: now, accepted_version_id: versionId }),
                    ...(status === ProposalStatus.REJECTED && { rejected_at: now }),
                },
            });
            if (status === ProposalStatus.ACCEPTED) {
                await tx.proposalLineItem.updateMany({ where: { version_id: versionId, is_optional: true }, data: { selected_by_customer: false } });
                if (selected.length) await tx.proposalLineItem.updateMany({ where: { id: { in: selected } }, data: { selected_by_customer: true } });
                await this.proposals.refreshTotals(tx, p.id, versionId);
            }
            if (dto.feedback?.trim()) {
                await tx.proposalComment.create({ data: { proposal_id: p.id, version_id: versionId, author_contact_id: p.contact_id, is_internal: false, body: dto.feedback.trim() } });
            }
            await tx.proposalEvent.create({ data: { proposal_id: p.id, version_id: versionId, type: eventType, actor_contact_id: p.contact_id, ip_address: meta.ip ?? null, user_agent: meta.user_agent ?? null, metadata: { signer_name: dto.signer_name, signer_email: dto.signer_email, acceptance_id: a.id } } });
            if (status === ProposalStatus.ACCEPTED) await tx.proposalEvent.create({ data: { proposal_id: p.id, version_id: versionId, type: ProposalEventType.SIGNED, actor_contact_id: p.contact_id, ip_address: meta.ip ?? null, metadata: { method: 'typed_name', acceptance_id: a.id } } });
            await this.audit.record(ctx, `proposal.customer_${dto.decision.toLowerCase()}`, {
                resource_type: 'proposal', resource_id: p.id,
                metadata: { version_id: versionId, signer_name: dto.signer_name, signer_email: dto.signer_email, selected_optional_item_ids: selected, acceptance_id: a.id, actor: 'customer' },
            }, tx);
            return a;
        });

        const key = status === ProposalStatus.ACCEPTED ? 'accepted' : status === ProposalStatus.REJECTED ? 'rejected' : 'changes_requested';
        this.events.publish(ctx, {
            event_key: `proposals.proposal.${key}`,
            module: ModuleKey.PROPOSALS,
            entity_kind: 'proposal',
            entity_id: p.id,
            payload: { number: p.number, title: p.title, decision: dto.decision, signer_name: dto.signer_name, version_id: versionId, owner_membership_id: p.owner_membership_id, deal_id: p.deal_id, company_id: p.company_id, requires_contract: p.requires_contract },
            activity: { summary: `${dto.signer_name} ${key === 'accepted' ? 'accepted' : key === 'rejected' ? 'declined' : 'requested changes to'} proposal ${p.number}`, entity_label: p.title, company_id: p.company_id },
        });
        return { state: status === ProposalStatus.CHANGES_REQUESTED ? 'ACTIVE' : 'DECIDED', decision: acceptance.decision, recorded_at: acceptance.created_at };
    }

    async comment(token: string, dto: PublicCommentDto, meta: PublicRequestMeta) {
        const p = await this.activeOrThrow(token, meta);
        if (dto.section_id && !(await this.prisma.proposalSection.findFirst({ where: { id: dto.section_id, version_id: p.sent_version_id as string, is_internal: false } }))) {
            throw new NotFoundException({ message: 'Section not found', code: 'reference_not_found' });
        }
        const contactName = p.contact ? `${p.contact.first_name} ${p.contact.last_name ?? ''}`.trim().toLowerCase() : '';
        const isContact = contactName && dto.author_name.trim().toLowerCase() === contactName;
        const c = await this.prisma.proposalComment.create({
            data: { proposal_id: p.id, version_id: p.sent_version_id, section_id: dto.section_id ?? null, author_contact_id: isContact ? p.contact_id : null, is_internal: false, body: isContact ? dto.body : `${dto.author_name.trim()}: ${dto.body}` },
        });
        await this.prisma.proposalEvent.create({ data: { proposal_id: p.id, version_id: p.sent_version_id, type: ProposalEventType.COMMENTED, actor_contact_id: p.contact_id, ip_address: meta.ip ?? null, user_agent: meta.user_agent ?? null, metadata: { comment_id: c.id, author_name: dto.author_name } } });
        this.events.publish(externalContext(p.organization_id, meta), {
            event_key: 'proposals.proposal.customer_commented', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: p.id,
            payload: { number: p.number, comment_id: c.id, author_name: dto.author_name, owner_membership_id: p.owner_membership_id },
        });
        return { id: c.id, body: c.body, created_at: c.created_at, section_id: c.section_id, from: 'customer' };
    }

    // --- EMAIL_VERIFIED links -------------------------------------------------------------------------

    async sendCode(token: string, email: string, meta: PublicRequestMeta) {
        this.throttle(meta);
        const p = await this.load(token);
        if (p.link_access_mode !== ProposalLinkAccessMode.EMAIL_VERIFIED) throw new BadRequestException({ message: 'This link does not need verification', code: 'verification_not_required' });
        if (!this.codeLimiter.allow(`${p.id}:${meta.ip ?? ''}`)) throw new HttpException({ message: 'Too many codes requested. Try again later.', code: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
        const normalized = email.trim().toLowerCase();
        const allowed = new Set([p.contact?.email?.toLowerCase(), ...(await this.prisma.proposalDelivery.findMany({ where: { proposal_id: p.id, recipient_email: { not: null } }, select: { recipient_email: true } })).map((d) => d.recipient_email?.toLowerCase())].filter(Boolean));
        // Same answer whether or not the address is a recipient (no enumeration).
        const response: { sent: true; expires_in_seconds: number; dev_code?: string } = { sent: true, expires_in_seconds: CODE_TTL_MS / 1000 };
        if (!allowed.has(normalized)) return response;
        const code = newCode();
        await this.prisma.verificationCode.create({
            data: { organization_id: p.organization_id, purpose: VerificationPurpose.PROPOSAL_ACCESS, channel: VerificationChannel.EMAIL, proposal_id: p.id, recipient: normalized, code_hash: hashToken(`${p.id}:${code}`), expires_at: new Date(Date.now() + CODE_TTL_MS), ip_address: meta.ip ?? null },
        });
        if (this.mailer.enabled) {
            try {
                await this.mailer.send(normalized, `Your code for proposal ${p.number}`, [`Your verification code is ${code}. It expires in 10 minutes.`, `If you did not ask for it, ignore this email.`]);
            } catch {
                /* the customer can request a new code */
            }
        } else if (this.config.get<string>('NODE_ENV') !== 'production') {
            response.dev_code = code;
        }
        return response;
    }

    async verify(token: string, code: string, meta: PublicRequestMeta) {
        this.throttle(meta);
        const p = await this.load(token);
        const row = await this.prisma.verificationCode.findFirst({ where: { proposal_id: p.id, purpose: VerificationPurpose.PROPOSAL_ACCESS, verified_at: null }, orderBy: { created_at: 'desc' } });
        if (!row || row.expires_at < new Date()) throw new BadRequestException({ message: 'The code expired. Request a new one.', code: 'code_expired' });
        if (row.locked_until && row.locked_until > new Date()) throw new HttpException({ message: 'Too many wrong attempts. Request a new code later.', code: 'code_locked' }, HttpStatus.TOO_MANY_REQUESTS);
        if (row.code_hash !== hashToken(`${p.id}:${code.trim()}`)) {
            const attempts = row.attempts + 1;
            await this.prisma.verificationCode.update({ where: { id: row.id }, data: { attempts, ...(attempts >= row.max_attempts && { locked_until: new Date(Date.now() + 15 * 60_000) }) } });
            throw new BadRequestException({ message: 'That code is not correct', code: 'code_invalid', attempts_left: Math.max(0, row.max_attempts - attempts) });
        }
        await this.prisma.verificationCode.update({ where: { id: row.id }, data: { verified_at: new Date(), ip_address: meta.ip ?? null } });
        return { access: row.id, expires_in_seconds: ACCESS_TTL_MS / 1000 };
    }
}
