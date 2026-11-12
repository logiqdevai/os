import { Injectable } from '@nestjs/common';
import { Prisma, ProposalDeliveryStatus, ProposalEventType, ProposalStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { ProposalsService } from './proposals.service';
import { ProposalTrackingQuery } from './dto/proposal-query.schema';

/** Engagement stored on a VIEWED ProposalEvent (merged by the public page's beacons). */
export interface ViewEngagement {
    time_on_page_seconds?: number;
    sections?: Record<string, number>;
    session_id?: string;
}

const DAY = 86_400_000;

/**
 * 03 "Proposal Tracking" — customer activity across all proposals the caller can read: views, time on page and
 * opened sections (from VIEWED events' engagement metadata), downloads, comments, decisions, delivery failures,
 * "hot" (3+ views in 24 h) and "not opened" proposals. Customer IP / device are personal data: returned only to
 * holders of proposals.proposals.read (this endpoint's key) and never exported here.
 */
@Injectable()
export class ProposalTrackingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly proposals: ProposalsService,
    ) { }

    private range(q: ProposalTrackingQuery) {
        const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date();
        const from = q.from ? new Date(`${q.from}T00:00:00.000Z`) : new Date(to.getTime() - 30 * DAY);
        return { from, to };
    }

    async tracking(ctx: OrgContext, q: ProposalTrackingQuery) {
        const { from, to } = this.range(q);
        const proposalWhere: Prisma.ProposalWhereInput = {
            organization_id: ctx.organization_id,
            AND: [this.proposals.scopeWhere(ctx)],
            ...(q.proposal_id && { id: q.proposal_id }),
            ...(q.search && { OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { number: { contains: q.search, mode: 'insensitive' } }, { company: { name: { contains: q.search, mode: 'insensitive' } } }] }),
        };
        const customerTypes: ProposalEventType[] = [
            ProposalEventType.VIEWED, ProposalEventType.DOWNLOADED, ProposalEventType.OPTIONAL_ITEM_TOGGLED, ProposalEventType.COMMENTED, ProposalEventType.CHANGES_REQUESTED,
            ProposalEventType.ACCEPTED, ProposalEventType.REJECTED, ProposalEventType.SENT, ProposalEventType.EXPIRED,
        ];
        const eventWhere: Prisma.ProposalEventWhereInput = {
            proposal: proposalWhere,
            created_at: { gte: from, lte: to },
            type: { in: q.type?.length ? q.type : customerTypes },
        };
        const now = Date.now();
        const startToday = new Date(new Date().toISOString().slice(0, 10));
        const [items, total, views, viewsToday, recentViews, notOpened, failures] = await Promise.all([
            this.prisma.proposalEvent.findMany({
                where: eventWhere, ...skipTake(q), orderBy: { created_at: 'desc' },
                include: {
                    proposal: { select: { id: true, number: true, title: true, company: { select: { id: true, name: true } }, contact: { select: { id: true, first_name: true, last_name: true } } } },
                    version: { select: { version_number: true } },
                },
            }),
            this.prisma.proposalEvent.count({ where: eventWhere }),
            this.prisma.proposalEvent.findMany({
                where: { proposal: proposalWhere, type: ProposalEventType.VIEWED, created_at: { gte: from, lte: to } },
                select: { proposal_id: true, created_at: true, metadata: true, version_id: true },
                take: 5000,
            }),
            this.prisma.proposalEvent.count({ where: { proposal: proposalWhere, type: ProposalEventType.VIEWED, created_at: { gte: startToday } } }),
            this.prisma.proposalEvent.groupBy({ by: ['proposal_id'], where: { proposal: proposalWhere, type: ProposalEventType.VIEWED, created_at: { gte: new Date(now - DAY) } }, _count: { _all: true } }),
            this.prisma.proposal.count({ where: { ...proposalWhere, status: ProposalStatus.SENT, first_viewed_at: null, sent_at: { lt: new Date(now - 3 * DAY) } } }),
            this.prisma.proposalDelivery.count({ where: { proposal: proposalWhere, status: ProposalDeliveryStatus.FAILED, created_at: { gte: from, lte: to } } }),
        ]);

        // Per-proposal engagement: views, total time, time per section.
        const per = new Map<string, { views: number; seconds: number; last: Date; sections: Map<string, number> }>();
        let totalSeconds = 0;
        let timedViews = 0;
        for (const v of views) {
            const m = (v.metadata ?? {}) as ViewEngagement;
            const row = per.get(v.proposal_id) ?? { views: 0, seconds: 0, last: v.created_at, sections: new Map<string, number>() };
            row.views += 1;
            row.seconds += m.time_on_page_seconds ?? 0;
            if (v.created_at > row.last) row.last = v.created_at;
            for (const [sid, secs] of Object.entries(m.sections ?? {})) row.sections.set(sid, (row.sections.get(sid) ?? 0) + Number(secs || 0));
            per.set(v.proposal_id, row);
            if (m.time_on_page_seconds) { totalSeconds += m.time_on_page_seconds; timedViews += 1; }
        }
        const topIds = [...per.entries()].sort((a, b) => b[1].views - a[1].views || b[1].seconds - a[1].seconds).slice(0, 10).map(([id]) => id);
        const sectionIds = [...new Set(topIds.flatMap((id) => [...(per.get(id)?.sections.keys() ?? [])]))];
        const [topProposals, sections] = await Promise.all([
            this.prisma.proposal.findMany({ where: { id: { in: topIds } }, select: { id: true, number: true, title: true, status: true, valid_until: true, company: { select: { name: true } } } }),
            sectionIds.length ? this.prisma.proposalSection.findMany({ where: { id: { in: sectionIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
        ]);
        const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));
        const hot = recentViews.filter((r) => r._count._all >= 3);

        return {
            range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
            summary: {
                views_today: viewsToday,
                views_in_range: views.length,
                proposals_viewed: per.size,
                hot_proposals: hot.length,
                not_opened: notOpened,
                delivery_failures: failures,
                avg_time_on_page_seconds: timedViews ? Math.round(totalSeconds / timedViews) : null,
            },
            proposals: topIds.map((id) => {
                const p = topProposals.find((x) => x.id === id);
                const e = per.get(id)!;
                return {
                    id, number: p?.number ?? '', title: p?.title ?? '', status: p?.status ?? null, company: p?.company?.name ?? null, valid_until: p?.valid_until ?? null,
                    views: e.views, time_on_page_seconds: e.seconds, last_viewed_at: e.last, hot: hot.some((h) => h.proposal_id === id),
                    sections: [...e.sections.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([sid, secs]) => ({ id: sid, title: sectionTitle.get(sid) ?? 'Removed section', seconds: Math.round(secs) })),
                };
            }),
            events: paginate(items.map((e) => {
                const m = (e.metadata ?? {}) as Record<string, unknown> & ViewEngagement;
                return {
                    id: e.id, type: e.type, created_at: e.created_at, version_number: e.version?.version_number ?? null,
                    proposal: { id: e.proposal.id, number: e.proposal.number, title: e.proposal.title, company: e.proposal.company?.name ?? null },
                    actor: e.actor_user_id ? 'staff' : e.actor_contact_id || e.ip_address ? 'customer' : 'system',
                    contact: e.proposal.contact && e.actor_contact_id ? `${e.proposal.contact.first_name} ${e.proposal.contact.last_name ?? ''}`.trim() : null,
                    time_on_page_seconds: m.time_on_page_seconds ?? null,
                    sections_opened: m.sections ? Object.keys(m.sections).length : null,
                    reminder: m.reminder === true,
                    detail: typeof m.author_name === 'string' ? m.author_name : typeof m.signer_name === 'string' ? m.signer_name : null,
                    ip_address: e.ip_address, user_agent: e.user_agent,
                };
            }), total, q),
        };
    }
}
