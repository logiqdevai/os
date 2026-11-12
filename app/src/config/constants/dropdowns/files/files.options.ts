import type { ApprovalDecision, ApprovalStatus, DocumentScopeKind, DocumentStatus, DocumentTypeGroup, FolderTemplateTarget, RetentionAction, RetentionAnchor, SharePermission, ShareStatus, ShareSubjectType, VaultEntryType, VaultGrantSubjectType, VaultScope } from "@/features/files/interfaces/files.interfaces";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";

/** Canonical labels for Documents & Files enums (17). */
export const DocumentStatusOptions: DropdownOption<DocumentStatus>[] = [
    { id: "DRAFT", label: "Draft" },
    { id: "ACTIVE", label: "Active" },
    { id: "APPROVED", label: "Approved" },
    { id: "ARCHIVED", label: "Archived" },
    { id: "DELETED", label: "In trash" },
];

export const DocumentTypeFilterOptions: DropdownOption<DocumentTypeGroup | "all">[] = [
    { id: "all", label: "All types" },
    { id: "pdf", label: "PDF" },
    { id: "image", label: "Images" },
    { id: "document", label: "Documents" },
    { id: "spreadsheet", label: "Spreadsheets" },
    { id: "presentation", label: "Presentations" },
    { id: "video", label: "Video" },
    { id: "audio", label: "Audio" },
    { id: "archive", label: "Archives" },
    { id: "text", label: "Text" },
];

export const ShareSubjectTypeOptions: DropdownOption<ShareSubjectType>[] = [
    { id: "PUBLIC_LINK", label: "Anyone with the link" },
    { id: "EXTERNAL_EMAIL", label: "External person (email)" },
    { id: "MEMBERSHIP", label: "A member" },
    { id: "TEAM", label: "A team" },
    { id: "PORTAL_USER", label: "Client portal user" },
];
export const SharePermissionOptions: DropdownOption<SharePermission>[] = [
    { id: "VIEW", label: "Can view" },
    { id: "COMMENT", label: "Can comment" },
    { id: "EDIT", label: "Can edit" },
    { id: "MANAGE", label: "Can manage" },
];
export const ShareStatusOptions: DropdownOption<ShareStatus>[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "EXPIRED", label: "Expired" },
    { id: "REVOKED", label: "Revoked" },
];

export const FileApprovalStatusOptions: DropdownOption<ApprovalStatus>[] = [
    { id: "PENDING", label: "Pending" },
    { id: "APPROVED", label: "Approved" },
    { id: "REJECTED", label: "Rejected" },
    { id: "CHANGES_REQUESTED", label: "Changes requested" },
    { id: "CANCELLED", label: "Cancelled" },
];
export const FileApprovalDecisionOptions: DropdownOption<ApprovalDecision>[] = [
    { id: "APPROVED", label: "Approve" },
    { id: "CHANGES_REQUESTED", label: "Request changes" },
    { id: "REJECTED", label: "Reject" },
];

export const VaultEntryTypeOptions: DropdownOption<VaultEntryType>[] = [
    { id: "PASSWORD", label: "Password" },
    { id: "API_KEY", label: "API key" },
    { id: "SSH_KEY", label: "SSH key" },
    { id: "NOTE", label: "Secure note" },
    { id: "FILE", label: "File" },
];
export const VaultEntryTypeFilterOptions: DropdownOption<VaultEntryType | "all">[] = [{ id: "all", label: "All types" }, ...VaultEntryTypeOptions];
export const VaultScopeOptions: DropdownOption<VaultScope>[] = [
    { id: "ORGANIZATION", label: "Organization" },
    { id: "CUSTOMER", label: "Customer" },
    { id: "PROJECT", label: "Project" },
];

export const VaultGrantSubjectOptions: DropdownOption<VaultGrantSubjectType>[] = [
    { id: "MEMBERSHIP", label: "Member" },
    { id: "TEAM", label: "Team" },
    { id: "PORTAL_USER", label: "Customer portal user" },
];

export const RetentionAnchorOptions: DropdownOption<RetentionAnchor>[] = [
    { id: "CREATED", label: "After the document was created" },
    { id: "LAST_MODIFIED", label: "After the last change" },
    { id: "ARCHIVED", label: "After it was archived" },
    { id: "RECORD_CLOSED", label: "After its record was closed" },
];

export const RetentionActionOptions: DropdownOption<RetentionAction>[] = [
    { id: "ARCHIVE", label: "Archive" },
    { id: "SOFT_DELETE", label: "Move to trash" },
    { id: "PERMANENT_DELETE", label: "Delete permanently (two-person approval)" },
];

export const DocumentScopeOptions: DropdownOption<DocumentScopeKind>[] = [
    { id: "ORGANIZATION", label: "Organization" },
    { id: "BRANCH", label: "Branch" },
    { id: "TEAM", label: "Team" },
    { id: "PROJECT", label: "Project" },
    { id: "CUSTOMER", label: "Customer" },
    { id: "EMPLOYEE", label: "Employee (HR)" },
    { id: "RECORD", label: "Attached to a record" },
];

export const FolderTemplateTargetOptions: DropdownOption<FolderTemplateTarget>[] = [
    { id: "ORGANIZATION", label: "Organization folders" },
    { id: "PROJECT_TYPE", label: "Projects" },
    { id: "CUSTOMER", label: "Customers" },
    { id: "EMPLOYEE", label: "Employees" },
];
