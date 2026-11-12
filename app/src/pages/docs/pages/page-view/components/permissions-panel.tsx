import { useEffect, useMemo, useState } from "react";
import { Lock, Trash2, Users } from "lucide-react";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiAccessModeOptions, WikiPermissionLevelFormOptions, WikiPrincipalTypeFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useDocsDirectory, usePagePermissions, useSetPagePermissions } from "@/features/docs/hooks/use-docs";
import type { WikiPageDetail, WikiPermissionLevel, WikiPrincipalType, WikiVisibility } from "@/features/docs/interfaces/docs.interfaces";

interface DraftGrant {
    principal_type: WikiPrincipalType;
    principal_id: string;
    principal_label: string;
    level: WikiPermissionLevel;
    inherit: boolean;
}

/** Principal types this panel can add (roles stay editable when they already exist on the page). */
const ADDABLE: WikiPrincipalType[] = ["MEMBERSHIP", "TEAM", "BRANCH"];

/**
 * Page permissions (15 §5, WikiPagePermission): who may view / comment / edit / manage this page.
 * @perm read the list: page VIEW · change: page MANAGE level (+ docs.pages.update), server-checked
 * @api GET /docs/pages/:id/permissions · PUT /docs/pages/:id/permissions (replaces visibility + grants)
 * @audit wiki_page.permissions_changed @states loading · error · read-only (not MANAGE) · empty grants
 */
export function PermissionsPanel({ page }: { page: WikiPageDetail }) {
    const perms = usePagePermissions(page.id);
    const save = useSetPagePermissions();
    const canManage = page.can.manage;
    const directory = useDocsDirectory(canManage);
    const [mode, setMode] = useState<"ORGANIZATION" | "RESTRICTED">("ORGANIZATION");
    const [restrictedAs, setRestrictedAs] = useState<WikiVisibility>("MEMBERS");
    const [grants, setGrants] = useState<DraftGrant[]>([]);
    const [addType, setAddType] = useState<WikiPrincipalType>("MEMBERSHIP");
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (!perms.data || dirty) return;
        setMode(perms.data.visibility === "ORGANIZATION" ? "ORGANIZATION" : "RESTRICTED");
        if (perms.data.visibility !== "ORGANIZATION") setRestrictedAs(perms.data.visibility);
        setGrants(perms.data.grants.map((g) => ({ principal_type: g.principal_type, principal_id: g.principal_id, principal_label: g.principal_label, level: g.level, inherit: g.inherit })));
    }, [perms.data, dirty]);

    const candidates = useMemo(() => {
        const d = directory.data;
        if (!d) return [];
        const taken = new Set(grants.filter((g) => g.principal_type === addType).map((g) => g.principal_id));
        const list = addType === "MEMBERSHIP"
            ? d.members.map((m) => ({ id: m.id, label: personName(m.user), keywords: m.user.email }))
            : addType === "BRANCH"
                ? d.branches.map((b) => ({ id: b.id, label: b.name }))
                : d.teams.map((t) => ({ id: t.id, label: t.name }));
        return list.filter((x) => !taken.has(x.id));
    }, [directory.data, grants, addType]);

    if (perms.isPending) return <ListSkeleton />;
    if (perms.error) return <ErrorState error={perms.error} onRetry={() => perms.refetch()} />;

    const change = (fn: (g: DraftGrant[]) => DraftGrant[]) => { setGrants(fn); setDirty(true); };
    const submit = () => {
        const visibility: WikiVisibility = mode === "ORGANIZATION" ? "ORGANIZATION" : restrictedAs;
        if (mode === "RESTRICTED" && !grants.length) {
            toast({ variant: "destructive", title: "Add at least one person or group", description: "Otherwise only you (the owner) and Docs managers can open a restricted page." });
            return;
        }
        save.mutate(
            { id: page.id, visibility, grants: grants.map(({ principal_label: _label, ...g }) => g) },
            {
                onSuccess: () => { setDirty(false); toast({ title: "Permissions saved" }); },
                onError: (e) => toast({ variant: "destructive", title: "Could not save permissions", description: getApiErrorMessage(e) }),
            },
        );
    };

    return (
        <div className="space-y-5">
            <SheetHeader>
                <SheetTitle>Permissions</SheetTitle>
                <SheetDescription>{page.title} · owners and Docs managers always keep access. Sub-pages inherit grants marked “Sub-pages”.</SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
                <Label>Who can open this page</Label>
                <Select value={mode} onValueChange={(v) => { setMode(v as typeof mode); setDirty(true); }} disabled={!canManage}>
                    <SelectTrigger aria-label="Who can open this page"><SelectValue /></SelectTrigger>
                    <SelectContent>{WikiAccessModeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {mode === "ORGANIZATION" ? <><Users className="size-3.5" /> Grants below raise access (e.g. let a team edit).</> : <><Lock className="size-3.5" /> Hidden from everyone else, including search and AI answers.</>}
                </p>
            </div>

            <div className="space-y-2">
                <Label>People and groups</Label>
                {!grants.length ? (
                    <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No grants yet.</p>
                ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {grants.map((g, i) => (
                            <li key={`${g.principal_type}:${g.principal_id}`} className="flex flex-wrap items-center gap-2 p-2">
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] text-foreground">{g.principal_label}</div>
                                    <div className="text-xs text-muted-foreground">{getDropdownOptionLabel(WikiPrincipalTypeFormOptions, g.principal_type)}</div>
                                </div>
                                <Select value={g.level} onValueChange={(v) => change((all) => all.map((x, idx) => (idx === i ? { ...x, level: v as WikiPermissionLevel } : x)))} disabled={!canManage}>
                                    <SelectTrigger className="h-8 w-36" aria-label={`Access for ${g.principal_label}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>{WikiPermissionLevelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Switch checked={g.inherit} disabled={!canManage} onCheckedChange={(v) => change((all) => all.map((x, idx) => (idx === i ? { ...x, inherit: v } : x)))} aria-label={`Sub-pages inherit access for ${g.principal_label}`} />
                                    Sub-pages
                                </label>
                                {canManage && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${g.principal_label}`} onClick={() => change((all) => all.filter((_, idx) => idx !== i))}><Trash2 /></Button>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {canManage ? (
                <>
                    <div className="space-y-1.5">
                        <Label>Add</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Select value={addType} onValueChange={(v) => setAddType(v as WikiPrincipalType)}>
                                <SelectTrigger className="sm:w-36" aria-label="Type to add"><SelectValue /></SelectTrigger>
                                <SelectContent>{WikiPrincipalTypeFormOptions.filter((o) => ADDABLE.includes(o.id)).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                            <EntityPicker
                                items={candidates}
                                value={null}
                                onChange={(pid) => {
                                    const hit = candidates.find((c) => c.id === pid);
                                    if (hit) change((all) => [...all, { principal_type: addType, principal_id: hit.id, principal_label: hit.label, level: "VIEW", inherit: true }]);
                                }}
                                placeholder={directory.isPending ? "Loading…" : `Choose a ${getDropdownOptionLabel(WikiPrincipalTypeFormOptions, addType).toLowerCase()}`}
                                searchPlaceholder="Search…"
                                loading={directory.isPending}
                                className="h-9"
                            />
                        </div>
                        {directory.isError && <p className="text-xs text-danger">The member directory could not be loaded.</p>}
                    </div>
                    <div className="flex justify-end gap-2 border-t border-border pt-3">
                        {dirty && <Button type="button" variant="ghost" onClick={() => setDirty(false)} disabled={save.isPending}>Reset</Button>}
                        <Button type="button" onClick={submit} loading={save.isPending} disabled={!dirty}>Save permissions</Button>
                    </div>
                </>
            ) : (
                <p className="text-xs text-muted-foreground">Only people who can manage this page can change its permissions.</p>
            )}
        </div>
    );
}
