/**
 * Canonical `AuditEvent.event_type` values written by module 01 (docs/features/01-users-organizations-permissions.md §99, §100, §139).
 *
 * Convention (see the AuditEvent comment in prisma/schema.prisma): `<resource>.<past_tense_action>`, snake_case, e.g.
 * `membership.role_assigned`, `user.login`, `sso.configuration_changed`. The column stays a plain string so other
 * modules can append their own types; this file is the single source of truth for module 01's types, and the Admin
 * audit-log filter (app/mockups -> admin/audit) is built from it.
 *
 * Writing an event (always through the audit service, never `prisma.auditEvent.create` directly):
 *   - organization_id: taken from the credential/session, never from the request body.
 *   - actor_type: USER for sessions, SERVICE_ACCOUNT for API keys / automation, SYSTEM for jobs (e.g. invitation expiry),
 *     PLATFORM_ADMIN for Logiqdev staff.
 *   - resource_type / resource_id: the changed row (e.g. `membership` + its id).
 *   - branch_id: set when the change is scoped to a branch (BRANCH / BRANCH_HIERARCHY scope), else null.
 *   - metadata: `{ before, after, reason }` for changes; never secrets (tokens, key hashes, SCIM tokens).
 *
 * `notifyAdmins` mirrors 01 §146 (security notifications): the Notifications module (14) subscribes to these types.
 * `sensitive` types are excluded from the audit log for callers without `organizations.audit.read`.
 */
export interface AuditEventTypeMeta {
    /** Value of AuditEvent.resource_type for this event. */
    resource: string;
    /** Hidden from callers who lack `organizations.audit.read`; shown with a lock in the UI. */
    sensitive: boolean;
    /** Raise a security notification to organization admins (01 §146). */
    notifyAdmins: boolean;
    description: string;
}

const t = (resource: string, description: string, opts: { sensitive?: boolean; notifyAdmins?: boolean } = {}): AuditEventTypeMeta => ({
    resource,
    description,
    sensitive: opts.sensitive ?? false,
    notifyAdmins: opts.notifyAdmins ?? false,
});

export const AUDIT_EVENT_TYPES = {
    // --- Identity & sign-in (01 §6, §72, §74, §100) ---
    'user.login': t('user', 'User signed in'),
    'user.logout': t('user', 'User signed out'),
    'user.login_failed': t('user', 'Failed sign-in attempt', { sensitive: true }),
    'user.password_changed': t('user', 'Password changed'),
    'user.mfa_enabled': t('user_auth_method', 'MFA factor added'),
    'user.mfa_disabled': t('user_auth_method', 'MFA factor disabled', { sensitive: true, notifyAdmins: true }),
    'user.suspended': t('user', 'User suspended', { sensitive: true }),
    'user.deactivated': t('user', 'User deactivated', { sensitive: true }),
    'session.created': t('user_session', 'Session started'),
    'session.revoked': t('user_session', 'Session revoked', { sensitive: true }),
    'organization.switched': t('user_session', 'Active organization / branch context changed'),

    // --- Organization (01 §8-15, §56, §103) ---
    'organization.created': t('organization', 'Organization created'),
    'organization.updated': t('organization', 'Profile, branding or defaults changed'),
    'organization.status_changed': t('organization', 'Lifecycle status changed (e.g. SETUP to ACTIVE)', { sensitive: true }),
    'organization.module_enabled': t('organization_module', 'Product module enabled for the organization'),
    'organization.module_disabled': t('organization_module', 'Product module disabled for the organization', { sensitive: true }),
    'organization.security_policy_changed': t('organization_security_policy', 'Security policy changed', { sensitive: true, notifyAdmins: true }),
    'organization.deletion_requested': t('organization', 'Organization deletion requested', { sensitive: true, notifyAdmins: true }),
    'domain.verified': t('organization_domain', 'Domain verified'),
    'domain.revoked': t('organization_domain', 'Domain revoked', { sensitive: true }),

    // --- Membership & access (01 §24, §44-§61, §92-§99) ---
    'membership.created': t('membership', 'Member joined the organization'),
    'membership.suspended': t('membership', 'Member suspended', { sensitive: true }),
    'membership.reactivated': t('membership', 'Member reactivated'),
    'membership.offboarded': t('membership', 'Member offboarded', { sensitive: true }),
    'membership.ownership_transferred': t('membership', 'Organization ownership transferred', { sensitive: true, notifyAdmins: true }),
    'membership.role_assigned': t('role_assignment', 'Role assigned', { sensitive: true }),
    'membership.role_removed': t('role_assignment', 'Role removed', { sensitive: true }),
    'membership.admin_promoted': t('role_assignment', 'Member promoted to an administrator role', { sensitive: true, notifyAdmins: true }),
    'membership.admin_removed': t('role_assignment', 'Administrator role removed', { sensitive: true, notifyAdmins: true }),
    'membership.permission_granted': t('permission_grant', 'Explicit permission grant or deny added', { sensitive: true }),
    'membership.permission_revoked': t('permission_grant', 'Explicit permission grant or deny removed', { sensitive: true }),
    'membership.module_enabled': t('membership_module_access', 'Module enabled for a member'),
    'membership.module_disabled': t('membership_module_access', 'Module disabled for a member'),
    'membership.branch_assigned': t('membership_branch', 'Member added to a branch'),
    'membership.branch_removed': t('membership_branch', 'Member removed from a branch'),
    'membership.team_assigned': t('team_membership', 'Member added to a team'),
    'membership.team_removed': t('team_membership', 'Member removed from a team'),
    'delegation.created': t('delegation', 'Delegation created', { sensitive: true }),
    'delegation.revoked': t('delegation', 'Delegation revoked'),

    // --- Roles (01 §109-§112) ---
    'role.created': t('role', 'Role created or cloned'),
    'role.updated': t('role', 'Role draft edited'),
    'role.published': t('role_version', 'Role published (new RoleVersion)', { sensitive: true, notifyAdmins: true }),
    'role.deprecated': t('role', 'Role deprecated'),

    // --- Structure (01 §16-22, §40-43, §104) ---
    'branch.created': t('branch', 'Branch created'),
    'branch.updated': t('branch', 'Branch settings changed'),
    'branch.archived': t('branch', 'Branch archived', { sensitive: true }),
    'branch.manager_changed': t('branch_manager', 'Branch manager added or removed', { sensitive: true, notifyAdmins: true }),
    'team.created': t('team', 'Team created'),
    'team.updated': t('team', 'Team changed'),
    'team.archived': t('team', 'Team archived'),

    // --- Invitations (01 §65-§67) ---
    'invitation.sent': t('invitation', 'Invitation sent'),
    'invitation.accepted': t('invitation', 'Invitation accepted'),
    'invitation.cancelled': t('invitation', 'Invitation cancelled'),
    'invitation.rejected': t('invitation', 'Invitation rejected by the invitee'),
    'invitation.expired': t('invitation', 'Invitation expired (written by the system)'),
    'invitation.bulk_imported': t('invitation', 'Bulk import or SCIM provisioning created members', { sensitive: true, notifyAdmins: true }),

    // --- SSO, API access (01 §68-§71, §75-§76) ---
    'sso.configuration_changed': t('sso_configuration', 'SSO / SCIM configuration changed', { sensitive: true, notifyAdmins: true }),
    'api_key.created': t('api_key', 'API key created', { sensitive: true }),
    'api_key.rotated': t('api_key', 'API key rotated', { sensitive: true }),
    'api_key.revoked': t('api_key', 'API key revoked', { sensitive: true }),
    'service_account.created': t('service_account', 'Service account created', { sensitive: true }),
    'service_account.suspended': t('service_account', 'Service account suspended', { sensitive: true }),
    'service_account.revoked': t('service_account', 'Service account revoked', { sensitive: true }),
    'external_collaborator.added': t('membership', 'External collaborator or guest added', { sensitive: true, notifyAdmins: true }),

    // --- Access reviews (01 §98) ---
    'access_review.created': t('access_review', 'Access review created'),
    'access_review.started': t('access_review', 'Access review started'),
    'access_review.decision_recorded': t('access_review_item', 'Reviewer certified, revoked or modified a member\'s access', { sensitive: true }),
    'access_review.decision_applied': t('access_review_item', 'A REVOKED / MODIFIED decision was applied to roles, grants or module access', { sensitive: true }),
    'access_review.completed': t('access_review', 'Access review completed'),
    'access_review.cancelled': t('access_review', 'Access review cancelled'),

    // --- Exports (01 §101) ---
    'data.exported': t('export', 'Sensitive data export', { sensitive: true }),
} as const satisfies Record<string, AuditEventTypeMeta>;

export type AuditEventType = keyof typeof AUDIT_EVENT_TYPES;
