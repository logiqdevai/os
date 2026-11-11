import { Injectable } from '@nestjs/common';
import { MessagingPresence, MessagingPresenceState, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { UpdatePresenceDto } from '../dto/message.dto';
import { DirectoryQuery, PresenceQuery } from '../dto/messaging-query.schema';
import { MessagingAccessService, USER_PUBLIC_SELECT, personName } from './messaging-access.service';
import { MessagingRealtimeService } from './messaging-realtime.service';

export interface PresenceView {
    membership_id: string;
    state: MessagingPresenceState;
    status_text: string | null;
    status_emoji: string | null;
    last_seen_at: Date | null;
}

/** Effective presence: offline without a live socket; otherwise the manual override (Away / DND) or Active. Custom status expires. */
export function presenceView(row: MessagingPresence | null | undefined, membershipId: string): PresenceView {
    if (!row || row.presence_hidden) return { membership_id: membershipId, state: 'OFFLINE', status_text: null, status_emoji: null, last_seen_at: null };
    const expired = row.status_expires_at && row.status_expires_at < new Date();
    const manual = row.manual_state && (!row.manual_state_until || row.manual_state_until > new Date()) ? row.manual_state : null;
    return {
        membership_id: membershipId,
        state: row.active_connections > 0 ? (manual ?? 'ACTIVE') : 'OFFLINE',
        status_text: expired ? null : row.status_text,
        status_emoji: expired ? null : row.status_emoji,
        last_seen_at: row.last_seen_at,
    };
}

/** Presence (12 §4) and the member directory used for mention autocomplete and the DM picker. */
@Injectable()
export class PresenceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly access: MessagingAccessService,
        private readonly audit: AuditService,
        private readonly realtime: MessagingRealtimeService,
    ) { }

    async directory(ctx: OrgContext, query: DirectoryQuery) {
        const s = query.search;
        const where: Prisma.MembershipWhereInput = {
            organization_id: ctx.organization_id,
            status: 'ACTIVE',
            ...(s && {
                OR: [
                    { user: { display_name: { contains: s, mode: 'insensitive' } } },
                    { user: { first_name: { contains: s, mode: 'insensitive' } } },
                    { user: { last_name: { contains: s, mode: 'insensitive' } } },
                    { user: { email: { contains: s, mode: 'insensitive' } } },
                    { job_title: { contains: s, mode: 'insensitive' } },
                ],
            }),
        };
        const rows = await this.prisma.membership.findMany({
            where,
            select: { id: true, job_title: true, type: true, user: { select: USER_PUBLIC_SELECT } },
            orderBy: { user: { first_name: 'asc' } },
            take: query.limit,
        });
        const presence = await this.prisma.messagingPresence.findMany({ where: { membership_id: { in: rows.map((r) => r.id) } } });
        const byId = new Map(presence.map((p) => [p.membership_id, p]));
        return {
            data: rows.map((r) => ({
                membership_id: r.id,
                user_id: r.user.id,
                name: personName(r.user),
                email: r.user.email,
                job_title: r.job_title,
                profile_photo_url: r.user.profile_photo_url,
                is_me: r.id === ctx.membership_id,
                presence: presenceView(byId.get(r.id), r.id),
            })),
        };
    }

    async list(ctx: OrgContext, query: PresenceQuery) {
        const rows = await this.prisma.messagingPresence.findMany({
            where: { organization_id: ctx.organization_id, ...(query.membership_ids?.length ? { membership_id: { in: query.membership_ids } } : { active_connections: { gt: 0 } }) },
        });
        return { data: rows.map((r) => presenceView(r, r.membership_id)) };
    }

    async me(ctx: OrgContext) {
        const me = this.access.requireMembership(ctx);
        const row = await this.prisma.messagingPresence.findUnique({ where: { membership_id: me } });
        return { ...presenceView(row, me), manual_state: row?.manual_state ?? null, status_expires_at: row?.status_expires_at ?? null };
    }

    async update(ctx: OrgContext, dto: UpdatePresenceDto) {
        const me = this.access.requireMembership(ctx);
        const data = {
            manual_state: dto.manual_state === undefined ? undefined : dto.manual_state,
            status_text: dto.status_text === undefined ? undefined : dto.status_text || null,
            status_emoji: dto.status_emoji === undefined ? undefined : dto.status_emoji || null,
            status_expires_at: dto.status_expires_at === undefined ? undefined : dto.status_expires_at ? new Date(dto.status_expires_at) : null,
        };
        const row = await this.prisma.messagingPresence.upsert({
            where: { membership_id: me },
            update: data,
            create: { membership_id: me, organization_id: ctx.organization_id, ...data },
        });
        this.audit.recordAsync(ctx, 'messaging.presence_updated', { resource_type: 'membership', resource_id: me, metadata: { after: dto } });
        const view = presenceView(row, me);
        this.realtime.toOrganization(ctx.organization_id, 'presence', view);
        return view;
    }

    /** Socket connected / disconnected (gateway). Returns the new effective presence. */
    async connection(organizationId: string, membershipId: string, delta: 1 | -1) {
        const now = new Date();
        let row = await this.prisma.messagingPresence.upsert({
            where: { membership_id: membershipId },
            update: { active_connections: { increment: delta }, last_seen_at: now, state: delta > 0 ? 'ACTIVE' : undefined },
            create: { membership_id: membershipId, organization_id: organizationId, active_connections: Math.max(0, delta), state: delta > 0 ? 'ACTIVE' : 'OFFLINE', last_seen_at: now },
        });
        if (row.active_connections <= 0) {
            row = await this.prisma.messagingPresence.update({ where: { membership_id: membershipId }, data: { active_connections: 0, state: 'OFFLINE' } });
        }
        return presenceView(row, membershipId);
    }
}
