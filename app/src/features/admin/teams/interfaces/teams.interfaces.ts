import type { PaginationMeta } from "@/components/ui/data-table";

export const TeamKinds = {
    TEAM: "TEAM",
    DEPARTMENT: "DEPARTMENT",
    BUSINESS_UNIT: "BUSINESS_UNIT",
    PROJECT_TEAM: "PROJECT_TEAM",
} as const;
export type TeamKind = (typeof TeamKinds)[keyof typeof TeamKinds];

export interface Team {
    id: string;
    name: string;
    slug: string | null;
    task_key: string | null;
    description: string | null;
    kind: TeamKind;
    branch_id: string | null;
    parent_team_id: string | null;
    archived_at: string | null;
    created_at: string;
    branch?: { id: string; name: string } | null;
    _count?: { members: number };
}

export interface TeamMemberRow {
    id: string;
    team_role: string | null;
    is_lead: boolean;
    membership: {
        id: string;
        job_title: string | null;
        user: { id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null; profile_photo_url: string | null };
    };
}

export interface TeamDetail extends Team {
    parent?: { id: string; name: string } | null;
    members: TeamMemberRow[];
}

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export interface CreateTeamDto {
    name: string;
    description?: string;
    kind?: TeamKind;
    task_key?: string;
    branch_id?: string;
    parent_team_id?: string;
}
export type UpdateTeamDto = Partial<CreateTeamDto>;
