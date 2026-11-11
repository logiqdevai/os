import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Send, Wallet, XCircle } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { useClaim, useClaimAction, usePaymentMethods } from "@/features/expenses/hooks/use-expenses";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { ClaimStatusBadge } from "../components/ledger-ui";

const NONE = "__none";

/**
 * /expenses/claims/:id — claim lines, approval and reimbursement.
 * @perm read own or finance.expense_claims.read · submit own · approve/reject/pay finance.expense_claims.approve (never your own)
 * @api GET /ledger/claims/:id · POST /:id/{submit|approve|reject|pay}
 */
export default function ClaimDetailPage() {
    const { id } = useParams();
    const q = useClaim(id);
    const canApprove = usePermission("finance.expense_claims.approve");
    const act = useClaimAction();
    const methods = usePaymentMethods(canApprove);
    const [dialog, setDialog] = useState<null | "reject" | "pay">(null);
    const [reason, setReason] = useState("");
    const [method, setMethod] = useState(NONE);
    if (q.isPending) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const c = q.data;
    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/expenses/claims", label: "Expense claims" }}
                title={c.title}
                meta={<ClaimStatusBadge status={c.status} />}
                description={`${c.number} · ${c.employee_name_snapshot ?? "Employee"}`}
                actions={
                    <>
                        {(c.status === "DRAFT" || c.status === "REJECTED") && <Button loading={act.isPending} onClick={() => act.mutate({ id: c.id, action: "submit" })}><Send /> Submit</Button>}
                        {c.status === "SUBMITTED" && canApprove && (
                            <>
                                <Button loading={act.isPending} onClick={() => act.mutate({ id: c.id, action: "approve" })}><CheckCircle2 /> Approve</Button>
                                <Button variant="outline" onClick={() => { setReason(""); setDialog("reject"); }}><XCircle /> Reject</Button>
                            </>
                        )}
                        {c.status === "APPROVED" && canApprove && <Button onClick={() => setDialog("pay")}><Wallet /> Mark reimbursed</Button>}
                    </>
                }
            />
            {c.status === "REJECTED" && c.rejection_reason && <div className="mb-4 rounded-lg border border-border bg-danger-soft px-4 py-3 text-[13px] text-danger">Rejected: {c.rejection_reason}</div>}
            <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4">
                    <KeyValueList columns={3} items={[
                        { label: "Total", value: formatMoney(c.total_amount, c.currency) },
                        { label: "VAT", value: formatMoney(c.vat_total, c.currency) },
                        { label: "Submitted", value: formatDateTime(c.submitted_at) },
                        { label: "Decided", value: formatDateTime(c.decided_at) },
                        { label: "Reimbursed", value: formatDateTime(c.paid_at) },
                        { label: "Expense record", value: c.payroll_entry?.ledger_record_id ? <Link className="hover:underline" to={`/expenses/records/${c.payroll_entry.ledger_record_id}`}>Open record</Link> : null },
                    ]} />
                    {c.notes && <p className="mt-3 whitespace-pre-wrap text-[13px] text-body">{c.notes}</p>}
                </div>
                <Section title="Receipts">
                    <div className="overflow-x-auto rounded-lg border border-border bg-card">
                        <Table>
                            <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Description</TableHead><TableHead className="hidden text-xs md:table-cell">Category</TableHead><TableHead className="text-right text-xs">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {c.lines.map((l) => (
                                    <TableRow key={l.id} className="border-border-soft">
                                        <TableCell className="whitespace-nowrap text-[13px]">{formatDate(l.expense_date)}</TableCell>
                                        <TableCell className="text-[13px]">{l.merchant ? `${l.merchant} — ` : ""}{l.description}</TableCell>
                                        <TableCell className="hidden text-[13px] md:table-cell">{l.category?.name ?? "—"}</TableCell>
                                        <TableCell className="text-right tabular text-[13px]">{formatMoney(l.gross_amount, c.currency)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Section>
                {c.approvals.length > 0 && (
                    <Section title="Approvals">
                        <ul className="space-y-1 text-[13px]">{c.approvals.map((a) => <li key={a.id} className="flex items-center gap-2"><Badge variant={a.decision === "APPROVED" ? "success" : a.decision === "REJECTED" ? "danger" : a.decision === "PENDING" ? "warning" : "neutral"}>{a.decision.toLowerCase()}</Badge>Step {a.step}{a.decided_at ? ` · ${formatDateTime(a.decided_at)}` : ""}</li>)}</ul>
                    </Section>
                )}
            </div>
            <Dialog open={!!dialog} onOpenChange={(o) => !act.isPending && !o && setDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{dialog === "reject" ? "Reject claim" : "Mark as reimbursed"}</DialogTitle><DialogDescription>{dialog === "reject" ? "The employee can fix and resubmit it." : `Posts an expense of ${formatMoney(c.total_amount, c.currency)} as paid.`}</DialogDescription></DialogHeader>
                    {dialog === "reject" ? (
                        <div className="space-y-1.5"><Label htmlFor="reason">Reason</Label><Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
                    ) : (
                        <div className="space-y-1.5"><Label>Paid from</Label><Select value={method} onValueChange={setMethod}><SelectTrigger aria-label="Paid from"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Not set</SelectItem>{methods.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialog(null)} disabled={act.isPending}>Cancel</Button>
                        {dialog === "reject"
                            ? <Button variant="destructive" disabled={!reason.trim()} loading={act.isPending} onClick={() => act.mutate({ id: c.id, action: "reject", body: { reason: reason.trim() } }, { onSuccess: () => setDialog(null) })}>Reject</Button>
                            : <Button loading={act.isPending} onClick={() => act.mutate({ id: c.id, action: "pay", body: { payment_method_id: method === NONE ? null : method } }, { onSuccess: () => setDialog(null) })}>Mark reimbursed</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
