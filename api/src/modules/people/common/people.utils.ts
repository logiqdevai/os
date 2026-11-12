import { BadRequestException } from '@nestjs/common';
import { Prisma } from 'generated/prisma';

/** Permission keys of module 10 (catalog: api/prisma/seed/permission-catalog.ts). */
export const P = {
    directoryRead: 'employees.directory.read',
    read: 'employees.employees.read',
    create: 'employees.employees.create',
    update: 'employees.employees.update',
    delete: 'employees.employees.delete',
    archive: 'employees.employees.archive',
    export: 'employees.employees.export',
    offboard: 'employees.employees.offboard',
    import: 'employees.employees.import',
    compRead: 'employees.compensation.read',
    compManage: 'employees.compensation.manage',
    personalRead: 'employees.personal_data.read',
    personalManage: 'employees.personal_data.manage',
    docsRead: 'employees.documents.read',
    docsManage: 'employees.documents.manage',
    notesRead: 'employees.hr_notes.read',
    notesManage: 'employees.hr_notes.manage',
    equipmentRead: 'employees.equipment.read',
    equipmentManage: 'employees.equipment.manage',
    profileOwn: 'employees.profile.update_own',
    settings: 'employees.settings.manage',
    leaveReadOwn: 'employees.leave.read_own',
    leaveReadAll: 'employees.leave.read_all',
    leaveRequestOwn: 'employees.leave.request_own',
    leaveApprove: 'employees.leave.approve',
    leavePolicies: 'employees.leave.manage_policies',
    leaveBalances: 'employees.leave.manage_balances',
    attReadOwn: 'employees.attendance.read_own',
    attReadAll: 'employees.attendance.read_all',
    attRecordOwn: 'employees.attendance.record_own',
    attManage: 'employees.attendance.manage',
    availability: 'employees.availability.manage',
    capacity: 'employees.capacity.read',
    skillsRead: 'employees.skills.read',
    skillsManage: 'employees.skills.manage',
    perfReadOwn: 'employees.performance.read_own',
    perfReadAll: 'employees.performance.read_all',
    perfManage: 'employees.performance.manage',
} as const;

/** Every key that opens some part of the People app (used for shared lookups such as settings and leave types). */
export const ANY_PEOPLE_KEY = Object.values(P);

/** Personal data (01 §60): read with employees.personal_data.read, stripped otherwise. */
export const PERSONAL_FIELDS = [
    'legal_first_name', 'legal_last_name', 'date_of_birth', 'gender', 'nationality', 'national_id_number', 'tax_id',
    'social_security_number', 'bank_details', 'personal_email', 'personal_phone', 'address',
] as const;

/** Fields an employee may change on their own profile (self-service), unless settings narrow it. */
export const SELF_SERVICE_FIELDS = [
    'preferred_name', 'work_phone', 'personal_email', 'personal_phone', 'address', 'bio', 'timezone',
    'areas_of_expertise', 'technical_stack', 'availability_note', 'bank_details', 'nationality', 'gender',
] as const;

/** Directory card fields (EmployeeHrSettings.directory_visible_fields narrows these). */
export const DIRECTORY_FIELDS = ['job_title', 'work_email', 'work_phone', 'timezone', 'bio', 'availability_status', 'availability_note', 'work_location'] as const;

export const userSelect = { id: true, email: true, display_name: true, first_name: true, last_name: true, profile_photo_url: true } as const;

export const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' (or Date) → UTC midnight Date for @db.Date columns. */
export function toDay(value: string | Date): Date {
    if (value instanceof Date) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!m) throw new BadRequestException({ message: `Invalid date ${value}`, code: 'invalid_date' });
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export const today = () => toDay(new Date());
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

/** Monday of the week containing d (UTC). */
export function weekStart(d: Date): Date {
    const day = toDay(d);
    const dow = (day.getUTCDay() + 6) % 7; // 0 = Monday
    return addDays(day, -dow);
}

export function* eachDay(from: Date, to: Date) {
    for (let d = toDay(from); d <= to; d = addDays(d, 1)) yield d;
}

export const num = (v: Prisma.Decimal | number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v));
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function personName(e: { preferred_name?: string | null; legal_first_name?: string | null; legal_last_name?: string | null; membership?: { user?: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null } | null }) {
    const u = e.membership?.user;
    return (
        e.preferred_name ||
        u?.display_name ||
        [u?.first_name, u?.last_name].filter(Boolean).join(' ') ||
        [e.legal_first_name, e.legal_last_name].filter(Boolean).join(' ') ||
        u?.email ||
        'Unknown'
    );
}

/** Drop undefined keys so PATCH bodies never null out columns by accident. */
export function defined<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Convert ISO date strings of the listed keys to Date objects (for @db.Date columns). */
export function dates<T extends object>(obj: T, keys: string[]): T {
    const out: Record<string, any> = { ...obj };
    for (const k of keys) {
        if (out[k] === null) continue;
        if (typeof out[k] === 'string') out[k] = toDay(out[k]);
    }
    return out as T;
}
