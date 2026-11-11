import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FinanceApprovalDecision, FinanceApprovalEntityType, ModuleKey, Prisma } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { dec } from '@/modules/finance-shared/money.utils';
import { ApprovalRuleDto, DunningPolicyDto, ProjectBillingDto } from '../dto/billing.schemas';

const M = ModuleKey.FINANCE;

/** 08 dunning policies, finance approval rules + the approval inbox, and project billing settings. */
@Injectable()
export class BillingSetupService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    // --- Dunning ---------------------------------------------------------------------------------------------------
    listDunning(ctx: OrgContext) {
        return this.prisma.dunningPolicy.findMany({ where: { organization_id: ctx.organization_id }, orderBy: [{ is_default: 'desc' }, { name: 'asc' }], include: { _count: { select: { billing_profiles: true } } } });
    }

    async saveDunning(ctx: OrgContext, dto: DunningPolicyDto, id?: string) {
        if (id && !(await this.prisma.dunningPolicy.findFirst({ where: { id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Dunning policy not found', code: 'dunning_policy_not_found' });
        const steps = [...dto.steps].sort((a, b) => a.offset_days - b.offset_days) as unknown as Prisma.InputJsonValue;
        try {
            const row = await this.prisma.$transaction(async (tx) => {
                if (dto.is_default) await tx.dunningPolicy.updateMany({ where: { organization_id: ctx.organization_id, ...(id && { id: { not: id } }) }, data: { is_default: false } });
                const data = { name: dto.name, is_default: dto.is_default ?? false, steps, max_payment_retries: dto.max_payment_retries ?? 3 };
                return id ? tx.dunningPolicy.update({ where: { id }, data }) : tx.dunningPolicy.create({ data: { ...data, organization_id: ctx.organization_id } });
            });
            await this.audit.record(ctx, id ? 'finance.dunning_policy.updated' : 'finance.dunning_policy.created', { resource_type: 'dunning_policy', resource_id: row.id, metadata: { after: dto } });
            this.events.publish(ctx, { event_key: id ? 'finance.dunning_policy.updated' : 'finance.dunning_policy.created', module: M, entity_kind: 'dunning_policy', entity_id: row.id });
            return row;
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ message: 'A policy with this name exists', code: 'dunning_policy_conflict' });
            throw e;
        }
    }

    async deleteDunning(ctx: OrgContext, id: string) {
        const p = await this.prisma.dunningPolicy.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!p) throw new NotFoundException({ message: 'Dunning policy not found', code: 'dunning_policy_not_found' });
        await this.prisma.dunningPolicy.delete({ where: { id } });
        await this.audit.record(ctx, 'finance.dunning_policy.deleted', { resource_type: 'dunning_policy', resource_id: id, metadata: { name: p.name } });
        return { success: true };
    }

    async reminders(ctx: OrgContext) {
        return this.prisma.invoiceReminder.findMany({ where: { invoice: { organization_id: ctx.organization_id } }, orderBy: { sent_at: 'desc' }, take: 100, include: { invoice: { select: { id: true, number: true, amount_due: true, currency: true, company: { select: { name: true } } } } } });
    }

    // --- Approval rules & inbox ------------------------------------------------------------------------------------------
    listRules(ctx: OrgContext) {
        return this.prisma.financeApprovalRule.findMany({ where: { organization_id: ctx.organization_id }, orderBy: [{ entity_type: 'asc' }, { priority: 'asc' }] });
    }

    async saveRule(ctx: OrgContext, dto: ApprovalRuleDto, id?: string) {
        if (id && !(await this.prisma.financeApprovalRule.findFirst({ where: { id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Approval rule not found', code: 'approval_rule_not_found' });
        const memberIds = dto.steps.map((s) => s.approver?.membership_id).filter((x): x is string => !!x);
        if (memberIds.length && (await this.prisma.membership.count({ where: { id: { in: memberIds }, organization_id: ctx.organization_id } })) !== new Set(memberIds).size) throw new NotFoundException({ message: 'Approver not found', code: 'approver_not_found' });
        const data = {
            name: dto.name, entity_type: dto.entity_type, record_type: dto.record_type ?? null, min_amount: dec(dto.min_amount ?? 0), max_amount: dto.max_amount ? dec(dto.max_amount) : null,
            currency: dto.currency ?? null, branch_id: dto.branch_id ?? null, steps: dto.steps.map((s, i) => ({ ...s, step: s.step ?? i + 1 })) as unknown as Prisma.InputJsonValue,
            require_distinct_user: dto.require_distinct_user ?? true, priority: dto.priority ?? 100, enabled: dto.enabled ?? true,
        };
        const row = id ? await this.prisma.financeApprovalRule.update({ where: { id }, data }) : await this.prisma.financeApprovalRule.create({ data: { ...data, organization_id: ctx.organization_id } });
        await this.audit.record(ctx, id ? 'finance.approval_rule.updated' : 'finance.approval_rule.created', { resource_type: 'finance_approval_rule', resource_id: row.id, metadata: { after: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.approval_rule.saved', module: M, entity_kind: 'finance_approval_rule', entity_id: row.id });
        return row;
    }

    async deleteRule(ctx: OrgContext, id: string) {
        const r = await this.prisma.financeApprovalRule.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!r) throw new NotFoundException({ message: 'Approval rule not found', code: 'approval_rule_not_found' });
        await this.prisma.financeApprovalRule.delete({ where: { id } });
        await this.audit.record(ctx, 'finance.approval_rule.deleted', { resource_type: 'finance_approval_rule', resource_id: id, metadata: { name: r.name, sensitive: true } });
        return { success: true };
    }

    /** Pending billing approvals (invoices, refunds, credit notes, write-offs) with the item they refer to. */
    async inbox(ctx: OrgContext) {
        const pending = await this.prisma.financeApproval.findMany({
            where: { organization_id: ctx.organization_id, decision: FinanceApprovalDecision.PENDING, entity_type: { in: [FinanceApprovalEntityType.INVOICE, FinanceApprovalEntityType.REFUND, FinanceApprovalEntityType.CREDIT_NOTE, FinanceApprovalEntityType.WRITE_OFF] } },
            orderBy: { requested_at: 'asc' }, take: 200, include: { rule: { select: { name: true } } },
        });
        const invoiceIds = pending.filter((p) => p.entity_type === 'INVOICE').map((p) => p.entity_id);
        const refundIds = pending.filter((p) => p.entity_type === 'REFUND').map((p) => p.entity_id);
        const [invoices, refunds, drafts] = await Promise.all([
            this.prisma.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, number: true, total: true, currency: true, company: { select: { name: true } }, created_by_user_id: true } }),
            this.prisma.refund.findMany({ where: { id: { in: refundIds } }, select: { id: true, amount: true, reason: true, payment: { select: { id: true, currency: true, billing_profile: { select: { legal_name: true } } } } } }),
            // Draft invoices that a rule says must be approved but nobody has requested yet.
            this.prisma.invoice.findMany({ where: { organization_id: ctx.organization_id, status: 'DRAFT', approved_at: null }, select: { id: true, number: true, total: true, currency: true, branch_id: true, company: { select: { name: true } }, created_by_user_id: true, created_at: true }, take: 200, orderBy: { created_at: 'asc' } }),
        ]);
        const rules = await this.prisma.financeApprovalRule.findMany({ where: { organization_id: ctx.organization_id, entity_type: 'INVOICE', enabled: true } });
        const needsRule = drafts.filter((d) => !invoiceIds.includes(d.id) && rules.some((r) => dec(d.total).greaterThanOrEqualTo(r.min_amount) && (r.max_amount === null || dec(d.total).lessThanOrEqualTo(r.max_amount)) && (!r.currency || r.currency === d.currency) && (!r.branch_id || r.branch_id === d.branch_id)));
        return {
            items: pending.map((p) => ({ ...p, invoice: invoices.find((i) => i.id === p.entity_id) ?? null, refund: refunds.find((r) => r.id === p.entity_id) ?? null })),
            invoices_awaiting: needsRule.map((d) => ({ ...d, mine: d.created_by_user_id === ctx.user_id })),
        };
    }

    // --- Project billing ----------------------------------------------------------------------------------------------------
    async listProjectBilling(ctx: OrgContext, search?: string) {
        const projects = await this.prisma.project.findMany({
            where: { organization_id: ctx.organization_id, ...(search && { name: { contains: search, mode: 'insensitive' } }) },
            select: { id: true, name: true, company: { select: { id: true, name: true } }, billing_settings: true },
            orderBy: { name: 'asc' }, take: 200,
        });
        const totals = await this.prisma.invoice.groupBy({ by: ['project_id'], where: { organization_id: ctx.organization_id, project_id: { in: projects.map((p) => p.id) }, status: { notIn: ['DRAFT', 'VOID', 'CANCELLED'] } }, _sum: { total: true, amount_paid: true, amount_due: true } });
        return projects.map((p) => ({ ...p, invoiced: totals.find((t) => t.project_id === p.id)?._sum ?? { total: 0, amount_paid: 0, amount_due: 0 } }));
    }

    async saveProjectBilling(ctx: OrgContext, projectId: string, dto: ProjectBillingDto) {
        const project = await this.prisma.project.findFirst({ where: { id: projectId, organization_id: ctx.organization_id }, select: { id: true, name: true } });
        if (!project) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        if (dto.default_product_id && !(await this.prisma.product.findFirst({ where: { id: dto.default_product_id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Product not found', code: 'product_not_found' });
        const data = { ...dto, fixed_amount: dto.fixed_amount ? dec(dto.fixed_amount) : null, hourly_rate: dto.hourly_rate ? dec(dto.hourly_rate) : null };
        const row = await this.prisma.projectBillingSettings.upsert({ where: { project_id: projectId }, create: { ...data, project_id: projectId }, update: data });
        await this.audit.record(ctx, 'finance.project_billing.updated', { resource_type: 'project', resource_id: projectId, metadata: { after: dto, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.project_billing.updated', module: M, entity_kind: 'project', entity_id: projectId, changes: dto as Record<string, unknown> });
        return row;
    }
}
