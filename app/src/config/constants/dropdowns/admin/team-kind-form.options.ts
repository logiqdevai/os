import type { TeamKind } from "@/features/admin/teams/interfaces/teams.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Canonical labels for Team.kind (01 §41). */
export const TeamKindFormOptions: DropdownOption<TeamKind>[] = [
    { id: "TEAM", label: "Team" },
    { id: "DEPARTMENT", label: "Department" },
    { id: "BUSINESS_UNIT", label: "Business unit" },
    { id: "PROJECT_TEAM", label: "Project team" },
];

export const TeamKindFilterOptions: DropdownOption<TeamKind | "all">[] = [{ id: "all", label: "All kinds" }, ...TeamKindFormOptions];
