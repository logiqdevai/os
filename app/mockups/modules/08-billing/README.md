# Billing mockup

- App id: `billing` · open `app-shell.html#billing` (any route below: `app-shell.html#billing/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/08-financial-management-stripe-integration.md`](../../../../docs/features/08-financial-management-stripe-integration.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (27): `BillingProfile`, `PaymentMethod`, `Product`, `Price`, `TaxRate`, `Coupon`, `InvoiceTemplate`, `Invoice`, `InvoiceLineItem`, `InvoiceReminder`, `Payment`, `PaymentAllocation`, `Refund`, `CreditNote`, `Subscription`, `SubscriptionItem`, `DunningPolicy`, `ProjectBillingSettings`, `PaymentProviderConnection`, `PaymentProviderObject`, `ProviderWebhookEvent`, `PaymentLink`, `PaymentDispute`, `PaymentPayout`, `FinanceApprovalRule`, `FinanceApproval`, `FinanceReportSchedule`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.billing`; the nav panel of the app is the `billing` entry in `../../core/apps.js`.
- Screens (21): `dashboard`, `invoices`, `create`, `invoice`, `approvals`, `subscriptions`, `subscription`, `payments`, `payment`, `links`, `credits`, `customers`, `customer`, `catalog`, `tax`, `numbering`, `dunning`, `reports`, `providers`, `provider`, `projectbilling`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
