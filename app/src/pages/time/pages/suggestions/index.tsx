import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, CheckCheck, ListChecks, Pencil, RefreshCw, Sparkles, X } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useAcceptSuggestion, useAcceptSuggestions, useDismissSuggestion, useGenerateSuggestions, useSuggestions } from "@/features/time/suggestions/hooks/use-suggestions";
import type { TimeSuggestion } from "@/features/time/suggestions/interfaces/suggestions.interfaces";
import { SuggestionSourceFormOptions } from "@/config/constants/dropdowns/time/time-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatMinutes } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { ActivitySelect, ProjectSelect, TaskSelect, parseDuration, toClock } from "../../components/pickers";

const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null);

/**
 * /time/suggestions — suggested entries from my calendar events (19) and task status changes (06). Review is always
 * required: accept (optionally edited) creates a draft entry; dismiss hides it for good.
 * @perm time.entries.create_own · @api GET /time/suggestions · POST /time/suggestions/generate · POST …/:id/accept|dismiss · POST /time/suggestions/accept
 */
export default function SuggestionsPage() {
    const q = useSuggestions();
    const generate = useGenerateSuggestions();
    const acceptMany = useAcceptSuggestions();
    const [editing, setEditing] = useState<TimeSuggestion | null>(null);
    const scanned = useRef(false);

    // Scan once when the page opens so new meetings and finished tasks show up without a click.
    useEffect(() => {
        if (scanned.current) return;
        scanned.current = true;
        generate.mutate(undefined, { onError: () => undefined });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const list = q.data?.data ?? [];
    const groups = list.reduce<Record<string, TimeSuggestion[]>>((acc, s) => {
        const d = s.date.slice(0, 10);
        (acc[d] ??= []).push(s);
        return acc;
    }, {});

    return (
        <Page>
            <PageHeader
                title="Suggestions"
                description="Time we noticed from your calendar and tasks. Nothing is logged until you accept."
                actions={
                    <>
                        <Button variant="outline" loading={generate.isPending} onClick={() => generate.mutate(undefined, { onSuccess: (r) => toast({ title: r.created ? `${r.created} new suggestion${r.created === 1 ? "" : "s"}` : "No new suggestions" }), onError: fail("Could not scan") })}><RefreshCw /> Scan again</Button>
                        {list.length > 1 && <Button loading={acceptMany.isPending} onClick={() => acceptMany.mutate(list.map((s) => s.id), {
                            onSuccess: (r) => toast({ title: `${r.accepted} entr${r.accepted === 1 ? "y" : "ies"} logged`, description: r.accepted < list.length ? r.results.find((x) => !x.ok)?.error : undefined, variant: r.accepted < list.length ? "destructive" : undefined }),
                            onError: fail("Could not accept"),
                        })}><CheckCheck /> Accept all</Button>}
                    </>
                }
            />
            {q.data && !!list.length && <p className="mb-3 text-xs text-muted-foreground">{list.length} suggestion{list.length === 1 ? "" : "s"} · <span className="tabular text-foreground">{formatMinutes(q.data.totals.minutes)}</span></p>}
            {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !list.length ? (
                <EmptyState icon={Sparkles} title="You're all caught up" description="Meetings you attend and tasks you move to review or done show up here as suggested time." />
            ) : (
                <div className="space-y-5">
                    {Object.entries(groups).map(([day, items]) => (
                        <section key={day}>
                            <h2 className="mb-2 text-[13px] font-medium text-muted-foreground">{formatDate(day, "EEEE, d MMM")}</h2>
                            <ul className="divide-y divide-border rounded-lg border border-border bg-card">{items.map((s) => <SuggestionRow key={s.id} s={s} onEdit={() => setEditing(s)} />)}</ul>
                        </section>
                    ))}
                </div>
            )}
            <EditDialog suggestion={editing} onClose={() => setEditing(null)} />
        </Page>
    );
}

function SuggestionRow({ s, onEdit }: { s: TimeSuggestion; onEdit: () => void }) {
    const accept = useAcceptSuggestion();
    const dismiss = useDismissSuggestion();
    const Icon = s.source === "CALENDAR" ? CalendarDays : ListChecks;
    const range = s.start_at && s.end_at ? `${time(s.start_at)}–${time(s.end_at)}` : null;
    return (
        <li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground"><Icon className="size-4" /></span>
                <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-foreground">{s.description || "Untitled"}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <Badge variant="neutral">{getDropdownOptionLabel(SuggestionSourceFormOptions, s.source)}</Badge>
                        {range && <span className="tabular">{range}</span>}
                        {s.project && <span className="truncate">{s.project.code ? `${s.project.code} · ` : ""}{s.project.name}</span>}
                    </div>
                    {s.rationale && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.rationale}</div>}
                </div>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="text-[13px] font-medium tabular text-foreground">{formatMinutes(s.duration_minutes)}</span>
                <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label="Dismiss" loading={dismiss.isPending} onClick={() => dismiss.mutate(s.id, { onError: fail("Could not dismiss") })}><X /></Button>
                    <Button size="icon" variant="ghost" aria-label="Edit and accept" onClick={onEdit}><Pencil /></Button>
                    <Button size="sm" loading={accept.isPending} onClick={() => accept.mutate({ id: s.id }, { onSuccess: () => toast({ title: "Time logged" }), onError: fail("Could not log the time") })}><Check /> Accept</Button>
                </div>
            </div>
        </li>
    );
}

function EditDialog({ suggestion, onClose }: { suggestion: TimeSuggestion | null; onClose: () => void }) {
    const accept = useAcceptSuggestion();
    const [duration, setDuration] = useState("");
    const [projectId, setProjectId] = useState<string | null>(null);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [activityId, setActivityId] = useState<string | null>(null);
    const [description, setDescription] = useState("");
    useEffect(() => {
        if (!suggestion) return;
        setDuration(toClock(suggestion.duration_minutes));
        setProjectId(suggestion.project_id);
        setTaskId(suggestion.task_id);
        setActivityId(suggestion.activity_type_id);
        setDescription(suggestion.description ?? "");
    }, [suggestion]);
    const minutes = parseDuration(duration);
    return (
        <Dialog open={!!suggestion} onOpenChange={(o) => !o && !accept.isPending && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Edit and accept</DialogTitle><DialogDescription>{suggestion && formatDate(suggestion.date, "EEEE, d MMM")}</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label htmlFor="sg-dur">Duration</Label><Input id="sg-dur" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="1:30" className="w-28" /></div>
                    <div className="space-y-1.5"><Label>Project</Label><ProjectSelect value={projectId} onChange={(v) => { setProjectId(v); setTaskId(null); }} /></div>
                    <div className="space-y-1.5"><Label>Task</Label><TaskSelect projectId={projectId} value={taskId} onChange={setTaskId} /></div>
                    <div className="space-y-1.5"><Label>Activity</Label><ActivitySelect value={activityId} onChange={setActivityId} /></div>
                    <div className="space-y-1.5"><Label htmlFor="sg-desc">Description</Label><Textarea id="sg-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button disabled={!minutes} loading={accept.isPending} onClick={() => suggestion && minutes && accept.mutate({ id: suggestion.id, duration_minutes: minutes, project_id: projectId, task_id: taskId, activity_type_id: activityId, description: description.trim() || null }, {
                        onSuccess: () => { toast({ title: "Time logged" }); onClose(); },
                        onError: fail("Could not log the time"),
                    })}>Accept</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
