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

### Owned tables (22)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Configuration** | | | |
| `CalendarEventType` | `calendar_event_types` | [L16848](../../api/prisma/schema.prisma#L16848) | 19 §4 — configurable event types (meeting, customer meeting, kickoff, review, interview, deadline, out of office, focus time, booking …). System types are se… |
| `CalendarPreference` | `calendar_preferences` | [L16883](../../api/prisma/schema.prisma#L16883) | 19 §5, §9 — per-member calendar preferences (default calendar, reminder defaults, view settings). Reminder timing is a user preference (§9). |
| **Calendars** | | | |
| `Calendar` | `calendars` | [L16919](../../api/prisma/schema.prisma#L16919) | 19 §2, §5 — a named collection of events. Exactly one scope column is set according to kind: PERSONAL → owner_membership_id, TEAM → team_id, PROJECT → projec… |
| `CalendarShare` | `calendar_shares` | [L16973](../../api/prisma/schema.prisma#L16973) | 19 §7, §10, §11 — explicit sharing of a calendar with a Member or a Team. Sharing is audited. |
| `CalendarResource` | `calendar_resources` | [L16997](../../api/prisma/schema.prisma#L16997) | 19 §6 — bookable resources (meeting rooms, equipment). Each resource has a RESOURCE calendar (Calendar.resource_id) that holds its bookings for conflict dete… |
| **Events** | | | |
| `CalendarEvent` | `calendar_events` | [L17038](../../api/prisma/schema.prisma#L17038) | 19 §3–4 — the event record. Recurring series: the master row carries recurrence_rule; modified or cancelled occurrences are stored as child rows with recurri… |
| `CalendarEventAttendee` | `calendar_event_attendees` | [L17134](../../api/prisma/schema.prisma#L17134) | 19 §3, §9 — attendees: Members (membership_id), Customer Portal users (user_id, 01 §79), CRM contacts (contact_id, 02) or plain external emails. Exactly one … |
| `CalendarEventResource` | `calendar_event_resources` | [L17174](../../api/prisma/schema.prisma#L17174) | 19 §6 — resource booking (room / equipment) attached to an event, with optional approval. Conflicts are detected against other APPROVED rows for the same res… |
| `CalendarEventReminder` | `calendar_event_reminders` | [L17198](../../api/prisma/schema.prisma#L17198) | 19 §3, §9 — reminders. membership_id null = event default for every attendee; set = a Member's personal override. Emitted to 14 at scheduled_at (next_occurre… |
| `CalendarEventLink` | `calendar_event_links` | [L17221](../../api/prisma/schema.prisma#L17221) | 19 §3 — related records: project, customer, deal, contract, ticket (13), task, lead, proposal, invoice … Polymorphic via RecordEntityType; company_id / proje… |
| `CalendarEventAttachment` | `calendar_event_attachments` | [L17239](../../api/prisma/schema.prisma#L17239) | 19 §3 — attachments are Documents (17); id only. |
| **Availability** | | | |
| `CalendarAvailabilitySchedule` | `calendar_availability_schedules` | [L17264](../../api/prisma/schema.prisma#L17264) | 19 §6 — a scheduling availability schedule (weekly hours + date overrides) for free/busy, slot suggestions and booking links. Employee working hours, leave a… |
| `CalendarAvailabilityRule` | `calendar_availability_rules` | [L17292](../../api/prisma/schema.prisma#L17292) | 19 §6 — weekly recurring availability window. Several rows per weekday allow split shifts. |
| `CalendarAvailabilityOverride` | `calendar_availability_overrides` | [L17309](../../api/prisma/schema.prisma#L17309) | 19 §6 — date-specific override: block a day / hours (UNAVAILABLE) or open extra hours (AVAILABLE). Null start/end times mean the whole day. |
| **Booking links** | | | |
| `BookingLink` | `booking_links` | [L17330](../../api/prisma/schema.prisma#L17330) | 19 §6, §8 — self-scheduling page for customers and prospects (used by 02 and 13; portal users see them in 07 §11). Slots are computed from the hosts' availab… |
| `BookingLinkHost` | `booking_link_hosts` | [L17408](../../api/prisma/schema.prisma#L17408) | 19 §6 — Members who can be booked through a link. For ROUND_ROBIN the next host is chosen by priority then least-recently-booked; COLLECTIVE requires every h… |
| `CalendarBooking` | `calendar_bookings` | [L17428](../../api/prisma/schema.prisma#L17428) | 19 §6, §8, §12 — a booked slot. Confirmed bookings own one CalendarEvent (source BOOKING) and emit `calendar.booking_created`. The invitee is a portal user (… |
| **External sync** | | | |
| `CalendarConnection` | `calendar_connections` | [L17496](../../api/prisma/schema.prisma#L17496) | 19 §7, §10 — an OAuth connection to Google Calendar or Microsoft 365. membership_id set = a Member's personal connection (calendar.sync.manage_own); null = o… |
| `CalendarConnectionCalendar` | `calendar_connection_calendars` | [L17536](../../api/prisma/schema.prisma#L17536) | 19 §7 — a remote calendar discovered on a connection and its mapping to a local Calendar. Local events of calendar_id are pushed and remote events are pulled… |
| `CalendarEventSyncMapping` | `calendar_event_sync_mappings` | [L17570](../../api/prisma/schema.prisma#L17570) | 19 §7 — one row per (event, connected calendar): the remote id, the provider's last-modified timestamp used to resolve conflicts, and the sync state. Overwri… |
| `CalendarSyncRun` | `calendar_sync_runs` | [L17601](../../api/prisma/schema.prisma#L17601) | 19 §7 — queryable history of sync runs per connection (full or incremental), for diagnostics. |
| **Conferencing** | | | |
| `CalendarConferencingAccount` | `calendar_conferencing_accounts` | [L17628](../../api/prisma/schema.prisma#L17628) | 19 §3 — connected video-conferencing accounts used to auto-create meeting links for events and bookings. GOOGLE_MEET / MICROSOFT_TEAMS may reuse the Calendar… |

**Owned enums (24):** `CalendarKind`, `CalendarResourceKind`, `CalendarShareRole`, `CalendarEventStatus`, `CalendarEventVisibility`, `CalendarEventSource`, `CalendarAttendeeKind`, `CalendarAttendeeRole`, `CalendarAttendeeResponse`, `CalendarResourceBookingStatus`, `CalendarReminderMethod`, `CalendarAvailabilityOverrideKind`, `BookingLinkStatus`, `BookingHostAssignment`, `BookingLinkAudience`, `CalendarBookingStatus`, `CalendarBookingSource`, `CalendarProvider`, `CalendarConnectionStatus`, `CalendarSyncDirection`, `CalendarSyncMappingStatus`, `CalendarSyncRunStatus`, `ConferencingProvider`, `ConferencingAccountStatus`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Calendar.branch`, `CalendarEvent.branch`, `CalendarResource.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `BookingLink.owner`, `BookingLinkHost.membership`, `Calendar.owner`, `CalendarAvailabilitySchedule.membership` +8 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `BookingLink.organization`, `Calendar.organization`, `CalendarAvailabilitySchedule.organization`, `CalendarBooking.organization` +5 more |
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

- `CrmActivity.calendar_event_id` ([02](./02-crm-sales-management.md), [L2415](../../api/prisma/schema.prisma#L2415)) — Calendar event id (19); id only.
- `ProjectMilestone.customer_visible` ([05](./05-project-management.md), [L4573](../../api/prisma/schema.prisma#L4573)) — Shown in the Customer Portal (05 §60) and projected onto the Calendar (19).
- `EmployeeAvailabilityEntry.calendar_event_id` ([10](./10-employee-management-system.md), [L8351](../../api/prisma/schema.prisma#L8351)) — 19 CalendarEvent — the projected or originating event.
- `LeaveRequest.calendar_event_id` ([10](./10-employee-management-system.md), [L8528](../../api/prisma/schema.prisma#L8528)) — 19 CalendarEvent created for approved leave.
- `PerformanceReview.meeting_event_id` ([10](./10-employee-management-system.md), [L8811](../../api/prisma/schema.prisma#L8811)) — 19 CalendarEvent — review meeting.
- `ChannelCall.calendar_event_id` ([12](./12-messaging-team-communication.md), [L11701](../../api/prisma/schema.prisma#L11701)) — 19 CalendarEvent when scheduled as a meeting; id only.
- `SlaPolicy.calendar_id` ([13](./13-customer-support-communication-hub.md), [L12383](../../api/prisma/schema.prisma#L12383)) — 19 Calendar id used for holidays when business hours apply; id only.
- `TimeEntry.calendar_event_id` ([18](./18-time-tracking.md), [L16243](../../api/prisma/schema.prisma#L16243)) — Calendar event (19) this entry was captured from; id only.
- `TimeSuggestion.calendar_event_id` ([18](./18-time-tracking.md), [L16450](../../api/prisma/schema.prisma#L16450)) — Calendar event (19) the suggestion came from; id only.

<!-- schema-refs:end -->

## 1. Purpose

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Calendar is the scheduling layer of the Agency Operating System. It stores events, resolves availability and synchronizes with external calendars.

Core rule:

**Modules own their dates (milestone date, contract expiry, invoice due). Calendar owns events (meetings, bookings, reminders) and renders both together.**

## 2. Core Concepts

<!-- schema-section:start -->
> **Schema:** `Calendar` ([calendars](../../api/prisma/schema.prisma#L16919)) · enum `CalendarKind` ([L16654](../../api/prisma/schema.prisma#L16654))
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
> **Schema:** `CalendarConferencingAccount` ([calendar_conferencing_accounts](../../api/prisma/schema.prisma#L17628)) · `CalendarEvent` ([calendar_events](../../api/prisma/schema.prisma#L17038)) · `CalendarEventAttachment` ([calendar_event_attachments](../../api/prisma/schema.prisma#L17239)): `document_id` · `CalendarEventAttendee` ([calendar_event_attendees](../../api/prisma/schema.prisma#L17134)) · `CalendarEventLink` ([calendar_event_links](../../api/prisma/schema.prisma#L17221)) · `CalendarEventReminder` ([calendar_event_reminders](../../api/prisma/schema.prisma#L17198)) · enum `CalendarAttendeeKind` ([L16705](../../api/prisma/schema.prisma#L16705)) · enum `CalendarAttendeeResponse` ([L16720](../../api/prisma/schema.prisma#L16720)) · enum `CalendarAttendeeRole` ([L16713](../../api/prisma/schema.prisma#L16713)) · enum `CalendarEventSource` ([L16697](../../api/prisma/schema.prisma#L16697)) · enum `CalendarEventStatus` ([L16682](../../api/prisma/schema.prisma#L16682)) · enum `CalendarEventVisibility` ([L16689](../../api/prisma/schema.prisma#L16689)) · enum `ConferencingAccountStatus` ([L16838](../../api/prisma/schema.prisma#L16838)) · enum `ConferencingProvider` ([L16830](../../api/prisma/schema.prisma#L16830))
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
> **Schema:** `CalendarEvent` ([calendar_events](../../api/prisma/schema.prisma#L17038)) · `CalendarEventType` ([calendar_event_types](../../api/prisma/schema.prisma#L16848))
<!-- schema-section:end -->

Configurable, for example: meeting, customer meeting, kickoff, review, interview, deadline, out of office, focus time, booking.

CRM meetings (02 §15) are Calendar events of type customer meeting linked to CRM records. CRM stores outcome notes and follow-ups on its records; the event itself lives here.

## 5. Views

<!-- schema-section:start -->
> **Schema:** `Calendar` ([calendars](../../api/prisma/schema.prisma#L16919)) · `CalendarPreference` ([calendar_preferences](../../api/prisma/schema.prisma#L16883))
<!-- schema-section:end -->

* Day, week, month, agenda
* Personal, team, project, customer and branch calendars
* Overlay multiple calendars
* Filter projected dates by module

Project timeline and roadmap views remain in 05; the Calendar only renders dated items.

## 6. Scheduling & Availability

<!-- schema-section:start -->
> **Schema:** `BookingLink` ([booking_links](../../api/prisma/schema.prisma#L17330)) · `BookingLinkHost` ([booking_link_hosts](../../api/prisma/schema.prisma#L17408)) · `CalendarAvailabilityOverride` ([calendar_availability_overrides](../../api/prisma/schema.prisma#L17309)) · `CalendarAvailabilityRule` ([calendar_availability_rules](../../api/prisma/schema.prisma#L17292)) · `CalendarAvailabilitySchedule` ([calendar_availability_schedules](../../api/prisma/schema.prisma#L17264)) · `CalendarBooking` ([calendar_bookings](../../api/prisma/schema.prisma#L17428)) · `CalendarEventResource` ([calendar_event_resources](../../api/prisma/schema.prisma#L17174)) · `CalendarResource` ([calendar_resources](../../api/prisma/schema.prisma#L16997)) · enum `BookingHostAssignment` ([L16758](../../api/prisma/schema.prisma#L16758)) · enum `BookingLinkAudience` ([L16765](../../api/prisma/schema.prisma#L16765)) · enum `BookingLinkStatus` ([L16750](../../api/prisma/schema.prisma#L16750)) · enum `CalendarAvailabilityOverrideKind` ([L16744](../../api/prisma/schema.prisma#L16744)) · enum `CalendarBookingSource` ([L16782](../../api/prisma/schema.prisma#L16782)) · enum `CalendarBookingStatus` ([L16772](../../api/prisma/schema.prisma#L16772)) · enum `CalendarResourceBookingStatus` ([L16728](../../api/prisma/schema.prisma#L16728)) · enum `CalendarResourceKind` ([L16666](../../api/prisma/schema.prisma#L16666))
<!-- schema-section:end -->

* Free/busy lookup across attendees respecting working hours, branch holidays and leave
* Suggested slots
* Booking links for customers to self-schedule with selected Members (used by 02 and 13)
* Resource booking (rooms, equipment)
* Conflict warnings

## 7. External Sync

<!-- schema-section:start -->
> **Schema:** `CalendarConnection` ([calendar_connections](../../api/prisma/schema.prisma#L17496)) · `CalendarConnectionCalendar` ([calendar_connection_calendars](../../api/prisma/schema.prisma#L17536)) · `CalendarEventSyncMapping` ([calendar_event_sync_mappings](../../api/prisma/schema.prisma#L17570)) · `CalendarShare` ([calendar_shares](../../api/prisma/schema.prisma#L16973)) · `CalendarSyncRun` ([calendar_sync_runs](../../api/prisma/schema.prisma#L17601)) · enum `CalendarConnectionStatus` ([L16796](../../api/prisma/schema.prisma#L16796)) · enum `CalendarProvider` ([L16790](../../api/prisma/schema.prisma#L16790)) · enum `CalendarShareRole` ([L16674](../../api/prisma/schema.prisma#L16674)) · enum `CalendarSyncDirection` ([L16805](../../api/prisma/schema.prisma#L16805)) · enum `CalendarSyncMappingStatus` ([L16812](../../api/prisma/schema.prisma#L16812)) · enum `CalendarSyncRunStatus` ([L16822](../../api/prisma/schema.prisma#L16822))
<!-- schema-section:end -->

* Two-way sync with Google Calendar and Microsoft 365 per user
* Organization-level sync for shared calendars
* Sync conflicts resolved per provider timestamp; audit of overwritten changes
* External events never expose content to other Members beyond free/busy unless the user shares the calendar

## 8. Customer Portal

<!-- schema-section:start -->
> **Schema:** `BookingLink` ([booking_links](../../api/prisma/schema.prisma#L17330)) · `CalendarBooking` ([calendar_bookings](../../api/prisma/schema.prisma#L17428)) · enum `CalendarEventVisibility` ([L16689](../../api/prisma/schema.prisma#L16689))
<!-- schema-section:end -->

Customer-visible events (meetings, approval deadlines, milestone dates marked visible in 05) appear in the portal calendar. Internal events are never exposed.

## 9. Notifications

<!-- schema-section:start -->
> **Schema:** `CalendarEventAttendee` ([calendar_event_attendees](../../api/prisma/schema.prisma#L17134)) · `CalendarEventReminder` ([calendar_event_reminders](../../api/prisma/schema.prisma#L17198)) · `CalendarPreference` ([calendar_preferences](../../api/prisma/schema.prisma#L16883)) · enum `CalendarReminderMethod` ([L16736](../../api/prisma/schema.prisma#L16736))
<!-- schema-section:end -->

Invitations, responses, updates, cancellations and reminders are emitted as events to 14. Reminder timing is a user preference.

## 10. Permissions

<!-- schema-section:start -->
> **Schema:** `CalendarConnection` ([calendar_connections](../../api/prisma/schema.prisma#L17496)) · `CalendarShare` ([calendar_shares](../../api/prisma/schema.prisma#L16973)) · enum `CalendarShareRole` ([L16674](../../api/prisma/schema.prisma#L16674)) — other modules: `Permission` ([permissions](../../api/prisma/schema.prisma#L1224)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

* `calendar.events.read_own / create / update_own / delete_own`
* `calendar.calendars.read_team / manage`
* `calendar.availability.read`
* `calendar.sync.manage_own`
* `calendar.booking_links.manage`

Projected dates inherit the permissions of the source record.

## 11. Audit

<!-- schema-section:start -->
> **Schema:** `CalendarShare` ([calendar_shares](../../api/prisma/schema.prisma#L16973)) — other modules: `AuditEvent` ([audit_events](../../api/prisma/schema.prisma#L1570)) ([01](./01-users-organizations-permissions.md))
<!-- schema-section:end -->

Audit event creation, changes to attendees, cancellation, sync overwrites and calendar sharing.

## 12. API & Webhooks

<!-- schema-section:start -->
> **Schema:** `CalendarBooking` ([calendar_bookings](../../api/prisma/schema.prisma#L17428)) — other modules: `OutboundWebhook` ([outbound_webhooks](../../api/prisma/schema.prisma#L18603)) ([20](./20-automation-engine.md))
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
