import { useState } from "react";
import { Lock } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useOrganizationModules, useSetModule } from "@/features/admin/organization/hooks/use-organization";
import type { OrganizationModuleRow } from "@/features/admin/organization/interfaces/organization.interfaces";
import { ModuleKeyOptions, getModuleKeyDescription } from "@/config/constants/dropdowns/admin/module-key.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Module access — /admin/modules
 * @perm organizations.modules.manage (per-member overrides live on the member page)
 * @api GET /organization/modules · PUT /organization/modules/:module
 */
export default function ModulesPage() {
    const modules = useOrganizationModules();
    const setModule = useSetModule();
    const [disabling, setDisabling] = useState<OrganizationModuleRow | null>(null);

    const toggle = (m: OrganizationModuleRow, enabled: boolean) =>
        setModule.mutate({ module: m.module, enabled }, {
            onSuccess: () => { toast({ title: `${getDropdownOptionLabel(ModuleKeyOptions, m.module)} ${enabled ? "enabled" : "disabled"}` }); setDisabling(null); },
            onError: (e) => toast({ variant: "destructive", title: "Could not update", description: getApiErrorMessage(e) }),
        });

    return (
        <Page width="narrow">
            <PageHeader title="Module access" description="Turn whole products on or off for everyone. Disabled modules disappear from navigation, the API and agent tools." />
            <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                {modules.isPending && <ListSkeleton rows={8} />}
                {modules.error && <ErrorState error={modules.error} onRetry={() => modules.refetch()} />}
                {modules.data?.map((m) => (
                    <div key={m.module} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">
                                {getDropdownOptionLabel(ModuleKeyOptions, m.module)}
                                {m.locked && <Badge variant="secondary"><Lock className="size-3" /> Always on</Badge>}
                                {m.members_blocked > 0 && <Badge variant="warning">Blocked for {m.members_blocked} member{m.members_blocked > 1 ? "s" : ""}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">{getModuleKeyDescription(m.module)}</p>
                        </div>
                        <Switch
                            checked={m.enabled}
                            disabled={m.locked || setModule.isPending}
                            aria-label={`${getDropdownOptionLabel(ModuleKeyOptions, m.module)} enabled`}
                            onCheckedChange={(v) => (v ? toggle(m, true) : setDisabling(m))}
                        />
                    </div>
                ))}
            </div>
            <ConfirmationDialog
                isOpen={!!disabling}
                onClose={() => setDisabling(null)}
                title={`Disable ${disabling ? getDropdownOptionLabel(ModuleKeyOptions, disabling.module) : ""}?`}
                description="Nobody can open it or use its API and agent tools until you turn it back on. Its data is kept."
                confirmText="Disable"
                variant="destructive"
                isLoading={setModule.isPending}
                onConfirm={() => disabling && toggle(disabling, false)}
            />
        </Page>
    );
}
