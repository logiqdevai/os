import { z } from "zod";

export const activityFormSchema = z.object({
    type: z.enum(["CALL", "MEETING", "EMAIL", "FOLLOW_UP", "REMINDER", "APPOINTMENT", "INTERNAL_COMMENT", "OTHER"]),
    mode: z.enum(["schedule", "log"]),
    title: z.string().trim().min(1, "Enter a title").max(200),
    starts_at: z.string().optional(),
    duration_minutes: z.string().trim().regex(/^(\d{1,4})?$/, "Minutes").optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
    direction: z.enum(["INBOUND", "OUTBOUND"]).optional(),
    owner_membership_id: z.string().optional(),
    location: z.string().trim().max(300).optional(),
    meeting_url: z.string().trim().max(500).optional(),
    description: z.string().trim().max(5000).optional(),
    outcome: z.string().trim().max(2000).optional(),
});
export type ActivityFormValues = z.infer<typeof activityFormSchema>;
