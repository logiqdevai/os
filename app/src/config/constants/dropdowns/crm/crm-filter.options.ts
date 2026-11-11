import type { LeadState } from "@/features/crm/leads/interfaces/leads.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Owner filter shared by every CRM list (`owner` query param). */
export const OwnerFilterOptions: DropdownOption<"all" | "me" | "unassigned">[] = [
    { id: "all", label: "Any owner" },
    { id: "me", label: "Owned by me" },
    { id: "unassigned", label: "Unassigned" },
];

/** Leads list tabs (`state` query param). */
export const LeadStateFilterOptions: DropdownOption<LeadState>[] = [
    { id: "open", label: "Open" },
    { id: "converted", label: "Converted" },
    { id: "lost", label: "Lost" },
    { id: "all", label: "All" },
];

/** Archived toggle on lists. */
export const ArchivedFilterOptions: DropdownOption<"active" | "archived">[] = [
    { id: "active", label: "Active" },
    { id: "archived", label: "Archived" },
];
