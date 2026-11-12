import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClockOff, CheckCircle2, ChevronLeft, Clock, PanelRight, RotateCcw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EntityPicker } from "@/components/ui/entity-picker";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { SnoozeOptions, SupportChannelTypeOptions } from "@/config/constants/dropdowns/support/support.options";
import {
    useAgents,
    useAssignConversation,
    useCloseConversation,
    useConversation,
    useMarkConversationRead,
    usePostConversationMessage,
    useReopenConversation,
    useSnoozeConversation,
} from "@/features/support/hooks/use-support";
import { ConversationStatusBadge, PriorityBadge } from "../../../components/support-badges";
import { MessageThread } from "../../../components/message-thread";
import { ReplyComposer } from "../../../components/reply-composer";
import { ConversationDetails } from "./conversation-details";
import { AiSessionBanner } from "./ai-session-banner";
import { TypingLine } from "./typing-line";
import type { SupportTypingEvent } from "@/features/support/interfaces/support.interfaces";
import { SUPPORT_PATHS } from "../../../support-paths";

function snoozeUntil(option: string): string {
    const d = new Date();
    if (option === "1h") d.setHours(d.getHours() + 1);
    else if (option === "4h") d.setHours(d.getHours() + 4);
    else if (option === "tomorrow") { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    else { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); }
    return d.toISOString();
}

/** Middle pane: header actions (assign, snooze, resolve), the thread and the reply / note composer. */
export function ConversationPane({ id, showDetailsInline, typing = [], onTyping }: { id: string; showDetailsInline: boolean; typing?: SupportTypingEvent[]; onTyping?: (internal: boolean) => void }) {
    const conv = useConversation(id);
    const agents = useAgents();
    const post = usePostConversationMessage();
    const assign = useAssignConversation();
    const snooze = useSnoozeConversation();
    const close = useCloseConversation();
    const reopen = useReopenConversation();
    const markRead = useMarkConversationRead();
    const canAssign = usePermission("support.conversations.assign");
    const [detailsOpen, setDetailsOpen] = useState(false);
    const bottom = useRef<HTMLDivElement>(null);
    const c = conv.data;

    useEffect(() => {
        if (c?.id) markRead.mutate(c.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [c?.id, c?.messages.length]);
    useEffect(() => {
        bottom.current?.scrollIntoView({ block: "end" });
    }, [c?.id, c?.messages.length]);

    const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

    if (conv.isLoading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-6 w-1/2" />
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-3/4" />)}
            </div>
        );
    }
    if (conv.error || !c) return <ErrorState error={conv.error} onRetry={() => conv.refetch()} />;

    const resolved = c.status === "RESOLVED";
    const assigneeItems = (agents.data ?? []).map((a) => ({ id: a.id, label: personName(a.user), keywords: a.user.email ?? "", hint: a.open_conversations ? `${a.open_conversations} open` : undefined }));

    return (
        <div className="flex h-full min-h-0">
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                    <Button asChild variant="ghost" size="icon-sm" className="md:hidden" aria-label="Back to inbox">
                        <Link to={SUPPORT_PATHS.inbox}><ChevronLeft /></Link>
                    </Button>
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[14px] font-medium text-foreground">{c.subject || "No subject"}</h2>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <ConversationStatusBadge status={c.status} />
                            {c.priority !== "NORMAL" && <PriorityBadge priority={c.priority} />}
                            <span>{getDropdownOptionLabel(SupportChannelTypeOptions, c.channel_type)}</span>
                            {c.merged_into && <Badge variant="warning">Merged</Badge>}
                        </div>
                    </div>
                    {canAssign ? (
                        <EntityPicker
                            items={assigneeItems}
                            value={c.assignee?.id ?? null}
                            onChange={(v) => assign.mutate({ id: c.id, assignee_membership_id: v }, { onSuccess: () => toast({ title: v ? "Assigned" : "Unassigned" }), onError: fail("Could not assign") })}
                            noneLabel="Unassigned"
                            ariaLabel="Assignee"
                            align="end"
                            trigger={
                                <Button variant="outline" size="sm" className="max-w-40">
                                    {c.assignee ? <MemberAvatar person={c.assignee.user} size="xs" /> : <UserRound />}
                                    <span className="hidden truncate sm:inline">{c.assignee ? personName(c.assignee.user) : "Assign"}</span>
                                </Button>
                            }
                        />
                    ) : (
                        <MemberAvatar person={c.assignee?.user} showName size="xs" />
                    )}
                    <Can permission="support.conversations.update">
                        {!resolved && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon-sm" aria-label="Snooze"><Clock /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Snooze until</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {SnoozeOptions.map((o) => (
                                        <DropdownMenuItem key={o.id} onSelect={() => snooze.mutate({ id: c.id, until: snoozeUntil(o.id) }, { onSuccess: () => toast({ title: `Snoozed · ${o.label}` }), onError: fail("Could not snooze") })}>
                                            {o.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </Can>
                    <Can permission="support.conversations.close">
                        {resolved || c.status === "SNOOZED" ? (
                            <Button size="sm" variant="outline" loading={reopen.isPending} onClick={() => reopen.mutate(c.id, { onSuccess: () => toast({ title: "Reopened" }), onError: fail("Could not reopen") })}>
                                {c.status === "SNOOZED" ? <AlarmClockOff /> : <RotateCcw />} <span className="hidden sm:inline">{c.status === "SNOOZED" ? "Unsnooze" : "Reopen"}</span>
                            </Button>
                        ) : (
                            <Button size="sm" loading={close.isPending} onClick={() => close.mutate(c.id, { onSuccess: () => toast({ title: "Resolved" }), onError: fail("Could not resolve") })}>
                                <CheckCircle2 /> <span className="hidden sm:inline">Resolve</span>
                            </Button>
                        )}
                    </Can>
                    {!showDetailsInline && (
                        <Button variant="ghost" size="icon-sm" aria-label="Conversation details" onClick={() => setDetailsOpen(true)}><PanelRight /></Button>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-background px-3 py-4 md:px-6">
                    {c.merged_into && (
                        <div className="mb-4 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-foreground">
                            Merged into <Link className="text-info hover:underline" to={SUPPORT_PATHS.conversation(c.merged_into.id)}>{c.merged_into.subject || "another conversation"}</Link>. Reply there.
                        </div>
                    )}
                    <MessageThread messages={c.messages} />
                    <div ref={bottom} />
                </div>
                <AiSessionBanner conversationId={c.id} />
                <TypingLine typing={typing} />

                <div className="border-t border-border p-2 md:p-3">
                    <ReplyComposer
                        conversationId={c.id}
                        ticketId={c.primary_tickets[0]?.id}
                        allowResolve
                        sending={post.isPending}
                        disabledReason={c.merged_into ? "This conversation was merged" : null}
                        onTyping={onTyping}
                        onSend={({ kind, body, canned_response_id, resolve }) =>
                            post.mutateAsync({ id: c.id, kind, body, canned_response_id, then_status: resolve ? "RESOLVED" : undefined }).then(() => toast({ title: kind === "AGENT" ? (resolve ? "Sent and resolved" : "Reply sent") : "Note added" }))
                        }
                    />
                </div>
            </div>

            {showDetailsInline ? (
                <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border xl:block">
                    <ConversationDetails conversation={c} />
                </aside>
            ) : null}
            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
                <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-sm">
                    <SheetHeader className="border-b border-border p-4">
                        <SheetTitle>Details</SheetTitle>
                    </SheetHeader>
                    <ConversationDetails conversation={c} />
                </SheetContent>
            </Sheet>
        </div>
    );
}
