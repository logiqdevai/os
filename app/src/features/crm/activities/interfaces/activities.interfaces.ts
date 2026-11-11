import type { CompanyRef, MemberRef } from "../../common/interfaces/crm-common.interfaces";

export const ActivityTypes = {
    CALL: "CALL",
    MEETING: "MEETING",
    EMAIL: "EMAIL",
    FOLLOW_UP: "FOLLOW_UP",
    REMINDER: "REMINDER",
    APPOINTMENT: "APPOINTMENT",
    INTERNAL_COMMENT: "INTERNAL_COMMENT",
    OTHER: "OTHER",
} as const;
export type ActivityType = (typeof ActivityTypes)[keyof typeof ActivityTypes];

export const ActivityStatuses = { PLANNED: "PLANNED", COMPLETED: "COMPLETED", CANCELLED: "CANCELLED", NO_SHOW: "NO_SHOW" } as const;
export type ActivityStatus = (typeof ActivityStatuses)[keyof typeof ActivityStatuses];

export const Priorities = { LOW: "LOW", NORMAL: "NORMAL", HIGH: "HIGH", URGENT: "URGENT" } as const;
export type Priority = (typeof Priorities)[keyof typeof Priorities];

export const ActivityDirections = { INBOUND: "INBOUND", OUTBOUND: "OUTBOUND" } as const;
export type ActivityDirection = (typeof ActivityDirections)[keyof typeof ActivityDirections];

export interface Activity {
    id: string;
    type: ActivityType;
    status: ActivityStatus;
    priority: Priority;
    direction: ActivityDirection | null;
    title: string;
    description: string | null;
    company_id: string | null;
    contact_id: string | null;
    lead_id: string | null;
    deal_id: string | null;
    owner_membership_id: string | null;
    starts_at: string | null;
    ends_at: string | null;
    duration_minutes: number | null;
    location: string | null;
    meeting_url: string | null;
    outcome: string | null;
    completed_at: string | null;
    created_at: string;
    owner?: MemberRef | null;
    company?: CompanyRef | null;
    deal?: { id: string; name: string } | null;
    lead?: { id: string; name: string } | null;
    contact?: { id: string; first_name: string; last_name: string | null } | null;
    participants?: { id: string; membership_id: string | null; contact_id: string | null; contact: { id: string; first_name: string; last_name: string | null } | null }[];
    is_overdue?: boolean;
}

export interface ActivitySummary {
    open: number;
    overdue: number;
    today: number;
}

export interface CreateActivityDto {
    type: ActivityType;
    title: string;
    status?: ActivityStatus;
    priority?: Priority;
    direction?: ActivityDirection;
    description?: string;
    company_id?: string;
    contact_id?: string;
    lead_id?: string;
    deal_id?: string;
    owner_membership_id?: string;
    starts_at?: string;
    duration_minutes?: number;
    location?: string;
    meeting_url?: string;
    outcome?: string;
}
export type UpdateActivityDto = Partial<CreateActivityDto>;

/** The record an activity or note hangs off (pre-fills forms on detail pages). */
export interface CrmRecordLink {
    company_id?: string;
    contact_id?: string;
    lead_id?: string;
    deal_id?: string;
}
