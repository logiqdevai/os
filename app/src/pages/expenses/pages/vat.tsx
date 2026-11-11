import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { useVatReport, useVatReturnAction } from "@/features/expenses/hooks/use-expenses";
import { VatGroupOptions } from "@/config/constants/dropdowns/expenses/expenses.options";
import { formatDate, formatMoney } from "@/lib/format";
import { RangeBar } from "../components/ledger-ui";
import { presetRange } from "../utils/ranges";

/**
 * /expenses/vat — VAT collected vs paid, grouped by rate / category / counterparty / month, and VAT returns.
 * @perm VIEW finance.vat.read · file returns finance.vat.manage (prepare from Periods)
 * @api GET /ledger/reports/vat · POST /ledger/vat-returns/:id/{file|paid}
 */
export default function VatPage() {
    const [sp, setSp] = useSearchParams();
    const preset = sp.get("period") ?? "this_quarter";
    const basis = sp.get("basis") ?? "ACCRUAL";
    const group = sp.get("group") ?? "rate";
    const q = useVatReport({ ...presetRange(preset), basis, group_by: group });
    const canManage = usePermission("finance.vat.manage");
    const act = useVatReturnAction();
    const [filing, setFiling] = useState<string | null>(null);
    const [reference, setReference] = useState("");
    const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); n.set(k, v); return n; }, { replace: true });
    const d = q.data;
    const cur = d?.currency ?? "EUR";
    return (
        <Page width="wide">
            <PageHeader title="VAT" description="VAT collected on income minus VAT paid on expenses." />
            <RangeBar preset={preset} onPreset={(v) => set("period", v)} basis={basis} onBasis={(v) => set("basis", v)}>
                <div className="space-y-1.5 sm:w-52">
                    <Label>Group</Label>
                    <Select value={group} onValueChange={(v) => set("group", v)}><SelectTrigger aria-label="Group"><SelectValue /></SelectTrigger><SelectContent>{VatGroupOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                </div>
            </RangeBar>
            {q.isPending ? <ListSkeleton /> : q.error || !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
                <div className="space-y-4">
                    <StatGrid className="lg:grid-cols-3">
                        <StatCard label="VAT collected" value={formatMoney(d.vat_collected, cur)} tone="success" />
                        <StatCard label="VAT paid" value={formatMoney(d.vat_paid, cur)} tone="info" />
                        <StatCard label={d.net_vat >= 0 ? "VAT payable" : "VAT refundable"} value={formatMoney(Math.abs(d.net_vat), cur)} tone={d.net_vat > 0 ? "warning" : "default"} />
                    </StatGrid>
                    {d.groups.length ? (
                        <div className="overflow-x-auto rounded-lg border border-border bg-card">
                            <Table>
                                <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Group</TableHead><TableHead className="hidden text-right text-xs sm:table-cell">Income (net)</TableHead><TableHead className="text-right text-xs">VAT collected</TableHead><TableHead className="hidden text-right text-xs sm:table-cell">Expenses (net)</TableHead><TableHead className="text-right text-xs">VAT paid</TableHead><TableHead className="text-right text-xs">Net</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {d.groups.map((g) => (
                                        <TableRow key={g.key} className="border-border-soft">
                                            <TableCell className="text-[13px]">{g.label}</TableCell>
                                            <TableCell className="hidden text-right tabular text-[13px] sm:table-cell">{formatMoney(g.income_net, cur)}</TableCell>
                                            <TableCell className="text-right tabular text-[13px]">{formatMoney(g.vat_collected, cur)}</TableCell>
                                            <TableCell className="hidden text-right tabular text-[13px] sm:table-cell">{formatMoney(g.expense_net, cur)}</TableCell>
                                            <TableCell className="text-right tabular text-[13px]">{formatMoney(g.vat_paid, cur)}</TableCell>
                                            <TableCell className="text-right tabular text-[13px] font-medium">{formatMoney(g.net_vat, cur)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : <EmptyState compact title="No VAT in this period" />}
                    <Section title="VAT returns" description="Prepare a return from a closed period under Periods.">
                        {d.returns.length ? (
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {d.returns.map((r) => (
                                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]">
                                        <span>{r.period.name} · {formatDate(r.period.start_date)} – {formatDate(r.period.end_date)}{r.authority_reference ? ` · ref ${r.authority_reference}` : ""}</span>
                                        <span className="flex items-center gap-2">
                                            <span className="tabular">{formatMoney(r.net_vat, r.currency)}</span>
                                            <Badge variant={r.status === "PAID" ? "success" : r.status === "FILED" ? "info" : "neutral"}>{r.status.toLowerCase()}</Badge>
                                            {canManage && r.status === "DRAFT" && <Button size="sm" variant="outline" loading={act.isPending} onClick={() => { setReference(""); setFiling(r.id); }}>Mark filed</Button>}
                                            {canManage && r.status === "FILED" && <Button size="sm" variant="outline" loading={act.isPending} onClick={() => act.mutate({ id: r.id, action: "paid" })}>Mark paid</Button>}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : <EmptyState compact title="No VAT returns yet" />}
                    </Section>
                </div>
            )}
            <Dialog open={!!filing} onOpenChange={(o) => !act.isPending && !o && setFiling(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Mark VAT return as filed</DialogTitle><DialogDescription>The totals are frozen once filed.</DialogDescription></DialogHeader>
                    <div className="space-y-1.5"><Label htmlFor="vat-ref">Reference from the tax authority</Label><Input id="vat-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" /></div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setFiling(null)} disabled={act.isPending}>Cancel</Button>
                        <Button loading={act.isPending} onClick={() => filing && act.mutate({ id: filing, action: "file", body: { authority_reference: reference || null } }, { onSuccess: () => setFiling(null) })}>Mark filed</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
