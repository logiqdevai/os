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
  // --- 08 Finance ---------------------------------------------------------------------
  ...crud(ModuleKey.FINANCE, 'finance', 'invoices', ['approve', 'send', 'void'], ['approve', 'void']),
  { key: 'finance.payments.read', module: ModuleKey.FINANCE, resource: 'payments', action: 'read', is_sensitive: true },
  { key: 'finance.payments.record', module: ModuleKey.FINANCE, resource: 'payments', action: 'record', is_sensitive: true },
  { key: 'finance.payments.refund', module: ModuleKey.FINANCE, resource: 'payments', action: 'refund', is_sensitive: true },
  { key: 'finance.credit_notes.manage', module: ModuleKey.FINANCE, resource: 'credit_notes', action: 'manage', is_sensitive: true },
  { key: 'finance.subscriptions.read', module: ModuleKey.FINANCE, resource: 'subscriptions', action: 'read' },
  { key: 'finance.subscriptions.manage', module: ModuleKey.FINANCE, resource: 'subscriptions', action: 'manage', is_sensitive: true },
  { key: 'finance.billing_profiles.manage', module: ModuleKey.FINANCE, resource: 'billing_profiles', action: 'manage', is_sensitive: true },
  { key: 'finance.catalog.read', module: ModuleKey.FINANCE, resource: 'catalog', action: 'read' },
  { key: 'finance.catalog.manage', module: ModuleKey.FINANCE, resource: 'catalog', action: 'manage', description: 'Products, prices, tax rates, coupons.' },
  { key: 'finance.dunning.manage', module: ModuleKey.FINANCE, resource: 'dunning', action: 'manage' },
  { key: 'finance.project_billing.manage', module: ModuleKey.FINANCE, resource: 'project_billing', action: 'manage' },
  { key: 'finance.reports.read', module: ModuleKey.FINANCE, resource: 'reports', action: 'read', is_sensitive: true },
  { key: 'finance.stripe.manage', module: ModuleKey.FINANCE, resource: 'stripe', action: 'manage', is_sensitive: true },
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
  // --- Added from the feature specs' permission sections and module scopes (08–20) --------------------
  ...crud(ModuleKey.COMMUNICATION, 'communications', 'messages', ['send'], ['send']),
  ...crud(ModuleKey.COMMUNICATION, 'communications', 'templates'),
  ...crud(ModuleKey.COMMUNICATION, 'communications', 'campaigns', ['send', 'approve'], ['send', 'approve']),
  ...crud(ModuleKey.COMMUNICATION, 'communications', 'segments'),
  ...crud(ModuleKey.INCOME_EXPENSE, 'finance', 'income'),
  ...crud(ModuleKey.SUPPORT, 'support', 'conversations', ['assign', 'reply', 'close']),
  ...crud(ModuleKey.SUPPORT, 'support', 'knowledge', ['publish'], ['publish']),
  ...crud(ModuleKey.BUSINESS_DOCS, 'docs', 'forms', ['assign', 'review']),
  { key: 'finance.dashboard.read', module: ModuleKey.FINANCE, resource: 'dashboard', action: 'read', is_sensitive: true },
  { key: 'finance.invoice_templates.manage', module: ModuleKey.FINANCE, resource: 'invoice_templates', action: 'manage' },
  { key: 'finance.adjustments.manage', module: ModuleKey.FINANCE, resource: 'adjustments', action: 'manage', is_sensitive: true },
  { key: 'finance.categories.manage', module: ModuleKey.INCOME_EXPENSE, resource: 'categories', action: 'manage' },
  { key: 'finance.vat.read', module: ModuleKey.INCOME_EXPENSE, resource: 'vat', action: 'read' },
  { key: 'finance.vat.manage', module: ModuleKey.INCOME_EXPENSE, resource: 'vat', action: 'manage', is_sensitive: true },
  { key: 'finance.periods.manage', module: ModuleKey.INCOME_EXPENSE, resource: 'periods', action: 'manage', is_sensitive: true },
  { key: 'finance.payroll.read', module: ModuleKey.INCOME_EXPENSE, resource: 'payroll', action: 'read', is_sensitive: true },
  { key: 'finance.payroll.manage', module: ModuleKey.INCOME_EXPENSE, resource: 'payroll', action: 'manage', is_sensitive: true },
  { key: 'finance.recurring_expenses.manage', module: ModuleKey.INCOME_EXPENSE, resource: 'recurring_expenses', action: 'manage' },
  { key: 'finance.invoice_imports.review', module: ModuleKey.INCOME_EXPENSE, resource: 'invoice_imports', action: 'review' },
  { key: 'finance.profit_loss.read', module: ModuleKey.INCOME_EXPENSE, resource: 'profit_loss', action: 'read', is_sensitive: true },
  { key: 'finance.profitability.read', module: ModuleKey.INCOME_EXPENSE, resource: 'profitability', action: 'read', is_sensitive: true },
  { key: 'finance.ledger_settings.manage', module: ModuleKey.INCOME_EXPENSE, resource: 'ledger_settings', action: 'manage', is_sensitive: true },
  { key: 'employees.leave.read_own', module: ModuleKey.EMPLOYEES, resource: 'leave', action: 'read_own' },
  { key: 'employees.leave.read_all', module: ModuleKey.EMPLOYEES, resource: 'leave', action: 'read_all' },
  { key: 'employees.leave.request_own', module: ModuleKey.EMPLOYEES, resource: 'leave', action: 'request_own' },
  { key: 'employees.leave.manage_policies', module: ModuleKey.EMPLOYEES, resource: 'leave', action: 'manage_policies', is_sensitive: true },
  { key: 'employees.leave.manage_balances', module: ModuleKey.EMPLOYEES, resource: 'leave', action: 'manage_balances', is_sensitive: true },
  { key: 'employees.attendance.read_own', module: ModuleKey.EMPLOYEES, resource: 'attendance', action: 'read_own' },
  { key: 'employees.attendance.read_all', module: ModuleKey.EMPLOYEES, resource: 'attendance', action: 'read_all' },
  { key: 'employees.attendance.record_own', module: ModuleKey.EMPLOYEES, resource: 'attendance', action: 'record_own' },
  { key: 'employees.attendance.manage', module: ModuleKey.EMPLOYEES, resource: 'attendance', action: 'manage', is_sensitive: true },
  { key: 'employees.skills.read', module: ModuleKey.EMPLOYEES, resource: 'skills', action: 'read' },
  { key: 'employees.skills.manage', module: ModuleKey.EMPLOYEES, resource: 'skills', action: 'manage' },
  { key: 'employees.performance.read_own', module: ModuleKey.EMPLOYEES, resource: 'performance', action: 'read_own' },
  { key: 'employees.performance.read_all', module: ModuleKey.EMPLOYEES, resource: 'performance', action: 'read_all', is_sensitive: true },
  { key: 'employees.performance.manage', module: ModuleKey.EMPLOYEES, resource: 'performance', action: 'manage', is_sensitive: true },
  { key: 'employees.documents.read', module: ModuleKey.EMPLOYEES, resource: 'documents', action: 'read', is_sensitive: true },
  { key: 'employees.documents.manage', module: ModuleKey.EMPLOYEES, resource: 'documents', action: 'manage', is_sensitive: true },
  { key: 'employees.hr_notes.read', module: ModuleKey.EMPLOYEES, resource: 'hr_notes', action: 'read', is_sensitive: true },
  { key: 'employees.hr_notes.manage', module: ModuleKey.EMPLOYEES, resource: 'hr_notes', action: 'manage', is_sensitive: true },
  { key: 'employees.capacity.read', module: ModuleKey.EMPLOYEES, resource: 'capacity', action: 'read' },
  { key: 'employees.directory.read', module: ModuleKey.EMPLOYEES, resource: 'directory', action: 'read' },
  { key: 'employees.availability.manage', module: ModuleKey.EMPLOYEES, resource: 'availability', action: 'manage' },
  { key: 'employees.profile.update_own', module: ModuleKey.EMPLOYEES, resource: 'profile', action: 'update_own' },
  { key: 'communications.sender_identities.manage', module: ModuleKey.COMMUNICATION, resource: 'sender_identities', action: 'manage', is_sensitive: true },
  { key: 'communications.suppressions.manage', module: ModuleKey.COMMUNICATION, resource: 'suppressions', action: 'manage', is_sensitive: true },
  { key: 'communications.analytics.read', module: ModuleKey.COMMUNICATION, resource: 'analytics', action: 'read' },
  { key: 'communications.settings.manage', module: ModuleKey.COMMUNICATION, resource: 'settings', action: 'manage', is_sensitive: true },
  { key: 'messaging.settings.manage', module: ModuleKey.MESSAGING, resource: 'settings', action: 'manage', is_sensitive: true },
  { key: 'messaging.users.manage', module: ModuleKey.MESSAGING, resource: 'users', action: 'manage' },
  { key: 'messaging.retention.manage', module: ModuleKey.MESSAGING, resource: 'retention', action: 'manage', is_sensitive: true },
  { key: 'messaging.integrations.manage', module: ModuleKey.MESSAGING, resource: 'integrations', action: 'manage', is_sensitive: true },
  { key: 'messaging.audit.read', module: ModuleKey.MESSAGING, resource: 'audit', action: 'read', is_sensitive: true },
  { key: 'messaging.data.export', module: ModuleKey.MESSAGING, resource: 'data', action: 'export', is_sensitive: true },
  { key: 'messaging.channels.read', module: ModuleKey.MESSAGING, resource: 'channels', action: 'read' },
  { key: 'messaging.channels.create', module: ModuleKey.MESSAGING, resource: 'channels', action: 'create' },
  { key: 'messaging.messages.read', module: ModuleKey.MESSAGING, resource: 'messages', action: 'read' },
  { key: 'messaging.messages.post', module: ModuleKey.MESSAGING, resource: 'messages', action: 'post' },
  { key: 'messaging.messages.pin', module: ModuleKey.MESSAGING, resource: 'messages', action: 'pin' },
  { key: 'messaging.channel_members.manage', module: ModuleKey.MESSAGING, resource: 'channel_members', action: 'manage' },
  { key: 'support.tickets.merge', module: ModuleKey.SUPPORT, resource: 'tickets', action: 'merge' },
  { key: 'support.tickets.escalate', module: ModuleKey.SUPPORT, resource: 'tickets', action: 'escalate' },
  { key: 'support.tickets.convert_to_task', module: ModuleKey.SUPPORT, resource: 'tickets', action: 'convert_to_task' },
  { key: 'support.sla_policies.manage', module: ModuleKey.SUPPORT, resource: 'sla_policies', action: 'manage' },
  { key: 'support.canned_responses.manage', module: ModuleKey.SUPPORT, resource: 'canned_responses', action: 'manage' },
  { key: 'support.inboxes.manage', module: ModuleKey.SUPPORT, resource: 'inboxes', action: 'manage' },
  { key: 'support.automation.manage', module: ModuleKey.SUPPORT, resource: 'automation', action: 'manage' },
  { key: 'support.ai.configure', module: ModuleKey.SUPPORT, resource: 'ai', action: 'configure', is_sensitive: true },
  { key: 'support.ai.use', module: ModuleKey.SUPPORT, resource: 'ai', action: 'use' },
  { key: 'support.analytics.read', module: ModuleKey.SUPPORT, resource: 'analytics', action: 'read' },
  { key: 'support.settings.manage', module: ModuleKey.SUPPORT, resource: 'settings', action: 'manage' },
  { key: 'support.csat.read', module: ModuleKey.SUPPORT, resource: 'csat', action: 'read' },
  { key: 'notifications.templates.manage', module: ModuleKey.NOTIFICATIONS, resource: 'templates', action: 'manage' },
  { key: 'notifications.audit.read', module: ModuleKey.NOTIFICATIONS, resource: 'audit', action: 'read', is_sensitive: true },
  { key: 'notifications.preferences.manage_own', module: ModuleKey.NOTIFICATIONS, resource: 'preferences', action: 'manage_own' },
  { key: 'notifications.delivery_rules.manage', module: ModuleKey.NOTIFICATIONS, resource: 'delivery_rules', action: 'manage' },
  { key: 'docs.pages.create', module: ModuleKey.BUSINESS_DOCS, resource: 'pages', action: 'create' },
  { key: 'docs.pages.update', module: ModuleKey.BUSINESS_DOCS, resource: 'pages', action: 'update' },
  { key: 'docs.pages.archive', module: ModuleKey.BUSINESS_DOCS, resource: 'pages', action: 'archive' },
  { key: 'docs.pages.delete', module: ModuleKey.BUSINESS_DOCS, resource: 'pages', action: 'delete', is_sensitive: true },
  { key: 'docs.spaces.manage', module: ModuleKey.BUSINESS_DOCS, resource: 'spaces', action: 'manage' },
  { key: 'docs.forms.anonymous_responses.read', module: ModuleKey.BUSINESS_DOCS, resource: 'forms.anonymous_responses', action: 'read', is_sensitive: true },
  { key: 'docs.ai.query', module: ModuleKey.BUSINESS_DOCS, resource: 'ai', action: 'query' },
  { key: 'docs.checklists.manage', module: ModuleKey.BUSINESS_DOCS, resource: 'checklists', action: 'manage' },
  { key: 'documents.folders.manage', module: ModuleKey.DOCUMENTS, resource: 'folders', action: 'manage' },
  { key: 'documents.retention.manage', module: ModuleKey.DOCUMENTS, resource: 'retention', action: 'manage', is_sensitive: true },
  { key: 'documents.categories.manage', module: ModuleKey.DOCUMENTS, resource: 'categories', action: 'manage' },
  { key: 'documents.deletions.approve', module: ModuleKey.DOCUMENTS, resource: 'deletions', action: 'approve', is_sensitive: true },
  { key: 'documents.storage.manage', module: ModuleKey.DOCUMENTS, resource: 'storage', action: 'manage', is_sensitive: true },
  { key: 'time.entries.create_own', module: ModuleKey.TIME_TRACKING, resource: 'entries', action: 'create_own' },
  { key: 'time.entries.read_own', module: ModuleKey.TIME_TRACKING, resource: 'entries', action: 'read_own' },
  { key: 'time.entries.read_team', module: ModuleKey.TIME_TRACKING, resource: 'entries', action: 'read_team' },
  { key: 'time.entries.update_own', module: ModuleKey.TIME_TRACKING, resource: 'entries', action: 'update_own' },
  { key: 'time.entries.unlock', module: ModuleKey.TIME_TRACKING, resource: 'entries', action: 'unlock', is_sensitive: true },
  { key: 'time.rates.read', module: ModuleKey.TIME_TRACKING, resource: 'rates', action: 'read', is_sensitive: true },
  { key: 'time.rates.manage', module: ModuleKey.TIME_TRACKING, resource: 'rates', action: 'manage', is_sensitive: true },
  { key: 'time.reports.read', module: ModuleKey.TIME_TRACKING, resource: 'reports', action: 'read' },
  { key: 'time.timesheets.submit_own', module: ModuleKey.TIME_TRACKING, resource: 'timesheets', action: 'submit_own' },
  { key: 'time.timesheets.approve', module: ModuleKey.TIME_TRACKING, resource: 'timesheets', action: 'approve' },
  { key: 'time.settings.manage', module: ModuleKey.TIME_TRACKING, resource: 'settings', action: 'manage' },
  { key: 'calendar.availability.read', module: ModuleKey.CALENDAR, resource: 'availability', action: 'read' },
  { key: 'calendar.booking_links.manage', module: ModuleKey.CALENDAR, resource: 'booking_links', action: 'manage' },
  { key: 'calendar.calendars.manage', module: ModuleKey.CALENDAR, resource: 'calendars', action: 'manage' },
  { key: 'calendar.calendars.read_team', module: ModuleKey.CALENDAR, resource: 'calendars', action: 'read_team' },
  { key: 'calendar.events.create', module: ModuleKey.CALENDAR, resource: 'events', action: 'create' },
  { key: 'calendar.events.delete_own', module: ModuleKey.CALENDAR, resource: 'events', action: 'delete_own' },
  { key: 'calendar.events.read_own', module: ModuleKey.CALENDAR, resource: 'events', action: 'read_own' },
  { key: 'calendar.events.update_own', module: ModuleKey.CALENDAR, resource: 'events', action: 'update_own' },
  { key: 'calendar.sync.manage_own', module: ModuleKey.CALENDAR, resource: 'sync', action: 'manage_own' },
  { key: 'calendar.resources.manage', module: ModuleKey.CALENDAR, resource: 'resources', action: 'manage' },
  { key: 'automation.rules.read', module: ModuleKey.AUTOMATION, resource: 'rules', action: 'read' },
  { key: 'automation.rules.create', module: ModuleKey.AUTOMATION, resource: 'rules', action: 'create' },
  { key: 'automation.rules.update', module: ModuleKey.AUTOMATION, resource: 'rules', action: 'update' },
  { key: 'automation.rules.delete', module: ModuleKey.AUTOMATION, resource: 'rules', action: 'delete', is_sensitive: true },
  { key: 'automation.rules.enable', module: ModuleKey.AUTOMATION, resource: 'rules', action: 'enable', is_sensitive: true },
  { key: 'automation.runs.read', module: ModuleKey.AUTOMATION, resource: 'runs', action: 'read' },
  { key: 'automation.service_accounts.manage', module: ModuleKey.AUTOMATION, resource: 'service_accounts', action: 'manage', is_sensitive: true },
  { key: 'automation.actions.destructive.enable', module: ModuleKey.AUTOMATION, resource: 'actions.destructive', action: 'enable', is_sensitive: true },
  { key: 'automation.webhooks.manage', module: ModuleKey.AUTOMATION, resource: 'webhooks', action: 'manage', is_sensitive: true },
  { key: 'automation.jobs.read', module: ModuleKey.AUTOMATION, resource: 'jobs', action: 'read' },
  { key: 'automation.jobs.manage', module: ModuleKey.AUTOMATION, resource: 'jobs', action: 'manage', is_sensitive: true },
  { key: 'automation.settings.manage', module: ModuleKey.AUTOMATION, resource: 'settings', action: 'manage', is_sensitive: true },
  { key: 'projects.members.manage', module: ModuleKey.PROJECTS, resource: 'members', action: 'manage' },
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

/** Time tracking keys for people who manage a team's time, without rate administration or unlocking approved entries. */
const TIME_TEAM_PERMISSIONS = [
  'time.entries.read_all', 'time.entries.read_team', 'time.entries.approve', 'time.entries.create_own', 'time.entries.read_own',
  'time.entries.update_own', 'time.reports.read', 'time.timesheets.submit_own', 'time.timesheets.approve',
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
      'crm.*', 'projects.*', 'tasks.*', 'support.*', 'documents.documents.*', 'calendar.*', ...TIME_TEAM_PERMISSIONS, 'messaging.channels.manage',
    ],
  },
  {
    slug: 'manager', name: 'Manager', type: RoleType.ORGANIZATION, default_scope: ScopeType.ORGANIZATION,
    description: 'Manages operational modules; reads finance (01 §143).',
    modules: OPERATIONAL_MODULES.concat(ModuleKey.FINANCE, ModuleKey.EMPLOYEES),
    permissions: [
      'users.members.read', 'organizations.branches.read', 'organizations.teams.read',
      'crm.*', 'proposals.*', 'contracts.contracts.read', 'contracts.contracts.create', 'contracts.contracts.update',
      'projects.*', 'tasks.*', 'support.*', 'documents.documents.*', 'calendar.*', ...TIME_TEAM_PERMISSIONS,
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
    permissions: ['support.tickets.*', 'support.conversations.*', 'support.knowledge.read', 'support.knowledge.create', 'support.knowledge.update', 'crm.companies.read', 'crm.contacts.read', 'tasks.tasks.read', 'tasks.tasks.create', 'documents.documents.read', 'docs.pages.read'],
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

/**
 * Keys granted to role templates for the modules added after the first catalog (08–20).
 * Applied on top of each template's own list so the templates above stay readable.
 */
const SELF_SERVICE_PERMISSIONS = [
  'notifications.preferences.manage_own', 'employees.directory.read', 'employees.profile.update_own',
  'employees.leave.read_own', 'employees.leave.request_own', 'employees.attendance.read_own', 'employees.attendance.record_own',
  'employees.performance.read_own', 'time.entries.create_own', 'time.entries.read_own', 'time.entries.update_own',
  'time.timesheets.submit_own', 'calendar.availability.read', 'calendar.events.create', 'calendar.events.read_own',
  'calendar.events.update_own', 'calendar.events.delete_own', 'calendar.sync.manage_own',
  'messaging.channels.read', 'messaging.messages.read', 'messaging.messages.post', 'docs.pages.read',
];

/** Day-to-day use of outbound communication, messaging and wiki, without organization-level configuration. */
const COMMUNICATIONS_OPERATIONAL = [
  'communications.messages.*', 'communications.templates.*', 'communications.campaigns.*', 'communications.segments.*',
  'communications.analytics.read',
];
const MESSAGING_OPERATIONAL = [
  'messaging.channels.read', 'messaging.channels.create', 'messaging.channels.manage', 'messaging.messages.read',
  'messaging.messages.post', 'messaging.messages.pin', 'messaging.channel_members.manage',
];
const DOCS_OPERATIONAL = [
  'docs.pages.*', 'docs.forms.read', 'docs.forms.create', 'docs.forms.update', 'docs.forms.assign', 'docs.forms.review',
  'docs.checklists.manage', 'docs.ai.query',
];

const ROLE_EXTRAS: Record<string, string[]> = {
  'branch-admin': [
    ...COMMUNICATIONS_OPERATIONAL, ...MESSAGING_OPERATIONAL, ...DOCS_OPERATIONAL, 'documents.folders.manage',
    'employees.leave.read_all', 'employees.attendance.read_all', 'employees.capacity.read',
  ],
  manager: [
    ...COMMUNICATIONS_OPERATIONAL, ...MESSAGING_OPERATIONAL, ...DOCS_OPERATIONAL, 'documents.folders.manage',
    'employees.leave.read_all', 'employees.attendance.read_all', 'employees.capacity.read', 'employees.skills.read',
    'finance.dashboard.read', 'automation.rules.read', 'automation.runs.read',
  ],
  'project-manager': [
    'time.entries.read_team', 'time.reports.read', 'time.timesheets.approve', 'employees.capacity.read', 'employees.skills.read',
    'docs.pages.create', 'docs.pages.update', 'documents.folders.manage', 'messaging.channels.create', 'messaging.messages.pin',
    'support.tickets.convert_to_task',
  ],
  'sales-manager': [
    ...COMMUNICATIONS_OPERATIONAL, 'docs.pages.create', 'docs.pages.update', 'messaging.channels.create', 'automation.rules.read',
  ],
  'finance-manager': [
    'time.rates.read', 'time.reports.read', 'employees.compensation.read', 'communications.messages.read',
    'communications.messages.create', 'communications.messages.send', 'communications.templates.read',
  ],
  'support-agent': [
    'communications.messages.read', 'communications.messages.create', 'communications.messages.send',
    'communications.templates.read', 'support.tickets.convert_to_task', 'support.ai.use',
  ],
  developer: ['tasks.releases.manage'],
  employee: [],
  viewer: ['notifications.preferences.manage_own', 'employees.directory.read', 'calendar.availability.read', 'messaging.channels.read', 'messaging.messages.read', 'docs.pages.read'],
  'external-collaborator': ['notifications.preferences.manage_own'],
};

// Roles that do not receive the standard internal self-service set.
const NO_SELF_SERVICE = new Set(['owner', 'admin', 'viewer', 'external-collaborator']);

for (const template of ROLE_TEMPLATES) {
  if (template.type === RoleType.CUSTOMER_PORTAL) continue;
  if (!NO_SELF_SERVICE.has(template.slug)) template.permissions.push(...SELF_SERVICE_PERMISSIONS);
  template.permissions.push(...(ROLE_EXTRAS[template.slug] ?? []));
}

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
