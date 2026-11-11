import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { InvitationStatus, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { sha256 } from '@/shared/authorization/credentials.service';
import { ResendMailService } from '@/integrations/notifications/resend/services/mail.service';

const DAY = 86400_000;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export interface PortalInviteInput {
    company_id: string;
    emails: string[];
    role_id?: string | null;
    message?: string | null;
    expires_in_days?: number;
}

export interface PortalInviteResult {
    email: string;
    status: 'invited' | 'already_member' | 'already_invited';
    invitation_id?: string;
    email_sent?: boolean;
    invite_url?: string;
}

export const INVITATION_SELECT = {
    id: true, email: true, status: true, message: true, expires_at: true, accepted_at: true, cancelled_at: true, created_at: true,
    last_sent_at: true, send_count: true, customer_id: true, portal_membership_id: true,
    role: { select: { id: true, name: true, slug: true } },
    customer: { select: { id: true, name: true } },
    invited_by: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } },
} satisfies Prisma.InvitationSelect;

/**
 * Customer portal invitations (01 §65–66, §79; 07 §2): audience CUSTOMER_PORTAL + customer_id + a customer role.
 * Acceptance is handled by the auth module (EmailAuthService.acceptInvitation). Used by agency admins and by
 * customer Owners / Administrators inviting their own colleagues.
 */
@Injectable()
export class PortalInvitationsService {
    private readonly logger = new Logger(PortalInvitationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly mail: ResendMailService,
        private readonly config: ConfigService,
    ) { }

    /** Customer roles available to the organization (templates + the organization's own CUSTOMER_PORTAL roles). */
    customerRoles(organizationId: string) {
        return this.prisma.role.findMany({
            where: { type: 'CUSTOMER_PORTAL', OR: [{ organization_id: null }, { organization_id: organizationId }], status: { not: 'DRAFT' } },
            select: { id: true, name: true, slug: true, description: true, organization_id: true, permissions: { where: { effect: 'ALLOW' }, select: { permission: { select: { key: true } } } } },
            orderBy: { name: 'asc' },
        }).then((roles) => roles.map(({ permissions, ...r }) => ({ ...r, permissions: permissions.map((p) => p.permission.key).filter((k) => k.startsWith('portal.')).sort() })));
    }

    async resolveRole(organizationId: string, roleId?: string | null, fallbackSlug?: string | null) {
        if (roleId) {
            const role = await this.prisma.role.findFirst({ where: { id: roleId, type: 'CUSTOMER_PORTAL', OR: [{ organization_id: null }, { organization_id: organizationId }] }, select: { id: true, name: true, slug: true } });
            if (!role) throw new NotFoundException({ message: 'Customer role not found', code: 'customer_role_not_found' });
            return role;
        }
        const slug = fallbackSlug ?? 'customer-viewer';
        const role =
            (await this.prisma.role.findFirst({ where: { slug, type: 'CUSTOMER_PORTAL', organization_id: organizationId }, select: { id: true, name: true, slug: true } })) ??
            (await this.prisma.role.findFirst({ where: { slug, type: 'CUSTOMER_PORTAL', organization_id: null }, select: { id: true, name: true, slug: true } }));
        if (!role) throw new NotFoundException({ message: `Customer role ${slug} not found`, code: 'customer_role_not_found' });
        return role;
    }

    async list(organizationId: string, filter: { company_id?: string; status?: InvitationStatus; search?: string; skip?: number; take?: number }) {
        const now = new Date();
        const statusWhere: Prisma.InvitationWhereInput =
            filter.status === 'PENDING' ? { status: 'PENDING', expires_at: { gt: now } }
                : filter.status === 'EXPIRED' ? { OR: [{ status: 'EXPIRED' }, { status: 'PENDING', expires_at: { lte: now } }] }
                    : filter.status ? { status: filter.status } : {};
        const where: Prisma.InvitationWhereInput = {
            organization_id: organizationId,
            audience: 'CUSTOMER_PORTAL',
            ...(filter.company_id && { customer_id: filter.company_id }),
            ...statusWhere,
            ...(filter.search && { email: { contains: filter.search, mode: 'insensitive' } }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.invitation.findMany({ where, select: INVITATION_SELECT, orderBy: { created_at: 'desc' }, skip: filter.skip, take: filter.take }),
            this.prisma.invitation.count({ where }),
        ]);
        return { rows: rows.map((i) => (i.status === 'PENDING' && i.expires_at <= now ? { ...i, status: 'EXPIRED' as InvitationStatus } : i)), total };
    }

    async invite(ctx: OrgContext, input: PortalInviteInput): Promise<{ results: PortalInviteResult[] }> {
        const company = await this.prisma.crmCompany.findFirst({ where: { id: input.company_id, organization_id: ctx.organization_id }, select: { id: true, name: true } });
        if (!company) throw new NotFoundException({ message: 'Client not found', code: 'company_not_found' });
        const [settings, clientSettings] = await Promise.all([
            this.prisma.customerPortalSettings.findUnique({ where: { organization_id: ctx.organization_id }, select: { default_role_slug: true } }),
            this.prisma.customerPortalClientSettings.findUnique({ where: { organization_id_company_id: { organization_id: ctx.organization_id, company_id: company.id } }, select: { default_role_slug: true, enabled: true } }),
        ]);
        if (clientSettings && !clientSettings.enabled) throw new ConflictException({ message: 'The portal is switched off for this client. Enable it first', code: 'portal_client_disabled' });
        const role = await this.resolveRole(ctx.organization_id, input.role_id, clientSettings?.default_role_slug ?? settings?.default_role_slug);
        const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization_id }, select: { display_name: true } });
        const inviter = ctx.user_id ? await this.prisma.user.findUnique({ where: { id: ctx.user_id }, select: { display_name: true, first_name: true, last_name: true, email: true } }) : null;
        const emails = [...new Set(input.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
        if (!emails.length) throw new BadRequestException({ message: 'Enter at least one email', code: 'emails_required' });
        const results: PortalInviteResult[] = [];

        for (const email of emails) {
            const member = await this.prisma.customerPortalMembership.findFirst({ where: { organization_id: ctx.organization_id, customer_id: company.id, status: { in: ['ACTIVE', 'SUSPENDED'] }, user: { email: { equals: email, mode: 'insensitive' } } }, select: { id: true } });
            if (member) {
                results.push({ email, status: 'already_member' });
                continue;
            }
            const pending = await this.prisma.invitation.findFirst({ where: { organization_id: ctx.organization_id, audience: 'CUSTOMER_PORTAL', customer_id: company.id, email: { equals: email, mode: 'insensitive' }, status: 'PENDING', expires_at: { gt: new Date() } }, select: { id: true } });
            if (pending) {
                results.push({ email, status: 'already_invited', invitation_id: pending.id });
                continue;
            }
            const token = randomBytes(32).toString('base64url');
            const invitation = await this.prisma.invitation.create({
                data: {
                    organization_id: ctx.organization_id,
                    email,
                    type: 'GUEST',
                    audience: 'CUSTOMER_PORTAL',
                    customer_id: company.id,
                    role_id: role.id,
                    scope_type: 'CUSTOMER',
                    scope_id: company.id,
                    message: input.message ?? null,
                    token_hash: sha256(token),
                    source: ctx.channel === 'ui' ? 'MANUAL' : 'API',
                    invited_by_user_id: ctx.user_id,
                    expires_at: new Date(Date.now() + (input.expires_in_days ?? 14) * DAY),
                    last_sent_at: new Date(),
                },
            });
            const url = this.inviteUrl(token);
            const sent = await this.sendEmail(email, url, org.display_name, company.name, inviter, role.name, input.message);
            await this.audit.record(ctx, 'portal.invitation.sent', { resource_type: 'invitation', resource_id: invitation.id, metadata: { email, customer_id: company.id, role_id: role.id, email_sent: sent } });
            this.events.publish(ctx, { event_key: 'portal.invitation.sent', module: ModuleKey.CUSTOMER_PORTAL, entity_kind: 'invitation', entity_id: invitation.id, payload: { email, customer_id: company.id, role: role.slug } });
            results.push({ email, status: 'invited', invitation_id: invitation.id, email_sent: sent, ...(sent ? {} : { invite_url: url }) });
        }
        return { results };
    }

    async resend(ctx: OrgContext, id: string, customerId?: string): Promise<PortalInviteResult> {
        const inv = await this.find(ctx, id, customerId);
        if (inv.status !== 'PENDING' && inv.status !== 'EXPIRED') throw new ConflictException({ message: `Invitation is ${inv.status.toLowerCase()}`, code: 'invitation_not_pending' });
        const token = randomBytes(32).toString('base64url');
        const updated = await this.prisma.invitation.update({
            where: { id },
            data: { token_hash: sha256(token), status: 'PENDING', expires_at: new Date(Date.now() + 14 * DAY), last_sent_at: new Date(), send_count: { increment: 1 } },
            include: { organization: { select: { display_name: true } }, role: { select: { name: true } }, customer: { select: { name: true } } },
        });
        const inviter = ctx.user_id ? await this.prisma.user.findUnique({ where: { id: ctx.user_id }, select: { display_name: true, first_name: true, last_name: true, email: true } }) : null;
        const url = this.inviteUrl(token);
        const sent = await this.sendEmail(updated.email, url, updated.organization.display_name, updated.customer?.name ?? '', inviter, updated.role?.name ?? null, updated.message);
        await this.audit.record(ctx, 'portal.invitation.sent', { resource_type: 'invitation', resource_id: id, metadata: { email: updated.email, resend: true, send_count: updated.send_count, email_sent: sent } });
        return { email: updated.email, status: 'invited', invitation_id: id, email_sent: sent, ...(sent ? {} : { invite_url: url }) };
    }

    async cancel(ctx: OrgContext, id: string, customerId?: string) {
        const inv = await this.find(ctx, id, customerId);
        if (inv.status !== 'PENDING' && inv.status !== 'EXPIRED') throw new ConflictException({ message: `Invitation is ${inv.status.toLowerCase()}`, code: 'invitation_not_pending' });
        const row = await this.prisma.invitation.update({ where: { id }, data: { status: 'CANCELLED', cancelled_at: new Date() }, select: INVITATION_SELECT });
        await this.audit.record(ctx, 'portal.invitation.cancelled', { resource_type: 'invitation', resource_id: id, metadata: { email: inv.email, customer_id: inv.customer_id } });
        this.events.publish(ctx, { event_key: 'portal.invitation.cancelled', module: ModuleKey.CUSTOMER_PORTAL, entity_kind: 'invitation', entity_id: id, payload: { email: inv.email } });
        return row;
    }

    private async find(ctx: OrgContext, id: string, customerId?: string) {
        const inv = await this.prisma.invitation.findFirst({ where: { id, organization_id: ctx.organization_id, audience: 'CUSTOMER_PORTAL', ...(customerId && { customer_id: customerId }) } });
        if (!inv) throw new NotFoundException({ message: 'Invitation not found', code: 'invitation_not_found' });
        return inv;
    }

    private inviteUrl(token: string) {
        const base = (this.config.get<string>('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
        return `${base}/auth/invite/${token}`;
    }

    private async sendEmail(to: string, url: string, orgName: string, companyName: string, inviter: { display_name: string | null; first_name: string | null; last_name: string | null; email: string } | null, roleName: string | null, message?: string | null): Promise<boolean> {
        if (!this.config.get<string>('RESEND_API_KEY')) return false;
        const who = inviter ? inviter.display_name || [inviter.first_name, inviter.last_name].filter(Boolean).join(' ') || inviter.email : orgName;
        const html = `
            <div style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111">
                <p>${escapeHtml(who)} invited you to the <b>${escapeHtml(orgName)}</b> client portal${companyName ? ` for <b>${escapeHtml(companyName)}</b>` : ''}${roleName ? ` as <b>${escapeHtml(roleName)}</b>` : ''}.</p>
                <p>Follow your projects, approve deliverables, open requests and see invoices in one place.</p>
                ${message ? `<p style="padding:12px;border-left:3px solid #ddd;color:#444">${escapeHtml(message)}</p>` : ''}
                <p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Open the portal</a></p>
                <p style="color:#666;font-size:12px">This link expires in 14 days.</p>
            </div>`;
        try {
            const res: any = await this.mail.sendEmail({ to, subject: `${orgName} invited you to their client portal`, html, text: `${who} invited you to the ${orgName} client portal. Accept: ${url}` });
            if (res?.error) {
                this.logger.warn(`portal invitation email to ${to} not sent: ${res.error.message ?? res.error.name}`);
                return false;
            }
            return true;
        } catch (error) {
            this.logger.warn(`portal invitation email to ${to} not sent: ${(error as Error).message}`);
            return false;
        }
    }
}
