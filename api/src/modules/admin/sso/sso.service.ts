import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, SsoConfiguration, SsoProtocol } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { decryptJson, encryptJson, secretHint } from '@/shared/utils/crypto/secret-box.utils';
import { AdminAccessService } from '../shared/admin-access.service';
import {
    CreateSsoConfigurationInput,
    GroupMappingInput,
    OidcConfigSchema,
    SamlConfigSchema,
    UpdateGroupMappingInput,
    UpdateSsoConfigurationInput,
} from './dto/sso.dto';

/** Keys inside SsoConfiguration.config that hold write-only data. Never returned by the API. */
const SECRET_CIPHERTEXT = 'secrets_ciphertext';
const SECRET_HINTS = 'secret_hints';

type StoredConfig = Record<string, unknown> & { [SECRET_CIPHERTEXT]?: string; [SECRET_HINTS]?: Record<string, string> };

const MAPPING_INCLUDE = {
    role: { select: { id: true, name: true } },
    team: { select: { id: true, name: true } },
    branch: { select: { id: true, name: true } },
} as const;

/**
 * SSO identity providers and group mappings (01 §68–71, mockup 01-admin `sso`). This stores and validates the
 * SAML / OIDC settings only: the sign-in handshake is not built yet, so a configuration is reported as
 * "configured, not tested" and cannot be enabled (sso_required therefore stays off — no lock-out).
 * Secrets (OIDC client secret) are encrypted with secret-box inside `config` and never returned.
 */
@Injectable()
export class SsoService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly access: AdminAccessService,
    ) { }

    async findAll(ctx: OrgContext) {
        const rows = await this.prisma.ssoConfiguration.findMany({
            where: { organization_id: ctx.organization_id },
            orderBy: { created_at: 'asc' },
            include: { group_mappings: { include: MAPPING_INCLUDE, orderBy: { external_group: 'asc' } } },
        });
        return { data: rows.map((r) => this.present(ctx, r)) };
    }

    async findOne(ctx: OrgContext, id: string) {
        const row = await this.prisma.ssoConfiguration.findFirst({
            where: { id, organization_id: ctx.organization_id },
            include: { group_mappings: { include: MAPPING_INCLUDE, orderBy: { external_group: 'asc' } } },
        });
        if (!row) throw new NotFoundException({ message: 'Identity provider not found', code: 'sso_configuration_not_found' });
        return row;
    }

    async get(ctx: OrgContext, id: string) {
        return this.present(ctx, await this.findOne(ctx, id));
    }

    async create(ctx: OrgContext, dto: CreateSsoConfigurationInput) {
        const config: StoredConfig = { ...dto.config, ...this.sealSecrets(dto.protocol, dto.secrets, undefined) };
        const row = await this.prisma.ssoConfiguration.create({
            data: { organization_id: ctx.organization_id, name: dto.name, protocol: dto.protocol, auto_provision: dto.auto_provision ?? false, enabled: false, config: config as Prisma.InputJsonValue },
            include: { group_mappings: { include: MAPPING_INCLUDE } },
        });
        await this.recordChange(ctx, row.id, 'created', { name: row.name, protocol: row.protocol, fields: Object.keys(dto.config), write_only_set: Object.keys(dto.secrets ?? {}) });
        return this.present(ctx, row);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateSsoConfigurationInput) {
        const before = await this.findOne(ctx, id);
        const stored = (before.config ?? {}) as StoredConfig;
        let publicConfig = this.publicPart(stored);
        if (dto.config) {
            const schema = before.protocol === SsoProtocol.SAML ? SamlConfigSchema : OidcConfigSchema;
            const parsed = schema.safeParse(dto.config);
            if (!parsed.success) {
                throw new BadRequestException({ message: parsed.error.issues[0]?.message ?? 'Invalid settings', code: 'validation_failed', errors: parsed.error.issues.map((e) => ({ field: `config.${e.path.join('.')}`, message: e.message })) });
            }
            publicConfig = parsed.data as Record<string, unknown>;
        }
        const config: StoredConfig = { ...publicConfig, ...this.sealSecrets(before.protocol, dto.secrets, stored) };
        const row = await this.prisma.ssoConfiguration.update({
            where: { id },
            data: { name: dto.name, auto_provision: dto.auto_provision, config: config as Prisma.InputJsonValue },
            include: { group_mappings: { include: MAPPING_INCLUDE, orderBy: { external_group: 'asc' } } },
        });
        await this.recordChange(ctx, id, 'updated', {
            fields: [...Object.keys(dto).filter((k) => k !== 'secrets' && k !== 'config'), ...(dto.config ? Object.keys(dto.config).map((k) => `config.${k}`) : [])],
            write_only_rotated: Object.keys(dto.secrets ?? {}),
        });
        return this.present(ctx, row);
    }

    async remove(ctx: OrgContext, id: string) {
        const row = await this.findOne(ctx, id);
        if (row.enabled) throw new ConflictException({ message: 'Disable the identity provider before deleting it', code: 'sso_enabled' });
        await this.prisma.ssoConfiguration.delete({ where: { id } });
        await this.recordChange(ctx, id, 'deleted', { name: row.name, protocol: row.protocol });
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------
    // Group mappings (01 §71)
    // ---------------------------------------------------------------------------------------------

    async addMapping(ctx: OrgContext, configId: string, dto: GroupMappingInput) {
        await this.findOne(ctx, configId);
        await this.assertMappingRefs(ctx, dto);
        try {
            const row = await this.prisma.ssoGroupMapping.create({
                data: { sso_configuration_id: configId, external_group: dto.external_group, role_id: dto.role_id ?? null, team_id: dto.team_id ?? null, branch_id: dto.branch_id ?? null, modules: dto.modules ?? [] },
                include: MAPPING_INCLUDE,
            });
            await this.recordChange(ctx, configId, 'mapping_added', { mapping_id: row.id, ...dto });
            return row;
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async updateMapping(ctx: OrgContext, configId: string, mappingId: string, dto: UpdateGroupMappingInput) {
        await this.findOne(ctx, configId);
        const existing = await this.prisma.ssoGroupMapping.findFirst({ where: { id: mappingId, sso_configuration_id: configId } });
        if (!existing) throw new NotFoundException({ message: 'Mapping not found', code: 'sso_mapping_not_found' });
        await this.assertMappingRefs(ctx, dto);
        try {
            const row = await this.prisma.ssoGroupMapping.update({ where: { id: mappingId }, data: dto, include: MAPPING_INCLUDE });
            await this.recordChange(ctx, configId, 'mapping_updated', { mapping_id: mappingId, ...dto });
            return row;
        } catch (error) {
            this.rethrowUnique(error);
        }
    }

    async removeMapping(ctx: OrgContext, configId: string, mappingId: string) {
        await this.findOne(ctx, configId);
        const res = await this.prisma.ssoGroupMapping.deleteMany({ where: { id: mappingId, sso_configuration_id: configId } });
        if (!res.count) throw new NotFoundException({ message: 'Mapping not found', code: 'sso_mapping_not_found' });
        await this.recordChange(ctx, configId, 'mapping_removed', { mapping_id: mappingId });
        return { success: true };
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    /** Mapped roles follow the assignment rules (published, not a portal role, not wider than the caller — 01 §63). */
    private async assertMappingRefs(ctx: OrgContext, dto: UpdateGroupMappingInput) {
        if (dto.role_id) await this.access.assertAssignableRole(ctx, dto.role_id);
        if (dto.team_id && !(await this.prisma.team.findFirst({ where: { id: dto.team_id, organization_id: ctx.organization_id }, select: { id: true } }))) {
            throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
        }
        if (dto.branch_id && !(await this.prisma.branch.findFirst({ where: { id: dto.branch_id, organization_id: ctx.organization_id }, select: { id: true } }))) {
            throw new NotFoundException({ message: 'Branch not found', code: 'branch_not_found' });
        }
    }

    private publicPart(stored: StoredConfig): Record<string, unknown> {
        const { [SECRET_CIPHERTEXT]: _c, [SECRET_HINTS]: _h, ...rest } = stored;
        return rest;
    }

    /** Merge new write-only values into the encrypted blob; untouched secrets are kept. OIDC only has a client secret. */
    private sealSecrets(protocol: SsoProtocol, incoming: { client_secret?: string } | undefined, stored: StoredConfig | undefined): Partial<StoredConfig> {
        const current: Record<string, string> = stored?.[SECRET_CIPHERTEXT] ? decryptJson(stored[SECRET_CIPHERTEXT] as string) : {};
        const next = { ...current };
        if (incoming?.client_secret) {
            if (protocol !== SsoProtocol.OIDC) throw new BadRequestException({ message: 'SAML providers do not use a client secret', code: 'secret_not_supported' });
            next.client_secret = incoming.client_secret;
        }
        if (!Object.keys(next).length) return {};
        return { [SECRET_CIPHERTEXT]: encryptJson(next), [SECRET_HINTS]: Object.fromEntries(Object.entries(next).map(([k, v]) => [k, secretHint(v)])) };
    }

    /** API shape: public settings, secret hints, readiness. `config.secrets_ciphertext` never leaves the service. */
    private present(ctx: OrgContext, row: SsoConfiguration & { group_mappings?: unknown[] }) {
        const stored = (row.config ?? {}) as StoredConfig;
        const config = this.publicPart(stored);
        const hints = stored[SECRET_HINTS] ?? {};
        const schema = row.protocol === SsoProtocol.SAML ? SamlConfigSchema : OidcConfigSchema;
        const complete = schema.safeParse(config).success && (row.protocol !== SsoProtocol.OIDC || !!hints.client_secret);
        const { scim_token_hash: _scim, ...rest } = row;
        return {
            ...rest,
            config,
            secret_hints: hints,
            /** configured = every required setting is present; tested is always false until the sign-in handshake exists. */
            status: complete ? ('configured' as const) : ('incomplete' as const),
            tested: false,
            service_provider: { entity_id: `urn:logiqdev:os:${ctx.organization_id}` },
        };
    }

    private async recordChange(ctx: OrgContext, id: string, action: string, metadata: Record<string, unknown>) {
        await this.audit.record(ctx, 'sso.configuration_changed', { resource_type: 'sso_configuration', resource_id: id, metadata: { action, ...metadata } });
        this.events.publish(ctx, { event_key: 'organizations.sso.configuration_changed', module: ModuleKey.ADMINISTRATION, entity_kind: 'sso_configuration', entity_id: id, payload: { action } });
    }

    private rethrowUnique(error: unknown): never {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException({ message: 'This group is already mapped', code: 'sso_mapping_conflict' });
        }
        throw error;
    }
}
