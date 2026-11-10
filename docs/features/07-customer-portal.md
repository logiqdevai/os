# Customer Portal

> Linear: [LOG-103](https://linear.app/logiqdev/issue/LOG-103/customer-portal) · Status: Backlog

> **Canonical for:** the customer-facing surface of the Agency OS: what a Customer Portal user can see and do, portal navigation, dashboard, customer-visible fields and actions, portal branding, portal-specific AI and the embedded widget. The portal **does not own** identity, projects, tasks, tickets, documents, invoices or conversations. Each section below names the owning module.
>
> **Depends on:** [01](./01-users-organizations-permissions.md) §79 (LOG-406) for Customer Portal Users, customer roles, permissions and authentication · [02 CRM](./02-crm-sales-management.md) (LOG-404) for the Customer (Company) and Contacts · [03 Proposals](./03-proposal-quotation-generator.md) (LOG-303) · [04 Contracts](./04-contracts.md) (LOG-349) · [05 Projects](./05-project-management.md) (LOG-405) · [06 Tasks](./06-task-management.md) (LOG-102) · [08 Finance](./08-financial-management-stripe-integration.md) (LOG-104) · [12 Messaging](./12-messaging-team-communication.md) (LOG-313) · [13 Support](./13-customer-support-communication-hub.md) (LOG-342) · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) · [17 Documents](./17-documents-file-management.md) (LOG-407) · [19 Calendar](./19-calendar.md) (LOG-409).
>
> **Consumed by:** every module that marks a record customer-visible.

## 1. Purpose

Develop a modern, secure Customer Portal that gives customers complete visibility into their engagement with the agency and lets them collaborate without email chains or manual status updates: monitor progress, review and approve deliverables, submit requests, access documents, sign proposals and contracts, and manage billing.

### Visibility principle

A record appears in the portal only when its owning module marks it customer-visible (`docs/Product_Specification.md` §4.5). Internal notes, risks, private financial data, internal conversations and employee information are never exposed. Every portal read re-evaluates permissions through the central authorization service (01 §136).

## 2. Identity, Access & Customer Roles

> Defined by → [01](./01-users-organizations-permissions.md) §79 · Linear LOG-406.

Customer Portal Users, customer roles (Owner, Administrator, Manager, Finance, Legal, Viewer), permissions, authentication methods, SSO, MFA and invitations are defined in 01. The portal provides:

* Login, registration by invitation, password and MFA self-service
* Customer profile: company information and contact details (writes go to the Customer record in 02, subject to agency approval policy)
* User management for customer Owners and Administrators: invite users, assign customer roles, deactivate users
* Notification preferences (14 §6)
* Language and time zone preferences (01 §127)

## 3. Dashboard

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

> Defined by → [05 Project Management](./05-project-management.md) §60 · Linear LOG-405.

For each customer-visible project the portal shows: summary, status, progress, milestones, roadmap and timeline, customer-visible deliverables, customer-visible tasks (06), published status updates (05 §39), customer-visible change requests (05 §45), customer deadlines and the assigned agency team.

Customers can: comment on status updates, approve or request revisions on deliverables (05 §47 acceptance criteria), and approve change requests where the agency routes approval to them.

## 5. Requests

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

> Defined by → [12 Messaging](./12-messaging-team-communication.md) §26–28 · Linear LOG-313.

The portal exposes the customer channel of each project (12 §27) as the project conversation: threads, rich text, attachments, mentions, read state and search. Internal messages and internal channels are never visible (12 §28). Support conversations (13) remain separate from project channels; both link to the same customer record.

## 7. Deliverables & Approvals

> Defined by → [05 Projects](./05-project-management.md) §18, §46–47 and [17 Documents](./17-documents-file-management.md) §10.

Customers can access customer-visible deliverables, design assets, source files when applicable, documentation and release notes (06 §9), and can approve, request revisions, reject with comments and view approval history. Acceptance records are stored in 05; document approval state in 17.

## 8. Proposals & Contracts

> Defined by → [03 Proposals](./03-proposal-quotation-generator.md) and [04 Contracts](./04-contracts.md) §61.

Customers can view, download, comment on, accept, reject, request changes to and sign proposals (03 "Customer Approval") and review, comment on and sign contracts, amendments and renewals (04 §36, §61). The signing experience is provided by the signature provider abstraction (04 §33).

## 9. Documents

> Defined by → [17 Documents & File Management](./17-documents-file-management.md) · Linear LOG-407.

The portal shows every Document shared with the customer or scoped to a customer-visible project: proposals, contracts, statements of work, specifications, meeting notes, release notes, manuals and exports. Customers can upload files into permitted project folders, tickets and conversations (17 §5). Categorization, versioning, preview, download and search are 17 features. Customer-scoped vault entries may be shown when enabled (17 §12).

## 10. Billing

> Defined by → [08 Finance](./08-financial-management-stripe-integration.md) "Customer Self-Service" · Linear LOG-104.

The portal surfaces: invoices and status, online payment, payment history and receipts, outstanding balances, payment methods, subscriptions (view, upgrade, downgrade, cancel per policy), upcoming renewals and billing history. Rules, statuses and Stripe behavior are owned by 08. Accepted proposals (03) appear in billing history as the origin of invoices and subscriptions.

## 11. Calendar

> Defined by → [19 Calendar](./19-calendar.md) §8.

Customer-visible meetings, approval deadlines and milestone dates appear in a portal calendar. Customers can respond to invitations and use booking links.

## 12. Notifications

> Defined by → [14 Notifications & Activity Center](./14-notifications-activity-center.md) §3, §7.

The portal has a customer-scoped inbox and the customer channels in-app, email and SMS (opt-in). Events include new messages, milestone completion, deliverable uploads, status updates, request updates, approval requests, invoice creation, payment confirmation and subscription renewal. Customers never receive internal-only events.

## 13. Search

Global portal search across projects, messages, documents, tasks, requests, deliverables, invoices and contracts. Each module's search is reused and every result is permission-checked (01 §140, 12 §86).

## 14. Branding & White-Label

> Defined by → [01](./01-users-organizations-permissions.md) §15.

The portal consumes organization branding: logo, colors, favicon, email branding and optional custom domain. Branch-level branding may apply when the customer belongs to a branch (01 §120).

## 15. AI Features

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

Customer permissions are catalog entries under the `portal.*` namespace (01 §46), for example `portal.projects.read`, `portal.deliverables.approve`, `portal.invoices.pay`, `portal.contracts.sign`, `portal.users.manage`. Customer roles bundle them (01 §79).

## 17. Audit

Audit login, approvals, signatures, payments, document downloads of sensitive categories and user management actions by customer users.

## 18. API

The portal uses the same APIs as the internal application with the Customer Portal identity. An embeddable widget (support chat and request form) is provided for customer websites and apps (13 §5).

## 19. Recommended MVP

* Identity and roles from 01 §79
* Dashboard
* Projects with milestones, status updates and deliverable approvals
* Requests via 13
* Documents via 17
* Proposals view and acceptance via 03
* Billing via 08
* Notifications via 14

## 20. Phase 2

* Project channels via 12
* Contract signing via 04
* Calendar and booking
* White-label domains
* Vault access
* Portal AI assistant
