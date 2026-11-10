# Notifications & Activity Center

> Linear: [LOG-403](https://linear.app/logiqdev/issue/LOG-403/notifications-and-activity-center) · Status: Backlog

> **Canonical for:** the platform notification engine. Every other module only declares the events it emits and references this file. No module implements its own notification channels, preferences, inbox or digest.
>
> **Depends on:** [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) (LOG-406) for identity, Membership, Teams and tenant isolation · [11 Communication Center](./11-communication-center.md) (LOG-106) as the delivery provider for the email and SMS channels · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for rule-driven notifications.
>
> **Consumed by:** 02 CRM, 03 Proposals, 04 Contracts, 05 Projects, 06 Tasks, 07 Customer Portal, 08 Finance, 09 Income & Expense, 10 Employees, 12 Messaging, 13 Support, 17 Documents, 18 Time Tracking, 19 Calendar.

## 1. Purpose

The Notifications & Activity Center is the single notification engine of the Agency Operating System. It receives events from every module, decides who should be told, how and when, and delivers the result through the recipient's configured channels.

Core rule:

**Modules emit events. The notification engine owns recipients, channels, preferences, inbox, digests and delivery.**

## 2. Core Concepts

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

Recipients can be:

* Members (internal users, defined in 01)
* Customer Portal users (defined in 01 §79, surfaced in 07)
* External collaborators and guests (01 §77–78)
* Teams (expanded to Members at delivery time)
* Roles or scopes (for example "all Finance Managers in the Athens branch")

Recipient resolution always respects organization isolation and the permission layer. A recipient never receives a notification about a record they cannot read.

## 4. Event Catalog

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

## 5. Channels

Supported channels:

* **In-app** (always available, always stored)
* **Email** (delivered through 11 Communication Center)
* **SMS** (delivered through 11 Communication Center, opt-in)
* **Push** (mobile and browser)
* **Desktop**

Channel availability can be restricted per organization. Customer Portal users receive in-app (portal), email and optionally SMS.

Email and SMS notifications are notifications, not communications. Campaigns, templates and customer messaging remain in 11.

## 6. Preferences

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

The Activity Center is the unified inbox for the user.

Capabilities:

* Grouped by module, record, or time
* Filters: unread, mentions, assigned to me, approvals, by module
* Actions on an item: mark read, mark unread, open source record, snooze, act (approve, reply, complete) where the source module supports it
* Mark all read
* Search
* Pinned approvals section listing everything waiting on the user

The Customer Portal exposes a customer-scoped inbox built on the same engine.

## 8. Digests

Users can receive digests instead of immediate notifications for selected event types.

* Hourly, daily, weekly
* Per module or per channel (12 Messaging channel digest)
* Links back to the exact record or message

## 9. Delivery Rules

* Deduplicate: the same event never produces two notifications for one recipient on one channel.
* Coalesce: rapid repeated events on the same record collapse into one notification where the event type allows it.
* Order: notifications are delivered in event order per recipient.
* Retry: failed channel deliveries are retried with backoff; in-app delivery never fails silently.
* Expiry: notifications can carry an expiry after which they are not delivered (for example reminders for a meeting that has passed).
* Idempotency: events carry an ID; redelivered events do not create duplicate notifications.

## 10. Templates & Localization

Each event type has a notification template per channel with variables from the event payload.

Templates support the recipient's language and time zone (01 §127). Organization branding (01 §15) is applied to email templates.

## 11. Privacy & Security

* Recipient resolution enforces organization isolation and record permissions.
* Push, desktop and email previews may be configured to hide content.
* Customer Portal users never receive internal-only events.
* Notification content is not a substitute for permission checks; opening the source record re-evaluates access.

## 12. Permissions

* `notifications.preferences.manage_own`
* `notifications.defaults.manage` (organization defaults, mandatory events)
* `notifications.templates.manage`
* `notifications.audit.read`

Permission keys follow the naming convention in 01 §46.

## 13. Audit

Audit the delivery of mandatory and security notifications, template changes and organization default changes.

## 14. API & Webhooks

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

Delivery principles follow the platform standard in `docs/Product_Specification.md` §4.

## 15. Recommended MVP

* Event catalog and registration
* In-app and email channels
* Per-user preferences with organization defaults
* Activity Center inbox with read state and approvals section
* Daily digest
* Deduplication, retry and idempotency
* Customer Portal inbox

## 16. Phase 2

* SMS and push channels
* Keyword subscriptions
* Coalescing rules
* Per-record follow/mute
* Rules engine integration with 20 Automation Engine
* Notification analytics

## 17. Success Criteria

* No module implements its own delivery channels or preference store.
* A user configures notification behavior in one place for the whole platform.
* Customers see only customer-safe events.
* The same event never reaches a recipient twice on the same channel.
