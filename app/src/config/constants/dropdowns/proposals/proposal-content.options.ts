import type {
    ApprovalCondition, BillingFrequency, ProposalDeliveryChannel, ProposalDeliveryStatus, ProposalLinkAccessMode, ProposalLostReason, ProposalPaymentTrigger, ProposalSectionType,
} from "@/features/proposals/interfaces/proposals.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

export const ProposalSectionTypeFormOptions: DropdownOption<ProposalSectionType>[] = [
    { id: "COVER", label: "Cover" },
    { id: "EXECUTIVE_SUMMARY", label: "Executive summary" },
    { id: "OVERVIEW", label: "Overview" },
    { id: "REQUIREMENTS", label: "Requirements" },
    { id: "SOLUTION", label: "Proposed solution" },
    { id: "SCOPE", label: "Scope of work" },
    { id: "FEATURES", label: "Features" },
    { id: "DELIVERABLES", label: "Deliverables" },
    { id: "PHASES", label: "Phases" },
    { id: "MILESTONES", label: "Milestones" },
    { id: "TIMELINE", label: "Timeline" },
    { id: "PRICING", label: "Pricing" },
    { id: "PAYMENT_SCHEDULE", label: "Payment schedule" },
    { id: "SUPPORT_OPTIONS", label: "Support options" },
    { id: "ASSUMPTIONS", label: "Assumptions" },
    { id: "EXCLUSIONS", label: "Exclusions" },
    { id: "WARRANTY", label: "Warranty" },
    { id: "TERMS", label: "Terms & conditions" },
    { id: "NEXT_STEPS", label: "Next steps" },
    { id: "SIGNATURE", label: "Acceptance" },
    { id: "CUSTOM", label: "Custom" },
];

/** Variables the editor offers; resolved by the API when the proposal is sent. */
export const ProposalVariableOptions: DropdownOption[] = [
    { id: "company.name", label: "Customer company" },
    { id: "contact.name", label: "Contact name" },
    { id: "contact.first_name", label: "Contact first name" },
    { id: "proposal.number", label: "Proposal number" },
    { id: "proposal.title", label: "Proposal title" },
    { id: "proposal.valid_until", label: "Valid until" },
    { id: "proposal.owner", label: "Proposal owner" },
    { id: "project.name", label: "Project name" },
    { id: "organization.name", label: "Our company" },
];

export const ProposalPaymentTriggerFormOptions: DropdownOption<ProposalPaymentTrigger>[] = [
    { id: "ON_ACCEPTANCE", label: "On acceptance" },
    { id: "ON_SIGNATURE", label: "On signature" },
    { id: "ON_DATE", label: "On a date" },
    { id: "ON_MILESTONE", label: "On a milestone" },
    { id: "ON_DELIVERY", label: "On delivery" },
    { id: "RECURRING", label: "Recurring" },
];

export const BillingFrequencyFormOptions: DropdownOption<BillingFrequency>[] = [
    { id: "monthly", label: "Monthly" },
    { id: "quarterly", label: "Quarterly" },
    { id: "annual", label: "Annually" },
    { id: "custom", label: "Custom" },
];

export const ProposalLostReasonFormOptions: DropdownOption<ProposalLostReason>[] = [
    { id: "PRICE", label: "Price" },
    { id: "SCOPE", label: "Scope" },
    { id: "TIMING", label: "Timing" },
    { id: "COMPETITOR", label: "Went with a competitor" },
    { id: "NO_DECISION", label: "No decision" },
    { id: "OTHER", label: "Other" },
];

export const ProposalDeliveryChannelOptions: DropdownOption<ProposalDeliveryChannel>[] = [
    { id: "EMAIL", label: "Email" },
    { id: "LINK", label: "Share link" },
    { id: "CUSTOMER_PORTAL", label: "Customer portal" },
    { id: "PDF", label: "PDF" },
];

export const ProposalDeliveryStatusOptions: DropdownOption<ProposalDeliveryStatus>[] = [
    { id: "QUEUED", label: "Queued" },
    { id: "SENT", label: "Sent" },
    { id: "DELIVERED", label: "Delivered" },
    { id: "FAILED", label: "Failed" },
];

export const ProposalLinkAccessModeFormOptions: DropdownOption<ProposalLinkAccessMode>[] = [
    { id: "ANYONE_WITH_LINK", label: "Anyone with the link" },
    { id: "EMAIL_VERIFIED", label: "Recipients verify their email" },
];

export const ApprovalConditionFieldOptions: DropdownOption<ApprovalCondition["field"]>[] = [
    { id: "gross_total", label: "Total (gross)" },
    { id: "net_total", label: "Net total" },
    { id: "discount_percent", label: "Overall discount %" },
    { id: "discount_total", label: "Discount amount" },
    { id: "recurring_monthly", label: "Recurring per month" },
    { id: "currency", label: "Currency" },
    { id: "requires_contract", label: "Needs a contract" },
];

export const ApprovalConditionOperatorOptions: DropdownOption<ApprovalCondition["operator"]>[] = [
    { id: ">", label: "greater than" },
    { id: ">=", label: "at least" },
    { id: "<", label: "less than" },
    { id: "<=", label: "at most" },
    { id: "=", label: "is" },
    { id: "!=", label: "is not" },
];

export const CurrencyOptions: DropdownOption[] = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CAD", "AUD"].map((c) => ({ id: c, label: c }));
export const LanguageOptions: DropdownOption[] = [
    { id: "en", label: "English" },
    { id: "el", label: "Greek" },
    { id: "de", label: "German" },
    { id: "fr", label: "French" },
    { id: "es", label: "Spanish" },
    { id: "it", label: "Italian" },
];
