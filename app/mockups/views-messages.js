/* =====================================================================================================================
   MESSAGES APP — module 12 (docs/features/12-messaging-team-communication.md). Slack-like team chat, DMs, client channels, huddles, retention and admin.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma (33 tables): MessagingSettings, MessagingRetentionPolicy, ChannelTemplate, Channel, ChannelMember, ChannelNotificationSetting, ChannelMemberRestriction, Message, MessageVersion,
   MessageReaction, MessageMention, MessageAttachment, MessageLinkPreview, MessageRecordShare, MessageAcknowledgement, ChannelReadState, MessageReadReceipt, MessageThreadFollower, ChannelPin, SavedMessage, MessageReminder,
   MessageDraft, MessagingKeyword, ChannelSection, ChannelSectionItem, MessagingPresence, MessagingMemberSettings, MessageReport, MessagingExportJob, MessagingIntegration, ChannelCall, ChannelCallParticipant, MessagingUsageDaily.
   Enums are the real values: ChannelKind (PUBLIC, PRIVATE, DIRECT, GROUP_DIRECT, PROJECT, CUSTOMER, ANNOUNCEMENT, RECORD), ChannelVisibility (DISCOVERABLE, HIDDEN), ChannelStatus (ACTIVE, ARCHIVED, DELETED), ChannelPostingPolicy
   (ALL_MEMBERS, INTERNAL_MEMBERS_ONLY, ADMINS_ONLY, OWNERS_ONLY), ChannelMemberRole (OWNER, ADMIN, MEMBER, GUEST, EXTERNAL, READ_ONLY), ChannelMembershipSource, ChannelGuestKind (SINGLE_CHANNEL, MULTI_CHANNEL, CUSTOMER, PARTNER,
   TEMPORARY), ChannelNotificationLevel (ALL_MESSAGES, MENTIONS_AND_DIRECT, DIRECT_ONLY, NOTHING, CUSTOM), ChannelDigestFrequency, MessageKind (USER, SYSTEM, INTEGRATION, VOICE), MessageVisibility (INTERNAL, EXTERNAL),
   MessageDeliveryStatus (SCHEDULED, SENDING, SENT, DELIVERED, FAILED, RETRYING, DELETED), MessageMentionKind, MessageAttachmentKind, MessagingPresenceState, MessageReminderStatus, MessagingRetentionScope/Action,
   MessagingExportStatus/Format, MessageReportStatus, ChannelRestrictionKind (MUTED, BANNED), MessagingIntegrationKind/Status, ChannelCallKind (VOICE, VIDEO, HUDDLE), ChannelCallStatus, ChannelTemplateTrigger.
   Permission keys (catalog, 15): messaging.channels.read/create/manage · messaging.messages.read/post/pin/delete_any* · messaging.channel_members.manage · messaging.external_users.manage* · messaging.users.manage ·
   messaging.settings.manage* · messaging.retention.manage* · messaging.integrations.manage* · messaging.audit.read* · messaging.data.export*  (* = sensitive). Missing keys are listed in gaps-12.md and marked @gap below.
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - A channel is visible only to members (private/hidden), to everyone with messaging.channels.read (PUBLIC + DISCOVERABLE) or to its external participants. A DIRECT / GROUP_DIRECT channel is identified by Channel.dm_key (sorted member ids), never created twice.
     - Authors are Membership (internal) or an external User (Message.author_user_id / ChannelMember.external_user_id, customer-portal users, 07). External people always carry a visible marker (ChannelMember.external_label, role EXTERNAL/GUEST).
     - MessageVisibility INTERNAL messages (internal notes) in a channel with external participants are NEVER delivered to them: filtered on the server in REST, realtime, search, export and notifications.
     - Realtime: one WebSocket/SSE room per channel; unread = ChannelReadState (unread_count, mention_count, marked_unread_from_id); optimistic send with Message.client_message_id for de-duplication and the delivery states
       SENDING > SENT > DELIVERED / FAILED > RETRYING.
     - Edits write MessageVersion rows (if MessagingSettings.preserve_edit_history); deletes keep a tombstone (deleted_at, delete_reason) so threads stay readable; retention (MessagingRetentionPolicy) may ARCHIVE or DELETE later.
     - Cross-module links: shared records use MessageRecordShare (snapshot, re-checked against the viewer's permission on open), Convert-to-task uses a TaskLink (entity_type MESSAGE, 06) and Create-ticket creates a Ticket (13).
     - Automation/bots post as MessageKind INTEGRATION through a MessagingIntegration (service account, 20); system events (joins, call started, archive) are MessageKind SYSTEM with Message.system_event.
     - Dev stage: no real data; sample data below only illustrates fields. Light and dark themes use semantic tokens only.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const gap = (h) => '<div style="height:12px"></div>' + h;
  const setting = (t, s, ctl) => '<div class="rowx"><div class="grow"><b>' + t + "</b><small>" + s + "</small></div>" + ctl + "</div>";
  const FB = (chips, extra) => window.UI.filters.filterBar(chips, extra);
  const pill = (arr, on) => '<div class="mg-pills">' + arr.map((t, i) => '<span class="pill' + (i === (on || 0) ? " active" : "") + '">' + t + "</span>").join("") + "</div>";
  const page = (h) => '<div class="mg-page"><div class="a-page">' + h + "</div></div>";
  const ink = (t) => '<span class="ink">' + t + "</span>";

  /* ext = external participant (customer portal user): always shown with a "Client" marker */
  const P = {
    AM: ["Anna Meyer", "", "Project lead"], MS: ["Marco Silva", "g", "Designer"], SJ: ["Sofia Jensen", "y", "Engineer"], JK: ["Jonas Koch", "r", "Engineer"], KL: ["Kim Lund", "p", "Account manager"],
    LK: ["Lena Kovac", "p", "Acme Corp", 1], DW: ["Dana Whitfield", "y", "Acme Corp", 1],
  };
  const av = (k, sz, pres) => AV(k, P[k][1], sz || "", pres);
  const wh = (k, sub) => who(k, P[k][1], P[k][0], sub === undefined ? P[k][2] : sub);
  const nm = (k) => P[k][0];

  /* ---------- kind helpers ---------- */
  const KIND_IC = { PUBLIC: "hash", PRIVATE: "lock", DIRECT: "chat", GROUP_DIRECT: "users", PROJECT: "folder", CUSTOMER: "globe", ANNOUNCEMENT: "flag", RECORD: "link" };
  const kindBadge = (k) => E(k, k === "CUSTOMER" ? "purple" : k === "PROJECT" ? "blue" : k === "ANNOUNCEMENT" ? "yellow" : "");
  const chName = (n, k) => '<span class="mg-chn">' + (k === "PUBLIC" || !k ? '<span class="pre">#</span>' : I(KIND_IC[k], 14)) + n + "</span>";

  /* @impl msg(): ONE message row. Hover toolbar (React, Reply in thread, Save, More) is shown on hover/focus; `show` keeps it open for documentation. Author = Membership or external User. The row anatomy is the
       contract for the Message API: kind, visibility, status, body (+body_rich), is_edited, pinned_at, reaction_count, reply_count, has_attachments, has_links, has_record_shares, requires_acknowledgement. */
  const rx = (arr) => arr ? '<div class="re">' + arr.map((r) => '<span class="r' + (r[2] ? " me" : "") + '" title="MessageReaction · ' + r[1] + ' reaction(s)">' + r[0] + " " + r[1] + "</span>").join("") + '<span class="r add" title="Add reaction">' + I("smile", 13) + "</span></div>" : "";
  const att = (n, meta, kind, ic) => '<div class="attach" title="MessageAttachment kind ' + kind + '">' + I(ic || "file", 20) + "<div><b>" + n + "</b><small>" + meta + '</small></div><span class="grow"></span><button class="btn ghost sm icon">' + I("down", 14) + "</button></div>";
  const img = (n, meta) => '<div class="mg-img" title="MessageAttachment kind IMAGE · preview">' + I("file", 22) + "<span>" + n + "</span><small>" + meta + "</small></div>";
  const lp = (dom, t, d) => '<div class="mg-lp" title="MessageLinkPreview status RESOLVED"><small>' + dom + "</small><b>" + t + "</b><span>" + d + "</span></div>";
  const rec = (ic, t, s, m) => '<div class="bcard" title="MessageRecordShare · snapshot, viewer permission re-checked"><div class="bc-h">' + I(ic, 14) + "<b>" + t + "</b></div><div class="+'"bc-t"'+">" + s + '</div><div class="bc-m">' + m + "</div></div>";
  const voice = (sec) => '<div class="mg-voice" title="MessageKind VOICE · MessageAttachment kind VOICE_MESSAGE"><button class="btn sm icon primary">' + I("video", 13) + "</button><span class=\"mg-wave\">" + [4, 9, 6, 12, 8, 14, 7, 10, 5, 13, 9, 6, 11, 4, 8, 12, 7, 5, 9, 6].map((h) => '<i style="height:' + h + 'px"></i>').join("") + "</span><small>" + sec + "</small></div>";
  const tools = '<div class="mg-tools">' + ["smile", "reply", "star", "clock", "pin", "more"].map((i) => '<button class="btn ghost sm icon">' + I(i, 14) + "</button>").join("") + "</div>";
  const stIc = { SENDING: "clock", SENT: "check", DELIVERED: "check", FAILED: "x" };
  function msg(o) {
    const ext = o.a && P[o.a] && P[o.a][3];
    const name = o.app || nm(o.a);
    const avh = o.app ? AV(o.ic || "⚡", "n", "lg sq") : AV(o.a, P[o.a][1], "lg sq");
    const tags = (ext ? '<span class="badge purple" title="ChannelMember.role EXTERNAL · external_label">Client · ' + P[o.a][2] + "</span>" : "") + (o.app ? '<span class="badge" title="MessageKind INTEGRATION">App</span>' : "") +
      (o.int ? '<span class="badge yellow" title="MessageVisibility INTERNAL · never delivered to external participants">' + I("lock", 11) + " Internal note</span>" : "") +
      (o.ann ? '<span class="badge blue" title="Message.is_announcement">Announcement</span>' : "") +
      (o.pin ? '<span class="badge" title="Message.pinned_at · ChannelPin">' + I("pin", 11) + " Pinned</span>" : "");
    const status = o.st ? '<span class="mg-st ' + (o.st === "FAILED" ? "bad" : "") + '" title="MessageDeliveryStatus ' + o.st + '">' + I(stIc[o.st] || "check", 11) + " " + U.en(o.st) + "</span>" : "";
    return '<div class="m' + (o.show ? " show" : "") + (o.hl ? " hl" : "") + (o.int ? " int" : "") + (o.tomb ? " tomb" : "") + '" id="' + (o.id || "") + '">' + avh + '<div class="mb"><div class="mh"><b>' + name + "</b>" + tags + '<span class="tm">' + o.t + "</span>" + (o.edit ? '<span class="tm" title="Message.is_edited, edited_at · MessageVersion history">(edited)</span>' : "") + status + "</div>" +
      (o.quote ? '<div class="mg-quote" title="Message.quoted_message_id"><b>' + o.quote[0] + "</b> " + o.quote[1] + "</div>" : "") + (o.fwd ? '<div class="mg-quote" title="Message.forwarded_from_message_id">' + I("reply", 12) + " Forwarded from <b>" + o.fwd + "</b></div>" : "") +
      '<div class="mt">' + o.x + "</div>" + (o.more || "") + rx(o.re) +
      (o.ack ? '<div class="mg-ack" title="Message.requires_acknowledgement · MessageAcknowledgement">' + I("check", 13) + " <b>" + o.ack[0] + " of " + o.ack[1] + "</b> acknowledged " + (o.ack[2] ? '<span class="badge green">You acknowledged</span>' : btn("Acknowledge", "check", "sm primary")) + "</div>" : "") +
      (o.th ? '<button class="thr" title="Message.reply_count, last_reply_at · MessageThreadFollower">' + o.th[1].map((k) => av(k)).join("") + "<b>" + o.th[0] + " replies</b><span>Last reply " + o.th[2] + "</span>" + (o.th[3] ? '<span class="badge blue">Following</span>' : "") + "</button>" : "") +
      (o.menu || "") + "</div>" + tools + "</div>";
  }
  const sys = (ic, t, tm, extra) => '<div class="mg-sys" title="MessageKind SYSTEM · Message.system_event">' + I(ic, 13) + "<span>" + t + '</span><small>' + tm + "</small>" + (extra || "") + "</div>";
  const day = (t) => '<div class="day"><span>' + t + "</span></div>";
  const newline = '<div class="mg-new" title="ChannelReadState.last_read_message_id"><span>New messages</span></div>';

  /* the message action menu (spec §64). Permission per action is in the title. */
  const MENU = [
    ["smile", "Add reaction…", "", "messaging.messages.read"], ["reply", "Reply in thread", "R", "messaging.messages.post"], ["link", "Forward…", "", "messaging.messages.post"], ["star", "Save for later", "S", "own SavedMessage"],
    ["clock", "Remind me…", "", "own MessageReminder"], ["pin", "Pin to channel", "P", "messaging.messages.pin"], ["---"], ["edit", "Edit message", "E", "author, within edit_time_limit_minutes"], ["x", "Delete message", "", "author (allow_delete_own_messages) or messaging.messages.delete_any*"],
    ["link", "Copy link to message", "", "messaging.messages.read"], ["inbox", "Mark unread from here", "U", "own ChannelReadState"], ["---"], ["tasks", "Convert to task…", "", "tasks.tasks.create"], ["support", "Create ticket…", "", "support.tickets.create"],
    ["file", "Share to record…", "", "target record permission"], ["flag", "Report message", "", "any member"],
  ];
  const menu = '<div class="mg-menu" role="menu">' + MENU.map((m) => (m[0] === "---" ? '<hr/>' : '<button title="' + m[3] + '">' + I(m[0], 14) + "<span>" + m[1] + "</span><kbd>" + m[2] + "</kbd></button>")).join("") + "</div>";

  /* @impl composer(): rich-text composer (Tiptap), Markdown shortcuts, slash menu, mentions popover, attachments tray, formatting bar, visibility switch in channels with external people, schedule send, voice message. */
  const mentionPop = '<div class="mg-pop" title="MessageMention kinds MEMBER · TEAM · ROLE · CHANNEL · EVERYONE · CHANNEL_LINK · EXTERNAL_USER"><div class="mg-pop-h">People, teams and channels matching “ma”</div>' +
    '<button class="on">' + av("MS", "", "on") + "<b>Marco Silva</b><small>Designer · MEMBER</small></button>" + '<button>' + av("AM", "", "on") + "<b>Anna Meyer</b><small>Project lead · MEMBER</small></button>" +
    '<button><span class="mg-ico">' + I("users", 14) + "</span><b>@marketing</b><small>TEAM · 6 members</small></button>" + '<button><span class="mg-ico">' + I("at", 14) + "</span><b>@channel</b><small>CHANNEL · notifies 8 members · needs broadcast_mention_policy</small></button></div>";
  function composer(ph, o) {
    o = o || {};
    const fm = ["<b>B</b>", "<i>I</i>", "<s>S</s>", "&lt;/&gt;", I("link", 14), I("list", 14), "&ldquo;", "```"].map((x) => '<button class="btn ghost sm icon" tabindex="-1">' + x + "</button>").join("");
    return '<div class="composer mg-comp' + (o.dis ? " dis" : "") + '" style="' + (o.flush ? "margin:0 12px 12px" : "") + '">' + (o.pop ? mentionPop : "") +
      (o.dis ? '<div class="mg-dis">' + I("lock", 15) + "<div><b>" + o.dis[0] + "</b><small>" + o.dis[1] + "</small></div>" + btn("Request to post", "", "sm") + "</div>" :
        '<div class="mg-fmt">' + fm + "</div>" + '<div class="c-in" title="Message.body (Markdown) · body_rich (editor JSON) · MessageDraft autosaved every few seconds">' + (o.text || ph) + "</div>" +
        (o.files ? '<div class="mg-files">' + o.files.map((x) => '<span class="mg-file">' + I("file", 13) + x + " " + I("x", 12) + "</span>").join("") + "</div>" : "") +
        (o.vis ? '<div class="mg-vis" title="Message.visibility"><span class="seg on">' + I("globe", 12) + ' External · visible to Lena Kovac and Dana Whitfield</span><span class="seg">' + I("lock", 12) + " Internal note</span></div>" : "") +
        '<div class="c-bar"><button class="btn ghost sm icon" title="Attach (Documents 17, MessageAttachment)">' + I("plus", 15) + '</button><button class="btn ghost sm icon">' + I("smile", 15) + '</button><button class="btn ghost sm icon">' + I("at", 15) + '</button><button class="btn ghost sm icon" title="Voice message (voice_messages_enabled)">' + I("video", 15) + '</button><button class="btn ghost sm icon" title="Share a record (MessageRecordShare)">' + I("link", 15) + "</button>" +
        (o.also ? '<label class="mg-also">' + cb(1) + " Also send to #acme-rebrand</label>" : "") + '<span style="flex:1"></span>' + (o.ai ? '<button class="btn ghost sm">' + I("sparkles", 14) + " Draft with AI</button>" : "") +
        '<button class="btn sm" title="Schedule send · Message.scheduled_for, status SCHEDULED">' + I("clock", 14) + '</button><button class="btn primary sm" title="Send · Ctrl+Enter">' + I("send", 14) + "</button></div>") + "</div>";
  }

  /* channel header + tabs */
  function chHead(c) {
    return '<header class="ms-h"><div class="grow"><div class="ms-name">' + chName(c.name, c.kind) + " " + kindBadge(c.kind) + (c.shared ? ' <span class="badge purple" title="Channel.external_access_enabled">' + I("globe", 11) + " Shared with " + c.shared + "</span>" : "") + (c.conf ? ' <span class="badge red" title="Channel.is_confidential">' + I("lock", 11) + " Confidential</span>" : "") +
      '<button class="btn ghost sm icon" title="Favorite · ChannelMember.is_favorite">' + I("star", 14) + '</button></div><div class="ms-topic" title="Channel.topic">' + c.topic + "</div></header>";
  }
  const hdrRight = (c) => '<div class="mg-hr"><div class="avs">' + c.avs.map((k) => av(k)).join("") + '</div><button class="btn sm" title="Members · ChannelMember">' + I("users", 13) + " " + c.count + '</button><button class="btn sm" title="ChannelCall kind HUDDLE · calls_enabled">' + I("video", 13) + " Huddle</button><button class=\"btn ghost sm icon\" title=\"Search in channel\">" + I("search", 14) + '</button><button class="btn ghost sm icon" title="Conversation info · Channel.settings">' + I("panel", 14) + '</button><button class="btn ghost sm icon" title="Channel settings">' + I("settings", 14) + "</button></div>";
  function channel(c) {
    const hd = '<header class="ms-h"><div class="grow"><div class="ms-name">' + chName(c.name, c.kind) + " " + kindBadge(c.kind) + (c.shared ? ' <span class="badge purple" title="Channel.external_access_enabled">' + I("globe", 11) + " Shared with " + c.shared + "</span>" : "") + (c.conf ? ' <span class="badge red" title="Channel.is_confidential">' + I("lock", 11) + " Confidential</span>" : "") +
      '<button class="btn ghost sm icon" title="Favorite · ChannelMember.is_favorite">' + I("star", 14) + '</button></div><div class="ms-topic" title="Channel.topic">' + c.topic + "</div></div>" + hdrRight(c) + "</header>";
    const tb = '<div class="ms-tabs">' + c.tabs.map((t, i) => '<button class="pill' + (i === 0 ? " active" : "") + '">' + t + "</button>").join("") + "</div>";
    const pinbar = c.pins ? '<div class="mg-pinbar" title="ChannelPin (sort_order)">' + I("pin", 13) + "<b>" + c.pins[0] + " pinned</b><span>" + c.pins[1] + "</span><a>See all</a></div>" : "";
    const body = '<div class="ms-scroll">' + c.msgs + (c.foot ? '<div class="mg-foot">' + c.foot + "</div>" : "") + "</div>" + (c.typing ? '<div class="mg-typing"><span class="dots"><i></i><i></i><i></i></span>' + c.typing + " is typing…</div>" : "") + c.comp;
    const side = c.thread ? '<aside class="ms-thread">' + c.thread + "</aside>" : c.info ? '<aside class="ms-thread mg-info">' + c.info + "</aside>" : "";
    return '<div class="ms' + (side ? "" : " one") + '"><section class="ms-main">' + (c.banner ? '<div class="mg-banner ' + (c.bannerCls || "") + '">' + c.banner + "</div>" : "") + hd + tb + pinbar + body + "</section>" + side + "</div>";
  }

  /* =====================================================================================================================
     CHANNEL VIEW · project channel shared with a client, with the THREAD PANEL open (spec §6, §9-12, §14-15, §27-28, §47, §64)
     @screen Messages · #acme-rebrand
     @route  /messages/c/:channelId · /messages/c/:channelId/t/:messageId (thread panel open) · /messages/c/:channelId/m/:messageId (permalink, scrolls to and highlights the message, spec §65)
     @perm   VIEW messaging.channels.read + membership (private/hidden channels invisible otherwise) · messages.read · POST messaging.messages.post (and Channel.posting_policy) · pin messaging.messages.pin · delete others'
             messaging.messages.delete_any* · members/roles messaging.channel_members.manage · channel settings messaging.channels.manage · external participants need messaging.external_users.manage* to be added
     @api    GET /channels/:id/messages?before=&after=&around=&limit= (cursor, newest last; visibility EXTERNAL only for external callers) · POST /channels/:id/messages {body, body_rich, visibility, parent_message_id?, quoted_message_id?,
             attachment_document_ids[], client_message_id, scheduled_for?} · PUT/DELETE /messages/:id/reactions/:emoji · POST /channels/:id/read {last_read_message_id} · realtime room per channel: message.created|updated|deleted,
             reaction.changed, typing, presence, read
     @mcp    messaging_channels_read · messaging_messages_read · messaging_messages_post (sensitive tools need human confirmation when an AI agent calls them)
     @data   Channel (kind PROJECT, project_id, company_id, external_access_enabled, topic, posting_policy, member_count, message_count, last_message_at) · ChannelMember (role, external_label) · Message (kind, visibility, status, reply_count,
             is_edited, pinned_at, reaction_count, has_attachments) · MessageReaction · MessageMention · MessageAttachment (document_id, 17) · MessageLinkPreview · MessageRecordShare · ChannelPin · ChannelReadState ·
             MessageThreadFollower · MessageDraft · ChannelCall · MessagingPresence
     @ui     ScrollArea anchored to bottom (virtualized, load older on scroll up, jump to unread), Avatar with presence dot, Badge, Popover+Command (emoji picker, mention autocomplete), DropdownMenu (message actions), Tiptap composer,
             ToggleGroup (External / Internal note), Sheet-like right aside (thread), Tabs, Tooltip, shadcn Dialog for confirmations
     @states loading (skeleton rows) · empty channel (first-message prompt, template pins) · error + offline banner (unsent messages queue, FAILED with Retry) · no-access (403 or 404 for hidden channels) · archived (composer replaced by banner)
     @audit  message edited/deleted (delete_reason), pin/unpin, member added/removed, external access toggled, channel archived: all audit_events; reads are not audited
     @note   The yellow "Internal note" row is MessageVisibility INTERNAL: the client never receives it (server filter). The composer defaults to External in a shared channel and shows who will see the message, so staff cannot
             leak internal content by accident. The "App" row comes from Automation (20) via a MessagingIntegration; its record card is a MessageRecordShare snapshot and re-checks tasks.tasks.read of the viewer on open.
             The open menu on the highlighted message lists every action of spec §64 with its permission in the tooltip.
     ===================================================================================================================== */
  function acme() {
    const file = att("Homepage-v3-final.fig", "Figma export · 4.2 MB · DOCUMENT", "DOCUMENT", "file");
    const task = rec("tasks", "WEB-142 moved to In progress", "Rebuild pricing page hero with new brand system", "<span>Assigned to Marco Silva</span><span>·</span><span>Due Nov 14</span><span>·</span><span>snapshot 9:15 AM</span>");
    const msgs = day("Yesterday") +
      msg({ a: "LK", t: "4:12 PM", x: "Hi team! We reviewed the homepage concept with our leadership and have a few notes on the hero section. Can we hop on a call tomorrow?", re: [["👍", 3], ["👀", 1]] }) +
      msg({ a: "AM", t: "4:20 PM", x: 'Absolutely. I’ll book it via the calendar link. <span class="mention">@Marco</span> can you join as well?', re: [["✅", 2]] }) +
      msg({ a: "KL", t: "4:31 PM", int: 1, x: "Heads-up for the team: leadership wants the pricing table on the homepage. Do not promise the Nov 14 date yet, finance has not approved the extra scope (CR-12)." }) +
      day("Today") +
      msg({ a: "MS", t: "9:02 AM", x: "Updated the hero based on yesterday’s feedback. Sharing the latest export 👇", more: img("hero-v3.png", "IMAGE · 1.8 MB") + file, re: [["🔥", 2, 1], ["✅", 1]], th: [4, ["AM", "SJ", "LK"], "today at 10:41", 1], show: 1, hl: 1, pin: 1,
        menu: menu }) +
      msg({ app: "Automation", ic: "⚡", t: "9:15 AM", x: "Task status changed", more: task }) +
      sys("video", "<b>Marco Silva</b> started a huddle · 24 min · 4 participants", "9:40 AM", '<button class="btn sm">View call</button>') +
      newline +
      msg({ a: "LK", t: "10:38 AM", x: "Looks great, much closer to what we imagined. Could you send the final pricing table for approval in the portal?", more: lp("portal.logiqdev.app", "Pricing table · awaiting approval", "Customer Portal · Approvals"), re: [["🙏", 1]] }) +
      msg({ a: "AM", t: "10:44 AM", st: "DELIVERED", x: "Will do, sending it to the portal this afternoon.", re: null }) +
      '<div class="mg-sched" title="Message.status SCHEDULED · scheduled_for">' + I("clock", 13) + " <b>1 scheduled message</b> · Tomorrow 9:00 AM · “Reminder: portal approval due Friday”" + btn("Edit", "", "sm ghost") + "</div>";
    const thread = '<div class="th-h"><b>Thread</b><small>#acme-rebrand</small><button class="btn ghost sm icon" style="margin-left:auto" title="Follow thread · MessageThreadFollower (muted, last_read_at)">' + I("bell", 15) + '</button><button class="btn ghost sm icon">' + I("x", 15) + "</button></div>" +
      '<div class="th-body">' + msg({ a: "MS", t: "9:02 AM", x: "Updated the hero based on yesterday’s feedback. Sharing the latest export 👇", more: file }) + '<div class="day"><span>4 replies</span></div>' +
      msg({ a: "AM", t: "9:20 AM", x: "Love the new gradient. Contrast on the CTA is still a bit low on mobile." }) + msg({ a: "MS", t: "9:31 AM", x: "Good catch, fixing now.", edit: 1 }) +
      msg({ a: "SJ", t: "9:50 AM", int: 1, x: "Internal: the token for the CTA is <code>--brand-600</code>, already in the design system." }) + msg({ a: "LK", t: "10:38 AM", x: "Looks great, much closer to what we imagined." }) + "</div>" +
      '<div class="mg-follow">' + av("AM") + av("SJ") + av("LK") + "<small>3 following · Message.reply_count 4</small></div>" + composer("Reply…", { flush: 1, also: 1 });
    return channel({ name: "acme-rebrand", kind: "PROJECT", shared: "Acme Corp", topic: "Brand refresh and new marketing site · Linked project: Acme Rebrand Website · Customer: Acme Corp", avs: ["AM", "MS", "SJ", "LK"], count: 8,
      tabs: ["Messages", "Files · 14", "Pins · 2", "Tasks · 6", "Calls · 3"], pins: [2, "Brand guidelines v2 · Pricing table scope (CR-12)"], typing: "Marco Silva", msgs, thread,
      foot: dm(["Channel · kind PROJECT, project_id, company_id, external_access_enabled, topic, posting_policy, member_count", "ChannelMember · role, external_label · Message · kind, visibility, status, reply_count, is_edited, pinned_at, reaction_count", "MessageReaction · MessageMention · MessageAttachment · MessageLinkPreview · MessageRecordShare · ChannelPin · ChannelReadState · MessageThreadFollower · MessageDraft · ChannelCall"], []),
      comp: composer("Message #acme-rebrand", { pop: 1, vis: 1, text: 'Thanks <span class="mention">@Marco</span>, can you also check the ma', files: ["pricing-notes.pdf · 240 KB"], ai: 1 }) });
  }

  /* =====================================================================================================================
     CHANNEL VIEW · public internal channel with bots, formatting, quoting, failed send and the CONVERSATION INFO panel (spec §10-13, §37-38, §91-92, §103)
     @screen Messages · #dev (public channel, info panel open)
     @route  /messages/c/:channelId?panel=info
     @perm   VIEW messaging.channels.read · POST messaging.messages.post · pin messaging.messages.pin · edit/delete own (MessagingSettings.allow_delete_own_messages, delete_own_time_limit_minutes, edit_time_limit_minutes) ·
             deleted by an admin messaging.messages.delete_any* (tombstone with delete_reason) · integrations messaging.integrations.manage*
     @api    GET /channels/:id/messages · POST /channels/:id/messages · PATCH /messages/:id (writes MessageVersion) · DELETE /messages/:id {reason} · POST /messages/:id/retry (FAILED > RETRYING) · GET /channels/:id/info (members,
             pins, files, shared records, integrations)
     @mcp    messaging_messages_read · messaging_messages_post · messaging_channels_read
     @data   Message (kind INTEGRATION, integration_id, integration_source, external_event_id, quoted_message_id, deleted_at, delete_reason, status FAILED) · MessagingIntegration (kind GITHUB, bot_display_name) · MessageVersion ·
             MessageAttachment · ChannelPin · ChannelMember · ChannelNotificationSetting
     @ui     Same as the project channel plus Sheet/aside (info panel with Accordion sections), code block with copy button, Alert (offline/failed), Tooltip on delivery state
     @states loading · empty · offline (queue, "1 message not sent. Retry") · no-access · channel archived
     @audit  admin delete (who, reason), edit history opened, integration posting rate-limited (MessagingSettings.rate_limits)
     @note   A message deleted by an admin leaves a tombstone so the thread stays readable; the body is purged by retention later. Integration messages (GitHub) are MessageKind INTEGRATION, de-duplicated by
             external_event_id. The info panel mirrors spec §103: description, topic, members, pins, files, shared records, notification settings, integrations.
     ===================================================================================================================== */
  function dev() {
    const code = '<pre class="mg-code"><code>pnpm --filter api test -- stripe-webhook\n✓ retries 3 times with backoff\n✗ dedupes by external_event_id</code></pre>';
    const msgs = day("Today") +
      msg({ a: "SJ", t: "8:41 AM", x: "Stripe webhook retries are flaky on CI. Repro below, I think the dedupe key is wrong.", more: code, re: [["👀", 2], ["🐛", 1]], th: [3, ["JK", "AM"], "8:55 AM"] }) +
      msg({ app: "GitHub", ic: "⚡", t: "8:47 AM", x: "<b>Pull request opened</b> #482 fix(api): dedupe webhook by external_event_id", more: rec("link", "logiqdev/os · #482", "fix(api): dedupe webhook by external_event_id", "<span>+42 −7</span><span>·</span><span>Review requested: Jonas Koch</span>") }) +
      msg({ a: "JK", t: "9:03 AM", x: "I can take the review.", quote: ["Sofia Jensen", "Stripe webhook retries are flaky on CI…"], edit: 1, re: [["👍", 1]] }) +
      msg({ a: "AM", t: "9:12 AM", tomb: 1, x: '<i class="mg-del">' + I("x", 12) + " This message was deleted by an admin. Reason: contained a customer email address.</i>" }) +
      msg({ a: "MS", t: "9:20 AM", st: "FAILED", x: "Design tokens for dark mode are merged, see the file list in the release notes.", more: '<div class="mg-fail">' + I("x", 13) + " Not sent. Network lost while sending (client_message_id c7f2…). " + btn("Retry", "", "sm primary") + btn("Delete", "", "sm ghost") + "</div>" }) +
      msg({ a: "KL", t: "9:31 AM", fwd: "#general · Anna Meyer", x: "Forwarding for context before the planning call." });
    const info = '<div class="th-h"><b>Details</b><small>#dev</small><button class="btn ghost sm icon" style="margin-left:auto">' + I("x", 15) + '</button></div><div class="th-body">' +
      '<div class="mg-ih">About</div><div class="mg-ip" title="Channel.description, purpose">Engineering chat for the Web and Mobile teams. Use threads for bugs, post build info and PR links here.</div>' + kv("Topic", "Sprint 14 · release Nov 22") + kv("Kind / visibility", kindBadge("PUBLIC") + " " + E("DISCOVERABLE")) + kv("Owner", "Anna Meyer") + kv("Created", "Jan 9, 2025 by Anna Meyer") + kv("Team", "Web · WEB") + kv("Retention", "Org default · 3 years") +
      '<div class="mg-ih">Members <span>24</span></div><div class="rowx" style="padding:4px 0">' + ["AM", "MS", "SJ", "JK", "KL"].map((k) => av(k)).join("") + '<span class="muted">+19</span></div>' +
      '<div class="mg-ih">Pinned <span>3</span></div><div class="mg-ip">Release checklist · On-call rota · Style guide</div>' +
      '<div class="mg-ih">Files <span>41</span></div><div class="mg-ip">release-notes-nov.pdf · tokens.json · repro.har</div>' +
      '<div class="mg-ih">Shared records <span>5</span></div><div class="mg-ip">WEB-139 · WEB-142 · PR #482</div>' +
      '<div class="mg-ih">Integrations <span>2</span></div><div class="mg-ip">GitHub (ACTIVE) · Deploy hook (INBOUND_WEBHOOK)</div>' +
      '<div class="mg-ih">Your notifications</div>' + kv("Level", E("MENTIONS_AND_DIRECT", "blue")) + kv("Thread replies", "On") + kv("Muted until", "—") + btn("Notification settings", "bell", "sm") + "</div>";
    return channel({ name: "dev", kind: "PUBLIC", topic: "Sprint 14 · release Nov 22 · on-call: Jonas Koch", avs: ["AM", "MS", "SJ", "JK"], count: 24, tabs: ["Messages", "Files · 41", "Pins · 3", "Tasks · 12"], pins: [3, "Release checklist · On-call rota"], msgs, info,
      foot: dm(["Message · kind INTEGRATION, integration_id, external_event_id, quoted_message_id, forwarded_from_message_id, deleted_at, delete_reason, status", "MessageVersion · MessagingIntegration · ChannelPin · ChannelNotificationSetting"], []),
      comp: composer("Message #dev", { text: "Here is the fix: <code>dedupe(external_event_id)</code>", ai: 1 }) });
  }

  /* =====================================================================================================================
     CHANNEL VIEW · announcement channel (spec §29, §49)
     @screen Messages · #announcements (posting restricted, acknowledgements)
     @route  /messages/c/:channelId (kind ANNOUNCEMENT)
     @perm   VIEW messaging.channels.read · POST only if Channel.posting_policy allows (ADMINS_ONLY here: channel ADMIN/OWNER or messaging.channels.manage) · acknowledge: any member · broadcast mentions follow
             MessagingSettings.broadcast_mention_policy and announcement_policy
     @api    POST /channels/:id/messages {is_announcement, requires_acknowledgement} · POST /messages/:id/acknowledge · GET /messages/:id/acknowledgements (who has / has not)
     @mcp    messaging_messages_post (posting policy enforced server-side)
     @data   Channel (kind ANNOUNCEMENT, posting_policy ADMINS_ONLY, require_acknowledgement) · Message (is_announcement, requires_acknowledgement) · MessageAcknowledgement (membership_id, acknowledged_at) · ChannelPin
     @ui     Alert (posting restriction), Progress bar (acknowledged of members), Sheet listing who has not acknowledged, Button
     @states loading · empty · no-access · composer disabled for non-posters with "Request to post" (creates a notification to the owner)
     @audit  announcement posted, acknowledgement reminders sent
     @note   The acknowledgement bar counts MessageAcknowledgement rows against active members at posting time. Non-acknowledgers get a reminder through notifications (14); the list of who has not acknowledged is for
             admins only.
     ===================================================================================================================== */
  function announce() {
    const msgs = day("Nov 10") +
      msg({ a: "AM", t: "3:05 PM", ann: 1, pin: 1, x: "<b>Office closed Friday Nov 22 (company offsite).</b> Support on-call stays as scheduled. Please acknowledge so we know you saw it.", ack: [18, 24, 1], re: [["👍", 14]] }) +
      msg({ a: "KL", t: "3:40 PM", ann: 1, x: "<b>New client communication rules.</b> Customer channels require an Internal / External decision for every message from today. Guide: Docs > Messaging > Customer channels.", ack: [9, 24, 0], more: lp("docs.logiqdev.app", "Customer channels guide", "Docs · updated today") }) +
      day("Today") + msg({ a: "AM", t: "8:00 AM", ann: 1, x: "Reminder: security training due Friday.", ack: [3, 24, 0] });
    return channel({ name: "announcements", kind: "ANNOUNCEMENT", topic: "Company-wide news. Only admins post. Replies go in threads.", avs: ["AM", "KL", "MS"], count: 24, tabs: ["Messages", "Files · 6", "Pins · 1"], pins: [1, "Office closed Friday Nov 22"], msgs,
      foot: dm(["Channel · kind ANNOUNCEMENT, posting_policy, require_acknowledgement", "Message · is_announcement, requires_acknowledgement · MessageAcknowledgement · ChannelPin"], []),
      comp: composer("", { dis: ["Only channel admins can post here", "Channel.posting_policy ADMINS_ONLY · you can reply in threads, react and acknowledge"] }), banner: I("flag", 14) + " Announcement channel · <b>Posting policy: Admins only</b> · acknowledgement required on new announcements (Channel.require_acknowledgement)", bannerCls: "warn" });
  }

  /* =====================================================================================================================
     CHANNEL VIEW · customer / client channel with external participants (spec §27-28, §57, §82-83, §96)
     @screen Messages · #acme-corp (CUSTOMER channel, guests and external users)
     @route  /messages/c/:channelId (kind CUSTOMER) · the customer portal (07) shows the same channel through /portal/messages with the external role
     @perm   VIEW messaging.channels.read + membership · adding/removing external people messaging.external_users.manage* · channel members messaging.channel_members.manage · post messaging.messages.post (INTERNAL_MEMBERS_ONLY
             on some channels). External roles: EXTERNAL / GUEST / READ_ONLY with ChannelMember.guest_kind and access_expires_at
     @api    GET /channels/:id/messages (external callers get visibility EXTERNAL only) · POST /channels/:id/messages {visibility} · POST /channels/:id/members {external_user_id, role, guest_kind, access_expires_at, external_label}
     @mcp    messaging_messages_post (visibility mandatory in shared channels) · messaging_channels_read
     @data   Channel (kind CUSTOMER, company_id, external_access_enabled, default_notification_level) · ChannelMember (external_user_id, role, guest_kind, access_expires_at, external_label) · ChannelNotificationSetting
             (priority_customer_messages) · Message (visibility) · CrmCompany (02) · Ticket (13)
     @ui     Alert (who can see what), Badge "Client · Acme Corp · Guest", ToggleGroup External/Internal, Popover with the external participant card, DropdownMenu (message actions)
     @states loading · empty (onboarding template pins) · expired guest (read-only banner) · no-access · error
     @audit  external access toggled, guest added/expired/removed, message visibility INTERNAL used, export of external messages
     @note   Spec §83 identity marker "Maria Papadopoulou, ACME Corp, Guest" = display name + ChannelMember.external_label + role. External participants cannot see internal members' presence details, other channels or the member
             directory (§27 restrictions). "Create ticket" from here creates a Ticket linked to the channel (Ticket.channel_id exists) and a MessageRecordShare.
     ===================================================================================================================== */
  function client() {
    const msgs = day("Nov 6") + sys("users", "<b>Anna Meyer</b> added <b>Lena Kovac</b> (Acme Corp, Guest) · invitation accepted", "10:02 AM") +
      msg({ a: "AM", t: "10:05 AM", pin: 1, x: "Welcome to your shared space, Lena and Dana. This is where we keep project questions, approvals and files together. Everything you post here is visible to our whole Acme team.", re: [["👋", 2]] }) +
      day("Today") +
      msg({ a: "DW", t: "8:15 AM", x: "Invoice INV-2024-0183 shows the wrong VAT number. Could someone check?", more: rec("receipt", "INV-2024-0183 · EUR 4,800.00", "Acme Corp · issued Nov 1 · status SENT", "<span>Shared by Dana Whitfield</span><span>·</span><span>Finance (08)</span>"), re: [["🙏", 1]] }) +
      msg({ a: "KL", t: "8:30 AM", int: 1, x: "Internal: VAT number was mistyped in the billing profile. I will correct and re-issue. Do not mention the credit note yet.", re: [["✅", 1]] }) +
      msg({ a: "KL", t: "8:42 AM", x: "Thanks Dana, found it. We are correcting the VAT number and will send a new invoice today.", th: [2, ["KL", "DW"], "8:50 AM"], more: '<div class="mg-ticket">' + I("support", 13) + " Ticket <b>TCK-2057</b> created from this message · status Open " + muted("(Ticket.channel_id)") + "</div>" });
    const info = '<div class="th-h"><b>Participants</b><small>#acme-corp</small><button class="btn ghost sm icon" style="margin-left:auto">' + I("x", 15) + '</button></div><div class="th-body">' +
      '<div class="mg-ih">Internal <span>5</span></div>' + [["AM", "OWNER"], ["KL", "ADMIN"], ["MS", "MEMBER"], ["SJ", "MEMBER"]].map((r) => '<div class="rowx" style="padding:5px 0">' + wh(r[0]) + '<span style="flex:1"></span>' + E(r[1]) + "</div>").join("") +
      '<div class="mg-ih">External <span>2</span></div>' + [["LK", "EXTERNAL", "Guest · CUSTOMER · expires Dec 31"], ["DW", "EXTERNAL", "Guest · CUSTOMER · no expiry"]].map((r) => '<div class="rowx" style="padding:5px 0">' + wh(r[0], r[2]) + '<span style="flex:1"></span>' + E(r[1], "purple") + "</div>").join("") +
      '<div class="mg-ih">Linked</div>' + kv("Customer", "Acme Corp " + muted("(02)")) + kv("Project", "Acme Rebrand Website " + muted("(05)")) + kv("Open tickets", "1 · TCK-2057") + kv("Contract", "MSA 2025 · active") +
      '<div class="mg-ih">Rules for this channel</div><div class="mg-ip">External participants see only EXTERNAL messages, cannot browse other channels or the member directory, cannot see presence of employees, files are served by signed links.</div>' + btn("Manage external access", "shield", "sm") + "</div>";
    return channel({ name: "acme-corp", kind: "CUSTOMER", shared: "Acme Corp", topic: "Shared space with Acme Corp · first response target 2 h in business hours", avs: ["AM", "KL", "LK", "DW"], count: 7, tabs: ["Messages", "Files · 9", "Pins · 1", "Tickets · 1", "Approvals · 1"], pins: [1, "Welcome and ways of working"], msgs, info,
      banner: I("globe", 14) + " <b>External participants can read this channel</b> · they see EXTERNAL messages only · 2 guests: Lena Kovac, Dana Whitfield · priority customer messages notify the account team", bannerCls: "ext",
      foot: dm(["Channel · kind CUSTOMER, company_id, external_access_enabled", "ChannelMember · external_user_id, role, guest_kind, access_expires_at, external_label · Message · visibility", "ChannelNotificationSetting · priority_customer_messages · Ticket · channel_id (13)"], ["Ticket from message: no Ticket.source_message_id: gaps-12.md"]),
      comp: composer("Message #acme-corp", { vis: 1 }) });
  }

  /* =====================================================================================================================
     DIRECT MESSAGE (spec §5, §43, §21)
     @screen Messages · Direct message with Marco Silva
     @route  /messages/dm/:channelId (Channel.kind DIRECT, dm_key unique per pair) · new DM: /messages/dm/new?to=<membershipId>
     @perm   messaging.channels.read + messaging.messages.read/post (membership of the DM) · DMs have no moderation by default; admin access to private messages only when MessagingSettings.admin_private_message_access_enabled
             and the caller holds a dedicated key (@gap: messaging.messages.admin_read*, see gaps-12.md)
     @api    POST /channels {kind: DIRECT, member_ids:[x]} (idempotent by dm_key) · GET/POST messages as in a channel · POST /messages/:id/remind {remind_at, preset} · GET /presence?ids=
     @mcp    messaging_messages_post · messaging_messages_read (DMs only for the calling identity)
     @data   Channel (kind DIRECT, dm_key, default_notification_level) · ChannelMember · Message (kind USER / VOICE) · MessageAttachment (VOICE_MESSAGE, duration_seconds) · MessageReadReceipt (read_receipts_direct) ·
             MessageReminder · MessagingPresence (state, status_text, status_emoji, status_expires_at) · Membership (01)
     @ui     Avatar + presence dot, Tooltip (local time), Popover (status), audio player (voice message), Badge, DropdownMenu
     @states loading · empty (start the conversation) · offline queue · target user deactivated (read-only banner)
     @audit  none for content (privacy); admin access to a private message, if ever allowed, writes an audit event (messaging.audit.read*)
     @note   Read receipts ("Seen 9:12") appear only when both sides have share_read_receipts (MessagingMemberSettings) and MessagingSettings.read_receipts_direct. The reminder chip is MessageReminder status PENDING.
     ===================================================================================================================== */
  function dmView() {
    const msgs = day("Yesterday") +
      msg({ a: "MS", t: "5:48 PM", x: "Do you have 10 minutes tomorrow to look at the onboarding illustrations?", re: [["👍", 1, 1]] }) +
      msg({ a: "AM", t: "5:52 PM", x: "Sure, after the 10:00 standup works." }) +
      day("Today") +
      msg({ a: "MS", t: "8:58 AM", x: "", more: voice("0:42") + '<div class="sub-note" style="margin-top:4px">Transcript is not stored (AI transcription is opt-in)</div>' }) +
      msg({ a: "MS", t: "9:03 AM", x: "Also: can you approve the font licence before I buy it?", more: rec("receipt", "Expense EXP-0311 · Fonts licence", "EUR 120.00 · submitted by Marco Silva · status SUBMITTED", "<span>Finance (08)</span><span>·</span><span>snapshot 9:03 AM</span>") }) +
      msg({ a: "AM", t: "9:10 AM", x: "Approved just now. <span class=\"mention\">@Marco</span> remind me Friday to check the invoice batch.", more: '<div class="mg-rem" title="MessageReminder status PENDING">' + I("clock", 13) + " Reminder set for <b>Friday 9:00 AM</b> · " + muted("PENDING") + "</div>" }) +
      '<div class="mg-seen" title="MessageReadReceipt">Seen by Marco Silva · 9:12 AM</div>';
    const info = '<div class="th-h"><b>Profile</b><button class="btn ghost sm icon" style="margin-left:auto">' + I("x", 15) + '</button></div><div class="th-body"><div style="text-align:center;padding:10px 0">' + av("MS", "xl", "on") + '<div style="margin-top:8px"><b class="ink">Marco Silva</b><div class="muted">Designer · Brand & Web</div></div></div>' +
      kv("Status", "🎧 Focus time, until 12:00") + kv("Presence", E("ACTIVE", "green")) + kv("Local time", "10:14 AM · Lisbon") + kv("Team", "Design") + kv("Manager", "Anna Meyer") + kv("On leave", "No") +
      '<div class="mg-ih">Shared</div><div class="mg-ip">12 files · 3 shared records</div><div class="mg-ih">Channels in common <span>5</span></div><div class="mg-ip">#general · #design · #acme-rebrand · #dev · #announcements</div>' + btn("Open profile", "users", "sm") + "</div>";
    const c = channel({ name: "Marco Silva", kind: "DIRECT", topic: "Direct message · Designer · 🎧 Focus time, until 12:00", avs: ["MS"], count: 2, tabs: ["Messages", "Files · 12", "Pins"], msgs, info, foot: dm(["Channel · kind DIRECT, dm_key", "Message · kind VOICE · MessageAttachment · VOICE_MESSAGE · MessageReadReceipt · MessageReminder · MessagingPresence"], []),
      comp: composer("Message Marco Silva", {}) });
    return c.replace(/<span class="mg-chn">.*?<\/span>/, '<span class="mg-chn">' + av("MS", "", "on") + " Marco Silva</span>");
  }
  /* =====================================================================================================================
     GROUP DIRECT MESSAGE (spec §5 supported types)
     @screen Messages · Group DM (Jonas, Kim, Sofia)
     @route  /messages/dm/:channelId (Channel.kind GROUP_DIRECT)
     @perm   messaging.channels.create to start one · adding people to a group DM = every participant (ChannelMember role MEMBER) · converting to a channel needs messaging.channels.create
     @api    POST /channels {kind: GROUP_DIRECT, member_ids[]} · POST /channels/:id/members · POST /channels/:id/convert {kind: PRIVATE, name} (history is kept, members keep access)
     @mcp    messaging_channels_read · messaging_messages_post
     @data   Channel (kind GROUP_DIRECT, dm_key, member_count) · ChannelMember · Message · ChannelReadState
     @ui     AvatarGroup, Dialog (add people, convert to channel), Command (people search), Badge
     @states loading · empty · no-access
     @audit  member added/left, converted to a channel
     @note   A group DM has no name by default (names of members), max size is a MessagingSettings policy. "Convert to channel" keeps history and creates a PRIVATE channel with the same members.
     ===================================================================================================================== */
  function gdm() {
    const msgs = day("Today") + sys("users", "<b>Jonas Koch</b> started this conversation with <b>Kim Lund</b> and <b>Sofia Jensen</b>", "8:00 AM") +
      msg({ a: "JK", t: "8:01 AM", x: "Three of us are on the Stripe cutover. Using this to coordinate the maintenance window." }) +
      msg({ a: "KL", t: "8:06 AM", x: "Client wants Thursday evening, after their close of business.", re: [["👍", 2]] }) +
      msg({ a: "SJ", t: "8:10 AM", x: "Works for me. I’ll prepare the runbook and share it.", more: att("cutover-runbook.pdf", "PDF · 310 KB", "PDF", "file") });
    const c = channel({ name: "Jonas, Kim, Sofia", kind: "GROUP_DIRECT", topic: "Group conversation · 3 people · add people or convert to a private channel", avs: ["JK", "KL", "SJ"], count: 3, tabs: ["Messages", "Files · 1"], msgs, foot: dm(["Channel · kind GROUP_DIRECT, dm_key, member_count", "ChannelMember · Message · ChannelReadState"], []),
      comp: composer("Message Jonas, Kim, Sofia", {}) });
    return c.replace(/<span class="mg-chn">.*?<\/span>/, '<span class="mg-chn">' + av("JK") + " Jonas, Kim, Sofia</span>").replace("Huddle</button>", "Huddle</button><button class=\"btn sm\">" + I("plus", 13) + " Add people</button><button class=\"btn sm\">" + I("hash", 13) + " Convert to channel</button>");
  }

  /* ---------- shared row for conversation lists (home, threads, mentions, saved) ---------- */
  const cv = (o) => '<div class="mg-row' + (o.un ? " un" : "") + '">' + (o.a ? av(o.a, "lg sq") : '<span class="mg-ch-ic">' + I(o.ic || "hash", 16) + "</span>") + '<div class="mg-rb"><div class="mg-rt"><b>' + o.t + "</b>" + (o.tags || "") + "<i>" + o.tm + '</i></div><div class="mg-rs">' + o.s + '</div><div class="mg-rm">' + (o.m || "") + "</div></div>" + (o.act || "") + "</div>";
  const unreadN = (n, m) => '<span class="count' + (m ? " alert" : "") + '" title="' + (m ? "ChannelReadState.mention_count" : "ChannelReadState.unread_count") + '">' + n + "</span>";

  /* =====================================================================================================================
     MESSAGING HOME (spec §101-102)
     @screen Messages · Home
     @route  /messages
     @perm   VIEW messaging.channels.read + messaging.messages.read · customer conversations only for channels the caller is a member of
     @api    GET /messaging/home (aggregates: unread channels from ChannelReadState, mentions, DMs, favorites, recent, followed threads, saved, reminders) · POST /channels/:id/read
     @mcp    messaging_channels_read
     @data   ChannelReadState (unread_count, mention_count, marked_unread_from_id) · Channel (last_message_at, kind, project_id, company_id) · ChannelMember (is_favorite, last_viewed_at) · MessageThreadFollower · SavedMessage ·
             MessageReminder · Message
     @ui     Card sections with Badge counters, ScrollArea rows (Avatar, Badge), Button "Mark all as read", Tabs for Customer / Project conversations
     @states loading skeleton cards · empty ("You are all caught up") · error with retry · no-access
     @audit  none
     @note   "Continue where you left off": every row opens the conversation at the first unread message (marked_unread_from_id or last_read_message_id). Customer conversations are Channels of kind CUSTOMER, project
             conversations kind PROJECT, both only for membership. Counts come from ChannelReadState, never from counting messages in the client.
     ===================================================================================================================== */
  function home() {
    const un = [cv({ ic: "hash", t: "# dev", tm: "8:47 AM", s: "<b>Sofia Jensen</b>: Stripe webhook retries are flaky on CI…", un: 1, act: unreadN(6) }), cv({ a: "MS", t: "Marco Silva", tm: "9:03 AM", s: "Also: can you approve the font licence before I buy it?", un: 1, act: unreadN(2, 1) }), cv({ ic: "globe", t: "# acme-corp", tm: "8:42 AM", s: "<b>Kim Lund</b>: Thanks Dana, found it. We are correcting the VAT…", tags: '<span class="badge purple">Client</span>', un: 1, act: unreadN(1, 1) })];
    return page(head("Messages", "Everything that needs you in one place.", btn("Mark all as read", "check") + btn("New message", "edit", "primary")) +
      '<div class="mini-stats">' + stat("Unread channels", "4", "9 messages") + stat("Mentions", "3", "1 from a client", 1) + stat("Followed threads", "7", "2 with new replies") + stat("Reminders due", "2", "today") + stat("Saved", "11", "since Oct 3") + "</div>" +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' +
      cd("<b>Unread</b><span class='r muted'>ChannelReadState</span>", un.join(""), 1) + gap(cd("<b>Recent conversations</b><span class='r muted'>Channel.last_message_at</span>", [cv({ ic: "folder", t: "# acme-rebrand", tm: "10:44 AM", s: "<b>Anna Meyer</b>: Will do, sending it to the portal this afternoon.", tags: '<span class="badge blue">Project · Acme Rebrand Website</span>' + '<span class="badge purple">Client</span>' }), cv({ a: "AM", t: "Anna Meyer", tm: "9:10 AM", s: "Approved just now." }), cv({ ic: "flag", t: "# announcements", tm: "8:00 AM", s: "Reminder: security training due Friday.", m: "Needs acknowledgement" }), cv({ ic: "users", t: "Jonas, Kim, Sofia", tm: "8:10 AM", s: "Works for me. I’ll prepare the runbook and share it." })].join(""), 1)) + gap(cd("<b>Followed threads</b><span class='r muted'>MessageThreadFollower</span>", [cv({ a: "SJ", t: "Stripe webhook retries are flaky…", tm: "8:55 AM", s: "<b>Jonas Koch</b>: Found it. The dedupe key used the delivery id, not the event id.", m: "# dev · 3 replies", un: 1 }), cv({ a: "MS", t: "Updated the hero based on yesterday’s feedback", tm: "10:41 AM", s: "<b>Lena Kovac</b>: Looks great, much closer to what we imagined.", m: "# acme-rebrand · 4 replies" })].join(""), 1)) +
      "</div><div>" +
      cd("<b>Favorites</b><span class='r muted'>ChannelMember.is_favorite</span>", ["# general", "# dev", "# acme-rebrand", "Marco Silva"].map((n) => '<div class="rowx">' + I("star", 14) + '<div class="grow">' + n + "</div></div>").join(""), 1) +
      gap(cd("<b>Reminders</b><span class='r muted'>MessageReminder</span>", '<div class="rowx"><div class="grow"><b>Check the invoice batch</b><small>From Anna Meyer in DM · Fri 9:00 AM</small></div>' + E("PENDING") + '</div><div class="rowx"><div class="grow"><b>Reply to Lena about the pricing table</b><small>#acme-rebrand · today 4:00 PM</small></div>' + E("PENDING") + '</div><div class="rowx"><div class="grow"><b>Review runbook</b><small>Group DM · yesterday</small></div>' + E("TRIGGERED", "yellow") + "</div>", 1)) +
      gap(cd("<b>Customer conversations</b>", [["Acme Corp", "1 unread · waiting for us 2 h"], ["Globex", "No unread"], ["Northwind", "No unread"]].map((r) => '<div class="rowx">' + I("globe", 14) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + more + "</div>").join(""), 1)) +
      gap(cd("<b>Project conversations</b>", [["Acme Rebrand Website", "4 new"], ["Mobile App v2", "No unread"], ["Customer Portal Build", "1 new"]].map((r) => '<div class="rowx">' + I("folder", 14) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + more + "</div>").join(""), 1)) + "</div></div>" +
      dm(["ChannelReadState · unread_count, mention_count, marked_unread_from_id", "Channel · last_message_at, kind, project_id, company_id · ChannelMember · is_favorite", "MessageThreadFollower · SavedMessage · MessageReminder · Message"], []));
  }

  /* =====================================================================================================================
     THREADS INBOX (spec §12, §88)
     @screen Messages · Threads
     @route  /messages/threads?filter=unread|following|muted
     @perm   messaging.messages.read (only threads in channels the caller can read)
     @api    GET /me/threads?filter= · PUT /messages/:rootId/follow {muted} · POST /messages/:rootId/read
     @mcp    messaging_messages_read
     @data   MessageThreadFollower (root_message_id, membership_id, muted, last_read_at, source) · Message (parent_message_id, reply_count, last_reply_at)
     @ui     List with Avatar group, Tabs (All, Unread, Following, Muted), Tooltip, DropdownMenu (follow, mute, mark read)
     @states loading · empty ("No threads you follow") · error · no-access
     @audit  none
     @note   You follow a thread automatically when you start it, reply, or get mentioned in it (MessageThreadFollower.source). Muting keeps the row but stops notifications.
     ===================================================================================================================== */
  function threads() {
    const rows = [["SJ", "Stripe webhook retries are flaky on CI", "# dev", "JK", "AM", "3 replies · 8:55 AM", "Jonas Koch: Found it. The dedupe key used the delivery id.", 1, "reply"], ["MS", "Updated the hero based on yesterday’s feedback", "# acme-rebrand", "AM", "LK", "4 replies · 10:41 AM", "Lena Kovac: Looks great, much closer to what we imagined.", 1, "mention"], ["KL", "Thanks Dana, found it. We are correcting the VAT number", "# acme-corp", "DW", "KL", "2 replies · 8:50 AM", "Dana Whitfield: Perfect, thank you.", 0, "author"], ["AM", "Plan for the Nov 22 offsite logistics", "# general", "SJ", "JK", "12 replies · yesterday", "Sofia Jensen: Hotel list is attached above.", 0, "reply"]];
    return page(head("Threads", "Conversations you follow, newest activity first.", btn("Mark all read", "check")) + pill(["All", "Unread · 2", "Following · 7", "Muted · 1"], 0) +
      FB([["Channel", "is any of", "dev, acme-rebrand, acme-corp"], ["Followed since", "after", "Oct 1"]], btn("Save view", "plus", "sm")) +
      '<div class="panel">' + rows.map((r) => cv({ a: r[0], t: r[1], tm: r[5].split("·")[1].trim(), s: r[6], un: r[7], m: r[2] + " · " + r[5].split("·")[0] + " · following because " + r[8] + " (MessageThreadFollower.source)", act: '<div class="mg-rowact"><div class="avs">' + av(r[3]) + av(r[4]) + "</div>" + more + "</div>" })).join("") + "</div>" +
      dm(["MessageThreadFollower · root_message_id, membership_id, muted, last_read_at, source", "Message · parent_message_id, reply_count, last_reply_at"], []));
  }

  /* =====================================================================================================================
     MENTIONS & REACTIONS INBOX (spec §15, §16, §18)
     @screen Messages · Mentions & reactions
     @route  /messages/mentions?tab=mentions|reactions|keywords|unread
     @perm   messaging.messages.read · the notifications behind it are governed by 14 (notifications.preferences.manage_own)
     @api    GET /me/mentions?kind=&cursor= · GET /me/reactions-on-my-messages · POST /me/mentions/read
     @mcp    messaging_messages_read
     @data   MessageMention (kind, membership_id, team_id, role_id, mentioned_channel_id) · MessageReaction (emoji, membership_id) · MessagingKeyword (keyword, match_whole_word) · NOTIFICATION (14) for read state
     @ui     Tabs, list rows with Badge for mention kind, Popover (emoji), Button "Open in channel"
     @states loading · empty ("No mentions yet") · error · no-access
     @audit  none
     @note   A row appears for @you, a TEAM you belong to, a ROLE you hold, @channel/@everyone (only if broadcast_mention_policy allows) and keywords you set. Reactions tab lists who reacted to YOUR messages. Notification
             delivery (push/email) is module 14; this screen is the in-app inbox.
     ===================================================================================================================== */
  function mentions() {
    const row = (a, t, kind, x, ch, tm, un) => cv({ a, t, tm, s: x, un, tags: '<span class="badge ' + (kind === "MEMBER" ? "blue" : "") + '" title="MessageMentionKind ' + kind + '">' + U.en(kind) + "</span>", m: ch, act: '<div class="mg-rowact">' + btn("Open", "", "sm") + btn("Mark read", "", "sm ghost") + "</div>" });
    return page(head("Mentions & reactions", "Where people asked for you or reacted to your messages.", btn("Mark all read", "check")) + pill(["Mentions · 3", "Reactions · 9", "Keywords · 2", "Everything unread"], 0) +
      FB([["Kind", "is any of", "Member, Team, Role"], ["Channel", "is", "Any"]], sel("Newest first") + btn("Save view", "plus", "sm")) +
      '<div class="panel">' + row("MS", "Marco Silva", "MEMBER", 'Also: can you approve the font licence <span class="mention">@Anna</span> before I buy it?', "Direct message", "9:03 AM", 1) +
      row("LK", "Lena Kovac", "MEMBER", 'Looks great. <span class="mention">@Anna</span> could you send the final pricing table for approval?', "# acme-rebrand · client", "10:38 AM", 1) +
      row("JK", "Jonas Koch", "TEAM", '<span class="mention">@engineering</span> deploy window moves to 21:00 on Thursday.', "# dev", "8:30 AM", 1) +
      row("KL", "Kim Lund", "ROLE", '<span class="mention">@project-managers</span> please update the weekly status before 3 PM.', "# general", "Yesterday", 0) +
      row("SJ", "Sofia Jensen", "CHANNEL", '<span class="mention">@channel</span> staging is down for 10 minutes.', "# dev", "Nov 9", 0) + "</div>" +
      '<div class="sub-note" style="margin:10px 0">Keyword alerts (MessagingKeyword): “invoice”, “VAT”. A message that contains a keyword you set appears here and notifies according to ChannelNotificationSetting.notify_keywords.</div>' +
      cd("<b>Reactions on your messages</b><span class='r muted'>MessageReaction</span>", [["🔥", "Marco Silva and 1 other", "“Updated the hero…”", "# acme-rebrand", "9:20 AM"], ["👍", "Lena Kovac", "“Absolutely. I’ll book it…”", "# acme-rebrand", "Yesterday"], ["✅", "Kim Lund", "“Approved just now.”", "DM", "9:12 AM"]].map((r) => '<div class="rowx"><span class="mg-emo">' + r[0] + '</span><div class="grow"><b>' + r[1] + " reacted</b><small>" + r[2] + " in " + r[3] + "</small></div><span class=\"muted\">" + r[4] + "</span></div>").join(""), 1) +
      dm(["MessageMention · kind, membership_id, team_id, role_id, mentioned_channel_id", "MessageReaction · emoji, membership_id", "MessagingKeyword · keyword, match_whole_word, case_sensitive, is_enabled", "NOTIFICATION (14) · read state"], ["Read/unread state of a single mention is not stored in module 12 (MessageMention has no read_at): use the Notification row (14) or add MessageMention.read_at. See gaps-12.md"]));
  }

  /* =====================================================================================================================
     DRAFTS, SCHEDULED AND SENT (spec §46, §74-75)
     @screen Messages · Drafts & sent
     @route  /messages/drafts?tab=drafts|scheduled|sent|failed
     @perm   messaging.messages.post (own drafts and own scheduled messages only)
     @api    GET /me/drafts · PUT /channels/:id/draft {body, thread_root_message_id?, attachment_document_ids[], scheduled_for?} · GET /me/messages?status=SCHEDULED|FAILED|SENT · POST /messages/:id/send-now · DELETE /messages/:id
     @mcp    messaging_messages_post
     @data   MessageDraft (channel_id, thread_root_message_id, body, attachment_document_ids, scheduled_for) · Message (status SCHEDULED | SENT | FAILED | RETRYING, scheduled_for, sent_at)
     @ui     Tabs, table with row actions (Edit, Send now, Reschedule, Discard), Popover date-time picker, Badge for MessageDeliveryStatus
     @states loading · empty per tab · error · no-access
     @audit  scheduled message created/changed/cancelled (admin-visible for compliance if enabled)
     @note   One draft per user per channel (and per thread root). Drafts sync across devices and survive a reload; offline drafts go to local storage and merge. A scheduled message is a real Message row with status SCHEDULED
             and is not visible to anyone else until sent.
     ===================================================================================================================== */
  function drafts() {
    return page(head("Drafts & sent", "Your unsent, scheduled and failed messages.", btn("New message", "edit", "primary")) + '<div class="tabset">' + tabs([["d", "Drafts", 3], ["s", "Scheduled", 2], ["t", "Sent"], ["f", "Failed", 1]], "d") +
      pane("d", 1, tbl(["Where", "Preview", "Attachments", "Updated", ""], [["# dev " + muted("channel"), "Here is the proposal for the deploy window, tell me if…", "—", "9:31 AM", btn("Open", "", "sm") + more], ["Thread · # acme-rebrand", "Thanks Lena, one more thing about the pricing table…", "pricing-notes.pdf", "Yesterday", btn("Open", "", "sm") + more], ["DM · Marco Silva", "Can you send me the final export when…", "—", "Nov 9", btn("Open", "", "sm") + more]])) +
      pane("s", 0, tbl(["Where", "Preview", "Sends", "Status", ""], [["# acme-rebrand", "Reminder: portal approval due Friday", "Tomorrow 9:00 AM", E("SCHEDULED", "blue"), btn("Edit", "", "sm") + btn("Send now", "", "sm ghost") + more], ["DM · Kim Lund", "Happy birthday! 🎂", "Nov 14 8:00 AM", E("SCHEDULED", "blue"), btn("Edit", "", "sm") + btn("Send now", "", "sm ghost") + more]])) +
      pane("t", 0, tbl(["Where", "Message", "Sent", "Delivery", "Reactions"], [["# acme-rebrand", "Will do, sending it to the portal this afternoon.", "10:44 AM", E("DELIVERED", "green"), "—"], ["DM · Marco Silva", "Approved just now.", "9:10 AM", E("DELIVERED", "green"), "✅ 1"], ["# general", "Offsite agenda is in Docs.", "Yesterday", E("SENT"), "👍 6"]])) +
      pane("f", 0, tbl(["Where", "Message", "When", "Status", ""], [["# dev", "Design tokens for dark mode are merged…", "9:20 AM", E("FAILED", "red") + " " + muted("network"), btn("Retry", "", "sm primary") + btn("Delete", "", "sm ghost")]])) + "</div>" +
      dm(["MessageDraft · channel_id, thread_root_message_id, body, attachment_document_ids, scheduled_for", "Message · status, scheduled_for, sent_at, client_message_id"], []));
  }

  /* =====================================================================================================================
     SAVED ITEMS AND REMINDERS (spec §20-21)
     @screen Messages · Saved
     @route  /messages/saved?tab=saved|reminders|completed
     @perm   messaging.messages.read on the saved message (a saved message the viewer can no longer read is shown as unavailable)
     @api    GET /me/saved · POST /messages/:id/save {note} · DELETE /saved/:id · GET /me/reminders · POST /messages/:id/remind {remind_at, preset, note} · POST /reminders/:id/snooze|complete|cancel
     @mcp    messaging_messages_read
     @data   SavedMessage (membership_id, message_id, note) · MessageReminder (remind_at, preset, note, status PENDING | TRIGGERED | COMPLETED | SNOOZED | CANCELLED, notification_id)
     @ui     Tabs, Card list, DropdownMenu (remind in 20 min / 1 h / 3 h / tomorrow / next week / custom), Popover date picker, Textarea for the note
     @states loading · empty ("Nothing saved yet") · error · no-access (message lost access)
     @audit  none
     @note   A reminder at remind_at creates a Notification (14, notification_id) and flips status to TRIGGERED; the user then completes or snoozes it. Saved is private to the member; the note is personal.
     ===================================================================================================================== */
  function saved() {
    const it = (a, t, x, w, note, act) => '<div class="rowx mg-saved">' + (a ? av(a, "lg sq") : '<span class="mg-ch-ic">' + I("lock", 16) + "</span>") + '<div class="grow"><b>' + t + "</b><small>" + w + '</small><div class="mt" style="margin-top:4px">' + x + "</div>" + (note ? '<div class="mg-note">' + I("edit", 12) + " " + note + "</div>" : "") + "</div>" + (act || btn("Open", "", "sm")) + more + "</div>";
    return page(head("Saved", "Messages you saved for later and your reminders.", "") + '<div class="tabset">' + tabs([["s", "Saved", 11], ["r", "Reminders", 3], ["c", "Completed"]], "s") +
      pane("s", 1, FB([["Channel", "is", "Any"], ["Saved", "after", "Oct 1"]], btn("Save view", "plus", "sm")) + cd("", it("MS", "Marco Silva · # acme-rebrand", "Brand guidelines v2 are in the shared folder, tokens included.", "Nov 8, 3:12 PM", "Use for the Friday review") + it("JK", "Jonas Koch · # dev", "Release checklist: freeze Tue, QA Wed, deploy Thu 21:00.", "Nov 7, 11:02 AM", "") + it("AM", "Anna Meyer · DM", "Client budget is capped at EUR 40k including the extra scope.", "Nov 5, 5:48 PM", "Mention in the QBR") + it(null, "Message you can no longer access", "This message is in a private channel you left.", "Oct 21", "", btn("Remove", "", "sm")), 1)) +
      pane("r", 0, tbl(["Message", "Where", "Remind at", "Preset", "Status", ""], [["Check the invoice batch", "DM · Anna Meyer", "Fri 9:00 AM", "custom", E("PENDING"), btn("Snooze", "", "sm") + btn("Done", "", "sm ghost")], ["Reply to Lena about the pricing table", "# acme-rebrand", "Today 4:00 PM", "3 hours", E("PENDING"), btn("Snooze", "", "sm") + btn("Done", "", "sm ghost")], ["Review runbook", "Group DM", "Yesterday 5:00 PM", "tomorrow", E("TRIGGERED", "yellow"), btn("Snooze", "", "sm primary") + btn("Done", "", "sm")]])) +
      pane("c", 0, tbl(["Message", "Where", "Completed", "Status"], [["Send final invoice", "# acme-corp", "Nov 6", E("COMPLETED", "green")], ["Book call with Lena", "# acme-rebrand", "Nov 5", E("COMPLETED", "green")], ["Update CRM note", "DM · Kim Lund", "Nov 3", E("CANCELLED")]])) + "</div>" +
      dm(["SavedMessage · membership_id, message_id, note", "MessageReminder · remind_at, preset, note, status, triggered_at, completed_at, notification_id"], []));
  }

  /* =====================================================================================================================
     SEARCH (spec §30-31, §86)
     @screen Messages · Search with filters
     @route  /messages/search?q=&in=&from=&after=&before=&type=&has=&record=&phrase= · results open the conversation at the exact message (/messages/c/:id/m/:messageId)
     @perm   messaging.messages.read: only channels/DMs the caller can read; external users only EXTERNAL messages; admin search of private conversations only under explicit policy (MessagingSettings.admin_private_message_access_enabled)
     @api    GET /messaging/search?q=&sender=&channel_id=&kind=&date_from=&date_to=&has_attachment=&has_link=&has_reaction=&mentions=&record_type=&exact= (uses Message.search_vector, tsvector) · global search (31) reuses it
     @mcp    messaging_messages_read (search is a mode of the read tool)
     @data   Message (search_vector, body_plain, kind, visibility, channel_id, author_membership_id, has_attachments, has_links, has_record_shares, reaction_count) · MessageMention · MessageAttachment · SavedView (entity_type MESSAGE, saved searches)
     @ui     Command-style search input, Popover+Command filter pickers (sender, channel), DatePicker range, Tabs (Messages, Files, Channels, People), highlighted terms, Badge, Button "Save search"
     @states loading skeleton · empty ("No results, try fewer filters") · error · no-access rows are never returned (not even a count)
     @audit  admin searches in private conversations are audited (messaging.audit.read*)
     @note   Filters follow spec §30 exactly: sender, channel, conversation, date, message type, has attachment, has link, has reaction, mentioned user, record type, keyword, exact phrase. Ranking: exact phrase > recency >
             channel membership. Archived channels stay searchable per retention policy. Saved searches are SavedView rows (entity_type MESSAGE, search, filters).
     ===================================================================================================================== */
  function searchView() {
    const hit = (a, who_, where, tm, x, extra) => '<div class="mg-hit">' + av(a, "lg sq") + '<div class="grow"><div class="mh"><b>' + who_ + '</b><span class="tm">' + where + " · " + tm + "</span></div><div class=\"mt\">" + x + "</div>" + (extra || "") + '</div><button class="btn sm">Jump</button></div>';
    return page(head("Search", "Messages, files, channels and people you can access.", btn("Save search", "star")) +
      '<div class="mg-bigsearch">' + I("search", 16) + '<span>invoice vat</span><kbd>Enter</kbd></div>' +
      pill(["Messages · 18", "Files · 4", "Channels · 2", "People · 0"], 0) +
      FB([["Sender", "is", "Kim Lund"], ["In", "is", "# acme-corp, # acme-rebrand"], ["Date", "between", "Nov 1 – Nov 11"], ["Has", "is", "Link"], ["Type", "is", "User"], ["Exact phrase", "contains", "“VAT number”"]], sel("Best match", "sort") + btn("Clear", "", "sm ghost")) +
      '<div class="sub-note" style="margin-bottom:8px">More filters: Conversation (DM / group / channel) · Has attachment · Has reaction · Mentioned user · Record type (task, invoice, deal…) · Message type (User, System, Integration, Voice)</div>' +
      '<div class="g2" style="grid-template-columns:1.8fr 1fr;align-items:start"><div>' + cd("<b>18 messages</b><span class='r muted'>Message.search_vector · ranked</span>",
        hit("DW", "Dana Whitfield", "# acme-corp", "Today 8:15 AM", 'Invoice INV-2024-0183 shows the wrong <mark>VAT</mark> number. Could someone check?', '<div class="sub-note">Record shared: invoice INV-2024-0183 · in thread (2 replies)</div>') +
        hit("KL", "Kim Lund", "# acme-corp", "Today 8:42 AM", 'Thanks Dana, found it. We are correcting the <mark>VAT number</mark> and will send a new <mark>invoice</mark> today.') +
        hit("KL", "Kim Lund", "Direct message with Anna Meyer", "Nov 9", 'Do we apply reverse charge on this <mark>invoice</mark> if the <mark>VAT</mark> id validates?', '<div class="sub-note">' + I("lock", 11) + " Direct conversation · only visible to you</div>") +
        hit("AM", "Anna Meyer", "# finance-ops", "Nov 4", '<mark>Invoice</mark> run is Thursday. <mark>VAT</mark> checks done for all EU customers.', '<span class="badge">Archived channel</span>') +
        '<div class="rowx"><div class="grow muted">Showing 4 of 18 · cursor pagination</div>' + btn("Load more", "", "sm") + "</div>", 1) + "</div><div>" +
      cd("<b>Files</b><span class='r muted'>MessageAttachment</span>", [["invoice-template-vat.pdf", "PDF · # acme-corp"], ["vat-validation-export.csv", "Spreadsheet · # finance-ops"]].map((r) => '<div class="rowx">' + I("file", 16) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + btn("Open", "", "sm") + "</div>").join(""), 1) +
      gap(cd("<b>Saved searches</b><span class='r muted'>SavedView entity_type MESSAGE</span>", ["Client questions this week", "Invoice mentions", "Unanswered in client channels"].map((n) => '<div class="rowx">' + I("search", 14) + '<div class="grow">' + n + "</div>" + more + "</div>").join(""), 1)) +
      gap(callout("shield", "Results never include channels you cannot read, internal notes (for external users), or archived-and-purged content.", "")) + "</div></div>" +
      dm(["Message · search_vector, body_plain, kind, visibility, author_membership_id, has_attachments, has_links, has_record_shares, reaction_count", "MessageMention · MessageAttachment · MessageRecordShare · SavedView (entity_type MESSAGE: search, filters, visibility)"], []));
  }

  /* =====================================================================================================================
     THREAD VIEW (full page, spec §12, §88)
     @screen Messages · Thread
     @route  /messages/c/:channelId/t/:messageId?view=page · on narrow screens the thread panel becomes this page
     @perm   messaging.messages.read + post (reply) · pin messaging.messages.pin · convert to task tasks.tasks.create · create ticket support.tickets.create
     @api    GET /messages/:rootId/replies?cursor= · POST /channels/:id/messages {parent_message_id, also_send_to_channel} · PUT /messages/:rootId/follow · POST /messages/:rootId/convert {to: task|ticket}
     @mcp    messaging_messages_read · messaging_messages_post · tasks_tasks_create (via the same service for "Convert to task")
     @data   Message (parent_message_id, reply_count, last_reply_at, metadata.also_in_channel) · MessageThreadFollower · MessageRecordShare · TaskLink (entity_type MESSAGE, 06) · Ticket (13, channel_id)
     @ui     Breadcrumb back to the channel, ScrollArea, Tiptap composer, Switch "Also send to channel", Popover (followers), Card (linked records), Button
     @states loading · empty (no replies: "Be the first to reply") · deleted root (tombstone) · no-access
     @audit  convert to task/ticket (source message, created record) is an audit event
     @note   A reply "also sent to channel" is stored once (Message.parent_message_id set) and flagged in metadata so the channel timeline shows it with "Replied to a thread". Linked records are shown on the right with their
             current status (read-through, permission checked).
     ===================================================================================================================== */
  function thread() {
    const root = msg({ a: "SJ", t: "Nov 11, 8:41 AM", x: "Stripe webhook retries are flaky on CI. Repro below, I think the dedupe key is wrong.", more: '<pre class="mg-code"><code>pnpm --filter api test -- stripe-webhook\n✓ retries 3 times with backoff\n✗ dedupes by external_event_id</code></pre>', re: [["👀", 2], ["🐛", 1]] });
    return page('<div class="mg-bc"><a>' + I("hash", 13) + " dev</a>" + I("right", 12) + "<b>Thread</b></div>" + head("Stripe webhook retries are flaky on CI", "Thread started by Sofia Jensen in # dev · 3 replies · last reply 8:55 AM", btn("Follow", "bell") + btn("Copy link", "link") + btn("Open in channel", "chat", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Conversation</b><span class='r muted'>Message.parent_message_id</span>", '<div style="padding:8px 14px">' + root + day("3 replies") + msg({ a: "JK", t: "8:50 AM", x: "Looking now. The test passes locally, so it is the CI parallelism.", re: [["👍", 1]] }) + msg({ a: "AM", t: "8:53 AM", x: "Can you check the retry counter too?", show: 1, menu: "" }) +
        msg({ a: "JK", t: "8:55 AM", x: "Found it. The dedupe key used the delivery id, not the event id. PR coming.", more: rec("link", "logiqdev/os · #482", "fix(api): dedupe webhook by external_event_id", "<span>+42 −7</span><span>·</span><span>Open</span>"), th: null }) + "</div>" + composer("Reply to thread…", { flush: 1, also: 1 }), 1) + "</div><div>" +
      cd("<b>Linked records</b><span class='r muted'>TaskLink · MessageRecordShare</span>", '<div class="rowx"><div class="grow"><b>WEB-139 Stripe webhook retries failing</b><small>Task · In review · linked by Anna Meyer</small></div>' + E("TASK") + '</div><div class="rowx"><div class="grow muted">No ticket yet</div>' + btn("Create ticket", "support", "sm") + "</div>" + '<div class="rowx"><div class="grow muted">Not converted to a task from this thread</div>' + btn("Convert to task", "tasks", "sm") + "</div>", 1) +
      gap(cd("<b>Followers</b><span class='r muted'>MessageThreadFollower · 4</span>", [["SJ", "author"], ["JK", "replied"], ["AM", "replied"], ["KL", "mentioned · muted"]].map((r) => '<div class="rowx">' + wh(r[0], r[1]) + "<span style=\"flex:1\"></span>" + more + "</div>").join(""), 1)) +
      gap(cd("<b>Participants' files</b>", '<div class="rowx">' + I("file", 16) + '<div class="grow"><b>repro.har</b><small>Other · 420 KB</small></div></div>', 1)) + "</div></div>" +
      dm(["Message · parent_message_id, reply_count, last_reply_at, quoted_message_id", "MessageThreadFollower · root_message_id, membership_id, muted, source", "TaskLink · entity_type MESSAGE (06) · MessageRecordShare · Ticket · channel_id (13)"], ["Task has no typed source_message_id; the link is a generic TaskLink row with entity_type MESSAGE (no schema gap, but a decision for the Tasks module). Ticket has channel_id only: no Ticket.source_message_id (see gaps-12.md)"]));
  }

  /* =====================================================================================================================
     MESSAGE ACTION DIALOGS (spec §13, §21, §24, §64)
     @screen Messages · Message actions: edit, delete, convert to task, create ticket, forward, remind, report, schedule
     @route  dialogs over any channel/thread/DM (?action=edit|delete|task|ticket|forward|remind|report|schedule&message=<id>)
     @perm   edit: author within MessagingSettings.edit_time_limit_minutes · delete own: allow_delete_own_messages (+ delete_own_time_limit_minutes) · delete others: messaging.messages.delete_any* (reason mandatory) ·
             convert to task: tasks.tasks.create · create ticket: support.tickets.create · forward: post right in the target channel · remind/save: own · report: any member
     @api    PATCH /messages/:id {body} · DELETE /messages/:id {reason} · POST /messages/:id/convert {to: "task", team_id, assignee_membership_id, due_date, priority} (creates Task + TaskLink MESSAGE + a MessageRecordShare back in the thread) ·
             POST /messages/:id/convert {to: "ticket", inbox_id, priority, type, customer_visible} · POST /messages/:id/forward {channel_ids[], note} · POST /messages/:id/remind · POST /messages/:id/report {reason, details} · POST /channels/:id/messages {scheduled_for}
     @mcp    messaging_messages_post · tasks_tasks_create · support_tickets_create (sensitive actions need confirmation when an agent calls them)
     @data   MessageVersion (edit history) · Message (is_edited, edited_at, deleted_at, deleted_by_user_id, delete_reason, forwarded_from_message_id, scheduled_for) · TaskLink · Task · Ticket (source, channel_id, requester) ·
             MessageRecordShare · MessageReminder · MessageReport (reason, details, status)
     @ui     shadcn Dialog (one per action), AlertDialog for delete, Select, Popover+Command, DatePicker + time, Textarea, Checkbox
     @states each dialog: validation errors inline · saving · saved (toast with link to the created record and Undo where reversible) · permission error (control disabled with the reason)
     @audit  message edited (version), deleted (who, reason), converted (source message to Task/Ticket), forwarded, reported
     @note   Convert to task prefills the title from the first line and the description with a permalink and a quote; the new task receives a TaskLink back to the message and the thread gets a record card. Create ticket
             pre-fills requester from the external author in client channels (Ticket.requester_user_id) and sets Ticket.channel_id; TicketSource has no CHAT_MESSAGE value (MANUAL is used, see @gap in gaps-12.md).
     ===================================================================================================================== */
  function actions() {
    const dlg = (ic, t, sub, body, foot) => '<div class="mg-dlg"><div class="mg-dlg-h">' + I(ic, 16) + "<div><b>" + t + "</b><small>" + sub + "</small></div></div><div class=\"mg-dlg-b\">" + body + '</div><div class="mg-dlg-f">' + foot + "</div></div>";
    const src = '<div class="mg-src">' + av("LK", "") + "<div><b>Lena Kovac</b> <span class=\"muted\">· Client · 10:38 AM</span><div>Looks great. Could you send the final pricing table for approval in the portal?</div></div></div>";
    return page(head("Message actions", "Dialogs opened from the message menu. Shown here side by side for review.", "") +
      '<div class="g2">' +
      dlg("edit", "Edit message", "Author only, within the edit window (edit_time_limit_minutes = 15)", '<div class="editor"><div class="ed-bar"><b>B</b><i>I</i><span>link</span></div><div class="ed-body ink">Looks great, will send the final pricing table this afternoon.</div></div><div class="sub-note" style="margin-top:6px">Shows “(edited)”. Previous version is kept in MessageVersion (preserve_edit_history on).</div>', btn("Cancel") + btn("Save", "", "primary")) +
      dlg("x", "Delete message", "Moderator delete (messaging.messages.delete_any*)", src + f("Reason (required for others’ messages)", sel("Contains personal data")) + callout("shield", "A tombstone remains so the thread stays readable. Reactions and attachments are removed. This is audited.", "warn"), btn("Cancel") + btn("Delete message", "", "primary")) +
      dlg("tasks", "Convert to task", "Creates a task linked back to this message (TaskLink entity_type MESSAGE)", src + f("Title", box("Send final pricing table for approval")) + '<div class="g2" style="gap:10px">' + f("Team", sel("Web · WEB", "users")) + f("Project", sel("Acme Rebrand Website", "folder")) + f("Assignee", sel("Anna Meyer", "users")) + f("Due date", sel("Nov 14", "calendar")) + "</div>" + '<div class="rowx" style="padding:4px 0">' + cb(1) + '<div class="grow">Post the task card in the thread</div></div><div class="rowx" style="padding:4px 0">' + cb(0) + '<div class="grow">Make visible to the customer <small>Task.customer_visible (needs 06 rules)</small></div></div>', btn("Cancel") + btn("Create task", "plus", "primary")) +
      dlg("support", "Create ticket", "Opens a Ticket (13) with this channel as context", src + f("Subject", box("Pricing table approval in the portal")) + '<div class="g2" style="gap:10px">' + f("Inbox", sel("Client support", "inbox")) + f("Priority", sel("Medium")) + f("Type", sel("Request")) + f("Requester", sel("Lena Kovac · Acme Corp", "users")) + "</div>" + '<div class="rowx" style="padding:4px 0">' + cb(1) + '<div class="grow">Copy the message and attachments to the ticket</div></div>', btn("Cancel") + btn("Create ticket", "plus", "primary")) +
      dlg("link", "Forward message", "Needs post permission in the target", src + f("To", sel("Search channels and people…", "search")) + f("Add a note", box("Optional")) + '<div class="sub-note">Forwarding from a client channel into an internal one keeps the External flag off; into another client channel is blocked unless an admin allows it.</div>', btn("Cancel") + btn("Forward", "", "primary")) +
      dlg("clock", "Remind me", "MessageReminder (preset or custom)", '<div class="mg-presets">' + ["In 20 minutes", "In 1 hour", "In 3 hours", "Tomorrow 9:00", "Next week", "Custom…"].map((t, i) => '<span class="seg' + (i === 3 ? " on" : "") + '">' + t + "</span>").join("") + "</div>" + f("Note", box("Optional note to yourself")), btn("Cancel") + btn("Set reminder", "", "primary")) +
      dlg("flag", "Report message", "Goes to the moderation queue (MessageReport)", src + f("Reason", sel("Spam or abuse")) + f("Details", box("What is wrong with this message?")) + '<div class="sub-note">The author is not notified. Admins with messaging.channels.manage review it in Moderation.</div>', btn("Cancel") + btn("Send report", "", "primary")) +
      dlg("send", "Schedule message", "Message.status SCHEDULED · scheduled_for", f("Send at", '<div class="rowx" style="gap:8px;padding:0">' + sel("Nov 12", "calendar") + sel("9:00 AM", "clock") + "</div>", "Your timezone (Europe/Lisbon). Recipients see it only when it is sent.") + '<div class="mg-presets">' + ["Tomorrow 9:00", "Monday 9:00", "In 1 hour"].map((t) => '<span class="seg">' + t + "</span>").join("") + "</div>", btn("Cancel") + btn("Schedule", "", "primary")) +
      "</div>" + dm(["MessageVersion · version, body, edited_by_user_id", "Message · is_edited, deleted_at, delete_reason, scheduled_for, forwarded_from_message_id", "TaskLink (06) · Ticket (13) · MessageRecordShare · MessageReminder · MessageReport"], ["Ticket.source has no value for a chat message and Ticket has no source_message_id: see gaps-12.md"]));
  }

  /* =====================================================================================================================
     HUDDLES, VOICE AND VIDEO CALLS (spec §44)
     @screen Messages · Huddles & calls
     @route  /messages/calls · a live call opens in a dock above the channel (/messages/c/:id?call=:callId)
     @perm   start/join: channel member + MessagingSettings.calls_enabled (@gap: messaging.calls.start, see gaps-12.md) · recording access follows documents.documents.read on the recording document
     @api    POST /channels/:id/calls {kind: HUDDLE|VOICE|VIDEO, title?} · POST /calls/:id/join|leave|end · GET /channels/:id/calls · realtime call.state; provider tokens via MessagingSettings.call_provider (not a BYOK provider of the 5: Meet/Zoom handled by 19 calendar links)
     @mcp    messaging_calls_start (planned, same service)
     @data   ChannelCall (kind, status, started_by_membership_id, provider, meeting_url, calendar_event_id, message_id, screen_sharing_used, started_at, ended_at, duration_seconds, recording_document_id, participant_count) ·
             ChannelCallParticipant (membership_id, external_user_id, invited_at, joined_at, left_at, state) · MessagingSettings (calls_enabled, call_provider)
     @ui     Card (live huddle with participants, mute/camera/screen controls), Table, Badge for ChannelCallStatus, Avatar group, Tooltip
     @states loading · empty ("No calls yet") · calls disabled by admin (banner) · permission error · failed (reason)
     @audit  call started/ended, recording created, external participant joined
     @note   Starting a call posts a SYSTEM message (Message.message_id on ChannelCall) so the timeline shows who and how long. Calls may be linked to a calendar event (19, calendar_event_id). External participants may join only
             in channels with external access and only when the call_provider allows guests.
     ===================================================================================================================== */
  function calls() {
    const part = (k, st, mic) => '<div class="mg-part">' + av(k, "lg", "on") + "<b>" + nm(k) + "</b><small>" + st + "</small>" + (mic ? "" : '<span class="badge">Muted</span>') + "</div>";
    return page(head("Huddles & calls", "Live and past calls from your channels.", btn("Start a huddle", "video", "primary")) +
      callout("video", "<b>Calls are enabled</b> for this organization (MessagingSettings.calls_enabled) · provider: built-in huddle · recording off", "") + '<div style="height:12px"></div>' +
      cd("<b>Live now · # acme-rebrand</b><span class='r'>" + E("IN_PROGRESS", "green") + "</span>", '<div class="mg-live"><div class="mg-parts">' + part("MS", "Presenting", 1) + part("AM", "Speaking", 1) + part("SJ", "Joined 9:44", 0) + part("LK", "Client · joined 9:46", 1) + '</div><div class="mg-ctl"><button class="btn sm">' + I("phone", 14) + " Mute</button><button class=\"btn sm\">" + I("video", 14) + ' Camera</button><button class="btn sm">' + I("panel", 14) + ' Share screen</button><button class="btn sm">' + I("chat", 14) + ' Chat</button><span style="flex:1"></span><button class="btn sm primary">Leave</button></div></div>') + '<div style="height:12px"></div>' +
      FB([["Channel", "is", "Any"], ["Kind", "is any of", "Huddle, Video"], ["Status", "is not", "Cancelled"]], btn("Save view", "plus", "sm")) +
      tbl(["Call", "Channel", "Started by", "Kind", "Status", ">Duration", ">People", "Recording", "Calendar", ""], [
        ["Hero review", "# acme-rebrand", wh("MS", ""), E("HUDDLE"), E("IN_PROGRESS", "green"), "24 min", "4", "—", "—", more], ["Weekly standup", "# dev", wh("JK", ""), E("VIDEO"), E("ENDED"), "18 min", "9", "standup-nov-11.mp4", "Standup · Nov 11", more],
        ["Client call: homepage notes", "# acme-rebrand", wh("AM", ""), E("VIDEO"), E("ENDED"), "42 min", "5", "call-acme-nov-10.mp4", "Calendar event " + muted("(19)"), more], ["Ring Kim", "Direct message", wh("MS", ""), E("VOICE"), E("MISSED", "yellow"), "0 min", "1", "—", "—", more], ["Cutover sync", "Group DM", wh("JK", ""), E("HUDDLE"), E("FAILED", "red"), "—", "1", "—", "—", more]]) +
      dm(["ChannelCall · kind, status, started_by_membership_id, provider, meeting_url, calendar_event_id, message_id, screen_sharing_used, started_at, ended_at, duration_seconds, recording_document_id, participant_count", "ChannelCallParticipant · membership_id, external_user_id, joined_at, left_at, state", "MessagingSettings · calls_enabled, call_provider"], ["Permission key to start/record calls is missing (messaging.calls.start): see gaps-12.md"]));
  }

  /* =====================================================================================================================
     CHANNEL DIRECTORY (spec §6, §7, §8)
     @screen Messages · Browse channels (directory with filters, saved views and bulk actions)
     @route  /messages/directory?kind=&visibility=&status=&member=&owner=&project=&company=&view=
     @perm   VIEW messaging.channels.read (PUBLIC + DISCOVERABLE for everyone; PRIVATE/HIDDEN only members or messaging.channels.manage) · join: self-join of discoverable public channels · create: messaging.channels.create ·
             bulk archive/owner/retention: messaging.channels.manage · retention policy picker needs messaging.retention.manage*
     @api    GET /channels?kind=&visibility=&status=&member=&owner=&project_id=&company_id=&posting_policy=&external=&q=&sort=&cursor= · POST /channels/:id/join · POST /channels/bulk {channel_ids[], action: archive|owner|retention, ...}
     @mcp    messaging_channels_read · messaging_channels_manage (bulk)
     @data   Channel (name, slug, kind, visibility, status, owner_membership_id, member_count, message_count, last_message_at, project_id, company_id, team_id, posting_policy, external_access_enabled, retention_policy_id, archived_at) ·
             ChannelMember · SavedView (entity_type CHANNEL)
     @ui     DataTable with sortable columns and row selection, filter bar (Popover + Command), ToggleGroup of saved views, DropdownMenu row actions, bulk action bar, Badge, Tooltip
     @states loading skeleton rows · empty ("No channels match") · error · no-access
     @audit  join/leave, bulk archive, owner change (audit_events)
     @note   Saved views are SavedView rows (PERSONAL | TEAM | ORGANIZATION). Hidden channels never appear to non-members, not even in counts. Rows show the linked project/customer (project_id, company_id) and an external badge.
     ===================================================================================================================== */
  function directory() {
    const row = (n, k, vis, own, mem, msgs, last, link, post, ext, st, joined) => ["<span class=\"cbw\">" + cb(0) + "</span>", chName(n, k) + (ext ? ' <span class="badge purple">' + I("globe", 11) + " Shared</span>" : ""), kindBadge(k), E(vis, vis === "HIDDEN" ? "yellow" : ""), own, ">" + mem, ">" + msgs, last, link, E(post), E(st, st === "ARCHIVED" ? "" : "green"), joined ? btn("Open", "", "sm") : btn("Join", "plus", "sm primary")];
    return page(head("Browse channels", "Find, join and manage channels. Hidden and private channels only show for members.", btn("Create channel", "plus", "primary")) + pill(["All · 38", "Joined · 12", "Not joined · 18", "Mine · 4", "Client channels · 7", "Project channels · 11", "Archived · 9", "Inactive 30d · 3"], 0) +
      FB([["Kind", "is any of", "Public, Project, Customer"], ["Visibility", "is", "Discoverable"], ["Status", "is", "Active"], ["Last activity", "before", "30 days ago"]], sel("Sort: Last activity", "sort") + btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="sub-note" style="margin-bottom:8px">More filters: Owner · Member · Team · Branch · Project · Customer · Posting policy · External access · Confidential · Template · Created date · Members count · Retention policy</div>' +
      '<div class="bulk"><span>' + cb("mix") + ' <b>3 selected</b></span>' + btn("Archive", "archive", "sm") + btn("Change owner", "users", "sm") + btn("Set retention policy", "clock", "sm") + btn("Export", "down", "sm") + '<span style="flex:1"></span>' + btn("Clear selection", "", "sm ghost") + "</div>" +
      tbl(["", "Channel", "Kind", "Visibility", "Owner", ">Members", ">Messages", "Last activity", "Linked", "Posting", "Status", ""], [
        row("general", "PUBLIC", "DISCOVERABLE", "Anna Meyer", 48, "12,410", "2 min ago", "—", "ALL_MEMBERS", 0, "ACTIVE", 1), row("dev", "PUBLIC", "DISCOVERABLE", "Sofia Jensen", 24, "8,231", "5 min ago", "Team Web", "ALL_MEMBERS", 0, "ACTIVE", 1),
        row("announcements", "ANNOUNCEMENT", "DISCOVERABLE", "Anna Meyer", 48, "212", "Today", "—", "ADMINS_ONLY", 0, "ACTIVE", 1), row("acme-rebrand", "PROJECT", "HIDDEN", "Anna Meyer", 8, "1,038", "10:44 AM", "Project Acme Rebrand Website", "ALL_MEMBERS", 1, "ACTIVE", 1),
        row("acme-corp", "CUSTOMER", "HIDDEN", "Kim Lund", 7, "642", "8:42 AM", "Customer Acme Corp", "ALL_MEMBERS", 1, "ACTIVE", 1), row("design", "PUBLIC", "DISCOVERABLE", "Marco Silva", 11, "3,102", "Yesterday", "Team Design", "ALL_MEMBERS", 0, "ACTIVE", 0),
        row("sales", "PRIVATE", "HIDDEN", "Kim Lund", 6, "1,877", "Yesterday", "Team Sales", "ALL_MEMBERS", 0, "ACTIVE", 1), row("deal-globex-q4", "RECORD", "HIDDEN", "Kim Lund", 4, "58", "Nov 8", "CRM deal Globex Q4", "ALL_MEMBERS", 0, "ACTIVE", 0),
        row("proj-mobile-v1", "PROJECT", "HIDDEN", "Jonas Koch", 9, "4,990", "Sep 12", "Project Mobile App v1", "ALL_MEMBERS", 0, "ARCHIVED", 0)]) +
      '<div class="pager"><span class="muted">Showing 9 of 38 · cursor pagination</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["Channel · name, slug, kind, visibility, status, owner_membership_id, member_count, message_count, last_message_at, project_id, company_id, team_id, posting_policy, external_access_enabled, retention_policy_id, archived_at", "ChannelMember · joined_at, role", "SavedView · entity_type CHANNEL"], []));
  }

  /* =====================================================================================================================
     CREATE CHANNEL — full page (spec §6-9, §26-27, §82, §93-94)
     @screen Messages · Create channel
     @route  /messages/channels/new?kind=&project=&company=&template=&from=<entityType>:<id> · a quick-create dialog (name, kind, members) uses the same fields
     @perm   messaging.channels.create · visibility HIDDEN/PRIVATE and posting policy: same key · adding members messaging.channel_members.manage · enabling external access / inviting guests messaging.external_users.manage* ·
             retention policy picker messaging.retention.manage* · linking a project/customer needs projects.projects.read / crm.companies.read on it · templates messaging.channels.manage
     @api    POST /channels {kind, name, slug, display_name, description, purpose, topic, icon, color, visibility, posting_policy, team_id?, branch_id?, project_id?, company_id?, entity_type?, entity_id?, external_access_enabled,
             read_receipts_enabled?, default_notification_level?, auto_join, require_acknowledgement, is_confidential, retention_policy_id?, template_id?, expires_at?, auto_archive_at?, members[{membership_id|team_id|role_id, role, source}],
             guests[{email, name, guest_kind, access_expires_at, external_label, role}]} · GET /channels/check-name?slug=
     @mcp    messaging_channels_create (same validation as the UI)
     @data   Channel (every column listed) · ChannelMember (role, source MANUAL | TEAM | ROLE | PROJECT | CUSTOMER | ORGANIZATION_DEFAULT | TEMPLATE, guest_kind, access_expires_at, external_label, is_required) ·
             ChannelTemplate (defaults) · MessagingRetentionPolicy · MessagingSettings.channel_naming_rules · Team · Project (05) · CrmCompany (02)
     @ui     shadcn Form with sections, RadioGroup cards (kind), Input with slug preview, Select / Popover+Command (people, teams, roles, project, customer), DatePicker, Switch, Textarea, Badge, sticky summary Card, Ctrl+Enter submits
     @states validation errors inline (name taken, naming rule not matched, slug reserved) · saving · saved (toast with link and Undo) · permission error on a field (control disabled with the reason) · draft restored
     @audit  channel created (with template, linked record, external access), members and guests added
     @note   DIRECT and GROUP_DIRECT are not created here: they are created by the New message flow (idempotent by dm_key). Choosing PROJECT or CUSTOMER requires a link and defaults the members to the project team / the
             account team (source PROJECT / CUSTOMER). PROJECT/CUSTOMER with external access invites guests: each guest gets guest_kind and an optional expiry. A template (ChannelTemplate) fills defaults and pins but never overrides
             what the user typed. Naming rules (MessagingSettings.channel_naming_rules, spec §94) are validated live: e.g. project channels must start with “proj-”.
     @gap    Secure guest invitations (token, status, resend) have no table: ChannelMember only holds the accepted person. See gaps-12.md (ChannelInvitation).
     ===================================================================================================================== */
  function create() {
    const kinds = [["PUBLIC", "hash", "Everyone in the organization can find and join."], ["PRIVATE", "lock", "Invite only. Not visible to others."], ["PROJECT", "folder", "Linked to a project. Members follow the project team."], ["CUSTOMER", "globe", "Linked to a customer. Guests can be invited."], ["ANNOUNCEMENT", "flag", "Few post, many read. Acknowledgements supported."], ["RECORD", "link", "Tied to one record: a deal, invoice, ticket."]];
    return page(head("Create channel", "Set up a space for a team, a project or a customer.", btn("Cancel") + btn("Save as draft") + btn("Create channel", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>Type</b><span class='r muted'>Channel.kind</span>", '<div class="mg-kinds">' + kinds.map((k, i) => '<div class="mg-kind' + (i === 2 ? " on" : "") + '"><span class="mg-ch-ic">' + I(k[1], 16) + "</span><b>" + U.en(k[0]) + "</b><small>" + k[2] + "</small></div>").join("") + '</div><div class="sub-note" style="margin-top:8px">Direct and group messages start from “New message”. They are not channels you name.</div>') +
      gap(cd("<b>Details</b>", f("Name", '<div class="rowx" style="gap:8px;padding:0"><span class="muted">#</span>' + box("proj-acme-website-launch") + "</div>", "Naming rule: project channels start with “proj-”. Checked live against MessagingSettings.channel_naming_rules.") +
        '<div class="g2" style="gap:12px">' + f("Slug (unique identifier)", box("proj-acme-website-launch"), "Channel.slug, unique per organization") + f("Display name (optional)", box("Acme website launch")) + "</div>" +
        '<div class="g2" style="gap:12px">' + f("Icon", sel("Folder", "folder")) + f("Colour", sel("Blue")) + "</div>" + f("Topic", box("Short line shown in the header"), "Channel.topic · members with channel admin role can change it later") + f("Purpose", box("Why this channel exists")) +
        f("Description", '<div class="editor"><div class="ed-bar"><b>B</b><i>I</i><span>link</span></div><div class="ed-body">Describe the channel, ground rules and pinned links.</div></div>'))) +
      gap(cd("<b>Links</b><span class='r muted'>project, customer, team, branch, record</span>", '<div class="g2" style="gap:12px">' + f("Project", sel("Acme Rebrand Website", "folder"), "Channel.project_id (05). Required for the Project type.") + f("Customer", sel("Acme Corp", "building"), "Channel.company_id (02). Required for the Customer type.") + f("Team", sel("Web", "users"), "Channel.team_id") + f("Branch", sel("Lisbon HQ", "building"), "Channel.branch_id") + "</div>" +
        f("Business record (RECORD type)", sel("Choose a record type, then a record…", "link"), "Channel.entity_type (RecordEntityType) + entity_id: a deal, an invoice, a ticket, a contract. Only one channel per record."))) +
      gap(cd("<b>Members</b><span class='r muted'>ChannelMember</span>", f("Add people, teams or roles", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + [["Anna Meyer", "OWNER"], ["Marco Silva", "MEMBER"], ["Sofia Jensen", "MEMBER"]].map((p) => tok(p[0] + " · " + U.en(p[1]))).join("") + tok("Team: Web · 9 · source TEAM") + tok("Role: Project manager · 3 · source ROLE") + btn("Add", "plus", "sm") + "</div>", "ChannelMember.source: MANUAL, TEAM, ROLE, PROJECT, CUSTOMER, ORGANIZATION_DEFAULT, TEMPLATE. Team and role members stay in sync.") +
        '<div class="rowx"><div class="grow"><b>Add the project team automatically</b><small>Source PROJECT: new project members join, removed members leave</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Everyone joins automatically</b><small>Channel.auto_join (public channels only)</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Members cannot leave</b><small>ChannelMember.is_required</small></div>' + sw(0) + "</div>")) +
      gap(cd("<b>Guests & external participants</b><span class='r muted'>messaging.external_users.manage*</span>", '<div class="rowx"><div class="grow"><b>Allow external access</b><small>Channel.external_access_enabled · MessagingSettings.external_access_enabled must be on</small></div>' + sw(1) + "</div>" +
        f("Invite people", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + tok("Lena Kovac · lena@acme.example") + tok("Dana Whitfield · dana@acme.example") + btn("Invite", "plus", "sm") + "</div>", "Existing customer portal users are found by name; new people receive a secure invitation by email.") +
        '<div class="g2" style="gap:12px">' + f("Guest kind", sel("Customer")) + f("Access expires", sel("Dec 31, 2026", "calendar"), "ChannelMember.access_expires_at · empty means no expiry (Temporary guests need a date)") + f("Label shown next to the name", box("Acme Corp"), "ChannelMember.external_label: “Lena Kovac, Acme Corp, Guest”") + f("Role", sel("External")) + "</div>")) +
      "</div><div>" +
      cd("<b>Posting & behaviour</b>", f("Who can post", sel("All members"), "ChannelPostingPolicy: all members, internal members only, admins only, owners only") + f("Visibility", '<div class="seg-row"><span class="seg on">Discoverable</span><span class="seg">Hidden</span></div>', "Hidden channels do not appear in the directory or in search for non-members.") +
        f("Default notification level", sel("Mentions and direct"), "ChannelNotificationLevel · members can override") + '<div class="rowx"><div class="grow"><b>Read receipts</b><small>Channel.read_receipts_enabled (inherit org default)</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Require acknowledgement</b><small>For announcements</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Confidential</b><small>Channel.is_confidential: no export without messaging.data.export*</small></div>' + sw(0) + "</div>") +
      gap(cd("<b>Template & lifecycle</b>", f("Template", sel("New project channel", "layers"), "ChannelTemplate · trigger PROJECT_CREATED") + f("Retention policy", sel("Organization default · 3 years", "clock")) + f("Auto-archive on", sel("When the project completes + 30 days"), "Channel.auto_archive_at is set from the rule") + f("Expires on", sel("No expiry", "calendar"), "Channel.expires_at (temporary channels)"))) +
      gap(cd("<b>Summary</b>", '<div class="mg-sum">' + chName("proj-acme-website-launch", "PROJECT") + "<small>Project channel · linked to Acme Rebrand Website · Acme Corp</small></div>" + kv("Members", "3 people + Web team (9) + 3 PMs") + kv("Guests", "2, expire Dec 31") + kv("Pinned from template", "Project overview, dashboard link") + kv("Retention", "3 years, then archive") + callout("shield", "External access is on. Staff will see an External / Internal switch in the composer.", "warn"))) +
      "</div></div>" +
      dm(["Channel · kind, name, slug, display_name, description, purpose, topic, icon, color, visibility, posting_policy, team_id, branch_id, project_id, company_id, entity_type, entity_id, external_access_enabled, read_receipts_enabled, default_notification_level, auto_join, require_acknowledgement, is_confidential, retention_policy_id, template_id, expires_at, auto_archive_at", "ChannelMember · role, source, guest_kind, access_expires_at, external_label, is_required, invited_by_user_id", "ChannelTemplate · MessagingRetentionPolicy · MessagingSettings.channel_naming_rules"], ["Guest invitation (token, status, resend, accepted_at) has no table: gaps-12.md"]));
  }

  /* =====================================================================================================================
     CHANNEL SETTINGS, MEMBERS AND PERMISSIONS (spec §7-9, §48-49, §81-82, §95)
     @screen Messages · Channel settings (#acme-rebrand)
     @route  /messages/c/:channelId/settings?tab=general|members|permissions|notifications|external|integrations|lifecycle
     @perm   VIEW members of the channel · edit topic/description: channel ADMIN/OWNER or messaging.channels.manage · members/roles messaging.channel_members.manage · external users messaging.external_users.manage* ·
             restrictions (mute/ban) messaging.channel_members.manage · retention messaging.retention.manage* · integrations messaging.integrations.manage* · delete channel messaging.channels.manage
     @api    PATCH /channels/:id · GET|POST|PATCH|DELETE /channels/:id/members · POST /channels/:id/restrictions {membership_id|external_user_id, kind MUTED|BANNED, reason, expires_at} · POST /channels/:id/archive {reason} · DELETE /channels/:id
     @mcp    messaging_channels_manage · messaging_channel_members_manage
     @data   Channel (all editable columns, status, archived_at, archive_reason, deleted_at) · ChannelMember (role, source, guest_kind, access_expires_at, left_at, removed_at, is_required) · ChannelMemberRestriction (kind,
             reason, expires_at, lifted_at) · ChannelPin · MessagingIntegration (default_channel_id, allowed_channel_ids) · OutboundWebhook (Channel link, 20) · MessagingRetentionPolicy
     @ui     Tabs, DataTable with inline Select (role), DropdownMenu row actions, Dialog (Add members), AlertDialog (archive, delete), Switch, Select, Badge, Command (people picker)
     @states loading · empty members · error · no-access (members tab hidden without the key) · archived (read-only banner with Unarchive)
     @audit  every change (topic, description, posting policy, role changes, member removed, mute/ban, external access, archive/restore/delete) is an audit event; moderation actions are auditable (spec §49)
     @note   Moderation (§49): restrict posting (policy or MUTED restriction), remove members, manage permissions, delete messages, pin, archive, change topic/description, manage external access. Removing a member sets removed_at/
             removed_by_user_id and keeps their messages. BANNED prevents re-joining. A member synced from a TEAM or PROJECT (source) cannot be removed by hand: remove them from the team instead (shown with a lock).
     ===================================================================================================================== */
  function chset() {
    const mem = (k, role, src, extra, act) => ["<span class=\"cbw\">" + cb(0) + "</span>", wh(k, P[k][3] ? P[k][2] + " · Client" : P[k][2]), sel(U.en(role)), E(src), extra, k === "AM" ? "Today" : "Yesterday", act || more];
    return page('<div class="mg-bc"><a>' + I("folder", 13) + " acme-rebrand</a>" + I("right", 12) + "<b>Settings</b></div>" + head("Channel settings", "# acme-rebrand · Project channel · Acme Rebrand Website · 8 members", btn("Open channel", "chat") + btn("Save changes", "", "primary")) + '<div class="tabset">' +
      tabs([["g", "General"], ["m", "Members", 8], ["p", "Permissions"], ["n", "Notifications"], ["e", "External & guests", 2], ["i", "Integrations", 1], ["l", "Lifecycle"]], "g") +
      pane("g", 1, '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' + cd("<b>Identity</b>", f("Name", box("acme-rebrand")) + f("Slug", box("acme-rebrand"), "Changing the slug keeps old links working (redirect)") + f("Display name", box("Acme Rebrand")) + f("Topic", box("Brand refresh and new marketing site")) + f("Purpose", box("Coordinate the Acme rebrand with the client")) + f("Description", '<div class="editor"><div class="ed-bar"><b>B</b><i>I</i></div><div class="ed-body ink">Shared with Acme Corp. Use threads for feedback on deliverables. Approvals happen in the customer portal.</div></div>')) + "</div><div>" +
        cd("<b>Appearance & links</b>", f("Icon", sel("Folder", "folder")) + f("Colour", sel("Blue")) + f("Project", sel("Acme Rebrand Website", "folder")) + f("Customer", sel("Acme Corp", "building")) + f("Team", sel("Web", "users")) + f("Business record", sel("None", "link"))) +
        gap(cd("<b>Pinned messages</b><span class='r muted'>ChannelPin</span>", '<div class="rowx">' + I("pin", 14) + '<div class="grow">Brand guidelines v2<small>Pinned by Anna Meyer</small></div>' + more + '</div><div class="rowx">' + I("pin", 14) + '<div class="grow">Pricing table scope (CR-12)<small>Pinned by Kim Lund</small></div>' + more + "</div>", 1)) + "</div></div>") +
      pane("m", 0, FB([["Role", "is any of", "Owner, Admin, Member"], ["Source", "is not", "Template"]], btn("Add members", "plus", "sm primary") + btn("Add team", "users", "sm")) + '<div class="bulk"><span>' + cb("mix") + " <b>2 selected</b></span>" + btn("Change role", "users", "sm") + btn("Mute", "bell", "sm") + btn("Remove", "x", "sm") + "</div>" +
        tbl(["", "Member", "Role", "Source", "Notes", "Last viewed", ""], [mem("AM", "OWNER", "MANUAL", "Channel owner"), mem("MS", "MEMBER", "PROJECT", lock + " Synced from project team", lockMore), mem("SJ", "MEMBER", "PROJECT", lock + " Synced from project team", lockMore), mem("KL", "ADMIN", "MANUAL", "Moderator"), mem("JK", "MEMBER", "TEAM", lock + " Team Web", lockMore), mem("LK", "EXTERNAL", "MANUAL", "Guest · expires Dec 31"), mem("DW", "READ_ONLY", "MANUAL", "Guest · read only · no expiry")]) + '<div class="sub-note" style="margin-top:6px">Roles: ChannelMemberRole OWNER, ADMIN, MEMBER, GUEST, EXTERNAL, READ_ONLY. Locked rows come from a project or team: change the source, not the row.</div>') +
      pane("p", 0, '<div class="g2" style="align-items:start"><div>' + cd("<b>Who can do what</b>", f("Posting policy", sel("All members"), "ChannelPostingPolicy") + f("Who can pin messages", sel("Admins and owners"), "Needs messaging.messages.pin") + f("Who can add members", sel("Admins and owners"), "Needs messaging.channel_members.manage") + f("Who can delete others’ messages", sel("Admins and owners"), "Channel admins moderate; org-wide deletion needs messaging.messages.delete_any*") + f("Broadcast mentions (@channel)", sel("Admins only"), "MessagingSettings.broadcast_mention_policy applies as the ceiling")) + "</div><div>" +
        cd("<b>Restrictions</b><span class='r muted'>ChannelMemberRestriction</span>", tbl(["Person", "Kind", "Reason", "Until", ""], [[wh("DW", ""), E("MUTED", "yellow"), "Off-topic posts", "Nov 14", btn("Lift", "", "sm")], [wh("KL", ""), "—", "", "", ""]].slice(0, 1)) + '<div class="rowx">' + btn("Mute someone", "bell", "sm") + btn("Ban someone", "x", "sm") + "</div>", 1) + "</div></div>") +
      pane("n", 0, '<div class="g2" style="align-items:start"><div>' + cd("<b>Channel defaults</b><span class='r muted'>Channel.default_notification_level</span>", f("Default level for new members", sel("Mentions and direct")) + '<div class="rowx"><div class="grow"><b>Read receipts</b><small>Channel.read_receipts_enabled</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Priority customer messages</b><small>ChannelNotificationSetting.priority_customer_messages default on for the account team</small></div>' + sw(1) + "</div>") + "</div><div>" +
        cd("<b>Your settings for this channel</b><span class='r muted'>ChannelNotificationSetting</span>", f("Level", sel("Mentions and direct")) + '<div class="rowx"><div class="grow">Thread replies you follow</div>' + sw(1) + '</div><div class="rowx"><div class="grow">Reactions to your messages</div>' + sw(0) + '</div><div class="rowx"><div class="grow">My keywords</div>' + sw(1) + "</div>" + f("Digest", sel("Daily")) + f("Mute until", sel("Not muted", "bell"))) + "</div></div>") +
      pane("e", 0, cd("<b>External access</b><span class='r muted'>messaging.external_users.manage*</span>", '<div class="rowx"><div class="grow"><b>Allow external participants</b><small>Channel.external_access_enabled · turning it off removes every external member and hides EXTERNAL messages from them</small></div>' + sw(1) + "</div>", 1) +
        gap(tbl(["Guest", "Company / label", "Kind", "Role", "Expires", "Invited by", ""], [[wh("LK", "lena@acme.example"), "Acme Corp", E("CUSTOMER", "purple"), E("EXTERNAL", "purple"), "Dec 31, 2026", "Anna Meyer", more], [wh("DW", "dana@acme.example"), "Acme Corp", E("CUSTOMER", "purple"), E("READ_ONLY"), muted("never"), "Kim Lund", more]])) + '<div style="margin-top:8px">' + btn("Invite guest", "plus", "primary") + "</div>") +
      pane("i", 0, cd("<b>Integrations posting here</b><span class='r muted'>messaging.integrations.manage*</span>", '<div class="rowx"><div class="grow"><b>Automation (task status changes)</b><small>MessagingIntegration · kind BOT · rate limit 30/min · last event 9:15 AM</small></div>' + ES("ACTIVE", "green") + more + '</div><div class="rowx"><div class="grow muted">Outbound webhook “channel.message.created” → 2 endpoints (20)</div>' + btn("Manage", "", "sm") + "</div>", 1)) +
      pane("l", 0, '<div class="g2" style="align-items:start"><div>' + cd("<b>Retention & archive</b>", f("Retention policy", sel("Organization default · 3 years", "clock")) + f("Auto-archive on", sel("Project completes + 30 days")) + f("Expires on", sel("No expiry", "calendar")) + f("Created from template", sel("New project channel", "layers"))) + "</div><div>" +
        cd("<b>Danger zone</b>", setting("Archive channel", "Read-only, stays searchable per retention. Channel.status ARCHIVED, archive_reason required.", btn("Archive", "archive")) + setting("Delete channel", "Soft delete (DELETED), restorable for 30 days by admins. Needs messaging.channels.manage.", btn("Delete", "x")) + setting("Convert to private channel", "Hides from the directory and keeps the members.", btn("Convert", "lock"))) + "</div></div>") + "</div>" +
      dm(["Channel · name, slug, display_name, topic, purpose, description, icon, color, posting_policy, default_notification_level, read_receipts_enabled, external_access_enabled, status, archive_reason, retention_policy_id, auto_archive_at, expires_at", "ChannelMember · role, source, guest_kind, access_expires_at, removed_at", "ChannelMemberRestriction · kind, reason, expires_at, lifted_at · ChannelNotificationSetting · ChannelPin · MessagingIntegration"], []));
  }
  const lock = I("lock", 12), lockMore = '<button class="btn ghost sm icon" disabled title="Synced from the project team">' + I("lock", 14) + "</button>";

  /* =====================================================================================================================
     MY MESSAGING PREFERENCES (spec §16-17, §19, §4, §80)
     @screen Messages · Notification & personal preferences
     @route  /messages/preferences?tab=defaults|channels|keywords|sidebar|status
     @perm   own settings only (no key beyond messaging.channels.read); delivery channels honour notifications.preferences.manage_own (14)
     @api    GET|PUT /me/messaging/settings · GET|PUT /channels/:id/notification-settings · GET|POST|DELETE /me/messaging/keywords · GET|PUT /me/messaging/sections · PUT /me/presence {manual_state, status_text, status_emoji, status_expires_at}
     @mcp    none (personal UI setting; no agent tool)
     @data   MessagingMemberSettings (default_channel_level, default_dm_level, notification_previews_with_text, notification_sound, share_read_receipts, share_typing_indicator, keyboard_shortcuts, sidebar_preferences, composer_preferences) ·
             ChannelNotificationSetting (level, notify_thread_replies, notify_reactions, notify_keywords, desktop_enabled, mobile_enabled, email_enabled, sound, schedule, digest_frequency, priority_customer_messages) · ChannelMember.muted_until ·
             MessagingKeyword · ChannelSection / ChannelSectionItem · MessagingPresence
     @ui     Tabs, Select, Switch, RadioGroup for ChannelNotificationLevel, DataTable with inline controls, Popover (emoji status), time-range picker (do-not-disturb schedule), drag-and-drop sections
     @states loading · saved (autosave toast) · error · defaults overridden by organization (MessagingSettings.default_notification_level shown as the fallback)
     @audit  none (personal), except organization-forced settings
     @note   Resolution order for a notification: ChannelNotificationSetting.level, else MessagingMemberSettings default for DM vs channel, else Channel.default_notification_level, else MessagingSettings.default_notification_level.
             Previews with text can be forced off by MessagingSettings.notification_previews_include_text. Do-not-disturb uses ChannelNotificationSetting.schedule and MessagingPresence.manual_state DO_NOT_DISTURB.
     ===================================================================================================================== */
  function prefs() {
    const chrow = (n, lvl, a, b, c, d, dig) => ["<b>" + n + "</b>", sel(U.en(lvl)), sw(a), sw(b), sw(c), sw(d), sel(U.en(dig))];
    return page(head("Messaging preferences", "How and when Messages notifies you. Saved automatically.", "") + '<div class="tabset">' + tabs([["d", "Defaults"], ["c", "Per channel", 12], ["k", "Keywords", 2], ["s", "Sidebar sections", 3], ["u", "Status & presence"]], "d") +
      pane("d", 1, '<div class="g2" style="align-items:start"><div>' + cd("<b>Notification defaults</b><span class='r muted'>MessagingMemberSettings</span>", f("Channels", sel("Mentions and direct"), "default_channel_level (org default: Mentions and direct)") + f("Direct messages", sel("All messages"), "default_dm_level") + f("Sound", sel("Pebble")) + '<div class="rowx"><div class="grow"><b>Show message text in notifications</b><small>Off when the organization hides text in previews</small></div>' + sw(1) + "</div>") + "</div><div>" +
        cd("<b>Privacy</b>", '<div class="rowx"><div class="grow"><b>Share read receipts</b><small>share_read_receipts · only visible if the organization enables them</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Share typing indicator</b><small>share_typing_indicator</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Hide my presence</b><small>MessagingPresence.presence_hidden</small></div>' + sw(0) + "</div>") +
        gap(cd("<b>Do not disturb</b>", f("Schedule", '<div class="rowx" style="gap:8px;padding:0">' + sel("18:00", "clock") + "<span>to</span>" + sel("08:00", "clock") + "</div>", "Weekdays. Mentions from priority customer channels may still break through if enabled per channel.") + '<div class="rowx"><div class="grow">Mute everything for…</div>' + sel("1 hour", "bell") + "</div>")) + "</div></div>") +
      pane("c", 0, FB([["Level", "is not", "Nothing"]], sel("Digest: any")) + tbl(["Channel", "Level", "Thread replies", "Reactions", "Keywords", "Priority customer", "Digest"], [chrow("# dev", "MENTIONS_AND_DIRECT", 1, 0, 1, 0, "DAILY"), chrow("# acme-rebrand", "ALL_MESSAGES", 1, 1, 1, 1, "NONE"), chrow("# acme-corp", "ALL_MESSAGES", 1, 0, 1, 1, "NONE"), chrow("# general", "NOTHING", 0, 0, 0, 0, "WEEKLY"), chrow("# announcements", "MENTIONS_AND_DIRECT", 0, 0, 0, 0, "NONE")]) + '<div class="sub-note" style="margin-top:6px">Also per channel: desktop, mobile and email delivery, sound and schedule (CUSTOM level). Mute until stored in ChannelMember.muted_until.</div>') +
      pane("k", 0, cd("<b>Keywords</b><span class='r'>" + btn("Add keyword", "plus", "sm") + "</span>", [["invoice", "Whole word", "Not case sensitive", 1], ["VAT", "Whole word", "Case sensitive", 1], ["outage", "Any match", "Not case sensitive", 0]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + " · " + r[2] + "</small></div>" + sw(r[3]) + more + "</div>").join(""), 1)) +
      pane("s", 0, '<div class="g2" style="align-items:start"><div>' + cd("<b>Sections</b><span class='r muted'>ChannelSection · drag to reorder</span>", [["Clients", "globe", "3 channels"], ["Projects", "folder", "5 channels"], ["Focus", "star", "2 channels"]].map((r) => '<div class="rowx">' + I(r[1], 14) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[2] + "</small></div>" + more + "</div>").join("") + '<div class="rowx">' + btn("New section", "plus", "sm") + "</div>", 1) + "</div><div>" + cd("<b>Sidebar</b>", '<div class="rowx"><div class="grow">Show unread channels first</div>' + sw(0) + '</div><div class="rowx"><div class="grow">Hide channels without activity for 30 days</div>' + sw(1) + '</div><div class="rowx"><div class="grow">Show DMs above channels</div>' + sw(0) + "</div>") + "</div></div>") +
      pane("u", 0, cd("<b>Status</b><span class='r muted'>MessagingPresence</span>", f("Custom status", '<div class="rowx" style="gap:8px;padding:0">' + box("🎧 Focus time") + sel("Until 12:00", "clock") + "</div>") + f("Presence", '<div class="seg-row">' + ["ACTIVE", "AWAY", "DO_NOT_DISTURB", "OFFLINE"].map((s, i) => '<span class="seg' + (i === 0 ? " on" : "") + '" title="MessagingPresenceState ' + s + '">' + U.en(s) + "</span>").join("") + "</div>", "manual_state with manual_state_until overrides the automatic state"))) + "</div>" +
      dm(["MessagingMemberSettings · ChannelNotificationSetting · ChannelMember.muted_until", "MessagingKeyword · ChannelSection · ChannelSectionItem · MessagingPresence"], []));
  }

  /* =====================================================================================================================
     CHANNEL TEMPLATES (spec §93-95)
     @screen Messages · Channel templates (list + editor)
     @route  /messages/templates · /messages/templates/new · /messages/templates/:id
     @perm   VIEW messaging.channels.read · create/edit/delete messaging.channels.manage (@gap: a dedicated messaging.templates.manage is suggested in gaps-12.md) · retention policy field needs messaging.retention.manage*
     @api    GET|POST|PATCH|DELETE /channel-templates · POST /channel-templates/:id/apply {project_id | company_id}
     @mcp    messaging_channel_templates_manage (planned)
     @data   ChannelTemplate (name, description, channel_kind, trigger MANUAL | PROJECT_CREATED | CUSTOMER_CREATED, name_pattern, default_description, default_purpose, default_topic, posting_policy, visibility, external_access, member_rules,
             pinned_content, discussion_sections, archive_rule, retention_policy_id, is_active) · Channel.template_id
     @ui     DataTable, split editor with Form sections, Input with token chips ({project_key}, {customer}), Select, Switch, Dialog for adding member rules
     @states loading · empty ("No templates yet") · error · no-access · validation of name_pattern tokens
     @audit  template created/changed/deactivated; applying a template writes channel creation audit with template_id
     @note   A template with trigger PROJECT_CREATED creates the channel when a project (05) is created (MessagingSettings.auto_create_project_channels). member_rules, pinned_content, discussion_sections and archive_rule are Json
             in the schema: the editor builds them as lists (see right side), validated by the API.
     ===================================================================================================================== */
  function templates() {
    return page(head("Channel templates", "Recurring spaces created with the same members, pins and rules.", btn("New template", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.2fr 1fr;align-items:start"><div>' + tbl(["Template", "Kind", "Trigger", "Name pattern", "External", "Retention", "Active", ""], [
        ["<b>New project channel</b>", kindBadge("PROJECT"), E("PROJECT_CREATED", "blue"), "<code>proj-{project_key}</code>", "No", "3 years", sw(1), more], ["<b>Customer onboarding</b>", kindBadge("CUSTOMER"), E("CUSTOMER_CREATED", "blue"), "<code>cust-{customer_slug}</code>", "Yes", "7 years", sw(1), more], ["<b>Incident room</b>", kindBadge("PRIVATE"), E("MANUAL"), "<code>inc-{date}-{title}</code>", "No", "1 year", sw(1), more], ["<b>Offsite planning</b>", kindBadge("PUBLIC"), E("MANUAL"), "<code>team-{title}</code>", "No", "90 days", sw(0), more]]) + "</div><div>" +
      cd("<b>Edit: New project channel</b><span class='r'>" + btn("Save", "", "sm primary") + "</span>", f("Name", box("New project channel")) + f("Name pattern", box("proj-{project_key}"), "Tokens: {project_key}, {project_name}, {customer_slug}, {date}, {title}") + '<div class="g2" style="gap:12px">' + f("Trigger", sel("Project created")) + f("Kind", sel("Project")) + f("Posting policy", sel("All members")) + f("Visibility", sel("Hidden")) + "</div>" +
        f("Default topic", box("{project_name} · {project_status}")) + f("Default purpose", box("Coordinate delivery of {project_name}")) +
        f("Member rules", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + tok("Project owner · OWNER") + tok("Project team · MEMBER · source PROJECT") + tok("Role Project manager · ADMIN") + btn("Add rule", "plus", "sm") + "</div>", "ChannelTemplate.member_rules") +
        f("Pinned content", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + tok("Project overview card") + tok("Link: project dashboard") + tok("Welcome message") + btn("Add", "plus", "sm") + "</div>", "pinned_content: posted and pinned on creation") +
        f("Discussion sections", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + tok("Design") + tok("Development") + tok("Approvals") + btn("Add", "plus", "sm") + "</div>", "discussion_sections: starter threads") + f("Archive rule", sel("30 days after the project completes"), "archive_rule") + f("Retention policy", sel("Organization default · 3 years", "clock")) +
        '<div class="rowx"><div class="grow"><b>External access</b><small>ChannelTemplate.external_access</small></div>' + sw(0) + "</div>") + "</div></div>" +
      dm(["ChannelTemplate · name, channel_kind, trigger, name_pattern, default_description, default_purpose, default_topic, posting_policy, visibility, external_access, member_rules, pinned_content, discussion_sections, archive_rule, retention_policy_id, is_active", "Channel · template_id"], ["No dedicated permission key for templates (messaging.templates.manage): gaps-12.md"]));
  }

  /* =====================================================================================================================
     ADMIN DASHBOARD (spec §66-67, §104)
     @screen Messages · Admin overview (users, channels, guests, storage, usage, moderation)
     @route  /messages/admin?range=7d|30d|90d&branch=&team=
     @perm   usage numbers messaging.settings.manage* or messaging.users.manage (@gap: messaging.analytics.read suggested) · moderation snapshot messaging.channels.manage · audit link messaging.audit.read* · data export messaging.data.export*
     @api    GET /messaging/admin/overview?range= (aggregates MessagingUsageDaily) · GET /messaging/admin/storage · GET /messaging/admin/health (integrations, queues)
     @mcp    messaging_admin_overview_read (read-only, planned)
     @data   MessagingUsageDaily (messages_count, direct_messages_count, threads_count, thread_replies_count, reactions_count, files_count, files_bytes, active_members_count, active_channels_count, external_messages_count, mentions_count,
             avg_response_seconds, unread_snapshot, channel_id) · Channel (member_count, message_count) · MessageReport · MessagingIntegration (status, last_error) · MessagingExportJob
     @ui     Tabs for range, stat cards, bar chart (Recharts), DataTable, Badge, Progress for storage
     @states loading · empty ("No usage yet") · error · no-access (analytics hidden, only own counts)
     @audit  viewing aggregated admin data is not audited; opening a private conversation is (separate flow)
     @note   Usage is pre-aggregated per day (and per channel) by a nightly job into MessagingUsageDaily so the dashboard never scans Message. Per-person message counts are not shown by default (privacy, spec §53): only channels
             and organization totals.
     ===================================================================================================================== */
  function admin() {
    const days = [38, 52, 61, 58, 70, 44, 22, 55, 66, 72, 69, 78, 40, 24];
    return page(head("Messaging admin", "Usage, channels, guests, storage, moderation and integrations.", sel("Last 30 days", "calendar") + btn("Export report", "down")) +
      '<div class="mini-stats">' + stat("Messages", "18,420", "+8% vs previous") + stat("Active members", "47 / 52", "90% of seats") + stat("Active channels", "31", "of 38") + stat("External messages", "1,204", "6.5%") + stat("Median first response", "11 min", "−2 min") + stat("Storage", "6.4 GB", "of 50 GB") + "</div>" +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' + cd("<b>Messages per day</b><span class='r muted'>MessagingUsageDaily.messages_count</span>", '<div class="mg-chart">' + days.map((d, i) => '<div class="mg-bar" title="Nov ' + (i + 1) + ': ' + d * 12 + ' messages"><i style="height:' + d + '%"></i></div>').join("") + '</div><div class="sub-note">Weekends are lower. Direct messages 41% · thread replies 22% · reactions 3,880 · files 612.</div>') +
      gap(cd("<b>Most active channels</b>", tbl(["Channel", "Kind", ">Messages", ">Active members", ">Threads", "Avg response"], [[chName("dev", "PUBLIC"), kindBadge("PUBLIC"), "3,210", "21", "412", "9 min"], [chName("acme-rebrand", "PROJECT"), kindBadge("PROJECT"), "1,038", "8", "96", "14 min"], [chName("general", "PUBLIC"), kindBadge("PUBLIC"), "2,402", "44", "120", "—"], [chName("acme-corp", "CUSTOMER"), kindBadge("CUSTOMER"), "642", "7", "58", "1 h 12 min"]]), 1)) + "</div><div>" +
      cd("<b>Needs attention</b>", '<div class="rowx"><div class="grow"><b>3 open reports</b><small>MessageReport OPEN</small></div>' + btn("Review", "", "sm") + '</div><div class="rowx"><div class="grow"><b>2 guests expire in 7 days</b><small>ChannelMember.access_expires_at</small></div>' + btn("Review", "", "sm") + '</div><div class="rowx"><div class="grow"><b>GitHub integration error</b><small>MessagingIntegration status ERROR · last_error 401</small></div>' + btn("Fix", "", "sm") + '</div><div class="rowx"><div class="grow"><b>Retention run pending</b><small>“Client channels 7 years” last applied 31 days ago</small></div>' + btn("Open", "", "sm") + "</div>", 1) +
      gap(cd("<b>Storage by kind</b><span class='r muted'>files_bytes</span>", [["Public channels", 38], ["Project channels", 34], ["Customer channels", 19], ["Direct messages", 9]].map((r) => '<div class="rowx"><div class="grow">' + r[0] + '</div><span class="bar"><i style="width:' + r[1] + '%"></i></span><span class="muted">' + r[1] + "%</span></div>").join(""), 1)) +
      gap(cd("<b>People</b>", kv("Members", "52") + kv("Guests / external", "9") + kv("Deactivated", "4") + kv("Presence hidden", "6"))) + "</div></div>" +
      dm(["MessagingUsageDaily · messages_count, direct_messages_count, threads_count, thread_replies_count, reactions_count, files_count, files_bytes, active_members_count, active_channels_count, external_messages_count, mentions_count, avg_response_seconds", "Channel · MessageReport · MessagingIntegration · MessagingExportJob"], ["Analytics read permission (messaging.analytics.read) missing: gaps-12.md"]));
  }

  /* =====================================================================================================================
     MODERATION (spec §49-50)
     @screen Messages · Moderation (reports and restrictions)
     @route  /messages/admin/moderation?tab=reports|restrictions&status=
     @perm   review reports and set restrictions messaging.channels.manage · delete others’ messages messaging.messages.delete_any* · ban in a channel messaging.channel_members.manage · read a reported private message: only the reported message
             is shown (not the conversation) unless admin access is enabled (@gap messaging.messages.admin_read*) · audit link messaging.audit.read*
     @api    GET /messaging/reports?status=&channel_id=&cursor= · PATCH /messaging/reports/:id {status, action_taken, resolution_note} · POST /channels/:id/restrictions · DELETE /restrictions/:id (lift)
     @mcp    messaging_moderation_review (planned, sensitive: human confirmation)
     @data   MessageReport (message_id, reporter_membership_id, reporter_user_id, reason, details, status OPEN | UNDER_REVIEW | ACTIONED | DISMISSED, reviewed_by_user_id, reviewed_at, action_taken, resolution_note) ·
             ChannelMemberRestriction (kind MUTED | BANNED, reason, expires_at, lifted_at, channel_id nullable = organization-wide) · Message (deleted_at, delete_reason)
     @ui     DataTable with status Tabs, Sheet (review panel: message in context, reporter, history), Select for the action, AlertDialog for delete/ban, Badge
     @states loading · empty ("Queue is clear") · error · no-access
     @audit  every decision (dismiss, delete, mute, ban, lift) is an audit event with the report id
     @note   Reporters stay anonymous to the reported person. The review sheet shows only the reported message and 3 messages of context. An organization-wide restriction has channel_id null.
     ===================================================================================================================== */
  function moderation() {
    return page(head("Moderation", "Reported messages and posting restrictions.", btn("Messaging audit log", "list")) + '<div class="tabset">' + tabs([["r", "Reports", 3], ["x", "Restrictions", 2]], "r") +
      pane("r", 1, FB([["Status", "is any of", "Open, Under review"], ["Channel", "is", "Any"]], btn("Save view", "plus", "sm")) + '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start">' +
        tbl(["Message", "Channel", "Reason", "Reporter", "Reported", "Status", ""], [["“Send me the client list or…”", chName("sales", "PRIVATE"), "Harassment", "Anonymous to the author", "9:50 AM", E("OPEN", "red"), btn("Review", "", "sm primary")], ["“lol that’s a stupid idea”", chName("dev", "PUBLIC"), "Rude", "Marco Silva", "Yesterday", E("UNDER_REVIEW", "yellow"), btn("Review", "", "sm")], ["Pasted card number 4242…", chName("acme-corp", "CUSTOMER"), "Sensitive data", "Kim Lund", "Nov 9", E("OPEN", "red"), btn("Review", "", "sm")], ["Link to unknown site", chName("general", "PUBLIC"), "Spam", "Anna Meyer", "Nov 4", E("ACTIONED", "green"), btn("View", "", "sm")]]) +
        cd("<b>Review: card number in a client channel</b>", '<div class="mg-src">' + av("DW") + "<div><b>Dana Whitfield</b> <span class=\"muted\">· Client</span><div>Here is our card: 4242 4242 ...</div></div></div>" + kv("Reported by", "Kim Lund · Nov 9") + kv("Reason", "Sensitive data") + f("Decision", sel("Delete message and warn")) + f("Resolution note", box("Removed. Asked the client to use the billing portal.")) + '<div class="rowx" style="padding:0;gap:8px">' + btn("Dismiss", "", "sm") + btn("Mark under review", "", "sm") + btn("Apply decision", "check", "sm primary") + "</div>") + "</div>") +
      pane("x", 0, tbl(["Person", "Scope", "Kind", "Reason", "Until", "Created by", ""], [[wh("DW", ""), chName("acme-corp", "CUSTOMER"), E("MUTED", "yellow"), "Off-topic posts", "Nov 14", "Kim Lund", btn("Lift", "", "sm")], [wh("KL", "Former contractor"), "Organization-wide", E("BANNED", "red"), "Contract ended", muted("permanent"), "Anna Meyer", btn("Lift", "", "sm")]]) + '<div style="margin-top:8px">' + btn("Add restriction", "plus", "primary") + "</div>") + "</div>" +
      dm(["MessageReport · message_id, reason, details, status, reviewed_by_user_id, action_taken, resolution_note", "ChannelMemberRestriction · kind, reason, expires_at, lifted_at · Message · deleted_at, delete_reason"], ["Read access to reported private messages needs a dedicated key (messaging.messages.admin_read*): gaps-12.md"]));
  }

  /* =====================================================================================================================
     GUESTS AND EXTERNAL USERS (spec §27, §82-83, §96)
     @screen Messages · Guests & external users
     @route  /messages/admin/guests?kind=&expiring=&company=
     @perm   VIEW + manage messaging.external_users.manage* · member removal messaging.channel_members.manage · portal users themselves live in 07 (portal.users.manage)
     @api    GET /messaging/guests?guest_kind=&company_id=&expires_before= · POST /messaging/guests/invite {email, name, guest_kind, channel_ids[], access_expires_at, external_label} · PATCH /channels/:id/members/:memberId · DELETE …
     @mcp    messaging_external_users_manage (sensitive, human confirmation)
     @data   ChannelMember (external_user_id, role EXTERNAL | GUEST | READ_ONLY, guest_kind SINGLE_CHANNEL | MULTI_CHANNEL | CUSTOMER | PARTNER | TEMPORARY, access_expires_at, external_label, invited_by_user_id, last_viewed_at) · User (01, external identity) ·
             CrmCompany (02) · MessagingSettings (guest_access_enabled, guest_default_expiry_days)
     @ui     DataTable with expandable rows (channels per guest), filter bar, bulk bar, Dialog (Invite guest), Badge, DropdownMenu (extend, remove)
     @states loading · empty ("No external users") · error · no-access · guests disabled by organization (banner)
     @audit  guest invited, extended, expired (system), removed; access to a channel by a guest
     @note   Guests expire automatically at access_expires_at (default MessagingSettings.guest_default_expiry_days for TEMPORARY). One person with several memberships is one row with their channels. External participants never see the
             member directory. Pending invitations are not stored yet (@gap ChannelInvitation, gaps-12.md).
     ===================================================================================================================== */
  function guests() {
    return page(head("Guests & external users", "People outside the organization who can read or post in channels.", btn("Invite guest", "plus", "primary")) + pill(["All · 9", "Customers · 5", "Partners · 2", "Temporary · 2", "Expiring in 30 days · 2", "Expired · 1"], 0) +
      FB([["Guest kind", "is any of", "Customer, Partner"], ["Company", "is", "Any"]], sel("Sort: Expires soonest", "sort") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span>' + cb("mix") + " <b>2 selected</b></span>" + btn("Extend access 30 days", "calendar", "sm") + btn("Remove from channels", "x", "sm") + "</div>" +
      tbl(["", "Person", "Company / label", "Kind", "Channels", "Role", "Expires", "Invited by", "Last seen", ""], [
        ["<span class=\"cbw\">" + cb(1) + "</span>", wh("LK", "lena@acme.example"), "Acme Corp · Guest", E("CUSTOMER", "purple"), "2", E("EXTERNAL", "purple"), "Dec 31, 2026", "Anna Meyer", "Today", more], ["<span class=\"cbw\">" + cb(1) + "</span>", wh("DW", "dana@acme.example"), "Acme Corp · Guest", E("CUSTOMER", "purple"), "1", E("READ_ONLY"), muted("never"), "Kim Lund", "Yesterday", more],
        ["<span class=\"cbw\">" + cb(0) + "</span>", who("PN", "y", "Petra Novak", "petra@northwind.example"), "Northwind · Partner", E("PARTNER", "blue"), "3", E("GUEST"), "Nov 18, 2026", "Kim Lund", "Nov 9", more], ["<span class=\"cbw\">" + cb(0) + "</span>", who("TB", "g", "Tom Bell", "tom@freelance.example"), "Freelancer · Temporary", E("TEMPORARY", "yellow"), "1", E("GUEST"), "Nov 17, 2026", "Anna Meyer", "Nov 10", more],
        ["<span class=\"cbw\">" + cb(0) + "</span>", who("OP", "", "Olga Popova", "olga@globex.example"), "Globex · Guest", E("CUSTOMER", "purple"), "2", E("EXTERNAL", "purple"), "Expired Nov 1", "Kim Lund", "Oct 28", btn("Renew", "", "sm") + more]]) +
      '<div class="sub-note" style="margin-top:8px">Organization policy: guest access ' + ES("ENABLED", "green") + " · default expiry for Temporary guests 14 days (MessagingSettings.guest_access_enabled, guest_default_expiry_days). Pending invitations: not stored yet.</div>" +
      dm(["ChannelMember · external_user_id, role, guest_kind, access_expires_at, external_label, invited_by_user_id, last_viewed_at", "User (01) · CrmCompany (02) · MessagingSettings · guest_access_enabled, guest_default_expiry_days"], ["Pending/expired invitations (token, status): no table. gaps-12.md"]));
  }

  /* =====================================================================================================================
     RETENTION POLICIES AND DATA EXPORT (spec §54-55, §106)
     @screen Messages · Retention & export
     @route  /messages/admin/retention?tab=policies|exports · /messages/admin/retention/new
     @perm   messaging.retention.manage* (policies) · exports messaging.data.export* · policies apply to attachments/reactions/metadata according to flags · audit messaging.audit.read*
     @api    GET|POST|PATCH|DELETE /messaging/retention-policies · POST /messaging/retention-policies/:id/run (dry-run first) · GET|POST /messaging/exports {format, filters{channel_ids, from, to, kinds, include_external, include_internal}} · GET /messaging/exports/:id/download
     @mcp    messaging_retention_manage (sensitive) · messaging_data_export (sensitive, human confirmation)
     @data   MessagingRetentionPolicy (name, scope ORGANIZATION | BRANCH | TEAM | CHANNEL_KIND | CHANNEL, branch_id, team_id, channel_kind, action UNLIMITED | ARCHIVE | DELETE, retention_days, applies_to_attachments, applies_to_reactions, applies_to_metadata,
             is_default, last_applied_at) · Channel.retention_policy_id · MessagingExportJob (status PENDING | RUNNING | COMPLETED | FAILED | EXPIRED, format JSON | CSV | HTML, filters, started_at, completed_at, result_document_id, expires_at, message_count, channel_count, error)
     @ui     DataTable, split form (Select scope, Switch flags, number Input), AlertDialog (DELETE action warning with dry-run count), Progress for running exports, Badge
     @states loading · empty · error · export failed (error text) · export expired (download disabled)
     @audit  policy created/changed/run (counts), export requested/downloaded (who, filters), deletions by retention
     @note   Most specific policy wins: CHANNEL > CHANNEL_KIND > TEAM > BRANCH > ORGANIZATION; one default per scope. A DELETE action is permanent after the grace period; the dry run shows how many messages and files it would affect.
             Exports contain only what the filters select and are stored in Documents (17, result_document_id) for a limited time (expires_at). Confidential channels are excluded unless explicitly included by an authorized admin.
     ===================================================================================================================== */
  function retention() {
    return page(head("Retention & export", "How long messages are kept and how data leaves the system.", btn("New policy", "plus", "primary")) + '<div class="tabset">' + tabs([["p", "Policies", 5], ["e", "Exports", 3]], "p") +
      pane("p", 1, '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' + tbl(["Policy", "Scope", "Applies to", "Action", ">Days", "Attachments", "Default", "Last applied", ""], [
        ["<b>Organization default</b>", E("ORGANIZATION"), "All channels", E("ARCHIVE", "blue"), "1,095", "Yes", "Yes", "Nov 1", more], ["<b>Client channels 7 years</b>", E("CHANNEL_KIND"), "Customer", E("ARCHIVE", "blue"), "2,555", "Yes", "", "Oct 11", more], ["<b>Direct messages 1 year</b>", E("CHANNEL_KIND"), "Direct, Group direct", E("DELETE", "red"), "365", "Yes", "", "Nov 1", more],
        ["<b>Lisbon branch</b>", E("BRANCH"), "Lisbon HQ", E("ARCHIVE", "blue"), "1,825", "No", "", "—", more], ["<b>Incident room legal</b>", E("CHANNEL"), "# inc-2024-11-security", E("UNLIMITED"), muted("—"), "Yes", "", "—", more]]) + "</div><div>" +
        cd("<b>Edit: Direct messages 1 year</b><span class='r'>" + btn("Dry run", "", "sm") + btn("Save", "", "sm primary") + "</span>", f("Name", box("Direct messages 1 year")) + '<div class="g2" style="gap:12px">' + f("Scope", sel("Channel kind")) + f("Channel kind", sel("Direct")) + f("Action", sel("Delete")) + f("Keep for (days)", box("365")) + "</div>" +
          '<div class="rowx"><div class="grow"><b>Applies to attachments</b></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Applies to reactions</b></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Applies to metadata</b><small>Link previews, read receipts</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Default for its scope</b></div>' + sw(0) + "</div>" +
          callout("shield", "<b>Dry run:</b> 14,882 messages and 311 files older than 365 days would be deleted. This cannot be undone after the 7 day grace period.", "warn")) + "</div></div>") +
      pane("e", 0, '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' + tbl(["Requested", "By", "Format", "Scope", ">Messages", ">Channels", "Status", ""], [["Nov 11, 9:20", "Anna Meyer", E("JSON"), "# acme-corp, all dates", "642", "1", E("COMPLETED", "green"), btn("Download", "down", "sm")], ["Nov 11, 9:44", "Anna Meyer", E("HTML"), "# acme-rebrand, Nov 1–11", "—", "—", '<span class="bar"><i style="width:62%"></i></span> ' + E("RUNNING", "blue"), muted("62%")], ["Oct 20", "Kim Lund", E("CSV"), "All client channels", "—", "—", E("FAILED", "red"), btn("Retry", "", "sm")], ["Sep 30", "Anna Meyer", E("JSON"), "# general", "11,820", "1", E("EXPIRED"), muted("link expired")]]) + "</div><div>" +
        cd("<b>New export</b>", f("Channels", sel("Choose channels…", "hash")) + '<div class="g2" style="gap:12px">' + f("From", sel("Nov 1", "calendar")) + f("To", sel("Nov 11", "calendar")) + "</div>" + f("Format", '<div class="seg-row">' + ["JSON", "CSV", "HTML"].map((s, i) => '<span class="seg' + (i === 0 ? " on" : "") + '">' + s + "</span>").join("") + "</div>") + '<div class="rowx"><div class="grow"><b>Include internal notes</b><small>Needs messaging.data.export*</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Include confidential channels</b></div>' + sw(0) + '</div><div class="rowx" style="padding-top:12px">' + btn("Request export", "down", "primary") + "</div>") + "</div></div>") + "</div>" +
      dm(["MessagingRetentionPolicy · name, scope, branch_id, team_id, channel_kind, action, retention_days, applies_to_attachments, applies_to_reactions, applies_to_metadata, is_default, last_applied_at", "MessagingExportJob · status, format, filters, started_at, completed_at, result_document_id, expires_at, message_count, channel_count, error", "Channel.retention_policy_id"], ["Legal hold (suspend retention on a channel or search result) is not in the schema, see gaps-12.md"]));
  }

  /* =====================================================================================================================
     ORGANIZATION SETTINGS (spec §13-14, §27, §35, §52-53, §69, §80, §85, §94)
     @screen Messages · Settings (MessagingSettings)
     @route  /messages/admin/settings?tab=messages|notifications|external|files|calls|limits|privacy
     @perm   messaging.settings.manage* (every field) · retention fields messaging.retention.manage* · integrations messaging.integrations.manage* · custom emoji upload documents.documents.create
     @api    GET|PATCH /messaging/settings (one row per organization) · POST /messaging/settings/emoji
     @mcp    messaging_settings_manage (sensitive, human confirmation)
     @data   MessagingSettings (allow_delete_own_messages, delete_own_time_limit_minutes, allow_admin_delete_messages, edit_time_limit_minutes, preserve_edit_history, allowed_reactions, custom_emoji, read_receipts_direct, read_receipts_group,
             read_receipts_customer, presence_visibility, default_notification_level, default_channel_ids, channel_naming_rules, file_policy, external_access_enabled, guest_access_enabled, guest_default_expiry_days, broadcast_mention_policy,
             announcement_policy, auto_create_project_channels, voice_messages_enabled, calls_enabled, call_provider, rate_limits, sensitive_content_controls, admin_private_message_access_enabled, notification_previews_include_text, default_sections)
     @ui     Tabs, Card sections of setting rows (Switch, Select, number Input, TagInput for emoji and rules), Alert for sensitive switches, Dialog to confirm changes with impact
     @states loading · saved (toast) · validation (limits) · no-access (read-only for auditors)
     @audit  every change writes an audit event with before/after (sensitive: external access, admin private message access, retention-related, file policy)
     @note   Turning on admin_private_message_access_enabled must be explicit, logged and shown to employees in the privacy notice (spec §50, §53). External access off removes external members from all channels after confirmation.
             Rate limits (rate_limits) protect against abuse: messages per minute per user, mentions per message, links per message.
     ===================================================================================================================== */
  function settings() {
    return page(head("Messaging settings", "Organization-wide rules for messages, files, external access and privacy.", btn("Discard") + btn("Save changes", "", "primary")) + '<div class="tabset">' + tabs([["m", "Messages"], ["n", "Notifications & presence"], ["e", "External & guests"], ["f", "Files"], ["c", "Calls & voice"], ["l", "Limits"], ["p", "Privacy & security"]], "m") +
      pane("m", 1, '<div class="g2" style="align-items:start"><div>' + cd("<b>Editing & deleting</b>", setting("Members can delete their own messages", "allow_delete_own_messages", sw(1)) + setting("Time limit for deleting own messages", "delete_own_time_limit_minutes · empty means no limit", sel("No limit")) + setting("Time limit for editing", "edit_time_limit_minutes", sel("15 minutes")) + setting("Keep edit history", "preserve_edit_history · MessageVersion rows are visible to admins", sw(1)) + setting("Admins can delete any message", "allow_admin_delete_messages · also needs messaging.messages.delete_any*", sw(1)), 1) +
        gap(cd("<b>Mentions & announcements</b>", setting("Who can use @channel and @everyone", "broadcast_mention_policy", sel("Channel admins")) + setting("Who can post announcements", "announcement_policy", sel("Admins")) + setting("Create a channel for every new project", "auto_create_project_channels · uses the template with trigger PROJECT_CREATED", sw(1)), 1)) + "</div><div>" +
        cd("<b>Reactions & emoji</b>", f("Allowed reactions", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + ["👍", "🔥", "✅", "👀", "🙏", "🎉", "🐛"].map((e) => '<span class="mg-emo">' + e + "</span>").join("") + btn("Add", "plus", "sm") + "</div>", "allowed_reactions (empty = all)") + f("Custom emoji", '<div class="rowx" style="gap:6px;padding:0">' + tok(":logiq:") + tok(":shipit:") + btn("Upload", "plus", "sm") + "</div>", "custom_emoji (Json): files stored in Documents (17)")) +
        gap(cd("<b>Naming & defaults</b>", f("Channel naming rules", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + tok("project: proj-*") + tok("customer: cust-*") + tok("lowercase, digits, dashes") + btn("Add rule", "plus", "sm") + "</div>", "channel_naming_rules") + f("Channels everyone joins", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + tok("# general") + tok("# announcements") + btn("Add", "plus", "sm") + "</div>", "default_channel_ids") + f("Default sidebar sections", '<div class="rowx" style="gap:6px;padding:0">' + tok("Clients") + tok("Projects") + "</div>", "default_sections"))) + "</div></div>") +
      pane("n", 0, cd("<b>Defaults for everyone</b>", setting("Default notification level", "default_notification_level", sel("Mentions and direct")) + setting("Include message text in notification previews", "notification_previews_include_text", sw(0)) + setting("Presence visible to", "presence_visibility", sel("Everyone in the organization")) + setting("Read receipts in direct messages", "read_receipts_direct", sw(1)) + setting("Read receipts in group conversations", "read_receipts_group", sw(0)) + setting("Read receipts in customer channels", "read_receipts_customer", sw(0)), 1)) +
      pane("e", 0, cd("<b>External access</b>", setting("Allow external participants", "external_access_enabled · master switch. Off removes external people from every channel", sw(1)) + setting("Allow guests", "guest_access_enabled", sw(1)) + setting("Default guest expiry", "guest_default_expiry_days", sel("14 days")) + callout("shield", "Customer channels and guests must be reviewed by the account owner every quarter.", ""), 1)) +
      pane("f", 0, cd("<b>File policy</b><span class='r muted'>file_policy (Json)</span>", setting("Maximum file size", "per attachment", sel("100 MB")) + setting("Blocked types", "executables and scripts", tok(".exe") + tok(".bat") + tok(".js")) + setting("Scan files for malware", "before they become visible", sw(1)) + setting("Show image and PDF previews", "MessageAttachment.preview", sw(1)) + setting("External participants can upload", "channel-level overrides possible", sw(1)), 1)) +
      pane("c", 0, cd("<b>Calls & voice messages</b>", setting("Enable huddles and calls", "calls_enabled", sw(1)) + setting("Call provider", "call_provider", sel("Built-in huddle")) + setting("Voice messages", "voice_messages_enabled", sw(1)) + setting("Allow recording", "recordings are saved to Documents (17)", sw(0)), 1)) +
      pane("l", 0, cd("<b>Rate limits</b><span class='r muted'>rate_limits (Json)</span>", setting("Messages per user per minute", "protects against runaway bots and loops", sel("60")) + setting("Mentions per message", "", sel("20")) + setting("Links per message", "", sel("10")) + setting("New guests can post links", "", sw(0)), 1)) +
      pane("p", 0, cd("<b>Privacy & security</b>", setting("Admin access to private conversations", "admin_private_message_access_enabled · explicit, logged, shown in the employee privacy notice. Needs messaging.messages.admin_read* (gap)", sw(0)) + setting("Sensitive content controls", "sensitive_content_controls · warn when a message looks like a card number, IBAN or password", sw(1)) + setting("Block pasting API keys", "detects secrets in messages", sw(1)), 1) + gap(callout("lock", "Direct messages are private by default. Admin access, when enabled, is limited, logged and visible in the audit log.", ""))) + "</div>" +
      dm(["MessagingSettings · every column listed in the @data tag (one row per organization)"], ["Admin read of private messages needs messaging.messages.admin_read* (gaps-12.md)"]));
  }

  /* =====================================================================================================================
     INTEGRATIONS AND WEBHOOKS (spec §37-40, §92, §97)
     @screen Messages · Integrations (bots, inbound webhooks, connected apps)
     @route  /messages/admin/integrations · /messages/admin/integrations/:id
     @perm   messaging.integrations.manage* · outbound webhooks: the 20 webhook keys · channel restriction messaging.channels.manage
     @api    GET|POST|PATCH|DELETE /messaging/integrations · POST /messaging/integrations/:id/rotate-token · POST /messaging/integrations/:id/test · inbound: POST /hooks/messaging/:token {channel, text, blocks}
     @mcp    messaging_integrations_manage (sensitive)
     @data   MessagingIntegration (kind INBOUND_WEBHOOK | BOT | GITHUB | GITLAB | JIRA | LINEAR | GOOGLE_DRIVE | NOTION | MICROSOFT_365 | GOOGLE_WORKSPACE | SLACK | DISCORD | CUSTOM, status ACTIVE | DISABLED | ERROR, name, bot_display_name,
             bot_avatar_url, default_channel_id, allowed_channel_ids, inbound_token_hash, config, subscribed_events, rate_limit_per_minute, automation_rule_id, last_event_at, last_error) · OutboundWebhook (20)
     @ui     DataTable, Sheet for the editor, Badge for status, Select/Command for allowed channels, one-time token reveal Dialog (token is shown once, only the hash is stored)
     @states loading · empty · error with last_error · disabled
     @audit  integration created/changed/disabled, token rotated, events rejected by rate limit
     @note   Third-party providers listed here (GitHub, Slack…) are chat integrations, not the five BYOK providers of IntegrationConnection (OPENAI, RESEND, TWILIO, STRIPE, VIVA_WALLET). Integration messages appear as MessageKind INTEGRATION
             with the bot name and are de-duplicated by external_event_id.
     ===================================================================================================================== */
  function integrations() {
    return page(head("Integrations", "Bots and apps that post into channels.", btn("Add integration", "plus", "primary")) +
      tbl(["Integration", "Kind", "Status", "Posts to", "Events", ">Rate/min", "Last event", ""], [
        ["<b>Automation</b><br><small class=\"muted\">Task status changes</small>", E("BOT"), ES("ACTIVE", "green"), "# acme-rebrand, # dev", "task.status_changed", "30", "9:15 AM", more], ["<b>GitHub</b><br><small class=\"muted\">logiqdev/os</small>", E("GITHUB"), ES("ERROR", "red"), "# dev", "pull_request, push", "60", "Nov 10", btn("Reconnect", "", "sm primary") + more], ["<b>Deploy hook</b><br><small class=\"muted\">CI pipeline</small>", E("INBOUND_WEBHOOK"), ES("ACTIVE", "green"), "# dev", "any", "20", "8:30 AM", more],
        ["<b>Linear sync</b>", E("LINEAR"), ES("DISABLED"), "# product", "issue.created", "30", "—", more]]) +
      '<div class="g2" style="margin-top:12px;align-items:start">' + cd("<b>Edit: GitHub</b><span class='r muted'>MessagingIntegration</span>", f("Name", box("GitHub")) + f("Bot display name", box("GitHub")) + f("Default channel", sel("# dev", "hash")) + f("Allowed channels", '<div class="rowx" style="gap:6px;padding:0">' + tok("# dev") + tok("# releases") + btn("Add", "plus", "sm") + "</div>") + f("Subscribed events", '<div class="rowx" style="gap:6px;padding:0;flex-wrap:wrap">' + tok("pull_request") + tok("push") + tok("release") + "</div>") + f("Rate limit per minute", box("60"))) +
      cd("<b>Health</b>", callout("shield", "<b>Last error (Nov 10, 14:02):</b> 401 Bad credentials. Reconnect the app to resume posting. Events during the outage are not replayed.", "warn") + kv("Inbound token", "••••••8f2a " + btn("Rotate", "", "sm")) + kv("Automation rule", "Notify #dev on PR (20)") + kv("Created by", "Anna Meyer") + kv("Disconnected", "Nov 10")) + "</div>" +
      dm(["MessagingIntegration · kind, status, name, bot_display_name, bot_avatar_url, default_channel_id, allowed_channel_ids, inbound_token_hash, config, subscribed_events, rate_limit_per_minute, automation_rule_id, last_event_at, last_error, last_error_at, disconnected_at", "OutboundWebhook (20)"], []));
  }

  const MAP = { home, threads, mentions, drafts, saved, search: searchView, calls, "c-acme": acme, "c-dev": dev, "c-announce": announce, "c-client": client, dm: dmView, gdm, thread, actions, directory, create, chset, prefs, templates, admin, moderation, guests, retention, settings, integrations };
  const CRUMB = { "c-acme": "acme-rebrand", "c-dev": "dev", "c-announce": "announcements", "c-client": "acme-corp", dm: "Marco Silva", gdm: "Jonas, Kim, Sofia" };
  window.VIEWS.messages = { html: function (s) { return (MAP[s || "home"] || MAP.home)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: true };
})();
