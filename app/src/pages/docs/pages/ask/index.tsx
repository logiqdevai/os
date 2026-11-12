import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Info, RefreshCw, Search, Sparkles } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { formatRelative } from "@/lib/format";
import { useAskDocs, useDocsAiStatus, useReindexDocsAi, useSpaces } from "@/features/docs/hooks/use-docs";
import type { DocsAiAnswer } from "@/features/docs/interfaces/docs.interfaces";
import { DocIcon } from "../../components/docs-ui";

const ALL = "__all";

/**
 * /docs/ask — AI Q&A over the organization's pages (15 §6).
 * Answers use the organization's own OpenAI key and cite only pages the asker can read; without a key the best
 * matching passages are shown (keyword search). Nothing is sent anywhere else.
 * @perm VIEW docs.ai.query · rebuild index docs.spaces.manage
 * @api POST /docs/ai/ask · GET /docs/ai/status · POST /docs/ai/reindex @mcp docs_ai_ask
 * @audit wiki_ai.question_answered · wiki_ai.reindexed
 * @states idle · asking · answer · passages only (no AI) · nothing found · error
 */
export default function DocsAskPage() {
    const [question, setQuestion] = useState("");
    const [spaceId, setSpaceId] = useState(ALL);
    const [history, setHistory] = useState<DocsAiAnswer[]>([]);
    const ask = useAskDocs();
    const status = useDocsAiStatus();
    const reindex = useReindexDocsAi();
    const spaces = useSpaces({ limit: 200 });

    const submit = (e?: FormEvent) => {
        e?.preventDefault();
        const q = question.trim();
        if (q.length < 3) return;
        ask.mutate({ question: q, space_id: spaceId === ALL ? undefined : spaceId }, {
            onSuccess: (res) => { setHistory((h) => [res, ...h].slice(0, 10)); setQuestion(""); },
        });
    };

    return (
        <Page width="narrow">
            <PageHeader
                title="Ask the docs"
                description="Ask a question in plain language. Answers come only from pages you can open, with links to the sources."
                actions={
                    <Can permission="docs.spaces.manage">
                        <Button variant="outline" size="sm" loading={reindex.isPending} onClick={() => reindex.mutate(undefined)}><RefreshCw /> Rebuild index</Button>
                    </Can>
                }
            />

            {reindex.data && (
                <p role="status" className="-mt-2 mb-4 text-xs text-muted-foreground">
                    Index rebuilt · {reindex.data.pages} pages · {reindex.data.chunks} passages{reindex.data.ai_configured ? ` · ${reindex.data.embedded} embedded` : " · keyword mode"}
                </p>
            )}
            {status.data && !status.data.ai_configured && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-[13px] text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <span>No AI provider is connected, so you get the best matching passages instead of a written answer. An admin can connect the organization's OpenAI key in <Link to="/admin/integrations" className="text-foreground underline-offset-2 hover:underline">Admin → Integrations</Link>.</span>
                </div>
            )}

            <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-card p-3">
                <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    rows={3}
                    maxLength={1000}
                    placeholder="How do we onboard a new client? Who approves expenses above €500?"
                    aria-label="Your question"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Select value={spaceId} onValueChange={setSpaceId}>
                        <SelectTrigger className="h-8 sm:w-56" aria-label="Space"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>All spaces</SelectItem>
                            {spaces.data?.data.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                        {status.data && (
                            <span className="text-xs text-muted-foreground">
                                {status.data.mode === "semantic" ? "Semantic search" : "Keyword search"} · {status.data.indexed_pages} pages{status.data.last_indexed_at ? ` · indexed ${formatRelative(status.data.last_indexed_at)}` : ""}
                            </span>
                        )}
                        <Button type="submit" loading={ask.isPending} disabled={question.trim().length < 3}><Sparkles /> Ask</Button>
                    </div>
                </div>
            </form>

            {ask.error && <div className="mt-4"><ErrorState error={ask.error} onRetry={() => submit()} /></div>}

            <div className="mt-6 space-y-6">
                {!history.length && !ask.isPending && (
                    <EmptyState icon={Sparkles} title="Ask anything about how the agency works" description="Policies, procedures, runbooks, onboarding — answers cite the pages they come from." />
                )}
                {history.map((h, i) => <AnswerCard key={`${h.question}-${i}`} answer={h} />)}
            </div>
        </Page>
    );
}

function AnswerCard({ answer }: { answer: DocsAiAnswer }) {
    const byIndex = new Map(answer.citations.map((c) => [c.index, c]));
    return (
        <Section title={answer.question}>
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={answer.answer ? "violet" : "neutral"}>{answer.answer ? "AI answer" : "Matching passages"}</Badge>
                    <Badge variant="neutral">{answer.mode === "semantic" ? "Semantic" : "Keyword"}</Badge>
                    {answer.reason === "ai_provider_error" && <Badge variant="warning">AI provider error — showing passages</Badge>}
                </div>
                {answer.answer ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{withCitationLinks(answer.answer, byIndex)}</p>
                ) : !answer.citations.length ? (
                    <EmptyState compact icon={Search} title="No page answers this yet" description="Try other words, or ask the owner of the topic to write it down." />
                ) : null}
                {answer.citations.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Sources</div>
                        <ol className="space-y-2">
                            {answer.citations.map((c) => (
                                <li key={c.page_id}>
                                    <Link to={`/docs/pages/${c.page_id}`} className="block rounded-md border border-border p-2.5 hover:bg-secondary">
                                        <div className="flex items-center gap-2 text-[13px]">
                                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-[11px] tabular text-foreground">{c.index}</span>
                                            <DocIcon icon={c.icon} />
                                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{c.title}</span>
                                            {c.space && <span className="hidden text-xs text-muted-foreground sm:inline">{c.space.name}</span>}
                                        </div>
                                        {c.heading_path && <div className="mt-1 truncate text-xs text-muted-foreground">{c.heading_path}</div>}
                                        {c.excerpt && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{c.excerpt}</p>}
                                    </Link>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>
        </Section>
    );
}

/** Turn "[1]" / "[2][3]" markers into links to the cited pages. */
function withCitationLinks(text: string, byIndex: Map<number, { page_id: string; title: string }>): ReactNode[] {
    const parts = text.split(/(\[\d{1,2}\])/g);
    return parts.map((part, i) => {
        const m = part.match(/^\[(\d{1,2})\]$/);
        const c = m ? byIndex.get(Number(m[1])) : undefined;
        if (!c) return <Fragment key={i}>{part}</Fragment>;
        return <Link key={i} to={`/docs/pages/${c.page_id}`} title={c.title} className="mx-0.5 rounded bg-secondary px-1 text-xs tabular text-foreground hover:underline">{m![1]}</Link>;
    });
}
