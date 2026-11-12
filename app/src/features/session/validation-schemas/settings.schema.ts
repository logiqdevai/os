import { z } from "zod";

export const profileSettingsSchema = z.object({
    first_name: z.string().trim().min(1, "Enter your first name").max(80),
    last_name: z.string().trim().min(1, "Enter your last name").max(80),
    display_name: z.string().trim().max(120),
    timezone: z.string(),
    locale: z.string().trim().max(16),
    phone: z.union([z.literal(""), z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Use international format, e.g. +306912345678")]),
});
export type ProfileSettingsFormValues = z.infer<typeof profileSettingsSchema>;

export const changePasswordSchema = z
    .object({
        current_password: z.string().min(1, "Enter your current password"),
        new_password: z.string().min(8, "Use at least 8 characters").max(128),
        confirm: z.string(),
    })
    .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
    .refine((v) => v.new_password !== v.current_password, { path: ["new_password"], message: "Choose a different password" });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
