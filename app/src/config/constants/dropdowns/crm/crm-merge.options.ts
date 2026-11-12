import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Duplicate match keys (api `CrmDuplicateRule.match_keys`). */
export const DuplicateMatchOptions: DropdownOption[] = [
    { id: "email", label: "Email" },
    { id: "phone", label: "Phone" },
    { id: "domain", label: "Website domain" },
    { id: "vat", label: "VAT number" },
    { id: "tax_id", label: "Tax id" },
    { id: "registration_number", label: "Registration number" },
    { id: "name", label: "Name" },
];

/** Labels of the fields compared on the merge screen. */
export const MergeFieldOptions: DropdownOption[] = [
    { id: "name", label: "Name" }, { id: "legal_name", label: "Legal name" }, { id: "type", label: "Type" }, { id: "lifecycle_stage_id", label: "Lifecycle stage" },
    { id: "industry", label: "Industry" }, { id: "company_size", label: "Company size" }, { id: "number_of_employees", label: "Employees" },
    { id: "annual_revenue", label: "Annual revenue" }, { id: "currency", label: "Currency" }, { id: "website", label: "Website" }, { id: "email", label: "Email" },
    { id: "phone", label: "Phone" }, { id: "mobile", label: "Mobile" }, { id: "country", label: "Country" }, { id: "address", label: "Address" },
    { id: "tax_id", label: "Tax id" }, { id: "vat_number", label: "VAT number" }, { id: "registration_number", label: "Registration number" },
    { id: "description", label: "Description" }, { id: "lead_source_id", label: "Source" }, { id: "owner_membership_id", label: "Owner" },
    { id: "account_manager_membership_id", label: "Account manager" }, { id: "team_id", label: "Team" }, { id: "parent_company_id", label: "Parent company" },
    { id: "first_name", label: "First name" }, { id: "last_name", label: "Last name" }, { id: "job_title", label: "Job title" }, { id: "department", label: "Department" },
    { id: "linkedin_url", label: "LinkedIn" }, { id: "company_id", label: "Company" }, { id: "timezone", label: "Time zone" }, { id: "language", label: "Language" },
    { id: "company_name", label: "Company name" }, { id: "contact_name", label: "Contact name" }, { id: "estimated_company_size", label: "Company size" },
    { id: "estimated_value", label: "Estimated value" }, { id: "status_id", label: "Status" }, { id: "contact_id", label: "Contact" }, { id: "manual_score", label: "Manual score" },
    { id: "primary_contact_id", label: "Primary contact" }, { id: "value", label: "Value" }, { id: "expected_close_date", label: "Expected close" },
    { id: "next_step", label: "Next step" }, { id: "deal_type", label: "Deal type" }, { id: "competitor", label: "Competitor" },
];
