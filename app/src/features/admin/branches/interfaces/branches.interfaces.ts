import type { UserSummary } from "@/features/admin/members/interfaces/members.interfaces";

export type BranchKind = "OPERATIONAL" | "OFFICE" | "REGIONAL_UNIT" | "SUBSIDIARY_REFERENCE" | "SERVICE_CENTER" | "REMOTE";
export type BranchStatus = "ACTIVE" | "PLANNED" | "TEMPORARILY_CLOSED" | "SUSPENDED" | "ARCHIVED";

export interface Branch {
    id: string;
    name: string;
    code: string | null;
    kind: BranchKind;
    status: BranchStatus;
    is_headquarters: boolean;
    parent_branch_id: string | null;
    path: string;
    depth: number;
    country: string | null;
    region: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    timezone: string | null;
    currency: string | null;
    cost_center_code: string | null;
    week_start: number | null;
    archived_at: string | null;
    created_at: string;
    parent?: { id: string; name: string } | null;
    _count?: { memberships: number; teams: number; children: number };
}

export interface BranchDetail extends Omit<Branch, "_count"> {
    children: { id: string; name: string; code: string | null; kind: BranchKind; status: BranchStatus }[];
    managers: { id: string; title: string | null; membership: { id: string; job_title: string | null; user: UserSummary } }[];
    memberships: { id: string; is_primary: boolean; membership: { id: string; status: string; job_title: string | null; user: UserSummary } }[];
    teams: { id: string; name: string; kind: string }[];
    _count: { memberships: number };
}

export interface BranchDto {
    name: string;
    code?: string;
    kind?: BranchKind;
    status?: BranchStatus;
    parent_branch_id?: string | null;
    is_headquarters?: boolean;
    country?: string;
    region?: string;
    city?: string;
    phone?: string;
    email?: string;
    timezone?: string;
    currency?: string;
}
