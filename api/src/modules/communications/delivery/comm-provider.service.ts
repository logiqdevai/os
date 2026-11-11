import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommChannel, CommProviderKind, IntegrationCategory, IntegrationProvider, IntegrationStatus } from 'generated/prisma';
import { Resend } from 'resend';
import { Twilio } from 'twilio';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { decryptJson } from '@/shared/utils/crypto/secret-box.utils';

/** A resolved provider connection. Secrets live in memory for the duration of the call only (01 §157). */
export interface ResolvedProvider {
    connection_id: string;
    connection_name: string;
    provider: CommProviderKind;
    /** Public token of the provider callback URL (/communications/webhooks/<provider>/:token). */
    webhook_token: string | null;
    secrets: Record<string, string>;
    config: Record<string, string>;
}

export interface SendEmailInput {
    from: string;
    to: string;
    subject: string;
    html?: string | null;
    text?: string | null;
    reply_to?: string | null;
    headers?: Record<string, string>;
    tags?: { name: string; value: string }[];
}

export interface SendSmsInput {
    from?: string | null;
    to: string;
    body: string;
    status_callback?: string | null;
}

export class ProviderError extends Error {
    constructor(message: string, readonly permanent = false) {
        super(message);
    }
}

const CHANNEL_PROVIDER: Record<CommChannel, { category: IntegrationCategory; provider: IntegrationProvider; kind: CommProviderKind; label: string }> = {
    EMAIL: { category: IntegrationCategory.EMAIL, provider: IntegrationProvider.RESEND, kind: CommProviderKind.RESEND, label: 'email' },
    SMS: { category: IntegrationCategory.SMS, provider: IntegrationProvider.TWILIO, kind: CommProviderKind.TWILIO, label: 'SMS' },
};

/** Environment keys used only by PLATFORM-source connections (01 §160, dev/staging convenience rows). */
const PLATFORM_SECRETS: Record<string, Record<string, string>> = {
    RESEND: { api_key: 'RESEND_API_KEY' },
    TWILIO: { account_sid: 'TWILIO_ACCOUNT_SID', auth_token: 'TWILIO_AUTH_TOKEN' },
};

/**
 * Delivery provider adapter for module 11 (bring your own keys): resolves the organization's own
 * IntegrationConnection for the channel (Resend for email, Twilio for SMS) and calls the provider.
 * Never reads a provider key from the environment except for connections whose credential_source is PLATFORM.
 */
@Injectable()
export class CommProviderService {
    private readonly logger = new Logger(CommProviderService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) { }

    noProviderReason(channel: CommChannel) {
        return channel === CommChannel.EMAIL
            ? 'No email provider connected. Connect Resend in Admin → Integrations.'
            : 'No SMS provider connected. Connect Twilio in Admin → Integrations.';
    }

    /** Connection summary (never secrets) per channel, for the overview / settings screens. */
    async status(organizationId: string) {
        const rows = await this.prisma.integrationConnection.findMany({
            where: { organization_id: organizationId, category: { in: [IntegrationCategory.EMAIL, IntegrationCategory.SMS] }, disconnected_at: null },
            select: { id: true, name: true, provider: true, category: true, status: true, is_default: true, last_error: true, last_used_at: true, config: true, credential_source: true },
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        });
        const pick = (category: IntegrationCategory) => {
            const row = rows.find((r) => r.category === category && r.status === IntegrationStatus.ACTIVE) ?? rows.find((r) => r.category === category);
            if (!row) return { connected: false, reason: this.noProviderReason(category === IntegrationCategory.EMAIL ? CommChannel.EMAIL : CommChannel.SMS) };
            const cfg = (row.config ?? {}) as Record<string, string>;
            return {
                connected: row.status === IntegrationStatus.ACTIVE,
                connection_id: row.id,
                name: row.name,
                provider: row.provider,
                status: row.status,
                last_error: row.last_error,
                last_used_at: row.last_used_at,
                default_from: cfg.default_from ?? cfg.from_number ?? null,
            };
        };
        return { email: pick(IntegrationCategory.EMAIL), sms: pick(IntegrationCategory.SMS) };
    }

    async resolve(organizationId: string, channel: CommChannel, branchId?: string | null): Promise<ResolvedProvider | null> {
        const spec = CHANNEL_PROVIDER[channel];
        const rows = await this.prisma.integrationConnection.findMany({
            where: {
                organization_id: organizationId,
                category: spec.category,
                provider: spec.provider,
                status: IntegrationStatus.ACTIVE,
                disconnected_at: null,
                OR: [{ branch_id: null }, ...(branchId ? [{ branch_id: branchId }] : [])],
            },
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        });
        // Branch-specific connection wins over an organization-wide one.
        const row = rows.find((r) => branchId && r.branch_id === branchId) ?? rows[0];
        if (!row) return null;
        let secrets: Record<string, string> = {};
        try {
            if (row.credential_source === 'PLATFORM') {
                for (const [field, env] of Object.entries(PLATFORM_SECRETS[spec.provider] ?? {})) {
                    const v = this.config.get<string>(env);
                    if (v) secrets[field] = v;
                }
            } else if (row.secret_ciphertext) {
                secrets = decryptJson(row.secret_ciphertext);
            }
        } catch {
            this.logger.warn(`could not decrypt connection ${row.id}`);
            return null;
        }
        return {
            connection_id: row.id,
            connection_name: row.name,
            provider: spec.kind,
            webhook_token: row.webhook_token,
            secrets,
            config: (row.config ?? {}) as Record<string, string>,
        };
    }

    async sendEmail(p: ResolvedProvider, input: SendEmailInput): Promise<{ provider_message_id: string | null }> {
        if (!p.secrets.api_key) throw new ProviderError('The Resend connection has no API key. Update it in Admin → Integrations.', true);
        const client = new Resend(p.secrets.api_key);
        const { data, error } = await client.emails.send({
            from: input.from,
            to: [input.to],
            subject: input.subject,
            html: input.html ?? undefined,
            text: input.text ?? undefined,
            replyTo: input.reply_to ?? undefined,
            headers: input.headers,
            tags: input.tags,
        } as Parameters<typeof client.emails.send>[0]);
        if (error) {
            const permanent = ['validation_error', 'invalid_from_address', 'invalid_access', 'restricted_api_key', 'missing_api_key', 'invalid_api_key'].includes((error as { name?: string }).name ?? '');
            await this.markUsed(p.connection_id, error.message);
            throw new ProviderError(`Resend: ${error.message}`, permanent);
        }
        await this.markUsed(p.connection_id, null);
        return { provider_message_id: data?.id ?? null };
    }

    async sendSms(p: ResolvedProvider, input: SendSmsInput): Promise<{ provider_message_id: string | null }> {
        if (!p.secrets.account_sid || !p.secrets.auth_token) throw new ProviderError('The Twilio connection is missing its account SID or auth token.', true);
        const client = new Twilio(p.secrets.account_sid, p.secrets.auth_token);
        const messagingServiceSid = p.config.messaging_service_sid || undefined;
        const from = input.from || p.config.from_number || undefined;
        if (!messagingServiceSid && !from) throw new ProviderError('No SMS sender: add a sender number or set a messaging service on the Twilio connection.', true);
        try {
            const msg = await client.messages.create({
                to: input.to,
                body: input.body,
                ...(messagingServiceSid ? { messagingServiceSid } : { from }),
                ...(input.status_callback ? { statusCallback: input.status_callback } : {}),
            });
            await this.markUsed(p.connection_id, null);
            return { provider_message_id: msg.sid };
        } catch (e) {
            const err = e as { message?: string; status?: number };
            await this.markUsed(p.connection_id, err.message ?? 'Twilio error');
            throw new ProviderError(`Twilio: ${err.message ?? 'request failed'}`, err.status === 400);
        }
    }

    /** Create the sending domain at Resend; returns provider id, DNS records and status. */
    async createDomain(p: ResolvedProvider, domain: string) {
        const client = new Resend(p.secrets.api_key);
        const { data, error } = await client.domains.create({ name: domain });
        if (error) throw new ProviderError(`Resend: ${error.message}`, true);
        return { provider_domain_id: data.id, status: data.status, records: data.records ?? [] };
    }

    async verifyDomain(p: ResolvedProvider, providerDomainId: string) {
        const client = new Resend(p.secrets.api_key);
        await client.domains.verify(providerDomainId);
        const { data, error } = await client.domains.get(providerDomainId);
        if (error) throw new ProviderError(`Resend: ${error.message}`, true);
        return { status: data.status, records: data.records ?? [] };
    }

    verifyResendWebhook(secret: string, payload: string, headers: { id: string; timestamp: string; signature: string }) {
        const client = new Resend('re_webhook_verify');
        return client.webhooks.verify({ payload, headers, webhookSecret: secret });
    }

    private async markUsed(connectionId: string, error: string | null) {
        await this.prisma.integrationConnection
            .update({ where: { id: connectionId }, data: error ? { last_error: error.slice(0, 500), last_error_at: new Date(), last_used_at: new Date() } : { last_used_at: new Date() } })
            .catch(() => undefined);
    }
}
