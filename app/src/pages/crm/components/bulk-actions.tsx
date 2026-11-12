import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, GitMerge, Layers, Tag, Tags, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DataTableColumn } from "@/components/ui/data-table";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { CompanyTypeFormOptions } from "@/config/constants/dropdowns/crm/company-type-form.options";
import { useBulkAction } from "@/features/crm/bulk/hooks/use-bulk";
import { useCrmMembers, useCrmSettings } from "@/features/crm/settings/hooks/use-crm-settings";
import { useTags } from "@/features/crm/tags/hooks/use-tags";
import { usePipelines } from "@/features/crm/pipelines/hooks/use-pipelines";
import type { BulkAction, BulkActionDto, BulkEntity, BulkResult } from "@/features/crm/bulk/interfaces/bulk.interfaces";
import { CrmPaths } from "../crm-paths";
import { memberLabel } from "./crm-ui";

const RES: Record<BulkEntity, string> = { CRM_COMPANY: "companies", CRM_CONTACT: "contacts", CRM_LEAD: "leads", CRM_DEAL: "deals" };

/** Selection of rows on the current page; cleared when the page or filters change. */
export function useRowSelection(resetKey: string) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    useEffect(() => setSelected(new Set()), [resetKey]);
    return {
        selected,
        toggle: (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
        setAll: (ids: string[], on: boolean) => setSelected(on ? new Set(ids) : new Set()),
        clear: () => setSelected(new Set()),
    };
}

/** Checkbox column for DataTable (row click ignores checkboxes). Hidden when the caller can't run any bulk action. */
export function selectionColumn<T extends { id: string }>(sel: ReturnType<typeof useRowSelection>, rows: T[] | undefined): DataTableColumn<T> {
    const ids = rows?.map((r) => r.id) ?? [];
    const all = ids.length > 0 && ids.every((id) => sel.selected.has(id));
    const some = ids.some((id) => sel.selected.has(id));
    return {
        key: "_select",
        header: <Checkbox aria-label="Select all on this page" checked={all ? true : some ? "indeterminate" : false} onCheckedChange={(c) => sel.setAll(ids, !!c)} />,
        cell: (r) => <Checkbox aria-label="Select row" checked={sel.selected.has(r.id)} onCheckedChange={() => sel.toggle(r.id)} />,
        className: "w-8 pr-0",
        headerClassName: "w-8 pr-0",
    };
}

/** Whether the caller holds any key a bulk action on this entity needs. */
export function useCanBulk(entity: BulkEntity) {
    const p = usePermissions();
    const r = RES[entity];
    return p.canAny(`crm.${r}.update`, `crm.${r}.assign`, `crm.${r}.archive`, `crm.${r}.merge`, ...(entity === "CRM_DEAL" ? ["crm.deals.change_stage"] : []));
}

type BulkDialogState = { action: BulkAction; title: string } | null;

/**
 * Bar shown above a list when rows are selected (mockup `bulk-assign`, 02 §20). Each record is checked by the API
 * (permission + scope); partial failures are listed.
 * @api POST /crm/bulk {entity_type, ids, action, …}
 * @mcp crm_records_bulk_update
 */
export function BulkActionBar({ entity, sel, archived }: { entity: BulkEntity; sel: ReturnType<typeof useRowSelection>; archived?: boolean }) {
    const p = usePermissions();
    const navigate = useNavigate();
    const run = useBulkAction();
    const [dialog, setDialog] = useState<BulkDialogState>(null);
    const [failures, setFailures] = useState<BulkResult["failed"] | null>(null);
    const r = RES[entity];
    const ids = [...sel.selected];
    if (!ids.length) return null;

    const exec = (dto: Omit<BulkActionDto, "entity_type" | "ids">, label: string) =>
        run.mutate({ entity_type: entity, ids, ...dto }, {
            onSuccess: (res) => {
                setDialog(null);
                if (res.failed.length) {
                    setFailures(res.failed);
                    toast({ variant: res.succeeded.length ? "default" : "destructive", title: `${label}: ${res.succeeded.length} of ${res.requested} done`, description: `${res.failed.length} could not be changed.` });
                    sel.setAll(res.failed.map((f) => f.id), true);
                } else {
                    toast({ title: `${label}: ${res.succeeded.length} record${res.succeeded.length === 1 ? "" : "s"} updated` });
                    sel.clear();
                }
            },
            onError: (e) => toast({ variant: "destructive", title: `Could not ${label.toLowerCase()}`, description: getApiErrorMessage(e) }),
        });

    const canMerge = ids.length >= 2 && ids.length <= 5 && p.can(`crm.${r}.merge`);
    return (
        <>
            <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm" role="toolbar" aria-label="Bulk actions">
                <span className="text-[13px] font-medium text-foreground tabular">{ids.length} selected</span>
                <div className="flex flex-wrap gap-1.5 sm:ml-2">
                    {p.can(`crm.${r}.assign`) && <Button size="sm" variant="outline" onClick={() => setDialog({ action: "assign", title: "Assign owner" })}><UserCog /> Assign</Button>}
                    {p.can(`crm.${r}.update`) && <Button size="sm" variant="outline" onClick={() => setDialog({ action: "add_tag", title: "Add tag" })}><Tag /> Tag</Button>}
                    {p.can(`crm.${r}.update`) && <Button size="sm" variant="outline" onClick={() => setDialog({ action: "remove_tag", title: "Remove tag" })}><Tags /> Untag</Button>}
                    {entity === "CRM_LEAD" && p.can("crm.leads.update") && <Button size="sm" variant="outline" onClick={() => setDialog({ action: "set_status", title: "Change status" })}><Layers /> Status</Button>}
                    {entity === "CRM_DEAL" && p.can("crm.deals.change_stage") && <Button size="sm" variant="outline" onClick={() => setDialog({ action: "set_stage", title: "Move to stage" })}><Layers /> Stage</Button>}
                    {(entity === "CRM_COMPANY" || entity === "CRM_CONTACT") && p.can(`crm.${r}.update`) && <Button size="sm" variant="outline" onClick={() => setDialog({ action: "set_lifecycle", title: "Change lifecycle stage" })}><Layers /> Lifecycle</Button>}
                    {entity === "CRM_COMPANY" && p.can("crm.companies.update") && <Button size="sm" variant="outline" onClick={() => setDialog({ action: "set_type", title: "Change type" })}>Type</Button>}
                    {p.can(`crm.${r}.archive`) && (archived
                        ? <Button size="sm" variant="outline" loading={run.isPending} onClick={() => exec({ action: "restore" }, "Restore")}><ArchiveRestore /> Restore</Button>
                        : <Button size="sm" variant="outline" onClick={() => setDialog({ action: "archive", title: `Archive ${ids.length} record${ids.length === 1 ? "" : "s"}?` })}><Archive /> Archive</Button>)}
                    {canMerge && <Button size="sm" variant="outline" onClick={() => navigate(CrmPaths.merge(entity, ids))}><GitMerge /> Merge</Button>}
                </div>
                <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Clear selection" onClick={sel.clear}><X /></Button>
            </div>
            <BulkDialog entity={entity} dialog={dialog} count={ids.length} pending={run.isPending} onClose={() => setDialog(null)} onRun={exec} />
            <Dialog open={!!failures} onOpenChange={(o) => !o && setFailures(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Some records were not changed</DialogTitle><DialogDescription>They stay selected so you can retry or review them.</DialogDescription></DialogHeader>
                    <ul className="max-h-64 space-y-1 overflow-y-auto text-[13px]">
                        {failures?.map((f) => <li key={f.id} className="rounded-md border border-border px-2 py-1"><span className="text-danger">{f.reason}</span></li>)}
                    </ul>
                    <DialogFooter><Button variant="ghost" onClick={() => setFailures(null)}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function BulkDialog({ entity, dialog, count, pending, onClose, onRun }: { entity: BulkEntity; dialog: BulkDialogState; count: number; pending: boolean; onClose: () => void; onRun: (dto: Omit<BulkActionDto, "entity_type" | "ids">, label: string) => void }) {
    const open = !!dialog;
    const action = dialog?.action;
    const members = useCrmMembers(open && action === "assign");
    const tags = useTags(entity, open && (action === "add_tag" || action === "remove_tag"));
    const settings = useCrmSettings(false, open);
    const pipelines = usePipelines();
    const [value, setValue] = useState("");
    const [reason, setReason] = useState("");
    useEffect(() => { setValue(""); setReason(""); }, [dialog]);

    const options = useMemo((): { id: string; label: string; lost?: boolean }[] => {
        switch (action) {
            case "assign": return members.data?.map((m) => ({ id: m.id, label: memberLabel(m) })) ?? [];
            case "add_tag": case "remove_tag": return tags.data?.map((t) => ({ id: t.id, label: t.name })) ?? [];
            case "set_status": return settings.data?.lead_statuses.filter((s) => !s.is_converted && !s.archived_at).map((s) => ({ id: s.id, label: s.name, lost: s.is_lost })) ?? [];
            case "set_lifecycle": return settings.data?.lifecycle_stages.filter((s) => !s.archived_at).map((s) => ({ id: s.id, label: s.name })) ?? [];
            case "set_type": return CompanyTypeFormOptions.map((o) => ({ id: o.id, label: o.label }));
            case "set_stage": return pipelines.data?.flatMap((p) => p.stages.map((s) => ({ id: s.id, label: (pipelines.data?.length ?? 0) > 1 ? `${p.name} · ${s.name}` : s.name, lost: s.is_lost }))) ?? [];
            default: return [];
        }
    }, [action, members.data, tags.data, settings.data, pipelines.data]);
    const chosen = options.find((o) => o.id === value);
    const needsReason = !!chosen?.lost;
    const lossReasons = settings.data?.loss_reasons.filter((l) => !l.archived_at && (l.applies_to === "BOTH" || l.applies_to === (entity === "CRM_LEAD" ? "LEAD" : "DEAL"))) ?? [];

    const submit = () => {
        if (!action || !dialog) return;
        if (action === "archive") return onRun({ action }, "Archive");
        if (!value || (needsReason && !reason)) return;
        const field = { assign: "owner_membership_id", add_tag: "tag_id", remove_tag: "tag_id", set_status: "status_id", set_stage: "stage_id", set_lifecycle: "lifecycle_stage_id", set_type: "type" }[action as Exclude<BulkAction, "archive" | "restore">];
        onRun({ action, [field]: value, ...(needsReason && { lost_reason_id: reason }) }, dialog.title);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{dialog?.title}</DialogTitle>
                    <DialogDescription>{action === "archive" ? "Archived records leave lists and pickers. You can restore them later." : `Applies to ${count} selected record${count === 1 ? "" : "s"}. Records you can't change are skipped and listed.`}</DialogDescription>
                </DialogHeader>
                {action !== "archive" && (
                    <div className="space-y-3">
                        <Select value={value} onValueChange={setValue}>
                            <SelectTrigger aria-label={dialog?.title}><SelectValue placeholder={options.length ? "Choose…" : "Loading…"} /></SelectTrigger>
                            <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        {needsReason && (
                            <div className="space-y-1.5">
                                <Label>Reason lost</Label>
                                <Select value={reason} onValueChange={setReason}>
                                    <SelectTrigger aria-label="Reason lost"><SelectValue placeholder="Choose a reason" /></SelectTrigger>
                                    <SelectContent>{lossReasons.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}
                        {action === "set_stage" && <p className="text-xs text-muted-foreground">Deals in another pipeline than the chosen stage are skipped.</p>}
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
                    <Button onClick={submit} loading={pending} disabled={action !== "archive" && (!value || (needsReason && !reason))} variant={action === "archive" ? "destructive" : "default"}>Apply</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
