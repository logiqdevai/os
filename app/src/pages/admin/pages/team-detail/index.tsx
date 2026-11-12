import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { KeyValueList, Page, PageHeader, Section } from "@/components/ui/page";
import { ErrorState, EmptyState, PageSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { useAddTeamMember, useRemoveTeamMember, useTeam } from "@/features/admin/teams/hooks/use-teams";
import type { TeamMemberRow } from "@/features/admin/teams/interfaces/teams.interfaces";
import { TeamKindFormOptions } from "@/config/constants/dropdowns/admin/team-kind-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate, personName } from "@/lib/format";
import { PersonCell } from "../../components/person-cell";
import { MemberPicker } from "../../components/member-picker";
import { TeamFormDialog } from "../teams/components/team-form-dialog";

/**
 * Team detail — /admin/teams/:id
 * @perm VIEW organizations.teams.read · edit organizations.teams.manage · members organizations.teams.members.manage
 * @api GET /teams/:id · PATCH /teams/:id · POST /teams/:id/members · DELETE /teams/:id/members/:membershipId
 */
export default function TeamDetailPage() {
    const { id } = useParams();
    const team = useTeam(id);
    const canMembers = usePermission("organizations.teams.members.manage");
    const canReadMembers = usePermission("users.members.read");
    const add = useAddTeamMember();
    const remove = useRemoveTeamMember();
    const [editOpen, setEditOpen] = useState(false);
    const [picked, setPicked] = useState<string | undefined>();
    const [removing, setRemoving] = useState<TeamMemberRow | null>(null);

    if (team.isPending) return <PageSkeleton />;
    if (team.error) return <Page><PageHeader title="Team" back={{ to: "/admin/teams", label: "Teams" }} /><ErrorState error={team.error} onRetry={() => team.refetch()} /></Page>;
    const t = team.data;

    const addMember = () =>
        picked &&
        add.mutate({ id: t.id, membership_id: picked }, {
            onSuccess: () => setPicked(undefined),
        });

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: "/admin/teams", label: "Teams" }}
                title={t.name}
                meta={<><Badge>{getDropdownOptionLabel(TeamKindFormOptions, t.kind)}</Badge>{t.task_key && <Badge variant="secondary"><code>{t.task_key}</code></Badge>}{t.archived_at && <Badge variant="warning">Archived</Badge>}</>}
                description={t.description ?? undefined}
                actions={<Can permission="organizations.teams.manage"><Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button></Can>}
            />
            <div className="grid gap-6 lg:grid-cols-3">
                <Section title="Details" className="lg:col-span-1">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <KeyValueList columns={1} items={[
                            { label: "Branch", value: t.branch ? <Link className="hover:underline" to={`/admin/branches/${t.branch.id}`}>{t.branch.name}</Link> : "Whole organization" },
                            { label: "Parent team", value: t.parent ? <Link className="hover:underline" to={`/admin/teams/${t.parent.id}`}>{t.parent.name}</Link> : null },
                            { label: "Task ids", value: t.task_key ? `${t.task_key}-123` : null },
                            { label: "Created", value: formatDate(t.created_at) },
                        ]} />
                    </div>
                </Section>
                <Section title={`Members (${t.members.length})`} className="lg:col-span-2">
                    {canMembers && canReadMembers && !t.archived_at && (
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <MemberPicker value={picked} onChange={(id) => setPicked(id)} exclude={t.members.map((m) => m.membership.id)} placeholder="Add a member…" className="sm:flex-1" />
                            <Button onClick={addMember} disabled={!picked} loading={add.isPending}><Plus /> Add</Button>
                        </div>
                    )}
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {t.members.length === 0 && <EmptyState compact icon={UsersRound} title="No members yet" description="Add members to scope roles and work to this team." />}
                        {t.members.map((m) => (
                            <div key={m.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                                {canReadMembers ? (
                                    <Link to={`/admin/members/${m.membership.id}`} className="min-w-0 hover:opacity-80">
                                        <PersonCell user={m.membership.user} sub={[m.membership.job_title, m.team_role].filter(Boolean).join(" · ") || m.membership.user.email} />
                                    </Link>
                                ) : (
                                    <PersonCell user={m.membership.user} sub={[m.membership.job_title, m.team_role].filter(Boolean).join(" · ") || m.membership.user.email} />
                                )}
                                <div className="flex flex-none items-center gap-2">
                                    {m.is_lead && <Badge variant="violet">Lead</Badge>}
                                    {canMembers && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${personName(m.membership.user)}`} onClick={() => setRemoving(m)}><Trash2 /></Button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            </div>
            <TeamFormDialog open={editOpen} onOpenChange={setEditOpen} team={t} />
            <ConfirmationDialog
                isOpen={!!removing}
                onClose={() => setRemoving(null)}
                title={`Remove ${removing ? personName(removing.membership.user) : ""} from ${t.name}?`}
                description="Roles scoped to this team stop applying to them."
                confirmText="Remove"
                variant="destructive"
                onConfirm={() => { if (removing) remove.mutate({ id: t.id, membership_id: removing.membership.id }); setRemoving(null); }}
            />
        </Page>
    );
}
