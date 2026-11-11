import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, LifeBuoy, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { formatDate, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { PortalPriorityOptions, PortalRequestStateOptions, PortalRequestTypeOptions } from "@/config/constants/dropdowns/portal/portal.options";
import { useCreatePortalRequest, usePortalProjects, usePortalRequest, usePortalRequests, useRatePortalRequest, useReplyToPortalRequest } from "@/features/portal/hooks/use-portal";
import { usePortal } from "../components/portal-context";
import { PortalCard, PortalHeader, PortalThread, RequestStatusBadge } from "../components/portal-ui";
import { PORTAL_PATHS } from "../portal-paths";

/** Customer requests — /portal/requests (mockup 07-portal `cp-requests`). @perm portal.requests.create */
export function PortalRequestsPage() {
    const [state, setState] = useState("open");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const requests = usePortalRequests({ status: state === "everything" ? undefined : state, search: search || undefined, page, limit: 20 });
    return (
        <>
            <PortalHeader title="Requests" description="Questions, bugs and changes you asked the team about." actions={<Button asChild><Link to={PORTAL_PATHS.newRequest}><Plus /> New request</Link></Button>} />
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search requests…" className="h-9 sm:max-w-xs" aria-label="Search requests" />
                <Select value={state} onValueChange={(v) => { setState(v); setPage(1); }}>
                    <SelectTrigger className="h-9 sm:w-36" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{PortalRequestStateOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            {requests.isLoading ? <ListSkeleton /> : requests.error ? <ErrorState error={requests.error} onRetry={() => requests.refetch()} /> : !requests.data?.data.length ? (
                <EmptyState icon={LifeBuoy} title={search ? "No requests match" : "No requests here"} description="Need something? Open a request and the team will pick it up." action={<Button asChild size="sm"><Link to={PORTAL_PATHS.newRequest}><Plus /> New request</Link></Button>} />
            ) : (
                <PortalCard>
                    <ul className="divide-y divide-border-soft">
                        {requests.data.data.map((r) => (
                            <li key={r.id}>
                                <Link to={PORTAL_PATHS.request(r.reference)} className="flex flex-wrap items-center gap-2 py-3 hover:bg-secondary/40">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-[13px] font-medium">{r.subject}</div>
                                        <div className="text-xs text-muted-foreground">{r.reference} · {getDropdownOptionLabel(PortalRequestTypeOptions, r.type)}{r.project ? ` · ${r.project.name}` : ""} · updated {formatRelative(r.updated_at)}</div>
                                    </div>
                                    <RequestStatusBadge status={r.status} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {requests.data.pagination.total_pages > 1 && <div className="mt-3"><Pagination currentPage={page} totalPages={requests.data.pagination.total_pages} onPageChange={setPage} /></div>}
                </PortalCard>
            )}
        </>
    );
}

const NONE = "__none";

/** New request — /portal/requests/new (mockup 07-portal `cp-request-new`). Creates a 13 ticket (source PORTAL). */
export function PortalNewRequestPage() {
    const navigate = useNavigate();
    const { can, feature } = usePortal();
    const projects = usePortalProjects({ limit: 100 });
    const create = useCreatePortalRequest();
    const [f, setF] = useState({ subject: "", description: "", type: "QUESTION", priority: "NORMAL", project_id: NONE });
    const valid = f.subject.trim().length >= 3 && f.description.trim().length > 0;
    const submit = () =>
        create.mutate(
            { subject: f.subject.trim(), description: f.description.trim(), type: f.type, priority: f.priority, project_id: f.project_id !== NONE ? f.project_id : undefined },
            { onSuccess: (r) => { toast({ title: `Request ${r.reference} sent`, description: "The team has been notified." }); navigate(PORTAL_PATHS.request(r.reference), { replace: true }); }, onError: (e) => toast({ variant: "destructive", title: "Could not send your request", description: getApiErrorMessage(e) }) },
        );
    return (
        <div className="mx-auto max-w-2xl">
            <Link to={PORTAL_PATHS.requests} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Requests</Link>
            <PortalHeader title="New request" description="Tell us what you need. You can follow the progress and reply here." />
            <PortalCard>
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5"><Label>What is it about?</Label>
                            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger><SelectContent>{PortalRequestTypeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1.5"><Label>How urgent?</Label>
                            <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}><SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger><SelectContent>{PortalPriorityOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    {can("portal.projects.read") && feature("projects") && !!projects.data?.data.length && (
                        <div className="space-y-1.5"><Label>Project</Label>
                            <Select value={f.project_id} onValueChange={(v) => setF({ ...f, project_id: v })}><SelectTrigger aria-label="Project"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Not about a specific project</SelectItem>{projects.data.data.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    )}
                    <div className="space-y-1.5"><Label htmlFor="rq-subject">Subject</Label><Input id="rq-subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={300} placeholder="The contact form doesn't send emails" /></div>
                    <div className="space-y-1.5"><Label htmlFor="rq-desc">Details</Label><Textarea id="rq-desc" rows={7} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What happened, where, and what you expected. Steps to reproduce help a lot." /></div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => navigate(-1)} disabled={create.isPending}>Cancel</Button>
                        <Button onClick={submit} loading={create.isPending} disabled={!valid}>Send request</Button>
                    </div>
                </div>
            </PortalCard>
        </div>
    );
}

/** Request detail — /portal/requests/:reference. Public thread only; internal notes are never sent to the portal. */
export function PortalRequestPage() {
    const { reference } = useParams();
    const { session } = usePortal();
    const req = usePortalRequest(reference);
    const reply = useReplyToPortalRequest();
    const rate = useRatePortalRequest();
    const [body, setBody] = useState("");
    const [stars, setStars] = useState(0);
    const [comment, setComment] = useState("");
    if (req.isLoading) return <PageSkeleton />;
    if (req.error || !req.data) return <ErrorState error={req.error} onRetry={() => req.refetch()} />;
    const r = req.data;
    const agency = session.organization?.display_name ?? "The team";
    const send = () => reply.mutate({ id: r.id, body: body.trim() }, { onSuccess: () => { setBody(""); toast({ title: "Reply sent" }); }, onError: (e) => toast({ variant: "destructive", title: "Could not send", description: getApiErrorMessage(e) }) });
    return (
        <div className="mx-auto max-w-3xl">
            <Link to={PORTAL_PATHS.requests} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Requests</Link>
            <PortalHeader title={r.subject} description={<span className="flex flex-wrap items-center gap-2">{r.reference} · opened {formatDate(r.created_at)} <RequestStatusBadge status={r.status} />{r.project && <Badge variant="neutral">{r.project.name}</Badge>}</span>} />
            {r.linked_work.length > 0 && (
                <PortalCard title="Work in progress" className="mb-4">
                    <ul className="space-y-1.5">{r.linked_work.map((w, i) => <li key={i} className="flex items-center gap-2 text-[13px]"><span className="min-w-0 flex-1 truncate">{w.title}</span>{w.status && <Badge variant={w.completed_at ? "success" : "info"}>{w.status.name}</Badge>}</li>)}</ul>
                </PortalCard>
            )}
            <PortalCard title="Conversation" className="mb-4">
                <PortalThread messages={r.messages} agencyName={agency} />
            </PortalCard>
            {r.can_reply ? (
                <PortalCard>
                    <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" aria-label="Reply" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) { e.preventDefault(); send(); } }} />
                    <div className="mt-2 flex justify-end"><Button onClick={send} loading={reply.isPending} disabled={!body.trim()}>Send reply</Button></div>
                </PortalCard>
            ) : (
                <p className="text-center text-[13px] text-muted-foreground">This request is closed. <Link className="text-info hover:underline" to={PORTAL_PATHS.newRequest}>Open a new request</Link> if you need more help.</p>
            )}
            {r.rating?.can_rate && (
                <PortalCard title="How did we do?" className="mt-4">
                    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setStars(n)} className="p-1">
                                <Star className={cn("size-6", n <= stars ? "fill-warning text-warning" : "text-ash")} />
                            </button>
                        ))}
                    </div>
                    <Textarea className="mt-2" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything to add? (optional)" aria-label="Comment" />
                    <div className="mt-2 flex justify-end"><Button disabled={!stars} loading={rate.isPending} onClick={() => rate.mutate({ id: r.id, rating: stars, comment: comment || undefined }, { onSuccess: () => toast({ title: "Thanks for your feedback!" }), onError: (e) => toast({ variant: "destructive", title: "Could not send rating", description: getApiErrorMessage(e) }) })}>Send rating</Button></div>
                </PortalCard>
            )}
            {r.rating?.submitted && <p className="mt-4 text-center text-xs text-muted-foreground">You rated this {r.rating.rating}/5. Thank you!</p>}
        </div>
    );
}
