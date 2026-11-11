import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { IntegrationMode, IntegrationStatus, ModuleKey, Prisma, ScopeType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { INTEGRATION_PROVIDERS, IntegrationProviderSpec } from '@/shared/constants/integration-providers';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { decryptJson, encryptJson, secretHint } from '@/shared/utils/crypto/secret-box.utils';
import { AdminAccessService } from '../shared/admin-access.service';
import { CreateIntegrationDto, IntegrationQuery, UpdateIntegrationDto } from './dto/integration.dto';
import { verifyIntegration } from './integration-verifier';

const MODULE = ModuleKey.ADMINISTRATION;

/** Everything except the ciphertext. Secrets are write-only (01 §158). */
const SAFE_SELECT = {
    id: true, provider: true, category: true, name: true, status: true, mode: true, credential_source: true, secret_hints: true, config: true,
    capabilities: true, usage_limits: true, webhook_token: true, is_default: true, branch_id: true, expires_at: true, rotated_at: true,
    last_verified_at: true, last_used_at: true, last_error: true, last_error_at: true, connected_at: true, disconnected_at: true, created_at: true, updated_at: true,
    branch: { select: { id: true, name: true } },
    created_by: { select: { id: true, user: { select: { display_name: true, email: true } } } },
} satisfies Prisma.IntegrationConnectionSelect;

/**
 * BYOK integrations (01 §157–160): organization-owned provider credentials, encrypted at rest, never returned.
 * Modules resolve a connection by category + default; at most one default per organization, category and mode.
 */
@Injectable()
export class IntegrationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: AdminAccessService,
        private readonly config: ConfigService,
    ) { }

    providers() {
        return Object.values(INTEGRATION_PROVIDERS);
    }

    async findAll(ctx: OrgContext, query: IntegrationQuery) {
        const where: Prisma.IntegrationConnectionWhereInput = {
            organization_id: ctx.organization_id,
            ...(query.status ? { status: query.status } : query.include_disconnected ? {} : { status: { not: IntegrationStatus.DISCONNECTED } }),
            ...(query.category && { category: query.category }),
            ...(query.provider && { provider: query.provider }),
            ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
        };
        const [items, total] = await Promise.all([
            this.prisma.integrationConnection.findMany({ where, ...skipTake(query), orderBy: [{ category: 'asc' }, orderBy(query, ['name', 'created_at'], 'name')], select: SAFE_SELECT }),
            this.prisma.integrationConnection.count({ where }),
        ]);
        return paginate(items.map((i) => this.present(i)), total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const row = await this.prisma.integrationConnection.findFirst({ where: { id, organization_id: ctx.organization_id }, select: SAFE_SELECT });
        if (!row) throw new NotFoundException({ message: 'Integration not found', code: 'integration_not_found' });
        const usage = await this.prisma.integrationUsageDaily.findMany({
            where: { integration_connection_id: id, date: { gte: new Date(Date.now() - 30 * 86400000) } },
            orderBy: { date: 'asc' },
            select: { date: true, requests: true, failures: true, units: true },
        });
        return { ...this.present(row), usage: usage.map((u) => ({ ...u, units: Number(u.units) })) };
    }

    async create(ctx: OrgContext, dto: CreateIntegrationDto) {
        const spec = INTEGRATION_PROVIDERS[dto.provider];
        const mode = spec.hasTestMode ? dto.mode ?? IntegrationMode.LIVE : IntegrationMode.LIVE;
        const secrets = this.cleanSecrets(spec, dto.secrets, true);
        const config = this.cleanConfig(spec, dto.config ?? {}, true);
        if (dto.branch_id) await this.access.assertScope(ctx, ScopeType.BRANCH, dto.branch_id);

        const existing = await this.prisma.integrationConnection.findFirst({ where: { organization_id: ctx.organization_id, name: dto.name } });
        if (existing && existing.status !== IntegrationStatus.DISCONNECTED) throw new ConflictException({ message: 'Another integration already uses this name', code: 'integration_name_taken' });

        const check = await verifyIntegration(dto.provider, secrets, config);
        const now = new Date();
        const data = {
            provider: dto.provider,
            category: spec.category,
            name: dto.name,
            mode,
            credential_source: 'ORGANIZATION' as const,
            secret_ciphertext: encryptJson(secrets),
            secret_hints: Object.fromEntries(Object.entries(secrets).map(([k, v]) => [k, secretHint(v)])),
            config: config as Prisma.InputJsonValue,
            capabilities: (check.capabilities ?? undefined) as Prisma.InputJsonValue,
            status: check.verified === true ? IntegrationStatus.ACTIVE : check.verified === false ? IntegrationStatus.ERROR : IntegrationStatus.PENDING,
            last_verified_at: check.verified ? now : null,
            last_error: check.ok ? null : check.error ?? null,
            last_error_at: check.ok ? null : now,
            webhook_token: spec.webhook ? randomBytes(24).toString('base64url') : null,
            branch_id: dto.branch_id ?? null,
            created_by_membership_id: ctx.membership_id,
            connected_at: now,
            disconnected_at: null,
            is_default: false,
        };
        const row = await this.prisma.$transaction(async (tx) => {
            const saved = existing
                ? await tx.integrationConnection.update({ where: { id: existing.id }, data, select: { id: true } })
                : await tx.integrationConnection.create({ data: { ...data, organization_id: ctx.organization_id }, select: { id: true } });
            const hasDefault = await tx.integrationConnection.count({ where: { organization_id: ctx.organization_id, category: spec.category, mode, is_default: true, id: { not: saved.id } } });
            if (dto.make_default || !hasDefault) await this.makeDefault(tx, ctx, saved.id, spec.category, mode);
            return saved;
        });
        await this.audit.record(ctx, 'integration.connected', { resource_type: 'integration_connection', resource_id: row.id, branch_id: dto.branch_id ?? null, metadata: { provider: dto.provider, category: spec.category, mode, name: dto.name } });
        await this.audit.record(ctx, check.ok ? 'integration.verified' : 'integration.verification_failed', { resource_type: 'integration_connection', resource_id: row.id, outcome: check.ok ? 'SUCCESS' : 'FAILURE', metadata: { provider: dto.provider, automatic: check.verified !== null } });
        this.events.publish(ctx, { event_key: 'organizations.integration.connected', module: MODULE, entity_kind: 'integration_connection', entity_id: row.id, payload: { provider: dto.provider, category: spec.category } });
        return this.findOne(ctx, row.id);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateIntegrationDto) {
        const before = await this.find(ctx, id);
        const spec = INTEGRATION_PROVIDERS[before.provider];
        if (dto.branch_id) await this.access.assertScope(ctx, ScopeType.BRANCH, dto.branch_id);
        if (dto.name && dto.name !== before.name) {
            const clash = await this.prisma.integrationConnection.findFirst({ where: { organization_id: ctx.organization_id, name: dto.name, id: { not: id } } });
            if (clash) throw new ConflictException({ message: 'Another integration already uses this name', code: 'integration_name_taken' });
        }
        const config = dto.config ? this.cleanConfig(spec, { ...((before.config ?? {}) as Record<string, string>), ...dto.config }, true) : undefined;
        await this.prisma.integrationConnection.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(config && { config: config as Prisma.InputJsonValue }),
                ...(dto.branch_id !== undefined && { branch_id: dto.branch_id }),
                ...(dto.usage_limits && { usage_limits: dto.usage_limits as Prisma.InputJsonValue }),
            },
        });
        await this.audit.record(ctx, 'integration.updated', { resource_type: 'integration_connection', resource_id: id, metadata: { fields: Object.keys(dto), provider: before.provider } });
        this.events.publish(ctx, { event_key: 'organizations.integration.updated', module: MODULE, entity_kind: 'integration_connection', entity_id: id, payload: { provider: before.provider } });
        return this.findOne(ctx, id);
    }

    async replaceSecrets(ctx: OrgContext, id: string, input: Record<string, string>) {
        const row = await this.find(ctx, id);
        if (row.status === IntegrationStatus.DISCONNECTED) throw new ConflictException({ message: 'Reconnect the integration instead', code: 'integration_disconnected' });
        const spec = INTEGRATION_PROVIDERS[row.provider];
        const current = row.secret_ciphertext ? decryptJson(row.secret_ciphertext) : {};
        const secrets = this.cleanSecrets(spec, { ...current, ...this.cleanSecrets(spec, input, false) }, true);
        const check = await verifyIntegration(row.provider, secrets, (row.config ?? {}) as Record<string, unknown>);
        const now = new Date();
        await this.prisma.integrationConnection.update({
            where: { id },
            data: {
                secret_ciphertext: encryptJson(secrets),
                secret_hints: Object.fromEntries(Object.entries(secrets).map(([k, v]) => [k, secretHint(v)])),
                rotated_at: now,
                ...this.verificationData(check, row.status, now),
            },
        });
        await this.audit.record(ctx, 'integration.secret_rotated', { resource_type: 'integration_connection', resource_id: id, metadata: { provider: row.provider, fields: Object.keys(input) } });
        await this.audit.record(ctx, check.ok ? 'integration.verified' : 'integration.verification_failed', { resource_type: 'integration_connection', resource_id: id, outcome: check.ok ? 'SUCCESS' : 'FAILURE', metadata: { provider: row.provider } });
        this.events.publish(ctx, { event_key: 'organizations.integration.secret_rotated', module: MODULE, entity_kind: 'integration_connection', entity_id: id, payload: { provider: row.provider } });
        return this.findOne(ctx, id);
    }

    async verify(ctx: OrgContext, id: string) {
        const row = await this.find(ctx, id);
        if (!row.secret_ciphertext) throw new ConflictException({ message: 'This integration has no stored credentials', code: 'integration_no_secret' });
        const check = await verifyIntegration(row.provider, decryptJson(row.secret_ciphertext), (row.config ?? {}) as Record<string, unknown>);
        await this.prisma.integrationConnection.update({ where: { id }, data: this.verificationData(check, row.status, new Date()) });
        await this.audit.record(ctx, check.ok ? 'integration.verified' : 'integration.verification_failed', { resource_type: 'integration_connection', resource_id: id, outcome: check.ok ? 'SUCCESS' : 'FAILURE', metadata: { provider: row.provider } });
        return { ...(await this.findOne(ctx, id)), verification: { ok: check.ok, automatic: check.verified !== null, error: check.error ?? null } };
    }

    async setDefault(ctx: OrgContext, id: string) {
        const row = await this.find(ctx, id);
        if (row.status === IntegrationStatus.DISCONNECTED || row.status === IntegrationStatus.DISABLED) {
            throw new ConflictException({ message: 'Only connected, enabled integrations can be the default', code: 'integration_not_usable' });
        }
        await this.prisma.$transaction((tx) => this.makeDefault(tx, ctx, id, row.category, row.mode));
        await this.audit.record(ctx, 'integration.default_changed', { resource_type: 'integration_connection', resource_id: id, metadata: { provider: row.provider, category: row.category, mode: row.mode } });
        this.events.publish(ctx, { event_key: 'organizations.integration.default_changed', module: MODULE, entity_kind: 'integration_connection', entity_id: id, payload: { category: row.category } });
        return this.findOne(ctx, id);
    }

    async setEnabled(ctx: OrgContext, id: string, enabled: boolean) {
        const row = await this.find(ctx, id);
        if (row.status === IntegrationStatus.DISCONNECTED) throw new ConflictException({ message: 'Reconnect the integration instead', code: 'integration_disconnected' });
        if (enabled === (row.status !== IntegrationStatus.DISABLED)) return this.findOne(ctx, id);
        await this.prisma.integrationConnection.update({
            where: { id },
            data: enabled ? { status: row.last_error ? IntegrationStatus.ERROR : row.last_verified_at ? IntegrationStatus.ACTIVE : IntegrationStatus.PENDING } : { status: IntegrationStatus.DISABLED, is_default: false },
        });
        await this.audit.record(ctx, enabled ? 'integration.enabled' : 'integration.disabled', { resource_type: 'integration_connection', resource_id: id, metadata: { provider: row.provider } });
        this.events.publish(ctx, { event_key: enabled ? 'organizations.integration.enabled' : 'organizations.integration.disabled', module: MODULE, entity_kind: 'integration_connection', entity_id: id, payload: { provider: row.provider } });
        return this.findOne(ctx, id);
    }

    /** Destroys the secret; the row stays for history and usage. */
    async disconnect(ctx: OrgContext, id: string) {
        const row = await this.find(ctx, id);
        if (row.status === IntegrationStatus.DISCONNECTED) return this.findOne(ctx, id);
        await this.prisma.integrationConnection.update({
            where: { id },
            data: { status: IntegrationStatus.DISCONNECTED, secret_ciphertext: null, secret_hints: Prisma.DbNull, is_default: false, webhook_token: null, disconnected_at: new Date() },
        });
        await this.audit.record(ctx, 'integration.disconnected', { resource_type: 'integration_connection', resource_id: id, metadata: { provider: row.provider, name: row.name } });
        this.events.publish(ctx, { event_key: 'organizations.integration.disconnected', module: MODULE, entity_kind: 'integration_connection', entity_id: id, payload: { provider: row.provider } });
        return this.findOne(ctx, id);
    }

    // ---------------------------------------------------------------------------------------------

    private async find(ctx: OrgContext, id: string) {
        const row = await this.prisma.integrationConnection.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!row) throw new NotFoundException({ message: 'Integration not found', code: 'integration_not_found' });
        return row;
    }

    private async makeDefault(tx: Prisma.TransactionClient, ctx: OrgContext, id: string, category: string, mode: IntegrationMode) {
        await tx.integrationConnection.updateMany({ where: { organization_id: ctx.organization_id, category: category as never, mode, is_default: true, id: { not: id } }, data: { is_default: false } });
        await tx.integrationConnection.update({ where: { id }, data: { is_default: true } });
    }

    private verificationData(check: Awaited<ReturnType<typeof verifyIntegration>>, current: IntegrationStatus, now: Date) {
        const keepDisabled = current === IntegrationStatus.DISABLED;
        if (check.verified === true) return { status: keepDisabled ? current : IntegrationStatus.ACTIVE, last_verified_at: now, last_error: null, last_error_at: null, ...(check.capabilities && { capabilities: check.capabilities as Prisma.InputJsonValue }) };
        if (check.verified === false) return { status: keepDisabled ? current : IntegrationStatus.ERROR, last_error: check.error ?? 'Verification failed', last_error_at: now };
        return {};
    }

    /** Keep only the provider's declared secret fields; when `complete`, every required one must be present. */
    private cleanSecrets(spec: IntegrationProviderSpec, input: Record<string, unknown>, complete: boolean) {
        const out: Record<string, string> = {};
        for (const field of spec.secrets) {
            const v = input[field.key];
            if (typeof v === 'string' && v.trim()) out[field.key] = v.trim();
            else if (complete && field.required) throw new BadRequestException({ message: `${field.label} is required`, code: 'integration_secret_required', field: field.key });
        }
        if (!complete && !Object.keys(out).length) throw new BadRequestException({ message: 'Enter at least one new secret value', code: 'integration_secret_required' });
        return out;
    }

    private cleanConfig(spec: IntegrationProviderSpec, input: Record<string, unknown>, complete: boolean) {
        const out: Record<string, string> = {};
        for (const field of spec.config) {
            const v = input[field.key];
            if (typeof v === 'string' && v.trim()) out[field.key] = v.trim().slice(0, 500);
            else if (complete && field.required) throw new BadRequestException({ message: `${field.label} is required`, code: 'integration_config_required', field: field.key });
        }
        return out;
    }

    private present<T extends { webhook_token: string | null }>(row: T) {
        const { webhook_token, ...rest } = row;
        const api = (this.config.get<string>('API_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
        return { ...rest, webhook_url: webhook_token ? `${api}/webhooks/integrations/${webhook_token}` : null };
    }
}
