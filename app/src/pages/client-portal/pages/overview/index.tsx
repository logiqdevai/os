import { Link } from "react-router-dom";
import { Building2, CheckCheck, ExternalLink, LifeBuoy, MailPlus, UserCheck, UserRoundPen } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { formatRelative } from "@/lib/format";
import { usePortalOverview } from "@/features/client-portal/hooks/use-client-portal";
import { CLIENT_PORTAL_PATHS } from "../../client-portal-paths";

/**
 * Client portal overview — /client-portal (mockup 07-portal `dashboard`).
 * @perm portal.users.read | portal.users.manage | portal.settings.manage | portal.activity.read
 */
export default function PortalOverviewPage() {
    const overview = usePortalOverview();
    if (overview.isLoading) return <PageSkeleton />;
    if (overview.error || !overview.data) return <Page><ErrorState error={overview.error} onRetry={() => overview.refetch()} /></Page>;
    const o = overview.data;
    return (
        <Page>
            <PageHeader
                title="Client portal"
                description="Give clients one place for projects, approvals, requests, documents and invoices."
                meta={<Badge variant={o.enabled ? "success" : "neutral"}>{o.enabled ? "Portal on" : "Portal off"}</Badge>}
                actions={
                    <>
                        <Button variant="outline" asChild><a href={CLIENT_PORTAL_PATHS.customerPortal} target="_blank" rel="noreferrer"><ExternalLink /> Open portal</a></Button>
                        <Can permission="portal.users.manage"><Button asChild><Link to={CLIENT_PORTAL_PATHS.invite}><MailPlus /> Invite</Link></Button></Can>
                    </>
                }
            />
            <StatGrid>
                <StatCard label="Clients with portal" value={o.clients.enabled} icon={Building2} hint={o.clients.disabled ? `${o.clients.disabled} switched off` : undefined} />
                <StatCard label="Active portal users" value={o.users.active} icon={UserCheck} hint={`${o.users.active_last_7_days} active this week`} />
                <StatCard label="Pending invitations" value={o.invitations_pending} icon={MailPlus} tone={o.invitations_pending ? "info" : "default"} />
                <StatCard label="Profile changes to review" value={o.profile_changes_pending} icon={UserRoundPen} tone={o.profile_changes_pending ? "warning" : "default"} />
                {o.portal_requests_open !== null && <StatCard label="Open portal requests" value={o.portal_requests_open} icon={LifeBuoy} />}
                {o.deliverables_awaiting_review !== null && <StatCard label="Deliverables awaiting client" value={o.deliverables_awaiting_review} icon={CheckCheck} />}
            </StatGrid>
            {o.recent_activity && (
                <Section title="Recent portal activity" className="mt-6" actions={<Button variant="ghost" size="sm" asChild><Link to={CLIENT_PORTAL_PATHS.activity}>View all</Link></Button>}>
                    <div className="rounded-lg border border-border bg-card">
                        {o.recent_activity.length ? (
                            <ul className="divide-y divide-border-soft">
                                {o.recent_activity.map((a) => (
                                    <li key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]">
                                        <MemberAvatar person={a.actor} size="xs" showName />
                                        <span className="text-muted-foreground">{a.event_type.replace(/[._]/g, " ")}</span>
                                        {a.company && <Badge variant="neutral">{a.company.name}</Badge>}
                                        <span className="ml-auto text-xs text-muted-foreground">{formatRelative(a.created_at)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="p-4 text-[13px] text-muted-foreground">No portal activity yet. Invite your first client.</p>
                        )}
                    </div>
                </Section>
            )}
        </Page>
    );
}
