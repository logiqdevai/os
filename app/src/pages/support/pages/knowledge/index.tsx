import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, FolderPlus, ListOrdered, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { KnowledgeStatusFilterOptions, KnowledgeStatusOptions, KnowledgeStatusTone, KnowledgeVisibilityFilterOptions, KnowledgeVisibilityOptions } from "@/config/constants/dropdowns/support/support.options";
import { useArticles, useCreateKnowledgeCategory, useKnowledgeCategories } from "@/features/support/hooks/use-support";
import type { ArticleListItem } from "@/features/support/interfaces/support.interfaces";
import { SUPPORT_PATHS } from "../../support-paths";
import { CategoriesSheet } from "./components/categories-sheet";

/**
 * Help center articles — /support/knowledge (mockup 13-support `knowledge`).
 * @perm VIEW support.knowledge.read · create .create · categories + order .update
 */
export default function KnowledgePage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const articles = useArticles(params);
    const categories = useKnowledgeCategories();
    const canCreate = usePermission("support.knowledge.create");
    const [catOpen, setCatOpen] = useState(false);
    const [orderOpen, setOrderOpen] = useState(false);
    const canEditCategories = usePermission("support.knowledge.update");

    const columns: DataTableColumn<ArticleListItem>[] = [
        {
            key: "title",
            header: "Article",
            cell: (a) => (
                <div className="min-w-0">
                    <Link to={SUPPORT_PATHS.article(a.id)} className="block truncate font-medium text-foreground hover:underline">{a.title}</Link>
                    <div className="truncate text-xs text-muted-foreground">{a.category?.name ?? "Uncategorized"}{a.is_faq ? " · FAQ" : ""}</div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (a) => <Badge variant={KnowledgeStatusTone[a.status]}>{getDropdownOptionLabel(KnowledgeStatusOptions, a.status)}</Badge> },
        { key: "visibility", header: "Visibility", cell: (a) => <span className="text-xs text-muted-foreground">{getDropdownOptionLabel(KnowledgeVisibilityOptions, a.visibility)}</span>, hideBelow: "md" },
        { key: "views", header: "Views", cell: (a) => <span className="tabular">{a.view_count}</span>, hideBelow: "lg", className: "text-right", headerClassName: "text-right" },
        { key: "helpful", header: "Helpful", cell: (a) => <span className="tabular text-muted-foreground">{a.helpful_count + a.not_helpful_count ? `${Math.round((a.helpful_count / (a.helpful_count + a.not_helpful_count)) * 100)}%` : "—"}</span>, hideBelow: "lg", className: "text-right", headerClassName: "text-right" },
        { key: "updated", header: "Updated", cell: (a) => <span className="text-xs text-muted-foreground">{formatRelative(a.updated_at)}</span>, hideBelow: "sm" },
    ];

    return (
        <Page>
            <PageHeader
                title="Help center"
                description="Articles for the public help center, the client portal and your agents."
                actions={
                    <>
                        <Button variant="outline" onClick={() => setOrderOpen(true)}><ListOrdered /> Categories</Button>
                        <Can permission="support.knowledge.update">
                            <Button variant="outline" onClick={() => setCatOpen(true)}><FolderPlus /> Category</Button>
                        </Can>
                        <Can permission="support.knowledge.create">
                            <Button asChild><Link to={SUPPORT_PATHS.newArticle}><Plus /> New article</Link></Button>
                        </Can>
                    </>
                }
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search articles…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-36" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{KnowledgeStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}{o.id !== "all" && articles.data?.status_counts[o.id] !== undefined ? ` (${articles.data.status_counts[o.id]})` : ""}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.visibility ?? "all"} onValueChange={(v) => setFilter("visibility", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Visibility"><SelectValue /></SelectTrigger>
                    <SelectContent>{KnowledgeVisibilityFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.category_id ?? "all"} onValueChange={(v) => setFilter("category_id", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c._count?.articles ?? 0})</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={articles.data?.data}
                rowKey={(a) => a.id}
                loading={articles.isFetching}
                error={articles.error}
                onRetry={() => articles.refetch()}
                pagination={articles.data?.pagination}
                onPageChange={setPage}
                rowHref={(a) => SUPPORT_PATHS.article(a.id)}
                empty={{ icon: BookOpen, title: search ? "No articles match" : "Write your first article", description: "Answers your clients can find themselves, in the help center and the portal.", action: canCreate && !search ? <Button size="sm" asChild><Link to={SUPPORT_PATHS.newArticle}><Plus /> New article</Link></Button> : undefined }}
            />
            <CategoryDialog open={catOpen} onOpenChange={setCatOpen} />
            <CategoriesSheet open={orderOpen} onOpenChange={setOrderOpen} canEdit={canEditCategories} />
        </Page>
    );
}

function CategoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const create = useCreateKnowledgeCategory();
    const [name, setName] = useState("");
    const [visibility, setVisibility] = useState("PUBLIC");
    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>New category</DialogTitle>
                    <DialogDescription>Group help-center articles by topic.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Getting started" aria-label="Category name" autoFocus />
                    <Select value={visibility} onValueChange={setVisibility}>
                        <SelectTrigger aria-label="Visibility"><SelectValue /></SelectTrigger>
                        <SelectContent>{KnowledgeVisibilityOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                    <Button
                        loading={create.isPending}
                        disabled={!name.trim()}
                        onClick={() => create.mutate({ name: name.trim(), visibility }, { onSuccess: () => { toast({ title: "Category created" }); setName(""); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not create category", description: getApiErrorMessage(e) }) })}
                    >
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
