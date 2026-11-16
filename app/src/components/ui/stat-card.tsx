import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: LucideIcon;
    tone?: "default" | "info" | "success" | "warning" | "danger";
    className?: string;
}

const chipClass = {
    default: "bg-primary/10 text-primary",
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
} as const;

const hintClass = {
    default: "text-muted-foreground",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
} as const;

/** KPI tile (dashboards): rounded card with a soft tinted icon chip. */
export function StatCard({ label, value, hint, icon: Icon, tone = "default", className }: StatCardProps) {
    return (
        <div className={cn("rounded-2xl border border-border-soft bg-card p-4", className)}>
            <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium text-foreground">{label}</span>
                {Icon && <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", chipClass[tone])}><Icon className="size-[18px]" /></span>}
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-foreground tabular">{value}</div>
            {hint && <div className={cn("mt-1 text-xs", hintClass[tone])}>{hint}</div>}
        </div>
    );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}
