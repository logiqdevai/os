import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { useTaxRates } from "@/features/billing/hooks/use-billing";
import {
    useArchivePaymentMethod, useCategories, useCategoryAction, useCreateCategory, useCreatePaymentMethod, useLedgerSettings, usePaymentMethods, useUpdateCategory, useUpdateLedgerSettings,
} from "@/features/expenses/hooks/use-expenses";
import type { LedgerCategory } from "@/features/expenses/interfaces/expenses.interfaces";
import { categoryFormSchema, paymentMethodFormSchema, type CategoryFormValues, type PaymentMethodFormValues } from "@/features/expenses/validation-schemas/expenses.schema";
import { LedgerPaymentMethodTypeOptions, PlLineOptions } from "@/config/constants/dropdowns/expenses/expenses.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatMoney } from "@/lib/format";

const NONE = "__none";

/**
 * /expenses/categories — categories & subcategories, payment methods (bank accounts, cash), ledger settings.
 * @perm finance.categories.manage (edit categories and methods) · finance.ledger_settings.manage (settings) · read with finance.*.read
 * @api /ledger/categories · /ledger/payment-methods · /ledger/settings
 */
export default function CategoriesPage() {
    const p = usePermissions();
    const canManage = p.can("finance.categories.manage");
    const cats = useCategories();
    const methods = usePaymentMethods();
    const archive = useCategoryAction();
    const archiveMethod = useArchivePaymentMethod();
    const [editing, setEditing] = useState<LedgerCategory | null>(null);
    const [catOpen, setCatOpen] = useState<null | "INCOME" | "EXPENSE">(null);
    const [methodOpen, setMethodOpen] = useState(false);

    const tree = (kind: "INCOME" | "EXPENSE") => {
        const rows = (cats.data ?? []).filter((c) => c.kind === kind);
        const parents = rows.filter((c) => !c.parent_category_id);
        return (
            <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                {parents.map((c) => (
                    <div key={c.id} className="px-4 py-2.5">
                        <CategoryRow c={c} canManage={canManage} onEdit={() => { setEditing(c); setCatOpen(kind); }} onArchive={() => archive.mutate({ id: c.id, action: "archive" })} />
                        {rows.filter((s) => s.parent_category_id === c.id).map((s) => (
                            <div key={s.id} className="ml-5 border-l border-border pl-3"><CategoryRow c={s} canManage={canManage} onEdit={() => { setEditing(s); setCatOpen(kind); }} onArchive={() => archive.mutate({ id: s.id, action: "archive" })} /></div>
                        ))}
                    </div>
                ))}
                {!parents.length && <EmptyState compact title="No categories" />}
            </div>
        );
    };

    return (
        <Page width="wide">
            <PageHeader title="Categories & settings" description="How income and expenses are classified, paid and reported." />
            <Tabs defaultValue="expense">
                <TabsList className="max-w-full overflow-x-auto">
                    <TabsTrigger value="expense">Expense categories</TabsTrigger>
                    <TabsTrigger value="income">Income categories</TabsTrigger>
                    <TabsTrigger value="methods">Payment methods</TabsTrigger>
                    {p.canAny("finance.ledger_settings.manage") && <TabsTrigger value="settings">Settings</TabsTrigger>}
                </TabsList>
                {(["expense", "income"] as const).map((k) => (
                    <TabsContent key={k} value={k} className="space-y-3">
                        {canManage && <div className="flex justify-end"><Button onClick={() => { setEditing(null); setCatOpen(k === "income" ? "INCOME" : "EXPENSE"); }}><Plus /> New category</Button></div>}
                        {cats.isPending ? <ListSkeleton /> : cats.error ? <ErrorState error={cats.error} onRetry={() => cats.refetch()} /> : tree(k === "income" ? "INCOME" : "EXPENSE")}
                    </TabsContent>
                ))}
                <TabsContent value="methods" className="space-y-3">
                    {canManage && <div className="flex justify-end"><Button onClick={() => setMethodOpen(true)}><Plus /> New payment method</Button></div>}
                    {methods.isPending ? <ListSkeleton /> : methods.error ? <ErrorState error={methods.error} /> : (
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {methods.data?.map((m) => (
                                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]">
                                    <div><div className="flex items-center gap-2 font-medium text-foreground">{m.name}{m.is_default && <Badge variant="info">Default</Badge>}</div><div className="text-xs text-muted-foreground">{getDropdownOptionLabel(LedgerPaymentMethodTypeOptions, m.type)}{m.iban_last4 ? ` · •••• ${m.iban_last4}` : ""}{m.track_balance ? ` · tracks balance from ${formatMoney(m.opening_balance ?? 0, m.currency ?? "EUR")}` : ""}</div></div>
                                    {canManage && <Button size="sm" variant="ghost" onClick={() => archiveMethod.mutate(m.id)}><Archive /> Archive</Button>}
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="settings"><SettingsPanel /></TabsContent>
            </Tabs>
            <CategoryDialog kind={catOpen} onClose={() => setCatOpen(null)} category={editing} parents={(cats.data ?? []).filter((c) => !c.parent_category_id && c.kind === catOpen)} />
            <PaymentMethodDialog open={methodOpen} onOpenChange={setMethodOpen} />
        </Page>
    );
}

function CategoryRow({ c, canManage, onEdit, onArchive }: { c: LedgerCategory; canManage: boolean; onEdit: () => void; onArchive: () => void }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 py-1 text-[13px]">
            <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-foreground">{c.name}</span>
                {c.pl_line && <Badge>{getDropdownOptionLabel(PlLineOptions, c.pl_line)}</Badge>}
                {c.default_tax_rate && <Badge variant="neutral">{c.default_tax_rate.name}</Badge>}
                <span className="text-xs text-muted-foreground">{c._count?.records ?? 0} records</span>
            </div>
            {canManage && <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button><Button size="sm" variant="ghost" onClick={onArchive}>Archive</Button></div>}
        </div>
    );
}

function CategoryDialog({ kind, onClose, category, parents }: { kind: null | "INCOME" | "EXPENSE"; onClose: () => void; category: LedgerCategory | null; parents: LedgerCategory[] }) {
    const create = useCreateCategory();
    const update = useUpdateCategory();
    const rates = useTaxRates(undefined, !!kind).data;
    const form = useForm<CategoryFormValues>({ resolver: zodResolver(categoryFormSchema) });
    useEffect(() => {
        if (kind) form.reset({ kind, name: category?.name ?? "", parent_category_id: category?.parent_category_id ?? NONE, pl_line: category?.pl_line ?? NONE, default_tax_rate_id: category?.default_tax_rate_id ?? NONE, is_operating: category?.is_operating ?? true });
    }, [kind, category, form]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { name: v.name, parent_category_id: v.parent_category_id && v.parent_category_id !== NONE ? v.parent_category_id : null, pl_line: v.pl_line && v.pl_line !== NONE ? v.pl_line : null, default_tax_rate_id: v.default_tax_rate_id && v.default_tax_rate_id !== NONE ? v.default_tax_rate_id : null, is_operating: v.is_operating };
        if (category) update.mutate({ id: category.id, ...dto }, { onSuccess: onClose });
        else create.mutate({ kind: v.kind, ...dto }, { onSuccess: onClose });
    });
    return (
        <Dialog open={!!kind} onOpenChange={(o) => !pending && !o && onClose()}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>{category ? "Edit category" : `New ${kind === "INCOME" ? "income" : "expense"} category`}</DialogTitle><DialogDescription>Subcategories inherit the P&L line of their parent.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="parent_category_id" render={({ field }) => (<FormItem><FormLabel>Parent</FormLabel><Select value={field.value ?? NONE} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Parent"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={NONE}>Top level</SelectItem>{parents.filter((x) => x.id !== category?.id).map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        <FormField control={form.control} name="pl_line" render={({ field }) => (<FormItem><FormLabel>P&L line</FormLabel><Select value={field.value ?? NONE} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="P&L line"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={NONE}>Inherit / other</SelectItem>{PlLineOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        <FormField control={form.control} name="default_tax_rate_id" render={({ field }) => (<FormItem><FormLabel>Default VAT</FormLabel><Select value={field.value ?? NONE} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Default VAT"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value={NONE}>Organization default</SelectItem>{rates?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        <FormField control={form.control} name="is_operating" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-md border border-border p-3"><FormLabel>Counts as operating expense</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        <DialogFooter><Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button><Button type="submit" loading={pending}>{category ? "Save" : "Create"}</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function PaymentMethodDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreatePaymentMethod();
    const form = useForm<PaymentMethodFormValues>({ resolver: zodResolver(paymentMethodFormSchema), defaultValues: { name: "", type: "BANK_TRANSFER", track_balance: true, currency: "", opening_balance: "", opening_date: "" } });
    useEffect(() => { if (open) form.reset(); }, [open, form]);
    const submit = form.handleSubmit((v) => create.mutate({ name: v.name, type: v.type, track_balance: v.track_balance, currency: v.currency ? v.currency.toUpperCase() : null, opening_balance: v.opening_balance || null, opening_date: v.opening_date || null }, { onSuccess: () => onOpenChange(false) }));
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>New payment method</DialogTitle><DialogDescription>Bank accounts and cash boxes can track a running balance.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Piraeus business account" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl><SelectContent>{LedgerPaymentMethodTypeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                        <FormField control={form.control} name="track_balance" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-md border border-border p-3"><FormLabel>Track balance</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        <div className="grid grid-cols-3 gap-3">
                            <FormField control={form.control} name="opening_balance" render={({ field }) => (<FormItem><FormLabel>Opening</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="opening_date" render={({ field }) => (<FormItem><FormLabel>As of</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><FormControl><Input maxLength={3} {...field} /></FormControl></FormItem>)} />
                        </div>
                        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button><Button type="submit" loading={create.isPending}>Create</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function SettingsPanel() {
    const s = useLedgerSettings();
    const save = useUpdateLedgerSettings();
    const rates = useTaxRates().data;
    const [threshold, setThreshold] = useState("");
    useEffect(() => { if (s.data) setThreshold(s.data.approval_threshold_amount ? String(Number(s.data.approval_threshold_amount)) : ""); }, [s.data]);
    if (s.isPending) return <ListSkeleton />;
    if (s.error || !s.data) return <ErrorState error={s.error} />;
    const d = s.data;
    const toggle = (key: keyof typeof d, label: string, help: string) => (
        <div className="flex items-center justify-between gap-3 py-3">
            <div><div className="text-[13px] text-foreground">{label}</div><div className="text-xs text-muted-foreground">{help}</div></div>
            <Switch checked={!!d[key]} onCheckedChange={(v) => save.mutate({ [key]: v })} aria-label={label} />
        </div>
    );
    return (
        <div className="space-y-4">
            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor="threshold">Approval threshold ({d.effective_reporting_currency})</Label>
                    <div className="flex gap-2"><Input id="threshold" inputMode="decimal" placeholder="No approval" value={threshold} onChange={(e) => setThreshold(e.target.value)} /><Button variant="outline" loading={save.isPending} onClick={() => save.mutate({ approval_threshold_amount: threshold ? threshold : null })}>Save</Button></div>
                    <p className="text-xs text-muted-foreground">Manual records above this gross amount need a second member to approve them.</p>
                </div>
                <div className="space-y-1.5">
                    <Label>Fiscal year starts</Label>
                    <Select value={String(d.fiscal_year_start_month)} onValueChange={(v) => save.mutate({ fiscal_year_start_month: Number(v) })}>
                        <SelectTrigger aria-label="Fiscal year start"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{new Date(Date.UTC(2026, i, 1)).toLocaleString(undefined, { month: "long", timeZone: "UTC" })}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Default VAT on expenses</Label>
                    <Select value={d.default_expense_tax_rate_id ?? NONE} onValueChange={(v) => save.mutate({ default_expense_tax_rate_id: v === NONE ? null : v })}>
                        <SelectTrigger aria-label="Default expense VAT"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value={NONE}>None</SelectItem>{rates?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Default VAT on income</Label>
                    <Select value={d.default_income_tax_rate_id ?? NONE} onValueChange={(v) => save.mutate({ default_income_tax_rate_id: v === NONE ? null : v })}>
                        <SelectTrigger aria-label="Default income VAT"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value={NONE}>None</SelectItem>{rates?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="divide-y divide-border-soft rounded-lg border border-border bg-card px-4">
                {toggle("auto_sync_invoices", "Sync invoices from Billing", "Every finalized invoice creates and updates its income record.")}
                {toggle("auto_sync_payments", "Sync payments from Billing", "Unallocated payments and processing fees are booked automatically.")}
                {toggle("auto_categorize_suppliers", "Use supplier defaults", "Expenses from known suppliers get their default category and VAT.")}
                {toggle("duplicate_detection_enabled", "Detect duplicates", "Flag expenses with the same supplier, amount and reference.")}
                {toggle("ai_enabled", "Insights", "Nightly checks for unusual expenses and budget overruns.")}
            </div>
        </div>
    );
}
