import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { CircleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { getApiErrorStatus } from "@/lib/api-error";
import { cn } from "@/lib/utils";

interface WidgetProps {
    title: string;
    icon?: LucideIcon;
    link?: { to: string; label: string };
    loading?: boolean;
    error?: unknown;
    empty?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    children?: ReactNode;
    className?: string;
}

/**
 * Home widget card: per-widget loading / empty / error. A 404 from a module that is not available yet shows the empty state
 * (Home must keep working while modules are built or disabled).
 */
export function Widget({ title, icon: Icon, link, loading, error, empty, emptyTitle = "Nothing here", emptyDescription, children, className }: WidgetProps) {
    const status = error ? getApiErrorStatus(error) : null;
    return (
        <section className={cn("flex min-w-0 flex-col rounded-lg border border-border bg-card", className)}>
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground">{Icon && <Icon className="size-4 text-muted-foreground" />}{title}</h2>
                {link && <Link to={link.to} className="text-xs text-muted-foreground hover:text-foreground">{link.label}</Link>}
            </header>
            <div className="min-h-0 flex-1">
                {loading ? (
                    <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : error && status !== 404 ? (
                    <EmptyState compact icon={CircleAlert} title={status === 403 ? "No access" : "Couldn't load this"} />
                ) : empty || status === 404 ? (
                    <EmptyState compact title={emptyTitle} description={emptyDescription} />
                ) : (
                    children
                )}
            </div>
        </section>
    );
}

export function WidgetRow({ to, title, meta, right }: { to?: string; title: ReactNode; meta?: ReactNode; right?: ReactNode }) {
    const body = (
        <>
            <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-foreground">{title}</div>
                {meta && <div className="truncate text-xs text-muted-foreground">{meta}</div>}
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </>
    );
    const cls = "flex items-center gap-3 border-b border-border-soft px-4 py-2.5 last:border-b-0";
    return to ? <Link to={to} className={cn(cls, "hover:bg-accent/50")}>{body}</Link> : <div className={cls}>{body}</div>;
}
