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

  /* ---------- small builders shared by the deep screens (MOCK-ONLY; production uses shadcn Form/Table/Dialog) ---------- */
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const val = (t) => '<div class="input-fake dc-v">' + t + "</div>";
  const area = (t, h) => '<div class="input-fake' + (t ? " dc-v" : "") + '" style="min-height:' + (h || 84) + 'px">' + (t || "") + "</div>";
  const g2 = (a, b) => '<div class="dc-grid2">' + a + b + "</div>";
  const g3 = (a, b, c) => '<div class="dc-grid3">' + a + b + c + "</div>";
  const gap = (n) => '<div style="height:' + (n || 12) + 'px"></div>';
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows) => '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div></div>";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const mono = (t) => '<b class="ink mono" style="font-weight:500">' + t + "</b>";
  const FB = (chips, extra) => window.UI.filters.filterBar(chips, extra);
  const steps = (arr, on) => '<div class="dc-steps">' + arr.map((s, i) => '<div class="dc-step' + (i < on ? " done" : i === on ? " on" : "") + '"><span class="n">' + (i < on ? I("check", 11) : i + 1) + "</span><div>" + s[0] + (s[1] ? "<small>" + s[1] + "</small>" : "") + "</div></div>").join("") + "</div>";
  const opt = (ic, t, s, on) => '<div class="dc-opt' + (on ? " on" : "") + '"><span class="ic">' + I(ic, 18) + "</span><div><b>" + t + "</b><small>" + s + "</small></div></div>";
  const views = (arr, on) => '<div class="dc-views">' + arr.map((a) => '<button class="' + (a[0] === on ? "on" : "") + '">' + a[0] + (a[1] != null ? ' <span class="c">' + a[1] + "</span>" : "") + "</button>").join("") + "<button>" + I("plus", 12) + " Save view</button></div>";
  const chips = (arr, on) => '<div class="dc-chips">' + arr.map((a) => '<span class="dc-chip' + (on.indexOf(a) > -1 ? " on" : "") + '">' + a + "</span>").join("") + "</div>";
  const bulkBar = (n, inner) => '<div class="bulk"><span class="cb on"></span><b>' + n + " selected</b><span class=\"muted\">the bulk bar appears when rows are selected</span><span style=\"flex:1\"></span>" + inner + "</div>";
  const pager = (t) => '<div class="pager"><span class="muted">' + t + '</span><span style="flex:1"></span>' + sel("25 per page") + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>";
  const ctable = (cols, rows, nsel) => '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table>' + th([""].concat(cols)) + "<tbody>" + rows.map((r, i) => "<tr class=\"clk\"><td>" + cb(i < nsel) + "</td>" + r.map((c, j) => "<td" + (cols[j][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div></div>";
  const foot = (a) => '<div class="dc-foot">' + a + "</div>";
  const pub = (top, body, narrow) => '<div class="dc-pub"><div class="dc-pub-top"><span class="logo">LD</span><span class="nm">Logiqdev</span><span class="r">' + top + '</span></div><div class="dc-pub-body' + (narrow ? " n" : "") + '">' + body + '</div><div class="dc-pub-foot">Powered by Logiqdev OS · this page is not indexed · <a style="text-decoration:underline">Privacy</a></div></div>';
  const PEOPLE = { AM: ["Anna Meyer", ""], SJ: ["Sofia Jensen", "y"], NG: ["Nikos Georgiou", "g"], KL: ["Kim Lund", "p"], MS: ["Marco Silva", "g"], EP: ["Elena Papadaki", ""], PR: ["Petros Rodinos", ""] };
  const av = (a) => AV(a, PEOPLE[a][1]);
  const wh = (a, s) => who(a, PEOPLE[a][1], PEOPLE[a][0], s || "");
  const DECIDED = "Tooltip shows the raw enum value on every badge (title attribute).";

  /* =====================================================================================================================
     PROPOSALS LIST (spec "Proposal Status", "Proposal Tracking")
     @screen Proposals / All proposals (table, filters, saved views, bulk, pager)
     @route  /proposals?view=&filter=<json>&sort=&q=&cursor=   (the panel "Views" are SavedView rows, entity_type PROPOSAL)
     @perm   VIEW proposals.proposals.read · create proposals.proposals.create · edit proposals.proposals.update · send proposals.proposals.send · approve proposals.proposals.approve* · cancel proposals.proposals.cancel ·
             convert proposals.proposals.convert* · archive proposals.proposals.archive · delete proposals.proposals.delete* · export proposals.proposals.export* · money columns need finance-level visibility
     @api    GET /proposals?filter=&sort=&q=&cursor= · POST /proposals/bulk {ids|filter, action: assign_owner|archive|cancel|export|extend_validity} · GET/POST/PATCH /saved-views?entity_type=PROPOSAL · POST /proposals/:id/duplicate
     @mcp    proposals_proposals_read (same filter JSON) · proposals_proposals_create · proposals_proposals_send (human confirmation for AI callers)
     @data   Proposal (number, title, status, company_id, contact_id, deal_id, project_id, owner_membership_id, template_id, currency, language, valid_until, net_total, gross_total, recurring_monthly, requires_contract, current_version_id,
             sent_version_id, accepted_version_id, sent_at, first_viewed_at, last_viewed_at, view_count, accepted_at, rejected_at, expired_at, archived_at) · ProposalVersion (version_number, status) · SavedView (entity_type PROPOSAL)
     @ui     Table (server-side, column chooser), ToggleGroup/saved-view tabs, Popover+Command filter pickers, Badge, Avatar, DropdownMenu (row actions), sticky bulk bar, "Save view" Dialog
     @states loading skeleton · empty ("Create your first proposal from a deal") · no match ("No proposals match these filters" + clear) · error · no-access · money columns hidden without finance visibility
     @audit  proposal created / duplicated / cancelled / archived; a bulk action writes one audit event per proposal plus a summary event with the filter
     @note   Number comes from NumberSequence (entity_type "proposal") allocated by the API in a transaction. SENT -> VIEWED is set by the first ProposalEvent VIEWED; EXPIRED by a job when valid_until passes. "Awaiting approval" =
             PENDING_APPROVAL. "Select all" selects by FILTER (the API re-evaluates it) and the bulk bar says how many proposals it will touch.
     @note   "Lost" proposals carry Proposal.lost_reason (ProposalLostReason: PRICE, SCOPE, TIMING, COMPETITOR, NO_DECISION, OTHER), set when the status becomes REJECTED or EXPIRED; the free text stays in ProposalAcceptance.feedback.
     ===================================================================================================================== */
  function list() {
    /* number, title, customer, status, gross, valid until, tracking, owner, version, recurring */
    const R = [
      ["PR-2041", "Acme Rebrand phase 2", "Acme Corp", "VIEWED", 62496, "Dec 15", "3 views · 2h ago", "AM", "v2 sent · v3 draft", "€600/mo"],
      ["PR-2043", "Mobile app v3", "Globex", "PENDING_APPROVAL", 109120, "—", "—", "AM", "v1", "—"],
      ["PR-2040", "Brand strategy sprint", "Umbrella Ltd", "SENT", 19592, "Dec 05", "not viewed", "SJ", "v1 sent", "—"],
      ["PR-2038", "Data warehouse setup", "Hooli", "CHANGES_REQUESTED", 64480, "Dec 20", "5 views · 1d ago", "NG", "v2 sent", "€1,200/mo"],
      ["PR-2036", "Maintenance plan", "Acme Corp", "ACCEPTED", 71424, "—", "accepted Nov 2", "KL", "v1 accepted", "€5,952/mo"],
      ["PR-2035", "CMS migration", "Initech", "DRAFT", 28900, "—", "—", "MS", "v1 draft", "—"],
      ["PR-2031", "E-commerce rebuild", "Wonka", "EXPIRED", 79600, "Oct 31", "2 views", "AM", "v1 sent", "—"],
      ["PR-2029", "Support retainer", "Soylent", "REJECTED", 14880, "—", "rejected Oct 20", "SJ", "v1 sent", "€1,240/mo"],
      ["PR-2027", "Brand guidelines refresh", "Stark Industries", "APPROVED", 22320, "—", "ready to send", "PR", "v1 approved", "—"],
      ["PR-2025", "Analytics dashboard", "Wayne Enterprises", "IN_REVIEW", 48050, "—", "—", "NG", "v1 in review", "—"],
    ];
    return '<div class="a-page">' + head("Proposals", "Quotes and proposals from first draft to accepted work. Every sent proposal stays bound to the exact version that was sent.", btn("Import", "box") + btn("Export", "file") + btn("New proposal", "plus", "primary")) +
      /* @impl KPI strip: counts and sums from GET /proposals/summary (scoped by the caller's visibility). Click = apply the filter. */
      '<div class="mini-stats">' + stat("Open value", eur(255688), "6 proposals out") + stat("Accepted (90d)", eur(171424), "3 proposals") + stat("Conversion", "41%", "accepted / sent") + stat("Avg time to accept", "9 days", "-2 days") + stat("Awaiting approval", "1", "PENDING_APPROVAL") + stat("Expiring in 7 days", "2", "valid_until", 1) + "</div>" +
      views([["All", 14], ["My proposals", 5], ["Drafts", 3], ["Awaiting approval", 2], ["Sent, not viewed", 2], ["Viewed", 3], ["Changes requested", 1], ["Expiring soon", 2], ["Accepted", 3], ["Lost", 2]], "All") +
      '<div class="toolbar">' + search("Search number, title, customer, contact…") + sel("Table", "grid") + sel("Group: None") + sel("Sort: Created ↓", "sort") + sel("Columns (10)", "settings") + sel("Views: Team pipeline", "star") + "</div>" +
      /* @impl Filter fields for PROPOSAL: status, version status, customer (CrmCompany), contact, deal, project, owner, branch, template, work type, language, currency, total (between), valid until, created, sent, viewed, accepted, requires_contract,
           has optional items, recurring, tag, custom field (02 §24). Operators: is / is not / is any of / before / after / between / is empty. Stored as SavedView.filters JSON, the same JSON drives GET /proposals?filter=. */
      FB([["Status", "is any of", "Sent, Viewed, Changes requested"], ["Owner", "is", "Anna Meyer"], ["Total", "between", "€10k – €120k"], ["Valid until", "before", "Dec 31"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      bulkBar(3, sel("Assign owner…", "users") + sel("Extend validity…", "calendar") + btn("Archive", "box", "sm") + btn("Cancel proposals", "x", "sm") + btn("Export", "file", "sm")) +
      ctable(["Proposal", "Customer", "Status", "Version", ">Total (gross)", "Recurring", "Valid until", "Tracking", "Owner", ""], R.map((r) => [mono(r[0]) + "<div class='sub-note'>" + r[1] + "</div>", r[2], pStatus(r[3]), '<span class="muted">' + r[8] + "</span>", '<span class="money">' + eur(r[4]) + "</span>", '<span class="muted">' + r[9] + "</span>", '<span class="' + (r[3] === "EXPIRED" ? "muted" : "") + '">' + r[5] + "</span>", '<span class="muted">' + r[6] + "</span>", av(r[7]), more]), 3).replace(/<tr class="clk">/g, '<tr class="clk" onclick="location.hash=\'#proposals/editor\'">') +
      pager("1–10 of 14") +
      dm(["Proposal · number, title, status, lost_reason, company_id, contact_id, deal_id, project_id, owner_membership_id, template_id, currency, language, valid_until, gross_total, recurring_monthly, requires_contract, current_version_id, sent_version_id, accepted_version_id, sent_at, first_viewed_at, last_viewed_at, view_count, accepted_at, rejected_at, expired_at, archived_at", "ProposalVersion · version_number, status · NumberSequence · CrmCompany, CrmDeal · SavedView · entity_type PROPOSAL, layout, visibility, filters, sorting, grouping, columns, search, is_default"], []) + "</div>";
  }

  /* =====================================================================================================================
     NEW PROPOSAL — full page create wizard (spec "Proposal Creation", "AI Proposal Generation", "Dynamic Proposal Content")
     @screen Proposals / New proposal
     @route  /proposals/new?from=deal:<id>|template:<id>|proposal:<id>|project:<id>
     @perm   proposals.proposals.create · AI start proposals.ai.generate (+ active OpenAI connection) · choosing an owner other than yourself proposals.proposals.update · picking a deal needs crm.deals.read, a catalog price needs finance.products.read
     @api    POST /proposals {title, language, currency, company_id, contact_id, deal_id?, project_id?, owner_membership_id, branch_id?, template_id?, source: blank|deal|template|duplicate|ai, validity_days, requires_contract,
             variables{}, section_types[], line_items[{product_id?, name, quantity, unit, unit_price, discount_percent?, tax_percent, is_optional, is_recurring, billing_frequency}], payment_schedule[], payment_terms, ai{enabled, brief}}
             -> returns {id, number, current_version_id}; totals are computed server-side. POST /proposals/:id/ai/generate runs async after create.
     @mcp    proposals_proposals_create · proposals_ai_generate
     @data   Proposal (title, language, currency, company_id, contact_id, deal_id, project_id, owner_membership_id, branch_id, template_id, valid_until, requires_contract) · ProposalVersion (variables, payment_terms, validity_days, milestones, timeline,
             template_version, is_ai_generated, ai_metadata) · ProposalSection · ProposalLineItem · ProposalPaymentScheduleItem · ProposalTemplate (sections, variables, defaults) · CrmDeal / CrmCompany / CrmContact (02) · Product (08) · NumberSequence
     @ui     Stepper (left, sticky), react-hook-form + zod, Select / Popover+Command (customer, contact, deal, owner, template), DatePicker, ToggleGroup, Switch, editable Table (line items), "Create draft" and "Create and open editor" buttons
     @states validation inline per step · saving · created (toast with the new number PR-2044 and Undo) · AI not connected (the AI card explains how to connect OpenAI) · field disabled with reason on missing permission · draft restored from local storage
     @audit  proposal created (source recorded: deal / template / duplicate / AI) · ProposalEvent CREATED + VERSION_CREATED
     @note   Starting from a DEAL prefills customer, contact, owner, project, currency and a title; deal products become line items. The number is allocated by the API (NumberSequence), the client never invents it. Choosing a template copies its
             sections, defaults and variables and stores ProposalVersion.template_version: later template edits never change this proposal. AI output is always a DRAFT (is_ai_generated) that a human must review before sending.
     ===================================================================================================================== */
  function create() {
    const SEC = ["COVER", "EXECUTIVE_SUMMARY", "REQUIREMENTS", "SOLUTION", "SCOPE", "DELIVERABLES", "TIMELINE", "PRICING", "PAYMENT_SCHEDULE", "ASSUMPTIONS", "EXCLUSIONS", "TERMS", "SIGNATURE"];
    const LI = [["Design", "Brand identity refresh", 1, "project", 18000, 0, 24, "", ""], ["Design", "Marketing website redesign", 1, "project", 24000, 5, 24, "", ""], ["Enablement", "CMS training workshop", 2, "day", 1200, 0, 24, "optional", ""], ["Care", "Maintenance plan", 12, "month", 600, 0, 24, "", "monthly"]];
    return '<div class="a-page">' + head("New proposal", "Create a draft proposal. The number is assigned when you save; totals are calculated by the server.", btn("Cancel") + btn("Save draft") + btn("Create and open editor", "plus", "primary")) +
      '<div class="dc-split">' + steps([["Source", "Deal, template, duplicate, AI"], ["Customer", "Company, contact, owner"], ["Content", "Template and sections"], ["Pricing", "Line items"], ["Payments", "Schedule and terms"], ["Validity & delivery", "Valid until, contract"], ["Review", "Summary and create"]], 0) + "<div class=\"stack\">" +
      cd("<b>1 · Where does it start?</b><span class='r muted'>ProposalVersion.is_ai_generated · template_version</span>", '<div class="dc-opts">' + opt("crm", "From a deal", "Prefill customer, contact, owner and products from a CRM deal", 1) + opt("layers", "From a template", "Copy sections, defaults and variables of a template version", 0) + opt("file", "Duplicate a proposal", "Copy any proposal you can read into a new draft", 0) + opt("folder", "From a project", "Scope and milestones from an existing project (05)", 0) + opt("sparkles", "Generate with AI", "Draft from deal, project and notes. Needs an OpenAI connection", 0) + opt("edit", "Blank", "Empty draft with only a cover section", 0) + "</div>" +
        gap() + f("Deal", sel("Acme Rebrand phase 2 · €60,000 · Negotiation", "crm"), "Open and won-in-progress deals you can read (crm.deals.read). Linked as Proposal.deal_id.") +
        '<div class="callout" style="margin-top:6px">' + I("sparkles", 16) + "<div><b>AI is connected.</b> OpenAI key from Admin > Integrations (per organization). Use the AI card below to draft sections after you choose a template.</div></div>") +
      cd("<b>2 · Customer</b><span class='r muted'>CrmCompany · CrmContact</span>", g2(f("Company", sel("Acme Corp", "building")), f("Primary contact", sel("Lena Kovac · Marketing Director", "users"))) + g2(f("Proposal title", val("Acme Rebrand phase 2")), f("Owner", sel("Anna Meyer", "users"))) +
        g3(f("Branch", sel("Athens HQ")), f("Currency", sel("EUR · €")), f("Language", sel("English"))) + f("Linked project", sel("None yet (created on acceptance)", "folder"), "Proposal.project_id. Leave empty for new work; set it for change work on an existing project.") + f("Other recipients", sel("Add contacts…", "mail"), "Contacts who also receive the link; stored on each ProposalDelivery.")) +
      cd("<b>3 · Content</b><span class='r muted'>ProposalTemplate v4 · ProposalSection</span>", g2(f("Template", sel("Website development · v4 · default", "layers")), f("Work type", val("Website"))) + f("Sections included", chips(SEC.map((x) => U.en(x)), SEC.map((x) => U.en(x)).filter((x, i) => [0, 1, 3, 4, 5, 6, 7, 8, 11, 12].indexOf(i) > -1)), "Order and text are edited in the proposal editor. Each section keeps its ProposalSectionType; unchecked types are skipped.") +
        f("Dynamic variables", '<div class="dc-chips">' + ["customer.name", "company.name", "project.name", "proposal.number", "proposal.valid_until", "project.manager"].map((v) => '<span class="tok mono">{{' + v + "}}</span>").join("") + "</div>", "Resolved from the CRM company, contact and project on every render (ProposalVersion.variables).") +
        '<div class="rowx" style="padding-left:0"><div class="grow"><b>Generate sections with AI after creating</b><small>Runs POST /proposals/:id/ai/generate; results are drafts marked "AI draft" (proposals.ai.generate)</small></div>' + sw(1) + "</div>" + f("AI brief", area("Rebrand and redesign the marketing site on a headless CMS, 10 weeks, three phases, 12 months of care. Mention the 2027 upmarket move.", 70), "Sent to the model with deal notes and project facts. Do not paste secrets or personal data of third parties.")) +
      cd("<b>4 · Pricing</b><span class='r'>" + btn("From catalog", "box", "sm") + btn("Custom line", "plus", "sm") + "</span>", '<table><thead><tr><th>Item</th><th class="num">Qty</th><th>Unit</th><th class="num">Unit price</th><th class="num">Disc.</th><th class="num">VAT</th><th>Flags</th><th class="num">Net</th><th></th></tr></thead><tbody>' + LI.map((l) => "<tr><td>" + ink(l[1]) + "<div class='sub-note'>" + l[0] + '</div></td><td class="num">' + l[2] + "</td><td>" + l[3] + '</td><td class="num money">' + eur(l[4]) + '</td><td class="num">' + (l[5] ? l[5] + "%" : "—") + '</td><td class="num">' + l[6] + "%</td><td>" + (l[7] ? '<span class="badge">Optional</span>' : "") + (l[8] ? '<span class="badge blue">Recurring ' + l[8] + "</span>" : "") + '</td><td class="num money ink">' + eur(l[2] * l[4] * (1 - l[5] / 100)) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table>" +
        '<div class="cd-b" style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px"><div class="sub-note" style="max-width:360px">Catalog lines fill name, unit, price and VAT from Product (08) and are SNAPSHOTTED. Optional lines are excluded from the base total until the customer selects them. Totals are shown from the API response, never computed in the client.</div><div style="width:300px">' + kv("Net subtotal", eur(50400)) + kv("Discounts", "−" + eur(1200)) + kv("VAT 24%", eur(12096)) + kv("Total (gross)", "<b class='ink'>" + eur(62496) + "</b>") + kv("Recurring", eur(600) + " / month") + "</div></div>", 1) +
      cd("<b>5 · Payments</b><span class='r'>" + btn("Add payment", "plus", "sm") + "</span>", g2(f("Payment terms", sel("Net 14")), f("Preset", sel("30 / 30 / 40 milestones", "list"))) + '<table><thead><tr><th>Payment</th><th>Trigger</th><th class="num">Share</th><th>Milestone / date</th></tr></thead><tbody><tr><td>Deposit</td><td>' + E("ON_ACCEPTANCE") + '</td><td class="num">30%</td><td class="muted">on acceptance</td></tr><tr><td>Design approved</td><td>' + E("ON_MILESTONE") + '</td><td class="num">30%</td><td class="muted">Design approved</td></tr><tr><td>Launch</td><td>' + E("ON_DELIVERY") + '</td><td class="num">40%</td><td class="muted">on delivery</td></tr><tr><td>Maintenance</td><td>' + E("RECURRING") + '</td><td class="num">—</td><td class="muted">monthly</td></tr></tbody></table><div class="sub-note" style="margin-top:8px"><span class="badge green">100% allocated</span> The schedule must equal 100% of the base total; the API validates it.</div>') +
      cd("<b>6 · Validity & delivery</b>", g3(f("Valid for", val("30 days"), "ProposalVersion.validity_days"), f("Valid until", val("Dec 15, 2026"), "Proposal.valid_until, calculated on send"), f("Reminder before expiry", sel("7 days before", "bell"))) +
        '<div class="rowx" style="padding-left:0"><div class="grow"><b>Needs a signed contract</b><small>Proposal.requires_contract. Acceptance continues to the signature step and then creates the contract (04)</small></div>' + sw(1) + '</div><div class="rowx" style="padding-left:0"><div class="grow"><b>Show in the customer portal</b><small>Requires a portal user for the contact (07)</small></div>' + sw(1) + '</div><div class="rowx" style="padding-left:0"><div class="grow"><b>Require approval before sending</b><small>Decided by approval rules; you can add more reviewers on the review page</small></div>' + sw(0) + "</div>") +
      cd("<b>7 · Review</b>", kv("Customer", "Acme Corp · Lena Kovac") + kv("Template", "Website development v4") + kv("Sections", "10 of 13") + kv("Total", "<b class='ink'>" + eur(62496) + "</b> incl. VAT") + kv("Approval needed", "Probably: discount over 5% (rule “Discount over 5%”)") + foot(btn("Cancel") + btn("Save draft") + btn("Create and open editor", "plus", "primary"))) + "</div></div>" +
      dm(["Proposal · title, language, currency, company_id, contact_id, deal_id, project_id, owner_membership_id, branch_id, template_id, valid_until, requires_contract", "ProposalVersion · variables, payment_terms, validity_days, template_version, is_ai_generated, ai_metadata", "Proposal · reminder_days, link_access_mode (set on send)", "ProposalSection · type, title, body, sort_order · ProposalLineItem · ProposalPaymentScheduleItem", "ProposalTemplate · sections, defaults, variables, default_validity_days · CrmDeal · CrmCompany · CrmContact · Product · NumberSequence"], ["\"Show in customer portal\" and other recipients use ProposalDelivery rows created on send, not Proposal fields"]) + "</div>";
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
     SEND PROPOSAL — full page (replaces the "Send" dialog; spec "Customer Delivery", "PDF Generation")
     @screen Proposals / Send proposal
     @route  /proposals/:proposalId/send?version=
     @perm   proposals.proposals.send · sending an unapproved version is refused (APPROVED required when a rule matched) · Communication Center templates need the channel's own send key (11)
     @api    GET /proposals/:id/send-preview?version= (checklist, recipients, PDF) · POST /proposals/:id/send {version_id, channels[EMAIL|CUSTOMER_PORTAL|PDF|LINK], recipient_contact_ids[], extra_emails[], subject, message, valid_until, reminder_days[]}
             -> locks the version (locked_at, content_hash), stores the PDF in Documents (17), creates ProposalDelivery rows and the public link (only a hash of the token is stored)
     @mcp    proposals_proposals_send (sensitive: human confirmation when an AI agent calls it)
     @data   Proposal (public_token_hash, link_access_mode, reminder_days, valid_until, sent_version_id, sent_at) · VerificationCode (PROPOSAL_ACCESS) · ProposalVersion (status APPROVED -> SENT, locked_at, content_hash, pdf_document_id) · ProposalDelivery (channel, status, recipient_contact_id, recipient_email, communication_id, message) · ProposalEvent SENT
     @ui     Card, Checkbox list (pre-send checklist), ToggleGroup (channels), Popover+Command (recipients), Textarea with variables, iframe PDF preview, AlertDialog (confirm lock)
     @states loading · blocked (checklist failing: Send disabled with reasons) · sending · sent (toast + link copy) · delivery failed per channel (retry) · no-access
     @audit  proposal sent (version, channels, recipients) · ProposalEvent SENT · public link created
     @note   Sending LOCKS the version: further edits create a new version. Email goes through Communication Center (11) with the organization template; the portal channel needs a portal user (07); LINK creates an unguessable public URL
             (token shown once). Bot protection and rate limits apply to the public endpoints.
     @note   Proposal.reminder_days (Int[], days before valid_until, e.g. [7, 2]) drives the customer reminder emails; Proposal.link_access_mode (ProposalLinkAccessMode: ANYONE_WITH_LINK | EMAIL_VERIFIED) controls the public link: EMAIL_VERIFIED asks the recipient for a one-time code first (VerificationCode, purpose PROPOSAL_ACCESS, 04 e-signature service).
     ===================================================================================================================== */
  function send() {
    const ck = (ok, t, s) => '<div class="rowx">' + (ok ? '<span class="badge green">' + I("check", 11) + "</span>" : '<span class="badge yellow">!</span>') + '<div class="grow"><b>' + t + "</b><small>" + s + "</small></div>" + (ok ? "" : btn("Fix", "", "sm")) + "</div>";
    return '<div class="a-page">' + head("Send proposal", "PR-2041 Acme Rebrand phase 2 · v3 · locks the version when sent", btn("Cancel") + btn("Preview as customer", "globe") + btn("Send proposal", "send", "primary")) +
      '<div class="dc-split r"><div class="stack">' +
      cd("<b>Recipients</b><span class='r muted'>ProposalDelivery.recipient_*</span>", '<div class="rowx">' + cb(1) + '<div class="grow"><b>Lena Kovac</b><small>lena@acme.example · primary contact · portal user</small></div>' + E("EMAIL") + E("CUSTOMER_PORTAL") + '</div><div class="rowx">' + cb(1) + '<div class="grow"><b>Marc Dupont</b><small>marc@acme.example · finance contact · viewed v2 on Nov 9</small></div>' + E("EMAIL") + '</div><div class="rowx">' + cb(0) + '<div class="grow"><b>Add recipient</b><small>CRM contact or any email address</small></div>' + sel("Add…", "plus") + "</div>", 1) +
      cd("<b>Channels</b>", '<div class="dc-opts">' + opt("mail", "Email", "Branded email via Communication Center (11) with the PDF attached", 1) + opt("globe", "Customer portal", "Appears in the portal for portal users (07)", 1) + opt("link", "Public link", "Single proposal link, no login. Token stored hashed", 1) + opt("file", "PDF only", "Download the PDF to send yourself", 0) + "</div>") +
      cd("<b>Message</b>", f("Subject", val("Your proposal: Acme Rebrand phase 2 (PR-2041)")) + f("Message", area("Hi {{customer.name}},\n\nthanks for the feedback on v2. v3 adds the training workshop and a warranty section. You can review it, pick optional items and accept online.\n\nBest, {{project.manager}}", 120), "Variables are resolved per recipient. A template from Communication Center can be chosen here.") + g2(f("Valid until", val("Dec 15, 2026")), f("Reminder", sel("3 days before expiry", "bell"), "Proposal.reminder_days (several allowed, e.g. 7 and 3).")) + f("Public link access", sel("Email-verified (one-time code)", "lock"), "Proposal.link_access_mode: ANYONE_WITH_LINK or EMAIL_VERIFIED.")) +
      cd("<b>PDF preview</b><span class='r muted'>generated on send · Documents (17)</span>", '<div class="dc-paper"><h1>Acme Rebrand phase 2</h1><div class="meta">Proposal PR-2041 · v3 · prepared for Lena Kovac, Acme Corp</div><hr><h3>Executive summary</h3><p>Acme Corp wants a modern brand and website that reflects its move upmarket in 2027…</p><h3>Investment</h3><p>Total incl. VAT ' + eur(62496) + ' · recurring ' + eur(600) + ' / month</p></div>') + "</div>" +
      '<div class="stack">' + cd("<b>Before you send</b>", ck(1, "Content complete", "10 sections, no empty required section") + ck(1, "Pricing valid", "Totals recomputed by the server · payment schedule is 100%") + ck(1, "Approvals", "2 of 2 steps approved for v3") + ck(0, "AI findings", "1 open AI recommendation: no warranty period (review or dismiss)") + ck(1, "Contact has an email", "2 recipients"), 1) +
      callout("lock", "<b>v2 becomes SUPERSEDED</b> after v3 is sent, but the customer's link keeps showing the version they were sent until v3 is delivered. Acceptances stay bound to the version they were given on.", "warn") +
      cd("<b>Delivery log</b><span class='r muted'>previous sends</span>", '<div class="tl"><div class="ev"><b>v2 · EMAIL → Lena Kovac</b><small>Nov 8 · ' + S("DELIVERED") + '</small></div><div class="ev"><b>v2 · CUSTOMER_PORTAL</b><small>Nov 8 · ' + S("SENT") + "</small></div><div class=\"ev\"><b>v2 · EMAIL → Marc Dupont</b><small>Nov 9 · " + S("FAILED") + " · mailbox full</small></div></div>") + "</div></div>" +
      dm(["Proposal · public_token_hash, link_access_mode, reminder_days, valid_until, sent_version_id, sent_at", "ProposalVersion · status, locked_at, content_hash, pdf_document_id", "VerificationCode · purpose PROPOSAL_ACCESS, channel EMAIL, recipient, code_hash, expires_at, attempts", "ProposalDelivery · channel, status, recipient_contact_id, recipient_email, communication_id, message, failed_reason · ProposalEvent SENT", "CrmContact (02) · CommMessage (11)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CUSTOMER DECISION — accept / request changes / decline (spec "Customer Approval")
     @screen Proposals / Customer decision (public page, standalone)
     @route  /p/:publicToken/decision?mode=accept|changes|decline
     @perm   public token (hash match) · portal: portal.proposals.accept* · acceptance by an unauthenticated token holder is allowed only when the proposal allows it
     @api    POST /public/proposals/:token/decision {decision: ACCEPTED|REJECTED|CHANGES_REQUESTED, signer_name, signer_email, signer_title?, terms_accepted, feedback?, selected_optional_item_ids[]}
             -> creates ProposalAcceptance (immutable), ProposalEvent ACCEPTED|REJECTED|CHANGES_REQUESTED and, if requires_contract, a SignatureRequest (subject PROPOSAL_VERSION) with the signer's single-use link
     @mcp    none (customer facing)
     @data   ProposalAcceptance (decision, signer_name, signer_email, signer_title, terms_accepted, selected_optional_item_ids, feedback, signature_request_id, ip_address, user_agent, version_id) · Proposal (status) · ProposalLineItem.selected_by_customer
     @ui     Standalone branded page, ToggleGroup (decision), Form (react-hook-form + zod), Checkbox (terms), Dialog (confirm), responsive and printable
     @states loading · validation inline · expired proposal (read-only) · already decided (shows the decision) · error · rate limited
     @audit  ProposalAcceptance row + ProposalEvent with IP and user agent; the record is never edited or deleted
     @note   The decision is bound to the SENT version the customer is looking at. If a newer version was sent meanwhile, the page asks the customer to reload instead of recording on the old one. If requires_contract is true, accepting leads to the
             in-house signing flow (04 §33), otherwise the proposal moves to ACCEPTED and conversion can start.
     ===================================================================================================================== */
  function accept() {
    return pub('<span class="badge blue">Valid until Dec 15, 2026</span>', '<div class="dc-prog"><span class="s done"><span class="n">' + I("check", 11) + "</span>Review</span><i></i><span class=\"s on\"><span class=\"n\">2</span>Your decision</span><i></i><span class=\"s\"><span class=\"n\">3</span>Sign</span><i></i><span class=\"s\"><span class=\"n\">4</span>Done</span></div>" +
      '<div class="dc-split r"><div class="stack">' +
      cd("<b>Your decision</b>", '<div class="dc-opts">' + opt("check", "Accept", "I accept this proposal and its terms", 1) + opt("edit", "Request changes", "Tell us what to adjust; we send a new version", 0) + opt("x", "Decline", "Not going ahead with this proposal", 0) + "</div>" +
        gap() + g2(f("Your name", val("Lena Kovac")), f("Job title (optional)", val("Marketing Director"))) + f("Email", val("lena@acme.example"), "Must match a contact of this proposal. We email a confirmation to this address.") +
        f("Optional items you chose", '<div class="rowx" style="padding-left:0">' + cb(1) + '<div class="grow"><b>CMS training workshop</b><small>2 days · ' + eur(2976) + ' incl. VAT</small></div></div>') +
        f("Comments (optional)", area("", 70)) + '<div class="rowx" style="padding-left:0">' + cb(1) + '<div class="grow"><b>I accept the terms and conditions of this proposal</b><small>Terms v3 · <a style="text-decoration:underline">read</a></small></div></div>' + foot(btn("Back") + btn("Accept and continue to signature", "check", "primary"))) +
      cd("<b>If you request changes or decline</b>", f("What should change?", area("", 70)) + f("Reason", sel("Price, Scope, Timing, Competitor, No decision, Other"), "Maps to Proposal.lost_reason (ProposalLostReason) when the proposal closes as REJECTED.") + '<div class="sub-note">The text is stored in ProposalAcceptance.feedback and visible to the proposal owner only. Declining closes the proposal as REJECTED.</div>') + "</div>" +
      '<div class="stack">' + cd("<b>Summary</b>", kv("Proposal", "PR-2041 · v3") + kv("Total (incl. VAT)", "<b class='ink'>" + eur(65472) + "</b>") + kv("Recurring", eur(600) + " / month") + kv("Prepared for", "Lena Kovac, Acme Corp")) +
      callout("shield", "This proposal needs a <b>signed contract</b>. After you accept, you get a single-use signing link and verify with a one-time code.") + "</div></div>");
  }

  /* =====================================================================================================================
     CUSTOMER: DECIDED + PUBLIC LINK STATES (spec "Customer Approval", "Proposal Status")
     @screen Proposals / Customer confirmation and public link states (standalone pages)
     @route  /p/:publicToken (same URL; the page renders the state) · /p/:publicToken/done
     @perm   public token · no data is shown for an invalid token (neutral page, same response time)
     @api    GET /public/proposals/:token -> {state: ACTIVE|DECIDED|EXPIRED|SUPERSEDED|CANCELLED|INVALID, ...}
     @mcp    none
     @data   Proposal (status, valid_until, cancelled_at, expired_at, sent_version_id) · ProposalAcceptance (decision, created_at) · ProposalEvent VIEWED
     @ui     Standalone branded pages, Alert, Button
     @states the five variants shown here · error · rate limited
     @audit  VIEWED event only for ACTIVE/DECIDED/EXPIRED states
     @note   INVALID and unknown tokens show the same neutral page. EXPIRED is read-only and offers "Ask for a new proposal" (creates a notification for the owner, 14). SUPERSEDED points to the newer link without revealing unsent drafts.
     ===================================================================================================================== */
  function signed() {
    const st = (cls, ic, t, p, extra) => '<div class="cd"><div class="dc-big"><span class="' + cls + '">' + I(ic, 26) + "</span><h2>" + t + "</h2><p>" + p + "</p>" + (extra || "") + "</div></div>";
    return pub("Customer view", '<div class="callout" style="margin-bottom:14px">' + I("globe", 16) + "<div><b>Review-only sheet.</b> These are the states the same public link can render. The real page shows one of them.</div></div>" +
      '<div class="g2">' + st("ok", "check", "Thank you, Lena", "You accepted <b>PR-2041 Acme Rebrand phase 2 (v3)</b> on Nov 11, 2026 at 14:02. A confirmation was emailed to lena@acme.example. Anna Meyer will contact you about the kickoff.", btn("Download signed PDF", "file")) +
      st("wa", "clock", "This proposal has expired", "PR-2040 was valid until Dec 05, 2026. You can still read it, but it can no longer be accepted.", btn("Ask for a new proposal", "mail", "primary")) +
      st("wa", "layers", "A newer version is available", "The version you opened was replaced by v3. Open the latest link we emailed you.", btn("Open latest version", "globe", "primary")) +
      st("no", "lock", "This link is not valid", "The link may be mistyped or no longer active. Contact the sender if you need a new one.") + "</div>" +
      dm(["Proposal · status, valid_until, cancelled_at, expired_at, sent_version_id", "ProposalAcceptance · decision, created_at · ProposalEvent VIEWED"], []));
  }

  /* =====================================================================================================================
     VERSION COMPARE (spec "Proposal Versions")
     @screen Proposals / Compare versions
     @route  /proposals/:proposalId/compare?from=<versionId>&to=<versionId>
     @perm   proposals.proposals.read · restore as new draft proposals.proposals.update · PDF proposals.proposals.read
     @api    GET /proposals/:id/compare?from=&to= -> {sections[{type, status: added|removed|changed|same, diff}], line_items[], payment_schedule[], totals{from,to}, variables} · POST /proposals/:id/versions {restore_from_version_id}
     @mcp    proposals_proposals_read
     @data   ProposalVersion (both, version_number, status, change_summary, totals, content_hash) · ProposalSection (body, sort_order, type) · ProposalLineItem · ProposalPaymentScheduleItem
     @ui     Version Select (two), ToggleGroup (unified | split), Collapsible per section, Badge (added / removed / changed), Table (pricing diff)
     @states loading · identical versions ("No differences") · error · no-access · internal sections hidden without proposals.comments.internal.read
     @audit  none (read-only); restore writes VERSION_CREATED
     @note   The diff is computed by the API (words for text, rows for prices). Internal sections appear only for staff. Restore never rewrites history: it copies the older version into a NEW draft.
     ===================================================================================================================== */
  function compare() {
    const ln = (c, m, t) => '<div class="dc-' + c + '"><span class="m">' + m + "</span><span>" + t + "</span></div>";
    return '<div class="a-page">' + head("Compare versions", "PR-2041 Acme Rebrand phase 2", sel("v2 · sent Nov 8", "layers") + sel("v3 · draft", "layers") + btn("Restore v2 as new draft", "reply") + btn("PDF", "file")) +
      '<div class="mini-stats">' + stat("Sections changed", 3, "of 13") + stat("Lines added", 1, "CMS training") + stat("Total", "+" + eur(5472), "62,496 vs 57,024") + stat("Payments", "unchanged", "30 / 30 / 40") + stat("Variables", "1 new", "project.manager") + "</div>" +
      '<div class="dc-split r"><div class="stack"><div class="cd"><div class="cd-b flush"><div class="dc-diff">' +
      '<div class="dc-diff-h">' + I("layers", 14) + 'Executive summary <span class="badge yellow">Changed</span></div>' + ln("chg", "~", "Acme Corp wants a modern brand and website that reflects its move upmarket in 2027.") + ln("del", "-", "We will deliver in two phases over 8 weeks.") + ln("add", "+", "We will deliver in three phases over 10 weeks, with Acme approving each milestone before the next begins.") +
      '<div class="dc-diff-h">' + I("layers", 14) + 'Terms &amp; conditions <span class="badge yellow">Changed</span></div>' + ln("", " ", "Payment: 14 days net from invoice date.") + ln("add", "+", "Warranty: 90 days after launch, defects fixed at no charge.") +
      '<div class="dc-diff-h">' + I("layers", 14) + 'Warranty <span class="badge green">Added</span></div>' + ln("add", "+", "New section (type WARRANTY): 90-day defect warranty, excludes third-party changes.") +
      '<div class="dc-diff-h">' + I("layers", 14) + 'Timeline <span class="badge">Unchanged</span></div>' + ln("", " ", "Phase 1 Nov 24 · Phase 2 Jan 12 · Phase 3 Feb 9") + "</div></div></div>" +
      cd("<b>Pricing changes</b>", '<table><thead><tr><th></th><th>Item</th><th class="num">v2</th><th class="num">v3</th></tr></thead><tbody><tr><td>' + '<span class="badge green">Added</span>' + '</td><td class="ink">CMS training workshop (optional)</td><td class="num muted">—</td><td class="num money">' + eur(2400) + '</td></tr><tr><td>' + '<span class="badge yellow">Changed</span>' + '</td><td class="ink">Marketing website redesign · discount</td><td class="num">0%</td><td class="num">5%</td></tr><tr><td></td><td class="ink">Maintenance plan</td><td class="num money">' + eur(7200) + '</td><td class="num money">' + eur(7200) + "</td></tr></tbody></table>", 1) + "</div>" +
      '<div class="stack">' + cd("<b>Versions</b>", '<div class="rowx"><div class="grow"><b>v3</b><small>DRAFT · Anna Meyer · Nov 10</small></div>' + E("DRAFT", "yellow") + '</div><div class="rowx"><div class="grow"><b>v2</b><small>SENT · locked · hash 7be0…41aa</small></div>' + E("SENT", "blue") + '</div><div class="rowx"><div class="grow"><b>v1</b><small>SUPERSEDED</small></div>' + E("SUPERSEDED") + "</div>", 1) + callout("lock", "v2 is locked. Restoring copies it into a <b>new draft</b> (v4); v2 and v3 stay untouched.") + "</div></div>" +
      dm(["ProposalVersion · version_number, status, change_summary, totals, content_hash, locked_at", "ProposalSection · type, title, body, sort_order, is_internal · ProposalLineItem · ProposalPaymentScheduleItem"], ["Word-level diff is computed on the fly; nothing is stored"]) + "</div>";
  }

  /* =====================================================================================================================
     REQUEST REVIEW / APPROVAL CHAIN (spec "Proposal Review")
     @screen Proposals / Request review
     @route  /proposals/:proposalId/review/request?version=
     @perm   request proposals.proposals.update · reviewers need proposals.proposals.approve* · approval rules are applied automatically (managed with proposals.approval_rules.manage*)
     @api    GET /proposals/:id/review/preview?version= (matched rules and resulting steps) · POST /proposals/:id/versions/:vid/submit-for-review {approvals[{step, approver_membership_id, rule_id?}], note, due_at?}
     @mcp    proposals_proposals_update
     @data   ProposalApprovalRule (conditions, steps, priority, enabled) · ProposalApproval (step, approver_membership_id, rule_id, decision, comment, requested_at) · ProposalVersion (status DRAFT -> IN_REVIEW) · Proposal.status IN_REVIEW | PENDING_APPROVAL · ProposalComment
     @ui     Card, Stepper (approval chain), Popover+Command (approver picker), Textarea, Switch, Alert
     @states loading · no rules matched ("No approval is required; you can send directly") · approver without permission (blocked with reason) · submitted (toast) · error
     @audit  submitted for review (ProposalEvent SUBMITTED_FOR_REVIEW) · each ProposalApproval row created
     @note   Rules decide the steps; a manager may add steps manually but cannot remove a rule-required step. Each ProposalApproval is bound to ONE version. Editing the version after submission resets the chain.
     @note   Each approval step has ProposalApproval.due_at; the reviewer is reminded and the owner is told when a step is overdue (14).
     ===================================================================================================================== */
  function reviewRequest() {
    const stp = (n, who2, role, why, ok) => '<div class="dc-stepcard"><span class="n">' + n + "</span><div class=\"grow\" style=\"flex:1\">" + "<b class=\"ink\">" + who2 + "</b><div class=\"sub-note\">" + role + " · " + why + "</div></div>" + (ok ? '<span class="badge blue">Rule</span>' : '<span class="badge">Manual</span>') + btn("Change", "", "sm") + "</div>";
    return '<div class="a-page">' + head("Request review", "PR-2041 · v3 · sends the version to its approvers", btn("Cancel") + btn("Submit for review", "send", "primary")) +
      '<div class="dc-split r"><div class="stack">' +
      cd("<b>Approval chain</b><span class='r'>" + btn("Add step", "plus", "sm") + "</span>", '<div class="callout" style="margin-bottom:10px">' + I("shield", 16) + "<div>2 rules matched this version. Their steps are required and run in order.</div></div>" + stp(1, "Elena Papadaki", "Finance", "rule “Discount over 5%”: the website line has a 5% discount", 1) + stp(2, "Petros Rodinos", "Executive", "rule “Value over €50k”: total " + eur(62496), 1) + stp(3, "Anna Meyer", "Account owner", "added by you: wording check", 0)) +
      cd("<b>Note for reviewers</b>", f("What should they look at?", area("Discount at the limit; warranty wording added after the customer asked about defects. Please check Terms and Pricing.", 90)) + g2(f("Due", val("Nov 13, 2026"), "Stored on every created ProposalApproval step as due_at."), f("Notify by", sel("Notification + email", "bell"))) + '<div class="rowx" style="padding-left:0"><div class="grow"><b>Allow reviewers to edit sections</b><small>Edits create a new draft version and restart the chain</small></div>' + sw(0) + "</div>") + "</div>" +
      '<div class="stack">' + cd("<b>What reviewers see</b>", kv("Version", "v3 · draft") + kv("Total", "<b class='ink'>" + eur(62496) + "</b>") + kv("Discount", "5% on one line") + kv("Margin", "Restricted") + kv("Changes vs sent", "3 sections, 1 line") + btn("Open compare", "layers", "sm"), 0) + callout("lock", "Reviewers can comment internally (proposals.comments.internal.read). Internal comments never reach the customer.", "") + "</div></div>" +
      dm(["ProposalApprovalRule · conditions, steps, priority, enabled", "ProposalApproval · step, approver_membership_id, rule_id, decision, comment, requested_at, due_at, decided_at", "ProposalVersion · status · Proposal · status", "ProposalComment · is_internal"], []) + "</div>";
  }

  /* =====================================================================================================================
     APPROVAL DECISION (the approver's page; spec "Proposal Review")
     @screen Proposals / Approve or reject
     @route  /proposals/:proposalId/approvals/:approvalId
     @perm   proposals.proposals.approve* AND being the named approver (or a delegate) · internal comments proposals.comments.internal.read
     @api    GET /proposals/:id/approvals/:approvalId · POST /proposals/:id/approvals/:approvalId/decision {decision: APPROVED|REJECTED|CHANGES_REQUESTED, comment}
     @mcp    proposals_proposals_approve (sensitive: human confirmation, never auto-approved by an AI caller)
     @data   ProposalApproval (step, decision, comment, rule_id, requested_at, decided_at) · ProposalVersion (status) · Proposal (status) · ProposalApprovalRule (name, conditions) · ProposalComment
     @ui     Card, Stepper, ToggleGroup (decision), Textarea (comment required for REJECTED and CHANGES_REQUESTED), AlertDialog (confirm)
     @states loading · already decided · not your step yet (earlier step pending) · version superseded (approval void) · error · no-access
     @audit  approval decision (version, step, rule) · ProposalEvent APPROVED
     @note   Approving v3 does not approve v4. When the last step is APPROVED the version becomes APPROVED and the proposal APPROVED; any REJECTED returns it to DRAFT with the comment; CHANGES_REQUESTED keeps it IN_REVIEW for the owner.
     ===================================================================================================================== */
  function approval() {
    return '<div class="a-page">' + head("Approve proposal", "PR-2041 Acme Rebrand phase 2 · v3 · step 1 of 2 · Finance", btn("Open full proposal", "file") + btn("Compare with sent v2", "layers")) +
      '<div class="dc-split r"><div class="stack">' + cd("<b>Why you are asked</b>", callout("shield", "Rule <b>Discount over 5%</b> (discount_percent ≥ 5) matched on line “Marketing website redesign”. Requested by Anna Meyer on Nov 10: “Discount at the limit; please check Terms and Pricing.”", "warn")) +
      cd("<b>Your decision</b>", '<div class="dc-opts">' + opt("check", "Approve", "The version can go to the next step or be sent", 1) + opt("edit", "Request changes", "Back to the owner, chain stays open", 0) + opt("x", "Reject", "Return to draft with your comment", 0) + "</div>" + gap() + f("Comment", area("Discount is within policy for a multi-year care plan. Approved.", 80), "Required for Request changes and Reject. Internal: never shown to the customer.") + foot(btn("Cancel") + btn("Submit decision", "check", "primary"))) +
      cd("<b>Pricing at a glance</b>", '<table><thead><tr><th>Item</th><th class="num">Net</th><th class="num">Disc.</th></tr></thead><tbody><tr><td>Brand identity refresh</td><td class="num money">' + eur(18000) + '</td><td class="num">—</td></tr><tr><td>Marketing website redesign</td><td class="num money">' + eur(22800) + '</td><td class="num"><span class="badge yellow">5%</span></td></tr><tr><td>Maintenance plan (12 mo)</td><td class="num money">' + eur(7200) + '</td><td class="num">—</td></tr></tbody></table>', 1) + "</div>" +
      '<div class="stack">' + cd("<b>Chain · v3</b>", '<div class="rowx"><div class="grow"><b>1 Finance · Elena Papadaki</b><small>you · pending</small></div>' + E("PENDING", "blue") + '</div><div class="rowx"><div class="grow"><b>2 Executive · Petros Rodinos</b><small>waits for step 1</small></div>' + E("PENDING") + "</div>", 1) + cd("<b>Internal comments</b>", '<div class="rowx"><div class="grow"><b>Discount at the limit</b><small>Anna Meyer · Nov 10 · Pricing</small></div></div><div class="rowx"><div class="grow"><b>Check warranty wording with Legal</b><small>Elena Papadaki · Nov 10 · Terms</small></div></div>', 1) + "</div></div>" +
      dm(["ProposalApproval · step, decision, comment, rule_id, requested_at, decided_at", "ProposalApprovalRule · name, conditions · ProposalVersion · status · ProposalComment"], []) + "</div>";
  }

  /* =====================================================================================================================
     COMMENTS & FEEDBACK (spec "Proposal Review", "Customer Approval")
     @screen Proposals / Comments and feedback threads
     @route  /proposals/:proposalId/comments?version=&section=&state=open|resolved&visibility=internal|customer
     @perm   VIEW proposals.proposals.read · internal comments proposals.comments.internal.read · post proposals.proposals.update · resolve proposals.proposals.update
     @api    GET /proposals/:id/comments?version=&section_id=&resolved= · POST /proposals/:id/comments {section_id?, version_id, body, is_internal} · PATCH /proposals/:id/comments/:cid {resolved}
     @mcp    proposals_proposals_read · proposals_proposals_update
     @data   ProposalComment (proposal_id, version_id, section_id, author_membership_id | author_user_id | author_contact_id, is_internal, body, resolved_at) · ProposalSection (title) · ProposalEvent COMMENTED
     @ui     Tabs (Customer feedback / Internal), Select (section filter), Checkbox (resolved), Textarea composer with visibility switch, Avatar
     @states loading · empty ("No feedback yet") · error · no-access (internal tab hidden without the key)
     @audit  comment added · resolved / reopened · ProposalEvent COMMENTED for customer comments
     @note   Customer comments (author_contact_id) arrive from the public page and are never internal. Internal comments are enforced on the server. A reply sets ProposalComment.parent_comment_id (same proposal, same visibility); a thread is the root comment and its replies.
     ===================================================================================================================== */
  function comments() {
    const th2 = (a, n, s, t, b, cls, ex) => '<div class="dc-th ' + (cls || "") + '">' + av(a) + '<div class="bd"><b>' + n + "</b><small>" + s + "</small><p>" + b + "</p>" + (ex || "") + "</div>" + t + "</div>";
    return '<div class="a-page">' + head("Comments & feedback", "PR-2041 Acme Rebrand phase 2 · v2 sent, v3 draft", sel("All sections", "layers") + sel("Version: all", "layers")) +
      '<div class="tabset">' + tabs([["c", "Customer feedback", 3], ["i", "Internal", 2], ["r", "Resolved", 4]], "c") +
      pane("c", 1, '<div class="dc-split r"><div class="cd"><div class="cd-b flush">' + th2("AM", "Lena Kovac", "customer · Timeline · v2 · yesterday", btn("Resolve", "", "sm"), "The phase 2 end date clashes with our freeze period from Dec 18. Can we start a week later?", "") + th2("AM", "Lena Kovac", "customer · CMS training workshop · yesterday", btn("Resolve", "", "sm"), "We would like 3 days of training instead of 2.", "") + th2("AM", "Marc Dupont", "customer · Pricing · Nov 9", btn("Resolve", "", "sm"), "Is the maintenance plan billed monthly or yearly in advance?", "") + "</div></div>" +
        '<div class="stack">' + cd("<b>Reply</b>", f("Section", sel("Timeline")) + area("", 70) + '<div class="rowx" style="padding-left:0"><div class="grow"><b>Visible to the customer</b><small>The reply appears on the public page</small></div>' + sw(0) + "</div>" + foot(btn("Post reply", "send", "primary"))) + "</div></div>") +
      pane("i", 0, '<div class="cd"><div class="cd-b flush">' + th2("AM", "Anna Meyer", "internal · Pricing · Nov 10", btn("Resolve", "", "sm"), "Discount on the redesign is at our 5% limit.", "int") + th2("EP", "Elena Papadaki", "internal · Terms · Nov 10", btn("Resolve", "", "sm"), "Check the warranty wording with Legal before we send.", "int") + "</div></div>") +
      pane("r", 0, '<div class="cd"><div class="cd-b flush">' + th2("AM", "Lena Kovac", "customer · Scope · Nov 8 · resolved Nov 9", btn("Reopen", "", "sm"), "Does the scope include the blog migration?", "res") + th2("AM", "Anna Meyer", "internal · Terms · Nov 8", btn("Reopen", "", "sm"), "Add the standard 90 day warranty.", "int res") + "</div></div>") + "</div>" +
      dm(["ProposalComment · proposal_id, version_id, section_id, parent_comment_id, author_membership_id, author_user_id, author_contact_id, is_internal, body, resolved_at", "ProposalSection · title · ProposalEvent COMMENTED"], []) + "</div>";
  }

  /* =====================================================================================================================
     CONVERT ACCEPTED PROPOSAL (spec "Conversion to Project", "Customer Approval")
     @screen Proposals / Convert accepted proposal
     @route  /proposals/:proposalId/convert
     @perm   proposals.proposals.convert* + the create key of each target: contracts.contracts.create (04), projects.projects.create (05), finance.invoices.create (08), tasks.tasks.create (06)
     @api    GET /proposals/:id/convert/preview -> what each owner module would create · POST /proposals/:id/convert {contract?{template_id}, project?{type_id, template_id, manager_membership_id}, invoice?{schedule_item_ids[]}, subscription?, tasks?}
             (one request, each target created by its owning module's service; partial failures are reported per target)
     @mcp    proposals_proposals_convert (sensitive: human confirmation)
     @data   Proposal (status ACCEPTED, accepted_version_id, contract_id, converted_project_id, invoice_id, subscription_id, converted_at) · ProposalLineItem / ProposalPaymentScheduleItem (accepted version) · Contract (04) · Project (05) · Invoice, Subscription (08)
     @ui     Card, Checkbox per target, Popover+Command (templates, manager), Table (preview), Alert, Progress (running), AlertDialog (confirm)
     @states loading · not ACCEPTED (blocked) · already converted (shows links) · partial success · error per target · no-access per target
     @audit  proposal converted (targets and created ids) · ProposalEvent CONVERTED
     @note   This module only LINKS: the contract, project and invoice are created by 04, 05 and 08 from the ACCEPTED version, with the accepted optional items. Re-running is idempotent (links already stored are skipped).
     ===================================================================================================================== */
  function convert() {
    const tg = (ic, t, s, on, body) => '<div class="cd"><div class="cd-h">' + cb(on) + "<b>" + t + "</b><span class='r muted'>" + s + '</span></div><div class="cd-b">' + body + "</div></div>";
    return '<div class="a-page">' + head("Convert accepted proposal", "PR-2036 Maintenance plan · Acme Corp · accepted Nov 2 (v1) · " + eur(71424), btn("Cancel") + btn("Convert selected", "zap", "primary")) +
      '<div class="dc-split r"><div class="stack">' +
      tg("pen", "Create contract", "04 · contracts.contracts.create", 1, g2(f("Template", sel("Maintenance agreement v5")), f("Type", sel("Maintenance"))) + '<div class="sub-note">Stores Contract.proposal_id and proposal_version_id. Parties, value and renewal come from the accepted version.</div>') +
      tg("folder", "Create project", "05 · projects.projects.create", 1, g3(f("Project type", sel("Retainer")), f("Template", sel("Care plan")), f("Manager", sel("Kim Lund", "users"))) + '<div class="sub-note">Milestones from the proposal become project milestones; accepted optional items become tasks.</div>') +
      tg("receipt", "Create invoices", "08 · finance.invoices.create", 1, '<table><thead><tr><th></th><th>Payment</th><th>Trigger</th><th class="num">Amount</th></tr></thead><tbody><tr><td>' + cb(1) + "</td><td>Deposit</td><td>" + E("ON_ACCEPTANCE") + '</td><td class="num money">' + eur(21427) + "</td></tr><tr><td>" + cb(0) + "</td><td>Design approved</td><td>" + E("ON_MILESTONE") + '</td><td class="num money">' + eur(21427) + "</td></tr><tr><td>" + cb(0) + "</td><td>Launch</td><td>" + E("ON_DELIVERY") + '</td><td class="num money">' + eur(28570) + "</td></tr></tbody></table><div class=\"sub-note\" style=\"margin-top:6px\">Only ON_ACCEPTANCE payments invoice now; the others are created when their trigger fires.</div>") +
      tg("zap", "Start subscription", "08", 1, kv("Recurring", eur(5952) + " / month · 12 months") + '<div class="sub-note">From ProposalLineItem.is_recurring lines.</div>') + "</div>" +
      '<div class="stack">' + cd("<b>Already linked</b>", '<div class="rowx"><div class="grow"><b>Deal</b><small>Acme Maintenance 2027 · won</small></div>' + E("WON", "green") + '</div><div class="rowx"><div class="grow"><b>Contract</b><small>not created</small></div></div><div class="rowx"><div class="grow"><b>Project</b><small>not created</small></div></div>', 1) + callout("lock", "Conversion uses the <b>accepted version</b> v1 with the optional items Lena selected, never the current draft.") + "</div></div>" +
      dm(["Proposal · status, accepted_version_id, contract_id, converted_project_id, invoice_id, subscription_id, converted_at", "ProposalLineItem · selected_by_customer, is_recurring · ProposalPaymentScheduleItem · trigger", "Contract (04) · Project (05) · Invoice, Subscription (08) · created by their owners"], []) + "</div>";
  }

  /* =====================================================================================================================
     AI PROPOSAL ASSISTANT — generation and review detail (spec "AI Proposal Generation", "AI Assistance")
     @screen Proposals / AI assistant
     @route  /proposals/:proposalId/ai?run=<runId>
     @perm   proposals.ai.generate (+ proposals.proposals.update to apply drafts) · requires an ACTIVE OpenAI IntegrationConnection of the organization (BYOK)
     @api    POST /proposals/:id/ai/generate {sections[], tone, language, sources[], brief} · POST /proposals/:id/ai/improve {section_id, action: improve|simplify|translate|shorten} · POST /proposals/:id/ai/review -> ProposalAiFinding[] · PATCH /proposals/:id/ai/findings/:fid {status: ACCEPTED|DISMISSED, resolution_note?} · POST /proposals/:id/ai/apply {section_id, draft}
     @mcp    proposals_ai_generate (returns a draft only)
     @data   ProposalVersion (is_ai_generated, ai_metadata{model, prompt_hash, sources}) · ProposalAiFinding (version_id, section_id, kind ProposalAiFindingKind, severity, message, recommendation, status ProposalAiFindingStatus, review_run_id, reviewed_by_membership_id, reviewed_at, resolution_note) · ProposalSection (is_ai_generated, body) · CrmDeal / Project / CrmCompany (read as sources) · IntegrationConnection (OPENAI)
     @ui     Card, Checkbox (sources, sections), ToggleGroup (tone), Textarea, Tabs (Draft / Findings), Diff view before apply, Badge "AI draft"
     @states loading (streaming) · not connected (explains Admin > Integrations > OpenAI) · rate/quota error · empty findings ("No issues found") · no-access
     @audit  AI generation run (model, sources, who) · draft applied to a section
     @note   Drafts are NEVER applied automatically and never sent without a human accepting them. Findings are ProposalAiFinding rows (kind, severity, message, recommendation, status OPEN | ACCEPTED | DISMISSED, reviewed_by_membership_id, resolution_note) pointing at a section; accepting or dismissing is recorded on the row. No customer personal data is sent beyond the deal, project and notes the user ticked.
     ===================================================================================================================== */
  function ai() {
    const fi = (t, s, sev, st) => '<div class="rowx" style="align-items:flex-start"><span class="muted">' + I("sparkles", 14) + '</span><div class="grow"><b>' + t + "</b><small>" + s + "</small></div>" + E(sev, sev === "HIGH" ? "red" : "yellow") + (st ? E(st) : btn("Apply fix", "", "sm") + btn("Dismiss", "", "sm")) + "</div>";
    return '<div class="a-page">' + head("AI assistant", "PR-2041 · v3 draft · all output is a draft until you accept it", btn("Run history", "clock") + btn("Generate", "sparkles", "primary")) +
      '<div class="dc-split r"><div class="stack">' +
      cd("<b>Generate content</b><span class='r muted'>proposals.ai.generate</span>", f("Sections to generate", chips(["Executive summary", "Requirements", "Solution", "Scope", "Deliverables", "Timeline", "Assumptions", "Exclusions", "Warranty"], ["Executive summary", "Warranty", "Assumptions"])) + g3(f("Tone", sel("Professional, warm")), f("Language", sel("English")), f("Length", sel("Concise"))) + f("Sources the model may read", '<div class="rowx" style="padding-left:0">' + cb(1) + '<div class="grow"><b>Deal “Acme Rebrand phase 2”</b><small>notes, products, value (02)</small></div></div><div class="rowx" style="padding-left:0">' + cb(1) + '<div class="grow"><b>Past proposals for Acme</b><small>PR-2036, PR-1987 (accepted)</small></div></div><div class="rowx" style="padding-left:0">' + cb(0) + '<div class="grow"><b>Meeting notes</b><small>Documents (17)</small></div></div>') + f("Extra instructions", area("Mention the freeze period from Dec 18 and keep the warranty to 90 days.", 70))) +
      cd("<b>Draft: Warranty</b><span class='r'><span class='badge purple'>" + I("sparkles", 11) + " AI draft</span></span>", '<div class="dc-diff"><div class="dc-add"><span class="m">+</span><span>Warranty. For 90 days after launch we fix defects in delivered work at no charge. The warranty does not cover changes made by third parties or new requirements.</span></div></div>' + foot(btn("Regenerate", "sparkles") + btn("Discard") + btn("Insert as section", "plus", "primary"))) + "</div>" +
      '<div class="stack">' + cd("<b>Review before sending</b><span class='r'><span class='badge yellow'>3</span></span>", fi("Timeline conflicts with milestone dates", "Timeline · AI recommendation", "MEDIUM") + fi("No warranty period stated", "Terms · AI recommendation", "HIGH") + fi("Training day rate differs from catalog", "Pricing · AI recommendation", "MEDIUM", "DISMISSED"), 1) +
      cd("<b>Run details</b>", kv("Model", "OpenAI gpt-4.1 · your key") + kv("Connection", "<span class='badge green'>Active</span> Admin > Integrations") + kv("Tokens", "6.1k in · 1.8k out") + kv("Started by", "Anna Meyer") + kv("Run stored in", "ProposalVersion.ai_metadata") + kv("Findings in", "ProposalAiFinding")) + callout("lock", "Nothing here is sent to the customer until you apply it and send the version.") + "</div></div>" +
      dm(["ProposalVersion · is_ai_generated, ai_metadata", "ProposalAiFinding · version_id, section_id, kind, severity, message, recommendation, status, review_run_id, reviewed_by_membership_id, resolution_note", "ProposalSection · is_ai_generated, body · CrmDeal · Project · IntegrationConnection (provider OPENAI)"], []) + "</div>";
  }

  /* =====================================================================================================================
     TRACKING FEED (spec "Proposal Tracking")
     @screen Proposals / Tracking (all customer activity)
     @route  /proposals/tracking?type=&proposal=&from=&to=&contact=
     @perm   proposals.proposals.read (IP/user agent of customer events only for staff holding it) · export proposals.proposals.export*
     @api    GET /proposal-events?type=&proposal_id=&contact_id=&from=&to=&cursor= · GET /proposal-deliveries?status=&channel=
     @mcp    proposals_proposals_read
     @data   ProposalEvent (type ProposalEventType, actor_user_id, actor_contact_id, ip_address, user_agent, metadata, created_at, version_id) · ProposalDelivery (channel, status, failed_reason) · Proposal (number, title) · CrmContact
     @ui     Table (server-side), Popover+Command filters, ToggleGroup (Events / Deliveries), Badge
     @states loading · empty · error · no-access
     @audit  none (read-only)
     @note   Staff get "hot" signals: repeated views, a download, a view after expiry. Customer IP and device are personal data: shown only to staff with read access, never exported without proposals.proposals.export*.
     ===================================================================================================================== */
  function tracking() {
    const R = [["VIEWED", "PR-2041", "Lena Kovac", "v2", "2h ago", "4 min on page · Safari · EL"], ["OPTIONAL_ITEM_TOGGLED", "PR-2041", "Lena Kovac", "v2", "yesterday", "CMS training workshop on"], ["COMMENTED", "PR-2041", "Lena Kovac", "v2", "yesterday", "on Timeline"], ["VIEWED", "PR-2038", "Dimitra A. (Hooli)", "v2", "1d ago", "6 min · Chrome · US"], ["DOWNLOADED", "PR-2038", "Dimitra A. (Hooli)", "v2", "1d ago", "PDF"], ["CHANGES_REQUESTED", "PR-2038", "Dimitra A. (Hooli)", "v2", "1d ago", "Reduce the data migration scope"], ["SENT", "PR-2040", "Anna Meyer", "v1", "2d ago", "EMAIL + LINK"], ["VIEWED", "PR-2031", "Bob W. (Wonka)", "v1", "Nov 4", "after expiry · read-only"]];
    return '<div class="a-page">' + head("Tracking", "What customers did with your proposals, newest first.", btn("Export", "file")) +
      '<div class="mini-stats">' + stat("Views today", 7, "4 proposals") + stat("Hot proposals", 2, "3+ views in 24h") + stat("Not opened", 2, "sent over 3 days ago", 1) + stat("Delivery failures", 1, "mailbox full", 1) + "</div>" +
      views([["Events", 86], ["Deliveries", 34], ["Failures", 1]], "Events") + '<div class="toolbar">' + search("Search proposal, contact…") + sel("Sort: Newest", "sort") + sel("Columns (6)", "settings") + "</div>" +
      FB([["Type", "is any of", "Viewed, Downloaded, Commented"], ["Date", "after", "Nov 1"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      tbl(["Event", "Proposal", "Actor", "Version", "When", "Detail"], R.map((r) => [E(r[0], r[0] === "VIEWED" ? "blue" : r[0] === "CHANGES_REQUESTED" ? "yellow" : ""), mono(r[1]), r[2], '<span class="mono">' + r[3] + "</span>", '<span class="muted">' + r[4] + "</span>", '<span class="muted">' + r[5] + "</span>"])) + pager("1–8 of 86") +
      dm(["ProposalEvent · type, actor_user_id, actor_contact_id, ip_address, user_agent, metadata, version_id, created_at", "ProposalDelivery · channel, status, failed_reason · Proposal · CrmContact"], []) + "</div>";
  }

  /* =====================================================================================================================
     TEMPLATES LIST (spec "Reusable Templates")
     @screen Proposals / Templates
     @route  /proposals/templates?status=active|archived&type=&language=&q=
     @perm   VIEW proposals.proposals.read · create/edit/archive proposals.templates.manage · approval rules proposals.approval_rules.manage*
     @api    GET /proposal-templates?archived=&work_type=&language= · POST /proposal-templates · POST /proposal-templates/:id/duplicate|archive|set-default
     @mcp    proposals_templates_manage
     @data   ProposalTemplate (name, slug, description, work_type, language, default_validity_days, is_default, version, archived_at, sections JSON) · ProposalApprovalRule (name, conditions, steps, priority, enabled)
     @ui     Table, saved-view tabs, Popover+Command filters, DropdownMenu (row actions), Switch (rule enabled)
     @states loading · empty ("Create your first template") · error · no-access
     @audit  template created / new version / archived / default changed · rule changed
     @note   Exactly one default template per work type (service-enforced). A proposal records the template version it came from: editing a template never changes existing proposals.
     ===================================================================================================================== */
  function templates() {
    const T = [["Website development", "Website", "en", 13, 30, "v4", 1, 42], ["Web application", "Web app", "en", 14, 30, "v2", 0, 11], ["Mobile application", "Mobile app", "en", 14, 30, "v1", 0, 6], ["Maintenance & support", "Maintenance", "en", 9, 14, "v3", 0, 19], ["Consulting", "Consulting", "en", 8, 14, "v1", 0, 4], ["Website development (EL)", "Website", "el", 13, 30, "v1", 0, 5]];
    return '<div class="a-page">' + head("Proposal templates", "Reusable structure, branding and dynamic content per type of work.", btn("Import", "box") + btn("New template", "plus", "primary")) +
      views([["Active", 6], ["Archived", 2], ["Mine", 3]], "Active") + '<div class="toolbar">' + search("Search templates…") + sel("Work type: any") + sel("Language: any", "globe") + sel("Sort: Name", "sort") + "</div>" +
      tbl(["Template", "Work type", "Language", ">Sections", ">Validity", "Version", ">Used", ""], T.map((t) => ['<a onclick="location.hash=\'#proposals/template\'" style="cursor:pointer">' + I("layers", 15) + " " + ink(t[0]) + "</a>" + (t[6] ? ' <span class="badge green">Default</span>' : ""), t[1], t[2].toUpperCase(), t[3], t[4] + " days", '<span class="mono">' + t[5] + "</span>", t[7], more])) +
      gap(14) + cd("<b>Approval rules</b><span class='r'>" + btn("New rule", "plus", "sm") + "</span>", '<div class="rowx" onclick="location.hash=\'#proposals/rule\'" style="cursor:pointer"><div class="grow"><b>Discount over 5%</b><small>discount_percent > 5 → Finance · priority 1</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Value over €50k</b><small>gross_total ≥ 50,000 → Executive · priority 2</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Custom payment schedule</b><small>payment terms edited → Finance · priority 3</small></div>' + sw(0) + "</div>", 1) +
      dm(["ProposalTemplate · name, slug, work_type, language, default_validity_days, is_default, version, archived_at, sections", "ProposalApprovalRule · name, conditions, steps, priority, enabled", "Proposal · template_id (usage count)"], []) + "</div>";
  }

  /* =====================================================================================================================
     TEMPLATE EDITOR — create and edit (spec "Reusable Templates", "Dynamic Proposal Content")
     @screen Proposals / Template editor
     @route  /proposals/templates/new · /proposals/templates/:templateId
     @perm   proposals.templates.manage
     @api    POST /proposal-templates · PATCH /proposal-templates/:id {name, description, work_type, language, branding, layout, sections[], defaults, variables[], default_validity_days, is_default} (every save bumps `version`) · POST /proposal-templates/:id/preview {sample}
     @mcp    proposals_templates_manage
     @data   ProposalTemplate (name, slug, description, work_type, language, branding JSON, layout JSON, sections JSON [{type, title, body, is_internal}], defaults JSON, variables JSON, default_validity_days, is_default, version, archived_at)
     @ui     Tabs (Structure / Variables / Branding / Defaults / Preview), sortable list (dnd-kit), Tiptap, Popover+Command (variable picker), ColorPicker, Switch, iframe preview
     @states loading · validation inline · saved (new version number) · conflict 409 · unknown variable warning · no-access
     @audit  template created · new version saved (what changed) · default changed · archived
     @note   `variables` declare the allowed placeholders and their source (customer.*, project.*, proposal.*, company.*); an undeclared placeholder in a section is a validation error. Branding falls back to Organization.branding when empty.
     @note   Every save that changes content writes a ProposalTemplateVersion snapshot (version_number, sections, defaults, variables, branding, layout, default_validity_days, change_summary); ProposalTemplate holds the working copy and `version` is the number of its latest snapshot. ProposalVersion.template_version points at the snapshot used.
     ===================================================================================================================== */
  function template(s) {
    const isNew = s === "template-new";
    const SECS = [["COVER", "Cover", 0], ["EXECUTIVE_SUMMARY", "Executive summary", 0], ["REQUIREMENTS", "Requirements", 0], ["SOLUTION", "Proposed solution", 0], ["SCOPE", "Scope of work", 0], ["DELIVERABLES", "Deliverables", 0], ["TIMELINE", "Timeline", 0], ["PRICING", "Pricing", 0], ["PAYMENT_SCHEDULE", "Payment schedule", 0], ["ASSUMPTIONS", "Assumptions", 0], ["EXCLUSIONS", "Exclusions", 0], ["TERMS", "Terms & conditions", 0], ["SIGNATURE", "Acceptance", 0], ["CUSTOM", "Internal pricing notes", 1]];
    return '<div class="a-page">' + head(isNew ? "New template" : "Website development", isNew ? "Define structure, variables and defaults." : "Template · version 4 · used by 42 proposals · saving creates version 5", btn("Cancel") + btn("Preview", "globe") + btn(isNew ? "Create template" : "Save new version", "check", "primary")) +
      '<div class="tabset">' + tabs([["s", "Structure"], ["v", "Variables"], ["b", "Branding"], ["d", "Defaults"], ["p", "Preview"], ["h", "History", 4]], "s") +
      pane("s", 1, '<div class="dc-split r"><div class="stack">' + cd("<b>Details</b>", g3(f("Name", val(isNew ? "" : "Website development")), f("Work type", sel("Website")), f("Language", sel("English"))) + f("Description", area(isNew ? "" : "Marketing sites and rebuilds on a headless CMS.", 60)) + g3(f("Default validity", val("30 days")), f("Slug", val("website-development"), "Unique per organization"), f("Make default for “Website”", sw(1)))) +
        cd("<b>Sections</b><span class='r'>" + btn("Add section", "plus", "sm") + "</span>", SECS.map((x, i) => '<div class="rowx"><span class="muted">' + I("menu", 13) + '</span><div class="grow"><b>' + x[1] + "</b><small>" + E(x[0]) + (i === 1 ? " · body uses {{customer.name}}, {{project.name}}" : "") + "</small></div>" + (x[2] ? '<span class="badge yellow">' + I("lock", 11) + " Internal</span>" : "") + btn("Edit", "", "sm") + more + "</div>").join(""), 1) + "</div>" +
        '<div class="stack">' + cd("<b>Section: Executive summary</b>", f("Title", val("Executive summary")) + f("Type", sel("EXECUTIVE_SUMMARY")) + f("Body", '<div class="editor" style="padding:10px;min-height:120px;color:var(--body);line-height:1.6">{{customer.name}} wants … We will deliver {{project.name}} in three phases. {{project.manager}} leads delivery.</div>') + '<div class="rowx" style="padding-left:0"><div class="grow"><b>Internal only</b><small>Never shown to the customer (is_internal)</small></div>' + sw(0) + "</div>") + "</div></div>") +
      pane("v", 0, cd("<b>Declared variables</b><span class='r'>" + btn("Add variable", "plus", "sm") + "</span>", '<table><thead><tr><th>Placeholder</th><th>Source</th><th>Required</th><th>Fallback</th><th></th></tr></thead><tbody>' + [["customer.name", "CrmContact.name", 1, "—"], ["company.name", "CrmCompany.name", 1, "—"], ["project.name", "Proposal.title", 1, "—"], ["proposal.number", "Proposal.number", 1, "—"], ["proposal.valid_until", "Proposal.valid_until", 1, "—"], ["project.manager", "Membership (owner)", 0, "our project manager"]].map((r) => '<tr><td class="mono">{{' + r[0] + "}}</td><td class=\"muted\">" + r[1] + "</td><td>" + sw(r[2]) + '</td><td class="muted">' + r[3] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table>", 1)) +
      pane("b", 0, cd("<b>Branding</b><span class='r muted'>empty = Organization.branding (01 §15)</span>", g3(f("Logo", '<div class="drop">' + I("clip", 14) + " Upload or inherit</div>"), f("Primary color", val("inherit")), f("Typography", sel("Inter / inherit"))) + f("Layout", chips(["Cover page", "Table of contents", "Page numbers", "Sticky summary on web view"], ["Cover page", "Page numbers", "Sticky summary on web view"])) + '<div class="sub-note">Stored in ProposalTemplate.branding and layout JSON. Used for the web view and the PDF.</div>')) +
      pane("d", 0, cd("<b>Defaults applied to new proposals</b>", g2(f("Payment terms", sel("Net 14")), f("Payment preset", sel("30 / 30 / 40 milestones"))) + g2(f("Default tax", sel("VAT 24%")), f("Requires contract", sw(1))) + f("Starter line items", chips(["Discovery workshop", "Design", "Development", "Project management", "Maintenance plan"], ["Design", "Development", "Project management"])))) +
      pane("h", 0, cd("<b>Version history</b><span class='r muted'>ProposalTemplateVersion</span>", tbl(["Version", "Change summary", "Saved by", "Saved", ""], [["v4 (current)", "Added warranty section", "Anna Meyer", "Nov 2", more], ["v3", "Payment preset 30 / 30 / 40", "Anna Meyer", "Sep 14", btn("Restore as draft", "", "sm")], ["v2", "New executive summary variables", "Petros R.", "Jun 3", btn("Restore as draft", "", "sm")], ["v1", "Initial template", "Petros R.", "Mar 11", btn("Restore as draft", "", "sm")]]) + '<div class="sub-note">Snapshots are immutable. Restoring copies one into the working draft and saving creates the next version number.</div>')) +
      pane("p", 0, cd("<b>Preview with sample data</b><span class='r'>" + sel("Sample: Acme Corp", "building") + "</span>", '<div class="dc-paper"><h1>Acme Rebrand phase 2</h1><div class="meta">Proposal PR-0000 · prepared for Lena Kovac, Acme Corp</div><hr><h3>Executive summary</h3><p>Acme Corp wants … We will deliver Acme Rebrand phase 2 in three phases. Anna Meyer leads delivery.</p></div>')) + "</div>" +
      dm(["ProposalTemplate · name, slug, description, work_type, language, branding, layout, sections, defaults, variables, default_validity_days, is_default, version, archived_at", "ProposalTemplateVersion · template_id, version_number, sections, defaults, variables, branding, layout, default_validity_days, change_summary, created_by_user_id", "Organization · branding (fallback)"], []) + "</div>";
  }

  /* =====================================================================================================================
     APPROVAL RULE — create and edit (spec "Proposal Review")
     @screen Proposals / Approval rule
     @route  /proposals/templates/rules/new · /proposals/templates/rules/:ruleId
     @perm   proposals.approval_rules.manage* (sensitive: it decides who must approve what)
     @api    POST /proposal-approval-rules · PATCH /proposal-approval-rules/:id {name, conditions, steps[], priority, enabled} · POST /proposal-approval-rules/test {proposal_id|sample} -> matched rules and steps
     @mcp    proposals_approval_rules_manage*
     @data   ProposalApprovalRule (name, conditions Json, steps Json [{step, approver: role|membership, label}], priority, enabled) · ProposalApproval.rule_id
     @ui     Rule builder (condition rows: field + operator + value via Select), sortable steps with Popover+Command approver picker, Switch, test panel
     @states loading · validation (circular or empty steps) · saved · no-access
     @audit  rule created / changed / enabled / disabled (before and after)
     @note   Evaluated in `priority` order when a version is submitted for review; every matching rule adds its steps (duplicate approvers merge). A change never affects approvals already requested: ProposalApproval keeps its rule_id.
     ===================================================================================================================== */
  function rule(s) {
    const isNew = s === "rule-new";
    const cond = (k, a, b, c) => '<div class="dc-cond"><span class="k">' + k + "</span>" + sel(a) + sel(b) + sel(c) + btn("", "x", "sm ghost") + "</div>";
    return '<div class="a-page">' + head(isNew ? "New approval rule" : "Rule: Discount over 5%", "Decides which approval steps a proposal version needs.", btn("Cancel") + btn("Save rule", "check", "primary")) +
      '<div class="dc-split r"><div class="stack">' + cd("<b>Rule</b>", g2(f("Name", val(isNew ? "" : "Discount over 5%")), f("Priority", val("1"), "Lower runs first")) + '<div class="rowx" style="padding-left:0"><div class="grow"><b>Enabled</b><small>Disabled rules are skipped</small></div>' + sw(1) + "</div>") +
      cd("<b>When</b><span class='r'>" + btn("Add condition", "plus", "sm") + "</span>", cond("if", "Discount percent", "is greater than", "5") + cond("and", "Work type", "is any of", "Website, Web app") + '<div class="sub-note">Fields: discount percent, discount amount, gross total, margin, customer, customer category, template, work type, payment terms edited, requires contract, optional items, currency. Combine with AND / OR groups.</div>') +
      cd("<b>Then require</b><span class='r'>" + btn("Add step", "plus", "sm") + "</span>", '<div class="dc-stepcard"><span class="n">1</span><div style="flex:1"><b class="ink">Finance</b><div class="sub-note">Role “Finance manager” · any member can approve</div></div>' + sel("Role") + more + '</div><div class="dc-stepcard"><span class="n">2</span><div style="flex:1"><b class="ink">Elena Papadaki</b><div class="sub-note">Specific member · delegate: Petros Rodinos</div></div>' + sel("Member") + more + "</div>") + "</div>" +
      '<div class="stack">' + cd("<b>Test the rule</b>", f("Proposal", sel("PR-2041 · v3", "file")) + kv("Matches", "<span class='badge green'>Yes</span>") + kv("Steps added", "Finance") + kv("Other rules", "Value over €50k → Executive") + btn("Run test", "zap", "sm")) + cd("<b>Usage</b>", kv("Matched last 90d", "11 versions") + kv("Avg decision time", "6 h") + kv("Rejected", "1"), 0) + "</div></div>" +
      dm(["ProposalApprovalRule · name, conditions, steps, priority, enabled", "ProposalApproval · rule_id (usage and decision time)"], []) + "</div>";
  }

  /* =====================================================================================================================
     ANALYTICS — PIPELINE & ENGAGEMENT (spec "Proposal Analytics")
     @screen Proposals / Analytics: funnel, aging, engagement, owners
     @route  /proposals/analytics/pipeline?from=&to=&owner=&type=&customer=
     @perm   proposals.analytics.read (values need finance-level visibility; owner breakdown limited to the caller's scope)
     @api    GET /proposals/analytics/funnel|aging|engagement|owners?from=&to=&group=
     @mcp    proposals_analytics_read
     @data   Proposal (status, gross_total, sent_at, first_viewed_at, accepted_at, rejected_at, expired_at, view_count, owner_membership_id, company_id, template_id) · ProposalEvent (VIEWED, DOWNLOADED, OPTIONAL_ITEM_TOGGLED) · ProposalApproval (decision time) · ProposalAcceptance (feedback)
     @ui     Card, Table, ToggleGroup, Recharts (funnel/bars), Popover+Command filters
     @states loading · empty · error · no-access
     @note   One definition each: conversion = accepted / sent in the period; time to view = first_viewed_at - sent_at; time to decide = accepted_at|rejected_at - sent_at; approval time = ProposalApproval decided_at - requested_at. Lost reasons are grouped by Proposal.lost_reason (ProposalLostReason).
     ===================================================================================================================== */
  function analyticsPipeline() {
    const fn = [["Created", 52, 100], ["Approved", 44, 85], ["Sent", 34, 65], ["Viewed", 28, 54], ["Accepted", 14, 27]];
    const ow = [["AM", 12, 7, "58%", eur(86400), "7 d"], ["SJ", 9, 3, "33%", eur(31200), "11 d"], ["NG", 8, 3, "38%", eur(38900), "9 d"], ["KL", 5, 1, "20%", eur(14880), "14 d"]];
    return '<div class="a-page">' + head("Proposal analytics", "Funnel, engagement and who closes what.", '<div class="seg"><button>30 days</button><button class="on">90 days</button><button>Year</button></div>' + btn("Export", "file")) +
      FB([["Period", "is", "Last 90 days"], ["Work type", "is any of", "Website, Web app"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="mini-stats">' + stat("Time to first view", "5 h", "median") + stat("Time to decide", "9 days", "median") + stat("Approval time", "6 h", "median") + stat("Revisions per proposal", "1.8", "versions sent") + stat("Expired unseen", 2, "never opened", 1) + "</div>" +
      '<div class="g2">' + cd("<b>Funnel</b><span class='r muted'>last 90 days</span>", '<div class="dc-funnel">' + fn.map((r) => '<div><span class="l">' + r[0] + '</span><span class="b" style="width:' + r[2] + '%">' + r[1] + "</span></div>").join("") + "</div>") +
      cd("<b>Aging of open proposals</b><span class='r muted'>days since sent</span>", [["0–3 days", 3, 30], ["4–7 days", 2, 20], ["8–14 days", 1, 12], ["15+ days", 2, 22]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i class="fc-best" style="width:' + r[2] * 3 + '%"></i></span><span class="v">' + r[1] + " · " + eur(r[2] * 1000) + "</span></div>").join("")) + "</div>" + gap() +
      cd("<b>By owner</b>", '<table><thead><tr><th>Owner</th><th class="num">Sent</th><th class="num">Accepted</th><th class="num">Conversion</th><th class="num">Accepted value</th><th class="num">Time to decide</th></tr></thead><tbody>' + ow.map((r) => "<tr><td>" + wh(r[0]) + '</td><td class="num">' + r[1] + '</td><td class="num">' + r[2] + '</td><td class="num">' + r[3] + '</td><td class="num money">' + r[4] + '</td><td class="num">' + r[5] + "</td></tr>").join("") + "</tbody></table>", 1) + gap() +
      '<div class="g2">' + cd("<b>Engagement before accepting</b>", kv("Avg views", "4.2") + kv("Opened optional items", "63%") + kv("Downloaded the PDF", "48%") + kv("Left a comment", "31%")) + cd("<b>Lost reasons</b><span class='r muted'>Proposal.lost_reason</span>", [["Price", 41], ["Timing", 22], ["Competitor", 18], ["Scope", 11], ["No decision", 8]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i class="fc-lost" style="width:' + r[1] * 2.4 + '%"></i></span><span class="v">' + r[1] + "%</span></div>").join("") + '<div class="sub-note">Free-text feedback of declined proposals stays on each proposal.</div>') + "</div>" +
      dm(["Proposal · status, lost_reason, gross_total, sent_at, first_viewed_at, accepted_at, rejected_at, expired_at, view_count, owner_membership_id, template_id", "ProposalEvent · type · ProposalApproval · requested_at, decided_at · ProposalAcceptance · feedback"], []) + "</div>";
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

  const MAP = { list, create, editor, send, customer, accept, signed, compare, "review-request": reviewRequest, approval, comments, convert, ai, tracking, templates, template, "template-new": template, rule, "rule-new": rule, analytics, "analytics-pipeline": analyticsPipeline };
  const CRUMB = { create: "New proposal", editor: "PR-2041", send: "Send PR-2041", customer: "Customer view", accept: "Customer decision", signed: "Customer states", compare: "Compare v2 and v3", "review-request": "Request review", approval: "Approve PR-2041", comments: "Comments", convert: "Convert PR-2036", ai: "AI assistant", tracking: "Tracking", template: "Website development", "template-new": "New template", rule: "Discount over 5%", "rule-new": "New rule", "analytics-pipeline": "Pipeline" };
  window.VIEWS.proposals = { html: function (s) { return (MAP[s || "list"] || MAP.list)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
