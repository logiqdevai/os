# CRM & Sales Management

> Linear: [LOG-404](https://linear.app/logiqdev/issue/LOG-404/crm-and-sales-management) · Status: Backlog

> **Canonical for:** Company, Contact, Lead, Deal, Pipeline, CRM Activities (calls, meetings, notes, follow-ups), customer lifecycle, Customer 360 view, record ownership and assignment rules, CRM import/export, and the platform-wide **Custom Fields and Shared Custom Fields** model (§24–26).
>
> **Depends on:** [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) (LOG-406) for Members, Teams, Branches, permissions and branch-scoped customers (01 §31, §37) · [06 Task Management](./06-task-management.md) (LOG-102) for Tasks linked to CRM records · [19 Calendar](./19-calendar.md) (LOG-409) for meeting events · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for sales automation rules · [17 Documents](./17-documents-file-management.md) (LOG-407) for attachments.
>
> **Consumed by:** 03 Proposals, 04 Contracts, 05 Projects (customer association), 07 Customer Portal, 08 Finance (billing profiles reference Companies), 11 Communication Center (contacts and segmentation), 12 Messaging (record sharing), 13 Support (customer identity and timeline).
>
> **Terminology:** "Company" is the CRM record. "Customer" is a Company whose lifecycle stage is Customer or later. "Organization" is reserved for the platform tenant (01) and is never used for a CRM company.

Develop a comprehensive **CRM and Sales Management system** comparable to HubSpot CRM, but designed specifically for software agencies and with a highly extensible architecture.

The CRM should provide a complete view of the relationship between the agency, leads, prospects, companies, contacts, deals, proposals, contracts, projects, invoices, support activity, and customer history.

The CRM should function as the central source of truth for all commercial relationships and sales activity, while integrating seamlessly with the existing Proposal, Project, Customer Portal, Contract, Finance, and Support modules.

---

# 1. CRM Core Entities

The CRM should support the following primary entities:

CRM-owned entities:

* Contacts
* Companies (including Customers, Partners and Vendors as company types or lifecycle stages)
* Leads
* Deals / Opportunities
* Activities (calls, meetings, notes, follow-ups)

Entities owned by other modules and linked from the CRM:

* Tasks → [06 Task Management](./06-task-management.md)
* Proposals → [03 Proposals](./03-proposal-quotation-generator.md)
* Contracts → [04 Contracts](./04-contracts.md)
* Projects → [05 Project Management](./05-project-management.md)
* Tickets → [13 Customer Support](./13-customer-support-communication-hub.md)
* Invoices, Payments, Subscriptions → [08 Finance](./08-financial-management-stripe-integration.md)
* Meeting events → [19 Calendar](./19-calendar.md)

Entities should be interconnected so users can navigate the complete relationship history.

For example:

```text
Company
  ├── Contacts
  ├── Leads
  ├── Deals
  ├── Proposals
  ├── Contracts
  ├── Projects
  ├── Invoices
  ├── Payments
  └── Support Tickets
```

---

# 2. Companies

Provide complete company management. A Company is any external legal entity the agency deals with: prospect, customer, partner or vendor. Company type and lifecycle stage distinguish them; there is one record model.

Each company should support:

* Company name
* Legal name
* Industry
* Company size
* Website
* Country
* Address
* Phone
* Tax/VAT information
* Registration information
* Company type
* Lead source
* Account owner
* Customer status
* Customer since
* Annual revenue
* Number of employees
* Description
* Tags
* Notes
* Custom fields
* Related contacts
* Related deals
* Related proposals
* Related contracts
* Related projects
* Related invoices
* Related payments
* Related support tickets
* Activity history

Support parent/child company relationships for customer groups with subsidiaries, regional entities or departments. These are CRM company relationships; they are not platform Branches (01 §16) and not platform Organizations (01 §8).

A Company is organization-wide by default and may carry branch relationships for branch sales ownership and reporting (01 §31, §37) without being duplicated per branch.

---

# 2a. Vendors & Partners

Vendors and partners use the Company and Contact model with a company type of Vendor or Partner.

Typical vendor contacts an agency needs at hand:

* Accountant / accounting firm
* Lawyer / legal counsel
* Bank contact
* Hosting and infrastructure providers
* Software vendors
* Subcontractors and freelancers
* Insurance

Vendor companies link to supplier invoices and expenses in [09 Income & Expense](./09-income-expense-management.md) and to vendor or contractor agreements in [04 Contracts](./04-contracts.md). Contractors who need platform access are External Collaborators per 01 §77; the CRM record and the platform membership are separate.

---

# 3. Contacts

Provide detailed contact management.

Each contact should support:

* First name
* Last name
* Full name
* Job title
* Department
* Email addresses
* Phone numbers
* Mobile number
* Website
* LinkedIn or other external profiles
* Company
* Contact owner
* Contact type
* Lead status
* Lifecycle stage
* Lead source
* Tags
* Notes
* Custom fields
* Related deals
* Related activities
* Related proposals
* Related projects
* Related tickets

Support multiple contacts belonging to the same company.

Allow users to identify specific contacts as:

* Primary contact
* Decision maker
* Technical contact
* Billing contact
* Project stakeholder
* Executive contact

---

# 4. Lead Management

Provide a dedicated lead management system for prospects that have not yet become qualified opportunities.

Lead records should support:

* Lead name
* Company
* Contact
* Lead source
* Lead owner
* Lead status
* Industry
* Estimated company size
* Estimated deal value
* Qualification status
* Qualification notes
* Lead score
* Tags
* Custom fields
* Activities
* Follow-ups
* Notes
* Related contacts
* Related companies
* Conversion history

Lead statuses should be configurable, for example:

* New
* Contacted
* Attempting Contact
* Connected
* Qualified
* Unqualified
* Nurture
* Converted
* Lost

---

# 5. Lead Sources

Track where every lead originated.

Support configurable lead sources such as:

* Website
* Referral
* Existing Customer
* Partner
* Networking
* Event
* Cold Outreach
* Advertisement
* Organic Search
* Social Media
* Direct
* Import
* API
* Other

Track source attribution throughout the sales lifecycle so management can understand which sources generate the most valuable customers.

---

# 6. Lead Qualification

Provide structured lead qualification.

Users should be able to evaluate:

* Business need
* Budget
* Authority
* Timeline
* Company size
* Project type
* Estimated value
* Fit
* Urgency
* Probability of conversion

Allow organizations to create their own qualification criteria.

Support lead scoring based on configurable rules and manually assigned scores.

---

# 7. Lead Conversion

Provide a controlled lead conversion workflow.

A qualified lead should be convertible into:

* Contact
* Company
* Deal
* Customer

When converting a lead, preserve the complete history and relationships instead of creating duplicate records.

Users should be able to select which existing company/contact records should be associated with the converted lead.

---

# 8. Sales Pipeline

Provide a complete visual sales pipeline similar to HubSpot.

Support:

* Multiple pipelines
* Pipeline-specific stages
* Kanban view
* List view
* Forecast view
* Pipeline filters
* Drag-and-drop stage movement
* Deal sorting
* Deal grouping
* Pipeline totals
* Weighted pipeline value
* Expected revenue
* Conversion rates
* Stage duration
* Deal velocity

Different pipelines should be configurable for different sales processes.

For example:

```
New Opportunity
      ↓
Discovery
      ↓
Qualified
      ↓
Proposal
      ↓
Negotiation
      ↓
Verbal Agreement
      ↓
Closed Won
      ↓
Closed Lost
```

# 9. Deals / Opportunities

Provide comprehensive deal management.

Each deal should support:

* Deal name
* Company
* Primary contact
* Additional contacts
* Pipeline
* Deal stage
* Deal owner
* Deal value
* Currency
* Probability
* Expected close date
* Actual close date
* Deal type
* Lead source
* Products/services
* Line items
* Recurring revenue
* One-time revenue
* Discount
* Tax
* Notes
* Tags
* Custom fields
* Competitor
* Lost reason
* Next step
* Forecast category
* Related proposal
* Related contract
* Related project
* Related activities

---

# 10. Deal Products & Line Items

Deals should support structured commercial line items.

Each deal may contain:

* Products
* Services
* Packages
* Development hours
* Maintenance plans
* Support plans
* Subscriptions
* Custom services

For each line item support:

* Name
* Description
* Quantity
* Unit price
* Discount
* VAT
* Net amount
* Gross amount
* Recurring or one-time
* Billing frequency

The deal total should automatically update when line items change.

# 11. Deal Forecasting

Provide sales forecasting capabilities.

Calculate:

* Total pipeline value
* Weighted pipeline value
* Expected revenue
* Forecast by month
* Forecast by quarter
* Forecast by year
* Closed won revenue
* Closed lost value
* Pipeline coverage
* Average deal size
* Win rate
* Average sales cycle
* Revenue by salesperson
* Revenue by pipeline
* Revenue by service
* Revenue by source

Support configurable forecast categories such as:

* Pipeline
* Best Case
* Commit
* Closed Won
* Closed Lost

---

# 12. Deal Activities

Every deal should maintain a complete activity timeline.

Track:

* Calls
* Meetings
* Tasks
* Notes
* Follow-ups
* Proposal activity
* Contract activity
* Stage changes
* Value changes
* Ownership changes
* Customer interactions
* Internal comments

The activity timeline should provide a chronological history of the relationship and deal.

---

# 13. Activities

Provide a unified activity system across the CRM.

Activities should include:

* Calls
* Meetings
* Tasks
* Follow-ups
* Notes
* Reminders
* Appointments
* Internal comments

Every activity should support:

* Title
* Description
* Date
* Start time
* End time
* Duration
* Owner
* Participants
* Related company
* Related contact
* Related deal
* Related project
* Status
* Priority
* Notes
* Attachments

Activities should be visible from both the individual record and a centralized activity view.

---

# 14. Tasks & Follow-Ups

> Defined by → [06 Task Management](./06-task-management.md) · Linear LOG-102.

CRM tasks are ordinary Tasks owned by Task Management, linked to a Lead, Company, Contact or Deal. The CRM does not implement a second task entity. The CRM surfaces linked Tasks on the record and in the activity timeline, and offers quick creation with the CRM record pre-linked.

Examples of sales tasks:

* Call prospect
* Schedule discovery meeting
* Send proposal
* Follow up after proposal
* Contact decision maker
* Request requirements
* Review contract
* Follow up on negotiation

Due dates, priority, assignee, recurrence, reminders and completion are Task features (06). The CRM adds:

* Related CRM record (required for a CRM-created task)
* Task type "Follow-up" as a default task template
* Visibility of the task on the related Company, Contact, Lead and Deal

Automatic follow-up reminders for inactive deals are an Automation Engine rule (20) that creates a Task.

---

# 15. Meetings

> Event record defined by → [19 Calendar](./19-calendar.md) · Linear LOG-409.

A CRM meeting is a Calendar event of type customer meeting linked to CRM records. Calendar owns the event (date, time, attendees, location, link). The CRM owns the sales context stored on the Activity: outcomes, notes and follow-ups.

The meeting activity in the CRM should expose:

* Meeting title
* Date
* Time
* Duration
* Participants
* Company
* Contacts
* Deal
* Project
* Location
* Meeting URL
* Notes
* Outcomes
* Follow-up tasks
* Attachments

Meeting notes should remain attached to the relevant CRM records.

---

# 16. Notes

Provide flexible notes throughout the CRM.

Notes should support:

* Rich text
* Markdown
* Attachments
* Mentions
* Tags
* Internal/private visibility
* Timestamp
* Author
* Edit history

Notes should be attachable to:

* Companies
* Contacts
* Leads
* Deals
* Projects
* Contracts
* Tickets

---

# 17. Customer Lifecycle

Provide configurable lifecycle stages such as:

```
Lead
  ↓
Marketing Qualified
  ↓
Sales Qualified
  ↓
Opportunity
  ↓
Customer
  ↓
Active Customer
  ↓
Inactive Customer
  ↓
Former Customer
```

Lifecycle stages should be configurable by the organization.

Maintain historical lifecycle changes.

# 18. Customer 360 View

Every company and contact should have a unified **360° relationship view**.

The customer profile should show:

* Company information
* Contacts
* Open deals
* Won deals
* Lost deals
* Proposals
* Contracts
* Projects
* Invoices
* Payments
* Subscriptions
* Support tickets
* Activities
* Meetings
* Tasks
* Notes
* Documents
* Revenue
* Customer lifetime value
* Last activity
* Next scheduled activity
* Customer owner
* Tags
* Custom fields

This should provide a complete understanding of the customer's relationship with the agency.

---

# 19. Customer Revenue & Commercial History

Provide financial visibility directly inside CRM records.

For each customer show:

* Total revenue
* Open deal value
* Closed won value
* Outstanding invoices
* Paid invoices
* Active subscriptions
* Recurring revenue
* Historical revenue
* Average deal size
* Number of projects
* Number of proposals
* Proposal conversion rate

Financial details should link directly to the Finance module rather than creating duplicate financial records.

---

# 20. Customer Ownership

Every CRM record should support ownership and responsibility.

Support:

* Record owner
* Secondary owner
* Sales team
* Account manager
* Customer success owner
* Project manager

Provide automatic assignment rules based on configurable criteria.

---

# 21. CRM Teams & Permissions

> Teams, roles, scopes and the permission catalog are defined by → [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) · Linear LOG-406. This section lists only CRM-specific permissions, named per 01 §46 (`crm.companies.read`, `crm.deals.update`, `crm.records.export`, and so on).

Sales teams are ordinary Teams (01 §40).

For example:

* Sales
* Account Management
* Business Development
* Customer Success

Permissions should control:

* View records
* Create records
* Edit records
* Delete/archive records
* Export data
* View financial information
* View private notes
* Manage pipelines
* Manage custom fields
* Manage CRM settings

Support record-level visibility where required.

---

# 22. Import & Export

Provide robust CRM data import and export.

Support importing:

* Companies
* Contacts
* Leads
* Deals
* Activities
* Custom fields

Support:

* CSV import
* CSV export
* Field mapping
* Duplicate detection
* Duplicate merging
* Import preview
* Validation errors
* Import history
* Rollback where possible

---

# 24. Custom Fields

> **Platform-wide definition.** Sections 24–26 define the custom field model for the whole Agency OS. Other modules (04 Contracts, 05 Projects, 06 Tasks, 13 Support, 17 Documents, 09 Income & Expense) consume this definition and only list which of their entities support custom fields.

The CRM must be highly customizable without requiring development work.

Organizations should be able to create custom fields for:

* Companies
* Contacts
* Leads
* Deals
* Activities
* Products
* Projects
* Other supported CRM entities

Supported field types should include:

* Text
* Long text
* Number
* Decimal
* Currency
* Percentage
* Boolean
* Date
* Date & time
* Email
* Phone
* URL
* Dropdown
* Multi-select
* Radio/select
* User
* Team
* Company
* Contact
* Deal
* Record reference

Custom fields should support:

* Labels
* Descriptions
* Required/optional status
* Default values
* Validation rules
* Visibility rules
* Searchability
* Filtering
* Sorting
* Display ordering
* Role-based visibility

---

# 25. Shared Custom Fields

Provide **Shared Custom Fields** that can be reused across multiple modules.

For example, an organization should be able to define:

```text
Industry
Customer Tier
Region
Company Size
Account Manager
Customer Segment
VAT Number
Lead Source
```

and reuse the same field across Companies, Contacts, Deals, Projects, and other supported entities.

Shared fields should have a single definition so that their label, type, options, validation, and configuration remain consistent across the platform.

Changes to a shared field definition should propagate to all entities using the field.

Support field groups to organize shared fields into logical sections.

---

# 26. Custom Fields API

Provide a **developer-friendly API for custom fields**, similar in concept to Stripe's extensibility model.

External integrations should be able to:

* Read custom field definitions
* Create custom fields
* Update custom fields
* Delete/archive custom fields
* Read custom field values
* Set custom field values
* Update custom field values
* Search using custom field values
* Filter records using custom field values

The API should expose custom fields as first-class extensible properties rather than forcing integrations to understand internal implementation details.

For example, an external integration should conceptually be able to create a field such as:

```text
customer_tier
```

and assign values such as:

```text
Enterprise
```

to CRM records.

Custom fields should support stable identifiers so external integrations can safely reference them even if their display labels change.

---

# 27. CRM API & Webhooks

Provide a comprehensive API for CRM entities.

External systems should be able to:

* Create companies
* Update companies
* Retrieve companies
* Search companies
* Create contacts
* Update contacts
* Create leads
* Convert leads
* Create deals
* Update deals
* Move deals between stages
* Create activities
* Create tasks
* Update activities
* Add notes
* Manage custom fields
* Manage custom field values
* Associate records
* Retrieve relationship history

Provide webhook/event support for important CRM events such as:

* Lead created
* Lead converted
* Contact created
* Company created
* Deal created
* Deal updated
* Deal stage changed
* Deal won
* Deal lost
* Activity created
* Customer created (lifecycle stage reached Customer)

Proposal events (sent, accepted) are emitted by 03, contract events by 04 and task events by 06. The CRM subscribes to those events to update deals; it does not re-emit them.

Webhook delivery follows the platform standard in `docs/Product_Specification.md` §4. Events are also published to the [20 Automation Engine](./20-automation-engine.md) and [14 Notifications](./14-notifications-activity-center.md).

---

# 28. Record Relationships

Provide flexible relationships between CRM records.

Support relationships such as:

```text
Company → Contacts
Company → Deals
Company → Projects
Company → Proposals
Company → Contracts

Contact → Company
Contact → Deals
Contact → Activities
Contact → Projects

Deal → Company
Deal → Contacts
Deal → Proposal
Deal → Contract
Deal → Project

Proposal → Deal
Proposal → Project

Contract → Deal
Contract → Project
```

Allow multiple records to be associated with the same entity where appropriate.

---

# 29. CRM Views

Provide multiple ways to work with CRM data:

* Table view
* Kanban view
* Pipeline view
* List view
* Timeline view
* Calendar view
* Activity view
* Forecast view

Allow users to create saved views with:

* Filters
* Sorting
* Grouping
* Columns
* Search criteria
* Custom fields

Support personal and shared team views.

---

# 30. CRM Search

Provide fast global CRM search across:

* Companies
* Contacts
* Leads
* Deals
* Activities
* Notes
* Proposals
* Contracts

Search should support:

* Full-text search
* Exact matching
* Filters
* Custom fields
* Tags
* Owners
* Pipeline stages
* Dates
* Values

---

# 31. Sales Automation

> Engine defined by → [20 Automation Engine](./20-automation-engine.md) · Linear LOG-410.

The CRM declares its triggers (lead created, deal stage changed, deal inactive, proposal accepted) and actions (assign, create task, change stage, create project) to the Automation Engine. It does not implement its own rules runtime. Email/SMS campaign automation remains in 11.

Examples:

```text
When a new lead is created
→ Assign to Sales Team

When a deal enters Proposal stage
→ Create follow-up task

When a deal remains inactive for 7 days
→ Create follow-up task

When a proposal is accepted
→ Mark deal as Closed Won

When a deal is Closed Won
→ Create customer/project workflow
```

Support configurable triggers, conditions, and actions.

---

# 32. CRM Dashboard

Provide comprehensive sales dashboards including:

* Total leads
* New leads
* Qualified leads
* Lead conversion rate
* Open opportunities
* Pipeline value
* Weighted pipeline
* Deals won
* Deals lost
* Win rate
* Average deal value
* Average sales cycle
* Revenue forecast
* Revenue by salesperson
* Revenue by pipeline
* Revenue by source
* Revenue by service
* Revenue by customer segment
* Deals by stage
* Stale deals
* Upcoming follow-ups
* Activity volume
* Proposal conversion
* Customer acquisition

Allow dashboards to be customized by role and team.

---

# 33. Sales Performance

Provide sales performance tracking for individual users and teams.

Track:

* Leads created
* Leads qualified
* Deals created
* Deals won
* Deals lost
* Deal value
* Win rate
* Average deal size
* Sales cycle
* Activities completed
* Follow-ups completed
* Proposal conversion
* Revenue generated
* Pipeline generated
* Forecast accuracy

---

# 34. Customer & Deal History

Maintain a complete immutable activity history for every CRM record.

Track:

* Record creation
* Field changes
* Ownership changes
* Stage changes
* Value changes
* Notes
* Activities
* Associations
* Proposal changes
* Contract events
* Project events
* Financial events

Users should be able to understand exactly how a relationship and deal evolved over time.

---

# 35. Integrations

The CRM should be designed to integrate with the rest of the Agency Operating System.

Important relationships include:

```text
CRM
 ↓
Proposal
 ↓
Contract
 ↓
Project
 ↓
Time Tracking
 ↓
Invoice
 ↓
Payment
 ↓
Support
 ↓
Renewal
```

The CRM should remain the central commercial relationship layer while specialized modules remain responsible for their respective domains.

For example:

* CRM manages customer relationships and sales
* Proposal module manages proposals
* Contract module manages agreements
* Project module manages delivery
* Finance module manages financial records
* Support module manages support
* Communication module manages email/SMS
* Employee module manages employees

Data should be linked between these modules rather than duplicated.

---

# 36. Extensibility

The CRM should be designed as an extensible platform rather than a fixed set of fields and workflows.

Organizations should be able to customize:

* Pipelines
* Deal stages
* Lead statuses
* Lifecycle stages
* Record types
* Categories
* Tags
* Custom fields
* Shared fields
* Field groups
* Views
* Permissions
* Ownership rules
* Assignment rules
* Automation rules
* Required fields
* Validation rules

Customizations should not require changes to the core application.

---

# 37. Default CRM Configuration

> Provisioning hook defined by → [01](./01-users-organizations-permissions.md) §11 "Module default provisioning" · Linear LOG-406.

The CRM has no platform-wide pipelines, statuses or stages. Every organization owns its own configuration rows, created by the CRM's `provisionDefaults` step when the organization is created or when the CRM module is enabled later. The step is idempotent and skips anything that already exists.

Defaults created per organization:

**Pipeline** "Sales" (default) with stages and default probabilities:

| Stage | Probability | Forecast category |
| -- | -- | -- |
| New Opportunity | 10 | Pipeline |
| Discovery | 20 | Pipeline |
| Qualified | 40 | Best Case |
| Proposal | 60 | Best Case |
| Negotiation | 80 | Commit |
| Verbal Agreement | 90 | Commit |
| Closed Won | 100 | Closed Won (won) |
| Closed Lost | 0 | Closed Lost (lost) |

**Lead statuses**: New (default), Contacted, Attempting Contact, Connected, Qualified, Unqualified, Nurture, Converted (converted flag), Lost (lost flag).

**Lifecycle stages**: Lead (default), Marketing Qualified, Sales Qualified, Opportunity, Customer (customer flag), Active Customer (customer flag), Inactive Customer (customer flag), Former Customer.

**Lead sources**: Website, Referral, Existing Customer, Partner, Networking, Event, Cold Outreach, Advertisement, Organic Search, Social Media, Direct, Import, API, Other.

No default custom fields, tags, assignment rules or saved views are created; the organization adds those. The defaults are a starting point: administrators can rename, reorder, archive or replace any of them (§36) without affecting other organizations.

The CRM should provide a flexible foundation that can support different types of software agencies, sales processes, customer structures, and future integrations while maintaining a consistent and unified customer record across the entire Agency Operating System.

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (25)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **platform shared** | | | |
| `CustomFieldGroup` | `custom_field_groups` | [L1271](../../api/prisma/schema.prisma#L1271) | 02 §25 — logical sections for shared fields. |
| `CustomFieldDefinition` | `custom_field_definitions` | [L1288](../../api/prisma/schema.prisma#L1288) | 02 §24–26 — one definition; shared fields list several entity types (02 §25). `key` is the stable API identifier (02 §26); `label` may change. |
| `CustomFieldValue` | `custom_field_values` | [L1325](../../api/prisma/schema.prisma#L1325) | Value of a custom field on a record. entity_id points at the table named by entity_type. |
| `Tag` | `tags` | [L1345](../../api/prisma/schema.prisma#L1345) | Organization-scoped tags, applied to any record through Tagging. |
| `Tagging` | `taggings` | [L1362](../../api/prisma/schema.prisma#L1362) |  |
| `SavedView` | `saved_views` | [L1376](../../api/prisma/schema.prisma#L1376) | 02 §29 — saved views with filters, sorting, grouping, columns; personal, team or organization-wide. |
| **Configuration** | | | |
| `CrmLeadSource` | `crm_lead_sources` | [L1497](../../api/prisma/schema.prisma#L1497) | 02 §5 — configurable lead sources. |
| `CrmLeadStatus` | `crm_lead_statuses` | [L1518](../../api/prisma/schema.prisma#L1518) | 02 §4 — configurable lead statuses. |
| `CrmLifecycleStage` | `crm_lifecycle_stages` | [L1539](../../api/prisma/schema.prisma#L1539) | 02 §17 — configurable lifecycle stages (Lead → MQL → SQL → Opportunity → Customer → …). |
| `CrmLifecycleHistory` | `crm_lifecycle_history` | [L1561](../../api/prisma/schema.prisma#L1561) | 02 §17 — historical lifecycle changes. |
| `CrmPipeline` | `crm_pipelines` | [L1579](../../api/prisma/schema.prisma#L1579) | 02 §8 — multiple pipelines per organization. |
| `CrmPipelineStage` | `crm_pipeline_stages` | [L1603](../../api/prisma/schema.prisma#L1603) | 02 §8 — pipeline-specific stages with default probability. |
| **Core records** | | | |
| `CrmCompany` | `crm_companies` | [L1634](../../api/prisma/schema.prisma#L1634) | 02 §2 — any external legal entity: prospect, customer, partner or vendor. One record model. Never a platform Organization (01 §8) and never a Branch (01 §16). |
| `CrmCompanyBranch` | `crm_company_branches` | [L1706](../../api/prisma/schema.prisma#L1706) | 01 §31, §37 — branch relationships on one company record instead of duplicate companies. |
| `CrmContact` | `crm_contacts` | [L1723](../../api/prisma/schema.prisma#L1723) | 02 §3 — a person at a Company. Not a platform User (01 §4). |
| `CrmLead` | `crm_leads` | [L1782](../../api/prisma/schema.prisma#L1782) | 02 §4–7 — prospect before qualification. Conversion links to the created records (02 §7). |
| `CrmDeal` | `crm_deals` | [L1839](../../api/prisma/schema.prisma#L1839) | 02 §9 — deal / opportunity. Totals derive from line items when any exist (02 §10). |
| `CrmDealContact` | `crm_deal_contacts` | [L1905](../../api/prisma/schema.prisma#L1905) | 02 §9 — additional contacts on a deal. |
| `CrmDealLineItem` | `crm_deal_line_items` | [L1920](../../api/prisma/schema.prisma#L1920) | 02 §10 — deal line items. product_id references the Finance catalog (08); no FK until 08 exists. |
| `CrmDealStageHistory` | `crm_deal_stage_history` | [L1949](../../api/prisma/schema.prisma#L1949) | 02 §8, §34 — stage transitions for duration, velocity and history. |
| **Activities & notes** | | | |
| `CrmActivity` | `crm_activities` | [L1971](../../api/prisma/schema.prisma#L1971) | 02 §12–15 — unified CRM activity. Tasks are NOT activities: they live in 06 and link back to CRM records from Task Management. MEETING rows reference a Calen… |
| `CrmActivityParticipant` | `crm_activity_participants` | [L2018](../../api/prisma/schema.prisma#L2018) | Participants of an activity: internal Members (by membership id) and CRM Contacts. |
| `CrmNote` | `crm_notes` | [L2034](../../api/prisma/schema.prisma#L2034) | 02 §16 — notes attachable to companies, contacts, leads, deals and other modules' records. |
| **Operations** | | | |
| `CrmAssignmentRule` | `crm_assignment_rules` | [L2063](../../api/prisma/schema.prisma#L2063) | 02 §20 — automatic assignment rules (evaluated by the Automation Engine, 20). |
| `CrmImportJob` | `crm_import_jobs` | [L2084](../../api/prisma/schema.prisma#L2084) | 02 §22 — CSV import jobs with mapping, preview, validation, history and rollback. |

**Owned enums (12):** `RecordEntityType`, `CustomFieldType`, `SavedViewVisibility`, `CrmCompanyType`, `CrmContactRole`, `CrmActivityType`, `CrmActivityStatus`, `CrmPriority`, `CrmForecastCategory`, `CrmDealStatus`, `CrmImportStatus`, `CrmBranchRelationType`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `CrmCompanyBranch.branch`, `CrmDeal.branch`, `CrmLead.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `CrmActivity.owner`, `CrmCompany.account_manager`, `CrmCompany.owner`, `CrmCompany.success_owner` +6 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `CrmActivity.organization`, `CrmAssignmentRule.organization`, `CrmCompany.organization`, `CrmContact.organization` +12 more |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `CrmCompany.team`, `CrmDeal.team`, `CrmPipeline.team`, `SavedView.team` |
| [05](./05-project-management.md) | `Project` (`projects`) | `CrmDeal.project` |
| [08](./08-financial-management-stripe-integration.md) | `Product` (`products`) | `CrmDealLineItem.product` |

### Referenced by other modules

- [03](./03-proposal-quotation-generator.md): `Proposal`, `ProposalAcceptance`, `ProposalDelivery`
- [04](./04-contracts.md): `Contract`, `ContractParty`, `ContractSignatory`
- [05](./05-project-management.md): `Project`, `ProjectStakeholder`
- [08](./08-financial-management-stripe-integration.md): `BillingProfile`, `Invoice`, `Subscription`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `CustomerPortalMembership.customer_id` ([01](./01-users-organizations-permissions.md), [L1138](../../api/prisma/schema.prisma#L1138)) — CRM Company id (02). No FK until LOG-404 is implemented.
- `Proposal.company_id` ([03](./03-proposal-quotation-generator.md), [L2299](../../api/prisma/schema.prisma#L2299)) — CRM references (02). company_id is the Customer the proposal is addressed to.
- `BillingProfile.billing_contact_ids` ([08](./08-financial-management-stripe-integration.md), [L5212](../../api/prisma/schema.prisma#L5212)) — CRM contact ids with the BILLING role (02 §3).

<!-- schema-refs:end -->
