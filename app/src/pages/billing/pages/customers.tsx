import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useBillingProfiles } from "@/features/billing/hooks/use-billing";
import type { BillingProfile } from "@/features/billing/interfaces/billing.interfaces";
import { formatMoney } from "@/lib/format";
import { BillingProfileForm } from "../components/billing-profile-form";

/**
 * /billing/customers — billing profiles of CRM companies.
 * @perm VIEW finance.invoices.read · create/edit finance.billing_profiles.manage · lifetime paid needs finance.payments.read
 * @api GET /finance/billing-profiles · POST /finance/billing-profiles
 */
export default function CustomersPage() {
    const { params, setPage, search, setSearch } = useListParams();
    const list = useBillingProfiles(params);
    const canManage = usePermission("finance.billing_profiles.manage");
    const [open, setOpen] = useState(false);
    const columns: DataTableColumn<BillingProfile>[] = [
        { key: "name", header: "Customer", cell: (p) => <div className="min-w-0"><div className="truncate font-medium text-foreground">{p.legal_name}</div><div className="truncate text-xs text-muted-foreground">{p.billing_email ?? p.company?.name}</div></div> },
        { key: "terms", header: "Terms", cell: (p) => `${p.payment_terms_days} days`, hideBelow: "md" },
        { key: "vat", header: "VAT", cell: (p) => p.vat_number ?? "—", hideBelow: "lg" },
        { key: "subs", header: "Subscriptions", cell: (p) => p._count?.subscriptions ?? 0, hideBelow: "lg", className: "tabular" },
        { key: "paid", header: "Lifetime paid", cell: (p) => (p.lifetime_paid === null || p.lifetime_paid === undefined ? "—" : formatMoney(p.lifetime_paid, p.currency)), hideBelow: "md", className: "text-right tabular", headerClassName: "text-right" },
        { key: "outstanding", header: "Outstanding", cell: (p) => <span className="tabular font-medium text-foreground">{formatMoney(p.outstanding ?? 0, p.currency)}</span>, className: "text-right", headerClassName: "text-right" },
    ];
    return (
        <Page>
            <PageHeader title="Customer billing" description="Billing details, payment terms and balances per customer." actions={<Can permission="finance.billing_profiles.manage"><Button onClick={() => setOpen(true)}><Plus /> New billing profile</Button></Can>} />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search customers…" />
            <DataTable columns={columns} data={list.data?.data} rowKey={(p) => p.id} loading={list.isFetching} error={list.error} onRetry={() => list.refetch()} pagination={list.data?.pagination} onPageChange={setPage} rowHref={(p) => `/billing/customers/${p.id}`}
                empty={{ icon: Building2, title: search ? "No customers match" : "No billing profiles yet", description: "Create a billing profile for a CRM company before invoicing it.", action: canManage && !search ? <Button size="sm" onClick={() => setOpen(true)}><Plus /> New billing profile</Button> : undefined }} />
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader><DialogTitle>New billing profile</DialogTitle><DialogDescription>Pick the CRM company and its invoicing details.</DialogDescription></DialogHeader>
                    <BillingProfileForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
                </DialogContent>
            </Dialog>
        </Page>
    );
}
