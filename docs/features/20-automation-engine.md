# Automation Engine

> Linear: [LOG-410](https://linear.app/logiqdev/issue/LOG-410/automation-engine) · Status: Backlog

> **Canonical for:** the platform rules and workflow engine: triggers, conditions, actions, scheduled jobs, execution history and the event bus modules publish to. Modules declare their triggers and actions; they do not implement their own automation runtimes.
>
> **Depends on:** [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) (LOG-406) for permissions, service accounts (§76) and isolation · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) for the notify action.
>
> **Consumed by:** 02 CRM (§31 sales automation), 03 Proposals (follow-ups), 04 Contracts (§87 lifecycle automation, §52 expiration monitoring), 05 Projects (§70, §91, §116), 06 Tasks (recurring tasks, status rules), 08 Finance (automation section), 09 Income & Expense (recurring expenses, automation section), 10 Employees (leave workflows), 11 Communication Center (automation section), 12 Messaging (§95 channel lifecycle, §92 system events), 13 Support (§7 workflows, §4 ticket-to-task rules), 17 Documents (retention), 18 Time Tracking (reminders).

## 1. Purpose

The Automation Engine lets organizations define "when X happens, if Y, do Z" across the whole Agency Operating System without code, and gives modules a single reliable place to run scheduled and event-driven work.

Core rule:

**Modules publish events and expose actions. The engine evaluates rules and executes actions. Business logic that must always run (for example contract immutability) stays in the module and is never an optional rule.**

## 2. Core Concepts

### Event

A domain fact published by a module to the event bus, with a stable key, organization, actor, record references and payload. The same events feed 14 Notifications and module webhooks.

### Trigger

What starts a rule: an event, a schedule (cron or interval), a date on a record ("30 days before contract end"), a manual run, or an inbound webhook.

### Condition

A predicate on the event payload, the related records, custom fields, scope (branch, team) and time.

### Action

An operation exposed by a module: update field, change status, assign, create record (task, ticket, milestone, expense), send notification (14), send communication (11), post message (12), call webhook, run AI step, wait, branch.

### Rule

Trigger + conditions + ordered actions, owned by an organization, versioned, enabled or disabled.

### Run

One execution of a rule with its inputs, each action result, duration, status and errors.

## 3. Trigger Catalog

Triggers are declared by modules. Examples by module:

* 02 CRM: lead created, deal stage changed, deal inactive for N days, proposal accepted (from 03)
* 03 Proposals: proposal sent, viewed, accepted, expiring
* 04 Contracts: approved, fully signed, expiring in N days, renewal due, terminated, amendment signed
* 05 Projects: created, status changed, milestone completed, health changed, change request approved, completed
* 06 Tasks: created, status changed, overdue, recurrence due
* 08 Finance: invoice created, paid, overdue, payment failed, subscription renewing
* 09 Income & Expense: recurring expense due, invoice uploaded, duplicate detected
* 10 Employees: leave requested, leave approved, employee joined, employee left
* 12 Messaging: project created (channel creation), project completed (archive), customer inactive
* 13 Support: ticket created, SLA at risk, ticket inactive, AI classification completed
* Schedule: hourly, daily, weekly, monthly, cron
* Date-relative: N days before or after any date field on a record

## 4. Action Catalog

Actions are declared by modules with their input schema and required permission. Examples:

* Update record field, add tag, set custom field
* Change status (respecting module transition rules)
* Assign to Member, Team, or by round-robin / load
* Create Task (06), Ticket (13), Milestone (05), Project from template (05), Expense record (09), Contract from template (04), Proposal follow-up (03), Calendar event (19)
* Notify recipients (14)
* Send email or SMS from template (11)
* Post message to channel (12)
* Create or archive channel (12)
* Call outbound webhook
* Run AI step (classify, summarize, extract, draft) through the shared AI layer; results are inputs to later actions
* Wait for duration or until date
* Require human approval before continuing
* Conditional branch

Actions execute with the permissions of the rule's owner or a designated service account (01 §76), never with elevated implicit rights.

## 5. Rule Builder

* No-code builder with trigger, condition and action steps
* Test mode with sample events
* Dry run showing what would happen
* Versioning; editing a live rule creates a new version
* Enable, disable, duplicate, export, import
* Templates per module (for example "Deal won → create project from template")
* Scope: organization, branch, team, project type

## 6. Execution Semantics

* At-least-once event delivery with idempotent actions; each run carries an idempotency key.
* Ordered execution within a run; runs for the same record are serialized when the rule requires it.
* Retries with backoff for transient failures; dead-letter queue with alerting (14) for permanent failures.
* Loop protection: a rule cannot re-trigger itself through its own actions beyond a configurable depth.
* Rate limits per organization and per rule.
* Guardrails: destructive actions (delete, payment, external send to customers) require explicit enablement and can require human approval.
* Mandatory module logic (contract signed-version immutability, finance ledger rules, permission checks) is enforced by the module, not by rules, and cannot be bypassed by a rule.

## 7. Scheduled Jobs

The engine also hosts module-owned recurring jobs that are not user rules:

* 04 expiration and renewal monitoring
* 08 recurring billing, dunning and reminders
* 09 recurring expense generation, monthly summaries
* 12 channel archival
* 13 SLA timers, auto-close of inactive tickets
* 14 digests
* 17 retention enforcement

Modules register these jobs; the engine schedules, runs, retries and logs them.

## 8. Execution History

Every run is stored with trigger, inputs, conditions evaluated, each action and result, actor, duration and status. History is searchable by rule, record, status and date. Retention is configurable.

## 9. AI in Automations

AI steps use the shared AI integration layer (`docs/Product_Specification.md` §6). Output is structured, carries a confidence score and can gate the next step on a threshold or human approval. AI steps never execute irreversible actions on their own.

## 10. Permissions

* `automation.rules.read / create / update / delete / enable`
* `automation.runs.read`
* `automation.actions.destructive.enable`
* `automation.service_accounts.manage` (with 01)

A user can only build rules whose actions they are themselves permitted to perform, or that run under a service account they manage.

## 11. Audit

Audit rule creation, edits, enable/disable, service account changes and every run that performs a destructive or customer-facing action.

## 12. API & Webhooks

API: publish event (internal and external), CRUD rules, run rule manually, list runs, register trigger and action schemas (modules).

Inbound webhooks: external systems can trigger rules with a signed payload.

Outbound: `automation.rule_run_started`, `automation.rule_run_completed`, `automation.rule_run_failed`.

## 13. Recommended MVP

* Event bus with the module trigger catalog
* Rule builder with event triggers, simple conditions and these actions: update field, change status, assign, create task, notify, send template email, call webhook
* Scheduled jobs host for modules
* Run history and retries
* Loop protection and rate limits

## 14. Phase 2

* Date-relative triggers
* Wait and approval steps
* AI steps
* Rule templates library
* Inbound webhooks
* Service account execution
* Dry run and test mode
