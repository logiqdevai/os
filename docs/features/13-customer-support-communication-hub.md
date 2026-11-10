# Customer Support & Communication Hub

> Linear: [LOG-342](https://linear.app/logiqdev/issue/LOG-342/3-customer-support-and-communication-hub) · Status: Backlog · Assignee: Anna Zoi

Build a comprehensive, AI-powered customer communication and support
platform inspired by Intercom. It should function as the central
communication layer of the application, connecting customers, team
members, projects, tasks, and all existing application entities.

**Core principle: Do not duplicate existing functionality or entities.**
Reuse the existing customer records, organizations, contacts, users,
projects, tasks, files, notifications, and permission systems. The
support module should reference and extend these entities rather than
creating separate versions of them.

The system should provide a unified inbox for customer communication,
ticket management, live chat, automation, AI assistance, and customer
self-service.

## 1. Unified Inbox & Conversations

Create an Intercom-style unified inbox where all customer conversations
are accessible from one place.

* Unified conversation inbox
* Real-time live chat
* Website and in-app messaging
* Email conversations
* Email-to-ticket conversion
* Customer conversation history
* Conversation assignment to team members
* Team inboxes and shared inboxes
* Conversation ownership
* Internal team collaboration
* Private internal notes
* @mentions and team notifications
* Conversation tagging
* Conversation prioritization
* Conversation status (Open, Pending, Snoozed, Resolved)
* Conversation merging
* Conversation splitting
* Conversation transfers between teams
* Saved replies and response templates
* Canned responses
* Customer typing indicators
* Read receipts
* File and image attachments
* Conversation search and filters
* Full communication timeline per customer

All communication channels must connect to the same customer identity
and conversation history.

## 2. Support Ticket Management

Implement a complete ticket management system integrated with the
unified inbox.

* Automatic ticket number generation
* Ticket creation from conversations, emails, forms, and customer
  portal
* Ticket status and lifecycle management
* Priority levels (Low, Normal, High, Urgent)
* Custom ticket categories
* Custom ticket fields
* Ticket assignment to users and teams
* Ticket ownership and reassignment
* SLA policies and tracking
* First response time tracking
* Resolution time tracking
* Escalation rules
* Customer replies
* Internal notes
* Attachments
* Ticket history and audit trail
* Ticket relationships and dependencies
* Related tickets
* Duplicate ticket detection
* Ticket merging
* Bulk ticket operations
* Automated ticket routing
* Custom views and saved filters

Tickets must be connected to the existing Customer, Contact,
Organization, Project, and Task entities wherever applicable.

## 3. AI-Powered Support (JEV -- Typesafe AI Model)

Integrate the JEV model from Typesafe AI as the primary AI intelligence
layer for support operations.

AI should assist both customers and support agents, with human oversight
and configurable automation.

### AI ticket categorization

* Automatically identify ticket categories.
* Classify the issue type and subcategory.
* Detect technical bugs, feature requests, billing questions, account
  issues, and general inquiries.
* Identify urgency and suggested priority.
* Detect sentiment and customer frustration.
* Extract relevant entities, products, projects, and affected
  features.
* Identify duplicate or related tickets.
* Suggest the appropriate team and assignee.
* Estimate issue complexity.
* Detect potential SLA breaches.
* Provide confidence scores for classifications.

### AI conversation assistance

* Generate suggested customer replies.
* Summarize long conversations.
* Generate conversation summaries when transferring ownership.
* Suggest relevant knowledge-base articles.
* Identify missing information and ask follow-up questions.
* Translate customer messages.
* Detect language automatically.
* Improve and rewrite agent responses.
* Recommend troubleshooting steps.
* Extract action items from conversations.
* Identify feature requests and product feedback.

### AI customer support agent

* Provide automated first-line customer support.
* Answer questions using the knowledge base and authorized application
  data.
* Guide customers through troubleshooting.
* Retrieve relevant customer, project, and task information according
  to permissions.
* Collect information before escalating to a human.
* Automatically create tickets when human assistance is required.
* Escalate sensitive, uncertain, or complex issues.
* Maintain conversation context when handing over to a human agent.

### AI automation and intelligence

* Automatically categorize incoming tickets.
* Recommend or execute ticket assignments based on configurable rules.
* Detect recurring problems.
* Identify emerging product issues.
* Group tickets related to the same incident.
* Suggest task creation for technical issues.
* Generate structured bug reports.
* Identify potential knowledge-base gaps.
* Analyze customer feedback.
* Generate support performance insights.

All AI actions should support configurable confidence thresholds,
permissions, human approval, and audit logging.

## 4. Automatic Ticket-to-Task & Issue Creation

This is a critical integration with the existing Task Manager.

Allow support tickets to be converted into actionable tasks or technical
issues without manually recreating information.

### Automatic issue creation workflow

 1. A customer reports a bug through live chat, email, or the support
    portal.
 2. JEV analyzes the conversation and identifies it as a potential
    technical issue.
 3. AI extracts the problem description, reproduction steps, expected
    behavior, actual behavior, affected functionality, and relevant
    attachments.
 4. The system checks the existing Task Manager for duplicate or related
    issues.
 5. AI recommends the appropriate project, task type, priority, and
    development team.
 6. Based on automation settings, the system either requests approval or
    automatically creates the task.
 7. The task is created in the existing Task Manager.
 8. The task maintains a permanent relationship with the original
    support ticket and customer.
 9. Developers work on the issue using the existing task management
    functionality.
10. Task status changes synchronize with the support ticket.
11. When the issue is fixed, the support team is notified.
12. The customer receives an update and the ticket can be resolved.

### Ticket-to-task integration capabilities

* One-click conversion of tickets into tasks.
* Automatic issue creation based on AI classification.
* Configurable automatic creation rules.
* Manual approval before task creation.
* Duplicate issue detection.
* Link multiple tickets to one task.
* Link multiple tasks to one ticket.
* Create tasks inside existing projects.
* Select existing project automatically using AI.
* Map ticket priority to task priority.
* Transfer descriptions, attachments, and relevant conversation
  context.
* Preserve customer and ticket references.
* Synchronize task and ticket statuses.
* Notify agents when development updates occur.
* Notify customers when fixes are released.
* Track which customers are affected by an issue.
* Reopen support tickets when necessary.

**Important:** Creating a task must use the existing Task Manager
entities and workflows. Do not implement a second task management system
inside Support.

## 5. Customer Portal

Provide a customer-facing support portal connected to the existing
customer accounts.

* Submit support requests.
* Create and view tickets.
* Track ticket status.
* Reply to existing tickets.
* Upload attachments.
* View conversation history.
* Access knowledge-base articles.
* Search FAQs.
* View announcements and service updates.
* Submit feature requests.
* View relevant project updates where authorized.
* Receive notifications about ticket changes.
* Access support through an embedded messaging widget.

Customer access must respect existing organization membership, roles,
permissions, and data isolation.

## 6. Knowledge Base & Help Center

Build an integrated knowledge management system.

* Public and private articles.
* Categories and collections.
* Article version history.
* Rich-text editor.
* Images, videos, and attachments.
* Search functionality.
* Article ratings and feedback.
* Frequently asked questions.
* Related article suggestions.
* AI-generated article drafts.
* AI-powered semantic search.
* Automatic article recommendations during conversations.
* Identify knowledge gaps from recurring tickets.
* Suggest new documentation based on resolved issues.
* Control public and internal article visibility.

JEV should use approved knowledge-base content as a primary source for
customer-facing answers.

## 7. Automation & Workflows

Implement a flexible support automation engine.

* Automatic ticket categorization.
* Assignment rules.
* Priority-based routing.
* SLA escalation.
* Automatic responses.
* Follow-up reminders.
* Ticket status automation.
* Customer notification workflows.
* Inactivity detection.
* Automatic ticket closure after configurable periods.
* Reopen rules.
* Duplicate ticket detection.
* AI-triggered workflows.
* Event-based automation.
* Conditional workflows.
* Time-based workflows.
* Workflow execution history.

Allow administrators to create custom automation rules without writing
code.

## 8. Customer Timeline & Unified Activity

Every customer should have a unified activity timeline that brings
together information from the entire application.

Display:

* Support conversations.
* Support tickets.
* Emails.
* Internal notes.
* Customer interactions.
* Related projects.
* Related tasks.
* Feature requests.
* Meetings and relevant activities.
* Notifications.
* Important status changes.

Use existing customer and organization records as the source of truth.

Support agents should be able to understand the customer's history,
active projects, outstanding tasks, and previous issues without
switching between disconnected modules.

## 9. Support Analytics & Reporting

Provide dashboards and reports for support operations.

* Total conversations.
* Total tickets.
* Open and unresolved tickets.
* Ticket volume over time.
* Average first response time.
* Average resolution time.
* SLA compliance.
* SLA breach rate.
* Customer satisfaction (CSAT).
* Agent performance.
* Team performance.
* Ticket distribution by category.
* Ticket distribution by priority.
* Ticket sources and channels.
* AI resolution rate.
* AI classification accuracy.
* Automated versus manual ticket handling.
* Recurring problems.
* Most reported product bugs.
* Feature request trends.
* Customer sentiment trends.
* Development issues generated from support tickets.
* Time from ticket creation to development resolution.

Provide filters by date, team, agent, customer, organization, project,
and ticket category.

## 10. Notifications & Communication

Integrate with the application's existing notification infrastructure.

* New ticket notifications.
* New customer replies.
* Assignment notifications.
* Internal mentions.
* SLA warnings.
* Escalation notifications.
* Task creation notifications.
* Developer updates.
* Task completion notifications.
* Customer resolution notifications.
* Follow-up reminders.

Support configurable in-app, email, and other existing notification
channels.

## 11. Integrations & Shared Application Entities

The Support module must be fully interconnected with the rest of the
application.

Reuse existing entities and services:

* **Customers & CRM:** Shared customer profiles, contacts,
  organizations, and customer history.
* **Task Manager:** Direct ticket-to-task conversion and bidirectional
  status synchronization.
* **Projects:** Link tickets to existing projects and their
  development work.
* **Users & Teams:** Shared users, roles, permissions, assignments,
  and team structures.
* **Files & Attachments:** Reuse the existing file storage and
  attachment infrastructure.
* **Notifications:** Use the existing notification engine.
* **Communication:** Integrate with existing email, messaging, and
  communication services.
* **AI Infrastructure:** Use JEV from Typesafe AI through a shared AI
  integration layer.
* **Knowledge Base:** Reuse the application's existing documentation
  and knowledge entities if available.
* **Automation Engine:** Integrate with existing automation and
  workflow infrastructure.
* **Analytics:** Expose support metrics to the application's existing
  reporting system.

Avoid creating duplicate customer records, task entities, project
entities, user records, file storage, notification systems, or AI
infrastructure.

## 12. Example End-to-End Workflow

**Customer reports a bug → AI identifies the issue → Support ticket →**
**Duplicate detection → Existing project identified → Development task**
**automatically created → Developer assigned → Fix implemented → Task**
**completed → Support ticket updated → Customer notified → Ticket**
**resolved.**

The customer, support agent, and developer should all see the relevant
information and status updates from their respective application
modules.

## 13. Architecture & Implementation Requirements

* Treat Support as a first-class application module.
* Build the unified inbox around conversations, with tickets as
  structured support records.
* Maintain shared entity references rather than duplicating existing
  records.
* Use the existing authentication, authorization, and organization
  isolation systems.
* Use real-time event-driven communication where appropriate.
* Maintain a complete audit trail.
* Support configurable custom fields and statuses.
* Provide APIs and webhooks for external integrations.
* Design for multiple support teams and organizations.
* Make AI functionality modular and configurable.
* Use JEV from Typesafe AI for classification, extraction,
  recommendations, and AI-assisted workflows.
* Make all AI operations observable, permission-aware, and auditable.
* Support human approval for sensitive or high-impact actions.
* Ensure ticket-to-task conversion is transactional and prevents
  accidental duplicate task creation.
* Synchronize related entities through explicit events and
  relationships rather than creating competing sources of truth.

## 14. Core Data Model & Relationship Principles

Keep three distinct concepts:

* **Conversation:** The communication thread between the customer and
  your team.
* **Ticket:** The structured support case, with priority, SLA, status,
  ownership, and resolution.
* **Task/Issue:** The actual work required to solve the problem,
  managed exclusively by the existing Task Manager.

One conversation can have multiple tickets, and multiple tickets can
point to the same development issue. A ticket may also be associated
with multiple conversations or tasks when the workflow requires it.

Use references to existing customer, contact, organization, project,
task, user, team, and file records. Do not create parallel versions of
those entities.

Ticket-to-task creation should be idempotent and protected against
duplicate submissions. Store the relationship and source references so
that updates can be traced in both modules. Synchronization should use
explicit, auditable events and clearly defined status mappings; avoid
uncontrolled update loops.

## Final Objective

Deliver an Intercom-like customer communication and support experience
that feels native to the application. Customers communicate through one
unified interface, support teams manage everything through one inbox, AI
handles classification and repetitive work, and technical problems flow
directly into the existing Task Manager and Project Management systems.
