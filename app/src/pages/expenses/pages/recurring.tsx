import { useEffect, useState } from "react";
import { CurrencySelect } from "@/components/ui/currency-select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontal, Pause, Play, Plus, Repeat, Square, Zap } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useCreateRecurring, usePaymentMethods, useRecurring, useRecurringAction, useUpdateRecurring } from "@/features/expenses/hooks/use-expenses";
import type { RecurringExpense } from "@/features/expenses/interfaces/expenses.interfaces";
import { recurringFormSchema, type RecurringFormValues } from "@/features/expenses/validation-schemas/expenses.schema";
import { IntervalOptions, RecurringStatusFilterOptions } from "@/config/constants/dropdowns/expenses/expenses.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatMoney } from "@/lib/format";
import { CategoryPicker, CompanyPicker, RecurringStatusBadge } from "../components/ledger-ui";
import { todayIso } from "../utils/ranges";

const NONE = "__none";

/**
 * /expenses/recurring — recurring expense templates; a daily job generates the records.
 * @perm VIEW finance.recurring_expenses.read · manage finance.recurring_expenses.manage · generate now also finance.expenses.create
 * @api GET/POST/PATCH /ledger/recurring · POST /ledger/recurring/:id/{pause|resume|end|generate-now}
 */
export default function RecurringPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const list = useRecurring(params);
    const p = usePermissions();
    const act = useRecurringAction();
    const [editing, setEditing] = useState<RecurringExpense | null>(null);
    const [open, setOpen] = useState(false);
    const manage = p.can("finance.recurring_expenses.manage");
    const cur = list.data?.data[0]?.currency ?? "EUR";
    const columns: DataTableColumn<RecurringExpense>[] = [
        { key: "name", header: "Expense", cell: (r) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{r.name}</div><div className="truncate text-xs text-muted-foreground">{[r.company?.name, r.category?.name].filter(Boolean).join(" · ")}</div></div> },
        { key: "every", header: "Every", cell: (r) => `${r.interval_count > 1 ? `${r.interval_count} × ` : ""}${getDropdownOptionLabel(IntervalOptions, r.interval)}`, hideBelow: "md" },
        { key: "next", header: "Next", cell: (r) => formatDate(r.next_occurrence_date), hideBelow: "sm" },
        { key: "status", header: "Status", cell: (r) => <RecurringStatusBadge status={r.status} /> },
        { key: "amount", header: "Gross", cell: (r) => <span className="tabular font-medium">{formatMoney(r.expected_gross_amount, r.currency)}</span>, className: "text-right", headerClassName: "text-right" },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10",
            cell: (r) => manage && r.status !== "ENDED" && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setEditing(r); setOpen(true); }}>Edit</DropdownMenuItem>
                        {r.status === "ACTIVE" && p.can("finance.expenses.create") && <DropdownMenuItem onSelect={() => act.mutate({ id: r.id, action: "generate-now" })}><Zap /> Create next record now</DropdownMenuItem>}
                        {r.status === "ACTIVE" && <DropdownMenuItem onSelect={() => act.mutate({ id: r.id, action: "pause" })}><Pause /> Pause</DropdownMenuItem>}
                        {r.status === "PAUSED" && <DropdownMenuItem onSelect={() => act.mutate({ id: r.id, action: "resume" })}><Play /> Resume</DropdownMenuItem>}
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => act.mutate({ id: r.id, action: "end" })}><Square /> End</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
    return (
        <Page>
            <PageHeader title="Recurring expenses" description={list.data ? `About ${formatMoney(list.data.monthly_total, cur)} per month across active templates.` : "Rent, software, hosting and other repeating costs."} actions={<Can permission="finance.recurring_expenses.manage"><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New recurring expense</Button></Can>} />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name or supplier…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{RecurringStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={list.data?.data} rowKey={(r) => r.id} loading={list.isFetching} error={list.error} onRetry={() => list.refetch()} pagination={list.data?.pagination} onPageChange={setPage}
                rowHref={(r) => `/expenses/ledger?recurring_expense_id=${r.id}`} empty={{ icon: Repeat, title: "No recurring expenses", description: "Set up rent, subscriptions and hosting once; records are created on schedule." }} />
            <RecurringDialog open={open} onOpenChange={setOpen} item={editing} />
        </Page>
    );
}

function RecurringDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: RecurringExpense | null }) {
    const session = useSessionData();
    const create = useCreateRecurring();
    const update = useUpdateRecurring();
    const methods = usePaymentMethods(open);
    const form = useForm<RecurringFormValues>({ resolver: zodResolver(recurringFormSchema) });
    useEffect(() => {
        if (!open) return;
        form.reset({
            name: item?.name ?? "", category_id: item?.category_id ?? undefined, company_id: item?.company_id ?? null, payment_method_id: item?.payment_method_id ?? NONE,
            expected_net_amount: item ? String(item.expected_net_amount) : "", vat_percent: item ? String(Number(item.vat_percent)) : "24", currency: item?.currency ?? session?.active_organization?.default_currency ?? "EUR",
            interval: item?.interval ?? "MONTH", interval_count: String(item?.interval_count ?? 1), start_date: item?.start_date.slice(0, 10) ?? todayIso(), end_date: item?.end_date?.slice(0, 10) ?? "",
            due_days: item?.due_days != null ? String(item.due_days) : "", auto_generate: item?.auto_generate ?? true,
        });
    }, [open, item, form, session?.active_organization?.default_currency]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = {
            name: v.name, category_id: v.category_id || null, company_id: v.company_id || null, payment_method_id: v.payment_method_id && v.payment_method_id !== NONE ? v.payment_method_id : null,
            expected_net_amount: v.expected_net_amount, vat_percent: v.vat_percent || "0", currency: v.currency.toUpperCase(), interval: v.interval, interval_count: Number(v.interval_count),
            start_date: v.start_date, end_date: v.end_date || null, due_days: v.due_days ? Number(v.due_days) : null, auto_generate: v.auto_generate,
        };
        if (item) update.mutate({ id: item.id, ...dto }, { onSuccess: () => onOpenChange(false) });
        else create.mutate(dto, { onSuccess: () => onOpenChange(false) });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>{item ? "Edit recurring expense" : "New recurring expense"}</DialogTitle><DialogDescription>{item ? "Changes apply to future records only." : "The first record is created on the start date."}</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Office rent" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField control={form.control} name="company_id" render={({ field }) => (<FormItem><FormLabel>Supplier</FormLabel><CompanyPicker value={field.value} onChange={field.onChange} placeholder="No supplier" /></FormItem>)} />
                            <FormField control={form.control} name="category_id" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><CategoryPicker kind="EXPENSE" value={field.value} onChange={(v) => field.onChange(v ?? undefined)} /></FormItem>)} />
                            <FormField control={form.control} name="expected_net_amount" render={({ field }) => (<FormItem><FormLabel>Net amount</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="vat_percent" render={({ field }) => (<FormItem><FormLabel>VAT %</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="interval" render={({ field }) => (<FormItem><FormLabel>Repeats</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Repeats"><SelectValue /></SelectTrigger></FormControl><SelectContent>{IntervalOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="interval_count" render={({ field }) => (<FormItem><FormLabel>Every</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="start_date" render={({ field }) => (<FormItem><FormLabel>Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="end_date" render={({ field }) => (<FormItem><FormLabel>End (optional)</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="due_days" render={({ field }) => (<FormItem><FormLabel>Due after (days)</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><FormControl><CurrencySelect value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="payment_method_id" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Paid from</FormLabel><Select value={field.value ?? NONE} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Paid from"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={NONE}>Not set</SelectItem>{methods.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="auto_generate" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-md border border-border p-3 sm:col-span-2"><FormLabel>Create records automatically</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        </div>
                        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button><Button type="submit" loading={pending}>{item ? "Save" : "Create"}</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
