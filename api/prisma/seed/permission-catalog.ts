import { ModuleKey, RoleType, ScopeType } from '../../src/generated/prisma';

/**
 * Permission catalog — docs/features/01-users-organizations-permissions.md §46–47.
 * Key format: `<module>.<resource>.<action>`. Modules declare their own entries; this file
 * holds the identity/administration entries plus the baseline every module needs so that
 * role templates can be seeded before the other modules exist.
 */

export interface PermissionSeed {
  key: string;
  module: ModuleKey;
  resource: string;
  action: string;
  description?: string;
  is_sensitive?: boolean;
  is_field_level?: boolean;
}

const crud = (module: ModuleKey, prefix: string, resource: string, extra: string[] = [], sensitive: string[] = []) =>
  ['read', 'create', 'update', 'delete', 'archive', 'export', ...extra].map<PermissionSeed>((action) => ({
    key: `${prefix}.${resource}.${action}`,
    module,
    resource,
    action,
    is_sensitive: sensitive.includes(action) || action === 'export' || action === 'delete',
  }));

export const PERMISSION_CATALOG: PermissionSeed[] = [
  // --- Administration (01 §105) -------------------------------------------------
  { key: 'organizations.settings.manage', module: ModuleKey.ADMINISTRATION, resource: 'settings', action: 'manage', is_sensitive: true },
  { key: 'organizations.branding.manage', module: ModuleKey.ADMINISTRATION, resource: 'branding', action: 'manage' },
  { key: 'organizations.security.manage', module: ModuleKey.ADMINISTRATION, resource: 'security', action: 'manage', is_sensitive: true },
  { key: 'organizations.billing.manage', module: ModuleKey.ADMINISTRATION, resource: 'billing', action: 'manage', is_sensitive: true },
  { key: 'organizations.integrations.manage', module: ModuleKey.ADMINISTRATION, resource: 'integrations', action: 'manage', is_sensitive: true },
  { key: 'organizations.modules.manage', module: ModuleKey.ADMINISTRATION, resource: 'modules', action: 'manage', is_sensitive: true },
  { key: 'organizations.organization.delete', module: ModuleKey.ADMINISTRATION, resource: 'organization', action: 'delete', is_sensitive: true },
  { key: 'organizations.domains.manage', module: ModuleKey.ADMINISTRATION, resource: 'domains', action: 'manage', is_sensitive: true },
  { key: 'organizations.sso.manage', module: ModuleKey.ADMINISTRATION, resource: 'sso', action: 'manage', is_sensitive: true },
  { key: 'organizations.api_keys.manage', module: ModuleKey.ADMINISTRATION, resource: 'api_keys', action: 'manage', is_sensitive: true },
  { key: 'organizations.service_accounts.manage', module: ModuleKey.ADMINISTRATION, resource: 'service_accounts', action: 'manage', is_sensitive: true },
  { key: 'organizations.audit.read', module: ModuleKey.ADMINISTRATION, resource: 'audit', action: 'read', is_sensitive: true },
  { key: 'organizations.access_reviews.manage', module: ModuleKey.ADMINISTRATION, resource: 'access_reviews', action: 'manage', is_sensitive: true },

  // --- Users & members (01 §106–108, §131–133) ----------------------------------
  { key: 'users.members.read', module: ModuleKey.ADMINISTRATION, resource: 'members', action: 'read' },
  { key: 'users.members.invite', module: ModuleKey.ADMINISTRATION, resource: 'members', action: 'invite' },
  { key: 'users.members.manage', module: ModuleKey.ADMINISTRATION, resource: 'members', action: 'manage', is_sensitive: true },
  { key: 'users.members.offboard', module: ModuleKey.ADMINISTRATION, resource: 'members', action: 'offboard', is_sensitive: true },
  { key: 'users.members.transfer_ownership', module: ModuleKey.ADMINISTRATION, resource: 'members', action: 'transfer_ownership', is_sensitive: true },
  { key: 'users.external_collaborators.manage', module: ModuleKey.ADMINISTRATION, resource: 'external_collaborators', action: 'manage', is_sensitive: true },
  { key: 'users.sessions.read', module: ModuleKey.ADMINISTRATION, resource: 'sessions', action: 'read', is_sensitive: true },
  { key: 'users.sessions.revoke', module: ModuleKey.ADMINISTRATION, resource: 'sessions', action: 'revoke', is_sensitive: true },
  { key: 'users.roles.read', module: ModuleKey.ADMINISTRATION, resource: 'roles', action: 'read' },
  { key: 'users.roles.manage', module: ModuleKey.ADMINISTRATION, resource: 'roles', action: 'manage', is_sensitive: true },
  { key: 'users.roles.assign', module: ModuleKey.ADMINISTRATION, resource: 'roles', action: 'assign', is_sensitive: true },
  { key: 'users.permissions.read', module: ModuleKey.ADMINISTRATION, resource: 'permissions', action: 'read' },
  { key: 'users.permissions.grant', module: ModuleKey.ADMINISTRATION, resource: 'permissions', action: 'grant', is_sensitive: true },
  { key: 'users.permissions.simulate', module: ModuleKey.ADMINISTRATION, resource: 'permissions', action: 'simulate' },
  { key: 'users.delegations.manage', module: ModuleKey.ADMINISTRATION, resource: 'delegations', action: 'manage' },

  // --- Branches (01 §16–23, §62) ---------------------------------------------------
  { key: 'organizations.branches.read', module: ModuleKey.ADMINISTRATION, resource: 'branches', action: 'read' },
  { key: 'organizations.branches.manage', module: ModuleKey.ADMINISTRATION, resource: 'branches', action: 'manage', is_sensitive: true },
  { key: 'organizations.branches.members.manage', module: ModuleKey.ADMINISTRATION, resource: 'branches.members', action: 'manage' },
  { key: 'organizations.branches.settings.manage', module: ModuleKey.ADMINISTRATION, resource: 'branches.settings', action: 'manage' },

  // --- Teams (01 §40–43) -------------------------------------------------------------
  { key: 'organizations.teams.read', module: ModuleKey.ADMINISTRATION, resource: 'teams', action: 'read' },
  { key: 'organizations.teams.manage', module: ModuleKey.ADMINISTRATION, resource: 'teams', action: 'manage' },
  { key: 'organizations.teams.members.manage', module: ModuleKey.ADMINISTRATION, resource: 'teams.members', action: 'manage' },

  // --- Customer Portal identity (01 §79) --------------------------------------------
  { key: 'portal.users.manage', module: ModuleKey.CUSTOMER_PORTAL, resource: 'users', action: 'manage', is_sensitive: true },
  { key: 'portal.projects.read', module: ModuleKey.CUSTOMER_PORTAL, resource: 'projects', action: 'read' },
  { key: 'portal.deliverables.approve', module: ModuleKey.CUSTOMER_PORTAL, resource: 'deliverables', action: 'approve' },
  { key: 'portal.requests.create', module: ModuleKey.CUSTOMER_PORTAL, resource: 'requests', action: 'create' },
  { key: 'portal.documents.read', module: ModuleKey.CUSTOMER_PORTAL, resource: 'documents', action: 'read' },
  { key: 'portal.documents.upload', module: ModuleKey.CUSTOMER_PORTAL, resource: 'documents', action: 'upload' },
  { key: 'portal.proposals.read', module: ModuleKey.CUSTOMER_PORTAL, resource: 'proposals', action: 'read' },
  { key: 'portal.proposals.accept', module: ModuleKey.CUSTOMER_PORTAL, resource: 'proposals', action: 'accept', is_sensitive: true },
  { key: 'portal.contracts.read', module: ModuleKey.CUSTOMER_PORTAL, resource: 'contracts', action: 'read' },
  { key: 'portal.contracts.sign', module: ModuleKey.CUSTOMER_PORTAL, resource: 'contracts', action: 'sign', is_sensitive: true },
  { key: 'portal.invoices.read', module: ModuleKey.CUSTOMER_PORTAL, resource: 'invoices', action: 'read' },
  { key: 'portal.invoices.pay', module: ModuleKey.CUSTOMER_PORTAL, resource: 'invoices', action: 'pay', is_sensitive: true },
  { key: 'portal.subscriptions.manage', module: ModuleKey.CUSTOMER_PORTAL, resource: 'subscriptions', action: 'manage', is_sensitive: true },
  { key: 'portal.conversations.participate', module: ModuleKey.CUSTOMER_PORTAL, resource: 'conversations', action: 'participate' },
  { key: 'portal.settings.manage', module: ModuleKey.CUSTOMER_PORTAL, resource: 'settings', action: 'manage' },

  // --- Baseline entries for other modules (01 §46 examples). Each module extends its own
  //     set in its own spec; only the resources named in 01 are seeded here.
  // --- 02 CRM (02 §21) ---------------------------------------------------------------
  ...crud(ModuleKey.CRM, 'crm', 'companies', ['merge']),
  ...crud(ModuleKey.CRM, 'crm', 'contacts', ['merge']),
  ...crud(ModuleKey.CRM, 'crm', 'leads', ['convert', 'assign']),
  ...crud(ModuleKey.CRM, 'crm', 'deals', ['assign', 'change_stage']),
  ...crud(ModuleKey.CRM, 'crm', 'activities'),
  { key: 'crm.notes.private.read', module: ModuleKey.CRM, resource: 'notes.private', action: 'read', is_sensitive: true },
  { key: 'crm.financials.read', module: ModuleKey.CRM, resource: 'financials', action: 'read', is_sensitive: true },
  { key: 'crm.pipelines.manage', module: ModuleKey.CRM, resource: 'pipelines', action: 'manage' },
  { key: 'crm.settings.manage', module: ModuleKey.CRM, resource: 'settings', action: 'manage', description: 'Lead sources, lead statuses, lifecycle stages, assignment rules.' },
  { key: 'crm.records.import', module: ModuleKey.CRM, resource: 'records', action: 'import', is_sensitive: true },
  { key: 'crm.records.export', module: ModuleKey.CRM, resource: 'records', action: 'export', is_sensitive: true },
  { key: 'crm.dashboards.read', module: ModuleKey.CRM, resource: 'dashboards', action: 'read' },
  { key: 'crm.forecast.read', module: ModuleKey.CRM, resource: 'forecast', action: 'read' },
  // Platform custom fields, tags and saved views are defined by 02 §24–29.
  { key: 'platform.custom_fields.manage', module: ModuleKey.ADMINISTRATION, resource: 'custom_fields', action: 'manage', is_sensitive: true },
  { key: 'platform.tags.manage', module: ModuleKey.ADMINISTRATION, resource: 'tags', action: 'manage' },
  { key: 'platform.saved_views.manage_shared', module: ModuleKey.ADMINISTRATION, resource: 'saved_views', action: 'manage_shared' },
  // --- 05 Projects (05 §10) ----------------------------------------------------------
  ...crud(ModuleKey.PROJECTS, 'projects', 'projects', ['manage_members', 'manage_budgets', 'complete', 'reopen']),
  { key: 'projects.finance.read', module: ModuleKey.PROJECTS, resource: 'finance', action: 'read', is_sensitive: true },
  { key: 'projects.milestones.manage', module: ModuleKey.PROJECTS, resource: 'milestones', action: 'manage' },
  { key: 'projects.workstreams.manage', module: ModuleKey.PROJECTS, resource: 'workstreams', action: 'manage' },
  { key: 'projects.deliverables.manage', module: ModuleKey.PROJECTS, resource: 'deliverables', action: 'manage' },
  { key: 'projects.risks.manage', module: ModuleKey.PROJECTS, resource: 'risks', action: 'manage' },
  { key: 'projects.issues.manage', module: ModuleKey.PROJECTS, resource: 'issues', action: 'manage' },
  { key: 'projects.dependencies.manage', module: ModuleKey.PROJECTS, resource: 'dependencies', action: 'manage' },
  { key: 'projects.change_requests.manage', module: ModuleKey.PROJECTS, resource: 'change_requests', action: 'manage' },
  { key: 'projects.change_requests.approve', module: ModuleKey.PROJECTS, resource: 'change_requests', action: 'approve', is_sensitive: true },
  { key: 'projects.gates.decide', module: ModuleKey.PROJECTS, resource: 'gates', action: 'decide', is_sensitive: true },
  { key: 'projects.status_updates.publish', module: ModuleKey.PROJECTS, resource: 'status_updates', action: 'publish' },
  { key: 'projects.internal_notes.read', module: ModuleKey.PROJECTS, resource: 'internal_notes', action: 'read' },
  { key: 'projects.settings.manage', module: ModuleKey.PROJECTS, resource: 'settings', action: 'manage', description: 'Project types, statuses, templates.' },
  { key: 'projects.portfolio.read', module: ModuleKey.PROJECTS, resource: 'portfolio', action: 'read' },
  // --- 06 Tasks (06 §15) --------------------------------------------------------------
  ...crud(ModuleKey.TASKS, 'tasks', 'tasks', ['assign']),
  { key: 'tasks.comments.internal.read', module: ModuleKey.TASKS, resource: 'comments.internal', action: 'read' },
  { key: 'tasks.workflows.manage', module: ModuleKey.TASKS, resource: 'workflows', action: 'manage', description: 'Statuses, types, labels, transitions.' },
  { key: 'tasks.cycles.manage', module: ModuleKey.TASKS, resource: 'cycles', action: 'manage' },
  { key: 'tasks.releases.manage', module: ModuleKey.TASKS, resource: 'releases', action: 'manage' },
  { key: 'tasks.bulk.execute', module: ModuleKey.TASKS, resource: 'bulk', action: 'execute' },
  { key: 'tasks.workload.read', module: ModuleKey.TASKS, resource: 'workload', action: 'read' },
  // --- 04 Contracts (04 §67) --------------------------------------------------------
  ...crud(ModuleKey.CONTRACTS, 'contracts', 'contracts', ['review', 'approve', 'amend', 'renew', 'terminate'], ['approve', 'terminate']),
  { key: 'contracts.confidential_terms.read', module: ModuleKey.CONTRACTS, resource: 'confidential_terms', action: 'read', is_sensitive: true, is_field_level: true },
  { key: 'contracts.versions.create', module: ModuleKey.CONTRACTS, resource: 'versions', action: 'create' },
  { key: 'contracts.signatures.send', module: ModuleKey.CONTRACTS, resource: 'signatures', action: 'send', is_sensitive: true },
  { key: 'contracts.signatures.cancel', module: ModuleKey.CONTRACTS, resource: 'signatures', action: 'cancel', is_sensitive: true },
  { key: 'contracts.templates.manage', module: ModuleKey.CONTRACTS, resource: 'templates', action: 'manage', is_sensitive: true },
  { key: 'contracts.clauses.manage', module: ModuleKey.CONTRACTS, resource: 'clauses', action: 'manage', is_sensitive: true },
  { key: 'contracts.types.manage', module: ModuleKey.CONTRACTS, resource: 'types', action: 'manage' },
  { key: 'contracts.approval_rules.manage', module: ModuleKey.CONTRACTS, resource: 'approval_rules', action: 'manage', is_sensitive: true },
  { key: 'contracts.obligations.manage', module: ModuleKey.CONTRACTS, resource: 'obligations', action: 'manage' },
  { key: 'contracts.comments.internal.read', module: ModuleKey.CONTRACTS, resource: 'comments.internal', action: 'read' },
  { key: 'contracts.knowledge.search', module: ModuleKey.CONTRACTS, resource: 'knowledge', action: 'search' },
  // --- 03 Proposals ------------------------------------------------------------------
  ...crud(ModuleKey.PROPOSALS, 'proposals', 'proposals', ['approve', 'send', 'convert', 'cancel'], ['approve', 'convert']),
  { key: 'proposals.templates.manage', module: ModuleKey.PROPOSALS, resource: 'templates', action: 'manage' },
  { key: 'proposals.comments.internal.read', module: ModuleKey.PROPOSALS, resource: 'comments.internal', action: 'read' },
  { key: 'proposals.analytics.read', module: ModuleKey.PROPOSALS, resource: 'analytics', action: 'read' },
  { key: 'proposals.ai.generate', module: ModuleKey.PROPOSALS, resource: 'ai', action: 'generate' },
  ...crud(ModuleKey.FINANCE, 'finance', 'invoices', ['approve'], ['approve']),
  { key: 'finance.reports.read', module: ModuleKey.FINANCE, resource: 'reports', action: 'read', is_sensitive: true },
  ...crud(ModuleKey.INCOME_EXPENSE, 'finance', 'expenses', ['approve'], ['approve']),
  ...crud(ModuleKey.SUPPORT, 'support', 'tickets', ['assign']),
  ...crud(ModuleKey.EMPLOYEES, 'employees', 'employees'),
  { key: 'employees.compensation.read', module: ModuleKey.EMPLOYEES, resource: 'compensation', action: 'read', is_sensitive: true, is_field_level: true },
  { key: 'employees.compensation.manage', module: ModuleKey.EMPLOYEES, resource: 'compensation', action: 'manage', is_sensitive: true, is_field_level: true },
  { key: 'employees.leave.approve', module: ModuleKey.EMPLOYEES, resource: 'leave', action: 'approve' },
  ...crud(ModuleKey.DOCUMENTS, 'documents', 'documents', ['share', 'approve']),
  { key: 'documents.vault.read', module: ModuleKey.DOCUMENTS, resource: 'vault', action: 'read', is_sensitive: true },
  { key: 'documents.vault.reveal', module: ModuleKey.DOCUMENTS, resource: 'vault', action: 'reveal', is_sensitive: true },
  { key: 'documents.vault.manage', module: ModuleKey.DOCUMENTS, resource: 'vault', action: 'manage', is_sensitive: true },
  { key: 'messaging.channels.manage', module: ModuleKey.MESSAGING, resource: 'channels', action: 'manage' },
  { key: 'messaging.messages.delete_any', module: ModuleKey.MESSAGING, resource: 'messages', action: 'delete_any', is_sensitive: true },
  { key: 'messaging.external_users.manage', module: ModuleKey.MESSAGING, resource: 'external_users', action: 'manage', is_sensitive: true },
  { key: 'calendar.events.read', module: ModuleKey.CALENDAR, resource: 'events', action: 'read' },
  { key: 'calendar.events.manage', module: ModuleKey.CALENDAR, resource: 'events', action: 'manage' },
  { key: 'time.entries.read_all', module: ModuleKey.TIME_TRACKING, resource: 'entries', action: 'read_all' },
  { key: 'time.entries.approve', module: ModuleKey.TIME_TRACKING, resource: 'entries', action: 'approve' },
  { key: 'notifications.defaults.manage', module: ModuleKey.NOTIFICATIONS, resource: 'defaults', action: 'manage' },
  { key: 'automation.rules.manage', module: ModuleKey.AUTOMATION, resource: 'rules', action: 'manage', is_sensitive: true },
  { key: 'docs.pages.read', module: ModuleKey.BUSINESS_DOCS, resource: 'pages', action: 'read' },
  { key: 'docs.pages.publish', module: ModuleKey.BUSINESS_DOCS, resource: 'pages', action: 'publish' },
];

/**
 * Role templates — 01 §44, §111 (internal) and §79 (customer portal).
 * `permissions` entries may be exact keys or glob-style prefixes ending in `*`.
 */
export interface RoleTemplateSeed {
  slug: string;
  name: string;
  description: string;
  type: RoleType;
  default_scope: ScopeType;
  modules: ModuleKey[];
  permissions: string[];
}

const ALL_MODULES = Object.values(ModuleKey) as ModuleKey[];
const OPERATIONAL_MODULES: ModuleKey[] = [
  ModuleKey.CRM, ModuleKey.PROPOSALS, ModuleKey.CONTRACTS, ModuleKey.PROJECTS, ModuleKey.TASKS,
  ModuleKey.SUPPORT, ModuleKey.MESSAGING, ModuleKey.DOCUMENTS, ModuleKey.CALENDAR, ModuleKey.TIME_TRACKING,
  ModuleKey.NOTIFICATIONS, ModuleKey.BUSINESS_DOCS,
];

export const ROLE_TEMPLATES: RoleTemplateSeed[] = [
  {
    slug: 'owner', name: 'Owner', type: RoleType.SYSTEM, default_scope: ScopeType.ORGANIZATION,
    description: 'Highest standard administrative role (01 §12).',
    modules: ALL_MODULES, permissions: ['*'],
  },
  {
    slug: 'admin', name: 'Admin', type: RoleType.ORGANIZATION, default_scope: ScopeType.ORGANIZATION,
    description: 'Organization administrator (01 §63). Everything except billing and organization deletion.',
    modules: ALL_MODULES,
    permissions: ['*'],
  },
  {
    slug: 'branch-admin', name: 'Branch Admin', type: RoleType.BRANCH, default_scope: ScopeType.BRANCH,
    description: 'Manages one branch: members, teams, settings, projects (01 §62).',
    modules: OPERATIONAL_MODULES,
    permissions: [
      'organizations.branches.read', 'organizations.branches.members.manage', 'organizations.branches.settings.manage',
      'organizations.teams.*', 'users.members.read', 'users.members.invite',
      'crm.*', 'projects.*', 'tasks.*', 'support.*', 'documents.documents.*', 'calendar.*', 'time.*', 'messaging.channels.manage',
    ],
  },
  {
    slug: 'manager', name: 'Manager', type: RoleType.ORGANIZATION, default_scope: ScopeType.ORGANIZATION,
    description: 'Manages operational modules; reads finance (01 §143).',
    modules: OPERATIONAL_MODULES.concat(ModuleKey.FINANCE, ModuleKey.EMPLOYEES),
    permissions: [
      'users.members.read', 'organizations.branches.read', 'organizations.teams.read',
      'crm.*', 'proposals.*', 'contracts.contracts.read', 'contracts.contracts.create', 'contracts.contracts.update',
      'projects.*', 'tasks.*', 'support.*', 'documents.documents.*', 'calendar.*', 'time.*',
      'finance.invoices.read', 'finance.reports.read', 'employees.employees.read', 'employees.leave.approve',
      'messaging.channels.manage', 'docs.pages.*',
    ],
  },
  {
    slug: 'project-manager', name: 'Project Manager', type: RoleType.ORGANIZATION, default_scope: ScopeType.ORGANIZATION,
    description: 'Project Manager bundle (01 §112).',
    modules: [ModuleKey.PROJECTS, ModuleKey.TASKS, ModuleKey.TIME_TRACKING, ModuleKey.DOCUMENTS, ModuleKey.CALENDAR, ModuleKey.MESSAGING, ModuleKey.SUPPORT, ModuleKey.CRM],
    permissions: [
      'projects.projects.read', 'projects.projects.create', 'projects.projects.update', 'projects.projects.manage_members', 'projects.projects.manage_budgets',
      'tasks.*', 'time.entries.read_all', 'time.entries.approve', 'documents.documents.read', 'documents.documents.create', 'documents.documents.update', 'documents.documents.share',
      'calendar.*', 'support.tickets.read', 'crm.companies.read', 'crm.contacts.read', 'crm.deals.read', 'organizations.teams.read', 'users.members.read',
    ],
  },
  {
    slug: 'sales-manager', name: 'Sales Manager', type: RoleType.ORGANIZATION, default_scope: ScopeType.ORGANIZATION,
    description: 'Owns CRM and proposals.',
    modules: [ModuleKey.CRM, ModuleKey.PROPOSALS, ModuleKey.CONTRACTS, ModuleKey.CALENDAR, ModuleKey.MESSAGING, ModuleKey.TASKS, ModuleKey.DOCUMENTS],
    permissions: ['crm.*', 'proposals.*', 'contracts.contracts.read', 'contracts.contracts.create', 'calendar.*', 'tasks.*', 'documents.documents.read', 'documents.documents.create', 'users.members.read'],
  },
  {
    slug: 'finance-manager', name: 'Finance Manager', type: RoleType.ORGANIZATION, default_scope: ScopeType.ORGANIZATION,
    description: 'Owns billing and the ledger (01 §61).',
    modules: [ModuleKey.FINANCE, ModuleKey.INCOME_EXPENSE, ModuleKey.CRM, ModuleKey.CONTRACTS, ModuleKey.DOCUMENTS, ModuleKey.TIME_TRACKING],
    permissions: ['finance.*', 'crm.companies.read', 'crm.contacts.read', 'crm.financials.read', 'contracts.contracts.read', 'contracts.confidential_terms.read', 'projects.finance.read', 'documents.documents.read', 'time.entries.read_all', 'organizations.billing.manage'],
  },
  {
    slug: 'support-agent', name: 'Support Agent', type: RoleType.ORGANIZATION, default_scope: ScopeType.ORGANIZATION,
    description: 'Handles support tickets and conversations.',
    modules: [ModuleKey.SUPPORT, ModuleKey.CRM, ModuleKey.TASKS, ModuleKey.MESSAGING, ModuleKey.DOCUMENTS, ModuleKey.BUSINESS_DOCS],
    permissions: ['support.*', 'crm.companies.read', 'crm.contacts.read', 'tasks.tasks.read', 'tasks.tasks.create', 'documents.documents.read', 'docs.pages.read'],
  },
  {
    slug: 'developer', name: 'Developer', type: RoleType.ORGANIZATION, default_scope: ScopeType.ORGANIZATION,
    description: 'Works on projects and tasks (01 §130).',
    modules: [ModuleKey.PROJECTS, ModuleKey.TASKS, ModuleKey.TIME_TRACKING, ModuleKey.DOCUMENTS, ModuleKey.MESSAGING, ModuleKey.CALENDAR, ModuleKey.BUSINESS_DOCS],
    permissions: ['projects.projects.read', 'tasks.tasks.read', 'tasks.tasks.create', 'tasks.tasks.update', 'documents.documents.read', 'documents.documents.create', 'calendar.events.read', 'docs.pages.read'],
  },
  {
    slug: 'employee', name: 'Employee', type: RoleType.ORGANIZATION, default_scope: ScopeType.ORGANIZATION,
    description: 'Default internal member (01 §143: read CRM, edit projects and tasks, read support and contracts).',
    modules: [ModuleKey.CRM, ModuleKey.PROJECTS, ModuleKey.TASKS, ModuleKey.SUPPORT, ModuleKey.CONTRACTS, ModuleKey.DOCUMENTS, ModuleKey.MESSAGING, ModuleKey.CALENDAR, ModuleKey.TIME_TRACKING, ModuleKey.BUSINESS_DOCS],
    permissions: ['crm.companies.read', 'crm.contacts.read', 'projects.projects.read', 'projects.projects.update', 'tasks.tasks.read', 'tasks.tasks.create', 'tasks.tasks.update', 'support.tickets.read', 'contracts.contracts.read', 'documents.documents.read', 'calendar.events.read', 'docs.pages.read'],
  },
  {
    slug: 'viewer', name: 'Viewer', type: RoleType.ORGANIZATION, default_scope: ScopeType.ORGANIZATION,
    description: 'Read-only across operational modules; no finance (01 §143).',
    modules: [ModuleKey.CRM, ModuleKey.PROJECTS, ModuleKey.TASKS, ModuleKey.SUPPORT, ModuleKey.CONTRACTS, ModuleKey.DOCUMENTS, ModuleKey.CALENDAR],
    permissions: ['crm.companies.read', 'crm.contacts.read', 'crm.deals.read', 'projects.projects.read', 'tasks.tasks.read', 'support.tickets.read', 'contracts.contracts.read', 'documents.documents.read', 'calendar.events.read'],
  },
  {
    slug: 'external-collaborator', name: 'External Collaborator', type: RoleType.ORGANIZATION, default_scope: ScopeType.RESOURCE,
    description: 'Restricted access to explicitly shared resources only (01 §77).',
    modules: [ModuleKey.PROJECTS, ModuleKey.TASKS, ModuleKey.DOCUMENTS, ModuleKey.MESSAGING],
    permissions: ['projects.projects.read', 'tasks.tasks.read', 'tasks.tasks.update', 'documents.documents.read'],
  },

  // --- Customer Portal roles (01 §79) ---------------------------------------------
  {
    slug: 'customer-owner', name: 'Customer Owner', type: RoleType.CUSTOMER_PORTAL, default_scope: ScopeType.CUSTOMER,
    description: 'Full portal access for the customer, including managing portal users.',
    modules: [ModuleKey.CUSTOMER_PORTAL], permissions: ['portal.*'],
  },
  {
    slug: 'customer-administrator', name: 'Customer Administrator', type: RoleType.CUSTOMER_PORTAL, default_scope: ScopeType.CUSTOMER,
    description: 'Manages portal users and settings; cannot sign or pay unless also granted.',
    modules: [ModuleKey.CUSTOMER_PORTAL],
    permissions: ['portal.users.manage', 'portal.settings.manage', 'portal.projects.read', 'portal.requests.create', 'portal.documents.read', 'portal.documents.upload', 'portal.proposals.read', 'portal.contracts.read', 'portal.invoices.read', 'portal.conversations.participate', 'portal.deliverables.approve'],
  },
  {
    slug: 'customer-manager', name: 'Customer Manager', type: RoleType.CUSTOMER_PORTAL, default_scope: ScopeType.CUSTOMER,
    description: 'Day-to-day project collaboration and approvals.',
    modules: [ModuleKey.CUSTOMER_PORTAL],
    permissions: ['portal.projects.read', 'portal.deliverables.approve', 'portal.requests.create', 'portal.documents.read', 'portal.documents.upload', 'portal.proposals.read', 'portal.contracts.read', 'portal.conversations.participate'],
  },
  {
    slug: 'customer-finance', name: 'Customer Finance', type: RoleType.CUSTOMER_PORTAL, default_scope: ScopeType.CUSTOMER,
    description: 'Invoices, payments and subscriptions.',
    modules: [ModuleKey.CUSTOMER_PORTAL],
    permissions: ['portal.invoices.read', 'portal.invoices.pay', 'portal.subscriptions.manage', 'portal.proposals.read', 'portal.contracts.read', 'portal.documents.read'],
  },
  {
    slug: 'customer-legal', name: 'Customer Legal', type: RoleType.CUSTOMER_PORTAL, default_scope: ScopeType.CUSTOMER,
    description: 'Reviews and signs proposals and contracts.',
    modules: [ModuleKey.CUSTOMER_PORTAL],
    permissions: ['portal.proposals.read', 'portal.proposals.accept', 'portal.contracts.read', 'portal.contracts.sign', 'portal.documents.read', 'portal.conversations.participate'],
  },
  {
    slug: 'customer-viewer', name: 'Customer Viewer', type: RoleType.CUSTOMER_PORTAL, default_scope: ScopeType.CUSTOMER,
    description: 'Read-only portal access.',
    modules: [ModuleKey.CUSTOMER_PORTAL],
    permissions: ['portal.projects.read', 'portal.documents.read', 'portal.proposals.read', 'portal.contracts.read', 'portal.invoices.read'],
  },
];

/** Expand glob-style template entries against the catalog. `*` matches everything. */
export function resolvePermissionKeys(patterns: string[], catalog: PermissionSeed[]): string[] {
  const keys = new Set<string>();
  for (const pattern of patterns) {
    if (pattern === '*') {
      catalog.forEach((p) => keys.add(p.key));
      continue;
    }
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      catalog.filter((p) => p.key.startsWith(prefix)).forEach((p) => keys.add(p.key));
      continue;
    }
    keys.add(pattern);
  }
  return [...keys];
}
