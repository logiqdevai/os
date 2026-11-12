import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { CredentialsService } from '@/shared/authorization/credentials.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { USER_SELECT } from '../shared/admin-access.service';
import { RevokeAllSessionsDto, SessionQuery } from './dto/session.dto';

const READ = 'users.sessions.read';
const REVOKE = 'users.sessions.revoke';

/**
 * Admin view of members' sessions (01 §72, mockup 01-admin `sessions`). Sessions belong to the global User, so the
 * organization filter is "the user is a member of this organization"; branch / team scoped holders only see members
 * of their branches / teams. token_hash is never selected.
 */
@Injectable()
export class SessionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly credentials: CredentialsService,
    ) { }

    /** Membership filter for the permission's scope. Organization-wide scope adds nothing (never `{}` inside OR). */
    private memberWhere(ctx: OrgContext, key: string, memberId?: string): Prisma.MembershipWhereInput {
        const scope = ctx.scopeOf(key);
        const where: Prisma.MembershipWhereInput = { organization_id: ctx.organization_id, ...(memberId && { id: memberId }) };
        if (!scope || scope.organization) return where;
        return {
            ...where,
            OR: [
                { branches: { some: { branch_id: { in: scope.branch_ids }, ended_at: null } } },
                { teams: { some: { team_id: { in: scope.team_ids }, ended_at: null } } },
            ],
        };
    }

    private sessionWhere(ctx: OrgContext, key: string, memberId?: string): Prisma.UserSessionWhereInput {
        return { revoked_at: null, expires_at: { gt: new Date() }, user: { memberships: { some: this.memberWhere(ctx, key, memberId) } } };
    }

    async findAll(ctx: OrgContext, query: SessionQuery, currentSessionId: string | null = null) {
        const where: Prisma.UserSessionWhereInput = {
            ...this.sessionWhere(ctx, READ, query.member_id),
            ...(query.search && {
                OR: [
                    { ip_address: { contains: query.search, mode: 'insensitive' } },
                    { browser: { contains: query.search, mode: 'insensitive' } },
                    { device: { contains: query.search, mode: 'insensitive' } },
                    { user: { email: { contains: query.search, mode: 'insensitive' } } },
                    { user: { display_name: { contains: query.search, mode: 'insensitive' } } },
                ],
            }),
        };
        const [rows, total] = await Promise.all([
            this.prisma.userSession.findMany({
                where,
                ...skipTake(query),
                orderBy: orderBy(query, ['last_activity_at', 'created_at', 'expires_at'], 'last_activity_at'),
                select: {
                    id: true, device: true, browser: true, ip_address: true, location_approx: true, user_agent: true,
                    active_organization_id: true, active_branch_id: true, active_branch_ids: true,
                    last_activity_at: true, created_at: true, expires_at: true,
                    user: { select: { ...USER_SELECT, memberships: { where: { organization_id: ctx.organization_id }, select: { id: true, status: true, job_title: true } } } },
                },
            }),
            this.prisma.userSession.count({ where }),
        ]);
        const data = rows.map(({ user, active_organization_id, active_branch_id, active_branch_ids, ...s }) => {
            const { memberships, ...person } = user;
            const here = active_organization_id === ctx.organization_id;
            return {
                ...s,
                // Branch context only means something for this organization; never leak another tenant's ids.
                in_this_organization: here,
                active_branch_ids: here ? (active_branch_ids.length ? active_branch_ids : active_branch_id ? [active_branch_id] : []) : [],
                current: !!currentSessionId && s.id === currentSessionId,
                member: memberships[0] ? { ...memberships[0], user: person } : null,
            };
        });
        return paginate(data, total, query);
    }

    async revoke(ctx: OrgContext, id: string, reason?: string, currentSessionId: string | null = null) {
        const session = await this.prisma.userSession.findFirst({
            where: { id, ...this.sessionWhere(ctx, REVOKE) },
            select: { id: true, user_id: true, user: { select: { memberships: { where: { organization_id: ctx.organization_id }, select: { id: true } } } } },
        });
        // 404 so out-of-scope sessions do not leak.
        if (!session) throw new NotFoundException({ message: 'Session not found or already ended', code: 'session_not_found' });
        if (currentSessionId && id === currentSessionId) {
            throw new BadRequestException({ message: 'Use “Sign out” to end your own current session', code: 'cannot_revoke_current_session' });
        }
        await this.prisma.userSession.update({ where: { id }, data: { revoked_at: new Date(), revoked_reason: reason?.trim() || 'admin_revoked' } });
        await this.credentials.markSessionRevoked(id);
        const membershipId = session.user.memberships[0]?.id ?? null;
        await this.audit.record(ctx, 'session.revoked', { resource_type: 'user_session', resource_id: id, metadata: { user_id: session.user_id, membership_id: membershipId, reason: reason ?? null } });
        this.events.publish(ctx, { event_key: 'users.session.revoked', module: ModuleKey.ADMINISTRATION, entity_kind: 'user_session', entity_id: id, payload: { membership_id: membershipId } });
        return { success: true };
    }

    /** Revoke every in-scope session (optionally one member's), always keeping the caller's current session. */
    async revokeAll(ctx: OrgContext, dto: RevokeAllSessionsDto, currentSessionId: string | null = null) {
        const where: Prisma.UserSessionWhereInput = { ...this.sessionWhere(ctx, REVOKE, dto.member_id), ...(currentSessionId && { id: { not: currentSessionId } }) };
        const sessions = await this.prisma.userSession.findMany({ where, select: { id: true } });
        if (!sessions.length) return { revoked: 0 };
        const ids = sessions.map((s) => s.id);
        await this.prisma.userSession.updateMany({ where: { id: { in: ids } }, data: { revoked_at: new Date(), revoked_reason: dto.reason?.trim() || 'admin_revoked_all' } });
        await Promise.all(ids.map((sid) => this.credentials.markSessionRevoked(sid)));
        await this.audit.record(ctx, 'session.revoked', { resource_type: 'user_session', metadata: { bulk: true, count: ids.length, membership_id: dto.member_id ?? null, reason: dto.reason ?? null } });
        this.events.publish(ctx, { event_key: 'users.session.revoked', module: ModuleKey.ADMINISTRATION, entity_kind: 'user_session', payload: { bulk: true, count: ids.length, membership_id: dto.member_id ?? null } });
        return { revoked: ids.length };
    }
}
