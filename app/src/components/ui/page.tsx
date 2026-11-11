import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageMetadata } from "@/hooks/use-page-metadata";

interface PageProps {
    children: ReactNode;
    className?: string;
    /** Constrain width for forms and detail pages. */
    width?: "full" | "wide" | "narrow";
}

/** Scrollable page body with the standard gutters (16px mobile, 24px desktop). */
export function Page({ children, className, width = "full" }: PageProps) {
    return (
        <div
            className={cn(
                "mx-auto w-full px-4 py-5 md:px-6 md:py-6",
                width === "wide" && "max-w-6xl",
                width === "narrow" && "max-w-3xl",
                className
            )}
        >
            {children}
        </div>
    );
}

interface PageHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    /** Buttons on the right; wraps under the title on small screens. */
    actions?: ReactNode;
    /** Back link shown above the title. */
    back?: { to: string; label: string };
    /** Small elements next to the title (badges). */
    meta?: ReactNode;
    /** Sets document.title when the title is a string. */
    documentTitle?: string;
    className?: string;
}

export function PageHeader({ title, description, actions, back, meta, documentTitle, className }: PageHeaderProps) {
    usePageMetadata({ title: documentTitle ?? (typeof title === "string" ? title : undefined) });
    return (
        <div className={cn("mb-5 space-y-2", className)}>
            {back && (
                <Link to={back.to} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                    <ChevronLeft className="size-3.5" />
                    {back.label}
                </Link>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="truncate text-xl font-medium text-foreground">{title}</h1>
                        {meta}
                    </div>
                    {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
            </div>
        </div>
    );
}

/** Titled section inside a page. */
export function Section({ title, description, actions, children, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={cn("space-y-3", className)}>
            {(title || actions) && (
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        {title && <h2 className="text-[15px] font-medium text-foreground">{title}</h2>}
                        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
                    </div>
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

/** Label/value grid for detail pages. */
export function KeyValueList({ items, columns = 2, className }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3; className?: string }) {
    return (
        <dl className={cn("grid gap-x-6 gap-y-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3", className)}>
            {items.map((it) => (
                <div key={it.label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{it.label}</dt>
                    <dd className="mt-0.5 truncate text-[13px] text-foreground">{it.value ?? <span className="text-ash">—</span>}</dd>
                </div>
            ))}
        </dl>
    );
}
