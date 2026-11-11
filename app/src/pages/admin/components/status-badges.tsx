import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { MembershipStatusFormOptions } from "@/config/constants/dropdowns/admin/membership-form.options";
import { InvitationStatusFormOptions, RoleStatusFormOptions } from "@/config/constants/dropdowns/admin/access-form.options";
import { AuditOutcomeFormOptions, IntegrationStatusFormOptions, McpCallStatusFormOptions, ServiceAccountStatusFormOptions } from "@/config/constants/dropdowns/admin/developer-form.options";

/** Color maps only (labels come from config/constants/dropdowns). */
const memberTone: Record<string, BadgeVariant> = { ACTIVE: "success", INVITED: "info", SUSPENDED: "warning", DEACTIVATED: "neutral" };
const roleTone: Record<string, BadgeVariant> = { PUBLISHED: "success", DRAFT: "warning", DEPRECATED: "neutral" };
const invitationTone: Record<string, BadgeVariant> = { PENDING: "info", ACCEPTED: "success", EXPIRED: "neutral", CANCELLED: "neutral", REJECTED: "danger" };
const accountTone: Record<string, BadgeVariant> = { ACTIVE: "success", SUSPENDED: "warning", REVOKED: "neutral" };
const mcpTone: Record<string, BadgeVariant> = { SUCCEEDED: "success", FAILED: "danger", DENIED: "danger", AWAITING_CONFIRMATION: "warning", REJECTED: "neutral", EXPIRED: "neutral" };
const outcomeTone: Record<string, BadgeVariant> = { SUCCESS: "success", FAILURE: "warning", DENIED: "danger" };
const integrationTone: Record<string, BadgeVariant> = { ACTIVE: "success", PENDING: "info", ERROR: "danger", DISABLED: "warning", DISCONNECTED: "neutral" };

export const MemberStatusBadge = ({ status }: { status: string }) => <Badge variant={memberTone[status] ?? "neutral"} dot>{getDropdownOptionLabel(MembershipStatusFormOptions, status)}</Badge>;
export const RoleStatusBadge = ({ status }: { status: string }) => <Badge variant={roleTone[status] ?? "neutral"}>{getDropdownOptionLabel(RoleStatusFormOptions, status)}</Badge>;
export const InvitationStatusBadge = ({ status }: { status: string }) => <Badge variant={invitationTone[status] ?? "neutral"} dot>{getDropdownOptionLabel(InvitationStatusFormOptions, status)}</Badge>;
export const ServiceAccountStatusBadge = ({ status }: { status: string }) => <Badge variant={accountTone[status] ?? "neutral"} dot>{getDropdownOptionLabel(ServiceAccountStatusFormOptions, status)}</Badge>;
export const McpCallStatusBadge = ({ status }: { status: string }) => <Badge variant={mcpTone[status] ?? "neutral"}>{getDropdownOptionLabel(McpCallStatusFormOptions, status)}</Badge>;
export const AuditOutcomeBadge = ({ outcome }: { outcome: string }) => <Badge variant={outcomeTone[outcome] ?? "neutral"}>{getDropdownOptionLabel(AuditOutcomeFormOptions, outcome)}</Badge>;
export const IntegrationStatusBadge = ({ status }: { status: string }) => <Badge variant={integrationTone[status] ?? "neutral"} dot>{getDropdownOptionLabel(IntegrationStatusFormOptions, status)}</Badge>;
