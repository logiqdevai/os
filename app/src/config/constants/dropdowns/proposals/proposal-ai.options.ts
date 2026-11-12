import type { AiApplyDto, AiGenerateDto, ProposalSectionType } from "@/features/proposals/interfaces/proposals.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Writing tone for AI drafts. */
export const ProposalAiToneOptions: DropdownOption<NonNullable<AiGenerateDto["tone"]>>[] = [
    { id: "professional", label: "Professional" },
    { id: "friendly", label: "Friendly" },
    { id: "concise", label: "Concise" },
    { id: "formal", label: "Formal" },
];

/** How an accepted draft is applied to the version. */
export const ProposalAiApplyModeOptions: DropdownOption<AiApplyDto["mode"]>[] = [
    { id: "append", label: "Add after the existing content" },
    { id: "replace", label: "Replace sections and lines" },
];

/** Section types the AI can draft (pricing, payment schedule and acceptance come from structured data). */
export const ProposalAiSectionTypes: ProposalSectionType[] = [
    "EXECUTIVE_SUMMARY", "OVERVIEW", "REQUIREMENTS", "SOLUTION", "SCOPE", "FEATURES", "DELIVERABLES", "PHASES", "MILESTONES", "TIMELINE", "SUPPORT_OPTIONS", "ASSUMPTIONS", "EXCLUSIONS", "WARRANTY", "TERMS", "NEXT_STEPS",
];
export const ProposalAiDefaultSections: ProposalSectionType[] = ["EXECUTIVE_SUMMARY", "SCOPE", "DELIVERABLES", "TIMELINE", "ASSUMPTIONS", "EXCLUSIONS"];

/** Source labels returned by the API (`deal:<id>`, `crm_notes:<n>`, …). */
export const ProposalAiSourceOptions: DropdownOption[] = [
    { id: "deal", label: "CRM deal" },
    { id: "crm_notes", label: "Deal notes" },
    { id: "crm_activities", label: "Deal activities" },
    { id: "user_notes", label: "Your notes" },
];
