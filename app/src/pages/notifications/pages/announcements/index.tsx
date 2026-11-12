import { useState } from "react";
import { Ban, Megaphone, MoreHorizontal, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { useListParams } from "@/hooks/use-list-params";
import {
    useAnnouncement, useAnnouncements, useDeleteAnnouncement, usePublishAnnouncement, useWithdrawAnnouncement,
} from "@/features/notifications/hooks/use-notifications";
import type { Announcement, AnnouncementStatus } from "@/features/notifications/interfaces/notifications.interfaces";
import { AnnouncementStatusFilterOptions, AnnouncementStatusFormOptions, NotificationPriorityFormOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime, formatRelative, personName } from "@/lib/format";
import { AnnouncementFormDialog } from "./components/announcement-form-dialog";

const STATUS_VARIANT: Record<AnnouncementStatus, BadgeVariant> = { DRAFT: "neutral", SCHEDULED: "info", LIVE: "success", EXPIRED: "secondary", WITHDRAWN: "danger" };

type Pending = { kind: "publish" | "withdraw" | "delete"; a: Announcement } | null;

/**
 * /notifications/announcements — system announcements (14 §4).
 * @perm notifications.announcements.manage* (route gate)
 * @api GET/POST/PATCH/DELETE /announcements · POST /announcements/:id/publish · /withdraw · GET /announcements/:id
 */
export default function AnnouncementsPage() {
    const { params, setPage, search, setSearch, filters, setFilter } = useListParams();
    const list = useAnnouncements(params);
    const publish = usePublishAnnouncement();
    const withdraw = useWithdrawAnnouncement();
    const remove = useDeleteAnnouncement();
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [viewing, setViewing] = useState<string | null>(null);
    const [pending, setPending] = useState<Pending>(null);
    const detail = useAnnouncement(viewing ?? undefined);

    const columns: DataTableColumn<Announcement>[] = [
        {
            key: "title",
            header: "Announcement",
            cell: (a) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{a.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.body}</div>
                </div>
            ),
        },
        { key: "status", header: "Status", cell: (a) => <Badge variant={STATUS_VARIANT[a.status]}>{getDropdownOptionLabel(AnnouncementStatusFormOptions, a.status)}</Badge> },
        { key: "severity", header: "Severity", cell: (a) => getDropdownOptionLabel(NotificationPriorityFormOptions, a.severity), hideBelow: "md" },
        { key: "when", header: "Published", cell: (a) => (a.published_at ? formatRelative(a.published_at) : a.publish_at ? `Scheduled ${formatDateTime(a.publish_at)}` : <span className="text-muted-foreground">—</span>), hideBelow: "sm" },
        { key: "ack", header: "Acknowledged", cell: (a) => (a.requires_ack ? <span className="tabular">{a._count?.acknowledgements ?? 0}</span> : <span className="text-muted-foreground">Not required</span>), hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (a) => {
                const editable = a.status === "DRAFT" || a.status === "SCHEDULED";
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.title}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {editable && <DropdownMenuItem onSelect={() => setPending({ kind: "publish", a })}><Send /> Publish now</DropdownMenuItem>}
                            {editable && <DropdownMenuItem onSelect={() => { setEditing(a); setFormOpen(true); }}><Pencil /> Edit</DropdownMenuItem>}
                            {(a.status === "LIVE" || a.status === "SCHEDULED") && <DropdownMenuItem onSelect={() => setPending({ kind: "withdraw", a })}><Ban /> Withdraw</DropdownMenuItem>}
                            {editable && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setPending({ kind: "delete", a })}><Trash2 /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    const confirm = {
        publish: { title: "Publish now?", description: "Everyone in the audience gets it in their inbox right away.", text: "Publish", m: publish },
        withdraw: { title: "Withdraw this announcement?", description: "It is removed from every inbox. This cannot be undone.", text: "Withdraw", m: withdraw },
        delete: { title: "Delete this draft?", description: "This cannot be undone.", text: "Delete", m: remove },
    } as const;
    const c = pending ? confirm[pending.kind] : null;

    return (
        <Page>
            <PageHeader
                title="Announcements"
                description="Organization-wide notices (maintenance, policy changes). Optionally require acknowledgement."
                actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New announcement</Button>}
            />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search announcements…">
                <Select value={filters.status ?? "all"} onValueChange={(v) => setFilter("status", v)}>
                    <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                    <SelectContent>{AnnouncementStatusFilterOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </TableToolbar>
            <DataTable
                columns={columns}
                data={list.data?.data}
                rowKey={(a) => a.id}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                pagination={list.data?.pagination}
                onPageChange={setPage}
                onRowClick={(a) => setViewing(a.id)}
                empty={{ icon: Megaphone, title: search ? "No announcements match" : "No announcements yet", description: "Write one to reach every member at once.", action: !search ? <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> New announcement</Button> : undefined }}
            />
            <AnnouncementFormDialog open={formOpen} onOpenChange={setFormOpen} announcement={editing} />
            <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>{detail.data?.title ?? "Announcement"}</SheetTitle>
                        <SheetDescription>{detail.data ? getDropdownOptionLabel(AnnouncementStatusFormOptions, detail.data.status) : ""}</SheetDescription>
                    </SheetHeader>
                    {detail.isLoading ? <ListSkeleton rows={5} /> : detail.error ? <ErrorState error={detail.error} onRetry={() => detail.refetch()} /> : detail.data && (
                        <div className="mt-4 space-y-5">
                            <p className="whitespace-pre-wrap text-sm text-body">{detail.data.body}</p>
                            <KeyValueList columns={1} items={[
                                { label: "Audience", value: `${detail.data.audience ? "Selected members, teams or branches" : "Everyone"} (${detail.data.audience_size} members)` },
                                { label: "Created by", value: detail.data.created_by ? personName(detail.data.created_by.user) : "—" },
                                { label: "Published", value: detail.data.published_at ? formatDateTime(detail.data.published_at) : "Not yet" },
                                { label: "Expires", value: detail.data.expires_at ? formatDateTime(detail.data.expires_at) : "Never" },
                            ]} />
                            {detail.data.requires_ack && (
                                <div className="space-y-2">
                                    <p className="text-[13px] font-medium text-foreground">Acknowledged by {detail.data._count?.acknowledgements ?? 0} of {detail.data.audience_size}</p>
                                    <ul className="divide-y divide-border-soft rounded-lg border border-border">
                                        {detail.data.acknowledgements.length ? detail.data.acknowledgements.map((k) => (
                                            <li key={k.id} className="flex justify-between gap-2 px-3 py-2 text-[13px]">
                                                <span className="truncate">{k.membership ? personName(k.membership.user) : "—"}</span>
                                                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(k.acknowledged_at)}</span>
                                            </li>
                                        )) : <li className="px-3 py-2 text-[13px] text-muted-foreground">Nobody yet.</li>}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </SheetContent>
            </Sheet>
            <ConfirmationDialog
                isOpen={!!pending}
                onClose={() => setPending(null)}
                title={c?.title ?? ""}
                description={c?.description ?? ""}
                confirmText={c?.text ?? "Confirm"}
                variant={pending?.kind === "publish" ? "default" : "destructive"}
                isLoading={c?.m.isPending}
                onConfirm={() => {
                    if (!pending) return;
                    const done = { onSuccess: () => setPending(null) };
                    if (pending.kind === "publish") publish.mutate(pending.a.id, done);
                    else if (pending.kind === "withdraw") withdraw.mutate(pending.a.id, done);
                    else { remove.mutate(pending.a.id); setPending(null); } // optimistic: the row leaves at once
                }}
            />
        </Page>
    );
}
