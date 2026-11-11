import { useMemo, useState } from "react";
import { Ban, KeySquare, Plus, Search, Trash2 } from "lucide-react";
import { Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { useEffectivePermissions } from "@/features/admin/members/hooks/use-members";
import { useGrants, useRevokeGrant } from "@/features/admin/permissions/hooks/use-permissions-admin";
import type { MemberDetail, PermissionScopeValue } from "@/features/admin/members/interfaces/members.interfaces";
import type { PermissionGrant } from "@/features/admin/permissions/interfaces/permissions.interfaces";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { useScopeLabel } from "../../../components/use-scope-label";
import { GrantDialog } from "./grant-dialog";

const scopeSummary = (s: PermissionScopeValue) => {
    if (s.organization) return "Whole organization";
    const parts = [
        s.branch_ids.length && `${s.branch_ids.length} branch${s.branch_ids.length > 1 ? "es" : ""}`,
        s.team_ids.length && `${s.team_ids.length} team${s.team_ids.length > 1 ? "s" : ""}`,
        s.project_ids.length && `${s.project_ids.length} project${s.project_ids.length > 1 ? "s" : ""}`,
        s.customer_ids.length && `${s.customer_ids.length} customer${s.customer_ids.length > 1 ? "s" : ""}`,
        s.resource_ids.length && `${s.resource_ids.length} record${s.resource_ids.length > 1 ? "s" : ""}`,
    ].filter(Boolean);
    return parts.join(", ");
};

/** Explicit grants / denies plus the effective permission set computed by the authorization service. */
export function MemberPermissionsTab({ member }: { member: MemberDetail }) {
    const canGrant = usePermission("users.permissions.grant");
    const scopeLabel = useScopeLabel();
    const grants = useGrants({ membership_id: member.id, limit: 200 });
    const effective = useEffectivePermissions(member.id);
    const revoke = useRevokeGrant();
    const [grantOpen, setGrantOpen] = useState(false);
    const [revoking, setRevoking] = useState<PermissionGrant | null>(null);
    const [filter, setFilter] = useState("");

    const rows = useMemo(() => (effective.data?.permissions ?? []).filter((p) => !filter || p.key.includes(filter.toLowerCase())), [effective.data, filter]);

    return (
        <div className="space-y-6">
            <Section
                title="Exceptions"
                description="Direct allows and denies for this member, outside any role."
                actions={canGrant && member.status !== "DEACTIVATED" && <Button size="sm" onClick={() => setGrantOpen(true)}><Plus /> Add exception</Button>}
            >
                <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                    {grants.isPending && <ListSkeleton rows={2} />}
                    {grants.error && <ErrorState error={grants.error} onRetry={() => grants.refetch()} />}
                    {grants.data?.data.length === 0 && <EmptyState compact icon={KeySquare} title="No exceptions" description="All of this member's access comes from roles." />}
                    {grants.data?.data.map((g) => (
                        <div key={g.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={g.effect === "ALLOW" ? "success" : "danger"}>{g.effect === "ALLOW" ? "Allow" : "Deny"}</Badge>
                                    <code className="truncate text-[12.5px] text-foreground">{g.permission.key}</code>
                                    {g.valid_until && <Badge variant="warning">Until {formatDate(g.valid_until)}</Badge>}
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">{scopeLabel(g.scope_type, g.scope_id)}{g.reason ? ` · ${g.reason}` : ""}</div>
                            </div>
                            {canGrant && <Button variant="ghost" size="sm" className="self-start sm:self-auto" onClick={() => setRevoking(g)}><Trash2 /> Remove</Button>}
                        </div>
                    ))}
                </div>
            </Section>

            <Section
                title="Effective permissions"
                description={effective.data ? `${effective.data.permissions.length} permissions after roles, exceptions, denies and module access.` : "What this member can actually do."}
                actions={
                    <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ash" />
                        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter keys…" className="h-8 pl-8" aria-label="Filter permissions" />
                    </div>
                }
            >
                <div className="rounded-lg border border-border bg-card">
                    {effective.isPending && <ListSkeleton rows={4} />}
                    {effective.error && <ErrorState error={effective.error} onRetry={() => effective.refetch()} />}
                    {effective.data && (
                        <>
                            {effective.data.denied.length > 0 && (
                                <div className="border-b border-border px-4 py-2.5 text-[13px]">
                                    <div className="flex items-center gap-1.5 font-medium text-danger"><Ban className="size-4" /> Blocked by a deny</div>
                                    <div className="mt-1 flex flex-wrap gap-1">{effective.data.denied.map((d) => <code key={d.key} className="rounded-xs bg-danger-soft px-1.5 text-xs text-danger">{d.key}</code>)}</div>
                                </div>
                            )}
                            {rows.length === 0 ? (
                                <EmptyState compact icon={KeySquare} title={filter ? "No permission matches" : "No permissions"} description={member.status !== "ACTIVE" ? "Inactive members have no access." : undefined} />
                            ) : (
                                <div className="max-h-[480px] divide-y divide-border-soft overflow-y-auto">
                                    {rows.map((p) => (
                                        <div key={p.key} className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                                            <code className="truncate text-[12.5px] text-foreground">{p.key}</code>
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                                <span>{scopeSummary(p.scope)}</span>
                                                <span className="text-ash">·</span>
                                                <span className="truncate">{[...new Set(p.sources.filter((s) => s.effect === "ALLOW").map((s) => s.name))].join(", ")}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Section>

            <GrantDialog open={grantOpen} onOpenChange={setGrantOpen} membershipId={member.id} />
            <ConfirmationDialog
                isOpen={!!revoking}
                onClose={() => setRevoking(null)}
                title={`Remove the ${revoking?.effect === "DENY" ? "deny" : "allow"} for ${revoking?.permission.key}?`}
                description="Access goes back to what the member's roles give."
                confirmText="Remove"
                variant="destructive"
                isLoading={revoke.isPending}
                onConfirm={() => revoking && revoke.mutate(revoking.id, { onSuccess: () => { toast({ title: "Exception removed" }); setRevoking(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not remove", description: getApiErrorMessage(e) }) })}
            />
        </div>
    );
}
