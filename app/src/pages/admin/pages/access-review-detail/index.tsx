import { useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Check, CircleCheck, Play, Users, X } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import {
    useAccessReview,
    useAccessReviewItems,
    useApplyAccessReview,
    useCancelAccessReview,
    useCompleteAccessReview,
    useStartAccessReview,
} from "@/features/admin/access-reviews/hooks/use-access-reviews";
import type { AccessReviewItem } from "@/features/admin/access-reviews/interfaces/access-reviews.interfaces";
import { AccessReviewDecisionFilterOptions, ReviewerStrategyFormOptions } from "@/config/constants/dropdowns/admin/access-review-form.options";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import { ScopeTypeFormOptions } from "@/config/constants/dropdowns/admin/scope-type-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, personName } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { PersonCell } from "../../components/person-cell";
import { AccessReviewDecisionBadge, AccessReviewStatusBadge } from "../access-reviews/components/review-badges";
import { ItemSheet } from "./components/item-sheet";

type Action = "start" | "apply" | "complete" | "cancel";

/**
 * Access review detail — /admin/access-reviews/:id?decision=&mine=   (mockup 01-admin `review`, spec §98)
 * @perm VIEW .read | .manage | .decide (reviewers see only their items) · start / apply / complete / cancel / reassign .manage · decide .decide (assigned items only)
 * @api GET /access-reviews/:id · GET /access-reviews/:id/items · POST …/start|apply|complete|cancel · PATCH /access-review-items/:id · POST /access-review-items/:id/reassign
 * @states loading · error / not found · draft · in progress · completed / cancelled (read-only) · "not assigned to you"
 */
export default function AccessReviewDetailPage() {
    const { id } = useParams();
    const review = useAccessReview(id);
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const items = useAccessReviewItems(review.data && review.data.status !== "DRAFT" ? id : undefined, params);
    const canManage = usePermission("organizations.access_reviews.manage");
    const start = useStartAccessReview();
    const apply = useApplyAccessReview();
    const complete = useCompleteAccessReview();
    const cancel = useCancelAccessReview();
    const [confirm, setConfirm] = useState<Action | null>(null);
    const [openItem, setOpenItem] = useState<AccessReviewItem | null>(null);

    if (review.isPending) return <PageSkeleton />;
    if (review.error || !review.data) return <Page><PageHeader title="Access review" back={{ to: "/admin/access-reviews", label: "Access reviews" }} /><ErrorState error={review.error} onRetry={() => review.refetch()} /></Page>;

    const r = review.data;
    const st = r.stats;
    const open = r.status === "IN_PROGRESS";
    const pct = st.total ? Math.round((st.decided / st.total) * 100) : 0;
    const missingKey = r.reviewers.filter((x) => !x.has_decide_permission);

    const run = (action: Action) => {
        // No success toasts: the status, progress and counts on this page show the result. Failures are toasted globally.
        const close = { onSettled: () => setConfirm(null) };
        if (action === "start") start.mutate(r.id, close);
        if (action === "complete") complete.mutate(r.id, close);
        if (action === "cancel") cancel.mutate(r.id, close);
        if (action === "apply")
            apply.mutate(r.id, {
                ...close,
                // A partial failure is still worth a (destructive) toast: some decisions were not applied.
                onSuccess: (res) => { if (res.failed) toast({ variant: "destructive", title: `${res.applied} applied, ${res.failed} failed`, description: res.results.find((x) => x.error)?.error }); },
            });
    };
    const pending = start.isPending || apply.isPending || complete.isPending || cancel.isPending;
    const confirmCopy: Record<Action, { title: string; description: string; confirm: string; destructive?: boolean }> = {
        start: { title: "Start this review?", description: "Every member in scope is listed with their current access, and reviewers are notified.", confirm: "Start review" },
        apply: { title: `Apply ${st.pending_apply} decision${st.pending_apply === 1 ? "" : "s"}?`, description: "Revoked members lose every role and allow grant; modified members lose the selected roles, grants and modules. This is audited.", confirm: "Apply", destructive: true },
        complete: { title: "Complete this review?", description: "The review becomes read-only and is recorded as completed.", confirm: "Complete" },
        cancel: { title: "Cancel this review?", description: "Decisions not applied yet are dropped. Applied changes stay.", confirm: "Cancel review", destructive: true },
    };

    const columns: DataTableColumn<AccessReviewItem>[] = [
        { key: "member", header: "Member", cell: (i) => <PersonCell user={i.membership.user} sub={i.access_snapshot.job_title ?? i.membership.user.email} /> },
        {
            key: "access",
            header: "Access at review time",
            cell: (i) => (
                <div className="min-w-0 text-xs">
                    <div className="truncate text-foreground">{i.access_snapshot.roles.map((x) => x.role_name).join(", ") || "No roles"}</div>
                    <div className="truncate text-muted-foreground">{i.access_snapshot.modules.length} modules · {i.access_snapshot.permission_count} permissions{i.access_snapshot.grants.length > 0 && ` · ${i.access_snapshot.grants.length} grants`}</div>
                </div>
            ),
            hideBelow: "md",
        },
        { key: "reviewer", header: "Reviewer", cell: (i) => (i.reviewer ? personName(i.reviewer.user) : <span className="text-warning">Unassigned</span>), hideBelow: "lg" },
        {
            key: "decision",
            header: "Decision",
            cell: (i) => (i.can_decide && open && i.decision === "PENDING" ? <Button size="sm" variant="outline" onClick={() => setOpenItem(i)}>Review</Button> : <AccessReviewDecisionBadge decision={i.decision} />),
        },
        { key: "comment", header: "Comment", cell: (i) => <span className="line-clamp-2 text-xs text-muted-foreground">{i.comment ?? "—"}</span>, hideBelow: "xl" },
        {
            key: "applied",
            header: "Applied",
            cell: (i) => (i.applied_at ? <span className="text-xs text-success">{formatDate(i.applied_at)}</span> : i.decision === "REVOKED" || i.decision === "MODIFIED" ? <Badge variant="warning">Pending apply</Badge> : <span className="text-muted-foreground">—</span>),
            hideBelow: "sm",
        },
    ];

    return (
        <Page>
            <PageHeader
                back={{ to: "/admin/access-reviews", label: "Access reviews" }}
                title={r.name}
                meta={<AccessReviewStatusBadge status={r.status} />}
                description={[
                    r.scope_type === "ORGANIZATION" ? getDropdownOptionLabel(ScopeTypeFormOptions, r.scope_type) : `${getDropdownOptionLabel(ScopeTypeFormOptions, r.scope_type)}: ${r.scope_label ?? "—"}`,
                    r.modules.length ? r.modules.map((m) => getDropdownOptionLabel(ModuleKeyOptions, m)).join(", ") : "all modules",
                    getDropdownOptionLabel(ReviewerStrategyFormOptions, r.reviewer_strategy),
                    `due ${formatDate(r.due_at)}`,
                    r.created_by && `created by ${personName(r.created_by.user)}`,
                ].filter(Boolean).join(" · ")}
                actions={
                    canManage && (
                        <>
                            {(r.status === "DRAFT" || open) && <Button variant="ghost" onClick={() => setConfirm("cancel")}><X /> Cancel review</Button>}
                            {r.status === "DRAFT" && <Button onClick={() => setConfirm("start")}><Play /> Start</Button>}
                            {open && <Button variant="outline" disabled={!st.pending_apply} onClick={() => setConfirm("apply")}><Check /> Apply decisions ({st.pending_apply})</Button>}
                            {open && <Button disabled={st.pending > 0 || st.pending_apply > 0} title={st.pending ? "Every member needs a decision first" : st.pending_apply ? "Apply the decisions first" : undefined} onClick={() => setConfirm("complete")}><CircleCheck /> Complete</Button>}
                        </>
                    )
                }
            />
            {r.description && <p className="-mt-3 mb-4 text-[13px] text-muted-foreground">{r.description}</p>}

            {r.status === "DRAFT" ? (
                <div className="rounded-lg border border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
                    This review is a draft. {canManage ? "Start it to list the members in scope and notify reviewers." : "It has not started yet."}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                        <StatCard label="Progress" value={`${pct}%`} hint={`${st.decided} of ${st.total} decided`} />
                        <StatCard label="Certified" value={st.certified} hint="kept as is" tone="success" />
                        <StatCard label="Revoked" value={st.revoked} hint="all access removed" tone={st.revoked ? "danger" : "default"} />
                        <StatCard label="Modified" value={st.modified} hint="some access removed" tone={st.modified ? "warning" : "default"} />
                        <StatCard label="Pending apply" value={st.pending_apply} hint="revoke / modify not applied" tone={st.pending_apply ? "warning" : "default"} className="col-span-2 lg:col-span-1" />
                    </div>

                    {canManage && (missingKey.length > 0 || r.unassigned_items > 0) && open && (
                        <div className="flex items-start gap-2 rounded-lg border border-border bg-warning-soft p-3 text-[13px] text-warning">
                            <AlertTriangle className="mt-0.5 size-4 flex-none" />
                            <span>
                                {r.unassigned_items > 0 && <>{r.unassigned_items} member{r.unassigned_items === 1 ? " has" : "s have"} no reviewer: open them and give them to someone. </>}
                                {missingKey.length > 0 && <>{missingKey.map((x) => personName(x.reviewer?.user)).join(", ")} cannot record decisions without the permission <code className="font-mono">organizations.access_reviews.decide</code>: grant it or reassign their members.</>}
                            </span>
                        </div>
                    )}

                    {r.reviewers.length > 0 && (
                        <Section title="Reviewers">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {r.reviewers.map((x) => (
                                    <div key={x.reviewer?.id ?? "none"} className="space-y-2 rounded-lg border border-border bg-card p-3">
                                        <PersonCell user={x.reviewer?.user} size="sm" />
                                        <ProgressBar value={x.assigned ? (x.decided / x.assigned) * 100 : 0} />
                                        <div className="text-xs text-muted-foreground">{x.decided} of {x.assigned} decided</div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    <Section title="Members">
                        <Tabs value={filters.mine === "true" ? "mine" : "all"} onValueChange={(v) => setFilter("mine", v === "mine" ? "true" : null)}>
                            <TabsList>
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="mine">Assigned to me</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <TableToolbar search={search} onSearch={setSearch} placeholder="Search members…">
                            <Select value={filters.decision ?? "all"} onValueChange={(v) => setFilter("decision", v)}>
                                <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by decision"><SelectValue /></SelectTrigger>
                                <SelectContent>{AccessReviewDecisionFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </TableToolbar>
                        <DataTable
                            columns={columns}
                            data={items.data?.data}
                            rowKey={(i) => i.id}
                            loading={items.isFetching}
                            error={items.error}
                            onRetry={() => items.refetch()}
                            pagination={items.data?.pagination}
                            onPageChange={setPage}
                            onRowClick={(i) => setOpenItem(i)}
                            empty={{ icon: Users, title: filters.mine || filters.decision || search ? "No members match" : "Nobody to review", description: filters.mine ? "No members are assigned to you in this review." : undefined }}
                        />
                    </Section>
                </div>
            )}

            <ItemSheet item={openItem} onOpenChange={(o) => !o && setOpenItem(null)} canManage={canManage} reviewOpen={open} />
            <ConfirmationDialog
                isOpen={!!confirm}
                onClose={() => setConfirm(null)}
                title={confirm ? confirmCopy[confirm].title : ""}
                description={confirm ? confirmCopy[confirm].description : ""}
                confirmText={confirm ? confirmCopy[confirm].confirm : "Confirm"}
                variant={confirm && confirmCopy[confirm].destructive ? "destructive" : "default"}
                isLoading={pending}
                onConfirm={() => confirm && run(confirm)}
            />
        </Page>
    );
}
