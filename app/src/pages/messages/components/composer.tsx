import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AtSign, Paperclip, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { messagingKeys, upsertChannelMessage, upsertThreadReply, useDraft, usePostMessage, useSaveDraft } from "@/features/messaging/hooks/use-messaging";
import type { Message, UploadedAttachment } from "@/features/messaging/interfaces/messaging.interfaces";
import { useUploadAttachment } from "@/features/messaging/hooks/use-messaging-admin";
import { PendingAttachments, type PendingFile } from "./pending-attachments";
import { useSessionData } from "@/features/session/hooks/use-session";
import { personName } from "@/lib/format";
import { textToTokens, tokensToText, type MentionMap } from "../utils/message-body";
import { useMessaging } from "./messaging-context";
import { PersonAvatar } from "./person-avatar";

const MENTION_QUERY = /(^|\s)@([\p{L}\p{N}._-]{0,40})$/u;
const BROADCASTS = [
    { key: "channel", label: "@channel", hint: "Notify everyone in this conversation" },
    { key: "here", label: "@here", hint: "Notify everyone who is online" },
];

interface ComposerProps {
    channelId: string;
    threadRootId?: string;
    placeholder: string;
    disabled?: boolean;
    disabledReason?: string;
    autoFocus?: boolean;
}

/**
 * Message composer: Enter sends, Shift+Enter adds a line, `@` opens member autocomplete (Popover + Command), the draft is
 * saved to the server while typing (PUT /messaging/channels/:id/draft) and typing is broadcast over the socket.
 * Sends optimistically with a client_message_id so the socket echo and the REST response merge into one message.
 */
export function Composer({ channelId, threadRootId, placeholder, disabled, disabledReason, autoFocus }: ComposerProps) {
    const qc = useQueryClient();
    const session = useSessionData();
    const { directory, myMembershipId, sendTyping, presenceOf } = useMessaging();
    const draft = useDraft(channelId, threadRootId);
    const saveDraft = useSaveDraft();
    const post = usePostMessage();
    const [text, setText] = useState("");
    const [mentions, setMentions] = useState<MentionMap>({});
    const [query, setQuery] = useState<string | null>(null);
    const [active, setActive] = useState("");
    const ref = useRef<HTMLTextAreaElement>(null);
    const loadedDraft = useRef(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const fileRef = useRef<HTMLInputElement>(null);
    const upload = useUploadAttachment();
    const [files, setFiles] = useState<PendingFile[]>([]);
    const uploading = files.some((f) => f.state === "uploading");
    const ready = files.filter((f): f is PendingFile & { uploaded: UploadedAttachment } => f.state === "done" && !!f.uploaded);

    const addFiles = (list: FileList | File[]) => {
        for (const file of Array.from(list).slice(0, 10 - files.length)) {
            const key = crypto.randomUUID();
            setFiles((prev) => [...prev, { key, name: file.name, size: file.size, progress: 0, state: "uploading" }]);
            upload.mutate(
                { channelId, file, onProgress: (progress) => setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, progress } : f))) },
                {
                    onSuccess: (uploaded) => setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, state: "done", progress: 100, uploaded } : f))),
                    onError: (e) => {
                        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, state: "failed", error: getApiErrorMessage(e) } : f)));
                        toast({ variant: "destructive", title: `${file.name} was not uploaded`, description: getApiErrorMessage(e) });
                    },
                },
            );
        }
    };

    useEffect(() => {
        if (loadedDraft.current || draft.isPending) return;
        loadedDraft.current = true;
        if (draft.data?.body) {
            const parsed = tokensToText(draft.data.body);
            setText(parsed.text);
            setMentions(parsed.mentions);
        }
    }, [draft.isPending, draft.data]);

    useEffect(() => () => clearTimeout(saveTimer.current), []);

    const suggestions = useMemo(() => {
        if (query === null) return [];
        const q = query.toLowerCase();
        return directory.filter((m) => !m.is_me && (m.name.toLowerCase().includes(q) || m.email.toLowerCase().startsWith(q))).slice(0, 8);
    }, [query, directory]);
    const broadcasts = query === null ? [] : BROADCASTS.filter((b) => b.key.startsWith(query.toLowerCase()));
    const options = [...suggestions.map((s) => s.membership_id), ...broadcasts.map((b) => `@${b.key}`)];
    const open = query !== null && options.length > 0;

    useEffect(() => {
        if (open && !options.includes(active)) setActive(options[0]);
    }, [open, options, active]);

    const scheduleDraftSave = (value: string, map: MentionMap) => {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            saveDraft.mutate({ channelId, body: textToTokens(value, map), thread_root_message_id: threadRootId });
        }, 800);
    };

    const onChange = (value: string) => {
        setText(value);
        const caret = ref.current?.selectionStart ?? value.length;
        const match = value.slice(0, caret).match(MENTION_QUERY);
        setQuery(match ? match[2] : null);
        if (value.trim()) sendTyping(channelId, threadRootId);
        scheduleDraftSave(value, mentions);
    };

    const pick = (option: string) => {
        const el = ref.current;
        const caret = el?.selectionStart ?? text.length;
        const before = text.slice(0, caret).replace(MENTION_QUERY, (_m, pre: string) => pre);
        let insert: string;
        let nextMentions = mentions;
        if (option.startsWith("@")) insert = `${option} `;
        else {
            const member = directory.find((m) => m.membership_id === option);
            if (!member) return;
            insert = `@${member.name} `;
            nextMentions = { ...mentions, [member.name]: member.membership_id };
            setMentions(nextMentions);
        }
        const next = `${before}${insert}${text.slice(caret)}`;
        setText(next);
        setQuery(null);
        scheduleDraftSave(next, nextMentions);
        requestAnimationFrame(() => {
            const pos = before.length + insert.length;
            el?.focus();
            el?.setSelectionRange(pos, pos);
        });
    };

    const send = () => {
        const trimmed = text.trim();
        if ((!trimmed && !ready.length) || disabled || uploading) return;
        const attachments = ready.map((f) => f.uploaded);
        const body = textToTokens(trimmed, mentions);
        const client_message_id = crypto.randomUUID();
        const user = session?.user;
        const optimistic: Message = {
            id: `tmp-${client_message_id}`,
            channel_id: channelId,
            kind: "USER",
            visibility: "INTERNAL",
            status: "SENDING",
            body,
            body_plain: trimmed,
            parent_message_id: threadRootId ?? null,
            reply_count: 0,
            last_reply_at: null,
            is_edited: false,
            edited_at: null,
            deleted_at: null,
            pinned_at: null,
            system_event: null,
            client_message_id,
            created_at: new Date().toISOString(),
            author: { membership_id: myMembershipId ?? null, user_id: user?.id ?? "", name: personName(user), profile_photo_url: user?.profile_photo_url ?? null, job_title: null, external: false },
            reactions: [],
            attachments: attachments.map((a) => ({ id: a.document_id, document_id: a.document_id, kind: a.kind, file_name: a.file_name, mime_type: a.mime_type, size_bytes: a.size_bytes })),
            mentioned_membership_ids: Object.values(mentions),
            mentions_channel: false,
            pending: "sending",
        };
        if (threadRootId) upsertThreadReply(qc, optimistic);
        else upsertChannelMessage(qc, optimistic);
        clearTimeout(saveTimer.current);
        setText("");
        setMentions({});
        setQuery(null);
        setFiles([]);
        qc.setQueryData(messagingKeys.draft(channelId, threadRootId), null);
        post.mutate(
            { channelId, body, parent_message_id: threadRootId, client_message_id, ...(attachments.length && { attachments }) },
            {
                onError: (e) => {
                    const failed = { ...optimistic, pending: "failed" as const };
                    if (threadRootId) upsertThreadReply(qc, failed);
                    else upsertChannelMessage(qc, failed);
                    setText(trimmed);
                    setFiles(attachments.map((a) => ({ key: a.document_id, name: a.file_name, size: a.size_bytes, progress: 100, state: "done" as const, uploaded: a })));
                    toast({ variant: "destructive", title: "Message not sent", description: getApiErrorMessage(e) });
                },
            },
        );
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (open) {
            const idx = Math.max(0, options.indexOf(active));
            if (e.key === "ArrowDown") { e.preventDefault(); setActive(options[(idx + 1) % options.length]); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive(options[(idx - 1 + options.length) % options.length]); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(active || options[0]); return; }
            if (e.key === "Escape") { e.preventDefault(); setQuery(null); return; }
        }
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
        }
    };

    if (disabled) {
        return <div className="rounded-lg border border-border bg-secondary px-3 py-2.5 text-[13px] text-muted-foreground">{disabledReason ?? "You can't post here."}</div>;
    }

    return (
        <Popover open={open} onOpenChange={(o) => !o && setQuery(null)}>
            <PopoverAnchor asChild>
                <div
                    className="rounded-lg border border-border bg-card p-1.5 focus-within:border-border-strong"
                    onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
                    onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } }}
                >
                <PendingAttachments files={files} onRemove={(key) => setFiles((prev) => prev.filter((f) => f.key !== key))} />
                <div className="flex items-end gap-2">
                    <Textarea
                        ref={ref}
                        value={text}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={onKeyDown}
                        onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
                        placeholder={placeholder}
                        autoFocus={autoFocus}
                        rows={1}
                        aria-label={placeholder}
                        className="max-h-48 min-h-9 flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[13.5px] shadow-none focus-visible:ring-0 [field-sizing:content]"
                    />
                    <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach files" onClick={() => fileRef.current?.click()} disabled={files.length >= 10}>
                        <Paperclip />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Mention someone" onClick={() => { onChange(`${text}${text && !text.endsWith(" ") ? " " : ""}@`); ref.current?.focus(); }}>
                        <AtSign />
                    </Button>
                    <Button type="button" size="icon-sm" onClick={send} disabled={(!text.trim() && !ready.length) || uploading} aria-label="Send">
                        <SendHorizontal />
                    </Button>
                </div>
                </div>
            </PopoverAnchor>
            <PopoverContent side="top" align="start" className="w-72 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command shouldFilter={false} value={active} onValueChange={setActive}>
                    <CommandList>
                        <CommandEmpty>No one found.</CommandEmpty>
                        {suggestions.length > 0 && (
                            <CommandGroup heading="People">
                                {suggestions.map((m) => (
                                    <CommandItem key={m.membership_id} value={m.membership_id} onSelect={pick} className={cn("gap-2")}>
                                        <PersonAvatar size="sm" name={m.name} src={m.profile_photo_url} presence={presenceOf(m.membership_id)} />
                                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                                        <span className="truncate text-xs text-muted-foreground">{m.job_title ?? ""}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                        {broadcasts.length > 0 && (
                            <CommandGroup heading="Everyone">
                                {broadcasts.map((b) => (
                                    <CommandItem key={b.key} value={`@${b.key}`} onSelect={pick}>
                                        <span className="font-medium">{b.label}</span>
                                        <span className="truncate text-xs text-muted-foreground">{b.hint}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
