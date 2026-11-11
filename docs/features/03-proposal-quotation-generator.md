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
| `NumberSequence` | `number_sequences` | [L2569](../../api/prisma/schema.prisma#L2569) | Per-organization numbering sequences, e.g. PRO-2026-0001 / CTR-2026-0001 / INV-2026-0001. Services increment `next_number` inside a transaction; numbers are … |
| **Templates** | | | |
| `ProposalTemplate` | `proposal_templates` | [L2707](../../api/prisma/schema.prisma#L2707) | 03 "Reusable Templates" — branded, versioned template per work type. Organization-owned. |
| **Proposal** | | | |
| `Proposal` | `proposals` | [L2746](../../api/prisma/schema.prisma#L2746) | 03 "Proposal Creation" — the proposal record. Content lives in versions; this row carries identity, relationships, status and snapshots of the current versio… |
| `ProposalVersion` | `proposal_versions` | [L2833](../../api/prisma/schema.prisma#L2833) | 03 "Proposal Versions" — every revision. A version that was sent is immutable; acceptance is always bound to the exact version sent. |
| `ProposalSection` | `proposal_sections` | [L2897](../../api/prisma/schema.prisma#L2897) | Addressable content blocks of a version (03 "AI Proposal Generation" output structure). |
| `ProposalLineItem` | `proposal_line_items` | [L2920](../../api/prisma/schema.prisma#L2920) | 03 "Pricing & Quotation Builder" — line items of a version. product_id references the Finance catalog (08); no FK until 08 exists. |
| `ProposalPaymentScheduleItem` | `proposal_payment_schedule_items` | [L2956](../../api/prisma/schema.prisma#L2956) | 03 "Pricing & Quotation Builder" — deposits, milestone payments, custom schedules. |
| **Review, delivery, tracking, acceptance** | | | |
| `ProposalApproval` | `proposal_approvals` | [L2981](../../api/prisma/schema.prisma#L2981) | 03 "Proposal Review" — internal approval bound to an exact version (approval rights: 01 §95). |
| `ProposalComment` | `proposal_comments` | [L3001](../../api/prisma/schema.prisma#L3001) | Internal and customer comments on a proposal or a section. Customer authors are Customer Portal Users (01 §79) or the addressed contact; internal comments ar… |
| `ProposalDelivery` | `proposal_deliveries` | [L3026](../../api/prisma/schema.prisma#L3026) | 03 "Customer Delivery" — each send of a version through a channel. Emails go through 11. |
| `ProposalEvent` | `proposal_events` | [L3053](../../api/prisma/schema.prisma#L3053) | 03 "Proposal Tracking" — append-only event log of customer activity and lifecycle changes. |
| `ProposalAcceptance` | `proposal_acceptances` | [L3076](../../api/prisma/schema.prisma#L3076) | 03 "Customer Approval" — the customer's decision on an exact version, with the evidence collected (name, contact, terms confirmation, selected optional items… |

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
| [11](./11-communication-center.md) | `CommMessage` (`comm_messages`) | `ProposalDelivery.communication` |
| [17](./17-documents-file-management.md) | `Document` (`documents`) | `ProposalVersion.pdf_document` |

### Referenced by other modules

- [04](./04-contracts.md): `Contract`, `SignatureRequest`
- [05](./05-project-management.md): `Project`
- [08](./08-financial-management-stripe-integration.md): `Invoice`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `Contract.proposal_id` ([04](./04-contracts.md), [L3484](../../api/prisma/schema.prisma#L3484)) — 04 §7, §55 — source proposal and exact version (03).
- `Project.proposal_id` ([05](./05-project-management.md), [L4321](../../api/prisma/schema.prisma#L4321)) — Source proposal and exact version (03), set when created from an accepted proposal (05 §57).
- `ProjectMilestone.proposal_milestone_key` ([05](./05-project-management.md), [L4573](../../api/prisma/schema.prisma#L4573)) — Proposal milestone this was created from (03), stored as the proposal's milestone key.
- `ProjectDeliverable.proposal_reference` ([05](./05-project-management.md), [L4616](../../api/prisma/schema.prisma#L4616)) — Proposal line item / section reference (03) for commercial scope traceability.
- `Invoice.proposal_version_id` ([08](./08-financial-management-stripe-integration.md), [L6063](../../api/prisma/schema.prisma#L6063)) — 08 "Proposals & Quotations" — accepted proposal version (03) this invoice was generated from; permanent link.
- `Subscription.proposal_version_id` ([08](./08-financial-management-stripe-integration.md), [L6330](../../api/prisma/schema.prisma#L6330)) — 08 "Proposals & Quotations" — accepted proposal version (03) that created this subscription; permanent link.
- `SupportSettings.ticket_prefix` ([13](./13-customer-support-communication-hub.md), [L12006](../../api/prisma/schema.prisma#L12006)) — Prefix for ticket references (e.g. "SUP"); the counter is number_sequences (03) with key "ticket".
- `Ticket.number` ([13](./13-customer-support-communication-hub.md), [L12435](../../api/prisma/schema.prisma#L12435)) — 13 §2 — sequential per organization via number_sequences (03); `reference` = prefix + number (SUP-1042).

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 14 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `proposals.ai` | generate |
| `proposals.analytics` | read |
| `proposals.comments.internal` | read |
| `proposals.proposals` | read, create, update, delete*, archive, export*, approve*, send, convert*, cancel |
| `proposals.templates` | manage |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## AI-Powered Proposal & Quotation Generator

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Develop a comprehensive **AI-powered Proposal and Quotation Generator** that enables the agency to quickly create professional, branded, customer-ready proposals based on project requirements, pricing, timelines, and other relevant business information.

The system should combine structured quotation management, reusable document templates, AI-generated content, PDF generation, customer approval, and proposal tracking into a single workflow.

---

## Proposal Creation

<!-- schema-section:start -->
> **Schema:** `Proposal` ([proposals](../../api/prisma/schema.prisma#L2746))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `ProposalSection` ([proposal_sections](../../api/prisma/schema.prisma#L2897))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `ProposalTemplate` ([proposal_templates](../../api/prisma/schema.prisma#L2707)) · enum `ProposalSectionType` ([L2670](../../api/prisma/schema.prisma#L2670))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `ProposalTemplate` ([proposal_templates](../../api/prisma/schema.prisma#L2707)): `variables` · `ProposalVersion` ([proposal_versions](../../api/prisma/schema.prisma#L2833)): `variables`
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `ProposalLineItem` ([proposal_line_items](../../api/prisma/schema.prisma#L2920)) · `ProposalPaymentScheduleItem` ([proposal_payment_schedule_items](../../api/prisma/schema.prisma#L2956)) · enum `ProposalPaymentTrigger` ([L2695](../../api/prisma/schema.prisma#L2695))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `ProposalVersion` ([proposal_versions](../../api/prisma/schema.prisma#L2833)) · enum `ProposalVersionStatus` ([L2611](../../api/prisma/schema.prisma#L2611))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `ProposalApproval` ([proposal_approvals](../../api/prisma/schema.prisma#L2981)) · `ProposalVersion` ([proposal_versions](../../api/prisma/schema.prisma#L2833)): `ai_metadata` · enum `ProposalApprovalDecision` ([L2620](../../api/prisma/schema.prisma#L2620))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `Proposal` ([proposals](../../api/prisma/schema.prisma#L2746)): `public_token_hash` · `ProposalDelivery` ([proposal_deliveries](../../api/prisma/schema.prisma#L3026)) · enum `ProposalDeliveryChannel` ([L2635](../../api/prisma/schema.prisma#L2635))
<!-- schema-section:end -->

Allow proposals to be delivered directly to customers through:

* Email (sent through [11 Communication Center](./11-communication-center.md))
* Customer Portal ([07](./07-customer-portal.md))
* PDF attachment (stored in [17 Documents](./17-documents-file-management.md))

Customers should be able to open and review proposals through a professional web-based proposal view in addition to receiving the PDF. Delivery and status notifications go through [14 Notifications](./14-notifications-activity-center.md).

Track proposal delivery and customer activity.

---

## Customer Approval

<!-- schema-section:start -->
> **Schema:** `ProposalAcceptance` ([proposal_acceptances](../../api/prisma/schema.prisma#L3076)) · enum `ProposalCustomerDecision` ([L2628](../../api/prisma/schema.prisma#L2628))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** enum `ProposalStatus` ([L2596](../../api/prisma/schema.prisma#L2596))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `ProposalEvent` ([proposal_events](../../api/prisma/schema.prisma#L3053)) · enum `ProposalEventType` ([L2650](../../api/prisma/schema.prisma#L2650))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `Proposal` ([proposals](../../api/prisma/schema.prisma#L2746)): `requires_contract`
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `ProposalVersion` ([proposal_versions](../../api/prisma/schema.prisma#L2833)): `ai_metadata`
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

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
