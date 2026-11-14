import { useRef, useState, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Flag, MessageSquareReply, MoreHorizontal, Pencil, Pin, PinOff, SmilePlus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { patchMessageEverywhere, useDeleteMessage, useEditMessage, usePostMessage, useSetPinned, useSetSaved, useToggleReaction } from "@/features/messaging/hooks/use-messaging";
import type { Message } from "@/features/messaging/interfaces/messaging.interfaces";
import { QuickReactionOptions } from "@/config/constants/dropdowns/messaging/messaging.options";
import { textToTokens, tokensToText } from "../utils/message-body";
import { MessageBody } from "./message-body";
import { useMessaging } from "./messaging-context";
import { PersonAvatar } from "./person-avatar";
import { MessageAttachments } from "./message-attachments";
import { ReportMessageDialog } from "./report-message-dialog";

interface MessageItemProps {
    message: Message;
    /** Same author within a few minutes: hide avatar and name. */
    compact?: boolean;
    onOpenThread?: (rootId: string) => void;
    inThread?: boolean;
    canPost: boolean;
}

/** One message: grouped header, body, reactions, thread summary and a hover toolbar (react, reply, edit, delete, pin, save). */
export function MessageItem({ message: m, compact, onOpenThread, inThread, canPost }: MessageItemProps) {
    const qc = useQueryClient();
    const { myMembershipId, presenceOf } = useMessaging();
    const { can } = usePermissions();
    const react = useToggleReaction();
    const edit = useEditMessage();
    const del = useDeleteMessage();
    const pin = useSetPinned();
    const save = useSetSaved();
    const post = usePostMessage();
    const [editing, setEditing] = useState<{ text: string; mentions: Record<string, string> } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    // Edit swaps the toolbar out; doing that while the menu is still closing detaches its anchor and the menu jumps to the top-left.
    const startEditAfterClose = useRef(false);
    const [reporting, setReporting] = useState(false);

    const mine = !!m.author?.membership_id && m.author.membership_id === myMembershipId;
    const pending = !!m.pending;
    /** Send a refused message again with the same client_message_id (the server dedupes; the row flips back to "sending"). */
    const retry = () =>
        post.mutate({
            channelId: m.channel_id,
            body: m.body,
            parent_message_id: m.parent_message_id ?? undefined,
            client_message_id: m.client_message_id ?? undefined,
            ...(m.attachments.length && { attachments: m.attachments.map((a) => ({ document_id: a.document_id, file_name: a.file_name, mime_type: a.mime_type, size_bytes: a.size_bytes ?? 0, kind: a.kind })) }),
            optimistic: m,
        });

    if (m.kind === "SYSTEM") {
        return (
            <div className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border-soft" />
                <span className="max-w-[80%] truncate">{m.body_plain ?? m.body}</span>
                <span className="h-px flex-1 bg-border-soft" />
            </div>
        );
    }
    if (m.deleted_at) {
        return (
            <div className="px-4 py-1 pl-14 text-[13px] italic text-muted-foreground">
                This message was deleted.
                {!inThread && m.reply_count > 0 && onOpenThread && (
                    <button type="button" className="ml-2 not-italic text-primary hover:underline" onClick={() => onOpenThread(m.id)}>{m.reply_count} {m.reply_count === 1 ? "reply" : "replies"}</button>
                )}
            </div>
        );
    }

    const toggle = (emoji: string) => {
        setPickerOpen(false);
        react.mutate({ id: m.id, emoji, channel_id: m.channel_id, me: myMembershipId ?? undefined });
    };

    const saveEdit = () => {
        if (!editing) return;
        const body = textToTokens(editing.text.trim(), editing.mentions);
        if (!body) return;
        // Optimistic: the new text shows at once and the editor closes; it rolls back if the API refuses.
        edit.mutate({ id: m.id, body, channel_id: m.channel_id });
        setEditing(null);
    };
    const onEditKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
        if (e.key === "Escape") setEditing(null);
    };

    const canDelete = mine || can("messaging.messages.delete_any");
    const canPin = can("messaging.messages.pin");
    const integration = m.kind === "INTEGRATION";
    const authorName = integration ? m.integration_source ?? "Integration" : m.author?.name ?? "Unknown";
    const canReport = !mine && !integration && !!myMembershipId;

    return (
        <div className={cn("group relative flex gap-3 px-4 hover:bg-accent/40", compact ? "py-0.5" : "pt-2 pb-0.5", m.pinned_at && "bg-warning-soft/40")}>
            <div className="w-8 shrink-0">
                {compact ? (
                    <span className="invisible block pt-1 text-[10px] text-muted-foreground tabular group-hover:visible">{formatDate(m.created_at, "HH:mm")}</span>
                ) : (
                    <PersonAvatar name={authorName} src={m.author?.profile_photo_url} presence={m.author?.membership_id ? presenceOf(m.author.membership_id) : undefined} />
                )}
            </div>
            <div className="min-w-0 flex-1">
                {!compact && (
                    <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[13.5px] font-semibold text-foreground">{authorName}</span>
                        {integration && <span className="rounded-xs bg-info-soft px-1 text-[10px] font-medium text-info">App</span>}
                        {m.author?.external && <span className="rounded-xs bg-violet-soft px-1 text-[10px] font-medium text-violet">External</span>}
                        <time className="text-[11px] text-muted-foreground" dateTime={m.created_at} title={formatDateTime(m.created_at)}>{formatDate(m.created_at, "HH:mm")}</time>
                        {m.pinned_at && <span className="flex items-center gap-0.5 text-[11px] text-warning"><Pin className="size-3" /> Pinned</span>}
                    </div>
                )}
                {editing ? (
                    <div className="space-y-1.5 py-1">
                        <Textarea autoFocus value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} onKeyDown={onEditKey} rows={2} className="text-[13.5px]" aria-label="Edit message" />
                        <div className="flex gap-2 text-xs text-muted-foreground">
                            <Button size="sm" onClick={saveEdit}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                            <span className="self-center">Enter to save · Esc to cancel</span>
                        </div>
                    </div>
                ) : (
                    <div className={cn(pending && "opacity-60")}>
                        <MessageBody body={m.body} />
                        {m.is_edited && <span className="text-[11px] text-muted-foreground"> (edited)</span>}
                    </div>
                )}
                {m.pending === "failed" && (
                    <div role="alert" className="flex items-center gap-2 text-xs text-danger">
                        Not sent.
                        <button type="button" className="font-medium underline" onClick={retry}>Retry</button>
                        <button type="button" className="underline" onClick={() => patchMessageEverywhere(qc, m.channel_id, m.id, () => null)}>Dismiss</button>
                    </div>
                )}
                {m.pending === "sending" && <span role="status" className="sr-only">Sending…</span>}
                {m.attachments.length > 0 && <MessageAttachments attachments={m.attachments} pending={pending} />}
                {m.reactions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {m.reactions.map((r) => {
                            const reacted = !!myMembershipId && r.membership_ids.includes(myMembershipId);
                            return (
                                <button
                                    key={r.emoji}
                                    type="button"
                                    onClick={() => toggle(r.emoji)}
                                    disabled={!canPost}
                                    className={cn("flex h-6 items-center gap-1 rounded-full border px-2 text-xs transition-colors", reacted ? "border-primary/40 bg-info-soft text-info" : "border-border bg-card text-muted-foreground hover:border-border-strong")}
                                    aria-pressed={reacted}
                                    aria-label={`${r.emoji} ${r.count}`}
                                >
                                    <span>{r.emoji}</span>
                                    <span className="tabular">{r.count}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
                {!inThread && m.reply_count > 0 && onOpenThread && (
                    <button type="button" onClick={() => onOpenThread(m.id)} className="mt-1 flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs font-medium text-primary hover:bg-accent">
                        <MessageSquareReply className="size-3.5" />
                        {m.reply_count} {m.reply_count === 1 ? "reply" : "replies"}
                        {m.last_reply_at && <span className="font-normal text-muted-foreground">· last {formatDateTime(m.last_reply_at)}</span>}
                    </button>
                )}
            </div>

            {!pending && !editing && (
                <div className={cn("absolute -top-3 right-4 hidden items-center rounded-md border border-border bg-popover shadow-sm group-hover:flex group-focus-within:flex", (pickerOpen || menuOpen) && "flex")}>
                    {canPost && (
                        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                            <PopoverTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Add reaction"><SmilePlus /></Button></PopoverTrigger>
                            <PopoverContent className="w-auto p-1" align="end">
                                <div className="flex gap-0.5">
                                    {QuickReactionOptions.map((r) => (
                                        <button key={r.id} type="button" onClick={() => toggle(r.id)} className="grid size-8 place-items-center rounded-md text-lg hover:bg-accent" aria-label={r.label}>{r.id}</button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                    {!inThread && onOpenThread && canPost && <Button variant="ghost" size="icon-sm" aria-label="Reply in thread" onClick={() => onOpenThread(m.id)}><MessageSquareReply /></Button>}
                    <Button variant="ghost" size="icon-sm" aria-label={m.is_saved ? "Remove from saved" : "Save"} onClick={() => save.mutate({ id: m.id, saved: !m.is_saved, channel_id: m.channel_id })}>
                        {m.is_saved ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
                    </Button>
                    {(mine || canPin || canDelete || canReport) && (
                        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onCloseAutoFocus={(e) => { if (startEditAfterClose.current) { e.preventDefault(); startEditAfterClose.current = false; setEditing(tokensToText(m.body)); } }}>
                                {mine && canPost && <DropdownMenuItem onSelect={() => { startEditAfterClose.current = true; }}><Pencil /> Edit</DropdownMenuItem>}
                                {canPin && !m.parent_message_id && (
                                    <DropdownMenuItem onSelect={() => pin.mutate({ id: m.id, pinned: !m.pinned_at, channel_id: m.channel_id })}>
                                        {m.pinned_at ? <PinOff /> : <Pin />} {m.pinned_at ? "Unpin" : "Pin to channel"}
                                    </DropdownMenuItem>
                                )}
                                {canReport && <DropdownMenuItem onSelect={() => setReporting(true)}><Flag /> Report message</DropdownMenuItem>}
                                {canDelete && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(true)}><Trash2 /> Delete</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}
            {pending && m.pending === "failed" && <X className="absolute right-4 top-2 size-4 text-danger" aria-hidden />}

            {reporting && <ReportMessageDialog messageId={m.id} open={reporting} onOpenChange={setReporting} />}
            <ConfirmationDialog
                isOpen={deleting}
                onClose={() => setDeleting(false)}
                title="Delete message?"
                description={m.reply_count > 0 ? "The message is removed; its thread replies stay visible." : "This cannot be undone."}
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { del.mutate({ id: m.id, channel_id: m.channel_id }); setDeleting(false); }}
            />
        </div>
    );
}
