import type { Paginated, PersonUser, Ref } from "@/features/people/employees/interfaces/employees.interfaces";

export type LeaveCategory = "VACATION" | "SICK" | "PERSONAL" | "MATERNITY" | "PATERNITY" | "PARENTAL" | "UNPAID" | "PUBLIC_HOLIDAY" | "COMPANY_HOLIDAY" | "TIME_OFF" | "OTHER";
export type LeaveRequestStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "WITHDRAWN";
export type LeaveDayPart = "FULL_DAY" | "FIRST_HALF" | "SECOND_HALF";

export interface LeaveType {
    id: string;
    name: string;
    code: string;
    category: LeaveCategory;
    color: string | null;
    is_paid: boolean;
    requires_approval: boolean;
    requires_attachment: boolean;
    allows_half_day: boolean;
    deducts_balance: boolean;
    min_notice_days: number | null;
    max_consecutive_days: number | null;
    archived_at: string | null;
    policies: { id: string; name: string; annual_entitlement_days: string; is_default: boolean; branch_id: string | null }[];
}

export interface LeaveRequest {
    id: string;
    status: LeaveRequestStatus;
    start_date: string;
    end_date: string;
    start_day_part: LeaveDayPart;
    end_day_part: LeaveDayPart;
    total_days: string;
    total_hours: string | null;
    reason: string | null;
    decision_note: string | null;
    cancellation_reason: string | null;
    has_conflicts: boolean;
    conflicts: { employee_id: string; name: string; start_date: string; end_date: string; status: string }[] | null;
    submitted_at: string | null;
    decided_at: string | null;
    created_at: string;
    current_approver_membership_id: string | null;
    leave_type: { id: string; name: string; code: string; category: LeaveCategory; color: string | null; deducts_balance: boolean };
    employee: { id: string; employee_number: string; name: string; photo_url: string | null; is_me: boolean; department: Ref | null };
    covering_employee: { id: string; name: string } | null;
    decided_by: { id: string; user: PersonUser } | null;
    approvals: { id: string; step: number; decision: string; decided_at: string | null; comment: string | null; approver: { id: string; user: PersonUser } }[];
    can_decide: boolean;
    days?: { date: string; day_part: LeaveDayPart; hours: string | null }[];
}

export interface LeaveRequestDto {
    employee_id?: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    start_day_part?: LeaveDayPart;
    end_day_part?: LeaveDayPart;
    reason?: string;
    covering_employee_id?: string;
    submit?: boolean;
}

export interface LeavePreview {
    days: { date: string; day_part: LeaveDayPart; days: number; hours: number }[];
    holidays: { date: string; name: string }[];
    total_days: number;
    total_hours: number;
    balance: { available: number; after: number; period_start: string; period_end: string } | null;
    conflicts: { employee_id: string; name: string; start_date: string; end_date: string; status: string }[];
    overlaps: { date: string; leave_request_id: string }[];
    warnings: string[];
}

export interface LeaveBalance {
    id: string;
    period_start: string;
    period_end: string;
    entitled_days: string;
    accrued_days: string;
    carried_over_days: string;
    adjusted_days: string;
    used_days: string;
    pending_days: string;
    available_days: number;
    leave_type: { id: string; name: string; code: string; color: string | null; category: LeaveCategory };
    policy: { id: string; name: string } | null;
}

export interface EmployeeBalances {
    employee: { id: string; employee_number: string; name: string; photo_url: string | null; department: Ref | null; is_me: boolean };
    balances: LeaveBalance[];
}

export interface LeaveTransaction {
    id: string;
    type: string;
    days: string;
    effective_on: string;
    reason: string | null;
    created_at: string;
}

export interface LeaveCalendar {
    from: string;
    to: string;
    employees: { id: string; name: string; photo_url: string | null; department: Ref | null; is_me: boolean }[];
    days: { employee_id: string; date: string; day_part: LeaveDayPart; status: LeaveRequestStatus; request_id: string; leave_type: { id: string; name: string; color: string | null; category: LeaveCategory } }[];
    holidays: { date: string; name: string; is_half_day: boolean }[];
}

export interface CompanyHoliday {
    id: string;
    name: string;
    date: string;
    kind: "PUBLIC" | "COMPANY";
    is_half_day: boolean;
    recurring: boolean;
}

export type { Paginated };
