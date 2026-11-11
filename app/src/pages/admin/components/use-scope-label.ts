import { useCallback } from "react";
import { useSessionData } from "@/features/session/hooks/use-session";
import { useTeams } from "@/features/admin/teams/hooks/use-teams";
import { ScopeTypeFormOptions } from "@/config/constants/dropdowns/admin/scope-type-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { usePermission } from "@/hooks/use-permission";

/** "Whole organization", "Branch: Athens", "Team: Web team" — resolves scope ids to names the admin knows. */
export function useScopeLabel() {
    const session = useSessionData();
    const canTeams = usePermission("organizations.teams.read");
    const teams = useTeams({ limit: 200 });
    return useCallback(
        (scopeType: string, scopeId: string | null | undefined) => {
            if (scopeType === "ORGANIZATION" || !scopeId) return getDropdownOptionLabel(ScopeTypeFormOptions, scopeType);
            if (scopeType === "BRANCH" || scopeType === "BRANCH_HIERARCHY") {
                const b = session?.branches.find((x) => x.id === scopeId);
                return `${scopeType === "BRANCH" ? "Branch" : "Branch + children"}: ${b?.name ?? "unknown branch"}`;
            }
            if (scopeType === "TEAM") {
                const t = canTeams ? teams.data?.data.find((x) => x.id === scopeId) : undefined;
                return `Team: ${t?.name ?? "unknown team"}`;
            }
            return getDropdownOptionLabel(ScopeTypeFormOptions, scopeType);
        },
        [session, teams.data, canTeams]
    );
}
