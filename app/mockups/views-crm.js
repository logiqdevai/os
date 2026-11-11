/* =====================================================================================================================
   CRM APP — module 02 (docs/features/02-crm-sales-management.md)
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma (module 02 tables: CrmCompany, CrmContact, CrmLead, CrmDeal, CrmDealLineItem, CrmDealContact, CrmDealStageHistory,
   CrmPipeline, CrmPipelineStage, CrmActivity, CrmNote, CrmLeadStatus/Source, CrmLifecycleStage, CrmImportJob, SavedView, Tag/Tagging, CustomField*).
   Enums are real values (CrmDealStatus, CrmCompanyType, CrmContactRole, CrmActivityType/Status, CrmPriority, CrmForecastCategory, CrmImportStatus), permission keys come from
   api/prisma/seed/permission-catalog.ts (crm.* keys). Sample configuration = the defaults of spec 02 §37 (pipeline "Sales", its 8 stages, lead statuses, sources).

   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   OWNERSHIP RULES THAT APPLY TO EVERY SCREEN HERE (do not repeat per element):
     - Tenant: organization comes from the credential/session, never from URL or body. Lists are filtered server-side by the caller's scope (branch/team) AND by record-level
       visibility (owner / team / branch), see CrmDeal.branch_id, CrmLead.branch_id, CrmCompanyBranch.
     - Financial values (deal value, revenue, invoices) need `crm.financials.read`; without it the numbers are HIDDEN (not zero, not masked) and totals show "—".
     - Private notes need `crm.notes.private.read`. Export needs `crm.records.export` (sensitive, audited as data.exported).
     - Tasks and follow-ups are NOT CRM activities: they live in Tasks (06) and are shown here as linked records. Proposals (03), Contracts (04), Projects (05), Invoices/Payments/
       Subscriptions (08), Tickets/Conversations (13), Documents (17) and Calendar events (19) are owned by their modules: link and read, never duplicate (docs/features/02 §1).
     - Sales teams are ordinary Teams (01 §40); record-level assignment uses owner_membership_id (+ account_manager / success_owner on companies).
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, S, head, btn, cd, sw, cb, sel, fld, stat, search, who, tok, kv, muted, more, callout, keyc, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const eur = (n) => "€" + Math.round(n).toLocaleString("en-US");
  const kfmt = (n) => (n >= 1000 ? "€" + (Math.round(n / 100) / 10).toLocaleString("en-US") + "k" : "€" + n);
  const pc = (n) => n + "%";
  const FC = { PIPELINE: ["Pipeline", "fc-pipeline", ""], BEST_CASE: ["Best case", "fc-best", "blue"], COMMIT: ["Commit", "fc-commit", "purple"], CLOSED_WON: ["Closed won", "fc-won", "green"], CLOSED_LOST: ["Closed lost", "fc-lost", "red"] };
  /* @impl fcBadge(): CrmForecastCategory -> Badge. Same value -> variant map everywhere (board, forecast, deal detail). */
  const fcBadge = (c) => '<span class="badge ' + FC[c][2] + '" title="' + c + '">' + FC[c][0] + "</span>";
  const dealStatus = (s) => S(s);
  const tile = (t, tone) => '<span class="pv ' + (tone || "") + '">' + t + "</span>";

  /* Sample configuration: spec 02 §37 defaults for pipeline "Sales". [name, probability, CrmForecastCategory, stale_after_days, is_won, is_lost] */
  const ST = [["New Opportunity", 10, "PIPELINE", 7], ["Discovery", 20, "PIPELINE", 14], ["Qualified", 40, "BEST_CASE", 14], ["Proposal", 60, "BEST_CASE", 10], ["Negotiation", 80, "COMMIT", 10], ["Verbal Agreement", 90, "COMMIT", 7], ["Closed Won", 100, "CLOSED_WON", null], ["Closed Lost", 0, "CLOSED_LOST", null]];
  /* name, company, value, owner [ini, color], expected close, stage index, days in stage, flags */
  const D = [
    ["Northwind CRM revamp", "Northwind", 18000, ["AM", ""], "Jan 20", 0, 3, ""],
    ["Hooli data platform", "Hooli", 52000, ["NG", "g"], "Feb 10", 0, 5, ""],
    ["Initech billing portal", "Initech", 24500, ["MS", "g"], "Dec 18", 1, 9, ""],
    ["Globex mobile app v3", "Globex", 88000, ["AM", ""], "Jan 30", 1, 21, ""],
    ["Umbrella brand strategy", "Umbrella Ltd", 15800, ["SJ", "y"], "Dec 05", 2, 6, ""],
    ["Acme maintenance plan", "Acme Corp", 57600, ["KL", "p"], "Dec 10", 2, 11, "recurring"],
    ["Acme Rebrand phase 2", "Acme Corp", 50400, ["AM", ""], "Dec 15", 3, 6, "proposal"],
    ["Stark integrations", "Stark Industries", 31000, ["NG", "g"], "Dec 22", 3, 13, ""],
    ["Wayne analytics suite", "Wayne Enterprises", 120000, ["PR", ""], "Nov 30", 4, 8, "contract"],
    ["Wonka e-commerce", "Wonka", 64200, ["AM", ""], "Nov 25", 5, 3, ""],
    ["Initech support retainer", "Initech", 36000, ["KL", "p"], "Nov 08", 6, 0, ""],
    ["Soylent redesign", "Soylent", 22000, ["SJ", "y"], "Oct 28", 7, 0, "lost"],
  ];

  /* =====================================================================================================================
     DASHBOARD (spec §32, §33)
     @route  /crm (default) · /crm/dashboard
     @perm   VIEW crm.dashboards.read · revenue numbers additionally need crm.financials.read · forecast widgets need crm.forecast.read
     @api    GET /crm/dashboard?pipeline_id=&team_id=&owner_id=&from=&to= (one aggregate call; every widget loads independently so a slow query never blocks the page)
     @mcp    crm_dashboards_read
     @data   CrmDeal (status, value, forecast_category, stage_id, expected_close_date, actual_close_date, stage_entered_at, owner_membership_id) · CrmPipelineStage (probability, stale_after_days) ·
             CrmLead (status_id, lead_source_id, created_at, converted_at, next_follow_up_at) · CrmActivity (next follow-ups, volume) · CrmDealStageHistory (cycle length, velocity)
     @ui     Card, Progress/bars (Recharts), Table, Badge, ToggleGroup (period), Select/Combobox (pipeline, team, owner)
     @states loading per widget · empty ("No deals yet": show the onboarding checklist: create pipeline, import, add first deal) · error per widget · no-access per widget
     @note   Win rate = won / (won + lost) in the period; sales cycle = avg(actual_close_date - created_at) of won deals; weighted pipeline = sum(value * stage probability) of OPEN deals (use
             CrmDeal.probability when set, else the stage default); stale = days since stage_entered_at > stage.stale_after_days. Define these formulas ONCE in the API and reuse in forecast and reports.
             Dashboards are customizable by role/team (§32): per-user layout is UserPreference.dashboard_layout; role/team defaults are CrmDashboardLayout rows (crm.dashboards.manage), resolved person > team > role > organization.
     ===================================================================================================================== */
  function dashboard() {
    const open = D.filter((d) => d[5] < 6), weighted = open.reduce((a, d) => a + d[2] * (ST[d[5]][1] / 100), 0), total = open.reduce((a, d) => a + d[2], 0);
    const byStage = ST.slice(0, 6).map((s, i) => [s[0], D.filter((d) => d[5] === i).reduce((a, d) => a + d[2], 0)]);
    const mx = Math.max.apply(null, byStage.map((x) => x[1]));
    const src = [["Referral", 38], ["Website", 27], ["Existing customer", 19], ["Partner", 11], ["Event", 5]];
    const stale = D.filter((d) => ST[d[5]][3] && d[6] > ST[d[5]][3]);
    return '<div class="a-page">' + head("Sales dashboard", "Pipeline, forecast and activity at a glance (§32). Scoped to what you may see.", '<div class="seg"><button>This month</button><button class="on">This quarter</button><button>This year</button></div>' + btn("Customize", "settings")) +
      /* @impl KPI cards: each links to the filtered list (e.g. Open deals -> /crm/deals?status=OPEN). Delta vs previous period computed by the API. Hide money cards without crm.financials.read. */
      '<div class="mini-stats">' + stat("Open pipeline", eur(total), D.filter((d) => d[5] < 6).length + " open deals") + stat("Weighted pipeline", eur(weighted), "by stage probability") + stat("Won this quarter", eur(36000 + 142000), "6 deals · +18%") + stat("Win rate", "34%", "+3 pts") + stat("Avg sales cycle", "41 days", "-5 days") + stat("Lead conversion", "22%", "of 148 new leads") + "</div>" +
      '<div class="g2">' +
      /* @impl Funnel: open value per stage (CrmPipelineStage order). Bars are width-normalized to the largest stage. Click a bar -> board filtered to that stage. */
      cd("<b>Pipeline by stage</b><span class='r muted'>open value</span>", byStage.map((s) => '<div class="bar-row"><span class="l">' + s[0] + '</span><span class="tr"><i class="fc-best" style="width:' + (s[1] / mx) * 100 + '%"></i></span><span class="v money">' + kfmt(s[1]) + "</span></div>").join("")) +
      cd("<b>Revenue by source</b><span class='r muted'>won, this quarter · CrmLeadSource</span>", src.map((s) => '<div class="bar-row"><span class="l">' + s[0] + '</span><span class="tr"><i class="fc-won" style="width:' + s[1] * 2.4 + '%"></i></span><span class="v">' + s[1] + "%</span></div>").join("")) +
      /* @impl Stale deals: OPEN deals whose time in stage exceeds the stage's stale_after_days. Shows owner and a "Nudge" action (creates a follow-up Task in module 06, not a CRM activity). */
      cd("<b>Stale deals</b><span class='r'><span class='badge yellow'>" + stale.length + " need attention</span></span>", stale.map((d) => '<div class="rowx"><div class="grow"><b>' + d[0] + "</b><small>" + d[1] + " · " + ST[d[5]][0] + " · " + d[6] + " days in stage (limit " + ST[d[5]][3] + ')</small></div><span class="money ink">' + kfmt(d[2]) + "</span>" + AV(d[3][0], d[3][1]) + "</div>").join(""), 1) +
      /* @impl Upcoming follow-ups: CrmActivity (status PLANNED, starts_at asc) + linked Tasks (06). Overdue first, in red. */
      cd("<b>Upcoming activities</b><span class='r muted'>CrmActivity · Tasks (06)</span>",
        '<div class="rowx">' + I("phone", 15) + '<div class="grow"><b>Call Lena Kovac</b><small>Acme Rebrand phase 2 · today 15:00</small></div>' + E("HIGH", "yellow") + '</div>' +
        '<div class="rowx">' + I("video", 15) + '<div class="grow"><b>Discovery meeting, Hooli</b><small>Hooli data platform · tomorrow 10:30</small></div>' + E("NORMAL") + '</div>' +
        '<div class="rowx">' + I("mail", 15) + '<div class="grow"><b>Send revised scope</b><small>Stark integrations · overdue 2 days</small></div>' + E("URGENT", "red") + "</div>", 1) +
      "</div>" +
      dm(["CrmDeal · status, value, probability, forecast_category, stage_id, expected_close_date, actual_close_date, stage_entered_at, owner_membership_id", "CrmPipelineStage · probability, forecast_category, stale_after_days", "CrmLead · status_id, lead_source_id, converted_at, next_follow_up_at", "CrmActivity · status, starts_at, priority", "CrmDealStageHistory · duration_seconds", "CrmSalesTarget · amount, period (coverage and attainment)", "CrmDashboardLayout · widgets, role_id, team_id (defaults by role or team)"], []) + "</div>";
  }

  /* =====================================================================================================================
     DEALS — PIPELINE BOARD (spec §8, §9, §29)
     @route  /crm/deals?pipeline=&view=board|list|forecast&owner=&team=&branch=&close=&q=  (view is also a SavedView: layout string)
     @perm   VIEW crm.deals.read · create crm.deals.create · edit crm.deals.update · drag to another stage crm.deals.change_stage · reassign crm.deals.assign · archive crm.deals.archive ·
             delete crm.deals.delete* · export crm.deals.export* · money hidden without crm.financials.read
     @api    GET /crm/pipelines (+stages) · GET /crm/deals?pipeline_id=&stage_id=&owner=&status=&cursor= (per column, cursor pagination) · GET /crm/deals/summary?pipeline_id= (column totals) ·
             POST /crm/deals · POST /crm/deals/:id/stage {stage_id, lost_reason?} (drag and drop)
     @mcp    crm_deals_read, crm_deals_create, crm_deals_change_stage
     @data   CrmPipeline · CrmPipelineStage (name, sort_order, probability, forecast_category, is_won, is_lost, stale_after_days, color) · CrmDeal (name, company_id, primary_contact_id, owner_membership_id,
             value, currency, probability, expected_close_date, stage_entered_at, status, forecast_category, next_step, branch_id) · SavedView (layout, filters, sorting, grouping, columns, visibility)
     @ui     Board with dnd-kit (keyboard + touch), Select (pipeline), ToggleGroup (view), Popover+Command (filters), Avatar, Badge, Card, DropdownMenu (card menu), Dialog+Form (create deal)
     @states loading skeleton columns · empty pipeline · error · no-access · drag error rollback toast · column "load more"
     @audit  crm deal events through the audit service (stage changed, owner changed, won, lost); stage moves ALSO write CrmDealStageHistory (from, to, duration_seconds) in the same transaction
     @note   Dropping on "Closed Won" sets status WON + actual_close_date and may trigger automation (create project from the deal, 05; send contract, 04) via module 20: the UI only shows the result.
             Dropping on "Closed Lost" REQUIRES a lost_reason (Dialog) and sets status LOST. Probability shown = deal.probability if set, else the stage probability. Column header numbers: open value and
             weighted value come from the API summary, not from the loaded cards. Stale (yellow edge) = time in stage > stage.stale_after_days. Pipelines are per team/organization: the selector lists only
             pipelines the caller may use (CrmPipeline.team_id). Moving across pipelines is a separate action (stage mapping dialog), not drag and drop.
     ===================================================================================================================== */
  function deals() {
    const cols = ST.map((s, i) => {
      const cards = D.filter((d) => d[5] === i);
      const sum = cards.reduce((a, d) => a + d[2], 0);
      return '<div class="kcol"><div class="kcol-h"><div class="t"><span class="dot" style="color:' + (i === 6 ? "var(--green)" : i === 7 ? "var(--red)" : "var(--stone)") + '"></span>' + s[0] + '<span class="count">' + cards.length + '</span><span style="flex:1"></span><button class="btn ghost sm icon">' + I("plus", 14) + '</button></div><div class="m"><b class="money">' + kfmt(sum) + "</b><span>" + (i < 6 ? "weighted " + kfmt(sum * s[1] / 100) + " · " + s[1] + "%" : i === 6 ? "won" : "lost") + "</span></div></div>" +
        '<div class="kcol-b">' + cards.map((d) => {
          const stale = s[3] && d[6] > s[3];
          return '<div class="kcard ' + (stale ? "stale" : i === 6 ? "won" : i === 7 ? "lost" : "") + '" onclick="location.hash=\'#crm/deal\'"><div class="n">' + d[0] + '</div><div class="co">' + I("building", 12) + d[1] + '</div><div class="v"><b class="money">' + eur(d[2]) + "</b><span>" + (i < 6 ? s[1] + "%" : "") + '</span></div><div class="f">' + AV(d[3][0], d[3][1]) + "<span>" + I("calendar", 12) + " " + d[4] + '</span><span class="sp"></span>' + (stale ? '<span class="badge yellow">' + d[6] + "d in stage</span>" : "") + (d[7] === "recurring" ? '<span class="badge">Recurring</span>' : "") + (d[7] === "proposal" ? '<span class="badge blue">Proposal sent</span>' : "") + (d[7] === "contract" ? '<span class="badge purple">Contract in review</span>' : "") + (d[7] === "lost" ? '<span class="badge red">Price</span>' : "") + "</div></div>";
        }).join("") + (cards.length ? "" : '<div class="kdrop">Drop deals here</div>') + "</div></div>";
    }).join("");
    const open = D.filter((d) => d[5] < 6);
    return '<div class="crm-bar">' +
      /* @impl Toolbar: pipeline Select (CrmPipeline), view ToggleGroup (Board / List / Forecast, §29), filters, and the open/weighted totals (from the summary endpoint). "Save view" persists layout+filters as a SavedView
           (PERSONAL | TEAM | ORGANIZATION). */
      sel("Sales pipeline", "layers").replace('class="sel"', 'class="sel" style="width:190px"') + '<div class="seg"><button class="on">Board</button><button>List</button><button>Forecast</button></div>' +
      '<button class="btn sm">' + I("filter", 13) + ' Owner</button><button class="btn sm">Team</button><button class="btn sm">Close date</button><button class="btn sm">Value</button><span class="grow"></span>' +
      '<span class="sub-note">Open <b class="ink money">' + eur(open.reduce((a, d) => a + d[2], 0)) + '</b> · weighted <b class="ink money">' + eur(open.reduce((a, d) => a + d[2] * ST[d[5]][1] / 100, 0)) + "</b></span>" + btn("Save view", "star", "sm") + btn("New deal", "plus", "primary sm") + "</div>" +
      '<div class="kb">' + cols + "</div>" +
      '<div class="a-page" style="padding-top:0">' + dm(["CrmPipeline · name, currency, team_id, is_default", "CrmPipelineStage · name, sort_order, probability, forecast_category, is_won, is_lost, stale_after_days", "CrmDeal · name, company_id, owner_membership_id, value, currency, probability, expected_close_date, stage_entered_at, status, next_step", "SavedView · entity_type CRM_DEAL, layout, filters, sorting, grouping, columns, visibility"], []) + "</div>";
  }

  /* =====================================================================================================================
     DEAL DETAIL (spec §9, §10, §11, §12, §34)
     @route  /crm/deals/:dealId?tab=overview|activity|notes|history
     @perm   VIEW crm.deals.read · edit crm.deals.update · stage crm.deals.change_stage · assign crm.deals.assign · line items & values need crm.financials.read · notes crm.notes.private.read (private only)
             create proposal: proposals.proposals.create (03) · create project/contract: their own keys, offered only when held
     @api    GET /crm/deals/:id (+line items, contacts, stage history, links) · PATCH /crm/deals/:id · POST /crm/deals/:id/stage · PUT /crm/deals/:id/line-items · POST /crm/deals/:id/contacts ·
             GET /crm/deals/:id/timeline (activities + notes + system events, cursor) · POST /crm/deals/:id/won|lost
     @mcp    crm_deals_read, crm_deals_update, crm_deals_change_stage
     @data   CrmDeal (all fields) · CrmDealLineItem (name, quantity, unit_price, discount_percent|amount, tax_percent, net_amount, tax_amount, gross_amount, is_recurring, billing_frequency, product_id) ·
             CrmDealContact (contact_id, role) · CrmDealStageHistory (from_stage_id, to_stage_id, changed_at, duration_seconds) · CrmActivity · CrmNote (entity_type CRM_DEAL) · Tagging · CustomFieldValue ·
             links by id: proposal_id (03), contract_id (04), project_id (05), Product (08 catalog)
     @ui     Tabs, Card, editable fields (inline edit with optimistic save), Table (line items, editable), Stepper (stage bar), Dialog (lost reason, won), DropdownMenu, Timeline list, rich text (Tiptap) for notes
     @states loading · not found · error · no-access · conflict 409 (someone else edited: reload prompt) · closed deal = read-only fields with "Reopen" action
     @audit  deal created/updated/stage changed/owner changed/won/lost/reopened
     @note   TOTALS ARE DERIVED: when line items exist, deal.value, one_time_value, recurring_value, discount_amount and tax_amount are recomputed by the API on every line-item change (§10), the client
             never sends totals. Line items reference the Finance catalog (Product, 08) but store their own price snapshot. "Create proposal" copies the line items into a Proposal (03) and stores
             proposal_id here; winning the deal can create the project (05) and invoice schedule (08) through automation (20). Stage history drives duration/velocity metrics.
     ===================================================================================================================== */
  function deal() {
    const li = [["Brand identity refresh", 1, 18000, 0, 24, 0], ["Marketing website redesign", 1, 24000, 5, 24, 0], ["CMS training (workshop)", 2, 1200, 0, 24, 0], ["Maintenance plan (12 months)", 12, 600, 0, 24, 1]];
    const net = li.map((l) => l[1] * l[2] * (1 - l[3] / 100)), nets = net.reduce((a, b) => a + b, 0);
    const gross = li.map((l, i) => net[i] * (1 + l[4] / 100));
    return '<div class="a-page">' +
      /* @impl Header: deal name (inline editable), status Badge (CrmDealStatus), company link -> Customer 360, owner Avatar (reassign needs crm.deals.assign), value, expected close. Actions: Mark won / Mark lost
           (Dialog, lost reason required), Create proposal (03), Edit. */
      '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + tile("AR", "purple") + '<div class="nm"><h2>Acme Rebrand phase 2 ' + dealStatus("OPEN") + fcBadge("BEST_CASE") + '</h2><div class="muted"><a style="text-decoration:underline;cursor:pointer" onclick="location.hash=\'#crm/company\'">Acme Corp</a> · owner Anna Meyer · Sales pipeline · expected close Dec 15 · ' + eur(nets) + ' net</div></div>' + btn("Mark lost", "x") + btn("Mark won", "check") + btn("Create proposal", "file", "primary") + "</div>" +
      /* @impl Stage bar = CrmPipelineStage rows of the deal's pipeline in sort_order. Click a stage to move (crm.deals.change_stage); moving to a lost stage asks for lost_reason. */
      '<div style="padding:4px 20px 18px"><div class="stagebar">' + ST.slice(0, 6).map((s, i) => '<div class="sg ' + (i < 3 ? "done" : i === 3 ? "now" : "") + '"><i></i><span>' + s[0] + "</span></div>").join("") + "</div></div></div>" +
      '<div class="tabset">' + tabs([["o", "Overview"], ["a", "Activity", 6], ["n", "Notes", 2], ["h", "Stage history"]], "o") +
      pane("o", 1, '<div class="crm-split"><div class="stack">' +
        '<div class="mini-stats" style="margin:0">' + stat("Value", eur(nets), "one-time " + eur(nets - 7200 * 1) + " · recurring " + eur(7200)) + stat("Probability", "60%", "stage Proposal") + stat("Forecast", "Best case", "weighted " + eur(nets * 0.6)) + stat("Time in stage", "6 days", "limit 10 days") + "</div>" +
        /* @impl Line items: CrmDealLineItem rows, editable inline (qty, unit price, discount %, VAT %). Net/gross are DISPLAYED from the API response. "Add from catalog" opens a Command over Product (08). Recurring rows show billing_frequency. */
        cd("<b>Line items</b><span class='r'>" + btn("Add item", "plus", "sm") + btn("From catalog", "box", "sm") + "</span>", '<table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Disc.</th><th class="num">VAT</th><th class="num">Net</th><th class="num">Gross</th><th></th></tr></thead><tbody>' +
          li.map((l, i) => "<tr><td><b class='ink' style='font-weight:500'>" + l[0] + "</b>" + (l[5] ? ' <span class="badge">Recurring · monthly</span>' : "") + '</td><td class="num">' + l[1] + '</td><td class="num money">' + eur(l[2]) + '</td><td class="num">' + (l[3] ? l[3] + "%" : "—") + '</td><td class="num">' + l[4] + '%</td><td class="num money">' + eur(net[i]) + '</td><td class="num money ink">' + eur(gross[i]) + "</td><td>" + more + "</td></tr>").join("") +
          '</tbody><tfoot><tr><td colspan="5" class="num muted">Totals</td><td class="num money ink">' + eur(nets) + '</td><td class="num money ink">' + eur(gross.reduce((a, b) => a + b, 0)) + "</td><td></td></tr></tfoot></table>", 1) +
        /* @impl Next step + description: CrmDeal.next_step (short text, shown on the board card tooltip) and description (rich text). */
        cd("<b>Next step</b>", '<div class="ink">Send revised scope and updated timeline to Lena (decision maker)</div><div class="sub-note" style="margin-top:4px">Updated 2 days ago · Anna Meyer</div>') +
        "</div><div class=\"stack\">" +
        /* @impl Contacts: CrmDealContact rows (+ the primary_contact_id) with CrmContactRole chips. A deal always has at most one primary contact. */
        cd("<b>Contacts</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", '<div class="rowx">' + who("LK", "p", "Lena Kovac", "Marketing Director") + '<span style="margin-left:auto">' + E("DECISION_MAKER", "purple") + '</span></div><div class="rowx">' + who("MD", "", "Marc Dupont", "Finance Lead") + '<span style="margin-left:auto">' + E("BILLING") + "</span></div>", 1) +
        /* @impl Related records (owned by other modules, read-only links; each link is shown only if the caller may read that module): proposal_id (03), contract_id (04), project_id (05, after won), invoices (08). */
        cd("<b>Related</b>", '<div class="rowx">' + I("file", 15) + '<div class="grow"><b>Proposal PR-2041</b><small>03 · sent Nov 8 · viewed 3×</small></div>' + S("SENT").replace("badge ", "badge blue ") + '</div><div class="rowx">' + I("pen", 15) + '<div class="grow"><b>Contract</b><small>04 · none yet</small></div>' + btn("Create", "", "sm") + '</div><div class="rowx">' + I("folder", 15) + '<div class="grow"><b>Project</b><small>05 · created when the deal is won</small></div></div>', 1) +
        cd("<b>Properties</b>", kv("Pipeline", "Sales") + kv("Deal type", "Existing customer · expansion") + kv("Lead source", "Existing customer") + kv("Competitor", "—") + kv("Branch", "Athens") + kv("Team", "Account Management") + kv("Secondary owner", "Kim Lund") + kv("Project manager", "Marco Silva") + kv("Tags", tok("rebrand") + " " + tok("priority"))) +
        "</div></div>") +
      pane("a", 0, callout("zap", "Calls, meetings, emails and reminders are <b>CrmActivity</b> rows. Follow-up tasks are Tasks (06) linked to this deal and shown here with a task icon.") + '<div style="height:12px"></div>' + cd("<b>Timeline</b>", '<div class="tl"><div class="ev"><b>Meeting: scope review with Lena</b><small>CrmActivity MEETING · COMPLETED · Nov 8 · 45 min</small></div><div class="ev"><b>Proposal PR-2041 sent</b><small>from 03 · Nov 8</small></div><div class="ev"><b>Moved to Proposal</b><small>from Qualified · Nov 5 · Anna Meyer</small></div><div class="ev"><b>Task: prepare revised scope</b><small>Tasks (06) · due Nov 14</small></div><div class="ev"><b>Call: discovery with Marc</b><small>CrmActivity CALL · COMPLETED · Oct 28</small></div></div>')) +
      pane("n", 0, cd("<b>Notes</b><span class='r'>" + btn("Add note", "plus", "sm") + "</span>", '<div class="rowx"><div class="grow"><b>Budget is approved, waiting on final scope</b><small>Anna Meyer · Nov 5 · pinned</small></div></div><div class="rowx"><div class="grow"><b>' + I("lock", 12) + " Private: discount authority is capped at 8%</b><small>Petros R. · Nov 2 · private (needs crm.notes.private.read)</small></div></div>", 1)) +
      /* @impl Stage history: CrmDealStageHistory rows, newest first, with duration in the previous stage (duration_seconds formatted). Used for velocity and "time in stage" metrics. */
      pane("h", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>When</th><th>From</th><th>To</th><th>By</th><th>Time in previous stage</th></tr></thead><tbody><tr><td>Nov 5</td><td>Qualified</td><td><b class="ink">Proposal</b></td><td>Anna Meyer</td><td>11 days</td></tr><tr><td>Oct 25</td><td>Discovery</td><td>Qualified</td><td>Anna Meyer</td><td>9 days</td></tr><tr><td>Oct 16</td><td>New Opportunity</td><td>Discovery</td><td>Anna Meyer</td><td>4 days</td></tr><tr><td>Oct 12</td><td>—</td><td>New Opportunity</td><td>Petros R.</td><td>—</td></tr></tbody></table></div>') + "</div>" +
      dm(["CrmDeal · name, status, value, one_time_value, recurring_value, discount_amount, tax_amount, probability, forecast_category, expected_close_date, next_step, competitor, lost_reason, owner_membership_id, secondary_owner_membership_id, project_manager_membership_id, proposal_id, contract_id, project_id", "CrmDealLineItem · name, quantity, unit_price, discount_percent, tax_percent, net_amount, gross_amount, is_recurring, billing_frequency, product_id", "CrmDealContact · role · CrmDealStageHistory · CrmActivity · CrmNote · Tagging"], []) + "</div>";
  }

  /* =====================================================================================================================
     LEADS (spec §4, §5, §6, §7)
     @route  /crm/leads?status=&source=&owner=&score=&q=  ·  /crm/leads/:leadId (detail, same pattern as deals)
     @perm   VIEW crm.leads.read · create crm.leads.create · edit crm.leads.update · assign crm.leads.assign · CONVERT crm.leads.convert · archive crm.leads.archive · export crm.leads.export*
     @api    GET /crm/leads?... · POST /crm/leads · PATCH /crm/leads/:id · POST /crm/leads/:id/convert {company: {existing_id|new}, contact: {existing_id|new}, deal?: {pipeline_id, stage_id, name, value}}
     @mcp    crm_leads_read, crm_leads_create, crm_leads_convert
     @data   CrmLead (name, company_name, contact_name, email, phone, status_id, lead_source_id, owner_membership_id, lead_score, manual_score, estimated_value, currency, qualification JSON, next_follow_up_at,
             last_activity_at, converted_at, converted_company_id, converted_contact_id, converted_deal_id, lost_reason, branch_id) · CrmLeadStatus (name, color, is_converted, is_lost) · CrmLeadSource
     @ui     Table (server-side), ToggleGroup (status), Badge, Progress (score), Dialog (convert), Combobox (existing company/contact match), DropdownMenu
     @states loading · empty ("Import or add your first lead") · error · no-access
     @audit  lead created / assigned / status changed / converted / lost
     @note   Statuses are ORGANIZATION CONFIG (CrmLeadStatus rows), not an enum: render name + color from the row; flags is_converted / is_lost drive behavior. Converting is one transaction: it creates or links the
             company and contact and (optionally) a deal, sets converted_at + converted_*_id, moves the lead to the status flagged is_converted, and PRESERVES history (activities/notes follow the lead to the new records, no
             duplicates). Duplicate detection (email, domain, name) runs BEFORE the dialog opens and suggests existing records. lead_score is computed by the API, manual_score adjusts it.
     ===================================================================================================================== */
  function leads() {
    /* name, company/contact, status, source, score, estimated value, owner, next follow-up, last activity */
    const Lr = [
      ["Billing portal", "Initech · Priya Nair", "Qualified", "Referral", 82, 24500, ["MS", "g"], "Tomorrow", "2h ago"],
      ["Brand strategy sprint", "Umbrella Ltd · Sam Cole", "Connected", "Website", 71, 15800, ["SJ", "y"], "Nov 14", "1d ago"],
      ["Data warehouse setup", "Hooli · Gavin Belson", "Contacted", "Event", 64, 52000, ["NG", "g"], "Nov 13", "2d ago"],
      ["Mobile app v3", "Globex · Hank Scorpio", "Attempting contact", "Partner", 58, 88000, ["AM", ""], "Today", "3d ago"],
      ["Support retainer", "Soylent · Lee Green", "New", "Website", 41, 12000, ["KL", "p"], "—", "—"],
      ["E-commerce rebuild", "Wonka · Willy W.", "Nurture", "Advertisement", 37, 64200, ["AM", ""], "Dec 02", "2w ago"],
      ["CRM migration", "Stark Industries", "Unqualified", "Cold outreach", 12, 9000, ["NG", "g"], "—", "1w ago"],
    ];
    const sc = { Qualified: "green", Connected: "blue", Contacted: "blue", "Attempting contact": "yellow", New: "", Nurture: "purple", Unqualified: "red" };
    return '<div class="a-page">' + head("Leads", "Prospects before qualification (§4). Convert a qualified lead into a company, contact and deal without losing history (§7).", btn("Import", "box") + btn("New lead", "plus", "primary")) +
      /* @impl Status pills = CrmLeadStatus rows of the organization (counts from the API). "Converted" and "Lost" are the rows flagged is_converted / is_lost and are hidden from "All" by default. */
      '<div class="toolbar">' + search("Search leads…") + '<div class="seg"><button class="on">All open 7</button><button>New</button><button>Contacted</button><button>Qualified</button><button>Nurture</button></div><button class="btn">Source</button><button class="btn">Owner</button><button class="btn">Score</button></div>' +
      '<div class="crm-split"><div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th style="width:28px">' + cb(0) + "</th><th>Lead</th><th>Status</th><th>Source</th><th>Score</th><th class=\"num\">Est. value</th><th>Owner</th><th>Next follow-up</th><th>Last activity</th><th></th></tr></thead><tbody>" +
      Lr.map((r, i) => '<tr class="clk" style="' + (i === 0 ? "background:var(--elevated)" : "") + '"><td>' + cb(0) + "</td><td><div class='name' style='display:block'>" + r[0] + "<div class='sub-note'>" + r[1] + '</div></div></td><td><span class="badge ' + sc[r[2]] + '"><span class="dot"></span>' + r[2] + '</span></td><td>' + r[3] + '</td><td><span class="score"><span class="meter ' + (r[4] > 70 ? "g" : r[4] > 40 ? "y" : "r") + '"><i style="width:' + r[4] + '%"></i></span>' + r[4] + '</span></td><td class="num money">' + eur(r[5]) + "</td><td>" + AV(r[6][0], r[6][1]) + '</td><td class="' + (r[7] === "Today" ? "ink" : "muted") + '">' + r[7] + '</td><td class="muted">' + r[8] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div></div>" +
      /* @impl CONVERT DIALOG (Dialog in production; shown as a side card). Opens from the row action or the lead detail. Step 1 runs duplicate detection (email, website domain, name similarity) and offers "Use existing"
           records; step 2 chooses what to create; step 3 confirms. Submit = POST convert in ONE transaction. Result screen links to the new company, contact and deal. */
      cd("<b>Convert lead</b><span class='r muted'>Billing portal · Initech</span>",
        '<div class="dupe" style="margin-bottom:12px">' + I("zap", 14) + " <b>Possible duplicate found.</b> “Initech Ltd” already exists (same website). Link to it instead of creating a new company.</div>" +
        '<div class="opt on"><span class="radio on"></span><div><b>Use existing company</b><small>Initech Ltd · Customer · owner Anna Meyer</small></div></div><div class="opt"><span class="radio"></span><div><b>Create new company</b><small>Initech (from lead)</small></div></div>' +
        '<div class="opt on"><span class="cb on">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><div><b>Create contact</b><small>Priya Nair · priya@initech.example</small></div></div>' +
        '<div class="opt on"><span class="cb on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><div><b>Create deal</b><small>Pipeline Sales · stage Qualified · €24,500</small></div></div>' +
        callout("link", "Activities and notes move with the lead to the new records. Nothing is duplicated.") + '<div style="display:flex;gap:8px;margin-top:12px">' + btn("Cancel", "") + '<button class="btn primary" style="flex:1">' + I("check", 14) + " Convert</button></div>") + "</div>" +
      dm(["CrmLead · name, status_id, lead_source_id, owner_membership_id, secondary_owner_membership_id, lead_score, manual_score, estimated_value, next_follow_up_at, last_activity_at, converted_at, converted_company_id, converted_contact_id, converted_deal_id", "CrmLeadStatus · name, color, is_converted, is_lost · CrmLeadSource · name", "CrmLeadScoringRule · conditions, points, enabled (how lead_score is computed)"], []) + "</div>";
  }

  /* =====================================================================================================================
     COMPANIES (spec §2, §17, §20, §29)
     @route  /crm/companies?type=&lifecycle=&owner=&team=&branch=&q=
     @perm   VIEW crm.companies.read · create/edit crm.companies.create / update · merge duplicates crm.companies.merge · archive crm.companies.archive · export crm.companies.export* · revenue column crm.financials.read
     @api    GET /crm/companies?... (+open_deals count/value, last/next activity) · POST /crm/companies · POST /crm/companies/merge {survivor_id, merged_ids[]}
     @mcp    crm_companies_read, crm_companies_create, crm_companies_update
     @data   CrmCompany (name, legal_name, type CrmCompanyType, lifecycle_stage_id, industry, company_size, owner_membership_id, account_manager_membership_id, success_owner_membership_id, team_id, customer_since,
             last_activity_at, next_activity_at, website, country) · CrmCompanyBranch (relation_type, is_primary) · CrmLifecycleStage (name, is_customer) · Tagging · SavedView (CRM_COMPANY)
     @ui     Table (server-side, column chooser from SavedView.columns), ToggleGroup (type), Popover+Command (filters), Avatar, Badge, DropdownMenu, Dialog (merge: pick survivor, field-by-field choice)
     @states loading · empty · error · no-access
     @audit  company created/updated/merged/archived; owner changed
     @note   ONE record model for prospect, customer, partner and vendor: CrmCompanyType + lifecycle stage tell them apart (never create a second company for the same entity; use CrmCompanyBranch for
             multi-branch relationships, 01 §31/§37). A CrmCompany is NOT a platform Organization (01). "Customer" companies are the ones customer portal users and invoices attach to.
     ===================================================================================================================== */
  function companies() {
    /* name, tile, CrmCompanyType, lifecycle stage, industry, owner, account manager, open deals count/value, last activity, branch */
    const Cr = [
      ["Acme Corp", "AC", "CUSTOMER", "Active customer", "Retail", ["PR", ""], "Anna Meyer", "2 · €108k", "2h ago", "Athens"],
      ["Initech Ltd", "IT", "CUSTOMER", "Active customer", "Software", ["AM", ""], "Marco Silva", "1 · €24.5k", "Today", "Athens"],
      ["Globex", "GX", "CUSTOMER", "Customer", "Manufacturing", ["AM", ""], "Kim Lund", "1 · €88k", "3d ago", "Thessaloniki"],
      ["Wayne Enterprises", "WE", "PROSPECT", "Opportunity", "Conglomerate", ["PR", ""], "—", "1 · €120k", "1d ago", "Athens"],
      ["Hooli", "HO", "PROSPECT", "Sales qualified", "Technology", ["NG", "g"], "—", "1 · €52k", "2d ago", "Limassol"],
      ["Northwind Traders", "NW", "CUSTOMER", "Inactive customer", "Distribution", ["NG", "g"], "Nikos Georgiou", "—", "3w ago", "Limassol"],
      ["Digital Ocean Partners", "DP", "PARTNER", "—", "Agency", ["PR", ""], "—", "—", "1w ago", "Athens"],
      ["Cloud Hosting Co", "CH", "VENDOR", "—", "Hosting", ["EP", ""], "—", "—", "2mo ago", "Athens"],
    ];
    const ty = { CUSTOMER: "green", PROSPECT: "blue", PARTNER: "purple", VENDOR: "", OTHER: "" };
    return '<div class="a-page">' + head("Companies", "Every external legal entity: prospects, customers, partners and vendors in one record model (§2).", btn("Import", "box") + btn("New company", "plus", "primary")) +
      '<div class="toolbar">' + search("Search companies, domains, tax ids…") + '<div class="seg"><button class="on">All</button><button>Customers</button><button>Prospects</button><button>Partners</button><button>Vendors</button></div><button class="btn">Lifecycle</button><button class="btn">Owner</button><button class="btn">Branch</button><button class="btn">' + I("filter", 13) + ' Columns</button></div>' +
      '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th style="width:28px">' + cb(0) + "</th><th>Company</th><th>Type</th><th>Lifecycle</th><th>Industry</th><th>Owner</th><th>Account manager</th><th>Open deals</th><th>Last activity</th><th>Branch</th><th></th></tr></thead><tbody>" +
      Cr.map((r) => '<tr class="clk" onclick="location.hash=\'#crm/company\'"><td>' + cb(0) + "</td><td><div class='name'>" + tile(r[1], "") + r[0] + "</div></td><td>" + E(r[2], ty[r[2]]) + "</td><td>" + r[3] + "</td><td>" + r[4] + "</td><td>" + AV(r[5][0], r[5][1]) + "</td><td>" + r[6] + '</td><td class="money">' + r[7] + '</td><td class="muted">' + r[8] + '</td><td class="muted">' + r[9] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div></div>" +
      dm(["CrmCompany · name, type, lifecycle_stage_id, industry, owner_membership_id, account_manager_membership_id, team_id, last_activity_at, next_activity_at", "CrmCompanyBranch · relation_type, is_primary · CrmLifecycleStage · CrmDeal (open count/value, aggregate)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CUSTOMER 360 (spec §18, §19, §34)
     @route  /crm/companies/:companyId?tab=overview|contacts|deals|commercial|billing|support|activity|notes|files   (contacts have the same page at /crm/contacts/:id)
     @perm   VIEW crm.companies.read. EACH tab shows only data the caller may read in the OWNING module: Deals crm.deals.read · Proposals proposals.proposals.read · Contracts contracts.contracts.read ·
             Projects projects.projects.read · Billing finance.invoices.read / payments (08) · Support support.conversations.read (13) · Files documents.documents.read (17). Revenue needs crm.financials.read.
     @api    GET /crm/companies/:id (record + summary) · GET /crm/companies/:id/summary (counts and revenue; a single aggregate) · per tab, the OWNING module's list endpoint filtered by company_id:
             GET /crm/deals?company_id= · GET /proposals?company_id= · GET /contracts?company_id= · GET /projects?customer_id= · GET /invoices?company_id= · GET /support/conversations?company_id= · GET /documents?company_id=
     @mcp    crm_companies_read (summary); other tabs use the owning module's tools
     @data   CrmCompany (all fields, owner, account_manager, success_owner, team_id, customer_since) · CrmContact (company_id) · CrmLifecycleHistory (stage changes) · CrmActivity · CrmNote · Tagging · CustomFieldValue ·
             read-only links to: Proposal (03), Contract (04), Project (05), Invoice/Payment/Subscription (08), SupportConversation/Ticket (13), Document (17), CalendarEvent (19), Task (06)
     @ui     Tabs, Card, Table, Badge, Avatar, Timeline, Dialog (edit), rich-text notes
     @states loading per tab · empty tab · error per tab · no-access per tab (tab hidden when the caller cannot read that module)
     @audit  company updated, owner changed, lifecycle changed (also CrmLifecycleHistory)
     @note   This page AGGREGATES; it owns almost nothing. Never copy another module's records into CRM tables. Revenue metrics come from Finance (08) by company: total revenue = paid invoices, outstanding = open
             invoices, recurring = active subscriptions, lifetime value = total revenue; conversion = accepted / sent proposals. Show "—" (not 0) when the caller cannot read finance.
             "Next activity" = the earliest PLANNED CrmActivity or open linked Task. Ownership block: owner, account manager, success owner (CrmCompany); project manager comes from the project (05).
     ===================================================================================================================== */
  function company() {
    return '<div class="a-page">' +
      '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + tile("AC", "blue") + '<div class="nm"><h2>Acme Corp ' + E("CUSTOMER", "green") + '<span class="badge">Active customer</span></h2><div class="muted">Retail · 51–200 employees · acme.example · customer since Mar 2025 · Athens (primary)</div></div>' + btn("Log activity", "phone") + btn("New deal", "plus") + btn("Edit", "edit", "primary") + "</div></div>" +
      '<div class="tabset">' + tabs([["o", "Overview"], ["c", "Contacts", 4], ["d", "Deals", 3], ["m", "Commercial"], ["b", "Billing"], ["s", "Support", 2], ["a", "Activity"], ["n", "Notes"]], "o") +
      pane("o", 1, '<div class="crm-split"><div class="stack">' +
        /* @impl Revenue & commercial summary (§19): values from Finance (08) / Proposals (03) by company. Hidden ("—") without crm.financials.read. Each number links to the filtered list in its own module. */
        '<div class="mini-stats" style="margin:0">' + stat("Total revenue", eur(186400), "lifetime value") + stat("Open deal value", eur(108000), "2 open deals") + stat("Outstanding", eur(12400), "1 invoice · due Nov 24", 1) + stat("Recurring", eur(4800) + "/mo", "1 subscription") + stat("Proposal conversion", "67%", "2 of 3 accepted") + "</div>" +
        cd("<b>Open deals</b><span class='r'>" + btn("New deal", "plus", "sm") + "</span>", '<table><thead><tr><th>Deal</th><th>Stage</th><th class="num">Value</th><th>Close</th><th>Owner</th></tr></thead><tbody><tr class="clk" onclick="location.hash=\'#crm/deal\'"><td class="ink">Acme Rebrand phase 2</td><td><span class="badge blue">Proposal</span></td><td class="num money">' + eur(50400) + '</td><td>Dec 15</td><td>' + AV("AM", "") + '</td></tr><tr><td class="ink">Acme maintenance plan</td><td><span class="badge blue">Qualified</span></td><td class="num money">' + eur(57600) + "</td><td>Dec 10</td><td>" + AV("KL", "p") + "</td></tr></tbody></table>", 1) +
        /* @impl Timeline: merge of CrmActivity, CrmNote, lifecycle changes and cross-module events (invoice paid, ticket opened, proposal viewed) in one stream. Cross-module events come from the Notifications/event bus (14/20);
             filter chips per source. Cursor pagination. */
        cd("<b>Recent activity</b><span class='r muted'>all modules</span>", '<div class="tl"><div class="ev"><b>Invoice INV-2058 sent · €12,400</b><small>Billing (08) · yesterday</small></div><div class="ev"><b>Support conversation opened: pricing table approval</b><small>Support (13) · 2h ago</small></div><div class="ev"><b>Proposal PR-2041 viewed 3×</b><small>Proposals (03) · Nov 9</small></div><div class="ev"><b>Meeting: scope review</b><small>CrmActivity · Nov 8</small></div><div class="ev"><b>Contract MSA v3 signed</b><small>Contracts (04) · Oct 30</small></div></div>') +
        "</div><div class=\"stack\">" +
        /* @impl Ownership (§20): owner, account manager, success owner (CrmCompany) + team. Reassign needs crm.companies.update and, for owner, crm.companies.assign-style rule from assignment rules (CrmAssignmentRule). */
        cd("<b>Ownership</b>", kv("Owner", "Petros R.") + kv("Account manager", "Anna Meyer") + kv("Customer success", "Kim Lund") + kv("Secondary owner", "Marco Silva") + kv("Project manager", "Anna Meyer") + kv("Team", "Account Management")) +
        cd("<b>Contacts</b><span class='r'>" + btn("Add", "plus", "sm") + "</span>", '<div class="rowx">' + who("LK", "p", "Lena Kovac", "Marketing Director") + '<span style="margin-left:auto">' + E("PRIMARY", "blue") + '</span></div><div class="rowx">' + who("MD", "", "Marc Dupont", "Finance Lead") + '<span style="margin-left:auto">' + E("BILLING") + '</span></div><div class="rowx">' + who("JW", "g", "Jo Walsh", "CTO") + '<span style="margin-left:auto">' + E("TECHNICAL") + "</span></div>", 1) +
        cd("<b>Company details</b>", kv("Legal name", "Acme Corporation S.A.") + kv("VAT", "EL998877665") + kv("Website", "acme.example") + kv("Country", "Greece") + kv("Lead source", "Referral") + kv("Tags", tok("retail") + " " + tok("retainer"))) +
        "</div></div>") +
      pane("c", 0, callout("users", "Contacts of this company (CrmContact). Roles per contact are CrmContactRole values: Primary, Decision maker, Technical, Billing, Project stakeholder, Executive.")) +
      pane("d", 0, callout("crm", "All deals of this company: open, won and lost (CrmDeal), filtered by status.")) +
      /* @impl Commercial tab: proposals (03), contracts (04), projects (05) of this company: read-only tables fed by those modules, each with a link out. */
      pane("m", 0, '<div class="g2">' + cd("<b>Proposals</b><span class='r muted'>03</span>", '<div class="rowx"><div class="grow"><b>PR-2041 · Rebrand phase 2</b><small>sent Nov 8 · €50,400</small></div><span class="badge blue">Sent</span></div><div class="rowx"><div class="grow"><b>PR-1987 · Website redesign</b><small>accepted Feb 2025 · €42,000</small></div><span class="badge green">Accepted</span></div>', 1) + cd("<b>Contracts & projects</b><span class='r muted'>04 · 05</span>", '<div class="rowx"><div class="grow"><b>MSA v3</b><small>signed Oct 30 · renews Oct 2027</small></div><span class="badge green">Active</span></div><div class="rowx"><div class="grow"><b>Acme Rebrand Website</b><small>project · 72% · due Nov 28</small></div><span class="badge green">On track</span></div>', 1) + "</div>") +
      pane("b", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Invoice</th><th>Date</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody><tr><td class="ink">INV-2058</td><td>Nov 10</td><td class="num money">' + eur(12400) + '</td><td><span class="badge yellow">Sent · due Nov 24</span></td></tr><tr><td class="ink">INV-2041</td><td>Oct 12</td><td class="num money">' + eur(24000) + '</td><td><span class="badge green">Paid</span></td></tr></tbody></table></div>') +
      pane("s", 0, callout("support", "Support conversations and tickets of this company (13), newest first, with SLA state.")) +
      pane("a", 0, callout("phone", "Calls, meetings and emails (CrmActivity) of this company and its contacts.")) +
      pane("n", 0, callout("lock", "Notes (CrmNote) on this company. Private notes need <span class='key'>crm.notes.private.read</span>.")) + "</div>" +
      dm(["CrmCompany · all fields (owner, secondary owner, account manager, customer success, project manager) · CrmContact (company_id) · CrmLifecycleHistory · CrmActivity · CrmNote · Tagging · CustomFieldValue", "Read-only by id from: Proposal (03), Contract (04), Project (05), Invoice/Payment/Subscription (08), SupportConversation (13), Document (17), CalendarEvent (19), Task (06)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CONTACTS (spec §3)
     @route  /crm/contacts?company=&role=&owner=&consent=&q=
     @perm   VIEW crm.contacts.read · create/edit crm.contacts.create / update · merge crm.contacts.merge · export crm.contacts.export*
     @api    GET /crm/contacts?... · POST /crm/contacts · POST /crm/contacts/merge
     @mcp    crm_contacts_read, crm_contacts_create
     @data   CrmContact (first_name, last_name, job_title, department, email, emails JSON, phone, mobile, roles CrmContactRole[], contact_type, company_id, lifecycle_stage_id, owner_membership_id, timezone, language,
             consent JSON, last_activity_at) · Tagging
     @ui     Table, ToggleGroup, Badge (roles, consent), Avatar, DropdownMenu
     @states loading · empty · error · no-access
     @note   A contact is a PERSON at a company, NOT a platform User (01). A contact may later get a customer-portal identity (CustomerPortalMembership), which is a separate record. consent (JSON) holds channel-level
             marketing/communication consent; Communication Center (11) enforces it on every send (CommConsent/CommSuppression) and this screen only displays the summary.
     ===================================================================================================================== */
  function contacts() {
    /* name, initials, color, job title, company, roles[], email, phone, owner, consent, last activity */
    const Ct = [
      ["Lena Kovac", "LK", "p", "Marketing Director", "Acme Corp", ["PRIMARY", "DECISION_MAKER"], "lena@acme.example", "+30 210 555 0101", ["AM", ""], "Granted", "2h ago"],
      ["Marc Dupont", "MD", "", "Finance Lead", "Acme Corp", ["BILLING"], "marc@acme.example", "+30 210 555 0102", ["AM", ""], "Granted", "3d ago"],
      ["Priya Nair", "PN", "", "Head of Product", "Initech Ltd", ["PRIMARY", "DECISION_MAKER"], "priya@initech.example", "+44 20 5550 1212", ["MS", "g"], "Granted", "Today"],
      ["Hank Scorpio", "HS", "y", "CEO", "Globex", ["EXECUTIVE"], "hank@globex.example", "+1 555 0100", ["AM", ""], "Pending", "3d ago"],
      ["Gavin Belson", "GB", "r", "Chief Strategy Officer", "Hooli", ["DECISION_MAKER"], "gavin@hooli.example", "—", ["NG", "g"], "Not asked", "2d ago"],
      ["Jo Walsh", "JW", "g", "CTO", "Acme Corp", ["TECHNICAL", "PROJECT_STAKEHOLDER"], "jo@acme.example", "+30 210 555 0103", ["AM", ""], "Granted", "1w ago"],
    ];
    return '<div class="a-page">' + head("Contacts", "People at the companies you deal with (§3). A contact is not a platform user.", btn("Import", "box") + btn("New contact", "plus", "primary")) +
      '<div class="toolbar">' + search("Search name, email, phone…") + '<div class="seg"><button class="on">All</button><button>Decision makers</button><button>Billing</button><button>Technical</button></div><button class="btn">Company</button><button class="btn">Owner</button><button class="btn">Consent</button></div>' +
      '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th style="width:28px">' + cb(0) + "</th><th>Contact</th><th>Company</th><th>Roles</th><th>Phone</th><th>Owner</th><th>Consent</th><th>Last activity</th><th></th></tr></thead><tbody>" +
      Ct.map((r) => "<tr class='clk'><td>" + cb(0) + "</td><td>" + who(r[1], r[2], r[0], r[3] + " · " + r[6]) + "</td><td>" + r[4] + "</td><td>" + r[5].map((x) => E(x, x === "PRIMARY" ? "blue" : x === "DECISION_MAKER" ? "purple" : "")).join(" ") + '</td><td class="muted">' + r[7] + "</td><td>" + AV(r[8][0], r[8][1]) + "</td><td>" + '<span class="badge ' + (r[9] === "Granted" ? "green" : r[9] === "Pending" ? "yellow" : "") + '">' + r[9] + '</span></td><td class="muted">' + r[10] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div></div>" +
      dm(["CrmContact · first_name, last_name, job_title, email, phone, roles (CrmContactRole[]), company_id, owner_membership_id, consent (JSON), last_activity_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     ACTIVITIES (spec §12–§16)
     @route  /crm/activities?status=&type=&owner=&from=&to=  (list; calendar view uses Calendar (19))
     @perm   VIEW crm.activities.read · log/schedule crm.activities.create · edit crm.activities.update · delete crm.activities.delete*
     @api    GET /crm/activities?... · POST /crm/activities · PATCH /crm/activities/:id (complete, outcome, reschedule)
     @mcp    crm_activities_read, crm_activities_create
     @data   CrmActivity (type CrmActivityType, status CrmActivityStatus, priority CrmPriority, title, description, company_id, contact_id, lead_id, deal_id, project_id, owner_membership_id, starts_at, ends_at,
             duration_minutes, location, meeting_url, calendar_event_id, outcome, completed_at) · CrmActivityParticipant (membership or contact, response)
     @ui     Grouped list (Today / Tomorrow / Overdue / Later), ToggleGroup, Badge, Checkbox (complete), Dialog+Form (log activity), Popover (reschedule)
     @states loading · empty · error · no-access
     @audit  activity created/completed/cancelled
     @note   Meetings are mirrored to a Calendar (19) event through calendar_event_id; scheduling and attendee availability belong to Calendar. EMAIL activities are created from Communication Center (11) messages.
             TASKS ARE NOT ACTIVITIES (they live in 06 and link back to CRM records): show them in the same list with a task icon, sourced from the Tasks API, never stored here.
     ===================================================================================================================== */
  function activities() {
    const rows = [
      ["Overdue", [["mail", "Send revised scope", "Stark integrations", "URGENT", "PLANNED", "Mon 10:00", ["NG", "g"]]]],
      ["Today", [["phone", "Call Lena Kovac", "Acme Rebrand phase 2", "HIGH", "PLANNED", "15:00", ["AM", ""]], ["video", "Demo: billing portal", "Initech billing portal", "NORMAL", "PLANNED", "17:00", ["MS", "g"]]]],
      ["Tomorrow", [["video", "Discovery meeting", "Hooli data platform", "NORMAL", "PLANNED", "10:30", ["NG", "g"]]]],
      ["Completed", [["video", "Scope review with Lena", "Acme Rebrand phase 2", "NORMAL", "COMPLETED", "Nov 8", ["AM", ""]], ["video", "Intro call", "Soylent redesign", "NORMAL", "NO_SHOW", "Nov 6", ["SJ", "y"]]]],
    ];
    return '<div class="a-page">' + head("Activities", "Calls, meetings and emails logged against companies, contacts, leads and deals (§13). Tasks live in Tasks (06).", btn("Log activity", "plus", "primary")) +
      '<div class="toolbar">' + search("Search activities…") + '<div class="seg"><button class="on">All</button><button>Calls</button><button>Meetings</button><button>Emails</button></div><button class="btn">Owner</button><button class="btn">Status</button></div>' +
      rows.map((g) => '<div class="cd" style="margin-bottom:12px"><div class="cd-h"><b>' + g[0] + '</b><span class="r muted">' + g[1].length + "</span></div><div class=\"cd-b flush\">" + g[1].map((a) => '<div class="rowx">' + cb(a[4] === "COMPLETED") + '<span class="muted">' + I(a[0], 16) + '</span><div class="grow"><b>' + a[1] + "</b><small>" + a[2] + " · " + a[5] + "</small></div>" + E(a[3], a[3] === "URGENT" ? "red" : a[3] === "HIGH" ? "yellow" : "") + S(a[4]) + AV(a[6][0], a[6][1]) + "</div>").join("") + "</div></div>").join("") +
      dm(["CrmActivity · type, status, priority, title, company_id, contact_id, lead_id, deal_id, owner_membership_id, starts_at, ends_at, duration_minutes, outcome, calendar_event_id", "CrmActivityParticipant · membership_id | contact_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     FORECAST (spec §11, §33)
     @route  /crm/forecast?pipeline=&team=&owner=&period=month|quarter|year
     @perm   VIEW crm.forecast.read (+ crm.financials.read for the money; without it the screen is hidden)
     @api    GET /crm/forecast?pipeline_id=&team_id=&owner_id=&group=month|quarter|year  (server computes every number)
     @mcp    crm_forecast_read
     @data   CrmDeal (value, probability, forecast_category CrmForecastCategory, status, expected_close_date, actual_close_date, owner_membership_id, lead_source_id) · CrmPipelineStage (probability) ·
             CrmDealLineItem (revenue by service) · CrmLeadSource
     @ui     Table, stacked bars (Recharts), ToggleGroup (period), Select (pipeline, team), Badge (category)
     @states loading · empty · error · no-access
     @note   Buckets by expected_close_date (open deals) and actual_close_date (won/lost). Categories are the CrmForecastCategory VALUES (Pipeline, Best case, Commit, Closed won, Closed lost): a deal's category is set by its
             stage default and may be overridden on the deal by someone with crm.deals.update. Weighted value uses deal.probability when set, else the stage probability.
             PIPELINE COVERAGE = open pipeline / remaining target (CrmSalesTarget, scope organization, team or person). FORECAST ACCURACY compares the commit amount of the snapshot taken at the start of the period (CrmForecastSnapshot, written by a daily job)
             with what actually closed. Both are computed by the API; without a target or snapshot the card shows "Set a sales target" instead of a number.
     ===================================================================================================================== */
  function forecast() {
    const M = [["November", 36000, 0, 120000, 64200, 0], ["December", 0, 24500 + 48000 + 31000 + 57600, 0, 0, 0], ["January", 0, 18000 + 88000, 0, 52000, 0]];
    /* month, won, best case, commit... shown as stacked */
    const rows = [["November", 36000, 0, 184200, 0], ["December", 0, 161100, 0, 0], ["January", 0, 106000, 0, 52000]];
    const tot = (r) => r[1] + r[2] + r[3] + r[4];
    const mx = Math.max.apply(null, rows.map(tot));
    return '<div class="a-page">' + head("Forecast", "Expected revenue by month and forecast category (§11).", '<div class="seg"><button class="on">Month</button><button>Quarter</button><button>Year</button></div>' + btn("Export", "box")) +
      '<div class="mini-stats">' + stat("Closed won", eur(36000), "this month") + stat("Commit", eur(184200), "Negotiation + Verbal") + stat("Best case", eur(267100), "Qualified + Proposal") + stat("Weighted total", eur(352400), "all open deals") + stat("Win rate", "34%", "last 90 days") + stat("Avg deal size", eur(41200), "won deals") + "</div>" +
      cd("<b>Revenue forecast</b><span class='r'><div class='leg'><span><i class='fc-won'></i>Closed won</span><span><i class='fc-commit'></i>Commit</span><span><i class='fc-best'></i>Best case</span><span><i class='fc-pipeline'></i>Pipeline</span></div></span>",
        rows.map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr" style="height:14px"><i class="fc-won" style="width:' + (r[1] / mx) * 100 + '%"></i><i class="fc-commit" style="width:' + (r[3] / mx) * 100 + '%"></i><i class="fc-best" style="width:' + (r[2] / mx) * 100 + '%"></i><i class="fc-pipeline" style="width:' + (r[4] / mx) * 100 + '%"></i></span><span class="v money">' + kfmt(tot(r)) + "</span></div>").join("")) +
      '<div class="g2" style="margin-top:14px">' +
      cd("<b>By salesperson</b><span class='r muted'>owner_membership_id</span>", '<table><thead><tr><th>Owner</th><th class="num">Won</th><th class="num">Commit</th><th class="num">Best case</th><th class="num">Weighted</th></tr></thead><tbody><tr><td>' + who("AM", "", "Anna Meyer", "") + '</td><td class="num money">' + eur(0) + '</td><td class="num money">' + eur(64200) + '</td><td class="num money">' + eur(106000) + '</td><td class="num money ink">' + eur(98400) + '</td></tr><tr><td>' + who("NG", "g", "Nikos Georgiou", "") + '</td><td class="num money">' + eur(0) + '</td><td class="num money">' + eur(0) + '</td><td class="num money">' + eur(31000) + '</td><td class="num money ink">' + eur(41600) + '</td></tr><tr><td>' + who("PR", "", "Petros Rodinos", "") + '</td><td class="num money">' + eur(0) + '</td><td class="num money">' + eur(120000) + '</td><td class="num money">' + eur(0) + '</td><td class="num money ink">' + eur(96000) + "</td></tr></tbody></table>", 1) +
      /* @impl Coverage and accuracy placeholders: pipeline coverage = open pipeline / target and forecast accuracy = forecast vs actual need a sales TARGET table and forecast SNAPSHOTS. Neither exists in the schema yet:
           render these two cards as "Set a sales target" empty states until the model exists, never with invented numbers. */
      cd("<b>Coverage & accuracy</b><span class='r muted'>CrmSalesTarget · CrmForecastSnapshot</span>", kv("Q4 target (Sales team)", eur(300000)) + kv("Open pipeline", eur(519100)) + kv("Pipeline coverage", "<b class='ink'>1.7×</b> " + muted("of remaining target")) + kv("Attainment", "12% · " + eur(36000) + " won") + kv("Forecast accuracy", "<b class='ink'>88%</b> " + muted("last quarter: committed vs closed")) + '<div class="sub-note" style="margin-top:6px">Accuracy compares the commit amount in the snapshot taken at the start of the period with what closed.</div>') + "</div>" +
      dm(["CrmDeal · value, probability, forecast_category, status, expected_close_date, actual_close_date, owner_membership_id", "CrmPipelineStage · probability, forecast_category", "CrmDealLineItem · revenue by service", "CrmSalesTarget · period, metric, amount, owner_membership_id, team_id, pipeline_id", "CrmForecastSnapshot · snapshot_date, period_start, commit_amount, best_case_amount, closed_won_amount, weighted_amount"], []) + "</div>";
  }

  /* =====================================================================================================================
     PIPELINES & STAGES SETUP (spec §8, §17, §37)
     @route  /crm/settings/pipelines · /crm/settings/lead-statuses · /crm/settings/lifecycle · /crm/settings/sources
     @perm   VIEW + ACTION crm.pipelines.manage (pipelines, stages) · crm.settings.manage (lead statuses, lifecycle stages, sources, assignment rules) · crm.scoring_rules.manage · crm.targets.manage* · crm.dashboards.manage
     @api    GET/POST/PATCH /crm/pipelines · PUT /crm/pipelines/:id/stages (ordered list; the API validates exactly one won and one lost stage) · GET/PUT /crm/lead-statuses · /crm/lifecycle-stages · /crm/lead-sources
     @mcp    crm_pipelines_manage, crm_settings_manage
     @data   CrmPipeline (name, slug, description, team_id, is_default, currency, archived_at) · CrmPipelineStage (name, slug, sort_order, probability, forecast_category, is_won, is_lost, stale_after_days, color) ·
             CrmLeadStatus (name, slug, color, sort_order, is_default, is_converted, is_lost) · CrmLifecycleStage (name, slug, sort_order, is_customer, is_default) · CrmLeadSource (name, slug, sort_order, is_default)
     @ui     Tabs, sortable list (dnd-kit) with inline fields, Select (forecast category), ColorPicker, Switch, AlertDialog (archive; deals in a stage must be moved first)
     @states loading · error · no-access · validation errors inline (e.g. no won stage)
     @audit  pipeline created/updated/archived; stage added/removed/reordered
     @note   There are NO platform-wide pipelines or statuses: every organization owns its rows, created at provisioning from the defaults of spec 02 §37 (CRM `provisionDefaults` hook). A stage with deals cannot be deleted,
             only archived after the deals are moved. Exactly one default pipeline per organization; one default lead status; flags is_won / is_lost / is_converted / is_customer drive behavior elsewhere (forecast, conversion,
             customer portal eligibility), so changing them warns about the impact. Probability is 0-100.
     ===================================================================================================================== */
  function pipelines() {
    return '<div class="a-page">' + head("CRM setup", "Pipelines, stages, lead statuses, lifecycle stages and sources. Defaults come from spec 02 §37 and are yours to change.", btn("New pipeline", "plus", "primary")) +
      '<div class="tabset">' + tabs([["p", "Pipelines"], ["l", "Lead statuses"], ["c", "Lifecycle"], ["s", "Lead sources"], ["k", "Lead scoring"], ["t", "Targets"], ["d", "Dashboards"], ["r", "Assignment rules"]], "p") +
      pane("p", 1, '<div class="toolbar">' + sel("Sales (default)", "layers").replace('class="sel"', 'class="sel" style="width:220px"') + '<span class="badge green">Default</span><span class="sub-note">currency EUR · team Sales · 12 open deals</span><span style="flex:1"></span>' + btn("Archive pipeline", "archive", "sm") + "</div>" +
        '<div class="panel" style="margin-top:0"><table><thead><tr><th style="width:28px"></th><th>Stage</th><th class="num">Probability</th><th>Forecast category</th><th class="num">Stale after</th><th>Type</th><th class="num">Deals</th><th></th></tr></thead><tbody>' +
        ST.map((s, i) => "<tr><td class='muted'>" + I("menu", 14) + "</td><td><b class='ink' style='font-weight:500'>" + s[0] + '</b></td><td class="num">' + s[1] + '%</td><td>' + fcBadge(s[2]) + '</td><td class="num">' + (s[3] ? s[3] + " days" : "—") + "</td><td>" + (i === 6 ? '<span class="badge green">Won</span>' : i === 7 ? '<span class="badge red">Lost</span>' : '<span class="muted">Open</span>') + '</td><td class="num">' + D.filter((d) => d[5] === i).length + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
        '<div class="sub-note" style="margin-top:8px">Drag rows to reorder (sort_order). Exactly one stage must be Won and one Lost.</div>') +
      pane("l", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Status</th><th>Default</th><th>Converted</th><th>Lost</th></tr></thead><tbody>' + [["New", 1, 0, 0], ["Contacted", 0, 0, 0], ["Attempting contact", 0, 0, 0], ["Connected", 0, 0, 0], ["Qualified", 0, 0, 0], ["Unqualified", 0, 0, 0], ["Nurture", 0, 0, 0], ["Converted", 0, 1, 0], ["Lost", 0, 0, 1]].map((r) => "<tr><td class='ink'>" + r[0] + "</td><td>" + sw(r[1]) + "</td><td>" + sw(r[2]) + "</td><td>" + sw(r[3]) + "</td></tr>").join("") + "</tbody></table></div>") +
      pane("c", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Stage</th><th>Counts as customer</th><th>Default</th></tr></thead><tbody>' + [["Lead", 0, 1], ["Marketing qualified", 0, 0], ["Sales qualified", 0, 0], ["Opportunity", 0, 0], ["Customer", 1, 0], ["Active customer", 1, 0], ["Inactive customer", 0, 0], ["Former customer", 0, 0]].map((r) => "<tr><td class='ink'>" + r[0] + "</td><td>" + sw(r[1]) + "</td><td>" + sw(r[2]) + "</td></tr>").join("") + "</tbody></table></div>") +
      pane("s", 0, cd("<b>Lead sources</b><span class='r'>" + btn("Add source", "plus", "sm") + "</span>", ["Website", "Referral", "Existing customer", "Partner", "Networking", "Event", "Cold outreach", "Advertisement", "Organic search", "Social media", "Direct"].map((x) => '<div class="rowx"><div class="grow"><b>' + x + "</b></div>" + more + "</div>").join(""), 1)) +
      /* @impl LEAD SCORING (§6): CrmLeadScoringRule rows (name, conditions JSON, points, enabled, sort_order). The API adds the points of every matching enabled rule into CrmLead.lead_score whenever the lead or its activity changes;
           manual_score is separate and added on top. Needs crm.scoring_rules.manage. Show a rule tester: pick a lead, see which rules matched and the breakdown. */
      pane("k", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Rule</th><th>Conditions</th><th class="num">Points</th><th>Enabled</th></tr></thead><tbody>' + [["Referral source", "lead_source = Referral", "+20", 1], ["High estimated value", "estimated_value ≥ 25,000", "+15", 1], ["Replied recently", "email reply in the last 7 days", "+10", 1], ["Right company size", "company_size 51–200", "+10", 1], ["Gone quiet", "no activity for 30 days", "−15", 1], ["Free email domain", "email domain is a free provider", "−10", 0]].map((r) => "<tr><td class='ink'>" + r[0] + '</td><td class="muted mono">' + r[1] + '</td><td class="num money">' + r[2] + "</td><td>" + sw(r[3]) + "</td></tr>").join("") + "</tbody></table></div>") +
      /* @impl TARGETS (§11, §33): CrmSalesTarget rows (period MONTH | QUARTER | YEAR, period_start/end, metric REVENUE_WON | PIPELINE_CREATED | DEALS_WON, amount, currency; scope = organization, a team or one person; optional pipeline).
           Attainment = actual / amount; coverage = open pipeline / remaining target. Needs crm.targets.manage* (sensitive: targets are performance data). Personal targets are visible only to the person, their manager and crm.targets.manage holders. */
      pane("t", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Period</th><th>Scope</th><th>Metric</th><th class="num">Target</th><th>Attainment</th><th></th></tr></thead><tbody>' + [["Q4 2026", "Sales team", "REVENUE_WON", eur(300000), 12], ["Q4 2026", "Anna Meyer", "REVENUE_WON", eur(120000), 0], ["Q4 2026", "Nikos Georgiou", "REVENUE_WON", eur(90000), 0], ["Nov 2026", "Organization", "PIPELINE_CREATED", eur(250000), 74], ["Year 2026", "Organization", "DEALS_WON", "60 deals", 80]].map((r) => "<tr><td class='ink'>" + r[0] + "</td><td>" + r[1] + "</td><td>" + E(r[2]) + '</td><td class="num money">' + r[3] + '</td><td><span class="bar"><i style="width:' + r[4] + '%"></i></span>' + r[4] + "%</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>") +
      /* @impl DASHBOARD LAYOUTS (§32): CrmDashboardLayout rows (name, role_id | team_id | both null = organization default, widgets JSON as an ordered list of {key, size, filters}). Resolution order for a viewer: their own arrangement
           (UserPreference.dashboard_layout) > a layout for their team > a layout for their role > the organization default. Needs crm.dashboards.manage. */
      pane("d", 0, cd("<b>Dashboard layouts</b><span class='r'>" + btn("New layout", "plus", "sm") + "</span>", '<div class="rowx"><div class="grow"><b>Sales team</b><small>team Sales · pipeline by stage, stale deals, forecast, my targets</small></div><span class="badge">Team</span></div><div class="rowx"><div class="grow"><b>Management</b><small>role Admin · revenue by salesperson, win rate, forecast accuracy</small></div><span class="badge">Role</span></div><div class="rowx"><div class="grow"><b>Organization default</b><small>all other members · pipeline, upcoming activities</small></div><span class="badge green">Default</span></div>', 1)) +
      /* @impl Assignment rules: CrmAssignmentRule rows (entity_type, conditions JSON, assign_to JSON, priority, enabled). They are EVALUATED by the Automation Engine (20); this screen only edits them. Show a rule tester. */
      pane("r", 0, cd("<b>Assignment rules</b><span class='r'>" + btn("New rule", "plus", "sm") + "</span>", '<div class="rowx"><div class="grow"><b>Greek leads → Athens sales team</b><small>CRM_LEAD · country = GR · round robin · priority 1</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Deals over €50k → Petros R.</b><small>CRM_DEAL · value ≥ 50,000 · owner · priority 2</small></div>' + sw(1) + "</div>", 1)) + "</div>" +
      dm(["CrmPipeline · name, is_default, team_id, currency", "CrmPipelineStage · name, sort_order, probability, forecast_category, is_won, is_lost, stale_after_days", "CrmLeadStatus · is_default, is_converted, is_lost · CrmLifecycleStage · is_customer, is_default · CrmLeadSource · CrmAssignmentRule", "CrmLeadScoringRule · conditions, points, enabled, sort_order", "CrmSalesTarget · period, metric, amount · CrmDashboardLayout · role_id, team_id, widgets"], []) + "</div>";
  }

  /* =====================================================================================================================
     IMPORT & EXPORT (spec §22)
     @route  /crm/settings/import  (wizard) · /crm/settings/import/:jobId (result) · history list on the same page
     @perm   import crm.records.import* · export crm.records.export* (also each entity's own export key). Both sensitive: audited, MFA step-up recommended.
     @api    POST /crm/imports (multipart upload to Documents 17, creates CrmImportJob PENDING) · PUT /crm/imports/:id/mapping · POST /crm/imports/:id/validate · POST /crm/imports/:id/start ·
             POST /crm/imports/:id/rollback · GET /crm/imports · POST /crm/exports {entity_type, view_id|filters}
     @mcp    crm_records_import*, crm_records_export* (need human confirmation for AI callers)
     @data   CrmImportJob (entity_type, status CrmImportStatus, document_id, file_name, field_mapping JSON, duplicate_strategy JSON, total_rows, imported_rows, updated_rows, skipped_rows, error_rows, errors JSON,
             created_record_ids[], started_by_membership_id, started_at, completed_at, rolled_back_at)
     @ui     Stepper, file drop zone, mapping table (Select per column), Table (preview, errors), Progress, AlertDialog (rollback)
     @states idle · validating · preview · importing (progress, poll or push) · completed · failed (downloadable error file) · rolled back
     @audit  data.imported / data.exported (include entity type and counts, never row data)
     @note   Pipeline: PENDING -> VALIDATING -> PREVIEW (nothing written yet) -> IMPORTING -> COMPLETED | FAILED; ROLLED_BACK undoes only records in created_record_ids (updates cannot be rolled back: say so).
             Duplicate strategy per entity (skip | update | create) with the match key (email, domain, name). Imports run as a background job (queue), never in the request. The source file is a Document (17) with the
             sensitive flag. Row-level errors are kept in `errors` for download.
     ===================================================================================================================== */
  function imports() {
    return '<div class="a-page">' + head("Import & export", "Bring companies, contacts, leads, deals and activities in from CSV, with mapping, duplicate detection and rollback (§22).", btn("Export records", "box")) +
      '<div class="steps"><span class="st done">' + I("check", 13) + ' 1 Upload</span><span class="st on">2 Map fields</span><span class="st">3 Duplicates</span><span class="st">4 Preview</span><span class="st">5 Import</span></div>' +
      '<div class="g-main" style="grid-template-columns:minmax(0,1fr) 340px"><div class="stack">' +
      cd("<b>Map columns</b><span class='r muted'>companies.csv · 214 rows → Companies</span>", '<table><thead><tr><th>CSV column</th><th>Sample</th><th>CRM field</th></tr></thead><tbody>' + [["Company", "Acme Corp", "name"], ["Legal name", "Acme Corporation S.A.", "legal_name"], ["VAT", "EL998877665", "vat_number"], ["Website", "acme.example", "website"], ["Type", "customer", "type (CrmCompanyType)"], ["Owner email", "anna@logiqdev.example", "owner (match member by email)"], ["Region", "Attica", "custom field: region"]].map((r) => "<tr><td class='ink'>" + r[0] + '</td><td class="muted">' + r[1] + "</td><td>" + sel(r[2]).replace('class="sel"', 'class="sel" style="width:240px"') + "</td></tr>").join("") + "</tbody></table>", 1) +
      cd("<b>Duplicates</b>", fld("Match companies by", '<div class="seg"><button class="on">Website domain</button><button>VAT number</button><button>Name</button></div>') + fld("When a match is found", '<div class="seg"><button>Skip</button><button class="on">Update existing</button><button>Create anyway</button></div>') + callout("zap", "Updates cannot be rolled back. Only records created by this import can be rolled back.", "warn")) +
      "</div><div class=\"stack\">" +
      cd("<b>Validation</b>", kv("Rows", 214) + kv("Valid", '<span style="color:var(--green)">196</span>') + kv("Duplicates found", '<span style="color:var(--yellow)">11</span>') + kv("Errors", '<span style="color:var(--red)">7</span>') + btn("Download error file", "box", "sm")) +
      cd("<b>Import history</b><span class='r muted'>CrmImportJob</span>", '<div class="rowx"><div class="grow"><b>contacts.csv</b><small>Nov 2 · 540 rows · 521 imported, 19 skipped</small></div>' + S("COMPLETED") + '</div><div class="rowx"><div class="grow"><b>leads-q3.csv</b><small>Oct 14 · 88 rows</small></div>' + S("COMPLETED") + btn("Roll back", "", "sm") + '</div><div class="rowx"><div class="grow"><b>old-crm.csv</b><small>Sep 3 · 1,204 rows</small></div><span class="badge">Rolled back</span></div>', 1) + "</div></div>" +
      dm(["CrmImportJob · entity_type, status (CrmImportStatus), file_name, field_mapping, duplicate_strategy, total_rows, imported_rows, updated_rows, skipped_rows, error_rows, errors, created_record_ids, started_at, completed_at, rolled_back_at"], []) + "</div>";
  }

  const MAP = { dashboard, deals, deal, leads, companies, company, contacts, activities, forecast, pipelines, imports };
  const CRUMB = { deal: "Acme Rebrand phase 2", company: "Acme Corp" };
  window.VIEWS.crm = { html: function (s) { return (MAP[s || "deals"] || MAP.deals)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
