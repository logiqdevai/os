import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontal, Pencil, Percent, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { useCreateTaxRate, useTaxRates, useUpdateTaxRate } from "@/features/billing/hooks/use-billing";
import type { TaxRate } from "@/features/billing/interfaces/billing.interfaces";
import { taxRateFormSchema, type TaxRateFormValues } from "@/features/billing/validation-schemas/billing.schema";
import { TaxBehaviorOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";

/**
 * /billing/tax — tax rates (VAT) used by invoices and the ledger.
 * @perm VIEW finance.catalog.read · manage finance.catalog.manage
 * @api GET/POST/PATCH /finance/tax-rates
 */
export default function TaxRatesPage() {
    const rates = useTaxRates({ include_inactive: true });
    const canManage = usePermission("finance.catalog.manage");
    const update = useUpdateTaxRate();
    const [editing, setEditing] = useState<TaxRate | null>(null);
    const [open, setOpen] = useState(false);
    const columns: DataTableColumn<TaxRate>[] = [
        { key: "name", header: "Rate", cell: (r) => <div className="flex items-center gap-2"><span className="font-medium text-foreground">{r.name}</span>{r.is_default && <Badge variant="info">Default</Badge>}{r.is_reverse_charge && <Badge variant="violet">Reverse charge</Badge>}</div> },
        { key: "pct", header: "%", cell: (r) => <span className="tabular">{Number(r.percentage)}%</span> },
        { key: "behavior", header: "Pricing", cell: (r) => getDropdownOptionLabel(TaxBehaviorOptions, r.behavior), hideBelow: "md" },
        { key: "country", header: "Country", cell: (r) => r.country ?? "—", hideBelow: "lg" },
        { key: "used", header: "Used on lines", cell: (r) => r._count?.line_items ?? 0, hideBelow: "lg", className: "tabular" },
        { key: "status", header: "Status", cell: (r) => <Badge variant={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</Badge>, hideBelow: "sm" },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10",
            cell: (r) => canManage && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setEditing(r); setOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => update.mutate({ id: r.id, is_active: !r.is_active })}>{r.is_active ? "Deactivate" : "Activate"}</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
    return (
        <Page>
            <PageHeader title="Tax rates" description="VAT and other taxes. A rate used on invoices cannot change its percentage; add a new one." actions={<Can permission="finance.catalog.manage"><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New tax rate</Button></Can>} />
            <DataTable columns={columns} data={rates.data} rowKey={(r) => r.id} loading={rates.isFetching} error={rates.error} onRetry={() => rates.refetch()} empty={{ icon: Percent, title: "No tax rates", description: "Add your standard VAT rate first." }} />
            <TaxRateDialog open={open} onOpenChange={setOpen} rate={editing} />
        </Page>
    );
}

function TaxRateDialog({ open, onOpenChange, rate }: { open: boolean; onOpenChange: (o: boolean) => void; rate: TaxRate | null }) {
    const create = useCreateTaxRate();
    const update = useUpdateTaxRate();
    const form = useForm<TaxRateFormValues>({ resolver: zodResolver(taxRateFormSchema), defaultValues: { name: "", percentage: "24", country: "", behavior: "EXCLUSIVE", is_default: false, is_reverse_charge: false, invoice_note: "" } });
    useEffect(() => {
        if (open) form.reset({ name: rate?.name ?? "", percentage: rate ? String(Number(rate.percentage)) : "24", country: rate?.country ?? "", behavior: rate?.behavior ?? "EXCLUSIVE", is_default: rate?.is_default ?? false, is_reverse_charge: rate?.is_reverse_charge ?? false, invoice_note: rate?.invoice_note ?? "" });
    }, [open, rate, form]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { ...v, country: v.country ? v.country.toUpperCase() : null, invoice_note: v.invoice_note || null };
        if (rate) update.mutate({ id: rate.id, ...dto }, { onSuccess: () => onOpenChange(false) });
        else create.mutate(dto, { onSuccess: () => onOpenChange(false) });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>{rate ? "Edit tax rate" : "New tax rate"}</DialogTitle><DialogDescription>Reverse-charge rates are always 0%.</DialogDescription></DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Name</FormLabel><FormControl><Input placeholder="VAT 24%" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="percentage" render={({ field }) => (<FormItem><FormLabel>Percentage</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="country" render={({ field }) => (<FormItem><FormLabel>Country</FormLabel><FormControl><Input maxLength={2} placeholder="GR" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="behavior" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Pricing</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Pricing"><SelectValue /></SelectTrigger></FormControl><SelectContent>{TaxBehaviorOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="invoice_note" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Note printed on invoices</FormLabel><FormControl><Input placeholder="Reverse charge — Art. 196 VAT Directive" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="is_default" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-md border border-border p-3"><FormLabel>Default</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="is_reverse_charge" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-md border border-border p-3"><FormLabel>Reverse charge</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        </div>
                        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button><Button type="submit" loading={pending}>{rate ? "Save" : "Create rate"}</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
