/* =====================================================================================================================
   INCOME & EXPENSES APP — module 09 (docs/features/09-income-expense-management.md). The agency LEDGER: every income and expense record, VAT, supplier invoice intake, recurring costs, payroll, periods, P&L, profitability.
   =====================================================================================================================
   SCHEMA-ALIGNED to api/prisma/schema.prisma: LedgerSettings, LedgerCategory, LedgerPaymentMethod, LedgerSupplierProfile, LedgerRecord, LedgerSettlement, LedgerAttachment, LedgerInvoiceImport, LedgerInvoiceImportLine,
   RecurringExpense, PayrollSchedule, PayrollEntry, FinancialPeriod, FinancialPeriodSummary, LedgerProfitabilitySnapshot, LedgerInsight.
   Real enums: LedgerRecordType (INCOME, EXPENSE) · LedgerRecordStatus (DRAFT, PENDING_REVIEW, POSTED, VOIDED) · LedgerRecordSource (MANUAL, INVOICE_SYNC, PAYMENT_SYNC, SUBSCRIPTION_SYNC, SUPPLIER_INVOICE_IMPORT,
   RECURRING_EXPENSE, PAYROLL, API) · LedgerPaymentStatus (UNPAID, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED, REFUNDED) · LedgerVatTreatment (STANDARD, REDUCED, ZERO_RATED, EXEMPT, REVERSE_CHARGE, OUT_OF_SCOPE) ·
   LedgerSettlementKind (PAYMENT, REFUND, WRITE_OFF, ADJUSTMENT) · LedgerAttachmentKind (INVOICE, RECEIPT, PAYMENT_CONFIRMATION, CONTRACT, EXPENSE_DOCUMENTATION, OTHER) · LedgerCategoryKind (INCOME, EXPENSE) ·
   LedgerPlLine (REVENUE, COST_OF_OPERATIONS, EMPLOYEE_EXPENSES, OFFICE_EXPENSES, SOFTWARE_EXPENSES, MARKETING_EXPENSES, PROFESSIONAL_EXPENSES, OTHER_OPERATING_EXPENSES) · LedgerImportStatus (UPLOADED, PROCESSING,
   PENDING_REVIEW, APPROVED, REJECTED, DUPLICATE, FAILED) · RecurringExpenseStatus (ACTIVE, PAUSED, ENDED, CANCELLED) · PayrollEntryKind (SALARY, MONTHLY_PAYMENT, HOURLY_PAYMENT, BONUS, COMMISSION, OVERTIME,
   EMPLOYER_COST, BENEFIT, REIMBURSEMENT, OTHER) · PayrollEntryStatus (DRAFT, APPROVED, POSTED, CANCELLED) · FinancialPeriodType (DAY, WEEK, MONTH, QUARTER, YEAR, CUSTOM) · FinancialPeriodStatus (OPEN, CLOSED, LOCKED) ·
   LedgerReportBasis (ACCRUAL, CASH) · LedgerProfitabilityScope (PROJECT, CUSTOMER) · LedgerInsightKind (UNUSUAL_EXPENSE, DUPLICATE_SUSPECTED, MISSING_RECORD, CATEGORY_SUGGESTION, RECURRING_COST_DETECTED, FORECAST,
   MONTHLY_SUMMARY, BUDGET_ALERT, OTHER) · LedgerInsightStatus (OPEN, ACCEPTED, DISMISSED) · reused (08): TaxBehavior (INCLUSIVE, EXCLUSIVE), BillingInterval (DAY, WEEK, MONTH, QUARTER, YEAR), PaymentMethodType (CARD, BANK_TRANSFER,
   SEPA_DEBIT, CASH, CHECK, WALLET, OTHER).
   Permission keys (catalog, 31 incl. shared 08 keys): finance.income.{read,create,update,delete*,archive,export*} · finance.expenses.{read,create,update,delete*,archive,export*,approve*} · finance.categories.manage · finance.vat.{read,manage*} ·
   finance.periods.manage* · finance.payroll.{read*,manage*} · finance.recurring_expenses.{read,manage} · finance.budgets.{read,manage} · finance.expense_claims.{create_own,read_own,read*,approve*} · finance.invoice_imports.review · finance.profit_loss.read* · finance.profitability.read* · finance.ledger_settings.manage* · shared with 08: finance.approval_rules.manage*, finance.reports.{export*,manage}.
   Comment tags (legend in README.md): @screen @route @perm @api @mcp @data @ui @states @audit @note @gap. Every screen ends with a "Data model" footer (REVIEW-ONLY, do not ship).

   RULES THAT APPLY TO EVERY SCREEN HERE:
     - 09 owns the LEDGER, 08 owns billing. Invoices, payments and subscriptions of 08 create/update INCOME records (source INVOICE_SYNC / PAYMENT_SYNC / SUBSCRIPTION_SYNC, is_manual false) automatically; 09 never issues customer
       invoices. Synced income is read-only for the amounts (08 is the source); notes, category and allocation stay editable.
     - Money: net_amount, vat_percent, vat_amount, gross_amount are stored, always consistent (gross = net + vat). pricing_mode (TaxBehavior INCLUSIVE | EXCLUSIVE) tells which side the user typed; amounts_overridden marks a manual
       VAT correction by an authorized user. reporting_gross_amount = gross x fx_rate in LedgerSettings.reporting_currency. Amount columns are right aligned, tabular figures, the currency is the record's own.
     - Historical consistency: a record keeps category_path_snapshot and counterparty_name, so renaming or archiving a category / supplier never rewrites history.
     - Records are never silently deleted: status VOIDED (+ void_reason) or archive; hard delete (finance.*.delete*) writes an audit event and is blocked in a CLOSED / LOCKED period.
     - Periods: every record posts to a FinancialPeriod (period_id, from transaction_date). OPEN accepts edits, CLOSED needs finance.periods.manage*, LOCKED is frozen (corrections are ADJUSTMENT settlements or a new record).
     - Separation of duties (01): the creator of a record cannot approve it (approved_by_membership_id != created_by_membership_id). Over LedgerSettings.approval_threshold_amount a record goes DRAFT -> PENDING_REVIEW -> POSTED.
     - Sensitive (*) data is hidden by key: payroll needs finance.payroll.read*, P&L finance.profit_loss.read*, profitability finance.profitability.read*; the module also respects branch/team/project scope on every list.
     - Currency: EUR is the reporting currency in the samples; dates are shown short. Sample data only.
   ===================================================================================================================== */
(function () {
  const U = window.UI;
  const { E, ES, head, btn, cd, sw, cb, sel, stat, search, who, tok, kv, muted, more, callout, dm, tabs, pane } = U;
  const I = (n, s) => LQ.icon(n, s);
  const AV = LQ.av;
  const th = (a) => "<thead><tr>" + a.map((x) => "<th" + (x[0] === ">" ? ' class="num"' : "") + ">" + x.replace(/^>/, "") + "</th>").join("") + "</tr></thead>";
  const tbl = (cols, rows, wide) => '<div class="panel' + (wide ? " ex-scroll" : "") + '" style="margin-top:0"><table>' + th(cols) + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (cols[i][0] === ">" ? ' class="num"' : "") + ">" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  const bar = (p, tone) => '<span class="bar"><i style="width:' + Math.min(p, 100) + "%" + (tone ? ";background:var(--" + tone + ")" : "") + '"></i></span>' + p + "%";
  const ink = (t) => '<span class="ink">' + t + "</span>";
  const sp = (h) => '<div style="height:' + (h || 12) + 'px"></div>';
  const fmt = (n, d) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d });
  const eur = (n, cls, d) => '<span class="ex-amt ' + (cls || "") + '">€' + fmt(n, d) + "</span>";
  const eur0 = (n, cls) => eur(n, cls, 0);
  const f = (l, h, hint) => '<div class="fld"><label>' + l + "</label>" + h + (hint ? '<div class="sub-note">' + hint + "</div>" : "") + "</div>";
  const box = (t) => '<div class="input-fake">' + t + "</div>";
  const val = (t) => '<div class="input-fake" style="color:var(--ink)">' + t + "</div>";
  const row2 = (a, b) => '<div class="rowx" style="gap:10px;padding:0;align-items:flex-start"><div style="flex:1">' + a + '</div><div style="flex:1">' + b + "</div></div>";
  const prop = (k, v) => '<div class="kvr"><span>' + k + "</span><b>" + v + "</b></div>";
  const segs = (arr, on) => '<div class="ex-seg">' + arr.map((t) => '<span class="seg' + (t === on ? " on" : "") + '">' + t + "</span>").join("") + "</div>";
  const chip = (fl, o, v) => '<span class="fchip"><b>' + fl + "</b><i>" + o + "</i><span>" + v + "</span>" + I("x", 12) + "</span>";
  const filterBar = (chips, extra) => '<div class="fbar"><div class="fchips">' + chips.map((c) => chip(c[0], c[1], c[2])).join("") + '<button class="btn sm ghost">' + I("plus", 13) + ' Add filter</button></div><div class="fright">' + (extra || "") + "</div></div>";
  const brow = (l, v, p, cls) => '<div class="bar-row"><span class="l">' + l + '</span><span class="tr"><i style="width:' + p + "%" + (cls ? ";background:var(--" + cls + ")" : "") + '"></i></span><span class="v">' + v + "</span></div>";

  const PEOPLE = { AM: ["Anna Meyer", ""], MS: ["Marco Silva", "g"], SJ: ["Sofia Jensen", "y"], JK: ["Jonas Koch", "r"], KL: ["Kim Lund", "p"] };
  const wh = (a, s) => who(a, PEOPLE[a][1], PEOPLE[a][0], s || "");
  const av = (a) => AV(a, PEOPLE[a][1]);

  /* status colour maps: one place, same status renders the same everywhere (see U.E / enumLabel in production) */
  const STC = { DRAFT: "", PENDING_REVIEW: "yellow", POSTED: "green", VOIDED: "red" };
  const PSC = { UNPAID: "yellow", PARTIALLY_PAID: "blue", PAID: "green", OVERDUE: "red", CANCELLED: "", REFUNDED: "purple" };
  const TYC = { INCOME: "green", EXPENSE: "" };
  const st = (v) => E(v, STC[v]);
  const ps = (v) => E(v, PSC[v]);
  const ty = (v) => E(v, TYC[v]);
  const bd = (t, c) => '<span class="badge ' + (c || "") + '">' + t + "</span>";
  const SRC = { MANUAL: "edit", INVOICE_SYNC: "receipt", PAYMENT_SYNC: "dollar", SUBSCRIPTION_SYNC: "zap", SUPPLIER_INVOICE_IMPORT: "file", RECURRING_EXPENSE: "clock", PAYROLL: "users", API: "plug" };
  const src = (v) => '<span class="muted" title="LedgerRecordSource ' + v + '">' + I(SRC[v], 12) + " " + U.en(v) + "</span>";

  /* sample ledger (LedgerRecord). gross = net + vat; amount_remaining = gross - amount_paid */
  const R = [
    { n: "LED-2026-0412", t: "INCOME", s: "POSTED", src: "INVOICE_SYNC", d: "INV-2026-0142 · milestone 2 · Acme Rebrand Website", cat: "Software development", cp: "Acme Corp", pr: "Acme Rebrand Website", dt: "Nov 3", due: "Nov 17", net: 12000, v: 19, tr: "STANDARD", ps: "PARTIALLY_PAID", paid: 7140, pm: "Stripe", att: 1 },
    { n: "LED-2026-0411", t: "INCOME", s: "POSTED", src: "PAYMENT_SYNC", d: "Payment pay_3Qx9 · Northwind retainer November", cat: "Maintenance", cp: "Northwind", pr: "Northwind Maintenance", dt: "Nov 2", due: "Nov 2", net: 3500, v: 19, tr: "STANDARD", ps: "PAID", pm: "Stripe", att: 1 },
    { n: "LED-2026-0410", t: "EXPENSE", s: "POSTED", src: "SUPPLIER_INVOICE_IMPORT", d: "Hetzner Online · cloud hosting October", cat: "Hosting", cp: "Hetzner Online GmbH", pr: "", dt: "Nov 1", due: "Nov 15", net: 842.5, v: 0, tr: "REVERSE_CHARGE", ps: "PAID", pm: "Company card", att: 1 },
    { n: "LED-2026-0409", t: "EXPENSE", s: "POSTED", src: "RECURRING_EXPENSE", d: "Office rent November", cat: "Office / Rent", cp: "Skyline Properties Ltd", pr: "", dt: "Nov 1", due: "Nov 15", net: 2400, v: 19, tr: "STANDARD", ps: "UNPAID", pm: "Bank account", att: 0 },
    { n: "LED-2026-0408", t: "EXPENSE", s: "POSTED", src: "MANUAL", d: "Train tickets · Globex client workshop", cat: "Travel", cp: "Intercity Rail", pr: "Brand Strategy Sprint", dt: "Oct 30", due: "", net: 86.55, v: 9, tr: "REDUCED", ps: "PAID", pm: "Cash", att: 1 },
    { n: "LED-2026-0407", t: "EXPENSE", s: "POSTED", src: "PAYROLL", d: "Payroll October · Marco Silva", cat: "Employees", cp: "Marco Silva", pr: "", dt: "Oct 31", due: "Oct 31", net: 4800, v: 0, tr: "OUT_OF_SCOPE", ps: "PAID", pm: "Bank account", att: 0 },
    { n: "LED-2026-0406", t: "EXPENSE", s: "PENDING_REVIEW", src: "SUPPLIER_INVOICE_IMPORT", d: "Figma · 12 seats November", cat: "Software", cp: "Figma Inc.", pr: "", dt: "Oct 29", due: "Nov 28", net: 180, v: 0, tr: "REVERSE_CHARGE", ps: "UNPAID", pm: "Company card", att: 1 },
    { n: "LED-2026-0405", t: "INCOME", s: "POSTED", src: "SUBSCRIPTION_SYNC", d: "SUB-221 · Globex support plan November", cat: "Subscriptions", cp: "Globex", pr: "", dt: "Oct 28", due: "Oct 28", net: 1200, v: 19, tr: "STANDARD", ps: "PAID", pm: "Stripe", att: 0 },
    { n: "LED-2026-0404", t: "EXPENSE", s: "POSTED", src: "MANUAL", d: "Bank charges October", cat: "Bank fees", cp: "Eurobank", pr: "", dt: "Oct 31", due: "", net: 38.2, v: 0, tr: "EXEMPT", ps: "PAID", pm: "Bank account", att: 0 },
    { n: "LED-2026-0403", t: "EXPENSE", s: "POSTED", src: "SUPPLIER_INVOICE_IMPORT", d: "Google Ads · October campaign Acme", cat: "Marketing", cp: "Google Ireland Ltd", pr: "Acme Rebrand Website", dt: "Oct 25", due: "Nov 1", net: 1650, v: 0, tr: "REVERSE_CHARGE", ps: "OVERDUE", pm: "Company card", att: 1 },
    { n: "LED-2026-0402", t: "INCOME", s: "POSTED", src: "INVOICE_SYNC", d: "INV-2026-0138 · Initech consulting October", cat: "Consulting", cp: "Initech", pr: "Initech Data Audit", dt: "Oct 16", due: "Oct 30", net: 8200, v: 19, tr: "STANDARD", ps: "OVERDUE", pm: "Bank account", att: 1 },
    { n: "LED-2026-0401", t: "EXPENSE", s: "POSTED", src: "API", d: "Stripe processing fees October", cat: "Payment processing fees", cp: "Stripe Payments Europe", pr: "", dt: "Oct 31", due: "", net: 312.4, v: 0, tr: "EXEMPT", ps: "PAID", pm: "Stripe", att: 0 },
    { n: "LED-2026-0400", t: "EXPENSE", s: "DRAFT", src: "MANUAL", d: "MacBook Pro 14 · Marco Silva", cat: "Equipment / Hardware", cp: "Public", pr: "", dt: "Nov 4", due: "Nov 18", net: 2399, v: 19, tr: "STANDARD", ps: "UNPAID", pm: "Company card", att: 0 },
  ];
  R.forEach((r) => { r.vat = Math.round(r.net * r.v) / 100; r.gross = r.net + r.vat; r.paid = r.paid === undefined ? (r.ps === "PAID" ? r.gross : 0) : r.paid; r.rem = r.gross - r.paid; });
  const sgn = (r, v) => eur(v, r.t === "INCOME" ? "pos" : "");
  const recRow = (r, i) => ["" + cb(i === 0 || i === 3 || i === 6), '<span class="muted">' + r.n + "</span>", r.dt, ty(r.t), ink(r.d) + (r.s === "PENDING_REVIEW" ? " " + I("flag", 12) : ""), r.cat, r.cp, r.pr || muted("—"), eur(r.net), (r.v ? r.v + "% " : "") + muted(U.en(r.tr)), sgn(r, r.gross), st(r.s), ps(r.ps), src(r.src)];

  /* =====================================================================================================================
     OVERVIEW — financial dashboard (spec "Financial Dashboard", "Financial Periods")
     @screen Income & expenses · Overview
     @route  /finance/overview?period=<periodId|custom>&basis=ACCRUAL|CASH&branch=&project=&customer=
     @perm   VIEW finance.income.read OR finance.expenses.read (each card needs its own key: income cards finance.income.read, expense cards finance.expenses.read, profit/net cards need both, payroll card finance.payroll.read*, VAT card
             finance.vat.read) · period selector custom ranges need no extra key · "Generate summary" finance.periods.manage*
     @api    GET /ledger/dashboard?period_id=&from=&to=&basis=&branch_id=&project_id=&company_id= (reads FinancialPeriodSummary for closed periods, computes live for OPEN ones) · POST /ledger/periods/:id/summary
     @mcp    finance_dashboard_read · finance_summary_generate
     @data   FinancialPeriodSummary (total_income, total_expenses, net_profit, gross_income, outstanding_income, paid_income, outstanding_expenses, paid_expenses, vat_collected, vat_paid, net_vat, recurring_expenses,
             payroll_expenses, operating_expenses, income_by_category, expenses_by_category, trend, ai_summary, basis, scope_key, is_final) · FinancialPeriod · LedgerRecord (live totals for the OPEN period) · LedgerInsight (OPEN) ·
             RecurringExpense (next_occurrence_date) · LedgerCategory.is_operating
     @ui     Tabs/ToggleGroup for basis, Select for period (Popover+Command for project/customer/branch), Card, Progress, Recharts (bar/area), Table, Badge, Alert
     @states loading skeleton cards · empty ("No records in this period" + Add expense) · error · no-access (per card hidden, not an error) · stale warning when summary.generated_at is older than the last record change
     @audit  summary generated, period closed
     @note   ACCRUAL = by transaction_date and invoiced amounts; CASH = by settlement date and amounts actually received/paid (LedgerSettlement). The same FinancialPeriodSummary table stores both via the `basis` column.
             Closed periods read stored summaries (is_final), the OPEN period is computed live. Branch/project/customer filters map to scope_key. Net VAT = vat_collected - vat_paid.
     ===================================================================================================================== */
  function overview() {
    const mo = [["Jun", 24.1, 16.9], ["Jul", 27.8, 17.8], ["Aug", 22.4, 18.1], ["Sep", 29.6, 17.4], ["Oct", 33.2, 19.0], ["Nov", 31.8, 18.3]];
    const donut = (a, keys) => { let acc = 0; const cols = ["var(--blue)", "var(--purple)", "var(--yellow)", "var(--green)", "var(--ash)"]; const stops = a.map((v, i) => { const s = acc; acc += v; return cols[i] + " " + s + "% " + acc + "%"; }); return '<div class="ex-split"><div class="ex-donut" style="background:conic-gradient(' + stops.join(",") + ')"></div><div class="keys">' + keys.map((k, i) => '<div><i class="ex-c' + (i + 1) + '"></i>' + k[0] + "<span>" + k[1] + "</span></div>").join("") + "</div></div>"; };
    return '<div class="a-page">' + head("Income & expenses", "The agency ledger · November 2026 (open period)", sel("Nov 2026 · Month", "calendar") + sel("All branches", "building") + btn("Add expense", "plus", "primary")) +
      '<div class="toolbar">' + segs(["Accrual", "Cash"], "Accrual") + '<span class="muted">Accrual = by transaction date and invoiced amounts. Cash = by actual payment date.</span><span style="flex:1"></span>' + sel("Project: all", "folder") + sel("Customer: all", "building") + '</div>' +
      '<div class="mini-stats">' + stat("Total income", "€31,840", "+4.2% vs Oct") + stat("Total expenses", "€18,260", "-3.9% vs Oct") + stat("Net profit", "€13,580", "42.7% margin") + stat("Outstanding income", "€21,430", "6 invoices, 2 overdue", 1) + stat("Outstanding expenses", "€5,120", "4 unpaid") + stat("Net VAT position", "€3,990", "to pay") + "</div>" +
      '<div class="ex-grid4">' + [["Gross income", "€37,890"], ["Paid income", "€16,460"], ["Paid expenses", "€13,140"], ["VAT collected", "€6,050"], ["VAT paid", "€2,060"], ["Recurring expenses", "€4,980"], ["Payroll expenses", "€9,600"], ["Operating expenses", "€12,780"]].map((k) => '<div class="cd"><div class="cd-b" style="padding:10px 14px"><small class="muted">' + k[0] + '</small><div style="font-size:18px;font-weight:600;color:var(--ink)">' + k[1] + "</div></div></div>").join("") + "</div>" +
      '<div class="g2">' + cd("<b>Monthly trend</b><span class='r muted'>FinancialPeriodSummary.trend</span>", '<div class="ex-trend">' + mo.map((m) => '<div class="m"><div class="pair"><i class="in" style="height:' + m[1] * 4 + 'px" title="Income €' + m[1] + 'k"></i><i class="out" style="height:' + m[2] * 4 + 'px" title="Expenses €' + m[2] + 'k"></i></div><small>' + m[0] + "</small></div>").join("") + '</div><div class="ex-legend"><span><i class="in"></i>Income</span><span><i class="out"></i>Expenses</span><span>values in €k</span></div>') +
      cd("<b>Cash flow</b><span class='r muted'>cash basis · LedgerSettlement</span>", '<div class="ex-sum"><div><span>Opening balance (Nov 1)</span>' + eur0(41200) + "</div><div><span>Received from customers</span>" + eur0(16460, "pos") + "</div><div><span>Paid to suppliers and payroll</span>" + eur0(13140, "neg") + '</div><div><span>VAT paid to authority</span>' + eur0(2120, "neg") + '</div><div class="tot"><span>Net cash movement</span>' + eur0(1200, "pos") + "</div></div>" + '<div class="rowx"><div class="grow"><b>Cash position</b><small>LedgerPaymentMethod · track_balance, opening_balance, opening_date + settlements; confirmed by LedgerBalanceSnapshot</small></div></div><div class="rowx"><div class="grow"><b>Business account · IBAN …4821</b><small>Confirmed from statement Nov 1</small></div>' + eur0(38400) + '</div><div class="rowx"><div class="grow"><b>Stripe EU balance</b><small>Payout po_1Qy… due Nov 13</small></div>' + eur0(3800) + '</div>') + "</div>" +
      '<div class="g2">' + cd("<b>Income by category</b><span class='r muted'>income_by_category</span>", donut([38, 24, 18, 12, 8], [["Software development", "€12,100"], ["Consulting", "€7,640"], ["Maintenance", "€5,730"], ["Subscriptions", "€3,820"], ["Other income", "€2,550"]])) +
      cd("<b>Expenses by category</b><span class='r muted'>expenses_by_category</span>", donut([53, 12, 14, 11, 10], [["Employees", "€9,600"], ["Office", "€2,190"], ["Software", "€2,560"], ["Hosting", "€2,010"], ["Other", "€1,900"]])) + "</div>" +
      '<div class="g3">' + cd("<b>Needs attention</b>", '<div class="rowx"><div class="grow"><b>2 overdue receivables</b><small>€11,860 · Initech, Acme Corp</small></div>' + btn("View", "", "sm") + '</div><div class="rowx"><div class="grow"><b>3 records pending approval</b><small>Over the €1,000 threshold</small></div>' + btn("Review", "", "sm") + '</div><div class="rowx"><div class="grow"><b>2 supplier invoices to review</b><small>Extraction finished</small></div>' + btn("Open", "", "sm") + "</div>", 1) +
      cd("<b>Upcoming expenses</b><span class='r muted'>RecurringExpense · next 14 days</span>", [["Office rent", "Nov 15", 2400], ["Figma seats", "Nov 28", 180], ["Hetzner hosting", "Dec 1", 842.5], ["Accounting fees", "Dec 3", 450]].map((r) => '<div class="rowx"><div class="grow"><b>' + r[0] + "</b><small>" + r[1] + "</small></div>" + eur(r[2]) + "</div>").join(""), 1) +
      cd("<b>AI summary</b><span class='r muted'>ai_summary · LedgerInsight</span>", "<p>Income is up 4.2% on October, driven by the Acme milestone invoice. Marketing spend is 38% above its 6-month average (Google Ads for Acme). Two receivables are overdue: €11,860.</p>" + '<div class="rowx" style="padding:0">' + btn("Ask about your numbers", "sparkles", "sm") + btn("All insights", "", "sm ghost") + "</div>") + "</div>" +
      dm(["FinancialPeriodSummary · basis, scope_key, total_income, total_expenses, net_profit, gross_income, outstanding_income, paid_income, outstanding_expenses, paid_expenses, vat_collected, vat_paid, net_vat, recurring_expenses, payroll_expenses, operating_expenses, income_by_category, expenses_by_category, trend, ai_summary, is_final", "FinancialPeriod · type, start_date, end_date, status", "LedgerCategory · is_operating, pl_line · RecurringExpense · next_occurrence_date · LedgerInsight · status OPEN", "LedgerSettlement (cash basis) · LedgerRecord (live totals)", "LedgerPaymentMethod · track_balance, currency, iban_last4, opening_balance, opening_date · LedgerBalanceSnapshot · payment_method_id, as_of, balance, currency, source"], []) + "</div>";
  }

  /* =====================================================================================================================
     LEDGER — income and expense records list (spec "Financial Records", "Search & Filtering", "Income Management", "Expense Management")
     @screen Ledger records
     @route  /finance/ledger?type=&status=&view=<savedViewId>&filter=<json>&sort=&group=&q=
     @perm   VIEW finance.income.read for INCOME rows and finance.expenses.read for EXPENSE rows (a caller with one key sees only that type) · create finance.income.create / finance.expenses.create · bulk edit .update ·
             approve finance.expenses.approve* · archive .archive · delete .delete* · export finance.income.export* / finance.expenses.export*
     @api    GET /ledger/records?filter=&sort=&group=&q=&cursor= · POST /ledger/records/bulk {record_ids|filter, patch|action} · GET/POST/PATCH /saved-views?entity_type=FINANCIAL_RECORD · GET /ledger/records/export?format=csv|xlsx
     @mcp    finance_records_read (same filter JSON) · finance_records_update · finance_records_export
     @data   LedgerRecord (number, type, status, source, is_manual, category_id, subcategory_id, description, reference_number, transaction_date, due_date, payment_date, net_amount, vat_percent, vat_amount, gross_amount,
             vat_treatment, payment_status, payment_method_id, amount_paid, amount_remaining, company_id, counterparty_name, project_id, invoice_id, subscription_id, employee_id, department_id, recurring_expense_id) ·
             LedgerCategory · LedgerPaymentMethod · SavedView (entity_type FINANCIAL_RECORD, platform table 02)
     @ui     Table with column chooser, filter bar (Popover+Command value pickers, multi-select), amount-range Slider/inputs, DateRangePicker, ToggleGroup for type, sticky bulk bar, DropdownMenu row actions, "Save view" Dialog
     @states loading skeleton rows · empty ("No records match" + clear filters) · error · no-access · partial results warning when a filter hits a field the caller cannot see (e.g. employee on payroll)
     @audit  bulk actions write one audit event per record plus a summary event with the filter used; exports write ledger.export (sensitive)
     @note   Filters (spec): Income/Expense, category, subcategory, customer/supplier, employee, project, date, payment status, VAT percentage, VAT status (vat_treatment), payment method, amount range, recurring / one-time
             (recurring_expense_id is null?), manual / imported (is_manual + source), invoice availability (has LedgerAttachment or invoice_id). "Select all" selects by FILTER, the API re-evaluates it. Bulk: change category,
             set project, set payment method, mark paid (creates settlements), submit for review, approve*, void, archive, export. Voided and archived rows are hidden unless the status filter includes them.
             Totals row = sums of the FILTERED set (server side), not of the loaded page.
     ===================================================================================================================== */
  function ledger() {
    return '<div class="a-page">' + head("Ledger", "Every income and expense record of the agency.", btn("Export", "file") + btn("Upload supplier invoice", "clip") + btn("Add expense", "plus", "primary")) +
      '<div class="toolbar">' + search("Search description, number, reference, supplier") + segs(["All", "Income", "Expense"], "All") + sel("Table", "grid") + sel("Group: None") + sel("Sort: Date ↓", "sort") + sel("Columns (14)", "settings") + sel("Views: Overdue receivables", "star") + "</div>" +
      filterBar([["Period", "is", "Oct 1 – Nov 11"], ["Payment status", "is any of", "Unpaid, Partially paid, Overdue"], ["Category", "is any of", "Marketing, Hosting, Software"], ["VAT status", "is not", "Out of scope"], ["Amount", "between", "€100 – €10,000"], ["Origin", "is", "Imported"]], btn("Clear", "", "sm ghost") + btn("Save view", "plus", "sm")) +
      '<div class="toolbar" style="margin-top:-4px">' + sel("Customer / supplier…", "building") + sel("Subcategory…") + sel("Project…", "folder") + sel("Employee…", "users") + sel("Payment method…", "dollar") + sel("VAT %…") + sel("Recurring / one-time") + sel("Manual / imported") + sel("Invoice attached", "clip") + "</div>" +
      '<div class="bulk"><span class="cb on"></span><b>3 selected</b><span class="muted">€2,718.14 gross · selection is by filter, not by page</span><span style="flex:1"></span>' + sel("Category…", "tag") + sel("Project…", "folder") + sel("Payment method…") + btn("Mark paid", "check", "sm") + btn("Submit for review", "send", "sm") + btn("Approve", "shield", "sm") + btn("Void", "x", "sm") + "</div>" +
      tbl(["", "Number", "Date", "Type", "Description", "Category", "Customer / supplier", "Project", ">Net", "VAT", ">Gross", "Status", "Payment", "Source"], R.map(recRow), 1) +
      '<div class="panel" style="margin-top:8px"><table><tbody><tr><td><b>Totals of 142 filtered records</b></td><td class="num">Net ' + eur(24850.4) + '</td><td class="num">VAT ' + eur(3871.2) + '</td><td class="num">Gross ' + eur(28721.6) + '</td><td class="num">Paid ' + eur(15940) + '</td><td class="num">Remaining ' + eur(12781.6, "neg") + "</td></tr></tbody></table></div>" +
      '<div class="pager"><span class="muted">1–13 of 142</span><span style="flex:1"></span>' + btn("Previous", "", "sm") + btn("Next", "", "sm") + "</div>" +
      dm(["LedgerRecord · all columns above are selectable, sortable and filterable (see @data)", "LedgerCategory · name, parent_category_id · LedgerPaymentMethod · name, type · CrmCompany (customer/supplier) · Project", "SavedView · entity_type FINANCIAL_RECORD, layout, visibility, filters, sorting, grouping, columns (RecordEntityType also has LEDGER_INVOICE_IMPORT, EXPENSE_CLAIM, LEDGER_BUDGET, VAT_RETURN for notes, tags and views)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CREATE RECORD — full page (spec "Financial Records", "Manual Financial Entries", "Expense Management", "VAT Management", "Attachments & Documentation")
     @screen New expense (also New income)
     @route  /finance/ledger/new?type=EXPENSE|INCOME&project=&company=&from=<recurring|import>:<id>&duplicate=<recordId>
     @perm   finance.expenses.create (type EXPENSE) / finance.income.create (type INCOME) · amounts override (amounts_overridden) finance.expenses.update / finance.income.update · POSTING directly needs the approve key
             finance.expenses.approve* when the amount is over the threshold, otherwise create posts · choosing an employee needs finance.payroll.read* · uploading the receipt needs documents.documents.create (17)
     @api    POST /ledger/records {type, status, category_id, subcategory_id, description, reference_number, transaction_date, due_date, payment_date, currency, fx_rate, net_amount, vat_percent, vat_amount, gross_amount, tax_rate_id,
             vat_treatment, pricing_mode, amounts_overridden, payment_status, payment_method_id, amount_paid, company_id, counterparty_name, project_id, milestone_id, contract_id, invoice_id, subscription_id, employee_id,
             department_id, branch_id, notes, line_items[], attachments[{document_id, kind}], recurrence?{...RecurringExpense}} · POST /documents (17) for the receipt file · POST /ledger/records/:id/submit
     @mcp    finance_records_create (sensitive: human confirmation when called by an AI agent)
     @data   LedgerRecord (every column written on create; source MANUAL, is_manual true) · LedgerAttachment (kind RECEIPT | INVOICE | ..., is_original) · Document (17) · RecurringExpense (when "Repeat" is on) ·
             LedgerCategory.default_tax_rate_id/default_vat_treatment (defaults) · LedgerSupplierProfile (supplier defaults) · LedgerSettings (default_pricing_mode, approval_threshold_amount, default_expense_tax_rate_id) · FinancialPeriod
     @ui     Form with sections: shadcn Select / Popover+Command (category tree, supplier, project, employee) / DatePicker / Input type number / Textarea / file Dropzone (17) / Switch / Tabs for line items, sticky action bar
     @states validation errors inline (net, date, category are required) · saving · saved toast with the new LED number and Undo · closed/locked period error ("Nov 2026 is closed") · duplicate warning (same supplier + reference_number + gross) ·
             field disabled with reason when the caller lacks the key · draft restored from local storage
     @audit  ledger.record.created (with source, amounts), attachment added, submitted for review
     @note   VAT auto-calculation: typing NET (EXCLUSIVE) derives VAT and gross; typing GROSS (INCLUSIVE) derives net and VAT; vat_percent defaults from the category's default_tax_rate, then the supplier profile, then LedgerSettings.
             Rounding is per record (2 decimals). Changing the VAT amount by hand by an authorized user sets amounts_overridden = true and shows a badge. period_id is resolved from transaction_date (error if the period is CLOSED/LOCKED).
             Receipt upload: "Attach only" stores a LedgerAttachment (RECEIPT); "Read with AI" instead creates a LedgerInvoiceImport (review screen) and returns here with the extracted values prefilled. Category suggestion from
             LedgerSupplierProfile.default_category and ai_suggestions (only if LedgerSettings.ai_enabled). A foreign currency asks for fx_rate and shows reporting_gross_amount. "Repeat" creates a RecurringExpense and links
             the first record (recurring_expense_id, recurrence_sequence 1).
     ===================================================================================================================== */
  function create() {
    return '<div class="a-page">' + head("New expense", "Manual record · source Manual. The number LED-2026-0413 is assigned when you save.", btn("Cancel") + btn("Save draft") + btn("Submit for review", "send") + btn("Save and post", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.7fr 1fr;align-items:start"><div>' +
      cd("<b>What was it</b>", f("Type", segs(["Expense", "Income"], "Expense"), "Customer invoices are issued in Billing (08) and arrive here automatically; use Income only for money that has no invoice.") + f("Description", val("Google Ads · November campaign Acme")) +
        row2(f("Category", sel("Marketing", "tag"), "Tree of LedgerCategory (kind EXPENSE). Default VAT 0% reverse charge applied."), f("Subcategory", sel("Advertising"))) +
        row2(f("Supplier", sel("Google Ireland Ltd", "building"), "CRM company of type VENDOR (02). Or type a free name (counterparty_name)."), f("Reference number", val("INV-8841-2026"), "Supplier's own invoice number. Duplicate check runs on supplier + reference + gross."))) +
      sp() +
      cd("<b>Amounts & VAT</b><span class='r muted'>gross = net + VAT</span>", row2(f("Pricing", segs(["Exclusive of VAT", "Inclusive of VAT"], "Exclusive of VAT"), "pricing_mode EXCLUSIVE / INCLUSIVE. Default from LedgerSettings."), f("Currency", sel("EUR · reporting currency", "dollar"), "Another currency asks for the exchange rate (fx_rate).")) +
        row2(f("Net amount", val("1,650.00")), f("VAT rate", sel("Reverse charge 0% (tax rate)", "tag"), "LedgerRecord.tax_rate_id from the 08 tax rates, plus custom ones.")) +
        row2(f("VAT treatment", sel("Reverse charge")), f("VAT amount", val("0.00") + '<div class="sub-note"><span class="badge">auto</span> Edit to override. An override is flagged (amounts_overridden) and audited.</div>')) +
        f("Gross amount", val("1,650.00")) +
        '<div class="ex-sum"><div><span>Net</span>' + eur(1650) + "</div><div><span>VAT 0%</span>" + eur(0) + '</div><div class="tot"><span>Gross total</span>' + eur(1650) + "</div><div><span>In EUR (reporting)</span>" + eur(1650) + "</div></div>") +
      sp() +
      cd("<b>Dates & payment</b>", row2(f("Transaction date", sel("Nov 4, 2026", "calendar"), "Decides the financial period (Nov 2026 · open)."), f("Due date", sel("Nov 18, 2026", "calendar"))) +
        row2(f("Payment status", sel("Unpaid"), "UNPAID, PARTIALLY_PAID, PAID, OVERDUE (set by the system), CANCELLED, REFUNDED. Paid creates a settlement."), f("Payment method", sel("Company card", "dollar"), "LedgerPaymentMethod, managed in Categories & methods.")) +
        row2(f("Amount paid", val("0.00")), f("Payment date", sel("—", "calendar"))) + f("Payment reference", box("Bank reference or transaction id"), "Stored on the settlement (LedgerSettlement.reference).")) +
      sp() +
      cd("<b>Line items</b><span class='r'>" + btn("Add line", "plus", "sm") + "</span>", tbl(["Description", ">Qty", ">Unit price", ">VAT %", ">Net"], [["Search campaign · Acme launch", "1", eur(1200), "0%", eur(1200)], ["Display remarketing", "1", eur(450), "0%", eur(450)]]) + '<div class="sub-note">Optional. Stored as LedgerRecord.line_items (Json); the net total must equal the net amount.</div>', 1) +
      sp() +
      cd("<b>Notes</b>", '<div class="editor"><div class="ed-bar">' + ["B", "I", "•", "Link", "@"].map((x) => "<span>" + x + "</span>").join("") + '</div><div class="ed-body">Internal note (CrmNote on the record). Not visible to customers.</div></div>') +
      "</div><div>" +
      cd("<b>Receipt or invoice</b>", '<div class="drop">' + I("clip", 16) + " Drop a PDF or photo, or choose from Documents (17)</div>" +
        '<div class="rowx"><div class="grow"><b>google-ads-oct-2026.pdf</b><small>312 KB · uploaded now</small></div>' + sel("Invoice") + more + '</div>' +
        '<div class="rowx"><div class="grow"><b>Mark as original</b><small>The supplier invoice kept for audit (is_original)</small></div>' + sw(1) + '</div>' +
        '<div class="rowx" style="padding:0">' + btn("Read with AI", "sparkles", "sm") + btn("Attach only", "clip", "sm") + '</div><div class="sub-note">AI reading opens the invoice review; kinds: invoice, receipt, payment confirmation, contract, expense documentation, other.</div>') +
      sp() +
      cd("<b>Allocation</b>", f("Project", sel("Acme Rebrand Website", "folder"), "Direct project expense, feeds project profitability.") + f("Milestone", sel("—", "flag")) + f("Customer", sel("Acme Corp", "building"), "Customer the cost is re-billable to (company_id).") + f("Contract", sel("—", "file")) + f("Department", sel("Marketing", "users")) + f("Branch", sel("Athens HQ", "building")) + f("Employee", sel("—", "users"), "Only for employee expenses (needs payroll access).") +
        f("Related invoice / subscription", sel("—", "link"), "Customer invoice (08) or subscription this cost belongs to.")) +
      sp() +
      cd("<b>Repeat</b>", '<div class="rowx"><div class="grow"><b>Make this a recurring expense</b><small>Creates a RecurringExpense template and links this record</small></div>' + sw(0) + '</div>' + f("Interval", row2(sel("Month"), val("1")), "BillingInterval DAY, WEEK, MONTH, QUARTER, YEAR + interval_count.") + f("Ends", sel("Never"))) +
      sp() +
      callout("shield", "<b>Approval</b> Amounts above <b>€1,000</b> go to review before posting (LedgerSettings.approval_threshold_amount). You cannot approve your own record.", "warn") +
      sp() + '<div class="rowx"><div class="grow"><b>Create another</b><small>Keep supplier, category and project</small></div>' + sw(0) + "</div>" +
      "</div></div>" +
      dm(["LedgerRecord · every column written on create (source MANUAL, is_manual)", "LedgerAttachment · document_id, kind, is_original · Document (17)", "RecurringExpense · when Repeat is on", "LedgerCategory · default_tax_rate_id, default_vat_treatment · LedgerSupplierProfile · LedgerSettings · FinancialPeriod · TaxRate (08) · CrmNote (platform, entity_type FINANCIAL_RECORD)"], []) + "</div>";
  }

  /* =====================================================================================================================
     RECORD DETAIL (spec "Financial Records", "Payment & Settlement Tracking", "Attachments & Documentation", "Audit Trail")
     @screen Ledger record
     @route  /finance/ledger/:recordId?tab=overview|payments|documents|allocation|history   (number e.g. LED-2026-0403 resolves to the id)
     @perm   VIEW finance.expenses.read (EXPENSE) / finance.income.read (INCOME) · edit .update (amounts of synced income stay read-only) · record payment/refund .update · submit for review .create · approve finance.expenses.approve* ·
             void/archive .archive · delete .delete* · documents tab needs documents.documents.read on each file (17) · employee name needs finance.payroll.read*
     @api    GET /ledger/records/:id · PATCH /ledger/records/:id · POST /ledger/records/:id/settlements {kind, amount, settled_on, payment_method_id, reference, document_id, notes} · POST /ledger/records/:id/attachments {document_id, kind, is_original} ·
             POST /ledger/records/:id/approve | /void {reason} | /submit · GET /audit-events?entity_type=LEDGER_RECORD&entity_id=
     @mcp    finance_records_read · finance_records_update · finance_settlements_create · finance_records_approve (sensitive)
     @data   LedgerRecord (all) · LedgerSettlement (kind, amount, currency, settled_on, payment_method_id, reference, payment_id, refund_id, document_id, notes, recorded_by_membership_id) · LedgerAttachment (document_id, kind, is_original, title) ·
             LedgerInvoiceImport (origin, via ledger_record_id) · AuditEvent (01) · FinancialPeriod · Read-only: Invoice/Payment/Refund/Subscription (08), Project/ProjectMilestone (05), Contract (04), CrmCompany (02), Team/Branch (01)
     @ui     Header with status Badges + action DropdownMenu, Tabs, Card, Table, Dialog (record payment, void with reason), Timeline, file Dropzone
     @states loading · not found · error · no-access · "period closed" banner (edits disabled, adjustment path offered) · voided banner with reason
     @audit  ledger.record.updated (old/new per field), .approved, .voided, .settlement.created, .attachment.added, .submitted
     @note   payment_status is derived from settlements: sum(PAYMENT) - sum(REFUND, WRITE_OFF) vs gross. UNPAID when 0 paid, PARTIALLY_PAID, PAID when remaining is 0, OVERDUE is set by the daily job when due_date passed and remaining > 0,
             REFUNDED after a full REFUND. Several settlements per record are allowed (instalments, partial refunds). For income synced from 08 the settlements mirror 08 payments/refunds (payment_id/refund_id) and are read-only.
             A record in a CLOSED/LOCKED period cannot be edited; the fix is an ADJUSTMENT settlement or a new record. The original supplier invoice (is_original) cannot be removed, only replaced with a reason.
     ===================================================================================================================== */
  function detail() {
    const r = R[9];
    return '<div class="a-page">' +
      '<div class="a-head"><div><h1>' + r.d + "</h1><p>" + r.n + " · created by Anna Meyer Oct 26 · " + ty(r.t) + " " + st(r.s) + " " + ps(r.ps) + " " + E("SUPPLIER_INVOICE_IMPORT") + '</p></div><div class="acts">' + btn("Record payment", "dollar") + btn("Duplicate", "layers") + btn("Void", "x") + btn("Edit", "edit", "primary") + "</div></div>" +
      callout("flag", "<b>Overdue</b> due date Nov 1 passed 10 days ago. €1,650.00 is still unpaid. The reminder to administrators was sent Nov 2 (automation).", "warn") + sp(8) +
      '<div class="tabset">' + tabs([["o", "Overview"], ["p", "Payments", 1], ["d", "Documents", 2], ["a", "Allocation"], ["h", "History"]], "o") +
      pane("o", 1, '<div class="g2" style="grid-template-columns:1.4fr 1fr;align-items:start"><div>' +
        cd("<b>Amounts</b><span class='r muted'>pricing_mode EXCLUSIVE</span>", '<div class="ex-sum"><div><span>Net amount</span>' + eur(r.net) + "</div><div><span>VAT 0% · Reverse charge</span>" + eur(0) + '</div><div class="tot"><span>Gross amount</span>' + eur(r.gross) + "</div><div><span>Amount paid</span>" + eur(0) + '</div><div><span>Remaining balance</span>' + eur(r.gross, "neg") + "</div><div><span>Reporting gross (EUR)</span>" + eur(r.gross) + "</div></div>") + sp() +
        cd("<b>Line items</b>", tbl(["Description", ">Qty", ">Unit price", ">Net"], [["Search campaign · Acme launch", "1", eur(1200), eur(1200)], ["Display remarketing", "1", eur(450), eur(450)]]), 1) + sp() +
        cd("<b>Notes</b><span class='r muted'>CrmNote</span>", '<div class="tl"><div class="ev"><b>Anna Meyer</b><small>Oct 26 · Campaign approved by Acme in writing, re-bill at cost + 10%.</small></div></div>') +
        "</div><div>" + cd("<b>Properties</b>", prop("Number", r.n) + prop("Reference number", "GA-INV-88213") + prop("Category", "Marketing / Advertising") + prop("Category path (snapshot)", "Expenses / Marketing / Advertising") + prop("Supplier", "Google Ireland Ltd " + muted("(02)")) + prop("Transaction date", r.dt) + prop("Due date", r.due) + prop("Payment date", "—") + prop("Payment method", "Company card") + prop("VAT treatment", E("REVERSE_CHARGE")) + prop("Amounts overridden", "No") + prop("Financial period", "Oct 2026 · " + E("OPEN", "green")) + prop("Source", E("SUPPLIER_INVOICE_IMPORT") + " " + muted("is_manual false")) + prop("Flagged unusual", bd("Yes", "yellow") + " " + muted("38% above average"))) + "</div></div>") +
      pane("p", 0, tbl(["Date", "Kind", ">Amount", "Method", "Reference", "Recorded by", "Document", ""], [["—", muted("No settlements yet"), "", "", "", "", "", ""]]) + '<div class="sub-note" style="margin:8px 0">Example of a paid record: PAYMENT €1,000.00 Nov 3 · Bank transfer · ref SEPA-8841 · then PAYMENT €650.00 Nov 9 → PARTIALLY_PAID then PAID. A REFUND, WRITE_OFF or ADJUSTMENT row uses the same table.</div>' +
        cd("<b>Record a settlement</b>", row2(f("Kind", sel("Payment")), f("Amount", val("1,650.00") + '<div class="sub-note">Remaining 1,650.00</div>')) + row2(f("Settled on", sel("Nov 11, 2026", "calendar")), f("Payment method", sel("Company card", "dollar"))) + f("Reference", box("Bank reference")) + f("Confirmation document", sel("Attach from Documents", "clip")) + '<div class="rowx" style="padding:0">' + btn("Record payment", "check", "primary") + "</div>")) +
      pane("d", 0, tbl(["File", "Kind", "Original", "Added by", "Added", ""], [[ink("google-ads-invoice-oct.pdf"), E("INVOICE"), bd("Yes", "green"), wh("AM"), "Oct 26", more], [ink("campaign-approval-acme.pdf"), E("EXPENSE_DOCUMENTATION"), "—", wh("AM"), "Oct 26", more]]) + '<div class="drop" style="margin-top:10px">' + I("clip", 16) + " Add document (17)</div>") +
      pane("a", 0, cd("<b>Allocation</b>", prop("Project", "Acme Rebrand Website " + muted("(05)")) + prop("Milestone", "Launch · Nov 28") + prop("Customer", "Acme Corp " + muted("(02)")) + prop("Contract", "MSA-2026-004 " + muted("(04)")) + prop("Department", "Marketing " + muted("(01 Team)")) + prop("Branch", "Athens HQ") + prop("Employee", "—") + prop("Related invoice", "INV-2026-0142 " + muted("re-bill (08)")) + prop("Recurring template", "—"))) +
      pane("h", 0, cd("<b>History</b><span class='r muted'>audit_events</span>", '<div class="tl"><div class="ev"><b>Marked unusual by AI</b><small>Nov 2 · LedgerInsight UNUSUAL_EXPENSE</small></div><div class="ev"><b>Payment status changed UNPAID → OVERDUE</b><small>System · Nov 2</small></div><div class="ev"><b>Posted</b><small>Marco Silva approved · Oct 27 · over threshold</small></div><div class="ev"><b>Submitted for review</b><small>Anna Meyer · Oct 26</small></div><div class="ev"><b>Created from supplier invoice import</b><small>Anna Meyer · Oct 26 · google-ads-invoice-oct.pdf</small></div></div>')) + "</div>" +
      dm(["LedgerRecord · all columns (see @data) · LedgerSettlement · LedgerAttachment · LedgerInvoiceImport", "AuditEvent (01) · FinancialPeriod · LedgerInsight", "Read-only: Invoice, Payment, Refund, Subscription (08) · Project, ProjectMilestone (05) · Contract (04) · CrmCompany (02) · Team, Branch (01)"], []) + "</div>";
  }

  /* =====================================================================================================================
     SUPPLIER INVOICE INTAKE — list (spec "Invoice Upload & Automatic Processing", "Automation")
     @screen Invoice imports
     @route  /finance/imports?status=&q=
     @perm   VIEW finance.invoice_imports.review · upload finance.invoice_imports.review + documents.documents.create (17) · approve into a record needs finance.expenses.create (EXPENSE) / finance.income.create (INCOME)
     @api    GET /ledger/imports?status=&q= · POST /ledger/imports (multipart or {document_id}, record_type) · POST /ledger/imports/:id/retry · DELETE /ledger/imports/:id (UPLOADED/FAILED only)
     @mcp    finance_invoice_imports_review (list/read) · finance_invoice_imports_upload
     @data   LedgerInvoiceImport (document_id, file_name, file_hash, status, record_type, uploaded_by_membership_id, extraction_provider, confidence, supplier_name, invoice_number, invoice_date, due_date, gross_amount, currency, matched_company_id,
             suggested_category_id, ledger_record_id, duplicate_of_record_id, duplicate_of_import_id, reviewed_by_membership_id, reviewed_at, error, processing_started_at, processed_at) · Document (17)
     @ui     Table, multi-file Dropzone, Badge, Progress for PROCESSING, DropdownMenu (retry, discard), Tabs per status
     @states loading · empty ("Upload a supplier invoice or receipt to start") · error per row (FAILED with error text and Retry) · no-access
     @audit  import uploaded, extraction finished/failed, approved (links ledger_record_id), rejected, duplicate detected
     @note   Statuses: UPLOADED (queued) -> PROCESSING (OCR/AI running, extraction_provider) -> PENDING_REVIEW (human verification) -> APPROVED (record created) | REJECTED | DUPLICATE | FAILED. Customer invoices issued by 08 are never uploaded.
             Duplicate detection uses file_hash (same file) and supplier + invoice_number + gross (same invoice) and sets duplicate_of_import_id / duplicate_of_record_id. Extraction uses the organization's own OpenAI key (BYOK,
             IntegrationConnection provider OPENAI); without it the upload still works and the user types the values in the review screen (ai_enabled off).
     ===================================================================================================================== */
  function imports() {
    const rows = [
      ["hetzner-invoice-1049.pdf", "PENDING_REVIEW", "Hetzner Online GmbH", "R-1049-2026", 842.5, 98, "Anna Meyer", "Nov 10", "—"],
      ["figma-receipt-nov.pdf", "PENDING_REVIEW", "Figma Inc.", "FIG-770291", 180, 91, "Anna Meyer", "Nov 10", "—"],
      ["aws-invoice-oct.pdf", "PROCESSING", "—", "—", "", "", "Marco Silva", "Nov 11", "—"],
      ["scan-0012.jpg", "FAILED", "—", "—", "", "", "Kim Lund", "Nov 9", "Could not read the image: too blurry"],
      ["google-ads-invoice-oct.pdf", "APPROVED", "Google Ireland Ltd", "GA-INV-88213", 1650, 96, "Anna Meyer", "Oct 26", "LED-2026-0403"],
      ["google-ads-invoice-oct-copy.pdf", "DUPLICATE", "Google Ireland Ltd", "GA-INV-88213", 1650, 96, "Kim Lund", "Oct 28", "same as LED-2026-0403"],
      ["office-supplies-receipt.png", "REJECTED", "Staples Hellas", "—", 46.8, 62, "Kim Lund", "Oct 22", "Personal purchase"],
      ["vodafone-bill-oct.pdf", "UPLOADED", "—", "—", "", "", "Sofia Jensen", "Nov 11", "—"],
    ];
    const IC = { PENDING_REVIEW: "yellow", APPROVED: "green", REJECTED: "", DUPLICATE: "purple", FAILED: "red", PROCESSING: "blue", UPLOADED: "" };
    const conf = (c) => c === "" ? "—" : '<span class="ex-conf ' + (c >= 90 ? "hi" : c >= 75 ? "mid" : "lo") + '">' + c + "%</span>";
    return '<div class="a-page">' + head("Invoice imports", "Supplier invoices and receipts read by AI, verified by a person.", btn("Upload invoice or receipt", "clip", "primary")) +
      '<div class="drop">' + I("clip", 16) + " Drop supplier invoices, receipts or bills here (PDF, JPG, PNG). Customer invoices from Billing are linked automatically and are not uploaded.</div>" +
      '<div class="mini-stats">' + stat("To review", 2, "extraction ready") + stat("Processing", 1, "queued 1") + stat("Failed", 1, "retry or enter by hand", 1) + stat("Duplicates caught", 1, "this month") + stat("Auto-approved rate", "0%", "approval is always manual") + "</div>" +
      '<div class="tabset">' + tabs([["a", "All", 8], ["r", "To review", 2], ["f", "Failed", 1], ["d", "Duplicates", 1]], "a") +
      '<div class="toolbar" style="margin-top:10px">' + search("Search file, supplier, invoice number") + sel("Type: Expense", "tag") + sel("Uploaded by…", "users") + sel("Status…") + "</div>" +
      pane("a", 1, tbl(["", "File", "Status", "Supplier", "Invoice no.", ">Gross", "Confidence", "Uploaded by", "Uploaded", "Result", ""], rows.map((r, i) => [cb(0), ink(r[0]), E(r[1], IC[r[1]]) + (r[1] === "PROCESSING" ? ' <span class="bar"><i style="width:55%"></i></span>' : ""), r[2], r[3], r[4] === "" ? "—" : eur(r[4]), conf(r[5]), r[6], r[7], r[1] === "FAILED" ? '<span class="neg">' + r[8] + "</span>" : r[8], r[1] === "PENDING_REVIEW" ? btn("Review", "", "sm primary") : r[1] === "FAILED" ? btn("Retry", "", "sm") : more])), 1) + "</div>" +
      dm(["LedgerInvoiceImport · file_name, file_hash, status, record_type, extraction_provider, confidence, supplier_name, invoice_number, gross_amount, matched_company_id, suggested_category_id, ledger_record_id, duplicate_of_record_id, duplicate_of_import_id, uploaded_by_membership_id, reviewed_at, error", "Document (17) · CrmCompany (matched supplier)"], []) + "</div>";
  }

  /* =====================================================================================================================
     SUPPLIER INVOICE REVIEW (spec "Invoice Upload & Automatic Processing")
     @screen Review extracted invoice
     @route  /finance/imports/:importId
     @perm   finance.invoice_imports.review · approving creates the record: finance.expenses.create / finance.income.create · over the approval threshold the new record goes to PENDING_REVIEW instead of POSTED
     @api    GET /ledger/imports/:id · PATCH /ledger/imports/:id {fields, lines[]} · POST /ledger/imports/:id/approve {category_id, project_id?, ...overrides} -> LedgerRecord · POST /ledger/imports/:id/reject {review_notes} · POST /ledger/imports/:id/mark-duplicate
     @mcp    finance_invoice_imports_review (read, approve, reject; approve is sensitive: human confirmation for agents)
     @data   LedgerInvoiceImport (all extracted columns, field_confidence Json, extraction_raw Json, payment_info Json, review_notes) · LedgerInvoiceImportLine (description, quantity, unit_price, net_amount, vat_percent, vat_amount, gross_amount,
             confidence, sort_order) · LedgerSupplierProfile (defaults) · LedgerCategory · CrmCompany (matched_company_id) · Document (17, preview) · LedgerRecord (result) · LedgerAttachment (is_original = true)
     @ui     Two panes: document viewer (17) left, form right with Input / Popover+Command (supplier, category) / DatePicker, per-field confidence Badge, Table for line items, Alert for duplicates, sticky action bar
     @states loading · processing (skeleton + "Reading the document") · failed (error + manual entry) · already approved (read-only with a link to the record) · no-access
     @audit  import.edited, import.approved (record id), import.rejected (notes), import.marked_duplicate
     @note   Every extracted value is editable; fields under 80% confidence are highlighted for attention. Approve = create a LedgerRecord (source SUPPLIER_INVOICE_IMPORT) + attach the original document (kind INVOICE, is_original true) +
             remember the supplier mapping (LedgerSupplierProfile.matching_aliases, default category) when auto_categorize_suppliers is on. If the net + VAT does not equal the gross the form blocks approval with the difference shown.
     ===================================================================================================================== */
  function importReview() {
    return '<div class="a-page">' + head("Review · hetzner-invoice-1049.pdf", "Extraction finished Nov 10 · provider OpenAI (your key) · overall confidence 98%", btn("Reject", "x") + btn("Mark duplicate", "layers") + btn("Approve and create record", "check", "primary")) +
      callout("check", "No duplicate found for this file hash or for Hetzner Online GmbH + R-1049-2026 + €842.50.", "") + sp(8) +
      '<div class="g2" style="grid-template-columns:1fr 1.15fr;align-items:start"><div>' +
      cd("<b>Original document</b><span class='r muted'>Document (17)</span>", '<div class="ex-receipt"><div class="hd"><span>Hetzner Online GmbH</span><span>Rechnung</span></div><div class="ln"><span>Invoice no.</span><span class="hl">R-1049-2026</span></div><div class="ln"><span>Date</span><span class="hl">Nov 1, 2026</span></div><div class="ln"><span>Due</span><span class="hl">Nov 15, 2026</span></div><div class="ln"><span>Cloud server CX42 × 3 (Oct)</span><span>€630.00</span></div><div class="ln"><span>Backup storage 2 TB</span><span>€152.50</span></div><div class="ln"><span>Domains .eu × 4</span><span>€60.00</span></div><div class="ln"><span>Net</span><span class="hl">€842.50</span></div><div class="ln"><span>VAT 0% (reverse charge, §13b)</span><span class="hl">€0.00</span></div><div class="ln"><b>Total</b><b class="hl">€842.50</b></div><div class="sub-note">DE 812871812 · IBAN DE89 3704 0044 0532 0130 00</div></div><div class="rowx" style="padding:8px 0 0"><div class="grow muted">Page 1 of 1</div>' + btn("Open in Documents", "file", "sm") + "</div>") + "</div><div>" +
      cd("<b>Extracted values</b><span class='r muted'>every field is editable</span>", row2(f("Supplier", sel("Hetzner Online GmbH · matched", "building") + '<div class="sub-note"><span class="ex-conf hi">99%</span> Matched to the CRM company (VENDOR) by VAT number DE812871812.</div>'), f("Invoice number", val("R-1049-2026") + '<div class="sub-note"><span class="ex-conf hi">99%</span></div>')) +
        row2(f("Invoice date", val("Nov 1, 2026") + '<div class="sub-note"><span class="ex-conf hi">97%</span></div>'), f("Due date", val("Nov 15, 2026") + '<div class="sub-note"><span class="ex-conf mid">78%</span> Read from payment terms.</div>')) +
        row2(f("Customer on the invoice", val("Logiqdev OS Ltd")), f("Currency", val("EUR"))) + f("Description", val("Cloud hosting October")) +
        row2(f("Category", sel("Hosting · suggested", "tag") + '<div class="sub-note">From the supplier profile default category.</div>'), f("Project", sel("—", "folder"))) +
        row2(f("Net", val("842.50")), f("VAT %", val("0") + '<div class="sub-note">Treatment: Reverse charge</div>')) + row2(f("VAT amount", val("0.00")), f("Gross", val("842.50"))) +
        f("Payment information", val("Bank transfer · IBAN DE89 3704 0044 0532 0130 00 · ref R-1049-2026") + '<div class="sub-note">Saved as payment_info (Json). Used to prefill the payment later.</div>')) + sp() +
      cd("<b>Line items</b><span class='r'>" + btn("Add line", "plus", "sm") + "</span>", tbl(["Description", ">Qty", ">Unit price", ">Net", "Confidence"], [["Cloud server CX42 (Oct)", "3", eur(210), eur(630), '<span class="ex-conf hi">98%</span>'], ["Backup storage 2 TB", "1", eur(152.5), eur(152.5), '<span class="ex-conf hi">95%</span>'], ["Domains .eu", "4", eur(15), eur(60), '<span class="ex-conf mid">83%</span>']]) + '<div class="ex-note">Lines total €842.50 = net. If they differ, approval is blocked until they match.</div>', 1) + sp() +
      cd("<b>On approve</b>", '<div class="rowx"><div class="grow"><b>Remember this supplier</b><small>Default category Hosting and alias “Hetzner” (LedgerSupplierProfile)</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Create payment as paid</b><small>Settle now with the company card</small></div>' + sw(0) + "</div>") + "</div></div>" +
      dm(["LedgerInvoiceImport · extracted columns, field_confidence, payment_info, extraction_raw, review_notes, ledger_record_id", "LedgerInvoiceImportLine · description, quantity, unit_price, net_amount, vat_percent, vat_amount, gross_amount, confidence", "LedgerSupplierProfile · matching_aliases, default_category_id · LedgerRecord (created) · LedgerAttachment (is_original) · Document (17)"], []) + "</div>";
  }

  /* =====================================================================================================================
     RECURRING EXPENSES — list + upcoming calendar (spec "Recurring Expenses", "Automation")
     @screen Recurring expenses
     @route  /finance/recurring?status=&view=list|calendar
     @perm   VIEW finance.recurring_expenses.read + finance.expenses.read to open the generated records · create/edit/pause/resume/end finance.recurring_expenses.manage · approve generated records finance.expenses.approve*
     @api    GET /ledger/recurring?status= · POST /ledger/recurring · PATCH /ledger/recurring/:id · POST /ledger/recurring/:id/pause | resume | end | generate-now · GET /ledger/recurring/upcoming?days=
     @mcp    finance_recurring_expenses_manage
     @data   RecurringExpense (name, status, category_id, subcategory_id, company_id, project_id, department_id, payment_method_id, currency, expected_net_amount, vat_percent, expected_vat_amount, expected_gross_amount, tax_rate_id, vat_treatment,
             pricing_mode, interval, interval_count, custom_rrule, start_date, end_date, day_of_month, due_days, next_occurrence_date, last_generated_at, occurrences_generated, auto_generate, reminder_days_before, scheduled_job_id, paused_at, ended_at) ·
             LedgerRecord (recurring_expense_id, recurrence_sequence) · ScheduledJob (20)
     @ui     Table + Calendar toggle, Badge, Switch (auto_generate), DropdownMenu, Progress for the year total
     @states loading · empty ("No recurring expenses") · error · no-access
     @audit  template created/updated/paused/resumed/ended, record generated (automation_run_id), reminder sent
     @note   The engine (20) runs the template's ScheduledJob: it creates a LedgerRecord (source RECURRING_EXPENSE, status POSTED or DRAFT when auto_generate is off) at next_occurrence_date, then advances it. Editing the template changes FUTURE records
             only; generated records stay individually editable. Reminders are sent reminder_days_before to administrators via 14. Custom recurrence uses custom_rrule (RFC 5545). Day 31 on shorter months falls to the last day.
     ===================================================================================================================== */
  const RECUR = [
    ["Office rent", "Skyline Properties Ltd", "Office / Rent", "ACTIVE", "MONTH", 1, 2400, 19, 2856, "Nov 15", 11, 1, "Yes"],
    ["Hetzner cloud hosting", "Hetzner Online GmbH", "Hosting", "ACTIVE", "MONTH", 1, 842.5, 0, 842.5, "Dec 1", 14, 3, "Yes"],
    ["Figma seats", "Figma Inc.", "Software", "ACTIVE", "MONTH", 1, 180, 0, 180, "Nov 28", 9, 3, "Yes"],
    ["Accounting services", "Kyriakou & Partners", "Professional services", "ACTIVE", "QUARTER", 1, 1350, 19, 1606.5, "Dec 3", 4, 5, "No"],
    ["Business insurance", "Interlife", "Insurance", "ACTIVE", "YEAR", 1, 3120, 0, 3120, "Mar 1", 2, 14, "Yes"],
    ["Equipment lease · 3 laptops", "Leaseplan", "Equipment", "ACTIVE", "MONTH", 1, 389, 19, 462.91, "Nov 20", 18, 3, "Yes"],
    ["Coworking day passes", "Hub Athens", "Office", "PAUSED", "WEEK", 2, 60, 19, 71.4, "—", 22, 0, "Yes"],
    ["Legacy CRM license", "OldCRM Inc.", "Software", "ENDED", "MONTH", 1, 95, 0, 95, "—", 30, 0, "Yes"],
  ];
  const RSC = { ACTIVE: "green", PAUSED: "yellow", ENDED: "", CANCELLED: "red" };
  const every = (r) => (r[5] === 1 ? "Every " + r[4].toLowerCase() : "Every " + r[5] + " " + r[4].toLowerCase() + "s");
  function recurring(s) {
    const cal = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => '<div class="d h">' + d + "</div>").join("") + Array.from({ length: 35 }, (_, i) => { const day = i - 5; const ev = { 15: "Office rent €2,856", 20: "Laptop lease €463", 28: "Figma €180" }[day]; return '<div class="d">' + (day > 0 && day <= 30 ? day : "") + (ev ? "<span>" + ev + "</span>" : "") + "</div>"; }).join("");
    return '<div class="a-page">' + head("Recurring expenses", "Templates that create expense records on a schedule.", btn("Export", "file") + btn("New recurring expense", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Active", 6, "templates") + stat("Monthly run rate", "€5,213", "gross, normalised") + stat("Annual commitment", "€62,556", "") + stat("Next 14 days", "€3,499", "3 records") + stat("Paused", 1, "") + "</div>" +
      '<div class="toolbar">' + search("Search name, supplier") + segs(["List", "Calendar"], "List") + sel("Status: Active", "filter") + sel("Category…", "tag") + sel("Supplier…", "building") + sel("Project…", "folder") + "</div>" +
      tbl(["Name", "Supplier", "Category", "Status", "Schedule", ">Net", ">VAT", ">Gross", "Next record", ">Generated", "Auto", ""], RECUR.map((r) => [ink(r[0]), r[1], r[2], E(r[3], RSC[r[3]]), every(r), eur(r[6]), r[7] + "%", eur(r[8]), r[9], r[10], sw(r[12] === "Yes"), more]), 1) + sp() +
      cd("<b>Upcoming · calendar view</b><span class='r muted'>next_occurrence_date · November 2026</span>", '<div class="ex-calendar">' + cal + "</div>") +
      dm(["RecurringExpense · name, status, category_id, company_id, project_id, department_id, payment_method_id, expected_net_amount, vat_percent, expected_gross_amount, interval, interval_count, custom_rrule, start_date, end_date, next_occurrence_date, last_generated_at, occurrences_generated, auto_generate, reminder_days_before, paused_at, ended_at", "LedgerRecord · recurring_expense_id, recurrence_sequence", "ScheduledJob (20)"], []) + "</div>";
  }

  /* =====================================================================================================================
     RECURRING EXPENSE — create / edit (spec "Recurring Expenses")
     @screen New recurring expense
     @route  /finance/recurring/new · /finance/recurring/:id/edit
     @perm   finance.recurring_expenses.manage · branch/project scope of the caller applies to the pickers
     @api    POST /ledger/recurring · PATCH /ledger/recurring/:id (affects future records only) · POST /ledger/recurring/:id/preview?count=6 (next dates and amounts)
     @mcp    finance_recurring_expenses_manage
     @data   RecurringExpense (every column) · LedgerSupplierProfile (defaults) · LedgerCategory · TaxRate (08) · ScheduledJob (20, created on save)
     @ui     Form sections, Select (interval), Popover+Command (supplier, category, project, department), DatePicker, Input number, Switch, RRULE builder Dialog for custom recurrence, preview Table
     @states validation inline (end_date after start_date) · saving · saved toast · permission error · generated-records warning when editing ("12 existing records are not changed")
     @audit  recurring.created / updated with before/after
     @note   Interval = BillingInterval (DAY, WEEK, MONTH, QUARTER, YEAR) x interval_count; anything else (every last Friday) uses custom_rrule and ignores the two. day_of_month pins the day; due_days sets the due date from the generation date.
             expected_* amounts are an estimate: the generated record starts from them and the real invoice amount replaces it when the bill arrives (edit the record, never the template).
     ===================================================================================================================== */
  function recurringNew() {
    return '<div class="a-page">' + head("New recurring expense", "Creates an expense record on each due date.", btn("Cancel") + btn("Save template", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Expense</b>", f("Name", val("Hetzner cloud hosting")) + f("Description", val("Monthly cloud servers and backup storage")) + row2(f("Supplier", sel("Hetzner Online GmbH", "building")), f("Category", sel("Hosting", "tag"))) + row2(f("Subcategory", sel("—")), f("Payment method", sel("Company card", "dollar"))) + row2(f("Project", sel("— (overhead)", "folder")), f("Department", sel("Engineering", "users"))) + f("Branch", sel("Athens HQ", "building"))) + sp() +
      cd("<b>Amount (expected)</b>", row2(f("Pricing", segs(["Exclusive", "Inclusive"], "Exclusive")), f("Currency", sel("EUR"))) + row2(f("Expected net", val("842.50")), f("VAT rate", sel("Reverse charge 0%", "tag"))) + row2(f("VAT treatment", sel("Reverse charge")), f("Expected gross", val("842.50")))) + sp() +
      cd("<b>Schedule</b>", row2(f("Repeat every", val("1")), f("Interval", sel("Month"), "BillingInterval: day, week, month, quarter, year.")) + row2(f("Start date", sel("Dec 1, 2025", "calendar")), f("End date", sel("No end", "calendar"))) + row2(f("Day of month", val("1")), f("Due after (days)", val("14"))) + f("Custom recurrence", btn("Build a custom rule", "settings", "sm"), "Overrides interval and count with an RRULE, e.g. every last Friday.") + f("Notes", box("Internal note"))) +
      "</div><div>" +
      cd("<b>Automation</b>", '<div class="rowx"><div class="grow"><b>Generate records automatically</b><small>Off: the template only reminds you</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Create as draft</b><small>Otherwise posted directly (approval rules still apply)</small></div>' + sw(0) + "</div>" + f("Remind administrators", row2(val("3"), sel("days before")), "reminder_days_before · delivered via Notifications (14).")) + sp() +
      cd("<b>Preview</b><span class='r muted'>next 6 records</span>", [["Dec 1, 2026", 842.5], ["Jan 1, 2027", 842.5], ["Feb 1, 2027", 842.5], ["Mar 1, 2027", 842.5], ["Apr 1, 2027", 842.5], ["May 1, 2027", 842.5]].map((r) => '<div class="rowx"><div class="grow">' + r[0] + "</div>" + eur(r[1]) + "</div>").join(""), 1) + sp() +
      callout("flag", "Editing this template later changes future records only. Existing records stay as they are.", "") + "</div></div>" +
      dm(["RecurringExpense · every column written on create", "ScheduledJob (20) · scheduled_job_id", "LedgerCategory · LedgerPaymentMethod · CrmCompany · Project · Team · TaxRate (08)"], []) + "</div>";
  }

  /* =====================================================================================================================
     VENDORS — supplier list (spec "Expense Management", "Automation: auto-categorizing known suppliers")
     @screen Vendors
     @route  /finance/vendors?q=&category=
     @perm   VIEW finance.expenses.read · edit ledger defaults finance.expenses.update · creating the company itself needs crm.companies.create (02 owns CrmCompany)
     @api    GET /ledger/suppliers?q= (CrmCompany type VENDOR joined with LedgerSupplierProfile and spend) · PUT /ledger/suppliers/:companyId/profile
     @mcp    finance_suppliers_read · finance_suppliers_update
     @data   CrmCompany (type VENDOR, 02) · LedgerSupplierProfile (company_id, default_category_id, default_tax_rate_id, default_vat_treatment, default_pricing_mode, payment_terms_days, matching_aliases, vat_number, bank_details, notes) ·
             LedgerRecord (company_id, gross_amount, payment_status) for spend and open balance
     @ui     Table, Badge, Dialog for "New vendor" (creates the CrmCompany through 02), DropdownMenu
     @states loading · empty ("No vendors yet. They appear when you approve a supplier invoice") · error · no-access
     @audit  profile created/updated
     @note   Suppliers ARE CRM companies of type VENDOR; this module never owns a vendor table, only the ledger defaults (LedgerSupplierProfile). A profile exists only once the user sets defaults or an import is approved.
             Spend and open balance are computed from LedgerRecord, never stored.
     ===================================================================================================================== */
  const VEND = [
    ["Hetzner Online GmbH", "Hosting", "Reverse charge", 14, "Hetzner, HETZNER ONLINE", "DE812871812", 9420, 842.5, 0],
    ["Skyline Properties Ltd", "Office / Rent", "Standard 19%", 14, "Skyline", "CY10293847L", 28800, 2856, 1],
    ["Figma Inc.", "Software", "Reverse charge", 30, "FIGMA, Figma Inc", "US-EIN 46-2373541", 2160, 180, 1],
    ["Google Ireland Ltd", "Marketing", "Reverse charge", 7, "Google Ads, Google", "IE6388047V", 8350, 1650, 1],
    ["Kyriakou & Partners", "Professional services", "Standard 19%", 14, "Kyriakou", "CY10445612B", 5400, 1606.5, 0],
    ["Intercity Rail", "Travel", "Reduced 9%", 0, "", "", 640, 0, 0],
    ["Leaseplan", "Equipment", "Standard 19%", 30, "LeasePlan", "GR998877665", 5554, 462.91, 0],
  ];
  function vendors() {
    return '<div class="a-page">' + head("Vendors", "Suppliers and their ledger defaults.", btn("Export", "file") + btn("New vendor", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Vendors", 38, "CRM companies of type Vendor") + stat("Spend last 12 months", "€146,820", "gross") + stat("Open balance", "€5,120", "4 unpaid records", 1) + stat("With defaults", 24, "auto-categorized") + "</div>" +
      '<div class="toolbar">' + search("Search vendor, VAT number, alias") + sel("Default category…", "tag") + sel("VAT treatment…") + sel("Has open balance") + sel("Sort: Spend ↓", "sort") + "</div>" +
      tbl(["Vendor", "Default category", "VAT treatment", ">Terms (days)", "Matching aliases", "VAT number", ">Spend 12 mo", ">Open balance", ""], VEND.map((v) => [who(v[0].split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(), "", v[0], v[5] ? "VAT " + v[5] : "No VAT number"), v[1], v[2], v[3] || "—", v[4] || muted("—"), v[5] || "—", eur0(v[6]), v[8] ? eur(v[7], "neg") : eur(0, "dim"), more])) +
      '<div class="sub-note" style="margin-top:8px">A supplier whose name matches an alias is categorized automatically on import (LedgerSettings.auto_categorize_suppliers).</div>' +
      dm(["CrmCompany · name, type VENDOR (02)", "LedgerSupplierProfile · default_category_id, default_tax_rate_id, default_vat_treatment, default_pricing_mode, payment_terms_days, matching_aliases, vat_number, bank_details", "LedgerRecord · company_id, gross_amount, payment_status (spend, open balance)"], []) + "</div>";
  }

  /* =====================================================================================================================
     VENDOR PROFILE (spec "Expense Management")
     @screen Vendor profile
     @route  /finance/vendors/:companyId?tab=profile|records|imports
     @perm   VIEW finance.expenses.read · edit defaults finance.expenses.update · bank_details visible to finance.expenses.update only (sensitive payment data)
     @api    GET /ledger/suppliers/:companyId · PUT /ledger/suppliers/:companyId/profile · GET /ledger/records?company_id=
     @mcp    finance_suppliers_read · finance_suppliers_update
     @data   LedgerSupplierProfile (all) · CrmCompany (02, read-only link) · LedgerRecord (company_id) · LedgerInvoiceImport (matched_company_id)
     @ui     Tabs, Form, Popover+Command (category, tax rate), tag input (aliases), Table
     @states loading · not found · error · no-access
     @audit  profile updated (before/after)
     @note   Defaults apply to NEW records only; old records keep their stored values (historical consistency). The company page itself (address, contacts) lives in CRM (02).
     ===================================================================================================================== */
  function vendorDetail() {
    return '<div class="a-page">' + head("Hetzner Online GmbH", "Vendor · CRM company (02) · ledger defaults", btn("Open in CRM", "crm") + btn("Add expense", "plus") + btn("Save defaults", "check", "primary")) +
      '<div class="mini-stats">' + stat("Spend 12 months", "€9,420", "11 records") + stat("Open balance", "€0.00", "all paid") + stat("Avg invoice", "€856", "") + stat("Last invoice", "Nov 1", "R-1049-2026") + "</div>" +
      '<div class="tabset">' + tabs([["p", "Defaults"], ["r", "Records", 11], ["i", "Imports", 3]], "p") +
      pane("p", 1, '<div class="g2" style="align-items:start">' + cd("<b>Ledger defaults</b>", f("Default category", sel("Hosting", "tag")) + f("VAT treatment", sel("Reverse charge")) + f("Default VAT rate", sel("0% reverse charge")) + f("Pricing mode", segs(["Exclusive", "Inclusive"], "Exclusive")) + f("Payment terms (days)", val("14")) + f("VAT number", val("DE812871812"))) +
        cd("<b>Matching & payment</b>", f("Matching aliases", '<div class="rowx" style="padding:0;gap:6px">' + tok("Hetzner") + tok("HETZNER ONLINE") + tok("Hetzner Online GmbH") + btn("Add", "plus", "sm") + "</div>", "Used to recognise the supplier on uploaded invoices and card statements.") + f("Bank details", val("IBAN DE89 3704 0044 0532 0130 00 · BIC COBADEFFXXX"), "Stored as bank_details (Json), visible to editors only.") + f("Notes", box("Internal note about this supplier"))) + "</div>") +
      pane("r", 0, tbl(["Number", "Date", "Description", ">Gross", "Status", "Payment"], R.slice(2, 3).map((r) => [r.n, r.dt, r.d, eur(r.gross), st(r.s), ps(r.ps)]))) +
      pane("i", 0, tbl(["File", "Status", "Invoice no.", ">Gross"], [["hetzner-invoice-1049.pdf", E("PENDING_REVIEW", "yellow"), "R-1049-2026", eur(842.5)], ["hetzner-invoice-0958.pdf", E("APPROVED", "green"), "R-0958-2026", eur(842.5)]])) + "</div>" +
      dm(["LedgerSupplierProfile · all columns", "CrmCompany (02, read-only) · LedgerRecord · LedgerInvoiceImport"], []) + "</div>";
  }

  /* =====================================================================================================================
     APPROVALS (spec "Audit Trail": approval actions; 01 separation of duties; LedgerSettings.approval_threshold_amount)
     @screen Approvals
     @route  /finance/approvals?tab=records|imports|payroll
     @perm   VIEW finance.expenses.approve* (records and payroll) or finance.invoice_imports.review (imports tab) · approve/reject finance.expenses.approve* · payroll entries finance.payroll.manage* · expense claims finance.expense_claims.approve* · rules finance.approval_rules.manage* · the creator never approves their own item
     @api    GET /ledger/approvals?type= · POST /ledger/records/:id/approve | /reject {reason} · POST /ledger/records/bulk {action: approve} · POST /ledger/payroll/entries/:id/approve
     @mcp    finance_records_approve (sensitive) · finance_payroll_manage
     @data   LedgerRecord (status PENDING_REVIEW, approved_by_membership_id, approved_at, created_by_membership_id, gross_amount) · LedgerSettings (approval_threshold_amount, require_approval_for_imports) · LedgerInvoiceImport (PENDING_REVIEW) ·
             PayrollEntry (status DRAFT, approved_by_membership_id) · FinanceApproval (entity_type LEDGER_RECORD | EXPENSE_CLAIM, entity_id, step, approver_membership_id, decision, comment) · FinanceApprovalRule (entity_type LEDGER_RECORD, record_type, min_amount, max_amount, currency, branch_id, steps, require_distinct_user)
     @ui     Tabs with counts, Table with checkboxes and bulk bar, Dialog for reject reason (required), Badge
     @states loading · empty ("Nothing waiting for approval") · error · no-access · row disabled with reason (own record)
     @audit  ledger.record.approved / rejected (reason), payroll.entry.approved
     @note   Approval follows the shared FinanceApprovalRule (08): amount band, currency, branch, ordered steps, each step a membership, role or team; FinanceApproval rows record every step. Without a matching rule,
             LedgerSettings.approval_threshold_amount applies with one approver holding finance.expenses.approve* who is not the creator (separation of duties, 01). A rejected record returns to DRAFT with the reason in the history.
     ===================================================================================================================== */
  function approvals() {
    const rows = [[R[6], "Anna Meyer", "Over threshold? No · import requires review", 0], [R[12], "Marco Silva", "Over the €1,000 threshold", 1], [R[3], "System (recurring)", "Auto-generated, draft off", 0]];
    return '<div class="a-page">' + head("Approvals", "Records, imports and payroll waiting for a second pair of eyes.", sel("Threshold €1,000", "settings")) +
      callout("shield", "You cannot approve records you created. Items you created are shown greyed with the reason.", "") + sp(8) +
      '<div class="tabset">' + tabs([["r", "Records", 3], ["i", "Imports", 2], ["p", "Payroll", 4]], "r") +
      pane("r", 1, '<div class="bulk"><span class="cb on"></span><b>1 selected</b><span style="flex:1"></span>' + btn("Approve", "check", "sm primary") + btn("Reject…", "x", "sm") + "</div>" +
        tbl(["", "Number", "Description", "Type", ">Gross", "Submitted by", "Submitted", "Why review", ""], [[cb(1), R[6].n, ink(R[6].d), ty("EXPENSE"), eur(R[6].gross), wh("KL"), "Oct 29", "Import requires review", btn("Open", "", "sm")], [cb(0), R[12].n, ink(R[12].d), ty("EXPENSE"), eur(R[12].gross), wh("AM"), "Nov 4", "Over the €1,000 threshold", btn("Open", "", "sm")], ['<span class="muted" title="Separation of duties">' + I("lock", 13) + "</span>", R[3].n, ink(R[3].d), ty("EXPENSE"), eur(R[3].gross), wh("MS"), "Nov 1", muted("You created this"), btn("Open", "", "sm")]]) + '<div class="sub-note" style="margin-top:8px">Approving posts the record to the period. Rejecting sends it back to Draft with the reason.</div>') +
      pane("i", 0, tbl(["File", "Supplier", ">Gross", "Confidence", "Uploaded by", ""], [["hetzner-invoice-1049.pdf", "Hetzner Online GmbH", eur(842.5), "98%", wh("AM"), btn("Review", "", "sm primary")], ["figma-receipt-nov.pdf", "Figma Inc.", eur(180), "91%", wh("AM"), btn("Review", "", "sm primary")]])) +
      pane("p", 0, tbl(["Employee", "Kind", "Period", ">Base", ">Employer cost", ">Total", "Prepared by", ""], [["Marco Silva", E("SALARY"), "Nov 2026", eur(4800), eur(980), eur(5780), wh("AM"), btn("Approve", "", "sm")], ["Sofia Jensen", E("SALARY"), "Nov 2026", eur(3900), eur(800), eur(4700), wh("AM"), btn("Approve", "", "sm")], ["Jonas Koch", E("BONUS"), "Nov 2026", eur(600), eur(0), eur(600), wh("AM"), btn("Approve", "", "sm")], ["Kim Lund", E("REIMBURSEMENT"), "Nov 2026", eur(128.4), eur(0), eur(128.4), wh("AM"), btn("Approve", "", "sm")]]) + '<div class="sub-note" style="margin-top:8px">Payroll needs finance.payroll.manage*; amounts are hidden from callers without finance.payroll.read*.</div>') + "</div>" +
      dm(["LedgerRecord · status PENDING_REVIEW, created_by_membership_id, approved_by_membership_id, approved_at", "LedgerSettings · approval_threshold_amount, require_approval_for_imports", "LedgerInvoiceImport · status PENDING_REVIEW · PayrollEntry · status DRAFT, approved_by_membership_id", "FinanceApprovalRule · entity_type, record_type, min_amount, max_amount, currency, branch_id, steps, require_distinct_user, priority, enabled", "FinanceApproval · entity_type, entity_id, rule_id, step, approver_membership_id, approver_role_id, decision, comment, rejection_reason, decided_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     BUDGETS (not in the spec text; requested for the module: planned vs actual per category / project / period)
     @screen Budgets
     @route  /finance/budgets?year=2026&scope=category|project|department
     @perm   VIEW finance.expenses.read (actuals) + finance.profit_loss.read* (income lines) · read finance.budgets.read · create/edit finance.budgets.manage
     @api    GET /ledger/budgets?year=&scope= · POST /ledger/budgets · PATCH /ledger/budgets/:id/lines 
     @mcp    finance_budgets_read · finance_budgets_manage
     @data   LedgerBudget (name, fiscal_year, scope CATEGORY | PROJECT | DEPARTMENT, basis, currency, owner_membership_id, status DRAFT | ACTIVE | CLOSED, warn_percent) · LedgerBudgetLine (subject_key, category_id | project_id | department_id, month 1-12, planned_amount). Actuals are computed: LedgerRecord (category_id, project_id, department_id, net_amount, transaction_date) aggregated per period (FinancialPeriod / FinancialPeriodSummary.expenses_by_category).
     @ui     Table with inline editable Input cells per month, Progress/meter, Select for scope, Tabs, Card, Alert for over-budget
     @states loading · empty ("No budget for 2026. Create one from last year's actuals") · error · no-access
     @audit  budget created, line changed (before/after), budget approved
     @note   A budget row = scope (category | project | department) + period + planned amount. Warning thresholds (80% yellow, 100% red) raise a Notification (14) to the budget owner and surface as a LedgerInsight (kind BUDGET_ALERT). Actual = posted
             EXPENSE records of the scope in the period, accrual basis by default (a basis switch like the dashboard). Forecast = actual to date + remaining RecurringExpense occurrences.
     ===================================================================================================================== */
  function budgets() {
    const B = [["Employees", 115200, 86400, 96000], ["Hosting", 10800, 8420, 9300], ["Software", 6000, 5560, 6400], ["Marketing", 18000, 15900, 21000], ["Office / Rent", 28800, 26400, 28800], ["Travel", 4000, 1710, 2500], ["Equipment", 9000, 9750, 9750], ["Professional services", 6500, 4050, 5400]];
    return '<div class="a-page">' + head("Budgets", "Planned versus actual spend, January to November 2026.", sel("Year 2026", "calendar") + sel("By category", "tag") + btn("Copy from 2025", "layers") + btn("New budget", "plus", "primary")) +
            '<div class="mini-stats">' + stat("Planned (YTD)", "€198,300", "") + stat("Actual (YTD)", "€158,190", "79.8% used") + stat("Forecast year end", "€201,150", "+1.4% over plan", 1) + stat("Over budget", 2, "categories", 1) + stat("Underspent", 3, "categories") + "</div>" +
      '<div class="toolbar">' + search("Search category or project") + sel("Period: YTD", "calendar") + segs(["Accrual", "Cash"], "Accrual") + sel("Branch: all", "building") + "</div>" +
      tbl(["Category", ">Planned (year)", ">Actual (YTD)", "Used", ">Remaining", ">Forecast", "Status", ""], B.map((b) => { const p = Math.round(b[2] / b[1] * 100), over = b[2] > b[1]; return [ink(b[0]), eur0(b[1]), eur0(b[2]), '<div style="min-width:130px"><div class="ex-meter"><i class="' + (over ? "over" : p > 80 ? "warn" : "ok") + '" style="width:' + Math.min(p, 100) + '%"></i></div><small class="muted">' + p + "%</small></div>", eur0(b[1] - b[2], over ? "neg" : ""), eur0(b[3]), over ? bd("Over budget", "red") : p > 80 ? bd("At risk", "yellow") : bd("On track", "green"), more]; })) + sp() +
      cd("<b>Marketing · monthly plan</b><span class='r muted'>editable cells</span>", tbl(["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], [["Planned", ...[1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500].map((v) => v.toLocaleString())], ["Actual", ...["1,320", "1,480", "1,610", "1,390", "1,520", "1,770", "1,260", "1,540", "1,610", "1,880", "1,520", "—"]]]), 1) +
      dm(["LedgerRecord · category_id, project_id, department_id, net_amount, transaction_date (actuals)", "FinancialPeriodSummary · expenses_by_category (closed periods)", "RecurringExpense (forecast)", "LedgerBudget · name, fiscal_year, scope, basis, currency, owner_membership_id, status, warn_percent", "LedgerBudgetLine · budget_id, subject_key, category_id, project_id, department_id, month, planned_amount"], []) + "</div>";
  }

  /* =====================================================================================================================
     PROFITABILITY — per project and per customer (spec "Project Profitability")
     @screen Profitability
     @route  /finance/profitability?scope=PROJECT|CUSTOMER&period=<id>&q=&sort=margin
     @perm   VIEW finance.profitability.read* (sensitive: margins and cost) · employee cost lines also need finance.payroll.read* (otherwise shown as one aggregate without names)
     @api    GET /ledger/profitability?scope=&period_id=&from=&to= · POST /ledger/profitability/recalculate {scope, subject_id?, period_id}
     @mcp    finance_profitability_read
     @data   LedgerProfitabilitySnapshot (scope, subject_id, project_id, company_id, period_id, currency, revenue, payments_received, outstanding_revenue, direct_expenses, employee_costs, other_expenses, total_cost, gross_profit,
             margin_percent, details Json, calculated_at) · Project (05) · CrmCompany (02) · derived from LedgerRecord (project_id, company_id) and approved TimeEntry cost-rate snapshots (18)
     @ui     Tabs (Projects / Customers), Table with sortable columns, Progress margin meter, Popover+Command filters, Badge, Drawer for the breakdown
     @states loading · empty ("No projects with ledger activity in this period") · error · no-access · stale (calculated_at older than the latest ledger change: "Recalculate")
     @audit  profitability recalculated (scope, who)
     @note   revenue = POSTED INCOME records of the subject (accrual); payments_received = settlements; outstanding_revenue = revenue - received. direct_expenses = POSTED EXPENSE records with project_id; employee_costs come from approved
             time entries x the cost-rate SNAPSHOT of module 18 (not from payroll, so it works per hour); other_expenses = allocated overhead if the organization enables it. total_cost = direct + employee + other;
             gross_profit = revenue - total_cost; margin_percent = gross_profit / revenue. Results surface in 05 (financial context) and 02 (customer profitability); this module owns the calculation. Customer scope sums the customer's projects
             plus non-project records of the company.
     ===================================================================================================================== */
  const PRO = [
    ["Acme Rebrand Website", "Acme Corp", 58000, 41600, 16400, 4800, 21300, 3100, 29200, 28800, 49.7],
    ["Stripe Billing Migration", "Northwind", 34000, 34000, 0, 1900, 14250, 800, 16950, 17050, 50.1],
    ["Mobile App v2", "Globex", 92000, 46000, 46000, 9800, 38900, 4200, 52900, 39100, 42.5],
    ["Customer Portal Build", "Initech", 27000, 13500, 13500, 600, 21800, 900, 23300, 3700, 13.7],
    ["Data Warehouse Setup", "Initech", 18500, 18500, 0, 3100, 17250, 400, 20750, -2250, -12.2],
    ["Brand Strategy Sprint", "Globex", 12000, 12000, 0, 420, 5200, 150, 5770, 6230, 51.9],
  ];
  function profitability() {
    const mt = (m) => '<div style="min-width:120px"><div class="ex-meter"><i class="' + (m < 0 ? "over" : m < 25 ? "warn" : "ok") + '" style="width:' + Math.max(Math.min(Math.abs(m), 100), 4) + '%"></i></div><small class="' + (m < 0 ? "neg" : "muted") + '">' + m + "%</small></div>";
    return '<div class="a-page">' + head("Profitability", "Which projects and customers actually make money.", sel("Last 12 months", "calendar") + btn("Recalculate", "zap") + btn("Export", "file")) +
      '<div class="mini-stats">' + stat("Revenue", "€241,500", "6 projects") + stat("Total cost", "€148,870", "") + stat("Gross profit", "€92,630", "38.4% margin") + stat("Outstanding revenue", "€75,400", "not yet received", 1) + stat("Loss-making", 1, "Data Warehouse Setup", 1) + "</div>" +
      '<div class="tabset">' + tabs([["p", "Projects"], ["c", "Customers"]], "p") +
      '<div class="toolbar" style="margin-top:10px">' + search("Search project or customer") + sel("Status: all", "filter") + sel("Customer…", "building") + sel("Margin < 25%") + sel("Sort: Margin ↑", "sort") + "</div>" +
      pane("p", 1, tbl(["Project", "Customer", ">Revenue", ">Received", ">Outstanding", ">Direct exp.", ">Employee cost", ">Other", ">Total cost", ">Gross profit", "Margin"], PRO.map((r) => [ink(r[0]), r[1], eur0(r[2]), eur0(r[3]), eur0(r[4], r[4] ? "neg" : "dim"), eur0(r[5]), eur0(r[6]), eur0(r[7]), eur0(r[8]), eur0(r[9], r[9] < 0 ? "neg" : "pos"), mt(r[10])]), 1)) +
      pane("c", 0, tbl(["Customer", ">Projects", ">Revenue", ">Received", ">Outstanding", ">Total cost", ">Gross profit", "Margin"], [["Globex", 2, eur0(104000), eur0(58000), eur0(46000), eur0(58670), eur0(45330, "pos"), mt(43.6)], ["Acme Corp", 1, eur0(58000), eur0(41600), eur0(16400), eur0(29200), eur0(28800, "pos"), mt(49.7)], ["Initech", 2, eur0(45500), eur0(32000), eur0(13500), eur0(44050), eur0(1450, "pos"), mt(3.2)], ["Northwind", 1, eur0(34000), eur0(34000), eur0(0), eur0(16950), eur0(17050, "pos"), mt(50.1)]])) + "</div>" + sp() +
      cd("<b>Data Warehouse Setup · breakdown</b><span class='r muted'>details Json · calculated Nov 11, 06:00</span>", '<div class="g2" style="align-items:start"><div class="ex-sum"><div><span>Revenue (invoiced)</span>' + eur0(18500) + "</div><div><span>Direct expenses (3 records)</span>" + eur0(3100, "neg") + "</div><div><span>Employee cost · 212.5 h × cost rate</span>" + eur0(17250, "neg") + "</div><div><span>Other expenses</span>" + eur0(400, "neg") + '</div><div class="tot"><span>Gross profit</span>' + eur0(-2250, "neg") + "</div></div><div>" + brow("Jonas Koch · 96 h", "€7,680", 45) + brow("Anna Meyer · 71 h", "€6,390", 37) + brow("Kim Lund · 45.5 h", "€3,180", 18) + '<div class="sub-note">Employee costs use the cost rate snapshot stored on each approved time entry (18). Names need finance.payroll.read*.</div></div></div>') +
      dm(["LedgerProfitabilitySnapshot · scope, subject_id, project_id, company_id, period_id, revenue, payments_received, outstanding_revenue, direct_expenses, employee_costs, other_expenses, total_cost, gross_profit, margin_percent, details, calculated_at", "Project (05) · CrmCompany (02) · LedgerRecord · TimeEntry cost-rate snapshot (18, read-only)"], []) + "</div>";
  }

  /* =====================================================================================================================
     FINANCIAL PERIODS (spec "Financial Periods")
     @screen Financial periods
     @route  /finance/periods?type=&year=  · /finance/periods/:periodId
     @perm   VIEW finance.income.read OR finance.expenses.read · create / close / reopen / lock finance.periods.manage* (sensitive) · summaries inside need the matching read keys
     @api    GET /ledger/periods?year= · POST /ledger/periods {type, name, fiscal_year, start_date, end_date} · POST /ledger/periods/:id/close | /reopen | /lock · GET /ledger/periods/:id/summary?basis= · POST /ledger/periods/:id/summary (regenerate)
     @mcp    finance_periods_manage (sensitive)
     @data   FinancialPeriod (type, name, fiscal_year, start_date, end_date, status, closed_by_membership_id, closed_at, locked_at, notes) · FinancialPeriodSummary (per period, basis, scope_key; is_final) · LedgerRecord.period_id · PayrollEntry.period_id ·
             LedgerSettings.fiscal_year_start_month
     @ui     Table, Badge, Dialog with a pre-close checklist, Tabs for the basis, Card
     @states loading · empty · error · no-access · close blocked (checklist items open, with links)
     @audit  period created, closed (who, checklist), reopened (reason), locked
     @note   OPEN accepts new and edited records. CLOSED freezes the summary (is_final true) and blocks edits unless the caller holds finance.periods.manage*, who can reopen with a reason. LOCKED is permanent: corrections go into the next open
             period as ADJUSTMENT settlements or correcting records. Close checklist: no DRAFT or PENDING_REVIEW records in the period, no unposted payroll entries, all supplier imports resolved, VAT report reviewed. Periods of type DAY/WEEK/CUSTOM are
             reporting ranges (no close), MONTH/QUARTER/YEAR are accounting periods. Fiscal year start comes from LedgerSettings.fiscal_year_start_month.
     ===================================================================================================================== */
  function periods() {
    const P = [["Nov 2026", "MONTH", "OPEN", "Nov 1 – Nov 30", "—", 31840, 18260, 13580], ["Oct 2026", "MONTH", "CLOSED", "Oct 1 – Oct 31", "Nov 5 · Marco Silva", 33200, 19000, 14200], ["Sep 2026", "MONTH", "LOCKED", "Sep 1 – Sep 30", "Oct 6 · Marco Silva", 29600, 17400, 12200], ["Q3 2026", "QUARTER", "LOCKED", "Jul 1 – Sep 30", "Oct 8 · Marco Silva", 79800, 53300, 26500], ["FY 2025", "YEAR", "LOCKED", "Jan 1 – Dec 31, 2025", "Jan 31 · Marco Silva", 268400, 187900, 80500], ["Last 30 days", "CUSTOM", "OPEN", "Oct 12 – Nov 11", "—", 33900, 18700, 15200]];
    const PC = { OPEN: "green", CLOSED: "yellow", LOCKED: "" };
    return '<div class="a-page">' + head("Financial periods", "Accounting periods that records post to.", btn("New period", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Open", 2, "accepting records") + stat("Closed", 1, "Oct 2026, reopen possible") + stat("Locked", 3, "frozen") + stat("Fiscal year starts", "January", "LedgerSettings") + "</div>" +
      '<div class="toolbar">' + sel("Year 2026", "calendar") + sel("Type: all") + sel("Status: all", "filter") + '</div>' +
      tbl(["Period", "Type", "Status", "Dates", "Closed by", ">Income", ">Expenses", ">Net profit", ""], P.map((p) => [ink(p[0]), E(p[1]), E(p[2], PC[p[2]]), p[3], p[4], eur0(p[5]), eur0(p[6]), eur0(p[7], "pos"), p[2] === "OPEN" && p[1] === "MONTH" ? btn("Close", "lock", "sm") : p[2] === "CLOSED" ? btn("Lock", "lock", "sm") : more])) + sp() +
      '<div class="g2" style="align-items:start">' + cd("<b>Close Nov 2026 · checklist</b><span class='r muted'>shown in the Close dialog</span>", [["No draft or pending records", 0, "3 records pending approval"], ["All payroll entries posted", 0, "4 entries not posted"], ["Supplier imports resolved", 0, "2 to review"], ["Recurring expenses generated", 1, "6 of 6"], ["VAT report reviewed", 0, "Open the VAT report"]].map((r) => '<div class="rowx">' + cb(r[1]) + '<div class="grow"><b>' + r[0] + "</b><small>" + r[2] + "</small></div>" + (r[1] ? "" : btn("Fix", "", "sm")) + "</div>").join(""), 1) +
      cd("<b>Oct 2026 · stored summary</b><span class='r muted'>FinancialPeriodSummary · is_final</span>", '<div class="rowx" style="padding:0 0 8px">' + segs(["Accrual", "Cash"], "Accrual") + '</div><div class="ex-sum"><div><span>Total income</span>' + eur0(33200) + "</div><div><span>Total expenses</span>" + eur0(19000) + "</div><div><span>VAT collected / paid</span><span>€6,308 / €2,110</span></div><div class=\"tot\"><span>Net profit</span>" + eur0(14200, "pos") + '</div></div><div class="sub-note">Generated Nov 5, 06:00 · AI summary available. Reopening deletes nothing but marks the summary not final.</div>') + "</div>" +
      dm(["FinancialPeriod · type, name, fiscal_year, start_date, end_date, status, closed_by_membership_id, closed_at, locked_at, notes", "FinancialPeriodSummary · basis, scope_key, totals, is_final, generated_at", "LedgerSettings · fiscal_year_start_month · LedgerRecord.period_id · PayrollEntry.period_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     PROFIT & LOSS (spec "Profit & Loss")
     @screen Profit & loss
     @route  /finance/reports/profit-loss?period=&compare=&basis=&project=&customer=&category=&department=&type=
     @perm   VIEW finance.profit_loss.read* (sensitive) · export finance.income.export* AND finance.expenses.export*
     @api    GET /ledger/reports/profit-loss?from=&to=&basis=&project_id=&company_id=&category_id=&department_id=&compare=previous_period|previous_year · GET .../export?format=pdf|xlsx
     @mcp    finance_profit_loss_read
     @data   FinancialPeriodSummary.pl_lines (Json, per LedgerPlLine) for closed periods · LedgerRecord + LedgerCategory.pl_line (live) · LedgerCategory.is_operating · FinancialPeriod
     @ui     Table with expandable rows, Select/Popover+Command filters, ToggleGroup basis, Card, Button export
     @states loading · empty · error · no-access
     @audit  report exported
     @note   Each LedgerCategory maps to one LedgerPlLine; categories without a mapping fall into OTHER_OPERATING_EXPENSES and the screen warns. REVENUE = INCOME records. Lines: COST_OF_OPERATIONS, EMPLOYEE_EXPENSES, OFFICE_EXPENSES,
             SOFTWARE_EXPENSES, MARKETING_EXPENSES, PROFESSIONAL_EXPENSES, OTHER_OPERATING_EXPENSES. Net operating result = revenue - total expenses. Filters (spec): period, project, customer, category, department, expense type.
     ===================================================================================================================== */
  function pnl() {
    const L = [["REVENUE", 31840, 33200, 0], ["COST_OF_OPERATIONS", 2010, 2140, 1], ["EMPLOYEE_EXPENSES", 9600, 9600, 1], ["OFFICE_EXPENSES", 2190, 2190, 1], ["SOFTWARE_EXPENSES", 2560, 2480, 1], ["MARKETING_EXPENSES", 1650, 2420, 1], ["PROFESSIONAL_EXPENSES", 450, 450, 1], ["OTHER_OPERATING_EXPENSES", 1100, 1180, 1]];
    const sumE = L.slice(1).reduce((a, l) => a + l[1], 0), sumP = L.slice(1).reduce((a, l) => a + l[2], 0);
    const d = (a, b) => { const p = b ? Math.round((a - b) / b * 1000) / 10 : 0; return '<span class="' + (p > 0 === (a !== 0) ? "muted" : "") + '">' + (p > 0 ? "+" : "") + p + "%</span>"; };
    return '<div class="a-page">' + head("Profit & loss", "Automatically generated from posted records.", sel("Nov 2026", "calendar") + sel("Compare: Oct 2026") + btn("Export", "file", "primary")) +
      '<div class="toolbar">' + segs(["Accrual", "Cash"], "Accrual") + sel("Project…", "folder") + sel("Customer…", "building") + sel("Category…", "tag") + sel("Department…", "users") + sel("Expense type…") + "</div>" +
      '<div class="panel ex-pl" style="margin-top:0"><div class="row tot"><span>Line</span><span style="display:flex;gap:40px"><span>Nov 2026</span><span>Oct 2026</span><span>Change</span></span></div>' +
      L.map((l) => '<div class="row' + (l[3] ? " sub" : "") + '"><span>' + U.en(l[0]) + ' <small class="muted">' + l[0] + '</small></span><span style="display:flex;gap:40px"><b style="min-width:80px;text-align:right">' + eur0(l[1]) + '</b><b style="min-width:80px;text-align:right">' + eur0(l[2]) + '</b><span style="min-width:50px;text-align:right">' + d(l[1], l[2]) + "</span></span></div>").join("") +
      '<div class="row tot"><span>Total expenses</span><span style="display:flex;gap:40px"><b style="min-width:80px;text-align:right">' + eur0(sumE) + '</b><b style="min-width:80px;text-align:right">' + eur0(sumP) + '</b><span style="min-width:50px;text-align:right">' + d(sumE, sumP) + '</span></span></div><div class="row tot"><span>Net operating result</span><span style="display:flex;gap:40px"><b style="min-width:80px;text-align:right">' + eur0(31840 - sumE, "pos") + '</b><b style="min-width:80px;text-align:right">' + eur0(33200 - sumP, "pos") + '</b><span style="min-width:50px;text-align:right">' + d(31840 - sumE, 33200 - sumP) + "</span></span></div></div>" +
      '<div class="ex-note">2 categories have no P&L line mapping (Training, Government fees) and are counted under Other operating expenses. Map them in Categories &amp; methods.</div>' +
      '<div class="g2">' + cd("<b>Expense mix</b>", brow("Employee", "€9,600", 100, "blue") + brow("Cost of operations", "€2,010", 21, "purple") + brow("Software", "€2,560", 27, "yellow") + brow("Office", "€2,190", 23, "green") + brow("Marketing", "€1,650", 17)) + cd("<b>Explain the change</b><span class='r muted'>AI · never changes data</span>", "<p>Net operating result is €1,200 lower than October because Revenue fell 4.1% while Cost of operations stayed flat. Marketing cost dropped 32% after the Acme campaign ended.</p>" + btn("Ask a follow-up", "sparkles", "sm")) + "</div>" +
      dm(["FinancialPeriodSummary · pl_lines, basis, scope_key (project/company/branch)", "LedgerCategory · pl_line, is_operating · LedgerRecord (live) · Team (department filter)"], []) + "</div>";
  }

  /* =====================================================================================================================
     VAT REPORT (spec "VAT Management")
     @screen VAT
     @route  /finance/vat?period=&basis=&group=rate|category|counterparty
     @perm   VIEW finance.vat.read · manage VAT rates/overrides and mark a return as filed finance.vat.manage* · export finance.income.export* / finance.expenses.export*
     @api    GET /ledger/reports/vat?from=&to=&group_by= · GET .../export?format=csv
     @mcp    finance_vat_read
     @data   VatReturn (period_id, basis, currency, vat_collected, vat_paid, net_vat, status DRAFT | FILED | PAID, filed_at, filed_by_membership_id, authority_reference, paid_at, document_id) · FinancialPeriodSummary (vat_collected, vat_paid, net_vat, vat_breakdown Json) · LedgerRecord (vat_percent, vat_amount, vat_treatment, tax_rate_id, category_id, company_id) · TaxRate (08, custom rates) · LedgerSettings (default tax rates, default_pricing_mode)
     @ui     Tabs (by rate / category / customer-supplier / treatments), Table, Card, ToggleGroup, Alert
     @states loading · empty · error · no-access
     @audit  VAT export, rate override on a record (amounts_overridden)
     @note   VAT collected = vat_amount of INCOME records, VAT paid = vat_amount of EXPENSE records, Net VAT = collected - paid (positive = payable). REVERSE_CHARGE records carry 0 VAT but are listed in their own block for the return;
             EXEMPT, ZERO_RATED and OUT_OF_SCOPE are separate rows. Cash basis counts VAT at the payment date. The module reports VAT and records the filing as a VatReturn (frozen totals, status, authority_reference, proof); it does not submit to the tax authority (no filing integration).
     ===================================================================================================================== */
  function vat() {
    return '<div class="a-page">' + head("VAT", "Collected, paid and the net position.", sel("Q4 2026 (Oct – Dec)", "calendar") + btn("Export", "file", "primary")) +
      '<div class="toolbar">' + segs(["Accrual", "Cash"], "Accrual") + sel("Branch: all", "building") + "</div>" +
      '<div class="mini-stats">' + stat("VAT collected", "€12,358", "on income") + stat("VAT paid", "€4,170", "on expenses") + stat("Net VAT", "€8,188", "payable") + stat("Reverse charge base", "€5,512", "expenses, 0% VAT") + stat("Exempt / out of scope", "€10,438", "") + "</div>" +
      cd("<b>VAT return · Q4 2026</b><span class='r muted'>VatReturn · DRAFT</span>", '<div class="rowx"><div class="grow"><b>Not filed yet</b><small>Needs a CLOSED period · after filing: filed_at, authority_reference, proof document</small></div>' + btn("Mark as filed", "check", "sm primary") + "</div>") + sp(8) +
      '<div class="tabset">' + tabs([["r", "By rate"], ["c", "By category"], ["p", "By customer or supplier"], ["t", "Treatments"]], "r") +
      pane("r", 1, tbl(["VAT rate", "Treatment", ">Income net", ">VAT collected", ">Expense net", ">VAT paid", ">Net VAT"], [["19%", E("STANDARD"), eur0(65047), eur0(12358), eur0(21950), eur0(4170), eur0(8188, "neg")], ["9%", E("REDUCED"), eur0(0), eur0(0), eur0(640), eur0(58), eur0(-58)], ["0%", E("ZERO_RATED"), eur0(2400), eur0(0), eur0(0), eur0(0), eur0(0)], ["0%", E("REVERSE_CHARGE"), eur0(0), eur0(0), eur0(5512), eur0(0), eur0(0)], ["—", E("EXEMPT"), eur0(0), eur0(0), eur0(1220), eur0(0), eur0(0)], ["—", E("OUT_OF_SCOPE"), eur0(0), eur0(0), eur0(14400), eur0(0), eur0(0)]]) + '<div class="sub-note" style="margin-top:8px">Source: FinancialPeriodSummary.vat_breakdown. The sample row figures are illustrative.</div>') +
      pane("c", 0, tbl(["Category", ">Net", ">VAT", ">Records"], [["Software development", eur0(36100), eur0(6859), 9], ["Consulting", eur0(22900), eur0(4351), 6], ["Office / Rent", eur0(7200), eur0(1368), 3], ["Equipment", eur0(2399), eur0(456), 1], ["Professional services", eur0(1350), eur0(257), 1]])) +
      pane("p", 0, tbl(["Customer or supplier", "Side", ">Net", ">VAT"], [["Acme Corp", E("INCOME", "green"), eur0(30200), eur0(5738)], ["Globex", E("INCOME", "green"), eur0(14600), eur0(2774)], ["Skyline Properties Ltd", E("EXPENSE"), eur0(7200), eur0(1368)], ["Leaseplan", E("EXPENSE"), eur0(1167), eur0(222)]])) +
      pane("t", 0, '<div class="g2">' + cd("<b>Reverse charge purchases</b>", tbl(["Supplier", ">Net", "Country"], [["Hetzner Online GmbH", eur0(2530), "DE"], ["Google Ireland Ltd", eur0(1650), "IE"], ["Figma Inc.", eur0(540), "US"]]), 1) + cd("<b>Needs attention</b>", '<div class="rowx"><div class="grow"><b>2 records with a manual VAT override</b><small>amounts_overridden · audited</small></div>' + btn("View", "", "sm") + '</div><div class="rowx"><div class="grow"><b>1 record without VAT treatment match</b><small>VAT 19% on a vendor flagged reverse charge</small></div>' + btn("View", "", "sm") + "</div>", 1) + "</div>") + "</div>" +
      dm(["FinancialPeriodSummary · vat_collected, vat_paid, net_vat, vat_breakdown", "LedgerRecord · vat_percent, vat_amount, vat_treatment, tax_rate_id, category_id, company_id, amounts_overridden", "TaxRate (08) · LedgerSettings · default_income_tax_rate_id, default_expense_tax_rate_id", "VatReturn · period_id, basis, vat_collected, vat_paid, net_vat, status, filed_at, filed_by_membership_id, authority_reference, paid_at, document_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     REPORTS (spec "Financial Dashboard", "Search & Filtering", "AI Financial Assistant: generating financial reports")
     @screen Reports
     @route  /finance/reports?report=aging-receivables|aging-payables|supplier-spend|category-trend|cash-flow|payroll-cost
     @perm   per report: receivables finance.income.read, payables and supplier spend finance.expenses.read, cash flow both, payroll cost finance.payroll.read*, P&L finance.profit_loss.read*, profitability finance.profitability.read* · export .export* and finance.reports.export* · schedule finance.reports.manage
     @api    GET /ledger/reports/:report?from=&to=&basis=&group_by= · GET /ledger/reports/:report/export?format=csv|xlsx|pdf
     @mcp    finance_reports_read · finance_reports_export (sensitive)
     @data   LedgerRecord (payment_status, due_date, amount_remaining, company_id, category_id) · LedgerSettlement (cash) · FinancialPeriodSummary (trend, *_by_category) · LedgerCategory
     @ui     Report list (Card grid), Table, Select, DateRangePicker, ToggleGroup, Button export, Dialog for "Ask AI to build a report"
     @states loading · empty · error · no-access (report card hidden)
     @audit  report exported (name, filters)
     @note   Reports are computed views, not stored, except period summaries. Aging buckets use due_date vs today on amount_remaining. A custom AI-generated report is a saved filter + grouping (SavedView), never new data. Scheduled
             delivery of reports by email is FinanceReportSchedule (08: report_key, filters, format, frequency, recipients; run by 20, sent by 11); the monthly summary is the automation job generating FinancialPeriodSummary.
     ===================================================================================================================== */
  function reports() {
    const cat = [["P&L", "Profit & loss", "Revenue, costs and result", "chart"], ["V", "VAT", "Collected, paid, net", "receipt"], ["R", "Receivables aging", "Who owes what and since when", "inbox"], ["P", "Payables aging", "What you owe suppliers", "inbox"], ["S", "Spend by supplier", "Top suppliers and trend", "building"], ["C", "Category trend", "Monthly spend per category", "chart"], ["F", "Cash flow", "Received versus paid", "dollar"], ["PC", "Payroll cost", "By employee and department", "users"]];
    return '<div class="a-page">' + head("Reports", "Standard reports on the ledger.", btn("Ask AI for a report", "sparkles") + btn("Export", "file", "primary")) +
      '<div class="g3" style="grid-template-columns:repeat(4,1fr)">' + cat.map((c, i) => '<div class="cd"><div class="cd-b" style="padding:12px"><div style="display:flex;gap:8px;align-items:center;color:var(--ink);font-weight:500">' + I(c[3], 15) + c[1] + "</div><small class=\"muted\">" + c[2] + "</small></div></div>").join("") + "</div>" + sp(4) +
      cd("<b>Receivables aging</b><span class='r muted'>amount_remaining by due_date · today Nov 11</span>", '<div class="toolbar" style="padding:10px">' + sel("Customer: all", "building") + sel("Project: all", "folder") + segs(["Invoiced", "Cash"], "Invoiced") + "</div>" + tbl(["Customer", ">Current", ">1–30 days", ">31–60", ">61–90", ">90+", ">Total"], [["Acme Corp", eur0(7140), eur0(0), eur0(0), eur0(0), eur0(0), eur0(7140)], ["Initech", eur0(0), eur0(9758), eur0(0), eur0(0), eur0(0), eur0(9758)], ["Globex", eur0(18400), eur0(0), eur0(0), eur0(0), eur0(0), eur0(18400)], ["Northwind", eur0(0), eur0(0), eur0(0), eur0(0), eur0(0), eur0(0)], ['<b>Total</b>', eur0(25540), eur0(9758), eur0(0), eur0(0), eur0(0), '<b>' + eur0(35298) + "</b>"]]), 1) + sp() +
      '<div class="g2">' + cd("<b>Top suppliers · last 12 months</b>", brow("Skyline Properties", "€28,800", 100, "blue") + brow("Hetzner Online", "€9,420", 33) + brow("Google Ireland", "€8,350", 29) + brow("Kyriakou & Partners", "€5,400", 19) + brow("Leaseplan", "€5,554", 19)) + cd("<b>Scheduled delivery</b><span class='r muted'>FinanceReportSchedule</span>", '<div class="rowx"><div class="grow"><b>Monthly summary to administrators</b><small>Generated on the 1st (automation) and sent via Notifications (14)</small></div>' + sw(1) + '</div><div class="rowx"><div class="grow"><b>Email P&L to the accountant</b><small>FinanceReportSchedule · frequency MONTH · format PDF · recipient_emails</small></div>' + sw(0) + "</div>", 1) + "</div>" +
      dm(["LedgerRecord · payment_status, due_date, amount_remaining, company_id, category_id", "LedgerSettlement · settled_on, amount (cash)", "FinancialPeriodSummary · trend, income_by_category, expenses_by_category", "FinanceReportSchedule (08) · name, report_key, filters, basis, format, frequency, send_day, recipient_membership_ids, recipient_emails, enabled, next_run_at, last_run_at"], []) + "</div>";
  }

  /* =====================================================================================================================
     PAYROLL & EMPLOYEE COSTS, incl. REIMBURSEMENTS (spec "Employee Payments & Payroll Expenses")
     @screen Payroll
     @route  /finance/payroll?tab=entries|schedules|reimbursements&period=
     @perm   VIEW finance.payroll.read* (sensitive; the whole screen is hidden without it) · create/approve/post/cancel and schedules finance.payroll.manage* · compensation terms are NOT edited here (10 owns them)
     @api    GET /ledger/payroll/entries?period_id=&kind=&status= · POST /ledger/payroll/entries · POST /ledger/payroll/entries/:id/approve | /post | /cancel · GET/POST/PATCH /ledger/payroll/schedules · POST /ledger/payroll/generate {period_id}
     @mcp    finance_payroll_read · finance_payroll_manage (both sensitive)
     @data   PayrollEntry (employee_id, employee_name_snapshot, department_id, schedule_id, period_id, period_start, period_end, kind, status, currency, base_amount, employer_cost_amount, total_amount, hours, hourly_rate, breakdown Json, description,
             payment_date, payment_method_id, document_id, ledger_record_id, approved_by_membership_id, approved_at, posted_at, cancelled_at) · PayrollSchedule (employee_id, kind, category_id, payment_method_id, base_amount, employer_cost_amount,
             interval, interval_count, payment_day, start_date, end_date, next_occurrence_date, auto_generate, status) · LedgerRecord (the posted expense, source PAYROLL) · Read-only: Employee compensation (10)
     @ui     Tabs, Table with period Select, Dialog/Form for new entry, Badge, DropdownMenu, Progress for "posted this month"
     @states loading · empty · error · no-access (screen not listed) · period locked (cannot post)
     @audit  payroll.entry.created / approved / posted / cancelled, schedule changed
     @note   Status flow DRAFT -> APPROVED -> POSTED (posting creates the linked expense LedgerRecord with the sum base + employer cost, kind of category Employees) | CANCELLED. base_amount is the employee payment, employer_cost_amount the
             employer-side cost; both feed total_amount. A monthly PayrollSchedule generates DRAFT entries (auto_generate) so nobody retypes salaries. REIMBURSEMENT entries (kind REIMBURSEMENT) are employee-expense payouts created when an ExpenseClaim (employee submits receipts as ExpenseClaimLine, manager approves via FinanceApproval, claim.payroll_entry_id) is approved; employees use
             finance.expense_claims.create_own / read_own, managers finance.expense_claims.approve*, HR/finance finance.expense_claims.read*. Hourly entries use hours x hourly_rate and can link approved time (18).
     ===================================================================================================================== */
  function payroll() {
    const ST = { DRAFT: "", APPROVED: "blue", POSTED: "green", CANCELLED: "red" };
    const E1 = [["MS", "SALARY", "DRAFT", 4800, 980, "Engineering"], ["SJ", "SALARY", "APPROVED", 3900, 800, "Design"], ["AM", "SALARY", "POSTED", 5200, 1060, "Management"], ["JK", "BONUS", "DRAFT", 600, 0, "Engineering"], ["KL", "REIMBURSEMENT", "DRAFT", 128.4, 0, "Operations"], ["JK", "HOURLY_PAYMENT", "POSTED", 2240, 450, "Engineering"], ["SJ", "OVERTIME", "POSTED", 310, 60, "Design"], ["AM", "BENEFIT", "POSTED", 150, 0, "Management"]];
    const rowsE = E1.map((e) => [wh(e[0], e[5]), E(e[1]), "Nov 1 – Nov 30", E(e[2], ST[e[2]]), eur(e[3]), eur(e[4]), eur(e[3] + e[4]), e[2] === "POSTED" ? '<span class="muted">LED-2026-04xx</span>' : "—", e[2] === "DRAFT" ? btn("Approve", "", "sm") : e[2] === "APPROVED" ? btn("Post", "", "sm primary") : more]);
    return '<div class="a-page">' + head("Payroll & employee costs", "Employee payments recorded as expenses. Compensation terms live in Employees (10).", sel("Nov 2026", "calendar") + btn("Generate from schedules", "zap") + btn("New entry", "plus", "primary")) +
      '<div class="mini-stats">' + stat("Total cost (Nov)", "€20,578", "base + employer") + stat("Base payments", "€17,128", "") + stat("Employer costs", "€3,350", "") + stat("To approve", 3, "drafts") + stat("Posted", 4, "of 8 entries") + "</div>" +
      '<div class="tabset">' + tabs([["e", "Entries", 8], ["s", "Schedules", 5], ["r", "Reimbursements", 1]], "e") +
      '<div class="toolbar" style="margin-top:10px">' + search("Search employee") + sel("Kind: all") + sel("Status: all", "filter") + sel("Department…", "users") + "</div>" +
      pane("e", 1, '<div class="bulk"><span class="cb on"></span><b>2 selected</b><span style="flex:1"></span>' + btn("Approve", "check", "sm") + btn("Post to ledger", "send", "sm") + btn("Cancel", "x", "sm") + "</div>" + tbl(["Employee", "Kind", "Period", "Status", ">Base", ">Employer cost", ">Total", "Ledger record", ""], rowsE)) +
      pane("s", 0, tbl(["Employee", "Kind", "Category", ">Base", ">Employer cost", "Schedule", "Next entry", "Auto", "Status", ""], [["MS", "SALARY", "Employees", 4800, 980, "Monthly · day 28", "Nov 28"], ["SJ", "SALARY", "Employees", 3900, 800, "Monthly · day 28", "Nov 28"], ["AM", "SALARY", "Employees", 5200, 1060, "Monthly · day 28", "Nov 28"], ["JK", "HOURLY_PAYMENT", "Employees", 0, 0, "Monthly · from time", "Nov 30"], ["KL", "SALARY", "Employees", 3400, 700, "Monthly · day 28", "Nov 28"]].map((s) => [wh(s[0]), E(s[1]), s[2], eur(s[3]), eur(s[4]), s[5], s[6], sw(1), E("ACTIVE", "green"), more]))) +
      pane("r", 0, tbl(["Claim", "Employee", "Title", ">Total", "Receipts", "Status", "Payroll entry", ""], [[ink("EXC-2026-0014"), wh("KL"), "Train tickets Globex workshop and lunch", eur(128.4), bd("2 linked", "green") + " " + muted("ExpenseClaimLine.document_id"), E("APPROVED", "blue"), muted("REIMBURSEMENT · DRAFT"), btn("Open", "", "sm")], [ink("EXC-2026-0015"), wh("JK"), "Client dinner Acme", eur(86), bd("1 linked", "green"), E("SUBMITTED", "yellow"), "—", btn("Approve", "", "sm primary")]]) + '<div class="ex-note">ExpenseClaim (DRAFT, SUBMITTED, APPROVED, REJECTED, PAID). Approval creates the REIMBURSEMENT payroll entry; employees submit from self-service (10).</div>') + "</div>" +
      dm(["PayrollEntry · employee_id, employee_name_snapshot, kind, status, period_start, period_end, base_amount, employer_cost_amount, total_amount, hours, hourly_rate, breakdown, ledger_record_id, approved_by_membership_id, posted_at", "PayrollSchedule · employee_id, kind, base_amount, employer_cost_amount, interval, interval_count, payment_day, next_occurrence_date, auto_generate, status", "LedgerRecord (source PAYROLL) · Employee compensation (10, read-only)", "ExpenseClaim · number, employee_id, title, status, currency, total_amount, vat_total, submitted_at, approver_membership_id, decided_by_membership_id, decided_at, rejection_reason, paid_at, payroll_entry_id", "ExpenseClaimLine · claim_id, expense_date, category_id, project_id, description, merchant, gross_amount, vat_amount, document_id"], []) + "</div>";
  }

  /* =====================================================================================================================
     PAYROLL ENTRY — create (spec "Employee Payments & Payroll Expenses")
     @screen New payroll entry
     @route  /finance/payroll/new?employee=&period=
     @perm   finance.payroll.manage* (sensitive) · picking the employee needs the employee read scope (10)
     @api    POST /ledger/payroll/entries {employee_id, department_id?, period_id, period_start, period_end, kind, currency, base_amount, employer_cost_amount, hours?, hourly_rate?, breakdown?, description, payment_date?, payment_method_id?, document_id?, notes}
     @mcp    finance_payroll_manage (sensitive)
     @data   PayrollEntry (every column written on create; status DRAFT) · PayrollSchedule (optional "Repeat monthly") · Employee (10, read-only)
     @ui     Form, Popover+Command (employee), Select (kind, period), DatePicker, Input number, file Dropzone (payslip, 17), Switch
     @states validation inline · saving · saved toast · period closed error · permission error
     @audit  payroll.entry.created
     @note   Prefills from the employee's compensation (10) and the schedule if any; the amounts can be overridden for this entry only. The breakdown Json lists pay components (base, overtime, benefits). Hourly kind computes
             base_amount = hours x hourly_rate. Posting later creates the expense record.
     ===================================================================================================================== */
  function payrollNew() {
    return '<div class="a-page">' + head("New payroll entry", "Employee payment or cost for an accounting period.", btn("Cancel") + btn("Save draft") + btn("Save and approve", "check", "primary")) +
      '<div class="g2" style="grid-template-columns:1.6fr 1fr;align-items:start"><div>' +
      cd("<b>Who and what</b>", row2(f("Employee", sel("Marco Silva", "users"), "Name is stored as employee_name_snapshot so history stays readable."), f("Department", sel("Engineering", "users"))) + f("Kind", '<div class="ex-seg">' + ["SALARY", "MONTHLY_PAYMENT", "HOURLY_PAYMENT", "BONUS", "COMMISSION", "OVERTIME", "EMPLOYER_COST", "BENEFIT", "REIMBURSEMENT", "OTHER"].map((k, i) => '<span class="seg' + (i === 0 ? " on" : "") + '" title="' + k + '">' + U.en(k) + "</span>").join("") + "</div>") + f("Description", val("Salary November 2026"))) + sp() +
      cd("<b>Period</b>", row2(f("Financial period", sel("Nov 2026 · open", "calendar")), f("Payment date", sel("Nov 28, 2026", "calendar"))) + row2(f("Period start", sel("Nov 1, 2026", "calendar")), f("Period end", sel("Nov 30, 2026", "calendar")))) + sp() +
      cd("<b>Amounts</b><span class='r muted'>total = base + employer cost</span>", row2(f("Base payment", val("4,800.00"), "The employee's own payment."), f("Employer costs", val("980.00"), "Social contributions and other costs the employer bears.")) + row2(f("Hours", box("Hourly kind only")), f("Hourly rate", box("Hourly kind only"))) + f("Currency", sel("EUR")) + '<div class="ex-sum"><div><span>Base</span>' + eur(4800) + "</div><div><span>Employer cost</span>" + eur(980) + '</div><div class="tot"><span>Total expense</span>' + eur(5780) + "</div></div>") + sp() +
      cd("<b>Breakdown</b><span class='r'>" + btn("Add component", "plus", "sm") + "</span>", tbl(["Component", ">Amount"], [["Base salary", eur(4800)], ["Employer social contributions", eur(780)], ["Employer pension", eur(200)]]), 1) +
      "</div><div>" +
      cd("<b>Payment</b>", f("Payment method", sel("Bank account", "dollar")) + f("Payslip document", '<div class="drop" style="margin:0">' + I("clip", 16) + " Attach payslip (17)</div>") + f("Notes", box("Internal note"))) + sp() +
      cd("<b>Repeat</b>", '<div class="rowx"><div class="grow"><b>Monthly schedule</b><small>Creates a PayrollSchedule that generates drafts</small></div>' + sw(1) + "</div>" + f("Day of month", val("28")) + f("Until", sel("No end", "calendar"))) + sp() +
      callout("lock", "Compensation terms are read from Employees (10). This entry never edits them.", "") + "</div></div>" +
      dm(["PayrollEntry · every column written on create", "PayrollSchedule · when Repeat is on", "Employee compensation (10, read-only) · FinancialPeriod · LedgerPaymentMethod · Document (17)"], []) + "</div>";
  }

  /* =====================================================================================================================
     CATEGORIES & PAYMENT METHODS (spec "Financial Categories")
     @screen Categories & methods
     @route  /finance/settings/categories?tab=categories|methods|vat
     @perm   VIEW finance.categories.manage (read of categories for pickers comes with finance.expenses.read / finance.income.read) · create/edit/archive finance.categories.manage · VAT classifications list is read-only here (rates are owned by 08)
     @api    GET/POST/PATCH /ledger/categories · POST /ledger/categories/:id/archive · POST /ledger/categories/reorder · GET/POST/PATCH /ledger/payment-methods
     @mcp    finance_categories_manage
     @data   LedgerCategory (parent_category_id, kind, name, slug, description, color, icon, system_key, pl_line, default_tax_rate_id, default_vat_treatment, is_operating, sort_order, archived_at) · LedgerPaymentMethod (name, slug, type, details Json, is_default,
             sort_order, archived_at, provider_connections) · TaxRate (08) · LedgerVatTreatment (enum)
     @ui     Tree with drag reorder (dnd-kit), Sheet/Dialog for edit, Popover+Command (parent, tax rate), Input color token, Switch, Tabs
     @states loading · empty · error · no-access · "in use" confirmation when archiving (records keep the snapshot)
     @audit  category created/renamed/archived/moved, payment method changed
     @note   Two roots (kind INCOME / EXPENSE) with subcategories through parent_category_id. system_key marks seeded defaults (cannot be deleted, can be renamed or archived). Archiving hides a category from pickers but old records keep
             category_path_snapshot. Each category maps to a P&L line (pl_line) and an is_operating flag for the dashboard. Custom VAT classifications = a LedgerVatTreatment plus a TaxRate (08); payment methods are classified by PaymentMethodType and
             may be tied to a provider connection (Stripe, Viva Wallet via IntegrationConnection).
     ===================================================================================================================== */
  function categories() {
    const rw = (cls, color, name, kind, pl, tax, n, sys) => '<div class="row ' + cls + '"><span class="dot" style="background:var(--' + color + ')"></span><b style="color:var(--ink)">' + name + "</b>" + (sys ? bd("Seeded") : "") + '<span class="sp"></span><span class="muted">' + pl + '</span><span class="muted" style="min-width:90px;text-align:right">' + tax + '</span><span class="muted" style="min-width:50px;text-align:right">' + n + " rec.</span>" + more + "</div>";
    return '<div class="a-page">' + head("Categories & methods", "How income and expenses are organized.", btn("New category", "plus", "primary")) +
      '<div class="tabset">' + tabs([["c", "Categories"], ["m", "Payment methods", 6], ["v", "VAT classifications"]], "c") +
      pane("c", 1, '<div class="g2" style="grid-template-columns:1.5fr 1fr;align-items:start"><div class="panel ex-tree" style="margin-top:0"><div class="row"><b style="color:var(--ink)">Income</b>' + E("INCOME", "green") + '<span class="sp"></span><span class="muted">P&amp;L line</span><span class="muted" style="min-width:90px;text-align:right">Default VAT</span><span style="min-width:50px"></span><span style="width:30px"></span></div>' +
        [["Software development", "blue", "Revenue", "19%", 31], ["Maintenance", "green", "Revenue", "19%", 22], ["Support", "purple", "Revenue", "19%", 14], ["Consulting", "yellow", "Revenue", "19%", 18], ["Subscriptions", "blue", "Revenue", "19%", 40], ["Other income", "ash", "Revenue", "19%", 3]].map((c) => rw("l1", c[1], c[0], "INCOME", c[2], c[3], c[4], 1)).join("") +
        '<div class="row"><b style="color:var(--ink)">Expenses</b>' + E("EXPENSE") + '<span class="sp"></span></div>' +
        rw("l1", "blue", "Employees", "", "Employee expenses", "—", 56, 1) + rw("l1", "purple", "Office", "", "Office expenses", "19%", 38, 1) + rw("l2", "purple", "Rent", "", "Office expenses", "19%", 12) + rw("l2", "purple", "Electricity", "", "Office expenses", "19%", 12) + rw("l2", "purple", "Water", "", "Office expenses", "19%", 6) + rw("l2", "purple", "Internet", "", "Office expenses", "19%", 8) +
        rw("l1", "yellow", "Software", "", "Software expenses", "Reverse charge", 44, 1) + rw("l1", "green", "Hosting", "", "Cost of operations", "Reverse charge", 24) + rw("l1", "red", "Marketing", "", "Marketing expenses", "Reverse charge", 19) + rw("l1", "ash", "Equipment", "", "Other operating", "19%", 7) + rw("l1", "blue", "Professional services", "", "Professional expenses", "19%", 10) + rw("l1", "ash", "Other expenses", "", "Other operating", "—", 15, 1) + "</div>" +
        '<div>' + cd("<b>Edit category · Hosting</b>", f("Name", val("Hosting")) + f("Kind", segs(["Expense", "Income"], "Expense")) + f("Parent", sel("— (top level)")) + f("Description", box("Cloud, servers, domains")) + row2(f("P&L line", sel("Cost of operations")), f("Operating", sw(1))) + row2(f("Default VAT rate", sel("0% reverse charge")), f("Default VAT treatment", sel("Reverse charge"))) + row2(f("Colour", tok("green")), f("Icon", tok("layers"))) + '<div class="rowx" style="padding:0">' + btn("Save", "check", "primary") + btn("Archive", "box") + '</div><div class="sub-note">Slug hosting · system key none. Renaming never changes existing records (they keep their snapshot).</div>') + "</div></div>") +
      pane("m", 0, tbl(["Method", "Type", "Details", "Provider connection", "Default", "Records", ""], [["Bank account · Eurobank", E("BANK_TRANSFER"), "IBAN ···0130", "—", sw(1), 118, more], ["Company card · Visa 4412", E("CARD"), "Visa ···4412", "—", sw(0), 64, more], ["Cash", E("CASH"), "Petty cash", "—", sw(0), 9, more], ["Stripe", E("WALLET"), "Payouts to Eurobank", "Stripe · connected", sw(0), 41, more], ["Viva Wallet", E("WALLET"), "—", "Viva Wallet · connected", sw(0), 6, more], ["SEPA direct debit", E("SEPA_DEBIT"), "Mandates", "—", sw(0), 12, more]])) +
      pane("v", 0, tbl(["Classification", "Treatment", "Rates", "Source"], [["Standard", E("STANDARD"), "19%", "TaxRate (08)"], ["Reduced", E("REDUCED"), "9%, 5%", "TaxRate (08)"], ["Zero rated", E("ZERO_RATED"), "0%", "TaxRate (08)"], ["Exempt", E("EXEMPT"), "—", "built in"], ["Reverse charge", E("REVERSE_CHARGE"), "0% + self-assessment", "built in"], ["Out of scope", E("OUT_OF_SCOPE"), "—", "built in"]]) + '<div class="sub-note" style="margin-top:8px">VAT rates are managed in Billing (08, Tax / VAT). Add a custom rate there and it appears in every VAT picker here.</div>') + "</div>" +
      dm(["LedgerCategory · parent_category_id, kind, name, slug, description, color, icon, system_key, pl_line, default_tax_rate_id, default_vat_treatment, is_operating, sort_order, archived_at", "LedgerPaymentMethod · name, slug, type, details, is_default, sort_order, archived_at, provider_connections", "TaxRate (08) · LedgerVatTreatment"], []) + "</div>";
  }

  /* =====================================================================================================================
     LEDGER SETTINGS (spec "VAT Management", "Automation", "AI Financial Assistant", "Audit Trail", "Financial Periods")
     @screen Ledger settings
     @route  /finance/settings?tab=general|automation|ai
     @perm   finance.ledger_settings.manage* (sensitive) · read-only view for callers with finance.income.read / finance.expenses.read
     @api    GET/PATCH /ledger/settings
     @mcp    finance_ledger_settings_manage (sensitive)
     @data   LedgerSettings (reporting_currency, default_income_tax_rate_id, default_expense_tax_rate_id, default_pricing_mode, fiscal_year_start_month, approval_threshold_amount, require_approval_for_imports, auto_sync_invoices, auto_sync_payments,
             auto_sync_subscriptions, auto_categorize_suppliers, duplicate_detection_enabled, upcoming_expense_reminder_days, overdue_check_enabled, monthly_summary_enabled, ai_enabled, ai_auto_categorize, updated_at) · TaxRate (08) ·
             IntegrationConnection OPENAI (ai_enabled needs the organization's own key, BYOK)
     @ui     Tabs, Form with Switch, Select, Input number, Popover+Command for tax rates, Alert, Save bar
     @states loading · saving · saved toast · permission error · AI toggle disabled with reason when no OpenAI connection exists
     @audit  every settings change (before/after) · sensitive
     @note   One row per organization. Changing the reporting currency does not rewrite old reporting_gross_amount values; a "Recalculate reporting amounts" job exists. The approval threshold applies to POSTING an expense; 0 or empty means no approval
             needed. Turning off auto_sync_* stops creating income from 08 (existing records stay). AI never posts or changes a record on its own: it only creates ai_suggestions and LedgerInsight rows that a person accepts.
     ===================================================================================================================== */
  function settings() {
    const row = (t, s, on) => '<div class="rowx"><div class="grow"><b>' + t + "</b><small>" + s + "</small></div>" + sw(on) + "</div>";
    return '<div class="a-page">' + head("Ledger settings", "Defaults and automation for the whole organization.", btn("Discard") + btn("Save changes", "check", "primary")) +
      '<div class="tabset">' + tabs([["g", "General"], ["a", "Automation"], ["i", "AI assistant"]], "g") +
      pane("g", 1, '<div class="g2" style="align-items:start">' + cd("<b>Currency & VAT</b>", f("Reporting currency", sel("EUR · Euro", "dollar"), "Foreign amounts are converted with the record's fx_rate.") + f("Default income VAT rate", sel("Standard 19%", "tag")) + f("Default expense VAT rate", sel("Standard 19%", "tag")) + f("Default pricing mode", segs(["Exclusive", "Inclusive"], "Exclusive"), "TaxBehavior: do users type net or gross by default?") + f("Fiscal year starts in", sel("January", "calendar"))) +
        cd("<b>Approval</b>", f("Approval threshold (gross)", val("1,000.00"), "Expenses above this amount are posted only after another person approves. Empty = no approval needed.") + row("Require review of supplier imports", "Every approved import goes to PENDING_REVIEW first", 1) + '<div class="sub-note">Separation of duties (01): the creator never approves their own record. This cannot be turned off.</div>') + "</div>") +
      pane("a", 0, '<div class="g2" style="align-items:start">' + cd("<b>Sync from Billing (08)</b>", row("Sync invoices", "Every issued invoice creates an income record", 1) + row("Sync payments", "Payments (Stripe, Viva Wallet, bank) create settlements", 1) + row("Sync subscriptions", "Subscription revenue creates records", 1), 1) +
        cd("<b>Jobs (20)</b>", row("Auto-categorize known suppliers", "Uses supplier profiles and aliases", 1) + row("Detect duplicate invoices", "File hash and supplier + number + gross", 1) + row("Flag overdue payments", "Daily job sets payment_status OVERDUE", 1) + row("Monthly financial summary", "Generates FinancialPeriodSummary on the 1st", 1) + f("Remind before due", row2(val("3"), sel("days before")), "upcoming_expense_reminder_days · via Notifications (14)."), 1) + "</div>") +
      pane("i", 0, '<div class="g2" style="align-items:start">' + cd("<b>AI assistant</b>", callout("check", "OpenAI is connected for this organization (Settings, Integrations). Invoice reading and insights use your key and bill your account.", "") + row("Enable AI assistant", "Insights, summaries, invoice reading", 1) + row("Suggest categories automatically", "Stored as suggestions on the record, never applied silently", 1), 1) + cd("<b>What AI may do</b>", '<div class="rowx"><div class="grow">Read invoices, suggest categories, flag unusual or duplicate items, summarize months, answer questions.</div></div><div class="rowx"><div class="grow"><b>Never</b><small>Post, approve, delete or edit a record, or pay anything.</small></div></div>', 1) + "</div>") + "</div>" +
      dm(["LedgerSettings · all columns above", "TaxRate (08) · IntegrationConnection provider OPENAI"], []) + "</div>";
  }

  /* =====================================================================================================================
     AI INSIGHTS (spec "AI Financial Assistant")
     @screen Insights
     @route  /finance/insights?status=OPEN&kind=
     @perm   VIEW finance.expenses.read or finance.income.read (an insight on a record respects that record's type key; forecasts need finance.profit_loss.read*) · accept/dismiss finance.expenses.update / finance.income.update · requires LedgerSettings.ai_enabled
     @api    GET /ledger/insights?status=&kind= · POST /ledger/insights/:id/accept | /dismiss · POST /ledger/ask {question} (read-only Q&A over ledger data)
     @mcp    finance_insights_read · finance_ledger_ask
     @data   LedgerInsight (kind, status, confidence, severity, title, body, record_id, data Json, period_id, resolved_by_membership_id, resolved_at, expires_at) · LedgerRecord.ai_suggestions · LedgerRecord.flagged_unusual · FinancialPeriodSummary.ai_summary
     @ui     Card list with severity Badge, Tabs by kind, Button accept/dismiss, Command-style "Ask" input, Alert when AI is off
     @states loading · empty ("No open insights") · error · AI disabled (explains and links to settings) · no-access
     @audit  insight accepted/dismissed (who); accepting a category suggestion writes ledger.record.updated
     @note   Kinds: UNUSUAL_EXPENSE, DUPLICATE_SUSPECTED, MISSING_RECORD (a recurring cost did not arrive), CATEGORY_SUGGESTION, RECURRING_COST_DETECTED, FORECAST, MONTHLY_SUMMARY, OTHER. ACCEPTED applies the suggestion through the normal
             record update path (permissions and audit apply); DISMISSED hides it until expires_at. Answers cite the records they used.
     ===================================================================================================================== */
  function insights() {
    const I1 = [["UNUSUAL_EXPENSE", "OPEN", "high", "Google Ads is 38% above its 6-month average", "LED-2026-0403 · €1,650 vs avg €1,196. Campaign for Acme Rebrand started Oct 12.", 94], ["DUPLICATE_SUSPECTED", "OPEN", "medium", "Possible duplicate: Google Ireland GA-INV-88213", "Uploaded twice (Oct 26 and Oct 28). The second import was marked duplicate.", 88], ["MISSING_RECORD", "OPEN", "medium", "No electricity bill recorded for October", "Recorded every month since Jan 2026 (avg €214).", 81], ["CATEGORY_SUGGESTION", "OPEN", "low", "Categorize “Staples Hellas” as Office supplies", "Seen on 3 records without category.", 76], ["RECURRING_COST_DETECTED", "OPEN", "low", "Looks recurring: Notion team plan €96 monthly", "5 consecutive monthly records, same supplier and amount.", 90], ["FORECAST", "ACCEPTED", "low", "Recurring expenses next quarter: €15,640", "Based on 6 active templates.", 97], ["MONTHLY_SUMMARY", "ACCEPTED", "low", "October 2026 summary", "Income €33,200, expenses €19,000, net €14,200.", 99]];
    const sv = { high: "red", medium: "yellow", low: "" };
    return '<div class="a-page">' + head("Insights", "Findings from the AI assistant. It suggests; people decide.", sel("Open", "filter") + sel("Kind: all", "tag")) +
      '<div class="toolbar"><div class="search-in" style="flex:1">' + I("sparkles", 14) + '<span>Ask about your numbers, e.g. “Why did expenses go up in September?”</span></div>' + btn("Ask", "send", "primary") + "</div>" +
      I1.map((x) => '<div class="cd" style="margin-bottom:10px"><div class="cd-b"><div class="rowx" style="padding:0"><div class="grow"><b>' + x[3] + '</b><small>' + E(x[0]) + " " + E(x[1], x[1] === "ACCEPTED" ? "green" : "blue") + ' <span class="badge ' + sv[x[2]] + '">' + x[2] + '</span> <span class="ex-conf">confidence ' + x[5] + "%</span></small><p style='margin:6px 0 0'>" + x[4] + "</p></div>" + (x[1] === "OPEN" ? btn("Open record", "", "sm") + btn("Accept", "check", "sm primary") + btn("Dismiss", "x", "sm") : "") + "</div></div></div>").join("") +
      dm(["LedgerInsight · kind, status, confidence, severity, title, body, record_id, data, period_id, resolved_by_membership_id, resolved_at, expires_at", "LedgerRecord · ai_suggestions, flagged_unusual · FinancialPeriodSummary · ai_summary", "LedgerSettings · ai_enabled, ai_auto_categorize"], []) + "</div>";
  }

  const MAP = { overview, ledger, create, detail, imports, "import-review": importReview, recurring, "recurring-new": recurringNew, vendors, "vendor": vendorDetail, approvals, budgets, profitability, periods, pnl, vat, reports, payroll, "payroll-new": payrollNew, categories, settings, insights };
  const CRUMB = { detail: "LED-2026-0403", "import-review": "hetzner-invoice-1049.pdf", vendor: "Hetzner Online GmbH", create: "New expense", "recurring-new": "New recurring expense", "payroll-new": "New payroll entry" };
  window.VIEWS.expenses = { html: function (s) { return (MAP[s || "overview"] || MAP.overview)(s); }, crumb: function (s) { return CRUMB[s] || ""; }, fill: false };
})();
