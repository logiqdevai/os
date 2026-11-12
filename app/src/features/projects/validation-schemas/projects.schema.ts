import { z } from "zod";

const optionalNumber = z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Enter a positive number");

export const projectFormSchema = z
    .object({
        name: z.string().trim().min(1, "Enter a name").max(200),
        code: z.string().trim().max(40).optional(),
        description: z.string().trim().max(20000).optional(),
        template_id: z.string().optional(),
        type_id: z.string().optional(),
        company_id: z.string().optional(),
        owner_membership_id: z.string().optional(),
        team_id: z.string().optional(),
        priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
        visibility: z.enum(["INTERNAL", "CUSTOMER_VISIBLE"]),
        planned_start: z.string().optional(),
        target_completion: z.string().optional(),
        budget_hours: optionalNumber,
        budget_amount: optionalNumber,
        currency: z.string().trim().max(3).optional(),
    })
    .refine((v) => !v.planned_start || !v.target_completion || v.target_completion >= v.planned_start, { path: ["target_completion"], message: "Target date is before the start" });
export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const milestoneFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(200),
    description: z.string().trim().max(5000).optional(),
    planned_date: z.string().optional(),
    status: z.enum(["PLANNED", "IN_PROGRESS", "AT_RISK", "COMPLETED", "CANCELLED"]),
    owner_membership_id: z.string().optional(),
    customer_visible: z.boolean(),
    is_billing_milestone: z.boolean(),
});
export type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;

export const deliverableFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(200),
    description: z.string().trim().max(5000).optional(),
    due_date: z.string().optional(),
    status: z.enum(["PLANNED", "IN_PROGRESS", "READY_FOR_REVIEW", "CANCELLED"]),
    milestone_id: z.string().optional(),
    owner_membership_id: z.string().optional(),
    customer_visible: z.boolean(),
});
export type DeliverableFormValues = z.infer<typeof deliverableFormSchema>;

export const riskFormSchema = z.object({
    title: z.string().trim().min(1, "Describe the risk").max(300),
    description: z.string().trim().max(5000).optional(),
    probability: z.string(),
    impact: z.string(),
    status: z.enum(["OPEN", "MONITORING", "MITIGATED", "ACCEPTED", "RESOLVED", "CLOSED"]),
    owner_membership_id: z.string().optional(),
    mitigation: z.string().trim().max(5000).optional(),
    due_date: z.string().optional(),
});
export type RiskFormValues = z.infer<typeof riskFormSchema>;

export const issueFormSchema = z.object({
    title: z.string().trim().min(1, "Describe the issue").max(300),
    kind: z.enum(["ISSUE", "BLOCKER"]),
    description: z.string().trim().max(5000).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"]),
    owner_membership_id: z.string().optional(),
    target_resolution: z.string().optional(),
    resolution: z.string().trim().max(5000).optional(),
});
export type IssueFormValues = z.infer<typeof issueFormSchema>;

export const decisionFormSchema = z.object({
    title: z.string().trim().min(1, "Name the decision").max(300),
    description: z.string().trim().max(5000).optional(),
    selected_option: z.string().trim().max(2000).optional(),
    reason: z.string().trim().max(5000).optional(),
    decided_at: z.string().optional(),
});
export type DecisionFormValues = z.infer<typeof decisionFormSchema>;

export const statusUpdateFormSchema = z.object({
    summary: z.string().trim().min(1, "Write a short summary").max(5000),
    health: z.enum(["HEALTHY", "AT_RISK", "BLOCKED", "CRITICAL", "UNKNOWN"]),
    progress_percent: z.string().optional().refine((v) => !v || (Number(v) >= 0 && Number(v) <= 100), "0–100"),
    completed_work: z.string().trim().max(10000).optional(),
    current_work: z.string().trim().max(10000).optional(),
    upcoming_work: z.string().trim().max(10000).optional(),
    risks_summary: z.string().trim().max(5000).optional(),
    blockers_summary: z.string().trim().max(5000).optional(),
    decisions_summary: z.string().trim().max(5000).optional(),
    required_actions: z.string().trim().max(5000).optional(),
    customer_visible: z.boolean(),
});
export type StatusUpdateFormValues = z.infer<typeof statusUpdateFormSchema>;

export const changeRequestFormSchema = z.object({
    title: z.string().trim().min(1, "Name the change").max(300),
    description: z.string().trim().max(10000).optional(),
    priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
    timeline_impact_days: z.string().optional(),
    customer_visible: z.boolean(),
});
export type ChangeRequestFormValues = z.infer<typeof changeRequestFormSchema>;
