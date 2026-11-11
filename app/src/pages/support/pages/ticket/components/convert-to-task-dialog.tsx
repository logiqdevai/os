import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EntityPicker } from "@/components/ui/entity-picker";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { personName } from "@/lib/format";
import { useAgents, useConvertTicketToTask } from "@/features/support/hooks/use-support";
import { useProjectLookup } from "@/features/projects/hooks/use-projects";
import type { TicketDetail } from "@/features/support/interfaces/support.interfaces";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ticket: TicketDetail;
}

/** Convert a ticket into a Task (13 §4). Needs support.tickets.convert_to_task and tasks.tasks.create. */
export function ConvertToTaskDialog({ open, onOpenChange, ticket }: Props) {
    const convert = useConvertTicketToTask();
    const canCreateTask = usePermission("tasks.tasks.create");
    const agents = useAgents(open);
    const [projectSearch, setProjectSearch] = useState("");
    const projects = useProjectLookup({ search: projectSearch || undefined, limit: 20, ...(ticket.company ? { company_id: ticket.company.id } : {}) }, open);
    const [title, setTitle] = useState(ticket.subject);
    const [projectId, setProjectId] = useState<string | null>(ticket.project?.id ?? null);
    const [assignee, setAssignee] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (open) {
            setTitle(ticket.subject);
            setProjectId(ticket.project?.id ?? null);
            setAssignee(ticket.assignee?.id ?? null);
            setVisible(false);
        }
    }, [open, ticket]);

    const submit = () =>
        convert.mutate(
            { id: ticket.id, title: title.trim() || undefined, project_id: projectId ?? undefined, team_id: ticket.team?.id, assignee_membership_id: assignee ?? undefined, customer_visible: visible },
            {
                onSuccess: (task) => {
                    toast({ title: `Task ${task.identifier} created`, description: "It stays linked to this ticket." });
                    onOpenChange(false);
                },
                onError: (e) => toast({ variant: "destructive", title: "Could not convert", description: getApiErrorMessage(e) }),
            },
        );

    const projectItems = (projects.data ?? []).map((p) => ({ id: p.id, label: p.name, hint: p.code ?? undefined }));
    if (ticket.project && !projectItems.some((p) => p.id === ticket.project?.id)) projectItems.unshift({ id: ticket.project.id, label: ticket.project.name, hint: ticket.project.code ?? undefined });

    return (
        <Dialog open={open} onOpenChange={(o) => !convert.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Convert to task</DialogTitle>
                    <DialogDescription>Creates a task for the team and links it to {ticket.reference}. The client keeps seeing the ticket status.</DialogDescription>
                </DialogHeader>
                {!canCreateTask ? (
                    <p className="text-[13px] text-muted-foreground">You also need permission to create tasks (tasks.tasks.create).</p>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="task-title">Title</Label>
                            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Project</Label>
                            <EntityPicker items={projectItems} value={projectId} onChange={setProjectId} onSearch={setProjectSearch} loading={projects.isFetching} noneLabel="No project" placeholder="No project" ariaLabel="Project" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Assignee</Label>
                            <EntityPicker items={(agents.data ?? []).map((a) => ({ id: a.id, label: personName(a.user) }))} value={assignee} onChange={setAssignee} noneLabel="Unassigned" placeholder="Unassigned" ariaLabel="Assignee" />
                        </div>
                        <label className="flex items-center justify-between gap-3 text-[13px]">
                            <span>
                                Visible to the client
                                <span className="block text-xs text-muted-foreground">Shows the task in the client portal project view.</span>
                            </span>
                            <Switch checked={visible} onCheckedChange={setVisible} aria-label="Visible to the client" />
                        </label>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={convert.isPending}>Cancel</Button>
                    <Button onClick={submit} loading={convert.isPending} disabled={!canCreateTask || !title.trim()}>Create task</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
