import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Circle, CircleSlash, MinusCircle } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiChecklistAssigneeFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useCancelChecklistRun, useChecklistRun, useRunItemAction } from "@/features/docs/hooks/use-docs";
import { DocsStatusBadge } from "../../components/docs-ui";

/**
 * /docs/checklist-runs/:id — complete a checklist run (15 §7)
 * @perm VIEW docs.pages.read (subject, assignees, managers) · skip/cancel docs.checklists.manage
 * @api GET /docs/runs/:id · POST /docs/runs/:id/items/:itemId/complete|reopen|skip · POST /docs/runs/:id/cancel
 */
export default function ChecklistRunPage() {
    const { id = "" } = useParams<{ id: string }>();
    const run = useChecklistRun(id);
    const item = useRunItemAction();
    const cancel = useCancelChecklistRun();
    const [skipping, setSkipping] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    const [cancelling, setCancelling] = useState(false);

    if (run.isPending) return <PageSkeleton />;
    if (run.error) return <Page><ErrorState error={run.error} onRetry={() => run.refetch()} /></Page>;
    const r = run.data;
    const open = r.status !== "COMPLETED" && r.status !== "CANCELLED";
    const fail = (e: unknown) => toast({ variant: "destructive", title: "Could not update the item", description: getApiErrorMessage(e) });

    return (
        <Page width="narrow">
            <PageHeader
                back={{ to: "/docs/checklists?tab=runs", label: "Checklist runs" }}
                title={`${r.checklist.name} — ${personName(r.subject.user)}`}
                meta={<DocsStatusBadge status={r.status} />}
                actions={r.can_manage && open && <Button variant="outline" onClick={() => setCancelling(true)}><CircleSlash /> Cancel run</Button>}
            />
            <div className="mb-6 space-y-2 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">Progress</span><span className="tabular text-foreground">{r.progress_percent}%</span></div>
                <Progress value={r.progress_percent} />
                <div className="text-xs text-muted-foreground">{r.due_at ? `Due ${formatDate(r.due_at)}` : "No due date"}{r.checklist.guide_page && <> · Guide: <Link className="text-info hover:underline" to={`/docs/pages/${r.checklist.guide_page.id}`}>{r.checklist.guide_page.title}</Link></>}</div>
            </div>
            <ol className="space-y-2">
                {r.items.map((it) => {
                    const done = it.status === "COMPLETED";
                    const skipped = it.status === "SKIPPED";
                    return (
                        <li key={it.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                            <button
                                type="button"
                                disabled={!open || skipped || item.isPending}
                                onClick={() => item.mutate({ id, itemId: it.id, action: done ? "reopen" : "complete" }, { onError: fail })}
                                className="mt-0.5 shrink-0 disabled:opacity-50"
                                aria-label={done ? `Reopen ${it.checklist_item.title}` : `Complete ${it.checklist_item.title}`}
                            >
                                {done ? <CheckCircle2 className="size-5 text-success" /> : skipped ? <MinusCircle className="size-5 text-muted-foreground" /> : <Circle className="size-5 text-muted-foreground" />}
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className={`text-[13px] font-medium ${done || skipped ? "text-muted-foreground line-through" : "text-foreground"}`}>{it.checklist_item.title}{!it.checklist_item.is_required && <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>}</div>
                                {it.checklist_item.description && <p className="text-xs text-muted-foreground">{it.checklist_item.description}</p>}
                                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                                    <span>{getDropdownOptionLabel(WikiChecklistAssigneeFormOptions, it.checklist_item.assignee_kind)}</span>
                                    {it.checklist_item.page && <Link className="text-info hover:underline" to={`/docs/pages/${it.checklist_item.page.id}`}>{it.checklist_item.page.title}</Link>}
                                    {it.checklist_item.form && <Link className="text-info hover:underline" to={`/docs/forms/${it.checklist_item.form.id}/fill`}>{it.checklist_item.form.name}</Link>}
                                    {it.completed_at && <span>Done {formatDate(it.completed_at)}</span>}
                                    {it.skipped_reason && <span>Skipped: {it.skipped_reason}</span>}
                                </div>
                            </div>
                            {r.can_manage && open && !done && !skipped && <Button size="sm" variant="ghost" onClick={() => { setReason(""); setSkipping(it.id); }}>Skip</Button>}
                        </li>
                    );
                })}
            </ol>
            <Dialog open={!!skipping} onOpenChange={(o) => !item.isPending && !o && setSkipping(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Skip this item?</DialogTitle><DialogDescription>Give a reason so the history stays clear.</DialogDescription></DialogHeader>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Not needed for contractors" aria-label="Reason" autoFocus />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSkipping(null)} disabled={item.isPending}>Cancel</Button>
                        <Button disabled={!reason.trim()} loading={item.isPending} onClick={() => skipping && item.mutate({ id, itemId: skipping, action: "skip", reason: reason.trim() }, { onSuccess: () => setSkipping(null), onError: fail })}>Skip item</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog isOpen={cancelling} onClose={() => setCancelling(false)} title="Cancel this run?" description="Open items are closed. Completed items stay in the history." confirmText="Cancel run" variant="destructive" isLoading={cancel.isPending} onConfirm={() => cancel.mutate(id, { onSuccess: () => { toast({ title: "Run cancelled" }); setCancelling(false); }, onError: fail })} />
        </Page>
    );
}
