import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, Bell, BellOff, ListTodo, MoreHorizontal, TriangleAlert } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EntityPicker } from "@/components/ui/entity-picker";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime, formatMinutes, formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { SlaMetricOptions, SupportChannelTypeOptions, TicketPriorityFormOptions, TicketSourceOptions, TicketTypeFormOptions } from "@/config/constants/dropdowns/support/support.options";
import {
    useAgents,
    useArchiveTicket,
    useAssignTicket,
    patchTicketStatus,
    useChangeTicketStatus,
    useDiscardOutgoing,
    useFollowTicket,
    useOutbox,
    useReplyToTicket,
    useTicket,
    useTicketCategories,
    useTicketMessages,
    useTicketStatuses,
    useUnfollowTicket,
    useUpdateTicket,
} from "@/features/support/hooks/use-support";
import { useSessionData } from "@/features/session/hooks/use-session";
import type { TicketDetail, TicketPriority } from "@/features/support/interfaces/support.interfaces";
import { PriorityBadge, SlaChip, slaRemaining, TicketStatusBadge } from "../../components/support-badges";
import { MessageThread } from "../../components/message-thread";
import { ReplyComposer } from "../../components/reply-composer";
import { ConvertToTaskDialog } from "./components/convert-to-task-dialog";
import { SUPPORT_PATHS } from "../../support-paths";

const NONE = "__none";

/**
 * Ticket page — /support/tickets/:reference (mockup 13-support `ticket`).
 * @perm VIEW support.tickets.read · edit .update · assign .assign · convert .convert_to_task (+ tasks.tasks.create) · reply support.conversations.reply
 */
export default function TicketPage() {
    const { reference } = useParams();
    const ticket = useTicket(reference);
    if (ticket.isLoading) return <PageSkeleton />;
    if (ticket.error || !ticket.data) return <Page><ErrorState error={ticket.error} onRetry={() => ticket.refetch()} /></Page>;
    return <TicketView t={ticket.data} />;
}

function TicketView({ t }: { t: TicketDetail }) {
    const session = useSessionData();
    const messages = useTicketMessages(t.id);
    const statuses = useTicketStatuses();
    const categories = useTicketCategories();
    const agents = useAgents();
    const update = useUpdateTicket();
    const status = useChangeTicketStatus();
    const assign = useAssignTicket();
    const reply = useReplyToTicket();
    const follow = useFollowTicket();
    const unfollow = useUnfollowTicket();
    const archive = useArchiveTicket();
    const canUpdate = usePermission("support.tickets.update");
    const canAssign = usePermission("support.tickets.assign");
    const [convertOpen, setConvertOpen] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const outbox = useOutbox({ ticketId: t.id });
    const discard = useDiscardOutgoing();
    const qc = useQueryClient();
    const navigate = useNavigate();
    const setStatus = (id: string) => { const st = statuses.data?.find((x) => x.id === id); status.mutate({ id: t.id, status_id: id, optimistic: st ? { status: st } : undefined }); };
    const closed = t.status?.category === "RESOLVED" || t.status?.category === "CLOSED";
    const resolvedStatus = statuses.data?.find((s) => s.category === "RESOLVED");
    const converted = t.task_links.some((l) => l.kind === "CONVERTED");

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: SUPPORT_PATHS.tickets, label: "Tickets" }}
                title={t.subject}
                documentTitle={`${t.reference} · ${t.subject}`}
                meta={
                    <>
                        <Badge variant="outline" className="tabular">{t.reference}</Badge>
                        <TicketStatusBadge status={t.status} />
                        <PriorityBadge priority={t.priority} />
                        {(t.sla_breached || t.sla_at_risk) && <SlaChip breached={t.sla_breached} atRisk={t.sla_at_risk} due={t.first_response_due_at ?? t.next_response_due_at ?? t.resolution_due_at} />}
                    </>
                }
                description={`${getDropdownOptionLabel(TicketSourceOptions, t.source)} · opened ${formatRelative(t.created_at)}${t.company ? ` · ${t.company.name}` : ""}`}
                actions={
                    <>
                        <Button variant="outline" size="sm" aria-pressed={t.following} onClick={() => (t.following && session?.active_organization ? unfollow.mutate({ id: t.id, membership_id: session.active_organization.membership_id }) : follow.mutate(t.id))}>
                            {t.following ? <BellOff /> : <Bell />} {t.following ? "Unfollow" : "Follow"}
                        </Button>
                        <Can permission="support.tickets.convert_to_task">
                            <Button variant="outline" size="sm" onClick={() => setConvertOpen(true)} disabled={converted}>
                                <ListTodo /> {converted ? "Converted" : "Convert to task"}
                            </Button>
                        </Can>
                        <Can permission="support.tickets.update">
                            {!closed && resolvedStatus && (
                                <Button size="sm" onClick={() => setStatus(resolvedStatus.id)}>
                                    Resolve
                                </Button>
                            )}
                        </Can>
                        <Can permission="support.tickets.archive">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon-sm" aria-label="More actions"><MoreHorizontal /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(true)}><Archive /> Archive</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </Can>
                    </>
                }
            />

            {t.merged_into && (
                <div className="mb-4 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-[13px]">
                    Merged into <Link className="text-info hover:underline" to={SUPPORT_PATHS.ticket(t.merged_into.reference)}>{t.merged_into.reference}</Link>.
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0 space-y-6">
                    {t.description && (
                        <Section title="Description">
                            <div className="whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-[13px] text-foreground">{t.description}</div>
                        </Section>
                    )}
                    <Section title="Conversation">
                        {messages.isLoading ? <p className="text-[13px] text-muted-foreground">Loading messages…</p> : messages.error ? <ErrorState error={messages.error} onRetry={() => messages.refetch()} /> : <MessageThread messages={[...(messages.data ?? []), ...outbox]} onRetry={(m) => reply.mutate({ local_id: m.id, id: t.id, kind: m.kind as "AGENT" | "INTERNAL_NOTE", body: m.body })} onDiscard={(m) => discard({ ticketId: t.id }, m.id)} />}
                    </Section>
                    <ReplyComposer
                        ticketId={t.id}
                        conversationId={t.conversation_id}
                        allowResolve={!!resolvedStatus && canUpdate && !closed}
                        disabledReason={t.merged_into ? "This ticket was merged" : null}
                        onSend={({ kind, body, canned_response_id, resolve }) => {
                            reply.mutate({ id: t.id, kind, body, canned_response_id, then_status_id: resolve ? resolvedStatus?.id : undefined });
                            if (resolve && resolvedStatus) patchTicketStatus(qc, t.id, resolvedStatus);
                        }}
                    />
                    {t.status_history.length > 0 && (
                        <Section title="History">
                            <ol className="space-y-2 border-l border-border pl-4">
                                {t.status_history.map((h) => (
                                    <li key={h.id} className="text-[13px]">
                                        <span className="text-foreground">{h.from_status ? `${h.from_status.name} → ` : ""}{h.to_status?.name ?? "—"}</span>
                                        <span className="text-xs text-muted-foreground"> · {h.changed_via.replace("_", " ")} · {formatDateTime(h.changed_at)}</span>
                                        {h.reason && <div className="text-xs text-muted-foreground">{h.reason}</div>}
                                    </li>
                                ))}
                            </ol>
                        </Section>
                    )}
                </div>

                <aside className="space-y-5">
                    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                        <Field label="Status">
                            <Select value={t.status?.id ?? NONE} disabled={!canUpdate} onValueChange={setStatus}>
                                <SelectTrigger className="h-8" aria-label="Status"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {!t.status && <SelectItem value={NONE}>No status</SelectItem>}
                                    {statuses.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Priority">
                            <Select value={t.priority} disabled={!canUpdate} onValueChange={(v) => update.mutate({ id: t.id, priority: v as TicketPriority })}>
                                <SelectTrigger className="h-8" aria-label="Priority"><SelectValue /></SelectTrigger>
                                <SelectContent>{TicketPriorityFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </Field>
                        <Field label="Assignee">
                            <EntityPicker
                                items={(agents.data ?? []).map((a) => ({ id: a.id, label: personName(a.user), keywords: a.user.email ?? "" }))}
                                value={t.assignee?.id ?? null}
                                noneLabel="Unassigned"
                                disabled={!canAssign}
                                ariaLabel="Assignee"
                                onChange={(v) => assign.mutate({ id: t.id, assignee_membership_id: v, optimistic: { assignee: agents.data?.find((a) => a.id === v) ?? null } })}
                            />
                        </Field>
                        <Field label="Category">
                            <Select value={t.category?.id ?? NONE} disabled={!canUpdate} onValueChange={(v) => update.mutate({ id: t.id, category_id: v === NONE ? undefined : v, optimistic: { category: categories.data?.find((c) => c.id === v) ?? null } })}>
                                <SelectTrigger className="h-8" aria-label="Category"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>No category</SelectItem>
                                    {categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Type">
                            <Select value={t.type} disabled={!canUpdate} onValueChange={(v) => update.mutate({ id: t.id, type: v as TicketDetail["type"] })}>
                                <SelectTrigger className="h-8" aria-label="Type"><SelectValue /></SelectTrigger>
                                <SelectContent>{TicketTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </Field>
                        <dl className="space-y-1.5 border-t border-border-soft pt-3 text-[13px]">
                            <Row label="Requester">{t.requester_name ?? t.requester_email ?? "—"}</Row>
                            <Row label="Company">{t.company ? <Link className="text-info hover:underline" to={`/crm/companies/${t.company.id}`}>{t.company.name}</Link> : "—"}</Row>
                            <Row label="Project">{t.project?.name ?? "—"}</Row>
                            <Row label="Inbox">{t.inbox?.name ?? "—"}</Row>
                            <Row label="Channel">{t.channel_type ? getDropdownOptionLabel(SupportChannelTypeOptions, t.channel_type) : "—"}</Row>
                            <Row label="Portal">{t.customer_visible ? "Visible to client" : "Hidden"}</Row>
                        </dl>
                    </div>

                    <Section title="SLA" description={t.sla_policy ? t.sla_policy.name : "No SLA policy"}>
                        {t.sla_timers.filter((x) => x.status !== "CANCELLED").length ? (
                            <ul className="space-y-2">
                                {t.sla_timers.filter((x) => x.status !== "CANCELLED").map((timer) => {
                                    const rem = slaRemaining(timer.due_at);
                                    return (
                                        <li key={timer.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[13px]">
                                            <div>
                                                <div className="font-medium">{getDropdownOptionLabel(SlaMetricOptions, timer.metric)}</div>
                                                <div className="text-xs text-muted-foreground">Target {formatMinutes(timer.target_minutes)} · due {formatDateTime(timer.due_at)}</div>
                                            </div>
                                            {timer.status === "MET" ? <Badge variant="success">Met</Badge> : timer.status === "BREACHED" ? <Badge variant="danger"><TriangleAlert className="size-3" /> Breached</Badge> : timer.status === "PAUSED" ? <Badge variant="neutral">Paused</Badge> : <Badge variant={rem?.overdue ? "danger" : timer.at_risk_at ? "warning" : "info"} className="tabular">{rem?.text}</Badge>}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-xs text-muted-foreground">No SLA targets apply.</p>
                        )}
                    </Section>

                    <Section title="Linked work">
                        {t.task_links.length ? (
                            <ul className="space-y-2">
                                {t.task_links.map((l) => (
                                    <li key={l.id} className="rounded-md border border-border px-3 py-2 text-[13px]">
                                        <div className="flex items-center gap-2">
                                            <Link className="text-info hover:underline tabular" to={`/tasks/${l.task.identifier}`}>{l.task.identifier}</Link>
                                            {l.task.status && <Badge variant="neutral">{l.task.status.name}</Badge>}
                                        </div>
                                        <div className="truncate">{l.task.title}</div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-muted-foreground">No tasks linked yet.</p>
                        )}
                    </Section>

                    <Section title="Followers">
                        <div className="flex flex-wrap gap-2">
                            {t.followers.length ? t.followers.map((f) => <MemberAvatar key={f.membership_id} person={f.membership.user} showName size="xs" />) : <p className="text-xs text-muted-foreground">Nobody follows this ticket.</p>}
                        </div>
                    </Section>
                </aside>
            </div>

            <ConvertToTaskDialog open={convertOpen} onOpenChange={setConvertOpen} ticket={t} />
            <ConfirmationDialog
                isOpen={archiving}
                onClose={() => setArchiving(false)}
                title={`Archive ${t.reference}?`}
                description="Archived tickets are hidden from lists and their SLA timers stop."
                confirmText="Archive"
                variant="destructive"
                onConfirm={() => { archive.mutate(t.id); setArchiving(false); navigate(SUPPORT_PATHS.tickets); }}
            />
        </Page>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{label}</div>
            {children}
        </div>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 truncate text-right text-foreground">{children}</dd>
        </div>
    );
}
