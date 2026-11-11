/* =====================================================================================================================
   TASKS APP — module 06 (docs/features/06-task-management.md). Linear-style: fast lists, board, cycles, releases.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: Task, TaskStatus, TaskType, TaskLabel, TaskLabelAssignment, TaskAssignee, TaskDependency, TaskChecklistItem, TaskComment, TaskAttachment, TaskLink, TaskStatusHistory,
   TaskWatcher, Cycle, Release, ReleaseDeployment, Team.task_key. Enums are real values: TaskStatusCategory (BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE, CANCELLED), TaskPriority (NONE, LOW, MEDIUM, HIGH,
   URGENT), TaskDependencyType (BLOCKS, RELATED, DUPLICATE_OF), CycleStatus (PLANNED, ACTIVE, COMPLETED, CANCELLED), ReleaseStatus (PLANNED, IN_PROGRESS, RELEASED, CANCELLED), DeploymentStatus (PENDING, IN_PROGRESS,
   SUCCEEDED, FAILED, ROLLED_BACK), TaskCommentVisibility (INTERNAL, CUSTOMER_VISIBLE).
   Permission keys: tasks.tasks.* (read, create, update, delete*, assign), tasks.comments.internal.read, tasks.workflows.manage, tasks.cycles.manage, tasks.releases.manage, tasks.bulk.execute, tasks.workload.read.
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - The task KEY is Team.task_key + Task.number (e.g. WEB-142). Task.number is sequential per organization; the key prefix is the team's task_key. A task without a team has no prefix and shows its number only.
     - STATUS is organization-defined (TaskStatus: per team and/or project type, with allowed_transitions) but every status maps to a fixed TaskStatusCategory. Code, boards and reports rely on the CATEGORY, never the name.
       Every change writes a TaskStatusHistory row (seconds_in_previous feeds cycle time and lead time).
     - Task.blocked / blocked_reason is a flag independent of status; it is also derived from open TaskDependency BLOCKS rows. Show both reasons.
     - Customer visibility is opt-in: Task.customer_visible and TaskComment.visibility = CUSTOMER_VISIBLE. INTERNAL comments need tasks.comments.internal.read and never reach the portal (07). Enforce on the server.
     - Tasks LINK, they do not own: project/workstream/milestone (05), documents (17), tickets (13), CRM records (02), time (18). Links use TaskLink (entity_type = RecordEntityType) or typed columns.
     - Effort: estimate_points / estimate_hours are planned; actual_hours is the sum of time entries (18). Never edit actual_hours by hand.
     - Lists are keyboard-first (j/k, c create, s status, a assign, p priority), optimistic UI, cursor pagination + virtualization beyond ~50 rows, filtered server-side by branch/team/project scope.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + p + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"] };
  const av = (a) => AV(a, PEOPLE[a][1]);
  const wh = (a) => who(a, PEOPLE[a][1], PEOPLE[a][0], "");

  /* @impl statusGlyph(category): icon by TaskStatusCategory, never by status name. BACKLOG dashed circle, TODO empty circle, IN_PROGRESS half-filled yellow, IN_REVIEW three-quarter purple, BLOCKED red,
       DONE filled blue check, CANCELLED struck circle. Colours are semantic tokens so light and dark both work. */
  const CAT = { BACKLOG: "var(--ash)", TODO: "var(--mute)", IN_PROGRESS: "var(--yellow)", IN_REVIEW: "var(--purple)", BLOCKED: "var(--red)", DONE: "var(--blue)", CANCELLED: "var(--ash)" };
  function glyph(c) {
    const col = CAT[c], w = (x) => '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex:none" title="TaskStatusCategory ' + c + '">' + x + "</svg>";
    if (c === "BACKLOG") return w('<circle cx="7" cy="7" r="5.5" stroke="' + col + '" stroke-width="1.5" stroke-dasharray="2 2"/>');
    if (c === "TODO") return w('<circle cx="7" cy="7" r="5.5" stroke="' + col + '" stroke-width="1.5"/>');
    if (c === "IN_PROGRESS") return w('<circle cx="7" cy="7" r="5.5" stroke="' + col + '" stroke-width="1.5"/><path d="M7 3.5a3.5 3.5 0 0 1 0 7z" fill="' + col + '"/>');
    if (c === "IN_REVIEW") return w('<circle cx="7" cy="7" r="5.5" stroke="' + col + '" stroke-width="1.5"/><path d="M7 3.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5V7z" fill="' + col + '"/>');
    if (c === "BLOCKED") return w('<circle cx="7" cy="7" r="5.5" stroke="' + col + '" stroke-width="1.5"/><path d="M4.5 7h5" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round"/>');
    if (c === "CANCELLED") return w('<circle cx="7" cy="7" r="5.5" stroke="' + col + '" stroke-width="1.5"/><path d="M4.8 4.8l4.4 4.4M9.2 4.8l-4.4 4.4" stroke="' + col + '" stroke-width="1.3" stroke-linecap="round"/>');
    return w('<circle cx="7" cy="7" r="6.25" fill="' + col + '"/><path d="M4.5 7.2l1.7 1.7 3.3-3.4" stroke="var(--on-accent)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>');
  }
  /* @impl priorityGlyph(TaskPriority): URGENT red square "!", HIGH/MEDIUM/LOW 3/2/1 bars, NONE dim bars. */
  function pr(v) {
    if (v === "URGENT") return '<span class="prio-urg" title="TaskPriority URGENT">!</span>';
    const n = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }[v], h = [4, 7, 10];
    return '<svg width="14" height="14" viewBox="0 0 14 14" style="flex:none;color:var(--mute)" title="TaskPriority ' + v + '">' + h.map((x, i) => '<rect x="' + (1 + i * 4.5) + '" y="' + (12 - x) + '" width="3" height="' + x + '" rx="1" fill="currentColor" opacity="' + (i < n ? 1 : 0.2) + '"/>').join("") + "</svg>";
  }
  const lbl = (n, c) => '<span class="badge ' + c + '">' + n + "</span>";
  const CATLBL = { BACKLOG: "Backlog", TODO: "Todo", IN_PROGRESS: "In progress", IN_REVIEW: "In review", BLOCKED: "Blocked", DONE: "Done", CANCELLED: "Canceled" };

  /* key, title, category, status name, priority, labels, project, assignee, due, points */
  const T = [
    ["WEB-142", "Rebuild pricing page hero with new brand system", "IN_PROGRESS", "In progress", "HIGH", [["Frontend", "blue"]], "Acme Rebrand Website", "MS", "Nov 14", 3],
    ["WEB-139", "Stripe webhook retries failing intermittently", "IN_REVIEW", "In review", "URGENT", [["Bug", "red"], ["Billing", "purple"]], "Stripe Billing Migration", "AM", "Nov 12", 5],
    ["MOB-87", "Offline mode for task sync", "IN_PROGRESS", "In progress", "MEDIUM", [["Feature", "green"]], "Mobile App v2", "SJ", "Nov 20", 8],
    ["WEB-151", "Client approval flow for design deliverables", "BLOCKED", "Blocked", "HIGH", [["Portal", "purple"]], "Customer Portal Build", "MS", "Nov 18", 5],
    ["WEB-148", "Add VAT number validation to checkout", "TODO", "Todo", "MEDIUM", [["Billing", "purple"]], "Stripe Billing Migration", "AM", "Nov 19", 2],
    ["DES-33", "Illustration set for onboarding emails", "TODO", "Todo", "LOW", [["Design", "yellow"]], "Brand Strategy Sprint", "SJ", "Nov 25", 3],
    ["MOB-92", "Push notification permission copy", "TODO", "Todo", "NONE", [], "Mobile App v2", "JK", "—", 1],
    ["WEB-120", "Migrate analytics events to new schema", "BACKLOG", "Backlog", "LOW", [["Tech debt", "yellow"]], "Data Warehouse Setup", "AM", "—", 5],
    ["WEB-117", "Support dark mode in embedded widgets", "BACKLOG", "Backlog", "LOW", [["Frontend", "blue"]], "Acme Rebrand Website", "MS", "—", 3],
    ["MOB-71", "Investigate cold-start performance on Android", "BACKLOG", "Backlog", "MEDIUM", [["Bug", "red"]], "Mobile App v2", "JK", "—", 5],
    ["WEB-131", "Publish the new case study template", "DONE", "Done", "LOW", [["Content", "green"]], "Acme Rebrand Website", "SJ", "Nov 5", 2],
  ];
  const rowH = (r, sel) => '<div class="tk-row' + (sel ? " sel" : "") + '">' + pr(r[4]) + '<span class="id">' + r[0] + "</span>" + glyph(r[2]) + '<span class="t">' + r[1] + "</span>" + '<span class="lbls">' + r[5].map((l) => lbl(l[0], l[1])).join("") + "</span>" + '<span class="proj">' + I("folder", 12) + r[6] + '</span><span class="due">' + r[8] + "</span>" + av(r[7]) + "</div>";
  const group = (cat, rows, selKey) => '<div class="tk-grp"><div class="tk-grp-h">' + glyph(cat) + "<b>" + CATLBL[cat] + '</b><span class="n">' + rows.length + '</span><button class="btn ghost sm icon" style="margin-left:auto">' + I("plus", 14) + "</button></div>" + rows.map((r) => rowH(r, r[0] === selKey)).join("") + "</div>";
  const bar2 = (title, extra) => '<div class="tk-head"><div class="tk-title">' + I("tasks", 16) + " " + title + '</div><span style="flex:1"></span>' + extra + "</div>";

  /* =====================================================================================================================
     MY TASKS (spec §3, §5, §12)
     @route  /tasks/mine?group=status|priority|project&view=
     @perm   VIEW tasks.tasks.read · create tasks.tasks.create · edit inline tasks.tasks.update · assign tasks.tasks.assign · bulk tasks.bulk.execute · delete tasks.tasks.delete*
     @api    GET /tasks?assignee=me&status_category=&label=&cycle=&sort=&cursor= · POST /tasks · PATCH /tasks/:id (status_id, priority, assignee_membership_id, due_date, estimate_points)
     @mcp    tasks_tasks_read · tasks_tasks_create · tasks_tasks_update · tasks_tasks_assign
     @data   Task (number, title, status_id, priority, assignee_membership_id, due_date, estimate_points, project_id, blocked) · Team.task_key (key prefix) · TaskStatus.category · TaskLabelAssignment/TaskLabel · TaskAssignee (extra assignees)
     @ui     div-grid rows (not <table>) with roving tabindex, Popover+Command pickers for status/assignee/priority (shadcn), Badge, Avatar, ToggleGroup for the view switch
     @states loading skeleton rows · empty ("Nothing assigned to you") · error · no-access
     @audit  every inline edit writes audit_events and a TaskStatusHistory row for status changes
     @note   "My tasks" = Task.assignee_membership_id = me OR a TaskAssignee row for me. Grouping, order and visible columns ("Display") are per-user SavedView rows (entity_type TASK, module 02 platform table).
             Row highlight = keyboard focus / open peek.
     ===================================================================================================================== */
  function mine() {
    const g = (c) => T.filter((r) => r[2] === c && r[7] !== "KL");
    return '<div class="tk">' + bar2("My tasks <span class='badge'>10</span>", '<button class="btn sm">' + I("filter", 13) + ' Filter</button><button class="btn sm">' + I("sort", 13) + " Display</button>") +
      '<div class="tk-list">' + ["IN_REVIEW", "IN_PROGRESS", "BLOCKED", "TODO", "BACKLOG"].map((c) => group(c, g(c), "WEB-142")).join("") + "</div>" +
      '<div style="padding:16px 20px">' + dm(["Task · number, title, status_id, priority, assignee_membership_id, due_date, estimate_points, blocked, project_id", "Team · task_key", "TaskStatus · category · TaskLabel · TaskAssignee", "SavedView · entity_type TASK (columns, grouping, sorting)"], []) + "</div></div>";
  }

  /* =====================================================================================================================
     TEAM BOARD (spec §4–5)
     @route  /tasks/teams/:teamSlug/board?cycle=&project=&assignee=&label=
     @perm   VIEW tasks.tasks.read · move cards tasks.tasks.update (only to statuses in allowed_transitions)
     @api    GET /tasks?team_id=&group=status · PATCH /tasks/:id {status_id, rank}
     @mcp    tasks_tasks_update
     @data   Task (status_id, rank, priority, assignee_membership_id, estimate_points, due_date, blocked) · TaskStatus (team_id, category, sort_order, allowed_transitions)
     @ui     Kanban with a keyboard- and touch-capable drag library (dnd-kit); one column per TaskStatus of the team, ordered by sort_order
     @states loading · empty column ("No tasks") · error · no-access
     @note   Columns are the team's own statuses (TaskStatus.team_id, or the project type's); the order inside a column is Task.rank (fractional index string). A drop into a status not allowed from the current one is refused
             with the reason. Moving into a BLOCKED-category status asks for blocked_reason. Moving into DONE sets completed_at.
     ===================================================================================================================== */
  function board() {
    const cols = [["Backlog", "BACKLOG"], ["Todo", "TODO"], ["In progress", "IN_PROGRESS"], ["In review", "IN_REVIEW"], ["Done", "DONE"]];
    return '<div class="a-page">' + head("Web · Board", "Active cycle 14 · Nov 3 – Nov 16", sel("All assignees", "users") + btn("New task", "plus", "primary")) +
      '<div class="kb" style="display:flex;gap:12px;overflow-x:auto;align-items:flex-start;padding-bottom:6px">' + cols.map((c) => {
        const rows = T.filter((r) => r[2] === c[1] && /^(WEB|DES)/.test(r[0]));
        return '<div class="kcol"><div class="kcol-h"><div class="t">' + glyph(c[1]) + " " + c[0] + ' <span class="count">' + rows.length + '</span></div><div class="m"><span>' + rows.reduce((s, r) => s + r[9], 0) + ' pts</span></div></div><div class="kcol-b">' +
          (rows.length ? rows.map((r) => '<div class="kcard"><div class="co">' + r[0] + " " + pr(r[4]) + '</div><div class="n">' + r[1] + '</div><div style="display:flex;gap:6px;align-items:center;margin-top:8px">' + r[5].map((l) => lbl(l[0], l[1])).join("") + '<span style="flex:1"></span><span class="muted">' + r[9] + " pts</span>" + av(r[7]) + "</div></div>").join("") : '<div class="sub-note" style="padding:8px">No tasks</div>') + "</div></div>";
      }).join("") + "</div>" +
      dm(["Task · status_id, rank, priority, assignee_membership_id, estimate_points, blocked", "TaskStatus · team_id, category, sort_order, allowed_transitions", "Cycle · number, status, starts_at, ends_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     BACKLOG & TRIAGE (spec §4)
     @route  /tasks/teams/:teamSlug/backlog?triage=1
     @perm   VIEW tasks.tasks.read · prioritize/assign tasks.tasks.update / assign · bulk tasks.bulk.execute
     @api    GET /tasks?team_id=&status_category=BACKLOG&cycle_id=null · POST /tasks/bulk {task_ids, patch}
     @mcp    tasks_tasks_update · tasks_bulk_execute
     @data   Task (status_id of category BACKLOG, cycle_id null, priority, estimate_points, rank) · Task.ticket_links (TicketTaskLink, 13) · TaskType
     @ui     Grouped list, multi-select with a bulk action bar, Popover+Command pickers
     @states loading · empty ("Backlog is clear") · error · no-access
     @note   TRIAGE is not a separate table: it is the BACKLOG-category tasks that have no assignee and no priority (priority NONE), shown on top. Tasks converted from support tickets (13) and customer-approved
             requests (07) arrive here with their TaskLink and keep bidirectional status sync. Bulk edits are one request, one audit event per task.
     ===================================================================================================================== */
  function backlog() {
    const inbox = [["WEB-160", "Customer asks for CSV export of invoices", "From ticket TCK-2041 · Acme Corp"], ["MOB-95", "App crashes on iOS 17.2 when offline", "From ticket TCK-2038 · Northwind"]];
    return '<div class="tk">' + bar2("Web · Backlog <span class='badge'>14</span>", '<button class="btn sm">' + I("filter", 13) + " Filter</button>" + btn("Plan into cycle", "plus", "sm")) +
      '<div class="tk-list"><div class="tk-grp"><div class="tk-grp-h">' + I("inbox", 14) + "<b>Triage</b><span class='n'>" + inbox.length + "</span><span class='muted' style='margin-left:8px'>no assignee, no priority</span></div>" +
      inbox.map((r) => '<div class="tk-row">' + pr("NONE") + '<span class="id">' + r[0] + "</span>" + glyph("BACKLOG") + '<span class="t">' + r[1] + '</span><span class="proj">' + I("support", 12) + r[2] + '</span><button class="btn sm">Accept</button><button class="btn sm">Decline</button></div>').join("") + "</div>" +
      group("BACKLOG", T.filter((r) => r[2] === "BACKLOG"), "") + "</div>" +
      '<div style="padding:16px 20px">' + dm(["Task · status category BACKLOG, cycle_id, priority, assignee_membership_id, rank", "TicketTaskLink (13) · task_id, ticket_id (bidirectional sync)", "TaskType · name, template"], []) + "</div></div>";
  }

  /* =====================================================================================================================
     TASK DETAIL (spec §3, §7–8, §13)
     @route  /tasks/:taskKey (side peek from lists, full page by direct link) e.g. /tasks/WEB-142
     @perm   VIEW tasks.tasks.read · edit tasks.tasks.update · assign tasks.tasks.assign · delete tasks.tasks.delete* · INTERNAL comments tasks.comments.internal.read
     @api    GET /tasks/:key · PATCH /tasks/:id · POST /tasks/:id/comments {body, visibility} · POST /tasks/:id/checklist · POST /tasks/:id/links · POST /tasks/:id/attachments {document_id}
     @mcp    tasks_tasks_read · tasks_tasks_update · tasks_tasks_assign
     @data   Task (all columns) · TaskAssignee · TaskLabelAssignment · TaskDependency · TaskChecklistItem · TaskComment · TaskAttachment (document_id, 17) · TaskLink · TaskStatusHistory · TaskWatcher · TimeEntry (18, read-only)
     @ui     Two-column page: title + Markdown description + sub-tasks + checklist + activity on the left, property panel on the right (shadcn Select/Popover+Command for every picker)
     @states loading · not found · error · no-access
     @audit  field changes, status transitions (TaskStatusHistory), comments, link/dependency changes, visibility changes
     @note   Sub-tasks are Tasks with parent_task_id. Acceptance criteria are Json (a checklist the reviewer ticks). Customer-visible tasks and CUSTOMER_VISIBLE comments surface in the portal (07); a visible comment is
             clearly marked in the composer so nobody posts internal text by accident. actual_hours is read-only (sum of TimeEntry, 18). Discussion can open a contextual conversation in 12, but the task thread stays the record.
     ===================================================================================================================== */
  function detail() {
    const prop = (k, v) => '<div class="kvr"><span>' + k + "</span><b>" + v + "</b></div>";
    return '<div class="a-page">' +
      '<div class="a-head"><div><h1>Rebuild pricing page hero with new brand system</h1><p>WEB-142 · created by Anna Meyer Nov 3 · ' + E("Feature") + '</p></div><div class="acts">' + btn("Watch", "bell") + btn("Link", "link") + btn("Edit", "edit", "primary") + "</div></div>" +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Description</b>", "<p>Replace the hero on <b>/pricing</b> with the new brand system: updated headline scale, the three plan cards and the annual toggle. Must pass the accessibility checklist.</p>") +
      '<div style="height:12px"></div>' +
      cd("<b>Sub-tasks</b><span class='r muted'>parent_task_id · 2 of 4</span>", [["WEB-143", "Update headline scale tokens", "DONE"], ["WEB-144", "Plan cards component", "IN_PROGRESS"], ["WEB-145", "Annual toggle", "TODO"], ["WEB-146", "Accessibility pass", "TODO"]].map((r) => '<div class="rowx">' + glyph(r[2]) + '<div class="grow"><b>' + r[1] + "</b><small>" + r[0] + "</small></div></div>").join(""), 1) +
      '<div style="height:12px"></div>' +
      cd("<b>Checklist</b><span class='r muted'>TaskChecklistItem</span>", [["Design tokens merged", 1], ["Responsive at 360 px", 1], ["Dark mode checked", 0], ["Lighthouse score ≥ 90", 0]].map((r) => '<div class="rowx">' + cb(r[1]) + '<div class="grow">' + r[0] + "</div></div>").join(""), 1) +
      '<div style="height:12px"></div>' +
      cd("<b>Activity</b><span class='r muted'>comments · TaskStatusHistory</span>", '<div class="tl"><div class="ev"><b>Marco Silva moved to In progress</b><small>Nov 8 · was Todo for 2 days</small></div><div class="ev"><b>Anna Meyer commented</b> ' + E("INTERNAL") + "<small>Nov 7 · “Use the new gradient only on the plan cards.”</small></div><div class=\"ev\"><b>Lena Kovac (customer) commented</b> " + E("CUSTOMER_VISIBLE", "blue") + "<small>Nov 6 · “Can we keep the monthly price visible by default?”</small></div></div>" +
      '<div class="rowx" style="margin-top:8px"><div class="grow muted">Write a comment…</div>' + sel("Internal", "lock") + btn("Comment", "", "primary") + "</div>") +
      "</div><div>" +
      cd("<b>Properties</b>", prop("Status", glyph("IN_PROGRESS") + " In progress") + prop("Priority", pr("HIGH") + " High") + prop("Assignee", wh("MS")) + prop("Also assigned", av("AM")) + prop("Reporter", "Anna Meyer") + prop("Labels", lbl("Frontend", "blue")) + prop("Type", "Feature") + prop("Estimate", "3 points · 6 h") + prop("Actual", "4.5 h " + muted("from time (18)")) + prop("Start", "Nov 8") + prop("Due", "Nov 14") + prop("Cycle", "Cycle 14") + prop("Release", "2026.11 website") + prop("Customer visible", sw(1))) +
      '<div style="height:12px"></div>' +
      cd("<b>Project & links</b>", prop("Project", "Acme Rebrand Website " + muted("(05)")) + prop("Milestone", "Launch · Nov 28") + prop("Workstream", "Website build") + prop("Blocked by", "WEB-139 " + muted("BLOCKS")) + prop("Ticket", "TCK-2041 " + muted("(13)")) + prop("Deal", "Acme redesign " + muted("(02)")) + prop("Attachments", "2 documents " + muted("(17)"))) +
      "</div></div>" +
      dm(["Task · all columns (see the property panel)", "TaskAssignee · TaskLabelAssignment · TaskDependency (type BLOCKS | RELATED | DUPLICATE_OF) · TaskChecklistItem · TaskWatcher", "TaskComment · visibility, mentions, reactions, parent_comment_id · TaskAttachment (document_id) · TaskLink (entity_type, entity_id, relation) · TaskStatusHistory", "Read-only: TimeEntry (18), Project/ProjectMilestone (05), Ticket (13)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CYCLES (spec §4)
     @route  /tasks/teams/:teamSlug/cycles · /tasks/teams/:teamSlug/cycles/:number
     @perm   VIEW tasks.tasks.read · create/complete tasks.cycles.manage
     @api    GET /cycles?team_id= · POST /cycles · POST /cycles/:id/complete {carry_over: "next"|"backlog"}
     @mcp    tasks_cycles_manage
     @data   Cycle (number, name, goal, status, starts_at, ends_at, completed_at, team_id, project_id) · Task (cycle_id, estimate_points, status category) · TaskStatusHistory (burndown, scope change)
     @ui     Card, Progress, burndown chart, Table
     @states loading · empty ("No cycles yet") · error · no-access
     @audit  cycle created, started, completed; tasks carried over
     @note   A cycle is scoped to a team and/or a project. Completing a cycle asks what to do with unfinished tasks (carry over to the next cycle or move to the backlog); both are single-request bulk updates. Burndown and
             scope change are computed from TaskStatusHistory and Task.cycle_id changes, not stored separately. Velocity = completed points of the last N cycles.
     ===================================================================================================================== */
  function cycles() {
    return '<div class="a-page">' + head("Web · Cycles", "Two-week cycles with carry-over.", btn("New cycle", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Cycle 14", "ACTIVE", "Nov 3 – Nov 16") + stat("Scope", "42 pts", "+5 added") + stat("Completed", "26 pts", "62%") + stat("Days left", 5, "of 14") + stat("Velocity", "38", "avg last 4 cycles") + "</div>" +
      '<div class="g2">' + cd("<b>Burndown</b><span class='r muted'>from TaskStatusHistory</span>", '<svg viewBox="0 0 300 110" width="100%" height="110" style="display:block"><path d="M5 10 L295 100" stroke="var(--hairline-strong)" stroke-width="1" stroke-dasharray="4 3" fill="none"/><path d="M5 10 L50 22 L95 30 L140 44 L185 52 L230 60" stroke="var(--blue)" stroke-width="2" fill="none"/></svg><div class="sub-note">Ideal line dashed. Scope added on Nov 6 (+5 pts).</div>') +
      cd("<b>Cycles</b><span class='r muted'>Cycle</span>", [["Cycle 14", "ACTIVE", "Nov 3 – Nov 16", 62], ["Cycle 15", "PLANNED", "Nov 17 – Nov 30", 0], ["Cycle 13", "COMPLETED", "Oct 20 – Nov 2", 100], ["Cycle 12", "COMPLETED", "Oct 6 – Oct 19", 92]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[2] + "</small></div>" + E(r[1], r[1] === "ACTIVE" ? "green" : r[1] === "PLANNED" ? "blue" : "") + bar(r[3]) + "</div>").join(""), 1) + "</div>" +
      '<div style="height:12px"></div>' + callout("flag", "<b>Complete cycle 14?</b> 6 tasks are not done. Choose to carry them over to cycle 15 or move them back to the backlog.", "warn") +
      dm(["Cycle · number, goal, status, starts_at, ends_at, completed_at, team_id, project_id", "Task · cycle_id, estimate_points · TaskStatusHistory (burndown)"], []) + "</div>";
  }

  /* =====================================================================================================================
     RELEASES (spec §9)
     @route  /tasks/releases · /tasks/releases/:releaseId
     @perm   VIEW tasks.tasks.read · create/edit/publish tasks.releases.manage
     @api    GET /releases · POST /releases · POST /releases/:id/deployments · POST /releases/:id/publish-notes
     @mcp    tasks_releases_manage
     @data   Release (name, version, status, target_date, released_at, notes, notes_document_id, customer_visible, affected_company_ids, milestone_id) · ReleaseDeployment (environment, status, url, deployed_at) · Task (release_id)
     @ui     Card, Table, Badge, Progress
     @states loading · empty · error · no-access
     @audit  release created, status changed, deployment recorded, notes published
     @note   Release notes are generated from the included tasks (AI draft, human edit) and stored as a Document (notes_document_id, 17); customer_visible ones can be published to the portal and the support knowledge base.
             affected_company_ids are CRM companies (02) derived from linked tickets (13) and are ids only. A Release may map to a ProjectMilestone (05) through milestone_id.
     ===================================================================================================================== */
  function releases() {
    return '<div class="a-page">' + head("Releases", "What ships, where and when.", btn("New release", "plus", "primary")) +
      tbl(["Release", "Version", "Status", "Target", ">Tasks", "Progress", "Environments", "Customer visible"], [[ink("Website 2026.11"), "2026.11", E("IN_PROGRESS", "blue"), "Nov 28", "18", bar(61), E("STAGING · SUCCEEDED", "green") + " " + E("PRODUCTION · PENDING"), sw(1)], [ink("Mobile 2.0"), "2.0.0", E("PLANNED"), "Dec 12", "34", bar(41), E("STAGING · IN PROGRESS", "blue"), sw(1)], [ink("Billing migration"), "1.4.0", E("RELEASED", "green"), "Nov 5", "9", bar(100), E("PRODUCTION · SUCCEEDED", "green"), sw(0)], [ink("Hotfix 2026.10.2"), "2026.10.2", E("CANCELLED"), "Oct 30", "2", bar(0), E("STAGING · ROLLED BACK", "red"), sw(0)]]) +
      '<div style="height:12px"></div>' + cd("<b>Website 2026.11 · release notes</b><span class='r'>" + btn("Generate with AI", "sparkles", "sm") + btn("Publish", "send", "sm") + "</span>", "<p><b>New</b> · Redesigned pricing page. <b>Fixed</b> · Stripe webhook retries. <b>Affects</b> 3 customers from linked tickets.</p><div class='sub-note'>Draft stored as a Document (17). Publishing to the portal needs release.customer_visible.</div>") +
      dm(["Release · name, version, status, target_date, released_at, notes_document_id, customer_visible, affected_company_ids, milestone_id", "ReleaseDeployment · environment, status, url, deployed_at", "Task · release_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     WORKLOAD (spec §10)
     @route  /tasks/workload?team=&cycle=
     @perm   VIEW tasks.workload.read (scope-limited to the caller's teams)
     @api    GET /tasks/workload?team_id=&cycle_id=
     @data   Task (assignee_membership_id, estimate_hours, estimate_points, due_date, blocked, status category) · Read-only: EmployeeCapacityPeriod (10) and ProjectAllocation (05) for capacity
     @states loading · empty · error · no-access
     @note   This is TASK distribution: open tasks, estimates, overdue and blocked per person. Capacity, availability and utilization belong to 10 and 18; planned project allocation belongs to 05. The bottleneck flags are
             computed (overdue and blocked counts), not stored.
     ===================================================================================================================== */
  function workload() {
    const R = [["MS", 9, 34, 2, 1, 118], ["AM", 7, 26, 1, 0, 92], ["JK", 6, 22, 0, 2, 81], ["SJ", 5, 18, 0, 0, 60], ["KL", 8, 30, 1, 0, 100]];
    return '<div class="a-page">' + head("Workload", "Open tasks and estimates per person.", sel("Cycle 14") + sel("Team: Web")) +
      tbl(["Person", ">Open", ">Estimate (h)", ">Overdue", ">Blocked", "Load vs capacity"], R.map((r) => [wh(r[0]), r[1], r[2], r[3] ? '<span class="badge red">' + r[3] + "</span>" : "0", r[4] ? '<span class="badge yellow">' + r[4] + "</span>" : "0", bar(Math.min(r[5], 100), r[5] > 100 ? "red" : "green") + (r[5] > 100 ? " " + muted(r[5] + "% of capacity") : "")])) +
      '<div class="sub-note" style="margin-top:8px">Marco Silva has 2 overdue tasks and is over capacity: reassign or move work. Capacity comes from 10, never edited here.</div>' +
      dm(["Task · assignee_membership_id, estimate_hours, due_date, blocked", "Read-only: EmployeeCapacityPeriod (10) · ProjectAllocation (05)"], []) + "</div>";
  }

  /* =====================================================================================================================
     REPORTS (spec §11)
     @route  /tasks/reports?team=&from=&to=
     @perm   VIEW tasks.tasks.read (scope-limited); organization-wide totals need tasks.workload.read
     @api    GET /tasks/reports/{throughput|cycle-time|lead-time|estimates|completion}
     @data   TaskStatusHistory (changed_at, seconds_in_previous, to_category) · Task (completed_at, created_at, estimate_*, actual_hours) · Cycle
     @states loading · empty · error · no-access
     @note   Lead time = created_at to completed_at. Cycle time = first IN_PROGRESS to DONE, from TaskStatusHistory. Estimate vs actual needs time entries (18). All numbers are computed from history, never stored by hand.
     ===================================================================================================================== */
  function reports() {
    const wk = [14, 18, 12, 20, 16, 22, 19, 24];
    return '<div class="a-page">' + head("Reports", "How work flows through the team.", sel("Last 8 weeks") + sel("Team: Web")) +
      '<div class="mini-stats">' + stat("Completed", 124, "tasks") + stat("Lead time", "6.2 d", "median") + stat("Cycle time", "3.4 d", "median") + stat("Overdue", 7, "open", 1) + stat("Blocked", 4, "open", 1) + stat("Estimate accuracy", "86%", "actual vs estimate") + "</div>" +
      '<div class="g2">' + cd("<b>Throughput</b><span class='r muted'>tasks done per week</span>", '<div style="display:flex;align-items:flex-end;gap:8px;height:110px">' + wk.map((v) => '<span style="flex:1;background:var(--blue);border-radius:4px 4px 0 0;height:' + v * 4 + 'px" title="' + v + ' tasks"></span>').join("") + '</div><div class="sub-note">Weeks 38–45</div>') +
      cd("<b>Time in status</b><span class='r muted'>average days</span>", [["Todo", 2.1, "var(--mute)"], ["In progress", 3.4, "var(--yellow)"], ["In review", 1.2, "var(--purple)"], ["Blocked", 0.8, "var(--red)"]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i style="width:' + r[1] * 22 + "%;background:" + r[2] + '"></i></span><span class="v">' + r[1] + " d</span></div>").join("")) + "</div>" +
      dm(["TaskStatusHistory · seconds_in_previous, to_category, changed_at", "Task · created_at, completed_at, estimate_hours, actual_hours", "Cycle · velocity"], []) + "</div>";
  }

  /* =====================================================================================================================
     SETUP (spec §3, §5; 06 workflow)
     @route  /tasks/settings?tab=statuses|types|labels
     @perm   tasks.workflows.manage (statuses and transitions) · types and labels need tasks.tasks.update on the organization scope
     @api    /task-statuses · /task-types · /task-labels CRUD
     @data   TaskStatus (team_id, project_type_id, category, sort_order, allowed_transitions, is_default) · TaskType (name, icon, color, template, is_default) · TaskLabel (parent_label_id)
     @audit  workflow changed · type or label created, archived
     @note   Workflows are per TEAM and/or PROJECT TYPE (05): a status with project_type_id applies only to projects of that type. Removing a status in use requires choosing a replacement; archived_at hides it from pickers but
             keeps history. Task type `template` holds default field values and a checklist applied on create.
     ===================================================================================================================== */
  function settings() {
    return '<div class="a-page">' + head("Task setup", "Workflows, task types and labels.", btn("New status", "plus", "primary")) +
      '<div class="tabset">' + tabs([["s", "Statuses"], ["t", "Types"], ["l", "Labels"]], "s") +
      pane("s", 1, tbl(["Status", "Category", "Scope", "Moves to", "Default", ""], [["Backlog", E("BACKLOG"), "All teams", "Todo", "Yes", more], ["Todo", E("TODO"), "All teams", "In progress, Backlog", "", more], ["In progress", E("IN_PROGRESS", "yellow"), "All teams", "In review, Blocked, Todo", "", more], ["In review", E("IN_REVIEW", "purple"), "Web, Mobile", "Done, In progress", "", more], ["Blocked", E("BLOCKED", "red"), "All teams", "In progress", "", more], ["Done", E("DONE", "blue"), "All teams", "In progress (reopen)", "", more], ["Canceled", E("CANCELLED"), "All teams", "Backlog", "", more]])) +
      pane("t", 0, tbl(["Type", "Colour", "Default", "Template", ""], [["Task", tok("gray"), "Yes", "—", more], ["Bug", tok("red"), "", "Checklist: steps to reproduce, expected, actual", more], ["Feature", tok("green"), "", "Acceptance criteria block", more], ["Chore", tok("gray"), "", "—", more]])) +
      pane("l", 0, tbl(["Label", "Colour", "Parent", ">Tasks", ""], [["Frontend", tok("blue"), "—", "42", more], ["Billing", tok("purple"), "—", "17", more], ["Bug", tok("red"), "—", "31", more], ["Tech debt", tok("yellow"), "—", "12", more]])) + "</div>" +
      dm(["TaskStatus · category, team_id, project_type_id, allowed_transitions, is_default, archived_at", "TaskType · template, is_default · TaskLabel · parent_label_id", "Team · task_key (the key prefix per team, e.g. WEB)"], []) + "</div>";
  }

  const MAP = { mine, board, backlog, detail, cycles, releases, workload, reports, settings };
  const CRUMB = { detail: "WEB-142" };
  window.VIEWS.tasks = { html: function (s) { return (MAP[s || "mine"] || MAP.mine)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
