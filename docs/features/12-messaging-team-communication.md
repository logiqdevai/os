# Messaging & Team Communication

> Linear: [LOG-313](https://linear.app/logiqdev/issue/LOG-313/messaging-and-team-communication) · Status: Backlog

> **Canonical for:** internal real-time messaging: direct messages, channels (public, private, project, customer, announcement), threads, reactions, mentions, record sharing and previews, contextual conversations on business records, presence, saved messages, pinning, search inside messaging, moderation, retention and export of messages.
>
> **Boundaries:** [13 Customer Support](./13-customer-support-communication-hub.md) owns customer support conversations, live chat and inbound email. [11 Communication Center](./11-communication-center.md) owns outbound email/SMS and campaigns. [14 Notifications](./14-notifications-activity-center.md) owns notification channels, preferences and the inbox. [17 Documents](./17-documents-file-management.md) owns attachments. [01](./01-users-organizations-permissions.md) owns identity, Teams, guests, external collaborators and Customer Portal Users.
>
> **Depends on:** 01 (LOG-406) · 14 (LOG-403) · 17 (LOG-407) · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for channel lifecycle rules and system events · [19 Calendar](./19-calendar.md) (LOG-409) for calls and huddles.
>
> **Consumed by:** 05 Projects (§62 project channels), 06 Tasks (§7 task discussions), 07 Customer Portal (§6 project communication), 13 Support (§11 internal discussion of tickets), 02 CRM (§58 record conversations).

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (33)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Organization settings** | | | |
| `MessagingSettings` | `messaging_settings` | [L10813](../../api/prisma/schema.prisma#L10813) | 12 §13, §14, §43, §53, §80, §85, §94 — organization-wide messaging configuration (one row per organization). Global notification channels/DND/digest live in … |
| `MessagingRetentionPolicy` | `messaging_retention_policies` | [L10877](../../api/prisma/schema.prisma#L10877) | 12 §54 — message retention policy. Scope precedence: CHANNEL > CHANNEL_KIND > TEAM > BRANCH > ORGANIZATION. |
| `ChannelTemplate` | `channel_templates` | [L10911](../../api/prisma/schema.prisma#L10911) | 12 §93 — templates for recurring communication spaces (new project channel, customer onboarding). |
| **Channels** | | | |
| `Channel` | `channels` | [L10953](../../api/prisma/schema.prisma#L10953) | 12 §5–8, §25–29, §48 — every conversation: channels, DMs (DIRECT/GROUP_DIRECT), project and customer channels, announcement channels and record conversations… |
| `ChannelMember` | `channel_members` | [L11066](../../api/prisma/schema.prisma#L11066) | 12 §9, §27, §82–83 — a participant of a channel: an internal Member (membership_id) or an external participant (external_user_id — Customer Portal User 01 §7… |
| `ChannelNotificationSetting` | `channel_notification_settings` | [L11110](../../api/prisma/schema.prisma#L11110) | 12 §17, §79, §90 — per-channel / per-conversation notification settings layered on the global preferences of 14 §6 (DND, quiet hours and delivery channels ar… |
| `ChannelMemberRestriction` | `channel_member_restrictions` | [L11136](../../api/prisma/schema.prisma#L11136) | 12 §49–50 — moderation restrictions: mute or ban a participant in one channel (channel_id set) or across the whole organization (channel_id null). Target is … |
| **Messages** | | | |
| `Message` | `messages` | [L11167](../../api/prisma/schema.prisma#L11167) | 12 §10–13, §28, §29, §38, §75, §91 — the message. Thread replies set parent_message_id (root only, one level). Author is a Member, an external User, or an in… |
| `MessageVersion` | `message_versions` | [L11272](../../api/prisma/schema.prisma#L11272) | 12 §13 — edit history (previous bodies) when the organization preserves it. |
| `MessageReaction` | `message_reactions` | [L11289](../../api/prisma/schema.prisma#L11289) | 12 §14 — emoji reactions; one per (message, emoji, reactor). Reactor is a Member or an external user. |
| `MessageMention` | `message_mentions` | [L11309](../../api/prisma/schema.prisma#L11309) | 12 §15 — mentions extracted from a message; drives notifications (14) and mention counts (12 §19). |
| `MessageAttachment` | `message_attachments` | [L11339](../../api/prisma/schema.prisma#L11339) | 12 §22, §45 — link between a message and a Document (17). File bytes, versions and access permissions are owned by 17; metadata is denormalized here for list… |
| `MessageLinkPreview` | `message_link_previews` | [L11369](../../api/prisma/schema.prisma#L11369) | 12 §23 — unfurled link previews. Internal application links resolve to a record (entity_type/entity_id) and are rendered with a permission check at view time. |
| `MessageRecordShare` | `message_record_shares` | [L11394](../../api/prisma/schema.prisma#L11394) | 12 §24, §58–60 — a business record shared into a conversation with a preview snapshot. Record access is re-checked when rendered; the snapshot is only a disp… |
| `MessageAcknowledgement` | `message_acknowledgements` | [L11414](../../api/prisma/schema.prisma#L11414) | 12 §29 — acknowledgement of an announcement that requires it. |
| **Read state, threads, personal items** | | | |
| `ChannelReadState` | `channel_read_states` | [L11431](../../api/prisma/schema.prisma#L11431) | 12 §19, §43 — per-participant read position in a channel (unread state for channels, read state for DMs). Participant is a Member or an external user (id only). |
| `MessageReadReceipt` | `message_read_receipts` | [L11457](../../api/prisma/schema.prisma#L11457) | 12 §43 — per-message read receipts for DMs, group conversations and (when configured) customer conversations. |
| `MessageThreadFollower` | `message_thread_followers` | [L11473](../../api/prisma/schema.prisma#L11473) | 12 §12, §88 — members following a thread (root message) without subscribing to the channel. |
| `ChannelPin` | `channel_pins` | [L11493](../../api/prisma/schema.prisma#L11493) | 12 §47 — pinned messages per channel. |
| `SavedMessage` | `saved_messages` | [L11511](../../api/prisma/schema.prisma#L11511) | 12 §20 — personal saved/bookmarked messages with an optional note. |
| `MessageReminder` | `message_reminders` | [L11528](../../api/prisma/schema.prisma#L11528) | 12 §20–21 — "remind me" on a message; triggers a notification (14) linking back to the message. |
| `MessageDraft` | `message_drafts` | [L11556](../../api/prisma/schema.prisma#L11556) | 12 §46, §74 — unsent messages, private to the author, one per channel (+ thread) per author. |
| `MessagingKeyword` | `messaging_keywords` | [L11581](../../api/prisma/schema.prisma#L11581) | 12 §32, §79 — keyword subscriptions; matches in authorized conversations notify the member (14). |
| `ChannelSection` | `channel_sections` | [L11604](../../api/prisma/schema.prisma#L11604) | 12 §33, §72 — a member's custom sidebar sections (My Projects, Sales, …). Built-in groups (favorites, DMs, channels, projects, customers, archived, unread) a… |
| `ChannelSectionItem` | `channel_section_items` | [L11625](../../api/prisma/schema.prisma#L11625) | 12 §33 — a channel placed in a member's custom section. |
| **Presence & member settings** | | | |
| `MessagingPresence` | `messaging_presence` | [L11643](../../api/prisma/schema.prisma#L11643) | 12 §4, §41 — presence and custom status, one row per Member. Visibility follows organization privacy settings (messaging_settings.presence_visibility) and th… |
| `MessagingMemberSettings` | `messaging_member_settings` | [L11673](../../api/prisma/schema.prisma#L11673) | 12 §17, §43, §53, §73, §87 — messaging-specific per-member defaults. Global notification preferences, DND and digests are 14 §6 (NotificationPreference); onl… |
| **Moderation** | | | |
| `MessageReport` | `message_reports` | [L11701](../../api/prisma/schema.prisma#L11701) | 12 §49–50, §64, §69 — a message reported by a participant or flagged by spam detection. |
| **Retention & export** | | | |
| `MessagingExportJob` | `messaging_export_jobs` | [L11733](../../api/prisma/schema.prisma#L11733) | 12 §55, §106 — administrator export of messaging data; the produced file is a Document (17). |
| **Integrations, bots & webhooks** | | | |
| `MessagingIntegration` | `messaging_integrations` | [L11766](../../api/prisma/schema.prisma#L11766) | 12 §37–38, §50, §61, §92 — an integration or bot allowed to post into channels. Inbound webhook integrations authenticate with a hashed token; provider integ… |
| **Calls** | | | |
| `ChannelCall` | `channel_calls` | [L11812](../../api/prisma/schema.prisma#L11812) | 12 §5, §44 — voice/video calls and huddles started from a conversation. Media is provided by an external provider or 19 Calendar meeting links; messaging kee… |
| `ChannelCallParticipant` | `channel_call_participants` | [L11851](../../api/prisma/schema.prisma#L11851) | 12 §44 — call participants (Members or external users). |
| **Analytics** | | | |
| `MessagingUsageDaily` | `messaging_usage_daily` | [L11876](../../api/prisma/schema.prisma#L11876) | 12 §66, §104 — daily usage aggregates per organization (channel_id null) and per channel. Usage-oriented, never per-employee productivity scoring. |

**Owned enums (28):** `ChannelKind`, `ChannelVisibility`, `ChannelStatus`, `ChannelPostingPolicy`, `ChannelMemberRole`, `ChannelMembershipSource`, `ChannelGuestKind`, `ChannelNotificationLevel`, `ChannelDigestFrequency`, `MessageKind`, `MessageVisibility`, `MessageDeliveryStatus`, `MessageMentionKind`, `MessageAttachmentKind`, `MessageLinkPreviewStatus`, `MessagingPresenceState`, `MessageReminderStatus`, `MessagingRetentionScope`, `MessagingRetentionAction`, `MessagingExportStatus`, `MessagingExportFormat`, `MessageReportStatus`, `ChannelRestrictionKind`, `MessagingIntegrationKind`, `MessagingIntegrationStatus`, `ChannelCallKind`, `ChannelCallStatus`, `ChannelTemplateTrigger`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Channel.branch`, `MessagingRetentionPolicy.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Channel.created_by`, `Channel.owner`, `ChannelCall.started_by`, `ChannelCallParticipant.membership` +19 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `Channel.organization`, `ChannelCall.organization`, `ChannelMemberRestriction.organization`, `ChannelSection.organization` +11 more |
| [01](./01-users-organizations-permissions.md) | `Role` (`roles`) | `MessageMention.role` |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `Channel.team`, `MessageMention.team`, `MessagingRetentionPolicy.team` |
| [01](./01-users-organizations-permissions.md) | `User` (`users`) | `ChannelMember.external_user`, `Message.author_user` |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `Channel.company` |
| [05](./05-project-management.md) | `Project` (`projects`) | `Channel.project` |

**Reused enums:** `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `Membership`, `Organization`
- [05](./05-project-management.md): `Project`, `ProjectDecision`
- [20](./20-automation-engine.md): `OutboundWebhook`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `Project.channel_id` ([05](./05-project-management.md), [L4323](../../api/prisma/schema.prisma#L4323)) — Messaging project channel (12 §26); id only.
- `ProjectDecision.source_message_id` ([05](./05-project-management.md), [L4764](../../api/prisma/schema.prisma#L4764)) — Source message permalink (12 §63) when converted from a conversation.
- `Ticket.channel_id` ([13](./13-customer-support-communication-hub.md), [L12546](../../api/prisma/schema.prisma#L12546)) — Messaging thread for internal discussion (12 §60); id only.
- `NotificationRecipientSettings.show_previews` ([14](./14-notifications-activity-center.md), [L13666](../../api/prisma/schema.prisma#L13666)) — 14 §6, §11 — whether push / desktop / email previews include message content (12 §87).
- `NotificationPreference.enabled` ([14](./14-notifications-activity-center.md), [L13723](../../api/prisma/schema.prisma#L13723)) — false = muted for this scope / channel (14 §6 per-record mute, 12 §17 per-channel settings).
- `NotificationPreference.level` ([14](./14-notifications-activity-center.md), [L13723](../../api/prisma/schema.prisma#L13723)) — Record / module scope: all / important only / mentions and direct only / none (12 §17).
- `NotificationKeyword.disabled_until` ([14](./14-notifications-activity-center.md), [L13765](../../api/prisma/schema.prisma#L13765)) — 12 §32 — "disable temporarily".
- `OutboundWebhook.channel_id` ([20](./20-automation-engine.md), [L18714](../../api/prisma/schema.prisma#L18714)) — 12 §40 — only messaging events from this channel; null = all channels the endpoint may see.
- `OutboundWebhook.include_direct_messages` ([20](./20-automation-engine.md), [L18714](../../api/prisma/schema.prisma#L18714)) — 12 §40, §53 — direct-message events are excluded unless explicitly enabled.

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 15 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `messaging.audit` | read* |
| `messaging.channel_members` | manage |
| `messaging.channels` | manage, read, create |
| `messaging.data` | export* |
| `messaging.external_users` | manage* |
| `messaging.integrations` | manage* |
| `messaging.messages` | delete_any*, read, post, pin |
| `messaging.retention` | manage* |
| `messaging.settings` | manage* |
| `messaging.users` | manage |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Overview

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Build a first-class internal messaging and collaboration system comparable to Slack, designed as a core module of the Agency Operating System.

The messaging module provides real-time communication between employees, teams, project members, customers where explicitly enabled, and other authorized users.

The system should support both persistent team communication and contextual communication attached to business records such as projects, tasks, deals, customers, proposals, contracts, and support tickets.

The messaging system must be independent from the CRM's marketing/campaign functionality and from the separate email/SMS communications module.

### Primary goals

* Replace fragmented internal communication across chat applications.
* Provide organized communication instead of one large message stream.
* Connect conversations directly to agency work.
* Make project and business context available without requiring users to search multiple systems.
* Support fast real-time communication while preserving searchable history.
* Provide strong permissions, notifications, moderation, retention, and audit capabilities.
* Support extensibility for future integrations and external communication channels.

---

## 2. Messaging Architecture

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `expires_at` · enum `ChannelKind` ([L10557](../../api/prisma/schema.prisma#L10557))
<!-- schema-section:end -->

The messaging system should contain several communication primitives:

* Direct messages
* Group direct messages
* Public channels
* Private channels
* Project channels
* Customer channels
* Announcement channels
* Temporary/group conversations
* Threaded discussions
* Contextual comments attached to business records

A user should be able to move from a message to the related project, customer, task, deal, ticket, proposal, contract, or other record.

### Core hierarchy

**Organization → Team → Channel → Message → Thread → Attachments/Reactions/Mentions/Links**

Direct messaging exists alongside the channel hierarchy.

---

## 3. Organizations & Teams

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `team_id`
<!-- schema-section:end -->

> Defined by → [01](./01-users-organizations-permissions.md) §8 (Organization), §16 (Branch), §40 (Team) · Linear LOG-406.

The messaging system operates within an Organization. Channels can be scoped to a Team or Branch. There is no separate "workspace" concept; where earlier drafts said workspace, read Organization or Team.

## 4. Users & Presence

<!-- schema-section:start -->
> **Schema:** `MessagingPresence` ([messaging_presence](../../api/prisma/schema.prisma#L11643)): `status_expires_at`, `status_text` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `presence_visibility` · enum `MessagingPresenceState` ([L10698](../../api/prisma/schema.prisma#L10698))
<!-- schema-section:end -->

The messaging identity is the Member (01 §24). Employee profile data stays in 10; messaging only adds presence and status.

### Presence states

* Active
* Away
* Do Not Disturb
* Offline
* Custom status

### Custom status

Users can configure:

* Status text
* Optional emoji/icon
* Expiration
* Start/end date
* Automatic expiration

Examples:

* In a meeting
* Working remotely
* On vacation
* Focusing
* Out of office

Presence should be visible according to organization privacy settings.

---

## 5. Direct Messages

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `dm_key` · `ChannelCall` ([channel_calls](../../api/prisma/schema.prisma#L11812)) · enum `ChannelKind` ([L10557](../../api/prisma/schema.prisma#L10557))
<!-- schema-section:end -->

Users can communicate privately through direct messages.

### Supported types

* One-to-one DM
* Group DM
* Multi-person conversation

### DM functionality

* Send messages
* Edit messages
* Delete messages subject to policy
* Reply in threads
* React
* Mention users
* Attach files
* Share links
* Search conversation
* Pin messages
* Save/bookmark messages
* Mark unread
* Add reminders
* Start huddle/call if supported
* View participants
* Leave group DM where applicable

### DM history

Messages remain available according to organization retention policies.

---

## 6. Channels

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)) · enum `ChannelKind` ([L10557](../../api/prisma/schema.prisma#L10557)) · enum `ChannelStatus` ([L10575](../../api/prisma/schema.prisma#L10575))
<!-- schema-section:end -->

Channels are persistent spaces for team communication.

### Channel types

#### Public channel

Visible and discoverable by all authorized Members of the Organization (or Team/Branch scope).

#### Private channel

Visible only to explicitly invited members.

#### Project channel

Automatically associated with a project.

#### Customer channel

Associated with a specific customer and optionally accessible by external customer users.

#### Announcement channel

Restricted posting permissions for controlled company-wide communication.

#### Archived channel

Read-only or restricted channel preserved for historical access.

---

## 7. Channel Properties

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `company_id`, `external_access_enabled`, `name`, `project_id`, `slug`, `team_id` · enum `ChannelPostingPolicy` ([L10582](../../api/prisma/schema.prisma#L10582)) · enum `ChannelVisibility` ([L10569](../../api/prisma/schema.prisma#L10569))
<!-- schema-section:end -->

Each channel should support:

* Channel name
* Unique identifier
* Display name
* Description
* Purpose
* Channel type
* Visibility
* Owner
* Admins
* Members
* Created date
* Created by
* Associated project
* Associated customer
* Associated team
* Associated business record
* Topic
* Icon/avatar
* Notification defaults
* Posting permissions
* Retention policy
* Archive status
* External access status
* Custom fields where appropriate

---

## 8. Channel Lifecycle

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)) · enum `ChannelStatus` ([L10575](../../api/prisma/schema.prisma#L10575))
<!-- schema-section:end -->

Channels should support:

* Create
* Rename
* Configure
* Invite members
* Remove members
* Leave
* Archive
* Unarchive
* Delete where permitted
* Convert channel type where permitted

Archived channels should preserve historical messages and files while preventing normal new activity.

---

## 9. Channel Membership

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `auto_join`, `membership_rules` · `ChannelMember` ([channel_members](../../api/prisma/schema.prisma#L11066)) · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `default_channel_ids` · enum `ChannelMemberRole` ([L10590](../../api/prisma/schema.prisma#L10590)) · enum `ChannelMembershipSource` ([L10600](../../api/prisma/schema.prisma#L10600))
<!-- schema-section:end -->

Channel membership should support:

* Manual invitation
* Team-based membership
* Role-based membership
* Project-based automatic membership
* Customer-based membership
* Optional automatic membership for organization-wide channels

### Membership roles

* Owner
* Admin
* Member
* Guest
* External participant
* Read-only participant

Membership changes should be recorded in channel history.

---

## 10. Messages

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `metadata` · enum `MessageKind` ([L10639](../../api/prisma/schema.prisma#L10639))
<!-- schema-section:end -->

Messages are the fundamental communication unit.

### Message properties

* Message ID
* Channel/conversation ID
* Sender
* Message content
* Created timestamp
* Updated timestamp
* Edited timestamp
* Thread relationship
* Reply count
* Attachments
* Reactions
* Mentions
* Links
* Shared records
* Saved/bookmarked state
* Pin state
* Deleted state
* Metadata
* Message version/history where required

---

## 11. Message Composer

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `body`, `forwarded_from_message_id`, `quoted_message_id`, `scheduled_for` · `MessageDraft` ([message_drafts](../../api/prisma/schema.prisma#L11556)): `scheduled_for` · `MessagingMemberSettings` ([messaging_member_settings](../../api/prisma/schema.prisma#L11673)): `composer_preferences`
<!-- schema-section:end -->

The composer should provide a rich messaging experience.

### Supported capabilities

* Plain text
* Rich text
* Markdown
* Bold
* Italic
* Strikethrough
* Inline code
* Code blocks
* Block quotes
* Bulleted lists
* Numbered lists
* Links
* Mentions
* Channel mentions
* Emoji
* Reactions
* Attachments
* Record links
* Message previews
* Drag-and-drop files
* Paste images
* Voice messages if enabled

### Composer actions

* Send
* Schedule message
* Save draft
* Cancel
* Edit
* Reply
* Quote
* Forward/share where permitted

---

## 12. Threads

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `parent_message_id` · `MessageThreadFollower` ([message_thread_followers](../../api/prisma/schema.prisma#L11473))
<!-- schema-section:end -->

Threads provide focused discussions underneath a parent message.

### Thread functionality

* Start thread
* Reply
* Mention users
* Attach files
* React
* Quote
* Mark unread
* Follow/unfollow thread
* Subscribe/unsubscribe
* View participants
* View reply count

Users should be able to follow a thread without receiving all channel activity.

---

## 13. Message Editing & Deletion

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `delete_reason`, `is_edited` · `MessageVersion` ([message_versions](../../api/prisma/schema.prisma#L11272)) · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `allow_delete_own_messages`, `delete_own_time_limit_minutes`, `edit_time_limit_minutes`, `preserve_edit_history` · enum `MessageDeliveryStatus` ([L10653](../../api/prisma/schema.prisma#L10653))
<!-- schema-section:end -->

Users should be able to edit messages according to permissions.

### Editing

* Edit own message
* Record edited timestamp
* Optionally preserve edit history
* Display edited indicator

### Deletion

Organizations should configure whether users can:

* Delete own messages
* Delete messages within a time limit
* Delete messages at any time
* Allow admins to delete messages

Deleted messages should follow organization retention and audit rules.

---

## 14. Message Reactions

<!-- schema-section:start -->
> **Schema:** `MessageReaction` ([message_reactions](../../api/prisma/schema.prisma#L11289)) · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `allowed_reactions`
<!-- schema-section:end -->

Users should be able to react to messages.

### Features

* Emoji reactions
* Multiple reactions
* Reaction counts
* Add/remove own reaction
* View users who reacted

Organizations may define allowed reaction sets.

---

## 15. Mentions

<!-- schema-section:start -->
> **Schema:** `MessageMention` ([message_mentions](../../api/prisma/schema.prisma#L11309)) · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `broadcast_mention_policy` · enum `MessageMentionKind` ([L10665](../../api/prisma/schema.prisma#L10665))
<!-- schema-section:end -->

Messaging should support contextual mentions.

### Mention types

* Individual user
* Team
* Channel
* Organization-wide mention
* Group/role mention

Examples:

* @Petros
* @Developers
* @Sales
* @channel
* @everyone

Mentions should trigger notifications according to recipient notification preferences and channel rules.

---

## 16. Notifications

<!-- schema-section:start -->
> **Schema:** other modules: `Notification` ([notifications](../../api/prisma/schema.prisma#L13426)) ([14](./14-notifications-activity-center.md))
<!-- schema-section:end -->

> Engine defined by → [14 Notifications & Activity Center](./14-notifications-activity-center.md) · Linear LOG-403. Messaging emits the events below; 14 owns channels, global preferences, inbox and delivery. Sections 17–18 describe only the messaging-specific settings layered on top of 14.

### Notification events emitted

* Direct message
* Mention
* Thread reply
* Reaction
* New channel message
* Channel invitation
* Added to group DM
* Message reminder
* Pinned message
* Shared record update
* Customer message
* Announcement

Channels (in-app, desktop, browser, push, email) are provided by 14 §5.

---

## 17. Notification Preferences

<!-- schema-section:start -->
> **Schema:** `ChannelMember` ([channel_members](../../api/prisma/schema.prisma#L11066)): `muted_until` · `ChannelNotificationSetting` ([channel_notification_settings](../../api/prisma/schema.prisma#L11110)): `schedule` · `MessagingMemberSettings` ([messaging_member_settings](../../api/prisma/schema.prisma#L11673)) · enum `ChannelNotificationLevel` ([L10622](../../api/prisma/schema.prisma#L10622)) — other modules: `NotificationPreference` ([notification_preferences](../../api/prisma/schema.prisma#L13723)): `enabled` ([14](./14-notifications-activity-center.md)) · `NotificationRecipientSettings` ([notification_recipient_settings](../../api/prisma/schema.prisma#L13666)) ([14](./14-notifications-activity-center.md)) · enum `NotificationLevel` ([L13211](../../api/prisma/schema.prisma#L13211)) ([14](./14-notifications-activity-center.md))
<!-- schema-section:end -->

Global preferences, Do Not Disturb and digest settings live in 14 §6. Messaging adds **per-channel and per-conversation** settings:

### Preferences

* All messages
* Mentions and direct messages
* Only direct messages
* Nothing
* Custom per-channel settings

Additional settings:

* Thread notifications
* Reaction notifications
* Keyword notifications
* Desktop notifications
* Mobile notifications
* Email notifications
* Sound
* Notification schedule
* Do Not Disturb schedule

---

## 18. Notification Inbox

<!-- schema-section:start -->
> **Schema:** other modules: `Notification` ([notifications](../../api/prisma/schema.prisma#L13426)) ([14](./14-notifications-activity-center.md)) · enum `NotificationCategory` ([L13181](../../api/prisma/schema.prisma#L13181)) ([14](./14-notifications-activity-center.md))
<!-- schema-section:end -->

The inbox is the Activity Center of 14 §7. Messaging contributes these categories and actions to it rather than building a separate inbox:

### Categories

* Mentions
* Replies
* Direct messages
* Reactions
* Channel activity
* Invitations
* Reminders
* Shared record events

### Actions

* Mark read
* Mark unread
* Mark all read
* Open source message
* Filter
* Search
* Clear notification

---

## 19. Unread Management

<!-- schema-section:start -->
> **Schema:** `ChannelReadState` ([channel_read_states](../../api/prisma/schema.prisma#L11431)): `marked_unread_from_id` · `MessageMention` ([message_mentions](../../api/prisma/schema.prisma#L11309))
<!-- schema-section:end -->

Users should be able to manage unread content.

### Features

* Unread message indicators
* Unread channel count
* Unread DM count
* Mention count
* Mark channel read
* Mark conversation read
* Mark message unread
* Jump to first unread
* Global unread inbox

---

## 20. Saved Messages & Bookmarks

<!-- schema-section:start -->
> **Schema:** `MessageReminder` ([message_reminders](../../api/prisma/schema.prisma#L11528)) · `SavedMessage` ([saved_messages](../../api/prisma/schema.prisma#L11511))
<!-- schema-section:end -->

Users should be able to save important messages.

### Saved message features

* Save message
* Remove save
* Add personal reminder
* Add note
* Filter saved messages
* Search saved messages
* Open original conversation

Saved messages are personal unless explicitly shared.

---

## 21. Message Reminders

<!-- schema-section:start -->
> **Schema:** `MessageReminder` ([message_reminders](../../api/prisma/schema.prisma#L11528)) · enum `MessageReminderStatus` ([L10706](../../api/prisma/schema.prisma#L10706))
<!-- schema-section:end -->

Users should be able to create reminders from messages.

### Reminder options

* Later today
* Tomorrow
* Next week
* Custom date/time

When triggered, the user receives a notification linking back to the original message.

---

## 22. File & Attachment Sharing

<!-- schema-section:start -->
> **Schema:** `MessageAttachment` ([message_attachments](../../api/prisma/schema.prisma#L11339)): `preview` · enum `MessageAttachmentKind` ([L10676](../../api/prisma/schema.prisma#L10676))
<!-- schema-section:end -->

Messaging should support file sharing.

### Supported attachment types

* Images
* PDFs
* Documents
* Spreadsheets
* Presentations
* Videos
* Audio
* Archives
* Other configured file types

### Attachment metadata

* File name
* Type
* Size
* Uploader
* Upload date
* Associated message
* Associated conversation
* Preview
* Download/access permissions

Attachments are Documents owned by [17 Documents & File Management](./17-documents-file-management.md) (LOG-407), linked to the message and conversation. Vault entries (17 §12) cannot be attached; only a reference link is shared.

---

## 23. Link Sharing & Previews

<!-- schema-section:start -->
> **Schema:** `MessageLinkPreview` ([message_link_previews](../../api/prisma/schema.prisma#L11369)) · enum `MessageLinkPreviewStatus` ([L10690](../../api/prisma/schema.prisma#L10690))
<!-- schema-section:end -->

Messages containing URLs should support link previews.

### Preview data

* Title
* Description
* Image
* Domain
* URL

Internal application links should generate rich previews for:

* Projects
* Tasks
* Customers
* Contacts
* Deals
* Proposals
* Contracts
* Invoices
* Payments
* Tickets
* Documents

Users should not receive access to a record they are not authorized to view.

---

## 24. Business Record Sharing

<!-- schema-section:start -->
> **Schema:** `MessageRecordShare` ([message_record_shares](../../api/prisma/schema.prisma#L11394)): `snapshot`
<!-- schema-section:end -->

Messaging should be deeply connected to the Agency OS.

Users should be able to share records directly inside conversations.

### Supported records

* Project
* Task
* Milestone
* Customer
* Contact
* Lead
* Deal
* Proposal
* Contract
* Invoice
* Payment
* Support ticket
* Employee
* Document

### Shared record preview

A shared record should display:

* Record name
* Type
* Status
* Owner
* Relevant summary
* Key metadata
* Open record action

---

## 25. Contextual Messaging

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)) · enum `ChannelKind` ([L10557](../../api/prisma/schema.prisma#L10557))
<!-- schema-section:end -->

Business records should optionally contain a dedicated conversation area.

Examples:

* Project discussion
* Task discussion
* Deal discussion
* Customer discussion
* Support ticket discussion
* Proposal discussion

### Requirements

* Conversation history linked to the record
* Record members inherit access according to permissions
* Messages remain searchable
* Record activity can surface relevant messages
* Notifications follow normal messaging rules

---

## 26. Project Channels

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `project_id` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `auto_create_project_channels` — other modules: `Project` ([projects](../../api/prisma/schema.prisma#L4323)): `channel_id` ([05](./05-project-management.md))
<!-- schema-section:end -->

Projects should be able to create a dedicated communication channel.

When a project is created, the system may optionally create:

`#project-project-name`

The channel can automatically include:

* Project manager
* Assigned employees
* Project stakeholders

Customers should not automatically gain access unless explicitly configured.

### Project channel content

* Project discussions
* Decisions
* Status updates
* File sharing
* Task links
* Milestone discussions
* Meeting notes
* Change requests
* Project announcements

---

## 27. Customer / External Messaging

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `company_id`, `external_access_enabled` · `ChannelMember` ([channel_members](../../api/prisma/schema.prisma#L11066)) · `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `author_user_id` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `external_access_enabled`
<!-- schema-section:end -->

The system should optionally support external participants.

This allows customers to participate in selected conversations without accessing internal channels.

Ownership rule for customer communication:

* **Project collaboration** (ongoing discussion about a project with the customer) is a Messaging project customer channel, shown in 07 Customer Portal §6.
* **Support** (questions, problems, requests) is a Support conversation and Ticket in 13, including live chat and inbound email. Messaging does not implement a support inbox.
* External participants are Customer Portal Users (01 §79) or guests/external collaborators (01 §77–78); Messaging does not create its own external identities.

### External participant capabilities

* Secure login
* Access assigned customer channels
* Send messages
* Reply to threads
* Upload permitted files
* View permitted shared records
* Receive notifications
* Leave conversation

### External participant restrictions

External users must not automatically see:

* Internal channels
* Internal notes
* Private employee discussions
* Internal CRM information
* Financial records
* Employee information
* Other customers

---

## 28. Internal vs External Messages

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)) · `Message` ([messages](../../api/prisma/schema.prisma#L11167)) · enum `MessageVisibility` ([L10647](../../api/prisma/schema.prisma#L10647))
<!-- schema-section:end -->

Customer-facing channels should clearly distinguish:

* Internal messages
* External messages

The UI should make external visibility obvious before sending.

The system should prevent accidental posting of internal content into customer-facing conversations through clear permission boundaries and confirmation where appropriate.

---

## 29. Announcements

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `require_acknowledgement` · `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `is_announcement` · `MessageAcknowledgement` ([message_acknowledgements](../../api/prisma/schema.prisma#L11414)) · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `announcement_policy` · enum `ChannelPostingPolicy` ([L10582](../../api/prisma/schema.prisma#L10582))
<!-- schema-section:end -->

Organizations should be able to create announcement channels.

### Functionality

* Restricted posting
* Organization-wide visibility
* Important message styling
* Optional acknowledgement
* Pinning
* Scheduled announcements
* Read tracking where configured

Potential uses:

* Company announcements
* Policy changes
* Product releases
* Holiday notices
* Operational updates

---

## 30. Search

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `body_plain`, `has_attachments`, `search_vector`
<!-- schema-section:end -->

Messaging requires powerful global search.

### Search scope

* Messages
* Channels
* DMs
* Threads
* Attachments
* Shared records
* Users

### Search filters

* Sender
* Channel
* Conversation
* Date
* Message type
* Has attachment
* Has link
* Has reaction
* Mentioned user
* Record type
* Keyword
* Exact phrase

Selecting a result should open the conversation at the exact message.

---

## 31. Global Search Integration

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Messaging search should integrate with the Agency OS global search.

A global search may return:

* CRM records
* Projects
* Tasks
* Documents
* Contracts
* Proposals
* Invoices
* Support tickets
* Messages
* Channels
* Employees

All results must respect permissions.

---

## 32. Keywords & Custom Notifications

<!-- schema-section:start -->
> **Schema:** `MessagingKeyword` ([messaging_keywords](../../api/prisma/schema.prisma#L11581)): `is_enabled` — other modules: `NotificationKeyword` ([notification_keywords](../../api/prisma/schema.prisma#L13765)): `disabled_until` ([14](./14-notifications-activity-center.md))
<!-- schema-section:end -->

Users should optionally subscribe to specific keywords.

Users should be able to:

* Create keyword
* Edit keyword
* Delete keyword
* Disable temporarily

When the term appears in an authorized conversation, the user receives a notification.

---

## 33. Channel Organization

<!-- schema-section:start -->
> **Schema:** `ChannelMember` ([channel_members](../../api/prisma/schema.prisma#L11066)): `is_favorite` · `ChannelSection` ([channel_sections](../../api/prisma/schema.prisma#L11604)) · `ChannelSectionItem` ([channel_section_items](../../api/prisma/schema.prisma#L11625)) · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `default_sections`
<!-- schema-section:end -->

Users should be able to organize channels.

### Features

* Favorites
* Custom sections
* Recently viewed
* Unread
* Direct messages
* Channels
* Projects
* Customer channels
* Archived

### Custom channel sections

Users may create sections such as:

* My Projects
* Sales
* Management
* Important Customers
* Internal

---

## 34. Channel Discovery

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `member_count` · enum `ChannelVisibility` ([L10569](../../api/prisma/schema.prisma#L10569))
<!-- schema-section:end -->

Users should be able to discover authorized channels.

### Discovery options

* Browse channels
* Search channels
* Filter by department
* Filter by project
* Filter by topic
* View member count
* View channel description
* Join public channels where allowed

Private channels should not expose sensitive metadata to unauthorized users.

---

## 35. Message Formatting

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `body`
<!-- schema-section:end -->

The messaging editor should support rich formatting without becoming unnecessarily complex.

### Formatting

* Bold
* Italic
* Strikethrough
* Inline code
* Code blocks
* Lists
* Quotes
* Links
* Headings where supported
* Tables where supported
* Emoji

Keyboard shortcuts should be supported for common actions.

---

## 37. Integrations

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `settings` · `MessagingIntegration` ([messaging_integrations](../../api/prisma/schema.prisma#L11766)) · enum `MessagingIntegrationKind` ([L10762](../../api/prisma/schema.prisma#L10762)) · enum `MessagingIntegrationStatus` ([L10779](../../api/prisma/schema.prisma#L10779)) — other modules: enum `NotificationChannel` ([L13164](../../api/prisma/schema.prisma#L13164)) ([14](./14-notifications-activity-center.md))
<!-- schema-section:end -->

The messaging system should support integrations with the rest of the Agency OS and external tools.

### Internal integrations

* CRM
* Projects
* Tasks
* Customers
* Proposals
* Contracts
* Finance
* Support
* Employees
* Documents
* Calendar

### External integrations

Potential integrations:

* GitHub
* GitLab
* Jira
* Linear
* Google Drive
* Notion
* Microsoft 365
* Google Workspace
* Slack
* Discord
* Webhooks
* Custom API integrations

External integrations should be implemented as controlled event/message sources rather than tightly coupling the messaging core to a single provider.

---

## 38. Integration Messages

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `integration_id`, `integration_source` · `MessagingIntegration` ([messaging_integrations](../../api/prisma/schema.prisma#L11766)): `bot_display_name` · enum `MessageKind` ([L10639](../../api/prisma/schema.prisma#L10639)) · enum `MessagingIntegrationKind` ([L10762](../../api/prisma/schema.prisma#L10762))
<!-- schema-section:end -->

External systems may create messages or notifications inside designated channels.

Examples:

* New GitHub pull request
* Pull request merged
* Deployment failed
* Customer ticket created
* Payment failed
* Proposal accepted
* Contract signed
* New lead created

Integration messages should clearly indicate their external source.

---

## 39. Webhooks & API

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `client_message_id` — other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L18714)) ([20](./20-automation-engine.md))
<!-- schema-section:end -->

Messaging must expose an extensible API.

### Core API capabilities

* Create conversation
* Retrieve conversation
* List conversations
* Add/remove members
* Send message
* Edit message
* Delete message
* Retrieve message
* Search messages
* Create thread
* Reply to thread
* Add reaction
* Remove reaction
* Upload attachment
* Create channel
* Update channel
* Archive channel
* Manage channel membership
* Read notification state
* Create reminders

### API principles

* Stable resource IDs
* Predictable resource relationships
* Authentication and authorization
* Idempotent write operations where appropriate
* Pagination
* Filtering
* Rate limiting
* Versioning strategy
* Auditability

---

## 40. Messaging Webhooks

<!-- schema-section:start -->
> **Schema:** other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L18714)): `channel_id`, `include_direct_messages` ([20](./20-automation-engine.md))
<!-- schema-section:end -->

Support events such as:

* `message.created`
* `message.updated`
* `message.deleted`
* `message.reaction_added`
* `message.reaction_removed`
* `thread.created`
* `thread.reply_created`
* `channel.created`
* `channel.updated`
* `channel.archived`
* `member.added`
* `member.removed`
* `mention.created`
* `attachment.created`
* `external_user.added`

Webhook delivery should support retries, signatures, event IDs, and idempotency.

---

## 41. Real-Time Communication

<!-- schema-section:start -->
> **Schema:** `MessagingMemberSettings` ([messaging_member_settings](../../api/prisma/schema.prisma#L11673)): `share_typing_indicator` · `MessagingPresence` ([messaging_presence](../../api/prisma/schema.prisma#L11643))
<!-- schema-section:end -->

Messaging should be real-time.

### Real-time requirements

* New messages appear without page refresh
* Typing indicators
* Presence updates
* Read state updates
* Reaction updates
* Thread updates
* Channel membership updates
* Notification updates

### Connection handling

The client should gracefully handle:

* Network interruptions
* Reconnection
* Duplicate events
* Missed events
* Offline state
* Connection recovery

Messages should not be lost because of temporary connectivity issues.

---

## 42. Typing Indicators

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Support typing indicators for:

* DMs
* Group DMs
* Channels
* Threads

Typing indicators should be ephemeral and should not be stored as permanent message records.

---

## 43. Read Receipts

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `read_receipts_enabled` · `ChannelReadState` ([channel_read_states](../../api/prisma/schema.prisma#L11431)) · `MessageReadReceipt` ([message_read_receipts](../../api/prisma/schema.prisma#L11457)) · `MessagingMemberSettings` ([messaging_member_settings](../../api/prisma/schema.prisma#L11673)): `share_read_receipts` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `read_receipts_direct`
<!-- schema-section:end -->

Read receipts may be enabled depending on conversation type.

### Possible behavior

* DMs: read state
* Group conversations: read state
* Channels: unread state rather than per-user message receipts
* Customer conversations: configurable

Organizations should be able to configure privacy settings.

---

## 44. Voice & Video Communication

<!-- schema-section:start -->
> **Schema:** `ChannelCall` ([channel_calls](../../api/prisma/schema.prisma#L11812)) · `ChannelCallParticipant` ([channel_call_participants](../../api/prisma/schema.prisma#L11851)) · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `calls_enabled` · enum `ChannelCallKind` ([L10786](../../api/prisma/schema.prisma#L10786)) · enum `ChannelCallStatus` ([L10793](../../api/prisma/schema.prisma#L10793))
<!-- schema-section:end -->

Messaging should provide an extensible foundation for calls.

### Optional functionality

* Start voice call
* Start video call
* Screen sharing
* Group calls
* Meeting links
* Call history
* Call participants

Calls may integrate with external providers rather than requiring the messaging system to implement a complete video infrastructure.

---

## 45. Audio / Voice Messages

<!-- schema-section:start -->
> **Schema:** `MessageAttachment` ([message_attachments](../../api/prisma/schema.prisma#L11339)): `duration_seconds` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `voice_messages_enabled` · enum `MessageAttachmentKind` ([L10676](../../api/prisma/schema.prisma#L10676)) · enum `MessageKind` ([L10639](../../api/prisma/schema.prisma#L10639))
<!-- schema-section:end -->

Optional support for short audio messages.

### Features

* Record
* Preview
* Send
* Playback
* Pause/resume
* Duration
* Download where permitted

Audio messages should follow the same retention and permission rules as other attachments.

---

## 46. Drafts

<!-- schema-section:start -->
> **Schema:** `MessageDraft` ([message_drafts](../../api/prisma/schema.prisma#L11556))
<!-- schema-section:end -->

Users should be able to save unsent messages.

### Draft properties

* Conversation
* User
* Content
* Attachments
* Created time
* Updated time

Drafts are private to the author and should persist across sessions.

---

## 47. Message Pinning

<!-- schema-section:start -->
> **Schema:** `ChannelPin` ([channel_pins](../../api/prisma/schema.prisma#L11493)) · `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `pinned_at`
<!-- schema-section:end -->

Authorized users should be able to pin important messages.

### Functionality

* Pin
* Unpin
* View pinned messages
* Pin notification
* Permission control

Pinned content may include:

* Announcements
* Project decisions
* Important links
* Procedures
* Meeting outcomes

---

## 48. Channel Topic & Description

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `topic`
<!-- schema-section:end -->

Channels should provide lightweight contextual information.

### Topic

Short current focus or status.

### Description

Longer explanation of channel purpose.

---

## 49. Channel Moderation

<!-- schema-section:start -->
> **Schema:** `ChannelMemberRestriction` ([channel_member_restrictions](../../api/prisma/schema.prisma#L11136)) · `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `delete_reason` · `MessageReport` ([message_reports](../../api/prisma/schema.prisma#L11701)) · enum `ChannelPostingPolicy` ([L10582](../../api/prisma/schema.prisma#L10582)) · enum `ChannelRestrictionKind` ([L10755](../../api/prisma/schema.prisma#L10755)) · enum `MessageReportStatus` ([L10747](../../api/prisma/schema.prisma#L10747))
<!-- schema-section:end -->

Channel owners/admins should have moderation controls.

### Controls

* Restrict posting
* Remove members
* Manage permissions
* Delete messages
* Pin messages
* Archive channel
* Change channel topic
* Change description
* Manage external access

Moderation actions should be auditable.

---

## 50. Organization Moderation

<!-- schema-section:start -->
> **Schema:** `ChannelMemberRestriction` ([channel_member_restrictions](../../api/prisma/schema.prisma#L11136)) · `MessageReport` ([message_reports](../../api/prisma/schema.prisma#L11701)) · `MessagingIntegration` ([messaging_integrations](../../api/prisma/schema.prisma#L11766)) · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `admin_private_message_access_enabled` · enum `ChannelRestrictionKind` ([L10755](../../api/prisma/schema.prisma#L10755)) · enum `MessagingIntegrationStatus` ([L10779](../../api/prisma/schema.prisma#L10779))
<!-- schema-section:end -->

Administrators should have organization-level controls.

### Administrative capabilities

* Search messages where policy permits
* Manage channels
* Manage users
* Remove users
* Manage retention
* Manage external access
* Manage file policies
* Manage integrations
* Review audit logs
* Configure moderation policies

Administrative access to private messages should be governed by explicit organizational policy and appropriate access controls.

---

## 51. Audit Log

<!-- schema-section:start -->
> **Schema:** other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L1572)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Messaging actions should generate audit events where appropriate.

### Audit events

* Channel created
* Channel archived
* Channel deleted
* Member added
* Member removed
* Message edited
* Message deleted
* Message pinned
* Message unpinned
* External user added
* Permission changed
* Retention policy changed
* Integration connected/disconnected
* Admin action performed

Audit logs should be immutable and accessible only to authorized administrators.

---

## 52. Security

<!-- schema-section:start -->
> **Schema:** other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L18714)) ([20](./20-automation-engine.md)) · `Permission` ([permissions](../../api/prisma/schema.prisma#L1226)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

> Authentication, authorization, RBAC, organization isolation and session management are defined by → [01](./01-users-organizations-permissions.md) · Linear LOG-406.

Messaging consumes the central authorization service and adds:

### Requirements

* Authentication
* Authorization
* Role-based access control
* Organization isolation
* Channel-level permissions
* Secure file access
* Encryption in transit
* Encryption at rest where supported
* Session management
* Rate limiting
* Abuse prevention
* Secure API authentication
* Webhook signature verification
* Access logging

Users must never be able to retrieve messages or attachments outside their authorization scope.

---

## 53. Privacy

<!-- schema-section:start -->
> **Schema:** `MessagingMemberSettings` ([messaging_member_settings](../../api/prisma/schema.prisma#L11673)): `share_read_receipts` · `MessagingPresence` ([messaging_presence](../../api/prisma/schema.prisma#L11643)): `presence_hidden` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `presence_visibility`, `read_receipts_direct` — other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L18714)): `include_direct_messages` ([20](./20-automation-engine.md))
<!-- schema-section:end -->

Privacy controls should include:

* Private channels
* Private DMs
* External participant restrictions
* Message retention settings
* Data export controls
* Administrative access controls
* User visibility controls
* Presence privacy
* Read receipt controls

The organization should clearly define how long messages and attachments are retained.

---

## 54. Retention Policies

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `retention_policy_id` · `MessagingRetentionPolicy` ([messaging_retention_policies](../../api/prisma/schema.prisma#L10877)): `applies_to_attachments` · enum `MessagingRetentionAction` ([L10724](../../api/prisma/schema.prisma#L10724)) · enum `MessagingRetentionScope` ([L10715](../../api/prisma/schema.prisma#L10715))
<!-- schema-section:end -->

Organizations should be able to configure message retention.

### Retention scopes

* Organization-wide
* Team or Branch
* Channel
* Conversation type

### Possible retention behavior

* Unlimited
* Fixed period
* Archive after period
* Delete after period

Retention policies should apply consistently to:

* Messages
* Threads
* Attachments
* Reactions
* Metadata where legally and technically appropriate

---

## 55. Data Export

<!-- schema-section:start -->
> **Schema:** `MessagingExportJob` ([messaging_export_jobs](../../api/prisma/schema.prisma#L11733)): `filters` · enum `MessagingExportFormat` ([L10740](../../api/prisma/schema.prisma#L10740)) · enum `MessagingExportStatus` ([L10731](../../api/prisma/schema.prisma#L10731))
<!-- schema-section:end -->

Authorized administrators should be able to export messaging data.

### Export options

* Organization
* Team or Branch
* Channel
* Date range
* Conversation type
* User

Export should preserve:

* Message content
* Sender
* Timestamp
* Threads
* Attachments metadata
* Reactions
* Channel information

Export permissions should be tightly controlled.

---

## 57. Customer Communication Boundaries

<!-- schema-section:start -->
> **Schema:** enum `MessageVisibility` ([L10647](../../api/prisma/schema.prisma#L10647))
<!-- schema-section:end -->

Customer-facing messaging must remain clearly separated from internal company communication.

The platform should support:

* Internal-only channels
* Customer-visible channels
* Customer-specific workspaces
* External users
* Customer permissions
* Customer-specific file access
* Internal-only threads where explicitly supported

The system should make visibility obvious in the interface.

---

## 58. Messaging & CRM Integration

<!-- schema-section:start -->
> **Schema:** `MessageRecordShare` ([message_record_shares](../../api/prisma/schema.prisma#L11394))
<!-- schema-section:end -->

Messaging should integrate with CRM without becoming a CRM replacement.

### CRM links

Messages may reference:

* Lead
* Contact
* Company
* Deal
* Customer

The CRM record may display relevant linked conversations.

CRM users should be able to navigate:

**CRM Record → Related Conversations**

Messaging users should be able to navigate:

**Message → Related CRM Record**

---

## 59. Messaging & Project Management Integration

<!-- schema-section:start -->
> **Schema:** `MessageRecordShare` ([message_record_shares](../../api/prisma/schema.prisma#L11394))
<!-- schema-section:end -->

Projects should be able to surface communication context.

### Integration

* Project → Project Channel
* Task → Task Discussion
* Milestone → Milestone Discussion
* Change Request → Change Request Discussion

The project interface should show recent relevant messages without duplicating the complete messaging experience.

---

## 60. Messaging & Support Integration

<!-- schema-section:start -->
> **Schema:** `MessageRecordShare` ([message_record_shares](../../api/prisma/schema.prisma#L11394)) — other modules: `Ticket` ([tickets](../../api/prisma/schema.prisma#L12546)): `channel_id` ([13](./13-customer-support-communication-hub.md))
<!-- schema-section:end -->

Support tickets may have linked conversations.

Example:

Customer creates support ticket → system creates or links support conversation → authorized internal support staff discuss the issue → customer sees only the customer-facing portion.

Internal support notes remain private.

---

## 61. Messaging & Finance Integration

<!-- schema-section:start -->
> **Schema:** `MessagingIntegration` ([messaging_integrations](../../api/prisma/schema.prisma#L11766))
<!-- schema-section:end -->

Financial events may optionally be posted to channels as system messages through a 20 Automation Engine rule ("post message to channel" action).

Examples:

* Invoice paid
* Payment failed
* Subscription canceled
* Refund processed

These should be system-generated events rather than manually written messages.

---

## 62. Messaging & Employee Management

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Employee records should link to messaging identity.

### Employee profile may show

* Messaging status
* Department
* Team
* Recent activity where authorized
* Joined channels
* Direct message action

Messaging permissions should remain independent from HR permissions.

---

## 63. Searchable Decision History

<!-- schema-section:start -->
> **Schema:** other modules: `ProjectDecision` ([project_decisions](../../api/prisma/schema.prisma#L4764)): `source_message_id` ([05](./05-project-management.md))
<!-- schema-section:end -->

The messaging system should preserve business context over time.

Users should be able to locate decisions through:

* Search
* Project channels
* Threads
* Pinned messages
* Record-linked conversations
* Saved messages

Important decisions may optionally be converted into structured records such as:

* Task
* Decision
* Note
* Project update
* Change request

This should be a user-controlled action.

---

## 64. Conversation Actions

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `forwarded_from_message_id` · `MessageReport` ([message_reports](../../api/prisma/schema.prisma#L11701)) · enum `MessageReportStatus` ([L10747](../../api/prisma/schema.prisma#L10747))
<!-- schema-section:end -->

Every message should expose contextual actions.

### Standard actions

* Reply
* React
* Edit
* Delete
* Copy
* Link to message
* Save
* Remind me
* Pin
* Share
* Forward where allowed
* Mark unread
* Open related record
* Report

---

## 65. Message Permalinks

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167))
<!-- schema-section:end -->

Every message should have a stable internal URL.

A user can:

* Copy message link
* Share link with authorized users
* Open exact message
* Use message URL in project/task records

Permission checks must occur when the URL is opened.

---

## 66. Reporting & Analytics

<!-- schema-section:start -->
> **Schema:** `MessagingUsageDaily` ([messaging_usage_daily](../../api/prisma/schema.prisma#L11876)): `avg_response_seconds`, `unread_snapshot`
<!-- schema-section:end -->

Provide organization-level messaging analytics without turning the module into employee surveillance.

### Metrics

* Active users
* Active channels
* Messages sent
* Messages by channel
* DMs
* Threads
* Average response time where appropriate
* Unread volume
* Most active channels
* External conversations
* File sharing volume

Metrics should focus on system usage and collaboration patterns rather than simplistic employee productivity scoring.

---

## 67. Admin Dashboard

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Administrators should have a messaging administration area.

### Dashboard sections

* Users
* Channels
* Guests
* External users
* Storage
* Retention
* Integrations
* Permissions
* Audit log
* Usage
* Security
* Moderation

---

## 69. Rate Limits & Abuse Prevention

<!-- schema-section:start -->
> **Schema:** `MessageReport` ([message_reports](../../api/prisma/schema.prisma#L11701)) · `MessagingIntegration` ([messaging_integrations](../../api/prisma/schema.prisma#L11766)): `rate_limit_per_minute` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `file_policy`, `rate_limits`
<!-- schema-section:end -->

The messaging API and UI should include protections against abuse.

### Controls

* Message rate limits
* File upload limits
* API rate limits
* Spam detection
* Repeated message protection
* Suspicious activity monitoring
* Integration rate limits

Administrators should receive alerts for significant abuse events.

---

## 71. Mobile & Responsive Experience

<!-- schema-section:start -->
> **Schema:** `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `voice_messages_enabled`
<!-- schema-section:end -->

Messaging should work effectively on:

* Desktop
* Tablet
* Mobile web
* Native mobile app if implemented

Mobile priorities:

* DMs
* Notifications
* Mentions
* Quick replies
* File/image sharing
* Search
* Channel switching
* Voice messages
* Push notifications

---

## 72. Desktop Experience

<!-- schema-section:start -->
> **Schema:** `ChannelSection` ([channel_sections](../../api/prisma/schema.prisma#L11604)) · `MessagingMemberSettings` ([messaging_member_settings](../../api/prisma/schema.prisma#L11673)): `sidebar_preferences`
<!-- schema-section:end -->

The desktop UI should support a Slack-like three-column workflow.

### Suggested layout

**Left sidebar**

* Organization
* Search
* Home
* DMs
* Channels
* Favorites
* Custom sections

**Center**

* Conversation
* Message history
* Composer

**Right panel**

* Thread
* Conversation details
* Members
* Shared files
* Pinned messages
* Related records

The interface should remain configurable and responsive.

---

## 73. Keyboard Shortcuts

<!-- schema-section:start -->
> **Schema:** `MessagingMemberSettings` ([messaging_member_settings](../../api/prisma/schema.prisma#L11673)): `keyboard_shortcuts`
<!-- schema-section:end -->

Support common shortcuts such as:

* New message
* Search
* Navigate channels
* Navigate DMs
* Jump to unread
* Open thread
* Mark read
* Send
* New line
* Focus composer

Shortcut configuration should avoid conflicts with browser and OS shortcuts.

---

## 74. Draft & Offline Behavior

<!-- schema-section:start -->
> **Schema:** `MessageDraft` ([message_drafts](../../api/prisma/schema.prisma#L11556))
<!-- schema-section:end -->

The client should preserve drafts during temporary network outages.

### Offline behavior

Where technically feasible:

* View recently cached conversations
* Compose messages
* Save drafts
* Queue messages for delivery
* Synchronize when connectivity returns

The system must clearly indicate message delivery status.

---

## 75. Message Delivery States

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)) · enum `MessageDeliveryStatus` ([L10653](../../api/prisma/schema.prisma#L10653))
<!-- schema-section:end -->

Messages may have states such as:

* Draft
* Sending
* Sent
* Delivered
* Failed
* Retrying
* Deleted

The UI should provide clear feedback when a message fails to send.

---

## 76. Reliability

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `client_message_id`
<!-- schema-section:end -->

Messaging is a real-time operational system and should prioritize reliability.

### Requirements

* No duplicate messages
* No silent message loss
* Ordered message display where possible
* Reliable event delivery
* Automatic reconnect
* Retry mechanisms
* Idempotent API operations
* Consistent unread state
* Consistent thread state

---

## 77. Performance

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `member_count`
<!-- schema-section:end -->

The system should remain responsive with large organizations and high message volume.

### Requirements

* Pagination/infinite scrolling
* Lazy loading
* Virtualized message lists where needed
* Efficient search
* Attachment lazy loading
* Cached conversations
* Incremental synchronization
* Efficient unread tracking
* Efficient notification delivery

Large channels should not require loading the entire message history.

---

## 78. Message History Loading

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Messages should load incrementally.

### Navigation

* Latest messages
* Scroll upward for history
* Jump to date
* Jump to unread
* Jump to message
* Search result navigation

When opening a permalink, the client should load enough surrounding context to make the message understandable.

---

## 79. Notification Rules Engine

<!-- schema-section:start -->
> **Schema:** `ChannelNotificationSetting` ([channel_notification_settings](../../api/prisma/schema.prisma#L11110)): `priority_customer_messages` · `MessagingKeyword` ([messaging_keywords](../../api/prisma/schema.prisma#L11581)) · enum `ChannelNotificationLevel` ([L10622](../../api/prisma/schema.prisma#L10622))
<!-- schema-section:end -->

The notification system should support configurable rules.

### Rule examples

* Notify me for all messages in channel
* Notify only when mentioned
* Notify for threads I follow
* Notify for messages containing keyword
* Do not notify during working hours
* Do not notify during DND
* Notify immediately for customer messages

Rules should be evaluated consistently across web and mobile clients.

---

## 80. Customization

<!-- schema-section:start -->
> **Schema:** `MessageReaction` ([message_reactions](../../api/prisma/schema.prisma#L11289)): `emoji` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `allowed_reactions`, `announcement_policy`, `broadcast_mention_policy`, `channel_naming_rules`, `custom_emoji`, `default_channel_ids`, `default_sections`, `external_access_enabled`, `file_policy`
<!-- schema-section:end -->

Organizations should be able to customize:

* Channel naming rules
* Default channels
* Default notification settings
* Message retention
* File limits
* External access
* Guest access
* Mention permissions
* Announcement permissions
* Emoji/reaction availability
* Branding (consumed from 01 §15)
* Channel sections and defaults

---

## 81. Permissions Model

<!-- schema-section:start -->
> **Schema:** other modules: `Membership` ([memberships](../../api/prisma/schema.prisma#L966)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

> Catalog, roles and scopes defined by → [01](./01-users-organizations-permissions.md) §44–52 · Linear LOG-406. Keys follow 01 §46 (`messaging.channels.manage`, `messaging.messages.delete_any`, `messaging.external_users.manage`).

Messaging permissions apply at organization, channel and conversation levels.

### Organization permissions

* Manage messaging
* Manage channels
* Manage users
* Manage external users
* Manage retention
* Manage integrations
* View audit logs
* Export data

### Channel permissions

* View
* Join
* Post
* Reply
* Edit own messages
* Delete own messages
* Pin
* Manage members
* Manage channel
* Archive

### External permissions

* View assigned channels
* Send messages
* Reply
* Upload files
* View shared records

---

## 82. Guest Users

<!-- schema-section:start -->
> **Schema:** `ChannelMember` ([channel_members](../../api/prisma/schema.prisma#L11066)): `access_expires_at` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `guest_access_enabled` · enum `ChannelGuestKind` ([L10613](../../api/prisma/schema.prisma#L10613))
<!-- schema-section:end -->

Support limited guest users.

### Guest types

* Single-channel guest
* Multi-channel guest
* Customer guest
* Partner guest
* Temporary guest

Guest access should automatically expire when configured.

---

## 83. External Identity

<!-- schema-section:start -->
> **Schema:** `ChannelMember` ([channel_members](../../api/prisma/schema.prisma#L11066)): `external_label`
<!-- schema-section:end -->

External users should have a clear identity marker.

Example:

`Maria Papadopoulou — ACME Corp — Guest`

This prevents confusion between employees and external participants.

---

## 85. Sensitive Information Controls

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `is_confidential` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `file_policy`, `sensitive_content_controls`
<!-- schema-section:end -->

The platform should provide configurable controls for sensitive content.

Potential future capabilities:

* Sensitive data detection
* External sharing warnings
* Restricted file types
* Confidential channel labels
* Prevent external forwarding
* DLP integrations

These should be optional and configurable rather than mandatory.

---

## 86. Search & Permissions

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Search must never reveal unauthorized information.

For every result, the system must verify:

* Organization membership
* Team or Branch scope
* Channel access
* Conversation access
* Record access
* Attachment access

A user should not be able to infer private message contents through search metadata.

---

## 87. Notifications & Privacy

<!-- schema-section:start -->
> **Schema:** `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `body_plain` · `MessagingMemberSettings` ([messaging_member_settings](../../api/prisma/schema.prisma#L11673)): `notification_previews_with_text` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `notification_previews_include_text` — other modules: `NotificationRecipientSettings` ([notification_recipient_settings](../../api/prisma/schema.prisma#L13666)): `show_previews` ([14](./14-notifications-activity-center.md))
<!-- schema-section:end -->

Notifications must also respect permissions.

Do not expose sensitive message content through:

* Push notifications
* Email notifications
* Desktop previews
* Browser notifications

Users should be able to configure whether notification previews contain message text.

---

## 88. Message Thread Following

<!-- schema-section:start -->
> **Schema:** `MessageThreadFollower` ([message_thread_followers](../../api/prisma/schema.prisma#L11473)): `last_read_at`
<!-- schema-section:end -->

Users should be able to follow important threads.

### Thread following

* Follow thread
* Unfollow thread
* Notify on replies
* Show followed threads in inbox
* Mark thread read

Thread following should not automatically subscribe users to the entire channel.

---

## 90. Channel Digest

<!-- schema-section:start -->
> **Schema:** `ChannelNotificationSetting` ([channel_notification_settings](../../api/prisma/schema.prisma#L11110)) · enum `ChannelDigestFrequency` ([L10631](../../api/prisma/schema.prisma#L10631))
<!-- schema-section:end -->

Optional digest functionality may summarize activity for channels where users do not need real-time notifications.

Possible digest periods:

* Hourly
* Daily
* Weekly

The digest should link directly to the relevant messages.

---

## 91. System Messages

<!-- schema-section:start -->
> **Schema:** `ChannelCall` ([channel_calls](../../api/prisma/schema.prisma#L11812)): `message_id` · `Message` ([messages](../../api/prisma/schema.prisma#L11167)): `system_event` · enum `MessageKind` ([L10639](../../api/prisma/schema.prisma#L10639))
<!-- schema-section:end -->

The platform should support system-generated messages.

Examples:

* User joined channel
* User left channel
* Channel renamed
* Channel archived
* Integration connected
* Project linked
* Customer added

System messages should be visually distinct from user messages.

---

## 92. Automated System Events

<!-- schema-section:start -->
> **Schema:** `MessagingIntegration` ([messaging_integrations](../../api/prisma/schema.prisma#L11766)): `subscribed_events`
<!-- schema-section:end -->

Internal modules may publish operational events to messaging.

Examples:

**CRM**

* New qualified lead
* Deal won

**Projects**

* Project created
* Milestone completed

**Finance**

* Invoice paid

**Contracts**

* Contract signed

**Support**

* Ticket escalated

These events should be configurable and should not create excessive noise.

---

## 93. Conversation Templates

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `template_id` · `ChannelMember` ([channel_members](../../api/prisma/schema.prisma#L11066)): `is_required` · `ChannelTemplate` ([channel_templates](../../api/prisma/schema.prisma#L10911)): `discussion_sections`, `member_rules`, `pinned_content` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `auto_create_project_channels` · enum `ChannelMembershipSource` ([L10600](../../api/prisma/schema.prisma#L10600)) · enum `ChannelTemplateTrigger` ([L10803](../../api/prisma/schema.prisma#L10803))
<!-- schema-section:end -->

Organizations may define templates for recurring communication spaces.

### New project channel

Automatically create:

* Project channel
* Standard description
* Required members
* Pinned project overview
* Links to project dashboard
* Standard discussion sections

### Customer onboarding channel

Automatically include:

* Customer
* Account manager
* Project manager
* Relevant internal team
* Onboarding documentation

---

## 94. Channel Naming & Conventions

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `slug` · `ChannelTemplate` ([channel_templates](../../api/prisma/schema.prisma#L10911)): `name_pattern` · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L10813)): `channel_naming_rules`
<!-- schema-section:end -->

Organizations may define naming conventions.

Examples:

* `#general`
* `#announcements`
* `#engineering`
* `#sales`
* `#project-website-redesign`
* `#customer-acme`
* `#support-1234`

Naming rules should prevent duplicate/confusing channel names.

---

## 95. Archival & Lifecycle Automation

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `archive_reason`, `expires_at` · `ChannelTemplate` ([channel_templates](../../api/prisma/schema.prisma#L10911)): `archive_rule` · enum `ChannelStatus` ([L10575](../../api/prisma/schema.prisma#L10575))
<!-- schema-section:end -->

> Engine defined by → [20 Automation Engine](./20-automation-engine.md) · Linear LOG-410. Messaging exposes "create channel", "archive channel" and "post message" actions.

Channels may be automatically archived based on rules.

Examples:

* Project completed → archive project channel after configured period
* Customer inactive → archive customer channel
* Temporary channel → archive after expiration

Archived conversations remain searchable according to retention policies.

---

## 96. Cross-Organization Messaging

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Cross-organization messaging may be supported in the future.

Potential use cases:

* Agency ↔ Partner
* Agency ↔ Contractor
* Agency ↔ Customer

Cross-organization access must use explicit invitations and isolated permissions.

---

## 97. API Extensibility

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Messaging resources should behave as first-class API objects.

Conceptual resources:

* `/users`
* `/conversations`
* `/channels`
* `/messages`
* `/threads`
* `/reactions`
* `/attachments`
* `/members`
* `/notifications`
* `/reminders`
* `/webhooks`

The exact API structure can evolve, but resource IDs should remain stable.

---

## 100. Cross-Module Navigation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The messaging system should support deep navigation.

Examples:

* Message → Project
* Message → Customer
* Message → Deal
* Message → Task
* Message → Ticket
* Message → Proposal
* Message → Contract
* Project → Project Channel
* Customer → Customer Conversations
* Deal → Deal Discussion
* Ticket → Support Conversation

This should make messaging part of the operating system rather than an isolated chat application.

---

## 101. Home / Messaging Dashboard

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Provide a messaging home page.

### Suggested sections

* Unread
* Mentions
* DMs
* Favorites
* Recent conversations
* Followed threads
* Saved messages
* Reminders
* Customer conversations
* Project conversations

Users should be able to continue work quickly without manually navigating through channels.

---

## 102. Recent Conversations

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `member_count`
<!-- schema-section:end -->

Show recently active conversations.

Each item may display:

* Conversation name
* Latest message
* Sender
* Timestamp
* Unread state
* Mention indicator
* Related project/customer

---

## 103. Conversation Information Panel

<!-- schema-section:start -->
> **Schema:** `Channel` ([channels](../../api/prisma/schema.prisma#L10953)): `settings`
<!-- schema-section:end -->

A conversation details panel should show:

* Members
* Channel description
* Topic
* Files
* Pinned messages
* Shared records
* Notification settings
* Channel settings
* Related project/customer
* Integrations

---

## 104. Message Analytics

<!-- schema-section:start -->
> **Schema:** `MessagingUsageDaily` ([messaging_usage_daily](../../api/prisma/schema.prisma#L11876))
<!-- schema-section:end -->

Per-channel analytics may include:

* Message volume
* Active participants
* Thread count
* Response patterns
* File volume
* Usage over time

Analytics should avoid being presented as a simplistic employee performance score.

---

## 105. Internationalization

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Support:

* Multiple languages
* Timezones
* Locale-aware dates
* Locale-aware timestamps
* Unicode
* RTL languages where required

Search should handle multilingual text correctly.

---

## 106. Compliance

<!-- schema-section:start -->
> **Schema:** `MessagingExportJob` ([messaging_export_jobs](../../api/prisma/schema.prisma#L11733))
<!-- schema-section:end -->

The messaging module should provide configurable controls for applicable organizational and legal requirements.

Potential requirements:

* Data retention
* Data export
* Access logging
* Deletion policies
* Consent/guest access
* Administrative controls
* Audit trails

Specific compliance requirements should be configurable based on the organization's jurisdiction and policies.

---

## 108. Multi-Tenant Isolation

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [01](./01-users-organizations-permissions.md) §3, §9 · Linear LOG-406.

The Agency OS is multi-tenant. Messaging data is isolated by Organization.

No user, API request, search operation, notification, file URL, or integration event should cross organization boundaries without explicit authorization.

---

## 109. Core User Journeys

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

### Journey 1 — Send a DM

User opens colleague profile → clicks Message → enters message → sends → recipient receives real-time notification → conversation appears in DM history.

### Journey 2 — Create a project channel

Project manager creates project → system offers to create project channel → members are added → channel appears in project and messaging navigation.

### Journey 3 — Discuss a task

User opens task → opens discussion → sends message → task-linked conversation is visible to authorized project members.

### Journey 4 — Customer conversation

Account manager creates customer channel → invites customer → customer receives secure invitation → customer communicates with agency → internal-only channels remain inaccessible.

### Journey 5 — Share a deal

Sales user shares CRM deal into sales channel → users see deal preview → authorized users can open CRM record.

### Journey 6 — Follow a thread

User replies to message → follows thread → receives notifications only for thread replies rather than all channel activity.

---

## 110. Non-Goals

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The messaging module should not become a replacement for every other communication or business system.

### Not part of the core messaging module

* Email marketing campaigns
* Bulk SMS campaigns
* Email CRM sequences
* Marketing automation
* Full CRM functionality
* Full project management
* Full helpdesk
* Full document management
* Full video conferencing infrastructure
* Payroll/HR management

The messaging system should integrate with these modules rather than duplicate their responsibilities.

---

## 114. Success Criteria

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The messaging module should achieve the following:

* Employees can communicate without leaving the Agency OS.
* Users can quickly find historical conversations.
* Projects have contextual communication.
* Customers can participate in controlled external conversations.
* Messages are linked to business records.
* Notifications are reliable but configurable.
* Search respects permissions.
* Real-time communication feels immediate.
* High-volume channels remain performant.
* Administrative controls are sufficient for an agency environment.
* Messaging data remains secure and auditable.
* The module can integrate with external systems through APIs and webhooks.
* The messaging system can scale from a small agency to larger organizations.

---

## 115. Module Relationship

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The Messaging module should sit alongside the other Agency OS modules.

**CRM**
→ Sales relationships and pipeline

**Messaging**
→ Real-time internal/external collaboration

**Projects**
→ Work execution

**Tasks**
→ Individual work items

**Customer Portal**
→ Customer-facing access

**Contracts**
→ Commercial/legal agreements

**Finance**
→ Invoices, payments, expenses, profitability

**Support**
→ Customer issue management

**Communications**
→ Email/SMS and outbound communication

**Employees**
→ People, HR and organizational management

**Documents**
→ Centralized business documentation

Messaging acts as the communication layer connecting these modules while keeping ownership of business data inside the appropriate module.
