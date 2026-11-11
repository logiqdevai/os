import { useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Building2, Plus, Star } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { useArchiveBranch, useBranches, useRestoreBranch } from "@/features/admin/branches/hooks/use-branches";
import type { Branch } from "@/features/admin/branches/interfaces/branches.interfaces";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { BranchFormDialog } from "./components/branch-form-dialog";
import { BranchDetailPanel } from "./components/branch-detail-panel";

/**
 * Branches — /admin/branches/:id (tree on the left, detail on the right; stacked on phones)
 * @perm VIEW organizations.branches.read · create/edit/archive organizations.branches.manage
 * @api GET /branches · GET /branches/:id · POST /branches · PATCH /branches/:id · POST /branches/:id/archive|restore
 */
export default function BranchesPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [showArchived, setShowArchived] = useState(false);
    const branches = useBranches({ limit: 500, ...(showArchived && { archived: "true" }) });
    const active = useBranches({ limit: 500 });
    const canManage = usePermission("organizations.branches.manage");
    const archive = useArchiveBranch();
    const restore = useRestoreBranch();
    const [form, setForm] = useState<{ open: boolean; branch: Branch | null; parentId?: string }>({ open: false, branch: null });
    const [archiving, setArchiving] = useState<Branch | null>(null);

    const rows = useMemo(() => {
        const list = branches.data?.data ?? [];
        // Order by the ancestor path of names so the tree reads naturally.
        const byId = new Map(list.map((b) => [b.id, b]));
        const key = (b: Branch) => [...b.path.split("/").filter(Boolean).map((pid) => byId.get(pid)?.name ?? pid), b.name].join(" / ");
        return showArchived ? list : [...list].sort((a, b) => key(a).localeCompare(key(b)));
    }, [branches.data, showArchived]);
    const selectedId = id ?? (!showArchived ? rows[0]?.id : undefined);
    const selected = (active.data?.data ?? []).find((b) => b.id === selectedId) ?? null;

    return (
        <Page width="wide">
            <PageHeader
                title="Branches"
                description="Offices, regions and units. Roles and data can be limited to a branch."
                actions={<Can permission="organizations.branches.manage"><Button onClick={() => setForm({ open: true, branch: null })}><Plus /> New branch</Button></Can>}
            />
            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                <div className="space-y-2">
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {branches.isPending && <ListSkeleton rows={5} />}
                        {branches.error && <ErrorState error={branches.error} onRetry={() => branches.refetch()} />}
                        {branches.data && rows.length === 0 && <EmptyState compact icon={Building2} title={showArchived ? "No archived branches" : "No branches"} />}
                        <nav aria-label="Branches" className="max-h-[60vh] overflow-y-auto py-1">
                            {rows.map((b) => (
                                <div key={b.id} className="flex items-center gap-1 pr-2">
                                    <NavLink
                                        to={`/admin/branches/${b.id}`}
                                        className={({ isActive }) => cn("flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-3 pr-2 text-[13px] text-body hover:bg-border-soft hover:text-foreground", (isActive || (!id && b.id === selectedId)) && "bg-accent font-medium text-foreground")}
                                    >
                                        {!showArchived && Array.from({ length: b.depth }).map((_, i) => <span key={i} className="w-3 flex-none" aria-hidden />)}
                                        <Building2 className="size-4 flex-none text-muted-foreground" />
                                        <span className="truncate">{b.name}</span>
                                        {b.is_headquarters && <Star className="size-3 flex-none text-violet" aria-label="Headquarters" />}
                                        <span className="ml-auto text-xs text-ash tabular">{b._count?.memberships ?? 0}</span>
                                    </NavLink>
                                    {showArchived && canManage && (
                                        <Button size="sm" variant="ghost" loading={restore.isPending && restore.variables === b.id}
                                            onClick={() => restore.mutate(b.id, { onSuccess: () => toast({ title: `${b.name} restored` }), onError: (e) => toast({ variant: "destructive", title: "Could not restore", description: getApiErrorMessage(e) }) })}>
                                            Restore
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </nav>
                    </div>
                    <label className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
                        <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Show archived branches" /> Show archived
                    </label>
                </div>
                <div className="min-w-0">
                    {selectedId && !showArchived ? (
                        <BranchDetailPanel
                            id={selectedId}
                            onEdit={() => setForm({ open: true, branch: selected })}
                            onAddChild={() => setForm({ open: true, branch: null, parentId: selectedId })}
                            onArchive={() => selected && setArchiving(selected)}
                        />
                    ) : (
                        !branches.isPending && <div className="rounded-lg border border-border bg-card"><EmptyState icon={Building2} title="Pick a branch" description="Select a branch to see its members, teams and settings." /></div>
                    )}
                </div>
            </div>
            <BranchFormDialog open={form.open} onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))} branch={form.branch} branches={active.data?.data ?? []} defaultParentId={form.parentId} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="It disappears from pickers. Members keep their other branches; roles scoped to it stop matching new records."
                confirmText="Archive"
                variant="destructive"
                isLoading={archive.isPending}
                onConfirm={() => archiving && archive.mutate(archiving.id, { onSuccess: () => { toast({ title: "Branch archived" }); setArchiving(null); navigate("/admin/branches"); }, onError: (e) => toast({ variant: "destructive", title: "Could not archive", description: getApiErrorMessage(e) }) })}
            />
        </Page>
    );
}
