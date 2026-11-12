import { RotateCcw } from "lucide-react";
import { Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePermission } from "@/hooks/use-permission";
import { useResetModuleAccess, useSetModuleAccess } from "@/features/admin/members/hooks/use-members";
import type { MemberDetail } from "@/features/admin/members/interfaces/members.interfaces";
import { ModuleKeyOptions, getModuleKeyDescription } from "@/config/constants/dropdowns/admin/module-key.options";

/** Per-member module access (01 §56–57): blocks a module for this person even when the organization has it on. */
export function MemberModulesTab({ member }: { member: MemberDetail }) {
    const canManage = usePermission("users.members.manage");
    const setAccess = useSetModuleAccess();
    const reset = useResetModuleAccess();
    const pending = setAccess.isPending || reset.isPending;

    return (
        <Section title="Module access" description="Modules follow the organization setting unless you block one for this member. Roles still decide what they can do inside a module.">
            <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                {ModuleKeyOptions.map((mod) => {
                    const override = member.module_access.find((a) => a.module === mod.id);
                    const enabled = override ? override.enabled : true;
                    const locked = mod.id === "ADMINISTRATION" && member.is_owner;
                    return (
                        <div key={mod.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                                    {mod.label}
                                    {override && <Badge variant={override.enabled ? "info" : "warning"}>{override.enabled ? "Allowed for this member" : "Blocked for this member"}</Badge>}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">{getModuleKeyDescription(mod.id)}</div>
                            </div>
                            <div className="flex flex-none items-center gap-1">
                                {override && canManage && (
                                    <Button variant="ghost" size="icon-sm" aria-label={`Follow the organization setting for ${mod.label}`} disabled={pending}
                                        onClick={() => reset.mutate({ id: member.id, module: mod.id })}>
                                        <RotateCcw />
                                    </Button>
                                )}
                                <Switch
                                    checked={enabled}
                                    disabled={!canManage || locked || pending || member.status === "DEACTIVATED"}
                                    aria-label={`${mod.label} for this member`}
                                    onCheckedChange={(v) => setAccess.mutate({ id: member.id, module: mod.id, enabled: v })}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </Section>
    );
}
