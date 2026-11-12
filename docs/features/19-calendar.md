# Calendar

> Linear: [LOG-409](https://linear.app/logiqdev/issue/LOG-409/calendar) · Status: Backlog

> **Canonical for:** calendar events, meetings, scheduling, availability lookup and external calendar sync. Other modules create or project dates onto the calendar; this module owns the event record.
>
> **Depends on:** [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) (LOG-406) for time zones, branch business hours and holidays (§120–122) · [10 Employee Management](./10-employee-management-system.md) (LOG-107) for leave and availability · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) for invitations and reminders.
>
> **Consumed by:** 02 CRM (§15 meetings), 04 Contracts (§63 contract dates), 05 Projects (§26, §66 project calendar), 06 Tasks (calendar view of due dates), 07 Customer Portal (customer-visible dates), 10 Employees (leave calendar), 12 Messaging (calls, huddles), 13 Support (scheduled callbacks), 18 Time Tracking (calendar-based entries).

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (23)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Configuration** | | | |
| `CalendarEventType` | `calendar_event_types` | [L20059](../../api/prisma/schema.prisma#L20059) | 19 §4 — configurable event types (meeting, customer meeting, kickoff, review, interview, deadline, out of office, focus time, booking …). System types are se… |
| `CalendarPreference` | `calendar_preferences` | [L20094](../../api/prisma/schema.prisma#L20094) | 19 §5, §9 — per-member calendar preferences (default calendar, reminder defaults, view settings). Reminder timing is a user preference (§9). |
| **Calendars** | | | |
| `Calendar` | `calendars` | [L20130](../../api/prisma/schema.prisma#L20130) | 19 §2, §5 — a named collection of events. Exactly one scope column is set according to kind: PERSONAL → owner_membership_id, TEAM → team_id, PROJECT → projec… |
| `CalendarShare` | `calendar_shares` | [L20188](../../api/prisma/schema.prisma#L20188) | 19 §7, §10, §11 — explicit sharing of a calendar with a Member or a Team. Sharing is audited. |
| `CalendarResource` | `calendar_resources` | [L20212](../../api/prisma/schema.prisma#L20212) | 19 §6 — bookable resources (meeting rooms, equipment). Each resource has a RESOURCE calendar (Calendar.resource_id) that holds its bookings for conflict dete… |
| **Events** | | | |
| `CalendarEvent` | `calendar_events` | [L20253](../../api/prisma/schema.prisma#L20253) | 19 §3–4 — the event record. Recurring series: the master row carries recurrence_rule; modified or cancelled occurrences are stored as child rows with recurri… |
| `CalendarEventAttendee` | `calendar_event_attendees` | [L20356](../../api/prisma/schema.prisma#L20356) | 19 §3, §9 — attendees: Members (membership_id), Customer Portal users (user_id, 01 §79), CRM contacts (contact_id, 02) or plain external emails. Exactly one … |
| `CalendarEventResource` | `calendar_event_resources` | [L20402](../../api/prisma/schema.prisma#L20402) | 19 §6 — resource booking (room / equipment) attached to an event, with optional approval. Conflicts are detected against other APPROVED rows for the same res… |
| `CalendarEventReminder` | `calendar_event_reminders` | [L20426](../../api/prisma/schema.prisma#L20426) | 19 §3, §9 — reminders. membership_id null = event default for every attendee; set = a Member's personal override. Emitted to 14 at scheduled_at (next_occurre… |
| `CalendarEventLink` | `calendar_event_links` | [L20449](../../api/prisma/schema.prisma#L20449) | 19 §3 — related records: project, customer, deal, contract, ticket (13), task, lead, proposal, invoice … Polymorphic via RecordEntityType; company_id / proje… |
| `CalendarEventAttachment` | `calendar_event_attachments` | [L20467](../../api/prisma/schema.prisma#L20467) | 19 §3 — attachments are Documents (17); id only. |
| **Availability** | | | |
| `CalendarAvailabilitySchedule` | `calendar_availability_schedules` | [L20492](../../api/prisma/schema.prisma#L20492) | 19 §6 — a scheduling availability schedule (weekly hours + date overrides) for free/busy, slot suggestions and booking links. Employee working hours, leave a… |
| `CalendarAvailabilityRule` | `calendar_availability_rules` | [L20520](../../api/prisma/schema.prisma#L20520) | 19 §6 — weekly recurring availability window. Several rows per weekday allow split shifts. |
| `CalendarAvailabilityOverride` | `calendar_availability_overrides` | [L20537](../../api/prisma/schema.prisma#L20537) | 19 §6 — date-specific override: block a day / hours (UNAVAILABLE) or open extra hours (AVAILABLE). Null start/end times mean the whole day. |
| **Booking links** | | | |
| `BookingLink` | `booking_links` | [L20558](../../api/prisma/schema.prisma#L20558) | 19 §6, §8 — self-scheduling page for customers and prospects (used by 02 and 13; portal users see them in 07 §11). Slots are computed from the hosts' availab… |
| `BookingLinkHost` | `booking_link_hosts` | [L20637](../../api/prisma/schema.prisma#L20637) | 19 §6 — Members who can be booked through a link. For ROUND_ROBIN the next host is chosen by priority then least-recently-booked; COLLECTIVE requires every h… |
| `CalendarBooking` | `calendar_bookings` | [L20657](../../api/prisma/schema.prisma#L20657) | 19 §6, §8, §12 — a booked slot. Confirmed bookings own one CalendarEvent (source BOOKING) and emit `calendar.booking_created`. The invitee is a portal user (… |
| `BookingLinkStatsDaily` | `booking_link_stats_daily` | [L20723](../../api/prisma/schema.prisma#L20723) | 19 §6, §12 — daily funnel counters of a booking link: page views, slot picks and bookings, with a source breakdown. Incremented by the public booking page / … |
| **External sync** | | | |
| `CalendarConnection` | `calendar_connections` | [L20752](../../api/prisma/schema.prisma#L20752) | 19 §7, §10 — an OAuth connection to Google Calendar or Microsoft 365. membership_id set = a Member's personal connection (calendar.sync.manage_own); null = o… |
| `CalendarConnectionCalendar` | `calendar_connection_calendars` | [L20792](../../api/prisma/schema.prisma#L20792) | 19 §7 — a remote calendar discovered on a connection and its mapping to a local Calendar. Local events of calendar_id are pushed and remote events are pulled… |
| `CalendarEventSyncMapping` | `calendar_event_sync_mappings` | [L20826](../../api/prisma/schema.prisma#L20826) | 19 §7 — one row per (event, connected calendar): the remote id, the provider's last-modified timestamp used to resolve conflicts, and the sync state. Overwri… |
| `CalendarSyncRun` | `calendar_sync_runs` | [L20857](../../api/prisma/schema.prisma#L20857) | 19 §7 — queryable history of sync runs per connection (full or incremental), for diagnostics. |
| **Conferencing** | | | |
| `CalendarConferencingAccount` | `calendar_conferencing_accounts` | [L20884](../../api/prisma/schema.prisma#L20884) | 19 §3 — connected video-conferencing accounts used to auto-create meeting links for events and bookings. GOOGLE_MEET / MICROSOFT_TEAMS may reuse the Calendar… |

**Owned enums (24):** `CalendarKind`, `CalendarResourceKind`, `CalendarShareRole`, `CalendarEventStatus`, `CalendarEventVisibility`, `CalendarEventSource`, `CalendarAttendeeKind`, `CalendarAttendeeRole`, `CalendarAttendeeResponse`, `CalendarResourceBookingStatus`, `CalendarReminderMethod`, `CalendarAvailabilityOverrideKind`, `BookingLinkStatus`, `BookingHostAssignment`, `BookingLinkAudience`, `CalendarBookingStatus`, `CalendarBookingSource`, `CalendarProvider`, `CalendarConnectionStatus`, `CalendarSyncDirection`, `CalendarSyncMappingStatus`, `CalendarSyncRunStatus`, `ConferencingProvider`, `ConferencingAccountStatus`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Calendar.branch`, `CalendarEvent.branch`, `CalendarResource.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `BookingLink.owner`, `BookingLinkHost.membership`, `Calendar.owner`, `CalendarAvailabilitySchedule.membership` +8 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `BookingLink.organization`, `BookingLinkStatsDaily.organization`, `Calendar.organization`, `CalendarAvailabilitySchedule.organization` +6 more |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `Calendar.team`, `CalendarShare.team` |
| [01](./01-users-organizations-permissions.md) | `User` (`users`) | `CalendarBooking.invitee_user`, `CalendarEventAttendee.user` |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `BookingLink.company`, `Calendar.company`, `CalendarBooking.company`, `CalendarEvent.company` |
| [02](./02-crm-sales-management.md) | `CrmContact` (`crm_contacts`) | `CalendarBooking.contact`, `CalendarEventAttendee.contact` |
| [05](./05-project-management.md) | `Project` (`projects`) | `Calendar.project`, `CalendarEvent.project` |
| [17](./17-documents-file-management.md) | `Document` (`documents`) | `CalendarEventAttachment.document` |

**Reused enums:** `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `Membership`
- [02](./02-crm-sales-management.md): `CrmActivity`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `CrmActivity.calendar_event_id` ([02](./02-crm-sales-management.md), [L3236](../../api/prisma/schema.prisma#L3236)) — Calendar event id (19); id only.
- `ProjectMilestone.customer_visible` ([05](./05-project-management.md), [L6000](../../api/prisma/schema.prisma#L6000)) — Shown in the Customer Portal (05 §60) and projected onto the Calendar (19).
- `EmployeeAvailabilityEntry.calendar_event_id` ([10](./10-employee-management-system.md), [L10474](../../api/prisma/schema.prisma#L10474)) — 19 CalendarEvent — the projected or originating event.
- `LeaveRequest.calendar_event_id` ([10](./10-employee-management-system.md), [L10651](../../api/prisma/schema.prisma#L10651)) — 19 CalendarEvent created for approved leave.
- `PerformanceReview.meeting_event_id` ([10](./10-employee-management-system.md), [L10939](../../api/prisma/schema.prisma#L10939)) — 19 CalendarEvent — review meeting.
- `ChannelCall.calendar_event_id` ([12](./12-messaging-team-communication.md), [L14166](../../api/prisma/schema.prisma#L14166)) — 19 CalendarEvent when scheduled as a meeting; id only.
- `SlaPolicy.calendar_id` ([13](./13-customer-support-communication-hub.md), [L15000](../../api/prisma/schema.prisma#L15000)) — 19 Calendar id used for holidays when business hours apply; id only.
- `TimeEntry.calendar_event_id` ([18](./18-time-tracking.md), [L19379](../../api/prisma/schema.prisma#L19379)) — Calendar event (19) this entry was captured from; id only.
- `TimeSuggestion.calendar_event_id` ([18](./18-time-tracking.md), [L19586](../../api/prisma/schema.prisma#L19586)) — Calendar event (19) the suggestion came from; id only.
- `AutomationApprovalPolicy.delegate_when_out_of_office` ([20](./20-automation-engine.md), [L21697](../../api/prisma/schema.prisma#L21697)) — Route to the next approver of the policy while one is on leave (10) or has an out-of-office event (19).

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
| `calendar.availability` | read, manage |
| `calendar.booking_links` | manage |
| `calendar.bookings` | read, manage |
| `calendar.calendars` | manage, read_team |
| `calendar.conferencing` | manage* |
| `calendar.event_types` | manage |
| `calendar.events` | read, manage, create, delete_own, read_own, update_own |
| `calendar.resources` | manage |
| `calendar.sync` | manage_own, manage* |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## 1. Purpose

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Calendar is the scheduling layer of the Agency Operating System. It stores events, resolves availability and synchronizes with external calendars.

Core rule:

**Modules own their dates (milestone date, contract expiry, invoice due). Calendar owns events (meetings, bookings, reminders) and renders both together.**

## 2. Core Concepts

<!-- schema-section:start -->
> **Schema:** `Calendar` ([calendars](../../api/prisma/schema.prisma#L20130)) · enum `CalendarKind` ([L19865](../../api/prisma/schema.prisma#L19865))
<!-- schema-section:end -->

### Event

A scheduled item with start, end, time zone, attendees, location or meeting link, description, visibility and related records.

### Projected Date

A read-only item rendered on the calendar from another module's record: a milestone date (05), a contract renewal date (04), a task due date (06), a leave period (10). Editing it means editing the source record.

### Calendar

A named collection of events: personal, team, project, customer, branch, resource (meeting room), or external (synced).

### Availability

Free/busy state derived from events, working hours (01 §121), holidays (01 §122) and leave (10).

## 3. Event Model

<!-- schema-section:start -->
> **Schema:** `CalendarConferencingAccount` ([calendar_conferencing_accounts](../../api/prisma/schema.prisma#L20884)) · `CalendarEvent` ([calendar_events](../../api/prisma/schema.prisma#L20253)): `guests_can_see_guests` · `CalendarEventAttachment` ([calendar_event_attachments](../../api/prisma/schema.prisma#L20467)): `document_id` · `CalendarEventAttendee` ([calendar_event_attendees](../../api/prisma/schema.prisma#L20356)) · `CalendarEventLink` ([calendar_event_links](../../api/prisma/schema.prisma#L20449)) · `CalendarEventReminder` ([calendar_event_reminders](../../api/prisma/schema.prisma#L20426)) · enum `CalendarAttendeeKind` ([L19916](../../api/prisma/schema.prisma#L19916)) · enum `CalendarAttendeeResponse` ([L19931](../../api/prisma/schema.prisma#L19931)) · enum `CalendarAttendeeRole` ([L19924](../../api/prisma/schema.prisma#L19924)) · enum `CalendarEventSource` ([L19908](../../api/prisma/schema.prisma#L19908)) · enum `CalendarEventStatus` ([L19893](../../api/prisma/schema.prisma#L19893)) · enum `CalendarEventVisibility` ([L19900](../../api/prisma/schema.prisma#L19900)) · enum `ConferencingAccountStatus` ([L20049](../../api/prisma/schema.prisma#L20049)) · enum `ConferencingProvider` ([L20041](../../api/prisma/schema.prisma#L20041))
<!-- schema-section:end -->

* Event ID
* Title, description
* Start, end, all-day flag, time zone
* Recurrence rule
* Organizer
* Attendees (Members, Customer Portal users, external emails) with response state
* Location, meeting link (external video provider)
* Related records: project, customer, deal, contract, ticket, task
* Visibility: private, team, organization, customer-visible
* Reminders
* Attachments (17 Documents)
* Source: internal, synced (provider and external ID)

## 4. Event Types

<!-- schema-section:start -->
> **Schema:** `CalendarEvent` ([calendar_events](../../api/prisma/schema.prisma#L20253)): `auto_decline_invitations`, `auto_reply_message` · `CalendarEventType` ([calendar_event_types](../../api/prisma/schema.prisma#L20059))
<!-- schema-section:end -->

Configurable, for example: meeting, customer meeting, kickoff, review, interview, deadline, out of office, focus time, booking.

CRM meetings (02 §15) are Calendar events of type customer meeting linked to CRM records. CRM stores outcome notes and follow-ups on its records; the event itself lives here.

Out-of-office events can reply and decline for the organizer: `auto_reply_message` is used as the decline comment and `auto_decline_invitations` declines new invitations while the event runs.

## 5. Views

<!-- schema-section:start -->
> **Schema:** `Calendar` ([calendars](../../api/prisma/schema.prisma#L20130)) · `CalendarPreference` ([calendar_preferences](../../api/prisma/schema.prisma#L20094))
<!-- schema-section:end -->

* Day, week, month, agenda
* Personal, team, project, customer and branch calendars
* Overlay multiple calendars
* Filter projected dates by module
* Saved views use `SavedView` with entity type CALENDAR_EVENT and layout `day`, `week`, `month` or `agenda`; filters hold calendar ids, event types, projected modules and statuses.

Project timeline and roadmap views remain in 05; the Calendar only renders dated items.

## 6. Scheduling & Availability

<!-- schema-section:start -->
> **Schema:** `BookingLink` ([booking_links](../../api/prisma/schema.prisma#L20558)) · `BookingLinkHost` ([booking_link_hosts](../../api/prisma/schema.prisma#L20637)) · `BookingLinkStatsDaily` ([booking_link_stats_daily](../../api/prisma/schema.prisma#L20723)) · `CalendarAvailabilityOverride` ([calendar_availability_overrides](../../api/prisma/schema.prisma#L20537)) · `CalendarAvailabilityRule` ([calendar_availability_rules](../../api/prisma/schema.prisma#L20520)) · `CalendarAvailabilitySchedule` ([calendar_availability_schedules](../../api/prisma/schema.prisma#L20492)) · `CalendarBooking` ([calendar_bookings](../../api/prisma/schema.prisma#L20657)) · `CalendarEventResource` ([calendar_event_resources](../../api/prisma/schema.prisma#L20402)) · `CalendarResource` ([calendar_resources](../../api/prisma/schema.prisma#L20212)) · enum `BookingHostAssignment` ([L19969](../../api/prisma/schema.prisma#L19969)) · enum `BookingLinkAudience` ([L19976](../../api/prisma/schema.prisma#L19976)) · enum `BookingLinkStatus` ([L19961](../../api/prisma/schema.prisma#L19961)) · enum `CalendarAvailabilityOverrideKind` ([L19955](../../api/prisma/schema.prisma#L19955)) · enum `CalendarBookingSource` ([L19993](../../api/prisma/schema.prisma#L19993)) · enum `CalendarBookingStatus` ([L19983](../../api/prisma/schema.prisma#L19983)) · enum `CalendarResourceBookingStatus` ([L19939](../../api/prisma/schema.prisma#L19939)) · enum `CalendarResourceKind` ([L19877](../../api/prisma/schema.prisma#L19877))
<!-- schema-section:end -->

* Free/busy lookup across attendees respecting working hours, branch holidays and leave
* Suggested slots
* Booking links for customers to self-schedule with selected Members (used by 02 and 13)
* Resource booking (rooms, equipment)
* Conflict warnings
* Booking links keep daily counters (`BookingLinkStatsDaily`: page views, slot selections, bookings, sources) and no per-visitor rows. Slots are not held while the invitee fills the form: the slot is re-checked on submit and a conflict returns 409 with fresh slots.

## 7. External Sync

<!-- schema-section:start -->
> **Schema:** `Calendar` ([calendars](../../api/prisma/schema.prisma#L20130)): `feed_token` · `CalendarConnection` ([calendar_connections](../../api/prisma/schema.prisma#L20752)) · `CalendarConnectionCalendar` ([calendar_connection_calendars](../../api/prisma/schema.prisma#L20792)) · `CalendarEventSyncMapping` ([calendar_event_sync_mappings](../../api/prisma/schema.prisma#L20826)) · `CalendarShare` ([calendar_shares](../../api/prisma/schema.prisma#L20188)) · `CalendarSyncRun` ([calendar_sync_runs](../../api/prisma/schema.prisma#L20857)) · enum `CalendarConnectionStatus` ([L20007](../../api/prisma/schema.prisma#L20007)) · enum `CalendarProvider` ([L20001](../../api/prisma/schema.prisma#L20001)) · enum `CalendarShareRole` ([L19885](../../api/prisma/schema.prisma#L19885)) · enum `CalendarSyncDirection` ([L20016](../../api/prisma/schema.prisma#L20016)) · enum `CalendarSyncMappingStatus` ([L20023](../../api/prisma/schema.prisma#L20023)) · enum `CalendarSyncRunStatus` ([L20033](../../api/prisma/schema.prisma#L20033))
<!-- schema-section:end -->

* Two-way sync with Google Calendar and Microsoft 365 per user
* Organization-level sync for shared calendars
* Sync conflicts resolved per provider timestamp; audit of overwritten changes
* External events never expose content to other Members beyond free/busy unless the user shares the calendar
* Read-only iCalendar subscription feed per calendar, addressed by a secret `Calendar.feed_token` that can be rotated (`calendar.calendars.manage`); it honours free/busy-only calendars.
* The OAuth client (client id and secret) that Google, Microsoft and Zoom connections use is platform infrastructure (platform environment, like the maps key), not a per-organization integration: members and organizations authorize the Logiqdev app. Only the resulting per-connection tokens are stored, encrypted, on `CalendarConnection` / `CalendarConferencingAccount`.

## 8. Customer Portal

<!-- schema-section:start -->
> **Schema:** `BookingLink` ([booking_links](../../api/prisma/schema.prisma#L20558)) · `CalendarBooking` ([calendar_bookings](../../api/prisma/schema.prisma#L20657)) · enum `CalendarEventVisibility` ([L19900](../../api/prisma/schema.prisma#L19900))
<!-- schema-section:end -->

Customer-visible events (meetings, approval deadlines, milestone dates marked visible in 05) appear in the portal calendar. Internal events are never exposed.

## 9. Notifications

<!-- schema-section:start -->
> **Schema:** `CalendarEvent` ([calendar_events](../../api/prisma/schema.prisma#L20253)): `guests_can_see_guests` · `CalendarEventAttendee` ([calendar_event_attendees](../../api/prisma/schema.prisma#L20356)): `proposed_starts_at` · `CalendarEventReminder` ([calendar_event_reminders](../../api/prisma/schema.prisma#L20426)) · `CalendarPreference` ([calendar_preferences](../../api/prisma/schema.prisma#L20094)) · enum `CalendarReminderMethod` ([L19947](../../api/prisma/schema.prisma#L19947))
<!-- schema-section:end -->

Invitations, responses, updates, cancellations and reminders are emitted as events to 14. Reminder timing is a user preference.

Attendees can propose a new time (`proposed_starts_at`, `proposed_ends_at`, comment on `CalendarEventAttendee`); the organizer accepts, which reschedules the event and re-sends invitations, or dismisses it. `guests_can_see_guests` controls whether non-organizers see the guest list.

## 10. Permissions

<!-- schema-section:start -->
> **Schema:** `CalendarConnection` ([calendar_connections](../../api/prisma/schema.prisma#L20752)) · `CalendarShare` ([calendar_shares](../../api/prisma/schema.prisma#L20188)) · enum `CalendarShareRole` ([L19885](../../api/prisma/schema.prisma#L19885)) — other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1612)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

* `calendar.events.read_own / create / update_own / delete_own`
* `calendar.calendars.read_team / manage`
* `calendar.availability.read`
* `calendar.sync.manage_own`
* `calendar.booking_links.manage`
* `calendar.availability.manage`, `calendar.event_types.manage`, `calendar.conferencing.manage`, `calendar.sync.manage` (organization-level connections)
* `calendar.bookings.read / manage` (list bookings; confirm, decline, cancel, reschedule, mark no-show)
* `calendar.events.read` views every event the Member can reach through scope, calendar sharing or free/busy; `calendar.events.read_own` limits that to events they organize or attend.

Projected dates inherit the permissions of the source record.

## 11. Audit

<!-- schema-section:start -->
> **Schema:** `CalendarShare` ([calendar_shares](../../api/prisma/schema.prisma#L20188)) — other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L2269)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Audit event creation, changes to attendees, cancellation, sync overwrites and calendar sharing.

## 12. API & Webhooks

<!-- schema-section:start -->
> **Schema:** `BookingLinkStatsDaily` ([booking_link_stats_daily](../../api/prisma/schema.prisma#L20723)) · `CalendarBooking` ([calendar_bookings](../../api/prisma/schema.prisma#L20657)) — other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L21913)) ([20](./20-automation-engine.md))
<!-- schema-section:end -->

API: CRUD events, list by range and calendar, free/busy, booking links, sync management.

Webhooks: `calendar.event_created`, `calendar.event_updated`, `calendar.event_cancelled`, `calendar.attendee_responded`, `calendar.booking_created`.

## 13. Recommended MVP

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Personal and project calendars
* Events with attendees and reminders
* Projected dates from 05, 06, 04, 10
* Week and month views
* Google and Microsoft sync for personal calendars

## 14. Phase 2

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

* Availability and slot suggestions
* Booking links
* Resource booking
* Customer Portal calendar
* Shared organization calendars
