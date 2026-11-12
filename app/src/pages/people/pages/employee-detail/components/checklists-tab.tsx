import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, ExternalLink, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { useAvailableChecklists, useChecklistRuns, useSetChecklistItem, useStartChecklist } from "@/features/people/employees/hooks/use-employees";
import type { ChecklistKind, EmployeeChecklistRun, EmployeeDetail } from "@/features/people/employees/interfaces/employees.interfaces";
import { ChecklistAssigneeFormOptions, ChecklistKindFormOptions, ChecklistRunStatusFormOptions, ChecklistRunStatusTone } from "@/config/constants/dropdowns/people/employee-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Panel } from "../../../components/person";

/**
 * Profile tab "Onboarding" — checklist runs (15 Business Docs) of the employee with progress.
 * @perm read: employees.employees.read (own: employees.directory.read) · start onboarding employees.employees.update, offboarding employees.employees.offboard
 * @api GET/POST /people/employees/:id/checklist-runs · POST …/items/:itemId/complete|reopen · GET /people/checklists?kind=
 */
export function ChecklistsTab({ e }: { e: EmployeeDetail }) {
    const p = usePermissions();
    const q = useChecklistRuns(e.id);
    const [starting, setStarting] = useState<ChecklistKind | null>(null);
    const canOnboard = !e.is_me && p.can("employees.employees.update");
    const canOffboard = !e.is_me && p.can("employees.employees.offboard");
    const actions = (
        <div className="flex flex-wrap gap-2">
            {canOnboard && <Button size="sm" variant="outline" onClick={() => setStarting("ONBOARDING")}><Plus /> Onboarding checklist</Button>}
            {canOffboard && ["OFFBOARDING", "ACTIVE", "ON_LEAVE"].includes(e.employment_status) && <Button size="sm" variant="outline" onClick={() => setStarting("OFFBOARDING")}><Plus /> Offboarding checklist</Button>}
        </div>
    );
    return (
        <div className="space-y-4">
            {(canOnboard || canOffboard) && <div className="flex justify-end">{actions}</div>}
            {q.isLoading ? <ListSkeleton rows={4} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
                <EmptyState icon={ClipboardList} title="No checklists yet" description="Onboarding and offboarding checklists start automatically on hire and offboarding, or start one here." />
            ) : (
                <div className="grid items-start gap-4 lg:grid-cols-2">{q.data.map((run) => <RunCard key={run.id} run={run} employeeId={e.id} />)}</div>
            )}
            <StartDialog employee={e} kind={starting} onClose={() => setStarting(null)} />
        </div>
    );
}

function RunCard({ run, employeeId }: { run: EmployeeChecklistRun; employeeId: string }) {
    const toggle = useSetChecklistItem();
    const [busy, setBusy] = useState<string | null>(null);
    const open = run.status === "IN_PROGRESS" || run.status === "NOT_STARTED";
    return (
        <Panel
            title={<span className="flex flex-wrap items-center gap-2">{run.checklist.name}<Badge variant="neutral">{getDropdownOptionLabel(ChecklistKindFormOptions, run.checklist.kind)}</Badge></span>}
            actions={<Badge variant={ChecklistRunStatusTone[run.status]}>{getDropdownOptionLabel(ChecklistRunStatusFormOptions, run.status)}</Badge>}
        >
            <div className="mb-3 flex items-center gap-2">
                <Progress value={run.progress_percent} className="h-1.5" />
                <span className="shrink-0 text-xs tabular text-muted-foreground">{run.done_count}/{run.total_count}</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {run.started_at && <span>Started {formatDate(run.started_at)}</span>}
                {run.due_at && <span>Due {formatDate(run.due_at)}</span>}
                {run.completed_at && <span>Completed {formatDate(run.completed_at)}</span>}
                {run.overdue_count > 0 && <span className="text-danger">{run.overdue_count} overdue</span>}
            </div>
            <ul className="space-y-1">
                {run.items.map((i) => {
                    const done = i.status === "COMPLETED" || i.status === "SKIPPED";
                    return (
                        <li key={i.id} className="flex items-start gap-2.5 rounded-md px-1 py-1.5">
                            <Checkbox
                                className="mt-0.5"
                                checked={done}
                                disabled={!i.can_complete || !open || i.status === "SKIPPED" || busy === i.id}
                                aria-label={`${done ? "Reopen" : "Complete"} ${i.checklist_item.title}`}
                                onCheckedChange={(v) => {
                                    setBusy(i.id);
                                    toggle.mutate({ id: employeeId, runId: run.id, itemId: i.id, done: !!v }, {
                                        onError: (err) => toast({ variant: "destructive", title: "Could not update the item", description: getApiErrorMessage(err) }),
                                        onSettled: () => setBusy(null),
                                    });
                                }}
                            />
                            <div className="min-w-0 flex-1">
                                <div className={cn("text-[13px] text-foreground", done && "text-muted-foreground line-through")}>{i.checklist_item.title}{!i.checklist_item.is_required && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}</div>
                                <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                                    <span>{getDropdownOptionLabel(ChecklistAssigneeFormOptions, i.checklist_item.assignee_kind)}</span>
                                    {i.due_on && !done && <span className={cn(i.overdue && "text-danger")}>due {formatDate(i.due_on, "d MMM")}</span>}
                                    {i.status === "SKIPPED" && <span>skipped{i.skipped_reason ? `: ${i.skipped_reason}` : ""}</span>}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className="mt-3 flex justify-end">
                <Button size="sm" variant="ghost" asChild><Link to={`/docs/checklist-runs/${run.id}`}><ExternalLink /> Open in Docs</Link></Button>
            </div>
        </Panel>
    );
}

function StartDialog({ employee, kind, onClose }: { employee: EmployeeDetail; kind: ChecklistKind | null; onClose: () => void }) {
    const list = useAvailableChecklists(kind ?? "ONBOARDING", !!kind);
    const start = useStartChecklist();
    const [checklistId, setChecklistId] = useState("");
    const [due, setDue] = useState("");
    const close = () => { if (!start.isPending) { onClose(); setChecklistId(""); setDue(""); } };
    return (
        <Dialog open={!!kind} onOpenChange={(o) => !o && close()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Start {kind === "OFFBOARDING" ? "offboarding" : "onboarding"} checklist</DialogTitle>
                    <DialogDescription>For {employee.name}. Checklists are defined in Docs → Checklists.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Checklist</Label>
                        <Select value={checklistId} onValueChange={setChecklistId}>
                            <SelectTrigger aria-label="Checklist"><SelectValue placeholder={list.isLoading ? "Loading…" : list.data?.length ? "Pick a checklist" : "No active checklists"} /></SelectTrigger>
                            <SelectContent>{list.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c._count.items} steps</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="cl-due">Due date (optional)</Label><Input id="cl-due" type="date" value={due} onChange={(ev) => setDue(ev.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={close}>Cancel</Button>
                    <Button disabled={!checklistId} loading={start.isPending} onClick={() => start.mutate({ id: employee.id, checklist_id: checklistId, due_at: due || undefined }, {
                        onSuccess: () => { toast({ title: "Checklist started" }); close(); },
                        onError: (err) => toast({ variant: "destructive", title: "Could not start the checklist", description: getApiErrorMessage(err) }),
                    })}>Start</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
