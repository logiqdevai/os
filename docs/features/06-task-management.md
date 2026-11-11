# Task Management

> Linear: [LOG-102](https://linear.app/logiqdev/issue/LOG-102/task-management) · Status: Backlog

> **Canonical for:** Task, Subtask, task fields and relationships, task statuses and workflows, labels, estimates, backlog and agile planning, task views, bulk operations, Releases, task-level comments and the task workload view. Task Management is the only task entity in the platform: CRM follow-ups, support fixes, project work, customer requests and retrospective actions are all Tasks linked to their originating record.
>
> **Terminology:** The UI may call a Task an "Issue" (Linear style). A **Project Issue** (05 §30) is a delivery problem, and a **Ticket** (13) is a support case; neither is a Task. Projects, Milestones and Workstreams are owned by [05 Project Management](./05-project-management.md).
>
> **Depends on:** [01](./01-users-organizations-permissions.md) (LOG-406) for Members, Teams, permissions, isolation · [05 Projects](./05-project-management.md) (LOG-405) for Project, Workstream and Milestone context · [02 CRM](./02-crm-sales-management.md) §24–26 (LOG-404) for custom fields · [17 Documents](./17-documents-file-management.md) (LOG-407) for attachments · [18 Time Tracking](./18-time-tracking.md) (LOG-408) for estimates vs actuals and timers · [10 Employees](./10-employee-management-system.md) (LOG-107) for capacity · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for recurring tasks and status rules · [12 Messaging](./12-messaging-team-communication.md) (LOG-313) for task discussions.
>
> **Consumed by:** 02 CRM (§14 sales tasks), 05 Projects (§22–23, §59), 07 Customer Portal (customer-visible tasks), 13 Support (§4 ticket-to-task), 18 Time Tracking, 19 Calendar (due dates projected).

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (16)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Configuration** | | | |
| `TaskStatus` | `task_statuses` | [L5212](../../api/prisma/schema.prisma#L5212) | 06 §3 — configurable statuses with workflow transitions. Scoped to a Team when team_id is set, otherwise organization-wide. |
| `TaskType` | `task_types` | [L5243](../../api/prisma/schema.prisma#L5243) | 06 §3 — task types (task, bug, feature, improvement, chore, follow-up …). |
| `TaskLabel` | `task_labels` | [L5265](../../api/prisma/schema.prisma#L5265) | 06 §3 — Linear-style labels. Platform tags (02 §36) also apply to tasks. |
| `Cycle` | `cycles` | [L5286](../../api/prisma/schema.prisma#L5286) | 06 §4 — cycles / sprints, per team or project. |
| **Task** | | | |
| `Task` | `tasks` | [L5315](../../api/prisma/schema.prisma#L5315) | 06 §1, §3, §6, §12 — the Task record (full-text search over title/description, inline editing). Work hierarchy: Organization → Team → Project → Workstream/Mi… |
| `TaskAssignee` | `task_assignees` | [L5423](../../api/prisma/schema.prisma#L5423) | 06 §3 — additional assignees beyond the primary assignee. |
| `TaskLabelAssignment` | `task_label_assignments` | [L5436](../../api/prisma/schema.prisma#L5436) |  |
| `TaskDependency` | `task_dependencies` | [L5449](../../api/prisma/schema.prisma#L5449) | 06 §3 — blocks / related / duplicates between tasks, including cross-project links. |
| `TaskChecklistItem` | `task_checklist_items` | [L5466](../../api/prisma/schema.prisma#L5466) | 06 §3 — checklists inside a task. |
| `TaskComment` | `task_comments` | [L5482](../../api/prisma/schema.prisma#L5482) | 06 §7 — comments with threads, mentions and reactions. Customer-visible comments surface in 07. |
| `TaskAttachment` | `task_attachments` | [L5511](../../api/prisma/schema.prisma#L5511) | 06 §8 — attachments are Documents (17 §2). |
| `TaskLink` | `task_links` | [L5528](../../api/prisma/schema.prisma#L5528) | 06 §13 — polymorphic link from a task to the record it originated from or serves: CRM records (02 §14), tickets (13 §4), project change requests (05), custom… |
| `TaskStatusHistory` | `task_status_history` | [L5547](../../api/prisma/schema.prisma#L5547) | 06 §4, §11 — status transition log per task; source for lead time, cycle time, throughput and time-in-status metrics. Full field-level history stays in audit… |
| `TaskWatcher` | `task_watchers` | [L5569](../../api/prisma/schema.prisma#L5569) | Members following a task for notifications (14). |
| **Releases** | | | |
| `Release` | `releases` | [L5585](../../api/prisma/schema.prisma#L5585) | 06 §9 — a shippable set of tasks. A Release may map to a Project Milestone (05). |
| `ReleaseDeployment` | `release_deployments` | [L5619](../../api/prisma/schema.prisma#L5619) | 06 §9 — deployment status per environment. |

**Owned enums (7):** `TaskStatusCategory`, `TaskPriority`, `TaskDependencyType`, `CycleStatus`, `ReleaseStatus`, `DeploymentStatus`, `TaskCommentVisibility`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Task.assignee`, `Task.reporter`, `TaskAssignee.membership`, `TaskComment.author` +1 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `Cycle.organization`, `Release.organization`, `Task.organization`, `TaskLabel.organization` +2 more |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `Cycle.team`, `Release.team`, `Task.team`, `TaskStatus.team` |
| [05](./05-project-management.md) | `Project` (`projects`) | `Cycle.project`, `Release.project`, `Task.project` |
| [05](./05-project-management.md) | `ProjectMilestone` (`project_milestones`) | `Task.milestone` |
| [05](./05-project-management.md) | `ProjectType` (`project_types`) | `TaskStatus.project_type` |
| [05](./05-project-management.md) | `ProjectWorkstream` (`project_workstreams`) | `Task.workstream` |
| [17](./17-documents-file-management.md) | `Document` (`documents`) | `Release.notes_document`, `TaskAttachment.document` |
| [20](./20-automation-engine.md) | `AutomationRule` (`automation_rules`) | `Task.automation_rule` |

**Reused enums:** `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [04](./04-contracts.md): `ContractObligation`
- [05](./05-project-management.md): `ProjectChangeRequest`, `ProjectChecklistItem`, `ProjectIssue`
- [13](./13-customer-support-communication-hub.md): `TicketTaskLink`
- [15](./15-notion-business-docs.md): `FormSubmission`, `WikiChecklistRunItem`
- [18](./18-time-tracking.md): `TimeEntry`, `TimeSuggestion`, `Timer`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `ContractObligation.project_id` ([04](./04-contracts.md), [L3950](../../api/prisma/schema.prisma#L3950)) — Related Project (05) and Task (06); ids only.
- `ProjectChecklistItem.task_id` ([05](./05-project-management.md), [L4966](../../api/prisma/schema.prisma#L4966)) — Task created from this item (06).
- `Employee.onboarding_completed_at` ([10](./10-employee-management-system.md), [L7939](../../api/prisma/schema.prisma#L7939)) — Onboarding tasks are Tasks linked via TaskLink(EMPLOYEE) (06 §13); workflows in 20.
- `SupportSettings.default_task_type_id` ([13](./13-customer-support-communication-hub.md), [L12006](../../api/prisma/schema.prisma#L12006)) — 13 §4 — default project / task type used when converting tickets (06 TaskType id).
- `Ticket.release_id` ([13](./13-customer-support-communication-hub.md), [L12435](../../api/prisma/schema.prisma#L12435)) — 06 Release that shipped the fix (notified to the customer, §4); id only.
- `SupportIncident.project_id` ([13](./13-customer-support-communication-hub.md), [L12732](../../api/prisma/schema.prisma#L12732)) — 05 Project / 06 Task the incident is tracked in; ids only.
- `KnowledgeArticle.release_id` ([13](./13-customer-support-communication-hub.md), [L12859](../../api/prisma/schema.prisma#L12859)) — 06 Release whose notes this article publishes, when applicable; id only.
- `WikiChecklistItem.task_type_id` ([15](./15-notion-business-docs.md), [L14410](../../api/prisma/schema.prisma#L14410)) — Task type (06 §3) for the generated Task; id only.
- `CustomForm.opens_at` ([15](./15-notion-business-docs.md), [L14503](../../api/prisma/schema.prisma#L14503)) — Automatic 06 Task / 13 Ticket creation is configured in 20 rules; this is the default hint shown there.

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
| `tasks.bulk` | execute |
| `tasks.comments.internal` | read |
| `tasks.cycles` | manage |
| `tasks.releases` | manage |
| `tasks.tasks` | read, create, update, delete*, archive, export*, assign |
| `tasks.workflows` | manage |
| `tasks.workload` | read |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Overview

<!-- schema-section:start -->
> **Schema:** `Task` ([tasks](../../api/prisma/schema.prisma#L5315))
<!-- schema-section:end -->

Develop a **Linear-inspired task management system** that provides a fast and highly responsive experience for planning, tracking and delivering work. The module covers the lifecycle of a work item from backlog to release.

### Work hierarchy

**Organization → Team → Project → Workstream / Milestone → Task → Subtask**

Organization and Team come from 01. Project, Workstream and Milestone come from 05. Tasks may also exist directly under a Project or, for personal and CRM work, without a Project.

## 2. Project Context

<!-- schema-section:start -->
> **Schema:** `Task` ([tasks](../../api/prisma/schema.prisma#L5315)): `project_id`
<!-- schema-section:end -->

> Defined by → [05 Project Management](./05-project-management.md) · Linear LOG-405.

Project overview, health, objectives, templates, duplication, archive, documentation, customer visibility settings and project-level activity are defined in 05. Task Management does not redefine them. It consumes project context (project, workstream, milestone, project roles, customer visibility flag) when creating and displaying tasks.

## 3. Task Record

<!-- schema-section:start -->
> **Schema:** `Task` ([tasks](../../api/prisma/schema.prisma#L5315)): `actual_hours`, `blocked_reason`, `cloned_from_task_id`, `duplicate_of_task_id` · `TaskAssignee` ([task_assignees](../../api/prisma/schema.prisma#L5423)) · `TaskChecklistItem` ([task_checklist_items](../../api/prisma/schema.prisma#L5466)) · `TaskDependency` ([task_dependencies](../../api/prisma/schema.prisma#L5449)) · `TaskLabel` ([task_labels](../../api/prisma/schema.prisma#L5265)) · `TaskStatus` ([task_statuses](../../api/prisma/schema.prisma#L5212)): `project_type_id` · `TaskType` ([task_types](../../api/prisma/schema.prisma#L5243)): `template` · enum `TaskDependencyType` ([L5172](../../api/prisma/schema.prisma#L5172)) · enum `TaskPriority` ([L5163](../../api/prisma/schema.prisma#L5163)) · enum `TaskStatusCategory` ([L5152](../../api/prisma/schema.prisma#L5152)) — other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L1570)) ([01](./01-users-organizations-permissions.md)) · `WikiChecklistItem` ([wiki_checklist_items](../../api/prisma/schema.prisma#L14410)): `task_type_id` ([15](./15-notion-business-docs.md))
<!-- schema-section:end -->

Tasks should include:

* Title and rich Markdown description
* Task type (task, bug, feature, improvement, chore, follow-up; configurable)
* Status (configurable per team or project type, with workflow transitions)
* Priority
* Assignees (one primary, optional additional)
* Reporter
* Project, workstream, milestone (optional)
* Team
* Labels, tags, categories
* Checklists
* Acceptance criteria
* Start date, due date, completion date
* Estimate (points or hours) and actual effort (from 18 Time Tracking)
* Attachments (17 Documents)
* Comments and threaded discussion
* Activity timeline, version history, audit log
* Custom fields (02 §24–26)
* Customer visibility flag (visible in Customer Portal or internal only)
* Related records: CRM record (02), Ticket (13), Project Change Request (05), Customer Request (07), Release

Tasks should support:

* Parent tasks and subtasks
* Dependencies: blocks, blocked by, related, duplicates
* Duplicate detection
* Cross-project links
* Cloning and templates
* Recurring tasks (schedule defined in 20 Automation Engine, instances created here)
* Bulk editing, assignment, status update, labeling, deletion

## 4. Planning & Agile

<!-- schema-section:start -->
> **Schema:** `Cycle` ([cycles](../../api/prisma/schema.prisma#L5286)) · `TaskStatusHistory` ([task_status_history](../../api/prisma/schema.prisma#L5547)) · enum `CycleStatus` ([L5179](../../api/prisma/schema.prisma#L5179))
<!-- schema-section:end -->

Support Agile and traditional methodologies:

* Backlog management and triage
* Kanban workflows
* Cycles / sprints with carry-over of unfinished work
* Story point estimation
* Lead time, cycle time, throughput
* Release planning

## 5. Views

<!-- schema-section:start -->
> **Schema:** other modules: `SavedView` ([saved_views](../../api/prisma/schema.prisma#L1786)) ([02](./02-crm-sales-management.md))
<!-- schema-section:end -->

Provide multiple synchronized views:

* Kanban board
* List
* Table
* Calendar (due dates; events come from 19 Calendar)
* Timeline / Gantt
* Roadmap (grouped by milestone or release)
* Workload (task distribution per assignee)
* Backlog
* Release

Users can save custom views, group, filter, sort and customize visible columns. Saved views can be personal, team or organization-wide.

## 6. Search & Filtering

<!-- schema-section:start -->
> **Schema:** `Task` ([tasks](../../api/prisma/schema.prisma#L5315)): `search_vector`
<!-- schema-section:end -->

Full-text search across all tasks in the organization, filtered by assignee, team, project, milestone, label, priority, status, due date, tag, custom field and related record. Task search feeds the platform global search.

## 7. Collaboration

<!-- schema-section:start -->
> **Schema:** `TaskComment` ([task_comments](../../api/prisma/schema.prisma#L5482)) · enum `TaskCommentVisibility` ([L5203](../../api/prisma/schema.prisma#L5203))
<!-- schema-section:end -->

* Comments with mentions, reactions and threads
* Internal notes versus customer-visible comments (customer-visible comments surface in 07 Customer Portal)
* Live updates and real-time synchronization
* Task discussions can open a contextual conversation in 12 Messaging (12 §25); the comment thread on the task remains the record of decisions
* Notifications for assignment, mention, status change, due soon, overdue, blocked and comment are emitted to 14 Notifications

## 8. Attachments & Files

<!-- schema-section:start -->
> **Schema:** `TaskAttachment` ([task_attachments](../../api/prisma/schema.prisma#L5511))
<!-- schema-section:end -->

> Defined by → [17 Documents & File Management](./17-documents-file-management.md) · Linear LOG-407.

Tasks attach Documents. Folder organization, versions, previews, deliverable files and project file storage are owned by 17. Credentials belong in the credential vault (17 §12), never in task descriptions.

## 9. Releases

<!-- schema-section:start -->
> **Schema:** `Release` ([releases](../../api/prisma/schema.prisma#L5585)) · `ReleaseDeployment` ([release_deployments](../../api/prisma/schema.prisma#L5619)) · enum `ReleaseStatus` ([L5187](../../api/prisma/schema.prisma#L5187))
<!-- schema-section:end -->

Task Management owns Releases:

* Release name, version, target date, status (planned, in progress, released, cancelled)
* Tasks included
* Deployment status per environment
* Release notes (generated from included tasks, publishable to the Customer Portal and Support knowledge base)
* Customers affected (from linked Tickets, 13 §4)

Milestones are project checkpoints owned by 05; a Release may map to a Milestone.

## 10. Workload

<!-- schema-section:start -->
> **Schema:** `Task` ([tasks](../../api/prisma/schema.prisma#L5315)): `blocked_reason`
<!-- schema-section:end -->

Task Management provides the **task distribution** view: open tasks, estimates and due dates per assignee and team, plus bottleneck detection on blocked and overdue work.

Capacity, availability and utilization are defined by [10 Employees](./10-employee-management-system.md) and [18 Time Tracking](./18-time-tracking.md). Planned allocation is defined by [05 Projects](./05-project-management.md) §51. The workload view combines these without owning them.

## 11. Reporting & Analytics

<!-- schema-section:start -->
> **Schema:** `Task` ([tasks](../../api/prisma/schema.prisma#L5315)): `actual_hours` · `TaskStatusHistory` ([task_status_history](../../api/prisma/schema.prisma#L5547))
<!-- schema-section:end -->

Dashboards and reports for:

* Task completion rate, overdue and blocked tasks
* Cycle and sprint performance
* Lead time, cycle time, throughput
* Estimate vs actual (with 18)
* Workload distribution
* Release progress

Project-level progress, health and milestone reporting are in 05 §40–41.

## 12. Productivity

<!-- schema-section:start -->
> **Schema:** `Task` ([tasks](../../api/prisma/schema.prisma#L5315))
<!-- schema-section:end -->

* Drag-and-drop, inline editing, optimistic UI, instant search
* Auto-save, undo/redo, quick actions, command palette, keyboard shortcuts
* Task templates and bulk operations

## 13. Linked Work from Other Modules

<!-- schema-section:start -->
> **Schema:** `TaskLink` ([task_links](../../api/prisma/schema.prisma#L5528)) — other modules: `Employee` ([employees](../../api/prisma/schema.prisma#L7939)): `onboarding_completed_at` ([10](./10-employee-management-system.md)) · `TicketTaskLink` ([ticket_task_links](../../api/prisma/schema.prisma#L12670)) ([13](./13-customer-support-communication-hub.md))
<!-- schema-section:end -->

| Source | Relationship |
| -- | -- |
| 02 CRM §14 | Sales follow-ups are Tasks linked to Lead, Company, Contact or Deal |
| 13 Support §4 | Tickets convert to Tasks with a permanent link and bidirectional status sync |
| 07 Customer Portal | Customer requests become Tickets (13) first; approved work becomes Tasks |
| 05 Projects §45, §49, §92 | Approved change requests, retrospective actions and checklist items create Tasks |
| 04 Contracts §49 | Contract obligations may create Tasks |
| 10 Employees | Onboarding and HR actions may create Tasks |

Task Management exposes "create task from record" and "link task to record" so no module duplicates task logic.

## 14. AI Features

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

AI should be able to:

* Break a project or requirement into milestones (05) and tasks
* Generate subtasks and acceptance criteria
* Estimate effort
* Prioritize and suggest assignment based on workload and skills (10)
* Detect blockers, risks and delivery delays
* Summarize progress and draft status updates (05 §39) and customer updates (07)
* Generate technical specifications and release notes
* Answer questions about task status

AI output is editable and reviewable (`docs/Product_Specification.md` §4.9).

## 15. Permissions

<!-- schema-section:start -->
> **Schema:** other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1224)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Keys follow 01 §46:

* `tasks.tasks.read / create / update / delete / assign`
* `tasks.comments.internal.read`
* `tasks.workflows.manage`
* `tasks.releases.manage`
* `tasks.bulk.execute`

Project roles (05 §10) and customer visibility flags determine which tasks a Member or Customer Portal user can see.

## 16. API & Webhooks

<!-- schema-section:start -->
> **Schema:** other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L18603)) ([20](./20-automation-engine.md))
<!-- schema-section:end -->

API: CRUD tasks and subtasks, transitions, assignment, comments, links to records, bulk operations, saved views, releases.

Webhooks: `task.created`, `task.updated`, `task.status_changed`, `task.assigned`, `task.completed`, `task.deleted`, `task.comment_added`, `task.linked`, `release.created`, `release.deployed`. Delivery follows the platform standard in `docs/Product_Specification.md` §4.

## 17. Recommended MVP

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Task record, subtasks, statuses, priorities, labels, assignees
* Kanban, list, table and backlog views with saved views
* Comments, mentions, attachments
* Dependencies and duplicates
* Cycles and estimates
* Links to CRM, Projects, Tickets
* Search, bulk operations, keyboard shortcuts
* Events to 14 and 20

## 18. Phase 2

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Releases and deployment status
* Workload view
* Recurring tasks via 20
* Estimate vs actual with 18
* AI breakdown, estimation and assignment
* Customer-visible tasks in 07
