import { useState } from "react";
import { Clock, Lock, MoreHorizontal, Pencil, Plus, Trash2, Unlock } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useDeleteTimeEntry, useTimeEntries, useUnlockTimeEntry } from "@/features/time/entries/hooks/use-time-entries";
import type { TimeEntry, TimeScope } from "@/features/time/entries/interfaces/time-entries.interfaces";
import { BillableFilterOptions, TimeEntryStatusFilterOptions, TimeEntryStatusFormOptions, TimeEntryStatusTone, TimeScopeOptions } from "@/config/constants/dropdowns/time/time-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatMinutes, formatMoney, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { EntryFormDialog } from "../../components/entry-form-dialog";

/**
 * /time/entries — entries with Mine / Team / All scopes (time.entries.read_own / read_team / read_all).
 * Amounts need time.rates.read. @api GET /time/entries · PATCH · DELETE · POST /:id/unlock
 */
export default function EntriesPage() {
    const p = usePermissions();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const scopes = TimeScopeOptions.filter((s) => p.can(`time.entries.read_${s.id === "mine" ? "own" : s.id}`));
    const scope = (scopes.find((s) => s.id === filters.scope)?.id ?? scopes[0]?.id ?? "mine") as TimeScope;
    const entries = useTimeEntries({ ...params, scope });
    const del = useDeleteTimeEntry();
    const unlock = useUnlockTimeEntry();
    const [editing, setEditing] = useState<TimeEntry | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<TimeEntry | null>(null);
    const [unlocking, setUnlocking] = useState<TimeEntry | null>(null);
    const [reason, setReason] = useState("");
    const showAmounts = p.can("time.rates.read");

    const columns: DataTableColumn<TimeEntry>[] = [
        { key: "date", header: "Date", cell: (e) => <span className="tabular">{formatDate(e.date, "EEE d MMM")}</span> },
        ...(scope !== "mine" ? [{ key: "member", header: "Person", cell: (e: TimeEntry) => personName(e.membership.user), hideBelow: "md" as const }] : []),
        {
            key: "work", header: "Work", cell: (e) => (
                <div className="min-w-0">
                    <div className="truncate text-foreground">{e.project?.name ?? "Internal"}{e.task ? ` · ${e.task.title}` : ""}</div>
                    <div className="truncate text-xs text-muted-foreground">{e.description ?? e.activity_type?.name ?? ""}</div>
                </div>
            ),
        },
        { key: "billable", header: "Billable", cell: (e) => (e.is_billable ? <Badge variant="info">Billable</Badge> : <Badge variant="secondary">Non-billable</Badge>), hideBelow: "lg" },
        ...(showAmounts ? [{ key: "amount", header: "Amount", cell: (e: TimeEntry) => <span className="tabular">{e.billable_amount ? formatMoney(e.billable_amount, e.billing_currency ?? "EUR") : "—"}</span>, hideBelow: "xl" as const, className: "text-right", headerClassName: "text-right" }] : []),
        { key: "duration", header: "Time", cell: (e) => <span className="tabular font-medium text-foreground">{formatMinutes(e.duration_minutes)}</span>, className: "text-right", headerClassName: "text-right" },
        { key: "status", header: "Status", cell: (e) => <span className="inline-flex items-center gap-1"><Badge variant={TimeEntryStatusTone[e.status]}>{getDropdownOptionLabel(TimeEntryStatusFormOptions, e.status)}</Badge>{e.is_locked && <Lock className="size-3 text-muted-foreground" aria-label="Locked" />}</span>, hideBelow: "sm" },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10",
            cell: (e) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Entry actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={e.is_locked} onSelect={() => setEditing(e)}><Pencil /> Edit</DropdownMenuItem>
                        {e.is_locked && p.can("time.entries.unlock") && <DropdownMenuItem onSelect={() => setUnlocking(e)}><Unlock /> Unlock</DropdownMenuItem>}
                        {["DRAFT", "REJECTED"].includes(e.status) && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(e)}><Trash2 /> Delete</DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Time entries"
                description={entries.data ? `${formatMinutes(entries.data.totals.duration_minutes)} total · ${formatMinutes(entries.data.totals.billable_minutes)} billable` : undefined}
                actions={<Can permission="time.entries.create_own"><Button onClick={() => setCreating(true)}><Plus /> Log time</Button></Can>}
            />
            {scopes.length > 1 && (
                <Tabs value={scope} onValueChange={(v) => setFilter("scope", v === scopes[0].id ? null : v)} className="mb-3">
                    <TabsList>{scopes.map((s) => <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>)}</TabsList>
                </Tabs>
            )}
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search description…">
                <Input type="date" value={filters.from ?? ""} onChange={(e) => setFilter("from", e.target.value)} className="h-8 w-full sm:w-36" aria-label="From" />
                <Input type="date" value={filters.to ?? ""} onChange={(e) => setFilter("to", e.target.value)} className="h-8 w-full sm:w-36" aria-label="To" />
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{TimeEntryStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.billable ?? "all"} onValueChange={(v) => setFilter("billable", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by billable"><SelectValue /></SelectTrigger>
                    <SelectContent>{BillableFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={entries.data?.data}
                rowKey={(e) => e.id}
                loading={entries.isFetching}
                error={entries.error}
                onRetry={() => entries.refetch()}
                pagination={entries.data?.pagination}
                onPageChange={setPage}
                onRowClick={(e) => !e.is_locked && setEditing(e)}
                empty={{ icon: Clock, title: "No entries match", description: "Log time or start a timer from My timesheet." }}
            />
            <EntryFormDialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }} entry={editing} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title="Delete this entry?"
                description={deleting ? `${formatMinutes(deleting.duration_minutes)} on ${formatDate(deleting.date)}.` : ""}
                confirmText="Delete"
                variant="destructive"
                isLoading={del.isPending}
                onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => { toast({ title: "Entry deleted" }); setDeleting(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not delete", description: getApiErrorMessage(e) }) })}
            />
            <Dialog open={!!unlocking} onOpenChange={(o) => { if (!o) { setUnlocking(null); setReason(""); } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Unlock entry</DialogTitle><DialogDescription>Unlocking approved time is audited. Say why.</DialogDescription></DialogHeader>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong project" aria-label="Reason" />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setUnlocking(null)}>Cancel</Button>
                        <Button disabled={reason.trim().length < 3} loading={unlock.isPending} onClick={() => unlocking && unlock.mutate({ id: unlocking.id, reason: reason.trim() }, { onSuccess: () => { toast({ title: "Entry unlocked" }); setUnlocking(null); setReason(""); }, onError: (e) => toast({ variant: "destructive", title: "Could not unlock", description: getApiErrorMessage(e) }) })}>Unlock</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
