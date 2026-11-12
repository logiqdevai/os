import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, CheckCircle2, MoreHorizontal, RotateCcw, Star, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import {
    useArchiveProject,
    useCompleteProject,
    useDeleteProject,
    useProject,
    useReopenProject,
    useRestoreProject,
    useSetProjectFavorite,
    useUpdateProject,
} from "@/features/projects/hooks/use-projects";
import { ProjectTabOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { cn } from "@/lib/utils";
import { HealthBadge, ProjectDot } from "../../components/project-badges";
import { OverviewTab } from "./components/overview-tab";
import { ProjectTasksTab } from "./components/tasks-tab";
import { MilestonesTab } from "./components/milestones-tab";
import { DeliverablesTab } from "./components/deliverables-tab";
import { RaidTab } from "./components/raid-tab";
import { UpdatesTab } from "./components/updates-tab";
import { MembersTab } from "./components/members-tab";
import { SettingsTab } from "./components/settings-tab";
import { TimelineTab } from "./components/timeline-tab";
import { GovernanceTab } from "./components/governance-tab";
import { CloseoutTab } from "./components/closeout-tab";

type Confirm = "complete" | "archive" | "delete" | null;

/**
 * /projects/:projectId?tab=overview|tasks|timeline|milestones|deliverables|raid|updates|governance|closeout|members|settings — project workspace.
 * @perm VIEW projects.projects.read (+ project scope) · edit projects.projects.update · complete/reopen/archive/delete own keys
 * @api GET/PATCH /projects/:id · child endpoints per tab
 * @states loading · not found / no access (404 for out-of-scope) · per-tab empty and error
 */
export default function ProjectDetailPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "overview";
    const project = useProject(projectId);
    const p = usePermissions();
    const update = useUpdateProject();
    const favorite = useSetProjectFavorite();
    const complete = useCompleteProject();
    const reopen = useReopenProject();
    const archive = useArchiveProject();
    const restore = useRestoreProject();
    const remove = useDeleteProject();
    const [confirm, setConfirm] = useState<Confirm>(null);

    if (project.isPending) return <PageSkeleton />;
    if (project.error) return <Page><PageHeader title="Project" back={{ to: "/projects", label: "Projects" }} /><ErrorState error={project.error} onRetry={() => project.refetch()} /></Page>;
    const d = project.data;
    const closed = !!d.completed_at || d.status?.category === "CANCELLED";
    const canEdit = p.can("projects.projects.update") && !d.archived_at;
    const setTab = (t: string) => setSp((prev) => { const n = new URLSearchParams(prev); if (t === "overview") n.delete("tab"); else n.set("tab", t); return n; }, { replace: true });
    const tabs = ProjectTabOptions.filter((t) => t.id !== "settings" || p.can("projects.projects.update"));

    return (
        <Page>
            <PageHeader
                back={{ to: "/projects", label: "Projects" }}
                documentTitle={d.name}
                title={<span className="flex items-center gap-2"><ProjectDot color={d.color} className="size-2.5" />{d.name}</span>}
                description={[d.code, d.company?.name ?? "Internal project", d.type?.name].filter(Boolean).join(" · ")}
                meta={<><HealthBadge health={d.health} />{d.archived_at && <span className="text-xs text-warning">Archived</span>}</>}
                actions={
                    <>
                        <Button variant="ghost" size="icon" aria-label={d.is_favorite ? "Unstar project" : "Star project"} onClick={() => favorite.mutate({ id: d.id, favorite: !d.is_favorite })}>
                            <Star className={cn(d.is_favorite && "fill-current text-warning")} />
                        </Button>
                        <Select value={d.status?.id ?? ""} disabled={!canEdit || update.isPending} onValueChange={(status_id) => update.mutate({ id: d.id, status_id })}>
                            <SelectTrigger className="h-8 w-44" aria-label="Project status"><SelectValue placeholder="Set status" /></SelectTrigger>
                            <SelectContent>{d.allowed_statuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {!closed && p.can("projects.projects.complete") && !d.archived_at && (
                            <Button variant="outline" onClick={() => setConfirm("complete")}><CheckCircle2 /> Complete</Button>
                        )}
                        {(p.can("projects.projects.reopen") && closed) || p.can("projects.projects.archive") || p.can("projects.projects.delete") ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {closed && p.can("projects.projects.reopen") && <DropdownMenuItem onSelect={() => reopen.mutate({ id: d.id })}><RotateCcw /> Reopen</DropdownMenuItem>}
                                    {p.can("projects.projects.archive") && (d.archived_at
                                        ? <DropdownMenuItem onSelect={() => restore.mutate(d.id)}><RotateCcw /> Restore</DropdownMenuItem>
                                        : <DropdownMenuItem onSelect={() => setConfirm("archive")}><Archive /> Archive</DropdownMenuItem>)}
                                    {p.can("projects.projects.delete") && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm("delete")}><Trash2 /> Delete</DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : null}
                    </>
                }
            />

            <Tabs value={tab} onValueChange={setTab}>
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <TabsList className="h-9 w-max justify-start">
                        {tabs.map((t) => <TabsTrigger key={t.id} value={t.id} className="text-[13px]">{t.label}</TabsTrigger>)}
                    </TabsList>
                </div>
                <TabsContent value="overview" className="mt-4"><OverviewTab project={d} onTab={setTab} /></TabsContent>
                <TabsContent value="tasks" className="mt-4"><ProjectTasksTab project={d} /></TabsContent>
                <TabsContent value="timeline" className="mt-4"><TimelineTab project={d} /></TabsContent>
                <TabsContent value="milestones" className="mt-4"><MilestonesTab projectId={d.id} /></TabsContent>
                <TabsContent value="deliverables" className="mt-4"><DeliverablesTab projectId={d.id} /></TabsContent>
                <TabsContent value="raid" className="mt-4"><RaidTab projectId={d.id} /></TabsContent>
                <TabsContent value="updates" className="mt-4"><UpdatesTab project={d} /></TabsContent>
                <TabsContent value="governance" className="mt-4"><GovernanceTab project={d} /></TabsContent>
                <TabsContent value="closeout" className="mt-4"><CloseoutTab project={d} /></TabsContent>
                <TabsContent value="members" className="mt-4"><MembersTab project={d} /></TabsContent>
                {p.can("projects.projects.update") && <TabsContent value="settings" className="mt-4"><SettingsTab project={d} /></TabsContent>}
            </Tabs>

            <ConfirmationDialog
                isOpen={confirm === "complete"}
                onClose={() => setConfirm(null)}
                title={`Complete ${d.name}?`}
                description={d.summary.tasks.open ? `${d.summary.tasks.open} tasks are still open. Blocking gates and required checklist items must be done first (see Closeout).` : "The project moves to Completed. Blocking gates and required checklist items must be done first."}
                confirmText="Complete project"
                isLoading={complete.isPending}
                onConfirm={() => complete.mutate(d.id, { onSuccess: () => setConfirm(null) })}
            />
            <ConfirmationDialog
                isOpen={confirm === "archive"}
                onClose={() => setConfirm(null)}
                title={`Archive ${d.name}?`}
                description="Archived projects are hidden from lists and pickers. Tasks and history are kept."
                confirmText="Archive"
                variant="destructive"
                isLoading={archive.isPending}
                onConfirm={() => archive.mutate(d.id, { onSuccess: () => setConfirm(null) })}
            />
            <ConfirmationDialog
                isOpen={confirm === "delete"}
                onClose={() => setConfirm(null)}
                title={`Delete ${d.name}?`}
                description="Milestones, deliverables, RAID items and updates are deleted. Tasks are kept without a project. This cannot be undone."
                confirmText="Delete project"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => remove.mutate(d.id, { onSuccess: () => navigate("/projects") })}
            />
        </Page>
    );
}
