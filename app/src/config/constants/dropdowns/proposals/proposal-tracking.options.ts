import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import { ProposalEventTypeOptions } from "./proposal-status.options";

/** Event types shown on /proposals/tracking (customer-facing activity). Labels come from ProposalEventTypeOptions. */
const TRACKED = ["VIEWED", "DOWNLOADED", "OPTIONAL_ITEM_TOGGLED", "COMMENTED", "CHANGES_REQUESTED", "ACCEPTED", "REJECTED", "SENT", "EXPIRED"];

export const ProposalTrackingTypeFilterOptions: DropdownOption[] = [
    { id: "all", label: "All activity" },
    ...ProposalEventTypeOptions.filter((o) => TRACKED.includes(String(o.id))),
];

/** Period filter (days back from today). */
export const ProposalTrackingPeriodOptions: DropdownOption[] = [
    { id: "7", label: "Last 7 days" },
    { id: "30", label: "Last 30 days" },
    { id: "90", label: "Last 90 days" },
    { id: "365", label: "Last 12 months" },
];
