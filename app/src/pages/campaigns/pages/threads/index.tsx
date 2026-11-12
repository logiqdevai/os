import { Mail, MessageSquareText, MessagesSquare } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParams } from "@/hooks/use-list-params";
import { formatRelative } from "@/lib/format";
import { useThreads } from "@/features/communications/hooks/use-ai-threads";
import type { CommThreadListItem } from "@/features/communications/interfaces/ai-threads.interfaces";
import { CommChannelFilterOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { MessageStatusBadge } from "../../components/comm-badges";
import { CampaignPaths } from "../../campaign-paths";

const who = (t: CommThreadListItem) =>
    t.contact ? [t.contact.first_name, t.contact.last_name].filter(Boolean).join(" ") : t.last_message?.to_name ?? t.last_message?.to_address ?? "Unknown recipient";

/**
 * /campaigns/threads — conversation threads of one-off email and SMS (CommThread).
 * @perm VIEW communications.messages.read
 * @api GET /communications/threads?channel=&search=&archived=
 */
export default function ThreadsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const threads = useThreads(params);
    const archived = filters.archived === "true";

    const columns: DataTableColumn<CommThreadListItem>[] = [
        {
            key: "who",
            header: "Conversation",
            cell: (t) => {
                const Icon = t.channel === "EMAIL" ? Mail : MessageSquareText;
                return (
                    <div className="flex min-w-0 items-start gap-2">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{who(t)}{t.company ? <span className="font-normal text-muted-foreground"> · {t.company.name}</span> : null}</div>
                            <div className="truncate text-xs text-muted-foreground">{t.subject ?? t.last_message?.body_text ?? "SMS conversation"}</div>
                        </div>
                    </div>
                );
            },
        },
        { key: "count", header: "Messages", hideBelow: "sm", cell: (t) => <span className="tabular text-muted-foreground">{t.visible_message_count}</span> },
        { key: "status", header: "Last message", hideBelow: "md", cell: (t) => (t.last_message ? <MessageStatusBadge status={t.last_message.status} /> : null) },
        { key: "when", header: "Activity", cell: (t) => <span className="whitespace-nowrap text-muted-foreground">{formatRelative(t.last_message_at ?? t.last_message?.created_at)}</span> },
    ];

    return (
        <Page>
            <PageHeader title="Threads" description="Email and SMS conversations with customers, grouped by contact and subject." />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search subject, contact or address…">
                <Select value={filters.channel ?? "all"} onValueChange={(v) => setFilter("channel", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by channel"><SelectValue /></SelectTrigger>
                    <SelectContent>{CommChannelFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={archived ? "true" : "all"} onValueChange={(v) => setFilter("archived", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-32" aria-label="Open or archived"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Open</SelectItem><SelectItem value="true">Archived</SelectItem></SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={threads.data?.data}
                rowKey={(t) => t.id}
                loading={threads.isFetching}
                error={threads.error}
                onRetry={() => threads.refetch()}
                pagination={threads.data?.pagination}
                onPageChange={setPage}
                rowHref={(t) => CampaignPaths.thread(t.id)}
                empty={{ icon: MessagesSquare, title: archived ? "No archived threads" : "No conversations yet", description: "Messages you send to contacts from the message log, CRM or other modules are grouped here." }}
            />
        </Page>
    );
}
