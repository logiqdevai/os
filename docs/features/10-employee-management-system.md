# Employee Management System

> Linear: [LOG-107](https://linear.app/logiqdev/issue/LOG-107/employee-management-system) · Status: Backlog

> **Canonical for:** the Employee record and everything HR: employment details, compensation, skills, availability, leave, attendance, performance, employee documents, internal HR notes, directory, employee self-service, and **capacity and utilization** of the workforce.
>
> **Terminology (01 §80–81):** an **Employee** is an HR record. A **Member** is a User's access to the Organization. A contractor can be a Member without being an Employee. Identity, login, Teams, Departments and Branches belong to 01; this module links the Employee to the Member and owns employment data only.
>
> **Depends on:** [01](./01-users-organizations-permissions.md) (LOG-406) for Users, Members, Teams, Departments, Branches, branch business hours and holidays (01 §121–122), permissions and approval rights (01 §95) · [17 Documents](./17-documents-file-management.md) (LOG-407) for employee documents · [18 Time Tracking](./18-time-tracking.md) (LOG-408) for logged hours and utilization · [19 Calendar](./19-calendar.md) (LOG-409) for leave and availability projection · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for leave and onboarding workflows · [06 Tasks](./06-task-management.md) (LOG-102) for onboarding tasks.
>
> **Consumed by:** 05 Projects (§50–52, §67 resources and capacity), 06 Tasks (workload), 09 Income & Expense (payroll expense records), 12 Messaging (§62 employee identity), 18 Time Tracking (cost rates, working hours).

Develop a comprehensive **Employee Management System (HR & Workforce Management)** that enables agencies to manage their employees, organizational structure, availability, project assignments, performance, and day-to-day HR operations from a single platform.

The module should provide managers and administrators with complete visibility into employee information, workload, availability, and project participation while simplifying administrative processes and improving resource planning.

---

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md)) · `provider_webhook_events` (idempotent provider webhooks, [08](./08-financial-management-stripe-integration.md))

### Owned tables (43)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Settings** | | | |
| `EmployeeHrSettings` | `employee_hr_settings` | [L10011](../../api/prisma/schema.prisma#L10011) | 10 "Employee Self-Service", "Attendance & Working Hours", "Capacity & Workload", "Leave Management" — organization-wide HR configuration (one row per organiz… |
| **Employee** | | | |
| `Employee` | `employees` | [L10055](../../api/prisma/schema.prisma#L10055) | 10 "Employee Profiles", "Organization Structure", "Roles & Responsibilities", "Employee Availability", "Employee Directory" — the HR record, 1:1 with a Membe… |
| `EmployeeEmergencyContact` | `employee_emergency_contacts` | [L10183](../../api/prisma/schema.prisma#L10183) | 10 "Employee Profiles" — emergency contacts. |
| `EmployeePosition` | `employee_positions` | [L10204](../../api/prisma/schema.prisma#L10204) | 10 "Roles & Responsibilities", "Organization Structure" — effective-dated position history (title, department, branch, manager, seniority, employment type). … |
| **Compensation** | | | |
| `EmployeeCompensation` | `employee_compensations` | [L10238](../../api/prisma/schema.prisma#L10238) | 10 "Compensation" — effective-dated compensation record (01 §81 source of truth; 01 §60 field-level permission). cost_rate_hourly is consumed by 18 Time Trac… |
| `EmployeeCompensationComponent` | `employee_compensation_components` | [L10279](../../api/prisma/schema.prisma#L10279) | 10 "Compensation" — employer costs (social contributions, insurance, benefits), allowances and bonus / commission scheme lines. Either a fixed amount or a pe… |
| **Skills** | | | |
| `Skill` | `skills` | [L10306](../../api/prisma/schema.prisma#L10306) | 10 "Skills Management" — organization skill catalogue (technical skills, languages, frameworks, platforms, specializations). Searchable for project staffing. |
| `EmployeeSkill` | `employee_skills` | [L10334](../../api/prisma/schema.prisma#L10334) | 10 "Skills Management", "Roles & Responsibilities" — skill per employee with proficiency, experience and primary/secondary flag. |
| `EmployeeCertification` | `employee_certifications` | [L10359](../../api/prisma/schema.prisma#L10359) | 10 "Skills Management", "Employee Profiles" — certifications; the certificate file is a 17 Document. |
| `EmployeeTraining` | `employee_trainings` | [L10384](../../api/prisma/schema.prisma#L10384) | 10 "Skills Management" — professional training records. |
| `EmployeeLanguage` | `employee_languages` | [L10413](../../api/prisma/schema.prisma#L10413) | 10 "Employee Profiles" — spoken languages. |
| **Working hours & availability** | | | |
| `EmployeeWorkSchedule` | `employee_work_schedules` | [L10432](../../api/prisma/schema.prisma#L10432) | 10 "Attendance & Working Hours", "Capacity & Workload" — effective-dated working schedule (fixed, flexible or shift). Defines expected hours and therefore ca… |
| `EmployeeWorkScheduleDay` | `employee_work_schedule_days` | [L10455](../../api/prisma/schema.prisma#L10455) | 10 "Attendance & Working Hours" — one row per working weekday of a schedule. |
| `EmployeeAvailabilityEntry` | `employee_availability_entries` | [L10476](../../api/prisma/schema.prisma#L10476) | 10 "Employee Availability" — time-boxed availability states (remote day, training, business travel, busy, leave projection). Approved leave and holidays crea… |
| **Leave** | | | |
| `LeaveType` | `leave_types` | [L10505](../../api/prisma/schema.prisma#L10505) | 10 "Leave Management" — configurable leave types (vacation, sick, personal, maternity, paternity, unpaid, …). |
| `LeavePolicy` | `leave_policies` | [L10541](../../api/prisma/schema.prisma#L10541) | 10 "Leave Management" — entitlement and accrual rules for a leave type, optionally restricted to a branch (local law) or employment types. Assigned to employ… |
| `EmployeeLeavePolicy` | `employee_leave_policies` | [L10582](../../api/prisma/schema.prisma#L10582) | 10 "Leave Management" — explicit policy assignment per employee (overrides defaults). |
| `LeaveBalance` | `leave_balances` | [L10600](../../api/prisma/schema.prisma#L10600) | 10 "Leave Management" — balance per employee, leave type and balance period. available = entitled + accrued + carried_over + adjusted − used − pending. |
| `LeaveBalanceTransaction` | `leave_balance_transactions` | [L10631](../../api/prisma/schema.prisma#L10631) | 10 "Leave Management" — ledger of balance movements (accruals, usage, adjustments, carry-over, expiry). |
| `LeaveRequest` | `leave_requests` | [L10653](../../api/prisma/schema.prisma#L10653) | 10 "Leave Management" — a leave / time-off request with approval workflow (01 §95 approval right; 20 workflow), half-day support, conflict detection and cale… |
| `LeaveRequestDay` | `leave_request_days` | [L10709](../../api/prisma/schema.prisma#L10709) | 10 "Leave Management" — per-day breakdown of a request (half days, hours) for the leave calendar, team availability and capacity. |
| `LeaveRequestApproval` | `leave_request_approvals` | [L10724](../../api/prisma/schema.prisma#L10724) | 10 "Leave Management" — approval steps (manager, HR, custom chain from 20). |
| `CompanyHoliday` | `company_holidays` | [L10744](../../api/prisma/schema.prisma#L10744) | 10 "Leave Management" — organization-wide public and company holidays. Branch-specific holidays are BranchHoliday (01 §122); both reduce capacity and are pro… |
| **Attendance** | | | |
| `AttendanceRecord` | `attendance_records` | [L10769](../../api/prisma/schema.prisma#L10769) | 10 "Attendance & Working Hours" — one record per employee per calendar day aggregating clock sessions, breaks, overtime and lateness against the work schedul… |
| `AttendanceSession` | `attendance_sessions` | [L10808](../../api/prisma/schema.prisma#L10808) | 10 "Attendance & Working Hours" — a clock-in / clock-out pair; several per day are allowed. |
| `AttendanceBreak` | `attendance_breaks` | [L10831](../../api/prisma/schema.prisma#L10831) | 10 "Attendance & Working Hours" — breaks inside a session. |
| `AttendanceSummary` | `attendance_summaries` | [L10847](../../api/prisma/schema.prisma#L10847) | 10 "Attendance & Working Hours", "Dashboards & Reporting" — materialized weekly / monthly attendance summary per employee (recomputed by a scheduled job, 20). |
| **Capacity** | | | |
| `EmployeeCapacityPeriod` | `employee_capacity_periods` | [L10879](../../api/prisma/schema.prisma#L10879) | 10 "Capacity & Workload" — materialized capacity per employee and period: expected hours from the work schedule minus leave and holidays (owned here), with s… |
| **Performance** | | | |
| `PerformanceReviewCycle` | `performance_review_cycles` | [L10915](../../api/prisma/schema.prisma#L10915) | 10 "Performance Management" — a review cycle (e.g. "H1 2026") grouping reviews with a shared template. |
| `PerformanceReview` | `performance_reviews` | [L10941](../../api/prisma/schema.prisma#L10941) | 10 "Performance Management" — a performance review (self assessment + manager assessment + ratings). |
| `PerformanceGoal` | `performance_goals` | [L10999](../../api/prisma/schema.prisma#L10999) | 10 "Performance Management" — goals, objectives and key results (objective → key results via parent_goal_id), optionally tied to a review or a Project (05). |
| `PerformanceGoalUpdate` | `performance_goal_updates` | [L11043](../../api/prisma/schema.prisma#L11043) | 10 "Performance Management" — progress check-ins on a goal (ongoing tracking). |
| `PerformanceFeedback` | `performance_feedback` | [L11061](../../api/prisma/schema.prisma#L11061) | 10 "Performance Management" — manager feedback, employee (upward / self) feedback, peer feedback, performance notes, achievements and recognition history. Co… |
| `PerformanceImprovementPlan` | `performance_improvement_plans` | [L11098](../../api/prisma/schema.prisma#L11098) | 10 "Performance Management" — improvement plans (PIP) with check-ins and measurable items. |
| `PerformanceImprovementPlanItem` | `performance_improvement_plan_items` | [L11134](../../api/prisma/schema.prisma#L11134) | 10 "Performance Management" — measurable items of an improvement plan. |
| **Documents & notes** | | | |
| `EmployeeDocument` | `employee_documents` | [L11158](../../api/prisma/schema.prisma#L11158) | 10 "Employee Documents" — HR document index per employee (contracts, NDAs, IDs, signed agreements, HR forms). The file is a 17 Document (employee scope, 17 §… |
| `EmployeeHrNote` | `employee_hr_notes` | [L11203](../../api/prisma/schema.prisma#L11203) | 10 "Internal Notes" — private HR notes (performance observations, meeting notes, HR comments, warnings) with role-based visibility (01 §60). Kept separate fr… |
| **Self-service** | | | |
| `EmployeeProfileChangeRequest` | `employee_profile_change_requests` | [L11248](../../api/prisma/schema.prisma#L11248) | 10 "Employee Self-Service" — profile changes submitted by the employee that need HR approval (EmployeeHrSettings.profile_changes_require_approval). Direct ed… |
| `EmployeeEquipment` | `employee_equipment` | [L11292](../../api/prisma/schema.prisma#L11292) | 10 "Employee Profiles", "Roles & Responsibilities" — equipment and assets assigned to an employee (laptop, phone, access card). Open items (returned_on null)… |
| `PerformanceFeedbackRequest` | `performance_feedback_requests` | [L11341](../../api/prisma/schema.prisma#L11341) | 10 "Performance Management" — a request to a colleague for feedback about an employee (360 / peer feedback). The answer is a PerformanceFeedback row linked t… |
| `PerformanceCalibration` | `performance_calibrations` | [L11379](../../api/prisma/schema.prisma#L11379) | 10 "Performance Management" — a calibration adjustment of a review rating (cycle calibration session). The original rating is kept; the latest row per review… |
| `ProjectAllocationSkill` | `project_allocation_skills` | [L11402](../../api/prisma/schema.prisma#L11402) | 10 "Skills Management", "Project Assignments" — skills (and minimum proficiency) an open ProjectAllocation requires; drives the "Find people" staffing match … |
| `EmployeeImportJob` | `employee_import_jobs` | [L11432](../../api/prisma/schema.prisma#L11432) | 10 "Employee Directory" — a CSV / XLSX employee import (mapping, preview, per-row errors). Same shape as CrmImportJob (02) and TimeImportJob (18). |

**Owned enums (48):** `EmploymentStatus`, `EmploymentType`, `EmployeePayType`, `CompensationComponentKind`, `CompensationFrequency`, `EmployeeSeniorityLevel`, `EmployeePositionChangeReason`, `EmployeeWorkLocation`, `EmployeeAvailabilityStatus`, `EmployeeAvailabilitySource`, `EmployeeScheduleType`, `LeaveCategory`, `LeaveAccrualMethod`, `LeaveRequestStatus`, `LeaveDayPart`, `LeaveApprovalDecision`, `LeaveBalanceTransactionType`, `CompanyHolidayKind`, `AttendanceStatus`, `AttendanceSource`, `AttendanceBreakKind`, `EmployeePeriodType`, `EmployeeCapacityStatus`, `PerformanceReviewType`, `PerformanceReviewCycleStatus`, `PerformanceReviewStatus`, `PerformanceGoalKind`, `PerformanceGoalStatus`, `PerformanceFeedbackKind`, `PerformanceFeedbackVisibility`, `PerformanceImprovementPlanStatus`, `PerformanceImprovementItemStatus`, `SkillCategory`, `SkillProficiency`, `LanguageProficiency`, `EmployeeTrainingStatus`, `EmployeeDocumentCategory`, `EmployeeDocumentStatus`, `HrNoteCategory`, `HrNoteVisibility`, `HrNoteSeverity`, `EmployeeChangeRequestStatus`, `LeaveApproverStrategy`, `EmployeeEquipmentType`, `EmployeeEquipmentCondition`, `EmployeeTerminationKind`, `PerformanceFeedbackRequestStatus`, `EmployeeImportStatus`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Employee.primary_branch`, `EmployeePosition.branch`, `LeavePolicy.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Employee.membership`, `EmployeeHrNote.author`, `LeaveRequest.decided_by`, `LeaveRequestApproval.approver` +4 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `AttendanceRecord.organization`, `AttendanceSummary.organization`, `CompanyHoliday.organization`, `Employee.organization` +21 more |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `Employee.department`, `EmployeePosition.department` |
| [04](./04-contracts.md) | `Contract` (`contracts`) | `EmployeeDocument.contract` |
| [04](./04-contracts.md) | `SignatureRequest` (`signature_requests`) | `EmployeeDocument.signature_request` |
| [05](./05-project-management.md) | `Project` (`projects`) | `PerformanceFeedback.project`, `PerformanceGoal.project` |
| [05](./05-project-management.md) | `ProjectAllocation` (`project_allocations`) | `ProjectAllocationSkill.allocation` |

**Reused enums:** `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `Membership`, `Organization`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `LedgerRecord.employee_id` ([09](./09-income-expense-management.md), [L8755](../../api/prisma/schema.prisma#L8755)) — 10 Employee — related employee (employee expenses, payroll); id only.
- `PayrollSchedule.employee_id` ([09](./09-income-expense-management.md), [L9119](../../api/prisma/schema.prisma#L9119)) — 10 Employee; id only.
- `PayrollEntry.employee_id` ([09](./09-income-expense-management.md), [L9166](../../api/prisma/schema.prisma#L9166)) — 10 Employee; id only.
- `ExpenseClaim.employee_id` ([09](./09-income-expense-management.md), [L9539](../../api/prisma/schema.prisma#L9539)) — 10 Employee; id only.
- `WikiChecklistRun.employee_id` ([15](./15-notion-business-docs.md), [L17350](../../api/prisma/schema.prisma#L17350)) — Employees (10) Employee record of the subject; id only.
- `Folder.employee_id` ([17](./17-documents-file-management.md), [L18249](../../api/prisma/schema.prisma#L18249)) — 10 Employee for EMPLOYEE scope (HR documents); id only.
- `Document.employee_id` ([17](./17-documents-file-management.md), [L18324](../../api/prisma/schema.prisma#L18324)) — 10 Employee for EMPLOYEE scope (HR documents); id only.
- `TimeTrackingSettings.attendance_prefill_enabled` ([18](./18-time-tracking.md), [L19211](../../api/prisma/schema.prisma#L19211)) — Attendance (10) pre-fills the daily total (18 §9).
- `TimeTrackingSettings.default_expected_hours_per_week` ([18](./18-time-tracking.md), [L19211](../../api/prisma/schema.prisma#L19211)) — Fallback expected hours per week when 10 Employees has no working-hours record.
- `BillingRate.source_compensation_id` ([18](./18-time-tracking.md), [L19349](../../api/prisma/schema.prisma#L19349)) — 10 Employee compensation record this COST rate was synced from; id only.
- `TimeEntry.employee_id` ([18](./18-time-tracking.md), [L19396](../../api/prisma/schema.prisma#L19396)) — 10 Employee record of the member at the time of logging; id only.
- `TimeEntry.attendance_record_id` ([18](./18-time-tracking.md), [L19396](../../api/prisma/schema.prisma#L19396)) — Attendance record (10) that pre-filled this entry; id only.
- `CalendarAvailabilitySchedule.honor_holidays` ([19](./19-calendar.md), [L20509](../../api/prisma/schema.prisma#L20509)) — Respect branch holidays (01 §122) and approved leave (10) on top of the rules.
- `AutomationApprovalPolicy.delegate_when_out_of_office` ([20](./20-automation-engine.md), [L21714](../../api/prisma/schema.prisma#L21714)) — Route to the next approver of the policy while one is on leave (10) or has an out-of-office event (19).

<!-- schema-refs:end -->

<!-- access-channels:start -->

## Access channels & permissions

> Generated by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand. Standard: [Product Specification §4a](../Product_Specification.md). Rules: `.cursor/rules/roles-and-permissions-in-every-feature.mdc`.

Every capability of this module is built for **all access channels at once**. Each channel goes through the central authorization service ([01 §136](./01-users-organizations-permissions.md)) and the same permission keys, so roles and permissions exist from the first commit and are never added later.

| Channel | Required for this module |
| -- | -- |
| UI | Routes, navigation, buttons and fields gated by permission key; no-access state for `403`/`404` |
| REST API | One endpoint per resource action with `@RequirePermission`, organization taken from the credential, lists filtered by branch/team/project scope |
| MCP | A tool `<module>_<resource>_<action>` per agent-useful action, a thin adapter over the same service and validation, listed only to callers holding the key; sensitive tools need human confirmation when an AI agent calls them |
| API key / service account | Explicit permission keys and scope, never a human's full access; usable on every endpoint and MCP tool of this module; audit actor `SERVICE_ACCOUNT` |
| Webhooks and automation | Events, triggers and actions registered with [20](./20-automation-engine.md); automation runs as a service account or membership with the same checks |

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 38 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `employees.attendance` | read_own, read_all, record_own, manage* |
| `employees.availability` | manage |
| `employees.capacity` | read |
| `employees.compensation` | read*, manage* |
| `employees.directory` | read |
| `employees.documents` | read*, manage* |
| `employees.employees` | offboard*, import*, read, create, update, delete*, archive, export* |
| `employees.equipment` | read, manage |
| `employees.hr_notes` | read*, manage* |
| `employees.leave` | approve, read_own, read_all, request_own, manage_policies*, manage_balances* |
| `employees.performance` | read_own, read_all*, manage* |
| `employees.personal_data` | read*, manage* |
| `employees.profile` | update_own |
| `employees.settings` | manage* |
| `employees.skills` | read, manage |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## Employee Profiles

<!-- schema-section:start -->
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L10055)): `rehire_eligible` · `EmployeeCertification` ([employee_certifications](../../api/prisma/schema.prisma#L10359)) · `EmployeeEmergencyContact` ([employee_emergency_contacts](../../api/prisma/schema.prisma#L10183)) · `EmployeeEquipment` ([employee_equipment](../../api/prisma/schema.prisma#L11292)) · `EmployeeLanguage` ([employee_languages](../../api/prisma/schema.prisma#L10413)) · enum `EmployeeEquipmentCondition` ([L11282](../../api/prisma/schema.prisma#L11282)) · enum `EmployeeEquipmentType` ([L11272](../../api/prisma/schema.prisma#L11272)) · enum `EmployeeImportStatus` ([L11422](../../api/prisma/schema.prisma#L11422)) · enum `EmployeeTerminationKind` ([L11320](../../api/prisma/schema.prisma#L11320)) · enum `EmploymentStatus` ([L9613](../../api/prisma/schema.prisma#L9613)) · enum `EmploymentType` ([L9623](../../api/prisma/schema.prisma#L9623)) · enum `LanguageProficiency` ([L9928](../../api/prisma/schema.prisma#L9928))
<!-- schema-section:end -->

Maintain a complete profile for every employee including:

* Personal information
* Employee ID
* Job title
* Department
* Employment status
* Employment type
* Hire date
* Contact information
* Emergency contacts
* Profile photo
* Skills
* Certifications
* Languages
* Areas of expertise
* Technical stack
* Resume/CV
* Documents
* Internal notes


> **Sensitive personal data, equipment and termination.** Identity, tax, bank, date of birth, gender, personal contact, address and emergency contacts are field-level: read with `employees.personal_data.read`, written with `employees.personal_data.manage` (both sensitive); the API omits the properties and lists them in `restricted_fields[]`, and revealing a masked value writes the audit event `EMPLOYEE_SENSITIVE_FIELD_READ`. `EmployeeEquipment` records assets handed to an employee (`asset_type`, `serial_number`, `assigned_on`, `expected_return_on`, `returned_on`, `condition`, handover `document_id`); read with `employees.equipment.read`, managed with `employees.equipment.manage`. Offboarding stores a typed `Employee.termination_kind` (`EmployeeTerminationKind`) and `rehire_eligible` next to the free-text `termination_reason`; the exit interview is an `EmployeeHrNote` with category `EXIT_INTERVIEW`; starting and completing offboarding needs `employees.employees.offboard`.
---

## Organization Structure

<!-- schema-section:start -->
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L10055)) · `EmployeePosition` ([employee_positions](../../api/prisma/schema.prisma#L10204)) · enum `EmployeePositionChangeReason` ([L9671](../../api/prisma/schema.prisma#L9671))
<!-- schema-section:end -->

> Defined by → [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) §16–23 (Branches), §40–43 (Teams, Departments) · Linear LOG-406.

Teams, departments, branches and reporting lines are organization structure owned by 01. The Employee record references its primary branch, secondary branches, department, teams and manager (01 §35) and does not define them.

Employees should be easily searchable by team, department, branch, role, skills, or availability.

---

## Compensation

<!-- schema-section:start -->
> **Schema:** `EmployeeCompensation` ([employee_compensations](../../api/prisma/schema.prisma#L10238)) · `EmployeeCompensationComponent` ([employee_compensation_components](../../api/prisma/schema.prisma#L10279)) · enum `CompensationComponentKind` ([L9639](../../api/prisma/schema.prisma#L9639)) · enum `CompensationFrequency` ([L9650](../../api/prisma/schema.prisma#L9650)) · enum `EmployeePayType` ([L9631](../../api/prisma/schema.prisma#L9631)) · enum `EmploymentType` ([L9623](../../api/prisma/schema.prisma#L9623)) — other modules: `PayrollSchedule` ([payroll_schedules](../../api/prisma/schema.prisma#L9119)) ([09](./09-income-expense-management.md))
<!-- schema-section:end -->

Per 01 §81 the Employee Profile is the source of truth for compensation. This is sensitive, field-level permissioned data (01 §60).

Track:

* Employment type (full-time, part-time, contractor, intern)
* Pay type (monthly salary, hourly, daily, per project)
* Base compensation and currency
* Employer costs (social contributions, insurance, benefits)
* Bonus and commission schemes
* Effective-dated compensation history
* Cost rate for project costing (consumed by 18 Time Tracking)
* Billing rate default (consumed by 08 Finance and 18)

Payroll expense records (monthly payments, bonuses, reimbursements) are created in [09 Income & Expense](./09-income-expense-management.md) from this data. This module never records the expense itself.

---

## Roles & Responsibilities

<!-- schema-section:start -->
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L10055)): `responsibilities`, `role` · `EmployeeEquipment` ([employee_equipment](../../api/prisma/schema.prisma#L11292)) · `EmployeePosition` ([employee_positions](../../api/prisma/schema.prisma#L10204)) · `EmployeeSkill` ([employee_skills](../../api/prisma/schema.prisma#L10334)): `is_primary` · enum `EmployeePositionChangeReason` ([L9671](../../api/prisma/schema.prisma#L9671)) · enum `EmployeeSeniorityLevel` ([L9658](../../api/prisma/schema.prisma#L9658))
<!-- schema-section:end -->

Track employee responsibilities including:

* Position
* Role
* Seniority level
* Areas of responsibility
* Primary skills
* Secondary skills
* Technical expertise
* Certifications
* Project roles

Support assigning employees to multiple teams and multiple projects simultaneously.

---

## Employee Availability

<!-- schema-section:start -->
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L10055)) · `EmployeeAvailabilityEntry` ([employee_availability_entries](../../api/prisma/schema.prisma#L10476)) · enum `EmployeeAvailabilitySource` ([L9707](../../api/prisma/schema.prisma#L9707)) · enum `EmployeeAvailabilityStatus` ([L9693](../../api/prisma/schema.prisma#L9693))
<!-- schema-section:end -->

Provide real-time visibility into employee availability.

Track:

* Available
* Busy
* On leave
* Vacation
* Sick leave
* Public holiday
* Remote work
* Office attendance
* Training
* Business travel

Managers should always have an overview of workforce availability.

---

## Leave Management

<!-- schema-section:start -->
> **Schema:** `CompanyHoliday` ([company_holidays](../../api/prisma/schema.prisma#L10744)): `country_code` · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L10011)) · `EmployeeLeavePolicy` ([employee_leave_policies](../../api/prisma/schema.prisma#L10582)) · `LeaveBalance` ([leave_balances](../../api/prisma/schema.prisma#L10600)) · `LeaveBalanceTransaction` ([leave_balance_transactions](../../api/prisma/schema.prisma#L10631)) · `LeavePolicy` ([leave_policies](../../api/prisma/schema.prisma#L10541)) · `LeaveRequest` ([leave_requests](../../api/prisma/schema.prisma#L10653)) · `LeaveRequestApproval` ([leave_request_approvals](../../api/prisma/schema.prisma#L10724)) · `LeaveRequestDay` ([leave_request_days](../../api/prisma/schema.prisma#L10709)) · `LeaveType` ([leave_types](../../api/prisma/schema.prisma#L10505)) · enum `CompanyHolidayKind` ([L9782](../../api/prisma/schema.prisma#L9782)) · enum `LeaveAccrualMethod` ([L9739](../../api/prisma/schema.prisma#L9739)) · enum `LeaveApprovalDecision` ([L9764](../../api/prisma/schema.prisma#L9764)) · enum `LeaveApproverStrategy` ([L10000](../../api/prisma/schema.prisma#L10000)) · enum `LeaveBalanceTransactionType` ([L9772](../../api/prisma/schema.prisma#L9772)) · enum `LeaveCategory` ([L9724](../../api/prisma/schema.prisma#L9724)) · enum `LeaveDayPart` ([L9757](../../api/prisma/schema.prisma#L9757)) · enum `LeaveRequestStatus` ([L9747](../../api/prisma/schema.prisma#L9747))
<!-- schema-section:end -->

Support complete leave management including:

* Vacation requests
* Sick leave
* Personal leave
* Maternity leave
* Paternity leave
* Unpaid leave
* Public holidays
* Company holidays
* Half-day leave
* Time off requests

Features should include:

* Leave approval workflow
* Leave balances
* Leave calendar
* Leave history
* Upcoming leave
* Team availability during leave
* Automatic notifications (14)
* Conflict detection

Leave approval is an approval permission (01 §95) and a workflow in 20 Automation Engine. Approved leave is projected onto 19 Calendar and reduces capacity.


> **Holiday import.** "Import public holidays" copies a country's public holidays from a static dataset shipped with the product (no external provider) into `CompanyHoliday` with kind PUBLIC and `country_code`; it needs `employees.leave.manage_policies`. HR settings (working time, attendance, capacity, self-service, directory) are managed with `employees.settings.manage`.
---

## Attendance & Working Hours

<!-- schema-section:start -->
> **Schema:** `AttendanceBreak` ([attendance_breaks](../../api/prisma/schema.prisma#L10831)) · `AttendanceRecord` ([attendance_records](../../api/prisma/schema.prisma#L10769)) · `AttendanceSession` ([attendance_sessions](../../api/prisma/schema.prisma#L10808)) · `AttendanceSummary` ([attendance_summaries](../../api/prisma/schema.prisma#L10847)) · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L10011)): `attendance_required` · `EmployeeWorkSchedule` ([employee_work_schedules](../../api/prisma/schema.prisma#L10432)) · `EmployeeWorkScheduleDay` ([employee_work_schedule_days](../../api/prisma/schema.prisma#L10455)) · enum `AttendanceBreakKind` ([L9807](../../api/prisma/schema.prisma#L9807)) · enum `AttendanceSource` ([L9798](../../api/prisma/schema.prisma#L9798)) · enum `AttendanceStatus` ([L9788](../../api/prisma/schema.prisma#L9788)) · enum `EmployeePeriodType` ([L9813](../../api/prisma/schema.prisma#L9813)) · enum `EmployeeScheduleType` ([L9717](../../api/prisma/schema.prisma#L9717)) · enum `EmployeeWorkLocation` ([L9684](../../api/prisma/schema.prisma#L9684))
<!-- schema-section:end -->

Attendance (presence) is owned here. Work effort against projects and tasks is owned by [18 Time Tracking](./18-time-tracking.md); attendance may pre-fill the daily total but never replaces time entries.

Track employee attendance through:

* Working hours
* Clock-in
* Clock-out
* Breaks
* Overtime
* Flexible schedules
* Remote work
* Office attendance
* Attendance history
* Weekly summaries
* Monthly summaries

---

## Capacity & Workload

<!-- schema-section:start -->
> **Schema:** `EmployeeCapacityPeriod` ([employee_capacity_periods](../../api/prisma/schema.prisma#L10879)) · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L10011)): `target_utilization_percent` · `EmployeeWorkSchedule` ([employee_work_schedules](../../api/prisma/schema.prisma#L10432)) · enum `EmployeeCapacityStatus` ([L9820](../../api/prisma/schema.prisma#L9820)) · enum `EmployeePeriodType` ([L9813](../../api/prisma/schema.prisma#L9813))
<!-- schema-section:end -->

Ownership split (05 §51): this module owns **availability and capacity** (working hours, leave, holidays, expected hours). [05 Projects](./05-project-management.md) owns **planned allocation**. [18 Time Tracking](./18-time-tracking.md) owns **actuals** and computes utilization. [06 Tasks](./06-task-management.md) owns the **task distribution** view.

Provide managers with capacity planning tools including:

* Assigned projects
* Assigned tasks
* Estimated workload
* Current capacity
* Utilization percentage
* Available capacity
* Overloaded employees
* Underutilized employees
* Task distribution
* Resource allocation
* Team capacity planning

Support visual workload dashboards across teams and projects.

---

## Project Assignments

<!-- schema-section:start -->
> **Schema:** `ProjectAllocationSkill` ([project_allocation_skills](../../api/prisma/schema.prisma#L11402))
<!-- schema-section:end -->

> Defined by → [05 Project Management](./05-project-management.md) §8–9 (project roles and membership), §51 (allocation) · Linear LOG-405.

Project membership, project roles, participation dates and allocation are owned by 05. This module shows, on the Employee profile, the employee's current and historical project assignments and allocation across projects, read from 05.

---

## Performance Management

<!-- schema-section:start -->
> **Schema:** `PerformanceCalibration` ([performance_calibrations](../../api/prisma/schema.prisma#L11379)) · `PerformanceFeedback` ([performance_feedback](../../api/prisma/schema.prisma#L11061)) · `PerformanceFeedbackRequest` ([performance_feedback_requests](../../api/prisma/schema.prisma#L11341)) · `PerformanceGoal` ([performance_goals](../../api/prisma/schema.prisma#L10999)) · `PerformanceGoalUpdate` ([performance_goal_updates](../../api/prisma/schema.prisma#L11043)) · `PerformanceImprovementPlan` ([performance_improvement_plans](../../api/prisma/schema.prisma#L11098)) · `PerformanceImprovementPlanItem` ([performance_improvement_plan_items](../../api/prisma/schema.prisma#L11134)) · `PerformanceReview` ([performance_reviews](../../api/prisma/schema.prisma#L10941)) · `PerformanceReviewCycle` ([performance_review_cycles](../../api/prisma/schema.prisma#L10915)) · enum `PerformanceFeedbackKind` ([L9875](../../api/prisma/schema.prisma#L9875)) · enum `PerformanceFeedbackRequestStatus` ([L11331](../../api/prisma/schema.prisma#L11331)) · enum `PerformanceFeedbackVisibility` ([L9885](../../api/prisma/schema.prisma#L9885)) · enum `PerformanceGoalKind` ([L9857](../../api/prisma/schema.prisma#L9857)) · enum `PerformanceGoalStatus` ([L9864](../../api/prisma/schema.prisma#L9864)) · enum `PerformanceImprovementItemStatus` ([L9901](../../api/prisma/schema.prisma#L9901)) · enum `PerformanceImprovementPlanStatus` ([L9892](../../api/prisma/schema.prisma#L9892)) · enum `PerformanceReviewCycleStatus` ([L9838](../../api/prisma/schema.prisma#L9838)) · enum `PerformanceReviewStatus` ([L9846](../../api/prisma/schema.prisma#L9846)) · enum `PerformanceReviewType` ([L9827](../../api/prisma/schema.prisma#L9827))
<!-- schema-section:end -->

Maintain employee performance records including:

* Performance reviews
* Goals
* Objectives
* Achievements
* Manager feedback
* Employee feedback
* Performance notes
* Improvement plans
* Recognition history

Support ongoing performance tracking instead of annual reviews only.


> **360 feedback requests and calibration.** Asking a colleague for feedback creates a `PerformanceFeedbackRequest` (`requested_from_membership_id`, `due_date`, optional `review_id` / `cycle_id`, `is_anonymous`) with `employees.performance.manage`; the requested person answers with `employees.performance.read_own`, which writes a `PerformanceFeedback` linked by `feedback_id` and sets the request to SUBMITTED (or DECLINED / EXPIRED / CANCELLED). A calibration session adjusts ratings with `PerformanceCalibration` rows (`original_rating`, `calibrated_rating`, `reason`); the original rating is kept and the latest row per review is written back to `PerformanceReview.overall_rating`.
---

## Skills Management

<!-- schema-section:start -->
> **Schema:** `EmployeeCertification` ([employee_certifications](../../api/prisma/schema.prisma#L10359)) · `EmployeeSkill` ([employee_skills](../../api/prisma/schema.prisma#L10334)) · `EmployeeTraining` ([employee_trainings](../../api/prisma/schema.prisma#L10384)) · `ProjectAllocationSkill` ([project_allocation_skills](../../api/prisma/schema.prisma#L11402)) · `Skill` ([skills](../../api/prisma/schema.prisma#L10306)) · enum `EmployeeTrainingStatus` ([L9937](../../api/prisma/schema.prisma#L9937)) · enum `SkillCategory` ([L9908](../../api/prisma/schema.prisma#L9908)) · enum `SkillProficiency` ([L9920](../../api/prisma/schema.prisma#L9920))
<!-- schema-section:end -->

Track employee capabilities including:

* Technical skills
* Programming languages
* Frameworks
* Platforms
* Certifications
* Professional training
* Experience level
* Skill proficiency
* Areas of specialization

Support searching employees by skill to assist with project staffing.


> **Required skills per allocation.** An open `ProjectAllocation` (05) can carry `ProjectAllocationSkill` rows (`skill_id`, `min_proficiency`, `is_required`); "Find people" matches them against `EmployeeSkill`, availability and capacity. The rows are written by whoever manages the project allocation (05) and read by 10 with `employees.skills.read`.
---

## Employee Documents

<!-- schema-section:start -->
> **Schema:** `EmployeeDocument` ([employee_documents](../../api/prisma/schema.prisma#L11158)) · enum `EmployeeDocumentCategory` ([L9945](../../api/prisma/schema.prisma#L9945)) · enum `EmployeeDocumentStatus` ([L9957](../../api/prisma/schema.prisma#L9957))
<!-- schema-section:end -->

> Storage defined by → [17 Documents & File Management](./17-documents-file-management.md) (employee scope, 17 §3) · Linear LOG-407. Employment and contractor agreements may also be Contracts (04).

Maintain secure employee documentation including:

* Employment contracts
* NDAs
* Certifications
* Identification documents
* Signed agreements
* HR forms
* Uploaded files

---

## Internal Notes

<!-- schema-section:start -->
> **Schema:** `EmployeeHrNote` ([employee_hr_notes](../../api/prisma/schema.prisma#L11203)) · enum `HrNoteCategory` ([L9967](../../api/prisma/schema.prisma#L9967)) · enum `HrNoteSeverity` ([L9984](../../api/prisma/schema.prisma#L9984)) · enum `HrNoteVisibility` ([L9977](../../api/prisma/schema.prisma#L9977))
<!-- schema-section:end -->

Allow managers and HR personnel to maintain private employee notes including:

* Performance observations
* Meeting notes
* HR comments
* Warnings

Visibility should be controlled through role-based permissions.

---

## Employee Directory

<!-- schema-section:start -->
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L10055)): `directory_visible` · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L10011)): `directory_visible_fields` · `EmployeeImportJob` ([employee_import_jobs](../../api/prisma/schema.prisma#L11432)) · enum `EmployeeImportStatus` ([L11422](../../api/prisma/schema.prisma#L11422))
<!-- schema-section:end -->

Provide a searchable company directory including:

* Profile photos
* Contact information
* Department
* Team
* Position
* Skills
* Current availability
* Active projects


> **Bulk import.** Importing employees from CSV / XLSX is an `EmployeeImportJob` (`status` PENDING, VALIDATING, PREVIEW, IMPORTING, COMPLETED, FAILED; `mapping`, row counters, `errors`, `error_report_document_id`) and needs `employees.employees.import`; imported identity and bank columns additionally need `employees.personal_data.manage`.
---

## Notifications

<!-- schema-section:start -->
> **Schema:** `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L10011)): `notify_birthdays`
<!-- schema-section:end -->

> Engine defined by → [14 Notifications & Activity Center](./14-notifications-activity-center.md) · Linear LOG-403. This module only emits events.

Events emitted:

* Leave approvals
* Leave requests
* Project assignments
* Task assignments
* Upcoming holidays
* Performance reviews
* Document requests
* Company announcements
* Team updates
* Employee anniversaries
* Birthdays

Channels and preferences are configured in 14.

---

## Dashboards & Reporting

<!-- schema-section:start -->
> **Schema:** `AttendanceSummary` ([attendance_summaries](../../api/prisma/schema.prisma#L10847))
<!-- schema-section:end -->

Provide HR and management dashboards displaying:

* Total employees
* Employees by department
* Team sizes
* Employee availability
* Vacation calendar
* Leave balances
* Attendance summaries
* Resource utilization
* Project allocation
* Workload distribution
* Employee growth
* Performance overview

Support exporting reports in:

* PDF
* Excel
* CSV

---

## Employee Self-Service

<!-- schema-section:start -->
> **Schema:** `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L10011)): `self_service_editable_fields` · `EmployeeProfileChangeRequest` ([employee_profile_change_requests](../../api/prisma/schema.prisma#L11248)) · enum `EmployeeChangeRequestStatus` ([L9992](../../api/prisma/schema.prisma#L9992))
<!-- schema-section:end -->

Allow employees to manage their own information through a self-service portal.

Employees should be able to:

* Update profile information
* View assigned projects
* View assigned tasks
* View workload
* Request vacation
* Request leave
* View leave balances
* Access HR documents
* Download employment documents
* View company announcements
* Update notification preferences

---

## AI Workforce Assistant

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Integrate AI throughout the Employee Management System to assist managers and administrators.

AI should be capable of:

* Summarizing employee workload
* Identifying overloaded team members
* Recommending project assignments based on skills and availability
* Detecting resource shortages
* Suggesting workload balancing
* Generating performance summaries
* Creating employee reports
* Answering HR-related questions
* Assisting with workforce planning
* Generating management summaries
* Providing insights into team productivity and resource utilization

The Employee Management System should function as a complete workforce management solution, providing agencies with centralized employee information, resource planning, leave management, performance tracking, and AI-powered workforce insights while integrating seamlessly with project management and operational workflows.
