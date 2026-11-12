import { useEffect, useMemo, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { formatDate, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { VaultGrantSubjectOptions } from "@/config/constants/dropdowns/files/files.options";
import { useAddVaultGrant, useRevokeVaultGrant, useShareDirectory, useVaultEntryDetail, useVaultPortalUsers } from "@/features/files/hooks/use-files";
import type { VaultEntry, VaultGrant, VaultGrantSubjectType } from "@/features/files/interfaces/files.interfaces";

const grantLabel = (g: VaultGrant) =>
    g.subject_type === "MEMBERSHIP" ? (g.membership ? personName(g.membership.user) : "Member")
        : g.subject_type === "TEAM" ? g.team?.name ?? "Team"
            : g.portal_user ? personName(g.portal_user) : "Portal user";

/**
 * Vault grants (17 §12, VaultEntryGrant): give members, teams or — for customer credentials — the customer's portal
 * users access, with reveal / manage rights and an optional expiry. Revoking keeps the history in the access log.
 * @perm documents.vault.manage @api GET /files/vault/entries/:id · POST /:id/grants · DELETE /:id/grants/:grantId · GET /:id/portal-users
 * @audit vault.grant_added · vault.grant_revoked @states loading · error · no grants
 */
export function VaultGrantsDialog({ entry, onClose }: { entry: VaultEntry | null; onClose: () => void }) {
    const detail = useVaultEntryDetail(entry?.id ?? null);
    const add = useAddVaultGrant();
    const revoke = useRevokeVaultGrant();
    const directory = useShareDirectory(!!entry);
    const isCustomer = !!entry?.company;
    const portalUsers = useVaultPortalUsers(entry?.id ?? null, isCustomer);
    const [type, setType] = useState<VaultGrantSubjectType>("MEMBERSHIP");
    const [subjectId, setSubjectId] = useState<string | null>(null);
    const [canReveal, setCanReveal] = useState(true);
    const [canManage, setCanManage] = useState(false);
    const [expires, setExpires] = useState("");

    useEffect(() => { if (entry) { setType("MEMBERSHIP"); setSubjectId(null); setCanReveal(true); setCanManage(false); setExpires(""); } }, [entry]);
    useEffect(() => { setSubjectId(null); if (type === "PORTAL_USER") setCanManage(false); }, [type]);

    const items = useMemo(() => {
        if (type === "MEMBERSHIP") return (directory.data?.members ?? []).map((m) => ({ id: m.id, label: personName(m.user), keywords: m.user.email }));
        if (type === "TEAM") return (directory.data?.teams ?? []).map((t) => ({ id: t.id, label: t.name }));
        return (portalUsers.data ?? []).map((u) => ({ id: u.id, label: personName(u), keywords: u.email, hint: u.email }));
    }, [type, directory.data, portalUsers.data]);

    const submit = () => {
        if (!entry || !subjectId) return;
        add.mutate({
            id: entry.id,
            subject_type: type,
            ...(type === "MEMBERSHIP" ? { membership_id: subjectId } : type === "TEAM" ? { team_id: subjectId } : { portal_user_id: subjectId }),
            can_reveal: canReveal,
            can_manage: type === "PORTAL_USER" ? false : canManage,
            ...(expires ? { expires_at: new Date(`${expires}T23:59:59`).toISOString() } : {}),
            // Display-only (never sent): the grant shows in the list at once.
            display: {
                membership: type === "MEMBERSHIP" ? directory.data?.members.find((m) => m.id === subjectId) ?? null : null,
                team: type === "TEAM" ? directory.data?.teams.find((t) => t.id === subjectId) ?? null : null,
                portal_user: type === "PORTAL_USER" ? portalUsers.data?.find((u) => u.id === subjectId) ?? null : null,
            },
        });
        setSubjectId(null);
    };

    const types = VaultGrantSubjectOptions.filter((o) => o.id !== "PORTAL_USER" || isCustomer);

    return (
        <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Access to “{entry?.name}”</DialogTitle>
                    <DialogDescription>People with documents.vault.read in the credential's scope already see it. Grants add individual access; reveals stay logged.</DialogDescription>
                </DialogHeader>

                {detail.isPending ? <ListSkeleton /> : detail.error ? <ErrorState error={detail.error} onRetry={() => detail.refetch()} /> : (
                    <div className="space-y-2">
                        <Label>Current grants</Label>
                        {!detail.data.grants.length ? (
                            <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No individual grants.</p>
                        ) : (
                            <ul className="divide-y divide-border rounded-md border border-border">
                                {detail.data.grants.map((g) => (
                                    <li key={g.id} className="flex flex-wrap items-center gap-2 p-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[13px] text-foreground">{grantLabel(g)}</div>
                                            <div className="text-xs text-muted-foreground">{getDropdownOptionLabel(VaultGrantSubjectOptions, g.subject_type)}{g.expires_at ? ` · until ${formatDate(g.expires_at)}` : ""}</div>
                                        </div>
                                        {g.can_reveal && <Badge variant="warning">Can reveal</Badge>}
                                        {g.can_manage && <Badge variant="violet">Can manage</Badge>}
                                        <Button variant="ghost" size="icon-sm" aria-label={`Revoke access for ${grantLabel(g)}`} disabled={g.id.startsWith("temp-")} onClick={() => entry && revoke.mutate({ id: entry.id, grantId: g.id })}><Trash2 /></Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                <div className="space-y-3 rounded-lg border border-border p-3">
                    <Label>Give access</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Select value={type} onValueChange={(v) => setType(v as VaultGrantSubjectType)}>
                            <SelectTrigger className="sm:w-44" aria-label="Who"><SelectValue /></SelectTrigger>
                            <SelectContent>{types.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <EntityPicker
                            items={items}
                            value={subjectId}
                            onChange={setSubjectId}
                            placeholder={type === "PORTAL_USER" ? "Choose a portal user" : type === "TEAM" ? "Choose a team" : "Choose a member"}
                            emptyText={type === "PORTAL_USER" ? "This customer has no active portal users" : "Nothing found"}
                            loading={directory.isPending || (type === "PORTAL_USER" && portalUsers.isPending)}
                            className="h-9"
                        />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex items-center justify-between gap-2 text-[13px] text-foreground">Can reveal the secret<Switch checked={canReveal} onCheckedChange={setCanReveal} aria-label="Can reveal the secret" /></label>
                        <label className="flex items-center justify-between gap-2 text-[13px] text-foreground">Can manage<Switch checked={canManage} disabled={type === "PORTAL_USER"} onCheckedChange={setCanManage} aria-label="Can manage" /></label>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="grant-expires">Access ends</Label>
                        <Input id="grant-expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
                    </div>
                    {type === "PORTAL_USER" && <p className="text-xs text-muted-foreground">Portal users only ever get read / reveal access to their own company's credentials.</p>}
                    <div className="flex justify-end">
                        <Button onClick={submit} disabled={!subjectId}><UserPlus /> Grant access</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
