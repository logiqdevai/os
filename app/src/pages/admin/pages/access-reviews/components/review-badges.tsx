import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { AccessReviewDecisionFormOptions, AccessReviewStatusFormOptions } from "@/config/constants/dropdowns/admin/access-review-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";

/** Color maps only (labels come from config/constants/dropdowns). */
const statusTone: Record<string, BadgeVariant> = { DRAFT: "neutral", IN_PROGRESS: "info", COMPLETED: "success", CANCELLED: "neutral" };
const decisionTone: Record<string, BadgeVariant> = { PENDING: "neutral", CERTIFIED: "success", REVOKED: "danger", MODIFIED: "warning" };

export const AccessReviewStatusBadge = ({ status }: { status: string }) => <Badge variant={statusTone[status] ?? "neutral"} dot>{getDropdownOptionLabel(AccessReviewStatusFormOptions, status)}</Badge>;
export const AccessReviewDecisionBadge = ({ decision }: { decision: string }) => <Badge variant={decisionTone[decision] ?? "neutral"}>{getDropdownOptionLabel(AccessReviewDecisionFormOptions, decision)}</Badge>;
