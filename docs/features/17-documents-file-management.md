# Documents & File Management

> Linear: [LOG-407](https://linear.app/logiqdev/issue/LOG-407/documents-and-file-management) · Status: Backlog

> **Canonical for:** file storage, document records, versions, folders, attachments, sharing, previews, retention and the secure credential vault. Every module that stores or shows files references this module instead of implementing storage.
>
> **Depends on:** [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) (LOG-406) for tenant isolation, permissions, resource visibility and branding · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) for sharing and approval notifications.
>
> **Consumed by:** 02 CRM (attachments on records), 03 Proposals (generated PDFs, attachments), 04 Contracts (signed artifacts, §60), 05 Projects (§34–35 project documents and files), 06 Tasks (task attachments), 07 Customer Portal (Documents section), 09 Income & Expense (invoice and receipt uploads), 10 Employees (employee documents), 12 Messaging (§22 attachments), 13 Support (ticket attachments), 15 Business Docs (internal knowledge content).

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (22)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Configuration** | | | |
| `DocumentSettings` | `document_settings` | [L18080](../../api/prisma/schema.prisma#L18080) | 17 §5, §8, §9, §13 — organization-level document settings: file type / size limits, scanning, public links, watermarking, soft-delete recovery window, folder… |
| `DocumentCategory` | `document_categories` | [L18122](../../api/prisma/schema.prisma#L18122) | 17 §4 — configurable document categories (contract, proposal, deliverable, design, specification, invoice, receipt, HR document, policy, other). System categ… |
| `DocumentStorageConnection` | `document_storage_connections` | [L18156](../../api/prisma/schema.prisma#L18156) | 17 §16 — external storage provider connection (Google Drive, Microsoft 365, S3-compatible) behind the storage abstraction. The Document record stays in this … |
| `DocumentRetentionPolicy` | `document_retention_policies` | [L18188](../../api/prisma/schema.prisma#L18188) | 17 §13 — retention policies per category and scope (04 §84 contract retention is enforced here). |
| **Folders** | | | |
| `FolderTemplate` | `folder_templates` | [L18223](../../api/prisma/schema.prisma#L18223) | 17 §7 — default folder structures per project type (05 §36), per customer, per employee or organization. |
| `Folder` | `folders` | [L18249](../../api/prisma/schema.prisma#L18249) | 17 §2, §3, §7 — hierarchical container scoped to an organization, branch, team, project, customer or employee. Moving / renaming / archiving a folder never c… |
| **Documents** | | | |
| `Document` | `documents` | [L18324](../../api/prisma/schema.prisma#L18324) | 17 §2, §3, §4 — the Document record: a logical document with one or more immutable file versions, a title, category, scope, status, owner, retention policy a… |
| `DocumentVersion` | `document_versions` | [L18482](../../api/prisma/schema.prisma#L18482) | 17 §2 File, §6 Versioning — an immutable file snapshot inside a Document, with author, timestamp, change note, scan result and lock. Re-uploads create a new … |
| `DocumentUploadJob` | `document_upload_jobs` | [L18552](../../api/prisma/schema.prisma#L18552) | 17 §5 — upload / intake job: drag-and-drop and multi-file uploads, upload from URL, portal uploads, email captures (13), OCR intake (09) and generated PDFs (… |
| `DocumentPreview` | `document_previews` | [L18615](../../api/prisma/schema.prisma#L18615) | 17 §8 — generated preview rendition of a version (thumbnail, image pages, PDF rendition, text extract, transcoded media). Served through signed URLs only. |
| `DocumentAttachment` | `document_attachments` | [L18644](../../api/prisma/schema.prisma#L18644) | 17 §2 Attachment, §11 — polymorphic link between a Document and a business record (task, ticket, message, financial record, CRM record, employee …). Modules … |
| `DocumentFavorite` | `document_favorites` | [L18668](../../api/prisma/schema.prisma#L18668) | 17 §7 — favorites per member (document or folder). |
| `DocumentRecentAccess` | `document_recent_accesses` | [L18688](../../api/prisma/schema.prisma#L18688) | 17 §7 — "recent" list per member; one row per member + document, bumped on each open. Download / preview audit for sensitive categories goes to audit_events … |
| **Sharing** | | | |
| `DocumentShare` | `document_shares` | [L18707](../../api/prisma/schema.prisma#L18707) | 17 §2, §9 — explicit grant of access to a Document or Folder for a Member, Team, Customer Portal user, external collaborator (email) or public link. Public l… |
| **Approvals** | | | |
| `DocumentApproval` | `document_approvals` | [L18774](../../api/prisma/schema.prisma#L18774) | 17 §10 — document-level approval request bound to an exact version (deliverables, specifications, HR documents). Shown as a pending approval in the Customer … |
| `DocumentApprover` | `document_approvers` | [L18811](../../api/prisma/schema.prisma#L18811) | 17 §10 — one approver (member or Customer Portal user) on an approval request and their decision. |
| **Retention & deletion** | | | |
| `DocumentDeletionRequest` | `document_deletion_requests` | [L18841](../../api/prisma/schema.prisma#L18841) | 17 §13 — restricted, audited deletion workflow: soft delete with recovery window, retention-driven deletion and permanent deletion that requires approval. Le… |
| `DocumentTemplate` | `document_templates` | [L18875](../../api/prisma/schema.prisma#L18875) | 17 §4, §5 — reusable document template (letters, policies, NDAs, reports ...). The body is a stored DocumentVersion; generating fills `variables` into a copy… |
| **Secure Credential Vault** | | | |
| `VaultKey` | `vault_keys` | [L18914](../../api/prisma/schema.prisma#L18914) | 17 §12 — per-organization encryption key metadata (the key material lives in the KMS / secret manager; only its reference is stored). Rotations create a new … |
| `VaultEntry` | `vault_entries` | [L18938](../../api/prisma/schema.prisma#L18938) | 17 §12 — an encrypted credential (hosting login, API key, service account, domain registrar, third-party credential) scoped to the organization, a customer o… |
| `VaultEntryGrant` | `vault_entry_grants` | [L18995](../../api/prisma/schema.prisma#L18995) | 17 §12 — explicit access grant on a vault entry for a member, team or Customer Portal user. Vault permissions (documents.vault.read / reveal / manage) are se… |
| `VaultAccessLog` | `vault_access_logs` | [L19026](../../api/prisma/schema.prisma#L19026) | 17 §12, §15 — queryable access log for vault entries (reveal / copy are explicit, logged actions). Mirrored to audit_events; this table backs the per-entry "… |

**Owned enums (26):** `DocumentStatus`, `DocumentScope`, `DocumentSource`, `DocumentVersionStatus`, `DocumentScanStatus`, `DocumentStorageProvider`, `DocumentStorageConnectionStatus`, `DocumentUploadJobStatus`, `DocumentPreviewKind`, `DocumentPreviewStatus`, `DocumentShareSubjectType`, `DocumentSharePermission`, `DocumentShareStatus`, `DocumentApprovalStatus`, `DocumentApprovalDecision`, `DocumentApproverKind`, `FolderTemplateTarget`, `DocumentRetentionAnchor`, `DocumentRetentionAction`, `DocumentDeletionKind`, `DocumentDeletionStatus`, `VaultEntryType`, `VaultScope`, `VaultGrantSubjectType`, `VaultAccessAction`, `VaultKeyStatus`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Document.branch`, `Folder.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Document.owner`, `DocumentApproval.requested_by`, `DocumentApprover.membership`, `DocumentFavorite.membership` +8 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `Document.organization`, `DocumentApproval.organization`, `DocumentAttachment.organization`, `DocumentCategory.organization` +12 more |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `Document.team`, `DocumentShare.team`, `Folder.team`, `VaultEntryGrant.team` |
| [01](./01-users-organizations-permissions.md) | `User` (`users`) | `DocumentApprover.portal_user`, `DocumentShare.portal_user`, `VaultAccessLog.actor_user`, `VaultEntryGrant.portal_user` |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `Document.company`, `Folder.company`, `VaultEntry.company` |
| [05](./05-project-management.md) | `Project` (`projects`) | `Document.project`, `Folder.project`, `VaultEntry.project` |
| [05](./05-project-management.md) | `ProjectType` (`project_types`) | `FolderTemplate.project_type` |

**Reused enums:** `DocumentType` ([01](./01-users-organizations-permissions.md)), `ModuleKey` ([01](./01-users-organizations-permissions.md)), `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `IntegrationConnection`, `Organization`
- [02](./02-crm-sales-management.md): `CrmActivity`, `CrmImportJob`
- [03](./03-proposal-quotation-generator.md): `ProposalVersion`
- [04](./04-contracts.md): `ContractTermination`, `ContractVersion`, `SignatureRequest`
- [05](./05-project-management.md): `ProjectDecision`
- [06](./06-task-management.md): `Release`, `TaskAttachment`
- [08](./08-financial-management-stripe-integration.md): `CreditNote`, `Invoice`, `Payment`
- [19](./19-calendar.md): `CalendarEventAttachment`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `CrmActivity.recording_document_id` ([02](./02-crm-sales-management.md), [L3238](../../api/prisma/schema.prisma#L3238)) — 02 §13 — CALL: recording stored in Documents (17), sensitive; id only.
- `CrmImportJob.document_id` ([02](./02-crm-sales-management.md), [L3467](../../api/prisma/schema.prisma#L3467)) — Uploaded file (17 Documents); id only.
- `ProposalVersion.pdf_document_id` ([03](./03-proposal-quotation-generator.md), [L3990](../../api/prisma/schema.prisma#L3990)) — Generated PDF stored in 17 Documents; id only.
- `ContractVersion.document_id` ([04](./04-contracts.md), [L4946](../../api/prisma/schema.prisma#L4946)) — Rendered document in 17 Documents (draft artifact); id only.
- `ContractVersion.signed_document_id` ([04](./04-contracts.md), [L4946](../../api/prisma/schema.prisma#L4946)) — Final signed artifact in 17 Documents (04 §41); id only.
- `SignatureRequest.package_documents` ([04](./04-contracts.md), [L5172](../../api/prisma/schema.prisma#L5172)) — 04 §78 — package of document ids (17) in locked order: [{ document_id, title, sort_order }].
- `SignatureRequest.signed_document_id` ([04](./04-contracts.md), [L5172](../../api/prisma/schema.prisma#L5172)) — Signed artifact (17) and the audit certificate (17) generated by the platform; ids only.
- `ContractTermination.document_id` ([04](./04-contracts.md), [L5376](../../api/prisma/schema.prisma#L5376)) — Supporting document (17); id only.
- `ProjectDeliverable.document_ids` ([05](./05-project-management.md), [L6051](../../api/prisma/schema.prisma#L6051)) — Document ids (17) delivered.
- `ProjectHandover.details` ([05](./05-project-management.md), [L6452](../../api/prisma/schema.prisma#L6452)) — Checklist, documentation ids (17), open items, support references, contacts, notes.
- `ProjectDeliverableReview.document_version_ids` ([05](./05-project-management.md), [L6536](../../api/prisma/schema.prisma#L6536)) — Document version ids (17) that were reviewed, for traceability of which submission was decided.
- `PaymentMethod.bank_details` ([08](./08-financial-management-stripe-integration.md), [L7411](../../api/prisma/schema.prisma#L7411)) — Bank details for transfers (IBAN masked, bank name) when provider is BANK. Encrypted at the application layer (envelope encryption with the organization Vaul…
- `Invoice.pdf_document_id` ([08](./08-financial-management-stripe-integration.md), [L7588](../../api/prisma/schema.prisma#L7588)) — Generated PDF (17); id only.
- `Payment.receipt_document_id` ([08](./08-financial-management-stripe-integration.md), [L7755](../../api/prisma/schema.prisma#L7755)) — Receipt document (17); id only.
- `FinanceReportSchedule.last_document_id` ([08](./08-financial-management-stripe-integration.md), [L8372](../../api/prisma/schema.prisma#L8372)) — Last generated file (17); id only.
- `LedgerSupplierProfile.bank_details` ([09](./09-income-expense-management.md), [L8719](../../api/prisma/schema.prisma#L8719)) — Supplier's bank details for paying their invoices (IBAN masked in the UI). Encrypted at the application layer (envelope encryption with the organization Vaul…
- `LedgerSettlement.document_id` ([09](./09-income-expense-management.md), [L8889](../../api/prisma/schema.prisma#L8889)) — 17 Document — payment confirmation; id only.
- `LedgerAttachment.document_id` ([09](./09-income-expense-management.md), [L8925](../../api/prisma/schema.prisma#L8925)) — 17 Document; id only.
- `LedgerInvoiceImport.document_id` ([09](./09-income-expense-management.md), [L8949](../../api/prisma/schema.prisma#L8949)) — 17 Document — the uploaded file; id only.
- `PayrollEntry.document_id` ([09](./09-income-expense-management.md), [L9166](../../api/prisma/schema.prisma#L9166)) — 17 Document — payslip / payment confirmation; id only.
- `VatReturn.document_id` ([09](./09-income-expense-management.md), [L9507](../../api/prisma/schema.prisma#L9507)) — 17 Document — filed return / proof of submission; id only.
- `ExpenseClaimLine.document_id` ([09](./09-income-expense-management.md), [L9574](../../api/prisma/schema.prisma#L9574)) — 17 Document — receipt; id only.
- `Employee.bank_details` ([10](./10-employee-management-system.md), [L10055](../../api/prisma/schema.prisma#L10055)) — Sensitive; consumed by 09 payroll. Encrypted at the application layer (envelope encryption with the organization VaultKey, 17 §12); never returned in list en…
- `Employee.photo_document_id` ([10](./10-employee-management-system.md), [L10055](../../api/prisma/schema.prisma#L10055)) — 17 Document — profile photo override; falls back to User.profile_photo_url.
- `Employee.resume_document_id` ([10](./10-employee-management-system.md), [L10055](../../api/prisma/schema.prisma#L10055)) — 17 Document — resume / CV.
- `EmployeeCertification.document_id` ([10](./10-employee-management-system.md), [L10359](../../api/prisma/schema.prisma#L10359)) — 17 Document — certificate file.
- `EmployeeTraining.document_id` ([10](./10-employee-management-system.md), [L10384](../../api/prisma/schema.prisma#L10384)) — 17 Document — completion certificate / material.
- `LeaveRequest.attachment_document_id` ([10](./10-employee-management-system.md), [L10653](../../api/prisma/schema.prisma#L10653)) — 17 Document — e.g. medical certificate.
- `PerformanceReview.document_id` ([10](./10-employee-management-system.md), [L10941](../../api/prisma/schema.prisma#L10941)) — 17 Document — exported / signed review.
- `PerformanceImprovementPlan.document_id` ([10](./10-employee-management-system.md), [L11098](../../api/prisma/schema.prisma#L11098)) — 17 Document — signed plan.
- `EmployeeDocument.document_id` ([10](./10-employee-management-system.md), [L11158](../../api/prisma/schema.prisma#L11158)) — 17 Document — the stored file; null while REQUESTED.
- `EmployeeHrNote.attachment_document_ids` ([10](./10-employee-management-system.md), [L11203](../../api/prisma/schema.prisma#L11203)) — 17 Document ids attached (signed warning letter, meeting minutes).
- `EmployeeEquipment.document_id` ([10](./10-employee-management-system.md), [L11292](../../api/prisma/schema.prisma#L11292)) — 17 Document — signed handover form; id only.
- `EmployeeImportJob.document_id` ([10](./10-employee-management-system.md), [L11432](../../api/prisma/schema.prisma#L11432)) — 17 Document — the uploaded file; id only.
- `EmployeeImportJob.error_report_document_id` ([10](./10-employee-management-system.md), [L11432](../../api/prisma/schema.prisma#L11432)) — 17 Document — downloadable error report; id only.
- `CommTemplateVersion.attachment_document_ids` ([11](./11-communication-center.md), [L11927](../../api/prisma/schema.prisma#L11927)) — Document ids (17) of attachments bundled with the template; ids only.
- `CommMessageAttachment.document_id` ([11](./11-communication-center.md), [L12225](../../api/prisma/schema.prisma#L12225)) — 17 Document; id only.
- `Campaign.attachment_document_ids` ([11](./11-communication-center.md), [L12486](../../api/prisma/schema.prisma#L12486)) — Attachment Document ids (17); ids only.
- `MessagingRetentionPolicy.applies_to_attachments` ([12](./12-messaging-team-communication.md), [L13225](../../api/prisma/schema.prisma#L13225)) — 12 §54 — the policy also applies to attachments (17 Documents are notified), reactions and metadata.
- `MessageAttachment.document_id` ([12](./12-messaging-team-communication.md), [L13695](../../api/prisma/schema.prisma#L13695)) — 17 Document — the stored file.
- `MessageDraft.attachment_document_ids` ([12](./12-messaging-team-communication.md), [L13912](../../api/prisma/schema.prisma#L13912)) — 17 Document ids already uploaded for this draft.
- `MessagingExportJob.result_document_id` ([12](./12-messaging-team-communication.md), [L14089](../../api/prisma/schema.prisma#L14089)) — 17 Document holding the export archive; id only.
- `ChannelCall.recording_document_id` ([12](./12-messaging-team-communication.md), [L14168](../../api/prisma/schema.prisma#L14168)) — 17 Document holding the recording, if any; id only.
- `SupportMessageAttachment.document_id` ([13](./13-customer-support-communication-hub.md), [L14915](../../api/prisma/schema.prisma#L14915)) — 17 Document.
- `TicketAttachment.document_id` ([13](./13-customer-support-communication-hub.md), [L15335](../../api/prisma/schema.prisma#L15335)) — 17 Document.
- `KnowledgeArticle.attachment_document_ids` ([13](./13-customer-support-communication-hub.md), [L15489](../../api/prisma/schema.prisma#L15489)) — 17 Document ids for images/videos/attachments.
- `WikiPage.cover_document_id` ([15](./15-notion-business-docs.md), [L17003](../../api/prisma/schema.prisma#L17003)) — Cover image Document (17); id only.
- `WikiTransferJob.source_document_ids` ([15](./15-notion-business-docs.md), [L17759](../../api/prisma/schema.prisma#L17759)) — 17 Documents uploaded as import source; ids only.
- `WikiTransferJob.result_document_id` ([15](./15-notion-business-docs.md), [L17759](../../api/prisma/schema.prisma#L17759)) — 17 Document holding the export archive; id only.
- `TimeImportJob.file_document_id` ([18](./18-time-tracking.md), [L19570](../../api/prisma/schema.prisma#L19570)) — Uploaded file (17 Document); id only.
- `TimeExport.file_document_id` ([18](./18-time-tracking.md), [L19837](../../api/prisma/schema.prisma#L19837)) — 17 Document holding the file; id only.
- `CalendarEventAttachment.document_id` ([19](./19-calendar.md), [L20484](../../api/prisma/schema.prisma#L20484)) — 19 §3 — the attachment is a 17 Document.

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 20 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `documents.categories` | manage |
| `documents.deletions` | approve* |
| `documents.documents` | restore, read, create, update, delete*, archive, export*, share, approve |
| `documents.folders` | manage |
| `documents.legal_hold` | manage* |
| `documents.retention` | manage* |
| `documents.storage` | manage* |
| `documents.templates` | read, manage |
| `documents.vault` | read*, reveal*, manage* |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Purpose

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Documents & File Management is the single storage and document layer of the Agency Operating System. It owns the physical file, its metadata, versions, access rules and lifecycle. Business modules own the meaning of a document (a signed contract, a deliverable, an invoice) and reference the document record.

Core rule:

**Modules own the relationship to a document. This module owns the document.**

## 2. Core Concepts

<!-- schema-section:start -->
> **Schema:** `Document` ([documents](../../api/prisma/schema.prisma#L18324)): `external_url`, `mimetype` · `DocumentAttachment` ([document_attachments](../../api/prisma/schema.prisma#L18644)) · `DocumentShare` ([document_shares](../../api/prisma/schema.prisma#L18707)) · `DocumentVersion` ([document_versions](../../api/prisma/schema.prisma#L18482)) · `Folder` ([folders](../../api/prisma/schema.prisma#L18249)) — other modules: `SupportMessageAttachment` ([support_message_attachments](../../api/prisma/schema.prisma#L14915)) ([13](./13-customer-support-communication-hub.md)) · `TaskAttachment` ([task_attachments](../../api/prisma/schema.prisma#L6973)) ([06](./06-task-management.md)) · enum `DocumentType` ([L322](../../api/prisma/schema.prisma#L322)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

### File

A stored binary with metadata: name, type, size, checksum, uploader, upload date, storage location.

### Document

A logical record with one or more file versions, a title, a category, scope, tags, custom fields and access rules. A Document can exist without a file (for example a link to an external document) and a File always belongs to a Document.

### Version

An immutable file snapshot inside a Document, with author, timestamp, change note and status.

### Folder

A hierarchical container for Documents, scoped to an organization, branch, project, customer or employee.

### Attachment

A Document linked to a business record (task, ticket, message, financial record). Attachments are ordinary Documents with a relationship to the record.

### Share

An explicit grant of access to a Document or Folder for a Member, Team, Customer Portal user, external collaborator or public link.

## 3. Scope & Ownership

<!-- schema-section:start -->
> **Schema:** `Document` ([documents](../../api/prisma/schema.prisma#L18324)) · `Folder` ([folders](../../api/prisma/schema.prisma#L18249)) · enum `DocumentScope` ([L17862](../../api/prisma/schema.prisma#L17862)) — other modules: `EmployeeDocument` ([employee_documents](../../api/prisma/schema.prisma#L11158)) ([10](./10-employee-management-system.md))
<!-- schema-section:end -->

Every Document belongs to exactly one Organization (01 §9) and declares a scope (01 §39, §85):

* Organization-wide
* Branch
* Team
* Project
* Customer
* Employee (HR documents)
* Record-specific (attachment)

Scope drives default visibility. Explicit shares extend it. Sharing never crosses organization boundaries except through Customer Portal access (01 §116).

## 4. Document Record

<!-- schema-section:start -->
> **Schema:** `Document` ([documents](../../api/prisma/schema.prisma#L18324)): `template_id` · `DocumentCategory` ([document_categories](../../api/prisma/schema.prisma#L18122)) · `DocumentTemplate` ([document_templates](../../api/prisma/schema.prisma#L18875)) · enum `DocumentStatus` ([L17853](../../api/prisma/schema.prisma#L17853)) — other modules: enum `DocumentType` ([L322](../../api/prisma/schema.prisma#L322)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

* Document ID
* Title
* Category (contract, proposal, deliverable, design, specification, invoice, receipt, HR document, policy, other; configurable)
* Scope and owning record references
* Current version
* Status (draft, active, approved, archived, deleted)
* Owner
* Tags
* Custom fields (shared custom fields per 02 §25)
* Retention policy
* Created / updated

## 5. Upload & Intake

<!-- schema-section:start -->
> **Schema:** `Document` ([documents](../../api/prisma/schema.prisma#L18324)): `template_id`, `uploaded_via_portal` · `DocumentSettings` ([document_settings](../../api/prisma/schema.prisma#L18080)): `allowed_mime_types`, `max_file_size_bytes`, `portal_upload_enabled`, `virus_scan_required` · `DocumentTemplate` ([document_templates](../../api/prisma/schema.prisma#L18875)) · `DocumentUploadJob` ([document_upload_jobs](../../api/prisma/schema.prisma#L18552)): `source_url` · enum `DocumentScanStatus` ([L17894](../../api/prisma/schema.prisma#L17894)) · enum `DocumentSource` ([L17873](../../api/prisma/schema.prisma#L17873)) · enum `DocumentUploadJobStatus` ([L17920](../../api/prisma/schema.prisma#L17920)) · enum `DocumentVersionStatus` ([L17885](../../api/prisma/schema.prisma#L17885))
<!-- schema-section:end -->

* Drag-and-drop and multi-file upload
* Upload from URL
* Upload from the Customer Portal into permitted folders, projects, tickets and conversations (07)
* Email attachments captured by 13 Support
* AI/OCR intake for invoices and receipts is initiated by 09 and uses this module for storage
* Configurable file type and size limits per organization
* Storage quota: the organization's `documents.storage_bytes` entitlement (`OrganizationEntitlement`, 01 §56) set by its plan or by Logiqdev staff; usage is the sum of version sizes. A HARD limit blocks new uploads, a SOFT limit only notifies.
* Document templates (`DocumentTemplate`): a stored version with placeholders (letters, NDAs, checklists). Generating one creates a Document with source GENERATED and `template_id`. Proposal (03) and contract (04) templates stay in their modules.
* Virus and malware scanning before a file becomes available

## 6. Versioning

<!-- schema-section:start -->
> **Schema:** `DocumentShare` ([document_shares](../../api/prisma/schema.prisma#L18707)): `pinned_version_id` · `DocumentVersion` ([document_versions](../../api/prisma/schema.prisma#L18482)): `restored_from_version_id` · enum `DocumentVersionStatus` ([L17885](../../api/prisma/schema.prisma#L17885))
<!-- schema-section:end -->

* Every re-upload creates a new Version; versions are immutable.
* Modules can lock a Version (for example 04 locks the signed contract version).
* Version compare for text and PDF where supported.
* Restore a previous version by creating a new version from it.

## 7. Folders & Organization

<!-- schema-section:start -->
> **Schema:** `DocumentFavorite` ([document_favorites](../../api/prisma/schema.prisma#L18668)) · `DocumentRecentAccess` ([document_recent_accesses](../../api/prisma/schema.prisma#L18688)) · `DocumentSettings` ([document_settings](../../api/prisma/schema.prisma#L18080)): `folder_max_depth` · `Folder` ([folders](../../api/prisma/schema.prisma#L18249)): `template_id` · `FolderTemplate` ([folder_templates](../../api/prisma/schema.prisma#L18223)) · enum `FolderTemplateTarget` ([L17995](../../api/prisma/schema.prisma#L17995))
<!-- schema-section:end -->

* Folder hierarchy per scope with configurable depth
* Default folder templates per project type (05 §36) and per customer
* Move, rename, archive folders without breaking Document IDs
* Favorites and recent

## 8. Preview & Access

<!-- schema-section:start -->
> **Schema:** `Document` ([documents](../../api/prisma/schema.prisma#L18324)): `is_sensitive`, `url`, `watermark_enabled` · `DocumentCategory` ([document_categories](../../api/prisma/schema.prisma#L18122)): `customer_visible_default`, `is_sensitive` · `DocumentPreview` ([document_previews](../../api/prisma/schema.prisma#L18615)): `watermarked` · `DocumentSettings` ([document_settings](../../api/prisma/schema.prisma#L18080)): `signed_url_ttl_seconds`, `watermark_customer_documents` · `DocumentShare` ([document_shares](../../api/prisma/schema.prisma#L18707)): `watermark` · `DocumentVersion` ([document_versions](../../api/prisma/schema.prisma#L18482)): `storage_key` · enum `DocumentPreviewKind` ([L17931](../../api/prisma/schema.prisma#L17931)) · enum `DocumentPreviewStatus` ([L17941](../../api/prisma/schema.prisma#L17941))
<!-- schema-section:end -->

* Inline previews for images, PDFs, office documents, text, code, video and audio where supported
* Download with permission check on every request
* Signed, expiring URLs for all file access; no public storage URLs
* Watermarking option for customer-facing documents

## 9. Sharing

<!-- schema-section:start -->
> **Schema:** `DocumentSettings` ([document_settings](../../api/prisma/schema.prisma#L18080)): `default_share_expiry_days`, `public_links_enabled` · `DocumentShare` ([document_shares](../../api/prisma/schema.prisma#L18707)): `expires_at`, `link_token`, `max_download_count` · enum `DocumentSharePermission` ([L17958](../../api/prisma/schema.prisma#L17958)) · enum `DocumentShareStatus` ([L17966](../../api/prisma/schema.prisma#L17966)) · enum `DocumentShareSubjectType` ([L17949](../../api/prisma/schema.prisma#L17949))
<!-- schema-section:end -->

* Share with Members, Teams, Customer Portal users, external collaborators
* Permission levels: view, comment, edit, manage
* Expiring shares
* Public links only when enabled by organization policy, always expiring and auditable
* Share activity visible to the owner
* Link and external shares can be capped by opens (`max_access_count`) and separately by downloads (`max_download_count`); whichever limit is reached first stops the link.

## 10. Document Approval

<!-- schema-section:start -->
> **Schema:** `DocumentApproval` ([document_approvals](../../api/prisma/schema.prisma#L18774)) · `DocumentApprover` ([document_approvers](../../api/prisma/schema.prisma#L18811)) · enum `DocumentApprovalDecision` ([L17982](../../api/prisma/schema.prisma#L17982)) · enum `DocumentApprovalStatus` ([L17973](../../api/prisma/schema.prisma#L17973)) · enum `DocumentApproverKind` ([L17989](../../api/prisma/schema.prisma#L17989))
<!-- schema-section:end -->

Simple approval workflow for documents that need sign-off (deliverables, specifications, HR documents):

* Request approval from one or more approvers
* Approve, reject, request changes
* Approval bound to an exact Version

Contract approval and signature remain in 04. Deliverable acceptance criteria remain in 05 §47. This module only records document-level approval state.

## 11. Search

<!-- schema-section:start -->
> **Schema:** `Document` ([documents](../../api/prisma/schema.prisma#L18324)): `search_vector` · `DocumentSettings` ([document_settings](../../api/prisma/schema.prisma#L18080)): `full_text_extraction_enabled` · `DocumentVersion` ([document_versions](../../api/prisma/schema.prisma#L18482)): `extracted_text`
<!-- schema-section:end -->

Search by title, content (full-text where extractable), category, scope, owner, tags, custom fields, date and related record. Results respect permissions. Document search feeds the platform global search (see `docs/Product_Specification.md` §4).

## 12. Secure Credential Vault

<!-- schema-section:start -->
> **Schema:** `DocumentSettings` ([document_settings](../../api/prisma/schema.prisma#L18080)): `vault_portal_sharing_enabled`, `vault_reveal_reauth_minutes` · `VaultAccessLog` ([vault_access_logs](../../api/prisma/schema.prisma#L19026)) · `VaultEntry` ([vault_entries](../../api/prisma/schema.prisma#L18938)): `portal_visible` · `VaultEntryGrant` ([vault_entry_grants](../../api/prisma/schema.prisma#L18995)): `portal_user_id` · `VaultKey` ([vault_keys](../../api/prisma/schema.prisma#L18914)) · enum `VaultAccessAction` ([L18057](../../api/prisma/schema.prisma#L18057)) · enum `VaultEntryType` ([L18034](../../api/prisma/schema.prisma#L18034)) · enum `VaultGrantSubjectType` ([L18050](../../api/prisma/schema.prisma#L18050)) · enum `VaultKeyStatus` ([L18070](../../api/prisma/schema.prisma#L18070)) · enum `VaultScope` ([L18043](../../api/prisma/schema.prisma#L18043)) — other modules: `Employee` ([employees](../../api/prisma/schema.prisma#L10055)): `bank_details` ([10](./10-employee-management-system.md)) · `IntegrationConnection` ([integration_connections](../../api/prisma/schema.prisma#L1868)) ([01](./01-users-organizations-permissions.md)) · `LedgerSupplierProfile` ([ledger_supplier_profiles](../../api/prisma/schema.prisma#L8719)): `bank_details` ([09](./09-income-expense-management.md)) · `MessageAttachment` ([message_attachments](../../api/prisma/schema.prisma#L13695)) ([12](./12-messaging-team-communication.md)) · `PaymentMethod` ([payment_methods](../../api/prisma/schema.prisma#L7411)): `bank_details` ([08](./08-financial-management-stripe-integration.md)) · `PaymentProviderConnection` ([payment_provider_connections](../../api/prisma/schema.prisma#L8021)) ([08](./08-financial-management-stripe-integration.md))
<!-- schema-section:end -->

The vault stores secrets that belong to customers and projects (hosting logins, API keys, service accounts, domain registrars, third-party credentials).

* Vault entries are encrypted at rest with per-organization keys; secrets are never stored in plain text or in ordinary Documents.
* Scope: organization, customer, project.
* Fields: name, type (password, API key, SSH key, note, file), username, secret, URL, notes, tags, expiry, owner.
* Reveal and copy are explicit actions, logged in the audit trail.
* Permissions are separate from document permissions: `documents.vault.read`, `documents.vault.reveal`, `documents.vault.manage`.
* Customer Portal users can be granted access to specific entries of their own customer scope when the organization enables it.
* Sharing a vault entry into Messaging or Support is blocked; only a reference link is shared.

This replaces the per-project "key value storage with encrypted credentials" previously described in 06 and the "password manager for clients" note in 16.

The vault is **not** where the organization's own provider keys (OpenAI, Resend, Twilio, Stripe, Viva Wallet) live. Those are Integration Connections managed in Admin → Integrations (01 §156–§161). They share the same per-organization encryption key (`VaultKey`) but have no reveal action, no sharing and no portal access.

## 13. Retention & Deletion

<!-- schema-section:start -->
> **Schema:** `DocumentCategory` ([document_categories](../../api/prisma/schema.prisma#L18122)): `default_retention_policy_id` · `DocumentDeletionRequest` ([document_deletion_requests](../../api/prisma/schema.prisma#L18841)) · `DocumentRetentionPolicy` ([document_retention_policies](../../api/prisma/schema.prisma#L18188)) · `DocumentSettings` ([document_settings](../../api/prisma/schema.prisma#L18080)): `soft_delete_recovery_days` · `Folder` ([folders](../../api/prisma/schema.prisma#L18249)): `legal_hold` · enum `DocumentDeletionKind` ([L18018](../../api/prisma/schema.prisma#L18018)) · enum `DocumentDeletionStatus` ([L18025](../../api/prisma/schema.prisma#L18025)) · enum `DocumentRetentionAction` ([L18011](../../api/prisma/schema.prisma#L18011)) · enum `DocumentRetentionAnchor` ([L18003](../../api/prisma/schema.prisma#L18003))
<!-- schema-section:end -->

* Retention policies per category and scope, configured by organization (04 §84 contract retention is enforced here)
* Soft delete with recovery window
* Legal hold prevents deletion
* Legal hold can be placed on a document or on a folder (`Folder.legal_hold`); a folder hold covers its subfolders and documents added later. Holds are set with `documents.legal_hold.manage`, separate from retention policy administration.
* Permanent deletion is audited and restricted

## 14. Permissions

<!-- schema-section:start -->
> **Schema:** other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1614)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

* `documents.documents.read / create / update / delete / share / approve`
* `documents.folders.manage`
* `documents.retention.manage`
* `documents.vault.read / reveal / manage`
* `documents.documents.restore` (restore from trash), `documents.legal_hold.manage`, `documents.templates.read / manage`, `documents.storage.manage`

Permission keys follow 01 §46. Field-level and resource-level rules follow 01 §49 and §60.

## 15. Audit

<!-- schema-section:start -->
> **Schema:** `Document` ([documents](../../api/prisma/schema.prisma#L18324)): `is_sensitive` · `DocumentCategory` ([document_categories](../../api/prisma/schema.prisma#L18122)): `is_sensitive` · `DocumentRecentAccess` ([document_recent_accesses](../../api/prisma/schema.prisma#L18688)) · `VaultAccessLog` ([vault_access_logs](../../api/prisma/schema.prisma#L19026)) · enum `VaultAccessAction` ([L18057](../../api/prisma/schema.prisma#L18057)) — other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L2271)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Audit upload, new version, download of sensitive categories, share created or revoked, approval decisions, vault reveal, retention changes and deletion.

## 16. Integrations

<!-- schema-section:start -->
> **Schema:** `DocumentStorageConnection` ([document_storage_connections](../../api/prisma/schema.prisma#L18156)) · enum `DocumentSource` ([L17873](../../api/prisma/schema.prisma#L17873)) · enum `DocumentStorageConnectionStatus` ([L17912](../../api/prisma/schema.prisma#L17912)) · enum `DocumentStorageProvider` ([L17904](../../api/prisma/schema.prisma#L17904))
<!-- schema-section:end -->

* External storage providers (Google Drive, Microsoft 365, S3-compatible) behind a storage provider abstraction; the Document record stays in this module. A `DocumentStorageConnection` holds its own encrypted credentials reference (`credentials_ref`, §12) until storage providers join the Integrations page (01 §156). The platform's own bucket (`PLATFORM`) stays in the platform environment.
* 03 and 04 write generated PDFs here.
* 09 reads uploaded invoices from here for OCR.
* 12 and 13 attach Documents to messages and tickets.

## 17. API & Webhooks

<!-- schema-section:start -->
> **Schema:** other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L21930)) ([20](./20-automation-engine.md))
<!-- schema-section:end -->

API: create document, upload version, get document, list by scope, move, share, approve, search, vault CRUD.

Webhooks: `document.created`, `document.version_created`, `document.shared`, `document.approved`, `document.archived`, `document.deleted`, `vault.entry_revealed`.

## 18. Recommended MVP

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Documents, files, versions, folders
* Scopes and permission-checked access
* Upload, preview, download
* Attachments for tasks, tickets, messages, financial records
* Customer Portal document access
* Sharing with Members and Customer Portal users
* Credential vault (basic)
* Audit trail

## 19. Phase 2

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Document approval workflow
* External storage providers
* Full-text search
* Retention policies and legal hold
* Public links and watermarking
* Vault sharing to Customer Portal
