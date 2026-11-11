import { Injectable } from '@nestjs/common';
import { MembershipStatus, McpToolCallStatus } from 'generated/prisma';
import { PrismaService } from '@/core/databases/prisma/prisma.service';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { AUDIT_EVENT_TYPES } from '@/shared/constants/audit-event-types';
import { USER_SELECT } from '../shared/admin-access.service';

const SENSITIVE_TYPES = Object.entries(AUDIT_EVENT_TYPES).filter(([, m]) => m.sensitive).map(([k]) => k);

/**
 * Admin overview (01 §141): one aggregate call. Each block is present only when the caller may see its data;
 * absent blocks are `null` so the UI can render a per-card no-access state.
 */
@Injectable()
export class OverviewService {
    constructor(private readonly prisma: PrismaService) { }

    async get(ctx: OrgContext) {
        const org = ctx.organization_id;
        const now = new Date();
        const [members, invitations, structure, roles, security, developers, recent, onboarding] = await Promise.all([
            ctx.can('users.members.read')
                ? Promise.all([
                    this.prisma.membership.groupBy({ by: ['status'], where: { organization_id: org }, _count: { _all: true } }),
                    this.prisma.membership.count({ where: { organization_id: org, status: MembershipStatus.ACTIVE, user: { mfa_enabled: true } } }),
                    this.prisma.membership.count({ where: { organization_id: org, type: { not: 'INTERNAL' }, status: MembershipStatus.ACTIVE } }),
                ]).then(([byStatus, mfa, external]) => {
                    const count = (s: MembershipStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
                    const active = count(MembershipStatus.ACTIVE);
                    return { active, suspended: count(MembershipStatus.SUSPENDED), deactivated: count(MembershipStatus.DEACTIVATED), external, mfa_enabled: mfa, mfa_coverage: active ? Math.round((mfa / active) * 100) : 0 };
                })
                : null,
            ctx.can('users.members.invite') || ctx.can('users.members.read')
                ? Promise.all([
                    this.prisma.invitation.count({ where: { organization_id: org, audience: 'MEMBER', status: 'PENDING', expires_at: { gt: now } } }),
                    this.prisma.invitation.count({ where: { organization_id: org, audience: 'MEMBER', status: 'PENDING', expires_at: { gt: now, lte: new Date(now.getTime() + 2 * 86400000) } } }),
                ]).then(([pending, expiring_soon]) => ({ pending, expiring_soon }))
                : null,
            ctx.can('organizations.branches.read') || ctx.can('organizations.teams.read')
                ? Promise.all([
                    ctx.can('organizations.branches.read') ? this.prisma.branch.count({ where: { organization_id: org, archived_at: null } }) : Promise.resolve(null),
                    ctx.can('organizations.teams.read') ? this.prisma.team.count({ where: { organization_id: org, archived_at: null } }) : Promise.resolve(null),
                ]).then(([branches, teams]) => ({ branches, teams }))
                : null,
            ctx.can('users.roles.read')
                ? Promise.all([
                    this.prisma.role.count({ where: { organization_id: org } }),
                    this.prisma.role.count({ where: { organization_id: org, status: 'DRAFT' } }),
                    this.prisma.role.count({ where: { organization_id: null } }),
                    this.prisma.roleAssignment.count({ where: { revoked_at: null, valid_until: { gt: now, lte: new Date(now.getTime() + 14 * 86400000) }, membership: { organization_id: org } } }),
                ]).then(([custom, drafts, templates, expiring_assignments]) => ({ custom, drafts, templates, expiring_assignments }))
                : null,
            ctx.can('organizations.modules.manage')
                ? this.prisma.organizationModule.findMany({ where: { organization_id: org, enabled: false }, select: { module: true } }).then((rows) => ({ disabled_modules: rows.map((r) => r.module) }))
                : null,
            ctx.can('organizations.api_keys.manage') || ctx.can('organizations.service_accounts.manage') || ctx.can('organizations.mcp_calls.read') || ctx.can('organizations.integrations.read')
                ? Promise.all([
                    ctx.can('organizations.api_keys.manage') ? this.prisma.apiKey.count({ where: { organization_id: org, revoked_at: null, OR: [{ expires_at: null }, { expires_at: { gt: now } }] } }) : Promise.resolve(null),
                    ctx.can('organizations.service_accounts.manage') ? this.prisma.serviceAccount.count({ where: { organization_id: org, status: 'ACTIVE' } }) : Promise.resolve(null),
                    ctx.can('organizations.mcp_calls.read') ? this.prisma.mcpToolCall.count({ where: { organization_id: org, status: McpToolCallStatus.AWAITING_CONFIRMATION } }) : Promise.resolve(null),
                    ctx.can('organizations.integrations.read') ? this.prisma.integrationConnection.groupBy({ by: ['status'], where: { organization_id: org, status: { not: 'DISCONNECTED' } }, _count: { _all: true } }) : Promise.resolve(null),
                ]).then(([api_keys, service_accounts, mcp_awaiting, integrations]) => ({
                    api_keys,
                    service_accounts,
                    mcp_awaiting,
                    integrations: integrations ? { total: integrations.reduce((s, r) => s + r._count._all, 0), errors: integrations.find((r) => r.status === 'ERROR')?._count._all ?? 0 } : null,
                }))
                : null,
            ctx.can('organizations.audit.read')
                ? this.prisma.auditEvent.findMany({
                    where: { organization_id: org, event_type: { in: SENSITIVE_TYPES } },
                    orderBy: { created_at: 'desc' },
                    take: 8,
                    select: { id: true, event_type: true, resource_type: true, resource_id: true, outcome: true, created_at: true, actor_type: true, actor_user: { select: USER_SELECT } },
                })
                : null,
            Promise.all([
                this.prisma.membership.count({ where: { organization_id: org } }),
                this.prisma.branch.count({ where: { organization_id: org, archived_at: null } }),
                this.prisma.team.count({ where: { organization_id: org, archived_at: null } }),
                this.prisma.integrationConnection.count({ where: { organization_id: org, status: { in: ['ACTIVE', 'PENDING'] } } }),
                this.prisma.organization.findUnique({ where: { id: org }, select: { branding: true, logo_url: true } }),
            ]).then(([m, b, t, i, o]) => ({ invited_someone: m > 1, has_branches: b > 1, has_teams: t > 0, has_integration: i > 0, has_branding: !!(o?.logo_url || (o?.branding as Record<string, unknown> | null)?.primary_color) })),
        ]);
        return { members, invitations, structure, roles, security, developers, recent_sensitive_events: recent, onboarding };
    }
}
