import { z } from "zod";

export const settingOptionSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(80),
    color: z.string().optional(),
    is_default: z.boolean(),
    is_converted: z.boolean(),
    is_lost: z.boolean(),
    is_customer: z.boolean(),
    applies_to: z.enum(["DEAL", "LEAD", "BOTH"]),
});
export type SettingOptionValues = z.infer<typeof settingOptionSchema>;

export const tagFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(60),
    color: z.string().optional(),
});
export type TagFormValues = z.infer<typeof tagFormSchema>;
