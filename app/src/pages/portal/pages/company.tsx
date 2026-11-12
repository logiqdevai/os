import { useEffect, useState } from "react";
import { MailPlus, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { PortalMembershipStatusOptions, PortalMembershipStatusTone } from "@/config/constants/dropdowns/portal/portal.options";
import { useCancelColleagueInvitation, useInviteColleagues, usePortalCompany, usePortalTeam, useRequestProfileChange, useUpdateTeamMember } from "@/features/portal/hooks/use-portal";
import type { PortalCompany } from "@/features/portal/interfaces/portal.interfaces";
import { usePortal } from "../components/portal-context";
import { PortalCard, PortalHeader } from "../components/portal-ui";

const COMPANY_FIELDS: { key: keyof PortalCompany["company"]; label: string }[] = [
    { key: "name", label: "Company name" },
    { key: "legal_name", label: "Legal name" },
    { key: "website", label: "Website" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "vat_number", label: "VAT number" },
    { key: "tax_id", label: "Tax id" },
    { key: "registration_number", label: "Registration number" },
];

/**
 * Company & team — /portal/company (mockup 07-portal `cp-team`).
 * @perm view any portal user · propose changes portal.users.manage | portal.settings.manage · team portal.users.manage*
 */
export default function PortalCompanyPage() {
    return (
        <>
            <PortalHeader title="Company & team" description="Your company details and who can use the portal." />
            <Tabs defaultValue="profile">
                <TabsList><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="team">Team</TabsTrigger></TabsList>
                <TabsContent value="profile" className="mt-4"><ProfileTab /></TabsContent>
                <TabsContent value="team" className="mt-4"><TeamTab /></TabsContent>
            </Tabs>
        </>
    );
}

function ProfileTab() {
    const { session } = usePortal();
    const company = usePortalCompany();
    const change = useRequestProfileChange();
    const [editing, setEditing] = useState(false);
    const [values, setValues] = useState<Record<string, string>>({});
    useEffect(() => {
        if (company.data) setValues(Object.fromEntries(COMPANY_FIELDS.map((f) => [f.key, (company.data.company[f.key] as string | null) ?? ""])));
    }, [company.data, editing]);
    if (company.isLoading) return <ListSkeleton />;
    if (company.error || !company.data) return <ErrorState error={company.error} onRetry={() => company.refetch()} />;
    const c = company.data;
    const submit = () => {
        const changes = Object.fromEntries(COMPANY_FIELDS.filter((f) => (values[f.key] ?? "") !== ((c.company[f.key] as string | null) ?? "")).map((f) => [f.key, values[f.key] || null]));
        if (!Object.keys(changes).length) return setEditing(false);
        // The page shows the result: updated details, or the "waiting for … to confirm" banner when changes need review.
        change.mutate({ changes }, { onSuccess: () => setEditing(false) });
    };
    return (
        <div className="space-y-4">
            {c.pending_changes.length > 0 && <div className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-[13px]">{c.pending_changes.length} change{c.pending_changes.length === 1 ? " is" : "s are"} waiting for {session.organization?.display_name ?? "the team"} to confirm.</div>}
            <PortalCard title="Company" action={c.can_edit && <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil /> Edit</Button>}>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {COMPANY_FIELDS.map((f) => <div key={f.key}><dt className="text-xs text-muted-foreground">{f.label}</dt><dd className="truncate text-[13px]">{(c.company[f.key] as string | null) || "—"}</dd></div>)}
                </dl>
            </PortalCard>
            <PortalCard title="Contacts">
                {c.contacts.length ? <ul className="divide-y divide-border-soft">{c.contacts.map((p) => <li key={p.id} className="py-2 text-[13px]"><div className="font-medium">{p.first_name} {p.last_name ?? ""}</div><div className="text-xs text-muted-foreground">{[p.job_title, p.email, p.phone ?? p.mobile].filter(Boolean).join(" · ")}</div></li>)}</ul> : <p className="text-[13px] text-muted-foreground">No contacts on file.</p>}
            </PortalCard>
            <Dialog open={editing} onOpenChange={(o) => !change.isPending && setEditing(o)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader><DialogTitle>Edit company details</DialogTitle><DialogDescription>{session.profile_changes_require_approval ? "Changes are sent to the team for confirmation." : "Changes apply right away."}</DialogDescription></DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {COMPANY_FIELDS.map((f) => <div key={f.key} className="space-y-1.5"><Label htmlFor={`cf-${f.key}`}>{f.label}</Label><Input id={`cf-${f.key}`} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} /></div>)}
                    </div>
                    <DialogFooter><Button variant="ghost" onClick={() => setEditing(false)} disabled={change.isPending}>Cancel</Button><Button onClick={submit} loading={change.isPending}>{session.profile_changes_require_approval ? "Send for review" : "Save"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TeamTab() {
    const team = usePortalTeam();
    const invite = useInviteColleagues();
    const cancel = useCancelColleagueInvitation();
    const update = useUpdateTeamMember();
    const [open, setOpen] = useState(false);
    const [emails, setEmails] = useState("");
    const [roleId, setRoleId] = useState<string>("");
    if (team.isLoading) return <ListSkeleton />;
    if (team.error || !team.data) return <ErrorState error={team.error} onRetry={() => team.refetch()} />;
    const t = team.data;
    const list = emails.split(/[\s,;]+/).filter(Boolean);
    return (
        <div className="space-y-4">
            <PortalCard title="People" action={t.can_manage && <Button size="sm" onClick={() => { setEmails(""); setRoleId(""); setOpen(true); }}><MailPlus /> Invite</Button>}>
                <ul className="divide-y divide-border-soft">
                    {t.members.map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
                            <div className="min-w-0 flex-1"><MemberAvatar person={m.user} showName size="sm" /><div className="pl-8 text-xs text-muted-foreground">{m.user.email}{m.last_active_at ? ` · active ${formatRelative(m.last_active_at)}` : ""}</div></div>
                            {m.is_me && <Badge variant="info">You</Badge>}
                            {m.status !== "ACTIVE" && <Badge variant={PortalMembershipStatusTone[m.status as keyof typeof PortalMembershipStatusTone] ?? "neutral"}>{getDropdownOptionLabel(PortalMembershipStatusOptions, m.status)}</Badge>}
                            {t.can_manage && !m.is_me ? (
                                <>
                                    <Select value={m.role?.id ?? ""} onValueChange={(v) => update.mutate({ id: m.id, role_id: v, role: t.roles.find((r) => r.id === v) })}>
                                        <SelectTrigger className="h-8 w-44" aria-label={`Role of ${m.user.email}`}><SelectValue placeholder="Role" /></SelectTrigger>
                                        <SelectContent>{t.roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: m.id, status: m.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE" })}>{m.status === "ACTIVE" ? "Remove access" : "Restore"}</Button>
                                </>
                            ) : (
                                <Badge variant="neutral">{m.role?.name ?? "—"}</Badge>
                            )}
                        </li>
                    ))}
                </ul>
            </PortalCard>
            {t.can_manage && t.invitations.length > 0 && (
                <PortalCard title="Pending invitations">
                    <ul className="divide-y divide-border-soft">{t.invitations.map((i) => <li key={i.id} className="flex items-center gap-2 py-2 text-[13px]"><span className="min-w-0 flex-1 truncate">{i.email}</span><span className="text-xs text-muted-foreground">{i.role?.name}</span><Button size="icon-sm" variant="ghost" aria-label={`Cancel invitation for ${i.email}`} onClick={() => cancel.mutate(i.id)}><X /></Button></li>)}</ul>
                </PortalCard>
            )}
            <Dialog open={open} onOpenChange={(o) => !invite.isPending && setOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Invite colleagues</DialogTitle><DialogDescription>They get an email with a link to join the portal.</DialogDescription></DialogHeader>
                    <Textarea rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="name@yourcompany.com" aria-label="Emails" />
                    <Select value={roleId} onValueChange={setRoleId}><SelectTrigger aria-label="Role"><SelectValue placeholder="Default role" /></SelectTrigger><SelectContent>{t.roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={invite.isPending}>Cancel</Button>
                        <Button loading={invite.isPending} disabled={!list.length} onClick={() => invite.mutate({ emails: list, role_id: roleId || undefined }, { onSuccess: () => setOpen(false) })}>Send invitations</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
