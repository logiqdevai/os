import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import { useReplaceLineItems } from "@/features/crm/deals/hooks/use-deals";
import { lineItemsSchema, type LineItemsValues } from "@/features/crm/deals/validation-schemas/deals.schema";
import type { DealDetail } from "@/features/crm/deals/interfaces/deals.interfaces";
import { Money } from "../../../components/crm-ui";

const num = (v: string | undefined) => (v ? Number(v) : 0);

/**
 * Deal line items (mockup `deal-products`, 02 §10). Totals are computed by the API.
 * @perm view crm.financials.read · edit crm.deals.update + crm.financials.read · discount above policy crm.deals.approve_discount
 * @api PUT /crm/deals/:id/line-items
 */
export function DealLineItems({ deal }: { deal: DealDetail }) {
    const p = usePermissions();
    const canEdit = p.can("crm.deals.update") && p.can("crm.financials.read");
    const save = useReplaceLineItems();
    const [editing, setEditing] = useState(false);
    const form = useForm<LineItemsValues>({ resolver: zodResolver(lineItemsSchema), defaultValues: { items: [], discount_percent: "" } });
    const items = useFieldArray({ control: form.control, name: "items" });

    useEffect(() => {
        if (!editing) return;
        form.reset({
            discount_percent: Number(deal.discount_percent ?? 0) ? String(Number(deal.discount_percent)) : "",
            items: deal.line_items.map((li) => ({
                name: li.name,
                quantity: String(Number(li.quantity)),
                unit_price: String(Number(li.unit_price)),
                discount_percent: li.discount_percent ? String(Number(li.discount_percent)) : "",
                tax_percent: li.tax_percent ? String(Number(li.tax_percent)) : "",
                is_recurring: li.is_recurring,
                billing_frequency: li.billing_frequency ?? undefined,
            })),
        });
    }, [editing, deal, form]);

    if (deal.financials_hidden) return <EmptyState compact title="Amounts are hidden" description="You need the CRM financials permission to see line items." />;

    const submit = form.handleSubmit((v) =>
        save.mutate({
            id: deal.id,
            discount_percent: num(v.discount_percent),
            items: v.items.map((i) => ({ name: i.name, quantity: num(i.quantity), unit_price: num(i.unit_price), discount_percent: i.discount_percent ? num(i.discount_percent) : undefined, tax_percent: i.tax_percent ? num(i.tax_percent) : undefined, is_recurring: i.is_recurring, billing_frequency: i.is_recurring ? i.billing_frequency ?? "monthly" : undefined })),
        }, {
            onSuccess: () => { toast({ title: "Line items saved" }); setEditing(false); },
            onError: (e) => toast({ variant: "destructive", title: "Could not save line items", description: getApiErrorMessage(e) }),
        }),
    );

    if (editing) {
        const preview = form.watch("items").reduce((n, i) => n + num(i.quantity) * num(i.unit_price) * (1 - num(i.discount_percent) / 100), 0) * (1 - num(form.watch("discount_percent")) / 100);
        return (
            <Form {...form}>
                <form onSubmit={submit} className="space-y-3">
                    {items.fields.map((f, i) => (
                        <div key={f.id} className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_5rem_7rem_5rem_5rem_auto]">
                            <FormField control={form.control} name={`items.${i}.name`} render={({ field }) => (
                                <FormItem className="col-span-2 sm:col-span-1"><FormLabel className="text-xs">Item</FormLabel><FormControl><Input placeholder="Design sprint" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name={`items.${i}.quantity`} render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Qty</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name={`items.${i}.unit_price`} render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Unit price</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name={`items.${i}.discount_percent`} render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Disc. %</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name={`items.${i}.tax_percent`} render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Tax %</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-1">
                                <FormField control={form.control} name={`items.${i}.is_recurring`} render={({ field }) => (
                                    <label className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground"><Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(!!c)} /> Monthly</label>
                                )} />
                                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove item" onClick={() => items.remove(i)}><Trash2 /></Button>
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => items.append({ name: "", quantity: "1", unit_price: "0", discount_percent: "", tax_percent: "", is_recurring: false })}><Plus /> Add item</Button>
                    <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
                        <FormField control={form.control} name="discount_percent" render={({ field }) => (
                            <FormItem className="sm:w-40"><FormLabel className="text-xs">Order discount %</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="text-[13px] text-muted-foreground">Net total ≈ <Money value={preview} currency={deal.currency} className="font-medium text-foreground" /></div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={save.isPending}>Cancel</Button>
                        <Button type="submit" loading={save.isPending}>Save line items</Button>
                    </div>
                </form>
            </Form>
        );
    }

    return (
        <div className="space-y-3">
            {!deal.line_items.length ? (
                <EmptyState compact icon={Package} title="No line items" description="Add services and products; the deal value is then calculated from them." action={canEdit ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Plus /> Add line items</Button> : undefined} />
            ) : (
                <>
                    <div className="overflow-x-auto rounded-md border border-border">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-xs">Item</TableHead>
                                    <TableHead className="text-right text-xs">Qty</TableHead>
                                    <TableHead className="hidden text-right text-xs sm:table-cell">Unit</TableHead>
                                    <TableHead className="text-right text-xs">Net</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {deal.line_items.map((li) => (
                                    <TableRow key={li.id}>
                                        <TableCell className="text-[13px]">{li.name}{li.is_recurring && <span className="ml-1 text-xs text-muted-foreground">/ {li.billing_frequency ?? "month"}</span>}</TableCell>
                                        <TableCell className="text-right text-[13px] tabular">{formatNumber(li.quantity, 3)}</TableCell>
                                        <TableCell className="hidden text-right text-[13px] sm:table-cell"><Money value={li.unit_price} currency={deal.currency} /></TableCell>
                                        <TableCell className="text-right text-[13px]"><Money value={li.net_amount} currency={deal.currency} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <dl className="ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-[13px]">
                        <dt className="text-muted-foreground">One-time</dt><dd className="text-right"><Money value={deal.one_time_value} currency={deal.currency} /></dd>
                        <dt className="text-muted-foreground">Recurring</dt><dd className="text-right"><Money value={deal.recurring_value} currency={deal.currency} /></dd>
                        <dt className="text-muted-foreground">Discount</dt><dd className="text-right"><Money value={deal.discount_amount} currency={deal.currency} /></dd>
                        <dt className="text-muted-foreground">Tax</dt><dd className="text-right"><Money value={deal.tax_amount} currency={deal.currency} /></dd>
                        <dt className="font-medium text-foreground">Deal value</dt><dd className="text-right font-medium"><Money value={deal.value} currency={deal.currency} /></dd>
                    </dl>
                    {canEdit && <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit line items</Button></div>}
                </>
            )}
        </div>
    );
}
