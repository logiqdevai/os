import type { CampaignStatus } from "@/features/communications/interfaces/communications.interfaces";

export const CampaignStatusFormOptions: { id: CampaignStatus; label: string }[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "PENDING_APPROVAL", label: "Waiting for approval" },
    { id: "APPROVED", label: "Approved" },
    { id: "SCHEDULED", label: "Scheduled" },
    { id: "SENDING", label: "Sending" },
    { id: "PAUSED", label: "Paused" },
    { id: "COMPLETED", label: "Sent" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "FAILED", label: "Failed" },
];

export const CampaignStatusFilterOptions: { id: CampaignStatus | "all"; label: string }[] = [{ id: "all", label: "All statuses" }, ...CampaignStatusFormOptions];
