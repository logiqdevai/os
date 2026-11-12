import { useEffect, useState } from "react";
import { CalendarHeart, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import {
    useBranchHolidays, useCreateBranchHoliday, useCreateHoliday, useHolidays, useRemoveBranchHoliday, useRemoveHoliday, useUpdateHoliday,
} from "@/features/people/leave/hooks/use-leave";
import type { CompanyHoliday, HolidayDto } from "@/features/people/leave/interfaces/leave.interfaces";
import { HolidayKindFormOptions } from "@/config/constants/dropdowns/people/leave-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { Panel } from "../../../components/person";
import { Field, Toggle } from "./general-tab";


interface Row {
    id: string;
    source: "company" | "branch";
    name: string;
    date: string;
    recurring: boolean;
    is_half_day: boolean;
    kind: "PUBLIC" | "COMPANY" | null;
    branches: string;
    company?: CompanyHoliday;
}

/** Company holidays (CompanyHoliday) and branch holidays (BranchHoliday, 01 §122). Both reduce capacity and leave days. @perm employees.leave.manage_policies */
export function HolidaysTab({ branches }: { branches: { id: string; name: string }[] }) {
    const [year, setYear] = useState(() => new Date().getFullYear());
    const company = useHolidays(year);
    const branch = useBranchHolidays(year);
    const removeCompany = useRemoveHoliday();
    const removeBranch = useRemoveBranchHoliday();
    const [editing, setEditing] = useState<CompanyHoliday | "new" | null>(null);
    const [deleting, setDeleting] = useState<Row | null>(null);
    const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "Branch";

    const rows: Row[] | undefined = company.data && branch.data ? [
        ...company.data.map((h) => ({ id: h.id, source: "company" as const, name: h.name, date: h.date, recurring: h.recurring, is_half_day: h.is_half_day, kind: h.kind, branches: h.applies_to_branch_ids.length ? h.applies_to_branch_ids.map(branchName).join(", ") : "All", company: h })),
        ...branch.data.map((h) => ({ id: h.id, source: "branch" as const, name: h.name, date: h.date, recurring: h.recurring, is_half_day: false, kind: null, branches: h.branch.name })),
    ].sort((a, b) => a.date.slice(5).localeCompare(b.date.slice(5)) || a.name.localeCompare(b.name)) : undefined;

    const columns: DataTableColumn<Row>[] = [
        { key: "date", header: "Date", cell: (r) => <span className="tabular">{formatDate(r.date, r.recurring ? "d MMM" : "d MMM yyyy")}</span> },
        { key: "name", header: "Holiday", cell: (r) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{r.name}</div><div className="truncate text-xs text-muted-foreground sm:hidden">{r.branches}</div></div> },
        { key: "kind", header: "Kind", cell: (r) => (r.kind ? <Badge variant={r.kind === "COMPANY" ? "violet" : "neutral"}>{getDropdownOptionLabel(HolidayKindFormOptions, r.kind)}</Badge> : <Badge variant="info">Branch</Badge>), hideBelow: "md" },
        { key: "flags", header: "Rules", cell: (r) => <span className="text-xs text-muted-foreground">{[r.recurring && "Every year", r.is_half_day && "Half day"].filter(Boolean).join(" · ") || "—"}</span>, hideBelow: "lg" },
        { key: "branches", header: "Branches", cell: (r) => <span className="text-[13px]">{r.branches}</span>, hideBelow: "sm" },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-20",
            cell: (r) => (
                <div className="flex justify-end gap-1">
                    {r.company && <Button size="icon" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r.company!)}><Pencil /></Button>}
                    <Button size="icon" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}><Trash2 /></Button>
                </div>
            ),
        },
    ];
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}><ChevronLeft /></Button>
                    <span className="w-14 text-center text-[13px] font-medium tabular text-foreground">{year}</span>
                    <Button size="icon" variant="outline" aria-label="Next year" onClick={() => setYear((y) => y + 1)}><ChevronRight /></Button>
                </div>
                <Button onClick={() => setEditing("new")}><Plus /> Add holiday</Button>
            </div>
            <DataTable columns={columns} data={rows} rowKey={(r) => `${r.source}-${r.id}`} loading={company.isFetching || branch.isFetching} error={company.error ?? branch.error} onRetry={() => { company.refetch(); branch.refetch(); }}
                empty={{ icon: CalendarHeart, title: `No holidays in ${year}`, description: "Holidays reduce capacity and are skipped when leave days are counted." }} />
            {!!branches.length && <BranchHolidayForm branches={branches} />}
            <HolidayDialog value={editing} branches={branches} onClose={() => setEditing(null)} />
            <ConfirmationDialog isOpen={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${deleting?.name ?? "holiday"}?`} description="Leave already approved is not recounted." confirmText="Delete" variant="destructive"
                onConfirm={() => {
                    // Optimistic: the row disappears at once and comes back if the API refuses.
                    if (!deleting) return;
                    if (deleting.source === "company") removeCompany.mutate(deleting.id);
                    else removeBranch.mutate(deleting.id);
                    setDeleting(null);
                }} />
        </div>
    );
}

function HolidayDialog({ value, branches, onClose }: { value: CompanyHoliday | "new" | null; branches: { id: string; name: string }[]; onClose: () => void }) {
    const create = useCreateHoliday();
    const update = useUpdateHoliday();
    const [f, setF] = useState<HolidayDto>({ name: "", date: "", kind: "PUBLIC", is_half_day: false, recurring: false, applies_to_branch_ids: [] });
    useEffect(() => {
        if (!value) return;
        if (value === "new") setF({ name: "", date: "", kind: "PUBLIC", is_half_day: false, recurring: false, applies_to_branch_ids: [] });
        else setF({ name: value.name, date: value.date.slice(0, 10), kind: value.kind, is_half_day: value.is_half_day, recurring: value.recurring, applies_to_branch_ids: value.applies_to_branch_ids });
    }, [value]);
    const set = <K extends keyof HolidayDto>(k: K, v: HolidayDto[K]) => setF((p) => ({ ...p, [k]: v }));
    const pending = create.isPending || update.isPending;
    const ids = f.applies_to_branch_ids ?? [];
    const submit = () => {
        const dto = { ...f, name: f.name.trim() };
        // Edits are optimistic (the list shows them at once), so the dialog closes right away; creating waits for the id.
        if (value === "new") create.mutate(dto, { onSuccess: onClose });
        else if (value) { update.mutate({ id: value.id, ...dto }); onClose(); }
    };
    return (
        <Dialog open={!!value} onOpenChange={(o) => !o && !pending && onClose()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                <DialogHeader><DialogTitle>{value === "new" ? "Add company holiday" : "Edit holiday"}</DialogTitle><DialogDescription>Applies to the whole organization or to selected branches.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <Field label="Name" htmlFor="ho-name"><Input id="ho-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Christmas Day" /></Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Date" htmlFor="ho-date"><Input id="ho-date" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
                        <Field label="Kind">
                            <Select value={f.kind} onValueChange={(v) => set("kind", v as HolidayDto["kind"])}><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger><SelectContent>{HolidayKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                        </Field>
                    </div>
                    <Toggle label="Every year on this date" checked={!!f.recurring} onChange={(v) => set("recurring", v)} />
                    <Toggle label="Half day" checked={!!f.is_half_day} onChange={(v) => set("is_half_day", v)} />
                    {!!branches.length && (
                        <Field label="Branches" hint="None selected = the whole organization.">
                            <div className="grid gap-2 sm:grid-cols-2">
                                {branches.map((b) => (
                                    <label key={b.id} className="flex items-center gap-2 text-[13px] text-foreground">
                                        <Checkbox checked={ids.includes(b.id)} onCheckedChange={(on) => set("applies_to_branch_ids", on ? [...ids, b.id] : ids.filter((x) => x !== b.id))} />{b.name}
                                    </label>
                                ))}
                            </div>
                        </Field>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button disabled={!f.name.trim() || !f.date} loading={pending} onClick={submit}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Quick add for a branch-only holiday (BranchHoliday). */
function BranchHolidayForm({ branches }: { branches: { id: string; name: string }[] }) {
    const create = useCreateBranchHoliday();
    const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
    const [name, setName] = useState("");
    const [date, setDate] = useState("");
    const [recurring, setRecurring] = useState(false);
    return (
        <Panel title="Add a branch holiday">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_10rem_auto_auto] lg:items-end">
                <Field label="Branch">
                    <Select value={branchId} onValueChange={setBranchId}><SelectTrigger aria-label="Branch"><SelectValue placeholder="Pick a branch" /></SelectTrigger><SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
                </Field>
                <Field label="Name" htmlFor="bh-name"><Input id="bh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Local festival" /></Field>
                <Field label="Date" htmlFor="bh-date"><Input id="bh-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                <label className="flex h-9 items-center gap-2 text-[13px] text-foreground"><Checkbox checked={recurring} onCheckedChange={(v) => setRecurring(!!v)} /> Every year</label>
                <Button disabled={!branchId || !name.trim() || !date} loading={create.isPending}
                    onClick={() => create.mutate({ branch_id: branchId, name: name.trim(), date, recurring }, { onSuccess: () => { setName(""); setDate(""); } })}>
                    <Plus /> Add
                </Button>
            </div>
        </Panel>
    );
}
