import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { MembershipStatus, ModuleKey, PermissionEffect, ScopeType } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { RedisService } from '@/core/databases/redis/redis.service';
import {
    AccessChannel,
    EffectivePermissions,
    OrgContext,
    PermissionScope,
    RequestPrincipal,
    ScopedSource,
} from './interfaces/org-context.interface';

const CACHE_TTL_SECONDS = 300;
const LOCAL_TTL_MS = 15_000;

const emptyScope = (): PermissionScope => ({
    organization: false,
    branch_ids: [],
    team_ids: [],
    project_ids: [],
    customer_ids: [],
    resource_ids: [],
});

/**
 * The one central authorization service (docs/features/01 §136). Resolves the effective permissions of a
 * membership, service account or API key; deny wins; API key scopes only narrow; disabled modules strip their keys.
 * Results are cached in Redis per organization version — call `invalidate(organizationId)` after any change to
 * roles, role permissions, assignments, grants, module enablement or membership status.
 */
@Injectable()
export class AuthorizationService {
    private local = new Map<string, { at: number; value: EffectivePermissions }>();
    private localVersions = new Map<string, { at: number; value: number }>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    // ---------------------------------------------------------------------------------------------
    // Context
    // ---------------------------------------------------------------------------------------------

    /** Build the request context. `requestedOrgId` is the X-Organization-Id header (ignored for API keys). */
    async buildContext(
        principal: RequestPrincipal,
        requestedOrgId: string | null,
        channel: AccessChannel,
        meta: { ip_address?: string | null; user_agent?: string | null } = {},
    ): Promise<OrgContext> {
        if (!principal) throw new UnauthorizedException({ message: 'Authentication required', code: 'authentication_required' });

        if (principal.kind === 'api_key') {
            const effective = await this.effectiveFor({
                organization_id: principal.organization_id,
                membership_id: principal.membership_id,
                service_account_id: principal.service_account_id,
            });
            const narrowed = this.narrowByScopes(effective, principal.api_key_scopes ?? []);
            return this.makeContext({
                organization_id: principal.organization_id,
                user_id: principal.id,
                membership_id: principal.membership_id ?? null,
                service_account_id: principal.service_account_id ?? null,
                api_key_id: principal.api_key_id,
                actor_type: principal.service_account_id ? 'SERVICE_ACCOUNT' : 'USER',
                channel: channel === 'ui' ? 'api' : channel,
                effective: narrowed,
                ...meta,
            });
        }

        const membership = await this.resolveMembership(principal.id, requestedOrgId);
        const effective = await this.effectiveFor({ organization_id: membership.organization_id, membership_id: membership.id });
        return this.makeContext({
            organization_id: membership.organization_id,
            user_id: principal.id,
            membership_id: membership.id,
            service_account_id: null,
            api_key_id: null,
            actor_type: 'USER',
            channel,
            effective,
            ...meta,
        });
    }

    /** Context for background jobs and automations running on behalf of a membership or service account. */
    async contextFor(input: {
        organization_id: string;
        membership_id?: string | null;
        service_account_id?: string | null;
        channel?: AccessChannel;
    }): Promise<OrgContext> {
        const effective = await this.effectiveFor(input);
        let user_id: string | null = null;
        if (input.membership_id) {
            const m = await this.prisma.membership.findUnique({ where: { id: input.membership_id }, select: { user_id: true } });
            user_id = m?.user_id ?? null;
        }
        return this.makeContext({
            organization_id: input.organization_id,
            user_id,
            membership_id: input.membership_id ?? null,
            service_account_id: input.service_account_id ?? null,
            api_key_id: null,
            actor_type: input.service_account_id ? 'SERVICE_ACCOUNT' : 'USER',
            channel: input.channel ?? 'automation',
            effective,
        });
    }

    private makeContext(base: Omit<OrgContext, 'can' | 'scopeOf'>): OrgContext {
        const ctx = base as OrgContext;
        ctx.can = (key: string) => !!ctx.effective.permissions[key];
        ctx.scopeOf = (key: string) => ctx.effective.permissions[key] ?? null;
        return ctx;
    }

    async resolveMembership(userId: string, requestedOrgId: string | null) {
        if (requestedOrgId) {
            const membership = await this.prisma.membership.findUnique({
                where: { user_id_organization_id: { user_id: userId, organization_id: requestedOrgId } },
                select: { id: true, organization_id: true, status: true, organization: { select: { deleted_at: true } } },
            });
            // 404 instead of 403 so organization ids cannot be probed.
            if (!membership || membership.organization.deleted_at) throw new NotFoundException({ message: 'Organization not found', code: 'organization_not_found' });
            if (membership.status !== MembershipStatus.ACTIVE) {
                throw new ForbiddenException({ message: `Membership is ${membership.status.toLowerCase()}`, code: 'membership_inactive' });
            }
            return membership;
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { default_organization_id: true } });
        const memberships = await this.prisma.membership.findMany({
            where: { user_id: userId, status: MembershipStatus.ACTIVE, organization: { deleted_at: null } },
            select: { id: true, organization_id: true, status: true },
            orderBy: { joined_at: 'asc' },
        });
        const chosen = memberships.find((m) => m.organization_id === user?.default_organization_id) ?? memberships[0];
        if (!chosen) throw new ForbiddenException({ message: 'You are not a member of any organization', code: 'no_organization' });
        return chosen;
    }

    // ---------------------------------------------------------------------------------------------
    // Effective permissions
    // ---------------------------------------------------------------------------------------------

    async effectiveFor(input: { organization_id: string; membership_id?: string | null; service_account_id?: string | null }): Promise<EffectivePermissions> {
        const version = await this.version(input.organization_id);
        const principalKey = input.membership_id ? `m:${input.membership_id}` : `s:${input.service_account_id}`;
        const cacheKey = `authz:${input.organization_id}:${version}:${principalKey}`;

        const localHit = this.local.get(cacheKey);
        if (localHit && Date.now() - localHit.at < LOCAL_TTL_MS) return localHit.value;

        const cached = await this.redis.get<EffectivePermissions>(cacheKey);
        if (cached) {
            this.local.set(cacheKey, { at: Date.now(), value: cached });
            return cached;
        }

        const value = await this.compute(input);
        await this.redis.set(cacheKey, value, CACHE_TTL_SECONDS);
        this.local.set(cacheKey, { at: Date.now(), value });
        if (this.local.size > 5000) this.local.clear();
        return value;
    }

    /** Bump the organization's permission version; every cached permission set of that org becomes stale. */
    async invalidate(organizationId: string): Promise<void> {
        const next = await this.redis.incr(`authz:v:${organizationId}`);
        this.localVersions.set(organizationId, { at: Date.now(), value: next ?? Date.now() });
        for (const key of [...this.local.keys()]) if (key.startsWith(`authz:${organizationId}:`)) this.local.delete(key);
    }

    private async version(organizationId: string): Promise<number> {
        const local = this.localVersions.get(organizationId);
        if (local && Date.now() - local.at < 2_000) return local.value;
        const v = (await this.redis.get<number>(`authz:v:${organizationId}`)) ?? local?.value ?? 0;
        this.localVersions.set(organizationId, { at: Date.now(), value: v });
        return v;
    }

    private async compute(input: { organization_id: string; membership_id?: string | null; service_account_id?: string | null }): Promise<EffectivePermissions> {
        const now = new Date();
        const active = { revoked_at: null, valid_from: { lte: now }, OR: [{ valid_until: null }, { valid_until: { gt: now } }] };

        const [modules, assignments, grants, principalOk] = await Promise.all([
            this.prisma.organizationModule.findMany({ where: { organization_id: input.organization_id }, select: { module: true, enabled: true } }),
            this.prisma.roleAssignment.findMany({
                where: {
                    ...active,
                    ...(input.membership_id ? { membership_id: input.membership_id } : { service_account_id: input.service_account_id }),
                    role: { OR: [{ organization_id: null }, { organization_id: input.organization_id }] },
                },
                select: {
                    scope_type: true,
                    scope_id: true,
                    role: {
                        select: {
                            status: true,
                            permissions: { select: { effect: true, max_scope_type: true, permission: { select: { key: true, module: true } } } },
                        },
                    },
                },
            }),
            input.membership_id
                ? this.prisma.permissionGrant.findMany({
                    where: { ...active, membership_id: input.membership_id },
                    select: { effect: true, scope_type: true, scope_id: true, permission: { select: { key: true, module: true } } },
                })
                : Promise.resolve([]),
            this.principalIsActive(input),
        ]);

        if (!principalOk) return { permissions: {}, modules: [] };

        // No organization_modules rows yet = every module enabled (new organizations get rows on creation).
        const disabled = new Set(modules.filter((m) => !m.enabled).map((m) => m.module as string));
        // 01 §56–57 — per-member module access is evaluated before feature permissions (Admin → member → modules).
        if (input.membership_id) {
            const blocked = await this.prisma.membershipModuleAccess.findMany({ where: { membership_id: input.membership_id, enabled: false }, select: { module: true } });
            for (const b of blocked) disabled.add(b.module);
        }
        const allModules = await this.allModules();
        const enabledModules = allModules.filter((m) => !disabled.has(m));

        const allow = new Map<string, ScopedSource[]>();
        const deny = new Map<string, ScopedSource[]>();
        const push = (map: Map<string, ScopedSource[]>, key: string, src: ScopedSource) => {
            const list = map.get(key) ?? [];
            list.push(src);
            map.set(key, list);
        };

        for (const a of assignments) {
            if (a.role.status === 'DRAFT') continue;
            for (const rp of a.role.permissions) {
                if (disabled.has(rp.permission.module)) continue;
                const src = { scope_type: a.scope_type, scope_id: a.scope_id };
                push(rp.effect === PermissionEffect.DENY ? deny : allow, rp.permission.key, src);
            }
        }
        for (const g of grants) {
            if (disabled.has(g.permission.module)) continue;
            push(g.effect === PermissionEffect.DENY ? deny : allow, g.permission.key, { scope_type: g.scope_type, scope_id: g.scope_id });
        }

        const permissions: Record<string, PermissionScope> = {};
        for (const [key, sources] of allow) {
            const denied = deny.get(key) ?? [];
            if (denied.some((d) => d.scope_type === ScopeType.ORGANIZATION)) continue; // deny wins
            const scope = emptyScope();
            for (const s of sources) {
                if (denied.some((d) => d.scope_type === s.scope_type && d.scope_id === s.scope_id)) continue;
                this.addScope(scope, s);
            }
            if (scope.organization || scope.branch_ids.length || scope.team_ids.length || scope.project_ids.length || scope.customer_ids.length || scope.resource_ids.length) {
                permissions[key] = scope;
            }
        }

        return { permissions, modules: enabledModules };
    }

    private addScope(scope: PermissionScope, s: ScopedSource) {
        switch (s.scope_type) {
            case ScopeType.ORGANIZATION:
                scope.organization = true;
                break;
            case ScopeType.BRANCH:
            case ScopeType.BRANCH_HIERARCHY:
                if (s.scope_id) scope.branch_ids.push(s.scope_id);
                break;
            case ScopeType.TEAM:
                if (s.scope_id) scope.team_ids.push(s.scope_id);
                break;
            case ScopeType.PROJECT:
                if (s.scope_id) scope.project_ids.push(s.scope_id);
                break;
            case ScopeType.CUSTOMER:
                if (s.scope_id) scope.customer_ids.push(s.scope_id);
                break;
            case ScopeType.RESOURCE:
                if (s.scope_id) scope.resource_ids.push(s.scope_id);
                break;
        }
    }

    private async principalIsActive(input: { organization_id: string; membership_id?: string | null; service_account_id?: string | null }) {
        if (input.membership_id) {
            const m = await this.prisma.membership.findUnique({ where: { id: input.membership_id }, select: { status: true, organization_id: true } });
            return !!m && m.organization_id === input.organization_id && m.status === MembershipStatus.ACTIVE;
        }
        if (input.service_account_id) {
            const s = await this.prisma.serviceAccount.findUnique({ where: { id: input.service_account_id }, select: { status: true, organization_id: true, expires_at: true } });
            return !!s && s.organization_id === input.organization_id && s.status === 'ACTIVE' && (!s.expires_at || s.expires_at > new Date());
        }
        return false;
    }

    private async allModules(): Promise<string[]> {
        return Object.values(ModuleKey) as string[];
    }

    /** API key `scopes` narrow the owner's permissions (exact keys or `prefix.*` globs). Empty = owner's full set. */
    narrowByScopes(effective: EffectivePermissions, scopes: string[]): EffectivePermissions {
        if (!scopes.length) return effective;
        const match = (key: string) => scopes.some((s) => (s.endsWith('*') ? key.startsWith(s.slice(0, -1)) : s === key));
        const permissions: Record<string, PermissionScope> = {};
        for (const [key, scope] of Object.entries(effective.permissions)) if (match(key)) permissions[key] = scope;
        return { ...effective, permissions };
    }

    // ---------------------------------------------------------------------------------------------
    // Checks used by services
    // ---------------------------------------------------------------------------------------------

    /** Throw 403 unless the context holds the permission. */
    assert(ctx: OrgContext, key: string): void {
        if (!ctx.can(key)) {
            throw new ForbiddenException({ message: `Missing permission ${key}`, code: 'permission_denied', permission: key });
        }
    }

    /**
     * Whether a record inside the given branch / team / project / customer is reachable with `key`.
     * Pass the record's own ids; an organization-wide scope always passes.
     */
    inScope(ctx: OrgContext, key: string, record: { branch_id?: string | null; team_id?: string | null; project_id?: string | null; customer_id?: string | null; resource_id?: string | null }): boolean {
        const scope = ctx.scopeOf(key);
        if (!scope) return false;
        if (scope.organization) return true;
        return (
            (!!record.branch_id && scope.branch_ids.includes(record.branch_id)) ||
            (!!record.team_id && scope.team_ids.includes(record.team_id)) ||
            (!!record.project_id && scope.project_ids.includes(record.project_id)) ||
            (!!record.customer_id && scope.customer_ids.includes(record.customer_id)) ||
            (!!record.resource_id && scope.resource_ids.includes(record.resource_id))
        );
    }

    /** Explain why a permission is or is not held (01 §136 explain result). */
    async explain(ctx: OrgContext, key: string) {
        const perm = await this.prisma.permission.findUnique({ where: { key } });
        if (!perm) return { key, allowed: false, reason: 'unknown_permission' };
        if (!ctx.effective.modules.includes(perm.module)) return { key, allowed: false, reason: 'module_disabled', module: perm.module };
        const scope = ctx.scopeOf(key);
        if (scope) return { key, allowed: true, scope };
        if (ctx.membership_id) {
            const deny = await this.prisma.permissionGrant.findFirst({ where: { membership_id: ctx.membership_id, permission_id: perm.id, effect: 'DENY', revoked_at: null } });
            if (deny) return { key, allowed: false, reason: 'explicit_deny', grant_id: deny.id };
        }
        return { key, allowed: false, reason: 'not_granted' };
    }
}
