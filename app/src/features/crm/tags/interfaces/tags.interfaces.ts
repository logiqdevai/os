import type { CrmEntityType } from "../../common/interfaces/crm-common.interfaces";

export interface Tag {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    entity_types: string[];
    usage: number;
}

export interface CreateTagDto {
    name: string;
    color?: string;
}

export interface SetTaggingsDto {
    entity_type: CrmEntityType;
    entity_id: string;
    tag_ids: string[];
}
