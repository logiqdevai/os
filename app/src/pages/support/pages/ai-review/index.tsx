import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Check, Pencil, Sparkles, X } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatRelative, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { AiSuggestionKindFilterOptions, AiSuggestionKindOptions, AiSuggestionStatusFilterOptions } from "@/config/constants/dropdowns/support/support.options";
import { useAcceptAiSuggestion, useAiStatus, useAiSuggestions, useRejectAiSuggestion } from "@/features/support/hooks/use-support";
import type { AiSuggestion } from "@/features/support/interfaces/support.interfaces";
import { SUPPORT_PATHS } from "../../support-paths";

const MESSAGE_KINDS = ["REPLY", "REWRITE", "TRANSLATION", "FOLLOW_UP_QUESTION", "TROUBLESHOOTING"];
const textOf = (s: AiSuggestion) => s.payload.edited_body ?? s.payload.body ?? s.payload.text ?? s.payload.summary ?? null;

/**
 * AI review queue — /support/ai-review (13 §3; mockup 13-support `ai-queue`).
 * Drafts from the AI wait here for a human: accept (optionally edited — replies are sent through the conversation), or reject.
 * Without an AI connection the page explains how to connect one (BYOK) instead of failing.
 * @perm VIEW support.ai.use · sending accepted replies also support.conversations.reply
 * @api GET /support/ai/status · GET /support/ai/suggestions · POST …/:id/accept · POST …/:id/reject
 */
export default function AiReviewPage() {
    usePageMetadata({ title: "AI review" });
    const { params, setPage, filters, setFilter } = useListParams({ filters: { status: "PENDING" } });
    const status = filters.status ?? "PENDING";
    const query = { ...params, status, kind: filters.kind && filters.kind !== "all" ? filters.kind : undefined };
    const suggestions = useAiSuggestions(query);
    const ai = useAiStatus();

    return (
        <Page>
            <PageHeader title="AI review" description="Suggestions from the AI assistant wait here until a person accepts, edits or rejects them." />
            {ai.data && !ai.data.configured && (
                <Alert className="mb-4">
                    <Sparkles className="size-4" />
                    <AlertTitle>No AI provider connected</AlertTitle>
                    <AlertDescription>Connect your organization's OpenAI key in Admin → Integrations to get reply drafts and summaries. Existing suggestions can still be reviewed.</AlertDescription>
                </Alert>
            )}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                <Select value={status} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-52" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{AiSuggestionStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.kind ?? "all"} onValueChange={(v) => setFilter("kind", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-52" aria-label="Kind"><SelectValue /></SelectTrigger>
                    <SelectContent>{AiSuggestionKindFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            {suggestions.isLoading ? (
                <ListSkeleton rows={4} />
            ) : suggestions.error ? (
                <ErrorState error={suggestions.error} onRetry={() => suggestions.refetch()} />
            ) : !suggestions.data?.data.length ? (
                <EmptyState icon={Bot} title={status === "PENDING" ? "Nothing to review" : "No suggestions"} description={status === "PENDING" ? "Ask the AI for a reply draft from a conversation; it lands here for approval." : "Try another status or kind."} />
            ) : (
                <>
                    <ul className="space-y-3">
                        {suggestions.data.data.map((s) => <SuggestionCard key={s.id} suggestion={s} />)}
                    </ul>
                    {suggestions.data.pagination.total_pages > 1 && <Pagination className="mt-4" currentPage={suggestions.data.pagination.page} totalPages={suggestions.data.pagination.total_pages} onPageChange={setPage} />}
                </>
            )}
        </Page>
    );
}

function SuggestionCard({ suggestion: s }: { suggestion: AiSuggestion }) {
    const accept = useAcceptAiSuggestion();
    const reject = useRejectAiSuggestion();
    const canReply = usePermission("support.conversations.reply");
    const [editing, setEditing] = useState(false);
    const text = textOf(s);
    const [draft, setDraft] = useState(text ?? "");
    const sends = MESSAGE_KINDS.includes(s.kind);
    const pending = s.status === "PENDING";
    const busy = accept.isPending || reject.isPending;
    const onAccept = (as: "AGENT" | "INTERNAL_NOTE" = "AGENT") =>
        accept.mutate(
            { id: s.id, body: editing && draft.trim() && draft !== text ? draft.trim() : undefined, as },
            { onSuccess: () => toast({ title: sends ? (as === "AGENT" ? "Reply sent" : "Saved as internal note") : "Suggestion accepted" }), onError: (e) => toast({ variant: "destructive", title: "Could not accept", description: getApiErrorMessage(e) }) },
        );
    return (
        <li className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="violet"><Bot className="size-3" /> {getDropdownOptionLabel(AiSuggestionKindOptions, s.kind)}</Badge>
                {s.confidence !== null && <span className="tabular">{Math.round(s.confidence * 100)}% confident</span>}
                <span>{formatRelative(s.created_at)}</span>
                {s.conversation && (
                    <Link to={SUPPORT_PATHS.conversation(s.conversation.id)} className="min-w-0 truncate font-medium text-foreground hover:underline">
                        {s.conversation.subject ?? "Conversation"}{s.conversation.customer_name ? ` · ${s.conversation.customer_name}` : ""}
                    </Link>
                )}
                {s.ticket && <Link to={SUPPORT_PATHS.ticket(s.ticket.reference)} className="font-medium text-foreground hover:underline">{s.ticket.reference}</Link>}
            </div>
            {editing ? (
                <Textarea className="mt-3" rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit suggestion" />
            ) : (
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{text ?? <span className="text-muted-foreground">{s.explanation ?? "No text"}</span>}</p>
            )}
            {s.explanation && text && <p className="mt-2 text-xs text-muted-foreground">{s.explanation}</p>}
            {pending ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {sends ? (
                        <>
                            <Button size="sm" loading={accept.isPending} disabled={busy || !canReply} title={canReply ? undefined : "Needs support.conversations.reply"} onClick={() => onAccept("AGENT")}><Check /> {editing ? "Send edited reply" : "Send reply"}</Button>
                            <Button size="sm" variant="outline" disabled={busy || !canReply} onClick={() => onAccept("INTERNAL_NOTE")}>Save as note</Button>
                        </>
                    ) : (
                        <Button size="sm" loading={accept.isPending} disabled={busy} onClick={() => onAccept()}><Check /> Accept</Button>
                    )}
                    {text && !editing && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(true)}><Pencil /> Edit</Button>}
                    <Button size="sm" variant="ghost" loading={reject.isPending} disabled={busy} onClick={() => reject.mutate({ id: s.id }, { onSuccess: () => toast({ title: "Suggestion rejected" }), onError: (e) => toast({ variant: "destructive", title: "Could not reject", description: getApiErrorMessage(e) }) })}>
                        <X /> Reject
                    </Button>
                </div>
            ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                    {getDropdownOptionLabel(AiSuggestionStatusFilterOptions, s.status)}
                    {s.reviewed_by && ` by ${personName(s.reviewed_by.user)}`}
                    {s.reviewed_at && ` ${formatRelative(s.reviewed_at)}`}
                    {s.payload.edited_body ? " · edited before sending" : ""}
                </p>
            )}
        </li>
    );
}
