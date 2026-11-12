export type BulkEntity = "CRM_COMPANY" | "CRM_CONTACT" | "CRM_LEAD" | "CRM_DEAL";
export type BulkAction = "assign" | "add_tag" | "remove_tag" | "set_status" | "set_stage" | "set_lifecycle" | "set_type" | "archive" | "restore";

export interface BulkActionDto {
    entity_type: BulkEntity;
    ids: string[];
    action: BulkAction;
    owner_membership_id?: string;
    tag_id?: string;
    status_id?: string;
    stage_id?: string;
    lost_reason_id?: string;
    lifecycle_stage_id?: string;
    type?: string;
}

export interface BulkResult {
    requested: number;
    succeeded: string[];
    failed: { id: string; reason: string }[];
}
