import { z } from "zod";

const url = z.union([z.literal(""), z.string().trim().url("Enter a full URL starting with https://")]);
const hex = z.union([z.literal(""), z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #2563eb")]);

export const organizationProfileSchema = z.object({
    display_name: z.string().trim().min(2, "Use at least 2 characters").max(120),
    legal_name: z.string().trim().min(2, "Use at least 2 characters").max(200),
    short_name: z.string().trim().max(40),
    website: url,
    contact_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
    contact_phone: z.string().trim().max(40),
    country: z.string(),
    default_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "3-letter code, e.g. EUR"),
    default_timezone: z.string().min(1),
    default_language: z.string().trim().min(2).max(16),
    date_format: z.string().trim().max(32),
    week_start: z.enum(["1", "6", "7"]),
});
export type OrganizationProfileFormValues = z.infer<typeof organizationProfileSchema>;

export const brandingSchema = z.object({
    primary_color: hex,
    accent_color: hex,
    email_footer: z.string().trim().max(300),
    apply_to_portal: z.boolean(),
});
export type BrandingFormValues = z.infer<typeof brandingSchema>;
