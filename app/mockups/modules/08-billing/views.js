/* =====================================================================================================================
   BILLING APP — module 08 Financial Management & Payment Providers (docs/features/08-financial-management-stripe-integration.md)
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: BillingProfile, PaymentMethod, Product, Price, TaxRate, Coupon, InvoiceTemplate, Invoice, InvoiceLineItem, InvoiceReminder, Payment, PaymentAllocation, Refund, CreditNote,
   Subscription, SubscriptionItem, DunningPolicy, ProjectBillingSettings, PaymentProviderConnection, PaymentProviderObject, ProviderWebhookEvent (+ platform tables NumberSequence, SavedView, audit_events).
   Enums are real values: InvoiceStatus (DRAFT, SCHEDULED, OPEN, PENDING, PAID, PARTIALLY_PAID, OVERDUE, REFUNDED, CANCELLED, VOID), BillingModel (FIXED_PRICE, MILESTONE, TIME_AND_MATERIALS, RETAINER, RECURRING, MAINTENANCE),
   PaymentProvider (STRIPE, VIVA_WALLET, MANUAL, BANK), PaymentProviderConnectionStatus (PENDING, ACTIVE, ERROR, DISCONNECTED), PaymentMethodType (CARD, BANK_TRANSFER, SEPA_DEBIT, CASH, CHECK, WALLET, OTHER),
   PaymentStatus (PENDING, PROCESSING, SUCCEEDED, FAILED, CANCELLED, REFUNDED, PARTIALLY_REFUNDED), RefundStatus (PENDING, SUCCEEDED, FAILED, CANCELLED), CreditNoteStatus (DRAFT, ISSUED, APPLIED, VOID),
   SubscriptionStatus (INCOMPLETE, TRIALING, ACTIVE, PAST_DUE, PAUSED, CANCELLED, EXPIRED), CollectionMethod (CHARGE_AUTOMATICALLY, SEND_INVOICE), BillingInterval (DAY, WEEK, MONTH, QUARTER, YEAR),
   TaxBehavior (INCLUSIVE, EXCLUSIVE), DiscountType (PERCENTAGE, FIXED), CouponDuration (ONCE, REPEATING, FOREVER), PriceType (ONE_TIME, RECURRING), ProductType, DunningAction, ProviderObjectType.
   Permission keys (catalog, 25): finance.dashboard.read*, finance.invoices.{read,create,update,delete*,archive,export*,approve*,send,void*}, finance.payments.{read*,record*,refund*}, finance.credit_notes.manage*,
   finance.subscriptions.{read,manage*}, finance.billing_profiles.manage*, finance.catalog.{read,manage}, finance.dunning.manage, finance.invoice_templates.manage, finance.adjustments.manage*, finance.project_billing.manage,
   finance.reports.read*, finance.payment_providers.manage*. Credentials: organizations.integrations.read / organizations.integrations.manage* (Admin > Integrations, 01 §156-§161).
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - PROVIDER-AGNOSTIC (08 "Payment Providers"): invoices, payments, subscriptions and the catalog are platform records. A provider (Stripe, Viva Wallet at launch) is only where money is collected. Provider keys are NEVER on this
       module: they live in an IntegrationConnection (BYOK, category PAYMENTS) and PaymentProviderConnection.integration_connection_id points at it. No connection = "Connect Stripe or Viva Wallet in Admin > Integrations".
     - Money: Decimal with the invoice currency; totals are computed by the API (line net/tax/gross, then invoice subtotal, discount_total, tax_total, total, amount_paid, amount_due). The client never sends totals.
     - Numbers come from NumberSequence (INV-2026-0001, CN-2026-0001) in one transaction; the client never invents numbers. Every invoice and payment produces an income record in 09 (LedgerRecord): 08 never records expenses.
     - SEPARATION OF DUTIES (01 §96): Invoice.approved_by_user_id must differ from created_by_user_id. Approval needs finance.invoices.approve*. Sensitive actions (approve, void, refund, delete, export) need a reason and are audited.
     - Anything that depends on connection capabilities (partial refund, provider subscriptions, saved methods) is only offered when PaymentProviderConnection.capabilities says so.
     - Lists: cursor pagination, filtered server-side by branch/team/project scope; filters are a typed tree stored in SavedView.filters (entity_type INVOICE | PAYMENT | SUBSCRIPTION), same JSON drives GET ?filter=.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows, flush) => '<div class="panel" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + p + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const gap = (h) => '<div style="height:' + (h || 12) + 'px"></div>';
  const eur = (n, c) => (c || "€") + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const two = (a, b) => '<div class="rowx" style="gap:8px;padding:0;align-items:flex-start"><div style="flex:1">' + a + '</div><div style="flex:1">' + b + "</div></div>";
  const prop = (k, v) => '<div class="kvr"><span>' + k + "</span><b>" + v + "</b></div>";
  const seg = (arr, on) => '<div class="rowx" style="gap:8px;padding:0;flex-wrap:wrap">' + arr.map((t) => '<span class="seg' + (t === on ? " on" : "") + '">' + t + "</span>").join("") + "</div>";
  const chip = (a, b, c) => window.UI.filters ? window.UI.filters.chip(a, b, c) : '<span class="fchip"><b>' + a + "</b><i>" + b + "</i><span>" + c + "</span></span>";
  const fbar = (chips, extra) => '<div class="fbar"><div class="fchips">' + chips.map((c) => chip(c[0], c[1], c[2])).join("") + '<button class="btn sm ghost">' + I("plus", 13) + ' Add filter</button></div><div class="fright">' + (extra || "") + "</div></div>";
  const views = (arr, on) => '<div class="bv-views">' + arr.map((v) => '<span class="seg' + (v[0] === on ? " on" : "") + '">' + v[0] + (v[1] != null ? ' <span class="bv-n">' + v[1] + "</span>" : "") + "</span>").join("") + '<span class="seg bv-add">' + I("plus", 12) + " Save view</span></div>";
  const pager = (t) => '<div class="pager"><span class="muted">' + t + '</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>";
  const bars = (rows, tone) => rows.map((r) => '<div class="bar-row"><span class="l">' + r[0] + '</span><span class="tr"><i style="width:' + r[1] + "%;background:var(--" + (r[3] || tone || "blue") + ')"></i></span><span class="v">' + r[2] + "</span></div>").join("");
  const col = (v) => '<div class="bv-cols">' + v + "</div>";

  /* status colours (semantic tokens only) */
  const IS = { DRAFT: "", SCHEDULED: "blue", OPEN: "blue", PENDING: "yellow", PAID: "green", PARTIALLY_PAID: "yellow", OVERDUE: "red", REFUNDED: "purple", CANCELLED: "", VOID: "" };
  const PS = { PENDING: "yellow", PROCESSING: "blue", SUCCEEDED: "green", FAILED: "red", CANCELLED: "", REFUNDED: "purple", PARTIALLY_REFUNDED: "yellow" };
  const SS = { INCOMPLETE: "yellow", TRIALING: "blue", ACTIVE: "green", PAST_DUE: "red", PAUSED: "yellow", CANCELLED: "", EXPIRED: "" };
  const CS = { PENDING: "yellow", ACTIVE: "green", ERROR: "red", DISCONNECTED: "" };
  const inv = (s) => ES(s, IS[s]);
  const pay = (s) => ES(s, PS[s]);
  const sub = (s) => ES(s, SS[s]);
  const prov = (p, mode) => '<span class="bv-prov">' + I("plug", 12) + U.en(p) + (mode ? ' <span class="muted">' + mode + "</span>" : "") + "</span>";
  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], FN: ["Finn Nolan", "p"] };
  const wh = (a) => who(a, PEOPLE[a][1], PEOPLE[a][0], "");

  /* number, customer, project, status, issue, due, total, paid, model, connection, extra */
  const INV = [
    ["INV-2026-0042", "Acme Corp", "Acme Rebrand Website", "PARTIALLY_PAID", "Nov 3", "Nov 20", 12711.05, 5000, "MILESTONE", ["STRIPE", "EU live"], ""],
    ["INV-2026-0041", "Northwind Traders", "Mobile App v2", "OVERDUE", "Oct 10", "Oct 25", 8470, 0, "TIME_AND_MATERIALS", ["STRIPE", "EU live"], "Reminder 2 of 3"],
    ["INV-2026-0040", "Globex Hellas", "Retainer · Growth support", "PAID", "Nov 1", "Nov 15", 3630, 3630, "RETAINER", ["VIVA_WALLET", "GR live"], ""],
    ["INV-2026-0039", "Initech", "Data Warehouse Setup", "OPEN", "Nov 6", "Nov 20", 15125, 0, "FIXED_PRICE", ["STRIPE", "EU live"], ""],
    ["INV-2026-0038", "Acme Corp", "Hosting & maintenance", "PENDING", "Nov 1", "Nov 15", 605, 0, "MAINTENANCE", ["STRIPE", "EU live"], "Payment processing"],
    ["INV-2026-0037", "Umbrella GmbH", "Brand Strategy Sprint", "DRAFT", "—", "—", 9680, 0, "FIXED_PRICE", ["—", ""], "Awaiting approval"],
    ["INV-2026-0036", "Globex Hellas", "Retainer · Growth support", "SCHEDULED", "Dec 1", "Dec 15", 3630, 0, "RECURRING", ["VIVA_WALLET", "GR live"], "Sends Dec 1"],
    ["INV-2026-0035", "Hooli", "Launch campaign", "REFUNDED", "Sep 28", "Oct 12", 2420, 2420, "FIXED_PRICE", ["STRIPE", "EU live"], "Refunded 2,420.00"],
    ["INV-2026-0034", "Northwind Traders", "Mobile App v2", "VOID", "Sep 20", "Oct 4", 4235, 0, "MILESTONE", ["STRIPE", "EU live"], "Replaced by 0041"],
    ["INV-2026-0033", "Initech", "Data Warehouse Setup", "CANCELLED", "Sep 15", "Sep 29", 1210, 0, "FIXED_PRICE", ["—", ""], ""],
  ];
  const invRow = (r, i, sel2) => "<tr><td>" + cb(sel2 && i < 2) + "</td><td>" + ink(r[0]) + (r[10] ? '<br><span class="muted">' + r[10] + "</span>" : "") + "</td><td>" + r[1] + '<br><span class="muted">' + r[2] + "</span></td><td>" + inv(r[3]) + "</td><td>" + r[4] + "</td><td>" + r[5] + "</td><td>" + E(r[8]) + "</td><td>" + (r[9][0] === "—" ? "—" : prov(r[9][0], r[9][1])) + '</td><td class="num">' + eur(r[6]) + '</td><td class="num">' + eur(r[6] - r[7]) + "</td><td>" + more + "</td></tr>";

  /* =====================================================================================================================
     BILLING DASHBOARD (spec "Financial Dashboard")
     @screen Billing dashboard
     @route  /billing (default) · /billing/dashboard?period=&provider=&connection=&branch=
     @perm   VIEW finance.dashboard.read* (sensitive) · drill-down lists need finance.invoices.read / finance.payments.read* / finance.subscriptions.read · export finance.reports.read*
     @api    GET /finance/dashboard?from=&to=&provider=&connection_id=&branch_id= · GET /finance/dashboard/{revenue|mrr|aging|customers|projects|services|providers}
     @mcp    finance_dashboard_read (caller must hold finance.dashboard.read; sensitive tools need human confirmation when an AI agent calls them)
     @data   Invoice (status, total, amount_due, due_date, paid_at) · Payment (status, amount, fee_amount, refunded_amount, provider_connection_id) · Refund · Subscription + SubscriptionItem (MRR, ARR, status, cancelled_at) · InvoiceLineItem (product_id, project) · PaymentProviderConnection
     @ui     Card, Tabs, ToggleGroup (period), Select (provider, connection, branch), chart components (see dataviz rules), Table, Tooltip. KPI tiles link to the filtered list.
     @states loading skeleton tiles · empty ("No invoices yet, create your first invoice") · error with retry · no-access (finance.dashboard.read missing) · partial (some figures hidden when the caller lacks finance.payments.read)
     @audit  dashboard views are not audited; exports are (finance.reports.read)
     @note   Nothing here is stored: every figure is computed from invoices, payments and subscriptions in the invoice currency (multi-currency totals are converted at the payment date rate, shown with the base currency).
             Profit, expenses, VAT position and project profitability are 09 and are linked, not repeated. MRR = sum of active SubscriptionItem (quantity x unit_amount) normalized to one month.
             Churn = subscriptions with cancelled_at in the period / active at the start. LTV = ARPU / churn. ARPU = revenue / paying customers.
     ===================================================================================================================== */
  function dashboard() {
    const rev = [38, 44, 41, 52, 49, 58, 63, 61, 70, 66, 74, 55];
    const mo = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
    return '<div class="a-page">' + head("Billing", "Revenue, collections and recurring revenue. Profit and loss are in Income & expenses (09).", sel("Last 12 months", "calendar") + sel("All providers", "plug") + sel("All branches", "building") + btn("Export", "file") + btn("New invoice", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Total revenue", "€486,320", "last 12 months · +18%") + stat("Monthly revenue", "€55,140", "Nov so far") + stat("Annual revenue", "€412,900", "2026 YTD") + stat("MRR", "€21,480", "+€1,260 this month") + stat("ARR", "€257,760", "MRR x 12") + "</div>" +
      '<div class="mini-stats">' + stat("Outstanding", "€48,917", "9 invoices") + stat("Overdue", "€8,470", "1 invoice · 17 days", 1) + stat("Paid (Nov)", "€31,220", "14 invoices") + stat("Active subscriptions", 27, "3 past due", 1) + stat("Churn rate", "2.1%", "monthly") + "</div>" +
      '<div class="mini-stats">' + stat("LTV", "€18,400", "ARPU / churn") + stat("ARPU", "€796", "per paying customer / month") + stat("Payment success", "96.4%", "last 30 days") + stat("Refunds", "€2,420", "1 refund · 0.5% of revenue") + stat("Avg days to pay", "11.2", "from issue date") + "</div>" +
      '<div class="g2">' + cd("<b>Revenue by month</b><span class='r muted'>Payment SUCCEEDED, net of refunds</span>", '<div class="bv-chart">' + rev.map((v, i) => '<div class="bv-col"><span class="bv-bar" style="height:' + v * 1.5 + 'px" title="' + mo[i] + " · €" + v + 'k"></span><small>' + mo[i] + "</small></div>").join("") + "</div>") +
      cd("<b>Invoice aging</b><span class='r muted'>amount_due by days past due_date</span>", bars([["Not due", 62, "€33,990", "blue"], ["1-30 days", 17, "€8,470", "yellow"], ["31-60 days", 0, "€0", "red"], ["61-90 days", 0, "€0", "red"], [">90 days", 0, "€0", "red"]]) + '<div class="sub-note">Outstanding excludes DRAFT, SCHEDULED, CANCELLED and VOID invoices.</div>') + "</div>" +
      '<div class="g3">' + cd("<b>Revenue by customer</b>", bars([["Acme Corp", 78, "€61,200"], ["Initech", 62, "€48,900"], ["Northwind", 41, "€32,400"], ["Globex Hellas", 30, "€23,900"], ["Hooli", 14, "€11,100"]])) +
      cd("<b>Revenue by project</b>", bars([["Acme Rebrand Website", 74, "€58,300"], ["Data Warehouse Setup", 52, "€41,000"], ["Mobile App v2", 44, "€34,800"], ["Retainer · Growth", 30, "€23,900"]], "purple")) +
      cd("<b>Revenue by service</b>", bars([["Development hours", 70, "€171,600"], ["Maintenance plans", 38, "€68,200"], ["Design packages", 30, "€52,900"], ["Support plans", 18, "€31,100"]], "green")) + "</div>" +
      '<div class="g2">' + cd("<b>MRR movement</b><span class='r muted'>this month</span>", [["New", "+€1,900", "green"], ["Expansion (upgrades)", "+€640", "green"], ["Contraction (downgrades)", "-€280", "yellow"], ["Churned", "-€1,000", "red"]].map((r) => '<div class="rowx"><div class="grow">' + r[0] + '</div><span class="badge ' + r[2] + '">' + r[1] + "</span></div>").join("") + '<div class="rowx"><div class="grow"><b>Net new MRR</b></div><b>+€1,260</b></div>', 1) +
      cd("<b>By provider connection</b><span class='r muted'>PaymentProviderConnection</span>", tbl(["Connection", ">Volume", ">Success", ">Fees", ">Refunds"], [["Stripe EU " + muted("live"), "€44,300", "97.1%", "€1,129", "€2,420"], ["Viva Wallet GR " + muted("live"), "€10,840", "93.8%", "€243", "€0"], ["Stripe EU " + muted("test"), "€0", "—", "—", "—"]]), 1) + "</div>" +
      '<div class="g2">' + cd("<b>Needs attention</b>", [["flag", "INV-2026-0041 is 17 days overdue (€8,470).", "Reminder 2 of 3 sent Nov 5. Next: Nov 12 owner notification."], ["shield", "INV-2026-0037 is waiting for approval.", "Created by Anna Meyer. You cannot approve it (same user)."], ["zap", "3 subscriptions are past due.", "Retry 2 of 4 runs tomorrow 09:00."], ["plug", "Stripe EU test: webhook failing.", "Last error 4 h ago. Open the provider."]].map((r) => '<div class="rowx">' + I(r[0], 16) + '<div class="grow"><b>' + r[1] + "</b><small>" + r[2] + "</small></div>" + btn("Open", "", "sm") + "</div>").join(""), 1) +
      cd("<b>Quick links</b>", [["Create invoice", "plus", "create"], ["Approval queue", "shield", "approvals"], ["Reports", "chart", "reports"], ["Provider connections", "plug", "providers"]].map((r) => '<div class="rowx"><a class="grow" href="#billing/' + r[2] + '">' + I(r[1], 14) + " " + r[0] + "</a></div>").join(""), 1) + "</div>" +
      dm(["Invoice · status, total, amount_paid, amount_due, due_date, paid_at, billing_model", "Payment · status, amount, fee_amount, refunded_amount, provider, provider_connection_id", "Refund · amount, status · Subscription + SubscriptionItem · status, interval, quantity, unit_amount, cancelled_at", "InvoiceLineItem · product_id, net_amount (revenue by service/project) · PaymentProviderConnection", "PaymentDispute · PaymentPayout (provider KPIs)"], []) + "</div>";
  }

  /* =====================================================================================================================
     INVOICES — list with filters, saved views, sorting, bulk actions (spec "Invoicing")
     @screen Invoices
     @route  /billing/invoices?view=<savedViewId>&filter=<json>&sort=&group=&q=
     @perm   VIEW finance.invoices.read · create finance.invoices.create · bulk send finance.invoices.send · bulk approve finance.invoices.approve* · void finance.invoices.void* · archive finance.invoices.archive · delete finance.invoices.delete* · export finance.invoices.export*
     @api    GET /finance/invoices?filter=&sort=&group=&q=&cursor= · POST /finance/invoices/bulk {ids|filter, action: send|approve|archive|export|remind} · GET/POST/PATCH /saved-views?entity_type=INVOICE
     @mcp    finance_invoices_read (same filter JSON) · finance_invoices_send · finance_invoices_approve (human confirmation for AI agents)
     @data   Invoice (number, status, billing_profile_id, company_id, project_id, billing_model, issue_date, due_date, total, amount_paid, amount_due, provider_connection_id, collection_method, is_recurring, scheduled_send_at, approved_at) · SavedView (entity_type INVOICE)
     @ui     Table with column chooser, filter bar with Popover+Command pickers, ToggleGroup for saved views, row DropdownMenu, sticky bulk action bar, "Save view" Dialog, Tooltip with raw enum values
     @states loading skeleton · empty ("No invoices match these filters" + clear) · error · no-access · select-all-by-filter ("All 248 invoices match") · partial results when the caller lacks branch scope
     @audit  bulk actions write one audit event per invoice plus one summary event with the filter; export writes finance.invoice.exported
     @note   Filter fields: status, customer (company), project, billing model, provider connection, currency, issue date, due date, amount, collection method, recurring, approved, branch, tag (02 platform), custom field (02), text search (number, customer, project, notes).
             Saved views are per user, TEAM or ORGANIZATION (TEAM/ORG need finance.invoices.update). Totals row sums the FILTERED set by currency, never the loaded rows.
             Drafts already have a number (NumberSequence reserves it on create). Bulk send only touches DRAFT-approved, OPEN or SCHEDULED invoices and reports the skipped ones.
     ===================================================================================================================== */
  function invoices() {
    return '<div class="a-page">' + head("Invoices", "Every invoice you can see across branches and providers.", btn("Export", "file") + btn("Import", "inbox") + btn("New invoice", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Outstanding", "€48,917", "9 open or partially paid") + stat("Overdue", "€8,470", "1 invoice", 1) + stat("Drafts", 3, "1 awaiting approval") + stat("Scheduled", 2, "next send Dec 1") + stat("Paid this month", "€31,220", "14 invoices") + "</div>" +
      views([["All", 248], ["Overdue", 1], ["Awaiting approval", 1], ["Drafts", 3], ["Scheduled", 2], ["Recurring", 12], ["Unpaid this month", 9]], "All") +
      '<div class="toolbar">' + search("Search number, customer, project, notes") + sel("Table", "grid") + sel("Group: None") + sel("Sort: Due date ↑", "sort") + sel("Columns (11)", "settings") + "</div>" +
      fbar([["Status", "is any of", "Open, Partially paid, Overdue"], ["Issue date", "between", "Oct 1 – Nov 30"], ["Provider connection", "is", "Stripe EU live"], ["Amount", "above", "€1,000"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span class="muted">select all 248 matching the filter</span><span style="flex:1"></span>' + btn("Send", "send", "sm") + btn("Send reminder", "bell", "sm") + btn("Approve", "shield", "sm") + btn("Archive", "box", "sm") + btn("Export", "file", "sm") + btn("Void", "x", "sm") + "</div>" +
      '<div class="panel" style="margin-top:0"><table>' + th(["", "Number", "Customer / project", "Status", "Issued", "Due", "Model", "Connection", ">Total", ">Due", ""]) + "<tbody>" + INV.map((r, i) => invRow(r, i, 1)).join("") + '</tbody><tfoot><tr><td></td><td colspan="7" class="muted">Totals of the 248 invoices matching the filter (EUR)</td><td class="num"><b>€212,090.00</b></td><td class="num"><b>€48,917.05</b></td><td></td></tr></tfoot></table></div>' +
      pager("1-10 of 248") + callout("lock", "<b>Create, approve and void are separate permissions.</b> The approve button is hidden when the signed-in user created the invoice (separation of duties).", "") +
      dm(["Invoice · every column selectable and sortable (number, status, billing_profile_id, company_id, project_id, billing_model, currency, issue_date, due_date, total, amount_paid, amount_due, provider_connection_id, collection_method, is_recurring, scheduled_send_at, approved_at)", "SavedView · entity_type INVOICE, layout, visibility, team_id, filters, sorting, grouping, columns, search, is_default", "Read-only: CrmCompany (02), Project (05), PaymentProviderConnection"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE INVOICE — full page (spec "Invoicing", "Project Billing", "Taxes & Discounts")
     @screen Create invoice
     @route  /billing/create?company=&project=&from=<proposal|milestone|subscription|time>:<id>&clone=<invoiceId>
     @perm   finance.invoices.create · attach to a project needs projects.projects.read · adjustments/write-offs need finance.adjustments.manage* · custom prices per customer come from BillingProfile.custom_pricing (finance.billing_profiles.manage*) · send needs finance.invoices.send · approve needs finance.invoices.approve*
     @api    POST /finance/invoices {billing_profile_id, company_id, project_id?, contract_id?, proposal_version_id?, subscription_id?, billing_model, currency, issue_date, due_date, period_start?, period_end?, coupon_id?, collection_method,
             accepted_methods[], provider_connection_id?, template_id?, notes, payment_instructions, footer, is_recurring, scheduled_send_at?, lines[{product_id?, price_id?, description, quantity, unit, unit_amount, discount_amount, tax_rate_id?, milestone_id?, time_entry_ids[], adjustment_amount, adjustment_reason, period_start?, period_end?}]}
             · POST /finance/invoices/:id/submit-approval · /approve · /send
     @mcp    finance_invoices_create (AI may create DRAFTs from project, milestone or approved time; never approve or send without human confirmation)
     @data   Invoice · InvoiceLineItem · BillingProfile (currency, payment_terms_days, tax_exempt, custom_pricing, dunning_policy_id, preferred_provider_connection_id) · Product/Price · TaxRate · Coupon · InvoiceTemplate · ProjectMilestone (05) · TimeEntry (18) · ProjectBillingSettings · NumberSequence
     @ui     Sectioned form; shadcn Select / Popover+Command (customer, project, product, tax rate), DatePicker, Textarea, Switch, ToggleGroup (billing model), editable line-item table with keyboard navigation, Sheet to pick milestones / time entries, "Save draft" split button
     @states validation inline (customer required, at least one line, due date >= issue date) · saving · saved (toast with the number and Undo) · field disabled with reason when permission is missing · no active provider connection warning · draft restored from local storage
     @audit  invoice created (source: proposal / milestone / subscription / time / clone), line adjustments with reason, submitted for approval
     @note   Choosing a CUSTOMER loads its BillingProfile: currency, payment terms (due date = issue + payment_terms_days), tax exemption (tax lines become 0 with a note), preferred provider connection, dunning policy and custom prices.
             BILLING MODEL decides the line source: FIXED_PRICE free lines or a deposit/balance split from the proposal payment schedule; MILESTONE picks DONE and unbilled ProjectMilestones (05 §20) and sets InvoiceLineItem.milestone_id;
             TIME_AND_MATERIALS pulls approved billable TimeEntries (18 §7) and allows write-offs/write-ups as adjustment_amount with adjustment_reason; RETAINER/RECURRING/MAINTENANCE create from a Subscription or recurring schedule.
             Totals are computed by the API: line net = quantity x unit_amount - discount_amount + adjustment_amount; tax per TaxRate (INCLUSIVE or EXCLUSIVE); coupon applies to the invoice. Routing preview follows 08 "Routing".
     ===================================================================================================================== */
  function create() {
    const L = [["Milestone", "Design system v1", "1", "—", "8,000.00", "0.00", "VAT 21%", "Launch · Nov 28", "0.00", "8,000.00", "1,680.00", "9,680.00"],
      ["Development hours", "Frontend development · Nov 3-10", "24", "h", "95.00", "0.00", "VAT 21%", "—", "-180.00", "2,100.00", "441.00", "2,541.00"],
      ["Maintenance plan", "Hosting & maintenance · Nov 1-30", "1", "month", "450.00", "45.00", "VAT 21%", "—", "0.00", "405.00", "85.05", "490.05"]];
    return '<div class="a-page">' + head("New invoice", "The number is reserved from the sequence when you save the draft.", btn("Cancel") + btn("Preview PDF", "file") + btn("Save draft", "") + btn("Submit for approval", "shield", "primary")) +
      '<div class="g2" style="grid-template-columns:1.8fr 1fr;align-items:start"><div>' +
      cd("<b>Customer & source</b>", two(f("Customer", sel("Acme Corp", "building"), "BillingProfile of the CrmCompany. Customers without a profile get one created inline."), f("Project", sel("Acme Rebrand Website", "folder"))) +
        two(f("Contract", sel("CTR-2026-0014 · Website redesign", "file")), f("Proposal version", sel("PRO-2026-0031 v2 (accepted)", "file"))) +
        f("Subscription", sel("None", "zap"), "Link when this invoice is a renewal or setup fee of a subscription.") +
        f("Billing model", seg(["Fixed price", "Milestone", "Time & materials", "Retainer", "Recurring", "Maintenance"], "Milestone"), "BillingModel: FIXED_PRICE, MILESTONE, TIME_AND_MATERIALS, RETAINER, RECURRING, MAINTENANCE. Defaults from ProjectBillingSettings.") +
        f("Billing contacts", sel("Lena Kovac, accounts@acme.example", "users"), "BillingProfile.billing_contact_ids; the invoice is e-mailed to them.")) +
      gap() +
      cd("<b>Milestone billing</b><span class='r muted'>ProjectMilestone (05 §20) · DONE and not yet billed</span>", [["Discovery & brand strategy", "Done Oct 12", "6,000.00", "Billed in INV-2026-0031", 0, 1], ["Design system v1", "Done Nov 2", "8,000.00", "Ready to bill", 1, 0], ["Website build", "Due Dec 10", "14,000.00", "Not done", 0, 0]].map((r) => '<div class="rowx">' + cb(r[4]) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[1] + " · " + r[3] + "</small></div><span>" + r[2] + "</span></div>").join("") + '<div class="rowx"><div class="grow muted">Auto-invoice on milestone completion is set in Project billing (ProjectBillingSettings.auto_invoice_milestones).</div>' + btn("Pick time entries instead", "time", "sm") + "</div>", 1) +
      gap() +
      cd("<b>Line items</b><span class='r'>" + btn("Add product", "plus", "sm") + btn("Add custom line", "plus", "sm") + btn("Import time", "time", "sm") + "</span>",
        '<table class="bv-lines">' + th(["Product / price", "Description", ">Qty", "Unit", ">Unit amount", ">Discount", "Tax", "Milestone", ">Adjust", ">Net", ">Tax", ">Gross"]) + "<tbody>" + L.map((r) => "<tr>" + r.map((c, i) => "<td" + (i >= 2 && i != 3 && i != 6 && i != 7 ? ' class="num"' : "") + ">" + (i === 0 ? ink(c) : c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>" +
        '<div class="sub-note" style="padding:8px 12px">Adjustment of -180.00 on line 2 is a write-off (reason: "Goodwill, extra review hours not billed"). Needs finance.adjustments.manage* and is audited. Totals are computed by the API.</div>', 1) +
      gap() +
      cd("<b>Dates & delivery</b>", two(f("Issue date", sel("Nov 11, 2026", "calendar")), f("Due date", sel("Dec 11, 2026 · net 30", "calendar"), "From BillingProfile.payment_terms_days.")) +
        two(f("Period start", sel("Nov 1, 2026", "calendar")), f("Period end", sel("Nov 30, 2026", "calendar"))) +
        f("Collection method", seg(["Send invoice", "Charge automatically"], "Send invoice"), "CHARGE_AUTOMATICALLY needs a saved payment method on the connection.") +
        f("Accepted payment methods", '<div class="rowx" style="gap:8px;padding:0;flex-wrap:wrap">' + ["Card", "SEPA debit", "Bank transfer", "Wallet", "Cash", "Check"].map((x, i) => '<span class="seg' + (i < 3 ? " on" : "") + '">' + x + "</span>").join("") + "</div>") +
        f("Schedule send", sel("Send on approval", "send"), "scheduled_send_at: status SCHEDULED until then.") +
        '<div class="rowx"><div class="grow"><b>Recurring invoice</b><small>Repeat this invoice on a schedule (Automation 20 generates each copy).</small></div>' + sw(0) + "</div>") +
      gap() +
      cd("<b>Text & template</b>", f("Template", sel("Logiqdev standard · EN", "file"), "InvoiceTemplate; organization branding (01 §15) is the fallback.") + f("Notes", '<div class="editor"><div class="ed-body" style="min-height:60px">Thank you for your business. Milestone 2 of 4 of the Acme Rebrand Website.</div></div>') + f("Payment instructions", '<div class="editor"><div class="ed-body" style="min-height:60px">Bank: Alpha Bank · IBAN GR16 0110 1250 0000 0001 2300 695 · Reference: invoice number.</div></div>') + f("Footer", box("Logiqdev Ltd · VAT EL123456789 · Registered in Athens")), 0) +
      "</div><div>" +
      cd("<b>Summary</b><span class='r muted'>computed by the API</span>", prop("Subtotal", "€10,730.00") + prop("Discounts", "-€45.00") + prop("Adjustments", "-€180.00") + prop("Net", "€10,505.00") + prop("Tax (VAT 21%)", "€2,206.05") + '<div class="kvr"><span><b>Total</b></span><b style="font-size:16px">€12,711.05</b></div>' + prop("Currency", "EUR " + muted("from the billing profile")) + prop("Coupon", sel("None", "tag"))) +
      gap() +
      cd("<b>Collection & routing</b>", f("Provider connection", sel("Auto (routing)", "plug"), "Order: invoice, billing profile preferred, branch, organization default (08 Routing).") + '<div class="rowx"><div class="grow"><b>Would use Stripe EU live</b><small>Accepts EUR and card, SEPA debit. Priority 1.</small></div>' + prov("STRIPE", "live") + "</div>" + '<div class="rowx"><div class="grow"><b>Customer may choose</b><small>Also Viva Wallet GR live (card)</small></div>' + sw(1) + "</div>" + callout("plug", "No active connection accepts this currency? Online payment is blocked and only the bank-transfer instructions show.", "warn")) +
      gap() +
      cd("<b>Approval</b>", '<div class="rowx"><div class="grow"><b>Approval required</b><small>Rule: invoices above €10,000 (see Approvals).</small></div>' + E("Required", "yellow") + '</div><div class="rowx"><div class="grow"><b>Approver</b><small>Someone other than you (separation of duties, 01 §96)</small></div>' + sel("Finance lead", "shield") + "</div>") +
      gap() +
      cd("<b>Other</b>", f("Branch", sel("Athens HQ", "building")) + f("Tags", sel("Add tags…", "tag")) + f("Internal note", box("Visible to finance only")) + '<div class="rowx"><div class="grow"><b>Create another</b><small>Reuse customer and project</small></div>' + sw(0) + "</div>") +
      "</div></div>" +
      dm(["Invoice · every column written on create (see @api)", "InvoiceLineItem · product_id, price_id, description, quantity, unit, unit_amount, discount_amount, tax_rate_id, tax_percent, net/tax/gross_amount, milestone_id, adjustment_amount, adjustment_reason, period_start/end, sort_order", "BillingProfile · currency, payment_terms_days, custom_pricing · TaxRate · Coupon · InvoiceTemplate · NumberSequence (entity_type invoice)", "Invoice · sent_communication_id, viewed_at", "Read-only: ProjectMilestone (05), TimeEntry (18), Proposal/Contract (03/04)"], []) + "</div>";
  }

  /* =====================================================================================================================
     INVOICE DETAIL — payments, PDF, send, credit notes (spec "Invoicing", "Payments")
     @screen Invoice detail
     @route  /billing/invoice (production /billing/invoices/:number e.g. INV-2026-0042) ?tab=overview|payments|credit|reminders|activity
     @perm   VIEW finance.invoices.read · edit DRAFT finance.invoices.update · send finance.invoices.send · approve finance.invoices.approve* · void finance.invoices.void* · record payment finance.payments.record* · refund finance.payments.refund*
             · credit note finance.credit_notes.manage* · export PDF finance.invoices.export* · reminders finance.dunning.manage (rule) / finance.invoices.send (manual) · delete finance.invoices.delete* (DRAFT only)
     @api    GET /finance/invoices/:number · PATCH /finance/invoices/:id · POST /:id/send {to[], message} · /approve · /void {reason} · /payments {amount, method_type, reference, received_at} · /credit-notes · /remind · /revise · GET /:id/pdf
     @mcp    finance_invoices_read · finance_invoices_send · finance_invoices_void · finance_payments_record · finance_credit_notes_manage (sensitive: human confirmation for AI agents)
     @data   Invoice (all columns) · InvoiceLineItem · PaymentAllocation + Payment · CreditNote · InvoiceReminder (action, offset_days, communication_id, sent_at) · Invoice.revises_invoice_id · pdf_document_id (Document 17) · ledger_record (09, read-only)
     @ui     Two-column page; Tabs (Overview, Payments, Credit notes, Reminders, Activity); Dialogs for Record payment, Send, Void, Credit note; DropdownMenu for secondary actions; PDF preview in an iframe/Sheet
     @states loading · not found · error · no-access · DRAFT (editable, banner) · awaiting approval (banner, approve/reject) · locked (a sent invoice is immutable: use credit note or revision) · payment processing (PENDING) banner
     @audit  created, edited (field diff), approved (who, comment), sent (recipients), viewed, payment recorded/allocated, reminder sent, credit note, voided (reason), revision, PDF generated
     @note   Once sent, lines and totals are immutable. Corrections are a CREDIT NOTE (CreditNote.invoice_id) or a REVISION (a new invoice with revises_invoice_id, the old one becomes VOID). A payment is allocated through PaymentAllocation
             (one payment can cover several invoices). amount_due = total - amount_paid - applied credit notes. Online payment link = Invoice.hosted_invoice_url at the chosen connection; the portal (07) shows the same page.
             The income record in 09 (LedgerRecord) is created on send/finalize and updated by payments; read-only link here.
     ===================================================================================================================== */
  function invoice() {
    const lines = [["1", "Milestone · Design system v1", "Milestone: Launch · Nov 28", "1", "€8,000.00", "—", "21%", "€8,000.00", "€1,680.00", "€9,680.00"],
      ["2", "Frontend development", "Nov 3-10 · 24 h · write-off -€180.00", "24 h", "€95.00", "—", "21%", "€2,100.00", "€441.00", "€2,541.00"],
      ["3", "Hosting & maintenance plan", "Nov 1-30 · coupon 10%", "1 month", "€450.00", "-€45.00", "21%", "€405.00", "€85.05", "€490.05"]];
    return '<div class="a-page">' +
      '<div class="a-head"><div><h1>INV-2026-0042</h1><p>Acme Corp · Acme Rebrand Website · created by Anna Meyer Nov 3 · approved by Finn Nolan Nov 3 · ' + inv("PARTIALLY_PAID") + " " + E("MILESTONE") + '</p></div><div class="acts">' + btn("Record payment", "dollar") + btn("Send reminder", "bell") + btn("Download PDF", "file") + btn("Credit note", "receipt") + btn("Edit", "edit", "primary") + more + "</div></div>" +
      '<div class="mini-stats">' + stat("Total", "€12,711.05", "EUR · VAT 21%") + stat("Paid", "€5,000.00", "1 payment · deposit") + stat("Amount due", "€7,711.05", "due Nov 20 · in 9 days") + stat("Credit notes", "€0.00", "none") + stat("Reminders", 0, "next: Nov 17 (3 days before)") + "</div>" +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      '<div class="tabset">' + tabs([["ov", "Overview"], ["pm", "Payments", 1], ["cn", "Credit notes", 0], ["rm", "Reminders", 0], ["ac", "Activity"]], "ov") +
      pane("ov", 1, cd("<b>Line items</b><span class='r muted'>InvoiceLineItem</span>", '<table class="bv-lines">' + th(["#", "Item", "Detail", ">Qty", ">Unit", ">Discount", ">Tax", ">Net", ">Tax", ">Gross"]) + "<tbody>" + lines.map((r) => "<tr>" + r.map((c, i) => "<td" + (i >= 3 ? ' class="num"' : "") + ">" + (i === 1 ? ink(c) : c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>" +
        '<div class="bv-totals">' + prop("Subtotal", "€10,730.00") + prop("Discounts", "-€45.00") + prop("Adjustments (write-off)", "-€180.00") + prop("Tax", "€2,206.05") + '<div class="kvr"><span><b>Total</b></span><b>€12,711.05</b></div>' + prop("Paid", "-€5,000.00") + '<div class="kvr"><span><b>Amount due</b></span><b>€7,711.05</b></div></div>', 1) + gap() +
        cd("<b>Notes & payment instructions</b>", "<p>Thank you for your business. Milestone 2 of 4 of the Acme Rebrand Website.</p><p class='muted'>Bank transfer: Alpha Bank · IBAN GR16 0110 1250 0000 0001 2300 695 · Reference INV-2026-0042.</p>")) +
      pane("pm", 0, tbl(["Payment", "Received", "Method", "Provider", "Status", ">Allocated", ">Fee", ">Net"], [[ink("pi_3QxN…8aK2"), "Nov 5", "Card · Visa 4242", prov("STRIPE", "EU live"), pay("SUCCEEDED"), "€5,000.00", "€125.25", "€4,874.75"]]) + '<div class="sub-note" style="margin-top:8px">One payment can be allocated across several invoices (PaymentAllocation). Record a bank transfer manually with the button above (finance.payments.record*).</div>') +
      pane("cn", 0, '<div class="empty-note">No credit notes. Issue one to correct an invoice that was already sent (CreditNote, numbered CN-2026-xxxx).</div>' + btn("Issue credit note", "plus", "sm")) +
      pane("rm", 0, tbl(["Action", "Planned", "Status", "Message"], [["Reminder " + muted("REMINDER"), "Nov 17 (-3 days)", E("Scheduled", "blue"), "Friendly reminder"], ["Reminder " + muted("REMINDER"), "Nov 21 (+1 day)", E("Scheduled", "blue"), "Overdue notice"], ["Notify owner " + muted("NOTIFY_OWNER"), "Nov 27 (+7 days)", E("Scheduled", "blue"), "Task for account owner"]]) + '<div class="sub-note" style="margin-top:8px">Policy: Standard dunning (DunningPolicy). InvoiceReminder rows are written when a step runs; delivery is 11/14.</div>') +
      pane("ac", 0, '<div class="tl"><div class="ev"><b>Payment pi_3QxN…8aK2 succeeded, €5,000.00</b><small>Nov 5 · allocated · invoice PARTIALLY_PAID</small></div><div class="ev"><b>Viewed by Lena Kovac (customer portal)</b><small>Nov 4</small></div><div class="ev"><b>Sent to accounts@acme.example</b><small>Nov 3 · Finn Nolan · via Resend</small></div><div class="ev"><b>Approved by Finn Nolan</b><small>Nov 3 · "Matches the accepted proposal"</small></div><div class="ev"><b>Submitted for approval</b><small>Nov 3 · Anna Meyer</small></div><div class="ev"><b>Created (milestone Design system v1)</b><small>Nov 3 · Anna Meyer · audit_events</small></div></div>') + "</div>" +
      "</div><div>" +
      cd("<b>Details</b>", prop("Customer", "Acme Corp " + muted("(02)")) + prop("Project", "Acme Rebrand Website " + muted("(05)")) + prop("Contract", "CTR-2026-0014 " + muted("(04)")) + prop("Proposal", "PRO-2026-0031 v2 " + muted("(03)")) + prop("Issue date", "Nov 3, 2026") + prop("Due date", "Nov 20, 2026") + prop("Period", "Nov 1 – Nov 30") + prop("Collection", E("SEND_INVOICE")) + prop("Accepted methods", "Card, SEPA debit, Bank transfer") + prop("Template", "Logiqdev standard · EN") + prop("Branch", "Athens HQ")) + gap() +
      cd("<b>Provider</b>", prop("Connection", prov("STRIPE", "EU live")) + prop("Provider invoice", "in_1QxN4f…") + prop("Hosted page", '<a href="#billing/invoice">pay.stripe.com/i/…</a>') + '<div class="rowx"><div class="grow"><b>Online payment</b><small>Customer can pay card or SEPA; Viva Wallet offered too</small></div>' + btn("Copy link", "link", "sm") + "</div>", 1) + gap() +
      cd("<b>Documents (17)</b>", '<div class="rowx">' + I("file", 16) + '<div class="grow"><b>INV-2026-0042.pdf</b><small>pdf_document_id · generated Nov 3 · 84 KB</small></div>' + btn("Open", "", "sm") + "</div>" + '<div class="rowx">' + I("file", 16) + '<div class="grow"><b>Receipt · pi_3QxN…8aK2.pdf</b><small>Payment.receipt_document_id</small></div>' + btn("Open", "", "sm") + "</div>", 1) + gap() +
      cd("<b>Accounting (09)</b>", prop("Income record", "INC-2026-0187 " + muted("LedgerRecord")) + prop("VAT", "EL · 21% · €2,206.05") + '<div class="sub-note">Created on send, updated by payments. Read-only here.</div>') + gap() +
      cd("<b>Revisions</b>", '<div class="sub-note">No revisions. A revision creates a new invoice with revises_invoice_id and voids this one (finance.invoices.void*).</div>' + btn("Create revision", "edit", "sm")) +
      "</div></div>" +
      dm(["Invoice · all columns (status, billing_model, totals, amount_paid, amount_due, provider_connection_id, provider_invoice_id, hosted_invoice_url, pdf_document_id, approved_by_user_id, approved_at, sent_at, paid_at, reminder_count, revises_invoice_id)", "InvoiceLineItem · all columns · PaymentAllocation · Payment · CreditNote · InvoiceReminder", "Invoice · sent_communication_id (CommMessage, 11) · viewed_at · uncollectible_at, uncollectible_reason, written_off_amount", "Read-only: LedgerRecord (09), Document (17), CommMessage (11), Contract/Proposal/Project"], []) + "</div>";
  }

  /* =====================================================================================================================
     APPROVAL QUEUE (spec "Invoicing"; 01 §95 approvals, §96 separation of duties)
     @screen Approvals
     @route  /billing/approvals?tab=invoices|refunds|credit-notes|writeoffs|rules
     @perm   VIEW finance.invoices.read · approve/reject invoices finance.invoices.approve* · approve refunds finance.refunds.approve* (requester uses finance.payments.refund*) · credit notes and write-offs: request finance.credit_notes.manage* / finance.adjustments.manage*, approve finance.adjustments.approve* · edit rules finance.approval_rules.manage*
     @api    GET /finance/approvals?type=&status= · POST /finance/invoices/:id/approve {comment} · POST /finance/invoices/:id/reject {reason} · POST /finance/refunds/:id/approve · POST /finance/approval-rules · POST /finance/credit-notes/:id/issue
     @mcp    finance_invoices_approve (AI agents never approve; human confirmation required) · finance_approvals_read
     @data   FinanceApproval (entity_type INVOICE | REFUND | CREDIT_NOTE | WRITE_OFF, entity_id, step, approver_membership_id, decision, comment, rejection_reason, decided_at) · FinanceApprovalRule (entity_type, min_amount, max_amount, currency, steps, require_distinct_user, priority, enabled) · Invoice.approved_by_user_id/approved_at (final stamp) · Refund (PENDING) · CreditNote (DRAFT) · Invoice.written_off_amount (write-offs)
     @ui     Tabs, Table with row Sheet preview, Dialog with required comment, Badge, Tooltip explaining why Approve is disabled
     @states loading · empty ("Nothing waiting for you") · error · no-access · "You created this" (button disabled with the reason) · stale (changed after submission: approval refused, resubmit)
     @audit  submitted, approved (approver, comment), rejected (reason), approval refused for separation of duties
     @note   One policy for every money movement: FinanceApprovalRule (amount band, currency, branch, ordered steps) requests FinanceApproval rows; 09 ledger records and expense claims use the same tables. Invoice.approved_by_user_id + approved_at is the final stamp
             (null = not approved or not required). The server refuses approver == requester (01 §96). Approving a DRAFT lets it be sent; a sent invoice cannot be edited.
     ===================================================================================================================== */
  function approvals() {
    return '<div class="a-page">' + head("Approvals", "Money movements waiting for a second person.", sel("All branches", "building") + btn("Rules", "settings")) +
      '<div class="mini-stats">' + stat("Invoices", 1, "€9,680.00 waiting") + stat("Refunds", 2, "€1,310.00 pending") + stat("Credit notes", 1, "DRAFT") + stat("Write-offs", 1, "€180.00") + stat("Avg time to approve", "3.4 h", "last 30 days") + "</div>" +
      '<div class="tabset">' + tabs([["inv", "Invoices", 1], ["ref", "Refunds", 2], ["cn", "Credit notes", 1], ["wo", "Write-offs", 1], ["ru", "Rules"]], "inv") +
      pane("inv", 1, tbl(["Invoice", "Customer", "Created by", "Submitted", ">Total", "Reason it needs approval", "Decision"], [[ink("INV-2026-0037"), "Umbrella GmbH", wh("AM"), "Nov 10, 16:20", "€9,680.00", "Above €10,000? No. New customer rule", btn("Review", "", "sm") + " " + '<button class="btn sm" disabled title="You created this invoice (separation of duties, 01 §96)">Approve</button>'], [ink("INV-2026-0043"), "Initech", wh("MS"), "Nov 11, 09:05", "€21,780.00", "Above €10,000", btn("Review", "", "sm") + btn("Approve", "shield", "sm primary") + btn("Reject", "x", "sm")]]) + '<div class="sub-note" style="margin-top:8px">The first row is shown as seen by its creator (Approve disabled). Rejecting needs a reason and returns the invoice to DRAFT.</div>') +
      pane("ref", 0, tbl(["Payment", "Customer", "Requested by", ">Amount", "Reason", "Decision"], [["pi_3QwA…1Zk9", "Hooli", wh("SJ"), "€1,210.00", "Duplicate payment", btn("Approve", "shield", "sm primary") + btn("Reject", "x", "sm")], ["pi_3Qv2…9cT4", "Northwind Traders", wh("AM"), "€100.00", "Customer goodwill", btn("Approve", "shield", "sm primary") + btn("Reject", "x", "sm")]]) + '<div class="sub-note" style="margin-top:8px">Refund.status PENDING until approved and processed by the provider. <span class="badge yellow">gap</span> approval of refunds has no model or permission key.</div>') +
      pane("cn", 0, tbl(["Credit note", "Invoice", "Customer", "Created by", ">Total", "Reason", "Decision"], [[ink("CN-2026-0007"), "INV-2026-0035", "Hooli", wh("SJ"), "€2,420.00", "Campaign cancelled", btn("Issue", "send", "sm primary") + btn("Void", "x", "sm")]])) +
      pane("wo", 0, tbl(["Invoice", "Line", "Requested by", ">Adjustment", "Reason", "Decision"], [[ink("INV-2026-0042"), "Frontend development", wh("MS"), "-€180.00", "Goodwill, extra review hours not billed", btn("Approve", "shield", "sm primary") + btn("Reject", "x", "sm")]]) + '<div class="sub-note" style="margin-top:8px">InvoiceLineItem.adjustment_amount + adjustment_reason. Needs finance.adjustments.manage*.</div>') +
      pane("ru", 0, '<div class="rowx"><div class="grow"><b>Require approval for invoices above</b><small>FinanceApprovalRule · entity_type INVOICE · min_amount</small></div>' + box("€10,000.00") + '</div><div class="rowx"><div class="grow"><b>Applies to</b><small>FinanceApprovalRule.entity_type, one rule per type</small></div>' + seg(["INVOICE", "REFUND", "CREDIT_NOTE", "WRITE_OFF"], "INVOICE") + '</div><div class="rowx"><div class="grow"><b>Refunds above</b><small>entity_type REFUND</small></div>' + box("€500.00") + '</div><div class="rowx"><div class="grow"><b>Approver cannot be the creator</b><small>Fixed by 01 §96, cannot be turned off</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Approvers</b></div>' + sel("Role: Finance lead, Owner", "shield") + "</div>") + "</div>" +
      dm(["Invoice · status, created_by_user_id, approved_by_user_id, approved_at, total, written_off_amount", "Refund · status PENDING, requested_by_user_id, amount, reason · CreditNote · status DRAFT · InvoiceLineItem · adjustment_amount, adjustment_reason", "FinanceApprovalRule · entity_type, record_type, min_amount, max_amount, currency, branch_id, steps, require_distinct_user, priority, enabled", "FinanceApproval · entity_type, entity_id, rule_id, step, approver_membership_id, approver_role_id, decision, requested_by_membership_id, decided_by_membership_id, amount, currency, comment, rejection_reason, requested_at, decided_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     SUBSCRIPTIONS LIST (spec "Subscription Management", "Recurring Billing")
     @screen Subscriptions
     @route  /billing/subscriptions?view=&filter=&sort=
     @perm   VIEW finance.subscriptions.read · create/pause/resume/cancel/change plan finance.subscriptions.manage* · bulk finance.subscriptions.manage*
     @api    GET /finance/subscriptions?filter= · POST /finance/subscriptions · POST /:id/{pause|resume|cancel|change-plan} · POST /finance/subscriptions/bulk · /saved-views?entity_type=SUBSCRIPTION
     @mcp    finance_subscriptions_read · finance_subscriptions_manage (human confirmation for AI agents)
     @data   Subscription (status, company_id, billing_profile_id, interval, interval_count, collection_method, period_amount, current_period_end, trial_end, cancel_at_period_end, provider_connection_id, provider_subscription_id) · SubscriptionItem · SavedView (SUBSCRIPTION)
     @ui     Table, filter bar, ToggleGroup views, row DropdownMenu, bulk bar, Dialog for pause/cancel
     @states loading · empty ("No subscriptions") · error · no-access
     @audit  every status change, plan change, pause/resume, cancellation (reason), bulk action
     @note   Multiple active subscriptions per customer are allowed. When the connection supports provider subscriptions (Stripe) the subscription is mirrored (provider_subscription_id); otherwise (Viva Wallet) the platform runs the schedule
             and Automation (20) creates each renewal invoice and charges the saved method. The customer sees no difference. period_amount is the per-period total computed from the items.
     ===================================================================================================================== */
  const SUBS = [
    ["Retainer · Growth support", "Globex Hellas", "ACTIVE", "Monthly", "€3,630.00", "Dec 1", ["VIVA_WALLET", "GR live"], "Platform-run", "CHARGE_AUTOMATICALLY", ""],
    ["Hosting & maintenance", "Acme Corp", "ACTIVE", "Monthly", "€605.00", "Dec 1", ["STRIPE", "EU live"], "Mirrored", "SEND_INVOICE", ""],
    ["Support plan Gold", "Northwind Traders", "PAST_DUE", "Monthly", "€1,452.00", "Nov 8", ["STRIPE", "EU live"], "Mirrored", "CHARGE_AUTOMATICALLY", "Retry 2 of 4"],
    ["Maintenance plan", "Initech", "TRIALING", "Quarterly", "€2,420.00", "Nov 25", ["STRIPE", "EU live"], "Mirrored", "CHARGE_AUTOMATICALLY", "Trial ends Nov 25"],
    ["SEO retainer", "Hooli", "PAUSED", "Monthly", "€1,210.00", "—", ["STRIPE", "EU live"], "Mirrored", "SEND_INVOICE", "Resumes Jan 5"],
    ["Annual license · Dashboard", "Umbrella GmbH", "ACTIVE", "Yearly", "€7,260.00", "Mar 14", ["STRIPE", "EU live"], "Mirrored", "SEND_INVOICE", "Cancels at period end"],
    ["Starter support", "Stark Ind.", "CANCELLED", "Monthly", "€484.00", "—", ["STRIPE", "EU live"], "Mirrored", "CHARGE_AUTOMATICALLY", "Cancelled Oct 31"],
  ];
  function subscriptions() {
    return '<div class="a-page">' + head("Subscriptions", "Recurring plans, mirrored at the provider when it supports subscriptions.", btn("Export", "file") + btn("New subscription", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active", 27, "of 34 total") + stat("MRR", "€21,480", "+€1,260") + stat("Past due", 3, "€4,356 at risk", 1) + stat("Trialing", 2, "ends within 14 days") + stat("Churn (30d)", "2.1%", "1 cancelled") + "</div>" +
      views([["All", 34], ["Active", 27], ["Past due", 3], ["Trialing", 2], ["Paused", 1], ["Renewing this week", 6], ["Cancelling", 2]], "All") +
      '<div class="toolbar">' + search("Search customer, plan, provider id") + sel("Table", "grid") + sel("Sort: Next renewal ↑", "sort") + sel("Columns (9)", "settings") + "</div>" +
      fbar([["Status", "is any of", "Active, Past due, Trialing"], ["Interval", "is any of", "Month, Quarter"], ["Connection", "is", "any"], ["Collection method", "is", "any"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="bulk"><span class="cb on"></span><b>1 selected</b><span style="flex:1"></span>' + btn("Retry payment", "zap", "sm") + btn("Pause", "clock", "sm") + btn("Cancel at period end", "x", "sm") + btn("Change plan", "layers", "sm") + "</div>" +
      '<div class="panel" style="margin-top:0"><table>' + th(["", "Plan / customer", "Status", "Interval", "Collection", "Provider", "Next renewal", ">Amount / period", ""]) + "<tbody>" + SUBS.map((r, i) => "<tr><td>" + cb(i === 2) + "</td><td>" + ink(r[0]) + '<br><span class="muted">' + r[1] + (r[9] ? " · " + r[9] : "") + "</span></td><td>" + sub(r[2]) + "</td><td>" + r[3] + "</td><td>" + E(r[8]) + "</td><td>" + prov(r[6][0], r[6][1]) + '<br><span class="muted">' + r[7] + "</span></td><td>" + r[5] + '</td><td class="num">' + r[4] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" +
      pager("1-7 of 34") +
      dm(["Subscription · status, company_id, billing_profile_id, interval, interval_count, collection_method, period_amount, current_period_end, trial_end, cancel_at_period_end, paused_at, resume_at, provider_connection_id, provider_subscription_id", "SubscriptionItem · quantity, unit_amount · SavedView · entity_type SUBSCRIPTION"], []) + "</div>";
  }

  /* =====================================================================================================================
     SUBSCRIPTION DETAIL
     @screen Subscription detail
     @route  /billing/subscription (production /billing/subscriptions/:id) ?tab=overview|invoices|items|history
     @perm   VIEW finance.subscriptions.read · change plan, pause, resume, cancel, retry finance.subscriptions.manage* · edit billing profile finance.billing_profiles.manage*
     @api    GET /finance/subscriptions/:id · PATCH /:id · POST /:id/change-plan {items[], proration} · /pause {resume_at} · /resume · /cancel {at: now|period_end|date, reason} · /retry-payment · GET /:id/upcoming-invoice
     @mcp    finance_subscriptions_read · finance_subscriptions_manage
     @data   Subscription (all columns) · SubscriptionItem (product_id, price_id, quantity, unit_amount, provider_item_id) · Invoice (subscription_id) · Coupon · PaymentMethod · DunningPolicy · PaymentProviderObject
     @ui     Tabs, Card, Dialog (change plan with proration preview, pause, cancel with reason), Timeline, Switch
     @states loading · not found · error · no-access · past-due banner with retry · paused/cancelled read-only banner
     @audit  plan changes (old/new items), pause, resume, cancel + reason, retry, coupon change, collection method change
     @note   Upgrades and downgrades change SubscriptionItems; history lives in audit_events. Proration is previewed by the API (the provider for mirrored subscriptions). Cancel offers: now, at period end (cancel_at_period_end), or on a date (cancel_at).
             Setup fee (setup_fee) is invoiced once (setup_fee_invoiced_at). Failed charges follow the customer's DunningPolicy.
     ===================================================================================================================== */
  function subscription() {
    return '<div class="a-page">' +
      '<div class="a-head"><div><h1>Support plan Gold</h1><p>Northwind Traders · started Mar 8, 2026 · ' + sub("PAST_DUE") + " " + E("CHARGE_AUTOMATICALLY") + '</p></div><div class="acts">' + btn("Retry payment", "zap") + btn("Change plan", "layers") + btn("Pause", "clock") + btn("Cancel", "x") + btn("Edit", "edit", "primary") + more + "</div></div>" +
      callout("flag", "<b>Payment failed on Nov 8:</b> card_declined (insufficient funds). Retry 2 of 4 runs Nov 12 09:00. After retry 4 the policy pauses the subscription and notifies the owner.", "warn") +
      '<div class="mini-stats">' + stat("Per period", "€1,452.00", "incl. 21% VAT · monthly") + stat("Period", "Nov 8 – Dec 7", "current_period_start/end") + stat("Lifetime paid", "€11,616", "8 invoices") + stat("Open", "€1,452", "INV-2026-0041-S", 1) + stat("Setup fee", "€250", "invoiced Mar 8") + "</div>" +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      '<div class="tabset">' + tabs([["it", "Plan"], ["iv", "Invoices", 8], ["hs", "History"]], "it") +
      pane("it", 1, cd("<b>Plan items</b><span class='r muted'>SubscriptionItem</span>", tbl(["Product", "Price", ">Qty", ">Unit amount", ">Total"], [[ink("Support plan Gold"), "Monthly EUR", "1", "€1,000.00", "€1,000.00"], [ink("Extra seats"), "Per seat monthly", "2", "€100.00", "€200.00"]]) + '<div class="rowx"><div class="grow muted">Net €1,200.00 + VAT 21% = <b>€1,452.00</b></div>' + btn("Add item", "plus", "sm") + "</div>", 1) + gap() +
        cd("<b>Upcoming invoice</b><span class='r muted'>preview, Dec 8</span>", '<div class="rowx"><div class="grow"><b>Support plan Gold + 2 seats</b><small>Dec 8 – Jan 7 · charged automatically to Visa 4242</small></div><b>€1,452.00</b></div>' + '<div class="sub-note" style="padding:8px 12px">A change of plan today would prorate: credit €0.00, charge €0.00 (past-due periods are not prorated).</div>', 1) + gap() +
        cd("<b>Change plan</b><span class='r muted'>Dialog preview</span>", f("New plan", sel("Support plan Platinum · €2,000 / month", "layers")) + f("Proration", seg(["Prorate now", "At next renewal", "No proration"], "Prorate now")) + '<div class="rowx"><div class="grow"><b>Effective immediately</b><small>Upgrade: charge difference today (€412.00 incl. VAT)</small></div>' + btn("Confirm change", "check", "sm primary") + "</div>")) +
      pane("iv", 0, tbl(["Invoice", "Period", "Status", ">Total", "Paid"], [[ink("INV-2026-0041-S"), "Nov 8 – Dec 7", inv("OVERDUE"), "€1,452.00", "—"], [ink("INV-2026-0034-S"), "Oct 8 – Nov 7", inv("PAID"), "€1,452.00", "Oct 8"], [ink("INV-2026-0029-S"), "Sep 8 – Oct 7", inv("PAID"), "€1,452.00", "Sep 8"]])) +
      pane("hs", 0, '<div class="tl"><div class="ev"><b>Payment failed (card_declined)</b><small>Nov 8 · retry 1 failed Nov 9</small></div><div class="ev"><b>Plan changed: +2 extra seats</b><small>Aug 14 · Finn Nolan · prorated €58.00</small></div><div class="ev"><b>Subscription created from proposal PRO-2026-0019</b><small>Mar 8 · setup fee invoiced</small></div></div>') + "</div>" +
      "</div><div>" +
      cd("<b>Billing</b>", prop("Customer", "Northwind Traders " + muted("(02)")) + prop("Billing profile", '<a href="#billing/customer">Open</a>') + prop("Project", "Mobile App v2") + prop("Contract", "CTR-2026-0009") + prop("Interval", "Every 1 month " + muted("interval_count 1")) + prop("Collection", E("CHARGE_AUTOMATICALLY")) + prop("Payment method", "Visa 4242 · exp 08/2028") + prop("Coupon", "None") + prop("Dunning policy", "Standard (4 retries)") + prop("Trial", "No")) + gap() +
      cd("<b>Provider</b>", prop("Connection", prov("STRIPE", "EU live")) + prop("Mirrored as", "sub_1Oq3…Xp") + prop("Last sync", "Nov 11, 08:02") + '<div class="sub-note">Viva Wallet has no native subscriptions: the platform schedule and Automation (20) would renew and charge instead.</div>') + gap() +
      cd("<b>Cancel or pause</b>", '<div class="rowx"><div class="grow"><b>Cancel at period end</b><small>Dec 7 · cancel_at_period_end</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Cancel on a date</b><small>cancel_at</small></div>' + sel("Pick a date", "calendar") + '</div><div class="rowx"><div class="grow"><b>Pause until</b><small>paused_at, resume_at</small></div>' + sel("Pick a date", "calendar") + "</div>" + f("Cancellation reason", sel("Too expensive", "")) ) +
      "</div></div>" +
      dm(["Subscription · all columns (status, interval, interval_count, collection_method, current_period_start/end, trial_start/end, cancel_at, cancel_at_period_end, cancelled_at, cancellation_reason, paused_at, resume_at, setup_fee, setup_fee_invoiced_at, period_amount, provider_subscription_id)", "SubscriptionItem · quantity, unit_amount, provider_item_id · Invoice.subscription_id · PaymentMethod · DunningPolicy · Coupon"], []) + "</div>";
  }

  /* =====================================================================================================================
     PAYMENTS LIST + REFUNDS (spec "Payments")
     @screen Payments
     @route  /billing/payments?tab=payments|refunds&view=&filter=
     @perm   VIEW finance.payments.read* (sensitive) · record manual finance.payments.record* · refund finance.payments.refund* · export finance.reports.export*
     @api    GET /finance/payments?filter=&cursor= · POST /finance/payments {billing_profile_id, method_type, amount, received_at, reference, allocations[{invoice_id, amount}]} · GET /finance/refunds · POST /finance/payments/:id/refunds
     @mcp    finance_payments_read · finance_payments_record · finance_payments_refund (human confirmation for AI agents)
     @data   Payment (status, provider, provider_connection_id, provider_payment_id, method_type, currency, amount, fee_amount, tax_amount, net_amount, refunded_amount, kind, reference, received_at, failure_code, failure_message) · PaymentAllocation · Refund · SavedView (PAYMENT)
     @ui     Tabs, Table, filter bar, ToggleGroup views, Dialog "Record payment", DropdownMenu row actions
     @states loading · empty · error · no-access (read* missing hides the whole app entry for finance.payments) · partial (fees hidden without sensitive permission)
     @audit  payments recorded manually (who, reference), refunds requested/processed, failed payment recovery actions, exports
     @note   Online payments are created by webhooks (ProviderWebhookEvent, idempotent); manual ones (cash, check, bank transfer) are recorded here with received_at and allocated to invoices. Payment.kind distinguishes deposit, milestone, subscription,
             invoice (free text kind column). Fees, tax and net are stored per payment so 09 reconciles payouts. Failed payments show failure_code/message and the recovery action.
     ===================================================================================================================== */
  const PAYS = [
    ["pi_3QxN…8aK2", "Acme Corp", "INV-2026-0042", "CARD", "Visa 4242", ["STRIPE", "EU live"], "SUCCEEDED", "Nov 5", 5000, 125.25, 0, "Deposit"],
    ["pi_3Qwz…4bH1", "Globex Hellas", "INV-2026-0040", "CARD", "Mastercard 5555", ["VIVA_WALLET", "GR live"], "SUCCEEDED", "Nov 3", 3630, 61.71, 0, "Subscription"],
    ["pi_3Qw8…7dM0", "Northwind Traders", "INV-2026-0041-S", "CARD", "Visa 0002", ["STRIPE", "EU live"], "FAILED", "Nov 8", 1452, 0, 0, "card_declined"],
    ["pi_3QwA…1Zk9", "Hooli", "INV-2026-0035", "CARD", "Visa 4242", ["STRIPE", "EU live"], "PARTIALLY_REFUNDED", "Sep 30", 2420, 61.1, 1210, "Refund pending"],
    ["pi_3Qv2…9cT4", "Initech", "INV-2026-0039", "SEPA_DEBIT", "DE89…3000", ["STRIPE", "EU live"], "PROCESSING", "Nov 10", 15125, 0, 0, "Settles in 3-5 days"],
    ["MAN-0021", "Stark Ind.", "INV-2026-0030", "BANK_TRANSFER", "Alpha Bank ref 0030", ["BANK", ""], "SUCCEEDED", "Oct 28", 4840, 0, 0, "Recorded by Anna Meyer"],
    ["pi_3Qu1…2aA7", "Hooli", "INV-2026-0035", "CARD", "Visa 4242", ["STRIPE", "EU live"], "REFUNDED", "Sep 28", 2420, 61.1, 2420, "Refunded Oct 2"],
  ];
  function payments() {
    return '<div class="a-page">' + head("Payments", "Online and manually recorded payments, with fees, tax and refunds.", btn("Export", "file") + btn("Record payment", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Collected (Nov)", "€31,220", "net €30,614 after fees") + stat("Processing", "€15,125", "1 SEPA debit") + stat("Failed", "€1,452", "1 payment", 1) + stat("Fees (Nov)", "€606", "1.9% effective") + stat("Refunded", "€3,630", "2 refunds") + "</div>" +
      '<div class="tabset">' + tabs([["p", "Payments", 148], ["r", "Refunds", 5], ["f", "Failed recovery", 3]], "p") +
      pane("p", 1, views([["All", 148], ["Succeeded", 131], ["Failed", 3], ["Processing", 1], ["Refunded", 5], ["Manual", 9]], "All") +
        '<div class="toolbar">' + search("Search provider id, customer, invoice, reference") + sel("Table", "grid") + sel("Sort: Received ↓", "sort") + sel("Columns (9)", "settings") + "</div>" +
        fbar([["Status", "is any of", "Succeeded, Failed, Processing"], ["Received", "between", "Sep 1 – Nov 30"], ["Method", "is any of", "Card, SEPA debit"], ["Provider connection", "is", "any"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
        '<div class="panel" style="margin-top:0"><table>' + th(["Payment", "Customer / invoice", "Method", "Provider", "Status", "Received", ">Amount", ">Fee", ">Refunded", ""]) + "<tbody>" + PAYS.map((r) => "<tr><td>" + ink(r[0]) + '<br><span class="muted">' + r[11] + "</span></td><td>" + r[1] + '<br><span class="muted">' + r[2] + "</span></td><td>" + E(r[3]) + '<br><span class="muted">' + r[4] + "</span></td><td>" + (r[5][1] ? prov(r[5][0], r[5][1]) : prov(r[5][0])) + "</td><td>" + pay(r[6]) + "</td><td>" + r[7] + '</td><td class="num">' + eur(r[8]) + '</td><td class="num">' + (r[9] ? eur(r[9]) : "—") + '</td><td class="num">' + (r[10] ? eur(r[10]) : "—") + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" + pager("1-7 of 148")) +
      pane("r", 0, tbl(["Refund", "Payment", "Customer", "Status", "Requested by", "Processed", ">Amount", "Reason"], [[ink("re_1Qy…Aa"), "pi_3QwA…1Zk9", "Hooli", E("PENDING", "yellow"), wh("SJ"), "—", "€1,210.00", "Duplicate payment"], [ink("re_1Qs…Bq"), "pi_3Qu1…2aA7", "Hooli", E("SUCCEEDED", "green"), wh("FN"), "Oct 2", "€2,420.00", "Campaign cancelled"], [ink("re_1Qr…Xt"), "pi_3Qt0…8nE2", "Globex Hellas", E("FAILED", "red"), wh("AM"), "Sep 20", "€300.00", "Provider: charge already refunded"], [ink("re_1Qp…Cd"), "pi_3Qs9…1aS5", "Acme Corp", E("CANCELLED"), wh("MS"), "—", "€150.00", "Requested by mistake"]])) +
      pane("f", 0, tbl(["Payment", "Customer", "Failure", "Attempts", "Next step", ""], [[ink("pi_3Qw8…7dM0"), "Northwind Traders", "card_declined · insufficient funds", "2 of 4", "Retry Nov 12 09:00 (RETRY_PAYMENT)", btn("Retry now", "zap", "sm")], [ink("pi_3Qq4…2mL3"), "Stark Ind.", "expired_card", "1 of 4", "E-mail customer to update card", btn("Send link", "send", "sm")], [ink("pi_3Qp7…6vB1"), "Umbrella GmbH", "authentication_required", "1 of 4", "Customer must confirm 3-D Secure", btn("Send link", "send", "sm")]])) + "</div>" +
      dm(["Payment · all columns (status, provider, provider_connection_id, provider_payment_id, method_type, amount, fee_amount, tax_amount, net_amount, refunded_amount, kind, reference, failure_code, failure_message, received_at, recorded_by_user_id)", "PaymentAllocation · Refund · SavedView · entity_type PAYMENT"], []) + "</div>";
  }

  /* =====================================================================================================================
     PAYMENT DETAIL
     @screen Payment detail
     @route  /billing/payment (production /billing/payments/:id)
     @perm   VIEW finance.payments.read* · refund finance.payments.refund* · allocate/edit manual finance.payments.record* · receipt download finance.payments.read*
     @api    GET /finance/payments/:id · POST /:id/allocations · POST /:id/refunds {amount, reason} · GET /:id/receipt
     @mcp    finance_payments_read · finance_payments_refund
     @data   Payment (all columns) · PaymentAllocation (invoice_id, amount) · Refund · PaymentMethod · PaymentProviderConnection · ProviderWebhookEvent (read-only, raw events) · Document (receipt) · LedgerRecord/LedgerSettlement (09, read-only)
     @ui     Card, Table, Dialog (refund), Badge, Collapsible raw webhook payload (admins only)
     @states loading · not found · error · no-access · refunding (PENDING) · provider does not support partial refunds (field disabled with the reason)
     @audit  allocation changes, refund requested/approved/processed/failed, receipt generated, webhook event linked
     @note   Never stores card data: only provider tokens and brand/last4. Partial refund is offered only if the connection's capabilities allow it. refunded_amount is the sum of SUCCEEDED refunds; status becomes PARTIALLY_REFUNDED or REFUNDED.
     ===================================================================================================================== */
  function payment() {
    return '<div class="a-page">' +
      '<div class="a-head"><div><h1>pi_3QxN…8aK2</h1><p>€5,000.00 from Acme Corp · received Nov 5, 2026 · ' + pay("SUCCEEDED") + " " + E("CARD") + '</p></div><div class="acts">' + btn("Download receipt", "file") + btn("Open at Stripe", "link") + btn("Refund", "dollar", "primary") + more + "</div></div>" +
      '<div class="mini-stats">' + stat("Amount", "€5,000.00", "EUR") + stat("Fee", "€125.25", "2.5% + €0.25") + stat("Net", "€4,874.75", "net_amount") + stat("VAT in payment", "€867.77", "tax_amount") + stat("Refunded", "€0.00", "none") + "</div>" +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Allocated to invoices</b><span class='r muted'>PaymentAllocation</span>", tbl(["Invoice", "Customer", ">Invoice total", ">Allocated", "Invoice status"], [[ink("INV-2026-0042"), "Acme Corp", "€12,711.05", "€5,000.00", inv("PARTIALLY_PAID")]]) + '<div class="rowx"><div class="grow muted">Unallocated: €0.00. A payment can be split across invoices.</div>' + btn("Reallocate", "edit", "sm") + "</div>", 1) + gap() +
      cd("<b>Refund</b><span class='r muted'>Dialog preview, finance.payments.refund*</span>", f("Amount", two(box("€5,000.00"), sel("Full refund / Partial", "")), "Maximum refundable €5,000.00. Partial refunds supported by Stripe EU live.") + f("Reason", sel("Duplicate / Fraudulent / Requested by customer / Other", "")) + f("Note to customer", box("Optional message in the refund e-mail")) +
        '<div class="rowx"><div class="grow"><b>Also issue a credit note</b><small>Keeps the invoice total consistent: CN-2026-0008</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Needs approval</b><small>Refunds above €500 are approved by a second person (FinanceApprovalRule, entity_type REFUND; approver needs finance.refunds.approve*)</small></div>' + E("PENDING", "yellow") + "</div>" +
        '<div class="rowx"><div class="grow muted">Creates Refund (PENDING) and calls the provider adapter. Status follows the webhook payment.refunded.</div>' + btn("Request refund", "check", "sm primary") + "</div>") + gap() +
      cd("<b>Refund history</b><span class='r muted'>Refund</span>", '<div class="sub-note">No refunds on this payment.</div>') + gap() +
      cd("<b>Events</b><span class='r muted'>ProviderWebhookEvent, idempotent</span>", '<div class="tl"><div class="ev"><b>payment.succeeded</b><small>Nov 5, 10:42 · evt_1QxN… · processed</small></div><div class="ev"><b>Checkout completed by Lena Kovac</b><small>Nov 5, 10:41 · hosted invoice page</small></div></div>') +
      "</div><div>" +
      cd("<b>Payment</b>", prop("Customer", "Acme Corp") + prop("Kind", "Deposit " + muted("kind")) + prop("Method", E("CARD") + " Visa 4242 · 08/2028") + prop("Provider", prov("STRIPE", "EU live")) + prop("Provider payment id", "pi_3QxN4fKk…8aK2") + prop("Checkout id", "cs_live_a1Z…") + prop("Reference", "INV-2026-0042") + prop("Received", "Nov 5, 2026 10:42") + prop("Recorded by", "Automatic (webhook)")) + gap() +
      cd("<b>Accounting (09)</b>", prop("Income record", "INC-2026-0187") + prop("Settlement", "Payout po_1Qy… · Nov 8 " + muted("LedgerSettlement")) + prop("Fee booked", "€125.25 · Payment processing fees") + prop("Bank account", "Stripe EU balance " + muted("ledger_payment_method"))) + gap() +
      cd("<b>Failure</b>", '<div class="sub-note">failure_code and failure_message are shown for FAILED payments, with the recovery action (retry, send payment link, update method).</div>') +
      "</div></div>" +
      dm(["Payment · all columns · PaymentAllocation · Refund (amount, status, reason, requested_by_user_id, processed_at) · PaymentMethod (brand, last4, exp) · ProviderWebhookEvent", "PaymentDispute · status, amount, reason, evidence_due_at · PaymentPayout · amount, fee_amount, arrival_date, reconciled_at", "FinanceApproval · entity_type REFUND", "Read-only: LedgerRecord, LedgerSettlement (09), Document (receipt)"], []) + "</div>";
  }

  /* =====================================================================================================================
     PAYMENT LINKS (spec "Payments", Payment Providers: hosted checkout)
     @screen Payment links
     @route  /billing/links · /billing/links/new
     @perm   VIEW finance.payments.read* · create/edit/disable finance.payment_links.manage*
     @api    GET /finance/payment-links · POST /finance/payment-links {title, amount|price_id, currency, invoice_id?, billing_profile_id?, provider_connection_id?, expires_at?, max_uses?, accepted_methods[]} · POST /:id/disable
     @mcp    finance_payment_links_create (AI may draft; sending needs human confirmation)
     @data   PaymentLink (public_token, title, description, amount, currency, allow_custom_amount, url, status, accepted_methods, expires_at, max_uses, uses, completed_at, provider_link_id, created_by_user_id) · links to BillingProfile, Invoice, Price, PaymentProviderConnection · Payment.payment_link_id
     @ui     Table, Dialog/Sheet create form, QR code, Copy button, Select connection
     @states loading · empty ("Create a link to collect a one-time payment") · error · no-access · expired · no active connection (connect a provider)
     @audit  link created, disabled, used (Payment created)
     @note   A link opens the provider's hosted checkout (Stripe Checkout, Viva Wallet Smart Checkout) for an amount, a catalog price or an invoice, without a customer account. Payments made through it create a normal Payment (kind "payment_link")
             and, when tied to an invoice, a PaymentAllocation. Routing follows 08 "Routing"; with several matching connections the checkout page offers a choice.
     ===================================================================================================================== */
  function links() {
    return '<div class="a-page">' + head("Payment links", "Share a hosted checkout without creating an invoice.", btn("New link", "plus", "primary")) +
            '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      tbl(["Link", "For", "Connection", "Status", ">Amount", ">Uses", "Expires", ""], [[ink("Website deposit · Acme"), "Invoice INV-2026-0042", prov("STRIPE", "EU live"), E("ACTIVE", "green"), "€7,711.05", "0 / 1", "Nov 20", btn("Copy", "link", "sm") + more], [ink("Workshop seat"), "Price: Workshop €150", prov("STRIPE", "EU live"), E("ACTIVE", "green"), "€150.00", "6 / 20", "Dec 1", btn("Copy", "link", "sm") + more], [ink("Hosting top-up"), "Custom amount", prov("VIVA_WALLET", "GR live"), E("EXPIRED"), "any", "2 / —", "Oct 31", more], [ink("Retainer setup · Globex"), "Customer: Globex Hellas", prov("VIVA_WALLET", "GR live"), E("COMPLETED", "blue"), "€500.00", "1 / 1", "—", more]]) +
      "</div><div>" +
      cd("<b>New payment link</b>", f("Title", box("Shown on the checkout page")) + f("What is being paid", seg(["Fixed amount", "Catalog price", "Invoice", "Customer chooses"], "Invoice")) + f("Invoice", sel("INV-2026-0042 · €7,711.05 due", "receipt")) + f("Customer", sel("Acme Corp", "building")) + two(f("Expires", sel("Nov 20", "calendar")), f("Max uses", box("1"))) + f("Connection", sel("Auto (routing)", "plug")) + f("Accepted methods", seg(["Card", "SEPA debit", "Wallet"], "Card")) +
        '<div class="rowx"><div class="grow"><b>Allow customer to choose provider</b></div>' + sw(1) + "</div>" + '<div class="rowx"><div class="grow muted">QR code and copy button appear after saving.</div>' + btn("Create link", "check", "sm primary") + "</div>") +
      "</div></div>" +
      dm(["Payment · provider_checkout_id, kind, provider_connection_id · Invoice · hosted_invoice_url, provider_invoice_id", "PaymentLink · public_token, title, description, amount, currency, allow_custom_amount, url, status (ACTIVE | EXPIRED | DISABLED | COMPLETED), accepted_methods, expires_at, max_uses, uses, price_id, invoice_id, billing_profile_id, provider_connection_id, provider_link_id", "Price · BillingProfile · PaymentProviderConnection"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREDIT NOTES (spec "Invoicing: Credit notes")
     @screen Credit notes
     @route  /billing/credits?status=&q= · create via Dialog or /billing/credits/new?invoice=
     @perm   VIEW finance.invoices.read · create/issue/apply/void finance.credit_notes.manage* (sensitive) · refund the balance finance.payments.refund*
     @api    GET /finance/credit-notes · POST /finance/credit-notes {invoice_id, reason, lines[], billing_profile_id} · POST /:id/{issue|apply|void} · GET /:id/pdf
     @mcp    finance_credit_notes_manage (human confirmation for AI agents)
     @data   CreditNote (number, status, billing_profile_id, invoice_id, currency, subtotal, tax_total, total, reason, lines Json, pdf_document_id, provider_credit_note_id, issued_at, applied_at, voided_at) · Invoice · NumberSequence (entity_type credit_note)
     @ui     Table, Sheet or Dialog with editable lines (copied from the invoice), Badge
     @states loading · empty · error · no-access · invoice already fully credited
     @audit  created, issued, applied to invoice or customer balance, voided (reason)
     @note   Status flow DRAFT, ISSUED, APPLIED or VOID. Lines are a Json snapshot of the credited lines (so later catalog changes never alter it). Applying reduces the invoice amount_due; if the invoice is already paid, the balance is refunded
             (Refund) or kept as customer credit (no balance table: the unapplied credit note total is the credit). Mirrored at the provider when the connection supports credit notes.
     ===================================================================================================================== */
  function credits() {
    return '<div class="a-page">' + head("Credit notes", "Corrections to invoices that were already sent.", btn("Export", "file") + btn("New credit note", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Issued (30d)", "€2,420", "1 note") + stat("Draft", 1, "€2,420") + stat("Unapplied credit", "€0", "") + stat("Applied", "€1,210", "this year") + "</div>" +
      views([["All", 9], ["Draft", 1], ["Issued", 2], ["Applied", 5], ["Void", 1]], "All") + fbar([["Status", "is any of", "Draft, Issued"], ["Customer", "is", "any"], ["Issued", "after", "Jan 1"]], btn("Save view", "plus", "sm")) +
      tbl(["Number", "Invoice", "Customer", "Status", "Reason", "Issued", ">Subtotal", ">Tax", ">Total", ""], [[ink("CN-2026-0007"), "INV-2026-0035", "Hooli", ES("DRAFT"), "Campaign cancelled", "—", "€2,000.00", "€420.00", "€2,420.00", more], [ink("CN-2026-0006"), "INV-2026-0031", "Acme Corp", ES("ISSUED", "blue"), "Pricing correction", "Oct 20", "€500.00", "€105.00", "€605.00", more], [ink("CN-2026-0005"), "INV-2026-0028", "Initech", ES("APPLIED", "green"), "Duplicate line", "Oct 2", "€1,000.00", "€210.00", "€1,210.00", more], [ink("CN-2026-0004"), "INV-2026-0024", "Globex Hellas", ES("VOID"), "Issued in error", "Sep 14", "€300.00", "€63.00", "€363.00", more]]) +
      gap() + cd("<b>New credit note</b><span class='r muted'>full page or dialog</span>", '<div class="g2"><div>' + f("Invoice", sel("INV-2026-0035 · Hooli · €2,420.00 paid", "receipt")) + f("Reason", box("Campaign cancelled by customer")) + f("Result", seg(["Reduce amount due", "Refund to payment method", "Keep as customer credit"], "Refund to payment method")) + '</div><div>' + tbl(["Line", ">Credit qty", ">Amount", ">Tax"], [["Launch campaign · fixed price", "1", "€2,000.00", "€420.00"]]) + '<div class="rowx"><div class="grow"><b>Total credit</b></div><b>€2,420.00</b></div>' + "</div></div>") +
      dm(["CreditNote · number, status, billing_profile_id, invoice_id, currency, subtotal, tax_total, total, reason, lines (Json), pdf_document_id, provider_credit_note_id, issued_at, applied_at, voided_at, created_by_user_id", "NumberSequence · entity_type credit_note", "FinanceApproval · entity_type CREDIT_NOTE | WRITE_OFF (approve: finance.adjustments.approve*)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CUSTOMERS' BILLING PROFILES — list (spec "Customer Billing")
     @screen Customer billing
     @route  /billing/customers?view=&filter=
     @perm   VIEW finance.invoices.read (customer totals need finance.payments.read*) · edit/create profile finance.billing_profiles.manage* · CRM company itself is 02 (crm.companies.read)
     @api    GET /finance/billing-profiles?filter= · POST /finance/billing-profiles {company_id, legal_name, ...} · PATCH /:id
     @mcp    finance_billing_profiles_manage
     @data   BillingProfile (company_id, legal_name, billing_email, tax_id, vat_number, tax_exempt, currency, payment_terms_days, dunning_policy_id, default_payment_method_id, preferred_provider_connection_id) · CrmCompany (02, read-only) · Invoice/Payment/Subscription aggregates
     @ui     Table with filter bar, Dialog or full page for create, Badge, DropdownMenu
     @states loading · empty ("No billing profiles yet") · error · no-access · missing profile (CRM company without a profile shows "Create profile")
     @audit  profile created/changed (tax ids and payment terms are sensitive fields in the diff)
     @note   One BillingProfile per CrmCompany (02 owns the company, 08 the money fields). Totals (outstanding, lifetime revenue) are computed, never stored.
     ===================================================================================================================== */
  function customers() {
    const R = [["Acme Corp", "Lena Kovac", "EUR", "Net 30", "EL998877665", "No", ["STRIPE", "EU live"], "Standard", "€7,711", "€61,200", 3],
      ["Northwind Traders", "Paul Henry", "EUR", "Net 15", "DE811223344", "No", ["STRIPE", "EU live"], "Strict", "€9,922", "€32,400", 1],
      ["Globex Hellas", "Eleni Papas", "EUR", "Net 14", "EL123123123", "No", ["VIVA_WALLET", "GR live"], "Standard", "€0", "€23,900", 1],
      ["Initech", "Mark Lumbergh", "EUR", "Net 30", "IE6388047V", "No", ["STRIPE", "EU live"], "Standard", "€15,125", "€48,900", 1],
      ["Hooli", "Gavin Belson", "USD", "Net 30", "US-EIN 12-3456789", "Yes", ["STRIPE", "EU live"], "Standard", "€0", "€11,100", 0],
      ["Umbrella GmbH", "Heike Braun", "EUR", "Net 30", "DE200300400", "No", ["STRIPE", "EU live"], "Standard", "€9,680", "€7,260", 1]];
    return '<div class="a-page">' + head("Customer billing", "Billing profile of every CRM company: tax, terms, methods, preferred provider.", btn("Export", "file") + btn("New billing profile", "plus", "primary")) +
      views([["All", 58], ["With outstanding", 9], ["Tax exempt", 4], ["No payment method", 11], ["Missing VAT number", 3]], "All") +
      '<div class="toolbar">' + search("Search company, legal name, VAT number, e-mail") + sel("Sort: Outstanding ↓", "sort") + sel("Columns (9)", "settings") + "</div>" +
      fbar([["Currency", "is any of", "EUR, USD"], ["Tax exempt", "is", "any"], ["Preferred connection", "is", "any"]], btn("Save view", "plus", "sm")) +
      '<div class="panel" style="margin-top:0"><table>' + th(["Company", "Billing contact", "Currency", "Terms", "VAT / tax id", "Tax exempt", "Preferred provider", "Dunning", ">Outstanding", ">Lifetime", ">Subs", ""]) + "<tbody>" + R.map((r) => "<tr><td>" + ink(r[0]) + "</td><td>" + r[1] + "</td><td>" + r[2] + "</td><td>" + r[3] + "</td><td>" + r[4] + "</td><td>" + (r[5] === "Yes" ? E("Exempt", "blue") : "—") + "</td><td>" + prov(r[6][0], r[6][1]) + "</td><td>" + r[7] + '</td><td class="num">' + r[8] + '</td><td class="num">' + r[9] + '</td><td class="num">' + r[10] + "</td><td>" + more + "</td></tr>").join("") + "</tbody></table></div>" + pager("1-6 of 58") +
      dm(["BillingProfile · company_id, legal_name, billing_email, tax_id, vat_number, tax_exempt, currency, payment_terms_days, dunning_policy_id, preferred_provider_connection_id", "Read-only: CrmCompany (02) · aggregates over Invoice, Payment, Subscription"], []) + "</div>";
  }

  /* =====================================================================================================================
     CUSTOMER BILLING PROFILE — detail and edit (spec "Customer Billing", "Taxes & Discounts: customer-specific pricing")
     @screen Customer billing profile
     @route  /billing/customer (production /billing/customers/:companyId) ?tab=profile|methods|history|pricing
     @perm   VIEW finance.invoices.read · edit finance.billing_profiles.manage* · payment history finance.payments.read* · custom pricing finance.billing_profiles.manage* · remove payment method finance.billing_profiles.manage*
     @api    GET /finance/billing-profiles/:id · PATCH /:id · GET /:id/payment-methods · POST /:id/payment-methods/setup-link · DELETE /:id/payment-methods/:methodId · GET /:id/history
     @mcp    finance_billing_profiles_manage
     @data   BillingProfile (all columns) · PaymentMethod (type, provider, provider_connection_id, provider_method_id, brand, last4, exp_month, exp_year, bank_details, is_default, disabled_at) · PaymentProviderObject (object_type CUSTOMER) · Invoice · Payment · Subscription · CrmContact (02)
     @ui     Tabs, form with Select / Popover+Command / Switch / Textarea, address fieldset, Table, Dialog "Request payment method" (sends a setup link)
     @states loading · not found · error · no-access · validation (VAT format) · saved toast
     @audit  tax data, terms, default method, custom pricing changes (field diff); payment method added/removed
     @note   Card data is never stored: PaymentMethod holds only provider tokens, brand, last4, expiry. A saved method belongs to one provider connection and cannot move to another. billing_contact_ids are CRM contacts (02).
             custom_pricing (Json) holds per-product overrides or a percentage discount used when creating invoices and proposals. VIES result: BillingProfile.vat_validation_status + vat_validated_at; reverse_charge selects the 0% reverse-charge TaxRate.
     ===================================================================================================================== */
  function customer() {
    return '<div class="a-page">' +
      '<div class="a-head"><div><h1>Acme Corp</h1><p>Billing profile · customer since Feb 2025 · ' + E("EUR") + " " + E("Net 30") + '</p></div><div class="acts">' + btn("New invoice", "plus") + btn("Open in CRM", "crm") + btn("Save", "check", "primary") + more + "</div></div>" +
      '<div class="mini-stats">' + stat("Outstanding", "€7,711.05", "1 invoice") + stat("Lifetime revenue", "€61,200", "since 2025") + stat("Avg days to pay", "12.4", "last 10 invoices") + stat("Subscriptions", "2", "€1,210 / month") + stat("Payment risk", "Low", "AI estimate, advisory") + "</div>" +
      '<div class="tabset">' + tabs([["pr", "Profile"], ["me", "Payment methods", 2], ["pc", "Pricing"], ["hi", "History"]], "pr") +
      pane("pr", 1, '<div class="g2" style="align-items:start"><div>' +
        cd("<b>Company & tax</b>", f("Legal name", box("Acme Corporation Ltd")) + two(f("Tax id", box("EL998877665")), f("VAT number", box("EL998877665"), "VIES: VALID, checked Nov 2, 2026 · BillingProfile.vat_validation_status, vat_validated_at")) + '<div class="rowx"><div class="grow"><b>Tax exempt</b><small>All tax lines become 0 and the invoice shows the exemption note</small></div>' + sw(0) + "</div>" + two(f("Currency", sel("EUR", "dollar")), f("Payment terms", sel("Net 30 days", "calendar"))) + f("Notes", '<div class="editor"><div class="ed-body" style="min-height:50px">Send invoices to accounts, cc project owner. PO number required on every invoice.</div></div>')) + gap() +
        cd("<b>Contacts</b>", f("Billing e-mail", box("accounts@acme.example")) + f("Billing contacts", sel("Lena Kovac, Tom Adler", "users"), "billing_contact_ids: CRM contacts that receive invoices and reminders.")) +
        "</div><div>" + cd("<b>Addresses</b>", f("Billing address", box("12 Ermou Street, 105 63 Athens, Greece")) + f("Shipping address", box("Same as billing"))) + gap() +
        cd("<b>Collection</b>", f("Preferred provider connection", sel("Stripe EU live", "plug"), "Used first by routing (08 Routing). Leave empty for automatic.") + f("Default payment method", sel("Visa 4242 · Stripe EU live", "dollar")) + f("Dunning policy", sel("Standard", "bell")) + f("Collection method", seg(["Send invoice", "Charge automatically"], "Send invoice"))) + "</div></div>") +
      pane("me", 0, tbl(["Type", "Detail", "Provider connection", "Default", "Status", ""], [[E("CARD"), "Visa 4242 · exp 08/2028", prov("STRIPE", "EU live"), E("Default", "blue"), E("Active", "green"), more], [E("SEPA_DEBIT"), "DE89 •••• 3000 · mandate sdd_1Q…", prov("STRIPE", "EU live"), "", E("Active", "green"), more], [E("BANK_TRANSFER"), "Alpha Bank · IBAN on invoices", prov("BANK"), "", E("Active", "green"), more]]) + '<div class="rowx"><div class="grow muted">Customers add methods in the portal (07); you can send a secure setup link. Methods stay with the provider connection that issued them.</div>' + btn("Send setup link", "send", "sm") + "</div>") +
      pane("pc", 0, cd("<b>Customer-specific pricing</b><span class='r muted'>BillingProfile.custom_pricing</span>", tbl(["Product", "List price", "Customer price", "Valid"], [["Development hours", "€95.00 / h", "€85.00 / h", "until Dec 31"], ["Support plan Gold", "€1,000 / month", "€900 / month", "ongoing"]]) + '<div class="rowx"><div class="grow muted">Applied when adding products to invoices and proposals.</div>' + btn("Add override", "plus", "sm") + "</div>", 1)) +
      pane("hi", 0, tbl(["Date", "Type", "Reference", "Status", ">Amount"], [["Nov 5", "Payment", "pi_3QxN…8aK2", pay("SUCCEEDED"), "€5,000.00"], ["Nov 3", "Invoice", "INV-2026-0042", inv("PARTIALLY_PAID"), "€12,711.05"], ["Oct 20", "Credit note", "CN-2026-0006", ES("ISSUED", "blue"), "€605.00"], ["Oct 1", "Invoice", "INV-2026-0038", inv("PENDING"), "€605.00"]])) + "</div>" +
      dm(["BillingProfile · all columns · PaymentMethod · all columns · PaymentProviderObject (CUSTOMER at each connection)", "BillingProfile · vat_validation_status (VALID | INVALID | UNKNOWN), vat_validated_at, reverse_charge", "Read-only: CrmCompany, CrmContact (02), Invoice, Payment, Subscription"], []) + "</div>";
  }

  /* =====================================================================================================================
     CATALOG — products, prices, coupons (spec "Products & Services", "Taxes & Discounts")
     @screen Catalog
     @route  /billing/catalog?tab=products|prices|coupons · /billing/catalog/new (create product, full page shown below)
     @perm   VIEW finance.catalog.read · create/edit/archive finance.catalog.manage (products, prices, tax rates, coupons)
     @api    GET/POST/PATCH /finance/products · /finance/prices · /finance/coupons · POST /finance/products/:id/sync {connection_id}
     @mcp    finance_catalog_read · finance_catalog_manage
     @data   Product (name, slug, type, description, unit, default_tax_rate_id, is_active, archived_at) · Price (product_id, name, currency, unit_amount, type, interval, interval_count, trial_days, setup_fee, is_active) · Coupon · PaymentProviderObject (PRODUCT, PRICE, COUPON per connection)
     @ui     Tabs, Table, filter bar, Sheet/page for product with price table, Select/Popover+Command, Switch, Badge
     @states loading · empty · error · no-access · archived (hidden from pickers, kept on old invoices) · sync error per connection
     @audit  product/price/coupon created, archived, price changed (old/new), synced to a connection
     @note   This is the single platform catalog used by 02 deal lines, 03 proposals, 18 billing rates and invoices. A price is immutable once used: changing it creates a new Price (the old one is deactivated). Only providers with a catalog
             (Stripe) get product/price/coupon objects (PaymentProviderObject); Viva Wallet uses the platform records only. Coupon.redemptions is maintained by the service.
     ===================================================================================================================== */
  function catalog() {
    return '<div class="a-page">' + head("Catalog", "Products and services, prices, coupons. Used by CRM, proposals, time rates and invoices.", btn("Sync to providers", "plug") + btn("New product", "plus", "primary")) +
      '<div class="tabset">' + tabs([["pd", "Products", 24], ["pr", "Prices", 41], ["cp", "Coupons", 6], ["nw", "New product"]], "pd") +
      pane("pd", 1, '<div class="toolbar">' + search("Search products") + sel("Type: All", "filter") + sel("Active", "check") + "</div>" + tbl(["Product", "Type", "Unit", "Default tax", "Prices", "Providers", "Active", ""], [[ink("Development hours"), E("DEVELOPMENT_HOURS"), "h", "VAT 21%", "3", prov("STRIPE") + " synced", sw(1), more], [ink("Maintenance plan"), E("MAINTENANCE_PLAN"), "month", "VAT 21%", "2", prov("STRIPE") + " synced", sw(1), more], [ink("Support plan Gold"), E("SUPPORT_PLAN"), "month", "VAT 21%", "1", prov("STRIPE") + " synced", sw(1), more], [ink("Website design package"), E("PACKAGE"), "package", "VAT 21%", "2", prov("STRIPE") + " synced", sw(1), more], [ink("Dashboard license"), E("LICENSE"), "year", "VAT 21%", "1", prov("STRIPE") + ' <span class="badge yellow">sync error</span>', sw(1), more], [ink("Brand workshop"), E("SERVICE"), "session", "VAT 21%", "1", "Platform only", sw(0), more]])) +
      pane("pr", 0, tbl(["Product", "Price", "Type", ">Amount", "Interval", "Trial", ">Setup fee", "Active"], [["Development hours", "Standard rate", E("ONE_TIME"), "€95.00", "—", "—", "—", sw(1)], ["Development hours", "Senior rate", E("ONE_TIME"), "€120.00", "—", "—", "—", sw(1)], ["Maintenance plan", "Monthly", E("RECURRING"), "€450.00", "Every 1 month", "—", "€250.00", sw(1)], ["Maintenance plan", "Yearly", E("RECURRING"), "€4,860.00", "Every 1 year", "—", "€250.00", sw(1)], ["Support plan Gold", "Monthly", E("RECURRING"), "€1,000.00", "Every 1 month", "14 days", "€250.00", sw(1)]])) +
      pane("cp", 0, tbl(["Coupon", "Code", "Type", ">Value", "Duration", ">Redeemed", "Valid", "Active"], [[ink("Launch 10%"), "LAUNCH10", E("PERCENTAGE"), "10%", E("ONCE"), "14 / 50", "Jan 1 – Dec 31", sw(1)], [ink("Loyalty year 2"), "LOYAL15", E("PERCENTAGE"), "15%", E("REPEATING") + " 12 mo", "5 / —", "ongoing", sw(1)], [ink("Setup fee waiver"), "NOSETUP", E("FIXED"), "€250.00", E("ONCE"), "9 / 25", "ends Dec 31", sw(1)], [ink("Black Friday"), "BF2026", E("PERCENTAGE"), "20%", E("FOREVER"), "0 / 100", "Nov 24 – Nov 30", sw(0)]]) + '<div class="sub-note" style="margin-top:8px">Coupon fields: name, code, type, value, currency (fixed), duration, duration_months, max_redemptions, valid_from, valid_until, is_active.</div>') +
      pane("nw", 0, '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div>' + cd("<b>Product</b>", f("Name", box("Brand workshop")) + f("Slug", box("brand-workshop")) + f("Type", seg(["Service", "Package", "Development hours", "Maintenance plan", "Support plan", "Subscription", "License", "Other"], "Service")) + f("Description", '<div class="editor"><div class="ed-body" style="min-height:60px">Half-day workshop on brand positioning.</div></div>') + two(f("Unit", box("session")), f("Default tax rate", sel("VAT 21%", "receipt")))) + gap() + cd("<b>Prices</b><span class='r'>" + btn("Add price", "plus", "sm") + "</span>", tbl(["Name", "Type", ">Amount", "Currency", "Interval", "Trial"], [["Standard", E("ONE_TIME"), "€1,200.00", "EUR", "—", "—"]]), 1) + '</div><div>' + cd("<b>Sync</b>", '<div class="rowx"><div class="grow"><b>Stripe EU live</b><small>Creates PRODUCT and PRICE objects</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Viva Wallet GR live</b><small>No catalog: not applicable</small></div>' + sw(0) + '</div><div class="rowx"><div class="grow"><b>Active</b></div>' + sw(1) + "</div>") + "</div></div>") + "</div>" +
      dm(["Product · name, slug, type, description, unit, default_tax_rate_id, is_active, archived_at", "Price · product_id, name, currency, unit_amount, type, interval, interval_count, trial_days, setup_fee, is_active", "Coupon · name, code, type, value, currency, duration, duration_months, max_redemptions, redemptions, valid_from, valid_until, is_active", "PaymentProviderObject · object_type PRODUCT | PRICE | COUPON, provider_object_id, last_synced_at, last_error"], []) + "</div>";
  }

  /* =====================================================================================================================
     TAX SETTINGS (spec "Taxes & Discounts")
     @screen Tax settings
     @route  /billing/tax?tab=rates|rules|exemptions
     @perm   VIEW finance.catalog.read · manage tax rates finance.catalog.manage · VAT position/returns belong to 09 (finance.vat.read, finance.vat.manage*)
     @api    GET/POST/PATCH /finance/tax-rates · POST /finance/tax-rates/:id/sync {connection_id}
     @mcp    finance_catalog_manage
     @data   TaxRate (name, percentage, country, region, behavior, is_default, is_active) · BillingProfile (tax_exempt, vat_number) · PaymentProviderObject (TAX_RATE) · LedgerSettings (09, which rate is the default in the ledger, read-only)
     @ui     Table, Sheet to edit a rate, Select (country, region, behavior), Switch
     @states loading · empty · error · no-access · rate in use (cannot delete, only deactivate)
     @audit  rate created, percentage changed (new rate recommended), deactivated
     @note   Rates are INCLUSIVE or EXCLUSIVE (TaxBehavior). Regional rules choose a rate by the customer's billing address country/region; exempt customers get 0. A used rate is never edited: create a new one and deactivate the old, so
             old invoices keep their tax_percent snapshot. The VAT position, returns and filings are 09; this screen only defines the rates that invoices use.
     ===================================================================================================================== */
  function tax() {
    return '<div class="a-page">' + head("Tax settings", "Tax rates and the rules that pick one for an invoice. VAT returns are in Income & expenses (09).", btn("New tax rate", "plus", "primary")) +
      '<div class="tabset">' + tabs([["rt", "Rates", 6], ["ru", "Rules"], ["ex", "Exemptions"]], "rt") +
      pane("rt", 1, tbl(["Name", ">Rate", "Country", "Region", "Behavior", "Default", "Active", "Provider", ""], [[ink("VAT 21%"), "21%", "Greece", "—", E("EXCLUSIVE"), E("Default", "blue"), sw(1), prov("STRIPE") + " synced", more], [ink("VAT 24% (GR standard)"), "24%", "Greece", "—", E("EXCLUSIVE"), "", sw(1), prov("STRIPE") + " synced", more], [ink("VAT 13% (GR reduced)"), "13%", "Greece", "—", E("EXCLUSIVE"), "", sw(1), "Platform only", more], [ink("DE VAT 19%"), "19%", "Germany", "—", E("EXCLUSIVE"), "", sw(1), prov("STRIPE") + " synced", more], [ink("UK VAT 20% inclusive"), "20%", "United Kingdom", "—", E("INCLUSIVE"), "", sw(1), "Platform only", more], [ink("No tax"), "0%", "—", "—", E("EXCLUSIVE"), "", sw(1), "Platform only", more]]) + '<div class="sub-note" style="margin-top:8px">TaxRate: name, percentage, country, region, behavior, is_default, is_active.</div>') +
      pane("ru", 0, cd("<b>Rate selection</b><span class='r muted'>order of evaluation</span>", ['<div class="rowx"><div class="grow"><b>1. Customer is tax exempt</b><small>BillingProfile.tax_exempt, rate 0%, invoice shows the exemption note</small></div>' + sw(1) + "</div>", '<div class="rowx"><div class="grow"><b>2. Product default rate</b><small>Product.default_tax_rate_id</small></div>' + sw(1) + "</div>", '<div class="rowx"><div class="grow"><b>3. Regional rate by billing address</b><small>Country and region match; Germany gets DE VAT 19%</small></div>' + sw(1) + "</div>", '<div class="rowx"><div class="grow"><b>4. Organization default</b><small>TaxRate.is_default</small></div>' + sw(1) + "</div>", '<div class="rowx"><div class="grow"><b>EU B2B reverse charge (valid VAT id)</b><small>BillingProfile.reverse_charge + vat_validation_status VALID → TaxRate.is_reverse_charge (0%)</small></div>' + sw(0) + "</div>"].join(""), 1)) +
      pane("ex", 0, tbl(["Customer", "Reason", "VAT number", "Certificate", "Valid until"], [[ink("Hooli"), "Outside EU (US)", "US-EIN 12-3456789", "—", "ongoing"], [ink("Cyprus NGO"), "Non-profit exemption", "CY10223344X", "Certificate.pdf (17)", "Dec 31, 2027"]]) + '<div class="sub-note" style="margin-top:8px">Today only BillingProfile.tax_exempt exists; reason, certificate and expiry are not modeled (add as custom fields or document links).</div>') + "</div>" +
      dm(["TaxRate · name, percentage, country, region, behavior, is_default, is_active", "TaxRate · is_reverse_charge, tax_category, invoice_note (legal text on the invoice)", "BillingProfile · tax_exempt, vat_number, vat_validation_status, vat_validated_at, reverse_charge · PaymentProviderObject · object_type TAX_RATE", "Read-only: LedgerSettings (09)"], []) + "</div>";
  }

  /* =====================================================================================================================
     NUMBERING & TEMPLATES (spec "Invoicing: numbering, templates, branding")
     @screen Numbering and templates
     @route  /billing/numbering?tab=numbering|templates
     @perm   templates finance.invoice_templates.manage · numbering finance.invoices.update at organization scope (changes are sensitive: audited) · branding comes from organization settings (01 §15, organizations.branding.manage)
     @api    GET/PATCH /finance/numbering · GET/POST/PATCH /finance/invoice-templates · POST /finance/invoice-templates/:id/preview
     @mcp    finance_invoice_templates_manage
     @data   NumberSequence (entity_type invoice | credit_note, prefix, year, next_number, padding) · InvoiceTemplate (name, is_default, layout, branding, locale, default_notes, default_footer, payment_instructions, payment_terms_days, archived_at)
     @ui     Tabs, form, Select (locale), color/logo pickers (branding), live PDF preview, Table
     @states loading · error · no-access · "next number lower than the last used" validation error · template in use (archive instead of delete)
     @audit  next_number or prefix changed, template created/archived/default changed
     @note   Numbers are issued in one transaction (INV-2026-0042 = prefix INV, year 2026, padding 4). The number cannot be lowered below the highest used. Sequences reset per year when year is set. The pattern is NumberSequence.format ({PREFIX}-{YYYY}-{####}) and reset_policy is NEVER or YEARLY (year stays null when NEVER).
             Templates fall back to organization branding; a customer's invoice uses its template or the default.
     ===================================================================================================================== */
  function numbering() {
    return '<div class="a-page">' + head("Numbering & templates", "How invoice and credit note numbers look and how invoices are branded.", btn("New template", "plus", "primary")) +
      '<div class="tabset">' + tabs([["nu", "Numbering"], ["tp", "Templates", 3]], "nu") +
      pane("nu", 1, '<div class="g2" style="align-items:start">' + cd("<b>Invoices</b><span class='r muted'>entity_type invoice</span>", two(f("Prefix", box("INV")), f("Padding", box("4"))) + two(f("Format", box("{PREFIX}-{YYYY}-{####}")), f("Reset", sel("Yearly", "calendar"), "NumberSequence.format, reset_policy")) + two(f("Year", sel("2026 (resets yearly)", "calendar")), f("Next number", box("0044"))) + '<div class="rowx"><div class="grow"><b>Preview</b></div><span class="badge blue">INV-2026-0044</span></div>' + '<div class="sub-note">NumberSequence.format and reset_policy; numbers are allocated gap-free when the invoice is finalized.</div>') +
        cd("<b>Credit notes</b><span class='r muted'>entity_type credit_note</span>", two(f("Prefix", box("CN")), f("Padding", box("4"))) + two(f("Format", box("{PREFIX}-{YYYY}-{####}")), f("Reset", sel("Yearly", "calendar"), "NumberSequence.format, reset_policy")) + two(f("Year", sel("2026 (resets yearly)", "calendar")), f("Next number", box("0008"))) + '<div class="rowx"><div class="grow"><b>Preview</b></div><span class="badge blue">CN-2026-0008</span></div>') + "</div>" + gap() +
        callout("lock", "<b>Numbers are never reused.</b> Voiding or cancelling an invoice keeps its number (the gap is documented by the VOID invoice). Lowering next_number below the highest issued number is refused.", "")) +
      pane("tp", 0, tbl(["Template", "Locale", "Default", "Terms", "Branding", "Used by", ""], [[ink("Logiqdev standard · EN"), "en", E("Default", "blue"), "Net 30", "Logo, brand blue", "212 invoices", more], [ink("Logiqdev standard · EL"), "el", "", "Net 14", "Logo, brand blue", "36 invoices", more], [ink("Retainer minimal"), "en", "", "Net 7", "Logo only", "12 invoices", more]]) + gap() +
        '<div class="g2" style="grid-template-columns:1.3fr 1fr;align-items:start">' + cd("<b>Edit template</b>", f("Name", box("Logiqdev standard · EN")) + two(f("Locale", sel("English", "globe")), f("Default terms", sel("Net 30 days", "calendar"))) + f("Default notes", box("Thank you for your business.")) + f("Payment instructions", box("Bank transfer details and reference")) + f("Default footer", box("Company, VAT id, registration")) + f("Branding", '<div class="rowx" style="gap:8px;padding:0">' + tok("Logo") + tok("Primary colour") + tok("Font") + "</div>", "Falls back to organization branding (01 §15). Layout JSON: sections order, columns shown, tax summary style.") + "</div>" +
        cd("<b>Preview</b>", '<div class="bv-paper"><div class="bv-paper-h"><b>Logiqdev Ltd</b><span>INVOICE INV-2026-0044</span></div><div class="bv-paper-l"></div><div class="bv-paper-l s"></div><div class="bv-paper-l"></div><div class="bv-paper-l s"></div><div class="bv-paper-t">Total €12,711.05</div></div>') + "</div>")) +
      dm(["NumberSequence · entity_type invoice | credit_note, prefix, year, next_number, padding", "NumberSequence · format, reset_policy (NEVER | YEARLY)", "InvoiceTemplate · name, is_default, layout, branding, locale, default_notes, default_footer, payment_instructions, payment_terms_days, archived_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     REMINDERS & DUNNING (spec "Recurring Billing", "Automation")
     @screen Reminders and dunning
     @route  /billing/dunning?tab=policies|activity
     @perm   VIEW finance.invoices.read · manage policies finance.dunning.manage · manual reminder finance.invoices.send · write-off finance.adjustments.manage*
     @api    GET/POST/PATCH /finance/dunning-policies · GET /finance/reminders?invoice_id=&status= · POST /finance/invoices/:id/remind
     @mcp    finance_dunning_manage (AI may draft reminder text, never send in bulk without confirmation)
     @data   DunningPolicy (name, is_default, steps Json, max_payment_retries) · InvoiceReminder (invoice_id, action, offset_days, automation_run_id, scheduled_job_run_id, communication_id, sent_at) · BillingProfile.dunning_policy_id · Invoice (reminder_count, last_reminder_at)
     @ui     Table, step editor (reorderable list with Select for action and offset), Switch, Sheet to preview the e-mail, Dialog test send
     @states loading · empty · error · no-access · policy in use (shows how many customers)
     @audit  policy changed (old/new steps), reminders sent (InvoiceReminder), retries, subscription paused/cancelled by dunning
     @note   steps is a Json list [{ action: DunningAction, offset_days (negative = before due), template }] scheduled by the Automation Engine (20). Actions: REMINDER, RETRY_PAYMENT, NOTIFY_OWNER, PAUSE_SUBSCRIPTION,
             CANCEL_SUBSCRIPTION, MARK_UNCOLLECTIBLE. Delivery goes through 11 (e-mail via the organization's Resend connection) and notifications 14. MARK_UNCOLLECTIBLE sets Invoice.uncollectible_at + uncollectible_reason (status stays OVERDUE) and a write-off via finance.adjustments.manage*.
     ===================================================================================================================== */
  function dunning() {
    const steps = [["-3", "REMINDER", "Friendly reminder before due date"], ["+1", "REMINDER", "Invoice overdue notice"], ["+7", "REMINDER", "Second reminder, mentions late fees"], ["+7", "NOTIFY_OWNER", "Task for the account owner"], ["+14", "RETRY_PAYMENT", "Retry saved card (subscriptions)"], ["+30", "PAUSE_SUBSCRIPTION", "Pause the subscription"], ["+60", "MARK_UNCOLLECTIBLE", "Write off after approval"]];
    return '<div class="a-page">' + head("Reminders & dunning", "What happens when an invoice or a charge is not paid.", btn("Send test", "send") + btn("New policy", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Reminders sent (30d)", 42, "11 led to payment") + stat("Recovered", "€14,380", "by dunning") + stat("Open overdue", 1, "€8,470", 1) + stat("Retries today", 2, "Nov 11, 09:00") + stat("Policies", 3, "Standard is default") + "</div>" +
      '<div class="tabset">' + tabs([["po", "Policies", 3], ["ac", "Activity"]], "po") +
      pane("po", 1, '<div class="g2" style="grid-template-columns:1fr 1.5fr;align-items:start">' + cd("<b>Policies</b>", [["Standard", "Default · 12 customers · 4 retries"], ["Strict", "Short fuse · 5 customers · 2 retries"], ["Enterprise gentle", "Long terms · 3 customers · 3 retries"]].map((r, i) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + (i === 0 ? E("Default", "blue") : "") + more + "</div>").join(""), 1) +
        cd("<b>Standard</b><span class='r'>" + btn("Add step", "plus", "sm") + "</span>", f("Max payment retries", box("4"), "DunningPolicy.max_payment_retries; retries are spread by the retry steps.") + '<div class="bv-steps">' + steps.map((s, i) => '<div class="rowx"><span class="bv-n">' + (i + 1) + '</span><div class="grow"><b>' + s[2] + "</b><small>" + s[0] + " days from due date</small></div>" + E(s[1], s[1] === "MARK_UNCOLLECTIBLE" || s[1] === "PAUSE_SUBSCRIPTION" ? "red" : s[1] === "NOTIFY_OWNER" ? "yellow" : "blue") + more + "</div>").join("") + "</div>" + '<div class="rowx"><div class="grow"><b>Stop when the customer pays or disputes</b></div>' + sw(1) + "</div>") + "</div>") +
      pane("ac", 0, tbl(["Sent", "Invoice", "Customer", "Action", "Offset", "Channel", "Result"], [["Nov 5, 09:00", ink("INV-2026-0041"), "Northwind Traders", E("REMINDER"), "+7 d", "E-mail (11)", E("Delivered", "green")], ["Oct 26, 09:00", ink("INV-2026-0041"), "Northwind Traders", E("REMINDER"), "+1 d", "E-mail (11)", E("Opened", "green")], ["Nov 9, 09:00", ink("Support plan Gold"), "Northwind Traders", E("RETRY_PAYMENT"), "+1 d", "Provider", E("Failed", "red")], ["Nov 11, 07:00", ink("INV-2026-0045"), "Initech", E("REMINDER"), "-3 d", "E-mail (11)", E("Queued", "blue")]]) + '<div class="sub-note" style="margin-top:8px">One InvoiceReminder row per executed step. automation_run_id links to the Automation run (20).</div>') + "</div>" +
      dm(["DunningPolicy · name, is_default, steps (Json), max_payment_retries", "InvoiceReminder · action, offset_days, automation_run_id, scheduled_job_run_id, communication_id, sent_at", "BillingProfile · dunning_policy_id · Invoice · reminder_count, last_reminder_at, uncollectible_at, uncollectible_reason, written_off_amount"], []) + "</div>";
  }

  /* =====================================================================================================================
     REPORTS (spec "Financial Reporting")
     @screen Billing reports
     @route  /billing/reports?report=revenue|invoices|subscriptions|tax|outstanding|customer-history|cashflow|summary&period=&group=&provider=
     @perm   VIEW finance.reports.read* · export PDF/XLSX/CSV needs finance.reports.read* plus finance.reports.export* · save/schedule finance.reports.manage · invoice-level rows need finance.invoices.read
     @api    GET /finance/reports/:report?from=&to=&group_by=&provider=&connection_id= · POST /finance/reports/:report/export {format}
     @mcp    finance_reports_read (AI can summarize revenue, MRR, collections)
     @data   Invoice, InvoiceLineItem, Payment, Refund, CreditNote, Subscription/SubscriptionItem, TaxRate/tax_amount, PaymentProviderConnection. Nothing stored.
     @ui     Sidebar of reports, Card, chart, Table, Select (period, group by, provider), DropdownMenu Export (PDF, Excel, CSV)
     @states loading · empty · error · no-access · large export (queued, notification when ready)
     @audit  report exported (type, filter, format, rows)
     @note   All reports can be grouped by customer, project, product/service, provider and connection, month/quarter/year. Tax report totals per TaxRate (net, tax) for the period and reconcile with 09 VAT position.
             Cash flow here is cash IN (collected payments minus fees and refunds); cash out and P&L are 09. Saved and scheduled e-mailed reports are FinanceReportSchedule rows (run by 20, sent by 11).
     ===================================================================================================================== */
  function reports() {
    const list = [["Revenue", "chart", 1], ["Invoices", "receipt"], ["Subscriptions", "zap"], ["Tax", "dollar"], ["Outstanding balances", "clock"], ["Customer payment history", "users"], ["Cash flow", "layers"], ["Financial summary", "file"]];
    const Q = [["Q1", 118200, 112400, 5800], ["Q2", 124600, 119300, 5300], ["Q3", 131900, 127800, 4100], ["Q4 (to date)", 111620, 106200, 5420]];
    return '<div class="a-page">' + head("Reports", "Billing reports with export. Profit and loss are in Income & expenses (09).", sel("Year 2026", "calendar") + sel("Group: Quarter") + sel("All providers", "plug") + btn("Export", "file", "primary") + btn("Schedule", "mail")) +
      '<div class="g2" style="grid-template-columns:220px 1fr;align-items:start">' + cd("<b>Reports</b>", list.map((r) => '<div class="rowx"' + (r[2] ? ' style="background:var(--blue-soft)"' : "") + ">" + I(r[1], 14) + '<div class="grow">' + r[0] + "</div></div>").join(""), 1) +
      "<div>" + '<div class="mini-stats">' + stat("Invoiced", "€486,320", "2026 YTD") + stat("Collected", "€463,500", "net of refunds €2,420") + stat("Tax charged", "€84,400", "VAT") + stat("Fees", "€9,114", "1.9%") + stat("DSO", "14.3 d", "days sales outstanding") + "</div>" +
      cd("<b>Revenue by quarter</b><span class='r muted'>invoiced vs collected</span>", tbl(["Quarter", ">Invoiced", ">Collected", ">Outstanding", "Collection"], Q.map((r) => [r[0], eur(r[1]), eur(r[2]), eur(r[3]), bar(Math.round(r[2] / r[1] * 100), "green")]))) + gap() +
      '<div class="g2">' + cd("<b>Tax report</b><span class='r muted'>per TaxRate</span>", tbl(["Rate", ">Net", ">Tax"], [["VAT 21%", "€341,900", "€71,799"], ["VAT 24%", "€33,100", "€7,944"], ["DE VAT 19%", "€20,200", "€3,838"], ["No tax", "€11,320", "€0"]]), 1) +
      cd("<b>Outstanding balances</b><span class='r muted'>aging by customer</span>", tbl(["Customer", ">Current", ">1-30", ">31+"], [["Initech", "€15,125", "—", "—"], ["Acme Corp", "€7,711", "—", "—"], ["Northwind", "€1,452", "€8,470", "—"], ["Umbrella GmbH", "€9,680", "—", "—"]]), 1) + "</div>" + gap() +
      cd("<b>Export</b>", '<div class="rowx"><div class="grow"><b>Format</b><small>The export keeps the filter and totals</small></div>' + seg(["PDF", "Excel", "CSV"], "Excel") + '</div><div class="rowx"><div class="grow"><b>Recurring delivery</b><small>FinanceReportSchedule · frequency MONTH · recipient_emails accountant@acme-books.example</small></div>' + sw(0) + "</div>") + "</div></div>" +
      dm(["Invoice, InvoiceLineItem, Payment, Refund, CreditNote · aggregates by status, customer, project, product, provider, period", "Subscription + SubscriptionItem · MRR, churn · TaxRate · tax_amount, tax_percent", "PaymentProviderConnection · grouping by provider and connection", "FinanceReportSchedule · name, report_key, filters, format (PDF | XLSX | CSV), frequency, send_day, recipient_membership_ids, recipient_emails, enabled, next_run_at, last_run_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     PAYMENT PROVIDERS — connection status list (spec "Payment Providers")
     @screen Payment providers
     @route  /billing/providers
     @perm   VIEW finance.payment_providers.manage* (sensitive: the connection list is admin only) · connect/configure/disconnect finance.payment_providers.manage* · credentials: organizations.integrations.manage* in Admin > Integrations (recent MFA)
     @api    GET /finance/payment-providers · POST /finance/payment-providers {provider, display_name, integration_connection_id, mode, currencies[], method_types[], priority, is_default, branch_id?, ledger_payment_method_id?} · POST /:id/verify · /disconnect
     @mcp    finance_payment_providers_manage (AI agents cannot connect, rotate or disconnect)
     @data   PaymentProviderConnection (provider, display_name, status, mode, provider_account_id, integration_connection_id, capabilities, currencies, method_types, priority, is_default, branch_id, ledger_payment_method_id, last_checked_at, last_error) · IntegrationConnection (01, read-only: status and hints) · ProviderWebhookEvent
     @ui     Card per connection with status Badge, Table of events, Dialog "Connect provider" (choose an existing Integration Connection of category PAYMENTS), Select/Command, AlertDialog for disconnect
     @states loading · empty ("Connect Stripe or Viva Wallet in Admin > Integrations first") · error (last_error shown) · no-access · disconnect blocked (lists blockers)
     @audit  connection created, verified, mode/priority/default changed, webhook rejected, disconnected
     @note   Two steps (08 "Connections"): credentials once in Admin > Integrations (IntegrationConnection, category PAYMENTS, BYOK, write-only secrets), then this screen creates the PaymentProviderConnection that points at it and configures routing.
             Secrets are never stored on the payment connection and never shown. Providers: STRIPE and VIVA_WALLET only (MANUAL and BANK are not gateways). Webhook endpoint per connection: /webhooks/payments/:connectionId.
     ===================================================================================================================== */
  function providers() {
    const card = (n, p, st, mode, acct, cur, meth, extra, tone) => cd("<b>" + n + "</b><span class='r'>" + ES(st, CS[st]) + "</span>", prop("Provider", prov(p, mode)) + prop("Account", acct) + prop("Credentials", "Integration connection " + muted("Admin > Integrations")) + prop("Currencies", cur) + prop("Methods", meth) + extra + '<div class="rowx">' + btn("Open", "", "sm") + btn("Verify", "check", "sm") + "</div>");
    return '<div class="a-page">' + head("Payment providers", "Where money is collected. Invoices and subscriptions are provider-agnostic.", btn("Admin > Integrations", "key") + btn("Connect provider", "plus", "primary")) +
      callout("shield", "<b>Credentials live in Admin &rsaquo; Integrations.</b> This screen links a connection and configures routing. Secrets are never shown here or sent to the browser.", "") + gap(8) +
      '<div class="mini-stats">' + stat("Connections", 3, "2 active, 1 error") + stat("Volume (30d)", "€55,140", "") + stat("Success rate", "96.4%", "") + stat("Webhooks failing", 1, "Stripe EU test", 1) + stat("Disputes open", 0, "PaymentDispute") + "</div>" +
      '<div class="g3">' + card("Stripe EU", "STRIPE", "ACTIVE", "live", "acct_1Qe…Hn · Athens HQ", "EUR, USD, GBP", "Card, SEPA debit, Wallet", prop("Priority", "1 · default") + prop("Capabilities", "Partial refunds, native subscriptions, saved methods") + prop("Last check", "5 min ago · OK")) +
      card("Viva Wallet GR", "VIVA_WALLET", "ACTIVE", "live", "merchant 7f3a… · Greece branch", "EUR", "Card, Wallet", prop("Priority", "2 · branch Athens") + prop("Capabilities", "Refunds, saved methods; no native subscriptions (platform-run)") + prop("Last check", "5 min ago · OK")) +
      card("Stripe EU test", "STRIPE", "ERROR", "test", "acct_1Qf…Zz", "EUR", "Card", prop("Priority", "9") + prop("Last error", '<span style="color:var(--red)">Webhook signature invalid (4 h ago)</span>') + prop("Last check", "4 h ago")) + "</div>" + gap() +
      cd("<b>Routing order</b><span class='r muted'>08 Routing</span>", '<div class="bv-steps">' + [["Connection set on the invoice or subscription", ""], ["Billing profile preferred connection", ""], ["Active connections of the invoice branch, then the organization, accepting the currency and method, by lowest priority", ""], ["Organization default connection", "Stripe EU live"]].map((r, i) => '<div class="rowx"><span class="bv-n">' + (i + 1) + '</span><div class="grow">' + r[0] + "</div>" + (r[1] ? E(r[1], "blue") : "") + "</div>").join("") + "</div>", 1) +
      dm(["PaymentProviderConnection · all columns (status, mode, capabilities, currencies, method_types, priority, is_default, branch_id, last_checked_at, last_error)", "PaymentDispute · status, amount, reason, evidence_due_at · PaymentPayout · status, amount, fee_amount, arrival_date, reconciled_at", "Read-only: IntegrationConnection (01) · ProviderWebhookEvent"], []) + "</div>";
  }

  /* =====================================================================================================================
     PROVIDER CONNECTION — connect, configure, routing, webhooks, disconnect (spec "Connections", "Webhooks", "Changing or disconnecting")
     @screen Payment provider connection
     @route  /billing/provider (production /billing/providers/:id, new = /billing/providers/new) ?tab=settings|sync|webhooks|disconnect
     @perm   finance.payment_providers.manage* · viewing the linked credential metadata organizations.integrations.read · rotating keys organizations.integrations.manage* (Admin)
     @api    GET /finance/payment-providers/:id · PATCH /:id · POST /:id/verify · POST /:id/sync {object_type} · GET /:id/webhook-events?status= · POST /:id/webhook-events/:eventId/replay · GET /:id/disconnect-blockers · POST /:id/disconnect
     @mcp    finance_payment_providers_manage (read-only for AI)
     @data   PaymentProviderConnection · IntegrationConnection (name, status, mode, secret_hints, webhook_token: read-only) · PaymentProviderObject (sync state) · ProviderWebhookEvent (provider_event_id, event_type, received_at, processed_at, error) · Subscription/Payment/PaymentMethod (blockers)
     @ui     Tabs, form (Select, Switch, Popover+Command for currencies and methods), Table, AlertDialog listing blockers, Sheet with webhook payload (redacted)
     @states loading · not found · error (shows last_error) · no-access · verifying · disconnect blocked · webhook signature rejected
     @audit  settings changed, verified, synced, event replayed, disconnected (history kept)
     @note   Webhook URL per connection: /webhooks/payments/:connectionId, verified with that connection's signing secret (held in the IntegrationConnection). Events are idempotent by provider_event_id. A connection with active subscriptions,
             open online payments or saved methods in use cannot be disconnected until they are moved or cancelled; disconnected connections keep their history.
     ===================================================================================================================== */
  function provider() {
    return '<div class="a-page">' +
      '<div class="a-head"><div><h1>Stripe EU</h1><p>' + prov("STRIPE", "live") + " · connected Feb 12, 2026 by Finn Nolan · " + ES("ACTIVE", "green") + '</p></div><div class="acts">' + btn("Verify now", "check") + btn("Sync catalog", "layers") + btn("Save", "check", "primary") + more + "</div></div>" +
      '<div class="tabset">' + tabs([["se", "Settings"], ["sy", "Catalog sync"], ["wh", "Webhooks", 1], ["dc", "Disconnect"]], "se") +
      pane("se", 1, '<div class="g2" style="align-items:start"><div>' + cd("<b>Connection</b>", f("Display name", box("Stripe EU"), "Shown to admins and to customers when several providers are offered.") + f("Credentials", sel("Stripe EU live · sk-…a3f9", "key"), "IntegrationConnection of category PAYMENTS. Secrets are write-only: only hints are shown.") + two(f("Mode", seg(["Live", "Test"], "Live")), f("Status", ES("ACTIVE", "green"))) + f("Provider account", box("acct_1Qe…Hn · Logiqdev Ltd · GR"))) + gap() +
        cd("<b>Capabilities</b><span class='r muted'>from the last verification</span>", [["Hosted checkout", 1], ["Saved payment methods", 1], ["Off-session charges", 1], ["Partial refunds", 1], ["Native subscriptions", 1], ["Catalog sync (products, prices, tax rates, coupons)", 1], ["Payouts and fees", 1]].map((r) => '<div class="rowx">' + cb(r[1]) + '<div class="grow">' + r[0] + "</div></div>").join(""), 1) + "</div><div>" +
        cd("<b>Routing</b>", f("Accepted currencies", sel("EUR, USD, GBP", "dollar")) + f("Method types", sel("Card, SEPA debit, Wallet", "dollar")) + two(f("Priority", box("1"), "Lowest wins."), f("Default", sw(1))) + f("Branch", sel("All branches", "building"), "Set a branch so it collects through its own account (01 §34).") + f("Ledger payment method (09)", sel("Stripe EU balance", "dollar"), "Payouts and fees are booked against it.")) + gap() +
        cd("<b>Webhook endpoint</b>", prop("URL", "/webhooks/payments/3f9a…c21") + prop("Signing secret", "whsec_…c4d1 " + muted("write-only")) + prop("Last event", "Nov 11, 10:02 · payment.succeeded") + '<div class="sub-note">Configure this URL in your Stripe dashboard. Unverified events are rejected and audited.</div>') + "</div></div>") +
      pane("sy", 0, tbl(["Object type", ">Synced", ">Errors", "Last sync", ""], [["Customer " + muted("CUSTOMER"), "58", "0", "Nov 11, 08:00", btn("Sync", "", "sm")], ["Product " + muted("PRODUCT"), "23", "1", "Nov 11, 08:00", btn("Sync", "", "sm")], ["Price " + muted("PRICE"), "41", "0", "Nov 11, 08:00", btn("Sync", "", "sm")], ["Tax rate " + muted("TAX_RATE"), "4", "0", "Nov 11, 08:00", btn("Sync", "", "sm")], ["Coupon " + muted("COUPON"), "6", "0", "Nov 11, 08:00", btn("Sync", "", "sm")]]) + '<div class="sub-note" style="margin-top:8px">PaymentProviderObject: one row per platform record and connection (local_id, provider_object_id, last_synced_at, last_error). Dashboard license: price has an unsupported interval.</div>') +
      pane("wh", 0, tbl(["Received", "Event", "Provider event id", "Status", "Error", ""], [["Nov 11, 10:02", "payment.succeeded", "evt_1QzA…", E("Processed", "green"), "—", btn("View", "", "sm")], ["Nov 9, 09:00", "payment.failed", "evt_1Qy8…", E("Processed", "green"), "—", btn("View", "", "sm")], ["Nov 8, 14:12", "dispute.opened", "evt_1Qx3…", E("Stored", "yellow"), "No dispute model yet", btn("View", "", "sm")], ["Nov 7, 11:40", "payment.succeeded", "evt_1Qw0…", E("Failed", "red"), "Signature invalid", btn("Replay", "", "sm")]]) + '<div class="sub-note" style="margin-top:8px">ProviderWebhookEvent is unique per provider event id, so retries are idempotent. Payloads are redacted for non-admins.</div>') +
      pane("dc", 0, callout("flag", "<b>This connection cannot be disconnected yet.</b> Move or cancel the items below first. Past payments, refunds and invoices stay linked after disconnect.", "warn") + gap(8) + tbl(["Blocker", ">Count", "Action"], [["Active subscriptions mirrored at Stripe", "19", btn("Move to Viva Wallet", "", "sm")], ["Open online payments (PENDING/PROCESSING)", "1", btn("View", "", "sm")], ["Saved payment methods in use", "34", "Customers re-enter details on the new provider"]]) + gap() + btn("Disconnect", "x", "sm")) + "</div>" +
      dm(["PaymentProviderConnection · all columns · PaymentProviderObject · ProviderWebhookEvent", "PaymentDispute (open disputes block a disconnect) · Read-only: IntegrationConnection (01), Subscription, Payment, PaymentMethod (blockers)"], []) + "</div>";
  }

  /* =====================================================================================================================
     PROJECT BILLING SETTINGS (spec "Project Billing")
     @screen Project billing
     @route  /billing/projectbilling ?project=
     @perm   VIEW finance.invoices.read · edit finance.project_billing.manage · budget alert recipients need projects.finance.read (05)
     @api    GET /finance/project-billing?filter= · PUT /finance/project-billing/:projectId {billing_model, currency, fixed_amount, retainer_interval, hourly_rate, default_product_id, auto_invoice_milestones, auto_invoice_time, billing_interval, billing_day, budget_alert_percent}
     @mcp    finance_project_billing_manage
     @data   ProjectBillingSettings (project_id, billing_model, currency, fixed_amount, retainer_interval, hourly_rate, default_product_id, auto_invoice_milestones, auto_invoice_time, billing_interval, billing_day, budget_alert_percent) · Project (05, read-only) · Product · Contract.billing_model (seed)
     @ui     Table, Sheet editor, ToggleGroup (billing model), Select, Switch, Progress
     @states loading · empty · error · no-access · project without settings (defaults from the contract's billing_model)
     @audit  settings changed (field diff), auto-invoice runs (created invoices)
     @note   ProjectBillingSettings is seeded from Contract.billing_model on project creation. auto_invoice_milestones creates a DRAFT invoice when a ProjectMilestone is DONE (05 §20); auto_invoice_time bundles approved billable TimeEntries
             (18 §7) on billing_day. Auto-created invoices are DRAFTs that follow the normal approval flow.
     ===================================================================================================================== */
  function projectbilling() {
    return '<div class="a-page">' + head("Project billing", "How each project is invoiced. Invoices are created from milestones, approved time or a schedule.", btn("Export", "file")) +
      tbl(["Project", "Customer", "Model", ">Amount / rate", "Interval", "Auto: milestones", "Auto: time", "Budget alert", ""], [[ink("Acme Rebrand Website"), "Acme Corp", E("MILESTONE"), "€42,000 fixed", "—", sw(1), sw(0), "80%", btn("Edit", "edit", "sm")], [ink("Mobile App v2"), "Northwind Traders", E("TIME_AND_MATERIALS"), "€95.00 / h", "Month · day 1", sw(0), sw(1), "90%", btn("Edit", "edit", "sm")], [ink("Data Warehouse Setup"), "Initech", E("FIXED_PRICE"), "€48,000 fixed", "—", sw(0), sw(0), "—", btn("Edit", "edit", "sm")], [ink("Growth support"), "Globex Hellas", E("RETAINER"), "€3,000 / month", "Month · day 1", sw(0), sw(0), "—", btn("Edit", "edit", "sm")], [ink("Hosting"), "Acme Corp", E("MAINTENANCE"), "€500 / month", "Month · day 1", sw(0), sw(0), "—", btn("Edit", "edit", "sm")]]) + gap() +
      cd("<b>Edit: Mobile App v2</b>", '<div class="g2"><div>' + f("Billing model", seg(["Fixed price", "Milestone", "Time & materials", "Retainer", "Recurring", "Maintenance"], "Time & materials")) + two(f("Currency", sel("EUR", "dollar")), f("Hourly rate", box("€95.00"))) + f("Default product", sel("Development hours", "box")) + "</div><div>" + two(f("Billing interval", sel("Month", "calendar")), f("Billing day", box("1"))) + f("Budget alert at", box("90 %"), "Notifies the project owner (14) when billed + unbilled reaches this share of the budget.") + '<div class="rowx"><div class="grow"><b>Auto-invoice approved time</b><small>Creates a DRAFT on the billing day</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Auto-invoice milestones</b></div>' + sw(0) + "</div></div></div>") +
      dm(["ProjectBillingSettings · project_id, billing_model, currency, fixed_amount, retainer_interval, hourly_rate, default_product_id, auto_invoice_milestones, auto_invoice_time, billing_interval, billing_day, budget_alert_percent", "Read-only: Project (05), Contract.billing_model (04), TimeEntry (18)"], []) + "</div>";
  }

  const MAP = { dashboard, invoices, create, invoice, approvals, subscriptions, subscription, payments, payment, links, credits, customers, customer, catalog, tax, numbering, dunning, reports, providers, provider, projectbilling };
  const CRUMB = { invoice: "INV-2026-0042", subscription: "Support plan Gold", payment: "pi_3QxN…8aK2", customer: "Acme Corp", provider: "Stripe EU" };
  window.VIEWS.billing = { html: function (s) { return (MAP[s || "dashboard"] || MAP.dashboard)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
