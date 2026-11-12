export type SavedViewVisibility = "PERSONAL" | "TEAM" | "ORGANIZATION";

/** A saved list view (02 §29): the URL query of the list (filters, search, hidden columns) under a name. */
export interface SavedView {
    id: string;
    entity_type: string;
    name: string;
    layout: string;
    visibility: SavedViewVisibility;
    owner_membership_id: string | null;
    team_id: string | null;
    team: { id: string; name: string } | null;
    /** URL query params of the list, e.g. { type: "CUSTOMER", owner: "me", hide: "tags,contacts" }. */
    filters: Record<string, string> | null;
    search: string | null;
    is_default: boolean;
    can_edit: boolean;
}

export interface SaveViewDto {
    entity_type: string;
    name: string;
    layout?: string;
    visibility?: SavedViewVisibility;
    team_id?: string;
    filters?: Record<string, string>;
    search?: string;
    is_default?: boolean;
}
