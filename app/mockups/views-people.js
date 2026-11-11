/* =====================================================================================================================
   PEOPLE APP — module 10 Employee Management System (docs/features/10-employee-management-system.md). Rail entry "People", app id `people`.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma (38 owned models): EmployeeHrSettings, Employee, EmployeeEmergencyContact, EmployeePosition, EmployeeCompensation, EmployeeCompensationComponent, Skill, EmployeeSkill,
   EmployeeCertification, EmployeeTraining, EmployeeLanguage, EmployeeWorkSchedule(+Day), EmployeeAvailabilityEntry, LeaveType, LeavePolicy, EmployeeLeavePolicy, LeaveBalance, LeaveBalanceTransaction, LeaveRequest(+Day,
   +Approval), CompanyHoliday, AttendanceRecord/Session/Break/Summary, EmployeeCapacityPeriod, PerformanceReviewCycle, PerformanceReview, PerformanceGoal(+Update), PerformanceFeedback, PerformanceImprovementPlan(+Item),
   EmployeeDocument, EmployeeHrNote, EmployeeProfileChangeRequest. Read-only from other modules: PayrollEntry/PayrollSchedule (09), WikiChecklistRun (15, onboarding/offboarding checklists), Team/Branch/Membership (01),
   Project (05), Task (06), TimeEntry (18), CalendarEvent (19), Document/SignatureRequest/Contract (17, 04), SavedView (02 platform table, entity_type EMPLOYEE).
   Enums are the real values (EmploymentStatus, EmploymentType, EmployeePayType, EmployeeSeniorityLevel, EmployeeWorkLocation, EmployeeAvailabilityStatus, LeaveCategory, LeaveRequestStatus, LeaveDayPart, AttendanceStatus,
   PerformanceReviewStatus, PerformanceGoalStatus, EmployeeDocumentStatus, HrNoteVisibility ...); labels via UI.en, the raw value is in the tooltip.
   Permission keys (catalog today): employees.employees.{read,create,update,delete*,archive,export*} · employees.directory.read · employees.compensation.{read*,manage*} (field-level) · employees.documents.{read*,manage*} ·
   employees.hr_notes.{read*,manage*} · employees.leave.{approve,read_own,read_all,request_own,manage_policies*,manage_balances*} · employees.attendance.{read_own,read_all,record_own,manage*} · employees.performance.
   {read_own,read_all*,manage*} · employees.skills.{read,manage} · employees.capacity.read · employees.availability.manage · employees.profile.update_own. Payroll entries are finance.payroll.{read*,manage*} (module 09).
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - Employee (HR record) is 1:1 with a Membership (Employee.membership_id). A Member can exist without an Employee (contractors). Identity, login, Teams, Departments and Branches belong to 01; this module owns employment data.
     - SENSITIVE FIELDS render the literal state "Restricted" (lock icon + the permission key in the tooltip) when the caller lacks the key. The SERVER omits the value (never send it and hide it in the browser). Compensation
       (employees.compensation.read*, field-level, 01 §60) covers EmployeeCompensation + components + cost/billing rates + payroll entries. Identity and bank data (national_id_number, tax_id, social_security_number,
       bank_details, date_of_birth, personal_email, personal_phone, address, emergency contacts) is field-level too: employees.personal_data.read* / employees.personal_data.manage* (field-level, sensitive). Documents need
       employees.documents.read*, HR notes need employees.hr_notes.read*, other people's reviews need employees.performance.read_all*.
     - Scope: lists are filtered by the caller's branch/team scope (01). A manager sees their reports; an employee sees themselves through the *.read_own keys; a Branch Admin sees their branch only.
     - Effective-dated history (EmployeePosition, EmployeeCompensation, EmployeeWorkSchedule, EmployeeLeavePolicy): a change closes the previous row (effective_to) and inserts a new one; it never edits history in place. The
       Employee row mirrors the CURRENT position (job_title, position, role, seniority_level, department_team_id, primary_branch_id, manager_employee_id, employment_type).
     - Ownership split (05 §51): this module owns availability and capacity (schedule - leave - holidays); 05 owns planned allocation; 18 owns actuals and utilization; 06 owns task distribution. Payroll expense records are
       created in 09 from compensation data, never here.
     - Approved leave and holidays create EmployeeAvailabilityEntry rows (source LEAVE / HOLIDAY), reduce EmployeeCapacityPeriod and are projected onto 19 Calendar (LeaveRequest.calendar_event_id).
     - Every write: audit_events (actor USER / SERVICE_ACCOUNT / SYSTEM), webhook event, automation trigger (20). Reads of restricted fields are audited too (audit event EMPLOYEE_SENSITIVE_FIELD_READ when a masked value is revealed).
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows, noMargin) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + Math.min(p, 100) + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const sp = '<div style="height:12px"></div>';
  const row = (t, s, r) => '<div class="rowx"><div class="grow"><b>' + t + "</b>" + (s ? "<small>" + s + "</small>" : "") + "</div>" + (r || "") + "</div>";
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const two = (a, b) => '<div class="rowx" style="gap:10px;padding:0;align-items:flex-start"><div style="flex:1">' + a + '</div><div style="flex:1">' + b + "</div></div>";
  const seg = (arr, on) => '<div class="rowx" style="gap:8px;padding:0;flex-wrap:wrap">' + arr.map((t) => '<span class="seg' + (t === on ? " on" : "") + '">' + t + "</span>").join("") + "</div>";
  const tagsx = (a) => '<span class="pp-tags">' + a.map((t) => tok(t)).join("") + "</span>";
  /* @impl restricted(key): the literal state for a field the caller may not read. The API omits the property (or sends null + `restricted: true`); the UI renders this chip, never an empty cell. */
  const rs = (key) => '<span class="rst" title="Requires ' + key + '">' + I("lock", 12) + " Restricted</span>";
  const eid = (n) => "EMP-" + String(n).padStart(4, "0");
  const dt = (s) => s;

  /* people: ini -> [name, avatar colour] (same initials as other apps) */
  const PP = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"], LN: ["Lena Novak", ""], TB: ["Tomas Berg", "g"], PN: ["Priya Nair", "y"], ER: ["Elena Rossi", "r"], DW: ["Daniel Weiss", "p"], HF: ["Hannah Fischer", ""], OL: ["Oskar Lind", "g"] };
  const av = (a) => AV(a, PP[a][1]);
  const wh = (a, s) => who(a, PP[a][1], PP[a][0], s || "");
  const nm = (a) => PP[a][0];
  const ST = { ONBOARDING: "blue", ACTIVE: "green", ON_LEAVE: "yellow", SUSPENDED: "red", OFFBOARDING: "purple", TERMINATED: "" };
  const stB = (s) => ES(s, ST[s]);
  const AVL = { AVAILABLE: "green", BUSY: "yellow", ON_LEAVE: "yellow", VACATION: "blue", SICK_LEAVE: "red", PUBLIC_HOLIDAY: "", REMOTE: "blue", IN_OFFICE: "green", TRAINING: "purple", BUSINESS_TRAVEL: "purple" };
  const avB = (s) => ES(s, AVL[s]);

  /* ini, no, title, seniority, department, branch, manager ini, status, type, location, hire, availability, utilization %, skills, work email */
  const EMP = [
    ["AM", 1, "Managing Director", "EXECUTIVE", "Management", "Berlin HQ", "", "ACTIVE", "FULL_TIME", "HYBRID", "Mar 1, 2019", "IN_OFFICE", 74, ["Strategy", "Finance"], "anna.meyer@acme-agency.com"],
    ["JK", 4, "Engineering Lead", "LEAD", "Engineering", "Berlin HQ", "AM", "ACTIVE", "FULL_TIME", "HYBRID", "Jan 10, 2020", "BUSY", 81, ["TypeScript", "NestJS", "AWS"], "jonas.koch@acme-agency.com"],
    ["MS", 12, "Senior Frontend Engineer", "SENIOR", "Engineering", "Lisbon", "JK", "ACTIVE", "FULL_TIME", "REMOTE", "Jun 14, 2021", "REMOTE", 118, ["React", "TypeScript", "Next.js"], "marco.silva@acme-agency.com"],
    ["TB", 21, "Backend Engineer", "MID", "Engineering", "Berlin HQ", "JK", "ACTIVE", "FULL_TIME", "OFFICE", "Feb 7, 2023", "IN_OFFICE", 92, ["NestJS", "Prisma", "PostgreSQL"], "tomas.berg@acme-agency.com"],
    ["PN", 24, "QA Engineer", "MID", "Engineering", "Lisbon", "JK", "ACTIVE", "PART_TIME", "REMOTE", "Sep 1, 2023", "AVAILABLE", 56, ["Playwright", "Test design"], "priya.nair@acme-agency.com"],
    ["SJ", 17, "Product Designer", "MID", "Design", "Copenhagen", "AM", "ACTIVE", "FULL_TIME", "HYBRID", "Apr 19, 2022", "AVAILABLE", 60, ["Figma", "Design systems"], "sofia.jensen@acme-agency.com"],
    ["KL", 9, "Project Manager", "SENIOR", "Delivery", "Copenhagen", "AM", "ACTIVE", "FULL_TIME", "OFFICE", "Aug 23, 2020", "TRAINING", 100, ["Scrum", "Stakeholder mgmt"], "kim.lund@acme-agency.com"],
    ["ER", 27, "Account Manager", "SENIOR", "Sales", "Berlin HQ", "AM", "ACTIVE", "FULL_TIME", "CLIENT_SITE", "Nov 2, 2023", "BUSINESS_TRAVEL", 70, ["Negotiation", "CRM"], "elena.rossi@acme-agency.com"],
    ["HF", 19, "Content Strategist", "MID", "Marketing", "Copenhagen", "AM", "ON_LEAVE", "FULL_TIME", "HYBRID", "Jul 11, 2022", "VACATION", 0, ["Copywriting", "SEO"], "hannah.fischer@acme-agency.com"],
    ["LN", 6, "HR Manager", "MANAGER", "People & Culture", "Berlin HQ", "AM", "ACTIVE", "FULL_TIME", "OFFICE", "May 4, 2020", "IN_OFFICE", 65, ["Labour law", "Recruiting"], "lena.novak@acme-agency.com"],
    ["DW", 41, "Frontend Intern", "INTERN", "Engineering", "Berlin HQ", "MS", "ONBOARDING", "INTERN", "OFFICE", "Nov 2, 2026", "TRAINING", 20, ["HTML", "CSS"], "daniel.weiss@acme-agency.com"],
    ["OL", 15, "DevOps Engineer", "SENIOR", "Engineering", "Lisbon", "JK", "OFFBOARDING", "FULL_TIME", "REMOTE", "Mar 15, 2021", "AVAILABLE", 45, ["Kubernetes", "Terraform"], "oskar.lind@acme-agency.com"],
  ];
  const byIni = (i) => EMP.find((e) => e[0] === i);
  const typeLbl = (t) => U.en(t);

  /* =====================================================================================================================
     DIRECTORY (HR table) — spec "Employee Profiles", "Organization Structure", "Employee Directory"
     @screen People · Directory
     @route  /people/directory?view=<savedViewId>&filter=<json>&sort=&group=&q=&cursor=
     @perm   VIEW employees.employees.read (HR table, scope-limited to the caller's branch/team) · employees.directory.read alone only opens "Company directory" (cards) · create employees.employees.create ·
             archive employees.employees.archive · export employees.employees.export* · bulk availability employees.availability.manage · delete employees.employees.delete* (hard delete, rare)
     @api    GET /employees?filter=&sort=&group=&q=&cursor= · POST /employees/bulk {employee_ids|filter, patch|action} · GET/POST/PATCH /saved-views?entity_type=EMPLOYEE · GET /employees/export?format=csv|xlsx|pdf
     @mcp    employees_employees_read (same filter JSON) · employees_employees_update · employees_employees_export (sensitive: human confirmation)
     @data   Employee (employee_number, preferred_name/legal names, job_title, seniority_level, department_team_id, primary_branch_id, manager_employee_id, employment_status, employment_type, work_location, hire_date,
             probation_end_date, contract_end_date, availability_status, weekly_capacity_hours, directory_visible, archived_at) · EmployeeSkill/Skill (search by skill) · SavedView (entity_type EMPLOYEE) · taggings (02)
     @ui     Table with column chooser, filter bar (Popover + Command value pickers, multi-select), ToggleGroup saved-view tabs, "Save view" Dialog, row DropdownMenu, sticky bulk bar, Avatar, Badge, Tooltip
     @states loading skeleton rows · empty ("No employees match these filters" + clear) · error · no-access (403) · partial results note when a filter touches a field the caller may not read
     @audit  EMPLOYEE_CREATED / EMPLOYEE_UPDATED / EMPLOYEE_ARCHIVED per bulk target + one summary event with the filter used; export writes EMPLOYEE_EXPORT (format, filter, row count)
     @note   Filter tree is the same typed JSON as tasks (SavedView.filters). Fields: status, type, seniority, department, branch, manager (incl. "all reports of"), location, availability, skill (any/all), hire date,
             probation ends before, contract ends before, has open leave, utilization, tag, custom field. Salary or pay type are NOT filterable here (no employees.compensation.read). "Select all" selects by FILTER and the bar
             says how many rows it touches. Archived employees are hidden unless the filter says archived_at is set.
     @perm   Import needs employees.employees.import* · the run is an EmployeeImportJob (status PENDING|VALIDATING|PREVIEW|IMPORTING|COMPLETED|FAILED, file_name, document_id, mapping, total_rows, created_rows, updated_rows, skipped_rows, error_rows, errors, error_report_document_id)
     ===================================================================================================================== */
  function directory() {
    const F = window.UI.filters;
    const vtabs = [["All active", 84, 1], ["On leave today", 6], ["Probation ending (30 d)", 3], ["Onboarding", 4], ["Remote", 22], ["My reports", 7], ["Contract ends soon", 2]];
    return '<div class="a-page">' + head("Employees", "Everyone on the HR record. Branch and team scope applies to what you see.", btn("Import", "box") + btn("Export", "file") + btn("Add employee", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Headcount", 84, "+3 this month") + stat("Onboarding", 4, "start in 30 days") + stat("On leave today", 6, "5 approved, 1 sick") + stat("Probation ending", 3, "next 30 days") + stat("Contracts ending", 2, "next 60 days", 1) + "</div>" +
      '<div class="pp-views">' + vtabs.map((v) => '<span class="seg' + (v[2] ? " on" : "") + '">' + v[0] + ' <span class="count">' + v[1] + "</span></span>").join("") + '<button class="btn sm ghost">' + I("plus", 13) + " Save view</button></div>" +
      '<div class="toolbar">' + search("Search name, number, title, skill, email") + sel("Table", "grid") + sel("Group: None") + sel("Sort: Name", "sort") + sel("Columns (11)", "settings") + sel("Views: All active", "star") + "</div>" +
      F.filterBar([["Status", "is any of", "Active, On leave"], ["Department", "is any of", "Engineering, Design"], ["Branch", "is", "Berlin HQ, Lisbon"], ["Skill", "has any of", "React, NestJS"], ["Hire date", "after", "Jan 1, 2021"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>3 selected</b><span class="muted">the bulk bar appears when rows are selected</span><span style="flex:1"></span>' + sel("Department…", "users") + sel("Manager…", "users") + sel("Availability…") + sel("Tag…", "tag") + btn("Start offboarding", "x", "sm") + btn("Archive", "box", "sm") + btn("Export", "file", "sm") + "</div>" +
      '<div class="panel" style="margin-top:0"><table>' + th(["", "Employee", "No.", "Title", "Department", "Branch", "Manager", "Status", "Type", "Location", "Availability", "Hire date", ">Util."]) + "<tbody>" +
      EMP.map((e, i) => "<tr><td>" + cb(i < 3) + "</td><td>" + wh(e[0], e[14]) + "</td><td class='muted'>" + eid(e[1]) + "</td><td>" + e[2] + "<br><small class='muted'>" + U.en(e[3]) + "</small></td><td>" + e[4] + "</td><td>" + e[5] + "</td><td>" + (e[6] ? wh(e[6]) : muted("—")) + "</td><td>" + stB(e[7]) + "</td><td>" + E(e[8]) + "</td><td>" + E(e[9]) + "</td><td>" + avB(e[11]) + "</td><td>" + e[10] + "</td><td class='num'>" + (e[12] > 100 ? '<span class="badge red">' + e[12] + "%</span>" : e[12] + "%") + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="pager"><span class="muted">1–12 of 84</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      '<div class="sub-note">Utilization is read from 18 Time Tracking (logged / available hours of EmployeeCapacityPeriod). Salary, pay type and rates are not columns here: they live on the Compensation tab behind employees.compensation.read.</div>' +
      dm(["Employee · employee_number, preferred_name, job_title, seniority_level, department_team_id, primary_branch_id, manager_employee_id, employment_status, employment_type, work_location, availability_status, hire_date, archived_at", "EmployeeSkill · Skill (skill filter) · EmployeeCapacityPeriod (utilization_percent, read-only)", "SavedView · entity_type EMPLOYEE, filters, sorting, grouping, columns, visibility, team_id", "EmployeeImportJob · status, mapping, total_rows, created_rows, updated_rows, skipped_rows, error_rows, errors, error_report_document_id (Import)", "Team (department) · Branch · Membership (01, read-only)"], []) + "</div>";
  }

  /* =====================================================================================================================
     COMPANY DIRECTORY (cards) — spec "Employee Directory"
     @screen People · Company directory
     @route  /people/cards?q=&dept=&branch=&skill=&available=1
     @perm   VIEW employees.directory.read (everybody holding it; the Viewer role has it). Only the fields in EmployeeHrSettings.directory_visible_fields are returned, for employees with directory_visible = true.
     @api    GET /employees/directory?q=&department=&branch=&skill=&availability=
     @mcp    employees_directory_read
     @data   Employee (preferred_name, photo_document_id, job_title, department_team_id, primary_branch_id, work_email, work_phone, availability_status, availability_note, directory_visible, timezone, bio) ·
             EmployeeHrSettings.directory_visible_fields · EmployeeSkill/Skill · Project (05, active projects, read-only)
     @ui     Card grid, Input search, Popover+Command filters, Avatar with presence dot, HoverCard for the mini profile
     @states loading skeleton cards · empty · error · no-access
     @note   This is the employee-facing directory, not the HR table: no status, no salary, no manager notes, no personal contact data. Personal phone/email are never in directory_visible_fields. Availability is the
             current EmployeeAvailabilityEntry (leave, holiday, remote day, training) or Employee.availability_status. Clicking a card opens the profile page with the caller's field permissions applied.
     ===================================================================================================================== */
  function cards() {
    return '<div class="a-page">' + head("Company directory", "Find colleagues by name, team, skill or availability.", btn("Org chart", "people")) +
      '<div class="toolbar">' + search("Search name, title, skill") + sel("Department", "users") + sel("Branch", "building") + sel("Skill", "tag") + sel("Available now") + "</div>" +
      '<div class="pp-cards">' + EMP.filter((e) => e[7] !== "OFFBOARDING").map((e) => '<div class="cd pp-card"><div class="pp-card-top">' + AV(e[0], PP[e[0]][1], "xl") + '<div><b>' + nm(e[0]) + "</b><small>" + e[2] + "</small></div></div>" +
        '<div class="pp-card-b">' + kv("Department", e[4]) + kv("Branch", e[5]) + kv("Email", '<span class="muted">' + e[14] + "</span>") + "</div>" + '<div class="pp-card-f">' + avB(e[11]) + tagsx(e[13].slice(0, 2)) + "</div></div>").join("") + "</div>" +
      dm(["Employee · directory_visible, preferred_name, photo_document_id, job_title, department_team_id, primary_branch_id, work_email, work_phone, availability_status", "EmployeeHrSettings · directory_visible_fields", "EmployeeSkill · Skill · EmployeeAvailabilityEntry (current)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ADD EMPLOYEE / ONBOARDING — full page, every Employee field (spec "Employee Profiles", "Compensation", "Roles & Responsibilities")
     @screen People · Add employee
     @route  /people/new?member=<membershipId>&from=<invitationId> (also reached from Admin > Members "Create employee record")
     @perm   employees.employees.create · compensation block needs employees.compensation.manage* (the block is replaced by a Restricted card without it) · identity/bank block needs employees.personal_data.manage*
             · document requests need employees.documents.manage* · starting a checklist needs 15 + tasks.tasks.create (06) · leave policy assignment employees.leave.manage_policies*
     @api    POST /employees {membership_id, employee_number?, legal_first_name, legal_last_name, preferred_name, date_of_birth, gender, nationality, national_id_number, tax_id, social_security_number, bank_details{},
             work_email, work_phone, personal_email, personal_phone, address{}, photo_document_id, resume_document_id, job_title, position, role, seniority_level, department_team_id, primary_branch_id,
             manager_employee_id, employment_status, employment_status_since, employment_type, work_location, hire_date, probation_end_date, contract_end_date, notice_period_days, responsibilities[],
             areas_of_expertise[], technical_stack[], bio, availability_status, availability_note, weekly_capacity_hours, target_utilization_percent, timezone, directory_visible,
             emergency_contacts[], languages[], skills[], schedule{}, leave_policy_ids[], compensation{...components[]}, onboarding{checklist_id, document_requests[], create_tasks}}
             (one transaction: Employee + EmployeePosition(reason HIRE) + EmployeeCompensation + EmployeeWorkSchedule + EmployeeLeavePolicy + LeaveBalance rows + EmployeeDocument REQUESTED rows + WikiChecklistRun)
     @mcp    employees_employees_create (sensitive when compensation is included: human confirmation)
     @data   Employee (every column below) · EmployeeEmergencyContact · EmployeeLanguage · EmployeeSkill · EmployeePosition · EmployeeCompensation + EmployeeCompensationComponent · EmployeeWorkSchedule + Day ·
             EmployeeLeavePolicy · LeaveBalance · EmployeeDocument (REQUESTED) · WikiChecklistRun (15, subject_membership_id + employee_id) · number_sequences (employee_number)
     @ui     Sectioned form (react-hook-form + zod), shadcn Select / Combobox (Popover+Command) / DatePicker / Input / Textarea / Switch / ToggleGroup, TagInput for the String[] fields, file drop zone (17, EMPLOYEE scope)
     @states validation errors inline per field · saving · saved (toast + link to the profile) · duplicate employee_number / membership already has an employee (409) · field disabled with the reason when permission is missing ·
             draft kept in local storage
     @audit  EMPLOYEE_CREATED (with the source membership), EMPLOYEE_COMPENSATION_CREATED, EMPLOYEE_ONBOARDING_STARTED
     @note   employee_number is allocated by number_sequences (EMP-0042) at save, never by the client. A Member with no Employee is offered in the picker; "Invite new member" runs the 01 invitation and links the
             result. employment_status starts as ONBOARDING; the checklist completion sets onboarding_completed_at and flips the status to ACTIVE after hire_date. The first EmployeePosition (reason HIRE) and
             EmployeeCompensation rows are created from the Job and Compensation blocks; Employee.job_title etc. mirror the position. gender is a free String (no enum); address and bank_details are Json shaped as below.
             contract_end_date only for CONTRACTOR / fixed term. weekly_capacity_hours defaults from EmployeeHrSettings.default_weekly_hours.
     ===================================================================================================================== */
  function create() {
    const lockHint = (k) => '<div class="sub-note">' + I("lock", 11) + " " + k + "</div>";
    return '<div class="a-page">' + head("Add employee", "Create the HR record for a member. The employee number is assigned when you save.", btn("Cancel") + btn("Save as draft") + btn("Create employee", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>1 · Member and identity</b><span class='r muted'>Employee.membership_id · names</span>",
        f("Member", sel("Select a member without an employee record…", "users"), "Employee is 1:1 with a Membership (01). Contractors can stay members without a record.") +
        two(f("Legal first name", box("Marco")), f("Legal last name", box("Silva"))) + two(f("Preferred name", box("Marco"), "Shown in the directory and chats.") , f("Employee number", box("EMP-0042 (auto)"), "Allocated by number_sequences on save.")) +
        two(f("Date of birth", sel("Pick a date", "calendar") + lockHint("employees.personal_data.read / manage")), f("Gender", box("Free text, optional"), "Employee.gender is a String; no enum.")) +
        f("Nationality", sel("Portugal", "globe")) + f("Profile photo", '<div class="drop">' + I("clip", 16) + " Upload photo (stored as a Document, EMPLOYEE scope, 17) · photo_document_id</div>")) + sp +
      cd("<b>2 · Contact</b><span class='r muted'>work + personal</span>",
        two(f("Work email", box("name@company.com")), f("Work phone", box("+351 …"))) + two(f("Personal email", box("optional") + lockHint("Restricted field")), f("Personal phone", box("optional") + lockHint("Restricted field"))) +
        f("Address", box("Street and number") + '<div style="height:6px"></div>' + two(box("Postcode"), box("City")) + '<div style="height:6px"></div>' + two(sel("Country", "globe"), box("Region")), "Stored as Json { street, postcode, city, region, country }.") +
        f("Timezone", sel("Europe/Lisbon", "clock"), "Used for the leave calendar, capacity and clock-in cut-off.")) + sp +
      cd("<b>3 · Identity, tax and bank</b><span class='r muted'>restricted fields</span>",
        callout("lock", "These fields are written only with <b>employees.personal_data.manage</b> and read only with <b>employees.personal_data.read</b>. Everyone else sees <b>Restricted</b>.", "warn") + sp +
        two(f("National ID number", box("•••• •••• ••")), f("Tax ID", box("•••• •••• ••"))) + f("Social security number", box("•••• •••• ••")) +
        f("Bank details", two(box("Account holder"), box("Bank name")) + '<div style="height:6px"></div>' + two(box("IBAN"), box("BIC")), "Json { holder, bank, iban, bic }; encrypted at rest; used for payroll payments (09).")) + sp +
      cd("<b>4 · Emergency contacts</b><span class='r'>" + btn("Add contact", "plus", "sm") + "</span>",
        row("Ana Silva", "Spouse · +351 912 000 000 · ana@example.com · is_primary", more) + row("Paulo Silva", "Brother · +351 913 000 000 · sort_order 2", more), 1) + sp +
      cd("<b>5 · Job and structure</b><span class='r muted'>Employee · EmployeePosition (reason HIRE)</span>",
        two(f("Job title", box("Senior Frontend Engineer")), f("Position", box("Frontend"), "Employee.position, free text (e.g. squad).")) + two(f("Role", box("IC"), "Employee.role, free text responsibility label."), f("Seniority level", sel("Senior"), "Intern, Junior, Mid, Senior, Lead, Principal, Manager, Director, Executive.")) +
        two(f("Department", sel("Engineering", "users"), "Team with kind DEPARTMENT (01)."), f("Primary branch", sel("Lisbon", "building"))) + two(f("Manager", sel("Jonas Koch", "users"), "Employee (reporting line). The API rejects cycles."), f("Employment type", seg(["Full time", "Part time", "Contractor", "Intern"], "Full time"))) +
        f("Work location", seg(["Office", "Remote", "Hybrid", "Client site", "Travel"], "Remote")) +
        f("Responsibilities", tagsx(["Own the design system", "Review pull requests", "Mentor juniors"]) + '<div class="sub-note">Employee.responsibilities String[]</div>') +
        two(f("Areas of expertise", tagsx(["Web performance", "Accessibility"])), f("Technical stack", tagsx(["React", "TypeScript", "Next.js", "Tailwind"]))) +
        f("Bio", '<div class="editor"><div class="ed-body" style="min-height:70px">Short professional bio shown on the profile and in the directory.</div></div>') +
        f("Resume / CV", '<div class="drop">' + I("clip", 16) + " Upload to Documents (17) · resume_document_id</div>")) + sp +
      cd("<b>6 · Employment dates and status</b><span class='r muted'>Employee</span>",
        two(f("Employment status", sel("Onboarding"), "ONBOARDING, ACTIVE, ON_LEAVE, SUSPENDED, OFFBOARDING, TERMINATED. New records start as ONBOARDING."), f("Status since", sel("Nov 11, 2026", "calendar"), "employment_status_since")) +
        two(f("Hire date", sel("Dec 1, 2026", "calendar")), f("Probation end date", sel("Mar 1, 2027", "calendar"))) + two(f("Contract end date", sel("— (open-ended)", "calendar")), f("Notice period (days)", box("30")))) + sp +
      cd("<b>7 · Availability, capacity and schedule</b><span class='r muted'>Employee · EmployeeWorkSchedule</span>",
        two(f("Availability status", sel("Available"), "Current state; entries from leave, holidays and training override it."), f("Availability note", box("optional"))) +
        two(f("Weekly capacity (h)", box("40"), "Defaults from EmployeeHrSettings.default_weekly_hours."), f("Target utilization (%)", box("80"), "Defaults from settings.")) +
        f("Work schedule", seg(["Fixed", "Flexible", "Shift"], "Fixed"), "EmployeeScheduleType") +
        f("Weekly pattern", '<div class="pp-week">' + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => '<div class="pp-wd' + (i > 4 ? " off" : "") + '"><b>' + d + "</b><span>" + (i > 4 ? "off" : "09:00–17:30") + "</span><small>" + (i > 4 ? "" : "break 30 · 8 h") + "</small></div>").join("") + "</div>", "EmployeeWorkScheduleDay: weekday, starts_at, ends_at, break_minutes, hours, work_location override. weekly_hours = sum; core_hours Json for flexible.") +
        f("Directory visibility", '<div class="rowx" style="padding:0"><div class="grow"><b>Show in company directory</b><small>Employee.directory_visible · fields per EmployeeHrSettings.directory_visible_fields</small></div>' + sw(1) + "</div>")) + sp +
      cd("<b>8 · Skills and languages</b><span class='r muted'>EmployeeSkill · EmployeeLanguage</span>",
        row("React", "Expert · 6 y · primary", more) + row("TypeScript", "Expert · 6 y · primary", more) + row("Accessibility", "Advanced · 3 y", more) + '<div class="rowx"><div class="grow muted">Search the skill catalogue…</div>' + btn("Add skill", "plus", "sm") + "</div>" +
        row("Portuguese", "Native · primary", more) + row("English", "Fluent", more), 1) +
      "</div><div>" +
      cd("<b>9 · Compensation</b><span class='r muted'>EmployeeCompensation</span>",
        callout("lock", "Needs <b>employees.compensation.manage</b>. Without it this card is replaced by <b>Restricted</b> and the employee is created without a compensation record.", "warn") + sp +
        f("Effective from", sel("Dec 1, 2026", "calendar")) + two(f("Pay type", sel("Monthly salary"), "Monthly salary, Hourly, Daily, Per project"), f("Employment type", sel("Full time"))) +
        two(f("Base amount", box("4 800.00")), f("Currency", sel("EUR"))) + two(f("Employer cost / month", box("1 020.00")), f("Total cost / month", box("5 820.00"))) +
        two(f("Cost rate / hour", box("33.60"), "Synced to a COST BillingRate in 18."), f("Billing rate default", box("95.00"))) + two(f("Billing currency", sel("EUR")), f("Contracted hours / week", box("40"))) +
        f("Bonus scheme", box("Annual bonus up to 8%")) + f("Commission scheme", box("—")) + f("Reason / notes", box("Initial compensation on hire")) +
        '<div class="sub-note">Components (EmployeeCompensationComponent)</div>' + row("Social contribution", "SOCIAL_CONTRIBUTION · 21.25% of base · MONTHLY · employer-paid", more) + row("Health insurance", "INSURANCE · 45.00 EUR · MONTHLY · paid_to_employee off", more) + row("Meal allowance", "ALLOWANCE · 140.00 EUR · MONTHLY · paid_to_employee on", more) + btn("Add component", "plus", "sm"), 0) + sp +
      cd("<b>10 · Leave</b><span class='r muted'>EmployeeLeavePolicy</span>", f("Vacation policy", sel("Portugal standard · 22 days", "calendar")) + f("Sick leave policy", sel("Sick leave · unlimited with certificate")) + f("Effective from", sel("Dec 1, 2026", "calendar"), "Opening LeaveBalance rows are created per leave type; the first year is pro-rated when the policy says so.")) + sp +
      cd("<b>11 · Onboarding</b><span class='r muted'>WikiChecklistRun (15) · EmployeeDocument</span>",
        f("Checklist template", sel("Engineer onboarding (14 steps)", "check"), "Starts a WikiChecklistRun with subject = the member and employee_id; items can create Tasks (06).") +
        row("Create onboarding tasks", "Assign to manager, HR, IT in Tasks (06)", sw(1)) + row("Send welcome email", "Via the organization's connected email provider (Resend, Admin > Integrations)", sw(1)) +
        '<div class="sub-note" style="margin-top:8px">Document requests (EmployeeDocument status REQUESTED)</div>' + row("Signed employment contract", "EMPLOYMENT_CONTRACT · due Nov 25 · e-signature (04)", sw(1)) + row("NDA", "NDA · due Nov 25", sw(1)) + row("Identification", "IDENTIFICATION · due Nov 25 · confidential", sw(1)) + row("Bank details form", "HR_FORM · due Nov 25", sw(1)), 0) + sp +
      '<div class="rowx"><div class="grow"><b>Create another</b><small>Keep the form open</small></div>' + sw(0) + "</div>" +
      "</div></div>" +
      dm(["Employee · every column in sections 1–7", "EmployeeEmergencyContact · EmployeeLanguage · EmployeeSkill · EmployeePosition · EmployeeWorkSchedule/Day", "EmployeeCompensation · EmployeeCompensationComponent · EmployeeLeavePolicy · LeaveBalance", "EmployeeDocument · WikiChecklistRun (15) · number_sequences", "Read-only: Membership, Team, Branch (01), Skill"], []) + "</div>";
  }

  /* =====================================================================================================================
     EMPLOYEE PROFILE — tabs: Overview, Job, Compensation, Skills, Documents, Leave, Attendance, Performance, Projects, Equipment, Onboarding, HR notes
     @screen People · Employee profile (Marco Silva, EMP-0012). Route "restricted" renders the same page for a viewer WITHOUT the sensitive permissions.
     @route  /people/employees/:employeeId?tab=overview|job|compensation|skills|documents|leave|attendance|performance|projects|equipment|onboarding|notes
     @perm   VIEW employees.employees.read (scope) or own record via employees.*.read_own · edit employees.employees.update · self edit employees.profile.update_own (limited to
             EmployeeHrSettings.self_service_editable_fields, may become an EmployeeProfileChangeRequest) · COMPENSATION tab employees.compensation.read* (manage*: edit) · DOCUMENTS tab employees.documents.read*
             (manage*) · HR NOTES tab employees.hr_notes.read* (manage*) · PERFORMANCE tab employees.performance.read_all* (own: read_own; manage*: write) · LEAVE tab employees.leave.read_all / read_own ·
             ATTENDANCE tab employees.attendance.read_all / read_own · SKILLS tab employees.skills.read (manage) · identity/bank/personal contact fields employees.personal_data.read* ·
             archive employees.employees.archive · delete employees.employees.delete*
     @api    GET /employees/:id (response omits restricted properties and lists them in `restricted_fields[]`) · PATCH /employees/:id · POST /employees/:id/position · POST /employees/:id/compensation ·
             GET /employees/:id/{leave,attendance,performance,documents,notes,skills,projects,onboarding} · POST /employees/:id/archive
     @mcp    employees_employees_read · employees_employees_update · employees_compensation_read (sensitive) · employees_documents_read (sensitive) · employees_hr_notes_read (sensitive)
     @data   Employee (all columns) · EmployeeEmergencyContact · EmployeeLanguage · EmployeePosition · EmployeeWorkSchedule/Day · EmployeeCompensation/Component · EmployeeSkill/Certification/Training · EmployeeDocument ·
             LeaveBalance/LeaveRequest · AttendanceRecord/Summary · PerformanceReview/Goal/Feedback/ImprovementPlan · EmployeeHrNote · WikiChecklistRun (15) · Read-only: ProjectMember/ProjectAllocation (05), Task (06), PayrollEntry (09)
     @ui     Header Card + Tabs (route-synced, lazy loaded per tab), Card/Table per block, Badge, Avatar, Tooltip on every Restricted chip, DropdownMenu for actions, Sheet for "Change position" and "New compensation"
     @states loading skeleton per tab · empty per tab · error · no-access (a tab the caller may not open is hidden, not shown empty) · stale (409) after concurrent edit
     @audit  EMPLOYEE_UPDATED (field diff, sensitive values masked), EMPLOYEE_POSITION_CHANGED, EMPLOYEE_COMPENSATION_CREATED, EMPLOYEE_SENSITIVE_FIELD_READ (when national id / bank / compensation is revealed)
     @note   Restricted is rendered per FIELD, never by blanking the page: the Overview still shows name, work contact, job and availability. A viewer who lacks a whole tab permission does not see the tab at all.
             Revealing a masked field (national id, IBAN) is an explicit click that writes an audit event. Header badges: employment_status, probation ending (probation_end_date within 30 d), contract ending.
             Employment type, location, manager and department shown here are the CURRENT position (history lives on the Job tab).
     ===================================================================================================================== */
  function profile(R) {
    const r = (k, v) => (R ? rs(k) : v);
    const PD = "employees.personal_data.read";
    const tabsList = [["ov", "Overview"], ["job", "Job"]].concat(R ? [] : [["comp", "Compensation"]], [["sk", "Skills", 9]], R ? [] : [["doc", "Documents", 6]], [["lv", "Leave"], ["at", "Attendance"]], R ? [] : [["pf", "Performance"]], [["pj", "Projects", 3], ["eq", "Equipment", 3], ["ob", "Onboarding"]], R ? [] : [["nt", "HR notes", 4]]);
    const hdr = '<div class="cd pp-hero"><div class="pp-hero-in">' + AV("MS", "g", "xl pp-big") + '<div class="grow"><h2>Marco Silva <span class="muted" style="font-weight:400">· Marco</span></h2><div class="muted">Senior Frontend Engineer · Engineering · Lisbon · reports to ' + nm("JK") + "</div>" +
      '<div class="pp-badges">' + stB("ACTIVE") + E("FULL_TIME") + E("REMOTE") + E("SENIOR") + avB("REMOTE") + '<span class="badge yellow" title="probation_end_date">Probation ends in 24 days</span></div></div>' +
      '<div class="acts">' + btn("Message", "chat") + btn("Request leave", "calendar") + btn("Change position", "layers") + btn("Edit", "edit", "primary") + more + "</div></div>" +
      '<div class="pp-hero-kv">' + kv("Employee no.", "EMP-0012") + kv("Hire date", "Jun 14, 2021 · 5 y 4 m") + kv("Work email", "marco.silva@acme-agency.com") + kv("Timezone", "Europe/Lisbon") + kv("Weekly capacity", "40 h · target 80%") + "</div></div>";
    const ovLeft = cd("<b>Personal and contact</b><span class='r muted'>Employee</span>",
      kv("Legal name", "Marco António Silva") + kv("Preferred name", "Marco") + kv("Date of birth", r(PD, "Mar 9, 1992")) + kv("Gender", r(PD, "Male")) + kv("Nationality", "Portugal") + kv("Work email", "marco.silva@acme-agency.com") + kv("Work phone", "+351 910 555 012") +
      kv("Personal email", r(PD, "marco.s@example.com")) + kv("Personal phone", r(PD, "+351 912 555 012")) + kv("Address", r(PD, "Rua das Flores 14, 1200-195 Lisboa, Portugal")) + kv("National ID number", r(PD, '•••• •••• 42 <button class="btn sm ghost">' + I("search", 12) + " Reveal</button>")) + kv("Tax ID", r(PD, "•••••• 118")) + kv("Social security number", r(PD, "•••••• 907")) + kv("Bank details", r(PD, "PT50 •••• •••• •••• 2210 3 · BIC BCOMPTPL"))) + sp +
      cd("<b>Emergency contacts</b><span class='r muted'>EmployeeEmergencyContact</span>", R ? '<div class="rowx">' + rs(PD) + "</div>" : row("Ana Silva", "Spouse · +351 912 000 000 · ana@example.com", E("PRIMARY", "green")) + row("Paulo Silva", "Brother · +351 913 000 000", ""), 1) + sp +
      cd("<b>About</b><span class='r muted'>bio · responsibilities · expertise · stack</span>", "<p>Frontend engineer focused on design systems and web performance. Leads the component library for client projects.</p>" + kv("Responsibilities", tagsx(["Own the design system", "Review pull requests", "Mentor juniors"])) + kv("Areas of expertise", tagsx(["Web performance", "Accessibility"])) + kv("Technical stack", tagsx(["React", "TypeScript", "Next.js", "Tailwind"])) + kv("Languages", "Portuguese (Native, primary) · English (Fluent) · Spanish (Conversational)") + kv("Resume / CV", "marco-silva-cv.pdf " + muted("(17)")));
    const ovRight = cd("<b>Status and availability</b>", kv("Employment status", stB("ACTIVE")) + kv("Since", "Jun 14, 2021") + kv("Availability", avB("REMOTE")) + kv("Availability note", "Remote until Nov 20") + kv("Probation ends", "Dec 5, 2026") + kv("Contract ends", "open-ended") + kv("Notice period", "60 days") + kv("Directory visible", sw(1))) + sp +
      cd("<b>Reporting line</b>", row(nm("JK"), "Manager · Engineering Lead", av("JK")) + row("Direct reports", "none", "") + row("Teams", "Web · Mobile · Design system guild", ""), 1) + sp +
      cd("<b>Upcoming</b>", row("Vacation Dec 22 – Jan 2", "Approved · 8 days", E("APPROVED", "green")) + row("Annual review H2 2026", "Due Dec 15", E("SELF_ASSESSMENT", "blue")) + row("Work anniversary", "Jun 14", ""), 1) + sp +
      cd("<b>Tags and custom fields</b>", '<div class="rowx" style="flex-wrap:wrap">' + tok("remote-first") + tok("mentor") + tok("design-system") + "</div>" + kv("Shirt size", "M " + muted("custom field (02)")), 0);
    const job = cd("<b>Current position</b><span class='r'>" + btn("Change position", "layers", "sm") + "</span>", kv("Job title", "Senior Frontend Engineer") + kv("Position", "Frontend") + kv("Role", "IC") + kv("Seniority level", E("SENIOR")) + kv("Department", "Engineering") + kv("Primary branch", "Lisbon") + kv("Manager", nm("JK")) + kv("Employment type", E("FULL_TIME")) + kv("Work location", E("REMOTE"))) + sp +
      cd("<b>Position history</b><span class='r muted'>EmployeePosition, effective-dated</span>", tbl(["From", "To", "Title", "Seniority", "Type", "Department", "Manager", "Reason", "Note"], [["Jan 1, 2025", "now", "Senior Frontend Engineer", E("SENIOR"), E("FULL_TIME"), "Engineering", nm("JK"), E("PROMOTION", "green"), "Design system lead"], ["Jun 1, 2023", "Dec 31, 2024", "Frontend Engineer", E("MID"), E("FULL_TIME"), "Engineering", nm("JK"), E("PROMOTION", "green"), ""], ["Mar 1, 2022", "May 31, 2023", "Frontend Engineer", E("JUNIOR"), E("FULL_TIME"), "Engineering", nm("TB"), E("MANAGER_CHANGE"), "Team reorganization"], ["Jun 14, 2021", "Feb 28, 2022", "Junior Developer", E("JUNIOR"), E("FULL_TIME"), "Engineering", nm("TB"), E("HIRE", "blue"), "Probation passed"]]), 1) + sp +
      cd("<b>Work schedule</b><span class='r muted'>EmployeeWorkSchedule · current since Jun 14, 2021</span>", kv("Name", "Standard 40 h") + kv("Type", E("FIXED")) + kv("Weekly hours", "40") + kv("Timezone", "Europe/Lisbon") + kv("Default location", E("REMOTE")) + '<div class="pp-week" style="margin-top:8px">' + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => '<div class="pp-wd' + (i > 4 ? " off" : "") + '"><b>' + d + "</b><span>" + (i > 4 ? "off" : "09:00–17:30") + "</span><small>" + (i > 4 ? "" : "break 30 · 8 h") + "</small></div>").join("") + "</div>");
    const compBody = '<div class="cd"><div class="cd-h"><b>Current compensation</b><span class="r">' + btn("New compensation", "plus", "sm") + '</span></div><div class="cd-b">' + kv("Effective from", "Jan 1, 2025") + kv("Employment type", E("FULL_TIME")) + kv("Pay type", E("MONTHLY_SALARY")) + kv("Base amount", "4 800.00 EUR / month") + kv("Employer cost / month", "1 020.00 EUR") + kv("Total cost / month", "5 820.00 EUR") + kv("Cost rate / hour", "33.60 EUR " + muted("synced to 18")) + kv("Billing rate default", "95.00 EUR") + kv("Contracted hours / week", "40") + kv("Bonus scheme", "Annual bonus up to 8%") + kv("Commission scheme", "—") + kv("Approved by", nm("AM") + " · Dec 18, 2024") + "</div></div>" + sp +
      cd("<b>Components</b><span class='r muted'>EmployeeCompensationComponent</span>", tbl(["Kind", "Name", ">Amount", ">% of base", "Frequency", "Paid to employee"], [[E("SOCIAL_CONTRIBUTION"), "Employer social contribution", "—", "21.25%", E("MONTHLY"), sw(0)], [E("INSURANCE"), "Health insurance", "45.00 EUR", "—", E("MONTHLY"), sw(0)], [E("ALLOWANCE"), "Meal allowance", "140.00 EUR", "—", E("MONTHLY"), sw(1)], [E("BONUS"), "Annual performance bonus", "—", "8%", E("ANNUAL"), sw(1)], [E("BENEFIT"), "Gym membership", "30.00 EUR", "—", E("MONTHLY"), sw(0)]]), 1) + sp +
      cd("<b>History</b><span class='r muted'>effective-dated, never edited in place</span>", tbl(["From", "To", "Pay type", ">Base", ">Cost rate / h", "Reason"], [["Jan 1, 2025", "now", E("MONTHLY_SALARY"), "4 800.00 EUR", "33.60", "Promotion to Senior"], ["Jun 1, 2023", "Dec 31, 2024", E("MONTHLY_SALARY"), "4 100.00 EUR", "28.70", "Annual review"], ["Jun 14, 2021", "May 31, 2023", E("MONTHLY_SALARY"), "3 000.00 EUR", "21.00", "Hire"]]), 1) + sp +
      cd("<b>Payroll (09)</b><span class='r muted'>read-only link</span>", row("Payroll schedule", "Monthly on the 28th · next Nov 28 · auto_generate", E("ACTIVE", "green")) + row("Latest entry", "Oct 2026 · SALARY · 5 820.00 EUR", E("POSTED", "green")) + '<div class="sub-note" style="padding:8px 12px">Expense records are created in 09 Income & Expense from this data. This module never records the expense. Needs finance.payroll.read to open the entries.</div>', 1);
    const comp = R ? '<div class="cd"><div class="cd-b"><div class="pp-lock">' + I("lock", 28) + "<b>Restricted</b><span>Compensation is field-level data. You need <b>employees.compensation.read</b> to see pay type, amounts, cost rate and billing rate.</span></div></div></div>" : compBody;
    const sk = cd("<b>Skills</b><span class='r'>" + btn("Add skill", "plus", "sm") + "</span>", tbl(["Skill", "Category", "Proficiency", ">Years", "Primary", "Last used", "Verified"], [["React", E("FRAMEWORK"), E("EXPERT", "green"), "6", sw(1), "Nov 2026", av("JK")], ["TypeScript", E("PROGRAMMING_LANGUAGE"), E("EXPERT", "green"), "6", sw(1), "Nov 2026", av("JK")], ["Next.js", E("FRAMEWORK"), E("ADVANCED", "blue"), "4", sw(0), "Nov 2026", muted("—")], ["Accessibility", E("DOMAIN"), E("ADVANCED", "blue"), "3", sw(0), "Oct 2026", muted("—")], ["Mentoring", E("SOFT_SKILL"), E("INTERMEDIATE"), "2", sw(0), "Nov 2026", muted("—")]]), 1) + sp +
      '<div class="g2">' + cd("<b>Certifications</b><span class='r muted'>EmployeeCertification</span>", row("Google UX Design", "Google · credential 8F2K-… · issued Mar 2024 · expires —", E("ACTIVE", "green")) + row("AWS Cloud Practitioner", "Amazon · issued Jan 2023 · expires Jan 2026", E("EXPIRED", "red")) + row("WCAG 2.2 Specialist", "IAAP · issued Sep 2025 · expires Sep 2028", E("ACTIVE", "green")), 1) +
      cd("<b>Training</b><span class='r muted'>EmployeeTraining</span>", row("Advanced React patterns", "Frontend Masters · 12 h · 340 EUR · Skill React", E("COMPLETED", "green")) + row("Public speaking", "Internal · 6 h · planned Dec 3", E("PLANNED", "blue")) + row("Next.js Conf workshop", "Vercel · 8 h · in progress", E("IN_PROGRESS", "blue")), 1) + "</div>";
    const docCols = ["Title", "Category", "Status", "Due / uploaded", "Expires", "Visible to employee", "Flags", ""];
    const doc = cd("<b>Employee documents</b><span class='r'>" + btn("Request document", "mail", "sm") + btn("Upload", "plus", "sm") + "</span>", tbl(docCols, [["Employment contract 2025", E("EMPLOYMENT_CONTRACT"), E("VERIFIED", "green"), "Jan 2, 2025", "—", sw(1), tok("signed") + " " + muted("04 · signature_request"), more], ["NDA", E("NDA"), E("VERIFIED", "green"), "Jun 14, 2021", "—", sw(1), "", more], ["Passport", E("IDENTIFICATION"), E("UPLOADED", "blue"), "Nov 2, 2026", "Aug 2031", sw(0), tok("confidential"), more], ["Health certificate", E("HR_FORM"), E("REQUESTED", "yellow"), "due Nov 25", "—", sw(1), "", more], ["Resume", E("RESUME"), E("VERIFIED", "green"), "Jun 10, 2021", "—", sw(0), "", more], ["Old bank form", E("HR_FORM"), E("EXPIRED", "red"), "Jun 2021", "Jun 2024", sw(0), "", more]]), 1) + '<div class="sub-note" style="margin-top:8px">The file itself is a Document in 17 (EMPLOYEE scope); this table is the HR index. Rejected uploads keep rejection_reason. Requests notify the employee (14).</div>';
    const lv = '<div class="pp-bal">' + [["Vacation", "22 + 3 carried", 11, 3, "of 25 d"], ["Sick leave", "unlimited", 2, 0, "taken"], ["Personal", "3", 1, 0, "of 3 d"], ["Time off (TOIL)", "adjusted +2", 0, 0, "of 2 d"]].map((b) => '<div class="stat"><small>' + b[0] + " · " + b[1] + "</small><strong>" + (b[0] === "Vacation" ? "11.0" : b[2]) + '</strong><span>' + (b[0] === "Vacation" ? "available · 11 used · 3 pending" : b[4]) + "</span></div>").join("") + "</div>" + sp +
      cd("<b>Leave history</b><span class='r'>" + btn("Request leave", "plus", "sm") + "</span>", tbl(["Type", "Dates", ">Days", "Status", "Decided by", "Reason"], [["Vacation", "Dec 22 – Jan 2", "8.0", E("APPROVED", "green"), nm("JK"), "Christmas"], ["Vacation", "Aug 4 – Aug 15", "10.0", E("APPROVED", "green"), nm("JK"), "Summer"], ["Sick", "Mar 3 – Mar 4", "2.0", E("APPROVED", "green"), nm("JK"), "Flu"], ["Personal", "Feb 14 (second half)", "0.5", E("REJECTED", "red"), nm("JK"), "Deadline week"], ["Vacation", "Nov 27", "1.0", E("PENDING", "blue"), muted("—"), "Long weekend"]]), 1);
    const at = '<div class="mini-stats">' + stat("Worked (Nov)", "62.5 h", "of 72 h scheduled") + stat("Overtime", "3.0 h", "1.5 h approved") + stat("Late arrivals", 1, "tolerance 10 min") + stat("Remote days", 7, "of 9 present") + stat("Absent", 0, "0 unexcused") + "</div>" +
      cd("<b>Recent days</b><span class='r muted'>AttendanceRecord</span>", tbl(["Date", "Status", "Location", "In", "Out", ">Worked", ">Break", ">Overtime", ">Late"], [["Wed, Nov 11", E("CLOCKED_IN", "blue"), E("REMOTE"), "09:04", "—", "4 h 10", "0:30", "0", "0"], ["Tue, Nov 10", E("COMPLETED", "green"), E("REMOTE"), "08:58", "18:12", "8 h 44", "0:30", "0:44", "0"], ["Mon, Nov 9", E("COMPLETED", "green"), E("REMOTE"), "09:21", "17:40", "7 h 49", "0:30", "0", "21 min"], ["Fri, Nov 6", E("COMPLETED", "green"), E("OFFICE"), "09:00", "17:30", "8 h 00", "0:30", "0", "0"], ["Thu, Nov 5", E("HOLIDAY", ""), E("REMOTE"), "—", "—", "0", "0", "0", "0"]]), 1);
    const pf = '<div class="g2">' + cd("<b>Reviews</b><span class='r muted'>PerformanceReview</span>", row("H2 2026 · Semi-annual", "Cycle H2 2026 · due Dec 15 · reviewer " + nm("JK"), E("SELF_ASSESSMENT", "blue")) + row("H1 2026 · Semi-annual", "Overall 4.2 / 5 · acknowledged Jul 12", E("ACKNOWLEDGED", "green")) + row("Probation review", "Overall 4.0 / 5 · Dec 2021", E("COMPLETED", "green")), 1) +
      cd("<b>Goals</b><span class='r muted'>PerformanceGoal</span>", row("Ship design system v2", "OBJECTIVE · due Dec 31", bar(70)) + row("Reduce LCP below 2 s", "KEY_RESULT · 1.9 s of 2.0 s", bar(95, "green")) + row("Mentor two juniors", "GOAL · AT_RISK", bar(40, "yellow")), 1) + "</div>" + sp +
      '<div class="g2">' + cd("<b>Feedback and recognition</b><span class='r muted'>PerformanceFeedback</span>", row("Recognition from " + nm("AM"), "Saved the Acme launch · RECOGNITION · public", av("AM")) + row("Manager feedback", "Great ownership, delegate more · MANAGER_FEEDBACK · employee visible", av("JK")) + row("Anonymous peer feedback", "Clear code reviews · PEER_FEEDBACK · managers only", ""), 1) +
      cd("<b>Improvement plan</b><span class='r muted'>PerformanceImprovementPlan</span>", '<div class="rowx"><div class="grow muted">No active plan. Plans need employees.performance.manage and are visible to HR and the manager only.</div>' + btn("Create plan", "plus", "sm") + "</div>", 1) + "</div>";
    const pj = cd("<b>Project assignments</b><span class='r muted'>read from 05, never edited here</span>", tbl(["Project", "Project role", ">Allocation", "From", "To", "Status"], [["Acme Rebrand Website", "Lead frontend", "60%", "Sep 1", "Dec 31", E("ACTIVE", "green")], ["Customer Portal Build", "Frontend", "30%", "Oct 1", "Jan 31", E("ACTIVE", "green")], ["Mobile App v2", "Reviewer", "10%", "Nov 1", "Dec 15", E("ACTIVE", "green")]]), 1) + sp +
      '<div class="g2">' + cd("<b>Workload (this week)</b><span class='r muted'>EmployeeCapacityPeriod</span>", kv("Scheduled", "40 h") + kv("Leave + holidays", "0 h") + kv("Available", "40 h") + kv("Planned (05)", "47 h") + kv("Logged (18)", "28.5 h") + kv("Utilization", '<span class="badge red">118%</span>') + kv("Status", E("OVERLOADED", "red")) + '<div class="sub-note">Open tasks: 9 (06) · 2 overdue</div>') +
      cd("<b>Open tasks (06)</b>", row("WEB-142 Rebuild pricing page hero", "In progress · due Nov 14", E("HIGH", "yellow")) + row("WEB-151 Client approval flow", "Blocked · due Nov 18", E("HIGH", "red")) + row("WEB-117 Dark mode widgets", "Backlog", ""), 1) + "</div>";
    const eq = callout("box", "Rows of <b>EmployeeEquipment</b> (asset_type, name, serial_number, assigned_on, expected_return_on, returned_on, condition, document_id). Read needs <b>employees.equipment.read</b>, assign / return needs <b>employees.equipment.manage</b>.", "") + sp +
      cd("<b>Equipment</b><span class='r'>" + btn("Assign equipment", "plus", "sm") + "</span>", tbl(["Item", "Type", "Serial", "Assigned", "Returned", "Condition"], [["MacBook Pro 14 M3", "Laptop", "C02XK1…", "Jun 14, 2021", "—", E("GOOD", "green")], ["iPhone 14", "Phone", "F17Q…", "Jan 3, 2023", "—", E("FAIR", "yellow")], ["LG UltraFine 27", "Monitor", "402NT…", "Jun 14, 2021", "—", E("GOOD", "green")]]), 1);
    const ob = cd("<b>Onboarding checklist</b><span class='r muted'>WikiChecklistRun (15) · status COMPLETED · 100%</span>", [["Sign contract and NDA", "HR", 1], ["Collect bank details", "HR", 1], ["Laptop ordered and configured", "IT", 1], ["Account and repo access", "Engineering Lead", 1], ["Buddy introduction", "Manager", 1], ["30-day check-in", "Manager", 1]].map((c) => '<div class="rowx">' + cb(c[2]) + '<div class="grow">' + c[0] + "<small>Owner " + c[1] + " · Task in 06 · WikiChecklistRunItem</small></div></div>").join("")) + '<div class="sub-note" style="margin-top:8px">Employee.onboarding_completed_at: Jul 14, 2021. Runs are owned by 15 and started by 20 or from here.</div>';
    const nt = '<div class="rowx" style="padding:0 0 10px"><div class="grow muted">Private notes. Visibility is per note (HrNoteVisibility). Every read needs employees.hr_notes.read*.</div>' + btn("Add note", "plus", "sm primary") + "</div>" +
      [["Warning · MINOR", "Missed a deadline twice on WEB-139. Agreed on weekly check-ins.", "WARNING", "HR_AND_MANAGERS", "MINOR", "Nov 3 · " + nm("JK"), 1], ["Meeting note", "1:1: wants to move toward tech lead track; discuss at H2 review.", "MEETING", "HR_AND_MANAGERS", "", "Oct 21 · " + nm("JK"), 0], ["Performance observation", "Excellent client demo, handled hard questions well.", "PERFORMANCE_OBSERVATION", "HR_ONLY", "INFO", "Oct 8 · " + nm("LN"), 0], ["HR comment", "Salary review request received, forward to Anna.", "HR_COMMENT", "HR_ONLY", "", "Sep 30 · " + nm("LN"), 0]].map((n) => '<div class="cd" style="margin-bottom:10px"><div class="cd-b"><div class="rowx" style="padding:0"><div class="grow"><b>' + n[0] + "</b><small>" + n[5] + "</small></div>" + E(n[2]) + E(n[3], "purple") + (n[4] ? E(n[4], n[4] === "MINOR" ? "yellow" : "") : "") + (n[6] ? '<span class="badge blue" title="requires_acknowledgement">Needs acknowledgement</span>' : "") + more + "</div><p>" + n[1] + "</p></div></div>").join("");
    const body = [["ov", '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' + ovLeft + "</div><div>" + ovRight + "</div></div>"], ["job", job], ["comp", comp], ["sk", sk], ["doc", doc], ["lv", lv], ["at", at], ["pf", pf], ["pj", pj], ["eq", eq], ["ob", ob], ["nt", nt]];
    const banner = R ? callout("lock", "<b>Preview as Kim Lund (Project Manager, scope: Delivery team).</b> This role holds employees.employees.read and employees.leave.read_all but NOT employees.compensation.read, employees.documents.read, employees.hr_notes.read, employees.performance.read_all or employees.personal_data.read. Those fields show <b>Restricted</b>, whole tabs are hidden.", "warn") + sp : "";
    return '<div class="a-page">' + banner + hdr + sp + '<div class="tabset pp-tabs">' + tabs(tabsList, "ov") + body.map((b, i) => (tabsList.some((t) => t[0] === b[0]) ? pane(b[0], i === 0, b[1]) : "")).join("") + "</div>" +
      dm(["Employee · all columns", "EmployeePosition · EmployeeWorkSchedule/Day · EmployeeEmergencyContact · EmployeeLanguage", "EmployeeCompensation · EmployeeCompensationComponent (employees.compensation.read)", "EmployeeSkill · EmployeeCertification · EmployeeTraining · Skill", "EmployeeEquipment (employees.equipment.read)", "EmployeeDocument (employees.documents.read) · EmployeeHrNote (employees.hr_notes.read)", "LeaveBalance · LeaveRequest · AttendanceRecord/Summary · EmployeeCapacityPeriod", "PerformanceReview · PerformanceGoal · PerformanceFeedback · PerformanceImprovementPlan(+Item)", "WikiChecklistRun (15) · PayrollSchedule/PayrollEntry (09) · Project allocation (05) · Task (06) · read-only"], []) + "</div>";
  }
  const profileFull = () => profile(false);
  const profileRestricted = () => profile(true);

  /* =====================================================================================================================
     PROFILE CHANGE REQUESTS — spec "Employee Self-Service"
     @screen People · Change requests
     @route  /people/changes?status=PENDING
     @perm   VIEW + decide employees.employees.update (HR) · the employee side (submit/cancel own) employees.profile.update_own
     @api    GET /employee-change-requests?status= · POST /employee-change-requests/:id/approve · /reject {decision_note} · POST /employees/me/change-requests (employee) · DELETE (cancel)
     @mcp    employees_employees_update (approve applies the diff through the same service)
     @data   EmployeeProfileChangeRequest (employee_id, status, changes Json, employee_note, submitted_by_user_id, decided_by_membership_id, decided_at, decision_note) · EmployeeHrSettings (self_service_editable_fields, profile_changes_require_approval) · Employee
     @ui     Table, Dialog for approve/reject with decision note, diff list (old value struck, new value bold), Badge
     @states loading · empty ("No pending requests") · error · no-access
     @audit  EMPLOYEE_CHANGE_REQUEST_SUBMITTED / APPROVED / REJECTED (applied diff)
     @note   `changes` is a Json map { field: { from, to } } limited to fields in self_service_editable_fields. When profile_changes_require_approval is off, the same edit applies directly and an audit event is written.
             Sensitive values (bank, address) appear masked in the list and revealed only inside the decision dialog for holders of the field key. Approval is atomic: it applies every change or none.
     ===================================================================================================================== */
  function changes() {
    const diff = (a, b) => '<span class="pp-old">' + a + "</span> " + I("right", 12) + " <b>" + b + "</b>";
    return '<div class="a-page">' + head("Profile change requests", "Self-service edits waiting for HR approval.", sel("Status: Pending", "filter")) +
      tbl(["Employee", "Changes", "Employee note", "Submitted", "Status", ""], [[wh("SJ", "EMP-0017"), "Personal phone " + diff("+45 20 11 22 33", "+45 20 99 88 77") + "<br>Address " + rs("employees.personal_data.read"), "Moved apartment", "Nov 10", E("PENDING", "blue"), btn("Review", "", "sm primary")], [wh("TB", "EMP-0021"), "Preferred name " + diff("Thomas", "Tom"), "", "Nov 9", E("PENDING", "blue"), btn("Review", "", "sm primary")], [wh("ER", "EMP-0027"), "Emergency contact " + diff("Marco R.", "Giulia R."), "Updated after wedding", "Nov 4", E("APPROVED", "green"), muted("Lena Novak · Nov 5")], [wh("HF", "EMP-0019"), "Bank details " + rs("employees.personal_data.read"), "New bank", "Oct 29", E("REJECTED", "red"), muted("Needs proof of account")], [wh("PN", "EMP-0024"), "Bio updated", "", "Oct 20", E("CANCELLED"), muted("withdrawn")]]) +
      sp + callout("shield", "Setting: <b>Profile changes require approval</b> is on. Editable by employees: preferred name, personal phone, address, emergency contacts, photo, bio. Configure in People > Settings.") +
      dm(["EmployeeProfileChangeRequest · status, changes, employee_note, decided_by_membership_id, decided_at, decision_note", "EmployeeHrSettings · self_service_editable_fields, profile_changes_require_approval"], []) + "</div>";
  }

  /* =====================================================================================================================
     ONBOARDING — spec "Employee Profiles", 20 workflows, 15 checklists, 06 tasks
     @screen People · Onboarding
     @route  /people/onboarding?status=
     @perm   VIEW employees.employees.read · start/complete employees.employees.update · checklist items assigned to HR use tasks.tasks.update (06) · document requests employees.documents.manage*
     @api    GET /employees?status=ONBOARDING · GET /checklist-runs?employee_id= (15) · POST /employees/:id/onboarding/start {checklist_id} · POST /employees/:id/onboarding/complete
     @mcp    employees_employees_update
     @data   Employee (employment_status ONBOARDING, hire_date, probation_end_date, onboarding_completed_at, manager_employee_id) · WikiChecklistRun (checklist_id, subject_membership_id, employee_id, status, progress_percent, due_at) ·
             WikiChecklistRunItem (status, task_id, completed_at, skipped_reason) · EmployeeDocument (REQUESTED / UPLOADED) · Task (06, read-only)
     @ui     Card per employee with Progress, Collapsible checklist, Table of document requests, Badge
     @states loading · empty ("Nobody is onboarding") · error · no-access
     @audit  EMPLOYEE_ONBOARDING_STARTED / COMPLETED
     @note   Checklists are a 15 feature (WikiChecklist templates); this screen only starts runs for an employee and shows progress. Completing the last mandatory item sets Employee.onboarding_completed_at; the
             status moves to ACTIVE on hire_date (daily job). Overdue steps are highlighted and notify the owner (14).
     ===================================================================================================================== */
  function onboarding() {
    const ob = (ini, tpl, pct, due, items) => cd('<div class="who">' + AV(ini, PP[ini][1], "lg") + "<div><b>" + nm(ini) + "</b><small>" + byIni(ini)[2] + " · starts " + byIni(ini)[10] + " · buddy " + nm("MS") + '</small></div></div><span class="r">' + E("IN_PROGRESS", "blue") + " " + bar(pct) + "</span>", '<div class="sub-note" style="padding:8px 12px">' + tpl + " · due " + due + "</div>" + items.map((c) => '<div class="rowx">' + cb(c[2]) + '<div class="grow">' + c[0] + "<small>Owner " + c[1] + (c[3] ? " · " + c[3] : "") + "</small></div></div>").join(""), 1);
    return '<div class="a-page">' + head("Onboarding", "New hires and their checklists.", btn("Start onboarding", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Onboarding", 4, "employees") + stat("Starting this week", 1, "Daniel Weiss") + stat("Overdue steps", 2, "owner notified", 1) + stat("Documents requested", 7, "3 overdue") + "</div>" +
      '<div class="g2">' + ob("DW", "Intern onboarding · 10 steps", 60, "Nov 30", [["Sign internship agreement", "HR", 1, ""], ["Laptop and accounts", "IT", 1, ""], ["Welcome lunch", "Manager", 1, ""], ["Security training", "Employee", 0, "Task WEB-210"], ["Set learning goals", "Manager", 0, "overdue 2 d"]]) +
      ob("TB", "Engineer onboarding · 14 steps", 85, "Nov 20", [["Sign contract and NDA", "HR", 1, ""], ["Repo and cloud access", "Engineering Lead", 1, ""], ["First PR merged", "Employee", 1, ""], ["30-day check-in", "Manager", 0, "due Nov 18"]]) + "</div>" + sp +
      cd("<b>Document requests</b><span class='r muted'>EmployeeDocument REQUESTED</span>", tbl(["Employee", "Document", "Category", "Status", "Due"], [[wh("DW"), "Internship agreement", E("EMPLOYMENT_CONTRACT"), E("UPLOADED", "blue"), "Nov 5"], [wh("DW"), "Identification", E("IDENTIFICATION"), E("REQUESTED", "yellow"), '<span class="badge red">overdue 2 d</span>'], [wh("DW"), "Bank details form", E("HR_FORM"), E("REQUESTED", "yellow"), "Nov 25"]]), 1) +
      dm(["Employee · employment_status, hire_date, onboarding_completed_at", "WikiChecklistRun · WikiChecklistRunItem (15)", "EmployeeDocument · status REQUESTED / UPLOADED", "Task (06, read-only)"], []) + "</div>";
  }

  /* =====================================================================================================================
     OFFBOARDING — spec "Employee Profiles", 20 workflows
     @screen People · Offboarding (Oskar Lind, EMP-0015)
     @route  /people/offboarding/:employeeId · list at /people/offboarding
     @perm   start / complete employees.employees.offboard* · final compensation and cost end date employees.compensation.manage* · deactivate the member users.members.offboard (01) ·
             exit interview note employees.hr_notes.manage*
     @api    POST /employees/:id/offboarding {termination_date, termination_reason, termination_kind, rehire_eligible} · POST /employees/:id/offboarding/complete · GET /checklist-runs?employee_id= (15)
     @mcp    employees_employees_offboard (sensitive: human confirmation)
     @data   Employee (employment_status OFFBOARDING -> TERMINATED, employment_status_since, termination_date, termination_reason, offboarding_completed_at, contract_end_date, notice_period_days) · EmployeePosition (closed,
             effective_to) · EmployeeCompensation (effective_to) · LeaveBalance (payout/expiry via LeaveBalanceTransaction EXPIRY/ADJUSTMENT) · LeaveRequest (cancel future) · WikiChecklistRun (15) · EmployeeHrNote (exit interview) · Membership (01, deactivate)
     @ui     Stepper layout (Card per step), DatePicker, Textarea, AlertDialog for the final confirmation (states every consequence), Switch, Progress
     @states loading · validation (termination_date before today needs a reason) · saving · error · no-access
     @audit  EMPLOYEE_OFFBOARDING_STARTED / COMPLETED, EMPLOYEE_TERMINATED, MEMBERSHIP_DEACTIVATED
     @note   Starting offboarding sets status OFFBOARDING and runs the offboarding checklist (15). On the termination_date a job: closes the open EmployeePosition and EmployeeCompensation, cancels future approved leave (balance
             reversal), reassigns open tasks (06) to the chosen person, ends project allocations (05), sets status TERMINATED, deactivates the Membership (01) and revokes API keys. The Employee row is kept (archived_at), never
             deleted: payroll, time entries and audit history reference it. termination_kind (EmployeeTerminationKind) is the typed reason, termination_reason the free-text detail, rehire_eligible the rehire flag.
     @note   Reason kind = Employee.termination_kind, rehire = Employee.rehire_eligible, exit interview = EmployeeHrNote category EXIT_INTERVIEW (HR_ONLY), equipment return = open EmployeeEquipment rows (returned_on null, employees.equipment.manage*).
     ===================================================================================================================== */
  function offboarding() {
    return '<div class="a-page">' + head("Offboarding", "Oskar Lind · DevOps Engineer · EMP-0015", btn("Cancel offboarding") + btn("Complete offboarding", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>1 · Departure</b><span class='r muted'>Employee</span>", two(f("Employment status", sel("Offboarding")), f("Status since", sel("Nov 4, 2026", "calendar"))) + two(f("Termination date (last working day)", sel("Dec 5, 2026", "calendar"), "termination_date. Notice period: 30 days."), f("Contract end date", sel("Dec 5, 2026", "calendar"))) +
        f("Termination reason", box("Resignation: moving abroad"), "Employee.termination_reason (free text).") + two(f("Reason kind", sel("Resignation") + '<div class="sub-note">Employee.termination_kind</div>'), f("Eligible for rehire", sw(1) + '<div class="sub-note">Employee.rehire_eligible</div>'))) + sp +
      cd("<b>2 · Checklist</b><span class='r muted'>WikiChecklistRun (15) · 62%</span>", [["Collect laptop and phone", "IT", 0, "EmployeeEquipment"], ["Revoke repo and cloud access", "Engineering Lead", 1, ""], ["Knowledge transfer sessions", "Manager", 1, "3 of 3"], ["Exit interview", "HR", 0, "Dec 3"], ["Final pay and leave payout", "HR", 0, "Dec 5"], ["Deactivate member and API keys", "Admin", 0, "on termination date"]].map((c) => '<div class="rowx">' + cb(c[2]) + '<div class="grow">' + c[0] + "<small>Owner " + c[1] + (c[3] ? " · " + c[3] : "") + "</small></div></div>").join(""), 1) + sp +
      cd("<b>3 · Handover</b>", f("Reassign open tasks to", sel(nm("JK"), "users"), "9 open tasks (06) will be reassigned on the termination date.") + f("Reassign direct reports to", sel("— none —", "users")) + f("Projects", row("Platform Infra", "Lead · 40% allocation ends Dec 5 (05)", "") + row("Data Warehouse Setup", "Reviewer · 10% ends Dec 5 (05)", ""), "")) + sp +
      cd("<b>4 · Exit interview</b><span class='r muted'>EmployeeHrNote · HR_ONLY</span>", '<div class="editor"><div class="ed-body">Notes from the exit interview. Stored as an EmployeeHrNote, category EXIT_INTERVIEW, visibility HR_ONLY.</div></div>') +
      "</div><div>" +
      cd("<b>Consequences on the last day</b>", row("Position and compensation", "EmployeePosition and EmployeeCompensation end Dec 5", "") + row("Leave", "Balance 6.5 d: payout via LeaveBalanceTransaction ADJUSTMENT; 1 future request cancelled", "") + row("Access", "Membership deactivated, 2 API keys revoked, sessions ended (01)", "") + row("Calendar", "Future events removed from availability (19)", "") + row("Payroll", "Final PayrollEntry drafted in 09 (finance.payroll.manage needed to post)", ""), 1) + sp +
      cd("<b>Equipment to return</b><span class='r muted'>EmployeeEquipment</span>", row("MacBook Pro 16", "serial C02Z…", E("OPEN")) + row("YubiKey", "", E("OPEN")), 1) + sp +
      callout("flag", "Final confirmation shows an AlertDialog listing every consequence above. The employee record is archived, never deleted.", "warn") + "</div></div>" +
      '<div class="sub-note" style="margin-top:14px">Other employees in offboarding: ' + wh("OL") + "</div>" +
      dm(["Employee · employment_status, employment_status_since, termination_date, termination_reason, termination_kind, rehire_eligible, contract_end_date, offboarding_completed_at, archived_at", "EmployeeEquipment · returned_on, condition", "EmployeePosition · EmployeeCompensation (effective_to) · LeaveBalance/LeaveBalanceTransaction · LeaveRequest", "WikiChecklistRun (15) · EmployeeHrNote · Membership (01) · Task (06) · ProjectAllocation (05)"], []) + "</div>";
  }

  /* =====================================================================================================================
     LEAVE REQUESTS — spec "Leave Management": approval workflow, history, conflict detection
     @screen People · Leave requests (+ approval detail)
     @route  /people/leave?status=PENDING&type=&employee=&from=&to=&view= · /people/leave/:requestId (detail panel)
     @perm   VIEW employees.leave.read_all (scope) or employees.leave.read_own · approve / reject employees.leave.approve (separate approval right, 01 §95; never your own request) · cancel on behalf employees.leave.manage_balances* ·
             create for someone else employees.leave.manage_balances*
     @api    GET /leave-requests?filter=&cursor= · POST /leave-requests/:id/approve {note} · /reject {note} · /cancel {cancellation_reason} · POST /leave-requests/bulk {ids, action}
     @mcp    employees_leave_read · employees_leave_approve (sensitive: human confirmation when an AI agent calls it)
     @data   LeaveRequest (status, start_date, end_date, start_day_part, end_day_part, total_days, total_hours, reason, attachment_document_id, covering_employee_id, current_approver_membership_id, submitted_at, decided_at,
             decided_by_membership_id, decision_note, cancelled_at, cancellation_reason, conflicts Json, has_conflicts, calendar_event_id) · LeaveRequestDay · LeaveRequestApproval (step, approver_membership_id, decision, comment) ·
             LeaveType · LeaveBalance (impact) · EmployeeLeavePolicy · CompanyHoliday / BranchHoliday (excluded days)
     @ui     Table with filter bar + saved view tabs, row checkboxes with a bulk approve/reject bar, Sheet (side detail) with approval stepper, Dialog for decision note, Badge, Tooltip for conflict reasons
     @states loading · empty ("No requests") · error · no-access · stale (already decided: 409 with the current state)
     @audit  LEAVE_REQUEST_SUBMITTED / APPROVED / REJECTED / CANCELLED / WITHDRAWN (with balance delta)
     @note   Approver chain comes from EmployeeHrSettings.leave_approver_strategy (DIRECT_MANAGER, HR, MANAGER_THEN_HR, CUSTOM = workflow in 20); each step is a LeaveRequestApproval row and current_approver_membership_id points to the
             open step. Conflicts (Json) are computed on submit: team overlap above leave_conflict_threshold_percent, blackout, project milestone, insufficient balance. They WARN, they do not block unless the policy says so.
             Approval moves days from pending_days to used_days (LeaveBalanceTransaction USAGE), creates EmployeeAvailabilityEntry rows and a CalendarEvent (19, calendar_event_id). Reject/cancel reverse pending/used (REVERSAL).
     ===================================================================================================================== */
  function leave() {
    const F = window.UI.filters;
    const R = [["MS", "Vacation", "Nov 27", "1.0", "PENDING", "Long weekend", 0], ["SJ", "Vacation", "Dec 15 – Dec 19", "5.0", "PENDING", "Family trip", 1], ["TB", "Sick", "Nov 10 – Nov 11", "2.0", "APPROVED", "Flu", 0], ["HF", "Vacation", "Nov 2 – Nov 20", "14.0", "APPROVED", "Travel", 0], ["PN", "Personal", "Nov 14 (first half)", "0.5", "PENDING", "Appointment", 0], ["ER", "Time off", "Nov 18", "1.0", "REJECTED", "Client workshop that day", 0], ["KL", "Vacation", "Dec 22 – Jan 2", "8.0", "APPROVED", "Christmas", 1], ["JK", "Parental", "Jan 5 – Mar 30", "62.0", "DRAFT", "", 0], ["DW", "Unpaid", "Nov 25", "1.0", "WITHDRAWN", "Exam", 0], ["OL", "Vacation", "Oct 6 – Oct 10", "5.0", "CANCELLED", "Moved", 0]];
    const sc = { PENDING: "blue", APPROVED: "green", REJECTED: "red", DRAFT: "yellow", CANCELLED: "", WITHDRAWN: "" };
    return '<div class="a-page">' + head("Leave requests", "Approve, reject and review time off.", btn("Export", "file") + btn("Request leave", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Pending", 3, "your queue: 2") + stat("Out today", 6, "5 approved, 1 sick") + stat("Conflicts", 1, "team overlap", 1) + stat("Avg. decision time", "9 h", "last 30 days") + "</div>" +
      '<div class="pp-views">' + [["Needs my approval", 2, 1], ["All pending", 3], ["Approved upcoming", 8], ["History", 142], ["Drafts", 1]].map((v) => '<span class="seg' + (v[2] ? " on" : "") + '">' + v[0] + ' <span class="count">' + v[1] + "</span></span>").join("") + "</div>" +
      '<div class="toolbar">' + search("Search employee, reason") + sel("Table", "grid") + sel("Sort: Start date", "sort") + sel("Views: Needs my approval", "star") + "</div>" +
      F.filterBar([["Status", "is any of", "Pending"], ["Leave type", "is any of", "Vacation, Personal"], ["Department", "is", "Engineering, Design"], ["Dates", "overlap", "Nov 1 – Dec 31"], ["Has conflicts", "is", "any"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span style="flex:1"></span>' + btn("Approve", "check", "sm primary") + btn("Reject", "x", "sm") + "</div>" +
      '<div class="g2" style="grid-template-columns:1.8fr 1fr;align-items:start"><div>' +
      tbl(["", "Employee", "Type", "Dates", ">Days", "Status", "Approver", "Conflicts", ""], R.map((r, i) => ["" + cb(i === 0 || i === 1), wh(r[0], byIni(r[0])[4]), E(r[1].toUpperCase().replace(" ", "_")), r[2] + (r[5] ? "<br><small class='muted'>" + r[5] + "</small>" : ""), r[3], E(r[4], sc[r[4]]), r[4] === "PENDING" ? av("JK") : muted("—"), r[6] ? '<span class="badge yellow" title="has_conflicts">' + I("flag", 11) + " Overlap</span>" : muted("—"), more])) +
      '<div class="pager"><span class="muted">1–10 of 154</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div></div>" +
      "<div>" + cd("<b>Sofia Jensen · Vacation</b><span class='r'>" + E("PENDING", "blue") + "</span>", kv("Dates", "Dec 15 – Dec 19, 2026") + kv("Day parts", "Full day · Full day") + kv("Total", "5.0 days · 40 h") + kv("Submitted", "Nov 10, 14:22") + kv("Reason", "Family trip") + kv("Covering", nm("KL")) + kv("Attachment", muted("not required")) + kv("Calendar event", muted("created on approval (19)"))) + sp +
      cd("<b>Balance impact</b><span class='r muted'>LeaveBalance 2026</span>", kv("Available before", "9.0 d") + kv("This request", "-5.0 d") + kv("Available after", "<b>4.0 d</b>") + kv("Pending others", "2.0 d")) + sp +
      cd("<b>Conflicts</b><span class='r muted'>conflicts Json</span>", row("Team overlap 40%", "Design: 2 of 5 out (threshold 30%)", '<span class="badge yellow">Warn</span>') + row("Milestone", "Acme Rebrand: Launch Dec 17 (05)", '<span class="badge yellow">Warn</span>'), 1) + sp +
      cd("<b>Approval chain</b><span class='r muted'>MANAGER_THEN_HR</span>", '<div class="tl"><div class="ev"><b>Step 1 · ' + nm("AM") + "</b> " + E("PENDING", "blue") + "<small>Direct manager</small></div><div class=\"ev\"><b>Step 2 · " + nm("LN") + "</b> " + E("SKIPPED") + "<small>HR · skipped for requests under 6 days</small></div></div>" + '<div class="rowx" style="padding:0">' + btn("Approve", "check", "primary") + btn("Reject", "x") + btn("Ask for details", "chat") + "</div>") + "</div></div>" +
      dm(["LeaveRequest · status, start_date, end_date, start_day_part, end_day_part, total_days, reason, covering_employee_id, current_approver_membership_id, has_conflicts, conflicts, decided_at, decision_note", "LeaveRequestApproval · step, approver_membership_id, decision, comment · LeaveRequestDay", "LeaveType · LeaveBalance · EmployeeHrSettings (leave_approver_strategy, leave_conflict_threshold_percent)", "CalendarEvent (19, read-only link)"], []) + "</div>";
  }

  /* =====================================================================================================================
     REQUEST LEAVE — full page (employee self-service and on behalf)
     @screen People · Request leave
     @route  /people/leave/new?employee=<id>&type=&from=&to=
     @perm   own request employees.leave.request_own · on behalf employees.leave.manage_balances* · half-day only if LeaveType.allows_half_day · attachment when LeaveType.requires_attachment (and the request is longer than attachment_after_days)
     @api    POST /leave-requests {employee_id?, leave_type_id, start_date, end_date, start_day_part, end_day_part, reason, covering_employee_id, attachment_document_id, submit: true|false} · POST /leave-requests/preview (days, balance, conflicts)
     @mcp    employees_leave_request_create
     @data   LeaveRequest · LeaveRequestDay (one row per day, half days, hours) · LeaveType (requires_approval, requires_attachment, attachment_after_days, allows_half_day, deducts_balance, min_notice_days, max_consecutive_days) ·
             LeaveBalance · CompanyHoliday/BranchHoliday · EmployeeWorkSchedule (working days only) · Document (17)
     @ui     Form with live preview Card, Select (leave type), range DatePicker with holiday and conflict markers, ToggleGroup for day parts, Combobox for the covering colleague, file drop zone, Switch
     @states validation inline (notice period, max consecutive, insufficient balance when negative not allowed, overlapping own request) · saving · submitted toast · error · no-access
     @audit  LEAVE_REQUEST_SUBMITTED (or created as DRAFT)
     @note   total_days counts working days from the employee's EmployeeWorkSchedule minus company and branch holidays; half days count 0.5. The preview endpoint returns the days, the balance impact and the conflicts before
             submit. Types with requires_approval = false are approved on submit. "Save as draft" creates status DRAFT; "Withdraw" later sets WITHDRAWN.
     ===================================================================================================================== */
  function leavenew() {
    return '<div class="a-page">' + head("Request leave", "Marco Silva · EMP-0012", btn("Cancel") + btn("Save as draft") + btn("Submit request", "send", "primary")) +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>Request</b>", f("Leave type", sel("Vacation", "calendar"), "Paid · needs approval · deducts balance · min notice 14 days · max 15 consecutive days") + two(f("Start date", sel("Dec 22, 2026", "calendar")), f("End date", sel("Jan 2, 2027", "calendar"))) +
        two(f("First day", seg(["Full day", "First half", "Second half"], "Full day")), f("Last day", seg(["Full day", "First half", "Second half"], "Full day"))) + f("Reason", '<div class="editor"><div class="ed-body" style="min-height:60px">Christmas holidays</div></div>') +
        f("Covering colleague", sel(nm("TB"), "users"), "LeaveRequest.covering_employee_id. Notified when approved.") + f("Attachment", '<div class="drop">' + I("clip", 16) + " Not required for this type. Sick leave over 3 days needs a certificate.</div>")) + sp +
      cd("<b>Day breakdown</b><span class='r muted'>LeaveRequestDay</span>", tbl(["Date", "Day part", ">Hours", "Note"], [["Tue, Dec 22", E("FULL_DAY"), "8", ""], ["Wed, Dec 23", E("FULL_DAY"), "8", ""], ["Thu, Dec 24", E("FULL_DAY"), "8", ""], ["Fri, Dec 25", muted("excluded"), "0", "Public holiday (Christmas)"], ["Sat–Sun", muted("excluded"), "0", "Not a working day"], ["Mon, Dec 28 – Thu, Dec 31", E("FULL_DAY"), "32", "4 days"], ["Fri, Jan 1", muted("excluded"), "0", "Public holiday"]]), 1) +
      "</div><div>" + cd("<b>Summary</b>", kv("Working days", "<b>8.0</b>") + kv("Hours", "64 h") + kv("Balance now", "11.0 d") + kv("After approval", "<b>3.0 d</b>") + kv("Approver", nm("JK") + " then " + nm("LN"))) + sp +
      cd("<b>Conflicts</b>", row("Team availability", "Engineering: 2 of 6 out that week (33%)", '<span class="badge yellow">Warn</span>') + row("Holidays", "Dec 25 and Jan 1 are not counted", '<span class="badge green">OK</span>') + row("Project milestones", "None in range", '<span class="badge green">OK</span>'), 1) + sp +
      callout("shield", "Within the notice period? Requests shorter than <b>min_notice_days</b> are blocked or flagged depending on the policy.") + "</div></div>" +
      dm(["LeaveRequest · every column on create", "LeaveRequestDay · LeaveType rules · LeaveBalance · CompanyHoliday · BranchHoliday · EmployeeWorkSchedule(Day)"], []) + "</div>";
  }

  /* =====================================================================================================================
     LEAVE CALENDAR — spec "Leave Management": calendar, team availability during leave, upcoming leave
     @screen People · Leave calendar
     @route  /people/leave-calendar?month=2026-12&team=&branch=&type=
     @perm   VIEW employees.leave.read_all (scope) · own row only with employees.leave.read_own · availability colours need employees.directory.read · edit availability employees.availability.manage
     @api    GET /leave-calendar?from=&to=&team_id=&branch_id= · POST /employees/:id/availability {status, starts_at, ends_at, all_day, note}
     @mcp    employees_leave_read · employees_availability_manage
     @data   LeaveRequestDay (approved and pending days) · EmployeeAvailabilityEntry (status, starts_at, ends_at, all_day, source) · CompanyHoliday + BranchHoliday · Employee (availability_status) · LeaveType.color
     @ui     Resource timeline grid (rows people, columns days), Popover on a cell, ToggleGroup Month/Week, Select filters, Legend
     @states loading · empty · error · no-access
     @note   Rows come from the 19 calendar projection plus this module's entries. Pending requests are hatched, approved solid. A column summary shows how many people are out per day against leave_conflict_threshold_percent.
             Holidays are the union of CompanyHoliday and BranchHoliday (01 §122) for the person's primary branch.
     ===================================================================================================================== */
  function leavecal() {
    const days = Array.from({ length: 21 }, (_, i) => (i + 14 > 31 ? i + 14 - 31 : i + 14));
    const M = { MS: [[8, 19, "v"]], SJ: [[1, 5, "v", 1]], KL: [[8, 19, "v"]], HF: [[0, 4, "v"]], TB: [[0, 0, "s"]], PN: [[0, 0, "p", 1]], ER: [[4, 4, "t"]], AM: [] };
    const hol = [11];
    return '<div class="a-page">' + head("Leave calendar", "Who is out, when. December 2026.", sel("Month", "calendar") + sel("All teams", "users") + sel("All branches", "building") + btn("Request leave", "plus", "primary")) +
      '<div class="pp-leg"><span><i class="lg v"></i>Vacation</span><span><i class="lg s"></i>Sick</span><span><i class="lg p"></i>Personal</span><span><i class="lg t"></i>Training / travel</span><span><i class="lg h"></i>Holiday</span><span><i class="lg pend"></i>Pending</span></div>' +
      '<div class="pp-cal"><div class="pp-cal-h"><span class="pp-cal-l"></span>' + days.map((d, i) => "<span" + (i % 7 >= 5 ? ' class="we"' : "") + ">" + d + "</span>").join("") + "</div>" +
      ["MS", "SJ", "KL", "HF", "TB", "PN", "ER", "AM"].map((k) => '<div class="pp-cal-r"><span class="pp-cal-l">' + AV(k, PP[k][1]) + nm(k) + "</span>" + days.map((d, i) => {
        const seg2 = (M[k] || []).find((s) => i >= s[0] && i <= s[1]);
        const h = i === 11 || i === 12;
        return '<span class="' + (i % 7 >= 5 ? "we " : "") + (h ? "h " : "") + (seg2 ? "x " + seg2[2] + (seg2[3] ? " pend" : "") : "") + '"></span>';
      }).join("") + "</div>").join("") +
      '<div class="pp-cal-r pp-cal-sum"><span class="pp-cal-l">Out per day (of 8)</span>' + days.map((d, i) => "<span>" + (Object.keys(M).filter((k) => (M[k] || []).some((x) => i >= x[0] && i <= x[1])).length || "") + "</span>").join("") + "</div></div>" +
      '<div class="g2" style="margin-top:12px">' + cd("<b>Holidays in range</b><span class='r muted'>CompanyHoliday</span>", row("Christmas Day", "Dec 25 · PUBLIC · recurring", E("PUBLIC")) + row("Company winter break", "Dec 28 – Dec 31 · COMPANY · half-day Dec 24", E("COMPANY", "purple")) + row("Lisbon: Restoration of Independence", "Dec 1 · branch holiday (01 §122)", E("PUBLIC")), 1) +
      cd("<b>Upcoming leave</b>", row(nm("SJ") + " · Vacation", "Dec 15 – Dec 19 · pending", E("PENDING", "blue")) + row(nm("KL") + " · Vacation", "Dec 22 – Jan 2", E("APPROVED", "green")) + row(nm("MS") + " · Vacation", "Dec 22 – Jan 2", E("APPROVED", "green")), 1) + "</div>" +
      dm(["LeaveRequestDay · LeaveRequest.status · LeaveType.color", "EmployeeAvailabilityEntry · CompanyHoliday · BranchHoliday (01)", "CalendarEvent (19, projection)"], []) + "</div>";
  }

  /* =====================================================================================================================
     LEAVE BALANCES — spec "Leave Management": balances, ledger, adjustments
     @screen People · Leave balances
     @route  /people/balances?year=2026&type=&department=
     @perm   VIEW employees.leave.read_all · adjust / carry over / accrue manually employees.leave.manage_balances* (reason required)
     @api    GET /leave-balances?period=&leave_type_id= · GET /leave-balances/:id/transactions · POST /leave-balances/:id/adjust {days, reason}
     @mcp    employees_leave_manage_balances (sensitive)
     @data   LeaveBalance (period_start, period_end, entitled_days, accrued_days, carried_over_days, adjusted_days, used_days, pending_days, carry_over_expires_on, last_accrued_at) · LeaveBalanceTransaction (type, days,
             effective_on, reason, created_by_membership_id, leave_request_id) · LeaveType · EmployeeLeavePolicy
     @ui     Table with progress, Sheet with the ledger, Dialog "Adjust balance" (days, reason), Tabs per leave type
     @states loading · empty · error · no-access
     @audit  LEAVE_BALANCE_ADJUSTED (days, reason), LEAVE_CARRY_OVER_APPLIED, LEAVE_ACCRUAL_RUN
     @note   available = entitled + accrued + carried_over + adjusted - used - pending (computed, not stored). The ledger (LeaveBalanceTransaction) is append-only; a correction is a REVERSAL or ADJUSTMENT row.
             Accruals and carry-over run from a scheduled job (20) according to LeavePolicy; carried-over days expire on carry_over_expires_on (EXPIRY).
     ===================================================================================================================== */
  function balances() {
    const B = [["MS", 22, 0, 3, 0, 11, 3], ["SJ", 22, 0, 0, 0, 13, 5], ["TB", 20, 0, 0, 2, 9, 0], ["KL", 25, 0, 4, 0, 18, 8], ["HF", 22, 0, 2, 0, 16, 0], ["PN", 11, 0, 0, 0, 4, 0], ["ER", 22, 0, 1, 0, 12, 1]];
    return '<div class="a-page">' + head("Leave balances", "Vacation · period Jan 1 – Dec 31, 2026.", btn("Run accrual", "zap") + btn("Export", "file")) +
      '<div class="tabset">' + tabs([["v", "Vacation"], ["s", "Sick leave"], ["p", "Personal"], ["t", "Time off"]], "v") + pane("v", 1,
        '<div class="toolbar">' + search("Search employee") + sel("Department", "users") + sel("Year: 2026", "calendar") + "</div>" +
        tbl(["Employee", ">Entitled", ">Accrued", ">Carried over", ">Adjusted", ">Used", ">Pending", ">Available", "Carry-over expires", ""], B.map((b) => [wh(b[0], byIni(b[0])[4]), b[1], b[2], b[3], b[4] ? "+" + b[4] : "0", b[5], b[6], "<b>" + (b[1] + b[2] + b[3] + b[4] - b[5] - b[6]).toFixed(1) + "</b>", b[3] ? "Mar 31, 2027" : muted("—"), btn("Adjust", "", "sm")])) +
        sp + cd("<b>Ledger · Marco Silva</b><span class='r muted'>LeaveBalanceTransaction</span>", tbl(["Date", "Type", ">Days", "Reason", "By"], [["Nov 10", E("USAGE"), "-1.0", "Request Nov 27 (pending)", muted("system")], ["Aug 15", E("USAGE"), "-10.0", "Summer vacation", muted("system")], ["Jul 1", E("ADJUSTMENT", "blue"), "+0.0", "", nm("LN")], ["Jan 1", E("CARRY_OVER", "purple"), "+3.0", "From 2025, expires Mar 31", muted("system")], ["Jan 1", E("ACCRUAL", "green"), "+22.0", "ANNUAL_UPFRONT · Portugal standard", muted("system")]]), 1)) +
      pane("s", 0, '<div class="sub-note">Sick leave: no deduction (deducts_balance off), used days only.</div>') + pane("p", 0, '<div class="sub-note">Personal leave: 3 days a year.</div>') + pane("t", 0, '<div class="sub-note">Time off in lieu from approved overtime.</div>') + "</div>" +
      dm(["LeaveBalance · all columns", "LeaveBalanceTransaction · type, days, effective_on, reason, created_by_membership_id", "LeaveType · LeavePolicy · EmployeeLeavePolicy"], []) + "</div>";
  }

  /* =====================================================================================================================
     ATTENDANCE — spec "Attendance & Working Hours": clock in/out, breaks, overtime, summaries
     @screen People · Attendance
     @route  /people/attendance?date=&week=&team=&status= · my clock card at /people/attendance (record_own)
     @perm   VIEW employees.attendance.read_all (scope) or read_own · clock in / out / break employees.attendance.record_own · edit a record or approve overtime employees.attendance.manage* (reason, audited) ·
             export employees.employees.export*
     @api    POST /attendance/clock-in {work_location, note} · /clock-out · /break/start · /break/end · GET /attendance/records?date= · PATCH /attendance/records/:id (manager edit) · POST /attendance/records/:id/approve-overtime ·
             GET /attendance/summaries?period_type=WEEK|MONTH
     @mcp    employees_attendance_read · employees_attendance_manage (sensitive)
     @data   AttendanceRecord (date, status, work_location, first_clock_in_at, last_clock_out_at, scheduled_minutes, worked_minutes, break_minutes, overtime_minutes, late_minutes, early_leave_minutes, overtime_approved,
             prefilled_time_entry_id, edited_by_membership_id) · AttendanceSession (clock_in_at, clock_out_at, work_location, clock_in_source, clock_out_source, meta) · AttendanceBreak (kind PAID/UNPAID, started_at, ended_at) ·
             AttendanceSummary (period_type WEEK/MONTH, days_*, late_count, overtime_minutes) · EmployeeHrSettings (attendance_required, allowed_clock_sources, late_tolerance_minutes, overtime_threshold_minutes, overtime_requires_approval,
             prefill_time_entries_from_attendance) · EmployeeWorkSchedule
     @ui     Clock Card with live timer, Table, Sheet for sessions and breaks, Dialog "Edit record" (reason), Tabs Today / Week / Month, Badge
     @states loading · empty · error · no-access · already clocked in (409) · source not allowed (EmployeeHrSettings.allowed_clock_sources)
     @audit  ATTENDANCE_CLOCK_IN / CLOCK_OUT, ATTENDANCE_RECORD_EDITED (before/after, reason), ATTENDANCE_OVERTIME_APPROVED
     @note   Presence only. Attendance may pre-fill the daily total of a 18 Time entry (prefilled_time_entry_id) but never replaces time entries. Several sessions per day are allowed; lateness is measured against the schedule
             after late_tolerance_minutes; overtime = worked above scheduled and above overtime_threshold_minutes, approved when overtime_requires_approval. clock_in_meta (Json) may hold IP / device, never GPS without consent.
             Summaries are materialized by a scheduled job (20); a manager edit recomputes the day and the summary.
     ===================================================================================================================== */
  function attendance() {
    const A = [["MS", "CLOCKED_IN", "REMOTE", "09:04", "—", "4 h 10", "0:30", "0", "0", 0], ["JK", "CLOCKED_IN", "HYBRID", "08:47", "—", "4 h 30", "0:20", "0", "0", 0], ["TB", "COMPLETED", "OFFICE", "09:00", "17:30", "8 h 00", "0:30", "0", "0", 0], ["SJ", "CLOCKED_IN", "OFFICE", "09:38", "—", "3 h 40", "0:00", "0", "38 min", 0], ["KL", "CLOCKED_IN", "OFFICE", "08:30", "—", "4 h 45", "0:30", "0", "0", 0], ["HF", "ON_LEAVE", "REMOTE", "—", "—", "0", "0", "0", "0", 0], ["PN", "CLOCKED_IN", "REMOTE", "10:00", "—", "3 h 20", "0:15", "0", "0", 0], ["ER", "EXCUSED", "CLIENT_SITE", "—", "—", "0", "0", "0", "0", 0], ["OL", "ABSENT", "REMOTE", "—", "—", "0", "0", "0", "0", 0], ["AM", "COMPLETED", "OFFICE", "07:55", "17:05", "8 h 40", "0:30", "0:40", "0", 1]];
    const sc = { CLOCKED_IN: "blue", COMPLETED: "green", ABSENT: "red", ON_LEAVE: "yellow", HOLIDAY: "", EXCUSED: "" };
    return '<div class="a-page">' + head("Attendance", "Wednesday, Nov 11, 2026", sel("Today", "calendar") + sel("All teams", "users") + btn("Export", "file")) +
      '<div class="g2" style="grid-template-columns:1fr 2fr;align-items:start"><div>' +
      cd("<b>My clock</b><span class='r muted'>record_own</span>", '<div class="pp-clock"><div class="pp-time">04:12:36</div><div class="muted">Clocked in 09:04 via WEB · Remote</div></div><div class="rowx" style="padding:0">' + btn("Clock out", "clock", "primary") + btn("Start break", "time") + sel("Remote", "globe") + "</div><div class='sub-note' style='margin-top:8px'>Sessions today: 1 · breaks 0:30 paid (lunch) · scheduled 8 h</div>") + sp +
      cd("<b>Overtime to approve</b><span class='r muted'>attendance.manage</span>", row(nm("AM") + " · Nov 11", "0:40 above 8 h · threshold 15 min", btn("Approve", "", "sm primary")) + row(nm("MS") + " · Nov 10", "0:44 above scheduled", btn("Approve", "", "sm primary")), 1) +
      "</div><div>" + '<div class="mini-stats">' + stat("Present", 7, "of 12 scheduled") + stat("Remote", 5, "of 7") + stat("On leave", 1, "") + stat("Late", 1, "tolerance 10 min", 1) + stat("Absent", 1, "unexcused", 1) + "</div>" +
      tbl(["Employee", "Status", "Location", "First in", "Last out", ">Worked", ">Break", ">Overtime", ">Late", ""], A.map((a) => [wh(a[0]), E(a[1], sc[a[1]]), E(a[2]), a[3], a[4], a[5], a[6], a[7] === "0" ? "0" : '<span class="badge yellow">' + a[7] + "</span>" + (a[9] ? ' <span class="badge blue" title="overtime_approved">Needs approval</span>' : ""), a[8] === "0" ? "0" : '<span class="badge red">' + a[8] + "</span>", more])) + "</div></div>" + sp +
      '<div class="g2">' + cd("<b>Weekly summary</b><span class='r muted'>AttendanceSummary · WEEK · Nov 9 – Nov 15</span>", tbl(["Employee", ">Scheduled", ">Worked", ">Overtime", ">Present", ">Remote", ">Late"], [[wh("MS"), "40 h", "20.6 h", "0:44", "2", "2", "1"], [wh("TB"), "40 h", "16.0 h", "0", "2", "0", "0"], [wh("KL"), "40 h", "21.2 h", "0", "2", "0", "0"]]), 1) +
      cd("<b>Monthly summary</b><span class='r muted'>AttendanceSummary · MONTH · November</span>", tbl(["Employee", ">Worked", ">Present", ">Absent", ">On leave", ">Holiday", ">Overtime"], [[wh("MS"), "62.5 h", "9", "0", "0", "1", "3:00"], [wh("TB"), "58.0 h", "7", "0", "2", "1", "0"], [wh("HF"), "0 h", "0", "0", "14", "1", "0"]]), 1) + "</div>" +
      cd("<b>Session detail · Marco Silva · Nov 11</b><span class='r muted'>AttendanceSession · AttendanceBreak</span>", row("Session 1", "09:04 → running · WEB · Remote", E("CLOCKED_IN", "blue")) + row("Break", "12:30 – 13:00 · PAID · lunch", E("PAID")) + row("Edited by", "not edited", ""), 1) +
      dm(["AttendanceRecord · status, work_location, first_clock_in_at, last_clock_out_at, scheduled_minutes, worked_minutes, break_minutes, overtime_minutes, late_minutes, overtime_approved", "AttendanceSession · AttendanceBreak · AttendanceSummary", "EmployeeHrSettings · attendance_required, allowed_clock_sources, late_tolerance_minutes, overtime_threshold_minutes, overtime_requires_approval"], []) + "</div>";
  }

  /* =====================================================================================================================
     PAYROLL ENTRIES — spec "Compensation": payroll expenses are created in 09 from this module's data
     @screen People · Payroll entries (read-only window onto 09)
     @route  /people/payroll?period=2026-11&status=&employee=
     @perm   VIEW finance.payroll.read* AND employees.compensation.read* (both: the amounts come from compensation) · create / approve / post finance.payroll.manage* (module 09; separation of duties 01 §96)
     @api    GET /payroll-entries?period=&status= (09) · POST /payroll-entries/generate {period} · POST /payroll-entries/:id/approve · /post
     @mcp    finance_payroll_read (09)
     @data   PayrollEntry (employee_id, employee_name_snapshot, department_id, schedule_id, period_start, period_end, kind, status, currency, base_amount, employer_cost_amount, total_amount, hours, hourly_rate, payment_date,
             ledger_record_id) · PayrollSchedule (employee_id, interval, payment_day, next_occurrence_date, auto_generate, status) · EmployeeCompensation (source of amounts, read-only)
     @ui     Table with period Select, Badge, link to 09 for actions; Restricted card when the caller lacks either key
     @states loading · empty · error · no-access (Restricted card, not an empty table)
     @audit  PAYROLL_ENTRY_GENERATED / APPROVED / POSTED (09)
     @note   This module NEVER records the expense. The screen exists so HR sees, next to the employee, what 09 generated from EmployeeCompensation; actions deep-link into 09 (Expenses > Payroll). Entry kinds are PayrollEntryKind
             (SALARY, MONTHLY_PAYMENT, HOURLY_PAYMENT, BONUS, COMMISSION, OVERTIME, EMPLOYER_COST, BENEFIT, REIMBURSEMENT, OTHER); statuses DRAFT, APPROVED, POSTED, CANCELLED.
     ===================================================================================================================== */
  function payroll() {
    const P = [["MS", "SALARY", "4 800.00", "1 020.00", "5 820.00", "DRAFT", "Nov 28"], ["JK", "SALARY", "6 200.00", "1 318.00", "7 518.00", "DRAFT", "Nov 28"], ["TB", "SALARY", "3 900.00", "829.00", "4 729.00", "DRAFT", "Nov 28"], ["PN", "HOURLY_PAYMENT", "1 540.00", "327.00", "1 867.00", "APPROVED", "Nov 28"], ["SJ", "SALARY", "4 300.00", "914.00", "5 214.00", "APPROVED", "Nov 28"], ["MS", "OVERTIME", "148.00", "0.00", "148.00", "DRAFT", "Nov 28"], ["ER", "COMMISSION", "1 850.00", "0.00", "1 850.00", "DRAFT", "Dec 5"], ["KL", "SALARY", "5 100.00", "1 084.00", "6 184.00", "POSTED", "Oct 28"]];
    const sc = { DRAFT: "yellow", APPROVED: "blue", POSTED: "green", CANCELLED: "" };
    return '<div class="a-page">' + head("Payroll entries", "Generated in Income & expenses (09) from compensation records. Read-only here.", btn("Open in Expenses", "link") + sel("Period: Nov 2026", "calendar")) +
      callout("lock", "Requires <b>finance.payroll.read</b> and <b>employees.compensation.read</b>. Without them: <span class='rst'>" + I("lock", 12) + " Restricted</span> instead of this table.") + sp +
      '<div class="mini-stats">' + stat("Entries", 8, "Nov 2026") + stat("Total cost", "33 330 EUR", "incl. employer cost") + stat("Draft", 5, "to approve") + stat("Posted", 1, "ledger records") + "</div>" +
      tbl(["Employee", "Kind", ">Base", ">Employer cost", ">Total", "Status", "Payment date", "Ledger"], P.map((p) => [wh(p[0], byIni(p[0])[4]), E(p[1]), p[2] + " EUR", p[3] + " EUR", "<b>" + p[4] + " EUR</b>", E(p[5], sc[p[5]]), p[6], p[5] === "POSTED" ? tok("LedgerRecord") : muted("—")])) +
      '<div class="g2" style="margin-top:12px">' + cd("<b>Payroll schedules</b><span class='r muted'>PayrollSchedule</span>", row(nm("MS"), "SALARY · monthly on the 28th · next Nov 28 · auto_generate", E("ACTIVE", "green")) + row(nm("PN"), "HOURLY_PAYMENT · monthly · timesheet driven", E("ACTIVE", "green")) + row(nm("OL"), "SALARY · ends Dec 5", E("PAUSED", "yellow")), 1) +
      cd("<b>Where the numbers come from</b>", row("Base amount", "EmployeeCompensation.base_amount (effective on the period)", "") + row("Employer cost", "employer_cost_monthly + components", "") + row("Hours and rate", "TimeEntry (18) for HOURLY / DAILY", "") + row("Overtime", "AttendanceRecord.overtime_minutes (approved)", ""), 1) + "</div>" +
      dm(["PayrollEntry · PayrollSchedule (09, read-only)", "EmployeeCompensation · AttendanceRecord.overtime_minutes (inputs)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CAPACITY & WORKLOAD — spec "Capacity & Workload"
     @screen People · Capacity
     @route  /people/capacity?period=WEEK&from=2026-11-09&team=&branch=&status=
     @perm   VIEW employees.capacity.read (scope-limited: Project Manager, Team Lead, HR) · planned hours need projects.projects.read (05) · edit availability employees.availability.manage
     @api    GET /capacity?period_type=&from=&to=&team_id=&status= · GET /capacity/:employeeId/breakdown · POST /capacity/recompute (job)
     @mcp    employees_capacity_read
     @data   EmployeeCapacityPeriod (period_type DAY/WEEK/MONTH, period_start, period_end, scheduled_hours, leave_hours, holiday_hours, available_hours, planned_hours, logged_hours, allocation_percent, utilization_percent,
             status UNDERUTILIZED/BALANCED/OVERLOADED, breakdown Json) · EmployeeHrSettings (target_utilization_percent, overload_threshold_percent, underutilized_threshold_percent) · EmployeeWorkSchedule · LeaveRequestDay ·
             Read-only: ProjectAllocation (05 planned), TimeEntry (18 logged), Task (06 estimates)
     @ui     Heat-map table (people x weeks), Card with bar breakdown, Sheet (per-person breakdown: schedule - leave - holidays), Select filters, Popover cells
     @states loading · empty · error · no-access · "capacity not computed yet" for new periods
     @note   Ownership split (05 §51): this module owns available hours (schedule minus leave minus holidays); planned_hours is copied from 05, logged_hours from 18, never edited here. allocation_percent = planned / available,
             utilization_percent = logged / available. Status thresholds come from EmployeeHrSettings. The AI assistant reads this screen to suggest balancing (never applies it).
     ===================================================================================================================== */
  function capacity() {
    const C = [["MS", [118, 124, 96, 40], "OVERLOADED"], ["JK", [81, 85, 90, 70], "BALANCED"], ["TB", [92, 88, 80, 85], "BALANCED"], ["SJ", [60, 55, 20, 0], "UNDERUTILIZED"], ["KL", [100, 104, 95, 0], "BALANCED"], ["PN", [56, 60, 62, 60], "BALANCED"], ["ER", [70, 72, 40, 65], "BALANCED"], ["HF", [0, 0, 0, 0], "BALANCED"]];
    const tone = (v) => (v > 105 ? "red" : v >= 80 ? "green" : v >= 1 ? "yellow" : "");
    return '<div class="a-page">' + head("Capacity", "Available hours, planned allocation and utilization per person.", sel("Week", "calendar") + sel("All teams", "users") + btn("Export", "file")) +
      '<div class="mini-stats">' + stat("Team utilization", "81%", "target 80%") + stat("Overloaded", 1, "above 105%", 1) + stat("Underutilized", 1, "below 50%") + stat("Available hours", "248 h", "this week") + stat("Planned (05)", "262 h", "allocation 105%") + "</div>" +
      '<div class="g2" style="grid-template-columns:2fr 1fr;align-items:start"><div>' +
      '<div class="panel" style="margin-top:0"><table>' + th(["Employee", "Nov 9", "Nov 16", "Nov 23", "Nov 30", ">Available (this wk)", ">Planned", ">Logged", "Status"]) + "<tbody>" + C.map((c, i) => "<tr><td>" + wh(c[0], byIni(c[0])[4]) + "</td>" + c[1].map((v) => '<td><span class="pp-heat ' + tone(v) + '">' + v + "%</span></td>").join("") + "<td class='num'>" + (c[0] === "HF" ? "0" : c[0] === "PN" ? "24" : "40") + " h</td><td class='num'>" + [47, 33, 36, 24, 40, 15, 28, 0][i] + " h</td><td class='num'>" + [28.5, 32.4, 30.1, 22, 38, 12.6, 25.7, 0][i] + " h</td><td>" + E(c[2], c[2] === "OVERLOADED" ? "red" : c[2] === "UNDERUTILIZED" ? "yellow" : "green") + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="pp-leg" style="margin-top:8px"><span><i class="lg pend"></i>below 50% underutilized</span><span><i class="lg v"></i>50–105% balanced</span><span><i class="lg h2"></i>above 105% overloaded</span></div></div><div>' +
      cd("<b>Marco Silva · week of Nov 9</b><span class='r muted'>breakdown Json</span>", kv("Scheduled", "40 h") + kv("Leave", "0 h") + kv("Holidays", "0 h") + kv("Available", "<b>40 h</b>") + kv("Planned (05)", "47 h · 118%") + kv("Logged (18)", "28.5 h · 71% so far") + kv("Status", E("OVERLOADED", "red")) + '<div class="sub-note" style="margin-top:8px">Acme Rebrand 24 h · Customer Portal 14 h · Mobile App v2 9 h</div>') + sp +
      cd("<b>Suggestions</b><span class='r muted'>AI assistant, never auto-applied</span>", row("Move 7 h from Marco to Sofia", "Sofia has 22 h free and matching skill: React", btn("Review", "sparkles", "sm")) + row("Skill gap", "Only 2 engineers have Kubernetes (Oskar leaves Dec 5)", ""), 1) + "</div></div>" +
      dm(["EmployeeCapacityPeriod · period_type, scheduled_hours, leave_hours, holiday_hours, available_hours, planned_hours, logged_hours, allocation_percent, utilization_percent, status, breakdown", "EmployeeHrSettings · target_utilization_percent, overload_threshold_percent, underutilized_threshold_percent", "Read-only: ProjectAllocation (05) · TimeEntry (18) · LeaveRequestDay"], []) + "</div>";
  }

  /* =====================================================================================================================
     SKILLS — catalogue + search employees by skill (project staffing) — spec "Skills Management"
     @screen People · Skills
     @route  /people/skills?q=&category=&level=&available=1 · /people/skills/matrix
     @perm   VIEW employees.skills.read · manage catalogue and assign / verify employees.skills.manage · availability column needs employees.capacity.read
     @api    GET /skills?category= · POST /skills · GET /employees?skill=react&min_proficiency=ADVANCED&available_hours_gte=8 · POST /employees/:id/skills · POST /employee-skills/:id/verify
     @mcp    employees_skills_read · employees_skills_manage
     @data   Skill (name, slug, category, description, parent_skill_id, archived_at) · EmployeeSkill (proficiency, years_experience, is_primary, last_used_on, verified_by_membership_id, verified_at, notes) · EmployeeCertification ·
             EmployeeTraining · EmployeeCapacityPeriod (available hours, read-only)
     @ui     Tabs (Find people / Catalogue / Matrix), Command-style search, Table, Badge for proficiency, Dialog "New skill", Tree for parent skills
     @states loading · empty ("No one matches") · error · no-access
     @audit  SKILL_CREATED / ARCHIVED, EMPLOYEE_SKILL_ASSIGNED / VERIFIED
     @note   "Find people" combines skill filters (all-of / any-of with minimum proficiency) with availability so a project manager can staff a project. Results show the person's available hours next week (10) and current
             utilization. Skills are an organization catalogue (unique slug); archived skills stay on old assignments. Search by skill is also on the Directory filter bar.
     ===================================================================================================================== */
  function skills() {
    const F = window.UI.filters;
    return '<div class="a-page">' + head("Skills", "Find people by skill and manage the catalogue.", btn("New skill", "plus", "primary")) +
      '<div class="tabset">' + tabs([["f", "Find people"], ["c", "Catalogue", 38], ["m", "Matrix"]], "f") + pane("f", 1,
        F.filterBar([["Skill", "has all of", "React, TypeScript"], ["Proficiency", "at least", "Advanced"], ["Available next week", "at least", "8 h"], ["Branch", "is any of", "Lisbon, Berlin HQ"]], btn("Save search", "plus", "sm")) +
        tbl(["Employee", "Skills matching", "Proficiency", ">Years", ">Available next week", ">Utilization", "Certifications", ""], [[wh("MS", "Senior Frontend Engineer"), tagsx(["React", "TypeScript"]), E("EXPERT", "green"), "6", "0 h", '<span class="badge red">118%</span>', "WCAG 2.2", btn("Add to project", "plus", "sm")], [wh("DW", "Frontend Intern"), tagsx(["React"]), E("BEGINNER"), "0.5", "32 h", "20%", "—", btn("Add to project", "plus", "sm")], [wh("SJ", "Product Designer"), tagsx(["TypeScript"]), E("INTERMEDIATE", "blue"), "2", "16 h", "60%", "—", btn("Add to project", "plus", "sm")], [wh("JK", "Engineering Lead"), tagsx(["React", "TypeScript"]), E("ADVANCED", "blue"), "9", "8 h", "81%", "AWS SA", btn("Add to project", "plus", "sm")]])) +
      pane("c", 0, tbl(["Skill", "Category", "Parent", ">People", "Description", ""], [["React", E("FRAMEWORK"), "JavaScript", "7", "UI library", more], ["TypeScript", E("PROGRAMMING_LANGUAGE"), "—", "9", "", more], ["Kubernetes", E("PLATFORM"), "—", "2", "", more], ["Figma", E("TOOL"), "—", "4", "", more], ["Negotiation", E("SOFT_SKILL"), "—", "3", "", more], ["Accessibility", E("DOMAIN"), "—", "5", "WCAG, assistive tech", more]])) +
      pane("m", 0, '<div class="panel" style="margin-top:0"><table>' + th(["Employee", "React", "TypeScript", "NestJS", "Figma", "Kubernetes"]) + "<tbody>" + [["MS", "EXPERT", "EXPERT", "", "", ""], ["JK", "ADVANCED", "ADVANCED", "EXPERT", "", "INTERMEDIATE"], ["TB", "", "ADVANCED", "ADVANCED", "", ""], ["SJ", "", "INTERMEDIATE", "", "EXPERT", ""], ["OL", "", "", "", "", "EXPERT"]].map((r) => "<tr><td>" + wh(r[0]) + "</td>" + r.slice(1).map((v) => "<td>" + (v ? E(v, v === "EXPERT" ? "green" : v === "ADVANCED" ? "blue" : "") : muted("—")) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>") + "</div>" +
      dm(["Skill · name, slug, category, parent_skill_id, archived_at", "EmployeeSkill · proficiency, years_experience, is_primary, last_used_on, verified_by_membership_id", "EmployeeCertification · EmployeeTraining", "EmployeeCapacityPeriod (read-only)", "ProjectAllocationSkill · allocation_id, skill_id, min_proficiency, is_required (open ProjectAllocation requirements, 05; drives Find people)"], []) + "</div>";
  }

  /* =====================================================================================================================
     PERFORMANCE — cycles and reviews — spec "Performance Management"
     @screen People · Performance
     @route  /people/performance?cycle=&status=&reviewer=&employee= · tabs Reviews / Cycles / Calibration
     @perm   VIEW employees.performance.read_all* (scope: manager sees reports) · own reviews employees.performance.read_own · create cycles / reviews, write manager assessment employees.performance.manage*
     @api    GET /performance/reviews?filter= · POST /performance/cycles {name, type, period_start, period_end, due_date, template} · POST /performance/cycles/:id/launch · GET /performance/cycles
     @mcp    employees_performance_read · employees_performance_manage (sensitive)
     @data   PerformanceReviewCycle (name, type, status, period_start, period_end, due_date, template Json) · PerformanceReview (employee_id, cycle_id, reviewer_membership_id, type, status, title, due_date, overall_rating,
             rating_scale_max, completed_at, acknowledged_at, next_review_date) · Employee
     @ui     Tabs, Table with filter bar, Card per cycle with Progress, Dialog "New cycle" (template editor: sections and rating questions), Badge, Select
     @states loading · empty · error · no-access
     @audit  PERFORMANCE_CYCLE_CREATED / LAUNCHED / COMPLETED, PERFORMANCE_REVIEW_STATUS_CHANGED
     @note   Launching a cycle creates one PerformanceReview per selected employee (status DRAFT -> SELF_ASSESSMENT) and notifies employees and reviewers (14). Ratings Json keys come from cycle.template. Ongoing tracking is
             goals, feedback and 1:1 reviews (ONE_ON_ONE) outside cycles. A review is visible to the employee only after the manager submits (SUBMITTED), and the manager's text only once COMPLETED.
     ===================================================================================================================== */
  function performance() {
    const F = window.UI.filters;
    return '<div class="a-page">' + head("Performance", "Review cycles, reviews, goals and feedback.", btn("New review", "plus") + btn("New cycle", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active cycle", "H2 2026", "due Dec 15") + stat("Completed", "34%", "29 of 84") + stat("Awaiting manager", 18, "SUBMITTED soon") + stat("Overdue", 4, "", 1) + stat("Avg. rating", "4.1", "H1 2026 / 5") + "</div>" +
      '<div class="tabset">' + tabs([["r", "Reviews", 84], ["c", "Cycles", 5], ["k", "Calibration"]], "r") + pane("r", 1,
        '<div class="toolbar">' + search("Search employee, title") + sel("Table", "grid") + sel("Cycle: H2 2026", "calendar") + sel("Views: My team", "star") + "</div>" +
        F.filterBar([["Cycle", "is", "H2 2026"], ["Status", "is any of", "Self assessment, Manager assessment"], ["Reviewer", "is", "Jonas Koch"]], btn("Save view", "plus", "sm")) +
        tbl(["Employee", "Review", "Type", "Reviewer", "Status", "Due", ">Overall", ""], [[wh("MS", "Engineering"), "H2 2026", E("SEMI_ANNUAL"), av("JK"), E("SELF_ASSESSMENT", "blue"), "Dec 15", muted("—"), btn("Open", "", "sm")], [wh("TB", "Engineering"), "H2 2026", E("SEMI_ANNUAL"), av("JK"), E("MANAGER_ASSESSMENT", "yellow"), "Dec 15", muted("—"), btn("Open", "", "sm")], [wh("SJ", "Design"), "H2 2026", E("SEMI_ANNUAL"), av("AM"), E("SUBMITTED", "purple"), "Dec 15", "4.3", btn("Open", "", "sm")], [wh("KL", "Delivery"), "H1 2026", E("SEMI_ANNUAL"), av("AM"), E("ACKNOWLEDGED", "green"), "Jun 30", "4.5", btn("Open", "", "sm")], [wh("DW", "Engineering"), "Probation 3 m", E("PROBATION"), av("MS"), E("DRAFT"), "Feb 2", muted("—"), btn("Open", "", "sm")], [wh("PN", "Engineering"), "1:1 Nov", E("ONE_ON_ONE"), av("JK"), E("COMPLETED", "green"), "Nov 6", muted("—"), btn("Open", "", "sm")]])) +
      pane("c", 0, tbl(["Cycle", "Type", "Status", "Period", "Due", ">Reviews", "Progress", ""], [["H2 2026", E("SEMI_ANNUAL"), E("ACTIVE", "green"), "Jul 1 – Dec 31", "Dec 15", "84", bar(34), more], ["H1 2026", E("SEMI_ANNUAL"), E("COMPLETED", "green"), "Jan 1 – Jun 30", "Jul 15", "78", bar(100), more], ["Q4 2026 probation", E("PROBATION"), E("PLANNED", "blue"), "Oct 1 – Dec 31", "Jan 10", "4", bar(0), more], ["Annual 2025", E("ANNUAL"), E("COMPLETED", "green"), "Jan 1 – Dec 31, 2025", "Jan 31", "70", bar(100), more], ["Project review Atlas", E("PROJECT"), E("CANCELLED"), "Q2", "—", "0", bar(0), more]])) +
      pane("k", 0, '<div class="sub-note">Rating distribution of the active cycle (overall_rating on a 5-point scale).</div><div style="display:flex;align-items:flex-end;gap:10px;height:110px;margin-top:10px">' + [["1", 2], ["2", 6], ["3", 22], ["4", 38], ["5", 14]].map((b) => '<div style="flex:1;text-align:center"><div style="background:var(--blue);border-radius:4px 4px 0 0;height:' + b[1] * 2.4 + 'px"></div><small class="muted">' + b[0] + "</small></div>").join("") + "</div>") + "</div>" +
      dm(["PerformanceReviewCycle · name, type, status, period_start, period_end, due_date, template", "PerformanceReview · status, type, reviewer_membership_id, overall_rating, rating_scale_max, due_date, acknowledged_at", "PerformanceCalibration · cycle_id, review_id, original_rating, calibrated_rating, reason, calibrated_by_membership_id (calibration history; the latest row per review is written to overall_rating)", "Employee"], []) + "</div>";
  }

  /* =====================================================================================================================
     REVIEW DETAIL — self assessment, manager assessment, ratings, acknowledgement
     @screen People · Review (Marco Silva · H2 2026)
     @route  /people/performance/:reviewId
     @perm   VIEW employees.performance.read_all* or (own) employees.performance.read_own · employee writes self assessment (own, status SELF_ASSESSMENT) · reviewer writes manager assessment employees.performance.manage* ·
             acknowledge: the employee
     @api    GET /performance/reviews/:id · PATCH /performance/reviews/:id {self_assessment, manager_assessment, ratings, overall_rating, strengths, improvement_areas, summary} · POST /performance/reviews/:id/{submit-self|submit|complete|acknowledge}
     @mcp    employees_performance_read · employees_performance_manage (sensitive)
     @data   PerformanceReview (all columns: self_assessment, self_submitted_at, manager_assessment, manager_submitted_at, ratings Json, overall_rating, rating_scale_max, strengths, improvement_areas, summary, employee_comment, completed_at,
             acknowledged_at, next_review_date, meeting_event_id, document_id) · PerformanceGoal (linked) · PerformanceFeedback (linked) · CalendarEvent (19, meeting) · Document (17, PDF)
     @ui     Stepper header (statuses), two-column Cards (employee / manager), rating ToggleGroup per criterion, Textarea / Markdown editor, Progress, AlertDialog for submit and complete
     @states loading · draft restored · validation (all ratings required to submit) · saving · error · no-access · locked after COMPLETED
     @audit  PERFORMANCE_SELF_SUBMITTED / MANAGER_SUBMITTED / COMPLETED / ACKNOWLEDGED
     @note   Workflow: DRAFT -> SELF_ASSESSMENT (employee) -> MANAGER_ASSESSMENT -> SUBMITTED (manager done, awaiting calibration or meeting) -> COMPLETED (discussed, visible) -> ACKNOWLEDGED (employee signs off, may add
             employee_comment). CANCELLED at any point. The manager cannot read the self assessment before it is submitted (self_submitted_at). overall_rating is computed from ratings unless overridden with a note. A PDF is
             generated into Documents (document_id).
     ===================================================================================================================== */
  function review() {
    const crit = [["Quality of work", 4], ["Delivery and ownership", 4], ["Collaboration", 5], ["Communication", 4], ["Growth and learning", 3]];
    const rating = (n) => '<div class="rowx" style="gap:6px;padding:0">' + [1, 2, 3, 4, 5].map((i) => '<span class="seg' + (i === n ? " on" : "") + '">' + i + "</span>").join("") + "</div>";
    return '<div class="a-page">' + head("H2 2026 review · Marco Silva", "Semi-annual · period Jul 1 – Dec 31, 2026 · reviewer " + nm("JK"), btn("Add to calendar", "calendar") + btn("Save draft") + btn("Submit assessment", "send", "primary")) +
      '<div class="pp-steps">' + [["DRAFT", 1], ["SELF_ASSESSMENT", 1], ["MANAGER_ASSESSMENT", 0, 1], ["SUBMITTED", 0], ["COMPLETED", 0], ["ACKNOWLEDGED", 0]].map((s, i) => '<div class="pp-step' + (s[1] ? " done" : "") + (s[2] ? " cur" : "") + '"><i>' + (s[1] ? I("check", 12) : i + 1) + "</i>" + U.en(s[0]) + "</div>").join("") + "</div>" +
      '<div class="g2" style="align-items:start"><div>' +
      cd("<b>Self assessment</b><span class='r muted'>submitted Nov 8</span>", "<p>This half I led the design system v2 and cut LCP from 2.8 s to 1.9 s. I want to grow into a tech lead role and need more exposure to architecture decisions.</p>" + kv("Employee self-rating", "4.0 / 5")) + sp +
      cd("<b>Goals in this review</b><span class='r muted'>PerformanceGoal.review_id</span>", row("Ship design system v2", "OBJECTIVE · 70%", E("IN_PROGRESS", "blue")) + row("Reduce LCP below 2 s", "KEY_RESULT · achieved 1.9 s", E("ACHIEVED", "green")) + row("Mentor two juniors", "GOAL · 40%", E("AT_RISK", "yellow")), 1) + sp +
      cd("<b>Feedback considered</b><span class='r muted'>PerformanceFeedback.review_id</span>", row("Recognition from Anna Meyer", "Saved the Acme launch", E("RECOGNITION", "green")) + row("Peer feedback (anonymous)", "Clear code reviews", E("PEER_FEEDBACK")), 1) +
      "</div><div>" + cd("<b>Manager assessment</b><span class='r muted'>" + nm("JK") + " · in progress</span>", crit.map((c) => '<div class="rowx"><div class="grow"><b>' + c[0] + "</b></div>" + rating(c[1]) + "</div>").join("") + sp + f("Strengths", '<div class="editor"><div class="ed-body" style="min-height:60px">Deep React knowledge, strong ownership of the design system.</div></div>') + f("Improvement areas", '<div class="editor"><div class="ed-body" style="min-height:60px">Delegate more; write RFCs earlier.</div></div>') + f("Summary", '<div class="editor"><div class="ed-body" style="min-height:60px">Exceeds expectations. Promotion discussion in Q1.</div></div>') + two(f("Overall rating", box("4.0 (computed)"), "rating_scale_max 5"), f("Next review date", sel("Jun 15, 2027", "calendar")))) + sp +
      cd("<b>After the meeting</b>", f("Employee comment", '<div class="editor"><div class="ed-body" style="min-height:50px">Written by the employee when acknowledging.</div></div>') + row("Acknowledged", "Not yet. The employee signs off after COMPLETED.", E("PENDING", "blue")) + row("Review PDF", "Generated on complete (Documents, 17)", btn("Preview", "file", "sm")), 0) + "</div></div>" +
      dm(["PerformanceReview · every column", "PerformanceGoal · PerformanceFeedback (review_id)", "CalendarEvent (19) · Document (17)"], []) + "</div>";
  }

  /* =====================================================================================================================
     GOALS, FEEDBACK AND IMPROVEMENT PLANS — spec "Performance Management": goals, objectives, achievements, feedback, PIP, recognition
     @screen People · Goals and feedback
     @route  /people/goals?employee=&status=&kind= · /people/feedback · /people/pips (tabs of one screen here)
     @perm   goals / feedback read employees.performance.read_all* (own: read_own) · write employees.performance.manage* (own goal progress: employee) · PIP employees.performance.manage* (HR + manager) · peer feedback: any employee holding
             employees.performance.read_own may write feedback about colleagues they were asked to review (requests are PerformanceFeedbackRequest rows: requested_from_membership_id, status PENDING|SUBMITTED|DECLINED|EXPIRED|CANCELLED, due_date, review_id, cycle_id, feedback_id)
     @api    GET/POST/PATCH /performance/goals · POST /performance/goals/:id/updates {progress_percent, current_value, status, note} · GET/POST /performance/feedback {kind, visibility, ...} · GET/POST/PATCH /performance/improvement-plans
     @mcp    employees_performance_read · employees_performance_manage (sensitive)
     @data   PerformanceGoal (kind GOAL/OBJECTIVE/KEY_RESULT, parent_goal_id, project_id, review_id, status, weight_percent, target_value, current_value, unit, progress_percent, start_date, due_date, employee_visible) ·
             PerformanceGoalUpdate (progress_percent, current_value, status, note) · PerformanceFeedback (kind, visibility, rating, occurred_on, is_anonymous, goal_id, project_id, review_id, deleted_at) ·
             PerformanceImprovementPlan (status, reason, objectives, start_date, end_date, check_in_frequency_days, next_check_in_on, manager_membership_id, hr_membership_id, outcome_note) · PerformanceImprovementPlanItem
     @ui     Tabs, Tree table (objective -> key results), Dialog "New goal" and "Check-in", Table, Timeline, Badge, Progress, ToggleGroup for visibility
     @states loading · empty · error · no-access
     @audit  PERFORMANCE_GOAL_CREATED / UPDATED, PERFORMANCE_FEEDBACK_CREATED, PERFORMANCE_PIP_CREATED / CLOSED
     @note   Goals nest: an OBJECTIVE has KEY_RESULT children (parent_goal_id) and its progress rolls up by weight_percent. A goal can link to a Project (05). Feedback visibility is MANAGERS_ONLY, EMPLOYEE_VISIBLE or PUBLIC
             (PUBLIC = recognition wall); is_anonymous hides the author from the subject but never from HR audit. Feedback is soft-deleted (deleted_at). PIP items are measurable (OPEN, MET, NOT_MET); closing needs outcome_note.
     ===================================================================================================================== */
  function goals() {
    const F = window.UI.filters;
    const g = (ind, kind, t, who2, st, pct, due, tone) => '<div class="rowx" style="padding-left:' + (12 + ind * 24) + 'px">' + (ind ? "" : I("flag", 14)) + '<div class="grow"><b>' + t + "</b><small>" + E(kind) + " · " + who2 + " · due " + due + '</small></div>' + E(st, tone) + bar(pct, tone === "red" ? "red" : tone === "yellow" ? "yellow" : "") + "</div>";
    return '<div class="a-page">' + head("Goals and feedback", "Ongoing performance tracking between reviews.", btn("New feedback", "chat") + btn("New goal", "plus", "primary")) +
      '<div class="tabset">' + tabs([["g", "Goals", 12], ["f", "Feedback", 31], ["p", "Improvement plans", 1], ["r", "Recognition"]], "g") + pane("g", 1,
        F.filterBar([["Cycle", "is", "H2 2026"], ["Status", "is not", "Cancelled"], ["Department", "is", "Engineering"]], btn("Save view", "plus", "sm")) +
        '<div class="panel" style="margin-top:0">' + g(0, "OBJECTIVE", "Ship design system v2", "Marco Silva", "IN_PROGRESS", 70, "Dec 31", "blue") + g(1, "KEY_RESULT", "Publish 40 components", "Marco Silva", "IN_PROGRESS", 75, "Dec 15", "blue") + g(1, "KEY_RESULT", "Migrate 3 client projects", "Marco Silva", "AT_RISK", 33, "Dec 31", "yellow") + g(0, "OBJECTIVE", "Reduce LCP below 2 s", "Marco Silva", "ACHIEVED", 100, "Nov 30", "green") + g(0, "GOAL", "Mentor two juniors", "Marco Silva", "AT_RISK", 40, "Dec 31", "yellow") + g(0, "OBJECTIVE", "Hire three engineers", "Lena Novak", "IN_PROGRESS", 66, "Dec 15", "blue") + g(0, "GOAL", "Learn Kubernetes", "Tomas Berg", "NOT_STARTED", 0, "Mar 31", "") + "</div>" +
        sp + cd("<b>Goal · Ship design system v2</b><span class='r'>" + btn("Add check-in", "plus", "sm") + "</span>", kv("Kind", E("OBJECTIVE")) + kv("Weight", "40% of review") + kv("Target / current", "40 components · 30 published") + kv("Linked project", "Acme Rebrand Website (05)") + kv("Employee visible", sw(1)) + '<div class="tl" style="margin-top:8px"><div class="ev"><b>Progress 70% · In progress</b><small>Nov 8 · Marco Silva · “30 components shipped”</small></div><div class="ev"><b>Progress 45%</b><small>Oct 12 · Jonas Koch · “Tokens merged”</small></div></div>')) +
      pane("f", 0, '<div class="toolbar">' + sel("Kind: All") + sel("Visibility: All") + sel("Employee", "users") + "</div>" + tbl(["Date", "About", "From", "Kind", "Visibility", "Rating", "Note"], [["Nov 8", wh("MS"), av("AM"), E("RECOGNITION", "green"), E("PUBLIC"), "5", "Saved the Acme launch"], ["Nov 3", wh("TB"), av("JK"), E("PERFORMANCE_NOTE"), E("MANAGERS_ONLY", "purple"), "—", "Missed two deadlines"], ["Oct 28", wh("MS"), muted("anonymous"), E("PEER_FEEDBACK"), E("MANAGERS_ONLY", "purple"), "4", "Clear code reviews"], ["Oct 20", wh("SJ"), av("SJ"), E("EMPLOYEE_FEEDBACK"), E("EMPLOYEE_VISIBLE", "blue"), "—", "Upward feedback on planning"], ["Oct 2", wh("KL"), av("AM"), E("ACHIEVEMENT", "green"), E("EMPLOYEE_VISIBLE", "blue"), "—", "Delivered Atlas on time"]]) + '<div class="sub-note" style="margin-top:8px">“Request feedback” (ask 3 colleagues to review someone) has no request table: gaps-10.md #5.</div>') +
      pane("p", 0, cd("<b>Improvement plan · Tomas Berg</b><span class='r'>" + E("ACTIVE", "green") + "</span>", kv("Reason", "Repeated missed deadlines in Q3") + kv("Period", "Nov 3 – Jan 15") + kv("Check-in every", "14 days · next Nov 17") + kv("Manager / HR", nm("JK") + " / " + nm("LN")) + sp + row("Deliver tickets within estimate", "Due Dec 1", E("OPEN", "blue")) + row("Weekly status note", "Every Friday", E("MET", "green")) + row("Pair on estimation", "Due Nov 20", E("OPEN", "blue")), 0)) +
      pane("r", 0, cd("<b>Recognition wall</b><span class='r muted'>PUBLIC feedback</span>", row("Marco Silva", "Saved the Acme launch · from Anna Meyer", E("RECOGNITION", "green")) + row("Kim Lund", "Delivered Atlas on time", E("ACHIEVEMENT", "green")), 1)) + "</div>" +
      dm(["PerformanceGoal · PerformanceGoalUpdate · PerformanceFeedback", "PerformanceFeedbackRequest · employee_id, requested_by_membership_id, requested_from_membership_id, review_id, cycle_id, status, due_date, message, is_anonymous, feedback_id, decline_reason, responded_at", "PerformanceImprovementPlan · PerformanceImprovementPlanItem", "Project (05, goal link)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ORG CHART — spec "Organization Structure"
     @screen People · Org chart
     @route  /people/org-chart?root=<employeeId>&view=tree|departments&branch=
     @perm   VIEW employees.directory.read (names, titles, photos) · HR details need employees.employees.read · change a reporting line employees.employees.update (writes an EmployeePosition, reason MANAGER_CHANGE)
     @api    GET /employees/org-chart?root=&depth= · POST /employees/:id/position {manager_employee_id, ...}
     @mcp    employees_directory_read
     @data   Employee (manager_employee_id, department_team_id, primary_branch_id, job_title, employment_status, availability_status) · EmployeePosition (manager changes) · Team (department, 01) · Branch (01)
     @ui     Tree / org chart (pan and zoom), Card per person, HoverCard mini profile, ToggleGroup tree/departments, Select branch filter, Drag to re-parent behind a confirm Dialog
     @states loading · empty · error · no-access · cycle refused (409)
     @audit  EMPLOYEE_POSITION_CHANGED (manager)
     @note   The chart is derived from Employee.manager_employee_id; Teams, Departments and Branches are owned by 01 and only shown here. Open vacancies are not modelled. The API rejects reporting cycles. Dragging a person under
             another manager creates a new EmployeePosition (effective date asked) and closes the old one. Employees in OFFBOARDING show a flag; TERMINATED/archived are hidden.
     ===================================================================================================================== */
  function orgchart() {
    const node = (i, sub) => '<div class="pp-node">' + AV(i, PP[i][1], "lg") + "<div><b>" + nm(i) + "</b><small>" + byIni(i)[2] + "</small>" + (sub || "") + "</div></div>";
    return '<div class="a-page">' + head("Org chart", "Reporting lines from Employee.manager_employee_id.", sel("Tree", "layers") + sel("All branches", "building") + btn("Export", "file")) +
      '<div class="pp-org"><div class="pp-org-l0">' + node("AM", '<span class="badge">7 reports</span>') + "</div><div class='pp-org-l1'>" +
      ["JK", "SJ", "KL", "ER", "HF", "LN"].map((i) => '<div class="pp-org-col">' + node(i, i === "JK" ? '<span class="badge">5 reports</span>' : "") + (i === "JK" ? '<div class="pp-org-l2">' + ["MS", "TB", "PN", "OL"].map((c) => node(c, c === "OL" ? '<span class="badge purple">Offboarding</span>' : "")).join("") + "</div>" : "") + "</div>").join("") + "</div></div>" +
      '<div class="g2" style="margin-top:12px">' + cd("<b>Departments</b><span class='r muted'>Team (01)</span>", row("Engineering", "6 people · lead Jonas Koch · Berlin HQ, Lisbon", '<span class="badge">6</span>') + row("Design", "1 person · Copenhagen", '<span class="badge">1</span>') + row("Delivery", "1 person", '<span class="badge">1</span>') + row("Sales, Marketing, People & Culture", "1 person each", ""), 1) +
      cd("<b>Span of control</b>", kv(nm("AM"), "7 direct reports") + kv(nm("JK"), "5 direct reports") + kv("Average span", "3.4") + kv("Depth", "3 levels"), 0) + "</div>" +
      dm(["Employee · manager_employee_id, department_team_id, primary_branch_id, job_title", "EmployeePosition (reason MANAGER_CHANGE)", "Team · Branch (01, read-only)"], []) + "</div>";
  }

  /* =====================================================================================================================
     SETTINGS — organization HR configuration — "Employee Self-Service", "Attendance & Working Hours", "Capacity & Workload", "Leave Management"
     @screen People · Settings (tabs: General, Leave types, Leave policies, Holidays, Attendance, Capacity, Self-service & directory)
     @route  /people/settings?tab=general|types|policies|holidays|attendance|capacity|selfservice
     @perm   VIEW + edit general, attendance, capacity, self-service: employees.settings.manage* · leave types and policies employees.leave.manage_policies* ·
             holidays employees.leave.manage_policies*
     @api    GET/PUT /employee-hr-settings · CRUD /leave-types · /leave-policies · /company-holidays · POST /leave-policies/:id/assign
     @mcp    employees_settings_manage · employees_leave_manage_policies (sensitive)
     @data   EmployeeHrSettings (all columns) · LeaveType (all) · LeavePolicy (all) · EmployeeLeavePolicy · CompanyHoliday (name, date, kind, is_half_day, recurring, applies_to_branch_ids) · Branch / BranchHoliday (01)
     @ui     Tabs, Card forms (react-hook-form + zod), Table with Sheet editors, Switch, Select, multi-select Combobox for String[] fields, DatePicker, color Popover (LeaveType.color)
     @states loading · validation · saving · error · no-access · "policy in use" (cannot delete, only archive)
     @audit  EMPLOYEE_SETTINGS_UPDATED (diff), LEAVE_TYPE_CREATED / ARCHIVED, LEAVE_POLICY_CREATED / ASSIGNED, COMPANY_HOLIDAY_CREATED
     @note   EmployeeHrSettings is one row per organization (created on module enable). A LeavePolicy belongs to one LeaveType, may be limited to a branch (local law) and to employment types, and applies by default
             (is_default) or by explicit EmployeeLeavePolicy assignment (effective-dated). Archived types and policies stay on old requests and balances. Holiday import by country reads a static public-holiday dataset (no provider) into CompanyHoliday with kind PUBLIC and country_code.
     ===================================================================================================================== */
  function settings() {
    const sw2 = (t, s, on) => '<div class="rowx"><div class="grow"><b>' + t + "</b><small>" + s + "</small></div>" + sw(on) + "</div>";
    return '<div class="a-page">' + head("People settings", "Organization-wide HR configuration.", btn("Save changes", "check", "primary")) +
      '<div class="tabset">' + tabs([["g", "General"], ["t", "Leave types", 6], ["p", "Leave policies", 5], ["h", "Holidays", 14], ["a", "Attendance"], ["c", "Capacity"], ["s", "Self-service and directory"]], "g") + pane("g", 1,
        '<div class="g2" style="align-items:start">' + cd("<b>Working time</b><span class='r muted'>EmployeeHrSettings</span>", f("Default weekly hours", box("40"), "default_weekly_hours") + f("Default schedule", '<div class="pp-week">' + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => '<div class="pp-wd' + (i > 4 ? " off" : "") + '"><b>' + d + "</b><span>" + (i > 4 ? "off" : "09:00–17:30") + "</span></div>").join("") + "</div>", "default_schedule Json, applied to new employees.")) +
        cd("<b>Leave approval</b>", f("Approver strategy", sel("Manager, then HR"), "DIRECT_MANAGER, HR, MANAGER_THEN_HR, CUSTOM (workflow in 20)") + f("Team conflict threshold (%)", box("30"), "Warn when more of a team is out. Empty = no check.") + sw2("Notify birthdays", "notify_birthdays", 1) + sw2("Notify work anniversaries", "notify_anniversaries", 1)) + "</div>") +
      pane("t", 0, '<div class="rowx" style="padding:0 0 10px"><div class="grow muted">LeaveType: configurable categories with rules.</div>' + btn("New leave type", "plus", "sm primary") + "</div>" + tbl(["Name", "Code", "Category", "Colour", "Paid", "Approval", "Attachment", "Half day", "Deducts", "Notice", "Max days", "Applies to", ""], [["Vacation", "VAC", E("VACATION"), tok("blue"), sw(1), sw(1), "—", sw(1), sw(1), "14 d", "15", "All", more], ["Sick leave", "SICK", E("SICK"), tok("red"), sw(1), sw(0), "after 3 d", sw(0), sw(0), "—", "—", "All", more], ["Personal", "PER", E("PERSONAL"), tok("purple"), sw(1), sw(1), "—", sw(1), sw(1), "2 d", "3", "Full / part time", more], ["Parental", "PAR", E("PARENTAL"), tok("green"), sw(1), sw(1), "always", sw(0), sw(0), "60 d", "—", "Full / part time", more], ["Unpaid", "UNP", E("UNPAID"), tok("gray"), sw(0), sw(1), "—", sw(1), sw(0), "7 d", "30", "All", more], ["Time off in lieu", "TOIL", E("TIME_OFF"), tok("yellow"), sw(1), sw(1), "—", sw(1), sw(1), "1 d", "—", "Full time", more]])) +
      pane("p", 0, '<div class="rowx" style="padding:0 0 10px"><div class="grow muted">LeavePolicy: entitlement and accrual rules.</div>' + btn("New policy", "plus", "sm primary") + "</div>" + tbl(["Policy", "Leave type", "Branch", "Accrual", ">Days / y", "Pro-rate", ">Seniority bonus", ">Max", "Carry over", "Negative", "Applies to", "Default", ""], [["Portugal standard", "Vacation", "Lisbon", E("ANNUAL_UPFRONT"), "22", sw(1), "+1 / 3 y", "25", "5 d · 3 m", sw(0), "FT, PT", sw(1), more], ["Germany standard", "Vacation", "Berlin HQ", E("ANNUAL_UPFRONT"), "28", sw(1), "—", "—", "5 d · 3 m", sw(0), "FT, PT", sw(1), more], ["Denmark standard", "Vacation", "Copenhagen", E("MONTHLY"), "25", sw(1), "—", "—", "5 d · 4 m", sw(1) + " max 2", "FT, PT", sw(1), more], ["Intern", "Vacation", "—", E("MONTHLY"), "12", sw(1), "—", "—", "none", sw(0), "Intern", sw(0), more], ["Contractor hours", "Time off", "—", E("PER_HOURS_WORKED"), "—", sw(0), "—", "—", "none", sw(0), "Contractor", sw(0), more]]) + '<div class="sub-note" style="margin-top:8px">Assign to employees: EmployeeLeavePolicy (effective-dated). Period starts month / day per policy.</div>') +
      pane("h", 0, '<div class="rowx" style="padding:0 0 10px"><div class="grow muted">CompanyHoliday plus branch holidays (01 §122). All reduce capacity.</div>' + btn("Add holiday", "plus", "sm primary") + "</div>" + tbl(["Date", "Holiday", "Kind", "Half day", "Recurring", "Branches", ""], [["Dec 24", "Christmas Eve", E("COMPANY", "purple"), sw(1), sw(1), "All", more], ["Dec 25", "Christmas Day", E("PUBLIC"), sw(0), sw(1), "All", more], ["Dec 26", "Boxing Day", E("PUBLIC"), sw(0), sw(1), "Berlin HQ, Copenhagen", more], ["Dec 28 – 31", "Company winter break", E("COMPANY", "purple"), sw(0), sw(0), "All", more], ["Jan 1", "New Year's Day", E("PUBLIC"), sw(0), sw(1), "All", more]])) +
      pane("a", 0, '<div class="g2" style="align-items:start">' + cd("<b>Clocking</b>", sw2("Attendance required", "attendance_required", 1) + f("Allowed clock sources", tagsx(["Web", "Mobile", "Manual"]), "AttendanceSource[]: WEB, MOBILE, MANUAL, IMPORT, SYSTEM") + f("Late tolerance (minutes)", box("10"))) + cd("<b>Overtime and time tracking</b>", f("Overtime threshold (minutes)", box("15")) + sw2("Overtime requires approval", "overtime_requires_approval", 1) + sw2("Pre-fill time entries from attendance", "prefill_time_entries_from_attendance (18)", 1)) + "</div>") +
      pane("c", 0, cd("<b>Utilization thresholds</b>", two(f("Target utilization (%)", box("80")), f("Overload above (%)", box("105"))) + f("Underutilized below (%)", box("50"), "Drives EmployeeCapacityPeriod.status.") )) +
      pane("s", 0, '<div class="g2" style="align-items:start">' + cd("<b>Self-service</b>", f("Fields employees may edit", tagsx(["Preferred name", "Personal phone", "Address", "Emergency contacts", "Photo", "Bio"]), "self_service_editable_fields (String[]). Identity, pay and job fields are never listed.") + sw2("Profile changes require approval", "profile_changes_require_approval: creates EmployeeProfileChangeRequest", 1)) + cd("<b>Directory</b>", f("Fields shown in the company directory", tagsx(["Name", "Photo", "Title", "Department", "Branch", "Work email", "Work phone", "Availability", "Skills"]), "directory_visible_fields. Personal contact data cannot be added.")) + "</div>") + "</div>" +
      dm(["EmployeeHrSettings · all columns", "LeaveType · LeavePolicy · EmployeeLeavePolicy · CompanyHoliday (country_code for imported public holidays)", "Branch · BranchHoliday (01)"], []) + "</div>";
  }

  /* =====================================================================================================================
     DASHBOARD — spec "Dashboards & Reporting"
     @screen People · Dashboard
     @route  /people/dashboard?period=&branch=&department=
     @perm   VIEW employees.employees.read (headcount, structure) · attendance numbers employees.attendance.read_all · leave employees.leave.read_all · utilization employees.capacity.read · performance employees.performance.read_all* ·
             export employees.employees.export* (PDF, Excel, CSV)
     @api    GET /employees/reports/{headcount|growth|attendance|leave|utilization|performance}?from=&to= · GET /employees/reports/export?format=pdf|xlsx|csv
     @mcp    employees_reports_read · employees_employees_export (sensitive)
     @data   Employee (employment_status, department_team_id, primary_branch_id, hire_date, termination_date, employment_type) · AttendanceSummary · LeaveBalance / LeaveRequestDay · EmployeeCapacityPeriod · PerformanceReview (overall_rating) ·
             EmployeePosition (growth by department over time) · Read-only: ProjectAllocation (05)
     @ui     Card grid with stat tiles, Recharts (bar, line, stacked), Table, Select filters, Export DropdownMenu
     @states loading · empty · error · no-access (tiles the caller may not read are replaced by Restricted)
     @audit  EMPLOYEE_EXPORT (format, filter)
     @note   All numbers are computed or materialized (AttendanceSummary, EmployeeCapacityPeriod); nothing is typed by hand. Compensation totals are NOT on this dashboard (they belong to 09 profitability behind
             employees.compensation.read). Charts use the dataviz palette tokens; both themes checked.
     ===================================================================================================================== */
  function dashboard() {
    const dep = [["Engineering", 31], ["Sales", 14], ["Design", 9], ["Delivery", 8], ["Marketing", 8], ["People & Culture", 6], ["Management", 3], ["Support", 5]];
    const gr = [62, 64, 65, 68, 70, 72, 74, 76, 78, 80, 81, 84];
    return '<div class="a-page">' + head("People dashboard", "Headcount, availability, leave, attendance and performance.", sel("Last 12 months", "calendar") + sel("All branches", "building") + btn("Export", "file") + btn("Add employee", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Total employees", 84, "+3 this month") + stat("Out today", 6, "7% of staff") + stat("Avg. utilization", "81%", "target 80%") + stat("Avg. rating", "4.1", "H1 2026") + stat("Open leave requests", 3, "") + stat("Turnover (12 m)", "8.3%", "7 leavers") + "</div>" +
      '<div class="g2">' + cd("<b>Employees by department</b><span class='r muted'>Employee.department_team_id</span>", dep.map((d) => '<div class="bar-row"><span class="l">' + d[0] + '</span><span class="tr"><i style="width:' + d[1] * 3 + '%;background:var(--blue)"></i></span><span class="v">' + d[1] + "</span></div>").join("")) +
      cd("<b>Employee growth</b><span class='r muted'>hire_date, termination_date</span>", '<svg viewBox="0 0 300 120" width="100%" height="120" style="display:block"><path d="' + gr.map((v, i) => (i ? "L" : "M") + (10 + i * 25.5) + " " + (110 - (v - 55) * 3.4)).join(" ") + '" stroke="var(--blue)" stroke-width="2" fill="none"/></svg><div class="sub-note">Headcount by month, Dec 2025 – Nov 2026. 14 joined, 7 left.</div>') + "</div>" + sp +
      '<div class="g3">' + cd("<b>Availability now</b>", [["AVAILABLE", 31], ["REMOTE", 22], ["IN_OFFICE", 16], ["BUSY", 5], ["VACATION", 4], ["SICK_LEAVE", 1], ["TRAINING", 3], ["BUSINESS_TRAVEL", 2]].map((a) => row(U.en(a[0]), "", '<span class="badge ' + (AVL[a[0]] || "") + '">' + a[1] + "</span>")).join(""), 1) +
      cd("<b>Leave this month</b>", kv("Days taken", "142") + kv("Vacation", "96") + kv("Sick", "31") + kv("Other", "15") + kv("Avg. vacation balance", "11.4 d") + kv("Balances over 20 d", '<span class="badge yellow">4</span>')) +
      cd("<b>Attendance (Nov)</b>", kv("Scheduled hours", "9 820") + kv("Worked", "6 412") + kv("Overtime", "186 h") + kv("Late arrivals", "23") + kv("Remote share", "41%")) + "</div>" + sp +
      '<div class="g2">' + cd("<b>Upcoming</b><span class='r muted'>birthdays, anniversaries, probation, contracts</span>", row("Probation ends", "Marco Silva · Dec 5 · Daniel Weiss · Feb 2", E("PROBATION")) + row("Work anniversaries", "Lena Novak 6 y · May 4 | Elena Rossi 3 y · Nov 2", "") + row("Birthdays this week", "Sofia Jensen · Nov 13", "") + row("Contracts ending", "2 contractors within 60 days", E("CONTRACTOR")), 1) +
      cd("<b>Performance overview</b>", '<div style="display:flex;align-items:flex-end;gap:10px;height:90px">' + [["1", 2], ["2", 6], ["3", 22], ["4", 38], ["5", 14]].map((b) => '<div style="flex:1;text-align:center"><div style="background:var(--blue);border-radius:4px 4px 0 0;height:' + b[1] * 2 + 'px"></div><small class="muted">' + b[0] + "</small></div>").join("") + '</div><div class="sub-note">Overall rating distribution H1 2026</div>') + "</div>" +
      dm(["Employee · employment_status, department_team_id, hire_date, termination_date", "AttendanceSummary · LeaveRequestDay · LeaveBalance · EmployeeCapacityPeriod · PerformanceReview.overall_rating", "EmployeePosition (growth by department)"], ["Turnover and growth are computed from hire_date / termination_date; no stored report"]) + "</div>";
  }

  const MAP = { dashboard, directory, cards, create, profile: profileFull, restricted: profileRestricted, changes, onboarding, offboarding, leave, leavenew, leavecal, balances, attendance, payroll, capacity, skills, performance, review, goals, orgchart, settings };
  const CRUMB = { profile: "Marco Silva", restricted: "Marco Silva (restricted preview)", review: "H2 2026 review", offboarding: "Oskar Lind" };
  window.VIEWS.people = { html: function (s) { return (MAP[s || "dashboard"] || MAP.dashboard)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
