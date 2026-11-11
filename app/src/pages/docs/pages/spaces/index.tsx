import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layers, Lock, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { TableToolbar } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiSpaceKindFilterOptions, WikiSpaceKindFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useSpaces } from "@/features/docs/hooks/use-docs";
import { DocIcon, SpaceFormDialog } from "../../components/docs-ui";

/**
 * /docs/spaces — all spaces the caller can read (15 §2)
 * @perm VIEW docs.pages.read · create docs.spaces.manage
 * @api GET /docs/spaces · POST /docs/spaces
 */
export default function SpacesPage() {
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams({ limit: 24 });
    const spaces = useSpaces(params);
    const [open, setOpen] = useState(false);

    return (
        <Page width="wide">
            <PageHeader title="Spaces" description="Each space has its own page tree, members and publishing rules." actions={<Can permission="docs.spaces.manage"><Button onClick={() => setOpen(true)}><Plus /> New space</Button></Can>} />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search spaces…">
                <Select value={filters.kind ?? "all"} onValueChange={(v) => setFilter("kind", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Filter by kind"><SelectValue /></SelectTrigger>
                    <SelectContent>{WikiSpaceKindFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            {spaces.isPending ? <ListSkeleton /> : spaces.error ? <ErrorState error={spaces.error} onRetry={() => spaces.refetch()} /> : !spaces.data.data.length ? (
                <div className="rounded-lg border border-border bg-card">
                    <EmptyState icon={Layers} title={search ? "No spaces match" : "No spaces yet"} description="Spaces group pages by team, department or topic." action={!search && <Can permission="docs.spaces.manage"><Button size="sm" onClick={() => setOpen(true)}><Plus /> New space</Button></Can>} />
                </div>
            ) : (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {spaces.data.data.map((s) => (
                            <Link key={s.id} to={`/docs/spaces/${s.id}`} className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:bg-secondary">
                                <div className="flex items-center gap-2">
                                    <DocIcon icon={s.icon} />
                                    <span className="truncate text-[13px] font-medium text-foreground">{s.name}</span>
                                    {s.is_private && <Lock className="size-3.5 text-muted-foreground" aria-label="Private" />}
                                </div>
                                {s.description && <p className="mt-1 line-clamp-2 flex-1 text-xs text-muted-foreground">{s.description}</p>}
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline">{getDropdownOptionLabel(WikiSpaceKindFormOptions, s.kind)}</Badge>
                                    <span>{s.page_count ?? 0} pages</span>
                                    {s.last_page_update && <span>· updated {formatRelative(s.last_page_update)}</span>}
                                </div>
                            </Link>
                        ))}
                    </div>
                    {spaces.data.pagination.total_pages > 1 && <div className="mt-4 flex justify-center"><Pagination currentPage={spaces.data.pagination.page} totalPages={spaces.data.pagination.total_pages} onPageChange={setPage} /></div>}
                </>
            )}
            <SpaceFormDialog open={open} onOpenChange={setOpen} onCreated={(s) => navigate(`/docs/spaces/${s.id}`)} />
        </Page>
    );
}
