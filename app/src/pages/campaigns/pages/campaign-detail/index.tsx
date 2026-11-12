import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Ban, CheckCircle2, Copy, Eye, Link2, Mail, MoreHorizontal, MousePointerClick, Pause, Pencil, Play, Send, ShieldCheck, ShieldX, TriangleAlert, Undo2, Users } from "lucide-react";
import { Page, PageHeader, KeyValueList, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePermissions } from "@/hooks/use-permission";
import { useListParams } from "@/hooks/use-list-params";
import { formatDateTime, formatNumber, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useCampaign, useCampaignAction, useCampaignRecipients, useCampaignStats } from "@/features/communications/hooks/use-communications";
import type { CampaignDetail, CampaignRecipient } from "@/features/communications/interfaces/communications.interfaces";
import type { CampaignAction } from "@/features/communications/services/communications.services";
import { AudienceExclusionReasonOptions, CommRecipientStatusFilterOptions } from "@/config/constants/dropdowns/communications/comm-message-status-filter.options";
import { CampaignStatusBadge, ChannelBadge, RecipientStatusBadge, pct } from "../../components/comm-badges";
import { DailySendsChart } from "../../components/daily-sends-chart";
import { ContentPreview } from "../../components/content-preview";
import { CampaignPaths } from "../../campaign-paths";
import { AbResults } from "./components/ab-results";
import { describeRepeat } from "./components/describe-repeat";

function RecipientsTab({ campaign }: { campaign: CampaignDetail }) {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const { tab: _t, ...rest } = params as Record<string, string | number>;
    const recipients = useCampaignRecipients(campaign.id, rest);
    const columns: DataTableColumn<CampaignRecipient>[] = [
        {
            key: "to",
            header: "Recipient",
            cell: (r) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{r.name ?? r.address}</div>
                    {r.name && <div className="truncate text-xs text-muted-foreground">{r.address}</div>}
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (r) => <RecipientStatusBadge status={r.status} /> },
        {
            key: "detail",
            header: "Detail",
            hideBelow: "md",
            cell: (r) => (
                <span className="text-xs text-muted-foreground">
                    {r.exclusion_reason ? getDropdownOptionLabel(AudienceExclusionReasonOptions, r.exclusion_reason) : r.message?.failure_reason ?? (r.message?.first_clicked_at ? `Clicked ${formatDateTime(r.message.first_clicked_at)}` : r.message?.first_opened_at ? `Opened ${formatDateTime(r.message.first_opened_at)}` : formatDateTime(r.sent_at))}
                </span>
            ),
        },
    ];
    return (
        <>
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search recipients…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommRecipientStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={recipients.data?.data}
                rowKey={(r) => r.id}
                loading={recipients.isFetching}
                error={recipients.error}
                onRetry={() => recipients.refetch()}
                pagination={recipients.data?.pagination}
                onPageChange={setPage}
                rowHref={(r) => (r.message ? CampaignPaths.message(r.message.id) : "")}
                empty={{ icon: Users, title: "No recipients yet", description: "Recipients are resolved from the audience when the campaign starts sending." }}
            />
        </>
    );
}

/**
 * /campaigns/:id — status, results, recipients, content, approvals.
 * @perm communications.campaigns.read · edit …update · send/pause/resume/cancel …send · approve/reject …approve
 * @api GET /communications/campaigns/:id · /stats · /recipients · POST /:id/{pause|resume|cancel|unschedule|approve|reject|duplicate}
 */
export default function CampaignDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "overview";
    const { can } = usePermissions();
    const campaign = useCampaign(id, true);
    const live = ["SCHEDULED", "SENDING"].includes(campaign.data?.status ?? "");
    const stats = useCampaignStats(id, live);
    const action = useCampaignAction();
    const [confirm, setConfirm] = useState<CampaignAction | null>(null);
    const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
    const [comment, setComment] = useState("");

    if (campaign.isPending) return <PageSkeleton />;
    if (campaign.error) return <Page><ErrorState error={campaign.error} onRetry={() => campaign.refetch()} /></Page>;
    const c = campaign.data;
    const s = stats.data;

    // Status changes show at once (the badge and actions update); duplicate opens the copy when it exists.
    const run = (a: CampaignAction, body?: Record<string, unknown>) => {
        action.mutate({ id: c.id, action: a, body }, { onSuccess: (res) => { if (a === "duplicate") navigate(CampaignPaths.edit(res.id)); } });
        setConfirm(null);
        setDecision(null);
        setComment("");
    };

    const editable = ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(c.status);
    const confirmCopy: Partial<Record<CampaignAction, { title: string; description: string; text: string; destructive?: boolean }>> = {
        cancel: { title: "Cancel this campaign?", description: "Messages not yet sent are dropped. Already-sent messages are not recalled.", text: "Cancel campaign", destructive: true },
        pause: { title: "Pause sending?", description: "Queued messages wait until you resume.", text: "Pause" },
        unschedule: { title: "Unschedule?", description: "The campaign goes back to draft so you can edit it.", text: "Unschedule" },
    };
    const conf = confirm ? confirmCopy[confirm] : null;
    const progress = c.audience_count ? Math.min(100, Math.round(((c.sent_count + c.failed_count + c.excluded_count) / (c.audience_count + c.excluded_count)) * 100)) : 0;

    return (
        <Page>
            <PageHeader
                back={{ to: CampaignPaths.root, label: "Campaigns" }}
                title={c.name}
                meta={<><CampaignStatusBadge status={c.status} /><ChannelBadge channel={c.channel} /></>}
                description={c.status === "SCHEDULED" ? `Scheduled for ${formatDateTime(c.scheduled_at)}` : c.status === "COMPLETED" ? `Sent ${formatDateTime(c.completed_at)}` : c.description ?? undefined}
                actions={
                    <>
                        {editable && can("communications.campaigns.update") && <Button variant="outline" onClick={() => navigate(CampaignPaths.edit(c.id))}><Pencil /> Edit</Button>}
                        {(c.status === "DRAFT" || c.status === "APPROVED") && can("communications.campaigns.send") && (
                            <Button onClick={() => navigate(`${CampaignPaths.edit(c.id)}?step=3`)}><Send /> Review & send</Button>
                        )}
                        {c.status === "PENDING_APPROVAL" && can("communications.campaigns.approve") && (
                            <>
                                <Button variant="outline" onClick={() => setDecision("reject")}><ShieldX /> Reject</Button>
                                <Button onClick={() => setDecision("approve")}><ShieldCheck /> Approve</Button>
                            </>
                        )}
                        {c.status === "SENDING" && can("communications.campaigns.send") && <Button variant="outline" onClick={() => setConfirm("pause")}><Pause /> Pause</Button>}
                        {c.status === "PAUSED" && can("communications.campaigns.send") && <Button onClick={() => run("resume")}><Play /> Resume</Button>}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {can("communications.campaigns.create") && <DropdownMenuItem onSelect={() => run("duplicate")}><Copy /> Duplicate</DropdownMenuItem>}
                                {c.status === "SCHEDULED" && can("communications.campaigns.send") && <DropdownMenuItem onSelect={() => setConfirm("unschedule")}><Undo2 /> Unschedule</DropdownMenuItem>}
                                {["SCHEDULED", "SENDING", "PAUSED"].includes(c.status) && can("communications.campaigns.send") && (
                                    <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm("cancel")}><Ban /> Cancel campaign</DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                }
            />

            {c.failure_reason && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {c.failure_reason}
                </div>
            )}
            {(c.status === "SENDING" || c.status === "PAUSED") && (
                <div className="mb-4 rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                        <span>{formatNumber(c.sent_count)} of {formatNumber(c.audience_count)} sent</span>
                        <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" aria-label="Send progress" />
                </div>
            )}

            <Tabs value={tab} onValueChange={(v) => setSp((p) => { const n = new URLSearchParams(p); n.set("tab", v); n.delete("page"); return n; }, { replace: true })}>
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <TabsList>
                        <TabsTrigger value="overview">Results</TabsTrigger>
                        <TabsTrigger value="recipients">Recipients</TabsTrigger>
                        <TabsTrigger value="content">Content</TabsTrigger>
                        <TabsTrigger value="approvals">Approvals & runs</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="space-y-6 pt-3">
                    <StatGrid>
                        <StatCard label="Sent" icon={Send} value={formatNumber(c.sent_count)} hint={`${formatNumber(c.audience_count)} in audience · ${formatNumber(c.excluded_count)} skipped`} />
                        <StatCard label="Delivered" icon={CheckCircle2} tone="success" value={pct(s?.rates.delivery_rate)} hint={`${formatNumber(c.delivered_count)} messages`} />
                        <StatCard label={c.channel === "EMAIL" ? "Opened" : "Failed"} icon={c.channel === "EMAIL" ? Eye : TriangleAlert} tone="info" value={c.channel === "EMAIL" ? pct(s?.rates.open_rate) : formatNumber(c.failed_count)} hint={c.channel === "EMAIL" ? `${formatNumber(c.opened_count)} unique opens` : undefined} />
                        <StatCard label="Clicked" icon={MousePointerClick} value={pct(s?.rates.click_rate)} hint={`${pct(s?.rates.bounce_rate)} bounced · ${formatNumber(c.unsubscribed_count)} unsubscribed`} />
                    </StatGrid>
                    {c.ab_test_enabled && <AbResults campaign={c} />}
                    {s && s.series.length > 0 ? (
                        <Section title="Activity" description={s.granularity === "hour" ? "Per hour" : "Per day"}>
                            <div className="rounded-lg border border-border bg-card p-3">
                                <DailySendsChart series={s.series} keys={c.channel === "EMAIL" ? ["sent", "delivered", "opened", "clicked"] : ["sent", "delivered"]} hourly={s.granularity === "hour"} />
                            </div>
                        </Section>
                    ) : (
                        <EmptyState icon={Mail} title="No activity yet" description="Delivery, opens and clicks appear here once the campaign sends." />
                    )}
                    {s && s.links.length > 0 && (
                        <Section title="Top links">
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {s.links.map((l) => (
                                    <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                                        <Link2 className="size-4 shrink-0 text-muted-foreground" />
                                        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{l.original_url}</span>
                                        <span className="text-xs text-muted-foreground tabular">{formatNumber(l.unique_click_count)} unique · {formatNumber(l.click_count)} total</span>
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}
                </TabsContent>

                <TabsContent value="recipients" className="pt-3">
                    {tab === "recipients" && <RecipientsTab campaign={c} />}
                </TabsContent>

                <TabsContent value="content" className="pt-3">
                    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                        <div className="rounded-lg border border-border bg-card p-4">
                            <KeyValueList
                                columns={1}
                                items={[
                                    { label: "From", value: c.sender_identity ? (c.sender_identity.display_name ? `${c.sender_identity.display_name} <${c.sender_identity.address}>` : c.sender_identity.address) : "Provider default" },
                                    { label: "Reply-to", value: c.reply_to_address },
                                    { label: "Template", value: c.template?.name },
                                    { label: "Audience", value: c.audiences.map((a) => `${a.mode === "EXCLUDE" ? "Exclude " : ""}${a.list?.name ?? a.segment?.name}`).join(", ") || null },
                                    { label: "Only opted-in contacts", value: c.require_consent ? "Yes" : "No" },
                                    { label: "Tracking", value: c.tracking_enabled ? "Opens and clicks" : "Off" },
                                    { label: "Throttle", value: c.send_rate_per_hour ? `${formatNumber(c.send_rate_per_hour)} per hour` : "No limit" },
                                    { label: "Topic", value: c.topic?.name ?? "None" },
                                    { label: "Time zone", value: `${c.schedule_timezone ?? "UTC"}${c.send_in_recipient_timezone ? " · recipient's local time" : ""}` },
                                    { label: "Repeats", value: describeRepeat(c.recurrence_rule, c.recurrence_ends_at) },
                                    { label: "Next run", value: c.recurrence_rule && c.status === "SCHEDULED" && c.scheduled_at ? formatDateTime(c.scheduled_at) : null },
                                ]}
                            />
                        </div>
                        {tab === "content" && <ContentPreview channel={c.channel} subject={c.subject ?? ""} preheader={c.preheader ?? ""} body_html={c.body_html ?? ""} body_text={c.body_text ?? ""} />}
                    </div>
                </TabsContent>

                <TabsContent value="approvals" className="space-y-6 pt-3">
                    <Section title="Approvals">
                        {c.approvals.length === 0 ? (
                            <EmptyState compact icon={ShieldCheck} title={c.approval_required ? "Not submitted yet" : "No approval needed"} description={c.approval_required ? "Submit the campaign for approval from the review step." : "Your communication settings do not require approval for this campaign."} />
                        ) : (
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {c.approvals.map((a) => (
                                    <li key={a.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[13px] font-medium text-foreground">{personName(a.approver.user)}</div>
                                            {a.comment && <p className="text-xs text-muted-foreground">{a.comment}</p>}
                                        </div>
                                        <Badge variant={a.decision === "APPROVED" ? "success" : a.decision === "REJECTED" ? "danger" : "warning"}>{a.decision === "APPROVED" ? "Approved" : a.decision === "REJECTED" ? "Rejected" : "Pending"}</Badge>
                                        <span className="text-xs text-muted-foreground">{formatDateTime(a.decided_at ?? a.requested_at)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>
                    <Section title="Runs">
                        {c.runs.length === 0 ? (
                            <EmptyState compact title="Not sent yet" description="Each send of the campaign is recorded as a run." />
                        ) : (
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {c.runs.map((r) => (
                                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-[13px]">
                                        <span className="font-medium text-foreground">Run {r.run_number}</span>
                                        <Badge variant={r.status === "COMPLETED" ? "success" : r.status === "FAILED" ? "danger" : r.status === "RUNNING" ? "info" : "neutral"}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>
                                        <span className="flex-1 text-xs text-muted-foreground">{formatDateTime(r.started_at ?? r.scheduled_for)}</span>
                                        <span className="text-xs text-muted-foreground tabular">{formatNumber(r.sent_count)} sent · {formatNumber(r.failed_count)} failed</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>
                    <Section title="Details">
                        <div className="rounded-lg border border-border bg-card p-4">
                            <KeyValueList items={[
                                { label: "Owner", value: c.owner ? personName(c.owner.user) : null },
                                { label: "Created", value: formatDateTime(c.created_at) },
                                { label: "Approved by", value: c.approved_by ? `${personName(c.approved_by.user)} · ${formatDateTime(c.approved_at)}` : null },
                                { label: "Started", value: c.started_at ? formatDateTime(c.started_at) : null },
                            ]} />
                        </div>
                    </Section>
                </TabsContent>
            </Tabs>

            {conf && (
                <ConfirmationDialog
                    isOpen={!!confirm}
                    onClose={() => setConfirm(null)}
                    title={conf.title}
                    description={conf.description}
                    confirmText={conf.text}
                    variant={conf.destructive ? "destructive" : "default"}
                    onConfirm={() => confirm && run(confirm)}
                />
            )}
            <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{decision === "approve" ? "Approve campaign" : "Send back to draft"}</DialogTitle>
                        <DialogDescription>{decision === "approve" ? "After approval, someone with send permission can schedule or send it." : "Tell the owner what to change."}</DialogDescription>
                    </DialogHeader>
                    <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" aria-label="Comment" />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDecision(null)}>Cancel</Button>
                        <Button variant={decision === "reject" ? "destructive" : "default"} onClick={() => decision && run(decision, { comment: comment || undefined })}>
                            {decision === "approve" ? "Approve" : "Reject"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
