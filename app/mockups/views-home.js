/* =====================================================================================================================
   HOME APP — personal start page (no module of its own; aggregates what the caller may see)
   =====================================================================================================================
   There is NO Home table and NO ModuleKey. Every widget is a read-only summary fetched from the module that owns the data, filtered by the caller's permissions, branch/team/project scope and active branch context:
   Tasks (06), Projects (05), Calendar (19), Time (18), Notifications (14), Messaging (12), Support (13), CRM (02), Approvals (proposals 03, contracts 04, finance 08, leave 10, time 18, deliverables 05),
   Favorites (ProjectFavorite 05, WikiPageFavorite 15, DocumentFavorite 17) and Recent (audit/view logs of each module).
   A widget the caller cannot read is NOT rendered (not greyed out). The arrangement of widgets is stored per person in UserPreference.dashboard_layout (module 01).
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, head, btn, cd, stat, who, kv, muted, callout, dm } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const link = (t) => '<a style="text-decoration:underline;color:var(--body)">' + t + "</a>";
  const row = (t, s, r) => '<div class="rowx"><div class="grow"><b>' + t + "</b>" + (s ? "<small>" + s + "</small>" : "") + "</div>" + (r || "") + "</div>";

  /* =====================================================================================================================
     HOME OVERVIEW
     @route  /home (default after sign in)
     @perm   none to open; each widget needs the read key of its module (tasks.tasks.read, calendar.events.read_own, time.entries.read_own, notifications.preferences.manage_own, ...)
     @api    GET /home/summary?widgets=my_tasks,approvals,agenda,notifications,projects,time,messages,support (one aggregate call that fans out to module services with the caller's credentials)
     @mcp    home_summary (read-only)
     @data   read-only: Task, Project, CalendarEvent, TimeEntry/Timer, Notification, Channel/Message (unread), Ticket/SupportConversation (assigned), CrmActivity (follow-ups), every approval queue; UserPreference.dashboard_layout
     @ui     Card grid (drag to reorder in edit mode), Table, Badge, Progress, Avatar
     @states loading per widget · empty per widget (friendly, with the action that fills it) · error per widget · module disabled/no access: widget hidden
     @audit  none (read-only); layout change is a UserPreference update
     @note   Approvals is ONE inbox over many owners: each row shows the source module and links to its own approve screen; approving happens in the owning module with its own permission (for example
             finance.invoices.approve, contracts.contracts.approve), never from Home alone. The agenda is read-only calendar data (19). "Time today" reads the running Timer and today's entries (18).
     ===================================================================================================================== */
  function overview() {
    return '<div class="a-page">' + head("Good morning, Petros", "Tuesday, Nov 11 · you have 4 things that need you.", btn("Customize", "settings") + btn("New task", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Tasks due today", 3, "2 overdue", 1) + stat("Approvals waiting", 4, "across 3 modules") + stat("Meetings today", 2, "next at 10:30") + stat("Unread", 7, "notifications · 3 mentions") + stat("Time today", "3.5 h", "timer running") + "</div>" +
      '<div class="g2">' +
      cd("<b>Needs your approval</b><span class='r muted'>owned by each module</span>", row("Invoice INV-2026-0188 · Acme Corp", "Finance · " + E("PENDING_APPROVAL", "yellow"), btn("Review", "", "sm")) + row("Contract CTR-2026-0021 · Initech maintenance", "Contracts · " + E("APPROVAL_REQUIRED", "yellow"), btn("Review", "", "sm")) + row("Leave request · Kim Lund · Dec 22–Jan 2", "People · " + E("PENDING", "yellow"), btn("Review", "", "sm")) + row("Timesheet · Marco Silva · week 45", "Time · " + E("SUBMITTED", "blue"), btn("Review", "", "sm")), 1) +
      cd("<b>My tasks</b><span class='r muted'>due soon</span>", row("WEB-139 · Stripe webhook retries failing", "Urgent · In review · Nov 12", E("URGENT", "red")) + row("WEB-142 · Rebuild pricing page hero", "High · In progress · Nov 14", E("HIGH", "yellow")) + row("MOB-87 · Offline mode for task sync", "Medium · In progress · Nov 20") + row("WEB-148 · VAT number validation", "Medium · Todo · Nov 19"), 1) +
      cd("<b>Today</b><span class='r muted'>Calendar</span>", row("Design review · Acme Rebrand", "10:30 – 11:00 · Meet") + row("Northwind weekly sync", "14:00 – 14:30 · Room Athens") + row("Focus time", "15:00 – 17:00 · Busy"), 1) +
      cd("<b>Notifications</b><span class='r muted'>Notification</span>", row("Anna Meyer mentioned you in #acme-rebrand", "12 min ago") + row("Ticket TCK-2041 was assigned to you", "1 h ago") + row("Milestone “Beta release” moved to Nov 24", "Yesterday") + "<div style='padding:8px 0'>" + link("Open all notifications") + "</div>", 1) +
      cd("<b>Projects I own</b><span class='r muted'>health</span>", row("Mobile App v2", "Beta release in 6 days", E("AT_RISK", "yellow")) + row("Acme Rebrand Website", "On track · 72%", E("HEALTHY", "green")), 1) +
      cd("<b>Follow-ups</b><span class='r muted'>CRM</span>", row("Call Lena Kovac · Acme redesign deal", "Today") + row("Send revised proposal · Wayne Enterprises", "Tomorrow"), 1) +
      "</div>" +
      dm(["No tables of its own. Read-only summaries from: Task, Project, CalendarEvent, TimeEntry, Notification, Message, Ticket, CrmActivity and the approval queues of modules 03, 04, 05, 08, 10, 18", "UserPreference.dashboard_layout (widget arrangement per person)"], []) + "</div>";
  }

  /* =====================================================================================================================
     MY WORK
     @route  /home/my-work?tab=tasks|reviews|approvals|followups
     @perm   each tab needs the read key of its module; hidden tabs when missing
     @api    GET /home/my-work?kind=tasks|reviews|approvals|followups&cursor=
     @data   read-only: Task (assignee me or TaskAssignee), review requests (ProposalApproval, ContractApproval, ProjectGate, ProjectDeliverableReview), CrmActivity (owner me, open), Ticket (assignee me)
     @states loading · empty ("Nothing waiting for you") · error · no-access per tab
     @note   A single queue of things waiting on the person, sorted by due date, with the source module as a column. Items disappear when they are done in their own module.
     ===================================================================================================================== */
  function myWork() {
    const R = [["WEB-139 Stripe webhook retries failing", "Task", "Nov 12", E("URGENT", "red")], ["Approve invoice INV-2026-0188", "Finance", "Nov 12", E("PENDING_APPROVAL", "yellow")], ["Review proposal PRO-2026-0102 v2", "Proposals", "Nov 13", E("IN_REVIEW", "blue")], ["Sign off gate “QA sign-off” · Mobile App v2", "Projects", "Nov 14", E("PENDING", "yellow")], ["Reply to TCK-2041 Acme CSV export", "Support", "Nov 14", E("OPEN", "blue")], ["Call Lena Kovac", "CRM", "Nov 11", E("TODO")]];
    return '<div class="a-page">' + head("My work", "Everything waiting on you, across modules.", "") +
      '<div class="toolbar">' + U.search("Search my work") + U.sel("Module: All") + U.sel("Due: Any", "calendar") + "</div>" +
      '<div class="panel" style="margin-top:0"><table><thead><tr><th>Item</th><th>From</th><th>Due</th><th>State</th></tr></thead><tbody>' + R.map((r) => "<tr><td class='ink'>" + r[0] + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td><td>" + r[3] + "</td></tr>").join("") + "</tbody></table></div>" +
      dm(["Read-only: Task · ProposalApproval · ContractApproval · ProjectGate · ProjectDeliverableReview · CrmActivity · Ticket"], []) + "</div>";
  }

  /* =====================================================================================================================
     FAVORITES & RECENT
     @route  /home/favorites · /home/recent
     @perm   none beyond the read key of each item (items the caller can no longer see are dropped)
     @api    GET /home/favorites · GET /home/recent?limit=50
     @data   read-only: ProjectFavorite (05), WikiPageFavorite (15), DocumentFavorite (17); Recent comes from each module's own view log and audit events for the caller
     @states loading · empty · error
     @note   Favorites are owned by the module that stores them; Home only lists them. Recent is per person, never visible to others.
     @gap    There is no single table for "recently viewed" across modules; Recent is assembled from audit events (see gaps-home.md).
     ===================================================================================================================== */
  function favorites() {
    return '<div class="a-page">' + head("Favorites & recent", "Pinned items and what you opened lately.", "") +
      '<div class="g2">' + cd("<b>Favorites</b>", row("Mobile App v2", "Project · ProjectFavorite") + row("Release runbook", "Wiki page · WikiPageFavorite") + row("Brand guidelines.pdf", "Document · DocumentFavorite"), 1) +
      cd("<b>Recent</b>", row("WEB-142 Rebuild pricing page hero", "Task · 12 min ago") + row("INV-2026-0188", "Invoice · 1 h ago") + row("Acme Corp", "Company · yesterday") + row("CTR-2026-0014", "Contract · yesterday"), 1) + "</div>" +
      dm(["Read-only: ProjectFavorite · WikiPageFavorite · DocumentFavorite · audit_events (recent)"], ["No cross-module recently-viewed table (see gaps-home.md)"]) + "</div>";
  }

  const MAP = { overview, "my-work": myWork, favorites };
  window.VIEWS.home = { html: function (s) { return (MAP[s || "overview"] || MAP.overview)(s); }, crumb: function () { return ""; }, fill: false };
})();
