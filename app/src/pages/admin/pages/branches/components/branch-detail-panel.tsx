import { Link } from "react-router-dom";
import { Archive, Pencil, Plus, Star } from "lucide-react";
import { KeyValueList, Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { usePermission } from "@/hooks/use-permission";
import { useBranch } from "@/features/admin/branches/hooks/use-branches";
import { BranchKindFormOptions, BranchStatusFormOptions } from "@/config/constants/dropdowns/admin/access-form.options";
import { TeamKindFormOptions } from "@/config/constants/dropdowns/admin/team-kind-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDate } from "@/lib/format";
import { PersonCell } from "../../../components/person-cell";

interface BranchDetailPanelProps {
    id: string;
    onEdit: () => void;
    onArchive: () => void;
    onAddChild: () => void;
}

export function BranchDetailPanel({ id, onEdit, onArchive, onAddChild }: BranchDetailPanelProps) {
    const branch = useBranch(id);
    const canReadMembers = usePermission("users.members.read");
    if (branch.isPending) return <div className="rounded-lg border border-border bg-card"><ListSkeleton rows={6} /></div>;
    if (branch.error) return <div className="rounded-lg border border-border bg-card"><ErrorState error={branch.error} onRetry={() => branch.refetch()} /></div>;
    const b = branch.data;

    return (
        <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-lg font-medium text-foreground">{b.name}</h2>
                            {b.code && <Badge variant="secondary"><code>{b.code}</code></Badge>}
                            {b.is_headquarters && <Badge variant="violet"><Star className="size-3" /> Headquarters</Badge>}
                            <Badge variant={b.status === "ACTIVE" ? "success" : b.status === "ARCHIVED" ? "neutral" : "warning"}>{getDropdownOptionLabel(BranchStatusFormOptions, b.status)}</Badge>
                        </div>
                        <p className="text-[13px] text-muted-foreground">{getDropdownOptionLabel(BranchKindFormOptions, b.kind)}{b.parent ? ` · under ${b.parent.name}` : ""}</p>
                    </div>
                    <Can permission="organizations.branches.manage">
                        {!b.archived_at && (
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={onAddChild}><Plus /> Child branch</Button>
                                <Button size="sm" variant="outline" onClick={onEdit}><Pencil /> Edit</Button>
                                {!b.is_headquarters && <Button size="sm" variant="destructive" onClick={onArchive}><Archive /> Archive</Button>}
                            </div>
                        )}
                    </Can>
                </div>
                <KeyValueList className="mt-4" columns={3} items={[
                    { label: "Location", value: [b.city, b.region, b.country].filter(Boolean).join(", ") || null },
                    { label: "Timezone", value: b.timezone ?? "Organization default" },
                    { label: "Currency", value: b.currency ?? "Organization default" },
                    { label: "Email", value: b.email },
                    { label: "Phone", value: b.phone },
                    { label: "Created", value: formatDate(b.created_at) },
                ]} />
            </div>

            {b.children.length > 0 && (
                <Section title="Child branches">
                    <div className="flex flex-wrap gap-2">
                        {b.children.map((c) => <Link key={c.id} to={`/admin/branches/${c.id}`}><Badge variant="outline" className="h-7 px-2.5 text-[13px] hover:bg-accent">{c.name}</Badge></Link>)}
                    </div>
                </Section>
            )}

            <div className="grid gap-5 xl:grid-cols-2">
                <Section title={`Members (${b._count.memberships})`} description="Add members from their member page.">
                    <div className="max-h-80 divide-y divide-border-soft overflow-y-auto rounded-lg border border-border bg-card">
                        {b.memberships.length === 0 && <EmptyState compact title="No members in this branch" />}
                        {b.memberships.map((m) => (
                            <div key={m.id} className="flex items-center justify-between gap-2 px-4 py-2">
                                {canReadMembers ? <Link to={`/admin/members/${m.membership.id}`} className="min-w-0 hover:opacity-80"><PersonCell size="sm" user={m.membership.user} sub={m.membership.job_title} /></Link> : <PersonCell size="sm" user={m.membership.user} sub={m.membership.job_title} />}
                                {m.is_primary && <Badge variant="info">Primary</Badge>}
                            </div>
                        ))}
                    </div>
                </Section>
                <Section title={`Teams (${b.teams.length})`}>
                    <div className="max-h-80 divide-y divide-border-soft overflow-y-auto rounded-lg border border-border bg-card">
                        {b.teams.length === 0 && <EmptyState compact title="No teams limited to this branch" />}
                        {b.teams.map((t) => (
                            <Link key={t.id} to={`/admin/teams/${t.id}`} className="flex items-center justify-between gap-2 px-4 py-2 text-[13px] text-foreground hover:bg-border-soft">
                                <span className="truncate">{t.name}</span>
                                <Badge>{getDropdownOptionLabel(TeamKindFormOptions, t.kind)}</Badge>
                            </Link>
                        ))}
                    </div>
                </Section>
            </div>
        </div>
    );
}
