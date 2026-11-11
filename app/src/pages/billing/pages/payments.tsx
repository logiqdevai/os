import { useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { usePayments, useRefundDecision, useRefunds } from "@/features/billing/hooks/use-billing";
import type { Payment } from "@/features/billing/interfaces/billing.interfaces";
import { PaymentMethodTypeOptions, PaymentStatusFilterOptions } from "@/config/constants/dropdowns/billing/billing.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatMoney } from "@/lib/format";
import { PaymentStatusBadge } from "../components/billing-badges";
import { RecordPaymentDialog } from "../components/billing-dialogs";

/**
 * /billing/payments — payments and refunds.
 * @perm VIEW finance.payments.read · record finance.payments.record · approve refunds finance.refunds.approve
 * @api GET /finance/payments · POST /finance/payments · GET /finance/refunds · POST /finance/refunds/:id/{approve|reject}
 */
export default function PaymentsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const payments = usePayments(params);
    const refunds = useRefunds({});
    const canApprove = usePermission("finance.refunds.approve");
    const decide = useRefundDecision();
    const [recording, setRecording] = useState(false);
    const t = payments.data?.totals;
    const cur = payments.data?.data[0]?.currency ?? "EUR";

    const columns: DataTableColumn<Payment>[] = [
        { key: "date", header: "Received", cell: (p) => formatDate(p.received_at ?? p.created_at) },
        { key: "customer", header: "Customer", cell: (p) => <span className="truncate">{p.billing_profile?.legal_name ?? "Unassigned"}</span> },
        { key: "invoices", header: "Invoices", cell: (p) => (p.allocations.length ? p.allocations.map((a) => a.invoice.number).join(", ") : <span className="text-muted-foreground">Unallocated</span>), hideBelow: "lg" },
        { key: "method", header: "Method", cell: (p) => `${getDropdownOptionLabel(PaymentMethodTypeOptions, p.method_type)}${p.provider_connection ? ` · ${p.provider_connection.display_name}` : ""}`, hideBelow: "md" },
        { key: "status", header: "Status", cell: (p) => <PaymentStatusBadge status={p.status} />, hideBelow: "sm" },
        { key: "amount", header: "Amount", cell: (p) => <span className="tabular font-medium text-foreground">{formatMoney(p.amount, p.currency)}</span>, className: "text-right", headerClassName: "text-right" },
    ];

    return (
        <Page>
            <PageHeader
                title="Payments"
                description={t ? `Received ${formatMoney(t.amount, cur)} · fees ${formatMoney(t.fees, cur)} · refunded ${formatMoney(t.refunded, cur)} (matching filters)` : "Online and manual payments."}
                actions={<Can permission="finance.payments.record"><Button onClick={() => setRecording(true)}><Plus /> Record payment</Button></Can>}
            />
            <Tabs defaultValue="payments">
                <TabsList>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                    <TabsTrigger value="refunds">Refunds{refunds.data?.some((r) => r.status === "PENDING") ? <Badge variant="warning" className="ml-1.5">{refunds.data.filter((r) => r.status === "PENDING").length}</Badge> : null}</TabsTrigger>
                </TabsList>
                <TabsContent value="payments">
                    <TableToolbar search={search} onSearch={setSearch} placeholder="Search reference or customer…">
                        <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                            <SelectTrigger className="h-8 w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                            <SelectContent>{PaymentStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </TableToolbar>
                    <DataTable columns={columns} data={payments.data?.data} rowKey={(p) => p.id} loading={payments.isFetching} error={payments.error} onRetry={() => payments.refetch()} pagination={payments.data?.pagination} onPageChange={setPage} rowHref={(p) => `/billing/payments/${p.id}`}
                        empty={{ icon: CreditCard, title: "No payments yet", description: "Payments appear here when customers pay online or when you record a bank transfer." }} />
                </TabsContent>
                <TabsContent value="refunds">
                    {refunds.isPending ? <ListSkeleton /> : refunds.error ? <ErrorState error={refunds.error} onRetry={() => refunds.refetch()} /> : !refunds.data?.length ? <EmptyState title="No refunds" /> : (
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {refunds.data.map((r) => (
                                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                    <div className="min-w-0">
                                        <Link to={`/billing/payments/${r.payment.id}`} className="text-[13px] text-foreground hover:underline">{r.payment.billing_profile?.legal_name ?? "Payment"}</Link>
                                        <div className="text-xs text-muted-foreground">{r.reason} · {formatDate(r.created_at)}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="tabular text-[13px]">{formatMoney(r.amount, r.payment.currency)}</span>
                                        <Badge variant={r.status === "SUCCEEDED" ? "success" : r.status === "PENDING" ? "warning" : "neutral"}>{r.status.toLowerCase()}</Badge>
                                        {r.status === "PENDING" && canApprove && (
                                            <>
                                                <Button size="sm" loading={decide.isPending} onClick={() => decide.mutate({ id: r.id, action: "approve" })}>Approve</Button>
                                                <Button size="sm" variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, action: "reject", reason: "Rejected by approver" })}>Reject</Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
            <RecordPaymentDialog open={recording} onOpenChange={setRecording} />
        </Page>
    );
}
