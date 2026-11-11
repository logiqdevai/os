import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethodType, PaymentProvider, PaymentProviderConnection, PaymentProviderConnectionStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { decryptJson } from '@/shared/utils/crypto/secret-box.utils';
import { PaymentProviderAdapter, ProviderCredentials } from '@/integrations/payments/payment-provider.adapter';
import { StripePaymentAdapter } from '@/integrations/payments/stripe/stripe-payment.adapter';

/**
 * Resolves the adapter and the organization's own credentials (IntegrationConnection, decrypted in memory for one call)
 * for a payment connection, and implements the 08 routing rules: invoice/subscription connection → billing profile
 * preference → active connections of the branch, then the organization, matching currency and method (lowest priority)
 * → organization default. No match = no online payment (bank transfer instructions instead).
 */
@Injectable()
export class ProviderGatewayService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly stripe: StripePaymentAdapter,
    ) { }

    adapter(provider: PaymentProvider): PaymentProviderAdapter {
        if (provider === PaymentProvider.STRIPE) return this.stripe;
        throw new ConflictException({ message: `${provider} online payments are not available yet`, code: 'provider_not_supported' });
    }

    async credentials(connection: Pick<PaymentProviderConnection, 'integration_connection_id' | 'organization_id'>): Promise<ProviderCredentials> {
        if (!connection.integration_connection_id) throw new ConflictException({ message: 'This payment connection has no credentials; connect it again', code: 'provider_credentials_missing' });
        const ic = await this.prisma.integrationConnection.findFirst({ where: { id: connection.integration_connection_id, organization_id: connection.organization_id }, select: { secret_ciphertext: true, config: true, status: true } });
        if (!ic?.secret_ciphertext) throw new ConflictException({ message: 'The integration credentials are missing; update them in Admin → Integrations', code: 'provider_credentials_missing' });
        let secrets: Record<string, string>;
        try {
            secrets = decryptJson(ic.secret_ciphertext);
        } catch {
            throw new ConflictException({ message: 'The stored credentials cannot be read; enter them again', code: 'provider_credentials_unreadable' });
        }
        const config = (ic.config ?? {}) as Record<string, string>;
        return { secret_key: secrets.secret_key, webhook_signing_secret: secrets.webhook_signing_secret, publishable_key: config.publishable_key };
    }

    async connection(organizationId: string, id: string) {
        const c = await this.prisma.paymentProviderConnection.findFirst({ where: { id, organization_id: organizationId } });
        if (!c) throw new NotFoundException({ message: 'Payment provider connection not found', code: 'provider_connection_not_found' });
        return c;
    }

    /** Pick the collecting connection (08 "Routing"). Returns null when nothing matches. */
    async route(organizationId: string, input: { connection_id?: string | null; preferred_connection_id?: string | null; currency: string; branch_id?: string | null; method?: PaymentMethodType }) {
        const usable = (c: PaymentProviderConnection | null) =>
            !!c && c.status === PaymentProviderConnectionStatus.ACTIVE && c.provider !== 'MANUAL' && c.provider !== 'BANK' && (!c.currencies.length || c.currencies.includes(input.currency)) && (!input.method || !c.method_types.length || c.method_types.includes(input.method));
        for (const id of [input.connection_id, input.preferred_connection_id]) {
            if (!id) continue;
            const c = await this.prisma.paymentProviderConnection.findFirst({ where: { id, organization_id: organizationId } });
            if (usable(c)) return c!;
        }
        const active = (await this.prisma.paymentProviderConnection.findMany({ where: { organization_id: organizationId, status: PaymentProviderConnectionStatus.ACTIVE }, orderBy: [{ priority: 'asc' }, { is_default: 'desc' }, { created_at: 'asc' }] })).filter(usable);
        return (
            (input.branch_id ? active.find((c) => c.branch_id === input.branch_id) : null) ??
            active.find((c) => !c.branch_id) ??
            active.find((c) => c.is_default) ??
            null
        );
    }

    async requireRoute(organizationId: string, input: Parameters<ProviderGatewayService['route']>[1]) {
        const c = await this.route(organizationId, input);
        if (!c) throw new BadRequestException({ message: `No active payment provider accepts ${input.currency}. Connect one in Billing → Payment providers, or share the bank transfer instructions.`, code: 'no_payment_provider' });
        return c;
    }
}
