import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, ChevronLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { useHelpArticle, useHelpArticles, useHelpHome } from "@/features/portal/hooks/use-portal";
import { PortalCard, PortalHeader } from "../components/portal-ui";
import { PORTAL_PATHS } from "../portal-paths";

/** Help center inside the portal — /portal/help (13 §6): public and client-only articles. */
export function PortalHelpPage() {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<string | null>(null);
    const home = useHelpHome();
    const searching = !!search.trim() || !!category;
    const results = useHelpArticles({ search: search.trim() || undefined, category: category ?? undefined, limit: 30 }, searching);
    return (
        <>
            <PortalHeader title="Help center" description="Answers to common questions." />
            <div className="relative mb-5 max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ash" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles…" className="h-10 pl-9" aria-label="Search articles" />
            </div>
            {home.isLoading ? <ListSkeleton /> : home.error || !home.data ? <ErrorState error={home.error} onRetry={() => home.refetch()} /> : searching ? (
                results.isLoading ? <ListSkeleton /> : !results.data?.data.length ? <EmptyState icon={BookOpen} title="No articles found" description="Try other words, or open a request and we'll help." /> : (
                    <PortalCard title={category ? home.data.categories.find((c) => c.slug === category)?.name : "Results"} action={category && <button type="button" className="text-xs text-info hover:underline" onClick={() => setCategory(null)}>All topics</button>}>
                        <ul className="divide-y divide-border-soft">{results.data.data.map((a) => <li key={a.id}><Link to={PORTAL_PATHS.helpArticle(a.slug)} className="block py-2.5 hover:underline"><div className="text-[13px] font-medium">{a.title}</div>{a.summary && <div className="text-xs text-muted-foreground">{a.summary}</div>}</Link></li>)}</ul>
                    </PortalCard>
                )
            ) : !home.data.categories.length && !home.data.popular.length ? (
                <EmptyState icon={BookOpen} title="No articles yet" description="The team hasn't published help articles yet." />
            ) : (
                <div className="space-y-5">
                    {home.data.categories.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {home.data.categories.map((c) => (
                                <button key={c.id} type="button" onClick={() => setCategory(c.slug)} className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/50">
                                    <div className="font-medium text-foreground">{c.name}</div>
                                    {c.description && <div className="mt-1 text-[13px] text-muted-foreground">{c.description}</div>}
                                    <div className="mt-2 text-xs text-muted-foreground">{c._count.articles} article{c._count.articles === 1 ? "" : "s"}</div>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="grid gap-5 lg:grid-cols-2">
                        {home.data.faqs.length > 0 && <PortalCard title="Frequently asked"><ul className="space-y-2">{home.data.faqs.map((a) => <li key={a.id}><Link className="text-[13px] hover:underline" to={PORTAL_PATHS.helpArticle(a.slug)}>{a.title}</Link></li>)}</ul></PortalCard>}
                        {home.data.popular.length > 0 && <PortalCard title="Popular"><ul className="space-y-2">{home.data.popular.map((a) => <li key={a.id}><Link className="text-[13px] hover:underline" to={PORTAL_PATHS.helpArticle(a.slug)}>{a.title}</Link></li>)}</ul></PortalCard>}
                    </div>
                </div>
            )}
        </>
    );
}

/** One help article — /portal/help/:slug. */
export function PortalHelpArticlePage() {
    const { slug } = useParams();
    const article = useHelpArticle(slug);
    if (article.isLoading) return <PageSkeleton />;
    if (article.error || !article.data) return <ErrorState error={article.error} onRetry={() => article.refetch()} />;
    const a = article.data;
    return (
        <div className="mx-auto max-w-3xl">
            <Link to={PORTAL_PATHS.help} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" /> Help center</Link>
            <PortalHeader title={a.title} description={`${a.category?.name ? `${a.category.name} · ` : ""}updated ${formatDate(a.updated_at)}`} />
            <PortalCard><div className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">{a.body}</div></PortalCard>
            {!!a.related?.length && <PortalCard title="Related" className="mt-4"><ul className="space-y-1.5">{a.related.map((r) => <li key={r.id}><Link className="text-[13px] hover:underline" to={PORTAL_PATHS.helpArticle(r.slug)}>{r.title}</Link></li>)}</ul></PortalCard>}
        </div>
    );
}
