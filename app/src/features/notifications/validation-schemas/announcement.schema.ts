import { z } from "zod";

export const announcementFormSchema = z
    .object({
        title: z.string().trim().min(1, "Enter a title").max(200),
        body: z.string().trim().min(1, "Write the announcement").max(10000),
        severity: z.enum(["LOW", "NORMAL", "IMPORTANT", "CRITICAL"]),
        requires_ack: z.boolean(),
        /** "all" = every active member; "custom" = the union of the selected members, teams and branches. */
        audience_mode: z.enum(["all", "custom"]),
        membership_ids: z.array(z.string()),
        team_ids: z.array(z.string()),
        branch_ids: z.array(z.string()),
        /** datetime-local values ("" = none). */
        publish_at: z.string().optional(),
        expires_at: z.string().optional(),
    })
    .refine((v) => v.audience_mode === "all" || v.membership_ids.length + v.team_ids.length + v.branch_ids.length > 0, { message: "Pick at least one member, team or branch", path: ["membership_ids"] })
    .refine((v) => !v.publish_at || !v.expires_at || new Date(v.expires_at) > new Date(v.publish_at), { message: "Expiry must be after the publish time", path: ["expires_at"] });
export type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;
