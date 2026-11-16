import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDays, format, isBefore, parseISO, startOfDay } from "date-fns";
import { Activity, Bell, CalendarDays, CheckSquare, FolderKanban, Hourglass, ListChecks, Plus, Video } from "lucide-react";
import { Page } from "@/components/ui/page";
import { usePageMetadata } from "@/hooks/use-page-metadata";
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
import { cn } from "@/lib/utils";
import { AllClear, HomeStat, Pill, Widget, WidgetRow, type Tone } from "../../components/widget";

const PRIORITY_TONE: Record<string, Tone> = { URGENT: "danger", HIGH: "warning" };
const HEALTH_TONE: Record<string, Tone> = { ON_TRACK: "success", HEALTHY: "success", AT_RISK: "warning", OFF_TRACK: "danger", BLOCKED: "danger" };

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
    usePageMetadata({ title: "Home" });
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
    const unread = counts.data?.unread ?? 0;
    const action = counts.data?.action ?? 0;

    return (
        <Page className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="truncate text-3xl font-semibold tracking-tight text-foreground">{greeting()}{name ? `, ${name}` : ""}</h1>
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                        {format(new Date(), "EEEE, d MMMM")}
                        {action > 0 && <><span className="mx-1.5">•</span><span className="font-medium text-primary">{action} {action === 1 ? "thing needs" : "things need"} you today</span></>}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Can permission="calendar.events.create"><Button variant="outline" asChild><Link to="/calendar/new"><CalendarDays /> New event</Link></Button></Can>
                    <Can permission="tasks.tasks.create"><Button asChild><Link to="/tasks/new"><Plus /> New task</Link></Button></Can>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {showTasks && <HomeStat label="Tasks due soon" icon={CheckSquare} tone={overdue ? "danger" : "brand"} loading={tasks.isLoading} value={dueSoon} pill={overdue ? `${overdue} overdue` : "All clear"} hint={overdue ? "Needs attention" : "Nothing overdue"} />}
                <HomeStat label="Waiting on you" icon={Hourglass} tone="info" value={counts.data?.action ?? "—"} pill={action ? "Pending" : "Zero pending"} hint="Approvals & acknowledgements" />
                {showCalendar && <HomeStat label="Meetings today" icon={Video} tone="brand" loading={events.isLoading} value={todayEvents.length} pill={todayEvents.length ? "Booked" : undefined} hint={next ? `Next at ${format(parseISO(next.starts_at), "HH:mm")}` : "No more today"} />}
                <HomeStat label="Unread" icon={Bell} tone="danger" value={counts.data?.unread ?? "—"} pill={unread ? "Priority" : undefined} hint="Notifications" />
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                    {showTasks && (
                        <Widget
                            title="My tasks"
                            icon={ListChecks}
                            link={{ to: "/home/my-work", label: "All my work" }}
                            loading={tasks.isLoading}
                            error={tasks.error}
                            empty={!taskRows.length}
                            emptySlot={<AllClear title="You're completely on top of things!" description="No impending deadlines. Enjoy the headspace." action={<Can permission="tasks.tasks.create"><Link to="/tasks/new" className="text-xs font-semibold text-primary hover:underline">+ Quick add</Link></Can>} />}
                        >
                            {taskRows.map((t) => (
                                <WidgetRow
                                    key={t.id}
                                    to={`/tasks/${t.identifier}`}
                                    title={t.title}
                                    meta={<><Pill tone="brand" className="mr-1.5 tabular">{t.identifier}</Pill>{[t.status?.name, t.project?.name].filter(Boolean).join(" · ")}</>}
                                    right={
                                        <span className="flex items-center gap-2">
                                            {PRIORITY_TONE[t.priority] && <Pill tone={PRIORITY_TONE[t.priority]}>{getDropdownOptionLabel(TaskPriorityFormOptions, t.priority)}</Pill>}
                                            {t.due_date && <Pill tone={isBefore(parseISO(t.due_date), today) ? "danger" : "warning"}>{formatDate(t.due_date, "MMM d")}</Pill>}
                                        </span>
                                    }
                                />
                            ))}
                        </Widget>
                    )}
                    <Widget title="Notifications" icon={Bell} tone="danger" link={{ to: "/notifications", label: "Open inbox" }} loading={notifications.isLoading} error={notifications.error} empty={!notifications.data?.data.length} emptyTitle="You are all caught up">
                        {(notifications.data?.data ?? []).map((n) => (
                            <button key={n.id} type="button" onClick={() => open.mutate(n.id, { onSuccess: (r) => navigate(r.action_url?.startsWith("/") ? r.action_url : `/notifications/${n.id}`) })} className="flex w-full items-center gap-3 rounded-xl bg-muted/60 px-3.5 py-2.5 text-left transition-colors hover:bg-accent">
                                <span className="size-2 shrink-0 rounded-full bg-danger" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-medium text-foreground">{n.title}</span>
                                    <span className="block truncate text-xs text-muted-foreground">{formatRelative(n.created_at)}</span>
                                </span>
                            </button>
                        ))}
                    </Widget>
                    <Widget title="My recent activity" icon={Activity} link={{ to: "/home/favorites", label: "Favorites & recent" }} loading={recent.isLoading} error={recent.error} empty={!recent.data?.data.length} emptyTitle="No recent activity" emptyDescription="What you create and change shows up here.">
                        {(recent.data?.data ?? []).map((r) => (
                            <WidgetRow key={r.id} title={r.summary} meta={formatRelative(r.occurred_at)} />
                        ))}
                    </Widget>
                </div>

                <div className="space-y-4">
                    {showCalendar && (
                        <Widget title="Today" icon={CalendarDays} link={{ to: "/calendar?view=day", label: "Open calendar" }} loading={events.isLoading} error={events.error} empty={!todayEvents.length} emptyTitle="Nothing scheduled today">
                            {todayEvents.map((e) => {
                                const isNext = next?.key === e.key;
                                return (
                                    <WidgetRow
                                        key={e.key}
                                        to={`/calendar/events/${e.id}`}
                                        highlight={isNext}
                                        title={<>{e.title}{isNext && <Pill tone="brand" className="ml-2">Next</Pill>}</>}
                                        meta={`${e.all_day ? "All day" : `${format(parseISO(e.starts_at), "HH:mm")} – ${format(parseISO(e.ends_at), "HH:mm")}`}${e.location ? ` · ${e.location}` : ""}`}
                                        right={
                                            e.meeting_url ? (
                                                <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium", isNext ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                                                    <Video className="size-3.5" />{isNext && "Join"}
                                                </span>
                                            ) : e.my_response === "NEEDS_ACTION" ? <Pill tone="warning">Reply</Pill> : undefined
                                        }
                                    />
                                );
                            })}
                        </Widget>
                    )}
                    {showProjects && (
                        <Widget title="Projects I own" icon={FolderKanban} link={{ to: "/projects", label: "All projects" }} loading={projects.isLoading} error={projects.error} empty={!projects.data?.data.length} emptyTitle="You don't own any projects">
                            {(projects.data?.data ?? []).map((pr) => {
                                const pct = pr.progress_percent ?? 0;
                                return (
                                    <Link key={pr.id} to={`/projects/${pr.id}`} className="block space-y-2 rounded-xl bg-muted/60 px-3.5 py-3 transition-colors hover:bg-accent">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate text-[13px] font-medium text-foreground">{pr.name}</span>
                                            <Pill tone={HEALTH_TONE[pr.health] ?? "neutral"}>{getDropdownOptionLabel(ProjectHealthFormOptions, pr.health)}</Pill>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>{pct}% complete</span>
                                            <span>{pr.target_completion ? `Due ${formatDate(pr.target_completion, "d MMM")}` : "No due date"}</span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </Widget>
                    )}
                </div>
            </div>
        </Page>
    );
}
