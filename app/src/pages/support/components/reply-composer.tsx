import { useState } from "react";
import { BookOpen, ChevronDown, MessageSquareText, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { useCannedResponses, useRenderCannedResponse, useSuggestReply } from "@/features/support/hooks/use-support";
import type { AiReplySuggestion } from "@/features/support/interfaces/support.interfaces";

export interface ComposerSendInput {
    kind: "AGENT" | "INTERNAL_NOTE";
    body: string;
    canned_response_id?: string;
    resolve?: boolean;
}

interface ReplyComposerProps {
    /** Called once per send; the composer clears at once (the message shows in the thread as "Sending…"). */
    onSend: (input: ComposerSendInput) => void;
    conversationId?: string | null;
    ticketId?: string | null;
    /** Show "Send and resolve". */
    allowResolve?: boolean;
    disabledReason?: string | null;
    /** Called while typing (throttled by the caller); `internal` = writing an internal note. */
    onTyping?: (internal: boolean) => void;
}

/**
 * Reply vs internal-note composer (13 §1): saved replies (rendered with placeholders), optional AI draft
 * (falls back to help-center matches when no AI provider is connected), Ctrl/⌘+Enter to send.
 */
export function ReplyComposer({ onSend, conversationId, ticketId, allowResolve, disabledReason, onTyping }: ReplyComposerProps) {
    const [kind, setKind] = useState<"AGENT" | "INTERNAL_NOTE">("AGENT");
    const [body, setBody] = useState("");
    const [cannedId, setCannedId] = useState<string | undefined>();
    const [cannedOpen, setCannedOpen] = useState(false);
    const [ai, setAi] = useState<AiReplySuggestion | null>(null);
    const canReply = usePermission("support.conversations.reply");
    const canAi = usePermission("support.ai.use");
    const canned = useCannedResponses({ limit: 50 }, cannedOpen && canReply);
    const render = useRenderCannedResponse();
    const suggest = useSuggestReply();
    const note = kind === "INTERNAL_NOTE";
    const blocked = !canReply ? "You need support.conversations.reply to answer" : disabledReason;

    const send = (resolve = false) => {
        if (!body.trim() || blocked) return;
        onSend({ kind, body: body.trim(), canned_response_id: cannedId, resolve });
        setBody("");
        setCannedId(undefined);
        setAi(null);
    };

    const insertCanned = (id: string) => {
        setCannedOpen(false);
        render.mutate(
            { id, conversation_id: conversationId ?? undefined, ticket_id: ticketId ?? undefined },
            {
                onSuccess: (r) => {
                    setBody((b) => (b.trim() ? `${b}\n\n${r.body}` : r.body));
                    setCannedId(id);
                },
            },
        );
    };

    const draft = () => {
        if (!conversationId) return;
        suggest.mutate(conversationId, {
            onSuccess: (r) => {
                setAi(r);
                if (r.suggestion) setBody(r.suggestion.body);
            },
        });
    };

    return (
        <div className={cn("rounded-lg border bg-card", note ? "border-warning/50" : "border-border")}>
            <div className="flex items-center gap-1 border-b border-border-soft px-2 pt-1.5">
                {(["AGENT", "INTERNAL_NOTE"] as const).map((k) => (
                    <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        className={cn("rounded-t-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors", kind === k ? (k === "INTERNAL_NOTE" ? "bg-warning-soft text-warning" : "bg-secondary text-foreground") : "text-muted-foreground hover:text-foreground")}
                        aria-pressed={kind === k}
                    >
                        {k === "AGENT" ? "Reply" : "Internal note"}
                    </button>
                ))}
                {note && <span className="ml-auto hidden text-xs text-warning sm:inline">Only your team sees notes</span>}
            </div>
            <Textarea
                value={body}
                onChange={(e) => {
                    setBody(e.target.value);
                    if (e.target.value.trim()) onTyping?.(note);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        send();
                    }
                }}
                rows={4}
                placeholder={note ? "Write a private note for your team…" : "Write your reply…"}
                className={cn("resize-none rounded-none border-0 shadow-none focus-visible:ring-0", note && "bg-warning-soft/40")}
                aria-label={note ? "Internal note" : "Reply"}
                disabled={!!blocked}
            />
            {ai && !ai.available && (
                <div className="space-y-1 border-t border-border-soft px-3 py-2 text-xs text-muted-foreground">
                    <p>{ai.reason === "ai_not_configured" ? "AI drafts need an AI provider connected in Admin → Integrations." : "The AI provider did not respond. Try again later."}</p>
                    {ai.articles.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <BookOpen className="size-3.5" /> Related articles:
                            {ai.articles.map((a) => (
                                <button key={a.id} type="button" className="text-info hover:underline" onClick={() => setBody((b) => `${b}${b ? "\n\n" : ""}${a.title}: ${a.summary ?? ""}`.trim())}>
                                    {a.title}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border-soft px-2 py-1.5">
                <Popover open={cannedOpen} onOpenChange={setCannedOpen}>
                    <PopoverTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" disabled={!!blocked} loading={render.isPending}>
                            <MessageSquareText /> <span className="hidden sm:inline">Saved replies</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search saved replies…" />
                            <CommandList>
                                <CommandEmpty>{canned.isLoading ? "Loading…" : "No saved replies"}</CommandEmpty>
                                <CommandGroup>
                                    {canned.data?.data.map((c) => (
                                        <CommandItem key={c.id} value={`${c.name} ${c.shortcut ?? ""}`} onSelect={() => insertCanned(c.id)}>
                                            <div className="min-w-0">
                                                <div className="truncate text-[13px]">{c.name} {c.shortcut && <span className="text-xs text-muted-foreground">{c.shortcut}</span>}</div>
                                                <div className="truncate text-xs text-muted-foreground">{c.body}</div>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {canAi && conversationId && !note && (
                    <Button type="button" variant="ghost" size="sm" onClick={draft} loading={suggest.isPending} disabled={!!blocked}>
                        <Sparkles /> <span className="hidden sm:inline">Draft with AI</span>
                    </Button>
                )}
                <div className="ml-auto flex items-center">
                    {blocked ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span><Button size="sm" disabled><Send /> Send</Button></span>
                            </TooltipTrigger>
                            <TooltipContent>{blocked}</TooltipContent>
                        </Tooltip>
                    ) : (
                        <>
                            <Button size="sm" onClick={() => send()} disabled={!body.trim()} className={cn(allowResolve && !note && "rounded-r-none")}>
                                <Send /> {note ? "Add note" : "Send"}
                            </Button>
                            {allowResolve && !note && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" className="rounded-l-none border-l border-primary-foreground/20 px-1.5" disabled={!body.trim()} aria-label="More send options">
                                            <ChevronDown />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => send(true)}>Send and resolve</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
