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

### Owned tables (38)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Settings** | | | |
| `EmployeeHrSettings` | `employee_hr_settings` | [L7895](../../api/prisma/schema.prisma#L7895) | 10 "Employee Self-Service", "Attendance & Working Hours", "Capacity & Workload", "Leave Management" — organization-wide HR configuration (one row per organiz… |
| **Employee** | | | |
| `Employee` | `employees` | [L7939](../../api/prisma/schema.prisma#L7939) | 10 "Employee Profiles", "Organization Structure", "Roles & Responsibilities", "Employee Availability", "Employee Directory" — the HR record, 1:1 with a Membe… |
| `EmployeeEmergencyContact` | `employee_emergency_contacts` | [L8060](../../api/prisma/schema.prisma#L8060) | 10 "Employee Profiles" — emergency contacts. |
| `EmployeePosition` | `employee_positions` | [L8081](../../api/prisma/schema.prisma#L8081) | 10 "Roles & Responsibilities", "Organization Structure" — effective-dated position history (title, department, branch, manager, seniority, employment type). … |
| **Compensation** | | | |
| `EmployeeCompensation` | `employee_compensations` | [L8115](../../api/prisma/schema.prisma#L8115) | 10 "Compensation" — effective-dated compensation record (01 §81 source of truth; 01 §60 field-level permission). cost_rate_hourly is consumed by 18 Time Trac… |
| `EmployeeCompensationComponent` | `employee_compensation_components` | [L8156](../../api/prisma/schema.prisma#L8156) | 10 "Compensation" — employer costs (social contributions, insurance, benefits), allowances and bonus / commission scheme lines. Either a fixed amount or a pe… |
| **Skills** | | | |
| `Skill` | `skills` | [L8183](../../api/prisma/schema.prisma#L8183) | 10 "Skills Management" — organization skill catalogue (technical skills, languages, frameworks, platforms, specializations). Searchable for project staffing. |
| `EmployeeSkill` | `employee_skills` | [L8209](../../api/prisma/schema.prisma#L8209) | 10 "Skills Management", "Roles & Responsibilities" — skill per employee with proficiency, experience and primary/secondary flag. |
| `EmployeeCertification` | `employee_certifications` | [L8234](../../api/prisma/schema.prisma#L8234) | 10 "Skills Management", "Employee Profiles" — certifications; the certificate file is a 17 Document. |
| `EmployeeTraining` | `employee_trainings` | [L8259](../../api/prisma/schema.prisma#L8259) | 10 "Skills Management" — professional training records. |
| `EmployeeLanguage` | `employee_languages` | [L8288](../../api/prisma/schema.prisma#L8288) | 10 "Employee Profiles" — spoken languages. |
| **Working hours & availability** | | | |
| `EmployeeWorkSchedule` | `employee_work_schedules` | [L8307](../../api/prisma/schema.prisma#L8307) | 10 "Attendance & Working Hours", "Capacity & Workload" — effective-dated working schedule (fixed, flexible or shift). Defines expected hours and therefore ca… |
| `EmployeeWorkScheduleDay` | `employee_work_schedule_days` | [L8330](../../api/prisma/schema.prisma#L8330) | 10 "Attendance & Working Hours" — one row per working weekday of a schedule. |
| `EmployeeAvailabilityEntry` | `employee_availability_entries` | [L8351](../../api/prisma/schema.prisma#L8351) | 10 "Employee Availability" — time-boxed availability states (remote day, training, business travel, busy, leave projection). Approved leave and holidays crea… |
| **Leave** | | | |
| `LeaveType` | `leave_types` | [L8380](../../api/prisma/schema.prisma#L8380) | 10 "Leave Management" — configurable leave types (vacation, sick, personal, maternity, paternity, unpaid, …). |
| `LeavePolicy` | `leave_policies` | [L8416](../../api/prisma/schema.prisma#L8416) | 10 "Leave Management" — entitlement and accrual rules for a leave type, optionally restricted to a branch (local law) or employment types. Assigned to employ… |
| `EmployeeLeavePolicy` | `employee_leave_policies` | [L8457](../../api/prisma/schema.prisma#L8457) | 10 "Leave Management" — explicit policy assignment per employee (overrides defaults). |
| `LeaveBalance` | `leave_balances` | [L8475](../../api/prisma/schema.prisma#L8475) | 10 "Leave Management" — balance per employee, leave type and balance period. available = entitled + accrued + carried_over + adjusted − used − pending. |
| `LeaveBalanceTransaction` | `leave_balance_transactions` | [L8506](../../api/prisma/schema.prisma#L8506) | 10 "Leave Management" — ledger of balance movements (accruals, usage, adjustments, carry-over, expiry). |
| `LeaveRequest` | `leave_requests` | [L8528](../../api/prisma/schema.prisma#L8528) | 10 "Leave Management" — a leave / time-off request with approval workflow (01 §95 approval right; 20 workflow), half-day support, conflict detection and cale… |
| `LeaveRequestDay` | `leave_request_days` | [L8584](../../api/prisma/schema.prisma#L8584) | 10 "Leave Management" — per-day breakdown of a request (half days, hours) for the leave calendar, team availability and capacity. |
| `LeaveRequestApproval` | `leave_request_approvals` | [L8599](../../api/prisma/schema.prisma#L8599) | 10 "Leave Management" — approval steps (manager, HR, custom chain from 20). |
| `CompanyHoliday` | `company_holidays` | [L8619](../../api/prisma/schema.prisma#L8619) | 10 "Leave Management" — organization-wide public and company holidays. Branch-specific holidays are BranchHoliday (01 §122); both reduce capacity and are pro… |
| **Attendance** | | | |
| `AttendanceRecord` | `attendance_records` | [L8642](../../api/prisma/schema.prisma#L8642) | 10 "Attendance & Working Hours" — one record per employee per calendar day aggregating clock sessions, breaks, overtime and lateness against the work schedul… |
| `AttendanceSession` | `attendance_sessions` | [L8681](../../api/prisma/schema.prisma#L8681) | 10 "Attendance & Working Hours" — a clock-in / clock-out pair; several per day are allowed. |
| `AttendanceBreak` | `attendance_breaks` | [L8704](../../api/prisma/schema.prisma#L8704) | 10 "Attendance & Working Hours" — breaks inside a session. |
| `AttendanceSummary` | `attendance_summaries` | [L8720](../../api/prisma/schema.prisma#L8720) | 10 "Attendance & Working Hours", "Dashboards & Reporting" — materialized weekly / monthly attendance summary per employee (recomputed by a scheduled job, 20). |
| **Capacity** | | | |
| `EmployeeCapacityPeriod` | `employee_capacity_periods` | [L8752](../../api/prisma/schema.prisma#L8752) | 10 "Capacity & Workload" — materialized capacity per employee and period: expected hours from the work schedule minus leave and holidays (owned here), with s… |
| **Performance** | | | |
| `PerformanceReviewCycle` | `performance_review_cycles` | [L8788](../../api/prisma/schema.prisma#L8788) | 10 "Performance Management" — a review cycle (e.g. "H1 2026") grouping reviews with a shared template. |
| `PerformanceReview` | `performance_reviews` | [L8811](../../api/prisma/schema.prisma#L8811) | 10 "Performance Management" — a performance review (self assessment + manager assessment + ratings). |
| `PerformanceGoal` | `performance_goals` | [L8866](../../api/prisma/schema.prisma#L8866) | 10 "Performance Management" — goals, objectives and key results (objective → key results via parent_goal_id), optionally tied to a review or a Project (05). |
| `PerformanceGoalUpdate` | `performance_goal_updates` | [L8910](../../api/prisma/schema.prisma#L8910) | 10 "Performance Management" — progress check-ins on a goal (ongoing tracking). |
| `PerformanceFeedback` | `performance_feedback` | [L8928](../../api/prisma/schema.prisma#L8928) | 10 "Performance Management" — manager feedback, employee (upward / self) feedback, peer feedback, performance notes, achievements and recognition history. Co… |
| `PerformanceImprovementPlan` | `performance_improvement_plans` | [L8963](../../api/prisma/schema.prisma#L8963) | 10 "Performance Management" — improvement plans (PIP) with check-ins and measurable items. |
| `PerformanceImprovementPlanItem` | `performance_improvement_plan_items` | [L8999](../../api/prisma/schema.prisma#L8999) | 10 "Performance Management" — measurable items of an improvement plan. |
| **Documents & notes** | | | |
| `EmployeeDocument` | `employee_documents` | [L9023](../../api/prisma/schema.prisma#L9023) | 10 "Employee Documents" — HR document index per employee (contracts, NDAs, IDs, signed agreements, HR forms). The file is a 17 Document (employee scope, 17 §… |
| `EmployeeHrNote` | `employee_hr_notes` | [L9068](../../api/prisma/schema.prisma#L9068) | 10 "Internal Notes" — private HR notes (performance observations, meeting notes, HR comments, warnings) with role-based visibility (01 §60). Kept separate fr… |
| **Self-service** | | | |
| `EmployeeProfileChangeRequest` | `employee_profile_change_requests` | [L9113](../../api/prisma/schema.prisma#L9113) | 10 "Employee Self-Service" — profile changes submitted by the employee that need HR approval (EmployeeHrSettings.profile_changes_require_approval). Direct ed… |

**Owned enums (43):** `EmploymentStatus`, `EmploymentType`, `EmployeePayType`, `CompensationComponentKind`, `CompensationFrequency`, `EmployeeSeniorityLevel`, `EmployeePositionChangeReason`, `EmployeeWorkLocation`, `EmployeeAvailabilityStatus`, `EmployeeAvailabilitySource`, `EmployeeScheduleType`, `LeaveCategory`, `LeaveAccrualMethod`, `LeaveRequestStatus`, `LeaveDayPart`, `LeaveApprovalDecision`, `LeaveBalanceTransactionType`, `CompanyHolidayKind`, `AttendanceStatus`, `AttendanceSource`, `AttendanceBreakKind`, `EmployeePeriodType`, `EmployeeCapacityStatus`, `PerformanceReviewType`, `PerformanceReviewCycleStatus`, `PerformanceReviewStatus`, `PerformanceGoalKind`, `PerformanceGoalStatus`, `PerformanceFeedbackKind`, `PerformanceFeedbackVisibility`, `PerformanceImprovementPlanStatus`, `PerformanceImprovementItemStatus`, `SkillCategory`, `SkillProficiency`, `LanguageProficiency`, `EmployeeTrainingStatus`, `EmployeeDocumentCategory`, `EmployeeDocumentStatus`, `HrNoteCategory`, `HrNoteVisibility`, `HrNoteSeverity`, `EmployeeChangeRequestStatus`, `LeaveApproverStrategy`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Employee.primary_branch`, `EmployeePosition.branch`, `LeavePolicy.branch` |
| [01](./01-users-organizations-permissions.md) | `Membership` (`memberships`) | `Employee.membership`, `EmployeeHrNote.author`, `LeaveRequest.decided_by`, `LeaveRequestApproval.approver` +2 more |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `AttendanceRecord.organization`, `AttendanceSummary.organization`, `CompanyHoliday.organization`, `Employee.organization` +16 more |
| [01](./01-users-organizations-permissions.md) | `Team` (`teams`) | `Employee.department`, `EmployeePosition.department` |
| [04](./04-contracts.md) | `Contract` (`contracts`) | `EmployeeDocument.contract` |
| [04](./04-contracts.md) | `SignatureRequest` (`signature_requests`) | `EmployeeDocument.signature_request` |
| [05](./05-project-management.md) | `Project` (`projects`) | `PerformanceFeedback.project`, `PerformanceGoal.project` |

**Reused enums:** `RecordEntityType` ([02](./02-crm-sales-management.md))

### Referenced by other modules

- [01](./01-users-organizations-permissions.md): `Membership`, `Organization`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `LedgerRecord.employee_id` ([09](./09-income-expense-management.md), [L6844](../../api/prisma/schema.prisma#L6844)) — 10 Employee — related employee (employee expenses, payroll); id only.
- `PayrollSchedule.employee_id` ([09](./09-income-expense-management.md), [L7208](../../api/prisma/schema.prisma#L7208)) — 10 Employee; id only.
- `PayrollEntry.employee_id` ([09](./09-income-expense-management.md), [L7255](../../api/prisma/schema.prisma#L7255)) — 10 Employee; id only.
- `WikiChecklistRun.employee_id` ([15](./15-notion-business-docs.md), [L14441](../../api/prisma/schema.prisma#L14441)) — Employees (10) Employee record of the subject; id only.
- `Folder.employee_id` ([17](./17-documents-file-management.md), [L15179](../../api/prisma/schema.prisma#L15179)) — 10 Employee for EMPLOYEE scope (HR documents); id only.
- `Document.employee_id` ([17](./17-documents-file-management.md), [L15246](../../api/prisma/schema.prisma#L15246)) — 10 Employee for EMPLOYEE scope (HR documents); id only.
- `TimeTrackingSettings.attendance_prefill_enabled` ([18](./18-time-tracking.md), [L16063](../../api/prisma/schema.prisma#L16063)) — Attendance (10) pre-fills the daily total (18 §9).
- `TimeTrackingSettings.default_expected_hours_per_week` ([18](./18-time-tracking.md), [L16063](../../api/prisma/schema.prisma#L16063)) — Fallback expected hours per week when 10 Employees has no working-hours record.
- `BillingRate.source_compensation_id` ([18](./18-time-tracking.md), [L16196](../../api/prisma/schema.prisma#L16196)) — 10 Employee compensation record this COST rate was synced from; id only.
- `TimeEntry.employee_id` ([18](./18-time-tracking.md), [L16243](../../api/prisma/schema.prisma#L16243)) — 10 Employee record of the member at the time of logging; id only.
- `TimeEntry.attendance_record_id` ([18](./18-time-tracking.md), [L16243](../../api/prisma/schema.prisma#L16243)) — Attendance record (10) that pre-filled this entry; id only.
- `CalendarAvailabilitySchedule.honor_holidays` ([19](./19-calendar.md), [L17264](../../api/prisma/schema.prisma#L17264)) — Respect branch holidays (01 §122) and approved leave (10) on top of the rules.

<!-- schema-refs:end -->

## Employee Profiles

<!-- schema-section:start -->
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L7939)) · `EmployeeCertification` ([employee_certifications](../../api/prisma/schema.prisma#L8234)) · `EmployeeEmergencyContact` ([employee_emergency_contacts](../../api/prisma/schema.prisma#L8060)) · `EmployeeLanguage` ([employee_languages](../../api/prisma/schema.prisma#L8288)) · enum `EmploymentStatus` ([L7498](../../api/prisma/schema.prisma#L7498)) · enum `EmploymentType` ([L7508](../../api/prisma/schema.prisma#L7508)) · enum `LanguageProficiency` ([L7813](../../api/prisma/schema.prisma#L7813))
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

---

## Organization Structure

<!-- schema-section:start -->
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L7939)) · `EmployeePosition` ([employee_positions](../../api/prisma/schema.prisma#L8081)) · enum `EmployeePositionChangeReason` ([L7556](../../api/prisma/schema.prisma#L7556))
<!-- schema-section:end -->

> Defined by → [01 Users, Organizations & Permissions](./01-users-organizations-permissions.md) §16–23 (Branches), §40–43 (Teams, Departments) · Linear LOG-406.

Teams, departments, branches and reporting lines are organization structure owned by 01. The Employee record references its primary branch, secondary branches, department, teams and manager (01 §35) and does not define them.

Employees should be easily searchable by team, department, branch, role, skills, or availability.

---

## Compensation

<!-- schema-section:start -->
> **Schema:** `EmployeeCompensation` ([employee_compensations](../../api/prisma/schema.prisma#L8115)) · `EmployeeCompensationComponent` ([employee_compensation_components](../../api/prisma/schema.prisma#L8156)) · enum `CompensationComponentKind` ([L7524](../../api/prisma/schema.prisma#L7524)) · enum `CompensationFrequency` ([L7535](../../api/prisma/schema.prisma#L7535)) · enum `EmployeePayType` ([L7516](../../api/prisma/schema.prisma#L7516)) · enum `EmploymentType` ([L7508](../../api/prisma/schema.prisma#L7508)) — other modules: `PayrollSchedule` ([payroll_schedules](../../api/prisma/schema.prisma#L7208)) ([09](./09-income-expense-management.md))
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
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L7939)): `responsibilities`, `role` · `EmployeePosition` ([employee_positions](../../api/prisma/schema.prisma#L8081)) · `EmployeeSkill` ([employee_skills](../../api/prisma/schema.prisma#L8209)): `is_primary` · enum `EmployeePositionChangeReason` ([L7556](../../api/prisma/schema.prisma#L7556)) · enum `EmployeeSeniorityLevel` ([L7543](../../api/prisma/schema.prisma#L7543))
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
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L7939)) · `EmployeeAvailabilityEntry` ([employee_availability_entries](../../api/prisma/schema.prisma#L8351)) · enum `EmployeeAvailabilitySource` ([L7592](../../api/prisma/schema.prisma#L7592)) · enum `EmployeeAvailabilityStatus` ([L7578](../../api/prisma/schema.prisma#L7578))
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
> **Schema:** `CompanyHoliday` ([company_holidays](../../api/prisma/schema.prisma#L8619)) · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L7895)) · `EmployeeLeavePolicy` ([employee_leave_policies](../../api/prisma/schema.prisma#L8457)) · `LeaveBalance` ([leave_balances](../../api/prisma/schema.prisma#L8475)) · `LeaveBalanceTransaction` ([leave_balance_transactions](../../api/prisma/schema.prisma#L8506)) · `LeavePolicy` ([leave_policies](../../api/prisma/schema.prisma#L8416)) · `LeaveRequest` ([leave_requests](../../api/prisma/schema.prisma#L8528)) · `LeaveRequestApproval` ([leave_request_approvals](../../api/prisma/schema.prisma#L8599)) · `LeaveRequestDay` ([leave_request_days](../../api/prisma/schema.prisma#L8584)) · `LeaveType` ([leave_types](../../api/prisma/schema.prisma#L8380)) · enum `CompanyHolidayKind` ([L7667](../../api/prisma/schema.prisma#L7667)) · enum `LeaveAccrualMethod` ([L7624](../../api/prisma/schema.prisma#L7624)) · enum `LeaveApprovalDecision` ([L7649](../../api/prisma/schema.prisma#L7649)) · enum `LeaveApproverStrategy` ([L7884](../../api/prisma/schema.prisma#L7884)) · enum `LeaveBalanceTransactionType` ([L7657](../../api/prisma/schema.prisma#L7657)) · enum `LeaveCategory` ([L7609](../../api/prisma/schema.prisma#L7609)) · enum `LeaveDayPart` ([L7642](../../api/prisma/schema.prisma#L7642)) · enum `LeaveRequestStatus` ([L7632](../../api/prisma/schema.prisma#L7632))
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

---

## Attendance & Working Hours

<!-- schema-section:start -->
> **Schema:** `AttendanceBreak` ([attendance_breaks](../../api/prisma/schema.prisma#L8704)) · `AttendanceRecord` ([attendance_records](../../api/prisma/schema.prisma#L8642)) · `AttendanceSession` ([attendance_sessions](../../api/prisma/schema.prisma#L8681)) · `AttendanceSummary` ([attendance_summaries](../../api/prisma/schema.prisma#L8720)) · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L7895)): `attendance_required` · `EmployeeWorkSchedule` ([employee_work_schedules](../../api/prisma/schema.prisma#L8307)) · `EmployeeWorkScheduleDay` ([employee_work_schedule_days](../../api/prisma/schema.prisma#L8330)) · enum `AttendanceBreakKind` ([L7692](../../api/prisma/schema.prisma#L7692)) · enum `AttendanceSource` ([L7683](../../api/prisma/schema.prisma#L7683)) · enum `AttendanceStatus` ([L7673](../../api/prisma/schema.prisma#L7673)) · enum `EmployeePeriodType` ([L7698](../../api/prisma/schema.prisma#L7698)) · enum `EmployeeScheduleType` ([L7602](../../api/prisma/schema.prisma#L7602)) · enum `EmployeeWorkLocation` ([L7569](../../api/prisma/schema.prisma#L7569))
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
> **Schema:** `EmployeeCapacityPeriod` ([employee_capacity_periods](../../api/prisma/schema.prisma#L8752)) · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L7895)): `target_utilization_percent` · `EmployeeWorkSchedule` ([employee_work_schedules](../../api/prisma/schema.prisma#L8307)) · enum `EmployeeCapacityStatus` ([L7705](../../api/prisma/schema.prisma#L7705)) · enum `EmployeePeriodType` ([L7698](../../api/prisma/schema.prisma#L7698))
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
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

> Defined by → [05 Project Management](./05-project-management.md) §8–9 (project roles and membership), §51 (allocation) · Linear LOG-405.

Project membership, project roles, participation dates and allocation are owned by 05. This module shows, on the Employee profile, the employee's current and historical project assignments and allocation across projects, read from 05.

---

## Performance Management

<!-- schema-section:start -->
> **Schema:** `PerformanceFeedback` ([performance_feedback](../../api/prisma/schema.prisma#L8928)) · `PerformanceGoal` ([performance_goals](../../api/prisma/schema.prisma#L8866)) · `PerformanceGoalUpdate` ([performance_goal_updates](../../api/prisma/schema.prisma#L8910)) · `PerformanceImprovementPlan` ([performance_improvement_plans](../../api/prisma/schema.prisma#L8963)) · `PerformanceImprovementPlanItem` ([performance_improvement_plan_items](../../api/prisma/schema.prisma#L8999)) · `PerformanceReview` ([performance_reviews](../../api/prisma/schema.prisma#L8811)) · `PerformanceReviewCycle` ([performance_review_cycles](../../api/prisma/schema.prisma#L8788)) · enum `PerformanceFeedbackKind` ([L7760](../../api/prisma/schema.prisma#L7760)) · enum `PerformanceFeedbackVisibility` ([L7770](../../api/prisma/schema.prisma#L7770)) · enum `PerformanceGoalKind` ([L7742](../../api/prisma/schema.prisma#L7742)) · enum `PerformanceGoalStatus` ([L7749](../../api/prisma/schema.prisma#L7749)) · enum `PerformanceImprovementItemStatus` ([L7786](../../api/prisma/schema.prisma#L7786)) · enum `PerformanceImprovementPlanStatus` ([L7777](../../api/prisma/schema.prisma#L7777)) · enum `PerformanceReviewCycleStatus` ([L7723](../../api/prisma/schema.prisma#L7723)) · enum `PerformanceReviewStatus` ([L7731](../../api/prisma/schema.prisma#L7731)) · enum `PerformanceReviewType` ([L7712](../../api/prisma/schema.prisma#L7712))
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

---

## Skills Management

<!-- schema-section:start -->
> **Schema:** `EmployeeCertification` ([employee_certifications](../../api/prisma/schema.prisma#L8234)) · `EmployeeSkill` ([employee_skills](../../api/prisma/schema.prisma#L8209)) · `EmployeeTraining` ([employee_trainings](../../api/prisma/schema.prisma#L8259)) · `Skill` ([skills](../../api/prisma/schema.prisma#L8183)) · enum `EmployeeTrainingStatus` ([L7822](../../api/prisma/schema.prisma#L7822)) · enum `SkillCategory` ([L7793](../../api/prisma/schema.prisma#L7793)) · enum `SkillProficiency` ([L7805](../../api/prisma/schema.prisma#L7805))
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

---

## Employee Documents

<!-- schema-section:start -->
> **Schema:** `EmployeeDocument` ([employee_documents](../../api/prisma/schema.prisma#L9023)) · enum `EmployeeDocumentCategory` ([L7830](../../api/prisma/schema.prisma#L7830)) · enum `EmployeeDocumentStatus` ([L7842](../../api/prisma/schema.prisma#L7842))
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
> **Schema:** `EmployeeHrNote` ([employee_hr_notes](../../api/prisma/schema.prisma#L9068)) · enum `HrNoteCategory` ([L7852](../../api/prisma/schema.prisma#L7852)) · enum `HrNoteSeverity` ([L7868](../../api/prisma/schema.prisma#L7868)) · enum `HrNoteVisibility` ([L7861](../../api/prisma/schema.prisma#L7861))
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
> **Schema:** `Employee` ([employees](../../api/prisma/schema.prisma#L7939)): `directory_visible` · `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L7895)): `directory_visible_fields`
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

---

## Notifications

<!-- schema-section:start -->
> **Schema:** `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L7895)): `notify_birthdays`
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
> **Schema:** `AttendanceSummary` ([attendance_summaries](../../api/prisma/schema.prisma#L8720))
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
> **Schema:** `EmployeeHrSettings` ([employee_hr_settings](../../api/prisma/schema.prisma#L7895)): `self_service_editable_fields` · `EmployeeProfileChangeRequest` ([employee_profile_change_requests](../../api/prisma/schema.prisma#L9113)) · enum `EmployeeChangeRequestStatus` ([L7876](../../api/prisma/schema.prisma#L7876))
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
