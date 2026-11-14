import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Lock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ConversationStatusFilterOptions, ConversationViewOptions, SupportChannelTypeOptions } from "@/config/constants/dropdowns/support/support.options";
import { useConversationCounts, useConversations } from "@/features/support/hooks/use-support";
import type { ConversationCounts, ConversationListItem } from "@/features/support/interfaces/support.interfaces";
import { PriorityBadge, SlaChip } from "../../../components/support-badges";

interface ConversationListProps {
    selectedId?: string;
    view: string;
    status: string;
    search: string;
    page: number;
    onView: (v: string) => void;
    onStatus: (v: string) => void;
    onSearch: (v: string) => void;
    onPage: (p: number) => void;
    hrefFor: (id: string) => string;
}

const customerLabel = (c: ConversationListItem) => c.customer_name || (c.contact ? `${c.contact.first_name} ${c.contact.last_name ?? ""}`.trim() : null) || (c.customer ? personName(c.customer) : null) || c.customer_email || "Unknown customer";

/** Left pane of the inbox: view (with counts), status, search and the conversation rows. */
export function ConversationList({ selectedId, view, status, search, page, onView, onStatus, onSearch, onPage, hrefFor }: ConversationListProps) {
    const counts = useConversationCounts();
    const list = useConversations({ view, status: status === "all" ? undefined : status, search: search || undefined, page, limit: 30 });
    const count = (id: string) => counts.data?.[id as keyof ConversationCounts];

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="space-y-2 border-b border-border p-3">
                <Select value={view} onValueChange={onView}>
                    <SelectTrigger className="h-8" aria-label="Inbox view">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ConversationViewOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                                {o.label}
                                {count(o.id) !== undefined && <span className="ml-1 text-muted-foreground tabular">({count(o.id)})</span>}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Tabs value={status} onValueChange={onStatus}>
                    <TabsList className="h-8 w-full">
                        {ConversationStatusFilterOptions.map((o) => <TabsTrigger key={o.id} value={o.id} className="flex-1 px-2 py-0.5 text-xs">{o.label}</TabsTrigger>)}
                    </TabsList>
                </Tabs>
                <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search conversations…" className="h-8" aria-label="Search conversations" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {list.isLoading ? (
                    <ListSkeleton rows={8} />
                ) : list.error ? (
                    <ErrorState error={list.error} onRetry={() => list.refetch()} />
                ) : !list.data?.data.length ? (
                    <EmptyState compact icon={Inbox} title={search ? "No conversations match" : "Inbox zero"} description={search ? "Try another search." : "Nothing waiting in this view."} />
                ) : (
                    <ul className={cn(list.isFetching && "opacity-80")}>
                        {list.data.data.map((c) => (
                            <li key={c.id}>
                                <Link
                                    to={hrefFor(c.id)}
                                    className={cn("block border-b border-border-soft px-3 py-2.5 transition-colors hover:bg-secondary/60", selectedId === c.id && "bg-secondary")}
                                    aria-current={selectedId === c.id ? "true" : undefined}
                                >
                                    <div className="flex items-center gap-2">
                                        {c.unread && <span className="size-2 shrink-0 rounded-full bg-info" aria-label="Unread" />}
                                        <span className={cn("min-w-0 flex-1 truncate text-[13px]", c.unread ? "font-semibold text-foreground" : "font-medium text-foreground")}>{customerLabel(c)}</span>
                                        <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelative(c.last_message_at ?? c.created_at)}</span>
                                    </div>
                                    <div className="mt-0.5 truncate text-[12.5px] text-foreground">{c.subject || "No subject"}</div>
                                    <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                        {c.last_message?.kind === "INTERNAL_NOTE" && <Lock className="size-3 shrink-0 text-warning" />}
                                        <span className="truncate">{c.last_message?.body ?? ""}</span>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                        <Badge variant="outline">{getDropdownOptionLabel(SupportChannelTypeOptions, c.channel_type)}</Badge>
                                        {c.priority !== "NORMAL" && <PriorityBadge priority={c.priority} />}
                                        {c.primary_tickets[0] && <Badge variant="neutral">{c.primary_tickets[0].reference}</Badge>}
                                        {c.primary_tickets.some((t) => t.sla_breached || t.sla_at_risk) && <SlaChip compact breached={c.primary_tickets.some((t) => t.sla_breached)} atRisk />}
                                        <span className="ml-auto"><MemberAvatar person={c.assignee?.user} size="xs" /></span>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {list.data && list.data.pagination.total_pages > 1 && (
                <div className="border-t border-border px-2 py-1.5">
                    <Pagination currentPage={page} totalPages={list.data.pagination.total_pages} onPageChange={onPage} />
                </div>
            )}
        </div>
    );
}
