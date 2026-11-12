import type { CustomFieldEntity, CustomFieldType } from "@/features/crm/custom-fields/interfaces/custom-fields.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Custom field types (Prisma `CustomFieldType`, the subset the CRM renders). */
export const CustomFieldTypeOptions: DropdownOption<CustomFieldType>[] = [
    { id: "TEXT", label: "Text" },
    { id: "LONG_TEXT", label: "Long text" },
    { id: "NUMBER", label: "Number" },
    { id: "DECIMAL", label: "Decimal" },
    { id: "CURRENCY", label: "Currency" },
    { id: "PERCENTAGE", label: "Percentage" },
    { id: "BOOLEAN", label: "Yes / no" },
    { id: "DATE", label: "Date" },
    { id: "DATETIME", label: "Date & time" },
    { id: "EMAIL", label: "Email" },
    { id: "PHONE", label: "Phone" },
    { id: "URL", label: "Link (URL)" },
    { id: "DROPDOWN", label: "Select (one)" },
    { id: "RADIO", label: "Radio (one)" },
    { id: "MULTI_SELECT", label: "Multi-select" },
    { id: "USER", label: "Team member" },
];

/** Record types with custom fields (Prisma `RecordEntityType`). */
export const CustomFieldEntityOptions: DropdownOption<CustomFieldEntity>[] = [
    { id: "CRM_COMPANY", label: "Companies" },
    { id: "CRM_CONTACT", label: "Contacts" },
    { id: "CRM_LEAD", label: "Leads" },
    { id: "CRM_DEAL", label: "Deals" },
];

/** Singular labels for record types (CRM_COMPANY → Company). */
export const CrmEntitySingularOptions: DropdownOption<CustomFieldEntity>[] = [
    { id: "CRM_COMPANY", label: "Company" },
    { id: "CRM_CONTACT", label: "Contact" },
    { id: "CRM_LEAD", label: "Lead" },
    { id: "CRM_DEAL", label: "Deal" },
];
