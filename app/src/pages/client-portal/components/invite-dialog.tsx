import { useEffect, useState } from "react";
import { CopyLinkButton } from "./invite-link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityPicker } from "@/components/ui/entity-picker";
import { useCustomerRoles, useInvitePortalUsers, usePortalClients } from "@/features/client-portal/hooks/use-client-portal";
import type { InviteResult } from "@/features/client-portal/interfaces/client-portal.interfaces";

const DEFAULT = "__default";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Pre-selected client; the picker is hidden when given. */
    company?: { id: string; name: string } | null;
}

/**
 * Invite people of a client to the portal (07 §2, 01 §79): Invitation with audience CUSTOMER_PORTAL, the client's
 * id and a customer role. When email delivery is not configured the invite links are shown to copy.
 * @perm portal.users.manage
 */
export function InviteDialog({ open, onOpenChange, company }: InviteDialogProps) {
    const roles = useCustomerRoles(open);
    const [search, setSearch] = useState("");
    const clients = usePortalClients({ search: search || undefined, limit: 20 });
    const invite = useInvitePortalUsers();
    const [companyId, setCompanyId] = useState<string | null>(company?.id ?? null);
    const [emails, setEmails] = useState("");
    const [roleId, setRoleId] = useState(DEFAULT);
    const [message, setMessage] = useState("");
    const [results, setResults] = useState<InviteResult[] | null>(null);

    useEffect(() => {
        if (open) {
            setCompanyId(company?.id ?? null);
            setEmails("");
            setRoleId(DEFAULT);
            setMessage("");
            setResults(null);
        }
    }, [open, company]);

    const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    const invalid = list.filter((e) => !EMAIL.test(e));
    const role = roles.data?.find((r) => r.id === roleId);

    const submit = () =>
        companyId &&
        invite.mutate(
            { company_id: companyId, emails: list, role_id: roleId !== DEFAULT ? roleId : undefined, message: message || undefined },
            {
                // The dialog switches to the per-email results (no toast).
                onSuccess: (r) => setResults(r.results),
            },
        );

    return (
        <Dialog open={open} onOpenChange={(o) => !invite.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Invite to the client portal</DialogTitle>
                    <DialogDescription>{company ? `People from ${company.name} get a link to create their portal account.` : "Invited people get a link to create their portal account."}</DialogDescription>
                </DialogHeader>
                {results ? (
                    <ul className="space-y-2">
                        {results.map((r) => (
                            <li key={r.email} className="rounded-md border border-border p-2 text-[13px]">
                                <div className="flex items-center gap-2">
                                    <span className="min-w-0 flex-1 truncate">{r.email}</span>
                                    <Badge variant={r.status === "invited" ? "success" : "neutral"}>{r.status === "invited" ? (r.email_sent ? "Email sent" : "Invited") : r.status === "already_member" ? "Already a user" : "Already invited"}</Badge>
                                </div>
                                {r.invite_url && (
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{r.invite_url}</code>
                                        <CopyLinkButton text={r.invite_url} />
                                    </div>
                                )}
                            </li>
                        ))}
                        {results.some((r) => r.invite_url) && <p className="text-xs text-muted-foreground">Email delivery is not configured, so share these links yourself. They expire in 14 days.</p>}
                    </ul>
                ) : (
                    <div className="space-y-4">
                        {!company && (
                            <div className="space-y-1.5">
                                <Label>Client</Label>
                                <EntityPicker items={(clients.data?.data ?? []).map((c) => ({ id: c.id, label: c.name }))} value={companyId} onChange={setCompanyId} onSearch={setSearch} loading={clients.isFetching} placeholder="Pick a client" ariaLabel="Client" />
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label htmlFor="invite-emails">Emails</Label>
                            <Textarea id="invite-emails" rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="anna@client.com, nikos@client.com" />
                            {invalid.length > 0 && <p className="text-xs text-danger">Not valid: {invalid.join(", ")}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Role</Label>
                            <Select value={roleId} onValueChange={setRoleId}>
                                <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={DEFAULT}>Portal default role</SelectItem>
                                    {roles.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {role?.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="invite-message">Personal message</Label>
                            <Textarea id="invite-message" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional" />
                        </div>
                    </div>
                )}
                <DialogFooter>
                    {results ? (
                        <Button onClick={() => onOpenChange(false)}>Done</Button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={invite.isPending}>Cancel</Button>
                            <Button onClick={submit} loading={invite.isPending} disabled={!companyId || !list.length || invalid.length > 0}>Send invitations</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
