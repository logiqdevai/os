import type { SavedViewVisibility } from "@/features/crm/saved-views/interfaces/saved-views.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Who sees a saved view (Prisma `SavedViewVisibility`). */
export const SavedViewVisibilityOptions: DropdownOption<SavedViewVisibility>[] = [
    { id: "PERSONAL", label: "Only me" },
    { id: "TEAM", label: "My team" },
    { id: "ORGANIZATION", label: "Everyone in the organization" },
];
