import { useState } from "react";
import { useParams } from "react-router-dom";
import { MailPlus, Power, PowerOff, RotateCw, X } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { InviteLinkNotice } from "../../components/invite-link";
import { formatDate, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { InvitationStatusOptions, InvitationStatusTone, PortalClientStatusOptions, PortalClientStatusTone, PortalMembershipStatusOptions, PortalMembershipStatusTone } from "@/config/constants/dropdowns/portal/portal.options";
import { useCancelPortalInvitation, useCustomerRoles, useDisablePortalClient, useEnablePortalClient, usePortalClient, useResendPortalInvitation, useUpdatePortalUser } from "@/features/client-portal/hooks/use-client-portal";
import { InviteDialog } from "../../components/invite-dialog";
import { CLIENT_PORTAL_PATHS } from "../../client-portal-paths";

/**
 * One client's portal — /client-portal/clients/:companyId (mockup 07-portal `client`, `enable`).
 * @perm VIEW portal.users.read · enable/disable portal.settings.manage · users and invitations portal.users.manage
 */
export default function PortalClientPage() {
    const { companyId } = useParams();
    const client = usePortalClient(companyId);
    const roles = useCustomerRoles();
    const enable = useEnablePortalClient();
    const disable = useDisablePortalClient();
    const updateUser = useUpdatePortalUser();
    const resend = useResendPortalInvitation();
    const cancel = useCancelPortalInvitation();
    const canManageUsers = usePermission("portal.users.manage");
    const [inviteOpen, setInviteOpen] = useState(false);
    const [disabling, setDisabling] = useState(false);
    const [newLink, setNewLink] = useState<{ email: string; url: string } | null>(null);

    if (client.isLoading) return <PageSkeleton />;
    if (client.error || !client.data) return <Page><ErrorState error={client.error} onRetry={() => client.refetch()} /></Page>;
    const c = client.data;
    const on = c.portal_status === "enabled";

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: CLIENT_PORTAL_PATHS.clients, label: "Clients" }}
                title={c.company.name}
                meta={<Badge variant={PortalClientStatusTone[c.portal_status]}>{getDropdownOptionLabel(PortalClientStatusOptions, c.portal_status)}</Badge>}
                description={c.company.website ?? c.company.email ?? undefined}
                actions={
                    <>
                        <Can permission="portal.settings.manage">
                            {on ? (
                                <Button variant="outline" onClick={() => setDisabling(true)}><PowerOff /> Switch off</Button>
                            ) : (
                                <Button variant="outline" onClick={() => enable.mutate({ company_id: c.company.id })}><Power /> Enable portal</Button>
                            )}
                        </Can>
                        <Can permission="portal.users.manage">
                            <Button onClick={() => setInviteOpen(true)} disabled={c.portal_status === "disabled"}><MailPlus /> Invite</Button>
                        </Can>
                    </>
                }
            />
            {c.pending_profile_changes > 0 && <div className="mb-4 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-[13px]">{c.pending_profile_changes} profile change{c.pending_profile_changes === 1 ? "" : "s"} waiting for review.</div>}

            <div className="space-y-6">
                <Section title="Portal users" description="People from this client who can sign in to the portal.">
                    <div className="rounded-lg border border-border bg-card">
                        {c.users.length ? (
                            <ul className="divide-y divide-border-soft">
                                {c.users.map((u) => (
                                    <li key={u.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                                        <div className="min-w-0 flex-1">
                                            <MemberAvatar person={u.user} showName size="sm" />
                                            <div className="pl-8 text-xs text-muted-foreground">{u.user.email} · {u.last_active_at ? `active ${formatRelative(u.last_active_at)}` : "never signed in"}</div>
                                        </div>
                                        <Badge variant={PortalMembershipStatusTone[u.status]}>{getDropdownOptionLabel(PortalMembershipStatusOptions, u.status)}</Badge>
                                        {canManageUsers ? (
                                            <>
                                                <Select value={u.role?.id ?? ""} onValueChange={(v) => updateUser.mutate({ id: u.id, role_id: v, optimistic: { role: roles.data?.find((r) => r.id === v) ?? null } })}>
                                                    <SelectTrigger className="h-8 w-44" aria-label={`Role of ${u.user.email}`}><SelectValue placeholder="No role" /></SelectTrigger>
                                                    <SelectContent>{roles.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <Button size="sm" variant="ghost" onClick={() => updateUser.mutate({ id: u.id, status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}>
                                                    {u.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                                                </Button>
                                            </>
                                        ) : (
                                            <Badge variant="neutral">{u.role?.name ?? "No role"}</Badge>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="p-4 text-[13px] text-muted-foreground">Nobody from this client uses the portal yet.</p>
                        )}
                    </div>
                </Section>

                <Section title="Invitations">
                    {newLink && <InviteLinkNotice email={newLink.email} url={newLink.url} onDismiss={() => setNewLink(null)} />}
                    <div className="rounded-lg border border-border bg-card">
                        {c.invitations.length ? (
                            <ul className="divide-y divide-border-soft">
                                {c.invitations.map((i) => (
                                    <li key={i.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]">
                                        <span className="min-w-0 flex-1 truncate">{i.email}</span>
                                        <span className="text-xs text-muted-foreground">{i.role?.name} · sent {formatDate(i.last_sent_at ?? i.created_at)}</span>
                                        <Badge variant={InvitationStatusTone[i.status]}>{getDropdownOptionLabel(InvitationStatusOptions, i.status)}</Badge>
                                        {canManageUsers && (i.status === "PENDING" || i.status === "EXPIRED") && (
                                            <>
                                                <Button size="icon-sm" variant="ghost" aria-label={`Resend to ${i.email}`} onClick={() => resend.mutate(i.id, { onSuccess: (r) => setNewLink(!r.email_sent && r.invite_url ? { email: i.email, url: r.invite_url } : null) })}><RotateCw /></Button>
                                                <Button size="icon-sm" variant="ghost" aria-label={`Cancel invitation for ${i.email}`} onClick={() => cancel.mutate(i.id)}><X /></Button>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="p-4 text-[13px] text-muted-foreground">No invitations sent.</p>
                        )}
                    </div>
                </Section>

                <Section title="Projects" description="Only projects marked visible to the client appear in their portal.">
                    <div className="rounded-lg border border-border bg-card">
                        {c.projects.length ? (
                            <ul className="divide-y divide-border-soft">
                                {c.projects.map((p) => (
                                    <li key={p.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
                                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                                        <span className="text-xs text-muted-foreground tabular">{p.progress_percent}%</span>
                                        <Badge variant={p.visibility === "CUSTOMER_VISIBLE" ? "success" : "neutral"}>{p.visibility === "CUSTOMER_VISIBLE" ? "Visible to client" : "Internal"}</Badge>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="p-4 text-[13px] text-muted-foreground">This client has no projects.</p>
                        )}
                    </div>
                </Section>
            </div>

            <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} company={{ id: c.company.id, name: c.company.name }} />
            <ConfirmationDialog
                isOpen={disabling}
                onClose={() => setDisabling(false)}
                title={`Switch the portal off for ${c.company.name}?`}
                description="Their users can no longer sign in to the portal and pending invitations are cancelled. You can switch it on again later."
                confirmText="Switch off"
                variant="destructive"
                onConfirm={() => { disable.mutate(c.company.id); setDisabling(false); }}
            />
        </Page>
    );
}
