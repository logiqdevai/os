import { Link } from "react-router-dom";
import { ArrowRight, CircleAlert, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { PortalInvoiceStatusOptions, PortalInvoiceStatusTone, ProjectHealthOptions, ProjectHealthTone } from "@/config/constants/dropdowns/portal/portal.options";
import { usePortalDashboard } from "@/features/portal/hooks/use-portal";
import { usePortal } from "../components/portal-context";
import { DeliverableStatusBadge, PortalCard, PortalHeader, ProgressBar, RequestStatusBadge } from "../components/portal-ui";
import { PORTAL_PATHS } from "../portal-paths";

/**
 * Customer dashboard — /portal (mockup 07-portal `cp-dashboard`). Each widget needs its portal.* key and feature.
 * @api GET /portal/dashboard
 */
export default function PortalDashboardPage() {
    const { session, can, feature } = usePortal();
    const dash = usePortalDashboard();
    const first = session.user?.first_name || session.user?.display_name || "";
    return (
        <>
            <PortalHeader
                title={first ? `Welcome, ${first}` : "Welcome"}
                description={session.welcome_message ?? `Everything about your work with ${session.organization?.display_name ?? "us"} in one place.`}
                actions={can("portal.requests.create") && feature("requests") && <Button asChild><Link to={PORTAL_PATHS.newRequest}><Plus /> New request</Link></Button>}
            />
            {dash.isLoading ? (
                <PageSkeleton />
            ) : dash.error || !dash.data ? (
                <ErrorState error={dash.error} onRetry={() => dash.refetch()} />
            ) : (
                <div className="space-y-5">
                    {dash.data.announcements.map((a) => (
                        <div key={a.id} className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-[13px]">
                            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                            <div><div className="font-medium text-foreground">{a.incident.title}</div><div className="text-foreground">{a.body}</div><div className="mt-1 text-xs text-muted-foreground">{formatRelative(a.created_at)}</div></div>
                        </div>
                    ))}
                    <div className="grid gap-5 lg:grid-cols-2">
                        {dash.data.approvals && (
                            <PortalCard title={`Waiting for your approval${dash.data.approvals.total ? ` (${dash.data.approvals.total})` : ""}`} action={<SeeAll to={PORTAL_PATHS.approvals} />}>
                                {dash.data.approvals.items.length ? (
                                    <ul className="space-y-3">
                                        {dash.data.approvals.items.map((d) => (
                                            <li key={d.id} className="flex items-center gap-3">
                                                <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{d.name}</div><div className="truncate text-xs text-muted-foreground">{d.project?.name}{d.due_date ? ` · due ${formatDate(d.due_date)}` : ""}</div></div>
                                                <DeliverableStatusBadge status={d.status} />
                                            </li>
                                        ))}
                                    </ul>
                                ) : <Nothing text="Nothing to approve right now." />}
                            </PortalCard>
                        )}
                        {dash.data.projects && (
                            <PortalCard title="Projects" action={<SeeAll to={PORTAL_PATHS.projects} />}>
                                {dash.data.projects.items.length ? (
                                    <ul className="space-y-4">
                                        {dash.data.projects.items.map((p) => (
                                            <li key={p.id}>
                                                <Link to={PORTAL_PATHS.project(p.id)} className="group block">
                                                    <div className="mb-1.5 flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-[13px] font-medium group-hover:underline">{p.name}</span><Badge variant={ProjectHealthTone[p.health] ?? "neutral"}>{getDropdownOptionLabel(ProjectHealthOptions, p.health)}</Badge><span className="text-xs text-muted-foreground tabular">{p.progress_percent}%</span></div>
                                                    <ProgressBar value={p.progress_percent} />
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <Nothing text="No projects shared with you yet." />}
                            </PortalCard>
                        )}
                        {dash.data.requests && (
                            <PortalCard title="Open requests" action={<SeeAll to={PORTAL_PATHS.requests} />}>
                                {dash.data.requests.items.length ? (
                                    <ul className="space-y-3">
                                        {dash.data.requests.items.map((r) => (
                                            <li key={r.id}>
                                                <Link to={PORTAL_PATHS.request(r.reference)} className="flex items-center gap-3 hover:underline">
                                                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{r.subject}</div><div className="text-xs text-muted-foreground">{r.reference} · updated {formatRelative(r.updated_at)}</div></div>
                                                    <RequestStatusBadge status={r.status} />
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <Nothing text="No open requests." />}
                            </PortalCard>
                        )}
                        {dash.data.invoices && (
                            <PortalCard title="Invoices to pay" action={<SeeAll to={PORTAL_PATHS.billing} />}>
                                {dash.data.invoices.outstanding.length ? (
                                    <div className="mb-3 text-2xl font-medium tabular">{dash.data.invoices.outstanding.map((o) => formatMoney(o.amount_due, o.currency)).join(" · ")}</div>
                                ) : null}
                                {dash.data.invoices.items.length ? (
                                    <ul className="space-y-2">
                                        {dash.data.invoices.items.map((i) => (
                                            <li key={i.id} className="flex items-center gap-3 text-[13px]">
                                                <span className="min-w-0 flex-1 truncate">{i.number}{i.due_date ? <span className="text-xs text-muted-foreground"> · due {formatDate(i.due_date)}</span> : null}</span>
                                                <span className="tabular">{formatMoney(i.amount_due, i.currency)}</span>
                                                <Badge variant={PortalInvoiceStatusTone[i.status] ?? "neutral"}>{getDropdownOptionLabel(PortalInvoiceStatusOptions, i.status)}</Badge>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <Nothing text="You're all paid up." />}
                            </PortalCard>
                        )}
                        {dash.data.conversations && (
                            <PortalCard title={`Messages${dash.data.conversations.unread ? ` (${dash.data.conversations.unread} new)` : ""}`} action={<SeeAll to={PORTAL_PATHS.messages} />}>
                                {dash.data.conversations.items.length ? (
                                    <ul className="space-y-3">
                                        {dash.data.conversations.items.map((c) => (
                                            <li key={c.id}>
                                                <Link to={PORTAL_PATHS.message(c.id)} className="block hover:underline">
                                                    <div className="flex items-center gap-2 text-[13px]">{c.unread && <span className="size-2 rounded-full bg-info" aria-label="Unread" />}<span className={c.unread ? "font-semibold" : "font-medium"}>{c.subject || "Conversation"}</span></div>
                                                    <div className="truncate text-xs text-muted-foreground">{c.last_message?.body}</div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <Nothing text="No messages yet." />}
                            </PortalCard>
                        )}
                        {dash.data.documents && (
                            <PortalCard title="Recent documents" action={<SeeAll to={PORTAL_PATHS.documents} />}>
                                {dash.data.documents.items.length ? (
                                    <ul className="space-y-2">
                                        {dash.data.documents.items.map((d) => (
                                            <li key={d.id} className="flex items-center gap-2 text-[13px]">
                                                {d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">{d.title || d.filename}</a> : <span className="min-w-0 flex-1 truncate">{d.title || d.filename}</span>}
                                                <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <Nothing text="No documents shared yet." />}
                            </PortalCard>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

function SeeAll({ to }: { to: string }) {
    return <Button variant="ghost" size="sm" asChild><Link to={to}>See all <ArrowRight /></Link></Button>;
}

function Nothing({ text }: { text: string }) {
    return <p className="text-[13px] text-muted-foreground">{text}</p>;
}
