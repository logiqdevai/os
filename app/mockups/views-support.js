/* =====================================================================================================================
   SUPPORT APP — module 13 Customer Support & Communication Hub (docs/features/13-customer-support-communication-hub.md). Intercom-like: one inbox, tickets, knowledge base, SLAs, AI.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: SupportSettings, SupportInbox, SupportChannel, SupportConversation, SupportConversationParticipant, SupportMessage, SupportMessageAttachment, TicketStatus, TicketCategory,
   SlaPolicy, SlaPolicyTarget, Ticket, TicketConversation, TicketStatusHistory, TicketSlaTimer, TicketRelation, TicketTaskLink, TicketFollower, TicketAttachment, SupportIncident, SupportCsatRating,
   SupportCannedResponse, KnowledgeCategory, KnowledgeArticle, KnowledgeArticleVersion, KnowledgeArticleFeedback, SupportAiSession, SupportAiSuggestion.
   Enums are the real values (title-cased by U.en, raw value in the tooltip): SupportChannelType (LIVE_CHAT, EMAIL, WIDGET, PORTAL, FORM, API, PHONE), SupportConversationStatus (OPEN, PENDING, SNOOZED, RESOLVED),
   SupportMessageKind (CUSTOMER, AGENT, INTERNAL_NOTE, AI_AGENT, SYSTEM), SupportMessageDeliveryStatus (PENDING, SENT, DELIVERED, FAILED, BOUNCED), SupportParticipantRole (ASSIGNEE, COLLABORATOR, MENTIONED),
   TicketPriority (LOW, NORMAL, HIGH, URGENT), TicketStatusCategory (NEW, OPEN, PENDING_CUSTOMER, ON_HOLD, RESOLVED, CLOSED), TicketType (QUESTION, BUG, FEATURE_REQUEST, CHANGE_REQUEST, BILLING, ACCOUNT, INCIDENT, OTHER),
   TicketSource (CONVERSATION, EMAIL, LIVE_CHAT, WIDGET, PORTAL, FORM, AI_AGENT, MANUAL, API), TicketRelationType (RELATED, DUPLICATE_OF, BLOCKS, SAME_INCIDENT), TicketTaskLinkKind (CONVERTED, LINKED),
   SlaMetric (FIRST_RESPONSE, NEXT_RESPONSE, RESOLUTION), SlaTimerStatus (RUNNING, PAUSED, MET, BREACHED, CANCELLED), SupportSentiment (POSITIVE, NEUTRAL, NEGATIVE, FRUSTRATED),
   KnowledgeArticleStatus (DRAFT, IN_REVIEW, PUBLISHED, ARCHIVED), KnowledgeVisibility (PUBLIC, CUSTOMERS, INTERNAL), SupportCannedResponseScope (PERSONAL, TEAM, ORGANIZATION),
   SupportAiSessionStatus (ACTIVE, RESOLVED_BY_AI, HANDED_OVER, ABANDONED, FAILED), SupportAiSuggestionKind (CLASSIFICATION, PRIORITY, ASSIGNMENT, REPLY, REWRITE, SUMMARY, TRANSLATION, ARTICLE_RECOMMENDATION,
   FOLLOW_UP_QUESTION, TROUBLESHOOTING, ACTION_ITEMS, DUPLICATE_TICKET, TASK_CREATION, KNOWLEDGE_GAP, ARTICLE_DRAFT, INCIDENT_GROUPING, FEEDBACK_EXTRACTION), SupportAiSuggestionStatus (PENDING, ACCEPTED, REJECTED,
   AUTO_APPLIED, EXPIRED), SupportIncidentStatus (DETECTED, CONFIRMED, RESOLVED, DISMISSED).
   Permission keys (35 in the catalog): support.conversations.{read,create,update,delete*,archive,export*,assign,reply,close} · support.tickets.{read,create,update,delete*,archive,export*,assign,merge,escalate,convert_to_task}
   · support.knowledge.{read,create,update,delete*,archive,export*,publish*} · support.sla_policies.manage · support.canned_responses.manage · support.inboxes.manage · support.automation.manage · support.settings.manage
   · support.ai.configure* · support.ai.use · support.analytics.read · support.csat.read.   (* = sensitive)
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - THREE DISTINCT THINGS (spec §14): Conversation (SupportConversation + SupportMessage = the thread with the customer) · Ticket (the structured case: priority, SLA, status, owner, resolution) · Task (the work, owned by 06).
       One conversation can have many tickets (Ticket.conversation_id + TicketConversation), many tickets can point at one Task (TicketTaskLink). Never build a second task system here.
     - A ticket REFERENCE is SupportSettings.ticket_prefix + Ticket.number (TCK-2041). Ticket.number is sequential per organization (number_sequences); the API assigns it, the client never invents one.
     - STATUS is organization-defined (TicketStatus, allowed_transitions) but every status maps to a fixed TicketStatusCategory. Code, SLA, reports and automation use the CATEGORY, never the name. A status with pauses_sla
       pauses the running TicketSlaTimer rows. Every change writes TicketStatusHistory (changed_via, seconds_in_previous).
     - SLA: Ticket.sla_policy_id picks a SlaPolicy; SlaPolicyTarget gives minutes per TicketPriority and per SlaMetric; TicketSlaTimer holds one timer per metric (RUNNING, PAUSED, MET, BREACHED, CANCELLED). Ticket.sla_at_risk
       and sla_breached are denormalized flags. At-risk reminders and breach checks are 20 ScheduledJobs (TicketSlaTimer.scheduled_job_id), never in-process timers.
     - INTERNAL NOTES (SupportMessage.kind = INTERNAL_NOTE) never leave the team: not in the portal (07), not in outbound email (11), not in CSAT, not in AI replies to customers. Enforced on the server; the composer shows
       a clear "Reply to customer" vs "Private note" switch and the note is painted yellow.
     - AI never acts alone unless the setting says so: every SupportAiSuggestion has status PENDING / ACCEPTED / REJECTED / AUTO_APPLIED / EXPIRED, a confidence and an explanation; auto-apply needs the matching
       SupportSettings.ai_auto_*_threshold; replies and task creation can require approval (ai_require_reply_approval, ai_require_task_approval). Acceptance feeds was_correct for accuracy reports.
     - Customer identity is the CRM record (02): contact_id / company_id / customer_user_id (Customer Portal User, 01 §79). Email, chat and widget visitors resolve to it; an unresolved visitor is a visitor_key + name + email.
     - Branch / team / project scope filters every list server-side (01 §38). Inboxes may belong to a Team and a Branch.
     - Lists are cursor-paginated, filtered by SavedView (entity_type TICKET / SUPPORT_CONVERSATION / KNOWLEDGE_ARTICLE, platform table from 02) and keyboard-first (j/k, r reply, n note, e resolve, s snooze, a assign).
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane, en } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + p + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const gap = (t) => '<span class="badge yellow" title="Not backed by the schema, see the Data model footer">' + t + "</span>";
  const spc = '<div style="height:12px"></div>';
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const row2 = (a, b) => '<div class="rowx" style="gap:8px;padding:0;align-items:flex-start">' + a + b + "</div>";
  const prop = (k, v) => '<div class="kvr"><span>' + k + "</span><b>" + v + "</b></div>";
  const chip = (fl, o, v) => '<span class="fchip"><b>' + fl + "</b><i>" + o + "</i><span>" + v + "</span>" + I("x", 12) + "</span>";
  const filterBar = (chips, extra) => '<div class="fbar"><div class="fchips">' + chips.map((c) => chip(c[0], c[1], c[2])).join("") + '<button class="btn sm ghost">' + I("plus", 13) + ' Add filter</button></div><div class="fright">' + (extra || "") + "</div></div>";
  const seg = (arr, on) => '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + arr.map((t) => '<span class="seg' + (t === on ? " on" : "") + '" title="' + t + '">' + en(t) + "</span>").join("") + "</div>";
  const editor = (txt) => '<div class="editor"><div class="ed-bar">' + ["B", "I", "H", "•", "1.", "</>", "Link", "Image", "/"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">' + txt + "</div></div>";

  /* ---------- people, customers, enums ---------- */
  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"] };
  const av = (a, s) => (a ? AV(a, PEOPLE[a][1], s || "") : '<span class="muted">Unassigned</span>');
  const wh = (a) => (a ? who(a, PEOPLE[a][1], PEOPLE[a][0], "") : '<span class="muted">Unassigned</span>');
  const CU = { LK: ["Lena Kovac", "p", "Acme Corp"], TB: ["Tom Brandt", "g", "Northwind"], YT: ["Yuki Tanaka", "y", "Globex"], PN: ["Priya Nair", "", "Initech"], OB: ["Ola Berg", "r", "Acme Corp"], DH: ["Dana Hughes", "p", "Stark Logistics"] };
  const cav = (c, s) => AV(c, CU[c][1], s || "");
  const cwh = (c) => who(c, CU[c][1], CU[c][0], CU[c][2]);
  const PRI = { URGENT: "red", HIGH: "yellow", NORMAL: "blue", LOW: "" };
  const pri = (v) => E(v, PRI[v]);
  const CATC = { NEW: "blue", OPEN: "green", PENDING_CUSTOMER: "yellow", ON_HOLD: "", RESOLVED: "purple", CLOSED: "" };
  const stb = (name, cat) => '<span class="badge ' + CATC[cat] + '" title="TicketStatusCategory ' + cat + '"><span class="dot"></span>' + name + "</span>";
  const CST = { OPEN: "green", PENDING: "yellow", SNOOZED: "", RESOLVED: "purple" };
  const SENT = { POSITIVE: "green", NEUTRAL: "", NEGATIVE: "yellow", FRUSTRATED: "red" };
  const CHI = { LIVE_CHAT: "chat", EMAIL: "mail", WIDGET: "chat", PORTAL: "globe", FORM: "file", API: "plug", PHONE: "phone" };
  const ch = (t) => '<span class="chn" title="SupportChannelType ' + t + '">' + I(CHI[t], 13) + en(t) + "</span>";
  /* @impl sla(state, text): one chip per TicketSlaTimer. RUNNING green, at risk (Ticket.sla_at_risk, elapsed >= SlaPolicy.at_risk_threshold_percent) yellow, BREACHED red, PAUSED grey (status pauses_sla), MET blue.
       The remaining time is computed on the server from due_at minus paused_seconds_total (business hours aware via SlaPolicy.calendar_id), never counted down only in the browser. */
  const sla = (st, t) => '<span class="sla ' + ({ RUNNING: "ok", RISK: "warn", BREACHED: "bad", PAUSED: "mute", MET: "met" }[st]) + '" title="TicketSlaTimer ' + (st === "RISK" ? "RUNNING (at risk)" : st) + '">' + I(st === "BREACHED" ? "flag" : "clock", 11) + t + "</span>";
  const sent = (v) => E(v, SENT[v]);
  const glyphDot = (c) => '<span class="sdot ' + CATC[c] + '"></span>';
  const kb = (k) => '<span class="key">' + k + "</span>";
  const pill = (t, on) => '<button class="pill' + (on ? " active" : "") + '">' + t + "</button>";
  const bars = (vals, tone, h) => '<div style="display:flex;align-items:flex-end;gap:6px;height:' + (h || 110) + 'px">' + vals.map((v) => '<span style="flex:1;background:var(--' + (tone || "blue") + ');border-radius:4px 4px 0 0;height:' + v * (((h || 110) - 6) / Math.max.apply(null, vals)) + 'px" title="' + v + '"></span>').join("") + "</div>";
  const hbar = (rows, tone) => rows.map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i style="width:' + r[1] + "%;background:var(--" + (r[3] || tone || "blue") + ')"></i></span><span class="v">' + r[2] + "</span></div>").join("");
  const line = (pts, tone, h) => { const w = 300, H = h || 100, max = Math.max.apply(null, pts), d = pts.map((p, i) => (i ? "L" : "M") + (5 + (i * (w - 10)) / (pts.length - 1)) + " " + (H - 8 - (p / max) * (H - 20))).join(" "); return '<svg viewBox="0 0 ' + w + " " + H + '" width="100%" height="' + H + '" style="display:block"><path d="' + d + '" stroke="var(--' + (tone || "blue") + ')" stroke-width="2" fill="none"/></svg>'; };

  /* ticket sample data: ref, subject, type, status name, status cat, priority, requester(CU), assignee, team, sla [state,text], source, category, updated, tasks, id of conversation
     (Ticket.reference = ticket_prefix + number) */
  const T = [
    ["TCK-2041", "Customer asks for CSV export of invoices", "FEATURE_REQUEST", "Open", "OPEN", "NORMAL", "LK", "AM", "Client success", ["RUNNING", "Resolution 3d 4h"], "PORTAL", "Billing", "12m ago", 1],
    ["TCK-2047", "Checkout fails with VAT number on iOS Safari", "BUG", "Open", "OPEN", "URGENT", "TB", "MS", "Support engineering", ["BREACHED", "First reply breached 1h 20m"], "EMAIL", "Bugs / Checkout", "6m ago", 1],
    ["TCK-2046", "How do I add a second billing contact?", "QUESTION", "New", "NEW", "NORMAL", "YT", "", "Client success", ["RISK", "First reply in 14m"], "LIVE_CHAT", "Billing / Account", "9m ago", 0],
    ["TCK-2044", "Invoice INV-2058 shows wrong company name", "BILLING", "Waiting on customer", "PENDING_CUSTOMER", "HIGH", "LK", "AM", "Billing", ["PAUSED", "Paused · waiting on customer"], "EMAIL", "Billing", "2h ago", 0],
    ["TCK-2043", "Portal login loop after password reset", "ACCOUNT", "Open", "OPEN", "HIGH", "PN", "SJ", "Support engineering", ["RUNNING", "Resolution 5h 10m"], "WIDGET", "Account / Login", "3h ago", 1],
    ["TCK-2040", "Change request: add approval step for design files", "CHANGE_REQUEST", "On hold", "ON_HOLD", "NORMAL", "OB", "KL", "Client success", ["PAUSED", "Paused · on hold"], "PORTAL", "Change requests", "1d ago", 0],
    ["TCK-2038", "App crashes on iOS 17.2 when offline", "BUG", "Open", "OPEN", "HIGH", "TB", "JK", "Support engineering", ["RUNNING", "Resolution 1d 2h"], "FORM", "Bugs / Mobile", "1d ago", 1],
    ["TCK-2036", "Outage: dashboards not loading for several clients", "INCIDENT", "Open", "OPEN", "URGENT", "DH", "MS", "Support engineering", ["RISK", "Resolution in 38m"], "EMAIL", "Incidents", "20m ago", 1],
    ["TCK-2031", "Please update our contact person on the contract", "OTHER", "Resolved", "RESOLVED", "LOW", "OB", "AM", "Client success", ["MET", "Met · 3h 12m"], "EMAIL", "Account", "2d ago", 0],
    ["TCK-2029", "Thanks, report looks good (CSAT 5)", "QUESTION", "Closed", "CLOSED", "LOW", "YT", "SJ", "Client success", ["MET", "Met · 41m"], "LIVE_CHAT", "General", "4d ago", 0],
  ];

  /* =====================================================================================================================
     SHARED INBOX (spec §1, §2, §7, §10)
     @screen Inbox · shared inbox, three panes: list, thread, customer
     @route  /support/inbox?view=mine|mentions|unassigned|all|<savedViewId>&status=&inbox=&channel=&assignee=&q= · opens /support/inbox/c/:conversationId in the middle pane
     @perm   VIEW support.conversations.read (scope-limited to the caller's inboxes/teams/branches) · reply support.conversations.reply · assign support.conversations.assign · close/resolve support.conversations.close
             · update (priority, tags, snooze, merge) support.conversations.update · convert to ticket support.tickets.create · AI suggestions support.ai.use · macros: read-only use needs support.conversations.reply
     @api    GET /support/conversations?view=&status=&inbox_id=&channel_type=&assignee=&sla=&sentiment=&q=&cursor= · GET /support/conversations/:id (+ messages) · POST /support/conversations/:id/messages {kind: AGENT|INTERNAL_NOTE, body,
             mentions[], canned_response_id?, attachment_document_ids[]} · POST /support/conversations/bulk {ids|filter, action: assign|status|priority|tag|snooze|move_inbox, value} · PATCH /support/conversations/:id
             · realtime channel support:conversation:<id> (new message, typing, read receipts, assignment)
     @mcp    support_conversations_read · support_conversations_reply (sensitive when an AI agent calls it: human confirmation) · support_conversations_assign · support_conversations_close · support_conversations_update
     @data   SupportConversation (status, priority, channel_type, inbox_id, assignee_membership_id, team_id, snoozed_until, sentiment, ai_summary, message_count, last_message_at, last_customer_message_at,
             first_agent_response_at, merged_into_conversation_id, split_from_conversation_id) · SupportConversationParticipant (role, last_read_at = unread count) · SupportMessage (kind, body, mentions, canned_response_id,
             delivery_status, read_by_customer_at, is_first_response, ai_suggestion_id) · SupportMessageAttachment (document_id, 17) · Ticket (conversation_id, TicketSlaTimer) · CrmContact/CrmCompany (02) read-only
             · SupportAiSuggestion (REPLY, SUMMARY) · SupportCannedResponse · SavedView (entity_type SUPPORT_CONVERSATION) · Tagging (RecordEntityType SUPPORT_CONVERSATION)
     @ui     three-pane layout (ResizablePanelGroup), list rows with virtualization, Checkbox + sticky bulk bar, Popover+Command for assignee / macro / snooze pickers, Tabs or ToggleGroup for status, Badge, Avatar, Tooltip for typing/read
             receipts, Dialog for merge, Sheet for the customer panel below 1280px
     @states loading skeleton rows · empty ("Inbox zero") · error with retry · no-access · offline/reconnecting banner for the realtime channel · send failed (SupportMessage.delivery_status FAILED/BOUNCED, with retry)
     @audit  CONVERSATION_ASSIGNED, CONVERSATION_STATUS_CHANGED, CONVERSATION_SNOOZED, CONVERSATION_MERGED, CONVERSATION_SPLIT, MESSAGE_SENT, NOTE_ADDED (suggested names; see gaps-13.md, audit event types are not in the catalog yet)
     @note   "Your inbox" = assignee_membership_id = me OR a SupportConversationParticipant row of mine. "Unassigned" = no assignee inside the caller's inboxes. SLA chips come from the conversation's open Ticket (if any); a conversation
             with no ticket has no SLA, so it shows the age of the last customer message instead. A conversation becomes a ticket with one click (create ticket, keeps the thread). Typing indicators and online presence are
             ephemeral realtime events, never stored. Read receipts: read_by_customer_at (customer side) and SupportConversationParticipant.last_read_at (agent side). Select-all selects by FILTER, the API re-evaluates it.
     ===================================================================================================================== */
  const CV = [
    ["LK", "Can we change the billing contact on the invoice?", "11:43", "LIVE_CHAT", 1, "OPEN", "NORMAL", ["RUNNING", "Reply in 8m"], "AM", "NEUTRAL", ["pricing", "billing"], "TCK-2044"],
    ["TB", "Checkout fails with VAT number on iOS Safari", "11:20", "EMAIL", 1, "OPEN", "URGENT", ["BREACHED", "Breached 1h 20m"], "MS", "FRUSTRATED", ["bug"], "TCK-2047"],
    ["YT", "How do I add a second billing contact?", "11:12", "LIVE_CHAT", 1, "OPEN", "NORMAL", ["RISK", "Reply in 14m"], "", "NEUTRAL", [], "TCK-2046"],
    ["DH", "Dashboards not loading for us since 10:30", "11:01", "EMAIL", 1, "OPEN", "URGENT", ["RISK", "Resolve in 38m"], "MS", "NEGATIVE", ["outage"], "TCK-2036"],
    ["PN", "Portal login loop after password reset", "09:48", "WIDGET", 0, "OPEN", "HIGH", ["RUNNING", "Resolve in 5h"], "SJ", "NEGATIVE", ["login"], "TCK-2043"],
    ["OB", "Re: Contract contact update", "Yesterday", "EMAIL", 0, "PENDING", "LOW", ["PAUSED", "Waiting on customer"], "AM", "POSITIVE", [], ""],
    ["TB", "App crashes on iOS 17.2 offline", "Yesterday", "FORM", 0, "OPEN", "HIGH", ["RUNNING", "Resolve in 1d"], "JK", "NEUTRAL", ["bug", "mobile"], "TCK-2038"],
    ["LK", "Request: dark mode for the portal", "Mon", "PORTAL", 0, "SNOOZED", "LOW", ["PAUSED", "Snoozed until Fri"], "AM", "POSITIVE", ["feature"], ""],
  ];
  function inbox() {
    const bub = (c, x, t, me, extra) => '<div class="bub-row ' + (me ? "me" : "") + '">' + (me ? "" : cav(c, "lg")) + '<div class="bub ' + (me ? "agent" : "") + '">' + x + "<small>" + t + (extra || "") + "</small></div>" + (me ? AV("AM", "", "lg") : "") + "</div>";
    return '<div class="sp wide"><section class="sp-list"><div class="sp-lh"><b>Your inbox</b><span class="badge">12</span><span style="flex:1"></span><button class="btn ghost sm">' + I("sort", 13) + " Newest</button><button class=\"btn ghost sm icon\">" + I("filter", 14) + "</button></div>" +
      '<div class="pills" style="margin:0;padding:0 12px 8px">' + pill("Open <b>9</b>", 1) + pill("Pending <b>2</b>") + pill("Snoozed <b>1</b>") + pill("Resolved") + "</div>" +
      '<div class="sp-views">' + ["Your inbox", "Mentions 2", "Unassigned 4", "SLA at risk 3", "VIP clients", "All"].map((v, i) => '<span class="seg' + (i === 0 ? " on" : "") + '">' + v + "</span>").join("") + "</div>" +
      '<div class="sp-fl">' + chip("Inbox", "is", "Support") + '<button class="btn sm ghost">' + I("plus", 13) + " Filter</button></div>" +
      '<div class="sp-bulk">' + cb(1) + "<b>2</b>" + sel("Assign", "users") + sel("Status") + btn("", "snooze", "sm icon") + btn("", "layers", "sm icon") + "</div>" +
      '<div class="sp-rows">' + CV.map((c, i) => '<div class="cv' + (i === 0 ? " sel" : "") + '">' + cb(i === 1 || i === 3) + cav(c[0], "lg") + '<div class="cvb"><div class="cvt"><b>' + CU[c[0]][0] + "</b><span>" + CU[c[0]][2] + "</span><i>" + c[2] + '</i></div><div class="cvs">' + c[1] + '</div><div class="cvm">' + I(CHI[c[3]], 12) + (c[11] ? '<span class="badge">' + c[11] + "</span>" : "") + sla(c[7][0], c[7][1]) + (c[6] === "URGENT" || c[6] === "HIGH" ? E(c[6], PRI[c[6]]) : "") + c[10].map((t) => '<span class="badge">' + t + "</span>").join("") + '<span style="flex:1"></span>' + (c[8] ? av(c[8], "sm") : I("users", 13)) + "</div></div>" + (c[4] ? '<span class="ud"></span>' : "") + "</div>").join("") + "</div>" +
      '<div class="pager" style="padding:8px 14px"><span class="muted">1–8 of 12 · cursor pagination</span></div></section>' +

      '<section class="sp-conv"><header class="sp-ch"><div><b>Lena Kovac</b><small>Acme Corp · ' + en("LIVE_CHAT") + ' · started 14 min ago · <span class="typing">typing…</span></small></div><span style="flex:1"></span>' +
      '<button class="btn sm">' + AV("AM", "", "") + " Anna Meyer " + I("down", 12) + '</button><button class="btn sm">' + I("snooze", 13) + ' Snooze</button><button class="btn sm">' + I("tag", 13) + ' Create ticket</button><button class="btn primary sm">' + I("check", 13) + " Resolve</button></header>" +
      '<div class="sp-sum">' + I("sparkles", 13) + "<span><b>AI summary</b> Customer wants the billing contact on invoice INV-2058 changed; has approved pricing in the portal. Needs new name and email. " + muted("SupportConversation.ai_summary · refreshed 2m ago") + "</span></div>" +
      '<div class="sp-msgs"><div class="day"><span>Today</span></div>' +
      bub("LK", "Hi! Quick question: the homepage looks great. Can you send the final pricing table for approval?", "10:38 AM", 0) +
      bub("LK", "Hi, are you there?", "10:39 AM", 0) +
      bub("AM", "Hi Lena, absolutely. I'll push it to your client portal so you can approve it there. One moment.", "10:40 AM", 1, " · " + I("check", 11) + " Read 10:41") +
      '<div class="note-row"><span class="nt">' + I("lock", 12) + " Private note</span> @Marco pricing table is ready in the Acme Rebrand project, just needs the final VAT line.<small>Anna Meyer · 10:41 AM · only the team sees this (SupportMessage.kind INTERNAL_NOTE)</small></div>" +
      '<div class="sys-row">' + I("users", 12) + " Anna Meyer assigned this conversation to herself · 10:39 AM " + muted("SupportMessage.kind SYSTEM") + "</div>" +
      bub("LK", "Perfect, thank you! And one more thing: can we change the billing contact on the invoice?", "10:43 AM", 0) +
      '<div class="ai-sug"><div class="ai-h">' + I("sparkles", 14) + ' <b>Suggested reply</b>' + E("REPLY") + '<span class="badge green" style="margin-left:6px">Confidence 0.91</span><span class="badge" style="margin-left:6px">Uses CRM + billing</span></div><p>"Of course! I can update the billing contact for Acme Corp. Could you share the new name and email? I will apply it to the open invoice INV-2058 and all future ones."</p><div style="display:flex;gap:6px;align-items:center"><button class="btn primary sm">Use reply</button><button class="btn sm">Edit</button><button class="btn sm">Reject</button><span class="muted" style="margin-left:auto">SupportAiSuggestion · PENDING · cites article “Change the billing contact”</span></div></div>' +
      "</div>" +
      '<div class="mx-pop"><div class="mx-h">' + I("zap", 13) + ' Macros <span class="muted">type / in the composer</span></div>' + [["/billing-contact", "Ask for new billing contact", "TEAM"], ["/thanks-resolved", "Thanks and close", "ORGANIZATION"], ["/need-info", "Ask for steps to reproduce", "ORGANIZATION"], ["/my-signoff", "Personal sign-off", "PERSONAL"]].map((m, i) => '<div class="mx-i' + (i === 0 ? " on" : "") + '"><b>' + m[0] + "</b><span>" + m[1] + "</span>" + E(m[2]) + "</div>").join("") + "</div>" +
      '<div class="composer"><div class="c-tabs"><button class="pill active">Reply to customer</button><button class="pill">' + I("lock", 11) + ' Private note</button><span style="flex:1"></span><span style="color:var(--ash);font-size:12px">Replying via ' + en("LIVE_CHAT") + " · Anna Meyer</span></div><div class=\"c-in\">/billing-contact</div><div class=\"c-bar\"><button class=\"btn ghost sm icon\">" + I("plus", 15) + '</button><button class="btn ghost sm icon">' + I("clip", 15) + '</button><button class="btn ghost sm icon">' + I("smile", 15) + '</button><button class="btn ghost sm icon">' + I("book", 15) + '</button><button class="btn ghost sm icon">' + I("sparkles", 15) + '</button><span style="flex:1"></span>' + sel("Then: keep open") + '<button class="btn primary sm">' + I("send", 13) + " Send " + kb("Ctrl Enter") + "</button></div></div></section>" +

      '<aside class="sp-info"><div class="in-prof">' + cav("LK", "xl") + '<b>Lena Kovac</b><small>lena@acme.example · local time 11:46 (CET)</small><div class="badges"><span class="badge purple" title="Customer Portal User (01 §79)">Portal user</span><span class="badge green">Active contract</span><span class="badge yellow">VIP</span></div></div>' +
      '<div class="in-sec"><h6>Conversation</h6>' + [["Assignee", "Anna Meyer"], ["Team", "Client success"], ["Inbox", "Support"], ["Priority", pri("NORMAL")], ["Sentiment", sent("NEUTRAL")], ["Language", "English (detected)"], ["Ticket", '<a class="lnk">TCK-2044</a>'], ["Tags", '<span class="badge">pricing</span> <span class="badge">billing</span>']].map((r) => kv(r[0], r[1])).join("") + "</div>" +
      '<div class="in-sec"><h6>Customer 360 ' + muted("(02)") + '</h6>' + kv("Company", "Acme Corp " + I("link", 11)) + kv("Plan", "Retainer · €4.8k/mo") + kv("Open invoices", "1 · €12,400 " + muted("(08)")) + kv("Last 90 days", "3 conversations · 2 tickets") + kv("CSAT", "4.8 avg · 5 ratings") + "</div>" +
      '<div class="in-sec"><h6>Linked records</h6><a class="lr">' + I("folder", 14) + "<span>Acme Rebrand Website</span><i>Project</i></a><a class=\"lr\">" + I("tasks", 14) + "<span>WEB-142 Pricing page hero</span><i>Task</i></a><a class=\"lr\">" + I("dollar", 14) + "<span>INV-2058</span><i>Invoice</i></a><a class=\"lr\">" + I("pen", 14) + "<span>Acme MSA v3</span><i>Contract</i></a>" +
      '<button class="btn sm" style="width:100%;margin-top:8px">' + I("plus", 13) + " Create task from conversation</button></div>" +
      '<div class="in-sec"><h6>Suggested articles</h6><a class="lr">' + I("book", 14) + "<span>Change the billing contact</span><i>0.88</i></a><a class=\"lr\">" + I("book", 14) + "<span>Where to find your invoices</span><i>0.61</i></a></div>" +
      '<div class="in-sec"><h6>Collaborators</h6><div class="rowx" style="padding:0;gap:6px">' + av("AM") + av("MS") + btn("Add", "plus", "sm") + "</div></div></aside>" +
      "</div>" + '<div class="a-page" style="padding-top:0;max-width:none">' + dm(["SupportConversation · status, priority, channel_type, inbox_id, assignee_membership_id, team_id, snoozed_until, sentiment, ai_summary, last_message_at, merged_into_conversation_id, split_from_conversation_id", "SupportConversationParticipant · role, last_read_at", "SupportMessage · kind, body, mentions, canned_response_id, delivery_status, read_by_customer_at, is_first_response, ai_suggestion_id", "SupportAiSuggestion · kind REPLY, SUMMARY, ARTICLE_RECOMMENDATION · confidence, status, payload", "Ticket · reference, conversation_id, sla timers · SavedView · Tagging · CrmContact, CrmCompany (read-only)"], ["No presence/typing store (ephemeral realtime, by design)", "Agent availability and concurrent-chat capacity for routing: no table (see gaps-13.md)", "Audit event type names for support: not in audit-event-types.ts"]) + "</div>";
  }

  /* =====================================================================================================================
     CONVERSATION PAGE (spec §1, §3, §4, §14)
     @screen Conversation detail · one email conversation with ticket, task link, merge, split, CSAT
     @route  /support/c/:conversationId (deep link, full width) · same pane opens inside the inbox
     @perm   VIEW support.conversations.read · reply support.conversations.reply · merge/split/transfer support.conversations.update · assign support.conversations.assign · resolve support.conversations.close
             · create ticket support.tickets.create · merge tickets support.tickets.merge · convert to task support.tickets.convert_to_task · AI support.ai.use · export support.conversations.export*
     @api    GET /support/conversations/:id · POST /support/conversations/:id/merge {into_conversation_id} · POST /support/conversations/:id/split {from_message_id} · POST /support/conversations/:id/transfer {team_id, assignee?, note}
             · POST /support/conversations/:id/tickets {type, priority, category_id, ...} · POST /support/tickets/:id/convert-to-task {project_id, type_id, idempotency_key} · POST /support/conversations/:id/csat
     @mcp    support_conversations_read · support_conversations_update · support_tickets_create · support_tickets_convert_to_task (sensitive, human confirmation for AI callers) · support_ai_use
     @data   as the inbox plus TicketConversation · TicketTaskLink (kind, sync_status, last_synced_task_status, idempotency_key, ai_suggestion_id) · Task (06, read-only) · SupportCsatRating · SupportAiSession (handover_summary)
     @ui     Tabs in the right panel (Customer, Ticket, Work, AI), AlertDialog for merge and resolve-without-reply, Dialog for convert-to-task with project Combobox, Timeline for system events
     @states loading · not found · merged ("Merged into #…", read-only link) · error · no-access · task-sync error (TicketTaskLink.sync_status false)
     @audit  CONVERSATION_MERGED, CONVERSATION_SPLIT, CONVERSATION_TRANSFERRED, TICKET_CREATED, TICKET_TASK_LINKED, CSAT_REQUESTED (suggested names)
     @note   Merge moves every message of the source into the target (source gets merged_into_conversation_id and becomes read-only). Split starts at a chosen message and creates a new conversation with
             split_from_conversation_id. Transfer changes team_id and assignee, writes a SYSTEM message and (if enabled) an AI handover summary. Task conversion is idempotent (TicketTaskLink.idempotency_key) and the
             Task is created by the 06 service with its own permission check; sync is one-directional per event with a mapping (SupportSettings.task_status_sync_mapping), no update loops.
     ===================================================================================================================== */
  function conversation() {
    const msg = (c, x, t, kind) => '<div class="th-m' + (kind === "AGENT" ? " ag" : "") + '"><div class="th-a">' + (kind === "AGENT" ? AV("MS", "g", "lg") : cav(c, "lg")) + '</div><div class="th-b"><div class="th-h"><b>' + (kind === "AGENT" ? "Marco Silva" : CU[c][0]) + "</b>" + E(kind, kind === "AGENT" ? "blue" : "") + "<small>" + t + "</small></div><div class=\"th-t\">" + x + "</div></div></div>";
    return '<div class="sp wide2"><section class="sp-conv" style="border-right:1px solid var(--hairline)"><header class="sp-ch"><div><b>Checkout fails with VAT number on iOS Safari</b><small>Tom Brandt · Northwind · ' + en("EMAIL") + " · conversation #C-8812 · started today 09:58</small></div><span style=\"flex:1\"></span>" + stb("Open", "OPEN") + pri("URGENT") + '<button class="btn sm">' + I("more", 14) + '</button><button class="btn primary sm">' + I("check", 13) + " Resolve</button></header>" +
      '<div class="sp-sum warn">' + I("sparkles", 13) + "<span><b>AI summary</b> Checkout on iOS Safari rejects EU VAT numbers with a spaces. Reproduced on 17.2 and 17.4. Customer frustrated, wants a fix before Friday's invoice run. " + muted("Sentiment ") + sent("FRUSTRATED") + "</span></div>" +
      '<div class="sp-msgs"><div class="day"><span>Today</span></div>' +
      msg("TB", "Hi team, our checkout fails when a customer enters a VAT number. Message: “Invalid VAT”. Only on iPhone. Screenshot attached.<div class=\"att\">" + I("clip", 12) + " IMG_4021.png · 412 KB " + muted("SupportMessageAttachment → Document (17)") + "</div>", "09:58 · received by email · " + E("DELIVERED", "green"), "CUSTOMER") +
      '<div class="sys-row">' + I("sparkles", 12) + " AI classified: " + E("BUG") + " · " + pri("URGENT") + " · category Bugs / Checkout · confidence 0.93 · " + E("AUTO_APPLIED", "green") + "</div>" +
      '<div class="sys-row">' + I("tag", 12) + " Ticket <a class=\"lnk\">TCK-2047</a> created from this conversation · SLA policy “Priority clients” attached</div>" +
      msg("MS", "Hi Tom, thanks for the screenshot. I can reproduce it. Which iOS version are you on, and does it fail with and without spaces in the number?", "10:05 · sent via Communication Center · " + E("DELIVERED", "green") + " · read 10:09", "AGENT") +
      '<div class="note-row"><span class="nt">' + I("lock", 12) + " Private note</span> Looks like the same regex bug as WEB-148. @Jonas can you check the Safari build today?<small>Marco Silva · 10:12 · mentions: Jonas Koch (SupportConversationParticipant MENTIONED)</small></div>" +
      msg("TB", "iOS 17.2. It fails both ways. We have 40 invoices going out Friday, this is blocking us.", "10:21 · received by email", "CUSTOMER") +
      '<div class="lk-card">' + I("tasks", 16) + '<div class="grow"><b>WEB-148 · Add VAT number validation to checkout</b><small>' + E("CONVERTED", "blue") + " · Task status In progress · synced 2 min ago · sync on</small></div>" + btn("Open task", "link", "sm") + "</div>" +
      '<div class="ai-sug" style="margin-left:0"><div class="ai-h">' + I("sparkles", 14) + " <b>Duplicate detected</b>" + E("DUPLICATE_TICKET") + '<span class="badge green" style="margin-left:6px">0.87</span></div><p>TCK-2038 “App crashes on iOS 17.2 when offline” is from the same customer and platform. Related, not a duplicate. TCK-2041 is unrelated.</p><div style="display:flex;gap:6px"><button class="btn primary sm">Link as related</button><button class="btn sm">Reject</button></div></div>' +
      '<div class="csat-card"><b>' + I("star", 14) + " CSAT will be requested 30 min after resolve</b><span class=\"muted\">SupportSettings.csat_enabled · csat_delay_minutes 30 · token link by email, expires in 7 days</span></div>" +
      "</div>" +
      '<div class="composer"><div class="c-tabs"><button class="pill">Reply to customer</button><button class="pill active">' + I("lock", 11) + ' Private note</button><span style="flex:1"></span><span class="muted" style="font-size:12px">Only the team sees notes · type @ to mention</span></div><div class="c-in" style="background:var(--yellow-soft)">@Jonas I attached the Safari console log…</div><div class="c-bar"><button class="btn ghost sm icon">' + I("clip", 15) + '</button><button class="btn ghost sm icon">' + I("at", 15) + '</button><span style="flex:1"></span><button class="btn sm">' + I("lock", 13) + " Add note</button></div></div></section>" +

      '<aside class="sp-info"><div class="tabset"><div style="padding:0 12px">' + tabs([["c", "Customer"], ["t", "Ticket"], ["w", "Work"], ["a", "AI"]], "t") + "</div>" +
      pane("c", 0, '<div class="in-prof">' + cav("TB", "xl") + "<b>Tom Brandt</b><small>tom@northwind.example</small></div>" + '<div class="in-sec"><h6>Customer 360 ' + muted("(02)") + "</h6>" + kv("Company", "Northwind") + kv("Contract", "Support retainer · active") + kv("Open invoices", "0") + kv("Projects", "Mobile App v2 · Billing migration") + kv("Previous tickets", "4 · 1 open") + kv("CSAT", "4.2 avg") + "</div>") +
      pane("t", 1, '<div class="in-sec"><h6>TCK-2047 ' + muted("Ticket") + "</h6>" + kv("Status", stb("Open", "OPEN")) + kv("Priority", pri("URGENT")) + kv("Type", E("BUG")) + kv("Category", "Bugs / Checkout") + kv("Assignee", "Marco Silva") + kv("Team", "Support engineering") + kv("First response", sla("MET", "Met · 7m")) + kv("Resolution", sla("RISK", "due in 3h 40m")) + kv("Policy", "Priority clients") + '<div style="display:flex;gap:6px;margin-top:8px">' + btn("Escalate", "flag", "sm") + btn("Merge…", "layers", "sm") + btn("Open ticket", "link", "sm") + "</div></div>" +
        '<div class="in-sec"><h6>Merge conversation</h6><div class="sub-note" style="margin-bottom:6px">Moves all messages into the target; this conversation becomes read-only.</div>' + sel("Search conversation or ticket…", "search") + '<div class="rowx" style="padding:6px 0;gap:8px"><div class="grow"><b>C-8790 · Checkout error iOS</b><small>Same customer · 1 message</small></div>' + btn("Merge", "layers", "sm") + "</div></div>" +
        '<div class="in-sec"><h6>Split / transfer</h6><div style="display:flex;gap:6px;flex-wrap:wrap">' + btn("Split from message…", "list", "sm") + btn("Transfer to team…", "users", "sm") + btn("Move inbox…", "inbox", "sm") + "</div></div>") +
      pane("w", 0, '<div class="in-sec"><h6>Tasks ' + muted("(06)") + '</h6><a class="lr">' + I("tasks", 14) + "<span>WEB-148 VAT validation</span><i>Converted</i></a><a class=\"lr\">" + I("tasks", 14) + "<span>MOB-95 iOS offline crash</span><i>Linked</i></a>" + btn("Create task from ticket", "plus", "sm") + '</div><div class="in-sec"><h6>Project ' + muted("(05)") + '</h6><a class="lr">' + I("folder", 14) + "<span>Stripe Billing Migration</span><i>Project</i></a></div>" + '<div class="in-sec"><h6>Followers</h6><div class="rowx" style="padding:0;gap:6px">' + av("MS") + av("JK") + av("AM") + "</div></div>") +
      pane("a", 0, '<div class="in-sec"><h6>AI actions ' + muted("support.ai.use") + "</h6>" + ["Summarize conversation", "Suggest reply", "Rewrite my draft (shorter, friendlier)", "Translate customer message", "Extract action items", "Draft bug report for the task", "Suggest knowledge article"].map((a) => '<div class="rowx" style="padding:6px 0"><div class="grow">' + a + "</div>" + btn("", "sparkles", "sm icon") + "</div>").join("") + "</div>") +
      "</div></aside></div>" +
      '<div class="a-page" style="padding-top:0;max-width:none">' + dm(["SupportConversation · merged_into_conversation_id, split_from_conversation_id, team_id, snoozed_until, language, sentiment, ai_summary", "SupportMessage · kind, delivery_status, comm_message_id (11), in_reply_to_message_id, external_message_id, translations", "SupportMessageAttachment · document_id (17) · TicketConversation · Ticket · TicketTaskLink · Task (06)", "SupportCsatRating · requested_at, token, expires_at · SupportSettings · csat_enabled, csat_delay_minutes", "SupportAiSuggestion · DUPLICATE_TICKET, CLASSIFICATION · auto_applied"], []) + "</div>";
  }

  /* =====================================================================================================================
     TICKETS — table with filters, saved views, bulk actions (spec §2)
     @screen Tickets list
     @route  /support/tickets?view=<savedViewId>&filter=<json>&sort=&group=&q=
     @perm   VIEW support.tickets.read (scope-limited) · create support.tickets.create · bulk edit support.tickets.update · assign support.tickets.assign · merge support.tickets.merge · escalate support.tickets.escalate
             · archive support.tickets.archive · delete support.tickets.delete* · export support.tickets.export*
     @api    GET /support/tickets?filter=&sort=&group=&q=&cursor= · POST /support/tickets/bulk {ticket_ids|filter, patch|action} · GET/POST/PATCH /saved-views?entity_type=TICKET
     @mcp    support_tickets_read (accepts the same filter JSON) · support_tickets_update · support_tickets_assign · support_tickets_merge
     @data   Ticket (reference, number, subject, type, status_id, priority, category_id, requester_*, company_id, assignee_membership_id, team_id, project_id, sla_policy_id, sla_at_risk, sla_breached, due_at, source,
             channel_type, escalation_level, incident_id, ai_*, archived_at, search_vector) · TicketStatus (category, name) · TicketSlaTimer · TicketTaskLink (count) · SavedView (entity_type TICKET)
     @ui     Table with column chooser, filter bar (Popover+Command pickers), saved-view Select, sticky bulk bar, DropdownMenu row actions, Dialog "Save view", Badge, Tooltip
     @states loading skeleton · empty ("No tickets match these filters" + clear) · error · no-access · partial results warning when a filter hits a restricted field
     @audit  one audit event per ticket for bulk actions + a summary event with the filter used
     @note   Saved views are SavedView rows (entity_type TICKET, platform table 02) with visibility PERSONAL | TEAM | ORGANIZATION. System views shown first: My open, Unassigned, SLA at risk (Ticket.sla_at_risk), SLA breached
             (Ticket.sla_breached), Waiting on customer (status category PENDING_CUSTOMER), Bugs, Created from AI. Bulk status changes only offer transitions allowed for every selected ticket (TicketStatus.allowed_transitions).
             Custom ticket fields (custom_field_definitions, entity TICKET) can be added as columns and filters. Full-text search is Ticket.search_vector.
     ===================================================================================================================== */
  function tickets() {
    return '<div class="a-page">' + head("Tickets", "Every structured support case you can see, with SLA state.", btn("Export", "file") + btn("New ticket", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Open", 47, "+6 today") + stat("Unassigned", 4, "needs routing", 1) + stat("SLA at risk", 3, "next 1h", 1) + stat("Breached", 1, "today", 1) + stat("Waiting on customer", 9, "SLA paused") + stat("Avg first response", "11m", "target 15m") + "</div>" +
      '<div class="pills" style="margin-bottom:6px">' + pill("My open <b>14</b>", 1) + pill("Unassigned <b>4</b>") + pill("SLA at risk <b>3</b>") + pill("Breached <b>1</b>") + pill("Waiting on customer <b>9</b>") + pill("Bugs <b>12</b>") + pill("Created by AI <b>6</b>") + '<button class="pill">' + I("plus", 12) + " Save as view</button></div>" +
      '<div class="toolbar">' + search("Search subject, reference, requester, description") + sel("Table", "grid") + sel("Group: None") + sel("Sort: SLA due ↑", "sort") + sel("Columns (13)", "settings") + sel("View: My open", "star") + "</div>" +
      filterBar([["Status category", "is any of", "New, Open"], ["Assignee", "is", "Me"], ["Priority", "is any of", "High, Urgent"], ["Created", "after", "Nov 1"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>3 selected</b><span class="muted">select all 47 matching filter</span><span style="flex:1"></span>' + sel("Assign to…", "users") + sel("Status…") + sel("Priority…") + sel("Category…", "tag") + sel("Team…", "users") + btn("Merge", "layers", "sm") + btn("Escalate", "flag", "sm") + btn("Archive", "archive", "sm") + "</div>" +
      '<div class="panel" style="margin-top:0"><table>' + th(["", "Ref", "Subject", "Type", "Status", "Priority", "SLA", "Requester", "Assignee", "Team", "Category", "Source", "Task", "Updated"]) + "<tbody>" +
      T.map((r, i) => "<tr><td>" + cb(i === 1 || i === 2 || i === 7) + "</td><td class='muted'>" + r[0] + "</td><td>" + ink(r[1]) + "</td><td>" + E(r[2]) + "</td><td>" + stb(r[3], r[4]) + "</td><td>" + pri(r[5]) + "</td><td>" + sla(r[9][0], r[9][1]) + "</td><td>" + cwh(r[6]) + "</td><td>" + wh(r[7]) + "</td><td>" + r[8] + "</td><td>" + r[11] + "</td><td>" + ch(r[10]) + "</td><td>" + (r[13] ? '<span class="badge blue">' + I("tasks", 11) + " 1</span>" : "—") + "</td><td class='muted'>" + r[12] + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="pager"><span class="muted">1–10 of 47</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["Ticket · reference, subject, type, status_id, priority, category_id, requester_contact_id, requester_name, company_id, assignee_membership_id, team_id, sla_at_risk, sla_breached, source, channel_type, search_vector", "TicketStatus · name, category · TicketSlaTimer · metric, status, due_at · TicketTaskLink · count", "SavedView · entity_type TICKET, layout, visibility, team_id, filters, sorting, grouping, columns, search"], []) + "</div>";
  }

  /* =====================================================================================================================
     TICKET DETAIL (spec §2, §3, §4, §7, §14)
     @screen Ticket page
     @route  /support/tickets/:reference (e.g. /support/tickets/TCK-2047) · ?tab=overview|conversations|work|relations|history|time
     @perm   VIEW support.tickets.read · edit support.tickets.update · assign support.tickets.assign · escalate support.tickets.escalate · merge support.tickets.merge · convert to task support.tickets.convert_to_task
             · delete support.tickets.delete* · reply support.conversations.reply · AI support.ai.use
     @api    GET /support/tickets/:ref · PATCH /support/tickets/:id · POST /support/tickets/:id/status {status_id, reason} · POST /support/tickets/:id/escalate {to_membership_id, note} · POST /support/tickets/:id/merge {into_ticket_id}
             · POST /support/tickets/:id/relations {target_ticket_id, type} · POST /support/tickets/:id/convert-to-task · POST /support/tickets/:id/link-task {task_id} · POST /support/tickets/:id/followers · POST /support/tickets/:id/attachments {document_id}
     @mcp    support_tickets_read · support_tickets_update · support_tickets_assign · support_tickets_escalate · support_tickets_merge · support_tickets_convert_to_task
     @data   Ticket (all columns) · TicketStatusHistory · TicketSlaTimer · TicketRelation (type, detected_by_ai, confidence) · TicketTaskLink · TicketFollower · TicketAttachment (document_id) · TicketConversation
             · SupportIncident (incident_id) · SupportMessage (via conversation) · TimeEntry (18, ticket_id, read-only) · Project / ProjectChangeRequest / Release (read-only) · audit_events · crm_notes (entity TICKET)
     @ui     Two-column page: tabs left (Tabs), property panel right (Select / Popover+Command pickers), Timeline for history, Table for relations, AlertDialog for resolve/close/merge, Sheet for AI
     @states loading · not found · merged (redirects to the target with a banner) · error · no-access · archived (read-only banner)
     @audit  TICKET_UPDATED (field diff), TICKET_STATUS_CHANGED (TicketStatusHistory), TICKET_ESCALATED, TICKET_MERGED, TICKET_RELATION_ADDED, TICKET_TASK_LINKED, TICKET_AI_APPLIED (suggested names)
     @note   Resolving requires Ticket.resolution text when SupportSettings has it enforced (shown as required in the dialog) and writes resolved_at/resolved_by_membership_id; it starts auto_close_at (auto_close_after_days) and
             requests CSAT. A customer reply within reopen_window_days reopens (reopen_count++). Merge: the source gets merged_into_ticket_id and is closed, conversations and followers move. Escalation raises
             escalation_level and notifies escalated_to_membership_id. customer_visible controls whether the ticket and its public replies appear in the portal (07); internal notes never do.
     ===================================================================================================================== */
  function ticket() {
    return '<div class="a-page">' + '<div class="a-head"><div><h1>Checkout fails with VAT number on iOS Safari</h1><p>TCK-2047 · created today 09:58 by email from Tom Brandt · ' + E("BUG") + " · " + E("EMAIL") + " · Customer visible in portal</p></div>" +
      '<div class="acts">' + btn("Follow", "bell") + btn("Escalate", "flag") + btn("Merge", "layers") + btn("Create task", "tasks") + btn("Resolve", "check", "primary") + "</div></div>" +
      callout("flag", "<b>First response breached 1h 20m ago</b> (target 15 min for URGENT in “Priority clients”). It was answered at 10:05 and the timer is now MET; resolution is due in 3h 40m.", "warn") + spc +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div><div class="tabset">' + tabs([["o", "Overview"], ["c", "Conversations", 2], ["w", "Tasks & project", 2], ["r", "Relations", 3], ["h", "History"], ["t", "Time"]], "o") +
      pane("o", 1, cd("<b>Description</b>", "<p>Customer reports that entering an EU VAT number at checkout shows “Invalid VAT”. Happens only in Safari on iOS 17.2, fine on desktop.</p><p><b>Steps to reproduce</b> (extracted by AI)</p><ol style='margin:0 0 6px 18px'><li>Open the checkout on iOS 17.2 Safari</li><li>Enter DE 123 456 789 in the VAT field</li><li>Tap Pay</li></ol><p class='muted'>Expected: accepted. Actual: error, spaces not normalised. Affected: checkout, 40 invoices Friday. Attachments: IMG_4021.png.</p>") + spc +
        cd("<b>Latest messages</b><span class='r'>" + btn("Open full thread", "chat", "sm") + "</span>", '<div class="rowx"><div class="grow"><b>Tom Brandt · customer</b><small>10:21 · “iOS 17.2. It fails both ways. We have 40 invoices going out Friday…”</small></div></div><div class="rowx"><div class="grow"><b>Marco Silva · reply</b><small>10:05 · “Which iOS version are you on…”</small></div></div><div class="rowx"><div class="grow"><b>Marco Silva · ' + E("INTERNAL_NOTE", "yellow") + "</b><small>10:12 · “Same regex bug as WEB-148…”</small></div></div>" + '<div class="rowx"><div class="grow muted">Write a reply…</div>' + sel("Reply to customer", "mail") + btn("Send", "send", "primary sm") + "</div>", 1) + spc +
        cd("<b>Resolution</b><span class='r muted'>required to resolve</span>", '<div class="editor"><div class="ed-body">Shown to the customer when the ticket is resolved. Explain the fix or workaround.</div></div>') + spc +
        cd("<b>Attachments</b><span class='r muted'>TicketAttachment → Document (17)</span>", '<div class="rowx">' + I("file", 16) + '<div class="grow"><b>IMG_4021.png</b><small>412 KB · added by Tom Brandt</small></div>' + more + '</div><div class="rowx">' + I("file", 16) + '<div class="grow"><b>safari-console.log</b><small>18 KB · added by Marco Silva</small></div>' + more + "</div>", 1)) +
      pane("c", 0, tbl(["Conversation", "Channel", "Status", "Messages", "Last message"], [[ink("C-8812 · Checkout fails…"), ch("EMAIL"), E("OPEN", "green"), 4, "10:21"], [ink("C-8790 · Checkout error iOS"), ch("LIVE_CHAT"), E("RESOLVED", "purple"), 2, "Yesterday"]])) +
      pane("w", 0, cd("<b>Linked tasks</b><span class='r'>" + btn("Create task", "plus", "sm") + btn("Link existing", "link", "sm") + "</span>", '<div class="rowx"><div class="grow"><b>WEB-148 · Add VAT number validation to checkout</b><small>' + E("CONVERTED", "blue") + ' · status sync on · last synced task status “In progress” · idempotency key set</small></div><span class="badge yellow">In progress</span></div><div class="rowx"><div class="grow"><b>MOB-95 · App crashes on iOS 17.2 when offline</b><small>' + E("LINKED") + ' · sync off</small></div><span class="badge">Todo</span></div>', 1) + spc + cd("<b>Project</b>", prop("Project", "Stripe Billing Migration " + muted("(05)")) + prop("Change request", "—") + prop("Release", "Billing migration 1.4.0 " + muted("(06)")) + prop("Affected customers", "Northwind, Acme Corp"))) +
      pane("r", 0, tbl(["Related ticket", "Relation", "Detected", "Confidence", ""], [[ink("TCK-2038 App crashes on iOS 17.2 when offline"), E("RELATED"), '<span class="badge purple">AI</span>', "0.87", more], [ink("TCK-2036 Outage: dashboards not loading"), E("SAME_INCIDENT", "red"), "Agent", "—", more], [ink("TCK-2033 VAT error on checkout (desktop)"), E("DUPLICATE_OF", "yellow"), '<span class="badge purple">AI</span>', "0.79", more]])) +
      pane("h", 0, cd("<b>Status history</b><span class='r muted'>TicketStatusHistory</span>", '<div class="tl"><div class="ev"><b>New → Open</b><small>Marco Silva · 10:05 · changed_via agent · was New 7 min</small></div><div class="ev"><b>Priority NORMAL → URGENT</b><small>AI auto-applied · 09:58 · confidence 0.93</small></div><div class="ev"><b>Ticket created from conversation</b><small>Source email · Ticket.source EMAIL · 09:58</small></div><div class="ev"><b>Escalation level 0 → 1</b><small>Marco Silva escalated to Anna Meyer · 10:30</small></div></div>')) +
      pane("t", 0, tbl(["Person", "Date", "Note", ">Hours"], [[wh("MS"), "Nov 11", "Reproduction on iOS 17.2", "0.5"], [wh("JK"), "Nov 11", "Safari build check", "1.0"]]) + '<div class="sub-note" style="margin-top:8px">TimeEntry.ticket_id (18). Total 1.5 h, billable 0 h. Read-only here.</div>') + "</div></div><div>" +
      cd("<b>Properties</b>", prop("Status", stb("Open", "OPEN")) + prop("Priority", pri("URGENT")) + prop("Type", E("BUG")) + prop("Category", "Bugs / Checkout") + prop("Assignee", wh("MS")) + prop("Team", "Support engineering") + prop("Inbox", "Support") + prop("Branch", "Athens") + prop("Requester", cwh("TB")) + prop("Source", ch("EMAIL")) + prop("Sentiment", sent("FRUSTRATED")) + prop("Language", "English") + prop("AI complexity", "Medium") + prop("Due", "Nov 12")) + spc +
      cd("<b>SLA</b><span class='r muted'>TicketSlaTimer</span>", '<div class="rowx"><div class="grow"><b>' + en("FIRST_RESPONSE") + "</b><small>Target 15 min · responded in 7 min</small></div>" + sla("MET", "Met") + '</div><div class="rowx"><div class="grow"><b>' + en("NEXT_RESPONSE") + "</b><small>Target 30 min · due 10:51</small></div>" + sla("RISK", "At risk 12m") + '</div><div class="rowx"><div class="grow"><b>' + en("RESOLUTION") + '</b><small>Target 4 h · due 14:00 · 82% elapsed</small></div>' + sla("RISK", "3h 40m") + '</div><div class="sub-note" style="padding:8px 16px">Policy “Priority clients”, business hours Mon–Fri 08:00–18:00. At-risk threshold 75%. Escalation rule “Notify lead at 90%”.</div>', 1) + spc +
      cd("<b>Followers</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", '<div class="rowx">' + av("MS") + av("JK") + av("AM") + "</div>", 1) + spc +
      cd("<b>AI</b><span class='r muted'>suggestions need approval</span>", '<div class="rowx"><div class="grow"><b>Create task in Stripe Billing Migration</b><small>' + E("TASK_CREATION") + " · confidence 0.82 · ai_auto_task_threshold 0.90</small></div>" + btn("Review", "sparkles", "sm") + '</div><div class="rowx"><div class="grow"><b>Part of incident “Checkout validation errors”</b><small>' + E("INCIDENT_GROUPING") + ' · 4 tickets</small></div>' + btn("View", "link", "sm") + "</div>", 1) + spc +
      cd("<b>Custom fields</b><span class='r muted'>custom_field_definitions · TICKET</span>", prop("Affected product", "Checkout") + prop("Browser / OS", "Safari / iOS 17.2") + prop("Environment", "Production")) + spc +
      cd("<b>Audit</b>", '<div class="tl"><div class="ev"><b>Assignee set to Marco Silva</b><small>AI assignment accepted by Anna Meyer · 10:00</small></div><div class="ev"><b>Ticket created</b><small>09:58</small></div></div>') + "</div></div>" +
      dm(["Ticket · all columns shown", "TicketStatusHistory · TicketSlaTimer · TicketRelation (type, detected_by_ai, confidence) · TicketTaskLink · TicketFollower · TicketAttachment · TicketConversation", "SupportIncident · title, status · SupportAiSuggestion · TASK_CREATION, INCIDENT_GROUPING", "Read-only: TimeEntry (18) · Project, ProjectChangeRequest (05) · Release (06) · Task (06)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE TICKET — full page (spec §2, §3, §4, §5)
     @screen New ticket
     @route  /support/tickets/new?conversation=<id>&requester=<contactId>&project=&from=<entityType>:<id>
     @perm   support.tickets.create · assign others support.tickets.assign · customer_visible and portal reply need support.tickets.update · attach documents needs documents.documents.read on them · create linked task support.tickets.convert_to_task
     @api    POST /support/tickets {subject, description, type, source, priority, category_id?, inbox_id, team_id?, assignee_membership_id?, status_id?, requester_contact_id? | requester_user_id? | requester_email+name, company_id?, project_id?, change_request_id?,
             release_id?, sla_policy_id?, conversation_id?, customer_visible, due_at?, follower_ids[], attachment_document_ids[], custom_fields{}, create_task?{project_id, type_id}}
     @mcp    support_tickets_create (also used by the AI agent: sensitive when it creates on behalf of a customer)
     @data   Ticket (every column written on create) · TicketCategory (defaults: default_team_id, default_inbox_id, default_priority, default_sla_policy_id, default_project_id) · SupportSettings (ticket_prefix, default_sla_policy_id, default_inbox_id)
             · SlaPolicy/SlaPolicyTarget (preview) · TicketFollower · TicketAttachment · TicketConversation · TicketSlaTimer (created on save) · custom_field_definitions · CrmContact/CrmCompany lookup
     @ui     Form with sections (react-hook-form + zod), Combobox for requester (searches CRM contacts, portal users), Select/Popover+Command everywhere, Textarea/Markdown editor, drop zone to 17, "Create more" switch, Ctrl+Enter
     @states validation errors inline · saving · saved (toast with TCK number and Undo) · permission error on a field (disabled with reason) · duplicate warning (AI DUPLICATE_TICKET, "3 similar open tickets") · draft restored
     @audit  TICKET_CREATED with source and creator; AI-created tickets carry created_by_user_id/membership null and source AI_AGENT
     @note   Choosing a CATEGORY applies its defaults (team, inbox, priority, SLA policy, project) but never overwrites what the agent already picked. The SLA preview shows the resulting targets for the chosen priority;
             due times are computed on save by the API (TicketSlaTimer rows). Status defaults to the TicketStatus with is_default. The reference TCK-2048 is assigned in one transaction (number_sequences).
             Requesting on behalf of a customer sets requester_*; an unknown person is stored as requester_email + requester_name and can be linked to a CRM contact later.
     ===================================================================================================================== */
  function ticketCreate() {
    return '<div class="a-page">' + head("New ticket", "The reference (TCK-2048) is assigned when you save.", btn("Cancel") + btn("Create ticket", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Requester</b>", f("Customer", sel("Search contacts, companies, portal users…", "search"), "Resolves to CrmContact (02) and/or a Customer Portal User (01 §79). An email not in the CRM is kept as requester_email.") + row2(f("Contact", sel("Lena Kovac · lena@acme.example", "users")), f("Company", sel("Acme Corp", "building"))) + f("Linked conversation", sel("C-8812 · Checkout fails… (optional)", "chat"), "Ticket.conversation_id; more conversations can be added later (TicketConversation).")) + spc +
      cd("<b>What is the problem</b>", f("Subject", box("Short, specific summary")) + f("Type", seg(["QUESTION", "BUG", "FEATURE_REQUEST", "CHANGE_REQUEST", "BILLING", "ACCOUNT", "INCIDENT", "OTHER"], "QUESTION"), "Bug and Feature request can later be converted to a Task (06); Change request can become a Project Change Request (05 §45).") + f("Description", editor("Markdown. Type “/” for blocks, “@” to mention. Paste screenshots.")) +
        callout("sparkles", "<b>AI check</b> 3 similar open tickets found (TCK-2038, TCK-2033, TCK-2047). Review before creating a duplicate.", "") ) + spc +
      cd("<b>Attachments</b>", '<div class="drop">' + I("clip", 16) + " Drop files or choose from Documents (17)</div>" + f("Custom fields", row2(sel("Affected product…"), sel("Environment…")), "custom_field_definitions for entity TICKET (02 §24–26).")) +
      "</div><div>" +
      cd("<b>Handling</b>", f("Source", seg(["MANUAL", "EMAIL", "LIVE_CHAT", "PHONE_NOTE"].slice(0, 3), "MANUAL"), "Manual by default. Source values: Conversation, Email, Live chat, Widget, Portal, Form, AI agent, Manual, API.") + f("Priority", seg(["LOW", "NORMAL", "HIGH", "URGENT"], "NORMAL")) + f("Category", sel("Choose category…", "tag"), "Applies defaults: team, inbox, priority, SLA, project.") + f("Status", sel("New (default)")) + f("Inbox", sel("Support", "inbox")) + f("Team", sel("Client success", "users")) + f("Assignee", sel("Auto by routing rule", "users"), "Leave empty to let the inbox routing strategy / automation assign it.") + f("Branch", sel("Athens"))) + spc +
      cd("<b>Links</b>", f("Project", sel("No project", "folder")) + f("Change request", sel("—", "flag")) + f("Release", sel("—")) + f("Due date", sel("Pick a date", "calendar"))) + spc +
      cd("<b>SLA preview</b><span class='r muted'>SlaPolicyTarget</span>", prop("Policy", "Standard (default) ") + prop("First response", "1 h · business hours") + prop("Next response", "4 h") + prop("Resolution", "2 business days") + '<div class="sub-note">Timers start on save. Policy conditions (Json) may pick another policy automatically.</div>') + spc +
      cd("<b>Visibility & people</b>", '<div class="rowx"><div class="grow"><b>Visible in customer portal</b><small>Ticket.customer_visible. The customer sees status and public replies.</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Notify requester by email</b><small>Confirmation via 11 Communication Center</small></div>' + sw(1) + "</div>" + f("Followers", sel("Add followers…", "bell"))) + spc +
      cd("<b>Create task too</b>", '<div class="rowx"><div class="grow"><b>Create a task in Tasks (06)</b><small>Idempotent, linked as CONVERTED</small></div>' + sw(0) + "</div>") + spc +
      '<div class="rowx"><div class="grow"><b>Create more</b><small>Keep requester, inbox and team</small></div>' + sw(0) + "</div></div></div>" +
      dm(["Ticket · every column written on create", "TicketCategory · defaults · SupportSettings · ticket_prefix, default_sla_policy_id, default_inbox_id · SlaPolicyTarget (preview)", "TicketFollower · TicketAttachment · TicketConversation · TicketSlaTimer", "Read-only lookups: CrmContact, CrmCompany (02) · Project, ProjectChangeRequest (05) · Release (06)"], []) + "</div>";
  }

  /* =====================================================================================================================
     KNOWLEDGE BASE — articles list (spec §6)
     @screen Help center · articles
     @route  /support/knowledge?status=&category=&visibility=&locale=&q=&view=
     @perm   VIEW support.knowledge.read · create support.knowledge.create · edit support.knowledge.update · publish support.knowledge.publish* · archive support.knowledge.archive · delete support.knowledge.delete* · export support.knowledge.export*
     @api    GET /support/knowledge/articles?status=&category_id=&visibility=&locale=&is_faq=&q=&cursor= · POST /support/knowledge/articles · POST /support/knowledge/articles/bulk {ids, action: publish|archive|move|visibility}
     @mcp    support_knowledge_read · support_knowledge_create · support_knowledge_update · support_knowledge_publish (sensitive)
     @data   KnowledgeArticle (title, slug, category_id, status, visibility, is_faq, locale, view_count, helpful_count, not_helpful_count, ai_generated, author_membership_id, reviewer_membership_id, published_at, last_reviewed_at, current_version, source_ticket_id)
             · KnowledgeCategory (tree, visibility) · SupportAiSuggestion (KNOWLEDGE_GAP, ARTICLE_DRAFT) · SavedView (entity_type KNOWLEDGE_ARTICLE)
     @ui     Tree (category filter) + Table, Tabs for status, Checkbox bulk bar, DropdownMenu row actions, Badge
     @states loading · empty ("Write your first article") · error · no-access · category empty
     @audit  ARTICLE_CREATED, ARTICLE_PUBLISHED, ARTICLE_ARCHIVED, ARTICLE_VISIBILITY_CHANGED (suggested)
     @note   Visibility: PUBLIC = help center and portal, CUSTOMERS = logged-in portal users only, INTERNAL = agents only (also used as AI source for agents). Only PUBLISHED articles are served and indexed (WikiAiIndexEntry, 15).
             The AI support agent answers customers only from PUBLISHED, non-INTERNAL articles. "Helpful" ratio = helpful_count / (helpful + not_helpful). Knowledge gaps are SupportAiSuggestion KNOWLEDGE_GAP rows built from recurring tickets.
     ===================================================================================================================== */
  const ART = [
    ["Change the billing contact on your account", "Billing", "PUBLISHED", "PUBLIC", 1, "en", 2810, 94, "AM", "Nov 8", 0],
    ["Where to find and download your invoices", "Billing", "PUBLISHED", "CUSTOMERS", 1, "en", 2204, 88, "AM", "Nov 2", 0],
    ["Reset your portal password", "Account", "PUBLISHED", "PUBLIC", 1, "en", 4120, 71, "SJ", "Oct 28", 0],
    ["Approve a design deliverable in the portal", "Portal", "PUBLISHED", "CUSTOMERS", 0, "en", 980, 90, "KL", "Oct 30", 0],
    ["VAT numbers at checkout: accepted formats", "Checkout", "IN_REVIEW", "PUBLIC", 0, "en", 0, 0, "MS", "Today", 1],
    ["Known issue: dashboards loading slowly (Nov 11)", "Incidents", "DRAFT", "PUBLIC", 0, "en", 0, 0, "MS", "Today", 1],
    ["Agent playbook: refunds and credit notes", "Internal", "PUBLISHED", "INTERNAL", 0, "en", 142, 100, "AM", "Oct 14", 0],
    ["Rechnungskontakt ändern", "Billing", "PUBLISHED", "PUBLIC", 1, "de", 612, 91, "AM", "Nov 8", 0],
    ["Legacy: how to use the old portal", "Portal", "ARCHIVED", "PUBLIC", 0, "en", 320, 55, "SJ", "Mar 3", 0],
  ];
  const AST = { PUBLISHED: "green", IN_REVIEW: "blue", DRAFT: "yellow", ARCHIVED: "" };
  function knowledge() {
    return '<div class="a-page">' + head("Help center", "Customer-facing articles, FAQs and the knowledge the AI agent answers from.", btn("Import from Docs", "book") + btn("AI draft", "sparkles") + btn("New article", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Published", 86, "of 112 articles") + stat("In review", 4, "need a reviewer") + stat("Views (30d)", "18.4k", "+9%") + stat("Helpful", "89%", "ratings") + stat("Knowledge gaps", 7, "from recurring tickets", 1) + stat("Self-served", "34%", "chats resolved by articles") + "</div>" +
      '<div class="g2" style="grid-template-columns:260px 1fr;align-items:start">' + cd("<b>Categories</b><span class='r'>" + btn("", "plus", "sm icon") + "</span>", ["All articles|112", "Billing|18", "&nbsp;&nbsp;Invoices|7", "Account|22", "Portal|16", "Checkout|9", "Incidents|3", "Internal|14", "Uncategorized|5"].map((c, i) => '<div class="tree-row' + (i === 0 ? " sel" : "") + '">' + I("folder", 14) + '<div class="grow">' + c.split("|")[0] + '</div><span class="muted">' + c.split("|")[1] + "</span></div>").join(""), 1) +
      "<div>" + callout("sparkles", "<b>Knowledge gap:</b> 14 tickets this month ask “How do I add a second billing contact?” and no published article matches. " + btn("Draft article with AI", "sparkles", "sm"), "") + spc +
      '<div class="pills" style="margin-bottom:6px">' + pill("All <b>112</b>", 1) + pill("Published <b>86</b>") + pill("In review <b>4</b>") + pill("Drafts <b>14</b>") + pill("Archived <b>8</b>") + pill("FAQ <b>21</b>") + "</div>" +
      '<div class="toolbar">' + search("Search title, body, keywords") + sel("Visibility: any", "lock") + sel("Language: all", "globe") + sel("Sort: Updated ↓", "sort") + sel("View: Help center", "star") + "</div>" +
      filterBar([["Status", "is any of", "Published, In review"], ["Visibility", "is", "Public"]], btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span style="flex:1"></span>' + sel("Move to category…", "folder") + sel("Visibility…", "lock") + btn("Publish", "send", "sm") + btn("Archive", "archive", "sm") + "</div>" +
      '<div class="panel" style="margin-top:0"><table>' + th(["", "Article", "Category", "Status", "Visibility", "FAQ", "Lang", ">Views", ">Helpful", "Author", "Updated"]) + "<tbody>" + ART.map((r, i) => "<tr><td>" + cb(i === 4 || i === 5) + "</td><td>" + ink(r[0]) + (r[10] ? ' <span class="badge purple" title="KnowledgeArticle.ai_generated">AI draft</span>' : "") + "</td><td>" + r[1] + "</td><td>" + E(r[2], AST[r[2]]) + "</td><td>" + E(r[3], r[3] === "INTERNAL" ? "yellow" : r[3] === "CUSTOMERS" ? "blue" : "") + "</td><td>" + (r[4] ? I("check", 14) : "") + "</td><td>" + r[5].toUpperCase() + "</td><td class='num'>" + r[6] + "</td><td class='num'>" + (r[6] ? r[7] + "%" : "—") + "</td><td>" + av(r[8]) + "</td><td class='muted'>" + r[9] + "</td></tr>").join("") + "</tbody></table></div></div></div>" +
      dm(["KnowledgeArticle · title, slug, category_id, status, visibility, is_faq, locale, view_count, helpful_count, not_helpful_count, ai_generated, author_membership_id, published_at, source_ticket_id", "KnowledgeCategory · name, parent_category_id, visibility · SupportAiSuggestion · KNOWLEDGE_GAP", "SavedView · entity_type KNOWLEDGE_ARTICLE"], ["Translation groups: articles in other languages are separate rows with the same title concept, no translation_group_id (gaps-13.md)"]) + "</div>";
  }

  /* =====================================================================================================================
     ARTICLE EDITOR (spec §6)
     @screen Article editor · create and edit
     @route  /support/knowledge/new?category= · /support/knowledge/:articleId/edit
     @perm   create support.knowledge.create · edit support.knowledge.update · publish / unpublish support.knowledge.publish* (a DRAFT can be saved and sent IN_REVIEW without it) · delete support.knowledge.delete*
     @api    POST|PATCH /support/knowledge/articles(/:id) · POST /support/knowledge/articles/:id/submit-review · POST .../publish · POST .../archive · GET .../versions · POST .../restore {version} · POST /support/ai/article-draft {ticket_ids|conversation_id}
     @mcp    support_knowledge_create · support_knowledge_update · support_knowledge_publish (sensitive)
     @data   KnowledgeArticle (all columns) · KnowledgeArticleVersion (version, title, summary, body, change_note, author, ai_generated: immutable, one row per save of a published article) · KnowledgeArticleFeedback (is_helpful, comment)
             · attachment_document_ids (Documents, 17) · related_article_ids · release_id (06 release notes) · source_ticket_id · SupportAiSuggestion ARTICLE_DRAFT
     @ui     Rich-text editor (TipTap: headings, lists, code, tables, images/video, callouts, slash menu), Select/Popover+Command for category, release and related articles, Switch, Tabs (Edit/Preview/Versions), Dialog for restore
     @states loading · saving · saved · validation (slug unique per locale) · conflict (someone else edited, show diff) · permission error on Publish · draft restored
     @audit  ARTICLE_UPDATED, ARTICLE_SUBMITTED_FOR_REVIEW, ARTICLE_PUBLISHED, ARTICLE_VERSION_RESTORED
     @note   Publishing sets status PUBLISHED, published_at and bumps current_version; each save of a published article writes an immutable version. AI drafts are marked ai_generated and cannot be published without a human
             reviewer (reviewer_membership_id). Public/CUSTOMERS articles must not contain internal-only attachments. Articles can come from a Wiki page (15, WikiPage.help_center_article_id): the page stays the source.
             @gap SEO and per-locale translations are Json/free fields only: seo Json (title, description, og_image). No translation group (gaps-13.md).
     ===================================================================================================================== */
  function article() {
    return '<div class="a-page">' + head("Edit article", "Change the billing contact on your account · version 4 · last saved 2 min ago", btn("Preview", "globe") + btn("Save draft") + btn("Submit for review", "check") + btn("Publish", "send", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Content</b>", f("Title", box("<span class='ink'>Change the billing contact on your account</span>")) + f("Slug", box("/help/billing/change-billing-contact"), "Unique per language.") + f("Summary", box("Update who receives invoices and payment reminders in three steps."), "Shown in search results and as the AI answer snippet.") +
        f("Body", '<div class="editor"><div class="ed-bar">' + ["B", "I", "H2", "•", "1.", "</>", "Link", "Image", "Video", "Callout", "Table", "/"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body" style="color:var(--body)"><b style="color:var(--ink)">Before you start</b><br>You need the Billing admin role in the customer portal.<br><br><b style="color:var(--ink)">Steps</b><br>1. Open <b>Billing → Contacts</b>.<br>2. Choose <b>Add billing contact</b> and enter the name and email.<br>3. Select <b>Set as primary</b>. Future invoices go to the new contact.<br><br><span class="muted">▎ Open invoices keep their original recipient until re-sent.</span></div></div>')) + spc +
      cd("<b>Attachments & media</b>", '<div class="drop">' + I("clip", 16) + " Drop images, videos or files (stored as Documents, 17)</div><div class='rowx' style='padding:0'>" + tok("billing-contacts.png") + tok("tutorial.mp4") + "</div>") + spc +
      cd("<b>Versions</b><span class='r muted'>KnowledgeArticleVersion · immutable</span>", [["v4", "Anna Meyer", "Today 11:02", "Added note about open invoices", 0, 1], ["v3", "AI draft, edited by Anna Meyer", "Nov 8", "Initial AI draft improved", 1, 0], ["v2", "Sofia Jensen", "Oct 15", "Screenshots updated", 0, 0], ["v1", "Anna Meyer", "Sep 2", "Created", 0, 0]].map((v) => '<div class="rowx"><div class="grow"><b>' + v[0] + (v[5] ? " " + E("PUBLISHED", "green") : "") + (v[4] ? ' <span class="badge purple">AI</span>' : "") + "</b><small>" + v[1] + " · " + v[2] + " · " + v[3] + "</small></div>" + btn("Compare", "", "sm") + btn("Restore", "", "sm") + "</div>").join(""), 1) +
      "</div><div>" +
      cd("<b>Publishing</b>", prop("Status", E("PUBLISHED", "green")) + prop("Visibility", sel("Public", "lock")) + prop("Language", sel("English (en)", "globe")) + prop("Category", sel("Billing / Invoices", "folder")) + prop("Author", wh("AM")) + prop("Reviewer", wh("SJ")) + prop("Published", "Sep 2 · v4 live") + prop("Last reviewed", "Nov 8") + '<div class="rowx" style="padding:8px 0"><div class="grow"><b>Show in FAQ</b><small>is_faq</small></div>' + sw(1) + "</div>") + spc +
      cd("<b>Search & related</b>", f("Keywords", box("billing, invoice, contact, email"), "KnowledgeArticle.keywords (also feeds semantic search).") + f("Related articles", sel("Where to find and download invoices ×  Pay an invoice ×", "book")) + f("Release", sel("— none —", "flag"), "Link a release (06) to publish release notes here.") + f("SEO", box("Title · description · og image (seo Json)"))) + spc +
      cd("<b>Performance</b><span class='r muted'>feedback</span>", prop("Views (30d)", "2,810") + prop("Helpful", "94% · 214 ratings") + '<div class="rowx" style="padding:8px 0 0;gap:8px"><div class="grow"><small>“Needs screenshot for mobile” · portal user · Nov 6</small></div></div><div class="sub-note">KnowledgeArticleFeedback: is_helpful, comment, user / contact / visitor_key.</div>') + spc +
      cd("<b>AI</b>", '<div class="rowx"><div class="grow"><b>Draft from tickets</b><small>Uses TCK-2046 and 13 similar tickets</small></div>' + btn("Draft", "sparkles", "sm") + '</div><div class="rowx"><div class="grow"><b>Improve writing</b><small>Clearer, shorter</small></div>' + btn("Suggest", "sparkles", "sm") + "</div>", 1) + spc +
      cd("<b>Source</b>", prop("Source ticket", "TCK-2046") + prop("Wiki page", "— " + muted("(15)")) + prop("AI generated", "No")) + "</div></div>" +
      dm(["KnowledgeArticle · title, slug, summary, body, status, visibility, is_faq, locale, keywords, related_article_ids, attachment_document_ids, release_id, ai_generated, source_ticket_id, author_membership_id, reviewer_membership_id, current_version, published_at, last_reviewed_at, seo", "KnowledgeArticleVersion · version, title, summary, body, change_note, author_membership_id, ai_generated", "KnowledgeArticleFeedback · is_helpful, comment · SupportAiSuggestion · ARTICLE_DRAFT"], []) + "</div>";
  }

  /* =====================================================================================================================
     HELP CENTER CATEGORIES (spec §6)
     @screen Knowledge categories
     @route  /support/knowledge/categories
     @perm   VIEW support.knowledge.read · create/edit/reorder support.knowledge.update · archive support.knowledge.archive · delete support.knowledge.delete*
     @api    GET /support/knowledge/categories · POST|PATCH|DELETE /support/knowledge/categories(/:id) · POST .../reorder {ids}
     @mcp    support_knowledge_read · support_knowledge_update
     @data   KnowledgeCategory (parent_category_id, name, slug, description, icon, visibility, sort_order, archived_at) · KnowledgeArticle (count)
     @ui     Sortable Tree (dnd-kit), Sheet or side card for edit, Select for visibility and icon
     @states loading · empty · error · no-access · archive blocked ("12 articles, move them first")
     @note   A category's visibility caps its articles: an article can never be more public than its category. Archiving keeps articles but hides the category from the help center. Order is sort_order.
     ===================================================================================================================== */
  function kbCategories() {
    const rows = [["Getting started", 0, "PUBLIC", 12, "zap"], ["Billing", 0, "PUBLIC", 18, "dollar"], ["Invoices", 1, "PUBLIC", 7, "receipt"], ["Payments & refunds", 1, "CUSTOMERS", 5, "dollar"], ["Account", 0, "PUBLIC", 22, "users"], ["Portal", 0, "CUSTOMERS", 16, "globe"], ["Incidents & status", 0, "PUBLIC", 3, "flag"], ["Agent playbooks", 0, "INTERNAL", 14, "lock"]];
    return '<div class="a-page">' + head("Help center categories", "Structure of the public help center and the portal knowledge section.", btn("Reorder", "sort") + btn("New category", "plus", "primary")) +
      '<div class="mx-split">' + cd("<b>Categories</b><span class='r muted'>KnowledgeCategory · drag to reorder</span>", rows.map((r, i) => '<div class="tree-row l' + r[1] + (i === 2 ? " sel" : "") + '">' + I(r[4], 15) + '<div class="grow"><b>' + r[0] + "</b><small class='muted'>" + r[3] + " articles</small></div>" + E(r[2], r[2] === "INTERNAL" ? "yellow" : r[2] === "CUSTOMERS" ? "blue" : "") + more + "</div>").join(""), 1) +
      "<div>" + cd("<b>Edit: Invoices</b>", f("Name", box("Invoices")) + f("Slug", box("invoices")) + f("Parent", sel("Billing", "folder")) + f("Description", box("Find, download and pay your invoices.")) + f("Icon", sel("Receipt", "receipt")) + f("Visibility", seg(["PUBLIC", "CUSTOMERS", "INTERNAL"], "PUBLIC"), "Articles inside cannot be more public than the category.") + '<div style="display:flex;gap:8px;justify-content:flex-end">' + btn("Archive", "archive") + btn("Save", "check", "primary") + "</div>") + spc +
      callout("sparkles", "<b>Suggested:</b> create “Contacts & permissions” under Account. 9 recent tickets mention adding users.", "") + "</div></div>" +
      dm(["KnowledgeCategory · parent_category_id, name, slug, description, icon, visibility, sort_order, archived_at", "KnowledgeArticle · category_id (count)"], []) + "</div>";
  }

  /* =====================================================================================================================
     SLA POLICIES — list (spec §2, §7)
     @screen SLA policies
     @route  /support/sla
     @perm   VIEW support.tickets.read (see policies) · create/edit/archive support.sla_policies.manage
     @api    GET /support/sla-policies · POST /support/sla-policies · PATCH /support/sla-policies/:id · POST .../archive · POST .../reorder
     @mcp    support_sla_policies_manage
     @data   SlaPolicy (name, is_default, use_business_hours, calendar_id, conditions, at_risk_threshold_percent, escalation_rule_ids, sort_order, archived_at) · SlaPolicyTarget (priority, first_response_minutes, next_response_minutes,
             resolution_minutes) · Ticket (count per policy, sla_breached)
     @ui     Table with inline target summary, DropdownMenu, Badge
     @states loading · empty ("Create your first SLA policy") · error · no-access
     @audit  SLA_POLICY_CREATED, SLA_POLICY_UPDATED, SLA_POLICY_ARCHIVED
     @note   Policy choice at ticket creation: first policy whose conditions match, evaluated by sort_order, else the default (SupportSettings.default_sla_policy_id / inbox / category defaults win first). Editing targets applies to NEW tickets;
             existing timers keep their due_at unless "Recalculate open tickets" is chosen (audited).
     ===================================================================================================================== */
  const POL = [
    ["Standard", 1, "Mon–Fri 08:00–18:00", "All tickets", [["URGENT", 15, 30, 240], ["HIGH", 60, 120, 480], ["NORMAL", 240, 480, 2880], ["LOW", 480, 960, 5760]], 31, "97%"],
    ["Priority clients", 0, "Mon–Sun 07:00–22:00", "Company tag is “Priority”", [["URGENT", 5, 15, 120], ["HIGH", 15, 30, 240], ["NORMAL", 60, 120, 960], ["LOW", 240, 480, 2880]], 12, "93%"],
    ["Billing questions", 0, "Mon–Fri 08:00–18:00", "Category is Billing", [["URGENT", 30, 60, 480], ["HIGH", 120, 240, 960], ["NORMAL", 240, 480, 1440], ["LOW", 480, 960, 2880]], 9, "99%"],
    ["24/7 incidents", 0, "Always (24/7)", "Type is Incident", [["URGENT", 5, 10, 60], ["HIGH", 10, 20, 120], ["NORMAL", 30, 60, 240], ["LOW", 60, 120, 480]], 2, "88%"],
  ];
  const mm = (m) => (m === null ? "—" : m >= 1440 && m % 1440 === 0 ? m / 1440 + " d" : m >= 60 && m % 60 === 0 ? m / 60 + " h" : m + " min");
  function sla_list() {
    return '<div class="a-page">' + head("SLA policies", "First response, next response and resolution targets per priority.", btn("New SLA policy", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Policies", 4, "1 default") + stat("SLA compliance", "96%", "last 30 days") + stat("Breached", 7, "30 days", 1) + stat("At risk now", 3, "running timers", 1) + stat("Paused", 9, "waiting on customer") + "</div>" +
      POL.map((p, i) => cd('<b>' + p[0] + "</b>" + (p[1] ? " " + E("DEFAULT", "blue") : "") + "<span class='r'>" + muted(p[5] + " open tickets · compliance " + p[6]) + btn("Edit", "edit", "sm") + more + "</span>", '<div class="mx-split" style="gap:20px"><div>' + prop("Hours", p[2]) + prop("Applies when", p[3]) + prop("At risk at", "75% of target") + prop("Escalation", i === 1 ? "Notify team lead at 90%, reassign on breach" : "Notify team lead at 90%") + '</div><table style="width:100%"><thead><tr><th>Priority</th><th class="num">First reply</th><th class="num">Next reply</th><th class="num">Resolution</th></tr></thead><tbody>' + p[4].map((t) => "<tr><td>" + pri(t[0]) + '</td><td class="num">' + mm(t[1]) + '</td><td class="num">' + mm(t[2]) + '</td><td class="num">' + mm(t[3]) + "</td></tr>").join("") + "</tbody></table></div>") + (i < POL.length - 1 ? spc : "")).join("") +
      dm(["SlaPolicy · name, is_default, use_business_hours, calendar_id, conditions, at_risk_threshold_percent, escalation_rule_ids, sort_order", "SlaPolicyTarget · priority, first_response_minutes, next_response_minutes, resolution_minutes", "Ticket · sla_policy_id, sla_breached, sla_at_risk (aggregates)"], []) + "</div>";
  }

  /* =====================================================================================================================
     SLA POLICY — create / edit (spec §2, §7)
     @screen SLA policy editor
     @route  /support/sla/new · /support/sla/:policyId
     @perm   support.sla_policies.manage
     @api    POST|PATCH /support/sla-policies(/:id) {name, description, is_default, use_business_hours, calendar_id, conditions, at_risk_threshold_percent, escalation_rule_ids[], targets[{priority, first_response_minutes, next_response_minutes, resolution_minutes}]}
             · POST /support/sla-policies/:id/recalculate {scope}
     @mcp    support_sla_policies_manage
     @data   SlaPolicy (all columns) · SlaPolicyTarget (one row per TicketPriority, minutes or null = not tracked) · AutomationRule (20, escalation_rule_ids, module SUPPORT) · Calendar / business hours (19 or 10, calendar_id)
     @ui     Form with sections, NumberInput + unit Select (min/h/d), condition builder (same JSON tree as SavedView filters), Popover+Command for escalation rules, Switch, preview Card
     @states validation (resolution >= first response) · saving · saved · error · no-access
     @audit  SLA_POLICY_CREATED, SLA_POLICY_UPDATED (diff of targets), SLA_POLICIES_RECALCULATED
     @note   Targets are stored in minutes; with use_business_hours the due time is counted only inside the calendar (calendar_id), otherwise wall-clock. A status with pauses_sla (TicketStatus) pauses timers and
             adds the pause to paused_seconds_total. Only one default policy. Escalation rules are Automation (20) rules on triggers like support.sla.at_risk, support.sla.breached: this screen only references them.
     ===================================================================================================================== */
  function slaEdit() {
    const t = (p, a, b, c) => '<div class="mx-grid"><div>' + pri(p) + "</div>" + [a, b, c].map((v) => '<div class="input-fake">' + v + "</div>").join("") + "</div>";
    return '<div class="a-page">' + head("Edit SLA policy", "Priority clients", btn("Cancel") + btn("Duplicate", "layers") + btn("Save policy", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Basics</b>", f("Name", box("Priority clients")) + f("Description", box("Faster targets for companies tagged Priority")) + '<div class="rowx" style="padding:0 0 10px"><div class="grow"><b>Default policy</b><small>Used when no condition or category default matches</small></div>' + sw(0) + "</div>") + spc +
      cd("<b>Targets per priority</b><span class='r muted'>SlaPolicyTarget · minutes</span>", '<div class="mx-grid" style="margin-bottom:6px"><div class="h">Priority</div><div class="h">First response</div><div class="h">Next response</div><div class="h">Resolution</div></div>' + [["URGENT", "5 min", "15 min", "2 h"], ["HIGH", "15 min", "30 min", "4 h"], ["NORMAL", "1 h", "2 h", "16 h"], ["LOW", "4 h", "8 h", "2 d"]].map((r) => t(r[0], r[1], r[2], r[3])).join('<div style="height:8px"></div>') + '<div class="sub-note" style="margin-top:8px">Leave a cell empty to not track that metric (null). Next response restarts after each customer reply.</div>') + spc +
      cd("<b>Applies when</b><span class='r muted'>conditions Json</span>", '<div class="cond"><span class="kw">When</span>' + chip("Company tag", "is", "Priority") + '</div><div class="cond"><span class="kw">or</span>' + chip("Contract", "has", "Active support retainer") + '</div><button class="btn sm">' + I("plus", 13) + " Add condition</button><div class='sub-note' style='margin-top:8px'>Same condition tree as saved views. First matching policy by order wins.</div>") + spc +
      cd("<b>Escalation</b><span class='r muted'>Automation (20)</span>", '<div class="rowx"><div class="grow"><b>Notify team lead at 90% elapsed</b><small>Trigger support.sla.at_risk · AutomationRule</small></div>' + E("PUBLISHED", "green") + '</div><div class="rowx"><div class="grow"><b>Reassign and notify manager on breach</b><small>Trigger support.sla.breached</small></div>' + E("PUBLISHED", "green") + "</div>" + '<div style="padding:8px 16px">' + btn("Attach rule", "plus", "sm") + "</div>", 1) +
      "</div><div>" +
      cd("<b>Time counting</b>", '<div class="rowx"><div class="grow"><b>Use business hours</b><small>Count only inside the calendar</small></div>' + sw(1) + "</div>" + f("Business-hours calendar", sel("Support hours · Mon–Sun 07:00–22:00 (Athens)", "calendar")) + f("At risk when elapsed reaches", '<div class="input-fake">75 %</div>', "SlaPolicy.at_risk_threshold_percent. Sets Ticket.sla_at_risk and sends the SLA warning notification.")) + spc +
      cd("<b>Preview</b>", '<div class="sub-note" style="margin-bottom:6px">A HIGH ticket created Tue 17:50</div>' + prop("First response due", "Tue 18:05") + prop("Resolution due", "Wed 07:50 + 4 h = 11:50") + prop("At risk at", "Wed 10:50") + '<div class="sub-note">Paused while the status is Waiting on customer or On hold.</div>') + spc +
      cd("<b>After saving</b>", '<div class="rowx"><div class="grow"><b>Recalculate open tickets</b><small>12 open tickets use this policy. Rewrites due times.</small></div>' + sw(0) + "</div>") + "</div></div>" +
      dm(["SlaPolicy · name, description, is_default, use_business_hours, calendar_id, conditions, at_risk_threshold_percent, escalation_rule_ids", "SlaPolicyTarget · priority, first_response_minutes, next_response_minutes, resolution_minutes", "AutomationRule (20) · calendar (19/10) · TicketStatus.pauses_sla"], []) + "</div>";
  }

  /* =====================================================================================================================
     TICKET SETUP — categories, statuses, custom fields (spec §2, §3, §13)
     @screen Ticket setup
     @route  /support/setup?tab=categories|statuses|fields
     @perm   categories and statuses support.settings.manage · custom fields support.settings.manage (definitions are platform rows, 02) · VIEW support.tickets.read
     @api    /support/ticket-categories · /support/ticket-statuses CRUD (+ reorder) · /custom-fields?entity_type=TICKET
     @mcp    support_settings_manage
     @data   TicketCategory (parent_category_id, name, slug, description, color, icon, default_team_id, default_inbox_id, default_priority, default_sla_policy_id, default_project_id, ai_hints, sort_order, archived_at)
             · TicketStatus (name, slug, category, color, sort_order, is_default, allowed_transitions, pauses_sla, customer_label, archived_at) · custom_field_definitions (entity TICKET)
     @ui     Tabs, Table, Sheet for edit, Combobox for team/inbox/project/SLA, TagInput for AI hints, drag handle for order
     @states loading · empty · error · no-access · delete blocked ("status used by 31 tickets, pick a replacement")
     @audit  TICKET_CATEGORY_CHANGED, TICKET_STATUS_CHANGED (config), CUSTOM_FIELD_CHANGED
     @note   Statuses are organization-wide (no per-team workflow here). Each maps to a TicketStatusCategory; customer_label is what the portal shows (e.g. “We are working on it”). Archived statuses stay on history. ai_hints are
             keywords/phrases that help AI categorization. Category defaults prefill the create form and drive routing.
     ===================================================================================================================== */
  function setup() {
    return '<div class="a-page">' + head("Ticket setup", "Categories, statuses and custom fields.", btn("New category", "plus", "primary")) +
      '<div class="tabset">' + tabs([["c", "Categories"], ["s", "Statuses"], ["f", "Custom fields"]], "c") +
      pane("c", 1, tbl(["Category", "Default team", "Default inbox", "Priority", "SLA policy", "Project", "AI hints", ">Tickets", ""], [
        [ink("Billing"), "Billing", "Support", pri("NORMAL"), "Billing questions", "—", "invoice, VAT, payment", 128, more], [ink("&nbsp;&nbsp;Invoices"), "Billing", "Support", pri("NORMAL"), "Billing questions", "—", "INV-, credit note", 54, more],
        [ink("Bugs"), "Support engineering", "Support", pri("HIGH"), "Standard", "Stripe Billing Migration", "error, crash, broken", 96, more], [ink("&nbsp;&nbsp;Checkout"), "Support engineering", "Support", pri("HIGH"), "Priority clients", "Stripe Billing Migration", "checkout, VAT, pay", 31, more],
        [ink("Account"), "Client success", "Support", pri("NORMAL"), "Standard", "—", "login, password, access", 77, more], [ink("Change requests"), "Client success", "Projects inbox", pri("NORMAL"), "Standard", "Customer Portal Build", "scope, change, add", 22, more], [ink("Incidents"), "Support engineering", "Support", pri("URGENT"), "24/7 incidents", "—", "outage, down, not loading", 6, more]]) +
        '<div class="sub-note" style="margin-top:8px">Editing a category opens a side sheet with every TicketCategory field (name, slug, parent, colour, icon, defaults, AI hints).</div>') +
      pane("s", 0, tbl(["Status", "Category", "Customer sees", "Moves to", "Pauses SLA", "Default", ""], [["New", E("NEW", "blue"), "Received", "Open, Closed", "", "Yes", more], ["Open", E("OPEN", "green"), "We are working on it", "Waiting on customer, On hold, Resolved", "", "", more], ["Waiting on customer", E("PENDING_CUSTOMER", "yellow"), "Waiting for your reply", "Open, Resolved", sw(1), "", more], ["On hold", E("ON_HOLD"), "Scheduled", "Open, Resolved", sw(1), "", more], ["Resolved", E("RESOLVED", "purple"), "Resolved", "Open (reopen), Closed", "", "", more], ["Closed", E("CLOSED"), "Closed", "—", "", "", more]]) + '<div class="sub-note" style="margin-top:8px">TicketStatus.allowed_transitions are slugs of statuses reachable from here. Closed is final; a reply after the reopen window opens a new ticket.</div>') +
      pane("f", 0, tbl(["Field", "Type", "Required", "Used in", ""], [["Affected product", "Select", "Bugs only", "Ticket form, filters, columns", more], ["Browser / OS", "Text", "", "Ticket form", more], ["Environment", "Select", "", "Ticket form, filters", more], ["Contract reference", "Link (02)", "", "Ticket form", more]]) + '<div class="sub-note" style="margin-top:8px">Rows of custom_field_definitions with entity TICKET (platform table from 02). Not owned by Support.</div>') + "</div>" +
      dm(["TicketCategory · parent_category_id, name, slug, color, icon, default_team_id, default_inbox_id, default_priority, default_sla_policy_id, default_project_id, ai_hints, sort_order", "TicketStatus · name, slug, category, color, sort_order, is_default, allowed_transitions, pauses_sla, customer_label", "custom_field_definitions · entity TICKET (02)"], []) + "</div>";
  }

  /* =====================================================================================================================
     MACROS / CANNED RESPONSES (spec §1)
     @screen Macros and saved replies
     @route  /support/macros?scope=&category=&q= · /support/macros/new · /support/macros/:id
     @perm   VIEW + use support.conversations.reply · manage ORGANIZATION and TEAM macros support.canned_responses.manage · PERSONAL macros need only support.conversations.reply
     @api    GET /support/canned-responses?scope=&category=&q= · POST|PATCH|DELETE /support/canned-responses(/:id) · POST /support/conversations/:id/apply-macro {canned_response_id}
     @mcp    support_canned_responses_manage
     @data   SupportCannedResponse (scope, team_id, owner_membership_id, name, shortcut, category, body, actions Json, usage_count, last_used_at, archived_at)
     @ui     Table + side editor (Sheet or split), Textarea with variable picker (Popover+Command), Select for scope/team, field-action builder (rows of Select)
     @states loading · empty ("No macros yet") · error · no-access · shortcut conflict
     @audit  CANNED_RESPONSE_CREATED, UPDATED, ARCHIVED (suggested)
     @note   A macro is a reply template PLUS optional actions (SupportCannedResponse.actions Json): set status, set priority, assign, add tag, set category, snooze, close. Variables are rendered on the server (customer first name,
             agent name, ticket reference, company). Scope: PERSONAL (owner only), TEAM (team_id), ORGANIZATION. Using a macro increments usage_count and sets canned_response_id on the message. Shortcut is unique per scope.
     ===================================================================================================================== */
  function macros() {
    const rows = [["Ask for new billing contact", "/billing-contact", "ORGANIZATION", "Billing", 142, "Today"], ["Thanks and close", "/thanks-resolved", "ORGANIZATION", "General", 389, "Today"], ["Ask for steps to reproduce", "/need-info", "TEAM", "Bugs", 97, "Yesterday"], ["We are investigating (incident)", "/incident-ack", "TEAM", "Incidents", 31, "Today"], ["Personal sign-off", "/my-signoff", "PERSONAL", "General", 61, "Mon"], ["Refund policy", "/refund", "ORGANIZATION", "Billing", 44, "Nov 3"]];
    return '<div class="a-page">' + head("Macros", "Saved replies with optional actions.", btn("Import", "file") + btn("New macro", "plus", "primary")) +
      '<div class="mx-split"><div><div class="toolbar">' + search("Search macros") + sel("Scope: all", "lock") + sel("Category: all", "tag") + "</div>" +
      tbl(["Macro", "Shortcut", "Scope", "Category", ">Used", "Last used", ""], rows.map((r, i) => [(i === 0 ? "<b>" : "") + ink(r[0]) + (i === 0 ? "</b>" : ""), "<code>" + r[1] + "</code>", E(r[2]), r[3], r[4], r[5], more])) + "</div>" +
      "<div>" + cd("<b>Edit: Ask for new billing contact</b>", f("Name", box("Ask for new billing contact")) + row2(f("Shortcut", box("/billing-contact")), f("Category", sel("Billing"))) + f("Scope", seg(["PERSONAL", "TEAM", "ORGANIZATION"], "ORGANIZATION")) + f("Team", sel("Client success", "users"), "Only for scope Team.") +
        f("Reply body", editor("Hi {{customer.first_name}},<br>Of course! I can update the billing contact for {{company.name}}. Could you share the new name and email? I will apply it to {{ticket.reference}} and all future invoices.<br>{{agent.signature}}") ) +
        f("Actions when applied", '<div class="rowx" style="padding:4px 0;gap:8px">' + sel("Set status", "check") + sel("Waiting on customer") + more + '</div><div class="rowx" style="padding:4px 0;gap:8px">' + sel("Add tag", "tag") + sel("billing") + more + "</div>" + btn("Add action", "plus", "sm"), "SupportCannedResponse.actions (Json). Run in order, each checked against the caller's permissions.") +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' + btn("Archive", "archive") + btn("Save", "check", "primary") + "</div>") + "</div></div>" +
      dm(["SupportCannedResponse · scope, team_id, owner_membership_id, name, shortcut, category, body, actions, usage_count, last_used_at, archived_at", "SupportMessage · canned_response_id"], ["Template variables list ({{customer.first_name}} …): no registry, defined in code (note)"]) + "</div>";
  }

  /* =====================================================================================================================
     INBOXES & CHANNELS (spec §1, §5)
     @screen Inboxes and channels
     @route  /support/channels?tab=inboxes|channels
     @perm   VIEW support.inboxes.manage (list is admin only) · create/edit/archive support.inboxes.manage · connect an email address also needs communications.senders.manage (11)
     @api    GET|POST|PATCH /support/inboxes(/:id) · GET|POST|PATCH /support/channels(/:id) · POST /support/channels/:id/verify · POST /support/channels/:id/rotate-widget-key
     @mcp    support_inboxes_manage
     @data   SupportInbox (team_id, branch_id, name, slug, color, is_default, default_assignee_membership_id, default_sla_policy_id, routing_strategy, signature, auto_reply_body, archived_at) · SupportChannel (inbox_id, type, name,
             email_address, sender_identity_id, widget_key, allowed_origins, config, ai_agent_enabled, is_active, verified_at) · CommSenderIdentity (11, read-only)
     @ui     Tabs, Table, DropdownMenu, Badge, Switch
     @states loading · empty · error · no-access · channel not verified (DNS/forwarding pending) · inactive
     @audit  INBOX_CREATED, INBOX_UPDATED, CHANNEL_CONNECTED, CHANNEL_VERIFIED, CHANNEL_DISABLED
     @note   Conversations and tickets always land in ONE inbox; channels feed an inbox. Inbound email goes through a verified sender identity from 11 (the same domain records). Portal and form channels are surfaces owned by 07. The
             default inbox is SupportSettings.default_inbox_id. routing_strategy is the default assignment mode of the inbox; rules from Automation can override it.
             @gap routing_strategy is a free String (no enum) and there is no agent availability or concurrent-chat capacity to round-robin on (gaps-13.md).
     ===================================================================================================================== */
  function channels() {
    return '<div class="a-page">' + head("Inboxes & channels", "Where customers reach you and who handles it.", btn("New inbox", "plus") + btn("Connect channel", "plug", "primary")) +
      '<div class="tabset">' + tabs([["i", "Inboxes", 3], ["c", "Channels", 6]], "c") +
      pane("i", 0, tbl(["Inbox", "Team", "Branch", "Routing", "Default assignee", "Default SLA", "Auto-reply", "Open", ""], [[ink("Support") + " " + E("DEFAULT", "blue"), "Client success", "All", "Round robin " + gap("free text"), "—", "Standard", sw(1), 38, more], [ink("Billing"), "Billing", "Athens", "Load balanced " + gap("free text"), wh("AM"), "Billing questions", sw(1), 9, more], [ink("Projects inbox"), "Delivery", "All", "Manual", "—", "Standard", sw(0), 4, more]])) +
      pane("c", 1, tbl(["Channel", "Type", "Inbox", "Identity", "AI agent", "Status", "Conversations (30d)", ""], [[ink("support@logiqdev.example"), ch("EMAIL"), "Support", "Verified " + muted("sender identity (11)"), sw(1), E("ACTIVE", "green"), 612, more], [ink("billing@logiqdev.example"), ch("EMAIL"), "Billing", "Verified", sw(0), E("ACTIVE", "green"), 148, more], [ink("Website chat widget"), ch("WIDGET"), "Support", "key wk_live_8f2…", sw(1), E("ACTIVE", "green"), 421, more], [ink("In-app live chat"), ch("LIVE_CHAT"), "Support", "Portal origin", sw(1), E("ACTIVE", "green"), 233, more], [ink("Portal request form"), ch("PORTAL"), "Support", "Customer portal (07)", sw(0), E("ACTIVE", "green"), 190, more], [ink("Bug report web form"), ch("FORM"), "Support", "Form key", sw(0), E("INACTIVE"), 0, more], [ink("Webhook ingest API"), ch("API"), "Support", "Service account", sw(0), E("ACTIVE", "green"), 15, more]]) + '<div class="sub-note" style="margin-top:8px">Status = SupportChannel.is_active and verified_at. Phone is a channel type (PHONE) for logging calls; no telephony in v1.</div>') + "</div>" +
      dm(["SupportInbox · team_id, branch_id, name, slug, is_default, default_assignee_membership_id, default_sla_policy_id, routing_strategy, signature, auto_reply_body", "SupportChannel · type, inbox_id, email_address, sender_identity_id, widget_key, allowed_origins, config, ai_agent_enabled, is_active, verified_at", "CommSenderIdentity (11) read-only"], ["routing_strategy has no enum; agent availability / capacity: not in schema"]) + "</div>";
  }

  /* =====================================================================================================================
     CONNECT CHANNEL — create page (spec §1, §5)
     @screen New channel
     @route  /support/channels/new?type=EMAIL|WIDGET|LIVE_CHAT|PORTAL|FORM|API|PHONE · /support/channels/:id
     @perm   support.inboxes.manage (+ communications.senders.manage for EMAIL, + portal settings permission for PORTAL)
     @api    POST /support/channels {inbox_id, type, name, email_address?, sender_identity_id?, allowed_origins[], config{}, ai_agent_enabled, is_active} · POST /support/channels/:id/verify
     @mcp    support_inboxes_manage
     @data   SupportChannel (all columns) · SupportInbox · CommSenderIdentity (11) · CustomerPortalSettings.widget_settings (07, for WIDGET/PORTAL)
     @ui     Stepper (type, details, routing, verify), RadioGroup cards for the type, Select/Popover+Command, TagInput for origins, copy-to-clipboard snippet
     @states validation (origin must be https, email unique) · verifying (forwarding check) · verified · failed (with the DNS record to fix) · no-access
     @audit  CHANNEL_CONNECTED, CHANNEL_VERIFIED
     @note   EMAIL: either a forwarding address we generate or a verified sender identity from 11. WIDGET and LIVE_CHAT: widget_key is generated; allowed_origins is enforced on every widget request. Appearance lives in config
             (see Chat widget). ai_agent_enabled lets the AI support agent be the first line on this channel (needs support.ai.configure and the org setting).
     ===================================================================================================================== */
  function channelCreate() {
    return '<div class="a-page">' + head("Connect a channel", "Choose how customers will reach this inbox.", btn("Cancel") + btn("Create channel", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>1 · Channel type</b>", '<div class="g3">' + [["EMAIL", "mail", "Inbound email address or forwarding"], ["WIDGET", "chat", "Website chat and request widget"], ["LIVE_CHAT", "chat", "Live chat in the app / portal"], ["PORTAL", "globe", "Request form in the customer portal"], ["FORM", "file", "Embeddable bug / contact form"], ["API", "plug", "Create conversations via API"]].map((t, i) => '<div class="lk-card" style="margin:0;' + (i === 0 ? "border-color:var(--blue);background:var(--blue-soft)" : "") + '">' + I(t[1], 18) + '<div class="grow"><b>' + en(t[0]) + "</b><small>" + t[2] + "</small></div></div>").join("") + "</div>") + spc +
      cd("<b>2 · Email details</b>", f("Name", box("Support email")) + f("Email address", box("support@logiqdev.example")) + f("Sender identity", sel("support@logiqdev.example · verified (11)", "mail"), "Replies are sent through Communication Center with this identity, SPF/DKIM from 11.") + f("Inbound", '<div class="code-box">Forward support@logiqdev.example to\ninbound+7f3c91@support.logiqdev.example</div>', "SupportChannel.config holds the provider routing; verify after forwarding.")) + spc +
      cd("<b>3 · Routing</b>", f("Inbox", sel("Support", "inbox")) + '<div class="rowx" style="padding:0 0 8px"><div class="grow"><b>AI support agent answers first</b><small>ai_agent_enabled · needs the organization AI setting</small></div>' + sw(0) + '</div><div class="rowx" style="padding:0"><div class="grow"><b>Active</b><small>is_active</small></div>' + sw(1) + "</div>") +
      "</div><div>" + cd("<b>Widget channels only</b>", f("Allowed origins", box("https://www.acme.example, https://app.acme.example"), "SupportChannel.allowed_origins. Requests from other origins are rejected.") + f("Widget key", box("wk_live_8f2c… (generated)")) + btn("Open chat widget settings", "settings", "sm")) + spc +
      cd("<b>4 · Verify</b>", '<div class="rowx"><div class="grow"><b>Waiting for first email</b><small>Send a test message to the address. verified_at is set when it arrives.</small></div>' + btn("Check now", "check", "sm") + "</div>", 1) + "</div></div>" +
      dm(["SupportChannel · type, name, inbox_id, email_address, sender_identity_id, widget_key, allowed_origins, config, ai_agent_enabled, is_active, verified_at", "CommSenderIdentity (11) · CustomerPortalSettings.widget_settings (07)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CHAT WIDGET SETTINGS WITH LIVE PREVIEW (spec §1, §5)
     @screen Chat widget
     @route  /support/channels/:channelId/widget
     @perm   support.inboxes.manage · AI options support.ai.configure*
     @api    GET|PATCH /support/channels/:id {config, allowed_origins, ai_agent_enabled} · GET /support/channels/:id/snippet · mirrored read in 07 CustomerPortalSettings.widget_settings
     @mcp    support_inboxes_manage
     @data   SupportChannel (type WIDGET, widget_key, allowed_origins, ai_agent_enabled, config Json: appearance, greeting, pre-chat fields, office hours, offline behaviour, article suggestions) · CustomerPortalSettings.widget_settings (07)
     @ui     Two columns: form (Tabs: Appearance, Messages, Pre-chat form, Hours, AI) + live preview (iframe), ColorPicker (token presets), Switch, Select, copy snippet
     @states loading · saved (toast) · invalid origin · preview unavailable offline · no-access
     @audit  CHANNEL_UPDATED (config diff)
     @note   config is a typed Json validated with zod on the server (primary colour, position, launcher icon, greeting, team avatars, pre-chat fields [name, email, topic], office hours, offline message, show article suggestions,
             AI agent greeting, file upload on/off). Visitors without identity get a visitor_key and name/email from the pre-chat form; a logged-in portal user is identified by the signed widget token. Preview shows light and dark.
             @gap config is untyped Json in the schema; the shape above is a proposal, not a column (gaps-13.md).
     ===================================================================================================================== */
  function widget() {
    return '<div class="a-page">' + head("Chat widget", "Website chat widget · key wk_live_8f2c…", btn("Preview dark", "moon") + btn("Save changes", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.1fr 1fr;align-items:start"><div><div class="tabset">' + tabs([["a", "Appearance"], ["m", "Messages"], ["p", "Pre-chat form"], ["h", "Hours"], ["i", "AI & install"]], "a") +
      pane("a", 1, cd("<b>Look and feel</b>", f("Primary colour", '<div class="rowx" style="padding:0;gap:8px"><span class="swatch"></span>' + box("Brand blue (token primary)")) + f("Launcher position", seg(["Bottom right", "Bottom left"], "Bottom right")) + f("Launcher icon", seg(["Chat", "Message", "Help"], "Chat")) + f("Theme", seg(["Follow site", "Light", "Dark"], "Follow site")) + '<div class="rowx" style="padding:0 0 8px"><div class="grow"><b>Show team avatars</b></div>' + sw(1) + '</div><div class="rowx" style="padding:0"><div class="grow"><b>Allow file uploads</b></div>' + sw(1) + "</div>")) +
      pane("m", 0, cd("<b>Messages</b>", f("Header title", box("Chat with us")) + f("Greeting", box("Hi! How can we help? Our team replies in about 5 minutes."), "Shown before the first message.") + f("Offline message", box("We are away. Leave your email and we will reply within 1 business day.")) + '<div class="rowx" style="padding:0"><div class="grow"><b>Suggest help articles while typing</b><small>From PUBLISHED, PUBLIC articles</small></div>' + sw(1) + "</div>")) +
      pane("p", 0, cd("<b>Before the first message</b>", [["Name", 1, "Required"], ["Email", 1, "Required"], ["What do you need help with?", 1, "Select: Billing, Bug, Question, Other"], ["Company", 0, "Optional"]].map((r) => '<div class="rowx">' + cb(r[1]) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[2] + "</small></div>" + more + "</div>").join("") + '<div class="sub-note" style="padding:8px 16px">Logged-in portal users skip the form (identity comes from the signed token).</div>', 1)) +
      pane("h", 0, cd("<b>Office hours</b>", '<div class="rowx"><div class="grow"><b>Show as online only during hours</b></div>' + sw(1) + "</div>" + prop("Mon–Fri", "08:00–18:00 Europe/Athens") + prop("Sat–Sun", "Offline") + prop("Outside hours", "Show offline form, create ticket (source Widget)"))) +
      pane("i", 0, cd("<b>AI agent and install</b>", '<div class="rowx" style="padding:0 0 8px"><div class="grow"><b>AI agent answers first</b><small>Hands over to a human after 4 turns (SupportSettings.ai_handover_after_turns)</small></div>' + sw(1) + "</div>" + f("Allowed origins", box("https://www.acme.example"), "SupportChannel.allowed_origins") + f("Install snippet", '<div class="code-box">&lt;script src="https://cdn.logiqdev.example/widget.js"\n  data-key="wk_live_8f2c…" async&gt;&lt;/script&gt;</div>') + btn("Copy snippet", "link", "sm"))) +
      "</div></div>" +
      '<div><div class="pv-wrap"><div class="pv-win"><div class="pv-top"><b>Chat with us</b><small>We usually reply in 5 minutes</small><div style="display:flex;margin-top:8px">' + AV("AM", "", "") + AV("MS", "g", "") + AV("SJ", "y", "") + '</div></div><div class="pv-body"><div class="pv-m">Hi! How can we help? Our team replies in about 5 minutes.</div><div class="pv-m me">How do I add a second billing contact?</div><div class="pv-m">' + I("sparkles", 12) + ' This article may help: <b>Change the billing contact on your account</b></div><div class="sub-note">AI agent · can hand over to a person</div></div><div class="pv-in">' + I("clip", 16) + '<span style="flex:1">Write a message…</span>' + I("send", 16) + '</div></div><div class="pv-fab">' + I("chat", 24) + "</div></div></div></div>" +
      dm(["SupportChannel · type WIDGET, widget_key, allowed_origins, ai_agent_enabled, config, is_active", "CustomerPortalSettings.widget_settings (07)", "SupportSettings · ai_handover_after_turns · KnowledgeArticle (suggestions)"], ["config Json shape (appearance, pre-chat fields, office hours): untyped in the schema"]) + "</div>";
  }

  /* =====================================================================================================================
     INCIDENTS (spec §3, §9, §12)
     @screen Incidents · grouped problems across tickets
     @route  /support/incidents?status=&q= · /support/incidents/:incidentId
     @perm   VIEW support.tickets.read · create/confirm/dismiss/resolve support.tickets.update · create the task support.tickets.convert_to_task · publish the article support.knowledge.publish* · notify customers support.conversations.reply
     @api    GET /support/incidents?status= · POST /support/incidents {title, ticket_ids[]} · POST /support/incidents/:id/confirm|dismiss|resolve · POST /support/incidents/:id/tickets {ticket_ids} · POST /support/incidents/:id/create-task
     @mcp    support_tickets_read · support_tickets_update · support_tickets_convert_to_task
     @data   SupportIncident (title, description, status, detected_by_ai, project_id, task_id, knowledge_article_id, owner_membership_id, ticket_count, first_reported_at, resolved_at) · Ticket (incident_id) · TicketRelation (SAME_INCIDENT)
             · SupportAiSuggestion (INCIDENT_GROUPING) · Task (06) · Project (05) · KnowledgeArticle
     @ui     Table + detail Card with affected-ticket Table, Badge, Dialog for "notify affected customers" (preview of the 11 message)
     @states loading · empty ("No incidents") · error · no-access
     @audit  INCIDENT_DETECTED, INCIDENT_CONFIRMED, INCIDENT_DISMISSED, INCIDENT_RESOLVED, INCIDENT_TICKET_ATTACHED
     @note   DETECTED = AI proposes a group (INCIDENT_GROUPING suggestion), CONFIRMED = a human accepted it, RESOLVED, DISMISSED. Resolving an incident can resolve its tickets in bulk and send the customer notification. ticket_count is
             denormalized from Ticket.incident_id. Affected customers are derived from the tickets' companies and feed Release.affected_company_ids (06).
             @gap No severity, no impact/affected-services, no public status updates or timeline entries (post-mortems, "investigating/identified/monitoring" notes) and no service-announcement table for the portal (spec §5 announcements): gaps-13.md.
     ===================================================================================================================== */
  function incidents() {
    return '<div class="a-page">' + head("Incidents", "Recurring problems grouped across tickets.", btn("Declare incident", "flag", "primary")) +
      '<div class="mini-stats">' + stat("Confirmed", 2, "active", 1) + stat("Detected by AI", 3, "need review") + stat("Resolved (30d)", 6, "median 3h 10m") + stat("Tickets in incidents", 19, "24% of volume") + "</div>" +
      '<div class="pills" style="margin-bottom:6px">' + pill("All <b>14</b>") + pill("Detected <b>3</b>", 1) + pill("Confirmed <b>2</b>") + pill("Resolved <b>8</b>") + pill("Dismissed <b>1</b>") + "</div>" +
      tbl(["Incident", "Status", "Detected", ">Tickets", "First reported", "Owner", "Task", "Article"], [[ink("Dashboards not loading for several clients"), E("CONFIRMED", "red"), "Agent", 7, "Today 10:34", wh("MS"), "WEB-163", "Draft"], [ink("Checkout validation errors on iOS Safari"), E("DETECTED", "yellow"), "AI " + muted("0.84"), 4, "Today 09:58", "—", "WEB-148", "—"], [ink("Portal login loop after password reset"), E("DETECTED", "yellow"), "AI " + muted("0.76"), 3, "Yesterday", "—", "—", "—"], [ink("Invoice PDFs missing logo"), E("RESOLVED", "green"), "AI", 5, "Nov 3", wh("SJ"), "WEB-131", "Published"], [ink("Duplicate welcome emails"), E("DISMISSED"), "AI " + muted("0.52"), 2, "Oct 28", wh("AM"), "—", "—"]]) + spc +
      cd("<b>Dashboards not loading for several clients</b>" + " " + E("CONFIRMED", "red") + "<span class='r'>" + btn("Notify customers", "send", "sm") + btn("Create task", "tasks", "sm") + btn("Resolve incident", "check", "sm") + "</span>", '<div class="g2"><div>' + prop("Owner", wh("MS")) + prop("First reported", "Today 10:34 by Dana Hughes (Stark Logistics)") + prop("Project", "Data Warehouse Setup " + muted("(05)")) + prop("Task", "WEB-163 · In progress " + muted("(06)")) + prop("Article", "Known issue: dashboards loading slowly · Draft") + prop("Detected by", "Agent · confirmed by Marco Silva") + '</div><div><b style="color:var(--ink)">Affected customers</b>' + hbar([["Stark Logistics", 100, "3 tickets", "red"], ["Northwind", 66, "2 tickets", "red"], ["Globex", 33, "1 ticket", "red"], ["Acme Corp", 33, "1 ticket", "red"]]) + "</div></div>", 0) + spc +
      tbl(["Ticket", "Subject", "Requester", "Status", "Priority", "Relation"], [["TCK-2036", ink("Outage: dashboards not loading"), cwh("DH"), stb("Open", "OPEN"), pri("URGENT"), E("SAME_INCIDENT", "red")], ["TCK-2039", ink("Reports show empty charts"), cwh("TB"), stb("Open", "OPEN"), pri("HIGH"), E("SAME_INCIDENT", "red")], ["TCK-2042", ink("Dashboard spinner forever"), cwh("YT"), stb("New", "NEW"), pri("HIGH"), E("SAME_INCIDENT", "red")]]) +
      '<div class="sub-note" style="margin-top:8px">Showing 3 of 7 tickets · Ticket.incident_id</div>' +
      dm(["SupportIncident · title, description, status, detected_by_ai, project_id, task_id, knowledge_article_id, owner_membership_id, ticket_count, first_reported_at, resolved_at", "Ticket · incident_id · TicketRelation · SAME_INCIDENT · SupportAiSuggestion · INCIDENT_GROUPING", "Read-only: Task (06) · Project (05) · KnowledgeArticle"], ["Incident severity, public status updates / timeline, service announcements for the portal: no table"]) + "</div>";
  }

  /* =====================================================================================================================
     CSAT REPORT (spec §9)
     @screen Customer satisfaction
     @route  /support/csat?from=&to=&team=&agent=&company=
     @perm   VIEW support.csat.read (scope-limited to the caller's teams; agent-level breakdown needs support.analytics.read) · export support.tickets.export*
     @api    GET /support/csat/summary?from=&to=&team_id=&agent_id=&company_id= · GET /support/csat/ratings?cursor= · POST /support/csat/:id/follow-up {conversation} · GET /csat/:token (public rating page, 07)
     @mcp    support_csat_read
     @data   SupportCsatRating (ticket_id, conversation_id, contact_id, rated_by_user_id, agent_membership_id, rating, comment, token, requested_at, submitted_at, expires_at) · SupportSettings (csat_enabled, csat_delay_minutes) · Ticket / Team (grouping)
     @ui     Card stat tiles, bar charts, Table with Rating stars, Select filters, Dialog "Follow up with customer"
     @states loading · empty ("No ratings yet. CSAT is requested 30 min after resolve") · error · no-access · CSAT disabled banner
     @audit  CSAT_REQUESTED, CSAT_SUBMITTED, CSAT_FOLLOWUP_CREATED
     @note   Rating is an integer (shown as 1 to 5 stars here). Response rate = submitted / requested. CSAT = share of 4 to 5. Low ratings (1 to 2) are surfaced for follow-up and can reopen the ticket. Comments are customer text:
             visible to agents, never public. Ratings are tied to the agent who resolved (agent_membership_id) for the breakdown; use for coaching, not rankings, per org policy.
             @gap The rating scale and survey wording are not stored (only rating Int and csat_delay_minutes). A survey definition (scale, question, thank-you text) is missing: gaps-13.md.
     ===================================================================================================================== */
  const stars = (n) => '<span class="stars">' + [1, 2, 3, 4, 5].map((i) => '<span class="' + (i > n ? "off" : "") + '">' + I("star", 13) + "</span>").join("") + "</span>";
  function csat() {
    return '<div class="a-page">' + head("Customer satisfaction", "CSAT collected after tickets are resolved.", sel("Last 30 days", "calendar") + sel("All teams", "users") + btn("Export", "file")) +
      '<div class="mini-stats">' + stat("CSAT", "92%", "4–5 stars") + stat("Average", "4.6", "of 5") + stat("Responses", 214, "of 468 requests") + stat("Response rate", "46%", "+4 pts") + stat("Needs follow-up", 6, "1–2 stars", 1) + "</div>" +
      '<div class="g2">' + cd("<b>Rating distribution</b>", hbar([["5 stars", 78, "151", "green"], ["4 stars", 20, "46", "green"], ["3 stars", 6, "13", "yellow"], ["2 stars", 3, "6", "red"], ["1 star", 2, "4", "red"]])) + cd("<b>CSAT trend</b><span class='r muted'>weekly</span>", line([88, 90, 89, 91, 90, 93, 92, 92], "green") + '<div class="sub-note">Weeks 38–45</div>') + "</div>" + spc +
      '<div class="g2">' + cd("<b>By agent</b><span class='r muted'>SupportCsatRating.agent_membership_id</span>", tbl(["Agent", ">Responses", ">CSAT", ">Avg"], [[wh("AM"), 61, "96%", "4.8"], [wh("MS"), 54, "91%", "4.5"], [wh("SJ"), 49, "93%", "4.6"], [wh("JK"), 31, "84%", "4.2"], [wh("KL"), 19, "95%", "4.7"]]).replace('class="panel" style="margin-top:0"', 'style="margin:0"'), 1) +
      cd("<b>By team and channel</b>", hbar([["Client success", 94, "94%", "green"], ["Billing", 90, "90%", "green"], ["Support engineering", 86, "86%", "yellow"]]) + '<div style="height:10px"></div>' + hbar([["Live chat", 95, "95%", "green"], ["Email", 89, "89%", "green"], ["Portal", 88, "88%", "green"], ["AI agent only", 82, "82%", "yellow"]])) + "</div>" + spc +
      cd("<b>Recent ratings</b><span class='r muted'>comments are internal</span>", tbl(["Ticket", "Customer", "Agent", "Rating", "Comment", "Submitted", ""], [["TCK-2029", cwh("YT"), wh("SJ"), stars(5), "Fast and friendly, thanks!", "4d ago", more], ["TCK-2025", cwh("LK"), wh("AM"), stars(5), "Solved in minutes.", "5d ago", more], ["TCK-2022", cwh("TB"), wh("JK"), stars(2), "Took too long and I had to repeat myself.", "6d ago", btn("Follow up", "chat", "sm")], ["TCK-2019", cwh("OB"), wh("MS"), stars(4), "", "1w ago", more], ["TCK-2011", cwh("PN"), wh("SJ"), stars(1), "Issue came back after you closed it.", "1w ago", btn("Follow up", "chat", "sm")]]).replace('class="panel" style="margin-top:0"', 'style="margin:0"'), 1) +
      dm(["SupportCsatRating · rating, comment, agent_membership_id, ticket_id, conversation_id, contact_id, rated_by_user_id, requested_at, submitted_at, expires_at, token", "SupportSettings · csat_enabled, csat_delay_minutes · Team / Membership (grouping)"], ["CSAT survey definition (scale, question, thank-you text): not stored"]) + "</div>";
  }

  /* =====================================================================================================================
     SUPPORT ANALYTICS (spec §9)
     @screen Support analytics dashboard
     @route  /support/analytics?from=&to=&team=&agent=&company=&project=&category=
     @perm   VIEW support.analytics.read (scope-limited; org-wide totals need the organization scope) · export support.tickets.export*
     @api    GET /support/analytics/{overview|volume|response-times|sla|agents|teams|categories|channels|ai|incidents|sentiment|dev-issues}?filters
     @mcp    support_analytics_read
     @data   Ticket (created_at, resolved_at, first_responded_at, priority, type, category_id, source, channel_type, sla_breached, resolved_by_ai, sentiment, team_id, assignee_membership_id, company_id, project_id) · TicketStatusHistory (resolution time, reopen)
             · SupportMessage (is_first_response) · SupportConversation (message_count, status) · SupportCsatRating · SupportAiSuggestion (status, was_correct, kind) · SupportAiSession (status) · SupportIncident · TicketTaskLink + Task (06, completed_at)
             · KnowledgeArticle (view_count)
     @ui     Card stat tiles, charts (Recharts) with tooltips, Table, Select/Combobox filters, DateRangePicker; all numbers link to the filtered Tickets list
     @states loading skeleton · empty · error · no-access · partial (a filter excludes a restricted scope)
     @audit  report exported
     @note   Everything is computed from history and aggregated server-side (materialized per day), never stored by hand. AI classification accuracy = ACCEPTED / (ACCEPTED + REJECTED) among CLASSIFICATION suggestions, refined by was_correct.
             AI resolution rate = tickets with resolved_by_ai / all resolved. Time to development resolution = ticket created to the linked task's completed_at (TicketTaskLink). SLA compliance = MET timers / finished timers.
     ===================================================================================================================== */
  function analytics() {
    return '<div class="a-page">' + head("Support analytics", "Volume, speed, quality and AI impact.", sel("Last 30 days", "calendar") + sel("All teams", "users") + sel("All agents", "users") + btn("Export", "file")) +
      filterBar([["Category", "is any of", "Billing, Bugs"], ["Organization", "is", "Any"]], btn("Clear", "", "sm ghost")) +
      '<div class="mini-stats">' + stat("Conversations", "1,284", "+8%") + stat("Tickets", 468, "+5%") + stat("Open / unresolved", 47, "9 waiting on customer") + stat("First response", "11 min", "−2 min") + stat("Resolution time", "5h 20m", "median") + stat("SLA compliance", "96%", "breach rate 4%") + stat("CSAT", "92%", "214 responses") + stat("AI resolved", "27%", "of resolved") + "</div>" +
      '<div class="g2">' + cd("<b>Ticket volume</b><span class='r muted'>created vs resolved · daily</span>", line([32, 40, 38, 45, 30, 12, 9, 41, 47, 44, 39, 36, 14, 10, 44, 49], "blue", 110) + line([30, 36, 40, 42, 33, 14, 10, 38, 44, 46, 41, 35, 16, 11, 40, 45], "green", 60)) + cd("<b>Response and resolution time</b><span class='r muted'>median minutes</span>", line([16, 15, 14, 14, 13, 12, 12, 11], "yellow", 110) + '<div class="sub-note">First response target 15 min · resolution 5h 20m</div>') + "</div>" + spc +
      '<div class="g3">' + cd("<b>By category</b>", hbar([["Billing", 100, "128"], ["Bugs", 75, "96"], ["Account", 60, "77"], ["Change requests", 17, "22"], ["Incidents", 5, "6"]])) + cd("<b>By priority</b>", hbar([["Urgent", 12, "31", "red"], ["High", 34, "88", "yellow"], ["Normal", 100, "252"], ["Low", 36, "97", "mute"]])) + cd("<b>By source / channel</b>", hbar([["Email", 100, "212"], ["Widget", 60, "128"], ["Live chat", 45, "96"], ["Portal", 40, "85"], ["Form", 10, "21"], ["AI agent", 6, "14"]])) + "</div>" + spc +
      '<div class="g2">' + cd("<b>Agents</b><span class='r muted'>scope-limited</span>", tbl(["Agent", ">Resolved", ">First reply", ">Resolution", ">SLA", ">CSAT"], [[wh("AM"), 96, "8m", "3h 40m", "98%", "96%"], [wh("MS"), 88, "12m", "6h 10m", "94%", "91%"], [wh("SJ"), 71, "10m", "4h 20m", "97%", "93%"], [wh("JK"), 52, "15m", "9h 05m", "90%", "84%"], [wh("KL"), 34, "9m", "5h 50m", "96%", "95%"]]).replace('class="panel" style="margin-top:0"', 'style="margin:0"'), 1) +
      cd("<b>AI performance</b>", prop("Resolved by AI agent", "27% · 112 conversations") + prop("Handed over to human", "58 · avg 3.2 turns") + prop("Classification accuracy", "91% " + muted("accepted vs rejected")) + prop("Auto-applied suggestions", "64 · 98% not reverted") + prop("Replies drafted", "412 · 71% used") + prop("Automated vs manual tickets", "34% / 66%")) + "</div>" + spc +
      '<div class="g3">' + cd("<b>Sentiment trend</b>", line([6, 7, 6, 8, 9, 8, 7, 6], "red", 90) + '<div class="sub-note">Share of NEGATIVE + FRUSTRATED, weekly</div>') + cd("<b>Most reported bugs</b>", hbar([["Checkout VAT iOS", 100, "7"], ["Dashboards slow", 86, "6"], ["Login loop", 43, "3"], ["PDF logo missing", 28, "2"]], "red")) + cd("<b>Feature request trends</b>", hbar([["CSV export", 100, "11"], ["Dark mode portal", 55, "6"], ["Approval step", 36, "4"], ["API keys UI", 27, "3"]], "purple")) + "</div>" + spc +
      cd("<b>Development issues from support</b>", '<div class="mini-stats" style="margin:0">' + stat("Tasks created", 23, "from tickets") + stat("Linked tickets", 41, "many to one") + stat("To dev resolution", "4.2 d", "median") + stat("Customers notified", 17, "on fix") + "</div>") +
      dm(["Ticket · created_at, resolved_at, first_responded_at, priority, type, category_id, source, channel_type, sla_breached, resolved_by_ai, sentiment, team_id, assignee_membership_id, company_id, project_id", "TicketStatusHistory · SupportMessage.is_first_response · SupportCsatRating · SupportAiSuggestion (status, was_correct) · SupportAiSession · SupportIncident · TicketTaskLink + Task (06)"], ["No stored daily aggregates table; the API aggregates on the fly or materializes (implementation note)"]) + "</div>";
  }

  /* =====================================================================================================================
     ROUTING, ASSIGNMENT AND AUTOMATION RULES (spec §7)
     @screen Support automation rules
     @route  /support/automation?tab=rules|runs|auto-close · rule editor opens in Automation (20) /automation/rules/:id?module=SUPPORT
     @perm   VIEW + manage support.automation.manage · executes as the rule's service account / membership with the same checks · AI steps need support.ai.use
     @api    GET /automation/rules?module=SUPPORT · POST /automation/rules {module: SUPPORT, trigger_key, conditions, actions} · POST /automation/rules/:id/publish|enable|disable · GET /automation/runs?module=SUPPORT
     @mcp    support_automation_manage (thin adapter over 20)
     @data   AutomationRule (module SUPPORT, status DRAFT|PUBLISHED|ARCHIVED, enabled, trigger_key, conditions, actions, current_version) · AutomationRun (status, started_at, error) · SupportInbox (routing_strategy, default_assignee) · SupportSettings
             (auto_close_after_days, inactivity_after_hours, reopen_window_days) · ScheduledJob (SLA timers, auto-close: TicketSlaTimer.scheduled_job_id, Ticket.auto_close_job_id)
     @ui     Table with Switch, rule summary as When / If / Then steps, Sheet to preview, Tabs for rules/runs, links to the 20 builder (this module does not implement its own rules runtime)
     @states loading · empty ("No support rules yet" + templates) · error · no-access · rule failing (last run FAILED)
     @audit  AUTOMATION_RULE_PUBLISHED / ENABLED / DISABLED (20), ticket changes by a rule carry changed_via "automation"
     @note   Support DECLARES triggers (ticket created, conversation inactive, SLA at risk, SLA breached, AI classification completed, customer replied) and actions (assign, route to inbox, set priority/category, add tag, auto-reply,
             send notification, close, reopen, create task, create incident) to 20. Rules here are AutomationRule rows with module SUPPORT; nothing is stored in Support tables. Assignment strategies: manual, round robin, load balanced, by skill.
             @gap Trigger and action definitions for support (AutomationTriggerDefinition / AutomationActionDefinition seeds) and an agent skills/availability model are not in the schema or seed (gaps-13.md).
     ===================================================================================================================== */
  function automation() {
    return '<div class="a-page">' + head("Automation & routing", "Rules that route, assign, escalate and close without code. Built on the Automation engine (20).", btn("Templates", "book") + btn("New rule", "plus", "primary")) +
      '<div class="tabset">' + tabs([["r", "Rules", 8], ["w", "Run history"], ["a", "Auto-close & reopen"]], "r") +
      pane("r", 1, tbl(["Rule", "When", "If", "Then", "Status", "Runs 7d", "Last run", ""], [[ink("Route billing emails"), "Ticket created", "Category is Billing", "Move to Billing inbox, assign round robin", sw(1), 61, E("SUCCEEDED", "green"), more], [ink("Urgent to on-call"), "Ticket created", "Priority is Urgent", "Assign to on-call, notify #support-oncall", sw(1), 9, E("SUCCEEDED", "green"), more], [ink("AI auto-classify"), "AI classification completed", "Confidence ≥ 0.85", "Apply category, priority, team", sw(1), 143, E("SUCCEEDED", "green"), more], [ink("SLA at risk: ping lead"), "SLA at risk", "Priority is High or Urgent", "Notify team lead in-app + email", sw(1), 14, E("SUCCEEDED", "green"), more], [ink("SLA breached: reassign"), "SLA breached", "Escalation level is 0", "Escalate, raise priority, notify manager", sw(1), 3, E("SUCCEEDED", "green"), more], [ink("Customer inactive 48 h"), "Conversation inactive", "Status is Pending", "Send follow-up, then close after 5 days", sw(1), 27, E("SUCCEEDED", "green"), more], [ink("Bug to Tasks (needs approval)"), "AI classification completed", "Type is Bug and confidence ≥ 0.90", "Ask approval, then create task in category project", sw(1), 8, E("AWAITING_APPROVAL", "yellow"), more], [ink("Reply after reopen window"), "Customer replied", "Status is Closed", "Create a new linked ticket", sw(0), 0, "—", more]]) + spc +
        cd("<b>Rule preview · Urgent to on-call</b><span class='r'>" + btn("Open in Automation", "link", "sm") + "</span>", '<div class="flow"><div class="step"><span class="kw">When</span><div class="grow"><b>support.ticket.created</b> <small class="muted">trigger_key</small></div></div><div class="step if"><span class="kw">If</span><div class="grow">Priority is <b>Urgent</b> and inbox is Support</div></div><div class="step then"><span class="kw">Then</span><div class="grow">Assign to <b>on-call engineer</b> · notify team lead · add tag <span class="badge">urgent</span></div></div></div><div class="sub-note" style="margin-top:8px">Executes as service account “Support automation” with the same permission checks as a person.</div>')) +
      pane("w", 0, tbl(["Run", "Rule", "Record", "Status", "Started", "Duration", "Detail"], [["#9921", "AI auto-classify", "TCK-2047", E("SUCCEEDED", "green"), "09:58", "1.2 s", "Priority NORMAL → URGENT"], ["#9920", "Route billing emails", "TCK-2046", E("SUCCEEDED", "green"), "09:54", "0.3 s", "Assigned to Billing inbox"], ["#9917", "Bug to Tasks (needs approval)", "TCK-2038", E("AWAITING_APPROVAL", "yellow"), "Yesterday", "—", "Waiting for Anna Meyer"], ["#9902", "Customer inactive 48 h", "C-8770", E("FAILED", "red"), "Yesterday", "0.9 s", "Email bounced (SupportMessage BOUNCED)"], ["#9899", "SLA at risk: ping lead", "TCK-2036", E("SUCCEEDED", "green"), "Nov 9", "0.4 s", "Notified Anna Meyer"]])) +
      pane("a", 0, cd("<b>Lifecycle automation</b><span class='r muted'>SupportSettings</span>", f("Remind customer after inactivity", '<div class="input-fake">48 hours</div>', "inactivity_after_hours · runs as a ScheduledJob") + f("Auto-close resolved tickets after", '<div class="input-fake">5 days</div>', "auto_close_after_days sets Ticket.auto_close_at") + f("Customer reply reopens within", '<div class="input-fake">14 days</div>', "reopen_window_days · then a new ticket is created and linked") + '<div style="display:flex;justify-content:flex-end">' + btn("Save", "check", "primary") + "</div>")) + "</div>" +
      dm(["AutomationRule (20) · module SUPPORT, trigger_key, conditions, actions, enabled, status · AutomationRun · ScheduledJob", "SupportInbox · routing_strategy, default_assignee_membership_id · SupportSettings · auto_close_after_days, inactivity_after_hours, reopen_window_days", "Ticket · auto_close_at, auto_close_job_id · TicketSlaTimer · scheduled_job_id"], ["Support trigger/action definitions to register with 20; agent availability / skills for assignment: not in schema"]) + "</div>";
  }

  /* =====================================================================================================================
     AI SUPPORT AGENT — review queue, sessions, configuration (spec §3, §4)
     @screen AI support
     @route  /support/ai?tab=queue|sessions|config
     @perm   review/use support.ai.use · configure thresholds and model support.ai.configure* (sensitive) · task suggestions also need support.tickets.convert_to_task to accept
     @api    GET /support/ai/suggestions?status=PENDING&kind= · POST /support/ai/suggestions/:id/accept|reject {note} · GET /support/ai/sessions · PATCH /support/settings {ai_*}
     @mcp    support_ai_use · support_ai_configure (sensitive)
     @data   SupportAiSuggestion (kind, payload, explanation, confidence, status, auto_applied, reviewed_by_membership_id, reviewed_at, review_note, expires_at, was_correct) · SupportAiSession (status, model, collected_data, cited_article_ids,
             handover_summary, handover_reason, turn_count, usage) · SupportSettings (ai_agent_enabled, ai_model, ai_auto_classify_threshold, ai_auto_assign_threshold, ai_auto_task_threshold, ai_require_task_approval,
             ai_require_reply_approval, ai_handover_after_turns, ai_escalation_intents)
     @ui     Tabs, Table, Card per suggestion with Accept/Edit/Reject, Slider for thresholds, TagInput for escalation intents, Switch
     @states loading · empty ("Nothing to review") · error · no-access · AI disabled · provider unavailable (BYOK missing, see 01 integrations) · low-confidence
     @audit  AI_SUGGESTION_ACCEPTED, REJECTED, AUTO_APPLIED, AI_SESSION_HANDED_OVER, AI_SETTINGS_CHANGED
     @note   Every AI output is a SupportAiSuggestion with model, confidence and explanation; auto-apply happens only above the kind's threshold and is flagged auto_applied. The AI agent answers customers ONLY from PUBLISHED non-INTERNAL
             articles and authorized data, collects information, creates a ticket when it needs a human, and hands over with a handover_summary after ai_handover_after_turns or when an escalation intent is detected. The model
             is JEV (Typesafe AI) through the shared AI layer; OpenAI keys per organization (BYOK, IntegrationConnection) are used where configured.
     ===================================================================================================================== */
  function ai() {
    return '<div class="a-page">' + head("AI support", "Review what the AI proposes and tune how much it may do alone.", btn("Test the AI agent", "chat") + btn("Save", "check", "primary")) +
      '<div class="mini-stats">' + stat("Pending review", 9, "suggestions") + stat("Auto-applied (7d)", 64, "98% kept") + stat("AI sessions (7d)", 170, "27% resolved by AI") + stat("Handed over", 58, "avg 3.2 turns") + stat("Accuracy", "91%", "was_correct") + "</div>" +
      '<div class="tabset">' + tabs([["q", "Review queue", 9], ["s", "AI sessions"], ["c", "Configuration"]], "q") +
      pane("q", 1, tbl(["Suggestion", "Kind", "Target", "Confidence", "Explanation", "Status", ""], [[ink("Create task in Stripe Billing Migration"), E("TASK_CREATION"), "TCK-2047", "0.82", "Matches WEB-148 scope and repro steps", E("PENDING", "yellow"), btn("Accept", "check", "sm") + btn("Reject", "x", "sm")], [ink("Group 4 tickets as incident"), E("INCIDENT_GROUPING"), "TCK-2036…", "0.84", "Same symptom within 40 min, 3 companies", E("PENDING", "yellow"), btn("Accept", "check", "sm") + btn("Reject", "x", "sm")], [ink("Link as related TCK-2038"), E("DUPLICATE_TICKET"), "TCK-2047", "0.87", "Same customer, iOS 17.2", E("PENDING", "yellow"), btn("Accept", "check", "sm") + btn("Reject", "x", "sm")], [ink("Draft article: second billing contact"), E("ARTICLE_DRAFT"), "14 tickets", "0.90", "Recurring question without article", E("PENDING", "yellow"), btn("Review", "book", "sm")], [ink("Category Bugs / Checkout"), E("CLASSIFICATION"), "TCK-2047", "0.93", "Keywords: checkout, VAT, Safari", E("AUTO_APPLIED", "green"), muted("threshold 0.85")], [ink("Reply draft for Lena Kovac"), E("REPLY"), "C-8801", "0.91", "KB: change billing contact", E("ACCEPTED", "blue"), muted("edited by Anna")], [ink("Assign to Marco Silva"), E("ASSIGNMENT"), "TCK-2047", "0.71", "Handled 6 similar bugs", E("REJECTED"), muted("note: wrong team")]])) +
      pane("s", 0, tbl(["Conversation", "Customer", "Status", ">Turns", "Cited articles", "Collected", "Outcome"], [["C-8815", cwh("YT"), E("ACTIVE", "blue"), 2, "Change the billing contact…", "Company, invoice no.", "In progress"], ["C-8809", cwh("PN"), E("RESOLVED_BY_AI", "green"), 3, "Reset your portal password", "—", "Customer confirmed"], ["C-8801", cwh("LK"), E("HANDED_OVER", "yellow"), 4, "Where to find invoices", "Invoice INV-2058", "Handed to Anna · summary attached"], ["C-8797", cwh("TB"), E("HANDED_OVER", "yellow"), 1, "—", "Browser, OS", "Escalation intent: billing dispute"], ["C-8790", "Visitor · wk_live", E("ABANDONED"), 1, "—", "—", "No reply"], ["C-8788", cwh("OB"), E("FAILED", "red"), 0, "—", "—", "Provider timeout, handed over"]])) +
      pane("c", 0, '<div class="g2">' + cd("<b>Agent and model</b>", '<div class="rowx" style="padding:0 0 10px"><div class="grow"><b>AI support agent first line</b><small>ai_agent_enabled</small></div>' + sw(1) + "</div>" + f("Model", sel("JEV (Typesafe AI)", "sparkles"), "ai_model. Provider keys per organization (BYOK).") + f("Hand over after", '<div class="input-fake">4 turns</div>', "ai_handover_after_turns") + f("Always escalate when the customer mentions", box("refund · legal · cancel · data breach"), "ai_escalation_intents")) +
      cd("<b>Autonomy</b><span class='r muted'>confidence thresholds</span>", [["Auto-apply classification", 85], ["Auto-assign", 90], ["Auto-create task", 95]].map((r) => f(r[0], '<div class="rowx" style="padding:0;gap:10px"><span class="bar" style="width:180px"><i style="width:' + r[1] + '%"></i></span><b>' + r[1] / 100 + "</b></div>")).join("") + '<div class="rowx" style="padding:0 0 8px"><div class="grow"><b>Require approval to send AI replies</b><small>ai_require_reply_approval</small></div>' + sw(1) + '</div><div class="rowx" style="padding:0"><div class="grow"><b>Require approval to create tasks</b><small>ai_require_task_approval</small></div>' + sw(1) + "</div>") + "</div>") + "</div>" +
      dm(["SupportAiSuggestion · kind, payload, explanation, confidence, status, auto_applied, reviewed_by_membership_id, reviewed_at, review_note, was_correct", "SupportAiSession · status, model, collected_data, cited_article_ids, handover_summary, handover_reason, turn_count, usage", "SupportSettings · ai_agent_enabled, ai_model, ai_auto_classify_threshold, ai_auto_assign_threshold, ai_auto_task_threshold, ai_require_task_approval, ai_require_reply_approval, ai_handover_after_turns, ai_escalation_intents"], []) + "</div>";
  }

  /* =====================================================================================================================
     SUPPORT SETTINGS (spec §2, §4, §7, §9)
     @screen Settings
     @route  /support/settings?tab=general|csat|tasks|signature
     @perm   support.settings.manage · AI thresholds live on the AI tab (support.ai.configure*)
     @api    GET|PATCH /support/settings {ticket_prefix, default_sla_policy_id, default_inbox_id, auto_close_after_days, inactivity_after_hours, reopen_window_days, csat_enabled, csat_delay_minutes, default_task_type_id, task_priority_mapping,
             task_status_sync_mapping, default_signature}
     @mcp    support_settings_manage
     @data   SupportSettings (one row per organization) · SlaPolicy · SupportInbox · TaskType (06, read-only picker) · TaskStatus (06, mapping targets)
     @ui     Tabs, Form (react-hook-form + zod), Select/Popover+Command, Switch, mapping table of Selects
     @states loading · saved · validation (prefix 2 to 6 letters, cannot change after the first ticket without migration) · error · no-access
     @audit  SUPPORT_SETTINGS_CHANGED (diff)
     @note   ticket_prefix prefixes Ticket.reference (TCK-2048); changing it never renumbers old tickets. Mappings drive ticket-to-task conversion and status sync: priority mapping TicketPriority to TaskPriority; status sync maps Task status
             categories to ticket TicketStatus slugs, one-directional per event, with loop protection (a change made by sync never re-triggers sync). New tickets use the default SLA policy and inbox unless category/inbox defaults win.
     ===================================================================================================================== */
  function settings() {
    return '<div class="a-page">' + head("Support settings", "Numbering, defaults, CSAT and ticket-to-task mapping.", btn("Save settings", "check", "primary")) +
      '<div class="tabset">' + tabs([["g", "General"], ["c", "CSAT"], ["t", "Ticket to task"], ["s", "Signature"]], "g") +
      pane("g", 1, '<div class="g2">' + cd("<b>Numbering and defaults</b>", f("Ticket prefix", '<div class="input-fake">TCK</div>', "Next ticket: TCK-2048. Sequence per organization.") + f("Default SLA policy", sel("Standard", "clock")) + f("Default inbox", sel("Support", "inbox"))) + cd("<b>Lifecycle</b>", f("Inactivity reminder", '<div class="input-fake">48 hours</div>', "inactivity_after_hours") + f("Auto-close resolved after", '<div class="input-fake">5 days</div>', "auto_close_after_days") + f("Reopen window", '<div class="input-fake">14 days</div>', "reopen_window_days")) + "</div>") +
      pane("c", 0, cd("<b>Customer satisfaction</b>", '<div class="rowx" style="padding:0 0 10px"><div class="grow"><b>Request CSAT when a ticket is resolved</b><small>csat_enabled</small></div>' + sw(1) + "</div>" + f("Send after", '<div class="input-fake">30 minutes</div>', "csat_delay_minutes. Delivered by email through 11 with a one-time token link.") + '<div class="rowx" style="padding:0 0 4px">' + gap("Not stored") + '<div class="grow"><small>Scale, question and thank-you text are not configurable yet.</small></div></div>')) +
      pane("t", 0, '<div class="g2">' + cd("<b>Defaults</b>", f("Default task type", sel("Bug", "tasks"), "default_task_type_id (06)") + '<div class="rowx" style="padding:0 0 8px"><div class="grow"><b>Create tasks only after approval</b><small>ai_require_task_approval</small></div>' + sw(1) + '</div><div class="rowx" style="padding:0"><div class="grow"><b>Notify agent when the task status changes</b></div>' + sw(1) + "</div>") +
        cd("<b>Mapping</b>", '<div class="sub-note" style="margin-bottom:6px">Ticket priority → task priority (task_priority_mapping)</div>' + [["URGENT", "Urgent"], ["HIGH", "High"], ["NORMAL", "Medium"], ["LOW", "Low"]].map((r) => '<div class="rowx" style="padding:4px 0;gap:8px"><div style="width:90px">' + pri(r[0]) + "</div>" + I("right", 12) + sel(r[1]) + "</div>").join("") + '<div class="sub-note" style="margin:10px 0 6px">Task status category → ticket status (task_status_sync_mapping)</div>' + [["In progress", "Open"], ["Blocked", "On hold"], ["Done", "Resolved (ask customer)"], ["Canceled", "Open (reopen)"]].map((r) => '<div class="rowx" style="padding:4px 0;gap:8px"><div style="width:90px">' + r[0] + "</div>" + I("right", 12) + sel(r[1]) + "</div>").join("")) + "</div>") +
      pane("s", 0, cd("<b>Default signature</b>", f("Signature", editor("Best regards,<br>{{agent.name}} · Logiqdev support"), "SupportSettings.default_signature. Inboxes can override it (SupportInbox.signature).") + f("Auto-reply (per inbox)", box("Thanks for contacting us. We got your message, reference {{ticket.reference}}."), "SupportInbox.auto_reply_body"))) + "</div>" +
      dm(["SupportSettings · ticket_prefix, default_sla_policy_id, default_inbox_id, auto_close_after_days, inactivity_after_hours, reopen_window_days, csat_enabled, csat_delay_minutes, default_task_type_id, task_priority_mapping, task_status_sync_mapping, default_signature", "SlaPolicy · SupportInbox · TaskType, TaskStatus (06 read-only)"], ["CSAT scale / question text: not stored"]) + "</div>";
  }

  const MAP = { inbox, conversation, tickets, ticket, "ticket-create": ticketCreate, knowledge, article, "kb-categories": kbCategories, sla: sla_list, "sla-edit": slaEdit, setup, macros, channels, "channel-create": channelCreate, widget, incidents, csat, analytics, automation, ai, settings };
  const CRUMB = { conversation: "C-8812", ticket: "TCK-2047", article: "Change the billing contact", "sla-edit": "Priority clients", widget: "Website chat widget", "channel-create": "New channel", "ticket-create": "New ticket" };
  window.VIEWS.support = { html: function (s) { return (MAP[s || "inbox"] || MAP.inbox)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, get fill() { return /^#support(\/(inbox|conversation))?$/.test(location.hash); } };
})();
