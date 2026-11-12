import { useState } from "react";
import { useParams } from "react-router-dom";
import { CloudUpload, Rocket } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, EmptyState, PageSkeleton } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { useAddReleaseDeployment, useRelease, useUpdateRelease } from "@/features/tasks/hooks/use-tasks";
import type { DeploymentStatus } from "@/features/tasks/interfaces/tasks.interfaces";
import { DeploymentEnvironmentOptions, DeploymentStatusFormOptions, ReleaseStatusFormOptions } from "@/config/constants/dropdowns/tasks/task-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, formatDateTime } from "@/lib/format";
import { TaskList } from "../../components/task-list";
import { deploymentVariant, releaseVariant } from "../../components/task-badges";
import { ReleaseNotesEditor } from "../../components/release-notes-editor";

/**
 * /tasks/releases/:releaseId — release tasks, notes and deployments.
 * @perm VIEW tasks.tasks.read · manage tasks.releases.manage
 * @api GET/PATCH /releases/:id · POST /releases/:id/deployments · POST /releases/:id/notes/draft|publish
 */
export default function ReleaseDetailPage() {
    const { releaseId } = useParams();
    const release = useRelease(releaseId);
    const canManage = usePermission("tasks.releases.manage");
    const update = useUpdateRelease();
    const deploy = useAddReleaseDeployment();
    const [shipping, setShipping] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [env, setEnv] = useState("production");
    const [status, setStatus] = useState<DeploymentStatus>("SUCCEEDED");
    const [url, setUrl] = useState("");

    if (release.isPending) return <PageSkeleton />;
    if (release.error) return <Page><PageHeader title="Release" back={{ to: "/tasks/releases", label: "Releases" }} /><ErrorState error={release.error} onRetry={() => release.refetch()} /></Page>;
    const r = release.data;
    const tasks = r.tasks ?? [];
    const open = tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status?.category ?? "")).length;

    return (
        <Page>
            <PageHeader
                back={{ to: "/tasks/releases", label: "Releases" }}
                title={`${r.name}${r.version ? ` ${r.version}` : ""}`}
                description={[r.project?.name, r.released_at ? `Released ${formatDate(r.released_at)}` : r.target_date ? `Target ${formatDate(r.target_date)}` : null].filter(Boolean).join(" · ")}
                meta={<Badge variant={releaseVariant[r.status]}>{getDropdownOptionLabel(ReleaseStatusFormOptions, r.status)}</Badge>}
                actions={canManage && (
                    <>
                        <Button variant="outline" onClick={() => { setUrl(""); setDeploying(true); }}><CloudUpload /> Record deployment</Button>
                        {r.status !== "RELEASED" && <Button onClick={() => setShipping(true)}><Rocket /> Mark released</Button>}
                    </>
                )}
            />
            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                <Section title={`Tasks (${tasks.length})`}>
                    <TaskList
                        query={{ data: { data: tasks, pagination: { total: tasks.length, page: 1, limit: tasks.length, total_pages: 1, has_next: false, has_prev: false } }, isPending: false, isFetching: release.isFetching, error: null, refetch: () => release.refetch() }}
                        groupBy="status"
                        empty={{ title: "No tasks in this release", description: "Set the release on tasks to include them." }}
                    />
                </Section>
                <div className="space-y-6">
                    <Section title="Deployments">
                        <div className="rounded-lg border border-border bg-card">
                            {!r.deployments.length ? <EmptyState compact icon={CloudUpload} title="No deployments yet" /> : (
                                <ul className="divide-y divide-border-soft">
                                    {r.deployments.map((d) => (
                                        <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                                            <div className="min-w-0">
                                                <div className="font-medium capitalize text-foreground">{d.environment}</div>
                                                <div className="text-xs text-muted-foreground">{formatDateTime(d.deployed_at ?? d.created_at)}</div>
                                            </div>
                                            <Badge variant={deploymentVariant[d.status]}>{getDropdownOptionLabel(DeploymentStatusFormOptions, d.status)}</Badge>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </Section>
                    <ReleaseNotesEditor release={r} />
                </div>
            </div>
            <ConfirmationDialog
                isOpen={shipping}
                onClose={() => setShipping(false)}
                title={`Mark ${r.name} as released?`}
                description={open ? `${open} tasks in this release are not done yet.` : "All tasks are done."}
                confirmText="Mark released"
                isLoading={update.isPending}
                onConfirm={() => update.mutate({ id: r.id, status: "RELEASED" }, { onSuccess: () => setShipping(false) })}
            />
            <Dialog open={deploying} onOpenChange={(o) => !deploy.isPending && setDeploying(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Record deployment</DialogTitle><DialogDescription>{r.name}</DialogDescription></DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Environment</Label>
                            <Select value={env} onValueChange={setEnv}>
                                <SelectTrigger aria-label="Environment"><SelectValue /></SelectTrigger>
                                <SelectContent>{DeploymentEnvironmentOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Result</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as DeploymentStatus)}>
                                <SelectTrigger aria-label="Result"><SelectValue /></SelectTrigger>
                                <SelectContent>{DeploymentStatusFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dep-url">URL</Label><Input id="dep-url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDeploying(false)} disabled={deploy.isPending}>Cancel</Button>
                        <Button loading={deploy.isPending} onClick={() => deploy.mutate({ id: r.id, environment: env, status, url: url || undefined }, { onSuccess: () => setDeploying(false) })}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
