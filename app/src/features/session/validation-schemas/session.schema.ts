import { z } from "zod";

export const signInSchema = z.object({
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(1, "Enter your password"),
});
export type SignInFormValues = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
    first_name: z.string().trim().min(1, "Enter your first name").max(80),
    last_name: z.string().trim().min(1, "Enter your last name").max(80),
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(8, "Use at least 8 characters").max(128),
    organization_name: z.string().trim().max(120).optional(),
});
export type SignUpFormValues = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({ email: z.string().trim().email("Enter a valid email address") });
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
    .object({
        password: z.string().min(8, "Use at least 8 characters").max(128),
        confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const createOrganizationSchema = z.object({ name: z.string().trim().min(2, "Enter at least 2 characters").max(120) });
export type CreateOrganizationFormValues = z.infer<typeof createOrganizationSchema>;
