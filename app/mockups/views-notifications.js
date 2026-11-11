/* =====================================================================================================================
   NOTIFICATIONS & ACTIVITY CENTER — module 14 (docs/features/14-notifications-activity-center.md). The single notification engine of the platform.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: NotificationEventType, NotificationEvent, Notification, NotificationDelivery, NotificationTemplate, NotificationOrgSettings, NotificationOrgDefault,
   NotificationRecipientSettings, NotificationPreference, NotificationKeyword, NotificationDigest, NotificationPushDevice, NotificationDeliveryRule + platform AuditEvent (activity feed).
   Enums are real values: NotificationChannel (IN_APP, EMAIL, SMS, PUSH, DESKTOP, SLACK), NotificationRecipientType (MEMBERSHIP, PORTAL_USER), NotificationCategory (GENERAL, MENTION, DIRECT_MESSAGE, REPLY, REACTION,
   ASSIGNMENT, APPROVAL, STATUS_CHANGE, REMINDER, DUE_DATE, INVITATION, SHARE, SLA, SECURITY, BILLING, ANNOUNCEMENT, SYSTEM), NotificationPriority (LOW, NORMAL, IMPORTANT, CRITICAL), NotificationLevel (ALL,
   IMPORTANT_ONLY, MENTIONS_AND_DIRECT, NONE), NotificationDeliveryMode (IMMEDIATE, DIGEST, OFF), NotificationDigestFrequency (IMMEDIATE, HOURLY, DAILY, WEEKLY), NotificationEventStatus (RECEIVED, PROCESSING,
   PROCESSED, IGNORED, FAILED), NotificationDeliveryStatus (PENDING, QUEUED, SENT, DELIVERED, FAILED, SKIPPED, DIGESTED, EXPIRED, CANCELLED), NotificationSkipReason (PREFERENCE_OFF, LEVEL_FILTERED, RECORD_MUTED,
   QUIET_HOURS, CHANNEL_DISABLED, CHANNEL_NOT_AVAILABLE, NO_ADDRESS, NO_DEVICE, DEDUPLICATED, COALESCED, THROTTLED, PERMISSION_DENIED, NOT_CUSTOMER_VISIBLE, EXPIRED), NotificationDigestStatus (OPEN, SCHEDULED,
   SENDING, SENT, EMPTY, FAILED), NotificationPushPlatform (IOS, ANDROID, WEB, DESKTOP), NotificationDeliveryRuleKind (DEDUPLICATE, COALESCE, THROTTLE, SUPPRESS), NotificationCoalesceKey (RECORD, RECORD_AND_ACTOR,
   EVENT_TYPE, RECIPIENT). Reused: ModuleKey (01), RecordEntityType (02).
   Permission keys in the catalog: notifications.preferences.manage_own, notifications.defaults.manage, notifications.templates.manage, notifications.delivery_rules.manage, notifications.audit.read*.
   Keys the spec needs but the catalog lacks are marked @gap on the screen and listed in gaps-14.md.
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - Modules EMIT events; this engine owns recipients, channels, preferences, inbox, digests and delivery. No module builds its own channel or preference store.
     - The in-app Notification row is ALWAYS stored (channel IN_APP never fails silently). Email and SMS are delivered through Communication Center (11, CommMessage); push through NotificationPushDevice.
     - A recipient never gets a notification about a record they cannot read. Opening the source record re-evaluates access; the notification body is not a permission check.
     - Customer Portal recipients (recipient_type PORTAL_USER) only ever receive NotificationEventType.customer_visible events (skip reason NOT_CUSTOMER_VISIBLE otherwise).
     - Preference layers, most specific first: 1 per-record mute/follow (NotificationPreference with entity) · 2 per-user per-event-type channels (NotificationPreference with event_type_id) · 3 per-user global settings
       (NotificationRecipientSettings) · 4 organization defaults (NotificationOrgDefault) · 5 platform defaults (NotificationEventType). Mandatory events (is_mandatory) ignore layers 1-3.
     - Activity (record history) is written by the owning module; this engine does not generate activity. The activity feed screens read audit_events (01), they do not duplicate it.
     - Roles, permissions and ALL access channels from day one: UI, REST, MCP, API keys / service accounts, webhooks (notification.created | delivered | failed | read) and Automation (20).
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const bar = (p) => '<span class="bar"><i style="width:' + p + "%\"></i></span>" + p + "%";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const gap = (h) => '<div style="height:' + (h || 12) + 'px"></div>';
  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"], SY: ["System", "b"] };
  const av = (a) => AV(a, PEOPLE[a][1]);
  const wh = (a, s) => who(a, PEOPLE[a][1], PEOPLE[a][0], s || "");
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const rowsw = (t, s, on, locked) => '<div class="rowx"><div class="grow"><b>' + t + "</b><small>" + s + "</small></div>" + (locked ? '<span class="muted">' + I("lock", 13) + "</span>" : "") + sw(on) + "</div>";
  const chip = (f2, o, v) => '<span class="fchip"><b>' + f2 + "</b><i>" + o + "</i><span>" + v + "</span>" + I("x", 12) + "</span>";
  const filterBar = (chips, extra) => '<div class="fbar"><div class="fchips">' + chips.map((c) => chip(c[0], c[1], c[2])).join("") + '<button class="btn sm ghost">' + I("plus", 13) + ' Add filter</button></div><div class="fright">' + (extra || "") + "</div></div>";
  const seg = (arr, on) => '<div class="rowx" style="gap:8px;padding:0;flex-wrap:wrap">' + arr.map((t) => '<span class="seg' + (t === on ? " on" : "") + '">' + t + "</span>").join("") + "</div>";

  /* @impl colour maps: one shared statusVariant(enumName, value) in production. Tokens only, so light and dark both work. */
  const PRI = { LOW: "", NORMAL: "", IMPORTANT: "yellow", CRITICAL: "red" };
  const DST = { PENDING: "", QUEUED: "blue", SENT: "blue", DELIVERED: "green", FAILED: "red", SKIPPED: "yellow", DIGESTED: "purple", EXPIRED: "", CANCELLED: "" };
  const EST = { RECEIVED: "blue", PROCESSING: "blue", PROCESSED: "green", IGNORED: "", FAILED: "red" };
  const CHN = { IN_APP: "bell", EMAIL: "mail", SMS: "sms", PUSH: "phone", DESKTOP: "panel", SLACK: "hash" };
  const chn = (c) => '<span class="nt-ch" title="NotificationChannel ' + c + '">' + I(CHN[c], 13) + U.en(c) + "</span>";
  const CATICON = { GENERAL: "bell", MENTION: "at", DIRECT_MESSAGE: "chat", REPLY: "chat", REACTION: "star", ASSIGNMENT: "tasks", APPROVAL: "check", STATUS_CHANGE: "layers", REMINDER: "clock", DUE_DATE: "calendar", INVITATION: "mail", SHARE: "link", SLA: "flag", SECURITY: "shield", BILLING: "receipt", ANNOUNCEMENT: "sparkles", SYSTEM: "settings" };
  const catIc = (c, p) => '<span class="nt-ic' + (p === "CRITICAL" ? " crit" : p === "IMPORTANT" ? " imp" : "") + '" title="NotificationCategory ' + c + '">' + I(CATICON[c], 15) + "</span>";
  const mod = (m) => '<span class="badge" title="ModuleKey ' + m + '">' + U.modLabel(m) + "</span>";

  /* id, module, category, priority, title, body, entity_type, entity_label, actor, age, state, requires_action, coalesced, mandatory */
  const N = [
    ["n1", "TASKS", "ASSIGNMENT", "NORMAL", "Anna Meyer assigned you WEB-142", "Rebuild pricing page hero with new brand system · due Nov 14", "TASK", "WEB-142", "AM", "5 min", "unread", 0, 1, 0],
    ["n2", "MESSAGING", "MENTION", "IMPORTANT", "Marco Silva mentioned you in #web-design", "“@you can you confirm the hero copy before standup?”", "MESSAGE", "#web-design", "MS", "12 min", "unread", 0, 1, 0],
    ["n3", "CONTRACTS", "APPROVAL", "IMPORTANT", "Approval requested: MSA Northwind GmbH", "Legal review passed. Value 48,000 EUR · term 24 months", "CONTRACT", "CTR-0031", "SJ", "1 h", "unread", 1, 1, 0],
    ["n4", "FINANCE", "BILLING", "CRITICAL", "Payment failed: INV-2026-0412 (Acme Corp)", "Card declined on the 2nd attempt. Next retry Nov 12.", "INVOICE", "INV-2026-0412", "SY", "2 h", "unread", 0, 1, 1],
    ["n5", "SUPPORT", "SLA", "CRITICAL", "SLA breach in 20 min: TCK-2041", "First response target 4 h · customer Acme Corp · assigned to you", "TICKET", "TCK-2041", "SY", "3 h", "unread", 0, 1, 1],
    ["n6", "EMPLOYEES", "APPROVAL", "NORMAL", "Leave request: Sofia Jensen, Dec 22 to Dec 29", "6 working days · balance after 4 · no team conflicts", "LEAVE_REQUEST", "LR-0198", "SJ", "4 h", "unread", 1, 1, 0],
    ["n7", "TASKS", "STATUS_CHANGE", "LOW", "6 updates on WEB-139 Stripe webhook retries", "Status, 2 comments, estimate and due date changed by 3 people", "TASK", "WEB-139", "AM", "Yesterday", "read", 0, 6, 0],
    ["n8", "CALENDAR", "REMINDER", "NORMAL", "Client kickoff starts in 30 min", "Acme Rebrand Website · Meet link ready · 5 attendees", "CALENDAR_EVENT", "Client kickoff", "SY", "Yesterday", "read", 0, 1, 0],
    ["n9", "PROPOSALS", "STATUS_CHANGE", "NORMAL", "Proposal PRO-0088 was viewed by Lena Kovac", "3rd view this week · 6 min on the pricing section", "PROPOSAL", "PRO-0088", "SY", "Nov 9", "read", 0, 1, 0],
    ["n10", "PROJECTS", "DUE_DATE", "NORMAL", "Milestone “Launch” is due in 3 days", "Acme Rebrand Website · 2 open tasks, 1 blocked", "PROJECT_MILESTONE", "Launch", "SY", "Nov 9", "read", 0, 1, 0],
    ["n11", "ADMINISTRATION", "SECURITY", "CRITICAL", "New sign-in from Berlin on a new device", "Chrome on macOS · IP 84.x.x.x · 02:14 · was this you?", "", "", "SY", "Nov 6", "archived", 0, 1, 1],
    ["n12", "DOCUMENTS", "SHARE", "LOW", "Jonas Koch shared “Q4 brand guidelines.pdf”", "View access · expires Dec 31", "DOCUMENT", "Q4 brand guidelines.pdf", "JK", "Snoozed to tomorrow 09:00", "snoozed", 0, 1, 0],
  ];
  /* @impl row = Notification. unread = read_at null · archived = archived_at · snoozed = snoozed_until in the future (hidden from Unread/All until it wakes, then it returns on top with a "Snoozed" tag).
       Coalesced rows (coalesced_count > 1, group_key) show "+N" and expand in place. Mandatory rows (is_mandatory) cannot be archived by bulk actions only marked read. Actions come from Notification.actions
       (Json, subset of NotificationEventType.available_actions): requires_action rows show inline buttons and stay in the Approvals list until action_taken is set. */
  function rowN(n, o) {
    o = o || {};
    const st = n[10], un = st === "unread";
    const acts = n[11] ? '<button class="btn sm primary">' + (n[1] === "EMPLOYEES" ? "Approve" : "Approve") + '</button><button class="btn sm">Reject</button>' : "";
    return '<div class="nt-row' + (un ? " unread" : "") + (o.sel ? " sel" : "") + '">' + (o.bulk ? cb(o.on) : "") + '<span class="nt-dot" title="' + (un ? "read_at is null" : "read_at set") + '"></span>' + catIc(n[2], n[3]) +
      '<div class="nt-main"><div class="nt-t">' + n[4] + (n[12] > 1 ? ' <span class="badge">+' + n[12] + " coalesced</span>" : "") + (n[13] ? ' <span class="nt-lock" title="is_mandatory">' + I("lock", 12) + "</span>" : "") + '</div><div class="nt-b">' + n[5] + "</div>" +
      '<div class="nt-meta">' + mod(n[1]) + (n[3] !== "NORMAL" ? " " + E(n[3], PRI[n[3]]) : "") + (n[6] ? '<span class="muted">' + I("link", 12) + n[7] + "</span>" : "") + (n[11] ? E("requires_action", "blue") : "") + (st === "snoozed" ? '<span class="badge yellow">Snoozed</span>' : "") + "</div></div>" +
      '<div class="nt-side"><span class="muted nt-age">' + n[9] + '</span><div class="nt-acts">' + (acts || '<button class="btn ghost sm icon" title="Mark ' + (un ? "read" : "unread") + '">' + I(un ? "check" : "inbox", 14) + '</button><button class="btn ghost sm icon" title="Snooze">' + I("clock", 14) + '</button><button class="btn ghost sm icon" title="Archive">' + I("box", 14) + "</button>") + more + "</div></div></div>";
  }
  const nlist = (rows, o) => '<div class="nt-list">' + (rows.length ? rows.map((n) => rowN(n, o)).join("") : '<div class="nt-empty">' + I("inbox", 22) + "<b>You are all caught up</b><span>New notifications appear here in real time.</span></div>") + "</div>";
  const part = (st) => N.filter((n) => (st === "all" ? n[10] !== "archived" && n[10] !== "snoozed" : n[10] === st));

  /* =====================================================================================================================
     INBOX (spec §7) — the Activity Center inbox of the signed-in user
     @screen Inbox
     @route  /notifications/inbox?tab=unread|all|read|archived|snoozed&module=&category=&project=&q= · deep link /notifications/:notificationId opens the detail
     @perm   own inbox: any member (recipient_membership_id = caller; no extra key) · preferences link notifications.preferences.manage_own · @gap the spec lists no key to READ the own inbox (implicit, see gaps-14.md)
     @api    GET /notifications?state=&module=&category=&entity_type=&entity_id=&priority=&q=&cursor= · PATCH /notifications/:id {read|unread|archived|snoozed_until} · POST /notifications/bulk {ids|filter, action} · POST /notifications/read-all {filter?}
             · GET /notifications/unread-count · realtime channel (SSE/WebSocket) pushes new rows to the bell and this list
     @mcp    notifications_notifications_list · notifications_notifications_mark_read · notifications_notifications_snooze (own inbox only; an AI agent acts as the caller)
     @data   Notification (module, category, priority, title, body, icon, action_url, entity_type, entity_id, entity_label, actor_membership_id, is_mandatory, requires_action, actions, action_taken, group_key, coalesced_count,
             last_event_at, seen_at, read_at, archived_at, snoozed_until, expires_at) · SavedView (entity_type NOTIFICATION, 02)
     @ui     shadcn Tabs (state), Input search, filter bar with Popover+Command pickers, Checkbox rows with a sticky bulk bar, DropdownMenu snooze presets (Later today, Tomorrow 09:00, Next week, Pick date and time), Badge, Avatar, Tooltip
     @states loading skeleton rows · empty per tab ("You are all caught up") · error with retry · offline banner (list stays readable) · no-access (portal-only users see the portal inbox instead)
     @audit  mandatory/security notification read and action_taken are audited (notifications.audit.read); normal read/archive changes are not audited
     @note   "seen" (bell opened, seen_at) is different from "read" (clicked or marked, read_at): the bell badge counts rows with seen_at null, the list highlight uses read_at null. Project filter = Notification.entity_type PROJECT or
             a record that belongs to the project. @gap Notification has no project_id/company_id context column, so "by project" cannot be indexed (gaps-14.md #2). Mentions = category MENTION or DIRECT_MESSAGE.
             Mark all read respects the active filter and never touches rows with requires_action (those stay until acted on). Snoozed rows return on top at snoozed_until (a scheduled job clears the field and re-seen_at null).
     ===================================================================================================================== */
  function inbox() {
    const bulk = '<div class="bulk"><span class="cb on"></span><b>3 selected</b><span class="muted">sticky bar, appears when rows are selected</span><span style="flex:1"></span>' + btn("Mark read", "check", "sm") + sel("Snooze…", "clock") + btn("Archive", "box", "sm") + btn("Mark unread", "inbox", "sm") + "</div>";
    return '<div class="a-page">' + head("Inbox", "Everything that needs your attention, across every module.", btn("Mark all read", "check") + btn("Preferences", "settings")) +
      '<div class="mini-stats">' + stat("Unread", 6, "2 need action") + stat("Mentions", 1, "last 24 h") + stat("Approvals waiting", 2, "pinned below") + stat("Snoozed", 1, "wakes tomorrow") + stat("Critical", 3, "mandatory, cannot be muted", 1) + "</div>" +
      '<div class="toolbar">' + search("Search title and body") + sel("Module: All", "grid") + sel("Type: All", "tag") + sel("Project: Any", "folder") + sel("Priority: Any", "flag") + sel("Mentions only", "at") + sel("Views: Needs action", "star") + "</div>" +
      filterBar([["Module", "is any of", "Tasks, Messaging, Contracts"], ["Category", "is any of", "Mention, Assignment, Approval"], ["Project", "is", "Acme Rebrand Website"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="tabset">' + tabs([["u", "Unread", 6], ["a", "All", 10], ["r", "Read", 4], ["z", "Snoozed", 1], ["x", "Archived", 1]], "u") +
      pane("u", 1, bulk + '<div class="nt-pin">' + I("pin", 13) + " <b>Waiting on you</b> · 2 approvals (requires_action, action_taken empty)</div>" + nlist(part("unread"), { bulk: 1, on: 0 })) +
      pane("a", 0, nlist(part("all"), { bulk: 1 })) +
      pane("r", 0, nlist(part("read"), { bulk: 1 })) +
      pane("z", 0, nlist(part("snoozed"), { bulk: 1 })) +
      pane("x", 0, nlist(part("archived"), { bulk: 1 })) + "</div>" +
      '<div class="pager"><span class="muted">1–12 of 58 · cursor pagination, virtualized beyond 50 rows</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["Notification · module, category, priority, title, body, entity_type, entity_id, entity_label, actor_membership_id, is_mandatory, requires_action, actions, action_taken, group_key, coalesced_count, seen_at, read_at, archived_at, snoozed_until", "SavedView · entity_type NOTIFICATION (saved inbox filters)"], ["Notification has no project_id / company_id context column (filter by project)", "No permission key to read the own inbox"]) + "</div>";
  }

  /* =====================================================================================================================
     APPROVALS & ACTIONS — pinned section as its own page (spec §7 "Pinned approvals section")
     @screen Waiting on you
     @route  /notifications/approvals?module=
     @perm   own rows only; the ACTION itself is checked by the owning module (e.g. contracts.approvals.decide) when the button is pressed, not by this module
     @api    GET /notifications?requires_action=true&action_taken=null · POST /notifications/:id/actions {action: <key from actions>, comment?} · the engine calls the owning module's action endpoint and writes action_taken
     @mcp    notifications_notifications_act (sensitive: confirmation when an AI agent calls it)
     @data   Notification (requires_action, actions, action_taken, action_taken_at, entity_type, entity_id) · NotificationEventType (available_actions)
     @ui     Card list with inline Buttons, AlertDialog for destructive actions (Reject asks for a reason), Tabs by module
     @states loading · empty ("Nothing is waiting on you") · error · action failed (owner module refused: the row stays, with the reason) · already handled by someone else (row shows who acted)
     @audit  every action taken is audited with the notification id, the action key and the owning record
     @note   Actions come from the event type's available_actions (e.g. approve, reject, reply, complete, snooze, open). If the record state changed meanwhile (already approved), the engine refreshes the row and drops the buttons.
     ===================================================================================================================== */
  function approvals() {
    const a = N.filter((n) => n[11]);
    return '<div class="a-page">' + head("Waiting on you", "Approvals and requests that need an answer from you.", btn("Inbox", "inbox")) +
      '<div class="toolbar">' + search("Search requests") + sel("Module: All", "grid") + sel("Priority: Any", "flag") + "</div>" +
      nlist(a, {}) + gap() +
      cd("<b>Available actions by event type</b><span class='r muted'>NotificationEventType.available_actions</span>", tbl(["Event key", "Module", "Actions"], [["contract.approval_requested", mod("CONTRACTS"), tok("approve") + tok("reject") + tok("open")], ["leave.requested", mod("EMPLOYEES"), tok("approve") + tok("reject") + tok("open")], ["expense.awaiting_approval", mod("INCOME_EXPENSE"), tok("approve") + tok("reject")], ["message.mention", mod("MESSAGING"), tok("reply") + tok("open")], ["task.assigned", mod("TASKS"), tok("complete") + tok("open") + tok("snooze")]]), 1) +
      dm(["Notification · requires_action, actions, action_taken, action_taken_at", "NotificationEventType · available_actions"], []) + "</div>";
  }

  /* =====================================================================================================================
     NOTIFICATION DETAIL + ROUTING (spec §7, §11)
     @screen Notification detail
     @route  /notifications/:notificationId (side panel from the inbox; full page by direct link)
     @perm   own notification only (404 for others, never 403: do not leak existence) · re-evaluated source access when opening the record · delivery details of ANOTHER user's notification need notifications.audit.read*
     @api    GET /notifications/:id · POST /notifications/:id/open (marks read, returns the resolved route) · POST /notifications/:id/actions · GET /notifications/:id/deliveries (audit.read for non-owners)
     @mcp    notifications_notifications_read
     @data   Notification (all columns) · NotificationEvent (via event_id: payload, idempotency_key, actor) · NotificationDelivery (own deliveries: channel, status, delivered_at, opened_at) · NotificationEventType
     @ui     Sheet (side panel) or page, Badge, Button, Tabs (Overview, Delivery, Payload), Tooltip on enum raw values
     @states loading · not found / expired · source record no longer accessible ("You no longer have access to this record", the notification stays readable) · error
     @audit  opening a mandatory/security notification, action taken
     @note   ROUTING: action_url is a deep link computed by the owning module (/tasks/WEB-142, /contracts/CTR-0031?tab=approvals). On open the engine marks read_at, then navigates; if the entity was deleted or access was lost the
             detail explains it instead of showing a 404. Customer portal recipients get portal URLs (portal_membership_id) never internal routes. Payload tab is only visible with notifications.audit.read*.
     ===================================================================================================================== */
  function detail() {
    const n = N[2];
    return '<div class="a-page">' + head("Approval requested: MSA Northwind GmbH", "Contracts · Notification n3 · 1 hour ago", btn("Mark unread", "inbox") + btn("Snooze", "clock") + btn("Open contract", "link", "primary")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Message</b>", "<p>Legal review passed. Value <b>48,000 EUR</b>, term 24 months. Sofia Jensen requested your approval.</p>" + '<div class="rowx" style="padding:8px 0;gap:8px"><button class="btn primary">Approve</button><button class="btn">Reject</button><button class="btn ghost">Open record</button></div><div class="sub-note">Actions from Notification.actions. Reject asks for a reason; the result is written to action_taken and action_taken_at.</div>') + gap() +
      '<div class="tabset">' + tabs([["o", "Delivery"], ["p", "Event payload"], ["r", "Routing"]], "o") +
      pane("o", 1, tbl(["Channel", "Status", "Detail", "Sent", "Opened"], [[chn("IN_APP"), E("DELIVERED", "green"), "Stored, bell updated", "10:14", "10:21"], [chn("EMAIL"), E("DELIVERED", "green"), "anna@agency.com via Communication (11)", "10:14", "10:40"], [chn("PUSH"), E("SKIPPED", "yellow") + " " + E("QUIET_HOURS"), "Deferred, critical flag off", "—", "—"]])) +
      pane("p", 0, '<div class="code">{\n  "event_key": "contract.approval_requested",\n  "entity": { "type": "CONTRACT", "id": "ctr_31", "label": "CTR-0031" },\n  "actor_membership_id": "mem_sj",\n  "targets": [{ "type": "ROLE", "key": "legal-approver" }],\n  "payload": { "value": 48000, "currency": "EUR", "term_months": 24 },\n  "idempotency_key": "ctr_31:approval:3"\n}</div>') +
      pane("r", 0, '<div class="tl"><div class="ev"><b>Resolved route</b><small>/contracts/CTR-0031?tab=approvals (Notification.action_url)</small></div><div class="ev"><b>Access check on open</b><small>contracts.contracts.read on CTR-0031 is re-evaluated; denied shows the "no longer accessible" state</small></div><div class="ev"><b>Audience reason</b><small>audience_reason: role legal-approver in branch Athens</small></div></div>') + "</div>" +
      "</div><div>" +
      cd("<b>Properties</b>", kv("Module", mod("CONTRACTS")) + kv("Category", E("APPROVAL")) + kv("Priority", E("IMPORTANT", "yellow")) + kv("Event key", "contract.approval_requested") + kv("Actor", wh("SJ")) + kv("Record", "CONTRACT · CTR-0031") + kv("Requires action", sw(1)) + kv("Mandatory", sw(0)) + kv("Seen", "10:15") + kv("Read", "10:21") + kv("Expires", "—") + kv("Group key", "contract:ctr_31")) + gap() +
      cd("<b>Recipient</b>", kv("Type", E("MEMBERSHIP")) + kv("Member", wh("AM")) + kv("Audience reason", "Role legal-approver")) + "</div></div>" +
      dm(["Notification · all columns", "NotificationEvent · payload, idempotency_key, targets, actor_membership_id", "NotificationDelivery · channel, status, skip_reason, delivered_at, opened_at", "NotificationEventType · available_actions"], []) + "</div>";
  }

  /* =====================================================================================================================
     BELL POPOVER — component screen (spec §7). Lives in the app shell top bar on every page.
     @screen Bell popover (component)
     @route  none: opens from the bell in the top bar anywhere; keyboard shortcut g then n; "Open inbox" goes to /notifications/inbox
     @perm   own notifications; "Preferences" link needs notifications.preferences.manage_own
     @api    GET /notifications/unread-count (badge) · GET /notifications?state=unread&limit=8 · POST /notifications/:id/seen on open (sets seen_at, clears the badge) · realtime subscription (SSE/WebSocket) delivers new rows
     @mcp    none (UI component over the inbox tools)
     @data   Notification (title, body, category, priority, entity_label, actor, read_at, seen_at, requires_action, actions) · NotificationRecipientSettings (sound_enabled, dnd_enabled, show_previews)
     @ui     shadcn Popover with ScrollArea, Tabs (All, Mentions, Approvals), Button, Badge, Avatar; Toast for newly arrived rows while the popover is closed
     @states loading skeleton (3 rows) · empty ("You are all caught up") · offline ("Reconnecting…", list stays) · DND active (bell shows a moon dot, no sound, badge still counts) · preview hidden (show_previews false shows "New message" without body)
     @audit  none
     @note   Badge = count of seen_at null, capped at 99+. Opening the popover marks the VISIBLE rows seen, not read. Rows are compact: same Notification row, 1-line body. Critical rows pin on top. Sound only when
             sound_enabled and DND off. With dnd_allow_critical the critical rows still ring through DND.
     ===================================================================================================================== */
  function bell() {
    const pr = (n) => '<div class="nt-prow' + (n[10] === "unread" ? " unread" : "") + '">' + catIc(n[2], n[3]) + '<div class="nt-main"><div class="nt-t">' + n[4] + '</div><div class="nt-b">' + n[5] + '</div><div class="nt-meta"><span class="muted">' + n[9] + " · " + U.modLabel(n[1]) + "</span></div></div>" + (n[10] === "unread" ? '<span class="nt-dot"></span>' : "") + "</div>";
    return '<div class="a-page">' + head("Bell popover", "Design of the top-bar notification popover (component screen).", btn("Open inbox", "inbox")) +
      '<div class="g2" style="align-items:start"><div><div class="nt-bar"><span class="muted">Top bar</span><span style="flex:1"></span><span class="nt-belly">' + I("bell", 18) + '<i class="nt-badge">6</i></span>' + av("AM") + "</div>" +
      '<div class="nt-pop"><div class="nt-pop-h"><b>Notifications</b><span style="flex:1"></span><button class="btn ghost sm">Mark all read</button><button class="btn ghost sm icon">' + I("settings", 14) + "</button></div>" +
      '<div class="nt-pop-t">' + ["All", "Mentions", "Approvals"].map((t, i) => '<span class="seg' + (i === 0 ? " on" : "") + '">' + t + "</span>").join("") + "</div>" +
      '<div class="nt-pop-b">' + [N[3], N[4], N[1], N[2], N[0], N[6]].map(pr).join("") + "</div>" +
      '<div class="nt-pop-f"><button class="btn sm">Open inbox</button><span class="muted">6 unread · 2 need action</span></div></div></div>' +
      "<div>" +
      cd("<b>Behavior</b>", rowsw("Badge counts seen_at null", "Opening the popover marks visible rows seen, not read", 1) + rowsw("Critical rows pinned on top", "priority CRITICAL, mandatory rows never leave the list unread", 1) + rowsw("Sound and toast", "NotificationRecipientSettings.sound_enabled, off during DND", 1) + rowsw("Hide previews", "show_previews false renders “New notification” without body", 0)) + gap() +
      cd("<b>Variants</b>", '<div class="rowx"><div class="grow"><b>Empty</b><small>Inbox icon, “You are all caught up”</small></div></div><div class="rowx"><div class="grow"><b>Do Not Disturb</b><small>Moon dot on the bell, badge still counts, no sound</small></div></div><div class="rowx"><div class="grow"><b>Offline / reconnecting</b><small>Thin banner, last known list stays readable</small></div></div><div class="rowx"><div class="grow"><b>Portal user</b><small>Same component in the customer portal shell, customer-safe events only</small></div></div>', 1) + "</div></div>" +
      dm(["Notification · title, body, category, priority, read_at, seen_at, requires_action", "NotificationRecipientSettings · sound_enabled, dnd_enabled, show_previews, dnd_allow_critical"], []) + "</div>";
  }

  /* ---------------- activity feed (audit_events) ---------------- */
  const ACT = [
    ["MS", "moved <b>WEB-142</b> to In progress", "task.status_changed", "TASK", "Acme Rebrand Website", "10:42", "TASKS"],
    ["AM", "commented on <b>WEB-139</b> (internal)", "task.comment_created", "TASK", "Stripe Billing Migration", "10:31", "TASKS"],
    ["SJ", "sent proposal <b>PRO-0088</b> to Lena Kovac", "proposal.sent", "PROPOSAL", "Acme Corp", "10:05", "PROPOSALS"],
    ["SY", "invoice <b>INV-2026-0412</b> payment failed", "invoice.payment_failed", "INVOICE", "Acme Corp", "09:48", "FINANCE"],
    ["JK", "uploaded <b>Q4 brand guidelines.pdf</b>", "document.created", "DOCUMENT", "Brand Strategy Sprint", "09:20", "DOCUMENTS"],
    ["KL", "changed the health of <b>Mobile App v2</b> to At risk", "project.health_changed", "PROJECT", "Mobile App v2", "Yesterday", "PROJECTS"],
    ["AM", "published a status update to the customer portal", "portal.status_update_published", "PROJECT", "Acme Rebrand Website", "Yesterday", "CUSTOMER_PORTAL"],
    ["SJ", "approved leave request <b>LR-0189</b>", "leave.approved", "LEAVE_REQUEST", "—", "Nov 9", "EMPLOYEES"],
  ];
  /* =====================================================================================================================
     ACTIVITY FEED (spec §2 Activity, §7) — organization, project and customer scopes
     @screen Activity feed
     @route  /notifications/activity?scope=organization|project|customer&project=&company=&module=&actor=&from=&to=
     @perm   @gap no key in the catalog: the feed needs notifications.activity.read (organization scope) and shows only records the caller can read; project/customer scopes use the owning module read keys · full audit trail
             remains notifications.audit.read* / 01 audit keys
     @api    GET /activity?scope=&project_id=&company_id=&module=&actor_id=&event_type=&from=&to=&q=&cursor= (read model over audit_events, filtered per record permission)
     @mcp    notifications_activity_read (@gap, same key)
     @data   AuditEvent (actor_type, actor_user_id, actor_service_account_id, event_type, resource_type, resource_id, branch_id, metadata, created_at) · read-only join to the owning record for the label
     @ui     shadcn ToggleGroup (scope), filter bar with Popover+Command, grouped timeline (date headers), Avatar, Badge, Skeleton, "Load more" with cursor
     @states loading · empty ("No activity for these filters") · error · no-access (scope hidden when the caller lacks the key) · partial results note when records are hidden by permission
     @audit  the feed itself is a read model, no audit; export of the feed is audited
     @note   The feed does NOT create activity: owning modules write it (and audit_events stores it). Scope PROJECT shows events whose record belongs to a project (05); scope CUSTOMER shows events of one company (02) and can
             be switched to "customer-visible only" to preview what the portal shows (07). @gap audit_events has no project_id, company_id or customer_visible column, and no human summary: today only resource_type/resource_id/metadata,
             so project and customer scopes need an indexed context or a dedicated ActivityEvent read model (gaps-14.md #3).
     ===================================================================================================================== */
  function activity(scope) {
    scope = scope || "organization";
    const T = { organization: ["Organization", [["Module", "is any of", "Tasks, Proposals, Finance"], ["Date", "between", "Nov 5 – Nov 11"]]], project: ["Project", [["Project", "is", "Acme Rebrand Website"], ["Module", "is any of", "Tasks, Projects, Documents"]]], customer: ["Customer", [["Company", "is", "Acme Corp"], ["Visibility", "is", "customer-visible only"]]] }[scope];
    const rows = scope === "organization" ? ACT : scope === "project" ? ACT.filter((r) => /Acme Rebrand|Mobile|Stripe/.test(r[4])) : ACT.filter((r) => /Acme Corp|Acme Rebrand/.test(r[4]));
    const days = [["Today", rows.filter((r) => /:/.test(r[5]))], ["Earlier", rows.filter((r) => !/:/.test(r[5]))]];
    return '<div class="a-page">' + head("Activity", "What happened across the " + (scope === "organization" ? "organization" : scope === "project" ? "project" : "customer account") + ".", btn("Export", "file") + btn("Notification settings", "settings")) +
      '<div class="toolbar">' + seg(["Organization", "Project", "Customer"], T[0]) + search("Search activity") + (scope === "project" ? sel("Acme Rebrand Website", "folder") : scope === "customer" ? sel("Acme Corp", "building") : sel("All branches", "building")) + sel("Actor: Anyone", "users") + sel("Event type: All", "tag") + sel("Last 7 days", "calendar") + "</div>" +
      filterBar(T[1], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="g2" style="grid-template-columns:1.8fr 1fr;align-items:start"><div>' +
      days.map((d) => d[1].length ? '<div class="nt-day">' + d[0] + '</div><div class="nt-list">' + d[1].map((r) => '<div class="nt-row act"><span class="nt-av">' + av(r[0]) + '</span><div class="nt-main"><div class="nt-t"><b>' + PEOPLE[r[0]][0] + "</b> " + r[1] + '</div><div class="nt-meta">' + mod(r[6]) + '<span class="muted">' + I("link", 12) + r[3] + " · " + r[4] + '</span><span class="muted" title="AuditEvent.event_type">' + r[2] + '</span></div></div><span class="muted nt-age">' + r[5] + "</span></div>").join("") + "</div>" : "").join("") +
      '<div class="pager"><span class="muted">Showing ' + rows.length + " events</span><span style=\"flex:1\"></span>" + btn("Load more", "", "sm") + "</div></div><div>" +
      cd("<b>" + (scope === "customer" ? "Customer preview" : "Summary") + "</b>", scope === "customer" ? callout("shield", "Shows exactly what Acme Corp sees in the portal. Internal comments and internal-only events are removed (customer_visible).", "") : kv("Events today", "42") + kv("Most active module", "Tasks") + kv("Most active person", "Marco Silva") + kv("Automation actions", "7 by service accounts")) + gap() +
      cd("<b>Follow this " + (scope === "customer" ? "customer" : scope === "project" ? "project" : "feed") + "</b>", rowsw("Notify me of important activity", "Creates a NotificationPreference with is_following true", scope !== "organization") + rowsw("Digest instead of immediate", "NotificationDeliveryMode DIGEST", 0)) + "</div></div>" +
      dm(["AuditEvent · actor_type, actor_user_id, actor_service_account_id, event_type, resource_type, resource_id, branch_id, metadata, created_at", "NotificationPreference · entity_type, entity_id, is_following (follow control)"], ["audit_events has no project_id, company_id, customer_visible or summary column", "No permission key notifications.activity.read"]) + "</div>";
  }

  /* =====================================================================================================================
     MY PREFERENCES (spec §6) — layers 2 and 3 of the preference model
     @screen Notification preferences
     @route  /notifications/preferences?tab=general|events|channels
     @perm   notifications.preferences.manage_own · mandatory events and channels disabled by the organization are shown locked
     @api    GET/PATCH /notifications/preferences/settings (NotificationRecipientSettings) · GET /notifications/preferences/events · PUT /notifications/preferences/events/:eventTypeId {channel, enabled, delivery_mode, level}
             · POST /notifications/preferences/reset
     @mcp    notifications_preferences_manage_own
     @data   NotificationRecipientSettings (level, in_app_enabled, email_enabled, sms_enabled, push_enabled, desktop_enabled, sound_enabled, show_previews, thread_notifications, reaction_notifications, keyword_notifications, language,
             timezone) · NotificationPreference (event_type_id, module, channel, enabled, level, delivery_mode) · NotificationEventType (default_channels, mandatory_by_default, forced_channels, supports_digest) · NotificationOrgDefault (inherited value) · NotificationOrgSettings (enabled_channels)
     @ui     Tabs, Switch, shadcn Select (level, mode), matrix table with Checkbox per channel, Accordion per module, Tooltip explaining "inherited from organization", AlertDialog for reset
     @states loading · saving (optimistic, rollback with toast) · error · locked by organization (channel disabled or mandatory) · no-access
     @audit  not audited for non-mandatory settings (personal); organization-forced changes are audited under defaults
     @note   Each cell shows the EFFECTIVE value and where it comes from (own / organization / platform). Changing a cell writes a NotificationPreference row; "Reset to default" deletes the row. Mandatory events show a lock and
             cannot be switched off (security alerts, SLA breaches assigned to you, legal notices). SMS and push cells only exist when the org enabled the channel (NotificationOrgSettings.enabled_channels) and, for push,
             a device is registered (else the delivery is SKIPPED with NO_DEVICE).
     ===================================================================================================================== */
  function prefs() {
    const c = (on, lock, inh) => '<td class="nt-c">' + (lock ? '<span class="muted" title="Mandatory: cannot be turned off">' + I("lock", 13) + "</span>" : cb(on)) + (inh ? '<i class="nt-inh" title="Inherited from organization default"></i>' : "") + "</td>";
    const ev = (name, key, m, a, b, c2, d, e, mode, lock) => "<tr><td><b class='ink'>" + name + "</b><div class='muted' style='font-size:12px'>" + key + "</div></td>" + c(a, lock, 0) + c(b, lock, 1) + c(c2, 0, 1) + c(d, 0, 0) + c(e, 0, 1) + "<td>" + sel(mode) + "</td></tr>";
    const head2 = "<thead><tr><th>Event</th><th class='nt-c'>In-app</th><th class='nt-c'>Email</th><th class='nt-c'>Push</th><th class='nt-c'>SMS</th><th class='nt-c'>Desktop</th><th>Delivery</th></tr></thead>";
    const grp = (m, rows) => '<div class="cd"><div class="cd-h"><b>' + U.modLabel(m) + '</b><span class="r muted">NotificationPreference · module ' + m + '</span></div><div class="cd-b flush"><table>' + head2 + "<tbody>" + rows.join("") + "</tbody></table></div></div>" + gap(10);
    return '<div class="a-page">' + head("Notification preferences", "Choose what you hear about and where. Applies to every module.", btn("Reset to defaults", "x") + btn("Save", "check", "primary")) +
      '<div class="tabset">' + tabs([["g", "General"], ["e", "By module and event"], ["c", "Channels"]], "g") +
      pane("g", 1, '<div class="g2" style="align-items:start">' + cd("<b>What reaches me</b><span class='r muted'>NotificationLevel</span>", f("Notification level", seg(["All", "Important only", "Mentions and direct", "None"], "All"), "None still delivers mandatory events (security, SLA breaches assigned to you, legal notices).") + rowsw("Thread replies", "thread_notifications · replies in threads I follow", 1) + rowsw("Reactions", "reaction_notifications · someone reacts to my message", 0) + rowsw("Keyword alerts", "keyword_notifications · see Keywords", 1)) +
        cd("<b>Privacy and sound</b>", rowsw("Show message previews", "show_previews · off hides content in push, desktop and email (organization default: on)", 1) + rowsw("Sound", "sound_enabled · bell sound and desktop chime", 1) + f("Language", sel("English", "globe"), "Used for templates (NotificationRecipientSettings.language).") + f("Time zone", sel("Europe/Athens (UTC+2)", "clock"), "Used for quiet hours and digest times.")) + "</div>") +
      pane("e", 0, callout("shield", "Cells marked with a dot follow the organization default. Locked cells are mandatory and cannot be switched off.", "") + gap(10) +
        grp("TASKS", [ev("Task assigned to me", "task.assigned", "TASKS", 1, 1, 1, 0, 1, "Immediate"), ev("Mentioned in a task", "task.mentioned", "TASKS", 1, 1, 1, 0, 1, "Immediate"), ev("Status changed (watching)", "task.status_changed", "TASKS", 1, 0, 0, 0, 0, "Daily digest"), ev("Due soon / overdue", "task.due_soon", "TASKS", 1, 1, 1, 0, 0, "Immediate")]) +
        grp("FINANCE", [ev("Payment failed", "invoice.payment_failed", "FINANCE", 1, 1, 1, 0, 1, "Immediate", 1), ev("Invoice overdue", "invoice.overdue", "FINANCE", 1, 1, 0, 0, 0, "Daily digest")]) +
        grp("SUPPORT", [ev("SLA breach assigned to me", "support.sla_breach", "SUPPORT", 1, 1, 1, 1, 1, "Immediate", 1), ev("Customer replied", "support.customer_reply", "SUPPORT", 1, 1, 1, 0, 1, "Immediate")]) +
        grp("MESSAGING", [ev("Direct message", "message.direct", "MESSAGING", 1, 0, 1, 0, 1, "Immediate"), ev("Mention", "message.mention", "MESSAGING", 1, 1, 1, 0, 1, "Immediate")])) +
      pane("c", 0, tbl(["Channel", "Organization", "My setting", "Status"], [[chn("IN_APP"), E("enabled", "green"), sw(1) + " " + muted("always on, always stored"), "Delivered in real time"], [chn("EMAIL"), E("enabled", "green"), sw(1), "anna@agency.com · verified"], [chn("PUSH"), E("enabled", "green"), sw(1), "2 devices (see Devices)"], [chn("SMS"), E("disabled", ""), sw(0), muted("Disabled by your organization (CHANNEL_DISABLED)")], [chn("DESKTOP"), E("enabled", "green"), sw(1), "Browser permission granted"]])) + "</div>" +
      dm(["NotificationRecipientSettings · level, in_app_enabled, email_enabled, sms_enabled, push_enabled, desktop_enabled, sound_enabled, show_previews, thread_notifications, reaction_notifications, keyword_notifications, language, timezone", "NotificationPreference · event_type_id, module, channel, enabled, level, delivery_mode", "NotificationEventType · default_channels, mandatory_by_default, forced_channels, supports_digest", "NotificationOrgDefault · inherited values · NotificationOrgSettings · enabled_channels"], []) + "</div>";
  }

  /* =====================================================================================================================
     QUIET HOURS & DIGESTS (spec §6, §8)
     @screen Quiet hours and digests
     @route  /notifications/preferences/schedule
     @perm   notifications.preferences.manage_own
     @api    PATCH /notifications/preferences/settings {dnd_*, digest_*, timezone} · GET /notifications/digests (own history) · POST /notifications/digests/preview
     @mcp    notifications_preferences_manage_own
     @data   NotificationRecipientSettings (dnd_enabled, dnd_start_time, dnd_end_time, dnd_weekdays, dnd_until, timezone, dnd_allow_critical, digest_frequency, digest_channel, digest_hour, digest_weekday) · NotificationDigest (own: frequency, channel, module, period_start, period_end, scheduled_for, status, item_count, sent_at) · NotificationOrgSettings (default_digest_*)
     @ui     Switch, time pickers (shadcn Select of half hours), ToggleGroup weekdays, DatePicker for dnd_until, Table, Badge, Dialog digest preview
     @states loading · saving · error · digest EMPTY (nothing to send, no email) · locked (organization forces IMMEDIATE for a module)
     @audit  not audited
     @note   Quiet hours defer non-critical deliveries (skip reason QUIET_HOURS, delivered when the window ends) and never apply to is_mandatory events or, when dnd_allow_critical is on, to CRITICAL priority.
             "Pause until" (dnd_until) is the one-off snooze of everything. Digest frequency IMMEDIATE means no digest. Only event types with supports_digest can be digested; mandatory events never are.
     ===================================================================================================================== */
  function schedule() {
    const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return '<div class="a-page">' + head("Quiet hours and digests", "Control when notifications reach you.", btn("Preview digest", "mail") + btn("Save", "check", "primary")) +
      '<div class="g2" style="align-items:start">' + cd("<b>Do Not Disturb</b><span class='r muted'>dnd_enabled</span>", rowsw("Quiet hours", "Non-critical push, email and sound wait until the window ends", 1) +
        '<div style="padding:12px 16px">' + f("From / to", '<div class="rowx" style="gap:8px;padding:0">' + sel("22:00", "clock") + "<span class='muted'>to</span>" + sel("07:30", "clock") + "</div>") + f("Days", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + wd.map((d, i) => '<span class="seg' + (i < 5 ? " on" : "") + '">' + d + "</span>").join("") + "</div>", "dnd_weekdays · 1 = Monday") + f("Time zone", sel("Europe/Athens (UTC+2)", "globe")) +
        '<div class="nt-24"><i style="left:0;width:31%"></i><i style="left:91.6%;width:8.4%"></i><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div><div class="sub-note">Shaded = quiet hours (22:00–07:30).</div></div>' + rowsw("Let critical notifications through", "dnd_allow_critical · security and SLA breaches ring through", 1) + f2("Pause everything until", sel("Not paused", "calendar"), "dnd_until · one-off pause, ignores the weekly schedule")) +
      cd("<b>Digests</b><span class='r muted'>NotificationDigestFrequency</span>", '<div style="padding:12px 16px">' + f("Frequency", seg(["Immediate", "Hourly", "Daily", "Weekly"], "Daily")) + f("Send at", '<div class="rowx" style="gap:8px;padding:0">' + sel("08:00", "clock") + sel("Monday", "calendar") + "</div>", "digest_hour (daily and weekly) · digest_weekday (weekly)") + f("Deliver through", sel("Email", "mail"), "digest_channel · IN_APP shows one grouped row in the inbox") + "</div>" +
        rowsw("Digest these modules", "Tasks, Finance, Projects use DIGEST delivery mode; others stay immediate", 1) + '<div class="rowx" style="flex-wrap:wrap;gap:6px"><span class="badge blue">Tasks</span><span class="badge blue">Finance</span><span class="badge blue">Projects</span><span class="badge">Messaging</span><span class="badge">Support</span></div>') + "</div>" + gap() +
      cd("<b>My digest history</b><span class='r muted'>NotificationDigest</span>", tbl(["Period", "Frequency", "Channel", "Scheduled", ">Items", "Status", "Sent"], [["Nov 10", E("DAILY"), chn("EMAIL"), "Nov 11 08:00", "14", E("SENT", "green"), "08:00"], ["Nov 9", E("DAILY"), chn("EMAIL"), "Nov 10 08:00", "0", E("EMPTY"), "—"], ["Nov 8", E("DAILY"), chn("EMAIL"), "Nov 9 08:00", "22", E("SENT", "green"), "08:01"], ["Today", E("DAILY"), chn("EMAIL"), "Nov 12 08:00", "9", E("OPEN", "blue"), "—"]]), 1) +
      dm(["NotificationRecipientSettings · dnd_enabled, dnd_start_time, dnd_end_time, dnd_weekdays, dnd_until, timezone, dnd_allow_critical, digest_frequency, digest_channel, digest_hour, digest_weekday", "NotificationDigest · frequency, channel, period_start, period_end, scheduled_for, status, item_count, sent_at", "NotificationOrgSettings · default_digest_frequency, default_digest_hour, default_digest_weekday"], []) + "</div>";
    function f2(l, h, hint) { return f(l, h, hint); }
  }

  /* =====================================================================================================================
     KEYWORD ALERTS (spec §6, §16 phase 2; 12 §32)
     @screen Keyword alerts
     @route  /notifications/preferences/keywords
     @perm   notifications.preferences.manage_own · matches only in conversations/records the caller is allowed to read
     @api    GET/POST/PATCH/DELETE /notifications/keywords
     @mcp    notifications_preferences_manage_own
     @data   NotificationKeyword (keyword, match_whole_word, case_sensitive, channels, is_enabled, disabled_until) · NotificationRecipientSettings.keyword_notifications (master switch)
     @ui     Table, Dialog (create/edit), Switch, multi-select Popover+Command for channels, DatePicker for disabled_until
     @states loading · empty ("No keywords yet") · error · validation (duplicate keyword) · master switch off banner
     @audit  not audited
     @note   Keywords are matched by the messaging module (12) which emits message.keyword_match events; this engine decides delivery. Never notify about a message the member cannot read. Phase 2.
     ===================================================================================================================== */
  function keywords() {
    return '<div class="a-page">' + head("Keyword alerts", "Get notified when a term appears in a conversation you can read.", btn("Add keyword", "plus", "primary")) +
      callout("flag", "Phase 2. Keyword matching is performed by Messaging (12); these rows only decide who is told and how.", "warn") + gap(10) +
      tbl(["Keyword", "Whole word", "Case sensitive", "Channels", "Enabled", "Paused until", ""], [[ink("launch"), sw(1), sw(0), chn("IN_APP") + chn("PUSH"), sw(1), "—", more], [ink("Acme"), sw(1), sw(1), chn("IN_APP"), sw(1), "—", more], [ink("outage"), sw(0), sw(0), chn("IN_APP") + chn("EMAIL") + chn("PUSH"), sw(1), "—", more], [ink("invoice dispute"), sw(0), sw(0), chn("IN_APP"), sw(0), "Nov 20", more]]) +
      gap() + cd("<b>New keyword</b>", f("Keyword", box("e.g. launch")) + f("Match", '<div class="rowx" style="gap:16px;padding:0">' + cb(1) + "<span>Whole word</span>" + cb(0) + "<span>Case sensitive</span></div>") + f("Notify through", sel("In-app, Push", "bell")) + '<div class="rowx" style="padding:0">' + btn("Cancel") + btn("Save keyword", "check", "primary") + "</div>") +
      dm(["NotificationKeyword · keyword, match_whole_word, case_sensitive, channels, is_enabled, disabled_until", "NotificationRecipientSettings · keyword_notifications"], []) + "</div>";
  }

  /* =====================================================================================================================
     SUBSCRIPTIONS — follow and mute (spec §6 layer 1, §16)
     @screen Following and muted
     @route  /notifications/preferences/following?tab=following|muted
     @perm   notifications.preferences.manage_own · rows disappear when the record becomes unreadable
     @api    GET /notifications/subscriptions?state=following|muted · PUT /notifications/subscriptions {entity_type, entity_id, is_following|muted_until, level, delivery_mode} · DELETE /notifications/subscriptions/:id
     @mcp    notifications_preferences_manage_own
     @data   NotificationPreference (entity_type, entity_id, scope_key, is_following, muted_until, level, delivery_mode, enabled, channel) · NotificationOrgDefault
     @ui     Tabs, Table, DropdownMenu (mute for 1 h / 8 h / until tomorrow / forever), Switch, Badge, Popover+Command to follow a record
     @states loading · empty per tab · error · record unreadable (row greyed with "No access", removable)
     @audit  not audited
     @note   The same control ("Follow", "Mute") appears in each module's record header and calls this API. Task watchers (06), channel mutes (12) and conversation mutes reuse this table instead of keeping their own store.
             @gap the display label of the record is resolved at read time (NotificationPreference has no entity_label), cheap with a batch lookup but a deleted record has no label left.
     ===================================================================================================================== */
  function follows() {
    return '<div class="a-page">' + head("Following and muted", "Records you follow or silenced. Overrides module defaults.", btn("Follow a record", "plus", "primary")) +
      '<div class="tabset">' + tabs([["f", "Following", 7], ["m", "Muted", 3]], "f") +
      pane("f", 1, '<div class="toolbar">' + search("Search records") + sel("Type: All", "tag") + sel("Module: All", "grid") + "</div>" + tbl(["Record", "Type", "Level", "Delivery", "Since", ""], [[ink("Acme Rebrand Website"), "PROJECT", sel("All"), sel("Immediate"), "Oct 2", more], [ink("WEB-142 Pricing hero"), "TASK", sel("Important only"), sel("Immediate"), "Nov 3", more], [ink("Acme Corp"), "CRM_COMPANY", sel("All"), sel("Daily digest"), "Sep 14", more], [ink("TCK-2041"), "TICKET", sel("All"), sel("Immediate"), "Nov 10", more], [ink("CTR-0031 MSA Northwind"), "CONTRACT", sel("Mentions and direct"), sel("Immediate"), "Nov 1", more]])) +
      pane("m", 0, tbl(["Record", "Type", "Muted until", ""], [[ink("#random"), "CHANNEL", "Forever", btn("Unmute", "", "sm")], [ink("WEB-120 Migrate analytics"), "TASK", "Tomorrow 09:00", btn("Unmute", "", "sm")], [ink("Mobile App v2"), "PROJECT", "Nov 20", btn("Unmute", "", "sm")]]) + '<div class="sub-note">Muting never silences mandatory events (is_mandatory) for that record.</div>') + "</div>" +
      dm(["NotificationPreference · entity_type, entity_id, scope_key, is_following, muted_until, level, delivery_mode, enabled"], ["No entity_label snapshot on NotificationPreference (label resolved at read time)"]) + "</div>";
  }

  /* =====================================================================================================================
     PUSH DEVICES (spec §5)
     @screen Devices
     @route  /notifications/preferences/devices
     @perm   notifications.preferences.manage_own (own devices) · other users' devices are never listed; admins see counts only in the delivery log
     @api    GET /notifications/devices · POST /notifications/devices {platform, provider, token|subscription, device_name, app_version, locale} (called by the app on login or after the browser permission) · DELETE /notifications/devices/:id · POST /notifications/devices/:id/test
     @mcp    none (device tokens are issued by clients, not agents)
     @data   NotificationPushDevice (user_id, membership_id, platform, provider, token, subscription, device_name, app_version, locale, last_seen_at, failure_count, disabled_at)
     @ui     Card list, Badge, AlertDialog for remove, Button "Send test notification", browser permission prompt (Notification.requestPermission) for the WEB platform
     @states loading · empty ("No devices registered") + enable-browser-push prompt · browser permission denied (instructions) · error · device auto-disabled after repeated failures (disabled_at, failure_count)
     @audit  device registration and removal
     @note   A device belongs to the USER, not to a tenant; membership_id records the active membership at registration, delivery checks it per organization. Tokens are write-only here (never displayed). A token that fails
             repeatedly is disabled (disabled_at) and the user sees "Needs re-registration". @gap push provider credentials (APNs, FCM, Web Push VAPID) are not in the BYOK provider list (OPENAI, RESEND, TWILIO, STRIPE,
             VIVA_WALLET): needs a decision, see gaps-14.md #5.
     ===================================================================================================================== */
  function devices() {
    const dev = (n, p, ic, app, last, st, fail) => '<div class="rowx"><span class="nt-ic">' + I(ic, 15) + '</span><div class="grow"><b>' + n + "</b><small>" + p + " · " + app + " · last seen " + last + (fail ? " · " + fail + " failures" : "") + "</small></div>" + st + btn("Test", "send", "sm") + more + "</div>";
    return '<div class="a-page">' + head("Devices", "Where push notifications can reach you.", btn("Enable browser push", "plus", "primary")) +
      cd("<b>Registered devices</b><span class='r muted'>NotificationPushDevice</span>", dev("iPhone 15", "IOS", "phone", "v2.4.1", "2 min ago", E("Active", "green")) + dev("Pixel 8", "ANDROID", "phone", "v2.4.0", "3 days ago", E("Active", "green")) + dev("Chrome on MacBook", "WEB", "globe", "Web Push", "now", E("Active", "green")) + dev("Old iPad", "IOS", "phone", "v2.1.0", "41 days ago", E("Disabled", "red"), 5) + dev("Agency Desktop", "DESKTOP", "panel", "v1.3.0", "1 h ago", E("Active", "green")), 1) + gap() +
      '<div class="g2" style="align-items:start">' + cd("<b>Browser permission</b>", callout("bell", "Chrome permission: <b>granted</b>. Push works while the tab is closed.", "") + '<div class="sub-note">If denied, the browser blocks the prompt; show the steps to re-enable it in site settings.</div>') +
      cd("<b>Privacy on devices</b>", rowsw("Show previews on lock screen", "NotificationRecipientSettings.show_previews", 1) + rowsw("Only critical and mentions on push", "Combine with level in preferences", 0)) + "</div>" +
      dm(["NotificationPushDevice · platform, provider, device_name, app_version, locale, last_seen_at, failure_count, disabled_at (token and subscription are write-only)"], ["Push provider credentials (APNs, FCM, VAPID) have no IntegrationConnection provider"]) + "</div>";
  }

  /* =====================================================================================================================
     ANNOUNCEMENTS (category ANNOUNCEMENT; spec §4 Employees "announcement")
     @screen System announcements
     @route  /notifications/announcements · /notifications/announcements/new
     @perm   @gap no key: needs notifications.announcements.manage (publish) ; reading = any member through the inbox
     @api    @gap GET/POST/PATCH /announcements · POST /announcements/:id/publish (fans out one Notification per recipient, category ANNOUNCEMENT)
     @mcp    @gap notifications_announcements_manage (sensitive)
     @data   NotificationCategory.ANNOUNCEMENT exists on Notification and NotificationEventType but NO table stores an announcement (title, audience, schedule, expiry, acknowledgement). Fan-out itself reuses Notification (expires_at, is_mandatory).
     @ui     Table, full-page create form with Markdown editor, audience Popover+Command (roles, teams, branches, portal), DateTimePicker, Switch, Dialog preview
     @states loading · empty · error · validation · scheduled / live / expired
     @audit  announcement published, edited, withdrawn
     @note   Design only: the screen is built because the spec names announcements, but the data has no home. Everything on it is an @gap and is listed in gaps-14.md #1. Acknowledgement ("I have read this") is a
             requirement for policy announcements and needs its own rows.
     ===================================================================================================================== */
  function announcements() {
    return '<div class="a-page">' + head("Announcements", "Messages from administrators to members or customers.", btn("New announcement", "plus", "primary")) +
      callout("flag", "Not backed by the schema yet. Notification category ANNOUNCEMENT exists, but there is no announcement table (see gaps).", "warn") + gap(10) +
      tbl(["Title", "Audience", "Severity", "Status", "Publish", "Expires", "Acknowledged", ""], [[ink("Holiday office hours"), "All members", E("NORMAL"), E("SCHEDULED", "blue"), "Dec 15 09:00", "Jan 3", "—", more], [ink("New expense policy"), "Finance team", E("IMPORTANT", "yellow"), E("LIVE", "green"), "Nov 4", "—", bar(78), more], [ink("Planned maintenance Sat 02:00"), "All members + portal", E("IMPORTANT", "yellow"), E("EXPIRED"), "Oct 30", "Nov 2", "n/a", more]]) + gap() +
      cd("<b>New announcement</b><span class='r muted'>design only</span>", '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' + f("Title", box("Short headline")) + f("Message", '<div class="editor"><div class="ed-bar">' + ["B", "I", "•", "Link"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">Markdown body</div></div>') + "</div><div>" + f("Audience", sel("Everyone", "users")) + f("Severity", sel("Normal", "flag")) + f("Publish at", sel("Now", "calendar")) + f("Expires", sel("Never", "calendar")) + rowsw("Require acknowledgement", "Members must confirm they read it", 0) + rowsw("Also send email", "Uses the notification email template", 0) + "</div></div>") +
      dm(["Notification · category ANNOUNCEMENT, is_mandatory, expires_at (the fan-out rows)", "NotificationEventType · key announcement.published"], ["No Announcement model (title, body, audience, severity, publish_at, expires_at, requires_ack, status)", "No acknowledgement rows", "No notifications.announcements.manage key"]) + "</div>";
  }

  /* ---------------- admin: event catalog ---------------- */
  /* key, module, name, category, priority, channels, mandatory, customer_visible, coalesce, digest, org?, active */
  const EV = [
    ["task.assigned", "TASKS", "Task assigned", "ASSIGNMENT", "NORMAL", ["IN_APP", "EMAIL", "PUSH"], 0, 0, 0, 1, 0, 1],
    ["task.mentioned", "TASKS", "Mentioned in a task", "MENTION", "IMPORTANT", ["IN_APP", "EMAIL", "PUSH"], 0, 0, 0, 0, 0, 1],
    ["task.status_changed", "TASKS", "Task status changed", "STATUS_CHANGE", "LOW", ["IN_APP"], 0, 1, 1, 1, 0, 1],
    ["invoice.payment_failed", "FINANCE", "Invoice payment failed", "BILLING", "CRITICAL", ["IN_APP", "EMAIL"], 1, 1, 0, 0, 0, 1],
    ["support.sla_breach", "SUPPORT", "SLA breach", "SLA", "CRITICAL", ["IN_APP", "EMAIL", "PUSH", "SMS"], 1, 0, 0, 0, 0, 1],
    ["contract.approval_requested", "CONTRACTS", "Contract approval requested", "APPROVAL", "IMPORTANT", ["IN_APP", "EMAIL"], 0, 0, 0, 0, 0, 1],
    ["message.mention", "MESSAGING", "Mention in a message", "MENTION", "IMPORTANT", ["IN_APP", "PUSH"], 0, 0, 0, 0, 0, 1],
    ["portal.approval_requested", "CUSTOMER_PORTAL", "Approval requested from customer", "APPROVAL", "IMPORTANT", ["IN_APP", "EMAIL"], 0, 1, 0, 0, 0, 1],
    ["security.new_signin", "ADMINISTRATION", "New sign-in on a new device", "SECURITY", "CRITICAL", ["IN_APP", "EMAIL"], 1, 0, 0, 0, 0, 1],
    ["agency.client_review_due", "PROJECTS", "Client review window closing (custom)", "REMINDER", "NORMAL", ["IN_APP", "EMAIL"], 0, 0, 0, 1, 1, 1],
  ];
  /* =====================================================================================================================
     EVENT CATALOG (spec §4, §14 "register event types")
     @screen Event catalog
     @route  /notifications/admin/events?module=&category=&mandatory=&customer_visible=&scope=platform|organization
     @perm   VIEW notifications.defaults.manage · register/edit organization event types @gap needs notifications.event_types.manage (today only defaults.manage exists) · platform rows (organization_id null) are read-only
     @api    GET /notification-event-types?module=&category=&q= · POST /notification-event-types · PATCH /notification-event-types/:id · POST /notification-event-types/:id/deprecate
     @mcp    notifications_event_types_manage (@gap key)
     @data   NotificationEventType (organization_id, key, module, name, description, category, priority, customer_visible, default_channels, mandatory_by_default, forced_channels, can_coalesce, coalesce_window_seconds, supports_digest, default_expiry_minutes, available_actions, payload_schema, is_active, deprecated_at, sort_order)
     @ui     Table with filter bar and saved views, row DropdownMenu, Switch inline for is_active, Badge, link to detail
     @states loading · empty · error · no-access · platform rows locked ("Defined by the platform")
     @audit  event type registered, changed, deactivated, deprecated
     @note   Platform events (organization_id null) come from the modules' specs; organizations can add their own (key must be unique per organization, namespaced, e.g. agency.client_review_due). Deprecating keeps history and stops new emits.
             The same key is emitted by modules or by Automation (20, NotificationEvent.automation_rule_id).
     ===================================================================================================================== */
  function catalog() {
    return '<div class="a-page">' + head("Event catalog", "Every event a module can emit. One stable key per event.", btn("Export", "file") + btn("Register event", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Event types", 118, "platform + 4 custom") + stat("Mandatory", 14, "cannot be muted") + stat("Customer visible", 22, "reach the portal") + stat("Deprecated", 3, "no new emits") + "</div>" +
      '<div class="toolbar">' + search("Search key or name") + sel("Module: All", "grid") + sel("Category: All", "tag") + sel("Priority: Any", "flag") + sel("Scope: All", "building") + sel("Views: Mandatory", "star") + "</div>" +
      filterBar([["Module", "is any of", "Tasks, Finance, Support"], ["Active", "is", "yes"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      tbl(["Key", "Module", "Name", "Category", "Priority", "Default channels", "Mandatory", "Portal", "Coalesce", "Digest", "Active", ""], EV.map((e) => ['<a class="ink" href="#notifications/event">' + e[0] + "</a>" + (e[10] ? " " + E("organization", "purple") : ""), mod(e[1]), e[2], E(e[3]), E(e[4], PRI[e[4]]), e[5].map(chn).join(""), e[6] ? I("lock", 13) : "", e[7] ? I("check", 14) : "", e[8] ? I("check", 14) : "", e[9] ? I("check", 14) : "", sw(e[11]), more])) +
      '<div class="pager"><span class="muted">1–10 of 118</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["NotificationEventType · key, module, name, category, priority, default_channels, mandatory_by_default, customer_visible, can_coalesce, supports_digest, is_active, deprecated_at, organization_id"], ["No notifications.event_types.manage permission key"]) + "</div>";
  }

  /* =====================================================================================================================
     EVENT TYPE DETAIL (view/edit)
     @screen Event type
     @route  /notifications/admin/events/:eventTypeId · create at /notifications/admin/events/new
     @perm   notifications.defaults.manage (organization defaults and mandatory flag) · notifications.templates.manage (templates tab) · @gap notifications.event_types.manage (edit definition)
     @api    GET/PATCH /notification-event-types/:id · POST /notification-event-types · GET /notification-event-types/:id/templates · GET /notification-event-types/:id/stats
     @mcp    notifications_event_types_manage (@gap)
     @data   NotificationEventType (all columns) · NotificationTemplate (per channel and locale) · NotificationOrgDefault (this org's default for the event) · NotificationEvent (recent emits) · NotificationDeliveryRule (rules matching)
     @ui     Tabs (Settings, Templates, Defaults, Recent events, Rules), full-page form with sections, JSON editor for payload_schema (Monaco read-only for platform rows), Switch, multi-select channels, Table
     @states loading · saving · validation (key format, payload_schema must be valid JSON Schema) · locked platform row · error · no-access
     @audit  every change (before/after) written to audit_events; mandatory flag changes are sensitive
     @note   forced_channels are always sent for mandatory events regardless of the user's choice (e.g. security alerts: EMAIL). payload_schema documents and validates the variables templates may use. Coalescing needs
             can_coalesce true and a window; the engine rule NotificationDeliveryRule COALESCE can add stricter keys. default_expiry_minutes drops stale reminders.
     ===================================================================================================================== */
  function event() {
    return '<div class="a-page">' + head("agency.client_review_due", "Client review window closing · custom event of this organization", btn("Deprecate", "x") + btn("Save", "check", "primary")) +
      '<div class="tabset">' + tabs([["s", "Settings"], ["t", "Templates", 3], ["d", "Defaults"], ["e", "Recent events", 24], ["r", "Rules", 1]], "s") +
      pane("s", 1, '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
        cd("<b>Definition</b>", f("Key", box("agency.client_review_due"), "Stable, lowercase, dot-separated. Cannot change after the first emit.") + f("Name", box("Client review window closing")) + f("Description", box("Sent to the project owner 2 days before the client review deadline.")) + f("Module", sel("Projects", "grid")) + '<div class="rowx" style="gap:8px;padding:0">' + f("Category", sel("Reminder", "tag")) + f("Priority", sel("Normal", "flag")) + "</div>" + f("Available actions", sel("open, snooze", "zap"), "Shown as buttons on the notification (Notification.actions).")) + gap() +
        cd("<b>Payload schema</b><span class='r muted'>payload_schema (JSON Schema)</span>", '<div class="code">{\n  "type": "object",\n  "required": ["project_name", "due_date"],\n  "properties": {\n    "project_name": { "type": "string" },\n    "due_date": { "type": "string", "format": "date" },\n    "reviewer": { "type": "string" }\n  }\n}</div>') +
        "</div><div>" + cd("<b>Delivery behavior</b>", f("Default channels", sel("In-app, Email", "bell")) + f("Forced channels", sel("None", "lock")) + rowsw("Mandatory by default", "Cannot be muted by users (mandatory_by_default)", 0) + rowsw("Customer visible", "Portal users can receive it (customer_visible)", 0) + rowsw("Supports digest", "Can be batched (supports_digest)", 1) + rowsw("Can coalesce", "Repeated events collapse (can_coalesce)", 0) + f("Coalesce window (s)", box("—")) + f("Expire after (minutes)", box("2880"), "default_expiry_minutes · not delivered after it passes") + rowsw("Active", "is_active", 1)) + "</div></div>") +
      pane("t", 0, tbl(["Channel", "Locale", "Title", "Version", "Scope", "Active", ""], [[chn("IN_APP"), "Default", "Client review closes {{due_date}}", "3", E("organization", "purple"), sw(1), btn("Edit", "edit", "sm")], [chn("EMAIL"), "en", "Review window for {{project_name}} closes soon", "2", E("organization", "purple"), sw(1), btn("Edit", "edit", "sm")], [chn("EMAIL"), "el", "Το παράθυρο ελέγχου κλείνει", "1", E("organization", "purple"), sw(1), btn("Edit", "edit", "sm")]])) +
      pane("d", 0, tbl(["Setting", "Value"], [["Enabled for organization", sw(1)], ["Channels (members)", chn("IN_APP") + chn("EMAIL")], ["Channels (portal)", muted("not customer visible")], ["Delivery mode", E("IMMEDIATE")], ["Mandatory", sw(0)]])) +
      pane("e", 0, tbl(["Received", "Entity", "Status", ">Notifications", "Idempotency key"], [["Nov 11 09:00", "PROJECT · Acme Rebrand", E("PROCESSED", "green"), "1", "proj_12:review:nov13"], ["Nov 10 09:00", "PROJECT · Mobile App v2", E("PROCESSED", "green"), "2", "proj_18:review:nov12"], ["Nov 9 09:00", "PROJECT · Data Warehouse", E("IGNORED"), "0", "proj_20:review:nov11"]])) +
      pane("r", 0, tbl(["Rule", "Kind", "Window", "Active"], [["One reminder per project per day", E("DEDUPLICATE"), "24 h", sw(1)]])) + "</div>" +
      dm(["NotificationEventType · all columns", "NotificationTemplate · channel, locale, title, version", "NotificationOrgDefault · enabled, channels, portal_channels, delivery_mode, is_mandatory", "NotificationEvent · status, notification_count, idempotency_key", "NotificationDeliveryRule · kind, window_seconds"], ["notifications.event_types.manage not in catalog"]) + "</div>";
  }

  /* =====================================================================================================================
     TEMPLATES (spec §10)
     @screen Templates
     @route  /notifications/admin/templates?event=&channel=&locale=&scope= · edit /notifications/admin/templates/:templateId
     @perm   notifications.templates.manage · platform defaults (organization_id null) are read-only, "Customize" creates an organization override
     @api    GET /notification-templates?event_type_id=&channel=&locale= · POST/PATCH /notification-templates · POST /notification-templates/:id/preview {sample_payload, locale} · POST /notification-templates/:id/test {to}
     @mcp    notifications_templates_manage
     @data   NotificationTemplate (organization_id, event_type_id, channel, locale, subject, title, body, html_body, cta_label, cta_url, variables, version, is_active, created_by_membership_id, updated_by_membership_id)
     @ui     Table with filter bar; editor page with two columns (form + live Preview Tabs per channel), Markdown editor, variable picker (Command), Select for locale, Switch, "Send test" Dialog
     @states loading · saving · validation (unknown variable, missing required variable) · empty · error · no-access · platform default read-only
     @audit  template created, changed (before/after body), activated, deactivated: audited (spec §13)
     @note   One template per event type, channel and locale; resolution order is recipient language, then org default locale, then platform default. Email applies organization branding (01 §15) around html_body. SMS body is plain
             text with a length counter. Variables come from the event's payload_schema. @gap only the current version number exists (NotificationTemplate.version), no history table to roll back to (gaps-14.md #6).
     ===================================================================================================================== */
  function templates() {
    return '<div class="a-page">' + head("Templates", "Wording of every notification, per channel and language.", btn("New template", "plus", "primary")) +
      '<div class="toolbar">' + search("Search title or event key") + sel("Event: All", "zap") + sel("Channel: All", "bell") + sel("Locale: All", "globe") + sel("Scope: All", "building") + "</div>" +
      tbl(["Event", "Channel", "Locale", "Title", "Scope", "Version", "Active", "Updated", ""], [[ink("task.assigned"), chn("EMAIL"), "en", "{{actor.name}} assigned you {{task.key}}", E("platform", ""), "5", sw(1), "Oct 12", btn("Customize", "edit", "sm")], [ink("task.assigned"), chn("EMAIL"), "en", "New task for you: {{task.key}}", E("organization", "purple"), "2", sw(1), "Nov 3 · Anna Meyer", btn("Edit", "edit", "sm")], [ink("task.assigned"), chn("PUSH"), "en", "{{task.key}} assigned to you", E("platform", ""), "1", sw(1), "Sep 30", btn("Customize", "edit", "sm")], [ink("invoice.payment_failed"), chn("EMAIL"), "en", "Payment failed for {{invoice.number}}", E("organization", "purple"), "4", sw(1), "Nov 8 · Kim Lund", btn("Edit", "edit", "sm")], [ink("invoice.payment_failed"), chn("SMS"), "en", "Payment for {{invoice.number}} failed. Retry {{retry_date}}.", E("platform", ""), "1", sw(0), "Sep 30", btn("Customize", "edit", "sm")], [ink("support.sla_breach"), chn("IN_APP"), "Default", "SLA breach in {{minutes}} min: {{ticket.key}}", E("platform", ""), "2", sw(1), "Oct 1", btn("Customize", "edit", "sm")]]) + gap() +
      cd("<b>Edit template · task.assigned · Email · en</b><span class='r'>" + btn("Send test", "send", "sm") + btn("Save new version", "check", "sm primary") + "</span>", '<div class="g2" style="grid-template-columns:1.2fr 1fr;align-items:start"><div>' + f("Subject", box("New task for you: {{task.key}}")) + f("Title (in-app and push)", box("{{actor.name}} assigned you {{task.key}}")) + f("Body", '<div class="editor"><div class="ed-bar">' + ["B", "I", "•", "Link", "{{ }}"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">{{task.title}}\nDue {{task.due_date}} · Project {{project.name}}</div></div>') + '<div class="rowx" style="gap:8px;padding:0">' + f("CTA label", box("Open task")) + f("CTA URL", box("{{task.url}}")) + "</div>" + f("Variables", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + ["actor.name", "task.key", "task.title", "task.due_date", "project.name", "task.url"].map(tok).join("") + "</div>", "From payload_schema of the event type. Unknown variables fail validation.") +
        "</div><div><div class='nt-mail'><div class='nt-mail-h'><b>New task for you: WEB-142</b><small>to anna@agency.com · from Agency OS via Resend (BYOK)</small></div><div class='nt-mail-b'><p>Marco Silva assigned you <b>WEB-142</b>.</p><p>Rebuild pricing page hero with new brand system<br><span class='muted'>Due Nov 14 · Project Acme Rebrand Website</span></p><p><span class='badge blue'>Open task</span></p></div></div><div class='sub-note'>Live preview with sample payload, branded by the organization (logo, colors).</div></div></div>") +
      dm(["NotificationTemplate · event_type_id, channel, locale, subject, title, body, html_body, cta_label, cta_url, variables, version, is_active, organization_id", "NotificationEventType · payload_schema (variables)"], ["No template version history table (rollback)"]) + "</div>";
  }

  /* =====================================================================================================================
     ORGANIZATION DEFAULTS & MANDATORY EVENTS (spec §6 layer 4, §12)
     @screen Organization defaults
     @route  /notifications/admin/defaults?module=
     @perm   notifications.defaults.manage
     @api    GET /notification-defaults · PUT /notification-defaults {module | event_type_id, enabled, channels, portal_channels, delivery_mode, digest_frequency, is_mandatory} · DELETE /notification-defaults/:id
     @mcp    notifications_defaults_manage
     @data   NotificationOrgDefault (module XOR event_type_id, enabled, channels, portal_channels, delivery_mode, digest_frequency, is_mandatory, updated_by_membership_id) · NotificationEventType (platform default, mandatory_by_default) · NotificationOrgSettings (enabled_channels)
     @ui     Accordion per module with a matrix table (Checkbox per channel, Select delivery mode and digest frequency, Switch mandatory), AlertDialog when marking an event mandatory ("members cannot mute it")
     @states loading · saving · validation (a channel not enabled for the organization is disabled) · error · no-access
     @audit  every change audited, mandatory changes flagged sensitive (spec §13)
     @note   Exactly one of module or event_type_id per row; an event row overrides its module row, which overrides the platform default. channels apply to members, portal_channels to customers (only for customer_visible events).
             Marking an event mandatory forces delivery and removes the user's mute. Users' own settings stay below these defaults except for mandatory rows.
     ===================================================================================================================== */
  function defaults() {
    const m = (name, sc, a, b, c, d, mode, dig, mand, level) => "<tr><td><b class='ink'>" + name + "</b><div class='muted' style='font-size:12px'>" + sc + "</div></td><td class='nt-c'>" + cb(a) + "</td><td class='nt-c'>" + cb(b) + "</td><td class='nt-c'>" + cb(c) + "</td><td class='nt-c'>" + cb(d) + "</td><td>" + sel(mode) + "</td><td>" + sel(dig) + "</td><td class='nt-c'>" + sw(mand) + "</td></tr>";
    const hd = "<thead><tr><th>Scope</th><th class='nt-c'>In-app</th><th class='nt-c'>Email</th><th class='nt-c'>Push</th><th class='nt-c'>SMS</th><th>Mode</th><th>Digest</th><th class='nt-c'>Mandatory</th></tr></thead>";
    return '<div class="a-page">' + head("Organization defaults", "What members get unless they choose otherwise. Plus the mandatory list.", btn("Reset to platform defaults", "x") + btn("Save", "check", "primary")) +
      callout("shield", "Mandatory events ignore every personal setting: security alerts, SLA breaches assigned to the member, legal notices. Changes are audited.", "") + gap(10) +
      '<div class="toolbar">' + search("Search module or event") + sel("Module: All", "grid") + sel("Show: Overridden only", "filter") + "</div>" +
      '<div class="cd"><div class="cd-h"><b>Module defaults</b><span class="r muted">NotificationOrgDefault · module</span></div><div class="cd-b flush"><table>' + hd + "<tbody>" + m("Tasks", "module TASKS", 1, 1, 1, 0, "Immediate", "Daily", 0) + m("Finance", "module FINANCE", 1, 1, 0, 0, "Immediate", "Daily", 0) + m("Support", "module SUPPORT", 1, 1, 1, 1, "Immediate", "Immediate", 0) + m("Messaging", "module MESSAGING", 1, 0, 1, 0, "Immediate", "Hourly", 0) + m("Projects", "module PROJECTS", 1, 1, 0, 0, "Digest", "Daily", 0) + "</tbody></table></div></div>" + gap() +
      '<div class="cd"><div class="cd-h"><b>Event overrides and mandatory events</b><span class="r muted">NotificationOrgDefault · event_type_id</span></div><div class="cd-b flush"><table>' + hd + "<tbody>" + m("invoice.payment_failed", "Finance · override", 1, 1, 0, 0, "Immediate", "Immediate", 1) + m("support.sla_breach", "Support · override", 1, 1, 1, 1, "Immediate", "Immediate", 1) + m("security.new_signin", "Administration · platform mandatory", 1, 1, 0, 0, "Immediate", "Immediate", 1) + m("contract.expired", "Contracts · legal notice", 1, 1, 0, 0, "Immediate", "Immediate", 1) + "</tbody></table></div></div>" + gap() +
      cd("<b>Customer portal defaults</b><span class='r muted'>portal_channels</span>", rowsw("Portal users receive in-app notifications", "Always on", 1, 1) + rowsw("Portal users receive email", "NotificationOrgSettings.portal_enabled_channels includes EMAIL", 1) + rowsw("Portal users receive SMS", "Opt-in per customer, needs the SMS channel", 0)) +
      dm(["NotificationOrgDefault · module, event_type_id, enabled, channels, portal_channels, delivery_mode, digest_frequency, is_mandatory", "NotificationEventType · mandatory_by_default", "NotificationOrgSettings · enabled_channels, portal_enabled_channels"], []) + "</div>";
  }

  /* =====================================================================================================================
     DELIVERY RULES (spec §9, §16)
     @screen Delivery rules
     @route  /notifications/admin/rules · /notifications/admin/rules/new · /notifications/admin/rules/:ruleId
     @perm   notifications.delivery_rules.manage
     @api    GET /notification-delivery-rules · POST/PATCH/DELETE /notification-delivery-rules · POST /notification-delivery-rules/:id/simulate {event_type_id, sample}
     @mcp    notifications_delivery_rules_manage
     @data   NotificationDeliveryRule (name, kind, event_type_id, module, channel, window_seconds, max_per_window, coalesce_key, conditions, automation_rule_id, priority, is_active, created_by_membership_id)
     @ui     Table with drag-reorder (priority), Switch, full-page form with Select for kind/coalesce key, JSON conditions builder, simulate Dialog
     @states loading · empty ("Only the built-in idempotency applies") · validation (window required for THROTTLE/COALESCE/DEDUPLICATE) · error · no-access
     @audit  rule created, changed, reordered, deactivated
     @note   Rules run before delivery, ordered by priority (lowest first). DEDUPLICATE never sends the same event to the same recipient and channel inside the window (skip reason DEDUPLICATED). COALESCE merges events by
             coalesce_key (RECORD, RECORD_AND_ACTOR, EVENT_TYPE, RECIPIENT) into one Notification with coalesced_count (skip reason COALESCED for the rest). THROTTLE caps max_per_window (THROTTLED). SUPPRESS drops matching events
             (conditions Json, e.g. actor is a service account). Mandatory events can never be suppressed. automation_rule_id links a rule created from Automation (20). Phase 2 for conditions.
     ===================================================================================================================== */
  function rules() {
    return '<div class="a-page">' + head("Delivery rules", "Deduplicate, coalesce, throttle or suppress before delivery.", btn("Simulate", "zap") + btn("New rule", "plus", "primary")) +
      tbl(["#", "Name", "Kind", "Applies to", "Channel", "Window", "Limit / key", "Active", ""], [["1", ink("Collapse task updates"), E("COALESCE", "blue"), "task.status_changed", chn("IN_APP"), "10 min", "RECORD_AND_ACTOR", sw(1), more], ["2", ink("One SLA warning per ticket per hour"), E("DEDUPLICATE", "blue"), "support.sla_warning", chn("EMAIL"), "1 h", "—", sw(1), more], ["3", ink("Cap push for chat mentions"), E("THROTTLE", "yellow"), "Messaging", chn("PUSH"), "5 min", "max 6", sw(1), more], ["4", ink("Mute bot reactions"), E("SUPPRESS", "red"), "message.reaction", "All", "—", "actor is service account", sw(0), more]]) + gap() +
      cd("<b>New rule</b><span class='r muted'>full page at /rules/new</span>", '<div class="g2" style="align-items:start"><div>' + f("Name", box("e.g. Collapse comment noise")) + f("Kind", seg(["Deduplicate", "Coalesce", "Throttle", "Suppress"], "Coalesce")) + f("Applies to", '<div class="rowx" style="gap:8px;padding:0">' + sel("Event type: task.comment_added", "zap") + sel("or module", "grid") + "</div>", "Exactly one of event type or module; empty applies to all.") + f("Channel", sel("Any channel", "bell")) + "</div><div>" + f("Window", '<div class="rowx" style="gap:8px;padding:0">' + box("600") + "<span class='muted'>seconds</span></div>") + f("Max per window", box("— (throttle only)")) + f("Coalesce key", sel("Record and actor", "key"), "RECORD, RECORD_AND_ACTOR, EVENT_TYPE, RECIPIENT") + f("Conditions", box("Optional JSON: only when priority is LOW")) + rowsw("Active", "is_active · evaluated by priority order", 1) + "</div></div>" + '<div class="rowx" style="padding:0">' + btn("Cancel") + btn("Create rule", "plus", "primary") + "</div>") +
      dm(["NotificationDeliveryRule · name, kind, event_type_id, module, channel, window_seconds, max_per_window, coalesce_key, conditions, automation_rule_id, priority, is_active", "NotificationSkipReason · DEDUPLICATED, COALESCED, THROTTLED (results in the log)"], []) + "</div>";
  }

  /* =====================================================================================================================
     DELIVERY LOG (spec §9, §13) — events, notifications and per-channel deliveries
     @screen Delivery log
     @route  /notifications/admin/log?tab=deliveries|events|digests&status=&channel=&skip_reason=&event=&recipient=&from=&to=
     @perm   notifications.audit.read* (sensitive: shows recipient addresses and rendered content)
     @api    GET /notification-deliveries?filter= · GET /notification-events?filter= · GET /notification-digests?filter= · POST /notification-deliveries/:id/retry · GET /notification-deliveries/:id
     @mcp    notifications_audit_read (sensitive)
     @data   NotificationDelivery (notification_id, channel, status, skip_reason, attempt_count, max_attempts, next_attempt_at, last_attempted_at, sent_at, delivered_at, failed_at, failure_reason, digest_id, template_id, locale, rendered_subject, destination, preview_hidden, comm_message_id, push_device_id, provider, provider_message_id, opened_at, clicked_at)
             · NotificationEvent (event_key, idempotency_key, entity_*, actor, status, notification_count, error, occurred_at, received_at, processed_at) · NotificationDigest (frequency, channel, status, item_count, scheduled_for, failure_reason)
     @ui     Tabs, table with filter bar and saved views, cursor pagination, Sheet for a row, Badge, AlertDialog before bulk retry, export
     @states loading · empty · error · partial (retention window: older rows deleted per NotificationOrgSettings.retention_days) · no-access
     @audit  viewing rendered content or destination is itself audited; retry actions audited
     @note   Answers "why did / didn't X get this?": SKIPPED rows carry the skip_reason (PREFERENCE_OFF, QUIET_HOURS, NO_DEVICE...). destination is masked (a***@agency.com) unless the viewer holds the key; preview_hidden rows never
             show the rendered body. Retry only for FAILED with attempts left (max_delivery_attempts, retry_backoff_seconds). Email/SMS rows link to the CommMessage in Communication (11).
     ===================================================================================================================== */
  function log() {
    const d = (t, who2, c, s, sk, att, dest, prov, sent, op) => [t, who2, chn(c), E(s, DST[s]) + (sk ? "<br>" + E(sk, "yellow") : ""), att, '<span class="muted">' + dest + "</span>", prov, sent, op];
    return '<div class="a-page">' + head("Delivery log", "Every event, notification and channel attempt for support and audit.", btn("Export", "file") + btn("Retry failed (3)", "zap")) +
      '<div class="mini-stats">' + stat("Events (24 h)", "3,412", "99.6% processed") + stat("Deliveries", "9,870", "97.1% delivered") + stat("Failed", 41, "3 can retry", 1) + stat("Skipped", 612, "top: PREFERENCE_OFF") + stat("Email open rate", "58%", "opened_at") + "</div>" +
      '<div class="toolbar">' + search("Search title, recipient, event key") + sel("Channel: All", "bell") + sel("Status: All", "check") + sel("Skip reason: All", "filter") + sel("Last 24 hours", "calendar") + sel("Views: Failed", "star") + "</div>" +
      filterBar([["Status", "is any of", "Failed, Skipped"], ["Channel", "is", "Email"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="tabset">' + tabs([["d", "Deliveries"], ["e", "Events"], ["g", "Digests"]], "d") +
      pane("d", 1, tbl(["Notification", "Recipient", "Channel", "Status", ">Attempts", "Destination", "Provider", "Sent", "Opened"], [
        d("Payment failed: INV-2026-0412", wh("AM"), "EMAIL", "DELIVERED", "", 1, "a***@agency.com", "Resend", "10:14", "10:40"),
        d("Payment failed: INV-2026-0412", wh("AM"), "PUSH", "SKIPPED", "NO_DEVICE", 0, "—", "—", "—", "—"),
        d("SLA breach in 20 min: TCK-2041", wh("MS"), "SMS", "FAILED", "", 3, "+30 69******12", "Twilio", "09:02", "—"),
        d("Task WEB-142 assigned", wh("MS"), "EMAIL", "DIGESTED", "", 1, "m***@agency.com", "digest dg_204", "—", "—"),
        d("Proposal PRO-0088 viewed", wh("SJ"), "PUSH", "SKIPPED", "QUIET_HOURS", 0, "iPhone 15", "APNs", "—", "—"),
        d("Approval requested: MSA", wh("AM"), "IN_APP", "DELIVERED", "", 1, "inbox", "internal", "10:14", "10:21"),
        d("Task WEB-139 status", wh("KL"), "IN_APP", "SKIPPED", "COALESCED", 0, "inbox", "internal", "—", "—")])) +
      pane("e", 0, tbl(["Received", "Event key", "Entity", "Actor", "Status", ">Notifications", "Idempotency key", "Error"], [["10:14:02", "contract.approval_requested", "CONTRACT · CTR-0031", wh("SJ"), E("PROCESSED", EST.PROCESSED), "3", "ctr_31:approval:3", "—"], ["10:12:40", "task.assigned", "TASK · WEB-142", wh("AM"), E("PROCESSED", EST.PROCESSED), "1", "web142:assign:9", "—"], ["10:12:40", "task.assigned", "TASK · WEB-142", wh("AM"), E("IGNORED", EST.IGNORED), "0", "web142:assign:9", "duplicate idempotency key"], ["09:01:11", "support.sla_breach", "TICKET · TCK-2041", wh("SY"), E("FAILED", EST.FAILED), "0", "tck2041:sla:2", "recipient resolution timed out"]])) +
      pane("g", 0, tbl(["Digest", "Recipient", "Frequency", "Channel", ">Items", "Scheduled", "Status", "Failure"], [["dg_204", wh("MS"), E("DAILY"), chn("EMAIL"), "14", "08:00", E("SENT", "green"), "—"], ["dg_205", wh("KL"), E("DAILY"), chn("EMAIL"), "0", "08:00", E("EMPTY"), "—"], ["dg_206", wh("JK"), E("WEEKLY"), chn("EMAIL"), "41", "Mon 08:00", E("FAILED", "red"), "mailbox full"]])) + "</div>" +
      dm(["NotificationDelivery · channel, status, skip_reason, attempt_count, max_attempts, next_attempt_at, sent_at, delivered_at, failed_at, failure_reason, digest_id, destination, preview_hidden, comm_message_id, push_device_id, provider, provider_message_id, opened_at, clicked_at", "NotificationEvent · event_key, idempotency_key, status, notification_count, error, received_at, processed_at", "NotificationDigest · frequency, channel, status, item_count, scheduled_for, failure_reason"], []) + "</div>";
  }

  /* =====================================================================================================================
     DELIVERY DETAIL
     @screen Delivery detail
     @route  /notifications/admin/log/deliveries/:deliveryId
     @perm   notifications.audit.read* (sensitive) · retry of FAILED rows is covered by the same key (@gap: no separate retry key, gaps-14.md #4)
     @api    GET /notification-deliveries/:id · POST /notification-deliveries/:id/retry · GET /notification-deliveries/:id/provider-response
     @mcp    notifications_audit_read
     @data   NotificationDelivery (all columns, provider_response Json masked) · Notification · NotificationEvent · NotificationTemplate (template_id, version) · NotificationPushDevice / CommMessage (11)
     @ui     Page with timeline, rendered content Tabs (Rendered, Raw provider response), Badge, Button Retry (AlertDialog)
     @states loading · not found (purged by retention) · error · preview hidden (content not shown)
     @audit  viewing rendered content is audited
     @note   Timeline is attempt history derived from attempt_count and the timestamps (created, last_attempted_at, sent_at, delivered_at, opened_at, clicked_at, failed_at). Next retry follows retry_backoff_seconds.
     ===================================================================================================================== */
  function delivery() {
    return '<div class="a-page">' + head("Delivery del_8821 · SLA breach SMS", "Notification n5 · event support.sla_breach · recipient Marco Silva", btn("Open notification", "link") + btn("Retry now", "zap", "primary")) +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' + cd("<b>Timeline</b>", '<div class="tl"><div class="ev"><b>Created</b><small>09:01:12 · status PENDING</small></div><div class="ev"><b>Attempt 1 failed</b><small>09:01:14 · Twilio 30007 carrier filtered</small></div><div class="ev"><b>Attempt 2 failed</b><small>09:03:14 · retry after 120 s · Twilio 30007</small></div><div class="ev"><b>Attempt 3 failed</b><small>09:07:14 · attempts exhausted (max_attempts 3) · status FAILED</small></div></div>') + gap() +
      cd("<b>Rendered content</b>", '<div class="code">SLA breach in 0 min: TCK-2041 (Acme Corp). Reply now: https://os.agency.com/s/9fK2</div><div class="sub-note">Template support.sla_breach · SMS · en · version 1. preview_hidden false.</div>') + gap() +
      cd("<b>Provider response</b><span class='r muted'>provider_response (masked)</span>", '<div class="code">{ "provider": "TWILIO", "error_code": 30007, "message": "Carrier violation", "sid": "SM••••c41" }</div>') + "</div><div>" +
      cd("<b>Properties</b>", kv("Channel", chn("SMS")) + kv("Status", E("FAILED", "red")) + kv("Attempts", "3 of 3") + kv("Destination", "+30 69******12") + kv("Provider", "Twilio (BYOK, 11)") + kv("Provider message", "SM••••c41") + kv("Template", "support.sla_breach · SMS · v1") + kv("Locale", "en") + kv("Communication message", "msg_5521 (11)") + kv("Failed at", "09:07:14") + kv("Reason", "Carrier violation")) + "</div></div>" +
      dm(["NotificationDelivery · all columns", "NotificationTemplate · version", "Notification · title, entity", "CommMessage (11, comm_message_id)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ORGANIZATION SETTINGS (spec §5, §8, §11)
     @screen Notification settings (organization)
     @route  /notifications/admin/settings
     @perm   notifications.defaults.manage (@gap: a dedicated notifications.settings.manage key is cleaner, see gaps-14.md #4)
     @api    GET/PATCH /notification-settings
     @mcp    notifications_defaults_manage
     @data   NotificationOrgSettings (enabled_channels, portal_enabled_channels, email_sender_identity_id, sms_sender_identity_id, default_level, default_digest_frequency, default_digest_hour, default_digest_weekday, hide_previews_by_default, max_delivery_attempts, retry_backoff_seconds, retention_days, webhook_events_enabled) · IntegrationConnection (RESEND, TWILIO, read-only status) · CommSenderIdentity (11)
     @ui     Form cards, Switch, Select, Popover+Command for sender identity, Slider/number inputs, Alert for missing integration connection
     @states loading · saving · validation (retention_days must exceed audit retention rules) · channel enabled but no provider connected (warning, deliveries skip with CHANNEL_NOT_AVAILABLE) · no-access
     @audit  every change audited
     @note   Email goes through the sender identity of 11 and the organization's own RESEND connection, SMS through TWILIO (BYOK, per organization, never from .env). A channel that is enabled without a connected provider is
             shown as "Not available". Push needs registered devices and a push provider (gap). Slack and Desktop exist in NotificationChannel; Slack has no provider connection (gap).
     ===================================================================================================================== */
  function settings() {
    return '<div class="a-page">' + head("Notification settings", "Channels, senders, retries and retention for the whole organization.", btn("Save", "check", "primary")) +
      '<div class="g2" style="align-items:start"><div>' +
      cd("<b>Channels</b><span class='r muted'>enabled_channels · portal_enabled_channels</span>", tbl(["Channel", "Members", "Customer portal", "Provider"], [[chn("IN_APP"), sw(1), sw(1), muted("internal, always on")], [chn("EMAIL"), sw(1), sw(1), E("Resend connected", "green")], [chn("SMS"), sw(0), sw(0), E("Twilio not connected", "yellow")], [chn("PUSH"), sw(1), sw(0), E("Devices: 38", "green")], [chn("DESKTOP"), sw(1), sw(0), muted("browser and desktop app")], [chn("SLACK"), sw(0), sw(0), E("No provider", "")]]), 1) + gap() +
      cd("<b>Senders</b>", f("Email sender identity", sel("Agency OS · notifications@agency.com", "mail"), "email_sender_identity_id · managed in Communication (11)") + f("SMS sender identity", sel("Not set", "sms"), "sms_sender_identity_id · needs the SMS channel")) + "</div><div>" +
      cd("<b>Defaults for new members</b>", f("Default level", sel("All", "bell")) + f("Default digest", '<div class="rowx" style="gap:8px;padding:0">' + sel("Daily") + sel("08:00") + sel("Monday") + "</div>", "default_digest_frequency, _hour, _weekday") + rowsw("Hide previews by default", "hide_previews_by_default · push and email show “New notification”", 0)) + gap() +
      cd("<b>Delivery and retention</b>", f("Max delivery attempts", box("3")) + f("Retry backoff (seconds)", box("120")) + f("Keep notifications and deliveries (days)", box("365"), "retention_days · empty keeps everything") + rowsw("Publish webhook events", "webhook_events_enabled · notification.created, delivered, failed, read", 1)) + "</div></div>" +
      dm(["NotificationOrgSettings · all columns", "IntegrationConnection · RESEND, TWILIO (status, read-only)", "CommSenderIdentity (11)"], ["SLACK channel and push providers have no IntegrationConnection provider"]) + "</div>";
  }

  /* ---- routing ---- */
  const MAP = {
    inbox, approvals, detail, bell,
    activity: () => activity("organization"), "activity-project": () => activity("project"), "activity-customer": () => activity("customer"),
    prefs, schedule, keywords, follows, devices, announcements,
    catalog, event, templates, defaults, rules, log, delivery, settings,
  };
  const CRUMB = { detail: "Approval requested: MSA Northwind GmbH", event: "agency.client_review_due", delivery: "del_8821", "activity-project": "Project activity", "activity-customer": "Customer activity" };
  window.VIEWS.notifications = { html: function (s) { return (MAP[s || "inbox"] || MAP.inbox)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
