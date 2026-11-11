/* =====================================================================================================================
   CALENDAR APP — module 19 (docs/features/19-calendar.md). Scheduling layer: events, availability, booking links, external sync.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: CalendarEventType, CalendarPreference, Calendar, CalendarShare, CalendarResource, CalendarEvent, CalendarEventAttendee, CalendarEventResource, CalendarEventReminder,
   CalendarEventLink, CalendarEventAttachment, CalendarAvailabilitySchedule/Rule/Override, BookingLink, BookingLinkHost, CalendarBooking, CalendarConnection, CalendarConnectionCalendar, CalendarEventSyncMapping,
   CalendarSyncRun, CalendarConferencingAccount. Real enums: CalendarKind (PERSONAL, TEAM, PROJECT, CUSTOMER, BRANCH, ORGANIZATION, RESOURCE, EXTERNAL), CalendarResourceKind (ROOM, EQUIPMENT, VEHICLE, OTHER),
   CalendarShareRole (FREE_BUSY, READ, WRITE, MANAGE), CalendarEventStatus (TENTATIVE, CONFIRMED, CANCELLED), CalendarEventVisibility (PRIVATE, TEAM, ORGANIZATION, CUSTOMER_VISIBLE), CalendarEventSource (INTERNAL,
   SYNCED, BOOKING, API), CalendarAttendeeKind (MEMBER, PORTAL_USER, CONTACT, EXTERNAL), CalendarAttendeeRole (REQUIRED, OPTIONAL, INFORMATIONAL), CalendarAttendeeResponse (NEEDS_ACTION, ACCEPTED, TENTATIVE, DECLINED),
   CalendarResourceBookingStatus (REQUESTED, APPROVED, DECLINED, CANCELLED), CalendarReminderMethod (NOTIFICATION, EMAIL, SMS, PUSH), CalendarAvailabilityOverrideKind (UNAVAILABLE, AVAILABLE), BookingLinkStatus
   (DRAFT, ACTIVE, PAUSED, ARCHIVED), BookingHostAssignment (SINGLE, ROUND_ROBIN, COLLECTIVE), BookingLinkAudience (PUBLIC, PORTAL, INTERNAL), CalendarBookingStatus (PENDING, CONFIRMED, RESCHEDULED, CANCELLED,
   NO_SHOW, COMPLETED), CalendarBookingSource (PUBLIC_LINK, PORTAL, INTERNAL, API), CalendarProvider (GOOGLE, MICROSOFT), CalendarConnectionStatus (PENDING_AUTH, ACTIVE, PAUSED, ERROR, DISCONNECTED), CalendarSyncDirection
   (TWO_WAY, PULL_ONLY, PUSH_ONLY), CalendarSyncMappingStatus (SYNCED, PENDING_PUSH, PENDING_PULL, CONFLICT, FAILED, DELETED_REMOTELY), CalendarSyncRunStatus (RUNNING, SUCCEEDED, PARTIAL, FAILED), ConferencingProvider
   (GOOGLE_MEET, MICROSOFT_TEAMS, ZOOM, CUSTOM), ConferencingAccountStatus (ACTIVE, ERROR, DISCONNECTED).
   Permission keys (real catalog): calendar.events.read_own · calendar.events.read · calendar.events.create · calendar.events.update_own · calendar.events.delete_own · calendar.events.manage · calendar.calendars.read_team ·
   calendar.calendars.manage · calendar.availability.read / manage · calendar.event_types.manage · calendar.conferencing.manage* · calendar.bookings.read / manage · calendar.sync.manage_own / manage* · calendar.booking_links.manage · calendar.resources.manage.
   calendar.events.read = view every event the member can reach through scope, calendar sharing or free/busy; calendar.events.read_own = only events they organize or attend.
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - MODULES OWN THEIR DATES, CALENDAR OWNS EVENTS. Milestone dates (05), task due dates (06), contract renewals (04) and leave (10) are PROJECTED read-only items (dashed outline, module icon). Editing one opens the source
       record; a projected item inherits the permission of its source record. Which modules are projected is CalendarPreference.projected_modules.
     - A Calendar has exactly ONE scope column set according to kind: PERSONAL owner_membership_id, TEAM team_id, PROJECT project_id, CUSTOMER company_id, BRANCH branch_id, RESOURCE resource_id, ORGANIZATION and EXTERNAL none
       (EXTERNAL is fed by a CalendarConnectionCalendar). Colour comes from Calendar.color (an event may override it with CalendarEvent.color); overlays are CalendarPreference.overlay_calendar_ids.
     - Times are stored in UTC with CalendarEvent.timezone (the zone the organizer chose); the grid renders in the viewer's zone (CalendarPreference.timezone, else Membership/branch zone). All-day events have no zone shift.
     - RECURRENCE: the master row carries recurrence_rule (RFC 5545 RRULE), recurrence_exdates and recurrence_ends_at. An edited or cancelled occurrence is a CHILD row (recurring_event_id + original_start_at). Edit and delete
       always ask "This event / This and following / All events".
     - ATTENDEES: exactly one identity per row, by kind: MEMBER membership_id, PORTAL_USER user_id, CONTACT contact_id, EXTERNAL email only. RSVP = response (+ response_comment, responded_at); external attendees answer
       through response_token links in the invitation email. Declined events are hidden unless CalendarPreference.show_declined_events.
     - VISIBILITY: PRIVATE (only organizer and attendees see details, others see "Busy"), TEAM, ORGANIZATION, CUSTOMER_VISIBLE (also in the Customer Portal, 07). Calendar.free_busy_only and CalendarShare.role FREE_BUSY hide
       titles. External (SYNCED) event content is never exposed beyond free/busy unless its owner shares the calendar. Enforced on the server, never only in the UI.
     - AVAILABILITY = working hours (01 §121) + branch holidays (BranchHoliday / CompanyHoliday, owned by 01/10) + leave (EmployeeAvailabilityEntry, 10) + events with shows_as_busy, narrowed by the member's
       CalendarAvailabilitySchedule. Resource conflicts are checked against APPROVED CalendarEventResource rows only.
     - Every state-changing action emits webhook/automation events: calendar.event_created, calendar.event_updated, calendar.event_cancelled, calendar.attendee_responded, calendar.booking_created (spec §12), and writes
       audit_events (event create/change, attendee change, cancellation, sync overwrite, calendar sharing).
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const en = U.en;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const gap = (h) => '<div style="height:' + (h || 12) + 'px"></div>';
  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"] };
  const av = (a) => AV(a, (PEOPLE[a] || ["", ""])[1]);
  const wh = (a, s) => who(a, PEOPLE[a][1], PEOPLE[a][0], s || "");
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const prop = (k, v) => '<div class="kvr"><span>' + k + "</span><b>" + v + "</b></div>";
  const rowx = (main, sub, right) => '<div class="rowx"><div class="grow"><b>' + main + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</div>" + (right || "") + "</div>";
  const segs = (arr, on) => '<div class="rowx" style="gap:8px;padding:0;flex-wrap:wrap">' + arr.map((t, i) => '<span class="seg' + (i === (on || 0) ? " on" : "") + '">' + t + "</span>").join("") + "</div>";
  const two = (a, b) => '<div class="rowx" style="gap:8px;padding:0">' + a + b + "</div>";
  const chip = (f1, o, v) => '<span class="fchip"><b>' + f1 + "</b><i>" + o + "</i><span>" + v + "</span>" + I("x", 12) + "</span>";
  const fbar = (chips, extra) => '<div class="fbar"><div class="fchips">' + chips.map((c) => chip(c[0], c[1], c[2])).join("") + '<button class="btn sm ghost">' + I("plus", 13) + ' Add filter</button></div><div class="fright">' + (extra || "") + "</div></div>";
  const RSVP = { ACCEPTED: "green", TENTATIVE: "yellow", DECLINED: "red", NEEDS_ACTION: "" };
  const kb = (k) => '<span class="key">' + k + "</span>";

  /* ---------- sample data ---------- */
  /* @impl Calendar rows the signed-in member can see: own PERSONAL calendar, calendars shared with them (CalendarShare) and the ones their role/scope allows (calendar.calendars.read_team).
       tone = the semantic colour token of Calendar.color. The palette in the Calendar form is limited to these tokens so every colour works in light and dark. */
  const CALS = [
    ["me", "Anna Meyer", "PERSONAL", "blue"], ["web", "Web team", "TEAM", "green"], ["mob", "Mobile App v2", "PROJECT", "purple"], ["acme", "Acme Corp", "CUSTOMER", "yellow"],
    ["org", "Company", "ORGANIZATION", "red"], ["ath", "Athens office", "BRANCH", "ash"], ["room", "Aegean room", "RESOURCE", "mute"], ["gcal", "anna@logiqdev.com", "EXTERNAL", "ash"],
  ];
  const CAL = {}; CALS.forEach((c) => (CAL[c[0]] = c));
  /* day d = November 2026 day number (Wed Nov 11 = today). s/e = decimal hours. ty = CalendarEventType.slug, rs = my CalendarEventAttendee.response, mt = meeting provider. */
  const EV = [
    { d: 9, s: 9, e: 9.5, t: "Web standup", c: "web", ty: "meeting", who: ["MS", "AM", "SJ"], mt: "Meet", rec: 1 },
    { d: 9, s: 10, e: 11.5, t: "Acme redesign kickoff", c: "acme", ty: "kickoff", who: ["AM", "MS", "SJ"], loc: "Aegean room" },
    { d: 9, s: 14, e: 15, t: "Focus: pricing hero", c: "me", ty: "focus-time", who: [], busy: 0 },
    { d: 10, s: 9, e: 9.5, t: "Web standup", c: "web", ty: "meeting", who: ["MS", "AM", "SJ"], mt: "Meet", rec: 1 },
    { d: 10, s: 11, e: 12, t: "Sprint planning", c: "mob", ty: "meeting", who: ["JK", "KL", "SJ", "AM"], mt: "Meet" },
    { d: 10, s: 13, e: 14, t: "Interview: frontend dev", c: "org", ty: "interview", who: ["AM"], loc: "Athens office" },
    { d: 10, s: 16, e: 17, t: "Design review", c: "web", ty: "review", who: ["MS", "SJ"], st: "TENTATIVE" },
    { d: 11, s: 9, e: 9.5, t: "Web standup", c: "web", ty: "meeting", who: ["MS", "AM", "SJ"], mt: "Meet", rec: 1 },
    { d: 11, s: 10, e: 11, t: "Acme weekly sync", c: "acme", ty: "customer-meeting", who: ["AM", "MS"], mt: "Zoom", rec: 1 },
    { d: 11, s: 10.5, e: 11.5, t: "Stripe migration check-in", c: "web", ty: "meeting", who: ["AM", "SJ"], mt: "Meet" },
    { d: 11, s: 12.5, e: 13.5, t: "Team lunch", c: "ath", ty: "meeting", who: ["MS", "AM", "SJ", "JK"], loc: "Athens office" },
    { d: 11, s: 14, e: 15.5, t: "Pricing page review with Lena Kovac", c: "acme", ty: "customer-meeting", who: ["AM", "MS", "SJ"], mt: "Meet", loc: "Aegean room", sel: 1 },
    { d: 11, s: 15, e: 16, t: "1:1 Anna and Marco", c: "me", ty: "meeting", who: ["MS"], rec: 1 },
    { d: 11, s: 17, e: 17.5, t: "Beta go/no-go", c: "mob", ty: "review", who: ["JK", "KL", "AM"], rs: "NEEDS_ACTION" },
    { d: 12, s: 9, e: 9.5, t: "Web standup", c: "web", ty: "meeting", who: ["MS", "AM", "SJ"], mt: "Meet", rec: 1 },
    { d: 12, s: 11, e: 12, t: "Mobile v2 demo", c: "mob", ty: "review", who: ["JK", "KL", "SJ"], mt: "Teams" },
    { d: 12, s: 13, e: 13.75, t: "Discovery call: Peter Novak", c: "me", ty: "booking", who: [], mt: "Meet", src: "BOOKING" },
    { d: 12, s: 15, e: 17, t: "Focus time", c: "me", ty: "focus-time", who: [], busy: 0 },
    { d: 13, s: 9, e: 9.5, t: "Web standup", c: "web", ty: "meeting", who: ["MS", "AM", "SJ"], mt: "Meet", rec: 1 },
    { d: 13, s: 10, e: 11, t: "All-hands", c: "org", ty: "meeting", who: ["AM", "MS", "SJ", "JK", "KL"], mt: "Meet" },
    { d: 13, s: 14, e: 15, t: "Contract review: Globex MSA", c: "acme", ty: "review", who: ["AM"], rs: "TENTATIVE" },
    { d: 13, s: 16, e: 16.5, t: "Weekly retro", c: "web", ty: "meeting", who: ["MS", "AM", "SJ"], rec: 1 },
    { d: 13, s: 18, e: 19, t: "Team dinner (cancelled)", c: "ath", ty: "meeting", who: ["MS", "AM"], st: "CANCELLED" },
  ];
  const ALLDAY = [
    { d: 12, t: "Offsite planning", c: "org", ty: "meeting" },
    { d: 14, t: "Athens branch: open day", c: "ath", ty: "meeting" },
  ];
  /* PROJECTED dates (read-only, never CalendarEvent rows): module, icon, label. */
  const PROJ = [
    { d: 11, t: "Milestone: Beta release", m: "05", i: "flag", src: "ProjectMilestone" },
    { d: 12, t: "Contract renewal: Initech", m: "04", i: "pen", src: "Contract" },
    { d: 12, t: "Sofia Jensen on leave", m: "10", i: "people", src: "EmployeeAvailabilityEntry", span: 2 },
    { d: 13, t: "Task due: WEB-139 Stripe webhook retries", m: "06", i: "tasks", src: "Task" },
  ];
  const MX = [[1, "Monthly finance close", "org"], [3, "Brand workshop", "acme"], [4, "Sprint planning", "mob"], [5, "Design crit", "web"], [6, "Interview: PM", "org"], [16, "Cycle 14 ends", "web"], [17, "Acme weekly sync", "acme"], [18, "Mobile app QA day", "mob"],
    [19, "Client demo: Globex", "acme"], [20, "Payroll cut-off", "org"], [23, "Planning week", "web"], [24, "Sprint planning", "mob"], [25, "Quarterly review", "org"], [26, "Beta release", "mob"], [27, "Acme weekly sync", "acme"], [30, "Month close", "org"]];
  const TYPES = [
    ["meeting", "Meeting", 30, "TEAM", 1], ["customer-meeting", "Customer meeting", 45, "CUSTOMER_VISIBLE", 1], ["kickoff", "Kickoff", 90, "TEAM", 1], ["review", "Review", 60, "TEAM", 1], ["interview", "Interview", 60, "PRIVATE", 1],
    ["deadline", "Deadline", 0, "TEAM", 0], ["out-of-office", "Out of office", 0, "ORGANIZATION", 0], ["focus-time", "Focus time", 120, "PRIVATE", 0], ["booking", "Booking", 30, "PRIVATE", 1],
  ];
  const dname = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hh = (h) => { const hr = Math.floor(h), m = Math.round((h - hr) * 60); return hr + ":" + String(m).padStart(2, "0"); };
  const rng = (e) => hh(e.s) + "–" + hh(e.e);

  /* ---------- time grid ---------- */
  const HH = 44, H0 = 7, H1 = 20;
  function lanes(list) {
    list = list.slice().sort((a, b) => a.s - b.s || b.e - a.e);
    const out = []; let cl = [], end = -1;
    const flush = () => { const n = Math.max.apply(null, cl.map((x) => x.l)) + 1; cl.forEach((x) => { x.n = n; out.push(x); }); cl = []; };
    list.forEach((ev) => {
      if (cl.length && ev.s >= end) { flush(); end = -1; }
      const used = cl.filter((x) => x.e > ev.s).map((x) => x.l); let l = 0; while (used.includes(l)) l++;
      cl.push(Object.assign({}, ev, { l })); end = Math.max(end, ev.e);
    });
    if (cl.length) flush();
    return out;
  }
  /* @impl Event block. Position = (start - first visible hour) * hourHeight, height = duration * hourHeight; overlapping events share lanes (columns) so none is hidden. Dashed left border = TENTATIVE,
       struck-through = CANCELLED (only when the "show cancelled" filter is on), "Busy" blocks only for FREE_BUSY shares. Clicking opens the event peek (popover), double click opens the page, drag moves, the bottom edge resizes (both need calendar.events.update_own or WRITE share). */
  function block(ev) {
    const top = (ev.s - H0) * HH, h = Math.max((ev.e - ev.s) * HH - 2, 18);
    const cls = "cal-ev c-" + CAL[ev.c][3] + (ev.st === "TENTATIVE" ? " tent" : "") + (ev.st === "CANCELLED" ? " cx" : "") + (ev.sel ? " sel" : "") + (ev.rs === "NEEDS_ACTION" ? " needs" : "");
    const w = 100 / ev.n;
    const sub = h > 34 ? '<span class="cal-tm">' + rng(ev) + (ev.mt ? " · " + ev.mt : "") + (ev.loc ? " · " + ev.loc : "") + "</span>" : "";
    return '<div class="' + cls + '" title="' + CAL[ev.c][1] + " · " + ev.ty + (ev.st ? " · " + ev.st : "") + '" style="top:' + top + "px;height:" + h + "px;left:calc(" + ev.l * w + "% + 1px);width:calc(" + w + '% - 3px)"><b>' + (ev.rec ? I("clock", 10) + " " : "") + ev.t + "</b>" + sub + "</div>";
  }
  const now = (h) => '<div class="cal-now" style="top:' + (h - H0) * HH + 'px"><i></i></div>';
  /* days = array of Nov day numbers. opts: ghost {d,s,e} drawn as a drag-selection, wide = single column (day view). */
  function grid(days, o) {
    o = o || {};
    const n = days.length, hrs = H1 - H0;
    const gh = '<div class="cal-gh" style="--n:' + n + '"><div></div>' + days.map((d, i) => { const wd = (d - 9 + 7) % 7; return '<div class="' + (d === 11 ? "today" : "") + '"><small>' + dname[wd] + '</small><b class="dn">' + d + "</b></div>"; }).join("") + "</div>";
    const ad = '<div class="cal-ad" style="--n:' + n + '"><div class="lb">all day</div>' + days.map((d) => {
      const a = ALLDAY.filter((x) => x.d === d).map((x) => '<span class="cal-chip c-' + CAL[x.c][3] + '"><i></i>' + x.t + "</span>").join("");
      const p = PROJ.filter((x) => x.d === d || (x.span && d > x.d && d < x.d + x.span)).map((x) => '<span class="cal-chip proj" title="Projected from ' + x.src + " (" + x.m + '), read-only">' + I(x.i, 11) + x.t + "</span>").join("");
      return "<div>" + a + p + "</div>";
    }).join("") + "</div>";
    const gut = '<div class="cal-gut">' + Array.from({ length: hrs }, (_, i) => '<div style="height:' + HH + 'px"><span>' + (i === 0 ? "" : String(H0 + i).padStart(2, "0") + ":00") + "</span></div>").join("") + "</div>";
    const cols = days.map((d) => {
      const wd = (d - 9 + 7) % 7, evs = lanes(EV.filter((x) => x.d === d && !(x.st === "CANCELLED" && !o.cancelled)));
      return '<div class="cal-col' + (d === 11 ? " today" : "") + (wd > 4 ? " wkend" : "") + '">' + evs.map(block).join("") + (d === 11 ? now(11.33) : "") + (o.ghost && o.ghost.d === d ? '<div class="cal-ev ghost" style="top:' + (o.ghost.s - H0) * HH + "px;height:" + (o.ghost.e - o.ghost.s) * HH + 'px;left:2px;right:2px"><b>(No title)</b><span class="cal-tm">' + rng(o.ghost) + "</span></div>" : "") + "</div>";
    }).join("");
    return '<div class="cal-grid' + (o.wide ? " wide" : "") + '" style="--hh:' + HH + "px;--hrs:" + hrs + '">' + gh + ad + '<div class="cal-body" style="--n:' + n + '">' + gut + cols + "</div></div>";
  }

  /* ---------- left side of the calendar pages: mini month, calendars overlay, projected modules ---------- */
  function side(sel2) {
    const cells = []; for (let d = -5; d <= 36; d++) cells.push(d);
    const mini = '<div class="cal-mini"><div class="cal-mh"><b>November 2026</b><span>' + I("down", 12) + "</span></div><div class=\"cal-mg\">" + "MTWTFSS".split("").map((x) => "<small>" + x + "</small>").join("") + cells.map((d) => {
      const dt = new Date(2026, 10, d), inM = dt.getMonth() === 10;
      return '<span class="' + (inM ? "" : "out ") + (d === 11 ? "today " : "") + (sel2 && d >= 9 && d <= 15 ? "wk" : "") + '">' + dt.getDate() + "</span>";
    }).join("") + "</div></div>";
    const cl = (arr) => arr.map((c) => '<div class="cal-li">' + cb(1) + '<i class="sw-c c-' + c[3] + '"></i><span class="grow" title="CalendarKind ' + c[2] + '">' + c[1] + "</span><small>" + en(c[2]) + "</small></div>").join("");
    return '<div class="cal-side">' + mini +
      '<div class="cal-sec"><h6>My calendars</h6>' + cl(CALS.slice(0, 1)) + "</div>" +
      '<div class="cal-sec"><h6>Shared with me <span class="muted">overlay_calendar_ids</span></h6>' + cl(CALS.slice(1, 6)) + "</div>" +
      '<div class="cal-sec"><h6>Resources and external</h6>' + cl(CALS.slice(6)) + "</div>" +
      '<div class="cal-sec"><h6>Projected dates <span class="muted">projected_modules</span></h6>' + [["Milestones (05)", "flag", 1], ["Task due dates (06)", "tasks", 1], ["Contract dates (04)", "pen", 1], ["Leave and holidays (10)", "people", 1], ["Invoice due dates (08)", "receipt", 0]].map((x) => '<div class="cal-li">' + cb(x[2]) + '<span class="cal-pi">' + I(x[1], 12) + '</span><span class="grow">' + x[0] + "</span></div>").join("") + "</div>" +
      '<div class="cal-sec"><h6>Display</h6><div class="cal-li"><span class="grow">Show weekends</span>' + sw(1) + '</div><div class="cal-li"><span class="grow">Show declined events</span>' + sw(0) + "</div></div></div>";
  }
  const range = { week: "Nov 9 – 15, 2026", day: "Wednesday, Nov 11, 2026", month: "November 2026", agenda: "Nov 11 – Nov 25, 2026" };
  function toolbar(view) {
    return '<div class="cal-tb"><div class="rowx" style="gap:6px;padding:0">' + btn("Today") + '<button class="btn ghost sm icon">' + I("down", 14).replace("<svg", '<svg style="transform:rotate(90deg)"') + '</button><button class="btn ghost sm icon">' + I("down", 14).replace("<svg", '<svg style="transform:rotate(-90deg)"') + '</button><b class="cal-range">' + range[view] + "</b>" + muted("GMT+2 · Athens") + "</div>" +
      '<div class="rowx" style="gap:8px;padding:0">' + sel("Views: My week", "star") + '<div class="rowx" style="gap:0;padding:0">' + ["Day", "Week", "Month", "Agenda"].map((v) => '<span class="seg' + (v.toLowerCase() === view ? " on" : "") + '">' + v + "</span>").join("") + "</div></div></div>";
  }
  const FILTERS = [["Calendar", "is any of", "Anna Meyer, Web team, Mobile App v2, Acme Corp"], ["Event type", "is any of", "All types"], ["Attendee", "is", "Anyone"], ["Project", "is", "Any project"], ["Status", "is not", "Cancelled"]];
  function shell(view, inner, extra) {
    return '<div class="a-page cal-page">' + head("Calendar", "Your schedule across calendars, with dates projected from Projects, Tasks, Contracts and Employees.", btn("Booking links", "link") + btn("New event", "plus", "primary")) +
      toolbar(view) + fbar(FILTERS, btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="cal-wrap">' + side(view === "week") + "<div>" + inner + "</div></div>" + (extra || "") + "</div>";
  }
  const dmView = () => dm(["CalendarEvent · calendar_id, event_type_id, title, status, starts_at, ends_at, all_day, timezone, recurrence_rule, recurrence_exdates, recurring_event_id, visibility, shows_as_busy, location, meeting_url, color, source",
    "Calendar · kind, name, color, timezone, free_busy_only, sort_order, archived_at · CalendarShare · role · CalendarPreference · default_view, week_start, show_weekends, show_declined_events, overlay_calendar_ids, projected_modules",
    "CalendarEventType · name, slug, color, icon, shows_as_busy · CalendarEventAttendee · response (my RSVP badge, NEEDS_ACTION ring)",
    "Projected read-only: ProjectMilestone (05) · Task.due_date (06) · Contract dates (04) · EmployeeAvailabilityEntry / LeaveRequest (10) · BranchHoliday, CompanyHoliday"], ["SavedView (entity_type CALENDAR_EVENT): layout is one of day, week, month, agenda; filters hold calendar_ids, event_type_ids, projected_modules, statuses (validated by the API, no schema change)"]);

  /* =====================================================================================================================
     WEEK VIEW (spec §5, §13 MVP)
     @screen Calendar > Week
     @route  /calendar/week?date=2026-11-11&calendars=&type=&attendee=&project=&view=<savedViewId> (also /calendar = the member's default_view)
     @perm   VIEW calendar.events.read_own (own events and calendars shared with the member) · other members' or team calendars calendar.calendars.read_team · all visible events calendar.events.read ·
             create by drag calendar.events.create · move/resize calendar.events.update_own (or a WRITE/MANAGE CalendarShare) · delete calendar.events.delete_own
     @api    GET /calendar/events?from=2026-11-09T00:00Z&to=2026-11-16T00:00Z&calendar_id[]=&event_type_id[]=&attendee=&project_id=&status!=CANCELLED (recurring series expanded server-side into occurrences) ·
             GET /calendar/projected?from=&to=&modules=PROJECTS,TASKS,CONTRACTS,EMPLOYEES · PATCH /calendar/events/:id {starts_at, ends_at, scope: THIS|FOLLOWING|ALL} · GET/PUT /calendar/preferences
     @mcp    calendar_events_read (range + filters) · calendar_events_create · calendar_events_update · calendar_availability_read
     @data   CalendarEvent · Calendar · CalendarEventType · CalendarEventAttendee (my response) · CalendarPreference · SavedView (entity_type CALENDAR_EVENT) · projected: ProjectMilestone, Task, Contract, EmployeeAvailabilityEntry
     @ui     Custom time grid (react-big-calendar or FullCalendar timeGrid, themed with tokens; drag and resize), shadcn Popover for the event peek and quick create, Checkbox list for overlays, ToggleGroup for the view switch,
             Popover+Command filter pickers, Select for saved views, Tooltip on truncated titles
     @states loading skeleton grid · empty week (grid with "Nothing scheduled, press C to create") · error with retry · no-access (module not enabled / missing calendar.events.read_own) · partial (a shared calendar failed to load:
             banner naming it) · offline (cached week, read-only)
     @audit  moving/resizing writes calendar.event_updated with old and new times; attendees are re-notified (14) and CalendarEvent.sequence is incremented
     @note   Today column is tinted, the red line is "now". Events are coloured by calendar (the sidebar swatch). A pulsing left bar = the viewer still has to answer (response NEEDS_ACTION). Weekend columns follow
             CalendarPreference.show_weekends. Keyboard: t today, j/k next/previous period, d/w/m/a switch view, c create, / search. Hours outside the member's working hours are shaded lighter.
     ===================================================================================================================== */
  function week() {
    return shell("week", grid([9, 10, 11, 12, 13, 14, 15]) + '<div class="cal-legend">' + [["solid", "Confirmed"], ["dash", "Tentative (CalendarEventStatus TENTATIVE)"], ["ring", "You have not answered (NEEDS_ACTION)"], ["proj", "Projected from another module, read-only"]].map((x) => '<span><i class="cal-lg ' + x[0] + '"></i>' + x[1] + "</span>").join("") + "</div>") + "";
  }

  /* =====================================================================================================================
     DAY VIEW (spec §5)
     @screen Calendar > Day
     @route  /calendar/day?date=2026-11-11
     @perm   same as the week view
     @api    GET /calendar/events?from=&to= (one day) · GET /calendar/availability/suggest?attendees=&duration= (right panel)
     @mcp    calendar_events_read · calendar_availability_read
     @data   CalendarEvent · CalendarEventAttendee · CalendarAvailabilitySchedule (working hours shading) · BranchHoliday / CompanyHoliday · EmployeeAvailabilityEntry
     @ui     Same time grid with a single wide column; right rail = shadcn Card list ("Today", "Needs your answer", "Conflicts")
     @states loading · empty day · error · no-access · day is a holiday banner (CompanyHoliday)
     @note   Day view surfaces conflicts: two CONFIRMED events that overlap for the same attendee are flagged with a red marker and listed in the rail (10:30 Stripe check-in overlaps Acme weekly sync).
     ===================================================================================================================== */
  function day() {
    const rail = '<div>' + cd("<b>Needs your answer</b><span class='r muted'>NEEDS_ACTION</span>", rowx("Beta go/no-go", "17:00–17:30 · Jonas Koch", btn("Yes", "check", "sm") + btn("No", "x", "sm")) + rowx("Roadmap sync", "Thu 14:00 · Kim Lund", btn("Yes", "check", "sm") + btn("No", "x", "sm")), 1) +
      gap(10) + cd("<b>Conflicts</b><span class='r'>" + E("TENTATIVE", "yellow") + "</span>", rowx("10:00–11:00 Acme weekly sync", "overlaps 10:30–11:30 Stripe migration check-in", btn("Resolve", "", "sm")) + rowx("15:00–16:00 1:1 Anna and Marco", "overlaps 14:00–15:30 Pricing page review", btn("Resolve", "", "sm")), 1) +
      gap(10) + cd("<b>Today</b>", rowx("Wed, Nov 11", "9 events · 5 h 30 min in meetings · 2 projected dates") + rowx("Milestone: Beta release", "Mobile App v2 (05)", muted("read-only")) + rowx("Working hours", "09:00–17:30 · Athens (EET)")) + "</div>";
    return shell("day", '<div class="cal-dayw">' + grid([11], { wide: 1 }) + rail + "</div>");
  }

  /* =====================================================================================================================
     MONTH VIEW (spec §5, §13 MVP)
     @screen Calendar > Month
     @route  /calendar/month?date=2026-11
     @perm   same as the week view
     @api    GET /calendar/events?from=2026-10-26&to=2026-12-07&… (6-week window) · GET /calendar/projected?…
     @mcp    calendar_events_read
     @data   same as week plus BranchHoliday / CompanyHoliday (day cell badge)
     @ui     Month grid, "+N more" opens a shadcn Popover with the day list; click a day = quick create, double click = day view
     @states loading · empty month · error · no-access
     @note   Each cell shows at most 3 chips (time + title); the rest collapse into "+N more". Projected dates use the dashed chip with the module icon. Holidays tint the cell and carry a name badge.
     ===================================================================================================================== */
  function month() {
    const cells = [];
    for (let d = -5; d <= 36; d++) {
      const dt = new Date(2026, 10, d), inM = dt.getMonth() === 10, wd = (dt.getDay() + 6) % 7;
      const evs = (inM ? EV.filter((x) => x.d === d && x.st !== "CANCELLED").map((x) => ({ s: x.s, t: x.t, c: x.c, h: hh(x.s) })) : [])
        .concat(inM ? MX.filter((x) => x[0] === d).map((x) => ({ s: 8, t: x[1], c: x[2], h: "" })) : []).sort((a, b) => a.s - b.s);
      const pj = inM ? PROJ.filter((x) => x.d === d) : [];
      const hol = d === 28 ? "Thanksgiving (US)" : d === -5 ? "Ochi Day" : "";
      const shown = evs.slice(0, pj.length ? 2 : 3), rest = evs.length - shown.length;
      cells.push('<div class="cal-cell' + (inM ? "" : " out") + (d === 11 ? " today" : "") + (wd > 4 ? " wkend" : "") + (hol ? " hol" : "") + '"><div class="ch"><span class="dn">' + dt.getDate() + "</span>" + (hol ? '<small class="hl">' + hol + "</small>" : "") + "</div>" +
        shown.map((x) => '<div class="cal-chip c-' + CAL[x.c][3] + '"><i></i>' + (x.h ? "<em>" + x.h + "</em>" : "") + x.t + "</div>").join("") +
        pj.map((x) => '<div class="cal-chip proj" title="Projected from ' + x.src + '">' + I(x.i, 11) + x.t + "</div>").join("") + (rest > 0 ? '<div class="cal-more">+' + rest + " more</div>" : "") + "</div>");
    }
    return shell("month", '<div class="cal-month"><div class="cal-mh">' + dname.map((x) => "<div>" + x + "</div>").join("") + '</div><div class="mb">' + cells.join("") + "</div></div>");
  }

  /* =====================================================================================================================
     AGENDA VIEW (spec §5)
     @screen Calendar > Agenda
     @route  /calendar/agenda?from=2026-11-11&days=14
     @perm   same as the week view
     @api    GET /calendar/events?from=&to=&sort=starts_at&cursor= (cursor pagination, grouped by day on the client)
     @mcp    calendar_events_read
     @data   CalendarEvent · CalendarEventAttendee.response · CalendarEventResource.status · projected modules
     @ui     Grouped list (div rows, not a table) with Avatar stack, Badge, DropdownMenu row actions; inline RSVP buttons (ToggleGroup)
     @states loading skeleton · empty ("Nothing in the next 14 days") · error · no-access
     @note   Best view for phones and for scanning. Each row answers: when, what, where/how to join, who, my RSVP. "Join" appears 10 minutes before a meeting with meeting_url.
     ===================================================================================================================== */
  function agenda() {
    const days = [[11, "Wednesday, Nov 11", "Today"], [12, "Thursday, Nov 12", ""], [13, "Friday, Nov 13", ""]];
    const body = days.map((dd) => {
      const evs = EV.filter((x) => x.d === dd[0] && x.st !== "CANCELLED"), pj = PROJ.filter((x) => x.d === dd[0]), ad = ALLDAY.filter((x) => x.d === dd[0]);
      return '<div class="ag-day"><div class="ag-h"><b>' + dd[1] + "</b>" + (dd[2] ? '<span class="badge blue">' + dd[2] + "</span>" : "") + "<small>" + evs.length + " events</small></div>" +
        ad.map((x) => '<div class="ag-row"><span class="cal-tm">All day</span><i class="sw-c c-' + CAL[x.c][3] + '"></i><div class="grow"><b>' + x.t + "</b><small>" + CAL[x.c][1] + "</small></div></div>").join("") +
        pj.map((x) => '<div class="ag-row proj"><span class="cal-tm">All day</span><span class="cal-pi">' + I(x.i, 12) + '</span><div class="grow"><b>' + x.t + "</b><small>Projected from " + x.src + " (" + x.m + ") · read-only</small></div></div>").join("") +
        evs.map((x) => '<div class="ag-row' + (x.sel ? " sel" : "") + '"><span class="cal-tm">' + rng(x) + '</span><i class="sw-c c-' + CAL[x.c][3] + '"></i><div class="grow"><b>' + x.t + "</b>" + (x.rec ? ' <span class="muted">' + I("clock", 11) + " repeats</span>" : "") + "<small>" + CAL[x.c][1] + " · " + en(x.ty) + (x.loc ? " · " + x.loc : "") + (x.mt ? " · " + x.mt : "") + "</small></div>" +
          '<div class="avs">' + x.who.slice(0, 4).map(av).join("") + "</div>" + (x.rs ? E(x.rs, RSVP[x.rs]) : E("ACCEPTED", "green")) + (x.mt ? btn("Join", "video", "sm") : "") + more + "</div>").join("") + "</div>";
    }).join("");
    return shell("agenda", '<div class="panel" style="padding:0;margin-top:0">' + body + '<div class="pager" style="padding:10px 14px"><span class="muted">Showing Nov 11 – Nov 13 · 11 more days</span><span style="flex:1"></span>' + btn("Load more", "", "sm") + "</div></div>");
  }

  /* =====================================================================================================================
     QUICK-CREATE POPOVER (spec §3)
     @screen Calendar > Quick create (design of the popover opened by clicking or dragging on the grid, or pressing C)
     @route  none (Popover anchored to the dragged slot); "More options" navigates to /calendar/events/new with the same values
     @perm   calendar.events.create · attendees must be visible to the caller (users.members.read / crm contacts read for CONTACT attendees) · customer-visible type needs a customer-facing calendar
     @api    POST /calendar/events {calendar_id, event_type_id, title, starts_at, ends_at, all_day, timezone, attendees[], conferencing_provider?, location?, visibility?, reminders[]} (201 returns the event; the API creates the meeting
             link through the CalendarConferencingAccount when asked)
     @mcp    calendar_events_create
     @data   CalendarEvent · CalendarEventAttendee · CalendarEventType (defaults: default_duration_minutes, default_visibility, shows_as_busy, default_reminders) · CalendarPreference (default_calendar_id, default_event_duration)
     @ui     shadcn Popover (not a Dialog), Input, ToggleGroup for the type, Popover+Command combobox for calendar and attendees, DatePicker + time Select, Switch, Button. Enter submits, Esc cancels.
     @states validation (end before start, no title allowed: saves as "(No title)") · saving · created toast with Undo and "Open" · conflict warning inline for the creator ("Marco has Design review at 16:00") · no-write-access calendar disabled in the list
     @audit  calendar.event_created
     @note   A drag on the grid pre-fills start and end (snapped to 15 minutes). Choosing an event type applies its defaults (duration, visibility, busy/free, reminders) without overwriting what the user already typed. The shortest
             path: type a title, press Enter. Everything else lives on the full page.
     ===================================================================================================================== */
  function quick() {
    const pop = '<div class="cal-pop"><div class="ph"><b>New event</b><button class="btn ghost sm icon">' + I("x", 14) + "</button></div>" +
      f("Title", box("Add title")) + f("Type", segs(["Meeting", "Customer meeting", "Focus time", "Out of office"], 0)) +
      f("When", '<div class="input-fake" style="color:var(--ink)">Wed, Nov 11 · 16:00 – 16:30</div>' + '<div class="rowx" style="padding:4px 0 0;gap:8px"><span class="grow muted">All day</span>' + sw(0) + "</div>") +
      f("Calendar", sel("Anna Meyer (personal)", "calendar")) + f("Guests", sel("Add people, contacts or emails", "users"), "Marco Silva is busy 16:00–17:00 (Design review).") +
      '<div class="rowx" style="padding:6px 0"><div class="grow"><b>Add video call</b><small>Google Meet via your connected account</small></div>' + sw(1) + "</div>" +
      '<div class="rowx" style="padding:0;gap:8px;margin-top:6px">' + btn("More options", "", "sm") + '<span style="flex:1"></span>' + btn("Cancel", "", "sm") + btn("Save", "", "primary sm") + "</div></div>";
    return '<div class="a-page cal-page">' + head("Quick create", "Design of the popover that opens when you drag a time range on the week or day grid.", btn("Open full form", "edit")) +
      '<div class="cal-popwrap">' + grid([9, 10, 11, 12, 13], { ghost: { d: 11, s: 16, e: 16.5 } }) + pop + "</div>" +
      '<div class="g2" style="margin-top:14px">' + cd("<b>What the popover applies</b>", prop("Defaults from", "CalendarPreference.default_calendar_id, default_event_duration (30 min)") + prop("Type defaults", "CalendarEventType.default_duration_minutes, default_visibility, shows_as_busy, default_reminders") + prop("Time zone", "CalendarPreference.timezone") + prop("Reminders", "CalendarPreference.default_reminders") + prop("Organizer", "Signed-in member, becomes a CalendarEventAttendee with is_organizer") + prop("Source", E("INTERNAL"))) +
      cd("<b>Keyboard</b>", [["C", "Open quick create at the next free slot"], ["Enter", "Save"], ["Esc", "Cancel"], ["Ctrl+Enter", "Save and open the page"], ["Tab", "Move through fields"]].map((k) => rowx(kb(k[0]), k[1])).join("")) + "</div>" +
      dm(["CalendarEvent · written on create (title, calendar_id, event_type_id, starts_at, ends_at, all_day, timezone, visibility, shows_as_busy, conferencing_provider, meeting_url)", "CalendarEventAttendee · member / contact / external email", "CalendarEventType · defaults", "CalendarPreference · default_calendar_id, default_event_duration, default_reminders", "CalendarConferencingAccount · is_default"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE / EDIT EVENT — full page (spec §3, §4, §6, §9)
     @screen Calendar > New event (the same form edits an event)
     @route  /calendar/events/new?calendar=&date=&start=&end=&type=&from=<entityType>:<id> · edit: /calendar/events/:id/edit?scope=THIS|FOLLOWING|ALL
     @perm   calendar.events.create · edit calendar.events.update_own (organizer) or a WRITE/MANAGE share · attendees visible to the caller · resources need calendar.resources.manage only to approve, anyone with create may REQUEST ·
             CUSTOMER_VISIBLE visibility only on CUSTOMER/PROJECT calendars the caller may share
     @api    POST /calendar/events {calendar_id, event_type_id, title, description, status, starts_at, ends_at, all_day, timezone, recurrence_rule, recurrence_ends_at, visibility, shows_as_busy, color, location, location_details,
             conferencing_provider, meeting_url, company_id, project_id, branch_id, attendees[{kind, membership_id|user_id|contact_id|email, name, role}], resources[{resource_id, quantity}], reminders[{method, minutes_before, membership_id?}],
             links[{entity_type, entity_id, relation}], attachments[{document_id|external_url, title}]} · GET /calendar/availability/free-busy?attendees=&from=&to= (assistant) · POST /calendar/events/:id/conflicts-check
     @mcp    calendar_events_create · calendar_events_update · calendar_availability_read (find a time)
     @data   CalendarEvent (every column listed in @api) · CalendarEventAttendee · CalendarEventResource · CalendarEventReminder · CalendarEventLink · CalendarEventAttachment · CalendarConferencingAccount (auto link) · CalendarEventType
     @ui     Form with sections: shadcn Input, Textarea or Markdown editor, ToggleGroup (type), DatePicker + time Select (15 min), Select (time zone, Combobox), Popover+Command (calendar, attendees by kind, resources, linked records),
             RecurrenceDialog (Select frequency, ToggleGroup weekdays, RadioGroup end), Switch, Select for reminders, file drop (Documents 17)
     @states validation inline (end after start, title optional, at least one calendar) · saving · saved toast · conflict warnings (attendee busy, resource double-booked) that can be overridden by the organizer · permission error on a field disabled with reason ·
             draft restored · recurring edit asks THIS / FOLLOWING / ALL
     @audit  calendar.event_created / calendar.event_updated with a diff; attendee additions and removals are separate audit entries; changing time of a series writes one audit event per scope
     @note   The scheduling assistant (right rail) reads free/busy of the attendees (availability schedule, working hours, holidays, leave, events with shows_as_busy) and proposes slots. Resource requests become
             CalendarEventResource rows REQUESTED (or APPROVED at once when the resource needs no approval). Invitations are sent through Notifications (14) on save; EXTERNAL attendees get an email with ICS and RSVP links (response_token).
             ical_uid is generated by the API, sequence increments on every change that attendees must know about.
     ===================================================================================================================== */
  function create() {
    const recur = cd("<b>Repeat</b><span class='r muted'>recurrence_rule · recurrence_ends_at</span>", f("Repeats", segs(["Does not repeat", "Daily", "Weekly", "Monthly", "Yearly", "Custom"], 2)) + f("Every", two(box("1"), sel("week(s)"))) + f("On", segs(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], 2)) + f("Ends", segs(["Never", "On date", "After occurrences"], 0), "Stored as RRULE, e.g. FREQ=WEEKLY;INTERVAL=1;BYDAY=WE. Cancelled occurrences go to recurrence_exdates; edited ones become child rows.") +
      '<div class="callout">' + I("clock", 16) + "<div>Preview: every Wednesday from Nov 11 at 10:00, no end date (next 3: Nov 18, Nov 25, Dec 2).</div></div>");
    return '<div class="a-page">' + head("New event", "Schedule a meeting, deadline, focus block or time off. Attendees are invited when you save.", btn("Cancel") + btn("Save as tentative") + btn("Save and invite", "send", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Event</b>", f("Title", box("Add a title")) + f("Event type", segs(TYPES.map((t) => t[1]), 1), "CalendarEventType: the type sets default duration, visibility, busy/free and reminders. Types marked customer-facing may be CUSTOMER_VISIBLE.") +
        two(f("Date", sel("Wed, Nov 11, 2026", "calendar")), f("Time zone", sel("Europe/Athens (GMT+2)", "globe"))) + two(f("Start", sel("14:00")), f("End", sel("15:30"))) +
        '<div class="rowx" style="padding:4px 0"><div class="grow"><b>All day</b><small>CalendarEvent.all_day · no time zone shift</small></div>' + sw(0) + "</div>" +
        f("Description", '<div class="editor"><div class="ed-bar">' + ["B", "I", "H", "•", "1.", "Link", "@"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">Agenda, context, what the guests should prepare. Markdown. “@” mentions a member.</div></div>')) +
      gap() + recur + gap() +
      cd("<b>Guests</b><span class='r'>" + btn("Invite from a team", "users", "sm") + "</span>", f("Add guests", sel("Search members, portal users, CRM contacts or type an email", "users"), "Each guest is one CalendarEventAttendee. kind: MEMBER, PORTAL_USER, CONTACT or EXTERNAL.") +
        [["AM", "MEMBER", "REQUIRED", "ACCEPTED", "Organizer"], ["MS", "MEMBER", "REQUIRED", "NEEDS_ACTION", ""], ["SJ", "MEMBER", "OPTIONAL", "NEEDS_ACTION", ""]].map((a) => '<div class="rowx">' + av(a[0]) + '<div class="grow"><b>' + PEOPLE[a[0]][0] + "</b><small>" + (a[4] ? a[4] + " · " : "") + en(a[1]) + "</small></div>" + sel(en(a[2])) + (a[4] ? E("ACCEPTED", "green") : E(a[3])) + more + "</div>").join("") +
        '<div class="rowx"><span class="av">LK</span><div class="grow"><b>Lena Kovac</b><small>Acme Corp · Contact (CRM 02) · lena@acme.example</small></div>' + sel("Required") + E("NEEDS_ACTION") + more + '</div><div class="rowx"><span class="av">TB</span><div class="grow"><b>Tom Becker</b><small>Portal user (07) · tom@acme.example</small></div>' + sel("Optional") + E("NEEDS_ACTION") + more + '</div><div class="rowx"><span class="av">@</span><div class="grow"><b>advisor@partner.example</b><small>External email · gets ICS and RSVP links</small></div>' + sel("Informational") + E("NEEDS_ACTION") + more + "</div>" +
        '<div class="rowx" style="padding-top:8px"><div class="grow"><b>Guests can see the guest list</b><small>CalendarEvent.guests_can_see_guests. Hidden for large customer meetings</small></div>' + sw(1) + "</div>", 1) +
      gap() +
      cd("<b>Where</b>", f("Video meeting", segs(["None", "Google Meet", "Microsoft Teams", "Zoom", "Custom link"], 1), "Auto-created through your connected conferencing account (CalendarConferencingAccount). Custom link = paste a URL.") + f("Meeting link", box("https://meet.google.com/abc-defg-hij " + muted("(created on save)"))) +
        f("Location", sel("Athens office · Aegean room", "pin")) + f("Address details", box("Kifisias Ave 12, 3rd floor, Marousi · access code 4412"), "location_details (Json): address, floor, notes, map link.") + f("Room or equipment", sel("Add resource", "building"), "Requests a CalendarEventResource. Aegean room (ROOM, capacity 8) is free 14:00–15:30 and needs no approval."), 0) +
      gap() +
      cd("<b>Reminders</b><span class='r'>" + btn("Add reminder", "plus", "sm") + "</span>", [["NOTIFICATION", "15 minutes before", "Everyone"], ["EMAIL", "1 hour before", "Everyone"], ["PUSH", "10 minutes before", "Only me"]].map((r) => '<div class="rowx">' + I("bell", 14) + '<div class="grow"><b>' + en(r[0]) + "</b><small>" + r[1] + " · " + r[2] + (r[2] === "Only me" ? " (membership_id set: personal override)" : " (membership_id null: default for every attendee)") + "</small></div>" + more + "</div>").join(""), 1) +
      gap() +
      cd("<b>Linked records and files</b>", f("Link records", sel("Add link…", "link"), "CalendarEventLink: entity_type from RecordEntityType, e.g. PROJECT, CRM_COMPANY, CRM_DEAL, CONTRACT, TICKET, TASK, PROPOSAL, INVOICE, LEAVE_REQUEST. company_id, project_id and branch_id on the event are denormalised from the primary link.") +
        rowx("Acme Rebrand Website", "PROJECT · relation: about", more) + rowx("Acme Corp", "CRM_COMPANY · relation: customer", more) + rowx("WEB-142 Rebuild pricing page hero", "TASK · relation: discusses", more) +
        '<div class="drop" style="margin-top:10px">' + I("clip", 16) + " Attach a Document (17) or paste a URL (CalendarEventAttachment.document_id / external_url)</div>", 0) +
      "</div><div>" +
      cd("<b>Calendar and visibility</b>", f("Calendar", sel("Acme Corp (customer calendar)", "calendar")) + f("Visibility", segs(["Private", "Team", "Organization", "Customer visible"], 3), "CalendarEventVisibility. Customer visible shows the event in the portal calendar (07); internal notes never leave.") + f("Show me as", segs(["Busy", "Free"], 0), "shows_as_busy · focus time and deadlines default to free") + f("Status", segs(["Confirmed", "Tentative"], 0)) + f("Colour", '<div class="rowx" style="gap:8px;padding:0">' + ["blue", "green", "purple", "yellow", "red", "mute"].map((c, i) => '<i class="sw-c lg c-' + c + (i === 3 ? " pick" : "") + '"></i>').join("") + '<span class="muted">calendar colour</span></div>') + f("Organizer", wh("AM")) + f("Branch", sel("Athens HQ", "building"))) +
      gap() +
      cd("<b>Scheduling assistant</b><span class='r'>" + btn("Find a time", "sparkles", "sm") + "</span>", '<div class="fbmini">' + [["AM", [[9, 9.5], [10, 11], [15, 16]]], ["MS", [[9, 9.5], [10.5, 11.5], [16, 17]]], ["SJ", [[9, 9.5], [12.5, 13.5]]], ["Lena Kovac", [[9, 12]]]].map((r) => '<div class="fbm"><span>' + (r[0].length === 2 ? PEOPLE[r[0]][0].split(" ")[0] : "Lena") + '</span><div class="tr">' + r[1].map((b) => '<i style="left:' + (b[0] - 8) / 10 * 100 + "%;width:" + (b[1] - b[0]) / 10 * 100 + '%"></i>').join("") + '<u style="left:' + 60 + "%;width:15%" + '"></u></div></div>').join("") + '<div class="fbm axis"><span></span><div class="tr"><small>8</small><small>10</small><small>12</small><small>14</small><small>16</small><small>18</small></div></div></div>' +
        callout("check", "Everyone is free 14:00–15:30. Lena Kovac's availability is unknown (external contact), so she is shown from her last response.") + rowx("Other free slots", "Thu 11:00–12:00 · Fri 10:30–12:00", btn("Use", "", "sm")), 0) +
      gap() +
      callout("shield", "<b>Conflicts</b><br>Marco Silva has “Design review” (tentative) 16:00–17:00, not in this range. No resource conflicts.", "") +
      "</div></div>" +
      dm(["CalendarEvent · calendar_id, event_type_id, title, description, status, starts_at, ends_at, all_day, timezone, recurrence_rule, recurrence_ends_at, visibility, shows_as_busy, color, location, location_details, conferencing_provider, meeting_url, company_id, project_id, branch_id, organizer_membership_id, source",
        "CalendarEventAttendee · kind, membership_id / user_id / contact_id / email, name, role, response · CalendarEventResource · resource_id, quantity, status · CalendarEventReminder · method, minutes_before, membership_id · CalendarEventLink · entity_type, entity_id, relation · CalendarEventAttachment · document_id, external_url, title",
        "CalendarEventType · defaults · CalendarConferencingAccount · provider, status · CalendarResource · name, capacity, requires_approval · free/busy from CalendarAvailabilitySchedule + events"], ["Generated server-side, not user fields: ical_uid, sequence, meeting_external_id, meeting_details"]) + "</div>";
  }

  /* =====================================================================================================================
     EVENT DETAIL (spec §3, §9, §11)
     @screen Calendar > Event
     @route  /calendar/events/:id?occurrence=2026-11-11T12:00Z (peek popover on the grid shows a summary, this is the full page)
     @perm   VIEW calendar.events.read_own (attendee/organizer: own events only) or calendar.events.read (everything reachable by scope or sharing) · RSVP: any attendee on their own row (no extra key; external guests by response_token) · edit calendar.events.update_own ·
             cancel/delete calendar.events.delete_own · notes follow the permission of the linked record (CRM notes 02)
     @api    GET /calendar/events/:id · POST /calendar/events/:id/respond {response, response_comment, scope} · POST /calendar/events/:id/propose-time {starts_at, ends_at, comment} · POST /calendar/events/:id/proposals/:attendeeId/accept|dismiss · PATCH /calendar/events/:id · POST /calendar/events/:id/cancel {reason, notify} · POST /calendar/events/:id/duplicate ·
             GET /calendar/events/:id/activity · POST /crm/notes {entity_type: CALENDAR_EVENT, entity_id}
     @mcp    calendar_events_read · calendar_events_update · calendar_events_respond · calendar_events_cancel (sensitive: asks a human to confirm when an AI agent calls it)
     @data   CalendarEvent (incl. guests_can_see_guests) · CalendarEventAttendee (incl. proposed_starts_at, proposed_ends_at, proposal_comment, proposed_at) · CalendarEventResource · CalendarEventReminder · CalendarEventLink · CalendarEventAttachment · CalendarEventSyncMapping · CrmActivity.calendar_event_id · crm_notes (CALENDAR_EVENT) · audit_events
     @ui     shadcn Tabs, Card, Badge, Avatar, ToggleGroup for RSVP, AlertDialog for cancel (reason + notify guests), DropdownMenu for "This event / This and following / All events"
     @states loading · not found / no access (404 for private events of other members, never leaks existence) · cancelled banner (strikethrough title, reason) · past event (RSVP disabled, notes enabled) · sync conflict banner
     @audit  event changed, attendee added/removed, RSVP (calendar.attendee_responded), cancellation, sync overwrite; shown in the Activity tab
     @note   RSVP updates CalendarEventAttendee.response/response_comment/responded_at and notifies the organizer (14). For a recurring event the answer applies to this occurrence, this and following, or all. Notes and follow-up
             tasks live in CRM (02): the event only links to them. Meeting notes are crm_notes rows with entity_type CALENDAR_EVENT.
             PROPOSE NEW TIME: an attendee fills proposed_starts_at / proposed_ends_at / proposal_comment; the organizer is notified and either accepts (the event is rescheduled, sequence + 1, invitations re-sent, proposals cleared) or dismisses. guests_can_see_guests = false hides the guest list from non-organizers.
     ===================================================================================================================== */
  function detail() {
    const A = [["AM", "MEMBER", "REQUIRED", "ACCEPTED", 1], ["MS", "MEMBER", "REQUIRED", "ACCEPTED", 0], ["SJ", "MEMBER", "OPTIONAL", "TENTATIVE", 0]];
    const others = [["LK", "Lena Kovac", "CONTACT", "REQUIRED", "ACCEPTED", "Acme Corp · lena@acme.example"], ["TB", "Tom Becker", "PORTAL_USER", "OPTIONAL", "NEEDS_ACTION", "Customer portal user"], ["@", "advisor@partner.example", "EXTERNAL", "INFORMATIONAL", "NEEDS_ACTION", "Invited by email"]];
    const attendees = A.map((a) => '<div class="rowx">' + av(a[0]) + '<div class="grow"><b>' + PEOPLE[a[0]][0] + (a[4] ? " " + muted("organizer") : "") + "</b><small>" + en(a[1]) + " · " + en(a[2]) + "</small></div>" + E(a[3], RSVP[a[3]]) + "</div>").join("") +
      others.map((a) => '<div class="rowx"><span class="av">' + a[0] + '</span><div class="grow"><b>' + a[1] + "</b><small>" + en(a[2]) + " · " + en(a[3]) + " · " + a[5] + "</small></div>" + E(a[4], RSVP[a[4]]) + "</div>").join("");
    return '<div class="a-page">' +
      '<div class="a-head"><div><h1>Pricing page review with Lena Kovac</h1><p>Wed, Nov 11, 2026 · 14:00–15:30 (Europe/Athens) · ' + E("CONFIRMED", "green") + " " + E("customer-meeting") + " " + E("CUSTOMER_VISIBLE", "blue") + '</p></div><div class="acts">' + btn("Join Meet", "video", "primary") + btn("Edit", "edit") + btn("Duplicate", "file") + btn("Cancel event", "x") + "</div></div>" +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Your response</b><span class='r muted'>CalendarEventAttendee.response</span>", '<div class="rowx" style="gap:8px;padding:0 0 8px"><span class="muted">Going?</span>' + segs(["Yes", "Maybe", "No"], 0).replace('class="rowx"', 'class="rowx" style="display:inline-flex"') + '<span style="flex:1"></span>' + sel("This event", "clock") + btn("Propose new time", "calendar", "sm") + "</div>" + box("Add a comment for the organizer (response_comment)") + '<div class="sub-note">Answered Nov 9 · the organizer is notified (calendar.attendee_responded).</div>') +
      gap() + '<div class="tabset">' + tabs([["o", "Overview"], ["a", "Guests", 6], ["l", "Linked and files", 5], ["n", "Notes"], ["h", "Activity"], ["s", "Sync"]], "o") +
      pane("o", 1, cd("<b>Details</b>", prop("When", "Wed, Nov 11 · 14:00–15:30 · 1 h 30 min") + prop("Repeats", "Does not repeat " + muted("recurrence_rule empty")) + prop("Where", "Athens office · Aegean room " + muted("(resource)")) + prop("Video", "Google Meet · meet.google.com/abc-defg-hij " + muted("GOOGLE_MEET")) + prop("Calendar", '<i class="sw-c c-yellow"></i> Acme Corp ' + muted("CUSTOMER")) + prop("Organizer", wh("AM")) + prop("Show as", "Busy " + muted("shows_as_busy")) + prop("Reminders", "Notification 15 min · Email 1 h · Push 10 min (mine)")) + gap() + cd("<b>Description</b>", "<p>Walk through the three plan cards and the annual toggle. Lena to confirm the monthly price should stay visible by default. Decide go/no-go for the Nov 28 launch milestone.</p><p class='muted'>Agenda: 1. Plan cards (20 min) · 2. Toggle behaviour (20 min) · 3. Launch checklist (20 min) · 4. Next steps (10 min)</p>")) +
      pane("a", 0, cd("<b>Guests (6)</b><span class='r muted'>3 yes · 1 maybe · 2 awaiting</span>", attendees, 1) + gap() + cd("<b>Resources</b><span class='r muted'>CalendarEventResource</span>", rowx("Aegean room", "ROOM · capacity 8 · Athens HQ 3rd floor", E("APPROVED", "green")) + rowx("Conference speakerphone", "EQUIPMENT · quantity 1", E("REQUESTED", "yellow")), 1)) +
      pane("l", 0, '<div class="g2">' + cd("<b>Linked records</b><span class='r muted'>CalendarEventLink</span>", rowx("Acme Rebrand Website", "PROJECT (05) · about", muted("open")) + rowx("Acme Corp", "CRM_COMPANY (02) · customer", muted("open")) + rowx("Acme redesign", "CRM_DEAL (02) · related deal", muted("open")) + rowx("WEB-142 Rebuild pricing page hero", "TASK (06) · discusses", muted("open")) + rowx("TCK-2041 Pricing question", "TICKET (13) · raised in", muted("open")), 1) + cd("<b>Files</b><span class='r muted'>CalendarEventAttachment</span>", rowx("Pricing page mockups v3.fig", "Document (17) · 4.2 MB", more) + rowx("Launch checklist", "External URL · notion.so/…", more), 1) + "</div>") +
      pane("n", 0, cd("<b>Meeting notes</b><span class='r muted'>crm_notes · CALENDAR_EVENT</span>", '<div class="rowx"><div class="grow muted">Write notes during or after the meeting…</div>' + btn("Save note", "", "primary sm") + "</div>" + rowx("Follow-ups", "Created in CRM (02) from this event", btn("New follow-up task", "plus", "sm"))) + gap() + callout("clock", "Notes, outcomes and follow-ups are stored by CRM (02) on its records. The event only links to them (CrmActivity.calendar_event_id).")) +
      pane("h", 0, cd("<b>Activity</b><span class='r muted'>audit_events</span>", '<div class="tl"><div class="ev"><b>Lena Kovac accepted</b><small>Nov 10 · via email link (response_token)</small></div><div class="ev"><b>Aegean room approved</b><small>Nov 9 · automatic (requires_approval off)</small></div><div class="ev"><b>Time moved 15:00 → 14:00</b><small>Anna Meyer · Nov 9 · sequence 2 → 3 · guests notified</small></div><div class="ev"><b>Tom Becker invited</b><small>Anna Meyer · Nov 8</small></div><div class="ev"><b>Event created</b><small>Anna Meyer · Nov 8 · source INTERNAL</small></div></div>')) +
      pane("s", 0, cd("<b>External sync</b><span class='r muted'>CalendarEventSyncMapping</span>", prop("Google account", "anna@logiqdev.com " + E("SYNCED", "green")) + prop("External id", "6f2k1a9…") + prop("ical_uid", "7c1d0e2a-91b4-4f8e@logiqdev.com") + prop("Last pushed", "Nov 9, 14:02") + prop("Provider etag", "“3392…”")) + gap() + callout("shield", "Conflicts are resolved by provider timestamp; an overwritten change is recorded in the Activity tab.")) + "</div>" +
      "</div><div>" +
      cd("<b>Summary</b>", prop("Status", E("CONFIRMED", "green")) + prop("Type", "Customer meeting") + prop("Visibility", E("CUSTOMER_VISIBLE", "blue") + " " + muted("also in the portal")) + prop("Source", E("INTERNAL")) + prop("Sequence", "3") + prop("Created", "Nov 8 by Anna Meyer") + prop("Branch", "Athens HQ")) + gap() +
      cd("<b>Calendar conflicts</b>", callout("flag", "Overlaps with your “1:1 Anna and Marco” (15:00–16:00).", "") + btn("Resolve", "", "sm")) + gap() +
      cd("<b>Customer view</b><span class='r muted'>07</span>", '<div class="rowx"><div class="grow"><b>Visible to Acme Corp contacts</b><small>Title, time, link and public description. Internal notes, other guests\' emails and files stay hidden.</small></div>' + btn("Preview", "globe", "sm") + "</div>", 1) + "</div></div>" +
      dm(["CalendarEvent · all columns (see property panel) · CalendarEventAttendee · kind, role, response, response_comment, responded_at, is_organizer, proposed_starts_at, proposed_ends_at, proposal_comment, proposed_at · CalendarEventResource · status, quantity, decision_note · CalendarEventReminder · CalendarEventLink · CalendarEventAttachment", "CalendarEventSyncMapping · status, external_id, external_etag, last_pushed_at · CrmActivity.calendar_event_id · crm_notes · audit_events"], []) + "</div>";
  }

  /* =====================================================================================================================
     TEAM AVAILABILITY / FREE-BUSY (spec §6)
     @screen Calendar > Team
     @route  /calendar/team?date=2026-11-11&team=web&duration=30&attendees=
     @perm   VIEW calendar.availability.read (free/busy only) · titles and details of a person's events need calendar.calendars.read_team or a READ+ CalendarShare, otherwise the block says "Busy" ·
             create an event from a slot calendar.events.create
     @api    GET /calendar/availability/free-busy?membership_ids[]=&from=&to= (returns merged busy intervals + reason kind) · GET /calendar/availability/suggest?membership_ids[]=&duration=30&from=&to=&limit= ·
             POST /calendar/events (from a selected slot)
     @mcp    calendar_availability_read (free_busy, suggest_slots) · calendar_events_create
     @data   CalendarEvent (shows_as_busy, status != CANCELLED) · CalendarAvailabilitySchedule/Rule/Override (working hours) · CalendarPreference.availability_schedule_id · BranchHoliday, CompanyHoliday · EmployeeAvailabilityEntry (ON_LEAVE, VACATION, SICK_LEAVE, ...) ·
             Membership (name, branch) · Calendar.free_busy_only · CalendarShare.role
     @ui     Timeline rows (div grid, one row per member, hour columns) with Tooltip per block, Popover+Command to add people/teams, ToggleGroup for 1 day / 1 week, DatePicker, Select for duration, Table for suggestions
     @states loading skeleton rows · empty (no members selected) · partial ("2 people hidden, no availability access") · error · no-access
     @note   Free/busy = merge of events (as busy), leave and holidays, outside the member's availability schedule (hatched). Tentative events show striped. A suggested slot is highlighted across all rows
             and is computed server-side so the same logic powers booking links. External contacts are not listed here (their availability is unknown); invite them from the event form.
     ===================================================================================================================== */
  const FB = [
    ["AM", "GMT+2", "09:00–17:30", [[9, 9.5, "Web standup", "busy"], [10, 11, "Acme weekly sync", "busy"], [10.5, 11.5, "Stripe check-in", "busy"], [12.5, 13.5, "Team lunch", "busy"], [14, 15.5, "Pricing review", "busy"], [17, 17.5, "Beta go/no-go", "tent"]]],
    ["MS", "GMT+2", "09:00–17:30", [[9, 9.5, "Web standup", "busy"], [10, 11, "Acme weekly sync", "busy"], [12.5, 13.5, "Team lunch", "busy"], [14, 15.5, "Pricing review", "busy"], [15, 16, "1:1", "busy"], [16, 17, "Design review", "tent"]]],
    ["SJ", "GMT+2", "09:00–17:30", [[9, 9.5, "Web standup", "busy"], [10.5, 11.5, "Stripe check-in", "busy"], [12.5, 13.5, "Team lunch", "busy"], [14, 15.5, "Pricing review", "tent"]]],
    ["JK", "GMT+2", "10:00–18:00", [[8, 10, "Outside working hours", "off"], [11, 12, "Busy", "priv"], [12.5, 13.5, "Team lunch", "busy"], [17, 17.5, "Beta go/no-go", "busy"]]],
    ["KL", "GMT+1", "09:00–17:00 Berlin", [[8, 9, "Outside working hours", "off"], [15, 18, "Vacation (half day)", "leave"]]],
  ];
  function team() {
    const axis = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => "<span>" + h + "</span>").join("");
    const rows = FB.map((r) => '<div class="fb-row"><div class="who2">' + av(r[0]) + "<div><b>" + PEOPLE[r[0]][0] + "</b><small>" + r[1] + " · " + r[2] + '</small></div></div><div class="fb-tr">' +
      r[3].map((b) => '<i class="fb-b ' + b[3] + '" title="' + b[2] + " " + hh(b[0]) + "–" + hh(b[1]) + '" style="left:' + (b[0] - 8) / 10 * 100 + "%;width:" + (b[1] - b[0]) / 10 * 100 + '%">' + (b[1] - b[0] >= 1 ? b[2] : "") + "</i>").join("") + "</div></div>").join("");
    return '<div class="a-page">' + head("Team availability", "Find a time when everyone is free. Respects working hours, holidays, leave and tentative events.", btn("Share my availability", "link") + btn("New event", "plus", "primary")) +
      '<div class="toolbar">' + sel("Wed, Nov 11, 2026", "calendar") + sel("Team: Web team", "users") + sel("Duration: 30 min", "clock") + sel("Time zone: Athens (GMT+2)", "globe") + sel("1 day") + "</div>" +
      fbar([["Members", "is any of", "Anna Meyer, Marco Silva, Sofia Jensen, Jonas Koch, Kim Lund"], ["Show", "is", "Working hours only"]], btn("Add people", "plus", "sm")) +
      '<div class="g2" style="grid-template-columns:2.2fr 1fr;align-items:start"><div>' +
      cd("<b>Free / busy</b><span class='r'>" + [["busy", "Busy"], ["tent", "Tentative"], ["leave", "Leave"], ["off", "Outside hours"], ["priv", "Private (busy only)"]].map((x) => '<span class="lgx"><i class="fb-b ' + x[0] + '"></i>' + x[1] + "</span>").join("") + "</span>",
        '<div class="fb"><div class="fb-axis"><div></div><div class="fb-tr nobg">' + axis + "</div></div>" + rows + '<div class="fb-sug" style="left:calc(190px + (100% - 190px) * 0.4);width:calc((100% - 190px) * 0.05)"><span>12:00 · all free</span></div></div>', 1) +
      gap() +
      cd("<b>Load this week</b><span class='r muted'>busy hours / working hours</span>", FB.map((r, i) => '<div class="rowx">' + av(r[0]) + '<div class="grow"><b>' + PEOPLE[r[0]][0] + "</b></div>" + [38, 52, 61, 44, 20, 0, 0].map((p, d) => '<span class="cal-heat" style="opacity:' + (0.25 + (p + i * 6) / 100) + '" title="' + dname[d] + " " + (p + i * 6) + '%"></span>').join("") + "<span class=\"muted\" style=\"width:46px;text-align:right\">" + (40 + i * 5) + "%</span></div>").join(""), 1) +
      "</div><div>" +
      cd("<b>Suggested times</b><span class='r muted'>everyone, " + 30 + " min</span>", [["Wed, Nov 11", "12:00–12:30", "All 5 free", 1], ["Wed, Nov 11", "16:30–17:00", "4 of 5 · Marco tentative", 0], ["Thu, Nov 12", "10:00–10:30", "All 5 free", 1], ["Thu, Nov 12", "14:30–15:00", "All 5 free", 1], ["Fri, Nov 13", "11:00–11:30", "4 of 5 · Kim on leave", 0]].map((s) => rowx(s[1], s[0] + " · " + s[2], btn("Book", "", "sm" + (s[3] ? " primary" : "")))).join(""), 1) +
      gap() + callout("lock", "<b>Privacy</b><br>You see titles only for people who shared their calendar with you. Everyone else is shown as Busy. Jonas Koch’s 11:00 block is private.") +
      gap() + cd("<b>Rooms free at 12:00</b><span class='r muted'>CalendarResource</span>", rowx("Aegean room", "ROOM · 8 seats", E("APPROVED", "green")) + rowx("Santorini room", "ROOM · 4 seats", E("REQUESTED", "yellow")), 1) + "</div></div>" +
      dm(["CalendarEvent · starts_at, ends_at, shows_as_busy, status, visibility", "CalendarAvailabilitySchedule · CalendarAvailabilityRule · CalendarAvailabilityOverride · honor_holidays, honor_leave", "EmployeeAvailabilityEntry · status, starts_at, ends_at (10) · BranchHoliday / CompanyHoliday (01, 10)", "CalendarShare · role · Calendar · free_busy_only", "CalendarResource · CalendarEventResource (rooms free at that time)"], ["Per-member working location (office / remote) is EmployeeAvailabilityStatus, no calendar field needed"]) + "</div>";
  }

  /* =====================================================================================================================
     RESOURCES: ROOMS AND EQUIPMENT (spec §6, Phase 2)
     @screen Calendar > Resources
     @route  /calendar/resources?kind=&branch=&q= · tab ?tab=approvals · new: /calendar/resources/new
     @perm   VIEW calendar.events.read_own (see availability of a resource) · request a resource calendar.events.create · approve/decline, create, edit resources calendar.resources.manage
     @api    GET /calendar/resources?kind=&branch_id=&requires_approval= · POST/PATCH /calendar/resources · GET /calendar/resources/:id/availability?date= · GET /calendar/resource-requests?status=REQUESTED ·
             POST /calendar/resource-requests/:id/decide {status: APPROVED|DECLINED, decision_note}
     @mcp    calendar_resources_read · calendar_resources_manage (create, edit, decide)
     @data   CalendarResource (kind, name, code, branch_id, capacity, location, color, requires_approval, manager_membership_ids, availability Json, attributes Json, archived_at) · Calendar (kind RESOURCE, resource_id: created with the resource) ·
             CalendarEventResource (status, quantity, decided_by_user_id, decided_at, decision_note) · Branch
     @ui     shadcn Tabs, Table, Badge, Dialog for approve/decline with a note, Popover+Command for managers, timeline (same row grid as free/busy), Form for create
     @states loading · empty ("No rooms yet, create the first one") · error · no-access · conflict ("Aegean room is already booked 14:00–15:00 by Product sync")
     @audit  resource created/changed, request decided (who, when, note)
     @note   Each resource owns a RESOURCE calendar that holds its bookings for conflict detection; conflicts are checked only against APPROVED rows for the same resource and overlapping time. requires_approval = the request
             stays REQUESTED until a manager (manager_membership_ids) decides. `availability` Json holds bookable hours; `attributes` Json holds free-form facts (projector, whiteboard, video wall).
     ===================================================================================================================== */
  function resources() {
    const R = [["Aegean room", "AE-1", "ROOM", "Athens HQ · 3rd floor", 8, 0, "AM", "green"], ["Santorini room", "SA-2", "ROOM", "Athens HQ · 2nd floor", 4, 0, "AM", "blue"], ["Board room", "BR-1", "ROOM", "Athens HQ · 5th floor", 14, 1, "SJ", "purple"], ["Demo device kit", "KIT-7", "EQUIPMENT", "Athens HQ · IT cabinet", 3, 1, "JK", "yellow"], ["Company van", "VAN-1", "VEHICLE", "Parking B", 5, 1, "SJ", "red"], ["Podcast microphones", "MIC-2", "OTHER", "Studio", 2, 0, "MS", "mute"]];
    const tl = [["Aegean room", [[9, 11.5, "Acme redesign kickoff"], [14, 15.5, "Pricing page review"]]], ["Santorini room", [[10, 11, "Sprint planning"], [13, 14, "Interview"]]], ["Board room", [[10, 11, "All-hands"], [11, 12, "Requested: Investor update"]]]];
    const reqs = [["Board room", "Investor update", "Nov 12 · 11:00–12:00", "SJ", "REQUESTED"], ["Company van", "Client site visit: Globex", "Nov 16 · 08:00–18:00", "KL", "REQUESTED"], ["Demo device kit", "Mobile v2 demo", "Nov 12 · 11:00–12:00", "JK", "REQUESTED"]];
    return '<div class="a-page">' + head("Resources", "Bookable rooms, equipment and vehicles. Each one has its own calendar for conflict detection.", btn("Export", "file") + btn("New resource", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Resources", "6", "2 need approval") + stat("Booked today", "7", "of 14 slots") + stat("Pending approvals", "3", "oldest 1 day", 1) + stat("Utilisation (7 d)", "58%", "+6 pts") + "</div>" +
      '<div class="tabset">' + tabs([["r", "Rooms and equipment", 6], ["t", "Today"], ["a", "Approvals", 3], ["n", "New resource"]], "r") +
      pane("r", 1, '<div class="toolbar">' + search("Search name, code, location") + sel("Kind: All", "box") + sel("Branch: Athens HQ", "building") + sel("Approval: any") + sel("Capacity ≥ 1", "users") + "</div>" +
        tbl(["Resource", "Kind", "Code", "Location", ">Capacity", "Approval", "Manager", "Calendar", ""], R.map((r) => [ink('<i class="sw-c c-' + r[7] + '"></i> ' + r[0]), E(r[2]), "<span class='muted'>" + r[1] + "</span>", r[3], r[4], r[5] ? E("REQUESTED", "yellow") + " required" : "None", wh(r[6]), muted("RESOURCE calendar"), more]))) +
      pane("t", 0, cd("<b>Today · Wed Nov 11</b><span class='r muted'>APPROVED bookings only</span>", '<div class="fb"><div class="fb-axis"><div></div><div class="fb-tr nobg">' + [8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => "<span>" + h + "</span>").join("") + "</div></div>" + tl.map((r) => '<div class="fb-row"><div class="who2"><div><b>' + r[0] + '</b></div></div><div class="fb-tr">' + r[1].map((b) => '<i class="fb-b ' + (/^Requested/.test(b[2]) ? "tent" : "busy") + '" style="left:' + (b[0] - 8) / 10 * 100 + "%;width:" + (b[1] - b[0]) / 10 * 100 + '%">' + b[2] + "</i>").join("") + "</div></div>").join("") + "</div>", 1)) +
      pane("a", 0, cd("<b>Pending requests</b><span class='r muted'>CalendarEventResource · REQUESTED</span>", reqs.map((r) => '<div class="rowx">' + av(r[3]) + '<div class="grow"><b>' + r[0] + " · " + r[1] + "</b><small>" + r[2] + " · requested by " + PEOPLE[r[3]][0] + "</small></div>" + E(r[4], "yellow") + btn("Approve", "check", "sm primary") + btn("Decline", "x", "sm") + "</div>").join(""), 1) + gap() + callout("flag", "Declining asks for a note (decision_note) and tells the organizer. An approved resource is held until the event is cancelled or moved.")) +
      pane("n", 0, '<div class="g2" style="align-items:start">' + cd("<b>Resource</b>", f("Name", box("Aegean room")) + two(f("Kind", segs(["Room", "Equipment", "Vehicle", "Other"], 0)), f("Code", box("AE-1"))) + two(f("Branch", sel("Athens HQ", "building")), f("Capacity", box("8"))) + f("Location", box("3rd floor, east wing")) + f("Description", box("Video wall, whiteboard, speakerphone")) + f("Colour", '<div class="rowx" style="gap:8px;padding:0">' + ["blue", "green", "purple", "yellow", "red", "mute"].map((c, i) => '<i class="sw-c lg c-' + c + (i === 1 ? " pick" : "") + '"></i>').join("") + "</div>")) +
        cd("<b>Booking rules</b>", '<div class="rowx"><div class="grow"><b>Requires approval</b><small>Requests stay REQUESTED until a manager decides</small></div>' + sw(0) + "</div>" + f("Managers", sel("Add managers", "users"), "manager_membership_ids") + f("Bookable hours", segs(["Mon–Fri 08:00–19:00", "24 / 7", "Custom"], 0), "availability (Json)") + f("Attributes", box("projector · whiteboard · video wall"), "attributes (Json)") + btn("Create resource", "plus", "primary")) + "</div>") + "</div>" +
      dm(["CalendarResource · kind, name, code, branch_id, capacity, location, color, requires_approval, manager_membership_ids, availability, attributes, archived_at", "Calendar · kind RESOURCE, resource_id", "CalendarEventResource · status, quantity, decided_by_user_id, decided_at, decision_note", "Branch · name"], []) + "</div>";
  }

  /* =====================================================================================================================
     OUT OF OFFICE, HOLIDAYS AND LEAVE (spec §2 Availability, §6, §13)
     @screen Calendar > Time off
     @route  /calendar/time-off?tab=ooo|holidays|leave&branch=
     @perm   VIEW calendar.availability.read · my out-of-office events calendar.events.create / update_own (event type out-of-office) · holidays and leave are READ-ONLY here: edited in Admin (01 §122) and Employees (10)
     @api    GET /calendar/events?event_type=out-of-office&from=&to= · POST /calendar/events {event_type_id: out-of-office, all_day: true, shows_as_busy: true, …} · GET /calendar/projected?modules=EMPLOYEES (holidays, leave)
     @mcp    calendar_events_create · calendar_availability_read
     @data   CalendarEvent (event type out-of-office) · CalendarEventType (slug out-of-office) · CompanyHoliday (name, date, kind PUBLIC|COMPANY, is_half_day, recurring, applies_to_branch_ids) · BranchHoliday (branch_id, name, date, recurring) ·
             EmployeeAvailabilityEntry (status, starts_at, ends_at, all_day, source, leave_request_id, calendar_event_id) · LeaveRequest.calendar_event_id (10)
     @ui     shadcn Tabs, Table, Badge, Switch, DatePicker range, Textarea, Alert
     @states loading · empty ("No time off planned") · error · no-access · holiday-only branches shown with the branch name
     @audit  event created/changed (calendar.event_created), leave calendar events are written by Employees (10), not here
     @note   Approved leave creates a CalendarEvent (LeaveRequest.calendar_event_id) so it shows on the grid and counts as busy in free/busy. Holidays are projected, never copied into events. "Out of office" is an event type;
             its event carries auto_reply_message (used as the decline comment) and auto_decline_invitations (new invitations for the organizer are declined automatically while the event runs).
     ===================================================================================================================== */
  function timeoff() {
    return '<div class="a-page">' + head("Time off", "Your out-of-office, public and company holidays, and team leave on the calendar.", btn("Open Employees", "people") + btn("Set out of office", "plus", "primary")) +
      '<div class="tabset">' + tabs([["o", "Out of office"], ["h", "Holidays", 9], ["l", "Team leave", 4]], "o") +
      pane("o", 1, '<div class="g2" style="align-items:start">' + cd("<b>Set out of office</b><span class='r muted'>creates an all-day event of type out-of-office</span>", two(f("From", sel("Mon, Dec 21, 2026", "calendar")), f("To", sel("Fri, Jan 1, 2027", "calendar"))) + f("Title", box("Out of office")) + f("Calendar", sel("Anna Meyer (personal)", "calendar")) + f("Visibility", segs(["Team", "Organization"], 1)) +
        '<div class="rowx"><div class="grow"><b>Show me as busy</b><small>shows_as_busy, so booking links and free/busy skip these days</small></div>' + sw(1) + "</div>" +
        '<div class="rowx"><div class="grow"><b>Decline new invitations while away</b><small>CalendarEvent.auto_decline_invitations</small></div>' + sw(0) + "</div>" + f("Message to people who invite me", box("Thanks for reaching out. I am away Dec 21 – Jan 1 and will reply on Jan 4."), "CalendarEvent.auto_reply_message") + '<div class="rowx" style="padding:0;gap:8px">' + btn("Cancel") + btn("Save", "", "primary") + "</div>") +
        cd("<b>My upcoming</b>", tbl(["Title", "Dates", "Type", "Status"], [["Out of office", "Dec 21 – Jan 1", E("out-of-office"), E("CONFIRMED", "green")], ["Vacation (approved leave)", "Aug 3 – Aug 14 2026", E("VACATION"), E("COMPLETED", "green")], ["Conference travel", "Nov 24 – Nov 26", E("BUSINESS_TRAVEL"), E("TENTATIVE", "yellow")]]).replace('style="margin-top:0"', 'style="margin:0;border:0"')) + "</div>") +
      pane("h", 0, '<div class="toolbar">' + sel("Year: 2026", "calendar") + sel("Branch: Athens HQ", "building") + sel("Kind: all") + btn("Manage holidays in Admin", "settings", "sm") + "</div>" +
        tbl(["Date", "Holiday", "Kind", "Applies to", "Half day", "Repeats", "Source"], [["Oct 28", "Ochi Day", E("PUBLIC"), "Athens HQ", "No", "Yearly", muted("BranchHoliday")], ["Nov 26", "Thanksgiving", E("COMPANY"), "All branches", "No", "Yearly", muted("CompanyHoliday")], ["Dec 24", "Christmas Eve", E("COMPANY"), "All branches", "Yes", "Yearly", muted("CompanyHoliday")], ["Dec 25", "Christmas Day", E("PUBLIC"), "All branches", "No", "Yearly", muted("CompanyHoliday")], ["Dec 26", "Boxing Day", E("PUBLIC"), "Athens HQ", "No", "Yearly", muted("BranchHoliday")], ["Jan 1", "New Year", E("PUBLIC"), "All branches", "No", "Yearly", muted("CompanyHoliday")]]) + '<div class="sub-note" style="margin-top:8px">Holidays are owned by Administration (01 §122) and Employees (10). Calendar projects them on the grid and honours them in availability when honor_holidays is on.</div>') +
      pane("l", 0, tbl(["Person", "Status", "From", "To", "Source", "Event"], [[wh("SJ"), E("ON_LEAVE"), "Nov 12", "Nov 13", E("LEAVE"), muted("calendar event")], [wh("KL"), E("VACATION"), "Nov 11 15:00", "Nov 11 18:00", E("LEAVE"), muted("calendar event")], [wh("JK"), E("BUSINESS_TRAVEL"), "Nov 24", "Nov 26", E("MANUAL"), "—"], [wh("MS"), E("SICK_LEAVE"), "Nov 3", "Nov 4", E("LEAVE"), muted("calendar event")]])) + "</div>" +
      dm(["CalendarEvent · event type out-of-office, all_day, shows_as_busy, visibility, auto_reply_message, auto_decline_invitations", "CompanyHoliday · name, date, kind, is_half_day, recurring, applies_to_branch_ids · BranchHoliday · branch_id, name, date, recurring", "EmployeeAvailabilityEntry · status, starts_at, ends_at, source, calendar_event_id · LeaveRequest.calendar_event_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     AVAILABILITY SCHEDULES (spec §6)
     @screen Calendar > Availability
     @route  /calendar/availability?schedule=<id> · new: ?schedule=new
     @perm   VIEW calendar.availability.read · edit own schedules and overrides: calendar.availability.manage (own scope) · schedules of others / organization schedules: calendar.availability.manage at team or organization scope
     @api    GET /calendar/availability/schedules · POST /calendar/availability/schedules {name, timezone, is_default, honor_holidays, honor_leave, rules[{weekday, start_time, end_time}], overrides[{date, kind, start_time, end_time, reason}]} ·
             PATCH/DELETE /calendar/availability/schedules/:id · GET /calendar/availability/preview?schedule_id=&from=&to=
     @mcp    calendar_availability_read · calendar_availability_manage (gap: key missing)
     @data   CalendarAvailabilitySchedule (membership_id null = organization schedule, name, timezone, is_default, honor_holidays, honor_leave, archived_at) · CalendarAvailabilityRule (weekday 0-6, start_time, end_time "HH:mm") ·
             CalendarAvailabilityOverride (date, kind UNAVAILABLE|AVAILABLE, start_time, end_time, reason) · CalendarPreference.availability_schedule_id · BookingLink.availability_schedule_id
     @ui     shadcn Select (schedule), per-weekday row with Switch + time Select pairs (repeatable for split shifts), Calendar + Popover for overrides (DatePicker), Table, Card preview
     @states loading · empty (no schedule: falls back to working hours of 01 §121) · validation (overlapping windows, end before start) · saved toast · error
     @audit  schedule created/changed/archived
     @note   Employee working hours live in 01 §121; this schedule is for SCHEDULING (booking links, slot suggestions, free/busy): the effective window is schedule rules, minus holidays (honor_holidays), minus leave (honor_leave),
             minus busy events. Several rule rows per weekday allow split shifts. An override with null start/end covers the whole day. weekday: 0 = Sunday ... 6 = Saturday in the schema; the UI lists Monday first.
     ===================================================================================================================== */
  function availability() {
    const days = [["Monday", [["09:00", "13:00"], ["14:00", "17:30"]]], ["Tuesday", [["09:00", "13:00"], ["14:00", "17:30"]]], ["Wednesday", [["09:00", "13:00"], ["14:00", "17:30"]]], ["Thursday", [["09:00", "13:00"], ["14:00", "17:30"]]], ["Friday", [["09:00", "13:00"], ["14:00", "16:00"]]], ["Saturday", []], ["Sunday", []]];
    const editor = days.map((d) => '<div class="rowx"><span style="width:100px">' + sw(d[1].length) + ' <b style="margin-left:6px">' + d[0].slice(0, 3) + '</b></span><div class="grow">' + (d[1].length ? d[1].map((r) => '<span class="tr-pair">' + sel(r[0]) + "–" + sel(r[1]) + '<button class="btn ghost sm icon">' + I("x", 13) + "</button></span>").join(" ") : '<span class="muted">Unavailable</span>') + "</div>" + (d[1].length ? '<button class="btn ghost sm icon">' + I("plus", 14) + "</button>" : "") + "</div>").join("");
    return '<div class="a-page">' + head("Availability", "When you can be scheduled. Used by free/busy, slot suggestions and booking links.", btn("New schedule", "plus") + btn("Save changes", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:230px 1fr;align-items:start"><div>' + cd("<b>Schedules</b>", [["Working hours", "Default · 4 booking links", 1], ["Customer calls", "Tue/Thu afternoons", 0], ["Sales demos", "Organization schedule · 2 hosts", 0]].map((s) => '<div class="rowx' + (s[2] ? " rowsel" : "") + '"><div class="grow"><b>' + s[0] + "</b><small>" + s[1] + "</small></div></div>").join(""), 1) + gap(10) + callout("clock", "Working hours of the organization (01 §121) are the starting point when you have no schedule.") + "</div><div>" +
      cd("<b>Working hours</b><span class='r'>" + E("ACTIVE", "green") + "</span>", two(f("Name", box("Working hours")), f("Time zone", sel("Europe/Athens (GMT+2)", "globe"))) +
        '<div class="rowx"><div class="grow"><b>Default schedule</b><small>Used when no other schedule is chosen (is_default)</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Honour holidays</b><small>Skip CompanyHoliday and BranchHoliday dates (honor_holidays)</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Honour leave</b><small>Skip approved leave from Employees (honor_leave)</small></div>' + sw(1) + "</div>") + gap() +
      cd("<b>Weekly hours</b><span class='r muted'>CalendarAvailabilityRule</span>", editor, 1) + gap() +
      cd("<b>Date overrides</b><span class='r'>" + btn("Add override", "plus", "sm") + "</span>", tbl(["Date", "Kind", "Hours", "Reason", ""], [["Dec 24", E("AVAILABLE", "green"), "10:00–14:00", "Christmas Eve, half day", more], ["Dec 25 – Dec 26", E("UNAVAILABLE", "red"), "All day", "Public holiday", more], ["Nov 20", E("UNAVAILABLE", "red"), "14:00–17:30", "Conference", more], ["Jan 2", E("AVAILABLE", "green"), "09:00–12:00", "Extra opening", more]]).replace('style="margin-top:0"', 'style="margin:0;border:0"'), 1) + gap() +
      cd("<b>Resulting week</b><span class='r muted'>preview, holidays and leave applied</span>", '<div class="cal-prev">' + dname.map((d, i) => '<div><small>' + d + '</small><div class="pv">' + (i < 5 ? '<i style="top:0;height:40%"></i><i style="top:50%;height:' + (i === 4 ? 30 : 38) + '%"></i>' : "") + "</div></div>").join("") + "</div>") + "</div></div>" +
      dm(["CalendarAvailabilitySchedule · membership_id, name, timezone, is_default, honor_holidays, honor_leave, archived_at", "CalendarAvailabilityRule · weekday, start_time, end_time", "CalendarAvailabilityOverride · date, kind, start_time, end_time, reason", "CalendarPreference · availability_schedule_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     BOOKING LINKS LIST (spec §6, §8, §12)
     @screen Calendar > Booking links
     @route  /calendar/booking-links?status=&audience=&owner=&q=&view=
     @perm   VIEW + manage calendar.booking_links.manage (the catalog has only this key; members without it do not see the page) · bulk pause/archive same key
     @api    GET /calendar/booking-links?status=&audience=&owner_membership_id=&company_id=&q=&sort=&cursor= · PATCH /calendar/booking-links/:id {status} · POST /calendar/booking-links/bulk {ids[], action: PAUSE|ACTIVATE|ARCHIVE} ·
             POST /calendar/booking-links/:id/duplicate
     @mcp    calendar_booking_links_read · calendar_booking_links_manage (create, update, status)
     @data   BookingLink (slug, name, status, audience, owner_membership_id, company_id, host_assignment, duration_minutes, duration_options, requires_confirmation, archived_at) · BookingLinkHost (membership_id, priority) · CalendarBooking (counts by status, last 30 days)
     @ui     shadcn Table with row Checkbox, bulk action bar, Badge, Avatar stack, DropdownMenu (copy link, duplicate, pause, archive), Popover+Command filters, Tabs (Links / Bookings), Dialog "Copy link" with QR
     @states loading skeleton · empty ("No booking links yet. Create one so customers can book you") · error · no-access · archived hidden unless filtered
     @audit  booking link created/changed/status change (audit_events), `calendar.booking_created` per booking
     @note   The public URL is /book/:orgSlug/:slug (PUBLIC), the portal shows PORTAL links to logged-in customers (07 §11), INTERNAL links are for colleagues. A link with no ACTIVE status returns a "not available" page, never a 500.
             Page views, slot selections and conversion come from BookingLinkStatsDaily (daily counters per link: page_views, unique_visitors, slot_selections, bookings_created, bookings_cancelled, sources); bookings per link still come from CalendarBooking. Conversion = bookings_created / page_views.
     ===================================================================================================================== */
  const LINKS = [
    ["Discovery call", "discovery-call", "ACTIVE", "PUBLIC", "SINGLE", "30 min", ["AM"], 14, "Anna Meyer"],
    ["Sales demo", "demo", "ACTIVE", "PUBLIC", "ROUND_ROBIN", "45 min", ["MS", "SJ", "JK"], 9, "Marco Silva"],
    ["Acme project check-in", "acme-check-in", "ACTIVE", "PORTAL", "SINGLE", "30 / 45 / 60 min", ["AM"], 5, "Anna Meyer"],
    ["Architecture workshop", "architecture-workshop", "DRAFT", "PUBLIC", "COLLECTIVE", "90 min", ["AM", "JK"], 0, "Jonas Koch"],
    ["Intern interview", "intern-interview", "PAUSED", "INTERNAL", "SINGLE", "45 min", ["SJ"], 3, "Sofia Jensen"],
    ["Onboarding call (old)", "onboarding-old", "ARCHIVED", "PUBLIC", "SINGLE", "30 min", ["KL"], 21, "Kim Lund"],
  ];
  const LST = { ACTIVE: "green", DRAFT: "yellow", PAUSED: "yellow", ARCHIVED: "" };
  function bookings() {
    return '<div class="a-page">' + head("Booking links", "Self-scheduling pages for customers, prospects and colleagues.", btn("Bookings", "list") + btn("New booking link", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active links", "3", "1 draft · 1 paused") + stat("Bookings (30 d)", "31", "+12% vs previous") + stat("Awaiting confirmation", "2", "PENDING", 1) + stat("No-show rate", "6%", "2 of 31", 1) + "</div>" +
      '<div class="toolbar">' + search("Search name or slug") + sel("Status: All", "filter") + sel("Audience: All", "globe") + sel("Owner: Anyone", "users") + sel("Company: Any", "building") + sel("Sort: Bookings ↓", "sort") + "</div>" +
      fbar([["Status", "is not", "Archived"], ["Audience", "is any of", "Public, Portal, Internal"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span class="muted">pause or archive several links at once</span><span style="flex:1"></span>' + btn("Activate", "check", "sm") + btn("Pause", "clock", "sm") + btn("Archive", "box", "sm") + "</div>" +
      tbl(["", "Link", "Status", "Audience", "Hosts", "Duration", ">Bookings 30 d", "Owner", ""], LINKS.map((l, i) => [cb(i < 2), ink(l[0]) + "<br><small class='muted'>/book/logiqdev/" + l[1] + "</small>", E(l[2], LST[l[2]]), E(l[3]), '<div class="avs">' + l[6].map(av).join("") + "</div> " + muted(en(l[4])), l[5], l[7], l[8], more])) +
      '<div class="pager"><span class="muted">1–6 of 6</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["BookingLink · slug, name, status, audience, host_assignment, duration_minutes, duration_options, owner_membership_id, company_id, archived_at", "BookingLinkHost · membership_id, priority", "CalendarBooking · status, starts_at (count per link, last 30 days)", "BookingLinkStatsDaily · date, page_views, unique_visitors, slot_selections, bookings_created, bookings_cancelled, sources (views and conversion)"], []) + "</div>";
  }

  /* =====================================================================================================================
     BOOKINGS LIST (spec §6, §8, §12)
     @screen Calendar > Bookings
     @route  /calendar/bookings?status=&link=&host=&from=&to=&source=&q=
     @perm   VIEW calendar.bookings.read (all bookings in scope; a host always sees their own) · confirm/decline/cancel/reschedule/no-show calendar.bookings.manage or the host · link settings stay calendar.booking_links.manage
     @api    GET /calendar/bookings?status=&booking_link_id=&host_membership_id=&source=&from=&to=&q=&cursor= · POST /calendar/bookings/bulk {ids[], action: CONFIRM|CANCEL|MARK_NO_SHOW|MARK_COMPLETED, reason?}
     @mcp    calendar_bookings_read · calendar_bookings_manage (confirm, cancel, no-show: sensitive, human confirmation for AI agents)
     @data   CalendarBooking (booking_link_id, event_id, host_membership_id, status, source, starts_at, ends_at, timezone, invitee_name, invitee_email, invitee_phone, contact_id, company_id, answers, origin_entity_type, origin_entity_id, cancelled_*, rescheduled_from_booking_id, no_show_marked_at, completed_at, attribution)
     @ui     shadcn Table, Checkbox + bulk bar, Badge, Avatar, Popover+Command filters, DateRangePicker, DropdownMenu row actions
     @states loading · empty ("No bookings match") · error · no-access
     @audit  every status change writes audit_events and emits calendar.booking_created / calendar.event_updated / calendar.event_cancelled as relevant
     @note   Confirming a PENDING booking (link.requires_confirmation) creates the CalendarEvent (source BOOKING) and emails the invitee; rescheduling creates a new CalendarBooking with rescheduled_from_booking_id and marks the old RESCHEDULED.
             Invitees that match a CRM contact (by email) are linked (contact_id) and a CrmActivity is logged (02).
     ===================================================================================================================== */
  const BK = [
    ["Peter Novak", "peter@novak.example", "Discovery call", "Thu Nov 12 · 13:00", "CONFIRMED", "PUBLIC_LINK", "AM", "—"],
    ["Lena Kovac", "lena@acme.example", "Acme project check-in", "Fri Nov 13 · 11:00", "PENDING", "PORTAL", "AM", "Acme Corp"],
    ["Maria Costa", "maria@costa.example", "Sales demo", "Mon Nov 16 · 15:00", "CONFIRMED", "PUBLIC_LINK", "SJ", "Costa Logistics"],
    ["Dev Patel", "dev@patel.example", "Sales demo", "Tue Nov 17 · 10:30", "RESCHEDULED", "PUBLIC_LINK", "MS", "Patel & Co"],
    ["Tom Becker", "tom@acme.example", "Acme project check-in", "Tue Nov 10 · 16:00", "CANCELLED", "PORTAL", "AM", "Acme Corp"],
    ["Nina Rossi", "nina@rossi.example", "Discovery call", "Mon Nov 9 · 11:00", "NO_SHOW", "PUBLIC_LINK", "AM", "—"],
    ["Olga Ivanova", "olga@intern.example", "Intern interview", "Fri Nov 6 · 14:00", "COMPLETED", "INTERNAL", "SJ", "—"],
    ["Globex procurement", "buyer@globex.example", "Sales demo", "Wed Nov 18 · 11:00", "PENDING", "API", "JK", "Globex"],
  ];
  const BST = { CONFIRMED: "green", PENDING: "yellow", RESCHEDULED: "blue", CANCELLED: "", NO_SHOW: "red", COMPLETED: "green" };
  function bookingList() {
    return '<div class="a-page">' + head("Bookings", "Every slot booked through your links, the portal, internal booking and the API.", btn("Export", "file") + btn("Booking links", "link", "primary")) +
      '<div class="toolbar">' + search("Search invitee, email, company") + sel("Status: All", "filter") + sel("Link: All", "link") + sel("Host: Anyone", "users") + sel("Source: All", "plug") + sel("Nov 1 – Nov 30", "calendar") + sel("Sort: Start ↑", "sort") + "</div>" +
      fbar([["Status", "is any of", "Pending, Confirmed, Rescheduled"], ["Date", "between", "Nov 1 – Nov 30"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span style="flex:1"></span>' + btn("Confirm", "check", "sm") + btn("Mark no-show", "x", "sm") + btn("Cancel bookings", "x", "sm") + "</div>" +
      tbl(["", "Invitee", "Link", "Starts", "Host", "Status", "Source", "Company", ""], BK.map((b, i) => [cb(i === 1 || i === 7), '<div class="who"><span class="av">' + b[0].split(" ").map((x) => x[0]).join("").slice(0, 2) + "</span><div><b>" + b[0] + "</b><small>" + b[1] + "</small></div></div>", b[2], b[3], wh(b[6]), E(b[4], BST[b[4]]), E(b[5]), b[7], more])) +
      '<div class="pager"><span class="muted">1–8 of 31</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["CalendarBooking · booking_link_id, host_membership_id, status, source, starts_at, ends_at, timezone, invitee_name, invitee_email, invitee_phone, company_id, contact_id", "BookingLink · name", "Membership · host"], []) + "</div>";
  }

  /* =====================================================================================================================
     BOOKING DETAIL (spec §6, §8)
     @screen Calendar > Booking
     @route  /calendar/bookings/:id
     @perm   VIEW calendar.booking_links.manage or the host · actions same
     @api    GET /calendar/bookings/:id · POST /calendar/bookings/:id/confirm · /reschedule {starts_at} · /cancel {reason, notify} · /no-show · /complete · POST /crm/contacts (create from invitee)
     @mcp    calendar_bookings_read · calendar_bookings_manage
     @data   CalendarBooking (all columns) · BookingLink (questions → answers) · CalendarEvent (event_id) · CrmContact / CrmCompany · attribution Json (utm_source, utm_campaign, referrer) · origin_entity_type/id (the record the link was sent from)
     @ui     shadcn Card, Badge, Tabs, Dialog (reschedule picker), AlertDialog (cancel with reason), Timeline
     @states loading · not found / no access · cancelled banner · invitee unknown (offer "Create contact")
     @audit  confirm, reschedule, cancel (cancelled_by: INVITEE | HOST | SYSTEM), no-show, complete
     @note   manage_token is the secret in the invitee's confirmation email link (reschedule / cancel without login); it is never shown in the UI or logs. Answers come from BookingLink.questions at the time of booking.
     ===================================================================================================================== */
  function bookingDetail() {
    return '<div class="a-page"><div class="a-head"><div><h1>Lena Kovac · Acme project check-in</h1><p>Fri, Nov 13, 2026 · 11:00–11:45 (Europe/Athens) · ' + E("PENDING", "yellow") + " " + E("PORTAL") + '</p></div><div class="acts">' + btn("Confirm booking", "check", "primary") + btn("Reschedule", "clock") + btn("Cancel", "x") + btn("More", "more") + "</div></div>" +
      callout("flag", "<b>Awaiting confirmation.</b> This link requires confirmation (requires_confirmation). Confirming creates the calendar event and sends the invitation. It auto-declines if not confirmed 24 h before the start.") + gap() +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>Invitee</b>", prop("Name", "Lena Kovac") + prop("Email", "lena@acme.example") + prop("Phone", "+30 21 0555 0142") + prop("Time zone", "Europe/Berlin (shown to her in this zone: 10:00)") + prop("Customer", "Acme Corp " + muted("CrmCompany (02)")) + prop("Contact", "Lena Kovac " + muted("CrmContact, matched by email")) + prop("Portal user", "Yes " + muted("invitee_user_id"))) + gap() +
      cd("<b>Answers</b><span class='r muted'>BookingLink.questions → answers</span>", prop("What would you like to discuss?", "Plan cards and the annual toggle on the pricing page") + prop("Who else should join?", "Tom Becker") + prop("Do you have documents to share?", "Yes, figma link in the notes") + prop("Notes", "Please keep the call to 45 minutes.")) + gap() +
      cd("<b>Activity</b>", '<div class="tl"><div class="ev"><b>Booking created</b><small>Nov 10 · from the Customer Portal · source PORTAL</small></div><div class="ev"><b>Confirmation email sent to Lena</b><small>Nov 10 · includes reschedule / cancel link (manage_token)</small></div><div class="ev"><b>Host notified</b><small>Anna Meyer · in-app and email (14)</small></div></div>') +
      "</div><div>" + cd("<b>Booking</b>", prop("Status", E("PENDING", "yellow")) + prop("Source", E("PORTAL")) + prop("Link", "Acme project check-in " + muted("open")) + prop("Host", wh("AM")) + prop("Assignment", E("SINGLE")) + prop("Duration", "45 min") + prop("Starts", "Nov 13 · 11:00") + prop("Ends", "Nov 13 · 11:45") + prop("Event", muted("created on confirm")) + prop("Rescheduled from", "—") + prop("Created", "Nov 10 · 16:20")) + gap() +
      cd("<b>Origin and attribution</b>", prop("Sent from", "CRM_COMPANY · Acme Corp " + muted("origin_entity")) + prop("utm_source", "portal") + prop("utm_campaign", "launch-check-in") + prop("Referrer", "app.logiqdev.example/portal/calendar")) + gap() +
      cd("<b>Invitee actions</b>", rowx("Reschedule or cancel link", "Sent by email. Secret token, never displayed.", E("ACTIVE", "green")) + rowx("Cancellation window", "Up to 24 h before the start (cancellation_notice_minutes 1440)")) + "</div></div>" +
      dm(["CalendarBooking · every column (status, source, starts_at, ends_at, timezone, invitee_*, contact_id, company_id, answers, notes, origin_entity_type/id, confirmed_at, cancelled_at, cancelled_by, cancellation_reason, rescheduled_from_booking_id, no_show_marked_at, completed_at, attribution)", "BookingLink · questions, requires_confirmation, cancellation_notice_minutes, allow_rescheduling", "CalendarEvent · event_id (after confirm) · CrmContact · CrmCompany"], ["manage_token is secret: never rendered"]) + "</div>";
  }

  /* =====================================================================================================================
     CREATE / EDIT BOOKING LINK (spec §6, §8)
     @screen Calendar > New booking link
     @route  /calendar/booking-links/new?type=&company=&from=<entityType>:<id> · edit: /calendar/booking-links/:id/edit
     @perm   calendar.booking_links.manage · PUBLIC audience also requires the organization to have a public booking domain enabled · hosts must be members with an availability schedule or default working hours
     @api    POST /calendar/booking-links {slug, name, description, status, audience, owner_membership_id, company_id?, event_type_id?, calendar_id?, availability_schedule_id?, host_assignment, hosts[{membership_id, priority, availability_schedule_id?}],
             duration_minutes, duration_options[], slot_interval_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_minutes, max_days_ahead, available_from?, available_until?, max_bookings_per_day?, seats_per_slot,
             requires_confirmation, timezone?, location?, conferencing_provider?, conferencing_account_id?, questions[], reminders[], cancellation_notice_minutes?, allow_rescheduling, confirmation_message?, redirect_url?, branding{}, event_title_template?} ·
             GET /calendar/booking-links/slug-available?slug= · GET /calendar/booking-links/:id/preview-slots
     @mcp    calendar_booking_links_manage
     @data   BookingLink (every column) · BookingLinkHost · CalendarEventType · Calendar · CalendarAvailabilitySchedule · CalendarConferencingAccount · CrmCompany
     @ui     Sectioned form: shadcn Input, Textarea, ToggleGroup, Popover+Command (hosts, company, schedule), Select (durations, buffers), DatePicker, Switch, question builder (sortable list with Select for type), live preview Card
     @states validation (slug unique per organization, lowercase letters, digits, dashes) · saving · saved toast with the public URL and Copy · draft · permission error · warning when a host has no availability
     @audit  booking link created/updated, status changes
     @note   Slots are computed server-side: host availability schedule, minus busy events, holidays and leave, minus buffers; respecting min notice, max days ahead, slot interval, max per day and seats per slot (seats_per_slot > 1 = group sessions).
             ROUND_ROBIN picks the next host by priority then least-recently-booked; COLLECTIVE needs every host free at the same time. `questions` Json item: {key, label, type: SHORT_TEXT | LONG_TEXT | SELECT | MULTI_SELECT | CHECKBOX | PHONE, required, options[]}.
             Name and email are always asked. `branding` Json: {logo_document_id, accent: token name, hero_text}. `reminders` Json: [{method, minutes_before, audience: INVITEE | HOST}].
     ===================================================================================================================== */
  function bookingNew() {
    const Q = [["Name", "SHORT_TEXT", 1, "Always asked"], ["Email", "SHORT_TEXT", 1, "Always asked"], ["Phone number", "PHONE", 0, ""], ["What would you like to discuss?", "LONG_TEXT", 1, ""], ["Company size", "SELECT", 0, "1–10 · 11–50 · 51–200 · 200+"]];
    return '<div class="a-page">' + head("New booking link", "Let people book time with you. The link works as soon as it is active.", btn("Cancel") + btn("Save as draft") + btn("Activate link", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Basics</b>", f("Name", box("Discovery call")) + f("Link", '<div class="input-fake" style="color:var(--ink)">book.logiqdev.example/logiqdev/<b>discovery-call</b></div>', "Letters, digits and dashes. Available.") + f("Description", box("A 30-minute intro to see how we can help.")) +
        f("Audience", segs(["Public", "Portal customers only", "Internal"], 0), "BookingLinkAudience: PUBLIC anyone with the link · PORTAL logged-in customers (07 §11) · INTERNAL colleagues") + two(f("Owner", sel("Anna Meyer", "users")), f("Customer (optional)", sel("Any customer", "building"), "company_id: restricts the page to one customer")) + f("Status", segs(["Draft", "Active", "Paused"], 0))) + gap() +
      cd("<b>Hosts</b>", f("Who is booked", segs(["One host", "Round robin", "Collective"], 0), "SINGLE: the owner · ROUND_ROBIN: next host by priority then least recently booked · COLLECTIVE: all hosts must be free") +
        [["AM", 1, "Working hours"], ["MS", 2, "Working hours"], ["SJ", 3, "Customer calls"]].map((h) => '<div class="rowx">' + av(h[0]) + '<div class="grow"><b>' + PEOPLE[h[0]][0] + "</b><small>Priority " + h[1] + " · " + h[2] + "</small></div>" + sel(h[2], "clock") + more + "</div>").join("") + '<div style="padding-top:6px">' + btn("Add host", "plus", "sm") + "</div>", 0) + gap() +
      cd("<b>Duration and limits</b>", two(f("Default duration", sel("30 min", "clock")), f("Let invitee choose", sel("15 · 30 · 60 min", "list"))) + two(f("Slot interval", sel("Every 15 min")), f("Seats per slot", box("1"))) + two(f("Buffer before", sel("10 min")), f("Buffer after", sel("10 min"))) + two(f("Minimum notice", sel("4 hours")), f("Book up to", sel("60 days ahead"))) +
        two(f("Available from", sel("Now", "calendar")), f("Available until", sel("No end", "calendar"))) + two(f("Max bookings per day", box("6")), f("Time zone", sel("Europe/Athens", "globe"))) + f("Availability", sel("Working hours (default schedule)", "clock"), "Uses the host's CalendarAvailabilitySchedule: weekly hours, date overrides, holidays and leave. Busy events and buffers are removed.")) + gap() +
      cd("<b>Where</b>", f("Location", segs(["Video call", "In person", "Phone call", "Customer's choice"], 0)) + f("Video provider", sel("Google Meet (anna@logiqdev.com)", "video"), "conferencing_provider + conferencing_account_id. The link is created when the booking is confirmed.") + f("Address (in person)", box("Kifisias Ave 12, Marousi"))) + gap() +
      cd("<b>Questions</b><span class='r'>" + btn("Add question", "plus", "sm") + "</span>", Q.map((q) => '<div class="rowx"><span class="muted">⋮⋮</span><div class="grow"><b>' + q[0] + "</b><small>" + en(q[1]) + (q[3] ? " · " + q[3] : "") + "</small></div>" + (q[2] ? E("REQUIRED", "blue") : muted("optional")) + more + "</div>").join(""), 1) + gap() +
      cd("<b>After booking</b>", '<div class="rowx"><div class="grow"><b>Require confirmation</b><small>Bookings stay PENDING until a host confirms</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Allow rescheduling</b><small>Invitee can change time from the email link</small></div>' + sw(1) + "</div>" + f("Cancellation notice", sel("Up to 24 hours before")) + f("Calendar event title", box("{invitee_name} and {host_name}: {link_name}"), "event_title_template") + f("Event type and calendar", two(sel("Booking", "tag"), sel("Anna Meyer", "calendar"))) + f("Confirmation message", box("Thanks for booking. We sent the details to your email.")) + f("Redirect after booking", box("https://www.example.com/thank-you"), "redirect_url (optional)") +
        f("Reminders", '<div class="rowx" style="padding:0;gap:8px;flex-wrap:wrap">' + [["Invitee · Email · 24 h"], ["Invitee · SMS · 1 h"], ["Host · Notification · 15 min"]].map((r) => '<span class="fchip"><b>' + r[0] + "</b>" + I("x", 12) + "</span>").join("") + btn("Add", "plus", "sm") + "</div>")) + gap() +
      cd("<b>Branding</b>", f("Logo", '<div class="drop">' + I("clip", 16) + " Upload (Document 17)</div>") + f("Accent colour", '<div class="rowx" style="gap:8px;padding:0">' + ["blue", "green", "purple", "yellow", "red"].map((c, i) => '<i class="sw-c lg c-' + c + (i === 0 ? " pick" : "") + '"></i>').join("") + "</div>") + f("Headline", box("Book a time with Logiqdev"))) +
      "</div><div>" + cd("<b>Preview</b><span class='r'>" + btn("Open public page", "globe", "sm") + "</span>", '<div class="cal-pub mini"><div class="ph2"><span class="cal-logo">L</span><b>Discovery call</b><small>30 min · Google Meet</small></div><div class="pm"><div class="cal-mh"><b>November 2026</b></div><div class="cal-mg">' + "MTWTFSS".split("").map((x) => "<small>" + x + "</small>").join("") + "<span></span>".repeat(6) + Array.from({ length: 30 }, (_, i) => '<span class="' + ((i + 6) % 7 > 4 ? "off" : i + 1 === 11 ? "pick" : i + 1 < 11 ? "off" : "ok") + '">' + (i + 1) + "</span>").join("") + "</div></div></div>") + gap() +
      cd("<b>Slot check</b><span class='r muted'>preview-slots</span>", rowx("Thu Nov 12", "9:00 · 9:15 · 9:30 · 10:30 · 11:00 · 14:00 · 15:30") + rowx("Fri Nov 13", "9:30 · 10:00 · 11:30 · 13:00 · 14:00") + callout("flag", "Marco Silva has no availability schedule: working hours of the organization are used.")) + gap() +
      cd("<b>Share</b>", f("Public link", '<div class="input-fake" style="color:var(--ink)">book.logiqdev.example/logiqdev/discovery-call</div>') + '<div class="rowx" style="padding:0;gap:8px">' + btn("Copy link", "link", "sm") + btn("QR code", "grid", "sm") + btn("Embed", "file", "sm") + "</div>") + "</div></div>" +
      dm(["BookingLink · every column (see @api)", "BookingLinkHost · membership_id, priority, availability_schedule_id", "CalendarEventType · Calendar · CalendarAvailabilitySchedule · CalendarConferencingAccount · CrmCompany"], ["Embed code / QR code are rendered from slug, no column needed"]) + "</div>";
  }

  /* =====================================================================================================================
     PUBLIC BOOKING PAGE PREVIEW (spec §6, §8, §12)
     @screen Calendar > Public booking page (what the invitee sees; no login for PUBLIC links)
     @route  /book/:orgSlug/:slug (public, no app shell) · portal variant /portal/calendar/book/:slug · manage: /book/manage/:manageToken
     @perm   none for PUBLIC (rate limited and bot protected); PORTAL needs a portal session (07) with the portal calendar permission; INTERNAL needs a member session
     @api    GET /public/booking-links/:orgSlug/:slug · GET /public/booking-links/:id/slots?from=&to=&timezone=&duration= · POST /public/booking-links/:id/bookings {starts_at, duration, timezone, name, email, phone, answers{}} ·
             POST /public/bookings/:manageToken/reschedule | cancel
     @mcp    none (public endpoint). Agents use calendar_bookings_manage on the authenticated side.
     @data   BookingLink (name, description, duration_*, questions, branding, confirmation_message, redirect_url, location, conferencing_provider) · slots computed from BookingLinkHost + availability · CalendarBooking (created) · CalendarEvent (on confirm)
     @ui     Public page in the organization's branding; DatePicker month grid, slot list as Buttons, Form (Input, Textarea, Select), time-zone Select (defaults to the browser zone), confirmation Card. Fully responsive, light and dark.
     @states loading slots skeleton · no slots in range ("No times available. Try another month") · link paused/archived ("This booking page is not available") · slot just taken (409, shows fresh slots) · validation · booking confirmed · pending confirmation · rate limited
     @audit  CalendarBooking created with attribution (utm, referrer); calendar.booking_created webhook
     @note   Slot holds are not stored (no table): the API re-checks availability inside the booking transaction and answers 409 with fresh slots when the slot is gone. There is deliberately no hold table: nothing is reserved while the invitee fills the form. Never expose host calendar content, only slots.
             The time zone selector never changes the stored UTC instant. Invitee gets an ICS and a manage link.
     ===================================================================================================================== */
  function bookingPublic() {
    const days = Array.from({ length: 30 }, (_, i) => i + 1), slots = ["09:00", "09:30", "10:30", "11:00", "14:00", "14:30", "15:30", "16:00"];
    const cal = '<div class="pm"><div class="cal-mh"><b>November 2026</b><span class="rowx" style="gap:4px;padding:0"><button class="btn ghost sm icon">' + I("down", 14).replace("<svg", '<svg style="transform:rotate(90deg)"') + '</button><button class="btn ghost sm icon">' + I("down", 14).replace("<svg", '<svg style="transform:rotate(-90deg)"') + "</button></span></div><div class=\"cal-mg\">" + "MTWTFSS".split("").map((x) => "<small>" + x + "</small>").join("") + "<span></span>".repeat(6) + days.map((d) => '<span class="' + ((d + 5) % 7 > 4 || d < 12 ? "off" : d === 12 ? "pick" : "ok") + '">' + d + "</span>").join("") + "</div></div>";
    const info = '<div class="cal-pi"><span class="cal-logo">L</span><small>Logiqdev</small><h3>Discovery call</h3><div class="cal-ln">' + I("clock", 14) + " 30 minutes</div><div class=\"cal-ln\">" + I("video", 14) + " Google Meet link in the invitation</div><div class=\"cal-ln\">" + I("globe", 14) + " Europe/Athens</div><p>A 30-minute intro to see how we can help with your product or website.</p><div class=\"cal-ln\">" + I("users", 14) + " Anna Meyer</div></div>";
    return '<div class="a-page">' + head("Public booking page", "Preview of the page invitees see. Open the three steps below. Works without login for PUBLIC links.", btn("Open page", "globe") + btn("Edit link", "edit", "primary")) +
      '<div class="pubframe"><div class="pf-bar"><i></i><i></i><i></i><span>book.logiqdev.example/logiqdev/discovery-call</span></div><div class="cal-pub"><div class="pcol">' + info + '</div><div class="pcol">' + cal + '</div><div class="pcol"><div class="pd"><b>Thu, Nov 12</b>' + sel("Europe/Athens", "globe") + '</div><div class="slots">' + slots.map((s, i) => '<div class="slot' + (i === 3 ? " on" : "") + '">' + s + (i === 3 ? "<em>Confirm</em>" : "") + "</div>").join("") + '</div></div></div></div>' + gap() +
      '<div class="g2" style="align-items:start">' + cd("<b>Step 2 · your details</b>", '<div class="cal-pub cal-two"><div class="pcol">' + f("Name *", box("Peter Novak")) + f("Email *", box("peter@novak.example")) + f("Phone", box("+30 …")) + f("What would you like to discuss? *", box("We are planning a new customer portal…")) + f("Company size", sel("11–50")) + '<div class="rowx" style="padding:6px 0;gap:8px">' + cb(1) + '<span class="muted">I agree to be contacted about this booking</span></div>' + btn("Schedule event", "check", "primary") + "</div></div>") +
        cd("<b>Step 3 · confirmed</b>", '<div class="cal-pub cal-two"><div class="pcol" style="text-align:center"><div class="okring">' + I("check", 22) + "</div><h3>You are booked</h3><p class='muted'>Discovery call with Anna Meyer<br>Thu, Nov 12 · 13:00–13:30 (Europe/Athens)</p><div class=\"rowx\" style=\"justify-content:center;gap:8px;padding:6px 0\">" + btn("Add to calendar", "calendar", "sm") + btn("Reschedule", "clock", "sm") + btn("Cancel", "x", "sm") + "</div><p class='sub-note'>A confirmation with the meeting link was sent to peter@novak.example. If the link requires confirmation this step says “Request sent”.</p></div></div>") + "</div>" +
      gap() + '<div class="g2">' + cd("<b>Edge states</b>", rowx("No available times", "Shows the next month with slots, or “No times available”") + rowx("Slot just taken", "409 from the API, refreshes slots with a notice") + rowx("Link paused or archived", "“This booking page is not available”") + rowx("Portal link, not signed in", "Redirects to the portal login (07)")) + cd("<b>Rules shown to the invitee</b>", rowx("Cancel or reschedule", "Up to 24 hours before, from the email link") + rowx("Time zone", "Detected from the browser, changeable") + rowx("Privacy", "Only slots are public, never calendar content")) + "</div>" +
      dm(["BookingLink · name, description, duration_minutes, duration_options, slot_interval_minutes, location, conferencing_provider, questions, branding, confirmation_message, redirect_url, allow_rescheduling, cancellation_notice_minutes", "BookingLinkHost · availability → slots", "CalendarBooking · invitee_*, answers, attribution, manage_token (written)"], ["No slot hold table on purpose: availability is re-checked on submit (409 on conflict)"]) + "</div>";
  }

  /* =====================================================================================================================
     CALENDARS LIST (spec §2, §5, §7, §10)
     @screen Calendar > Calendars
     @route  /calendar/calendars?kind=&q=&archived=
     @perm   VIEW calendar.calendars.read_team (calendars of others you may see) · create, edit, share, archive calendar.calendars.manage · personal calendars: owner always, creating a personal calendar needs only calendar.events.create
     @api    GET /calendar/calendars?kind=&q=&archived= · POST /calendar/calendars · PATCH /calendar/calendars/:id · POST /calendar/calendars/:id/archive · PUT /calendar/calendars/:id/overlay (CalendarPreference.overlay_calendar_ids)
     @mcp    calendar_calendars_read · calendar_calendars_manage
     @data   Calendar (kind, name, description, color, timezone, scope column, is_default, default_visibility, free_busy_only, portal_visible, sort_order, archived_at) · CalendarShare (count) · CalendarConnectionCalendar (synced source) · CalendarEvent (count)
     @ui     shadcn Table, Badge, Checkbox (overlay), Popover+Command filters, DropdownMenu (edit, share, archive), Tabs by kind
     @states loading · empty ("No calendars match") · error · no-access · archived section collapsed
     @audit  calendar created/updated/archived, calendar sharing (audited)
     @note   Exactly one scope column is set according to kind. The member's own PERSONAL calendar and the ORGANIZATION calendar exist from the start; PROJECT and TEAM calendars are created with the project (05) or team (01) and can be turned off.
             Archiving hides a calendar and its events from views but keeps history; events are never hard-deleted while bookings or time entries reference them.
     ===================================================================================================================== */
  const CALROWS = [
    ["Anna Meyer", "PERSONAL", "Owner: Anna Meyer", "blue", "PRIVATE", 0, 0, 148, 2, "Google"],
    ["Web team", "TEAM", "Team: Web", "green", "TEAM", 0, 0, 412, 6, ""],
    ["Mobile App v2", "PROJECT", "Project: Mobile App v2", "purple", "TEAM", 0, 1, 96, 5, ""],
    ["Acme Corp", "CUSTOMER", "Customer: Acme Corp", "yellow", "CUSTOMER_VISIBLE", 0, 1, 38, 4, ""],
    ["Company", "ORGANIZATION", "Whole organization", "red", "ORGANIZATION", 0, 0, 64, 1, ""],
    ["Athens office", "BRANCH", "Branch: Athens HQ", "ash", "ORGANIZATION", 0, 0, 73, 2, ""],
    ["Aegean room", "RESOURCE", "Resource: Aegean room", "mute", "TEAM", 1, 0, 211, 0, ""],
    ["anna@logiqdev.com", "EXTERNAL", "Google (two-way)", "ash", "PRIVATE", 1, 0, 305, 1, "Google"],
  ];
  function calendars() {
    return '<div class="a-page">' + head("Calendars", "Personal, team, project, customer, branch, resource and synced calendars.", btn("Sync settings", "plug") + btn("New calendar", "plus", "primary")) +
      '<div class="toolbar">' + search("Search calendars") + sel("Kind: All", "layers") + sel("Visibility: All", "lock") + sel("Show archived", "box") + sel("Sort: Order", "sort") + "</div>" +
      fbar([["Kind", "is any of", "All kinds"], ["Archived", "is", "No"]], btn("Clear", "", "sm ghost")) +
      tbl(["Calendar", "Kind", "Scope", "Default visibility", "Free/busy only", "Portal", ">Events", ">Shared with", "Source", ""], CALROWS.map((c) => [ink('<i class="sw-c c-' + c[3] + '"></i> ' + c[0]), E(c[1]), c[2], E(c[4]), c[5] ? "Yes" : "No", c[6] ? E("ACTIVE", "green") : muted("hidden"), c[7], c[8], c[9] ? E(c[9]) : muted("internal"), more])) +
      '<div class="pager"><span class="muted">8 calendars · 1 archived (Old campaign Q2)</span></div>' +
      dm(["Calendar · kind, name, color, owner_membership_id / team_id / project_id / company_id / branch_id / resource_id, default_visibility, free_busy_only, portal_visible, sort_order, archived_at", "CalendarShare · count per calendar", "CalendarConnectionCalendar · calendar_id (source)", "CalendarEvent · count"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE CALENDAR (spec §2, §5, §10)
     @screen Calendar > New calendar
     @route  /calendar/calendars/new?kind=&team=&project=&company=
     @perm   calendar.calendars.manage (PERSONAL: calendar.events.create) · sharing others needs the manage permission on the calendar
     @api    POST /calendar/calendars {kind, name, description, color, timezone, owner_membership_id | team_id | project_id | company_id | branch_id | resource_id, is_default, default_visibility, free_busy_only, portal_visible, shares[{membership_id|team_id, role, expires_at}]}
     @mcp    calendar_calendars_manage
     @data   Calendar · CalendarShare
     @ui     shadcn Form: ToggleGroup (kind), Input, Textarea, colour swatches (tokens only), Select (visibility, time zone), Popover+Command (scope record, people), Switch
     @states validation (name unique per kind and scope, exactly one scope field) · saving · saved · error · permission error (kind disabled)
     @audit  calendar created and shares added
     @note   The "Scope" field changes with the chosen kind and is the ONLY scope column written. ORGANIZATION has none. EXTERNAL calendars are not created here: they appear when a CalendarConnectionCalendar is mapped (Sync settings).
     ===================================================================================================================== */
  function calendarNew() {
    return '<div class="a-page">' + head("New calendar", "A named collection of events with its own colour, visibility and sharing.", btn("Cancel") + btn("Create calendar", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Calendar</b>", f("Kind", segs(["Personal", "Team", "Project", "Customer", "Branch", "Organization"], 2), "CalendarKind. RESOURCE calendars come with a resource; EXTERNAL ones with a synced account.") + f("Name", box("Customer Portal Build")) + f("Description", box("Milestones, reviews and demos for the portal project")) + f("Scope", sel("Project: Customer Portal Build", "folder"), "Exactly one scope column is saved for this kind: project_id.") + two(f("Colour", '<div class="rowx" style="gap:8px;padding:0">' + ["blue", "green", "purple", "yellow", "red", "mute"].map((c, i) => '<i class="sw-c lg c-' + c + (i === 2 ? " pick" : "") + '"></i>').join("") + "</div>"), f("Time zone", sel("Organization default", "globe")))) + gap() +
      cd("<b>Visibility</b>", f("Default visibility of new events", segs(["Private", "Team", "Organization", "Customer visible"], 1)) + '<div class="rowx"><div class="grow"><b>Free/busy only</b><small>Others see busy blocks, never titles (free_busy_only)</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Show in the Customer Portal</b><small>Only events marked CUSTOMER_VISIBLE appear (portal_visible)</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Default calendar</b><small>New events land here for me (CalendarPreference.default_calendar_id)</small></div>' + sw(0) + "</div>") + gap() +
      cd("<b>Share with</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", [["Project team", "Team", "WRITE"], ["Jonas Koch", "Member", "MANAGE"], ["Acme Corp contacts", "Portal", "READ"]].map((s) => '<div class="rowx"><div class="grow"><b>' + s[0] + "</b><small>" + s[1] + "</small></div>" + sel(en(s[2])) + more + "</div>").join(""), 1) +
      "</div><div>" + cd("<b>What each role can do</b>", [["FREE_BUSY", "See when you are busy, never titles or details"], ["READ", "See events and details they are allowed by event visibility"], ["WRITE", "Create, edit and delete events"], ["MANAGE", "Everything, plus edit the calendar and its sharing"]].map((r) => rowx(E(r[0]), r[1])).join("")) + gap() + callout("shield", "Every share is audited. Shares may expire (expires_at); expired shares stop working immediately.") + "</div></div>" +
      dm(["Calendar · kind, name, description, color, timezone, project_id (scope), default_visibility, free_busy_only, portal_visible, is_default", "CalendarShare · membership_id | team_id, role, expires_at, shared_by_user_id", "CalendarPreference · default_calendar_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     CALENDAR DETAIL: SHARING, FEED, AUDIT (spec §7, §10, §11)
     @screen Calendar > Calendar > Web team
     @route  /calendar/calendars/:id?tab=overview|sharing|sync|feed|audit
     @perm   VIEW calendar.calendars.read_team · edit settings and sharing calendar.calendars.manage or a MANAGE share · delete/archive calendar.calendars.manage
     @api    GET/PATCH /calendar/calendars/:id · GET/POST/PATCH/DELETE /calendar/calendars/:id/shares · GET /calendar/calendars/:id/activity
     @mcp    calendar_calendars_read · calendar_calendars_manage (share changes need human confirmation for AI agents)
     @data   Calendar (incl. feed_token, feed_token_rotated_at) · CalendarShare (membership_id | team_id, role, shared_by_user_id, expires_at) · CalendarConnectionCalendar (sync) · audit_events
     @ui     shadcn Tabs, Table, Select (role), Popover+Command (people, teams), DatePicker (expiry), AlertDialog (remove share), Dialog "Share calendar"
     @states loading · not found / no access · share expired badge · last MANAGE share cannot be removed
     @audit  calendar shared, role changed, share removed or expired (spec §11)
     @note   Role is the ceiling: even WRITE cannot see PRIVATE events of other organizers beyond "Busy". The iCal feed (read-only subscribe URL for Apple Calendar etc.) is addressed by Calendar.feed_token (unique, null = feed off); Regenerate replaces it and records feed_token_rotated_at (calendar.calendars.manage). The feed honours free_busy_only.
     ===================================================================================================================== */
  function calendarDetail() {
    return '<div class="a-page"><div class="a-head"><div><h1><i class="sw-c lg c-green"></i> Web team</h1><p>' + E("TEAM") + " · Team: Web · default visibility " + en("TEAM") + " · 412 events · time zone Europe/Athens</p></div><div class=\"acts\">" + btn("Share", "users") + btn("Edit", "edit") + btn("Archive", "box") + "</div></div>" +
      '<div class="tabset">' + tabs([["s", "Sharing", 5], ["o", "Settings"], ["y", "Sync"], ["f", "Feed"], ["a", "Audit"]], "s") +
      pane("s", 1, cd("<b>People and teams with access</b><span class='r'>" + btn("Share calendar", "plus", "sm primary") + "</span>", tbl(["Who", "Type", "Role", "Shared by", "Expires", ""], [[wh("MS"), "Member", sel("Write"), "Anna Meyer", "Never", more], [wh("SJ"), "Member", sel("Write"), "Anna Meyer", "Never", more], [wh("JK"), "Member", sel("Manage"), "Anna Meyer", "Never", more], ["<b>Design team</b>", "Team", sel("Read"), "Jonas Koch", "Never", more], ["<b>Finance team</b>", "Team", sel("Free busy"), "Anna Meyer", "Dec 31, 2026", more]]).replace(/<div class="panel" style="margin-top:0">/, '<div class="panel" style="margin:0;border:0">'), 1) + gap() +
        '<div class="g2">' + cd("<b>Share dialog</b><span class='r muted'>design</span>", f("People or team", sel("Search members and teams", "users")) + f("Role", segs(["Free busy", "Read", "Write", "Manage"], 1)) + f("Expires", sel("Never", "calendar")) + '<div class="rowx" style="padding:0;gap:8px">' + btn("Cancel", "", "sm") + btn("Share", "send", "sm primary") + "</div>") + cd("<b>Roles</b>", [["FREE_BUSY", "Busy blocks only"], ["READ", "Event details as allowed by visibility"], ["WRITE", "Create, edit, delete events"], ["MANAGE", "Edit the calendar and its sharing"]].map((r) => rowx(E(r[0]), r[1])).join("")) + "</div>") +
      pane("o", 0, cd("<b>Settings</b>", prop("Name", "Web team") + prop("Kind", E("TEAM")) + prop("Scope", "Team: Web (team_id)") + prop("Colour", '<i class="sw-c c-green"></i> Green') + prop("Time zone", "Europe/Athens") + prop("Default visibility", E("TEAM")) + prop("Free/busy only", sw(0)) + prop("Shown in portal", sw(0)) + prop("Sort order", "2") + prop("Created", "Aug 18, 2026 by Anna Meyer"))) +
      pane("y", 0, cd("<b>External sync</b><span class='r muted'>CalendarConnectionCalendar</span>", callout("plug", "No external calendar is mapped to this team calendar. Map one from Calendar > Sync (organization-level connections need calendar.calendars.manage).") + '<div style="padding-top:8px">' + btn("Open sync settings", "settings", "sm") + "</div>")) +
      pane("f", 0, cd("<b>Subscribe with an iCal URL</b><span class='r muted'>Calendar.feed_token</span>", f("Private feed URL", box("https://…/calendar/feed/<token>.ics"), "Read-only subscription for Apple Calendar or Outlook. Anyone with the URL can read it; regenerate to revoke (feed_token_rotated_at).") + '<div class="rowx" style="padding:0;gap:8px">' + btn("Copy", "link", "sm") + btn("Regenerate token", "key", "sm") + "</div>")) +
      pane("a", 0, cd("<b>Audit</b>", '<div class="tl"><div class="ev"><b>Finance team shared as Free busy</b><small>Anna Meyer · Nov 2 · expires Dec 31</small></div><div class="ev"><b>Jonas Koch role Write → Manage</b><small>Anna Meyer · Oct 20</small></div><div class="ev"><b>Design team shared as Read</b><small>Jonas Koch · Sep 4</small></div><div class="ev"><b>Calendar created</b><small>Anna Meyer · Aug 18</small></div></div>')) + "</div>" +
      dm(["Calendar · all columns · CalendarShare · membership_id, team_id, role, shared_by_user_id, expires_at, created_at", "CalendarConnectionCalendar · calendar_id · audit_events"], []) + "</div>";
  }

  /* =====================================================================================================================
     EXTERNAL SYNC AND CONFERENCING (spec §3, §7, §10)
     @screen Calendar > Sync and integrations
     @route  /calendar/sync?tab=connections|runs|conflicts|conferencing
     @perm   personal connections calendar.sync.manage_own · organization-level connections (membership_id null) calendar.sync.manage* · shared-calendar mapping calendar.calendars.manage · conferencing accounts: own = calendar.sync.manage_own; organization = calendar.conferencing.manage*
     @api    POST /calendar/connections/:provider/authorize (returns the provider consent URL) · GET /calendar/connections · PATCH /calendar/connections/:id {status: PAUSED|ACTIVE, default_direction} · DELETE /calendar/connections/:id (disconnect) ·
             GET /calendar/connections/:id/calendars · PATCH /calendar/connection-calendars/:id {sync_enabled, direction, calendar_id, free_busy_only} · POST /calendar/connections/:id/sync (run now) · GET /calendar/sync-runs?connection_id= ·
             GET /calendar/sync-conflicts · POST /calendar/sync-conflicts/:mappingId/resolve {keep: LOCAL|REMOTE} · GET/POST/DELETE /calendar/conferencing-accounts
     @mcp    calendar_sync_read · calendar_sync_manage (connect and disconnect are human-only: an AI agent cannot start OAuth or disconnect)
     @data   CalendarConnection (provider, status, account_email, scopes, default_direction, watch_expires_at, last_synced_at, last_error, last_error_at, disconnected_at; credentials are never returned) · CalendarConnectionCalendar (external_id, name, color, is_primary, access_role, sync_enabled, direction, calendar_id, free_busy_only, last_synced_at, last_error) ·
             CalendarEventSyncMapping (status, external_etag, conflict_snapshot, last_error) · CalendarSyncRun · CalendarConferencingAccount (provider, status, account_email, is_default, settings, last_error)
     @ui     shadcn Tabs, Card per connection, Badge, Switch, Select (direction), Table, Dialog (map a remote calendar), AlertDialog (disconnect: states what happens to synced events), Sheet (conflict diff)
     @states loading · not connected ("Connect Google or Microsoft 365") · PENDING_AUTH · ERROR with last_error and a Reconnect button · token expired · watch channel expiring (renewed automatically) · no-access · partial sync (PARTIAL)
     @audit  connect, disconnect, direction change, sync overwrites (what was overwritten, by which side), conflict resolution
     @note   CREDENTIALS: OAuth tokens live in CalendarConnection.credentials (encrypted at rest, WRITE-ONLY: never returned by API/MCP, never logged, never in audit metadata). Google and Microsoft are NOT part of the organization integration
             keys (IntegrationConnection launch set is OPENAI, RESEND, TWILIO, STRIPE, VIVA_WALLET) so per-member calendar OAuth is deliberately separate; this page must not link to Admin > Integrations for them. Conferencing GOOGLE_MEET and
             MICROSOFT_TEAMS may reuse the calendar connection (calendar_connection_calendar_id), ZOOM and CUSTOM need their own account or a pasted link. DECISION: the OAuth client id and secret of the Logiqdev app registrations (Google, Microsoft, Zoom) are platform infrastructure in the platform environment (like the maps key), not an IntegrationConnection and not a sixth BYOK provider: users and organizations authorize the Logiqdev app, they do not bring their own app. Only per-connection tokens are stored, encrypted.
             Conflict rule: the side with the later provider timestamp wins; the overwritten version is kept in conflict_snapshot and audited. External events never expose content beyond free/busy unless the owner shares the calendar.
     ===================================================================================================================== */
  function sync() {
    const conn = (prov, email, status, tone, dir, last, extra) => cd("<b>" + (prov === "GOOGLE" ? "Google Calendar" : "Microsoft 365") + "</b><span class='r'>" + E(status, tone) + "</span>", prop("Account", email) + prop("Scope", extra[0]) + prop("Default direction", sel(en(dir))) + prop("Last synced", last) + prop("Watch channel", extra[1]) + prop("Permissions", extra[2]) + '<div class="rowx" style="padding:8px 0 0;gap:8px">' + btn("Sync now", "zap", "sm") + btn(status === "ERROR" ? "Reconnect" : "Pause", "", "sm") + btn("Disconnect", "x", "sm") + "</div>" + (status === "ERROR" ? '<div style="height:8px"></div>' + callout("flag", "<b>Last error</b> (Nov 10, 22:14): token refresh failed, the Microsoft admin revoked consent. Reconnect to resume.", "red") : ""));
    const RC = [["anna@logiqdev.com", "Primary", "owner", 1, "TWO_WAY", "Anna Meyer", 0, "2 min ago"], ["Family", "", "reader", 0, "PULL_ONLY", "—", 1, "—"], ["Birthdays", "", "reader", 0, "PULL_ONLY", "—", 0, "—"], ["Logiqdev shared (Microsoft)", "Org", "writer", 1, "TWO_WAY", "Company", 0, "Failed"]];
    const RUNS = [["Today 11:18", "GOOGLE", "webhook", "SUCCEEDED", 3, 1, 0, 0, ""], ["Today 10:02", "GOOGLE", "webhook", "SUCCEEDED", 1, 0, 0, 0, ""], ["Today 06:00", "GOOGLE", "scheduled", "PARTIAL", 42, 7, 1, 1, "1 event rejected: attendee limit"], ["Nov 10 22:14", "MICROSOFT", "scheduled", "FAILED", 0, 0, 0, 0, "invalid_grant: consent revoked"], ["Nov 10 06:00", "GOOGLE", "scheduled", "SUCCEEDED", 38, 4, 2, 0, ""]];
    return '<div class="a-page">' + head("Sync and integrations", "Connect Google Calendar or Microsoft 365, map their calendars and manage video-meeting accounts.", btn("Connect Microsoft 365", "plug") + btn("Connect Google Calendar", "plus", "primary")) +
      callout("lock", "<b>Calendar sign-in is separate from organization integrations.</b> Your Google or Microsoft access token is stored encrypted on the connection and is never shown or exported. Disconnecting stops sync; events already pulled stay until you choose to remove them.") + gap() +
      '<div class="tabset">' + tabs([["c", "Connections", 2], ["r", "Sync runs"], ["x", "Conflicts", 2], ["v", "Video meetings", 3]], "c") +
      pane("c", 1, '<div class="g2" style="align-items:start">' + conn("GOOGLE", "anna@logiqdev.com", "ACTIVE", "green", "TWO_WAY", "2 minutes ago", ["Personal (you)", "renews Nov 18", "Read and write events, free/busy"]) + conn("MICROSOFT", "calendar@logiqdev.com", "ERROR", "red", "PULL_ONLY", "Nov 10, 06:00", ["Organization (shared calendars)", "expired Nov 10", "Read events"]) + "</div>" + gap() +
        cd("<b>Remote calendars</b><span class='r muted'>CalendarConnectionCalendar</span>", tbl(["Remote calendar", "Access", "Sync", "Direction", "Maps to", "Free/busy only", "Last synced"], RC.map((r) => [ink(r[0]) + (r[1] ? " " + E(r[1] === "Org" ? "ORGANIZATION" : "PRIMARY") : ""), r[2], sw(r[3]), E(r[4]), r[5] === "—" ? muted("Not mapped") : "<i class='sw-c c-" + (r[5] === "Company" ? "red" : "blue") + "'></i> " + r[5], sw(r[6]), r[7] === "Failed" ? E("FAILED", "red") : r[7]])).replace('style="margin-top:0"', 'style="margin:0;border:0"'), 1) + gap() +
        callout("shield", "External event content is shown to other members as free/busy only, unless you share the mapped calendar (Calendars > Sharing).")) +
      pane("r", 0, tbl(["Started", "Provider", "Trigger", "Status", ">Pulled", ">Pushed", ">Deleted", ">Conflicts", "Error"], RUNS.map((r) => [r[0], E(r[1]), r[2], E(r[3], r[3] === "SUCCEEDED" ? "green" : r[3] === "FAILED" ? "red" : "yellow"), r[4], r[5], r[6], r[7], r[8] || muted("—")]))) +
      pane("x", 0, cd("<b>Conflicts to resolve</b><span class='r muted'>CalendarEventSyncMapping · CONFLICT</span>", [["Client workshop", "Local: Nov 17 10:00–11:30 (Anna, Nov 9 14:02)", "Google: Nov 17 11:00–12:30 (changed Nov 9 14:09)"], ["Quarterly review", "Local: attendees +2 (Nov 8)", "Google: location changed (Nov 8)"]].map((c) => '<div class="rowx"><div class="grow"><b>' + c[0] + "</b><small>" + c[1] + "</small><small>" + c[2] + "</small></div>" + E("CONFLICT", "red") + btn("Keep local", "", "sm") + btn("Keep Google", "", "sm") + "</div>").join(""), 1)) +
      pane("v", 0, cd("<b>Video meeting accounts</b><span class='r'>" + btn("Add account", "plus", "sm") + "</span>", [["GOOGLE_MEET", "anna@logiqdev.com", "ACTIVE", 1, "via Google connection"], ["MICROSOFT_TEAMS", "calendar@logiqdev.com", "ERROR", 0, "via Microsoft connection"], ["ZOOM", "anna@logiqdev.com", "ACTIVE", 0, "own account"], ["CUSTOM", "Paste a link per event", "ACTIVE", 0, "no account"]].map((a) => '<div class="rowx"><div class="grow"><b>' + en(a[0]) + "</b><small>" + a[1] + " · " + a[4] + "</small></div>" + (a[3] ? E("DEFAULT", "blue") + " " : "") + E(a[2], a[2] === "ERROR" ? "red" : "green") + more + "</div>").join(""), 1)) + "</div>" +
      dm(["CalendarConnection · provider, status, account_email, scopes, default_direction, watch_expires_at, last_synced_at, last_error, last_error_at, disconnected_at (credentials never shown)", "CalendarConnectionCalendar · external_id, name, is_primary, access_role, sync_enabled, direction, calendar_id, free_busy_only, last_synced_at, last_error", "CalendarEventSyncMapping · status, conflict_snapshot, external_etag · CalendarSyncRun · status, trigger, started_at, finished_at, events_pulled, events_pushed, events_deleted, conflicts, error", "CalendarConferencingAccount · provider, status, account_email, is_default, calendar_connection_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     CALENDAR SETTINGS: PREFERENCES, EVENT TYPES, ACCESS (spec §4, §5, §9, §10)
     @screen Calendar > Setup
     @route  /calendar/settings?tab=preferences|types|access|api
     @perm   preferences: calendar.events.read_own (each member edits their own CalendarPreference) · event types: calendar.event_types.manage · access matrix read-only here, edited in Admin (01)
     @api    GET/PUT /calendar/preferences/me · GET/POST/PATCH /calendar/event-types · POST /calendar/event-types/:id/archive · GET /calendar/webhooks/events
     @mcp    calendar_preferences_read · calendar_event_types_manage
     @data   CalendarPreference (default_calendar_id, timezone, default_view, week_start, show_weekends, show_declined_events, default_event_duration, default_reminders, projected_modules, overlay_calendar_ids, availability_schedule_id) ·
             CalendarEventType (name, slug, description, color, icon, is_system, is_default, default_duration_minutes, default_visibility, shows_as_busy, default_reminders, is_customer_facing, sort_order, archived_at)
     @ui     shadcn Tabs, Form, Select, ToggleGroup, Switch, Table, Dialog (event type), colour/icon pickers (tokens and the icon set)
     @states loading · saved toast · validation (slug unique, duration ≥ 0) · system types cannot be deleted or renamed slug (only edited defaults / archived? system types are seeded) · no-access to the event types tab
     @audit  event type created/updated/archived; preference changes are not audited (personal)
     @note   System event types (is_system) are seeded: meeting, customer meeting, kickoff, review, interview, deadline, out of office, focus time, booking. Organizations add their own. CRM meetings are customer-meeting events linked to CRM records.
             Reminder defaults are a PERSONAL preference (spec §9); event types carry the organization default for new events.
     ===================================================================================================================== */
  function settings() {
    const TT = TYPES.map((t, i) => [ink('<i class="sw-c c-' + ["blue", "yellow", "purple", "green", "red", "ash", "mute", "blue", "green"][i] + '"></i> ' + t[1]), "<span class='muted'>" + t[0] + "</span>", t[2] ? t[2] + " min" : "—", E(t[3]), t[4] ? "Busy" : "Free", ["customer-meeting", "booking"].includes(t[0]) ? "Yes" : "No", '<span class="badge">System</span>', more]);
    return '<div class="a-page">' + head("Calendar setup", "Your preferences, event types and who can do what.", btn("Reset to defaults") + btn("Save", "check", "primary")) +
      '<div class="tabset">' + tabs([["p", "My preferences"], ["t", "Event types", 9], ["a", "Access"], ["w", "API and webhooks"]], "p") +
      pane("p", 1, '<div class="g2" style="align-items:start">' + cd("<b>View</b><span class='r muted'>CalendarPreference</span>", f("Default view", segs(["Day", "Week", "Month", "Agenda"], 1)) + two(f("Week starts on", sel("Monday")), f("Time zone", sel("Europe/Athens (GMT+2)", "globe"))) + f("Default calendar for new events", sel("Anna Meyer", "calendar")) + f("Default event length", sel("30 min", "clock")) + f("Availability schedule", sel("Working hours", "clock")) +
        '<div class="rowx"><div class="grow"><b>Show weekends</b></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Show declined events</b><small>Declined events stay hidden but can be restored</small></div>' + sw(0) + "</div>") +
        cd("<b>Reminders and projected dates</b>", f("Default reminders", '<div class="rowx" style="padding:0;gap:8px;flex-wrap:wrap">' + ["Notification · 15 min", "Email · 1 h"].map((r) => '<span class="fchip"><b>' + r + "</b>" + I("x", 12) + "</span>").join("") + btn("Add", "plus", "sm") + "</div>", "Methods: Notification, Email, SMS (needs Twilio connected in Admin > Integrations), Push") + f("Show on my calendar", '<div class="rowx" style="padding:0;gap:8px;flex-wrap:wrap">' + ["Milestones (05)", "Task due dates (06)", "Contract dates (04)", "Leave and holidays (10)"].map((x) => '<span class="seg on">' + x + "</span>").join("") + '<span class="seg">Invoices (08)</span></div>', "projected_modules")) + "</div>") +
      pane("t", 0, '<div class="toolbar">' + search("Search event types") + sel("Show archived") + '<span style="flex:1"></span>' + btn("New event type", "plus", "sm primary") + "</div>" +
        tbl(["Type", "Slug", "Default length", "Default visibility", "Shows as", "Customer-facing", "Origin", ""], TT) + gap() +
        cd("<b>Event type</b><span class='r muted'>new</span>", '<div class="g2" style="align-items:start"><div>' + f("Name", box("Workshop")) + two(f("Slug", box("workshop")), f("Default length", sel("90 min"))) + f("Description", box("Collaborative working session")) + f("Colour and icon", '<div class="rowx" style="gap:8px;padding:0">' + ["blue", "green", "purple", "yellow", "red", "mute"].map((c, i) => '<i class="sw-c lg c-' + c + (i === 2 ? " pick" : "") + '"></i>').join("") + sel("layers", "layers") + "</div>") + "</div><div>" + f("Default visibility", segs(["Private", "Team", "Organization", "Customer visible"], 1)) + '<div class="rowx"><div class="grow"><b>Shows me as busy</b></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Customer-facing</b><small>May be shown in the portal (is_customer_facing)</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Default type for new events</b></div>' + sw(0) + "</div>" + f("Default reminders", box("Notification · 15 min")) + "</div></div>")) +
      pane("a", 0, cd("<b>Who can do what</b><span class='r muted'>read-only, edit roles in Admin</span>", tbl(["Permission", "Owner", "Manager", "Employee", "Customer success", "Viewer"], [["calendar.events.read_own", "✓", "✓", "✓", "✓", "—"], ["calendar.events.read", "✓", "✓", "—", "✓", "—"], ["calendar.events.create / update_own / delete_own", "✓", "✓", "✓", "✓", "—"], ["calendar.events.manage", "✓", "✓", "—", "—", "—"], ["calendar.calendars.read_team", "✓", "✓", "—", "✓", "—"], ["calendar.calendars.manage", "✓", "✓", "—", "—", "—"], ["calendar.availability.read", "✓", "✓", "✓", "✓", "✓"], ["calendar.sync.manage_own", "✓", "✓", "✓", "✓", "—"], ["calendar.booking_links.manage", "✓", "✓", "—", "✓", "—"], ["calendar.resources.manage", "✓", "✓", "—", "—", "—"]]).replace('style="margin-top:0"', 'style="margin:0;border:0"'), 1) + gap() + callout("shield", "Roles shown are indicative (role templates in the permission catalog). Service accounts and API keys receive explicit keys, never a person's full access.")) +
      pane("w", 0, '<div class="g2" style="align-items:start">' + cd("<b>Webhook events</b><span class='r muted'>20 Automation</span>", ["calendar.event_created", "calendar.event_updated", "calendar.event_cancelled", "calendar.attendee_responded", "calendar.booking_created"].map((w) => '<div class="rowx"><div class="grow"><b><code>' + w + "</code></b></div>" + E("ACTIVE", "green") + "</div>").join(""), 1) + cd("<b>MCP tools</b>", ["calendar_events_read / create / update / respond / cancel", "calendar_availability_read", "calendar_booking_links_read / manage", "calendar_bookings_read / manage", "calendar_calendars_read / manage", "calendar_resources_read / manage", "calendar_sync_read / manage"].map((t) => rowx("<code>" + t + "</code>")).join(""), 1) + "</div>") + "</div>" +
      dm(["CalendarPreference · default_calendar_id, timezone, default_view, week_start, show_weekends, show_declined_events, default_event_duration, default_reminders, projected_modules, overlay_calendar_ids, availability_schedule_id", "CalendarEventType · name, slug, description, color, icon, is_system, is_default, default_duration_minutes, default_visibility, shows_as_busy, default_reminders, is_customer_facing, sort_order, archived_at", "Permission / role templates (01) · read-only"], []) + "</div>";
  }

  const MAP = { week, day, month, agenda, quick, create, detail, team, resources, timeoff, availability, bookings, bookingList, bookingDetail, bookingNew, bookingPublic, calendars, calendarNew, calendarDetail, sync, settings };
  const CRUMB = { detail: "Pricing page review", create: "New event", quick: "Quick create", bookingNew: "New booking link", bookingDetail: "Lena Kovac", bookingPublic: "Public booking page", calendarNew: "New calendar", calendarDetail: "Web team" };
  window.VIEWS.calendar = { html: function (s) { return (MAP[s || "week"] || MAP.week)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
