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

### Owned tables (15)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Configuration** | | | |
| `TaskStatus` | `task_statuses` | [L4658](../../api/prisma/schema.prisma#L4658) | 06 §3 — configurable statuses with workflow transitions. Scoped to a Team when team_id is set, otherwise organization-wide. |
| `TaskType` | `task_types` | [L4683](../../api/prisma/schema.prisma#L4683) | 06 §3 — task types (task, bug, feature, improvement, chore, follow-up …). |
| `TaskLabel` | `task_labels` | [L4705](../../api/prisma/schema.prisma#L4705) | 06 §3 — Linear-style labels. Platform tags (02 §36) also apply to tasks. |
| `Cycle` | `cycles` | [L4726](../../api/prisma/schema.prisma#L4726) | 06 §4 — cycles / sprints, per team or project. |
| **Task** | | | |
| `Task` | `tasks` | [L4755](../../api/prisma/schema.prisma#L4755) | 06 §3 — the Task record. Work hierarchy: Organization → Team → Project → Workstream/Milestone → Task → Subtask. Project is optional for personal and CRM work. |
| `TaskAssignee` | `task_assignees` | [L4845](../../api/prisma/schema.prisma#L4845) | 06 §3 — additional assignees beyond the primary assignee. |
| `TaskLabelAssignment` | `task_label_assignments` | [L4858](../../api/prisma/schema.prisma#L4858) |  |
| `TaskDependency` | `task_dependencies` | [L4871](../../api/prisma/schema.prisma#L4871) | 06 §3 — blocks / related / duplicates between tasks, including cross-project links. |
| `TaskChecklistItem` | `task_checklist_items` | [L4888](../../api/prisma/schema.prisma#L4888) | 06 §3 — checklists inside a task. |
| `TaskComment` | `task_comments` | [L4904](../../api/prisma/schema.prisma#L4904) | 06 §7 — comments with threads, mentions and reactions. Customer-visible comments surface in 07. |
| `TaskAttachment` | `task_attachments` | [L4933](../../api/prisma/schema.prisma#L4933) | 06 §8 — attachments are Documents (17); id only until 17 exists. |
| `TaskLink` | `task_links` | [L4949](../../api/prisma/schema.prisma#L4949) | 06 §13 — polymorphic link from a task to the record it originated from or serves: CRM records (02 §14), tickets (13 §4), project change requests (05), custom… |
| `TaskWatcher` | `task_watchers` | [L4967](../../api/prisma/schema.prisma#L4967) | Members following a task for notifications (14). |
| **Releases** | | | |
| `Release` | `releases` | [L4983](../../api/prisma/schema.prisma#L4983) | 06 §9 — a shippable set of tasks. A Release may map to a Project Milestone (05). |
| `ReleaseDeployment` | `release_deployments` | [L5016](../../api/prisma/schema.prisma#L5016) | 06 §9 — deployment status per environment. |

**Owned enums (7):** `TaskStatusCategory`, `TaskPriority`, `TaskDependencyType`, `CycleStatus`, `ReleaseStatus`, `DeploymentStatus`, `TaskCommentVisibility`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Task.assignee`, `Task.reporter`, `TaskAssignee.membership`, `TaskComment.author` +1 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `Cycle.organization`, `Release.organization`, `Task.organization`, `TaskLabel.organization` +2 more |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `Cycle.team`, `Release.team`, `Task.team`, `TaskStatus.team` |
| [05](./05-project-management.md) | `Project` (`projects`) | `Cycle.project`, `Release.project`, `Task.project` |
| [05](./05-project-management.md) | `ProjectMilestone` (`project_milestones`) | `Task.milestone` |
| [05](./05-project-management.md) | `ProjectWorkstream` (`project_workstreams`) | `Task.workstream` |

**Reused enums:** `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [04](./04-contracts.md): `ContractObligation`
- [05](./05-project-management.md): `ProjectChangeRequest`, `ProjectChecklistItem`, `ProjectIssue`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `ContractObligation.project_id` ([04](./04-contracts.md), [L3487](../../api/prisma/schema.prisma#L3487)) — Related Project (05) and Task (06); ids only.
- `ProjectChecklistItem.task_id` ([05](./05-project-management.md), [L4460](../../api/prisma/schema.prisma#L4460)) — Task created from this item (06).

<!-- schema-refs:end -->

## 1. Overview

Develop a **Linear-inspired task management system** that provides a fast and highly responsive experience for planning, tracking and delivering work. The module covers the lifecycle of a work item from backlog to release.

### Work hierarchy

**Organization → Team → Project → Workstream / Milestone → Task → Subtask**

Organization and Team come from 01. Project, Workstream and Milestone come from 05. Tasks may also exist directly under a Project or, for personal and CRM work, without a Project.

## 2. Project Context

> Defined by → [05 Project Management](./05-project-management.md) · Linear LOG-405.

Project overview, health, objectives, templates, duplication, archive, documentation, customer visibility settings and project-level activity are defined in 05. Task Management does not redefine them. It consumes project context (project, workstream, milestone, project roles, customer visibility flag) when creating and displaying tasks.

## 3. Task Record

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

Support Agile and traditional methodologies:

* Backlog management and triage
* Kanban workflows
* Cycles / sprints with carry-over of unfinished work
* Story point estimation
* Lead time, cycle time, throughput
* Release planning

## 5. Views

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

Full-text search across all tasks in the organization, filtered by assignee, team, project, milestone, label, priority, status, due date, tag, custom field and related record. Task search feeds the platform global search.

## 7. Collaboration

* Comments with mentions, reactions and threads
* Internal notes versus customer-visible comments (customer-visible comments surface in 07 Customer Portal)
* Live updates and real-time synchronization
* Task discussions can open a contextual conversation in 12 Messaging (12 §25); the comment thread on the task remains the record of decisions
* Notifications for assignment, mention, status change, due soon, overdue, blocked and comment are emitted to 14 Notifications

## 8. Attachments & Files

> Defined by → [17 Documents & File Management](./17-documents-file-management.md) · Linear LOG-407.

Tasks attach Documents. Folder organization, versions, previews, deliverable files and project file storage are owned by 17. Credentials belong in the credential vault (17 §12), never in task descriptions.

## 9. Releases

Task Management owns Releases:

* Release name, version, target date, status (planned, in progress, released, cancelled)
* Tasks included
* Deployment status per environment
* Release notes (generated from included tasks, publishable to the Customer Portal and Support knowledge base)
* Customers affected (from linked Tickets, 13 §4)

Milestones are project checkpoints owned by 05; a Release may map to a Milestone.

## 10. Workload

Task Management provides the **task distribution** view: open tasks, estimates and due dates per assignee and team, plus bottleneck detection on blocked and overdue work.

Capacity, availability and utilization are defined by [10 Employees](./10-employee-management-system.md) and [18 Time Tracking](./18-time-tracking.md). Planned allocation is defined by [05 Projects](./05-project-management.md) §51. The workload view combines these without owning them.

## 11. Reporting & Analytics

Dashboards and reports for:

* Task completion rate, overdue and blocked tasks
* Cycle and sprint performance
* Lead time, cycle time, throughput
* Estimate vs actual (with 18)
* Workload distribution
* Release progress

Project-level progress, health and milestone reporting are in 05 §40–41.

## 12. Productivity

* Drag-and-drop, inline editing, optimistic UI, instant search
* Auto-save, undo/redo, quick actions, command palette, keyboard shortcuts
* Task templates and bulk operations

## 13. Linked Work from Other Modules

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

Keys follow 01 §46:

* `tasks.tasks.read / create / update / delete / assign`
* `tasks.comments.internal.read`
* `tasks.workflows.manage`
* `tasks.releases.manage`
* `tasks.bulk.execute`

Project roles (05 §10) and customer visibility flags determine which tasks a Member or Customer Portal user can see.

## 16. API & Webhooks

API: CRUD tasks and subtasks, transitions, assignment, comments, links to records, bulk operations, saved views, releases.

Webhooks: `task.created`, `task.updated`, `task.status_changed`, `task.assigned`, `task.completed`, `task.deleted`, `task.comment_added`, `task.linked`, `release.created`, `release.deployed`. Delivery follows the platform standard in `docs/Product_Specification.md` §4.

## 17. Recommended MVP

* Task record, subtasks, statuses, priorities, labels, assignees
* Kanban, list, table and backlog views with saved views
* Comments, mentions, attachments
* Dependencies and duplicates
* Cycles and estimates
* Links to CRM, Projects, Tickets
* Search, bulk operations, keyboard shortcuts
* Events to 14 and 20

## 18. Phase 2

* Releases and deployment status
* Workload view
* Recurring tasks via 20
* Estimate vs actual with 18
* AI breakdown, estimation and assignment
* Customer-visible tasks in 07
