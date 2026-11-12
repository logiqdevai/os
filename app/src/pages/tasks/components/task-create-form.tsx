import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Tag } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useCreateTask, useTaskLabels, useWorkflows } from "@/features/tasks/hooks/use-tasks";
import { taskFormSchema, type TaskFormValues } from "@/features/tasks/validation-schemas/tasks.schema";
import type { TaskDetail } from "@/features/tasks/interfaces/tasks.interfaces";
import { AssigneePicker, LabelsPicker, PriorityPicker, ProjectPicker, StatusPicker } from "./task-pickers";
import { LabelChip } from "./task-badges";

const NO_TEAM = "__none";

export interface TaskCreateDefaults {
    team_id?: string | null;
    project_id?: string | null;
    project_name?: string | null;
    parent_task_id?: string | null;
    status_id?: string | null;
    cycle_id?: string | null;
    milestone_id?: string | null;
}

interface TaskCreateFormProps {
    defaults?: TaskCreateDefaults;
    onCreated?: (task: TaskDetail) => void;
    onCancel?: () => void;
    /** Show the "create more" toggle (dialog). */
    allowCreateMore?: boolean;
    autoFocus?: boolean;
}

/**
 * Task create form (quick create dialog and /tasks/new). Ctrl/⌘+Enter submits.
 * @perm tasks.tasks.create · assigning someone else needs tasks.tasks.assign
 * @api POST /tasks
 */
export function TaskCreateForm({ defaults, onCreated, onCancel, allowCreateMore, autoFocus = true }: TaskCreateFormProps) {
    const session = useSessionData();
    const me = session?.active_organization?.membership_id ?? null;
    const canAssign = usePermission("tasks.tasks.assign");
    const workflows = useWorkflows();
    const labels = useTaskLabels();
    const create = useCreateTask();
    const [createMore, setCreateMore] = useState(false);

    const firstTeam = workflows.data?.find((w) => w.team?.task_key)?.team?.id ?? NO_TEAM;
    const initial = useMemo<TaskFormValues>(() => ({
        title: "", description: "", team_id: defaults?.team_id ?? firstTeam, status_id: defaults?.status_id ?? undefined, priority: "NONE",
        assignee_membership_id: null, project_id: defaults?.project_id ?? null, due_date: "", estimate_points: "", label_ids: [],
    }), [defaults?.team_id, defaults?.status_id, defaults?.project_id, firstTeam]);
    const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: initial });
    useEffect(() => { form.reset(initial); }, [initial, form]);

    const teamId = form.watch("team_id");
    const workflow = workflows.data?.find((w) => (w.team?.id ?? NO_TEAM) === teamId);
    const statuses = useMemo(() => workflow?.statuses ?? [], [workflow]);
    const statusId = form.watch("status_id");
    useEffect(() => {
        if (statuses.length && !statuses.some((s) => s.id === statusId)) {
            form.setValue("status_id", (statuses.find((s) => s.is_default) ?? statuses.find((s) => s.category === "TODO") ?? statuses[0]).id);
        }
    }, [statuses, statusId, form]);

    const submit = form.handleSubmit((v) => {
        create.mutate(
            {
                title: v.title,
                description: v.description || undefined,
                team_id: v.team_id !== NO_TEAM ? v.team_id : undefined,
                status_id: v.status_id,
                priority: v.priority,
                assignee_membership_id: v.assignee_membership_id,
                project_id: v.project_id ?? undefined,
                parent_task_id: defaults?.parent_task_id ?? undefined,
                cycle_id: defaults?.cycle_id ?? undefined,
                milestone_id: defaults?.milestone_id ?? undefined,
                due_date: v.due_date || undefined,
                estimate_points: v.estimate_points ? Number(v.estimate_points) : undefined,
                label_ids: v.label_ids.length ? v.label_ids : undefined,
            },
            {
                onSuccess: (task) => {
                    if (createMore) form.reset({ ...v, title: "", description: "" });
                    else onCreated?.(task);
                },
            },
        );
    });

    const selectedLabels = (labels.data ?? []).filter((l) => form.watch("label_ids").includes(l.id));

    return (
        <Form {...form}>
            <form onSubmit={submit} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="sr-only">Title</FormLabel>
                        <FormControl><Input autoFocus={autoFocus} className="h-10 border-0 bg-transparent px-0 text-base font-medium shadow-none focus-visible:ring-0" placeholder="Task title" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="sr-only">Description</FormLabel>
                        <FormControl><Textarea rows={4} placeholder="Add a description (Markdown)…" className="resize-y" {...field} /></FormControl>
                    </FormItem>
                )} />

                <div className="flex flex-wrap items-center gap-2">
                    <FormField control={form.control} name="team_id" render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-8 w-auto min-w-28" aria-label="Team"><SelectValue placeholder="Team" /></SelectTrigger>
                            <SelectContent>
                                {(workflows.data ?? []).map((w) => (
                                    <SelectItem key={w.team?.id ?? NO_TEAM} value={w.team?.id ?? NO_TEAM}>{w.team ? `${w.team.name}${w.team.task_key ? ` · ${w.team.task_key}` : ""}` : "No team"}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )} />
                    <FormField control={form.control} name="status_id" render={({ field }) => (
                        <StatusPicker className="w-auto min-w-32" statuses={statuses} value={field.value} onChange={(v) => field.onChange(v ?? undefined)} />
                    )} />
                    <FormField control={form.control} name="priority" render={({ field }) => (
                        <PriorityPicker className="w-auto min-w-32" value={field.value} onChange={field.onChange} />
                    )} />
                    <FormField control={form.control} name="assignee_membership_id" render={({ field }) => (
                        canAssign
                            ? <AssigneePicker className="w-auto min-w-36" value={field.value} onChange={field.onChange} />
                            : <Button type="button" variant="outline" className="h-8" onClick={() => field.onChange(field.value ? null : me)}>{field.value ? "Assigned to me" : "Assign to me"}</Button>
                    )} />
                    <FormField control={form.control} name="project_id" render={({ field }) => (
                        <ProjectPicker className="w-auto min-w-36" value={field.value} onChange={field.onChange} currentName={defaults?.project_name} />
                    )} />
                    <FormField control={form.control} name="label_ids" render={({ field }) => (
                        <LabelsPicker value={field.value} onChange={field.onChange} trigger={<Button type="button" variant="outline" className="h-8"><Tag /> {field.value.length ? `${field.value.length} labels` : "Labels"}</Button>} />
                    )} />
                    <FormField control={form.control} name="due_date" render={({ field }) => (
                        <label className="relative inline-flex items-center">
                            <CalendarDays className="pointer-events-none absolute left-2 size-4 text-ash" />
                            <Input type="date" aria-label="Due date" className="h-8 w-40 pl-8" {...field} />
                        </label>
                    )} />
                    <FormField control={form.control} name="estimate_points" render={({ field }) => (
                        <Input aria-label="Estimate (points)" placeholder="Points" inputMode="decimal" className="h-8 w-20" {...field} />
                    )} />
                </div>
                {selectedLabels.length > 0 && <div className="flex flex-wrap gap-1">{selectedLabels.map((l) => <LabelChip key={l.id} label={l} />)}</div>}

                <div className="flex flex-col-reverse gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                    {allowCreateMore ? (
                        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                            <Switch checked={createMore} onCheckedChange={setCreateMore} aria-label="Create more" /> Create more
                        </label>
                    ) : <span />}
                    <div className="flex gap-2 sm:justify-end">
                        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={create.isPending}>Cancel</Button>}
                        <Button type="submit" loading={create.isPending}>Create task <kbd className="ml-1 hidden rounded border border-border px-1 text-[10px] text-muted-foreground sm:inline">Ctrl ↵</kbd></Button>
                    </div>
                </div>
            </form>
        </Form>
    );
}
