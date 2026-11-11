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
| `EmployeeHrSettings` | `employee_hr_settings` | [L9973](../../api/prisma/schema.prisma#L9973) | 10 "Employee Self-Service", "Attendance & Working Hours", "Capacity & Workload", "Leave Management" — organization-wide HR configuration (one row per organiz… |
| **Employee** | | | |
| `Employee` | `employees` | [L10017](../../api/prisma/schema.prisma#L10017) | 10 "Employee Profiles", "Organization Structure", "Roles & Responsibilities", "Employee Availability", "Employee Directory" — the HR record, 1:1 with a Membe… |
| `EmployeeEmergencyContact` | `employee_emergency_contacts` | [L10145](../../api/prisma/schema.prisma#L10145) | 10 "Employee Profiles" — emergency contacts. |
| `EmployeePosition` | `employee_positions` | [L10166](../../api/prisma/schema.prisma#L10166) | 10 "Roles & Responsibilities", "Organization Structure" — effective-dated position history (title, department, branch, manager, seniority, employment type). … |
| **Compensation** | | | |
| `EmployeeCompensation` | `employee_compensations` | [L10200](../../api/prisma/schema.prisma#L10200) | 10 "Compensation" — effective-dated compensation record (01 §81 source of truth; 01 §60 field-level permission). cost_rate_hourly is consumed by 18 Time Trac… |
| `EmployeeCompensationComponent` | `employee_compensation_components` | [L10241](../../api/prisma/schema.prisma#L10241) | 10 "Compensation" — employer costs (social contributions, insurance, benefits), allowances and bonus / commission scheme lines. Either a fixed amount or a pe… |
| **Skills** | | | |
| `Skill` | `skills` | [L10268](../../api/prisma/schema.prisma#L10268) | 10 "Skills Management" — organization skill catalogue (technical skills, languages, frameworks, platforms, specializations). Searchable for project staffing. |
| `EmployeeSkill` | `employee_skills` | [L10296](../../api/prisma/schema.prisma#L10296) | 10 "Skills Management", "Roles & Responsibilities" — skill per employee with proficiency, experience and primary/secondary flag. |
| `EmployeeCertification` | `employee_certifications` | [L10321](../../api/prisma/schema.prisma#L10321) | 10 "Skills Management", "Employee Profiles" — certifications; the certificate file is a 17 Document. |
| `EmployeeTraining` | `employee_trainings` | [L10346](../../api/prisma/schema.prisma#L10346) | 10 "Skills Management" — professional training records. |
| `EmployeeLanguage` | `employee_languages` | [L10375](../../api/prisma/schema.prisma#L10375) | 10 "Employee Profiles" — spoken languages. |
| **Working hours & availability** | | | |
| `EmployeeWorkSchedule` | `employee_work_schedules` | [L10394](../../api/prisma/schema.prisma#L10394) | 10 "Attendance & Working Hours", "Capacity & Workload" — effective-dated working schedule (fixed, flexible or shift). Defines expected hours and therefore ca… |
| `EmployeeWorkScheduleDay` | `employee_work_schedule_days` | [L10417](../../api/prisma/schema.prisma#L10417) | 10 "Attendance & Working Hours" — one row per working weekday of a schedule. |
| `EmployeeAvailabilityEntry` | `employee_availability_entries` | [L10438](../../api/prisma/schema.prisma#L10438) | 10 "Employee Availability" — time-boxed availability states (remote day, training, business travel, busy, leave projection). Approved leave and holidays crea… |
| **Leave** | | | |
| `LeaveType` | `leave_types` | [L10467](../../api/prisma/schema.prisma#L10467) | 10 "Leave Management" — configurable leave types (vacation, sick, personal, maternity, paternity, unpaid, …). |
| `LeavePolicy` | `leave_policies` | [L10503](../../api/prisma/schema.prisma#L10503) | 10 "Leave Management" — entitlement and accrual rules for a leave type, optionally restricted to a branch (local law) or employment types. Assigned to employ… |
| `EmployeeLeavePolicy` | `employee_leave_policies` | [L10544](../../api/prisma/schema.prisma#L10544) | 10 "Leave Management" — explicit policy assignment per employee (overrides defaults). |
| `LeaveBalance` | `leave_balances` | [L10562](../../api/prisma/schema.prisma#L10562) | 10 "Leave Management" — balance per employee, leave type and balance period. available = entitled + accrued + carried_over + adjusted − used − pending. |
| `LeaveBalanceTransaction` | `leave_balance_transactions` | [L10593](../../api/prisma/schema.prisma#L10593) | 10 "Leave Management" — ledger of balance movements (accruals, usage, adjustments, carry-over, expiry). |
| `LeaveRequest` | `leave_requests` | [L10615](../../api/prisma/schema.prisma#L10615) | 10 "Leave Management" — a leave / time-off request with approval workflow (01 §95 approval right; 20 workflow), half-day support, conflict detection and cale… |
| `LeaveRequestDay` | `leave_request_days` | [L10671](../../api/prisma/schema.prisma#L10671) | 10 "Leave Management" — per-day breakdown of a request (half days, hours) for the leave calendar, team availability and capacity. |
| `LeaveRequestApproval` | `leave_request_approvals` | [L10686](../../api/prisma/schema.prisma#L10686) | 10 "Leave Management" — approval steps (manager, HR, custom chain from 20). |
| `CompanyHoliday` | `company_holidays` | [L10706](../../api/prisma/schema.prisma#L10706) | 10 "Leave Management" — organization-wide public and company holidays. Branch-specific holidays are BranchHoliday (01 §122); both reduce capacity and are pro… |
| **Attendance** | | | |
| `AttendanceRecord` | `attendance_records` | [L10731](../../api/prisma/schema.prisma#L10731) | 10 "Attendance & Working Hours" — one record per employee per calendar day aggregating clock sessions, breaks, overtime and lateness against the work schedul… |
| `AttendanceSession` | `attendance_sessions` | [L10770](../../api/prisma/schema.prisma#L10770) | 10 "Attendance & Working Hours" — a clock-in / clock-out pair; several per day are allowed. |
| `AttendanceBreak` | `attendance_breaks` | [L10793](../../api/prisma/schema.prisma#L10793) | 10 "Attendance & Working Hours" — breaks inside a session. |
| `AttendanceSummary` | `attendance_summaries` | [L10809](../../api/prisma/schema.prisma#L10809) | 10 "Attendance & Working Hours", "Dashboards & Reporting" — materialized weekly / monthly attendance summary per employee (recomputed by a scheduled job, 20). |
| **Capacity** | | | |
| `EmployeeCapacityPeriod` | `employee_capacity_periods` | [L10841](../../api/prisma/schema.prisma#L10841) | 10 "Capacity & Workload" — materialized capacity per employee and period: expected hours from the work schedule minus leave and holidays (owned here), with s… |
| **Performance** | | | |
| `PerformanceReviewCycle` | `performance_review_cycles` | [L10877](../../api/prisma/schema.prisma#L10877) | 10 "Performance Management" — a review cycle (e.g. "H1 2026") grouping reviews with a shared template. |
| `PerformanceReview` | `performance_reviews` | [L10903](../../api/prisma/schema.prisma#L10903) | 10 "Performance Management" — a performance review (self assessment + manager assessment + ratings). |
| `PerformanceGoal` | `performance_goals` | [L10961](../../api/prisma/schema.prisma#L10961) | 10 "Performance Management" — goals, objectives and key results (objective → key results via parent_goal_id), optionally tied to a review or a Project (05). |
| `PerformanceGoalUpdate` | `performance_goal_updates` | [L11005](../../api/prisma/schema.prisma#L11005) | 10 "Performance Management" — progress check-ins on a goal (ongoing tracking). |
| `PerformanceFeedback` | `performance_feedback` | [L11023](../../api/prisma/schema.prisma#L11023) | 10 "Performance Management" — manager feedback, employee (upward / self) feedback, peer feedback, performance notes, achievements and recognition history. Co… |
| `PerformanceImprovementPlan` | `performance_improvement_plans` | [L11060](../../api/prisma/schema.prisma#L11060) | 10 "Performance Management" — improvement plans (PIP) with check-ins and measurable items. |
| `PerformanceImprovementPlanItem` | `performance_improvement_plan_items` | [L11096](../../api/prisma/schema.prisma#L11096) | 10 "Performance Management" — measurable items of an improvement plan. |
| **Documents & notes** | | | |
| `EmployeeDocument` | `employee_documents` | [L11120](../../api/prisma/schema.prisma#L11120) | 10 "Employee Documents" — HR document index per employee (contracts, NDAs, IDs, signed agreements, HR forms). The file is a 17 Document (employee scope, 17 §… |
| `EmployeeHrNote` | `employee_hr_notes` | [L11165](../../api/prisma/schema.prisma#L11165) | 10 "Internal Notes" — private HR notes (performance observations, meeting notes, HR comments, warnings) with role-based visibility (01 §60). Kept separate fr… |
| **Self-service** | | | |
| `EmployeeProfileChangeRequest` | `employee_profile_change_requests` | [L11210](../../api/prisma/schema.prisma#L11210) | 10 "Employee Self-Service" — profile changes submitted by the employee that need HR approval (EmployeeHrSettings.profile_changes_require_approval). Direct ed… |
| `EmployeeEquipment` | `employee_equipment` | [L11254](../../api/prisma/schema.prisma#L11254) | 10 "Employee Profiles", "Roles & Responsibilities" — equipment and assets assigned to an employee (laptop, phone, access card). Open items (returned_on null)… |
| `PerformanceFeedbackRequest` | `performance_feedback_requests` | [L11303](../../api/prisma/schema.prisma#L11303) | 10 "Performance Management" — a request to a colleague for feedback about an employee (360 / peer feedback). The answer is a PerformanceFeedback row linked t… |
| `PerformanceCalibration` | `performance_calibrations` | [L11341](../../api/prisma/schema.prisma#L11341) | 10 "Performance Management" — a calibration adjustment of a review rating (cycle calibration session). The original rating is kept; the latest row per review… |
| `ProjectAllocationSkill` | `project_allocation_skills` | [L11364](../../api/prisma/schema.prisma#L11364) | 10 "Skills Management", "Project Assignments" — skills (and minimum proficiency) an open ProjectAllocation requires; drives the "Find people" staffing match … |
| `EmployeeImportJob` | `employee_import_jobs` | [L11394](../../api/prisma/schema.prisma#L11394) | 10 "Employee Directory" — a CSV / XLSX employee import (mapping, preview, per-row errors). Same shape as CrmImportJob (02) and TimeImportJob (18). |

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

- `LedgerRecord.employee_id` ([09](./09-income-expense-management.md), [L8717](../../api/prisma/schema.prisma#L8717)) — 10 Employee — related employee (employee expenses, payroll); id only.
- `PayrollSchedule.employee_id` ([09](./09-income-expense-management.md), [L9081](../../api/prisma/schema.prisma#L9081)) — 10 Employee; id only.
- `PayrollEntry.employee_id` ([09](./09-income-expense-management.md), [L9128](../../api/prisma/schema.prisma#L9128)) — 10 Employee; id only.
- `ExpenseClaim.employee_id` ([09](./09-income-expense-management.md), [L9501](../../api/prisma/schema.prisma#L9501)) — 10 Employee; id only.
- `WikiChecklistRun.employee_id` ([15](./15-notion-business-docs.md), [L17297](../../api/prisma/schema.prisma#L17297)) — Employees (10) Employee record of the subject; id only.
- `Folder.employee_id` ([17](./17-documents-file-management.md), [L18196](../../api/prisma/schema.prisma#L18196)) — 10 Employee for EMPLOYEE scope (HR documents); id only.
- `Document.employee_id` ([17](./17-documents-file-management.md), [L18271](../../api/prisma/schema.prisma#L18271)) — 10 Employee for EMPLOYEE scope (HR documents); id only.
- `TimeTrackingSettings.attendance_prefill_enabled` ([18](./18-time-tracking.md), [L19158](../../api/prisma/schema.prisma#L19158)) — Attendance (10) pre-fills the daily total (18 §9).
- `TimeTrackingSettings.default_expected_hours_per_week` ([18](./18-time-tracking.md), [L19158](../../api/prisma/schema.prisma#L19158)) — Fallback expected hours per week when 10 Employees has no working-hours record.
- `BillingRate.source_compensation_id` ([18](./18-time-tracking.md), [L19296](../../api/prisma/schema.prisma#L19296)) — 10 Employee compensation record this COST rate was synced from; id only.
- `TimeEntry.employee_id` ([18](./18-time-tracking.md), [L19343](../../api/prisma/schema.prisma#L19343)) — 10 Employee record of the member at the time of logging; id only.
- `TimeEntry.attendance_record_id` ([18](./18-time-tracking.md), [L19343](../../api/prisma/schema.prisma#L19343)) — Attendance record (10) that pre-filled this entry; id only.
- `CalendarAvailabilitySchedule.honor_holidays` ([19](./19-calendar.md), [L20456](../../api/prisma/schema.prisma#L20456)) — Respect branch holidays (01 §122) and approved leave (10) on top of the rules.
- `AutomationApprovalPolicy.delegate_when_out_of_office` ([20](./20-automation-engine.md), [L21661](../../api/prisma/schema.prisma#L21661)) — Route to the next approver of the policy while one is on leave (10) or has an out-of-office event (19).

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
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L10017)): `rehire_eligible` · `EmployeeCertification` ([employee_certifications](../../api/prisma/schema.prisma#L10321)) · `EmployeeEmergencyContact` ([employee_emergency_contacts](../../api/prisma/schema.prisma#L10145)) · `EmployeeEquipment` ([employee_equipment](../../api/prisma/schema.prisma#L11254)) · `EmployeeLanguage` ([employee_languages](../../api/prisma/schema.prisma#L10375)) · enum `EmployeeEquipmentCondition` ([L11244](../../api/prisma/schema.prisma#L11244)) · enum `EmployeeEquipmentType` ([L11234](../../api/prisma/schema.prisma#L11234)) · enum `EmployeeImportStatus` ([L11384](../../api/prisma/schema.prisma#L11384)) · enum `EmployeeTerminationKind` ([L11282](../../api/prisma/schema.prisma#L11282)) · enum `EmploymentStatus` ([L9575](../../api/prisma/schema.prisma#L9575)) · enum `EmploymentType` ([L9585](../../api/prisma/schema.prisma#L9585)) · enum `LanguageProficiency` ([L9890](../../api/prisma/schema.prisma#L9890))
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
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L10017)) · `EmployeePosition` ([employee_positions](../../api/prisma/schema.prisma#L10166)) · enum `EmployeePositionChangeReason` ([L9633](../../api/prisma/schema.prisma#L9633))
<!-- schema-section:end -->

> Defined by → [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) §16–23 (Branches), §40–43 (Teams, Departments) · Linear LOG-406.

Teams, departments, branches and reporting lines are organization structure owned by 01. The Employee record references its primary branch, secondary branches, department, teams and manager (01 §35) and does not define them.

Employees should be easily searchable by team, department, branch, role, skills, or availability.

---

## Compensation

<!-- schema-section:start -->
> **Schema:** `EmployeeCompensation` ([employee_compensations](../../api/prisma/schema.prisma#L10200)) · `EmployeeCompensationComponent` ([employee_compensation_components](../../api/prisma/schema.prisma#L10241)) · enum `CompensationComponentKind` ([L9601](../../api/prisma/schema.prisma#L9601)) · enum `CompensationFrequency` ([L9612](../../api/prisma/schema.prisma#L9612)) · enum `EmployeePayType` ([L9593](../../api/prisma/schema.prisma#L9593)) · enum `EmploymentType` ([L9585](../../api/prisma/schema.prisma#L9585)) — other modules: `PayrollSchedule` ([payroll_schedules](../../api/prisma/schema.prisma#L9081)) ([09](./09-income-expense-management.md))
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
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L10017)): `responsibilities`, `role` · `EmployeeEquipment` ([employee_equipment](../../api/prisma/schema.prisma#L11254)) · `EmployeePosition` ([employee_positions](../../api/prisma/schema.prisma#L10166)) · `EmployeeSkill` ([employee_skills](../../api/prisma/schema.prisma#L10296)): `is_primary` · enum `EmployeePositionChangeReason` ([L9633](../../api/prisma/schema.prisma#L9633)) · enum `EmployeeSeniorityLevel` ([L9620](../../api/prisma/schema.prisma#L9620))
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
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L10017)) · `EmployeeAvailabilityEntry` ([employee_availability_entries](../../api/prisma/schema.prisma#L10438)) · enum `EmployeeAvailabilitySource` ([L9669](../../api/prisma/schema.prisma#L9669)) · enum `EmployeeAvailabilityStatus` ([L9655](../../api/prisma/schema.prisma#L9655))
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
> **Schema:** `CompanyHoliday` ([company_holidays](../../api/prisma/schema.prisma#L10706)): `country_code` · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L9973)) · `EmployeeLeavePolicy` ([employee_leave_policies](../../api/prisma/schema.prisma#L10544)) · `LeaveBalance` ([leave_balances](../../api/prisma/schema.prisma#L10562)) · `LeaveBalanceTransaction` ([leave_balance_transactions](../../api/prisma/schema.prisma#L10593)) · `LeavePolicy` ([leave_policies](../../api/prisma/schema.prisma#L10503)) · `LeaveRequest` ([leave_requests](../../api/prisma/schema.prisma#L10615)) · `LeaveRequestApproval` ([leave_request_approvals](../../api/prisma/schema.prisma#L10686)) · `LeaveRequestDay` ([leave_request_days](../../api/prisma/schema.prisma#L10671)) · `LeaveType` ([leave_types](../../api/prisma/schema.prisma#L10467)) · enum `CompanyHolidayKind` ([L9744](../../api/prisma/schema.prisma#L9744)) · enum `LeaveAccrualMethod` ([L9701](../../api/prisma/schema.prisma#L9701)) · enum `LeaveApprovalDecision` ([L9726](../../api/prisma/schema.prisma#L9726)) · enum `LeaveApproverStrategy` ([L9962](../../api/prisma/schema.prisma#L9962)) · enum `LeaveBalanceTransactionType` ([L9734](../../api/prisma/schema.prisma#L9734)) · enum `LeaveCategory` ([L9686](../../api/prisma/schema.prisma#L9686)) · enum `LeaveDayPart` ([L9719](../../api/prisma/schema.prisma#L9719)) · enum `LeaveRequestStatus` ([L9709](../../api/prisma/schema.prisma#L9709))
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
> **Schema:** `AttendanceBreak` ([attendance_breaks](../../api/prisma/schema.prisma#L10793)) · `AttendanceRecord` ([attendance_records](../../api/prisma/schema.prisma#L10731)) · `AttendanceSession` ([attendance_sessions](../../api/prisma/schema.prisma#L10770)) · `AttendanceSummary` ([attendance_summaries](../../api/prisma/schema.prisma#L10809)) · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L9973)): `attendance_required` · `EmployeeWorkSchedule` ([employee_work_schedules](../../api/prisma/schema.prisma#L10394)) · `EmployeeWorkScheduleDay` ([employee_work_schedule_days](../../api/prisma/schema.prisma#L10417)) · enum `AttendanceBreakKind` ([L9769](../../api/prisma/schema.prisma#L9769)) · enum `AttendanceSource` ([L9760](../../api/prisma/schema.prisma#L9760)) · enum `AttendanceStatus` ([L9750](../../api/prisma/schema.prisma#L9750)) · enum `EmployeePeriodType` ([L9775](../../api/prisma/schema.prisma#L9775)) · enum `EmployeeScheduleType` ([L9679](../../api/prisma/schema.prisma#L9679)) · enum `EmployeeWorkLocation` ([L9646](../../api/prisma/schema.prisma#L9646))
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
> **Schema:** `EmployeeCapacityPeriod` ([employee_capacity_periods](../../api/prisma/schema.prisma#L10841)) · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L9973)): `target_utilization_percent` · `EmployeeWorkSchedule` ([employee_work_schedules](../../api/prisma/schema.prisma#L10394)) · enum `EmployeeCapacityStatus` ([L9782](../../api/prisma/schema.prisma#L9782)) · enum `EmployeePeriodType` ([L9775](../../api/prisma/schema.prisma#L9775))
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
> **Schema:** `ProjectAllocationSkill` ([project_allocation_skills](../../api/prisma/schema.prisma#L11364))
<!-- schema-section:end -->

> Defined by → [05 Project Management](./05-project-management.md) §8–9 (project roles and membership), §51 (allocation) · Linear LOG-405.

Project membership, project roles, participation dates and allocation are owned by 05. This module shows, on the Employee profile, the employee's current and historical project assignments and allocation across projects, read from 05.

---

## Performance Management

<!-- schema-section:start -->
> **Schema:** `PerformanceCalibration` ([performance_calibrations](../../api/prisma/schema.prisma#L11341)) · `PerformanceFeedback` ([performance_feedback](../../api/prisma/schema.prisma#L11023)) · `PerformanceFeedbackRequest` ([performance_feedback_requests](../../api/prisma/schema.prisma#L11303)) · `PerformanceGoal` ([performance_goals](../../api/prisma/schema.prisma#L10961)) · `PerformanceGoalUpdate` ([performance_goal_updates](../../api/prisma/schema.prisma#L11005)) · `PerformanceImprovementPlan` ([performance_improvement_plans](../../api/prisma/schema.prisma#L11060)) · `PerformanceImprovementPlanItem` ([performance_improvement_plan_items](../../api/prisma/schema.prisma#L11096)) · `PerformanceReview` ([performance_reviews](../../api/prisma/schema.prisma#L10903)) · `PerformanceReviewCycle` ([performance_review_cycles](../../api/prisma/schema.prisma#L10877)) · enum `PerformanceFeedbackKind` ([L9837](../../api/prisma/schema.prisma#L9837)) · enum `PerformanceFeedbackRequestStatus` ([L11293](../../api/prisma/schema.prisma#L11293)) · enum `PerformanceFeedbackVisibility` ([L9847](../../api/prisma/schema.prisma#L9847)) · enum `PerformanceGoalKind` ([L9819](../../api/prisma/schema.prisma#L9819)) · enum `PerformanceGoalStatus` ([L9826](../../api/prisma/schema.prisma#L9826)) · enum `PerformanceImprovementItemStatus` ([L9863](../../api/prisma/schema.prisma#L9863)) · enum `PerformanceImprovementPlanStatus` ([L9854](../../api/prisma/schema.prisma#L9854)) · enum `PerformanceReviewCycleStatus` ([L9800](../../api/prisma/schema.prisma#L9800)) · enum `PerformanceReviewStatus` ([L9808](../../api/prisma/schema.prisma#L9808)) · enum `PerformanceReviewType` ([L9789](../../api/prisma/schema.prisma#L9789))
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
> **Schema:** `EmployeeCertification` ([employee_certifications](../../api/prisma/schema.prisma#L10321)) · `EmployeeSkill` ([employee_skills](../../api/prisma/schema.prisma#L10296)) · `EmployeeTraining` ([employee_trainings](../../api/prisma/schema.prisma#L10346)) · `ProjectAllocationSkill` ([project_allocation_skills](../../api/prisma/schema.prisma#L11364)) · `Skill` ([skills](../../api/prisma/schema.prisma#L10268)) · enum `EmployeeTrainingStatus` ([L9899](../../api/prisma/schema.prisma#L9899)) · enum `SkillCategory` ([L9870](../../api/prisma/schema.prisma#L9870)) · enum `SkillProficiency` ([L9882](../../api/prisma/schema.prisma#L9882))
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
> **Schema:** `EmployeeDocument` ([employee_documents](../../api/prisma/schema.prisma#L11120)) · enum `EmployeeDocumentCategory` ([L9907](../../api/prisma/schema.prisma#L9907)) · enum `EmployeeDocumentStatus` ([L9919](../../api/prisma/schema.prisma#L9919))
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
> **Schema:** `EmployeeHrNote` ([employee_hr_notes](../../api/prisma/schema.prisma#L11165)) · enum `HrNoteCategory` ([L9929](../../api/prisma/schema.prisma#L9929)) · enum `HrNoteSeverity` ([L9946](../../api/prisma/schema.prisma#L9946)) · enum `HrNoteVisibility` ([L9939](../../api/prisma/schema.prisma#L9939))
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
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L10017)): `directory_visible` · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L9973)): `directory_visible_fields` · `EmployeeImportJob` ([employee_import_jobs](../../api/prisma/schema.prisma#L11394)) · enum `EmployeeImportStatus` ([L11384](../../api/prisma/schema.prisma#L11384))
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
> **Schema:** `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L9973)): `notify_birthdays`
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
> **Schema:** `AttendanceSummary` ([attendance_summaries](../../api/prisma/schema.prisma#L10809))
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
> **Schema:** `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L9973)): `self_service_editable_fields` · `EmployeeProfileChangeRequest` ([employee_profile_change_requests](../../api/prisma/schema.prisma#L11210)) · enum `EmployeeChangeRequestStatus` ([L9954](../../api/prisma/schema.prisma#L9954))
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
