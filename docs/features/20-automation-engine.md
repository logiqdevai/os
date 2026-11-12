# Automation Engine

> Linear: [LOG-410](https://linear.app/logiqdev/issue/LOG-410/automation-engine) · Status: Backlog

> **Canonical for:** the platform rules and workflow engine: triggers, conditions, actions, scheduled jobs, execution history and the event bus modules publish to. Modules declare their triggers and actions; they do not implement their own automation runtimes.
>
> **Depends on:** [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) (LOG-406) for permissions, service accounts (§76) and isolation · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) for the notify action.
>
> **Consumed by:** 02 CRM (§31 sales automation), 03 Proposals (follow-ups), 04 Contracts (§87 lifecycle automation, §52 expiration monitoring), 05 Projects (§70, §91, §116), 06 Tasks (recurring tasks, status rules), 08 Finance (automation section), 09 Income & Expense (recurring expenses, automation section), 10 Employees (leave workflows), 11 Communication Center (automation section), 12 Messaging (§95 channel lifecycle, §92 system events), 13 Support (§7 workflows, §4 ticket-to-task rules), 17 Documents (retention), 18 Time Tracking (reminders).

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (18)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Organization settings** | | | |
| `AutomationSettings` | `automation_settings` | [L21117](../../api/prisma/schema.prisma#L21117) | 20 §6, §8, §10 — per-organization engine guardrails: rate limits, loop depth, retention, destructive-action enablement and the default service account rules … |
| **Trigger & action catalog** | | | |
| `AutomationTriggerDefinition` | `automation_trigger_definitions` | [L21164](../../api/prisma/schema.prisma#L21164) | 20 §3, §12 — a trigger a module registers (platform-wide, not tenant-scoped). `key` is the stable event key modules publish, e.g. `crm.deal.stage_changed`, `… |
| `AutomationActionDefinition` | `automation_action_definitions` | [L21201](../../api/prisma/schema.prisma#L21201) | 20 §4, §12 — an action a module exposes with its input schema and required permission. `key` e.g. `tasks.create`, `crm.deal.change_status`, `notifications.no… |
| **Rules** | | | |
| `AutomationRuleTemplate` | `automation_rule_templates` | [L21243](../../api/prisma/schema.prisma#L21243) | 20 §5, §14 — rule templates / recipes library ("Deal won → create project from template"). organization_id null = system template shipped by the platform; ot… |
| `AutomationRule` | `automation_rules` | [L21274](../../api/prisma/schema.prisma#L21274) | 20 §2, §5, §6 — a rule: trigger + conditions + ordered actions, owned by an organization, versioned, enabled/disabled, scoped. The live definition is on the … |
| `AutomationRuleVersion` | `automation_rule_versions` | [L21401](../../api/prisma/schema.prisma#L21401) | 20 §5 — immutable snapshot of a rule at each publish; editing a live rule creates a new version. Runs reference the version they executed (20 §8). |
| **Event bus** | | | |
| `PlatformEvent` | `platform_events` | [L21438](../../api/prisma/schema.prisma#L21438) | 20 §2, §6, §12 — the event bus log: a domain fact published by a module, the API, an inbound webhook or a scheduled job. Consumed by rules (20), 14 Notificat… |
| **Runs** | | | |
| `AutomationRun` | `automation_runs` | [L21522](../../api/prisma/schema.prisma#L21522) | 20 §2, §6, §8 — one execution of a rule: trigger, inputs, conditions evaluated, status, duration, errors and retries. Steps hold each action result. |
| `AutomationRunStep` | `automation_run_steps` | [L21620](../../api/prisma/schema.prisma#L21620) | 20 §4, §6, §8 — one action (step) inside a run with its inputs, result, retries and timing. |
| `AutomationApproval` | `automation_approvals` | [L21669](../../api/prisma/schema.prisma#L21669) | 20 §4, §6, §9, §14 — human approval gate: a run pauses until a member approves or rejects. |
| `AutomationApprovalPolicy` | `automation_approval_policies` | [L21714](../../api/prisma/schema.prisma#L21714) | 20 §4, §6 — reusable approver policy referenced by `approval.policy_id` in a rule step (e.g. "any of the finance leads, escalate to the CFO after 24 h, hand … |
| `AutomationAiStep` | `automation_ai_steps` | [L21746](../../api/prisma/schema.prisma#L21746) | 20 §4, §9, §14 — AI step record: structured output with confidence, threshold gate and the approval it may require. Never executes irreversible actions by it… |
| `AutomationRunLock` | `automation_run_locks` | [L21788](../../api/prisma/schema.prisma#L21788) | 20 §6 — serialization lock: runs for the same record are executed one at a time when the rule requires it. Rows are short-lived; expired locks are reclaimed … |
| **Scheduled jobs** | | | |
| `ScheduledJob` | `scheduled_jobs` | [L21818](../../api/prisma/schema.prisma#L21818) | 20 §7 — module-owned recurring job hosted by the engine (04 expiration monitoring, 08 billing/dunning, 09 recurring expenses, 12 channel archival, 13 SLA tim… |
| `ScheduledJobRun` | `scheduled_job_runs` | [L21882](../../api/prisma/schema.prisma#L21882) | 20 §7, §8 — one execution of a scheduled job. |
| **Webhooks** | | | |
| `OutboundWebhook` | `outbound_webhooks` | [L21930](../../api/prisma/schema.prisma#L21930) | 20 §12 — outbound webhook endpoint subscribed to platform events (and the target of the CALL_WEBHOOK action). `secret` is stored encrypted and used for HMAC … |
| `WebhookDelivery` | `webhook_deliveries` | [L21984](../../api/prisma/schema.prisma#L21984) | 20 §6, §12 — one delivery of an event (or a CALL_WEBHOOK step) to an endpoint, with attempts, response code and retry state. |
| `AutomationInboundWebhook` | `automation_inbound_webhooks` | [L22028](../../api/prisma/schema.prisma#L22028) | 20 §12, §14 — inbound webhook endpoint: external systems trigger rules with a signed payload. The request is logged as a PlatformEvent (source INBOUND_WEBHOO… |

**Owned enums (18):** `AutomationTriggerKind`, `AutomationActionKind`, `AutomationAssignStrategy`, `AutomationRuleScopeType`, `AutomationRuleStatus`, `AutomationRunMode`, `AutomationRunStatus`, `AutomationStepStatus`, `AutomationApprovalDecision`, `AutomationAiStepKind`, `PlatformEventSource`, `ScheduledJobKind`, `ScheduledJobStatus`, `ScheduledJobRunStatus`, `OutboundWebhookStatus`, `WebhookDeliveryStatus`, `InboundWebhookStatus`, `InboundWebhookAuthScheme`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `AutomationRule.branch`, `ScheduledJob.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `AutomationApproval.approver`, `AutomationApproval.requested_from_member`, `AutomationInboundWebhook.created_by`, `AutomationRule.owner` +6 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `AutomationAiStep.organization`, `AutomationApproval.organization`, `AutomationApprovalPolicy.organization`, `AutomationInboundWebhook.organization` +10 more |
| [01](./01-users-organizations-permissions.md) | `ServiceAccount` (`service_accounts`) | `AutomationRule.run_as`, `AutomationRun.run_as`, `AutomationSettings.default_service_account`, `PlatformEvent.actor_service_account` |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `AutomationRule.team` |
| [01](./01-users-organizations-permissions.md) | `User` (`users`) | `PlatformEvent.actor_user` |
| [02](./02-crm-sales-management.md) | `CrmReportSchedule` (`crm_report_schedules`) | `ScheduledJob.crm_report_schedule` |
| [05](./05-project-management.md) | `Project` (`projects`) | `AutomationRule.project` |
| [05](./05-project-management.md) | `ProjectType` (`project_types`) | `AutomationRule.project_type` |
| [12](./12-messaging-team-communication.md) | `Channel` (`channels`) | `OutboundWebhook.channel` |

**Reused enums:** `AuditActorType` ([01](./01-users-organizations-permissions.md)), `ModuleKey` ([01](./01-users-organizations-permissions.md)), `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `Organization`
- [02](./02-crm-sales-management.md): `CrmActivity`, `CrmReportSchedule`
- [06](./06-task-management.md): `Task`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `McpToolCall.automation_run_id` ([01](./01-users-organizations-permissions.md), [L2123](../../api/prisma/schema.prisma#L2123)) — 20 AutomationRun when an automation step invoked the tool; id only.
- `CrmActivity.automation_rule_id` ([02](./02-crm-sales-management.md), [L3238](../../api/prisma/schema.prisma#L3238)) — Automation rule id (20) when created by a rule.
- `Task.automation_rule_id` ([06](./06-task-management.md), [L6777](../../api/prisma/schema.prisma#L6777)) — Recurring task instance: schedule rule lives in the Automation Engine (20); the template task is linked.
- `InvoiceReminder.automation_run_id` ([08](./08-financial-management-stripe-integration.md), [L7733](../../api/prisma/schema.prisma#L7733)) — 08 "Automation" — 20 AutomationRun / ScheduledJobRun that produced this reminder (null = sent manually); ids only.
- `FinanceReportSchedule.scheduled_job_id` ([08](./08-financial-management-stripe-integration.md), [L8372](../../api/prisma/schema.prisma#L8372)) — 20 ScheduledJob that runs it; id only.
- `LedgerRecord.automation_run_id` ([09](./09-income-expense-management.md), [L8755](../../api/prisma/schema.prisma#L8755)) — 20 AutomationRule / ScheduledJob that generated the record; id only.
- `RecurringExpense.scheduled_job_id` ([09](./09-income-expense-management.md), [L9044](../../api/prisma/schema.prisma#L9044)) — 20 ScheduledJob registered for this template; id only.
- `PayrollSchedule.scheduled_job_id` ([09](./09-income-expense-management.md), [L9119](../../api/prisma/schema.prisma#L9119)) — 20 ScheduledJob; id only.
- `LeaveRequest.automation_run_id` ([10](./10-employee-management-system.md), [L10653](../../api/prisma/schema.prisma#L10653)) — 20 AutomationRun driving the approval workflow.
- `CommMessage.automation_rule_id` ([11](./11-communication-center.md), [L12026](../../api/prisma/schema.prisma#L12026)) — 11 "Automation" — 20 AutomationRule / AutomationRun that triggered this send; ids only.
- `CommMessage.scheduled_job_id` ([11](./11-communication-center.md), [L12026](../../api/prisma/schema.prisma#L12026)) — 20 ScheduledJob backing the schedule; id only.
- `Campaign.scheduled_job_id` ([11](./11-communication-center.md), [L12486](../../api/prisma/schema.prisma#L12486)) — 20 ScheduledJob driving the schedule; id only.
- `MessagingIntegration.automation_rule_id` ([12](./12-messaging-team-communication.md), [L14122](../../api/prisma/schema.prisma#L14122)) — 20 OutboundWebhook / AutomationRule backing this integration when managed by the Automation Engine; id only.
- `SupportSettings.auto_close_after_days` ([13](./13-customer-support-communication-hub.md), [L14618](../../api/prisma/schema.prisma#L14618)) — 13 §7 — auto-close resolved tickets after N days (null = never); registered as a scheduled job (20).
- `SupportInbox.routing_strategy` ([13](./13-customer-support-communication-hub.md), [L14671](../../api/prisma/schema.prisma#L14671)) — 13 §2 — routing strategy; LOAD_BALANCED / SKILL_BASED use SupportAgentProfile; automation rules (20) may override.
- `SlaPolicy.escalation_rule_ids` ([13](./13-customer-support-communication-hub.md), [L15002](../../api/prisma/schema.prisma#L15002)) — 13 §7 — automation rules (20) run on at-risk / breach; ids only.
- `Ticket.auto_close_at` ([13](./13-customer-support-communication-hub.md), [L15054](../../api/prisma/schema.prisma#L15054)) — 13 §7 — scheduled auto-close (20 ScheduledJob id).
- `TicketSlaTimer.scheduled_job_id` ([13](./13-customer-support-communication-hub.md), [L15241](../../api/prisma/schema.prisma#L15241)) — 20 ScheduledJob id for the breach check; id only.
- `NotificationEvent.platform_event_id` ([14](./14-notifications-activity-center.md), [L15944](../../api/prisma/schema.prisma#L15944)) — 20 PlatformEvent id when the event came from the event bus.
- `NotificationEvent.automation_rule_id` ([14](./14-notifications-activity-center.md), [L15944](../../api/prisma/schema.prisma#L15944)) — 20 AutomationRule id when a rule published the event (14 §16).
- `NotificationOrgSettings.webhook_events_enabled` ([14](./14-notifications-activity-center.md), [L16186](../../api/prisma/schema.prisma#L16186)) — 14 §14 — emit notification.* webhook events through 20 OutboundWebhook.
- `NotificationDeliveryRule.automation_rule_id` ([14](./14-notifications-activity-center.md), [L16477](../../api/prisma/schema.prisma#L16477)) — 20 AutomationRule id when managed by the Automation Engine.
- `WikiChecklistRun.automation_run_id` ([15](./15-notion-business-docs.md), [L17350](../../api/prisma/schema.prisma#L17350)) — Automation run (20) that started it; id only.
- `FormAssignment.automation_rule_id` ([15](./15-notion-business-docs.md), [L17477](../../api/prisma/schema.prisma#L17477)) — Automation rule (20) that created the assignment; id only.
- `CalendarEvent.automation_rule_id` ([19](./19-calendar.md), [L20270](../../api/prisma/schema.prisma#L20270)) — 20 AutomationRule when created by a rule.

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 18 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `automation.actions.destructive` | enable* |
| `automation.approval_policies` | manage* |
| `automation.jobs` | read, manage* |
| `automation.rules` | manage*, read, create, update, delete*, enable*, run |
| `automation.runs` | read, manage* |
| `automation.service_accounts` | manage* |
| `automation.settings` | manage* |
| `automation.templates` | manage |
| `automation.webhooks` | manage*, read |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Purpose

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The Automation Engine lets organizations define "when X happens, if Y, do Z" across the whole Agency Operating System without code, and gives modules a single reliable place to run scheduled and event-driven work.

Core rule:

**Modules publish events and expose actions. The engine evaluates rules and executes actions. Business logic that must always run (for example contract immutability) stays in the module and is never an optional rule.**

## 2. Core Concepts

<!-- schema-section:start -->
> **Schema:** `AutomationRule` ([automation_rules](../../api/prisma/schema.prisma#L21274)): `actions`, `conditions` · `AutomationRun` ([automation_runs](../../api/prisma/schema.prisma#L21522)) · `AutomationSettings` ([automation_settings](../../api/prisma/schema.prisma#L21117)): `event_retention_days` · `AutomationTriggerDefinition` ([automation_trigger_definitions](../../api/prisma/schema.prisma#L21164)): `notifiable` · `PlatformEvent` ([platform_events](../../api/prisma/schema.prisma#L21438)) · enum `AutomationTriggerKind` ([L20944](../../api/prisma/schema.prisma#L20944)) · enum `PlatformEventSource` ([L21047](../../api/prisma/schema.prisma#L21047))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `AutomationRule` ([automation_rules](../../api/prisma/schema.prisma#L21274)): `next_run_at`, `trigger_config` · `AutomationTriggerDefinition` ([automation_trigger_definitions](../../api/prisma/schema.prisma#L21164)): `config_schema`, `date_fields` · `ScheduledJob` ([scheduled_jobs](../../api/prisma/schema.prisma#L21818)): `rule_id` · enum `AutomationTriggerKind` ([L20944](../../api/prisma/schema.prisma#L20944))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `AutomationActionDefinition` ([automation_action_definitions](../../api/prisma/schema.prisma#L21201)): `input_schema`, `is_engine_builtin`, `output_schema`, `required_permission` · `AutomationAiStep` ([automation_ai_steps](../../api/prisma/schema.prisma#L21746)) · `AutomationApproval` ([automation_approvals](../../api/prisma/schema.prisma#L21669)): `policy_id` · `AutomationApprovalPolicy` ([automation_approval_policies](../../api/prisma/schema.prisma#L21714)) · `AutomationRule` ([automation_rules](../../api/prisma/schema.prisma#L21274)): `actions`, `run_as_service_account_id` · `AutomationRun` ([automation_runs](../../api/prisma/schema.prisma#L21522)): `output`, `run_as_service_account_id` · `AutomationRunStep` ([automation_run_steps](../../api/prisma/schema.prisma#L21620)) · `AutomationSettings` ([automation_settings](../../api/prisma/schema.prisma#L21117)): `default_service_account_id` · enum `AutomationActionKind` ([L20953](../../api/prisma/schema.prisma#L20953)) · enum `AutomationAiStepKind` ([L21039](../../api/prisma/schema.prisma#L21039)) · enum `AutomationApprovalDecision` ([L21030](../../api/prisma/schema.prisma#L21030)) · enum `AutomationAssignStrategy` ([L20973](../../api/prisma/schema.prisma#L20973))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `AutomationRule` ([automation_rules](../../api/prisma/schema.prisma#L21274)): `current_version`, `enabled`, `imported_from` · `AutomationRuleTemplate` ([automation_rule_templates](../../api/prisma/schema.prisma#L21243)) · `AutomationRuleVersion` ([automation_rule_versions](../../api/prisma/schema.prisma#L21401)) · `AutomationTriggerDefinition` ([automation_trigger_definitions](../../api/prisma/schema.prisma#L21164)): `payload_schema`, `sample_payload` · enum `AutomationRuleScopeType` ([L20981](../../api/prisma/schema.prisma#L20981)) · enum `AutomationRuleStatus` ([L20990](../../api/prisma/schema.prisma#L20990)) · enum `AutomationRunMode` ([L20997](../../api/prisma/schema.prisma#L20997))
<!-- schema-section:end -->

* No-code builder with trigger, condition and action steps
* Test mode with sample events
* Dry run showing what would happen
* Versioning; editing a live rule creates a new version
* Editing a live rule never changes what runs: edits are saved as an unpublished draft (`draft_definition`); Publish copies the draft to the live definition, writes a new version and clears the draft, Discard drops it.
* Enable, disable, duplicate, export, import
* Templates per module (for example "Deal won → create project from template")
* Scope: organization, branch, team, project type

## 6. Execution Semantics

<!-- schema-section:start -->
> **Schema:** `AutomationActionDefinition` ([automation_action_definitions](../../api/prisma/schema.prisma#L21201)): `is_customer_facing`, `is_destructive`, `is_idempotent`, `retryable` · `AutomationApproval` ([automation_approvals](../../api/prisma/schema.prisma#L21669)) · `AutomationApprovalPolicy` ([automation_approval_policies](../../api/prisma/schema.prisma#L21714)) · `AutomationRule` ([automation_rules](../../api/prisma/schema.prisma#L21274)): `allow_destructive_actions`, `max_trigger_depth`, `rate_limit_per_hour`, `require_approval_for_destructive`, `serialize_per_record`, `timeout_seconds` · `AutomationRun` ([automation_runs](../../api/prisma/schema.prisma#L21522)): `idempotency_key`, `performed_destructive_action` · `AutomationRunLock` ([automation_run_locks](../../api/prisma/schema.prisma#L21788)) · `AutomationRunStep` ([automation_run_steps](../../api/prisma/schema.prisma#L21620)): `idempotency_key`, `is_destructive` · `AutomationSettings` ([automation_settings](../../api/prisma/schema.prisma#L21117)): `dead_letter_alert_membership_ids`, `dead_letter_alerts_enabled`, `default_max_retries`, `default_rule_rate_limit_per_hour`, `destructive_actions_enabled`, `destructive_requires_approval`, `max_trigger_depth`, `org_rate_limit_per_hour` · `PlatformEvent` ([platform_events](../../api/prisma/schema.prisma#L21438)): `trigger_depth` · `ScheduledJob` ([scheduled_jobs](../../api/prisma/schema.prisma#L21818)): `max_retries` · `WebhookDelivery` ([webhook_deliveries](../../api/prisma/schema.prisma#L21984)) · enum `AutomationApprovalDecision` ([L21030](../../api/prisma/schema.prisma#L21030)) · enum `AutomationRunStatus` ([L21004](../../api/prisma/schema.prisma#L21004)) · enum `AutomationStepStatus` ([L21018](../../api/prisma/schema.prisma#L21018)) · enum `WebhookDeliveryStatus` ([L21090](../../api/prisma/schema.prisma#L21090))
<!-- schema-section:end -->

* At-least-once event delivery with idempotent actions; each run carries an idempotency key.
* Ordered execution within a run; runs for the same record are serialized when the rule requires it.
* Retries with backoff for transient failures; dead-letter queue with alerting (14) for permanent failures.
* Loop protection: a rule cannot re-trigger itself through its own actions beyond a configurable depth.
* Rate limits per organization and per rule.
* Dead-letter alerts go to the rule owner (optional) and to `dead_letter_alert_membership_ids`, and optionally to a Messaging (12) channel.
* Approval steps can use a reusable `AutomationApprovalPolicy`: approvers by member, team or role, expiry, escalation after N hours and delegation while an approver is out of office. The first decision wins; quorum approval is Phase 2.
* Guardrails: destructive actions (delete, payment, external send to customers) require explicit enablement and can require human approval.
* Mandatory module logic (contract signed-version immutability, finance ledger rules, permission checks) is enforced by the module, not by rules, and cannot be bypassed by a rule.

## 7. Scheduled Jobs

<!-- schema-section:start -->
> **Schema:** `AutomationSettings` ([automation_settings](../../api/prisma/schema.prisma#L21117)): `job_run_retention_days` · `ScheduledJob` ([scheduled_jobs](../../api/prisma/schema.prisma#L21818)): `branch_id`, `max_retries` · `ScheduledJobRun` ([scheduled_job_runs](../../api/prisma/schema.prisma#L21882)) · enum `ScheduledJobKind` ([L21057](../../api/prisma/schema.prisma#L21057)) · enum `ScheduledJobRunStatus` ([L21072](../../api/prisma/schema.prisma#L21072)) · enum `ScheduledJobStatus` ([L21064](../../api/prisma/schema.prisma#L21064)) — other modules: `CrmReportSchedule` ([crm_report_schedules](../../api/prisma/schema.prisma#L3622)) ([02](./02-crm-sales-management.md))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `AutomationRuleVersion` ([automation_rule_versions](../../api/prisma/schema.prisma#L21401)) · `AutomationRun` ([automation_runs](../../api/prisma/schema.prisma#L21522)): `conditions_result`, `input` · `AutomationRunStep` ([automation_run_steps](../../api/prisma/schema.prisma#L21620)) · `AutomationSettings` ([automation_settings](../../api/prisma/schema.prisma#L21117)): `run_retention_days` · `ScheduledJobRun` ([scheduled_job_runs](../../api/prisma/schema.prisma#L21882)) · enum `AutomationRunStatus` ([L21004](../../api/prisma/schema.prisma#L21004)) · enum `AutomationStepStatus` ([L21018](../../api/prisma/schema.prisma#L21018))
<!-- schema-section:end -->

Every run is stored with trigger, inputs, conditions evaluated, each action and result, actor, duration and status. History is searchable by rule, record, status and date. Retention is configurable.

## 9. AI in Automations

<!-- schema-section:start -->
> **Schema:** `AutomationActionDefinition` ([automation_action_definitions](../../api/prisma/schema.prisma#L21201)): `output_schema` · `AutomationAiStep` ([automation_ai_steps](../../api/prisma/schema.prisma#L21746)): `confidence_threshold` · `AutomationApproval` ([automation_approvals](../../api/prisma/schema.prisma#L21669)) · `AutomationSettings` ([automation_settings](../../api/prisma/schema.prisma#L21117)): `ai_default_confidence_threshold` · enum `AutomationAiStepKind` ([L21039](../../api/prisma/schema.prisma#L21039))
<!-- schema-section:end -->

AI steps use the shared AI integration layer (`docs/Product_Specification.md` §6). Output is structured, carries a confidence score and can gate the next step on a threshold or human approval. AI steps never execute irreversible actions on their own.

## 10. Permissions

<!-- schema-section:start -->
> **Schema:** `AutomationActionDefinition` ([automation_action_definitions](../../api/prisma/schema.prisma#L21201)): `required_permission` · `AutomationSettings` ([automation_settings](../../api/prisma/schema.prisma#L21117)): `destructive_actions_enabled` · `AutomationTriggerDefinition` ([automation_trigger_definitions](../../api/prisma/schema.prisma#L21164)): `required_permission` — other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1614)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

* `automation.rules.read / create / update / delete / enable`
* `automation.runs.read`
* `automation.runs.manage` (retry, cancel, reprocess events, replay as a test); the event log with payloads is part of `automation.runs.read`, payloads redacted by the reader's permissions
* `automation.rules.run` (run a MANUAL rule), `automation.templates.manage` (publish organization templates), `automation.approval_policies.manage`
* `automation.actions.destructive.enable`
* `automation.service_accounts.manage` (with 01)

A user can only build rules whose actions they are themselves permitted to perform, or that run under a service account they manage.

## 11. Audit

<!-- schema-section:start -->
> **Schema:** `AutomationRun` ([automation_runs](../../api/prisma/schema.prisma#L21522)): `performed_destructive_action` — other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L2271)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Audit rule creation, edits, enable/disable, service account changes and every run that performs a destructive or customer-facing action.

## 12. API & Webhooks

<!-- schema-section:start -->
> **Schema:** `AutomationActionDefinition` ([automation_action_definitions](../../api/prisma/schema.prisma#L21201)) · `AutomationInboundWebhook` ([automation_inbound_webhooks](../../api/prisma/schema.prisma#L22028)) · `AutomationRun` ([automation_runs](../../api/prisma/schema.prisma#L21522)): `actor_membership_id` · `AutomationTriggerDefinition` ([automation_trigger_definitions](../../api/prisma/schema.prisma#L21164)) · `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L21930)): `subscribed_events` · `PlatformEvent` ([platform_events](../../api/prisma/schema.prisma#L21438)): `webhooks_processed_at` · `WebhookDelivery` ([webhook_deliveries](../../api/prisma/schema.prisma#L21984)) · enum `InboundWebhookAuthScheme` ([L21106](../../api/prisma/schema.prisma#L21106)) · enum `InboundWebhookStatus` ([L21099](../../api/prisma/schema.prisma#L21099)) · enum `OutboundWebhookStatus` ([L21083](../../api/prisma/schema.prisma#L21083)) · enum `WebhookDeliveryStatus` ([L21090](../../api/prisma/schema.prisma#L21090)) — other modules: `McpToolCall` ([mcp_tool_calls](../../api/prisma/schema.prisma#L2123)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

API: publish event (internal and external), CRUD rules, run rule manually, list runs, register trigger and action schemas (modules).

Inbound webhooks: external systems can trigger rules with a signed payload.

MCP: every tool call by an AI agent, API key or service account is logged in `McpToolCall` (01 §75, §136) with status, permission checked and the human confirmation of sensitive tools; `organizations.mcp_calls.read` opens the agent overview.

Plan quotas (runs per month, AI cost cap) are `OrganizationEntitlement` rows (`automation.runs_per_month`, `automation.ai_cost_cap_cents`, 01 §56). The engine counts usage; a HARD limit pauses new runs with a visible status, a SOFT limit notifies.

Outbound: `automation.rule_run_started`, `automation.rule_run_completed`, `automation.rule_run_failed`.

## 13. Recommended MVP

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Event bus with the module trigger catalog
* Rule builder with event triggers, simple conditions and these actions: update field, change status, assign, create task, notify, send template email, call webhook
* Scheduled jobs host for modules
* Run history and retries
* Loop protection and rate limits

## 14. Phase 2

<!-- schema-section:start -->
> **Schema:** `AutomationAiStep` ([automation_ai_steps](../../api/prisma/schema.prisma#L21746)) · `AutomationApproval` ([automation_approvals](../../api/prisma/schema.prisma#L21669)) · `AutomationInboundWebhook` ([automation_inbound_webhooks](../../api/prisma/schema.prisma#L22028)) · `AutomationRule` ([automation_rules](../../api/prisma/schema.prisma#L21274)): `run_as_service_account_id` · `AutomationRuleTemplate` ([automation_rule_templates](../../api/prisma/schema.prisma#L21243)) · `AutomationRun` ([automation_runs](../../api/prisma/schema.prisma#L21522)): `run_as_service_account_id` · `AutomationSettings` ([automation_settings](../../api/prisma/schema.prisma#L21117)): `default_service_account_id` · enum `InboundWebhookAuthScheme` ([L21106](../../api/prisma/schema.prisma#L21106)) · enum `InboundWebhookStatus` ([L21099](../../api/prisma/schema.prisma#L21099))
<!-- schema-section:end -->

* Date-relative triggers
* Wait and approval steps
* AI steps
* Rule templates library
* Inbound webhooks
* Service account execution
* Dry run and test mode
