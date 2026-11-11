import type { ContactRole } from "@/features/crm/contacts/interfaces/contacts.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** CrmContact.roles (02 §3). */
export const ContactRoleFormOptions: DropdownOption<ContactRole>[] = [
    { id: "PRIMARY", label: "Primary" },
    { id: "DECISION_MAKER", label: "Decision maker" },
    { id: "TECHNICAL", label: "Technical" },
    { id: "BILLING", label: "Billing" },
    { id: "PROJECT_STAKEHOLDER", label: "Project stakeholder" },
    { id: "EXECUTIVE", label: "Executive" },
];

export const ContactRoleFilterOptions: DropdownOption<ContactRole | "all">[] = [{ id: "all", label: "All roles" }, ...ContactRoleFormOptions];
