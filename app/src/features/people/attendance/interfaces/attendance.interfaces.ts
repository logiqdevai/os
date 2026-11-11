import type { Ref, WorkLocation } from "@/features/people/employees/interfaces/employees.interfaces";

export type AttendanceStatus = "CLOCKED_IN" | "COMPLETED" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "EXCUSED";
export type BoardState = "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT" | "ON_LEAVE" | "NOT_IN";

export interface AttendanceBreak {
    id: string;
    kind: "PAID" | "UNPAID";
    started_at: string;
    ended_at: string | null;
}

export interface AttendanceSession {
    id: string;
    clock_in_at: string;
    clock_out_at: string | null;
    work_location: WorkLocation;
    clock_in_source: string;
    note: string | null;
    breaks: AttendanceBreak[];
}

export interface AttendanceRecord {
    id: string;
    date: string;
    status: AttendanceStatus;
    work_location: WorkLocation;
    first_clock_in_at: string | null;
    last_clock_out_at: string | null;
    scheduled_minutes: number;
    worked_minutes: number;
    break_minutes: number;
    overtime_minutes: number;
    late_minutes: number;
    early_leave_minutes: number;
    overtime_approved: boolean;
    note: string | null;
    sessions: AttendanceSession[];
    employee?: { id: string; employee_number: string; name: string; is_me: boolean };
}

export interface MyAttendance {
    employee: { id: string; name: string };
    today: AttendanceRecord | null;
    open_session: AttendanceSession | null;
    open_break: AttendanceBreak | null;
    week: { date: string; scheduled_hours: number; holiday: string | null; record: AttendanceRecord | null }[];
    allowed_sources: string[];
}

export interface AttendanceBoard {
    date: string;
    summary: { clocked_in: number; clocked_out: number; on_leave: number; not_in: number; late: number };
    rows: { employee: { id: string; name: string; photo_url: string | null; department: Ref | null; job_title: string | null }; state: BoardState; record: AttendanceRecord | null; leave: string | null }[];
}
