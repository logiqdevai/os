# Business Docs (Internal Knowledge)

> Linear: [LOG-341](https://linear.app/logiqdev/issue/LOG-341/business-docs-internal-knowledge) · Status: Backlog

> **Canonical for:** the agency's internal knowledge: wiki pages, department handbooks, onboarding and offboarding guides, policies, procedures, project runbooks, custom forms and the internal AI knowledge assistant.
>
> **Boundaries:** [13 Customer Support](./13-customer-support-communication-hub.md) §6 owns the **customer-facing** knowledge base and help center. [17 Documents](./17-documents-file-management.md) owns file storage; Business Docs pages are structured content, and files embedded in them are Documents. [05 Projects](./05-project-management.md) §33–34 owns project notes and project documentation records; a project may link a Business Docs page as its runbook.
>
> **Depends on:** [01](./01-users-organizations-permissions.md) (LOG-406) for Members, Teams, Departments, Branches, permissions and onboarding workflows (01 §129–131) · [17 Documents](./17-documents-file-management.md) (LOG-407) · [10 Employees](./10-employee-management-system.md) (LOG-107) for onboarding/offboarding assignment and employee forms · [06 Tasks](./06-task-management.md) (LOG-102) for form-generated and onboarding tasks · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for assigning forms and checklists.
>
> **Consumed by:** 13 Support (publish an internal article to the customer help center), 07 Customer Portal (project help pages marked customer-visible), AI assistants across modules (knowledge retrieval).

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (24)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Spaces** | | | |
| `WikiSpace` | `wiki_spaces` | [L14616](../../api/prisma/schema.prisma#L14616) | 15 §2, §4 — a space groups pages per department, team, branch, project or topic. Exactly one of team_id / branch_id / department_id / project_id is normally … |
| `WikiSpaceMember` | `wiki_space_members` | [L14664](../../api/prisma/schema.prisma#L14664) | 15 §2, §8 — explicit space members with their access level (space managers hold `docs.spaces.manage`). |
| **Templates** | | | |
| `WikiPageTemplate` | `wiki_page_templates` | [L14683](../../api/prisma/schema.prisma#L14683) | 15 §2, §3 — page templates (policy, procedure, runbook, meeting notes, decision record, handbook chapter, onboarding/offboarding guide). organization_id null… |
| **Pages** | | | |
| `WikiPage` | `wiki_pages` | [L14720](../../api/prisma/schema.prisma#L14720) | 15 §2, §4 — a nested page. `content` is a block tree (Notion-style: paragraph, heading, list, checklist, table, code, image/embed → Document (17), record lin… |
| `WikiPageReviewer` | `wiki_page_reviewers` | [L14815](../../api/prisma/schema.prisma#L14815) | 15 §2 — members responsible for reviewing a page on its cadence. |
| `WikiPageVersion` | `wiki_page_versions` | [L14829](../../api/prisma/schema.prisma#L14829) | 15 §2 — immutable snapshot per save/publish; `WikiPage.current_version_number` points at the latest. |
| `WikiPagePermission` | `wiki_page_permissions` | [L14857](../../api/prisma/schema.prisma#L14857) | 15 §2, §8 — explicit grant on a page to a member, team, branch, role or department (10). Enumerates the principals for BRANCH / TEAM / ROLE / MEMBERS visibil… |
| `WikiPageLink` | `wiki_page_links` | [L14877](../../api/prisma/schema.prisma#L14877) | 15 §2, §4, §6 — link from a page to a platform record (project, customer, task, document, ticket …). Also fed to the AI index as context (15 §6). |
| `WikiPageAttachment` | `wiki_page_attachments` | [L14896](../../api/prisma/schema.prisma#L14896) | 15 §2 — files/images embedded in a page are Documents (17); id only. |
| `WikiPageComment` | `wiki_page_comments` | [L14913](../../api/prisma/schema.prisma#L14913) | 15 §2 — threaded page comments with mentions (14 notifies), optionally anchored to a block, resolvable. |
| `WikiPageFavorite` | `wiki_page_favorites` | [L14943](../../api/prisma/schema.prisma#L14943) | 15 §2 — a member's favorite (starred) pages for the sidebar. |
| `WikiPageAcknowledgement` | `wiki_page_acknowledgements` | [L14959](../../api/prisma/schema.prisma#L14959) | 15 §3 — required-reading acknowledgement tracking: one row per member per page; re-acknowledgement is required when `acknowledged_version_number` falls behin… |
| **Onboarding & offboarding checklists** | | | |
| `WikiChecklist` | `wiki_checklists` | [L14984](../../api/prisma/schema.prisma#L14984) | 15 §3 — onboarding/offboarding checklist definition per department and/or role (01 §130–131). Items generate Tasks (06) when a run starts. |
| `WikiChecklistItem` | `wiki_checklist_items` | [L15022](../../api/prisma/schema.prisma#L15022) | 15 §3 — a step in a checklist: a task to do, a page to read (with acknowledgement) or a form to fill (15 §5). |
| `WikiChecklistRun` | `wiki_checklist_runs` | [L15053](../../api/prisma/schema.prisma#L15053) | 15 §3 — a checklist executed for one member; progress is tracked per employee (10). |
| `WikiChecklistRunItem` | `wiki_checklist_run_items` | [L15086](../../api/prisma/schema.prisma#L15086) | 15 §3 — item state inside a run; `task_id` is the generated Task (06). |
| **Custom forms** | | | |
| `CustomForm` | `custom_forms` | [L15115](../../api/prisma/schema.prisma#L15115) | 15 §5 — form builder definition. `fields_schema` is the editable draft; each publish freezes a CustomFormVersion that submissions reference. Shape: [{ key, t… |
| `CustomFormVersion` | `custom_form_versions` | [L15162](../../api/prisma/schema.prisma#L15162) | 15 §5 — frozen copy of fields_schema at publish time so old submissions stay interpretable. |
| `FormAssignment` | `form_assignments` | [L15180](../../api/prisma/schema.prisma#L15180) | 15 §5 — an assignment of a form to a member, team, department (10), branch or the whole organization, with due date and reminders (14, 20). Recipients are ex… |
| `FormAssignmentRecipient` | `form_assignment_recipients` | [L15212](../../api/prisma/schema.prisma#L15212) | 15 §5 — per-member state of an assignment. For anonymous forms `submission_id` stays null and only `status` moves to SUBMITTED, so completion is trackable wi… |
| `FormSubmission` | `form_submissions` | [L15235](../../api/prisma/schema.prisma#L15235) | 15 §5 — a response. `answers` = { [field_key]: value } (files hold FormSubmissionFile ids). When the form is anonymous, respondent_membership_id, submitted_b… |
| `FormSubmissionFile` | `form_submission_files` | [L15275](../../api/prisma/schema.prisma#L15275) | 15 §5 — uploaded files and signature images for FILE_UPLOAD / SIGNATURE fields; stored as Documents (17). |
| **AI knowledge index** | | | |
| `WikiAiIndexEntry` | `wiki_ai_index_entries` | [L15295](../../api/prisma/schema.prisma#L15295) | 15 §6, §7 — one retrievable chunk of a page, form or submission for the shared AI layer and semantic search. `embedding` is a float vector (switch to pgvecto… |
| `WikiAiSuggestion` | `wiki_ai_suggestions` | [L15341](../../api/prisma/schema.prisma#L15341) | 15 §6 — AI-proposed page drafts/updates (from conversations, meetings, resolved tickets) and stale or contradiction flags, held for human review before they … |

**Owned enums (21):** `WikiSpaceKind`, `WikiPageStatus`, `WikiPageType`, `WikiVisibility`, `WikiPermissionLevel`, `WikiPrincipalType`, `WikiChecklistKind`, `WikiChecklistAssigneeKind`, `WikiChecklistRunStatus`, `WikiChecklistTrigger`, `WikiChecklistItemStatus`, `CustomFormStatus`, `CustomFormKind`, `CustomFormFieldType`, `FormAssignmentTargetType`, `FormAssignmentRecipientStatus`, `FormSubmissionStatus`, `WikiAiSourceType`, `WikiAiIndexStatus`, `WikiAiSuggestionKind`, `WikiAiSuggestionStatus`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `WikiSpace.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `CustomForm.owner`, `FormAssignmentRecipient.membership`, `FormSubmission.respondent`, `WikiChecklistRun.subject` +7 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `CustomForm.organization`, `FormAssignment.organization`, `FormSubmission.organization`, `WikiAiIndexEntry.organization` +6 more |
| [01](./01-users-organizations-permissions.md) | `Role` (`roles`) | `WikiChecklist.role` |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `WikiChecklist.department`, `WikiSpace.department`, `WikiSpace.team` |
| [05](./05-project-management.md) | `Project` (`projects`) | `WikiSpace.project` |
| [06](./06-task-management.md) | `Task` (`tasks`) | `FormSubmission.created_task`, `WikiChecklistRunItem.task` |
| [13](./13-customer-support-communication-hub.md) | `KnowledgeArticle` (`knowledge_articles`) | `WikiAiIndexEntry.knowledge_article` |

**Reused enums:** `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [05](./05-project-management.md): `Project`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `Project.runbook_page_id` ([05](./05-project-management.md), [L4822](../../api/prisma/schema.prisma#L4822)) — Business Docs runbook page (15 §4); id only.

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 18 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `docs.ai` | query |
| `docs.checklists` | manage |
| `docs.forms` | read, create, update, delete*, archive, export*, assign, review |
| `docs.forms.anonymous_responses` | read* |
| `docs.pages` | read, publish, create, update, archive, delete* |
| `docs.spaces` | manage |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Purpose

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Business Docs is the Notion-style internal knowledge system: how the business works, written once and used by people and by AI.

## 2. Pages & Spaces

<!-- schema-section:start -->
> **Schema:** `CustomForm` ([custom_forms](../../api/prisma/schema.prisma#L15115)): `space_id` · `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L14720)): `stale_flagged_at` · `WikiPageAttachment` ([wiki_page_attachments](../../api/prisma/schema.prisma#L14896)) · `WikiPageComment` ([wiki_page_comments](../../api/prisma/schema.prisma#L14913)) · `WikiPageFavorite` ([wiki_page_favorites](../../api/prisma/schema.prisma#L14943)) · `WikiPageLink` ([wiki_page_links](../../api/prisma/schema.prisma#L14877)) · `WikiPagePermission` ([wiki_page_permissions](../../api/prisma/schema.prisma#L14857)) · `WikiPageReviewer` ([wiki_page_reviewers](../../api/prisma/schema.prisma#L14815)) · `WikiPageTemplate` ([wiki_page_templates](../../api/prisma/schema.prisma#L14683)): `default_review_interval_days` · `WikiPageVersion` ([wiki_page_versions](../../api/prisma/schema.prisma#L14829)) · `WikiSpace` ([wiki_spaces](../../api/prisma/schema.prisma#L14616)) · `WikiSpaceMember` ([wiki_space_members](../../api/prisma/schema.prisma#L14664)) · enum `WikiPageStatus` ([L14427](../../api/prisma/schema.prisma#L14427)) · enum `WikiPageType` ([L14436](../../api/prisma/schema.prisma#L14436)) · enum `WikiPermissionLevel` ([L14460](../../api/prisma/schema.prisma#L14460)) · enum `WikiPrincipalType` ([L14468](../../api/prisma/schema.prisma#L14468)) · enum `WikiSpaceKind` ([L14418](../../api/prisma/schema.prisma#L14418)) · enum `WikiVisibility` ([L14451](../../api/prisma/schema.prisma#L14451))
<!-- schema-section:end -->

* Spaces per department, team, branch or topic (Engineering, Sales, HR, Finance, Operations)
* Nested pages with rich text, tables, embeds, images, code, checklists and links to platform records (projects, customers, tasks, documents)
* Page templates (policy, procedure, runbook, meeting notes, decision record, handbook chapter)
* Version history, comments and mentions
* Page owner, reviewers and review cadence (stale page detection)
* Status: draft, published, needs review, archived
* Visibility: organization, branch, team, role, explicit members; optional customer-visible flag for pages exposed through 07 or 13

## 3. Onboarding & Offboarding

<!-- schema-section:start -->
> **Schema:** `WikiChecklist` ([wiki_checklists](../../api/prisma/schema.prisma#L14984)) · `WikiChecklistItem` ([wiki_checklist_items](../../api/prisma/schema.prisma#L15022)) · `WikiChecklistRun` ([wiki_checklist_runs](../../api/prisma/schema.prisma#L15053)) · `WikiChecklistRunItem` ([wiki_checklist_run_items](../../api/prisma/schema.prisma#L15086)) · `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L14720)): `requires_acknowledgement` · `WikiPageAcknowledgement` ([wiki_page_acknowledgements](../../api/prisma/schema.prisma#L14959)) · `WikiPageTemplate` ([wiki_page_templates](../../api/prisma/schema.prisma#L14683)) · enum `WikiChecklistAssigneeKind` ([L14483](../../api/prisma/schema.prisma#L14483)) · enum `WikiChecklistItemStatus` ([L14507](../../api/prisma/schema.prisma#L14507)) · enum `WikiChecklistKind` ([L14477](../../api/prisma/schema.prisma#L14477)) · enum `WikiChecklistRunStatus` ([L14491](../../api/prisma/schema.prisma#L14491)) · enum `WikiChecklistTrigger` ([L14499](../../api/prisma/schema.prisma#L14499)) · enum `WikiPageType` ([L14436](../../api/prisma/schema.prisma#L14436))
<!-- schema-section:end -->

Per department and per role:

* Onboarding guides and checklists generated as Tasks (06) and assigned on member onboarding (01 §130)
* Offboarding checklists aligned with 01 §131
* Progress tracking per employee (10)
* Required reading with acknowledgement tracking

## 4. Project Help Center

<!-- schema-section:start -->
> **Schema:** `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L14720)): `customer_visible` · `WikiPageLink` ([wiki_page_links](../../api/prisma/schema.prisma#L14877)) · `WikiSpace` ([wiki_spaces](../../api/prisma/schema.prisma#L14616)): `project_id` · enum `WikiPageType` ([L14436](../../api/prisma/schema.prisma#L14436)) — other modules: `Project` ([projects](../../api/prisma/schema.prisma#L4822)): `runbook_page_id` ([05](./05-project-management.md))
<!-- schema-section:end -->

Project runbooks and FAQs linked from the project workspace (05 §34). Pages marked customer-visible answer portal questions and can be published to the customer help center (13 §6) without duplication: the page is the source and 13 publishes a view.

## 5. Custom Forms

<!-- schema-section:start -->
> **Schema:** `CustomForm` ([custom_forms](../../api/prisma/schema.prisma#L15115)): `is_anonymous` · `CustomFormVersion` ([custom_form_versions](../../api/prisma/schema.prisma#L15162)) · `FormAssignment` ([form_assignments](../../api/prisma/schema.prisma#L15180)) · `FormAssignmentRecipient` ([form_assignment_recipients](../../api/prisma/schema.prisma#L15212)) · `FormSubmission` ([form_submissions](../../api/prisma/schema.prisma#L15235)): `created_task_id` · `FormSubmissionFile` ([form_submission_files](../../api/prisma/schema.prisma#L15275)) · `WikiChecklistItem` ([wiki_checklist_items](../../api/prisma/schema.prisma#L15022)) · enum `CustomFormFieldType` ([L14535](../../api/prisma/schema.prisma#L14535)) · enum `CustomFormKind` ([L14523](../../api/prisma/schema.prisma#L14523)) · enum `CustomFormStatus` ([L14515](../../api/prisma/schema.prisma#L14515)) · enum `FormAssignmentRecipientStatus` ([L14560](../../api/prisma/schema.prisma#L14560)) · enum `FormAssignmentTargetType` ([L14551](../../api/prisma/schema.prisma#L14551)) · enum `FormSubmissionStatus` ([L14569](../../api/prisma/schema.prisma#L14569))
<!-- schema-section:end -->

* Form builder: text, choice, scale, date, file upload (17), signature
* Assign forms to employees, teams, departments or branches with due dates and reminders (14, 20)
* Anonymous responses where the form enables it; anonymity is enforced at storage, not only in the UI
* Response review, export and aggregation
* Typical forms: feedback surveys, check-ins, equipment requests, incident reports, compliance acknowledgements, exit interviews
* Form responses can create Tasks (06) or Tickets (13) through 20 rules

## 6. Internal AI Knowledge

<!-- schema-section:start -->
> **Schema:** `FormSubmission` ([form_submissions](../../api/prisma/schema.prisma#L15235)): `exclude_from_ai_index` · `WikiAiIndexEntry` ([wiki_ai_index_entries](../../api/prisma/schema.prisma#L15295)) · `WikiAiSuggestion` ([wiki_ai_suggestions](../../api/prisma/schema.prisma#L15341)) · `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L14720)): `ai_generated`, `stale_flagged_at` · `WikiPageLink` ([wiki_page_links](../../api/prisma/schema.prisma#L14877)) · `WikiPageVersion` ([wiki_page_versions](../../api/prisma/schema.prisma#L14829)): `ai_suggestion_id` · enum `WikiAiIndexStatus` ([L14588](../../api/prisma/schema.prisma#L14588)) · enum `WikiAiSourceType` ([L14578](../../api/prisma/schema.prisma#L14578)) · enum `WikiAiSuggestionKind` ([L14596](../../api/prisma/schema.prisma#L14596)) · enum `WikiAiSuggestionStatus` ([L14604](../../api/prisma/schema.prisma#L14604))
<!-- schema-section:end -->

* Pages, forms and linked records are indexed for retrieval by the shared AI layer
* The AI assistant answers "how do we…" questions with citations to pages, respecting the asking user's permissions
* AI drafts and updates pages from conversations, meetings and resolved tickets, subject to review
* Stale or contradicting pages are flagged

## 7. Search

<!-- schema-section:start -->
> **Schema:** `WikiAiIndexEntry` ([wiki_ai_index_entries](../../api/prisma/schema.prisma#L15295)) · `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L14720)): `search_vector`
<!-- schema-section:end -->

Full-text and semantic search across pages and forms, permission-checked, integrated into the platform global search.

## 8. Permissions

<!-- schema-section:start -->
> **Schema:** `WikiPagePermission` ([wiki_page_permissions](../../api/prisma/schema.prisma#L14857)) · `WikiSpaceMember` ([wiki_space_members](../../api/prisma/schema.prisma#L14664)) · enum `WikiPermissionLevel` ([L14460](../../api/prisma/schema.prisma#L14460)) — other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1338)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Keys follow 01 §46: `docs.pages.read / create / update / publish / archive`, `docs.spaces.manage`, `docs.forms.create / assign / review`, `docs.forms.anonymous_responses.read` (restricted).

## 9. Audit

<!-- schema-section:start -->
> **Schema:** `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L14720)): `customer_visible` — other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L1859)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Audit publish, visibility changes, customer-visible flags, form assignments and access to anonymous response sets.

## 10. API & Webhooks

<!-- schema-section:start -->
> **Schema:** other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L19216)) ([20](./20-automation-engine.md))
<!-- schema-section:end -->

API: CRUD pages and spaces, search, forms and responses. Webhooks: `docs.page_published`, `docs.page_updated`, `docs.form_assigned`, `docs.form_submitted`.

## 11. Recommended MVP

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Spaces, pages, templates, versions, comments
* Visibility and permissions
* Onboarding checklists to Tasks
* Search
* AI question answering over pages

## 12. Phase 2

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Custom forms and anonymous responses
* Review cadence and stale detection
* Publishing to the customer help center
* AI page drafting
