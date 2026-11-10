# CRM & Sales Management

> Linear: [LOG-404](https://linear.app/logiqdev/issue/LOG-404/crm-and-sales-management) · Status: Backlog

Develop a comprehensive **CRM and Sales Management system** comparable to HubSpot CRM, but designed specifically for software agencies and with a highly extensible architecture.

The CRM should provide a complete view of the relationship between the agency, leads, prospects, companies, contacts, deals, proposals, contracts, projects, invoices, support activity, and customer history.

The CRM should function as the central source of truth for all commercial relationships and sales activity, while integrating seamlessly with the existing Proposal, Project, Customer Portal, Contract, Finance, and Support modules.

---

# 1. CRM Core Entities

The CRM should support the following primary entities:

* Contacts
* Companies / Organizations
* Deals / Opportunities
* Customers
* Partners
* Vendors
* Activities
* Meetings
* Calls
* Notes
* Tasks
* Follow-ups
* Proposals
* Contracts
* Projects
* Tickets
* Invoices
* Payments

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

# 2. Companies / Organizations

Provide complete company management.

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

Support parent/child company relationships for organizations with multiple branches, subsidiaries, or departments.

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

Provide CRM-specific tasks for sales representatives.

Examples:

* Call prospect
* Schedule discovery meeting
* Send proposal
* Follow up after proposal
* Contact decision maker
* Request requirements
* Review contract
* Follow up on negotiation

Support:

* Due dates
* Priority
* Assignee
* Recurring tasks
* Reminders
* Related CRM record
* Completion status

Provide automatic follow-up reminders for deals that have become inactive.

---

# 15. Meetings

Support CRM meeting management.

Meeting records should include:

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

Support multiple sales teams.

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
* Task completed
* Proposal sent
* Proposal accepted
* Contract signed
* Customer created

This allows external systems and internal modules to react to CRM events in real time.

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

Support configurable CRM automation rules without making this part of the communications/campaign system.

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

The CRM should provide a flexible foundation that can support different types of software agencies, sales processes, customer structures, and future integrations while maintaining a consistent and unified customer record across the entire Agency Operating System.
