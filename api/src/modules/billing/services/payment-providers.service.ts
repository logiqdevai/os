import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { InvoiceStatus, ModuleKey, PaymentLinkStatus, PaymentProvider, PaymentProviderConnectionStatus, Prisma, RefundStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { encryptJson, secretHint } from '@/shared/utils/crypto/secret-box.utils';
import { dec, round2 } from '@/modules/finance-shared/money.utils';
import { systemContext } from '@/modules/finance-shared/system-context.utils';
import { fromMinor, toMinor } from '@/integrations/payments/payment-provider.adapter';
import { ProviderGatewayService } from './provider-gateway.service';
import { PaymentsService } from './payments.service';
import { InvoicesService, OPEN_STATUSES } from './invoices.service';
import { CheckoutDto, ConnectProviderDto, CreatePaymentLinkDto, PaymentLinkQuery, UpdateProviderDto } from '../dto/billing.schemas';

const M = ModuleKey.FINANCE;
const SAFE_SELECT = {
    id: true, provider: true, display_name: true, status: true, provider_account_id: true, mode: true, integration_connection_id: true, config: true, capabilities: true,
    currencies: true, method_types: true, priority: true, is_default: true, branch_id: true, ledger_payment_method_id: true, connected_at: true, disconnected_at: true,
    last_checked_at: true, last_error: true, created_at: true, updated_at: true,
    branch: { select: { id: true, name: true } }, ledger_payment_method: { select: { id: true, name: true } },
    integration_connection: { select: { id: true, name: true, status: true, secret_hints: true, mode: true } },
} satisfies Prisma.PaymentProviderConnectionSelect;

/**
 * 08 "Payment Providers" — payment connections (BYOK: secrets live encrypted in an IntegrationConnection, never on this row,
 * never returned), verification, routing settings, disconnect blockers, hosted checkout for invoices, payment links and the
 * per-connection webhook endpoint (signature-verified, idempotent through ProviderWebhookEvent).
 */
@Injectable()
export class PaymentProvidersService {
    private readonly logger = new Logger(PaymentProvidersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly gateway: ProviderGatewayService,
        private readonly payments: PaymentsService,
        private readonly invoices: InvoicesService,
        private readonly config: ConfigService,
    ) { }

    private appUrl() {
        return this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    }
    private apiUrl() {
        return this.config.get<string>('API_URL') ?? 'http://localhost:3000';
    }

    // --- Connections ------------------------------------------------------------------------------------------

    async list(ctx: OrgContext) {
        const rows = await this.prisma.paymentProviderConnection.findMany({ where: { organization_id: ctx.organization_id }, orderBy: [{ status: 'asc' }, { priority: 'asc' }, { created_at: 'asc' }], select: SAFE_SELECT });
        const stats = await this.prisma.payment.groupBy({ by: ['provider_connection_id'], where: { organization_id: ctx.organization_id, provider_connection_id: { in: rows.map((r) => r.id) }, status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] } }, _sum: { amount: true, fee_amount: true }, _count: { _all: true } });
        return rows.map((r) => ({ ...r, webhook_url: `${this.apiUrl()}/webhooks/payments/${r.id}`, volume: stats.find((s) => s.provider_connection_id === r.id)?._sum.amount ?? 0, fees: stats.find((s) => s.provider_connection_id === r.id)?._sum.fee_amount ?? 0, payments: stats.find((s) => s.provider_connection_id === r.id)?._count._all ?? 0 }));
    }

    async get(ctx: OrgContext, id: string) {
        const c = await this.prisma.paymentProviderConnection.findFirst({ where: { id, organization_id: ctx.organization_id }, select: SAFE_SELECT });
        if (!c) throw new NotFoundException({ message: 'Payment provider connection not found', code: 'provider_connection_not_found' });
        const [events, blockers] = await Promise.all([
            this.prisma.providerWebhookEvent.findMany({ where: { provider_connection_id: id }, orderBy: { received_at: 'desc' }, take: 25, select: { id: true, event_type: true, provider_event_id: true, received_at: true, processed_at: true, error: true } }),
            this.blockers(ctx, id),
        ]);
        return { ...c, webhook_url: `${this.apiUrl()}/webhooks/payments/${c.id}`, webhook_events: events, disconnect_blockers: blockers };
    }

    async connect(ctx: OrgContext, dto: ConnectProviderDto) {
        if (dto.provider !== PaymentProvider.STRIPE) throw new ConflictException({ message: 'Viva Wallet connections are not available yet', code: 'provider_not_supported' });
        if (!dto.integration_connection_id && !dto.credentials) throw new BadRequestException({ message: 'Enter the API keys or pick saved credentials from Admin → Integrations', code: 'provider_credentials_required' });
        const mode = dto.mode ?? (dto.credentials?.secret_key.startsWith('sk_test') || dto.credentials?.secret_key.startsWith('rk_test') ? 'test' : 'live');
        await this.assertRefs(ctx, dto);

        // 1. Credentials: existing IntegrationConnection, or a new one holding the encrypted secrets (write-only).
        let integrationId = dto.integration_connection_id ?? null;
        if (integrationId) {
            const ic = await this.prisma.integrationConnection.findFirst({ where: { id: integrationId, organization_id: ctx.organization_id, provider: 'STRIPE', category: 'PAYMENTS' } });
            if (!ic) throw new NotFoundException({ message: 'Stripe credentials not found in Admin → Integrations', code: 'integration_not_found' });
        }
        const credentials = dto.credentials;
        if (credentials) {
            const account = await this.gateway.adapter(dto.provider).verify({ secret_key: credentials.secret_key });
            const secrets: Record<string, string> = { secret_key: credentials.secret_key, ...(credentials.webhook_signing_secret && { webhook_signing_secret: credentials.webhook_signing_secret }) };
            const name = await this.uniqueIntegrationName(ctx.organization_id, `${dto.display_name} (${mode})`);
            const ic = await this.prisma.integrationConnection.create({
                data: {
                    organization_id: ctx.organization_id, provider: 'STRIPE', category: 'PAYMENTS', name, status: 'ACTIVE', mode: mode === 'test' ? 'TEST' : 'LIVE', credential_source: 'ORGANIZATION',
                    secret_ciphertext: encryptJson(secrets), secret_hints: Object.fromEntries(Object.entries(secrets).map(([k, v]) => [k, secretHint(v)])),
                    config: { ...(credentials.publishable_key && { publishable_key: credentials.publishable_key }), account_id: account.account_id }, capabilities: account as unknown as Prisma.InputJsonValue,
                    webhook_token: randomBytes(24).toString('hex'), created_by_membership_id: ctx.membership_id, connected_at: new Date(), last_verified_at: new Date(),
                },
            });
            integrationId = ic.id;
            await this.audit.record(ctx, 'integration.connected', { resource_type: 'integration_connection', resource_id: ic.id, metadata: { provider: 'STRIPE', category: 'PAYMENTS', mode, via: 'finance.payment_providers', sensitive: true } });
        }

        // 2. The payment connection that points at it.
        const conn = await this.prisma.$transaction(async (tx) => {
            if (dto.is_default) await tx.paymentProviderConnection.updateMany({ where: { organization_id: ctx.organization_id, mode }, data: { is_default: false } });
            const existingDefault = await tx.paymentProviderConnection.count({ where: { organization_id: ctx.organization_id, mode, is_default: true, status: { not: 'DISCONNECTED' } } });
            return tx.paymentProviderConnection.create({
                data: {
                    organization_id: ctx.organization_id, provider: dto.provider, display_name: dto.display_name, status: PaymentProviderConnectionStatus.PENDING, mode,
                    integration_connection_id: integrationId, currencies: dto.currencies ?? [], method_types: dto.method_types ?? [], priority: dto.priority ?? 100,
                    is_default: dto.is_default ?? existingDefault === 0, branch_id: dto.branch_id ?? null, ledger_payment_method_id: dto.ledger_payment_method_id ?? null,
                    connected_by_user_id: ctx.user_id,
                },
            });
        });
        await this.audit.record(ctx, 'finance.payment_provider.connected', { resource_type: 'payment_provider_connection', resource_id: conn.id, metadata: { provider: dto.provider, mode, display_name: dto.display_name, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.payment_provider.connected', module: M, entity_kind: 'payment_provider_connection', entity_id: conn.id, payload: { provider: dto.provider, mode } });
        return this.verify(ctx, conn.id);
    }

    async verify(ctx: OrgContext, id: string) {
        const conn = await this.gateway.connection(ctx.organization_id, id);
        if (conn.status === PaymentProviderConnectionStatus.DISCONNECTED) throw new ConflictException({ message: 'This connection is disconnected', code: 'provider_disconnected' });
        try {
            const account = await this.gateway.adapter(conn.provider).verify(await this.gateway.credentials(conn));
            const duplicate = await this.prisma.paymentProviderConnection.findFirst({ where: { provider: conn.provider, provider_account_id: account.account_id, mode: conn.mode, id: { not: id } } });
            if (duplicate) throw new ConflictException({ message: 'This provider account is already connected', code: 'provider_account_taken' });
            await this.prisma.paymentProviderConnection.update({
                where: { id },
                data: { status: PaymentProviderConnectionStatus.ACTIVE, provider_account_id: account.account_id, capabilities: account.capabilities, config: { account_name: account.account_name, country: account.country, default_currency: account.default_currency }, connected_at: conn.connected_at ?? new Date(), last_checked_at: new Date(), last_error: null },
            });
            await this.audit.record(ctx, 'finance.payment_provider.verified', { resource_type: 'payment_provider_connection', resource_id: id, metadata: { account_id: account.account_id } });
        } catch (error) {
            const message = (error as { response?: { message?: string } }).response?.message ?? (error as Error).message;
            await this.prisma.paymentProviderConnection.update({ where: { id }, data: { status: PaymentProviderConnectionStatus.ERROR, last_checked_at: new Date(), last_error: message } });
            await this.audit.record(ctx, 'finance.payment_provider.verify_failed', { resource_type: 'payment_provider_connection', resource_id: id, outcome: 'FAILURE', metadata: { error: message } });
            if (error instanceof ConflictException) throw error;
        }
        return this.get(ctx, id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateProviderDto) {
        const before = await this.gateway.connection(ctx.organization_id, id);
        await this.assertRefs(ctx, dto);
        if (dto.credentials) {
            if (!before.integration_connection_id) throw new ConflictException({ message: 'No credentials to rotate', code: 'provider_credentials_missing' });
            await this.gateway.adapter(before.provider).verify({ secret_key: dto.credentials.secret_key });
            const secrets: Record<string, string> = { secret_key: dto.credentials.secret_key, ...(dto.credentials.webhook_signing_secret && { webhook_signing_secret: dto.credentials.webhook_signing_secret }) };
            const ic = await this.prisma.integrationConnection.findUniqueOrThrow({ where: { id: before.integration_connection_id } });
            await this.prisma.integrationConnection.update({ where: { id: ic.id }, data: { secret_ciphertext: encryptJson(secrets), secret_hints: Object.fromEntries(Object.entries(secrets).map(([k, v]) => [k, secretHint(v)])), rotated_at: new Date(), ...(dto.credentials.publishable_key && { config: { ...((ic.config ?? {}) as object), publishable_key: dto.credentials.publishable_key } }) } });
            await this.audit.record(ctx, 'integration.rotated', { resource_type: 'integration_connection', resource_id: ic.id, metadata: { via: 'finance.payment_providers', sensitive: true } });
        }
        const { credentials: _c, mode: _m, ...rest } = dto;
        await this.prisma.$transaction(async (tx) => {
            if (rest.is_default) await tx.paymentProviderConnection.updateMany({ where: { organization_id: ctx.organization_id, mode: before.mode, id: { not: id } }, data: { is_default: false } });
            await tx.paymentProviderConnection.update({ where: { id }, data: rest });
        });
        await this.audit.record(ctx, 'finance.payment_provider.updated', { resource_type: 'payment_provider_connection', resource_id: id, metadata: { before: { display_name: before.display_name, priority: before.priority, is_default: before.is_default, currencies: before.currencies }, after: rest, credentials_rotated: !!dto.credentials, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.payment_provider.updated', module: M, entity_kind: 'payment_provider_connection', entity_id: id, changes: rest as Record<string, unknown> });
        return dto.credentials ? this.verify(ctx, id) : this.get(ctx, id);
    }

    async blockers(ctx: OrgContext, id: string) {
        const [subs, methods, pending] = await Promise.all([
            this.prisma.subscription.count({ where: { provider_connection_id: id, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } } }),
            this.prisma.paymentMethod.count({ where: { provider_connection_id: id, disabled_at: null } }),
            this.prisma.invoice.count({ where: { provider_connection_id: id, status: InvoiceStatus.PENDING } }),
        ]);
        const out: { kind: string; count: number; message: string }[] = [];
        if (subs) out.push({ kind: 'subscriptions', count: subs, message: `${subs} active subscription(s) charge through this connection` });
        if (methods) out.push({ kind: 'payment_methods', count: methods, message: `${methods} saved payment method(s) belong to this connection` });
        if (pending) out.push({ kind: 'pending_payments', count: pending, message: `${pending} invoice(s) have an online payment in progress` });
        return out;
    }

    async disconnect(ctx: OrgContext, id: string) {
        const conn = await this.gateway.connection(ctx.organization_id, id);
        const blockers = await this.blockers(ctx, id);
        if (blockers.length) throw new ConflictException({ message: `Cannot disconnect yet: ${blockers.map((b) => b.message).join('; ')}`, code: 'provider_disconnect_blocked', blockers });
        await this.prisma.paymentProviderConnection.update({ where: { id }, data: { status: PaymentProviderConnectionStatus.DISCONNECTED, disconnected_at: new Date(), is_default: false } });
        await this.prisma.paymentLink.updateMany({ where: { provider_connection_id: id, status: 'ACTIVE' }, data: { status: 'DISABLED' } });
        await this.audit.record(ctx, 'finance.payment_provider.disconnected', { resource_type: 'payment_provider_connection', resource_id: id, metadata: { provider: conn.provider, display_name: conn.display_name, sensitive: true } });
        this.events.publish(ctx, { event_key: 'finance.payment_provider.disconnected', module: M, entity_kind: 'payment_provider_connection', entity_id: id, payload: { provider: conn.provider } });
        return this.get(ctx, id);
    }

    // --- Checkout & payment links -----------------------------------------------------------------------------------

    /** Hosted checkout for an invoice's amount due through the routed connection. */
    async invoiceCheckout(ctx: OrgContext, invoiceId: string, dto: CheckoutDto = {}) {
        const invoice = await this.invoices.getForWrite(ctx, invoiceId, 'finance.invoices.send');
        if (!OPEN_STATUSES.includes(invoice.status) || dec(invoice.amount_due).lessThanOrEqualTo(0)) throw new ConflictException({ message: 'Only unpaid, finalized invoices can be paid online', code: 'invoice_not_open' });
        const profile = await this.prisma.billingProfile.findUniqueOrThrow({ where: { id: invoice.billing_profile_id } });
        const conn = await this.gateway.requireRoute(ctx.organization_id, { connection_id: dto.provider_connection_id ?? invoice.provider_connection_id, preferred_connection_id: profile.preferred_provider_connection_id, currency: invoice.currency, branch_id: invoice.branch_id });
        const session = await this.gateway.adapter(conn.provider).createCheckout(await this.gateway.credentials(conn), {
            amount_cents: toMinor(invoice.amount_due.toString(), invoice.currency), currency: invoice.currency, title: `Invoice ${invoice.number}`, description: profile.legal_name,
            customer_email: profile.billing_email, success_url: dto.success_url ?? `${this.appUrl()}/billing/invoices/${invoice.id}?paid=1`, cancel_url: dto.cancel_url ?? `${this.appUrl()}/billing/invoices/${invoice.id}`,
            metadata: { organization_id: ctx.organization_id, invoice_id: invoice.id, connection_id: conn.id },
        });
        const link = await this.prisma.paymentLink.create({
            data: { organization_id: ctx.organization_id, billing_profile_id: profile.id, invoice_id: invoice.id, provider_connection_id: conn.id, provider_link_id: session.id, public_token: randomBytes(16).toString('hex'), title: `Invoice ${invoice.number}`, amount: invoice.amount_due, currency: invoice.currency, url: session.url, expires_at: session.expires_at, max_uses: 1, created_by_user_id: ctx.user_id },
        });
        await this.prisma.invoice.update({ where: { id: invoice.id }, data: { provider_connection_id: conn.id, hosted_invoice_url: session.url } });
        await this.audit.record(ctx, 'finance.invoice.checkout_created', { resource_type: 'invoice', resource_id: invoice.id, metadata: { connection_id: conn.id, payment_link_id: link.id } });
        this.events.publish(ctx, { event_key: 'finance.payment_link.created', module: M, entity_kind: 'payment_link', entity_id: link.id, payload: { invoice_id: invoice.id, url: session.url } });
        return { url: session.url, expires_at: session.expires_at, payment_link_id: link.id, connection: { id: conn.id, display_name: conn.display_name } };
    }

    async listLinks(ctx: OrgContext, q: PaymentLinkQuery) {
        const where: Prisma.PaymentLinkWhereInput = { organization_id: ctx.organization_id, ...(q.status && { status: q.status }), ...(q.invoice_id && { invoice_id: q.invoice_id }), ...(q.search && { title: { contains: q.search, mode: 'insensitive' } }) };
        const [items, total] = await Promise.all([
            this.prisma.paymentLink.findMany({ where, ...skipTake(q), orderBy: { created_at: 'desc' }, include: { invoice: { select: { id: true, number: true } }, billing_profile: { select: { id: true, legal_name: true } }, provider_connection: { select: { id: true, display_name: true } }, _count: { select: { payments: true } } } }),
            this.prisma.paymentLink.count({ where }),
        ]);
        return paginate(items, total, q);
    }

    async createLink(ctx: OrgContext, dto: CreatePaymentLinkDto) {
        if (dto.invoice_id) {
            const out = await this.invoiceCheckout(ctx, dto.invoice_id, { provider_connection_id: dto.provider_connection_id });
            return this.prisma.paymentLink.findUniqueOrThrow({ where: { id: out.payment_link_id } });
        }
        const price = dto.price_id ? await this.prisma.price.findFirst({ where: { id: dto.price_id, product: { organization_id: ctx.organization_id } }, include: { product: true } }) : null;
        if (dto.price_id && !price) throw new NotFoundException({ message: 'Price not found', code: 'price_not_found' });
        const currency = dto.currency ?? price?.currency;
        const amount = dto.amount ? dec(dto.amount) : price ? dec(price.unit_amount) : null;
        if (!currency) throw new BadRequestException({ message: 'Choose a currency', code: 'payment_link_currency' });
        if (!amount || amount.lessThanOrEqualTo(0)) throw new BadRequestException({ message: 'Enter an amount or choose a price', code: 'payment_link_amount' });
        const conn = await this.gateway.requireRoute(ctx.organization_id, { connection_id: dto.provider_connection_id, currency });
        const token = randomBytes(16).toString('hex');
        const draft = await this.prisma.paymentLink.create({
            data: { organization_id: ctx.organization_id, billing_profile_id: dto.billing_profile_id ?? null, price_id: price?.id ?? null, provider_connection_id: conn.id, public_token: token, title: dto.title, description: dto.description ?? null, amount: round2(amount), currency, allow_custom_amount: false, url: '', accepted_methods: dto.accepted_methods, expires_at: dto.expires_at ? new Date(dto.expires_at) : null, max_uses: dto.max_uses ?? null, created_by_user_id: ctx.user_id },
        });
        try {
            const session = await this.gateway.adapter(conn.provider).createCheckout(await this.gateway.credentials(conn), {
                amount_cents: toMinor(amount.toString(), currency), currency, title: dto.title, description: dto.description,
                success_url: `${this.appUrl()}/billing/links?paid=1`, cancel_url: `${this.appUrl()}/billing/links`, metadata: { organization_id: ctx.organization_id, payment_link_id: draft.id, connection_id: conn.id },
            });
            const link = await this.prisma.paymentLink.update({ where: { id: draft.id }, data: { url: session.url, provider_link_id: session.id, expires_at: draft.expires_at ?? session.expires_at } });
            await this.audit.record(ctx, 'finance.payment_link.created', { resource_type: 'payment_link', resource_id: link.id, metadata: { amount: amount.toString(), currency, sensitive: true } });
            this.events.publish(ctx, { event_key: 'finance.payment_link.created', module: M, entity_kind: 'payment_link', entity_id: link.id, payload: { title: link.title, url: link.url } });
            return link;
        } catch (error) {
            await this.prisma.paymentLink.delete({ where: { id: draft.id } });
            throw new BadRequestException({ message: `The provider could not create the link: ${(error as Error).message}`, code: 'payment_link_failed' });
        }
    }

    async disableLink(ctx: OrgContext, id: string) {
        const link = await this.prisma.paymentLink.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!link) throw new NotFoundException({ message: 'Payment link not found', code: 'payment_link_not_found' });
        const row = await this.prisma.paymentLink.update({ where: { id }, data: { status: PaymentLinkStatus.DISABLED } });
        await this.audit.record(ctx, 'finance.payment_link.disabled', { resource_type: 'payment_link', resource_id: id });
        this.events.publish(ctx, { event_key: 'finance.payment_link.disabled', module: M, entity_kind: 'payment_link', entity_id: id });
        return row;
    }

    // --- Webhooks ------------------------------------------------------------------------------------------------------

    /** POST /webhooks/payments/:connectionId — verified with that connection's signing secret, stored once, processed idempotently. */
    async handleWebhook(connectionId: string, rawBody: Buffer | undefined, signature: string | undefined) {
        const conn = await this.prisma.paymentProviderConnection.findUnique({ where: { id: connectionId } });
        if (!conn || !rawBody || !signature) throw new BadRequestException({ message: 'Unknown connection or missing signature', code: 'webhook_rejected' });
        const ctx = systemContext(conn.organization_id);
        const adapter = this.gateway.adapter(conn.provider);
        let event;
        try {
            event = await adapter.parseWebhook(await this.gateway.credentials(conn), rawBody, signature);
        } catch (error) {
            await this.audit.record(ctx, 'finance.webhook.rejected', { resource_type: 'payment_provider_connection', resource_id: conn.id, outcome: 'DENIED', metadata: { reason: (error as Error).message } });
            throw error;
        }
        let stored;
        try {
            stored = await this.prisma.providerWebhookEvent.create({ data: { organization_id: conn.organization_id, provider_connection_id: conn.id, provider: conn.provider, provider_event_id: event.id, event_type: event.type, payload: event.raw as Prisma.InputJsonValue } });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const prev = await this.prisma.providerWebhookEvent.findUnique({ where: { provider_provider_event_id: { provider: conn.provider, provider_event_id: event.id } } });
                if (prev?.processed_at) return { received: true, duplicate: true };
                stored = prev!;
            } else throw error;
        }
        try {
            await this.process(ctx, conn, event);
            await this.prisma.providerWebhookEvent.update({ where: { id: stored.id }, data: { processed_at: new Date(), error: null } });
        } catch (error) {
            this.logger.error(`webhook ${event.id} failed: ${(error as Error).message}`);
            await this.prisma.providerWebhookEvent.update({ where: { id: stored.id }, data: { error: (error as Error).message.slice(0, 1000) } });
            throw new BadRequestException({ message: 'Webhook processing failed; the provider will retry', code: 'webhook_failed' });
        }
        return { received: true };
    }

    private async process(ctx: OrgContext, conn: { id: string; provider: PaymentProvider; organization_id: string }, event: Awaited<ReturnType<ReturnType<ProviderGatewayService['adapter']>['parseWebhook']>>) {
        const d = event.data;
        const currency = d.currency ?? 'EUR';
        switch (event.normalized) {
            case 'payment.succeeded': {
                if (d.metadata?.organization_id && d.metadata.organization_id !== conn.organization_id) throw new Error('organization mismatch');
                let fee = 0;
                const adapter = this.gateway.adapter(conn.provider);
                if (d.payment_id && adapter.paymentFee) fee = (await adapter.paymentFee(await this.gateway.credentials(await this.gateway.connection(conn.organization_id, conn.id)), d.payment_id)) ?? 0;
                await this.payments.recordProviderPayment(ctx, {
                    connection_id: conn.id, provider: conn.provider, provider_payment_id: d.payment_id ?? null, checkout_id: d.checkout_id ?? null,
                    amount: round2(fromMinor(d.amount_cents ?? 0, currency)), currency, fee: round2(fromMinor(fee, currency)),
                    invoice_id: d.metadata?.invoice_id ?? null, payment_link_id: d.metadata?.payment_link_id ?? null,
                });
                return;
            }
            case 'payment.failed': {
                const invoiceId = d.metadata?.invoice_id;
                if (invoiceId) {
                    await this.audit.record(ctx, 'finance.payment.failed', { resource_type: 'invoice', resource_id: invoiceId, outcome: 'FAILURE', metadata: { code: d.failure_code, message: d.failure_message } });
                    this.events.publish(ctx, { event_key: 'finance.payment.failed', module: M, entity_kind: 'invoice', entity_id: invoiceId, payload: { code: d.failure_code, message: d.failure_message } });
                }
                return;
            }
            case 'payment.refunded': {
                const payment = d.payment_id ? await this.prisma.payment.findFirst({ where: { provider_connection_id: conn.id, provider_payment_id: d.payment_id }, include: { refunds: true } }) : null;
                if (!payment || !d.refund_id) return;
                const known = payment.refunds.find((r) => r.provider_refund_id === d.refund_id);
                if (known?.status === RefundStatus.SUCCEEDED) return;
                const refund = known ?? (await this.prisma.refund.create({ data: { payment_id: payment.id, amount: round2(fromMinor(d.refund_amount_cents ?? 0, currency)), reason: 'Refunded at the provider', status: RefundStatus.PENDING } }));
                await this.payments.applyRefund(ctx, refund.id, RefundStatus.SUCCEEDED, d.refund_id);
                return;
            }
            case 'dispute.opened':
            case 'dispute.closed': {
                const payment = d.payment_id ? await this.prisma.payment.findFirst({ where: { provider_connection_id: conn.id, provider_payment_id: d.payment_id } }) : null;
                const status = event.normalized === 'dispute.opened' ? 'OPEN' : d.dispute_status === 'won' ? 'WON' : d.dispute_status === 'lost' ? 'LOST' : 'CLOSED';
                const dispute = await this.prisma.paymentDispute.upsert({
                    where: { provider_connection_id_provider_dispute_id: { provider_connection_id: conn.id, provider_dispute_id: d.dispute_id! } },
                    create: { organization_id: conn.organization_id, provider_connection_id: conn.id, payment_id: payment?.id ?? null, provider_dispute_id: d.dispute_id!, status, amount: round2(fromMinor(d.amount_cents ?? 0, currency)), currency, reason: d.reason ?? null, evidence_due_at: d.evidence_due_at ?? null },
                    update: { status, ...(status !== 'OPEN' && { closed_at: new Date() }) },
                });
                this.events.publish(ctx, { event_key: `finance.${event.normalized}`, module: M, entity_kind: 'payment_dispute', entity_id: dispute.id, payload: { status, amount: dispute.amount.toString() } });
                return;
            }
            case 'payout.paid': {
                await this.prisma.paymentPayout.upsert({
                    where: { provider_connection_id_provider_payout_id: { provider_connection_id: conn.id, provider_payout_id: d.payout_id! } },
                    create: { organization_id: conn.organization_id, provider_connection_id: conn.id, provider_payout_id: d.payout_id!, status: 'PAID', currency, amount: round2(fromMinor(d.amount_cents ?? 0, currency)), arrival_date: d.arrival_date ?? null, paid_at: new Date() },
                    update: { status: 'PAID', paid_at: new Date() },
                });
                return;
            }
            default:
                return;
        }
    }

    private async assertRefs(ctx: OrgContext, dto: UpdateProviderDto) {
        if (dto.branch_id && !(await this.prisma.branch.findFirst({ where: { id: dto.branch_id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' });
        if (dto.ledger_payment_method_id && !(await this.prisma.ledgerPaymentMethod.findFirst({ where: { id: dto.ledger_payment_method_id, organization_id: ctx.organization_id } }))) throw new NotFoundException({ message: 'Ledger payment method not found', code: 'payment_method_not_found' });
    }

    private async uniqueIntegrationName(organizationId: string, name: string) {
        let candidate = name;
        for (let i = 2; await this.prisma.integrationConnection.findFirst({ where: { organization_id: organizationId, name: candidate }, select: { id: true } }); i++) candidate = `${name} ${i}`;
        return candidate;
    }
}
