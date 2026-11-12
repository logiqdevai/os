import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommChannel, CommMessageKind, CommMessageStatus, ModuleKey, ProposalDeliveryChannel, ProposalDeliveryStatus, ProposalEventType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { MessagesService } from '@/modules/communications/messages/messages.service';
import { ProposalMailer } from './proposal-mailer.service';
import { LIVE_STATUSES } from './proposals.service';
import { dateOnly, escapeHtml, issueAccessToken } from './utils/proposal.utils';

const SEND = 'proposals.proposals.send';
/** Marker in ProposalDelivery.message that makes each reminder idempotent per version and day offset. */
const marker = (versionId: string, days: number) => `[reminder:${versionId}:${days}d]`;

/**
 * 03 "Proposal Tracking" — customer reminders before a proposal expires. For every live proposal whose
 * `valid_until` is exactly one of `reminder_days` away, the customer recipients get one reminder email through
 * 11 Communications (the organization's own Resend connection, suppression + history there; never raw email).
 * Runs as the proposal owner and only when the owner holds proposals.proposals.send. The email carries a fresh
 * customer link (only token hashes are stored, so the previous link stops working — same rule as "New customer link").
 */
@Injectable()
export class ProposalRemindersService {
    private readonly logger = new Logger(ProposalRemindersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly messages: MessagesService,
        private readonly mailer: ProposalMailer,
    ) { }

    @Cron(CronExpression.EVERY_HOUR)
    async tick() {
        try {
            const sent = await this.run();
            if (sent) this.logger.log(`sent ${sent} proposal reminder(s)`);
        } catch (error) {
            this.logger.warn(`proposal reminders failed: ${(error as Error).message}`);
        }
    }

    /** Send due reminders (optionally for one organization). Returns the number of proposals reminded. */
    async run(organizationId?: string) {
        const today = dateOnly(new Date());
        const candidates = await this.prisma.proposal.findMany({
            where: {
                ...(organizationId && { organization_id: organizationId }),
                status: { in: LIVE_STATUSES },
                archived_at: null,
                sent_version_id: { not: null },
                valid_until: { gte: today, lte: new Date(today.getTime() + 60 * 86_400_000) },
                NOT: { reminder_days: { isEmpty: true } },
            },
            select: { id: true, organization_id: true, number: true, title: true, valid_until: true, reminder_days: true, sent_version_id: true, owner_membership_id: true, contact_id: true, company_id: true, branch_id: true, organization: { select: { display_name: true } } },
            take: 500,
        });
        let count = 0;
        for (const p of candidates) {
            const days = Math.round((dateOnly(p.valid_until as Date).getTime() - today.getTime()) / 86_400_000);
            if (!p.reminder_days.includes(days)) continue;
            const already = await this.prisma.proposalDelivery.count({ where: { proposal_id: p.id, message: { startsWith: marker(p.sent_version_id as string, days) } } });
            if (already) continue;
            if (await this.remind(p, days)) count += 1;
        }
        return count;
    }

    private async remind(p: { id: string; organization_id: string; number: string; title: string; valid_until: Date | null; sent_version_id: string | null; owner_membership_id: string | null; contact_id: string | null; company_id: string | null; branch_id: string | null; organization: { display_name: string } }, days: number) {
        const versionId = p.sent_version_id as string;
        const tag = marker(versionId, days);
        const recipients = await this.recipients(p.id, versionId, p.contact_id);
        const ctx = p.owner_membership_id ? await this.authorization.contextFor({ organization_id: p.organization_id, membership_id: p.owner_membership_id, channel: 'automation' }) : null;
        if (!ctx || !ctx.can(SEND) || !recipients.length) {
            // Recorded once so the job does not retry every hour; staff see why in the activity tab.
            await this.prisma.proposalDelivery.create({
                data: {
                    proposal_id: p.id, version_id: versionId, channel: ProposalDeliveryChannel.EMAIL, status: ProposalDeliveryStatus.FAILED,
                    message: `${tag} Expiry reminder (${days} days)`,
                    failed_reason: !recipients.length ? 'No recipient with an email address' : 'The proposal owner cannot send proposals (proposals.proposals.send)',
                },
            });
            return false;
        }

        // An extra customer link for this email (the raw token exists only here); earlier links keep working.
        const { token } = await issueAccessToken(this.prisma, { organization_id: p.organization_id, proposal_id: p.id, source: 'REMINDER', recipient_email: recipients.length === 1 ? recipients[0].email : null });
        const url = this.mailer.appUrl(`/p/${token}`);
        const until = (p.valid_until as Date).toISOString().slice(0, 10);
        const subject = days <= 1 ? `Reminder: proposal ${p.number} expires tomorrow` : `Reminder: proposal ${p.number} expires in ${days} days`;
        let sent = 0;
        for (const r of recipients) {
            const text = `Hello ${r.name || 'there'},\n\nThis is a friendly reminder that the proposal "${p.title}" from ${p.organization.display_name} is valid until ${until}.\n\nOpen the proposal: ${url}\n\nIf you have questions, reply to this email or leave a comment on the proposal.`;
            const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;max-width:560px"><p>Hello ${escapeHtml(r.name || 'there')},</p><p>This is a friendly reminder that the proposal <b>${escapeHtml(p.title)}</b> from ${escapeHtml(p.organization.display_name)} is valid until <b>${until}</b>.</p><p><a href="${url}">Open the proposal</a></p><p style="color:#6b7280;font-size:12px">If you have questions, reply to this email or leave a comment on the proposal.</p></div>`;
            let status: ProposalDeliveryStatus = ProposalDeliveryStatus.FAILED;
            let reason: string | null = null;
            let communicationId: string | null = null;
            try {
                const msg = await this.messages.create(ctx, {
                    channel: CommChannel.EMAIL, kind: CommMessageKind.TRANSACTIONAL, to_address: r.email, to_name: r.name || undefined, contact_id: r.contact_id ?? undefined,
                    company_id: p.company_id ?? undefined, subject, body_html: html, body_text: text,
                }, { authorized_by_permission: SEND });
                communicationId = msg.id;
                if (msg.status === CommMessageStatus.SENT || msg.status === CommMessageStatus.DELIVERED || msg.status === CommMessageStatus.QUEUED) status = ProposalDeliveryStatus.SENT;
                else reason = msg.failure_reason ?? (msg as { last_error?: string | null }).last_error ?? `Message ${msg.status.toLowerCase()}`;
            } catch (error) {
                reason = (error as Error).message;
            }
            if (status === ProposalDeliveryStatus.SENT) sent += 1;
            await this.prisma.proposalDelivery.create({
                data: {
                    proposal_id: p.id, version_id: versionId, channel: ProposalDeliveryChannel.EMAIL, status, recipient_contact_id: r.contact_id, recipient_email: r.email,
                    communication_id: communicationId, message: `${tag} Expiry reminder (${days} days)`, sent_at: status === ProposalDeliveryStatus.SENT ? new Date() : null, failed_reason: reason?.slice(0, 500) ?? null,
                },
            });
        }
        await this.prisma.proposalEvent.create({ data: { proposal_id: p.id, version_id: versionId, type: ProposalEventType.SENT, metadata: { reminder: true, days_before_expiry: days, recipients: recipients.map((r) => r.email), delivered: sent, link_rotated: true } } });
        await this.audit.record(ctx, 'proposal.reminder_sent', { resource_type: 'proposal', resource_id: p.id, branch_id: p.branch_id, metadata: { version_id: versionId, days_before_expiry: days, recipients: recipients.map((r) => r.email), delivered: sent, channel: 'automation' } });
        this.events.publish(ctx, {
            event_key: 'proposals.proposal.reminder_sent', module: ModuleKey.PROPOSALS, entity_kind: 'proposal', entity_id: p.id,
            payload: { number: p.number, title: p.title, days_before_expiry: days, delivered: sent, company_id: p.company_id },
            activity: { summary: `Expiry reminder sent for proposal ${p.number} (${days} days left)`, entity_label: p.title, company_id: p.company_id, branch_id: p.branch_id },
        });
        return true;
    }

    /** Everyone the sent version was emailed to, else the proposal contact. */
    private async recipients(proposalId: string, versionId: string, contactId: string | null) {
        const deliveries = await this.prisma.proposalDelivery.findMany({
            where: { proposal_id: proposalId, version_id: versionId, channel: ProposalDeliveryChannel.EMAIL, recipient_email: { not: null }, NOT: { message: { startsWith: '[reminder:' } } },
            select: { recipient_email: true, recipient_contact_id: true, recipient: { select: { first_name: true, last_name: true } } },
        });
        const out = new Map<string, { email: string; name: string; contact_id: string | null }>();
        for (const d of deliveries) {
            const email = (d.recipient_email as string).toLowerCase();
            if (!out.has(email)) out.set(email, { email, contact_id: d.recipient_contact_id, name: d.recipient ? `${d.recipient.first_name} ${d.recipient.last_name ?? ''}`.trim() : '' });
        }
        if (!out.size && contactId) {
            const c = await this.prisma.crmContact.findUnique({ where: { id: contactId }, select: { id: true, email: true, first_name: true, last_name: true } });
            if (c?.email) out.set(c.email.toLowerCase(), { email: c.email.toLowerCase(), contact_id: c.id, name: `${c.first_name} ${c.last_name ?? ''}`.trim() });
        }
        return [...out.values()];
    }
}
