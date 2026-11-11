import type { CompanyType } from "@/features/crm/companies/interfaces/companies.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** CrmCompany.type (02 §2). */
export const CompanyTypeFormOptions: DropdownOption<CompanyType>[] = [
    { id: "PROSPECT", label: "Prospect" },
    { id: "CUSTOMER", label: "Customer" },
    { id: "PARTNER", label: "Partner" },
    { id: "VENDOR", label: "Vendor" },
    { id: "OTHER", label: "Other" },
];

export const CompanyTypeFilterOptions: DropdownOption<CompanyType | "all">[] = [{ id: "all", label: "All types" }, ...CompanyTypeFormOptions];
