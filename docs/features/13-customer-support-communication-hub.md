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

### Owned tables (30)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Settings** | | | |
| `SupportSettings` | `support_settings` | [L14580](../../api/prisma/schema.prisma#L14580) | 13 §2, §3, §7 — per-organization support configuration: ticket numbering, auto-close / inactivity periods, CSAT, AI thresholds and approval requirements. Rul… |
| **Inboxes & channels** | | | |
| `SupportInbox` | `support_inboxes` | [L14633](../../api/prisma/schema.prisma#L14633) | 13 §1 — team / shared inbox. Conversations and tickets are routed into an inbox; an inbox can belong to a Team (01 §42) and to a Branch for branch-level supp… |
| `SupportChannel` | `support_channels` | [L14673](../../api/prisma/schema.prisma#L14673) | 13 §1, §5 — a connected channel feeding an inbox: inbound email address, website/in-app widget, live chat, portal request form, API. Widget appearance lives … |
| **Conversations** | | | |
| `SupportConversation` | `support_conversations` | [L14713](../../api/prisma/schema.prisma#L14713) | 13 §1, §14 — the communication thread between a customer and the team (chat, email, widget, portal). Identity resolves to a CRM Contact/Company (02) and/or a… |
| `SupportConversationParticipant` | `support_conversation_participants` | [L14799](../../api/prisma/schema.prisma#L14799) | 13 §1 — internal members collaborating on a conversation (assignee, collaborators, @mentioned); `last_read_at` drives agent-side read receipts and unread cou… |
| `SupportMessage` | `support_messages` | [L14816](../../api/prisma/schema.prisma#L14816) | 13 §1, §2, §3 — one message in a conversation: customer message, agent reply, private internal note, AI agent answer or system event. Outbound email replies … |
| `SupportMessageAttachment` | `support_message_attachments` | [L14877](../../api/prisma/schema.prisma#L14877) | 13 §1 — file and image attachments on a message are Documents (17 §2). |
| **Ticket configuration** | | | |
| `TicketStatus` | `ticket_statuses` | [L14897](../../api/prisma/schema.prisma#L14897) | 13 §2, §13 — configurable ticket statuses with workflow transitions (organization-wide). |
| `TicketCategory` | `ticket_categories` | [L14927](../../api/prisma/schema.prisma#L14927) | 13 §2, §3 — custom ticket categories (hierarchical) with routing defaults used by AI categorization and automation rules (20). |
| **SLA** | | | |
| `SlaPolicy` | `sla_policies` | [L14964](../../api/prisma/schema.prisma#L14964) | 13 §2, §7 — SLA policy: response/resolution targets per priority, business-hours handling and escalation. Timers and auto-escalation are executed by 20 sched… |
| `SlaPolicyTarget` | `sla_policy_targets` | [L14996](../../api/prisma/schema.prisma#L14996) | 13 §2 — targets per priority within a policy (minutes; null = not tracked). |
| **Ticket** | | | |
| `Ticket` | `tickets` | [L15016](../../api/prisma/schema.prisma#L15016) | 13 §2, §5, §14 — the structured support case: priority, SLA, status, ownership, resolution. Requester is a CRM Contact/Company (02) and/or a Customer Portal … |
| `TicketConversation` | `ticket_conversations` | [L15161](../../api/prisma/schema.prisma#L15161) | 13 §14 — additional conversations attached to a ticket (one conversation ↔ many tickets and vice versa). |
| `TicketStatusHistory` | `ticket_status_history` | [L15175](../../api/prisma/schema.prisma#L15175) | 13 §2, §9 — queryable status history for resolution-time, SLA and agent metrics. |
| `TicketSlaTimer` | `ticket_sla_timers` | [L15203](../../api/prisma/schema.prisma#L15203) | 13 §2, §7 — one SLA timer per metric per ticket; paused while the status pauses SLA. The due reminder / breach check is a 20 ScheduledJob. |
| `TicketRelation` | `ticket_relations` | [L15234](../../api/prisma/schema.prisma#L15234) | 13 §2, §3 — related / duplicate / blocking / same-incident relationships between tickets. |
| `TicketTaskLink` | `ticket_task_links` | [L15256](../../api/prisma/schema.prisma#L15256) | 13 §4, §14 — permanent link between a ticket and a Task (06): many tickets ↔ many tasks. Creation is idempotent via `idempotency_key`; status sync follows Su… |
| `TicketFollower` | `ticket_followers` | [L15283](../../api/prisma/schema.prisma#L15283) | 13 §2, §10 — members following a ticket for notifications (14). |
| `TicketAttachment` | `ticket_attachments` | [L15297](../../api/prisma/schema.prisma#L15297) | 13 §2, §5 — attachments on a ticket (beyond message attachments) are Documents (17); id only. |
| `SupportIncident` | `support_incidents` | [L15318](../../api/prisma/schema.prisma#L15318) | 13 §3, §9 — a grouped incident / recurring problem spanning several tickets (detected by AI or declared by an agent). Tickets point at it via Ticket.incident… |
| **CSAT** | | | |
| `SupportCsatRating` | `support_csat_ratings` | [L15353](../../api/prisma/schema.prisma#L15353) | 13 §9 — customer satisfaction rating requested on resolution (ticket or conversation). |
| **Canned responses** | | | |
| `SupportCannedResponse` | `support_canned_responses` | [L15388](../../api/prisma/schema.prisma#L15388) | 13 §1 — saved replies / response templates / macros with optional field actions. |
| **Knowledge base** | | | |
| `KnowledgeCategory` | `knowledge_categories` | [L15423](../../api/prisma/schema.prisma#L15423) | 13 §6 — categories / collections of the customer-facing help center (hierarchical). |
| `KnowledgeArticle` | `knowledge_articles` | [L15451](../../api/prisma/schema.prisma#L15451) | 13 §6 — help-center article (rich text, versions, feedback). Public articles are served by the help center and the portal (07); INTERNAL ones only to agents.… |
| `KnowledgeArticleVersion` | `knowledge_article_versions` | [L15514](../../api/prisma/schema.prisma#L15514) | 13 §6 — immutable article version history. |
| `KnowledgeArticleFeedback` | `knowledge_article_feedback` | [L15533](../../api/prisma/schema.prisma#L15533) | 13 §6 — ratings and feedback on an article from portal users, anonymous visitors or agents. |
| **AI** | | | |
| `SupportAiSession` | `support_ai_sessions` | [L15560](../../api/prisma/schema.prisma#L15560) | 13 §3 — an AI support-agent session on a conversation: first-line answers from the knowledge base and authorized data, information collection, ticket creatio… |
| `SupportAiSuggestion` | `support_ai_suggestions` | [L15595](../../api/prisma/schema.prisma#L15595) | 13 §3 — one AI output awaiting / past human review: classification, priority, assignment, reply draft, summary, translation, article recommendation, duplicat… |
| `SupportIncidentUpdate` | `support_incident_updates` | [L15636](../../api/prisma/schema.prisma#L15636) | 13 §5 — status-page style timeline entry of an incident. customer_visible entries are shown in the customer portal (07) and mirrored by the incident's Announ… |
| `SupportAgentProfile` | `support_agent_profiles` | [L15657](../../api/prisma/schema.prisma#L15657) | 13 §2 — per-member support routing profile: presence, capacity, skills and languages used by ROUND_ROBIN / LOAD_BALANCED / SKILL_BASED inboxes. Members edit … |

**Owned enums (26):** `SupportChannelType`, `SupportConversationStatus`, `SupportMessageKind`, `SupportMessageDeliveryStatus`, `SupportParticipantRole`, `TicketPriority`, `TicketStatusCategory`, `TicketType`, `TicketSource`, `TicketRelationType`, `TicketTaskLinkKind`, `SlaMetric`, `SlaTimerStatus`, `SupportSentiment`, `KnowledgeArticleStatus`, `KnowledgeVisibility`, `SupportCannedResponseScope`, `SupportAiSessionStatus`, `SupportAiSuggestionKind`, `SupportAiSuggestionStatus`, `SupportIncidentStatus`, `SupportIncidentSeverity`, `SupportIncidentUpdateStatus`, `SupportRoutingStrategy`, `SupportAgentAvailability`, `SupportCsatScale`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `SupportInbox.branch`, `Ticket.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `KnowledgeArticle.author`, `SupportAgentProfile.membership`, `SupportAiSuggestion.reviewed_by`, `SupportCannedResponse.owner` +8 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `KnowledgeArticle.organization`, `KnowledgeCategory.organization`, `SlaPolicy.organization`, `SupportAgentProfile.organization` +14 more |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `SupportCannedResponse.team`, `SupportConversation.team`, `SupportInbox.team`, `Ticket.team` |
| [01](./01-users-organizations-permissions.md) | `User` (`users`) | `KnowledgeArticleFeedback.user`, `SupportConversation.customer`, `SupportCsatRating.rated_by`, `SupportMessage.author_user` +1 more |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `SupportConversation.company`, `Ticket.company` |
| [02](./02-crm-sales-management.md) | `CrmContact` (`crm_contacts`) | `SupportConversation.contact`, `SupportCsatRating.contact`, `Ticket.requester` |
| [05](./05-project-management.md) | `Project` (`projects`) | `Ticket.project` |
| [05](./05-project-management.md) | `ProjectChangeRequest` (`project_change_requests`) | `Ticket.change_request` |
| [06](./06-task-management.md) | `Task` (`tasks`) | `TicketTaskLink.task` |
| [12](./12-messaging-team-communication.md) | `Message` (`messages`) | `Ticket.source_message` |

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `Membership`, `Organization`
- [05](./05-project-management.md): `ProjectIssue`
- [14](./14-notifications-activity-center.md): `Announcement`
- [15](./15-notion-business-docs.md): `WikiAiIndexEntry`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `ProjectIssue.ticket_id` ([05](./05-project-management.md), [L6131](../../api/prisma/schema.prisma#L6131)) — Linked support ticket (13) when the issue originated from support; id only.
- `Release.notes` ([06](./06-task-management.md), [L7012](../../api/prisma/schema.prisma#L7012)) — Release notes (markdown), publishable to the portal (07) and knowledge base (13 §6).
- `Release.affected_company_ids` ([06](./06-task-management.md), [L7012](../../api/prisma/schema.prisma#L7012)) — Customers affected, derived from linked tickets (13 §4); CRM company ids.
- `CustomerPortalSettings.widget_settings` ([07](./07-customer-portal.md), [L7073](../../api/prisma/schema.prisma#L7073)) — Embedded widget configuration (support chat, request form) for customer sites (13 §5).
- `CommThread.support_conversation_id` ([11](./11-communication-center.md), [L11952](../../api/prisma/schema.prisma#L11952)) — 13 SupportConversation holding inbound replies; id only.
- `Channel.entity_type` ([12](./12-messaging-team-communication.md), [L13263](../../api/prisma/schema.prisma#L13263)) — 12 §7, §25 — associated business record for RECORD conversations (task, deal, ticket (13), proposal …).
- `Announcement.incident_id` ([14](./14-notifications-activity-center.md), [L16483](../../api/prisma/schema.prisma#L16483)) — 13 SupportIncident this announcement reports on, when any.
- `WikiPage.customer_visible` ([15](./15-notion-business-docs.md), [L16950](../../api/prisma/schema.prisma#L16950)) — 15 §4 — exposed through the Customer Portal (07) / help center (13 §6). Audited (15 §9).
- `WikiPage.help_center_article_id` ([15](./15-notion-business-docs.md), [L16950](../../api/prisma/schema.prisma#L16950)) — 13 §6 KnowledgeArticle view published from this page (13 owns the article; the page is the source); id only.
- `CustomForm.opens_at` ([15](./15-notion-business-docs.md), [L17359](../../api/prisma/schema.prisma#L17359)) — Automatic 06 Task / 13 Ticket creation is configured in 20 rules; this is the default hint shown there.
- `WikiAiIndexEntry.knowledge_article_id` ([15](./15-notion-business-docs.md), [L17539](../../api/prisma/schema.prisma#L17539)) — 13 §6 — source help-center article when source_type = KNOWLEDGE_ARTICLE; only PUBLISHED articles are indexed.
- `TimeEntry.ticket_id` ([18](./18-time-tracking.md), [L19343](../../api/prisma/schema.prisma#L19343)) — Support ticket (13 §4); id only.
- `Timer.ticket_id` ([18](./18-time-tracking.md), [L19468](../../api/prisma/schema.prisma#L19468)) — Support ticket (13 §4); id only.
- `TimeSuggestion.ticket_id` ([18](./18-time-tracking.md), [L19550](../../api/prisma/schema.prisma#L19550)) — Support ticket (13); id only.

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 37 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `support.ai` | configure*, use |
| `support.analytics` | read |
| `support.automation` | manage |
| `support.canned_responses` | manage |
| `support.conversations` | read, create, update, delete*, archive, export*, assign, reply, close |
| `support.csat` | read |
| `support.inboxes` | manage, read |
| `support.incidents` | publish* |
| `support.knowledge` | read, create, update, delete*, archive, export*, publish* |
| `support.settings` | manage |
| `support.sla_policies` | manage |
| `support.tickets` | merge, escalate, convert_to_task, read, create, update, delete*, archive, export*, assign |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Unified Inbox & Conversations

<!-- schema-section:start -->
> **Schema:** `SupportCannedResponse` ([support_canned_responses](../../api/prisma/schema.prisma#L15388)) · `SupportChannel` ([support_channels](../../api/prisma/schema.prisma#L14673)) · `SupportConversation` ([support_conversations](../../api/prisma/schema.prisma#L14713)): `customer_last_read_at`, `merged_into_conversation_id`, `snoozed_until`, `split_from_conversation_id` · `SupportConversationParticipant` ([support_conversation_participants](../../api/prisma/schema.prisma#L14799)) · `SupportInbox` ([support_inboxes](../../api/prisma/schema.prisma#L14633)): `signature` · `SupportMessage` ([support_messages](../../api/prisma/schema.prisma#L14816)): `canned_response_id`, `mentions`, `organization_id`, `read_by_customer_at`, `search_vector` · `SupportMessageAttachment` ([support_message_attachments](../../api/prisma/schema.prisma#L14877)) · `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L14580)): `default_signature` · `Ticket` ([tickets](../../api/prisma/schema.prisma#L15016)): `search_vector` · enum `SupportCannedResponseScope` ([L14487](../../api/prisma/schema.prisma#L14487)) · enum `SupportChannelType` ([L14346](../../api/prisma/schema.prisma#L14346)) · enum `SupportConversationStatus` ([L14357](../../api/prisma/schema.prisma#L14357)) · enum `SupportMessageDeliveryStatus` ([L14374](../../api/prisma/schema.prisma#L14374)) · enum `SupportMessageKind` ([L14365](../../api/prisma/schema.prisma#L14365)) · enum `SupportParticipantRole` ([L14383](../../api/prisma/schema.prisma#L14383))
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
> **Schema:** `SlaPolicy` ([sla_policies](../../api/prisma/schema.prisma#L14964)) · `SlaPolicyTarget` ([sla_policy_targets](../../api/prisma/schema.prisma#L14996)) · `SupportAgentProfile` ([support_agent_profiles](../../api/prisma/schema.prisma#L15657)) · `SupportInbox` ([support_inboxes](../../api/prisma/schema.prisma#L14633)): `default_assignee_membership_id` · `SupportMessage` ([support_messages](../../api/prisma/schema.prisma#L14816)) · `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L14580)) · `Ticket` ([tickets](../../api/prisma/schema.prisma#L15016)): `number`, `search_vector` · `TicketAttachment` ([ticket_attachments](../../api/prisma/schema.prisma#L15297)) · `TicketCategory` ([ticket_categories](../../api/prisma/schema.prisma#L14927)) · `TicketFollower` ([ticket_followers](../../api/prisma/schema.prisma#L15283)) · `TicketRelation` ([ticket_relations](../../api/prisma/schema.prisma#L15234)) · `TicketSlaTimer` ([ticket_sla_timers](../../api/prisma/schema.prisma#L15203)) · `TicketStatus` ([ticket_statuses](../../api/prisma/schema.prisma#L14897)): `pauses_sla` · `TicketStatusHistory` ([ticket_status_history](../../api/prisma/schema.prisma#L15175)) · enum `SlaMetric` ([L14448](../../api/prisma/schema.prisma#L14448)) · enum `SlaTimerStatus` ([L14455](../../api/prisma/schema.prisma#L14455)) · enum `SupportAgentAvailability` ([L14564](../../api/prisma/schema.prisma#L14564)) · enum `SupportMessageKind` ([L14365](../../api/prisma/schema.prisma#L14365)) · enum `SupportRoutingStrategy` ([L14556](../../api/prisma/schema.prisma#L14556)) · enum `TicketPriority` ([L14390](../../api/prisma/schema.prisma#L14390)) · enum `TicketRelationType` ([L14434](../../api/prisma/schema.prisma#L14434)) · enum `TicketSource` ([L14420](../../api/prisma/schema.prisma#L14420)) · enum `TicketStatusCategory` ([L14398](../../api/prisma/schema.prisma#L14398))
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

**Routing and agent profile.** `SupportInbox.routing_strategy` is the enum `SupportRoutingStrategy` (MANUAL, ROUND_ROBIN, LOAD_BALANCED, SKILL_BASED). `SupportAgentProfile` holds per member availability (ONLINE, AWAY, OFFLINE), `max_open_conversations`, skills, languages and `last_assigned_at`; members edit their own, managers need `support.inboxes.manage`. Pickers read inboxes with `support.inboxes.read`.

## 3. AI-Powered Support (JEV -- Typesafe AI Model)

<!-- schema-section:start -->
> **Schema:** `SupportAiSession` ([support_ai_sessions](../../api/prisma/schema.prisma#L15560)) · `SupportAiSuggestion` ([support_ai_suggestions](../../api/prisma/schema.prisma#L15595)) · `SupportChannel` ([support_channels](../../api/prisma/schema.prisma#L14673)): `ai_agent_enabled` · `SupportConversation` ([support_conversations](../../api/prisma/schema.prisma#L14713)): `ai_summary`, `language` · `SupportIncident` ([support_incidents](../../api/prisma/schema.prisma#L15318)) · `SupportMessage` ([support_messages](../../api/prisma/schema.prisma#L14816)): `ai_suggestion_id`, `language` · `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L14580)): `ai_agent_enabled`, `ai_auto_classify_threshold`, `ai_handover_after_turns`, `ai_model`, `ai_require_task_approval` · `Ticket` ([tickets](../../api/prisma/schema.prisma#L15016)): `ai_complexity` · `TicketCategory` ([ticket_categories](../../api/prisma/schema.prisma#L14927)): `ai_hints` · `TicketRelation` ([ticket_relations](../../api/prisma/schema.prisma#L15234)): `detected_by_ai` · `TicketTaskLink` ([ticket_task_links](../../api/prisma/schema.prisma#L15256)): `ai_suggestion_id` · enum `SupportAiSessionStatus` ([L14494](../../api/prisma/schema.prisma#L14494)) · enum `SupportAiSuggestionKind` ([L14503](../../api/prisma/schema.prisma#L14503)) · enum `SupportAiSuggestionStatus` ([L14524](../../api/prisma/schema.prisma#L14524)) · enum `SupportIncidentStatus` ([L14533](../../api/prisma/schema.prisma#L14533)) · enum `SupportSentiment` ([L14464](../../api/prisma/schema.prisma#L14464)) · enum `TicketRelationType` ([L14434](../../api/prisma/schema.prisma#L14434)) · enum `TicketType` ([L14408](../../api/prisma/schema.prisma#L14408))
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
> **Schema:** `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L14580)): `ai_require_task_approval`, `default_task_type_id`, `task_priority_mapping`, `task_status_sync_mapping` · `TicketCategory` ([ticket_categories](../../api/prisma/schema.prisma#L14927)): `default_project_id` · `TicketStatusHistory` ([ticket_status_history](../../api/prisma/schema.prisma#L15175)): `changed_via` · `TicketTaskLink` ([ticket_task_links](../../api/prisma/schema.prisma#L15256)): `idempotency_key`, `last_synced_task_status`, `sync_status` · enum `TicketTaskLinkKind` ([L14442](../../api/prisma/schema.prisma#L14442)) — other modules: `Release` ([releases](../../api/prisma/schema.prisma#L7012)): `affected_company_ids` ([06](./06-task-management.md)) · `TaskLink` ([task_links](../../api/prisma/schema.prisma#L6955)) ([06](./06-task-management.md)) · `TimeEntry` ([time_entries](../../api/prisma/schema.prisma#L19343)): `ticket_id` ([18](./18-time-tracking.md)) · `Timer` ([timers](../../api/prisma/schema.prisma#L19468)): `ticket_id` ([18](./18-time-tracking.md))
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
> **Schema:** `SupportChannel` ([support_channels](../../api/prisma/schema.prisma#L14673)) · `SupportIncident` ([support_incidents](../../api/prisma/schema.prisma#L15318)): `affected_services` · `SupportIncidentUpdate` ([support_incident_updates](../../api/prisma/schema.prisma#L15636)) · `Ticket` ([tickets](../../api/prisma/schema.prisma#L15016)): `customer_visible` · `TicketAttachment` ([ticket_attachments](../../api/prisma/schema.prisma#L15297)): `added_by_user_id` · `TicketStatus` ([ticket_statuses](../../api/prisma/schema.prisma#L14897)): `customer_label` · enum `SupportChannelType` ([L14346](../../api/prisma/schema.prisma#L14346)) · enum `SupportIncidentSeverity` ([L14541](../../api/prisma/schema.prisma#L14541)) · enum `SupportIncidentUpdateStatus` ([L14548](../../api/prisma/schema.prisma#L14548)) · enum `TicketType` ([L14408](../../api/prisma/schema.prisma#L14408)) — other modules: `Announcement` ([announcements](../../api/prisma/schema.prisma#L16483)) ([14](./14-notifications-activity-center.md)) · `CustomerPortalSettings` ([customer_portal_settings](../../api/prisma/schema.prisma#L7073)): `widget_settings` ([07](./07-customer-portal.md))
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

**Incidents and service announcements.** `SupportIncident` carries `severity` (MINOR, MAJOR, CRITICAL) and `affected_services`. Status-page style entries are `SupportIncidentUpdate` rows (INVESTIGATING, IDENTIFIED, MONITORING, RESOLVED, `customer_visible`). The portal announcement is a 14 `Announcement` with `portal_visible` and `incident_id`; publishing customer-visible updates or the announcement needs `support.incidents.publish*`.

## 6. Knowledge Base & Help Center

<!-- schema-section:start -->
> **Schema:** `KnowledgeArticle` ([knowledge_articles](../../api/prisma/schema.prisma#L15451)): `ai_generated`, `is_faq`, `search_vector`, `translation_group_id`, `view_count` · `KnowledgeArticleFeedback` ([knowledge_article_feedback](../../api/prisma/schema.prisma#L15533)) · `KnowledgeArticleVersion` ([knowledge_article_versions](../../api/prisma/schema.prisma#L15514)) · `KnowledgeCategory` ([knowledge_categories](../../api/prisma/schema.prisma#L15423)) · `SupportIncident` ([support_incidents](../../api/prisma/schema.prisma#L15318)): `knowledge_article_id` · enum `KnowledgeArticleStatus` ([L14472](../../api/prisma/schema.prisma#L14472)) · enum `KnowledgeVisibility` ([L14480](../../api/prisma/schema.prisma#L14480)) — other modules: `Release` ([releases](../../api/prisma/schema.prisma#L7012)): `notes` ([06](./06-task-management.md)) · `WikiAiIndexEntry` ([wiki_ai_index_entries](../../api/prisma/schema.prisma#L17539)): `knowledge_article_id` ([15](./15-notion-business-docs.md)) · `WikiPage` ([wiki_pages](../../api/prisma/schema.prisma#L16950)): `customer_visible`, `help_center_article_id` ([15](./15-notion-business-docs.md))
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

**Translations.** Articles that translate each other share `KnowledgeArticle.translation_group_id`; it is unique together with `locale`.

## 7. Automation & Workflows

<!-- schema-section:start -->
> **Schema:** `SlaPolicy` ([sla_policies](../../api/prisma/schema.prisma#L14964)): `at_risk_threshold_percent`, `escalation_rule_ids` · `SupportInbox` ([support_inboxes](../../api/prisma/schema.prisma#L14633)): `auto_reply_body` · `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L14580)): `auto_close_after_days`, `inactivity_after_hours`, `reopen_window_days` · `Ticket` ([tickets](../../api/prisma/schema.prisma#L15016)): `auto_close_at` · `TicketSlaTimer` ([ticket_sla_timers](../../api/prisma/schema.prisma#L15203)) · `TicketStatusHistory` ([ticket_status_history](../../api/prisma/schema.prisma#L15175)): `changed_via` · enum `SlaTimerStatus` ([L14455](../../api/prisma/schema.prisma#L14455))
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
> **Schema:** `KnowledgeArticle` ([knowledge_articles](../../api/prisma/schema.prisma#L15451)): `view_count` · `SupportAiSuggestion` ([support_ai_suggestions](../../api/prisma/schema.prisma#L15595)): `was_correct` · `SupportChannel` ([support_channels](../../api/prisma/schema.prisma#L14673)): `csat_enabled` · `SupportCsatRating` ([support_csat_ratings](../../api/prisma/schema.prisma#L15353)) · `SupportIncident` ([support_incidents](../../api/prisma/schema.prisma#L15318)) · `SupportMessage` ([support_messages](../../api/prisma/schema.prisma#L14816)): `is_first_response` · `SupportSettings` ([support_settings](../../api/prisma/schema.prisma#L14580)): `csat_enabled` · `Ticket` ([tickets](../../api/prisma/schema.prisma#L15016)): `resolved_by_ai` · `TicketStatusHistory` ([ticket_status_history](../../api/prisma/schema.prisma#L15175)) · enum `SupportCsatScale` ([L14571](../../api/prisma/schema.prisma#L14571)) · enum `SupportIncidentStatus` ([L14533](../../api/prisma/schema.prisma#L14533))
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

**CSAT survey definition.** `SupportSettings.csat_scale` (STARS_5 or THUMBS), `csat_question`, `csat_thank_you` and `csat_follow_up_threshold` define the survey; `SupportChannel.csat_enabled` switches it per channel. Thumbs are stored in `SupportCsatRating.rating` as 1 or 5.

## 10. Notifications & Communication

<!-- schema-section:start -->
> **Schema:** `TicketFollower` ([ticket_followers](../../api/prisma/schema.prisma#L15283)) · enum `SupportMessageDeliveryStatus` ([L14374](../../api/prisma/schema.prisma#L14374))
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
> **Schema:** other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L21877)) ([20](./20-automation-engine.md))
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
> **Schema:** `TicketStatus` ([ticket_statuses](../../api/prisma/schema.prisma#L14897)) · `TicketTaskLink` ([ticket_task_links](../../api/prisma/schema.prisma#L15256)): `idempotency_key` · enum `TicketStatusCategory` ([L14398](../../api/prisma/schema.prisma#L14398)) — other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1611)) ([01](./01-users-organizations-permissions.md))
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
> **Schema:** `SupportConversation` ([support_conversations](../../api/prisma/schema.prisma#L14713)) · `Ticket` ([tickets](../../api/prisma/schema.prisma#L15016)) · `TicketConversation` ([ticket_conversations](../../api/prisma/schema.prisma#L15161)) · `TicketTaskLink` ([ticket_task_links](../../api/prisma/schema.prisma#L15256))
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
