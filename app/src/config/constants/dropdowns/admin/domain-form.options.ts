import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import type { DomainVerificationStatus } from "@/features/admin/domains/interfaces/domains.interfaces";

/** DomainVerificationStatus (01 §70). */
export const DomainStatusFormOptions: DropdownOption<DomainVerificationStatus>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "VERIFIED", label: "Verified" },
    { id: "FAILED", label: "Check failed" },
    { id: "REVOKED", label: "Revoked" },
];
export const DomainStatusFilterOptions: DropdownOption<DomainVerificationStatus | "all">[] = [{ id: "all", label: "All statuses" }, ...DomainStatusFormOptions];

/** dns_check.txt.error codes from POST /domains/:id/verify. */
export const DomainCheckErrorOptions: DropdownOption<string>[] = [
    { id: "record_not_found", label: "The TXT record was not found yet" },
    { id: "record_mismatch", label: "A TXT record exists but the value does not match" },
    { id: "dns_timeout", label: "The DNS lookup timed out" },
    { id: "dns_error", label: "The DNS lookup failed" },
];
