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
- **Multi-user authentication and authorization.** Login, registration and role-based permissions. Roles include Manager, Project Manager, Developer, Marketing, Sales, Support, Accountant and Customer, with customizable permissions per role.
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
| 7 | Customer Portal | Client-facing visibility, requests, deliverable approvals, documents and self-service finance. | [07](./features/07-customer-portal.md) |
| 8 | Financial Management & Stripe | Invoices, payments, subscriptions, quotes, taxes, dashboards and project billing. | [08](./features/08-financial-management-stripe-integration.md) |
| 9 | Income & Expense Management | Bookkeeping: income and expense records, OCR invoice intake, VAT, payroll costs, P&L and project profitability. | [09](./features/09-income-expense-management.md) |
| 10 | Employee Management | HR and workforce: profiles, leave, attendance, workload, performance and skills. | [10](./features/10-employee-management-system.md) |
| 11 | Communication Center | Email and SMS, campaigns, templates, segmentation, delivery tracking and automation. | [11](./features/11-communication-center.md) |
| 12 | Messaging & Team Communication | Slack-like channels, DMs, threads, project and customer channels, and record sharing. | [12](./features/12-messaging-team-communication.md) |
| 13 | Customer Support Hub | Intercom-like inbox, tickets, SLAs, AI support agent, knowledge base and ticket-to-task flow. | [13](./features/13-customer-support-communication-hub.md) |
| 14 | Notifications & Activity Center | Centralized notifications across tasks, payments, tickets, contracts and approvals. | [14](./features/14-notifications-activity-center.md) |
| 15 | Business Docs | Internal AI knowledge, onboarding and offboarding docs, help center and custom forms. | [15](./features/15-notion-business-docs.md) |
| 16 | Additional Features | Client password manager, company contacts (e.g. accountant), client portal in the org model. | [16](./features/16-more-features.md) |

## 4. Architecture Principles

These principles recur across the feature specs.

1. **Single source of truth per domain.** Modules reference each other's records instead of duplicating them:
   - CRM owns relationships and sales.
   - Offers own commercial proposals.
   - Contracts own legal agreements.
   - Projects own delivery context.
   - Task Management owns tasks.
   - Finance owns invoices, payments and expenses.
   - Support owns tickets.
   - Messaging owns conversations.
   - Documents own file storage.
2. **Core commercial flow.** `CRM Deal → Offer → Contract → Project → Tasks / Time / Support / Finance`.
3. **Tenancy and isolation.** Organizations are isolated tenants, and branches are units inside one organization. Client data isolation is enforced everywhere: a user with access to Client A never automatically sees Client B.
4. **Role-based permissions.** Granular, customizable permissions at organization, module, record and field level, with an audit trail for material actions.
5. **Customer visibility boundaries.** Internal notes, risks, finances and conversations are hidden from the portal unless explicitly shared.
6. **Immutability where it matters.** Signed contract versions, sent proposal versions and audit logs are never silently edited. Changes create new versions or amendments.
7. **Extensibility.** Custom fields (including shared fields), configurable statuses, pipelines, templates and automation rules, all without core code changes.
8. **API and webhooks.** Each module is a first-class API resource and emits webhooks with event IDs, signatures, retries and idempotency.
9. **AI-assisted but human-controlled.** AI drafts, classifies, summarizes and recommends. Output is editable and reviewable. Sensitive or high-impact actions need human approval and are logged.
10. **Real-time and notification-driven.** Live updates where useful, with a shared notification engine instead of per-module delivery systems.

## 5. User Roles

Manager, Project Manager, Developer, Marketing, Sales, Support, Accountant and Customer, each with customizable permissions. Customer organizations have their own roles (for example Owner, Administrator, Manager, Finance, Viewer). See [01](./features/01-users-organizations-permissions.md) and [07](./features/07-customer-portal.md).

## 6. Integrations

- **Payments:** Stripe.
- **Email and SMS:** providers behind the Communication Center. Local API development uses `.env.staging` for working keys.
- **E-signature:** provider abstraction (for example DocuSign, Dropbox Sign, Adobe Acrobat Sign).
- **AI:** shared AI integration layer. Support uses the JEV model from Typesafe AI.
- **External tools (project and messaging):** GitHub, GitLab, Jira, Linear, Notion, Google Drive, Microsoft 365.

## 7. Status

All 16 Linear issues are currently in **Backlog**; no module has started. The Linear project is the authority for status. This document and `docs/features/` are synced from it as of 2026-11-10.

## 8. Open Questions

- Several modules refer to capabilities with no spec yet. These are Time Tracking, Documents / File Management, Calendar, and a global automation engine. Decide whether each is a separate module or part of an existing one.
- Offers (LOG-303) and Finance quotes (LOG-104) overlap, and the Communication Center (LOG-106) and Messaging (LOG-313) have a notification overlap with LOG-403. Confirm which module owns each.
- LOG-402 and LOG-341 are still short notes and need full specs before implementation.
