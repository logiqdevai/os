import type {
    AvailabilityStatus, DocumentCategory, DocumentStatus, EmploymentStatus, EmploymentType, EquipmentCondition, EquipmentType, HrNoteCategory, HrNoteVisibility, PayType,
    SeniorityLevel, TerminationKind, WorkLocation,
} from "@/features/people/employees/interfaces/employees.interfaces";
import type { BadgeVariant } from "@/components/ui/badge";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Canonical labels for module 10 employee enums (schema: Employee, EmployeeEquipment, EmployeeDocument, EmployeeHrNote). */
export const EmploymentStatusFormOptions: DropdownOption<EmploymentStatus>[] = [
    { id: "ONBOARDING", label: "Onboarding" },
    { id: "ACTIVE", label: "Active" },
    { id: "ON_LEAVE", label: "On leave" },
    { id: "SUSPENDED", label: "Suspended" },
    { id: "OFFBOARDING", label: "Offboarding" },
    { id: "TERMINATED", label: "Terminated" },
];
export const EmploymentStatusFilterOptions: DropdownOption<EmploymentStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...EmploymentStatusFormOptions];

/** Badge tone per status (styling only). */
export const EmploymentStatusTone: Record<EmploymentStatus, BadgeVariant> = {
    ONBOARDING: "info", ACTIVE: "success", ON_LEAVE: "warning", SUSPENDED: "danger", OFFBOARDING: "violet", TERMINATED: "neutral",
};

export const EmploymentTypeFormOptions: DropdownOption<EmploymentType>[] = [
    { id: "FULL_TIME", label: "Full-time" },
    { id: "PART_TIME", label: "Part-time" },
    { id: "CONTRACTOR", label: "Contractor" },
    { id: "INTERN", label: "Intern" },
];
export const EmploymentTypeFilterOptions: DropdownOption<EmploymentType | "all">[] = [{ id: "all", label: "All types" }, ...EmploymentTypeFormOptions];

export const WorkLocationFormOptions: DropdownOption<WorkLocation>[] = [
    { id: "OFFICE", label: "Office" },
    { id: "REMOTE", label: "Remote" },
    { id: "HYBRID", label: "Hybrid" },
    { id: "CLIENT_SITE", label: "Client site" },
    { id: "TRAVEL", label: "Travel" },
];

export const SeniorityFormOptions: DropdownOption<SeniorityLevel>[] = [
    { id: "INTERN", label: "Intern" },
    { id: "JUNIOR", label: "Junior" },
    { id: "MID", label: "Mid" },
    { id: "SENIOR", label: "Senior" },
    { id: "LEAD", label: "Lead" },
    { id: "PRINCIPAL", label: "Principal" },
    { id: "MANAGER", label: "Manager" },
    { id: "DIRECTOR", label: "Director" },
    { id: "EXECUTIVE", label: "Executive" },
];

export const AvailabilityFormOptions: DropdownOption<AvailabilityStatus>[] = [
    { id: "AVAILABLE", label: "Available" },
    { id: "BUSY", label: "Busy" },
    { id: "REMOTE", label: "Working remotely" },
    { id: "IN_OFFICE", label: "In the office" },
    { id: "TRAINING", label: "Training" },
    { id: "BUSINESS_TRAVEL", label: "Business travel" },
    { id: "ON_LEAVE", label: "On leave" },
    { id: "VACATION", label: "Vacation" },
    { id: "SICK_LEAVE", label: "Sick leave" },
    { id: "PUBLIC_HOLIDAY", label: "Public holiday" },
];
export const AvailabilityFilterOptions: DropdownOption<AvailabilityStatus | "all">[] = [{ id: "all", label: "Any availability" }, ...AvailabilityFormOptions];
export const AvailabilityTone: Record<AvailabilityStatus, BadgeVariant> = {
    AVAILABLE: "success", BUSY: "warning", REMOTE: "info", IN_OFFICE: "info", TRAINING: "violet", BUSINESS_TRAVEL: "violet",
    ON_LEAVE: "neutral", VACATION: "neutral", SICK_LEAVE: "danger", PUBLIC_HOLIDAY: "neutral",
};

export const TerminationKindFormOptions: DropdownOption<TerminationKind>[] = [
    { id: "RESIGNATION", label: "Resignation" },
    { id: "DISMISSAL", label: "Dismissal" },
    { id: "END_OF_CONTRACT", label: "End of contract" },
    { id: "REDUNDANCY", label: "Redundancy" },
    { id: "RETIREMENT", label: "Retirement" },
    { id: "MUTUAL_AGREEMENT", label: "Mutual agreement" },
    { id: "OTHER", label: "Other" },
];

export const PayTypeFormOptions: DropdownOption<PayType>[] = [
    { id: "MONTHLY_SALARY", label: "Monthly salary" },
    { id: "HOURLY", label: "Hourly" },
    { id: "DAILY", label: "Daily" },
    { id: "PER_PROJECT", label: "Per project" },
];

export const EquipmentTypeFormOptions: DropdownOption<EquipmentType>[] = [
    { id: "LAPTOP", label: "Laptop" },
    { id: "PHONE", label: "Phone" },
    { id: "MONITOR", label: "Monitor" },
    { id: "ACCESS_CARD", label: "Access card" },
    { id: "VEHICLE", label: "Vehicle" },
    { id: "OTHER", label: "Other" },
];
export const EquipmentConditionFormOptions: DropdownOption<EquipmentCondition>[] = [
    { id: "NEW", label: "New" },
    { id: "GOOD", label: "Good" },
    { id: "FAIR", label: "Fair" },
    { id: "DAMAGED", label: "Damaged" },
    { id: "LOST", label: "Lost" },
];

export const DocumentCategoryFormOptions: DropdownOption<DocumentCategory>[] = [
    { id: "EMPLOYMENT_CONTRACT", label: "Employment contract" },
    { id: "NDA", label: "NDA" },
    { id: "CERTIFICATION", label: "Certification" },
    { id: "IDENTIFICATION", label: "Identification" },
    { id: "SIGNED_AGREEMENT", label: "Signed agreement" },
    { id: "HR_FORM", label: "HR form" },
    { id: "RESUME", label: "Resume / CV" },
    { id: "OTHER", label: "Other" },
];
export const DocumentStatusFormOptions: DropdownOption<DocumentStatus>[] = [
    { id: "REQUESTED", label: "Requested" },
    { id: "UPLOADED", label: "Uploaded" },
    { id: "VERIFIED", label: "Verified" },
    { id: "REJECTED", label: "Rejected" },
    { id: "EXPIRED", label: "Expired" },
    { id: "ARCHIVED", label: "Archived" },
];
export const DocumentStatusTone: Record<DocumentStatus, BadgeVariant> = { REQUESTED: "warning", UPLOADED: "info", VERIFIED: "success", REJECTED: "danger", EXPIRED: "danger", ARCHIVED: "neutral" };

export const HrNoteCategoryFormOptions: DropdownOption<HrNoteCategory>[] = [
    { id: "HR_COMMENT", label: "HR comment" },
    { id: "PERFORMANCE_OBSERVATION", label: "Performance observation" },
    { id: "MEETING", label: "Meeting" },
    { id: "WARNING", label: "Warning" },
    { id: "EXIT_INTERVIEW", label: "Exit interview" },
    { id: "OTHER", label: "Other" },
];
export const HrNoteVisibilityFormOptions: DropdownOption<HrNoteVisibility>[] = [
    { id: "HR_ONLY", label: "HR only" },
    { id: "HR_AND_MANAGERS", label: "HR and managers" },
    { id: "EMPLOYEE_VISIBLE", label: "Visible to the employee" },
];

export const WeekdayOptions: DropdownOption<string>[] = [
    { id: "1", label: "Monday" },
    { id: "2", label: "Tuesday" },
    { id: "3", label: "Wednesday" },
    { id: "4", label: "Thursday" },
    { id: "5", label: "Friday" },
    { id: "6", label: "Saturday" },
    { id: "0", label: "Sunday" },
];
