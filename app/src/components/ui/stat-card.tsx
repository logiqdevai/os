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

const toneClass = {
    default: "text-muted-foreground",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
} as const;

/** KPI tile (dashboards). */
export function StatCard({ label, value, hint, icon: Icon, tone = "default", className }: StatCardProps) {
    return (
        <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                {Icon && <Icon className={cn("size-4", toneClass[tone])} />}
            </div>
            <div className="mt-2 text-2xl font-medium tracking-tight text-foreground tabular">{value}</div>
            {hint && <div className={cn("mt-1 text-xs", tone === "default" ? "text-muted-foreground" : toneClass[tone])}>{hint}</div>}
        </div>
    );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}
