import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingInterval, DunningAction, InvoiceStatus, ModuleKey, Prisma, Subscription, SubscriptionStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { addDays, addInterval, dec, monthlyEquivalent, round2, sum, todayUtc, toDateOnly } from '@/modules/finance-shared/money.utils';
import { scopeFilter } from '@/modules/finance-shared/finance-scope.utils';
import { systemContext } from '@/modules/finance-shared/system-context.utils';
import { LedgerSyncService } from '@/modules/ledger/services/ledger-sync.service';
import { InvoicesService, OPEN_STATUSES } from './invoices.service';
import { CatalogService } from './catalog.service';
import { CancelSubscriptionDto, ChangePlanDto, CreateSubscriptionDto, SubscriptionQuery } from '../dto/billing.schemas';

const READ = 'finance.subscriptions.read';
const M = ModuleKey.FINANCE;
const LIVE: SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE];
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * 08 "Subscription Management" / "Recurring Billing" — the platform runs the schedule itself (no provider-native
 * subscription yet): a daily job creates and finalizes the invoice of each new period in advance, rolls periods, applies
 * scheduled cancellations, marks overdue invoices and runs the dunning steps.
 */
@Injectable()
export class SubscriptionsService {
    private readonly logger = new Logger(SubscriptionsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly invoices: InvoicesService,
        private readonly catalog: CatalogService,
        private readonly ledger: LedgerSyncService,
    ) { }

    private scope(ctx: OrgContext): Prisma.SubscriptionWhereInput {
        return scopeFilter(ctx, READ, { company: 'company_id', project: 'project_id' }) as Prisma.SubscriptionWhereInput;
    }

    async findAll(ctx: OrgContext, q: SubscriptionQuery) {
        const where: Prisma.SubscriptionWhereInput = {
            organization_id: ctx.organization_id,
            AND: [this.scope(ctx), ...(q.search ? [{ OR: [{ company: { name: { contains: q.search, mode: 'insensitive' as const } } }, { items: { some: { description: { contains: q.search, mode: 'insensitive' as const } } } }, { items: { some: { product: { name: { contains: q.search, mode: 'insensitive' as const } } } } }] }] : [])],
            ...(q.status?.length && { status: { in: q.status } }),
            ...(q.company_id && { company_id: q.company_id }),
            ...(q.billing_profile_id && { billing_profile_id: q.billing_profile_id }),
        };
        const [items, total, live] = await Promise.all([
            this.prisma.subscription.findMany({ where, ...skipTake(q), orderBy: orderBy(q, ['created_at', 'current_period_end', 'period_amount'], 'created_at'), include: { company: { select: { id: true, name: true } }, items: { include: { product: { select: { id: true, name: true } } } } } }),
            this.prisma.subscription.count({ where }),
            this.prisma.subscription.findMany({ where: { organization_id: ctx.organization_id, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] }, AND: [this.scope(ctx)] }, select: { period_amount: true, interval: true, interval_count: true, currency: true } }),
        ]);
        const mrr = round2(sum(live.map((s) => monthlyEquivalent(s.period_amount, s.interval, s.interval_count))));
        return { ...paginate(items, total, q), mrr: mrr.toString(), arr: round2(mrr.times(12)).toString(), active: live.length };
    }

    async findOne(ctx: OrgContext, id: string) {
        const s = await this.prisma.subscription.findFirst({
            where: { id, organization_id: ctx.organization_id, AND: [this.scope(ctx)] },
            include: {
                company: { select: { id: true, name: true } }, billing_profile: { select: { id: true, legal_name: true, billing_email: true, payment_terms_days: true } },
                project: { select: { id: true, name: true } }, coupon: { select: { id: true, name: true, type: true, value: true } },
                items: { include: { product: { select: { id: true, name: true } }, price: { select: { id: true, unit_amount: true, currency: true, interval: true } } }, orderBy: { created_at: 'asc' } },
                invoices: { orderBy: { created_at: 'desc' }, take: 24, select: { id: true, number: true, status: true, total: true, amount_due: true, currency: true, period_start: true, period_end: true, issue_date: true } },
                provider_connection: { select: { id: true, display_name: true } },
            },
        });
        if (!s) throw new NotFoundException({ message: 'Subscription not found', code: 'subscription_not_found' });
        const history = await this.prisma.auditEvent.findMany({ where: { organization_id: ctx.organization_id, resource_type: 'subscription', resource_id: id }, orderBy: { created_at: 'desc' }, take: 50, select: { id: true, event_type: true, created_at: true, metadata: true, actor_user: { select: { display_name: true, first_name: true, last_name: true, email: true } } } });
        return { ...s, mrr: round2(monthlyEquivalent(s.period_amount, s.interval, s.interval_count)).toString(), next_invoice_date: LIVE.includes(s.status) && !s.cancel_at_period_end ? iso(this.nextInvoiceDate(s)) : null, history };
    }

    async create(ctx: OrgContext, dto: CreateSubscriptionDto) {
        const profile = await this.prisma.billingProfile.findFirst({ where: { id: dto.billing_profile_id, organization_id: ctx.organization_id } });
        if (!profile) throw new NotFoundException({ message: 'Billing profile not found', code: 'billing_profile_not_found' });
        if (!this.invoices.authorizedFor(ctx, 'finance.subscriptions.manage', { company_id: profile.company_id, project_id: dto.project_id })) throw new ForbiddenException({ message: 'Customer outside your scope', code: 'out_of_scope' });
        const currency = dto.currency ?? profile.currency;
        const items = await this.resolveItems(ctx, dto.items, currency);
        const firstPrice = items.find((i) => i.interval);
        const interval = dto.interval ?? firstPrice?.interval ?? 'MONTH';
        const intervalCount = dto.interval_count ?? firstPrice?.interval_count ?? 1;
        const coupon = await this.catalog.usableCoupon(ctx, dto.coupon_id, currency);
        if (dto.project_id && !(await this.prisma.project.findFirst({ where: { id: dto.project_id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Project not found', code: 'project_not_found' });
        const start = toDateOnly(dto.start_date) ?? todayUtc();
        const trialDays = dto.trial_days ?? items.reduce((m, i) => Math.max(m, i.trial_days ?? 0), 0);
        const trialEnd = trialDays ? addDays(start, trialDays) : null;
        const periodStart = trialEnd ?? start;
        const setupFee = dto.setup_fee !== undefined && dto.setup_fee !== null ? dec(dto.setup_fee) : items.reduce((acc, i) => acc.plus(i.setup_fee ?? 0), dec(0));
        const sub = await this.prisma.subscription.create({
            data: {
                organization_id: ctx.organization_id, billing_profile_id: profile.id, company_id: profile.company_id, project_id: dto.project_id ?? null, contract_id: dto.contract_id ?? null,
                status: trialEnd ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE, currency, interval, interval_count: intervalCount,
                collection_method: dto.collection_method ?? 'SEND_INVOICE', coupon_id: coupon?.id ?? null, trial_start: trialEnd ? start : null, trial_end: trialEnd,
                current_period_start: periodStart, current_period_end: addInterval(periodStart, interval, intervalCount), started_at: start,
                setup_fee: setupFee.greaterThan(0) ? setupFee : null, provider_connection_id: dto.provider_connection_id ?? null,
                period_amount: round2(sum(items.map((i) => dec(i.quantity).times(i.unit_amount)))), created_by_user_id: ctx.user_id,
                items: { create: items.map((i) => ({ product_id: i.product_id, price_id: i.price_id, description: i.description, quantity: dec(i.quantity), unit_amount: dec(i.unit_amount) })) },
            },
        });
        await this.audit.record(ctx, 'finance.subscription.created', { resource_type: 'subscription', resource_id: sub.id, metadata: { period_amount: sub.period_amount.toString(), currency, interval, items: items.length, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.subscription.created', module: M, entity_kind: 'subscription', entity_id: sub.id, payload: { company_id: sub.company_id, period_amount: sub.period_amount.toString() }, activity: { summary: `Subscription started (${sub.period_amount} ${currency} / ${intervalCount > 1 ? `${intervalCount} ` : ''}${interval.toLowerCase()})`, company_id: sub.company_id, project_id: sub.project_id } });
        // First invoice now when the period already started (no trial).
        if (!trialEnd && periodStart <= todayUtc()) await this.invoicePeriod(ctx, sub.id);
        return this.findOne(ctx, sub.id);
    }

    async changePlan(ctx: OrgContext, id: string, dto: ChangePlanDto) {
        const before = await this.getForWrite(ctx, id);
        if (!LIVE.includes(before.status) && before.status !== SubscriptionStatus.PAUSED) throw new ConflictException({ message: 'Only live subscriptions can change plan', code: 'subscription_not_live' });
        const items = await this.resolveItems(ctx, dto.items, before.currency);
        const amount = round2(sum(items.map((i) => dec(i.quantity).times(i.unit_amount))));
        await this.prisma.$transaction(async (tx) => {
            await tx.subscriptionItem.deleteMany({ where: { subscription_id: id } });
            await tx.subscriptionItem.createMany({ data: items.map((i) => ({ subscription_id: id, product_id: i.product_id, price_id: i.price_id, description: i.description, quantity: dec(i.quantity), unit_amount: dec(i.unit_amount) })) });
            await tx.subscription.update({ where: { id }, data: { period_amount: amount, ...(dto.interval && { interval: dto.interval }), ...(dto.interval_count && { interval_count: dto.interval_count }) } });
        });
        const kind = amount.greaterThan(before.period_amount) ? 'upgraded' : amount.lessThan(before.period_amount) ? 'downgraded' : 'changed';
        await this.audit.record(ctx, `finance.subscription.${kind}`, { resource_type: 'subscription', resource_id: id, metadata: { before: { period_amount: before.period_amount.toString(), interval: before.interval }, after: { period_amount: amount.toString(), interval: dto.interval, items: items.length }, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.subscription.updated', module: M, entity_kind: 'subscription', entity_id: id, payload: { change: kind, period_amount: amount.toString() } });
        return this.findOne(ctx, id);
    }

    async pause(ctx: OrgContext, id: string, resumeAt?: string | null) {
        const s = await this.getForWrite(ctx, id);
        if (!LIVE.includes(s.status)) throw new ConflictException({ message: 'Only live subscriptions can be paused', code: 'subscription_not_live' });
        await this.prisma.subscription.update({ where: { id }, data: { status: SubscriptionStatus.PAUSED, paused_at: new Date(), resume_at: toDateOnly(resumeAt) } });
        return this.logStatus(ctx, id, 'paused', { resume_at: resumeAt });
    }

    async resume(ctx: OrgContext, id: string) {
        const s = await this.getForWrite(ctx, id);
        if (s.status !== SubscriptionStatus.PAUSED) throw new ConflictException({ message: 'Only paused subscriptions can be resumed', code: 'subscription_not_paused' });
        const today = todayUtc();
        await this.prisma.subscription.update({ where: { id }, data: { status: SubscriptionStatus.ACTIVE, paused_at: null, resume_at: null, current_period_start: today, current_period_end: addInterval(today, s.interval, s.interval_count) } });
        await this.invoicePeriod(ctx, id);
        return this.logStatus(ctx, id, 'resumed');
    }

    async cancel(ctx: OrgContext, id: string, dto: CancelSubscriptionDto) {
        const s = await this.getForWrite(ctx, id);
        if (s.status === SubscriptionStatus.CANCELLED || s.status === SubscriptionStatus.EXPIRED) throw new ConflictException({ message: 'Already cancelled', code: 'subscription_cancelled' });
        const at = dto.at ?? 'period_end';
        if (at === 'now') {
            await this.prisma.subscription.update({ where: { id }, data: { status: SubscriptionStatus.CANCELLED, cancelled_at: new Date(), ended_at: new Date(), cancellation_reason: dto.reason ?? null, cancel_at_period_end: false } });
        } else {
            const when = at === 'date' && dto.date ? toDateOnly(dto.date)! : s.current_period_end ?? todayUtc();
            await this.prisma.subscription.update({ where: { id }, data: { cancel_at: when, cancel_at_period_end: at === 'period_end', cancellation_reason: dto.reason ?? null } });
        }
        return this.logStatus(ctx, id, at === 'now' ? 'cancelled' : 'cancellation_scheduled', { at, date: dto.date, reason: dto.reason });
    }

    /** Undo a scheduled cancellation. */
    async reactivate(ctx: OrgContext, id: string) {
        const s = await this.getForWrite(ctx, id);
        if (!s.cancel_at) throw new ConflictException({ message: 'No cancellation is scheduled', code: 'subscription_not_cancelling' });
        await this.prisma.subscription.update({ where: { id }, data: { cancel_at: null, cancel_at_period_end: false, cancellation_reason: null } });
        return this.logStatus(ctx, id, 'reactivated');
    }

    /** Create the invoice of the current period now (idempotent per period). */
    async invoicePeriod(ctx: OrgContext, id: string) {
        const s = await this.prisma.subscription.findFirst({ where: { id, organization_id: ctx.organization_id }, include: { items: true, billing_profile: true } });
        if (!s || !s.current_period_start || !s.current_period_end) return null;
        const exists = await this.prisma.invoice.findFirst({ where: { subscription_id: id, period_start: s.current_period_start, status: { notIn: [InvoiceStatus.VOID, InvoiceStatus.CANCELLED] } }, select: { id: true } });
        if (exists) return exists;
        const periodEnd = addDays(s.current_period_end, -1);
        const lines = s.items.map((i) => ({ product_id: i.product_id, price_id: i.price_id, description: i.description ?? 'Subscription', quantity: i.quantity.toString(), unit_amount: i.unit_amount.toString(), period_start: iso(s.current_period_start), period_end: iso(periodEnd) }));
        if (s.setup_fee && !s.setup_fee_invoiced_at) lines.push({ product_id: null, price_id: null, description: 'Setup fee', quantity: '1', unit_amount: s.setup_fee.toString(), period_start: null, period_end: null });
        const draft = await this.invoices.create(ctx, {
            billing_profile_id: s.billing_profile_id, project_id: s.project_id, contract_id: s.contract_id, subscription_id: s.id, currency: s.currency, billing_model: 'RECURRING',
            issue_date: iso(todayUtc()), period_start: iso(s.current_period_start), period_end: iso(periodEnd), coupon_id: s.coupon_id, collection_method: s.collection_method, provider_connection_id: s.provider_connection_id,
            lines,
        });
        const finalized = await this.prisma.$transaction(async (tx) => {
            if (s.setup_fee && !s.setup_fee_invoiced_at) await tx.subscription.update({ where: { id }, data: { setup_fee_invoiced_at: new Date() } });
            return this.invoices.finalize(ctx, tx, draft.id);
        });
        await this.audit.record(ctx, 'finance.invoice.generated', { resource_type: 'invoice', resource_id: draft.id, metadata: { subscription_id: id, number: finalized.number, period_start: iso(s.current_period_start) } });
        this.events.publish(ctx, { event_key: 'finance.invoice.generated', module: M, entity_kind: 'invoice', entity_id: draft.id, payload: { number: finalized.number, subscription_id: id, total: finalized.total.toString() } });
        await this.ledger.syncInvoiceSafe(ctx, draft.id);
        return finalized;
    }

    private nextInvoiceDate(s: Pick<Subscription, 'current_period_start' | 'current_period_end' | 'status' | 'trial_end'>) {
        if (s.status === SubscriptionStatus.TRIALING) return s.trial_end;
        return s.current_period_end;
    }

    // --- Daily job ------------------------------------------------------------------------------------------------

    @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'billing-daily' })
    async runDaily() {
        const today = todayUtc();
        // 1. Subscriptions: trials ending, scheduled cancellations, resumes, period roll-over + invoice in advance.
        const subs = await this.prisma.subscription.findMany({ where: { OR: [{ status: { in: LIVE }, current_period_end: { lte: today } }, { status: SubscriptionStatus.TRIALING, trial_end: { lte: today } }, { status: { in: LIVE }, cancel_at: { lte: today } }, { status: SubscriptionStatus.PAUSED, resume_at: { lte: today } }] }, take: 1000 });
        for (const s of subs) {
            const ctx = systemContext(s.organization_id);
            try {
                if (s.status === SubscriptionStatus.PAUSED) {
                    await this.prisma.subscription.update({ where: { id: s.id }, data: { status: SubscriptionStatus.ACTIVE, paused_at: null, resume_at: null, current_period_start: today, current_period_end: addInterval(today, s.interval, s.interval_count) } });
                    await this.invoicePeriod(ctx, s.id);
                    continue;
                }
                if (s.cancel_at && s.cancel_at <= today) {
                    await this.prisma.subscription.update({ where: { id: s.id }, data: { status: SubscriptionStatus.CANCELLED, cancelled_at: new Date(), ended_at: new Date() } });
                    await this.audit.record(ctx, 'finance.subscription.cancelled', { resource_type: 'subscription', resource_id: s.id, metadata: { scheduled: true } });
                    this.events.publish(ctx, { event_key: 'finance.subscription.cancelled', module: M, entity_kind: 'subscription', entity_id: s.id });
                    continue;
                }
                if (s.status === SubscriptionStatus.TRIALING && s.trial_end && s.trial_end <= today) {
                    await this.prisma.subscription.update({ where: { id: s.id }, data: { status: SubscriptionStatus.ACTIVE, current_period_start: s.trial_end, current_period_end: addInterval(s.trial_end, s.interval, s.interval_count) } });
                    await this.invoicePeriod(ctx, s.id);
                    continue;
                }
                // Roll forward (catch up at most 12 periods).
                let start = s.current_period_end!;
                let guard = 0;
                while (addInterval(start, s.interval, s.interval_count) <= today && guard++ < 12) start = addInterval(start, s.interval, s.interval_count);
                await this.prisma.subscription.update({ where: { id: s.id }, data: { current_period_start: start, current_period_end: addInterval(start, s.interval, s.interval_count) } });
                await this.invoicePeriod(ctx, s.id);
                this.events.publish(ctx, { event_key: 'finance.subscription.renewed', module: M, entity_kind: 'subscription', entity_id: s.id });
            } catch (error) {
                this.logger.error(`subscription ${s.id} failed: ${(error as Error).message}`);
            }
        }

        // 2. Scheduled invoices whose send time came: open them.
        await this.prisma.invoice.updateMany({ where: { status: InvoiceStatus.SCHEDULED, scheduled_send_at: { lte: new Date() } }, data: { status: InvoiceStatus.OPEN } });

        // 3. Overdue invoices.
        const overdue = await this.prisma.invoice.findMany({ where: { status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PENDING] }, due_date: { lt: today }, amount_due: { gt: 0 } }, select: { id: true, organization_id: true, number: true, subscription_id: true } });
        for (const inv of overdue) {
            const ctx = systemContext(inv.organization_id);
            await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: InvoiceStatus.OVERDUE } });
            if (inv.subscription_id) await this.prisma.subscription.updateMany({ where: { id: inv.subscription_id, status: SubscriptionStatus.ACTIVE }, data: { status: SubscriptionStatus.PAST_DUE } });
            await this.audit.record(ctx, 'finance.invoice.overdue', { resource_type: 'invoice', resource_id: inv.id, metadata: { number: inv.number } });
            this.events.publish(ctx, { event_key: 'finance.invoice.overdue', module: M, entity_kind: 'invoice', entity_id: inv.id, payload: { number: inv.number } });
            await this.ledger.syncInvoiceSafe(ctx, inv.id);
        }
        // Past-due subscriptions whose invoices are all paid go back to ACTIVE.
        await this.prisma.subscription.updateMany({ where: { status: SubscriptionStatus.PAST_DUE, invoices: { none: { status: InvoiceStatus.OVERDUE } } }, data: { status: SubscriptionStatus.ACTIVE } });

        // 4. Dunning: steps relative to the due date, one reminder per step.
        await this.runDunning(today);
    }

    private async runDunning(today: Date) {
        const open = await this.prisma.invoice.findMany({
            where: { status: { in: OPEN_STATUSES }, due_date: { not: null }, amount_due: { gt: 0 }, uncollectible_at: null },
            select: { id: true, organization_id: true, due_date: true, subscription_id: true, billing_profile: { select: { dunning_policy_id: true } }, reminders: { select: { offset_days: true, action: true } } },
            take: 2000,
        });
        const policies = new Map<string, { offset_days: number; action: DunningAction }[] | null>();
        for (const inv of open) {
            const key = inv.billing_profile.dunning_policy_id ?? `default:${inv.organization_id}`;
            if (!policies.has(key)) {
                const p = inv.billing_profile.dunning_policy_id
                    ? await this.prisma.dunningPolicy.findUnique({ where: { id: inv.billing_profile.dunning_policy_id } })
                    : await this.prisma.dunningPolicy.findFirst({ where: { organization_id: inv.organization_id, is_default: true } });
                policies.set(key, p ? ((p.steps as { offset_days: number; action: DunningAction }[]) ?? []) : null);
            }
            const steps = policies.get(key);
            if (!steps?.length) continue;
            const days = Math.round((today.getTime() - inv.due_date!.getTime()) / 86_400_000);
            const ctx = systemContext(inv.organization_id);
            for (const step of steps) {
                if (step.offset_days > days) continue;
                if (inv.reminders.some((r) => r.offset_days !== null && r.offset_days >= step.offset_days && r.action === step.action)) continue;
                try {
                    if (step.action === DunningAction.REMINDER || step.action === DunningAction.NOTIFY_OWNER || step.action === DunningAction.RETRY_PAYMENT) {
                        await this.invoices.remind(ctx, inv.id, null, step.action, true);
                    } else if (step.action === DunningAction.MARK_UNCOLLECTIBLE) {
                        await this.invoices.writeOff(ctx, inv.id, 'Dunning policy: marked uncollectible');
                    } else if (inv.subscription_id && (step.action === DunningAction.PAUSE_SUBSCRIPTION || step.action === DunningAction.CANCEL_SUBSCRIPTION)) {
                        await this.prisma.subscription.update({ where: { id: inv.subscription_id }, data: step.action === DunningAction.PAUSE_SUBSCRIPTION ? { status: SubscriptionStatus.PAUSED, paused_at: new Date() } : { status: SubscriptionStatus.CANCELLED, cancelled_at: new Date(), ended_at: new Date(), cancellation_reason: 'Dunning: unpaid invoice' } });
                        await this.prisma.invoiceReminder.create({ data: { invoice_id: inv.id, action: step.action, offset_days: days } });
                        await this.audit.record(ctx, `finance.subscription.${step.action === DunningAction.PAUSE_SUBSCRIPTION ? 'paused' : 'cancelled'}`, { resource_type: 'subscription', resource_id: inv.subscription_id, metadata: { dunning: true, invoice_id: inv.id } });
                    }
                } catch (error) {
                    this.logger.warn(`dunning ${inv.id} ${step.action} failed: ${(error as Error).message}`);
                }
            }
        }
    }

    // --- helpers -----------------------------------------------------------------------------------------------------

    private async getForWrite(ctx: OrgContext, id: string) {
        const s = await this.prisma.subscription.findFirst({ where: { id, organization_id: ctx.organization_id, AND: [this.scope(ctx)] } });
        if (!s) throw new NotFoundException({ message: 'Subscription not found', code: 'subscription_not_found' });
        if (!this.invoices.authorizedFor(ctx, 'finance.subscriptions.manage', s)) throw new ForbiddenException({ message: 'You do not have permission to do this (finance.subscriptions.manage)', code: 'permission_denied' });
        return s;
    }

    private async logStatus(ctx: OrgContext, id: string, action: string, metadata: Record<string, unknown> = {}) {
        await this.audit.record(ctx, `finance.subscription.${action}`, { resource_type: 'subscription', resource_id: id, metadata: { ...metadata, sensitive: true } });
        this.events.publish(ctx, { event_key: `finance.subscription.${action}`, module: M, entity_kind: 'subscription', entity_id: id, payload: metadata });
        return this.findOne(ctx, id);
    }

    private async resolveItems(ctx: OrgContext, items: CreateSubscriptionDto['items'], currency: string) {
        const out: { product_id: string | null; price_id: string | null; description: string | null; quantity: string; unit_amount: string; interval: BillingInterval | null; interval_count: number | null; trial_days: number | null; setup_fee: Prisma.Decimal | null }[] = [];
        for (const i of items) {
            const price = i.price_id ? await this.prisma.price.findFirst({ where: { id: i.price_id, product: { organization_id: ctx.organization_id } }, include: { product: true } }) : null;
            if (i.price_id && !price) throw new NotFoundException({ message: 'Price not found', code: 'price_not_found' });
            if (price && price.currency !== currency) throw new ConflictException({ message: `Price ${price.product.name} is in ${price.currency}`, code: 'price_currency_mismatch' });
            const product = price?.product ?? (i.product_id ? await this.prisma.product.findFirst({ where: { id: i.product_id, organization_id: ctx.organization_id } }) : null);
            if (i.product_id && !product) throw new NotFoundException({ message: 'Product not found', code: 'product_not_found' });
            const unit = i.unit_amount ?? price?.unit_amount.toString();
            if (unit === undefined) throw new ConflictException({ message: 'Each item needs a price or an amount', code: 'subscription_item_amount' });
            out.push({ product_id: product?.id ?? null, price_id: price?.id ?? null, description: i.description ?? product?.name ?? null, quantity: i.quantity ?? '1', unit_amount: unit, interval: price?.interval ?? null, interval_count: price?.interval_count ?? null, trial_days: price?.trial_days ?? null, setup_fee: price?.setup_fee ?? null });
        }
        return out;
    }
}
