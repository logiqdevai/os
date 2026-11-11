import type { SignatureRequestStatus, SignerStatus, SigningOrder } from "@/features/contracts/interfaces/contracts.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

export const SignatureRequestStatusFormOptions: DropdownOption<SignatureRequestStatus>[] = [
    { id: "NOT_SENT", label: "Not sent" },
    { id: "SENT", label: "Sent" },
    { id: "DELIVERED", label: "Delivered" },
    { id: "VIEWED", label: "Viewed" },
    { id: "PARTIALLY_SIGNED", label: "Partially signed" },
    { id: "FULLY_SIGNED", label: "Completed" },
    { id: "DECLINED", label: "Declined" },
    { id: "EXPIRED", label: "Expired" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "FAILED", label: "Failed" },
];
export const SignatureRequestStatusFilterOptions: DropdownOption<SignatureRequestStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...SignatureRequestStatusFormOptions];

export const SignerStatusOptions: DropdownOption<SignerStatus>[] = [
    { id: "PENDING", label: "Waiting for turn" },
    { id: "SENT", label: "Invited" },
    { id: "DELIVERED", label: "Delivered" },
    { id: "VIEWED", label: "Viewed" },
    { id: "SIGNED", label: "Signed" },
    { id: "DECLINED", label: "Declined" },
    { id: "BOUNCED", label: "Bounced" },
];

export const SigningOrderOptions: DropdownOption<SigningOrder>[] = [
    { id: "SEQUENTIAL", label: "In order (one after another)" },
    { id: "PARALLEL", label: "All at once" },
];

export const SignatureEventTypeOptions: DropdownOption<string>[] = [
    { id: "REQUEST_CREATED", label: "Request created" },
    { id: "SENT", label: "Invitation sent" },
    { id: "DELIVERED", label: "Delivered" },
    { id: "VIEWED", label: "Document viewed" },
    { id: "SIGNED", label: "Signed" },
    { id: "DECLINED", label: "Declined" },
    { id: "REMINDER_SENT", label: "Reminder sent" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "EXPIRED", label: "Expired" },
    { id: "COMPLETED", label: "Completed" },
    { id: "FAILED", label: "Failed" },
];

export const SignatureMethodOptions: DropdownOption<"TYPED" | "DRAWN" | "UPLOADED">[] = [
    { id: "TYPED", label: "Typed name" },
    { id: "DRAWN", label: "Drawn signature" },
    { id: "UPLOADED", label: "Uploaded image" },
];
