# AI-Powered Proposal & Quotation Generator

> Linear: [LOG-303](https://linear.app/logiqdev/issue/LOG-303/ai-powered-proposal-and-quotation-generator) · Status: Backlog

> **Canonical for:** Proposals and quotations: creation, AI generation, templates, pricing builder, versions, internal review, PDF, customer delivery, customer acceptance, status, tracking, analytics and conversion into contract, project and billing records.
>
> **Terminology:** **Proposal** is the canonical term. "Offer", "Quote", "Quotation" and "Estimate" are synonyms for the same record and are not separate features. The former "Quotes & Estimates" feature in 08 Finance is this module.
>
> **Depends on:** [01](./01-users-organizations-permissions.md) (LOG-406) for permissions, approval rights (01 §95) and branding (01 §15) · [02 CRM](./02-crm-sales-management.md) (LOG-404) for Companies, Contacts and Deals · [08 Finance](./08-financial-management-stripe-integration.md) (LOG-104) for the products and services catalog, tax rates and currency · [04 Contracts](./04-contracts.md) (LOG-349) for the e-signature provider abstraction · [07 Customer Portal](./07-customer-portal.md) (LOG-103) for customer-facing delivery · [17 Documents](./17-documents-file-management.md) (LOG-407) for generated PDFs and attachments · [14 Notifications](./14-notifications-activity-center.md) (LOG-403).
>
> **Consumed by:** 02 CRM (deal to proposal, proposal accepted → Closed Won), 04 Contracts (contract generated from accepted proposal), 05 Projects (project created from accepted proposal), 08 Finance (invoices and subscriptions from accepted proposal), 07 Customer Portal.

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (12)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **platform shared** | | | |
| `NumberSequence` | `number_sequences` | [L2122](../../api/prisma/schema.prisma#L2122) | Per-organization numbering sequences, e.g. PRO-2026-0001 / CTR-2026-0001 / INV-2026-0001. Services increment `next_number` inside a transaction; numbers are … |
| **Templates** | | | |
| `ProposalTemplate` | `proposal_templates` | [L2260](../../api/prisma/schema.prisma#L2260) | 03 "Reusable Templates" — branded, versioned template per work type. Organization-owned. |
| **Proposal** | | | |
| `Proposal` | `proposals` | [L2299](../../api/prisma/schema.prisma#L2299) | 03 "Proposal Creation" — the proposal record. Content lives in versions; this row carries identity, relationships, status and snapshots of the current versio… |
| `ProposalVersion` | `proposal_versions` | [L2386](../../api/prisma/schema.prisma#L2386) | 03 "Proposal Versions" — every revision. A version that was sent is immutable; acceptance is always bound to the exact version sent. |
| `ProposalSection` | `proposal_sections` | [L2449](../../api/prisma/schema.prisma#L2449) | Addressable content blocks of a version (03 "AI Proposal Generation" output structure). |
| `ProposalLineItem` | `proposal_line_items` | [L2472](../../api/prisma/schema.prisma#L2472) | 03 "Pricing & Quotation Builder" — line items of a version. product_id references the Finance catalog (08); no FK until 08 exists. |
| `ProposalPaymentScheduleItem` | `proposal_payment_schedule_items` | [L2508](../../api/prisma/schema.prisma#L2508) | 03 "Pricing & Quotation Builder" — deposits, milestone payments, custom schedules. |
| **Review, delivery, tracking, acceptance** | | | |
| `ProposalApproval` | `proposal_approvals` | [L2532](../../api/prisma/schema.prisma#L2532) | 03 "Proposal Review" — internal approval bound to an exact version (approval rights: 01 §95). |
| `ProposalComment` | `proposal_comments` | [L2552](../../api/prisma/schema.prisma#L2552) | Internal and customer comments on a proposal or a section. Customer authors are Customer Portal Users (01 §79) or the addressed contact; internal comments ar… |
| `ProposalDelivery` | `proposal_deliveries` | [L2577](../../api/prisma/schema.prisma#L2577) | 03 "Customer Delivery" — each send of a version through a channel. Emails go through 11. |
| `ProposalEvent` | `proposal_events` | [L2603](../../api/prisma/schema.prisma#L2603) | 03 "Proposal Tracking" — append-only event log of customer activity and lifecycle changes. |
| `ProposalAcceptance` | `proposal_acceptances` | [L2626](../../api/prisma/schema.prisma#L2626) | 03 "Customer Approval" — the customer's decision on an exact version, with the evidence collected (name, contact, terms confirmation, selected optional items… |

**Owned enums (9):** `ProposalStatus`, `ProposalVersionStatus`, `ProposalApprovalDecision`, `ProposalCustomerDecision`, `ProposalDeliveryChannel`, `ProposalDeliveryStatus`, `ProposalEventType`, `ProposalSectionType`, `ProposalPaymentTrigger`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Proposal.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Proposal.owner`, `ProposalApproval.approver`, `ProposalComment.author` |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `NumberSequence.organization`, `Proposal.organization`, `ProposalTemplate.organization` |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `Proposal.company` |
| [02](./02-crm-sales-management.md) | `CrmContact` (`crm_contacts`) | `Proposal.contact`, `ProposalAcceptance.contact`, `ProposalDelivery.recipient` |
| [02](./02-crm-sales-management.md) | `CrmDeal` (`crm_deals`) | `Proposal.deal` |
| [05](./05-project-management.md) | `Project` (`projects`) | `Proposal.converted_project` |
| [08](./08-financial-management-stripe-integration.md) | `Invoice` (`invoices`) | `Proposal.invoice` |
| [08](./08-financial-management-stripe-integration.md) | `Product` (`products`) | `ProposalLineItem.product` |
| [08](./08-financial-management-stripe-integration.md) | `Subscription` (`subscriptions`) | `Proposal.subscription` |

### Referenced by other modules

- [04](./04-contracts.md): `Contract`, `SignatureRequest`
- [05](./05-project-management.md): `Project`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `Contract.proposal_id` ([04](./04-contracts.md), [L3034](../../api/prisma/schema.prisma#L3034)) — 04 §7, §55 — source proposal and exact version (03).
- `Project.proposal_id` ([05](./05-project-management.md), [L3850](../../api/prisma/schema.prisma#L3850)) — Source proposal and exact version (03), set when created from an accepted proposal (05 §57).
- `ProjectMilestone.proposal_milestone_key` ([05](./05-project-management.md), [L4076](../../api/prisma/schema.prisma#L4076)) — Proposal milestone this was created from (03), stored as the proposal's milestone key.
- `ProjectDeliverable.proposal_reference` ([05](./05-project-management.md), [L4116](../../api/prisma/schema.prisma#L4116)) — Proposal line item / section reference (03) for commercial scope traceability.

<!-- schema-refs:end -->

## AI-Powered Proposal & Quotation Generator

Develop a comprehensive **AI-powered Proposal and Quotation Generator** that enables the agency to quickly create professional, branded, customer-ready proposals based on project requirements, pricing, timelines, and other relevant business information.

The system should combine structured quotation management, reusable document templates, AI-generated content, PDF generation, customer approval, and proposal tracking into a single workflow.

---

## Proposal Creation

Allow users to create proposals and quotations manually or generate them with AI.

A proposal should support:

* Customer information
* Company information
* Project information
* Project title
* Project description
* Objectives
* Scope of work
* Features and requirements
* Deliverables
* Technologies and services
* Project milestones
* Timeline
* Estimated duration
* Pricing
* Individual line items
* Quantities
* Unit prices
* Discounts
* VAT
* Total net value
* Total VAT
* Total gross value
* Payment terms
* Payment schedule
* Recurring costs
* Optional services
* Additional costs
* Assumptions
* Exclusions
* Terms and conditions
* Warranty information
* Support and maintenance options
* Proposal validity period
* Notes
* Attachments

---

## AI Proposal Generation

AI should be able to generate a complete proposal based on existing information within the platform.

For example, the user should be able to provide a project description or select an existing project, and AI should generate an initial proposal containing:

* Project overview
* Executive summary
* Understanding of the customer's requirements
* Proposed solution
* Scope of work
* Features
* Deliverables
* Project phases
* Milestones
* Estimated timeline
* Pricing structure
* Payment schedule
* Support options
* Assumptions
* Exclusions
* Terms
* Next steps

AI should use information already available in the system, including customer details, project information, tasks, milestones, services, pricing, previous proposals, and reusable content.

The generated proposal should always remain editable and require user review before being sent to the customer.

---

## Reusable Templates

Provide a flexible template system for creating and managing multiple proposal templates.

Templates should support:

* Company branding
* Logo
* Colors
* Typography
* Headers and footers
* Cover pages
* Page layouts
* Sections
* Tables
* Pricing tables
* Images
* Custom text
* Dynamic variables
* Terms and conditions
* Signature sections
* Payment information

Allow administrators to create templates for different types of work, such as:

* Website development
* Web applications
* Mobile applications
* Custom software
* SaaS development
* Maintenance
* Support
* Consulting
* Digital transformation
* Custom proposals

---

## Dynamic Proposal Content

Templates should support dynamic data that is automatically populated when a proposal is generated.

Examples include:

* Customer name
* Company name
* Contact information
* Project name
* Proposal number
* Proposal date
* Expiration date
* Project manager
* Services
* Line items
* Pricing
* VAT
* Timeline
* Milestones
* Payment terms

This should allow the same template to be reused across many customers without manually replacing information.

---

## Pricing & Quotation Builder

Provide a dedicated quotation builder for constructing project pricing.

Support:

* Multiple line items
* Service selection
* Custom line items
* Quantity
* Unit price
* Discounts
* VAT
* Optional items
* Recurring items
* One-time items
* Deposits
* Milestone payments
* Custom payment schedules

Automatically calculate:

* Net subtotal
* Discounts
* VAT
* Gross total
* Amount due at each payment stage
* Recurring monthly or annual costs

Allow users to mark individual services as optional so customers can choose additional features or packages.

Services, packages, unit prices, tax rates and currencies come from the products and services catalog in [08 Finance](./08-financial-management-stripe-integration.md). Custom line items are allowed per proposal.

---

## Proposal Versions

Maintain a complete proposal version history.

Users should be able to:

* Create revisions
* Compare versions
* Restore previous versions
* Duplicate proposals
* Track changes
* See who modified a proposal
* Maintain the original proposal after revisions

Every proposal sent to a customer should remain associated with the exact version that was sent.

---

## Proposal Review

Before sending a proposal, provide a review workflow where authorized users can:

* Preview the proposal
* Edit content
* Modify pricing
* Review calculations
* Check missing information
* Request internal approval
* Approve the proposal
* Reject the proposal
* Add internal comments

AI should be able to review the proposal and identify potential issues such as missing scope items, inconsistent pricing, unclear descriptions, missing terms, or conflicting timelines.

---

## PDF Generation

Generate professional PDF documents from approved proposals.

PDFs should include:

* Professional formatting
* Company branding
* Cover page
* Table of contents where appropriate
* Project information
* Scope
* Deliverables
* Timeline
* Pricing
* Payment schedule
* Terms and conditions
* Signature/approval section

The generated PDF should be suitable for sending directly to customers and downloading for internal records.

---

## Customer Delivery

Allow proposals to be delivered directly to customers through:

* Email (sent through [11 Communication Center](./11-communication-center.md))
* Customer Portal ([07](./07-customer-portal.md))
* PDF attachment (stored in [17 Documents](./17-documents-file-management.md))

Customers should be able to open and review proposals through a professional web-based proposal view in addition to receiving the PDF. Delivery and status notifications go through [14 Notifications](./14-notifications-activity-center.md).

Track proposal delivery and customer activity.

---

## Customer Approval

Support a complete proposal approval workflow.

Customers should be able to:

* View the proposal
* Download the PDF
* Accept the proposal
* Reject the proposal
* Request changes
* Leave comments
* Provide feedback
* Approve specific optional items
* Confirm acceptance of terms
* Provide their name and contact information
* Sign electronically where supported, using the signature provider abstraction defined in [04 Contracts](./04-contracts.md) §33–38

Record the complete approval history and timestamp. Every acceptance is bound to the exact proposal version that was sent.

---

## Proposal Status

Support proposal statuses such as:

* Draft
* In Review
* Pending Approval
* Sent
* Viewed
* Changes Requested
* Accepted
* Rejected
* Expired
* Cancelled

Track the full lifecycle of every proposal.

---

## Proposal Tracking

Provide visibility into proposal performance and customer activity.

Track:

* Created date
* Sent date
* First viewed date
* Last viewed date
* Number of views
* Customer interactions
* Changes requested
* Acceptance date
* Rejection date
* Expiration date
* Proposal value
* Conversion status

---

## Conversion to Project

Once a proposal is accepted, allow the agency to convert it into operational work without re-entering information.

The platform's commercial flow is:

**CRM Deal → Proposal → Contract (optional) → Project → Tasks / Time / Support / Finance**

A contract is optional (04 §1 "a project can exist without a contract"). The organization configures, per proposal type, whether acceptance requires a contract before project and billing records are created.

On acceptance the system can create or update, through the owning module:

* Customer lifecycle stage and deal Closed Won → 02 CRM
* Contract from the accepted proposal version → 04 Contracts §7
* Project with scope, milestones, deliverables and initial tasks → 05 Projects §5, §57 and 06 Tasks
* Invoice, payment schedule, subscription and recurring services → 08 Finance

The accepted proposal version remains permanently linked to the resulting contract, project and financial records. Those modules remain the source of truth for the records they create.

---

## AI Assistance

AI should be available throughout the proposal creation and editing process.

AI should be capable of:

* Generating proposals from project requirements
* Improving proposal wording
* Rewriting sections for a professional tone
* Simplifying technical language for customers
* Expanding incomplete descriptions
* Summarizing requirements
* Generating scope of work
* Generating deliverables
* Suggesting milestones
* Suggesting project timelines
* Suggesting pricing structures
* Identifying missing requirements
* Identifying potential scope gaps
* Reviewing pricing consistency
* Generating payment schedules
* Generating terms and assumptions
* Creating customer-specific proposals
* Translating proposals
* Reviewing proposals before sending

The AI should use the agency's existing services, pricing information, templates, previous proposals, and project data where appropriate.

---

## Proposal Analytics

Provide management dashboards showing:

* Total proposals
* Proposals sent
* Proposals viewed
* Proposals accepted
* Proposals rejected
* Expired proposals
* Total quoted value
* Accepted value
* Average proposal value
* Conversion rate
* Average time to acceptance
* Revenue generated from accepted proposals
* Conversion by service
* Conversion by customer
* Conversion over time

The Proposal & Quotation Generator should provide a complete end-to-end workflow from **project requirements → AI-generated proposal → internal review → branded PDF → customer delivery → customer approval → project and billing creation**, minimizing manual work while maintaining full control over pricing, scope, branding, and final approval.
