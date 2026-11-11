import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    DeliverableStatusFormOptions,
    ProjectHealthFormOptions,
    ProjectItemStatusFormOptions,
    ProjectPriorityFormOptions,
    SeverityFormOptions,
} from "@/config/constants/dropdowns/projects/project-form.options";
import type { DeliverableStatus, ProjectHealth, ProjectItemStatus, ProjectPriority, ProjectStatusCategory, Severity } from "@/features/projects/interfaces/projects.interfaces";

/** Badge tone per semantic color token stored on statuses / labels. */
export const toneVariant = (color: string | null | undefined): BadgeVariant => {
    const map: Record<string, BadgeVariant> = { info: "info", success: "success", warning: "warning", danger: "danger", violet: "violet", neutral: "neutral" };
    return map[color ?? ""] ?? "neutral";
};

/** Dot background per semantic color token (projects have a color). */
export const toneDot = (color: string | null | undefined) => {
    const map: Record<string, string> = { info: "bg-info", success: "bg-success", warning: "bg-warning", danger: "bg-danger", violet: "bg-violet", neutral: "bg-ash" };
    return map[color ?? ""] ?? "bg-ash";
};

const healthVariant: Record<ProjectHealth, BadgeVariant> = { HEALTHY: "success", AT_RISK: "warning", BLOCKED: "danger", CRITICAL: "danger", UNKNOWN: "neutral" };
const categoryVariant: Partial<Record<ProjectStatusCategory, BadgeVariant>> = { IN_PROGRESS: "info", ON_HOLD: "warning", BLOCKED: "danger", READY_FOR_COMPLETION: "violet", COMPLETED: "success" };
const itemVariant: Record<ProjectItemStatus, BadgeVariant> = { PLANNED: "neutral", IN_PROGRESS: "info", AT_RISK: "warning", COMPLETED: "success", CANCELLED: "neutral" };
const deliverableVariant: Record<DeliverableStatus, BadgeVariant> = {
    PLANNED: "neutral", IN_PROGRESS: "info", READY_FOR_REVIEW: "violet", SUBMITTED: "violet", CHANGES_REQUESTED: "warning", ACCEPTED: "success", REJECTED: "danger", CANCELLED: "neutral",
};
const severityVariant: Record<Severity, BadgeVariant> = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", CRITICAL: "danger" };
const priorityVariant: Record<ProjectPriority, BadgeVariant> = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", CRITICAL: "danger" };

export function HealthBadge({ health }: { health: ProjectHealth }) {
    return <Badge variant={healthVariant[health]} dot>{getDropdownOptionLabel(ProjectHealthFormOptions, health)}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: { name: string; category: ProjectStatusCategory; color?: string | null } | null }) {
    if (!status) return <Badge>No status</Badge>;
    return <Badge variant={status.color ? toneVariant(status.color) : categoryVariant[status.category] ?? "neutral"}>{status.name}</Badge>;
}

export function ItemStatusBadge({ status }: { status: ProjectItemStatus }) {
    return <Badge variant={itemVariant[status]}>{getDropdownOptionLabel(ProjectItemStatusFormOptions, status)}</Badge>;
}

export function DeliverableStatusBadge({ status }: { status: DeliverableStatus }) {
    return <Badge variant={deliverableVariant[status]}>{getDropdownOptionLabel(DeliverableStatusFormOptions, status)}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
    return <Badge variant={severityVariant[severity]}>{getDropdownOptionLabel(SeverityFormOptions, severity)}</Badge>;
}

export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
    return <Badge variant={priorityVariant[priority]}>{getDropdownOptionLabel(ProjectPriorityFormOptions, priority)}</Badge>;
}

export function ProjectDot({ color, className }: { color: string | null | undefined; className?: string }) {
    return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", toneDot(color), className)} />;
}

export { ProgressBar } from "@/components/ui/progress-bar";
