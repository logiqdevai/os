import { cn } from "@/lib/utils";

/** Thin progress bar using semantic tokens. */
export function ProgressBar({ value, tone = "default", className }: { value: number; tone?: "default" | "success" | "warning" | "danger"; className?: string }) {
    const bar = { default: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
    return (
        <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
        </div>
    );
}
