import { useState } from "react";
import { Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MemberAvatar } from "@/components/ui/member-avatar";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/hooks/use-permission";
import { useAddProjectMember, useRemoveProjectMember } from "@/features/projects/hooks/use-projects";
import type { ProjectDetail, ProjectMember } from "@/features/projects/interfaces/projects.interfaces";
import { formatDate, personName } from "@/lib/format";
import { PersonPicker } from "../../../components/project-pickers";

/** Project members (scope: members see the project). @perm projects.members.manage or projects.projects.manage_members */
export function MembersTab({ project }: { project: ProjectDetail }) {
    const p = usePermissions();
    const canManage = p.canAny("projects.members.manage", "projects.projects.manage_members");
    const add = useAddProjectMember();
    const remove = useRemoveProjectMember();
    const [adding, setAdding] = useState(false);
    const [person, setPerson] = useState<string | null>(null);
    const [role, setRole] = useState("");
    const [allocation, setAllocation] = useState("");
    const [removing, setRemoving] = useState<ProjectMember | null>(null);

    const columns: DataTableColumn<ProjectMember>[] = [
        { key: "person", header: "Member", cell: (m) => <MemberAvatar person={m.membership.user} showName /> },
        { key: "role", header: "Role", cell: (m) => m.role_label ?? m.role?.name ?? <span className="text-ash">—</span>, hideBelow: "sm" },
        { key: "alloc", header: "Allocation", className: "tabular", hideBelow: "md", cell: (m) => (m.allocation_percent !== null ? `${m.allocation_percent}%` : "—") },
        { key: "joined", header: "Joined", hideBelow: "lg", cell: (m) => formatDate(m.joined_at) },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (m) => canManage && m.membership_id !== project.owner_membership_id && (
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${personName(m.membership.user)}`} onClick={() => setRemoving(m)}><Trash2 /></Button>
            ),
        },
    ];

    return (
        <Section
            title="Members"
            description="People on this project. Members can see it even without organization-wide access."
            actions={canManage && <Button size="sm" onClick={() => { setPerson(null); setRole(""); setAllocation(""); setAdding(true); }}><UserPlus /> Add member</Button>}
        >
            <DataTable columns={columns} data={project.members} rowKey={(m) => m.id} empty={{ icon: Users, title: "No members yet" }} />
            <Dialog open={adding} onOpenChange={(o) => !add.isPending && setAdding(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add member</DialogTitle>
                        <DialogDescription>{project.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5"><Label>Person</Label><PersonPicker value={person} onChange={setPerson} /></div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label htmlFor="pm-role">Role on the project</Label><Input id="pm-role" placeholder="Developer" value={role} onChange={(e) => setRole(e.target.value)} /></div>
                            <div className="space-y-1.5"><Label htmlFor="pm-alloc">Allocation %</Label><Input id="pm-alloc" inputMode="numeric" placeholder="50" value={allocation} onChange={(e) => setAllocation(e.target.value.replace(/\D/g, "").slice(0, 3))} /></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAdding(false)} disabled={add.isPending}>Cancel</Button>
                        <Button
                            disabled={!person}
                            loading={add.isPending}
                            onClick={() => person && add.mutate(
                                { id: project.id, membership_id: person, role_label: role || undefined, allocation_percent: allocation ? Math.min(100, Number(allocation)) : undefined },
                                { onSuccess: () => setAdding(false) },
                            )}
                        >
                            Add member
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog
                isOpen={!!removing}
                onClose={() => setRemoving(null)}
                title={`Remove ${removing ? personName(removing.membership.user) : ""}?`}
                description="They keep their tasks but lose access that came only from this membership."
                confirmText="Remove"
                variant="destructive"
                isLoading={remove.isPending}
                onConfirm={() => removing && remove.mutate({ id: project.id, membership_id: removing.membership_id }, { onSuccess: () => setRemoving(null) })}
            />
        </Section>
    );
}
