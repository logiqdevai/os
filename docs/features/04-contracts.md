# Contracts

> Linear: [LOG-349](https://linear.app/logiqdev/issue/LOG-349/contracts) · Status: Backlog

> **Canonical for:** contract records, types, parties, lifecycle, templates and clause library, versions, review and approval, **e-signature, built in-house as the platform's own signing service (§33–42, reused by 03 Proposals)**, amendments, renewals, termination, obligations, contract dates and expiration monitoring.
>
> **Terminology:** "Proposal" replaces the former "Offer" everywhere in this file (see 03). "Contract Change Request" (§26) is a request to change contract language; "Project Change Request" (05 §45) is a change to delivery scope. They are different records that can reference each other.
>
> **Depends on:** [01](./01-users-organizations-permissions.md) (LOG-406) for permissions, approval rights (01 §95), separation of duties (01 §96), tenant and customer isolation, branding · [02 CRM](./02-crm-sales-management.md) (LOG-404) for Companies and Contacts as parties · [03 Proposals](./03-proposal-quotation-generator.md) (LOG-303) as the commercial source · [17 Documents](./17-documents-file-management.md) (LOG-407) for storage of artifacts · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) · [19 Calendar](./19-calendar.md) (LOG-409) for contract dates · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for lifecycle automation and expiration monitoring.
>
> **Consumed by:** 05 Projects (contract context, contractual deadlines), 07 Customer Portal (review and signing surface), 08 Finance (billing context), 09 Income & Expense (vendor agreements), 10 Employees (employment and contractor agreements as documents), 12 Messaging (record sharing), 18 Time Tracking (billability defaults).

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (25)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Configuration: types, templates, clauses, approval rules** | | | |
| `ContractType` | `contract_types` | [L4605](../../api/prisma/schema.prisma#L4605) | 04 §2 — configurable contract types with defaults. |
| `ContractTemplate` | `contract_templates` | [L4640](../../api/prisma/schema.prisma#L4640) | 04 §8, §77 — reusable contractual structure. Content is versioned in ContractTemplateVersion; changing a template never modifies existing contracts. |
| `ContractTemplateVersion` | `contract_template_versions` | [L4670](../../api/prisma/schema.prisma#L4670) | 04 §8–10, §14 — one immutable template version: sections, variables, conditional clause rules, signature blocks, required fields, appendices. |
| `ContractClause` | `contract_clauses` | [L4697](../../api/prisma/schema.prisma#L4697) | 04 §11 — clause library entry. Text lives in ContractClauseVersion (04 §12). |
| `ContractClauseVersion` | `contract_clause_versions` | [L4725](../../api/prisma/schema.prisma#L4725) | 04 §12 — a generated contract keeps the exact clause version used. |
| `ContractApprovalRule` | `contract_approval_rules` | [L4746](../../api/prisma/schema.prisma#L4746) | 04 §28 — approval requirements by value, type, liability, discount, payment terms, duration, customer category, risk, custom fields. |
| **Contract record** | | | |
| `Contract` | `contracts` | [L4768](../../api/prisma/schema.prisma#L4768) | 04 §3 — the structured business record. Document content lives in versions. |
| `ContractParty` | `contract_parties` | [L4881](../../api/prisma/schema.prisma#L4881) | 04 §4 — a party to the contract. References a CRM Company (02) without duplicating it; the agency itself is a party of type AGENCY. |
| `ContractSignatory` | `contract_signatories` | [L4904](../../api/prisma/schema.prisma#L4904) | 04 §4, §31 — a signatory for a party; a party may have several. Internal signatories are Members, external ones are CRM Contacts or free-text. |
| `ContractProject` | `contract_projects` | [L4928](../../api/prisma/schema.prisma#L4928) | 04 §56 — a contract can reference many projects (05). |
| **Versions** | | | |
| `ContractVersion` | `contract_versions` | [L4946](../../api/prisma/schema.prisma#L4946) | 04 §19–20 — every material draft change creates a version. Signed versions are immutable (04 §39). |
| `ContractSection` | `contract_sections` | [L5000](../../api/prisma/schema.prisma#L5000) | 04 §14 — addressable section of a version; may embed an exact clause version (04 §12). |
| **Review, comments, change requests, approval** | | | |
| `ContractReview` | `contract_reviews` | [L5031](../../api/prisma/schema.prisma#L5031) | 04 §23–24 — a review request references one exact version. Internal reviewers are Members; customer reviewers are Customer Portal Users (id only) or contacts. |
| `ContractComment` | `contract_comments` | [L5057](../../api/prisma/schema.prisma#L5057) | 04 §13, §23–24 — comments on a version or section; internal comments never reach the portal. |
| `ContractAiFinding` | `contract_ai_findings` | [L5087](../../api/prisma/schema.prisma#L5087) | 04 §73 — one finding of an AI contract review. Always an AI-generated recommendation pointing at a section; it never edits the contract text. |
| `ContractChangeRequest` | `contract_change_requests` | [L5115](../../api/prisma/schema.prisma#L5115) | 04 §26 — Contract Change Request: a request to change contract language. Never mutates the current version; an accepted request produces a new version or an … |
| `ContractApproval` | `contract_approvals` | [L5147](../../api/prisma/schema.prisma#L5147) | 04 §27–29 — business approval bound to an exact version. Approval of v1.0 does not approve v1.1. |
| **E-signature (in-house signing service) (04 §30–42, §71, §78–79)** | | | |
| `SignatureRequest` | `signature_requests` | [L5172](../../api/prisma/schema.prisma#L5172) | 04 §34 — a signature request bound immutably to one subject version (contract or proposal). Provider-specific data stays in provider_* fields and metadata, n… |
| `Signer` | `signers` | [L5220](../../api/prisma/schema.prisma#L5220) | 04 §31–32, §36 — a signer on a request with mapped fields and signing position. |
| `SignatureEvent` | `signature_events` | [L5265](../../api/prisma/schema.prisma#L5265) | 04 §38, §71 — provider and internal events; (provider, provider_event_id) is unique so duplicate callbacks are ignored. |
| `SignatureConsentText` | `signature_consent_texts` | [L5284](../../api/prisma/schema.prisma#L5284) | 04 §36 — versioned e-signature consent text per organization and locale. A signer records the exact text row it accepted; texts are retired (retired_at), nev… |
| `VerificationCode` | `verification_codes` | [L5307](../../api/prisma/schema.prisma#L5307) | 04 §36 — one-time code the platform sends to prove identity: a signer before signing (SIGNER_IDENTITY) or a proposal recipient before opening an EMAIL_VERIFI… |
| **Obligations & termination** | | | |
| `ContractObligation` | `contract_obligations` | [L5340](../../api/prisma/schema.prisma#L5340) | 04 §49–50, §75 — operational obligations linked to a contract section; execution may create a Task (06) rather than duplicating task functionality. |
| `ContractTermination` | `contract_terminations` | [L5376](../../api/prisma/schema.prisma#L5376) | 04 §53 — termination record. Never alters the signed document. |
| `ContractRenewalDecision` | `contract_renewal_decisions` | [L5401](../../api/prisma/schema.prisma#L5401) | 04 §46 — the renew / do-not-renew decision taken before a renewal contract exists. History is kept (a decision can be revised); the latest row is the effecti… |

**Owned enums (26):** `ContractStatus`, `ContractVersionStatus`, `ContractRelationKind`, `ContractRenewalType`, `ContractPartyType`, `ContractTemplateStatus`, `ContractClauseStatus`, `ContractReviewDecision`, `ContractApprovalDecision`, `ContractChangeRequestStatus`, `ContractObligationType`, `ContractObligationStatus`, `ExtractionReviewState`, `ContractTerminationType`, `ContractRiskLevel`, `ContractAiFindingKind`, `ContractAiFindingStatus`, `SignatureSubjectType`, `SigningOrder`, `SignatureType`, `SignatureRequestStatus`, `SignerStatus`, `SignatureEventType`, `VerificationPurpose`, `VerificationChannel`, `ContractRenewalDecisionType`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Contract.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Contract.owner`, `ContractAiFinding.reviewed_by`, `ContractApproval.approver`, `ContractComment.author` +2 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `Contract.organization`, `ContractApprovalRule.organization`, `ContractClause.organization`, `ContractTemplate.organization` +4 more |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `Contract.primary_company`, `ContractParty.company` |
| [02](./02-crm-sales-management.md) | `CrmContact` (`crm_contacts`) | `ContractReview.reviewer_contact`, `ContractSignatory.contact` |
| [03](./03-proposal-quotation-generator.md) | `Proposal` (`proposals`) | `Contract.proposal`, `VerificationCode.proposal` |
| [03](./03-proposal-quotation-generator.md) | `ProposalVersion` (`proposal_versions`) | `Contract.proposal_version`, `SignatureRequest.proposal_version` |
| [05](./05-project-management.md) | `Project` (`projects`) | `ContractProject.project` |
| [06](./06-task-management.md) | `Task` (`tasks`) | `ContractObligation.task` |
| [17](./17-documents-file-management.md) | `Document` (`documents`) | `ContractTermination.document`, `ContractVersion.document`, `ContractVersion.signed_document`, `SignatureRequest.audit_certificate_document` +1 more |

**Reused enums:** `BillingModel` ([08](./08-financial-management-stripe-integration.md)), `TimeNonBillableCategory` ([18](./18-time-tracking.md))

### Referenced by other modules

- [08](./08-financial-management-stripe-integration.md): `Invoice`, `Subscription`
- [09](./09-income-expense-management.md): `LedgerRecord`
- [10](./10-employee-management-system.md): `EmployeeDocument`
- [18](./18-time-tracking.md): `TimeProjectSettings`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `ProposalVersion.contracts` ([03](./03-proposal-quotation-generator.md), [L3990](../../api/prisma/schema.prisma#L3990)) — Contracts generated from this exact proposal version (04 §7, §55).
- `ProposalAcceptance.signature_request_id` ([03](./03-proposal-quotation-generator.md), [L4298](../../api/prisma/schema.prisma#L4298)) — Signature request id from the in-house e-signature service (04 §33–38); id only.
- `ProjectChangeRequest.proposal_id` ([05](./05-project-management.md), [L6260](../../api/prisma/schema.prisma#L6260)) — Commercial links (03, 04) and the contract change request this originated (04 §26, §43).
- `DocumentRetentionPolicy.enforced_by_module` ([17](./17-documents-file-management.md), [L18188](../../api/prisma/schema.prisma#L18188)) — Module that mandates this policy (e.g. CONTRACTS for 04 §84); null for organization policies.
- `DocumentVersion.checksum_sha256` ([17](./17-documents-file-management.md), [L18482](../../api/prisma/schema.prisma#L18482)) — SHA-256 of the stored bytes (integrity, dedupe, 04 §17 hashes).
- `TimeProjectSettings.contract_id` ([18](./18-time-tracking.md), [L19313](../../api/prisma/schema.prisma#L19313)) — Contract that defines the billing context (04 §54).

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 23 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `contracts.approval_rules` | manage* |
| `contracts.clauses` | manage* |
| `contracts.comments.internal` | read |
| `contracts.confidential_terms` | read* |
| `contracts.contracts` | read, create, update, delete*, archive, export*, review, approve*, amend, renew, terminate* |
| `contracts.knowledge` | search |
| `contracts.obligations` | manage |
| `contracts.signatures` | send*, cancel*, read |
| `contracts.templates` | manage* |
| `contracts.types` | manage |
| `contracts.versions` | create |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Purpose

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The Contracts module is the contractual source of truth for the Agency
Operating System. It manages the lifecycle of agreements from generation
and negotiation through approval, electronic signature, activation,
modification, renewal, termination and archival.

It must integrate with the existing CRM, Proposals, Projects, Finance,
Documents, Customer Portal, Messaging, Calendar and Task Management
modules without recreating their domain logic.

### Core lifecycle

**Generate → Review → Modify → Version → Approve → Sign → Activate →**
**Amend → Renew / Terminate → Archive**

### Core principles

* A customer can have many contracts.
* A contract can reference one or many projects.
* A project can exist without a contract.
* Signed contract versions are immutable.
* Every material modification is traceable to a version, amendment or
  renewal.
* A signature request is always bound to one exact document version.
* Commercial truth remains in Proposals; execution truth remains in
  Projects; financial transaction truth remains in Finance; document
  storage remains in Documents.

---

## 2. Contract Types

<!-- schema-section:start -->
> **Schema:** `ContractType` ([contract_types](../../api/prisma/schema.prisma#L4605))
<!-- schema-section:end -->

Configurable types should include:

* Master Service Agreement (MSA)
* Statement of Work (SOW)
* Software Development Agreement
* AI Automation Agreement
* Consulting Agreement
* Retainer Agreement
* Maintenance Agreement
* Support Agreement
* Managed Services Agreement
* Subscription Agreement
* Licensing Agreement
* NDA
* DPA
* Vendor Agreement
* Contractor Agreement
* Partnership Agreement
* Change Order
* Amendment
* Renewal
* Termination Agreement
* Other

Each type can define its default template, required metadata, approval
workflow, signature requirements, renewal behavior and required
relationships.

---

## 3. Contract Record

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `language` · enum `ContractRenewalType` ([L4405](../../api/prisma/schema.prisma#L4405))
<!-- schema-section:end -->

A contract is a structured business record plus one or more document
versions.

Core metadata:

* Contract ID
* Contract number
* Title
* Type
* Status
* Owner
* Primary customer
* Additional parties
* Effective date
* Start date
* End date
* Renewal type
* Renewal date
* Notice deadline
* Currency
* Contract value reference
* Related Proposal
* Related Projects
* Related parent contract
* Related documents
* Tags
* Custom fields

The metadata record must remain separate from the generated file
artifact.

`Contract.language` holds the language of the contract text (copied from the template).

---

## 4. Parties

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `primary_company_id` · `ContractParty` ([contract_parties](../../api/prisma/schema.prisma#L4881)) · `ContractSignatory` ([contract_signatories](../../api/prisma/schema.prisma#L4904)) · enum `ContractPartyType` ([L4413](../../api/prisma/schema.prisma#L4413))
<!-- schema-section:end -->

Contracts support multiple parties.

Each party can reference an existing CRM/company/contact record rather
than duplicating it.

Store contractual party context:

* Legal name
* Party type
* Address reference
* Signatory
* Signatory title
* Signatory email
* Signature requirements

A contract may have multiple signatories for the same party.

---

## 5. Contract Lifecycle States

<!-- schema-section:start -->
> **Schema:** enum `ContractStatus` ([L4366](../../api/prisma/schema.prisma#L4366))
<!-- schema-section:end -->

Recommended states:

* Draft
* Internal Review
* Customer Review
* Approval Required
* Ready for Signature
* Partially Signed
* Fully Signed
* Active
* Expiring
* Renewed
* Superseded
* Terminated
* Expired
* Cancelled
* Archived

Lifecycle status and document/version status are separate concepts.

---

## 6. Contract Numbering

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Support configurable numbering rules such as `CTR-2026-0001`, including
prefixes, year, type and organization-specific sequences.

Contract numbers should be stable and auditable.

---

## 7. Generation Sources

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `proposal_id`
<!-- schema-section:end -->

A contract can be created from:

* Blank contract
* Contract template
* Accepted Proposal
* Existing customer
* Existing Project
* Renewal
* Amendment
* Change Request
* API

The most important workflow is:

**CRM Deal → Accepted Proposal → Contract → Project**

The Contract stores the source Proposal and Proposal version used for
generation.

---

## 8. Template System

<!-- schema-section:start -->
> **Schema:** `ContractTemplate` ([contract_templates](../../api/prisma/schema.prisma#L4640)) · `ContractTemplateVersion` ([contract_template_versions](../../api/prisma/schema.prisma#L4670)) · enum `ContractTemplateStatus` ([L4424](../../api/prisma/schema.prisma#L4424))
<!-- schema-section:end -->

Templates are reusable contractual structures containing:

* Sections
* Clauses
* Variables
* Conditional sections
* Signature blocks
* Default metadata
* Required fields
* Optional clauses
* Appendices

Templates are independently versioned. Changing a template never
modifies existing contracts.

---

## 9. Template Variables

<!-- schema-section:start -->
> **Schema:** `ContractTemplateVersion` ([contract_template_versions](../../api/prisma/schema.prisma#L4670)): `variables` · `ContractVersion` ([contract_versions](../../api/prisma/schema.prisma#L4946)): `variables`
<!-- schema-section:end -->

Variables populate contractual data from platform records.

Examples:

* Customer legal name
* Company legal name
* Contract number
* Effective date
* Expiration date
* Project name
* Proposal number
* Proposal total
* Payment terms
* Signatory details

Required unresolved variables prevent final generation.

---

## 10. Conditional Clauses

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `processes_personal_data` · `ContractTemplateVersion` ([contract_template_versions](../../api/prisma/schema.prisma#L4670)): `conditional_rules`
<!-- schema-section:end -->

Templates can conditionally include clauses based on structured contract
data.

Examples:

* DPA section when personal data is processed.
* SLA section for managed support.
* Recurring billing section for retainers.
* Maintenance section for maintenance agreements.
* Milestone payment section for project-based work.

Rules must be deterministic, reviewable and versioned.

---

## 11. Clause Library

<!-- schema-section:start -->
> **Schema:** `ContractClause` ([contract_clauses](../../api/prisma/schema.prisma#L4697)): `usage_restrictions` · enum `ContractClauseStatus` ([L4431](../../api/prisma/schema.prisma#L4431))
<!-- schema-section:end -->

Reusable clauses should have:

* Clause ID
* Name
* Category
* Text
* Version
* Status
* Description
* Usage restrictions
* Owner
* Effective date
* Deprecated date

Categories may include payment, IP, confidentiality, privacy, liability,
warranty, termination, renewal, SLA, security and governing law.

---

## 12. Clause Versioning

<!-- schema-section:start -->
> **Schema:** `ContractClause` ([contract_clauses](../../api/prisma/schema.prisma#L4697)) · `ContractClauseVersion` ([contract_clause_versions](../../api/prisma/schema.prisma#L4725)) · `ContractSection` ([contract_sections](../../api/prisma/schema.prisma#L5000)) · enum `ContractClauseStatus` ([L4431](../../api/prisma/schema.prisma#L4431))
<!-- schema-section:end -->

A clause change creates a new clause version.

A previously generated contract retains the exact clause version used at
generation time.

No historical contract should silently inherit a newer clause.

---

## 13. Contract Editor

<!-- schema-section:start -->
> **Schema:** `ContractComment` ([contract_comments](../../api/prisma/schema.prisma#L5057))
<!-- schema-section:end -->

Authorized users can edit draft versions using a rich document editor
supporting:

* Rich text
* Headings
* Lists
* Tables
* Page breaks
* Sections
* Clause insertion
* Variable insertion
* Signature blocks
* Headers/footers
* Comments
* Review markers
* Appendices

Signed documents cannot be edited.

---

## 14. Structured Sections

<!-- schema-section:start -->
> **Schema:** `ContractSection` ([contract_sections](../../api/prisma/schema.prisma#L5000)) · `ContractTemplateVersion` ([contract_template_versions](../../api/prisma/schema.prisma#L4670))
<!-- schema-section:end -->

Sections should be addressable individually so the system can support
review comments, diffs and amendments against a specific section.

Typical sections:

 1. Parties
 2. Definitions
 3. Scope
 4. Deliverables
 5. Responsibilities
 6. Fees
 7. Payment
 8. IP
 9. Confidentiality
10. Data Protection
11. Security
12. Liability
13. Term
14. Renewal
15. Termination
16. Governing Law
17. Signatures
18. Schedules / Appendices

---

## 15. Contract Generation Workflow

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

 1. Select contract type.
 2. Select template.
 3. Select parties.
 4. Select related Proposal / Project.
 5. Populate structured metadata.
 6. Resolve variables.
 7. Resolve conditional clauses.
 8. Generate draft.
 9. Preview rendered document.
10. Edit if required.
11. Save a version.
12. Submit for review.
13. Approve exact version.
14. Lock version for signature.
15. Create signature package.
16. Send for signature.

---

## 16. Generation Validation

<!-- schema-section:start -->
> **Schema:** `ContractType` ([contract_types](../../api/prisma/schema.prisma#L4605)): `required_metadata`
<!-- schema-section:end -->

Before generation validate:

* Contract type
* Required parties
* Required fields
* Template version
* Clause dependencies
* Variables
* Dates
* Signatories
* Related records

Errors should identify the exact missing input.

---

## 17. Rendered Document

<!-- schema-section:start -->
> **Schema:** `ContractVersion` ([contract_versions](../../api/prisma/schema.prisma#L4946)): `content_hash`, `variables` — other modules: `DocumentVersion` ([document_versions](../../api/prisma/schema.prisma#L18482)): `checksum_sha256` ([17](./17-documents-file-management.md))
<!-- schema-section:end -->

Every finalized generation creates a document artifact containing:

* Contract ID
* Version
* Template version
* Clause versions
* Generation timestamp
* Generator
* Source references
* Document ID
* Integrity hash where applicable

---

## 18. PDF Generation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The final signature artifact should support stable PDF generation with
preserved pagination, formatting, tables, headers, footers, signature
blocks and appendices.

The exact rendering engine is an implementation detail.

---

## 19. Version Model

<!-- schema-section:start -->
> **Schema:** `ContractVersion` ([contract_versions](../../api/prisma/schema.prisma#L4946)): `label` · enum `ContractVersionStatus` ([L4385](../../api/prisma/schema.prisma#L4385))
<!-- schema-section:end -->

Every material draft change creates a version.

Example:

* v0.1 Initial draft
* v0.2 Internal revision
* v0.3 Customer revision
* v0.4 Final negotiation revision
* v1.0 Approved for signature
* Amendment 1
* Amendment 2

Version numbering can be configurable.

---

## 20. Version Record

<!-- schema-section:start -->
> **Schema:** `ContractVersion` ([contract_versions](../../api/prisma/schema.prisma#L4946)) · enum `ContractVersionStatus` ([L4385](../../api/prisma/schema.prisma#L4385))
<!-- schema-section:end -->

Each version stores:

* Version ID
* Version number
* Parent version
* Author
* Timestamp
* Change summary
* Status
* Document artifact
* Template version
* Approval state
* Signature state

---

## 21. Version Comparison

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Users can compare any two versions.

Comparison must highlight:

* Added text
* Removed text
* Changed text
* Added/removed sections
* Changed clauses
* Changed variables
* Changed dates
* Changed commercial references

Comparison must be read-only and must never modify either version.

---

## 22. Version Timeline

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Show a chronological version graph with author, timestamp, state, change
summary, approvals and signature status.

Example:

`v0.1 → v0.2 → v0.3 → v1.0 Signed → Amendment 1 → Renewal`

---

## 23. Review Workflow

<!-- schema-section:start -->
> **Schema:** `ContractComment` ([contract_comments](../../api/prisma/schema.prisma#L5057)) · `ContractReview` ([contract_reviews](../../api/prisma/schema.prisma#L5031)) · enum `ContractReviewDecision` ([L4438](../../api/prisma/schema.prisma#L4438))
<!-- schema-section:end -->

A review request references one exact version.

Reviewers can:

* Approve
* Reject
* Request changes
* Comment on a section
* Resolve comments

If a new version is created, the new version may require a new review.

Old review history remains attached to the old version.

---

## 24. Internal vs External Review

<!-- schema-section:start -->
> **Schema:** `ContractComment` ([contract_comments](../../api/prisma/schema.prisma#L5057)) · `ContractReview` ([contract_reviews](../../api/prisma/schema.prisma#L5031)): `reviewer_contact_id` · `ContractVersion` ([contract_versions](../../api/prisma/schema.prisma#L4946)): `customer_visible`
<!-- schema-section:end -->

Comments and review requests must distinguish:

* Internal
* Customer-visible

Internal notes must never be exposed through the Customer Portal.

A customer-side review names the reviewer contact (`ContractReview.reviewer_contact_id`).

---

## 25. Negotiation Workflow

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Support:

**Internal Draft → Customer Review → Requested Changes → New Version →**
**Internal Approval → Customer Approval → Signature**

Every negotiation round remains traceable.

---

## 26. Contract Change Requests

<!-- schema-section:start -->
> **Schema:** `ContractChangeRequest` ([contract_change_requests](../../api/prisma/schema.prisma#L5115)): `decision_note` · enum `ContractChangeRequestStatus` ([L4453](../../api/prisma/schema.prisma#L4453)) — other modules: `ProjectChangeRequest` ([project_change_requests](../../api/prisma/schema.prisma#L6260)): `proposal_id` ([05](./05-project-management.md)) · enum `ProjectChangeRequestStatus` ([L5560](../../api/prisma/schema.prisma#L5560)) ([05](./05-project-management.md))
<!-- schema-section:end -->

A Contract Change Request asks for a change to contract language or terms. It is distinct from a Project Change Request (05 §45), which changes delivery scope; an approved Project Change Request may originate a Contract Change Request and an Amendment (§43).

Contract change requests should capture:

* Requested section
* Requested change
* Requester
* Reason
* Impact
* Status
* Related version
* Resulting version

A customer request should never directly mutate the current contract.

Accepting or rejecting a request stores `decision_note`. Comments support replies (`ContractComment.parent_comment_id`).

---

## 27. Approval Workflow

<!-- schema-section:start -->
> **Schema:** `ContractApproval` ([contract_approvals](../../api/prisma/schema.prisma#L5147)) · `ContractType` ([contract_types](../../api/prisma/schema.prisma#L4605)): `approval_workflow` · enum `ContractApprovalDecision` ([L4446](../../api/prisma/schema.prisma#L4446))
<!-- schema-section:end -->

Signature approval is separate from internal business approval.

Approval steps may include:

* Account owner
* Finance
* Legal reviewer
* Executive
* Technical owner

Each approval is bound to an exact contract version.

---

## 28. Approval Rules

<!-- schema-section:start -->
> **Schema:** `ContractApproval` ([contract_approvals](../../api/prisma/schema.prisma#L5147)) · `ContractApprovalRule` ([contract_approval_rules](../../api/prisma/schema.prisma#L4746)) · enum `ContractApprovalDecision` ([L4446](../../api/prisma/schema.prisma#L4446)) — other modules: `ProposalApprovalRule` ([proposal_approval_rules](../../api/prisma/schema.prisma#L4164)) ([03](./03-proposal-quotation-generator.md))
<!-- schema-section:end -->

Approval requirements can depend on:

* Contract value
* Contract type
* Liability terms
* Discount
* Payment terms
* Duration
* Customer category
* Risk level
* Custom fields

Example:

`High-value contract → Finance approval → Executive approval → Ready for Signature`

---

## 29. Approval Audit

<!-- schema-section:start -->
> **Schema:** `ContractApproval` ([contract_approvals](../../api/prisma/schema.prisma#L5147)) · enum `ContractApprovalDecision` ([L4446](../../api/prisma/schema.prisma#L4446))
<!-- schema-section:end -->

Record:

* Version
* Approval step
* Approver
* Decision
* Date
* Comments

Approval of v1.0 does not approve v1.1.

---

## 30. Signature Preparation

<!-- schema-section:start -->
> **Schema:** `ContractComment` ([contract_comments](../../api/prisma/schema.prisma#L5057)): `is_blocking`
<!-- schema-section:end -->

Before sending for signature validate:

* Exact version selected
* Required approvals complete
* Required parties exist
* Signatories are configured
* Signature fields are mapped
* Required fields are populated
* Required appendices exist
* No blocking review comments remain

---

## 31. Signature Blocks

<!-- schema-section:start -->
> **Schema:** `ContractSignatory` ([contract_signatories](../../api/prisma/schema.prisma#L4904)) · `ContractTemplateVersion` ([contract_template_versions](../../api/prisma/schema.prisma#L4670)): `signature_blocks` · `Signer` ([signers](../../api/prisma/schema.prisma#L5220)): `fields`
<!-- schema-section:end -->

Support:

* Party
* Signer name
* Title
* Email
* Signature field
* Date field
* Initial field
* Text field

Each field is mapped to a specific signer.

---

## 32. Signature Workflow

<!-- schema-section:start -->
> **Schema:** `Signer` ([signers](../../api/prisma/schema.prisma#L5220)) · enum `SigningOrder` ([L4533](../../api/prisma/schema.prisma#L4533))
<!-- schema-section:end -->

Support:

* Single signer
* Multiple signers
* Sequential signing
* Parallel signing
* Internal then external
* External then internal
* Multiple parties

---

## 33. Signature Service (built in-house)

<!-- schema-section:start -->
> **Schema:** other modules: `ProposalAcceptance` ([proposal_acceptances](../../api/prisma/schema.prisma#L4298)): `signature_request_id` ([03](./03-proposal-quotation-generator.md))
<!-- schema-section:end -->

Electronic signature is built into the platform. There is no third-party signature provider and no provider credentials to configure.

The signing flow:

* Each signer receives a **single-use signing link** (only a hash of the token is stored).
* The signer's **identity is verified** with a one-time code sent by email or SMS before the document opens.
* The signer accepts the **e-signature consent text** (its version is recorded) and gives a **signature**: drawn, typed or uploaded (stored as a document, 17).
* Every step is a signature event with timestamp, IP address, user agent and authentication method.
* On completion the platform renders the final artifact, stores a **hash**, and generates an **audit certificate** (17).

The same service signs proposals (03). Signature evidence stays separate from core contract fields.
---

## 34. Signature Request

<!-- schema-section:start -->
> **Schema:** `SignatureRequest` ([signature_requests](../../api/prisma/schema.prisma#L5172)) · enum `SignatureSubjectType` ([L4527](../../api/prisma/schema.prisma#L4527)) — other modules: `ProposalAcceptance` ([proposal_acceptances](../../api/prisma/schema.prisma#L4298)): `signature_request_id` ([03](./03-proposal-quotation-generator.md))
<!-- schema-section:end -->

A signature request contains:

* Request ID
* Contract ID
* Exact version ID
* Signers
* Signing order
* Created timestamp
* Sent timestamp
* Expiration
* Status

The version relationship is immutable.

---

## 35. Signature States

<!-- schema-section:start -->
> **Schema:** enum `SignatureRequestStatus` ([L4546](../../api/prisma/schema.prisma#L4546)) — other modules: `ProposalAcceptance` ([proposal_acceptances](../../api/prisma/schema.prisma#L4298)): `signature_request_id` ([03](./03-proposal-quotation-generator.md))
<!-- schema-section:end -->

Support:

* Not Sent
* Sent
* Delivered
* Viewed
* Partially Signed
* Fully Signed
* Declined
* Expired
* Cancelled
* Failed

---

## 36. Signer Experience

<!-- schema-section:start -->
> **Schema:** `ContractSignatory` ([contract_signatories](../../api/prisma/schema.prisma#L4904)): `phone` · `SignatureConsentText` ([signature_consent_texts](../../api/prisma/schema.prisma#L5284)) · `Signer` ([signers](../../api/prisma/schema.prisma#L5220)): `phone` · `VerificationCode` ([verification_codes](../../api/prisma/schema.prisma#L5307)) · enum `SignatureType` ([L4539](../../api/prisma/schema.prisma#L4539)) · enum `VerificationChannel` ([L4591](../../api/prisma/schema.prisma#L4591)) · enum `VerificationPurpose` ([L4585](../../api/prisma/schema.prisma#L4585)) — other modules: `ProposalAcceptance` ([proposal_acceptances](../../api/prisma/schema.prisma#L4298)): `signature_request_id` ([03](./03-proposal-quotation-generator.md))
<!-- schema-section:end -->

The signer sees:

* Contract title
* Parties
* Document preview
* Required fields
* Signature controls
* Completion status
* Signing confirmation

The signing page is part of the platform: a public single-use link, no account needed, branded with the organization's branding (01 §15), and responsive for phones.

**Identity codes and consent.** One-time codes are `VerificationCode` rows (email or SMS, only the hash stored, expiry, attempts, lock). SMS needs `Signer.phone` and the organization's own TWILIO connection. The consent a signer accepts is a versioned `SignatureConsentText` (`Signer.consent_text_id`).

---

## 37. Signature Reminders

<!-- schema-section:start -->
> **Schema:** `SignatureRequest` ([signature_requests](../../api/prisma/schema.prisma#L5172)): `reminder_settings` — other modules: `ProposalAcceptance` ([proposal_acceptances](../../api/prisma/schema.prisma#L4298)): `signature_request_id` ([03](./03-proposal-quotation-generator.md))
<!-- schema-section:end -->

Support configurable reminder frequency, maximum reminders and
expiration.

Reminder delivery uses [14 Notifications](./14-notifications-activity-center.md) (LOG-403); scheduling uses [20 Automation Engine](./20-automation-engine.md) (LOG-410). Contracts does not implement its own reminder delivery.

---

## 38. Signature Audit Trail

<!-- schema-section:start -->
> **Schema:** `SignatureEvent` ([signature_events](../../api/prisma/schema.prisma#L5265)) · enum `SignatureEventType` ([L4570](../../api/prisma/schema.prisma#L4570)) — other modules: `ProposalAcceptance` ([proposal_acceptances](../../api/prisma/schema.prisma#L4298)): `signature_request_id` ([03](./03-proposal-quotation-generator.md))
<!-- schema-section:end -->

Record signing events including:

* Request created
* Sent
* Delivered
* Viewed
* Signed
* Declined
* Reminder sent
* Cancelled
* Expired

Retain for every event the timestamp, signer, IP address, user agent, authentication
method (one-time code), consent text version and the audit certificate reference.

---

## 39. Signed Artifact Immutability

<!-- schema-section:start -->
> **Schema:** `ContractVersion` ([contract_versions](../../api/prisma/schema.prisma#L4946))
<!-- schema-section:end -->

After full signature:

* Document cannot be edited.
* Signed version cannot be overwritten.
* Signature evidence cannot be replaced.
* Audit history cannot be rewritten.
* Future changes require an amendment, renewal or new contract.

---

## 40. Signed Artifact Integrity

<!-- schema-section:start -->
> **Schema:** `ContractVersion` ([contract_versions](../../api/prisma/schema.prisma#L4946)): `content_hash`
<!-- schema-section:end -->

Store an integrity hash/fingerprint of the finalized signed artifact
where appropriate.

This provides technical evidence that the stored artifact has not been
changed.

---

## 41. Signature Completion

<!-- schema-section:start -->
> **Schema:** `ContractVersion` ([contract_versions](../../api/prisma/schema.prisma#L4946)): `signed_document_id`
<!-- schema-section:end -->

When all required signatures are completed:

1. Detect that the last required signer has signed.
2. Validate request and version.
3. Render the final artifact (document plus signature blocks) and compute its hash.
4. Store signed artifact.
5. Store signature evidence.
6. Mark version Signed.
7. Move contract to Active where applicable.
8. Create audit event.
9. Trigger configured downstream workflows.

---

## 42. Signature Failure / Expiration

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Failed or expired requests must preserve history and allow authorized
retry.

Retrying a signature request must not silently change the signed
document version.

If content changes, create a new version first.

---

## 43. Amendments

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `parent_contract_id`, `project_change_request_id` · enum `ContractRelationKind` ([L4395](../../api/prisma/schema.prisma#L4395)) — other modules: `ProjectChangeRequest` ([project_change_requests](../../api/prisma/schema.prisma#L6260)): `proposal_id` ([05](./05-project-management.md))
<!-- schema-section:end -->

An amendment is a first-class record linked to the original signed
contract.

Fields:

* Amendment number
* Original contract
* Original signed version
* Effective date
* Reason
* Changed sections
* Old language reference
* New language
* Approval state
* Signature state
* Related Project Change Request
* Related Proposal / commercial record

---

## 44. Amendment Generation

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `parent_contract_id`
<!-- schema-section:end -->

Workflow:

 1. Select active contract.
 2. Select amendment template.
 3. Select sections being changed.
 4. Populate new language.
 5. Link originating change request if applicable.
 6. Generate amendment.
 7. Review.
 8. Approve.
 9. Lock amendment version.
10. Send for signature.
11. Activate after completion.

The original contract remains unchanged.

---

## 45. Amendment Document

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `parent_contract_id`
<!-- schema-section:end -->

The amendment should clearly identify:

* Original agreement
* Amendment number
* Effective date
* Modified sections
* Replacement language
* Unchanged provisions
* Signatures

---

## 46. Renewal

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `parent_contract_id` · `ContractRenewalDecision` ([contract_renewal_decisions](../../api/prisma/schema.prisma#L5401)) · enum `ContractRelationKind` ([L4395](../../api/prisma/schema.prisma#L4395)) · enum `ContractRenewalDecisionType` ([L4597](../../api/prisma/schema.prisma#L4597))
<!-- schema-section:end -->

Renewals should preserve lineage:

**Original Contract → Renewal → Renewal Version**

Support:

* Manual renewal
* Automatic renewal workflow
* Modified renewal
* Renewal with new Proposal
* Renewal with new Project

The renew / do-not-renew decision is stored as `ContractRenewalDecision` before any renewal contract exists, and links to it once created.

---

## 47. Superseding Contract

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `parent_contract_id`, `superseded_by_contract_id` · enum `ContractRelationKind` ([L4395](../../api/prisma/schema.prisma#L4395))
<!-- schema-section:end -->

A new contract can supersede an existing contract.

Relationship:

**Contract A → Superseded By → Contract B**

The old contract remains historically accessible.

---

## 48. Master Agreement / SOW Structure

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `parent_contract_id` · enum `ContractRelationKind` ([L4395](../../api/prisma/schema.prisma#L4395))
<!-- schema-section:end -->

Support structures such as:

**MSA → SOW → Amendment → Renewal**

The MSA can contain general legal terms while SOWs contain
project-specific scope.

Each SOW may link to a Project.

---

## 49. Contract Obligations

<!-- schema-section:start -->
> **Schema:** `ContractObligation` ([contract_obligations](../../api/prisma/schema.prisma#L5340)) · enum `ContractObligationType` ([L4463](../../api/prisma/schema.prisma#L4463)) — other modules: `TaskLink` ([task_links](../../api/prisma/schema.prisma#L6990)) ([06](./06-task-management.md))
<!-- schema-section:end -->

Authorized users may track operational obligations such as:

* Deliverable due date
* Payment obligation
* Reporting obligation
* Renewal notice
* SLA requirement
* Security review
* Customer approval

Each obligation should link to its originating contract section.

Where execution is needed, the obligation may create/link a Task instead
of duplicating task functionality.

---

## 50. Obligation Tracking

<!-- schema-section:start -->
> **Schema:** `ContractObligation` ([contract_obligations](../../api/prisma/schema.prisma#L5340)) · enum `ContractObligationType` ([L4463](../../api/prisma/schema.prisma#L4463))
<!-- schema-section:end -->

An obligation contains:

* Title
* Type
* Responsible party
* Due date
* Frequency
* Status
* Reminder
* Related Project
* Related Task
* Source contract section

---

## 51. Contract Dates

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Distinguish:

* Draft date
* Approval date
* Signature date
* Effective date
* Start date
* End date
* Renewal date
* Notice deadline
* Expiration date
* Termination date

These dates should be independently addressable by automation.

---

## 52. Expiration / Renewal Monitoring

<!-- schema-section:start -->
> **Schema:** `ContractType` ([contract_types](../../api/prisma/schema.prisma#L4605)): `reminder_windows_days`
<!-- schema-section:end -->

The system should monitor upcoming expiration and notice dates.

Configurable reminder windows can include 180, 120, 90, 60, 30, 14 and 7
days.

The exact windows should be organization-configurable.

---

## 53. Termination

<!-- schema-section:start -->
> **Schema:** `ContractTermination` ([contract_terminations](../../api/prisma/schema.prisma#L5376)): `impact` · enum `ContractTerminationType` ([L4491](../../api/prisma/schema.prisma#L4491))
<!-- schema-section:end -->

Termination records:

* Termination type
* Reason
* Requesting party
* Notice date
* Effective date
* Approval
* Supporting document
* Notes

Termination never deletes or alters the original signed document.

The chosen impact handling (obligations, child contracts) is kept in `ContractTermination.impact`.

---

## 54. Contract Value / Payment Context

<!-- schema-section:start -->
> **Schema:** other modules: `TimeProjectSettings` ([time_project_settings](../../api/prisma/schema.prisma#L19313)): `contract_id` ([18](./18-time-tracking.md))
<!-- schema-section:end -->

Contracts may store structured contractual context:

* Total value
* Currency
* One-time value
* Recurring value
* Billing frequency
* Payment terms

Finance remains authoritative for actual invoices, payments, expenses
and accounting records.

---

## 55. Proposal Integration

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `proposal_id`
<!-- schema-section:end -->

Contracts reference the Proposal and exact Proposal version that produced the
contractual commercial context.

The Contract may consume:

* Services
* Scope
* Deliverables
* Pricing context
* Payment terms
* Duration
* Commercial assumptions

Proposals remain authoritative for proposal versions and commercial
acceptance.

---

## 56. Project Integration

<!-- schema-section:start -->
> **Schema:** `ContractProject` ([contract_projects](../../api/prisma/schema.prisma#L4928))
<!-- schema-section:end -->

Contracts can reference multiple Projects.

Projects can surface:

* Contract status
* Effective dates
* Relevant scope
* Contractual milestones
* Change requests
* Amendments
* Obligations

Projects remain authoritative for delivery execution.

---

## 57. Project / Contract Creation Flow

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Example:

**Proposal Accepted → Contract Generated → Contract Signed → Project**
**Created / Activated**

The Project receives relevant operational context but does not copy the
entire contract as a second source of truth.

---

## 58. Finance Integration

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Finance may consume contract context such as:

* Contract value
* Billing frequency
* Payment terms
* Currency
* Renewal dates
* Related projects

Finance owns invoices, payments, expenses and accounting records.

---

## 59. CRM Integration

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Contracts should appear from the relevant customer/company/contact
context.

CRM owns relationship and sales records.

Contracts own contractual records.

---

## 60. Documents Integration

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [17 Documents & File Management](./17-documents-file-management.md) · Linear LOG-407.

Documents stores the actual contract artifacts as Document versions; signed versions are locked there (17 §6).

Contracts owns:

* Contract metadata
* Version lineage
* Approval state
* Signature state
* Amendment relationships
* Lifecycle

Documents owns storage, file metadata and document infrastructure.

---

## 61. Customer Portal Integration

<!-- schema-section:start -->
> **Schema:** `Contract` ([contracts](../../api/prisma/schema.prisma#L4768)): `customer_visible` · `ContractVersion` ([contract_versions](../../api/prisma/schema.prisma#L4946)): `customer_visible`
<!-- schema-section:end -->

The Customer Portal can expose, when authorized:

* Contracts for review
* Contracts awaiting signature
* Active contracts
* Signed documents
* Amendments
* Renewals
* Customer-visible comments

Portal authentication and customer access control remain in the Customer
Portal module.

---

## 62. Notifications & Messaging Integration

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Notification engine defined by → [14 Notifications](./14-notifications-activity-center.md) · Linear LOG-403. Conversations defined by → [12 Messaging](./12-messaging-team-communication.md) · Linear LOG-313.

Contracts emits these events; 14 delivers them and 12 can surface them in channels:

* Review requested
* Approval requested
* Signature required
* Signature completed
* Amendment requested
* Renewal approaching

Actual conversations remain in Messaging.

---

## 63. Calendar Integration

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [19 Calendar](./19-calendar.md) · Linear LOG-409.

Contract dates are projected onto the Calendar as read-only dates (19 §2) for:

* Expiration
* Renewal
* Notice deadlines
* Review meetings
* Signature deadlines

Calendar remains authoritative for actual events.

---

## 64. Contract Search / Views

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Search by:

* Contract number
* Title
* Customer
* Type
* Status
* Owner
* Signatory
* Proposal
* Project
* Effective date
* Expiration date
* Tags
* Custom fields

Views:

* All
* Drafts
* Internal Review
* Customer Review
* Approval
* Awaiting Signature
* Active
* Expiring
* Amendments
* Renewals
* Terminated
* Archived

Obligation lists use their own saved-view type (`CONTRACT_OBLIGATION`).

---

## 65. Contract Dashboard

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Widgets should include:

* Active contracts
* Drafts
* Awaiting approval
* Awaiting signature
* Expiring soon
* Renewals due
* Recently signed
* Recent amendments
* Contract value context
* Contracts by type
* Contracts by customer

---

## 66. Contract Timeline

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Show the complete lifecycle:

* Created
* Generated
* Versioned
* Reviewed
* Approved
* Signature requested
* Signed
* Activated
* Amended
* Renewed
* Terminated
* Archived

---

## 67. Permissions

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Roles, scopes, approval rights and the permission catalog are defined by → [01](./01-users-organizations-permissions.md) · Linear LOG-406. Keys follow 01 §46 (`contracts.contracts.read`, `contracts.contracts.approve`, `contracts.templates.manage`, and so on).

Contract-specific permissions should distinguish:

* View contract
* View confidential terms
* Create contract
* Edit draft
* Create version
* Review
* Approve
* Send signature request
* Cancel signature request
* Create amendment
* Renew
* Terminate
* Archive
* Manage templates
* Manage clauses

Signed content requires stricter controls than drafts.

---

## 68. Audit Trail

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Audit all material actions:

* Created
* Generated
* Edited
* Version created
* Review requested
* Comment added
* Approved
* Signature requested
* Signature completed
* Amendment created
* Renewal created
* Status changed
* Terminated
* Archived

Audit entries identify actor, timestamp, affected record/version and
action.

---

## 69. API

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Contracts should be first-class API resources.

Operations should include:

* Create
* Retrieve
* Update draft
* Search
* Generate
* Create version
* Compare versions
* Submit review
* Approve
* Create signature request
* Retrieve signature status
* Create amendment
* Create renewal
* Link Proposal
* Link Project
* Archive

The API must prevent unauthorized mutation of signed artifacts.

---

## 70. Webhooks

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Recommended events:

* `contract.created`
* `contract.generated`
* `contract.version_created`
* `contract.review_requested`
* `contract.change_requested`
* `contract.approved`
* `contract.signature_requested`
* `contract.partially_signed`
* `contract.signed`
* `contract.signature_declined`
* `contract.signature_expired`
* `contract.amendment_created`
* `contract.renewal_created`
* `contract.expiring`
* `contract.terminated`
* `contract.archived`

Delivery follows the platform webhook standard in `docs/Product_Specification.md` §4. The same events are published to [20 Automation Engine](./20-automation-engine.md) and [14 Notifications](./14-notifications-activity-center.md).

---

## 71. Signature Event Processing

<!-- schema-section:start -->
> **Schema:** `SignatureEvent` ([signature_events](../../api/prisma/schema.prisma#L5265))
<!-- schema-section:end -->

Signing actions must be processed idempotently.

Duplicate submissions (double click, retry, replayed request) must not:

* Create duplicate versions
* Create duplicate signature records
* Trigger duplicate downstream workflows

Each event keeps its IP address, user agent and payload for troubleshooting.

---

## 72. AI Assistance

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

AI may assist with:

* Draft generation
* Clause suggestions
* Summarization
* Version-difference summaries
* Missing-field detection
* Obligation extraction
* Risk identification
* Renewal preparation
* Plain-language explanations

AI output must never silently alter approved or signed contractual
language.

---

## 73. AI Contract Review

<!-- schema-section:start -->
> **Schema:** `ContractAiFinding` ([contract_ai_findings](../../api/prisma/schema.prisma#L5087)) · enum `ContractAiFindingKind` ([L4508](../../api/prisma/schema.prisma#L4508)) · enum `ContractAiFindingStatus` ([L4520](../../api/prisma/schema.prisma#L4520)) — other modules: `ProposalAiFinding` ([proposal_ai_findings](../../api/prisma/schema.prisma#L4331)) ([03](./03-proposal-quotation-generator.md))
<!-- schema-section:end -->

Each finding is stored (`ContractAiFinding`) with the section it points at, its kind, severity, the model that produced it and a status (open, accepted or dismissed) with who handled it and when.

AI can flag:

* Missing clauses
* Conflicting dates
* Unusual payment terms
* Liability differences
* Termination differences
* Scope inconsistencies
* Renewal provisions
* Non-standard clauses

Every finding should point to the relevant section and indicate that it
is an AI-generated recommendation.

---

## 74. Contract Risk Scoring

<!-- schema-section:start -->
> **Schema:** enum `ContractRiskLevel` ([L4500](../../api/prisma/schema.prisma#L4500))
<!-- schema-section:end -->

Optional configurable scoring may consider:

* Contract type
* Liability
* Payment terms
* Duration
* Termination rights
* Privacy requirements
* Non-standard clauses
* Manual risk flags

Risk scores should be explainable and should not constitute legal
advice.

---

## 75. AI Obligation Extraction

<!-- schema-section:start -->
> **Schema:** `ContractObligation` ([contract_obligations](../../api/prisma/schema.prisma#L5340)): `is_ai_extracted` · enum `ExtractionReviewState` ([L4484](../../api/prisma/schema.prisma#L4484))
<!-- schema-section:end -->

The system may extract obligations from the final contract:

* Obligation
* Responsible party
* Due date
* Frequency
* Source section
* Confidence
* Review state

No automated operational action should be created from an unreviewed
extraction unless explicitly configured.

---

## 76. Contract Knowledge Search

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Authorized users can search contractual content across active and
historical versions.

Search must respect contract permissions, customer isolation and document
access.

Active/current contractual language should be clearly distinguished from
historical language.

---

## 77. Contract Template Governance

<!-- schema-section:start -->
> **Schema:** `ContractTemplate` ([contract_templates](../../api/prisma/schema.prisma#L4640)) · enum `ContractTemplateStatus` ([L4424](../../api/prisma/schema.prisma#L4424))
<!-- schema-section:end -->

Templates require:

* Owner
* Version
* Approval state
* Effective date
* Deprecated state
* Change history

Only authorized users can publish templates.

---

## 78. Contract Package

<!-- schema-section:start -->
> **Schema:** `SignatureRequest` ([signature_requests](../../api/prisma/schema.prisma#L5172)): `package_documents`
<!-- schema-section:end -->

A signature package can contain multiple documents:

* MSA
* SOW
* DPA
* SLA
* Appendices

Package ordering and exact document versions must be locked when
submitted for signature.

---

## 79. Package Validation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Before signature validate:

* Primary document exists
* Required attachments exist
* All signers exist
* Signature fields are mapped
* Required approvals are complete
* Exact version is selected
* No blocking comments remain

---

## 80. Version Locking Rules

<!-- schema-section:start -->
> **Schema:** enum `ContractVersionStatus` ([L4385](../../api/prisma/schema.prisma#L4385))
<!-- schema-section:end -->

### Review lock

A review request references one version.

### Approval lock

Approval is granted to one exact version.

### Signature lock

A signature request references one immutable version.

### Signed lock

A signed version is permanently immutable.

Any subsequent change creates a new version or amendment.

---

## 81. Re-signing

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

If a signed document must change:

1. Identify required change.
2. Create amendment or new draft/version.
3. Run review and approval.
4. Generate new artifact.
5. Create new signature request.
6. Preserve original signed artifact.

---

## 82. Bulk Generation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Authorized users may generate multiple independent contracts from one
template.

Each generated contract must have:

* Independent ID
* Independent version history
* Independent approval
* Independent signature state
* Independent audit trail

---

## 83. Contract Closeout

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

When a contract expires or terminates:

* Record final state.
* Preserve signed versions.
* Identify open obligations.
* Close or hand off renewal workflow.
* Notify related Projects where configured.
* Preserve Finance relationships.
* Preserve Portal visibility according to policy.
* Retain audit history.

---

## 84. Data Retention

<!-- schema-section:start -->
> **Schema:** `ContractType` ([contract_types](../../api/prisma/schema.prisma#L4605)): `retention_days` — other modules: `DocumentRetentionPolicy` ([document_retention_policies](../../api/prisma/schema.prisma#L18188)) ([17](./17-documents-file-management.md))
<!-- schema-section:end -->

Retention policies should be configurable by organization and contract
type.

Retention must not break contractual lineage or signature evidence.

Deletion workflows for legally retained contracts must be restricted and
auditable.

---

## 85. Security / Isolation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [01](./01-users-organizations-permissions.md) §3, §9, §85, §136–137 · Linear LOG-406.

Contracts consumes the central authorization service and additionally enforces:

* Organization isolation
* Customer isolation
* Role-based access
* Contract-level access
* Secure document access
* Signature security
* Auditability
* API authorization

A user with access to Customer A must not automatically access Customer B
contracts.

---

## 86. Operational vs Legal State

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The UI should clearly separate:

* Document state
* Contract state
* Project state
* Finance state

Example:

`Document = Signed` `Contract = Active` `Project = In Progress`
`Finance = Billing`

These states are related but independently owned.

---

## 87. Contract Lifecycle Automation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Engine defined by → [20 Automation Engine](./20-automation-engine.md) · Linear LOG-410. Contracts declares its triggers and actions; the rules run in the engine. Mandatory rules (signed-version immutability, approval before signature) are module logic and are never configurable rules.

Example rules:

* Proposal accepted → prepare contract
* Contract approved → prepare signature
* Contract fully signed → activate contract
* Contract signed → create/activate Project workflow
* Expiration approaching → notify owner
* Renewal due → create renewal workflow
* Amendment signed → update contractual context for linked Projects
* Contract terminated → notify relevant Project / Finance workflows

Automations must be configurable.

---

## 88. Recommended MVP

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

### Core

* Contract records
* Contract types
* Parties
* Lifecycle
* Numbering
* Customer relationships
* Proposal relationships
* Project relationships

### Generation

* Templates
* Variables
* Conditional clauses
* Clause library
* Rich editor
* Preview
* PDF generation

### Versioning

* Draft versions
* Version history
* Version comparison
* Change summaries
* Immutable signed versions

### Review / Approval

* Review workflow
* Internal/external comments
* Approval workflow
* Approval audit

### Signature

* Signature blocks
* Signature service (single-use link, identity verification, consent)
* Signature requests
* Sequential/parallel signing
* Signature status
* Signature audit trail and certificate
* Signed artifact storage
* Reminder / expiration handling

### Lifecycle

* Amendments
* Renewals
* Termination
* Expiration monitoring
* Obligations

### Integrations

* CRM
* Proposals
* Projects
* Finance
* Documents
* Customer Portal
* Messaging
* Calendar

### Platform

* Permissions
* Audit trail
* Search
* Views
* Existing custom fields
* API
* Webhooks

---

## 89. Phase 2

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Advanced negotiation
* Clause governance
* AI contract review
* Obligation extraction
* Contract risk scoring
* Bulk generation
* Advanced renewal automation
* Contract analytics
* Advanced signature packages
* Advanced approval rules
* Contract dashboards

---

## 90. Phase 3

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* AI-assisted drafting
* Jurisdiction-aware clause systems
* Advanced obligation monitoring
* Contract-to-project orchestration
* Cross-contract risk analysis
* Organization-wide obligation dashboards
* Advanced legal-system integrations

---

## 91. End-to-End Example

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

**CRM**

Deal reaches commercial stage.

↓

**Proposals**

Proposal is generated, negotiated, versioned and accepted.

↓

**Contracts**

Accepted Proposal initializes the correct contract template. Customer,
services, scope and commercial context populate variables.

↓

**Review**

Internal approval and customer review occur against specific versions.

↓

**Modification**

Customer requests changes. A new contract version is created. The previous
version remains available.

↓

**Approval**

The exact final version is approved.

↓

**Signature**

That exact version is locked and sent to signers.

↓

**Activation**

The signing service confirms completion. Signed artifact and audit
evidence are stored. Contract becomes Active.

↓

**Projects**

The contract is linked to one or more Projects. Projects consume
contractual scope and deadlines but remain the execution layer.

↓

**Finance**

Finance uses contractual billing context to manage invoices and
payments.

↓

**Amendment**

Additional scope creates a Project Change Request. After approval, a
Contract Amendment is generated, signed and linked to the original
agreement.

↓

**Renewal**

Expiration monitoring starts the renewal workflow. The renewal
references the historical agreement and produces a new contractual
artifact.

---

## 92. Final Architecture Rule

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Contracts should be the **single contractual source of truth**.

The complete platform relationship is:

**CRM → Proposal → Contract → Project → Tasks / Time / Support / Finance**

Each module owns its own domain.

Contracts own contractual metadata, contractual versions, approval
state, signature state, amendments, renewals, obligations and
legal-document lineage.

Contracts must integrate deeply with the rest of the Agency OS while
avoiding duplication of CRM, Proposal, Project, Task, Finance, Support,
Document, Messaging, Calendar and Portal functionality.

### Critical invariant

**A signed contract version can never be edited or overwritten. Any**
**substantive change must be represented by a new contractual artifact**
**with a traceable relationship to the previous signed agreement.**
