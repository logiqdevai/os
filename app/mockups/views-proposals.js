/* =====================================================================================================================
   PROPOSALS APP — module 03 (docs/features/03-proposal-quotation-generator.md)
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: Proposal, ProposalVersion, ProposalSection, ProposalLineItem, ProposalPaymentScheduleItem, ProposalApproval, ProposalComment, ProposalDelivery, ProposalEvent,
   ProposalAcceptance, ProposalTemplate, NumberSequence. Enums are real values (ProposalStatus, ProposalVersionStatus, ProposalApprovalDecision, ProposalCustomerDecision, ProposalDeliveryChannel/Status,
   ProposalEventType, ProposalSectionType, ProposalPaymentTrigger). Permission keys: proposals.proposals.* (read, create, update, delete, archive, export, approve, send, convert, cancel),
   proposals.templates.manage, proposals.comments.internal.read, proposals.analytics.read, proposals.ai.generate (api/prisma/seed/permission-catalog.ts).
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - EXACT VERSION BINDING: a proposal sent to a customer stays bound to the exact ProposalVersion that was sent (sent_version_id). Sent versions are LOCKED (locked_at, content_hash): editing creates a new
       version. A customer decision (ProposalAcceptance) always records the version it applies to. Never edit a sent version in place.
     - Money is DERIVED: line items -> version totals -> proposal totals (net/discount/tax/gross, recurring monthly/annual). The client never sends totals; the API recomputes on every change.
       Catalog prices, tax rates and currencies come from the Finance catalog (Product, 08). Prices are snapshotted on the line item.
     - Internal comments and internal sections never reach the customer (is_internal): enforce on the server, not in the template.
     - AI output is always a DRAFT: editable, marked is_ai_generated, never sent without human review (spec §"AI Proposal Generation"). AI needs proposals.ai.generate AND an active AI connection
       (Admin > Integrations, 01 §156): without one the AI buttons explain how to connect OpenAI instead of failing.
     - Delivery goes through Communication Center (11), the customer portal (07) or a public link; files live in Documents (17); acceptance may create the contract (04), project (05) and invoice (08) through
       the owning modules: this module links to them, it never duplicates them.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, S, head, btn, cd, sw, cb, sel, fld, stat, search, who, tok, kv, muted, more, callout, keyc, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const eur = (n) => "€" + Math.round(n).toLocaleString("en-US");
  const tile = (t, tone) => '<span class="pv ' + (tone || "") + '">' + t + "</span>";
  const PC = { DRAFT: "", IN_REVIEW: "yellow", PENDING_APPROVAL: "yellow", APPROVED: "blue", SENT: "blue", VIEWED: "purple", CHANGES_REQUESTED: "yellow", ACCEPTED: "green", REJECTED: "red", EXPIRED: "", CANCELLED: "" };
  /* @impl pStatus(): ProposalStatus -> Badge. ONE map for list, editor header and customer view so a status always looks the same. */
  const pStatus = (v) => ES(v, PC[v] || "");

  /* =====================================================================================================================
     PROPOSALS LIST (spec "Proposal Status", "Proposal Tracking")
     @route  /proposals?status=&company=&owner=&expiring=&q=   (the panel "Views" are saved filters / SavedView rows)
     @perm   VIEW proposals.proposals.read · create proposals.proposals.create · edit proposals.proposals.update · send proposals.proposals.send · approve proposals.proposals.approve* · cancel proposals.proposals.cancel ·
             convert proposals.proposals.convert* · archive/delete proposals.proposals.archive / delete* · export proposals.proposals.export* · values need finance-level visibility for the viewer's role
     @api    GET /proposals?status=&company_id=&owner=&cursor=&sort= · POST /proposals {deal_id?|project_id?|template_id?} · POST /proposals/:id/duplicate · POST /proposals/:id/cancel
     @mcp    proposals_proposals_read, proposals_proposals_create, proposals_proposals_send (needs human confirmation when an AI agent calls it)
     @data   Proposal (number, title, status, company_id, contact_id, deal_id, owner_membership_id, valid_until, net_total, gross_total, recurring_monthly, current_version_id, sent_version_id, accepted_version_id,
             sent_at, first_viewed_at, last_viewed_at, view_count, accepted_at) · ProposalVersion (version_number, status) · CrmCompany (02) · CrmDeal (02)
     @ui     Table (server-side), ToggleGroup (status), Badge, Avatar, DropdownMenu (row actions), Popover+Command filters
     @states loading · empty ("Create your first proposal from a deal") · error · no-access
     @audit  proposal created / duplicated / cancelled / archived (status changes are ALSO ProposalEvent rows)
     @note   Number comes from NumberSequence (entity_type "proposal", prefix, year, padding) allocated by the API in a transaction: never generated in the client. Status is derived from lifecycle events: SENT -> VIEWED is set
             when the first ProposalEvent VIEWED arrives; EXPIRED is set by a job when valid_until passes without a decision. "Awaiting approval" = PENDING_APPROVAL.
     ===================================================================================================================== */
  function list() {
    /* number, title, company, status, gross, net, valid until, views text, owner, version */
    const R = [
      ["PR-2041", "Acme Rebrand phase 2", "Acme Corp", "VIEWED", 62496, "Dec 15", "3 views · 2h ago", ["AM", ""], "v2 sent"],
      ["PR-2043", "Mobile app v3", "Globex", "PENDING_APPROVAL", 109120, "—", "—", ["AM", ""], "v1"],
      ["PR-2040", "Brand strategy sprint", "Umbrella Ltd", "SENT", 19592, "Dec 05", "not viewed", ["SJ", "y"], "v1 sent"],
      ["PR-2038", "Data warehouse setup", "Hooli", "CHANGES_REQUESTED", 64480, "Dec 20", "5 views · 1d ago", ["NG", "g"], "v2 sent"],
      ["PR-2036", "Maintenance plan", "Acme Corp", "ACCEPTED", 71424, "—", "accepted Nov 2", ["KL", "p"], "v1 accepted"],
      ["PR-2035", "CMS migration", "Initech", "DRAFT", 28900, "—", "—", ["MS", "g"], "v1 draft"],
      ["PR-2031", "E-commerce rebuild", "Wonka", "EXPIRED", 79600, "Oct 31", "2 views", ["AM", ""], "v1 sent"],
      ["PR-2029", "Support retainer", "Soylent", "REJECTED", 14880, "—", "rejected Oct 20", ["SJ", "y"], "v1 sent"],
    ];
    return '<div class="a-page">' + head("Proposals", "Quotes and proposals from first draft to accepted work (§ lifecycle). Every sent proposal stays bound to the exact version that was sent.", btn("Import", "box") + btn("New proposal", "plus", "primary")) +
      /* @impl KPI strip: counts and sums from GET /proposals/summary (scoped). Click = apply the filter. */
      '<div class="mini-stats">' + stat("Open value", eur(255688), "6 proposals out") + stat("Accepted (90d)", eur(171424), "3 proposals") + stat("Conversion", "41%", "accepted / sent") + stat("Avg time to accept", "9 days", "-2 days") + stat("Awaiting approval", "1", "PENDING_APPROVAL") + "</div>" +
      '<div class="toolbar">' + search("Search number, title, customer…") + '<div class="seg"><button class="on">All</button><button>Draft</button><button>Out</button><button>Accepted</button><button>Lost</button></div><button class="btn">Company</button><button class="btn">Owner</button><button class="btn">Valid until</button></div>' +
      '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th>Proposal</th><th>Customer</th><th>Status</th><th>Version</th><th class="num">Total (gross)</th><th>Valid until</th><th>Tracking</th><th>Owner</th><th></th></tr></thead><tbody>' +
      R.map((r) => '<tr class="clk" onclick="location.hash=\'#proposals/editor\'"><td><div class="name"><b class="ink mono" style="font-weight:500">' + r[0] + "</b> " + r[1] + "</div></td><td>" + r[2] + "</td><td>" + pStatus(r[3]) + '</td><td class="muted">' + r[8] + '</td><td class="num money">' + eur(r[4]) + '</td><td class="' + (r[3] === "EXPIRED" ? "muted" : "") + '">' + r[5] + '</td><td class="muted">' + r[6] + "</td><td>" + AV(r[7][0], r[7][1]) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div></div>" +
      dm(["Proposal · number, title, status, company_id, deal_id, owner_membership_id, valid_until, gross_total, recurring_monthly, current_version_id, sent_version_id, accepted_version_id, sent_at, first_viewed_at, last_viewed_at, view_count, accepted_at", "ProposalVersion · version_number, status · NumberSequence · CrmCompany, CrmDeal"], []) + "</div>";
  }

  /* =====================================================================================================================
     PROPOSAL EDITOR (spec "Proposal Creation", "AI Proposal Generation", "Pricing & Quotation Builder", "Proposal Versions", "Proposal Review")
     @route  /proposals/:proposalId?tab=content|pricing|payments|review|versions|activity   (the active VERSION is part of the state: ?version=)
     @perm   VIEW proposals.proposals.read · edit DRAFT versions proposals.proposals.update · AI proposals.ai.generate · request approval proposals.proposals.update · approve proposals.proposals.approve* ·
             send proposals.proposals.send · internal comments/sections proposals.comments.internal.read · create contract/project from acceptance: proposals.proposals.convert* (+ the target module's create key)
     @api    GET /proposals/:id?version= (version, sections, line items, payment schedule, approvals, comments) · PUT /proposals/:id/versions/:vid/sections · PUT .../line-items · PUT .../payment-schedule ·
             POST /proposals/:id/versions (new revision from a version) · POST .../submit-for-review · POST .../approvals/:approvalId/decision · POST /proposals/:id/send {channels, recipients, message} ·
             POST /proposals/:id/ai/generate|improve|review (async, returns a draft) · GET /proposals/:id/pdf
     @mcp    proposals_proposals_read, proposals_proposals_update, proposals_proposals_send*, proposals_ai_generate
     @data   Proposal · ProposalVersion (version_number, status, change_summary, template_version, variables JSON, payment_terms, validity_days, milestones JSON, timeline JSON, totals, pdf_document_id, content_hash,
             is_ai_generated, ai_metadata, locked_at, sent_at) · ProposalSection (type ProposalSectionType, title, body, sort_order, is_ai_generated, is_internal) · ProposalLineItem (group_name, name, quantity, unit,
             unit_price, discount_percent|amount, tax_percent, net_amount, tax_amount, gross_amount, is_recurring, billing_frequency, is_optional, selected_by_customer, product_id) · ProposalPaymentScheduleItem (name,
             trigger ProposalPaymentTrigger, percentage|amount, due_date, milestone_name, frequency) · ProposalApproval (step, approver_membership_id, decision, comment) · ProposalComment (is_internal, section_id, resolved_at) ·
             ProposalDelivery · ProposalEvent
     @ui     Tabs, outline list with dnd-kit (section order), Tiptap rich-text editor per section, editable Table (line items), Switch (optional/recurring), Popover (AI actions), Sheet (version compare), Dialog (send),
             Timeline, Stepper (approval chain)
     @states loading · conflict 409 (version changed under you: reload prompt) · locked (sent version is READ-ONLY: banner with "Create revision") · saving (autosave with status) · error · no-access
     @audit  proposal version created / submitted for review / approved / rejected / sent / cancelled (written as ProposalEvent AND to the audit log)
     @note   VERSION RULES: DRAFT versions are editable. Submitting for review moves the version to IN_REVIEW; approval steps (ProposalApproval, ordered by `step`) all need APPROVED to reach APPROVED; sending locks the
             version (SENT, locked_at, content_hash, pdf generated and stored in Documents 17) and any further change needs a NEW version (the previous becomes SUPERSEDED once the new one is sent). "Restore" = copy an older
             version into a new draft, never rewrite history. Totals are recomputed server-side; optional items are excluded from the base total until the customer selects them.
             Payment schedule must add up to 100% (or the gross total): the API validates, the UI shows the remaining amount live. AI review findings are suggestions stored in ai_metadata, each pointing at a section.
             Approval RULES (ProposalApprovalRule, e.g. discount > 10% needs Finance) decide which ProposalApproval steps are requested when a version is submitted for review, and every step records its rule_id. Managers can still request an approval manually.
     ===================================================================================================================== */
  function editor() {
    const SEC = [["COVER", "Cover", 0], ["EXECUTIVE_SUMMARY", "Executive summary", 1], ["REQUIREMENTS", "Requirements", 0], ["SOLUTION", "Proposed solution", 0], ["SCOPE", "Scope of work", 0], ["DELIVERABLES", "Deliverables", 0], ["TIMELINE", "Timeline", 0], ["PRICING", "Pricing", 0], ["PAYMENT_SCHEDULE", "Payment schedule", 0], ["ASSUMPTIONS", "Assumptions", 0], ["EXCLUSIONS", "Exclusions", 0], ["TERMS", "Terms & conditions", 0], ["SIGNATURE", "Acceptance", 0]];
    /* group, name, qty, unit, unit price, discount %, VAT %, optional, recurring */
    const LI = [["Design", "Brand identity refresh", 1, "project", 18000, 0, 24, 0, 0], ["Design", "Marketing website redesign", 1, "project", 24000, 5, 24, 0, 0], ["Enablement", "CMS training workshop", 2, "day", 1200, 0, 24, 1, 0], ["Care", "Maintenance plan", 12, "month", 600, 0, 24, 0, 1]];
    const net = LI.map((l) => l[2] * l[4] * (1 - l[5] / 100));
    const nets = net.reduce((a, b) => a + b, 0), gross = LI.reduce((a, l, i) => a + net[i] * (1 + l[6] / 100), 0);
    return '<div class="a-page">' +
      /* @impl Header: number + title, ProposalStatus badge, version selector (Select of ProposalVersion rows: "v2 · sent" / "v3 · draft"), valid_until. Actions depend on state: DRAFT -> Request review / Preview;
           APPROVED -> Send; SENT/VIEWED -> Create revision; ACCEPTED -> Convert to contract/project. A SENT version shows the read-only banner. */
      '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + tile("PR", "purple") + '<div class="nm"><h2><span class="mono">PR-2041</span> Acme Rebrand phase 2 ' + pStatus("VIEWED") + '</h2><div class="muted">Acme Corp · Lena Kovac · deal “Acme Rebrand phase 2” · owner Anna Meyer · valid until Dec 15 · ' + sel("v3 · draft", "layers").replace('class="sel"', 'class="sel" style="display:inline-flex;width:130px;height:26px;vertical-align:middle"') + "</div></div>" + btn("Preview", "globe") + btn("Request review", "users") + btn("Send", "send", "primary") + "</div></div>" +
      '<div class="callout warn" style="margin-bottom:14px">' + I("lock", 16) + "<div><b>v2 is sent and locked.</b> You are editing <b>v3 (draft)</b>, created from v2 after the customer viewed it. Sending v3 supersedes v2.</div></div>" +
      '<div class="tabset">' + tabs([["c", "Content"], ["p", "Pricing"], ["s", "Payment schedule"], ["r", "Review", 2], ["v", "Versions", 3], ["a", "Activity"]], "c") +
      pane("c", 1, '<div class="crm-split" style="grid-template-columns:220px minmax(0,1fr) 300px"><div class="cd"><div class="cd-h"><b>Sections</b><span class="r">' + btn("Add", "plus", "sm") + '</span></div><div class="cd-b flush">' +
        /* @impl Section outline: ProposalSection rows ordered by sort_order (drag to reorder), type = ProposalSectionType chip, lock icon = is_internal (visible to staff only), sparkle = is_ai_generated. */
        SEC.map((s, i) => '<div class="rowx" style="padding:8px 12px;' + (i === 1 ? "background:var(--elevated)" : "") + '"><span class="muted">' + I("menu", 13) + '</span><div class="grow"><b style="font-size:13px">' + s[1] + "</b></div>" + (s[2] ? '<span class="muted" title="AI generated">' + I("sparkles", 13) + "</span>" : "") + "</div>").join("") + "</div></div>" +
        /* @impl Section editor: Tiptap with the template's dynamic variables ({{customer.name}}, {{project.name}} ...) shown as chips and resolved on render (ProposalVersion.variables). AI-generated text carries a
             visible "AI draft" marker until a human edits/accepts it (is_ai_generated). Autosave every few seconds; show "Saved" / "Saving…". */
        '<div class="cd"><div class="cd-h"><b>Executive summary</b><span class="badge purple">' + I("sparkles", 11) + ' AI draft</span><span class="r muted">autosaved</span></div><div class="cd-b"><div class="ink" style="line-height:1.7"><p>Acme Corp wants a modern brand and website that reflects its move upmarket in 2027. This proposal covers a full brand identity refresh, a redesigned marketing website on a headless CMS, and a 12-month care plan.</p><p style="margin-top:10px">We will deliver in three phases over 10 weeks, with Acme approving each milestone before the next begins. {{<span class="key">project.manager</span>}} will lead delivery.</p></div><div class="toolbar" style="margin:14px 0 0">' + btn("Improve wording", "sparkles", "sm") + btn("Simplify", "sparkles", "sm") + btn("Translate", "globe", "sm") + "</div></div></div>" +
        /* @impl AI assistant panel (proposals.proposals + proposals.ai.generate). Actions call POST .../ai/* and return DRAFTS. "Review proposal" returns findings (missing scope, inconsistent pricing, unclear text, missing terms, conflicting
             timelines): each finding links to its section and is labelled "AI recommendation". Findings persist in ProposalVersion.ai_metadata. No AI connection -> empty state with a link to Admin > Integrations. */
        '<div class="stack"><div class="cd"><div class="cd-h"><b>AI assistant</b><span class="r muted">OpenAI · proposals.ai.generate</span></div><div class="cd-b">' + btn("Generate from deal and project", "sparkles", "primary").replace('class="btn primary"', 'class="btn primary" style="width:100%"') + '<div style="height:8px"></div><button class="btn" style="width:100%">' + I("check", 14) + ' Review before sending</button></div></div>' +
        cd("<b>Findings</b><span class='r'><span class='badge yellow'>3</span></span>", '<div class="rowx" style="align-items:flex-start"><span class="muted">' + I("zap", 14) + '</span><div class="grow"><b>Timeline conflicts with milestone dates</b><small>Timeline · AI recommendation</small></div></div><div class="rowx" style="align-items:flex-start"><span class="muted">' + I("zap", 14) + '</span><div class="grow"><b>No warranty period stated</b><small>Terms · AI recommendation</small></div></div><div class="rowx" style="align-items:flex-start"><span class="muted">' + I("zap", 14) + '</span><div class="grow"><b>Training day rate differs from catalog</b><small>Pricing · AI recommendation</small></div></div>', 1) + "</div></div>") +
      /* @impl PRICING BUILDER: editable table of ProposalLineItem. Add from the Finance catalog (Command over Product, 08: fills name, unit, price, VAT) or a custom line. `optional` = the customer may deselect it
           (shown with a checkbox in the customer view and excluded from the base total until selected). `recurring` + billing frequency feed recurring_monthly / recurring_annual. Discount per line (% or amount). Totals are DISPLAYED
           from the API response. Group rows by group_name. */
      pane("p", 0, cd("<b>Pricing</b><span class='r'>" + btn("From catalog", "box", "sm") + btn("Custom line", "plus", "sm") + "</span>", '<table><thead><tr><th>Item</th><th class="num">Qty</th><th>Unit</th><th class="num">Unit price</th><th class="num">Disc.</th><th class="num">VAT</th><th>Optional</th><th>Recurring</th><th class="num">Net</th><th></th></tr></thead><tbody>' +
        LI.map((l, i) => "<tr><td><b class='ink' style='font-weight:500'>" + l[1] + "</b><div class='sub-note'>" + l[0] + '</div></td><td class="num">' + l[2] + "</td><td>" + l[3] + '</td><td class="num money">' + eur(l[4]) + '</td><td class="num">' + (l[5] ? l[5] + "%" : "—") + '</td><td class="num">' + l[6] + "%</td><td>" + sw(l[7]) + "</td><td>" + sw(l[8]) + '</td><td class="num money ink">' + eur(net[i]) + "</td><td>" + more + "</td></tr>").join("") +
        '</tbody></table><div class="cd-b" style="display:flex;justify-content:flex-end"><div style="width:300px">' + kv("Net subtotal", eur(nets)) + kv("Discounts", "−" + eur(1200)) + kv("VAT", eur(gross - nets)) + kv("Total (gross)", "<b class='ink'>" + eur(gross) + "</b>") + kv("Recurring", eur(600) + " / month") + kv("Optional, not included", eur(2976)) + "</div></div>", 1)) +
      /* @impl PAYMENT SCHEDULE: ProposalPaymentScheduleItem rows (trigger ProposalPaymentTrigger: ON_ACCEPTANCE | ON_SIGNATURE | ON_DATE | ON_MILESTONE | ON_DELIVERY | RECURRING). Percentage OR fixed amount; the sum must equal
           100% of the base total. Becomes the invoice schedule in Finance (08) on conversion. */
      pane("s", 0, cd("<b>Payment schedule</b><span class='r'>" + btn("Add payment", "plus", "sm") + "</span>", '<table><thead><tr><th>Payment</th><th>Trigger</th><th class="num">Share</th><th class="num">Amount</th><th>When</th></tr></thead><tbody><tr><td class="ink">Deposit</td><td>' + E("ON_ACCEPTANCE") + '</td><td class="num">30%</td><td class="num money">' + eur(gross * 0.3) + '</td><td class="muted">on acceptance</td></tr><tr><td class="ink">Design approved</td><td>' + E("ON_MILESTONE") + '</td><td class="num">30%</td><td class="num money">' + eur(gross * 0.3) + '</td><td class="muted">milestone “Design approved”</td></tr><tr><td class="ink">Launch</td><td>' + E("ON_DELIVERY") + '</td><td class="num">40%</td><td class="num money">' + eur(gross * 0.4) + '</td><td class="muted">on delivery</td></tr><tr><td class="ink">Maintenance plan</td><td>' + E("RECURRING") + '</td><td class="num">—</td><td class="num money">' + eur(600) + '</td><td class="muted">monthly</td></tr></tbody></table><div class="cd-b"><span class="badge green">100% allocated</span></div>', 1)) +
      /* @impl REVIEW: approval chain = ProposalApproval rows ordered by step (decision PENDING | APPROVED | REJECTED | CHANGES_REQUESTED). Each approval is bound to ONE version: approving v2 does not approve v3.
           Internal comments (ProposalComment is_internal) need proposals.comments.internal.read and are never exposed to the customer; resolve/unresolve per comment. */
      pane("r", 0, '<div class="g2">' + cd("<b>Approvals · v3</b><span class='r'>" + btn("Request approval", "users", "sm") + "</span>", '<div class="rowx">' + who("EP", "", "Elena Papadaki", "Step 1 · Finance · rule “Discount over 5%”") + '<span style="margin-left:auto">' + E("APPROVED", "green") + '</span></div><div class="rowx">' + who("PR", "", "Petros Rodinos", "Step 2 · Executive · rule “Value over €50k”") + '<span style="margin-left:auto">' + E("PENDING", "blue") + "</span></div>", 1) +
        cd("<b>Internal comments</b><span class='r muted'>staff only</span>", '<div class="rowx"><div class="grow"><b>Discount on the redesign is at our 5% limit</b><small>Anna Meyer · Nov 10 · Pricing</small></div></div><div class="rowx"><div class="grow"><b>Check the warranty wording with Legal</b><small>Elena Papadaki · Nov 10 · Terms · ' + I("lock", 11) + " internal</small></div>" + btn("Resolve", "", "sm") + "</div>", 1) + "</div>") +
      /* @impl VERSIONS: ProposalVersion rows (version_number, status DRAFT | IN_REVIEW | APPROVED | SENT | SUPERSEDED, change_summary, created by, sent_at). Actions: Compare (Sheet with a section/price diff), Restore as new draft, Download PDF
           (pdf_document_id, Documents 17). A SENT version shows its content_hash. */
      pane("v", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Version</th><th>Status</th><th>Summary</th><th>By</th><th>Total</th><th></th></tr></thead><tbody><tr><td class="mono ink">v3</td><td>' + E("DRAFT", "yellow") + '</td><td class="muted">After customer feedback: add training, warranty</td><td>Anna Meyer</td><td class="money">' + eur(gross) + "</td><td>" + btn("Compare", "", "sm") + '</td></tr><tr><td class="mono ink">v2</td><td>' + E("SENT", "blue") + ' <span class="badge">sent version</span></td><td class="muted">Sent to Lena on Nov 8</td><td>Anna Meyer</td><td class="money">' + eur(60000) + '</td><td>' + btn("Compare", "", "sm") + btn("PDF", "file", "sm") + '</td></tr><tr><td class="mono ink">v1</td><td>' + E("SUPERSEDED") + '</td><td class="muted">First draft</td><td>Anna Meyer</td><td class="money">' + eur(54000) + "</td><td>" + btn("Restore", "", "sm") + "</td></tr></tbody></table></div>") +
      /* @impl ACTIVITY: ProposalEvent rows (type ProposalEventType: SENT, VIEWED, DOWNLOADED, OPTIONAL_ITEM_TOGGLED, COMMENTED, CHANGES_REQUESTED, ACCEPTED, SIGNED, ...) with actor (user or CONTACT), ip and user agent for customer events,
           plus ProposalDelivery rows (channel EMAIL | CUSTOMER_PORTAL | PDF | LINK, status QUEUED | SENT | DELIVERED | FAILED). Customer-event IP/UA are personal data: show only to staff with proposals.proposals.read. */
      pane("a", 0, cd("<b>Tracking</b><span class='r muted'>ProposalEvent · ProposalDelivery</span>", '<div class="tl"><div class="ev"><b class="key">VIEWED</b><small>Lena Kovac · 2h ago · 4 min on page</small></div><div class="ev"><b class="key">OPTIONAL_ITEM_TOGGLED</b><small>Lena Kovac · CMS training workshop · yesterday</small></div><div class="ev"><b class="key">COMMENTED</b><small>Lena Kovac on Timeline · yesterday</small></div><div class="ev"><b class="key">VIEWED</b><small>Marc Dupont · Nov 9</small></div><div class="ev"><b class="key">SENT</b><small>v2 · email + customer portal · Nov 8 · ' + S("DELIVERED") + "</small></div></div>")) + "</div>" +
      dm(["Proposal · status, totals, current_version_id, sent_version_id, valid_until", "ProposalVersion · version_number, status, variables, payment_terms, validity_days, totals, content_hash, is_ai_generated, ai_metadata, locked_at", "ProposalSection · type, title, body, sort_order, is_internal, is_ai_generated", "ProposalLineItem · group_name, name, quantity, unit, unit_price, discounts, tax_percent, net/tax/gross, is_optional, is_recurring, product_id", "ProposalPaymentScheduleItem · trigger, percentage, amount, milestone_name · ProposalApproval · rule_id · ProposalApprovalRule · ProposalComment · ProposalDelivery · ProposalEvent"], []) + "</div>";
  }

  /* =====================================================================================================================
     CUSTOMER PROPOSAL VIEW (spec "Customer Delivery", "Customer Approval")
     @route  Public: /p/:publicToken (token resolves to ONE proposal + the SENT version; no login) · Portal: /portal/proposals/:proposalId (customer-portal identity, 01 §79). Same component, two entry points.
     @perm   Public token: possession of the unguessable token = read access to the sent version only (Proposal.public_token_hash stores only a hash). Portal: portal.proposals.read; accept portal.proposals.accept*
     @api    GET /public/proposals/:token (sent version, branding; records a VIEWED event) · POST /public/proposals/:token/selection {optional_item_ids[]} · POST /public/proposals/:token/decision
             {decision: ACCEPTED|REJECTED|CHANGES_REQUESTED, signer_name, signer_email, signer_title, terms_accepted, feedback, selected_optional_item_ids[]} · GET /public/proposals/:token/pdf
     @mcp    none (customer-facing, not an agent tool)
     @data   Proposal (public_token_hash, valid_until, sent_version_id) · ProposalVersion (locked sent version) · ProposalSection (is_internal = false only) · ProposalLineItem (is_optional, selected_by_customer) ·
             ProposalAcceptance (decision, signer_*, terms_accepted, selected_optional_item_ids, feedback, signature_request_id, ip_address, user_agent) · ProposalEvent (VIEWED, DOWNLOADED, OPTIONAL_ITEM_TOGGLED)
     @ui     Standalone branded page (no app shell), Checkbox (optional items), Form (decision), Dialog (confirm), sticky summary card; responsive (customers open it on phones); print stylesheet
     @states loading · invalid/expired token (neutral page, no data) · expired proposal (read-only, "ask for a new one") · already decided (shows the decision) · error
     @audit  ProposalEvent rows for views, downloads, optional-item toggles and the decision; acceptance is immutable
     @note   NEVER show internal sections, internal comments, cost or margin data. The page renders the SENT version only; a newer draft is invisible. The total shown updates live from the selected optional items (computed by
             the API on selection, not in the client). Every ProposalAcceptance is bound to the version and keeps signer identity, IP, user agent, terms flag and timestamp: it is the legal record, never edit or delete it. If
             the proposal type requires a contract, acceptance leads to a signature step through the signature provider abstraction (04 §33); otherwise acceptance can convert to project and invoice (automation, 20).
             Rate-limit and bot-protect the public endpoints; do not index (noindex, no sitemap).
     ===================================================================================================================== */
  function customer() {
    return '<div style="background:var(--canvas);min-height:100%"><div class="a-page" style="max-width:1100px">' +
      '<div class="callout" style="margin-bottom:14px">' + I("globe", 16) + "<div><b>Customer-facing page.</b> This is what Lena sees at the public link or in the customer portal. No app navigation, staff-only content hidden. Shown here inside the shell for review only.</div></div>" +
      '<div class="cd"><div class="hdr-card">' + tile("LD", "") + '<div class="nm"><h2>Acme Rebrand phase 2</h2><div class="muted">Proposal PR-2041 · prepared for Lena Kovac, Acme Corp · valid until Dec 15, 2026</div></div>' + btn("Download PDF", "file") + "</div></div>" +
      '<div class="crm-split" style="margin-top:14px"><div class="stack">' +
      cd("<b>Executive summary</b>", '<div class="ink" style="line-height:1.7">Acme Corp wants a modern brand and website that reflects its move upmarket. We will deliver a full brand identity refresh, a redesigned website on a headless CMS, and a 12-month care plan, in three phases over 10 weeks.</div>') +
      cd("<b>Scope and deliverables</b>", '<div class="ink" style="line-height:1.7">Brand strategy workshop · logo and visual identity · design system · 25-page marketing website · CMS setup · analytics and SEO foundation · launch support.</div>') +
      /* @impl Pricing table: required items listed; OPTIONAL items have a checkbox the customer can toggle (ProposalLineItem.selected_by_customer). Toggling calls the selection endpoint and the total updates from the response. */
      cd("<b>Investment</b>", '<table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead><tbody><tr><td class="ink">Brand identity refresh</td><td class="num">1</td><td class="num money">' + eur(18000) + '</td></tr><tr><td class="ink">Marketing website redesign</td><td class="num">1</td><td class="num money">' + eur(22800) + '</td></tr><tr><td class="ink">Maintenance plan (12 months)</td><td class="num">12</td><td class="num money">' + eur(7200) + '</td></tr><tr style="background:var(--elevated)"><td class="ink">' + cb(1) + ' <b>Optional:</b> CMS training workshop</td><td class="num">2</td><td class="num money">' + eur(2400) + "</td></tr></tbody></table>", 1) +
      "</div><div class=\"stack\" style=\"position:sticky;top:12px\">" +
      /* @impl Decision card: Accept / Request changes / Reject. Accept needs signer name, email, optional title and the terms checkbox; it records ProposalAcceptance and, when the type requires a contract, continues to the signature step. */
      cd("<b>Your decision</b>", kv("Total (incl. VAT)", "<b class='ink'>" + eur(62496) + "</b>") + kv("Recurring", eur(600) + " / month") + '<div style="height:10px"></div>' + fld("Your name", '<div class="inp">Lena Kovac</div>') + fld("Email", '<div class="inp">lena@acme.example</div>') + '<div class="setting" style="padding:4px 0;border:0"><div class="grow"><small>I accept the terms and conditions of this proposal</small></div>' + cb(1) + '</div><button class="btn primary" style="width:100%;margin-top:8px">' + I("check", 14) + ' Accept proposal</button><div style="display:flex;gap:8px;margin-top:8px">' + btn("Request changes", "", "sm") + btn("Decline", "", "sm") + "</div>") +
      "</div></div></div>" +
      '<div class="a-page" style="padding-top:0">' + dm(["Proposal · public_token_hash, valid_until, sent_version_id", "ProposalVersion (sent, locked) · ProposalSection (is_internal = false) · ProposalLineItem (is_optional, selected_by_customer)", "ProposalAcceptance · decision, signer_name, signer_email, terms_accepted, selected_optional_item_ids, feedback, ip_address, user_agent", "ProposalEvent · VIEWED, DOWNLOADED, OPTIONAL_ITEM_TOGGLED"], []) + "</div></div>";
  }

  /* =====================================================================================================================
     TEMPLATES (spec "Reusable Templates", "Dynamic Proposal Content")
     @route  /proposals/templates · /proposals/templates/:templateId
     @perm   VIEW proposals.proposals.read · create/edit/archive proposals.templates.manage · approval rules proposals.approval_rules.manage*
     @api    GET /proposal-templates · POST /proposal-templates · PATCH /proposal-templates/:id (bumps `version`) · POST /proposal-templates/:id/duplicate|archive
     @mcp    proposals_templates_manage
     @data   ProposalTemplate (name, slug, description, work_type, language, branding JSON, layout JSON, sections JSON, defaults JSON, variables JSON, default_validity_days, is_default, version, archived_at)
     @ui     Table, Card, form (react-hook-form + zod), sortable section list, variable picker (Command), live preview (iframe of the rendered template with sample data)
     @states loading · empty · error · no-access
     @note   `sections` is an ordered JSON list of {type ProposalSectionType, title, body with {{variables}}, is_internal}; `variables` declares the allowed placeholders and their source (customer.*, project.*, proposal.*).
             A proposal records the template `version` it was created from (ProposalVersion.template_version): editing a template never changes existing proposals. Branding (logo, colors, typography) falls back to the
             organization branding (01 §15, Organization.branding) when empty. Exactly one default template per work type (service-enforced).
     ===================================================================================================================== */
  function templates() {
    const T = [["Website development", "Website", "en", 13, 30, "v4", 1], ["Web application", "Web app", "en", 14, 30, "v2", 0], ["Mobile application", "Mobile app", "en", 14, 30, "v1", 0], ["Maintenance & support", "Maintenance", "en", 9, 14, "v3", 0], ["Consulting", "Consulting", "en", 8, 14, "v1", 0], ["Website development (EL)", "Website", "el", 13, 30, "v1", 0]];
    return '<div class="a-page">' + head("Proposal templates", "Reusable structure, branding and dynamic content per type of work.", btn("New template", "plus", "primary")) +
      '<div class="crm-split"><div class="panel" style="margin-top:0"><table><thead><tr><th>Template</th><th>Work type</th><th>Language</th><th class="num">Sections</th><th class="num">Validity</th><th>Version</th><th></th></tr></thead><tbody>' + T.map((t, i) => '<tr class="clk" style="' + (i === 0 ? "background:var(--elevated)" : "") + '"><td><div class="name">' + I("layers", 15) + t[0] + (t[6] ? ' <span class="badge green">Default</span>' : "") + '</div></td><td class="muted">' + t[1] + '</td><td>' + t[2].toUpperCase() + '</td><td class="num">' + t[3] + '</td><td class="num">' + t[4] + ' days</td><td class="mono">' + t[5] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      /* @impl Template detail (side card here, page in production): ordered sections with types, and the declared variables. */
      cd("<b>Website development</b><span class='r muted'>version 4</span>", '<div class="muted" style="margin-bottom:6px">Sections</div>' + ["Cover", "Executive summary", "Requirements", "Proposed solution", "Scope of work", "Deliverables", "Timeline", "Pricing", "Payment schedule", "Assumptions", "Exclusions", "Terms", "Acceptance"].map((x) => '<div style="padding:3px 0;color:var(--body)">' + x + "</div>").join("") + '<div class="muted" style="margin:12px 0 6px">Variables</div><div style="display:flex;gap:6px;flex-wrap:wrap">' + ["customer.name", "company.name", "project.name", "proposal.number", "proposal.valid_until", "project.manager"].map((v) => '<span class="tok mono">{{' + v + "}}</span>").join("") + "</div>") + "</div>" +
      /* @impl APPROVAL RULES (shown with templates because both are setup): ProposalApprovalRule rows (name, conditions JSON, ordered steps JSON, priority, enabled). Evaluated in priority order when a version is submitted for review; every matching rule adds its steps.
           Conditions can use discount percent, gross total, margin, customer, template or work type. Needs proposals.approval_rules.manage* (sensitive: it decides who must approve what). */
      '<div style="height:14px"></div>' + cd("<b>Approval rules</b><span class='r'>" + btn("New rule", "plus", "sm") + "</span>", '<div class="rowx"><div class="grow"><b>Discount over 5%</b><small>discount_percent > 5 → Finance · priority 1</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Value over €50k</b><small>gross_total ≥ 50,000 → Executive · priority 2</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Custom payment schedule</b><small>payment terms edited → Finance · priority 3</small></div>' + sw(0) + "</div>", 1) +
      dm(["ProposalTemplate · name, slug, work_type, language, branding, layout, sections (JSON), variables (JSON), default_validity_days, is_default, version, archived_at", "ProposalApprovalRule · conditions, steps, priority, enabled"], []) + "</div>";
  }

  /* =====================================================================================================================
     ANALYTICS (spec "Proposal Analytics")
     @route  /proposals/analytics?from=&to=&owner=
     @perm   VIEW proposals.analytics.read (values need the viewer's financial visibility)
     @api    GET /proposals/analytics?from=&to=&group=service|customer|month
     @mcp    proposals_analytics_read
     @data   Proposal (status, gross_total, sent_at, accepted_at, rejected_at, expired_at, view_count, company_id, owner_membership_id) · ProposalLineItem (revenue by service via product_id/name) · ProposalEvent
     @ui     Card, Table, Recharts bars/lines, ToggleGroup (period)
     @states loading · empty · error · no-access
     @note   All numbers are computed by the API with one definition each: conversion = accepted / sent in the period; time to acceptance = accepted_at - sent_at; value metrics use the SENT version totals.
     ===================================================================================================================== */
  function analytics() {
    const svc = [["Websites", 58, 71], ["Web apps", 41, 34], ["Maintenance", 66, 52], ["Mobile apps", 22, 18], ["Consulting", 48, 12]];
    return '<div class="a-page">' + head("Proposal analytics", "How proposals perform: sent, viewed, accepted, and the value behind them.", '<div class="seg"><button>30 days</button><button class="on">90 days</button><button>Year</button></div>') +
      '<div class="mini-stats">' + stat("Proposals sent", 34, "+6 vs previous") + stat("Viewed", "82%", "28 of 34") + stat("Accepted", 14, eur(171424)) + stat("Conversion", "41%", "+4 pts") + stat("Avg value", eur(48900), "sent versions") + stat("Time to accept", "9 days", "-2 days") + "</div>" +
      '<div class="g2">' + cd("<b>Conversion by service</b><span class='r muted'>accepted / sent</span>", svc.map((s) => '<div class="bar-row"><span class="l">' + s[0] + '</span><span class="tr"><i class="fc-won" style="width:' + s[1] + '%"></i></span><span class="v">' + s[1] + "%</span></div>").join("")) +
      cd("<b>Quoted vs accepted value</b><span class='r muted'>by service, €k</span>", svc.map((s) => '<div class="bar-row"><span class="l">' + s[0] + '</span><span class="tr"><i class="fc-best" style="width:' + s[2] + '%"></i></span><span class="v">' + s[2] + "k</span></div>").join("")) + "</div>" +
      dm(["Proposal · status, gross_total, sent_at, accepted_at, view_count, company_id, owner_membership_id", "ProposalLineItem · product_id, name, net_amount · ProposalEvent"], []) + "</div>";
  }

  const MAP = { list, editor, customer, templates, analytics };
  const CRUMB = { editor: "PR-2041", customer: "Customer view" };
  window.VIEWS.proposals = { html: function (s) { return (MAP[s || "list"] || MAP.list)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
