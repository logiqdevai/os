# Customer Support

> Linear: [LOG-342](https://linear.app/logiqdev/issue/LOG-342/customer-support) · Status: Backlog · Assignee: Anna Zoi

> **Canonical for:** customer support: the unified support inbox and support Conversations (live chat, inbound email, widget, portal requests), Tickets and SLAs, support automation rules, ticket-to-task conversion, the customer-facing knowledge base and help center, support analytics and the AI support agent. Every **customer request** from the portal is a Ticket here.
>
> **Boundaries:** [12 Messaging](./12-messaging-team-communication.md) owns internal chat and project customer channels. [11 Communication Center](./11-communication-center.md) owns outbound email/SMS and campaigns. [06 Task Management](./06-task-management.md) owns the Task a ticket converts into. [02 CRM](./02-crm-sales-management.md) owns the customer record and the Customer 360 timeline. [15 Business Docs](./15-notion-business-docs.md) owns internal knowledge; this module owns the customer-facing knowledge base.
>
> **Depends on:** [01](./01-users-organizations-permissions.md) (LOG-406) for Members, Teams, Customer Portal Users, permissions, isolation, branch-level support (01 §38) · [02 CRM](./02-crm-sales-management.md) (LOG-404) · [05 Projects](./05-project-management.md) (LOG-405) · [06 Tasks](./06-task-management.md) (LOG-102) · [07 Customer Portal](./07-customer-portal.md) (LOG-103) as the customer surface · [17 Documents](./17-documents-file-management.md) (LOG-407) for attachments · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for support workflows and SLA timers · [11 Communication Center](./11-communication-center.md) (LOG-106) for outbound email replies · [18 Time Tracking](./18-time-tracking.md) (LOG-408) for time on tickets.
>
> **Consumed by:** 07 Customer Portal (requests, chat, knowledge base), 05 Projects (§61 support activity), 02 CRM (timeline events), 06 Tasks (linked tickets, affected customers on releases).

Build a comprehensive, AI-powered customer support platform inspired by
Intercom. It is the single entry point for customer support requests,
connecting customers, Members, projects, tasks and all existing
application entities.

**Core principle: Do not duplicate existing functionality or entities.**
Reuse the existing customer records, organizations, contacts, users,
projects, tasks, files, notifications, and permission systems. The
support module should reference and extend these entities rather than
creating separate versions of them.

The system should provide a unified inbox for customer communication,
ticket management, live chat, automation, AI assistance, and customer
self-service.

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (28)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Settings** | | | |
| `SupportSettings` | `support_settings` | [L12388](../../api/prisma/schema.prisma#L12388) | 13 §2, §3, §7 — per-organization support configuration: ticket numbering, auto-close / inactivity periods, CSAT, AI thresholds and approval requirements. Rul… |
| **Inboxes & channels** | | | |
| `SupportInbox` | `support_inboxes` | [L12436](../../api/prisma/schema.prisma#L12436) | 13 §1 — team / shared inbox. Conversations and tickets are routed into an inbox; an inbox can belong to a Team (01 §42) and to a Branch for branch-level supp… |
| `SupportChannel` | `support_channels` | [L12476](../../api/prisma/schema.prisma#L12476) | 13 §1, §5 — a connected channel feeding an inbox: inbound email address, website/in-app widget, live chat, portal request form, API. Widget appearance lives … |
| **Conversations** | | | |
| `SupportConversation` | `support_conversations` | [L12514](../../api/prisma/schema.prisma#L12514) | 13 §1, §14 — the communication thread between a customer and the team (chat, email, widget, portal). Identity resolves to a CRM Contact/Company (02) and/or a… |
| `SupportConversationParticipant` | `support_conversation_participants` | [L12600](../../api/prisma/schema.prisma#L12600) | 13 §1 — internal members collaborating on a conversation (assignee, collaborators, @mentioned); `last_read_at` drives agent-side read receipts and unread cou… |
| `SupportMessage` | `support_messages` | [L12617](../../api/prisma/schema.prisma#L12617) | 13 §1, §2, §3 — one message in a conversation: customer message, agent reply, private internal note, AI agent answer or system event. Outbound email replies … |
| `SupportMessageAttachment` | `support_message_attachments` | [L12678](../../api/prisma/schema.prisma#L12678) | 13 §1 — file and image attachments on a message are Documents (17 §2). |
| **Ticket configuration** | | | |
| `TicketStatus` | `ticket_statuses` | [L12698](../../api/prisma/schema.prisma#L12698) | 13 §2, §13 — configurable ticket statuses with workflow transitions (organization-wide). |
| `TicketCategory` | `ticket_categories` | [L12728](../../api/prisma/schema.prisma#L12728) | 13 §2, §3 — custom ticket categories (hierarchical) with routing defaults used by AI categorization and automation rules (20). |
| **SLA** | | | |
| `SlaPolicy` | `sla_policies` | [L12765](../../api/prisma/schema.prisma#L12765) | 13 §2, §7 — SLA policy: response/resolution targets per priority, business-hours handling and escalation. Timers and auto-escalation are executed by 20 sched… |
| `SlaPolicyTarget` | `sla_policy_targets` | [L12797](../../api/prisma/schema.prisma#L12797) | 13 §2 — targets per priority within a policy (minutes; null = not tracked). |
| **Ticket** | | | |
| `Ticket` | `tickets` | [L12817](../../api/prisma/schema.prisma#L12817) | 13 §2, §5, §14 — the structured support case: priority, SLA, status, ownership, resolution. Requester is a CRM Contact/Company (02) and/or a Customer Portal … |
| `TicketConversation` | `ticket_conversations` | [L12957](../../api/prisma/schema.prisma#L12957) | 13 §14 — additional conversations attached to a ticket (one conversation ↔ many tickets and vice versa). |
| `TicketStatusHistory` | `ticket_status_history` | [L12971](../../api/prisma/schema.prisma#L12971) | 13 §2, §9 — queryable status history for resolution-time, SLA and agent metrics. |
| `TicketSlaTimer` | `ticket_sla_timers` | [L12999](../../api/prisma/schema.prisma#L12999) | 13 §2, §7 — one SLA timer per metric per ticket; paused while the status pauses SLA. The due reminder / breach check is a 20 ScheduledJob. |
| `TicketRelation` | `ticket_relations` | [L13030](../../api/prisma/schema.prisma#L13030) | 13 §2, §3 — related / duplicate / blocking / same-incident relationships between tickets. |
| `TicketTaskLink` | `ticket_task_links` | [L13052](../../api/prisma/schema.prisma#L13052) | 13 §4, §14 — permanent link between a ticket and a Task (06): many tickets ↔ many tasks. Creation is idempotent via `idempotency_key`; status sync follows Su… |
| `TicketFollower` | `ticket_followers` | [L13079](../../api/prisma/schema.prisma#L13079) | 13 §2, §10 — members following a ticket for notifications (14). |
| `TicketAttachment` | `ticket_attachments` | [L13093](../../api/prisma/schema.prisma#L13093) | 13 §2, §5 — attachments on a ticket (beyond message attachments) are Documents (17); id only. |
| `SupportIncident` | `support_incidents` | [L13114](../../api/prisma/schema.prisma#L13114) | 13 §3, §9 — a grouped incident / recurring problem spanning several tickets (detected by AI or declared by an agent). Tickets point at it via Ticket.incident… |
| **CSAT** | | | |
| `SupportCsatRating` | `support_csat_ratings` | [L13143](../../api/prisma/schema.prisma#L13143) | 13 §9 — customer satisfaction rating requested on resolution (ticket or conversation). |
| **Canned responses** | | | |
| `SupportCannedResponse` | `support_canned_responses` | [L13178](../../api/prisma/schema.prisma#L13178) | 13 §1 — saved replies / response templates / macros with optional field actions. |
| **Knowledge base** | | | |
| `KnowledgeCategory` | `knowledge_categories` | [L13213](../../api/prisma/schema.prisma#L13213) | 13 §6 — categories / collections of the customer-facing help center (hierarchical). |
| `KnowledgeArticle` | `knowledge_articles` | [L13241](../../api/prisma/schema.prisma#L13241) | 13 §6 — help-center article (rich text, versions, feedback). Public articles are served by the help center and the portal (07); INTERNAL ones only to agents.… |
| `KnowledgeArticleVersion` | `knowledge_article_versions` | [L13300](../../api/prisma/schema.prisma#L13300) | 13 §6 — immutable article version history. |
| `KnowledgeArticleFeedback` | `knowledge_article_feedback` | [L13319](../../api/prisma/schema.prisma#L13319) | 13 §6 — ratings and feedback on an article from portal users, anonymous visitors or agents. |
| **AI** | | | |
| `SupportAiSession` | `support_ai_sessions` | [L13346](../../api/prisma/schema.prisma#L13346) | 13 §3 — an AI support-agent session on a conversation: first-line answers from the knowledge base and authorized data, information collection, ticket creatio… |
| `SupportAiSuggestion` | `support_ai_suggestions` | [L13381](../../api/prisma/schema.prisma#L13381) | 13 §3 — one AI output awaiting / past human review: classification, priority, assignment, reply draft, summary, translation, article recommendation, duplicat… |

**Owned enums (21):** `SupportChannelType`, `SupportConversationStatus`, `SupportMessageKind`, `SupportMessageDeliveryStatus`, `SupportParticipantRole`, `TicketPriority`, `TicketStatusCategory`, `TicketType`, `TicketSource`, `TicketRelationType`, `TicketTaskLinkKind`, `SlaMetric`, `SlaTimerStatus`, `SupportSentiment`, `KnowledgeArticleStatus`, `KnowledgeVisibility`, `SupportCannedResponseScope`, `SupportAiSessionStatus`, `SupportAiSuggestionKind`, `SupportAiSuggestionStatus`, `SupportIncidentStatus`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `SupportInbox.branch`, `Ticket.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `KnowledgeArticle.author`, `SupportAiSuggestion.reviewed_by`, `SupportCannedResponse.owner`, `SupportConversation.assignee` +6 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `KnowledgeArticle.organization`, `KnowledgeCategory.organization`, `SlaPolicy.organization`, `SupportAiSession.organization` +12 more |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `SupportCannedResponse.team`, `SupportConversation.team`, `SupportInbox.team`, `Ticket.team` |
| [01](./01-users-organizations-permissions.md) | `User` (`users`) | `KnowledgeArticleFeedback.user`, `SupportConversation.customer`, `SupportCsatRating.rated_by`, `SupportMessage.author_user` +1 more |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `SupportConversation.company`, `Ticket.company` |
| [02](./02-crm-sales-management.md) | `CrmContact` (`crm_contacts`) | `SupportConversation.contact`, `SupportCsatRating.contact`, `Ticket.requester` |
| [05](./05-project-management.md) | `Project` (`projects`) | `Ticket.project` |
| [05](./05-project-management.md) | `ProjectChangeRequest` (`project_change_requests`) | `Ticket.change_request` |
| [06](./06-task-management.md) | `Task` (`tasks`) | `TicketTaskLink.task` |

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `Organization`
- [05](./05-project-management.md): `ProjectIssue`
- [15](./15-notion-business-docs.md): `WikiAiIndexEntry`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `ProjectIssue.ticket_id` ([05](./05-project-management.md), [L4999](../../api/prisma/schema.prisma#L4999)) — Linked support ticket (13) when the issue originated from support; id only.
- `Release.notes` ([06](./06-task-management.md), [L5856](../../api/prisma/schema.prisma#L5856)) — Release notes (markdown), publishable to the portal (07) and knowledge base (13 §6).
- `Release.affected_company_ids` ([06](./06-task-management.md), [L5856](../../api/prisma/schema.prisma#L5856)) — Customers affected, derived from linked tickets (13 §4); CRM company ids.
- `CustomerPortalSettings.widget_settings` ([07](./07-customer-portal.md), [L5917](../../api/prisma/schema.prisma#L5917)) — Embedded widget configuration (support chat, request form) for customer sites (13 §5).
- `CommThread.support_conversation_id` ([11](./11-communication-center.md), [L10045](../../api/prisma/schema.prisma#L10045)) — 13 SupportConversation holding inbound replies; id only.
- `Channel.entity_type` ([12](./12-messaging-team-communication.md), [L11224](../../api/prisma/schema.prisma#L11224)) — 12 §7, §25 — associated business record for RECORD conversations (task, deal, ticket (13), proposal …).
- `WikiPage.customer_visible` ([15](./15-notion-business-docs.md), [L14490](../../api/prisma/schema.prisma#L14490)) — 15 §4 — exposed through the Customer Portal (07) / help center (13 §6). Audited (15 §9).
- `WikiPage.help_center_article_id` ([15](./15-notion-business-docs.md), [L14490](../../api/prisma/schema.prisma#L14490)) — 13 §6 KnowledgeArticle view published from this page (13 owns the article; the page is the source); id only.
- `CustomForm.opens_at` ([15](./15-notion-business-docs.md), [L14885](../../api/prisma/schema.prisma#L14885)) — Automatic 06 Task / 13 Ticket creation is configured in 20 rules; this is the default hint shown there.
- `WikiAiIndexEntry.knowledge_article_id` ([15](./15-notion-business-docs.md), [L15065](../../api/prisma/schema.prisma#L15065)) — 13 §6 — source help-center article when source_type = KNOWLEDGE_ARTICLE; only PUBLISHED articles are indexed.
- `TimeEntry.ticket_id` ([18](./18-time-tracking.md), [L16626](../../api/prisma/schema.prisma#L16626)) — Support ticket (13 §4); id only.
- `Timer.ticket_id` ([18](./18-time-tracking.md), [L16751](../../api/prisma/schema.prisma#L16751)) — Support ticket (13 §4); id only.
- `TimeSuggestion.ticket_id` ([18](./18-time-tracking.md), [L16833](../../api/prisma/schema.prisma#L16833)) — Support ticket (13); id only.

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 35 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `support.ai` | configure*, use |
| `support.analytics` | read |
| `support.automation` | manage |
| `support.canned_responses` | manage |
| `support.conversations` | read, create, update, delete*, archive, export*, assign, reply, close |
| `support.csat` | read |
| `support.inboxes` | manage |
| `support.knowledge` | read, create, update, delete*, archive, export*, publish* |
| `support.settings` | manage |
| `support.sla_policies` | manage |
| `support.tickets` | merge, escalate, convert_to_task, read, create, update, delete*, archive, export*, assign |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Unified Inbox & Conversations

<!-- schema-section:start -->
> **Schema:** `SupportCannedResponse` ([support_canned_responses](../../api/prisma/schema.prisma#L13178)) · `SupportChannel` ([support_channels](../../api/prisma/schema.prisma#L12476)) · `SupportConversation` ([support_conversations](../../api/prisma/schema.prisma#L12514)): `customer_last_read_at`, `merged_into_conversation_id`, `snoozed_until`, `split_from_conversation_id` · `SupportConversationParticipant` ([support_conversation_participants](../../api/prisma/schema.prisma#L12600)) · `SupportInbox` ([support_inboxes](../../api/prisma/schema.prisma#L12436)): `signature` · `SupportMessage` ([support_messages](../../api/prisma/schema.prisma#L12617)): `canned_response_id`, `mentions`, `organization_id`, `read_by_customer_at`, `search_vector` · `SupportMessageAttachment` ([support_message_attachments](../../api/prisma/schema.prisma#L12678)) · `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L12388)): `default_signature` · `Ticket` ([tickets](../../api/prisma/schema.prisma#L12817)): `search_vector` · enum `SupportCannedResponseScope` ([L12331](../../api/prisma/schema.prisma#L12331)) · enum `SupportChannelType` ([L12191](../../api/prisma/schema.prisma#L12191)) · enum `SupportConversationStatus` ([L12202](../../api/prisma/schema.prisma#L12202)) · enum `SupportMessageDeliveryStatus` ([L12219](../../api/prisma/schema.prisma#L12219)) · enum `SupportMessageKind` ([L12210](../../api/prisma/schema.prisma#L12210)) · enum `SupportParticipantRole` ([L12228](../../api/prisma/schema.prisma#L12228))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `SlaPolicy` ([sla_policies](../../api/prisma/schema.prisma#L12765)) · `SlaPolicyTarget` ([sla_policy_targets](../../api/prisma/schema.prisma#L12797)) · `SupportInbox` ([support_inboxes](../../api/prisma/schema.prisma#L12436)): `default_assignee_membership_id`, `routing_strategy` · `SupportMessage` ([support_messages](../../api/prisma/schema.prisma#L12617)) · `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L12388)) · `Ticket` ([tickets](../../api/prisma/schema.prisma#L12817)): `number`, `search_vector` · `TicketAttachment` ([ticket_attachments](../../api/prisma/schema.prisma#L13093)) · `TicketCategory` ([ticket_categories](../../api/prisma/schema.prisma#L12728)) · `TicketFollower` ([ticket_followers](../../api/prisma/schema.prisma#L13079)) · `TicketRelation` ([ticket_relations](../../api/prisma/schema.prisma#L13030)) · `TicketSlaTimer` ([ticket_sla_timers](../../api/prisma/schema.prisma#L12999)) · `TicketStatus` ([ticket_statuses](../../api/prisma/schema.prisma#L12698)): `pauses_sla` · `TicketStatusHistory` ([ticket_status_history](../../api/prisma/schema.prisma#L12971)) · enum `SlaMetric` ([L12292](../../api/prisma/schema.prisma#L12292)) · enum `SlaTimerStatus` ([L12299](../../api/prisma/schema.prisma#L12299)) · enum `SupportMessageKind` ([L12210](../../api/prisma/schema.prisma#L12210)) · enum `TicketPriority` ([L12235](../../api/prisma/schema.prisma#L12235)) · enum `TicketRelationType` ([L12278](../../api/prisma/schema.prisma#L12278)) · enum `TicketSource` ([L12265](../../api/prisma/schema.prisma#L12265)) · enum `TicketStatusCategory` ([L12243](../../api/prisma/schema.prisma#L12243))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `SupportAiSession` ([support_ai_sessions](../../api/prisma/schema.prisma#L13346)) · `SupportAiSuggestion` ([support_ai_suggestions](../../api/prisma/schema.prisma#L13381)) · `SupportChannel` ([support_channels](../../api/prisma/schema.prisma#L12476)): `ai_agent_enabled` · `SupportConversation` ([support_conversations](../../api/prisma/schema.prisma#L12514)): `ai_summary`, `language` · `SupportIncident` ([support_incidents](../../api/prisma/schema.prisma#L13114)) · `SupportMessage` ([support_messages](../../api/prisma/schema.prisma#L12617)): `ai_suggestion_id`, `language` · `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L12388)): `ai_agent_enabled`, `ai_auto_classify_threshold`, `ai_handover_after_turns`, `ai_model`, `ai_require_task_approval` · `Ticket` ([tickets](../../api/prisma/schema.prisma#L12817)): `ai_complexity` · `TicketCategory` ([ticket_categories](../../api/prisma/schema.prisma#L12728)): `ai_hints` · `TicketRelation` ([ticket_relations](../../api/prisma/schema.prisma#L13030)): `detected_by_ai` · `TicketTaskLink` ([ticket_task_links](../../api/prisma/schema.prisma#L13052)): `ai_suggestion_id` · enum `SupportAiSessionStatus` ([L12338](../../api/prisma/schema.prisma#L12338)) · enum `SupportAiSuggestionKind` ([L12347](../../api/prisma/schema.prisma#L12347)) · enum `SupportAiSuggestionStatus` ([L12368](../../api/prisma/schema.prisma#L12368)) · enum `SupportIncidentStatus` ([L12377](../../api/prisma/schema.prisma#L12377)) · enum `SupportSentiment` ([L12308](../../api/prisma/schema.prisma#L12308)) · enum `TicketRelationType` ([L12278](../../api/prisma/schema.prisma#L12278)) · enum `TicketType` ([L12253](../../api/prisma/schema.prisma#L12253))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L12388)): `ai_require_task_approval`, `default_task_type_id`, `task_priority_mapping`, `task_status_sync_mapping` · `TicketCategory` ([ticket_categories](../../api/prisma/schema.prisma#L12728)): `default_project_id` · `TicketStatusHistory` ([ticket_status_history](../../api/prisma/schema.prisma#L12971)): `changed_via` · `TicketTaskLink` ([ticket_task_links](../../api/prisma/schema.prisma#L13052)): `idempotency_key`, `last_synced_task_status`, `sync_status` · enum `TicketTaskLinkKind` ([L12286](../../api/prisma/schema.prisma#L12286)) — other modules: `Release` ([releases](../../api/prisma/schema.prisma#L5856)): `affected_company_ids` ([06](./06-task-management.md)) · `TaskLink` ([task_links](../../api/prisma/schema.prisma#L5799)) ([06](./06-task-management.md)) · `TimeEntry` ([time_entries](../../api/prisma/schema.prisma#L16626)): `ticket_id` ([18](./18-time-tracking.md)) · `Timer` ([timers](../../api/prisma/schema.prisma#L16751)): `ticket_id` ([18](./18-time-tracking.md))
<!-- schema-section:end -->

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

## 5. Customer Portal Integration

<!-- schema-section:start -->
> **Schema:** `SupportChannel` ([support_channels](../../api/prisma/schema.prisma#L12476)) · `Ticket` ([tickets](../../api/prisma/schema.prisma#L12817)): `customer_visible` · `TicketAttachment` ([ticket_attachments](../../api/prisma/schema.prisma#L13093)): `added_by_user_id` · `TicketStatus` ([ticket_statuses](../../api/prisma/schema.prisma#L12698)): `customer_label` · enum `SupportChannelType` ([L12191](../../api/prisma/schema.prisma#L12191)) · enum `TicketType` ([L12253](../../api/prisma/schema.prisma#L12253)) — other modules: `CustomerPortalSettings` ([customer_portal_settings](../../api/prisma/schema.prisma#L5917)): `widget_settings` ([07](./07-customer-portal.md))
<!-- schema-section:end -->

> Surface defined by → [07 Customer Portal](./07-customer-portal.md) §5 · Linear LOG-103. Identity defined by → 01 §79.

Support defines the request and ticket capabilities; the Customer Portal
surfaces them. Customers never create Tasks directly: every portal
request (feature request, bug report, change request, question) is a
Ticket here, and the agency converts it to a Task (06) or Project Change
Request (05 §45).

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

<!-- schema-section:start -->
> **Schema:** `KnowledgeArticle` ([knowledge_articles](../../api/prisma/schema.prisma#L13241)): `ai_generated`, `is_faq`, `search_vector`, `view_count` · `KnowledgeArticleFeedback` ([knowledge_article_feedback](../../api/prisma/schema.prisma#L13319)) · `KnowledgeArticleVersion` ([knowledge_article_versions](../../api/prisma/schema.prisma#L13300)) · `KnowledgeCategory` ([knowledge_categories](../../api/prisma/schema.prisma#L13213)) · `SupportIncident` ([support_incidents](../../api/prisma/schema.prisma#L13114)): `knowledge_article_id` · enum `KnowledgeArticleStatus` ([L12316](../../api/prisma/schema.prisma#L12316)) · enum `KnowledgeVisibility` ([L12324](../../api/prisma/schema.prisma#L12324)) — other modules: `Release` ([releases](../../api/prisma/schema.prisma#L5856)): `notes` ([06](./06-task-management.md)) · `WikiAiIndexEntry` ([wiki_ai_index_entries](../../api/prisma/schema.prisma#L15065)): `knowledge_article_id` ([15](./15-notion-business-docs.md)) · `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L14490)): `customer_visible`, `help_center_article_id` ([15](./15-notion-business-docs.md))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `SlaPolicy` ([sla_policies](../../api/prisma/schema.prisma#L12765)): `at_risk_threshold_percent`, `escalation_rule_ids` · `SupportInbox` ([support_inboxes](../../api/prisma/schema.prisma#L12436)): `auto_reply_body` · `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L12388)): `auto_close_after_days`, `inactivity_after_hours`, `reopen_window_days` · `Ticket` ([tickets](../../api/prisma/schema.prisma#L12817)): `auto_close_at` · `TicketSlaTimer` ([ticket_sla_timers](../../api/prisma/schema.prisma#L12999)) · `TicketStatusHistory` ([ticket_status_history](../../api/prisma/schema.prisma#L12971)): `changed_via` · enum `SlaTimerStatus` ([L12299](../../api/prisma/schema.prisma#L12299))
<!-- schema-section:end -->

> Engine defined by → [20 Automation Engine](./20-automation-engine.md) · Linear LOG-410. Support declares its triggers (ticket created, SLA at risk, inactivity, AI classification completed) and actions (assign, route, respond, close, reopen, create task) and registers SLA timers and auto-close as scheduled jobs. It does not implement its own rules runtime.

Support-specific rules should cover:

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

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [02 CRM](./02-crm-sales-management.md) §18 (Customer 360 view) and §34 · Linear LOG-404.

The unified customer timeline is the CRM Customer 360 view. Support
contributes its events to it and displays it inside the support inbox;
it does not build a second timeline. Support contributes:

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

<!-- schema-section:start -->
> **Schema:** `KnowledgeArticle` ([knowledge_articles](../../api/prisma/schema.prisma#L13241)): `view_count` · `SupportAiSuggestion` ([support_ai_suggestions](../../api/prisma/schema.prisma#L13381)): `was_correct` · `SupportCsatRating` ([support_csat_ratings](../../api/prisma/schema.prisma#L13143)) · `SupportIncident` ([support_incidents](../../api/prisma/schema.prisma#L13114)) · `SupportMessage` ([support_messages](../../api/prisma/schema.prisma#L12617)): `is_first_response` · `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L12388)): `csat_enabled` · `Ticket` ([tickets](../../api/prisma/schema.prisma#L12817)): `resolved_by_ai` · `TicketStatusHistory` ([ticket_status_history](../../api/prisma/schema.prisma#L12971)) · enum `SupportIncidentStatus` ([L12377](../../api/prisma/schema.prisma#L12377))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `TicketFollower` ([ticket_followers](../../api/prisma/schema.prisma#L13079)) · enum `SupportMessageDeliveryStatus` ([L12219](../../api/prisma/schema.prisma#L12219))
<!-- schema-section:end -->

> Engine defined by → [14 Notifications & Activity Center](./14-notifications-activity-center.md) · Linear LOG-403. Outbound email replies are sent through [11 Communication Center](./11-communication-center.md).

Support emits these events:

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

<!-- schema-section:start -->
> **Schema:** other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L18986)) ([20](./20-automation-engine.md))
<!-- schema-section:end -->

The Support module must be fully interconnected with the rest of the
application.

Reuse existing entities and services:

* **Customers & CRM:** Shared customer profiles, contacts,
  organizations, and customer history.
* **Task Manager:** Direct ticket-to-task conversion and bidirectional
  status synchronization.
* **Projects:** Link tickets to existing projects and their
  development work.
* **Users & Teams:** 01 Members, roles, permissions, Teams, Customer
  Portal Users.
* **Files & Attachments:** 17 Documents & File Management.
* **Notifications:** 14 Notifications & Activity Center.
* **Communication:** 11 Communication Center for outbound email/SMS;
  12 Messaging for internal discussion of a ticket (12 §60).
* **AI Infrastructure:** the shared AI integration layer
  (`docs/Product_Specification.md` §6). Support uses JEV from Typesafe
  AI as its model through that layer; other modules may use other
  models behind the same layer.
* **Knowledge Base:** this module owns the customer-facing knowledge
  base (§6); internal knowledge is 15 Business Docs.
* **Automation Engine:** 20 Automation Engine.
* **Analytics:** support metrics are exposed to platform reporting.

Avoid creating duplicate customer records, task entities, project
entities, user records, file storage, notification systems, or AI
infrastructure.

## 12. Example End-to-End Workflow

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

**Customer reports a bug → AI identifies the issue → Support ticket →**
**Duplicate detection → Existing project identified → Development task**
**automatically created → Developer assigned → Fix implemented → Task**
**completed → Support ticket updated → Customer notified → Ticket**
**resolved.**

The customer, support agent, and developer should all see the relevant
information and status updates from their respective application
modules.

## 13. Architecture & Implementation Requirements

<!-- schema-section:start -->
> **Schema:** `TicketStatus` ([ticket_statuses](../../api/prisma/schema.prisma#L12698)) · `TicketTaskLink` ([ticket_task_links](../../api/prisma/schema.prisma#L13052)): `idempotency_key` · enum `TicketStatusCategory` ([L12243](../../api/prisma/schema.prisma#L12243)) — other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1319)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `SupportConversation` ([support_conversations](../../api/prisma/schema.prisma#L12514)) · `Ticket` ([tickets](../../api/prisma/schema.prisma#L12817)) · `TicketConversation` ([ticket_conversations](../../api/prisma/schema.prisma#L12957)) · `TicketTaskLink` ([ticket_task_links](../../api/prisma/schema.prisma#L13052))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Deliver an Intercom-like customer communication and support experience
that feels native to the application. Customers communicate through one
unified interface, support teams manage everything through one inbox, AI
handles classification and repetitive work, and technical problems flow
directly into the existing Task Manager and Project Management systems.
