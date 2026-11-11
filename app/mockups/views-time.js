/* =====================================================================================================================
   TIME APP — module 18 (docs/features/18-time-tracking.md). Projects plan hours, Time Tracking records hours, Finance bills hours.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: TimeTrackingSettings, TimeActivityType, TimeProjectSettings, BillingRate, TimeEntry, Timer, TimeImportJob, TimeSuggestion, TimeEntryAdjustment, Timesheet, TimesheetAction,
   TimeUtilizationPeriod. Enums are real values: TimeEntryStatus (DRAFT, SUBMITTED, APPROVED, REJECTED, INVOICED, LOCKED), TimeEntrySource (MANUAL, TIMER, CALENDAR, IMPORTED, GENERATED),
   TimeNonBillableCategory (INTERNAL, PRE_SALES, WARRANTY, OVERHEAD, LEAVE, TRAINING, ADMIN), TimesheetStatus (OPEN, SUBMITTED, APPROVED, REJECTED, LOCKED), TimesheetPeriodType (WEEKLY, BIWEEKLY, SEMI_MONTHLY, MONTHLY,
   CUSTOM), TimesheetApproverPolicy (PROJECT_OWNER, TEAM_LEAD, MANAGER, SPECIFIC_MEMBER), TimesheetActionType (SUBMITTED, APPROVED, REJECTED, REOPENED, LOCKED, UNLOCKED), TimeRateKind (BILLING, COST), BillingRateScope
   (ORGANIZATION, PRODUCT, PROJECT, MEMBER, PROJECT_MEMBER), TimeSuggestionSource (CALENDAR, COMMIT, TASK_ACTIVITY, ATTENDANCE, AI), TimeSuggestionStatus (PENDING, ACCEPTED, DISMISSED, EXPIRED), TimeAdjustmentType
   (WRITE_OFF, WRITE_UP, WRITE_DOWN), TimeRoundingMode (NONE, NEAREST, UP, DOWN), TimeImportStatus (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED).
   Permission keys: time.entries.create_own / read_own / update_own / delete_own / read_team / create_team / update_team / read_all / approve / export* / unlock*, time.timesheets.submit_own / approve, time.rates.read* / manage*, time.reports.read, time.imports.manage*, time.settings.manage; adjustments reuse finance.adjustments.manage* (08).
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - TimeEntry.duration_minutes is the truth; start_at / end_at are optional. billable_minutes <= duration_minutes. Hours are shown as h:mm everywhere, decimals only in reports and exports.
     - Billability resolves in this order: TimeEntry override (billable_overridden + billable_override_reason) > TimeProjectSettings.default_billable > TimeActivityType.default_billable > Contract.default_time_billable >
       ProjectType.default_time_billable > TimeTrackingSettings.default_billable. When not billable, non_billable_category says why.
     - RATE SNAPSHOTS: billing_rate_id/amount/currency and cost_rate_id/amount/currency are copied onto the entry at APPROVAL (rates_snapshotted_at). Later rate changes never alter history. Before approval the UI shows a preview
       computed from the BillingRate resolution (PROJECT_MEMBER > PROJECT > MEMBER > PRODUCT > ORGANIZATION, effective_from/effective_to). COST rates come from 10 (EmployeeCompensation.cost_rate_hourly) and are a SENSITIVE field:
       they need time.rates.read* and are removed from the payload (not just hidden) for everyone else.
     - STATUS flow: DRAFT -> SUBMITTED (timesheet submit) -> APPROVED | REJECTED (with rejection_reason) -> INVOICED (08 marks it, invoice_id + invoice_line_item_id) ; is_locked / LOCKED after approval when
       TimeTrackingSettings.lock_on_approval, and every entry dated before TimeTrackingSettings.locked_before_date (month-end close) is read-only for everyone. Unlock needs time.entries.unlock* and a reason (unlock_reason), always audited. INVOICED entries cannot be edited or unlocked; corrections are TimeEntryAdjustment rows (08).
     - Time Tracking NEVER creates invoices or ledger records. 08 pulls approved, uninvoiced, billable entries; 18 only exposes the list and the "mark invoiced" call.
     - Scope: read_own = my entries, read_team = members of the teams I lead, read_all = whole organization (and branch scope of 01 applies on top). Lists are filtered server-side.
     - The signed-in member in this mockup is Marco Silva (MS). Today is Wed Nov 11, 2026; the current week is Mon Nov 9 - Sun Nov 15 (TimeTrackingSettings.week_start = 1).
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, head, btn, cd, sw, cb, sel, fld, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + Math.min(p, 100) + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"] };
  const av = (a) => AV(a, PEOPLE[a][1]);
  const wh = (a, s) => who(a, PEOPLE[a][1], PEOPLE[a][0], s || "");
  const nm = (a) => PEOPLE[a][0];
  const box = (t) => '<div class="inp">' + t + "</div>";
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const row2 = (a, b) => '<div class="g2">' + a + b + "</div>";
  const sp = '<div class="tm-sp"></div>';
  const stLabel = (s) => ({ DRAFT: "Draft", SUBMITTED: "Submitted", APPROVED: "Approved", REJECTED: "Rejected", INVOICED: "Invoiced", LOCKED: "Locked", OPEN: "Open" }[s] || s);
  const ST = { DRAFT: "", SUBMITTED: "blue", APPROVED: "green", REJECTED: "red", INVOICED: "purple", LOCKED: "yellow", OPEN: "" };
  const eb = (s) => '<span class="badge ' + (ST[s] || "") + '" title="' + s + '">' + stLabel(s) + "</span>";
  const bill = (b, cat) => b ? '<span class="badge green" title="TimeEntry.is_billable">Billable</span>' : '<span class="badge" title="TimeEntry.non_billable_category ' + cat + '">' + U.en(cat) + "</span>";
  const hm = (m) => Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  const dec = (m) => (m / 60).toFixed(1);
  const eur = (n) => "€" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const eur2 = (n) => "€" + n.toFixed(2);
  const chip = (a, o, v) => window.UI.filters ? window.UI.filters.chip(a, o, v) : "";
  const fbar = (chips, extra) => window.UI.filters.filterBar(chips, extra);
  const hb = (l, vals, max, right, mark) => '<div class="tm-hb"><span class="l" title="' + l + '">' + l + '</span><span class="tr">' + vals.map((v) => '<i class="' + (v[1] || "") + '" style="width:' + (v[0] / max * 100) + '%"></i>').join("") + (mark ? '<span class="mark" style="left:' + (mark / max * 100) + '%"></span>' : "") + '</span><span class="v">' + right + "</span></div>";

  const PRJ = { ACME: ["Acme Rebrand Website", "Acme Corp"], MOB: ["Mobile App v2", "Northwind"], STR: ["Stripe Billing Migration", "Globex"], POR: ["Customer Portal Build", "Initech"], BRA: ["Brand Strategy Sprint", "Acme Corp"], INT: ["Internal (no project)", "-"] };
  /* TimeEntry samples: id, date, member, project, task, activity, description, minutes, is_billable, non_billable_category, status, source, billable amount (EUR) */
  const EN = [
    ["f3a9c1", "Wed Nov 11", "MS", "ACME", "WEB-142 Pricing hero", "Development", "Plan cards component, responsive pass", 150, 1, "", "DRAFT", "TIMER", 187.5],
    ["b71e02", "Wed Nov 11", "MS", "STR", "WEB-139 Webhook retries", "Review", "Code review of retry backoff", 60, 1, "", "DRAFT", "MANUAL", 75],
    ["c20d47", "Tue Nov 10", "MS", "ACME", "WEB-142 Pricing hero", "Development", "Hero layout and headline scale", 180, 1, "", "DRAFT", "TIMER", 225],
    ["9ad3e8", "Tue Nov 10", "MS", "INT", "-", "Meeting", "Weekly team sync", 45, 0, "OVERHEAD", "DRAFT", "CALENDAR", 0],
    ["e1507b", "Mon Nov 9", "MS", "MOB", "MOB-87 Offline mode", "Development", "Sync queue persistence", 240, 1, "", "DRAFT", "MANUAL", 300],
    ["4a8c19", "Mon Nov 9", "MS", "POR", "WEB-151 Approval flow", "Design", "Approval state screens", 90, 1, "", "DRAFT", "MANUAL", 112.5],
    ["d9e340", "Fri Nov 6", "AM", "STR", "WEB-148 VAT validation", "Development", "VIES lookup client", 300, 1, "", "SUBMITTED", "MANUAL", 375],
    ["77b0a2", "Thu Nov 5", "SJ", "MOB", "MOB-92 Push copy", "Design", "Permission prompt variants", 195, 1, "", "APPROVED", "TIMER", 243.75],
    ["2c4f61", "Thu Nov 5", "JK", "BRA", "DES-33 Illustrations", "Design", "Onboarding illustrations", 270, 0, "PRE_SALES", "APPROVED", "MANUAL", 0],
    ["a063d5", "Wed Nov 4", "KL", "POR", "WEB-151 Approval flow", "Development", "Approval API endpoints", 360, 1, "", "INVOICED", "TIMER", 450],
    ["18e7bc", "Tue Nov 3", "AM", "INT", "-", "Admin", "Quarterly planning prep", 120, 0, "ADMIN", "LOCKED", "MANUAL", 0],
    ["5f2a90", "Mon Nov 2", "MS", "ACME", "WEB-131 Case study template", "Review", "Template QA (rejected: missing task link)", 75, 1, "", "REJECTED", "MANUAL", 93.75],
  ];
  const ACT = ["Development", "Design", "Meeting", "Support", "Admin", "Review", "Project management"];
  const entryRow = (r, withWho, checked) => [cb(checked), r[1]].concat(withWho ? [wh(r[2])] : []).concat([PRJ[r[3]][0] + (PRJ[r[3]][1] !== "-" ? '<small class="tm-sub">' + PRJ[r[3]][1] + "</small>" : ""), r[4], r[5], bill(r[8], r[9]), eb(r[10]), '<span title="TimeEntrySource ' + r[11] + '">' + U.en(r[11]) + "</span>", hm(r[7]), r[8] ? eur2(r[12]) : muted("-")]);
  const entryCols = (withWho) => [""].concat(["Date"]).concat(withWho ? ["Member"] : []).concat(["Project", "Task", "Activity", "Billable", "Status", "Source", ">Time", ">Amount"]);
  const rowBtn = (t, ic) => '<button class="btn ghost sm icon" title="' + t + '">' + I(ic, 14) + "</button>";

  /* =====================================================================================================================
     TIMER (spec §2, §4)
     @route  /time/timer?task=&project=  (the same widget lives in the app bar of every app as the running-timer pill)
     @perm   VIEW time.entries.read_own · start/stop/save time.entries.create_own
     @api    GET /time/timers/current · POST /time/timers {project_id?, workstream_id?, milestone_id?, task_id?, ticket_id?, activity_type_id?, description?, is_billable?, device} · POST /time/timers/:id/pause|resume ·
             POST /time/timers/:id/stop {description, is_billable, adjust_minutes?} -> creates a TimeEntry (source TIMER, timer_id) · POST /time/timers/:id/discard · POST /time/timers/:id/heartbeat
     @mcp    time_timers_start · time_timers_stop · time_timers_read
     @data   Timer (started_at, paused_at, paused_minutes, last_heartbeat_at, idle_detected_at, idle_discarded_minutes, stopped_at, discarded_at, auto_stopped, device, project_id, workstream_id, milestone_id, task_id, ticket_id,
             activity_type_id, description, is_billable) · TimeEntry (timer_id) · TimeTrackingSettings (idle_timeout_minutes, timer_auto_stop_hours, require_project, require_task_or_ticket, require_description, require_activity_type)
     @ui     Card, Popover+Command pickers (task/project/activity, searchable, recent first), Switch (billable), Textarea, Button (Pause/Stop/Discard), AlertDialog for discard, toast on stop with "Edit entry"
     @states loading · no running timer (idle form) · running · paused · idle-detected prompt · auto-stopped notice · error (stop failed: timer kept, nothing lost) · no-access
     @audit  timer started/stopped/discarded; the resulting TimeEntry writes time.entry_created
     @note   At most ONE running timer per member (enforced by the service: stopped_at IS NULL and discarded_at IS NULL). Starting another asks to stop the current one. Elapsed = now - started_at - paused_minutes - idle_discarded_minutes.
             The client sends a heartbeat (last_heartbeat_at) every minute; the server marks the timer idle after idle_timeout_minutes without one and asks what to do with the idle gap. A timer left running longer than
             timer_auto_stop_hours is stopped by a scheduled job (auto_stopped = true) and the member is notified (14). Switching task keeps one timer: it stops the current one and starts a new one in one request.
     ===================================================================================================================== */
  function timer() {
    const rec = [["WEB-142 Pricing hero", "Acme Rebrand Website", "Development", "Billable"], ["MOB-87 Offline mode", "Mobile App v2", "Development", "Billable"], ["WEB-139 Webhook retries", "Stripe Billing Migration", "Review", "Billable"], ["Team sync", "Internal", "Meeting", "Overhead"], ["WEB-151 Approval flow", "Customer Portal Build", "Design", "Billable"]];
    return '<div class="a-page">' + head("Timer", "One running timer per person. Stop it to turn it into a time entry.", '<span class="tm-pill">' + I("clock", 13) + " 01:24:37 · WEB-142 <span class=\"stop\">" + I("x", 12) + "</span></span>" + btn("Add entry", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Today", "4:30", "of 8:00 expected") + stat("This week", "13:15", "of 40:00 expected") + stat("Billable today", "3:30", "78% billable ratio") + stat("Unsubmitted", "13:15", "week not submitted", 1) + stat("Pending suggestions", 4, "TimeSuggestion PENDING") + "</div>" +
      '<div class="tm-hero"><div>' +
      cd("<b>Running</b><span class='r'><span class='tm-live'><i></i>Running</span></span>",
        '<div class="tm-clock">01:24:37<small>started 09:02 · Timer.started_at</small></div><div class="sub-note" style="margin:6px 0 14px">Paused 0 min · idle discarded 0 min · device Web · last heartbeat 12 s ago</div>' +
        '<div class="tm-pick">' + f("Project", sel("Acme Rebrand Website", "folder")) + f("Task", sel("WEB-142 Rebuild pricing page hero", "tasks")) + f("Activity type", sel("Development")) + f("Workstream / milestone", sel("Website build / Launch", "flag")) + "</div>" +
        f("Description", '<div class="input-fake" style="color:var(--ink)">Plan cards component, responsive pass</div>') +
        '<div class="rowx" style="padding:0 0 12px"><div class="grow"><b>Billable</b><small>Resolved from project settings. Turning it off asks for a reason (non_billable_category).</small></div>' + sw(1) + "</div>" +
        '<div class="rowx" style="padding:0;gap:8px">' + btn("Stop and save", "check", "primary") + btn("Pause", "clock") + btn("Discard", "x") + '<span style="flex:1"></span><span class="muted">Ctrl+Shift+T to toggle</span></div>') +
      sp + callout("clock", "<b>Idle detected 11:40.</b> No activity for 15 minutes (idle_timeout_minutes). Keep the 15 minutes, or discard them from the timer (idle_discarded_minutes). <span style=\"display:inline-flex;gap:6px;margin-left:8px\">" + btn("Keep", "", "sm") + btn("Discard 15 min", "", "sm") + "</span>", "warn") +
      sp + callout("sparkles", "<b>If no timer runs</b> this card becomes the start form: pick a task or project, optional description, then Start. Required fields follow TimeTrackingSettings (require_project, require_task_or_ticket, require_description, require_activity_type).") +
      "</div><div>" +
      cd("<b>Start from recent</b><span class='r muted'>last 14 days</span>", rec.map((r) => '<div class="tm-recent"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + " · " + r[2] + " · " + r[3] + "</small></div>" + btn("", "time", "sm icon") + "</div>").join(""), 1) + sp +
      cd("<b>Today</b><span class='r muted'>TimeEntry · Wed Nov 11</span>", EN.slice(0, 2).map((r) => '<div class="tm-ev"><span class="t">' + r[5] + "</span><div class=\"grow\"><b>" + r[4] + "</b><small>" + r[6] + "</small></div>" + eb(r[10]) + '<span class="dur">' + hm(r[7]) + "</span></div>").join("") + '<div class="tm-ev"><span class="t">Running</span><div class="grow"><b>WEB-142 Pricing hero</b><small>Timer, not yet an entry</small></div><span class="badge green">Live</span><span class="dur">1:24</span></div>', 1) +
      "</div></div>" + sp +
      cd("<b>Running timer in the app bar</b><span class='r muted'>shown in every app while a timer is running</span>", '<div class="rowx"><span class="tm-pill">' + I("clock", 13) + ' 01:24:37 · WEB-142 <span class="stop">' + I("x", 12) + '</span></span><div class="grow"><small>Click opens a popover with Pause, Stop, change task. Tasks (06) show the same pill on the task being timed. The pill is hidden without time.entries.create_own.</small></div></div>', 1) +
      dm(["Timer · started_at, paused_at, paused_minutes, last_heartbeat_at, idle_detected_at, idle_discarded_minutes, stopped_at, discarded_at, auto_stopped, device, project_id, workstream_id, milestone_id, task_id, ticket_id, activity_type_id, description, is_billable", "TimeEntry · timer_id, source TIMER", "TimeTrackingSettings · idle_timeout_minutes, timer_auto_stop_hours, require_*", "Read-only: Task (06), Project/ProjectWorkstream/ProjectMilestone (05)"], []) + "</div>";
  }

  /* =====================================================================================================================
     MY TIMESHEET — weekly grid (spec §4 bulk entry, §5)
     @route  /time/week?start=2026-11-09 · /time/week/:timesheetId
     @perm   VIEW time.entries.read_own · edit cells time.entries.update_own / create_own · submit time.timesheets.submit_own
     @api    GET /time/timesheets/current?period_start= · PUT /time/entries/bulk {rows:[{project_id, task_id, activity_type_id, is_billable, days:{date:minutes}}]} · POST /time/timesheets/:id/submit {comment}
     @mcp    time_timesheets_read · time_entries_create · time_timesheets_submit
     @data   Timesheet (period_type, period_start, period_end, status, total_minutes, billable_minutes, non_billable_minutes, expected_minutes, billable_amount, currency, submission_comment) · TimeEntry (date, duration_minutes, project_id, task_id,
             activity_type_id, is_billable, status, is_locked, timesheet_id) · TimeTrackingSettings (period_type, week_start, max_hours_per_day, allow_future_entries, default_expected_hours_per_week)
     @ui     Table with inline numeric inputs (parse 1.5, 1:30, 90m), Popover+Command row pickers, Badge, AlertDialog on submit with a comment Textarea, week switcher (Button group + DatePicker)
     @states loading skeleton · empty week ("Nothing logged" + copy last week) · saving cell · validation (over max_hours_per_day, future day) · locked cells (approved/invoiced) · error · no-access
     @audit  entries created/edited per cell; submit writes a TimesheetAction SUBMITTED and audit event
     @note   One grid row = project + task + activity + billable flag. Each non-empty cell is ONE TimeEntry (day, minutes); several timer entries on the same day are shown as a summed read-only cell with a link to the daily list. Cells of APPROVED/
             INVOICED/LOCKED entries are read-only (yellow). The Timesheet row is created lazily when the first entry of the period is logged or on submit; totals are recomputed by the service. Submit is blocked when a day exceeds
             max_hours_per_day or when required fields are empty. Expected hours per day come from 10 working hours, leave and holidays (01 s121-122); leave days are read-only grey (TimeNonBillableCategory LEAVE).
     ===================================================================================================================== */
  function week() {
    const days = ["Mon 9", "Tue 10", "Wed 11", "Thu 12", "Fri 13", "Sat 14", "Sun 15"];
    const rows = [
      ["Acme Rebrand Website", "WEB-142 Pricing hero", "Development", 1, [0, 180, 150, 0, 0, 0, 0], ""],
      ["Mobile App v2", "MOB-87 Offline mode", "Development", 1, [240, 0, 0, 0, 0, 0, 0], ""],
      ["Customer Portal Build", "WEB-151 Approval flow", "Design", 1, [90, 0, 0, 0, 0, 0, 0], ""],
      ["Stripe Billing Migration", "WEB-139 Webhook retries", "Review", 1, [0, 0, 60, 0, 0, 0, 0], ""],
      ["Internal", "Weekly team sync", "Meeting", 0, [0, 45, 0, 0, 0, 0, 0], "OVERHEAD"],
      ["Internal", "Design systems workshop", "Meeting", 0, [0, 0, 0, 0, 0, 0, 0], "TRAINING"],
    ];
    const colTot = days.map((d, i) => rows.reduce((s, r) => s + r[4][i], 0));
    const tot = colTot.reduce((a, b) => a + b, 0);
    const cell = (m, i, r) => m ? '<span class="tm-cell' + (i === 2 && r[0] === "Acme Rebrand Website" ? " edit" : "") + '">' + hm(m) + "</span>" : '<span class="tm-cell empty">' + (i > 4 ? "" : "0:00") + "</span>";
    return '<div class="a-page">' + head("My timesheet", "Week of Nov 9 – Nov 15, 2026 · Timesheet <span class=\"badge\" title=\"TimesheetStatus OPEN\">Open</span>", btn("Copy last week", "layers") + btn("Add entry", "plus") + btn("Submit week", "send", "primary")) +
      '<div class="toolbar">' + btn("", "").replace("</button>", I("left", 14) + "</button>").replace('class="btn "', 'class="btn sm icon"') + btn("", "").replace("</button>", I("right", 14) + "</button>").replace('class="btn "', 'class="btn sm icon"') + sel("Nov 9 – Nov 15, 2026", "calendar") + btn("This week", "", "sm") + sel("Weekly", "calendar") + sel("Grid", "grid") + '<span style="flex:1"></span>' + search("Add row: project or task") + "</div>" +
      '<div class="mini-stats">' + stat("Logged", hm(tot), "of 40:00 expected") + stat("Billable", hm(rows.filter((r) => r[3]).reduce((s, r) => s + r[4].reduce((a, b) => a + b, 0), 0)), "ratio " + Math.round(rows.filter((r) => r[3]).reduce((s, r) => s + r[4].reduce((a, b) => a + b, 0), 0) / tot * 100) + "%") + stat("Billable amount", eur2(900), "preview, snapshot at approval") + stat("Missing", "26:45", "until Fri if no more is logged", 1) + stat("Approver", "Anna Meyer", "TEAM_LEAD policy") + "</div>" +
      '<div class="panel" style="margin-top:0"><table class="tm-grid"><thead><tr><th>Project / task · activity</th>' + days.map((d, i) => "<th" + (i === 2 ? ' class="today"' : "") + ">" + d + "</th>").join("") + "<th>Total</th><th></th></tr></thead><tbody>" +
      rows.map((r) => "<tr><td><b class=\"ink\">" + r[1] + '</b><span class="tm-sub">' + r[0] + " · " + r[2] + " · " + (r[3] ? "Billable" : "Non-billable " + U.en(r[5])) + "</span></td>" + r[4].map((m, i) => "<td>" + cell(m, i, r) + "</td>").join("") + '<td class="tot">' + hm(r[4].reduce((a, b) => a + b, 0)) + "</td><td>" + more + "</td></tr>").join("") +
      '<tr><td><button class="btn ghost sm">' + I("plus", 13) + ' Add row</button></td>' + days.map(() => "<td></td>").join("") + "<td></td><td></td></tr></tbody>" +
      "<tfoot><tr><td>Total · expected 8:00 per workday</td>" + colTot.map((m) => "<td>" + (m ? hm(m) : "-") + "</td>").join("") + "<td>" + hm(tot) + "</td><td></td></tr></tfoot></table></div>" + sp +
      '<div class="g2">' + cd("<b>Rules applied to this week</b>", kv("Max hours per day", "12:00 " + muted("max_hours_per_day")) + kv("Future entries", "Allowed " + muted("allow_future_entries")) + kv("Overlapping entries", "Not allowed " + muted("allow_overlapping_entries")) + kv("Edit window", "30 days " + muted("edit_window_days")) + kv("Rounding", "Nearest 15 min " + muted("rounding_increment_minutes, NEAREST"))) +
      cd("<b>Submit week</b>", '<div class="sub-note" style="margin-bottom:8px">Submitting sends the timesheet to the approver and locks the cells for editing until it is approved or rejected.</div>' + f("Comment for the approver", '<div class="input-fake">Optional, e.g. travel day Thursday</div>') + '<div class="rowx" style="padding:0">' + btn("Submit week", "send", "primary") + '<span class="muted">Needs time.timesheets.submit_own</span></div>') + "</div>" +
      dm(["Timesheet · period_type, period_start, period_end, status, total_minutes, billable_minutes, non_billable_minutes, expected_minutes, billable_amount, submission_comment", "TimeEntry · date, duration_minutes, billable_minutes, project_id, task_id, activity_type_id, is_billable, non_billable_category, status, is_locked", "TimeTrackingSettings · week_start, max_hours_per_day, allow_future_entries, allow_overlapping_entries, edit_window_days, rounding_*", "Read-only: expected hours and leave (10, 01 s121-122)"], []) + "</div>";
  }

  /* =====================================================================================================================
     MY TIMESHEET — daily list (spec §4)
     @route  /time/day?date=2026-11-11 · ?range=week
     @perm   VIEW time.entries.read_own · edit time.entries.update_own · delete a DRAFT entry time.entries.delete_own
     @api    GET /time/entries?mine=1&from=&to= · PATCH /time/entries/:id · DELETE /time/entries/:id
     @mcp    time_entries_read · time_entries_update
     @data   TimeEntry (date, start_at, end_at, duration_minutes, project_id, task_id, activity_type_id, description, is_billable, status, source, calendar_event_id, attendance_record_id) · Timer (running) · TimeSuggestion (PENDING, inline cards) ·
             TimeTrackingSettings (attendance_prefill_enabled) · AttendanceRecord (10, read-only pre-fill hint)
     @ui     Day-grouped list, DropdownMenu row actions, inline quick-add Input row (task Combobox + duration + Enter), Badge, Sheet for quick edit
     @states loading · empty day ("Nothing logged. Add time or accept a suggestion") · error · no-access · locked row (lock icon, edit disabled with the reason)
     @audit  every edit writes audit_events (before/after) on a TimeEntry; deleting is a soft delete (deleted_at)
     @note   Pre-fill from attendance (10) shows as a dashed hint "Attendance 08:58-17:31 (8:33 on site), 4:30 logged", it never creates entries. Entries with start_at/end_at show their clock range; duration-only entries show "-".
     ===================================================================================================================== */
  function day() {
    const groups = [["Wed Nov 11", "Today · 4:30", EN.slice(0, 2), 1], ["Tue Nov 10", "3:45", EN.slice(2, 4)], ["Mon Nov 9", "5:30", EN.slice(4, 6)]];
    return '<div class="a-page">' + head("My time", "Daily list of everything you logged.", btn("Export", "file") + btn("Add entry", "plus", "primary")) +
      '<div class="toolbar">' + search("Search description, task, project") + sel("Daily list", "list") + sel("Nov 9 – Nov 15", "calendar") + sel("Status: Any") + sel("Billable: Any") + "</div>" +
      fbar([["Date", "is in", "This week"], ["Member", "is", "Me"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="rowx" style="border:1px dashed var(--hairline-strong);border-radius:var(--r-md);margin-bottom:10px">' + I("clock", 14) + '<div class="grow"><b>Attendance 08:58 – 17:31 (8:33 on site)</b><small>4:30 logged today · pre-fill from attendance is a hint only (attendance_prefill_enabled)</small></div>' + btn("Fill gap", "plus", "sm") + "</div>" +
      '<div class="panel" style="margin-top:0">' + '<div class="rowx"><div class="grow"><div class="input-fake">Quick add: type a task or project, a duration (1h30, 1:30, 90m) and press Enter</div></div>' + btn("Add", "plus", "primary") + "</div>" +
      groups.map((g) => '<div class="tm-day' + (g[3] ? " today" : "") + '"><div class="d"><b>' + g[0] + "</b>" + g[1] + "</div><div>" + g[2].map((r) => '<div class="tm-ev"><span class="t">' + (r[11] === "TIMER" ? "09:02 – 11:32" : r[11] === "CALENDAR" ? "10:00 – 10:45" : "-") + '</span><div class="grow"><b>' + r[4] + " · " + r[5] + "</b><small>" + PRJ[r[3]][0] + " · " + r[6] + " · " + U.en(r[11]) + "</small></div>" + bill(r[8], r[9]) + eb(r[10]) + '<span class="dur">' + hm(r[7]) + "</span>" + more + "</div>").join("") + "</div></div>").join("") + "</div>" +
      '<div class="tm-sp"></div>' + callout("lock", "<b>Locked rows.</b> Entries of approved or invoiced periods show a lock and cannot be edited. Unlock needs time.entries.unlock* and a reason; INVOICED entries are corrected by an adjustment in 08.", "warn") +
      dm(["TimeEntry · date, start_at, end_at, duration_minutes, project_id, task_id, activity_type_id, description, is_billable, non_billable_category, status, source, calendar_event_id, deleted_at", "Timer · running timer row", "TimeSuggestion · PENDING", "Read-only: AttendanceRecord (10)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ALL TIME ENTRIES — table with filters, saved views, bulk actions (spec §3, §10, §13)
     @route  /time/entries?scope=mine|team|all&view=<savedViewId>&filter=<json>&sort=&group=&q=
     @perm   VIEW time.entries.read_own (scope mine) · read_team · read_all · bulk submit/approve time.entries.approve · bulk delete of own drafts time.entries.delete_own · amounts need time.rates.read* · export time.entries.export*
     @api    GET /time/entries?filter=&sort=&group=&q=&cursor= · POST /time/entries/bulk {entry_ids|filter, action: set_billable|set_activity|move_project|delete|submit|approve} · GET/POST/PATCH /saved-views?entity_type=TIME_ENTRY
     @mcp    time_entries_read (same filter JSON) · time_entries_update
     @data   TimeEntry (all columns selectable) · SavedView (entity_type TIME_ENTRY, layout, visibility, team_id, filters, sorting, grouping, columns, search, is_default) · Project (company_id for the customer filter) · TimeActivityType
     @ui     Table with column chooser, filter bar (Popover+Command value pickers), checkboxes with sticky bulk bar, DropdownMenu row actions, "Save view" Dialog, ToggleGroup scope switch
     @states loading skeleton · empty ("No entries match" + clear filters) · error · no-access · amount column absent without time.rates.read*
     @audit  bulk actions write one audit event per entry plus a summary event with the filter used
     @note   Scope follows the caller: Mine / Team / All are the three read keys. "Select all" selects by FILTER, the bulk bar states how many entries it will touch. Bulk set-billable asks for the reason; moving an entry to another project
             is refused for APPROVED / INVOICED / LOCKED entries. Amount = billable_amount (snapshot) when approved, else a preview. Cursor pagination, search over description and task title.
     ===================================================================================================================== */
  function entries() {
    return '<div class="a-page">' + head("All time entries", "Every entry you can see, with filters and saved views.", btn("Export", "file") + btn("Add entry", "plus", "primary")) +
      '<div class="toolbar">' + search("Search description, task, project") + sel("Table", "grid") + sel("Scope: Team", "users") + sel("Group: None") + sel("Sort: Date ↓", "sort") + sel("Columns (10)", "settings") + sel("Views: Unsubmitted this month", "star") + "</div>" +
      fbar([["Date", "is in", "Nov 1 – Nov 15"], ["Status", "is any of", "Draft, Submitted"], ["Billable", "is", "any"], ["Project", "is", "Any"], ["Customer", "is", "Any"], ["Activity type", "is", "Any"], ["Source", "is", "Any"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>3 selected</b><span class="muted">bulk bar appears when rows are selected</span><span style="flex:1"></span>' + sel("Billable…", "dollar") + sel("Activity…") + sel("Move to project…", "folder") + btn("Submit", "send", "sm") + btn("Approve", "check", "sm") + btn("Delete", "x", "sm") + "</div>" +
      tbl(entryCols(1), EN.map((r, i) => entryRow(r, 1, i < 3))) +
      '<div class="pager"><span class="muted">1–12 of 412 · 74:30 shown</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      '<div class="sub-note">Other filters in the Add filter menu: Member, Team, Branch, Task, Workstream, Milestone, Ticket, Non-billable category, Invoiced (yes/no), Locked, Duration, Created by, Has description.</div>' +
      dm(["TimeEntry · every column is selectable and sortable", "SavedView · entity_type TIME_ENTRY, layout, visibility, team_id, filters, sorting, grouping, columns, search, is_default", "Project · company_id (customer) · TimeActivityType"], []) + "</div>";
  }

  /* =====================================================================================================================
     ADD / EDIT ENTRY — full page (spec §3, §6)
     @route  /time/entries/new?date=&task=&project=&from=suggestion:<id> · /time/entries/:id/edit
     @perm   time.entries.create_own (for others in your team or project: time.entries.create_team) · edit time.entries.update_own (others: time.entries.update_team) · billable override reason follows TimeTrackingSettings.require_billable_override_reason · rate preview needs time.rates.read*
     @api    POST /time/entries {date, start_at?, end_at?, duration_minutes, project_id?, workstream_id?, milestone_id?, task_id?, ticket_id?, activity_type_id?, description?, is_billable?, billable_override_reason?,
             non_billable_category?, external_ref?} · PATCH /time/entries/:id
     @mcp    time_entries_create · time_entries_update
     @data   TimeEntry · TimeActivityType (default_billable, default_non_billable_category) · TimeProjectSettings (time_tracking_enabled, members_only, require_task, default_*) · TimeTrackingSettings (require_*, min_entry_minutes, max_hours_per_day,
             allow_overlapping_entries, allow_future_entries, rounding_*) · BillingRate (preview only)
     @ui     Form with sections, Popover+Command (project, task, workstream, milestone, ticket, activity), DatePicker, TimePicker for start/end, Input with duration parser, Switch + Select (non-billable category), Textarea, "Create more" Switch
     @states validation inline (min_entry_minutes, max_hours_per_day, overlap, future date, project requires task) · saving · saved toast with Undo · locked entry (form read-only with the lock reason) · permission error per field · draft kept
     @audit  entry created/updated (before/after), billable override with reason
     @note   Duration and start/end are linked: enter start+end and the duration is computed, enter duration only and the times stay empty. Rounding (increment + mode) is applied to the saved duration and the original is kept in the audit event.
             Project is optional (internal time: admin, training, leave) unless require_project. Picking a task fills project, workstream and milestone. Projects with time_tracking_enabled = false or members_only (you are not a member) are not listed.
             Billable defaults follow the resolution order in the module header; changing it sets billable_overridden = true. The rate shown is a PREVIEW; the snapshot is taken at approval.
     ===================================================================================================================== */
  function create() {
    return '<div class="a-page">' + head("Add time entry", "Log work you did. Rates are previewed here and snapshotted when the entry is approved.", btn("Cancel") + btn("Save as draft", "") + btn("Save entry", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>What did you work on</b>", row2(f("Project", sel("Acme Rebrand Website", "folder"), "Optional for internal time. Required when TimeTrackingSettings.require_project is on."), f("Task", sel("WEB-142 Rebuild pricing page hero", "tasks"), "Required when the project has require_task. Fills project, workstream and milestone.")) +
        row2(f("Workstream", sel("Website build")), f("Milestone", sel("Launch · Nov 28", "flag"))) +
        row2(f("Ticket", sel("None (13 Support)", "support"), "TimeEntry.ticket_id, optional"), f("Activity type", sel("Development"), "TimeActivityType, configurable in Setup")) +
        f("Description", '<div class="editor"><div class="ed-bar">' + ["B", "I", "•", "Link"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body" style="color:var(--ink)">Plan cards component, responsive pass at 360 px.</div></div>', "Required when require_description is on. Shown on invoices when the invoice line uses entry descriptions.")) + sp +
      cd("<b>When and how long</b>", row2(f("Date", sel("Wed Nov 11, 2026", "calendar"), "Future dates only when allow_future_entries"), f("Duration", box("2:30"), "Accepts 2.5, 2:30, 2h30, 150m. Minimum min_entry_minutes.")) +
        row2(f("Start time", sel("09:00", "clock")), f("End time", sel("11:30", "clock"))) +
        '<div class="sub-note">Start + end compute the duration. Rounded to the nearest 15 min (rounding_mode NEAREST). Day total after saving: 7:00 of 12:00 max.</div>') + sp +
      cd("<b>Billing</b>", '<div class="rowx" style="padding:0 0 12px"><div class="grow"><b>Billable</b><small>Default from project settings: billable (TimeProjectSettings.default_billable). Changing it marks billable_overridden.</small></div>' + sw(1) + "</div>" +
        row2(f("Non-billable category", sel("Not applicable (billable)"), "INTERNAL, PRE_SALES, WARRANTY, OVERHEAD, LEAVE, TRAINING, ADMIN. Required when not billable."), f("Override reason", box("Only when overriding the default"), "Required when require_billable_override_reason is on.")) +
        row2(f("Billable minutes", box("150"), "billable_minutes can be lower than the duration (partly billable)"), f("External reference", box("e.g. JIRA-1204"), "TimeEntry.external_ref"))) +
      "</div><div>" +
      cd("<b>Rate preview</b><span class='r muted'>time.rates.read*</span>", kv("Billing rate", "€75.00 / h " + muted("PROJECT_MEMBER scope")) + kv("Rate card", "Acme Rebrand · Marco Silva") + kv("Effective", "Jan 1, 2026 – open") + kv("Billable amount", eur2(187.5)) + kv("Cost rate", "€38.00 / h " + muted("from 10 compensation")) + kv("Cost amount", eur2(95)) + kv("Margin", "49%") + '<div class="sub-note" style="margin-top:6px">Preview only. billing_rate_id/amount and cost_rate_id/amount are stored at approval (rates_snapshotted_at). Without time.rates.read* this card is hidden.</div>') + sp +
      cd("<b>Status</b>", kv("Status", eb("DRAFT")) + kv("Source", "Manual " + muted("TimeEntrySource MANUAL")) + kv("Timesheet", "Nov 9 – Nov 15 " + muted("Open")) + kv("Approver", "Anna Meyer") + '<div class="rowx" style="padding:10px 0 0"><div class="grow"><b>Create more</b><small>Keep date, project and activity for the next entry</small></div>' + sw(0) + "</div>") + sp +
      callout("lock", "<b>Locked or invoiced entries</b> open this form read-only with the reason (\"Approved by Anna Meyer Nov 8\", \"Invoiced on INV-2026-0142\"). Unlock needs time.entries.unlock* and a reason.", "warn") +
      "</div></div>" +
      dm(["TimeEntry · every column written on create", "TimeActivityType · default_billable, default_non_billable_category", "TimeProjectSettings · time_tracking_enabled, members_only, require_task, default_billable, default_activity_type_id", "TimeTrackingSettings · require_*, min_entry_minutes, max_hours_per_day, rounding_*, allow_*", "BillingRate (preview) · EmployeeCompensation.cost_rate_hourly (10, preview)"], []) + "</div>";
  }

  /* =====================================================================================================================
     TIME ENTRY DETAIL (spec §3, §5, §6, §7, §12)
     @route  /time/entries/:id
     @perm   VIEW time.entries.read_own / read_team / read_all · edit time.entries.update_own · approve time.entries.approve · unlock time.entries.unlock* · cost fields time.rates.read*
     @api    GET /time/entries/:id · POST /time/entries/:id/unlock {reason} · POST /time/entries/:id/approve|reject {reason}
     @mcp    time_entries_read · time_entries_approve
     @data   TimeEntry (all columns) · TimeEntryAdjustment (type, adjusted_billable_minutes, adjusted_amount, delta_amount, currency, reason, invoice_line_item_id) · Timer · TimeSuggestion · Timesheet · audit_events · crm_notes (entity TIME_ENTRY)
     @ui     Tabs (Details, Rates, Approval, History), Card, Badge, DropdownMenu, AlertDialog for unlock/delete with required reason
     @states loading · not found / no access (404) · locked · invoiced (read-only, adjustment link) · error
     @audit  edit, approve, reject, lock, unlock (reason), invoicing state change, rate snapshot
     @note   The RATES tab shows the snapshot (billing_rate_id, billing_rate_amount, billing_currency, billable_amount, cost_* only with time.rates.read*). INVOICED entries link to the invoice and line item in 08 and list TimeEntryAdjustment rows;
             the entry itself is never edited, adjustments record write-off / write-up / write-down deltas.
     ===================================================================================================================== */
  function entry() {
    return '<div class="a-page"><div class="a-head"><div><h1>WEB-142 Pricing hero · Development</h1><p>Entry #a063d5 · Marco Silva · Tue Nov 10, 2026 · 3:00 · ' + eb("APPROVED") + " " + '<span class="badge yellow">Locked</span></p></div><div class="acts">' + btn("Unlock", "lock") + btn("Duplicate", "layers") + btn("Edit", "edit", "primary") + "</div></div>" +
      '<div class="tabset">' + tabs([["d", "Details"], ["r", "Rates"], ["a", "Approval"], ["h", "History"]], "d") +
      pane("d", 1, '<div class="g2">' + cd("<b>Work</b>", kv("Member", wh("MS")) + kv("Date", "Tue Nov 10") + kv("Time", "09:02 – 12:02 " + muted("start_at / end_at")) + kv("Duration", "3:00 " + muted("180 min")) + kv("Billable minutes", "3:00") + kv("Project", "Acme Rebrand Website " + muted("(05)")) + kv("Workstream", "Website build") + kv("Milestone", "Launch · Nov 28") + kv("Task", "WEB-142 Rebuild pricing page hero " + muted("(06)")) + kv("Ticket", "-") + kv("Activity type", "Development") + kv("Description", "Hero layout and headline scale")) +
        cd("<b>Classification and source</b>", kv("Billable", '<span class="badge green">Billable</span>') + kv("Billable overridden", "No " + muted("billable_overridden")) + kv("Override reason", "-") + kv("Non-billable category", "-") + kv("Source", "Timer " + muted("TimeEntrySource TIMER")) + kv("Timer", "started 09:02, stopped 12:02, no idle") + kv("Calendar event", "-") + kv("Attendance record", "-") + kv("Import job", "-") + kv("External reference", "-") + kv("Branch", "Berlin") + kv("Created by", "Marco Silva · Nov 10 12:02")) + "</div>" +
        sp + cd("<b>Notes</b><span class='r muted'>crm_notes · entity TIME_ENTRY</span>", '<div class="rowx"><div class="grow muted">Add an internal note…</div>' + btn("Add", "plus", "sm") + "</div>", 1)) +
      pane("r", 0, '<div class="g2">' + cd("<b>Billing snapshot</b><span class='r muted'>time.rates.read*</span>", kv("Billing rate", "€75.00 / h " + muted("billing_rate_amount")) + kv("Rate card", "Acme Rebrand · Marco Silva " + muted("billing_rate_id, PROJECT_MEMBER")) + kv("Currency", "EUR") + kv("Billable amount", eur2(225)) + kv("Snapshotted", "Nov 11 08:14 " + muted("rates_snapshotted_at"))) + cd("<b>Cost snapshot</b><span class='r muted'>sensitive</span>", kv("Cost rate", "€38.00 / h " + muted("cost_rate_amount, from 10")) + kv("Cost amount", eur2(114)) + kv("Margin", eur2(111) + " (49%)") + '<div class="sub-note" style="margin-top:6px">Cost fields are removed from the response without time.rates.read*.</div>') + "</div>" +
        sp + cd("<b>Adjustments</b><span class='r muted'>TimeEntryAdjustment, applied in 08 at invoicing time</span>", '<div class="sub-note" style="padding:12px 16px">None. The entry is never edited after invoicing; a write-off / write-up / write-down is stored as a separate adjustment with reason and delta_amount.</div>', 1)) +
      pane("a", 0, cd("<b>Approval</b>", kv("Timesheet", "Nov 2 – Nov 8 " + eb("APPROVED") + " <a>open</a>") + kv("Submitted", "Nov 9 08:30") + kv("Approved by", "Anna Meyer · Nov 9 09:12") + kv("Locked", "Nov 9 09:12 " + muted("lock_on_approval")) + kv("Rejected", "-") + kv("Rejection reason", "-") + kv("Invoice", "Not invoiced " + muted("Ready for 08: approved, billable, uninvoiced")) + kv("Unlocked", "-"))) +
      pane("h", 0, cd("<b>History</b><span class='r muted'>audit_events + TimesheetAction</span>", '<div class="tl"><div class="ev"><b>Locked after approval</b><small>system · Nov 9 09:12</small></div><div class="ev"><b>Approved with rate snapshot €75.00 / h</b><small>Anna Meyer · Nov 9 09:12</small></div><div class="ev"><b>Submitted with the week</b><small>Marco Silva · Nov 9 08:30</small></div><div class="ev"><b>Created from timer</b><small>Marco Silva · Nov 10 12:02</small></div></div>')) + "</div>" +
      dm(["TimeEntry · all columns", "TimeEntryAdjustment · type, adjusted_billable_minutes, adjusted_amount, delta_amount, currency, reason, invoice_line_item_id", "Timesheet · TimesheetAction · audit_events · crm_notes", "Read-only: Invoice / InvoiceLineItem (08), Project (05), Task (06)"], []) + "</div>";
  }

  /* =====================================================================================================================
     TEAM TIMESHEETS (spec §5, §10)
     @route  /time/team?period=2026-11-02&status=&team=&branch=&member=
     @perm   VIEW time.entries.read_team or read_all · approve from the row time.timesheets.approve · send reminder time.timesheets.approve
     @api    GET /time/timesheets?period_start=&status=&team_id=&branch_id=&member_id=&cursor= · POST /time/timesheets/bulk {ids, action: approve|remind}
     @mcp    time_timesheets_read · time_timesheets_approve
     @data   Timesheet (membership_id, period_start, period_end, status, total_minutes, billable_minutes, non_billable_minutes, expected_minutes, billable_amount, currency, submitted_at, approver_membership_id, last_reminder_sent_at, reminder_count) ·
             TimeUtilizationPeriod (utilization_percent) · Membership/Team (01)
     @ui     Table with filter bar, Progress for logged vs expected, checkboxes + bulk bar, DropdownMenu row actions, Popover+Command member filter
     @states loading · empty ("No timesheets for this period") · error · no-access · members without a timesheet row show "Not started" (the row is created lazily)
     @audit  approve / reminder sent
     @note   Scope: read_team shows the teams I lead, read_all the organization (branch scope on top). A member with no Timesheet row yet is derived from the roster so compliance is visible: Not started is a UI state, not a TimesheetStatus.
             Amounts (billable_amount) need time.rates.read*. Reminders increment reminder_count and set last_reminder_sent_at; they are sent through 14.
     ===================================================================================================================== */
  const TS = [
    ["AM", "SUBMITTED", 2400, 1980, 420, 2400, 1, "Nov 2 – Nov 8", "Nov 9 08:30", 94, 2475],
    ["SJ", "SUBMITTED", 2280, 1800, 480, 2400, 1, "Nov 2 – Nov 8", "Nov 9 11:05", 88, 2250],
    ["JK", "OPEN", 1740, 1320, 420, 2400, 0, "Nov 2 – Nov 8", "-", 72, 1650],
    ["KL", "APPROVED", 2520, 2220, 300, 2400, 1, "Nov 2 – Nov 8", "Nov 9 09:40", 92, 2775],
    ["MS", "REJECTED", 2190, 1800, 390, 2400, 1, "Nov 2 – Nov 8", "Nov 9 08:30", 91, 2250],
    ["AM", "LOCKED", 2430, 2010, 420, 2400, 1, "Oct 26 – Nov 1", "Nov 2 08:12", 100, 2512.5],
  ];
  function team() {
    return '<div class="a-page">' + head("Team timesheets", "Weekly timesheets of the people you manage.", btn("Send reminders", "bell") + btn("Export", "file") + btn("Approvals queue", "check", "primary")) +
      '<div class="mini-stats">' + stat("Compliance", "80%", "4 of 5 submitted for Nov 2 – Nov 8") + stat("Logged", "122:30", "of 200:00 expected") + stat("Billable ratio", "81%", "utilization target 75%") + stat("Awaiting approval", 2, "SUBMITTED", 1) + stat("Billable amount", eur(11925), "preview + snapshots") + "</div>" +
      '<div class="toolbar">' + search("Search member") + sel("Weekly", "calendar") + sel("Nov 2 – Nov 8, 2026", "calendar") + sel("Team: Delivery", "users") + sel("Branch: All", "building") + sel("Status: Any") + sel("Table", "grid") + sel("Views: Needs attention", "star") + "</div>" +
      fbar([["Period", "is", "Nov 2 – Nov 8"], ["Team", "is", "Delivery"], ["Status", "is not", "Locked"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span class="muted">approve or remind in one request</span><span style="flex:1"></span>' + btn("Approve", "check", "sm") + btn("Remind", "bell", "sm") + "</div>" +
      tbl(["", "Member", "Period", "Status", ">Logged", "Progress", ">Billable", ">Non-billable", ">Amount", "Submitted", "Approver", ""], TS.map((r, i) => [cb(i < 2), wh(r[0]), r[7], eb(r[1]), hm(r[2]) + muted(" / " + hm(r[5])), bar(r[9]), hm(r[3]), hm(r[4]), eur2(r[10]), r[8], "Anna Meyer", more])) +
      '<div class="tm-sp"></div>' + cd("<b>Not started</b><span class='r muted'>members with no entries for the period (no Timesheet row yet)</span>", '<div class="rowx">' + av("JK") + '<div class="grow"><b>No timesheet for Nov 9 – Nov 15</b><small>0:00 logged · reminder sent Nov 10</small></div>' + btn("Remind", "bell", "sm") + "</div>", 1) +
      dm(["Timesheet · membership_id, period_start, period_end, status, total_minutes, billable_minutes, non_billable_minutes, expected_minutes, billable_amount, currency, submitted_at, approver_membership_id, last_reminder_sent_at, reminder_count", "TimeUtilizationPeriod · utilization_percent", "Read-only: Membership, Team (01)"], []) + "</div>";
  }

  /* =====================================================================================================================
     APPROVALS (spec §5, §12)
     @route  /time/approvals?status=SUBMITTED&project=&member=
     @perm   VIEW + act time.timesheets.approve (and time.entries.approve for single entries) · unlock locked periods time.entries.unlock* · self-approval blocked unless allow_self_approval
     @api    GET /time/approvals?status= · POST /time/timesheets/:id/approve {comment} · POST /time/timesheets/:id/reject {comment (required)} · POST /time/timesheets/:id/reopen · POST /time/timesheets/:id/unlock {reason (required)} · POST /time/timesheets/bulk
     @mcp    time_timesheets_approve · time_timesheets_reject (sensitive: human confirmation when an AI agent calls it)
     @data   Timesheet (status, approver_membership_id, rejection_comment, submission_comment, locked_at, locked_by_membership_id, unlocked_at, unlock_reason) · TimesheetAction (action, actor_membership_id, comment, from_status, to_status) · TimeEntry (status, rejection_reason, is_locked) ·
             TimeTrackingSettings (require_approval, approver_policy, default_approver_membership_id, lock_on_approval, allow_self_approval) · TimeProjectSettings.approver_membership_id
     @ui     Tabs (To approve, Rejected, Locked periods), Table with expandable rows, Dialog "Reject timesheet" with required comment Textarea, AlertDialog "Unlock period" with reason, Badge
     @states loading · empty ("Nothing waiting for you") · error · no-access · conflict (someone else already decided) · self-approval blocked notice
     @audit  every decision writes a TimesheetAction (from_status, to_status, comment) and an audit event; unlocking records unlocked_by + unlock_reason
     @note   Who approves follows TimesheetApproverPolicy (PROJECT_OWNER, TEAM_LEAD, MANAGER, SPECIFIC_MEMBER); a project override (TimeProjectSettings.approver_membership_id) wins for that project's entries, so one timesheet can need several approvers:
             each approver sees only their entries and the timesheet becomes APPROVED when all entries are decided. Reject sends the whole week (or single entries) back to DRAFT with the reason; the member resubmits. APPROVED sheets lock when
             lock_on_approval; LOCKED sheets can only be reopened with unlock + reason. A member cannot approve their own sheet unless allow_self_approval.
     ===================================================================================================================== */
  function approvals() {
    return '<div class="a-page">' + head("Approvals", "Timesheets waiting for your decision.", btn("Approve selected", "check", "primary")) +
      '<div class="tabset">' + tabs([["q", "To approve", 2], ["r", "Rejected", 1], ["l", "Locked periods", 3]], "q") +
      pane("q", 1, fbar([["Status", "is", "Submitted"], ["Period", "is", "Last 4 weeks"]], btn("Clear", "", "sm ghost")) +
        TS.slice(0, 2).map((r, i) => cd("<b>" + nm(r[0]) + " · " + r[7] + "</b><span class='r'>" + eb(r[1]) + " " + muted("submitted " + r[8]) + "</span>",
          '<div class="g3" style="padding:12px 16px">' + kv("Logged", hm(r[2]) + " / " + hm(r[5])) + kv("Billable", hm(r[3]) + " · " + eur2(r[10])) + kv("Non-billable", hm(r[4])) + "</div>" +
          '<div class="rowx"><div class="grow"><b>Member comment</b><small>' + (i ? "Support rotation on Wednesday." : "Nothing special this week.") + "</small></div></div>" +
          [["Stripe Billing Migration", "WEB-148 VAT validation", "Development", 300, 1], ["Mobile App v2", "MOB-92 Push copy", "Design", 195, 1], ["Internal", "Admin", "Admin", 120, 0]].map((e) => '<div class="tm-ev"><span class="t">' + (i ? "Nov 5" : "Nov 6") + '</span><div class="grow"><b>' + e[1] + " · " + e[2] + "</b><small>" + e[0] + "</small></div>" + bill(e[4], "ADMIN") + '<span class="dur">' + hm(e[3]) + "</span>" + cb(1) + "</div>").join("") +
          '<div class="rowx"><div class="grow"><small>Approver policy TEAM_LEAD · approving snapshots rates and locks the period</small></div>' + btn("Reject…", "x", "sm") + btn("Approve", "check", "sm primary") + "</div>", 1) + sp).join("") +
        cd("<b>Reject timesheet</b><span class='r muted'>Dialog</span>", f("Reason (required)", '<div class="input-fake">Missing task link on Monday\'s entry. Please add WEB-131 and resubmit.</div>', "Stored in Timesheet.rejection_comment, TimeEntry.rejection_reason and a TimesheetAction REJECTED. The member is notified (14).") + f("Apply to", '<div class="rowx" style="padding:0;gap:8px"><span class="seg on">Whole timesheet</span><span class="seg">Selected entries only</span></div>') + '<div class="rowx" style="padding:0">' + btn("Cancel") + btn("Reject", "x", "primary") + "</div>")) +
      pane("r", 0, tbl(["Member", "Period", ">Logged", "Rejected by", "Reason", "Rejected", ""], [[wh("MS"), "Nov 2 – Nov 8", "36:30", "Anna Meyer", "Template QA entry has no task link", "Nov 9 09:50", btn("Reopen", "", "sm")]])) +
      pane("l", 0, '<div class="callout">' + I("lock", 16) + "<div>Approved periods are locked when <b>lock_on_approval</b> is on. Unlocking needs <b>time.entries.unlock*</b> and a reason, and is audited. INVOICED entries cannot be unlocked.</div></div>" + sp +
        tbl(["Member", "Period", "Status", "Locked by", "Locked", "Unlocked", "Reason", ""], [[wh("AM"), "Oct 26 – Nov 1", eb("LOCKED"), "Anna Meyer", "Nov 2 08:12", "-", "-", btn("Unlock…", "lock", "sm")], [wh("KL"), "Oct 19 – Oct 25", eb("LOCKED"), "system", "Oct 26 09:00", "Oct 28 14:20 by Dana Wolf", "Entry corrected after client call", btn("Unlock…", "lock", "sm")], [wh("SJ"), "Oct 12 – Oct 18", eb("INVOICED"), "system", "Oct 19 09:00", "-", "Invoiced: cannot unlock", btn("Open invoice", "receipt", "sm")]]) + sp +
        cd("<b>Unlock period</b><span class='r muted'>AlertDialog</span>", f("Reason (required)", '<div class="input-fake">Client asked to move 1:30 from WEB-142 to WEB-144.</div>', "Sets unlocked_by_membership_id, unlocked_at, unlock_reason on the timesheet and its entries, writes TimesheetAction UNLOCKED, notifies the member.") + '<div class="rowx" style="padding:0">' + btn("Cancel") + btn("Unlock", "lock", "primary") + "</div>")) +
      "</div>" +
      dm(["Timesheet · status, approver_membership_id, approved_by_membership_id, rejected_by_membership_id, rejection_comment, submission_comment, locked_at, locked_by_membership_id, unlocked_at, unlocked_by_membership_id, unlock_reason", "TimesheetAction · action, actor_membership_id, comment, from_status, to_status", "TimeEntry · status, rejection_reason, is_locked", "TimeTrackingSettings · require_approval, approver_policy, lock_on_approval, allow_self_approval", "TimeProjectSettings · approver_membership_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     TIMESHEET DETAIL (spec §5, §10, §12)
     @route  /time/timesheets/:id
     @perm   VIEW time.entries.read_own (own) / read_team / read_all · approve/reject time.timesheets.approve · submit time.timesheets.submit_own · unlock time.entries.unlock*
     @api    GET /time/timesheets/:id · POST /time/timesheets/:id/submit|approve|reject|reopen|unlock
     @mcp    time_timesheets_read · time_timesheets_approve
     @data   Timesheet (all columns) · TimesheetAction · TimeEntry (timesheet_id) · TimeUtilizationPeriod
     @ui     Tabs (Entries, Summary, Actions), grid, Timeline, Button group (Approve, Reject)
     @states loading · not found / no access · each status (OPEN, SUBMITTED, APPROVED, REJECTED, LOCKED) shows its own action set
     @audit  TimesheetAction per transition
     @note   Status machine: OPEN -> SUBMITTED -> APPROVED | REJECTED ; REJECTED -> OPEN (reopen, member edits) ; APPROVED -> LOCKED (lock_on_approval) ; LOCKED -> OPEN (unlock with reason).
     ===================================================================================================================== */
  function sheet() {
    const days = ["Mon 2", "Tue 3", "Wed 4", "Thu 5", "Fri 6"];
    const rows = [["Acme Rebrand Website · WEB-131", "Review", [75, 0, 0, 0, 0], 1], ["Mobile App v2 · MOB-87", "Development", [0, 240, 240, 120, 0], 1], ["Customer Portal Build · WEB-151", "Design", [180, 120, 0, 0, 240], 1], ["Internal · Weekly sync", "Meeting", [0, 45, 0, 0, 0], 0]];
    return '<div class="a-page">' + head("Marco Silva · Nov 2 – Nov 8, 2026", "Timesheet · weekly · submitted Nov 9 08:30 · approver Anna Meyer", eb("REJECTED") + btn("Reopen", "edit") + btn("Remind", "bell")) +
      '<div class="mini-stats">' + stat("Logged", "36:30", "of 40:00 expected") + stat("Billable", "30:00", "ratio 82%") + stat("Non-billable", "6:30", "OVERHEAD, ADMIN") + stat("Billable amount", eur2(2250), "preview until approved") + stat("Utilization", "91%", "target 75%") + "</div>" +
      '<div class="tm-two"><div>' + cd("<b>Entries</b><span class='r muted'>TimeEntry.timesheet_id</span>", '<table class="tm-grid"><thead><tr><th>Row</th>' + days.map((d) => "<th>" + d + "</th>").join("") + "<th>Total</th></tr></thead><tbody>" + rows.map((r) => "<tr><td><b class=\"ink\">" + r[0] + '</b><span class="tm-sub">' + r[1] + " · " + (r[3] ? "Billable" : "Non-billable") + "</span></td>" + r[2].map((m, i) => "<td>" + (m ? '<span class="tm-cell' + (i === 0 && r[0].indexOf("WEB-131") > -1 ? " bad" : "") + '">' + hm(m) + "</span>" : '<span class="tm-cell empty">0:00</span>') + "</td>").join("") + '<td class="tot">' + hm(r[2].reduce((a, b) => a + b, 0)) + "</td></tr>").join("") + "</tbody></table>", 1) + sp +
      callout("x", "<b>Rejected by Anna Meyer, Nov 9 09:50.</b> “Template QA entry (Mon, WEB-131) has no task link. Please fix and resubmit.” <span class=\"muted\">Timesheet.rejection_comment</span>", "bad") + "</div><div>" +
      cd("<b>Actions</b><span class='r muted'>TimesheetAction</span>", '<div class="tl"><div class="ev"><b>Rejected</b> ' + eb("REJECTED") + "<small>Anna Meyer · Nov 9 09:50 · SUBMITTED to REJECTED · “No task link”</small></div><div class=\"ev\"><b>Submitted</b><small>Marco Silva · Nov 9 08:30 · OPEN to SUBMITTED</small></div></div>") + sp +
      cd("<b>Properties</b>", kv("Period type", "Weekly " + muted("TimesheetPeriodType WEEKLY")) + kv("Currency", "EUR") + kv("Approver", "Anna Meyer " + muted("approver_membership_id")) + kv("Reminders", "1 sent " + muted("reminder_count")) + kv("Locked", "-") + kv("Created", "Nov 2, lazily with the first entry")) + "</div></div>" +
      dm(["Timesheet · all columns", "TimesheetAction · action, actor_membership_id, comment, from_status, to_status, created_at", "TimeEntry · timesheet_id", "TimeUtilizationPeriod · utilization_percent"], []) + "</div>";
  }

  /* =====================================================================================================================
     TIME SUGGESTIONS (spec §4)
     @route  /time/suggestions?source=&status=PENDING&date=
     @perm   VIEW time.entries.read_own · accept/dismiss time.entries.create_own · AI source requires TimeTrackingSettings.ai_suggestions_enabled · calendar source requires calendar_capture_enabled
     @api    GET /time/suggestions?status=&source= · POST /time/suggestions/:id/accept {overrides} -> TimeEntry · POST /time/suggestions/:id/dismiss · POST /time/suggestions/accept-all {ids}
     @mcp    time_suggestions_read · time_suggestions_accept
     @data   TimeSuggestion (source, status, date, start_at, end_at, duration_minutes, project_id, task_id, ticket_id, activity_type_id, description, is_billable, calendar_event_id, external_ref, confidence, rationale, payload, accepted_time_entry_id,
             reviewed_at, expires_at) · TimeEntry (suggestion accepted)
     @ui     Card list with confidence Badge, Popover+Command to change project/task, Button Accept/Edit/Dismiss, Checkbox bulk, Tabs by status
     @states loading · empty ("No suggestions. Capture sources are on") · capture disabled notice · error · expired (grey)
     @audit  accept (creates entry, links accepted_time_entry_id) and dismiss; AI-origin suggestions record the rationale
     @note   Review is ALWAYS required: nothing is created without Accept. Accepting creates a TimeEntry with source CALENDAR / GENERATED and the suggestion keeps accepted_time_entry_id. Suggestions expire (expires_at) and become EXPIRED.
             AI uses the organization's OPENAI connection (BYOK, IntegrationConnection); without it AI suggestions are unavailable and the card explains why. COMMIT suggestions come from a connected repository (payload holds sha and repo).
     ===================================================================================================================== */
  function suggestions() {
    const S = [
      ["CALENDAR", "Wed Nov 11 · 10:00 – 11:00", 60, "Acme Rebrand Website", "WEB-142", "Meeting", "Design review with Lena Kovac", 0.92, "Calendar event “Pricing page review” with 2 attendees from Acme Corp matches project Acme Rebrand Website.", "PENDING"],
      ["COMMIT", "Tue Nov 10", 135, "Stripe Billing Migration", "WEB-139", "Development", "3 commits on feature/webhook-retry", 0.81, "Commits a91f3, b02de, c77a1 reference WEB-139; first at 14:02, last at 16:17.", "PENDING"],
      ["TASK_ACTIVITY", "Tue Nov 10", 40, "Mobile App v2", "MOB-87", "Development", "Moved MOB-87 to In progress, 4 comments", 0.58, "Task activity between 09:10 and 09:50 with no timer or entry.", "PENDING"],
      ["ATTENDANCE", "Mon Nov 9", 90, "-", "-", "Admin", "On site 08:58 – 17:31, 6:00 logged", 0.5, "Attendance shows 8:33 on site; 2:33 unaccounted for. Never auto-created.", "PENDING"],
      ["AI", "Fri Nov 6", 75, "Customer Portal Build", "WEB-151", "Design", "Email thread about approval wording (Gmail)", 0.66, "AI estimate from 6 messages and 2 task edits. Review required.", "DISMISSED"],
    ];
    return '<div class="a-page">' + head("Suggestions", "Time we think you worked. Nothing is logged until you accept.", btn("Settings", "settings") + btn("Accept all high confidence", "check", "primary")) +
      '<div class="tabset">' + tabs([["p", "Pending", 4], ["a", "Accepted"], ["d", "Dismissed"], ["e", "Expired"]], "p") +
      pane("p", 1, fbar([["Source", "is any of", "Calendar, Commit, Task activity, Attendance, AI"], ["Date", "is in", "Last 7 days"], ["Confidence", "is at least", "50%"]], btn("Clear", "", "sm ghost")) +
        '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span style="flex:1"></span>' + btn("Accept", "check", "sm") + btn("Dismiss", "x", "sm") + "</div>" +
        S.map((s, i) => cd("<b>" + U.en(s[0]) + "</b><span class='r'><span class='tm-conf' title='TimeSuggestion.confidence'>" + bar(Math.round(s[7] * 100), s[7] > 0.75 ? "green" : "yellow") + "</span>" + E(s[9], s[9] === "PENDING" ? "blue" : "") + "</span>",
          '<div class="rowx" style="padding:0 0 10px">' + cb(i < 2) + '<div class="grow"><b>' + s[6] + "</b><small>" + s[1] + " · " + hm(s[2]) + " · " + s[3] + " · " + s[4] + " · " + s[5] + '</small></div></div><div class="sub-note">Why: ' + s[8] + "</div>" +
          '<div class="rowx" style="padding:10px 0 0;gap:8px">' + sel(s[3], "folder") + sel(s[4] === "-" ? "No task" : s[4], "tasks") + sel(s[5]) + '<span style="flex:1"></span>' + btn("Edit", "edit", "sm") + btn("Dismiss", "x", "sm") + btn("Accept", "check", "sm primary") + "</div>") + sp).join("")) +
      pane("a", 0, tbl(["Source", "Date", ">Time", "Entry", "Reviewed"], [["Calendar", "Mon Nov 9", "0:45", "#9ad3e8 Weekly team sync", "Nov 10 08:55"], ["Commit", "Fri Nov 6", "2:10", "#e1507b MOB-87 Sync queue", "Nov 9 09:01"]])) +
      pane("d", 0, tbl(["Source", "Date", ">Time", "Description", "Reviewed"], [["AI", "Fri Nov 6", "1:15", "Email thread about approval wording", "Nov 9 09:03"]])) +
      pane("e", 0, '<div class="sub-note" style="padding:16px">Suggestions older than expires_at (7 days by default) become EXPIRED and drop out of the pending list.</div>') + "</div>" +
      callout("sparkles", "<b>AI suggestions</b> use the organization's own OpenAI key (Setup > Integrations, IntegrationConnection). Without a connected key the AI source is off. Calendar capture needs a connected calendar (19).") +
      dm(["TimeSuggestion · source, status, date, start_at, end_at, duration_minutes, project_id, task_id, ticket_id, activity_type_id, description, is_billable, calendar_event_id, external_ref, confidence, rationale, payload, accepted_time_entry_id, reviewed_at, expires_at", "TimeTrackingSettings · calendar_capture_enabled, ai_suggestions_enabled, attendance_prefill_enabled", "Read-only: CalendarEvent (19), Task (06)"], []) + "</div>";
  }

  /* =====================================================================================================================
     BILLING RATES — list (spec §2, §6, §11)
     @route  /time/rates?kind=BILLING&scope=&project=&member=&status=active|expired|archived
     @perm   VIEW time.rates.read* · create/edit/archive time.rates.manage*
     @api    GET /time/rates?kind=&scope=&project_id=&membership_id=&product_id=&activity_type_id=&as_of= · POST /time/rates · PATCH /time/rates/:id · POST /time/rates/:id/archive · GET /time/rates/resolve?membership_id=&project_id=&activity_type_id=&date=
     @mcp    time_rates_read · time_rates_manage (sensitive: human confirmation for AI callers)
     @data   BillingRate (kind, scope, product_id, project_id, membership_id, activity_type_id, name, currency, hourly_rate, effective_from, effective_to, source_compensation_id, notes, created_by_membership_id, archived_at) · Product (08) · Project (05) · TimeActivityType
     @ui     Table with filter bar, Tabs (Billing / Cost), Badge for scope and state, DropdownMenu row actions, "Test a rate" Dialog (resolve preview)
     @states loading · empty ("No rate cards. Entries will be billed at 0 until a rate exists") · error · no-access (the whole screen needs time.rates.read*; the nav entry is hidden)
     @audit  every create / change / archive is audited (rate changes are in spec §12); old rates are never edited in place when they were already snapshotted: end-date them and create a new row
     @note   BILLING rates (customer price per hour) resolve by scope, most specific wins: PROJECT_MEMBER > PROJECT > MEMBER > PRODUCT > ORGANIZATION, optionally narrowed by activity_type_id, valid on a date between effective_from and
             effective_to. COST rates (what the employee costs) are mirrored from 10 (source_compensation_id) and are only visible with time.rates.read*. A rate change never alters history: approved entries keep their snapshot.
     ===================================================================================================================== */
  const RATES = [
    ["Standard hourly rate", "BILLING", "ORGANIZATION", "All work", 95, "Jan 1, 2026", "-", "active", "-"],
    ["Development", "BILLING", "ORGANIZATION", "Activity: Development", 105, "Jan 1, 2026", "-", "active", "-"],
    ["Acme Rebrand Website", "BILLING", "PROJECT", "Acme Rebrand Website", 85, "Mar 1, 2026", "-", "active", "-"],
    ["Marco Silva, senior", "BILLING", "MEMBER", "Marco Silva", 110, "Jan 1, 2026", "Dec 31, 2026", "active", "-"],
    ["Marco on Acme Rebrand", "BILLING", "PROJECT_MEMBER", "Acme Rebrand Website · Marco Silva", 75, "Apr 1, 2026", "-", "active", "-"],
    ["Consulting day", "BILLING", "PRODUCT", "Product: Consulting (1 h)", 120, "Jan 1, 2026", "-", "active", "-"],
    ["Standard 2025", "BILLING", "ORGANIZATION", "All work", 88, "Jan 1, 2025", "Dec 31, 2025", "expired", "-"],
    ["Marco Silva cost", "COST", "MEMBER", "Marco Silva", 38, "Jan 1, 2026", "-", "active", "10 EmployeeCompensation"],
  ];
  function rates() {
    return '<div class="a-page">' + head("Billing rates", "What the customer pays per hour, and what people cost. Resolved by scope and date.", btn("Test a rate", "search") + btn("New rate", "plus", "primary")) +
      '<div class="tabset">' + tabs([["b", "Billing rates", 7], ["c", "Cost rates", 1]], "b") +
      pane("b", 1, '<div class="tm-scope">' + [["ORGANIZATION", "Default for everyone", 2, 0], ["PRODUCT", "A service from 08", 1, 0], ["PROJECT", "One project", 1, 0], ["MEMBER", "One person", 1, 0], ["PROJECT_MEMBER", "Person on a project", 1, 1]].map((s) => '<div class="s' + (s[3] ? " on" : "") + '"><b>' + U.en(s[0]) + "</b>" + s[1] + " · " + s[2] + " rate(s)</div>").join("") + "</div>" +
        '<div class="sub-note" style="margin-bottom:10px">Most specific wins: Project member > Project > Member > Product > Organization. An activity type narrows any of them.</div>' +
        '<div class="toolbar">' + search("Search rate name, project, member") + sel("Scope: Any") + sel("State: Active") + sel("Currency: EUR") + sel("Valid on: Nov 11, 2026", "calendar") + "</div>" +
        fbar([["Kind", "is", "Billing"], ["State", "is", "Active"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
        tbl(["Name", "Scope", "Applies to", ">Hourly rate", "Effective from", "Effective to", "State", ""], RATES.filter((r) => r[1] === "BILLING").map((r) => [ink(r[0]), '<span class="badge" title="BillingRateScope ' + r[2] + '">' + U.en(r[2]) + "</span>", r[3], "€" + r[4].toFixed(2), r[5], r[6], '<span class="badge ' + (r[7] === "active" ? "green" : "") + '">' + U.en(r[7]) + "</span>", more]))) +
      pane("c", 0, callout("lock", "<b>Cost rates are sensitive.</b> They mirror EmployeeCompensation.cost_rate_hourly from 10 (source_compensation_id) and need time.rates.read*. Edit them in Employees; here they are read-only.", "warn") + sp +
        tbl(["Member", "Scope", ">Cost per hour", "Effective from", "Effective to", "Source", ""], RATES.filter((r) => r[1] === "COST").map((r) => [wh("MS"), U.en(r[2]), "€" + r[4].toFixed(2), r[5], r[6], r[8], more]))) + "</div>" +
      '<div class="tm-sp"></div>' + cd("<b>Test a rate</b><span class='r muted'>GET /time/rates/resolve</span>", '<div class="tm-pick" style="padding:0">' + f("Member", sel("Marco Silva", "users")) + f("Project", sel("Acme Rebrand Website", "folder")) + f("Activity type", sel("Development")) + f("Date", sel("Nov 11, 2026", "calendar")) + '</div><div class="rowx" style="padding:0"><div class="grow"><b>€75.00 / h</b><small>Resolved: Marco on Acme Rebrand (PROJECT_MEMBER), effective Apr 1, 2026</small></div></div>') +
      dm(["BillingRate · kind, scope, product_id, project_id, membership_id, activity_type_id, name, currency, hourly_rate, effective_from, effective_to, source_compensation_id, notes, created_by_membership_id, archived_at", "Read-only: Product (08), Project (05), EmployeeCompensation (10)"], []) + "</div>";
  }

  /* =====================================================================================================================
     BILLING RATE — create / edit (spec §2, §6)
     @route  /time/rates/new?scope=&project=&member= · /time/rates/:id/edit
     @perm   time.rates.manage* (sensitive) · reading existing rates time.rates.read*
     @api    POST /time/rates {kind, scope, product_id?, project_id?, membership_id?, activity_type_id?, name?, currency, hourly_rate, effective_from, effective_to?, notes?} · PATCH /time/rates/:id (only effective_to, name, notes once used by an approved entry)
     @mcp    time_rates_manage (human confirmation for AI callers)
     @data   BillingRate · Product (08) · Project (05) · Membership (01) · TimeActivityType · EmployeeCompensation.cost_rate_hourly (10) for COST
     @ui     Form with scope ToggleGroup, Popover+Command (project, member, product), Select (activity, currency), DatePicker x2, Input (decimal), Textarea, "Overlap check" Alert
     @states validation (scope needs its target: PROJECT needs project_id, MEMBER needs membership_id, PROJECT_MEMBER needs both, PRODUCT needs product_id) · overlap warning · saving · saved · no-access (403)
     @audit  rate created / ended / archived with before/after values
     @note   Overlapping periods for the same scope target and activity are refused. To change a price, end-date the current rate (effective_to = day before) and create a new one: used rates are immutable so approved entries stay consistent.
             Currency must match the organization or project currency; mixed-currency reports convert with the TimeTrackingSettings.reporting_currency.
     ===================================================================================================================== */
  function rateNew() {
    return '<div class="a-page">' + head("New billing rate", "A price per hour that applies from a date, for the scope you choose.", btn("Cancel") + btn("Save rate", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Scope</b>", '<div class="tm-scope">' + [["ORGANIZATION", "Everyone", 0], ["PRODUCT", "A service from 08", 0], ["PROJECT", "One project", 0], ["MEMBER", "One person", 0], ["PROJECT_MEMBER", "Person on a project", 1]].map((s) => '<div class="s' + (s[2] ? " on" : "") + '"><b>' + U.en(s[0]) + "</b>" + s[1] + "</div>").join("") + "</div>" +
        row2(f("Project", sel("Acme Rebrand Website", "folder"), "Required for PROJECT and PROJECT_MEMBER"), f("Member", sel("Marco Silva", "users"), "Required for MEMBER and PROJECT_MEMBER")) +
        row2(f("Product / service", sel("Not used for this scope", "box"), "Required for PRODUCT (08 catalog)"), f("Activity type", sel("Any activity"), "Optional: only for this activity"))) + sp +
      cd("<b>Price and validity</b>", row2(f("Name", box("Marco on Acme Rebrand"), "Optional label shown in lists"), f("Kind", sel("Billing (customer price)"), "COST rates are mirrored from 10 and cannot be created here")) +
        row2(f("Hourly rate", box("75.00"), "BillingRate.hourly_rate"), f("Currency", sel("EUR"))) + row2(f("Effective from", sel("Apr 1, 2026", "calendar")), f("Effective to", sel("Open ended", "calendar"), "Leave empty for no end")) + f("Notes", '<div class="editor"><div class="ed-body">Agreed in the SOW addendum, customer discount for the rebrand.</div></div>')) +
      "</div><div>" + cd("<b>Impact preview</b>", kv("Overlaps", "None found") + kv("Replaces", "Project rate €85.00 for this person on this project") + kv("Open drafts affected", "6 entries, 14:30") + kv("Approved entries", "Unchanged (snapshots)") + '<div class="sub-note" style="margin-top:6px">Draft and submitted entries use the new rate when they are approved. Approved and invoiced entries keep their snapshot.</div>') + sp +
      callout("shield", "<b>Sensitive.</b> Creating or editing rates needs time.rates.manage*, is audited and, from MCP, asks for human confirmation.", "warn") + "</div></div>" +
      dm(["BillingRate · kind, scope, product_id, project_id, membership_id, activity_type_id, name, currency, hourly_rate, effective_from, effective_to, notes", "Read-only: Product (08), Project (05), Membership (01), TimeEntry (impact count)"], []) + "</div>";
  }

  /* =====================================================================================================================
     PROJECT TIME SETTINGS — list (spec §6, §8)
     @route  /time/projects?tracking=&members_only=&alert=
     @perm   VIEW time.settings.manage (or projects.projects.read for the read-only column on a project) · edit time.settings.manage
     @api    GET /time/project-settings?project_id=&tracking_enabled= · PATCH /time/project-settings/:project_id
     @mcp    time_project_settings_manage
     @data   TimeProjectSettings (project_id, default_billable, default_non_billable_category, default_activity_type_id, contract_id, approver_membership_id, time_tracking_enabled, members_only, require_task, hours_alert_percent, hours_alert_sent_at) · Project (budget_hours, name, company_id) · TimeEntry (logged hours)
     @ui     Table with Progress (logged vs Project.budget_hours), filter bar, Switch (inline tracking toggle), DropdownMenu row actions
     @states loading · empty · error · no-access
     @audit  setting change
     @note   Rows exist lazily (copied from ProjectType defaults on project creation). Billing model and T&M rate stay in ProjectBillingSettings (08). hours_alert_percent fires once when logged hours cross the percent of Project.budget_hours
             (hours_alert_sent_at prevents repeats) and notifies the project owner (14).
     ===================================================================================================================== */
  function projects() {
    const P = [["ACME", "Mobile", "Billable", "Development", "Anna Meyer", 1, 0, 0, 80, 412, 480], ["MOB", "Northwind", "Billable", "Development", "Jonas Koch", 1, 0, 1, 80, 610, 700], ["STR", "Globex", "Billable", "Review", "Anna Meyer", 1, 1, 0, 90, 188, 200], ["POR", "Initech", "Billable", "Design", "Sofia Jensen", 1, 0, 1, 75, 222, 400], ["BRA", "Acme Corp", "Non-billable · Pre-sales", "Design", "Sofia Jensen", 1, 0, 0, 0, 96, 120], ["INT", "-", "Non-billable · Overhead", "Admin", "Dana Wolf", 0, 0, 0, 0, 0, 0]];
    return '<div class="a-page">' + head("Project time settings", "How time is tracked, approved and billed per project.", btn("Export", "file") + btn("Defaults by project type", "settings")) +
      '<div class="toolbar">' + search("Search project or customer") + sel("Tracking: Enabled") + sel("Hours alert: Any") + sel("Contract: Any", "file") + sel("Table", "grid") + "</div>" +
      fbar([["Tracking", "is", "Enabled or disabled"], ["Billing default", "is", "any"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      tbl(["Project", "Default billable", "Default activity", "Approver", "Tracking", "Members only", "Require task", "Hours alert", "Logged vs budget", ""], P.map((r) => [ink(PRJ[r[0]][0]) + '<small class="tm-sub">' + PRJ[r[0]][1] + "</small>", r[2], r[3], r[4], sw(r[5]), sw(r[7]), sw(r[6]), r[8] ? r[8] + "%" : muted("off"), r[10] ? bar(Math.round(r[9] / r[10] * 100), r[9] / r[10] > 0.9 ? "red" : "") + muted(" " + r[9] + " / " + r[10] + " h") : muted("no budget"), btn("Edit", "edit", "sm")])) +
      dm(["TimeProjectSettings · project_id, default_billable, default_non_billable_category, default_activity_type_id, contract_id, approver_membership_id, time_tracking_enabled, members_only, require_task, hours_alert_percent, hours_alert_sent_at", "Project · name, company_id, budget_hours", "TimeEntry · duration_minutes (sum)"], []) + "</div>";
  }

  /* =====================================================================================================================
     PROJECT TIME SETTINGS — edit (spec §5, §6, §8)
     @route  /time/projects/:projectId/settings (also reachable from the project's Time tab in 05)
     @perm   time.settings.manage · cost and rate links need time.rates.read*
     @api    GET/PATCH /time/project-settings/:project_id {default_billable, default_non_billable_category, default_activity_type_id, contract_id, approver_membership_id, time_tracking_enabled, members_only, require_task, hours_alert_percent}
     @mcp    time_project_settings_manage
     @data   TimeProjectSettings (all columns) · Contract (04, default_time_billable, billing_model) · ProjectType (default_time_billable, default_time_non_billable_category) · BillingRate (project rates, read-only list) · Project.budget_hours
     @ui     Form with Switch, Select, Popover+Command (approver, contract, activity), Slider/Input for the alert percent, read-only Card of resolved defaults
     @states loading · saving · saved · validation (non-billable category required when default_billable = false) · no-access
     @audit  every change
     @note   "Default billable" empty = inherit: Contract.default_time_billable, then ProjectType.default_time_billable, then TimeTrackingSettings.default_billable; the card on the right shows what is resolved now and where it comes from.
             Billing model (T&M, fixed, retainer) and the T&M rate live in 08 ProjectBillingSettings and are shown read-only with a link.
     ===================================================================================================================== */
  function projectEdit() {
    return '<div class="a-page">' + head("Acme Rebrand Website · time settings", "Overrides for this project. Empty fields inherit from the contract, project type and organization.", btn("Cancel") + btn("Save settings", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Tracking</b>", '<div class="setting"><div class="grow"><b>Time tracking enabled</b><small>time_tracking_enabled. Off hides the project from entry pickers.</small></div>' + sw(1) + '</div><div class="setting"><div class="grow"><b>Members only</b><small>members_only. Only project members can log time.</small></div>' + sw(0) + '</div><div class="setting"><div class="grow"><b>Require a task</b><small>require_task. Every entry needs a task of this project.</small></div>' + sw(1) + "</div>", 1) + sp +
      cd("<b>Billability</b>", row2(f("Default billable", sel("Inherit (currently billable)"), "Billable, Non-billable or Inherit"), f("Non-billable category", sel("-"), "Required when the default is non-billable: INTERNAL, PRE_SALES, WARRANTY, OVERHEAD, LEAVE, TRAINING, ADMIN")) + row2(f("Default activity type", sel("Development")), f("Contract", sel("Acme website retainer 2026", "file"), "TimeProjectSettings.contract_id (04)"))) + sp +
      cd("<b>Approval and alerts</b>", row2(f("Approver", sel("Anna Meyer (project owner)", "users"), "Overrides the organization policy for this project's entries"), f("Hours alert at", box("80 %"), "Notifies the project owner when logged hours reach this share of the budget")) + '<div class="sub-note">Budget 480 h · logged 412 h (86%) · alert sent Nov 4 (hours_alert_sent_at)</div>') +
      "</div><div>" + cd("<b>Resolved now</b>", kv("Billable", "Yes " + muted("from Contract default_time_billable")) + kv("Billing model", "Time and materials " + muted("ProjectBillingSettings (08)")) + kv("T&M rate", "€85.00 / h " + muted("project rate card")) + kv("Approver", "Anna Meyer") + kv("Locked periods", "after approval")) + sp +
      cd("<b>Project rate cards</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", RATES.filter((r) => r[2] === "PROJECT" || r[2] === "PROJECT_MEMBER").map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + U.en(r[2]) + " · since " + r[5] + "</small></div><span>€" + r[4].toFixed(2) + "</span></div>").join(""), 1) + "</div></div>" +
      dm(["TimeProjectSettings · all columns", "Contract · default_time_billable, billing_model (04)", "ProjectType · default_time_billable, default_time_non_billable_category (05)", "BillingRate · project scoped rows", "Project · budget_hours"], []) + "</div>";
  }

  /* =====================================================================================================================
     REPORTS (spec §10)
     @route  /time/reports/:report?from=&to=&group=&project=&customer=&member=&team=&branch=&activity=&billable=
     @perm   time.reports.read · amounts and margin need time.rates.read* · scope read_team / read_all and branch scope of 01 apply on top · export and Schedule time.entries.export*
     @api    GET /time/reports/utilization|billable|by-project|by-customer|by-person|estimate-vs-actual|unbilled|compliance ?filters · POST /time/reports/export {report, filters, format} · GET/POST /time/report-schedules · PATCH/DELETE /time/report-schedules/:id
     @mcp    time_reports_read
     @data   TimeEntry (aggregates) · TimeUtilizationPeriod (expected_minutes, logged_minutes, billable_minutes, leave_minutes, utilization_percent, billable_ratio) · Timesheet (compliance) · Project (budget_hours, company_id) · Task (estimate_hours, actual_hours) ·
             TimeTrackingSettings (utilization_target_percent, utilization_billable_only, default_expected_hours_per_week, reporting_currency) · TimeReportSchedule (name, report_key, saved_view_id, filters, format, frequency, day_of_week, day_of_month, time_of_day, timezone, recipient_membership_ids, recipient_emails, is_active, next_run_at, last_run_at, last_error) · TimeExport (one row per export)
     @ui     Tabs per report, filter bar with Popover+Command values, charts (stacked columns, horizontal bars, heat grid) with an accessible table fallback, ToggleGroup for group-by, DropdownMenu export (CSV, XLSX)
     @states loading skeleton · empty ("No time in this range") · partial (restricted scope notice) · error · no-access
     @audit  exports are logged in TimeExport and audited (who, filters, row count); schedule created/changed/deleted
     @note   The Schedule button creates a TimeReportSchedule (the saved filters of the open report, format, frequency, recipients); the 20 engine job time.report_schedules.tick runs it, writes a TimeExport and e-mails the file through 14. Utilization = logged / expected hours (expected from 10 working hours, leave and holidays), billable utilization = billable / expected; both from TimeUtilizationPeriod snapshots which are recomputed nightly and when an approved
             entry changes. Estimate vs actual compares Task.estimate_hours / Project.budget_hours with approved + submitted entry minutes (Task.actual_hours is the rolled-up cache of approved entries). Reports never show cost columns without time.rates.read*.
     ===================================================================================================================== */
  function reports() {
    const U1 = [["Anna Meyer", 94, 78, 32], ["Kim Lund", 92, 85, 0], ["Marco Silva", 91, 70, 8], ["Sofia Jensen", 88, 72, 0], ["Jonas Koch", 72, 50, 16]];
    const wk = [["Oct 12", 168, 134], ["Oct 19", 172, 121], ["Oct 26", 160, 118], ["Nov 2", 182, 148], ["Nov 9", 78, 63]];
    return '<div class="a-page">' + head("Time reports", "Where the hours went, what was billable and how it compares with plan.", btn("Schedule", "calendar") + btn("Export", "file") + btn("Ready to invoice", "receipt", "primary")) +
      '<div class="toolbar">' + sel("Nov 1 – Nov 15, 2026", "calendar") + sel("Group by: Person", "users") + sel("Billable: Any", "dollar") + sel("Views: Monthly review", "star") + "</div>" +
      fbar([["Date", "is in", "Nov 1 – Nov 15"], ["Team", "is", "Delivery"], ["Branch", "is", "All"], ["Project", "is", "Any"], ["Customer", "is", "Any"], ["Activity type", "is", "Any"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="mini-stats">' + stat("Total hours", "431:30", "+6% vs last period") + stat("Billable ratio", "81%", "target 75%") + stat("Utilization", "87%", "expected 496:00") + stat("Unbilled approved", "86:15", eur(8190) + " ready for 08", 1) + stat("Compliance", "80%", "timesheets submitted on time") + "</div>" +
      '<div class="tabset">' + tabs([["u", "Utilization"], ["b", "Billable vs non-billable"], ["p", "By project"], ["c", "By customer"], ["m", "By person"], ["e", "Estimate vs actual"]], "u") +
      pane("u", 1, '<div class="g2">' + cd("<b>Utilization by person</b><span class='r muted'>logged / expected · line = target 75%</span>", U1.map((r) => hb(r[0], [[r[2], ""], [r[1] - r[2], "m"]], 100, r[1] + "% · " + r[2] + "% billable", 75)).join("") + '<div class="tm-legend"><span><i class="b"></i>Billable share</span><span><i class="n"></i>Non-billable</span></div>', 1) +
        cd("<b>Capacity heat grid</b><span class='r muted'>TimeUtilizationPeriod per week</span>", '<div class="tm-heat" style="grid-template-columns:90px repeat(5,1fr)">' + ["", "Oct 12", "Oct 19", "Oct 26", "Nov 2", "Nov 9"].map((h) => "<small>" + h + "</small>").join("") + U1.map((r) => "<small>" + r[0].split(" ")[0] + "</small>" + [0, 1, 2, 3, 4].map((i) => '<div class="h ' + (r[1] > 90 && i % 2 ? "hi" : r[1] < 80 && i < 2 ? "lo" : "l3") + '" title="' + (60 + (r[1] + i * 7) % 40) + '%"></div>').join("")).join("") + '</div><div class="tm-legend"><span><i></i>On target</span><span><i class="y"></i>Over 100%</span></div>', 1) + "</div>" + sp +
        cd("<b>Per person</b>", tbl(["Member", ">Expected", ">Logged", ">Billable", ">Leave", ">Utilization", ">Billable ratio"], U1.map((r) => [wh(r[0].split(" ").map((x) => x[0]).join("")), "80:00", hm(Math.round(r[1] * 48)), hm(Math.round(r[2] * 48)), r[3] + ":00", r[1] + "%", Math.round(r[2] / r[1] * 100) + "%"]))) ) +
      pane("b", 0, cd("<b>Hours per week</b><span class='r muted'>billable vs non-billable</span>", '<div class="tm-cols">' + wk.map((w) => '<div class="c"><div class="stk" style="height:' + (w[1] / 190 * 100) + '%"><i style="height:' + (w[2] / w[1] * 100) + '%"></i><i class="n" style="height:' + ((w[1] - w[2]) / w[1] * 100) + '%"></i></div><small>' + w[0] + "<br>" + w[1] + " h</small></div>").join("") + '</div><div class="tm-legend"><span><i></i>Billable</span><span><i class="n"></i>Non-billable</span></div>', 1) + sp +
        cd("<b>Non-billable by category</b><span class='r muted'>TimeNonBillableCategory</span>", [["INTERNAL", 24], ["OVERHEAD", 31], ["PRE_SALES", 18], ["TRAINING", 9], ["WARRANTY", 6], ["ADMIN", 11], ["LEAVE", 16]].map((r) => hb(U.en(r[0]), [[r[1], "y"]], 40, r[1] + ":00")).join(""), 1)) +
      pane("p", 0, cd("<b>Hours by project</b>", [["ACME", 118, 98], ["MOB", 96, 90], ["STR", 71, 71], ["POR", 62, 58], ["BRA", 30, 0], ["INT", 54, 0]].map((r) => hb(PRJ[r[0]][0], [[r[2], "g"], [r[1] - r[2], "m"]], 130, r[1] + " h · " + (r[1] ? Math.round(r[2] / r[1] * 100) : 0) + "% billable")).join("") + '<div class="tm-legend"><span><i></i>Billable</span><span><i class="n"></i>Non-billable</span></div>', 1)) +
      pane("c", 0, tbl(["Customer", ">Projects", ">Hours", ">Billable", ">Unbilled", ">Billable amount"], [["Acme Corp", 2, "148:00", "98:00", "21:30", eur(8330)], ["Northwind", 1, "96:00", "90:00", "14:00", eur(7650)], ["Globex", 1, "71:00", "71:00", "30:15", eur(6035)], ["Initech", 1, "62:00", "58:00", "20:30", eur(4930)], ["Internal", 1, "54:00", "0:00", "0:00", muted("-")]])) +
      pane("m", 0, tbl(["Member", ">Hours", ">Billable", ">Billable ratio", ">Billable amount", ">Cost", ">Margin"], U1.map((r, i) => [wh(r[0].split(" ").map((x) => x[0]).join("")), hm(r[1] * 48), hm(r[2] * 48), Math.round(r[2] / r[1] * 100) + "%", eur(Math.round(r[2] * 48 / 60 * 88)), eur(Math.round(r[1] * 48 / 60 * 38)), (60 - i * 3) + "%"])) + '<div class="sub-note" style="margin-top:6px">Cost and margin columns need time.rates.read*.</div>') +
      pane("e", 0, cd("<b>Estimate vs actual</b><span class='r muted'>Project.budget_hours and Task.estimate_hours vs logged</span>", [["ACME", 480, 412], ["MOB", 700, 610], ["STR", 200, 188], ["POR", 400, 222], ["BRA", 120, 96]].map((r) => hb(PRJ[r[0]][0], [[r[2], r[2] / r[1] > 0.9 ? "r" : ""]], 720, r[2] + " / " + r[1] + " h · " + Math.round(r[2] / r[1] * 100) + "%", r[1])).join(""), 1) + sp +
        tbl(["Task", "Project", ">Estimate", ">Logged", ">Remaining", "Status"], [["WEB-142 Pricing hero", "Acme Rebrand Website", "6:00", "4:30", "1:30", '<span class="badge green">On track</span>'], ["WEB-139 Webhook retries", "Stripe Billing Migration", "10:00", "11:30", "-1:30", '<span class="badge red">Over</span>'], ["MOB-87 Offline mode", "Mobile App v2", "16:00", "12:00", "4:00", '<span class="badge green">On track</span>']])) + "</div>" +
      dm(["TimeUtilizationPeriod · expected_minutes, logged_minutes, billable_minutes, leave_minutes, utilization_percent, billable_ratio", "TimeEntry · duration_minutes, billable_minutes, billable_amount, cost_amount, status, project_id, activity_type_id, membership_id, branch_id", "Timesheet · status, submitted_at (compliance)", "Project · budget_hours, company_id · Task · estimate_hours, actual_hours", "TimeTrackingSettings · utilization_target_percent, utilization_billable_only, reporting_currency"], ["TimeReportSchedule · name, report_key, filters, format CSV|XLSX|PDF, frequency DAILY|WEEKLY|MONTHLY, recipients, next_run_at (Schedule button)", "TimeExport · report_key, schedule_id, format, status, row_count, file_document_id (Export button)"]) + "</div>";
  }

  /* =====================================================================================================================
     READY TO INVOICE — handoff to 08 (spec §7)
     @route  /time/unbilled?customer=&project=&to=&group=
     @perm   VIEW time.entries.read_all + time.reports.read · amounts need time.rates.read* · creating an invoice needs finance.invoices.create in 08 (this screen only deep-links)
     @api    GET /time/entries?status=APPROVED&invoiced=false&billable=true · POST /time/entries/mark-invoiced {entry_ids, invoice_id, invoice_line_item_id} (called by 08, service account) · GET /time/entries/uninvoiced (08 pulls this)
     @mcp    time_entries_read (filters above) · time_entries_mark_invoiced (service account of 08 only)
     @data   TimeEntry (status APPROVED, is_billable, invoice_id IS NULL, billable_amount, billing_rate_amount, billing_currency, invoiced_at, invoice_line_item_id) · TimeEntryAdjustment · Project (company_id) · ProjectBillingSettings (08, billing model)
     @ui     Grouped Table (customer > project) with checkboxes and subtotal rows, bulk bar "Create invoice in Billing", Badge, Alert for entries excluded (not approved, no rate)
     @states loading · empty ("Nothing to invoice. All approved billable time is invoiced") · error · no-access · warning rows (no rate resolved, rejected, locked unapproved)
     @audit  the state change to INVOICED (written by the mark-invoiced call) with invoice id
     @note   Time Tracking never creates invoices or financial records. This screen lists what 08 can pull: APPROVED, billable, uninvoiced entries, grouped by customer and project, with the snapshotted rate. "Create invoice in Billing" opens 08's
             new-invoice page with entry_ids; 08 then calls mark-invoiced, entries become INVOICED (invoice_id, invoice_line_item_id, invoiced_at). Write-off / write-up / write-down are TimeEntryAdjustment rows created from the invoice in 08.
     ===================================================================================================================== */
  function unbilled() {
    const G = [["Acme Corp · Acme Rebrand Website", [["Nov 5", "SJ", "MOB-92 Push copy", 195, 75], ["Nov 6", "AM", "WEB-142 Pricing hero", 300, 75], ["Nov 10", "MS", "WEB-142 Pricing hero", 180, 75]]], ["Globex · Stripe Billing Migration", [["Nov 4", "KL", "WEB-139 Webhook retries", 360, 85], ["Nov 6", "AM", "WEB-148 VAT validation", 300, 85]]]];
    return '<div class="a-page">' + head("Ready to invoice", "Approved, billable, uninvoiced time. Billing (08) pulls it into invoices.", btn("Export CSV", "file") + btn("Create invoice in Billing", "receipt", "primary")) +
      '<div class="tm-chain"><span class="step">Draft</span>' + I("right", 12) + '<span class="step">Submitted</span>' + I("right", 12) + '<span class="step">Approved</span>' + I("right", 12) + '<span class="step on">Ready to invoice (here)</span>' + I("right", 12) + '<span class="step">Invoiced (08)</span></div>' + sp +
      '<div class="mini-stats">' + stat("Ready to invoice", "86:15", eur(7385) + " at snapshot rates") + stat("Customers", 2, "with approved time") + stat("Oldest entry", "Nov 4", "7 days") + stat("Held back", 3, "no rate or not approved", 1) + "</div>" +
      fbar([["Status", "is", "Approved"], ["Billable", "is", "yes"], ["Invoiced", "is", "no"], ["Date", "is before", "Nov 15"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>5 selected · 21:15 · ' + eur2(1801.25) + "</b><span class=\"muted\">one invoice per customer</span><span style=\"flex:1\"></span>" + sel("Group by: Customer > Project") + btn("Create invoice in Billing", "receipt", "sm primary") + "</div>" +
      G.map((g) => '<div class="panel" style="margin-top:0;margin-bottom:12px"><div class="cd-h"><b>' + g[0] + "</b><span class='r muted'>subtotal " + hm(g[1].reduce((s, r) => s + r[3], 0)) + " · " + eur2(g[1].reduce((s, r) => s + r[3] / 60 * r[4], 0)) + "</span></div><table>" + th(["", "Date", "Member", "Task", ">Time", ">Rate", ">Amount", "Status"]) + "<tbody>" + g[1].map((r) => "<tr><td>" + cb(1) + "</td><td>" + r[0] + "</td><td>" + wh(r[1]) + "</td><td>" + r[2] + '</td><td class="num">' + hm(r[3]) + '</td><td class="num">' + eur2(r[4]) + '</td><td class="num">' + eur2(r[3] / 60 * r[4]) + "</td><td>" + eb("APPROVED") + "</td></tr>").join("") + "</tbody></table></div>").join("") +
      cd("<b>Held back</b><span class='r muted'>not pulled by 08</span>", [["Mon Nov 9 · MS · MOB-87", "Not approved yet (DRAFT)", ""], ["Wed Nov 4 · JK · DES-33", "Billable but no rate resolved", btn("Add rate", "plus", "sm")], ["Fri Nov 6 · SJ · WEB-151", "Timesheet rejected", ""]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + r[2] + "</div>").join(""), 1) + sp +
      cd("<b>After invoicing</b>", '<div class="sub-note" style="padding:2px 0">08 calls mark-invoiced: entries become <b>INVOICED</b> and keep invoice_id and invoice_line_item_id. Invoiced entries cannot be edited or unlocked. Corrections (write-off, write-up, write-down) are <b>TimeEntryAdjustment</b> rows created from the invoice.</div>' + tbl(["Entry", "Type", ">Adjusted minutes", ">Delta", "Reason", "Invoice line"], [["#a063d5 KL WEB-151", E("WRITE_DOWN"), "5:30", "-" + eur2(37.5), "Customer agreed a goodwill reduction", "INV-2026-0142 line 3"]])) +
      dm(["TimeEntry · status, is_billable, invoice_id, invoice_line_item_id, invoiced_at, billable_amount, billing_rate_amount, billing_currency", "TimeEntryAdjustment · type, adjusted_billable_minutes, adjusted_amount, delta_amount, currency, reason, invoice_line_item_id", "Project · company_id", "Read-only: Invoice, InvoiceLineItem, ProjectBillingSettings (08)"], []) + "</div>";
  }

  /* =====================================================================================================================
     IMPORT & EXPORT (spec §4, §13)
     @route  /time/io?tab=exports|imports
     @perm   exports time.entries.export* (rows follow scope) · imports time.imports.manage*
     @api    POST /time/reports/export {report, filters, format: CSV|XLSX|PDF} -> file in 17 · GET /time/exports?mine=1&schedule_id= · GET /time/import-jobs · POST /time/import-jobs {source, file_document_id, mapping} · POST /time/import-jobs/:id/cancel
     @mcp    time_reports_export · time_import_jobs_read
     @data   TimeImportJob (source, file_document_id, status, mapping, total_rows, imported_rows, skipped_rows, failed_rows, errors, started_at, completed_at, created_by_membership_id) · TimeEntry (import_job_id, source IMPORTED, external_ref) · TimeExport (report_key, schedule_id, format, status, filters, row_count, file_document_id, expires_at, error, created_by_membership_id) · TimeReportSchedule
     @ui     Tabs, Table, Dialog with a 3-step wizard (upload to 17, map columns, preview), Progress, Badge, DropdownMenu
     @states loading · empty · processing (progress) · failed (error report download) · cancelled · no-access
     @audit  import created/completed with counts; each export is a TimeExport row and an audit event
     @note   Imports produce IMPORTED entries with external_ref to stay idempotent (a re-run skips rows whose external_ref exists = skipped_rows). Imported entries start as DRAFT and are never auto-approved. Source examples: Toggl CSV, Harvest CSV, generic CSV.
     ===================================================================================================================== */
  function io() {
    return '<div class="a-page">' + head("Import & export", "Bring time in from other tools and take reports out.", btn("New import", "plus", "primary")) +
      '<div class="tabset">' + tabs([["x", "Export"], ["i", "Imports", 3]], "x") +
      pane("x", 1, '<div class="g2">' + cd("<b>Export entries</b>", f("Report", sel("Time entries (detailed)", "file")) + row2(f("Date range", sel("Nov 1 – Nov 15", "calendar")), f("Format", sel("CSV"))) + f("Filters", '<div class="fchips">' + chip("Status", "is any of", "Approved, Invoiced") + chip("Billable", "is", "yes") + "</div>") + f("Columns", '<div class="fchips">' + ["Date", "Member", "Project", "Customer", "Task", "Activity", "Description", "Hours", "Billable", "Status", "Invoice"].map((c) => '<span class="seg on">' + c + "</span>").join("") + '<span class="seg">Rate</span><span class="seg">Cost</span></div>', "Rate and cost columns need time.rates.read*.") + '<div class="rowx" style="padding:0">' + btn("Export", "file", "primary") + '<span class="muted">412 rows · delivered as a file in Documents (17)</span></div>') +
        cd("<b>Other exports</b>", [["Timesheets (one row per week)", "Timesheet totals, status, approver"], ["Utilization", "TimeUtilizationPeriod per person and week"], ["Ready to invoice", "Approved, billable, uninvoiced entries"], ["Payroll hours", "Approved hours per person and category"]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + btn("Export", "file", "sm") + "</div>").join(""), 1) + "</div>") +
      pane("i", 0, tbl(["Source", "File", "Status", ">Rows", ">Imported", ">Skipped", ">Failed", "Started", "By", ""], [["Toggl CSV", "toggl-oct-2026.csv", E("COMPLETED", "green"), 312, 298, 14, 0, "Nov 2 10:14", wh("AM"), more], ["Generic CSV", "contractor-hours.csv", E("FAILED", "red"), 40, 0, 0, 40, "Oct 28 16:40", wh("AM"), btn("Errors", "file", "sm")], ["Harvest CSV", "harvest-q3.csv", E("PROCESSING", "blue"), 1204, 640, 12, 0, "Nov 11 09:20", wh("AM"), btn("Cancel", "x", "sm")]]) + sp +
        cd("<b>New import wizard</b><span class='r muted'>Dialog, 3 steps</span>", '<div class="tm-chain"><span class="step on">1 Upload file (17)</span>' + I("right", 12) + '<span class="step">2 Map columns</span>' + I("right", 12) + '<span class="step">3 Preview and import</span></div><div class="sub-note" style="margin-top:8px">Mapping is stored in TimeImportJob.mapping. Rows with an existing external_ref are skipped. Unknown projects or members become errors in TimeImportJob.errors.</div>')) + "</div>" +
      dm(["TimeImportJob · source, file_document_id, status, mapping, total_rows, imported_rows, skipped_rows, failed_rows, errors, started_at, completed_at, created_by_membership_id", "TimeEntry · import_job_id, external_ref, source IMPORTED"], ["TimeExport · report_key, schedule_id, format, status, filters, row_count, file_document_id, expires_at, created_by_membership_id (export history)", "TimeReportSchedule (scheduled exports)"]) + "</div>";
  }

  /* =====================================================================================================================
     SETTINGS (spec §3, §4, §5, §6, §9)
     @route  /time/settings/:tab (general | rounding | approval | capture | activity-types | reminders | utilization)
     @perm   VIEW + edit time.settings.manage
     @api    GET/PATCH /time/settings · GET/POST/PATCH /time/activity-types · POST /time/activity-types/:id/archive
     @mcp    time_settings_manage
     @data   TimeTrackingSettings (all columns, incl. locked_before_date, locked_before_set_at, locked_before_set_by_membership_id) · TimeActivityType (name, slug, description, color, icon, default_billable, default_non_billable_category, is_default, sort_order, archived_at)
     @ui     Tabs, settings rows with Switch / Select / Input / Popover+Command (default approver), sortable list (dnd-kit) for activity types, Dialog for new type, sticky save bar
     @states loading · saving · saved · validation · no-access · "applies to new entries only" notes on rules that are not retroactive
     @audit  every setting change with before/after
     @note   One TimeTrackingSettings row per organization. Rules are enforced by the API (not only the UI) and apply to new or edited entries, never to history. Rounding is applied at save and when a timer stops; the unrounded value is kept in the audit event.
             Activity types are archived, never deleted, once used. Reporting currency drives cross-currency totals.
     ===================================================================================================================== */
  function settings() {
    const S = (t, h, c) => '<div class="setting"><div class="grow"><b>' + t + "</b><small>" + h + "</small></div>" + c + "</div>";
    return '<div class="a-page">' + head("Time tracking setup", "Organization-wide rules for time entries, rounding, approval and reminders.", btn("Discard") + btn("Save changes", "check", "primary")) +
      '<div class="tabset">' + tabs([["g", "Entries"], ["r", "Rounding"], ["a", "Approval"], ["c", "Capture"], ["t", "Activity types", 7], ["n", "Reminders"], ["u", "Utilization"]], "g") +
      pane("g", 1, cd("<b>Entry rules</b>", S("Default billable", "default_billable · last in the billability resolution order", sw(1)) + S("Require reason when overriding billable", "require_billable_override_reason", sw(1)) + S("Require a project", "require_project", sw(0)) + S("Require a task or ticket", "require_task_or_ticket", sw(0)) + S("Require a description", "require_description", sw(1)) + S("Require an activity type", "require_activity_type", sw(1)) + S("Allow overlapping entries", "allow_overlapping_entries", sw(0)) + S("Allow future entries", "allow_future_entries", sw(1)) + S("Minimum entry length", "min_entry_minutes", box("5 min")) + S("Maximum hours per day", "max_hours_per_day · blocks saving over the limit", box("12 h")) + S("Edit window", "edit_window_days · entries older than this are read-only for members", box("30 days")) + S("Lock all time before", "locked_before_date · month-end close: entries dated before it are read-only for everyone, unlocking one needs time.entries.unlock*", box("Oct 31, 2026")), 1)) +
      pane("r", 0, cd("<b>Rounding</b>", S("Rounding mode", "TimeRoundingMode: NONE, NEAREST, UP, DOWN", sel("Nearest")) + S("Rounding increment", "rounding_increment_minutes", sel("15 minutes")) + '<div class="rowx"><div class="grow"><small>Example: a 2:07 timer saves as 2:00 (NEAREST, 15 min). The original value is kept in the audit event. Applies to new entries only.</small></div></div>', 1)) +
      pane("a", 0, cd("<b>Approval</b>", S("Require approval", "require_approval. Off: entries go straight to APPROVED when the week is submitted.", sw(1)) + S("Timesheet period", "period_type: WEEKLY, BIWEEKLY, SEMI_MONTHLY, MONTHLY, CUSTOM", sel("Weekly")) + S("Week starts on", "week_start", sel("Monday")) + S("Approver policy", "TimesheetApproverPolicy: PROJECT_OWNER, TEAM_LEAD, MANAGER, SPECIFIC_MEMBER", sel("Team lead")) + S("Default approver", "default_approver_membership_id · used for SPECIFIC_MEMBER and as fallback", sel("Anna Meyer", "users")) + S("Lock on approval", "lock_on_approval · changes then need unlock (time.entries.unlock*) with a reason", sw(1)) + S("Allow self-approval", "allow_self_approval · only for owners of a one-person team", sw(0)), 1)) +
      pane("c", 0, cd("<b>Capture</b>", S("Idle timeout", "idle_timeout_minutes · timer asks what to do with idle time", box("15 min")) + S("Auto-stop long timers", "timer_auto_stop_hours · stops a forgotten timer and notifies", box("10 h")) + S("Calendar capture", "calendar_capture_enabled · suggestions from 19", sw(1)) + S("AI suggestions", "ai_suggestions_enabled · needs the OpenAI connection of the organization", sw(0)) + S("Pre-fill from attendance", "attendance_prefill_enabled · a hint from 10, never creates entries", sw(1)), 1)) +
      pane("t", 0, cd("<b>Activity types</b><span class='r'>" + btn("New type", "plus", "sm") + "</span>", ACT.map((a, i) => '<div class="rowx"><span class="muted">☰</span><span class="badge ' + ["blue", "purple", "yellow", "green", "", "blue", ""][i] + '">' + a + '</span><div class="grow"><small>' + ["Coding, code review prep", "Design and prototyping", "Meetings and calls", "Customer support", "Admin and planning", "Reviews and QA", "Planning and coordination"][i] + "</small></div>" + (i === 0 ? '<span class="badge">Default</span>' : "") + "<span class=\"muted\">" + (i === 2 || i === 4 ? "Non-billable · " + (i === 2 ? "Overhead" : "Admin") : "Billable") + "</span>" + more + "</div>").join("") + '<div class="sub-note" style="padding:10px 16px">Fields: name, slug, description, color, icon, default_billable, default_non_billable_category, is_default, sort_order, archived_at. Archived types stay on old entries.</div>', 1)) +
      pane("n", 0, cd("<b>Reminders</b>", S("Missing-time reminder", "missing_time_reminder_enabled · sent through 14", sw(1)) + S("Days", "missing_time_reminder_days", '<div class="rowx" style="padding:0;gap:6px">' + ["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => '<span class="seg on">' + d + "</span>").join("") + "</div>") + S("Time", "missing_time_reminder_time", box("17:00")) + S("Unsubmitted timesheet reminder", "submission_reminder_enabled", sw(1)) + S("Days after period end", "submission_reminder_offset_days", box("1 day")), 1)) +
      pane("u", 0, cd("<b>Utilization and reporting</b>", S("Expected hours per week", "default_expected_hours_per_week · used when 10 has no working hours", box("40 h")) + S("Utilization target", "utilization_target_percent", box("75 %")) + S("Count billable time only", "utilization_billable_only", sw(0)) + S("Reporting currency", "reporting_currency · converts mixed-currency totals", sel("EUR")), 1)) + "</div>" +
      dm(["TimeTrackingSettings · all columns", "TimeActivityType · name, slug, description, color, icon, default_billable, default_non_billable_category, is_default, sort_order, archived_at"], []) + "</div>";
  }

  const MAP = { timer, week, day, entries, create, entry, team, approvals, sheet, suggestions, rates, rateNew, projects, projectEdit, reports, unbilled, io, settings };
  const CRUMB = { entry: "Entry a063d5", sheet: "Marco Silva · Nov 2 – Nov 8", rateNew: "New rate", projectEdit: "Acme Rebrand Website", create: "Add entry" };
  window.VIEWS.time = { html: function (s) { return (MAP[s || "timer"] || MAP.timer)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
