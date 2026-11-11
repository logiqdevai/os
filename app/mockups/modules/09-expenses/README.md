# Income & expenses mockup

- App id: `expenses` · open `app-shell.html#expenses` (any route below: `app-shell.html#expenses/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/09-income-expense-management.md`](../../../../docs/features/09-income-expense-management.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (22): `LedgerSettings`, `LedgerCategory`, `LedgerPaymentMethod`, `LedgerSupplierProfile`, `LedgerRecord`, `LedgerSettlement`, `LedgerAttachment`, `LedgerInvoiceImport`, `LedgerInvoiceImportLine`, `RecurringExpense`, `PayrollSchedule`, `PayrollEntry`, `FinancialPeriod`, `FinancialPeriodSummary`, `LedgerProfitabilitySnapshot`, `LedgerInsight`, `LedgerBalanceSnapshot`, `LedgerBudget`, `LedgerBudgetLine`, `VatReturn`, `ExpenseClaim`, `ExpenseClaimLine`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.expenses`; the nav panel of the app is the `expenses` entry in `../../core/apps.js`.
- Screens (22): `overview`, `ledger`, `create`, `detail`, `imports`, `import-review`, `recurring`, `recurring-new`, `vendors`, `vendor`, `approvals`, `budgets`, `profitability`, `periods`, `pnl`, `vat`, `reports`, `payroll`, `payroll-new`, `categories`, `settings`, `insights`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
