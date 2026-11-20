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

### Owned tables (31)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Spaces** | | | |
| `WikiSpace` | `wiki_spaces` | [L16917](../../api/prisma/schema.prisma#L16917) | 15 §2, §4 — a space groups pages per department, team, branch, project or topic. Exactly one of team_id / branch_id / department_id / project_id is normally … |
| `WikiSpaceMember` | `wiki_space_members` | [L16972](../../api/prisma/schema.prisma#L16972) | 15 §2, §8 — explicit space access: members, teams (user groups), branches, roles or departments with an access level (space managers hold `docs.spaces.manage`). |
| **Templates** | | | |
| `WikiPageTemplate` | `wiki_page_templates` | [L16993](../../api/prisma/schema.prisma#L16993) | 15 §2, §3 — page templates (policy, procedure, runbook, meeting notes, decision record, handbook chapter, onboarding/offboarding guide). organization_id null… |
| **Pages** | | | |
| `WikiPage` | `wiki_pages` | [L17028](../../api/prisma/schema.prisma#L17028) | 15 §2, §4 — a nested page. `content` is a block tree (Notion-style: paragraph, heading, list, checklist, table, code, image/embed → Document (17), record lin… |
| `WikiPageReviewer` | `wiki_page_reviewers` | [L17134](../../api/prisma/schema.prisma#L17134) | 15 §2 — members responsible for reviewing a page on its cadence. |
| `WikiPageVersion` | `wiki_page_versions` | [L17148](../../api/prisma/schema.prisma#L17148) | 15 §2 — immutable snapshot per save (quick autosaves by the same author are coalesced); `WikiPage.current_version_number` points at the latest. |
| `WikiPagePermission` | `wiki_page_permissions` | [L17173](../../api/prisma/schema.prisma#L17173) | 15 §2, §8 — explicit grant on a page to a member, team, branch, role or department (10). Enumerates the principals for BRANCH / TEAM / ROLE / MEMBERS visibil… |
| `WikiPageLink` | `wiki_page_links` | [L17193](../../api/prisma/schema.prisma#L17193) | 15 §2, §4, §6 — link from a page to a platform record (project, customer, task, document, ticket …). Also fed to the AI index as context (15 §6). |
| `WikiPageAttachment` | `wiki_page_attachments` | [L17212](../../api/prisma/schema.prisma#L17212) | 15 §2 — files/images embedded in a page are Documents (17); id only. |
| `WikiPageComment` | `wiki_page_comments` | [L17229](../../api/prisma/schema.prisma#L17229) | 15 §2 — threaded page comments with mentions (14 notifies), optionally anchored to a block, resolvable. |
| `WikiPageFavorite` | `wiki_page_favorites` | [L17259](../../api/prisma/schema.prisma#L17259) | 15 §2 — a member's favorite (starred) pages for the sidebar. |
| `WikiPageAcknowledgement` | `wiki_page_acknowledgements` | [L17275](../../api/prisma/schema.prisma#L17275) | 15 §3 — required-reading acknowledgement tracking: one row per member per page; re-acknowledgement is required when `acknowledged_version_number` falls behin… |
| **Onboarding & offboarding checklists** | | | |
| `WikiChecklist` | `wiki_checklists` | [L17300](../../api/prisma/schema.prisma#L17300) | 15 §3 — onboarding/offboarding checklist definition per department and/or role (01 §130–131). Items generate Tasks (06) when a run starts. |
| `WikiChecklistItem` | `wiki_checklist_items` | [L17338](../../api/prisma/schema.prisma#L17338) | 15 §3 — a step in a checklist: a task to do, a page to read (with acknowledgement) or a form to fill (15 §5). |
| `WikiChecklistRun` | `wiki_checklist_runs` | [L17369](../../api/prisma/schema.prisma#L17369) | 15 §3 — a checklist executed for one member; progress is tracked per employee (10). |
| `WikiChecklistRunItem` | `wiki_checklist_run_items` | [L17402](../../api/prisma/schema.prisma#L17402) | 15 §3 — item state inside a run; `task_id` is the generated Task (06). |
| **Custom forms** | | | |
| `CustomForm` | `custom_forms` | [L17431](../../api/prisma/schema.prisma#L17431) | 15 §5 — form builder definition. `fields_schema` is the editable draft; each publish freezes a CustomFormVersion that submissions reference. Shape: [{ key, t… |
| `CustomFormVersion` | `custom_form_versions` | [L17478](../../api/prisma/schema.prisma#L17478) | 15 §5 — frozen copy of fields_schema at publish time so old submissions stay interpretable. |
| `FormAssignment` | `form_assignments` | [L17496](../../api/prisma/schema.prisma#L17496) | 15 §5 — an assignment of a form to a member, team, department (10), branch or the whole organization, with due date and reminders (14, 20). Recipients are ex… |
| `FormAssignmentRecipient` | `form_assignment_recipients` | [L17528](../../api/prisma/schema.prisma#L17528) | 15 §5 — per-member state of an assignment. For anonymous forms `submission_id` stays null and only `status` moves to SUBMITTED, so completion is trackable wi… |
| `FormSubmission` | `form_submissions` | [L17551](../../api/prisma/schema.prisma#L17551) | 15 §5 — a response. `answers` = { [field_key]: value } (files hold FormSubmissionFile ids). When the form is anonymous, respondent_membership_id, submitted_b… |
| `FormSubmissionFile` | `form_submission_files` | [L17591](../../api/prisma/schema.prisma#L17591) | 15 §5 — uploaded files and signature images for FILE_UPLOAD / SIGNATURE fields; stored as Documents (17). |
| **AI knowledge index** | | | |
| `WikiAiIndexEntry` | `wiki_ai_index_entries` | [L17611](../../api/prisma/schema.prisma#L17611) | 15 §6, §7 — one retrievable chunk of a page, form or submission for the shared AI layer and semantic search. `embedding` is a float vector (switch to pgvecto… |
| `WikiAiSuggestion` | `wiki_ai_suggestions` | [L17657](../../api/prisma/schema.prisma#L17657) | 15 §6 — AI-proposed page drafts/updates (from conversations, meetings, resolved tickets) and stale or contradiction flags, held for human review before they … |
| `WikiPageView` | `wiki_page_views` | [L17700](../../api/prisma/schema.prisma#L17700) | 15 §2 — one row per page open (Recent pages, reader analytics). Retained 180 days, rolled up daily in WikiPageViewDaily. |
| `WikiPageViewDaily` | `wiki_page_view_daily` | [L17720](../../api/prisma/schema.prisma#L17720) | 15 §2 — daily rollup of WikiPageView kept after the raw rows expire (reader analytics, popular pages). |
| `WikiSearchQuery` | `wiki_search_queries` | [L17736](../../api/prisma/schema.prisma#L17736) | 15 §7 — search log: top searches, zero-result tracking, click-through. |
| `WikiPageFeedback` | `wiki_page_feedback` | [L17757](../../api/prisma/schema.prisma#L17757) | 15 §2 — "was this page helpful" feedback, one per member per page (updated in place). |
| `WikiTransferJob` | `wiki_transfer_jobs` | [L17778](../../api/prisma/schema.prisma#L17778) | 15 §2, §10 — import / export job (Markdown, HTML, DOCX, PDF, Notion, Confluence, Google Docs). |
| `WikiPageAckTarget` | `wiki_page_ack_targets` | [L17809](../../api/prisma/schema.prisma#L17809) | 15 §3 — who must acknowledge a page (member, team, branch, role or department). Expanded into WikiPageAcknowledgement rows when acknowledgement is requested … |
| `WikiPageWatcher` | `wiki_page_watchers` | [L17826](../../api/prisma/schema.prisma#L17826) | 15 §2 — member follows a page and is notified (14) on edits and comments. Author, owner, reviewers and mentioned members follow implicitly. |

**Owned enums (26):** `WikiSpaceKind`, `WikiPageType`, `WikiVisibility`, `WikiPermissionLevel`, `WikiPrincipalType`, `WikiChecklistKind`, `WikiChecklistAssigneeKind`, `WikiChecklistRunStatus`, `WikiChecklistTrigger`, `WikiChecklistItemStatus`, `CustomFormStatus`, `CustomFormKind`, `CustomFormFieldType`, `FormAssignmentTargetType`, `FormAssignmentRecipientStatus`, `FormSubmissionStatus`, `WikiAiSourceType`, `WikiAiIndexStatus`, `WikiAiSuggestionKind`, `WikiAiSuggestionStatus`, `WikiPageViewSource`, `WikiSearchMode`, `WikiTransferKind`, `WikiTransferFormat`, `WikiTransferScope`, `WikiTransferStatus`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `WikiSpace.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `CustomForm.owner`, `FormAssignmentRecipient.membership`, `FormSubmission.respondent`, `WikiChecklistRun.subject` +10 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `CustomForm.organization`, `FormAssignment.organization`, `FormSubmission.organization`, `WikiAiIndexEntry.organization` +11 more |
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

- `Project.runbook_page_id` ([05](./05-project-management.md), [L5778](../../api/prisma/schema.prisma#L5778)) — Business Docs runbook page (15 §4); id only.

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 21 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `docs.ai` | query |
| `docs.analytics` | read |
| `docs.checklists` | manage |
| `docs.forms` | read, create, update, delete*, archive, export*, assign, review |
| `docs.forms.anonymous_responses` | read* |
| `docs.pages` | read, share_customers*, create, update, archive, delete*, import, export* |
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
> **Schema:** `CustomForm` ([custom_forms](../../api/prisma/schema.prisma#L17431)): `space_id` · `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L17028)): `deleted_at`, `stale_flagged_at` · `WikiPageAttachment` ([wiki_page_attachments](../../api/prisma/schema.prisma#L17212)) · `WikiPageComment` ([wiki_page_comments](../../api/prisma/schema.prisma#L17229)) · `WikiPageFavorite` ([wiki_page_favorites](../../api/prisma/schema.prisma#L17259)) · `WikiPageFeedback` ([wiki_page_feedback](../../api/prisma/schema.prisma#L17757)) · `WikiPageLink` ([wiki_page_links](../../api/prisma/schema.prisma#L17193)) · `WikiPagePermission` ([wiki_page_permissions](../../api/prisma/schema.prisma#L17173)) · `WikiPageReviewer` ([wiki_page_reviewers](../../api/prisma/schema.prisma#L17134)) · `WikiPageTemplate` ([wiki_page_templates](../../api/prisma/schema.prisma#L16993)): `default_review_interval_days` · `WikiPageVersion` ([wiki_page_versions](../../api/prisma/schema.prisma#L17148)) · `WikiPageView` ([wiki_page_views](../../api/prisma/schema.prisma#L17700)) · `WikiPageViewDaily` ([wiki_page_view_daily](../../api/prisma/schema.prisma#L17720)) · `WikiPageWatcher` ([wiki_page_watchers](../../api/prisma/schema.prisma#L17826)) · `WikiSpace` ([wiki_spaces](../../api/prisma/schema.prisma#L16917)): `deleted_at` · `WikiSpaceMember` ([wiki_space_members](../../api/prisma/schema.prisma#L16972)) · `WikiTransferJob` ([wiki_transfer_jobs](../../api/prisma/schema.prisma#L17778)) · enum `WikiPageType` ([L16692](../../api/prisma/schema.prisma#L16692)) · enum `WikiPageViewSource` ([L16868](../../api/prisma/schema.prisma#L16868)) · enum `WikiPermissionLevel` ([L16716](../../api/prisma/schema.prisma#L16716)) · enum `WikiPrincipalType` ([L16724](../../api/prisma/schema.prisma#L16724)) · enum `WikiSpaceKind` ([L16682](../../api/prisma/schema.prisma#L16682)) · enum `WikiTransferFormat` ([L16887](../../api/prisma/schema.prisma#L16887)) · enum `WikiTransferKind` ([L16881](../../api/prisma/schema.prisma#L16881)) · enum `WikiTransferScope` ([L16898](../../api/prisma/schema.prisma#L16898)) · enum `WikiTransferStatus` ([L16905](../../api/prisma/schema.prisma#L16905)) · enum `WikiVisibility` ([L16707](../../api/prisma/schema.prisma#L16707))
<!-- schema-section:end -->

* Spaces per department, team, branch or topic (Engineering, Sales, HR, Finance, Operations)
* Nested pages edited in place like Notion: one always-editable page (read-only for viewers), slash menu, ⋮⋮ block handle (drag, duplicate, turn into), callouts, toggles, tables, images, code, to-dos, `@` mentions, `[[page]]` links and links to platform records (projects, customers, tasks, documents)
* New pages are created instantly as "Untitled" (sidebar +, ⌘⇧N, `/page`) with the title focused; templates are offered inside the empty page
* Cover image (`cover_document_id`, `cover_position`) and icon; images are uploaded through `POST /docs/pages/:id/attachments` (page EDIT level, tracked as `WikiPageAttachment`) and stored in the Markdown as `![alt](attachment:<document_id>)`
* Sidebar page tree with drag-and-drop reordering and nesting (`POST /docs/pages/:id/move`, dense `sort_order`) and a ⋯ menu per page
* Page templates (policy, procedure, runbook, meeting notes, decision record, handbook chapter)
* Version history, comments and mentions
* Page owner, reviewers and review cadence (stale page detection)
* Every edit is live — there is no draft/publish step. Each save writes a version (quick autosaves by the same person are coalesced); Version history restores any version. Pages can be archived (read-only, hidden from the tree) or moved to Trash
* Visibility: organization, branch, team, role, explicit members; optional customer-visible flag for pages exposed through 07 or 13

**Views, feedback, trash, follow, transfer.** `WikiPageView` logs opens (kept 180 days, rolled up in `WikiPageViewDaily`) for Recent and reader analytics (`docs.analytics.read`); `WikiPageFeedback` stores helpful votes; `WikiPageWatcher` is Follow. Trash is soft delete (`deleted_at`, `deleted_by_membership_id` on pages and spaces, purged after 30 days) and is separate from archiving (`archived_at`). `WikiSpace.allow_customer_visible` sets whether pages of the space may be exposed to customers (`docs.pages.share_customers`). Import and export run as `WikiTransferJob` (`docs.pages.import`, `docs.pages.export*`).

## 3. Onboarding & Offboarding

<!-- schema-section:start -->
> **Schema:** `WikiChecklist` ([wiki_checklists](../../api/prisma/schema.prisma#L17300)) · `WikiChecklistItem` ([wiki_checklist_items](../../api/prisma/schema.prisma#L17338)) · `WikiChecklistRun` ([wiki_checklist_runs](../../api/prisma/schema.prisma#L17369)) · `WikiChecklistRunItem` ([wiki_checklist_run_items](../../api/prisma/schema.prisma#L17402)) · `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L17028)): `ack_due_at`, `ack_version_number`, `requires_acknowledgement` · `WikiPageAckTarget` ([wiki_page_ack_targets](../../api/prisma/schema.prisma#L17809)) · `WikiPageAcknowledgement` ([wiki_page_acknowledgements](../../api/prisma/schema.prisma#L17275)) · `WikiPageTemplate` ([wiki_page_templates](../../api/prisma/schema.prisma#L16993)) · enum `WikiChecklistAssigneeKind` ([L16739](../../api/prisma/schema.prisma#L16739)) · enum `WikiChecklistItemStatus` ([L16763](../../api/prisma/schema.prisma#L16763)) · enum `WikiChecklistKind` ([L16733](../../api/prisma/schema.prisma#L16733)) · enum `WikiChecklistRunStatus` ([L16747](../../api/prisma/schema.prisma#L16747)) · enum `WikiChecklistTrigger` ([L16755](../../api/prisma/schema.prisma#L16755)) · enum `WikiPageType` ([L16692](../../api/prisma/schema.prisma#L16692))
<!-- schema-section:end -->

Per department and per role:

* Onboarding guides and checklists generated as Tasks (06) and assigned on member onboarding (01 §130)
* Offboarding checklists aligned with 01 §131
* Progress tracking per employee (10)
* Required reading with acknowledgement tracking

**Required-reading audience.** `WikiPageAckTarget` lists who must acknowledge a page (member, team, branch, role or department, optional due date; `WikiPage.ack_due_at` is the default). Requesting acknowledgement expands targets into `WikiPageAcknowledgement` rows. Because every edit is live, the version to acknowledge is explicit: `WikiPage.ack_version_number` is set when "Readers must acknowledge" is turned on and moved to the current version by "Ask readers to confirm again" (`POST /docs/pages/:id/reacknowledge`, MCP `docs_pages_reacknowledge`); an acknowledgement is current when `acknowledged_version_number >= ack_version_number`.

## 4. Project Help Center

<!-- schema-section:start -->
> **Schema:** `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L17028)): `customer_visible` · `WikiPageLink` ([wiki_page_links](../../api/prisma/schema.prisma#L17193)) · `WikiSpace` ([wiki_spaces](../../api/prisma/schema.prisma#L16917)): `allow_customer_visible`, `project_id` · enum `WikiPageType` ([L16692](../../api/prisma/schema.prisma#L16692)) — other modules: `Project` ([projects](../../api/prisma/schema.prisma#L5778)): `runbook_page_id` ([05](./05-project-management.md))
<!-- schema-section:end -->

Project runbooks and FAQs linked from the project workspace (05 §34). Pages marked customer-visible answer portal questions and can be published to the customer help center (13 §6) without duplication: the page is the source and 13 publishes a view.

## 5. Custom Forms

<!-- schema-section:start -->
> **Schema:** `CustomForm` ([custom_forms](../../api/prisma/schema.prisma#L17431)): `is_anonymous` · `CustomFormVersion` ([custom_form_versions](../../api/prisma/schema.prisma#L17478)) · `FormAssignment` ([form_assignments](../../api/prisma/schema.prisma#L17496)) · `FormAssignmentRecipient` ([form_assignment_recipients](../../api/prisma/schema.prisma#L17528)) · `FormSubmission` ([form_submissions](../../api/prisma/schema.prisma#L17551)): `created_task_id` · `FormSubmissionFile` ([form_submission_files](../../api/prisma/schema.prisma#L17591)) · `WikiChecklistItem` ([wiki_checklist_items](../../api/prisma/schema.prisma#L17338)) · enum `CustomFormFieldType` ([L16791](../../api/prisma/schema.prisma#L16791)) · enum `CustomFormKind` ([L16779](../../api/prisma/schema.prisma#L16779)) · enum `CustomFormStatus` ([L16771](../../api/prisma/schema.prisma#L16771)) · enum `FormAssignmentRecipientStatus` ([L16816](../../api/prisma/schema.prisma#L16816)) · enum `FormAssignmentTargetType` ([L16807](../../api/prisma/schema.prisma#L16807)) · enum `FormSubmissionStatus` ([L16825](../../api/prisma/schema.prisma#L16825))
<!-- schema-section:end -->

* Form builder: text, choice, scale, date, file upload (17), signature
* Assign forms to employees, teams, departments or branches with due dates and reminders (14, 20)
* Anonymous responses where the form enables it; anonymity is enforced at storage, not only in the UI
* Response review, export and aggregation
* Typical forms: feedback surveys, check-ins, equipment requests, incident reports, compliance acknowledgements, exit interviews
* Form responses can create Tasks (06) or Tickets (13) through 20 rules

## 6. Internal AI Knowledge

<!-- schema-section:start -->
> **Schema:** `FormSubmission` ([form_submissions](../../api/prisma/schema.prisma#L17551)): `exclude_from_ai_index` · `WikiAiIndexEntry` ([wiki_ai_index_entries](../../api/prisma/schema.prisma#L17611)) · `WikiAiSuggestion` ([wiki_ai_suggestions](../../api/prisma/schema.prisma#L17657)) · `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L17028)): `ai_generated`, `stale_flagged_at` · `WikiPageLink` ([wiki_page_links](../../api/prisma/schema.prisma#L17193)) · `WikiPageVersion` ([wiki_page_versions](../../api/prisma/schema.prisma#L17148)): `ai_suggestion_id` · enum `WikiAiIndexStatus` ([L16844](../../api/prisma/schema.prisma#L16844)) · enum `WikiAiSourceType` ([L16834](../../api/prisma/schema.prisma#L16834)) · enum `WikiAiSuggestionKind` ([L16852](../../api/prisma/schema.prisma#L16852)) · enum `WikiAiSuggestionStatus` ([L16860](../../api/prisma/schema.prisma#L16860))
<!-- schema-section:end -->

* Pages, forms and linked records are indexed for retrieval by the shared AI layer
* The AI assistant answers "how do we…" questions with citations to pages, respecting the asking user's permissions
* AI drafts and updates pages from conversations, meetings and resolved tickets, subject to review
* Stale or contradicting pages are flagged

## 7. Search

<!-- schema-section:start -->
> **Schema:** `WikiAiIndexEntry` ([wiki_ai_index_entries](../../api/prisma/schema.prisma#L17611)) · `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L17028)): `search_vector` · `WikiSearchQuery` ([wiki_search_queries](../../api/prisma/schema.prisma#L17736)) · enum `WikiSearchMode` ([L16875](../../api/prisma/schema.prisma#L16875))
<!-- schema-section:end -->

Full-text and semantic search across pages and forms, permission-checked, integrated into the platform global search.

**Search log.** `WikiSearchQuery` records each query (mode, filters, result count, clicked page) for top and zero-result searches.

## 8. Permissions

<!-- schema-section:start -->
> **Schema:** `WikiPagePermission` ([wiki_page_permissions](../../api/prisma/schema.prisma#L17173)) · `WikiSpaceMember` ([wiki_space_members](../../api/prisma/schema.prisma#L16972)) · enum `WikiPermissionLevel` ([L16716](../../api/prisma/schema.prisma#L16716)) — other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1661)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Keys follow 01 §46: `docs.pages.read / create / update / archive / share_customers`, `docs.spaces.manage`, `docs.forms.create / assign / review`, `docs.forms.anonymous_responses.read` (restricted).

## 9. Audit

<!-- schema-section:start -->
> **Schema:** `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L17028)): `customer_visible` — other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L2318)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Audit edits (versions), visibility changes, re-acknowledgement requests, customer-visible flags, form assignments and access to anonymous response sets.

## 10. API & Webhooks

<!-- schema-section:start -->
> **Schema:** `WikiTransferJob` ([wiki_transfer_jobs](../../api/prisma/schema.prisma#L17778)) — other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L21929)) ([20](./20-automation-engine.md))
<!-- schema-section:end -->

API: CRUD pages and spaces, search, forms and responses. Webhooks: `docs.page_updated`, `docs.form_assigned`, `docs.form_submitted`.

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
