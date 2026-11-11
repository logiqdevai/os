import { useState } from "react";
import { useParams } from "react-router-dom";
import { Ban, KeyRound, Pause, Pencil, Play, Plus, Shield, Trash2 } from "lucide-react";
import { KeyValueList, Page, PageHeader, Section } from "@/components/ui/page";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { useAssignServiceAccountRole, useRemoveServiceAccountRole, useServiceAccount, useSetServiceAccountStatus } from "@/features/admin/service-accounts/hooks/use-service-accounts";
import { useRevokeApiKey } from "@/features/admin/api-keys/hooks/use-api-keys";
import { formatDate, formatRelative, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { ServiceAccountStatusBadge } from "../../components/status-badges";
import { AssignRoleDialog } from "../../components/assign-role-dialog";
import { SecretOnceDialog } from "../../components/secret-once-dialog";
import { useScopeLabel } from "../../components/use-scope-label";
import { ServiceAccountFormDialog } from "../service-accounts/components/service-account-form-dialog";
import { ApiKeyFormDialog } from "../api-keys/components/api-key-form-dialog";

type Confirm = { kind: "suspend" | "reactivate" | "revoke" } | { kind: "remove-role"; id: string; name: string } | { kind: "revoke-key"; id: string; name: string } | null;

/**
 * Service account detail — /admin/service-accounts/:id
 * @perm organizations.service_accounts.manage · roles also users.roles.assign · keys organizations.api_keys.manage
 */
export default function ServiceAccountDetailPage() {
    const { id } = useParams();
    const account = useServiceAccount(id);
    const scopeLabel = useScopeLabel();
    const canAssign = usePermission("users.roles.assign");
    const canKeys = usePermission("organizations.api_keys.manage");
    const setStatus = useSetServiceAccountStatus();
    const assign = useAssignServiceAccountRole();
    const removeRole = useRemoveServiceAccountRole();
    const revokeKey = useRevokeApiKey();
    const [editOpen, setEditOpen] = useState(false);
    const [assignOpen, setAssignOpen] = useState(false);
    const [keyOpen, setKeyOpen] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<Confirm>(null);

    if (account.isPending) return <PageSkeleton />;
    if (account.error) return <Page><PageHeader title="Service account" back={{ to: "/admin/service-accounts", label: "Service accounts" }} /><ErrorState error={account.error} onRetry={() => account.refetch()} /></Page>;
    const a = account.data;
    const revoked = a.status === "REVOKED";
    const onError = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

    const runConfirm = () => {
        if (!confirm) return;
        const done = (title: string) => ({ onSuccess: () => { toast({ title }); setConfirm(null); }, onError: onError("Could not update") });
        if (confirm.kind === "suspend" || confirm.kind === "reactivate" || confirm.kind === "revoke") setStatus.mutate({ id: a.id, action: confirm.kind }, done(confirm.kind === "suspend" ? "Suspended" : confirm.kind === "reactivate" ? "Reactivated" : "Revoked"));
        if (confirm.kind === "remove-role") removeRole.mutate({ id: a.id, assignment_id: confirm.id }, done("Role removed"));
        if (confirm.kind === "revoke-key") revokeKey.mutate(confirm.id, done("Key revoked"));
    };

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/admin/service-accounts", label: "Service accounts" }}
                title={a.name}
                meta={<ServiceAccountStatusBadge status={a.status} />}
                description={a.purpose ?? undefined}
                actions={!revoked && (
                    <>
                        <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button>
                        {a.status === "ACTIVE" ? <Button variant="outline" onClick={() => setConfirm({ kind: "suspend" })}><Pause /> Suspend</Button> : <Button variant="outline" onClick={() => setConfirm({ kind: "reactivate" })}><Play /> Reactivate</Button>}
                        <Button variant="destructive" onClick={() => setConfirm({ kind: "revoke" })}><Ban /> Revoke</Button>
                    </>
                )}
            />
            <div className="grid gap-6 lg:grid-cols-3">
                <Section title="Details">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <KeyValueList columns={1} items={[
                            { label: "Owner", value: a.owner ? personName(a.owner.user) : null },
                            { label: "Effective permissions", value: `${a.permission_count}` },
                            { label: "Expires", value: a.expires_at ? formatDate(a.expires_at) : "Never" },
                            { label: "Created", value: formatDate(a.created_at) },
                        ]} />
                    </div>
                </Section>
                <div className="space-y-6 lg:col-span-2">
                    <Section title="Roles" actions={canAssign && !revoked && <Button size="sm" onClick={() => setAssignOpen(true)}><Plus /> Assign role</Button>}>
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {a.role_assignments.length === 0 && <EmptyState compact icon={Shield} title="No roles" description="Without a role this account cannot do anything." />}
                            {a.role_assignments.map((r) => (
                                <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">{r.role.name}{r.valid_until && <Badge variant="warning">Until {formatDate(r.valid_until)}</Badge>}</div>
                                        <div className="text-xs text-muted-foreground">{scopeLabel(r.scope_type, r.scope_id)}</div>
                                    </div>
                                    {canAssign && !revoked && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.role.name}`} onClick={() => setConfirm({ kind: "remove-role", id: r.id, name: r.role.name })}><Trash2 /></Button>}
                                </div>
                            ))}
                        </div>
                    </Section>
                    <Section title="API keys" actions={canKeys && a.status === "ACTIVE" && <Button size="sm" onClick={() => setKeyOpen(true)}><Plus /> New key</Button>}>
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {a.api_keys.length === 0 && <EmptyState compact icon={KeyRound} title="No keys" description="Create a key so the integration or agent can authenticate." />}
                            {a.api_keys.map((k) => (
                                <div key={k.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">{k.name}{k.revoked_at && <Badge>Revoked</Badge>}</div>
                                        <div className="text-xs text-muted-foreground"><code>{k.key_prefix}…</code> · {k.scopes.length ? `${k.scopes.length} scopes` : "full access"} · used {k.last_used_at ? formatRelative(k.last_used_at) : "never"}</div>
                                    </div>
                                    <Can permission="organizations.api_keys.manage">
                                        {!k.revoked_at && <Button variant="ghost" size="sm" onClick={() => setConfirm({ kind: "revoke-key", id: k.id, name: k.name })}><Ban /> Revoke</Button>}
                                    </Can>
                                </div>
                            ))}
                        </div>
                    </Section>
                </div>
            </div>
            <ServiceAccountFormDialog open={editOpen} onOpenChange={setEditOpen} account={a} />
            <AssignRoleDialog open={assignOpen} onOpenChange={setAssignOpen} title={`Assign a role to ${a.name}`} withReason={false} pending={assign.isPending}
                onSubmit={({ reason: _r, ...v }) => assign.mutate({ id: a.id, ...v }, { onSuccess: () => { toast({ title: "Role assigned" }); setAssignOpen(false); }, onError: onError("Could not assign the role") })} />
            <ApiKeyFormDialog open={keyOpen} onOpenChange={setKeyOpen} serviceAccountId={a.id} onCreated={setSecret} />
            <SecretOnceDialog secret={secret} title={`API key for ${a.name}`} onClose={() => setSecret(null)} />
            <ConfirmationDialog
                isOpen={!!confirm}
                onClose={() => setConfirm(null)}
                title={
                    confirm?.kind === "suspend" ? `Suspend ${a.name}?` : confirm?.kind === "reactivate" ? `Reactivate ${a.name}?` : confirm?.kind === "revoke" ? `Revoke ${a.name}?`
                        : confirm?.kind === "remove-role" ? `Remove ${confirm.name}?` : confirm?.kind === "revoke-key" ? `Revoke ${confirm.name}?` : ""
                }
                description={
                    confirm?.kind === "suspend" ? "Its keys stop working until you reactivate it." : confirm?.kind === "reactivate" ? "Its keys work again." : confirm?.kind === "revoke" ? "Permanent: the account and all its keys stop working."
                        : "Access through it stops immediately."
                }
                confirmText={confirm?.kind === "reactivate" ? "Reactivate" : confirm?.kind === "suspend" ? "Suspend" : confirm?.kind === "remove-role" ? "Remove" : "Revoke"}
                variant={confirm?.kind === "reactivate" ? "default" : "destructive"}
                isLoading={setStatus.isPending || removeRole.isPending || revokeKey.isPending}
                onConfirm={runConfirm}
            />
        </Page>
    );
}
