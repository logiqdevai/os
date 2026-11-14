import { useEffect, useState } from "react";
import { ColorBadge, ColorPicker } from "@/components/ui/color-picker";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Tags } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCreateLeaveType, useLeaveTypes, useSetLeaveTypeArchived, useUpdateLeaveType } from "@/features/people/leave/hooks/use-leave";
import type { LeaveCategory, LeaveType, LeaveTypeDto } from "@/features/people/leave/interfaces/leave.interfaces";
import { LeaveCategoryFormOptions } from "@/config/constants/dropdowns/people/leave-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { Field, Toggle } from "./general-tab";


/** LeaveType list + editor. Archived types stay on old requests and balances. @perm employees.leave.manage_policies */
export function LeaveTypesTab() {
    const [archived, setArchived] = useState(false);
    const q = useLeaveTypes(true, archived);
    const setArch = useSetLeaveTypeArchived();
    const [editing, setEditing] = useState<LeaveType | "new" | null>(null);
    const rows = (q.data ?? []).filter((t) => (archived ? !!t.archived_at : !t.archived_at));
    const yes = (v: boolean) => (v ? "Yes" : "No");
    const columns: DataTableColumn<LeaveType>[] = [
        { key: "name", header: "Leave type", cell: (t) => <div className="flex items-center gap-2"><ColorBadge color={t.color}>{t.code}</ColorBadge><span className="font-medium text-foreground">{t.name}</span></div> },
        { key: "category", header: "Category", cell: (t) => getDropdownOptionLabel(LeaveCategoryFormOptions, t.category), hideBelow: "md" },
        { key: "paid", header: "Paid", cell: (t) => yes(t.is_paid), hideBelow: "lg" },
        { key: "approval", header: "Approval", cell: (t) => yes(t.requires_approval), hideBelow: "lg" },
        { key: "half", header: "Half days", cell: (t) => yes(t.allows_half_day), hideBelow: "xl" },
        { key: "balance", header: "Uses balance", cell: (t) => yes(t.deducts_balance), hideBelow: "md" },
        { key: "notice", header: "Notice", cell: (t) => (t.min_notice_days ? `${t.min_notice_days} d` : "—"), hideBelow: "lg" },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-12",
            cell: (t) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${t.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {!t.archived_at && <DropdownMenuItem onSelect={() => setEditing(t)}><Pencil /> Edit</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={() => setArch.mutate({ id: t.id, archived: !t.archived_at })}>
                            {t.archived_at ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground"><Switch checked={archived} onCheckedChange={setArchived} /> Show archived</label>
                <Button onClick={() => setEditing("new")}><Plus /> New leave type</Button>
            </div>
            <DataTable columns={columns} data={q.data ? rows : undefined} rowKey={(t) => t.id} loading={q.isFetching} error={q.error} onRetry={() => q.refetch()} onRowClick={(t) => !t.archived_at && setEditing(t)}
                empty={{ icon: Tags, title: archived ? "No archived leave types" : "No leave types", description: "Leave types define the rules for each kind of absence." }} />
            <LeaveTypeDialog value={editing} onClose={() => setEditing(null)} />
        </div>
    );
}

const EMPTY: LeaveTypeDto = { name: "", code: "", category: "VACATION", color: "info", is_paid: true, requires_approval: true, requires_attachment: false, allows_half_day: true, deducts_balance: true };

function LeaveTypeDialog({ value, onClose }: { value: LeaveType | "new" | null; onClose: () => void }) {
    const create = useCreateLeaveType();
    const update = useUpdateLeaveType();
    const [f, setF] = useState<LeaveTypeDto>(EMPTY);
    const [notice, setNotice] = useState("");
    const [maxDays, setMaxDays] = useState("");
    const [attachAfter, setAttachAfter] = useState("");
    useEffect(() => {
        if (!value) return;
        if (value === "new") { setF(EMPTY); setNotice(""); setMaxDays(""); setAttachAfter(""); return; }
        setF({ name: value.name, code: value.code, category: value.category, color: value.color ?? "neutral", is_paid: value.is_paid, requires_approval: value.requires_approval, requires_attachment: value.requires_attachment, allows_half_day: value.allows_half_day, deducts_balance: value.deducts_balance });
        setNotice(value.min_notice_days?.toString() ?? "");
        setMaxDays(value.max_consecutive_days?.toString() ?? "");
        setAttachAfter(value.attachment_after_days?.toString() ?? "");
    }, [value]);
    const set = <K extends keyof LeaveTypeDto>(k: K, v: LeaveTypeDto[K]) => setF((p) => ({ ...p, [k]: v }));
    const pending = create.isPending || update.isPending;
    const codeOk = /^[A-Z][A-Z0-9_]{1,15}$/.test(f.code);
    const submit = () => {
        const dto: LeaveTypeDto = { ...f, name: f.name.trim(), ...(notice !== "" && { min_notice_days: Number(notice) }), ...(maxDays !== "" && { max_consecutive_days: Number(maxDays) }), ...(f.requires_attachment && attachAfter !== "" && { attachment_after_days: Number(attachAfter) }) };
        // Edits are optimistic (the list shows them at once), so the dialog closes right away; creating waits for the id.
        if (value === "new") create.mutate(dto, { onSuccess: onClose });
        else if (value) { update.mutate({ id: value.id, ...dto }); onClose(); }
    };
    return (
        <Dialog open={!!value} onOpenChange={(o) => !o && !pending && onClose()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>{value === "new" ? "New leave type" : "Edit leave type"}</DialogTitle><DialogDescription>Rules apply to new requests.</DialogDescription></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" htmlFor="lt-name"><Input id="lt-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Vacation" /></Field>
                    <Field label="Code" htmlFor="lt-code" hint={f.code && !codeOk ? "2–16 capital letters, digits or _" : undefined}><Input id="lt-code" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="VAC" /></Field>
                    <Field label="Category">
                        <Select value={f.category} onValueChange={(v) => set("category", v as LeaveCategory)}><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger><SelectContent>{LeaveCategoryFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    </Field>
                    <Field label="Colour">
                        <ColorPicker label="Colour" value={f.color} onChange={(v) => set("color", v)} />
                    </Field>
                    <Field label="Minimum notice (days)" htmlFor="lt-notice"><Input id="lt-notice" type="number" min={0} max={365} value={notice} onChange={(e) => setNotice(e.target.value)} /></Field>
                    <Field label="Max consecutive days" htmlFor="lt-max"><Input id="lt-max" type="number" min={1} max={730} value={maxDays} onChange={(e) => setMaxDays(e.target.value)} /></Field>
                    <div className="space-y-3 sm:col-span-2">
                        <Toggle label="Paid" checked={!!f.is_paid} onChange={(v) => set("is_paid", v)} />
                        <Toggle label="Requires approval" checked={!!f.requires_approval} onChange={(v) => set("requires_approval", v)} />
                        <Toggle label="Deducts from the balance" checked={!!f.deducts_balance} onChange={(v) => set("deducts_balance", v)} />
                        <Toggle label="Allows half days" checked={!!f.allows_half_day} onChange={(v) => set("allows_half_day", v)} />
                        <Toggle label="Requires an attachment" checked={!!f.requires_attachment} onChange={(v) => set("requires_attachment", v)} />
                        {f.requires_attachment && <Field label="Attachment needed after (days)" htmlFor="lt-att"><Input id="lt-att" type="number" min={0} value={attachAfter} onChange={(e) => setAttachAfter(e.target.value)} className="w-28" /></Field>}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button disabled={!f.name.trim() || !codeOk} loading={pending} onClick={submit}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
