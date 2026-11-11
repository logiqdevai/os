# Users, Members, Organizations, Branches & Permissions

> Linear: [LOG-406](https://linear.app/logiqdev/issue/LOG-406/users-members-organizations-branches-and-permissions) · Status: Backlog

> **Canonical for:** User, Organization (tenant), Branch, Team, Department, Membership, Role, Permission, Scope, module access, authentication, invitations, SSO/SCIM, Customer Portal identity, organization branding and localization defaults, tenant isolation, authorization API and audit of access changes. Every module references this file for these concepts instead of redefining them.
>
> **Depends on:** nothing inside the product. This is the foundation module.
>
> **Consumed by:** every other module. Terminology for the whole platform is fixed in `docs/Product_Specification.md` §"Terminology".

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (43)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| `User` | `users` | [L344](../../api/prisma/schema.prisma#L344) | 01 §4 — a global human identity. Never tenant-scoped. |
| `PasswordResetToken` | `password_reset_tokens` | [L404](../../api/prisma/schema.prisma#L404) |  |
| `UserAuthMethod` | `user_auth_methods` | [L420](../../api/prisma/schema.prisma#L420) | 01 §6, §74 — configured authentication factors per user (passkeys, OAuth links, MFA). |
| `UserSession` | `user_sessions` | [L445](../../api/prisma/schema.prisma#L445) | 01 §72 — active sessions, revocable by the user or by security policy. |
| `UserDevice` | `user_devices` | [L475](../../api/prisma/schema.prisma#L475) | 01 §72, §74 — browsers and devices a User has signed in from, for "trusted device" (skip MFA) and known-device alerts. User-level like UserSession (a device … |
| `UserPreference` | `user_preferences` | [L497](../../api/prisma/schema.prisma#L497) | 01 §127 — user-specific preferences. These are not permissions. |
| `Organization` | `organizations` | [L516](../../api/prisma/schema.prisma#L516) | 01 §8 — the tenant. Every major resource belongs to exactly one Organization (01 §9). |
| `OrganizationSecurityPolicy` | `organization_security_policies` | [L850](../../api/prisma/schema.prisma#L850) | 01 §73–74 — organization security policy. |
| `OrganizationDomain` | `organization_domains` | [L918](../../api/prisma/schema.prisma#L918) | 01 §70 — verified corporate email domains. |
| `OrganizationRetentionPolicy` | `organization_retention_policies` | [L946](../../api/prisma/schema.prisma#L946) | 01 §134 — retention of platform data (audit events, sessions, invitations, webhook deliveries), one policy per data class. Documents and messages keep their … |
| `OrganizationPlan` | `organization_plans` | [L970](../../api/prisma/schema.prisma#L970) | 01 §105 — the organization's OWN subscription to Logiqdev OS (plan, seats, limits). Not the customer-facing Subscription of module 08. Card data is never sto… |
| `OrganizationPlanInvoice` | `organization_plan_invoices` | [L993](../../api/prisma/schema.prisma#L993) | 01 §105 — invoice issued by Logiqdev OS to the organization for its plan. |
| `OrganizationModule` | `organization_modules` | [L1018](../../api/prisma/schema.prisma#L1018) | 01 §56 — which products are enabled for the organization. |
| `OrganizationEntitlement` | `organization_entitlements` | [L1038](../../api/prisma/schema.prisma#L1038) | 01 §56 — what the organization's plan, trial or an operator override allows, per metered key (`documents.storage_bytes`, `automation.runs_per_month`, `automa… |
| `Branch` | `branches` | [L1087](../../api/prisma/schema.prisma#L1087) | 01 §18 — an organizational unit inside an Organization. Never a tenant. |
| `BranchManager` | `branch_managers` | [L1178](../../api/prisma/schema.prisma#L1178) | 01 §20 — responsible Members for a branch. |
| `BranchHoliday` | `branch_holidays` | [L1193](../../api/prisma/schema.prisma#L1193) | 01 §122 — local holiday calendars consumed by Calendar (19) and Employees (10). |
| `Team` | `teams` | [L1213](../../api/prisma/schema.prisma#L1213) | 01 §40 — functional collaboration group. Not a Branch. |
| `TeamMembership` | `team_memberships` | [L1286](../../api/prisma/schema.prisma#L1286) | 01 §42 |
| `Membership` | `memberships` | [L1314](../../api/prisma/schema.prisma#L1314) | 01 §24, 12 §81 — the authorization relationship between a User and an Organization; the subject of every per-module permission check. Employee data (10) is N… |
| `MembershipBranch` | `membership_branches` | [L1570](../../api/prisma/schema.prisma#L1570) | 01 §21, §90 — a Member can belong to one or many branches. |
| `MembershipModuleAccess` | `membership_module_access` | [L1589](../../api/prisma/schema.prisma#L1589) | 01 §56–57 — per-member product access, evaluated before feature permissions. |
| `Permission` | `permissions` | [L1611](../../api/prisma/schema.prisma#L1611) | 01 §46 — the global permission catalog. Keys follow `<module>.<resource>.<action>`. Every module's "Permissions" section registers its keys here (06 §15, 07 … |
| `Role` | `roles` | [L1633](../../api/prisma/schema.prisma#L1633) | 01 §44–45, §111 — reusable permission bundle. organization_id is null for system roles and platform-provided templates (01 §111) that organizations clone. |
| `RolePermission` | `role_permissions` | [L1676](../../api/prisma/schema.prisma#L1676) | 01 §44, §53 — permissions bundled in a role, with optional explicit deny. |
| `RoleAssignment` | `role_assignments` | [L1695](../../api/prisma/schema.prisma#L1695) | 01 §92–93 — a role given to a principal (Member or Service Account) within a scope. scope_id references the Branch, Team, Project (05), Customer (02) or reso… |
| `PermissionGrant` | `permission_grants` | [L1722](../../api/prisma/schema.prisma#L1722) | 01 §49, §53 — explicit per-member allow or deny for one permission, outside any role. |
| `Delegation` | `delegations` | [L1746](../../api/prisma/schema.prisma#L1746) | 01 §94 — temporary delegation of selected responsibilities. |
| `AccessReview` | `access_reviews` | [L1782](../../api/prisma/schema.prisma#L1782) | 01 §98 — periodic access review (certification campaign) over an organization, branch, team or module. |
| `AccessReviewItem` | `access_review_items` | [L1813](../../api/prisma/schema.prisma#L1813) | 01 §98 — one member's access inside an access review, with the reviewer's decision. |
| `RoleVersion` | `role_versions` | [L1839](../../api/prisma/schema.prisma#L1839) | 01 §109 — immutable snapshot of a role each time it is published. |
| `IntegrationConnection` | `integration_connections` | [L1865](../../api/prisma/schema.prisma#L1865) | 01 §157 — one connected third-party service of an organization (OpenAI, Resend, Stripe, Twilio ...) with the organization's OWN credentials, so provider keys… |
| `IntegrationUsageDaily` | `integration_usage_daily` | [L1920](../../api/prisma/schema.prisma#L1920) | 01 §157 — daily usage of one connection for the usage view and spend guardrails. Written only by the integration layer. |
| `Invitation` | `invitations` | [L1947](../../api/prisma/schema.prisma#L1947) |  |
| `SsoConfiguration` | `sso_configurations` | [L2004](../../api/prisma/schema.prisma#L2004) | 01 §69 — identity provider configuration per organization. |
| `SsoGroupMapping` | `sso_group_mappings` | [L2028](../../api/prisma/schema.prisma#L2028) | 01 §71 — external IdP group → role / team / branch / module access. |
| `ServiceAccount` | `service_accounts` | [L2052](../../api/prisma/schema.prisma#L2052) | 01 §76 — non-human identity for automation. Permissions come from RoleAssignment. |
| `ApiKey` | `api_keys` | [L2080](../../api/prisma/schema.prisma#L2080) | 01 §75 — API credential owned by a Member or a Service Account. Never inherits unlimited permissions. |
| `McpToolCall` | `mcp_tool_calls` | [L2120](../../api/prisma/schema.prisma#L2120) | 01 §75, §136 — one MCP tool invocation by an AI agent, API key or service account (also members acting through an MCP client). Sensitive tools wait in AWAITI… |
| `ApiKeyUsageDaily` | `api_key_usage_daily` | [L2178](../../api/prisma/schema.prisma#L2178) | 01 §75 — daily usage of one API key (requests, rejections, source IPs) for the key detail view and new-IP alerts. Written only by the API gateway; rows are n… |
| `CustomerPortalMembership` | `customer_portal_memberships` | [L2204](../../api/prisma/schema.prisma#L2204) | 01 §79 — a User's membership to a Customer (a CRM Company owned by docs/features/02, LOG-404) inside an agency Organization. customer_id has no relation unti… |
| `CustomerPortalMembershipProject` | `customer_portal_membership_projects` | [L2238](../../api/prisma/schema.prisma#L2238) | 07 §2, §4 — restricts a portal user to specific customer-visible projects. No rows = every customer-visible project of the company. |
| `AuditEvent` | `audit_events` | [L2268](../../api/prisma/schema.prisma#L2268) | Immutable audit event. Identity and access changes are written here by module 01; other modules append their own event types using the same table (06 §3, 07 … |

**Owned enums (43):** `AuthRole`, `UserStatus`, `AuthMethodType`, `OrganizationStatus`, `BranchStatus`, `BranchKind`, `MembershipType`, `MembershipStatus`, `TeamKind`, `RoleType`, `RoleStatus`, `ScopeType`, `PermissionEffect`, `ModuleKey`, `InvitationStatus`, `ProvisioningSource`, `SsoProtocol`, `DomainVerificationStatus`, `MfaPolicy`, `ServiceAccountStatus`, `DelegationStatus`, `InvitationPolicy`, `InvitationAudience`, `AccessReviewStatus`, `AccessReviewDecision`, `IntegrationProvider`, `IntegrationCategory`, `IntegrationStatus`, `IntegrationMode`, `IntegrationCredentialSource`, `AuditActorType`, `DocumentType`, `DomainTlsStatus`, `OrganizationRetentionDataClass`, `OrganizationRetentionAction`, `OrganizationPlanStatus`, `OrganizationPlanInvoiceStatus`, `EntitlementPeriod`, `EntitlementEnforcement`, `EntitlementSource`, `ReviewerStrategy`, `McpToolCallStatus`, `AuditOutcome`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `Invitation.customer` |
| [05](./05-project-management.md) | `Project` (`projects`) | `CustomerPortalMembershipProject.project` |
| [07](./07-customer-portal.md) | `CustomerPortalSettings` (`customer_portal_settings`) | `Organization.portal_settings` |
| [09](./09-income-expense-management.md) | `LedgerSettings` (`ledger_settings`) | `Organization.ledger_settings` |
| [10](./10-employee-management-system.md) | `Employee` (`employees`) | `Membership.employee` |
| [10](./10-employee-management-system.md) | `EmployeeHrSettings` (`employee_hr_settings`) | `Organization.employee_hr_settings` |
| [11](./11-communication-center.md) | `CommSettings` (`comm_settings`) | `Organization.comm_settings` |
| [12](./12-messaging-team-communication.md) | `MessagingMemberSettings` (`messaging_member_settings`) | `Membership.messaging_settings` |
| [12](./12-messaging-team-communication.md) | `MessagingPresence` (`messaging_presence`) | `Membership.messaging_presence` |
| [12](./12-messaging-team-communication.md) | `MessagingSettings` (`messaging_settings`) | `Organization.messaging_settings` |
| [13](./13-customer-support-communication-hub.md) | `SupportAgentProfile` (`support_agent_profiles`) | `Membership.support_agent_profile` |
| [13](./13-customer-support-communication-hub.md) | `SupportSettings` (`support_settings`) | `Organization.support_settings` |
| [14](./14-notifications-activity-center.md) | `NotificationOrgSettings` (`notification_org_settings`) | `Organization.notification_org_settings` |
| [14](./14-notifications-activity-center.md) | `NotificationRecipientSettings` (`notification_recipient_settings`) | `CustomerPortalMembership.notification_settings`, `Membership.notification_settings` |
| [17](./17-documents-file-management.md) | `DocumentSettings` (`document_settings`) | `Organization.document_settings` |
| [17](./17-documents-file-management.md) | `VaultKey` (`vault_keys`) | `IntegrationConnection.vault_key` |
| [18](./18-time-tracking.md) | `TimeTrackingSettings` (`time_tracking_settings`) | `Organization.time_tracking_settings` |
| [19](./19-calendar.md) | `CalendarPreference` (`calendar_preferences`) | `Membership.calendar_preference` |
| [20](./20-automation-engine.md) | `AutomationSettings` (`automation_settings`) | `Organization.automation_settings` |

### Referenced by other modules

- [02](./02-crm-sales-management.md): `CrmActivity`, `CrmAssignmentRule`, `CrmCompany`, `CrmCompanyBranch`, `CrmContact`, `CrmDashboardLayout`, `CrmDeal`, `CrmDiscountPolicy`, `CrmDuplicateDismissal`, `CrmDuplicateRule`, `CrmForecastSnapshot`, `CrmImportJob`, `CrmImportMapping`, `CrmLead`, `CrmLeadScoringRule`, `CrmLeadSource`, `CrmLeadStatus`, `CrmLifecycleStage`, `CrmLossReason`, `CrmMergeLog`, `CrmNote`, `CrmPipeline`, `CrmReportSchedule`, `CrmSalesTarget`, `CustomFieldDefinition`, `CustomFieldGroup`, `SavedView`, `Tag`
- [03](./03-proposal-quotation-generator.md): `NumberSequence`, `Proposal`, `ProposalAiFinding`, `ProposalApproval`, `ProposalApprovalRule`, `ProposalComment`, `ProposalTemplate`
- [04](./04-contracts.md): `Contract`, `ContractAiFinding`, `ContractApproval`, `ContractApprovalRule`, `ContractClause`, `ContractComment`, `ContractReview`, `ContractSignatory`, `ContractTemplate`, `ContractType`, `SignatureConsentText`, `SignatureRequest`, `VerificationCode`
- [05](./05-project-management.md): `Project`, `ProjectAllocation`, `ProjectBranch`, `ProjectDeliverableApprover`, `ProjectDeliverableReview`, `ProjectFavorite`, `ProjectGate`, `ProjectMember`, `ProjectStatus`, `ProjectStatusUpdateComment`, `ProjectTemplate`, `ProjectType`
- [06](./06-task-management.md): `Cycle`, `Release`, `Task`, `TaskAssignee`, `TaskComment`, `TaskLabel`, `TaskStatus`, `TaskType`, `TaskWatcher`
- [07](./07-customer-portal.md): `CustomerPortalClientSettings`, `CustomerPortalProfileChangeRequest`, `CustomerPortalSettings`
- [08](./08-financial-management-stripe-integration.md): `BillingProfile`, `Coupon`, `CreditNote`, `DunningPolicy`, `FinanceApproval`, `FinanceApprovalRule`, `FinanceReportSchedule`, `Invoice`, `InvoiceTemplate`, `Payment`, `PaymentDispute`, `PaymentLink`, `PaymentPayout`, `PaymentProviderConnection`, `PaymentProviderObject`, `Product`, `ProviderWebhookEvent`, `Subscription`, `TaxRate`
- [09](./09-income-expense-management.md): `ExpenseClaim`, `FinancialPeriod`, `FinancialPeriodSummary`, `LedgerBalanceSnapshot`, `LedgerBudget`, `LedgerBudgetLine`, `LedgerCategory`, `LedgerInsight`, `LedgerInvoiceImport`, `LedgerPaymentMethod`, `LedgerProfitabilitySnapshot`, `LedgerRecord`, `LedgerSettings`, `LedgerSettlement`, `LedgerSupplierProfile`, `PayrollEntry`, `PayrollSchedule`, `RecurringExpense`, `VatReturn`
- [10](./10-employee-management-system.md): `AttendanceRecord`, `AttendanceSummary`, `CompanyHoliday`, `Employee`, `EmployeeAvailabilityEntry`, `EmployeeCapacityPeriod`, `EmployeeDocument`, `EmployeeEquipment`, `EmployeeHrNote`, `EmployeeHrSettings`, `EmployeeImportJob`, `EmployeePosition`, `EmployeeProfileChangeRequest`, `LeaveBalance`, `LeavePolicy`, `LeaveRequest`, `LeaveRequestApproval`, `LeaveType`, `PerformanceCalibration`, `PerformanceFeedback`, `PerformanceFeedbackRequest`, `PerformanceGoal`, `PerformanceImprovementPlan`, `PerformanceReview`, `PerformanceReviewCycle`, `ProjectAllocationSkill`, `Skill`
- [11](./11-communication-center.md): `Campaign`, `CampaignApproval`, `CampaignRecipient`, `CommAiGeneration`, `CommConsent`, `CommDailyStat`, `CommDeliveryEvent`, `CommMessage`, `CommMessageRecipient`, `CommProviderAccount`, `CommRecipientList`, `CommRecipientListMember`, `CommSenderDomain`, `CommSenderIdentity`, `CommSettings`, `CommSignature`, `CommSuppression`, `CommTemplate`, `CommTemplateVersion`, `CommThread`, `CommTopic`, `CommTopicSubscription`, `CommTrackedLink`, `Segment`
- [12](./12-messaging-team-communication.md): `Channel`, `ChannelAccessRequest`, `ChannelCall`, `ChannelCallParticipant`, `ChannelInvitation`, `ChannelMember`, `ChannelMemberRestriction`, `ChannelPin`, `ChannelReadState`, `ChannelSection`, `ChannelTemplate`, `Message`, `MessageAcknowledgement`, `MessageDraft`, `MessageMention`, `MessageReaction`, `MessageReadReceipt`, `MessageReminder`, `MessageReport`, `MessageThreadFollower`, `MessagingExportJob`, `MessagingIntegration`, `MessagingKeyword`, `MessagingLegalHold`, `MessagingMemberSettings`, `MessagingPresence`, `MessagingRetentionPolicy`, `MessagingSettings`, `MessagingUsageDaily`, `SavedMessage`
- [13](./13-customer-support-communication-hub.md): `KnowledgeArticle`, `KnowledgeArticleFeedback`, `KnowledgeCategory`, `SlaPolicy`, `SupportAgentProfile`, `SupportAiSession`, `SupportAiSuggestion`, `SupportCannedResponse`, `SupportChannel`, `SupportConversation`, `SupportConversationParticipant`, `SupportCsatRating`, `SupportInbox`, `SupportIncident`, `SupportIncidentUpdate`, `SupportMessage`, `SupportSettings`, `Ticket`, `TicketCategory`, `TicketFollower`, `TicketStatus`
- [14](./14-notifications-activity-center.md): `ActivityEvent`, `Announcement`, `AnnouncementAcknowledgement`, `Notification`, `NotificationDelivery`, `NotificationDeliveryRule`, `NotificationDigest`, `NotificationEvent`, `NotificationEventType`, `NotificationKeyword`, `NotificationOrgDefault`, `NotificationOrgSettings`, `NotificationPreference`, `NotificationPushDevice`, `NotificationRecipientSettings`, `NotificationTemplate`, `NotificationTemplateVersion`
- [15](./15-notion-business-docs.md): `CustomForm`, `FormAssignment`, `FormAssignmentRecipient`, `FormSubmission`, `WikiAiIndexEntry`, `WikiAiSuggestion`, `WikiChecklist`, `WikiChecklistRun`, `WikiPage`, `WikiPageAcknowledgement`, `WikiPageComment`, `WikiPageFavorite`, `WikiPageFeedback`, `WikiPageReviewRequest`, `WikiPageReviewer`, `WikiPageTemplate`, `WikiPageView`, `WikiPageViewDaily`, `WikiPageWatcher`, `WikiSearchQuery`, `WikiSpace`, `WikiSpaceMember`, `WikiTransferJob`
- [17](./17-documents-file-management.md): `Document`, `DocumentApproval`, `DocumentApprover`, `DocumentAttachment`, `DocumentCategory`, `DocumentDeletionRequest`, `DocumentFavorite`, `DocumentRecentAccess`, `DocumentRetentionPolicy`, `DocumentSettings`, `DocumentShare`, `DocumentStorageConnection`, `DocumentTemplate`, `DocumentUploadJob`, `DocumentVersion`, `Folder`, `FolderTemplate`, `VaultAccessLog`, `VaultEntry`, `VaultEntryGrant`, `VaultKey`
- [18](./18-time-tracking.md): `BillingRate`, `TimeActivityType`, `TimeEntry`, `TimeEntryAdjustment`, `TimeExport`, `TimeImportJob`, `TimeProjectSettings`, `TimeReportSchedule`, `TimeSuggestion`, `TimeTrackingSettings`, `TimeUtilizationPeriod`, `Timer`, `Timesheet`, `TimesheetAction`
- [19](./19-calendar.md): `BookingLink`, `BookingLinkHost`, `BookingLinkStatsDaily`, `Calendar`, `CalendarAvailabilitySchedule`, `CalendarBooking`, `CalendarConferencingAccount`, `CalendarConnection`, `CalendarEvent`, `CalendarEventAttendee`, `CalendarEventReminder`, `CalendarEventType`, `CalendarPreference`, `CalendarResource`, `CalendarShare`
- [20](./20-automation-engine.md): `AutomationAiStep`, `AutomationApproval`, `AutomationApprovalPolicy`, `AutomationInboundWebhook`, `AutomationRule`, `AutomationRuleTemplate`, `AutomationRuleVersion`, `AutomationRun`, `AutomationRunLock`, `AutomationSettings`, `OutboundWebhook`, `PlatformEvent`, `ScheduledJob`, `ScheduledJobRun`, `WebhookDelivery`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `ProposalTemplate.branding` ([03](./03-proposal-quotation-generator.md), [L3831](../../api/prisma/schema.prisma#L3831)) — Branding overrides; organization branding (01 §15) is the fallback.
- `ProposalAcceptance.customer_user_id` ([03](./03-proposal-quotation-generator.md), [L4263](../../api/prisma/schema.prisma#L4263)) — Customer Portal User (01 §79) when accepted through the portal; id only.
- `Project.branch_id` ([05](./05-project-management.md), [L5696](../../api/prisma/schema.prisma#L5696)) — Primary branch (01 §32). Participating branches in ProjectBranch.
- `ProjectStakeholder.portal_visible` ([05](./05-project-management.md), [L5875](../../api/prisma/schema.prisma#L5875)) — Whether the stakeholder sees the project in the Customer Portal (via 01 §79 identity).
- `ProjectGate.customer_approver_user_id` ([05](./05-project-management.md), [L6267](../../api/prisma/schema.prisma#L6267)) — Customer approval gates are decided by a Customer Portal User (01 §79); id only.
- `ProjectDeliverableReview.reviewer_user_id` ([05](./05-project-management.md), [L6501](../../api/prisma/schema.prisma#L6501)) — Customer Portal User (01 §79) when decided through the portal.
- `ProjectStatusUpdateComment.author_user_id` ([05](./05-project-management.md), [L6547](../../api/prisma/schema.prisma#L6547)) — Customer Portal User (01 §79) when written from the portal.
- `TaskComment.author_user_id` ([06](./06-task-management.md), [L6909](../../api/prisma/schema.prisma#L6909)) — Customer Portal User (01 §79) when written from the portal; id only.
- `CustomerPortalSettings.branding` ([07](./07-customer-portal.md), [L7073](../../api/prisma/schema.prisma#L7073)) — Branding overrides on top of organization branding (01 §15).
- `CustomerPortalSettings.default_role_slug` ([07](./07-customer-portal.md), [L7073](../../api/prisma/schema.prisma#L7073)) — Default customer role slug assigned to invited portal users (01 §79).
- `Invoice.template_id` ([08](./08-financial-management-stripe-integration.md), [L7550](../../api/prisma/schema.prisma#L7550)) — Template / branding override; organization branding (01 §15) is the fallback.
- `Invoice.approved_by_user_id` ([08](./08-financial-management-stripe-integration.md), [L7550](../../api/prisma/schema.prisma#L7550)) — 08 "Invoicing" — explicit invoice approval (01 §95); must differ from created_by_user_id (separation of duties, 01 §96). Null = not approved / not required.
- `PaymentProviderConnection.integration_connection_id` ([08](./08-financial-management-stripe-integration.md), [L7983](../../api/prisma/schema.prisma#L7983)) — 01 §157 — the organization's own credentials for this provider account (API keys, webhook signing secret). Secrets never live on this row.
- `PaymentProviderConnection.branch_id` ([08](./08-financial-management-stripe-integration.md), [L7983](../../api/prisma/schema.prisma#L7983)) — 01 §34 — limit the connection to one branch; null = whole organization.
- `FinanceApprovalRule.branch_id` ([08](./08-financial-management-stripe-integration.md), [L8267](../../api/prisma/schema.prisma#L8267)) — 01 §34 — limit to one branch / cost center; null = whole organization.
- `FinanceApprovalRule.require_distinct_user` ([08](./08-financial-management-stripe-integration.md), [L8267](../../api/prisma/schema.prisma#L8267)) — The requester can never approve their own item (01 §96).
- `LedgerSettings.reporting_currency` ([09](./09-income-expense-management.md), [L8560](../../api/prisma/schema.prisma#L8560)) — Reporting currency; falls back to Organization.default_currency (01 §14).
- `LedgerRecord.branch_id` ([09](./09-income-expense-management.md), [L8717](../../api/prisma/schema.prisma#L8717)) — Cost center / branch context (01 §34).
- `LedgerRecord.department_id` ([09](./09-income-expense-management.md), [L8717](../../api/prisma/schema.prisma#L8717)) — Department = Team of kind DEPARTMENT (01 §43).
- `RecurringExpense.department_id` ([09](./09-income-expense-management.md), [L9006](../../api/prisma/schema.prisma#L9006)) — Department = Team of kind DEPARTMENT (01 §43).
- `PayrollSchedule.department_id` ([09](./09-income-expense-management.md), [L9081](../../api/prisma/schema.prisma#L9081)) — Department = Team of kind DEPARTMENT (01 §43).
- `PayrollEntry.department_id` ([09](./09-income-expense-management.md), [L9128](../../api/prisma/schema.prisma#L9128)) — Department = Team of kind DEPARTMENT (01 §43).
- `Employee.national_id_number` ([10](./10-employee-management-system.md), [L10017](../../api/prisma/schema.prisma#L10017)) — Sensitive identifiers (01 §60).
- `Employee.department_team_id` ([10](./10-employee-management-system.md), [L10017](../../api/prisma/schema.prisma#L10017)) — Team of kind DEPARTMENT (01 §43).
- `EmployeePosition.department_team_id` ([10](./10-employee-management-system.md), [L10166](../../api/prisma/schema.prisma#L10166)) — Team of kind DEPARTMENT (01 §43).
- `EmployeeDocument.is_confidential` ([10](./10-employee-management-system.md), [L11120](../../api/prisma/schema.prisma#L11120)) — Restricted to HR / explicit grants (01 §60).
- `CommProviderAccount.integration_connection_id` ([11](./11-communication-center.md), [L11714](../../api/prisma/schema.prisma#L11714)) — 01 §157 — the organization's own credentials (API key, webhook secret) for this provider. Secrets never live on this row.
- `CommMessage.branding_snapshot` ([11](./11-communication-center.md), [L11988](../../api/prisma/schema.prisma#L11988)) — Branded layout applied (01 §15 / §120 snapshot at send time).
- `CommMessage.recipient_user_id` ([11](./11-communication-center.md), [L11988](../../api/prisma/schema.prisma#L11988)) — Customer Portal User (01 §79); id only.
- `CommMessageRecipient.user_id` ([11](./11-communication-center.md), [L12152](../../api/prisma/schema.prisma#L12152)) — Customer Portal User (01 §79); id only.
- `MessageReaction.external_user_id` ([12](./12-messaging-team-communication.md), [L13604](../../api/prisma/schema.prisma#L13604)) — External participant reactor (01 §79); id only.
- `MessageMention.external_user_id` ([12](./12-messaging-team-communication.md), [L13624](../../api/prisma/schema.prisma#L13624)) — External participant mentioned (01 §79); id only.
- `ChannelCallParticipant.external_user_id` ([12](./12-messaging-team-communication.md), [L14169](../../api/prisma/schema.prisma#L14169)) — External participant (01 §79); id only.
- `SupportConversation.customer_user_id` ([13](./13-customer-support-communication-hub.md), [L14713](../../api/prisma/schema.prisma#L14713)) — Customer Portal User (01 §79) when started from the portal/authenticated widget.
- `SupportMessage.author_user_id` ([13](./13-customer-support-communication-hub.md), [L14816](../../api/prisma/schema.prisma#L14816)) — Customer Portal User (01 §79) when written from the portal/widget.
- `SlaPolicy.use_business_hours` ([13](./13-customer-support-communication-hub.md), [L14964](../../api/prisma/schema.prisma#L14964)) — Count only business hours (Organization/Branch business_hours, 01 §14, §120) instead of calendar hours.
- `Ticket.requester_user_id` ([13](./13-customer-support-communication-hub.md), [L15016](../../api/prisma/schema.prisma#L15016)) — Customer Portal User who opened / may view the ticket (01 §79).
- `SupportCsatRating.rated_by_user_id` ([13](./13-customer-support-communication-hub.md), [L15353](../../api/prisma/schema.prisma#L15353)) — Customer Portal User who rated (01 §79).
- `KnowledgeArticleFeedback.user_id` ([13](./13-customer-support-communication-hub.md), [L15533](../../api/prisma/schema.prisma#L15533)) — Customer Portal User (01 §79) when authenticated.
- `NotificationEvent.actor_service_account_id` ([14](./14-notifications-activity-center.md), [L15906](../../api/prisma/schema.prisma#L15906)) — 01 ServiceAccount id when published by an integration.
- `Notification.recipient_user_id` ([14](./14-notifications-activity-center.md), [L15967](../../api/prisma/schema.prisma#L15967)) — Customer Portal User (01 §79) — set with portal_membership_id for portal-scoped inboxes (14 §7).
- `NotificationRecipientSettings.timezone` ([14](./14-notifications-activity-center.md), [L16213](../../api/prisma/schema.prisma#L16213)) — IANA time zone; null = the user's / organization's time zone (01 §127).
- `NotificationRecipientSettings.language` ([14](./14-notifications-activity-center.md), [L16213](../../api/prisma/schema.prisma#L16213)) — Preferred notification language; null = user language (01 §127).
- `WikiSpace.department_id` ([15](./15-notion-business-docs.md), [L16835](../../api/prisma/schema.prisma#L16835)) — Department = Team of kind DEPARTMENT (01 §43).
- `WikiChecklist.department_id` ([15](./15-notion-business-docs.md), [L17228](../../api/prisma/schema.prisma#L17228)) — Department = Team of kind DEPARTMENT (01 §43).
- `WikiChecklist.role_id` ([15](./15-notion-business-docs.md), [L17228](../../api/prisma/schema.prisma#L17228)) — Role (01) this checklist applies to; null = all roles.
- `WikiChecklist.auto_assign` ([15](./15-notion-business-docs.md), [L17228](../../api/prisma/schema.prisma#L17228)) — Auto-start on member onboarding/offboarding (01 §130–131) when department/role match.
- `FormAssignment.target_id` ([15](./15-notion-business-docs.md), [L17424](../../api/prisma/schema.prisma#L17424)) — memberships / teams / branches id or Department = Team of kind DEPARTMENT (01 §43) id; null for ORGANIZATION.
- `Document.type` ([17](./17-documents-file-management.md), [L18271](../../api/prisma/schema.prisma#L18271)) — Legacy coarse file kind; kept for existing branding uploads (01 §15).
- `TimeTrackingSettings.week_start` ([18](./18-time-tracking.md), [L19158](../../api/prisma/schema.prisma#L19158)) — 1 = Monday … 7 = Sunday; falls back to Organization.week_start (01 §14).
- `TimeEntry.membership_id` ([18](./18-time-tracking.md), [L19343](../../api/prisma/schema.prisma#L19343)) — The member who performed the work (Member with an Employee record, 01 §80).
- `TimeEntry.branch_id` ([18](./18-time-tracking.md), [L19343](../../api/prisma/schema.prisma#L19343)) — Branch scope for reporting (01 §123–124): the project's primary branch or the member's primary branch.
- `Timesheet.expected_minutes` ([18](./18-time-tracking.md), [L19632](../../api/prisma/schema.prisma#L19632)) — Expected capacity for the period from working hours, leave and holidays (10, 01 §121–122).
- `TimeUtilizationPeriod.leave_minutes` ([18](./18-time-tracking.md), [L19714](../../api/prisma/schema.prisma#L19714)) — Minutes of approved leave and holidays removed from capacity (10, 01 §122).
- `CalendarPreference.timezone` ([19](./19-calendar.md), [L20058](../../api/prisma/schema.prisma#L20058)) — IANA zone override; falls back to User.timezone, then Branch/Organization (01 §120).
- `CalendarResource.availability` ([19](./19-calendar.md), [L20176](../../api/prisma/schema.prisma#L20176)) — Hours the resource can be booked: { mon: [{start,end}], … }; null = branch business hours (01 §121).
- `CalendarEvent.branch_id` ([19](./19-calendar.md), [L20217](../../api/prisma/schema.prisma#L20217)) — Branch whose business hours / holidays apply (01 §120–122); null = organization.
- `CalendarAvailabilitySchedule.honor_holidays` ([19](./19-calendar.md), [L20456](../../api/prisma/schema.prisma#L20456)) — Respect branch holidays (01 §122) and approved leave (10) on top of the rules.
- `BookingLink.branding` ([19](./19-calendar.md), [L20522](../../api/prisma/schema.prisma#L20522)) — Page branding overrides (01 §15 branding is the default).
- `CalendarBooking.invitee_user_id` ([19](./19-calendar.md), [L20621](../../api/prisma/schema.prisma#L20621)) — Customer Portal user who booked (01 §79).
- `AutomationSettings.default_service_account_id` ([20](./20-automation-engine.md), [L21064](../../api/prisma/schema.prisma#L21064)) — 20 §4, §14 — service account used when a rule has none of its own (01 §76).
- `AutomationRule.run_as_service_account_id` ([20](./20-automation-engine.md), [L21221](../../api/prisma/schema.prisma#L21221)) — 20 §4, §14 — run under a service account instead of the owner (01 §76).
- `ScheduledJob.branch_id` ([20](./20-automation-engine.md), [L21765](../../api/prisma/schema.prisma#L21765)) — 20 §7 — optional branch scope for branch-level module jobs (01 §34 branch reporting).
- `OutboundWebhook.previous_secret` ([20](./20-automation-engine.md), [L21877](../../api/prisma/schema.prisma#L21877)) — 01 §138 — secret rotation grace: deliveries are also verifiable with the previous (encrypted) secret until previous_secret_expires_at.

<!-- schema-refs:end -->

<!-- access-channels:start -->

## Access channels & permissions

> Generated by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand. Standard: [Product Specification §4a](../Product_Specification.md). Rules: `.cursor/rules/roles-and-permissions-in-every-feature.mdc`.

Every capability of this module is built for **all access channels at once**. Each channel goes through the central authorization service ([01 §136](./01-users-organizations-permissions.md)) and the same permission keys, so roles and permissions exist from the first commit and are never added later.

| Channel | Required for this module |
| -- | -- |
| UI | Routes, navigation, buttons and fields gated by permission key; no-access state for `403`/`404` |
| REST API | One endpoint per resource action with `@RequirePermission`, organization taken from the credential, lists filtered by branch/team/project scope |
| MCP | A tool `<module>_<resource>_<action>` per agent-useful action, a thin adapter over the same service and validation, listed only to callers holding the key; sensitive tools need human confirmation when an AI agent calls them |
| API key / service account | Explicit permission keys and scope, never a human's full access; usable on every endpoint and MCP tool of this module; audit actor `SERVICE_ACCOUNT` |
| Webhooks and automation | Events, triggers and actions registered with [20](./20-automation-engine.md); automation runs as a service account or membership with the same checks |

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 43 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `organizations.access_reviews` | read*, manage*, decide* |
| `organizations.api_keys` | manage* |
| `organizations.audit` | read* |
| `organizations.billing` | manage* |
| `organizations.branches` | read, manage* |
| `organizations.branches.members` | manage |
| `organizations.branches.settings` | manage |
| `organizations.branding` | manage |
| `organizations.domains` | manage* |
| `organizations.integrations` | read, manage* |
| `organizations.mcp_calls` | read* |
| `organizations.modules` | manage* |
| `organizations.organization` | delete* |
| `organizations.retention` | manage* |
| `organizations.security` | manage* |
| `organizations.service_accounts` | manage* |
| `organizations.settings` | manage* |
| `organizations.sso` | manage* |
| `organizations.teams` | read, manage |
| `organizations.teams.members` | manage |
| `platform.custom_fields` | manage* |
| `platform.saved_views` | manage_shared |
| `platform.tags` | manage |
| `users.delegations` | manage |
| `users.external_collaborators` | manage* |
| `users.members` | read, invite, manage*, offboard*, transfer_ownership* |
| `users.permissions` | read, grant*, simulate |
| `users.roles` | read, manage*, assign* |
| `users.sessions` | read*, revoke* |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Purpose

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

This module defines the identity, organization, membership, branch, team, role, permission, access-control, and workspace structure for the Agency Operating System.

It is the foundational access and tenancy layer used by CRM, Projects, Tasks, Support, Finance, Contracts, Offers, Messaging, Documents, Calendar, Employees, Customer Portal, and other modules.

The module must support both:

* Independent organizations representing completely separate companies.
* Branches representing offices, locations, or operational units belonging to the same organization.

Example:

**Deloitte**

* Deloitte Greece
* Deloitte UK
* Deloitte Germany
* Deloitte France
* Deloitte USA

These are branches / organizational units of the same top-level organization when configured that way, rather than separate platform organizations.

At the same time, completely unrelated companies such as Deloitte, Acme Software, and Northwind must be isolated as separate Organizations.

---

# 2. Core Concepts

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The system should clearly distinguish the following entities:

### User

A person with a platform identity and login credentials.

### Organization

A completely separate company / tenant inside the platform.

### Branch

A physical office, geographic office, subsidiary unit, or operational location belonging to an Organization.

### Membership

The relationship between a User and an Organization.

### Organization Role

A reusable collection of permissions assigned to a Member.

### Team

A group of Members used for operational collaboration.

### Permission

A granular authorization allowing or denying an action on a resource.

### Scope

The organizational boundary within which a permission applies.

### Organization Owner / Admin

Privileged Members responsible for organization administration.

### Service / Module Access

Whether a Member can access a particular product such as CRM, Projects, Finance, Support, or Contracts.

These concepts must remain separate. A user's global identity must not be confused with their membership in a specific organization or branch.

---

# 3. Multi-Tenant Architecture

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Organizations are the primary tenancy boundary.

Data belonging to Organization A must not be visible to Organization B unless an explicitly supported cross-organization relationship exists.

Example:

**Organization A — Acme**

* Users
* Customers
* Projects
* Finance
* Contracts
* Employees

must be isolated from:

**Organization B — Northwind**

* Users
* Customers
* Projects
* Finance
* Contracts
* Employees

A User may belong to both organizations without causing their data to become shared automatically.

---

# 4. User Identity

<!-- schema-section:start -->
> **Schema:** `User` ([users](../../api/prisma/schema.prisma#L344)) — other modules: `CrmContact` ([crm_contacts](../../api/prisma/schema.prisma#L2919)) ([02](./02-crm-sales-management.md))
<!-- schema-section:end -->

A User represents a human platform identity.

Core information may include:

* User ID
* First name
* Last name
* Display name
* Email
* Phone
* Profile photo
* Locale
* Time zone
* Language
* Authentication methods
* Account status
* Last login
* Created date

Identity information should be centralized and reused by every module.

CRM contacts, employee records, customer contacts, and external stakeholders must not automatically become Users merely because they have an email address.

---

# 5. User Account States

<!-- schema-section:start -->
> **Schema:** enum `UserStatus` ([L55](../../api/prisma/schema.prisma#L55))
<!-- schema-section:end -->

Support states such as:

* Invited
* Active
* Suspended
* Deactivated
* Locked
* Pending verification

Deactivation must preserve historical activity, ownership references, comments, approvals, tasks, projects, and audit records.

---

# 6. Authentication

<!-- schema-section:start -->
> **Schema:** `UserAuthMethod` ([user_auth_methods](../../api/prisma/schema.prisma#L420)) · enum `AuthMethodType` ([L65](../../api/prisma/schema.prisma#L65))
<!-- schema-section:end -->

The platform should support configurable authentication methods:

* Email/password
* Magic link
* Passkeys
* OAuth / social login where supported
* SSO
* SAML
* OIDC
* MFA

Authentication is separate from authorization.

A successful login does not imply access to every organization or module.

---

# 7. Global User vs Organization Membership

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

A User is global.

Membership is organization-specific.

Example:

**Petros — User**

Memberships:

* Organization A → Owner
* Organization B → Member
* Organization C → External collaborator

Each membership can have completely different permissions, roles, teams, branches, and module access.

---

# 8. Organization

<!-- schema-section:start -->
> **Schema:** `Organization` ([organizations](../../api/prisma/schema.prisma#L516)) — other modules: `CrmCompany` ([crm_companies](../../api/prisma/schema.prisma#L2794)) ([02](./02-crm-sales-management.md))
<!-- schema-section:end -->

An Organization represents an entire company / tenant.

Core fields:

* Organization ID
* Legal / registered name
* Display name
* Short name
* Logo
* Country
* Default currency
* Default timezone
* Default language
* Website
* Contact information
* Tax / registration identifiers where applicable
* Organization status
* Created date

An Organization owns its platform data.

---

# 9. Organization Isolation

<!-- schema-section:start -->
> **Schema:** `Organization` ([organizations](../../api/prisma/schema.prisma#L516))
<!-- schema-section:end -->

Every major platform resource should belong to exactly one Organization unless explicitly designed as a global system resource.

Examples:

* Projects
* Tasks
* Customers
* Contracts
* Offers
* Invoices
* Support tickets
* Documents
* Messages
* Employees
* Branches

must have an organization context.

---

# 10. Organization Lifecycle

<!-- schema-section:start -->
> **Schema:** enum `OrganizationStatus` ([L78](../../api/prisma/schema.prisma#L78))
<!-- schema-section:end -->

Organizations may have states such as:

* Setup
* Active
* Suspended
* Read-only
* Archived
* Deleted / scheduled for deletion

Suspended organizations should prevent normal operations while preserving authorized administrative access.

---

# 11. Organization Creation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

An organization may be created by:

* New account signup
* Existing user
* Organization invitation
* Platform administrator
* Enterprise onboarding
* API

Creation should establish the initial Owner membership.

### Module default provisioning

Organization creation is the single place where per-organization module defaults are created. Each module declares a `provisionDefaults(organizationId)` step that the organization-creation service runs inside the same transaction, in build order, after the Owner membership exists. Defaults are owned copies per organization, never shared platform rows, so an organization can change them without affecting others.

Provisioned by this module: the Owner's membership and role assignment, organization module access (§56) for every module enabled by the plan, the security policy (§73) with platform defaults, and the organization's clones of the role templates (§111).

Provisioned by other modules through the same hook:

* 02 CRM → default pipeline and stages, lead statuses, lifecycle stages, lead sources (02 §37).
* 05 Projects → default project types, statuses and health states.
* 06 Tasks → default task statuses and workflow.
* 13 Support → default ticket statuses, priorities and SLA policy.
* 14 Notifications → organization notification defaults.
* 17 Documents → default folder structure and retention policy.

The hook is also re-runnable for an existing organization when a module is enabled later (§56), and must be idempotent: it never duplicates defaults that already exist. Organization templates (§149) select which defaults are provisioned.

---

# 12. Organization Owner

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The Organization Owner is the highest standard administrative role.

Capabilities may include:

* Organization settings
* Billing administration
* Member management
* Branch management
* Role management
* Permission management
* Security settings
* Data governance
* Integrations
* Organization deletion / transfer

Organizations may support multiple Owners if desired.

---

# 13. Organization Administrators

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Admins can perform selected administrative actions without necessarily becoming Owners.

Organizations should support specialized administrative roles such as:

* User Administrator
* Security Administrator
* Finance Administrator
* Branch Administrator
* Integration Administrator
* Audit Administrator

These roles should be permission-based rather than hardcoded wherever possible.

---

# 14. Organization Profile

<!-- schema-section:start -->
> **Schema:** other modules: `LedgerSettings` ([ledger_settings](../../api/prisma/schema.prisma#L8560)): `reporting_currency` ([09](./09-income-expense-management.md)) · `SlaPolicy` ([sla_policies](../../api/prisma/schema.prisma#L14964)): `use_business_hours` ([13](./13-customer-support-communication-hub.md)) · `TimeTrackingSettings` ([time_tracking_settings](../../api/prisma/schema.prisma#L19158)): `week_start` ([18](./18-time-tracking.md))
<!-- schema-section:end -->

Organization settings should contain:

* Identity
* Branding
* Contact information
* Localization
* Currency
* Time zone
* Number formats
* Date formats
* Working days
* Business hours
* Default settings
* Security settings
* Notification defaults

---

# 15. Organization Branding

<!-- schema-section:start -->
> **Schema:** `Organization` ([organizations](../../api/prisma/schema.prisma#L516)): `branding` · enum `DocumentType` ([L322](../../api/prisma/schema.prisma#L322)) — other modules: `BookingLink` ([booking_links](../../api/prisma/schema.prisma#L20522)): `branding` ([19](./19-calendar.md)) · `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L11988)): `branding_snapshot` ([11](./11-communication-center.md)) · `CommTemplate` ([comm_templates](../../api/prisma/schema.prisma#L11838)) ([11](./11-communication-center.md)) · `CustomerPortalSettings` ([customer_portal_settings](../../api/prisma/schema.prisma#L7073)): `branding` ([07](./07-customer-portal.md)) · `Invoice` ([invoices](../../api/prisma/schema.prisma#L7550)): `template_id` ([08](./08-financial-management-stripe-integration.md)) · `InvoiceTemplate` ([invoice_templates](../../api/prisma/schema.prisma#L7523)) ([08](./08-financial-management-stripe-integration.md)) · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L13123)) ([12](./12-messaging-team-communication.md)) · `NotificationTemplate` ([notification_templates](../../api/prisma/schema.prisma#L16109)) ([14](./14-notifications-activity-center.md)) · `ProposalTemplate` ([proposal_templates](../../api/prisma/schema.prisma#L3831)): `branding` ([03](./03-proposal-quotation-generator.md))
<!-- schema-section:end -->

Organizations can configure:

* Logo
* Name
* Favicon
* Primary branding
* Email branding
* Customer Portal branding
* Document branding
* Contract branding

Modules consume organization branding rather than implementing separate branding systems.

---

# 16. Branches

<!-- schema-section:start -->
> **Schema:** enum `BranchKind` ([L98](../../api/prisma/schema.prisma#L98)) — other modules: `CrmCompany` ([crm_companies](../../api/prisma/schema.prisma#L2794)) ([02](./02-crm-sales-management.md))
<!-- schema-section:end -->

Branches are organizational units inside an Organization.

A Branch can represent:

* Country office
* City office
* Regional office
* Departmental office
* Legal subsidiary when modeled as a branch
* Operational location
* Remote office
* Service center

The important distinction is:

**Organization = separate company / tenant**

**Branch = organizational unit inside that company**

---

# 17. Branch Hierarchy

<!-- schema-section:start -->
> **Schema:** `Branch` ([branches](../../api/prisma/schema.prisma#L1087)): `path`
<!-- schema-section:end -->

Branches may optionally support hierarchy.

Example:

**Deloitte**

→ Europe

→ Greece

→ Athens

→ Thessaloniki

or:

**Deloitte**

→ Greece

→ Athens

→ Thessaloniki

The hierarchy depth should be configurable.

---

# 18. Branch Data Model

<!-- schema-section:start -->
> **Schema:** `Branch` ([branches](../../api/prisma/schema.prisma#L1087))
<!-- schema-section:end -->

A Branch may contain:

* Branch ID
* Organization ID
* Parent Branch
* Name
* Code
* Country
* Region
* City
* Address
* Time zone
* Phone
* Email
* Manager
* Status
* Cost center reference
* Currency reference
* Custom fields

A Branch cannot belong to two Organizations simultaneously.

---

# 19. Branch Status

<!-- schema-section:start -->
> **Schema:** enum `BranchStatus` ([L89](../../api/prisma/schema.prisma#L89))
<!-- schema-section:end -->

Example states:

* Active
* Planned
* Temporarily closed
* Suspended
* Archived

Archiving a branch must not delete its historical records.

---

# 20. Branch Manager

<!-- schema-section:start -->
> **Schema:** `BranchManager` ([branch_managers](../../api/prisma/schema.prisma#L1178))
<!-- schema-section:end -->

A Branch can have one or more responsible Members.

Examples:

* Branch Manager
* Regional Director
* Office Administrator

Branch management permissions should be assignable independently of global organization administration.

---

# 21. User Branch Membership

<!-- schema-section:start -->
> **Schema:** `MembershipBranch` ([membership_branches](../../api/prisma/schema.prisma#L1570))
<!-- schema-section:end -->

A Member can belong to:

* One branch
* Multiple branches
* A parent branch
* An entire organization

Example:

A regional manager may have access to:

* Athens
* Thessaloniki
* Heraklion

while a local employee only has access to Heraklion.

---

# 22. Branch Scope

<!-- schema-section:start -->
> **Schema:** enum `ScopeType` ([L147](../../api/prisma/schema.prisma#L147))
<!-- schema-section:end -->

Permissions can be scoped to:

* Organization-wide
* Branch
* Branch hierarchy
* Team
* Specific resource

This is critical for enterprise organizations.

---

# 23. Branch Access Examples

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

### Local employee

Can access:

* Heraklion branch
* Heraklion projects
* Heraklion customers

### Regional manager

Can access:

* All branches in Greece
* Regional projects
* Regional teams

### Global executive

Can access:

* All organization branches
* Organization-wide reporting

### External consultant

Can access:

* Specific organization
* Specific branch
* Specific projects

---

# 24. Membership

<!-- schema-section:start -->
> **Schema:** `Membership` ([memberships](../../api/prisma/schema.prisma#L1314)) · enum `MembershipStatus` ([L115](../../api/prisma/schema.prisma#L115)) · enum `MembershipType` ([L108](../../api/prisma/schema.prisma#L108))
<!-- schema-section:end -->

Membership is the authorization relationship between User and Organization.

A membership contains:

* User
* Organization
* Status
* Roles
* Branches
* Teams
* Module access
* Permission overrides
* Joined date
* Invited by
* Last active date

---

# 25. Multiple Organization Memberships

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Users should be able to belong to multiple Organizations.

Example:

User:

**John Smith**

Membership 1:

**Acme Software** → Admin

Membership 2:

**Partner Agency** → Member

Membership 3:

**Customer Company** → External collaborator

Switching organizations must change the active data scope.

---

# 26. Organization Switcher

<!-- schema-section:start -->
> **Schema:** `UserSession` ([user_sessions](../../api/prisma/schema.prisma#L445)): `active_organization_id`
<!-- schema-section:end -->

The global application should provide an organization switcher.

It should display:

* Organization logo
* Organization name
* User role
* Branch context where relevant

Switching organizations should never merge the navigation state or data context accidentally.

---

# 27. Active Branch Context

<!-- schema-section:start -->
> **Schema:** `UserSession` ([user_sessions](../../api/prisma/schema.prisma#L445)): `active_branch_id`, `active_branch_ids`
<!-- schema-section:end -->

Users with multiple branch memberships should be able to select their active branch context.

Options may include:

* Current branch
* Multiple selected branches
* Entire organization

The selected scope affects list views, reporting, dashboards, and resource visibility where applicable.

---

# 28. Global vs Branch Resources

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Resources should define whether they are:

* Organization-wide
* Branch-specific
* Shared across branches

Examples:

A global CRM customer may be organization-wide.

A branch-specific employee may belong to Athens.

A project may be assigned to Athens while being visible to the regional management team.

---

# 29. Branch-Aware Modules

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Modules should be able to consume branch context without each implementing their own branch system.

Relevant modules include:

* CRM
* Projects
* Tasks
* Support
* Finance
* Employees
* Contracts
* Offers
* Documents
* Calendar
* Messaging
* Customer Portal

The identity/access layer provides the branch scope.

---

# 30. Branch Assignment Rules

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Resources can have:

* Primary branch
* Additional branches
* Organization-wide visibility

Examples:

Employee → Primary branch Athens

Project → Primary branch Athens

Customer → Organization-wide

Contract → Organization-wide or linked to relevant branch

---

# 31. Organization-Wide vs Branch-Level Customers

<!-- schema-section:start -->
> **Schema:** other modules: `CrmCompanyBranch` ([crm_company_branches](../../api/prisma/schema.prisma#L2902)) ([02](./02-crm-sales-management.md)) · enum `CrmBranchRelationType` ([L2642](../../api/prisma/schema.prisma#L2642)) ([02](./02-crm-sales-management.md))
<!-- schema-section:end -->

The CRM should support both:

### Organization customer

A customer relationship managed centrally across the company.

### Branch customer

A customer primarily associated with a particular branch.

The customer should not be duplicated simply because multiple branches interact with it.

Example:

Acme Corporation may be a single CRM company for Deloitte while having relationships with:

* Deloitte Greece
* Deloitte UK
* Deloitte Germany

Branch relationships should be represented as relationships / ownership rather than duplicate customer records.

---

# 32. Branch-Level Projects

<!-- schema-section:start -->
> **Schema:** other modules: `Project` ([projects](../../api/prisma/schema.prisma#L5696)): `branch_id` ([05](./05-project-management.md)) · `ProjectBranch` ([project_branches](../../api/prisma/schema.prisma#L5838)) ([05](./05-project-management.md))
<!-- schema-section:end -->

Projects can be:

* Organization-wide
* Branch-specific
* Multi-branch

A project can have a primary branch and additional participating branches.

---

# 33. Cross-Branch Projects

<!-- schema-section:start -->
> **Schema:** other modules: `ProjectBranch` ([project_branches](../../api/prisma/schema.prisma#L5838)) ([05](./05-project-management.md))
<!-- schema-section:end -->

Projects involving multiple branches should support:

* Primary branch
* Participating branches
* Cross-branch teams
* Cross-branch permissions
* Cross-branch reporting

Example:

A global customer implementation may involve:

* Greece engineering
* UK account management
* Germany support

---

# 34. Branch-Level Finance

<!-- schema-section:start -->
> **Schema:** `Branch` ([branches](../../api/prisma/schema.prisma#L1087)): `cost_center_code` · `IntegrationConnection` ([integration_connections](../../api/prisma/schema.prisma#L1865)): `branch_id` — other modules: `FinanceApprovalRule` ([finance_approval_rules](../../api/prisma/schema.prisma#L8267)): `branch_id` ([08](./08-financial-management-stripe-integration.md)) · `LedgerRecord` ([ledger_records](../../api/prisma/schema.prisma#L8717)): `branch_id` ([09](./09-income-expense-management.md)) · `PaymentProviderConnection` ([payment_provider_connections](../../api/prisma/schema.prisma#L7983)): `branch_id` ([08](./08-financial-management-stripe-integration.md)) · `ScheduledJob` ([scheduled_jobs](../../api/prisma/schema.prisma#L21765)): `branch_id` ([20](./20-automation-engine.md))
<!-- schema-section:end -->

Finance can consume branch context for:

* Revenue reporting
* Expense reporting
* Cost centers
* Budgets
* Profitability

Finance remains responsible for financial records and calculations.

The identity layer only provides organizational/branch context.

---

# 35. Branch-Level Employees

<!-- schema-section:start -->
> **Schema:** other modules: `Employee` ([employees](../../api/prisma/schema.prisma#L10017)) ([10](./10-employee-management-system.md))
<!-- schema-section:end -->

Employees may have:

* Primary branch
* Secondary branches
* Department
* Team
* Manager

Employee Management owns employee-specific data.

This module owns the access relationship to branches.

---

# 36. Branch-Level Contracts

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Contracts may optionally be associated with:

* Organization
* Branch
* Multiple branches

Example:

A global MSA may be organization-wide while a local SOW is associated with the Greece branch.

---

# 37. Branch-Level Offers

<!-- schema-section:start -->
> **Schema:** other modules: `CrmCompanyBranch` ([crm_company_branches](../../api/prisma/schema.prisma#L2902)) ([02](./02-crm-sales-management.md))
<!-- schema-section:end -->

Offers can optionally identify the branch responsible for the commercial relationship.

This allows:

* Branch sales ownership
* Branch revenue attribution
* Regional reporting

without duplicating the customer.

---

# 38. Branch-Level Support

<!-- schema-section:start -->
> **Schema:** other modules: `SupportInbox` ([support_inboxes](../../api/prisma/schema.prisma#L14633)) ([13](./13-customer-support-communication-hub.md))
<!-- schema-section:end -->

Support tickets may include:

* Organization
* Customer
* Branch
* Assigned team

This allows local support queues while retaining centralized customer context.

---

# 39. Branch-Level Documents

<!-- schema-section:start -->
> **Schema:** other modules: enum `DocumentScope` ([L17809](../../api/prisma/schema.prisma#L17809)) ([17](./17-documents-file-management.md))
<!-- schema-section:end -->

Documents may have:

* Organization scope
* Branch scope
* Project scope
* Restricted access

Access is controlled by the permissions layer.

---

# 40. Teams

<!-- schema-section:start -->
> **Schema:** `Team` ([teams](../../api/prisma/schema.prisma#L1213))
<!-- schema-section:end -->

Teams are collaborative groups of Members.

Teams are not equivalent to Branches.

A team may be:

* Local to a branch
* Organization-wide
* Cross-branch
* Temporary project team

Examples:

* Athens Development
* Greece Sales
* Global Support
* AI Automation Team

---

# 41. Team Hierarchy

<!-- schema-section:start -->
> **Schema:** enum `TeamKind` ([L123](../../api/prisma/schema.prisma#L123))
<!-- schema-section:end -->

Teams may optionally support:

* Parent team
* Subteam
* Department
* Business unit

Example:

Engineering

→ Backend

→ Frontend

→ DevOps

Teams should remain independent from physical Branch hierarchy.

---

# 42. Team Membership

<!-- schema-section:start -->
> **Schema:** `TeamMembership` ([team_memberships](../../api/prisma/schema.prisma#L1286)): `is_lead` — other modules: `SupportInbox` ([support_inboxes](../../api/prisma/schema.prisma#L14633)) ([13](./13-customer-support-communication-hub.md))
<!-- schema-section:end -->

Members can belong to multiple teams.

A team membership may include:

* Team role
* Start date
* End date
* Primary team flag

---

# 43. Departments

<!-- schema-section:start -->
> **Schema:** enum `TeamKind` ([L123](../../api/prisma/schema.prisma#L123)) — other modules: `Employee` ([employees](../../api/prisma/schema.prisma#L10017)): `department_team_id` ([10](./10-employee-management-system.md)) · `EmployeePosition` ([employee_positions](../../api/prisma/schema.prisma#L10166)): `department_team_id` ([10](./10-employee-management-system.md)) · `FormAssignment` ([form_assignments](../../api/prisma/schema.prisma#L17424)): `target_id` ([15](./15-notion-business-docs.md)) · `LedgerRecord` ([ledger_records](../../api/prisma/schema.prisma#L8717)): `department_id` ([09](./09-income-expense-management.md)) · `PayrollEntry` ([payroll_entries](../../api/prisma/schema.prisma#L9128)): `department_id` ([09](./09-income-expense-management.md)) · `PayrollSchedule` ([payroll_schedules](../../api/prisma/schema.prisma#L9081)): `department_id` ([09](./09-income-expense-management.md)) · `RecurringExpense` ([recurring_expenses](../../api/prisma/schema.prisma#L9006)): `department_id` ([09](./09-income-expense-management.md)) · `WikiChecklist` ([wiki_checklists](../../api/prisma/schema.prisma#L17228)): `department_id` ([15](./15-notion-business-docs.md)) · `WikiPagePermission` ([wiki_page_permissions](../../api/prisma/schema.prisma#L17101)) ([15](./15-notion-business-docs.md)) · `WikiSpace` ([wiki_spaces](../../api/prisma/schema.prisma#L16835)): `department_id` ([15](./15-notion-business-docs.md)) · enum `WikiPrincipalType` ([L16635](../../api/prisma/schema.prisma#L16635)) ([15](./15-notion-business-docs.md))
<!-- schema-section:end -->

Organizations may define departments such as:

* Sales
* Engineering
* Design
* Finance
* HR
* Support
* Customer Success
* Management

Departments may be represented through teams or organizational units according to organization configuration.

---

# 44. Roles

<!-- schema-section:start -->
> **Schema:** `Role` ([roles](../../api/prisma/schema.prisma#L1633)) · `RolePermission` ([role_permissions](../../api/prisma/schema.prisma#L1676))
<!-- schema-section:end -->

Roles are reusable authorization bundles.

Examples:

* Owner
* Organization Admin
* Branch Admin
* Manager
* Employee
* Finance Manager
* Sales Manager
* Project Manager
* Support Agent
* Developer
* Customer Success
* External Collaborator
* Viewer

Roles should not be hardcoded to one module.

---

# 45. Role Types

<!-- schema-section:start -->
> **Schema:** `Role` ([roles](../../api/prisma/schema.prisma#L1633)) · enum `RoleType` ([L131](../../api/prisma/schema.prisma#L131)) — other modules: `ProjectMember` ([project_members](../../api/prisma/schema.prisma#L5852)) ([05](./05-project-management.md))
<!-- schema-section:end -->

Support:

### System roles

Reserved platform roles such as Owner.

### Organization roles

Defined by the organization.

### Branch roles

Roles scoped to a branch.

### Team roles

Roles scoped to a team.

### Project roles

Operational roles used by Projects.

These authorization concepts must remain interoperable.

---

# 46. Permissions

<!-- schema-section:start -->
> **Schema:** `Permission` ([permissions](../../api/prisma/schema.prisma#L1611))
<!-- schema-section:end -->

Permissions represent individual capabilities.

Examples:

* `crm.companies.read`
* `crm.companies.create`
* `crm.companies.update`
* `crm.companies.delete`
* `projects.projects.read`
* `projects.projects.update`
* `projects.members.manage`
* `contracts.contracts.read`
* `contracts.contracts.approve`
* `finance.invoices.read`
* `finance.invoices.create`
* `users.members.manage`
* `organizations.settings.manage`

Permission naming should be standardized across modules.

---

# 47. Permission Actions

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Standard actions should include:

* Read
* Create
* Update
* Delete
* Archive
* Restore
* Approve
* Export
* Share
* Manage
* Execute

Modules may define additional domain-specific actions.

---

# 48. Permission Resources

<!-- schema-section:start -->
> **Schema:** `RolePermission` ([role_permissions](../../api/prisma/schema.prisma#L1676)): `conditions`
<!-- schema-section:end -->

Permissions may target:

* Module
* Resource type
* Specific resource
* Field
* Action

Example:

A user may be allowed to read Projects but not read project financial information.

---

# 49. Resource-Level Permissions

<!-- schema-section:start -->
> **Schema:** `PermissionGrant` ([permission_grants](../../api/prisma/schema.prisma#L1722))
<!-- schema-section:end -->

Support granular permissions for sensitive records.

Example:

User can access:

* Project A
* Project B

but not:

* Project C

This should be supported through explicit resource sharing or membership.

---

# 50. Permission Scopes

<!-- schema-section:start -->
> **Schema:** enum `ScopeType` ([L147](../../api/prisma/schema.prisma#L147))
<!-- schema-section:end -->

Every permission can optionally have a scope:

* Organization
* Branch
* Branch hierarchy
* Team
* Project
* Resource

Example:

`finance.expenses.read` → Branch: Athens

while:

`finance.reports.read` → Organization: Deloitte

---

# 51. Role + Scope Model

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The authorization model should conceptually evaluate:

**User → Membership → Role → Permission → Scope → Resource**

Example:

John

→ Deloitte Membership

→ Branch Manager

→ `projects.projects.update`

→ Greece Branch

→ Project X

Access is allowed only if all relevant conditions are satisfied.

---

# 52. Permission Inheritance

<!-- schema-section:start -->
> **Schema:** `Branch` ([branches](../../api/prisma/schema.prisma#L1087)): `path`
<!-- schema-section:end -->

Support inheritance where appropriate.

Example:

Organization-wide permission

→ inherited by branches

Branch-level permission

→ inherited by child branches

Team permission

→ inherited by team members

Inheritance must be explicit and visible to administrators.

---

# 53. Permission Deny Rules

<!-- schema-section:start -->
> **Schema:** `PermissionGrant` ([permission_grants](../../api/prisma/schema.prisma#L1722)) · `RolePermission` ([role_permissions](../../api/prisma/schema.prisma#L1676)) · enum `PermissionEffect` ([L158](../../api/prisma/schema.prisma#L158))
<!-- schema-section:end -->

The system should support explicit deny rules when required.

Deny should be evaluated safely and predictably against inherited access.

Administrators must be able to understand why access was denied.

---

# 54. Permission Evaluation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The authorization engine should evaluate:

 1. User authentication
 2. Active organization
 3. Membership status
 4. Organization status
 5. Roles
 6. Permissions
 7. Scope
 8. Resource ownership
 9. Explicit grants
10. Explicit denies

The result should be deterministic.

---

# 55. Permission Explanation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Administrators should be able to inspect why a user has access.

Example:

> John can edit Project #123 because he is a Project Manager in the Athens branch and Project #123 belongs to Athens.

This is particularly important for enterprise organizations.

---

# 56. Module Access

<!-- schema-section:start -->
> **Schema:** `MembershipModuleAccess` ([membership_module_access](../../api/prisma/schema.prisma#L1589)) · `OrganizationEntitlement` ([organization_entitlements](../../api/prisma/schema.prisma#L1038)) · `OrganizationModule` ([organization_modules](../../api/prisma/schema.prisma#L1018)) · enum `EntitlementEnforcement` ([L1070](../../api/prisma/schema.prisma#L1070)) · enum `EntitlementPeriod` ([L1064](../../api/prisma/schema.prisma#L1064)) · enum `EntitlementSource` ([L1076](../../api/prisma/schema.prisma#L1076)) · enum `ModuleKey` ([L164](../../api/prisma/schema.prisma#L164))
<!-- schema-section:end -->

Organizations should be able to enable or disable access to platform products.

Example:

* CRM
* Projects
* Tasks
* Support
* Finance
* Contracts
* Offers
* Employees
* Documents
* Messaging
* Calendar

A Member may have access to Projects but not Finance.

---

# 57. Product-Level Access

<!-- schema-section:start -->
> **Schema:** `MembershipModuleAccess` ([membership_module_access](../../api/prisma/schema.prisma#L1589))
<!-- schema-section:end -->

Product access should be evaluated before feature permissions.

Example:

User has:

**Projects = Enabled**

but:

**Finance = Disabled**

Finance permissions therefore have no practical effect until Finance access is enabled.

---

# 58. Feature Permissions

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Within a product, access can be granular.

Example:

Finance:

* View invoices
* Create invoices
* Edit invoices
* Approve invoices
* Export financial reports

Projects:

* View projects
* Create projects
* Edit projects
* Manage members
* Manage budgets
* Archive projects

---

# 59. Sensitive Permissions

<!-- schema-section:start -->
> **Schema:** `Permission` ([permissions](../../api/prisma/schema.prisma#L1611)): `is_sensitive`
<!-- schema-section:end -->

Certain permissions should require elevated roles.

Examples:

* Export customer data
* View financial data
* View employee compensation
* Delete organization data
* Manage authentication
* Manage permissions
* Approve contracts
* Change billing

---

# 60. Field-Level Permissions

<!-- schema-section:start -->
> **Schema:** `Permission` ([permissions](../../api/prisma/schema.prisma#L1611)): `is_field_level` · `RolePermission` ([role_permissions](../../api/prisma/schema.prisma#L1676)): `conditions` — other modules: `BillingRate` ([billing_rates](../../api/prisma/schema.prisma#L19296)) ([18](./18-time-tracking.md)) · `Employee` ([employees](../../api/prisma/schema.prisma#L10017)): `national_id_number` ([10](./10-employee-management-system.md)) · `EmployeeCompensation` ([employee_compensations](../../api/prisma/schema.prisma#L10200)) ([10](./10-employee-management-system.md)) · `EmployeeDocument` ([employee_documents](../../api/prisma/schema.prisma#L11120)): `is_confidential` ([10](./10-employee-management-system.md)) · `EmployeeHrNote` ([employee_hr_notes](../../api/prisma/schema.prisma#L11165)) ([10](./10-employee-management-system.md))
<!-- schema-section:end -->

Sensitive fields may require additional permissions.

Examples:

* Employee salary
* Bank account information
* Contract value
* Customer financial information
* Internal notes

A user may be able to access the record without seeing sensitive fields.

---

# 61. Delegated Administration

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Organization Owners can delegate administrative responsibilities.

Example:

* HR Admin manages Employees.
* Finance Admin manages Finance.
* IT Admin manages Users.
* Branch Admin manages Athens membership.

Delegated administrators should not automatically gain unrelated permissions.

---

# 62. Branch Administrator

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

A Branch Admin may manage:

* Branch members
* Branch teams
* Branch settings
* Branch projects
* Branch operational resources

They should not automatically manage the entire organization.

---

# 63. Organization Administrator

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Organization Admin can manage organization-wide configuration according to assigned permissions.

Examples:

* Members
* Roles
* Teams
* Branches
* Module access
* Security
* Integrations

The Admin role template holds every permission except `organizations.billing.manage`, `organizations.organization.delete` and `users.members.transfer_ownership`, which stay Owner-only.

## Privilege escalation rules

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Holding `users.roles.manage`, `users.roles.assign` or `users.permissions.grant` must never let someone obtain more power than they already have. The central authorization service (§136) enforces these rules for every access channel (UI, REST API, MCP tools, API keys, service accounts, automation), not the individual modules:

1. **No granting beyond what you hold.** A caller can only put a permission into a role, assign a role, or grant a permission to a person if the caller holds that permission themselves, in at least the same scope (organization, branch, team, resource). A role may be assigned only if every permission in it passes this check. Rejections return a clear error naming the permissions the caller lacks.
2. **No self-modification.** A caller cannot change a role they currently hold, assign roles or grant permissions to their own membership, or lift their own explicit deny. Another authorized member must do it.
3. **Owner-only actions.** Assigning or removing the `owner` role, transferring ownership (§132), deleting the organization, and managing billing are Owner-only. No role, grant or delegation can pass these on to anyone else. The only exception is the ownership transfer flow, which promotes another member and demotes the current Owner. An organization always keeps at least one Owner.
4. **System templates are read-only.** Role templates with `is_system = true` and `organization_id = null` cannot be edited or deleted by organization users. Organizations clone a template and edit the clone, and rule 1 applies to the clone.
5. **Delegations and temporary access cannot widen power.** A delegation (§94) can pass on only permissions the delegator holds and cannot pass on Owner-only actions. A delegated or temporary grant is never used as the basis for granting further permissions.
6. **Non-human identities.** API keys and service accounts can never hold `users.roles.*`, `users.permissions.grant` or `users.members.transfer_ownership`, and an API key's `scopes` can only narrow its owner's permissions.
7. **Audit.** Every role edit, assignment, grant and rejected escalation attempt writes an audit event with actor, target and the permissions involved.

---

# 64. Super Admin / Platform Admin

<!-- schema-section:start -->
> **Schema:** enum `AuthRole` ([L47](../../api/prisma/schema.prisma#L47))
<!-- schema-section:end -->

Platform administrators are separate from organization administrators.

Platform admins operate the SaaS platform itself and should not be treated as ordinary organization members.

Platform-level access must be heavily audited.

---

# 65. Invitations

<!-- schema-section:start -->
> **Schema:** `Invitation` ([invitations](../../api/prisma/schema.prisma#L1947)): `valid_until` · enum `InvitationAudience` ([L249](../../api/prisma/schema.prisma#L249)) · enum `ProvisioningSource` ([L196](../../api/prisma/schema.prisma#L196))
<!-- schema-section:end -->

Organizations can invite users by:

* Email
* Invitation link
* Bulk import
* SSO provisioning
* API

Invitation configuration may specify:

* Organization
* Branch
* Team
* Role
* Module access
* Expiration

> **Schema note:** an `Invitation` carries its own `scope_type` / `scope_id` / `valid_until` (an external collaborator is invited to one PROJECT or RESOURCE until a date), copied into the `RoleAssignment` on acceptance; `last_sent_at` and `send_count` track reminders (§66).

---

# 66. Invitation Lifecycle

<!-- schema-section:start -->
> **Schema:** `Invitation` ([invitations](../../api/prisma/schema.prisma#L1947)): `last_sent_at` · enum `InvitationStatus` ([L187](../../api/prisma/schema.prisma#L187))
<!-- schema-section:end -->

States:

* Pending
* Accepted
* Expired
* Cancelled
* Rejected

Invitation history should be preserved.

---

# 67. Bulk User Provisioning

<!-- schema-section:start -->
> **Schema:** `SsoConfiguration` ([sso_configurations](../../api/prisma/schema.prisma#L2004)): `scim_enabled` · enum `ProvisioningSource` ([L196](../../api/prisma/schema.prisma#L196))
<!-- schema-section:end -->

Enterprise organizations should support bulk provisioning.

Methods may include:

* CSV import
* SCIM
* SSO provisioning
* API

Provisioned users should receive appropriate organization membership and branch assignment.

---

# 68. SCIM

<!-- schema-section:start -->
> **Schema:** `Membership` ([memberships](../../api/prisma/schema.prisma#L1314)): `external_id` · `SsoConfiguration` ([sso_configurations](../../api/prisma/schema.prisma#L2004)): `scim_enabled`
<!-- schema-section:end -->

Enterprise identity management should support SCIM where available.

Operations may include:

* Create user
* Update user
* Deactivate user
* Assign group
* Remove group

SCIM synchronization must not bypass platform authorization rules.

---

# 69. SSO

<!-- schema-section:start -->
> **Schema:** `SsoConfiguration` ([sso_configurations](../../api/prisma/schema.prisma#L2004)) · enum `SsoProtocol` ([L206](../../api/prisma/schema.prisma#L206))
<!-- schema-section:end -->

Organizations may configure SSO.

Supported concepts:

* Identity provider
* Domain verification
* SAML/OIDC configuration
* Automatic provisioning
* Group mapping
* Role mapping
* Branch mapping

---

# 70. Domain Verification

<!-- schema-section:start -->
> **Schema:** `OrganizationDomain` ([organization_domains](../../api/prisma/schema.prisma#L918)): `allow_discovery` · enum `DomainVerificationStatus` ([L212](../../api/prisma/schema.prisma#L212)) — other modules: `CommSenderDomain` ([comm_sender_domains](../../api/prisma/schema.prisma#L11745)) ([11](./11-communication-center.md))
<!-- schema-section:end -->

Organizations may verify corporate email domains.

Example:

deloitte.com

Domain verification can support:

* SSO setup
* User provisioning
* Invitation controls
* Organization discovery

Domain ownership does not automatically grant organization membership.

---

# 71. Group Mapping

<!-- schema-section:start -->
> **Schema:** `SsoGroupMapping` ([sso_group_mappings](../../api/prisma/schema.prisma#L2028))
<!-- schema-section:end -->

External identity groups can map to:

* Organization roles
* Teams
* Branches
* Module access

Example:

`Deloitte-Greece-Developers`

→ Greece Branch
→ Engineering Team
→ Developer Role
→ Projects + Tasks access

---

# 72. User Sessions

<!-- schema-section:start -->
> **Schema:** `OrganizationSecurityPolicy` ([organization_security_policies](../../api/prisma/schema.prisma#L850)): `members_can_view_sessions` · `UserDevice` ([user_devices](../../api/prisma/schema.prisma#L475)) · `UserSession` ([user_sessions](../../api/prisma/schema.prisma#L445))
<!-- schema-section:end -->

Users should be able to view active sessions where security policy permits.

Information may include:

* Device
* Browser
* Location approximation
* Login time
* Last activity

Users may revoke sessions.

> **Schema note:** `UserDevice` (user-level, fingerprint hash only) records known browsers and devices; `trusted_at` lets a user skip MFA on a trusted device while the policy allows it, `revoked_at` removes trust. Keys: `users.sessions.read` / `users.sessions.revoke`.

---

# 73. Security Policies

<!-- schema-section:start -->
> **Schema:** `OrganizationSecurityPolicy` ([organization_security_policies](../../api/prisma/schema.prisma#L850)): `allowed_countries` · enum `InvitationPolicy` ([L243](../../api/prisma/schema.prisma#L243))
<!-- schema-section:end -->

Organizations may configure:

* Password requirements
* MFA requirement
* SSO requirement
* Session duration
* Idle timeout
* Login restrictions
* Allowed domains
* Invitation restrictions

---

# 74. MFA

<!-- schema-section:start -->
> **Schema:** `OrganizationSecurityPolicy` ([organization_security_policies](../../api/prisma/schema.prisma#L850)) · `UserAuthMethod` ([user_auth_methods](../../api/prisma/schema.prisma#L420)) · `UserDevice` ([user_devices](../../api/prisma/schema.prisma#L475)) · enum `AuthMethodType` ([L65](../../api/prisma/schema.prisma#L65)) · enum `MfaPolicy` ([L220](../../api/prisma/schema.prisma#L220))
<!-- schema-section:end -->

Support configurable MFA policies.

Examples:

* Optional
* Required for admins
* Required for all users
* Required for sensitive modules

---

# 75. API Access

<!-- schema-section:start -->
> **Schema:** `ApiKey` ([api_keys](../../api/prisma/schema.prisma#L2080)): `allowed_ip_ranges`, `rotation_due_at` · `ApiKeyUsageDaily` ([api_key_usage_daily](../../api/prisma/schema.prisma#L2178)) · `McpToolCall` ([mcp_tool_calls](../../api/prisma/schema.prisma#L2120)) · enum `McpToolCallStatus` ([L2167](../../api/prisma/schema.prisma#L2167))
<!-- schema-section:end -->

Users and organizations may have API credentials where supported.

API credentials should have:

* Owner
* Scope
* Permissions
* Expiration
* Rotation
* Audit history

API access must never automatically inherit unlimited human permissions.

API credentials work on the REST API and on MCP tools. Both are checked by the central authorization service (§136) against the same permission keys, so a key can never do through MCP what it cannot do through the API.

> **Schema note:** `ApiKey.allowed_ip_ranges` (CIDR) restricts where one key may be used, on top of the organization policy (`api_key.updated` audit). `ApiKeyUsageDaily` stores requests, rejections and source IPs per key and day for the key detail view and new-IP alerts. Key: `organizations.api_keys.manage`.

---

# 76. Service Accounts

<!-- schema-section:start -->
> **Schema:** `ServiceAccount` ([service_accounts](../../api/prisma/schema.prisma#L2052)) · enum `ServiceAccountStatus` ([L228](../../api/prisma/schema.prisma#L228)) — other modules: `AutomationRule` ([automation_rules](../../api/prisma/schema.prisma#L21221)): `run_as_service_account_id` ([20](./20-automation-engine.md)) · `AutomationSettings` ([automation_settings](../../api/prisma/schema.prisma#L21064)): `default_service_account_id` ([20](./20-automation-engine.md))
<!-- schema-section:end -->

Organizations may create non-human service identities for automation.

Service accounts should have:

* Name
* Owner
* Purpose
* Permissions
* Scope
* Expiration
* Credential rotation

Service accounts should not be treated as ordinary employees.

Service accounts are the identity for unattended automation, integrations and AI agents. They authenticate with API keys, call the REST API and MCP tools, and are evaluated by the same authorization service as people. Their audit events carry actor type `SERVICE_ACCOUNT`.

---

# 77. External Collaborators

<!-- schema-section:start -->
> **Schema:** enum `MembershipType` ([L108](../../api/prisma/schema.prisma#L108)) — other modules: `ChannelMember` ([channel_members](../../api/prisma/schema.prisma#L13379)) ([12](./12-messaging-team-communication.md))
<!-- schema-section:end -->

External users may be granted limited organization access.

Examples:

* Contractor
* Customer stakeholder
* Partner
* Consultant

They should have restricted permissions and explicit scope.

---

# 78. Guest Access

<!-- schema-section:start -->
> **Schema:** enum `MembershipType` ([L108](../../api/prisma/schema.prisma#L108)) — other modules: `ChannelMember` ([channel_members](../../api/prisma/schema.prisma#L13379)) ([12](./12-messaging-team-communication.md))
<!-- schema-section:end -->

Guest accounts may be restricted to:

* Specific Projects
* Specific Documents
* Specific Channels
* Customer Portal resources

Guest access must not imply organization-wide membership.

---

# 79. Customer Portal Identity

<!-- schema-section:start -->
> **Schema:** `CustomerPortalMembership` ([customer_portal_memberships](../../api/prisma/schema.prisma#L2204)): `role_id` · `Invitation` ([invitations](../../api/prisma/schema.prisma#L1947)): `customer_id` · enum `InvitationAudience` ([L249](../../api/prisma/schema.prisma#L249)) · enum `MembershipType` ([L108](../../api/prisma/schema.prisma#L108)) · enum `RoleType` ([L131](../../api/prisma/schema.prisma#L131)) — other modules: `CalendarBooking` ([calendar_bookings](../../api/prisma/schema.prisma#L20621)): `invitee_user_id` ([19](./19-calendar.md)) · `CalendarEventAttendee` ([calendar_event_attendees](../../api/prisma/schema.prisma#L20320)) ([19](./19-calendar.md)) · `ChannelCallParticipant` ([channel_call_participants](../../api/prisma/schema.prisma#L14169)): `external_user_id` ([12](./12-messaging-team-communication.md)) · `ChannelMember` ([channel_members](../../api/prisma/schema.prisma#L13379)) ([12](./12-messaging-team-communication.md)) · `CommMessage` ([comm_messages](../../api/prisma/schema.prisma#L11988)): `recipient_user_id` ([11](./11-communication-center.md)) · `CommMessageRecipient` ([comm_message_recipients](../../api/prisma/schema.prisma#L12152)): `user_id` ([11](./11-communication-center.md)) · `CustomerPortalSettings` ([customer_portal_settings](../../api/prisma/schema.prisma#L7073)): `default_role_slug` ([07](./07-customer-portal.md)) · `KnowledgeArticleFeedback` ([knowledge_article_feedback](../../api/prisma/schema.prisma#L15533)): `user_id` ([13](./13-customer-support-communication-hub.md)) · `MessageMention` ([message_mentions](../../api/prisma/schema.prisma#L13624)): `external_user_id` ([12](./12-messaging-team-communication.md)) · `MessageReaction` ([message_reactions](../../api/prisma/schema.prisma#L13604)): `external_user_id` ([12](./12-messaging-team-communication.md)) · `Notification` ([notifications](../../api/prisma/schema.prisma#L15967)): `recipient_user_id` ([14](./14-notifications-activity-center.md)) · `ProjectDeliverableReview` ([project_deliverable_reviews](../../api/prisma/schema.prisma#L6501)): `reviewer_user_id` ([05](./05-project-management.md)) · `ProjectGate` ([project_gates](../../api/prisma/schema.prisma#L6267)): `customer_approver_user_id` ([05](./05-project-management.md)) · `ProjectStakeholder` ([project_stakeholders](../../api/prisma/schema.prisma#L5875)): `portal_visible` ([05](./05-project-management.md)) · `ProjectStatusUpdateComment` ([project_status_update_comments](../../api/prisma/schema.prisma#L6547)): `author_user_id` ([05](./05-project-management.md)) · `ProposalAcceptance` ([proposal_acceptances](../../api/prisma/schema.prisma#L4263)): `customer_user_id` ([03](./03-proposal-quotation-generator.md)) · `ProposalComment` ([proposal_comments](../../api/prisma/schema.prisma#L4183)) ([03](./03-proposal-quotation-generator.md)) · `SupportConversation` ([support_conversations](../../api/prisma/schema.prisma#L14713)): `customer_user_id` ([13](./13-customer-support-communication-hub.md)) · `SupportCsatRating` ([support_csat_ratings](../../api/prisma/schema.prisma#L15353)): `rated_by_user_id` ([13](./13-customer-support-communication-hub.md)) · `SupportMessage` ([support_messages](../../api/prisma/schema.prisma#L14816)): `author_user_id` ([13](./13-customer-support-communication-hub.md)) · `TaskComment` ([task_comments](../../api/prisma/schema.prisma#L6909)): `author_user_id` ([06](./06-task-management.md)) · `Ticket` ([tickets](../../api/prisma/schema.prisma#L15016)): `requester_user_id` ([13](./13-customer-support-communication-hub.md))
<!-- schema-section:end -->

Customer Portal users should be separate from internal Members while still using the underlying identity infrastructure where appropriate.

A customer contact can have a portal identity without becoming an internal organization Member.

This module owns the Customer Portal identity model:

* **Customer Portal User**: a User whose membership is to a Customer (a CRM Company, see 02) inside an agency Organization, not to the Organization itself.
* A Customer can have many Customer Portal Users.
* Customer roles are organization-configurable with these defaults: Owner, Administrator, Manager, Finance, Legal, Viewer.
* Customer permissions follow the same catalog and scope model as internal permissions, limited to customer-visible resources (projects, documents, proposals, contracts, invoices, tickets, approvals, portal settings).
* Customer Portal authentication supports the same methods as internal authentication (§6) subject to the Organization's portal security policy, including optional SSO for enterprise customers.
* Inviting, suspending and removing Customer Portal Users is performed by authorized Members, or by a customer Owner/Administrator for their own Customer.

[07 Customer Portal](./07-customer-portal.md) defines what these users see and do. It does not define identity, roles or permissions.

---

# 80. Employee vs Member

<!-- schema-section:start -->
> **Schema:** `Membership` ([memberships](../../api/prisma/schema.prisma#L1314)) — other modules: `Employee` ([employees](../../api/prisma/schema.prisma#L10017)) ([10](./10-employee-management-system.md)) · `TimeEntry` ([time_entries](../../api/prisma/schema.prisma#L19343)): `membership_id` ([18](./18-time-tracking.md))
<!-- schema-section:end -->

Employee and Member are not synonymous.

A Member means:

> A User has access to an Organization.

An Employee means:

> The organization has an employment/HR record for that person.

A contractor or external collaborator can be a Member without being an Employee.

Employee Management remains the source of truth for employment information.

---

# 81. User Profile vs Employee Profile

<!-- schema-section:start -->
> **Schema:** `Membership` ([memberships](../../api/prisma/schema.prisma#L1314)) — other modules: `Employee` ([employees](../../api/prisma/schema.prisma#L10017)) ([10](./10-employee-management-system.md)) · `EmployeeCompensation` ([employee_compensations](../../api/prisma/schema.prisma#L10200)) ([10](./10-employee-management-system.md)) · `PayrollSchedule` ([payroll_schedules](../../api/prisma/schema.prisma#L9081)) ([09](./09-income-expense-management.md))
<!-- schema-section:end -->

User Profile owns identity and authentication information.

Employee Profile owns employment information such as:

* Job title
* Compensation
* Employment dates
* Leave
* HR notes
* Employment status

Do not duplicate these fields in User Management.

---

# 82. Teams vs Branches

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The system must not treat Teams and Branches as the same entity.

### Branch

Where the organization operates geographically / organizationally.

### Team

Who works together functionally.

A team can span multiple branches.

---

# 83. Organization Hierarchy

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The platform should support an optional organization hierarchy:

**Organization**

→ Branches

→ Departments / Teams

→ Members

The hierarchy should be flexible enough for small companies and multinational organizations.

---

# 84. Branch Hierarchy Example

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Example enterprise structure:

**Deloitte**

├── Americas
│ ├── USA
│ └── Canada
│
├── Europe
│ ├── UK
│ ├── Germany
│ ├── France
│ └── Greece
│ ├── Athens
│ └── Thessaloniki
│
└── Asia Pacific
├── Australia
└── Singapore

The hierarchy is configurable rather than hardcoded.

---

# 85. Resource Visibility

<!-- schema-section:start -->
> **Schema:** other modules: enum `DocumentScope` ([L17809](../../api/prisma/schema.prisma#L17809)) ([17](./17-documents-file-management.md))
<!-- schema-section:end -->

Every major resource should be able to express visibility:

* Organization-wide
* Branch
* Branch hierarchy
* Team
* Project
* Explicit users

This provides a consistent security model across modules.

---

# 86. Cross-Branch Collaboration

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Members from different branches can collaborate when explicitly permitted.

Examples:

* Shared project
* Shared team
* Shared customer
* Global support
* Global finance

Cross-branch access should be visible to administrators.

---

# 87. Organization-Wide Teams

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Some teams should not be tied to a branch.

Examples:

* Global IT
* Global Finance
* Executive Team
* Security
* Platform Engineering

These teams can operate across branches.

---

# 88. Branch-Restricted Teams

<!-- schema-section:start -->
> **Schema:** `Team` ([teams](../../api/prisma/schema.prisma#L1213)): `branch_id`
<!-- schema-section:end -->

A team may be limited to one branch.

Example:

**Athens Frontend Team**

Only Athens members can join unless explicitly overridden.

---

# 89. Membership Transfer

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

A Member can be transferred between branches.

Transfer should preserve:

* User identity
* Organization membership
* Historical records
* Previous branch activity

New branch permissions should apply after the transfer.

---

# 90. Multi-Branch Membership

<!-- schema-section:start -->
> **Schema:** `MembershipBranch` ([membership_branches](../../api/prisma/schema.prisma#L1570))
<!-- schema-section:end -->

Some users may permanently belong to multiple branches.

Examples:

* Regional manager
* Global executive
* Traveling consultant
* Shared finance team

The system should support multiple branch assignments without duplicating users.

---

# 91. Branch Manager Scope

<!-- schema-section:start -->
> **Schema:** `MembershipBranch` ([membership_branches](../../api/prisma/schema.prisma#L1570)): `include_children`
<!-- schema-section:end -->

Branch Managers should be able to manage only their assigned branch unless additional permissions are granted.

Child-branch access can be inherited when configured.

---

# 92. Role Assignment

<!-- schema-section:start -->
> **Schema:** `RoleAssignment` ([role_assignments](../../api/prisma/schema.prisma#L1695))
<!-- schema-section:end -->

Roles may be assigned at:

* Organization level
* Branch level
* Team level
* Project level
* Resource level

The effective permission set is calculated from all applicable assignments.

---

# 93. Temporary Permissions

<!-- schema-section:start -->
> **Schema:** `Invitation` ([invitations](../../api/prisma/schema.prisma#L1947)): `valid_until` · `RoleAssignment` ([role_assignments](../../api/prisma/schema.prisma#L1695)): `valid_until`
<!-- schema-section:end -->

Support time-limited access.

Example:

A consultant receives Finance access for 30 days.

The permission automatically expires without requiring manual removal.

---

# 94. Delegation

<!-- schema-section:start -->
> **Schema:** `Delegation` ([delegations](../../api/prisma/schema.prisma#L1746)) · enum `DelegationStatus` ([L235](../../api/prisma/schema.prisma#L235))
<!-- schema-section:end -->

Users may temporarily delegate selected responsibilities.

Example:

A Branch Manager on leave delegates project approval to another manager.

Delegation should have:

* Start date
* End date
* Permissions delegated
* Delegate
* Audit history

---

# 95. Approval Permissions

<!-- schema-section:start -->
> **Schema:** other modules: `Invoice` ([invoices](../../api/prisma/schema.prisma#L7550)): `approved_by_user_id` ([08](./08-financial-management-stripe-integration.md)) · `LeaveRequest` ([leave_requests](../../api/prisma/schema.prisma#L10615)) ([10](./10-employee-management-system.md)) · `ProposalApproval` ([proposal_approvals](../../api/prisma/schema.prisma#L4138)) ([03](./03-proposal-quotation-generator.md)) · enum `LeaveApproverStrategy` ([L9962](../../api/prisma/schema.prisma#L9962)) ([10](./10-employee-management-system.md)) · enum `LeaveRequestStatus` ([L9709](../../api/prisma/schema.prisma#L9709)) ([10](./10-employee-management-system.md))
<!-- schema-section:end -->

Sensitive actions should support explicit approval rights.

Examples:

* Contract approval
* Expense approval
* Invoice approval
* Project completion
* Employee leave approval

Approval permissions are separate from general edit permissions.

---

# 96. Separation of Duties

<!-- schema-section:start -->
> **Schema:** other modules: `FinanceApprovalRule` ([finance_approval_rules](../../api/prisma/schema.prisma#L8267)): `require_distinct_user` ([08](./08-financial-management-stripe-integration.md)) · `Invoice` ([invoices](../../api/prisma/schema.prisma#L7550)): `approved_by_user_id` ([08](./08-financial-management-stripe-integration.md))
<!-- schema-section:end -->

The authorization model should support separation-of-duties rules.

Example:

The person creating an invoice may not be allowed to approve that same invoice.

The person generating a contract may require a different person to approve it.

---

# 97. Permission Conflicts

<!-- schema-section:start -->
> **Schema:** `Permission` ([permissions](../../api/prisma/schema.prisma#L1611)): `is_sensitive`
<!-- schema-section:end -->

Administrators should be warned about potentially dangerous combinations.

Examples:

* User creation + security administration
* Finance creation + finance approval
* Contract generation + contract approval
* Employee management + compensation visibility

Policies can define restricted combinations.

---

# 98. Access Reviews

<!-- schema-section:start -->
> **Schema:** `AccessReview` ([access_reviews](../../api/prisma/schema.prisma#L1782)) · `AccessReviewItem` ([access_review_items](../../api/prisma/schema.prisma#L1813)) · enum `AccessReviewDecision` ([L263](../../api/prisma/schema.prisma#L263)) · enum `AccessReviewStatus` ([L255](../../api/prisma/schema.prisma#L255)) · enum `ReviewerStrategy` ([L1774](../../api/prisma/schema.prisma#L1774))
<!-- schema-section:end -->

Organizations should be able to periodically review access.

Review workflow:

1. Generate access review.
2. Manager/admin reviews users.
3. Confirm access.
4. Remove unnecessary access.
5. Record completion.

> **Schema note:** `AccessReview.reviewer_strategy` (BRANCH_MANAGERS, TEAM_LEADS, LINE_MANAGER, SPECIFIC, with `reviewer_membership_ids`) decides how `AccessReviewItem.reviewer_membership_id` is resolved when the review starts.

---

# 99. Permission Audit

<!-- schema-section:start -->
> **Schema:** enum `AuditActorType` ([L313](../../api/prisma/schema.prisma#L313)) · enum `AuditOutcome` ([L2259](../../api/prisma/schema.prisma#L2259))
<!-- schema-section:end -->

Audit important authorization changes:

* Role assigned
* Role removed
* Permission granted
* Permission revoked
* Branch assigned
* Branch removed
* Team assigned
* Module enabled
* Module disabled
* Admin promoted
* Admin removed

> **Schema note:** `AuditEvent.outcome` (`AuditOutcome`: SUCCESS, FAILURE, DENIED) backs the "outcome" filter; audit and member lists keep saved views through `RecordEntityType` values AUDIT_EVENT and MEMBERSHIP.

---

# 100. User Activity Audit

<!-- schema-section:start -->
> **Schema:** enum `AuditActorType` ([L313](../../api/prisma/schema.prisma#L313))
<!-- schema-section:end -->

Where platform audit infrastructure supports it, track:

* Login
* Logout
* Resource access
* Sensitive exports
* Permission changes
* Organization switching
* Security changes

Audit retention should follow organization policy.

---

# 101. Data Export Permissions

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Exporting data should be separately permissioned from reading data.

Example:

A user may read CRM customers but not export the entire customer database.

---

# 102. Delete Permissions

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Deletion should be separately permissioned.

Where possible, modules should prefer archive/deactivation over destructive deletion.

---

# 103. Organization Deletion

<!-- schema-section:start -->
> **Schema:** `Organization` ([organizations](../../api/prisma/schema.prisma#L516)): `deletion_requested_at`
<!-- schema-section:end -->

Organization deletion must be restricted to authorized Owners / platform administrators.

Support:

* Deletion request
* Confirmation
* Grace period
* Data export
* Final deletion
* Audit record

---

# 104. Branch Deletion

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Branches should generally be archived rather than deleted.

Historical resources should retain their branch association.

---

# 105. Organization Settings Permissions

<!-- schema-section:start -->
> **Schema:** `OrganizationPlan` ([organization_plans](../../api/prisma/schema.prisma#L970)) · `OrganizationPlanInvoice` ([organization_plan_invoices](../../api/prisma/schema.prisma#L993)) · enum `OrganizationPlanInvoiceStatus` ([L909](../../api/prisma/schema.prisma#L909)) · enum `OrganizationPlanStatus` ([L901](../../api/prisma/schema.prisma#L901))
<!-- schema-section:end -->

Different administrative settings should have independent permissions.

Examples:

* Organization profile
* Branding
* Security
* Billing
* Members
* Roles
* Branches
* Teams
* Integrations
* API

Avoid one universal "Admin" permission when granular delegation is possible.

> **Schema note:** `OrganizationPlan` and `OrganizationPlanInvoice` hold the organization's own subscription to the platform (plan, seats, limits, payment-method display data, platform invoices; key `organizations.billing.manage`). `OrganizationRetentionPolicy` sets retention and legal hold per platform data class (key `organizations.retention.manage`, sensitive).

---

# 106. Permission Management UI

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The administration interface should provide:

### Users

List all Members and status.

### Roles

Create and manage roles.

### Permissions

Browse the permission catalog.

### Branches

Manage branch hierarchy.

### Teams

Manage organizational teams.

### Access Reviews

Review effective access.

### Audit

Review security changes.

---

# 107. Member Detail Page

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

A Member page should show:

* User identity
* Organization membership
* Roles
* Branches
* Teams
* Module access
* Effective permissions
* Active sessions
* Security status
* Recent activity
* Invitations

Sensitive HR information should not appear unless authorized.

---

# 108. Effective Permissions View

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Administrators should see a calculated permission summary.

Example:

**Projects**

* Read: Yes
* Create: Yes
* Update: Yes
* Delete: No
* Manage members: Yes

**Finance**

* Read: Yes
* Create: No
* Approve: No

The interface should show the source of each permission.

---

# 109. Role Editor

<!-- schema-section:start -->
> **Schema:** `Role` ([roles](../../api/prisma/schema.prisma#L1633)): `restrictions`, `version` · `RoleVersion` ([role_versions](../../api/prisma/schema.prisma#L1839))
<!-- schema-section:end -->

Role editor should allow administrators to:

* Name role
* Describe role
* Select permissions
* Select scope
* Assign modules
* Define restrictions
* Save
* Publish
* Duplicate
* Deprecate

> **Schema note:** `RolePermission.max_scope_type` limits the widest scope a permission may be used at in a role (for example read invoices only at BRANCH).

---

# 110. Permission Catalog UI

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Permissions should be grouped by product:

* CRM
* Projects
* Tasks
* Support
* Offers
* Contracts
* Finance
* Employees
* Documents
* Messaging
* Calendar
* Customer Portal
* Administration

---

# 111. Role Templates

<!-- schema-section:start -->
> **Schema:** `Role` ([roles](../../api/prisma/schema.prisma#L1633)): `template_role_id`
<!-- schema-section:end -->

Provide reusable default roles.

Examples:

* Owner
* Admin
* Manager
* Employee
* Finance Manager
* Sales Manager
* Project Manager
* Support Agent
* Viewer
* External Collaborator

Organizations can clone and customize them.

---

# 112. Permission Bundles

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Permission bundles can simplify administration.

Example:

**Project Manager Bundle**

* Projects read/create/update
* Tasks read/create/update
* Team visibility
* Time visibility
* Project reporting

Bundles can be assigned to roles.

---

# 113. Branch Roles

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Organizations can define branch-specific roles.

Example:

**Greece Branch Manager**

* Manage Greece members
* Manage Greece projects
* View Greece finance
* View Greece CRM
* Cannot manage global security

---

# 114. Global Roles

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Global roles apply organization-wide.

Examples:

* Global Finance Director
* Global HR Admin
* Global Security Admin
* Global CEO

---

# 115. Resource Sharing

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Users should be able to share specific resources with another authorized Member where supported.

Examples:

* Share project
* Share document
* Share conversation
* Share report

Sharing must never bypass organization isolation.

---

# 116. External Organization Collaboration

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Cross-organization collaboration should be explicit.

Example:

Deloitte can collaborate with a customer organization on a Project without giving the customer access to Deloitte's internal organization.

The Customer Portal / external collaboration mechanisms should be used rather than breaking tenant isolation.

---

# 117. Organization Relationships

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Organizations may have business relationships:

* Customer
* Vendor
* Partner
* Parent company
* Subsidiary
* Affiliate

These relationships belong to CRM / business modules, not the identity layer.

---

# 118. Organization vs Legal Entity

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The platform should allow an Organization to represent a company while retaining flexibility for complex corporate structures.

If legal entities need to be modeled separately later, they should not be confused with Branches.

For example:

**Global Group**

→ Legal Entity A
→ Legal Entity B

→ Branch Athens
→ Branch London

The exact legal-entity model can be introduced as a separate domain if required.

---

# 119. Branch vs Subsidiary

<!-- schema-section:start -->
> **Schema:** enum `BranchKind` ([L98](../../api/prisma/schema.prisma#L98))
<!-- schema-section:end -->

A Branch is not automatically a separate legal entity.

The system must allow administrators to mark a branch as:

* Operational branch
* Office
* Regional unit
* Subsidiary reference

without assuming legal status.

If legal/accounting separation is required, Finance should support the appropriate legal-entity model separately.

---

# 120. Localization by Branch

<!-- schema-section:start -->
> **Schema:** `Branch` ([branches](../../api/prisma/schema.prisma#L1087)): `branding` — other modules: `CalendarEvent` ([calendar_events](../../api/prisma/schema.prisma#L20217)): `branch_id` ([19](./19-calendar.md)) · `CalendarPreference` ([calendar_preferences](../../api/prisma/schema.prisma#L20058)): `timezone` ([19](./19-calendar.md)) · `CommSenderIdentity` ([comm_sender_identities](../../api/prisma/schema.prisma#L11777)) ([11](./11-communication-center.md)) · `SlaPolicy` ([sla_policies](../../api/prisma/schema.prisma#L14964)): `use_business_hours` ([13](./13-customer-support-communication-hub.md))
<!-- schema-section:end -->

Branches can override organization defaults for:

* Time zone
* Locale
* Language
* Currency display
* Working hours
* Week start
* Date format

Organization defaults remain the fallback.

---

# 121. Branch Business Hours

<!-- schema-section:start -->
> **Schema:** other modules: `CalendarEvent` ([calendar_events](../../api/prisma/schema.prisma#L20217)): `branch_id` ([19](./19-calendar.md)) · `CalendarResource` ([calendar_resources](../../api/prisma/schema.prisma#L20176)): `availability` ([19](./19-calendar.md)) · `EmployeeWorkSchedule` ([employee_work_schedules](../../api/prisma/schema.prisma#L10394)) ([10](./10-employee-management-system.md)) · `TimeUtilizationPeriod` ([time_utilization_periods](../../api/prisma/schema.prisma#L19714)) ([18](./18-time-tracking.md)) · `Timesheet` ([timesheets](../../api/prisma/schema.prisma#L19632)): `expected_minutes` ([18](./18-time-tracking.md))
<!-- schema-section:end -->

Each branch can define:

* Working days
* Opening hours
* Holidays
* Local timezone

Calendar and scheduling modules can consume this information.

---

# 122. Branch Holidays

<!-- schema-section:start -->
> **Schema:** `BranchHoliday` ([branch_holidays](../../api/prisma/schema.prisma#L1193)) — other modules: `BookingLink` ([booking_links](../../api/prisma/schema.prisma#L20522)) ([19](./19-calendar.md)) · `CalendarAvailabilitySchedule` ([calendar_availability_schedules](../../api/prisma/schema.prisma#L20456)): `honor_holidays` ([19](./19-calendar.md)) · `CalendarEvent` ([calendar_events](../../api/prisma/schema.prisma#L20217)): `branch_id` ([19](./19-calendar.md)) · `CompanyHoliday` ([company_holidays](../../api/prisma/schema.prisma#L10706)) ([10](./10-employee-management-system.md)) · `TimeUtilizationPeriod` ([time_utilization_periods](../../api/prisma/schema.prisma#L19714)): `leave_minutes` ([18](./18-time-tracking.md)) · `Timesheet` ([timesheets](../../api/prisma/schema.prisma#L19632)): `expected_minutes` ([18](./18-time-tracking.md)) · enum `CompanyHolidayKind` ([L9744](../../api/prisma/schema.prisma#L9744)) ([10](./10-employee-management-system.md))
<!-- schema-section:end -->

Branches may have local holiday calendars.

Example:

Greece and Germany may have different public holidays.

Calendar and employee scheduling can consume branch-specific holiday context.

---

# 123. Branch Reporting

<!-- schema-section:start -->
> **Schema:** other modules: `TimeEntry` ([time_entries](../../api/prisma/schema.prisma#L19343)): `branch_id` ([18](./18-time-tracking.md))
<!-- schema-section:end -->

Organization reporting should support:

* Global
* Region
* Country
* Branch
* Team

Example:

Revenue:

**Global → Europe → Greece → Athens**

The reporting modules remain responsible for calculations.

---

# 124. Branch Filters

<!-- schema-section:start -->
> **Schema:** other modules: `TimeEntry` ([time_entries](../../api/prisma/schema.prisma#L19343)): `branch_id` ([18](./18-time-tracking.md))
<!-- schema-section:end -->

Common platform views should support branch filtering where relevant:

* CRM
* Projects
* Tasks
* Finance
* Employees
* Support
* Contracts
* Offers

---

# 125. Default Branch

<!-- schema-section:start -->
> **Schema:** `Membership` ([memberships](../../api/prisma/schema.prisma#L1314)): `default_branch_id`
<!-- schema-section:end -->

A Member may have a default branch used for navigation and creation workflows.

Example:

John's default branch = Athens.

The default does not restrict him if he has broader permissions.

---

# 126. Default Team

<!-- schema-section:start -->
> **Schema:** `Membership` ([memberships](../../api/prisma/schema.prisma#L1314)): `default_branch_id`
<!-- schema-section:end -->

A Member may have a primary team.

This can be used for:

* Default assignment
* Notifications
* Workload
* Reporting
* Project recommendations

---

# 127. User Preferences

<!-- schema-section:start -->
> **Schema:** `User` ([users](../../api/prisma/schema.prisma#L344)): `default_organization_id` · `UserPreference` ([user_preferences](../../api/prisma/schema.prisma#L497)) — other modules: `NotificationRecipientSettings` ([notification_recipient_settings](../../api/prisma/schema.prisma#L16213)): `language`, `timezone` ([14](./14-notifications-activity-center.md))
<!-- schema-section:end -->

User-specific preferences may include:

* Language
* Time zone
* Theme
* Default organization
* Default branch
* Default team
* Notification preferences
* Dashboard layout

These preferences are not permissions.

---

# 128. Organization Defaults

<!-- schema-section:start -->
> **Schema:** other modules: `CommTemplateTranslation` ([comm_template_translations](../../api/prisma/schema.prisma#L11926)) ([11](./11-communication-center.md))
<!-- schema-section:end -->

Organization defaults may include:

* Currency
* Timezone
* Locale
* Working days
* Default roles
* Default project settings
* Default document settings

Users and branches can override defaults where permitted.

---

# 129. Onboarding

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Organization onboarding should guide Owners through:

1. Company information
2. Branch setup
3. Teams
4. Users
5. Roles
6. Module activation
7. Security configuration
8. Integrations
9. Branding

---

# 130. Member Onboarding

<!-- schema-section:start -->
> **Schema:** other modules: `WikiChecklist` ([wiki_checklists](../../api/prisma/schema.prisma#L17228)): `auto_assign` ([15](./15-notion-business-docs.md))
<!-- schema-section:end -->

New Members may receive an onboarding workflow based on role and branch.

Example:

Developer:

* Join engineering team
* Access Projects
* Access Tasks
* Access Messaging
* Complete security setup

---

# 131. Offboarding

<!-- schema-section:start -->
> **Schema:** `Membership` ([memberships](../../api/prisma/schema.prisma#L1314)): `offboarding` — other modules: `WikiChecklist` ([wiki_checklists](../../api/prisma/schema.prisma#L17228)): `auto_assign` ([15](./15-notion-business-docs.md))
<!-- schema-section:end -->

When a Member leaves:

1. Disable login.
2. Revoke active sessions.
3. Revoke temporary credentials.
4. Remove active assignments where appropriate.
5. Preserve historical records.
6. Reassign ownership where required.
7. Preserve audit history.

Offboarding should not delete historical work.

---

# 132. Ownership Transfer

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Before deactivating a Member, the system should identify resources they own:

* Projects
* Deals
* Tasks
* Contracts
* Support tickets
* Documents
* Teams

Administrators can transfer ownership to another authorized Member.

---

# 133. Reassignment Rules

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Organizations may configure automatic reassignment for selected resources.

Example:

When Account Manager leaves:

→ Reassign open deals to Sales Manager.

The platform must not automatically reassign sensitive resources without policy approval.

---

# 134. Audit History Preservation

<!-- schema-section:start -->
> **Schema:** `OrganizationRetentionPolicy` ([organization_retention_policies](../../api/prisma/schema.prisma#L946)) · enum `OrganizationRetentionAction` ([L894](../../api/prisma/schema.prisma#L894)) · enum `OrganizationRetentionDataClass` ([L886](../../api/prisma/schema.prisma#L886))
<!-- schema-section:end -->

When a user is deactivated, historical records should continue showing the original actor.

Example:

> Contract approved by John Smith — March 4, 2026

Even if John is no longer an active Member.

---

# 135. Permission Caching

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The authorization layer may cache permission evaluations for performance, but permission changes must propagate quickly and predictably.

Critical security changes should invalidate relevant sessions or permission caches immediately.

---

# 136. Authorization API

<!-- schema-section:start -->
> **Schema:** `McpToolCall` ([mcp_tool_calls](../../api/prisma/schema.prisma#L2120)): `permission_key` · enum `McpToolCallStatus` ([L2167](../../api/prisma/schema.prisma#L2167))
<!-- schema-section:end -->

Internal modules should consume a centralized authorization service.

Capabilities should include:

* Check permission
* Check resource access
* Resolve effective roles
* Resolve branch scope
* Resolve team scope
* Explain authorization result

Modules should not implement independent permission engines.

## Implementation requirement: build this first

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The central authorization service is the first thing built in `api/`, as part of this module's first delivery and before any other module ships an endpoint. No feature is allowed to start with a temporary role check.

Deliver, in `api/src/shared/` (or a dedicated `authorization` module imported everywhere):

* `AuthorizationService` with: check permission, check resource access, resolve effective roles, resolve branch scope, resolve team scope, resolve project scope, and explain an authorization result
* `PermissionsGuard` and a `@RequirePermission('module.resource.action')` decorator for REST endpoints and WebSocket gateways. The existing `RolesGuard` and `@Roles()` remain for platform roles (`AuthRole`) only
* Scope filters that list queries can apply, so lists respect branch, team and project limits and not only single-record checks
* Evaluation of role assignments, per-person grants, explicit deny, temporary access (`valid_until`), module enablement and customer-portal `portal.*` keys
* Evaluation of API keys (`ApiKey.scopes` narrowing the owner's permissions) and service accounts, so the same service answers for REST, MCP tools, automation runs and background jobs
* A permission cache with immediate invalidation when roles, assignments, grants, memberships or enabled modules change (§135)
* A permissions endpoint for the signed-in identity that the UI uses to gate routes, navigation and controls
* Enforcement of the privilege escalation rules in §63 on every role, assignment, grant and delegation write
* Tests for allow, deny, wrong scope, wrong organization, expired access and non-human identities, and each escalation rule in §63 (granting beyond what the caller holds, self-modification, Owner-only actions, editing system templates)

Acceptance: a new module adds its permission keys to the catalog, tags its endpoints with `@RequirePermission`, and gets correct enforcement for the UI, REST API, MCP tools, API keys, service accounts and automation without writing any authorization code of its own.

---

# 137. API Permissions

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

API requests should include organization context and authenticated identity.

Authorization must evaluate the same permissions model as the UI.

UI hiding is not security.

---

# 138. Webhooks

<!-- schema-section:start -->
> **Schema:** other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L21877)): `previous_secret` ([20](./20-automation-engine.md))
<!-- schema-section:end -->

Identity and organization events should support webhooks.

Examples:

* `user.created`
* `user.updated`
* `user.deactivated`
* `membership.created`
* `membership.updated`
* `membership.revoked`
* `organization.created`
* `organization.updated`
* `branch.created`
* `branch.updated`
* `branch.archived`
* `role.created`
* `role.updated`
* `permission.changed`
* `team.created`
* `team.updated`

> **Schema note:** `OutboundWebhook.previous_secret`, `secret_rotated_at` and `previous_secret_expires_at` give a grace window on secret rotation so in-flight deliveries stay verifiable. Keys: `automation.webhooks.read` (list and deliveries) and `automation.webhooks.manage`.

---

# 139. Audit Events

<!-- schema-section:start -->
> **Schema:** enum `AuditActorType` ([L313](../../api/prisma/schema.prisma#L313)) · enum `AuditOutcome` ([L2259](../../api/prisma/schema.prisma#L2259))
<!-- schema-section:end -->

Security-sensitive events should produce immutable audit events.

Examples:

* Login
* MFA change
* Role assignment
* Permission change
* Branch assignment
* Organization switch
* User deactivation
* API credential creation
* SSO configuration

---

# 140. Search

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Organization administrators should be able to search:

* Users
* Members
* Roles
* Teams
* Branches
* Permissions
* Organizations

Search must respect organization scope.

---

# 141. Organization Admin Dashboard

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Dashboard should show:

* Active Members
* Pending invitations
* Branches
* Teams
* Module adoption
* Admins
* Security status
* Recent permission changes
* Access review status
* Suspended accounts

---

# 142. Branch Dashboard

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Branch dashboard may show:

* Members
* Teams
* Projects
* Customers
* Support workload
* Revenue context
* Open tasks
* Branch activity

Other modules remain responsible for domain-specific metrics.

---

# 143. Permission Matrix

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Organizations should have a matrix view:

| Role | CRM | Projects | Tasks | Support | Finance | Contracts |
| -- | -- | -- | -- | -- | -- | -- |
| Owner | Full | Full | Full | Full | Full | Full |
| Manager | Manage | Manage | Manage | Manage | Read | Manage |
| Employee | Read | Edit | Edit | Read | None | Read |
| Viewer | Read | Read | Read | Read | None | Read |

The matrix should be generated from actual permissions rather than hardcoded.

---

# 144. Branch Permission Matrix

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Permissions should also be inspectable by scope.

Example:

| Role | Athens | Thessaloniki | Greece | Global |
| -- | -- | -- | -- | -- |
| Branch Manager | Full | None | None | None |
| Regional Manager | Full | Full | Full | None |
| Global Admin | Full | Full | Full | Full |

---

# 145. Access Simulation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Administrators should be able to select:

* User
* Organization
* Branch
* Resource

and ask:

**"Can this user perform this action?"**

The system should return:

* Allowed / denied
* Reason
* Role responsible
* Scope responsible
* Any deny rule

---

# 146. Security Notifications

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Notify administrators about events such as:

* New admin assigned
* MFA disabled
* Large permission change
* Suspicious bulk provisioning
* External collaborator added
* Branch admin changed
* SSO configuration changed

---

# 147. Enterprise Governance

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Large organizations should support:

* Access reviews
* Delegated administration
* Branch hierarchy
* Global roles
* Regional roles
* Separation of duties
* SSO
* SCIM
* Audit logs
* Security policies
* Temporary access

---

# 148. Small Organization Experience

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The same model should remain simple for a small company.

A 5-person agency may only use:

* One Organization
* No Branches
* Two Teams
* Owner
* Admin
* Employee roles

Advanced enterprise features remain optional.

---

# 149. Organization Templates

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Organizations may use setup templates for common structures.

Example:

**Agency Template**

* Sales
* Engineering
* Design
* Support
* Finance
* Management

Default roles and permissions can be generated from the template.

---

# 150. Recommended MVP

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

### Identity

* Users
* Authentication
* Profiles
* User status
* Sessions

### Organizations

* Organization creation
* Organization profile
* Organization isolation
* Organization switcher
* Owner
* Admin

### Membership

* Invitations
* Memberships
* Roles
* Module access
* Offboarding

### Branches

* Branch creation
* Branch hierarchy
* Branch membership
* Branch managers
* Branch scope
* Branch filtering

### Teams

* Teams
* Team membership
* Team roles

### Permissions

* Permission catalog
* Role-based access
* Scope-based permissions
* Resource access
* Module permissions
* Audit history

### Enterprise

* SSO foundation
* MFA
* API authorization
* External collaborators

---

# 151. Phase 2

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* SCIM
* Advanced branch hierarchy
* Delegated administration
* Temporary permissions
* Access reviews
* Permission simulation
* Field-level permissions
* Separation of duties
* Service accounts
* Advanced audit search
* Organization templates
* Branch dashboards

---

# 152. Phase 3

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Enterprise identity governance
* Advanced identity-provider integrations
* Automated access certification
* Risk-based access controls
* Advanced organizational modeling
* Legal-entity support where required
* Cross-organization enterprise federation
* Advanced policy engine
* AI-assisted access reviews

---

# 153. Success Criteria

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The module is successful when:

* A User has one global identity.
* A User can belong to multiple Organizations.
* Organizations are fully isolated tenants.
* Organizations can contain many Branches.
* Branches can be hierarchical.
* Branches are not confused with separate Organizations.
* Users can belong to multiple branches.
* Teams can span branches.
* Roles are reusable.
* Permissions are granular.
* Permissions can be scoped.
* Module access is separate from detailed permissions.
* Admin responsibilities can be delegated.
* Enterprise SSO/SCIM can be added without redesigning the identity model.
* Historical records remain intact after offboarding.
* Cross-branch collaboration is possible without weakening tenant isolation.
* External collaborators can access specific resources without becoming full internal users.
* Customer Portal identities remain distinct from internal Members.
* Modules consume one centralized authorization system rather than implementing their own.
* Organizations bring their own provider keys (OpenAI, Resend, Twilio, Stripe, Viva Wallet at launch) through the Integrations page; no tenant provider key lives in the platform environment.
* Provider secrets are write-only: no API, MCP tool, log or audit event ever returns one.

---

# 154. Core Relationship Model

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The conceptual model should be:

**Platform**

→ Users

→ Organizations

→ Organization Memberships

→ Branches

→ Teams

→ Roles

→ Permissions

→ Scopes

→ Resources

With operational relationships:

**User**

→ Membership

→ Organization

→ Branch / Branches

→ Team / Teams

→ Role / Roles

→ Permissions

→ Access to CRM / Projects / Tasks / Support / Finance / Contracts / Offers / Documents / Messaging / Calendar / other modules

---

# 155. Critical Architectural Distinctions

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The implementation must preserve these distinctions:

### User ≠ Member

A User is a global identity. A Member is that identity's access relationship to an Organization.

### Organization ≠ Branch

An Organization is a separate company / tenant. A Branch is a unit inside that company.

### Branch ≠ Team

A Branch represents organizational/geographic structure. A Team represents functional collaboration.

### Member ≠ Employee

A Member has platform access. An Employee has an HR/employment relationship.

### Role ≠ Permission

A Role bundles permissions. A Permission represents an individual capability.

### Authentication ≠ Authorization

Authentication proves who the user is. Authorization determines what that user can access.

### Product Access ≠ Feature Permission

Having access to Projects does not automatically grant every Projects permission.

### Organization Scope ≠ Branch Scope

Organization-wide access and branch-limited access must be independently represented.

---

# 156. Integrations & Organization Credentials (Bring Your Own Keys)

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Every organization connects the third-party services it uses **with its own credentials**. No provider key that belongs to a tenant lives in the platform `.env`.

Why:

* **Cost ownership.** AI tokens, SMS and email volume and payment fees are billed by the provider to the organization that owns the account.
* **Data and contract boundaries.** A customer's data goes through the customer's own OpenAI, Stripe or Resend account, under the customer's own agreement with that provider.
* **Isolation and revocation.** One tenant's key can be rotated, disabled or leaked without touching any other tenant or redeploying the platform.
* **No shared blast radius.** The platform environment holds infrastructure secrets only (§160).

Providers by category (the registry is `api/src/shared/constants/integration-providers.ts`):

| Category | Providers | Consumed by |
| -- | -- | -- |
| AI | OpenAI | Every module through the shared AI integration layer (drafting, classification, extraction, retrieval, automation AI steps, support agent) |
| Email | Resend | 11 Communication Center, 14 Notifications to customers, 03/08 documents sent by email |
| SMS | Twilio | 11 Communication Center |
| Payments | Stripe, Viva Wallet | 08 Financial Management (several accounts per provider, test and live) |

**Launch set: five providers.** More are added one at a time: a value in the `IntegrationProvider` enum, an entry in the registry and an adapter in the consuming module. The domain enums for payments (08: PayPal, Mollie, Adyen) and communications (11: SendGrid, Postmark, Mailgun, Amazon SES, SMTP, Vonage, MessageBird) already reserve the next candidates.

Not covered here:

* **Storage, e-signature and workspace OAuth apps** keep the credentials of their own module for now (17 `DocumentStorageConnection`, 04 `SignatureRequest`, 19 calendar and conferencing connections) and move here when they get an `IntegrationProvider` value.
* **Maps.** The Google Maps key is a platform-level key (§160), not a tenant integration.

* **Per-member OAuth connections** (a member linking their own Google or Microsoft calendar) stay in 19.
* **External tools for messaging and projects** (GitHub, GitLab, Jira, Linear, Notion, Slack) stay in 12 `MessagingIntegration`. The Integrations page links to them.
* **The platform's own API keys and service accounts** (§75–§76) authenticate callers *to* this platform; integrations authenticate this platform *to* a provider.
* **The customer secrets vault** (17 §12) stores secrets that belong to customers and projects, not the organization's own provider keys.

---

# 157. Integration Connection Model

<!-- schema-section:start -->
> **Schema:** `IntegrationConnection` ([integration_connections](../../api/prisma/schema.prisma#L1865)) · `IntegrationUsageDaily` ([integration_usage_daily](../../api/prisma/schema.prisma#L1920)) · enum `IntegrationCategory` ([L282](../../api/prisma/schema.prisma#L282)) · enum `IntegrationMode` ([L300](../../api/prisma/schema.prisma#L300)) · enum `IntegrationProvider` ([L273](../../api/prisma/schema.prisma#L273)) · enum `IntegrationStatus` ([L291](../../api/prisma/schema.prisma#L291)) — other modules: `CommProviderAccount` ([comm_provider_accounts](../../api/prisma/schema.prisma#L11714)): `integration_connection_id` ([11](./11-communication-center.md)) · `PaymentProviderConnection` ([payment_provider_connections](../../api/prisma/schema.prisma#L7983)): `integration_connection_id` ([08](./08-financial-management-stripe-integration.md))
<!-- schema-section:end -->

An **Integration Connection** is one connected account of one provider for one organization.

Fields that matter:

* **Provider and category.** The category is what modules ask for; the provider is what the adapter talks to.
* **Name.** Admin label ("OpenAI production", "Stripe EU test"), unique per organization.
* **Mode.** Live or test, for providers that have both (Stripe, Viva Wallet).
* **Status.** Pending (saved, not verified), Active (verified and usable), Error (the last verification or call failed, with the error kept), Disabled (switched off, secret kept), Disconnected (secret destroyed).
* **Credential source.** Organization (own key, the default) or Platform (§160).
* **Secrets.** Encrypted, write-only (§158). Only a non-reversible hint per field (prefix and last four characters) is kept for display.
* **Config.** Non-secret settings per provider: default model, region, from address, publishable key, account id, statement descriptor.
* **Capabilities.** What the last verification discovered: available models, verified domains, account country, supported features.
* **Usage limits.** Optional guardrails set by the organization (monthly spend, requests per minute).
* **Default flag.** At most one default per organization, category and mode.
* **Branch.** Optional (§34): a branch may use its own account. Empty means the whole organization.
* **Health.** Last verified, last used, last error and when, expiry, last rotation, who connected it.

Several connections per provider are allowed: test and live, per branch, per country, per brand.

How the domain modules use it:

| Module | Domain row | Link |
| -- | -- | -- |
| 08 | `PaymentProviderConnection` (currencies, routing, priority, ledger payment method) | points at the Integration Connection for its credentials |
| 11 | `CommProviderAccount` (channel, sender domains and identities) | points at the Integration Connection for its credentials |
| AI | none | resolved by category (§159) |

The domain row keeps what is specific to the domain. **Credentials are never stored on the domain row.**

**Webhooks.** A provider that calls back gets a public, unguessable `webhook_token` and a callback URL `/webhooks/integrations/:token`. The token resolves the organization and the signing secret without exposing internal ids. Events are verified with the stored signing secret, deduplicated (08 `ProviderWebhookEvent`) and handed to the owning module.

**Usage.** The integration layer records daily usage per connection (requests, failures, provider units such as tokens or messages, estimated cost) for the usage view and for guardrails. Modules never write usage themselves.

---

# 158. Credential Security

<!-- schema-section:start -->
> **Schema:** `IntegrationConnection` ([integration_connections](../../api/prisma/schema.prisma#L1865))
<!-- schema-section:end -->

Credentials are the most sensitive data the platform holds for a tenant.

**Storage**

* All secret fields of a connection are stored as **one envelope-encrypted blob** under the organization's vault key (17 §12). The key material lives in the KMS or secret manager, only a reference is stored.
* The ciphertext is bound to its organization and connection (authenticated data), so a row copied to another tenant cannot be decrypted.
* Decryption happens only inside the integration layer, in memory, for the duration of one provider call. Secrets are never cached in plain text.

**Write-only**

* No endpoint, MCP tool, export, log line, error message, audit event, notification or AI prompt ever contains a secret or the ciphertext.
* The UI shows only the hint ("sk-...a3f9") and whether each field is set. To change a secret you replace it.
* Audit events record *that* a secret changed and which fields, never the values or hints.

**Who can do what**

* `organizations.integrations.read` shows connections, status, hints and usage. It never reveals a secret.
* `organizations.integrations.manage` (sensitive) connects, replaces secrets, edits limits, sets defaults, disables and disconnects.
* Connecting, replacing a secret and disconnecting require a recent MFA confirmation (re-authentication).
* **AI agents and API keys can read connection metadata but cannot connect, rotate or disconnect.** Those MCP tools are sensitive and need a human confirmation. No caller can read a secret through any channel.
* Branch-scoped administrators can manage only connections restricted to their branches (§34).

**Lifecycle**

* **Connect.** The secret is validated for format, then verified with a cheap read-only call to the provider. Only a successful verification makes the connection Active. A failure stores the sanitized provider error and keeps the connection Pending.
* **Replace (rotate).** The new secret is verified, then atomically replaces the old one, which is destroyed. The rotation time is recorded, and a reminder can be scheduled from an expiry date.
* **Disable.** Stops all use immediately and keeps the secret. This is the emergency switch if a key may have leaked.
* **Disconnect.** Destroys the ciphertext. Domain rows and history stay, but they stop working until another connection is chosen.
* **Failure.** A 401 or 403 from the provider marks the connection Error, stops retries (circuit breaker), and raises a security notification to administrators through 14.

**Audit** (events are listed in `api/src/shared/constants/audit-event-types.ts`): connected, updated, secret rotated, verified, verification failed, enabled, disabled, default changed, disconnected.

---

# 159. Resolving a Connection

<!-- schema-section:start -->
> **Schema:** `IntegrationConnection` ([integration_connections](../../api/prisma/schema.prisma#L1865)): `is_default`
<!-- schema-section:end -->

Modules never read a provider key. They ask the integration layer for a connection:

`resolveConnection(organization, category, { provider?, branch?, mode? })`

Resolution order:

1. Only Active connections of the organization.
2. The requested provider, when the feature needs a specific one (for example Stripe checkout).
3. A connection restricted to the caller's branch beats an organization-wide one.
4. Mode: live, or test for sandbox organizations and test-mode features.
5. The default connection of the category, then the lowest priority number where the domain defines routing (08).

**No connection means the feature says so.** The UI shows "Connect an AI provider in Admin → Integrations" and hides or disables the dependent actions. There is **no silent fallback to a platform key** (§160).

**Guardrails.** Usage limits are checked before the call. At 80% and 100% of a limit, administrators are notified. Over the limit, the feature degrades with a clear message instead of failing silently.

**Caching.** Only non-secret connection metadata is cached, and it is invalidated whenever a connection changes (same approach as §135).

---

# 160. Platform Environment and Fallback

<!-- schema-section:start -->
> **Schema:** `IntegrationConnection` ([integration_connections](../../api/prisma/schema.prisma#L1865)) · enum `IntegrationCredentialSource` ([L307](../../api/prisma/schema.prisma#L307))
<!-- schema-section:end -->

**Stays in the platform environment** (infrastructure of the platform itself, not of a tenant):

* Database, Redis, JWT settings, queue dashboard credentials, public URLs, CORS, the master key reference that wraps each organization's vault key.
* The platform's own storage bucket (storage provider `PLATFORM`) and the platform's system email (sign-up verification, password reset), used before any organization exists.

**Moves to per-organization connections:** `OPENAI_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`. Remove them from `.env` once the adapters read connections. `GOOGLE_MAPS_API_KEY` stays a platform key.

**Platform-provided credentials (optional).** A connection with credential source *Platform* uses a key from the platform environment. It is created only by Logiqdev staff for an organization (a plan that includes AI, a trial, local development). It is shown as "Included with your plan", its secret is never visible, its usage is billed to Logiqdev, and the organization can replace it with its own key at any time. By default no organization has one.

**Which email is used.** Messages the *organization* sends to its customers (campaigns, invoices, notifications, replies) use the organization's Email connection. Platform system emails use the platform provider.

**Local development.** A seed creates Platform-source connections that read `.env.staging`, so local flows work without typing keys (see `AGENTS.md`, "Local development").

---

# 161. Integrations Page (Admin)

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Admin → **Integrations** is the one place where an organization connects and manages provider credentials.

Layout:

* **Connected** list, grouped by category: provider, name, mode, status, key hint, default flag, branch, last verified, last used, usage over 30 days. Row actions: Test, Replace key, Disable or Enable, Set as default, Disconnect.
* **Available** catalog by category, with a Connect action per provider.
* **Connect form** generated from the provider registry: required secret fields as write-only inputs, config fields, mode, name, optional branch, optional usage limits, "make default for this category". "Test and save" verifies before activating.
* **Connection detail:** overview and health, credentials (hints and set/unset per field, Replace), configuration, webhook (callback URL, recent events), usage, and activity from the audit log.
* **Category defaults:** which connection each module will use and which modules depend on it, with a warning when a category has no Active connection but a module needs it.
* Links to tool integrations managed elsewhere (12 messaging and project tools).

Behavior:

* Errors show the sanitized provider message and when it happened, with a Test again action.
* Disconnecting asks for confirmation and lists the domain records that depend on the connection.
* Empty state for a new organization: a short checklist of the categories the enabled modules need.
* A small organization sees only the categories its enabled modules use.

---

# 162. Final Architectural Principle

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The Users, Members, Organizations, Branches & Permissions module should be the **central identity and authorization foundation** for the entire Agency Operating System.

Its most important structural rule is:

**Organization = isolated company / tenant**

**Branch = organizational unit inside that company**

**User = global human identity**

**Membership = user's relationship with a company**

**Team = functional collaboration group**

**Role = reusable permission bundle**

**Permission = specific capability**

**Scope = where that capability applies**

This allows the platform to work equally well for a 5-person agency and a multinational organization with hundreds of branches, thousands of Members, regional management, global teams, and complex permission boundaries.

The rest of the Agency OS should consume this model rather than recreating users, branches, roles, or permissions independently.
 **central identity and authorization foundation** for the entire Agency Operating System.

Its most important structural rule is:

**Organization = isolated company / tenant**

**Branch = organizational unit inside that company**

**User = global human identity**

**Membership = user's relationship with a company**

**Team = functional collaboration group**

**Role = reusable permission bundle**

**Permission = specific capability**

**Scope = where that capability applies**

This allows the platform to work equally well for a 5-person agency and a multinational organization with hundreds of branches, thousands of Members, regional management, global teams, and complex permission boundaries.

The rest of the Agency OS should consume this model rather than recreating users, branches, roles, or permissions independently.
