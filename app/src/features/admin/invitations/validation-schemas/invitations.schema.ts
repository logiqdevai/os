import { z } from "zod";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split "a@x.com, b@y.com\nc@z.com" into a clean list. */
export const parseEmails = (raw: string) => [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];

export const inviteFormSchema = z.object({
    emails: z
        .string()
        .trim()
        .min(1, "Enter at least one email address")
        .refine((v) => parseEmails(v).every((e) => EMAIL.test(e)), "One of the email addresses is not valid")
        .refine((v) => parseEmails(v).length <= 50, "Invite at most 50 people at once"),
    type: z.enum(["INTERNAL", "EXTERNAL_COLLABORATOR", "GUEST"]),
    role_id: z.string(),
    branch_id: z.string(),
    team_id: z.string(),
    expires_in_days: z.enum(["3", "7", "14", "30"]),
    valid_until: z.string(),
    message: z.string().trim().max(1000),
});
export type InviteFormValues = z.infer<typeof inviteFormSchema>;
