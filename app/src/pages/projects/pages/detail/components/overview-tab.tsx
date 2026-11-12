import { AlertTriangle, CalendarClock, CheckCircle2, Clock, ListChecks, OctagonAlert } from "lucide-react";
import { KeyValueList, Section } from "@/components/ui/page";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks/use-permission";
import type { ProjectDetail } from "@/features/projects/interfaces/projects.interfaces";
import { formatDate, formatMoney, formatNumber, formatRelative } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ProjectPriorityFormOptions, ProjectVisibilityFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { Markdown } from "@/components/ui/markdown";
import { HealthBadge, ProgressBar, ProjectStatusBadge } from "../../../components/project-badges";

export function OverviewTab({ project: d, onTab }: { project: ProjectDetail; onTab: (tab: string) => void }) {
    const canMoney = usePermission("projects.finance.read");
    const s = d.summary;
    const pct = s.tasks.total ? Math.round((s.tasks.done / s.tasks.total) * 100) : d.progress_percent;
    const budget = d.budget_hours ? Number(d.budget_hours) : null;
    const burn = budget ? Math.round((s.logged_hours / budget) * 100) : null;

    return (
        <div className="space-y-6">
            <StatGrid>
                <StatCard label="Tasks done" value={`${s.tasks.done}/${s.tasks.total}`} icon={ListChecks} hint={`${s.tasks.in_progress} in progress`} />
                <StatCard label="Overdue tasks" value={s.tasks.overdue} icon={Clock} tone={s.tasks.overdue ? "danger" : "default"} />
                <StatCard label="Milestones" value={`${s.milestones.completed}/${s.milestones.total}`} icon={CalendarClock} tone={s.milestones.overdue ? "warning" : "default"} hint={s.milestones.overdue ? `${s.milestones.overdue} overdue` : s.milestones.next ? `Next: ${s.milestones.next.name}` : "None planned"} />
                <StatCard label="Open risks & issues" value={s.open_risks + s.open_issues + s.open_blockers} icon={s.open_blockers ? OctagonAlert : AlertTriangle} tone={s.open_blockers ? "danger" : s.open_risks + s.open_issues ? "warning" : "default"} hint={s.open_blockers ? `${s.open_blockers} blockers` : `${s.pending_change_requests} change requests pending`} />
            </StatGrid>

            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                <div className="space-y-6">
                    <Section title="Progress">
                        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                            <div className="flex items-center gap-3">
                                <ProgressBar value={pct} className="h-2" />
                                <span className="w-12 text-right text-sm font-medium tabular">{pct}%</span>
                            </div>
                            {budget !== null && (
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <ProgressBar value={burn ?? 0} tone={(burn ?? 0) > 100 ? "danger" : (burn ?? 0) > 85 ? "warning" : "default"} />
                                    <span className="shrink-0 tabular">{formatNumber(s.logged_hours, 1)}h of {formatNumber(budget)}h</span>
                                </div>
                            )}
                            {d.health_reason && <p className="text-[13px] text-muted-foreground">{d.health_reason}</p>}
                        </div>
                    </Section>

                    <Section title="Latest update" actions={<Button variant="ghost" size="sm" onClick={() => onTab("updates")}>All updates</Button>}>
                        <div className="rounded-lg border border-border bg-card p-4">
                            {s.latest_update ? (
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        {s.latest_update.health && <HealthBadge health={s.latest_update.health} />}
                                        <span>{formatRelative(s.latest_update.published_at)}</span>
                                    </div>
                                    <Markdown source={s.latest_update.summary} className="space-y-1.5 text-[13px]" />
                                </div>
                            ) : (
                                <p className="text-[13px] text-muted-foreground">No status update yet. Post one to share health and progress.</p>
                            )}
                        </div>
                    </Section>

                    {d.description && (
                        <Section title="About">
                            <p className="whitespace-pre-line rounded-lg border border-border bg-card p-4 text-[13px] text-body">{d.description}</p>
                        </Section>
                    )}
                </div>

                <div className="space-y-6">
                    <Section title="Details">
                        <div className="rounded-lg border border-border bg-card p-4">
                            <KeyValueList
                                columns={1}
                                items={[
                                    { label: "Status", value: <ProjectStatusBadge status={d.status} /> },
                                    { label: "Project manager", value: <MemberAvatar person={d.owner?.user} showName emptyLabel="No owner" /> },
                                    { label: "Customer", value: d.company?.name ?? "Internal" },
                                    { label: "Team", value: d.team ? `${d.team.name}${d.team.task_key ? ` (${d.team.task_key})` : ""}` : null },
                                    { label: "Priority", value: getDropdownOptionLabel(ProjectPriorityFormOptions, d.priority) },
                                    { label: "Visibility", value: getDropdownOptionLabel(ProjectVisibilityFormOptions, d.visibility) },
                                    { label: "Start", value: formatDate(d.actual_start ?? d.planned_start) },
                                    { label: "Target completion", value: formatDate(d.target_completion) },
                                    ...(canMoney && d.budget_amount ? [{ label: "Budget", value: formatMoney(d.budget_amount, d.currency ?? "EUR") }] : []),
                                    ...(d.template ? [{ label: "Template", value: d.template.name }] : []),
                                ]}
                            />
                        </div>
                    </Section>
                    <Section title="Team" actions={<Button variant="ghost" size="sm" onClick={() => onTab("members")}>Manage</Button>}>
                        <div className="rounded-lg border border-border bg-card p-4">
                            {d.members.length ? (
                                <ul className="space-y-2">
                                    {d.members.slice(0, 8).map((m) => (
                                        <li key={m.id} className="flex items-center justify-between gap-2">
                                            <MemberAvatar person={m.membership.user} showName />
                                            <span className="truncate text-xs text-muted-foreground">{m.role_label ?? m.role?.name ?? ""}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><CheckCircle2 className="size-4" /> No members yet</p>
                            )}
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
}
