/* =====================================================================================================================
   PROJECTS APP — module 05 (docs/features/05-project-management.md)
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: Project, ProjectType, ProjectStatus, ProjectTemplate(+Version), ProjectBranch, ProjectMember, ProjectStakeholder, ProjectObjective, ProjectWorkstream, ProjectMilestone,
   ProjectDeliverable, ProjectAcceptanceCriterion, ProjectDependency, ProjectRisk, ProjectIssue, ProjectDecision, ProjectStatusUpdate(+Comment), ProjectChangeRequest, ProjectGate, ProjectReview, ProjectAllocation,
   ProjectChecklist(+Item), ProjectEscalation, ProjectHandover, ProjectCloseout, ProjectRelation, ProjectExternalReference, ProjectDeliverableReview, ProjectFavorite.
   Enums are real values: ProjectStatusCategory, ProjectHealth, CalculationMode, ProjectPriority, ProjectVisibility, ProjectItemStatus, DeliverableStatus, AcceptanceStatus, DependencyItemType, DependencyType,
   DependencyStatus, RiskStatus, ProjectIssueKind/Status, Severity, ProjectChangeRequestStatus, ProjectGateKind/Status, ProjectReviewType, ProjectRelationType, EscalationStatus, HandoverStatus.
   Permission keys: projects.projects.* (read, create, update, delete*, archive, export*, manage_members, manage_budgets, complete, reopen), projects.members.manage, projects.milestones.manage,
   projects.workstreams.manage, projects.deliverables.manage, projects.risks.manage, projects.issues.manage, projects.dependencies.manage, projects.change_requests.manage / approve*, projects.gates.decide*,
   projects.status_updates.publish, projects.internal_notes.read, projects.settings.manage, projects.portfolio.read, projects.finance.read* (FIELD-LEVEL).
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - STATUS vs HEALTH vs PROGRESS are three different things (spec §4, §13, §14): Project.status_id is the lifecycle (ProjectStatus.category), Project.health is delivery condition (HEALTHY | AT_RISK | BLOCKED | CRITICAL |
       UNKNOWN) and progress_percent is how much is done. health_mode / progress_mode (MANUAL | AUTOMATIC | HYBRID) say who sets them; the UI must show "automatic" values as read-only with the reason (health_reason).
     - Projects LINK, they do not own: customer = CrmCompany (02), proposal/contract (03/04), tasks (06), invoices and budget settings (08), time (18), documents (17), calendar (19), channel (12), tickets (13), wiki (15).
       This module stores ids and shows read-only summaries; it never redefines those tables.
     - Money is FIELD-LEVEL: budget_amount, cost impact and profitability need projects.finance.read*. Without it the API omits the fields and the UI renders "Restricted", not zero.
     - Customer visibility is opt-in per record (customer_visible / portal_visible / visibility = CUSTOMER_VISIBLE) and is enforced on the server. Internal notes need projects.internal_notes.read.
     - Branch scoping: Project.branch_id is the primary branch, ProjectBranch the participating ones. Lists honour the active branch context of the session.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, S, head, btn, cd, sw, cb, sel, fld, stat, search, who, tok, kv, muted, more, callout, keyc, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const eur = (n) => "€" + Math.round(n).toLocaleString("en-US");
  const bar = (p, tone) => '<span class="bar"><i style="width:' + p + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  /* @impl Health -> badge tone. ProjectHealth. Always show the label, never colour alone (accessibility). */
  const HT = { HEALTHY: "green", AT_RISK: "yellow", BLOCKED: "red", CRITICAL: "red", UNKNOWN: "" };
  const health = (v) => ES(v, HT[v]);
  /* @impl Status -> badge tone by ProjectStatusCategory (organization-defined statuses map to a fixed category). */
  const SC = { DRAFT: "", PLANNED: "blue", NOT_STARTED: "", IN_PROGRESS: "green", ON_HOLD: "yellow", BLOCKED: "red", READY_FOR_COMPLETION: "purple", COMPLETED: "green", CANCELLED: "", ARCHIVED: "" };
  const status = (name, cat) => '<span class="badge ' + (SC[cat] || "") + '" title="ProjectStatusCategory ' + cat + '"><span class="dot"></span>' + name + "</span>";
  const sev = (v) => '<span class="badge ' + { LOW: "green", MEDIUM: "yellow", HIGH: "red", CRITICAL: "red" }[v] + '" title="Severity ' + v + '">' + U.en(v) + "</span>";
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const av = (a) => who(a, "", { AM: "Anna Meyer", MS: "Marco Silva", SJ: "Sofia Jensen", JK: "Jonas Koch", KL: "Kim Lund", PR: "Petros Rodinos", EP: "Elena Papadaki" }[a], "");

  /* The portfolio rows are reused by the overview, the list and the timeline so the numbers agree everywhere. */
  const P = [
    { code: "PRJ-0042", n: "Acme Rebrand Website", c: "Acme Corp", st: ["In progress", "IN_PROGRESS"], h: "HEALTHY", p: 72, o: "AM", t: "Website build", pr: "HIGH", due: "Nov 28", bud: 48000, hrs: "412 / 520 h" },
    { code: "PRJ-0043", n: "Mobile App v2", c: "Northwind", st: ["In progress", "IN_PROGRESS"], h: "AT_RISK", p: 41, o: "JK", t: "Mobile app", pr: "HIGH", due: "Dec 12", bud: 92500, hrs: "610 / 780 h" },
    { code: "PRJ-0044", n: "Stripe Billing Migration", c: "Initech", st: ["Ready for completion", "READY_FOR_COMPLETION"], h: "HEALTHY", p: 88, o: "SJ", t: "Integration", pr: "MEDIUM", due: "Nov 21", bud: 21000, hrs: "168 / 190 h" },
    { code: "PRJ-0045", n: "Customer Portal Build", c: "Globex", st: ["Blocked", "BLOCKED"], h: "CRITICAL", p: 23, o: "MS", t: "Web application", pr: "CRITICAL", due: "Jan 09", bud: 64200, hrs: "240 / 610 h" },
    { code: "PRJ-0046", n: "Brand Strategy Sprint", c: "Umbrella Ltd", st: ["Planned", "PLANNED"], h: "UNKNOWN", p: 8, o: "AM", t: "Consulting", pr: "LOW", due: "Feb 02", bud: 15800, hrs: "12 / 150 h" },
    { code: "PRJ-0047", n: "Data Warehouse Setup", c: "Hooli", st: ["On hold", "ON_HOLD"], h: "AT_RISK", p: 55, o: "KL", t: "Data", pr: "MEDIUM", due: "Dec 05", bud: 37400, hrs: "290 / 400 h" },
  ];
  const row = (r) => [ink(r.n) + "<br>" + muted(r.code + " · " + r.t), r.c, status(r.st[0], r.st[1]), health(r.h), bar(r.p), av(r.o), E(r.pr), r.due];

  /* =====================================================================================================================
     PORTFOLIO OVERVIEW (spec §40–42, §52, §75–76)
     @route  /projects (default) · /projects/overview
     @perm   VIEW projects.portfolio.read (all projects in scope) — without it the page shows only "my projects" (member or owner); money tiles need projects.finance.read*
     @api    GET /projects/portfolio/summary (counts per status category and health, at-risk list, upcoming milestones, overdue items, workload)
     @mcp    projects_projects_read (summary)
     @data   Project (status_id, health, progress_percent, target_completion, budget_hours) · ProjectStatus.category · ProjectMilestone (planned_date, status) · ProjectRisk / ProjectIssue (open, severity) · ProjectAllocation
     @ui     Card, Progress, Table, Badge; every widget loads independently
     @states loading per widget · empty ("No projects yet") · error per widget · no-access per widget
     @note   Health shown here is Project.health as stored (automatic or manual, per health_mode). The counts are scoped to the caller's branch/team visibility and the active branch context.
     ===================================================================================================================== */
  function overview() {
    return '<div class="a-page">' + head("Projects", "12 active projects across 7 customers.", btn("Export", "file") + btn("New project", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active", 12, "IN_PROGRESS · READY_FOR_COMPLETION") + stat("Healthy", 7, "HEALTHY") + stat("At risk", 3, "AT_RISK", 1) + stat("Blocked / critical", 2, "BLOCKED · CRITICAL", 1) + stat("Milestones due", 5, "next 14 days") + stat("Overdue", 4, "milestones and deliverables", 1) + "</div>" +
      '<div class="g2">' +
      /* @impl "Needs attention" = projects whose health is AT_RISK, BLOCKED or CRITICAL, worst first, with health_reason (why). Clicking opens the project workspace. */
      cd("<b>Needs attention</b><span class='r muted'>health_reason</span>", [["Customer Portal Build", "CRITICAL", "2 blockers open · customer approval pending 9 days"], ["Mobile App v2", "AT_RISK", "Milestone “Beta” 6 days late · 3 high risks"], ["Data Warehouse Setup", "AT_RISK", "On hold waiting for customer credentials"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[2] + "</small></div>" + health(r[1]) + "</div>").join(""), 1) +
      cd("<b>Upcoming milestones</b><span class='r muted'>planned_date</span>", [["Acme Rebrand Website", "Content freeze", "Nov 14", "IN_PROGRESS"], ["Stripe Billing Migration", "Go-live", "Nov 21", "IN_PROGRESS"], ["Mobile App v2", "Beta release", "Nov 24", "AT_RISK"], ["Acme Rebrand Website", "Launch", "Nov 28", "PLANNED"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[1] + "</b><small>" + r[0] + "</small></div><span class='muted'>" + r[2] + "</span>" + E(r[3]) + "</div>").join(""), 1) +
      cd("<b>Projects by status</b><span class='r muted'>ProjectStatus.category</span>", [["In progress", 7, "green"], ["Planned", 3, "blue"], ["On hold", 1, "yellow"], ["Blocked", 1, "red"], ["Ready for completion", 1, "purple"]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i style="width:' + r[1] * 12 + "%;background:var(--" + r[2] + ')"></i></span><span class="v">' + r[1] + "</span></div>").join("")) +
      cd("<b>Team load this month</b><span class='r muted'>ProjectAllocation vs capacity</span>", [["Anna Meyer", 92], ["Marco Silva", 118], ["Sofia Jensen", 74], ["Jonas Koch", 101]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i style="width:' + Math.min(r[1], 100) + "%;background:var(--" + (r[1] > 100 ? "red" : "green") + ')"></i></span><span class="v">' + r[1] + "%</span></div>").join("")) +
      "</div>" +
      /* @impl The portfolio table is the same component as All projects with a fixed "attention" filter; keep one table component. */
      dm(["Project · status_id, health, health_reason, progress_percent, target_completion, owner_membership_id, company_id", "ProjectStatus · category", "ProjectMilestone · planned_date, status, project_id", "ProjectRisk · severity, status · ProjectIssue · kind, status", "ProjectAllocation · planned_hours, allocation_percent (load)", "Read-only from 10: EmployeeCapacityPeriod (capacity for the load bars)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ALL PROJECTS (spec §5, §75–77, §85)
     @route  /projects/all?view=&status=&health=&type=&owner=&company=&q=
     @perm   VIEW projects.projects.read · create projects.projects.create · export projects.projects.export* · archive projects.projects.archive · budget column needs projects.finance.read*
     @api    GET /projects?status_id=&health=&type_id=&owner_id=&company_id=&team_id=&q=&cursor= · POST /projects {name, type_id, company_id?, template_id?, owner_membership_id, ...}
     @mcp    projects_projects_read · projects_projects_create
     @data   Project (all columns shown) · ProjectType · ProjectStatus · CrmCompany (read-only name) · Membership (owner) · SavedView (entity_type PROJECT)
     @ui     Table with saved views (SavedView), filter chips, shadcn Select/Command for filters, Badge, Progress
     @states loading skeleton · empty · empty-filtered · error · no-access
     @note   "Favorites" in the sidebar are ProjectFavorite rows of the signed-in member (unique per project and member). Create from template copies the template version structure but never links later template edits.
             Projects without a customer are allowed (§56). Search covers name, code, customer name and external references.
     ===================================================================================================================== */
  function list() {
    return '<div class="a-page">' + head("All projects", "Every project you can see in the active branch.", btn("Export", "file") + btn("New project", "plus", "primary")) +
      '<div class="toolbar">' + search("Search name, code, customer") + sel("Status: Any", "filter") + sel("Health: Any") + sel("Type: Any") + sel("Owner: Anyone") + sel("Customer: Any") + sel("Table", "grid") + "</div>" +
      tbl(["Project", "Customer", "Status", "Health", "Progress", "Owner", "Priority", "Due"], P.map(row)) +
      dm(["Project · name, code, type_id, status_id, health, progress_percent, priority, owner_membership_id, company_id, target_completion, visibility, archived_at", "ProjectType · name · ProjectStatus · name, category, color", "SavedView · layout, filters, sorting", "ProjectFavorite · project_id, membership_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     PROJECT WORKSPACE (spec §11–12, §16–20, §29–32, §39, §45–47, §50–54, §57–67)
     @route  /projects/:projectId?tab=overview|plan|delivery|changes|team|updates|closeout
     @perm   VIEW projects.projects.read (and project visibility: member, owner, or portfolio.read) · edit projects.projects.update · members projects.members.manage · budget fields projects.finance.read* / manage_budgets
     @api    GET /projects/:id (header + summary) · PATCH /projects/:id · GET /projects/:id/{milestones|workstreams|deliverables|risks|issues|dependencies|decisions|changes|gates|status-updates|allocations|checklists}
     @mcp    projects_projects_read · projects_projects_update · projects_status_updates_publish
     @data   Project and the 30 child tables listed in each tab's footer
     @ui     Header with status Select (allowed_transitions only), Tabs, Card, Table, Progress, Timeline
     @states loading per tab · empty per tab · error per tab · no-access ("Restricted")
     @audit  every field change on Project and children (audit_events) · status transitions · health changes (who/what/why) · completion and reopen
     @note   Status changes follow ProjectStatus.allowed_transitions; completing needs projects.projects.complete and every ProjectGate with blocks_completion = true must be PASSED or WAIVED (§71). Reopening needs
             projects.projects.reopen and a reason (§74). Task lists, time, invoices and documents are NOT stored here: tabs show read-only summaries fetched from 06, 18, 08 and 17 with deep links.
     ===================================================================================================================== */
  function detail() {
    const p = P[1];
    const header = '<div class="a-head"><div><h1>' + p.n + '</h1><p>' + p.code + " · " + p.c + " · " + p.t + '</p></div><div class="acts">' + btn("Star", "star") + btn("Share update", "send") + btn("Edit", "edit", "primary") + "</div></div>" +
      '<div class="rowx" style="gap:10px;margin:-4px 0 12px;flex-wrap:wrap;align-items:center">' + '<span style="display:inline-block;min-width:160px">' + sel("In progress") + "</span>" + health(p.h) + E(p.pr) + muted("Owner") + who("JK", "r", "Jonas Koch", "") + muted("Target Dec 12") + "</div>";
    return '<div class="a-page">' + header +
      '<div class="tabset">' + tabs([["o", "Overview"], ["p", "Plan"], ["d", "Delivery"], ["c", "Changes & gates", 3], ["t", "Team"], ["u", "Updates"], ["x", "Closeout"]], "o") +

      /* ---- OVERVIEW (§12–15, §54, §57–67) ---- */
      /* @impl Overview: header facts + health + progress + links to every connected module. health_mode AUTOMATIC: health is computed from overdue milestones, open blockers, high risks and budget burn using ProjectType.health_rules;
           show health_reason and make the control read-only. HYBRID: automatic value can be overridden with a reason. Progress comes from tasks (06) or milestones per progress_mode. */
      pane("o", 1, '<div class="g2">' + cd("<b>Health and progress</b>", kv("Health", health(p.h) + " " + muted("automatic")) + kv("Reason", "Beta milestone is 6 days late; 3 open high risks") + kv("Progress", bar(p.p) + " " + muted("from tasks (06)")) + kv("Planned start", "Aug 18") + kv("Target completion", "Dec 12") + kv("Customer deadline", "Dec 20") + kv("Internal deadline", "Dec 10")) +
        cd("<b>Commercial & links</b>", kv("Customer", "Northwind " + muted("CrmCompany (02)")) + kv("Proposal", "PRO-2026-0102 v2 " + muted("(03)")) + kv("Contract", "CTR-2026-0017 " + muted("(04)")) + kv("Budget", muted("Restricted") + " " + muted("projects.finance.read*")) + kv("Hours", p.hrs + " " + muted("(18)")) + kv("Invoices", "2 of 5 paid " + muted("(08)")) + kv("Channel", "#northwind-app " + muted("(12)")) + kv("Runbook", "Mobile release runbook " + muted("(15)"))) + "</div>" +
        '<div style="height:12px"></div><div class="g2">' + cd("<b>Objectives</b><span class='r muted'>ProjectObjective</span>", [["Ship v2 to the stores", "IN_PROGRESS", 41], ["Reach 4.5★ at launch", "PLANNED", 0]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b></div>" + E(r[1]) + bar(r[2]) + "</div>").join(""), 1) +
        cd("<b>Recent activity</b><span class='r muted'>audit_events</span>", '<div class="tl"><div class="ev"><b>Health changed to At risk</b><small>automatic · today</small></div><div class="ev"><b>Milestone “Beta release” moved to Nov 24</b><small>Jonas Koch · yesterday</small></div><div class="ev"><b>Change request #4 approved</b><small>Petros Rodinos · Nov 6</small></div></div>') + "</div>") +

      /* ---- PLAN (§16–21, §47) ---- */
      /* @impl Plan: ProjectObjective, ProjectWorkstream, ProjectMilestone (+ is_billing_milestone, customer_visible, proposal_milestone_key), ProjectDeliverable (+ acceptance criteria). Manage keys: milestones/workstreams/deliverables.manage.
           A billing milestone can raise an invoice when completed (ProjectBillingSettings.auto_invoice_milestones, 08). Dependencies between items are ProjectDependency rows (type + lag_days). */
      pane("p", 0, cd("<b>Workstreams</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", [["Design system", "COMPLETED", 100, "AM"], ["iOS app", "IN_PROGRESS", 55, "JK"], ["Android app", "AT_RISK", 30, "KL"], ["Backend API", "IN_PROGRESS", 62, "SJ"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b></div>" + av(r[3]) + E(r[1]) + bar(r[2]) + "</div>").join(""), 1) +
        '<div style="height:12px"></div>' + cd("<b>Milestones</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", tbl(["Milestone", "Workstream", "Status", "Planned", ">Progress", "Billing", "Customer"], [["Design approved", "Design system", E("COMPLETED", "green"), "Sep 20", "100%", "—", "Yes"], ["Alpha build", "iOS app", E("COMPLETED", "green"), "Oct 18", "100%", eur(18500), "Yes"], ["Beta release", "iOS app", E("AT_RISK", "yellow"), "Nov 24 " + muted("(was Nov 18)"), "52%", eur(27750), "Yes"], ["Store launch", "—", E("PLANNED"), "Dec 12", "0%", eur(46250), "Yes"]]), 1) +
        '<div style="height:12px"></div>' + cd("<b>Deliverables</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", tbl(["Deliverable", "Milestone", "Status", "Due", "Acceptance", "Customer"], [["Design files", "Design approved", E("ACCEPTED", "green"), "Sep 20", "3 of 3 passed", "Yes"], ["iOS beta build", "Beta release", E("IN_PROGRESS", "blue"), "Nov 24", "1 of 4 passed", "Yes"], ["Admin handbook", "Store launch", E("PLANNED"), "Dec 10", "0 of 2", "No"]]), 1) +
        dm(["ProjectObjective · ProjectWorkstream · ProjectMilestone · ProjectDeliverable · ProjectAcceptanceCriterion · ProjectDependency", "ProjectDeliverableReview · decision, comment, document_version_ids (customer approvals, 07)"], [])) +

      /* ---- DELIVERY (RAID: §29–32) ---- */
      /* @impl Delivery = RAID in one tab: Risks (ProjectRisk: probability × impact -> severity), Issues and Blockers (ProjectIssueKind), Dependencies, Decisions. An issue of kind BLOCKER sets health to BLOCKED when health_mode is AUTOMATIC.
           An issue can link a Task (06) or a support Ticket (13). Decisions may link a chat Message (12) and a Document (17). */
      pane("d", 0, '<div class="g2">' + cd("<b>Risks</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", [["App Store review delay", "HIGH", "MONITORING"], ["Push notification vendor limits", "MEDIUM", "OPEN"], ["Key developer leave in Dec", "HIGH", "OPEN"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b></div>" + sev(r[1]) + E(r[2]) + "</div>").join(""), 1) +
        cd("<b>Issues & blockers</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", [["ISSUE", "Android build fails on CI", "HIGH", "IN_PROGRESS"], ["BLOCKER", "Waiting for Apple developer account access", "CRITICAL", "OPEN"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[1] + "</b><small>" + E(r[0]) + "</small></div>" + sev(r[2]) + E(r[3]) + "</div>").join(""), 1) +
        cd("<b>Dependencies</b>", [["Beta release", "FINISH_TO_START", "Backend API v1", "OPEN"], ["Store launch", "FINISH_TO_START", "Customer copy approval", "OPEN"], ["Mobile App v2", "BLOCKS", "Customer Portal Build · PRJ-0045", "OPEN"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + U.en(r[1]) + " → " + r[2] + "</small></div>" + E(r[3]) + "</div>").join(""), 1) +
        cd("<b>Decisions</b><span class='r'>" + btn("Record", "plus", "sm") + "</span>", [["Use React Native for both platforms", "Oct 3", "Jonas Koch"], ["Drop tablet layout from v2", "Oct 22", "Petros Rodinos"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + " · decided by " + r[2] + "</small></div></div>").join(""), 1) + "</div>" +
        dm(["ProjectRisk · probability, impact, severity, status, mitigation, contingency", "ProjectIssue · kind, severity, priority, status, blocked_item_type, task_id, ticket_id", "ProjectDependency · type, status, lag_days", "ProjectDecision · decided_at, decision_maker_membership_id, alternatives_considered, source_message_id, document_id", "ProjectEscalation · severity, status, escalated_to_membership_id"], [])) +

      /* ---- CHANGES & GATES (§44–47) ---- */
      /* @impl Change requests (ProjectChangeRequest, numbered per project) change delivery; commercial approval stays with 03/04 via proposal_id / contract_id / contract_change_request_id. Approve needs projects.change_requests.approve*
           (cost_impact_amount is money: projects.finance.read*). Gates (ProjectGate) are APPROVAL or QUALITY; decide needs projects.gates.decide*. Gates with blocks_completion = true stop completion until PASSED or WAIVED. */
      pane("c", 0, '<div class="g2">' + cd("<b>Change requests</b><span class='r'>" + btn("New", "plus", "sm") + "</span>", [["#4", "Add offline mode", "APPROVED", "+14 days"], ["#5", "Support tablet layout", "UNDER_REVIEW", "+9 days"], ["#6", "Replace analytics SDK", "REQUESTED", "+3 days"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + " " + r[1] + "</b><small>Timeline impact " + r[3] + "</small></div>" + E(r[2], r[2] === "APPROVED" ? "green" : "yellow") + "</div>").join(""), 1) +
        cd("<b>Gates</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", [["APPROVAL", "Design approval", "PASSED", 0], ["QUALITY", "QA sign-off", "PENDING", 1], ["APPROVAL", "Customer acceptance", "PENDING", 1], ["QUALITY", "Security review", "WAIVED", 0]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[1] + "</b><small>" + E(r[0]) + (r[3] ? " · blocks completion" : "") + "</small></div>" + E(r[2], r[2] === "PASSED" ? "green" : r[2] === "PENDING" ? "yellow" : "") + "</div>").join(""), 1) + "</div>" +
        dm(["ProjectChangeRequest · number, status, scope_impact, timeline_impact_days, cost_impact_amount, proposal_id, contract_id, contract_change_request_id", "ProjectGate · kind, status, blocks_completion, approver_membership_id, customer_approver_user_id, decision_comment"], [])) +

      /* ---- TEAM (§8–10, §50–53) ---- */
      /* @impl Team: ProjectMember (role_id is a Role of type PROJECT, 01 §45, so project roles carry real permissions), ProjectAllocation (the PLAN: planned_hours, allocation_percent, date range; actuals come from time tracking 18),
           ProjectStakeholder (external: customer contacts, vendors; portal_visible, decision_authority). Needs projects.members.manage to change. */
      pane("t", 0, '<div class="g2">' + cd("<b>Members</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", [["JK", "Project lead", 60], ["KL", "Android developer", 100], ["SJ", "Backend developer", 40], ["AM", "Designer", 20]].map((r) => '<div class="rowx">' + av(r[0]) + '<div class="grow"><small>' + r[1] + "</small></div>" + muted(r[2] + "%") + "</div>").join(""), 1) +
        cd("<b>Stakeholders</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", [["Lena Kovac", "Northwind · Product owner", 1, 1], ["Tom Brandt", "Northwind · IT", 1, 0], ["Pixel Studio", "Vendor · Icons", 0, 0]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + (r[2] ? E("Portal visible", "blue") : "") + (r[3] ? E("Decision authority", "purple") : "") + "</div>").join(""), 1) + "</div>" +
        '<div style="height:12px"></div>' + cd("<b>Allocation plan</b><span class='r muted'>ProjectAllocation</span>", tbl(["Who", "Role", "Workstream", ">Planned hours", ">Allocation", "From", "To"], [["Jonas Koch", "Project lead", "—", "280", "60%", "Aug 18", "Dec 12"], ["Kim Lund", "Android developer", "Android app", "320", "100%", "Sep 1", "Dec 5"], ["Sofia Jensen", "Backend developer", "Backend API", "140", "40%", "Aug 18", "Nov 30"]]), 1) +
        dm(["ProjectMember · role_id (Role type PROJECT), allocation_percent, is_active", "ProjectStakeholder · contact_id, portal_visible, decision_authority", "ProjectAllocation · membership_id, team_id, planned_hours, allocation_percent, workstream_id", "ProjectBranch · multi-branch"], [])) +

      /* ---- UPDATES (§39–42) ---- */
      /* @impl Status updates (ProjectStatusUpdate): structured (summary, completed/current/upcoming work, risks, blockers, decisions, required actions). Publishing needs projects.status_updates.publish; customer_visible ones show in the portal
           (07 §4) where the customer can comment (ProjectStatusUpdateComment). AI draft: is_ai_generated = true, always reviewed by a human before publish; the draft never auto-publishes. */
      pane("u", 0, cd("<b>Status updates</b><span class='r'>" + btn("AI draft", "sparkles", "sm") + btn("New update", "plus", "sm") + "</span>", '<div class="rowx" style="align-items:flex-start"><div class="grow"><b>Week 45 · Beta slipping a week</b><small>Nov 8 · Jonas Koch · health At risk · progress 41%</small></div>' + E("Customer visible", "blue") + "</div>" +
        '<div class="rowx" style="align-items:flex-start"><div class="grow"><b>Week 44 · Alpha accepted</b><small>Nov 1 · Jonas Koch · health Healthy · progress 36%</small></div>' + E("Customer visible", "blue") + "</div>" +
        '<div class="rowx" style="align-items:flex-start"><div class="grow"><b>Week 46 draft</b><small>Not published · ' + E("AI generated") + "</small></div>" + btn("Review", "", "sm") + "</div>", 1) +
        dm(["ProjectStatusUpdate · period_start/end, summary, health, progress_percent, customer_visible, published_at, is_ai_generated", "ProjectStatusUpdateComment · body, author_user_id (customer) or author_membership_id"], [])) +

      /* ---- CLOSEOUT (§71–74, §92–94, §101–103) ---- */
      /* @impl Closeout: ProjectCloseout (completion checklist, outstanding items, lessons, customer outcome, acceptance recorded) + ProjectChecklist items (required items block completion) + ProjectHandover + ProjectReview (retrospective).
           Complete needs projects.projects.complete; archive projects.projects.archive; reopen projects.projects.reopen with a reason. Completion is refused with a clear list of what blocks it. */
      pane("x", 0, '<div class="g2">' + cd("<b>Completion checklist</b>", [["All deliverables accepted", 0], ["Customer acceptance recorded", 0], ["Final invoice sent (08)", 0], ["Documentation handed over (17)", 0], ["Retrospective held", 0], ["Time entries closed (18)", 1]].map((r) => '<div class="rowx">' + cb(r[1]) + '<div class="grow">' + r[0] + "</div></div>").join(""), 1) +
        cd("<b>Handover</b><span class='r'>" + btn("Plan handover", "plus", "sm") + "</span>", '<div class="sub-note">No handover planned. Hand over to maintenance, support or customer success when the project completes.</div>') + "</div>" +
        '<div style="height:12px"></div>' + callout("flag", "<b>Cannot complete yet.</b> 2 gates with “blocks completion” are pending (QA sign-off, Customer acceptance) and 1 required checklist item is open.", "warn") +
        dm(["ProjectCloseout · completion_checklist, final_status_summary, outstanding_items, lessons_learned, customer_acceptance_recorded_at, closed_at", "ProjectChecklist · phase · ProjectChecklistItem · is_required, is_completed, task_id", "ProjectHandover · type, from_team_id, to_team_id, new_owner_membership_id, status", "ProjectReview · type (RETROSPECTIVE, POST_PROJECT), went_well, went_wrong, lessons, actions", "ProjectRelation · type (MAINTENANCE_FOR, CONTINUATION_OF)"], [])) +
      "</div>" +
      dm(["Project · all columns", "Reads (ids and summaries only): Task (06), Invoice/ProjectBillingSettings (08), TimeEntry/TimeProjectSettings (18), Document/Folder (17), CalendarEvent (19), Channel (12), Ticket (13), WikiSpace/WikiPage (15), Proposal (03), Contract (04)"], []) + "</div>";
  }

  /* =====================================================================================================================
     TIMELINE (spec §24–26, §76)
     @route  /projects/timeline?from=&to=&group=customer|owner|status
     @perm   VIEW projects.projects.read · edit dates projects.milestones.manage / projects.projects.update
     @api    GET /projects/timeline?from=&to= (projects with planned_start/target_completion plus milestones) · PATCH /projects/:id/milestones/:mid {planned_date}
     @mcp    projects_milestones_read
     @data   Project (planned_start, target_completion, actual_start, status_id, health) · ProjectMilestone (planned_date, actual_date, status) · ProjectDependency (FINISH_TO_START lines)
     @ui     Gantt (custom or a Gantt library), Tooltip, Popover; bars coloured by health
     @states loading · empty · error · no-access
     @note   Dragging a milestone writes planned_date and records a status-update-worthy change in audit. Cross-project dependencies (§28) are drawn as arrows between bars. Dates are never guessed: a project without
             planned_start is listed in an "Unscheduled" group.
     ===================================================================================================================== */
  function timeline() {
    const months = ["Oct", "Nov", "Dec", "Jan", "Feb"];
    const rows = [["Acme Rebrand Website", 0, 52, "green", [[40, "Content freeze"], [52, "Launch"]]], ["Mobile App v2", 5, 70, "yellow", [[38, "Beta"], [70, "Store launch"]]], ["Stripe Billing Migration", 10, 48, "green", [[48, "Go-live"]]], ["Customer Portal Build", 28, 92, "red", [[60, "Design sign-off"], [92, "Launch"]]], ["Brand Strategy Sprint", 78, 98, "", [[98, "Handover"]]], ["Data Warehouse Setup", 12, 66, "yellow", [[66, "Cutover"]]]];
    return '<div class="a-page">' + head("Timeline", "Planned start to target completion, with milestones.", sel("Group: Customer") + sel("Quarter") + btn("Today", "", "")) +
      '<div class="gantt"><div class="g-head"><span class="g-l"></span>' + months.map((m) => "<span>" + m + "</span>").join("") + "</div>" +
      rows.map((r) => '<div class="g-row"><span class="g-l">' + r[0] + '</span><div class="g-track"><i class="g-bar ' + r[3] + '" style="left:' + r[1] + "%;width:" + (r[2] - r[1]) + '%"></i>' + r[4].map((m) => '<b class="g-ms" style="left:' + m[0] + '%" title="' + m[1] + '"></b>').join("") + "</div></div>").join("") +
      '<div class="g-today" style="left:calc(220px + (100% - 220px) * 0.26)"></div></div>' +
      '<div class="sub-note" style="margin-top:8px">Bars are coloured by ProjectHealth. Diamonds are ProjectMilestone rows. The line marks today.</div>' +
      dm(["Project · planned_start, target_completion, actual_start, health", "ProjectMilestone · planned_date, actual_date, status", "ProjectDependency · source/target, type, lag_days"], []) + "</div>";
  }

  /* =====================================================================================================================
     RAID LOG — portfolio view (spec §29–32, §28, §101)
     @route  /projects/raid?tab=risks|issues|dependencies|escalations&severity=&project=
     @perm   VIEW projects.portfolio.read (all) or member-only · edit projects.risks.manage / issues.manage / dependencies.manage
     @api    GET /projects/raid/{risks|issues|dependencies|escalations}?severity=&status=&project_id=&owner_id=
     @mcp    projects_risks_manage · projects_issues_manage
     @data   ProjectRisk · ProjectIssue · ProjectDependency (cross-project: source/target type PROJECT) · ProjectEscalation
     @states loading · empty · empty-filtered · error · no-access
     @note   The same tables as the project Delivery tab, across projects. Severity of a risk is derived from probability × impact (1–5 each) by the API, then stored in ProjectRisk.severity.
     ===================================================================================================================== */
  function raid() {
    return '<div class="a-page">' + head("RAID log", "Risks, issues, dependencies and escalations across projects.", btn("Add", "plus", "primary")) +
      '<div class="tabset">' + tabs([["r", "Risks", 9], ["i", "Issues & blockers", 6], ["d", "Dependencies", 4], ["e", "Escalations", 1]], "r") +
      pane("r", 1, tbl(["Risk", "Project", "Severity", ">P × I", "Status", "Owner", "Due"], [["App Store review delay", "Mobile App v2", sev("HIGH"), "4 × 4", E("MONITORING"), av("JK"), "Nov 20"], ["Key developer leave in Dec", "Mobile App v2", sev("HIGH"), "3 × 5", E("OPEN", "yellow"), av("JK"), "Dec 1"], ["Customer slow to approve", "Customer Portal Build", sev("CRITICAL"), "5 × 4", E("OPEN", "yellow"), av("MS"), "Nov 15"]])) +
      pane("i", 0, tbl(["Issue", "Kind", "Project", "Severity", "Status", "Owner"], [["Waiting for Apple developer account", E("BLOCKER", "red"), "Mobile App v2", sev("CRITICAL"), E("OPEN", "yellow"), av("JK")], ["Android build fails on CI", E("ISSUE"), "Mobile App v2", sev("HIGH"), E("IN_PROGRESS", "blue"), av("KL")]])) +
      pane("d", 0, tbl(["From", "Type", "To", "Status", "Expected"], [["Mobile App v2", E("BLOCKS"), "Customer Portal Build", E("OPEN", "yellow"), "Nov 30"], ["Data Warehouse Setup", E("FINISH_TO_START"), "Stripe Billing Migration", E("OPEN", "yellow"), "Dec 3"]])) +
      pane("e", 0, tbl(["Summary", "Project", "Severity", "Escalated to", "Status"], [["Customer unresponsive for 3 weeks", "Customer Portal Build", sev("HIGH"), av("PR"), E("ACKNOWLEDGED", "blue")]])) + "</div>" +
      dm(["ProjectRisk · ProjectIssue · ProjectDependency · ProjectEscalation"], []) + "</div>";
  }

  /* =====================================================================================================================
     WORKLOAD (spec §50–52)
     @route  /projects/workload?from=&to=&team=
     @perm   VIEW projects.portfolio.read · edit allocations projects.members.manage
     @api    GET /projects/workload?from=&to=&team_id= (planned from ProjectAllocation, capacity from 10, actuals from 18)
     @data   ProjectAllocation (planned_hours, allocation_percent, dates) · Read-only: EmployeeCapacityPeriod (10, capacity and time off), TimeEntry (18, actual hours)
     @states loading · empty · error · no-access
     @note   Three numbers per person and week: capacity (10), planned (this module), actual (18). Over 100% planned is red. Availability and leave are owned by 10, never stored here.
     ===================================================================================================================== */
  function workload() {
    const people = [["Anna Meyer", "AM", [60, 80, 92, 70]], ["Marco Silva", "MS", [100, 118, 118, 110]], ["Sofia Jensen", "SJ", [50, 74, 60, 40]], ["Jonas Koch", "JK", [90, 101, 95, 80]], ["Kim Lund", "KL", [100, 100, 100, 100]]];
    const wk = ["Nov 10", "Nov 17", "Nov 24", "Dec 1"];
    return '<div class="a-page">' + head("Workload", "Planned allocation against capacity, per person and week.", sel("Team: All") + sel("Next 4 weeks")) +
      '<div class="panel" style="margin-top:0"><table>' + th(["Person"].concat(wk)) + "<tbody>" + people.map((r) => "<tr><td>" + who(r[1], "", r[0], "") + "</td>" + r[2].map((v) => '<td><span class="badge ' + (v > 100 ? "red" : v >= 90 ? "yellow" : "green") + '">' + v + "%</span></td>").join("") + "</tr>").join("") + "</tbody></table></div>" +
      '<div class="sub-note" style="margin-top:8px">Planned hours ÷ capacity. Marco Silva is over capacity for three weeks: reallocate or move work.</div>' +
      dm(["ProjectAllocation · membership_id, planned_hours, allocation_percent, start_date, end_date", "Read-only from 10: EmployeeCapacityPeriod · from 18: TimeEntry"], []) + "</div>";
  }

  /* =====================================================================================================================
     SETUP (spec §2, §4, §36–38)
     @route  /projects/settings?tab=types|statuses|templates
     @perm   projects.settings.manage (project types, statuses, templates)
     @api    /project-types · /project-statuses · /project-templates (+ /versions) CRUD; publishing a template creates a ProjectTemplateVersion
     @data   ProjectType · ProjectStatus · ProjectTemplate · ProjectTemplateVersion
     @audit  type, status or template changed · template version published
     @note   Statuses are organization-defined but each maps to a fixed ProjectStatusCategory (the code relies on the category, not the name). allowed_transitions limits where a project may move. Template versions are immutable:
             updating a template never changes existing projects (they keep template_version_id). A project type decides enabled sections, required fields, health rules and completion requirements.
     ===================================================================================================================== */
  function settings() {
    return '<div class="a-page">' + head("Project setup", "Types, statuses and templates for your organization.", btn("New type", "plus", "primary")) +
      '<div class="tabset">' + tabs([["t", "Types"], ["s", "Statuses"], ["m", "Templates"]], "t") +
      pane("t", 1, tbl(["Type", "Default template", "Sections", "Required fields", "Default time", ""], [["Website build", "Website · v4", "12", "customer, owner, target date", E("Billable", "green"), more], ["Mobile app", "Mobile app · v2", "14", "customer, owner, budget", E("Billable", "green"), more], ["Integration", "—", "9", "customer, owner", E("Billable", "green"), more], ["Internal", "Internal project · v1", "6", "owner", E("Non billable"), more]])) +
      pane("s", 0, tbl(["Status", "Category", "Moves to", "Default", ""], [["Planned", E("PLANNED", "blue"), "In progress, Cancelled", "Yes", more], ["In progress", E("IN_PROGRESS", "green"), "On hold, Blocked, Ready for completion", "", more], ["On hold", E("ON_HOLD", "yellow"), "In progress, Cancelled", "", more], ["Blocked", E("BLOCKED", "red"), "In progress", "", more], ["Ready for completion", E("READY_FOR_COMPLETION", "purple"), "Completed, In progress", "", more], ["Completed", E("COMPLETED", "green"), "In progress (reopen)", "", more]])) +
      pane("m", 0, tbl(["Template", "Type", "Version", "Contents", "Active", ""], [["Website", "Website build", "v4", "6 milestones · 4 workstreams · 38 tasks", sw(1), more], ["Mobile app", "Mobile app", "v2", "8 milestones · 5 workstreams · 61 tasks", sw(1), more], ["Internal project", "Internal", "v1", "2 milestones · 12 tasks", sw(0), more]])) + "</div>" +
      dm(["ProjectType · enabled_sections, required_fields, health_rules, completion_requirements, default_time_billable, default_template_id", "ProjectStatus · category, allowed_transitions, is_default", "ProjectTemplate · current_version_id, is_active · ProjectTemplateVersion · version_number, structure (JSON)"], []) + "</div>";
  }

  const MAP = { overview, list, detail, timeline, raid, workload, settings };
  const CRUMB = { detail: "PRJ-0043 Mobile App v2" };
  window.VIEWS.projects = { html: function (s) { return (MAP[s || "overview"] || MAP.overview)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
