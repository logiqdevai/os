import { BadRequestException, ForbiddenException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { InvitationStatus, MembershipType, ModuleKey, Prisma, ScopeType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { sha256 } from '@/shared/authorization/credentials.service';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { ResendMailService } from '@/integrations/notifications/resend/services/mail.service';
import { AdminAccessService, USER_SELECT } from '../shared/admin-access.service';
import { CreateInvitationDto, InvitationQuery } from './dto/invitation.dto';

const MODULE = ModuleKey.ADMINISTRATION;
const DAY = 24 * 60 * 60 * 1000;

export interface InvitationSendResult {
    email: string;
    status: 'invited' | 'already_member' | 'already_invited';
    invitation_id?: string;
    /** Present only when the email could not be sent, so the admin can copy the link. Shown once. */
    invite_url?: string;
    email_sent?: boolean;
}

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * Invitations (01 §65–66). Only the sha256 of the token is stored; the plain link exists once: in the email,
 * or in the create/resend response when no email could be sent. Acceptance lives in the auth module.
 */
@Injectable()
export class InvitationsService {
    private readonly logger = new Logger(InvitationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: AdminAccessService,
        private readonly mail: ResendMailService,
        private readonly config: ConfigService,
    ) { }

    async findAll(ctx: OrgContext, query: InvitationQuery) {
        const now = new Date();
        const statusWhere: Prisma.InvitationWhereInput =
            query.status === InvitationStatus.PENDING
                ? { status: InvitationStatus.PENDING, expires_at: { gt: now } }
                : query.status === InvitationStatus.EXPIRED
                    ? { OR: [{ status: InvitationStatus.EXPIRED }, { status: InvitationStatus.PENDING, expires_at: { lte: now } }] }
                    : query.status
                        ? { status: query.status }
                        : {};
        const where: Prisma.InvitationWhereInput = {
            organization_id: ctx.organization_id,
            audience: 'MEMBER',
            ...statusWhere,
            ...(query.search && { email: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.invitation.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['created_at', 'expires_at', 'email'], 'created_at'),
                select: this.select(),
            }),
            this.prisma.invitation.count({ where }),
        ]);
        return paginate(items.map((i) => this.present(i)), total, query);
    }

    /** 01 §73 — security policy: who may invite (ADMINS_ONLY = holders of users.members.manage) and allowed email domains for members. */
    private async assertInvitationPolicy(ctx: OrgContext, type: MembershipType, emails: string[]) {
        const policy = await this.prisma.organizationSecurityPolicy.findUnique({
            where: { organization_id: ctx.organization_id },
            select: { invitation_policy: true, restrict_invitations_to_domains: true, allowed_email_domains: true },
        });
        if (!policy) return;
        if (policy.invitation_policy === 'ADMINS_ONLY' && !ctx.can('users.members.manage')) {
            throw new ForbiddenException({ message: 'Only administrators can send invitations in this organization', code: 'invitation_policy_admins_only' });
        }
        if (type === MembershipType.INTERNAL && policy.restrict_invitations_to_domains && policy.allowed_email_domains.length) {
            const outside = emails.filter((e) => !policy.allowed_email_domains.includes(e.split('@')[1] ?? ''));
            if (outside.length) {
                throw new BadRequestException({ message: `Members can only be invited from ${policy.allowed_email_domains.join(', ')}: ${outside.slice(0, 3).join(', ')}`, code: 'invitation_domain_not_allowed', emails: outside });
            }
        }
    }

    async create(ctx: OrgContext, dto: CreateInvitationDto): Promise<{ results: InvitationSendResult[] }> {
        const type = dto.type ?? MembershipType.INTERNAL;
        if (type !== MembershipType.INTERNAL) this.access.assertHoldsAll(ctx, ['users.external_collaborators.manage']);
        let roleName: string | null = null;
        if (dto.role_id) roleName = (await this.access.assertAssignableRole(ctx, dto.role_id)).name;
        const scope_type = dto.role_id ? dto.scope_type ?? ScopeType.ORGANIZATION : ScopeType.ORGANIZATION;
        const scope_id = dto.role_id ? await this.access.assertScope(ctx, scope_type, dto.scope_id) : null;
        if (dto.branch_id) await this.access.assertScope(ctx, ScopeType.BRANCH, dto.branch_id);
        if (dto.team_id) await this.access.assertScope(ctx, ScopeType.TEAM, dto.team_id);
        if (dto.valid_until && new Date(dto.valid_until) <= new Date()) throw new BadRequestException({ message: 'Access end date must be in the future', code: 'invalid_valid_until' });

        const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: ctx.organization_id }, select: { display_name: true } });
        const inviter = ctx.user_id ? await this.prisma.user.findUnique({ where: { id: ctx.user_id }, select: USER_SELECT }) : null;
        const emails = [...new Set(dto.emails.map((e) => e.trim().toLowerCase()))];
        await this.assertInvitationPolicy(ctx, type, emails);
        const results: InvitationSendResult[] = [];

        for (const email of emails) {
            const member = await this.prisma.membership.findFirst({ where: { organization_id: ctx.organization_id, user: { email: { equals: email, mode: 'insensitive' } }, status: { in: ['ACTIVE', 'SUSPENDED'] } }, select: { id: true } });
            if (member) {
                results.push({ email, status: 'already_member' });
                continue;
            }
            const pending = await this.prisma.invitation.findFirst({ where: { organization_id: ctx.organization_id, email: { equals: email, mode: 'insensitive' }, status: 'PENDING', expires_at: { gt: new Date() } }, select: { id: true } });
            if (pending) {
                results.push({ email, status: 'already_invited', invitation_id: pending.id });
                continue;
            }
            const token = randomBytes(32).toString('base64url');
            const invitation = await this.prisma.invitation.create({
                data: {
                    organization_id: ctx.organization_id,
                    email,
                    type,
                    audience: 'MEMBER',
                    role_id: dto.role_id ?? null,
                    scope_type,
                    scope_id,
                    branch_id: dto.branch_id ?? null,
                    team_id: dto.team_id ?? null,
                    modules: dto.modules ?? [],
                    valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
                    message: dto.message ?? null,
                    token_hash: sha256(token),
                    source: ctx.channel === 'ui' ? 'MANUAL' : 'API',
                    invited_by_user_id: ctx.user_id,
                    expires_at: new Date(Date.now() + (dto.expires_in_days ?? 7) * DAY),
                    last_sent_at: new Date(),
                },
            });
            const url = this.inviteUrl(token);
            const sent = await this.sendEmail(email, url, org.display_name, inviter, roleName, dto.message);
            await this.audit.record(ctx, 'invitation.sent', { resource_type: 'invitation', resource_id: invitation.id, branch_id: dto.branch_id ?? null, metadata: { email, type, role_id: dto.role_id ?? null, scope_type, scope_id, email_sent: sent } });
            if (type !== MembershipType.INTERNAL) await this.audit.record(ctx, 'external_collaborator.added', { resource_type: 'invitation', resource_id: invitation.id, metadata: { email, type } });
            this.events.publish(ctx, { event_key: 'users.invitation.sent', module: MODULE, entity_kind: 'invitation', entity_id: invitation.id, payload: { email, role_id: dto.role_id ?? null } });
            results.push({ email, status: 'invited', invitation_id: invitation.id, email_sent: sent, ...(sent ? {} : { invite_url: url }) });
        }
        return { results };
    }

    async resend(ctx: OrgContext, id: string): Promise<InvitationSendResult> {
        const invitation = await this.find(ctx, id);
        if (invitation.status !== 'PENDING' && invitation.status !== 'EXPIRED') {
            throw new ConflictException({ message: `Invitation is ${invitation.status.toLowerCase()}`, code: 'invitation_not_pending' });
        }
        const token = randomBytes(32).toString('base64url');
        const updated = await this.prisma.invitation.update({
            where: { id },
            data: { token_hash: sha256(token), status: 'PENDING', expires_at: new Date(Date.now() + 7 * DAY), last_sent_at: new Date(), send_count: { increment: 1 } },
            include: { organization: { select: { display_name: true } }, role: { select: { name: true } } },
        });
        const inviter = ctx.user_id ? await this.prisma.user.findUnique({ where: { id: ctx.user_id }, select: USER_SELECT }) : null;
        const url = this.inviteUrl(token);
        const sent = await this.sendEmail(updated.email, url, updated.organization.display_name, inviter, updated.role?.name ?? null, updated.message);
        await this.audit.record(ctx, 'invitation.sent', { resource_type: 'invitation', resource_id: id, metadata: { email: updated.email, resend: true, send_count: updated.send_count, email_sent: sent } });
        this.events.publish(ctx, { event_key: 'users.invitation.sent', module: MODULE, entity_kind: 'invitation', entity_id: id, payload: { email: updated.email, resend: true } });
        return { email: updated.email, status: 'invited', invitation_id: id, email_sent: sent, ...(sent ? {} : { invite_url: url }) };
    }

    async cancel(ctx: OrgContext, id: string) {
        const invitation = await this.find(ctx, id);
        if (invitation.status !== 'PENDING' && invitation.status !== 'EXPIRED') {
            throw new ConflictException({ message: `Invitation is ${invitation.status.toLowerCase()}`, code: 'invitation_not_pending' });
        }
        const updated = await this.prisma.invitation.update({ where: { id }, data: { status: 'CANCELLED', cancelled_at: new Date() }, select: this.select() });
        await this.audit.record(ctx, 'invitation.cancelled', { resource_type: 'invitation', resource_id: id, metadata: { email: invitation.email } });
        this.events.publish(ctx, { event_key: 'users.invitation.cancelled', module: MODULE, entity_kind: 'invitation', entity_id: id, payload: { email: invitation.email } });
        return this.present(updated);
    }

    private async find(ctx: OrgContext, id: string) {
        const invitation = await this.prisma.invitation.findFirst({ where: { id, organization_id: ctx.organization_id, audience: 'MEMBER' } });
        if (!invitation) throw new NotFoundException({ message: 'Invitation not found', code: 'invitation_not_found' });
        return invitation;
    }

    private select() {
        return {
            id: true, email: true, type: true, status: true, scope_type: true, scope_id: true, modules: true, message: true,
            expires_at: true, accepted_at: true, cancelled_at: true, created_at: true, last_sent_at: true, send_count: true, valid_until: true, membership_id: true,
            role: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } },
            invited_by: { select: USER_SELECT },
        } satisfies Prisma.InvitationSelect;
    }

    /** PENDING rows past their expiry are shown as EXPIRED (the system job writes the final status). */
    private present<T extends { status: InvitationStatus; expires_at: Date }>(i: T): T {
        return i.status === 'PENDING' && i.expires_at <= new Date() ? { ...i, status: InvitationStatus.EXPIRED } : i;
    }

    private inviteUrl(token: string) {
        const base = (this.config.get<string>('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
        return `${base}/auth/invite/${token}`;
    }

    private async sendEmail(to: string, url: string, orgName: string, inviter: { display_name: string | null; first_name: string | null; last_name: string | null; email: string } | null, roleName: string | null, message?: string | null): Promise<boolean> {
        if (!this.config.get<string>('RESEND_API_KEY')) return false;
        const who = inviter ? inviter.display_name || [inviter.first_name, inviter.last_name].filter(Boolean).join(' ') || inviter.email : 'A colleague';
        const html = `
            <div style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111">
                <p>${escapeHtml(who)} invited you to join <b>${escapeHtml(orgName)}</b> on Logiqdev OS${roleName ? ` as <b>${escapeHtml(roleName)}</b>` : ''}.</p>
                ${message ? `<p style="padding:12px;border-left:3px solid #ddd;color:#444">${escapeHtml(message)}</p>` : ''}
                <p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Accept invitation</a></p>
                <p style="color:#666;font-size:12px">This link expires in 7 days. If you did not expect this invitation you can ignore this email.</p>
            </div>`;
        try {
            const res: any = await this.mail.sendEmail({ to, subject: `${who} invited you to ${orgName}`, html, text: `${who} invited you to join ${orgName}. Accept: ${url}` });
            if (res?.error) {
                this.logger.warn(`invitation email to ${to} not sent: ${res.error.message ?? res.error.name}`);
                return false;
            }
            return true;
        } catch (error) {
            this.logger.warn(`invitation email to ${to} not sent: ${(error as Error).message}`);
            return false;
        }
    }
}
