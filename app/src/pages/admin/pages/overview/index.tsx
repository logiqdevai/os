import { Link } from "react-router-dom";
import { AlertTriangle, Bot, Building2, CheckCircle2, Circle, KeyRound, Mail, Plug, Shield, ShieldCheck, Sparkles, Users, UsersRound } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAdminOverview } from "@/features/admin/overview/hooks/use-overview";
import { useSessionData } from "@/features/session/hooks/use-session";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import { AuditActorTypeFormOptions } from "@/config/constants/dropdowns/admin/developer-form.options";
import { formatRelative, personName } from "@/lib/format";
import { AuditOutcomeBadge } from "../../components/status-badges";

/**
 * Admin overview — /admin
 * @perm VIEW any admin read key; each card only renders when the API returned its block (null = no access).
 * @api GET /admin/overview
 */
export default function AdminOverviewPage() {
    const session = useSessionData();
    const overview = useAdminOverview();

    if (overview.isPending) return <PageSkeleton />;
    if (overview.error) return <Page><ErrorState error={overview.error} onRetry={() => overview.refetch()} /></Page>;
    const o = overview.data;
    const steps = [
        { done: o.onboarding.invited_someone, label: "Invite your team", to: "/admin/invitations/new" },
        { done: o.onboarding.has_teams, label: "Create teams", to: "/admin/teams" },
        { done: o.onboarding.has_branches, label: "Add branches (offices, regions)", to: "/admin/branches" },
        { done: o.onboarding.has_integration, label: "Connect an integration (AI, email, payments)", to: "/admin/integrations" },
        { done: o.onboarding.has_branding, label: "Add your logo and colors", to: "/admin/branding" },
    ];
    const pendingSteps = steps.filter((s) => !s.done).length;

    return (
        <Page>
            <PageHeader title="Admin" description={`Members, access and settings of ${session?.active_organization?.display_name ?? "your organization"}.`} />
            <div className="space-y-6">
                <StatGrid>
                    {o.members && <StatCard label="Active members" value={o.members.active} icon={Users} hint={o.members.suspended ? `${o.members.suspended} suspended` : `${o.members.external} external`} />}
                    {o.invitations && <StatCard label="Pending invitations" value={o.invitations.pending} icon={Mail} tone={o.invitations.expiring_soon ? "warning" : "default"} hint={o.invitations.expiring_soon ? `${o.invitations.expiring_soon} expire within 2 days` : "None expiring soon"} />}
                    {o.structure?.teams !== null && o.structure?.teams !== undefined && <StatCard label="Teams" value={o.structure.teams} icon={UsersRound} />}
                    {o.structure?.branches !== null && o.structure?.branches !== undefined && <StatCard label="Branches" value={o.structure.branches} icon={Building2} />}
                    {o.roles && <StatCard label="Custom roles" value={o.roles.custom} icon={Shield} hint={o.roles.drafts ? `${o.roles.drafts} draft${o.roles.drafts > 1 ? "s" : ""} not published` : `${o.roles.templates} system templates`} tone={o.roles.drafts ? "warning" : "default"} />}
                    {o.developers?.api_keys !== null && o.developers?.api_keys !== undefined && <StatCard label="Active API keys" value={o.developers.api_keys} icon={KeyRound} />}
                    {o.developers?.service_accounts !== null && o.developers?.service_accounts !== undefined && <StatCard label="Service accounts" value={o.developers.service_accounts} icon={Bot} />}
                    {o.developers?.mcp_awaiting !== null && o.developers?.mcp_awaiting !== undefined && (
                        <Link to="/admin/mcp-calls?status=AWAITING_CONFIRMATION" className="block">
                            <StatCard label="Agent calls to confirm" value={o.developers.mcp_awaiting} icon={Sparkles} tone={o.developers.mcp_awaiting ? "warning" : "default"} hint={o.developers.mcp_awaiting ? "Review now" : "Nothing waiting"} className="h-full transition-colors hover:border-border-strong" />
                        </Link>
                    )}
                    {o.developers?.integrations && <StatCard label="Integrations" value={o.developers.integrations.total} icon={Plug} tone={o.developers.integrations.errors ? "danger" : "default"} hint={o.developers.integrations.errors ? `${o.developers.integrations.errors} with errors` : "All healthy"} />}
                </StatGrid>

                <div className="grid gap-4 lg:grid-cols-2">
                    {o.members && (
                        <div className="rounded-lg border border-border bg-card p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="flex items-center gap-2 text-[15px] font-medium text-foreground"><ShieldCheck className="size-4 text-muted-foreground" /> Security posture</h2>
                                <Badge variant={o.members.mfa_coverage >= 90 ? "success" : o.members.mfa_coverage >= 50 ? "warning" : "danger"}>MFA {o.members.mfa_coverage}%</Badge>
                            </div>
                            <Progress value={o.members.mfa_coverage} className="mt-3 h-1.5" />
                            <p className="mt-2 text-[13px] text-muted-foreground">{o.members.mfa_enabled} of {o.members.active} active members use two-factor sign-in.</p>
                            {o.roles && o.roles.expiring_assignments > 0 && (
                                <p className="mt-3 flex items-center gap-1.5 text-[13px] text-warning"><AlertTriangle className="size-4" /> {o.roles.expiring_assignments} temporary role assignment{o.roles.expiring_assignments > 1 ? "s" : ""} end within 14 days.</p>
                            )}
                            {o.security && o.security.disabled_modules.length > 0 && (
                                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                                    Disabled modules:
                                    {o.security.disabled_modules.map((m) => <Badge key={m}>{getDropdownOptionLabel(ModuleKeyOptions, m)}</Badge>)}
                                </div>
                            )}
                        </div>
                    )}

                    {pendingSteps > 0 && (
                        <div className="rounded-lg border border-border bg-card p-4">
                            <h2 className="text-[15px] font-medium text-foreground">Finish setting up</h2>
                            <p className="text-[13px] text-muted-foreground">{steps.length - pendingSteps} of {steps.length} done</p>
                            <ul className="mt-3 space-y-1">
                                {steps.map((s) => (
                                    <li key={s.label}>
                                        <Link to={s.to} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-body hover:bg-border-soft hover:text-foreground">
                                            {s.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-ash" />}
                                            <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {o.recent_sensitive_events && (
                    <Section title="Recent sensitive changes" actions={<Link to="/admin/audit" className="text-[13px] text-muted-foreground hover:text-foreground">Open audit log</Link>}>
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {o.recent_sensitive_events.length === 0 && <p className="p-4 text-[13px] text-muted-foreground">No sensitive changes yet.</p>}
                            {o.recent_sensitive_events.map((e) => (
                                <div key={e.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <code className="text-[12.5px] text-foreground">{e.event_type}</code>
                                        <div className="truncate text-xs text-muted-foreground">{e.actor_user ? personName(e.actor_user) : getDropdownOptionLabel(AuditActorTypeFormOptions, e.actor_type)} · {formatRelative(e.created_at)}</div>
                                    </div>
                                    <AuditOutcomeBadge outcome={e.outcome} />
                                </div>
                            ))}
                        </div>
                    </Section>
                )}
            </div>
        </Page>
    );
}
