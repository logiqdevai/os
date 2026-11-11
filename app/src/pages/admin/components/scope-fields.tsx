import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScopeTypePickerOptions, type ScopeType } from "@/config/constants/dropdowns/admin/scope-type-form.options";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useTeams } from "@/features/admin/teams/hooks/use-teams";
import { usePermission } from "@/hooks/use-permission";

interface ScopeFieldsProps {
    scopeType: ScopeType;
    scopeId: string | undefined;
    onChange: (scopeType: ScopeType, scopeId: string | undefined) => void;
    label?: string;
}

/** "Where does this apply?" — scope type plus the branch / team it targets. */
export function ScopeFields({ scopeType, scopeId, onChange, label = "Applies to" }: ScopeFieldsProps) {
    const session = useSessionData();
    const canReadTeams = usePermission("organizations.teams.read");
    const needsTeam = scopeType === "TEAM";
    const needsBranch = scopeType === "BRANCH" || scopeType === "BRANCH_HIERARCHY";
    const teams = useTeams({ limit: 200 });
    const teamRows = needsTeam && canReadTeams ? teams.data?.data ?? [] : [];

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
                <Label>{label}</Label>
                <Select value={scopeType} onValueChange={(v) => onChange(v as ScopeType, undefined)}>
                    <SelectTrigger aria-label={label}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ScopeTypePickerOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {(needsBranch || needsTeam) && (
                <div className="space-y-1.5">
                    <Label>{needsTeam ? "Team" : "Branch"}</Label>
                    <Select value={scopeId ?? ""} onValueChange={(v) => onChange(scopeType, v)}>
                        <SelectTrigger aria-label={needsTeam ? "Team" : "Branch"}>
                            <SelectValue placeholder={needsTeam ? "Pick a team" : "Pick a branch"} />
                        </SelectTrigger>
                        <SelectContent>
                            {needsBranch && session?.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                            {needsTeam && teamRows.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}

/** True when the scope is complete (organization, or a target picked). */
export const scopeComplete = (scopeType: ScopeType, scopeId: string | undefined) => scopeType === "ORGANIZATION" || !!scopeId;
