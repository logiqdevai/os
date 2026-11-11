import { AlarmClock, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    ConversationStatusOptions,
    ConversationStatusTone,
    PriorityTone,
    StatusCategoryTone,
    TicketPriorityFormOptions,
} from "@/config/constants/dropdowns/support/support.options";
import type { ConversationStatus, StatusRef, TicketPriority } from "@/features/support/interfaces/support.interfaces";

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
    return <Badge variant={PriorityTone[priority]}>{getDropdownOptionLabel(TicketPriorityFormOptions, priority)}</Badge>;
}

export function TicketStatusBadge({ status }: { status: StatusRef | null | undefined }) {
    if (!status) return <Badge variant="neutral">No status</Badge>;
    return <Badge variant={StatusCategoryTone[status.category]} dot>{status.name}</Badge>;
}

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
    return <Badge variant={ConversationStatusTone[status]}>{getDropdownOptionLabel(ConversationStatusOptions, status)}</Badge>;
}

/** Remaining time until an SLA due date, compact ("2h 10m", "-35m"). */
export function slaRemaining(due: string | null | undefined): { text: string; overdue: boolean; minutes: number } | null {
    if (!due) return null;
    const minutes = Math.round((new Date(due).getTime() - Date.now()) / 60_000);
    const abs = Math.abs(minutes);
    const d = Math.floor(abs / 1440);
    const h = Math.floor((abs % 1440) / 60);
    const m = abs % 60;
    const text = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
    return { text: minutes < 0 ? `-${text}` : text, overdue: minutes < 0, minutes };
}

/** SLA chip: breached / at risk / time left to the next due date. */
export function SlaChip({ breached, atRisk, due, compact }: { breached: boolean; atRisk: boolean; due?: string | null; compact?: boolean }) {
    const rem = slaRemaining(due);
    if (!breached && !atRisk && !rem) return compact ? null : <span className="text-xs text-ash">—</span>;
    const variant = breached || rem?.overdue ? "danger" : atRisk ? "warning" : "neutral";
    const label = breached ? (compact ? "SLA" : "Breached") : rem ? rem.text : "At risk";
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span>
                    <Badge variant={variant} className="tabular">
                        {breached ? <CircleAlert className="size-3" /> : <AlarmClock className="size-3" />}
                        {label}
                    </Badge>
                </span>
            </TooltipTrigger>
            <TooltipContent>{breached ? "SLA breached" : atRisk ? "SLA at risk" : "Next SLA target"}{due ? ` · due ${formatDateTime(due)}` : ""}</TooltipContent>
        </Tooltip>
    );
}
