import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { AccessReviewDecision, AccessReviewStatus, ReviewerStrategy } from "@/features/admin/access-reviews/interfaces/access-reviews.interfaces";

/** AccessReviewStatus (01 §98). */
export const AccessReviewStatusFormOptions: DropdownOption<AccessReviewStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "IN_PROGRESS", label: "In progress" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const AccessReviewStatusFilterOptions: DropdownOption<AccessReviewStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...AccessReviewStatusFormOptions];

/** AccessReviewDecision (01 §98). */
export const AccessReviewDecisionFormOptions: DropdownOption<AccessReviewDecision>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "CERTIFIED", label: "Certified" },
    { id: "REVOKED", label: "Revoked" },
    { id: "MODIFIED", label: "Modified" },
];
export const AccessReviewDecisionFilterOptions: DropdownOption<AccessReviewDecision | "all">[] = [{ id: "all", label: "All decisions" }, ...AccessReviewDecisionFormOptions];

/** ReviewerStrategy (01 §98) — how each item's reviewer is chosen on Start. */
export const ReviewerStrategyFormOptions: DropdownOption<ReviewerStrategy>[] = [
    { id: "BRANCH_MANAGERS", label: "Branch managers" },
    { id: "TEAM_LEADS", label: "Team leads" },
    { id: "LINE_MANAGER", label: "Line manager" },
    { id: "SPECIFIC", label: "Specific people" },
];
export const ReviewerStrategyDescriptionOptions: { id: ReviewerStrategy; description: string }[] = [
    { id: "BRANCH_MANAGERS", description: "The manager of each member's branch reviews them." },
    { id: "TEAM_LEADS", description: "The lead of each member's team reviews them." },
    { id: "LINE_MANAGER", description: "Each member's line manager (from People) reviews them." },
    { id: "SPECIFIC", description: "The people you pick share the members between them." },
];
export const getReviewerStrategyDescription = (id: string) => ReviewerStrategyDescriptionOptions.find((o) => o.id === id)?.description ?? "";
