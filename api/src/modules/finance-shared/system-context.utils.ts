import { OrgContext, PermissionScope } from '@/shared/authorization/interfaces/org-context.interface';

const ORG_SCOPE: PermissionScope = { organization: true, branch_ids: [], team_ids: [], project_ids: [], customer_ids: [], resource_ids: [] };

/**
 * Context for finance background jobs (daily billing cron, recurring expenses, provider webhooks). They act for the
 * platform itself (actor SYSTEM, channel automation) on one organization; audit rows carry actor_type SYSTEM.
 * Jobs only touch records of `organizationId` and only do what the schedule or the verified provider event says.
 */
export function systemContext(organizationId: string): OrgContext {
    const ctx: OrgContext = {
        organization_id: organizationId,
        user_id: null,
        membership_id: null,
        service_account_id: null,
        api_key_id: null,
        actor_type: 'SYSTEM',
        channel: 'automation',
        effective: { permissions: {}, modules: [] },
        can: () => true,
        scopeOf: () => ORG_SCOPE,
    };
    return ctx;
}
