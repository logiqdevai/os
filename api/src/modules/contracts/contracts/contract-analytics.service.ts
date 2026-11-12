import { Injectable } from '@nestjs/common';
import { ContractApprovalDecision, ContractObligationStatus, ContractStatus, Prisma, SignatureRequestStatus } from 'generated/prisma';
import { z } from 'zod';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { CONFIDENTIAL_READ, addDays, today } from '../shared/contracts.utils';
import { ContractsService } from './contracts.service';

export const ContractAnalyticsQuerySchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    type_id: z.string().uuid().optional(),
    owner_membership_id: z.string().uuid().optional(),
});
export type ContractAnalyticsQuery = z.infer<typeof ContractAnalyticsQuerySchema>;

const DAY = 86_400_000;
const LIVE: ContractStatus[] = [ContractStatus.ACTIVE, ContractStatus.EXPIRING, ContractStatus.FULLY_SIGNED];
const IN_FLIGHT: ContractStatus[] = [ContractStatus.DRAFT, ContractStatus.INTERNAL_REVIEW, ContractStatus.CUSTOMER_REVIEW, ContractStatus.APPROVAL_REQUIRED, ContractStatus.READY_FOR_SIGNATURE, ContractStatus.PARTIALLY_SIGNED];

function median(values: number[]): number | null {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    return Math.round(m * 10) / 10;
}
const days = (a: Date | null | undefined, b: Date | null | undefined) => (a && b ? Math.max(0, (b.getTime() - a.getTime()) / DAY) : null);
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/**
 * 04 §65–66, §52 — contract analytics (scoped like the list). One definition each: cycle time = signature_date −
 * draft_date (created_at when unset); approval time = decided_at − requested_at of approved steps; signature turnaround
 * = SignatureRequest.completed_at − sent_at; renewal rate = renewed / contracts that ended in the period. Values are
 * returned only with contracts.confidential_terms.read (otherwise counts only).
 */
@Injectable()
export class ContractAnalyticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly contracts: ContractsService,
    ) { }

    async analytics(ctx: OrgContext, q: ContractAnalyticsQuery) {
        const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date();
        const from = q.from ? new Date(`${q.from}T00:00:00.000Z`) : new Date(to.getTime() - 365 * DAY);
        const confidential = ctx.can(CONFIDENTIAL_READ);
        const base: Prisma.ContractWhereInput = {
            organization_id: ctx.organization_id, archived_at: null, ...this.contracts.scopeWhere(ctx),
            ...(q.type_id && { type_id: q.type_id }),
            ...(q.owner_membership_id && { owner_membership_id: q.owner_membership_id }),
        };
        const now = today();

        const [byStatus, byType, types, signed, approvals, requests, ended, risk, live, inFlight, overdueObligations] = await Promise.all([
            this.prisma.contract.groupBy({ by: ['status'], where: base, _count: { _all: true }, _sum: { total_value: true } }),
            this.prisma.contract.groupBy({ by: ['type_id'], where: { ...base, status: { in: [...LIVE, ...IN_FLIGHT] } }, _count: { _all: true }, _sum: { total_value: true, recurring_value: true } }),
            this.prisma.contractType.findMany({ where: { organization_id: ctx.organization_id }, select: { id: true, name: true } }),
            this.prisma.contract.findMany({ where: { ...base, signature_date: { gte: from, lte: to } }, select: { draft_date: true, created_at: true, approval_date: true, signature_date: true } }),
            this.prisma.contractApproval.findMany({ where: { decision: ContractApprovalDecision.APPROVED, decided_at: { gte: from, lte: to }, version: { contract: base } }, select: { requested_at: true, decided_at: true } }),
            this.prisma.signatureRequest.findMany({ where: { organization_id: ctx.organization_id, status: SignatureRequestStatus.FULLY_SIGNED, completed_at: { gte: from, lte: to }, contract: base }, select: { sent_at: true, completed_at: true } }),
            this.prisma.contract.findMany({ where: { ...base, end_date: { gte: from, lte: to < now ? to : now } }, select: { status: true, superseded_by_contract_id: true } }),
            this.prisma.contract.groupBy({ by: ['risk_level'], where: { ...base, status: { in: LIVE } }, _count: { _all: true } }),
            this.prisma.contract.findMany({ where: { ...base, status: { in: LIVE } }, select: { end_date: true, renewal_date: true, expiration_date: true, total_value: true, recurring_value: true } }),
            this.prisma.contract.findMany({
                where: { ...base, status: { in: IN_FLIGHT } }, orderBy: { updated_at: 'asc' }, take: 8,
                select: { id: true, number: true, title: true, status: true, updated_at: true, primary_company: { select: { name: true } }, _count: { select: { signature_requests: true } } },
            }),
            this.prisma.contractObligation.count({ where: { contract: base, status: { in: [ContractObligationStatus.OPEN, ContractObligationStatus.IN_PROGRESS, ContractObligationStatus.OVERDUE] }, due_date: { lt: now } } }),
        ]);

        // Monthly signed counts for the 12 months up to `to`.
        const months: { month: string; signed: number; value: number | null }[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - i, 1));
            months.push({ month: d.toISOString().slice(0, 7), signed: 0, value: confidential ? 0 : null });
        }
        const signedYear = await this.prisma.contract.findMany({
            where: { ...base, signature_date: { gte: new Date(`${months[0].month}-01T00:00:00Z`), lte: to } },
            select: { signature_date: true, total_value: true },
        });
        for (const c of signedYear) {
            const m = months.find((x) => x.month === c.signature_date!.toISOString().slice(0, 7));
            if (m) { m.signed += 1; if (confidential) m.value = (m.value ?? 0) + n(c.total_value); }
        }

        const renewed = ended.filter((c) => c.status === ContractStatus.RENEWED || !!c.superseded_by_contract_id).length;
        const buckets = [
            { key: '0_30', label: 'Next 30 days', min: 0, max: 30 },
            { key: '31_90', label: '31–90 days', min: 31, max: 90 },
            { key: '91_180', label: '91–180 days', min: 91, max: 180 },
            { key: '181_365', label: '181–365 days', min: 181, max: 365 },
        ].map((b) => ({ key: b.key, label: b.label, count: 0, value: confidential ? 0 : null as number | null, recurring: confidential ? 0 : null as number | null, min: b.min, max: b.max }));
        for (const c of live) {
            const due = c.renewal_date ?? c.end_date ?? c.expiration_date;
            if (!due) continue;
            const d = Math.round((due.getTime() - now.getTime()) / DAY);
            const b = buckets.find((x) => d >= x.min && d <= x.max);
            if (!b) continue;
            b.count += 1;
            if (confidential) { b.value = (b.value ?? 0) + n(c.total_value); b.recurring = (b.recurring ?? 0) + n(c.recurring_value); }
        }
        const typeName = new Map(types.map((t) => [t.id, t.name]));
        const signatureTurnaround = requests.map((r) => days(r.sent_at, r.completed_at)).filter((x): x is number => x !== null);

        return {
            range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
            values_visible: confidential,
            kpis: {
                cycle_time_days: median(signed.map((c) => days(c.draft_date ?? c.created_at, c.signature_date)).filter((x): x is number => x !== null)),
                approval_time_days: median(approvals.map((a) => days(a.requested_at, a.decided_at)).filter((x): x is number => x !== null)),
                signature_turnaround_days: median(signatureTurnaround),
                signed_in_range: signed.length,
                renewal_rate: ended.length ? Math.round((renewed / ended.length) * 1000) / 10 : null,
                renewed, due_for_renewal: ended.length,
                overdue_obligations: overdueObligations,
                active_value: confidential ? live.reduce((s, c) => s + n(c.total_value), 0) : null,
                active_count: live.length,
            },
            cycle_by_stage: [
                { stage: 'draft_to_approval', days: median(signed.map((c) => days(c.draft_date ?? c.created_at, c.approval_date)).filter((x): x is number => x !== null)) },
                { stage: 'approval', days: median(approvals.map((a) => days(a.requested_at, a.decided_at)).filter((x): x is number => x !== null)) },
                { stage: 'approval_to_signature', days: median(signed.map((c) => days(c.approval_date, c.signature_date)).filter((x): x is number => x !== null)) },
                { stage: 'signature', days: median(signatureTurnaround) },
            ],
            by_status: byStatus.map((s) => ({ status: s.status, count: s._count._all, value: confidential ? n(s._sum.total_value) : null })).sort((a, b) => b.count - a.count),
            by_type: byType.map((t) => ({ type_id: t.type_id, type: t.type_id ? typeName.get(t.type_id) ?? 'Unknown type' : 'No type', count: t._count._all, value: confidential ? n(t._sum.total_value) : null, recurring: confidential ? n(t._sum.recurring_value) : null })).sort((a, b) => b.count - a.count),
            signed_per_month: months,
            risk: risk.map((r) => ({ level: r.risk_level, count: r._count._all })),
            renewals_pipeline: buckets.map(({ min: _a, max: _b, ...b }) => b),
            slowest_in_flight: inFlight.map((c) => ({ id: c.id, number: c.number, title: c.title, status: c.status, company: c.primary_company?.name ?? null, days_in_stage: Math.floor((Date.now() - c.updated_at.getTime()) / DAY), since: c.updated_at })),
            window_end: addDays(now, 365).toISOString().slice(0, 10),
        };
    }
}
