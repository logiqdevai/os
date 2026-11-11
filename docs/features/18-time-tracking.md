# Time Tracking

> Linear: [LOG-408](https://linear.app/logiqdev/issue/LOG-408/time-tracking) · Status: Backlog

> **Canonical for:** time entries, timers, timesheets, billable classification, approval and the link between effort and billing. Attendance (clock in/out) is owned by 10 Employees; Time Tracking records work effort against projects and tasks.
>
> **Depends on:** [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) (LOG-406) · [05 Project Management](./05-project-management.md) (LOG-405) for projects, workstreams, milestones · [06 Task Management](./06-task-management.md) (LOG-102) for tasks · [10 Employee Management](./10-employee-management-system.md) (LOG-107) for employees, working hours and cost rates · [14 Notifications](./14-notifications-activity-center.md) (LOG-403).
>
> **Consumed by:** 05 Projects (§51, §64 planned vs logged hours), 06 Tasks (time estimates vs actual), 08 Finance (time and materials invoicing), 09 Income & Expense (employee cost allocation, project profitability), 10 Employees (utilization), 13 Support (time spent on tickets).

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (12)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Configuration** | | | |
| `TimeTrackingSettings` | `time_tracking_settings` | [L16315](../../api/prisma/schema.prisma#L16315) | 18 §4, §5, §6, §9 — organization-wide time tracking settings (one row per organization). |
| `TimeActivityType` | `time_activity_types` | [L16379](../../api/prisma/schema.prisma#L16379) | 18 §3 — configurable activity types (development, design, meeting, support, admin …). |
| `TimeProjectSettings` | `time_project_settings` | [L16412](../../api/prisma/schema.prisma#L16412) | 18 §6, §8 — per-project time tracking overrides. Billing model and T&M hourly rate stay in ProjectBillingSettings (08); this row carries default billability … |
| **Rates** | | | |
| `BillingRate` | `billing_rates` | [L16448](../../api/prisma/schema.prisma#L16448) | 18 §2, §6 — rate cards with effective dates. BILLING rates (customer price per hour) resolve by scope: organization default, product/service (08), project ov… |
| **Time entries** | | | |
| `TimeEntry` | `time_entries` | [L16495](../../api/prisma/schema.prisma#L16495) | 18 §3 — a unit of recorded work. Project is optional for internal time (admin, training, leave); task and ticket are optional. Rate snapshots (18 §3) are cop… |
| `Timer` | `timers` | [L16620](../../api/prisma/schema.prisma#L16620) | 18 §2, §4 — a running timer started from a task, ticket or project. At most one running timer per member (enforced by the service: stopped_at IS NULL). Stopp… |
| `TimeImportJob` | `time_import_jobs` | [L16669](../../api/prisma/schema.prisma#L16669) | 18 §4 — bulk/CSV/external imports producing IMPORTED entries. |
| `TimeSuggestion` | `time_suggestions` | [L16702](../../api/prisma/schema.prisma#L16702) | 18 §4 — suggested entries from calendar events (19), commits, task activity (06), attendance (10) or AI. Review is always required: accepting creates a TimeE… |
| `TimeEntryAdjustment` | `time_entry_adjustments` | [L16751](../../api/prisma/schema.prisma#L16751) | 18 §6 — write-off / write-up / write-down applied at invoicing time. The entry itself is never edited: the adjustment records the delta between the snapshott… |
| **Timesheets** | | | |
| `Timesheet` | `timesheets` | [L16784](../../api/prisma/schema.prisma#L16784) | 18 §2, §5 — a periodic collection of one member's entries submitted for approval. Created lazily when the first entry of a period is logged or on submission.… |
| `TimesheetAction` | `timesheet_actions` | [L16843](../../api/prisma/schema.prisma#L16843) | 18 §5, §12 — submit/approve/reject/reopen/lock/unlock history with comments. Mirrors audit_events but is kept queryable for compliance reporting (18 §10). |
| **Reporting** | | | |
| `TimeUtilizationPeriod` | `time_utilization_periods` | [L16866](../../api/prisma/schema.prisma#L16866) | 18 §9, §10 — per-member, per-period utilization snapshot. Utilization = logged / expected hours; computed here (expected capacity from 10 and 01 §121–122), d… |

**Owned enums (14):** `TimeEntryStatus`, `TimeEntrySource`, `TimeNonBillableCategory`, `TimesheetStatus`, `TimesheetPeriodType`, `TimesheetApproverPolicy`, `TimesheetActionType`, `TimeRateKind`, `BillingRateScope`, `TimeSuggestionSource`, `TimeSuggestionStatus`, `TimeAdjustmentType`, `TimeRoundingMode`, `TimeImportStatus`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `TimeEntry.branch`, `TimeUtilizationPeriod.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `BillingRate.created_by`, `BillingRate.membership`, `TimeEntry.approved_by`, `TimeEntry.locked_by` +17 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `BillingRate.organization`, `TimeActivityType.organization`, `TimeEntry.organization`, `TimeEntryAdjustment.organization` +6 more |
| [04](./04-contracts.md) | `Contract` (`contracts`) | `TimeProjectSettings.contract` |
| [05](./05-project-management.md) | `Project` (`projects`) | `BillingRate.project`, `TimeEntry.project`, `TimeProjectSettings.project`, `TimeSuggestion.project` +1 more |
| [05](./05-project-management.md) | `ProjectMilestone` (`project_milestones`) | `TimeEntry.milestone`, `Timer.milestone` |
| [05](./05-project-management.md) | `ProjectWorkstream` (`project_workstreams`) | `TimeEntry.workstream`, `Timer.workstream` |
| [06](./06-task-management.md) | `Task` (`tasks`) | `TimeEntry.task`, `TimeSuggestion.task`, `Timer.task` |
| [08](./08-financial-management-stripe-integration.md) | `Invoice` (`invoices`) | `TimeEntry.invoice` |
| [08](./08-financial-management-stripe-integration.md) | `InvoiceLineItem` (`invoice_line_items`) | `TimeEntry.invoice_line_item`, `TimeEntryAdjustment.invoice_line_item` |
| [08](./08-financial-management-stripe-integration.md) | `Product` (`products`) | `BillingRate.product` |

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `Organization`
- [05](./05-project-management.md): `Project`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `Contract.billing_model` ([04](./04-contracts.md), [L3627](../../api/prisma/schema.prisma#L3627)) — 04 §54, 18 §6 — billing model agreed in the contract (08 BillingModel); seeds ProjectBillingSettings on project creation.
- `Contract.default_time_billable` ([04](./04-contracts.md), [L3627](../../api/prisma/schema.prisma#L3627)) — 18 §6 — contract-level default billability for time logged under this contract; null = project type / organization default.
- `ProjectType.default_time_billable` ([05](./05-project-management.md), [L4358](../../api/prisma/schema.prisma#L4358)) — 18 §6 — default billability for time entries on projects of this type; null = organization default (TimeTrackingSettings). Copied into TimeProjectSettings wh…
- `ProjectType.default_time_non_billable_category` ([05](./05-project-management.md), [L4358](../../api/prisma/schema.prisma#L4358)) — 18 §6 — non-billable category applied when default_time_billable = false.
- `Task.actual_hours` ([06](./06-task-management.md), [L5458](../../api/prisma/schema.prisma#L5458)) — 06 §3, §11 — cached actual effort rolled up from approved time entries (18 §8); 18 is the source of truth.
- `EmployeeHrSettings.prefill_time_entries_from_attendance` ([10](./10-employee-management-system.md), [L8147](../../api/prisma/schema.prisma#L8147)) — Pre-fill 18 Time Tracking daily total from attendance (never replaces time entries).
- `EmployeeCompensation.cost_rate_hourly` ([10](./10-employee-management-system.md), [L8367](../../api/prisma/schema.prisma#L8367)) — Hourly cost rate for project costing (18 §7 snapshots this).
- `AttendanceRecord.prefilled_time_entry_id` ([10](./10-employee-management-system.md), [L8894](../../api/prisma/schema.prisma#L8894)) — 18 TimeEntry pre-filled from this record, if enabled.
- `EmployeeCapacityPeriod.logged_hours` ([10](./10-employee-management-system.md), [L9004](../../api/prisma/schema.prisma#L9004)) — Snapshot from 18 TimeEntry actuals.

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 13 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `time.entries` | read_all, approve, create_own, read_own, read_team, update_own, unlock* |
| `time.rates` | read*, manage* |
| `time.reports` | read |
| `time.settings` | manage |
| `time.timesheets` | submit_own, approve |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Purpose

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Time Tracking is the source of truth for effort. It answers how much time was spent, by whom, on what, and whether it is billable.

Core rule:

**Projects plan hours. Time Tracking records hours. Finance bills hours.**

## 2. Core Concepts

<!-- schema-section:start -->
> **Schema:** `BillingRate` ([billing_rates](../../api/prisma/schema.prisma#L16448)) · `Timer` ([timers](../../api/prisma/schema.prisma#L16620)) · `Timesheet` ([timesheets](../../api/prisma/schema.prisma#L16784)) · enum `BillingRateScope` ([L16263](../../api/prisma/schema.prisma#L16263)) · enum `TimeRateKind` ([L16256](../../api/prisma/schema.prisma#L16256)) · enum `TimesheetPeriodType` ([L16229](../../api/prisma/schema.prisma#L16229)) · enum `TimesheetStatus` ([L16220](../../api/prisma/schema.prisma#L16220))
<!-- schema-section:end -->

### Time Entry

A unit of recorded work: employee, date, duration or start/end, project, optional workstream, milestone, task or ticket, description, billable flag, billing rate reference, cost rate reference, status.

### Timer

A running time entry started from a task, ticket or project.

### Timesheet

A periodic (weekly or custom) collection of an employee's time entries submitted for approval.

### Rate

A billing rate (what the customer is charged) and a cost rate (what the employee costs). Billing rates come from 08 Finance products and services or project overrides; cost rates come from 10 Employees compensation.

## 3. Time Entry Model

<!-- schema-section:start -->
> **Schema:** `TimeActivityType` ([time_activity_types](../../api/prisma/schema.prisma#L16379)) · `TimeEntry` ([time_entries](../../api/prisma/schema.prisma#L16495)) · enum `TimeEntrySource` ([L16200](../../api/prisma/schema.prisma#L16200)) · enum `TimeEntryStatus` ([L16190](../../api/prisma/schema.prisma#L16190))
<!-- schema-section:end -->

* Entry ID
* Employee (Member with an Employee record, 01 §80)
* Date
* Duration, or start and end time
* Project (optional for internal time such as admin, training, leave)
* Workstream, milestone (optional)
* Task or Ticket (optional)
* Activity type (development, design, meeting, support, admin; configurable)
* Description
* Billable / non-billable
* Billing rate snapshot
* Cost rate snapshot
* Status: draft, submitted, approved, rejected, invoiced, locked
* Source: manual, timer, imported, generated

Rate snapshots are stored at approval time so later rate changes do not alter historical records.

## 4. Capture

<!-- schema-section:start -->
> **Schema:** `TimeEntry` ([time_entries](../../api/prisma/schema.prisma#L16495)): `billable_minutes`, `timer_id` · `TimeImportJob` ([time_import_jobs](../../api/prisma/schema.prisma#L16669)) · `TimeSuggestion` ([time_suggestions](../../api/prisma/schema.prisma#L16702)) · `TimeTrackingSettings` ([time_tracking_settings](../../api/prisma/schema.prisma#L16315)): `idle_timeout_minutes` · `Timer` ([timers](../../api/prisma/schema.prisma#L16620)): `last_heartbeat_at` · enum `TimeEntrySource` ([L16200](../../api/prisma/schema.prisma#L16200)) · enum `TimeImportStatus` ([L16304](../../api/prisma/schema.prisma#L16304)) · enum `TimeRoundingMode` ([L16296](../../api/prisma/schema.prisma#L16296)) · enum `TimeSuggestionSource` ([L16272](../../api/prisma/schema.prisma#L16272)) · enum `TimeSuggestionStatus` ([L16281](../../api/prisma/schema.prisma#L16281))
<!-- schema-section:end -->

* Start/stop timer from a task, ticket or project
* Manual entry with duration
* Calendar-based entry from 19 Calendar events
* Bulk entry (weekly grid)
* Mobile capture
* Idle detection and reminders
* AI suggestion of entries from calendar, commits and task activity (review required)

## 5. Timesheets & Approval

<!-- schema-section:start -->
> **Schema:** `TimeProjectSettings` ([time_project_settings](../../api/prisma/schema.prisma#L16412)): `approver_membership_id` · `TimeTrackingSettings` ([time_tracking_settings](../../api/prisma/schema.prisma#L16315)): `lock_on_approval` · `Timesheet` ([timesheets](../../api/prisma/schema.prisma#L16784)) · `TimesheetAction` ([timesheet_actions](../../api/prisma/schema.prisma#L16843)) · enum `TimesheetActionType` ([L16246](../../api/prisma/schema.prisma#L16246)) · enum `TimesheetApproverPolicy` ([L16238](../../api/prisma/schema.prisma#L16238)) · enum `TimesheetPeriodType` ([L16229](../../api/prisma/schema.prisma#L16229)) · enum `TimesheetStatus` ([L16220](../../api/prisma/schema.prisma#L16220))
<!-- schema-section:end -->

* Weekly timesheet per employee
* Submit, approve, reject with comment
* Approvers: project owner, team lead or manager per organization policy
* Lock approved periods; changes require unlock by an authorized user and are audited
* Reminders for missing or unsubmitted time (14)

Approval permissions follow 01 §95.

## 6. Billable Classification

<!-- schema-section:start -->
> **Schema:** `BillingRate` ([billing_rates](../../api/prisma/schema.prisma#L16448)) · `TimeActivityType` ([time_activity_types](../../api/prisma/schema.prisma#L16379)): `default_billable` · `TimeEntry` ([time_entries](../../api/prisma/schema.prisma#L16495)): `billable_overridden` · `TimeEntryAdjustment` ([time_entry_adjustments](../../api/prisma/schema.prisma#L16751)) · `TimeProjectSettings` ([time_project_settings](../../api/prisma/schema.prisma#L16412)) · `TimeTrackingSettings` ([time_tracking_settings](../../api/prisma/schema.prisma#L16315)) · enum `BillingRateScope` ([L16263](../../api/prisma/schema.prisma#L16263)) · enum `TimeAdjustmentType` ([L16289](../../api/prisma/schema.prisma#L16289)) · enum `TimeNonBillableCategory` ([L16209](../../api/prisma/schema.prisma#L16209)) — other modules: `Contract` ([contracts](../../api/prisma/schema.prisma#L3627)): `default_time_billable` ([04](./04-contracts.md)) · `ProjectType` ([project_types](../../api/prisma/schema.prisma#L4358)): `default_time_billable` ([05](./05-project-management.md))
<!-- schema-section:end -->

* Default billability from project type and contract (04 §54 billing context)
* Per-entry override with reason
* Non-billable categories: internal, pre-sales, warranty, overhead
* Write-off and write-up adjustments at invoicing time are recorded in 08, not by editing entries

## 7. Integration with Finance

<!-- schema-section:start -->
> **Schema:** `TimeEntry` ([time_entries](../../api/prisma/schema.prisma#L16495)): `cost_amount` — other modules: `EmployeeCompensation` ([employee_compensations](../../api/prisma/schema.prisma#L8367)): `cost_rate_hourly` ([10](./10-employee-management-system.md)) · `InvoiceLineItem` ([invoice_line_items](../../api/prisma/schema.prisma#L6331)) ([08](./08-financial-management-stripe-integration.md)) · `LedgerProfitabilitySnapshot` ([ledger_profitability_snapshots](../../api/prisma/schema.prisma#L7663)) ([09](./09-income-expense-management.md))
<!-- schema-section:end -->

* 08 Finance pulls approved, uninvoiced billable entries to create time and materials invoices.
* Invoiced entries are marked `invoiced` and reference the invoice.
* 09 Income & Expense uses cost rate snapshots to allocate employee cost to projects for profitability.

Time Tracking never creates invoices or financial records.

## 8. Integration with Projects & Tasks

<!-- schema-section:start -->
> **Schema:** `TimeProjectSettings` ([time_project_settings](../../api/prisma/schema.prisma#L16412)) — other modules: `Task` ([tasks](../../api/prisma/schema.prisma#L5458)): `actual_hours` ([06](./06-task-management.md))
<!-- schema-section:end -->

* 05 shows planned vs logged, billable vs non-billable, hours by employee, workstream and milestone.
* 06 shows estimate vs actual per task and surfaces running timers.
* 13 shows time spent per ticket.

## 9. Integration with Employees

<!-- schema-section:start -->
> **Schema:** `TimeTrackingSettings` ([time_tracking_settings](../../api/prisma/schema.prisma#L16315)): `attendance_prefill_enabled` · `TimeUtilizationPeriod` ([time_utilization_periods](../../api/prisma/schema.prisma#L16866))
<!-- schema-section:end -->

* Working hours, leave and holidays from 10 and 01 §121–122 define expected capacity.
* Utilization = logged hours / expected hours; computed here, displayed in 10 and 05.
* Attendance (clock-in/out) stays in 10 and may pre-fill the daily total.

## 10. Reporting

<!-- schema-section:start -->
> **Schema:** `TimeUtilizationPeriod` ([time_utilization_periods](../../api/prisma/schema.prisma#L16866)) · `Timesheet` ([timesheets](../../api/prisma/schema.prisma#L16784)) · `TimesheetAction` ([timesheet_actions](../../api/prisma/schema.prisma#L16843))
<!-- schema-section:end -->

* Hours by project, customer, employee, team, branch, activity type
* Billable ratio
* Utilization
* Estimate vs actual
* Unbilled hours
* Timesheet compliance

Reports respect branch scope (01 §123–124).

## 11. Permissions

<!-- schema-section:start -->
> **Schema:** `BillingRate` ([billing_rates](../../api/prisma/schema.prisma#L16448)) — other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1273)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

* `time.entries.create_own / read_own / update_own`
* `time.entries.read_team / read_all`
* `time.entries.approve`
* `time.entries.unlock`
* `time.rates.read / manage`
* `time.reports.read`

Cost rates are a sensitive field (01 §60).

## 12. Audit

<!-- schema-section:start -->
> **Schema:** `BillingRate` ([billing_rates](../../api/prisma/schema.prisma#L16448)) · `TimesheetAction` ([timesheet_actions](../../api/prisma/schema.prisma#L16843)) · enum `TimesheetActionType` ([L16246](../../api/prisma/schema.prisma#L16246)) — other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L1710)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Audit creation, edit, approval, rejection, unlock, rate changes and invoicing state changes.

## 13. API & Webhooks

<!-- schema-section:start -->
> **Schema:** other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L18855)) ([20](./20-automation-engine.md))
<!-- schema-section:end -->

API: create/update/delete entry, start/stop timer, list entries, submit timesheet, approve/reject, list uninvoiced billable entries, mark invoiced.

Webhooks: `time.entry_created`, `time.entry_updated`, `time.timesheet_submitted`, `time.timesheet_approved`, `time.timesheet_rejected`, `time.entries_invoiced`.

## 14. Recommended MVP

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Manual entries and timers on tasks and projects
* Billable flag
* Weekly timesheet with approval
* Project and task hour summaries
* Export of approved billable entries to 08

## 15. Phase 2

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Rate management and snapshots
* Utilization and capacity reporting
* Calendar-based capture and AI suggestions
* Locking and unlock audit
* Ticket time tracking
