import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Clock, Plus, Search, Star, TriangleAlert } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { formatRelative, personName } from "@/lib/format";
import { useDocsHome, useDocsSearch } from "@/features/docs/hooks/use-docs";
import type { WikiPageListItem } from "@/features/docs/interfaces/docs.interfaces";
import { DocIcon, DocsStatusBadge, SpaceFormDialog } from "../../components/docs-ui";

/**
 * /docs — knowledge home: search, favorites, recent, required reading, reviews due, spaces (15 §1)
 * @perm VIEW docs.pages.read · new space docs.spaces.manage · new page docs.pages.create
 * @api GET /docs/home · GET /docs/search?q=
 */
export default function DocsHomePage() {
    const navigate = useNavigate();
    const { params, search, setSearch, setPage } = useListParams({ limit: 20 });
    const q = (params.search as string | undefined) ?? "";
    const results = useDocsSearch({ q, page: params.page, limit: 20 }, q.length > 0);
    const home = useDocsHome();
    const [spaceOpen, setSpaceOpen] = useState(false);

    return (
        <Page width="wide">
            <PageHeader
                title="Docs"
                description="Policies, procedures, runbooks and everything the agency knows."
                actions={
                    <>
                        <Can permission="docs.spaces.manage"><Button variant="outline" onClick={() => setSpaceOpen(true)}><Plus /> New space</Button></Can>
                        <Can permission="docs.pages.create"><Button asChild><Link to="/docs/pages/new"><Plus /> New page</Link></Button></Can>
                    </>
                }
            />
            <div className="relative mb-6">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search titles and content…" className="h-10 pl-9" aria-label="Search docs" />
            </div>

            {q ? (
                <Section title={`Results for “${q}”`}>
                    {results.isPending ? <ListSkeleton /> : results.error ? <ErrorState error={results.error} onRetry={() => results.refetch()} /> : !results.data.data.length ? (
                        <EmptyState icon={Search} title="Nothing found" description="Try other words, or check the spelling." />
                    ) : (
                        <>
                            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                                {results.data.data.map((p) => (
                                    <li key={p.id}>
                                        <Link to={`/docs/pages/${p.id}`} className="block px-4 py-3 hover:bg-secondary">
                                            <div className="flex items-center gap-2"><DocIcon icon={p.icon} /><span className="truncate text-[13px] font-medium text-foreground">{p.title}</span><DocsStatusBadge status={p.status === "PUBLISHED" ? null : p.status} /></div>
                                            <div className="mt-0.5 text-xs text-muted-foreground">{p.space.name}</div>
                                            {p.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.snippet}</p>}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            {results.data.pagination.total_pages > 1 && <div className="mt-3 flex justify-center"><Pagination currentPage={results.data.pagination.page} totalPages={results.data.pagination.total_pages} onPageChange={setPage} /></div>}
                        </>
                    )}
                </Section>
            ) : home.isPending ? <PageSkeleton /> : home.error ? <ErrorState error={home.error} onRetry={() => home.refetch()} /> : (
                <div className="space-y-8">
                    {home.data.required_reading.length > 0 && (
                        <Section title="Required reading" description="Pages you are asked to read and acknowledge.">
                            <PageList pages={home.data.required_reading} icon={TriangleAlert} />
                        </Section>
                    )}
                    <div className="grid gap-6 lg:grid-cols-2">
                        <Section title="Favorites"><PageList pages={home.data.favorites} icon={Star} empty="Star pages to keep them here." /></Section>
                        <Section title="Recently viewed"><PageList pages={home.data.recent} icon={Clock} empty="Pages you open show up here." /></Section>
                    </div>
                    {home.data.needs_review.length > 0 && <Section title="Reviews due" description="Pages you own that are due for review."><PageList pages={home.data.needs_review} icon={TriangleAlert} /></Section>}
                    <Section title="Spaces" actions={<Button variant="ghost" size="sm" asChild><Link to="/docs/spaces">All spaces</Link></Button>}>
                        {home.data.spaces.length ? (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {home.data.spaces.map((s) => (
                                    <Link key={s.id} to={`/docs/spaces/${s.id}`} className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary">
                                        <div className="flex items-center gap-2"><DocIcon icon={s.icon} /><span className="truncate text-[13px] font-medium text-foreground">{s.name}</span></div>
                                        {s.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                                        <p className="mt-2 text-xs text-muted-foreground">{s.page_count} pages</p>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-border bg-card">
                                <EmptyState icon={BookOpen} title="No spaces yet" description="Create a space for a team, department or topic, then add pages." action={<Can permission="docs.spaces.manage"><Button size="sm" onClick={() => setSpaceOpen(true)}><Plus /> New space</Button></Can>} />
                            </div>
                        )}
                    </Section>
                    <Section title="Recently updated"><PageList pages={home.data.recently_updated} icon={Clock} empty="No pages yet." showOwner /></Section>
                </div>
            )}
            <SpaceFormDialog open={spaceOpen} onOpenChange={setSpaceOpen} onCreated={(s) => navigate(`/docs/spaces/${s.id}`)} />
        </Page>
    );
}

function PageList({ pages, icon, empty = "Nothing here.", showOwner }: { pages: WikiPageListItem[]; icon: typeof Star; empty?: string; showOwner?: boolean }) {
    if (!pages.length) return <div className="rounded-lg border border-border bg-card"><EmptyState compact icon={icon} title={empty} /></div>;
    return (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {pages.slice(0, 8).map((p) => (
                <li key={p.id}>
                    <Link to={`/docs/pages/${p.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary">
                        <DocIcon icon={p.icon} />
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium text-foreground">{p.title}</div>
                            <div className="truncate text-xs text-muted-foreground">{p.space.name}{showOwner && p.owner ? ` · ${personName(p.owner.user)}` : ""}</div>
                        </div>
                        <span className="hidden text-xs text-muted-foreground sm:inline">{formatRelative(p.last_edited_at ?? p.updated_at)}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
