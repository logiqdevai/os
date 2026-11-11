import { useEffect, useState } from "react";
import { Archive, DollarSign, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useArchiveRate, useCreateRate, useRates, useUpdateRate } from "@/features/time/rates/hooks/use-rates";
import { useTimeMembers } from "@/features/time/settings/hooks/use-time-settings";
import type { BillingRate, BillingRateScope, TimeRateKind } from "@/features/time/rates/interfaces/rates.interfaces";
import { RateKindFormOptions, RateScopeFormOptions, RateStatusFilterOptions } from "@/config/constants/dropdowns/time/time-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatMoney, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { ActivitySelect, ProjectSelect } from "../../components/pickers";

/**
 * /time/rates — billing and cost rate cards. Resolution: member on project > project > member > organization.
 * Used rates are immutable except end date, name and notes. @perm time.rates.read · manage time.rates.manage
 */
export default function RatesPage() {
    const { params, setPage, filters, setFilter } = useListParams();
    const kind = (filters.kind ?? "BILLING") as TimeRateKind;
    const status = filters.status ?? "active";
    const rates = useRates({ ...params, kind, status });
    const canManage = usePermission("time.rates.manage");
    const archive = useArchiveRate();
    const [editing, setEditing] = useState<BillingRate | null>(null);
    const [creating, setCreating] = useState(false);
    const [archiving, setArchiving] = useState<BillingRate | null>(null);

    const target = (r: BillingRate) => {
        if (r.scope === "ORGANIZATION") return "Everyone";
        if (r.scope === "PROJECT") return r.project?.name ?? "Project";
        if (r.scope === "MEMBER") return r.membership ? personName(r.membership.user) : "Member";
        if (r.scope === "PROJECT_MEMBER") return `${r.membership ? personName(r.membership.user) : "Member"} on ${r.project?.name ?? "project"}`;
        return r.product?.name ?? "Product";
    };
    const columns: DataTableColumn<BillingRate>[] = [
        { key: "target", header: "Applies to", cell: (r) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{r.name ?? target(r)}</div><div className="truncate text-xs text-muted-foreground">{getDropdownOptionLabel(RateScopeFormOptions, r.scope)}{r.activity_type ? ` · ${r.activity_type.name}` : ""}</div></div> },
        { key: "rate", header: "Hourly", cell: (r) => <span className="tabular font-medium text-foreground">{formatMoney(r.hourly_rate, r.currency)}</span>, className: "text-right", headerClassName: "text-right" },
        { key: "period", header: "Valid", cell: (r) => <span className="tabular text-xs">{formatDate(r.effective_from)} – {r.effective_to ? formatDate(r.effective_to) : "open"}</span>, hideBelow: "md" },
        { key: "used", header: "Used", cell: (r) => <span className="tabular">{r._count.billed_entries + r._count.costed_entries}</span>, hideBelow: "lg", className: "text-right", headerClassName: "text-right" },
        { key: "state", header: "", cell: (r) => (r.archived_at ? <Badge variant="neutral">Archived</Badge> : null), hideBelow: "sm" },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10",
            cell: (r) => canManage && !r.archived_at && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Rate actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(r)}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(r)}><Archive /> Archive</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader title="Billing rates" description="Hourly prices and costs snapshotted onto time entries when they are saved." actions={<Can permission="time.rates.manage"><Button onClick={() => setCreating(true)}><Plus /> New rate</Button></Can>} />
            <TableToolbar>
                <Select value={kind} onValueChange={(v) => setFilter("kind", v === "BILLING" ? null : v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Rate kind"><SelectValue /></SelectTrigger>
                    <SelectContent>{RateKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => setFilter("status", v === "active" ? null : v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{RateStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={rates.data?.data} rowKey={(r) => r.id} loading={rates.isFetching} error={rates.error} onRetry={() => rates.refetch()} pagination={rates.data?.pagination} onPageChange={setPage}
                empty={{ icon: DollarSign, title: "No rate cards", description: "Billable time is valued at 0 until a rate exists. Start with an organization default." }} />
            <RateDialog open={creating || !!editing} rate={editing} defaultKind={kind} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }} />
            <ConfirmationDialog isOpen={!!archiving} onClose={() => setArchiving(null)} title="Archive this rate?" description="It stops applying to new entries. Entries already priced keep their snapshot." confirmText="Archive" variant="destructive" isLoading={archive.isPending}
                onConfirm={() => archiving && archive.mutate(archiving.id, { onSuccess: () => { toast({ title: "Rate archived" }); setArchiving(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not archive", description: getApiErrorMessage(e) }) })} />
        </Page>
    );
}

function RateDialog({ open, rate, defaultKind, onOpenChange }: { open: boolean; rate: BillingRate | null; defaultKind: TimeRateKind; onOpenChange: (o: boolean) => void }) {
    const create = useCreateRate();
    const update = useUpdateRate();
    const members = useTimeMembers("all", open);
    const [kind, setKind] = useState<TimeRateKind>(defaultKind);
    const [scope, setScope] = useState<BillingRateScope>("ORGANIZATION");
    const [projectId, setProjectId] = useState<string | null>(null);
    const [memberId, setMemberId] = useState<string>("");
    const [activityId, setActivityId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState("EUR");
    const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
    const [to, setTo] = useState("");

    useEffect(() => {
        if (!open) return;
        setKind(rate?.kind ?? defaultKind); setScope(rate?.scope ?? "ORGANIZATION"); setProjectId(rate?.project_id ?? null); setMemberId(rate?.membership_id ?? "");
        setActivityId(rate?.activity_type_id ?? null); setName(rate?.name ?? ""); setAmount(rate?.hourly_rate ?? ""); setCurrency(rate?.currency ?? "EUR");
        setFrom(rate?.effective_from.slice(0, 10) ?? new Date().toISOString().slice(0, 10)); setTo(rate?.effective_to?.slice(0, 10) ?? "");
    }, [open, rate, defaultKind]);

    const needsProject = scope === "PROJECT" || scope === "PROJECT_MEMBER";
    const needsMember = scope === "MEMBER" || scope === "PROJECT_MEMBER";
    const valid = Number(amount) >= 0 && amount !== "" && /^[A-Z]{3}$/.test(currency) && !!from && (!needsProject || projectId) && (!needsMember || memberId) && scope !== "PRODUCT" && (!to || to >= from);
    const pending = create.isPending || update.isPending;
    const opts = { onSuccess: () => { toast({ title: rate ? "Rate updated" : "Rate created" }); onOpenChange(false); }, onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Could not save rate", description: getApiErrorMessage(e) }) };

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{rate ? "Edit rate" : "New rate"}</DialogTitle><DialogDescription>To change a price that was already used, end-date it and create a new rate.</DialogDescription></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>Kind</Label>
                        <Select value={kind} onValueChange={(v) => setKind(v as TimeRateKind)} disabled={!!rate}><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger><SelectContent>{RateKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-1.5"><Label>Applies to</Label>
                        <Select value={scope} onValueChange={(v) => setScope(v as BillingRateScope)} disabled={!!rate}><SelectTrigger aria-label="Applies to"><SelectValue /></SelectTrigger><SelectContent>{RateScopeFormOptions.filter((o) => o.id !== "PRODUCT").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    {needsProject && <div className="space-y-1.5 sm:col-span-2"><Label>Project</Label><ProjectSelect value={projectId} onChange={setProjectId} allowNone={false} /></div>}
                    {needsMember && (
                        <div className="space-y-1.5 sm:col-span-2"><Label>Member</Label>
                            <Select value={memberId} onValueChange={setMemberId} disabled={!!rate}><SelectTrigger aria-label="Member"><SelectValue placeholder="Pick a member" /></SelectTrigger><SelectContent>{members.data?.map((m) => <SelectItem key={m.id} value={m.id}>{personName(m.user)}</SelectItem>)}</SelectContent></Select>
                        </div>
                    )}
                    {!rate && <div className="space-y-1.5 sm:col-span-2"><Label>Activity (optional)</Label><ActivitySelect value={activityId} onChange={setActivityId} /></div>}
                    <div className="space-y-1.5"><Label htmlFor="rate-amount">Hourly rate</Label><Input id="rate-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="rate-cur">Currency</Label><Input id="rate-cur" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></div>
                    <div className="space-y-1.5"><Label htmlFor="rate-from">Valid from</Label><Input id="rate-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="rate-to">Valid to</Label><Input id="rate-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="rate-name">Name (optional)</Label><Input id="rate-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Senior developer rate" /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!valid} loading={pending} onClick={() => {
                        if (rate) update.mutate({ id: rate.id, name: name || undefined, hourly_rate: Number(amount), currency, effective_from: from, effective_to: to || null }, opts);
                        else create.mutate({ kind, scope, project_id: projectId ?? undefined, membership_id: memberId || undefined, activity_type_id: activityId ?? undefined, name: name || undefined, currency, hourly_rate: Number(amount), effective_from: from, effective_to: to || null }, opts);
                    }}>{rate ? "Save" : "Create rate"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
