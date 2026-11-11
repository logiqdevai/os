import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, FileStack, Pencil, Plus, RotateCcw, Tags } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    useArchiveProjectStatus,
    useArchiveProjectType,
    useCreateProjectStatus,
    useCreateProjectTemplate,
    useCreateProjectType,
    useProjectStatuses,
    useProjectTemplates,
    useProjectTypes,
    useUpdateProjectStatus,
    useUpdateProjectTemplate,
    useUpdateProjectType,
} from "@/features/projects/hooks/use-projects";
import type { ProjectStatus, ProjectStatusCategory, ProjectTemplate, ProjectType, TemplateStructure } from "@/features/projects/interfaces/projects.interfaces";
import { ColorTokenFormOptions, ProjectStatusCategoryFormOptions } from "@/config/constants/dropdowns/projects/project-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ProjectStatusBadge } from "../../components/project-badges";

/**
 * /projects/settings?tab=statuses|types|templates — project setup.
 * @perm projects.settings.manage · @api /project-statuses · /project-types · /project-templates
 * @audit status, type or template changed · template version published
 */
export default function ProjectSettingsPage() {
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "statuses";
    return (
        <Page width="wide">
            <PageHeader title="Project setup" description="Lifecycle statuses, project types and templates for your organization." />
            <Tabs value={tab} onValueChange={(t) => setSp({ tab: t }, { replace: true })}>
                <TabsList>
                    <TabsTrigger value="statuses">Statuses</TabsTrigger>
                    <TabsTrigger value="types">Types</TabsTrigger>
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                </TabsList>
                <TabsContent value="statuses" className="mt-4"><StatusesSection /></TabsContent>
                <TabsContent value="types" className="mt-4"><TypesSection /></TabsContent>
                <TabsContent value="templates" className="mt-4"><TemplatesSection /></TabsContent>
            </Tabs>
        </Page>
    );
}

function StatusesSection() {
    const statuses = useProjectStatuses();
    const archive = useArchiveProjectStatus();
    const [editing, setEditing] = useState<ProjectStatus | null>(null);
    const [open, setOpen] = useState(false);
    const columns: DataTableColumn<ProjectStatus>[] = [
        { key: "name", header: "Status", cell: (s) => <div className="flex items-center gap-2"><ProjectStatusBadge status={s} />{s.is_default && <span className="text-xs text-muted-foreground">Default</span>}</div> },
        { key: "category", header: "Category", hideBelow: "sm", cell: (s) => getDropdownOptionLabel(ProjectStatusCategoryFormOptions, s.category) },
        { key: "transitions", header: "Can move to", hideBelow: "lg", cell: (s) => (s.allowed_transitions.length ? s.allowed_transitions.join(", ") : <span className="text-ash">Any status</span>) },
        { key: "count", header: "Projects", className: "tabular text-right", headerClassName: "text-right", cell: (s) => s._count?.projects ?? 0 },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-20",
            cell: (s) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setOpen(true); }}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Archive ${s.name}`} disabled={s.is_default} onClick={() => archive.mutate(s.id)}><Archive /></Button>
                </div>
            ),
        },
    ];
    return (
        <div className="space-y-3">
            <div className="flex justify-end"><Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Add status</Button></div>
            <DataTable columns={columns} data={statuses.data} rowKey={(s) => s.id} loading={statuses.isFetching} error={statuses.error} onRetry={() => statuses.refetch()} empty={{ title: "No statuses" }} />
            <StatusDialog open={open} onOpenChange={setOpen} status={editing} all={statuses.data ?? []} />
        </div>
    );
}

function StatusDialog({ open, onOpenChange, status, all }: { open: boolean; onOpenChange: (o: boolean) => void; status: ProjectStatus | null; all: ProjectStatus[] }) {
    const create = useCreateProjectStatus();
    const update = useUpdateProjectStatus();
    const [name, setName] = useState("");
    const [category, setCategory] = useState<ProjectStatusCategory>("IN_PROGRESS");
    const [color, setColor] = useState("info");
    const [isDefault, setIsDefault] = useState(false);
    const [transitions, setTransitions] = useState<string[]>([]);
    const [key, setKey] = useState<string | null>(null);
    const current = `${open}-${status?.id ?? "new"}`;
    if (key !== current) {
        setKey(current);
        setName(status?.name ?? "");
        setCategory(status?.category ?? "IN_PROGRESS");
        setColor(status?.color ?? "info");
        setIsDefault(status?.is_default ?? false);
        setTransitions(status?.allowed_transitions ?? []);
    }
    const pending = create.isPending || update.isPending;
    const save = () => {
        const dto = { name: name.trim(), category, color, is_default: isDefault, allowed_transitions: transitions };
        const done = { onSuccess: () => onOpenChange(false) };
        if (status) update.mutate({ id: status.id, ...dto }, done);
        else create.mutate(dto, done);
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{status ? "Edit status" : "New status"}</DialogTitle>
                    <DialogDescription>The category drives reports and automation; the name is yours.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5"><Label htmlFor="ps-name">Name</Label><Input id="ps-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="In delivery" /></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Category</Label>
                            <Select value={category} onValueChange={(v) => setCategory(v as ProjectStatusCategory)}>
                                <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                                <SelectContent>{ProjectStatusCategoryFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Color</Label>
                            <Select value={color} onValueChange={setColor}>
                                <SelectTrigger aria-label="Color"><SelectValue /></SelectTrigger>
                                <SelectContent>{ColorTokenFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Can move to (none selected = any status)</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {all.filter((s) => s.id !== status?.id).map((s) => {
                                const on = transitions.includes(s.slug);
                                return (
                                    <button key={s.id} type="button" aria-pressed={on} onClick={() => setTransitions(on ? transitions.filter((t) => t !== s.slug) : [...transitions, s.slug])}>
                                        <Badge variant={on ? "info" : "outline"}>{s.name}</Badge>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3"><span className="text-[13px]">Default for new projects</span><Switch checked={isDefault} onCheckedChange={setIsDefault} aria-label="Default status" /></div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button onClick={save} disabled={!name.trim()} loading={pending}>{status ? "Save" : "Add status"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TypesSection() {
    const types = useProjectTypes();
    const archive = useArchiveProjectType();
    const create = useCreateProjectType();
    const update = useUpdateProjectType();
    const [editing, setEditing] = useState<ProjectType | null>(null);
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const openDialog = (t: ProjectType | null) => { setEditing(t); setName(t?.name ?? ""); setDescription(t?.description ?? ""); setOpen(true); };
    const columns: DataTableColumn<ProjectType>[] = [
        { key: "name", header: "Type", cell: (t) => <div className="min-w-0"><div className="font-medium text-foreground">{t.name} {t.is_default && <span className="text-xs font-normal text-muted-foreground">· Default</span>}</div>{t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}</div> },
        { key: "count", header: "Projects", className: "tabular text-right", headerClassName: "text-right", cell: (t) => t._count?.projects ?? 0 },
        {
            key: "actions", header: <span className="sr-only">Actions</span>, className: "w-20",
            cell: (t) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`} onClick={() => openDialog(t)}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Archive ${t.name}`} onClick={() => archive.mutate(t.id)}>{t.archived_at ? <RotateCcw /> : <Archive />}</Button>
                </div>
            ),
        },
    ];
    const pending = create.isPending || update.isPending;
    return (
        <div className="space-y-3">
            <div className="flex justify-end"><Button size="sm" onClick={() => openDialog(null)}><Plus /> Add type</Button></div>
            <DataTable columns={columns} data={types.data} rowKey={(t) => t.id} loading={types.isFetching} error={types.error} onRetry={() => types.refetch()} empty={{ icon: Tags, title: "No project types" }} />
            <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "Edit type" : "New project type"}</DialogTitle><DialogDescription>Types group projects and pick a default template.</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5"><Label htmlFor="pt-name">Name</Label><Input id="pt-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="pt-desc">Description</Label><Textarea id="pt-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                        <Button
                            disabled={!name.trim()}
                            loading={pending}
                            onClick={() => {
                                const dto = { name: name.trim(), description: description || undefined };
                                if (editing) update.mutate({ id: editing.id, ...dto }, { onSuccess: () => setOpen(false) });
                                else create.mutate(dto, { onSuccess: () => setOpen(false) });
                            }}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** Parse "Name | days" lines into milestones and plain lines into tasks. */
function parseStructure(milestones: string, tasks: string, checklist: string): TemplateStructure {
    const ms = milestones.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => {
        const [name, days] = l.split("|").map((x) => x.trim());
        return { key: `m${i}`, name, offset_days: Number(days) || 0, customer_visible: true };
    });
    return {
        milestones: ms,
        tasks: tasks.split("\n").map((l) => l.trim()).filter(Boolean).map((title) => ({ title })),
        checklists: checklist.trim() ? [{ name: "Launch checklist", phase: "launch", items: checklist.split("\n").map((l) => l.trim()).filter(Boolean) }] : [],
    };
}

function TemplatesSection() {
    const templates = useProjectTemplates();
    const types = useProjectTypes();
    const create = useCreateProjectTemplate();
    const update = useUpdateProjectTemplate();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [typeId, setTypeId] = useState("__none");
    const [milestones, setMilestones] = useState("Kickoff | 0\nDesign sign-off | 14\nLaunch | 42");
    const [tasks, setTasks] = useState("");
    const [checklist, setChecklist] = useState("");
    const columns: DataTableColumn<ProjectTemplate>[] = [
        { key: "name", header: "Template", cell: (t) => <div className="min-w-0"><div className="font-medium text-foreground">{t.name}</div>{t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}</div> },
        { key: "type", header: "Type", hideBelow: "md", cell: (t) => t.type?.name ?? "—" },
        { key: "content", header: "Content", hideBelow: "sm", cell: (t) => `${t.current_version?.structure.milestones?.length ?? 0} milestones · ${t.current_version?.structure.tasks?.length ?? 0} tasks` },
        { key: "version", header: "Version", className: "tabular", cell: (t) => `v${t.current_version?.version_number ?? 1}` },
        { key: "used", header: "Projects", className: "tabular text-right", headerClassName: "text-right", cell: (t) => t._count?.projects ?? 0 },
        { key: "actions", header: <span className="sr-only">Actions</span>, className: "w-10", cell: (t) => <Button variant="ghost" size="icon-sm" aria-label={`Deactivate ${t.name}`} onClick={() => update.mutate({ id: t.id, is_active: false })}><Archive /></Button> },
    ];
    return (
        <div className="space-y-3">
            <div className="flex justify-end"><Button size="sm" onClick={() => { setName(""); setDescription(""); setTasks(""); setChecklist(""); setOpen(true); }}><Plus /> New template</Button></div>
            <DataTable columns={columns} data={templates.data} rowKey={(t) => t.id} loading={templates.isFetching} error={templates.error} onRetry={() => templates.refetch()} empty={{ icon: FileStack, title: "No templates" }} />
            <Dialog open={open} onOpenChange={(o) => !create.isPending && setOpen(o)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>New template</DialogTitle><DialogDescription>Versions are immutable: editing later publishes a new version and never changes existing projects.</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label htmlFor="tpl-name">Name</Label><Input id="tpl-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Mobile app (12 weeks)" /></div>
                            <div className="space-y-1.5">
                                <Label>Type</Label>
                                <Select value={typeId} onValueChange={setTypeId}>
                                    <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="__none">No type</SelectItem>{types.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5"><Label htmlFor="tpl-desc">Description</Label><Input id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label htmlFor="tpl-ms">Milestones (one per line: name | days from start)</Label><Textarea id="tpl-ms" rows={4} value={milestones} onChange={(e) => setMilestones(e.target.value)} /></div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label htmlFor="tpl-tasks">Starter tasks (one per line)</Label><Textarea id="tpl-tasks" rows={4} value={tasks} onChange={(e) => setTasks(e.target.value)} /></div>
                            <div className="space-y-1.5"><Label htmlFor="tpl-check">Launch checklist (one per line)</Label><Textarea id="tpl-check" rows={4} value={checklist} onChange={(e) => setChecklist(e.target.value)} /></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending}>Cancel</Button>
                        <Button
                            disabled={!name.trim()}
                            loading={create.isPending}
                            onClick={() => create.mutate(
                                { name: name.trim(), description: description || undefined, type_id: typeId !== "__none" ? typeId : undefined, structure: parseStructure(milestones, tasks, checklist) },
                                { onSuccess: () => setOpen(false) },
                            )}
                        >
                            Create template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
