import type { BadgeVariant } from "@/components/ui/badge";
import type { DuplicateMode, ImportStatus, RowPlan } from "@/features/crm/imports/interfaces/imports.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Prisma `CrmImportStatus`. */
export const ImportStatusOptions: (DropdownOption<ImportStatus> & { variant: BadgeVariant })[] = [
    { id: "PENDING", label: "Setting up", variant: "neutral" },
    { id: "VALIDATING", label: "Validating", variant: "info" },
    { id: "PREVIEW", label: "Ready to import", variant: "info" },
    { id: "IMPORTING", label: "Importing", variant: "warning" },
    { id: "COMPLETED", label: "Completed", variant: "success" },
    { id: "FAILED", label: "Failed", variant: "danger" },
    { id: "ROLLED_BACK", label: "Rolled back", variant: "neutral" },
];

export const DuplicateModeOptions: DropdownOption<DuplicateMode>[] = [
    { id: "skip", label: "Skip rows that match an existing record" },
    { id: "update", label: "Update the existing record" },
    { id: "create", label: "Always create a new record" },
];

export const RowPlanOptions: (DropdownOption<RowPlan> & { variant: BadgeVariant })[] = [
    { id: "create", label: "Create", variant: "success" },
    { id: "update", label: "Update", variant: "info" },
    { id: "skip", label: "Skip", variant: "neutral" },
    { id: "error", label: "Error", variant: "danger" },
];
