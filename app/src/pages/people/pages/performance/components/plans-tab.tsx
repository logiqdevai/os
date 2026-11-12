import { useState } from "react";
import { CircleCheck, LifeBuoy, Plus, Send, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import { useActivatePlan, useAddPlanItem, useClosePlan, useCreatePlan, usePlans, useUpdatePlanItem } from "@/features/people/performance/hooks/use-performance";
import { useEmployees } from "@/features/people/employees/hooks/use-employees";
import type { ImprovementPlan, PipItemStatus } from "@/features/people/performance/interfaces/performance.interfaces";
import { PipCloseOutcomeOptions, PipItemStatusFormOptions, PipItemStatusTone, PipStatusFormOptions, PipStatusTone } from "@/config/constants/dropdowns/people/performance-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Panel, PersonCell } from "../../../components/person";
import { PeoplePaths } from "../../../paths";

const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

/**
 * Improvement plans (PIP): draft → active (shared with the employee) → closed with an outcome note; measurable items evaluated MET / NOT_MET.
 * @perm read employees.performance.read_all (scope) / own once active · manage employees.performance.manage · @api /people/performance/improvement-plans
 */
export function PlansTab() {
    const p = usePermissions();
    const canManage = p.can("employees.performance.manage");
    const { params, setPage } = useListParams();
    const q = usePlans({ page: params.page, limit: 20 });
    const [creating, setCreating] = useState(false);
    return (
        <div className="space-y-3">
            {canManage && <div className="flex justify-end"><Button onClick={() => setCreating(true)}><Plus /> New plan</Button></div>}
            {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.data.length ? (
                <EmptyState icon={LifeBuoy} title="No improvement plans" description="Plans set measurable goals and regular check-ins when performance needs support." />
            ) : (
                <div className="grid items-start gap-3 lg:grid-cols-2">{q.data.data.map((plan) => <PlanCard key={plan.id} plan={plan} canManage={canManage && !plan.is_mine} />)}</div>
            )}
            {q.data && q.data.pagination.total_pages > 1 && <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={!q.data.pagination.has_prev} onClick={() => setPage(q.data!.pagination.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={!q.data.pagination.has_next} onClick={() => setPage(q.data!.pagination.page + 1)}>Next</Button></div>}
            <PlanDialog open={creating} onOpenChange={setCreating} />
        </div>
    );
}

function PlanCard({ plan, canManage }: { plan: ImprovementPlan; canManage: boolean }) {
    const activate = useActivatePlan();
    const updateItem = useUpdatePlanItem();
    const addItem = useAddPlanItem();
    const [closing, setClosing] = useState(false);
    const [newItem, setNewItem] = useState("");
    const open = plan.status === "DRAFT" || plan.status === "ACTIVE";
    const total = plan.items.length;
    return (
        <Panel
            title={<PersonCell name={plan.is_mine ? `${plan.employee.name} (you)` : plan.employee.name} subtitle={plan.title} to={PeoplePaths.employee(plan.employee.id, "performance")} />}
            actions={<Badge variant={PipStatusTone[plan.status]}>{getDropdownOptionLabel(PipStatusFormOptions, plan.status)}</Badge>}
        >
            <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="tabular">{formatDate(plan.start_date, "d MMM")} – {formatDate(plan.end_date, "d MMM yyyy")}</span>
                {plan.check_in_frequency_days && <span>Check-in every {plan.check_in_frequency_days} days</span>}
                {plan.next_check_in_on && <span className={plan.check_in_due ? "text-warning" : undefined}>next {formatDate(plan.next_check_in_on, "d MMM")}</span>}
            </div>
            {plan.reason && <p className="mb-3 whitespace-pre-line text-[13px] text-foreground">{plan.reason}</p>}
            <div className="mb-2 flex items-center gap-2">
                <Progress value={total ? (plan.met_count / total) * 100 : 0} className="h-1.5" />
                <span className="shrink-0 text-xs tabular text-muted-foreground">{plan.met_count}/{total} met</span>
            </div>
            <ul className="divide-y divide-border">
                {plan.items.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
                        <div className="min-w-0 flex-1">
                            <div className="text-[13px] text-foreground">{i.title}</div>
                            {i.due_date && <div className="text-xs text-muted-foreground">due {formatDate(i.due_date, "d MMM")}</div>}
                        </div>
                        {canManage && open ? (
                            <Select value={i.status} onValueChange={(v) => updateItem.mutate({ id: plan.id, itemId: i.id, status: v as PipItemStatus }, { onError: fail("Could not update the item") })}>
                                <SelectTrigger className="h-7 w-28" aria-label={`Status of ${i.title}`}><SelectValue /></SelectTrigger>
                                <SelectContent>{PipItemStatusFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        ) : <Badge variant={PipItemStatusTone[i.status]}>{getDropdownOptionLabel(PipItemStatusFormOptions, i.status)}</Badge>}
                    </li>
                ))}
            </ul>
            {canManage && open && (
                <div className="mt-2 flex gap-2">
                    <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a measurable item" className="h-8" aria-label="New item" />
                    <Button size="sm" variant="outline" disabled={!newItem.trim()} loading={addItem.isPending} onClick={() => addItem.mutate({ id: plan.id, title: newItem.trim() }, { onSuccess: () => setNewItem(""), onError: fail("Could not add the item") })}><Plus /> Add</Button>
                </div>
            )}
            {plan.outcome_note && <p className="mt-3 rounded-md bg-secondary p-2 text-[13px] text-foreground"><span className="text-muted-foreground">Outcome: </span>{plan.outcome_note}</p>}
            {canManage && open && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {plan.status === "DRAFT" && <Button size="sm" loading={activate.isPending} onClick={() => activate.mutate(plan.id, { onSuccess: () => toast({ title: "Plan shared with the employee" }), onError: fail("Could not activate") })}><Send /> Share with employee</Button>}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="sm" variant="outline">Close plan</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setClosing(true)}><CircleCheck /> Close with outcome…</DropdownMenuItem></DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
            <CloseDialog plan={closing ? plan : null} onClose={() => setClosing(false)} />
        </Panel>
    );
}

function CloseDialog({ plan, onClose }: { plan: ImprovementPlan | null; onClose: () => void }) {
    const close = useClosePlan();
    const options = PipCloseOutcomeOptions.filter((o) => plan?.status === "ACTIVE" || o.id === "CANCELLED");
    const [outcome, setOutcome] = useState<(typeof PipCloseOutcomeOptions)[number]["id"]>("COMPLETED_SUCCESSFUL");
    const [note, setNote] = useState("");
    const value = options.some((o) => o.id === outcome) ? outcome : options[0]?.id;
    return (
        <Dialog open={!!plan} onOpenChange={(o) => !o && !close.isPending && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Close improvement plan</DialogTitle><DialogDescription>The outcome note is kept on the plan and shown to the employee.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label>Outcome</Label>
                        <Select value={value} onValueChange={(v) => setOutcome(v as typeof outcome)}><SelectTrigger aria-label="Outcome"><SelectValue /></SelectTrigger><SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="pip-note">Outcome note</Label><Textarea id="pip-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button disabled={note.trim().length < 3 || !value} loading={close.isPending} onClick={() => plan && value && close.mutate({ id: plan.id, outcome: value, outcome_note: note.trim() }, { onSuccess: () => { toast({ title: "Plan closed" }); setNote(""); onClose(); }, onError: fail("Could not close the plan") })}>Close plan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const p = usePermissions();
    const people = useEmployees({ limit: 200, status: "ACTIVE,ON_LEAVE" }, open && p.can("employees.employees.read"));
    const create = useCreatePlan();
    const start = new Date().toISOString().slice(0, 10);
    const [f, setF] = useState({ employee_id: "", title: "", reason: "", start_date: start, end_date: "", every: "14" });
    const [items, setItems] = useState<string[]>([""]);
    const set = (k: keyof typeof f, v: string) => setF((prev) => ({ ...prev, [k]: v }));
    const valid = f.employee_id && f.title.trim() && f.start_date && f.end_date && f.end_date >= f.start_date;
    const reset = () => { setF({ employee_id: "", title: "", reason: "", start_date: start, end_date: "", every: "14" }); setItems([""]); };
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!create.isPending) { onOpenChange(o); if (!o) reset(); } }}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>New improvement plan</DialogTitle><DialogDescription>Saved as a draft. Share it with the employee when it is ready.</DialogDescription></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2"><Label>Employee</Label>
                        <Select value={f.employee_id} onValueChange={(v) => set("employee_id", v)}>
                            <SelectTrigger aria-label="Employee"><SelectValue placeholder={people.isLoading ? "Loading…" : "Pick an employee"} /></SelectTrigger>
                            <SelectContent>{people.data?.data.filter((e) => !e.is_me).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pip-title">Title</Label><Input id="pip-title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Delivery improvement plan" /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pip-reason">Reason</Label><Textarea id="pip-reason" rows={3} value={f.reason} onChange={(e) => set("reason", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="pip-start">Start</Label><Input id="pip-start" type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="pip-end">End</Label><Input id="pip-end" type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="pip-every">Check-in every (days)</Label><Input id="pip-every" type="number" min={1} max={90} value={f.every} onChange={(e) => set("every", e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Measurable items</Label>
                        {items.map((it, i) => (
                            <div key={i} className="flex gap-2">
                                <Input value={it} onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Deliver tickets within estimate" aria-label={`Item ${i + 1}`} />
                                {items.length > 1 && <Button size="icon" variant="ghost" aria-label="Remove item" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 /></Button>}
                            </div>
                        ))}
                        <Button size="sm" variant="ghost" onClick={() => setItems([...items, ""])}><Plus /> Add item</Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}><X /> Cancel</Button>
                    <Button disabled={!valid} loading={create.isPending} onClick={() => create.mutate({
                        employee_id: f.employee_id, title: f.title.trim(), reason: f.reason.trim() || undefined, start_date: f.start_date, end_date: f.end_date,
                        check_in_frequency_days: f.every ? Number(f.every) : undefined, items: items.map((t) => t.trim()).filter(Boolean).map((title) => ({ title })),
                    }, { onSuccess: () => { toast({ title: "Draft plan created" }); onOpenChange(false); reset(); }, onError: fail("Could not create the plan") })}>Create draft</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
