import { useState } from "react";
import { Inbox, Mail, MessageSquareText, PenSquare } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { formatDateTime } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useCommMessages } from "@/features/communications/hooks/use-communications";
import type { CommMessage } from "@/features/communications/interfaces/communications.interfaces";
import { CommMessageKindFilterOptions, CommMessageKindFormOptions, CommMessageStatusFilterOptions } from "@/config/constants/dropdowns/communications/comm-message-status-filter.options";
import { CommChannelFilterOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { MessageStatusBadge } from "../../components/comm-badges";
import { ComposeMessageDialog } from "../../components/compose-message-dialog";
import { CampaignPaths } from "../../campaign-paths";

/**
 * /campaigns/messages — communication history (one-off, campaign and transactional sends).
 * @perm VIEW communications.messages.read · compose communications.messages.send
 * @api GET /communications/messages?channel=&kind=&status=&search= · POST /communications/messages
 */
export default function MessagesLogPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const messages = useCommMessages(params);
    const [composeOpen, setComposeOpen] = useState(false);

    const columns: DataTableColumn<CommMessage>[] = [
        {
            key: "to",
            header: "To",
            cell: (m) => {
                const Icon = m.channel === "EMAIL" ? Mail : MessageSquareText;
                return (
                    <div className="flex min-w-0 items-center gap-2">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{m.to_name ?? m.to_address}</div>
                            <div className="truncate text-xs text-muted-foreground">{m.subject ?? m.to_address}</div>
                        </div>
                    </div>
                );
            },
        },
        { key: "status", header: "Status", cell: (m) => <MessageStatusBadge status={m.status} /> },
        { key: "kind", header: "Kind", hideBelow: "md", cell: (m) => <span className="text-muted-foreground">{m.campaign?.name ?? getDropdownOptionLabel(CommMessageKindFormOptions, m.kind)}</span> },
        { key: "engagement", header: "Opens / clicks", hideBelow: "lg", cell: (m) => <span className="tabular text-muted-foreground">{m.channel === "EMAIL" ? `${m.open_count} / ${m.click_count}` : "—"}</span> },
        { key: "when", header: "When", hideBelow: "sm", cell: (m) => <span className="text-muted-foreground">{formatDateTime(m.sent_at ?? m.scheduled_at ?? m.created_at)}</span> },
    ];

    return (
        <Page>
            <PageHeader
                title="Message log"
                description="Every email and SMS sent from the platform, with delivery status."
                actions={<Can permission="communications.messages.send"><Button onClick={() => setComposeOpen(true)}><PenSquare /> New message</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search recipient or subject…">
                <Select value={filters.channel ?? "all"} onValueChange={(v) => setFilter("channel", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by channel"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommChannelFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.kind ?? "all"} onValueChange={(v) => setFilter("kind", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by kind"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommMessageKindFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommMessageStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={messages.data?.data}
                rowKey={(m) => m.id}
                loading={messages.isFetching}
                error={messages.error}
                onRetry={() => messages.refetch()}
                pagination={messages.data?.pagination}
                onPageChange={setPage}
                rowHref={(m) => CampaignPaths.message(m.id)}
                empty={{ icon: Inbox, title: search || filters.status || filters.kind || filters.channel ? "No messages match your filters" : "No messages yet", description: "Campaign sends, one-off messages and transactional emails appear here." }}
            />
            <ComposeMessageDialog open={composeOpen} onOpenChange={setComposeOpen} />
        </Page>
    );
}
