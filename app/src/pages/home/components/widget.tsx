import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { getApiErrorStatus } from "@/lib/api-error";
import { cn } from "@/lib/utils";

export type Tone = "brand" | "info" | "success" | "warning" | "danger" | "neutral";

const TONE: Record<Tone, string> = {
    brand: "bg-primary/10 text-primary",
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    neutral: "bg-muted text-muted-foreground",
};

/** Soft tinted rounded icon tile used in widget headers and stat cards. */
export function IconChip({ icon: Icon, tone = "brand", className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
    return (
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", TONE[tone], className)}>
            <Icon className="size-[18px]" />
        </span>
    );
}

/** Small rounded pill label (status, counts, hints). */
export function Pill({ tone = "brand", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
    return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[tone], className)}>{children}</span>;
}

/** Playful-but-minimal KPI tile for Home. */
export function HomeStat({ label, value, pill, hint, icon, tone = "brand", loading }: { label: string; value: ReactNode; pill?: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: Tone; loading?: boolean }) {
    return (
        <div className="rounded-2xl border border-border-soft bg-card p-4 transition-transform hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium text-foreground">{label}</span>
                <IconChip icon={icon} tone={tone} />
            </div>
            <div className="mt-1 flex items-center gap-2">
                <span className="text-3xl font-semibold tracking-tight text-foreground tabular">{loading ? "—" : value}</span>
                {pill && <Pill tone={tone}>{pill}</Pill>}
            </div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
    );
}

interface WidgetProps {
    title: string;
    icon?: LucideIcon;
    tone?: Tone;
    link?: { to: string; label: string };
    loading?: boolean;
    error?: unknown;
    empty?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    emptySlot?: ReactNode;
    children?: ReactNode;
    className?: string;
}

/**
 * Home widget card: per-widget loading / empty / error. A 404 from a module that is not available yet shows the empty state
 * (Home must keep working while modules are built or disabled).
 */
export function Widget({ title, icon, tone = "brand", link, loading, error, empty, emptyTitle = "Nothing here", emptyDescription, emptySlot, children, className }: WidgetProps) {
    const status = error ? getApiErrorStatus(error) : null;
    return (
        <section className={cn("flex min-w-0 flex-col rounded-2xl border border-border-soft bg-card p-4", className)}>
            <header className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">{icon && <IconChip icon={icon} tone={tone} />}{title}</h2>
                {link && <Link to={link.to} className="text-xs font-medium text-primary hover:underline">{link.label}</Link>}
            </header>
            <div className="min-h-0 flex-1 space-y-2">
                {loading ? (
                    <>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</>
                ) : error && status !== 404 ? (
                    <EmptyState compact icon={CircleAlert} title={status === 403 ? "No access" : "Couldn't load this"} />
                ) : empty || status === 404 ? (
                    emptySlot ?? <EmptyState compact title={emptyTitle} description={emptyDescription} />
                ) : (
                    children
                )}
            </div>
        </section>
    );
}

const ROW = "flex items-center gap-3 rounded-xl bg-muted/60 px-3.5 py-2.5";

export function WidgetRow({ to, title, meta, right, highlight, className }: { to?: string; title: ReactNode; meta?: ReactNode; right?: ReactNode; highlight?: boolean; className?: string }) {
    const body = (
        <>
            <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-foreground">{title}</div>
                {meta && <div className="truncate text-xs text-muted-foreground">{meta}</div>}
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </>
    );
    const cls = cn(ROW, highlight && "border-l-[3px] border-primary bg-primary/5", className);
    return to ? <Link to={to} className={cn(cls, "transition-colors hover:bg-accent")}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Friendly all-clear block shown when a widget has nothing to do. */
export function AllClear({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
    return (
        <div className={cn(ROW, "py-3.5")}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success"><CircleCheck className="size-[18px]" /></span>
            <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-foreground">{title}</div>
                {description && <div className="text-xs text-muted-foreground">{description}</div>}
            </div>
            {action}
        </div>
    );
}
