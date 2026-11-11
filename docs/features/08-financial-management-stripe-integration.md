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

### Owned tables (20)

| Model | Table | Schema line | Purpose |
| -- | -- | -- | -- |
| **Customer billing** | | | |
| `BillingProfile` | `billing_profiles` | [L5852](../../api/prisma/schema.prisma#L5852) | 08 "Customer Billing" — billing profile of a Customer (CRM Company, 02). Stripe customer lives here. |
| `PaymentMethod` | `payment_methods` | [L5893](../../api/prisma/schema.prisma#L5893) | 08 "Customer Billing" — stored payment methods; card data never stored, only provider tokens. |
| **Catalog** | | | |
| `Product` | `products` | [L5922](../../api/prisma/schema.prisma#L5922) | 08 "Products & Services" — the platform catalog used by 02 deal line items, 03 proposals and 18 rates. |
| `Price` | `prices` | [L5953](../../api/prisma/schema.prisma#L5953) | 08 — a price of a product: one-time or recurring, per currency. |
| `TaxRate` | `tax_rates` | [L5979](../../api/prisma/schema.prisma#L5979) | 08 "Taxes & Discounts" — tax rates incl. VAT and regional rules. |
| `Coupon` | `coupons` | [L6007](../../api/prisma/schema.prisma#L6007) | 08 "Taxes & Discounts" — percentage or fixed discounts, reusable as coupons. |
| **Invoicing** | | | |
| `InvoiceTemplate` | `invoice_templates` | [L6036](../../api/prisma/schema.prisma#L6036) | 08 "Invoicing" — invoice templates: layout, branding and default texts. Organization branding (01 §15) is the fallback. |
| `Invoice` | `invoices` | [L6063](../../api/prisma/schema.prisma#L6063) | 08 "Invoicing" — the invoice. Numbering via NumberSequence (INV-2026-0001). |
| `InvoiceLineItem` | `invoice_line_items` | [L6155](../../api/prisma/schema.prisma#L6155) | 08 "Invoicing" — line items; milestone and time entries link project billing (05 §20, 18 §7). |
| `InvoiceReminder` | `invoice_reminders` | [L6191](../../api/prisma/schema.prisma#L6191) | 08 "Automation" — reminder / dunning actions sent for an invoice. Delivery is 11/14. |
| **Payments** | | | |
| `Payment` | `payments` | [L6213](../../api/prisma/schema.prisma#L6213) | 08 "Payments" — a payment received (online or manually recorded). Allocations split it across invoices. |
| `PaymentAllocation` | `payment_allocations` | [L6259](../../api/prisma/schema.prisma#L6259) | Partial and multi-invoice payments (08 "Partial payments"). |
| `Refund` | `refunds` | [L6275](../../api/prisma/schema.prisma#L6275) | 08 "Payments" — refunds against a payment. |
| `CreditNote` | `credit_notes` | [L6295](../../api/prisma/schema.prisma#L6295) | 08 "Invoicing" — credit notes issued against an invoice. Numbered via NumberSequence. |
| **Subscriptions** | | | |
| `Subscription` | `subscriptions` | [L6330](../../api/prisma/schema.prisma#L6330) | 08 "Subscription Management" — multiple active subscriptions per customer. |
| `SubscriptionItem` | `subscription_items` | [L6387](../../api/prisma/schema.prisma#L6387) | 08 — plan lines of a subscription (upgrades/downgrades change items, history in audit_events). |
| `DunningPolicy` | `dunning_policies` | [L6408](../../api/prisma/schema.prisma#L6408) | 08 "Recurring Billing" — dunning policy; steps are scheduled by the Automation Engine (20). |
| `ProjectBillingSettings` | `project_billing_settings` | [L6427](../../api/prisma/schema.prisma#L6427) | 08 "Project Billing" — how a project is billed (05 §63 consumes the result). |
| `PaymentProviderConnection` | `payment_provider_connections` | [L6456](../../api/prisma/schema.prisma#L6456) | 08 "Payments" — the organization's connection to a payment provider (Stripe account / API keys today). Resolves incoming provider webhooks (ProviderWebhookEv… |
| `ProviderWebhookEvent` | `provider_webhook_events` | [L6485](../../api/prisma/schema.prisma#L6485) | Idempotent processing of provider webhooks (Stripe today; signature providers also use SignatureEvent). |

**Owned enums (16):** `ProductType`, `PriceType`, `BillingInterval`, `TaxBehavior`, `DiscountType`, `CouponDuration`, `InvoiceStatus`, `BillingModel`, `PaymentProvider`, `PaymentMethodType`, `PaymentStatus`, `RefundStatus`, `CreditNoteStatus`, `SubscriptionStatus`, `CollectionMethod`, `DunningAction`

### Reuses from other modules (foreign keys)

| Module | Model (table) | Referenced by |
| -- | -- | -- |
| [01](./01-users-organizations-permissions.md) | `Branch` (`branches`) | `Invoice.branch` |
| [01](./01-users-organizations-permissions.md) | `Organization` (`organizations`) | `BillingProfile.organization`, `Coupon.organization`, `CreditNote.organization`, `DunningPolicy.organization` +8 more |
| [02](./02-crm-sales-management.md) | `CrmCompany` (`crm_companies`) | `BillingProfile.company`, `Invoice.company`, `Subscription.company` |
| [03](./03-proposal-quotation-generator.md) | `ProposalPaymentScheduleItem` (`proposal_payment_schedule_items`) | `Invoice.proposal_payment_schedule_item` |
| [04](./04-contracts.md) | `Contract` (`contracts`) | `Invoice.contract`, `Subscription.contract` |
| [05](./05-project-management.md) | `Project` (`projects`) | `Invoice.project`, `ProjectBillingSettings.project`, `Subscription.project` |
| [05](./05-project-management.md) | `ProjectMilestone` (`project_milestones`) | `InvoiceLineItem.milestone` |
| [09](./09-income-expense-management.md) | `LedgerRecord` (`ledger_records`) | `Invoice.ledger_record`, `Payment.origin_ledger_record` |
| [11](./11-communication-center.md) | `CommMessage` (`comm_messages`) | `InvoiceReminder.communication` |
| [17](./17-documents-file-management.md) | `Document` (`documents`) | `CreditNote.pdf_document`, `Invoice.pdf_document`, `Payment.receipt_document` |

### Referenced by other modules

- [02](./02-crm-sales-management.md): `CrmDealLineItem`
- [03](./03-proposal-quotation-generator.md): `Proposal`, `ProposalLineItem`
- [05](./05-project-management.md): `Project`
- [09](./09-income-expense-management.md): `LedgerCategory`, `LedgerRecord`, `LedgerSettings`, `LedgerSettlement`, `LedgerSupplierProfile`, `RecurringExpense`
- [11](./11-communication-center.md): `CommDeliveryEvent`
- [18](./18-time-tracking.md): `BillingRate`, `TimeEntry`, `TimeEntryAdjustment`

### Plain-id references from other modules

Columns in other modules that point at this module by plain string id or JSON (no Prisma relation). Keep them consistent when changing this module.

- `Contract.billing_model` ([04](./04-contracts.md), [L3484](../../api/prisma/schema.prisma#L3484)) — 04 §54, 18 §6 — billing model agreed in the contract (08 BillingModel); seeds ProjectBillingSettings on project creation.
- `RecurringExpense.interval` ([09](./09-income-expense-management.md), [L7133](../../api/prisma/schema.prisma#L7133)) — MONTH / QUARTER / YEAR, or WEEK/DAY with interval_count for custom recurrence (08 BillingInterval).
- `CommDeliveryEvent.provider_webhook_event_id` ([11](./11-communication-center.md), [L9939](../../api/prisma/schema.prisma#L9939)) — 08 ProviderWebhookEvent that carried this event.
- `Segment.definition` ([11](./11-communication-center.md), [L10052](../../api/prisma/schema.prisma#L10052)) — Filter tree: { and: [ { field, op, value }, { or: [...] } ] } over CRM fields, custom fields, tags, subscription plan / billing status / outstanding invoices…

<!-- schema-refs:end -->

<!-- access-channels:start -->

## Access channels & permissions

> Generated by `node docs/scripts/sync-feature-schema-refs.mjs` — do not edit by hand. Standard: [Product Specification §4a](../Product_Specification.md). Rules: `.cursor/rules/roles-and-permissions-in-every-feature.mdc`.

Every capability of this module is built for **all access channels at once**. Each channel goes through the central authorization service ([01 §136](./01-users-organizations-permissions.md)) and the same permission keys, so roles and permissions exist from the first commit and are never added later.

| Channel | Required for this module |
| -- | -- |
| UI | Routes, navigation, buttons and fields gated by permission key; no-access state for `403`/`404` |
| REST API | One endpoint per resource action with `@RequirePermission`, organization taken from the credential, lists filtered by branch/team/project scope |
| MCP | A tool `<module>_<resource>_<action>` per agent-useful action, a thin adapter over the same service and validation, listed only to callers holding the key; sensitive tools need human confirmation when an AI agent calls them |
| API key / service account | Explicit permission keys and scope, never a human's full access; usable on every endpoint and MCP tool of this module; audit actor `SERVICE_ACCOUNT` |
| Webhooks and automation | Events, triggers and actions registered with [20](./20-automation-engine.md); automation runs as a service account or membership with the same checks |

**Permission keys in the catalog today** (`api/prisma/seed/permission-catalog.ts`, 25 keys; `*` = sensitive):

| Resource key prefix | Actions |
| -- | -- |
| `finance.adjustments` | manage* |
| `finance.billing_profiles` | manage* |
| `finance.catalog` | read, manage |
| `finance.credit_notes` | manage* |
| `finance.dashboard` | read* |
| `finance.dunning` | manage |
| `finance.invoice_templates` | manage |
| `finance.invoices` | read, create, update, delete*, archive, export*, approve*, send, void* |
| `finance.payments` | read*, record*, refund* |
| `finance.project_billing` | manage |
| `finance.reports` | read* |
| `finance.stripe` | manage* |
| `finance.subscriptions` | read, manage* |

Definition of done for each resource of this module: permission keys in the catalog and in the role templates, seed re-run, REST endpoint, MCP tool, service-account and API-key access verified, webhook events and automation triggers declared, audit events written, tests for allow / deny / wrong scope / wrong organization.

<!-- access-channels:end -->

## Customer Billing

<!-- schema-section:start -->
> **Schema:** `BillingProfile` ([billing_profiles](../../api/prisma/schema.prisma#L5852)) · `PaymentMethod` ([payment_methods](../../api/prisma/schema.prisma#L5893))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `Product` ([products](../../api/prisma/schema.prisma#L5922)) · enum `ProductType` ([L5715](../../api/prisma/schema.prisma#L5715))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `Invoice` ([invoices](../../api/prisma/schema.prisma#L6063)): `proposal_payment_schedule_item_id`, `proposal_version_id` · `Subscription` ([subscriptions](../../api/prisma/schema.prisma#L6330)): `proposal_version_id`
<!-- schema-section:end -->

> Defined by → [03 AI-Powered Proposal & Quotation Generator](./03-proposal-quotation-generator.md) · Linear LOG-303.

Quotes, estimates and proposals are one record owned by 03: line items, pricing, discounts, taxes, expiration, revisions, versions, PDF, customer acceptance and signature. Finance does not implement a separate quote entity.

Finance's responsibilities toward proposals:

* Provide the products and services catalog, tax rates and currencies used by proposal line items
* On proposal acceptance, create the invoice, deposit, payment schedule and subscription defined by the accepted proposal version (03 "Conversion to Project")
* Keep the invoice and subscription permanently linked to the accepted proposal version

---

## Invoicing

<!-- schema-section:start -->
> **Schema:** `CreditNote` ([credit_notes](../../api/prisma/schema.prisma#L6295)) · `Invoice` ([invoices](../../api/prisma/schema.prisma#L6063)): `approved_by_user_id` · `InvoiceLineItem` ([invoice_line_items](../../api/prisma/schema.prisma#L6155)) · `InvoiceTemplate` ([invoice_templates](../../api/prisma/schema.prisma#L6036)) · enum `InvoiceStatus` ([L5759](../../api/prisma/schema.prisma#L5759)) — other modules: `TimeEntryAdjustment` ([time_entry_adjustments](../../api/prisma/schema.prisma#L16499)) ([18](./18-time-tracking.md))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `Payment` ([payments](../../api/prisma/schema.prisma#L6213)): `tax_amount` · `PaymentProviderConnection` ([payment_provider_connections](../../api/prisma/schema.prisma#L6456)) · `Refund` ([refunds](../../api/prisma/schema.prisma#L6275)) · enum `PaymentProvider` ([L5783](../../api/prisma/schema.prisma#L5783))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `Subscription` ([subscriptions](../../api/prisma/schema.prisma#L6330)): `setup_fee` · enum `BillingInterval` ([L5733](../../api/prisma/schema.prisma#L5733)) · enum `SubscriptionStatus` ([L5824](../../api/prisma/schema.prisma#L5824))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `BillingProfile` ([billing_profiles](../../api/prisma/schema.prisma#L5852)): `dunning_policy_id` · `DunningPolicy` ([dunning_policies](../../api/prisma/schema.prisma#L6408)) · enum `DunningAction` ([L5840](../../api/prisma/schema.prisma#L5840))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `BillingProfile` ([billing_profiles](../../api/prisma/schema.prisma#L5852)): `custom_pricing` · `Coupon` ([coupons](../../api/prisma/schema.prisma#L6007)) · `TaxRate` ([tax_rates](../../api/prisma/schema.prisma#L5979)) · enum `TaxBehavior` ([L5742](../../api/prisma/schema.prisma#L5742))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `InvoiceLineItem` ([invoice_line_items](../../api/prisma/schema.prisma#L6155)): `adjustment_amount` · `ProjectBillingSettings` ([project_billing_settings](../../api/prisma/schema.prisma#L6427)) · enum `BillingModel` ([L5773](../../api/prisma/schema.prisma#L5773))
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** `InvoiceReminder` ([invoice_reminders](../../api/prisma/schema.prisma#L6191)): `automation_run_id`
<!-- schema-section:end -->

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

<!-- schema-section:start -->
> **Schema:** no dedicated tables — this section is behaviour, UI or policy over the tables listed under "Data model (Prisma)" above.
<!-- schema-section:end -->

Integrate AI throughout the finance module to automate administrative work and provide business insights.

AI should be capable of:

* Creating invoices from projects, milestones and approved time
* Generating billing reports and summarizing revenue, MRR and collections
* Drafting payment reminder emails
* Predicting payment risk and churn

Proposal generation is 03; ledger analysis, expense categorization and P&L summaries are 09.

The Financial Management module should provide a seamless, automated billing experience by tightly integrating Stripe with projects, customers, subscriptions, invoicing, and reporting, significantly reducing manual financial administration while providing complete visibility into the agency's financial operations.
