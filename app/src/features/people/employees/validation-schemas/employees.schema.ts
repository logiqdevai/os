import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const employeeFormSchema = z
    .object({
        source: z.enum(["member", "new"]),
        membership_id: z.string().optional(),
        email: z.string().trim().optional(),
        first_name: optionalText(80),
        last_name: optionalText(80),
        job_title: z.string().trim().min(1, "Enter a job title").max(120),
        seniority_level: z.string().optional(),
        employment_type: z.enum(["FULL_TIME", "PART_TIME", "CONTRACTOR", "INTERN"]),
        employment_status: z.enum(["ONBOARDING", "ACTIVE", "ON_LEAVE", "SUSPENDED", "OFFBOARDING", "TERMINATED"]),
        work_location: z.enum(["OFFICE", "REMOTE", "HYBRID", "CLIENT_SITE", "TRAVEL"]),
        hire_date: z.string().optional(),
        probation_end_date: z.string().optional(),
        manager_employee_id: z.string().optional(),
        primary_branch_id: z.string().optional(),
        work_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
        work_phone: optionalText(40),
        weekly_capacity_hours: z.string().optional(),
    })
    .superRefine((v, ctx) => {
        if (v.source === "member" && !v.membership_id) ctx.addIssue({ code: "custom", path: ["membership_id"], message: "Pick a member" });
        if (v.source === "new") {
            if (!v.email || !z.string().email().safeParse(v.email).success) ctx.addIssue({ code: "custom", path: ["email"], message: "Enter the new hire's email" });
            if (!v.first_name) ctx.addIssue({ code: "custom", path: ["first_name"], message: "Enter a first name" });
            if (!v.last_name) ctx.addIssue({ code: "custom", path: ["last_name"], message: "Enter a last name" });
        }
        if (v.weekly_capacity_hours && (Number.isNaN(Number(v.weekly_capacity_hours)) || Number(v.weekly_capacity_hours) < 0 || Number(v.weekly_capacity_hours) > 80)) {
            ctx.addIssue({ code: "custom", path: ["weekly_capacity_hours"], message: "0–80 hours" });
        }
    });
export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export const offboardingFormSchema = z.object({
    termination_date: z.string().min(1, "Pick the last working day"),
    termination_kind: z.enum(["RESIGNATION", "DISMISSAL", "END_OF_CONTRACT", "REDUNDANCY", "RETIREMENT", "MUTUAL_AGREEMENT", "OTHER"]),
    termination_reason: optionalText(2000),
    rehire_eligible: z.boolean(),
});
export type OffboardingFormValues = z.infer<typeof offboardingFormSchema>;

export const compensationFormSchema = z.object({
    effective_from: z.string().min(1, "Pick a date"),
    pay_type: z.enum(["MONTHLY_SALARY", "HOURLY", "DAILY", "PER_PROJECT"]),
    base_amount: z.string().refine((v) => Number(v) > 0, "Enter an amount"),
    currency: z.string().regex(/^[A-Z]{3}$/, "3-letter currency"),
    cost_rate_hourly: z.string().optional(),
    contracted_weekly_hours: z.string().optional(),
    reason: optionalText(500),
});
export type CompensationFormValues = z.infer<typeof compensationFormSchema>;
