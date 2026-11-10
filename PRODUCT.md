# Logiqdev OS

An **AI-native Operating System for Software Agencies**. Agencies run projects, clients, employees, billing, communication and daily operations from one platform.

- Full specification: [`docs/Product_Specification.md`](./docs/Product_Specification.md)
- Per-module specs: [`docs/features/`](./docs/features/)
- Planning source: Linear project [logiqdev-os](https://linear.app/logiqdev/project/logiqdev-os-27d58b62f801) (team Logiqdev)

## Who it's for

Software agencies and their clients.

- **Agency staff:** Manager, Project Manager, Developer, Marketing, Sales, Support, Accountant, each with customizable permissions.
- **Clients:** Customer users who log in to a portal with their own roles.

## What it does

| Area | Summary |
|---|---|
| Projects & tasks | Linear-inspired planning, milestones, tasks, views, workload and delivery tracking |
| CRM & sales | Leads, companies, contacts, deals, pipelines, forecasting |
| Proposals & contracts | AI-generated branded offers, versioned contracts, e-signature, amendments and renewals |
| Customer portal | Client visibility into projects, requests, deliverable approvals, documents, invoices and subscriptions |
| Finance | Stripe billing, invoices, subscriptions, income and expense tracking, VAT, profitability |
| Communication | Email and SMS campaigns, Slack-like team messaging, Intercom-like support inbox and tickets |
| People | Employee profiles, leave, attendance, skills, performance |
| Platform | Users, organizations, branches, role-based permissions, notifications, custom fields, API and webhooks |
| AI | Assistant across all modules: plans, proposals, drafts, summaries, risk detection, reports |

## Principles

- **One source of truth per domain.** Modules link to each other's records and don't duplicate them.
- **Core flow:** `CRM Deal → Offer → Contract → Project → Tasks / Time / Support / Finance`.
- **Isolation:** tenants and client data are strictly separated, and internal data stays hidden from clients unless shared.
- **AI assists, humans decide.** Output is editable, and sensitive actions need approval and are audited.
- **Extensible:** custom fields, statuses, pipelines, templates and automations are configurable without code changes.

## Status

Planning stage. All 16 module issues are in Backlog (as of 2026-11-10).
