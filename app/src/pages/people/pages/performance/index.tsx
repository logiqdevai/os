import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Plus, Rocket, Star, Target } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import {
    useAddFeedback, useAddGoalUpdate, useCreateCycle, useCreateGoal, useCycles, useFeedback, useGoals, useLaunchCycle, useReviews,
} from "@/features/people/performance/hooks/use-performance";
import { useEmployees, useMyEmployee } from "@/features/people/employees/hooks/use-employees";
import type { FeedbackKind, Goal, Review, ReviewCycle, ReviewType } from "@/features/people/performance/interfaces/performance.interfaces";
import {
    CycleStatusFormOptions, CycleStatusTone, FeedbackKindFormOptions, FeedbackVisibilityFormOptions, GoalStatusFormOptions, GoalStatusTone, ReviewStatusFilterOptions,
    ReviewStatusFormOptions, ReviewStatusTone, ReviewTypeFormOptions,
} from "@/config/constants/dropdowns/people/performance-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatNumber, formatRelative, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { PersonCell } from "../../components/person";
import { PeoplePaths } from "../../paths";

const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

/**
 * /people/performance — reviews, cycles (performance.manage), goals and feedback.
 * @perm employees.performance.read_own / read_all (scope) / manage · @api /people/performance/*
 */
export default function PerformancePage() {
    const p = usePermissions();
    const { filters, setFilter } = useListParams();
    const tabs = [
        { id: "reviews", label: "Reviews" },
        ...(p.canAny("employees.performance.read_all", "employees.performance.manage") ? [{ id: "cycles", label: "Cycles" }] : []),
        { id: "goals", label: "Goals" },
        { id: "feedback", label: "Feedback" },
    ];
    const tab = tabs.find((t) => t.id === filters.tab)?.id ?? "reviews";
    return (
        <Page>
            <PageHeader title="Performance" description="Review cycles, goals and feedback." />
            <Tabs value={tab} onValueChange={(v) => setFilter("tab", v === "reviews" ? null : v)} className="mb-3">
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"><TabsList className="w-max">{tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList></div>
            </Tabs>
            {tab === "reviews" && <ReviewsTab />}
            {tab === "cycles" && <CyclesTab />}
            {tab === "goals" && <GoalsTab />}
            {tab === "feedback" && <FeedbackTab />}
        </Page>
    );
}

function ReviewsTab() {
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const q = useReviews({ ...params, tab: undefined });
    const columns: DataTableColumn<Review>[] = [
        { key: "employee", header: "Employee", cell: (r) => <PersonCell name={r.is_mine ? `${r.employee.name} (you)` : r.employee.name} subtitle={r.employee.job_title} /> },
        { key: "title", header: "Review", cell: (r) => r.title ?? r.cycle?.name ?? getDropdownOptionLabel(ReviewTypeFormOptions, r.type), hideBelow: "sm" },
        { key: "reviewer", header: "Reviewer", cell: (r) => (r.reviewer ? personName(r.reviewer.user) : "—"), hideBelow: "lg" },
        { key: "due", header: "Due", cell: (r) => <span className="tabular">{formatDate(r.due_date)}</span>, hideBelow: "md" },
        { key: "rating", header: "Rating", cell: (r) => (r.overall_rating ? <span className="tabular">{formatNumber(r.overall_rating, 1)} / {r.rating_scale_max}</span> : "—"), hideBelow: "md" },
        { key: "status", header: "Status", cell: (r) => <Badge variant={ReviewStatusTone[r.status]}>{getDropdownOptionLabel(ReviewStatusFormOptions, r.status)}</Badge> },
    ];
    return (
        <>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search employee…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{ReviewStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable columns={columns} data={q.data?.data} rowKey={(r) => r.id} loading={q.isFetching} error={q.error} onRetry={() => q.refetch()} pagination={q.data?.pagination} onPageChange={setPage}
                onRowClick={(r) => navigate(PeoplePaths.review(r.id))} empty={{ icon: Star, title: "No reviews", description: "Reviews appear here when a cycle is launched." }} />
        </>
    );
}

function CyclesTab() {
    const p = usePermissions();
    const { params, setPage } = useListParams();
    const q = useCycles({ page: params.page });
    const launch = useLaunchCycle();
    const [creating, setCreating] = useState(false);
    const columns: DataTableColumn<ReviewCycle>[] = [
        { key: "name", header: "Cycle", cell: (c) => <div><div className="font-medium text-foreground">{c.name}</div><div className="text-xs text-muted-foreground">{getDropdownOptionLabel(ReviewTypeFormOptions, c.type)}</div></div> },
        { key: "period", header: "Period", cell: (c) => <span className="tabular">{formatDate(c.period_start, "d MMM")} – {formatDate(c.period_end, "d MMM yyyy")}</span>, hideBelow: "md" },
        { key: "progress", header: "Completed", cell: (c) => <div className="flex min-w-24 items-center gap-2"><Progress value={c.review_count ? (c.completed_count / c.review_count) * 100 : 0} className="h-1.5" /><span className="text-xs tabular text-muted-foreground">{c.completed_count}/{c.review_count}</span></div>, hideBelow: "sm" },
        { key: "status", header: "Status", cell: (c) => <Badge variant={CycleStatusTone[c.status]}>{getDropdownOptionLabel(CycleStatusFormOptions, c.status)}</Badge> },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-24",
            cell: (c) => p.can("employees.performance.manage") && ["PLANNED", "ACTIVE"].includes(c.status) && (
                <Button size="sm" variant="outline" loading={launch.isPending} onClick={() => launch.mutate(c.id, { onSuccess: (r) => toast({ title: r.launched ? `${r.launched} review(s) created` : "Everyone already has a review" }), onError: fail("Could not launch") })}><Rocket /> Launch</Button>
            ),
        },
    ];
    return (
        <>
            {p.can("employees.performance.manage") && <div className="mb-3 flex justify-end"><Button onClick={() => setCreating(true)}><Plus /> New cycle</Button></div>}
            <DataTable columns={columns} data={q.data?.data} rowKey={(c) => c.id} loading={q.isFetching} error={q.error} onRetry={() => q.refetch()} pagination={q.data?.pagination} onPageChange={setPage}
                empty={{ icon: Star, title: "No review cycles", description: "Create a cycle, then launch it to create one review per employee." }} />
            <CycleDialog open={creating} onOpenChange={setCreating} />
        </>
    );
}

function CycleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateCycle();
    const y = new Date().getFullYear();
    const [name, setName] = useState(`H2 ${y}`);
    const [type, setType] = useState<ReviewType>("SEMI_ANNUAL");
    const [start, setStart] = useState(`${y}-07-01`);
    const [end, setEnd] = useState(`${y}-12-31`);
    const [due, setDue] = useState("");
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>New review cycle</DialogTitle><DialogDescription>Uses the default criteria: delivery, collaboration, ownership, growth.</DialogDescription></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cy-name">Name</Label><Input id="cy-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label>Type</Label>
                        <Select value={type} onValueChange={(v) => setType(v as ReviewType)}><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger><SelectContent>{ReviewTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="cy-start">Period start</Label><Input id="cy-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="cy-end">Period end</Label><Input id="cy-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cy-due">Due date</Label><Input id="cy-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!name.trim() || !start || !end || end < start} loading={create.isPending} onClick={() => create.mutate({ name: name.trim(), type, period_start: start, period_end: end, due_date: due || undefined }, { onSuccess: () => { toast({ title: "Cycle created" }); onOpenChange(false); }, onError: fail("Could not create cycle") })}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function GoalsTab() {
    const p = usePermissions();
    const { params, setPage } = useListParams();
    const q = useGoals({ page: params.page, limit: 25 });
    const [creating, setCreating] = useState(false);
    const [updating, setUpdating] = useState<Goal | null>(null);
    const canCreate = p.canAny("employees.performance.manage", "employees.performance.read_own");
    return (
        <div className="space-y-3">
            {canCreate && <div className="flex justify-end"><Button onClick={() => setCreating(true)}><Plus /> New goal</Button></div>}
            {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.data.length ? (
                <EmptyState icon={Target} title="No goals yet" description="Set goals and key results and track progress with check-ins." />
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {q.data.data.map((g) => (
                        <div key={g.id} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0"><div className="truncate font-medium text-foreground">{g.title}</div><div className="text-xs text-muted-foreground">{g.is_mine ? "You" : g.employee.name}{g.due_date ? ` · due ${formatDate(g.due_date)}` : ""}</div></div>
                                <Badge variant={GoalStatusTone[g.status]}>{getDropdownOptionLabel(GoalStatusFormOptions, g.status)}</Badge>
                            </div>
                            <div className="mt-3 flex items-center gap-2"><Progress value={Number(g.progress_percent)} className="h-1.5" /><span className="text-xs tabular text-muted-foreground">{formatNumber(g.progress_percent)}%</span></div>
                            {g.updates[0]?.note && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">“{g.updates[0].note}” · {formatRelative(g.updates[0].created_at)}</p>}
                            <div className="mt-3 flex justify-end"><Button size="sm" variant="outline" onClick={() => setUpdating(g)}>Check in</Button></div>
                        </div>
                    ))}
                </div>
            )}
            {q.data && q.data.pagination.total_pages > 1 && <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={!q.data.pagination.has_prev} onClick={() => setPage(q.data!.pagination.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={!q.data.pagination.has_next} onClick={() => setPage(q.data!.pagination.page + 1)}>Next</Button></div>}
            <GoalDialog open={creating} onOpenChange={setCreating} />
            <CheckInDialog goal={updating} onClose={() => setUpdating(null)} />
        </div>
    );
}

/** Goal for myself (read_own) or, with performance.manage, for someone in scope. */
function GoalDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const p = usePermissions();
    const canManage = p.can("employees.performance.manage");
    const me = useMyEmployee(open);
    const people = useEmployees({ limit: 200, status: "ACTIVE,ONBOARDING,ON_LEAVE" }, open && canManage && p.can("employees.employees.read"));
    const create = useCreateGoal();
    const [employeeId, setEmployeeId] = useState("");
    const [title, setTitle] = useState("");
    const [due, setDue] = useState("");
    const target = employeeId || me.data?.id || "";
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!create.isPending) { onOpenChange(o); setTitle(""); setDue(""); } }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>New goal</DialogTitle><DialogDescription>Progress is tracked with check-ins.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    {canManage && !!people.data?.data.length && (
                        <div className="space-y-1.5"><Label>Employee</Label>
                            <Select value={target} onValueChange={setEmployeeId}><SelectTrigger aria-label="Employee"><SelectValue placeholder="Pick an employee" /></SelectTrigger>
                                <SelectContent>{people.data.data.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}{e.is_me ? " (you)" : ""}</SelectItem>)}</SelectContent></Select>
                        </div>
                    )}
                    <div className="space-y-1.5"><Label htmlFor="goal-title">Goal</Label><Input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ship the client portal v2" /></div>
                    <div className="space-y-1.5"><Label htmlFor="goal-due">Due date</Label><Input id="goal-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!title.trim() || !target} loading={create.isPending} onClick={() => create.mutate({ employee_id: target, title: title.trim(), due_date: due || undefined }, { onSuccess: () => { toast({ title: "Goal created" }); onOpenChange(false); setTitle(""); }, onError: fail("Could not create goal") })}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CheckInDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
    const update = useAddGoalUpdate();
    const [progress, setProgress] = useState("");
    const [note, setNote] = useState("");
    return (
        <Dialog open={!!goal} onOpenChange={(o) => { if (!o) { onClose(); setProgress(""); setNote(""); } }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Check in: {goal?.title}</DialogTitle><DialogDescription>Currently {formatNumber(goal?.progress_percent)}% done.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label htmlFor="ci-progress">Progress (%)</Label><Input id="ci-progress" type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="ci-note">Note</Label><Textarea id="ci-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button disabled={progress === "" && !note.trim()} loading={update.isPending} onClick={() => goal && update.mutate({ id: goal.id, progress_percent: progress === "" ? undefined : Math.min(100, Math.max(0, Number(progress))), note: note || undefined }, { onSuccess: () => { toast({ title: "Check-in saved" }); onClose(); setProgress(""); setNote(""); }, onError: fail("Could not save check-in") })}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function FeedbackTab() {
    const p = usePermissions();
    const { params, setPage } = useListParams();
    const q = useFeedback({ page: params.page, limit: 25 });
    const [open, setOpen] = useState(false);
    return (
        <div className="space-y-3">
            <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Award /> Give feedback</Button></div>
            {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.data.length ? (
                <EmptyState icon={Award} title="No feedback yet" description="Recognize a colleague or share peer feedback." />
            ) : (
                <ul className="space-y-3">
                    {q.data.data.map((f) => (
                        <li key={f.id} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant={f.kind === "RECOGNITION" ? "success" : "neutral"}>{getDropdownOptionLabel(FeedbackKindFormOptions, f.kind)}</Badge>
                                <span className="text-[13px] text-foreground">for {f.employee.name}</span>
                                <span className="text-xs text-muted-foreground">· {getDropdownOptionLabel(FeedbackVisibilityFormOptions, f.visibility)}</span>
                            </div>
                            {f.title && <div className="mt-2 text-[13px] font-medium text-foreground">{f.title}</div>}
                            <p className="mt-1 whitespace-pre-line text-[13px] text-foreground">{f.body}</p>
                            <div className="mt-2 text-xs text-muted-foreground">{f.author ? personName(f.author.user) : "Anonymous"} · {formatRelative(f.created_at)}</div>
                        </li>
                    ))}
                </ul>
            )}
            {q.data && q.data.pagination.total_pages > 1 && <div className="flex justify-end"><Button variant="outline" size="sm" disabled={!q.data.pagination.has_next} onClick={() => setPage(q.data!.pagination.page + 1)}>More</Button></div>}
            <FeedbackDialog open={open} onOpenChange={setOpen} canManage={p.can("employees.performance.manage")} />
        </div>
    );
}

function FeedbackDialog({ open, onOpenChange, canManage }: { open: boolean; onOpenChange: (o: boolean) => void; canManage: boolean }) {
    const p = usePermissions();
    const people = useEmployees({ limit: 200, status: "ACTIVE,ONBOARDING,ON_LEAVE" }, open && p.can("employees.employees.read"));
    const add = useAddFeedback();
    const [employeeId, setEmployeeId] = useState("");
    const [kind, setKind] = useState<FeedbackKind>("RECOGNITION");
    const [body, setBody] = useState("");
    const kinds = FeedbackKindFormOptions.filter((k) => canManage || !["MANAGER_FEEDBACK", "PERFORMANCE_NOTE"].includes(k.id));
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!add.isPending) { onOpenChange(o); setBody(""); } }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Give feedback</DialogTitle><DialogDescription>Recognition is public; manager notes stay with managers.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label>About</Label>
                        <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger aria-label="Employee"><SelectValue placeholder={people.data ? "Pick a colleague" : "Employee list needs HR access"} /></SelectTrigger>
                            <SelectContent>{people.data?.data.filter((e) => !e.is_me).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-1.5"><Label>Kind</Label>
                        <Select value={kind} onValueChange={(v) => setKind(v as FeedbackKind)}><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger><SelectContent>{kinds.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="fb-body">Feedback</Label><Textarea id="fb-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!employeeId || !body.trim()} loading={add.isPending} onClick={() => add.mutate({ employee_id: employeeId, kind, body: body.trim() }, { onSuccess: () => { toast({ title: "Feedback shared" }); onOpenChange(false); setBody(""); }, onError: fail("Could not share feedback") })}>Share</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
