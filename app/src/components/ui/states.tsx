import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, Inbox, Lock, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";

interface StateProps {
    icon?: LucideIcon;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
    compact?: boolean;
}

/** Centered empty / info state. Use inside cards and pages (never a blank screen). */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact }: StateProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-16", className)}>
            <div className="grid size-10 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground">
                <Icon className="size-5" />
            </div>
            <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{title}</p>
                {description && <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">{description}</p>}
            </div>
            {action}
        </div>
    );
}

/** 403 state (roles-and-permissions rule §4): clear message, not a crash or blank page. */
export function NoAccessState({ description }: { description?: string }) {
    return (
        <EmptyState
            icon={Lock}
            title="You don't have access to this"
            description={description ?? "Ask an administrator of your organization for the permission you need."}
        />
    );
}

/** Error state from any API error: 403 → no access, 404 → not found, else retry. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
    const status = getApiErrorStatus(error);
    if (status === 403) return <NoAccessState />;
    if (status === 404) return <EmptyState icon={SearchX} title="Not found" description="It may have been deleted, or you may not have access to it." className={className} />;
    return (
        <EmptyState
            icon={CircleAlert}
            title="Couldn't load this"
            description={getApiErrorMessage(error)}
            className={className}
            action={onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
        />
    );
}

/** Skeleton rows for tables and lists. */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
    return (
        <div className={cn("space-y-2 p-4", className)}>
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
            ))}
        </div>
    );
}

export function PageSkeleton() {
    return (
        <div className="space-y-4 p-6">
            <Skeleton className="h-7 w-56" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                ))}
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );
}
