import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Markdown } from "@/components/ui/markdown";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { getApiErrorStatus } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { useHelpArticleFeedback, usePublicHelpArticle } from "@/features/support/hooks/use-support";

/**
 * /help/:orgSlug/articles/:slug — public help-center article (13 §6). No login, no app shell. AI answers in the chat widget
 * and emails link here, so only PUBLISHED + PUBLIC articles resolve (others are 404).
 * @api GET /help/:orgSlug/articles/:slug · POST /help/:orgSlug/articles/:slug/feedback
 * @states loading · not found · error · article · feedback sent
 */
export default function HelpArticlePage() {
    const { orgSlug, slug } = useParams();
    const article = usePublicHelpArticle(orgSlug, slug);
    const feedback = useHelpArticleFeedback();
    const [voted, setVoted] = useState<boolean | null>(null);
    usePageMetadata({ title: article.data?.title ?? "Help article" });

    const vote = (is_helpful: boolean) => {
        if (!orgSlug || !slug) return;
        setVoted(is_helpful);
        feedback.mutate({ orgSlug, slug, is_helpful });
    };

    return (
        <div className="min-h-svh bg-background text-foreground">
            <main className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
                {article.isLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-8 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                    </div>
                ) : article.error ? (
                    getApiErrorStatus(article.error) === 404 ? (
                        <EmptyState icon={BookOpen} title="Article not found" description="It may have been moved or unpublished." />
                    ) : (
                        <ErrorState error={article.error} onRetry={() => article.refetch()} />
                    )
                ) : article.data ? (
                    <article className="space-y-6">
                        <header className="space-y-2">
                            {article.data.category && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{article.data.category.name}</p>}
                            <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{article.data.title}</h1>
                            {article.data.summary && <p className="text-[15px] text-muted-foreground">{article.data.summary}</p>}
                            <p className="text-xs text-muted-foreground">Updated {formatDate(article.data.updated_at)}</p>
                        </header>
                        <Markdown source={article.data.body} className="break-words" />
                        <section className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4 text-[13px]">
                            {voted === null ? (
                                <>
                                    <span className="mr-auto font-medium">Was this article helpful?</span>
                                    <Button size="sm" variant="outline" onClick={() => vote(true)}><ThumbsUp /> Yes</Button>
                                    <Button size="sm" variant="outline" onClick={() => vote(false)}><ThumbsDown /> No</Button>
                                </>
                            ) : (
                                <span role="status">Thanks for your feedback.</span>
                            )}
                        </section>
                        {article.data.related.length > 0 && (
                            <section className="space-y-2">
                                <h2 className="text-sm font-semibold">Related articles</h2>
                                <ul className="space-y-1 text-[14px]">
                                    {article.data.related.map((r) => (
                                        <li key={r.id}><Link className="text-info hover:underline" to={`/help/${encodeURIComponent(orgSlug ?? "")}/articles/${encodeURIComponent(r.slug)}`}>{r.title}</Link></li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </article>
                ) : null}
            </main>
        </div>
    );
}
