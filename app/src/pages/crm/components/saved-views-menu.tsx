import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bookmark, Check, ChevronDown, Columns3, Pencil, Plus, Save, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { getApiErrorMessage } from "@/lib/api-error";
import { SavedViewVisibilityOptions } from "@/config/constants/dropdowns/crm/saved-view.options";
import { useCreateSavedView, useDeleteSavedView, useSavedViews, useTeamOptions, useUpdateSavedView } from "@/features/crm/saved-views/hooks/use-saved-views";
import type { SavedView, SavedViewVisibility } from "@/features/crm/saved-views/interfaces/saved-views.interfaces";

/** `sv` = id of the applied saved view (`view` is taken by the deals board/list switch). */
const VIEW_PARAM = "sv";
const SKIP = new Set(["page", VIEW_PARAM, "q"]);

/** Hidden table columns of the current list view (`hide` URL param, stored with saved views). */
export function useHiddenColumns() {
    const [sp] = useSearchParams();
    const raw = sp.get("hide") ?? "";
    return useMemo(() => new Set(raw.split(",").filter(Boolean)), [raw]);
}

/**
 * Saved views + column chooser for a CRM list (mockup `saved-views`, 02 §29).
 * A view stores the list's URL query (filters, hidden columns) and search. Personal views are self-service;
 * team and organization views need `platform.saved_views.manage_shared`. Applying a view never widens access:
 * the list endpoint still applies the caller's permissions and scope.
 * @api GET/POST/PATCH/DELETE /saved-views?entity_type=
 */
export function SavedViewsMenu({ entityType, columns, onSearch }: { entityType: string; columns?: { key: string; label: string }[]; onSearch: (q: string) => void }) {
    const [sp, setSp] = useSearchParams();
    const views = useSavedViews(entityType);
    const update = useUpdateSavedView();
    const del = useDeleteSavedView();
    const [dialog, setDialog] = useState<{ mode: "create" | "edit"; view?: SavedView } | null>(null);
    const [deleting, setDeleting] = useState<SavedView | null>(null);
    const hidden = useHiddenColumns();
    const currentId = sp.get(VIEW_PARAM);
    const current = views.data?.find((v) => v.id === currentId) ?? null;
    const appliedDefault = useRef(false);

    const currentFilters = () => {
        const out: Record<string, string> = {};
        sp.forEach((v, k) => { if (!SKIP.has(k) && v) out[k] = v; });
        return out;
    };

    const apply = (view: SavedView | null) => {
        const next = new URLSearchParams();
        if (view) {
            for (const [k, v] of Object.entries(view.filters ?? {})) if (v) next.set(k, String(v));
            if (view.search) next.set("q", view.search);
            next.set(VIEW_PARAM, view.id);
        }
        onSearch(view?.search ?? "");
        setSp(next, { replace: true });
    };

    // Open the default view when the list is opened without any filters.
    useEffect(() => {
        if (appliedDefault.current || !views.data) return;
        appliedDefault.current = true;
        if ([...sp.keys()].length) return;
        const def = views.data.find((v) => v.is_default);
        if (def) apply(def);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [views.data]);

    const toggleColumn = (key: string) => {
        const next = new Set(hidden);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSp((prev) => {
            const n = new URLSearchParams(prev);
            if (next.size) n.set("hide", [...next].join(","));
            else n.delete("hide");
            return n;
        }, { replace: true });
    };

    const saveCurrent = (view: SavedView) =>
        update.mutate({ id: view.id, filters: currentFilters(), search: sp.get("q") ?? "" });

    const groups: { label: string; items: SavedView[] }[] = [
        { label: "My views", items: views.data?.filter((v) => v.visibility === "PERSONAL") ?? [] },
        { label: "Team views", items: views.data?.filter((v) => v.visibility === "TEAM") ?? [] },
        { label: "Organization views", items: views.data?.filter((v) => v.visibility === "ORGANIZATION") ?? [] },
    ].filter((g) => g.items.length);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 max-w-full sm:max-w-56" aria-label="Saved views">
                        <Bookmark /> <span className="truncate">{current?.name ?? "All records"}</span> <ChevronDown className="opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem onSelect={() => apply(null)}>
                        <Check className={currentId ? "opacity-0" : ""} /> All records
                    </DropdownMenuItem>
                    {views.isPending && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Loading views…</DropdownMenuLabel>}
                    {views.error && <DropdownMenuLabel className="text-xs font-normal text-danger">Could not load views</DropdownMenuLabel>}
                    {groups.map((g) => (
                        <DropdownMenuGroup key={g.label}>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{g.label}</DropdownMenuLabel>
                            {g.items.map((v) => (
                                <DropdownMenuItem key={v.id} onSelect={() => apply(v)}>
                                    <Check className={v.id === currentId ? "" : "opacity-0"} />
                                    <span className="flex-1 truncate">{v.name}</span>
                                    {v.is_default && <Star className="size-3 text-warning" aria-label="Default view" />}
                                    {v.team && <span className="text-xs text-muted-foreground">{v.team.name}</span>}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    ))}
                    <DropdownMenuSeparator />
                    {current?.can_edit && <DropdownMenuItem onSelect={() => saveCurrent(current)}><Save /> Update “{current.name}”</DropdownMenuItem>}
                    <DropdownMenuItem onSelect={() => setDialog({ mode: "create" })}><Plus /> Save as new view…</DropdownMenuItem>
                    {current?.can_edit && <DropdownMenuItem onSelect={() => setDialog({ mode: "edit", view: current })}><Pencil /> Rename or share…</DropdownMenuItem>}
                    {current?.can_edit && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(current)}><Trash2 /> Delete view</DropdownMenuItem>}
                </DropdownMenuContent>
            </DropdownMenu>
            {!!columns?.length && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8" aria-label="Choose columns"><Columns3 /> <span className="hidden sm:inline">Columns</span></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Show columns</DropdownMenuLabel>
                        {columns.map((c) => (
                            <DropdownMenuCheckboxItem key={c.key} checked={!hidden.has(c.key)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => toggleColumn(c.key)}>{c.label}</DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            <SaveViewDialog
                open={!!dialog}
                mode={dialog?.mode ?? "create"}
                view={dialog?.view}
                entityType={entityType}
                filters={currentFilters}
                search={sp.get("q") ?? ""}
                onOpenChange={(o) => !o && setDialog(null)}
                onSaved={(v) => { setDialog(null); if (dialog?.mode === "create") setSp((prev) => { const n = new URLSearchParams(prev); n.set(VIEW_PARAM, v.id); return n; }, { replace: true }); }}
            />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete view “${deleting?.name}”?`}
                description={deleting?.visibility === "PERSONAL" ? "Only the view is removed, never records." : "Everyone it is shared with loses this view. Records are not affected."}
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) del.mutate(deleting.id); setDeleting(null); apply(null); }}
            />
        </>
    );
}

function SaveViewDialog({ open, mode, view, entityType, filters, search, onOpenChange, onSaved }: {
    open: boolean; mode: "create" | "edit"; view?: SavedView; entityType: string; filters: () => Record<string, string>; search: string;
    onOpenChange: (o: boolean) => void; onSaved: (v: SavedView) => void;
}) {
    const canShare = usePermission("platform.saved_views.manage_shared");
    const canTeams = usePermission("organizations.teams.read");
    const teams = useTeamOptions(open && canShare && canTeams);
    // The dialog shows API errors inline.
    const create = useCreateSavedView({ errorToast: false });
    const update = useUpdateSavedView({ errorToast: false });
    const [name, setName] = useState("");
    const [visibility, setVisibility] = useState<SavedViewVisibility>("PERSONAL");
    const [teamId, setTeamId] = useState<string>("");
    const [isDefault, setIsDefault] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setName(view?.name ?? "");
        setVisibility(view?.visibility ?? "PERSONAL");
        setTeamId(view?.team_id ?? "");
        setIsDefault(view?.is_default ?? false);
        setError(null);
    }, [open, view]);

    const options = SavedViewVisibilityOptions.filter((o) => o.id === "PERSONAL" || (canShare && (o.id !== "TEAM" || canTeams)));
    const pending = create.isPending || update.isPending;
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter a name");
        if (visibility === "TEAM" && !teamId) return setError("Pick the team to share with");
        const dto = { name: name.trim(), visibility, team_id: visibility === "TEAM" ? teamId : undefined, is_default: isDefault };
        const opts = {
            onSuccess: (v: unknown) => onSaved(v as SavedView),
            onError: (err: unknown) => setError(getApiErrorMessage(err)),
        };
        if (mode === "edit" && view) update.mutate({ id: view.id, ...dto }, opts);
        else create.mutate({ ...dto, entity_type: entityType, layout: "table", filters: filters(), search }, opts);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{mode === "create" ? "Save view" : "Rename or share view"}</DialogTitle>
                        <DialogDescription>{mode === "create" ? "Saves the current filters, search and columns." : "Filters stay as saved. Use “Update” in the menu to save new filters."}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label htmlFor="view-name">Name</Label>
                        <Input id="view-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="My open enterprise deals" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Visible to</Label>
                        <Select value={visibility} onValueChange={(v) => setVisibility(v as SavedViewVisibility)}>
                            <SelectTrigger aria-label="Visible to"><SelectValue /></SelectTrigger>
                            <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        {!canShare && <p className="text-xs text-muted-foreground">Sharing views needs the “manage shared views” permission.</p>}
                    </div>
                    {visibility === "TEAM" && (
                        <div className="space-y-1.5">
                            <Label>Team</Label>
                            <Select value={teamId} onValueChange={setTeamId}>
                                <SelectTrigger aria-label="Team"><SelectValue placeholder={teams.isPending ? "Loading teams…" : "Choose a team"} /></SelectTrigger>
                                <SelectContent>{teams.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-[13px]">
                        <span>Open this view by default</span>
                        <Switch checked={isDefault} onCheckedChange={setIsDefault} aria-label="Default view" />
                    </label>
                    {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                        <Button type="submit" loading={pending}>Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
