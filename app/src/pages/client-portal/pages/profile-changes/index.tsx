import { useState } from "react";
import { UserRoundPen } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useListParams } from "@/hooks/use-list-params";
import { formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ProfileChangeStatusFilterOptions, ProfileChangeStatusOptions, ProfileChangeStatusTone } from "@/config/constants/dropdowns/portal/portal.options";
import { useApproveProfileChange, useProfileChanges, useRejectProfileChange } from "@/features/client-portal/hooks/use-client-portal";
import type { ProfileChangeRow } from "@/features/client-portal/interfaces/client-portal.interfaces";

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/**
 * Profile change requests — /client-portal/profile-changes (mockup 07-portal `profile`).
 * @perm portal.profile_changes.review* · applying also needs crm.companies.update / crm.contacts.update
 */
export default function ProfileChangesPage() {
    const { params, setPage, filters, setFilter } = useListParams();
    const status = filters.status ?? "PENDING";
    const list = useProfileChanges({ ...params, status: status === "everything" ? undefined : status });
    const approve = useApproveProfileChange();
    const reject = useRejectProfileChange();
    const [rejecting, setRejecting] = useState<ProfileChangeRow | null>(null);
    const [note, setNote] = useState("");

    return (
        <Page width="wide">
            <PageHeader title="Profile changes" description="Company and contact details clients proposed in the portal. Approving writes them to the CRM." />
            <div className="mb-3 flex justify-end">
                <Select value={status === "everything" ? "all" : status} onValueChange={(v) => setFilter("status", v === "PENDING" ? null : v === "all" ? "everything" : v)}>
                    <SelectTrigger className="h-8 w-full sm:w-52" aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{ProfileChangeStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            {list.isLoading ? <ListSkeleton /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : !list.data?.data.length ? (
                <EmptyState icon={UserRoundPen} title={status === "PENDING" ? "Nothing to review" : "No change requests"} description="When clients edit their company details in the portal they show up here." />
            ) : (
                <div className="space-y-3">
                    {list.data.data.map((r) => (
                        <div key={r.id} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-foreground">{r.company.name}</span>
                                {r.contact && <Badge variant="neutral">Contact: {r.contact.first_name} {r.contact.last_name ?? ""}</Badge>}
                                <Badge variant={ProfileChangeStatusTone[r.status]}>{getDropdownOptionLabel(ProfileChangeStatusOptions, r.status)}</Badge>
                                <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><MemberAvatar person={r.requested_by} size="xs" /> {formatRelative(r.created_at)}</span>
                            </div>
                            <div className="mt-3 overflow-x-auto">
                                <table className="w-full min-w-[420px] text-[13px]">
                                    <thead><tr className="text-xs text-muted-foreground"><th className="py-1 text-left font-medium">Field</th><th className="py-1 text-left font-medium">Now</th><th className="py-1 text-left font-medium">Proposed</th></tr></thead>
                                    <tbody>
                                        {Object.entries(r.changes).map(([field, v]) => (
                                            <tr key={field} className="border-t border-border-soft">
                                                <td className="py-1.5 pr-3 text-muted-foreground">{field.replace(/_/g, " ")}</td>
                                                <td className="py-1.5 pr-3 text-muted-foreground line-through">{show(v.from)}</td>
                                                <td className="py-1.5 text-foreground">{show(v.to)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {r.review_note && <p className="mt-2 text-xs text-muted-foreground">Note: {r.review_note}</p>}
                            {r.status === "PENDING" && (
                                <div className="mt-3 flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => { setRejecting(r); setNote(""); }}>Reject</Button>
                                    <Button size="sm" onClick={() => approve.mutate({ id: r.id })}>Approve & apply</Button>
                                </div>
                            )}
                        </div>
                    ))}
                    {list.data.pagination.total_pages > 1 && <Pagination currentPage={list.data.pagination.page} totalPages={list.data.pagination.total_pages} onPageChange={setPage} />}
                </div>
            )}
            <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Reject this change?</DialogTitle><DialogDescription>The client sees that the change was not applied. Add a short reason.</DialogDescription></DialogHeader>
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" aria-label="Reason" />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => { if (!rejecting) return; reject.mutate({ id: rejecting.id, review_note: note || undefined }); setRejecting(null); }}>Reject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
