import type { LossReasonScope, SettingKind } from "@/features/crm/settings/interfaces/settings.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** CRM settings lists (02 §4, §5, §9, §17). */
export const SettingKindOptions: (DropdownOption<SettingKind> & { description: string })[] = [
    { id: "lead-sources", label: "Lead sources", description: "Where leads and customers come from." },
    { id: "lead-statuses", label: "Lead statuses", description: "Steps a lead goes through before it is converted or lost." },
    { id: "lifecycle-stages", label: "Lifecycle stages", description: "Relationship stage of companies and contacts. Customer stages mark a company as a customer." },
    { id: "loss-reasons", label: "Loss reasons", description: "Why deals and leads are lost, for reporting." },
];

export const LossReasonScopeFormOptions: DropdownOption<LossReasonScope>[] = [
    { id: "BOTH", label: "Deals and leads" },
    { id: "DEAL", label: "Deals only" },
    { id: "LEAD", label: "Leads only" },
];

/** Semantic tones for stages, statuses and tags (mapped to theme tokens, never raw colors). */
export const ToneFormOptions: DropdownOption<"neutral" | "info" | "success" | "warning" | "danger" | "violet">[] = [
    { id: "neutral", label: "Gray" },
    { id: "info", label: "Blue" },
    { id: "success", label: "Green" },
    { id: "warning", label: "Yellow" },
    { id: "danger", label: "Red" },
    { id: "violet", label: "Violet" },
];
