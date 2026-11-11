import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, ScopeType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { AuthorizationService } from '@/shared/authorization/authorization.service';
import { CredentialsService } from '@/shared/authorization/credentials.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { orderBy, paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { AdminAccessService, USER_SELECT } from '../shared/admin-access.service';
import { ApiKeyQuery, CreateApiKeyDto } from './dto/api-key.dto';

const MODULE = ModuleKey.ADMINISTRATION;

/** Never select key_hash. */
const KEY_SELECT = {
    id: true, name: true, key_prefix: true, scopes: true, scope_type: true, scope_id: true, rotation_due_at: true, expires_at: true,
    last_used_at: true, revoked_at: true, created_at: true, allowed_ip_ranges: true, rotated_from_id: true,
    membership: { select: { id: true, user: { select: USER_SELECT } } },
    service_account: { select: { id: true, name: true, status: true } },
} satisfies Prisma.ApiKeySelect;

/**
 * API keys (01 §75). Plain secrets exist once, in the create/rotate response; only the sha256 is stored.
 * A key never exceeds its owner, and its creator can only hand out what they hold themselves.
 */
@Injectable()
export class ApiKeysService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
        private readonly authorization: AuthorizationService,
        private readonly credentials: CredentialsService,
        private readonly access: AdminAccessService,
    ) { }

    async findAll(ctx: OrgContext, query: ApiKeyQuery) {
        const now = new Date();
        const statusWhere: Prisma.ApiKeyWhereInput =
            query.status === 'active' ? { revoked_at: null, OR: [{ expires_at: null }, { expires_at: { gt: now } }] }
                : query.status === 'revoked' ? { revoked_at: { not: null } }
                    : query.status === 'expired' ? { revoked_at: null, expires_at: { lte: now } }
                        : {};
        const where: Prisma.ApiKeyWhereInput = {
            organization_id: ctx.organization_id,
            ...statusWhere,
            ...(query.service_account_id && { service_account_id: query.service_account_id }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { key_prefix: { startsWith: query.search } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.apiKey.findMany({ where, ...skipTake(query), orderBy: orderBy(query, ['created_at', 'last_used_at', 'name'], 'created_at'), select: KEY_SELECT }),
            this.prisma.apiKey.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    async findOne(ctx: OrgContext, id: string) {
        const key = await this.prisma.apiKey.findFirst({ where: { id, organization_id: ctx.organization_id }, select: KEY_SELECT });
        if (!key) throw new NotFoundException({ message: 'API key not found', code: 'api_key_not_found' });
        return key;
    }

    async create(ctx: OrgContext, dto: CreateApiKeyDto) {
        const scopes = [...new Set(dto.scopes ?? [])];
        await this.assertScopesExist(scopes);
        let membership_id: string | null = null;
        let service_account_id: string | null = null;
        if (dto.service_account_id) {
            const sa = await this.prisma.serviceAccount.findFirst({ where: { id: dto.service_account_id, organization_id: ctx.organization_id } });
            if (!sa) throw new NotFoundException({ message: 'Service account not found', code: 'service_account_not_found' });
            if (sa.status !== 'ACTIVE') throw new ConflictException({ message: 'The service account is not active', code: 'service_account_inactive' });
            service_account_id = sa.id;
            // The key acts as the service account: the creator must hold everything the key will be able to do.
            const effective = this.authorization.narrowByScopes(await this.authorization.effectiveFor({ organization_id: ctx.organization_id, service_account_id: sa.id }), scopes);
            this.access.assertHoldsAll(ctx, Object.keys(effective.permissions));
        } else {
            if (!ctx.membership_id) throw new BadRequestException({ message: 'Pick a service account as the owner', code: 'owner_required' });
            membership_id = ctx.membership_id;
        }
        const scope_type = dto.scope_type ?? ScopeType.ORGANIZATION;
        const scope_id = await this.access.assertScope(ctx, scope_type, dto.scope_id);
        if (dto.expires_at && new Date(dto.expires_at) <= new Date()) throw new BadRequestException({ message: 'The expiry must be in the future', code: 'invalid_expiry' });

        const secret = this.credentials.generateApiKey();
        const key = await this.prisma.apiKey.create({
            data: {
                organization_id: ctx.organization_id, membership_id, service_account_id, name: dto.name, key_prefix: secret.prefix, key_hash: secret.hash,
                scopes, scope_type, scope_id, expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
                rotation_due_at: dto.rotation_due_at ? new Date(dto.rotation_due_at) : null, allowed_ip_ranges: dto.allowed_ip_ranges ?? [],
            },
            select: KEY_SELECT,
        });
        await this.audit.record(ctx, 'api_key.created', { resource_type: 'api_key', resource_id: key.id, metadata: { name: key.name, key_prefix: key.key_prefix, service_account_id, scopes_count: scopes.length, expires_at: dto.expires_at ?? null } });
        this.events.publish(ctx, { event_key: 'organizations.api_key.created', module: MODULE, entity_kind: 'api_key', entity_id: key.id, payload: { name: key.name } });
        return { ...key, secret: secret.plain };
    }

    /** Issue a replacement key with the same settings and revoke the old one. */
    async rotate(ctx: OrgContext, id: string) {
        const old = await this.prisma.apiKey.findFirst({ where: { id, organization_id: ctx.organization_id } });
        if (!old) throw new NotFoundException({ message: 'API key not found', code: 'api_key_not_found' });
        if (old.revoked_at) throw new ConflictException({ message: 'Revoked keys cannot be rotated', code: 'api_key_revoked' });
        if (old.membership_id && old.membership_id !== ctx.membership_id) {
            // Rotating someone else's personal key would hand their access to the caller.
            throw new ConflictException({ message: 'Only the owner can rotate a personal key. Revoke it instead.', code: 'api_key_not_owner' });
        }
        const secret = this.credentials.generateApiKey();
        const now = new Date();
        const key = await this.prisma.$transaction(async (tx) => {
            await tx.apiKey.update({ where: { id }, data: { revoked_at: now } });
            return tx.apiKey.create({
                data: {
                    organization_id: old.organization_id, membership_id: old.membership_id, service_account_id: old.service_account_id, name: old.name,
                    key_prefix: secret.prefix, key_hash: secret.hash, scopes: old.scopes, scope_type: old.scope_type, scope_id: old.scope_id,
                    expires_at: old.expires_at, allowed_ip_ranges: old.allowed_ip_ranges, rotated_from_id: old.id,
                    rotation_due_at: old.rotation_due_at && old.rotation_due_at > now ? old.rotation_due_at : null,
                },
                select: KEY_SELECT,
            });
        });
        await this.audit.record(ctx, 'api_key.rotated', { resource_type: 'api_key', resource_id: key.id, metadata: { rotated_from_id: id, key_prefix: key.key_prefix } });
        this.events.publish(ctx, { event_key: 'organizations.api_key.rotated', module: MODULE, entity_kind: 'api_key', entity_id: key.id, payload: { name: key.name } });
        return { ...key, secret: secret.plain };
    }

    async revoke(ctx: OrgContext, id: string) {
        const key = await this.findOne(ctx, id);
        if (key.revoked_at) return key;
        const updated = await this.prisma.apiKey.update({ where: { id }, data: { revoked_at: new Date() }, select: KEY_SELECT });
        await this.audit.record(ctx, 'api_key.revoked', { resource_type: 'api_key', resource_id: id, metadata: { name: key.name, key_prefix: key.key_prefix } });
        this.events.publish(ctx, { event_key: 'organizations.api_key.revoked', module: MODULE, entity_kind: 'api_key', entity_id: id, payload: { name: key.name } });
        return updated;
    }

    private async assertScopesExist(scopes: string[]) {
        const exact = scopes.filter((s) => !s.endsWith('*'));
        if (!exact.length) return;
        const found = await this.prisma.permission.findMany({ where: { key: { in: exact } }, select: { key: true } });
        const unknown = exact.filter((k) => !found.some((f) => f.key === k));
        if (unknown.length) throw new BadRequestException({ message: `Unknown permission keys: ${unknown.slice(0, 5).join(', ')}`, code: 'unknown_permission' });
    }
}
