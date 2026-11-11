import { AlertOctagon, Circle, CircleCheck, CircleDashed, CircleDot, CircleSlash, Eye, Minus, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import type { BadgeVariant } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { TaskPriorityFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import type { DeploymentStatus, ReleaseStatus, TaskPriority, TaskStatusCategory } from "@/features/tasks/interfaces/tasks.interfaces";
import { cn } from "@/lib/utils";

const categoryIcon = { BACKLOG: CircleDashed, TODO: Circle, IN_PROGRESS: CircleDot, IN_REVIEW: Eye, BLOCKED: AlertOctagon, DONE: CircleCheck, CANCELLED: CircleSlash } as const;
const categoryTone: Record<TaskStatusCategory, string> = {
    BACKLOG: "text-ash", TODO: "text-muted-foreground", IN_PROGRESS: "text-warning", IN_REVIEW: "text-violet", BLOCKED: "text-danger", DONE: "text-success", CANCELLED: "text-ash",
};
const colorTone: Record<string, string> = { info: "text-info", success: "text-success", warning: "text-warning", danger: "text-danger", violet: "text-violet", neutral: "text-muted-foreground" };

/** Linear-style status glyph: shape from the category, tone from the status color. */
export function StatusIcon({ category, color, className }: { category: TaskStatusCategory | null | undefined; color?: string | null; className?: string }) {
    const Icon = categoryIcon[category ?? "TODO"];
    const tone = color && color !== "neutral" ? colorTone[color] : categoryTone[category ?? "TODO"];
    return <Icon aria-hidden className={cn("size-4 shrink-0", tone, className)} />;
}

const priorityIcon = { NONE: Minus, LOW: SignalLow, MEDIUM: SignalMedium, HIGH: SignalHigh, URGENT: AlertOctagon } as const;
const priorityTone: Record<TaskPriority, string> = { NONE: "text-ash", LOW: "text-muted-foreground", MEDIUM: "text-muted-foreground", HIGH: "text-foreground", URGENT: "text-danger" };

export function PriorityIcon({ priority, className }: { priority: TaskPriority; className?: string }) {
    const Icon = priorityIcon[priority];
    const label = getDropdownOptionLabel(TaskPriorityFormOptions, priority);
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex" aria-label={label}><Icon className={cn("size-4 shrink-0", priorityTone[priority], className)} /></span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

export function PriorityGlyph({ priority }: { priority: TaskPriority }) {
    const Icon = priorityIcon[priority];
    return <Icon aria-hidden className={cn("size-4 shrink-0", priorityTone[priority])} />;
}

/** Small colored dot for labels. */
export function LabelDot({ color }: { color: string | null | undefined }) {
    const bg: Record<string, string> = { info: "bg-info", success: "bg-success", warning: "bg-warning", danger: "bg-danger", violet: "bg-violet", neutral: "bg-ash" };
    return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", bg[color ?? ""] ?? "bg-ash")} />;
}

export function LabelChip({ label }: { label: { name: string; color: string | null } }) {
    return (
        <span className="inline-flex h-5 items-center gap-1 rounded-full border border-border px-1.5 text-[11px] text-muted-foreground">
            <LabelDot color={label.color} />
            {label.name}
        </span>
    );
}


/** Badge tones for releases and deployments. */
export const releaseVariant: Record<ReleaseStatus, BadgeVariant> = { PLANNED: "neutral", IN_PROGRESS: "info", RELEASED: "success", CANCELLED: "neutral" };
export const deploymentVariant: Record<DeploymentStatus, BadgeVariant> = { PENDING: "neutral", IN_PROGRESS: "info", SUCCEEDED: "success", FAILED: "danger", ROLLED_BACK: "warning" };
