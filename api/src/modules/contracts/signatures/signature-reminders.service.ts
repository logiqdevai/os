import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommChannel, CommMessageKind, CommMessageStatus, ModuleKey, SignatureEventType, SignatureRequestStatus, SignerStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { MessagesService } from '@/modules/communications/messages/messages.service';
import { ContractMailerService } from '../shared/contract-mailer.service';
import { newToken, sha256 } from '../shared/contracts.utils';

const SEND = 'contracts.signatures.send';
const OPEN: SignatureRequestStatus[] = [SignatureRequestStatus.SENT, SignatureRequestStatus.DELIVERED, SignatureRequestStatus.VIEWED, SignatureRequestStatus.PARTIALLY_SIGNED];
const DAY = 86_400_000;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * 04 §37 — automatic signing reminders. Per request `reminder_settings` ({ frequency_days, max_reminders }):
 * the signers whose turn it is get a reminder every `frequency_days` (at most `max_reminders`), plus one final
 * reminder when the request expires within 48 hours. Delivery goes through 11 Communications (organization's own
 * provider, suppression, history); the job runs as the contract owner and needs contracts.signatures.send.
 * A reminder carries a new single-use link (only hashes are stored), like the manual "Remind".
 */
@Injectable()
export class SignatureRemindersService {
    private readonly logger = new Logger(SignatureRemindersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly messages: MessagesService,
        private readonly mailer: ContractMailerService,
    ) { }

    @Cron(CronExpression.EVERY_HOUR)
    async tick() {
        try {
            const n = await this.run();
            if (n) this.logger.log(`sent signing reminders for ${n} request(s)`);
        } catch (error) {
            this.logger.warn(`signing reminders failed: ${(error as Error).message}`);
        }
    }

    async run(organizationId?: string) {
        const now = Date.now();
        const requests = await this.prisma.signatureRequest.findMany({
            where: { ...(organizationId && { organization_id: organizationId }), status: { in: OPEN }, sent_at: { not: null }, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
            include: {
                contract: { select: { id: true, number: true, title: true, owner_membership_id: true, primary_company_id: true, branch_id: true } },
                signers: { orderBy: { order: 'asc' } },
                events: { where: { type: SignatureEventType.REMINDER_SENT }, orderBy: { occurred_at: 'desc' }, take: 20 },
            },
            take: 500,
        });
        let count = 0;
        for (const r of requests) {
            if (!r.contract) continue;
            const settings = (r.reminder_settings ?? {}) as { frequency_days?: number; max_reminders?: number };
            const every = Math.max(1, Number(settings.frequency_days ?? 3));
            const max = Math.max(0, Number(settings.max_reminders ?? 3));
            const last = Math.max(r.sent_at!.getTime(), r.events[0]?.occurred_at.getTime() ?? 0);
            const expiresSoon = !!r.expires_at && r.expires_at.getTime() - now < 2 * DAY;
            const finalSent = r.events.some((e) => (e.payload as { kind?: string } | null)?.kind === 'expiry');
            const periodic = r.reminders_sent < max && now - last >= every * DAY;
            const final = expiresSoon && !finalSent && now - last >= DAY / 2;
            if (!periodic && !final) continue;
            if (await this.remind(r, final && !periodic ? 'expiry' : 'periodic')) count += 1;
        }
        return count;
    }

    private async remind(
        r: { id: string; organization_id: string; expires_at: Date | null; contract: { id: string; number: string; title: string; owner_membership_id: string | null; primary_company_id: string | null; branch_id: string | null } | null; signers: { id: string; name: string; email: string; order: number; status: SignerStatus }[] },
        kind: 'periodic' | 'expiry',
    ) {
        const contract = r.contract!;
        const ctx = contract.owner_membership_id ? await this.authorization.contextFor({ organization_id: r.organization_id, membership_id: contract.owner_membership_id, channel: 'automation' }) : null;
        if (!ctx?.can(SEND)) return false;
        const pending = r.signers.filter((s) => s.status !== SignerStatus.SIGNED && s.status !== SignerStatus.DECLINED);
        if (!pending.length) return false;
        const turn = Math.min(...pending.map((s) => s.order));
        const org = await this.prisma.organization.findUnique({ where: { id: r.organization_id }, select: { display_name: true } });
        const results: { signer_id: string; email: string; status: string; reason: string | null }[] = [];
        for (const s of pending.filter((p) => p.order === turn)) {
            const token = newToken();
            await this.prisma.signer.update({ where: { id: s.id }, data: { access_token_hash: sha256(token) } });
            const url = this.mailer.appUrl(`/sign/${token}`);
            const expiry = r.expires_at ? r.expires_at.toISOString().slice(0, 10) : null;
            const subject = kind === 'expiry' ? `Last reminder: please sign "${contract.title}"` : `Reminder: please sign "${contract.title}"`;
            const lead = `${org?.display_name ?? 'We'} asked you to sign "${contract.title}" (${contract.number}).${expiry ? ` The signing link expires on ${expiry}.` : ''}`;
            let status = 'FAILED';
            let reason: string | null = null;
            try {
                const msg = await this.messages.create(ctx, {
                    channel: CommChannel.EMAIL, kind: CommMessageKind.TRANSACTIONAL, to_address: s.email, to_name: s.name, company_id: contract.primary_company_id ?? undefined, subject,
                    body_text: `Hello ${s.name},\n\n${lead}\n\nReview and sign: ${url}\n\nYou will confirm your identity with a one-time code before signing.`,
                    body_html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6"><p>Hello ${esc(s.name)},</p><p>${esc(lead)}</p><p><a href="${url}">Review and sign</a></p><p style="font-size:12px;color:#57606a">You will confirm your identity with a one-time code before signing.</p></div>`,
                }, { authorized_by_permission: SEND });
                status = msg.status;
                if (msg.status === CommMessageStatus.FAILED || msg.status === CommMessageStatus.CANCELLED) reason = msg.failure_reason ?? null;
            } catch (error) {
                reason = (error as Error).message;
            }
            results.push({ signer_id: s.id, email: s.email, status, reason });
        }
        await this.prisma.signatureRequest.update({ where: { id: r.id }, data: { reminders_sent: { increment: 1 } } });
        await this.prisma.signatureEvent.createMany({ data: results.map((x) => ({ request_id: r.id, signer_id: x.signer_id, type: SignatureEventType.REMINDER_SENT, payload: { kind, automatic: true, delivery_status: x.status, failure_reason: x.reason } })) });
        await this.audit.record(ctx, 'contract.signature_reminded', { resource_type: 'contract', resource_id: contract.id, metadata: { request_id: r.id, automatic: true, kind, signers: results.map((x) => ({ email: x.email, status: x.status })), channel: 'automation' } });
        this.events.publish(ctx, {
            event_key: 'contracts.signature.reminder_sent', module: ModuleKey.CONTRACTS, entity_kind: 'signature_request', entity_id: r.id,
            payload: { contract_id: contract.id, number: contract.number, title: contract.title, kind, signer_emails: results.map((x) => x.email) },
            activity: { summary: `Signing reminder sent for ${contract.number}`, entity_label: contract.title, company_id: contract.primary_company_id, branch_id: contract.branch_id },
        });
        return true;
    }
}
