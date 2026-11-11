import { z } from "zod";

export const taskFormSchema = z.object({
    title: z.string().trim().min(1, "Give the task a title").max(300),
    description: z.string().max(50000).optional(),
    team_id: z.string(),
    status_id: z.string().optional(),
    priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]),
    assignee_membership_id: z.string().nullable(),
    project_id: z.string().nullable(),
    due_date: z.string().optional(),
    estimate_points: z.string().optional().refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Enter a number"),
    label_ids: z.array(z.string()),
});
export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const cycleFormSchema = z
    .object({
        team_id: z.string().min(1, "Choose a team"),
        name: z.string().trim().max(120).optional(),
        goal: z.string().trim().max(2000).optional(),
        starts_at: z.string().min(1, "Pick a start date"),
        ends_at: z.string().min(1, "Pick an end date"),
    })
    .refine((v) => v.ends_at >= v.starts_at, { path: ["ends_at"], message: "Ends before it starts" });
export type CycleFormValues = z.infer<typeof cycleFormSchema>;

export const releaseFormSchema = z.object({
    name: z.string().trim().min(1, "Name the release").max(160),
    version: z.string().trim().max(40).optional(),
    project_id: z.string().nullable(),
    target_date: z.string().optional(),
    notes: z.string().max(50000).optional(),
    customer_visible: z.boolean(),
});
export type ReleaseFormValues = z.infer<typeof releaseFormSchema>;
