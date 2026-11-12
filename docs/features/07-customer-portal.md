# Customer Portal

> Linear: [LOG-103](https://linear.app/logiqdev/issue/LOG-103/customer-portal) · Status: Backlog

> **Canonical for:** the customer-facing surface of the Agency OS: what a Customer Portal user can see and do, portal navigation, dashboard, customer-visible fields and actions, portal branding, portal-specific AI and the embedded widget. The portal **does not own** identity, projects, tasks, tickets, documents, invoices or conversations. Each section below names the owning module.
>
> **Depends on:** [01](./01-users-organizations-permissions.md) §79 (LOG-406) for Customer Portal Users, customer roles, permissions and authentication · [02 CRM](./02-crm-sales-management.md) (LOG-404) for the Customer (Company) and Contacts · [03 Proposals](./03-proposal-quotation-generator.md) (LOG-303) · [04 Contracts](./04-contracts.md) (LOG-349) · [05 Projects](./05-project-management.md) (LOG-405) · [06 Tasks](./06-task-management.md) (LOG-102) · [08 Finance](./08-financial-management-stripe-integration.md) (LOG-104) · [12 Messaging](./12-messaging-team-communication.md) (LOG-313) · [13 Support](./13-customer-support-communication-hub.md) (LOG-342) · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) · [17 Documents](./17-documents-file-management.md) (LOG-407) · [19 Calendar](./19-calendar.md) (LOG-409).
>
> **Consumed by:** every module that marks a record customer-visible.

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (3)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| `CustomerPortalSettings` | `customer_portal_settings` | [L7159](../../api/prisma/schema.prisma#L7159) | 07 §14, §18 — portal branding, white-label and feature toggles per organization. |
| `CustomerPortalClientSettings` | `customer_portal_client_settings` | [L7185](../../api/prisma/schema.prisma#L7185) | 07 §2, §14 — per-client (CRM Company) portal switch and overrides on top of CustomerPortalSettings. No row = the organization defaults apply. null columns in… |
| `CustomerPortalProfileChangeRequest` | `customer_portal_profile_change_requests` | [L7217](../../api/prisma/schema.prisma#L7217) | 07 §2 — a customer portal user edits company information or contact details; the write goes to the CRM Company/Contact (02) subject to the agency approval po… |

**Owned enums (1):** `PortalProfileChangeStatus`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `CustomerPortalClientSettings.organization`, `CustomerPortalProfileChangeRequest.organization`, `CustomerPortalSettings.organization` |
| [01](./01-users-organizations-permissions.md) | `User` (`users`) | `CustomerPortalProfileChangeRequest.requested_by` |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `CustomerPortalClientSettings.company`, `CustomerPortalProfileChangeRequest.company` |
| [02](./02-crm-sales-management.md) | `CrmContact` (`crm_contacts`) | `CustomerPortalProfileChangeRequest.contact` |

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `Organization`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `OrganizationDomain.dns_check` ([01](./01-users-organizations-permissions.md), [L969](../../api/prisma/schema.prisma#L969)) — 07 §14 — last DNS check per record, e.g. { txt: { ok, expected, found }, cname: { ok, expected, found } }.
- `Invitation.customer_id` ([01](./01-users-organizations-permissions.md), [L1998](../../api/prisma/schema.prisma#L1998)) — 01 §79, 07 §2 — CRM Company (02) the invitee joins as a Customer Portal user; set instead of branch_id/team_id.
- `Invitation.last_sent_at` ([01](./01-users-organizations-permissions.md), [L1998](../../api/prisma/schema.prisma#L1998)) — 01 §66, 07 §2 — reminder tracking: last time the invitation email was (re)sent and how many times in total.
- `ProjectDeliverable.acceptance_record` ([05](./05-project-management.md), [L6099](../../api/prisma/schema.prisma#L6099)) — Customer acceptance evidence: portal user id, contact id, comment (07 §7).
- `ProjectDeliverable.approval_mode` ([05](./05-project-management.md), [L6099](../../api/prisma/schema.prisma#L6099)) — 07 §7 — ANY_ONE: one required approver is enough; ALL: every required ProjectDeliverableApprover must approve. No approvers = any portal user with portal.del…
- `Task.customer_visible` ([06](./06-task-management.md), [L6825](../../api/prisma/schema.prisma#L6825)) — Visible in the Customer Portal (05 §60, 07 §4).
- `Release.notes` ([06](./06-task-management.md), [L7095](../../api/prisma/schema.prisma#L7095)) — Release notes (markdown), publishable to the portal (07) and knowledge base (13 §6).
- `Invoice.hosted_invoice_url` ([08](./08-financial-management-stripe-integration.md), [L7636](../../api/prisma/schema.prisma#L7636)) — Payment page for the customer: the provider's hosted page or the portal (07) pay link.
- `WikiPage.customer_visible` ([15](./15-notion-business-docs.md), [L17051](../../api/prisma/schema.prisma#L17051)) — 15 §4 — exposed through the Customer Portal (07) / help center (13 §6). Audited (15 §9).
- `DocumentSettings.portal_upload_enabled` ([17](./17-documents-file-management.md), [L18128](../../api/prisma/schema.prisma#L18128)) — 17 §5 — Customer Portal uploads into permitted folders, projects, tickets, conversations (07 §9).
- `Folder.customer_visible` ([17](./17-documents-file-management.md), [L18297](../../api/prisma/schema.prisma#L18297)) — Visible in the Customer Portal (07 §9); customers may upload here when portal_upload_allowed.
- `Document.uploaded_via_portal` ([17](./17-documents-file-management.md), [L18372](../../api/prisma/schema.prisma#L18372)) — 17 §5 — uploaded through the Customer Portal (07 §9).
- `Document.customer_visible` ([17](./17-documents-file-management.md), [L18372](../../api/prisma/schema.prisma#L18372)) — Visible in the Customer Portal documents section (07 §9) in addition to explicit shares.
- `DocumentApprover.portal_user_id` ([17](./17-documents-file-management.md), [L18859](../../api/prisma/schema.prisma#L18859)) — Customer Portal user (07 §7).

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 20 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `portal.activity` | read |
| `portal.contracts` | read, sign* |
| `portal.conversations` | participate |
| `portal.deliverables` | approve |
| `portal.documents` | read, upload |
| `portal.invoices` | read, pay* |
| `portal.preview` | use |
| `portal.profile_changes` | review* |
| `portal.projects` | read |
| `portal.proposals` | read, accept* |
| `portal.requests` | create, read |
| `portal.settings` | manage |
| `portal.subscriptions` | manage* |
| `portal.users` | manage*, read |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Purpose

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Develop a modern, secure Customer Portal that gives customers complete visibility into their engagement with the agency and lets them collaborate without email chains or manual status updates: monitor progress, review and approve deliverables, submit requests, access documents, sign proposals and contracts, and manage billing.

### Visibility principle

A record appears in the portal only when its owning module marks it customer-visible (`docs/Product_Specification.md` §4.5). Internal notes, risks, private financial data, internal conversations and employee information are never exposed. Every portal read re-evaluates permissions through the central authorization service (01 §136).

## 2. Identity, Access & Customer Roles

<!-- schema-section:start -->
> **Schema:** `CustomerPortalClientSettings` ([customer_portal_client_settings](../../api/prisma/schema.prisma#L7185)) · `CustomerPortalProfileChangeRequest` ([customer_portal_profile_change_requests](../../api/prisma/schema.prisma#L7217)) · `CustomerPortalSettings` ([customer_portal_settings](../../api/prisma/schema.prisma#L7159)): `profile_changes_require_approval` · enum `PortalProfileChangeStatus` ([L7208](../../api/prisma/schema.prisma#L7208)) — other modules: `CustomerPortalMembershipProject` ([customer_portal_membership_projects](../../api/prisma/schema.prisma#L2289)) ([01](./01-users-organizations-permissions.md)) · `Invitation` ([invitations](../../api/prisma/schema.prisma#L1998)): `customer_id`, `last_sent_at` ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

> Defined by → [01](./01-users-organizations-permissions.md) §79 · Linear LOG-406.

Customer Portal Users, customer roles (Owner, Administrator, Manager, Finance, Legal, Viewer), permissions, authentication methods, SSO, MFA and invitations are defined in 01. The portal provides:

* Login, registration by invitation, password and MFA self-service
* Customer profile: company information and contact details (writes go to the Customer record in 02, subject to agency approval policy)
* User management for customer Owners and Administrators: invite users, assign customer roles, deactivate users
* Notification preferences (14 §6)
* Language and time zone preferences (01 §127)

> **Schema note:** `CustomerPortalClientSettings` (per CRM Company) switches the portal on or off for one client and overrides features, default role, welcome message and branding (no row or null = organization defaults). `CustomerPortalMembershipProject` limits a portal user to specific customer-visible projects (no rows = all). Invitations track `last_sent_at` / `send_count`.

## 3. Dashboard

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Personalized dashboard showing:

* Active and completed projects with health and progress (05)
* Upcoming milestones and deadlines (05, 19)
* Pending approvals: deliverables (05 §47), proposals (03), contracts (04), documents (17 §10)
* Open tickets and recent replies (13)
* Outstanding invoices, upcoming renewals, active subscriptions (08)
* Latest messages in customer channels (12)
* Recent documents (17)
* Agency team members assigned to the customer's projects (05 §8, limited to name, role and photo)

## 4. Projects

<!-- schema-section:start -->
> **Schema:** other modules: `CustomerPortalMembershipProject` ([customer_portal_membership_projects](../../api/prisma/schema.prisma#L2289)) ([01](./01-users-organizations-permissions.md)) · `DocumentApproval` ([document_approvals](../../api/prisma/schema.prisma#L18822)) ([17](./17-documents-file-management.md)) · `ProjectStatusUpdate` ([project_status_updates](../../api/prisma/schema.prisma#L6277)) ([05](./05-project-management.md)) · `ProjectStatusUpdateComment` ([project_status_update_comments](../../api/prisma/schema.prisma#L6630)) ([05](./05-project-management.md)) · `Task` ([tasks](../../api/prisma/schema.prisma#L6825)): `customer_visible` ([06](./06-task-management.md))
<!-- schema-section:end -->

> Defined by → [05 Project Management](./05-project-management.md) §60 · Linear LOG-405.

For each customer-visible project the portal shows: summary, status, progress, milestones, roadmap and timeline, customer-visible deliverables, customer-visible tasks (06), published status updates (05 §39), customer-visible change requests (05 §45), customer deadlines and the assigned agency team.

Customers can: comment on status updates, approve or request revisions on deliverables (05 §47 acceptance criteria), and approve change requests where the agency routes approval to them.

## 5. Requests

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [13 Customer Support](./13-customer-support-communication-hub.md) §2, §4, §5 · Linear LOG-342.

Every customer-originated request (feature request, bug report, change request, question, support request) is a **Ticket** in 13. Customers never create Tasks directly. The agency converts a ticket into a Task (06) or a Project Change Request (05 §45) with a permanent link, and the ticket shows the resulting status to the customer.

Portal capabilities:

* Create a request with type, priority, description, attachments (17) and related project
* Track status, history and linked work outcome
* Reply and comment on a request
* Edit a request while it is unassigned
* View the knowledge base and FAQs (13 §6)
* Receive notifications on request changes (14)

Live chat and the embedded messaging widget are the Support channels of 13 §1 surfaced inside the portal.

## 6. Project Communication

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [12 Messaging](./12-messaging-team-communication.md) §26–28 · Linear LOG-313.

The portal exposes the customer channel of each project (12 §27) as the project conversation: threads, rich text, attachments, mentions, read state and search. Internal messages and internal channels are never visible (12 §28). Support conversations (13) remain separate from project channels; both link to the same customer record.

## 7. Deliverables & Approvals

<!-- schema-section:start -->
> **Schema:** other modules: `DocumentApproval` ([document_approvals](../../api/prisma/schema.prisma#L18822)) ([17](./17-documents-file-management.md)) · `DocumentApprover` ([document_approvers](../../api/prisma/schema.prisma#L18859)): `portal_user_id` ([17](./17-documents-file-management.md)) · `ProjectDeliverable` ([project_deliverables](../../api/prisma/schema.prisma#L6099)): `acceptance_record` ([05](./05-project-management.md)) · `ProjectDeliverableApprover` ([project_deliverable_approvers](../../api/prisma/schema.prisma#L6609)) ([05](./05-project-management.md)) · `ProjectDeliverableReview` ([project_deliverable_reviews](../../api/prisma/schema.prisma#L6584)) ([05](./05-project-management.md)) · enum `DeliverableApprovalMode` ([L6093](../../api/prisma/schema.prisma#L6093)) ([05](./05-project-management.md)) · enum `DeliverableStatus` ([L5531](../../api/prisma/schema.prisma#L5531)) ([05](./05-project-management.md)) · enum `DocumentApproverKind` ([L18037](../../api/prisma/schema.prisma#L18037)) ([17](./17-documents-file-management.md))
<!-- schema-section:end -->

> Defined by → [05 Projects](./05-project-management.md) §18, §46–47 and [17 Documents](./17-documents-file-management.md) §10.

Customers can access customer-visible deliverables, design assets, source files when applicable, documentation and release notes (06 §9), and can approve, request revisions, reject with comments and view approval history. Acceptance records are stored in 05; document approval state in 17.

> **Schema note:** `ProjectDeliverableApprover` lists the customer users who must approve a deliverable and `ProjectDeliverable.approval_mode` (ANY_ONE or ALL) says how many; with no approvers any user holding `portal.deliverables.approve` may decide. Accepting on the customer's behalf needs `projects.deliverables.accept_on_behalf` (sensitive).

## 8. Proposals & Contracts

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [03 Proposals](./03-proposal-quotation-generator.md) and [04 Contracts](./04-contracts.md) §61.

Customers can view, download, comment on, accept, reject, request changes to and sign proposals (03 "Customer Approval") and review, comment on and sign contracts, amendments and renewals (04 §36, §61). The signing experience is provided by the signature provider abstraction (04 §33).

## 9. Documents

<!-- schema-section:start -->
> **Schema:** other modules: `Document` ([documents](../../api/prisma/schema.prisma#L18372)): `customer_visible`, `uploaded_via_portal` ([17](./17-documents-file-management.md)) · `DocumentSettings` ([document_settings](../../api/prisma/schema.prisma#L18128)): `portal_upload_enabled` ([17](./17-documents-file-management.md)) · `Folder` ([folders](../../api/prisma/schema.prisma#L18297)): `customer_visible` ([17](./17-documents-file-management.md))
<!-- schema-section:end -->

> Defined by → [17 Documents & File Management](./17-documents-file-management.md) · Linear LOG-407.

The portal shows every Document shared with the customer or scoped to a customer-visible project: proposals, contracts, statements of work, specifications, meeting notes, release notes, manuals and exports. Customers can upload files into permitted project folders, tickets and conversations (17 §5). Categorization, versioning, preview, download and search are 17 features. Customer-scoped vault entries may be shown when enabled (17 §12).

## 10. Billing

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [08 Finance](./08-financial-management-stripe-integration.md) "Customer Self-Service" · Linear LOG-104.

The portal surfaces: invoices and status, online payment, payment history and receipts, outstanding balances, payment methods, subscriptions (view, upgrade, downgrade, cancel per policy), upcoming renewals and billing history. Rules, statuses and payment provider behavior are owned by 08. When the organization has more than one payment provider connected, the portal lets the customer choose between the ones that accept the invoice (08 "Payment Providers"). Accepted proposals (03) appear in billing history as the origin of invoices and subscriptions.

## 11. Calendar

<!-- schema-section:start -->
> **Schema:** other modules: `BookingLink` ([booking_links](../../api/prisma/schema.prisma#L20623)) ([19](./19-calendar.md)) · enum `CalendarEventVisibility` ([L19965](../../api/prisma/schema.prisma#L19965)) ([19](./19-calendar.md))
<!-- schema-section:end -->

> Defined by → [19 Calendar](./19-calendar.md) §8.

Customer-visible meetings, approval deadlines and milestone dates appear in a portal calendar. Customers can respond to invitations and use booking links.

## 12. Notifications

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [14 Notifications & Activity Center](./14-notifications-activity-center.md) §3, §7.

The portal has a customer-scoped inbox and the customer channels in-app, email and SMS (opt-in). Events include new messages, milestone completion, deliverable uploads, status updates, request updates, approval requests, invoice creation, payment confirmation and subscription renewal. Customers never receive internal-only events.

## 13. Search

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Global portal search across projects, messages, documents, tasks, requests, deliverables, invoices and contracts. Each module's search is reused and every result is permission-checked (01 §140, 12 §86).

## 14. Branding & White-Label

<!-- schema-section:start -->
> **Schema:** `CustomerPortalClientSettings` ([customer_portal_client_settings](../../api/prisma/schema.prisma#L7185)) · `CustomerPortalSettings` ([customer_portal_settings](../../api/prisma/schema.prisma#L7159)) — other modules: `OrganizationDomain` ([organization_domains](../../api/prisma/schema.prisma#L969)): `dns_check` ([01](./01-users-organizations-permissions.md)) · enum `DomainTlsStatus` ([L930](../../api/prisma/schema.prisma#L930)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

> Defined by → [01](./01-users-organizations-permissions.md) §15.

The portal consumes organization branding: logo, colors, favicon, email branding and optional custom domain. Branch-level branding may apply when the customer belongs to a branch (01 §120).

> **Schema note:** `OrganizationDomain` also stores the custom-domain DNS check result (`dns_check`), certificate state (`tls_status`, `tls_expires_at`) and `last_checked_at`.

## 15. AI Features

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Portal AI, running on the shared AI layer with customer-scoped data only:

* Summarize project progress and explain completed work in non-technical language
* Answer questions about project, request and invoice status
* Summarize conversations
* Explain upcoming milestones
* Draft requests from a description
* Find documents and information
* Translate updates into the customer's language

AI never reveals internal-only data; it queries through the same permission layer as the UI.

## 16. Permissions

<!-- schema-section:start -->
> **Schema:** other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1662)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Customer permissions are catalog entries under the `portal.*` namespace (01 §46), for example `portal.projects.read`, `portal.deliverables.approve`, `portal.invoices.pay`, `portal.contracts.sign`, `portal.users.manage`. Customer roles bundle them (01 §79).

> **Schema note:** agency-side keys `portal.users.read`, `portal.activity.read`, `portal.profile_changes.review` (sensitive) and `portal.preview.use` complement `portal.users.manage` and `portal.settings.manage`; the Customer Owner role does not receive the review, preview or activity keys.

## 17. Audit

<!-- schema-section:start -->
> **Schema:** other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L2319)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Audit login, approvals, signatures, payments, document downloads of sensitive categories and user management actions by customer users.

## 18. API

<!-- schema-section:start -->
> **Schema:** `CustomerPortalSettings` ([customer_portal_settings](../../api/prisma/schema.prisma#L7159))
<!-- schema-section:end -->

The portal uses the same APIs as the internal application with the Customer Portal identity. An embeddable widget (support chat and request form) is provided for customer websites and apps (13 §5).

## 19. Recommended MVP

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Identity and roles from 01 §79
* Dashboard
* Projects with milestones, status updates and deliverable approvals
* Requests via 13
* Documents via 17
* Proposals view and acceptance via 03
* Billing via 08
* Notifications via 14

## 20. Phase 2

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Project channels via 12
* Contract signing via 04
* Calendar and booking
* White-label domains
* Vault access
* Portal AI assistant
