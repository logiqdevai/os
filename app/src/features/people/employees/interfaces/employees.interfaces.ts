import type { PaginationMeta } from "@/components/ui/data-table";

export type EmploymentStatus = "ONBOARDING" | "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "OFFBOARDING" | "TERMINATED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "INTERN";
export type WorkLocation = "OFFICE" | "REMOTE" | "HYBRID" | "CLIENT_SITE" | "TRAVEL";
export type SeniorityLevel = "INTERN" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "PRINCIPAL" | "MANAGER" | "DIRECTOR" | "EXECUTIVE";
export type AvailabilityStatus = "AVAILABLE" | "BUSY" | "ON_LEAVE" | "VACATION" | "SICK_LEAVE" | "PUBLIC_HOLIDAY" | "REMOTE" | "IN_OFFICE" | "TRAINING" | "BUSINESS_TRAVEL";
export type TerminationKind = "RESIGNATION" | "DISMISSAL" | "END_OF_CONTRACT" | "REDUNDANCY" | "RETIREMENT" | "MUTUAL_AGREEMENT" | "OTHER";
export type PayType = "MONTHLY_SALARY" | "HOURLY" | "DAILY" | "PER_PROJECT";
export type EquipmentType = "LAPTOP" | "PHONE" | "MONITOR" | "ACCESS_CARD" | "VEHICLE" | "OTHER";
export type EquipmentCondition = "NEW" | "GOOD" | "FAIR" | "DAMAGED" | "LOST";
export type DocumentCategory = "EMPLOYMENT_CONTRACT" | "NDA" | "CERTIFICATION" | "IDENTIFICATION" | "SIGNED_AGREEMENT" | "HR_FORM" | "RESUME" | "OTHER";
export type DocumentStatus = "REQUESTED" | "UPLOADED" | "VERIFIED" | "REJECTED" | "EXPIRED" | "ARCHIVED";
export type HrNoteCategory = "PERFORMANCE_OBSERVATION" | "MEETING" | "HR_COMMENT" | "WARNING" | "OTHER" | "EXIT_INTERVIEW";
export type HrNoteVisibility = "HR_ONLY" | "HR_AND_MANAGERS" | "EMPLOYEE_VISIBLE";
export type LanguageProficiency = "BASIC" | "CONVERSATIONAL" | "PROFESSIONAL" | "FLUENT" | "NATIVE";

export interface PersonUser {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
}

export interface Ref {
    id: string;
    name: string;
}

export interface Employee {
    id: string;
    employee_number: string;
    membership_id: string;
    name: string;
    photo_url: string | null;
    preferred_name: string | null;
    job_title: string | null;
    position: string | null;
    role: string | null;
    seniority_level: SeniorityLevel | null;
    employment_status: EmploymentStatus;
    employment_status_since: string | null;
    employment_type: EmploymentType;
    work_location: WorkLocation;
    availability_status: AvailabilityStatus;
    availability_note: string | null;
    work_email: string | null;
    work_phone: string | null;
    hire_date: string | null;
    probation_end_date: string | null;
    contract_end_date: string | null;
    notice_period_days: number | null;
    termination_date: string | null;
    termination_kind: TerminationKind | null;
    termination_reason: string | null;
    weekly_capacity_hours: string | null;
    target_utilization_percent: string | null;
    timezone: string | null;
    bio: string | null;
    responsibilities: string[];
    areas_of_expertise: string[];
    technical_stack: string[];
    directory_visible: boolean;
    department_team_id: string | null;
    primary_branch_id: string | null;
    manager_employee_id: string | null;
    archived_at: string | null;
    created_at: string;
    department: Ref | null;
    primary_branch: Ref | null;
    manager: { id: string; name: string } | null;
    membership: { id: string; status: string; user: PersonUser };
    /** Personal data (only with employees.personal_data.read or own record). */
    legal_first_name?: string | null;
    legal_last_name?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    nationality?: string | null;
    personal_email?: string | null;
    personal_phone?: string | null;
    national_id_number?: string | null;
    tax_id?: string | null;
    restricted_fields: string[];
    is_me: boolean;
}

export interface EmergencyContact {
    id: string;
    name: string;
    relationship: string | null;
    phone: string;
    email: string | null;
    is_primary: boolean;
}

export interface EmployeePosition {
    id: string;
    job_title: string;
    seniority_level: SeniorityLevel | null;
    employment_type: EmploymentType;
    effective_from: string;
    effective_to: string | null;
    reason: string;
    note: string | null;
    department: Ref | null;
    branch: Ref | null;
}

export interface CompensationComponent {
    id: string;
    kind: string;
    name: string;
    amount: string | null;
    percent_of_base: string | null;
    frequency: string;
}

export interface Compensation {
    id: string;
    effective_from: string;
    effective_to: string | null;
    employment_type: EmploymentType;
    pay_type: PayType;
    base_amount: string;
    currency: string;
    employer_cost_monthly: string | null;
    total_cost_monthly: string | null;
    cost_rate_hourly: string | null;
    billing_rate_default: string | null;
    contracted_weekly_hours: string | null;
    reason: string | null;
    components: CompensationComponent[];
}

export interface Equipment {
    id: string;
    asset_type: EquipmentType;
    name: string;
    serial_number: string | null;
    assigned_on: string;
    expected_return_on: string | null;
    returned_on: string | null;
    condition: EquipmentCondition;
    notes: string | null;
}

export interface EmployeeDocument {
    id: string;
    category: DocumentCategory;
    title: string;
    description: string | null;
    status: DocumentStatus;
    due_date: string | null;
    expires_on: string | null;
    employee_visible: boolean;
    is_confidential: boolean;
    created_at: string;
}

export interface HrNote {
    id: string;
    category: HrNoteCategory;
    visibility: HrNoteVisibility;
    severity: string | null;
    title: string | null;
    body: string;
    pinned: boolean;
    requires_acknowledgement: boolean;
    acknowledged_at: string | null;
    created_at: string;
    author: { id: string; user: PersonUser } | null;
}

export interface WorkScheduleDay {
    weekday: number;
    starts_at: string | null;
    ends_at: string | null;
    break_minutes: number;
    hours: string;
}

export interface WorkSchedule {
    id: string;
    name: string | null;
    schedule_type: string;
    effective_from: string;
    weekly_hours: string;
    days: WorkScheduleDay[];
}

export interface EmployeeDetail extends Employee {
    direct_reports: { id: string; name: string; job_title: string | null; photo_url: string | null }[];
    positions: EmployeePosition[];
    languages: { id: string; language: string; proficiency: LanguageProficiency; is_primary: boolean }[];
    work_schedules: WorkSchedule[];
    emergency_contacts?: EmergencyContact[];
    compensations?: Compensation[];
    documents?: EmployeeDocument[];
    hr_notes?: HrNote[];
    equipment?: Equipment[];
}

export interface DirectoryCard {
    id: string;
    name: string;
    photo_url: string | null;
    job_title?: string | null;
    work_email?: string | null;
    work_phone?: string | null;
    availability_status?: AvailabilityStatus;
    availability_note?: string | null;
    timezone?: string | null;
    department: Ref | null;
    primary_branch: Ref | null;
    skills: Ref[];
    is_me: boolean;
}

export interface OrgChartNode {
    id: string;
    name: string;
    job_title: string | null;
    manager_employee_id: string | null;
    availability_status: AvailabilityStatus;
    department: Ref | null;
    photo_url: string | null;
    is_me: boolean;
}

export interface MemberCandidate {
    id: string;
    status: string;
    job_title: string | null;
    user: PersonUser;
}

export interface ChangeRequest {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    changes: Record<string, { from: unknown; to: unknown }>;
    employee_note: string | null;
    decision_note: string | null;
    created_at: string;
    employee: { id: string; employee_number: string; name: string };
}

export interface Paginated<T> {
    data: T[];
    pagination: PaginationMeta & { has_next: boolean; has_prev: boolean };
}

export interface CreateEmployeeDto {
    membership_id?: string;
    new_hire?: { email: string; first_name: string; last_name: string };
    preferred_name?: string;
    job_title?: string;
    seniority_level?: SeniorityLevel;
    department_team_id?: string;
    primary_branch_id?: string;
    manager_employee_id?: string;
    employment_status?: EmploymentStatus;
    employment_type?: EmploymentType;
    work_location?: WorkLocation;
    hire_date?: string;
    probation_end_date?: string;
    work_email?: string;
    work_phone?: string;
    weekly_capacity_hours?: number;
    bio?: string;
}
export type UpdateEmployeeDto = Omit<CreateEmployeeDto, "membership_id" | "new_hire">;

export interface OffboardingDto {
    termination_date: string;
    termination_kind: TerminationKind;
    termination_reason?: string;
    rehire_eligible?: boolean;
}

export interface CompensationDto {
    effective_from: string;
    employment_type: EmploymentType;
    pay_type: PayType;
    base_amount: number;
    currency: string;
    cost_rate_hourly?: number;
    billing_rate_default?: number;
    contracted_weekly_hours?: number;
    reason?: string;
}

export interface EquipmentDto {
    asset_type: EquipmentType;
    name: string;
    serial_number?: string;
    assigned_on: string;
    condition?: EquipmentCondition;
    returned_on?: string;
}

export interface DocumentDto {
    category: DocumentCategory;
    title: string;
    description?: string;
    status?: DocumentStatus;
    due_date?: string;
    expires_on?: string;
    employee_visible?: boolean;
    is_confidential?: boolean;
}

export interface HrNoteDto {
    category?: HrNoteCategory;
    visibility?: HrNoteVisibility;
    title?: string;
    body: string;
    requires_acknowledgement?: boolean;
    pinned?: boolean;
}

export interface EmergencyContactDto {
    name: string;
    relationship?: string;
    phone: string;
    email?: string;
    is_primary?: boolean;
}

export interface WorkScheduleDto {
    effective_from: string;
    days: { weekday: number; starts_at?: string; ends_at?: string; break_minutes?: number; hours: number }[];
}
