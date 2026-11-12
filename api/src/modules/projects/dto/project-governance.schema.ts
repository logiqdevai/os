import { z } from 'zod';
import { HandoverStatus, ProjectGateKind, ProjectGateStatus, ProjectReviewType } from 'generated/prisma';

/**
 * 05 §46–49, §71–74, §92–94, §102–103 — gates, reviews, checklists, handovers and closeout.
 * The same zod schemas validate REST bodies and MCP tool input.
 */

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use YYYY-MM-DD');
const text = (max = 5000) => z.string().trim().max(max);

// --- Gates ---------------------------------------------------------------------------------

export const CreateGateSchema = z.object({
    kind: z.nativeEnum(ProjectGateKind).optional(),
    name: text(200).min(1),
    description: text().optional(),
    milestone_id: uuid.nullable().optional(),
    approver_membership_id: uuid.nullable().optional(),
    blocks_completion: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(10_000).optional(),
});
export type CreateGateInput = z.infer<typeof CreateGateSchema>;
export const UpdateGateSchema = CreateGateSchema.partial();
export type UpdateGateInput = z.infer<typeof UpdateGateSchema>;

export const DecideGateSchema = z.object({
    decision: z.enum([ProjectGateStatus.PASSED, ProjectGateStatus.FAILED, ProjectGateStatus.WAIVED]),
    comment: text(2000).optional(),
}).refine((v) => v.decision === 'PASSED' || !!v.comment, { message: 'Explain why the gate failed or is waived', path: ['comment'] });
export type DecideGateInput = z.infer<typeof DecideGateSchema>;

// --- Reviews -------------------------------------------------------------------------------

export const ReviewActionSchema = z.object({
    title: text(300).min(1),
    owner_membership_id: uuid.nullable().optional(),
    due_date: date.nullable().optional(),
    task_id: uuid.nullable().optional(),
    done: z.boolean().optional(),
});
export type ReviewAction = z.infer<typeof ReviewActionSchema>;

export const CreateReviewSchema = z.object({
    type: z.nativeEnum(ProjectReviewType),
    title: text(200).min(1),
    held_at: date.nullable().optional(),
    facilitator_membership_id: uuid.nullable().optional(),
    participants: z.array(uuid).max(100).optional(),
    findings: text(20_000).nullable().optional(),
    decisions: text(20_000).nullable().optional(),
    went_well: text(20_000).nullable().optional(),
    went_wrong: text(20_000).nullable().optional(),
    root_causes: text(20_000).nullable().optional(),
    lessons: text(20_000).nullable().optional(),
    actions: z.array(ReviewActionSchema).max(50).optional(),
    milestone_id: uuid.nullable().optional(),
});
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export const UpdateReviewSchema = CreateReviewSchema.partial();
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;

// --- Checklists ----------------------------------------------------------------------------

export const CHECKLIST_PHASES = ['kickoff', 'discovery', 'development', 'qa', 'launch', 'handover', 'closeout', 'custom'] as const;

export const ChecklistItemSchema = z.object({
    title: text(300).min(1),
    is_required: z.boolean().optional(),
});
export const CreateChecklistSchema = z.object({
    name: text(200).min(1),
    phase: z.enum(CHECKLIST_PHASES).nullable().optional(),
    items: z.array(ChecklistItemSchema).max(100).optional(),
});
export type CreateChecklistInput = z.infer<typeof CreateChecklistSchema>;
export const UpdateChecklistSchema = CreateChecklistSchema.omit({ items: true }).partial();
export type UpdateChecklistInput = z.infer<typeof UpdateChecklistSchema>;
export type ChecklistItemInput = z.infer<typeof ChecklistItemSchema>;
export const UpdateChecklistItemSchema = ChecklistItemSchema.partial().extend({ is_completed: z.boolean().optional(), sort_order: z.number().int().min(0).optional() });
export type UpdateChecklistItemInput = z.infer<typeof UpdateChecklistItemSchema>;

// --- Handovers -----------------------------------------------------------------------------

export const HANDOVER_TYPES = ['sales_to_delivery', 'delivery_to_support', 'development_to_qa', 'qa_to_customer', 'project_to_maintenance', 'custom'] as const;

export const HandoverDetailsSchema = z.object({
    checklist: z.array(z.object({ title: text(300).min(1), done: z.boolean().optional() })).max(50).optional(),
    open_items: text(10_000).optional(),
    support_reference: text(500).optional(),
    contacts: text(2000).optional(),
    notes: text(10_000).optional(),
    document_ids: z.array(uuid).max(50).optional(),
});
export const CreateHandoverSchema = z.object({
    type: z.enum(HANDOVER_TYPES),
    from_team_id: uuid.nullable().optional(),
    to_team_id: uuid.nullable().optional(),
    new_owner_membership_id: uuid.nullable().optional(),
    scheduled_at: date.nullable().optional(),
    details: HandoverDetailsSchema.optional(),
});
export type CreateHandoverInput = z.infer<typeof CreateHandoverSchema>;
export const UpdateHandoverSchema = CreateHandoverSchema.partial().extend({ status: z.enum([HandoverStatus.PLANNED, HandoverStatus.IN_PROGRESS, HandoverStatus.CANCELLED]).optional() });
export type UpdateHandoverInput = z.infer<typeof UpdateHandoverSchema>;
export const AcceptHandoverSchema = z.object({
    /** Make the receiving person the project owner (needs projects.projects.update). */
    transfer_ownership: z.boolean().optional(),
    comment: text(2000).optional(),
});
export type AcceptHandoverInput = z.infer<typeof AcceptHandoverSchema>;

// --- Closeout ------------------------------------------------------------------------------

export const UpdateCloseoutSchema = z.object({
    final_status_summary: text(20_000).nullable().optional(),
    outstanding_items: text(20_000).nullable().optional(),
    lessons_learned: text(20_000).nullable().optional(),
    customer_outcome: text(20_000).nullable().optional(),
    financial_review_ref: text(200).nullable().optional(),
    documentation_document_ids: z.array(uuid).max(100).optional(),
    /** true records the customer's acceptance now; false clears it. */
    customer_acceptance_recorded: z.boolean().optional(),
});
export type UpdateCloseoutInput = z.infer<typeof UpdateCloseoutSchema>;

// --- MCP wrappers --------------------------------------------------------------------------

export const ProjectIdSchema = z.object({ project_id: uuid });
export const CreateGateToolSchema = CreateGateSchema.extend({ project_id: uuid });
export const DecideGateToolSchema = z.object({ project_id: uuid, id: uuid, decision: z.enum(['PASSED', 'FAILED', 'WAIVED']), comment: text(2000).optional() });
export const CreateReviewToolSchema = CreateReviewSchema.extend({ project_id: uuid });
export const CreateHandoverToolSchema = CreateHandoverSchema.extend({ project_id: uuid });
export const UpdateChecklistItemToolSchema = UpdateChecklistItemSchema.extend({ project_id: uuid, checklist_id: uuid, id: uuid });
export const CloseProjectToolSchema = UpdateCloseoutSchema.extend({ project_id: uuid });
