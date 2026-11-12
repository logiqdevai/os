import { useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Flag, Headphones, HardDrive, MessageSquare, Paperclip, UserRoundPlus, Users } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { formatDate, formatNumber } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useMessagingOverview } from "@/features/messaging/hooks/use-messaging-admin";
import { OverviewRangeOptions, RetentionChannelKindOptions } from "@/config/constants/dropdowns/messaging/messaging-admin.options";
import { formatBytes } from "../../components/pending-attachments";
import { MessagesPaths } from "../../messages-paths";
import { AdminNav } from "./admin-nav";

/**
 * /messages/admin — usage overview (aggregates only; no per-person productivity scores, 12 §53).
 * @perm messaging.analytics.read or messaging.settings.manage
 * @api GET /messaging/admin/overview?range=7d|30d|90d
 */
export default function MessagingAdminOverviewPage() {
    const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
    const data = useMessagingOverview(range);
    const o = data.data;
    return (
        <Page>
            <PageHeader
                title="Messaging admin"
                description="How your team uses messages, files and calls."
                actions={
                    <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
                        <SelectTrigger className="h-8 w-36" aria-label="Period"><SelectValue /></SelectTrigger>
                        <SelectContent>{OverviewRangeOptions.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                }
            />
            <AdminNav />
            {data.isPending ? <PageSkeleton /> : data.error ? <ErrorState error={data.error} onRetry={() => data.refetch()} /> : o && (
                <div className="space-y-6">
                    <StatGrid>
                        <StatCard label="Messages" icon={MessageSquare} value={formatNumber(o.totals.messages)} hint={`${formatNumber(o.totals.direct_messages)} direct · ${formatNumber(o.totals.thread_replies)} in threads`} />
                        <StatCard label="Active members" icon={Users} tone="info" value={formatNumber(o.totals.active_members)} hint={`of ${formatNumber(o.totals.members)} members posted`} />
                        <StatCard label="Files shared" icon={Paperclip} value={formatNumber(o.totals.files)} hint={`${formatBytes(o.totals.storage_bytes)} stored in total`} />
                        <StatCard label="Huddles & calls" icon={Headphones} value={formatNumber(o.totals.calls)} hint={`${formatNumber(o.totals.reactions)} reactions`} />
                    </StatGrid>
                    <StatGrid>
                        <StatCard label="Guests & external" icon={UserRoundPlus} value={formatNumber(o.totals.guests)} hint={<Link to={MessagesPaths.adminGuests} className="underline-offset-2 hover:underline">Review access</Link>} />
                        <StatCard label="Open reports" icon={Flag} tone={o.totals.open_reports ? "warning" : "default"} value={formatNumber(o.totals.open_reports)} hint={<Link to={MessagesPaths.adminModeration} className="underline-offset-2 hover:underline">{formatNumber(o.totals.active_restrictions)} active restrictions</Link>} />
                        <StatCard label="Stored files" icon={HardDrive} value={formatNumber(o.totals.stored_files)} hint={formatBytes(o.totals.storage_bytes)} />
                        <StatCard label="Archived channels" value={formatNumber(o.totals.archived_channels)} hint={Object.entries(o.channels_by_kind).map(([k, n]) => `${n} ${getDropdownOptionLabel(RetentionChannelKindOptions, k).toLowerCase()}`).join(" · ") || undefined} />
                    </StatGrid>
                    <Section title="Messages per day">
                        <div className="h-56 w-full rounded-lg border border-border bg-card p-3">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={o.series.map((p) => ({ label: formatDate(p.date, "d MMM"), messages: p.messages }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={24} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
                                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }} labelStyle={{ color: "var(--muted-foreground)" }} />
                                    <Area type="monotone" dataKey="messages" name="Messages" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={1.75} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Section>
                    <Section title="Busiest channels" description="Direct messages are never listed.">
                        {!o.top_channels.length ? (
                            <EmptyState compact icon={MessageSquare} title="No messages in this period" />
                        ) : (
                            <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                {o.top_channels.map((t) => (
                                    <li key={t.channel_id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                                        <Link to={MessagesPaths.channel(t.channel_id)} className="min-w-0 flex-1 truncate font-medium text-foreground hover:underline">#{t.name}</Link>
                                        <span className="text-xs text-muted-foreground tabular">{formatNumber(t.messages)} messages</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>
                </div>
            )}
        </Page>
    );
}
