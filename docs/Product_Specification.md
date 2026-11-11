# Logiqdev OS — Product Specification

> Source of truth: Linear project [logiqdev-os](https://linear.app/logiqdev/project/logiqdev-os-27d58b62f801) (P-LOG-8, team Logiqdev). Detailed per-module specs live in [`docs/features/`](./features/).

## 1. Vision

A complete **AI-native Operating System for Software Agencies**. Agencies manage every part of their business from a single platform: project and task management, CRM, customer portal, billing, proposals and contracts, communication, HR, and AI-powered automation.

The platform should be a modern, scalable, AI-first system that helps software agencies run projects, clients, employees, billing, communications, and daily operations from one unified experience.

## 2. Core Capabilities

- **Linear-inspired project and task management.** Projects, milestones, tasks, subtasks, priorities, deadlines and assignments, with real-time progress tracking.
- **Customer portal.** Clients log in to see project status, progress, milestones and completed work. They can create requests, upload files, message the agency in a project thread, and access documents. They can also view and pay invoices, manage subscriptions, review payment history, and download invoices and quotations.
- **Stripe-driven finance.** One-time payments, recurring subscriptions, automatic invoicing, payment tracking and subscription management, with minimal manual financial administration.
- **AI proposal and quotation generator.** Branded PDF offers built from reusable templates, project information, pricing, timelines and requirements. Offers can be reviewed, edited, exported and sent directly to clients.
- **Communication module.** Individual and bulk email and SMS for project updates, payment reminders, campaigns and maintenance notices, using reusable templates and AI-generated content.
- **Employee management.** Employees, departments, vacations, sick leave, days off, internal notes, workload and project assignments.
- **Multi-user authentication and authorization.** Login, registration and role-based permissions with reusable role templates and customizable permissions per role (see §5).
- **AI throughout.** An assistant that creates project plans, organizes tasks, generates proposals, drafts emails, summarizes progress, answers questions from company data, produces reports, identifies risks and automates repetitive admin work.

## 3. Module Map

Modules are listed in recommended build order. Each links to its detailed spec.

| # | Module | Purpose | Spec |
|---|---|---|---|
| 1 | Users, Organizations & Permissions | Identity, tenancy, organizations, branches, teams, roles and access control. The foundation for all other modules. | [01](./features/01-users-organizations-permissions.md) |
| 2 | CRM & Sales | Leads, companies, contacts, deals, pipelines, forecasting, custom fields and the customer 360 view. | [02](./features/02-crm-sales-management.md) |
| 3 | Proposals & Quotations | AI-generated, branded offers with versions, review, PDF, customer approval and conversion to a project. | [03](./features/03-proposal-quotation-generator.md) |
| 4 | Contracts | Contract lifecycle: templates, versioning, approval, e-signature, amendments, renewals and obligations. | [04](./features/04-contracts.md) |
| 5 | Project Management | Operational delivery layer: workspaces, milestones, risks, change requests, health and reporting. | [05](./features/05-project-management.md) |
| 6 | Task Management | Linear-style tasks, subtasks, views, agile planning, workload and AI assistance. | [06](./features/06-task-management.md) |
| 7 | Customer Portal | Customer-facing surface: visibility, requests, deliverable approvals, documents and self-service finance. | [07](./features/07-customer-portal.md) |
| 8 | Financial Management & Stripe | Invoices, payments, subscriptions, quotes, taxes, dashboards and project billing. | [08](./features/08-financial-management-stripe-integration.md) |
| 9 | Income & Expense Management | Bookkeeping: income and expense records, OCR invoice intake, VAT, payroll costs, P&L and project profitability. | [09](./features/09-income-expense-management.md) |
| 10 | Employee Management | HR and workforce: profiles, leave, attendance, workload, performance and skills. | [10](./features/10-employee-management-system.md) |
| 11 | Communication Center | Email and SMS, campaigns, templates, segmentation, delivery tracking and automation. | [11](./features/11-communication-center.md) |
| 12 | Messaging & Team Communication | Slack-like channels, DMs, threads, project and customer channels, and record sharing. | [12](./features/12-messaging-team-communication.md) |
| 13 | Customer Support | Intercom-like support inbox and conversations, tickets, SLAs, AI support agent, customer knowledge base and ticket-to-task flow. Every customer request is a ticket here. | [13](./features/13-customer-support-communication-hub.md) |
| 14 | Notifications & Activity Center | The platform notification engine: event catalog, channels, preferences, inbox, digests. Modules only emit events. | [14](./features/14-notifications-activity-center.md) |
| 15 | Business Docs | Internal knowledge: wiki, onboarding and offboarding, project runbooks, custom forms, internal AI assistant. | [15](./features/15-notion-business-docs.md) |
| 16 | More Features (resolved) | Parking lot whose items moved to 17 §12, 02 §2a and 01 §79. No requirements live here. | [16](./features/16-more-features.md) |
| 17 | Documents & File Management | File storage, documents, versions, folders, attachments, sharing, retention and the secure credential vault. | [17](./features/17-documents-file-management.md) |
| 18 | Time Tracking | Time entries, timers, timesheets, billable classification, rates and utilization. | [18](./features/18-time-tracking.md) |
| 19 | Calendar | Events, meetings, availability, booking links, projected dates from other modules, external sync. | [19](./features/19-calendar.md) |
| 20 | Automation Engine | Event bus, rules (trigger, condition, action), scheduled jobs and run history for every module. | [20](./features/20-automation-engine.md) |

Modules 14 and 17–20 are **shared concepts**: they are depended on by most other modules and should be built early, alongside module 01. The central authorization service (01 §136) is built first of all: no other module ships endpoints before it exists.

## 4. Architecture Principles

These principles recur across the feature specs.

1. **Single source of truth per domain.** Modules reference each other's records instead of duplicating them. Each feature file opens with a "Canonical for / Depends on / Consumed by" block that states what it owns and what it references. Ownership summary:
   - 01 owns identity, Organizations, Branches, Teams, Members, roles, permissions, Customer Portal identity, branding and isolation.
   - 02 CRM owns Companies, Contacts, Leads, Deals, Activities, the Customer 360 view and the platform custom field model.
   - 03 Proposals owns proposals and quotations (the only "offer" or "quote" record).
   - 04 Contracts owns agreements and the e-signature provider abstraction.
   - 05 Projects owns delivery context: milestones, deliverables, workstreams, risks, project issues, project change requests, planned allocation.
   - 06 Task Management owns the only Task entity and Releases.
   - 07 Customer Portal owns the customer-facing surface only.
   - 08 Finance owns billing: invoices, payments, subscriptions, the products and services catalog, Stripe.
   - 09 Income & Expense owns the ledger: income and expense records, VAT, payroll expense, P&L, profitability.
   - 10 Employees owns HR data, compensation, availability and capacity.
   - 11 Communication Center owns outbound email/SMS and campaigns, and delivers notification email/SMS.
   - 12 Messaging owns internal conversations and project customer channels.
   - 13 Support owns support conversations, tickets and the customer knowledge base.
   - 14 Notifications owns the notification engine.
   - 15 Business Docs owns internal knowledge and forms.
   - 17 Documents owns files, documents, attachments and the credential vault.
   - 18 Time Tracking owns effort actuals and rates.
   - 19 Calendar owns events and availability.
   - 20 Automation Engine owns rules, scheduled jobs and the event bus.
2. **Core commercial flow.** `CRM Deal → Proposal → Contract (optional) → Project → Tasks / Time / Support / Finance`. A contract is optional per proposal type; a project can exist without a contract.
3. **Tenancy and isolation.** Organizations are isolated tenants, and branches are units inside one organization. Customer data isolation is enforced everywhere: a user with access to Customer A never automatically sees Customer B.
4. **Role-based permissions.** Granular, customizable permissions at organization, module, record and field level, with an audit trail for material actions.
5. **Customer visibility boundaries.** Internal notes, risks, finances and conversations are hidden from the portal unless explicitly shared.
6. **Immutability where it matters.** Signed contract versions, sent proposal versions and audit logs are never silently edited. Changes create new versions or amendments.
7. **Extensibility.** Custom fields (including shared fields), configurable statuses, pipelines, templates and automation rules, all without core code changes.
8. **API and webhooks.** Each module is a first-class API resource and emits webhooks with event IDs, signatures, retries and idempotency.
9. **AI-assisted but human-controlled.** AI drafts, classifies, summarizes and recommends. Output is editable and reviewable. Sensitive or high-impact actions need human approval and are logged.
10. **Real-time and notification-driven.** Live updates where useful, with a shared notification engine instead of per-module delivery systems.
11. **Every access channel, one permission model.** Each capability is reachable through the UI, the REST API, MCP tools, API keys, service accounts, webhooks and automation actions, and every channel is checked by the same central authorization service (01 §136) with the same permission keys. See §4a.

## 4a. Access Channels

A feature is complete only when every channel below exists for it and enforces the same permissions. Roles and permissions are designed with the feature, never added afterwards.

| Channel | Used by | Identity | Notes |
|---|---|---|---|
| UI | People | User with a Membership | Routes, navigation, buttons and fields gated by permission key. Hiding is not security. |
| REST API | The app, integrations | User token, API key or service account | One endpoint per resource action, each declaring its permission key. |
| MCP | AI assistants and agents | The caller's own identity: user, API key or service account | One tool per agent-useful action, a thin adapter over the same service. |
| API keys | Developers | Owned by a Membership or a service account | `scopes` can only narrow the owner's permissions, never widen them. Expiry, rotation, audit history (01 §75). |
| Service accounts | Automation, integrations, unattended agents | Non-human identity with explicit permissions, scope, owner and expiry (01 §76) | Not an employee. Audit actor type `SERVICE_ACCOUNT`. |
| Webhooks | External systems | Organization endpoint with signing secret | Event catalog and delivery owned by 20. |
| Automation actions | Rules and scheduled jobs | Run-as service account or membership | Same checks as a request. No bypass because no request exists. |
| Customer Portal | Customers | Customer Portal User with `portal.*` keys | Customer-visible records only. |

Rules for every channel:

1. **One decision point.** The central authorization service decides. No channel, module or tool reimplements permission logic.
2. **Same keys everywhere.** The permission key `<module>.<resource>.<action>` that guards the REST endpoint also guards the UI control, the MCP tool and the automation action.
3. **MCP tools mirror permission keys.** Name a tool `<module>_<resource>_<action>` (for example `tasks_tasks_update`). A tool reuses the service layer and the same validation schemas, and is listed only to callers who hold its permission. Tools for sensitive or destructive actions require human confirmation or an approval step when an AI agent calls them (principle 9).
4. **Organization context comes from the credential.** No tool or endpoint takes the organization id as a caller-supplied parameter.
5. **Least privilege for non-human identities.** API keys and service accounts get explicit permission keys and scope. They never inherit a human's full access.
6. **Audit every write** from every channel in `audit_events`, with the actor type and, in the event metadata, the channel (`ui`, `api`, `mcp`, `automation`) and the credential id.
7. **Limits per credential.** Rate limits and quotas apply per API key and service account.

## 5. User Roles

Roles are reusable permission bundles defined in [01](./features/01-users-organizations-permissions.md) §44–45 and §111. Default internal role templates: Owner, Admin, Manager, Project Manager, Sales Manager, Finance Manager, Support Agent, Developer, Employee, Viewer, External Collaborator. Organizations clone and customize them (for example Marketing, Accountant). Customer roles (01 §79): Owner, Administrator, Manager, Finance, Legal, Viewer. A "Customer" is never an internal role; customers are Customer Portal Users.

## 5a. Terminology

Canonical terms for all specs, Linear issues and code. Synonyms in the right column are not used.

| Term | Meaning | Owner | Not to be confused with |
|---|---|---|---|
| Organization | The tenant: an agency using the platform. | 01 | A CRM company. Never "organization" for a customer. |
| Branch | An office or unit inside an Organization. | 01 | CRM parent/child companies. |
| Team, Department | Functional groups of Members. | 01 | "Workspace" (not a platform concept). |
| User | Global identity with login. | 01 | Member, Employee. |
| Member | A User's membership in an Organization. Any internal platform person. | 01 | "agency user", "team member", "internal user". |
| Employee | HR record for a person. A contractor can be a Member without being an Employee. | 10 | Member. |
| Customer Portal User | A User whose membership is to a Customer, not the Organization. | 01 §79 | Member. |
| External Collaborator, Guest | Limited non-member access. | 01 §77–78 | Customer Portal User. |
| Company | A CRM record for any external legal entity (prospect, customer, partner, vendor). | 02 | Organization. |
| Contact | A person at a Company. | 02 | User. |
| Customer | A Company with a commercial relationship (lifecycle stage Customer or later). Preferred over "client". | 02 | — |
| Lead, Deal, Pipeline, Activity | Sales records. | 02 | Task (a CRM follow-up is a Task). |
| Proposal | The commercial offer, with versions and acceptance. | 03 | "Offer", "Quote", "Quotation", "Estimate" (synonyms, not records). |
| Contract, Amendment, Renewal | Legal agreements. | 04 | Proposal. |
| Contract Change Request | A request to change contract language. | 04 §26 | Project Change Request. |
| Project, Workstream, Milestone, Deliverable | Delivery structure. | 05 | Release (06). |
| Project Issue, Risk, Blocker, Decision | Delivery problems and records. | 05 | Task, Ticket. |
| Project Change Request | A change to delivery scope, timeline or cost. | 05 §45 | Contract Change Request. |
| Task, Subtask | The only work item entity. The UI may say "Issue". | 06 | Project Issue, Ticket. |
| Release | A shippable set of Tasks. | 06 | Milestone. |
| Ticket | A support case. | 13 | Task. |
| Customer Request | Anything a customer submits in the portal; always a Ticket. | 13 | Task. |
| Conversation (support) | A customer-agency support thread. | 13 | Channel. |
| Channel, Thread, Direct Message | Internal messaging primitives; project customer channels included. | 12 | Support conversation. |
| Communication | Outbound email or SMS, individual or campaign. | 11 | Notification, Message. |
| Notification, Event | Engine output and its input. | 14 | Communication. |
| Document, File, Version, Attachment | Stored content. | 17 | Business Docs page. |
| Page, Form | Internal knowledge content. | 15 | Document, knowledge base article (13). |
| Knowledge Base article | Customer-facing help content. | 13 §6 | Page (15). |
| Time Entry, Timesheet | Effort actuals. | 18 | Attendance (10). |
| Event (calendar) | A scheduled item. | 19 | Event (14 notification input). Use "calendar event" when ambiguous. |
| Rule, Trigger, Action, Run | Automation primitives. | 20 | — |

## 6. Integrations

- **Payments:** Stripe.
- **Email and SMS:** providers behind the Communication Center. Local API development uses `.env.staging` for working keys.
- **E-signature:** provider abstraction (for example DocuSign, Dropbox Sign, Adobe Acrobat Sign).
- **AI:** one shared AI integration layer used by every module (drafting, classification, extraction, retrieval over 15 Business Docs and 13 knowledge base, automation AI steps). Models are configurable per capability behind the layer; Support (13) specifies the JEV model from Typesafe AI for classification and the support agent.
- **Calendar sync:** Google Calendar, Microsoft 365 (19).
- **Storage providers:** Google Drive, Microsoft 365, S3-compatible behind the storage abstraction (17).
- **External tools (project and messaging):** GitHub, GitLab, Jira, Linear, Notion, Google Drive, Microsoft 365.

## 7. Status

All feature issues are in **Backlog**; no module has started. LOG-402 is Canceled (items distributed). The Linear project is the authority for status. This document and `docs/features/` were consolidated on 2026-11-10: each feature now has one canonical file and Linear issue, and other files reference it instead of duplicating it.

## 8. Resolved Decisions (2026-11-10)

- **Shared concepts promoted to modules:** Documents & File Management (17, LOG-407), Time Tracking (18, LOG-408), Calendar (19, LOG-409), Automation Engine (20, LOG-410). Notifications (14, LOG-403) was expanded from a note into the canonical engine spec.
- **Proposals vs Finance quotes:** one record, owned by 03. Finance provides the catalog and creates invoices and subscriptions on acceptance.
- **Notifications:** 14 owns the engine. 11 is the email/SMS delivery provider. 12 and 13 only emit events.
- **Customer conversations:** 13 owns support conversations, live chat, inbound email and every customer request (always a Ticket). 12 owns internal chat and project customer channels. 07 surfaces both.
- **CRM tasks:** CRM follow-ups are Tasks owned by 06, linked to CRM records.
- **Compensation:** owned by 10; 09 records only the resulting expenses.
- **Credential vault:** owned by 17 §12, replacing the per-project encrypted storage in 06 and the "password manager" note in 16.
- **Terminology:** fixed in §5a. "Customer" replaces "client"; "Proposal" replaces "offer" and "quote"; "Organization" is only the tenant.
- **LOG-402** cancelled after its items moved to 17, 02 and 01. **LOG-341** now has a full spec (15).

## 9. Reference Conventions

Each feature file opens with a block stating what it is canonical for, what it depends on and who consumes it. Inside a file, a section that belongs to another module is reduced to the module-specific part plus:

```text
> Defined by → docs/features/<file>.md §<section> · Linear LOG-<id>
```

Linear issue descriptions carry the same "Canonical for / Depends on / Consumed by" block and use "blocked by" for hard dependencies and "related" for integrations.
