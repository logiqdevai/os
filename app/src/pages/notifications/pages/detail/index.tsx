import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowUpRight, Bell, Mail } from "lucide-react";
import { Page, PageHeader, KeyValueList } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { useNotification, useNotificationAction, useUpdateNotification } from "@/features/notifications/hooks/use-notifications";
import { formatDateTime, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ModuleLabelOptions, NotificationCategoryFormOptions, NotificationPriorityFormOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { CATEGORY_ICON } from "../../components/notification-row";

/**
 * /notifications/:id — one of my notifications (404 for anyone else's, never 403).
 * @api GET /notifications/:id · PATCH /notifications/:id · POST /notifications/:id/actions
 * @states loading · not found / expired · error
 */
export default function NotificationDetailPage() {
    const { id } = useParams();
    const q = useNotification(id);
    const update = useUpdateNotification();
    const act = useNotificationAction();
    const marked = useRef(false);

    useEffect(() => {
        if (q.data && !q.data.read_at && !marked.current) {
            marked.current = true;
            update.mutate({ id: q.data.id, read: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q.data]);

    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><PageHeader title="Notification" back={{ to: "/notifications", label: "Inbox" }} /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;

    const n = q.data;
    const Icon = CATEGORY_ICON[n.category] ?? Bell;
    const actions = Array.isArray(n.actions) && n.requires_action && !n.action_taken ? n.actions : [];
    const internalLink = n.action_url && n.action_url.startsWith("/") ? n.action_url : null;

    return (
        <Page width="narrow">
            <PageHeader
                back={{ to: "/notifications", label: "Inbox" }}
                title={n.title}
                documentTitle="Notification"
                meta={<>
                    {n.is_mandatory && <Badge variant="neutral">Required</Badge>}
                    {(n.priority === "IMPORTANT" || n.priority === "CRITICAL") && <Badge variant={n.priority === "CRITICAL" ? "danger" : "warning"}>{getDropdownOptionLabel(NotificationPriorityFormOptions, n.priority)}</Badge>}
                </>}
                actions={
                    <>
                        <Button variant="outline" size="sm" onClick={() => update.mutate({ id: n.id, read: false })} disabled={!n.read_at}><Mail /> Mark unread</Button>
                        {n.archived_at ? (
                            <Button variant="outline" size="sm" onClick={() => update.mutate({ id: n.id, archived: false })}><ArchiveRestore /> Move to inbox</Button>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => update.mutate({ id: n.id, archived: true })}><Archive /> Archive</Button>
                        )}
                    </>
                }
            />
            <div className="space-y-5 rounded-lg border border-border bg-card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-secondary text-muted-foreground"><Icon className="size-4" /></div>
                    <div className="min-w-0 space-y-2">
                        {n.body ? <p className="whitespace-pre-wrap text-sm text-body">{n.body}</p> : <p className="text-sm text-muted-foreground">No additional details.</p>}
                        {n.action_taken && <Badge variant="success">Handled {n.action_taken_at ? `· ${formatDateTime(n.action_taken_at)}` : ""}</Badge>}
                    </div>
                </div>
                {(actions.length > 0 || internalLink) && (
                    <div className="flex flex-wrap gap-2">
                        {actions.map((a) => (
                            <Button key={a.key} variant={a.style === "primary" ? "default" : "outline"} loading={act.isPending} onClick={() => act.mutate({ id: n.id, action: a.key })}>{a.label}</Button>
                        ))}
                        {internalLink && (
                            <Button variant={actions.length ? "ghost" : "default"} asChild>
                                <Link to={internalLink}>Open {n.entity_label ? `“${n.entity_label}”` : "record"} <ArrowUpRight /></Link>
                            </Button>
                        )}
                    </div>
                )}
                <KeyValueList
                    items={[
                        { label: "From", value: n.actor ? personName(n.actor.user) : "System" },
                        { label: "Module", value: getDropdownOptionLabel(ModuleLabelOptions, n.module) },
                        { label: "Category", value: getDropdownOptionLabel(NotificationCategoryFormOptions, n.category) },
                        { label: "Received", value: formatDateTime(n.created_at) },
                        { label: "Record", value: n.entity_label },
                        { label: "Event", value: n.event_type?.name },
                    ]}
                />
                <p className="text-xs text-muted-foreground">Opening the record checks your access again; if you no longer have access, the notification stays readable here.</p>
            </div>
        </Page>
    );
}
