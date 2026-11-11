import { Badge } from "@/components/ui/badge";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    ProposalApprovalDecisionOptions, ProposalApprovalDecisionTone, ProposalStatusFormOptions, ProposalStatusTone, ProposalVersionStatusFormOptions, ProposalVersionStatusTone,
} from "@/config/constants/dropdowns/proposals/proposal-status.options";
import type { MemberRef, ProposalApprovalDecision, ProposalStatus, ProposalVersionStatus } from "@/features/proposals/interfaces/proposals.interfaces";
import { formatMoney, initials, personName } from "@/lib/format";

/** One status badge for list, editor and customer view (same tone everywhere). */
export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
    return <Badge variant={ProposalStatusTone[status]} title={status}>{getDropdownOptionLabel(ProposalStatusFormOptions, status)}</Badge>;
}

export function VersionStatusBadge({ status }: { status: ProposalVersionStatus }) {
    return <Badge variant={ProposalVersionStatusTone[status]} title={status}>{getDropdownOptionLabel(ProposalVersionStatusFormOptions, status)}</Badge>;
}

export function ApprovalDecisionBadge({ decision }: { decision: ProposalApprovalDecision }) {
    return <Badge variant={ProposalApprovalDecisionTone[decision]} title={decision}>{getDropdownOptionLabel(ProposalApprovalDecisionOptions, decision)}</Badge>;
}

export function MemberChip({ member, sub }: { member: MemberRef | null | undefined; sub?: string }) {
    if (!member) return <span className="text-muted-foreground">—</span>;
    const name = personName(member.user);
    return (
        <span className="inline-flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">{initials(name)}</span>
            <span className="min-w-0">
                <span className="block truncate text-[13px] text-foreground">{name}</span>
                {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
            </span>
        </span>
    );
}

export const money = (value: string | number | null | undefined, currency: string) => formatMoney(value ?? 0, currency);
