import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { cn } from "@/lib/utils";
import { formatDateTime, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DeliverableReviewStatusOptions, DeliverableReviewStatusTone, PortalRequestCategoryTone } from "@/config/constants/dropdowns/portal/portal.options";
import type { PortalFeature, PortalMessage, PortalRequestStatus } from "@/features/portal/interfaces/portal.interfaces";
import type { OutgoingPortalMessage } from "@/features/portal/hooks/use-portal";
import { usePortal } from "./portal-context";

/** Route gate for portal pages: the customer role must hold one of `anyOf`, and the feature must be on. */
export function PortalGate({ anyOf, feature, children }: { anyOf?: string[]; feature?: PortalFeature; children: ReactNode }) {
    const { canAny, feature: on } = usePortal();
    if (feature && !on(feature)) return <EmptyState icon={Lock} title="Not available" description="This part of the portal is switched off for your company." />;
    if (anyOf?.length && !canAny(...anyOf)) return <EmptyState icon={Lock} title="You don't have access to this" description="Ask an administrator of your company for access." />;
    return <>{children}</>;
}

export function PortalHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
    usePageMetadata({ title });
    return (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-2xl font-medium tracking-tight text-foreground">{title}</h1>
                {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    );
}

export function PortalCard({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={cn("min-w-0 rounded-xl border border-border bg-card", className)}>
            {(title || action) && (
                <div className="flex items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
                    {title && <h2 className="text-[14px] font-medium text-foreground">{title}</h2>}
                    {action}
                </div>
            )}
            <div className="p-4">{children}</div>
        </section>
    );
}

export function RequestStatusBadge({ status }: { status: PortalRequestStatus | null }) {
    if (!status) return null;
    return <Badge variant={PortalRequestCategoryTone[status.category]} dot>{status.label}</Badge>;
}

export function DeliverableStatusBadge({ status }: { status: string }) {
    return <Badge variant={DeliverableReviewStatusTone[status] ?? "neutral"}>{getDropdownOptionLabel(DeliverableReviewStatusOptions, status)}</Badge>;
}

export function ProgressBar({ value }: { value: number }) {
    return (
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        </div>
    );
}

/**
 * Public thread for customers: their own messages right, the agency's left. Internal notes never reach the portal.
 * A message just sent shows at once ("Sending…"); a refused one stays with "Not sent · Retry · Discard".
 */
export function PortalThread({ messages, agencyName, onRetry, onDiscard }: { messages: (PortalMessage | OutgoingPortalMessage)[]; agencyName: string; onRetry?: (m: OutgoingPortalMessage) => void; onDiscard?: (m: OutgoingPortalMessage) => void }) {
    if (!messages.length) return <p className="py-6 text-center text-[13px] text-muted-foreground">No messages yet.</p>;
    return (
        <ol className="space-y-4">
            {messages.map((m) => {
                const mine = m.mine;
                const local = "local_state" in m ? m : null;
                const fromAgency = m.kind !== "CUSTOMER";
                const name = fromAgency ? (m.kind === "AI_AGENT" ? `${agencyName} assistant` : personName(m.author?.user) || agencyName) : mine ? "You" : m.author_name || personName(m.author_user);
                return (
                    <li key={m.id} className={cn("flex gap-2.5", mine && "flex-row-reverse", local?.local_state === "sending" && "opacity-70")}>
                        <MemberAvatar person={fromAgency ? m.author?.user ?? { display_name: agencyName } : m.author_user ?? { display_name: name }} size="sm" />
                        <div className={cn("min-w-0 max-w-[85%] space-y-1", mine && "text-right")}>
                            <div className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", mine && "justify-end")}>
                                <span className="font-medium text-foreground">{name}</span>
                                {local?.local_state === "sending" ? <span role="status">Sending…</span> : local?.local_state === "failed" ? null : <span>{formatDateTime(m.created_at)}</span>}
                                {local?.local_state === "failed" && (
                                    <span role="alert" className="inline-flex items-center gap-1.5 text-danger">
                                        Not sent
                                        {onRetry && <button type="button" className="font-medium underline underline-offset-2 hover:text-foreground" onClick={() => onRetry(local)}>Retry</button>}
                                        {onDiscard && <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => onDiscard(local)}>Discard</button>}
                                    </span>
                                )}
                            </div>
                            <div className={cn("whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-left text-[13px] leading-relaxed text-foreground", mine ? "border-transparent bg-info-soft" : "border-border bg-card", local?.local_state === "failed" && "border-danger/50")}>{m.body}</div>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
