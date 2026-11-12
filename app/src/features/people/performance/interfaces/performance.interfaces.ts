import type { PersonUser } from "@/features/people/employees/interfaces/employees.interfaces";

export type ReviewStatus = "DRAFT" | "SELF_ASSESSMENT" | "MANAGER_ASSESSMENT" | "SUBMITTED" | "COMPLETED" | "ACKNOWLEDGED" | "CANCELLED";
export type ReviewType = "ANNUAL" | "SEMI_ANNUAL" | "QUARTERLY" | "PROBATION" | "PROJECT" | "ONE_ON_ONE" | "AD_HOC";
export type CycleStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type GoalStatus = "NOT_STARTED" | "IN_PROGRESS" | "AT_RISK" | "ACHIEVED" | "PARTIALLY_ACHIEVED" | "MISSED" | "CANCELLED";
export type GoalKind = "GOAL" | "OBJECTIVE" | "KEY_RESULT";
export type FeedbackKind = "MANAGER_FEEDBACK" | "EMPLOYEE_FEEDBACK" | "PEER_FEEDBACK" | "PERFORMANCE_NOTE" | "ACHIEVEMENT" | "RECOGNITION";
export type FeedbackVisibility = "MANAGERS_ONLY" | "EMPLOYEE_VISIBLE" | "PUBLIC";

export interface ReviewCycle {
    id: string;
    name: string;
    type: ReviewType;
    status: CycleStatus;
    period_start: string;
    period_end: string;
    due_date: string | null;
    template: { rating_scale_max?: number; criteria?: { key: string; label: string }[] } | null;
    review_count: number;
    completed_count: number;
}

export interface ReviewEmployee {
    id: string;
    employee_number: string;
    name: string;
    job_title: string | null;
    membership_id: string;
}

export interface Review {
    id: string;
    status: ReviewStatus;
    type: ReviewType;
    title: string | null;
    period_start: string;
    period_end: string;
    due_date: string | null;
    self_assessment: string | null;
    manager_assessment: string | null;
    ratings: Record<string, number> | null;
    overall_rating: string | null;
    rating_scale_max: number;
    strengths: string | null;
    improvement_areas: string | null;
    summary: string | null;
    employee_comment: string | null;
    completed_at: string | null;
    acknowledged_at: string | null;
    employee: ReviewEmployee;
    reviewer: { id: string; user: PersonUser } | null;
    cycle: { id: string; name: string; template?: ReviewCycle["template"] } | null;
    is_mine: boolean;
    is_reviewer: boolean;
}

export interface Goal {
    id: string;
    kind: GoalKind;
    title: string;
    description: string | null;
    status: GoalStatus;
    progress_percent: string;
    target_value: string | null;
    current_value: string | null;
    unit: string | null;
    due_date: string | null;
    parent_goal_id: string | null;
    employee: ReviewEmployee;
    is_mine: boolean;
    updates: { id: string; note: string | null; progress_percent: string | null; created_at: string }[];
}

export interface Feedback {
    id: string;
    kind: FeedbackKind;
    visibility: FeedbackVisibility;
    title: string | null;
    body: string;
    is_anonymous: boolean;
    created_at: string;
    employee: ReviewEmployee;
    author: { id: string; user: PersonUser } | null;
}

export type PipStatus = "DRAFT" | "ACTIVE" | "COMPLETED_SUCCESSFUL" | "COMPLETED_UNSUCCESSFUL" | "CANCELLED";
export type PipItemStatus = "OPEN" | "MET" | "NOT_MET";

export interface ImprovementPlan {
    id: string;
    status: PipStatus;
    title: string;
    reason: string | null;
    objectives: string | null;
    start_date: string;
    end_date: string;
    check_in_frequency_days: number | null;
    next_check_in_on: string | null;
    manager_membership_id: string | null;
    hr_membership_id: string | null;
    outcome_note: string | null;
    closed_at: string | null;
    employee: ReviewEmployee;
    review: { id: string; title: string | null } | null;
    items: { id: string; title: string; description: string | null; due_date: string | null; status: PipItemStatus; evaluated_at: string | null; note: string | null }[];
    is_mine: boolean;
    met_count: number;
    check_in_due: boolean;
}

export interface PipDto {
    employee_id: string;
    title: string;
    reason?: string;
    objectives?: string;
    start_date: string;
    end_date: string;
    check_in_frequency_days?: number;
    items?: { title: string; due_date?: string }[];
}

export type FeedbackRequestStatus = "PENDING" | "SUBMITTED" | "DECLINED" | "EXPIRED" | "CANCELLED";

export interface FeedbackRequest {
    id: string;
    status: FeedbackRequestStatus;
    due_date: string | null;
    message: string | null;
    is_anonymous: boolean;
    decline_reason: string | null;
    responded_at: string | null;
    created_at: string;
    employee: ReviewEmployee;
    requested_by: { id: string; user: PersonUser } | null;
    requested_from: { id: string; user: PersonUser };
    review: { id: string; title: string | null } | null;
    cycle: { id: string; name: string } | null;
    is_recipient: boolean;
    is_requester: boolean;
    overdue: boolean;
    feedback_id: string | null;
}

export interface CalibrationView {
    cycle: { id: string; name: string; status: CycleStatus; rating_scale_max: number };
    distribution: { rating: number; count: number }[];
    average: number | null;
    reviews: {
        id: string;
        status: ReviewStatus;
        overall_rating: string | null;
        rating_scale_max: number;
        employee: ReviewEmployee & { department: { id: string; name: string } | null };
        reviewer: { id: string; user: PersonUser } | null;
        calibrations: { id: string; original_rating: string | null; calibrated_rating: string; reason: string; calibrated_by_membership_id: string | null; created_at: string }[];
        can_calibrate: boolean;
    }[];
}
