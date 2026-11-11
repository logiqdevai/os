/* =====================================================================================================================
   CAMPAIGNS APP — module 11 Communication Center (docs/features/11-communication-center.md). Mailchimp / Customer.io-like outbound email and SMS.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma (26 models, 26 enums): Campaign, CampaignAudience, CampaignRecipient, CampaignRun, CampaignApproval, Segment, CommRecipientList(+Member), CommTemplate(+Version,+Translation),
   CommMessage(+Recipient,+Attachment,+Link), CommThread, CommDeliveryEvent, CommTrackedLink, CommConsent, CommSuppression, CommProviderAccount, CommSenderDomain, CommSenderIdentity, CommSignature, CommDailyStat, CommAiGeneration.
   Real enum values: CommChannel (EMAIL, SMS), CampaignStatus (DRAFT, PENDING_APPROVAL, APPROVED, SCHEDULED, SENDING, PAUSED, COMPLETED, CANCELLED, FAILED), CampaignRunStatus, CampaignApprovalDecision, CampaignAudienceMode (INCLUDE,
   EXCLUDE), SegmentEntityType (CRM_CONTACT, CRM_COMPANY, MEMBERSHIP), CommMessageStatus, CommMessageKind, CommMessageSource, CommDeliveryEventType, CommRecipientStatus, CommConsentStatus, CommConsentSource,
   CommSuppressionReason, CommTemplateKind/Category/Status/VersionStatus, CommProviderKind, CommProviderAccountStatus, CommSenderDomainStatus, CommSenderIdentityStatus, CommAiTaskKind.
   Permission keys (catalog): communications.campaigns.{read,create,update,delete*,archive,export*,send*,approve*} · communications.messages.{read,create,update,delete*,archive,export*,send*} ·
   communications.segments.{read,create,update,delete*,archive,export*} · communications.templates.{read,create,update,delete*,archive,export*} · communications.analytics.read · communications.suppressions.manage* ·
   communications.sender_identities.manage* · communications.settings.manage*.  (* = sensitive; an AI agent calling them needs human confirmation.)
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - Providers are BYOK per organization. Email goes through RESEND, SMS through TWILIO (CommProviderKind; the other kinds are reserved). The API key and webhook secret live in an IntegrationConnection (Admin > Integrations);
       CommProviderAccount only POINTS at it (integration_connection_id). No platform .env fallback: a channel with no ACTIVE connection shows "Connect Resend in Admin > Integrations" (or Twilio) and cannot send.
     - Consent and suppression are enforced SERVER-SIDE on every send (never in the UI only): CommConsent (marketing_opted_in / status OPTED_IN when Campaign.require_consent) and CommSuppression (removed_at null, not expired).
       Excluded recipients are kept as CampaignRecipient rows with status EXCLUDED and an exclusion_reason, so the audit trail explains every missing send.
     - Sending (campaigns.send*) and approving (campaigns.approve*) are sensitive and separate: the approver cannot be the sender of the same campaign (separation of duties, 01 §96).
     - Counters on Campaign (sent_count, delivered_count, opened_count, ...) are denormalized from CommMessage / CommDeliveryEvent and refreshed (stats_refreshed_at). Rates are COMPUTED in the UI, never stored.
     - Recipients are CRM contacts (02); this module owns lists, segments, consent and suppression only. Inbound replies are captured by 13 and linked through CommThread.support_conversation_id.
     - Every screen has light and dark support via semantic tokens only.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, head, btn, cd, sw, cb, sel, fld, stat, search, who, tok, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + p + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const gap = (h) => '<div style="height:' + (h || 12) + 'px"></div>';
  const pct = (a, b) => (b ? (Math.round((a / b) * 1000) / 10).toFixed(1) + "%" : "—");
  const chip = (f, o, v) => '<span class="fchip"><b>' + f + "</b><i>" + o + "</i><span>" + v + "</span>" + I("x", 12) + "</span>";
  const filterBar = (chips, extra) => '<div class="fbar"><div class="fchips">' + chips.map((c) => chip(c[0], c[1], c[2])).join("") + '<button class="btn sm ghost">' + I("plus", 13) + ' Add filter</button></div><div class="fright">' + (extra || "") + "</div></div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const row = (l, s, r) => '<div class="rowx"><div class="grow"><b>' + l + "</b>" + (s ? "<small>" + s + "</small>" : "") + "</div>" + (r || "") + "</div>";
  const kvr = (k, v) => '<div class="kvr"><span>' + k + "</span><b>" + v + "</b></div>";
  const ch = (c) => '<span class="cp-ch" title="CommChannel ' + c + '">' + I(c === "SMS" ? "sms" : "mail", 13) + " " + U.en(c) + "</span>";
  const tone = { DRAFT: "yellow", PENDING_APPROVAL: "yellow", APPROVED: "blue", SCHEDULED: "blue", SENDING: "blue", PAUSED: "yellow", COMPLETED: "green", CANCELLED: "", FAILED: "red",
    DELIVERED: "green", SENT: "blue", QUEUED: "blue", BOUNCED: "red", OPENED: "green", CLICKED: "green", REPLIED: "green", UNSUBSCRIBED: "red", EXCLUDED: "", PENDING: "yellow", COMPLAINED: "red", RUNNING: "blue",
    VERIFIED: "green", PENDING_VERIFICATION: "yellow", ACTIVE: "green", DISABLED: "", ERROR: "red", PUBLISHED: "green", ARCHIVED: "", OPTED_IN: "green", OPTED_OUT: "red", UNKNOWN: "", PENDING_DOUBLE_OPT_IN: "yellow",
    APPROVED_D: "green", REJECTED: "red" };
  const S = (v) => E(v, tone[v] || "");
  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"] };
  const wh = (a) => who(a, PEOPLE[a][1], PEOPLE[a][0], "");
  const av = (a) => AV(a, PEOPLE[a][1]);
  const mock = (c) => '<span class="cp-mock" title="mockup only">' + c + "</span>";

  /* Sample campaigns: id, name, channel, status, audience, excluded, sent, delivered, opened, clicked, replied, bounced, failed, complained, unsubscribed, when, owner */
  const C = [
    ["c1", "November product update", "EMAIL", "SENDING", 4820, 214, 3120, 3041, 1208, 342, 11, 54, 25, 1, 9, "Started Nov 11, 09:00", "SJ"],
    ["c2", "Black Friday early access", "EMAIL", "SCHEDULED", 5110, 190, 0, 0, 0, 0, 0, 0, 0, 0, 0, "Nov 24, 10:00 (recipient time zone)", "AM"],
    ["c3", "Maintenance window · Nov 14", "SMS", "COMPLETED", 612, 41, 571, 566, 0, 0, 0, 0, 5, 0, 3, "Nov 9, 16:00", "JK"],
    ["c4", "Q4 pricing change notice", "EMAIL", "PENDING_APPROVAL", 2340, 88, 0, 0, 0, 0, 0, 0, 0, 0, 0, "Waiting for Anna Meyer", "MS"],
    ["c5", "Webinar: automating client reporting", "EMAIL", "DRAFT", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "Not scheduled", "SJ"],
    ["c6", "Renewal reminder · 30 days", "SMS", "PAUSED", 188, 12, 94, 92, 0, 0, 0, 0, 2, 0, 1, "Paused Nov 10 by Kim Lund", "KL"],
    ["c7", "October case study digest", "EMAIL", "COMPLETED", 4710, 160, 4550, 4488, 1996, 611, 23, 41, 21, 2, 14, "Oct 28, 10:00", "SJ"],
    ["c8", "Holiday greetings 2026", "EMAIL", "APPROVED", 5230, 205, 0, 0, 0, 0, 0, 0, 0, 0, 0, "Ready to schedule", "AM"],
    ["c9", "Feature release 3.2 announcement", "EMAIL", "FAILED", 3900, 120, 410, 0, 0, 0, 0, 0, 410, 0, 0, "Nov 6 · provider key rejected", "MS"],
    ["c10", "Spring launch teaser", "EMAIL", "CANCELLED", 1200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "Cancelled Oct 30", "AM"],
  ];
  const T = (id) => C.find((x) => x[0] === id) || C[0];

  /* =====================================================================================================================
     OVERVIEW (dashboard) — spec "Analytics & Reporting", "Scheduling", "Delivery Tracking"
     @screen Campaigns overview
     @route  /campaigns
     @perm   VIEW communications.campaigns.read · charts need communications.analytics.read (without it the KPI cards are hidden, not zero) · new campaign communications.campaigns.create
     @api    GET /communications/overview?from=&to=&channel= (reads CommDailyStat + Campaign counters) · GET /communications/campaigns?status=SENDING,SCHEDULED&limit=5 · GET /communications/provider-status
     @mcp    communications_analytics_read · communications_campaigns_read
     @data   CommDailyStat (date, channel, kind, campaign_id, sent_count, delivered_count, unique_opened_count, unique_clicked_count, bounced_count, complained_count, unsubscribed_count, cost) · Campaign (status, scheduled_at, *_count) ·
             CommProviderAccount (status, last_error) · CommSenderDomain (status) · CommSuppression (created_at) · CampaignApproval (decision PENDING)
     @ui     shadcn Card, Tabs (7d / 30d / 90d ToggleGroup), Table, Badge, Alert; charts = Recharts with semantic tokens; Select for channel
     @states loading skeleton · empty ("No campaigns yet" + New campaign) · provider missing (Alert "Connect Resend in Admin > Integrations", no send buttons) · error · no-access
     @audit  none (read-only)
     @note   Rates are computed from sums of unique counts: open rate = unique_opened / delivered, click rate = unique_clicked / delivered, bounce rate = bounced / sent. Apple Mail Privacy Protection inflates opens: the card
             says "Opens are an estimate". Cost is CommDailyStat.cost (mostly SMS). Only the organization's own data; branch scope filters Campaign.branch_id.
     ===================================================================================================================== */
  function overview() {
    const days = [38, 52, 31, 64, 48, 70, 55, 42, 61, 77, 58, 66, 49, 83];
    return '<div class="a-page">' + head("Campaigns", "Email and SMS campaigns, journeys and deliverability for the last 30 days.", sel("Last 30 days", "calendar") + sel("All channels", "layers") + btn("New campaign", "plus", "primary")) +
      callout("flag", "<b>Twilio is not connected.</b> SMS campaigns cannot be scheduled. <a>Connect Twilio in Admin &gt; Integrations</a>. Shown only when no ACTIVE IntegrationConnection exists for the channel (no fallback to a platform key).", "warn") + gap(10) +
      '<div class="mini-stats">' + stat("Emails sent", "18,420", "+12% vs prev.") + stat("Delivery rate", "98.6%", "bounced 1.1%") + stat("Open rate", pct(1208 + 1996, 3041 + 4488) , "estimate") + stat("Click rate", "11.3%", "unique clicks") + stat("SMS sent", "1,284", "cost 21.40 EUR") + stat("Unsubscribed", 27, "0.15%", 1) + "</div>" +
      '<div class="g2">' + cd("<b>Sends per day</b><span class='r muted'>CommDailyStat.sent_count</span>", '<div class="cp-spark">' + days.map((v) => '<span style="height:' + v + 'px" title="' + v * 12 + ' sent"></span>').join("") + '</div><div class="sub-note">Oct 29 to Nov 11. Stacked by channel in production (email blue, SMS purple).</div>') +
      cd("<b>Needs attention</b><span class='r muted'>live</span>",
        row("Q4 pricing change notice", "Waiting for your approval (CampaignApproval PENDING)", btn("Review", "", "sm")) +
        row("Feature release 3.2 announcement", "Campaign FAILED: provider key rejected on 410 messages", btn("Open", "", "sm")) +
        row("brand.acme.io", "Sender domain DKIM not verified (CommSenderDomain PENDING)", btn("Fix DNS", "", "sm")) +
        row("12 hard bounces today", "Added to suppression automatically", btn("View", "", "sm")), 1) + "</div>" + gap() +
      '<div class="g2">' + cd("<b>In flight and upcoming</b><span class='r muted'>Campaign</span>", C.filter((x) => ["SENDING", "SCHEDULED", "APPROVED", "PENDING_APPROVAL"].includes(x[3])).map((x) => row(x[1], ch(x[2]) + " · " + x[15], S(x[3]))).join(""), 1) +
      cd("<b>Top campaigns by clicks</b><span class='r muted'>last 30 days</span>", tbl(["Campaign", ">Delivered", ">Open", ">Click"], C.filter((x) => x[8] > 0).sort((a, b) => b[9] - a[9]).slice(0, 4).map((x) => [ink(x[1]), x[7], pct(x[8], x[7]), pct(x[9], x[7])])), 1) + "</div>" + gap() +
      cd("<b>Deliverability</b><span class='r muted'>computed from CommDeliveryEvent</span>", '<div class="g3">' + [["Bounce rate", "1.1%", "target below 2%", "green"], ["Complaint rate", "0.04%", "target below 0.1%", "green"], ["Suppressed addresses", "341", "+12 today", ""]].map((r) => '<div class="cp-kpi"><small>' + r[0] + "</small><b>" + r[1] + "</b><span>" + r[2] + "</span></div>").join("") + "</div>") +
      dm(["CommDailyStat · date, channel, kind, campaign_id, sent_count, delivered_count, unique_opened_count, unique_clicked_count, bounced_count, complained_count, unsubscribed_count, cost", "Campaign · status, scheduled_at, audience_count, sent_count, delivered_count, opened_count, clicked_count", "CommProviderAccount · status, last_error · IntegrationConnection (01) · CommSenderDomain · CampaignApproval · CommSuppression"], []) + "</div>";
  }

  /* =====================================================================================================================
     CAMPAIGNS LIST — table with filters, saved views, sorting, bulk actions (spec "Marketing Campaigns", "Scheduling")
     @screen Campaigns list
     @route  /campaigns/all?channel=&status=&owner=&view=<savedViewId>&q=&sort=&cursor=
     @perm   VIEW communications.campaigns.read · create communications.campaigns.create · duplicate = create · archive communications.campaigns.archive · delete communications.campaigns.delete* ·
             export communications.campaigns.export* · send/schedule communications.campaigns.send* · approve communications.campaigns.approve*
     @api    GET /communications/campaigns?filter=<json>&sort=&q=&cursor= · POST /communications/campaigns/bulk {ids|filter, action: archive|delete|duplicate|pause|resume|cancel} · POST /communications/campaigns/:id/duplicate · GET/POST /saved-views?entity_type=CAMPAIGN (gap, see below)
     @mcp    communications_campaigns_read · communications_campaigns_create · communications_campaigns_archive · communications_campaigns_send (needs human confirmation)
     @data   Campaign (name, channel, status, campaign_type, is_template, scheduled_at, schedule_timezone, owner_membership_id, audience_count, excluded_count, sent_count, delivered_count, opened_count, clicked_count, unsubscribed_count,
             archived_at, duplicated_from_campaign_id) · Membership (owner)
     @ui     shadcn Table with column chooser, filter bar (Popover + Command, multi-select), DropdownMenu row actions, sticky bulk bar, "Save view" Dialog, ToggleGroup (All / Email / SMS / Templates)
     @states loading skeleton rows · empty ("No campaigns match" + clear filters) · error · no-access · bulk partial failure summary
     @audit  campaign archived, deleted, duplicated, paused, resumed, cancelled (one audit event per campaign + a summary event with the filter)
     @note   Row click opens the campaign page. Campaigns with is_template = true are reusable "campaign templates" (spec "Campaign templates") and appear under the Templates toggle. Pause is only valid in SENDING;
             Resume in PAUSED; Cancel in SCHEDULED, APPROVED, PAUSED. Bulk "Delete" is only offered for DRAFT and CANCELLED.
     @gap    Saved views for campaigns: SavedView.entity_type has no CAMPAIGN value in the 02 enum list used by the platform table (see gaps-11.md #1).
     ===================================================================================================================== */
  function list() {
    const cols = ["", "Campaign", "Channel", "Status", "Audience", "Sent", "Delivered", "Open", "Click", "Unsub.", "When", "Owner", ""];
    return '<div class="a-page">' + head("All campaigns", "Email and SMS campaigns of the whole organization.", btn("Export", "file") + btn("New campaign", "plus", "primary")) +
      '<div class="toolbar">' + search("Search name, subject, campaign type") + sel("Table", "grid") + sel("Sort: Last updated ↓", "sort") + sel("Columns (11)", "settings") + sel("View: Active this month", "star") + "</div>" +
      filterBar([["Channel", "is any of", "Email, SMS"], ["Status", "is not", "Cancelled"], ["Owner", "is", "Anyone"], ["Archived", "is", "No"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span class="muted">the bulk bar appears when rows are selected</span><span style="flex:1"></span>' + btn("Duplicate", "layers", "sm") + btn("Pause", "clock", "sm") + btn("Archive", "box", "sm") + btn("Export", "file", "sm") + btn("Delete", "x", "sm") + "</div>" +
      '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + C.map((x, i) => "<tr><td>" + cb(i < 2) + "</td><td>" + ink(x[1]) + "<br>" + muted(x[0] === "c9" ? "Product announcement" : x[2] === "SMS" ? "Transactional-style notice" : "Newsletter") + "</td><td>" + ch(x[2]) + "</td><td>" + S(x[3]) + "</td><td class='num'>" + x[4].toLocaleString() + (x[5] ? "<br>" + muted("-" + x[5] + " excluded") : "") + "</td><td class='num'>" + x[6].toLocaleString() + "</td><td>" + pct(x[7], x[6]) + "</td><td>" + (x[2] === "SMS" ? "—" : pct(x[8], x[7])) + "</td><td>" + (x[2] === "SMS" ? "—" : pct(x[9], x[7])) + "</td><td>" + x[14] + "</td><td>" + x[15] + "</td><td>" + wh(x[16]) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="pager"><span class="muted">1–10 of 37</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["Campaign · name, channel, status, campaign_type, is_template, scheduled_at, owner_membership_id, audience_count, excluded_count, sent_count, delivered_count, opened_count, clicked_count, unsubscribed_count, archived_at", "Membership · owner"], ["Saved views for campaigns (SavedView.entity_type) and a tag filter via taggings: see gaps-11.md #1"]) + "</div>";
  }

  /* =====================================================================================================================
     CREATE CAMPAIGN — 5-step wizard on one page (spec "Marketing Campaigns", "Scheduling", "Internal Collaboration")
     @screen Create campaign wizard
     @route  /campaigns/new?channel=EMAIL|SMS&from_template=<templateId>&duplicate=<campaignId> · /campaigns/:id/edit uses the same form
     @perm   communications.campaigns.create (save draft) · communications.campaigns.update (edit) · schedule or send now communications.campaigns.send* · submit for approval needs update, deciding needs communications.campaigns.approve* ·
             templates are picked only if communications.templates.read
     @api    POST /communications/campaigns {channel, name, ...} · PATCH /communications/campaigns/:id (autosave per step) · PUT /communications/campaigns/:id/audience [{mode, list_id|segment_id}] · POST /communications/campaigns/:id/audience/resolve (dry run: counts, exclusions) ·
             POST /communications/campaigns/:id/test-send {addresses[]} · POST /communications/campaigns/:id/submit-approval · POST /communications/campaigns/:id/schedule {scheduled_at, schedule_timezone, send_in_recipient_timezone} · POST /communications/campaigns/:id/send
     @mcp    communications_campaigns_create · communications_campaigns_update · communications_campaigns_send (sensitive: human confirmation) · communications_campaigns_approve
     @data   Campaign (name, description, channel, campaign_type, branch_id, owner_membership_id, template_id, template_version_id, subject, preheader, body_html, body_text, sender_identity_id, from_name, reply_to_address, attachment_document_ids,
             tracking_enabled, utm, language, require_consent, scheduled_at, schedule_timezone, send_in_recipient_timezone, recurrence_rule, recurrence_ends_at, send_rate_per_hour, is_template) · CampaignAudience (mode, list_id, segment_id, sort_order) ·
             CommTemplate/CommTemplateVersion · CommSenderIdentity · CommRecipientList · Segment · CampaignApproval · CommAiGeneration (ai_generation_id)
     @ui     shadcn Tabs-as-stepper (Form per step, react-hook-form + zod), Select, Popover + Command (segments, lists, templates, senders), DatePicker + time zone Combobox, Textarea, Switch, Dialog (test send), Alert, AlertDialog (send now)
     @states per-step validation inline · autosaved draft ("Saved 12:41") · resolving audience (skeleton count) · sender not verified (blocking error) · provider missing (blocking Alert "Connect Resend in Admin > Integrations", no fallback) ·
             over rate limit · saving · sent/scheduled (toast + redirect to the campaign page) · no-access on send (button disabled with the reason)
     @audit  campaign created, updated, audience changed, test sent, submitted for approval, approved/rejected, scheduled, sent, cancelled
     @note   The wizard saves a DRAFT on step 1; the API never trusts audience counts from the client. The Review step runs the same resolution as the send job: contacts are de-duplicated by address, suppressed addresses and
             contacts without consent (when require_consent) become CampaignRecipient rows EXCLUDED with exclusion_reason. SMS has no subject, shows a segment counter (160 GSM-7 / 70 UCS-2 chars per segment, Message.sms_segment_count) and an
             opt-out line. If the organization sets Settings > Approval required, Send is replaced by "Submit for approval". Recurring campaigns (recurrence_rule) create one CampaignRun per execution.
     @gap    A/B testing (subject / content variants and winner selection) has no table: Campaign has one subject/body. The A/B card below is design only (gaps-11.md #2).
     ===================================================================================================================== */
  function create() {
    const ws = [["a", "1  Basics"], ["b", "2  Audience"], ["c", "3  Content"], ["d", "4  Schedule"], ["e", "5  Review & send"]];
    const p1 = f("Channel", '<div class="rowx" style="gap:8px;padding:0"><span class="seg on">' + I("mail", 13) + " Email</span><span class=\"seg\">" + I("sms", 13) + " SMS</span></div>", "CommChannel. SMS needs an ACTIVE Twilio connection and a verified SMS sender.") +
      f("Campaign name", box("Internal name, e.g. November product update")) + f("Campaign type", sel("Newsletter", "tag"), "Free text label (Campaign.campaign_type): newsletter, product launch, promotion, announcement.") +
      f("Description", box("What this campaign is for")) + '<div class="g2">' + f("Owner", sel("Sofia Jensen", "users")) + f("Branch", sel("All branches", "building")) + "</div>" +
      f("Save as reusable campaign template", '<div class="rowx" style="padding:0"><div class="grow muted">Campaign.is_template: appears in the Templates toggle of the list</div>' + sw(0) + "</div>");
    const p2 = cd("<b>Include</b><span class='r'>" + btn("Add list or segment", "plus", "sm") + "</span>",
      row("Active customers (EU)", "Segment · CRM_CONTACT · 3,980 contacts · evaluated 2 h ago", S("ACTIVE") + more) + row("Newsletter subscribers", "Recipient list · EMAIL · 1,540 members", more) + row("Event attendees 2025", "Recipient list · 620 members", more), 1) + gap() +
      cd("<b>Exclude</b><span class='r'>" + btn("Add exclusion", "plus", "sm") + "</span>", row("Customers with overdue invoices", "Segment · billing state from 08 · 142 contacts", more) + row("Unsubscribed in the last 30 days", "Segment · 61 contacts", more), 1) + gap() +
      cd("<b>Consent and suppression</b>", row("Only contacts who opted in to marketing", "Campaign.require_consent · CommConsent status OPTED_IN", sw(1)) + row("Skip suppressed addresses", "Always on, cannot be disabled: unsubscribes, hard bounces, complaints", sw(1)) + callout("shield", "<b>Estimated audience 4,820</b> after de-duplication. Excluded: 190 suppressed, 24 without consent. Final numbers are computed again when the send job starts.")) ;
    const p3 = '<div class="g2" style="grid-template-columns:1.4fr 1fr;align-items:start"><div>' + cd("<b>Message</b>", f("Start from template", sel("Product update (Campaign, v4, EN)", "file"), "CommTemplate kind CAMPAIGN or COMMUNICATION. The version is pinned in template_version_id; later template edits do not change this campaign.") +
      f("Subject", box("Your November update is here, {{contact.first_name}}") + '<div class="rowx" style="padding:4px 0 0">' + btn("Suggest subject lines", "sparkles", "sm") + muted("CommAiGeneration task SUBJECT_LINES · 47 chars") + "</div>") + f("Preheader", box("What shipped, what's next, and one offer")) +
      f("Body", '<div class="editor"><div class="ed-bar">' + ["B", "I", "H", "Button", "Image", "Link", "Divider", "{{ }}", "If", "Sparkles"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">Hi {{contact.first_name}}, here is what we shipped in November… Variables {{ }}, conditional blocks, tracked links and the unsubscribe footer ({{unsubscribe_url}}, required for EMAIL).</div></div>') + f("Attachments", '<div class="drop">' + I("clip", 16) + " Choose from Documents (17), max 10 MB total</div>")) + gap() +
      cd("<b>A/B test</b><span class='r'>" + mock("design only") + "</span>", row("Test subject lines", "Variant A and B to 20% of the audience, the winner goes to the rest after 4 h", sw(0)) + '<div class="sub-note">@gap: no variant table in the schema (gaps-11.md #2). Hidden in production until it exists.</div>') + '</div><div>' +
      cd("<b>Sender</b>", f("From identity", sel("hello@acme-agency.com · Verified", "mail")) + f("From name", box("Acme Agency")) + f("Reply-to", box("support@acme-agency.com")) + f("Language", sel("English (translations: DE, FR)", "globe"), "CommTemplateTranslation is chosen per recipient language (CrmContact.language).")) + gap() +
      cd("<b>Tracking</b>", row("Track opens and clicks", "Campaign.tracking_enabled · links rewritten into CommTrackedLink", sw(1)) + f("UTM", '<div class="rowx" style="gap:8px;padding:0">' + box("utm_source=email") + box("utm_campaign=nov-update") + "</div>")) + gap() +
      cd("<b>Preview and test</b>", '<div class="rowx" style="gap:8px;padding:0">' + sel("Desktop", "panel") + sel("As: Lena Kovac", "users") + "</div>" + gap(8) + btn("Send test email", "send", "sm") + '<div class="sub-note">Test sends write CommMessage.is_test = true and never count in analytics.</div>') + "</div></div>";
    const p4 = '<div class="g2" style="align-items:start">' + cd("<b>When to send</b>", '<div class="rowx" style="gap:8px;padding:0">' + ["Send now", "Schedule", "Recurring"].map((t, i) => '<span class="seg' + (i === 1 ? " on" : "") + '">' + t + "</span>").join("") + "</div>" + gap(10) + f("Date and time", sel("Nov 24, 2026 · 10:00", "calendar")) + f("Time zone", sel("Europe/Berlin", "globe")) +
      row("Send in each recipient's time zone", "Campaign.send_in_recipient_timezone · falls back to the schedule zone when unknown", sw(1)) + f("Recurrence rule", box("RRULE:FREQ=MONTHLY;BYMONTHDAY=1 (only when Recurring)")) + f("Recurrence ends", sel("Never", "calendar"))) +
      cd("<b>Throttling</b>", f("Send rate per hour", box("5,000"), "Campaign.send_rate_per_hour. Empty = provider limit. Protects sender reputation on new domains.") + callout("clock", "At 5,000 per hour the 4,820 messages finish in about 1 h. SMS is limited by Twilio's per-number throughput.")) + "</div>";
    const p5 = '<div class="g2" style="align-items:start">' + cd("<b>Pre-send checklist</b>", [["Provider connected", "Resend · ACTIVE · last used today", 1], ["Sender verified", "hello@acme-agency.com on acme-agency.com (SPF, DKIM, DMARC)", 1], ["Unsubscribe link present", "{{unsubscribe_url}} found in the body", 1], ["Subject and preheader set", "47 + 41 characters", 1], ["Links valid", "6 links, 0 broken (checked 2 min ago)", 1], ["Audience resolved", "4,820 recipients · 214 excluded", 1], ["Approval", "Required by settings: submit for approval first", 0]].map((r) => '<div class="rowx">' + cb(r[2]) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div></div>").join(""), 1) +
      '<div>' + cd("<b>Summary</b>", kvr("Channel", ch("EMAIL")) + kvr("Audience", "4,820 (excluded 214)") + kvr("Template", "Product update v4") + kvr("Send", "Nov 24, 10:00 Europe/Berlin") + kvr("Estimated duration", "about 1 h") + kvr("Approver", "Anna Meyer")) + gap() +
      cd("<b>Approval and notes</b>", f("Reviewer", sel("Anna Meyer", "users")) + f("Note for the reviewer", box("Please check the offer wording")) + '<div class="sub-note">CampaignApproval is created with decision PENDING. Internal notes are crm_notes with entity_type CAMPAIGN.</div>') + "</div></div>";
    return '<div class="a-page">' + head("New campaign", "Draft autosaved 12:41 · Email", btn("Save draft") + btn("Submit for approval", "send", "primary")) +
      '<div class="tabset">' + tabs(ws, "a") + pane("a", 1, p1) + pane("b", 0, p2) + pane("c", 0, p3) + pane("d", 0, p4) + pane("e", 0, p5) + "</div>" +
      callout("flag", "<b>No Resend connection.</b> Shown instead of the Review step when the organization has no ACTIVE email connection: <a>Connect Resend in Admin &gt; Integrations</a>. Drafts can be saved, nothing can be sent.", "warn") +
      dm(["Campaign · all columns written by the wizard (see @data)", "CampaignAudience · mode INCLUDE | EXCLUDE, list_id, segment_id, sort_order", "CommTemplate · CommTemplateVersion · CommSenderIdentity · CommRecipientList · Segment · CampaignApproval", "CommAiGeneration · task SUBJECT_LINES, WRITE_EMAIL, WRITE_SMS"], ["A/B variants and winner rule (gaps-11.md #2)", "Link checker result and spam score are computed, no table (gaps-11.md #9)"]) + "</div>";
  }

  /* =====================================================================================================================
     CAMPAIGN DETAIL — overview analytics, content, audience, messages, approvals, settings, activity
     @screen Campaign page
     @route  /campaigns/:campaignId?tab=overview|content|audience|messages|runs|approvals|activity|settings
     @perm   VIEW communications.campaigns.read · analytics tab communications.analytics.read · edit communications.campaigns.update · send/pause/resume/cancel communications.campaigns.send* · approve/reject communications.campaigns.approve* ·
             export recipients communications.campaigns.export* · archive communications.campaigns.archive · delete communications.campaigns.delete*
     @api    GET /communications/campaigns/:id · GET /communications/campaigns/:id/stats?granularity=hour|day · GET /communications/campaigns/:id/recipients?status=&q=&cursor= · GET /communications/campaigns/:id/links ·
             GET /communications/campaigns/:id/runs · POST /communications/campaigns/:id/{pause|resume|cancel|send|duplicate|archive} · POST /communications/campaigns/:id/approvals/:approvalId {decision, comment} · GET /communications/campaigns/:id/export
     @mcp    communications_campaigns_read · communications_analytics_read · communications_campaigns_send · communications_campaigns_approve
     @data   Campaign (all columns) · CampaignRun (run_number, status, scheduled_for, started_at, completed_at, audience_count, sent_count, delivered_count, failed_count, failure_reason) · CampaignRecipient (address, status, exclusion_reason, message_id, sent_at) ·
             CampaignAudience · CommTrackedLink (original_url, label, click_count, unique_click_count) · CommDeliveryEvent (type, occurred_at, bounce_type, reason) · CampaignApproval (approver_membership_id, decision, comment, requested_at, decided_at) · CommDailyStat (campaign_id)
     @ui     shadcn Tabs, Card, Table, Progress, Badge, Alert, DropdownMenu (More), AlertDialog (pause, cancel, send), Dialog (reject with comment)
     @states loading · not found · SENDING live progress (poll or SSE) · FAILED with failure_reason and "Retry failed" · no-access · stats stale (stats_refreshed_at older than 10 min shows a refresh hint)
     @audit  status transitions with actor, approval decisions, edits while DRAFT/APPROVED (editing an APPROVED campaign resets it to DRAFT and voids the approval), exports
     @note   Allowed transitions: DRAFT to PENDING_APPROVAL or SCHEDULED; PENDING_APPROVAL to APPROVED or DRAFT (rejected); APPROVED to SCHEDULED or SENDING; SCHEDULED to SENDING or CANCELLED; SENDING to PAUSED, COMPLETED or FAILED; PAUSED to SENDING or CANCELLED.
             "Replied" counts come from 13 through CommThread. Click map is per CommTrackedLink, grouped by label. The funnel shows counts from the Campaign counters, rates are computed.
     ===================================================================================================================== */
  function detail() {
    const x = T("c1");
    const fun = [["Audience", x[4], 100], ["Sent", x[6], 65], ["Delivered", x[7], 63], ["Opened", x[8], 25], ["Clicked", x[9], 7]];
    const ov = '<div class="mini-stats">' + stat("Sent", x[6].toLocaleString(), "of " + (x[4] - x[5]).toLocaleString() + " (65%)") + stat("Delivered", pct(x[7], x[6]), x[7].toLocaleString()) + stat("Opened", pct(x[8], x[7]), "estimate") + stat("Clicked", pct(x[9], x[7]), x[9] + " unique") + stat("Replied", x[10], pct(x[10], x[7])) + stat("Bounced", x[11], pct(x[11], x[6]), 1) + stat("Unsubscribed", x[14], pct(x[14], x[7]), 1) + "</div>" +
      '<div class="g2">' + cd("<b>Funnel</b><span class='r muted'>Campaign counters</span>", fun.map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i style="width:' + r[2] + '%"></i></span><span class="v">' + r[1].toLocaleString() + "</span></div>").join("") + '<div class="sub-note">Stats refreshed 40 s ago (stats_refreshed_at).</div>') +
      cd("<b>Opens and clicks over time</b><span class='r muted'>CommDailyStat / hourly rollup</span>", '<div class="cp-spark tall">' + [8, 30, 64, 80, 55, 41, 28, 22, 18, 12, 9, 7].map((v) => '<span style="height:' + v + 'px"></span>').join("") + '</div><div class="sub-note">First 12 hours after sending. Peak at hour 3.</div>') + "</div>" + gap() +
      '<div class="g2">' + cd("<b>Link clicks</b><span class='r muted'>CommTrackedLink</span>", tbl(["Link", ">Clicks", ">Unique"], [["Read the release notes", 168, 141], ["Book a demo", 92, 80], ["View pricing", 54, 49], ["Unsubscribe", 9, 9]]), 1) +
      cd("<b>Bounces and failures</b><span class='r muted'>CommDeliveryEvent</span>", row("Hard bounces", "54 · address does not exist (CommBounceType HARD)", S("BOUNCED")) + row("Soft bounces", "21 · mailbox full, retried 3 times", E("SOFT", "yellow")) + row("Complaints", "1 · added to suppression as COMPLAINT", S("COMPLAINED")) + row("Provider errors", "25 · rate limited by Resend, retried", S("FAILED")), 1) + "</div>";
    const content = '<div class="g2" style="grid-template-columns:1.3fr 1fr;align-items:start">' + cd("<b>Email preview</b><span class='r'>" + sel("Desktop", "panel") + "</span>", emailPrev("Your November update is here, Lena", "Product update v4 · Acme Agency")) + cd("<b>Details</b>", kvr("Subject", "Your November update is here, {{contact.first_name}}") + kvr("Preheader", "What shipped, what's next, and one offer") + kvr("From", "Acme Agency &lt;hello@acme-agency.com&gt;") + kvr("Reply-to", "support@acme-agency.com") + kvr("Template", "Product update · v4 (pinned)") + kvr("Language", "EN · translations DE, FR") + kvr("Attachments", "none") + kvr("Tracking", "opens and clicks · UTM utm_campaign=nov-update")) + "</div>";
    const aud = '<div class="g2" style="align-items:start">' + cd("<b>Audience sources</b><span class='r muted'>CampaignAudience</span>", row("Active customers (EU)", "Segment", E("INCLUDE", "green")) + row("Newsletter subscribers", "Recipient list", E("INCLUDE", "green")) + row("Customers with overdue invoices", "Segment", E("EXCLUDE", "red")), 1) + cd("<b>Resolution</b>", kvr("Resolved audience", "4,820") + kvr("Excluded", "214") + kvr("Suppressed", "190") + kvr("No consent", "24") + kvr("Resolved at", "Nov 11, 08:59")) + "</div>" + gap() +
      filterBar([["Status", "is any of", "Excluded, Bounced, Failed"]], search("Search address or name")) + tbl(["Recipient", "Status", "Reason", "Message", "Sent"], [["lena.kovac@acme.com", S("CLICKED"), "", "CommMessage m-9041", "09:02"], ["tom@northwind.io", S("OPENED"), "", "m-9044", "09:02"], ["info@brightco.de", S("BOUNCED"), "Hard bounce: mailbox does not exist", "m-9051", "09:03"], ["j.hart@oldclient.com", S("EXCLUDED"), "Suppressed: UNSUBSCRIBE (Oct 3)", "—", "—"], ["m.rossi@globex.it", S("EXCLUDED"), "No marketing consent", "—", "—"], ["a.park@vertex.kr", S("DELIVERED"), "", "m-9060", "09:04"]]);
    const msgs = tbl(["Message", "Recipient", "Status", "Opens", "Clicks", "Sent"], [["m-9041", "Lena Kovac", S("DELIVERED"), 3, 2, "09:02"], ["m-9044", "Tom Berg", S("DELIVERED"), 1, 0, "09:02"], ["m-9051", "Info Brightco", S("BOUNCED"), 0, 0, "09:03"], ["m-9060", "Ae-ri Park", S("DELIVERED"), 0, 0, "09:04"]]);
    const runs = tbl(["Run", "Status", "Scheduled", "Started", "Completed", ">Audience", ">Sent", ">Delivered", ">Failed"], [["#1", S("RUNNING"), "Nov 11, 09:00", "09:00", "—", "4,606", "3,120", "3,041", "25"]]) + '<div class="sub-note" style="margin-top:8px">Recurring campaigns add one CampaignRun per execution; a one-off campaign has exactly one.</div>';
    const appr = cd("<b>Approvals</b><span class='r muted'>CampaignApproval</span>", row("Anna Meyer", "Requested Nov 10, 15:20 · decided Nov 10, 16:05 · “Looks good, fix the footer address.”", S("APPROVED")) + row("Marco Silva", "Requested Nov 10, 15:20 · pending", S("PENDING") + btn("Remind", "bell", "sm")), 1) + gap() + callout("shield", "Separation of duties: the person who started the send (Sofia Jensen) cannot approve it. Approvers need communications.campaigns.approve*.");
    const act = cd("<b>Activity</b><span class='r muted'>audit_events + crm_notes (CAMPAIGN)</span>", '<div class="tl"><div class="ev"><b>Campaign started sending</b><small>Sofia Jensen · Nov 11, 09:00 · run #1</small></div><div class="ev"><b>Approved by Anna Meyer</b><small>Nov 10, 16:05</small></div><div class="ev"><b>Note: “Offer expires Nov 30, double check the date”</b><small>Marco Silva · Nov 10, 15:40 · internal</small></div><div class="ev"><b>Audience changed</b><small>Added exclusion “Customers with overdue invoices” · Nov 10</small></div><div class="ev"><b>Campaign created</b><small>Sofia Jensen · Nov 8</small></div></div>');
    const set = '<div class="g2" style="align-items:start">' + cd("<b>Schedule</b>", kvr("Scheduled for", "Nov 11, 09:00 Europe/Berlin") + kvr("Recipient time zone", sw(0)) + kvr("Recurrence", "None") + kvr("Send rate", "5,000 per hour") + kvr("Next run", "—")) + cd("<b>Options</b>", kvr("Require consent", sw(1)) + kvr("Tracking", sw(1)) + kvr("Branch", "All branches") + kvr("Owner", "Sofia Jensen") + kvr("Duplicated from", "October case study digest") + kvr("Campaign template", sw(0))) + "</div>";
    return '<div class="a-page"><div class="a-head"><div><h1>' + x[1] + '</h1><p>' + ch("EMAIL") + " · " + S("SENDING") + " · owner Sofia Jensen · started Nov 11, 09:00</p></div><div class=\"acts\">" + btn("Duplicate", "layers") + btn("Pause", "clock") + btn("Export", "file") + btn("Edit", "edit", "primary") + "</div></div>" +
      '<div class="rowx" style="padding:0 0 10px"><div class="grow"><b>65% sent</b><small>3,120 of 4,606 · about 18 min left · 25 provider errors retried</small></div><span class="bar" style="width:240px"><i style="width:65%"></i></span></div>' +
      '<div class="tabset">' + tabs([["o", "Overview"], ["c", "Content"], ["a", "Audience", 4820], ["m", "Messages"], ["r", "Runs", 1], ["p", "Approvals", 2], ["h", "Activity"], ["s", "Settings"]], "o") + pane("o", 1, ov) + pane("c", 0, content) + pane("a", 0, aud) + pane("m", 0, msgs) + pane("r", 0, runs) + pane("p", 0, appr) + pane("h", 0, act) + pane("s", 0, set) + "</div>" +
      dm(["Campaign · all columns (counters, schedule, approval, status timestamps)", "CampaignRun · CampaignRecipient · CampaignAudience · CampaignApproval", "CommTrackedLink · CommDeliveryEvent · CommDailyStat · CommMessage (campaign_id)", "crm_notes (entity_type CAMPAIGN) · audit_events"], ["Per-link heat map, device and client breakdown are derived from CommDeliveryEvent.user_agent: no stored aggregate (gaps-11.md #8)"]) + "</div>";
  }
  function emailPrev(subj, tpl) {
    return '<div class="em-prev"><div class="em-hd"><b>' + subj + "</b><small>Acme Agency &lt;hello@acme-agency.com&gt; · " + tpl + '</small></div><div class="em-body"><div class="em-logo">ACME</div><h3>What we shipped in November</h3><p>Hi Lena, three things landed this month: the new reporting dashboard, faster exports and the client approval flow.</p><div class="em-btn">Read the release notes</div><p class="muted">Offer ends Nov 30. Questions? Just reply to this email.</p><div class="em-ft">Acme Agency, Hauptstrasse 1, Berlin · <u>Unsubscribe</u> · <u>Manage preferences</u></div></div></div>';
  }

  /* =====================================================================================================================
     SEGMENTS LIST (spec "Customer Segmentation")
     @screen Segments list
     @route  /campaigns/segments?entity_type=&channel=&q=&archived=
     @perm   VIEW communications.segments.read · create communications.segments.create · edit communications.segments.update · archive communications.segments.archive · delete communications.segments.delete* · export communications.segments.export*
     @api    GET /communications/segments?entity_type=&channel=&q= · POST /communications/segments/bulk {ids, action: archive|delete|refresh} · POST /communications/segments/:id/refresh
     @mcp    communications_segments_read · communications_segments_create · communications_segments_update · communications_segments_archive
     @data   Segment (name, description, entity_type, channel, require_consent, saved_view_id, definition, last_evaluated_at, last_count, archived_at, created_by_membership_id) · CampaignAudience (usage count, read) · Membership
     @ui     shadcn Table, filter bar, Popover + Command, Badge, DropdownMenu, Checkbox bulk bar
     @states loading · empty ("Create your first segment") · error · no-access · counts stale (last_evaluated_at older than 24 h shows a refresh icon)
     @audit  segment created, updated, archived, deleted, refreshed
     @note   A segment is a SAVED FILTER, not a copy of people: members are evaluated when a campaign resolves its audience. last_count is only a cached preview. Deleting a segment used by a SCHEDULED or SENDING campaign is blocked and lists the campaigns.
     ===================================================================================================================== */
  const SEG = [["Active customers (EU)", "CRM_CONTACT", "EMAIL", 3980, "2 h ago", "4 campaigns", 1, "SJ"], ["Customers with overdue invoices", "CRM_COMPANY", "", 142, "1 h ago", "2 campaigns", 0, "AM"], ["Leads from webinar, no reply", "CRM_CONTACT", "EMAIL", 318, "Yesterday", "1 campaign", 1, "SJ"], ["Retainer clients, renewal within 60 days", "CRM_COMPANY", "SMS", 41, "3 h ago", "1 campaign", 1, "MS"], ["Agency team (announcements)", "MEMBERSHIP", "EMAIL", 24, "Nov 3", "0 campaigns", 0, "AM"], ["Dormant contacts > 12 months", "CRM_CONTACT", "EMAIL", 1290, "Nov 1", "0 campaigns", 1, "JK"]];
  function segments() {
    return '<div class="a-page">' + head("Segments", "Saved filters over CRM contacts, companies and members, combined with billing and project state.", btn("Export", "file") + btn("New segment", "plus", "primary")) +
      '<div class="toolbar">' + search("Search segments") + sel("Table", "grid") + sel("Sort: Last evaluated ↓", "sort") + "</div>" +
      filterBar([["Entity", "is any of", "Contact, Company, Member"], ["Archived", "is", "No"]], btn("Save view", "plus", "sm")) +
      tbl(["", "Segment", "Entity", "Channel", ">Last count", "Consent", "Evaluated", "Used by", "Owner", ""], SEG.map((s, i) => [cb(i === 0), ink(s[0]), E(s[1]), s[2] ? ch(s[2]) : muted("Any"), s[3].toLocaleString(), sw(s[6]), s[4], s[5], wh(s[7]), more])) +
      '<div class="sub-note" style="margin-top:8px">“Consent” is Segment.require_consent: only opted-in contacts of the segment channel are counted.</div>' +
      dm(["Segment · name, entity_type, channel, require_consent, definition, last_evaluated_at, last_count, archived_at", "CampaignAudience · segment_id (usage) · Membership"], []) + "</div>";
  }

  /* =====================================================================================================================
     SEGMENT DETAIL (spec "Customer Segmentation")
     @screen Segment page
     @route  /campaigns/segments/:segmentId?tab=members|definition|usage|activity
     @perm   VIEW communications.segments.read · edit communications.segments.update · export members communications.segments.export*
     @api    GET /communications/segments/:id · GET /communications/segments/:id/members?cursor=&q= (evaluates definition now) · POST /communications/segments/:id/refresh · GET /communications/segments/:id/usage
     @mcp    communications_segments_read · communications_segments_update
     @data   Segment · CampaignAudience (usage) · Campaign (name, status) · CrmContact / CrmCompany (read-only, 02) · CommConsent (per member) · CommSuppression (flag) · SavedView (saved_view_id, optional source)
     @ui     shadcn Tabs, Table, Badge, Card, Dialog (refresh), DropdownMenu
     @states loading · evaluating (skeleton) · definition invalid after a custom field was deleted (Alert with the broken rule) · empty ("No one matches") · error · no-access
     @audit  segment edited (old and new definition), refreshed, exported
     @note   Members are computed, never stored. A member with no consent or a suppression is shown with a flag and is dropped at send time. Segment.saved_view_id optionally keeps the segment in sync with a CRM saved view (02 §29); then the definition is read-only.
     ===================================================================================================================== */
  function segment() {
    const mem = tbl(["Contact", "Company", "Region", "Language", "Plan", "Consent", "Flag"], [[who("LK", "", "Lena Kovac", "lena.kovac@acme.com", ""), "Acme Corp", "DACH", "EN", "Retainer", S("OPTED_IN"), ""], [who("TB", "g", "Tom Berg", "tom@northwind.io", ""), "Northwind", "Nordics", "EN", "Project", S("OPTED_IN"), ""], [who("AP", "y", "Ae-ri Park", "a.park@vertex.kr", ""), "Vertex", "APAC", "EN", "Retainer", S("OPTED_IN"), ""], [who("MR", "p", "Marta Rossi", "m.rossi@globex.it", ""), "Globex", "South EU", "IT", "Project", S("UNKNOWN"), E("Dropped at send: no consent", "yellow")], [who("JH", "r", "James Hart", "j.hart@oldclient.com", ""), "Oldclient", "UK", "EN", "None", S("OPTED_OUT"), E("Suppressed", "red")]]);
    const def = cd("<b>Definition</b><span class='r muted'>Segment.definition (Json)</span>", segTree() + '<pre class="cp-json">{ "and": [\n  { "field": "company.region", "op": "in", "value": ["DACH","Nordics","South EU"] },\n  { "field": "company.account_status", "op": "is", "value": "ACTIVE" },\n  { "or": [ { "field": "subscription.plan", "op": "is", "value": "Retainer" }, { "field": "projects.active_count", "op": "gte", "value": 1 } ] },\n  { "field": "billing.outstanding_invoices", "op": "is", "value": 0 }\n] }</pre>');
    const use = tbl(["Campaign", "Mode", "Status", ">Audience", "When"], [[ink("November product update"), E("INCLUDE", "green"), S("SENDING"), "4,820", "Nov 11"], [ink("October case study digest"), E("INCLUDE", "green"), S("COMPLETED"), "4,710", "Oct 28"], [ink("Black Friday early access"), E("INCLUDE", "green"), S("SCHEDULED"), "5,110", "Nov 24"], [ink("Spring launch teaser"), E("INCLUDE", "green"), S("CANCELLED"), "1,200", "Oct 30"]]);
    return '<div class="a-page"><div class="a-head"><div><h1>Active customers (EU)</h1><p>' + E("CRM_CONTACT") + " · " + ch("EMAIL") + " · consent required · evaluated 2 h ago · 3,980 members</p></div><div class=\"acts\">" + btn("Refresh count", "zap") + btn("Export", "file") + btn("Use in campaign", "send") + btn("Edit", "edit", "primary") + "</div></div>" +
      '<div class="mini-stats">' + stat("Members", "3,980", "+62 this week") + stat("Opted in", "3,731", "93.7%") + stat("Unknown consent", 187, "dropped at send", 1) + stat("Suppressed", 62, "dropped at send", 1) + stat("Campaigns", 4, "used") + "</div>" +
      '<div class="tabset">' + tabs([["m", "Members"], ["d", "Definition"], ["u", "Usage", 4], ["h", "Activity"]], "m") + pane("m", 1, filterBar([["Consent", "is", "Any"]], search("Search member")) + mem) + pane("d", 0, def) + pane("u", 0, use) + pane("h", 0, cd("<b>Activity</b>", '<div class="tl"><div class="ev"><b>Definition changed: added “Outstanding invoices is 0”</b><small>Sofia Jensen · Nov 8</small></div><div class="ev"><b>Count refreshed: 3,980</b><small>Nov 11, 07:00 (scheduled)</small></div><div class="ev"><b>Segment created</b><small>Sofia Jensen · Sep 14</small></div></div>')) + "</div>" +
      dm(["Segment · all columns", "CampaignAudience · Campaign (usage) · CrmContact · CrmCompany · CommConsent · CommSuppression", "Billing state (08) and project state (05) are read through the filter fields, never copied"], ["Filter fields for subscription plan, outstanding invoices, active projects come from other modules: the field catalog endpoint is a gap (gaps-11.md #3)"]) + "</div>";
  }
  function segTree() {
    const r = (fl, op, v) => '<div class="cp-rule">' + sel(fl, "filter") + sel(op) + sel(v) + '<button class="btn ghost sm icon">' + I("x", 13) + "</button></div>";
    return '<div class="cp-tree"><div class="cp-grp"><div class="cp-gh"><span class="seg on">AND</span><span class="seg">OR</span><span class="muted">All of the following</span></div>' + r("Company · Region", "is any of", "DACH, Nordics, South EU") + r("Company · Account status", "is", "Active") +
      '<div class="cp-grp"><div class="cp-gh"><span class="seg">AND</span><span class="seg on">OR</span><span class="muted">Any of the following</span></div>' + r("Subscription · Plan", "is", "Retainer") + r("Projects · Active count", "is at least", "1") + '<button class="btn sm ghost">' + I("plus", 13) + " Add rule</button></div>" +
      r("Billing · Outstanding invoices", "is", "0") + '<div class="rowx" style="padding:4px 0"><button class="btn sm ghost">' + I("plus", 13) + ' Add rule</button><button class="btn sm ghost">' + I("layers", 13) + ' Add group</button></div></div></div>';
  }

  /* =====================================================================================================================
     SEGMENT BUILDER / CREATE (spec "Customer Segmentation")
     @screen New segment
     @route  /campaigns/segments/new?entity_type=&from_saved_view=<id> · /campaigns/segments/:id/edit
     @perm   communications.segments.create · edit communications.segments.update · fields from other modules are listed only if the caller may read them (crm.contacts.read, finance.invoices.read, projects.projects.read) otherwise the rule is hidden
     @api    POST /communications/segments {name, description, entity_type, channel, require_consent, saved_view_id?, definition} · POST /communications/segments/preview {entity_type, definition, channel, require_consent} → {count, sample[], excluded{no_consent, suppressed}} ·
             GET /communications/segments/fields?entity_type= (field catalog with operators and value pickers)
     @mcp    communications_segments_create · communications_segments_update
     @data   Segment (name, description, entity_type, channel, require_consent, saved_view_id, definition) · custom_field_definitions (02 §24) · taggings (02 §36) · SavedView (02 §29) · CrmCompany/CrmContact fields (industry, region, language, account status, last activity) ·
             billing state (08: plan, billing status, outstanding invoices) · project state (05: active projects)
     @ui     shadcn Form, Select (entity), Popover + Command for every field and value picker (multi-select, searchable), nested rule groups (AND / OR) with drag handles, ToggleGroup, Switch, Card with live preview Table, Alert
     @states validation (every rule needs a value) · previewing (debounced 500 ms, skeleton count) · zero match warning · invalid rule after a field was removed · saving · saved · no-access to a field (rule is hidden and the segment is read-only)
     @audit  segment created with the final definition
     @note   The filter tree is the same typed JSON as SavedView filters: { and | or: [ {field, op, value} | nested group ] }. Operators depend on the field type (is, is not, is any of, contains, before, after, between, is empty, at least, at most).
             Fields available per entity type: CRM_CONTACT (customer, organization, tags, industry, region, language, lifecycle, last activity, consent status, custom fields), CRM_COMPANY (plus subscription plan, active projects, billing status,
             outstanding invoices), MEMBERSHIP (team, branch, role). The preview endpoint evaluates server-side with the caller's scope.
     @gap    Cross-module filter fields (subscription plan, outstanding invoices, active projects) need a field catalog contract with 05 / 08 (gaps-11.md #3).
     ===================================================================================================================== */
  function segmentNew() {
    return '<div class="a-page">' + head("New segment", "Describe who belongs to this audience. Members are evaluated when a campaign sends.", btn("Cancel") + btn("Save segment", "plus", "primary")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Details</b>", f("Name", box("e.g. Retainer clients in DACH")) + f("Description", box("Who is this for and when to use it")) + '<div class="g2">' + f("Entity type", '<div class="rowx" style="gap:8px;padding:0">' + ["CRM_CONTACT", "CRM_COMPANY", "MEMBERSHIP"].map((t, i) => '<span class="seg' + (i === 0 ? " on" : "") + '" title="SegmentEntityType ' + t + '">' + U.en(t) + "</span>").join("") + "</div>", "Contacts are people, companies resolve to their contacts with the matching role, members are internal staff.") + f("Channel", sel("Email", "mail"), "Optional: with a channel, consent and suppression of that channel apply to the preview count.") + "</div>") + gap() +
      cd("<b>Rules</b><span class='r muted'>Segment.definition</span>", segTree() + '<div class="sub-note">Available fields: customer, organization, project, subscription plan, active projects, billing status, outstanding invoices, tags, industry, region, language, account status, last activity, consent, custom fields.</div>') + gap() +
      cd("<b>Options</b>", row("Only contacts who opted in", "Segment.require_consent · uses CommConsent for the channel", sw(1)) + row("Keep in sync with a CRM saved view", "Segment.saved_view_id (02 §29): rules become read-only", sw(0)) + f("Saved view", sel("Choose a CRM view…", "star"))) + "</div><div>" +
      cd("<b>Live preview</b><span class='r muted'>updates as you edit</span>", '<div class="cp-kpi"><small>Matching contacts</small><b>3,980</b><span>of 18,204 contacts in the organization</span></div>' + kvr("With consent", "3,731") + kvr("No consent yet", "187") + kvr("Suppressed", "62") + kvr("Evaluated in", "0.4 s") + gap(8) + '<b class="muted">Sample</b>' + row("Lena Kovac", "Acme Corp · DACH") + row("Tom Berg", "Northwind · Nordics") + row("Ae-ri Park", "Vertex · APAC") + gap(8) + btn("Refresh preview", "zap", "sm")) + gap() +
      callout("flag", "<b>Zero or huge result?</b> If the preview is 0 an Alert suggests which rule removes the most people. Above 50% of all contacts a warning asks you to confirm it is intended.") + "</div></div>" +
      dm(["Segment · name, description, entity_type, channel, require_consent, saved_view_id, definition", "custom_field_definitions (02) · taggings (02) · SavedView (02) · CrmContact · CrmCompany", "Read-only: billing and project state (08, 05) through the field catalog"], ["Field catalog for cross-module fields (gaps-11.md #3)"]) + "</div>";
  }

  /* =====================================================================================================================
     RECIPIENT LISTS (spec "Recipients")
     @screen Recipient lists
     @route  /campaigns/lists · /campaigns/lists/:listId
     @perm   VIEW communications.segments.read (interim, see @gap) · manage communications.segments.create / update / archive
     @api    GET /communications/lists · POST /communications/lists {name, description, channel} · POST /communications/lists/:id/members {kind, contact_id|membership_id|address,name} · POST /communications/lists/:id/import (CSV) · DELETE /communications/lists/:id/members/:memberId
     @mcp    communications_segments_read (interim)
     @data   CommRecipientList (name, description, channel, member_count, archived_at, created_by_membership_id) · CommRecipientListMember (kind CRM_CONTACT | MEMBERSHIP | PORTAL_USER | EXTERNAL, contact_id, membership_id, address, name, added_by_membership_id)
     @ui     shadcn Table, Dialog (add members, CSV import with column mapping), Tabs, Badge
     @states loading · empty list · import validation report (invalid addresses, duplicates) · error · no-access
     @audit  list created, archived, members added or removed (bulk with count), imports
     @note   Static lists are hand-picked or imported; dynamic audiences are Segments. EXTERNAL members are bare addresses (no CRM contact): they have no CommConsent row, so campaigns with require_consent skip them unless an import marks consent evidence.
     @gap    No permission keys for lists: communications.recipient_lists.* are missing (gaps-11.md #4).
     ===================================================================================================================== */
  function lists() {
    return '<div class="a-page">' + head("Recipient lists", "Static lists of contacts, members and external addresses. Dynamic audiences are segments.", btn("Import CSV", "file") + btn("New list", "plus", "primary")) +
      '<div class="toolbar">' + search("Search lists") + sel("Channel: Any", "layers") + "</div>" +
      tbl(["List", "Channel", ">Members", "Composition", "Created by", "Updated", ""], [[ink("Newsletter subscribers"), ch("EMAIL"), "1,540", E("CRM_CONTACT") + " 1,498 " + E("EXTERNAL", "yellow") + " 42", wh("SJ"), "Nov 9", more], [ink("Event attendees 2025"), ch("EMAIL"), "620", E("CRM_CONTACT") + " 620", wh("AM"), "Oct 2", more], [ink("On-call SMS contacts"), ch("SMS"), "38", E("CRM_CONTACT") + " 31 " + E("MEMBERSHIP", "blue") + " 7", wh("JK"), "Nov 3", more], [ink("Team announcements"), ch("EMAIL"), "24", E("MEMBERSHIP", "blue") + " 24", wh("AM"), "Sep 20", more]]) +
      gap() + cd("<b>Newsletter subscribers</b><span class='r'>" + btn("Add members", "plus", "sm") + "</span>", tbl(["Member", "Kind", "Address", "Consent", "Added"], [[who("LK", "", "Lena Kovac", "", ""), E("CRM_CONTACT"), "lena.kovac@acme.com", S("OPTED_IN"), "Aug 4"], [who("PX", "g", "Press desk", "", ""), E("EXTERNAL", "yellow"), "press@example.org", muted("No CRM contact"), "Nov 2"], [who("TB", "g", "Tom Berg", "", ""), E("CRM_CONTACT"), "tom@northwind.io", S("OPTED_IN"), "Sep 12"]]), 1) +
      dm(["CommRecipientList · name, description, channel, member_count, archived_at", "CommRecipientListMember · kind, contact_id, membership_id, address, name, added_by_membership_id · CommConsent (read)"], ["Permission keys communications.recipient_lists.* (gaps-11.md #4)"]) + "</div>";
  }

  /* =====================================================================================================================
     TEMPLATES LIBRARY (spec "Communication Templates")
     @screen Templates library
     @route  /campaigns/templates?channel=&kind=&category=&status=&language=&q=
     @perm   VIEW communications.templates.read · create/duplicate communications.templates.create · edit/publish communications.templates.update · archive communications.templates.archive · delete communications.templates.delete* · export communications.templates.export*
     @api    GET /communications/templates?filter=&q=&cursor= · POST /communications/templates · POST /communications/templates/:id/duplicate · POST /communications/templates/bulk {ids, action: archive|delete}
     @mcp    communications_templates_read · communications_templates_create · communications_templates_update
     @data   CommTemplate (name, slug, description, channel, kind, category, status, language, current_version_id, is_system, use_branded_layout, usage_count, last_used_at, archived_at, branch_id, notification_event_type_id) · CommTemplateVersion (version, status, published_at)
     @ui     shadcn Table or Card grid (ToggleGroup), filter bar with category Combobox, Badge, DropdownMenu, Dialog (new template: channel, kind, category)
     @states loading · empty per filter · error · no-access · system templates are read-only (duplicate to customize)
     @audit  template created, duplicated, archived, deleted
     @note   Kinds: COMMUNICATION (one-off customer emails), CAMPAIGN (bulk), NOTIFICATION (14 delivery layout, bound to notification_event_type_id), SYSTEM (platform: invitations, password reset: is_system, not deletable). 30 categories are grouped
             in the Category filter (project, billing, onboarding, contracts, support, marketing).
     ===================================================================================================================== */
  const TPL = [["Product update", "EMAIL", "CAMPAIGN", "MARKETING_CAMPAIGN", "ACTIVE", "EN", 4, 23, 0], ["Project update", "EMAIL", "COMMUNICATION", "PROJECT_UPDATE", "ACTIVE", "EN", 7, 142, 0], ["Milestone completed", "EMAIL", "COMMUNICATION", "MILESTONE_COMPLETION", "ACTIVE", "EN", 3, 64, 0], ["Payment reminder", "EMAIL", "COMMUNICATION", "PAYMENT_REMINDER", "ACTIVE", "EN", 5, 311, 0], ["Payment reminder (SMS)", "SMS", "COMMUNICATION", "PAYMENT_REMINDER", "ACTIVE", "EN", 2, 88, 0], ["Welcome and onboarding", "EMAIL", "COMMUNICATION", "WELCOME", "ACTIVE", "EN", 6, 77, 0], ["Maintenance announcement", "EMAIL", "COMMUNICATION", "MAINTENANCE_ANNOUNCEMENT", "ACTIVE", "EN", 2, 9, 0], ["Holiday greetings", "EMAIL", "CAMPAIGN", "HOLIDAY_GREETING", "DRAFT", "EN", 1, 0, 0], ["Notification layout", "EMAIL", "NOTIFICATION", "NOTIFICATION", "ACTIVE", "EN", 9, 12480, 1], ["Team invitation", "EMAIL", "SYSTEM", "OTHER", "ACTIVE", "EN", 3, 214, 1], ["Black Friday 2025", "EMAIL", "CAMPAIGN", "MARKETING_CAMPAIGN", "ARCHIVED", "EN", 3, 2, 0]];
  function templates() {
    return '<div class="a-page">' + head("Templates", "Reusable email and SMS templates with variables, conditional content and translations.", btn("Import", "file") + btn("New template", "plus", "primary")) +
      '<div class="toolbar">' + search("Search name or slug") + sel("Table", "grid") + sel("Sort: Most used ↓", "sort") + sel("Category: All", "tag") + "</div>" +
      filterBar([["Channel", "is any of", "Email, SMS"], ["Status", "is not", "Archived"], ["Language", "is", "Any"]], btn("Save view", "plus", "sm")) +
      '<div class="panel" style="margin-top:0"><table>' + th(["", "Template", "Channel", "Kind", "Category", "Status", "Language", "Version", ">Used", "Branded", ""]) + "<tbody>" + TPL.map((t, i) => "<tr><td>" + cb(0) + "</td><td>" + ink(t[0]) + (t[8] ? " " + E("System", "") : "") + "</td><td>" + ch(t[1]) + "</td><td>" + E(t[2]) + "</td><td>" + E(t[3]) + "</td><td>" + S(t[4]) + "</td><td>" + t[5] + "</td><td>v" + t[6] + "</td><td class='num'>" + t[7] + "</td><td>" + sw(t[2] !== "SYSTEM") + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="pager"><span class="muted">1–11 of 46</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["CommTemplate · name, slug, channel, kind, category, status, language, current_version_id, is_system, use_branded_layout, usage_count, last_used_at, archived_at", "CommTemplateVersion · version, status, published_at"], ["Template folders or tags: use taggings (02) if tags are wanted, no folder model (gaps-11.md #10)"]) + "</div>";
  }

  /* =====================================================================================================================
     TEMPLATE EDITOR (spec "Communication Templates", "AI Communication Assistant")
     @screen Template editor
     @route  /campaigns/templates/:templateId?tab=content|versions|translations|settings&version=<n> · /campaigns/templates/new
     @perm   VIEW communications.templates.read · edit/publish communications.templates.update · create communications.templates.create · archive communications.templates.archive · AI assist = same key as editing (no extra key, see gaps-11.md #5)
     @api    GET /communications/templates/:id · POST /communications/templates/:id/versions {subject, preheader, body_html, body_text, design, variables, change_note} (creates a DRAFT version) · POST /communications/templates/:id/versions/:v/publish ·
             PUT /communications/templates/:id/versions/:v/translations/:language · POST /communications/templates/:id/render-preview {contact_id|sample, language} · POST /communications/ai {task, channel, input}
     @mcp    communications_templates_read · communications_templates_update (publish is a separate tool call)
     @data   CommTemplate (name, slug, description, channel, kind, category, status, language, default_sender_identity_id, use_branded_layout, variables, notification_event_type_id, ai_generation_id) · CommTemplateVersion (version, status, subject, preheader, body_html, body_text, design, variables,
             attachment_document_ids, change_note, published_at) · CommTemplateTranslation (language, subject, preheader, body_html, body_text, is_machine_translated, reviewed_by_membership_id, reviewed_at) · CommAiGeneration (task, prompt, output, accepted) · Branding (01 §15, §120)
     @ui     Visual block editor (drag blocks, design Json) + HTML code tab + plain-text tab, shadcn Tabs, Sheet (variables picker), Command (insert variable), Select, Switch, Dialog (publish with change note), Table (versions), Alert (unreplaced variables)
     @states loading · unsaved changes (guard) · variable not in the catalog (warning) · missing plain-text part (auto-generated, editable) · invalid HTML · publish blocked while required variable lacks a sample · no-access (read-only)
     @audit  version created, published, restored, translation reviewed, template archived
     @note   Versions are IMMUTABLE once PUBLISHED; editing creates a new DRAFT version, publishing moves CommTemplate.current_version_id and archives nothing (old versions stay for audit and for campaigns that pinned them). SMS templates have body_text only with a segment counter.
             Variables come from the catalog: contact (02), company (02), project (05), invoice and payment (08), sender and organization branding. use_branded_layout wraps the body in the branded layout from 01 §15. Conditional blocks use {{#if}}.
             Machine translations (is_machine_translated) must be reviewed before they are used for sending.
     ===================================================================================================================== */
  function template() {
    const side = cd("<b>Template</b>", f("Name", box("Product update")) + f("Slug", box("product-update")) + '<div class="g2">' + f("Channel", sel("Email", "mail")) + f("Kind", sel("Campaign")) + "</div>" + f("Category", sel("Marketing campaign", "tag")) + '<div class="g2">' + f("Language", sel("English")) + f("Status", sel("Active")) + "</div>" + f("Default sender", sel("hello@acme-agency.com", "mail")) + row("Branded layout", "Wrap with the organization header and footer (01 §15)", sw(1))) + gap() +
      cd("<b>Variables</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", [["contact.first_name", "Lena"], ["company.name", "Acme Corp"], ["project.name", "Website relaunch"], ["invoice.amount_due", "1,200.00 EUR"], ["unsubscribe_url", "required"]].map((v) => row(tok("{{" + v[0] + "}}"), "Sample: " + v[1])).join(""), 1);
    const editor = '<div class="g2" style="grid-template-columns:1.2fr 1fr;align-items:start"><div>' + cd("<b>Content</b><span class='r'>" + sel("Visual", "panel") + btn("Improve with AI", "sparkles", "sm") + "</span>", f("Subject", box("Your {{company.name}} update is here, {{contact.first_name}}")) + f("Preheader", box("What shipped, what's next")) +
      '<div class="editor"><div class="ed-bar">' + ["Text", "Image", "Button", "Columns", "Divider", "Social", "Conditional", "Variable"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body"><div class="cp-blk">Header (branded layout)</div><div class="cp-blk">Heading · What we shipped</div><div class="cp-blk">Text · Hi {{contact.first_name}}, …</div><div class="cp-blk cond">{{#if invoice.amount_due}} Payment block {{/if}}</div><div class="cp-blk">Button · Read the release notes</div><div class="cp-blk">Footer · {{unsubscribe_url}}</div></div></div>' + f("Plain-text version", box("Auto-generated from the HTML, editable")) + f("Attachments", '<div class="drop">' + I("clip", 16) + " Documents (17)</div>")) + "</div>" +
      cd("<b>Preview</b><span class='r'>" + sel("Desktop", "panel") + sel("Sample: Lena Kovac", "users") + sel("EN") + "</span>", emailPrev("Your Acme Corp update is here, Lena", "Product update")) + "</div>";
    const vers = tbl(["Version", "Status", "Change note", "By", "Published", ""], [["v5", S("DRAFT"), "New hero copy", wh("SJ"), "—", btn("Publish", "send", "sm")], ["v4", S("PUBLISHED") + " " + E("Current", "blue"), "Added conditional payment block", wh("SJ"), "Oct 20", more], ["v3", S("ARCHIVED"), "Brand refresh", wh("AM"), "Sep 14", more], ["v2", S("ARCHIVED"), "Fix footer links", wh("AM"), "Aug 2", more]]);
    const tr = tbl(["Language", "Subject", "Machine", "Reviewed by", "Reviewed"], [["EN (source)", "Your {{company.name}} update…", "—", "—", "—"], ["DE", "Ihr {{company.name}}-Update ist da…", E("Machine translated", "yellow"), wh("MS"), "Oct 21"], ["FR", "Votre mise à jour {{company.name}}…", E("Machine translated", "yellow"), muted("Not reviewed"), "—"]]) + '<div class="sub-note" style="margin-top:8px">Language is chosen from CrmContact.language, falling back to the template language. Unreviewed machine translations are not used for sending.</div>';
    const ai = cd("<b>AI assistant</b><span class='r muted'>CommAiGeneration · never applied automatically</span>", row("Suggest subject lines", "Task SUBJECT_LINES", btn("Generate", "sparkles", "sm")) + row("Improve tone and grammar", "Task IMPROVE_TONE", btn("Run", "sparkles", "sm")) + row("Translate to German", "Task TRANSLATE · creates a machine translation to review", btn("Run", "sparkles", "sm")) + row("Draft a new template from a prompt", "Task GENERATE_TEMPLATE", btn("Open", "sparkles", "sm")), 1);
    return '<div class="a-page"><div class="a-head"><div><h1>Product update</h1><p>' + ch("EMAIL") + " · " + E("CAMPAIGN") + " · " + S("ACTIVE") + " · current v4 · draft v5 · used in 23 campaigns</p></div><div class=\"acts\">" + btn("Send test", "send") + btn("Duplicate", "layers") + btn("Save draft") + btn("Publish v5", "send", "primary") + "</div></div>" +
      '<div class="tabset">' + tabs([["c", "Content"], ["v", "Versions", 5], ["t", "Translations", 3], ["i", "AI"], ["s", "Settings"]], "c") + pane("c", 1, editor) + pane("v", 0, vers) + pane("t", 0, tr) + pane("i", 0, ai) + pane("s", 0, '<div class="g2" style="align-items:start">' + side + cd("<b>Usage</b>", kvr("Used in campaigns", 23) + kvr("Used in messages", 142) + kvr("Last used", "Nov 8") + kvr("Notification event", "—") + kvr("Created by", "Sofia Jensen")) + "</div>") + "</div>" +
      gap() + cd("<b>SMS variant</b><span class='r muted'>channel SMS: body_text only</span>", '<div class="editor"><div class="ed-body">Hi {{contact.first_name}}, your invoice {{invoice.number}} of {{invoice.amount_due}} is due {{invoice.due_date}}. Pay: {{short_url}} Reply STOP to opt out.</div></div><div class="sub-note">142 characters · 1 segment (GSM-7) · Message.sms_segment_count is stored at send time.</div>') +
      dm(["CommTemplate · CommTemplateVersion · CommTemplateTranslation · CommAiGeneration", "CommSenderIdentity (default sender) · Branding (01) · Documents (17) for attachments"], []) + "</div>";
  }

  /* =====================================================================================================================
     AUTOMATIONS (spec "Automation")
     @screen Triggered communications
     @route  /campaigns/automations?rule=<automationRuleId>&template=&status=
     @perm   VIEW communications.messages.read · create/edit rules is owned by module 20 (automation permission keys of 20) · the action "send email/SMS from template" needs communications.messages.send* of the rule's service account or membership
     @api    GET /communications/messages?source=AUTOMATION&automation_rule_id=&from=&to= · GET /communications/automations/summary (group by automation_rule_id) · rules: GET/POST /automation/rules (20)
     @mcp    communications_messages_read · rules via the 20 tools
     @data   CommMessage (source AUTOMATION, automation_rule_id, automation_run_id, template_id, status, sent_at) · CommTemplate (kind COMMUNICATION, category WELCOME, PAYMENT_REMINDER, FAILED_PAYMENT, CONTRACT_EXPIRATION_REMINDER, ...) · Read-only: AUTOMATION_RULE (RecordEntityType, 20)
     @ui     shadcn Table, Card, Badge, Sheet (rule summary), link out to the rule builder in 20
     @states loading · empty ("No automation has sent a message yet. Create a rule in Automation with the action Send email from template") · error · no-access
     @audit  none here; sends are audited as CommMessage, rule changes in 20
     @note   This module does NOT run a rules engine: triggers, conditions, delays and branches live in 20. The screen shows what each rule sent, deliverability and opt-outs, so it doubles as the "journeys report". Typical rules: welcome, onboarding,
             project created, milestone completed, invoice generated, payment confirmed or failed, renewal, contract expiry, maintenance, project completed, follow-up.
     @gap    Multi-step journeys (a visual path with waits, branches and goals, per-step funnel and enrollment per contact) have no model: neither Customer.io-style journeys nor enrollments exist. See gaps-11.md #6.
     ===================================================================================================================== */
  function automations() {
    return '<div class="a-page">' + head("Automations", "Messages sent by automation rules (engine in Automation, module 20).", btn("Open Automation", "zap") + btn("New rule", "plus", "primary")) +
      callout("zap", "Rules, delays and branches are built in the Automation app. This view reports what they sent. <b>Journeys</b> (multi-step paths with enrollments) are not in the schema yet.", "warn") + gap(10) +
      filterBar([["Source", "is", "Automation"], ["Period", "is", "Last 30 days"]], sel("Group: Rule", "layers")) +
      tbl(["Rule (20)", "Action template", "Channel", ">Sent", ">Delivered", ">Opened", ">Failed", ">Opt-outs", "Last run"], [[ink("Welcome new customer"), "Welcome and onboarding", ch("EMAIL"), 31, pct(30, 31), pct(22, 30), 1, 0, "Today 08:10"], [ink("Invoice payment reminder · day 3"), "Payment reminder", ch("EMAIL"), 118, pct(116, 118), pct(81, 116), 2, 1, "Today 07:00"], [ink("Invoice payment reminder · SMS day 10"), "Payment reminder (SMS)", ch("SMS"), 22, pct(22, 22), "—", 0, 0, "Yesterday"], [ink("Milestone completed"), "Milestone completed", ch("EMAIL"), 27, pct(27, 27), pct(21, 27), 0, 0, "Nov 10"], [ink("Contract expires in 30 days"), "Contract renewal", ch("EMAIL"), 9, pct(9, 9), pct(8, 9), 0, 0, "Nov 9"], [ink("Maintenance window notice"), "Maintenance announcement", ch("EMAIL"), 214, pct(210, 214), pct(150, 210), 4, 2, "Nov 8"]]) + gap() +
      cd("<b>Recent automated messages</b><span class='r muted'>CommMessage source AUTOMATION</span>", row("Payment reminder to Lena Kovac", "Rule “Invoice payment reminder · day 3” · run #8812 · Invoice INV-2026-0412", S("DELIVERED")) + row("Welcome email to Tom Berg", "Rule “Welcome new customer” · run #8810", S("DELIVERED")) + row("Payment reminder to Info Brightco", "Rule “Invoice payment reminder · day 3” · run #8809", S("BOUNCED")), 1) +
      dm(["CommMessage · source AUTOMATION, automation_rule_id, automation_run_id, template_id, status, sent_at, source_entity_type, source_entity_id", "CommTemplate · category", "Read-only: AUTOMATION_RULE, AUTOMATION_RUN (20)"], ["Journeys: steps, waits, branches, goals and per-contact enrollment (gaps-11.md #6)", "Rule NAME is owned by 20: only the id is stored on CommMessage"]) + "</div>";
  }

  /* =====================================================================================================================
     MESSAGES LOG (spec "Communication History", "Email Management", "SMS Management", "Delivery Tracking")
     @screen Messages log
     @route  /campaigns/messages?channel=&kind=&source=&status=&company=&project=&sender=&from=&to=&q=&view=
     @perm   VIEW communications.messages.read (customer and campaign messages; NOTIFICATION kind needs communications.settings.manage*) · compose communications.messages.create · send communications.messages.send* · archive communications.messages.archive ·
             delete communications.messages.delete* · export communications.messages.export* · scope: branch and project scope of the caller
     @api    GET /communications/messages?filter=&q=&cursor= (full-text on search_vector) · POST /communications/messages {channel, to, subject, body, template_id, company_id, project_id, scheduled_at} · POST /communications/messages/bulk {ids, action: archive|cancel|resend} ·
             POST /communications/messages/:id/{send|cancel|resend}
     @mcp    communications_messages_read · communications_messages_create · communications_messages_send (sensitive)
     @data   CommMessage (channel, kind, source, status, subject, to_address, to_name, recipient_contact_id, company_id, project_id, campaign_id, template_id, sent_by_membership_id, scheduled_at, sent_at, delivered_at, open_count, click_count, bounce_type, failure_reason,
             is_test, archived_at, search_vector) · CommMessageLink · CommThread
     @ui     shadcn Table, filter bar, Command, saved views, Sheet peek of a message, bulk bar, Dialog compose (To combobox, subject, editor, template, schedule)
     @states loading · empty · error · no-access · queue view: SCHEDULED and QUEUED rows with next_attempt_at and attempt_count · retry for FAILED
     @audit  message sent, cancelled, resent, archived, exported
     @note   One row = one message to one primary recipient (cc/bcc live in CommMessageRecipient). Customer-facing history is also contributed to the Customer 360 timeline (02 §18). Notifications from 14 are logged separately (kind NOTIFICATION) and hidden by default.
             The "Queue" tab is the scheduling queue management view: SCHEDULED / QUEUED with cancel and reschedule.
     ===================================================================================================================== */
  const MSG = [["m-9101", "EMAIL", "CUSTOMER", "MANUAL", "SENT", "Re: Website relaunch, staging link", "Lena Kovac", "Acme Corp", "Website relaunch", "AM", "Nov 11 11:02"], ["m-9099", "EMAIL", "TRANSACTIONAL", "AUTOMATION", "DELIVERED", "Payment reminder: invoice INV-2026-0412", "Lena Kovac", "Acme Corp", "", "—", "Nov 11 07:00"], ["m-9060", "EMAIL", "CAMPAIGN", "CAMPAIGN", "DELIVERED", "Your November update is here", "Ae-ri Park", "Vertex", "", "SJ", "Nov 11 09:04"], ["m-9051", "EMAIL", "CAMPAIGN", "CAMPAIGN", "BOUNCED", "Your November update is here", "Info Brightco", "Brightco", "", "SJ", "Nov 11 09:03"], ["m-9044", "SMS", "CUSTOMER", "MANUAL", "DELIVERED", "Your site is back online", "Tom Berg", "Northwind", "Retainer support", "JK", "Nov 10 18:20"], ["m-9030", "EMAIL", "CUSTOMER", "MODULE", "SCHEDULED", "Proposal PR-2026-031 reminder", "Marta Rossi", "Globex", "", "MS", "Nov 12 09:00"], ["m-9012", "SMS", "TRANSACTIONAL", "AUTOMATION", "FAILED", "Payment failed: update your card", "James Hart", "Oldclient", "", "—", "Nov 10 08:00"], ["m-8990", "EMAIL", "CUSTOMER", "MANUAL", "DRAFT", "Q4 scope change", "Lena Kovac", "Acme Corp", "Website relaunch", "AM", "Draft"]];
  function messages() {
    return '<div class="a-page">' + head("Message log", "Every outbound email and SMS: customer messages, campaigns, automations and module sends.", btn("Export", "file") + btn("Compose", "plus", "primary")) +
      '<div class="toolbar">' + search("Search subject, body, recipient") + sel("Table", "grid") + sel("Sort: Sent ↓", "sort") + sel("Columns (9)", "settings") + sel("View: My sent", "star") + "</div>" +
      '<div class="tabset">' + tabs([["a", "All", 8], ["s", "Scheduled & queue", 3], ["d", "Drafts", 1], ["f", "Failed & bounced", 2], ["r", "Archived"]], "a") +
      filterBar([["Kind", "is not", "Notification"], ["Channel", "is any of", "Email, SMS"], ["Period", "is", "Last 7 days"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) + "</div>" +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span style="flex:1"></span>' + btn("Resend", "send", "sm") + btn("Cancel send", "x", "sm") + btn("Archive", "box", "sm") + btn("Export", "file", "sm") + "</div>" +
      '<div class="panel" style="margin-top:0"><table>' + th(["", "Subject", "Channel", "Kind", "Source", "Status", "Recipient", "Linked to", "Sent by", "When"]) + "<tbody>" + MSG.map((m, i) => "<tr><td>" + cb(i < 2) + "</td><td>" + ink(m[5]) + "<br>" + muted(m[0]) + "</td><td>" + ch(m[1]) + "</td><td>" + E(m[2]) + "</td><td>" + E(m[3]) + "</td><td>" + S(m[4]) + "</td><td>" + m[6] + "<br>" + muted(m[7]) + "</td><td>" + (m[8] || muted("—")) + "</td><td>" + (PEOPLE[m[9]] ? wh(m[9]) : muted("Automation")) + "</td><td>" + m[10] + "</td></tr>").join("") + "</tbody></table></div>" +
      '<div class="pager"><span class="muted">1–8 of 2,184</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["CommMessage · channel, kind, source, status, subject, to_address, to_name, recipient_contact_id, company_id, project_id, campaign_id, template_id, sent_by_membership_id, scheduled_at, sent_at, delivered_at, failure_reason, archived_at, search_vector", "CommMessageLink · CommThread"], []) + "</div>";
  }

  /* =====================================================================================================================
     MESSAGE DETAIL (spec "Delivery Tracking", "Customer Communication", "Email Management")
     @screen Message page
     @route  /campaigns/messages/:messageId
     @perm   VIEW communications.messages.read · resend/cancel communications.messages.send* · archive communications.messages.archive · delete communications.messages.delete* · attachments need documents.documents.read
     @api    GET /communications/messages/:id (+ recipients, attachments, links, events) · GET /communications/messages/:id/events · POST /communications/messages/:id/{resend|cancel|archive}
     @mcp    communications_messages_read · communications_messages_send
     @data   CommMessage (all columns) · CommMessageRecipient (role TO/CC/BCC, status, delivered_at, opened_at, clicked_at, bounced_at, failure_reason) · CommMessageAttachment (filename, mimetype, size, is_inline, document_id) · CommMessageLink (entity_type, entity_id, relation) ·
             CommDeliveryEvent (type, occurred_at, provider, url, user_agent, ip_address, bounce_type, bounce_code, reason) · CommThread · CommSignature
     @ui     shadcn Card, Tabs, Timeline, Badge, Table, Sheet (raw event payload, permission-gated)
     @states loading · not found · message deleted (deleted_at: tombstone for audit) · no-access
     @audit  every state change comes from provider events (CommDeliveryEvent, idempotent via provider_webhook_events); manual actions are audit events
     @note   Email bodies are rendered in a sandboxed iframe. IP address and user agent are personal data: shown only to communications.settings.manage* holders and purged by the retention policy. branding_snapshot and render_context keep exactly what was sent.
     ===================================================================================================================== */
  function message() {
    return '<div class="a-page"><div class="a-head"><div><h1>Re: Website relaunch, staging link</h1><p>m-9101 · ' + ch("EMAIL") + " · " + E("CUSTOMER") + " · " + E("MANUAL") + " · " + S("DELIVERED") + '</p></div><div class="acts">' + btn("Reply", "send") + btn("Resend", "zap") + btn("Archive", "box", "primary") + "</div></div>" +
      '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' + cd("<b>Content</b>", emailPrev("Re: Website relaunch, staging link", "Sent from the Communication Center")) + gap() +
      cd("<b>Delivery timeline</b><span class='r muted'>CommDeliveryEvent</span>", '<div class="tl"><div class="ev"><b>Clicked</b> ' + E("CLICKED", "green") + "<small>Nov 11, 11:31 · staging.acme.com · Safari on iPhone</small></div><div class=\"ev\"><b>Opened</b> " + E("OPENED", "green") + "<small>Nov 11, 11:09 · 3 opens total</small></div><div class=\"ev\"><b>Delivered</b> " + E("DELIVERED", "green") + "<small>Nov 11, 11:02 · Resend event evt_8f2a</small></div><div class=\"ev\"><b>Sent</b> " + E("SENT", "blue") + "<small>Nov 11, 11:02 · Anna Meyer · message id re_71c…</small></div><div class=\"ev\"><b>Queued</b><small>Nov 11, 11:02</small></div></div>") + "</div><div>" +
      cd("<b>Recipients</b>", row("Lena Kovac", "TO · lena.kovac@acme.com · opened 11:09", S("OPENED")) + row("Tom Berg", "CC · tom@northwind.io · delivered", S("DELIVERED")) + row("Anna Meyer", "BCC · internal copy", S("DELIVERED")), 1) + gap() +
      cd("<b>Linked records</b><span class='r muted'>CommMessageLink</span>", kvr("Company", "Acme Corp (02)") + kvr("Contact", "Lena Kovac (02)") + kvr("Project", "Website relaunch (05)") + kvr("Thread", "Website relaunch · 6 messages") + kvr("Support conversation", "CNV-1182 (13)")) + gap() +
      cd("<b>Sending details</b>", kvr("From", "Acme Agency &lt;hello@acme-agency.com&gt;") + kvr("Provider", "Resend") + kvr("Template", "Project update v7") + kvr("Signature", "Anna Meyer") + kvr("Tracking", "enabled") + kvr("Attachments", "1 · staging-guide.pdf (17)") + kvr("Opens / clicks", "3 / 1")) + gap() + cd("<b>Attachments</b>", row("staging-guide.pdf", "PDF · 284 KB · Document (17)", btn("Open", "file", "sm")), 1) + "</div></div>" +
      dm(["CommMessage · CommMessageRecipient · CommMessageAttachment · CommMessageLink · CommDeliveryEvent · CommThread · CommSignature · CommSenderIdentity"], []) + "</div>";
  }

  /* =====================================================================================================================
     THREADS (spec "Conversation threads")
     @screen Threads
     @route  /campaigns/threads?contact=&company=&project=&q= · /campaigns/threads/:threadId
     @perm   VIEW communications.messages.read · archive communications.messages.archive · replying communications.messages.send*
     @api    GET /communications/threads?filter= · GET /communications/threads/:id/messages · POST /communications/threads/:id/archive · POST /communications/messages {thread_id, in_reply_to_message_id, ...}
     @mcp    communications_messages_read
     @data   CommThread (subject, channel, contact_id, company_id, project_id, support_conversation_id, provider_thread_id, message_count, last_message_at, archived_at) · CommMessage (thread_id, in_reply_to_message_id, status) · CrmContact · CrmCompany · Project
     @ui     shadcn two-pane (list + conversation), Badge, Avatar, Textarea reply composer
     @states loading · empty · error · no-access
     @audit  thread archived, reply sent
     @note   A thread groups OUTBOUND messages and the inbound replies captured by 13 (support_conversation_id); inbound replies are owned by 13 and shown read-only here with a link. The inbox for customers is Support, this is the sending history.
     ===================================================================================================================== */
  function threads() {
    return '<div class="a-page">' + head("Threads", "Outbound conversations with customers, grouped by subject.", btn("Archive", "box") + btn("New message", "plus", "primary")) +
      '<div class="toolbar">' + search("Search threads") + sel("Company: Any", "building") + sel("Project: Any", "folder") + "</div>" +
      '<div class="g2" style="grid-template-columns:1fr 1.3fr;align-items:start">' + cd("<b>Threads</b>", [["Website relaunch", "Lena Kovac · Acme Corp", 6, "11:02", 1], ["Q4 scope change", "Lena Kovac · Acme Corp", 2, "Yesterday", 0], ["Retainer support: site outage", "Tom Berg · Northwind", 4, "Nov 10", 0], ["Proposal PR-2026-031", "Marta Rossi · Globex", 3, "Nov 8", 0]].map((t) => '<div class="rowx' + (t[4] ? " sel" : "") + '"><div class="grow"><b>' + t[0] + "</b><small>" + t[1] + "</small></div>" + E(t[2] + " msgs") + "<span class='muted'>" + t[3] + "</span></div>").join(""), 1) +
      cd("<b>Website relaunch</b><span class='r muted'>CommThread · project Website relaunch (05) · CNV-1182 (13)</span>", '<div class="tl"><div class="ev"><b>Anna Meyer</b> ' + S("DELIVERED") + "<small>Nov 11, 11:02 · Re: staging link, the new pages are live on staging.</small></div><div class=\"ev\"><b>Lena Kovac replied</b> " + E("REPLIED", "green") + "<small>Nov 11, 11:40 · captured by Support (13) · “Looks great, one question about the footer.”</small></div><div class=\"ev\"><b>Anna Meyer</b> " + S("SENT") + "<small>Nov 10, 16:10 · Staging link and review notes</small></div></div>" + '<div class="rowx" style="margin-top:8px"><div class="grow muted">Reply by email…</div>' + sel("Signature: Anna Meyer", "pen") + btn("Send", "send", "primary") + "</div>") + "</div>" +
      dm(["CommThread · subject, channel, contact_id, company_id, project_id, support_conversation_id, message_count, last_message_at, archived_at", "CommMessage · thread_id, in_reply_to_message_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     CONSENT & PREFERENCES (spec "Recipients")
     @screen Consent
     @route  /campaigns/consent?channel=&status=&source=&q= · /campaigns/consent/:contactId
     @perm   VIEW + edit communications.suppressions.manage* (interim, see @gap) · export needs the same key · contacts' own consent is also visible in CRM (02) when the caller has crm.contacts.read
     @api    GET /communications/consents?filter=&cursor= · PUT /communications/consents/:contactId/:channel {status, source, notes, evidence} · POST /communications/consents/import (CSV with evidence) · GET /communications/consents/:id/history
     @mcp    communications_suppressions_manage (interim)
     @data   CommConsent (contact_id, channel, status, source, marketing_opted_in, consented_at, withdrawn_at, confirmation_token, confirmation_expires_at, confirmed_at, evidence, notes, updated_by_membership_id) · CrmContact.consent (02, plain Json mirror, read-only here)
     @ui     shadcn Table, filter bar, Sheet (history and evidence), Dialog (change status needs a reason), Badge
     @states loading · empty · error · no-access · double opt-in pending expiry
     @audit  consent changed (old and new status, source, actor), imported with count, evidence viewed
     @note   CommConsent is the SOURCE OF TRUTH for marketing sends; CrmContact.consent is a mirror for CRM display. Status flow: UNKNOWN to PENDING_DOUBLE_OPT_IN to OPTED_IN, OPTED_IN to OPTED_OUT (withdrawn_at) via unsubscribe link, portal or manual.
             Unsubscribing also creates a CommSuppression (reason UNSUBSCRIBE) for the channel. Re-opt-in after OPTED_OUT requires new evidence. Evidence Json: timestamp, form id, IP, text shown.
     @gap    Preference center by topic (newsletter, product news, billing notices) is not modeled: consent is per contact and channel only. Dedicated permission keys for consent are missing (gaps-11.md #4, #7).
     ===================================================================================================================== */
  function consent() {
    return '<div class="a-page">' + head("Consent", "Who agreed to receive marketing messages, per channel, with evidence.", btn("Import consents", "file") + btn("Export", "file")) +
      '<div class="mini-stats">' + stat("Opted in (email)", "14,220", "78.1%") + stat("Pending double opt-in", 96, "expires in 3 d", 1) + stat("Opted out", 812, "4.5%") + stat("Unknown", "3,172", "no marketing sends") + stat("Opted in (SMS)", "1,904", "10.5%") + "</div>" +
      '<div class="toolbar">' + search("Search contact or address") + sel("Table", "grid") + sel("Sort: Updated ↓", "sort") + "</div>" +
      filterBar([["Channel", "is", "Email"], ["Status", "is any of", "Pending double opt-in, Opted out"], ["Source", "is", "Any"]], btn("Save view", "plus", "sm")) +
      tbl(["Contact", "Channel", "Status", "Source", "Consented", "Withdrawn", "Evidence", "Updated by", ""], [[who("LK", "", "Lena Kovac", "lena.kovac@acme.com", ""), ch("EMAIL"), S("OPTED_IN"), E("FORM"), "Aug 4, 2026", "—", "Form “Newsletter” · IP 84.x", muted("System"), more], [who("MR", "p", "Marta Rossi", "m.rossi@globex.it", ""), ch("EMAIL"), S("PENDING_DOUBLE_OPT_IN"), E("DOUBLE_OPT_IN"), "—", "—", "Confirmation mail sent Nov 9", muted("System"), more], [who("JH", "r", "James Hart", "j.hart@oldclient.com", ""), ch("EMAIL"), S("OPTED_OUT"), E("UNSUBSCRIBE_LINK"), "Jan 11, 2025", "Oct 3, 2026", "Link in campaign c7", muted("System"), more], [who("TB", "g", "Tom Berg", "+45 20 11 22 33", ""), ch("SMS"), S("OPTED_IN"), E("MANUAL"), "Sep 12, 2026", "—", "Verbal consent, call CA-2201", wh("JK"), more], [who("AP", "y", "Ae-ri Park", "a.park@vertex.kr", ""), ch("EMAIL"), S("UNKNOWN"), E("IMPORT"), "—", "—", "Imported from CRM CSV", wh("AM"), more]]) +
      gap() + callout("shield", "<b>Changing consent needs a reason.</b> Setting OPTED_IN manually requires evidence text; the API refuses an OPTED_IN update from an OPTED_OUT contact without new evidence. Every change is an audit event.") +
      dm(["CommConsent · contact_id, channel, status, source, marketing_opted_in, consented_at, withdrawn_at, confirmation_expires_at, confirmed_at, evidence, notes, updated_by_membership_id", "CrmContact · consent (mirror) · CommSuppression (created on unsubscribe)"], ["Topic-based preference center (gaps-11.md #7)", "Permission keys communications.consents.* (gaps-11.md #4)"]) + "</div>";
  }

  /* =====================================================================================================================
     SUPPRESSIONS (spec "Recipients", "Delivery Tracking")
     @screen Suppression list
     @route  /campaigns/suppressions?channel=&reason=&q=&removed=
     @perm   VIEW + manage communications.suppressions.manage* (sensitive: removing an entry can re-enable mailing a complainer)
     @api    GET /communications/suppressions?filter= · POST /communications/suppressions {channel, address, reason: MANUAL, notes, expires_at, blocks_transactional} · POST /communications/suppressions/import · POST /communications/suppressions/:id/remove {reason} · GET /communications/suppressions/export
     @mcp    communications_suppressions_manage (human confirmation)
     @data   CommSuppression (channel, address, reason, contact_id, source_message_id, campaign_id, expires_at, blocks_transactional, notes, created_by_membership_id, removed_at, removed_by_membership_id) · CommMessage (source) · Campaign · CrmContact
     @ui     shadcn Table, filter bar, Dialog (add, import), AlertDialog (remove with reason), Badge, Sheet (source message)
     @states loading · empty · error · no-access · import report
     @audit  suppression added (auto by bounce or complaint, manual), removed (who, why), imported
     @note   Reasons: UNSUBSCRIBE, HARD_BOUNCE, SOFT_BOUNCE (expires after repeated retries), COMPLAINT, INVALID_ADDRESS, CONSENT_WITHDRAWN, MANUAL. A suppressed address is skipped by campaigns always; by transactional mail only when blocks_transactional is true
     (hard bounce, complaint). Entries are never hard-deleted: removed_at keeps the history. Provider-side suppression lists (Resend) are not read.
     ===================================================================================================================== */
  function suppressions() {
    const R = [["j.hart@oldclient.com", "EMAIL", "UNSUBSCRIBE", "James Hart", "Campaign: October case study digest", "Oct 3", "—", 0], ["info@brightco.de", "EMAIL", "HARD_BOUNCE", "", "Message m-9051", "Nov 11", "—", 1], ["peter@mailbox.xy", "EMAIL", "INVALID_ADDRESS", "", "Import check", "Nov 10", "—", 1], ["a.nils@startup.io", "EMAIL", "COMPLAINT", "Anna Nilsson", "Campaign: Feature release 3.2", "Nov 6", "—", 1], ["+49 171 5550110", "SMS", "UNSUBSCRIBE", "Karl Brandt", "Reply STOP to c3", "Nov 9", "—", 0], ["sales@fulldrive.no", "EMAIL", "SOFT_BOUNCE", "", "Mailbox full x3", "Nov 8", "Dec 8", 0], ["legal@acme.com", "EMAIL", "MANUAL", "", "Legal hold, do not market", "Sep 2", "—", 0]];
    return '<div class="a-page">' + head("Suppressions", "Addresses that must not be contacted. Enforced on every send.", btn("Import", "file") + btn("Export", "file") + btn("Add address", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active suppressions", 341, "email 318 · SMS 23") + stat("Hard bounces", 128, "") + stat("Complaints", 9, "", 1) + stat("Unsubscribes", 176, "") + stat("Added today", 12, "auto") + "</div>" +
      '<div class="toolbar">' + search("Search address or contact") + sel("Table", "grid") + sel("Sort: Added ↓", "sort") + "</div>" +
      filterBar([["Channel", "is any of", "Email, SMS"], ["Reason", "is any of", "All"], ["Removed", "is", "No"]], btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>1 selected</b><span style="flex:1"></span>' + btn("Remove from list", "x", "sm") + btn("Export", "file", "sm") + "</div>" +
      '<div class="panel" style="margin-top:0"><table>' + th(["", "Address", "Channel", "Reason", "Contact", "Source", "Added", "Expires", "Blocks transactional", ""]) + "<tbody>" + R.map((r, i) => "<tr><td>" + cb(i === 3) + "</td><td>" + ink(r[0]) + "</td><td>" + ch(r[1]) + "</td><td>" + E(r[2], r[2] === "COMPLAINT" || r[2] === "HARD_BOUNCE" ? "red" : "") + "</td><td>" + (r[3] || muted("No contact")) + "</td><td>" + r[4] + "</td><td>" + r[5] + "</td><td>" + r[6] + "</td><td>" + sw(r[7]) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" + gap() +
      callout("shield", "<b>Removing an entry</b> asks for a reason and is an audited, sensitive action. Complaint and hard-bounce entries show a warning: re-mailing them damages sender reputation.") +
      dm(["CommSuppression · channel, address, reason, contact_id, source_message_id, campaign_id, expires_at, blocks_transactional, notes, created_by_membership_id, removed_at, removed_by_membership_id", "CommMessage (source) · Campaign · CrmContact"], []) + "</div>";
  }

  /* =====================================================================================================================
     ANALYTICS & REPORTS (spec "Analytics & Reporting")
     @screen Analytics
     @route  /campaigns/analytics?from=&to=&channel=&kind=&campaign=
     @perm   VIEW communications.analytics.read · export communications.campaigns.export*
     @api    GET /communications/analytics/summary?from=&to=&channel=&kind= · /analytics/timeseries · /analytics/campaigns · /analytics/export (CSV)
     @mcp    communications_analytics_read
     @data   CommDailyStat (date, channel, kind, campaign_id, sent_count, delivered_count, opened_count, unique_opened_count, clicked_count, unique_clicked_count, replied_count, bounced_count, failed_count, complained_count, unsubscribed_count, cost) · Campaign · CommTrackedLink
     @ui     shadcn Card, Tabs, Table, ToggleGroup, Recharts (tokens), Select, DatePicker range
     @states loading · empty period · error · no-access · partial data (rollup runs hourly: "Updated 12 min ago")
     @audit  report exported
     @note   Metrics: emails sent, SMS sent, open rate, click-through rate, reply rate, bounce rate, delivery rate, campaign performance. All are computed from CommDailyStat sums; open and click use UNIQUE counts. Replies come from 13.
     ===================================================================================================================== */
  function analytics() {
    const w = [58, 61, 55, 64, 70, 66, 72, 69];
    return '<div class="a-page">' + head("Analytics", "Communication performance across email and SMS.", sel("Last 30 days", "calendar") + sel("All channels", "layers") + btn("Export CSV", "file", "primary")) +
      '<div class="mini-stats">' + stat("Emails sent", "18,420", "+12%") + stat("SMS sent", "1,284", "+4%") + stat("Delivery rate", "98.6%", "") + stat("Open rate", "42.7%", "estimate") + stat("Click-through", "11.3%", "") + stat("Reply rate", "0.4%", "") + stat("Bounce rate", "1.1%", "", 1) + "</div>" +
      '<div class="g2">' + cd("<b>Open rate by week</b>", '<div class="cp-spark tall">' + w.map((v) => '<span style="height:' + v + 'px" title="' + v + '%"></span>').join("") + '</div><div class="sub-note">Weeks 38 to 45</div>') + cd("<b>By channel and kind</b>", tbl(["Kind", "Channel", ">Sent", ">Delivered", ">Cost"], [["Campaign", ch("EMAIL"), "9,210", "98.7%", "—"], ["Transactional", ch("EMAIL"), "4,860", "99.4%", "—"], ["Customer", ch("EMAIL"), "1,980", "99.1%", "—"], ["Notification", ch("EMAIL"), "2,370", "98.9%", "—"], ["Transactional", ch("SMS"), "1,284", "98.1%", "21.40 EUR"]]), 1) + "</div>" + gap() +
      cd("<b>Campaign performance</b><span class='r muted'>CommDailyStat grouped by campaign_id</span>", tbl(["Campaign", "Status", ">Delivered", ">Open", ">Click", ">Reply", ">Bounce", ">Unsub."], C.filter((x) => x[7] > 0).map((x) => [ink(x[1]), S(x[3]), x[7].toLocaleString(), x[2] === "SMS" ? "—" : pct(x[8], x[7]), x[2] === "SMS" ? "—" : pct(x[9], x[7]), pct(x[10], x[7]), pct(x[11], x[6]), pct(x[14], x[7])])), 1) +
      dm(["CommDailyStat · all count columns, cost · Campaign · CommTrackedLink"], ["Send-time optimization and per-client breakdown are derived, not stored (gaps-11.md #8)"]) + "</div>";
  }

  /* =====================================================================================================================
     SENDERS & DOMAINS (spec "Email Management", "SMS Management")
     @screen Sender identities and domains
     @route  /campaigns/senders?tab=domains|identities|signatures|sms
     @perm   VIEW + manage communications.sender_identities.manage* · personal signatures: communications.messages.create (own only) · organization signatures: communications.settings.manage*
     @api    GET/POST/PATCH /communications/sender-domains · POST /communications/sender-domains/:id/verify · GET/POST /communications/sender-identities · POST /communications/sender-identities/:id/{verify|default} · GET/POST /communications/signatures
     @mcp    communications_sender_identities_manage (human confirmation)
     @data   CommSenderDomain (domain, status, provider_account_id, provider_domain_id, dns_records, spf_verified_at, dkim_verified_at, dmarc_verified_at, verified_at, last_checked_at, failure_reason, tracking_domain) · CommSenderIdentity (channel, address, display_name, reply_to_address, status, is_default,
             branch_id, sender_domain_id, provider_account_id, membership_id, verified_at, failure_reason) · CommSignature (name, body_html, body_text, is_default, membership_id)
     @ui     shadcn Tabs, Table, Card with DNS record table and copy buttons, Badge, Dialog (add domain, add identity), AlertDialog (remove)
     @states loading · no provider connected (Alert "Connect Resend in Admin > Integrations", add buttons disabled) · verification pending (auto-recheck) · DNS failed with the reason · no-access
     @audit  domain added, verified, failed, removed; identity added, verified, made default, disabled; signature changed
     @note   Differs from organization_domains (01 §70) which are login domains. Verification happens at the provider (Resend domain API); we store records and statuses. Sending from an unverified identity is blocked. One default identity per channel (and per branch when scoped).
             SMS senders are Twilio numbers or alphanumeric ids (CommSenderIdentity channel SMS, address = the number).
     ===================================================================================================================== */
  function senders() {
    const dns = tbl(["Type", "Host", "Value", "Status"], [["TXT (SPF)", "acme-agency.com", "v=spf1 include:amazonses.com ~all", S("VERIFIED")], ["CNAME (DKIM)", "resend._domainkey", "resend._domainkey.resend.com", S("VERIFIED")], ["TXT (DMARC)", "_dmarc", "v=DMARC1; p=none;", S("VERIFIED")], ["CNAME (return-path)", "send", "feedback-smtp.eu-west-1.amazonses.com", S("VERIFIED")]]);
    return '<div class="a-page">' + head("Senders & domains", "Verified domains, from-addresses, SMS numbers and signatures.", btn("Add domain", "globe") + btn("Add identity", "plus", "primary")) +
      '<div class="tabset">' + tabs([["d", "Domains", 2], ["i", "Identities", 4], ["g", "Signatures", 3], ["s", "SMS senders", 1]], "d") +
      pane("d", 1, tbl(["Domain", "Provider", "Status", "SPF", "DKIM", "DMARC", "Tracking domain", "Checked", ""], [[ink("acme-agency.com"), "Resend", S("VERIFIED"), "Yes", "Yes", "Yes", "track.acme-agency.com", "10 min ago", more], [ink("brand.acme.io"), "Resend", S("PENDING"), "Yes", "No", "No", "—", "2 min ago", btn("Re-check", "zap", "sm")]]) + gap() + cd("<b>DNS records · brand.acme.io</b><span class='r muted'>CommSenderDomain.dns_records</span>", dns + '<div class="sub-note" style="margin-top:8px">DKIM not found yet. DNS changes can take up to 48 h. We re-check automatically every 10 minutes.</div>', 1)) +
      pane("i", 0, tbl(["Address", "Name", "Domain", "Status", "Default", "Branch", "Reply-to", ""], [[ink("hello@acme-agency.com"), "Acme Agency", "acme-agency.com", S("VERIFIED"), sw(1), "All", "support@acme-agency.com", more], [ink("billing@acme-agency.com"), "Acme Billing", "acme-agency.com", S("VERIFIED"), sw(0), "All", "billing@acme-agency.com", more], [ink("berlin@acme-agency.com"), "Acme Berlin", "acme-agency.com", S("VERIFIED"), sw(0), "Berlin", "—", more], [ink("news@brand.acme.io"), "Acme News", "brand.acme.io", S("PENDING_VERIFICATION"), sw(0), "All", "—", more]]) + '<div class="sub-note" style="margin-top:8px">Personal identities (membership_id) let a member send as themselves; they require the member to confirm the address.</div>') +
      pane("g", 0, tbl(["Signature", "Owner", "Default", "Updated", ""], [[ink("Acme Agency standard"), "Organization", sw(1), "Oct 2", more], [ink("Anna Meyer"), wh("AM"), sw(1), "Nov 1", more], [ink("Marco Silva"), wh("MS"), sw(0), "Sep 9", more]])) +
      pane("s", 0, tbl(["Sender", "Type", "Provider", "Status", "Default", ""], [[ink("+49 30 5550 1100"), "Twilio number", "Twilio", S("VERIFIED"), sw(1), more]]) + '<div class="sub-note" style="margin-top:8px">Alphanumeric sender ids (for example ACMEAGENCY) are stored the same way with address = the id and need country approval at Twilio.</div>') + "</div>" +
      dm(["CommSenderDomain · CommSenderIdentity · CommSignature · CommProviderAccount (provider_account_id)"], ["Purchasing or porting Twilio numbers is done in Twilio: no model here"]) + "</div>";
  }

  /* =====================================================================================================================
     SETTINGS (providers, defaults, compliance)
     @screen Communication settings
     @route  /campaigns/settings?tab=providers|defaults|compliance|retention
     @perm   communications.settings.manage* (sensitive). Provider keys themselves are managed in Admin > Integrations (the integrations permission of 01), never here.
     @api    GET/POST/PATCH /communications/provider-accounts · POST /communications/provider-accounts/:id/test · GET/PATCH /communications/settings
     @mcp    communications_settings_manage (human confirmation)
     @data   CommProviderAccount (channel, provider, name, status, is_default, integration_connection_id, settings, last_error, last_used_at) · IntegrationConnection (01, read: provider, status; never the key) · CommSenderIdentity (defaults) · Branding (01 §15)
     @ui     shadcn Card, Tabs, Switch, Select, Alert, AlertDialog (disable provider)
     @states loading · no connection ("Connect Resend in Admin > Integrations", link) · provider ERROR with last_error and Test button · saving · no-access
     @audit  provider account created, default changed, disabled, test sent; defaults changed
     @note   BYOK: only RESEND (email) and TWILIO (SMS) are active; SENDGRID, POSTMARK, MAILGUN, AWS_SES, SMTP, VONAGE, MESSAGEBIRD and CUSTOM are reserved enum values without adapter. One default account per channel. A CommProviderAccount with no
             ACTIVE IntegrationConnection is shown as ERROR and sends are refused; there is NO fallback to a platform key (01 §160). Webhook URL and signing secret are shown once per connection for Resend and Twilio delivery events.
     @gap    Approval policy, quiet hours, frequency caps and footer address are not columns: they would live in CommProviderAccount.settings Json or an org settings table (gaps-11.md #11).
     ===================================================================================================================== */
  function settings() {
    const prov = tbl(["Account", "Channel", "Provider", "Connection (Integrations)", "Status", "Default", "Last used", ""], [[ink("Resend production"), ch("EMAIL"), "Resend", "Resend · key •••• 8f2a", S("ACTIVE"), sw(1), "Today 11:02", more], [ink("Twilio SMS"), ch("SMS"), "Twilio", "Twilio · SID AC•••• 41b", S("ERROR"), sw(1), "Nov 8", more]]);
    return '<div class="a-page">' + head("Communication settings", "Providers, defaults and compliance for email and SMS.", btn("Open Integrations", "plug") + btn("Save changes", "check", "primary")) +
      '<div class="tabset">' + tabs([["p", "Providers"], ["d", "Defaults"], ["c", "Compliance"], ["r", "Retention"]], "p") +
      pane("p", 1, callout("plug", "Keys are entered per organization in <b>Admin &gt; Integrations</b> (Resend for email, Twilio for SMS). This module only points at the connection. There is no fallback key.") + gap(10) + prov + gap() +
        callout("flag", "<b>Twilio SMS: last error</b> “Authentication failed (401): the Auth Token was rotated”. SMS sends are refused until the connection is fixed. <a>Reconnect Twilio in Admin &gt; Integrations</a>.", "bad") + gap() +
        cd("<b>No connection yet</b><span class='r muted'>empty state</span>", '<div style="text-align:center;padding:14px">' + I("plug", 22) + "<p><b>Connect Resend in Admin &gt; Integrations</b></p><p class=\"muted\">Email cannot be sent, scheduled or tested until an ACTIVE Resend connection exists.</p>" + btn("Go to Integrations", "plug", "primary") + "</div>") + gap() +
        cd("<b>Reserved providers</b>", '<div class="rowx" style="flex-wrap:wrap;gap:6px">' + ["SENDGRID", "POSTMARK", "MAILGUN", "AWS_SES", "SMTP", "VONAGE", "MESSAGEBIRD", "CUSTOM"].map((p) => E(p)).join("") + '</div><div class="sub-note">Enum values reserved. Not selectable until an adapter and an Integration provider value exist.</div>')) +
      pane("d", 0, '<div class="g2" style="align-items:start">' + cd("<b>Sending defaults</b>", f("Default email sender", sel("hello@acme-agency.com", "mail")) + f("Default SMS sender", sel("+49 30 5550 1100", "sms")) + f("Default language", sel("English")) + f("Default time zone", sel("Europe/Berlin", "globe")) + row("Track opens and clicks by default", "", sw(1)) + row("Use branded layout by default", "Organization branding (01 §15)", sw(1))) + cd("<b>Approval and limits</b>", row("Require approval for campaigns over 500 recipients", "Gap: policy storage (gaps-11.md #11)", sw(1)) + f("Quiet hours (SMS)", box("21:00 to 08:00 recipient time")) + f("Max messages per contact per week", box("3 marketing messages"))) + "</div>") +
      pane("c", 0, '<div class="g2" style="align-items:start">' + cd("<b>Email footer</b>", f("Postal address (CAN-SPAM, GDPR)", box("Acme Agency, Hauptstrasse 1, 10115 Berlin")) + row("One-click unsubscribe header (List-Unsubscribe)", "Required by Gmail and Yahoo for bulk senders", sw(1)) + row("Double opt-in for new subscribers", "CommConsent PENDING_DOUBLE_OPT_IN", sw(0))) + cd("<b>SMS compliance</b>", row("Append opt-out line", "“Reply STOP to opt out”", sw(1)) + row("Handle STOP and START keywords", "Twilio webhook updates CommConsent and CommSuppression", sw(1))) + "</div>") +
      pane("r", 0, cd("<b>Retention</b>", f("Keep message bodies", sel("24 months")) + f("Keep delivery event IP and user agent", sel("90 days")) + '<div class="sub-note">Personal data in CommDeliveryEvent (ip_address, user_agent) is purged by the retention job.</div>')) + "</div>" +
      dm(["CommProviderAccount · channel, provider, name, status, is_default, integration_connection_id, settings, last_error, last_used_at", "IntegrationConnection (01) · CommSenderIdentity (defaults) · Branding (01)"], ["Approval policy, quiet hours, frequency cap, footer address, retention periods (gaps-11.md #11)"]) + "</div>";
  }

  const MAP = { overview, list, create, detail, segments, segment, "segment-new": segmentNew, lists, templates, template, automations, messages, message, threads, consent, suppressions, analytics, senders, settings };
  const CRUMB = { detail: "November product update", segment: "Active customers (EU)", "segment-new": "New segment", template: "Product update", message: "m-9101", create: "New campaign" };
  window.VIEWS.campaigns = { html: function (s) { return (MAP[s || "overview"] || MAP.overview)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
