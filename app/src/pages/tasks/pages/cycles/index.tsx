import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, RefreshCw } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { useCreateCycle, useCycles, useWorkflows } from "@/features/tasks/hooks/use-tasks";
import { cycleFormSchema, type CycleFormValues } from "@/features/tasks/validation-schemas/tasks.schema";
import { CycleStatusFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { ProgressBar } from "@/components/ui/progress-bar";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * /tasks/cycles?team= — sprints per team with progress.
 * @perm VIEW tasks.tasks.read · create tasks.cycles.manage · @api GET/POST /cycles
 */
export default function CyclesPage() {
    const { params, setPage, filters, setFilter } = useListParams({ limit: 30 });
    const workflows = useWorkflows();
    const cycles = useCycles(params);
    const [open, setOpen] = useState(false);
    const teams = (workflows.data ?? []).filter((w) => w.team).map((w) => w.team!);
    const pg = cycles.data?.pagination;

    return (
        <Page>
            <PageHeader
                title="Cycles"
                description="Time-boxed sprints. Completing a cycle carries unfinished work over."
                actions={<Can permission="tasks.cycles.manage"><Button onClick={() => setOpen(true)}><Plus /> New cycle</Button></Can>}
            />
            <div className="mb-3 flex flex-wrap gap-2">
                <Select value={filters.team_id ?? "all"} onValueChange={(v) => setFilter("team_id", v)}>
                    <SelectTrigger className="h-8 w-44" aria-label="Team"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All teams</SelectItem>
                        {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            {cycles.isPending ? <ListSkeleton /> : cycles.error ? <ErrorState error={cycles.error} onRetry={() => cycles.refetch()} /> : !cycles.data.data.length ? (
                <div className="rounded-lg border border-border bg-card"><EmptyState icon={RefreshCw} title="No cycles yet" description="Plan one- or two-week cycles to focus the team." /></div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {cycles.data.data.map((c) => (
                        <Link key={c.id} to={`/tasks/cycles/${c.id}`} className="space-y-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="truncate text-[13px] font-medium text-foreground">{c.name ?? `Cycle ${c.number}`}</div>
                                    <div className="text-xs text-muted-foreground">{c.team?.name ?? "No team"} · {formatDate(c.starts_at, "d MMM")} – {formatDate(c.ends_at, "d MMM")}</div>
                                </div>
                                <Badge variant={c.status === "ACTIVE" ? "info" : c.status === "COMPLETED" ? "success" : "neutral"}>{getDropdownOptionLabel(CycleStatusFormOptions, c.status)}</Badge>
                            </div>
                            {c.goal && <p className="line-clamp-2 text-xs text-muted-foreground">{c.goal}</p>}
                            <div className="flex items-center gap-3">
                                <ProgressBar value={c.progress.percent} tone={c.status === "COMPLETED" ? "success" : "default"} />
                                <span className="shrink-0 text-xs tabular text-muted-foreground">{c.progress.done}/{c.progress.total} · {c.progress.percent}%</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
            {pg && pg.total_pages > 1 && <div className="mt-3 flex justify-center gap-2"><Button variant="outline" size="sm" disabled={pg.page <= 1} onClick={() => setPage(pg.page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={pg.page >= pg.total_pages} onClick={() => setPage(pg.page + 1)}>Next</Button></div>}
            <CycleDialog open={open} onOpenChange={setOpen} teams={teams} defaultTeam={filters.team_id ?? teams[0]?.id ?? ""} />
        </Page>
    );
}

function CycleDialog({ open, onOpenChange, teams, defaultTeam }: { open: boolean; onOpenChange: (o: boolean) => void; teams: { id: string; name: string }[]; defaultTeam: string }) {
    const create = useCreateCycle();
    const form = useForm<CycleFormValues>({ resolver: zodResolver(cycleFormSchema) });
    useEffect(() => {
        if (open) {
            const start = new Date();
            form.reset({ team_id: defaultTeam, name: "", goal: "", starts_at: iso(start), ends_at: iso(new Date(start.getTime() + 13 * 86_400_000)) });
        }
    }, [open, defaultTeam, form]);
    const submit = form.handleSubmit((v) => create.mutate({ ...v, name: v.name || undefined, goal: v.goal || undefined }, { onSuccess: () => onOpenChange(false) }));
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>New cycle</DialogTitle><DialogDescription>Cycles are numbered per team.</DialogDescription></DialogHeader>
                        <FormField control={form.control} name="team_id" render={({ field }) => (
                            <FormItem><FormLabel>Team</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Team"><SelectValue placeholder="Choose a team" /></SelectTrigger></FormControl>
                                    <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="starts_at" render={({ field }) => (
                                <FormItem><FormLabel>Starts</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="ends_at" render={({ field }) => (
                                <FormItem><FormLabel>Ends</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Name (optional)</FormLabel><FormControl><Input placeholder="Cycle 12" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="goal" render={({ field }) => (
                            <FormItem><FormLabel>Goal</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" loading={create.isPending}>Create cycle</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
