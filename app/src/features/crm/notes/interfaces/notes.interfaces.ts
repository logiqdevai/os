import type { MemberRef } from "../../common/interfaces/crm-common.interfaces";

export type NoteEntityType = "CRM_COMPANY" | "CRM_CONTACT" | "CRM_LEAD" | "CRM_DEAL";

export interface CrmNote {
    id: string;
    entity_type: NoteEntityType;
    entity_id: string;
    author_membership_id: string | null;
    body: string;
    is_private: boolean;
    mentions: string[];
    pinned: boolean;
    edited_at: string | null;
    created_at: string;
    author?: MemberRef | null;
    edit_count: number;
    can_edit: boolean;
}

export interface CreateNoteDto {
    entity_type: NoteEntityType;
    entity_id: string;
    body: string;
    is_private?: boolean;
    pinned?: boolean;
}
export interface UpdateNoteDto {
    body?: string;
    is_private?: boolean;
    pinned?: boolean;
}
