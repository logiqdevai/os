import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Shield, Star, Trash2, UsersRound } from "lucide-react";
import { Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermissions } from "@/hooks/use-permission";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useAddMemberBranch, useAssignRole, useRemoveMemberBranch, useRemoveRole } from "@/features/admin/members/hooks/use-members";
import { useAddTeamMember, useRemoveTeamMember, useTeams } from "@/features/admin/teams/hooks/use-teams";
import type { MemberDetail } from "@/features/admin/members/interfaces/members.interfaces";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { AssignRoleDialog } from "../../../components/assign-role-dialog";
import { useScopeLabel } from "../../../components/use-scope-label";

type Removal = { kind: "role"; id: string; label: string } | { kind: "branch"; id: string; label: string } | { kind: "team"; id: string; label: string } | null;

const errorToast = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: getApiErrorMessage(e) });

/** Roles (scope + expiry), branches and teams of one member. */
export function MemberAccessTab({ member }: { member: MemberDetail }) {
    const p = usePermissions();
    const session = useSessionData();
    const scopeLabel = useScopeLabel();
    const teams = useTeams({ limit: 200 });
    const assign = useAssignRole();
    const removeRole = useRemoveRole();
    const addBranch = useAddMemberBranch();
    const removeBranch = useRemoveMemberBranch();
    const addTeam = useAddTeamMember();
    const removeTeam = useRemoveTeamMember();
    const [assignOpen, setAssignOpen] = useState(false);
    const [removal, setRemoval] = useState<Removal>(null);
    const inactive = member.status === "DEACTIVATED";

    const canRoles = p.can("users.roles.assign") && !inactive;
    const canBranches = p.can("organizations.branches.members.manage") && !inactive;
    const canTeams = p.can("organizations.teams.members.manage") && !inactive;
    const freeBranches = (session?.branches ?? []).filter((b) => !member.branches.some((mb) => mb.branch_id === b.id));
    const freeTeams = (teams.data?.data ?? []).filter((t) => !member.teams.some((mt) => mt.team_id === t.id));

    const confirmRemoval = () => {
        if (!removal) return;
        const done = { onSuccess: () => { toast({ title: "Removed" }); setRemoval(null); }, onError: errorToast("Could not remove") };
        if (removal.kind === "role") removeRole.mutate({ id: member.id, assignment_id: removal.id }, done);
        if (removal.kind === "branch") removeBranch.mutate({ id: member.id, branch_id: removal.id }, done);
        if (removal.kind === "team") removeTeam.mutate({ id: removal.id, membership_id: member.id }, done);
    };

    return (
        <div className="space-y-6">
            <Section
                title="Roles"
                description="What this member may do, and where. Temporary roles end automatically."
                actions={canRoles && <Button size="sm" onClick={() => setAssignOpen(true)}><Plus /> Assign role</Button>}
            >
                <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                    {member.role_assignments.length === 0 && <EmptyState compact icon={Shield} title="No roles" description="Without a role this member cannot do anything in the organization." />}
                    {member.role_assignments.map((a) => {
                        const expired = !!a.valid_until && new Date(a.valid_until) < new Date();
                        return (
                            <div key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link to={`/admin/roles/${a.role.id}`} className="font-medium text-foreground hover:underline">{a.role.name}</Link>
                                        {a.role.organization_id === null ? <Badge variant="secondary">Template</Badge> : <Badge variant="info">Custom</Badge>}
                                        {a.valid_until && <Badge variant={expired ? "neutral" : "warning"}>{expired ? "Ended" : "Until"} {formatDate(a.valid_until)}</Badge>}
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">{scopeLabel(a.scope_type, a.scope_id)}{a.reason ? ` · ${a.reason}` : ""}</div>
                                </div>
                                {canRoles && (
                                    <Button variant="ghost" size="sm" className="self-start sm:self-auto" onClick={() => setRemoval({ kind: "role", id: a.id, label: a.role.name })}>
                                        <Trash2 /> Remove
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Section>

            <div className="grid gap-6 lg:grid-cols-2">
                <Section
                    title="Branches"
                    actions={canBranches && freeBranches.length > 0 && (
                        <Select value="" onValueChange={(v) => addBranch.mutate({ id: member.id, branch_id: v, is_primary: member.branches.length === 0 }, { onSuccess: () => toast({ title: "Added to branch" }), onError: errorToast("Could not add to branch") })}>
                            <SelectTrigger className="h-7 w-40" aria-label="Add to branch"><SelectValue placeholder="Add to branch" /></SelectTrigger>
                            <SelectContent>{freeBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                >
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {member.branches.length === 0 && <EmptyState compact icon={Building2} title="Not in a branch" />}
                        {member.branches.map((b) => (
                            <div key={b.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                                <div className="flex min-w-0 items-center gap-2">
                                    <Link to={`/admin/branches/${b.branch.id}`} className="truncate text-[13px] text-foreground hover:underline">{b.branch.name}</Link>
                                    {b.is_primary && <Badge variant="info"><Star className="size-3" /> Primary</Badge>}
                                    {b.include_children && <Badge variant="secondary">+ children</Badge>}
                                </div>
                                {canBranches && (
                                    <div className="flex flex-none items-center">
                                        {!b.is_primary && (
                                            <Button variant="ghost" size="sm" onClick={() => addBranch.mutate({ id: member.id, branch_id: b.branch_id, is_primary: true }, { onSuccess: () => toast({ title: "Primary branch changed" }), onError: errorToast("Could not change") })}>Make primary</Button>
                                        )}
                                        <Button variant="ghost" size="icon-sm" aria-label={`Remove from ${b.branch.name}`} onClick={() => setRemoval({ kind: "branch", id: b.branch_id, label: b.branch.name })}><Trash2 /></Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>

                <Section
                    title="Teams"
                    actions={canTeams && freeTeams.length > 0 && (
                        <Select value="" onValueChange={(v) => addTeam.mutate({ id: v, membership_id: member.id }, { onSuccess: () => toast({ title: "Added to team" }), onError: errorToast("Could not add to team") })}>
                            <SelectTrigger className="h-7 w-40" aria-label="Add to team"><SelectValue placeholder="Add to team" /></SelectTrigger>
                            <SelectContent>{freeTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                >
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {member.teams.length === 0 && <EmptyState compact icon={UsersRound} title="Not in a team" />}
                        {member.teams.map((t) => (
                            <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                                <div className="flex min-w-0 items-center gap-2">
                                    <Link to={`/admin/teams/${t.team.id}`} className="truncate text-[13px] text-foreground hover:underline">{t.team.name}</Link>
                                    {t.is_lead && <Badge variant="violet">Lead</Badge>}
                                    {t.team_role && <span className="text-xs text-muted-foreground">{t.team_role}</span>}
                                </div>
                                {canTeams && <Button variant="ghost" size="icon-sm" aria-label={`Remove from ${t.team.name}`} onClick={() => setRemoval({ kind: "team", id: t.team_id, label: t.team.name })}><Trash2 /></Button>}
                            </div>
                        ))}
                    </div>
                </Section>
            </div>

            <AssignRoleDialog
                open={assignOpen}
                onOpenChange={setAssignOpen}
                title="Assign a role"
                pending={assign.isPending}
                onSubmit={(values) => assign.mutate({ id: member.id, ...values }, { onSuccess: () => { toast({ title: "Role assigned" }); setAssignOpen(false); }, onError: errorToast("Could not assign the role") })}
            />
            <ConfirmationDialog
                isOpen={!!removal}
                onClose={() => setRemoval(null)}
                title={removal?.kind === "role" ? `Remove the ${removal.label} role?` : `Remove from ${removal?.label}?`}
                description={removal?.kind === "role" ? "The member loses the permissions of this role right away." : "Access scoped to it stops right away."}
                confirmText="Remove"
                variant="destructive"
                isLoading={removeRole.isPending || removeBranch.isPending || removeTeam.isPending}
                onConfirm={confirmRemoval}
            />
        </div>
    );
}
