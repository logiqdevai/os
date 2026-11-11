import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** ScopeType (01 §22, §50) — where a role assignment, grant, invitation or API key applies. */
export type ScopeType = "ORGANIZATION" | "BRANCH" | "BRANCH_HIERARCHY" | "TEAM" | "PROJECT" | "RESOURCE" | "CUSTOMER";

export const ScopeTypeFormOptions: DropdownOption<ScopeType>[] = [
    { id: "ORGANIZATION", label: "Whole organization" },
    { id: "BRANCH", label: "One branch" },
    { id: "BRANCH_HIERARCHY", label: "Branch and its children" },
    { id: "TEAM", label: "One team" },
    { id: "PROJECT", label: "One project" },
    { id: "CUSTOMER", label: "One customer" },
    { id: "RESOURCE", label: "One record" },
];

/** Scopes an admin can pick in forms without a project / customer picker. */
export const ScopeTypePickerOptions = ScopeTypeFormOptions.filter((o) => ["ORGANIZATION", "BRANCH", "BRANCH_HIERARCHY", "TEAM"].includes(o.id));
