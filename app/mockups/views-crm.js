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
      sel("Sales pipeline", "layers").replace('class="sel"', 'class="sel" style="width:190px"') + '<div class="tg"><span class="on">Board</span><span onclick="' + go('deals-list') + '">List</span><span onclick="' + go('forecast') + '">Forecast</span></div>' +
      '<button class="btn sm">' + I("filter", 13) + ' Owner</button><button class="btn sm">Team</button><button class="btn sm">Close date</button><button class="btn sm">Value</button><span class="grow"></span>' +
      '<span class="sub-note">Open <b class="ink money">' + eur(open.reduce((a, d) => a + d[2], 0)) + '</b> · weighted <b class="ink money">' + eur(open.reduce((a, d) => a + d[2] * ST[d[5]][1] / 100, 0)) + "</b></span>" + btn("Save view", "star", "sm") + bt("New deal", "plus", "primary sm", "deal-new") + "</div>" +
      '<div style="padding:6px 20px 0">' + FBAR([["Pipeline", "is", "Sales"], ["Status", "is", "Open"], ["Owner", "is", "Anyone"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) + "</div>" +
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
      '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + tile("AR", "purple") + '<div class="nm"><h2>Acme Rebrand phase 2 ' + dealStatus("OPEN") + fcBadge("BEST_CASE") + '</h2><div class="muted"><a style="text-decoration:underline;cursor:pointer" onclick="location.hash=\'#crm/company\'">Acme Corp</a> · owner Anna Meyer · Sales pipeline · expected close Dec 15 · ' + eur(nets) + ' net</div></div>' + bt("Edit", "edit", "", "deal-edit") + bt("Mark lost", "x", "", "deal-close") + bt("Mark won", "check", "", "deal-close") + btn("Create proposal", "file", "primary") + "</div>" +
      /* @impl Stage bar = CrmPipelineStage rows of the deal's pipeline in sort_order. Click a stage to move (crm.deals.change_stage); moving to a lost stage asks for lost_reason. */
      '<div style="padding:4px 20px 18px"><div class="stagebar">' + ST.slice(0, 6).map((s, i) => '<div class="sg ' + (i < 3 ? "done" : i === 3 ? "now" : "") + '"><i></i><span>' + s[0] + "</span></div>").join("") + "</div></div></div>" +
      '<div class="tabset">' + tabs([["o", "Overview"], ["p", "Products", 4], ["a", "Activity", 6], ["n", "Notes", 3], ["f", "Files", 3], ["h", "Stage history"]], "o") +
      pane("o", 1, '<div class="crm-split"><div class="stack">' +
        '<div class="mini-stats" style="margin:0">' + stat("Value", eur(nets), "one-time " + eur(nets - 7200 * 1) + " · recurring " + eur(7200)) + stat("Probability", "60%", "stage Proposal") + stat("Forecast", "Best case", "weighted " + eur(nets * 0.6)) + stat("Time in stage", "6 days", "limit 10 days") + "</div>" +
        /* @impl Line items: CrmDealLineItem rows, editable inline (qty, unit price, discount %, VAT %). Net/gross are DISPLAYED from the API response. "Add from catalog" opens a Command over Product (08). Recurring rows show billing_frequency. */
        cd("<b>Line items</b><span class='r'>" + bt("Edit line items", "edit", "sm", "deal-products") + btn("From catalog", "box", "sm") + "</span>", '<table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Disc.</th><th class="num">VAT</th><th class="num">Net</th><th class="num">Gross</th><th></th></tr></thead><tbody>' +
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
      pane("p", 0, cd("<b>Products</b><span class='r'>" + bt("Open line-item editor", "edit", "sm", "deal-products") + "</span>", '<div class="rowx"><div class="grow"><b>4 items · ' + eur(nets) + ' net</b><small>Edit quantities, prices, discounts, VAT and recurring billing in the full-page editor.</small></div></div>', 1)) +
      pane("a", 0, '<div style="margin-bottom:12px">' + logBar() + "</div>" + callout("zap", "Calls, meetings, emails and reminders are <b>CrmActivity</b> rows. Follow-up tasks are Tasks (06) linked to this deal and shown here with a task icon.") + '<div style="height:12px"></div>' + cd("<b>Timeline</b>", '<div class="tl"><div class="ev"><b>Meeting: scope review with Lena</b><small>CrmActivity MEETING · COMPLETED · Nov 8 · 45 min</small></div><div class="ev"><b>Proposal PR-2041 sent</b><small>from 03 · Nov 8</small></div><div class="ev"><b>Moved to Proposal</b><small>from Qualified · Nov 5 · Anna Meyer</small></div><div class="ev"><b>Task: prepare revised scope</b><small>Tasks (06) · due Nov 14</small></div><div class="ev"><b>Call: discovery with Marc</b><small>CrmActivity CALL · COMPLETED · Oct 28</small></div></div>')) +
      pane("n", 0, notesBlock()) +
      pane("f", 0, filesBlock()) +
      /* @impl Stage history: CrmDealStageHistory rows, newest first, with duration in the previous stage (duration_seconds formatted). Used for velocity and "time in stage" metrics. */
      pane("h", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>When</th><th>From</th><th>To</th><th>By</th><th>Time in previous stage</th></tr></thead><tbody><tr><td>Nov 5</td><td>Qualified</td><td><b class="ink">Proposal</b></td><td>Anna Meyer</td><td>11 days</td></tr><tr><td>Oct 25</td><td>Discovery</td><td>Qualified</td><td>Anna Meyer</td><td>9 days</td></tr><tr><td>Oct 16</td><td>New Opportunity</td><td>Discovery</td><td>Anna Meyer</td><td>4 days</td></tr><tr><td>Oct 12</td><td>—</td><td>New Opportunity</td><td>Petros R.</td><td>—</td></tr></tbody></table></div>') + "</div>" +
      dm(["CrmDeal · name, status, value, one_time_value, recurring_value, discount_amount, tax_amount, probability, forecast_category, expected_close_date, next_step, competitor, lost_reason, owner_membership_id, secondary_owner_membership_id, project_manager_membership_id, proposal_id, contract_id, project_id", "CrmDealLineItem · name, quantity, unit_price, discount_percent, tax_percent, net_amount, gross_amount, is_recurring, billing_frequency, product_id", "CrmDealContact · role · CrmDealStageHistory · CrmActivity · CrmNote · Tagging"], []) + "</div>";
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
      '<div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + tile("AC", "blue") + '<div class="nm"><h2>Acme Corp ' + E("CUSTOMER", "green") + '<span class="badge">Active customer</span></h2><div class="muted">Retail · 51–200 employees · acme.example · customer since Mar 2025 · Athens (primary)</div></div>' + bt("Log activity", "phone", "", "activity-new") + bt("New deal", "plus", "", "deal-new") + bt("Merge", "layers", "", "company-merge") + bt("Edit", "edit", "primary", "company-edit") + "</div></div>" +
      '<div class="tabset">' + tabs([["o", "Overview"], ["c", "Contacts", 4], ["d", "Deals", 3], ["m", "Commercial"], ["b", "Billing"], ["s", "Support", 2], ["a", "Activity"], ["n", "Notes", 3], ["f", "Files", 3]], "o") +
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
      pane("c", 0, '<div style="margin-bottom:10px">' + bt("New contact", "plus", "sm", "contact-new") + "</div>" + tbl(["Contact", "Roles", "Email", "Phone", "Owner", "Consent", ""], [[who("LK", "p", "Lena Kovac", "Marketing Director"), roleChips(["PRIMARY", "DECISION_MAKER"]), "lena@acme.example", "+30 210 555 0101", av("AM"), consentBadge("Granted"), more], [who("MD", "", "Marc Dupont", "Finance Lead"), roleChips(["BILLING"]), "marc@acme.example", "+30 210 555 0102", av("AM"), consentBadge("Granted"), more], [who("JW", "g", "Jo Walsh", "CTO"), roleChips(["TECHNICAL", "PROJECT_STAKEHOLDER"]), "jo@acme.example", "+30 210 555 0103", av("AM"), consentBadge("Granted"), more], [who("SB", "y", "Sara Boutros", "Procurement"), roleChips([]) + muted("no role"), "sara@acme.example", "—", av("KL"), consentBadge("Pending"), more]])) +
      pane("d", 0, FBAR([["Status", "is any of", "Open, Won, Lost"]], bt("New deal", "plus", "sm", "deal-new")) + tbl(["Deal", "Stage", "Status", ">Value", "Owner", "Close"], [[lnk("deal", "Acme Rebrand phase 2"), '<span class="badge blue">Proposal</span>', dealStatus("OPEN"), '<span class="money">' + eur(50400) + "</span>", av("AM"), "Dec 15"], ["Acme maintenance plan", '<span class="badge blue">Qualified</span>', dealStatus("OPEN"), '<span class="money">' + eur(57600) + "</span>", av("KL"), "Dec 10"], ["Acme website (2025)", '<span class="badge green">Closed won</span>', dealStatus("WON"), '<span class="money">' + eur(42000) + "</span>", av("AM"), "Feb 2025"], ["Acme SEO retainer", '<span class="badge red">Closed lost</span>', dealStatus("LOST"), '<span class="money">' + eur(12000) + "</span>", av("SJ"), "Jun 2025"]])) +
      /* @impl Commercial tab: proposals (03), contracts (04), projects (05) of this company: read-only tables fed by those modules, each with a link out. */
      pane("m", 0, '<div class="g2">' + cd("<b>Proposals</b><span class='r muted'>03</span>", '<div class="rowx"><div class="grow"><b>PR-2041 · Rebrand phase 2</b><small>sent Nov 8 · €50,400</small></div><span class="badge blue">Sent</span></div><div class="rowx"><div class="grow"><b>PR-1987 · Website redesign</b><small>accepted Feb 2025 · €42,000</small></div><span class="badge green">Accepted</span></div>', 1) + cd("<b>Contracts & projects</b><span class='r muted'>04 · 05</span>", '<div class="rowx"><div class="grow"><b>MSA v3</b><small>signed Oct 30 · renews Oct 2027</small></div><span class="badge green">Active</span></div><div class="rowx"><div class="grow"><b>Acme Rebrand Website</b><small>project · 72% · due Nov 28</small></div><span class="badge green">On track</span></div>', 1) + "</div>") +
      pane("b", 0, '<div class="panel" style="margin-top:0"><table><thead><tr><th>Invoice</th><th>Date</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody><tr><td class="ink">INV-2058</td><td>Nov 10</td><td class="num money">' + eur(12400) + '</td><td><span class="badge yellow">Sent · due Nov 24</span></td></tr><tr><td class="ink">INV-2041</td><td>Oct 12</td><td class="num money">' + eur(24000) + '</td><td><span class="badge green">Paid</span></td></tr></tbody></table></div>') +
      pane("s", 0, tbl(["Ticket", "Subject", "Status", "SLA", "Updated"], [["TCK-2041", "Pricing table approval", '<span class="badge blue">Open</span>', "2h left", "2h ago"], ["TCK-1987", "Invoice address change", '<span class="badge green">Resolved</span>', "met", "Oct 21"]]) + sub("Read-only from Support (13); needs support.tickets.read.")) +
      pane("a", 0, '<div style="margin-bottom:12px">' + logBar() + "</div>" + cd("<b>Activities</b><span class='r muted'>this company and its contacts</span>", timeline([["Call with Lena: scope follow-up", "CrmActivity CALL · planned · today 15:00"], ["Meeting: scope review", "CrmActivity MEETING · Nov 8 · 45 min"], ["Email: updated timeline", "CrmActivity EMAIL · Nov 6"], ["Task: prepare revised scope", "Tasks (06) · due Nov 14"]]))) +
      pane("n", 0, notesBlock()) + pane("f", 0, filesBlock()) + "</div>" +
      dm(["CrmCompany · all fields (owner, secondary owner, account manager, customer success, project manager) · CrmContact (company_id) · CrmLifecycleHistory · CrmActivity · CrmNote · Tagging · CustomFieldValue", "Read-only by id from: Proposal (03), Contract (04), Project (05), Invoice/Payment/Subscription (08), SupportConversation (13), Document (17), CalendarEvent (19), Task (06)"], []) + "</div>";
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
     SHARED BUILDING BLOCKS (mock-only helpers; production = shadcn components named in each @ui tag)
     ===================================================================================================================== */
  const go = (r) => "location.hash='#crm/" + r + "'";
  const nav = (html, r) => html.replace("<button", '<button onclick="' + go(r) + '"');
  const bt = (t, ic, cls, r) => nav(btn(t, ic, cls), r);
  const lnk = (r, t) => '<a class="lnk" onclick="' + go(r) + '">' + t + "</a>";
  const sp = '<div style="height:12px"></div>';
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows, flush) => '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div></div>";
  const PPL = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], NG: ["Nikos Georgiou", "g"], SJ: ["Sofia Jensen", "y"], KL: ["Kim Lund", "p"], PR: ["Petros R.", ""] };
  const av = (k) => AV(k, PPL[k][1]);
  const own = (k) => who(k, PPL[k][1], PPL[k][0], "");
  const FBAR = (chips, extra) => (window.UI.filters ? window.UI.filters.filterBar(chips, extra) : "");
  const box = (t, val) => '<div class="input-fake' + (val ? " val" : "") + '">' + t + "</div>";
  const ta = (t, val) => '<div class="input-fake ta' + (val ? " val" : "") + '">' + t + "</div>";
  const ff = (l, h, hint, req) => '<div class="fld"><label>' + l + (req ? ' <span class="req">*</span>' : "") + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const f2 = (a, b) => '<div class="f2">' + a + b + "</div>";
  const f3 = (a, b, c) => '<div class="f3">' + a + b + c + "</div>";
  const tg = (arr, on) => '<div class="tg">' + arr.map((t) => '<span class="' + (t === on || (Array.isArray(on) && on.indexOf(t) >= 0) ? "on" : "") + '">' + t + "</span>").join("") + "</div>";
  const tags = (a) => a.map(tok).join(" ");
  const editor = (ph) => '<div class="editor"><div class="ed-bar">' + ["B", "I", "H", "•", "1.", "Link", "@", "/"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">' + ph + "</div></div>";
  const drop = (t) => '<div class="drop">' + I("clip", 16) + " " + t + "</div>";
  const tgl = (t, s, on) => '<div class="rowx"><div class="grow"><b>' + t + "</b>" + (s ? "<small>" + s + "</small>" : "") + "</div>" + sw(on) + "</div>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + p + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  const scoreCell = (n) => '<span class="score"><span class="meter ' + (n > 70 ? "g" : n > 40 ? "y" : "r") + '"><i style="width:' + n + '%"></i></span>' + n + "</span>";
  const sub = (t) => '<div class="sub-note">' + t + "</div>";
  const actionsBar = (cancel, extra, primary) => '<div class="form-actions">' + btn(cancel, "") + '<span style="flex:1"></span>' + (extra || "") + primary + "</div>";

  /* @impl CUSTOM FIELDS BLOCK (spec 02 §24-26): rendered from CustomFieldDefinition rows whose entity_types contain the record type, grouped by CustomFieldGroup, ordered by sort_order.
       Control per CustomFieldType (TEXT Input, LONG_TEXT Textarea, NUMBER/DECIMAL/CURRENCY/PERCENTAGE number Input, BOOLEAN Switch, DATE/DATETIME DatePicker, EMAIL/PHONE/URL Input with validation,
       DROPDOWN Select, MULTI_SELECT Popover+Command, RADIO RadioGroup, USER/TEAM/COMPANY/CONTACT/DEAL/RECORD_REFERENCE Combobox). Values go to CustomFieldValue (value Json + value_text for search). `visibility` Json
       hides a field per role; required fields block save. Definitions are managed in /crm/custom-fields (platform.custom_fields.manage). */
  const customFields = (kind) => cd("<b>Custom fields</b><span class='r muted'>CustomFieldDefinition · " + kind + "</span>", kind === "CRM_DEAL" ? f2(ff("Contract term (months)", box("12", 1)), ff("Procurement process", sel("Standard RFP"))) + f2(ff("Decision date", sel("Pick a date", "calendar")), ff("Budget approved", sw(1))) : kind === "CRM_COMPANY" ? f2(ff("Region", sel("Attica")), ff("Preferred language", sel("English"))) + f2(ff("Account tier", sel("Gold")), ff("Renewal date", sel("Pick a date", "calendar"))) : kind === "CRM_LEAD" ? f2(ff("Campaign", box("Black Friday 2026", 1)), ff("Interested services", sel("Web, Branding", "tag"))) : f2(ff("Birthday", sel("Pick a date", "calendar")), ff("Preferred channel", sel("Email"))));
  const tagsCard = (a) => cd("<b>Tags</b><span class='r muted'>Tag · Tagging</span>", '<div class="rowx" style="padding-top:0">' + tags(a) + btn("Add tag", "plus", "sm") + "</div>" + sub("Tags are organization-wide (Tag.entity_types limits where a tag is offered). New tags need platform.tags.manage; applying existing ones does not."));

  /* Generic list page: saved-view strip, toolbar, filter bar, bulk bar, table with checkboxes, pager, footer.
     @impl ONE <RecordList entity="CRM_LEAD"> component for every list: server-side filter/sort/search/pagination from the SavedView JSON, cursor pagination + virtualized rows, column chooser from SavedView.columns,
       "select all" selects BY FILTER (the API re-evaluates it), bulk bar actions each need the entity's own permission, row menu = DropdownMenu. */
  function listPage(o) {
    const body = '<div class="panel" style="margin-top:0"><div class="tbl-scroll"><table><thead><tr><th style="width:28px">' + cb(o.rows.some((r) => r.on) ? "mix" : 0) + "</th>" + o.cols.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "<th></th></tr></thead><tbody>" +
      o.rows.map((r) => '<tr class="' + (r.go ? "clk " : "") + (r.on ? "rsel" : "") + '"' + (r.go ? ' onclick="' + go(r.go) + '"' : "") + "><td>" + cb(r.on) + "</td>" + r.c.map((c, i) => "<td" + (o.cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "<td>" + more + "</td></tr>").join("") + "</tbody></table></div></div>";
    const nsel = o.rows.filter((r) => r.on).length;
    return '<div class="a-page">' + head(o.title, o.sub, o.acts) +
      '<div class="sv">' + o.views.map((v, i) => '<button class="' + (i === o.on ? "on" : "") + '">' + v[0] + '<span class="count">' + v[1] + "</span></button>").join("") + '<button class="ghost">' + I("plus", 12) + " New view</button></div>" +
      '<div class="toolbar">' + search(o.ph) + sel(o.group || "Group: None") + sel(o.sort, "sort") + sel("Columns (" + o.cols.length + ")", "settings") + (o.tools || "") + "</div>" +
      FBAR(o.chips, btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      (nsel ? '<div class="bulk"><span class="cb on"></span><b>' + nsel + " selected</b><span class='muted'>of " + o.total + " matching · <a class='lnk'>select all " + o.total + "</a></span><span style='flex:1'></span>" + (o.bulk || "") + "</div>" : "") +
      body + '<div class="pager"><span class="muted">1–' + o.rows.length + " of " + o.total + '</span><span style="flex:1"></span>' + sel("25 per page") + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(o.dm[0], o.dm[1] || []) + "</div>";
  }
  const bulkSel = (items) => items.map((t) => (/^(Delete|Archive)/.test(t) ? btn(t, t[0] === "D" ? "x" : "box", "sm") : sel(t))).join("");

  /* =====================================================================================================================
     LEADS LIST (spec §4, §5, §6, §29)
     @screen Leads (table with saved views, filter bar, bulk actions)
     @route  /crm/leads?view=<savedViewId>&filter=<json>&status=&source=&owner=&score=&q=&sort=&page=
     @perm   VIEW crm.leads.read · create crm.leads.create · edit crm.leads.update · assign (bulk) crm.leads.assign · CONVERT crm.leads.convert · archive crm.leads.archive · delete crm.leads.delete* · export crm.leads.export*
             · shared saved views platform.saved_views.manage_shared
     @api    GET /crm/leads?filter=&sort=&q=&cursor= · POST /crm/leads/bulk {ids|filter, patch|action: assign|status|source|tag|archive|delete} · GET/POST/PATCH /saved-views?entity_type=CRM_LEAD
     @mcp    crm_leads_read (takes the same filter JSON), crm_leads_create, crm_leads_convert
     @data   CrmLead (name, company_id|company_name, contact_id|contact_name, status_id, lead_source_id, owner_membership_id, lead_score, manual_score, estimated_value, currency, next_follow_up_at, last_activity_at, branch_id, created_at)
             · CrmLeadStatus · CrmLeadSource · SavedView (entity_type CRM_LEAD)
     @ui     Table (server-side), Popover+Command filter pickers (multi-select), ToggleGroup, DropdownMenu (row, bulk), Dialog (save view), Checkbox, Badge, Progress (score)
     @states loading skeleton rows · empty ("Import or add your first lead") · filtered-empty ("No leads match" + clear) · error · no-access
     @audit  lead created/assigned/status changed/converted/lost; bulk actions write one audit event per record plus a summary event with the filter used; export is data.exported
     @note   Statuses are organization config (CrmLeadStatus rows: name + color; flags is_converted/is_lost). "Converted" and "Lost" are hidden from "All open". Score = computed lead_score + manual_score.
             Financial column (Est. value) is hidden without crm.financials.read. Saved views: PERSONAL | TEAM | ORGANIZATION (SavedView.visibility), default view per user = SavedView.is_default.
     ===================================================================================================================== */
  const LEADS = [
    ["Billing portal", "Initech · Priya Nair", "Qualified", "Referral", 82, 24500, "MS", "Athens", "Tomorrow", "2h ago", "Nov 2"],
    ["Brand strategy sprint", "Umbrella Ltd · Sam Cole", "Connected", "Website", 71, 15800, "SJ", "Athens", "Nov 14", "1d ago", "Oct 28"],
    ["Data warehouse setup", "Hooli · Gavin Belson", "Contacted", "Event", 64, 52000, "NG", "Limassol", "Nov 13", "2d ago", "Oct 22"],
    ["Mobile app v3", "Globex · Hank Scorpio", "Attempting contact", "Partner", 58, 88000, "AM", "Thessaloniki", "Today", "3d ago", "Oct 19"],
    ["Support retainer", "Soylent · Lee Green", "New", "Website", 41, 12000, "KL", "Athens", "—", "—", "Nov 10"],
    ["E-commerce rebuild", "Wonka · Willy W.", "Nurture", "Advertisement", 37, 64200, "AM", "Athens", "Dec 02", "2w ago", "Sep 30"],
    ["CRM migration", "Stark Industries", "Unqualified", "Cold outreach", 12, 9000, "NG", "Limassol", "—", "1w ago", "Sep 12"],
  ];
  const LST = { Qualified: "green", Connected: "blue", Contacted: "blue", "Attempting contact": "yellow", New: "", Nurture: "purple", Unqualified: "red", Converted: "green", Lost: "red" };
  const lst = (s) => '<span class="badge ' + LST[s] + '"><span class="dot"></span>' + s + "</span>";
  function leads() {
    return listPage({
      title: "Leads", sub: "Prospects before qualification (§4). Convert a qualified lead into a company, contact and deal without losing history (§7).",
      acts: bt("Import", "box", "", "imports") + bt("Bulk assign", "users", "", "bulk-assign") + bt("New lead", "plus", "primary", "lead-new"),
      views: [["All open", 61], ["My leads", 14], ["New this week", 9], ["Hot (score 70+)", 6], ["Needs follow-up", 11], ["Converted", 38]], on: 0,
      ph: "Search name, company, email, phone…", sort: "Sort: Score ↓", group: "Group: Status",
      chips: [["Status", "is any of", "New, Contacted, Connected, Qualified"], ["Owner", "is", "Anyone"], ["Score", "≥", "40"], ["Created", "in the last", "90 days"]],
      bulk: bulkSel(["Assign to…", "Status…", "Source…", "Tag…", "Archive", "Delete"]),
      cols: ["Lead", "Status", "Source", "Score", ">Est. value", "Owner", "Branch", "Next follow-up", "Last activity", "Created"], total: 61,
      rows: LEADS.map((r, i) => ({ go: "lead", on: i === 1 || i === 3, c: ["<div class='name' style='display:block'>" + r[0] + "<div class='sub-note'>" + r[1] + "</div></div>", lst(r[2]), r[3], scoreCell(r[4]), '<span class="money">' + eur(r[5]) + "</span>", av(r[6]), '<span class="muted">' + r[7] + "</span>", '<span class="' + (r[8] === "Today" ? "ink" : "muted") + '">' + r[8] + "</span>", '<span class="muted">' + r[9] + "</span>", '<span class="muted">' + r[10] + "</span>"] })),
      dm: [["CrmLead · name, company_id, company_name, contact_id, contact_name, status_id, lead_source_id, owner_membership_id, lead_score, manual_score, estimated_value, branch_id, next_follow_up_at, last_activity_at, created_at", "CrmLeadStatus · name, color, is_converted, is_lost · CrmLeadSource · name", "SavedView · entity_type CRM_LEAD, layout, visibility, filters, sorting, grouping, columns, search, is_default"]],
    });
  }

  /* =====================================================================================================================
     DEALS LIST (table layout of the pipeline, spec §8, §9, §29)
     @screen Deals · table view (same data as the board)
     @route  /crm/deals-list?pipeline=&view=<savedViewId>&filter=<json>&sort=&q=  (layout "table" of the same SavedView set as the board)
     @perm   VIEW crm.deals.read · create crm.deals.create · bulk stage crm.deals.change_stage · bulk owner crm.deals.assign · bulk edit crm.deals.update · archive crm.deals.archive · delete crm.deals.delete* · export crm.deals.export*
             · value/probability columns need crm.financials.read
     @api    GET /crm/deals?pipeline_id=&filter=&sort=&q=&cursor= · POST /crm/deals/bulk {ids|filter, patch|action} · GET /crm/deals/summary?filter= (totals row)
     @mcp    crm_deals_read, crm_deals_change_stage
     @data   CrmDeal (name, company_id, pipeline_id, stage_id, status, value, probability, forecast_category, expected_close_date, stage_entered_at, owner_membership_id, next_step, last_activity_at, tags) · CrmPipelineStage · SavedView (CRM_DEAL)
     @ui     Table with column chooser, filter bar, bulk bar, Popover+Command pickers, ToggleGroup (Board / List / Forecast), DropdownMenu, Dialog (save view)
     @states loading · empty · filtered-empty · error · no-access · bulk partial failure (per-row error list)
     @audit  per-record events for every bulk change (stage changed, owner changed); stage moves also write CrmDealStageHistory
     @note   The totals strip comes from the summary endpoint for the WHOLE filter, not from loaded rows. Bulk stage change to a lost stage asks for lost_reason once for all rows; to a won stage sets status WON on each.
             Stale (yellow) = time in stage > stage.stale_after_days. Pipelines are per team: the pipeline Select lists only usable ones.
     ===================================================================================================================== */
  function dealsList() {
    const stg = (i) => '<span class="badge ' + (i === 6 ? "green" : i === 7 ? "red" : i >= 3 ? "blue" : "") + '">' + ST[i][0] + "</span>";
    const open = D.filter((d) => d[5] < 6);
    return listPage({
      title: "Deals", sub: "Sales pipeline · " + open.length + " open deals · " + eur(open.reduce((a, d) => a + d[2], 0)) + " open · weighted " + eur(open.reduce((a, d) => a + d[2] * ST[d[5]][1] / 100, 0)),
      acts: '<div class="tg"><span onclick="' + go("deals") + '">Board</span><span class="on">List</span><span onclick="' + go("forecast") + '">Forecast</span></div>' + bt("Export", "box", "", "deals-list") + bt("New deal", "plus", "primary", "deal-new"),
      views: [["All open", 12], ["My open deals", 5], ["Closing this month", 4], ["Stale deals", 3], ["Won this quarter", 6], ["Lost", 4]], on: 0,
      ph: "Search deal, company, next step…", sort: "Sort: Close date ↑", group: "Group: Stage",
      chips: [["Pipeline", "is", "Sales"], ["Status", "is", "Open"], ["Value", "≥", "€10,000"], ["Expected close", "before", "Jan 31"], ["Forecast", "is any of", "Best case, Commit"]],
      bulk: bulkSel(["Move to stage…", "Assign to…", "Forecast…", "Close date…", "Tag…", "Archive", "Delete"]),
      cols: ["Deal", "Company", "Stage", "Status", ">Value", ">Prob.", "Forecast", "Owner", "Expected close", ">In stage", "Next step"], total: 12,
      rows: D.map((d, i) => ({ go: "deal", on: i === 6 || i === 7, c: ["<b class='ink' style='font-weight:500'>" + d[0] + "</b>", d[1], stg(d[5]), dealStatus(d[5] === 6 ? "WON" : d[5] === 7 ? "LOST" : "OPEN"), '<span class="money">' + eur(d[2]) + "</span>", d[5] < 6 ? ST[d[5]][1] + "%" : "—", fcBadge(ST[d[5]][2]), av(d[3][0]), d[4], ST[d[5]][3] && d[6] > ST[d[5]][3] ? '<span class="badge yellow">' + d[6] + "d</span>" : '<span class="muted">' + d[6] + "d</span>", '<span class="muted">' + (i % 3 ? "Send revised scope" : "Book a demo") + "</span>"] })),
      dm: [["CrmDeal · name, company_id, stage_id, status, value, probability, forecast_category, expected_close_date, stage_entered_at, owner_membership_id, next_step", "CrmPipelineStage · name, probability, forecast_category, stale_after_days", "SavedView · entity_type CRM_DEAL, layout table"]],
    });
  }

  /* =====================================================================================================================
     COMPANIES LIST (spec §2, §17, §20, §29)
     @screen Companies (table with saved views, filters, column chooser, bulk bar)
     @route  /crm/companies?type=&lifecycle=&owner=&team=&branch=&country=&tag=&view=&q=
     @perm   VIEW crm.companies.read · create/edit crm.companies.create / update · merge crm.companies.merge · bulk owner change crm.companies.assign · archive crm.companies.archive · delete crm.companies.delete* · export crm.companies.export* · revenue column crm.financials.read
     @api    GET /crm/companies?filter=&sort=&q=&cursor= (+open_deals count/value, last/next activity) · POST /crm/companies/bulk · POST /crm/companies/merge {survivor_id, merged_ids[]} · saved views
     @mcp    crm_companies_read, crm_companies_create, crm_companies_update
     @data   CrmCompany (name, type, lifecycle_stage_id, industry, company_size, country, owner_membership_id, account_manager_membership_id, team_id, customer_since, last_activity_at, next_activity_at, archived_at) · CrmCompanyBranch · Tagging · SavedView (CRM_COMPANY)
     @ui     Table, ToggleGroup (type), Popover+Command filters, column chooser (Popover + Checkbox list, drag to reorder), DropdownMenu, Dialog (merge entry)
     @states loading · empty · filtered-empty · error · no-access
     @audit  company created/updated/merged/archived; owner changed (bulk = one event per record)
     @note   ONE record model for prospect, customer, partner and vendor: the type segment is just a filter on CrmCompanyType. Bulk "Merge" needs exactly 2+ selected and opens the merge screen. Bulk owner change needs crm.companies.assign (contacts: crm.contacts.assign), not update.
     ===================================================================================================================== */
  const COMP = [
    ["Acme Corp", "AC", "CUSTOMER", "Active customer", "Retail", "51–200", "Greece", "PR", "Anna Meyer", "2 · €108k", "€186k", "2h ago", "Athens", ["retail"]],
    ["Initech Ltd", "IT", "CUSTOMER", "Active customer", "Software", "201–500", "United Kingdom", "AM", "Marco Silva", "1 · €24.5k", "€92k", "Today", "Athens", ["saas"]],
    ["Globex", "GX", "CUSTOMER", "Customer", "Manufacturing", "1000+", "United States", "AM", "Kim Lund", "1 · €88k", "€41k", "3d ago", "Thessaloniki", ["enterprise"]],
    ["Wayne Enterprises", "WE", "PROSPECT", "Opportunity", "Conglomerate", "1000+", "United States", "PR", "—", "1 · €120k", "—", "1d ago", "Athens", ["enterprise", "priority"]],
    ["Hooli", "HO", "PROSPECT", "Sales qualified", "Technology", "201–500", "United States", "NG", "—", "1 · €52k", "—", "2d ago", "Limassol", []],
    ["Northwind Traders", "NW", "CUSTOMER", "Inactive customer", "Distribution", "51–200", "Cyprus", "NG", "Nikos Georgiou", "—", "€23k", "3w ago", "Limassol", ["winback"]],
    ["Digital Ocean Partners", "DP", "PARTNER", "—", "Agency", "11–50", "Greece", "PR", "—", "—", "—", "1w ago", "Athens", ["referrer"]],
    ["Cloud Hosting Co", "CH", "VENDOR", "—", "Hosting", "51–200", "Germany", "PR", "—", "—", "—", "2mo ago", "Athens", ["infrastructure"]],
  ];
  const CTY = { CUSTOMER: "green", PROSPECT: "blue", PARTNER: "purple", VENDOR: "", OTHER: "" };
  const compName = (r) => "<div class='name'>" + tile(r[1], "") + r[0] + "</div>";
  function companies() {
    return listPage({
      title: "Companies", sub: "Every external legal entity: prospects, customers, partners and vendors in one record model (§2).",
      acts: bt("Import", "box", "", "imports") + bt("Duplicates", "layers", "", "duplicates") + bt("New company", "plus", "primary", "company-new"),
      views: [["All", 148], ["Customers", 62], ["Prospects", 54], ["Partners", 14], ["Vendors", 18], ["My accounts", 21], ["No owner", 4]], on: 0,
      ph: "Search companies, domains, VAT / tax ids…", sort: "Sort: Name A–Z", group: "Group: Type",
      chips: [["Type", "is any of", "Customer, Prospect"], ["Lifecycle", "is not", "Former customer"], ["Country", "is any of", "Greece, Cyprus"], ["Tag", "is", "any"]],
      bulk: bulkSel(["Assign owner…", "Lifecycle…", "Type…", "Tag…", "Archive", "Delete"]) + btn("Merge", "layers", "sm"),
      cols: ["Company", "Type", "Lifecycle", "Industry", "Size", "Country", "Owner", "Account manager", ">Open deals", ">Revenue", "Last activity", "Branch"], total: 148,
      rows: COMP.map((r, i) => ({ go: "company", on: i === 0 || i === 1, c: [compName(r), E(r[2], CTY[r[2]]), r[3], r[4], r[5], r[6], av(r[7]), r[8], '<span class="money">' + r[9] + "</span>", '<span class="money">' + r[10] + "</span>", '<span class="muted">' + r[11] + "</span>", '<span class="muted">' + r[12] + "</span>"] })),
      dm: [["CrmCompany · name, type, lifecycle_stage_id, industry, company_size, country, owner_membership_id, account_manager_membership_id, team_id, last_activity_at, next_activity_at", "CrmCompanyBranch · relation_type, is_primary · CrmLifecycleStage · CrmDeal (open count/value, aggregate) · Tagging", "SavedView · entity_type CRM_COMPANY, columns, filters"], ["Bulk owner change has no crm.companies.assign key (uses crm.companies.update)"]],
    });
  }

  /* =====================================================================================================================
     VENDORS and PARTNERS (spec §2a) — the same company list pre-filtered by CrmCompanyType
     @screen Vendors · Partners
     @route  /crm/vendors · /crm/partners  (a SavedView of CRM_COMPANY with type = VENDOR / PARTNER; create = /crm/vendor-new, /crm/partner-new)
     @perm   VIEW crm.companies.read · create/edit crm.companies.create / update · finance columns (spend, payables) need crm.financials.read AND finance/expense read in 09 · contracts column contracts.contracts.read (04)
     @api    GET /crm/companies?type=VENDOR&... · for the spend and invoice columns GET /ledger/records?company_id= (09) · GET /contracts?company_id= (04)
     @mcp    crm_companies_read (type filter)
     @data   CrmCompany (type VENDOR | PARTNER, industry, country, owner_membership_id, last_activity_at) · CrmContact (company_id) · read-only: LedgerSupplierProfile (company_id, payment_terms_days, vat_number, default_category_id) (09),
             LedgerRecord.company_id (09), RecurringExpense.company_id (09), Contract/ContractParty (04)
     @ui     Table, ToggleGroup, filter bar, Badge, DropdownMenu
     @states loading · empty ("Add your first vendor") · error · no-access
     @note   Vendors and partners are NOT a separate table (§2a): same CrmCompany with type VENDOR or PARTNER. The supplier profile (payment terms, default expense category, VAT treatment) lives in 09 and is linked by company_id, one profile per
             company. Contractors who need platform access are External Collaborators (01 §77): the CRM record and the membership are separate. Partner referral: CrmLead.referring_partner_company_id and CrmDeal.referring_partner_company_id; the agreed commission is CrmCompany.partner_commission_percent (the payout is an expense in 09).
     ===================================================================================================================== */
  function vendors() {
    const V = [["Cloud Hosting Co", "CH", "Hosting", 3, "30 days", "€14,200", "2 recurring", "MSA 2025", "Nov 3", "PR"], ["Figma Inc", "FI", "Software", 1, "On receipt", "€2,160", "1 recurring", "—", "Nov 1", "SJ"], ["Atlas Print", "AP", "Printing", 2, "14 days", "€3,780", "—", "Framework", "Sep 22", "KL"], ["Freelance: Eleni D.", "ED", "Contractor", 1, "30 days", "€9,600", "—", "Contractor agreement", "Oct 30", "AM"], ["Stripe Payments Europe", "SP", "Payments", 2, "Monthly", "€1,940", "1 recurring", "—", "Nov 1", "PR"]];
    return listPage({
      title: "Vendors", sub: "Suppliers and contractors (§2a). Same company record, type Vendor; spend and invoices come from Income & expenses (09).",
      acts: bt("Import", "box", "", "imports") + bt("New vendor", "plus", "primary", "vendor-new"),
      views: [["All vendors", 18], ["Contractors", 5], ["Software", 6], ["With recurring costs", 7]], on: 0, ph: "Search vendors, VAT numbers…", sort: "Sort: Spend YTD ↓",
      chips: [["Type", "is", "Vendor"], ["Industry", "is any of", "Hosting, Software, Printing"]], bulk: bulkSel(["Assign owner…", "Tag…", "Archive"]),
      cols: ["Vendor", "Category", ">Contacts", "Payment terms (09)", ">Spend YTD (09)", "Recurring (09)", "Contract (04)", "Last invoice", "Owner"], total: 18,
      rows: V.map((r, i) => ({ go: "company", on: i === 1, c: [compName([r[0], r[1]]), r[2], r[3], r[4], '<span class="money">' + r[5] + "</span>", r[6], r[7] === "—" ? '<span class="muted">—</span>' : r[7], '<span class="muted">' + r[8] + "</span>", av(r[9])] })),
      dm: [["CrmCompany · type VENDOR, name, industry, owner_membership_id", "CrmContact · company_id (count)", "Read-only: LedgerSupplierProfile (09) · LedgerRecord.company_id (09) · RecurringExpense.company_id (09) · Contract (04)"]],
    });
  }
  function partners() {
    const P = [["Digital Ocean Partners", "DP", "Agency", "Referral", 9, 3, "Nov 6", "Greece", "PR"], ["Pixelcraft Studio", "PS", "Design agency", "Subcontract", 2, 1, "Oct 18", "Cyprus", "AM"], ["Northstar Consulting", "NC", "Consulting", "Referral", 6, 2, "Oct 29", "Greece", "NG"], ["Paperplane Dev", "PD", "Development", "Technology", 0, 0, "Aug 14", "Poland", "SJ"]];
    return listPage({
      title: "Partners", sub: "Agencies and referral partners (§2a). Same company record, type Partner.",
      acts: bt("Import", "box", "", "imports") + bt("New partner", "plus", "primary", "partner-new"),
      views: [["All partners", 14], ["Referral", 6], ["Subcontract", 4], ["Technology", 4]], on: 0, ph: "Search partners…", sort: "Sort: Name A–Z",
      chips: [["Type", "is", "Partner"], ["Lifecycle", "is", "any"]], bulk: bulkSel(["Assign owner…", "Tag…", "Archive"]),
      cols: ["Partner", "Industry", "Partner kind", ">Leads referred", ">Deals won via partner", "Last activity", "Country", "Owner"], total: 14,
      rows: P.map((r, i) => ({ go: "company", on: 0, c: [compName([r[0], r[1]]), r[2], tok(r[3]) + " " + muted("tag"), r[4] || "—", r[5] || "—", '<span class="muted">' + r[6] + "</span>", r[7], av(r[8])] })),
      dm: [["CrmCompany · type PARTNER, industry, country, owner_membership_id, last_activity_at", "Tagging (the partner kind is a tag) · CrmLead / CrmDeal · referring_partner_company_id (counts), CrmCompany.partner_commission_percent"], []],
    });
  }

  /* =====================================================================================================================
     CONTACTS LIST (spec §3, §29)
     @screen Contacts (table, saved views, filters, bulk bar)
     @route  /crm/contacts?company=&role=&owner=&consent=&lifecycle=&q=&view=
     @perm   VIEW crm.contacts.read · create/edit crm.contacts.create / update · merge crm.contacts.merge · archive crm.contacts.archive · delete crm.contacts.delete* · export crm.contacts.export*
     @api    GET /crm/contacts?filter=&sort=&q=&cursor= · POST /crm/contacts/bulk · POST /crm/contacts/merge {survivor_id, merged_ids[]}
     @mcp    crm_contacts_read, crm_contacts_create
     @data   CrmContact (first_name, last_name, job_title, department, company_id, email, phone, mobile, roles CrmContactRole[], lifecycle_stage_id, owner_membership_id, consent JSON, timezone, language, last_activity_at) · Tagging · SavedView (CRM_CONTACT)
     @ui     Table, ToggleGroup (role), Popover+Command filters, column chooser, DropdownMenu, Badge (roles, consent)
     @states loading · empty · filtered-empty · error · no-access
     @audit  contact created/updated/merged/archived; consent changes are audited with source
     @note   A contact is a person at a company, NOT a platform User. Consent is displayed here but ENFORCED by Communication Center (11, CommConsent/CommSuppression) on every send. Bulk "Add to campaign list" hands ids to 11, it does not copy data.
     ===================================================================================================================== */
  const CON = [
    ["Lena Kovac", "LK", "p", "Marketing Director", "Acme Corp", ["PRIMARY", "DECISION_MAKER"], "lena@acme.example", "+30 210 555 0101", "AM", "Granted", "2h ago", "Athens"],
    ["Marc Dupont", "MD", "", "Finance Lead", "Acme Corp", ["BILLING"], "marc@acme.example", "+30 210 555 0102", "AM", "Granted", "3d ago", "Athens"],
    ["Priya Nair", "PN", "", "Head of Product", "Initech Ltd", ["PRIMARY", "DECISION_MAKER"], "priya@initech.example", "+44 20 5550 1212", "MS", "Granted", "Today", "London"],
    ["Hank Scorpio", "HS", "y", "CEO", "Globex", ["EXECUTIVE"], "hank@globex.example", "+1 555 0100", "AM", "Pending", "3d ago", "Chicago"],
    ["Gavin Belson", "GB", "r", "Chief Strategy Officer", "Hooli", ["DECISION_MAKER"], "gavin@hooli.example", "—", "NG", "Not asked", "2d ago", "Palo Alto"],
    ["Jo Walsh", "JW", "g", "CTO", "Acme Corp", ["TECHNICAL", "PROJECT_STAKEHOLDER"], "jo@acme.example", "+30 210 555 0103", "AM", "Granted", "1w ago", "Athens"],
  ];
  const roleChips = (a) => a.map((x) => E(x, x === "PRIMARY" ? "blue" : x === "DECISION_MAKER" ? "purple" : "")).join(" ");
  const consentBadge = (c) => '<span class="badge ' + (c === "Granted" ? "green" : c === "Pending" ? "yellow" : "") + '">' + c + "</span>";
  function contacts() {
    return listPage({
      title: "Contacts", sub: "People at the companies you deal with (§3). A contact is not a platform user.",
      acts: bt("Import", "box", "", "imports") + bt("Merge duplicates", "layers", "", "contact-merge") + bt("New contact", "plus", "primary", "contact-new"),
      views: [["All", 412], ["Decision makers", 96], ["Billing contacts", 58], ["Technical", 71], ["My contacts", 63], ["No consent recorded", 37]], on: 0,
      ph: "Search name, email, phone…", sort: "Sort: Last activity ↓", group: "Group: Company",
      chips: [["Role", "is any of", "Decision maker, Billing"], ["Company", "is any of", "any"], ["Consent", "is not", "Not asked"], ["Owner", "is", "Anyone"]],
      bulk: bulkSel(["Assign owner…", "Role…", "Tag…", "Add to list (11)…", "Archive", "Delete"]) + btn("Merge", "layers", "sm"),
      cols: ["Contact", "Company", "Roles", "Phone", "Owner", "Consent", "Last activity", "City"], total: 412,
      rows: CON.map((r, i) => ({ go: "contact", on: i === 0, c: [who(r[1], r[2], r[0], r[3] + " · " + r[6]), r[4], roleChips(r[5]), '<span class="muted">' + r[7] + "</span>", av(r[8]), consentBadge(r[9]), '<span class="muted">' + r[10] + "</span>", '<span class="muted">' + r[11] + "</span>"] })),
      dm: [["CrmContact · first_name, last_name, job_title, email, phone, roles (CrmContactRole[]), company_id, owner_membership_id, consent (JSON), last_activity_at", "SavedView · entity_type CRM_CONTACT"], ["No city column: CrmContact has no address; city shows the company's address.city"]],
    });
  }

  /* =====================================================================================================================
     ACTIVITIES (spec §12–§16, §29)
     @screen Activities (list with views, filters, bulk bar; calendar layout mirrors Calendar 19)
     @route  /crm/activities?view=&status=&type=&owner=&from=&to=&q=  · create /crm/activity-new
     @perm   VIEW crm.activities.read · log/schedule crm.activities.create · edit/complete crm.activities.update · delete crm.activities.delete* · export crm.activities.export*
     @api    GET /crm/activities?filter=&sort=&cursor= · POST /crm/activities/bulk {ids, action: complete|cancel|reschedule|assign|delete} · PATCH /crm/activities/:id
     @mcp    crm_activities_read, crm_activities_create
     @data   CrmActivity (type CrmActivityType, status CrmActivityStatus, priority CrmPriority, title, company_id, contact_id, lead_id, deal_id, project_id, owner_membership_id, starts_at, ends_at, duration_minutes, outcome, calendar_event_id, completed_at)
             · CrmActivityParticipant · SavedView (CRM_ACTIVITY)
     @ui     Table, ToggleGroup (List / Calendar), Popover+Command filters, Checkbox (complete inline), Popover (reschedule), DropdownMenu
     @states loading · empty · filtered-empty · error · no-access
     @audit  activity created/completed/cancelled/rescheduled
     @note   Tasks are NOT activities: tasks linked to CRM records are listed with a task icon, fetched from the Tasks API (06) and never stored here. Meetings are mirrored to Calendar (19) via calendar_event_id.
             EMAIL activities are created from Communication Center (11) messages or logged manually.
     ===================================================================================================================== */
  const ACT = [
    ["mail", "EMAIL", "Send revised scope", "Stark integrations", "deal", "URGENT", "PLANNED", "Mon 10:00 · overdue", "NG", "Eleni Pappas"],
    ["phone", "CALL", "Call Lena Kovac", "Acme Rebrand phase 2", "deal", "HIGH", "PLANNED", "Today 15:00", "AM", "Lena Kovac"],
    ["video", "MEETING", "Demo: billing portal", "Initech billing portal", "deal", "NORMAL", "PLANNED", "Today 17:00", "MS", "Priya Nair"],
    ["video", "MEETING", "Discovery meeting", "Hooli data platform", "deal", "NORMAL", "PLANNED", "Tomorrow 10:30", "NG", "Gavin Belson"],
    ["clock", "FOLLOW_UP", "Check in after proposal", "Wonka e-commerce", "deal", "NORMAL", "PLANNED", "Nov 14", "AM", "Willy W."],
    ["phone", "CALL", "Qualification call", "Billing portal (lead)", "lead", "HIGH", "COMPLETED", "Nov 10 · 25 min", "MS", "Priya Nair"],
    ["video", "MEETING", "Scope review with Lena", "Acme Rebrand phase 2", "deal", "NORMAL", "COMPLETED", "Nov 8 · 45 min", "AM", "Lena Kovac"],
    ["video", "MEETING", "Intro call", "Soylent redesign", "deal", "NORMAL", "NO_SHOW", "Nov 6", "SJ", "Lee Green"],
    ["bell", "REMINDER", "Contract renewal: Globex", "Globex (company)", "company", "NORMAL", "CANCELLED", "Nov 5", "KL", "—"],
  ];
  function activities() {
    return listPage({
      title: "Activities", sub: "Calls, meetings, emails and reminders logged against companies, contacts, leads and deals (§13). Tasks live in Tasks (06).",
      acts: '<div class="tg"><span class="on">List</span><span>Calendar</span></div>' + bt("Log a call", "phone", "", "activity-new") + bt("Schedule meeting", "video", "", "activity-meeting") + bt("Log activity", "plus", "primary", "activity-new"),
      views: [["My activities", 18], ["Overdue", 3], ["Today", 4], ["This week", 12], ["Calls", 22], ["Meetings", 15], ["Completed", 141]], on: 0,
      ph: "Search title, outcome, record…", sort: "Sort: Starts at ↑", group: "Group: Day",
      chips: [["Status", "is", "Planned"], ["Type", "is any of", "Call, Meeting, Email, Follow up"], ["Owner", "is", "Me"], ["Starts", "between", "Nov 10 – Nov 24"]],
      bulk: bulkSel(["Complete", "Reschedule…", "Assign to…", "Priority…", "Cancel", "Delete"]).replace('<div class="sel"><span>Complete</span>', '<div class="sel"><span>Complete</span>'),
      cols: ["Activity", "Type", "Related to", "Priority", "Status", "When", "Owner", "With"], total: 18,
      rows: ACT.map((a, i) => ({ go: "", on: i === 1, c: ["<span class='muted' style='margin-right:8px;vertical-align:middle'>" + I(a[0], 15) + "</span><b class='ink' style='font-weight:500'>" + a[2] + "</b>", E(a[1]), a[3] + " " + muted(a[4]), E(a[5], a[5] === "URGENT" ? "red" : a[5] === "HIGH" ? "yellow" : ""), S(a[6]), '<span class="' + (a[7].indexOf("overdue") > 0 ? "neg-t" : "muted") + '">' + a[7] + "</span>", av(a[8]), a[9]] })),
      dm: [["CrmActivity · type, status, priority, title, company_id, contact_id, lead_id, deal_id, owner_membership_id, starts_at, ends_at, duration_minutes, outcome, direction, comm_message_id, recording_document_id, calendar_event_id, completed_at", "CrmActivityParticipant · membership_id | contact_id", "Read-only: Task (06) linked to CRM records, CalendarEvent (19), CommMessage (11)"], []],
    });
  }

  /* =====================================================================================================================
     CREATE / EDIT DEAL — full page (spec §9, §10, §12)
     @screen New deal · Edit deal (same form; edit is prefilled)
     @route  /crm/deal-new?pipeline=&stage=&company=&contact=&lead=&from=<entityType>:<id>  ·  /crm/deal-edit (= /crm/deals/:id/edit)  ·  QUICK CREATE = Dialog from "+" on a board column or "c" on any list (name, company, value, close date, owner only)
     @perm   create crm.deals.create · edit crm.deals.update · set owner/secondary/PM crm.deals.assign · value, line items, discount crm.financials.read (otherwise those fields are hidden) · attach documents documents.documents.read
     @api    POST /crm/deals {pipeline_id, stage_id, name, company_id?, primary_contact_id?, owner_membership_id?, secondary_owner_membership_id?, project_manager_membership_id?, team_id?, branch_id?, currency, value?, probability?,
             forecast_category?, expected_close_date?, deal_type?, lead_source_id?, competitor?, next_step?, description?, contacts[{contact_id, role}], line_items[], tag_ids[], custom_fields{}, document_ids[]} · PATCH /crm/deals/:id
     @mcp    crm_deals_create, crm_deals_update
     @data   CrmDeal · CrmDealContact (contact_id, role) · CrmDealLineItem · Tagging · CustomFieldValue · CrmPipeline/CrmPipelineStage (stage picker, default probability and category) · Document (entity_type CRM_DEAL)
     @ui     shadcn Form (react-hook-form + zod) in a two-column layout; Select (pipeline, stage, currency, forecast category, deal type, source), Combobox = Popover+Command (company, contact, members), DatePicker, Textarea / Tiptap, Switch, file dropzone, Ctrl+Enter submits
     @states validation errors inline · saving · saved (toast with Undo + link) · field-level permission (control disabled with reason) · draft restored · duplicate warning (same company + similar name open) · edit of a closed deal = read-only banner with Reopen
     @audit  deal created (with source record) / updated (field diff) / owner changed
     @note   Stage list depends on the chosen pipeline; stage sets the default probability and forecast category (both overridable). When line items exist, value / one_time_value / recurring_value / discount_amount / tax_amount are DERIVED by the API
             and the Value field becomes read-only. Picking a company prefills contacts, owner (company.owner) and branch. Creating from a lead conversion is /crm/lead-convert, not this form. "Create & add products" jumps to /crm/deal-products.
     ===================================================================================================================== */
  function dealForm(edit) {
    const v = (a, b) => (edit ? box(a, 1) : box(b));
    const vs = (a, b, ic) => sel(edit ? a : b, ic);
    return '<div class="a-page">' + head(edit ? "Edit deal · Acme Rebrand phase 2" : "New deal", edit ? "Changes are audited with a field diff. Stage moves from here also write stage history." : "Create a deal in the Sales pipeline. Only name, pipeline and stage are required.", bt("Cancel", "", "", edit ? "deal" : "deals") + (edit ? "" : bt("Create & add products", "box", "", "deal-products")) + bt(edit ? "Save changes" : "Create deal", "check", "primary", edit ? "deal" : "deal")) +
      '<div class="g2 form-grid"><div>' +
      cd("<b>Deal</b>", ff("Deal name", v("Acme Rebrand phase 2", "e.g. Acme website redesign"), "", 1) + f2(ff("Pipeline", vs("Sales (default)", "Sales (default)", "layers"), "", 1), ff("Stage", vs("Proposal", "New Opportunity"), "Stage sets the default probability and forecast category.", 1)) +
        f2(ff("Company", vs("Acme Corp", "Search company…", "building"), "Not found? <a class='lnk'>Quick-create a company</a> (name only, details later)."), ff("Primary contact", vs("Lena Kovac", "Pick a contact of the company", "users"))) +
        f2(ff("Deal type", vs("Existing customer · expansion", "New business · Existing customer · Renewal")), ff("Lead source", vs("Existing customer", "Referral, Website…"))) +
        ff("Description", editor(edit ? "Phase 2 of the Acme rebrand: website redesign, CMS training and a 12-month maintenance plan." : "What does the customer want? Markdown, “@” mentions, “/” blocks.")) + ff("Next step", v("Send revised scope and updated timeline to Lena", "Short, shown on the board card"), "CrmDeal.next_step. Keep it an action, not a status.")) +
      sp + cd("<b>Value & forecast</b><span class='r muted'>needs crm.financials.read</span>", f3(ff("Currency", sel("EUR · €"), "", 1), ff("Value", edit ? box("€50,400 (derived from 4 line items)", 1) : box("0.00"), edit ? "Read-only while line items exist (§10)." : "Leave 0 and add line items, the API computes the total."), ff("Probability", v("60% (stage default)", "Stage default"), "Override only when this deal differs from the stage.")) +
        f3(ff("Forecast category", vs("Best case", "From stage"), "CrmForecastCategory: Pipeline, Best case, Commit, Closed won, Closed lost."), ff("Expected close", vs("Dec 15, 2026", "Pick a date", "calendar"), "", 0), ff("Competitor", v("Studio North", "Optional"))) +
        (edit ? f3(ff("One-time", box("€43,200", 1), "derived"), ff("Recurring", box("€7,200 / year", 1), "derived"), ff("Discount · Tax", box("€1,200 · €12,096", 1), "derived")) : "")) +
      sp + cd("<b>Contacts on the deal</b><span class='r'>" + btn("Add contact", "plus", "sm") + "</span>", '<div class="rowx">' + who("LK", "p", "Lena Kovac", "Marketing Director") + '<span style="margin-left:auto">' + sel("Decision maker") + '</span>' + sw(1) + '<span class="muted">primary</span></div><div class="rowx">' + who("MD", "", "Marc Dupont", "Finance Lead") + '<span style="margin-left:auto">' + sel("Billing") + "</span>" + more + "</div>" + sub("CrmDealContact.role is free text on the deal, suggested from CrmContactRole. At most one primary contact (CrmDeal.primary_contact_id)."), 1) +
      sp + cd("<b>Products</b><span class='r'>" + bt("Open line-item editor", "box", "sm", "deal-products") + "</span>", edit ? '<div class="rowx"><div class="grow"><b>4 items</b><small>Brand identity refresh · Marketing website redesign · CMS training · Maintenance plan (recurring)</small></div><b class="money ink">€50,400 net</b></div>' : '<div class="rowx"><div class="grow muted">No products yet. Add them after saving or now with “Create & add products”.</div></div>', 1) +
      sp + customFields("CRM_DEAL") + sp + cd("<b>Attachments</b><span class='r muted'>Document · entity_type CRM_DEAL</span>", drop("Drop files or choose from Documents (17)") + sub("Files are stored by Documents (17) with entity_type = CRM_DEAL and entity_id; mark sensitive ones there.")) +
      "</div><div>" +
      cd("<b>Ownership</b>", ff("Owner", sel(edit ? "Anna Meyer" : "Me (Petros R.)", "users"), "", 1) + ff("Secondary owner", sel(edit ? "Kim Lund" : "—", "users")) + ff("Project manager", sel(edit ? "Marco Silva" : "—", "users"), "Who will run the project if this deal is won (05).") + ff("Team", sel("Account Management", "users")) + ff("Branch", sel("Athens", "building"))) + sp +
      tagsCard(edit ? ["rebrand", "priority"] : []) + sp +
      cd("<b>Links</b><span class='r muted'>ids only (03 · 04 · 05)</span>", edit ? '<div class="rowx">' + I("file", 15) + '<div class="grow"><b>Proposal PR-2041</b><small>proposal_id</small></div></div><div class="rowx">' + I("folder", 15) + '<div class="grow muted">No project yet (project_id)</div></div>' : '<div class="rowx"><div class="grow muted">Proposal, contract and project are linked later from the deal page. They are owned by 03, 04 and 05.</div></div>', 1) + sp +
      (edit ? callout("lock", "<b>Closed deals are read-only.</b> A won or lost deal needs “Reopen” (crm.deals.update) before its fields can change.", "") : tgl("Create more", "Keep the form open and reuse pipeline, owner and source", 0)) +
      "</div></div>" + actionsBar("Cancel", edit ? btn("Archive deal", "box") : "", bt(edit ? "Save changes" : "Create deal", "check", "primary", "deal")) +
      dm(["CrmDeal · every column written on create (see @api)", "CrmDealContact · CrmDealLineItem (totals derived) · Tagging · CustomFieldValue · Document (entity_type CRM_DEAL)", "CrmPipeline · CrmPipelineStage (probability, forecast_category defaults) · Membership (owners) · Team · Branch · CrmLeadSource"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE / EDIT LEAD — full page (spec §4, §5, §6)
     @screen New lead · Edit lead
     @route  /crm/lead-new?source=&owner=&from=  ·  /crm/lead-edit (= /crm/leads/:id/edit)  ·  quick create = Dialog (name, email/phone, source) from the list or the global “+”; web forms (19/07 public form) create leads through the same endpoint
     @perm   create crm.leads.create · edit crm.leads.update · set owner crm.leads.assign · estimated value crm.financials.read
     @api    POST /crm/leads {name, company_id? | company_name?, contact_id? | contact_name?, email?, phone?, website?, industry?, estimated_company_size?, estimated_value?, currency?, status_id?, lead_source_id?, owner_membership_id?,
             secondary_owner_membership_id?, branch_id?, qualification{}, qualification_notes?, manual_score?, next_follow_up_at?, description?, tag_ids[], custom_fields{}} · GET /crm/duplicates/check?email=&phone=&company= (while typing)
     @mcp    crm_leads_create
     @data   CrmLead (all columns) · CrmLeadStatus · CrmLeadSource · CrmCompany/CrmContact (optional links) · Tagging · CustomFieldValue · CrmLeadScoringRule (live score preview)
     @ui     shadcn Form, Combobox (existing company/contact), Select (status, source, size), Slider (manual score), Switch/Checkbox (qualification), DatePicker, Textarea, Popover (duplicate preview)
     @states validation inline · duplicate warning (non-blocking, with “Open existing”) · saving · saved toast · field permission · draft restored
     @audit  lead created (with source) / updated / assigned
     @note   A lead may be free text (company_name, contact_name) OR linked to existing records (company_id, contact_id). Duplicate detection runs on email, phone, website domain and name while typing and never blocks. Status defaults to the CrmLeadStatus with is_default.
             lead_score is computed by the API from CrmLeadScoringRule; manual_score (-50..50) adds on top. qualification is a Json (BANT-style) with notes in qualification_notes. Default owner comes from CrmAssignmentRule when the owner is left empty.
     ===================================================================================================================== */
  function leadForm(edit) {
    const v = (a, b) => (edit ? box(a, 1) : box(b));
    return '<div class="a-page">' + head(edit ? "Edit lead · Billing portal" : "New lead", edit ? "Update the lead. Status changes are logged." : "Capture a prospect. Name is required; the rest sharpens the score.", bt("Cancel", "", "", edit ? "lead" : "leads") + bt(edit ? "Save changes" : "Create lead", "check", "primary", "lead")) +
      '<div class="g2 form-grid"><div>' +
      cd("<b>Who</b>", ff("Lead name", v("Billing portal", "What are they looking for? e.g. Billing portal"), "", 1) + f2(ff("Company", sel(edit ? "Initech Ltd" : "Link an existing company…", "building"), "Or type a name below if it is not in CRM yet."), ff("Company name (free text)", v("Initech", "Acme Inc."))) +
        f2(ff("Contact", sel(edit ? "Priya Nair" : "Link an existing contact…", "users")), ff("Contact name (free text)", v("Priya Nair", "Full name"))) +
        f2(ff("Email", v("priya@initech.example", "name@company.com")), ff("Phone", v("+44 20 5550 1212", "+30 …"))) + f3(ff("Website", v("initech.example", "company.com")), ff("Industry", sel(edit ? "Software" : "Select…")), ff("Company size", sel(edit ? "201–500" : "Select…"), "estimated_company_size"))) +
      sp + cd("<b>Qualification</b><span class='r muted'>CrmLead.qualification (Json)</span>", f3(ff("Status", sel(edit ? "Qualified" : "New (default)"), "", 1), ff("Source", sel(edit ? "Referral" : "Select source…")), ff("Estimated value", edit ? box("€24,500", 1) : box("€ 0"), "needs crm.financials.read")) +
        '<div class="qgrid">' + [["Budget confirmed", 1], ["Decision maker identified", 1], ["Clear need", 1], ["Timeline under 90 days", 0]].map((q) => '<div class="rowx"><div class="grow"><b>' + q[0] + "</b></div>" + sw(edit ? q[1] : 0) + "</div>").join("") + "</div>" +
        ff("Qualification notes", ta(edit ? "Replacing a spreadsheet-based invoicing process; budget approved for Q1." : "Needs, budget, authority, timeline…", edit)) +
        ff("Manual score adjustment", '<div class="slider"><i style="width:' + (edit ? 62 : 50) + '%"></i><b style="left:' + (edit ? 62 : 50) + '%"></b></div><div class="sub-note">' + (edit ? "+12" : "0") + " on top of the computed score (manual_score, −50 to +50).</div>")) +
      sp + cd("<b>Notes</b>", ff("Description", editor(edit ? "Found us via the Acme referral. Wants billing and a customer portal in one product." : "Context, how they found us, what was promised."))) +
      sp + customFields("CRM_LEAD") +
      "</div><div>" +
      cd("<b>Assignment</b>", ff("Owner", sel(edit ? "Marco Silva" : "Auto-assign by rule", "users"), "Empty = CrmAssignmentRule (round robin, country, source).") + ff("Secondary owner", sel("—", "users")) + ff("Branch", sel(edit ? "Athens" : "Active branch", "building")) + ff("Next follow-up", sel(edit ? "Tomorrow 10:00" : "Pick a date", "calendar"), "Creates a PLANNED follow-up activity.")) + sp +
      cd("<b>Possible duplicates</b><span class='r muted'>live check</span>", (edit ? '<div class="rowx"><div class="grow muted">No duplicates found.</div></div>' : '<div class="dupe" style="margin:12px">' + I("zap", 14) + " <b>1 possible match.</b> Contact <b>Priya Nair</b> at Initech Ltd has the same email domain.<div style='margin-top:6px'>" + btn("Open existing", "", "sm") + btn("Link instead", "link", "sm") + "</div></div>"), 1) + sp +
      cd("<b>Score preview</b><span class='r muted'>CrmLeadScoringRule</span>", kv("Referral source", "+20") + kv("Estimated value ≥ 25,000", "—") + kv("Right company size", "+10") + kv("Manual", edit ? "+12" : "0") + kv("Total", "<b class='ink'>" + (edit ? 82 : 30) + "</b>")) + sp +
      tagsCard(edit ? ["inbound", "saas"] : []) + sp + tgl("Create more", "Keep the form open after saving", 0) +
      "</div></div>" + dm(["CrmLead · every column written on create", "CrmLeadStatus · CrmLeadSource · CrmLeadScoringRule (preview) · CrmAssignmentRule (default owner)", "Tagging · CustomFieldValue · CrmCompany/CrmContact (links) · CrmActivity (follow-up)", "CrmDuplicateRule (match keys, min score, auto_check) · CrmDuplicateDismissal"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE / EDIT COMPANY — full page (spec §2, §2a, §17, §20)
     @screen New company · Edit company · New vendor · New partner (same form, type preselected)
     @route  /crm/company-new?type=PROSPECT|CUSTOMER|PARTNER|VENDOR|OTHER&parent=&from=lead:<id>  ·  /crm/vendor-new · /crm/partner-new  ·  /crm/company-edit  ·  quick create = Dialog (name, type, website, owner)
     @perm   create crm.companies.create · edit crm.companies.update · financial fields (annual_revenue) crm.financials.read · supplier profile fields need the finance/expense permission of 09
     @api    POST /crm/companies {name, legal_name?, type, parent_company_id?, lifecycle_stage_id?, industry?, company_size?, number_of_employees?, annual_revenue?, currency?, website?, email?, phone?, country?, address{street,city,postal_code,region}?,
             tax_id?, vat_number?, registration_number?, description?, lead_source_id?, customer_since?, owner/account_manager/success_owner/secondary_owner/project_manager_membership_id?, team_id?, branches[{branch_id, relation_type, is_primary}], external_ids{}, tag_ids[], custom_fields{}}
             · POST /crm/vat/validate {vat_number} (VIES lookup)
     @mcp    crm_companies_create, crm_companies_update
     @data   CrmCompany (all columns) · CrmCompanyBranch (branch_id, relation_type CrmBranchRelationType, is_primary) · CrmLifecycleStage · CrmLeadSource · Tagging · CustomFieldValue · read-only/link: LedgerSupplierProfile (09, vendors)
     @ui     shadcn Form, Select (type, size, country), Combobox (parent company, members, team), DatePicker, Table (branch relations), Switch, file dropzone
     @states validation inline · duplicate warning on name/domain/VAT (non-blocking, “Open existing” / “Merge later”) · VAT lookup result · saving · saved · field permission · draft restored
     @audit  company created / updated / owner changed / lifecycle changed (also CrmLifecycleHistory)
     @note   One record model: type + lifecycle stage tell prospects, customers, partners and vendors apart. Changing type to CUSTOMER suggests setting lifecycle stage and customer_since. A company is NOT a platform Organization (01) and NOT a Branch (01):
             CrmCompanyBranch only says which of OUR branches serves it (relation_type OWNER, SALES, DELIVERY, SUPPORT, BILLING, OTHER). VENDOR: the supplier profile (payment terms, default expense category, VAT treatment) is created in Income & expenses (09)
             (LedgerSupplierProfile.company_id) and shown here as a link card, not duplicated. parent_company_id builds the group hierarchy.
     ===================================================================================================================== */
  function companyForm(mode) {
    const edit = mode === "edit", vendor = mode === "VENDOR", partner = mode === "PARTNER";
    const v = (a, b) => (edit ? box(a, 1) : box(b));
    const type = edit ? "CUSTOMER" : vendor ? "VENDOR" : partner ? "PARTNER" : "PROSPECT";
    return '<div class="a-page">' + head(edit ? "Edit company · Acme Corp" : vendor ? "New vendor" : partner ? "New partner" : "New company", edit ? "Update the company record." : "Prospect, customer, partner or vendor: one record, the type decides how it is used.", bt("Cancel", "", "", edit ? "company" : vendor ? "vendors" : partner ? "partners" : "companies") + bt(edit ? "Save changes" : "Create company", "check", "primary", "company")) +
      '<div class="g2 form-grid"><div>' +
      cd("<b>Identity</b>", ff("Company name", v("Acme Corp", "Trading name"), "", 1) + f2(ff("Legal name", v("Acme Corporation S.A.", "Registered legal name")), ff("Type", '<div class="tg">' + ["PROSPECT", "CUSTOMER", "PARTNER", "VENDOR", "OTHER"].map((t) => '<span class="' + (t === type ? "on" : "") + '" title="CrmCompanyType ' + t + '">' + U.en(t) + "</span>").join("") + "</div>", "", 1)) +
        f3(ff("Lifecycle stage", sel(edit ? "Active customer" : vendor || partner ? "—" : "Lead")), ff("Industry", sel(edit ? "Retail" : vendor ? "Hosting" : "Select…")), ff("Parent company", sel("None (top level)", "building"), "Group hierarchy (parent_company_id)")) +
        f3(ff("Company size", sel(edit ? "51–200" : "Select…")), ff("Employees", v("140", "Number")), ff("Annual revenue", v("€18,000,000", "€")), "") + ff("Description", editor(edit ? "Greek retail group, 24 stores. Customer since March 2025." : "Who they are and why they matter."))) +
      sp + cd("<b>Contact information</b>", f3(ff("Website", v("acme.example", "company.com")), ff("Email", v("hello@acme.example", "info@company.com")), ff("Phone", v("+30 210 555 0100", "+30 …"))) +
        ff("Address", f2(ff("Street", v("12 Ermou Street", "")), ff("City", v("Athens", ""))) + f3(ff("Postal code", v("10563", "")), ff("Region", v("Attica", "")), ff("Country", sel(edit ? "Greece" : "Select…", "globe"))))) +
      sp + cd("<b>Legal & tax</b>", f3(ff("Tax ID", v("998877665", "")), ff("VAT number", v("EL998877665", "EL123456789"), btn("Validate (VIES)", "check", "sm")), ff("Registration number", v("GEMI 123456701000", ""))) + ff("Default currency", sel("EUR · €"))) +
      sp + cd("<b>Branches that serve this company</b><span class='r'>" + btn("Add branch", "plus", "sm") + "</span>", tbl(["Branch", "Relation", "Primary", ""], [["Athens", E("OWNER"), sw(1), more], ["Thessaloniki", E("DELIVERY"), sw(0), more]]) + sub("CrmCompanyBranch. These are OUR branches (01), not the customer's offices."), 1) +
      (vendor ? sp + cd("<b>Supplier profile</b><span class='r muted'>LedgerSupplierProfile · module 09</span>", callout("link", "Payment terms, default expense category, VAT treatment and matching aliases are created in <b>Income & expenses (09)</b>. After saving you can open the profile from the vendor page. CRM stores only the company.") + f3(ff("Payment terms", box("30 days (suggested)")), ff("Default category", box("Hosting & infrastructure")), ff("VAT treatment", box("Standard"))), 1) : "") +
      (partner ? sp + cd("<b>Partnership</b>", f2(ff("Partner kind", sel("Referral partner"), "A tag (Tagging): the kind is a label, not a column."), ff("Commission", box("10 %"), "CrmCompany.partner_commission_percent: share of the first-year revenue of referred deals. The payout is an expense in 09."))) : "") +
      sp + customFields("CRM_COMPANY") +
      "</div><div>" +
      cd("<b>Ownership</b>", ff("Owner", sel(edit ? "Petros R." : "Me", "users"), "", 1) + ff("Account manager", sel(edit ? "Anna Meyer" : "—", "users")) + ff("Customer success", sel(edit ? "Kim Lund" : "—", "users")) + ff("Secondary owner", sel(edit ? "Marco Silva" : "—", "users")) + ff("Project manager", sel(edit ? "Anna Meyer" : "—", "users")) + ff("Team", sel(edit ? "Account Management" : "—", "users"))) + sp +
      cd("<b>Relationship</b>", ff("Lead source", sel(edit ? "Referral" : "Select…")) + ff("Customer since", sel(edit ? "Mar 2025" : "—", "calendar"), "Set automatically when the lifecycle stage first counts as customer.")) + sp +
      tagsCard(edit ? ["retail", "retainer"] : vendor ? ["infrastructure"] : []) + sp +
      cd("<b>External ids</b><span class='r muted'>external_ids Json</span>", f2(ff("Stripe customer", box("cus_Q8xK… (08)")), ff("Accounting id", box("ACME-001"))) + sub("Read-only links to other systems; written by integrations.")) + sp +
      cd("<b>Possible duplicates</b>", edit ? '<div class="rowx muted">None found.</div>' : '<div class="dupe" style="margin:12px">' + I("zap", 14) + " <b>1 possible match.</b> “Acme Corporation” (same website domain). <div style='margin-top:6px'>" + btn("Open existing", "", "sm") + "</div></div>", 1) + sp + tgl("Create more", "", 0) +
      "</div></div>" + dm(["CrmCompany · every column written on create (see @api)", "CrmCompanyBranch · CrmLifecycleStage · CrmLeadSource · Tagging · CustomFieldValue", "Read-only link: LedgerSupplierProfile (09) for vendors"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE / EDIT CONTACT — full page (spec §3)
     @screen New contact · Edit contact
     @route  /crm/contact-new?company=&from=lead:<id>  ·  /crm/contact-edit  ·  quick create = Dialog (first name, email, company)
     @perm   create crm.contacts.create · edit crm.contacts.update · consent changes are audited
     @api    POST /crm/contacts {first_name, last_name?, job_title?, department?, company_id?, roles[], contact_type?, email?, emails[], phone?, mobile?, phones[], website?, linkedin_url?, social_profiles{}, lifecycle_stage_id?, lead_source_id?,
             address{}?, owner_membership_id?, secondary_owner_membership_id?, timezone?, language?, consent{}, description?, tag_ids[], custom_fields{}}
     @mcp    crm_contacts_create, crm_contacts_update
     @data   CrmContact (all columns) · CrmContactRole (PRIMARY, DECISION_MAKER, TECHNICAL, BILLING, PROJECT_STAKEHOLDER, EXECUTIVE) · CrmLifecycleStage · CrmLeadSource · Tagging · CustomFieldValue
     @ui     shadcn Form, Combobox (company), ToggleGroup / multi-select Badge picker (roles), Input array (emails, phones), Select (timezone, language), Switch (consent per channel), DatePicker
     @states validation inline · duplicate warning on email / phone / name+company · saving · saved · draft restored
     @audit  contact created / updated; consent granted or withdrawn (channel, source, timestamp)
     @note   A contact is a PERSON at a company, not a platform User. email is the primary address; emails (Json) holds additional labelled addresses. consent (Json) = per channel {granted, source, at}; Communication Center (11) enforces it (CommConsent) and
             owns suppression lists, this form only records what the person told us. BILLING role contacts feed BillingProfile.billing_contact_ids (08). Contact-level portal access is a separate CustomerPortalMembership (07), not created here.
     ===================================================================================================================== */
  function contactForm(edit) {
    const v = (a, b) => (edit ? box(a, 1) : box(b));
    return '<div class="a-page">' + head(edit ? "Edit contact · Lena Kovac" : "New contact", edit ? "Update the person's details and consent." : "A person at a company. First name is required.", bt("Cancel", "", "", edit ? "contact" : "contacts") + bt(edit ? "Save changes" : "Create contact", "check", "primary", "contact")) +
      '<div class="g2 form-grid"><div>' +
      cd("<b>Person</b>", f2(ff("First name", v("Lena", "First name"), "", 1), ff("Last name", v("Kovac", "Last name"))) + f2(ff("Job title", v("Marketing Director", "e.g. CTO")), ff("Department", v("Marketing", ""))) +
        f2(ff("Company", sel(edit ? "Acme Corp" : "Search company…", "building")), ff("Contact type", v("Employee", "Optional label"))) +
        ff("Roles at the company", '<div class="tg">' + ["PRIMARY", "DECISION_MAKER", "TECHNICAL", "BILLING", "PROJECT_STAKEHOLDER", "EXECUTIVE"].map((r) => '<span class="' + (edit && (r === "PRIMARY" || r === "DECISION_MAKER") ? "on" : "") + '" title="CrmContactRole ' + r + '">' + U.en(r) + "</span>").join("") + "</div>", "Several roles allowed. Billing contacts receive invoices (08).")) +
      sp + cd("<b>Channels</b>", f2(ff("Email", v("lena@acme.example", "name@company.com")), ff("Phone", v("+30 210 555 0101", ""))) + f2(ff("Mobile", v("+30 691 555 0101", "")), ff("Website", v("", "https://"))) +
        ff("Additional emails", '<div class="rowx" style="padding:0">' + box(edit ? "lena.kovac@personal.example" : "Add another email", edit) + sel("Personal") + btn("", "plus", "sm") + "</div>", "emails Json: [{label, value}]") + f2(ff("LinkedIn", v("linkedin.com/in/lenakovac", "")), ff("Other profiles", box("X / Instagram…"), "social_profiles Json"))) +
      sp + cd("<b>Address</b><span class='r muted'>address Json</span>", f2(ff("Street", v("12 Ermou Street", "")), ff("City", v("Athens", ""))) + f3(ff("Postal code", v("10563", "")), ff("Region", v("Attica", "")), ff("Country", sel(edit ? "Greece" : "Select…", "globe")))) +
      sp + cd("<b>Locale</b>", f2(ff("Time zone", sel("Europe/Athens (UTC+2)", "globe")), ff("Language", sel("English")))) +
      sp + cd("<b>Marketing consent</b><span class='r muted'>CrmContact.consent · enforced by 11</span>", [["Email marketing", 1, "Web form · Oct 4 2026"], ["Email service messages", 1, "Contract · Mar 2025"], ["SMS", 0, "Not asked"], ["Phone", 0, "Not asked"]].map((c) => '<div class="rowx"><div class="grow"><b>' + c[0] + "</b><small>" + (edit ? c[2] : "Source is recorded when you grant consent") + "</small></div>" + sw(edit ? c[1] : 0) + "</div>").join("") + sub("Granting records channel, source and time. Withdrawal is immediate and audited. Suppression lists live in Communication Center (11)."), 1) +
      sp + cd("<b>Notes</b>", ff("Description", editor(edit ? "Prefers short emails, decides budget with Marc. Free on Tuesdays." : "Anything useful to remember about this person."))) + sp + customFields("CRM_CONTACT") +
      "</div><div>" +
      cd("<b>Relationship</b>", ff("Owner", sel(edit ? "Anna Meyer" : "Me", "users")) + ff("Secondary owner", sel("—", "users")) + ff("Lifecycle stage", sel(edit ? "Customer" : "Lead")) + ff("Lead source", sel(edit ? "Referral" : "Select…"))) + sp +
      cd("<b>Possible duplicates</b>", edit ? '<div class="rowx muted">None found.</div>' : '<div class="dupe" style="margin:12px">' + I("zap", 14) + " <b>1 possible match.</b> Same email domain and similar name: “Lena Kovač”, Acme Corp. <div style='margin-top:6px'>" + btn("Open existing", "", "sm") + "</div></div>", 1) + sp +
      tagsCard(edit ? ["champion", "retail"] : []) + sp + tgl("Create more", "", 0) + "</div></div>" +
      dm(["CrmContact · every column written on create (see @api)", "CrmContactRole · CrmLifecycleStage · CrmLeadSource · Tagging · CustomFieldValue"], []) + "</div>";
  }

  /* =====================================================================================================================
     LOG / SCHEDULE ACTIVITY — full page, one form with a section per type (spec §12–§16)
     @screen Log activity: Call · Meeting · Email · Follow-up (type tabs switch the middle section)
     @route  /crm/activity-new?type=CALL&company=&contact=&lead=&deal=  ·  /crm/activity-meeting · /crm/activity-email · /crm/activity-followup  ·  quick log = Popover on any record page (type, title, outcome)
     @perm   create crm.activities.create · complete/edit crm.activities.update · attendee availability and calendar sync need calendar.events.create (19) · “Also create a task” needs tasks.tasks.create (06)
     @api    POST /crm/activities {type, status, priority, title, description?, company_id?, contact_id?, lead_id?, deal_id?, project_id?, owner_membership_id?, starts_at?, ends_at?, duration_minutes?, location?, meeting_url?, outcome?, participants[{membership_id|contact_id}],
             sync_calendar?, create_task?} · PATCH /crm/activities/:id {status: COMPLETED, outcome}
     @mcp    crm_activities_create
     @data   CrmActivity (type CrmActivityType: CALL, MEETING, FOLLOW_UP, REMINDER, APPOINTMENT, INTERNAL_COMMENT, EMAIL, OTHER; status PLANNED, COMPLETED, CANCELLED, NO_SHOW; priority CrmPriority LOW, NORMAL, HIGH, URGENT) · CrmActivityParticipant ·
             CalendarEvent (19, via calendar_event_id) · Task (06, optional follow-up task, linked back by TaskLink)
     @ui     shadcn Form, ToggleGroup (type), Combobox (related record, participants), DatePicker + time Select, Select (priority, duration, outcome), Switch (sync to calendar, create task), Textarea
     @states validation inline · saving · saved toast · conflict warning (attendee busy, from 19) · permission (calendar sync disabled with reason)
     @audit  activity created / completed / cancelled / no-show
     @note   Logging a COMPLETED activity updates last_activity_at on the company, contact, lead and deal (the API does it, never the client). A PLANNED MEETING creates a Calendar (19) event and stores calendar_event_id; reschedule from either side stays in sync.
             Follow-ups with a due date are Tasks (06), not activities: the toggle creates a Task linked to the same record instead of storing it here (FOLLOW_UP and REMINDER activities stay for light reminders).
             EMAIL: manual log stores subject and body in title/description; real sent/received email is created by Communication Center (11). CALL: direction (CrmActivityDirection INBOUND | OUTBOUND) and an optional recording stored as a sensitive Document (17, recording_document_id). A logged EMAIL links the real message of 11 through comm_message_id.
     ===================================================================================================================== */
  function activityForm(type) {
    const T = [["CALL", "phone", "activity-new"], ["MEETING", "video", "activity-meeting"], ["EMAIL", "mail", "activity-email"], ["FOLLOW_UP", "clock", "activity-followup"]];
    const types = '<div class="tg tg-ic">' + T.map((t) => '<span class="' + (t[0] === type ? "on" : "") + '" onclick="' + go(t[2]) + '" title="CrmActivityType ' + t[0] + '">' + I(t[1], 14) + U.en(t[0]) + "</span>").join("") + '<span title="CrmActivityType REMINDER">' + I("bell", 14) + "Reminder</span><span title=\"CrmActivityType OTHER\">Other</span></div>";
    const title = { CALL: "Call with Lena Kovac", MEETING: "Scope review with Lena", EMAIL: "Re: updated timeline", FOLLOW_UP: "Check in after the proposal" }[type];
    const mid = type === "CALL" ? cd("<b>Call</b>", ff("Direction", '<div class="tg"><span class="on">Outbound</span><span>Inbound</span></div>', "CrmActivity.direction (CrmActivityDirection).") + f3(ff("Status", sel("Completed")), ff("When", sel("Today 14:30", "calendar")), ff("Duration", sel("25 minutes"))) + ff("Outcome", sel("Connected · interested"), "CrmActivity.outcome (free text). Suggested: Connected, Left voicemail, No answer, Wrong number.") + ff("Notes", editor("What was discussed, objections, agreed next step.")) + ff("Recording (optional)", box("Attach from Documents (17)"), "Stored as a sensitive Document: CrmActivity.recording_document_id.")) :
      type === "MEETING" ? cd("<b>Meeting</b>", f3(ff("Status", sel("Planned")), ff("Starts", sel("Nov 14, 10:30", "calendar")), ff("Ends", sel("Nov 14, 11:15", "calendar"))) + f2(ff("Location", box("Acme HQ, Athens")), ff("Video link", box("https://meet.example/abc-defg"))) +
        ff("Attendees", '<div class="rowx" style="padding:0;flex-wrap:wrap">' + who("AM", "", "Anna Meyer", "organizer") + who("LK", "p", "Lena Kovac", "invited") + who("JW", "g", "Jo Walsh", "invited") + btn("Add", "plus", "sm") + "</div>", "CrmActivityParticipant: members and contacts with a response (accepted, declined, tentative).") + tgl("Add to calendar (19)", "Creates the event, checks availability and sends invitations", 1) + ff("Agenda", editor("Agenda items…"))) :
      type === "EMAIL" ? cd("<b>Email</b>", ff("Direction", '<div class="tg"><span>Outbound</span><span class="on">Inbound</span></div>', "CrmActivity.direction. Mail sent or received through 11 is linked with comm_message_id.") + f2(ff("From", sel("anna@logiqdev.example")), ff("To", sel("lena@acme.example", "mail"))) + ff("Subject", box("Re: updated timeline", 1), "Stored in the activity title.") + ff("Body", editor("Paste or summarize the message. Sent mail from Communication Center (11) is logged automatically.")) + callout("link", "To send an email use <b>Communication Center (11)</b>. This form only logs mail that happened elsewhere.")) :
      cd("<b>Follow-up</b>", f3(ff("Status", sel("Planned")), ff("Due", sel("Nov 18, 09:00", "calendar")), ff("Priority", sel("Normal"))) + ff("What to follow up", editor("Ask Lena whether the revised scope is approved.")) + tgl("Also create a task in Tasks (06)", "Recommended when the follow-up has an owner, due date and needs tracking. Linked back with TaskLink.", 1) + tgl("Remind me", "Notification 1 day before (14)", 1));
    return '<div class="a-page">' + head(type === "MEETING" ? "Schedule meeting" : "Log activity", "Calls, meetings, emails and follow-ups against a company, contact, lead or deal (§13).", bt("Cancel", "", "", "activities") + bt(type === "MEETING" ? "Schedule" : "Save activity", "check", "primary", "activities")) +
      '<div class="g2 form-grid"><div>' + cd("<b>Type</b>", types, 0) + sp + cd("<b>Summary</b>", ff("Title", box(title, 1), "", 1) + f2(ff("Priority", sel("Normal")), ff("Owner", sel("Anna Meyer", "users")))) + sp + mid + "</div><div>" +
      cd("<b>Related to</b><span class='r muted'>at least one</span>", ff("Deal", sel("Acme Rebrand phase 2", "crm")) + ff("Company", sel("Acme Corp", "building")) + ff("Contact", sel("Lena Kovac", "users")) + ff("Lead", sel("—", "inbox")) + ff("Project (05)", sel("—", "folder"), "Only for meetings and calls about a delivery project."), 0) + sp +
      cd("<b>After saving</b>", '<div class="rowx"><div class="grow"><b>Update last activity</b><small>company, contact, lead, deal</small></div>' + I("check", 14) + '</div><div class="rowx"><div class="grow"><b>Next activity</b><small>earliest PLANNED activity or open task</small></div>' + I("check", 14) + "</div>", 1) + sp + tgl("Log another", "Keep the form open", 0) + "</div></div>" +
      dm(["CrmActivity · every column written on create", "CrmActivityParticipant · membership_id | contact_id, response", "Link/Read: CalendarEvent (19) via calendar_event_id · Task (06) via TaskLink · CommMessage (11) via comm_message_id · Document (17) via recording_document_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     NOTES and ATTACHMENTS sections (reused on deal, lead, company and contact pages) (spec §16, 17 Documents)
     @screen Notes block · Files block
     @perm   notes: read crm.<entity>.read · private notes crm.notes.private.read* · write crm.<entity>.update · files: documents.documents.read / create (17) · sensitive documents need their own access rule
     @api    GET/POST /crm/notes?entity_type=CRM_DEAL&entity_id= · PATCH/DELETE /crm/notes/:id · GET /documents?entity_type=CRM_DEAL&entity_id= · POST /documents (multipart, entity_type + entity_id)
     @mcp    crm_notes_create (via the entity update tools) · documents tools (17)
     @data   CrmNote (entity_type RecordEntityType, entity_id, author_membership_id, body, is_private, mentions[], pinned, edited_at, edit_history) · Document (entity_type, entity_id, company_id, customer_visible, is_sensitive, filename, size, mimetype, current_version_id)
     @ui     Tiptap editor (mentions, markdown), Switch (private), Card list, DropdownMenu (edit, pin, delete), file dropzone (uploads to 17), Table (files), Badge
     @states loading · empty ("No notes yet") · error · private notes hidden (not blurred) without the key · upload progress / virus-scan pending / failed
     @audit  note created/edited/deleted (edit_history keeps previous bodies) · document uploaded/downloaded/deleted (17)
     @note   Notes are CRM-owned (CrmNote); FILES ARE NOT: they are Documents (17) pointing at the record through entity_type/entity_id (and company_id), the CRM only lists them and offers upload. Mentions notify through 14.
             A private note is visible to its author and holders of crm.notes.private.read; it never appears in portal views (07), exports or MCP reads without that key.
     ===================================================================================================================== */
  function notesBlock() {
    const n = (who_, when, body, flags) => '<div class="note"><div class="note-h">' + AV(who_, PPL[who_][1]) + "<b>" + PPL[who_][0] + '</b><span class="muted">' + when + "</span><span style='flex:1'></span>" + (flags || "") + more + "</div><p>" + body + "</p></div>";
    return cd("<b>Notes</b><span class='r muted'>CrmNote</span>", '<div class="composer">' + editor("Write a note… “@” to mention a teammate, “/” for blocks.") + '<div class="rowx" style="padding:8px 0 0"><div class="grow muted">' + I("lock", 12) + " Private note: only you and holders of <span class='key'>crm.notes.private.read</span></div>" + sw(0) + btn("Pin", "pin", "sm") + btn("Add note", "", "primary sm") + "</div></div>" +
      n("AM", "Nov 5 · pinned", "Budget is approved, waiting on final scope. Lena will confirm with finance by Nov 14.", '<span class="badge">' + I("pin", 11) + " Pinned</span>") +
      n("PR", "Nov 2 · private", "Discount authority is capped at 8% without CFO sign-off.", '<span class="badge yellow">' + I("lock", 11) + " Private</span>") +
      n("KL", "Oct 28 · edited", "Intro call went well. Marc (finance) wants a retainer, not a one-off. <b>@Anna Meyer</b> please check the SLA wording.", "") + "", 0);
  }
  function filesBlock() {
    return cd("<b>Files</b><span class='r muted'>Documents (17) · entity_type + entity_id</span>", drop("Drop files here or pick from Documents (17)") + tbl(["File", "Size", "Added by", "Date", "Visibility", ""], [
      [I("file", 14) + " " + ink("Acme brand brief.pdf"), "2.4 MB", "Anna Meyer", "Nov 4", E("Internal"), more],
      [I("file", 14) + " " + ink("Scope v2.docx"), "184 KB", "Marco Silva", "Nov 8", E("Customer visible", "blue"), more],
      [I("lock", 14) + " " + ink("NDA signed.pdf"), "612 KB", "Petros R.", "Oct 12", '<span class="badge yellow">Sensitive</span>', more],
    ]) + sub("Visibility = Document.customer_visible / is_sensitive. Customers see only customer-visible files in the portal (07)."), 0);
  }
  /* @impl logBar(): quick-log buttons on every record page: Popover with type, title, outcome (CALL, MEETING, EMAIL, FOLLOW_UP) -> POST /crm/activities with the record id prefilled; "More options" opens /crm/activity-new?deal=. */
  const logBar = () => '<div class="rowx" style="padding:0;gap:8px;flex-wrap:wrap">' + bt("Log call", "phone", "sm", "activity-new") + bt("Schedule meeting", "video", "sm", "activity-meeting") + bt("Log email", "mail", "sm", "activity-email") + bt("Follow-up", "clock", "sm", "activity-followup") + "</div>";
  const timeline = (rows) => '<div class="tl">' + rows.map((r) => '<div class="ev"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>").join("") + "</div>";

  /* =====================================================================================================================
     LEAD DETAIL (spec §4, §6, §7, §16)
     @screen Lead page
     @route  /crm/leads/:leadId?tab=overview|activity|notes|files
     @perm   VIEW crm.leads.read · edit crm.leads.update · assign crm.leads.assign · convert crm.leads.convert · archive crm.leads.archive · delete crm.leads.delete* · value crm.financials.read · private notes crm.notes.private.read*
     @api    GET /crm/leads/:id (+score breakdown, activities summary) · PATCH /crm/leads/:id · POST /crm/leads/:id/status {status_id, lost_reason?} · POST /crm/leads/:id/convert · GET /crm/leads/:id/timeline
     @mcp    crm_leads_read, crm_leads_update, crm_leads_convert
     @data   CrmLead (all columns) · CrmLeadStatus · CrmLeadSource · CrmLeadScoringRule (breakdown) · CrmActivity (lead_id) · CrmNote (CRM_LEAD) · Tagging · CustomFieldValue · Document (CRM_LEAD)
     @ui     Header card with status Stepper (Select on mobile), Tabs, Card, kv rows with inline edit, Progress (score), Dialog (lost reason), Timeline, Tiptap notes, dropzone
     @states loading · not found · error · no-access · converted lead = read-only with links to the created records · lost = reason shown + Reopen
     @audit  lead updated/status changed/assigned/converted/lost/reopened
     @note   The status bar is the organization's CrmLeadStatus rows; moving to the status flagged is_lost asks for lost_reason, moving to is_converted is only possible through Convert (one transaction creating or linking company, contact, deal). A converted lead keeps its history:
             activities and notes follow it to the new records. Score breakdown shows which CrmLeadScoringRule rows matched; manual_score is separate.
     ===================================================================================================================== */
  function lead() {
    const sts = ["New", "Contacted", "Attempting contact", "Connected", "Qualified"];
    return '<div class="a-page"><div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + tile("BP", "blue") + '<div class="nm"><h2>Billing portal ' + lst("Qualified") + '</h2><div class="muted">Initech · Priya Nair · priya@initech.example · source Referral · owner Marco Silva · created Nov 2</div></div>' + bt("Edit", "edit", "", "lead-edit") + btn("Mark lost", "x") + bt("Convert", "check", "primary", "lead-convert") + "</div>" +
      '<div style="padding:4px 20px 18px"><div class="stagebar">' + sts.map((s, i) => '<div class="sg ' + (i < 4 ? "done" : "now") + '"><i></i><span>' + s + "</span></div>").join("") + "</div></div></div>" +
      '<div class="tabset">' + tabs([["o", "Overview"], ["a", "Activity", 5], ["n", "Notes", 3], ["f", "Files", 2]], "o") +
      pane("o", 1, '<div class="crm-split"><div class="stack">' + '<div class="mini-stats" style="margin:0">' + stat("Score", "82", "computed 70 · manual +12") + stat("Estimated value", eur(24500), "EUR") + stat("Next follow-up", "Tomorrow", "10:00 · call") + stat("Last activity", "2h ago", "call, 25 min") + "</div>" +
        cd("<b>Qualification</b><span class='r'>" + btn("Edit", "edit", "sm") + "</span>", kv("Budget confirmed", "Yes") + kv("Decision maker identified", "Yes (Priya Nair)") + kv("Clear need", "Yes") + kv("Timeline under 90 days", "No") + kv("Notes", "Replacing a spreadsheet-based invoicing process; budget approved for Q1.")) +
        cd("<b>Log activity</b>", logBar()) + cd("<b>Description</b>", "<p>Found us via the Acme referral. Wants billing and a customer portal in one product.</p>") +
        "</div><div class=\"stack\">" +
        /* @impl Score breakdown: CrmLeadScoringRule rows that matched, with points; computed by the API, never in the client. */
        cd("<b>Score breakdown</b><span class='r muted'>CrmLeadScoringRule</span>", kv("Referral source", "+20") + kv("Replied recently", "+10") + kv("Right company size", "+10") + kv("Estimated value ≥ 25,000", "—") + kv("Rules total", "70") + kv("Manual adjustment", "+12") + kv("Score", "<b class='ink'>82</b>")) +
        cd("<b>Details</b>", kv("Status", lst("Qualified")) + kv("Source", "Referral") + kv("Owner", "Marco Silva") + kv("Secondary owner", "—") + kv("Branch", "Athens") + kv("Website", "initech.example") + kv("Industry", "Software") + kv("Company size", "201–500") + kv("Tags", tags(["inbound", "saas"]))) +
        cd("<b>Linked records</b>", '<div class="rowx"><div class="grow"><b>Initech Ltd</b><small>company_id · possible match (same website)</small></div>' + btn("Link", "link", "sm") + '</div><div class="rowx"><div class="grow muted">Not converted yet (converted_company_id, converted_contact_id, converted_deal_id empty)</div></div>', 1) +
        "</div></div>") +
      pane("a", 0, cd("<b>Log activity</b>", logBar()) + sp + cd("<b>Timeline</b>", timeline([["Call: qualification call (25 min)", "CrmActivity CALL · COMPLETED · Nov 10 · Marco Silva"], ["Email: pricing overview sent", "CrmActivity EMAIL · Nov 8"], ["Status changed Contacted → Connected", "Nov 6 · Marco Silva"], ["Lead created", "Nov 2 · web form · score 38"], ["Task: prepare demo environment", "Tasks (06) · due Nov 14"]]))) +
      pane("n", 0, notesBlock()) + pane("f", 0, filesBlock()) + "</div>" +
      dm(["CrmLead · all columns (status_id, lead_source_id, owner_membership_id, lead_score, manual_score, estimated_value, qualification, qualification_notes, next_follow_up_at, converted_*_id, lost_reason)", "CrmLeadStatus · CrmLeadSource · CrmLeadScoringRule · CrmActivity (lead_id) · CrmNote · Document · Tagging · CustomFieldValue"], []) + "</div>";
  }

  /* =====================================================================================================================
     CONTACT DETAIL (spec §3, §28)
     @screen Contact page
     @route  /crm/contacts/:contactId?tab=overview|deals|activity|notes|files
     @perm   VIEW crm.contacts.read · edit crm.contacts.update · merge crm.contacts.merge · archive crm.contacts.archive · deals tab crm.deals.read · communication tab needs 11 read access
     @api    GET /crm/contacts/:id · PATCH /crm/contacts/:id · GET /crm/deals?contact_id= · GET /crm/activities?contact_id= · GET /comm/threads?contact_id= (11)
     @mcp    crm_contacts_read, crm_contacts_update
     @data   CrmContact (all columns) · CrmDealContact (role) · CrmDeal (primary_contact_id) · CrmActivity / CrmActivityParticipant · CrmNote · Document · Tagging · CustomFieldValue · read-only: CommThread/CommMessage (11), SupportConversation/Ticket (13), ProjectStakeholder (05), ContractSignatory (04)
     @ui     Header card, Tabs, Card, kv rows, Table, Badge, Timeline
     @states loading · not found · error · no-access · archived banner
     @audit  contact updated/merged/archived; consent changes
     @note   Same aggregation rule as Customer 360: this page links to deals, projects (as stakeholder), contracts (as signatory) and conversations; it owns none of them. Consent shows channel, source and date; enforcing it is 11's job.
     ===================================================================================================================== */
  function contact() {
    return '<div class="a-page"><div class="cd" style="margin-bottom:14px"><div class="hdr-card">' + tile("LK", "purple") + '<div class="nm"><h2>Lena Kovac ' + roleChips(["PRIMARY", "DECISION_MAKER"]) + '</h2><div class="muted">Marketing Director · ' + lnk("company", "Acme Corp") + " · lena@acme.example · +30 210 555 0101 · owner Anna Meyer</div></div>" + btn("Email", "mail") + bt("Log activity", "phone", "", "activity-new") + bt("Edit", "edit", "primary", "contact-edit") + "</div></div>" +
      '<div class="tabset">' + tabs([["o", "Overview"], ["d", "Deals", 3], ["a", "Activity", 8], ["n", "Notes", 2], ["f", "Files"]], "o") +
      pane("o", 1, '<div class="crm-split"><div class="stack">' +
        '<div class="mini-stats" style="margin:0">' + stat("Open deals", 2, eur(108000) + " in play") + stat("Last activity", "2h ago", "call") + stat("Emails (11)", "24", "last Nov 9") + stat("Open tickets (13)", 1, "pricing approval") + "</div>" +
        cd("<b>Recent activity</b><span class='r'>" + btn("Log", "plus", "sm") + "</span>", timeline([["Call: scope follow-up", "CrmActivity · today 15:00 · planned"], ["Meeting: scope review", "Nov 8 · 45 min"], ["Email: proposal PR-2041 viewed", "11 · Nov 9"], ["Consent: email marketing granted", "Oct 4 · web form"]])) +
        cd("<b>Involvement</b>", '<div class="rowx">' + I("crm", 15) + '<div class="grow"><b>Acme Rebrand phase 2</b><small>deal · ' + E("DECISION_MAKER", "purple") + '</small></div><b class="money">' + eur(50400) + '</b></div><div class="rowx">' + I("folder", 15) + '<div class="grow"><b>Acme Rebrand Website</b><small>project stakeholder (05)</small></div></div><div class="rowx">' + I("pen", 15) + '<div class="grow"><b>MSA v3</b><small>contract signatory (04) · signed Oct 30</small></div></div>', 1) +
        "</div><div class=\"stack\">" +
        cd("<b>Details</b>", kv("Job title", "Marketing Director") + kv("Department", "Marketing") + kv("Company", lnk("company", "Acme Corp")) + kv("Roles", roleChips(["PRIMARY", "DECISION_MAKER"])) + kv("Email", "lena@acme.example") + kv("Additional email", "lena.kovac@personal.example") + kv("Phone", "+30 210 555 0101") + kv("Mobile", "+30 691 555 0101") + kv("LinkedIn", "linkedin.com/in/lenakovac") + kv("Time zone", "Europe/Athens") + kv("Language", "English") + kv("Lifecycle", "Customer") + kv("Source", "Referral") + kv("Tags", tags(["champion", "retail"]))) +
        cd("<b>Consent</b><span class='r muted'>enforced by 11</span>", kv("Email marketing", '<span class="badge green">Granted</span> ' + muted("web form · Oct 4")) + kv("Email service", '<span class="badge green">Granted</span> ' + muted("contract · Mar 2025")) + kv("SMS", '<span class="badge">Not asked</span>') + kv("Phone", '<span class="badge">Not asked</span>')) + "</div></div>") +
      pane("d", 0, tbl(["Deal", "Role", "Stage", ">Value", "Owner", "Close"], [[lnk("deal", "Acme Rebrand phase 2"), E("DECISION_MAKER", "purple"), '<span class="badge blue">Proposal</span>', '<span class="money">' + eur(50400) + "</span>", av("AM"), "Dec 15"], [lnk("deal", "Acme maintenance plan"), E("PRIMARY", "blue"), '<span class="badge blue">Qualified</span>', '<span class="money">' + eur(57600) + "</span>", av("KL"), "Dec 10"], ["Acme website (2025)", E("PRIMARY", "blue"), '<span class="badge green">Won</span>', '<span class="money">' + eur(42000) + "</span>", av("AM"), "Feb 2025"]])) +
      pane("a", 0, cd("<b>Log activity</b>", logBar()) + sp + cd("<b>Activities</b>", timeline([["Call: scope follow-up", "planned · today 15:00"], ["Meeting: scope review", "completed · Nov 8"], ["Call: intro", "completed · Oct 28"]]))) +
      pane("n", 0, notesBlock()) + pane("f", 0, filesBlock()) + "</div>" +
      dm(["CrmContact · all columns (roles, emails, phones, consent, timezone, language, lifecycle_stage_id, owner_membership_id)", "CrmDealContact · CrmDeal · CrmActivity · CrmActivityParticipant · CrmNote · Document · Tagging", "Read-only by id: CommMessage (11), Ticket (13), ProjectStakeholder (05), ContractSignatory (04)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CONVERT LEAD — full page (spec §7)
     @screen Lead conversion (3 steps: matches · what to create · confirm)
     @route  /crm/lead-convert?lead=<id>  (also opens as a Dialog from the list row action with the same steps)
     @perm   crm.leads.convert + create keys of whatever is created: crm.companies.create, crm.contacts.create, crm.deals.create (the API refuses the convert if any chosen creation is not allowed) · value crm.financials.read
     @api    GET /crm/leads/:id/convert-preview (duplicate candidates for company and contact, defaults) · POST /crm/leads/:id/convert {company: {existing_id | new{...}}, contact: {existing_id | new{...}}, deal?: {pipeline_id, stage_id, name, value, currency, expected_close_date, owner_membership_id}, create_follow_up_task?}
     @mcp    crm_leads_convert (sensitive for AI callers: human confirmation)
     @data   CrmLead (converted_at, converted_company_id, converted_contact_id, converted_deal_id, status_id -> CrmLeadStatus.is_converted) · CrmCompany · CrmContact · CrmDeal · CrmActivity / CrmNote (re-pointed to the new records) · Document (entity re-pointed)
     @ui     Stepper, RadioGroup (use existing / create new), Table (match candidates with match reasons), shadcn Form (prefilled create sections), Switch, Select, Alert, result Card with links
     @states loading preview · no matches · many matches · validation error per section · saving · success (links to company, contact, deal) · already converted (blocked) · partial permission (section disabled with reason)
     @audit  lead converted (summary event) + created company/contact/deal events with source lead id
     @note   ONE transaction. Duplicate detection (email, website domain, VAT, name similarity) runs before the page shows and ranks candidates; the default is “use existing” when the match is strong. Activities, notes and documents of the lead are RE-POINTED to the new
             records (nothing duplicated), the lead keeps converted_* ids and moves to the CrmLeadStatus flagged is_converted. After converting the lead is read-only.
     ===================================================================================================================== */
  function leadConvert() {
    const steps = '<div class="steps"><span class="st done">' + I("check", 13) + ' 1 Matches</span><span class="st on">2 What to create</span><span class="st">3 Confirm</span></div>';
    return '<div class="a-page">' + head("Convert lead · Billing portal", "Create or link the company, contact and deal in one step. History moves with the lead.", bt("Cancel", "", "", "lead") + bt("Convert lead", "check", "primary", "deal")) + steps +
      '<div class="g2 form-grid"><div>' +
      cd("<b>Company</b><span class='r muted'>Initech</span>", '<div class="dupe" style="margin:0 0 12px">' + I("zap", 14) + " <b>Strong match found.</b> “Initech Ltd” has the same website (initech.example).</div>" +
        '<div class="opt on"><span class="radio on"></span><div><b>Use existing company</b><small>Initech Ltd · Customer · owner Anna Meyer · 1 open deal · match 96% (website, name)</small></div></div>' +
        '<div class="opt"><span class="radio"></span><div><b>Create new company</b><small>Prefilled from the lead: Initech · initech.example · Software · 201–500</small></div></div>' +
        tbl(["Candidate", "Match", "Reason", "Owner"], [[ink("Initech Ltd"), bar(96, "green"), "Website · name", av("AM")], ["Initech Systems", bar(41, "yellow"), "Name similarity", av("NG")]]), 0) + sp +
      cd("<b>Contact</b><span class='r muted'>Priya Nair</span>", '<div class="opt on"><span class="radio on"></span><div><b>Create new contact</b><small>Priya Nair · priya@initech.example · +44 20 5550 1212 · will be added to Initech Ltd</small></div></div><div class="opt"><span class="radio"></span><div><b>Use existing contact</b><small>No contact with this email found</small></div></div>' + f2(ff("Job title", box("Head of Product", 1)), ff("Roles", tg(["Primary", "Decision maker"], ["Primary", "Decision maker"]))), 0) + sp +
      cd("<b>Deal</b><span class='r'>" + sw(1) + "</span>", f2(ff("Deal name", box("Initech billing portal", 1), "", 1), ff("Pipeline", sel("Sales (default)", "layers"))) + f3(ff("Stage", sel("Qualified")), ff("Value", box("€24,500", 1)), ff("Expected close", sel("Dec 18, 2026", "calendar"))) + f2(ff("Owner", sel("Marco Silva", "users")), ff("Lead source", sel("Referral"))) + sub("Value and source come from the lead (estimated_value, lead_source_id)."), 0) + sp +
      cd("<b>Follow-up</b>", tgl("Create a follow-up task in Tasks (06)", "“Schedule discovery call with Priya” due in 3 days, assigned to the deal owner", 1) + tgl("Notify the account owner", "Anna Meyer owns Initech Ltd", 1), 1) +
      "</div><div>" +
      cd("<b>What will happen</b>", [["Link", "Company Initech Ltd (existing)"], ["Create", "Contact Priya Nair at Initech Ltd"], ["Create", "Deal Initech billing portal · €24,500 · Qualified"], ["Move", "5 activities, 3 notes, 2 files from the lead to the new records"], ["Update", "Lead status → Converted, read-only afterwards"]].map((r) => '<div class="rowx"><span class="badge ' + (r[0] === "Create" ? "green" : r[0] === "Link" ? "blue" : "") + '">' + r[0] + '</span><div class="grow">' + r[1] + "</div></div>").join(""), 1) + sp +
      cd("<b>Lead</b>", kv("Name", "Billing portal") + kv("Score", "82") + kv("Source", "Referral") + kv("Owner", "Marco Silva") + kv("Est. value", eur(24500))) + sp +
      callout("link", "Activities, notes and documents <b>move</b> to the new records. Nothing is duplicated, and the lead keeps links to what was created.") + "</div></div>" +
      actionsBar("Cancel", btn("Back", "") + btn("Preview result", "search"), bt("Convert lead", "check", "primary", "deal")) +
      dm(["CrmLead · converted_at, converted_company_id, converted_contact_id, converted_deal_id, status_id", "CrmCompany · CrmContact · CrmDeal (created or linked) · CrmLeadStatus (is_converted)", "CrmActivity · CrmNote · Document (re-pointed to the new records)", "CrmDuplicateRule (match keys, min score) · CrmDuplicateDismissal"], []) + "</div>";
  }

  /* =====================================================================================================================
     CLOSE DEAL: WON / LOST / ABANDONED — full page (spec §9, §11, §31)
     @screen Close deal (tabs Won · Lost · Abandoned) + Reopen
     @route  /crm/deal-close?deal=<id>&as=won|lost|abandoned  ·  dropping a card on a won/lost stage opens this as a Dialog with the same fields
     @perm   crm.deals.change_stage (move to a closed stage) · reopen crm.deals.update · automation side effects need the target module's create key held by the automation's service account (05, 04, 08)
     @api    POST /crm/deals/:id/won {actual_close_date, note?, automation{create_project?, create_contract?, schedule_invoice?, set_customer?}} · POST /crm/deals/:id/lost {lost_reason_id, lost_reason?, competitor?, note?, nurture{task_due?}} · POST /crm/deals/:id/abandon {reason?} · POST /crm/deals/:id/reopen {stage_id}
     @mcp    crm_deals_change_stage (won/lost need human confirmation for AI callers)
     @data   CrmLossReason (catalogue, DEAL|BOTH) · CrmDeal (status CrmDealStatus: OPEN, WON, LOST, ABANDONED; stage_id -> stage with is_won/is_lost; actual_close_date, lost_reason_id -> CrmLossReason, lost_reason (detail), won_note, competitor, forecast_category CLOSED_WON/CLOSED_LOST, probability 100/0) · CrmDealStageHistory · CrmCompany.lifecycle_stage_id / customer_since · Project (05) · Contract (04) · Invoice schedule (08) · Task (06)
     @ui     Tabs (Won, Lost, Abandoned), shadcn Form, DatePicker, ToggleGroup (lost reason presets), Textarea, Switch (automation), AlertDialog (reopen)
     @states validation (lost_reason_id required) · saving · success toast with links to what was created · automation partial failure listed per step · reopen confirmation
     @audit  deal won / lost / abandoned / reopened with reason and automation results
     @note   Won sets status WON, stage to the is_won stage, probability 100, forecast_category CLOSED_WON, actual_close_date and may promote the company to a customer (lifecycle stage with is_customer + customer_since). The side effects are AUTOMATION (module 20): the toggles
             create rules runs, they do not call 05/04/08 directly. Lost REQUIRES a reason from the CrmLossReason catalogue (lost_reason_id, applies_to DEAL or BOTH, managed with crm.settings.manage); lost_reason keeps the free-text detail and won_note the "why we won". ABANDONED = created in error or customer vanished, excluded from win rate. Reopen sets the status back to OPEN and writes stage history.
     ===================================================================================================================== */
  function dealClose() {
    return '<div class="a-page">' + head("Close deal · Acme Rebrand phase 2", eur(50400) + " net · Proposal stage · owner Anna Meyer · expected close Dec 15", bt("Cancel", "", "", "deal")) +
      '<div class="tabset">' + tabs([["w", "Mark as won"], ["l", "Mark as lost"], ["x", "Abandon"], ["r", "Reopen"]], "w") +
      pane("w", 1, '<div class="g2 form-grid"><div>' + cd("<b>Won</b>", f2(ff("Actual close date", sel("Nov 11, 2026", "calendar"), "", 1), ff("Final value", box(eur(50400) + " (from line items)", 1), "Derived from line items; edit them first to change it.")) + ff("What made us win?", editor("Optional note, kept in the deal history and used for win/loss analysis."), "Stored in CrmDeal.won_note.") + ff("Contract signed?", sel("Not yet · contract in 04 is Draft"))) + "</div><div>" +
        cd("<b>What happens next (automation, 20)</b>", tgl("Create project from this deal", "Template “Website redesign”, PM Marco Silva (05)", 1) + tgl("Create contract draft", "From the proposal terms (04)", 1) + tgl("Schedule invoices", "50% on start, 50% on delivery (08)", 0) + tgl("Promote company to customer", "Lifecycle → Customer, customer_since = today", 1) + tgl("Notify the team", "Sales channel + deal owner (14, 12)", 1), 1) + sp +
        callout("zap", "The toggles queue an automation run. If a step fails (for example the project template is missing) the deal is still won and the failure is listed on the deal page.") + "</div></div>" + actionsBar("Cancel", "", bt("Mark as won", "check", "primary", "deal"))) +
      pane("l", 0, '<div class="g2 form-grid"><div>' + cd("<b>Lost</b>", ff("Reason", '<div class="tg">' + ["Price", "Competitor", "No budget", "No decision", "Timing", "Scope mismatch", "Went silent", "Other"].map((x, i) => '<span class="' + (i === 0 ? "on" : "") + '">' + x + "</span>").join("") + "</div>", "Required. Reasons come from the CrmLossReason catalogue (Settings) and are stored as CrmDeal.lost_reason_id.", 1) + f2(ff("Competitor", box("Studio North")), ff("Actual close date", sel("Nov 11, 2026", "calendar"))) + ff("Details", editor("What would have changed the outcome?"), "Free-text detail: CrmDeal.lost_reason.")) + "</div><div>" +
        cd("<b>After losing</b>", tgl("Create a nurture task", "Reconnect in 90 days (06)", 1) + tgl("Keep the lead in nurture", "Lead status → Nurture", 0) + tgl("Notify the owner's manager", "Only for deals over €50k", 1), 1) + "</div></div>" + actionsBar("Cancel", "", bt("Mark as lost", "x", "primary", "deal"))) +
      pane("x", 0, cd("<b>Abandon deal</b>", callout("flag", "Use this for deals created in error, duplicates or customers that no longer exist. <b>Abandoned deals are excluded from win rate and forecast.</b> Status becomes ABANDONED.", "warn") + ff("Reason (optional)", box("Duplicate of Acme maintenance plan")) + actionsBar("Cancel", "", btn("Abandon deal", "box", "primary")))) +
      pane("r", 0, cd("<b>Reopen a closed deal</b>", callout("clock", "Only closed deals can be reopened. The deal goes back to OPEN in the stage you choose and the history keeps the close and reopen events. Automation side effects (project, contract) are <b>not</b> undone.") + ff("Reopen into stage", sel("Negotiation")) + ff("Reason", box("Customer came back with new scope")) + actionsBar("Cancel", "", btn("Reopen deal", "clock", "primary")))) + "</div>" +
      dm(["CrmDeal · status, stage_id, actual_close_date, lost_reason_id, lost_reason, won_note, competitor, forecast_category, probability", "CrmLossReason · name, slug, applies_to, sort_order, archived_at", "CrmDealStageHistory · CrmCompany.lifecycle_stage_id, customer_since", "Automation (20) · Project (05) · Contract (04) · Invoice (08) · Task (06) as targets"], []) + "</div>";
  }

  /* =====================================================================================================================
     DEAL PRODUCTS / LINE ITEMS EDITOR — full page (spec §10)
     @screen Deal line items
     @route  /crm/deal-products?deal=<id>  (also embedded read-only in the deal Overview)
     @perm   VIEW + edit crm.financials.read AND crm.deals.update (without crm.financials.read the screen is not offered) · order discount above your role limit (CrmDiscountPolicy.max_percent) needs crm.deals.approve_discount* · catalog read finance.products.read (08) · create proposal proposals.proposals.create (03)
     @api    GET /crm/deals/:id/line-items · PUT /crm/deals/:id/line-items [{product_id?, name, description, quantity, unit_price, discount_percent|discount_amount, tax_percent, is_recurring, billing_frequency, sort_order}] (totals returned, never sent) · GET /products?q= (08)
     @mcp    crm_deals_update
     @data   CrmDealLineItem (product_id, name, description, quantity, unit_price, discount_percent, discount_amount, tax_percent, net_amount, tax_amount, gross_amount, is_recurring, billing_frequency, sort_order) · CrmDeal (value, one_time_value, recurring_value, discount_amount, discount_percent, discount_approved_by_membership_id, discount_approved_at, tax_amount, currency) · CrmDiscountPolicy (role_id, max_percent) · Product (08, read-only catalog)
     @ui     editable Table (inline cells, drag to reorder with dnd-kit), Popover+Command (catalog search), Select (billing frequency, tax rate), Switch (recurring), summary Card, AlertDialog (remove item)
     @states loading · empty ("Add the first product") · validation (quantity > 0, price ≥ 0, tax 0–100) · saving (optimistic) · conflict 409 · closed deal = read-only
     @audit  line item added / changed / removed (field diff) · deal totals changed
     @note   Items store a PRICE SNAPSHOT from the catalog (Product, 08); later catalog changes never alter the deal. Net = quantity × unit_price − discount; tax = net × tax_percent; gross = net + tax; all three are computed by the API and returned.
             Recurring items carry billing_frequency (MONTHLY, QUARTERLY, YEARLY) and feed recurring_value (annualised) vs one_time_value. The deal value is the sum of gross or net depending on the organization tax display setting (08).
             “Create proposal” copies these items into a Proposal (03) and stores proposal_id on the deal.
     ===================================================================================================================== */
  function dealProducts() {
    const li = [["Brand identity refresh", "Product", 1, 18000, 0, 24, 0, ""], ["Marketing website redesign", "Product", 1, 24000, 5, 24, 0, ""], ["CMS training (workshop)", "Service", 2, 1200, 0, 24, 0, ""], ["Maintenance plan", "Subscription", 12, 600, 0, 24, 1, "Monthly"]];
    const net = li.map((l) => l[2] * l[3] * (1 - l[4] / 100)), nets = net.reduce((a, b) => a + b, 0), tax = net.reduce((a, n, i) => a + n * li[i][5] / 100, 0);
    return '<div class="a-page">' + head("Products · Acme Rebrand phase 2", "Line items drive the deal value (§10). Totals are computed by the server.", bt("Back to deal", "", "", "deal") + bt("Create proposal", "file", "", "deal") + btn("Save line items", "check", "primary")) +
      '<div class="g2 form-grid"><div>' + cd("<b>Line items</b><span class='r'>" + btn("Add custom item", "plus", "sm") + btn("Add from catalog", "box", "sm") + "</span>",
        '<div class="tbl-scroll"><table>' + th(["", "Item", "Type", ">Qty", ">Unit price", ">Discount %", ">VAT %", "Recurring", ">Net", ">Gross", ""]) + "<tbody>" + li.map((l, i) => "<tr><td class='muted'>" + I("menu", 14) + "</td><td><b class='ink' style='font-weight:500'>" + l[0] + "</b><div class='sub-note'>" + (i === 0 ? "Logo, typography, colour system" : i === 3 ? "SLA 4h · 12 months" : "Catalog item · price snapshot Nov 5") + '</div></td><td><span class="muted">' + l[1] + '</span></td><td class="num">' + box(l[2], 1) + '</td><td class="num">' + box(eur(l[3]), 1) + '</td><td class="num">' + box(l[4] ? l[4] : "0", 1) + '</td><td class="num">' + box(l[5], 1) + "</td><td>" + (l[6] ? sw(1) + " " + muted(l[7]) : sw(0)) + '</td><td class="num money">' + eur(net[i]) + '</td><td class="num money ink">' + eur(net[i] * (1 + l[5] / 100)) + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" + '<div class="rowx" style="border-top:1px solid var(--hairline)">' + btn("Add item", "plus", "sm") + '<span class="sub-note">Drag the handle to reorder · Tab moves between cells · Enter adds a row</span></div>', 1) + sp +
        cd("<b>Order discount</b>", f2(ff("Discount on the whole deal", box("0 %", 1), "CrmDeal.discount_percent, applied on top of item discounts. Up to your role limit (CrmDiscountPolicy.max_percent) it applies directly; above it a member with crm.deals.approve_discount must approve."), ff("Approved by", box("—"), "CrmDeal.discount_approved_by_membership_id, set only when approval was needed."))) +
        "</div><div>" + cd("<b>Totals</b><span class='r muted'>from the API</span>", kv("Net (one-time)", eur(nets - 7200)) + kv("Net (recurring, 12 months)", eur(7200)) + kv("Discount", eur(1200)) + kv("VAT", eur(tax)) + kv("Gross", "<b class='ink'>" + eur(nets + tax) + "</b>") + kv("Deal value", "<b class='ink'>" + eur(nets) + "</b> " + muted("(net)")) + kv("Recurring per year", eur(7200)) + kv("Weighted (60%)", eur(nets * 0.6))) + sp +
        cd("<b>Currency</b>", ff("Deal currency", sel("EUR · €")) + sub("Changing currency does not convert prices; re-enter or pick the catalog price list in that currency (08).")) + sp +
        callout("link", "Catalog items come from <b>Products (08)</b>. Items you type by hand have no product_id and are kept only on this deal.") + "</div></div>" +
      dm(["CrmDealLineItem · name, description, quantity, unit_price, discount_percent, discount_amount, tax_percent, net_amount, tax_amount, gross_amount, is_recurring, billing_frequency, sort_order, product_id", "CrmDeal · value, one_time_value, recurring_value, discount_amount, discount_percent, discount_approved_by_membership_id, discount_approved_at, tax_amount, currency", "CrmDiscountPolicy · role_id, max_percent", "Read-only: Product (08)"], []) + "</div>";
  }

  /* =====================================================================================================================
     MERGE DUPLICATES (spec §2, §3, §22 duplicate handling)
     @screen Merge companies · Merge contacts (same layout)
     @route  /crm/company-merge?ids=a,b  ·  /crm/contact-merge?ids=a,b  (from the list bulk bar, the duplicates screen or a record menu)
     @perm   crm.companies.merge / crm.contacts.merge (plus update of both records; the records must be inside the caller's scope)
     @api    GET /crm/companies/merge-preview?ids= (field values, counts of records to move) · POST /crm/companies/merge {survivor_id, merged_ids[], field_choices{field: record_id}, keep_tags, keep_custom_fields}
     @mcp    crm_companies_merge* (human confirmation for AI callers)
     @data   CrmCompany (all columns, field-by-field) · re-pointed: CrmContact, CrmDeal, CrmLead, CrmActivity, CrmNote, CrmCompanyBranch, Tagging, CustomFieldValue, Document.company_id, Proposal.company_id, Contract/ContractParty, Project.company_id, Invoice (08), Ticket (13), CalendarEvent.company_id (19) ·
             CrmContact (company_id) for the contact variant
     @ui     Stepper, two-column compare Table with RadioGroup per field, Card (records that will move), AlertDialog (confirm, irreversible), Badge
     @states loading preview · conflict (a record changed since preview) · saving (background job for large merges) · success (summary) · blocked (different organization scope)
     @audit  merged (survivor id, merged ids, field choices, moved counts); each moved record gets a reference to the merge event
     @note   The survivor keeps its id; merged records are archived and kept as redirects so old links and external ids still resolve (CrmCompany / CrmContact / CrmLead / CrmDeal.merged_into_id and merged_at, plus one CrmMergeLog row). Field choices default to the most complete / most recently updated value. Multi-value data (tags, emails of contacts,
             custom fields) is unioned. Owners that differ are listed, the survivor's owner wins unless chosen. Merge cannot be undone.
     ===================================================================================================================== */
  function merge(kind) {
    const C = kind === "contact";
    const rows = C ? [["Name", "Lena Kovac", "Lena Kovač", 0], ["Email", "lena@acme.example", "lena.kovac@acme.example", 0], ["Phone", "+30 210 555 0101", "—", 0], ["Job title", "Marketing Director", "Head of Marketing", 1], ["Company", "Acme Corp", "Acme Corp", 0], ["Roles", "Primary, Decision maker", "Decision maker", 0], ["Owner", "Anna Meyer", "Marco Silva", 0], ["Consent (email)", "Granted · Oct 4", "—", 0], ["Tags", "champion, retail", "retail", 0]] :
      [["Name", "Acme Corp", "Acme Corporation", 0], ["Legal name", "Acme Corporation S.A.", "—", 0], ["Type", "Customer", "Prospect", 0], ["Lifecycle", "Active customer", "Lead", 0], ["Website", "acme.example", "www.acme.example", 0], ["VAT number", "EL998877665", "EL998877665", 0], ["Industry", "Retail", "Retail", 0], ["Country", "Greece", "Greece", 0], ["Owner", "Petros R.", "—", 0], ["Account manager", "Anna Meyer", "—", 0], ["Customer since", "Mar 2025", "—", 0], ["Tags", "retail, retainer", "acme", 0]];
    const moved = C ? [["Deals as primary or linked contact", 1], ["Activities and participations", 4], ["Notes", 1], ["Documents", 0], ["Proposals, contracts, tickets (ids)", 3]] : [["Contacts", 2], ["Deals", 1], ["Leads", 0], ["Activities", 6], ["Notes", 2], ["Documents (17)", 3], ["Proposals (03), contracts (04), projects (05)", 2], ["Invoices (08), tickets (13), calendar events (19)", 5]];
    return '<div class="a-page">' + head(C ? "Merge contacts" : "Merge companies", "Choose the record to keep and, for each field, the value to keep. Related records move to the survivor.", bt("Cancel", "", "", C ? "contacts" : "companies") + btn("Merge " + (C ? "contacts" : "companies"), "layers", "primary")) +
      '<div class="steps"><span class="st done">' + I("check", 13) + ' 1 Select</span><span class="st on">2 Choose values</span><span class="st">3 Confirm</span></div>' +
      '<div class="g2 form-grid"><div>' + cd("<b>Compare</b><span class='r muted'>choose per field</span>", '<table><thead><tr><th>Field</th><th>' + (C ? "Lena Kovac" : "Acme Corp") + ' <span class="badge green">Keep (survivor)</span></th><th>' + (C ? "Lena Kovač" : "Acme Corporation") + '</th></tr></thead><tbody>' +
        rows.map((r) => "<tr><td class='muted'>" + r[0] + '</td><td><div class="opt' + (r[3] ? "" : " on") + '" style="margin:0;padding:6px 10px"><span class="radio' + (r[3] ? "" : " on") + '"></span>' + r[1] + '</div></td><td><div class="opt' + (r[3] ? " on" : "") + '" style="margin:0;padding:6px 10px"><span class="radio' + (r[3] ? " on" : "") + '"></span>' + r[2] + "</div></td></tr>").join("") + "</tbody></table>", 1) + "</div><div>" +
      cd("<b>Records that will move</b>", moved.map((m) => '<div class="rowx"><div class="grow">' + m[0] + '</div><b class="ink">' + m[1] + "</b></div>").join(""), 1) + sp +
      cd("<b>Options</b>", tgl("Union tags", "Keep tags from both", 1) + tgl("Union custom field values", "Survivor wins on conflicts", 1) + tgl("Keep merged record as redirect", "Old links and external ids still resolve", 1), 1) + sp +
      callout("flag", "<b>This cannot be undone.</b> The merged record is archived; all links to it are redirected to the survivor. The merge is written to the audit log.", "warn") + "</div></div>" +
      dm(C ? ["CrmContact · every field (survivor choice), merged_into_id, merged_at · CrmMergeLog (entity_type, survivor_id, merged_ids, field_choices, moved_counts, merged_by_membership_id)", "Re-pointed: CrmDealContact, CrmDeal.primary_contact_id, CrmActivityParticipant, CrmNote, Tagging, CustomFieldValue, CommConsent (11), ProjectStakeholder (05), ContractSignatory (04)"] : ["CrmCompany · every field (survivor choice), merged_into_id, merged_at · CrmMergeLog (entity_type, survivor_id, merged_ids, field_choices, moved_counts, merged_by_membership_id)", "Re-pointed: CrmContact, CrmDeal, CrmLead, CrmActivity, CrmNote, CrmCompanyBranch, Tagging, CustomFieldValue, Document.company_id and other modules' company_id columns"], []) + "</div>";
  }

  /* =====================================================================================================================
     DUPLICATE DETECTION (spec §22, §3, §2)
     @screen Duplicates inbox
     @route  /crm/duplicates?entity=companies|contacts|leads&match=&min_score=
     @perm   VIEW crm.companies.read / crm.contacts.read / crm.leads.read (per tab) · merge crm.companies.merge / crm.contacts.merge · leads crm.leads.merge · deals crm.deals.merge · dismiss = update key of the entity
     @api    GET /crm/duplicates?entity=&match=&min_score=&cursor= (candidate groups computed by a background job and refreshed on write) · POST /crm/duplicates/:groupId/dismiss · POST /crm/<entity>/merge
     @mcp    crm_duplicates_read
     @data   CrmCompany (name, website domain, vat_number, tax_id, phone, email) · CrmContact (email, emails, phone, mobile, first_name + last_name + company_id) · CrmLead (email, phone, company_name, website)
     @ui     Tabs, Table of candidate groups, Badge (match score, reason), DropdownMenu (Merge, Not a duplicate, Open both), filter bar
     @states loading · empty ("No duplicates found") · error · no-access
     @audit  duplicate dismissed (who, group) · merges (see Merge screen)
     @note   Match keys: email (exact), phone (normalized E.164), website domain, VAT / tax id, name similarity (fuzzy, same country). Candidates are SUGGESTIONS, never auto-merged. Dismissed pairs are remembered so they do not return. The same detector feeds the warnings on create forms,
             the lead conversion step and the import duplicate step. Settings (which keys, thresholds) are CrmDuplicateRule rows per entity type, edited with crm.settings.manage; "Not a duplicate" writes a CrmDuplicateDismissal.
     ===================================================================================================================== */
  function duplicates() {
    const G = [["Acme Corp", "Acme Corporation", "company", 96, "VAT number, website", "2 contacts · 1 deal · 3 files", "companies"], ["Initech Ltd", "Initech Systems", "company", 58, "Name similarity (same country)", "1 contact · 1 deal", "companies"], ["Lena Kovac", "Lena Kovač", "contact", 92, "Email domain, name", "Acme Corp · both", "contacts"], ["Hank Scorpio", "H. Scorpio", "contact", 74, "Phone", "Globex · same company", "contacts"], ["Billing portal (lead)", "Initech billing portal (lead)", "lead", 88, "Email, company", "2 leads · same owner", "leads"]];
    return '<div class="a-page">' + head("Duplicates", "Possible duplicate companies, contacts and leads, found by email, phone, domain, VAT and name similarity.", btn("Rescan", "zap") + btn("Detection settings", "settings")) +
      '<div class="mini-stats">' + stat("Company candidates", 9, "7 strong") + stat("Contact candidates", 14, "8 strong") + stat("Lead candidates", 5, "2 strong") + stat("Dismissed", 31, "not duplicates") + "</div>" +
      '<div class="tabset">' + tabs([["a", "All", 28], ["c", "Companies", 9], ["p", "Contacts", 14], ["l", "Leads", 5]], "a") +
      pane("a", 1, FBAR([["Match score", "≥", "50"], ["Reason", "is any of", "Email, Phone, Domain, VAT, Name"]], btn("Clear", "", "sm ghost")) + tbl(["Record A", "Record B", "Kind", "Match", "Reason", "Would move", ""], G.map((g) => [ink(g[0]), ink(g[1]), E("CRM_" + g[2].toUpperCase()), bar(g[3], g[3] > 85 ? "green" : "yellow"), g[4], '<span class="muted">' + g[5] + "</span>", '<div class="rowx" style="padding:0">' + bt("Merge", "layers", "sm", g[2] === "company" ? "company-merge" : "contact-merge") + btn("Not a duplicate", "", "sm") + "</div>"]))) +
      pane("c", 0, callout("building", "Company candidates only (CrmCompany). Merge needs <span class='key'>crm.companies.merge</span>.")) + pane("p", 0, callout("users", "Contact candidates only (CrmContact). Merge needs <span class='key'>crm.contacts.merge</span>.")) + pane("l", 0, callout("inbox", "Lead candidates only (CrmLead). Merge needs <span class='key'>crm.leads.merge</span>; deals use <span class='key'>crm.deals.merge</span>.")) + "</div>" +
      cd("<b>Detection settings</b><span class='r muted'>CrmDuplicateRule</span>", f3(ff("Match keys", tg(["Email", "Phone", "Domain", "VAT", "Name"], ["Email", "Phone", "Domain", "VAT", "Name"])), ff("Minimum score to show", box("50", 1)), ff("Auto-check on create", sw(1))), 0) +
      dm(["CrmCompany · name, website, vat_number, tax_id, phone, email · CrmContact · email, emails, phone, mobile, first_name, last_name, company_id · CrmLead · email, phone, company_name, website", "CrmDuplicateRule · entity_type, match_keys, min_score, auto_check, enabled", "CrmDuplicateDismissal · entity_type, record_a_id, record_b_id, dismissed_by_membership_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     BULK ASSIGN (spec §20, §21, §31)
     @screen Bulk assign owner
     @route  /crm/bulk-assign?entity=leads|deals|companies|contacts&view=<savedViewId>&filter=<json>  (from the list bulk bar “Assign to…” with More options, or this screen)
     @perm   crm.leads.assign · crm.deals.assign · crm.companies.assign · crm.contacts.assign · rules use crm.settings.manage to EDIT, assigning only needs the assign key
     @api    POST /crm/<entity>/bulk-assign/preview {ids|filter, mode, target} (returns the plan) · POST /crm/<entity>/bulk-assign {ids|filter, mode: owner|round_robin|rule|balance, owner_membership_id?, team_id?, rule_id?, options{notify, move_open_activities, reason}}
     @mcp    crm_leads_assign, crm_deals_assign (bulk allowed for service accounts with the key)
     @data   CrmLead / CrmDeal / CrmCompany / CrmContact (owner_membership_id, secondary_owner_membership_id) · CrmAssignmentRule (conditions, assign_to, priority, enabled) · Membership/Team (candidates) · CrmActivity (open activities optionally re-assigned)
     @ui     Tabs (entity), RadioGroup (mode), Combobox (member/team), Table (preview), Switch (options), Alert
     @states loading preview · empty selection · error · partial failure (per-record reasons: out of scope, locked) · success summary with Undo (within 10 minutes)
     @audit  one owner-changed event per record + a bulk summary event (filter, mode, count)
     @note   Modes: a specific owner, round robin across a team (respects the members' availability and branch), by rule (CrmAssignmentRule; the Automation Engine 20 evaluates, this screen only applies one on demand) and balance by open workload. The preview shows the load per person
             after the change. The caller may only assign to members inside their scope. “Select all” means the FILTER, so the count is re-evaluated by the API.
     ===================================================================================================================== */
  function bulkAssign() {
    return '<div class="a-page">' + head("Bulk assign", "Reassign owners for many records at once. Preview the result before applying.", bt("Cancel", "", "", "leads") + btn("Apply to 24 leads", "check", "primary")) +
      '<div class="tabset">' + tabs([["l", "Leads", 24], ["d", "Deals"], ["c", "Companies"], ["p", "Contacts"]], "l") +
      pane("l", 1, '<div class="g2 form-grid"><div>' + cd("<b>Selection</b>", FBAR([["Status", "is any of", "New, Contacted"], ["Owner", "is", "Nikos Georgiou"], ["Created", "before", "Oct 30"]], btn("Change", "filter", "sm")) + '<div class="rowx"><div class="grow"><b>24 leads</b><small>match this filter, selected by filter (the count is re-checked when you apply)</small></div>' + btn("Review list", "list", "sm") + "</div>", 0) + sp +
        cd("<b>How to assign</b>", '<div class="opt"><span class="radio"></span><div><b>To one person</b><small>Everything goes to the same owner</small></div></div><div class="opt on"><span class="radio on"></span><div><b>Round robin in a team</b><small>Spread evenly across Sales (4 available members), skipping people on leave</small></div></div><div class="opt"><span class="radio"></span><div><b>By assignment rule</b><small>Run “Greek leads → Athens sales team”</small></div></div><div class="opt"><span class="radio"></span><div><b>Balance by workload</b><small>Give each record to the person with the fewest open leads</small></div></div>' + f2(ff("Team", sel("Sales", "users")), ff("Only members of branch", sel("Any branch", "building"))), 0) + sp +
        cd("<b>Options</b>", tgl("Also reassign open activities", "PLANNED calls and meetings of these leads follow the new owner", 1) + tgl("Notify new owners", "One digest per person (14)", 1) + ff("Reason (audit)", box("Nikos on leave until Dec 1")), 1) + "</div><div>" +
        cd("<b>Preview</b><span class='r muted'>load after change</span>", [["AM", 6, 14, 20], ["MS", 6, 11, 17], ["SJ", 6, 9, 15], ["KL", 6, 12, 18]].map((r) => '<div class="rowx">' + own(r[0]) + '<div class="grow muted">+' + r[1] + " (now " + r[2] + " → " + r[3] + ")</div>" + bar(Math.round(r[3] / 20 * 100)) + "</div>").join("") + sub("Nikos Georgiou keeps 3 leads that are out of scope for the chosen team."), 1) + sp +
        callout("zap", "You can undo this for 10 minutes from the notification toast. Owner changes are audited per record.") + "</div></div>") +
      pane("d", 0, callout("crm", "Deals: same modes. Needs <span class='key'>crm.deals.assign</span>. Secondary owner and project manager can be set the same way.")) +
      pane("c", 0, callout("building", "Companies: owner, account manager and customer success each get their own mode. Needs <span class='key'>crm.companies.assign</span>.")) +
      pane("p", 0, callout("users", "Contacts: owner and secondary owner. Uses <span class='key'>crm.contacts.update</span>.", "warn")) + "</div>" +
      dm(["CrmLead / CrmDeal / CrmCompany / CrmContact · owner_membership_id, secondary_owner_membership_id", "CrmAssignmentRule · conditions, assign_to, priority, enabled", "Membership · Team · Branch (candidates) · CrmActivity (owner_membership_id)"], ["crm.companies.assign and crm.contacts.assign keys"]) + "</div>";
  }

  /* =====================================================================================================================
     CUSTOM FIELDS SETTINGS (spec §24, §25, §26)
     @screen Custom fields (definitions, groups, field editor)
     @route  /crm/custom-fields?entity=CRM_COMPANY|CRM_CONTACT|CRM_LEAD|CRM_DEAL|CRM_ACTIVITY  ·  editor opens as a side panel / full page /crm/custom-fields?field=<id>
     @perm   VIEW + manage platform.custom_fields.manage* (sensitive, administration module) · reading values follows the entity's read key · fields marked sensitive in `visibility` need the roles listed there
     @api    GET/POST/PATCH /custom-fields?entity_type= · POST /custom-fields/:id/archive · PUT /custom-field-groups · GET /custom-fields/:id/usage
     @mcp    platform_custom_fields_manage* (human confirmation for AI callers)
     @data   CustomFieldDefinition (key, label, description, type CustomFieldType, entity_types RecordEntityType[], is_shared, is_required, options, default_value, validation, visibility, is_searchable, is_filterable, is_sortable, sort_order, archived_at, group_id) ·
             CustomFieldGroup (name, description, sort_order) · CustomFieldValue (definition_id, entity_type, entity_id, value, value_text)
     @ui     Tabs (entity), sortable Table (dnd-kit), Sheet/Dialog editor with shadcn Form, Select (type), TagInput (options), Switch, multi-select Badge picker (entity types), AlertDialog (archive: shows usage count)
     @states loading · empty per entity · validation (key unique, snake_case, immutable after save) · saving · error · no-access
     @audit  field created/updated/archived; type change blocked when values exist
     @note   `key` is the stable API identifier (§26, immutable); `label` may change. A SHARED field (is_shared) lists several entity types (§25) so one definition serves company, contact and deal. Archived fields keep values but disappear from forms and filters.
             Changing a type is allowed only between compatible types (TEXT -> LONG_TEXT) or when no values exist. Required fields apply to new and edited records; existing records are not blocked until edited. Types: TEXT, LONG_TEXT, NUMBER, DECIMAL, CURRENCY,
             PERCENTAGE, BOOLEAN, DATE, DATETIME, EMAIL, PHONE, URL, DROPDOWN, MULTI_SELECT, RADIO, USER, TEAM, COMPANY, CONTACT, DEAL, RECORD_REFERENCE.
     ===================================================================================================================== */
  function customFieldsPage() {
    const F = [["Contract term (months)", "contract_term_months", "NUMBER", "CRM_DEAL", "General", 0, "1,2,3"], ["Procurement process", "procurement_process", "DROPDOWN", "CRM_DEAL, CRM_COMPANY", "General", 1, "1,2,3"], ["Decision date", "decision_date", "DATE", "CRM_DEAL", "Sales", 0, "1,3"], ["Budget approved", "budget_approved", "BOOLEAN", "CRM_DEAL, CRM_LEAD", "Sales", 0, "1,2,3"], ["Region", "region", "DROPDOWN", "CRM_COMPANY", "General", 0, "1,2"], ["Account tier", "account_tier", "RADIO", "CRM_COMPANY", "Account", 0, "1,2,3"], ["Preferred channel", "preferred_channel", "DROPDOWN", "CRM_CONTACT", "General", 0, "1,2"]];
    return '<div class="a-page">' + head("Custom fields", "Extra fields on companies, contacts, leads, deals and activities. Shared fields serve several record types (§25).", btn("Groups", "layers") + btn("New field", "plus", "primary")) +
      '<div class="tabset">' + tabs([["d", "Deals", 4], ["c", "Companies", 4], ["p", "Contacts", 2], ["l", "Leads", 3], ["a", "Activities", 0]], "d") +
      pane("d", 1, FBAR([["Type", "is any of", "any"], ["Shared", "is", "any"], ["Status", "is", "Active"]], btn("Clear", "", "sm ghost")) + '<div class="g2 form-grid"><div>' + tbl(["", "Label", "Key", "Type", "Used on", "Group", "Required", "Searchable", "Shared", ""], F.map((r) => ["<span class='muted'>" + I("menu", 14) + "</span>", ink(r[0]), '<span class="mono muted">' + r[1] + "</span>", E(r[2]), r[3], r[4], sw(r[5]), sw(1), sw(r[3].indexOf(",") > 0), more])) + "</div>" +
        '<div>' + cd("<b>Field editor</b><span class='r muted'>Procurement process</span>", ff("Label", box("Procurement process", 1), "", 1) + ff("Key", box("procurement_process", 1), "Stable API identifier. Cannot change after save.") + f2(ff("Type", sel("Dropdown")), ff("Group", sel("General"))) +
          ff("Used on", tg(["Companies", "Contacts", "Leads", "Deals", "Activities"], ["Companies", "Deals"]), "Selecting several makes it a shared field (is_shared).") + ff("Options", '<div class="rowx" style="padding:0;flex-wrap:wrap">' + tok("Standard RFP") + tok("Direct award") + tok("Framework") + tok("Tender") + btn("Add", "plus", "sm") + "</div>") +
          ff("Default value", sel("None")) + ff("Validation", box("Max 1 selection")) + tgl("Required", "Blocks save when empty", 0) + tgl("Searchable", "Included in CRM search (§30)", 1) + tgl("Filterable", "Offered in filter bars", 1) + tgl("Sortable", "Offered as a sort column", 0) + ff("Visible to", tg(["Everyone", "Sales", "Finance", "Admins"], ["Everyone"]), "CustomFieldDefinition.visibility Json (roles).") +
          '<div class="form-actions">' + btn("Archive", "box") + '<span style="flex:1"></span>' + btn("Save field", "check", "primary") + "</div>") + "</div></div>") +
      pane("c", 0, callout("building", "Company fields (CustomFieldDefinition with entity_types containing CRM_COMPANY).")) + pane("p", 0, callout("users", "Contact fields.")) + pane("l", 0, callout("inbox", "Lead fields.")) + pane("a", 0, callout("phone", "Activity fields (empty).")) + "</div>" +
      dm(["CustomFieldDefinition · key, label, type, entity_types, is_shared, is_required, options, default_value, validation, visibility, is_searchable, is_filterable, is_sortable, sort_order, archived_at, group_id", "CustomFieldGroup · name, sort_order · CustomFieldValue · definition_id, entity_type, entity_id, value"], []) + "</div>";
  }

  /* =====================================================================================================================
     TAGS SETTINGS (spec §29, platform tables Tag/Tagging)
     @screen Tags
     @route  /crm/tags?entity=&q=
     @perm   VIEW tag list any crm read key · create/rename/recolor/merge/delete platform.tags.manage · applying an existing tag needs update of the record
     @api    GET/POST/PATCH/DELETE /tags?entity_type= · POST /tags/:id/merge {into_id} · POST /taggings {tag_id, entity_type, entity_id} · GET /tags/:id/usage
     @mcp    platform_tags_manage
     @data   Tag (name, slug, color, entity_types RecordEntityType[]) · Tagging (tag_id, entity_type, entity_id)
     @ui     Table, Dialog (create/edit), ColorPicker, multi-select Badge picker (entity types), AlertDialog (delete: shows usage), Command (merge target)
     @states loading · empty · error · no-access
     @audit  tag created/renamed/merged/deleted (with usage counts)
     @note   Tags are organization-wide and shared by every module (Tag.entity_types limits where a tag is OFFERED: empty = everywhere). Deleting a tag removes its taggings; merging moves them to the target. Slug is generated from the name and unique.
     ===================================================================================================================== */
  function tagsPage() {
    const T = [["priority", "red", "Deals, Companies", 14], ["retail", "blue", "Companies, Contacts", 23], ["enterprise", "purple", "Companies", 17], ["saas", "green", "Companies, Leads", 31], ["winback", "yellow", "Companies", 6], ["champion", "green", "Contacts", 9], ["referrer", "purple", "Companies", 11], ["infrastructure", "", "Companies", 4], ["inbound", "blue", "Leads", 38]];
    return '<div class="a-page">' + head("Tags", "Labels shared across CRM and other modules. Organize records without custom fields.", btn("New tag", "plus", "primary")) +
      '<div class="g2 form-grid"><div><div class="toolbar">' + search("Search tags…") + sel("Used on: Any") + "</div>" + tbl(["Tag", "Color", "Offered on", ">Records", ""], T.map((r) => [tok(r[0]), '<span class="sq" style="display:inline-block;width:12px;height:12px;border-radius:3px;background:var(--' + (r[1] || "stone") + ')"></span> ' + (r[1] || "gray"), r[2], r[3], more])) + "</div><div>" +
      cd("<b>Edit tag</b><span class='r muted'>priority</span>", ff("Name", box("priority", 1), "", 1) + ff("Color", '<div class="tg"><span class="on">Red</span><span>Blue</span><span>Green</span><span>Yellow</span><span>Purple</span><span>Gray</span></div>') + ff("Offered on", tg(["Companies", "Contacts", "Leads", "Deals", "Activities", "Projects", "Tasks"], ["Companies", "Deals"]), "Empty = everywhere (Tag.entity_types).") + '<div class="form-actions">' + btn("Merge into…", "layers") + btn("Delete", "x") + '<span style="flex:1"></span>' + btn("Save tag", "check", "primary") + "</div>") + sp +
      callout("tag", "Creating, renaming and merging needs <span class='key'>platform.tags.manage</span>. Everyone who can edit a record can apply existing tags.") + "</div></div>" +
      dm(["Tag · name, slug, color, entity_types", "Tagging · tag_id, entity_type, entity_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     SAVED VIEWS (spec §29)
     @screen Saved views and columns
     @route  /crm/saved-views?entity=CRM_DEAL|CRM_LEAD|CRM_COMPANY|CRM_CONTACT|CRM_ACTIVITY
     @perm   personal views: any read key of the entity · TEAM / ORGANIZATION views: platform.saved_views.manage_shared · default view per user is a personal preference
     @api    GET/POST/PATCH/DELETE /saved-views?entity_type= · POST /saved-views/:id/default
     @mcp    crm_*_read accept view_id
     @data   SavedView (entity_type, name, layout, visibility SavedViewVisibility PERSONAL|TEAM|ORGANIZATION, owner_membership_id, team_id, filters, sorting, grouping, columns, search, is_default)
     @ui     Table, Dialog (rename, share), column chooser (Popover with Checkbox list + drag handle), Select (layout), RadioGroup (visibility), Command (team)
     @states loading · empty · error · no-access
     @audit  view created/shared/deleted (visibility changes are audited)
     @note   A view stores a filter tree (same JSON the API takes), sorting, grouping, visible columns in order and the layout (table | board | list | calendar). TEAM needs team_id. Deleting a shared view warns who uses it. Column chooser is also reachable from every list toolbar.
     ===================================================================================================================== */
  function savedViews() {
    const cols = [["Deal name", 1], ["Company", 1], ["Stage", 1], ["Status", 1], ["Value", 1], ["Probability", 1], ["Forecast", 1], ["Owner", 1], ["Expected close", 1], ["Days in stage", 1], ["Next step", 1], ["Secondary owner", 0], ["Lead source", 0], ["Created", 0], ["Branch", 0], ["Team", 0]];
    return '<div class="a-page">' + head("Saved views", "Filters, sorting and columns you can reopen in one click. Share them with a team or everyone.", btn("New view", "plus", "primary")) +
      '<div class="tabset">' + tabs([["d", "Deals"], ["l", "Leads"], ["c", "Companies"], ["p", "Contacts"], ["a", "Activities"]], "d") + pane("d", 1,
        '<div class="g2 form-grid"><div>' + tbl(["View", "Layout", "Visibility", "Filters", "Default", ""], [[ink("All open"), E("table"), E("ORGANIZATION", "blue"), "status = Open", sw(1), more], [ink("My open deals"), E("table"), E("PERSONAL"), "owner = me · status = Open", sw(0), more], [ink("Closing this month"), E("board"), E("TEAM", "purple"), "expected close = this month", sw(0), more], [ink("Stale deals"), E("table"), E("ORGANIZATION", "blue"), "time in stage > stale limit", sw(0), more], [ink("Big deals Q4"), E("table"), E("PERSONAL"), "value ≥ 50,000 · close in Q4", sw(0), more]]) + "</div><div>" +
        cd("<b>Edit view</b><span class='r muted'>My open deals</span>", ff("Name", box("My open deals", 1)) + f2(ff("Layout", tg(["Table", "Board", "List"], "Table")), ff("Visibility", tg(["Personal", "Team", "Organization"], "Personal"), "Team and organization need platform.saved_views.manage_shared.")) + ff("Sort", box("Expected close ↑ then Value ↓", 1)) + ff("Group by", sel("None")) +
          ff("Columns", '<div class="colgrid">' + cols.map((c) => '<div class="rowx" style="padding:4px 0"><span class="muted">' + I("menu", 12) + "</span>" + cb(c[1]) + '<div class="grow">' + c[0] + "</div></div>").join("") + "</div>", "Drag to reorder. Order and visibility are saved in SavedView.columns.") + '<div class="form-actions"><span style="flex:1"></span>' + btn("Save view", "check", "primary") + "</div>") + "</div></div>") +
        pane("l", 0, callout("inbox", "Lead views (CRM_LEAD).")) + pane("c", 0, callout("building", "Company views (CRM_COMPANY).")) + pane("p", 0, callout("users", "Contact views (CRM_CONTACT).")) + pane("a", 0, callout("phone", "Activity views (CRM_ACTIVITY).")) + "</div>" +
      dm(["SavedView · entity_type, name, layout, visibility, owner_membership_id, team_id, filters, sorting, grouping, columns, search, is_default"], []) + "</div>";
  }

  /* =====================================================================================================================
     IMPORT WIZARD — 5 steps (spec §22)
     @screen Import & export: 1 Upload · 2 Map fields · 3 Duplicates · 4 Preview · 5 Import (progress, result, rollback)
     @route  /crm/imports (step 1 + history) · /crm/import-map · /crm/import-dupes · /crm/import-preview · /crm/import-run  (production: /crm/settings/import/:jobId?step=)
     @perm   import crm.records.import* · export crm.records.export* (+ the entity's own export key) · both sensitive: audited, MFA step-up recommended · rollback needs crm.records.import*
     @api    POST /crm/imports (multipart, creates CrmImportJob PENDING, file saved to Documents 17) · PUT /crm/imports/:id/mapping · PUT /crm/imports/:id/duplicates · POST /crm/imports/:id/validate · GET /crm/imports/:id/preview · POST /crm/imports/:id/start · GET /crm/imports/:id (poll/push progress)
             · GET /crm/imports/:id/errors.csv · POST /crm/imports/:id/rollback · GET /crm/imports/template?entity= · POST /crm/exports {entity_type, view_id|filters}
     @mcp    crm_records_import*, crm_records_export* (human confirmation for AI callers)
     @data   CrmImportJob (entity_type RecordEntityType: CRM_COMPANY|CRM_CONTACT|CRM_LEAD|CRM_DEAL|CRM_ACTIVITY, status CrmImportStatus: PENDING, VALIDATING, PREVIEW, IMPORTING, COMPLETED, FAILED, ROLLED_BACK, document_id, file_name, field_mapping, duplicate_strategy,
             total_rows, imported_rows, updated_rows, skipped_rows, error_rows, errors, created_record_ids, started_by_membership_id, started_at, completed_at, rolled_back_at) · Document (17, sensitive flag)
     @ui     Stepper, file dropzone, mapping Table (Select per CSV column), Table (preview with row status), Progress, Alert, AlertDialog (rollback), Tabs (valid / duplicates / errors)
     @states idle · validating · preview (nothing written yet) · importing (progress, can leave the page) · completed · failed (downloadable error file) · rolled back
     @audit  data.imported / data.exported (entity type and counts, never row data); rollback audited
     @note   PENDING -> VALIDATING -> PREVIEW (nothing written) -> IMPORTING -> COMPLETED | FAILED; ROLLED_BACK undoes only records in created_record_ids (updates cannot be rolled back: the UI says so). Duplicate strategy per entity: skip | update | create with the match key (email, domain, VAT, name).
             Imports run as a background job (queue), never in the request. Saved mappings for repeated imports are CrmImportMapping rows (name, entity_type, field_mapping, duplicate_strategy). Owners are matched by member email; unknown values for lead status or source are created or reported depending on the choice.
     ===================================================================================================================== */
  const impSteps = (n) => '<div class="steps">' + ["Upload", "Map fields", "Duplicates", "Preview", "Import"].map((s, i) => '<span class="st ' + (i + 1 < n ? "done" : i + 1 === n ? "on" : "") + '">' + (i + 1 < n ? I("check", 13) + " " : "") + (i + 1) + " " + s + "</span>").join("") + "</div>";
  const impHist = () => cd("<b>Import history</b><span class='r muted'>CrmImportJob</span>", '<div class="rowx"><div class="grow"><b>contacts.csv</b><small>Nov 2 · 540 rows · 521 imported, 19 skipped</small></div>' + S("COMPLETED") + '</div><div class="rowx"><div class="grow"><b>leads-q3.csv</b><small>Oct 14 · 88 rows · all created</small></div>' + S("COMPLETED") + btn("Roll back", "", "sm") + '</div><div class="rowx"><div class="grow"><b>old-crm.csv</b><small>Sep 3 · 1,204 rows</small></div><span class="badge">Rolled back</span></div><div class="rowx"><div class="grow"><b>deals-2024.csv</b><small>Aug 20 · validation failed: missing stage</small></div>' + S("FAILED") + "</div>", 1);
  function imports() {
    return '<div class="a-page">' + head("Import & export", "Bring companies, contacts, leads, deals and activities in from CSV, with mapping, duplicate detection and rollback (§22).", btn("Export records", "box") + bt("Start import", "plus", "primary", "import-map")) + impSteps(1) +
      '<div class="g-main" style="grid-template-columns:minmax(0,1fr) 340px"><div class="stack">' + cd("<b>What are you importing?</b>", '<div class="tg">' + ["Companies", "Contacts", "Leads", "Deals", "Activities"].map((x, i) => '<span class="' + (i === 0 ? "on" : "") + '">' + x + "</span>").join("") + "</div>" + sp + drop("Drop a CSV file here, or choose a file · max 25 MB · up to 50,000 rows") +
        f3(ff("Delimiter", sel("Comma ( , )")), ff("Encoding", sel("UTF-8")), ff("First row is a header", sw(1))) + '<div class="rowx" style="padding:0">' + btn("Download CSV template", "box", "sm") + btn("Use saved mapping…", "star", "sm") + "</div>" + sub("Saved mappings: CrmImportMapping (per entity type and name). The uploaded file is stored in Documents (17) as a sensitive document.")) +
        cd("<b>Export</b><span class='r muted'>crm.records.export*</span>", f2(ff("Records", sel("Companies · current view")), ff("Format", sel("CSV (UTF-8)"))) + callout("lock", "Exports are sensitive: they are audited with the filter used and need <span class='key'>crm.records.export</span> plus the entity's export key.")) + "</div><div class=\"stack\">" + impHist() + "</div></div>" +
      dm(["CrmImportJob · entity_type, status, document_id, file_name, started_by_membership_id", "Document (17)"], ["Saved import mapping templates (CrmImportMapping)"]) + "</div>";
  }
  function importMap() {
    return '<div class="a-page">' + head("Import & export", "Step 2 of 5: tell the CRM what each column means.", bt("Back", "", "", "imports") + bt("Next: duplicates", "right", "primary", "import-dupes")) + impSteps(2) +
      '<div class="g-main" style="grid-template-columns:minmax(0,1fr) 340px"><div class="stack">' +
      cd("<b>Map columns</b><span class='r muted'>companies.csv · 214 rows → Companies</span>", '<table><thead><tr><th>CSV column</th><th>Sample</th><th>CRM field</th><th>Status</th></tr></thead><tbody>' + [["Company", "Acme Corp", "name", 1], ["Legal name", "Acme Corporation S.A.", "legal_name", 1], ["VAT", "EL998877665", "vat_number", 1], ["Website", "acme.example", "website", 1], ["Type", "customer", "type (CrmCompanyType)", 1], ["Owner email", "anna@logiqdev.example", "owner (match member by email)", 1], ["Region", "Attica", "custom field: region", 1], ["Notes", "Key account", "— skip —", 0]].map((r) => "<tr><td class='ink'>" + r[0] + '</td><td class="muted">' + r[1] + "</td><td>" + sel(r[2]).replace('class="sel"', 'class="sel" style="width:240px"') + "</td><td>" + (r[3] ? '<span class="badge green">Mapped</span>' : '<span class="badge">Ignored</span>') + "</td></tr>").join("") + "</tbody></table>", 1) +
      cd("<b>Value mapping</b>", '<table><thead><tr><th>CSV value</th><th>CRM value</th></tr></thead><tbody>' + [["customer", "Customer (CrmCompanyType)"], ["lead", "Prospect"], ["supplier", "Vendor"], ["agency", "Partner"]].map((r) => "<tr><td class='ink'>" + r[0] + "</td><td>" + sel(r[1]) + "</td></tr>").join("") + "</tbody></table>", 1) + "</div><div class=\"stack\">" +
      cd("<b>Mapping check</b>", kv("Required fields", '<span style="color:var(--green)">name mapped</span>') + kv("Unmapped columns", "1 (ignored)") + kv("Custom fields", "1 matched") + btn("Save mapping as template", "star", "sm")) + impHist() + "</div></div>" +
      dm(["CrmImportJob · field_mapping (Json), entity_type", "CrmCompany fields · CustomFieldDefinition (mappable fields)"], ["Saved import mapping templates"]) + "</div>";
  }
  function importDupes() {
    return '<div class="a-page">' + head("Import & export", "Step 3 of 5: decide what happens when a row matches an existing record.", bt("Back", "", "", "import-map") + bt("Next: preview", "right", "primary", "import-preview")) + impSteps(3) +
      '<div class="g-main" style="grid-template-columns:minmax(0,1fr) 340px"><div class="stack">' +
      cd("<b>Duplicate handling</b><span class='r muted'>duplicate_strategy</span>", ff("Match companies by", '<div class="tg"><span class="on">Website domain</span><span>VAT number</span><span>Name</span><span>Domain, then VAT</span></div>') + ff("When a match is found", '<div class="tg"><span>Skip the row</span><span class="on">Update existing</span><span>Create anyway</span></div>') + ff("Update only empty fields", sw(1), "Keeps what is already filled in CRM.") + callout("zap", "Updates cannot be rolled back. Only records <b>created</b> by this import can be rolled back.", "warn")) +
      cd("<b>Matches found</b><span class='r muted'>11 of 214 rows</span>", tbl(["Row", "CSV company", "Matches", "Reason", "Action"], [["14", "Acme Corporation", ink("Acme Corp"), "VAT number", sel("Update")], ["27", "Initech", ink("Initech Ltd"), "Website domain", sel("Update")], ["58", "Wayne Ent.", ink("Wayne Enterprises"), "Name similarity 91%", sel("Skip")], ["102", "Globex GmbH", ink("Globex"), "Website domain", sel("Update")]]), 1) + "</div><div class=\"stack\">" +
      cd("<b>Summary</b>", kv("Rows", 214) + kv("New records", '<span style="color:var(--green)">196</span>') + kv("Matches", '<span style="color:var(--yellow)">11</span>') + kv("Errors", '<span style="color:var(--red)">7</span>') + btn("Download error file", "box", "sm")) + "</div></div>" +
      dm(["CrmImportJob · duplicate_strategy (Json), errors", "CrmCompany · website, vat_number, name (match keys)"], []) + "</div>";
  }
  function importPreview() {
    return '<div class="a-page">' + head("Import & export", "Step 4 of 5: review what will be written. Nothing has been saved yet.", bt("Back", "", "", "import-dupes") + bt("Start import", "check", "primary", "import-run")) + impSteps(4) +
      '<div class="mini-stats">' + stat("Will create", 196, "companies") + stat("Will update", 11, "existing") + stat("Skipped", 0, "") + stat("Errors", 7, "not imported", 1) + "</div>" +
      '<div class="tabset">' + tabs([["v", "Valid", 207], ["e", "Errors", 7]], "v") + pane("v", 1, tbl(["Row", "Name", "Type", "Website", "Owner", "Action"], [["2", ink("Acme Corp"), E("CUSTOMER", "green"), "acme.example", "Anna Meyer", '<span class="badge blue">Update</span>'], ["3", ink("Soylent Corp"), E("PROSPECT", "blue"), "soylent.example", "Kim Lund", '<span class="badge green">Create</span>'], ["4", ink("Umbrella Ltd"), E("PROSPECT", "blue"), "umbrella.example", "Sofia Jensen", '<span class="badge green">Create</span>'], ["5", ink("Stark Industries"), E("PROSPECT", "blue"), "stark.example", "Nikos Georgiou", '<span class="badge green">Create</span>']])) +
      pane("e", 0, tbl(["Row", "Column", "Problem"], [["31", "VAT", "Invalid format for country GR"], ["57", "Owner email", "No member with this email"], ["88", "Type", "“reseller” is not mapped"], ["93", "Website", "Not a valid URL"]]) + sub("Rows with errors are skipped. Download them, fix and import again.")) + "</div>" +
      cd("<b>Before you start</b>", tgl("Notify me when finished", "Notification (14)", 1) + tgl("Apply automation to imported records", "Assignment rules and workflows run for created records. Turn off for historical data.", 0), 1) +
      dm(["CrmImportJob · status PREVIEW, total_rows, error_rows, errors"], []) + "</div>";
  }
  function importRun() {
    return '<div class="a-page">' + head("Import & export", "Step 5 of 5: importing. You can leave this page, the job keeps running.", bt("Back to import", "", "", "imports")) + impSteps(5) +
      cd("<b>companies.csv</b><span class='r'>" + S("IMPORTING") + "</span>", '<div class="bar" style="width:100%;height:10px"><i style="width:64%"></i></div><div class="sub-note" style="margin-top:6px">136 of 214 rows · started 14:02 · about 1 minute left</div>' + '<div class="mini-stats" style="margin-top:12px">' + stat("Created", 121, "") + stat("Updated", 7, "") + stat("Skipped", 0, "") + stat("Errors", 7, "", 1) + "</div>") + sp +
      cd("<b>Result (when completed)</b><span class='r'>" + S("COMPLETED") + "</span>", kv("Created records", 196) + kv("Updated records", 11) + kv("Errors", "7 · " + btn("Download error file", "box", "sm")) + kv("Completed", "14:03") + '<div class="form-actions">' + btn("Roll back created records", "clock") + '<span style="flex:1"></span>' + bt("View imported companies", "building", "primary", "companies") + "</div>" + callout("flag", "Rolling back removes the 196 records created by this import. The 11 updated records keep their new values.", "warn")) +
      dm(["CrmImportJob · status, imported_rows, updated_rows, skipped_rows, error_rows, errors, created_record_ids, started_at, completed_at, rolled_back_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     REPORTS (spec §33, §34)
     @screen CRM reports (sales performance · lead conversion · lost reasons · activity · velocity · customers)
     @route  /crm/reports?tab=sales|leads|lost|activity|velocity|customers&from=&to=&team=&owner=&pipeline=
     @perm   VIEW crm.dashboards.read · schedule email crm.reports.schedule* · money needs crm.financials.read · team numbers need crm.forecast.read / crm.targets.read · export crm.records.export*
     @api    GET /crm/reports/{sales|lead-conversion|lost-reasons|activity|velocity|customers}?from=&to=&team_id=&owner_id=&pipeline_id= · POST /crm/exports {entity_type: report, ...}
     @mcp    crm_dashboards_read
     @data   CrmDeal (status, value, actual_close_date, created_at, lost_reason, owner_membership_id, lead_source_id) · CrmDealStageHistory (duration_seconds, from/to) · CrmLead (status_id, lead_source_id, converted_at, created_at) · CrmActivity (type, status, owner_membership_id, completed_at) ·
             CrmSalesTarget (attainment) · CrmCompany (lifecycle_stage_id, customer_since) · read-only revenue from 08 by company
     @ui     Tabs, filter bar, Card, Table, Recharts (bars, funnel, line) with the same semantic colors, ToggleGroup (period), Select (pipeline, team, owner)
     @states loading per widget · empty ("No data for this period") · error per widget · no-access per widget
     @audit  report exports (data.exported)
     @note   Every figure is computed by the API with the formulas of the dashboard (win rate = won / (won + lost), cycle = avg(actual_close - created), weighted = value x probability); ABANDONED deals are excluded. Lost reasons are grouped by the CrmLossReason catalogue (CrmDeal.lost_reason_id).
             Reports are read-only views. "Schedule email" needs crm.reports.schedule*: a CrmReportSchedule row (report_key, filters, format, recipients) plus a ScheduledJob of 20 (cron, timezone) that renders the report with the owner's permissions and sends it through 11.
     ===================================================================================================================== */
  function reports() {
    const owners = [["AM", 9, 6, 67, 142000, 88000, 41], ["MS", 7, 3, 70, 76000, 52000, 38], ["NG", 6, 4, 60, 61000, 31000, 44], ["KL", 5, 3, 62, 54000, 57600, 36], ["SJ", 4, 3, 57, 33000, 15800, 47]];
    const stages = ST.slice(0, 6).map((s, i) => [s[0], [4, 6, 5, 9, 7, 3][i], [100, 66, 52, 38, 30, 21][i], [3, 6, 11, 9, 7, 5][i]]);
    return '<div class="a-page">' + head("Reports", "How the team sells: performance, conversion, losses, activity and velocity.", '<div class="tg"><span>Month</span><span class="on">Quarter</span><span>Year</span></div>' + btn("Schedule email", "mail") + bt("Export", "box", "", "reports")) +
      FBAR([["Pipeline", "is", "Sales"], ["Period", "is", "Q4 2026"], ["Team", "is", "All"], ["Owner", "is", "Anyone"]], btn("Save view", "plus", "sm")) +
      '<div class="tabset">' + tabs([["s", "Sales performance"], ["l", "Lead conversion"], ["x", "Lost reasons"], ["a", "Activity"], ["v", "Velocity"], ["c", "Customers"]], "s") +
      pane("s", 1, '<div class="mini-stats">' + stat("Won", eur(178000), "11 deals") + stat("Win rate", "34%", "+3 pts") + stat("Avg deal size", eur(16200), "won deals") + stat("Avg cycle", "41 days", "-5") + stat("Target attainment", "59%", "of " + eur(300000)) + "</div>" +
        cd("<b>By salesperson</b><span class='r muted'>owner_membership_id</span>", '<table>' + th(["Owner", ">Won", ">Lost", ">Win rate", ">Won value", ">Open pipeline", ">Avg cycle", "Attainment"]) + "<tbody>" + owners.map((o) => "<tr><td>" + own(o[0]) + '</td><td class="num">' + o[1] + '</td><td class="num">' + o[2] + '</td><td class="num">' + o[3] + '%</td><td class="num money">' + eur(o[4]) + '</td><td class="num money">' + eur(o[5]) + '</td><td class="num">' + o[6] + " d</td><td>" + bar(Math.min(100, Math.round(o[4] / 1500))) + "</td></tr>").join("") + "</tbody></table>", 1)) +
      pane("l", 0, '<div class="g2">' + cd("<b>Lead funnel</b><span class='r muted'>last 90 days</span>", [["New leads", 148, 100], ["Contacted", 112, 76], ["Qualified", 61, 41], ["Converted", 33, 22]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i class="fc-best" style="width:' + r[2] + '%"></i></span><span class="v">' + r[1] + " · " + r[2] + "%</span></div>").join("")) +
        cd("<b>Conversion by source</b><span class='r muted'>CrmLeadSource</span>", '<table>' + th(["Source", ">Leads", ">Converted", ">Rate", ">Won value"]) + "<tbody>" + [["Referral", 38, 14, 37, 96000], ["Website", 41, 8, 20, 31000], ["Event", 19, 4, 21, 52000], ["Partner", 16, 5, 31, 44000], ["Advertisement", 34, 2, 6, 9000]].map((r) => "<tr><td class='ink'>" + r[0] + '</td><td class="num">' + r[1] + '</td><td class="num">' + r[2] + '</td><td class="num">' + r[3] + '%</td><td class="num money">' + eur(r[4]) + "</td></tr>").join("") + "</tbody></table>", 1) + "</div>") +
      pane("x", 0, '<div class="g2">' + cd("<b>Why we lose</b><span class='r muted'>CrmDeal.lost_reason_id · CrmLossReason</span>", [["Price", 38], ["Competitor", 22], ["No decision", 16], ["No budget", 12], ["Timing", 8], ["Other", 4]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i class="fc-lost" style="width:' + r[1] * 2.4 + '%"></i></span><span class="v">' + r[1] + "%</span></div>").join("") + sub("Grouped by the CrmLossReason catalogue.")) +
        cd("<b>Lost deals</b>", '<table>' + th(["Deal", ">Value", "Reason", "Competitor"]) + "<tbody><tr><td class='ink'>Soylent redesign</td><td class=\"num money\">" + eur(22000) + "</td><td>Price</td><td>Studio North</td></tr><tr><td class='ink'>Hooli CMS</td><td class=\"num money\">" + eur(41000) + "</td><td>Competitor</td><td>Brightwave</td></tr><tr><td class='ink'>Stark portal</td><td class=\"num money\">" + eur(18000) + "</td><td>No decision</td><td>—</td></tr></tbody></table>", 1) + "</div>") +
      pane("a", 0, '<div class="g2">' + cd("<b>Activities completed</b><span class='r muted'>by type</span>", [["Calls", 122], ["Meetings", 64], ["Emails logged", 88], ["Follow-ups", 41]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i class="fc-won" style="width:' + r[1] * 0.7 + '%"></i></span><span class="v">' + r[1] + "</span></div>").join("")) + cd("<b>Per person</b>", '<table>' + th(["Owner", ">Calls", ">Meetings", ">Overdue", "No-shows"]) + "<tbody>" + [["AM", 41, 18, 2, 1], ["MS", 33, 15, 0, 0], ["NG", 28, 12, 4, 3], ["KL", 20, 19, 1, 0]].map((r) => "<tr><td>" + own(r[0]) + '</td><td class="num">' + r[1] + '</td><td class="num">' + r[2] + '</td><td class="num">' + r[3] + "</td><td>" + r[4] + "</td></tr>").join("") + "</tbody></table>", 1) + "</div>") +
      pane("v", 0, cd("<b>Time in stage</b><span class='r muted'>CrmDealStageHistory · avg days and conversion to next stage</span>", '<table>' + th(["Stage", ">Deals passed", ">Reached from start", ">Avg days in stage", "Stale limit"]) + "<tbody>" + stages.map((s, i) => "<tr><td class='ink'>" + s[0] + '</td><td class="num">' + s[1] + '</td><td class="num">' + s[2] + '%</td><td class="num">' + s[3] + " d</td><td>" + (ST[i][3] || "—") + (ST[i][3] ? " d" : "") + "</td></tr>").join("") + "</tbody></table>", 1)) +
      pane("c", 0, '<div class="g2">' + cd("<b>Customers by lifecycle</b><span class='r muted'>CrmLifecycleStage</span>", [["Customer", 62], ["Active customer", 41], ["Inactive customer", 11], ["Former customer", 6]].map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i class="fc-best" style="width:' + r[1] * 1.4 + '%"></i></span><span class="v">' + r[1] + "</span></div>").join("")) + cd("<b>New customers per month</b>", '<div style="display:flex;align-items:flex-end;gap:8px;height:110px">' + [3, 5, 4, 7, 6, 8].map((v) => '<span style="flex:1;background:var(--blue);border-radius:4px 4px 0 0;height:' + v * 11 + 'px" title="' + v + ' customers"></span>').join("") + '</div><div class="sub-note">Jun – Nov · customer_since</div>') + "</div>") + "</div>" +
      dm(["CrmDeal · status, value, actual_close_date, lost_reason_id, owner_membership_id, lead_source_id", "CrmLossReason · name", "CrmReportSchedule · report_key, filters, format, recipient_membership_ids, recipient_emails, owner_membership_id, scheduled_job_id · ScheduledJob (20) · cron, timezone", "CrmDealStageHistory · duration_seconds · CrmLead · status_id, lead_source_id, converted_at · CrmActivity · type, status, completed_at · CrmSalesTarget · amount", "CrmCompany · lifecycle_stage_id, customer_since"], []) + "</div>";
  }
  const MAP = {
    dashboard, deals, "deals-list": dealsList, deal, "deal-new": () => dealForm(0), "deal-edit": () => dealForm(1), "deal-products": dealProducts, "deal-close": dealClose,
    leads, lead, "lead-new": () => leadForm(0), "lead-edit": () => leadForm(1), "lead-convert": leadConvert, "bulk-assign": bulkAssign,
    companies, company, "company-new": () => companyForm("new"), "company-edit": () => companyForm("edit"), "company-merge": () => merge("company"), duplicates,
    vendors, "vendor-new": () => companyForm("VENDOR"), partners, "partner-new": () => companyForm("PARTNER"),
    contacts, contact, "contact-new": () => contactForm(0), "contact-edit": () => contactForm(1), "contact-merge": () => merge("contact"),
    activities, "activity-new": () => activityForm("CALL"), "activity-meeting": () => activityForm("MEETING"), "activity-email": () => activityForm("EMAIL"), "activity-followup": () => activityForm("FOLLOW_UP"),
    forecast, reports, pipelines, "custom-fields": customFieldsPage, tags: tagsPage, "saved-views": savedViews,
    imports, "import-map": importMap, "import-dupes": importDupes, "import-preview": importPreview, "import-run": importRun,
  };
  const CRUMB = { deal: "Acme Rebrand phase 2", "deal-new": "New deal", "deal-edit": "Edit deal", "deal-products": "Products", "deal-close": "Close deal", "deals-list": "List", lead: "Billing portal", "lead-new": "New lead", "lead-edit": "Edit lead", "lead-convert": "Convert lead", "bulk-assign": "Bulk assign", company: "Acme Corp", "company-new": "New company", "company-edit": "Edit company", "company-merge": "Merge", contact: "Lena Kovac", "contact-new": "New contact", "contact-edit": "Edit contact", "contact-merge": "Merge", "vendor-new": "New vendor", "partner-new": "New partner", "activity-new": "Log activity", "activity-meeting": "Schedule meeting", "activity-email": "Log email", "activity-followup": "Follow-up" };
  window.VIEWS.crm = { html: function (s) { return (MAP[s || "deals"] || MAP.deals)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
