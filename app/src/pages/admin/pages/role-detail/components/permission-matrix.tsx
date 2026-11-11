import { useMemo, useState } from "react";
import { Ban, ChevronDown, Lock, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { useCatalog } from "@/features/admin/permissions/hooks/use-permissions-admin";
import type { CatalogPermission } from "@/features/admin/permissions/interfaces/permissions.interfaces";
import type { PermissionEffect } from "@/features/admin/roles/interfaces/roles.interfaces";
import { ModuleKeyOptions } from "@/config/constants/dropdowns/admin/module-key.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";

interface PermissionMatrixProps {
    value: Map<string, PermissionEffect>;
    onChange: (next: Map<string, PermissionEffect>) => void;
    readOnly: boolean;
    /** Keys already in the saved role (kept even when the editor does not hold them). */
    original: Set<string>;
}

/**
 * Permission picker grouped by module. Allow = checkbox; Deny = ban toggle (deny always wins).
 * Keys the editor does not hold are locked (privilege escalation rule), unless the role already had them.
 */
export function PermissionMatrix({ value, onChange, readOnly, original }: PermissionMatrixProps) {
    const catalog = useCatalog();
    const [search, setSearch] = useState("");
    const [onlySelected, setOnlySelected] = useState(readOnly);

    const groups = useMemo(() => {
        const q = search.trim().toLowerCase();
        const map = new Map<string, CatalogPermission[]>();
        for (const p of catalog.data?.data ?? []) {
            if (q && !p.key.includes(q) && !(p.description ?? "").toLowerCase().includes(q)) continue;
            if (onlySelected && !value.has(p.key)) continue;
            const list = map.get(p.module) ?? [];
            list.push(p);
            map.set(p.module, list);
        }
        return [...map.entries()];
    }, [catalog.data, search, onlySelected, value]);

    if (catalog.isPending) return <ListSkeleton rows={8} />;
    if (catalog.error) return <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />;

    const locked = (p: CatalogPermission) => readOnly || (!p.held && !original.has(p.key));
    const set = (key: string, effect: PermissionEffect | null) => {
        const next = new Map(value);
        if (effect) next.set(key, effect);
        else next.delete(key);
        onChange(next);
    };
    const setModule = (perms: CatalogPermission[], on: boolean) => {
        const next = new Map(value);
        for (const p of perms) {
            if (locked(p)) continue;
            if (on) next.set(p.key, "ALLOW");
            else next.delete(p.key);
        }
        onChange(next);
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ash" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search permissions…" className="h-8 pl-8" aria-label="Search permissions" />
                </div>
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground sm:ml-auto">
                    <Switch checked={onlySelected} onCheckedChange={setOnlySelected} aria-label="Only selected" /> Only selected ({value.size})
                </label>
            </div>
            {groups.length === 0 && <p className="rounded-lg border border-border bg-card p-4 text-[13px] text-muted-foreground">No permissions match.</p>}
            {groups.map(([module, perms]) => {
                const selected = perms.filter((p) => value.get(p.key) === "ALLOW").length;
                const editable = perms.filter((p) => !locked(p));
                const all = editable.length > 0 && editable.every((p) => value.get(p.key) === "ALLOW");
                return (
                    <Collapsible key={module} defaultOpen={!!search || onlySelected || selected > 0} className="rounded-lg border border-border bg-card">
                        <div className="flex items-center gap-2 px-3 py-2">
                            {!readOnly && (
                                <Checkbox checked={all ? true : selected > 0 ? "indeterminate" : false} disabled={!editable.length} onCheckedChange={(c) => setModule(perms, c === true)} aria-label={`Allow everything in ${module}`} />
                            )}
                            <CollapsibleTrigger className="group flex flex-1 items-center gap-2 text-left">
                                <span className="text-[13px] font-medium text-foreground">{getDropdownOptionLabel(ModuleKeyOptions, module)}</span>
                                <span className="text-xs text-muted-foreground tabular">{selected}/{perms.length}</span>
                                <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                            <div className="divide-y divide-border-soft border-t border-border">
                                {perms.map((p) => {
                                    const effect = value.get(p.key);
                                    const isLocked = locked(p);
                                    return (
                                        <div key={p.key} className={cn("flex items-center gap-2 px-3 py-1.5", effect === "DENY" && "bg-danger-soft/40")}>
                                            <Checkbox checked={effect === "ALLOW"} disabled={isLocked || effect === "DENY"} onCheckedChange={(c) => set(p.key, c === true ? "ALLOW" : null)} aria-label={`Allow ${p.key}`} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <code className="truncate text-[12.5px] text-foreground">{p.key}</code>
                                                    {p.is_sensitive && <Badge variant="warning" className="h-4 px-1 text-[10.5px]">Sensitive</Badge>}
                                                    {effect === "DENY" && <Badge variant="danger" className="h-4 px-1 text-[10.5px]">Denied</Badge>}
                                                </div>
                                                {p.description && <div className="truncate text-xs text-muted-foreground">{p.description}</div>}
                                            </div>
                                            {isLocked && !readOnly ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Lock className="size-3.5 flex-none text-ash" aria-label="Locked" /></TooltipTrigger>
                                                    <TooltipContent>You can only grant permissions you hold yourself.</TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                !readOnly && (
                                                    <Button type="button" variant="ghost" size="icon-sm" aria-pressed={effect === "DENY"} aria-label={effect === "DENY" ? `Remove deny on ${p.key}` : `Deny ${p.key}`}
                                                        className={cn(effect === "DENY" && "text-danger")} onClick={() => set(p.key, effect === "DENY" ? null : "DENY")}>
                                                        <Ban />
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                );
            })}
        </div>
    );
}
