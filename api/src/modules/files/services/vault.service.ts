import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleKey, Prisma, VaultAccessAction, VaultGrantSubjectType, VaultKeyStatus, VaultScope } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { AuditService } from '@/shared/audit/audit.service';
import { EventsService } from '@/shared/events/events.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { paginate, skipTake } from '@/shared/utils/pagination/pagination.utils';
import { decryptJson, encryptJson } from '@/shared/utils/crypto/secret-box.utils';
import { CreateVaultEntryDto, CreateVaultGrantDto, UpdateVaultEntryDto, VaultQuery } from '../dto/vault.dto';
import { MEMBER_SELECT } from '../utils/serialize.utils';

const VAULT_READ = 'documents.vault.read';
const VAULT_REVEAL = 'documents.vault.reveal';
/** Seconds the client may keep a revealed secret on screen. */
const REVEAL_TTL_SECONDS = 30;

/** Every column except the ciphertext — the list and detail never carry the secret (17 §12). */
const ENTRY_SELECT = {
    id: true, organization_id: true, scope: true, company_id: true, project_id: true, name: true, type: true, username: true, url: true, notes: true,
    secret_hint: true, file_name: true, file_mimetype: true, file_size_bytes: true, expires_at: true, owner_membership_id: true, created_by_user_id: true,
    portal_visible: true, last_rotated_at: true, last_revealed_at: true, reveal_count: true, archived_at: true, created_at: true, updated_at: true,
    owner: { select: MEMBER_SELECT },
    company: { select: { id: true, name: true } },
    project: { select: { id: true, name: true } },
    _count: { select: { grants: { where: { revoked_at: null } } } },
} satisfies Prisma.VaultEntrySelect;

export interface VaultRequestMeta {
    ip_address?: string | null;
    user_agent?: string | null;
}

/**
 * Secure credential vault (17 §12). Secrets are AES-256-GCM encrypted (shared secret-box helper) and only leave the
 * server through `reveal`, which is an explicit, logged action (VaultAccessLog + audit + event).
 */
@Injectable()
export class VaultService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly events: EventsService,
    ) { }

    private async myTeamIds(ctx: OrgContext) {
        if (!ctx.membership_id) return [];
        return (await this.prisma.teamMembership.findMany({ where: { membership_id: ctx.membership_id, ended_at: null }, select: { team_id: true } })).map((t) => t.team_id);
    }

    private activeGrantWhere(ctx: OrgContext, teamIds: string[]): Prisma.VaultEntryGrantWhereInput {
        return { revoked_at: null, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }], AND: [{ OR: [{ membership_id: ctx.membership_id ?? '' }, { team_id: { in: teamIds } }] }] };
    }

    /** Organization-wide vault read sees every entry; otherwise customer/project scope, own entries and grants. */
    private async scopeWhere(ctx: OrgContext): Promise<Prisma.VaultEntryWhereInput> {
        const scope = ctx.scopeOf(VAULT_READ);
        const teamIds = await this.myTeamIds(ctx);
        const grant = { grants: { some: this.activeGrantWhere(ctx, teamIds) } };
        if (!scope) return grant;
        if (scope.organization) return {};
        return {
            OR: [
                { company_id: { in: scope.customer_ids } },
                { project_id: { in: scope.project_ids } },
                { id: { in: scope.resource_ids } },
                ...(ctx.membership_id ? [{ owner_membership_id: ctx.membership_id }] : []),
                grant,
            ],
        };
    }

    private decorate<T extends { expires_at: Date | null }>(e: T) {
        const now = Date.now();
        return { ...e, is_expired: !!e.expires_at && e.expires_at.getTime() < now, expiring_soon: !!e.expires_at && e.expires_at.getTime() >= now && e.expires_at.getTime() < now + 30 * 86_400_000 };
    }

    private log(ctx: OrgContext, entryId: string, action: VaultAccessAction, meta: VaultRequestMeta = {}, context?: Record<string, unknown>) {
        return this.prisma.vaultAccessLog.create({
            data: {
                organization_id: ctx.organization_id,
                entry_id: entryId,
                action,
                actor_user_id: ctx.user_id,
                actor_membership_id: ctx.membership_id,
                ip_address: meta.ip_address ?? ctx.ip_address ?? null,
                user_agent: meta.user_agent ?? ctx.user_agent ?? null,
                context: { channel: ctx.channel, ...(ctx.api_key_id && { api_key_id: ctx.api_key_id }), ...(context ?? {}) } as Prisma.InputJsonValue,
            },
        });
    }

    /** Active per-organization key metadata (key material comes from the platform secret, 17 §12). */
    private async activeKey(organizationId: string) {
        const key = await this.prisma.vaultKey.findFirst({ where: { organization_id: organizationId, status: VaultKeyStatus.ACTIVE }, orderBy: { version: 'desc' } });
        if (key) return key;
        const last = await this.prisma.vaultKey.findFirst({ where: { organization_id: organizationId }, orderBy: { version: 'desc' } });
        return this.prisma.vaultKey.create({ data: { organization_id: organizationId, key_ref: 'platform:secret-box:v1', version: (last?.version ?? 0) + 1 } });
    }

    private hint(secret: string) {
        return secret.length <= 4 ? '••' : `…${secret.slice(-2)}`;
    }

    // --- Reads ------------------------------------------------------------------------------------

    async findAll(ctx: OrgContext, query: VaultQuery) {
        const soon = new Date(Date.now() + 30 * 86_400_000);
        const where: Prisma.VaultEntryWhereInput = {
            organization_id: ctx.organization_id,
            deleted_at: null,
            ...(query.archived ? { archived_at: { not: null } } : { archived_at: null }),
            AND: [await this.scopeWhere(ctx)],
            ...(query.scope && { scope: query.scope }),
            ...(query.type && { type: query.type }),
            ...(query.company_id && { company_id: query.company_id }),
            ...(query.project_id && { project_id: query.project_id }),
            ...(query.expiring && { expires_at: { lt: soon } }),
            ...(query.search && { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { username: { contains: query.search, mode: 'insensitive' } }, { url: { contains: query.search, mode: 'insensitive' } }] }),
        };
        const [items, total] = await Promise.all([
            this.prisma.vaultEntry.findMany({ where, ...skipTake(query), orderBy: { name: 'asc' }, select: ENTRY_SELECT }),
            this.prisma.vaultEntry.count({ where }),
        ]);
        return paginate(items.map((e) => this.decorate(e)), total, query);
    }

    private async getVisible(ctx: OrgContext, id: string) {
        const entry = await this.prisma.vaultEntry.findFirst({ where: { id, organization_id: ctx.organization_id, deleted_at: null, AND: [await this.scopeWhere(ctx)] }, select: ENTRY_SELECT });
        if (!entry) throw new NotFoundException({ message: 'Vault entry not found', code: 'vault_entry_not_found' });
        return entry;
    }

    async findOne(ctx: OrgContext, id: string, meta: VaultRequestMeta = {}) {
        const entry = await this.getVisible(ctx, id);
        const [grants, canReveal] = await Promise.all([
            this.prisma.vaultEntryGrant.findMany({
                where: { entry_id: id, revoked_at: null },
                orderBy: { created_at: 'asc' },
                include: { membership: { select: MEMBER_SELECT }, team: { select: { id: true, name: true } }, portal_user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } } },
            }),
            this.canReveal(ctx, id),
        ]);
        await this.log(ctx, id, VaultAccessAction.VIEW, meta);
        return { ...this.decorate(entry), has_secret: !!entry.secret_hint, grants, can_reveal: canReveal };
    }

    private async canReveal(ctx: OrgContext, entryId: string) {
        if (ctx.can(VAULT_REVEAL)) return true;
        const teamIds = await this.myTeamIds(ctx);
        return !!(await this.prisma.vaultEntryGrant.findFirst({ where: { entry_id: entryId, can_reveal: true, ...this.activeGrantWhere(ctx, teamIds) }, select: { id: true } }));
    }

    async accessLog(ctx: OrgContext, id: string, query: { page: number; limit: number }) {
        await this.getVisible(ctx, id);
        const where = { entry_id: id, organization_id: ctx.organization_id };
        const [items, total] = await Promise.all([
            this.prisma.vaultAccessLog.findMany({
                where, ...skipTake(query), orderBy: { created_at: 'desc' },
                include: { actor_user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } } },
            }),
            this.prisma.vaultAccessLog.count({ where }),
        ]);
        return paginate(items, total, query);
    }

    // --- Reveal / copy ------------------------------------------------------------------------------

    async reveal(ctx: OrgContext, id: string, reason: string | undefined, meta: VaultRequestMeta = {}) {
        await this.getVisible(ctx, id);
        if (!(await this.canReveal(ctx, id))) {
            await this.audit.record(ctx, 'vault.entry_reveal_denied', { resource_type: 'vault_entry', resource_id: id, outcome: 'DENIED' });
            throw new ForbiddenException({ message: 'You do not have permission to reveal this secret (documents.vault.reveal)', code: 'permission_denied', permissions: [VAULT_REVEAL] });
        }
        const row = await this.prisma.vaultEntry.findUniqueOrThrow({ where: { id }, select: { secret_ciphertext: true, name: true } });
        if (!row.secret_ciphertext) throw new ConflictException({ message: 'This entry has no secret stored', code: 'vault_no_secret' });
        let secret: string;
        try {
            secret = decryptJson(row.secret_ciphertext).secret ?? '';
        } catch {
            throw new ConflictException({ message: 'The secret could not be decrypted (key rotated or data corrupted)', code: 'vault_decrypt_failed' });
        }
        const now = new Date();
        await Promise.all([
            this.prisma.vaultEntry.update({ where: { id }, data: { last_revealed_at: now, reveal_count: { increment: 1 } } }),
            this.log(ctx, id, VaultAccessAction.REVEAL, meta, reason ? { reason } : undefined),
        ]);
        await this.audit.record(ctx, 'vault.entry_revealed', { resource_type: 'vault_entry', resource_id: id, metadata: { name: row.name, reason } });
        this.events.publish(ctx, { event_key: 'documents.vault.revealed', module: ModuleKey.DOCUMENTS, entity_kind: 'vault_entry', entity_id: id, payload: { name: row.name, reason: reason ?? null } });
        return { secret, revealed_at: now, hide_after_seconds: REVEAL_TTL_SECONDS };
    }

    /** The client copied the revealed secret: logged as its own action. */
    async copy(ctx: OrgContext, id: string, meta: VaultRequestMeta = {}) {
        await this.getVisible(ctx, id);
        if (!(await this.canReveal(ctx, id))) throw new ForbiddenException({ message: 'You do not have permission to copy this secret', code: 'permission_denied', permissions: [VAULT_REVEAL] });
        await this.log(ctx, id, VaultAccessAction.COPY, meta);
        await this.audit.record(ctx, 'vault.entry_copied', { resource_type: 'vault_entry', resource_id: id });
        return { success: true };
    }

    // --- Writes -------------------------------------------------------------------------------------

    private async assertRefs(ctx: OrgContext, dto: UpdateVaultEntryDto) {
        const org = ctx.organization_id;
        const checks: Promise<unknown>[] = [];
        if (dto.company_id) checks.push(this.prisma.crmCompany.findFirstOrThrow({ where: { id: dto.company_id, organization_id: org } }));
        if (dto.project_id) checks.push(this.prisma.project.findFirstOrThrow({ where: { id: dto.project_id, organization_id: org } }));
        if (dto.owner_membership_id) checks.push(this.prisma.membership.findFirstOrThrow({ where: { id: dto.owner_membership_id, organization_id: org } }));
        try {
            await Promise.all(checks);
        } catch {
            throw new NotFoundException({ message: 'Customer, project or owner not found', code: 'reference_not_found' });
        }
        if (dto.scope === VaultScope.CUSTOMER && !dto.company_id) throw new BadRequestException({ message: 'Pick the customer for a customer-scoped entry', code: 'vault_company_required' });
        if (dto.scope === VaultScope.PROJECT && !dto.project_id) throw new BadRequestException({ message: 'Pick the project for a project-scoped entry', code: 'vault_project_required' });
    }

    async create(ctx: OrgContext, dto: CreateVaultEntryDto, meta: VaultRequestMeta = {}) {
        await this.assertRefs(ctx, dto);
        const { secret, ...rest } = dto;
        const key = secret ? await this.activeKey(ctx.organization_id) : null;
        const entry = await this.prisma.vaultEntry.create({
            data: {
                ...rest,
                organization_id: ctx.organization_id,
                scope: dto.scope ?? (dto.project_id ? VaultScope.PROJECT : dto.company_id ? VaultScope.CUSTOMER : VaultScope.ORGANIZATION),
                expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
                owner_membership_id: dto.owner_membership_id ?? ctx.membership_id,
                created_by_user_id: ctx.user_id,
                ...(secret && { secret_ciphertext: encryptJson({ secret }), secret_hint: this.hint(secret), vault_key_id: key!.id, last_rotated_at: new Date() }),
            },
            select: ENTRY_SELECT,
        });
        await this.log(ctx, entry.id, VaultAccessAction.CREATE, meta);
        await this.audit.record(ctx, 'vault.entry_created', { resource_type: 'vault_entry', resource_id: entry.id, metadata: { after: { ...rest, value_set: !!secret } } });
        this.events.publish(ctx, { event_key: 'documents.vault.entry_created', module: ModuleKey.DOCUMENTS, entity_kind: 'vault_entry', entity_id: entry.id, payload: { name: entry.name, type: entry.type, scope: entry.scope, company_id: entry.company_id, project_id: entry.project_id } });
        return this.decorate(entry);
    }

    async update(ctx: OrgContext, id: string, dto: UpdateVaultEntryDto, meta: VaultRequestMeta = {}) {
        const before = await this.getVisible(ctx, id);
        await this.assertRefs(ctx, { ...dto, scope: dto.scope ?? before.scope, company_id: dto.company_id ?? before.company_id ?? undefined, project_id: dto.project_id ?? before.project_id ?? undefined });
        const { secret, ...rest } = dto;
        const key = secret ? await this.activeKey(ctx.organization_id) : null;
        const entry = await this.prisma.vaultEntry.update({
            where: { id },
            data: {
                ...rest,
                ...(dto.expires_at !== undefined && { expires_at: dto.expires_at ? new Date(dto.expires_at) : null }),
                ...(secret && { secret_ciphertext: encryptJson({ secret }), secret_hint: this.hint(secret), vault_key_id: key!.id, last_rotated_at: new Date() }),
            },
            select: ENTRY_SELECT,
        });
        await this.log(ctx, id, secret ? VaultAccessAction.ROTATE : VaultAccessAction.UPDATE, meta);
        await this.audit.record(ctx, secret ? 'vault.entry_rotated' : 'vault.entry_updated', {
            resource_type: 'vault_entry', resource_id: id,
            metadata: { before: { name: before.name, username: before.username, url: before.url, scope: before.scope, expires_at: before.expires_at }, after: { ...rest, value_changed: !!secret } },
        });
        this.events.publish(ctx, { event_key: secret ? 'documents.vault.entry_rotated' : 'documents.vault.entry_updated', module: ModuleKey.DOCUMENTS, entity_kind: 'vault_entry', entity_id: id, payload: { name: entry.name } });
        return this.decorate(entry);
    }

    async remove(ctx: OrgContext, id: string, meta: VaultRequestMeta = {}) {
        const entry = await this.getVisible(ctx, id);
        await this.prisma.vaultEntry.update({ where: { id }, data: { deleted_at: new Date(), secret_ciphertext: null } });
        await this.log(ctx, id, VaultAccessAction.DELETE, meta);
        await this.audit.record(ctx, 'vault.entry_deleted', { resource_type: 'vault_entry', resource_id: id, metadata: { name: entry.name } });
        this.events.publish(ctx, { event_key: 'documents.vault.entry_deleted', module: ModuleKey.DOCUMENTS, entity_kind: 'vault_entry', entity_id: id, payload: { name: entry.name } });
        return { success: true };
    }

    async addGrant(ctx: OrgContext, id: string, dto: CreateVaultGrantDto, meta: VaultRequestMeta = {}) {
        await this.getVisible(ctx, id);
        const org = ctx.organization_id;
        if (dto.subject_type === VaultGrantSubjectType.MEMBERSHIP) {
            if (!dto.membership_id || !(await this.prisma.membership.findFirst({ where: { id: dto.membership_id, organization_id: org } }))) throw new NotFoundException({ message: 'Member not found', code: 'membership_not_found' });
        } else if (dto.subject_type === VaultGrantSubjectType.TEAM) {
            if (!dto.team_id || !(await this.prisma.team.findFirst({ where: { id: dto.team_id, organization_id: org } }))) throw new NotFoundException({ message: 'Team not found', code: 'team_not_found' });
        } else {
            // 17 §12 — only Customer Portal users of the entry's own customer; portal users never manage an entry.
            const entry = await this.prisma.vaultEntry.findUnique({ where: { id }, select: { company_id: true } });
            if (!entry?.company_id) throw new BadRequestException({ message: 'Only credentials that belong to a customer can be shared with portal users', code: 'vault_portal_needs_customer' });
            const member = dto.portal_user_id
                ? await this.prisma.customerPortalMembership.findFirst({ where: { organization_id: org, customer_id: entry.company_id, user_id: dto.portal_user_id, status: 'ACTIVE' }, select: { id: true } })
                : null;
            if (!member) throw new NotFoundException({ message: 'This person is not an active portal user of the customer', code: 'portal_user_not_found' });
            dto.can_manage = false;
        }
        const data = {
            can_reveal: dto.can_reveal ?? false,
            can_manage: dto.can_manage ?? false,
            expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
            granted_by_user_id: ctx.user_id,
            revoked_at: null,
            revoked_by_user_id: null,
        };
        const grant = dto.subject_type === VaultGrantSubjectType.MEMBERSHIP
            ? await this.prisma.vaultEntryGrant.upsert({ where: { entry_id_membership_id: { entry_id: id, membership_id: dto.membership_id! } }, update: data, create: { ...data, entry_id: id, subject_type: dto.subject_type, membership_id: dto.membership_id } })
            : dto.subject_type === VaultGrantSubjectType.TEAM
                ? await this.prisma.vaultEntryGrant.upsert({ where: { entry_id_team_id: { entry_id: id, team_id: dto.team_id! } }, update: data, create: { ...data, entry_id: id, subject_type: dto.subject_type, team_id: dto.team_id } })
                : await this.prisma.vaultEntryGrant.upsert({ where: { entry_id_portal_user_id: { entry_id: id, portal_user_id: dto.portal_user_id! } }, update: data, create: { ...data, entry_id: id, subject_type: dto.subject_type, portal_user_id: dto.portal_user_id } });
        await this.log(ctx, id, VaultAccessAction.GRANT, meta, { grant_id: grant.id, subject_type: dto.subject_type, can_reveal: grant.can_reveal });
        await this.audit.record(ctx, 'vault.grant_added', { resource_type: 'vault_entry', resource_id: id, metadata: { grant_id: grant.id, subject_type: dto.subject_type, membership_id: dto.membership_id, team_id: dto.team_id, portal_user_id: dto.portal_user_id, can_reveal: grant.can_reveal, can_manage: grant.can_manage } });
        return grant;
    }

    /** Customer Portal users who can receive a grant on this entry (active portal users of the entry's customer). */
    async portalCandidates(ctx: OrgContext, id: string) {
        const entry = await this.getVisible(ctx, id);
        const companyId = (entry as { company_id?: string | null }).company_id ?? null;
        if (!companyId) return [];
        const rows = await this.prisma.customerPortalMembership.findMany({
            where: { organization_id: ctx.organization_id, customer_id: companyId, status: 'ACTIVE' },
            select: { user: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } } },
            take: 200,
        });
        return rows.map((r) => r.user);
    }

    async revokeGrant(ctx: OrgContext, id: string, grantId: string, meta: VaultRequestMeta = {}) {
        await this.getVisible(ctx, id);
        const res = await this.prisma.vaultEntryGrant.updateMany({ where: { id: grantId, entry_id: id, revoked_at: null }, data: { revoked_at: new Date(), revoked_by_user_id: ctx.user_id } });
        if (!res.count) throw new NotFoundException({ message: 'Grant not found', code: 'vault_grant_not_found' });
        await this.log(ctx, id, VaultAccessAction.REVOKE, meta, { grant_id: grantId });
        await this.audit.record(ctx, 'vault.grant_revoked', { resource_type: 'vault_entry', resource_id: id, metadata: { grant_id: grantId } });
        return { success: true };
    }
}
