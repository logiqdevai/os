# Project Management

> Linear: [LOG-405](https://linear.app/logiqdev/issue/LOG-405/project-management) · Status: Backlog

> **Canonical for:** Project, project types and lifecycle, project membership and roles, workspace, health, progress, objectives, Deliverables, Workstreams, Milestones, dependencies, Risks, Project Issues, Blockers, Decisions, status updates, Project Change Requests, approval and quality gates, acceptance criteria, templates, portfolio and parent/child projects, planned resource allocation, handover and closeout.
>
> **Terminology:** "Proposal" replaces the former "Offer"; "Customer" replaces "Client". A **Project Issue** (§30) is a delivery problem. It is not a Task (06 calls tasks "issues" in its UI) and not a Ticket (13).
>
> **Depends on:** [01](./01-users-organizations-permissions.md) (LOG-406) for Members, Teams, Branches (01 §32–33 branch projects), permissions, isolation · [02 CRM](./02-crm-sales-management.md) (LOG-404) for Customers · [03 Proposals](./03-proposal-quotation-generator.md) (LOG-303) · [04 Contracts](./04-contracts.md) (LOG-349) · [06 Task Management](./06-task-management.md) (LOG-102) for Tasks · [10 Employees](./10-employee-management-system.md) (LOG-107) for availability and capacity · [17 Documents](./17-documents-file-management.md) (LOG-407) · [18 Time Tracking](./18-time-tracking.md) (LOG-408) · [19 Calendar](./19-calendar.md) (LOG-409) · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) · [20 Automation Engine](./20-automation-engine.md) (LOG-410).
>
> **Consumed by:** 06 Tasks (project context), 07 Customer Portal (project surface), 08 Finance (project billing), 09 Income & Expense (project profitability), 12 Messaging (project channels), 13 Support (ticket to project link), 18 Time Tracking.

## 1. Overview

The Project Management module is the operational delivery layer of the Agency Operating System. It organizes customer and internal work from planning through completion while connecting the project to the other modules of the platform.

Projects must support software development, websites, mobile applications, AI automations, integrations, consulting, design, maintenance, retainers, internal initiatives, research, and other delivery models.

### Core principles

* A customer can have multiple projects.
* A project does not require a customer.
* A project may be created before a customer is assigned.
* Projects can be internal or external.
* A project can contain multiple workstreams, milestones, deliverables, and dependencies.
* Tasks remain owned by the dedicated Task Management module.
* Proposals, Contracts, Finance, Support, Time Tracking, Messaging, Documents, Customer Portal, Employees, and CRM remain the source of truth for their respective domains.
* Projects provide the operational context connecting these modules without duplicating their functionality.

## 2. Project Types

Organizations can define project types such as:

* Software development
* Website
* Mobile application
* AI automation
* API / integration
* Consulting
* Branding / design
* Migration
* Research
* Infrastructure
* Maintenance
* Support
* Retainer
* Fixed-scope delivery
* Time & materials
* Recurring service
* Internal initiative
* Product development
* Other

Project types can define defaults such as statuses, required fields, templates, milestones, workstreams, checklists, health rules, and permissions.

## 3. Customer Association

A project may optionally reference one primary customer.

### Required behavior

* One customer can have many projects.
* A project can have zero or one primary customer.
* A customer can be assigned after project creation.
* Removing a customer must not delete the project.
* Customer-association changes must be recorded in project history.
* Projects without customers must behave as first-class projects.

Examples of projects without a customer:

* Internal product development
* Company website
* Internal automation
* Infrastructure work
* Process improvement
* Research
* Prototype
* Internal marketing initiative

## 4. Project Lifecycle

Projects should support configurable lifecycle statuses.

Example defaults:

* Draft
* Planned
* Not Started
* In Progress
* On Hold
* Blocked
* Ready for Completion
* Completed
* Cancelled
* Archived

Organizations can configure allowed transitions and automation associated with them.

## 5. Project Creation

Projects can be created:

* Manually
* From an accepted Proposal
* From a signed Contract
* From a Customer Portal request
* From a Support request
* From a Project Template
* Through an API
* Through an import
* From an internal initiative
* From a recurring delivery workflow

### Core project fields

* Name
* Project ID
* Optional project code
* Description
* Type
* Status
* Customer
* Owner
* Team
* Priority
* Planned start
* Target completion
* Visibility
* Tags
* Custom fields

## 6. Project Identification

Each project has:

* Stable unique ID
* Human-readable name
* Optional project code
* URL / slug
* Optional icon
* Optional visual identifier
* External reference IDs

The internal project ID must remain stable even when the project name changes.

## 7. Project Owner

Each project should have a primary owner responsible for coordinating delivery.

The owner may be a project manager, account manager, technical lead, founder, department lead, or other authorized user.

The project owner is distinct from task assignees and does not replace task-level ownership.

## 8. Project Team

Projects can contain multiple internal participants.

Example roles:

* Project Manager
* Technical Lead
* Developer
* Designer
* QA
* Consultant
* Account Manager
* Customer Success
* Reviewer
* Contributor
* Stakeholder

Roles are configurable.

## 9. Project Membership

Each member may have:

* User
* Project role
* Permissions
* Join date
* Leave date
* Allocation
* Active/inactive state

Removing a member must preserve historical tasks, time records, comments, decisions, and activity.

## 10. Project Permissions

Project-level permissions should control capabilities such as:

* View project
* Edit project
* Manage members
* Manage milestones
* Manage workstreams
* Manage project settings
* Manage risks
* Manage dependencies
* Manage change requests
* View financial context
* View internal notes
* Manage project documents
* Archive project

Permissions are entries in the global permission catalog defined by [01](./01-users-organizations-permissions.md) §44–52 (project roles are a role type, 01 §45; project-level assignment, 01 §92). Keys follow 01 §46 (`projects.projects.read`, `projects.members.manage`, `projects.finance.read`).

## 11. Project Workspace

Every project should provide a dedicated workspace.

Recommended sections:

* Overview
* Activity
* Tasks
* Milestones
* Workstreams
* Roadmap
* Timeline
* Calendar
* Deliverables
* Risks
* Issues
* Blockers
* Dependencies
* Decisions
* Change Requests
* Status Updates
* Files
* Documents
* Team
* Time
* Financial Summary
* Customer Context
* Related Records
* Settings

Sections can be enabled or hidden by project type.

## 12. Project Overview

The overview should provide a high-level operational picture.

Display:

* Project name
* Customer
* Status
* Health
* Owner
* Team
* Dates
* Progress
* Current milestone
* Upcoming milestones
* Open blockers
* Critical risks
* Recent activity
* Upcoming deadlines
* Relevant financial summary
* Latest status update

## 13. Project Health

Project health should be represented separately from lifecycle status.

Example values:

* Healthy
* At Risk
* Blocked
* Critical
* Unknown

Health can be manually assigned, automatically calculated, or hybrid.

Potential signals:

* Overdue milestones
* Overdue tasks
* Schedule variance
* Open blockers
* Critical risks
* Budget variance
* Unresolved change requests
* Resource shortages
* Dependency delays
* Customer approval delays

## 14. Project Progress

Progress can be calculated using:

* Completed milestones
* Completed tasks
* Weighted deliverables
* Workstream progress
* Custom calculation
* Manual progress

The UI should distinguish between system-calculated and manually reported progress.

## 15. Project Dates

Projects can include:

* Planned start
* Actual start
* Target completion
* Actual completion
* Review date
* Internal deadline
* Customer deadline

Changes to important dates should be auditable.

## 16. Project Planning

Projects should support structured planning for:

* Objectives
* Scope
* Deliverables
* Milestones
* Workstreams
* Dependencies
* Assumptions
* Constraints
* Risks
* Resources
* Target dates
* Success criteria

Planning should remain operational rather than duplicating the commercial proposal or contract.

## 17. Project Objectives

Each project can contain objectives with:

* Name
* Description
* Owner
* Target date
* Success criteria
* Status
* Progress
* Related milestones
* Related deliverables

## 18. Deliverables

Deliverables represent tangible project outputs.

Fields may include:

* Name
* Description
* Owner
* Due date
* Status
* Acceptance criteria
* Related milestone
* Related tasks
* Related documents
* Related commercial scope references

Commercial pricing and contractual authority remain in Proposals and Contracts.

## 19. Workstreams

A project can be divided into independent workstreams.

Examples:

* Backend
* Frontend
* Mobile
* Design
* Infrastructure
* QA
* Content
* Customer onboarding
* Deployment
* Documentation

Each workstream may have an owner, members, status, progress, dates, tasks, milestones, and dependencies.

## 20. Milestones

Milestones represent major project checkpoints.

Fields:

* Name
* Description
* Status
* Owner
* Planned date
* Actual date
* Progress
* Dependencies
* Deliverables
* Related tasks
* Notes
* Custom fields

Example statuses:

* Planned
* In Progress
* At Risk
* Completed
* Cancelled

## 21. Milestone Dependencies

Milestones can depend on other milestones, workstreams, deliverables, tasks, or external project dependencies.

Dependency state should clearly show the blocking item, blocked item, dependency type, owner, expected resolution, and current status.

## 22. Task Management Integration

The Project module must integrate deeply with the dedicated Task Management module.

Projects provide context for tasks. The conceptual hierarchy can be:

**Project → Workstream → Milestone → Task → Subtask**

Tasks may also exist directly under a project.

The Project module must not duplicate task creation logic, task status logic, task comments, task assignees, task dependencies, or task-specific workflows.

Task Management remains the source of truth for tasks.

## 23. Task Visibility

Projects should surface relevant task information:

* Task name
* Status
* Priority
* Assignee
* Due date
* Progress
* Dependencies
* Workstream
* Milestone

Users should be able to navigate directly to the underlying task record.

## 24. Project Roadmap

The roadmap should provide a high-level delivery plan displaying objectives, workstreams, milestones, deliverables, dependencies, and target dates.

Views may include timeline, list, grouped by workstream, grouped by milestone, and grouped by status.

## 25. Project Timeline

Timeline visualization should display project start/end, workstreams, milestones, deliverables, dependencies, and deadlines.

Supported zoom levels:

* Week
* Month
* Quarter
* Custom range

## 26. Project Calendar

The project calendar can surface:

* Milestones
* Task deadlines
* Deliverable deadlines
* Project reviews
* Project meetings
* Approval deadlines
* Customer deadlines
* Relevant linked calendar events

The Calendar module ([19](./19-calendar.md), LOG-409) remains the source of truth for actual calendar events; milestone and deliverable dates are projected onto it read-only (19 §2).

## 27. Dependencies

Projects should support dependencies between tasks, milestones, workstreams, deliverables, and projects.

Supported dependency types may include:

* Finish-to-start
* Start-to-start
* Finish-to-finish
* Start-to-finish
* Blocks
* Blocked by
* Related

## 28. Cross-Project Dependencies

Projects can depend on other projects.

A dependency should record source project, target project, dependency type, owner, status, expected resolution, and notes.

## 29. Project Risks

Risks are potential events that may negatively affect delivery.

Fields:

* Title
* Description
* Category
* Probability
* Impact
* Severity
* Owner
* Status
* Mitigation
* Contingency
* Due date
* Related milestone
* Related task

Example statuses:

* Open
* Monitoring
* Mitigated
* Accepted
* Resolved
* Closed

## 30. Project Issues

Project issues represent active delivery problems and are distinct from Support tickets.

Fields:

* Title
* Description
* Severity
* Priority
* Owner
* Status
* Date identified
* Target resolution
* Resolution
* Related task
* Related milestone
* Related dependency

## 31. Project Blockers

Blockers are issues actively preventing progress.

A blocker should record description, blocking item, owner, severity, status, identified date, expected resolution, related task, related milestone, and related dependency.

Critical blockers should be visible on the project overview.

## 32. Project Decisions

Important project decisions should be recorded separately from general notes.

Fields:

* Decision title
* Description
* Date
* Decision maker
* Participants
* Alternatives considered
* Selected option
* Reason
* Consequences
* Related task
* Related milestone
* Related document

## 33. Project Notes

Projects can contain structured notes for internal notes, meeting notes, planning, technical context, customer context, decisions, and retrospectives.

Notes may contain rich text and attachments.

## 34. Project Documentation

Projects should provide access to relevant documentation such as requirements, specifications, architecture, designs, reports, and acceptance documentation.

The Documents module ([17](./17-documents-file-management.md), LOG-407) remains the source of truth for stored documents.

## 35. Project Files

Projects should provide a contextual file view for deliverables, designs, customer files, requirements, reports, attachments, and other project assets.

Files remain managed by [17 Documents & File Management](./17-documents-file-management.md). Project folder templates are defined there (17 §7). Project credentials (hosting, API keys) live in the credential vault (17 §12), never in project notes.

## 36. Project Templates

Templates should allow organizations to standardize recurring project structures.

A template may define project type, default statuses, milestones, workstreams, task structures, dependencies, roles, required fields, standard documents, checklists, health rules, and default views.

## 37. Template Versioning

Templates should support version, author, creation date, change history, and active/deprecated state.

Updating a template must not unexpectedly modify existing projects.

## 38. Project Duplication

Projects can be duplicated selectively.

Users should choose which elements to copy, such as basic settings, workstreams, milestones, deliverable structure, checklists, custom fields, and views.

Historical activity, comments, decisions, time records, and completed work must not be copied.

## 39. Project Status Updates

Structured project updates should include:

* Reporting period
* Summary
* Completed work
* Current work
* Upcoming work
* Progress
* Risks
* Blockers
* Decisions
* Required actions
* Owner
* Date

Status updates can be shared internally or with customers through the Customer Portal when permitted.

## 40. Project Reporting

Project reporting should surface status, health, progress, milestone progress, task completion, schedule performance, workload, resource allocation, logged time, financial context, risks, blockers, dependencies, change requests, and deliverables.

Reports should be configurable by role.

## 41. Project Dashboard

Dashboard widgets may include health, progress, milestones, upcoming deadlines, overdue tasks, blocked tasks, workload, time, financial summary, risks, dependencies, change requests, activity, and latest status update.

Users should be able to configure their project dashboard.

## 42. Project Activity

The project activity feed records project-level events such as project creation, status changes, owner changes, customer assignment, member changes, milestone creation/completion, deliverable changes, risk creation/resolution, decisions, change requests, completion, and archival.

Events should identify whether they were generated by a user or system automation. Messages remain in the Messaging module.

## 43. Project Change History

Important project fields should have an audit trail:

* Status
* Owner
* Customer
* Dates
* Priority
* Type
* Health
* Members
* Visibility
* Key configuration

History should include previous value, new value, actor, and timestamp.

## 44. Scope Management

The project should provide an operational view of included work, deliverables, exclusions, assumptions, constraints, acceptance criteria, and approved changes.

The authoritative commercial scope remains in Proposals and Contracts.

## 45. Change Requests

Change Requests manage changes that affect project delivery.

Fields:

* Title
* Description
* Requester
* Date
* Priority
* Scope impact
* Timeline impact
* Resource impact
* Cost impact reference
* Status
* Approval
* Related task
* Related deliverable
* Related Proposal
* Related Contract

Statuses:

* Requested
* Under Review
* Estimating
* Awaiting Approval
* Approved
* Rejected
* Scheduled
* Implemented
* Cancelled

The Project module tracks execution impact; commercial approval remains with the relevant commercial modules.

## 46. Approval Gates

Projects can define approval gates for requirements, design, development, QA, security, customer acceptance, launch, and handover.

Each gate can record approver, status, decision, date, comments, and related milestone.

## 47. Acceptance Criteria

Acceptance criteria can be defined for deliverables or milestones.

Fields:

* Requirement
* Expected outcome
* Verification method
* Status
* Reviewer
* Acceptance date

Contractual acceptance terms remain owned by Contracts.

## 48. Project Reviews

Projects may have structured reviews for kickoff, milestone review, delivery review, quality review, customer review, post-project review, and retrospective.

Each review can record findings, decisions, actions, owners, and due dates.

## 49. Retrospectives

Retrospectives should capture what went well, what went wrong, root causes, technical lessons, customer lessons, process improvements, and actions.

Actions may create tasks in Task Management.

## 50. Project Resources

Projects can reference employees, teams, contractors, external contributors, equipment, software/services, infrastructure, and customer resources.

Employee and resource information remains owned by the relevant modules.

## 51. Resource Allocation

Projects may record planned allocation by person/team, role, planned hours, date range, allocation percentage, workstream, and milestone.

Actual effort is recorded by [18 Time Tracking](./18-time-tracking.md).

Ownership split: Projects owns the **plan** (who is allocated to what, how much, when). [10 Employees](./10-employee-management-system.md) owns **availability and capacity** (working hours, leave, utilization). [18 Time Tracking](./18-time-tracking.md) owns **actuals**.

## 52. Capacity and Workload

Project views should surface overallocated people, resource conflicts, availability problems, deadline conflicts, and insufficient capacity.

[10 Employee Management](./10-employee-management-system.md) (LOG-107) remains authoritative for employee availability and capacity; utilization is computed by 18 Time Tracking. Projects only displays the result against its planned allocation.

## 53. External Stakeholders

Projects may contain customer contacts, executives, vendors, partners, consultants, and reviewers.

Stakeholders can have name, organization, role, responsibility, visibility, and decision authority.

## 54. Customer Context

For customer projects, the project should surface relevant context from the customer record: customer, contacts, related projects, proposals, contracts, support history, portal access, and financial references.

The Project module should not duplicate the customer record.

## 55. Multiple Projects Per Customer

The relationship must explicitly support:

**Customer → Many Projects**

Each project can have its own owner, team, scope, timeline, contract, proposal, deliverables, budget, status, support context, and lifecycle.

Projects remain independently manageable.

## 56. Projects Without Customers

The same project model must work without a customer.

Examples include internal products, internal websites, infrastructure, research, prototypes, internal automation, and operational improvements.

A customer can be added later without requiring project recreation.

## 57. Proposal Integration

An accepted Proposal may create or initialize a project.

A project can reference the Proposal, Proposal version, approved scope, commercial assumptions, and proposed deliverables.

Proposals remain the source of truth for proposal versions, pricing, commercial terms, and acceptance. Projects consume that context for delivery.

## 58. Contract Integration

Projects can reference one or more Contracts.

Project views may surface contract status, contract dates, contract type, relevant scope, relevant milestones, and related change requests.

Contracts remain the source of truth for contractual terms.

## 59. Task Management Integration

The Project module provides project context to Task Management.

Examples:

* Create task from project
* Assign task to project
* Associate task with milestone
* Associate task with workstream
* Show task progress in project
* Show blocked tasks in project health

Task Management owns the task record.

## 60. Customer Portal Integration

Projects may expose selected project information through the Customer Portal.

Potential customer-visible information:

* Project status
* Progress
* Milestones
* Approved deliverables
* Customer-visible tasks
* Documents
* Requests
* Change requests
* Status updates

Internal risks, notes, private financial data, and internal conversations must remain hidden unless explicitly permitted.

The Customer Portal owns customer authentication and access control.

## 61. Support Integration

Support tickets may reference project, customer, feature, task, release, and deliverable.

Projects should surface relevant support activity.

Support remains the source of truth for tickets, ticket lifecycle, queues, SLAs, and support workflows.

Project issues must not become support tickets automatically unless configured.

## 62. Messaging Integration

Projects may have a linked conversation or project channel.

Messaging remains responsible for messages, threads, channels, reactions, permissions, and notifications.

The project provides contextual navigation to relevant conversations.

## 63. Finance Integration

Projects can surface financial context such as revenue references, invoice references, payment status, project expenses, budget, cost, profitability, and financial variance.

Finance remains the source of truth for financial transactions.

Projects should not recreate invoices, expenses, or payment records.

## 64. Time Tracking Integration

Time entries may reference project, workstream, milestone, task, and employee.

Projects can show planned hours, logged hours, billable hours, non-billable hours, and hours by employee, workstream, and milestone.

[18 Time Tracking](./18-time-tracking.md) (LOG-408) owns the actual time entries.

## 65. Documents Integration

Projects should provide contextual access to requirements, specifications, designs, contracts, proposals, reports, acceptance records, and handover documents.

Documents remain owned by the Documents module.

## 66. Calendar Integration

Projects may connect to Calendar for meetings, reviews, milestone dates, deadlines, customer sessions, and approval events.

Calendar remains the source of truth for events.

## 67. Employee Integration

Projects reference employees and teams.

Employee Management remains responsible for employee records, employment information, team membership, availability, and employee-level permissions.

Projects consume the relevant employee context.

## 68. Project-to-Customer Relationship

The platform should clearly distinguish customer-level information from project-level information.

Customer-level examples:

* Company profile
* Contacts
* Customer relationship
* Overall commercial history

Project-level examples:

* Scope
* Timeline
* Team
* Milestones
* Deliverables
* Risks
* Project status

This prevents duplicated data and conflicting sources of truth.

## 69. Cross-Module Dependencies

A project may depend on records from other modules.

Examples include contract approval, proposal acceptance, customer approval, payment, support resolution, document approval, and employee availability.

The project should display the dependency and its state without taking ownership of the underlying record.

## 70. Project Status Automation

> Engine defined by → [20 Automation Engine](./20-automation-engine.md) · Linear LOG-410. Projects declares triggers and actions; rules run in the engine.

Examples of configurable workflows:

* Proposal accepted → Create project
* Contract signed → Move project to Planned
* First execution task started → Move project to In Progress
* Critical blocker created → Mark project At Risk
* All required milestones completed → Ready for Completion
* Customer acceptance recorded → Complete project
* Project completed → Trigger handover and retrospective

Automation rules must be configurable.

## 71. Project Completion

Completion should support a configurable checklist.

Possible requirements:

* Milestones completed
* Deliverables completed
* Tasks completed
* Blockers resolved
* Change requests resolved
* Acceptance recorded
* Documentation completed
* Financial review completed
* Customer handover completed
* Support handover completed
* Retrospective completed

Not every project type needs every requirement.

## 72. Handover

Projects may transition to maintenance, support, retainer, managed service, Customer Success, or internal ownership.

Handover can include new owner, date, documentation, open items, support references, contacts, operational notes, and outstanding tasks.

## 73. Archive

Archived projects should preserve history, relationships, documents, financial references, task references, and audit history while being removed from default active views.

They remain searchable according to permissions.

## 74. Reopening Projects

A completed project may be reopened when authorized.

Reopening should record reason, previous status, new status, owner, new dates, related change request if applicable, actor, and timestamp.

## 75. Project Search

Search should support project name, project ID, project code, customer, type, owner, team, status, health, tags, custom fields, dates, and related records.

## 76. Project Views

Supported views may include:

* List
* Table
* Kanban
* Timeline
* Calendar
* Roadmap
* Portfolio
* Dashboard
* Workload
* Archive

## 77. Saved Views

Users can save views with filters, sorting, grouping, visible columns, layout, and scope.

Saved views may be personal, team-wide, or organization-wide.

## 78. Portfolio View

Portfolio views aggregate projects and can display project, customer, type, owner, team, status, health, progress, start date, target completion, current milestone, risk, and budget summary.

## 79. Project Grouping

Projects can be grouped by customer, type, owner, team, status, health, priority, department, business unit, or custom field.

## 80. Project Priority

Projects should support configurable priority levels, for example:

* Critical
* High
* Medium
* Low

Project priority is separate from task priority.

## 81. Project Tags

Organizations can define project tags for categorization and filtering.

Examples:

* Strategic
* Maintenance
* Internal
* High-value
* Recurring
* Urgent
* Research

## 82. Project Custom Fields

> Defined by → [02 CRM](./02-crm-sales-management.md) §24–26 (platform custom field model) · Linear LOG-404.

Projects, milestones, deliverables, risks and change requests support custom fields using the platform model. Field types, validation, visibility and the API are defined in 02 §24 and §26.

## 83. Shared Custom Fields

Projects consume organization-wide shared custom field definitions (02 §25), for example region, department, business unit, service type, project category and customer tier. Projects does not define its own field type system.

## 84. Project API

Projects should be first-class API resources.

The API should support operations such as create project, retrieve project, update project, archive project, search projects, manage members, create and update milestones, manage relationships, manage custom fields, manage tags, create status updates, retrieve activity, and link external records.

The API should follow the platform's global API standards.

## 85. Project Webhooks

Recommended events:

* `project.created`
* `project.updated`
* `project.status_changed`
* `project.completed`
* `project.archived`
* `project.reopened`
* `project.member_added`
* `project.member_removed`
* `project.milestone_created`
* `project.milestone_completed`
* `project.health_changed`
* `project.risk_created`
* `project.risk_resolved`
* `project.change_request_created`
* `project.change_request_approved`
* `project.change_request_rejected`

Webhooks should support event IDs, signatures, retry handling, idempotency, and delivery history.

## 86. External Project References

Projects may reference external systems such as GitHub, GitLab, Jira, Linear, deployment systems, cloud infrastructure, and external documentation.

The external system remains the source of truth for its own records.

## 87. Project Integrations

Potential integrations include CRM, Task Management, Proposals, Contracts, Support, Finance, Time Tracking, Messaging, Customer Portal, Documents, Calendar, Employee Management, GitHub, GitLab, Linear, Jira, Notion, Google Drive, and Microsoft 365.

The Project module should provide relationship context rather than duplicate integrated records.

## 88. Project Activity Feed

The project feed should focus on operational project events, such as milestone completion, risk creation, blocker resolution, owner changes, customer assignment, deliverable approval, change request approval, and project status changes.

Messaging content remains in Messaging.

## 89. Notifications

> Engine defined by → [14 Notifications & Activity Center](./14-notifications-activity-center.md) · Linear LOG-403.

Projects emits these events: added to project, role changed, milestone approaching, milestone completed, deliverable approaching, project blocked, risk escalated, change request awaiting approval, status changed, health changed, project completed.

14 owns recipients, channels, preferences, inbox and delivery.

## 90. Reminders

Reminders can be created for milestones, deliverables, reviews, approvals, risk dates, change requests, completion actions, and handover actions.

## 91. Project Automation

> Engine defined by → [20 Automation Engine](./20-automation-engine.md) · Linear LOG-410.

Triggers Projects declares may include project creation, status change, milestone completion, deadline approaching, health change, risk creation, change request approval, and project completion.

Actions may include update project field, create task, assign user, create milestone, notify users, create reminder, link record, and trigger another module workflow.

## 92. Project Checklists

Projects may have reusable checklists for kickoff, discovery, development, QA, launch, handover, and closeout.

Checklist items may optionally create tasks.

## 93. Quality Gates

Quality gates can represent required controls such as code review, QA, security review, documentation, customer approval, and deployment approval.

A quality gate may block project completion.

## 94. Deadline Context

Projects should distinguish between internal target, customer target, contractual deadline, regulatory deadline, and soft deadline.

Contractual deadlines remain linked to the Contract record.

## 95. Project Metrics

Useful project metrics include progress, milestone completion, task completion, on-time delivery, schedule variance, risk count, blocker count, change request count, planned hours, logged hours, billable hours, budget reference, revenue reference, cost reference, and resource allocation.

## 96. Project Performance

Performance analysis may compare estimated vs actual duration, estimated vs actual effort, planned vs completed milestones, planned vs actual dates, number of changes, blocker duration, approval time, and budget variance.

## 97. Project Forecasting

Projects can forecast expected completion, remaining effort, milestone completion, resource requirements, and delivery risk.

Forecasts should clearly identify whether they are system calculated, manually entered, or AI-generated.

## 98. Multi-Team Projects

A project may include multiple internal teams, such as Sales / Account Management, Design, Engineering, QA, Infrastructure, Support, and Customer Success.

Each team can maintain its own operational work while remaining connected to the project.

## 99. Cross-Department Projects

Projects should support collaboration across departments while respecting permissions and information boundaries.

## 100. Project Governance

Complex projects may define project owner, sponsor, decision makers, stakeholders, approval gates, reporting cadence, risk owners, and change authority.

## 101. Escalation

Projects should support escalation for critical blockers, major delays, budget issues, scope issues, customer issues, resource shortages, and contract-related problems.

Escalations should record issue, severity, owner, escalated to, date, action, and resolution.

## 102. Team Handoffs

Projects should support operational handoffs such as Sales → Delivery, Delivery → Support, Development → QA, QA → Customer, and Project → Maintenance.

A handoff may contain from team, to team, owner, date, checklist, documentation, open issues, tasks, and acceptance.

## 103. Project Closeout

Closeout should consolidate final status, final deliverables, customer acceptance, outstanding items, lessons learned, documentation, handover, financial review, customer outcome, and retrospective.

## 104. Reusable Project Structures

Organizations should be able to reuse project structures across customers without copying historical records. This should primarily use Project Templates.

## 105. Project Relationships

Projects can have relationships such as parent project, child project, related project, dependency, replacement, follow-up, maintenance for, and continuation of.

## 106. Parent and Child Projects

Large engagements can be divided into child projects.

Each child project can have its own owner, team, status, timeline, tasks, milestones, deliverables, budget context, and contract reference.

The parent project provides portfolio-level coordination.

## 107. Project Hierarchy

An optional hierarchy may be:

**Customer → Parent Project / Engagement → Projects → Workstreams → Milestones → Tasks**

Not every project requires every hierarchy level.

## 108. Lightweight Projects

Small projects should not require complex configuration.

A lightweight project may contain only name, owner, status, deadline, and tasks.

Advanced fields should remain optional.

## 109. Complex Projects

Complex projects can enable workstreams, milestones, dependencies, risks, issues, blockers, change requests, approval gates, resource allocation, financial context, customer visibility, quality gates, and governance.

## 110. Security

> Defined by → [01](./01-users-organizations-permissions.md) §3, §9, §85, §136–137 · Linear LOG-406.

Projects consumes the central authorization service for authentication, authorization, tenant and customer isolation and API authorization. Project-specific additions: project roles (§8–10), external stakeholder controls (§53) and customer visibility flags (§60).

## 111. Customer Data Isolation

Customer isolation is the rule in 01 §116 and `docs/Product_Specification.md` §4.3: users associated with one customer never automatically gain access to another customer's projects, and internal projects remain separate from customer-visible projects. Projects enforces this through the visibility field and the central authorization service.

## 112. Internal Projects

Internal projects use the same core project model but do not require customer, Customer Portal access, external stakeholders, or commercial records.

## 113. Project Customization

Organizations should be able to configure project types, statuses, health states, priorities, roles, required fields, custom fields, templates, checklists, quality gates, approval gates, automations, and views.

## 114. Naming Conventions

Organizations may define project naming conventions such as customer code + project code, year + customer + project, or department + initiative.

Naming conventions should not affect the stable project ID.

## 115. API Extensibility

Projects should be designed as first-class platform resources so external systems can create projects, update projects, search projects, link customers, link proposals, link contracts, link tasks, link support tickets, link documents, manage milestones, manage members, read project activity, and read custom fields.

## 116. Cross-Module Webhook Workflows

Examples:

* Proposal accepted → project created
* Contract signed → project becomes Planned
* Project started → notify customer
* Milestone completed → update portal
* Change request approved → create execution tasks
* Project completed → notify Finance and Support
* Contract approaching expiry → project warning

## 117. Project Data Ownership

The Project module owns project-specific operational information:

* Project identity
* Project lifecycle
* Project health
* Project owner
* Project members
* Project team
* Project planning
* Objectives
* Workstreams
* Milestones
* Deliverables
* Risks
* Issues
* Blockers
* Dependencies
* Decisions
* Status updates
* Project-level change requests
* Project relationships
* Project configuration
* Project audit history

It does not become the source of truth for records owned by other modules.

## 118. Cross-Module Relationship Rules

Projects should reference external module records rather than duplicate them.

Examples:

* Customer → CRM
* Proposal → Proposals
* Contract → Contracts
* Task → Task Management
* Ticket → Support
* Invoice / payment / expense → Finance
* Time entry → Time Tracking
* Message → Messaging
* File / document → Documents
* Employee → Employee Management
* Calendar event → Calendar

The project displays relevant contextual information through these relationships.

## 119. Cross-Module Notifications

Examples:

* Project created → notify project team
* Milestone completed → notify relevant stakeholders
* Change request approved → update project and execution workflow
* Project completed → trigger closeout workflows
* Contract deadline approaching → display project warning
* Proposal accepted → initiate project creation workflow
* Support ticket linked to project → surface project impact

## 120. Recommended MVP

### Core

* Project creation
* Optional customer
* Project types
* Statuses
* Owners
* Members
* Permissions
* Project workspace
* Overview
* Progress
* Dates
* Health

### Planning

* Workstreams
* Milestones
* Deliverables
* Roadmap
* Timeline
* Dependencies

### Delivery visibility

* Task integration
* Risks
* Issues
* Blockers
* Decisions
* Status updates
* Activity history

### Organization

* Templates
* Search
* Views
* Saved views
* Tags
* Custom fields

### Integrations

* CRM / Customers
* Proposals
* Contracts
* Task Management
* Support
* Finance
* Time Tracking
* Documents
* Messaging
* Customer Portal
* Employees
* Calendar

### Platform

* API
* Webhooks
* Audit history
* Permissions
* Notifications

## 121. Phase 2

Add:

* Advanced dependencies
* Resource allocation
* Portfolio management
* Forecasting
* Change requests
* Approval gates
* Quality gates
* Team handoffs
* Retrospectives
* Cross-project dependencies
* Parent/child projects
* Advanced templates
* Automation
* Advanced reporting

## 122. Phase 3

Add:

* Advanced portfolio planning
* Capacity forecasting
* Resource optimization
* Cross-organization collaboration
* Enterprise governance
* Compliance workflows
* Advanced external integrations
* Advanced analytics
* Workflow orchestration
* AI-assisted project forecasting and risk detection

## 123. Success Criteria

The Projects module is successful when:

* A customer can have multiple independent projects.
* A project can exist without a customer.
* Projects work equally well for internal and external delivery.
* Projects can scale from lightweight to complex.
* Tasks remain owned by Task Management.
* Proposals provide commercial proposal context.
* Contracts provide contractual context.
* Support tickets can reference projects.
* Finance and Time Tracking provide financial and effort visibility.
* Customer Portal exposes approved project information.
* Messaging provides project communication.
* Risks, blockers, dependencies, deadlines, and deliverables are visible.
* Templates standardize recurring project structures.
* Portfolio views provide cross-project visibility.
* Projects maintain complete audit history.
* The module provides APIs and webhooks.
* No major data domain is duplicated between modules.

## 124. Module Relationship Summary

| Module | Relationship to Projects | Source of Truth |
| -- | -- | -- |
| [01 Identity & Permissions](./01-users-organizations-permissions.md) | Members, teams, branches, roles, isolation | LOG-406 |
| [02 CRM](./02-crm-sales-management.md) | Associates customers and customer context; custom field model | LOG-404 |
| [03 Proposals](./03-proposal-quotation-generator.md) | Provides proposed commercial scope and may initiate projects | LOG-303 |
| [04 Contracts](./04-contracts.md) | Provides contractual context and obligations | LOG-349 |
| [06 Task Management](./06-task-management.md) | Executes project work | LOG-102 |
| [13 Support](./13-customer-support-communication-hub.md) | Handles customer support issues related to projects | LOG-342 |
| [08 Finance](./08-financial-management-stripe-integration.md) / [09 Income & Expense](./09-income-expense-management.md) | Invoices, payments, expenses, costs, profitability | LOG-104 / LOG-105 |
| [18 Time Tracking](./18-time-tracking.md) | Records actual project effort | LOG-408 |
| [12 Messaging](./12-messaging-team-communication.md) | Provides project communication | LOG-313 |
| [17 Documents](./17-documents-file-management.md) | Stores project documents, files and credentials | LOG-407 |
| [07 Customer Portal](./07-customer-portal.md) | Exposes approved project information to customers | LOG-103 |
| [10 Employees](./10-employee-management-system.md) | Employee records, availability and capacity | LOG-107 |
| [19 Calendar](./19-calendar.md) | Project-related events and projected dates | LOG-409 |
| [14 Notifications](./14-notifications-activity-center.md) | Delivers project events | LOG-403 |
| [20 Automation Engine](./20-automation-engine.md) | Runs project rules and workflows | LOG-410 |
| Projects | Coordinates delivery and project-specific operational context | LOG-405 |

### Final architectural principle

The Project module should be the **operational coordination layer** of the Agency Operating System.

It connects commercial context, customer context, execution, communication, support, financial visibility, documentation, and resources into a single project workspace.

It should **reference and orchestrate other modules rather than replace them**.
