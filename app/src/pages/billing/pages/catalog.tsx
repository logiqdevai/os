import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, MoreHorizontal, Package, Pencil, Plus, Ticket } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useAddPrice, useArchiveProduct, useCouponAction, useCoupons, useCreateCoupon, useCreateProduct, useProducts, useTaxRates, useUpdateProduct } from "@/features/billing/hooks/use-billing";
import type { Coupon, Product, TaxRate } from "@/features/billing/interfaces/billing.interfaces";
import { couponFormSchema, productFormSchema, type CouponFormValues, type ProductFormValues } from "@/features/billing/validation-schemas/billing.schema";
import { BillingIntervalOptions, DiscountTypeOptions, ProductTypeFilterOptions, ProductTypeOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatMoney } from "@/lib/format";

const NONE = "__none";
const ONE_TIME = "__once";
const NO_RATES: TaxRate[] = [];

/**
 * /billing/catalog — products & services with prices, and coupons (the platform catalog used by deals, proposals and invoices).
 * @perm VIEW finance.catalog.read · manage finance.catalog.manage
 * @api GET/POST/PATCH /finance/products · POST /finance/products/:id/prices · GET/POST /finance/coupons
 */
export default function CatalogPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const products = useProducts(params);
    const coupons = useCoupons({ include_inactive: true });
    const canManage = usePermission("finance.catalog.manage");
    const archive = useArchiveProduct();
    const couponAction = useCouponAction();
    const [editing, setEditing] = useState<Product | null>(null);
    const [productOpen, setProductOpen] = useState(false);
    const [archiving, setArchiving] = useState<Product | null>(null);
    const [couponOpen, setCouponOpen] = useState(false);

    const columns: DataTableColumn<Product>[] = [
        { key: "name", header: "Product", cell: (p) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{p.name}</div>{p.description && <div className="truncate text-xs text-muted-foreground">{p.description}</div>}</div> },
        { key: "type", header: "Type", cell: (p) => <Badge>{getDropdownOptionLabel(ProductTypeOptions, p.type)}</Badge>, hideBelow: "md" },
        { key: "prices", header: "Prices", cell: (p) => (p.prices.length ? p.prices.map((x) => `${formatMoney(x.unit_amount, x.currency)}${x.interval ? ` / ${getDropdownOptionLabel(BillingIntervalOptions, x.interval).toLowerCase()}` : ""}${p.unit && !x.interval ? ` / ${p.unit}` : ""}`).join(" · ") : <span className="text-muted-foreground">No price</span>) },
        { key: "tax", header: "Default tax", cell: (p) => p.default_tax_rate?.name ?? "—", hideBelow: "lg" },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10",
            cell: (p) => canManage && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setEditing(p); setProductOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(p)}><Archive /> Archive</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
    const couponColumns: DataTableColumn<Coupon>[] = [
        { key: "name", header: "Coupon", cell: (c) => <div><div className="font-medium text-foreground">{c.name}</div>{c.code && <code className="text-xs">{c.code}</code>}</div> },
        { key: "value", header: "Discount", cell: (c) => (c.type === "PERCENTAGE" ? `${Number(c.value)}%` : formatMoney(c.value, c.currency ?? "EUR")) },
        { key: "used", header: "Used", cell: (c) => `${c.redemptions}${c.max_redemptions ? ` / ${c.max_redemptions}` : ""}`, hideBelow: "sm" },
        { key: "status", header: "Status", cell: (c) => <Badge variant={c.is_active ? "success" : "neutral"}>{c.is_active ? "Active" : "Inactive"}</Badge> },
        { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-28 text-right", cell: (c) => canManage && <Button size="sm" variant="ghost" onClick={() => couponAction.mutate({ id: c.id, action: c.is_active ? "deactivate" : "activate" })}>{c.is_active ? "Deactivate" : "Activate"}</Button> },
    ];

    return (
        <Page>
            <PageHeader title="Products & prices" description="The catalog used by deals, proposals, invoices and subscriptions." />
            <Tabs defaultValue="products">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <TabsList><TabsTrigger value="products">Products</TabsTrigger><TabsTrigger value="coupons">Coupons</TabsTrigger></TabsList>
                    <Can permission="finance.catalog.manage">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setCouponOpen(true)}><Ticket /> New coupon</Button>
                            <Button onClick={() => { setEditing(null); setProductOpen(true); }}><Plus /> New product</Button>
                        </div>
                    </Can>
                </div>
                <TabsContent value="products">
                    <TableToolbar search={search} onSearch={setSearch} placeholder="Search products…">
                        <Select value={filters.type ?? "all"} onValueChange={(v) => setFilter("type", v)}>
                            <SelectTrigger className="h-8 w-44" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                            <SelectContent>{ProductTypeFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </TableToolbar>
                    <DataTable columns={columns} data={products.data?.data} rowKey={(p) => p.id} loading={products.isFetching} error={products.error} onRetry={() => products.refetch()} pagination={products.data?.pagination} onPageChange={setPage}
                        empty={{ icon: Package, title: search ? "No products match" : "No products yet", description: "Add services, packages and plans with their prices." }} />
                </TabsContent>
                <TabsContent value="coupons">
                    <DataTable columns={couponColumns} data={coupons.data} rowKey={(c) => c.id} loading={coupons.isFetching} error={coupons.error} onRetry={() => coupons.refetch()} empty={{ icon: Ticket, title: "No coupons", description: "Percentage or fixed discounts for invoices and subscriptions." }} />
                </TabsContent>
            </Tabs>
            <ProductDialog open={productOpen} onOpenChange={setProductOpen} product={editing} />
            <CouponDialog open={couponOpen} onOpenChange={setCouponOpen} />
            <ConfirmationDialog isOpen={!!archiving} onClose={() => setArchiving(null)} title={`Archive ${archiving?.name}?`} description="It disappears from pickers. Existing invoices keep their lines." confirmText="Archive" variant="destructive" onConfirm={() => { if (archiving) archive.mutate(archiving.id); setArchiving(null); }} />
        </Page>
    );
}

function ProductDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (o: boolean) => void; product: Product | null }) {
    const session = useSessionData();
    const rates = useTaxRates(undefined, open).data ?? NO_RATES;
    const create = useCreateProduct();
    const update = useUpdateProduct();
    const addPrice = useAddPrice();
    const currency = session?.active_organization?.default_currency ?? "EUR";
    const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: { name: "", type: "SERVICE", description: "", unit: "", default_tax_rate_id: NONE, price_amount: "", price_currency: currency, price_interval: ONE_TIME } });
    useEffect(() => {
        if (open) form.reset({ name: product?.name ?? "", type: product?.type ?? "SERVICE", description: product?.description ?? "", unit: product?.unit ?? "", default_tax_rate_id: product?.default_tax_rate_id ?? rates.find((r) => r.is_default)?.id ?? NONE, price_amount: "", price_currency: currency, price_interval: ONE_TIME });
    }, [open, product, form, currency, rates]);
    const pending = create.isPending || update.isPending || addPrice.isPending;
    const submit = form.handleSubmit((v) => {
        const price = v.price_amount ? { currency: v.price_currency.toUpperCase(), unit_amount: v.price_amount, ...(v.price_interval && v.price_interval !== ONE_TIME ? { type: "RECURRING", interval: v.price_interval } : { type: "ONE_TIME" }) } : null;
        const base = { name: v.name, type: v.type, description: v.description || null, unit: v.unit || null, default_tax_rate_id: v.default_tax_rate_id && v.default_tax_rate_id !== NONE ? v.default_tax_rate_id : null };
        if (product) {
            update.mutate({ id: product.id, ...base }, { onSuccess: () => (price ? addPrice.mutate({ productId: product.id, ...price }, { onSuccess: () => onOpenChange(false) }) : onOpenChange(false)) });
        } else create.mutate({ ...base, prices: price ? [price] : [] }, { onSuccess: () => onOpenChange(false) });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle><DialogDescription>{product ? "Prices already used on invoices are kept; a changed amount becomes a new price." : "A service, package or plan with an optional first price."}</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl><SelectContent>{ProductTypeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit</FormLabel><FormControl><Input placeholder="hour, month, project" {...field} /></FormControl></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="default_tax_rate_id" render={({ field }) => (<FormItem><FormLabel>Default tax</FormLabel><Select value={field.value ?? NONE} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Default tax"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={NONE}>No tax</SelectItem>{rates.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({Number(r.percentage)}%)</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                        <div className="rounded-md border border-border p-3">
                            <div className="mb-2 text-xs font-medium text-muted-foreground">{product ? "Add a price (optional)" : "Price (optional)"}</div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <FormField control={form.control} name="price_amount" render={({ field }) => (<FormItem><FormLabel className="text-xs">Amount</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="price_currency" render={({ field }) => (<FormItem><FormLabel className="text-xs">Currency</FormLabel><FormControl><Input maxLength={3} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="price_interval" render={({ field }) => (<FormItem><FormLabel className="text-xs">Billing</FormLabel><Select value={field.value ?? ONE_TIME} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Billing"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={ONE_TIME}>One-time</SelectItem>{BillingIntervalOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            </div>
                        </div>
                        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button><Button type="submit" loading={pending}>{product ? "Save" : "Create product"}</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function CouponDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const session = useSessionData();
    const create = useCreateCoupon();
    const form = useForm<CouponFormValues>({ resolver: zodResolver(couponFormSchema), defaultValues: { name: "", code: "", type: "PERCENTAGE", value: "", currency: session?.active_organization?.default_currency ?? "EUR", max_redemptions: "" } });
    useEffect(() => { if (open) form.reset(); }, [open, form]);
    const submit = form.handleSubmit((v) => create.mutate({ name: v.name, code: v.code || null, type: v.type, value: v.value, currency: v.type === "FIXED" ? v.currency : null, max_redemptions: v.max_redemptions ? Number(v.max_redemptions) : null }, { onSuccess: () => onOpenChange(false) }));
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>New coupon</DialogTitle><DialogDescription>Apply it on invoices or subscriptions.</DialogDescription></DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>Code</FormLabel><FormControl><Input placeholder="LAUNCH10" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl><SelectContent>{DiscountTypeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="value" render={({ field }) => (<FormItem><FormLabel>Value</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency (fixed)</FormLabel><FormControl><Input maxLength={3} {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="max_redemptions" render={({ field }) => (<FormItem><FormLabel>Max uses</FormLabel><FormControl><Input inputMode="numeric" placeholder="Unlimited" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button><Button type="submit" loading={create.isPending}>Create coupon</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
