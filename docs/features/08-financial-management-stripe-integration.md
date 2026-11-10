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
