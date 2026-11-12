import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClipboardCheck, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Can } from "@/components/access/can";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { useAccessReviews } from "@/features/admin/access-reviews/hooks/use-access-reviews";
import type { AccessReview } from "@/features/admin/access-reviews/interfaces/access-reviews.interfaces";
import { AccessReviewStatusFilterOptions } from "@/config/constants/dropdowns/admin/access-review-form.options";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { useScopeLabel } from "../../components/use-scope-label";
import { AccessReviewStatusBadge } from "./components/review-badges";
import { ReviewFormDialog } from "./components/review-form-dialog";

/**
 * Access reviews — /admin/access-reviews?status=  (+ /new opens the form)   mockup 01-admin `reviews`, spec §98
 * @perm VIEW organizations.access_reviews.read | .manage | .decide (reviewers see reviews with items assigned to them) · create .manage
 * @api GET /access-reviews · POST /access-reviews
 * @states loading · empty ("No access reviews yet") · error · no-access
 */
export default function AccessReviewsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const reviews = useAccessReviews(params);
    const canManage = usePermission("organizations.access_reviews.manage");
    const scopeLabel = useScopeLabel();
    const [formOpen, setFormOpen] = useState(false);
    useEffect(() => setFormOpen(location.pathname.endsWith("/new") && canManage), [location.pathname, canManage]);
    const closeForm = (o: boolean) => {
        setFormOpen(o);
        if (!o && location.pathname.endsWith("/new")) navigate("/admin/access-reviews", { replace: true });
    };

    const columns: DataTableColumn<AccessReview>[] = [
        {
            key: "name",
            header: "Review",
            cell: (r) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{r.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                        {scopeLabel(r.scope_type, r.scope_id)}
                        {r.modules.length > 0 && ` · ${r.modules.map((m) => getDropdownOptionLabel(ModuleKeyOptions, m)).join(", ")}`}
                    </div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (r) => <AccessReviewStatusBadge status={r.status} /> },
        {
            key: "progress",
            header: "Progress",
            cell: (r) => (
                <div className="w-32 space-y-1">
                    <ProgressBar value={r.stats.total ? (r.stats.decided / r.stats.total) * 100 : 0} tone={r.status === "COMPLETED" ? "success" : "default"} />
                    <div className="text-xs text-muted-foreground">{r.stats.decided} of {r.stats.total} decided{r.stats.pending_apply > 0 && <> · <Badge variant="warning">{r.stats.pending_apply} to apply</Badge></>}</div>
                </div>
            ),
            hideBelow: "sm",
        },
        { key: "due", header: "Due", cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.due_at)}</span>, hideBelow: "md" },
    ];

    return (
        <Page>
            <PageHeader
                title="Access reviews"
                description="Periodic certification of who has what. Reviewers certify, revoke or modify each member's access; decisions are applied in one step."
                actions={<Can permission="organizations.access_reviews.manage"><Button onClick={() => setFormOpen(true)}><Plus /> New access review</Button></Can>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search reviews…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{AccessReviewStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={reviews.data?.data}
                rowKey={(r) => r.id}
                loading={reviews.isFetching}
                error={reviews.error}
                onRetry={() => reviews.refetch()}
                pagination={reviews.data?.pagination}
                onPageChange={setPage}
                rowHref={(r) => `/admin/access-reviews/${r.id}`}
                empty={{
                    icon: ClipboardCheck,
                    title: search || filters.status ? "No reviews match" : "No access reviews yet",
                    description: canManage ? "Run a review each quarter to confirm everyone still needs their access." : "Reviews assigned to you appear here.",
                    action: canManage && !search && !filters.status ? <Button size="sm" onClick={() => setFormOpen(true)}><Plus /> New access review</Button> : undefined,
                }}
            />
            {canManage && <ReviewFormDialog open={formOpen} onOpenChange={closeForm} />}
        </Page>
    );
}
