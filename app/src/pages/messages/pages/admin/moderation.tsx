import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Flag, ShieldCheck, ShieldOff } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useDecideReport, useLiftRestriction, useReport, useReports, useRestrictions } from "@/features/messaging/hooks/use-messaging-admin";
import type { MessageReport, MessageReportStatus, ModerationAction, Restriction } from "@/features/messaging/interfaces/messaging-admin.interfaces";
import { ModerationActionOptions, ReportReasonOptions, ReportStatusOptions, RestrictionDurationOptions } from "@/config/constants/dropdowns/messaging/messaging-admin.options";
import { AdminNav } from "./admin-nav";

const statusVariant = (s: MessageReportStatus) => (s === "OPEN" ? "warning" : s === "UNDER_REVIEW" ? "info" : s === "ACTIONED" ? "success" : "neutral");

/** Review sheet: the reported message with 3 messages of context, and the decision. */
function ReviewSheet({ reportId, onClose }: { reportId: string | null; onClose: () => void }) {
    const report = useReport(reportId ?? undefined);
    const decide = useDecideReport();
    const canDeleteAny = usePermission("messaging.messages.delete_any");
    const canBan = usePermission("messaging.channel_members.manage");
    const [action, setAction] = useState<ModerationAction>("hide");
    const [reason, setReason] = useState("");
    const [duration, setDuration] = useState("168");
    const [note, setNote] = useState("");
    const r = report.data;
    const closed = r && (r.status === "ACTIONED" || r.status === "DISMISSED");
    const actions = ModerationActionOptions.filter((a) => (a.id !== "delete" || canDeleteAny) && (a.id !== "ban" || canBan));

    const submit = (status: "UNDER_REVIEW" | "ACTIONED" | "DISMISSED") =>
        reportId &&
        decide.mutate(
            {
                id: reportId,
                status,
                action: status === "ACTIONED" ? action : "none",
                reason: reason.trim() || undefined,
                resolution_note: note.trim() || undefined,
                restriction_hours: (action === "mute" || action === "ban") && duration !== "forever" ? Number(duration) : undefined,
            },
            // The report shows its new status at once; dismiss / action close the sheet when the server confirms.
            { onSuccess: () => { if (status !== "UNDER_REVIEW") onClose(); } },
        );

    return (
        <Sheet open={!!reportId} onOpenChange={(o) => !o && onClose()}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>Review report</SheetTitle>
                    <SheetDescription>Only the reported message and a little context are shown. The author does not learn who reported it.</SheetDescription>
                </SheetHeader>
                {report.isPending ? <ListSkeleton rows={4} /> : report.error ? <ErrorState error={report.error} onRetry={() => report.refetch()} /> : r && (
                    <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant={statusVariant(r.status)}>{getDropdownOptionLabel(ReportStatusOptions, r.status)}</Badge>
                            <span>{getDropdownOptionLabel(ReportReasonOptions, r.reason)}</span>
                            <span>· reported {formatRelative(r.created_at)} by {r.reporter ? personName(r.reporter.user) : "someone"}</span>
                        </div>
                        {r.details && <p className="rounded-md bg-secondary p-2 text-[13px] text-foreground">“{r.details}”</p>}
                        <div className="space-y-1 rounded-lg border border-border bg-card p-3 text-[13px]">
                            <p className="text-xs text-muted-foreground">#{r.message.channel.name ?? "conversation"}</p>
                            {r.context.before.map((m) => <p key={m.id} className="text-muted-foreground"><span className="font-medium">{personName(m.author?.user)}:</span> {m.deleted_at ? <em>removed</em> : m.body_plain}</p>)}
                            <div className="rounded-md border border-warning/40 bg-warning-soft p-2">
                                <p className="text-xs font-medium text-foreground">{personName(r.message.author?.user)} · {formatDateTime(r.message.created_at)}</p>
                                <p className="whitespace-pre-wrap break-words text-foreground">{r.message.hidden && !r.message.body_plain ? <em>Content deleted</em> : r.message.body_plain ?? r.message.body}</p>
                                {r.message.hidden && <p className="mt-1 text-xs text-muted-foreground">Removed from the channel ({r.message.delete_reason?.replace(/_/g, " ")}).</p>}
                            </div>
                            {r.context.after.map((m) => <p key={m.id} className="text-muted-foreground"><span className="font-medium">{personName(m.author?.user)}:</span> {m.deleted_at ? <em>removed</em> : m.body_plain}</p>)}
                        </div>
                        {r.author_restrictions.length > 0 && (
                            <p className="text-xs text-muted-foreground">Earlier restrictions of the author: {r.author_restrictions.map((x) => `${x.kind.toLowerCase()} ${formatRelative(x.created_at)}`).join(", ")}</p>
                        )}
                        {closed ? (
                            <p className="text-[13px] text-muted-foreground">Decided {formatDateTime(r.reviewed_at)} · {r.action_taken?.replace(/_/g, " ")}{r.resolution_note ? ` · ${r.resolution_note}` : ""}</p>
                        ) : (
                            <div className="space-y-3 border-t border-border pt-4">
                                <div className="space-y-1.5">
                                    <Label>Action</Label>
                                    <Select value={action} onValueChange={(v) => setAction(v as ModerationAction)}>
                                        <SelectTrigger aria-label="Action"><SelectValue /></SelectTrigger>
                                        <SelectContent>{actions.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">{actions.find((a) => a.id === action)?.hint}</p>
                                </div>
                                {(action === "mute" || action === "ban") && (
                                    <div className="space-y-1.5">
                                        <Label>For</Label>
                                        <Select value={duration} onValueChange={setDuration}>
                                            <SelectTrigger aria-label="Duration"><SelectValue /></SelectTrigger>
                                            <SelectContent>{RestrictionDurationOptions.map((d) => <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label htmlFor="mod-reason">Reason (kept in the audit log)</Label>
                                    <Textarea id="mod-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="mod-note">Internal note</Label>
                                    <Textarea id="mod-note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
                                </div>
                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <Button variant="ghost" onClick={() => submit("DISMISSED")} loading={decide.isPending}>Dismiss</Button>
                                    {r.status === "OPEN" && <Button variant="outline" onClick={() => submit("UNDER_REVIEW")} loading={decide.isPending}>Mark under review</Button>}
                                    <Button variant={action === "delete" || action === "ban" ? "destructive" : "default"} onClick={() => submit("ACTIONED")} loading={decide.isPending} disabled={action === "none"}>Apply</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

function ReportsTab() {
    const [status, setStatus] = useState<MessageReportStatus | "open">("open");
    const reports = useReports(status === "open" ? undefined : status);
    const [reviewing, setReviewing] = useState<string | null>(null);
    const columns: DataTableColumn<MessageReport>[] = [
        {
            key: "msg",
            header: "Message",
            cell: (r) => (
                <div className="min-w-0">
                    <div className="truncate text-foreground">{r.message.hidden && !r.message.body_plain ? <em className="text-muted-foreground">Content deleted</em> : r.message.body_plain}</div>
                    <div className="truncate text-xs text-muted-foreground">{personName(r.message.author?.user)} in #{r.message.channel.name ?? "conversation"}</div>
                </div>
            ),
        },
        { key: "reason", header: "Reason", cell: (r) => <span className="text-muted-foreground">{getDropdownOptionLabel(ReportReasonOptions, r.reason)}</span>, hideBelow: "sm" },
        { key: "status", header: "Status", cell: (r) => <Badge variant={statusVariant(r.status)}>{getDropdownOptionLabel(ReportStatusOptions, r.status)}</Badge> },
        { key: "when", header: "Reported", cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatRelative(r.created_at)}</span>, hideBelow: "md" },
    ];
    return (
        <>
            <TableToolbar>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="open">Needs review</SelectItem>
                        {ReportStatusOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={reports.data?.data}
                rowKey={(r) => r.id}
                loading={reports.isFetching}
                error={reports.error}
                onRetry={() => reports.refetch()}
                onRowClick={(r) => setReviewing(r.id)}
                empty={{ icon: ShieldCheck, title: status === "open" ? "Queue is clear" : "No reports", description: "Members report messages from the message menu." }}
            />
            <ReviewSheet reportId={reviewing} onClose={() => setReviewing(null)} />
        </>
    );
}

function RestrictionsTab() {
    const [active, setActive] = useState(true);
    const list = useRestrictions(active);
    const lift = useLiftRestriction();
    const [lifting, setLifting] = useState<Restriction | null>(null);
    const columns: DataTableColumn<Restriction>[] = [
        { key: "who", header: "Member", cell: (r) => <span className="font-medium text-foreground">{personName(r.membership?.user)}</span> },
        { key: "kind", header: "Restriction", cell: (r) => <Badge variant={r.kind === "BANNED" ? "danger" : "warning"}>{r.kind === "BANNED" ? "Banned" : "Muted"}</Badge> },
        { key: "where", header: "Where", cell: (r) => <span className="text-muted-foreground">{r.channel ? `#${r.channel.name}` : "Everywhere"}</span>, hideBelow: "sm" },
        { key: "until", header: "Until", cell: (r) => <span className="text-muted-foreground">{r.lifted_at ? `Lifted ${formatDateTime(r.lifted_at)}` : r.expires_at ? formatDateTime(r.expires_at) : "Until lifted"}</span>, hideBelow: "md" },
        { key: "reason", header: "Reason", cell: (r) => <span className="text-muted-foreground">{r.reason ?? "—"}</span>, hideBelow: "lg" },
        { key: "act", header: <span className="sr-only">Actions</span>, className: "w-24", cell: (r) => !r.lifted_at && <Button size="sm" variant="outline" onClick={() => setLifting(r)}><ShieldOff /> Lift</Button> },
    ];
    return (
        <>
            <TableToolbar>
                <Select value={active ? "active" : "all"} onValueChange={(v) => setActive(v === "active")}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Active or all"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="all">All</SelectItem></SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={list.data?.data}
                rowKey={(r) => r.id}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                empty={{ icon: ShieldCheck, title: "No restrictions", description: "Mutes and bans set from reports appear here." }}
            />
            <ConfirmationDialog
                isOpen={!!lifting}
                onClose={() => setLifting(null)}
                title="Lift this restriction?"
                description={`${personName(lifting?.membership?.user)} can post again${lifting?.channel ? ` in #${lifting.channel.name}` : ""}. A ban does not re-add them to the channel.`}
                confirmText="Lift"
                onConfirm={() => { if (!lifting) return; lift.mutate(lifting.id); setLifting(null); }}
            />
        </>
    );
}

/**
 * /messages/admin/moderation?tab=reports|restrictions
 * @perm messaging.moderation.manage · delete messaging.messages.delete_any · ban messaging.channel_members.manage
 * @api GET /messaging/reports · GET/PATCH /messaging/reports/:id · GET/POST /messaging/restrictions · POST /restrictions/:id/lift
 */
export default function ModerationPage() {
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "reports";
    return (
        <Page>
            <PageHeader title="Moderation" description="Reported messages and member restrictions. Every decision is audited." />
            <AdminNav />
            <Tabs value={tab} onValueChange={(v) => setSp(new URLSearchParams({ tab: v }), { replace: true })}>
                <TabsList>
                    <TabsTrigger value="reports"><Flag className="size-3.5" /> Reports</TabsTrigger>
                    <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
                </TabsList>
                <TabsContent value="reports" className="pt-3">{tab === "reports" && <ReportsTab />}</TabsContent>
                <TabsContent value="restrictions" className="pt-3">{tab === "restrictions" && <RestrictionsTab />}</TabsContent>
            </Tabs>
        </Page>
    );
}
