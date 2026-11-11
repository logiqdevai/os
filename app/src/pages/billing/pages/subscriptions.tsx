import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Repeat } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useCreateSubscription, useProducts, useSubscriptions } from "@/features/billing/hooks/use-billing";
import type { Subscription } from "@/features/billing/interfaces/billing.interfaces";
import { subscriptionFormSchema, type SubscriptionFormValues } from "@/features/billing/validation-schemas/billing.schema";
import { BillingIntervalOptions, SubscriptionStatusFilterOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatMoney } from "@/lib/format";
import { SubscriptionStatusBadge } from "../components/billing-badges";
import { BillingProfilePicker } from "../components/billing-pickers";

const CUSTOM = "__custom";

/**
 * /billing/subscriptions — recurring billing; the daily job invoices each period.
 * @perm VIEW finance.subscriptions.read · create finance.subscriptions.manage
 * @api GET /finance/subscriptions · POST /finance/subscriptions
 */
export default function SubscriptionsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const subs = useSubscriptions(params);
    const [creating, setCreating] = useState(false);
    const cur = subs.data?.data[0]?.currency ?? "EUR";
    const columns: DataTableColumn<Subscription>[] = [
        { key: "customer", header: "Customer", cell: (s) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{s.company?.name}</div><div className="truncate text-xs text-muted-foreground">{s.items.map((i) => i.product?.name ?? i.description).filter(Boolean).join(", ")}</div></div> },
        { key: "status", header: "Status", cell: (s) => <SubscriptionStatusBadge status={s.status} /> },
        { key: "billing", header: "Billing", cell: (s) => `${s.interval_count > 1 ? `Every ${s.interval_count} × ` : ""}${getDropdownOptionLabel(BillingIntervalOptions, s.interval)}`, hideBelow: "md" },
        { key: "next", header: "Current period ends", cell: (s) => (s.cancel_at ? <span className="text-warning">Ends {formatDate(s.cancel_at)}</span> : formatDate(s.current_period_end)), hideBelow: "lg" },
        { key: "amount", header: "Per period", cell: (s) => <span className="tabular font-medium text-foreground">{formatMoney(s.period_amount, s.currency)}</span>, className: "text-right", headerClassName: "text-right" },
    ];
    return (
        <Page>
            <PageHeader title="Subscriptions" description="Recurring plans. Invoices are created and finalized automatically at the start of each period." actions={<Can permission="finance.subscriptions.manage"><Button onClick={() => setCreating(true)}><Plus /> New subscription</Button></Can>} />
            {subs.data && (
                <StatGrid className="mb-4 lg:grid-cols-3">
                    <StatCard label="MRR" value={formatMoney(subs.data.mrr, cur)} tone="success" />
                    <StatCard label="ARR" value={formatMoney(subs.data.arr, cur)} />
                    <StatCard label="Active subscriptions" value={subs.data.active} />
                </StatGrid>
            )}
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search customer or plan…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{SubscriptionStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={subs.data?.data} rowKey={(s) => s.id} loading={subs.isFetching} error={subs.error} onRetry={() => subs.refetch()} pagination={subs.data?.pagination} onPageChange={setPage} rowHref={(s) => `/billing/subscriptions/${s.id}`}
                empty={{ icon: Repeat, title: "No subscriptions", description: "Maintenance plans, retainers and hosting billed every period." }} />
            <CreateSubscriptionDialog open={creating} onOpenChange={setCreating} />
        </Page>
    );
}

function CreateSubscriptionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateSubscription();
    const products = useProducts({ limit: 200, active: true }, usePermission("finance.catalog.read") && open);
    const form = useForm<SubscriptionFormValues>({ resolver: zodResolver(subscriptionFormSchema), defaultValues: { billing_profile_id: "", price_id: CUSTOM, description: "", unit_amount: "", quantity: "1", interval: "MONTH", start_date: new Date().toISOString().slice(0, 10), trial_days: "" } });
    useEffect(() => { if (open) form.reset(); }, [open, form]);
    const priceId = useWatch({ control: form.control, name: "price_id" });
    const recurring = (products.data?.data ?? []).flatMap((p) => p.prices.filter((x) => x.type === "RECURRING").map((x) => ({ ...x, product: p.name })));
    const submit = form.handleSubmit((v) => {
        const custom = !v.price_id || v.price_id === CUSTOM;
        create.mutate(
            {
                billing_profile_id: v.billing_profile_id, start_date: v.start_date || undefined, trial_days: v.trial_days ? Number(v.trial_days) : undefined, interval: custom ? v.interval : undefined,
                items: [custom ? { description: v.description || "Subscription", unit_amount: v.unit_amount, quantity: v.quantity } : { price_id: v.price_id, quantity: v.quantity }],
            },
            { onSuccess: () => onOpenChange(false) },
        );
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>New subscription</DialogTitle><DialogDescription>The first invoice is created now (or when the trial ends).</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="billing_profile_id" render={({ field }) => (<FormItem><FormLabel>Customer</FormLabel><BillingProfilePicker value={field.value} onChange={(v) => field.onChange(v ?? "")} /><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="price_id" render={({ field }) => (
                            <FormItem><FormLabel>Plan</FormLabel>
                                <Select value={field.value ?? CUSTOM} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Plan"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value={CUSTOM}>Custom amount</SelectItem>
                                        {recurring.map((r) => <SelectItem key={r.id} value={r.id}>{r.product} · {formatMoney(r.unit_amount, r.currency)} / {getDropdownOptionLabel(BillingIntervalOptions, r.interval ?? "MONTH").toLowerCase()}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        {(!priceId || priceId === CUSTOM) && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <FormField control={form.control} name="description" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Description</FormLabel><FormControl><Input placeholder="Website maintenance" {...field} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="unit_amount" render={({ field }) => (<FormItem><FormLabel>Amount per period</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="interval" render={({ field }) => (
                                    <FormItem><FormLabel>Billing</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Billing interval"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{BillingIntervalOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                    </FormItem>
                                )} />
                            </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-3">
                            <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantity</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="start_date" render={({ field }) => (<FormItem><FormLabel>Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="trial_days" render={({ field }) => (<FormItem><FormLabel>Trial days</FormLabel><FormControl><Input inputMode="numeric" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Create subscription</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
