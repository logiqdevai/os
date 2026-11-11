import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDays, format, isBefore, parseISO, startOfDay } from "date-fns";
import { Activity, Bell, CalendarDays, CheckSquare, FolderKanban, Hourglass, ListChecks, Plus, Video } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/access/can";
import { usePermissions } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useMyOpenTasks, useMyProjects } from "@/features/home/hooks/use-home";
import { useMyActivity, useNotificationCounts, useNotifications, useOpenNotification } from "@/features/notifications/hooks/use-notifications";
import { useCalendarEvents } from "@/features/calendar/hooks/use-calendar";
import { TaskPriorityFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { ProjectHealthFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatRelative } from "@/lib/format";
import { Widget, WidgetRow } from "../../components/widget";

const PRIORITY_VARIANT: Record<string, "danger" | "warning" | "neutral"> = { URGENT: "danger", HIGH: "warning" };
const HEALTH_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = { ON_TRACK: "success", HEALTHY: "success", AT_RISK: "warning", OFF_TRACK: "danger", BLOCKED: "danger" };

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

/**
 * /home — personal start page (app/mockups/modules/00-home). No tables of its own: read-only summaries from the owning modules,
 * each fetched only when the caller holds that module's read key and the module is enabled; widgets the caller cannot read are not rendered.
 * @api GET /tasks?mine&open · GET /calendar/events (today) · GET /notifications · GET /notifications/unread-count · GET /projects?owner_id=me · GET /activity/mine
 */
export default function HomeOverviewPage() {
    const navigate = useNavigate();
    const session = useSessionData();
    const p = usePermissions();
    const showTasks = p.can("tasks.tasks.read") && p.moduleEnabled("TASKS");
    const showCalendar = p.canAny("calendar.events.read", "calendar.events.read_own") && p.moduleEnabled("CALENDAR");
    const showProjects = p.can("projects.projects.read") && p.moduleEnabled("PROJECTS");

    const today = startOfDay(new Date());
    const range = useMemo(() => ({ from: today.toISOString(), to: addDays(today, 1).toISOString() }), [today.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
    const tasks = useMyOpenTasks(showTasks);
    const events = useCalendarEvents(range, showCalendar);
    const projects = useMyProjects(showProjects);
    const counts = useNotificationCounts();
    const notifications = useNotifications({ state: "unread", limit: 5 });
    const open = useOpenNotification();
    const recent = useMyActivity({ limit: 6 });

    const taskRows = tasks.data?.data ?? [];
    const dueSoon = taskRows.filter((t) => t.due_date && isBefore(parseISO(t.due_date), addDays(today, 2))).length;
    const overdue = taskRows.filter((t) => t.due_date && isBefore(parseISO(t.due_date), today)).length;
    const todayEvents = (events.data?.data ?? []).filter((e) => e.status !== "CANCELLED" && e.my_response !== "DECLINED");
    const next = todayEvents.find((e) => parseISO(e.ends_at) > new Date() && !e.all_day);
    const name = session?.user.first_name || session?.user.display_name || "";

    return (
        <Page>
            <PageHeader
                title={`${greeting()}${name ? `, ${name}` : ""}`}
                documentTitle="Home"
                description={`${format(new Date(), "EEEE, d MMMM")}${counts.data?.action ? ` · ${counts.data.action} ${counts.data.action === 1 ? "thing needs" : "things need"} you` : ""}`}
                actions={
                    <>
                        <Can permission="calendar.events.create"><Button variant="outline" asChild><Link to="/calendar/new"><CalendarDays /> New event</Link></Button></Can>
                        <Can permission="tasks.tasks.create"><Button asChild><Link to="/tasks/new"><Plus /> New task</Link></Button></Can>
                    </>
                }
            />
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {showTasks && <StatCard label="Tasks due soon" value={tasks.isLoading ? "—" : dueSoon} hint={overdue ? `${overdue} overdue` : "Nothing overdue"} tone={overdue ? "danger" : "default"} icon={CheckSquare} />}
                <StatCard label="Waiting on you" value={counts.data?.action ?? "—"} hint="Approvals and acknowledgements" tone={counts.data?.action ? "warning" : "default"} icon={Hourglass} />
                {showCalendar && <StatCard label="Meetings today" value={events.isLoading ? "—" : todayEvents.length} hint={next ? `Next at ${format(parseISO(next.starts_at), "HH:mm")}` : "No more today"} icon={CalendarDays} />}
                <StatCard label="Unread" value={counts.data?.unread ?? "—"} hint="Notifications" tone={counts.data?.unread ? "info" : "default"} icon={Bell} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                {showTasks && (
                    <Widget title="My tasks" icon={ListChecks} link={{ to: "/home/my-work", label: "All my work" }} loading={tasks.isLoading} error={tasks.error} empty={!taskRows.length} emptyTitle="No open tasks assigned to you">
                        {taskRows.map((t) => (
                            <WidgetRow
                                key={t.id}
                                to={`/tasks/${t.identifier}`}
                                title={<><span className="text-muted-foreground tabular">{t.identifier}</span> · {t.title}</>}
                                meta={[t.status?.name, t.due_date ? `Due ${formatDate(t.due_date, "d MMM")}` : null, t.project?.name].filter(Boolean).join(" · ")}
                                right={PRIORITY_VARIANT[t.priority] ? <Badge variant={PRIORITY_VARIANT[t.priority]}>{getDropdownOptionLabel(TaskPriorityFormOptions, t.priority)}</Badge> : undefined}
                            />
                        ))}
                    </Widget>
                )}
                {showCalendar && (
                    <Widget title="Today" icon={CalendarDays} link={{ to: "/calendar?view=day", label: "Open calendar" }} loading={events.isLoading} error={events.error} empty={!todayEvents.length} emptyTitle="Nothing scheduled today">
                        {todayEvents.map((e) => (
                            <WidgetRow
                                key={e.key}
                                to={`/calendar/events/${e.id}`}
                                title={e.title}
                                meta={`${e.all_day ? "All day" : `${format(parseISO(e.starts_at), "HH:mm")} – ${format(parseISO(e.ends_at), "HH:mm")}`}${e.location ? ` · ${e.location}` : ""}`}
                                right={e.meeting_url ? <Video className="size-4 text-muted-foreground" /> : e.my_response === "NEEDS_ACTION" ? <Badge variant="warning">Reply</Badge> : undefined}
                            />
                        ))}
                    </Widget>
                )}
                <Widget title="Notifications" icon={Bell} link={{ to: "/notifications", label: "Open inbox" }} loading={notifications.isLoading} error={notifications.error} empty={!notifications.data?.data.length} emptyTitle="You are all caught up">
                    {(notifications.data?.data ?? []).map((n) => (
                        <button key={n.id} type="button" onClick={() => open.mutate(n.id, { onSuccess: (r) => navigate(r.action_url?.startsWith("/") ? r.action_url : `/notifications/${n.id}`) })} className="flex w-full items-center gap-3 border-b border-border-soft px-4 py-2.5 text-left last:border-b-0 hover:bg-accent/50">
                            <span className="size-1.5 shrink-0 rounded-full bg-info" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] text-foreground">{n.title}</span>
                                <span className="block truncate text-xs text-muted-foreground">{formatRelative(n.created_at)}</span>
                            </span>
                        </button>
                    ))}
                </Widget>
                {showProjects && (
                    <Widget title="Projects I own" icon={FolderKanban} link={{ to: "/projects", label: "All projects" }} loading={projects.isLoading} error={projects.error} empty={!projects.data?.data.length} emptyTitle="You don't own any projects">
                        {(projects.data?.data ?? []).map((pr) => (
                            <WidgetRow
                                key={pr.id}
                                to={`/projects/${pr.id}`}
                                title={pr.name}
                                meta={`${pr.progress_percent ?? 0}% · ${pr.target_completion ? `Due ${formatDate(pr.target_completion, "d MMM")}` : "No due date"}`}
                                right={<Badge variant={HEALTH_VARIANT[pr.health] ?? "neutral"}>{getDropdownOptionLabel(ProjectHealthFormOptions, pr.health)}</Badge>}
                            />
                        ))}
                    </Widget>
                )}
                <Widget title="My recent activity" icon={Activity} link={{ to: "/home/favorites", label: "Favorites & recent" }} loading={recent.isLoading} error={recent.error} empty={!recent.data?.data.length} emptyTitle="No recent activity" emptyDescription="What you create and change shows up here.">
                    {(recent.data?.data ?? []).map((r) => (
                        <WidgetRow key={r.id} title={r.summary} meta={formatRelative(r.occurred_at)} />
                    ))}
                </Widget>
            </div>
        </Page>
    );
}
