# Notifications & Activity Center

> Linear: [LOG-403](https://linear.app/logiqdev/issue/LOG-403/notifications-and-activity-center) · Status: Backlog

> **Canonical for:** the platform notification engine. Every other module only declares the events it emits and references this file. No module implements its own notification channels, preferences, inbox or digest.
>
> **Depends on:** [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) (LOG-406) for identity, Membership, Teams and tenant isolation · [11 Communication Center](./11-communication-center.md) (LOG-106) as the delivery provider for the email and SMS channels · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for rule-driven notifications.
>
> **Consumed by:** 02 CRM, 03 Proposals, 04 Contracts, 05 Projects, 06 Tasks, 07 Customer Portal, 08 Finance, 09 Income & Expense, 10 Employees, 12 Messaging, 13 Support, 17 Documents, 18 Time Tracking, 19 Calendar.

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (18)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Event catalog** | | | |
| `NotificationEventType` | `notification_event_types` | [L15889](../../api/prisma/schema.prisma#L15889) | 14 §4, §10, §14 — the event catalog. Platform entries have organization_id = null; organizations may register additional event types (admin API, 14 §14). The… |
| **Events (ingestion)** | | | |
| `NotificationEvent` | `notification_events` | [L15944](../../api/prisma/schema.prisma#L15944) | 14 §2, §9, §14 — an event published by a module or the Automation Engine (20). Idempotent on (organization_id, idempotency_key): redelivered events never cre… |
| **Notifications (inbox)** | | | |
| `Notification` | `notifications` | [L16005](../../api/prisma/schema.prisma#L16005) | 14 §2, §7, §9, 12 §16, §18 — a message produced from an event for one recipient (a Membership or a Customer Portal User). The in-app record is always stored … |
| `NotificationDelivery` | `notification_deliveries` | [L16087](../../api/prisma/schema.prisma#L16087) | 14 §5, §9 — one delivery attempt record per channel of a notification. Email/SMS are sent through 11 (comm_message_id); push through NotificationPushDevice; … |
| **Templates & localization** | | | |
| `NotificationTemplate` | `notification_templates` | [L16147](../../api/prisma/schema.prisma#L16147) | 14 §10 — notification template per event type, channel and locale. organization_id = null is the platform default; organization rows override it. Branding (0… |
| **Organization configuration** | | | |
| `NotificationOrgSettings` | `notification_org_settings` | [L16186](../../api/prisma/schema.prisma#L16186) | 14 §5, §6, §8, §11 — organization-wide notification settings (one row per organization). |
| `NotificationOrgDefault` | `notification_org_defaults` | [L16220](../../api/prisma/schema.prisma#L16220) | 14 §6 — organization defaults per module or per event type (preference layer 4) and the list of mandatory events administrators configure. Exactly one of mod… |
| **Recipient settings & preferences** | | | |
| `NotificationRecipientSettings` | `notification_recipient_settings` | [L16251](../../api/prisma/schema.prisma#L16251) | 14 §6 — per-recipient global settings (preference layer 3): level, Do Not Disturb / quiet hours, digest mode, preview privacy (12 §87) and channel master swi… |
| `NotificationPreference` | `notification_preferences` | [L16308](../../api/prisma/schema.prisma#L16308) | 14 §6 — per-recipient preference rows for layers 1–2, reusable by 12 §17 and §32 for channel / conversation mute. Scope is exactly one of: event_type_id (per… |
| `NotificationKeyword` | `notification_keywords` | [L16352](../../api/prisma/schema.prisma#L16352) | 14 §6, §16 — keyword subscriptions (12 §32): the member is notified when the term appears in an authorized conversation. Phase 2. |
| **Digests** | | | |
| `NotificationDigest` | `notification_digests` | [L16380](../../api/prisma/schema.prisma#L16380) | 14 §8 — a batch of notifications for one recipient and period, per module or per record (12 Messaging channel digest). Deliveries held for the digest point a… |
| **Push devices** | | | |
| `NotificationPushDevice` | `notification_push_devices` | [L16427](../../api/prisma/schema.prisma#L16427) | 14 §5 — registered push targets (mobile, browser, desktop) per platform User. User-level because a device is not tenant-specific; the active membership at re… |
| `PlatformWebPushKey` | `platform_web_push_keys` | [L16460](../../api/prisma/schema.prisma#L16460) | 14 §5 — the deployment's Web Push (VAPID) key pair. Platform-level, not per organization: push devices belong to a User and a browser holds one subscription … |
| **Delivery rules** | | | |
| `NotificationDeliveryRule` | `notification_delivery_rules` | [L16477](../../api/prisma/schema.prisma#L16477) | 14 §9, §16 — organization-level dedup / coalesce / throttle / suppress rules evaluated before delivery. A rule applies to the matching event type (or module,… |
| `NotificationTemplateVersion` | `notification_template_versions` | [L16509](../../api/prisma/schema.prisma#L16509) | 14 §10 — immutable snapshot of a template before each change, for history and rollback. |
| `Announcement` | `announcements` | [L16536](../../api/prisma/schema.prisma#L16536) | 14 §4, §7 — system announcement (maintenance, policy change, outage notice). Publishing fans out Notification rows (category ANNOUNCEMENT, event `announcemen… |
| `AnnouncementAcknowledgement` | `announcement_acknowledgements` | [L16571](../../api/prisma/schema.prisma#L16571) | 14 §7 — who acknowledged an announcement that requires it (a member or a Customer Portal user). |
| `ActivityEvent` | `activity_events` | [L16593](../../api/prisma/schema.prisma#L16593) | 14 §2, §7 — activity feed read model written by the owning modules next to audit_events (which stays the security / compliance trail). Scopes: organization, … |

**Owned enums (15):** `NotificationChannel`, `NotificationRecipientType`, `NotificationCategory`, `NotificationPriority`, `NotificationLevel`, `NotificationDeliveryMode`, `NotificationDigestFrequency`, `NotificationEventStatus`, `NotificationDeliveryStatus`, `NotificationSkipReason`, `NotificationDigestStatus`, `NotificationPushPlatform`, `NotificationDeliveryRuleKind`, `NotificationCoalesceKey`, `AnnouncementStatus`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `CustomerPortalMembership` (`customer_portal_memberships`) | `AnnouncementAcknowledgement.portal_membership`, `Notification.portal_membership`, `NotificationDigest.portal_membership`, `NotificationPreference.portal_membership` +1 more |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Announcement.created_by`, `AnnouncementAcknowledgement.membership`, `Notification.actor`, `Notification.recipient_membership` +5 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `ActivityEvent.organization`, `Announcement.organization`, `AnnouncementAcknowledgement.organization`, `Notification.organization` +12 more |
| [01](./01-users-organizations-permissions.md) | `User` (`users`) | `Notification.recipient_user`, `NotificationPushDevice.user` |
| [13](./13-customer-support-communication-hub.md) | `SupportIncident` (`support_incidents`) | `Announcement.incident` |

**Reused enums:** `ModuleKey` ([01](./01-users-organizations-permissions.md)), `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `CustomerPortalMembership`, `Membership`, `Organization`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `OrganizationEntitlement.enforcement` ([01](./01-users-organizations-permissions.md), [L1041](../../api/prisma/schema.prisma#L1041)) — HARD blocks the action at the limit; SOFT only warns and raises a notification (14).
- `RecurringExpense.reminder_days_before` ([09](./09-income-expense-management.md), [L9044](../../api/prisma/schema.prisma#L9044)) — Days before the occurrence to send an upcoming-expense reminder (14); null = organization default.
- `CommTemplate.notification_event_type_id` ([11](./11-communication-center.md), [L11876](../../api/prisma/schema.prisma#L11876)) — 14 NotificationEventType key this template renders (kind NOTIFICATION); id only.
- `CommMessage.notification_id` ([11](./11-communication-center.md), [L12026](../../api/prisma/schema.prisma#L12026)) — 14 Notification / NotificationDelivery this message delivers (kind NOTIFICATION); ids only.
- `MessageReminder.notification_id` ([12](./12-messaging-team-communication.md), [L13884](../../api/prisma/schema.prisma#L13884)) — 14 Notification id emitted when triggered; id only.
- `AutomationSettings.dead_letter_alerts_enabled` ([20](./20-automation-engine.md), [L21117](../../api/prisma/schema.prisma#L21117)) — 20 §6 — dead-letter alerting through 14 Notifications.
- `AutomationTriggerDefinition.notifiable` ([20](./20-automation-engine.md), [L21164](../../api/prisma/schema.prisma#L21164)) — Also mirrored to 14 Notifications and outbound webhooks (20 §2).
- `PlatformEvent.notifications_processed_at` ([20](./20-automation-engine.md), [L21438](../../api/prisma/schema.prisma#L21438)) — 14 Notifications fan-out done.
- `AutomationApproval.notification_id` ([20](./20-automation-engine.md), [L21669](../../api/prisma/schema.prisma#L21669)) — 14 Notification id sent for this request; id only.

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

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 10 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `notifications.activity` | read |
| `notifications.announcements` | manage* |
| `notifications.audit` | read* |
| `notifications.defaults` | manage |
| `notifications.deliveries` | retry |
| `notifications.delivery_rules` | manage |
| `notifications.event_types` | manage |
| `notifications.preferences` | manage_own |
| `notifications.settings` | manage |
| `notifications.templates` | manage |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Purpose

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

The Notifications & Activity Center is the single notification engine of the Agency Operating System. It receives events from every module, decides who should be told, how and when, and delivers the result through the recipient's configured channels.

Core rule:

**Modules emit events. The notification engine owns recipients, channels, preferences, inbox, digests and delivery.**

## 2. Core Concepts

<!-- schema-section:start -->
> **Schema:** `ActivityEvent` ([activity_events](../../api/prisma/schema.prisma#L16593)) · `Notification` ([notifications](../../api/prisma/schema.prisma#L16005)) · `NotificationEvent` ([notification_events](../../api/prisma/schema.prisma#L15944))
<!-- schema-section:end -->

### Event

A fact published by a module, for example `task.assigned`, `invoice.overdue`, `contract.expiring`. Events carry the organization, the source record, the actor and a payload.

### Notification

A message produced from an event for one recipient. A single event may produce many notifications or none.

### Channel

The medium used to deliver a notification: in-app, email, SMS, push (mobile and browser), desktop.

### Preference

A recipient's configuration of which events reach which channels, at organization default, module default, per-record and per-user level.

### Activity

A record-level history item ("status changed", "comment added") shown on the record. Activity is written by the owning module; the notification engine does not generate activity.

### Inbox

The recipient's list of notifications across all modules, with read state and actions.

## 3. Recipients

<!-- schema-section:start -->
> **Schema:** `Announcement` ([announcements](../../api/prisma/schema.prisma#L16536)): `audience` · `Notification` ([notifications](../../api/prisma/schema.prisma#L16005)): `audience_reason` · `NotificationEvent` ([notification_events](../../api/prisma/schema.prisma#L15944)): `targets` · enum `NotificationRecipientType` ([L15739](../../api/prisma/schema.prisma#L15739))
<!-- schema-section:end -->

Recipients can be:

* Members (internal users, defined in 01)
* Customer Portal users (defined in 01 §79, surfaced in 07)
* External collaborators and guests (01 §77–78)
* Teams (expanded to Members at delivery time)
* Roles or scopes (for example "all Finance Managers in the Athens branch")

Recipient resolution always respects organization isolation and the permission layer. A recipient never receives a notification about a record they cannot read.

## 4. Event Catalog

<!-- schema-section:start -->
> **Schema:** `Announcement` ([announcements](../../api/prisma/schema.prisma#L16536)) · `NotificationEventType` ([notification_event_types](../../api/prisma/schema.prisma#L15889)): `key` · enum `AnnouncementStatus` ([L15877](../../api/prisma/schema.prisma#L15877)) · enum `NotificationCategory` ([L15746](../../api/prisma/schema.prisma#L15746))
<!-- schema-section:end -->

Each module declares its events in its own spec. The catalog below is the aggregated list of events the engine must support at MVP. The owning module is the source of truth for the event's meaning.

| Module | Events |
| -- | -- |
| 01 Identity | member invited, member joined, role or permission changed, admin assigned, MFA disabled, SSO changed, external collaborator added, security alerts |
| 02 CRM | lead created, lead assigned, deal stage changed, deal won/lost, deal inactive, activity due, record ownership changed |
| 03 Proposals | proposal sent, viewed, accepted, rejected, changes requested, expiring, internal approval requested |
| 04 Contracts | review requested, approval requested, signature requested, partially signed, fully signed, amendment requested, renewal approaching, notice deadline, expired, terminated |
| 05 Projects | added to project, role changed, milestone approaching or completed, deliverable due, project blocked, risk escalated, change request awaiting approval, status or health changed, project completed |
| 06 Tasks | task assigned, mentioned, status changed, due soon, overdue, blocked, comment added, release deployed |
| 07 Customer Portal | request updated, approval requested, deliverable uploaded, status update published |
| 08 Finance | invoice created, invoice sent, payment received, payment failed, invoice overdue, subscription renewal, subscription cancelled, refund processed |
| 09 Income & Expense | expense awaiting approval, upcoming recurring expense, duplicate invoice detected, monthly summary ready |
| 10 Employees | leave requested, leave approved or rejected, document requested, review scheduled, anniversary, announcement |
| 12 Messaging | direct message, mention, thread reply, reaction, channel invitation, pinned message, message reminder |
| 13 Support | new ticket, customer reply, ticket assigned, SLA warning, SLA breach, escalation, linked task updated, ticket resolved |
| 17 Documents | shared with you, approval requested, new version, expiring access |
| 18 Time Tracking | timesheet due, timesheet submitted, timesheet approved or rejected |
| 19 Calendar | event invitation, event updated, reminder |

Modules may add events. New events must be registered in the catalog with a stable key, a human-readable name and default channel settings.

**Announcements.** `Announcement` (severity, `audience`, `portal_visible`, `requires_ack`, status DRAFT, SCHEDULED, LIVE, EXPIRED, WITHDRAWN, optional `incident_id`) fans out `Notification` rows with category ANNOUNCEMENT and event `announcement.published`; `AnnouncementAcknowledgement` records who confirmed. Managed with `notifications.announcements.manage*`.

## 5. Channels

<!-- schema-section:start -->
> **Schema:** `Notification` ([notifications](../../api/prisma/schema.prisma#L16005)) · `NotificationDelivery` ([notification_deliveries](../../api/prisma/schema.prisma#L16087)) · `NotificationEventType` ([notification_event_types](../../api/prisma/schema.prisma#L15889)): `customer_visible` · `NotificationOrgSettings` ([notification_org_settings](../../api/prisma/schema.prisma#L16186)) · `NotificationPushDevice` ([notification_push_devices](../../api/prisma/schema.prisma#L16427)) · `PlatformWebPushKey` ([platform_web_push_keys](../../api/prisma/schema.prisma#L16460)) · enum `NotificationChannel` ([L15730](../../api/prisma/schema.prisma#L15730)) · enum `NotificationPushPlatform` ([L15853](../../api/prisma/schema.prisma#L15853))
<!-- schema-section:end -->

Supported channels:

* **In-app** (always available, always stored)
* **Email** (delivered through 11 Communication Center)
* **SMS** (delivered through 11 Communication Center, opt-in)
* **Push** (mobile and browser)
* **Desktop**

Channel availability can be restricted per organization. Customer Portal users receive in-app (portal), email and optionally SMS.

Email and SMS notifications are notifications, not communications. Campaigns, templates and customer messaging remain in 11.

**Provider credentials.** Push (APNs, FCM, Web Push) credentials are platform-level, not per organization, and the SLACK channel is removed until a provider exists.

**Implementation (API `notifications/delivery`, `notifications/push`).** SMS is opt-in: the member's `sms_enabled` switch, a mobile number on the profile (`User.phone`), the event's default or the member's per-event switch; sent through 11 with the organization's own Twilio connection (no connection → `SKIPPED CHANNEL_NOT_AVAILABLE`, no phone → `NO_ADDRESS`) and held during quiet hours like email. Browser push uses one VAPID key pair per deployment (`PlatformWebPushKey`, generated on first use, private key encrypted); members register browsers in Notifications → Devices (`/notifications/devices`, service worker `app/public/sw.js`). Push mirrors the inbox unless switched off per event, by an organization default or by `push_enabled`; during quiet hours it is `SKIPPED QUIET_HOURS` (the inbox row stays). Subscriptions answered 404/410 by the push service are deleted; 5 consecutive failures disable a device. Read or archived notifications older than `NotificationOrgSettings.retention_days` (default 365, null = keep) are purged nightly; mandatory notifications and audit events are never purged.

## 6. Preferences

<!-- schema-section:start -->
> **Schema:** `Notification` ([notifications](../../api/prisma/schema.prisma#L16005)): `is_mandatory` · `NotificationEventType` ([notification_event_types](../../api/prisma/schema.prisma#L15889)): `mandatory_by_default` · `NotificationKeyword` ([notification_keywords](../../api/prisma/schema.prisma#L16352)) · `NotificationOrgDefault` ([notification_org_defaults](../../api/prisma/schema.prisma#L16220)): `is_mandatory` · `NotificationOrgSettings` ([notification_org_settings](../../api/prisma/schema.prisma#L16186)) · `NotificationPreference` ([notification_preferences](../../api/prisma/schema.prisma#L16308)): `enabled` · `NotificationRecipientSettings` ([notification_recipient_settings](../../api/prisma/schema.prisma#L16251)): `dnd_allow_critical`, `show_previews` · enum `NotificationDeliveryMode` ([L15784](../../api/prisma/schema.prisma#L15784)) · enum `NotificationLevel` ([L15776](../../api/prisma/schema.prisma#L15776)) · enum `NotificationPriority` ([L15767](../../api/prisma/schema.prisma#L15767)) · enum `NotificationSkipReason` ([L15824](../../api/prisma/schema.prisma#L15824)) — other modules: `ChannelNotificationSetting` ([channel_notification_settings](../../api/prisma/schema.prisma#L13461)) ([12](./12-messaging-team-communication.md)) · `MessagingMemberSettings` ([messaging_member_settings](../../api/prisma/schema.prisma#L14029)) ([12](./12-messaging-team-communication.md)) · `MessagingSettings` ([messaging_settings](../../api/prisma/schema.prisma#L13161)) ([12](./12-messaging-team-communication.md)) · enum `ChannelNotificationLevel` ([L12970](../../api/prisma/schema.prisma#L12970)) ([12](./12-messaging-team-communication.md))
<!-- schema-section:end -->

Preference layers, evaluated from most specific to least:

1. Per-record mute or follow (for example "mute this channel", "follow this project")
2. Per-user per-event-type channel settings
3. Per-user global settings (Do Not Disturb schedule, quiet hours, digest mode, preview privacy)
4. Organization defaults per module
5. Platform defaults

Options a user can set:

* All events / important only / mentions and direct only / none
* Channel per event type
* Do Not Disturb schedule and time zone
* Digest instead of immediate delivery
* Keyword subscriptions (used by 12 Messaging)
* Whether notification previews include message content (privacy, see 12 §87)

Some events are mandatory and cannot be muted, for example security alerts, SLA breaches assigned to the user, and legal notices. Mandatory events are configured by organization administrators.

## 7. Inbox / Activity Center

<!-- schema-section:start -->
> **Schema:** `ActivityEvent` ([activity_events](../../api/prisma/schema.prisma#L16593)) · `Announcement` ([announcements](../../api/prisma/schema.prisma#L16536)) · `AnnouncementAcknowledgement` ([announcement_acknowledgements](../../api/prisma/schema.prisma#L16571)) · `Notification` ([notifications](../../api/prisma/schema.prisma#L16005)): `actions`, `context_project_id`, `recipient_user_id`, `requires_action`, `seen_at` · `NotificationEvent` ([notification_events](../../api/prisma/schema.prisma#L15944)): `context_project_id` · `NotificationEventType` ([notification_event_types](../../api/prisma/schema.prisma#L15889)): `available_actions` · enum `AnnouncementStatus` ([L15877](../../api/prisma/schema.prisma#L15877)) · enum `NotificationCategory` ([L15746](../../api/prisma/schema.prisma#L15746)) · enum `NotificationChannel` ([L15730](../../api/prisma/schema.prisma#L15730))
<!-- schema-section:end -->

The Activity Center is the unified inbox for the user.

Capabilities:

* Grouped by module, record, or time
* Filters: unread, mentions, assigned to me, approvals, by module
* Actions on an item: mark read, mark unread, open source record, snooze, act (approve, reply, complete) where the source module supports it
* Mark all read
* Search
* Pinned approvals section listing everything waiting on the user

The Customer Portal exposes a customer-scoped inbox built on the same engine.

**Context and activity feed.** `Notification` and `NotificationEvent` carry indexed `context_project_id` and `context_company_id` for the inbox filters. The activity feed reads `ActivityEvent` (summary, project, company, `customer_visible`), written by owning modules; `audit_events` stays the compliance trail. The own inbox is implicit; the feed needs `notifications.activity.read`.

## 8. Digests

<!-- schema-section:start -->
> **Schema:** `Notification` ([notifications](../../api/prisma/schema.prisma#L16005)): `action_url` · `NotificationDelivery` ([notification_deliveries](../../api/prisma/schema.prisma#L16087)): `digest_id` · `NotificationDigest` ([notification_digests](../../api/prisma/schema.prisma#L16380)) · `NotificationEventType` ([notification_event_types](../../api/prisma/schema.prisma#L15889)): `supports_digest` · `NotificationOrgSettings` ([notification_org_settings](../../api/prisma/schema.prisma#L16186)) · enum `NotificationDeliveryMode` ([L15784](../../api/prisma/schema.prisma#L15784)) · enum `NotificationDigestFrequency` ([L15791](../../api/prisma/schema.prisma#L15791)) · enum `NotificationDigestStatus` ([L15842](../../api/prisma/schema.prisma#L15842))
<!-- schema-section:end -->

Users can receive digests instead of immediate notifications for selected event types.

* Hourly, daily, weekly
* Per module or per channel (12 Messaging channel digest)
* Links back to the exact record or message

## 9. Delivery Rules

<!-- schema-section:start -->
> **Schema:** `Notification` ([notifications](../../api/prisma/schema.prisma#L16005)): `expires_at`, `group_key` · `NotificationDelivery` ([notification_deliveries](../../api/prisma/schema.prisma#L16087)): `attempt_count` · `NotificationDeliveryRule` ([notification_delivery_rules](../../api/prisma/schema.prisma#L16477)) · `NotificationEvent` ([notification_events](../../api/prisma/schema.prisma#L15944)): `expires_at`, `group_key`, `idempotency_key` · `NotificationEventType` ([notification_event_types](../../api/prisma/schema.prisma#L15889)): `can_coalesce`, `default_expiry_minutes` · `NotificationOrgSettings` ([notification_org_settings](../../api/prisma/schema.prisma#L16186)): `max_delivery_attempts` · enum `NotificationCoalesceKey` ([L15869](../../api/prisma/schema.prisma#L15869)) · enum `NotificationDeliveryRuleKind` ([L15861](../../api/prisma/schema.prisma#L15861)) · enum `NotificationDeliveryStatus` ([L15809](../../api/prisma/schema.prisma#L15809)) · enum `NotificationEventStatus` ([L15799](../../api/prisma/schema.prisma#L15799)) · enum `NotificationSkipReason` ([L15824](../../api/prisma/schema.prisma#L15824))
<!-- schema-section:end -->

* Deduplicate: the same event never produces two notifications for one recipient on one channel.
* Coalesce: rapid repeated events on the same record collapse into one notification where the event type allows it.
* Order: notifications are delivered in event order per recipient.
* Retry: failed channel deliveries are retried with backoff; in-app delivery never fails silently.
* Expiry: notifications can carry an expiry after which they are not delivered (for example reminders for a meeting that has passed).
* Idempotency: events carry an ID; redelivered events do not create duplicate notifications.

## 10. Templates & Localization

<!-- schema-section:start -->
> **Schema:** `NotificationDelivery` ([notification_deliveries](../../api/prisma/schema.prisma#L16087)): `template_id` · `NotificationEventType` ([notification_event_types](../../api/prisma/schema.prisma#L15889)): `payload_schema` · `NotificationTemplate` ([notification_templates](../../api/prisma/schema.prisma#L16147)) · `NotificationTemplateVersion` ([notification_template_versions](../../api/prisma/schema.prisma#L16509))
<!-- schema-section:end -->

Each event type has a notification template per channel with variables from the event payload.

Templates support the recipient's language and time zone (01 §127). Organization branding (01 §15) is applied to email templates.

**Template history.** Every template change writes a `NotificationTemplateVersion` snapshot used for history and rollback.

## 11. Privacy & Security

<!-- schema-section:start -->
> **Schema:** `Notification` ([notifications](../../api/prisma/schema.prisma#L16005)): `body` · `NotificationDelivery` ([notification_deliveries](../../api/prisma/schema.prisma#L16087)): `destination` · `NotificationEventType` ([notification_event_types](../../api/prisma/schema.prisma#L15889)): `customer_visible` · `NotificationOrgSettings` ([notification_org_settings](../../api/prisma/schema.prisma#L16186)): `hide_previews_by_default` · `NotificationRecipientSettings` ([notification_recipient_settings](../../api/prisma/schema.prisma#L16251)): `show_previews` · enum `NotificationSkipReason` ([L15824](../../api/prisma/schema.prisma#L15824))
<!-- schema-section:end -->

* Recipient resolution enforces organization isolation and record permissions.
* Push, desktop and email previews may be configured to hide content.
* Customer Portal users never receive internal-only events.
* Notification content is not a substitute for permission checks; opening the source record re-evaluates access.

## 12. Permissions

<!-- schema-section:start -->
> **Schema:** other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1614)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

* `notifications.preferences.manage_own`
* `notifications.defaults.manage` (organization defaults, mandatory events)
* `notifications.templates.manage`
* `notifications.audit.read`

Permission keys follow the naming convention in 01 §46.

## 13. Audit

<!-- schema-section:start -->
> **Schema:** other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L2271)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Audit the delivery of mandatory and security notifications, template changes and organization default changes.

## 14. API & Webhooks

<!-- schema-section:start -->
> **Schema:** `NotificationEvent` ([notification_events](../../api/prisma/schema.prisma#L15944)) · `NotificationEventType` ([notification_event_types](../../api/prisma/schema.prisma#L15889)) · `NotificationOrgSettings` ([notification_org_settings](../../api/prisma/schema.prisma#L16186)): `webhook_events_enabled` · enum `NotificationEventStatus` ([L15799](../../api/prisma/schema.prisma#L15799)) — other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L21930)) ([20](./20-automation-engine.md))
<!-- schema-section:end -->

API:

* Publish event (internal modules and Automation Engine)
* List notifications for the current user
* Mark read / unread / all read
* Manage preferences
* Register event types and templates (admin)

Webhooks (for external systems that want notification events):

* `notification.created`
* `notification.delivered`
* `notification.failed`
* `notification.read`

They are published on the platform bus (PlatformEvent → 20 outbound webhooks and automation triggers) when `webhook_events_enabled` is on; payloads carry ids, event key, channel and status, never titles or bodies.

Delivery principles follow the platform standard in `docs/Product_Specification.md` §4.

## 15. Recommended MVP

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Event catalog and registration
* In-app and email channels
* Per-user preferences with organization defaults
* Activity Center inbox with read state and approvals section
* Daily digest
* Deduplication, retry and idempotency
* Customer Portal inbox

## 16. Phase 2

<!-- schema-section:start -->
> **Schema:** `NotificationDelivery` ([notification_deliveries](../../api/prisma/schema.prisma#L16087)): `opened_at` · `NotificationDeliveryRule` ([notification_delivery_rules](../../api/prisma/schema.prisma#L16477)): `conditions` · `NotificationEvent` ([notification_events](../../api/prisma/schema.prisma#L15944)): `automation_rule_id` · `NotificationKeyword` ([notification_keywords](../../api/prisma/schema.prisma#L16352)) · enum `NotificationDeliveryRuleKind` ([L15861](../../api/prisma/schema.prisma#L15861))
<!-- schema-section:end -->

* SMS and push channels
* Keyword subscriptions
* Coalescing rules
* Per-record follow/mute
* Rules engine integration with 20 Automation Engine
* Notification analytics

## 17. Success Criteria

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* No module implements its own delivery channels or preference store.
* A user configures notification behavior in one place for the whole platform.
* Customers see only customer-safe events.
* The same event never reaches a recipient twice on the same channel.
