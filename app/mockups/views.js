/* Main-area views. Each app owns its layout: Tasks ≈ Linear, Messages ≈ Slack, Support ≈ Intercom, Campaigns ≈ Mailchimp/Customer.io.

   !! NOT YET SCHEMA-ALIGNED !!  These screens (Messages, Support, Campaigns) were designed from the product description before the
   "schema first" rule. Status labels, field names, columns and sample data here are ILLUSTRATIVE. Before implementing any of them:
     1. read the owned models + enums of the module in api/prisma/schema.prisma (module numbers are given per screen),
     2. read the module's permission keys in api/prisma/seed/permission-catalog.ts,
     3. align labels/columns to exact enum values and drop anything with no column (flag it as @gap),
     4. add the "Data model" footer like views-admin.js does.
   The LAYOUT and INTERACTION patterns are the approved design; the data details are not.

   @impl General rules for all screens in this file: see README.md. Mock-only: sample arrays, inline styles, the `st()` helper SVGs.
   Production: lists with > ~50 rows use cursor pagination + virtualization; every list is filtered server-side by the caller's branch/team/project scope. */
(function () {
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;

  /* ---------- Linear-style status glyph ----------
     @impl st(kind): status icon by TaskStatus category (backlog = dashed circle, todo = empty circle, in progress = half-filled, done = check).
       Render from TaskStatus.category (06), NOT from a hard-coded kind; org-defined statuses must map to one of these categories.
  function st(k) {
    const c = { backlog: "var(--ash)", todo: "var(--mute)", prog: "var(--yellow)", done: "var(--blue)" }[k];
    const w = (x) => '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex:none">' + x + "</svg>";
    if (k === "backlog") return w('<circle cx="7" cy="7" r="5.5" stroke="' + c + '" stroke-width="1.5" stroke-dasharray="2 2"/>');
    if (k === "todo") return w('<circle cx="7" cy="7" r="5.5" stroke="' + c + '" stroke-width="1.5"/>');
    if (k === "prog") return w('<circle cx="7" cy="7" r="5.5" stroke="' + c + '" stroke-width="1.5"/><path d="M7 3.5a3.5 3.5 0 0 1 0 7z" fill="' + c + '"/>');
    return w('<circle cx="7" cy="7" r="6.25" fill="' + c + '"/><path d="M4.5 7.2l1.7 1.7 3.3-3.4" stroke="var(--on-accent)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>');
  }

  /* ================= MESSAGES (Slack-like) =================
     @screen Messages · channel view with thread side pane
     @route  /messages/c/:channelId, /messages/c/:channelId/t/:messageId (thread open), /messages/dm/:channelId, /messages/threads, /messages/mentions
     @perm   VIEW messaging.channels.read + membership of the channel (private channels are invisible otherwise) · POST messaging.messages.post ·
             pin messaging.messages.pin · delete others' messages messaging.messages.delete_any (sensitive) · external participants need
             messaging.external_users.manage to be added.
     @api    GET /channels/:id/messages?before=&limit= (cursor, newest last) · POST /channels/:id/messages · GET /messages/:id/replies ·
             PUT /messages/:id/reactions/:emoji · realtime: WebSocket/SSE channel per Channel for new messages, reactions, typing, presence.
     @mcp    messaging_messages_read, messaging_messages_post, messaging_channels_read
     @data   module 12: Channel (kind, topic, is_shared/external), ChannelMember, Message (parent_id for threads), MessageReaction, MessageMention,
             MessageThreadFollower, ChannelPin, ChannelReadState, MessageDraft, MessagingPresence. Authors: Membership (internal) or external
             participants (customer portal users, 01 §79 -> `external_user_id`, plain id).
     @ui     ScrollArea (message list, anchored to bottom, load older on scroll up), Avatar, Badge ("Client", "App"), Popover (emoji picker), a rich-text editor (Tiptap) for the composer, Sheet/aside for the thread pane.
     @states loading · empty channel · error/offline banner (queue unsent messages) · no-access
     @note   "Shared with Acme Corp" badge = channel has external participants: show it so staff never post internal info by mistake, and block internal-only
             mentions/files there. Bot/automation messages (the "App" author) come from module 20 via a service account; their cards link to the source record
             (here a task) and must re-check the viewer's permission to that record before rendering details. */
  function msg(o) {
    return '<div class="m">' + AV(o.a, o.c, "lg sq") + '<div class="mb"><div class="mh"><b>' + o.n + "</b>" + (o.tag ? '<span class="badge ' + (o.tagc || "") + '">' + o.tag + "</span>" : "") + '<span class="tm">' + o.t + "</span></div>" +
      '<div class="mt">' + o.x + "</div>" + (o.card || "") +
      (o.re ? '<div class="re">' + o.re.map((r) => '<span class="r' + (r[2] ? " me" : "") + '">' + r[0] + " " + r[1] + "</span>").join("") + '<span class="r add">' + I("smile", 13) + "</span></div>" : "") +
      (o.th ? '<button class="thr">' + AV("MS", "g") + AV("SJ", "y") + "<b>" + o.th + " replies</b><span>Last reply today at 10:41</span></button>" : "") + "</div></div>";
  }
  function messages() {
    const file = '<div class="attach">' + I("file", 20) + '<div><b>Homepage-v3-final.fig</b><small>Figma export · 4.2 MB</small></div></div>';
    const botcard = '<div class="bcard"><div class="bc-h">' + st("prog") + '<b>WEB-142</b> moved to In progress</div><div class="bc-t">Rebuild pricing page hero with new brand system</div><div class="bc-m"><span>Assigned to Marco Silva</span><span>·</span><span>Due Nov 14</span></div></div>';
    return '<div class="ms">' +
      '<section class="ms-main"><header class="ms-h"><div><div class="ms-name"># acme-rebrand <span class="badge blue">' + I("globe", 11) + " Shared with Acme Corp</span></div><div class=\"ms-topic\">Brand refresh and new marketing site · Linked project: Acme Rebrand Website</div></div>" +
      '<span style="flex:1"></span><div class="avs">' + AV("AM", "") + AV("MS", "g") + AV("SJ", "y") + AV("LK", "p") + '</div><button class="btn sm" style="margin-left:10px">' + I("users", 13) + ' 8</button><button class="btn sm">' + I("video", 13) + " Huddle</button></header>" +
      '<div class="ms-tabs"><button class="pill active">Messages</button><button class="pill">Files</button><button class="pill">Pins</button><button class="pill">Tasks</button></div>' +
      '<div class="ms-scroll"><div class="day"><span>Yesterday</span></div>' +
      msg({ a: "LK", c: "p", n: "Lena Kovac", tag: "Client", tagc: "purple", t: "4:12 PM", x: "Hi team! We reviewed the homepage concept with our leadership and have a few notes on the hero section. Can we hop on a call tomorrow?", re: [["👍", 3], ["👀", 1]] }) +
      msg({ a: "AM", c: "", n: "Anna Meyer", t: "4:20 PM", x: "Absolutely. I'll book it via the calendar link. <span class=\"mention\">@Marco</span> can you join as well?" }) +
      '<div class="day"><span>Today</span></div>' +
      msg({ a: "MS", c: "g", n: "Marco Silva", t: "9:02 AM", x: "Updated the hero based on yesterday's feedback. Sharing the latest export 👇", card: file, re: [["🔥", 2, 1], ["✅", 1]], th: 4 }) +
      msg({ a: "⚡", c: "n", n: "Automation", tag: "App", t: "9:15 AM", x: "Task status changed", card: botcard }) +
      msg({ a: "LK", c: "p", n: "Lena Kovac", tag: "Client", tagc: "purple", t: "10:38 AM", x: "Looks great, much closer to what we imagined. Could you send the final pricing table for approval in the portal?" }) +
      "</div>" +
      '<div class="composer"><div class="c-in">Message #acme-rebrand</div><div class="c-bar"><button class="btn ghost sm icon">' + I("plus", 15) + '</button><button class="btn ghost sm icon">' + I("bold", 15) + '</button><button class="btn ghost sm icon">' + I("at", 15) + '</button><button class="btn ghost sm icon">' + I("smile", 15) + '</button><button class="btn ghost sm icon">' + I("clip", 15) + '</button><span style="flex:1"></span><button class="btn ghost sm">' + I("sparkles", 14) + ' Draft with AI</button><button class="btn primary sm icon">' + I("send", 14) + "</button></div></div></section>" +
      '<aside class="ms-thread"><div class="th-h"><b>Thread</b><small># acme-rebrand</small><button class="btn ghost sm icon" style="margin-left:auto">' + I("x", 15) + "</button></div>" +
      '<div class="th-body">' + msg({ a: "MS", c: "g", n: "Marco Silva", t: "9:02 AM", x: "Updated the hero based on yesterday's feedback. Sharing the latest export 👇", card: file }) +
      '<div class="day"><span>4 replies</span></div>' +
      msg({ a: "AM", c: "", n: "Anna Meyer", t: "9:20 AM", x: "Love the new gradient. Contrast on the CTA is still a bit low on mobile." }) +
      msg({ a: "MS", c: "g", n: "Marco Silva", t: "9:31 AM", x: "Good catch, fixing now." }) +
      msg({ a: "LK", c: "p", n: "Lena Kovac", tag: "Client", tagc: "purple", t: "10:38 AM", x: "Looks great, much closer to what we imagined." }) +
      '</div><div class="composer" style="margin:0 12px 12px"><div class="c-in">Reply…</div><div class="c-bar"><span style="flex:1"></span><button class="btn primary sm icon">' + I("send", 14) + "</button></div></div></aside></div>";
  }

  /* ================= SUPPORT (Intercom-like) =================
     @screen Support · Your inbox (conversation list | conversation | customer panel)
     @route  /support/inbox/:view (view = mine|mentions|unassigned|all|saved-view-id), /support/c/:conversationId, /support/tickets, /support/help-center
     @perm   VIEW support.conversations.read · reply support.conversations.reply · assign support.conversations.assign · close support.conversations.close ·
             convert to task support.tickets.convert_to_task · AI suggestions support.ai.use · internal notes are visible to staff only.
     @api    GET /support/conversations?inbox=&assignee=&status=&cursor= · GET /support/conversations/:id (+messages) · POST /support/conversations/:id/messages {type: reply|note}
             POST /support/conversations/:id/assign|snooze|close · realtime channel for new messages and typing.
     @mcp    support_conversations_read, support_conversations_reply (sensitive when sent by an AI agent: needs human confirmation), support_conversations_assign
     @data   module 13: SupportConversation, SupportMessage (author Membership or portal User; type note vs reply), Ticket, TicketStatus, SlaPolicy (first-response/resolution timers),
             SupportInbox, SupportChannel (live chat/email/portal), SupportCannedResponse (macros), SupportAiSuggestion, SupportCsatRating. Customer panel reads CRM (02) Company/Contact,
             Billing (08) open invoices, Projects (05) / Tasks (06) / Contracts (04) for "Linked records" — each link re-checks the viewer's permission for that module.
     @ui     3-pane layout (resizable panels), list = virtualized rows, composer = Tiptap with Reply/Note tabs (Tabs), Command for macros, DropdownMenu for assignee/snooze, Badge for SLA/VIP.
     @states loading · empty inbox ("Inbox zero") · error · conversation closed/readonly · no-access
     @note   SLA badge counts down live (SlaPolicy + business hours of the Branch, 01 §121). Internal notes (yellow) must never be sent to the customer: enforce on the server by message type.
             AI suggestion = SupportAiSuggestion, human reviews and edits before sending; record accept/dismiss for quality metrics.
             "Customer" panel is hidden fields-by-permission (e.g. contract value needs crm.financials.read). */
  const CONVOS = [
    ["Lena Kovac", "LK", "p", "Acme Corp", "Can you send the final pricing table for approval…", "2m", "chat", 1, ["SLA 8m", "yellow"]],
    ["Daniel Ortiz", "DO", "g", "Globex", "Invoice INV-2041 shows the wrong VAT number", "14m", "mail", 1, ["VIP", "purple"]],
    ["Priya Nair", "PN", "", "Initech", "How do I add a teammate to the portal?", "38m", "chat", 0, null],
    ["Tom Becker", "TB", "y", "Northwind", "Re: Mobile app v2 release timeline", "1h", "mail", 0, null],
    ["Sara Lund", "SL", "r", "Umbrella Ltd", "Login link expired when I tried to sign in", "2h", "globe", 0, ["Waiting", "blue"]],
    ["Marek Novak", "MN", "g", "Hooli", "Thanks, that solved it!", "3h", "chat", 0, null],
    ["Yuki Tanaka", "YT", "p", "Globex", "Can we change the billing contact?", "5h", "mail", 0, null],
  ];
  function support() {
    const bub = (who, x, t, me) => '<div class="bub-row ' + (me ? "me" : "") + '">' + (me ? "" : AV("LK", "p", "lg")) + '<div class="bub ' + (me ? "agent" : "") + '">' + x + '<small>' + t + "</small></div>" + (me ? AV("AM", "", "lg") : "") + "</div>";
    return '<div class="sp">' +
      '<section class="sp-list"><div class="sp-lh"><b>Your inbox</b><span class="badge">12</span><span style="flex:1"></span><button class="btn ghost sm">' + I("sort", 13) + ' Newest</button></div>' +
      '<div class="pills" style="margin:0;padding:0 12px 8px"><button class="pill active">Open</button><button class="pill">Snoozed</button><button class="pill">Closed</button></div>' +
      '<div class="sp-rows">' + CONVOS.map(function (c, i) {
        return '<div class="cv' + (i === 0 ? " sel" : "") + '">' + AV(c[1], c[2], "lg") + '<div class="cvb"><div class="cvt"><b>' + c[0] + '</b><span>' + c[3] + '</span><i>' + c[5] + '</i></div><div class="cvs">' + c[4] + '</div><div class="cvm">' + I(c[6], 12) + (c[8] ? '<span class="badge ' + c[8][1] + '">' + c[8][0] + "</span>" : "") + "</div></div>" + (c[7] ? '<span class="ud"></span>' : "") + "</div>";
      }).join("") + "</div></section>" +

      '<section class="sp-conv"><header class="sp-ch"><div><b>Lena Kovac</b><small>Acme Corp · Live chat · started 14 min ago</small></div><span style="flex:1"></span>' +
      '<button class="btn sm">' + AV("AM", "", "") + " Anna Meyer " + I("down", 12) + '</button><button class="btn sm">' + I("snooze", 13) + ' Snooze</button><button class="btn primary sm">' + I("check", 13) + " Close</button></header>" +
      '<div class="sp-msgs"><div class="day"><span>Today</span></div>' +
      bub("LK", "Hi! Quick question — the homepage looks great. Can you send the final pricing table for approval?", "10:38 AM") +
      bub("AM", "Hi Lena, absolutely. I'll push it to your client portal so you can approve it there. One moment.", "10:40 AM", 1) +
      '<div class="note-row"><span class="nt">' + I("lock", 12) + ' Internal note</span> Marco: pricing table is ready in the Acme Rebrand project, just needs the final VAT line.<small>Marco Silva · 10:41 AM</small></div>' +
      bub("LK", "Perfect, thank you! And one more thing: can we change the billing contact on the invoice?", "10:43 AM") +
      '<div class="ai-sug"><div class="ai-h">' + I("sparkles", 14) + ' <b>Suggested reply</b><span class="badge">Uses CRM + billing data</span></div><p>"Of course! I can update the billing contact for Acme Corp. Could you share the new name and email? I will apply it to the open invoice INV-2058 and all future ones."</p><div style="display:flex;gap:6px"><button class="btn primary sm">Use reply</button><button class="btn sm">Edit</button><button class="btn ghost sm">Dismiss</button></div></div>' +
      "</div>" +
      '<div class="composer"><div class="c-tabs"><button class="pill active">Reply</button><button class="pill">Note</button><span style="flex:1"></span><span style="color:var(--ash);font-size:12px">Replying via Live chat</span></div><div class="c-in">Write a reply to Lena…</div><div class="c-bar"><button class="btn ghost sm icon">' + I("plus", 15) + '</button><button class="btn ghost sm icon">' + I("smile", 15) + '</button><button class="btn ghost sm icon">' + I("clip", 15) + '</button><button class="btn ghost sm">' + I("zap", 13) + ' Macros</button><button class="btn ghost sm">' + I("book", 13) + ' Help center</button><span style="flex:1"></span><button class="btn primary sm">Send ' + I("send", 13) + "</button></div></div></section>" +

      '<aside class="sp-info"><div class="in-prof">' + AV("LK", "p", "xl") + "<b>Lena Kovac</b><small>lena@acme.example</small><div class=\"badges\"><span class=\"badge purple\">Client user</span><span class=\"badge green\">Active contract</span></div></div>" +
      '<div class="in-sec"><h6>Conversation</h6><div class="kv"><span>Assignee</span><b>Anna Meyer</b></div><div class="kv"><span>Team</span><b>Client success</b></div><div class="kv"><span>Priority</span><b>Normal</b></div><div class="kv"><span>SLA</span><b style="color:var(--yellow)">First reply in 8m</b></div><div class="kv"><span>Tags</span><b><span class="badge">pricing</span> <span class="badge">billing</span></b></div></div>' +
      '<div class="in-sec"><h6>Customer</h6><div class="kv"><span>Company</span><b>Acme Corp ' + I("link", 11) + '</b></div><div class="kv"><span>Local time</span><b>11:46 AM (CET)</b></div><div class="kv"><span>Plan</span><b>Retainer · €4.8k/mo</b></div><div class="kv"><span>Open invoices</span><b>1 (€12,400)</b></div></div>' +
      '<div class="in-sec"><h6>Linked records</h6><a class="lr">' + I("folder", 14) + "<span>Acme Rebrand Website</span><i>Project</i></a><a class=\"lr\">" + st("prog") + "<span>WEB-142 Pricing page hero</span><i>Task</i></a><a class=\"lr\">" + I("dollar", 14) + "<span>INV-2058</span><i>Invoice</i></a><a class=\"lr\">" + I("pen", 14) + "<span>Acme MSA v3</span><i>Contract</i></a>" +
      '<button class="btn sm" style="width:100%;margin-top:8px">' + I("plus", 13) + " Create task from conversation</button></div></aside></div>";
  }

  /* ================= CAMPAIGNS =================
     @screen Campaigns · All campaigns (email + SMS)
     @route  /campaigns (+ ?channel=email|sms&status=), /campaigns/new/email, /campaigns/new/sms, /campaigns/:id (analytics), /campaigns/:id/edit
     @perm   VIEW communications.campaigns.read · create communications.campaigns.create · SEND communications.campaigns.send (sensitive) ·
             approve communications.campaigns.approve (sensitive; separation of duties 01 §96 when approval is required) · analytics communications.analytics.read
     @api    GET /campaigns?channel=&status=&cursor= · POST /campaigns · POST /campaigns/:id/schedule|send|cancel · GET /campaigns/:id/stats
     @mcp    communications_campaigns_read, communications_campaigns_create, communications_campaigns_send (needs human confirmation for AI callers)
     @data   module 11: Campaign (channel, status, audience Segment/CommRecipientList, scheduled_at), CommMessage, CampaignRecipient, CommDailyStat (open/click/delivery),
             CommSuppression + CommConsent (enforced on every send), CommSenderIdentity/CommSenderDomain (EMAIL) and provider account numbers (SMS).
     @ui     Table (sortable), Badge for status, ToggleGroup/Tabs for channel filter, Dialog or full page "campaign builder" (stepper: audience > content > review > schedule).
     @states loading · empty ("Create your first campaign") · error · no-access · provider-not-connected (no sender domain / phone number yet)
     @note   Open/click rates are provider events aggregated into CommDailyStat; show "-" for SMS open. A campaign can only be sent when sender identity is verified
             and the audience is non-empty after suppression. Automated rows ("Automated" status) are Automation (20) journeys, link to them. */
  function campaigns() {
    const rows = [
      ["November product update", "mail", "Sent", "green", "Clients · all", "12,480", "46.2%", "7.1%"],
      ["Black Friday retainer offer", "mail", "Scheduled", "blue", "Leads · warm", "3,920", "—", "—"],
      ["Invoice reminder (SMS)", "sms", "Sent", "green", "Overdue clients", "184", "—", "22.4%"],
      ["Welcome series: new leads", "mail", "Automated", "purple", "New leads", "1,206", "58.9%", "9.8%"],
      ["Project kickoff checklist", "mail", "Draft", "", "Active clients", "—", "—", "—"],
      ["Appointment confirmations", "sms", "Automated", "purple", "Bookings", "432", "—", "31.0%"],
    ];
    return '<div class="page"><div class="page-head"><div><h1>Campaigns</h1><p>Email and SMS to leads, contacts and clients</p></div><div style="display:flex;gap:8px"><button class="btn">' + I("mail", 14) + ' New email</button><button class="btn primary">' + I("sms", 14) + " New SMS</button></div></div>" +
      '<div class="pills"><button class="pill active">All</button><button class="pill">Email</button><button class="pill">SMS</button><button class="pill">Scheduled</button><button class="pill">Automated</button><button class="pill">Drafts</button></div>' +
      '<div class="stats"><div class="stat"><small>Emails sent (30d)</small><strong>48.2k</strong><span>+12.4%</span></div><div class="stat"><small>Avg open rate</small><strong>41.8%</strong><span>+2.1 pts</span></div><div class="stat"><small>Avg click rate</small><strong>6.2%</strong><span>+0.4 pts</span></div><div class="stat"><small>SMS delivered</small><strong>3,412</strong><span>99.1% delivery</span></div></div>' +
      '<div class="panel"><div class="panel-head"><b>All campaigns</b><span class="badge">6 shown</span></div><div class="tbl-scroll"><table><thead><tr><th>Campaign</th><th>Channel</th><th>Status</th><th>Audience</th><th>Recipients</th><th>Open</th><th>Click</th></tr></thead><tbody>' +
      rows.map((r) => '<tr><td><div class="name">' + I(r[1], 15) + r[0] + "</div></td><td>" + (r[1] === "mail" ? "Email" : "SMS") + '</td><td><span class="badge ' + r[3] + '"><span class="dot"></span>' + r[2] + "</span></td><td>" + r[4] + "</td><td>" + r[5] + "</td><td>" + r[6] + "</td><td>" + r[7] + "</td></tr>").join("") +
      "</tbody></table></div></div></div>";
  }

  /* ================= placeholder for apps not yet mocked =================
     @note Apps without a design yet (CRM, Proposals, Contracts, Client portal, Billing, Expenses, People, Docs, Files, Automation, Time, Calendar).
           Do NOT implement from this placeholder: wait for the mockup (which will follow the schema-first rule). */
  function placeholder(app) {
    return '<div class="page"><div class="page-head"><div><h1>' + app.panel.title + '</h1><p>Mockup not built yet</p></div><button class="btn primary">' + I("plus", 14) + " " + app.newLabel + '</button></div>' +
      '<div class="panel" style="padding:48px;text-align:center;border-style:dashed;background:transparent"><div style="color:var(--mute);margin-bottom:6px">' + I(app.icon, 28) + '</div><b style="color:var(--ink)">' + app.label + '</b><p style="color:var(--ash);margin-top:4px">This app gets its own layout, like Tasks, Messages and Support. Sections: ' +
      app.panel.blocks[0].items.map((i) => i.l).join(" · ") + ".</p></div></div>";
  }

  window.VIEWS = {
    messages: { html: messages, fill: 1 },
    support: { html: support, fill: 1 },
    campaigns: { html: campaigns },
    placeholder: placeholder,
  };
})();
