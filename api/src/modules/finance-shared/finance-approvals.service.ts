import { ForbiddenException, Injectable } from '@nestjs/common';
import { FinanceApprovalDecision, FinanceApprovalEntityType, FinanceApprovalRule, LedgerRecordType, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { dec, DecimalLike } from './money.utils';

interface RuleStep {
    step?: number;
    name?: string;
    approver?: { membership_id?: string; role_id?: string; team_id?: string };
}

export interface ApprovalSubject {
    amount: DecimalLike;
    currency: string;
    branch_id?: string | null;
    record_type?: LedgerRecordType | null;
}

/**
 * One approval policy for every money movement (08 "Invoicing" / 09 "Audit Trail"): FinanceApprovalRule decides whether an
 * item needs approval and by whom; FinanceApproval rows record each step. The requester can never approve their own item
 * when the rule says so (01 §96). Used by invoices, refunds, credit notes (08) and ledger records, expense claims (09).
 */
@Injectable()
export class FinanceApprovalsService {
    constructor(private readonly prisma: PrismaService) { }

    /** First enabled rule (lowest priority) whose amount band, currency, branch and record type match. */
    async matchRule(organizationId: string, entityType: FinanceApprovalEntityType, subject: ApprovalSubject): Promise<FinanceApprovalRule | null> {
        const rules = await this.prisma.financeApprovalRule.findMany({
            where: { organization_id: organizationId, entity_type: entityType, enabled: true },
            orderBy: [{ priority: 'asc' }, { created_at: 'asc' }],
        });
        const amount = dec(subject.amount);
        return (
            rules.find((r) => {
                if (r.currency && r.currency !== subject.currency) return false;
                if (r.branch_id && r.branch_id !== (subject.branch_id ?? null)) return false;
                if (r.record_type && subject.record_type && r.record_type !== subject.record_type) return false;
                if (amount.lessThan(dec(r.min_amount))) return false;
                if (r.max_amount !== null && amount.greaterThan(dec(r.max_amount))) return false;
                return true;
            }) ?? null
        );
    }

    /** Open the approval steps of a rule (or one manual step when `rule` is null). Replaces older pending requests. */
    async request(ctx: OrgContext, entityType: FinanceApprovalEntityType, entityId: string, rule: FinanceApprovalRule | null, subject: ApprovalSubject, tx?: Prisma.TransactionClient) {
        const client = tx ?? this.prisma;
        await client.financeApproval.updateMany({
            where: { organization_id: ctx.organization_id, entity_type: entityType, entity_id: entityId, decision: FinanceApprovalDecision.PENDING },
            data: { decision: FinanceApprovalDecision.CANCELLED, decided_at: new Date() },
        });
        const steps: RuleStep[] = Array.isArray(rule?.steps) && (rule!.steps as unknown[]).length ? (rule!.steps as RuleStep[]) : [{ step: 1, name: 'Approval' }];
        await client.financeApproval.createMany({
            data: steps.map((s, i) => ({
                organization_id: ctx.organization_id,
                entity_type: entityType,
                entity_id: entityId,
                rule_id: rule?.id ?? null,
                step: s.step ?? i + 1,
                approver_membership_id: s.approver?.membership_id ?? null,
                approver_role_id: s.approver?.role_id ?? null,
                requested_by_membership_id: ctx.membership_id,
                amount: dec(subject.amount),
                currency: subject.currency,
            })),
        });
    }

    async pending(organizationId: string, entityType: FinanceApprovalEntityType, entityId: string) {
        return this.prisma.financeApproval.findMany({
            where: { organization_id: organizationId, entity_type: entityType, entity_id: entityId, decision: FinanceApprovalDecision.PENDING },
            orderBy: { step: 'asc' },
            include: { rule: { select: { require_distinct_user: true, name: true } } },
        });
    }

    async history(organizationId: string, entityType: FinanceApprovalEntityType, entityId: string) {
        return this.prisma.financeApproval.findMany({ where: { organization_id: organizationId, entity_type: entityType, entity_id: entityId }, orderBy: [{ requested_at: 'asc' }, { step: 'asc' }] });
    }

    /**
     * Decide the current step. Returns `approved: true` when no step is left (the caller then stamps the target),
     * `rejected: true` on rejection. Enforces separation of duties and named approvers.
     */
    async decide(
        ctx: OrgContext,
        entityType: FinanceApprovalEntityType,
        entityId: string,
        input: { approve: boolean; comment?: string | null; reason?: string | null; requester_membership_id?: string | null; require_distinct?: boolean },
        tx?: Prisma.TransactionClient,
    ) {
        const client = tx ?? this.prisma;
        const open = await client.financeApproval.findMany({
            where: { organization_id: ctx.organization_id, entity_type: entityType, entity_id: entityId, decision: FinanceApprovalDecision.PENDING },
            orderBy: { step: 'asc' },
            include: { rule: { select: { require_distinct_user: true } } },
        });
        const current = open[0];
        const requester = current?.requested_by_membership_id ?? input.requester_membership_id ?? null;
        const distinct = input.require_distinct ?? current?.rule?.require_distinct_user ?? true;
        if (distinct && requester && ctx.membership_id && requester === ctx.membership_id) {
            throw new ForbiddenException({ message: 'You cannot approve an item you requested (separation of duties)', code: 'approval_self_not_allowed' });
        }
        if (current?.approver_membership_id && ctx.membership_id && current.approver_membership_id !== ctx.membership_id) {
            throw new ForbiddenException({ message: 'This approval step is assigned to another member', code: 'approval_not_assignee' });
        }
        if (!current) return { approved: input.approve, rejected: !input.approve, step: null };

        await client.financeApproval.update({
            where: { id: current.id },
            data: {
                decision: input.approve ? FinanceApprovalDecision.APPROVED : FinanceApprovalDecision.REJECTED,
                decided_by_membership_id: ctx.membership_id,
                decided_at: new Date(),
                comment: input.comment ?? null,
                rejection_reason: input.approve ? null : input.reason ?? null,
            },
        });
        if (!input.approve) {
            await client.financeApproval.updateMany({
                where: { id: { in: open.slice(1).map((o) => o.id) } },
                data: { decision: FinanceApprovalDecision.CANCELLED, decided_at: new Date() },
            });
            return { approved: false, rejected: true, step: current.step };
        }
        return { approved: open.length === 1, rejected: false, step: current.step };
    }

    async cancel(organizationId: string, entityType: FinanceApprovalEntityType, entityId: string, tx?: Prisma.TransactionClient) {
        await (tx ?? this.prisma).financeApproval.updateMany({
            where: { organization_id: organizationId, entity_type: entityType, entity_id: entityId, decision: FinanceApprovalDecision.PENDING },
            data: { decision: FinanceApprovalDecision.CANCELLED, decided_at: new Date() },
        });
    }
}
