import { useEffect, useState } from "react";
import { CurrencySelect } from "@/components/ui/currency-select";
import { useNavigate } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useClaims, useCreateClaim } from "@/features/expenses/hooks/use-expenses";
import type { ExpenseClaim } from "@/features/expenses/interfaces/expenses.interfaces";
import { claimFormSchema, type ClaimFormValues } from "@/features/expenses/validation-schemas/expenses.schema";
import { ClaimStatusFilterOptions } from "@/config/constants/dropdowns/expenses/expenses.options";
import { formatDate, formatMoney } from "@/lib/format";
import { CategoryPicker, ClaimStatusBadge } from "../components/ledger-ui";
import { todayIso } from "../utils/ranges";

/**
 * /expenses/claims — expense claims: your own (create_own / read_own) or everyone's (finance.expense_claims.read).
 * @perm finance.expense_claims.read_own | .read · create finance.expense_claims.create_own · approve/pay finance.expense_claims.approve
 * @api GET/POST /ledger/claims
 */
export default function ClaimsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const p = usePermissions();
    const canAll = p.can("finance.expense_claims.read");
    const claims = useClaims({ ...params, ...(filters.view === "mine" || !canAll ? { mine: true } : {}) });
    const [open, setOpen] = useState(false);
    const canCreate = p.canAny("finance.expense_claims.create_own", "finance.expense_claims.approve");
    const noProfile = claims.data && !claims.data.employee_profile && (!canAll || filters.view === "mine");
    const columns: DataTableColumn<ExpenseClaim>[] = [
        { key: "title", header: "Claim", cell: (c) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{c.title}</div><div className="truncate text-xs text-muted-foreground">{c.number} · {c._count?.lines ?? 0} receipt{c._count?.lines === 1 ? "" : "s"}</div></div> },
        ...(canAll ? [{ key: "employee", header: "Employee", cell: (c: ExpenseClaim) => c.employee_name_snapshot ?? "—", hideBelow: "md" as const }] : []),
        { key: "submitted", header: "Submitted", cell: (c) => formatDate(c.submitted_at), hideBelow: "lg" },
        { key: "status", header: "Status", cell: (c) => <ClaimStatusBadge status={c.status} /> },
        { key: "total", header: "Total", cell: (c) => <span className="tabular font-medium">{formatMoney(c.total_amount, c.currency)}</span>, className: "text-right", headerClassName: "text-right" },
    ];
    return (
        <Page>
            <PageHeader title="Expense claims" description="Out-of-pocket expenses reimbursed to employees after approval." actions={canCreate && <Button onClick={() => setOpen(true)} disabled={!!noProfile && !p.can("finance.expense_claims.approve")}><Plus /> New claim</Button>} />
            {noProfile && <div className="mb-4 rounded-lg border border-border bg-warning-soft px-4 py-3 text-[13px] text-warning">You need an employee profile (People) before you can file expense claims.</div>}
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search claims…">
                {canAll && (
                    <Select value={filters.view ?? "all"} onValueChange={(v) => setFilter("view", v)}>
                        <SelectTrigger className="h-8 w-36" aria-label="Whose claims"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Everyone</SelectItem><SelectItem value="mine">Mine</SelectItem></SelectContent>
                    </Select>
                )}
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-40" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{ClaimStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={claims.data?.data} rowKey={(c) => c.id} loading={claims.isFetching} error={claims.error} onRetry={() => claims.refetch()} pagination={claims.data?.pagination} onPageChange={setPage} rowHref={(c) => `/expenses/claims/${c.id}`}
                empty={{ icon: ReceiptText, title: "No expense claims", description: "Add receipts and submit them for approval." }} />
            <ClaimDialog open={open} onOpenChange={setOpen} />
        </Page>
    );
}

export function ClaimDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const navigate = useNavigate();
    const session = useSessionData();
    const create = useCreateClaim();
    const form = useForm<ClaimFormValues>({ resolver: zodResolver(claimFormSchema) });
    const lines = useFieldArray({ control: form.control, name: "lines" });
    useEffect(() => {
        if (open) form.reset({ title: "", currency: session?.active_organization?.default_currency ?? "EUR", notes: "", lines: [{ expense_date: todayIso(), category_id: undefined, description: "", merchant: "", gross_amount: "", vat_amount: "" }] });
    }, [open, form, session?.active_organization?.default_currency]);
    const send = (submit: boolean) => form.handleSubmit((v) => create.mutate(
        { title: v.title, currency: v.currency.toUpperCase(), notes: v.notes || null, submit, lines: v.lines.map((l) => ({ expense_date: l.expense_date, category_id: l.category_id || null, description: l.description, merchant: l.merchant || null, gross_amount: l.gross_amount, vat_amount: l.vat_amount || "0" })) },
        { onSuccess: (c) => { onOpenChange(false); navigate(`/expenses/claims/${c.id}`); } },
    ))();
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <Form {...form}>
                    <form onSubmit={(e) => { e.preventDefault(); send(true); }} className="space-y-4">
                        <DialogHeader><DialogTitle>New expense claim</DialogTitle><DialogDescription>One line per receipt. Attach receipts on the claim page.</DialogDescription></DialogHeader>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <FormField control={form.control} name="title" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Title</FormLabel><FormControl><Input placeholder="Client visit Thessaloniki" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><FormControl><CurrencySelect value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="space-y-3">
                            {lines.fields.map((f, i) => (
                                <div key={f.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-6">
                                    <FormField control={form.control} name={`lines.${i}.expense_date`} render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel className="text-xs">Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name={`lines.${i}.merchant`} render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel className="text-xs">Merchant</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name={`lines.${i}.gross_amount`} render={({ field }) => (<FormItem className="sm:col-span-1"><FormLabel className="text-xs">Amount</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name={`lines.${i}.vat_amount`} render={({ field }) => (<FormItem className="sm:col-span-1"><FormLabel className="text-xs">VAT</FormLabel><FormControl><Input inputMode="decimal" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name={`lines.${i}.description`} render={({ field }) => (<FormItem className="sm:col-span-3"><FormLabel className="text-xs">Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name={`lines.${i}.category_id`} render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel className="text-xs">Category</FormLabel><CategoryPicker kind="EXPENSE" value={field.value} onChange={(v) => field.onChange(v ?? undefined)} /></FormItem>)} />
                                    <div className="flex items-end justify-end"><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove receipt ${i + 1}`} disabled={lines.fields.length === 1} onClick={() => lines.remove(i)}><Trash2 /></Button></div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => lines.append({ expense_date: todayIso(), category_id: undefined, description: "", merchant: "", gross_amount: "", vat_amount: "" })}><Plus /> Add receipt</Button>
                        </div>
                        <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="button" variant="outline" disabled={create.isPending} onClick={() => send(false)}>Save draft</Button>
                            <Button type="submit" loading={create.isPending}>Submit for approval</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
