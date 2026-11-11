# Financial Management & Stripe Integration

> Linear: [LOG-104](https://linear.app/logiqdev/issue/LOG-104/financial-management-and-stripe-integration) · Status: Backlog

> **Canonical for:** customer-facing billing: billing profiles, the **products and services catalog** (used by 02 deal line items and 03 proposals), invoices, payments, refunds, subscriptions, recurring billing and dunning, taxes and discounts on invoices, project billing models, Stripe integration, billing dashboards and the customer self-service billing capabilities surfaced by 07.
>
> **Boundary with 09 Income & Expense:** 08 owns what the agency **bills and collects** (accounts receivable, Stripe). 09 owns the **ledger**: every income and expense record, VAT position, payroll cost, P&L and profitability. Every invoice and payment in 08 automatically produces an income record in 09; 08 never records expenses and 09 never issues invoices.
>
> **Depends on:** [01](./01-users-organizations-permissions.md) (LOG-406) for permissions, approval rights (01 §95), separation of duties (01 §96), branding, branch-level finance (01 §34) · [02 CRM](./02-crm-sales-management.md) (LOG-404) for Companies and billing contacts · [03 Proposals](./03-proposal-quotation-generator.md) (LOG-303) as the origin of invoices and subscriptions · [04 Contracts](./04-contracts.md) (LOG-349) for billing context · [05 Projects](./05-project-management.md) (LOG-405) for milestone billing · [18 Time Tracking](./18-time-tracking.md) (LOG-408) for time and materials invoicing · [17 Documents](./17-documents-file-management.md) (LOG-407) for invoice PDFs · [11 Communication Center](./11-communication-center.md) (LOG-106) for invoice and reminder emails · [14 Notifications](./14-notifications-activity-center.md) (LOG-403) · [20 Automation Engine](./20-automation-engine.md) (LOG-410) for recurring billing, dunning and reminders.
>
> **Consumed by:** 02 CRM (§19 customer revenue), 03 Proposals (catalog, tax), 07 Customer Portal (billing surface), 09 Income & Expense (income records), 05 Projects (financial context).

Develop a comprehensive **Financial Management** module powered by **Stripe** that automates the agency's billing, payments, subscriptions, invoicing, revenue tracking, and customer financial operations. The goal is to eliminate manual financial administration by providing a fully automated billing workflow integrated with projects and customer accounts.

The finance module should support one-time payments, recurring subscriptions, quotations, invoices, payment collection, refunds, taxes, and financial reporting while keeping customers and administrators synchronized in real time.

---

<!-- schema-refs:start -->

## Data model (Prisma)

> Generated from [`api/prisma/schema.prisma`](../../api/prisma/schema.prisma) by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand.
> Before implementing API or app code for this module, read these models in the schema and reuse the existing
> tables, enums and services of the modules listed under "Reuses". Never redefine a table owned by another module.

**Platform tables to reuse, not rebuild:** `audit_events` (activity & change history, [01](./01-users-organizations-permissions.md)) · `custom_field_definitions` (custom fields, [02](./02-crm-sales-management.md)) · `taggings` (tags, [02](./02-crm-sales-management.md)) · `saved_views` (saved views, [02](./02-crm-sales-management.md)) · `crm_notes` (notes, polymorphic by entity type, [02](./02-crm-sales-management.md)) · `number_sequences` (document numbering, [03](./03-proposal-quotation-generator.md)) · `signature_requests` (e-signatures, [04](./04-contracts.md))

### Owned tables (18)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Customer billing** | | | |
| `BillingProfile` | `billing_profiles` | [L5212](../../api/prisma/schema.prisma#L5212) | 08 "Customer Billing" — billing profile of a Customer (CRM Company, 02). Stripe customer lives here. |
| `PaymentMethod` | `payment_methods` | [L5250](../../api/prisma/schema.prisma#L5250) | 08 "Customer Billing" — stored payment methods; card data never stored, only provider tokens. |
| **Catalog** | | | |
| `Product` | `products` | [L5278](../../api/prisma/schema.prisma#L5278) | 08 "Products & Services" — the platform catalog used by 02 deal line items, 03 proposals and 18 rates. |
| `Price` | `prices` | [L5308](../../api/prisma/schema.prisma#L5308) | 08 — a price of a product: one-time or recurring, per currency. |
| `TaxRate` | `tax_rates` | [L5334](../../api/prisma/schema.prisma#L5334) | 08 "Taxes & Discounts" — tax rates incl. VAT and regional rules. |
| `Coupon` | `coupons` | [L5356](../../api/prisma/schema.prisma#L5356) | 08 "Taxes & Discounts" — percentage or fixed discounts, reusable as coupons. |
| **Invoicing** | | | |
| `Invoice` | `invoices` | [L5385](../../api/prisma/schema.prisma#L5385) | 08 "Invoicing" — the invoice. Numbering via NumberSequence (INV-2026-0001). |
| `InvoiceLineItem` | `invoice_line_items` | [L5464](../../api/prisma/schema.prisma#L5464) | 08 "Invoicing" — line items; milestone and time entries link project billing (05 §20, 18 §7). |
| `InvoiceReminder` | `invoice_reminders` | [L5497](../../api/prisma/schema.prisma#L5497) | 08 "Automation" — reminder / dunning actions sent for an invoice. Delivery is 11/14. |
| **Payments** | | | |
| `Payment` | `payments` | [L5515](../../api/prisma/schema.prisma#L5515) | 08 "Payments" — a payment received (online or manually recorded). Allocations split it across invoices. |
| `PaymentAllocation` | `payment_allocations` | [L5556](../../api/prisma/schema.prisma#L5556) | Partial and multi-invoice payments (08 "Partial payments"). |
| `Refund` | `refunds` | [L5572](../../api/prisma/schema.prisma#L5572) | 08 "Payments" — refunds against a payment. |
| `CreditNote` | `credit_notes` | [L5591](../../api/prisma/schema.prisma#L5591) | 08 "Invoicing" — credit notes issued against an invoice. Numbered via NumberSequence. |
| **Subscriptions** | | | |
| `Subscription` | `subscriptions` | [L5625](../../api/prisma/schema.prisma#L5625) | 08 "Subscription Management" — multiple active subscriptions per customer. |
| `SubscriptionItem` | `subscription_items` | [L5676](../../api/prisma/schema.prisma#L5676) | 08 — plan lines of a subscription (upgrades/downgrades change items, history in audit_events). |
| `DunningPolicy` | `dunning_policies` | [L5697](../../api/prisma/schema.prisma#L5697) | 08 "Recurring Billing" — dunning policy; steps are scheduled by the Automation Engine (20). |
| `ProjectBillingSettings` | `project_billing_settings` | [L5715](../../api/prisma/schema.prisma#L5715) | 08 "Project Billing" — how a project is billed (05 §63 consumes the result). |
| `ProviderWebhookEvent` | `provider_webhook_events` | [L5742](../../api/prisma/schema.prisma#L5742) | Idempotent processing of provider webhooks (Stripe today; signature providers also use SignatureEvent). |

**Owned enums (16):** `ProductType`, `PriceType`, `BillingInterval`, `TaxBehavior`, `DiscountType`, `CouponDuration`, `InvoiceStatus`, `BillingModel`, `PaymentProvider`, `PaymentMethodType`, `PaymentStatus`, `RefundStatus`, `CreditNoteStatus`, `SubscriptionStatus`, `CollectionMethod`, `DunningAction`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Invoice.branch` |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `BillingProfile.organization`, `Coupon.organization`, `CreditNote.organization`, `DunningPolicy.organization` +6 more |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `BillingProfile.company`, `Invoice.company`, `Subscription.company` |
| [04](./04-contracts.md) | `Contract` (`contracts`) | `Invoice.contract`, `Subscription.contract` |
| [05](./05-project-management.md) | `Project` (`projects`) | `Invoice.project`, `ProjectBillingSettings.project`, `Subscription.project` |
| [05](./05-project-management.md) | `ProjectMilestone` (`project_milestones`) | `InvoiceLineItem.milestone` |

### Referenced by other modules

- [02](./02-crm-sales-management.md): `CrmDealLineItem`
- [03](./03-proposal-quotation-generator.md): `Proposal`, `ProposalLineItem`
- [05](./05-project-management.md): `Project`

<!-- schema-refs:end -->

## Customer Billing

Manage financial information for every customer, including:

* Billing profiles
* Company information
* Billing contacts
* Tax information
* Multiple payment methods
* Billing addresses
* Default payment methods
* Customer payment history

---

## Products & Services

> **Platform catalog.** This is the single products and services catalog of the Agency OS. 02 CRM deal line items and 03 Proposal line items select from it; 18 Time Tracking billing rates reference it.

Support creation and management of:

* Services (Stripe Products)
* Development packages
* Maintenance plans
* Support plans
* Custom pricing
* Recurring plans
* One-time services
* Discounts

---

## Proposals & Quotations

> Defined by → [03 AI-Powered Proposal & Quotation Generator](./03-proposal-quotation-generator.md) · Linear LOG-303.

Quotes, estimates and proposals are one record owned by 03: line items, pricing, discounts, taxes, expiration, revisions, versions, PDF, customer acceptance and signature. Finance does not implement a separate quote entity.

Finance's responsibilities toward proposals:

* Provide the products and services catalog, tax rates and currencies used by proposal line items
* On proposal acceptance, create the invoice, deposit, payment schedule and subscription defined by the accepted proposal version (03 "Conversion to Project")
* Keep the invoice and subscription permanently linked to the accepted proposal version

---

## Invoicing

Provide complete invoice management including:

* Automatic invoice generation
* Manual invoices
* Recurring invoices
* Draft invoices
* Scheduled invoices
* Invoice numbering
* Custom branding
* Company logo
* Invoice templates
* Line items
* Taxes
* Discounts
* Notes
* Payment instructions
* Payment methods (card, bank transfer, cash)
* Due dates
* Partial payments
* Invoice status tracking
* PDF generation
* Invoice download
* Invoice email delivery
* Credit notes
* Invoice revisions

Invoice statuses should include:

* Draft
* Open
* Pending
* Paid
* Partially Paid
* Overdue
* Refunded
* Cancelled
* Void

---

## Payments

Support payment processing for:

* One-time payments
* Online invoice payments
* Subscription payments
* Deposit payments
* Milestone payments
* Partial payments
* Automatic payment collection
* Manual payment recording
* Refunds
* Failed payment recovery

Track:

* Payment status
* Payment history
* Transaction IDs
* Payment method
* Processing fees
* Tax fees
* Vat fees
* Refund history
* Payment receipts

---

## Subscription Management

Provide a complete subscription management system supporting:

* Monthly subscriptions
* Annual subscriptions
* Custom billing intervals
* Setup fees
* Subscription upgrades
* Subscription downgrades
* Plan changes
* Pause subscriptions
* Resume subscriptions
* Cancel subscriptions
* Scheduled cancellations
* Renewal management
* Automatic renewals
* Subscription history

Support multiple active subscriptions per customer.

---

## Recurring Billing

Automate recurring billing through:

* Automatic invoice generation
* Automatic payment collection
* Renewal reminders
* Failed payment retries
* Dunning management
* Expiration notifications
* Upcoming renewal notifications
* Automatic subscription renewals

---

## Taxes & Discounts

Support flexible pricing with:

* Tax rates
* VAT support
* Tax exemptions
* Inclusive and exclusive taxes
* Regional tax rules
* Percentage discounts
* Fixed discounts
* Customer-specific pricing

---

## Financial Dashboard

Billing and revenue dashboard. Profit and loss, expenses, VAT position and project profitability are in [09 Income & Expense](./09-income-expense-management.md).

Provide real-time billing dashboards displaying:

* Total revenue
* Monthly revenue
* Annual revenue
* Monthly Recurring Revenue (MRR)
* Annual Recurring Revenue (ARR)
* Outstanding invoices
* Paid invoices
* Overdue invoices
* Active subscriptions
* Churn rate
* Customer Lifetime Value (LTV)
* Average Revenue Per Customer (ARPU)
* Revenue by customer
* Revenue by project
* Revenue by service
* Payment success rate
* Refund totals

---

## Financial Reporting

Generate reports including:

* Revenue reports
* Invoice reports
* Subscription reports
* Tax reports
* Outstanding balances
* Customer payment history
* Cash flow reports
* Financial summaries
* Monthly reports
* Quarterly reports
* Annual reports

Support exporting reports to:

* PDF
* Excel
* CSV

---

## Project Billing

Connect financial operations directly with projects.

Support:

* Fixed-price projects
* Milestone billing
* Time & Materials billing
* Retainer contracts
* Maintenance contracts
* Recurring project billing
* Automatic invoice creation based on project milestones (05 §20)
* Time and materials invoicing from approved billable time entries ([18 Time Tracking](./18-time-tracking.md) §7)
* Billable and non-billable classification comes from 18; write-offs and write-ups at invoicing time are recorded here

---

## Customer Self-Service

Finance defines the customer billing capabilities; [07 Customer Portal](./07-customer-portal.md) §10 surfaces them. Customer identity and the Finance customer role come from 01 §79.

Customers should be able to:

* View invoices
* Download invoices
* Pay invoices online
* View payment history
* Manage payment methods
* View active subscriptions
* Upgrade subscriptions
* Cancel subscriptions
* Download receipts
* View quotes
* Accept quotes
* View billing history

---

## Automation

> Engine defined by → [20 Automation Engine](./20-automation-engine.md) · Linear LOG-410. Notifications delivered by → [14](./14-notifications-activity-center.md) · Linear LOG-403. Emails sent through → [11 Communication Center](./11-communication-center.md) · Linear LOG-106.

Finance registers these scheduled jobs and rules with the engine:

* Invoice generation
* Invoice delivery
* Payment confirmations
* Payment reminders
* Subscription renewals
* Failed payment notifications
* Overdue invoice reminders
* Quote follow-ups
* Receipt generation
* Credit note generation
* Financial notifications

---

## AI Financial Assistant

Integrate AI throughout the finance module to automate administrative work and provide business insights.

AI should be capable of:

* Creating invoices from projects, milestones and approved time
* Generating billing reports and summarizing revenue, MRR and collections
* Drafting payment reminder emails
* Predicting payment risk and churn

Proposal generation is 03; ledger analysis, expense categorization and P&L summaries are 09.

The Financial Management module should provide a seamless, automated billing experience by tightly integrating Stripe with projects, customers, subscriptions, invoicing, and reporting, significantly reducing manual financial administration while providing complete visibility into the agency's financial operations.
