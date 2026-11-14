import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const eventFormSchema = z
    .object({
        title: z.string().trim().max(300),
        calendar_id: z.string().min(1, "Choose a calendar"),
        event_type_id: z.string().optional(),
        date: z.string().min(1, "Pick a date"),
        end_date: z.string().min(1, "Pick an end date"),
        start_time: z.string(),
        end_time: z.string(),
        all_day: z.boolean(),
        repeat: z.enum(["none", "DAILY", "WEEKLY", "MONTHLY"]),
        repeat_count: z.string().optional(),
        visibility: z.enum(["PRIVATE", "TEAM", "ORGANIZATION", "CUSTOMER_VISIBLE"]),
        location: z.string().trim().max(500).optional(),
        meeting_url: z.union([z.literal(""), z.string().trim().url("Enter a full link (https://…)")]).optional(),
        description: z.string().max(20000).optional(),
        attendee_ids: z.array(z.string()),
        resource_ids: z.array(z.string()),
        guest_emails: z.string().optional(),
        project_id: z.string().optional(),
        lead_id: z.string().optional(),
        contact_id: z.string().optional(),
        reminder: z.string(),
    })
    .superRefine((v, ctx) => {
        if (!v.all_day) {
            if (!HHMM.test(v.start_time)) ctx.addIssue({ code: "custom", message: "Pick a start time", path: ["start_time"] });
            if (!HHMM.test(v.end_time)) ctx.addIssue({ code: "custom", message: "Pick an end time", path: ["end_time"] });
        }
        const start = `${v.date}T${v.all_day ? "00:00" : v.start_time}`;
        const end = `${v.end_date}T${v.all_day ? "23:59" : v.end_time}`;
        if (end <= start) ctx.addIssue({ code: "custom", message: "The end must be after the start", path: ["end_time"] });
        for (const email of (v.guest_emails ?? "").split(/[,\s]+/).filter(Boolean)) {
            if (!z.string().email().safeParse(email).success) {
                ctx.addIssue({ code: "custom", message: `${email} is not a valid email`, path: ["guest_emails"] });
                break;
            }
        }
    });
export type EventFormValues = z.infer<typeof eventFormSchema>;

export const bookingLinkFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,59}$/, "2–60 lowercase letters, digits and dashes"),
    description: z.string().max(5000).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]),
    host_assignment: z.enum(["SINGLE", "ROUND_ROBIN", "COLLECTIVE"]),
    host_ids: z.array(z.string()).min(1, "Add at least one host"),
    duration_minutes: z.string().regex(/^\d+$/, "Whole minutes").refine((v) => +v >= 5 && +v <= 480, "5 to 480 minutes"),
    buffer_after_minutes: z.string().regex(/^\d+$/, "Whole minutes").refine((v) => +v <= 240, "At most 240 minutes"),
    min_notice_minutes: z.string().regex(/^\d+$/, "Whole minutes").refine((v) => +v <= 43200, "At most 30 days"),
    max_days_ahead: z.string().regex(/^\d+$/, "Whole days").refine((v) => +v >= 1 && +v <= 365, "1 to 365 days"),
    requires_confirmation: z.boolean(),
    location: z.string().max(500).optional(),
    confirmation_message: z.string().max(2000).optional(),
});
export type BookingLinkFormValues = z.infer<typeof bookingLinkFormSchema>;

export const calendarFormSchema = z
    .object({
        kind: z.enum(["PERSONAL", "TEAM", "ORGANIZATION"]),
        name: z.string().trim().min(1, "Enter a name").max(120),
        description: z.string().max(1000).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #2563eb"),
        team_id: z.string().optional(),
        default_visibility: z.enum(["PRIVATE", "TEAM", "ORGANIZATION", "CUSTOMER_VISIBLE"]),
        free_busy_only: z.boolean(),
    })
    .refine((v) => v.kind !== "TEAM" || !!v.team_id, { message: "Choose a team", path: ["team_id"] });
export type CalendarFormValues = z.infer<typeof calendarFormSchema>;

export const resourceFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    kind: z.enum(["ROOM", "EQUIPMENT", "VEHICLE", "OTHER"]),
    code: z.string().trim().max(30).optional(),
    capacity: z.string().regex(/^\d*$/, "Whole number").optional(),
    location: z.string().trim().max(200).optional(),
    description: z.string().max(1000).optional(),
    requires_approval: z.boolean(),
});
export type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export const publicBookingFormSchema = z.object({
    name: z.string().trim().min(1, "Enter your name").max(120),
    email: z.string().trim().email("Enter a valid email"),
    phone: z.string().trim().max(40).optional(),
    notes: z.string().max(2000).optional(),
    answers: z.record(z.string(), z.string()),
});
export type PublicBookingFormValues = z.infer<typeof publicBookingFormSchema>;
