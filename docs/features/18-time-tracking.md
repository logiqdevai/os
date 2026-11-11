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

**Owned tables:** none yet — this module is not modelled in the schema. Add its tables in a new banner section
`// NN Module name — docs/features/18-time-tracking.md` and re-run the script.

### Plain-id references from other modules

Plain-string ids (no Prisma relation) that other modules already store for records this module will own. Turn them into relations when this module is modelled.

- `InvoiceLineItem.time_entry_ids` ([08](./08-financial-management-stripe-integration.md), [L5464](../../api/prisma/schema.prisma#L5464)) — Time entry ids (18) billed by this line; marked invoiced in 18.

<!-- schema-refs:end -->

## 1. Purpose

Time Tracking is the source of truth for effort. It answers how much time was spent, by whom, on what, and whether it is billable.

Core rule:

**Projects plan hours. Time Tracking records hours. Finance bills hours.**

## 2. Core Concepts

### Time Entry

A unit of recorded work: employee, date, duration or start/end, project, optional workstream, milestone, task or ticket, description, billable flag, billing rate reference, cost rate reference, status.

### Timer

A running time entry started from a task, ticket or project.

### Timesheet

A periodic (weekly or custom) collection of an employee's time entries submitted for approval.

### Rate

A billing rate (what the customer is charged) and a cost rate (what the employee costs). Billing rates come from 08 Finance products and services or project overrides; cost rates come from 10 Employees compensation.

## 3. Time Entry Model

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

* Start/stop timer from a task, ticket or project
* Manual entry with duration
* Calendar-based entry from 19 Calendar events
* Bulk entry (weekly grid)
* Mobile capture
* Idle detection and reminders
* AI suggestion of entries from calendar, commits and task activity (review required)

## 5. Timesheets & Approval

* Weekly timesheet per employee
* Submit, approve, reject with comment
* Approvers: project owner, team lead or manager per organization policy
* Lock approved periods; changes require unlock by an authorized user and are audited
* Reminders for missing or unsubmitted time (14)

Approval permissions follow 01 §95.

## 6. Billable Classification

* Default billability from project type and contract (04 §54 billing context)
* Per-entry override with reason
* Non-billable categories: internal, pre-sales, warranty, overhead
* Write-off and write-up adjustments at invoicing time are recorded in 08, not by editing entries

## 7. Integration with Finance

* 08 Finance pulls approved, uninvoiced billable entries to create time and materials invoices.
* Invoiced entries are marked `invoiced` and reference the invoice.
* 09 Income & Expense uses cost rate snapshots to allocate employee cost to projects for profitability.

Time Tracking never creates invoices or financial records.

## 8. Integration with Projects & Tasks

* 05 shows planned vs logged, billable vs non-billable, hours by employee, workstream and milestone.
* 06 shows estimate vs actual per task and surfaces running timers.
* 13 shows time spent per ticket.

## 9. Integration with Employees

* Working hours, leave and holidays from 10 and 01 §121–122 define expected capacity.
* Utilization = logged hours / expected hours; computed here, displayed in 10 and 05.
* Attendance (clock-in/out) stays in 10 and may pre-fill the daily total.

## 10. Reporting

* Hours by project, customer, employee, team, branch, activity type
* Billable ratio
* Utilization
* Estimate vs actual
* Unbilled hours
* Timesheet compliance

Reports respect branch scope (01 §123–124).

## 11. Permissions

* `time.entries.create_own / read_own / update_own`
* `time.entries.read_team / read_all`
* `time.entries.approve`
* `time.entries.unlock`
* `time.rates.read / manage`
* `time.reports.read`

Cost rates are a sensitive field (01 §60).

## 12. Audit

Audit creation, edit, approval, rejection, unlock, rate changes and invoicing state changes.

## 13. API & Webhooks

API: create/update/delete entry, start/stop timer, list entries, submit timesheet, approve/reject, list uninvoiced billable entries, mark invoiced.

Webhooks: `time.entry_created`, `time.entry_updated`, `time.timesheet_submitted`, `time.timesheet_approved`, `time.timesheet_rejected`, `time.entries_invoiced`.

## 14. Recommended MVP

* Manual entries and timers on tasks and projects
* Billable flag
* Weekly timesheet with approval
* Project and task hour summaries
* Export of approved billable entries to 08

## 15. Phase 2

* Rate management and snapshots
* Utilization and capacity reporting
* Calendar-based capture and AI suggestions
* Locking and unlock audit
* Ticket time tracking
