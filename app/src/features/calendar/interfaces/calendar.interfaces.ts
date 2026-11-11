import type { PaginationMeta } from "@/components/ui/data-table";

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export type CalendarKind = "PERSONAL" | "TEAM" | "PROJECT" | "CUSTOMER" | "BRANCH" | "ORGANIZATION" | "RESOURCE" | "EXTERNAL";
export type CalendarRole = "FREE_BUSY" | "READ" | "WRITE" | "MANAGE";
export type EventVisibility = "PRIVATE" | "TEAM" | "ORGANIZATION" | "CUSTOMER_VISIBLE";
export type EventStatus = "TENTATIVE" | "CONFIRMED" | "CANCELLED";
export type AttendeeResponse = "NEEDS_ACTION" | "ACCEPTED" | "TENTATIVE" | "DECLINED";
export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY";
export type ResourceKind = "ROOM" | "EQUIPMENT" | "VEHICLE" | "OTHER";
export type BookingLinkStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type BookingLinkAudience = "PUBLIC" | "PORTAL" | "INTERNAL";
export type HostAssignment = "SINGLE" | "ROUND_ROBIN" | "COLLECTIVE";
export type BookingStatus = "PENDING" | "CONFIRMED" | "RESCHEDULED" | "CANCELLED" | "NO_SHOW" | "COMPLETED";
export type CalendarView = "day" | "week" | "month" | "agenda";
/** Token color names stored on calendars / event types / events. */
export type ColorToken = "info" | "success" | "warning" | "danger" | "violet" | "neutral";

export interface Recurrence {
    freq: RecurrenceFreq;
    interval?: number;
    count?: number | null;
    until?: string | null;
    byday?: number[];
}

export interface CalendarSummary {
    id: string;
    name: string;
    color: string | null;
    kind: CalendarKind;
    role: CalendarRole;
    subscribed: boolean;
    is_default: boolean;
    owner_membership_id: string | null;
}

export interface CalendarEventItem {
    id: string;
    key: string;
    /** Set on an edited occurrence of a series (exception row). */
    recurring_event_id?: string | null;
    occurrence_start: string | null;
    starts_at: string;
    ends_at: string;
    all_day: boolean;
    status: EventStatus;
    masked: boolean;
    title: string;
    location: string | null;
    meeting_url: string | null;
    visibility: EventVisibility;
    shows_as_busy: boolean;
    color: string | null;
    recurring: boolean;
    calendar: { id: string; name: string; color: string | null; kind: CalendarKind };
    event_type: { id: string; name: string; slug: string; color: string | null } | null;
    organizer: { id: string; name: string } | null;
    my_response: AttendeeResponse | null;
    is_organizer: boolean;
    attendee_count: number;
    project_id: string | null;
    can_edit: boolean;
    /** Read-only date projected from another module (milestone, task due date, leave); opens `link` there. */
    projected?: { module: ProjectedModule; link: string };
}

export type ProjectedModule = "projects" | "tasks" | "leave";

export interface ProjectedItem {
    key: string;
    module: ProjectedModule;
    kind: "milestone" | "task_due" | "leave";
    title: string;
    start_date: string;
    end_date: string;
    color: string;
    link: string;
    done: boolean;
    detail: string | null;
}

export interface ProjectedResponse {
    data: ProjectedItem[];
    modules: ProjectedModule[];
    /** Modules the caller may overlay (holds the module's read key). */
    available: ProjectedModule[];
}

export interface CalendarEventsResponse {
    data: CalendarEventItem[];
    from: string;
    to: string;
    calendars: CalendarSummary[];
}

export interface EventAttendee {
    id: string;
    kind: "MEMBER" | "PORTAL_USER" | "CONTACT" | "EXTERNAL";
    membership_id: string | null;
    email: string;
    name: string | null;
    role: "REQUIRED" | "OPTIONAL" | "INFORMATIONAL";
    response: AttendeeResponse;
    response_comment: string | null;
    is_organizer: boolean;
    responded_at: string | null;
}

export interface CalendarEventDetail {
    id: string;
    title: string;
    masked: boolean;
    starts_at: string;
    ends_at: string;
    all_day: boolean;
    timezone: string;
    status: EventStatus;
    visibility: EventVisibility;
    shows_as_busy: boolean;
    recurring: boolean;
    /** Edited occurrence of a series: the series id and the start it replaces. */
    recurring_event_id?: string | null;
    original_start_at?: string | null;
    calendar: { id: string; name: string; color: string | null; kind: CalendarKind };
    description?: string | null;
    location?: string | null;
    meeting_url?: string | null;
    color?: string | null;
    guests_can_see_guests?: boolean;
    recurrence?: Recurrence | null;
    event_type?: { id: string; name: string; slug: string; color: string | null } | null;
    organizer?: { id: string; name: string; email: string } | null;
    attendees?: EventAttendee[];
    my_attendee?: { id: string; response: AttendeeResponse; response_comment: string | null } | null;
    reminders?: { id: string; minutes_before: number; method: string; personal: boolean; scheduled_at: string | null }[];
    resources?: { id: string; name: string; kind: ResourceKind; location: string | null; status: string }[];
    project?: { id: string; name: string } | null;
    company?: { id: string; name: string } | null;
    booking?: { id: string; status: BookingStatus; invitee_name: string; invitee_email: string } | null;
    source?: string;
    cancelled_at?: string | null;
    cancellation_reason?: string | null;
    is_organizer?: boolean;
    can_edit: boolean;
    can_delete: boolean;
}

export interface EventDto {
    calendar_id?: string;
    event_type_id?: string;
    title?: string;
    description?: string;
    starts_at: string;
    ends_at: string;
    all_day?: boolean;
    timezone?: string;
    recurrence?: Recurrence | null;
    visibility?: EventVisibility;
    shows_as_busy?: boolean;
    location?: string;
    meeting_url?: string;
    attendees?: { membership_id?: string; email?: string; name?: string }[];
    reminders?: { minutes_before: number }[];
    resource_ids?: string[];
}

export interface CalendarRow {
    id: string;
    kind: CalendarKind;
    name: string;
    description: string | null;
    color: string | null;
    timezone: string | null;
    is_default: boolean;
    default_visibility: EventVisibility;
    free_busy_only: boolean;
    archived_at: string | null;
    role: CalendarRole;
    subscribed: boolean;
    owner: { id: string; name: string } | null;
    scope: { id: string; name: string } | null;
    share_count: number;
    upcoming_events: number;
    /** iCal subscription link is on (the secret itself is never returned after creation). */
    feed_enabled: boolean;
    feed_token_rotated_at: string | null;
}

export interface CalendarFeedResult {
    calendar_id: string;
    url?: string;
    feed_enabled: boolean;
    feed_token_rotated_at?: string;
}

export interface CalendarShare {
    id: string;
    role: CalendarRole;
    expires_at: string | null;
    membership: { id: string; user: { display_name: string | null; first_name: string | null; last_name: string | null; email: string } } | null;
    team: { id: string; name: string } | null;
}

export interface CalendarDetail extends Omit<CalendarRow, "owner" | "scope" | "share_count" | "upcoming_events" | "subscribed"> {
    shares?: CalendarShare[] | false;
    can_manage: boolean;
}

export interface CalendarDto {
    kind: CalendarKind;
    name: string;
    description?: string;
    color?: string;
    team_id?: string;
    default_visibility?: EventVisibility;
    free_busy_only?: boolean;
}

export interface EventType {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string | null;
    is_system: boolean;
    default_duration_minutes: number | null;
    default_visibility: EventVisibility;
    shows_as_busy: boolean;
    is_customer_facing: boolean;
    archived_at: string | null;
}

export interface CalendarPreferences {
    default_calendar_id: string | null;
    timezone: string | null;
    effective_timezone: string;
    default_view: CalendarView;
    week_start: number;
    show_weekends: boolean;
    default_event_duration: number;
    default_reminders: { minutes_before: number }[];
    /** Modules whose dates are overlaid on the grid. */
    projected_modules: ProjectedModule[];
}

export interface Person {
    id: string;
    name: string;
    email: string;
    job_title: string | null;
    photo_url: string | null;
    is_me: boolean;
}

export interface AvailabilityRule {
    weekday: number;
    start_time: string;
    end_time: string;
}

export interface AvailabilityOverride {
    date: string;
    kind: "UNAVAILABLE" | "AVAILABLE";
    start_time: string | null;
    end_time: string | null;
    reason?: string | null;
}

export interface AvailabilitySchedule {
    id: string;
    name: string;
    timezone: string;
    is_default: boolean;
    rules: (AvailabilityRule & { id: string })[];
    overrides: (AvailabilityOverride & { id: string })[];
}

export interface ScheduleDto {
    name: string;
    timezone: string;
    is_default?: boolean;
    rules: AvailabilityRule[];
    overrides?: AvailabilityOverride[];
}

export interface FreeBusyRow {
    membership_id: string;
    name: string;
    photo_url: string | null;
    timezone: string;
    working: { start: string; end: string }[];
    busy: { start: string; end: string; tentative: boolean; title: string | null; event_id: string | null }[];
}

export interface Slot {
    start: string;
    end: string;
}

export interface Resource {
    id: string;
    name: string;
    kind: ResourceKind;
    code: string | null;
    description: string | null;
    capacity: number | null;
    location: string | null;
    requires_approval: boolean;
    archived_at: string | null;
    branch: { id: string; name: string } | null;
}

export interface ResourceDto {
    name: string;
    kind?: ResourceKind;
    code?: string;
    description?: string;
    capacity?: number;
    location?: string;
    requires_approval?: boolean;
}

export interface ResourceRequest {
    id: string;
    status: string;
    resource: { id: string; name: string };
    event: { id: string; title: string; starts_at: string; ends_at: string };
}

export interface BookingQuestion {
    key: string;
    label: string;
    type?: "text" | "textarea";
    required?: boolean;
}

export interface BookingLink {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    status: BookingLinkStatus;
    audience: BookingLinkAudience;
    host_assignment: HostAssignment;
    duration_minutes: number;
    slot_interval_minutes: number;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    min_notice_minutes: number;
    max_days_ahead: number;
    max_bookings_per_day: number | null;
    requires_confirmation: boolean;
    timezone: string | null;
    location: string | null;
    questions: BookingQuestion[] | null;
    confirmation_message: string | null;
    public_path: string;
    hosts: { membership_id: string; priority: number; name: string }[];
    event_type: { id: string; name: string; color: string | null } | null;
    stats_30d: { page_views: number; bookings: number; conversion: number | null };
    _count?: { bookings: number };
}

export interface BookingLinkDto {
    slug: string;
    name: string;
    description?: string;
    status?: BookingLinkStatus;
    audience?: BookingLinkAudience;
    host_assignment?: HostAssignment;
    hosts: { membership_id: string; priority?: number }[];
    duration_minutes?: number;
    slot_interval_minutes?: number;
    buffer_before_minutes?: number;
    buffer_after_minutes?: number;
    min_notice_minutes?: number;
    max_days_ahead?: number;
    requires_confirmation?: boolean;
    timezone?: string;
    location?: string;
    confirmation_message?: string;
}

export interface Booking {
    id: string;
    status: BookingStatus;
    source: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
    invitee_name: string;
    invitee_email: string;
    invitee_phone: string | null;
    answers: Record<string, string> | null;
    notes: string | null;
    cancellation_reason: string | null;
    created_at: string;
    event_id: string | null;
    host_name: string | null;
    booking_link: { id: string; name: string; slug: string; questions?: BookingQuestion[] | null };
}

export interface PublicBookingPage {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    duration_options: number[];
    timezone: string;
    location: string | null;
    questions: BookingQuestion[];
    requires_confirmation: boolean;
    max_days_ahead: number;
    organization: { name: string; logo_url: string | null };
    hosts: { name: string; photo_url: string | null }[];
}

export interface PublicBookingDto {
    starts_at: string;
    timezone: string;
    name: string;
    email: string;
    phone?: string;
    notes?: string;
    answers?: Record<string, string>;
}

export interface PublicBookingResult {
    status: BookingStatus;
    starts_at: string;
    ends_at: string;
    host_name: string;
    confirmation_message: string | null;
    redirect_url: string | null;
}
