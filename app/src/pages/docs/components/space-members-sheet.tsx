import { useMemo, useState } from "react";
import { Building2, Shield, Trash2, User, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EntityPicker } from "@/components/ui/entity-picker";
import { personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiPermissionLevelFormOptions, WikiPrincipalTypeFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useDocsDirectory, useRemoveSpaceMember, useSetSpaceMember } from "@/features/docs/hooks/use-docs";
import type { WikiPermissionLevel, WikiPrincipalType, WikiSpaceDetail } from "@/features/docs/interfaces/docs.interfaces";

const ADDABLE: WikiPrincipalType[] = ["MEMBERSHIP", "TEAM", "BRANCH"];
const ICON: Record<string, typeof User> = { MEMBERSHIP: User, TEAM: Users, DEPARTMENT: Users, BRANCH: Building2, ROLE: Shield };

/**
 * Space members & access (Notion "teamspace" members): people AND groups (teams, branches, roles) with an access level.
 * Every change applies at once. A team grants access to everyone in it, including people who join later.
 * @perm read: space VIEW · change: MANAGE on the space (server-checked)
 * @api GET /docs/spaces/:id (members) · PUT /docs/spaces/:id/members · DELETE /docs/spaces/:id/members/:memberId
 * @audit wiki_space.member_set · wiki_space.member_removed
 */
export function SpaceMembersSheet({ space, open, onOpenChange, canManage }: { space: WikiSpaceDetail; open: boolean; onOpenChange: (o: boolean) => void; canManage: boolean }) {
    const directory = useDocsDirectory(open && canManage);
    const set = useSetSpaceMember();
    const remove = useRemoveSpaceMember();
    const [type, setType] = useState<WikiPrincipalType>("TEAM");
    const [level, setLevel] = useState<WikiPermissionLevel>("EDIT");

    const candidates = useMemo(() => {
        const d = directory.data;
        if (!d) return [];
        const taken = new Set(space.members.filter((m) => m.principal_type === type).map((m) => m.principal_id));
        const list = type === "MEMBERSHIP"
            ? d.members.map((m) => ({ id: m.id, label: personName(m.user), keywords: m.user.email }))
            : type === "BRANCH" ? d.branches.map((b) => ({ id: b.id, label: b.name })) : d.teams.map((t) => ({ id: t.id, label: t.name }));
        return list.filter((x) => !taken.has(x.id));
    }, [directory.data, space.members, type]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>Members of {space.name}</SheetTitle>
                    <SheetDescription>{space.is_private ? "Private space — only the people and groups below (and Docs managers) can open it." : "Everyone can read this space; the access below raises it for specific people and groups."}</SheetDescription>
                </SheetHeader>

                <div className="mt-5 space-y-5">
                    {canManage && (
                        <div className="space-y-1.5">
                            <Label>Add people or a group</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Select value={type} onValueChange={(v) => setType(v as WikiPrincipalType)}>
                                    <SelectTrigger className="sm:w-32" aria-label="Type to add"><SelectValue /></SelectTrigger>
                                    <SelectContent>{WikiPrincipalTypeFormOptions.filter((o) => ADDABLE.includes(o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.id === "TEAM" ? "Team (group)" : o.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={level} onValueChange={(v) => setLevel(v as WikiPermissionLevel)}>
                                    <SelectTrigger className="sm:w-32" aria-label="Access level"><SelectValue /></SelectTrigger>
                                    <SelectContent>{WikiPermissionLevelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <EntityPicker
                                    items={candidates}
                                    value={null}
                                    onChange={(pid) => { if (pid) set.mutate({ id: space.id, principal_type: type, principal_id: pid, level }); }}
                                    placeholder={directory.isPending ? "Loading…" : `Choose a ${type === "MEMBERSHIP" ? "person" : type === "TEAM" ? "team" : "branch"}`}
                                    searchPlaceholder="Search…"
                                    loading={directory.isPending}
                                    className="h-9"
                                />
                            </div>
                            {directory.isError && <p className="text-xs text-danger">The directory could not be loaded.</p>}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>{space.members.length} with access</Label>
                        {space.members.length === 0 ? (
                            <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No one has been added yet.</p>
                        ) : (
                            <ul className="divide-y divide-border rounded-md border border-border">
                                {space.members.map((m) => {
                                    const Icon = ICON[m.principal_type] ?? User;
                                    return (
                                        <li key={m.id} className="flex flex-wrap items-center gap-2 p-2">
                                            <span className="flex size-8 flex-none items-center justify-center rounded-full bg-secondary text-muted-foreground"><Icon className="size-4" /></span>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[13px] text-foreground">{m.membership ? personName(m.membership.user) : m.principal_label}</div>
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {getDropdownOptionLabel(WikiPrincipalTypeFormOptions, m.principal_type)}
                                                    {m.member_count !== null && ` · ${m.member_count} ${m.member_count === 1 ? "person" : "people"}`}
                                                    {m.membership && ` · ${m.membership.user.email}`}
                                                </div>
                                            </div>
                                            <Select value={m.level} disabled={!canManage} onValueChange={(v) => set.mutate({ id: space.id, principal_type: m.principal_type, principal_id: m.principal_id, level: v as WikiPermissionLevel })}>
                                                <SelectTrigger className="h-8 w-32" aria-label={`Access for ${m.principal_label}`}><SelectValue /></SelectTrigger>
                                                <SelectContent>{WikiPermissionLevelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                            {canManage && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${m.principal_label}`} onClick={() => remove.mutate({ id: space.id, memberId: m.id })}><Trash2 /></Button>}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
