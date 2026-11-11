import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Link2, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useCreatePaymentLink, useDisablePaymentLink, usePaymentLinks } from "@/features/billing/hooks/use-billing";
import type { PaymentLink } from "@/features/billing/interfaces/billing.interfaces";
import { paymentLinkSchema, type PaymentLinkFormValues } from "@/features/billing/validation-schemas/billing.schema";
import { formatDate, formatMoney } from "@/lib/format";
import { PaymentLinkStatusBadge } from "../components/billing-badges";

/**
 * /billing/links — shareable hosted checkouts (invoice links are created from the invoice).
 * @perm VIEW finance.payments.read · create/disable finance.payment_links.manage
 * @api GET/POST /finance/payment-links · POST /:id/disable
 */
export default function PaymentLinksPage() {
    const { params, setPage, search, setSearch } = useListParams();
    const links = usePaymentLinks(params);
    const canManage = usePermission("finance.payment_links.manage");
    const disable = useDisablePaymentLink();
    const [open, setOpen] = useState(false);
    const copy = (url: string) => { void navigator.clipboard?.writeText(url); toast({ title: "Link copied" }); };
    const columns: DataTableColumn<PaymentLink>[] = [
        { key: "title", header: "Link", cell: (l) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{l.title}</div><div className="truncate text-xs text-muted-foreground">{l.invoice ? `Invoice ${l.invoice.number}` : l.billing_profile?.legal_name ?? "Anyone with the link"}</div></div> },
        { key: "amount", header: "Amount", cell: (l) => (l.amount ? formatMoney(l.amount, l.currency) : "Custom"), className: "tabular" },
        { key: "uses", header: "Uses", cell: (l) => `${l.uses}${l.max_uses ? ` / ${l.max_uses}` : ""}`, hideBelow: "md" },
        { key: "expires", header: "Expires", cell: (l) => formatDate(l.expires_at), hideBelow: "lg" },
        { key: "status", header: "Status", cell: (l) => <PaymentLinkStatusBadge status={l.status} /> },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-36 text-right",
            cell: (l) => l.status === "ACTIVE" && (
                <div className="flex justify-end gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label="Copy link" onClick={() => copy(l.url)}><Copy /></Button>
                    {canManage && <Button size="sm" variant="ghost" onClick={() => disable.mutate(l.id)}>Disable</Button>}
                </div>
            ),
        },
    ];
    return (
        <Page>
            <PageHeader title="Payment links" description="Share a link to collect a deposit or a one-off amount through your payment provider." actions={<Can permission="finance.payment_links.manage"><Button onClick={() => setOpen(true)}><Plus /> New payment link</Button></Can>} />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search links…" />
            <DataTable columns={columns} data={links.data?.data} rowKey={(l) => l.id} loading={links.isFetching} error={links.error} onRetry={() => links.refetch()} pagination={links.data?.pagination} onPageChange={setPage} empty={{ icon: Link2, title: "No payment links", description: "Needs a connected payment provider." }} />
            <LinkDialog open={open} onOpenChange={setOpen} />
        </Page>
    );
}

function LinkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const session = useSessionData();
    const create = useCreatePaymentLink();
    const form = useForm<PaymentLinkFormValues>({ resolver: zodResolver(paymentLinkSchema), defaultValues: { title: "", amount: "", currency: session?.active_organization?.default_currency ?? "EUR", description: "", max_uses: "" } });
    useEffect(() => { if (open) form.reset(); }, [open, form]);
    const submit = form.handleSubmit((v) => create.mutate({ title: v.title, amount: v.amount, currency: v.currency.toUpperCase(), description: v.description || null, max_uses: v.max_uses ? Number(v.max_uses) : null }, {
        onSuccess: (l) => { void navigator.clipboard?.writeText(l.url); onOpenChange(false); },
    }));
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>New payment link</DialogTitle><DialogDescription>The link is copied to your clipboard when it is ready.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Project deposit" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-2 gap-3">
                            <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>Currency</FormLabel><FormControl><Input maxLength={3} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="max_uses" render={({ field }) => (<FormItem><FormLabel>Max uses</FormLabel><FormControl><Input inputMode="numeric" placeholder="Unlimited" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button><Button type="submit" loading={create.isPending}>Create link</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
