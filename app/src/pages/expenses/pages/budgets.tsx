import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Flag, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { useBudget, useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget } from "@/features/expenses/hooks/use-expenses";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryPicker } from "../components/ledger-ui";

/**
 * /expenses/budgets — yearly expense budgets per category with actuals.
 * @perm VIEW finance.budgets.read · create/edit finance.budgets.manage
 * @api GET/POST/PATCH/DELETE /ledger/budgets
 */
export default function BudgetsPage() {
    const [sp, setSp] = useSearchParams();
    const year = Number(sp.get("year") ?? new Date().getFullYear());
    const list = useBudgets({ year });
    const selectedId = sp.get("budget") ?? list.data?.[0]?.id;
    const detail = useBudget(selectedId);
    const canManage = usePermission("finance.budgets.manage");
    const update = useUpdateBudget();
    const remove = useDeleteBudget();
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const set = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); n.set(k, v); if (k === "year") n.delete("budget"); return n; }, { replace: true });
    const years = [year - 1, year, year + 1].map(String);
    return (
        <Page width="wide">
            <PageHeader title="Budgets" description="Plan yearly spending per category and follow the actuals." actions={<Can permission="finance.budgets.manage"><Button onClick={() => setOpen(true)}><Plus /> New budget</Button></Can>} />
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="w-32 space-y-1.5"><Label>Year</Label><Select value={String(year)} onValueChange={(v) => set("year", v)}><SelectTrigger aria-label="Year"><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
                {!!list.data?.length && (
                    <div className="w-64 space-y-1.5"><Label>Budget</Label><Select value={selectedId} onValueChange={(v) => set("budget", v)}><SelectTrigger aria-label="Budget"><SelectValue /></SelectTrigger><SelectContent>{list.data.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                )}
            </div>
            {list.isPending ? <ListSkeleton /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data?.length ? (
                <EmptyState icon={Flag} title={`No budgets for ${year}`} description="Create a budget with a yearly amount per expense category." action={canManage ? <Button size="sm" onClick={() => setOpen(true)}><Plus /> New budget</Button> : undefined} />
            ) : detail.isPending ? <ListSkeleton /> : detail.error || !detail.data ? <ErrorState error={detail.error} /> : (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4">
                        <div>
                            <div className="flex items-center gap-2"><span className="font-medium text-foreground">{detail.data.name}</span><Badge variant={detail.data.status === "ACTIVE" ? "success" : "neutral"}>{detail.data.status.toLowerCase()}</Badge></div>
                            <div className="text-xs text-muted-foreground">Warning at {detail.data.warn_percent}% · {detail.data.basis.toLowerCase()} basis</div>
                        </div>
                        {canManage && (
                            <div className="flex gap-2">
                                {detail.data.status !== "ACTIVE" && <Button size="sm" variant="outline" loading={update.isPending} onClick={() => update.mutate({ id: detail.data!.id, status: "ACTIVE" })}>Activate</Button>}
                                <Button size="sm" variant="destructive" onClick={() => setDeleting(true)}><Trash2 /> Delete</Button>
                            </div>
                        )}
                    </div>
                    {detail.data.subjects.length ? (
                        <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {detail.data.subjects.map((s) => {
                                const pct = s.used_percent ?? 0;
                                return (
                                    <div key={s.subject_key} className="space-y-2 px-4 py-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                                            <span className="font-medium text-foreground">{s.label}</span>
                                            <span className="tabular text-muted-foreground"><span className={cn(s.over_warn ? "text-danger" : "text-foreground")}>{formatMoney(s.actual_total, detail.data!.currency)}</span> of {formatMoney(s.planned_total, detail.data!.currency)} · {formatPercent(pct, 0)}</span>
                                        </div>
                                        <Progress value={Math.min(100, pct)} className={cn("h-2", s.over_warn && "[&>div]:bg-danger")} aria-label={`${s.label} budget used`} />
                                    </div>
                                );
                            })}
                        </div>
                    ) : <EmptyState compact title="This budget has no lines" />}
                </div>
            )}
            <BudgetDialog open={open} onOpenChange={setOpen} year={year} onCreated={(id) => set("budget", id)} />
            <ConfirmationDialog isOpen={deleting} onClose={() => setDeleting(false)} title="Delete this budget?" description="Planned amounts are removed; ledger records are not affected." confirmText="Delete" variant="destructive" onConfirm={() => { if (detail.data) remove.mutate(detail.data.id); setDeleting(false); setSp((p) => { const n = new URLSearchParams(p); n.delete("budget"); return n; }); }} />
        </Page>
    );
}

function BudgetDialog({ open, onOpenChange, year, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; year: number; onCreated: (id: string) => void }) {
    const create = useCreateBudget();
    const [name, setName] = useState(`Operating budget ${year}`);
    const [rows, setRows] = useState<{ category_id: string | null; amount: string }[]>([{ category_id: null, amount: "" }]);
    const valid = name.trim() && rows.every((r) => r.category_id && Number(r.amount) > 0) && new Set(rows.map((r) => r.category_id)).size === rows.length;
    const submit = () => {
        const lines = rows.flatMap((r) => Array.from({ length: 12 }, (_, i) => ({ category_id: r.category_id, month: i + 1, planned_amount: (Math.round((Number(r.amount) / 12) * 100) / 100).toFixed(2) })));
        create.mutate({ name: name.trim(), fiscal_year: year, scope: "CATEGORY", status: "ACTIVE", lines }, { onSuccess: (b) => { onOpenChange(false); onCreated(b.id); setRows([{ category_id: null, amount: "" }]); } });
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>New budget {year}</DialogTitle><DialogDescription>Yearly amounts are spread evenly over the 12 fiscal months.</DialogDescription></DialogHeader>
                <div className="space-y-1.5"><Label htmlFor="budget-name">Name</Label><Input id="budget-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2">
                    {rows.map((r, i) => (
                        <div key={i} className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
                            <div className="space-y-1"><Label className="text-xs">Category</Label><CategoryPicker kind="EXPENSE" value={r.category_id} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, category_id: v } : x)))} noneLabel="Choose" /></div>
                            <div className="space-y-1"><Label className="text-xs">Per year</Label><Input inputMode="decimal" value={r.amount} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} /></div>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Trash2 /></Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { category_id: null, amount: "" }])}><Plus /> Add category</Button>
                </div>
                <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button><Button disabled={!valid} loading={create.isPending} onClick={submit}>Create budget</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
