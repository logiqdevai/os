import { useMemo, useState } from "react";
import { MessageSquareQuote, Send } from "lucide-react";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermissions } from "@/hooks/use-permission";
import {
    useCancelFeedbackRequest, useCreateFeedbackRequests, useDeclineFeedbackRequest, useFeedbackRequests, useSubmitFeedbackRequest,
} from "@/features/people/performance/hooks/use-performance";
import { useMyEmployee, useOrgChart } from "@/features/people/employees/hooks/use-employees";
import type { FeedbackRequest } from "@/features/people/performance/interfaces/performance.interfaces";
import { FeedbackRequestBoxOptions, FeedbackRequestStatusFormOptions, FeedbackRequestStatusTone } from "@/config/constants/dropdowns/people/performance-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { PersonCell } from "../../../components/person";

const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

/**
 * Feedback requests (360 / peer): ask colleagues for feedback about someone; recipients answer or decline.
 * @perm read_own / read_all / manage · request: performance.manage over the employee, or the employee about themselves
 * @api GET/POST /people/performance/feedback-requests · POST …/:id/submit|decline|cancel
 */
export function RequestsTab() {
    const p = usePermissions();
    const { params, setPage, filters, setFilter } = useListParams();
    const box = (filters.box as "inbox" | "sent" | "all") ?? "inbox";
    const q = useFeedbackRequests({ page: params.page, limit: 25, box });
    const cancel = useCancelFeedbackRequest();
    const [answering, setAnswering] = useState<FeedbackRequest | null>(null);
    const [asking, setAsking] = useState(false);
    const boxes = FeedbackRequestBoxOptions.filter((o) => o.id !== "all" || p.can("employees.performance.read_all"));
    const columns: DataTableColumn<FeedbackRequest>[] = [
        { key: "about", header: "About", cell: (r) => <PersonCell name={r.employee.name} subtitle={r.cycle?.name ?? r.review?.title ?? r.employee.job_title} /> },
        { key: "from", header: box === "inbox" ? "Asked by" : "Asked", cell: (r) => <span className="text-[13px]">{box === "inbox" ? (r.requested_by ? personName(r.requested_by.user) : "—") : personName(r.requested_from.user)}</span>, hideBelow: "sm" },
        { key: "due", header: "Due", cell: (r) => <span className={r.overdue ? "tabular text-danger" : "tabular"}>{formatDate(r.due_date, "d MMM")}</span>, hideBelow: "md" },
        { key: "status", header: "Status", cell: (r) => <span className="flex flex-wrap gap-1"><Badge variant={FeedbackRequestStatusTone[r.status]}>{getDropdownOptionLabel(FeedbackRequestStatusFormOptions, r.status)}</Badge>{r.is_anonymous && <Badge variant="neutral">Anonymous</Badge>}</span> },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-24",
            cell: (r) => r.status === "PENDING" && (r.is_recipient
                ? <Button size="sm" onClick={() => setAnswering(r)}>Answer</Button>
                : r.is_requester && <Button size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === r.id} onClick={() => cancel.mutate(r.id, { onSuccess: () => toast({ title: "Request cancelled" }), onError: fail("Could not cancel") })}>Cancel</Button>),
        },
    ];
    return (
        <div className="space-y-3">
            <TableToolbar>
                <Select value={box} onValueChange={(v) => setFilter("box", v === "inbox" ? null : v)}>
                    <SelectTrigger className="h-8 w-full sm:w-48" aria-label="Which requests"><SelectValue /></SelectTrigger>
                    <SelectContent>{boxes.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button className="sm:ml-auto" onClick={() => setAsking(true)}><Send /> Request feedback</Button>
            </TableToolbar>
            <DataTable columns={columns} data={q.data?.data} rowKey={(r) => r.id} loading={q.isFetching} error={q.error} onRetry={() => q.refetch()} pagination={q.data?.pagination} onPageChange={setPage}
                onRowClick={(r) => r.is_recipient && r.status === "PENDING" && setAnswering(r)}
                empty={{ icon: MessageSquareQuote, title: box === "inbox" ? "Nothing asked of you" : "No requests", description: "Ask colleagues for feedback about yourself or, as a manager, about your reports." }} />
            <AnswerDialog request={answering} onClose={() => setAnswering(null)} />
            <AskDialog open={asking} onOpenChange={setAsking} />
        </div>
    );
}

function AnswerDialog({ request, onClose }: { request: FeedbackRequest | null; onClose: () => void }) {
    const submit = useSubmitFeedbackRequest();
    const decline = useDeclineFeedbackRequest();
    const [body, setBody] = useState("");
    const [rating, setRating] = useState("");
    const busy = submit.isPending || decline.isPending;
    const done = (title: string) => ({ onSuccess: () => { toast({ title }); setBody(""); setRating(""); onClose(); }, onError: fail("Could not save") });
    return (
        <Dialog open={!!request} onOpenChange={(o) => !o && !busy && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Feedback about {request?.employee.name}</DialogTitle>
                    <DialogDescription>{request?.is_anonymous ? "Your name is hidden from the employee (HR can still see it)." : "Your name is shown with the feedback."}</DialogDescription>
                </DialogHeader>
                {request?.message && <p className="rounded-md bg-secondary p-3 text-[13px] text-foreground">“{request.message}”</p>}
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label htmlFor="fr-body">Your feedback</Label><Textarea id="fr-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What went well, what could be better…" /></div>
                    <div className="space-y-1.5"><Label htmlFor="fr-rating">Rating (optional, 1–5)</Label><Input id="fr-rating" type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} className="w-24" /></div>
                </div>
                <DialogFooter>
                    <Button variant="outline" loading={decline.isPending} disabled={busy} onClick={() => request && decline.mutate({ id: request.id }, done("Request declined"))}>Decline</Button>
                    <Button disabled={!body.trim() || busy} loading={submit.isPending} onClick={() => request && submit.mutate({ id: request.id, body: body.trim(), rating: rating ? Number(rating) : undefined }, done("Feedback sent"))}>Send feedback</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Pick the employee (yourself, or someone you manage) and the colleagues to ask. Colleagues come from the directory (org chart). */
function AskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const p = usePermissions();
    const canManage = p.can("employees.performance.manage");
    const me = useMyEmployee(open);
    const chart = useOrgChart(open);
    const create = useCreateFeedbackRequests();
    const [aboutId, setAboutId] = useState("");
    const [search, setSearch] = useState("");
    const [picked, setPicked] = useState<string[]>([]);
    const [due, setDue] = useState("");
    const [message, setMessage] = useState("");
    const [anonymous, setAnonymous] = useState(false);
    const about = aboutId || (!canManage ? me.data?.id ?? "" : "");
    const aboutNode = chart.data?.find((n) => n.id === about);
    const colleagues = useMemo(() => (chart.data ?? []).filter((n) => n.id !== about && (!search || n.name.toLowerCase().includes(search.toLowerCase()))).slice(0, 50), [chart.data, about, search]);
    const reset = () => { setAboutId(""); setPicked([]); setDue(""); setMessage(""); setAnonymous(false); setSearch(""); };
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!create.isPending) { onOpenChange(o); if (!o) reset(); } }}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogHeader><DialogTitle>Request feedback</DialogTitle><DialogDescription>Each colleague gets a request in their inbox.</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label>About</Label>
                        <Select value={about} onValueChange={(v) => { setAboutId(v); setPicked([]); }}>
                            <SelectTrigger aria-label="About"><SelectValue placeholder="Pick a person" /></SelectTrigger>
                            <SelectContent>
                                {me.data && <SelectItem value={me.data.id}>Myself</SelectItem>}
                                {canManage && chart.data?.filter((n) => !n.is_me).map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="ask-search">Ask colleagues ({picked.length})</Label>
                        <Input id="ask-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" />
                        <ul className="max-h-48 overflow-y-auto rounded-md border border-border">
                            {colleagues.map((n) => (
                                <li key={n.id}>
                                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-accent">
                                        <Checkbox checked={picked.includes(n.membership_id)} onCheckedChange={(on) => setPicked(on ? [...picked, n.membership_id] : picked.filter((x) => x !== n.membership_id))} />
                                        <PersonCell name={n.name} photoUrl={n.photo_url} subtitle={n.job_title ?? undefined} />
                                    </label>
                                </li>
                            ))}
                            {!colleagues.length && <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>}
                        </ul>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label htmlFor="ask-due">Due date</Label><Input id="ask-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
                        <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-foreground"><Switch checked={anonymous} onCheckedChange={setAnonymous} /> Anonymous answers</label>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="ask-msg">Message</Label><Textarea id="ask-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={aboutNode ? `What should people comment on about ${aboutNode.name}?` : undefined} /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button disabled={!about || !picked.length} loading={create.isPending} onClick={() => create.mutate({ employee_id: about, requested_from_membership_ids: picked, due_date: due || undefined, message: message.trim() || undefined, is_anonymous: anonymous }, {
                        onSuccess: (r) => { toast({ title: `${r.created} request${r.created === 1 ? "" : "s"} sent`, description: r.already_pending ? `${r.already_pending} already had a pending request.` : undefined }); onOpenChange(false); reset(); },
                        onError: fail("Could not send the requests"),
                    })}>Send</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
