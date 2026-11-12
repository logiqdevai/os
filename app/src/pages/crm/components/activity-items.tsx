import { useState } from "react";
import { AlarmClock, Bell, CalendarDays, Check, Mail, MessageSquare, MoreHorizontal, Pencil, Phone, Plus, Repeat, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ActivityStatusFormOptions, ActivityTypeFormOptions } from "@/config/constants/dropdowns/crm/activity-form.options";
import { useActivities, useCompleteActivity, useDeleteActivity } from "@/features/crm/activities/hooks/use-activities";
import type { Activity, ActivityType, CrmRecordLink } from "@/features/crm/activities/interfaces/activities.interfaces";
import { contactName } from "@/features/crm/common/interfaces/crm-common.interfaces";
import { CrmPaths } from "../crm-paths";
import { ActivityFormDialog } from "./activity-form-dialog";
import { memberLabel, RecordLink } from "./crm-ui";

export const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
    CALL: Phone, MEETING: CalendarDays, EMAIL: Mail, FOLLOW_UP: Repeat, REMINDER: Bell, APPOINTMENT: AlarmClock, INTERNAL_COMMENT: MessageSquare, OTHER: MessageSquare,
};

/** One activity row (record timelines and the activities list). */
export function ActivityRow({ activity, onEdit, onDelete, showRecord }: { activity: Activity; onEdit: (a: Activity) => void; onDelete: (a: Activity) => void; showRecord?: boolean }) {
    const complete = useCompleteActivity();
    const canUpdate = usePermission("crm.activities.update");
    const canDelete = usePermission("crm.activities.delete");
    const Icon = ACTIVITY_ICON[activity.type];
    const done = activity.status === "COMPLETED";
    return (
        <div className="flex gap-3 py-3">
            <div className={cn("grid size-8 shrink-0 place-items-center rounded-full border border-border", done ? "bg-success-soft text-success" : activity.is_overdue ? "bg-danger-soft text-danger" : "bg-secondary text-muted-foreground")}>
                <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={cn("font-medium text-foreground", done && "text-muted-foreground line-through decoration-border-strong")}>{activity.title}</span>
                    <Badge variant="neutral">{getDropdownOptionLabel(ActivityTypeFormOptions, activity.type)}</Badge>
                    {activity.status !== "PLANNED" && activity.status !== "COMPLETED" && <Badge variant="warning">{getDropdownOptionLabel(ActivityStatusFormOptions, activity.status)}</Badge>}
                    {activity.is_overdue && <Badge variant="danger">Overdue</Badge>}
                    {(activity.priority === "HIGH" || activity.priority === "URGENT") && !done && <Badge variant="warning">{activity.priority === "URGENT" ? "Urgent" : "High"}</Badge>}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{done ? `Done ${formatDateTime(activity.completed_at)}` : activity.starts_at ? `Due ${formatDateTime(activity.starts_at)}` : "No due date"}</span>
                    <span>· {memberLabel(activity.owner)}</span>
                    {showRecord && activity.deal && <span>· <RecordLink to={CrmPaths.deal(activity.deal.id)}>{activity.deal.name}</RecordLink></span>}
                    {showRecord && !activity.deal && activity.company && <span>· <RecordLink to={CrmPaths.company(activity.company.id)}>{activity.company.name}</RecordLink></span>}
                    {showRecord && activity.lead && <span>· <RecordLink to={CrmPaths.lead(activity.lead.id)}>{activity.lead.name}</RecordLink></span>}
                    {showRecord && activity.contact && <span>· <RecordLink to={CrmPaths.contact(activity.contact.id)}>{contactName(activity.contact)}</RecordLink></span>}
                </div>
                {activity.description && <p className="mt-1 whitespace-pre-wrap text-[13px] text-body">{activity.description}</p>}
                {activity.outcome && <p className="mt-1 text-[13px] text-foreground"><span className="text-muted-foreground">Outcome: </span>{activity.outcome}</p>}
            </div>
            <div className="flex shrink-0 items-start gap-1">
                {!done && canUpdate && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => complete.mutate({ id: activity.id })}
                    >
                        <Check /> <span className="hidden sm:inline">Done</span>
                    </Button>
                )}
                {(canUpdate || canDelete) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${activity.title}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {canUpdate && <DropdownMenuItem onSelect={() => onEdit(activity)}><Pencil /> Edit</DropdownMenuItem>}
                            {canDelete && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => onDelete(activity)}><Trash2 /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );
}

/** Edit + delete dialogs shared by activity lists. */
export function useActivityDialogs() {
    const [editing, setEditing] = useState<Activity | null>(null);
    const [deleting, setDeleting] = useState<Activity | null>(null);
    const del = useDeleteActivity();
    const dialogs = (
        <>
            <ActivityFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} activity={editing} />
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title="Delete this activity?"
                description="It is removed from the record timeline. This cannot be undone."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) del.mutate(deleting.id); setDeleting(null); }}
            />
        </>
    );
    return { setEditing, setDeleting, dialogs };
}

/** Activities of one record (deal, company, contact or lead) with open first, then history. */
export function RecordActivities({ link }: { link: CrmRecordLink }) {
    const canRead = usePermission("crm.activities.read");
    const params = { ...link, limit: 100, order_by: "starts_at", order_direction: "desc" };
    const activities = useActivities(params, canRead);
    const [creating, setCreating] = useState(false);
    const { setEditing, setDeleting, dialogs } = useActivityDialogs();

    if (!canRead) return <EmptyState compact title="Activities are hidden" description="You need the CRM activities permission to see calls, meetings and follow-ups." />;
    const rows = activities.data?.data ?? [];
    const open = rows.filter((a) => a.status === "PLANNED").sort((a, b) => (a.starts_at ?? "9").localeCompare(b.starts_at ?? "9"));
    const past = rows.filter((a) => a.status !== "PLANNED");

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{open.length} open · {past.length} done</span>
                <Can permission="crm.activities.create">
                    <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus /> Activity</Button>
                </Can>
            </div>
            {activities.isPending ? <ListSkeleton rows={3} className="p-0" />
                : activities.error ? <ErrorState error={activities.error} onRetry={() => activities.refetch()} />
                    : !rows.length ? <EmptyState compact icon={Phone} title="No activities yet" description="Log a call or schedule the next follow-up." />
                        : (
                            <div className="divide-y divide-border-soft">
                                {[...open, ...past].map((a) => <ActivityRow key={a.id} activity={a} onEdit={setEditing} onDelete={setDeleting} />)}
                            </div>
                        )}
            <ActivityFormDialog open={creating} onOpenChange={setCreating} link={link} />
            {dialogs}
        </div>
    );
}
