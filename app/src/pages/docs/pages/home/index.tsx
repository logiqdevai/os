import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Clock, Plus, Star, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { useSessionData } from "@/features/session/hooks/use-session";
import { formatRelative, personName } from "@/lib/format";
import { useDocsHome } from "@/features/docs/hooks/use-docs";
import type { WikiPageListItem } from "@/features/docs/interfaces/docs.interfaces";
import { DocIcon, SpaceFormDialog } from "../../components/docs-ui";
import { DocsSearchButton, DocsSearchDialog } from "../../components/docs-search-dialog";

function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/**
 * /docs — Notion-style home: greeting, "Recently visited" cards, then required reading, favorites, reviews due and
 * recently updated as compact lists. Spaces live in the sidebar; search opens a command dialog.
 * @perm VIEW docs.pages.read · new space docs.spaces.manage · new page docs.pages.create
 * @api GET /docs/home · GET /docs/search?q=
 */
export default function DocsHomePage() {
    const navigate = useNavigate();
    const home = useDocsHome();
    const me = useSessionData()?.user;
    const [spaceOpen, setSpaceOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    usePageMetadata({ title: "Docs" });

    return (
        <div className="mx-auto w-full max-w-[920px] px-6 pb-24 pt-14 sm:px-10">
            <h1 className="text-center text-[32px] font-bold tracking-tight text-foreground">{greeting()}{me?.first_name ? `, ${me.first_name}` : ""}</h1>
            <div className="mx-auto mt-6 flex max-w-xl items-center gap-2">
                <DocsSearchButton onClick={() => setSearchOpen(true)} />
                <Can permission="docs.pages.create"><Button asChild><Link to="/docs/pages/new"><Plus /> New page</Link></Button></Can>
            </div>

            {home.isPending ? <div className="mt-10"><PageSkeleton /></div> : home.error ? <div className="mt-10"><ErrorState error={home.error} onRetry={() => home.refetch()} /></div> : (
                <div className="mt-10 space-y-10">
                    <HomeSection icon={Clock} title="Recently visited">
                        {home.data.recent.length ? (
                            <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
                                {home.data.recent.map((p) => (
                                    <Link key={p.id} to={`/docs/pages/${p.id}`} className="group flex h-36 w-40 flex-none snap-start flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-accent">
                                        <div className="relative h-12 flex-none bg-secondary">
                                            <span className="absolute -bottom-3 left-3 flex size-8 items-center justify-center rounded-md bg-card"><DocIcon icon={p.icon} className="size-5 text-foreground" /></span>
                                        </div>
                                        <div className="flex flex-1 flex-col justify-between p-3 pt-5">
                                            <span className="line-clamp-2 text-[13px] font-medium text-foreground">{p.title || "Untitled"}</span>
                                            <span className="truncate text-[11.5px] text-muted-foreground">{formatRelative(p.last_edited_at ?? p.updated_at)}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : <p className="text-[13px] text-muted-foreground">Pages you open show up here.</p>}
                    </HomeSection>

                    {home.data.required_reading.length > 0 && <HomeSection icon={TriangleAlert} title="Required reading"><PageRows pages={home.data.required_reading} /></HomeSection>}
                    <div className="grid gap-10 md:grid-cols-2">
                        <HomeSection icon={Star} title="Favorites">{home.data.favorites.length ? <PageRows pages={home.data.favorites} /> : <p className="text-[13px] text-muted-foreground">Star a page to keep it here and in the sidebar.</p>}</HomeSection>
                        <HomeSection icon={Clock} title="Recently updated">{home.data.recently_updated.length ? <PageRows pages={home.data.recently_updated} showOwner /> : <p className="text-[13px] text-muted-foreground">No pages yet.</p>}</HomeSection>
                    </div>
                    {home.data.needs_review.length > 0 && <HomeSection icon={TriangleAlert} title="Reviews due"><PageRows pages={home.data.needs_review} /></HomeSection>}
                    {!home.data.spaces.length && (
                        <div className="rounded-xl border border-border bg-card">
                            <EmptyState icon={BookOpen} title="No spaces yet" description="Create a space for a team, department or topic, then add pages." action={<Can permission="docs.spaces.manage"><Button size="sm" onClick={() => setSpaceOpen(true)}><Plus /> New space</Button></Can>} />
                        </div>
                    )}
                </div>
            )}
            <DocsSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
            <SpaceFormDialog open={spaceOpen} onOpenChange={setSpaceOpen} onCreated={(s) => navigate(`/docs/spaces/${s.id}`)} />
        </div>
    );
}

function HomeSection({ icon: Icon, title, children }: { icon: typeof Star; title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="size-3.5" /> {title}</h2>
            {children}
        </section>
    );
}

function PageRows({ pages, showOwner }: { pages: WikiPageListItem[]; showOwner?: boolean }) {
    return (
        <ul className="space-y-0.5">
            {pages.slice(0, 8).map((p) => (
                <li key={p.id}>
                    <Link to={`/docs/pages/${p.id}`} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-accent">
                        <DocIcon icon={p.icon} />
                        <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{p.title || "Untitled"}</span>
                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">{p.space.name}{showOwner && p.owner ? ` · ${personName(p.owner.user)}` : ""}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
