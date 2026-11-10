# Income & Expense Management

> Linear: [LOG-105](https://linear.app/logiqdev/issue/LOG-105/income-and-expense-management) · Status: Backlog

## Income & Expense Management

Develop a comprehensive **Income & Expense Management** module for maintaining a detailed and scalable financial record of the agency's business activity. The system should support both automatically generated financial records from uploaded invoices and fully manual financial entries, while providing a unified view of all income, expenses, VAT, payroll, recurring costs, and other financial obligations.

The module should be designed to work alongside the existing Stripe and invoicing functionality but should also operate independently for financial transactions that do not originate from the platform.

---

## Financial Records

Every financial transaction should be represented as a standardized financial record with detailed information including:

* Record type: Income / Expense
* Category
* Subcategory
* Description
* Reference number
* Transaction date
* Due date
* Payment date
* Net value
* VAT amount
* VAT percentage
* Gross value
* Currency
* Payment status
* Payment method
* Customer or supplier
* Related project
* Related invoice
* Related subscription
* Related employee
* Notes
* Attachments
* Created by
* Created date
* Last updated date

The system should automatically calculate VAT amounts and gross/net values based on the entered values and VAT percentage while still allowing authorized users to make adjustments when necessary.

---

## Income Management

Support detailed tracking of all agency income, including:

* Customer invoices
* Stripe payments
* Bank payments
* Cash payments
* Project payments
* Milestone payments
* Subscription revenue
* Maintenance revenue
* Support revenue
* Consulting revenue
* Other services
* Other miscellaneous income

Income records should be linkable to:

* Customers
* Projects
* Invoices
* Payments
* Subscriptions
* Contracts

The system should distinguish between invoiced income and actually received income so that administrators can clearly understand outstanding receivables and actual cash received.

---

## Expense Management

Support detailed recording of all business expenses, including expenses originating from supplier invoices as well as expenses that do not have an invoice.

Examples include:

* Office rent
* Electricity
* Water
* Internet
* Telephone
* Software subscriptions
* Cloud hosting
* Domains
* Advertising
* Marketing
* Hardware
* Office equipment
* Office supplies
* Travel
* Transportation
* Professional services
* Accounting fees
* Legal fees
* Insurance
* Bank fees
* Payment processing fees
* Taxes
* Government fees
* Employee expenses
* Training
* Miscellaneous expenses

Users should be able to create custom expense categories and subcategories without requiring changes to the underlying system.

---

## Invoice Upload & Automatic Processing

Allow administrators to upload supplier and customer invoices directly into the system.

The platform should use AI/OCR to analyze uploaded invoices and automatically extract relevant information such as:

* Supplier
* Customer
* Invoice number
* Invoice date
* Due date
* Description
* Line items
* Quantities
* Unit prices
* Net value
* VAT amount
* VAT percentage
* Gross value
* Currency
* Payment information

After processing, the system should present the extracted information for user verification before creating the financial record.

Once approved, the system should automatically create the appropriate income or expense record and associate the original invoice with it.

The system should avoid creating duplicate records when the same invoice is uploaded multiple times.

---

## Manual Financial Entries

Users should be able to manually create financial records without uploading an invoice.

Manual entries should support the same financial fields and categorization as automatically processed records.

This is particularly important for expenses such as:

* Rent
* Electricity
* Internet
* Bank charges
* Employee expenses
* Government fees
* Other recurring operational costs
* Expenses without formal invoices

Manual entries should be clearly identified as manually created while maintaining the same reporting and accounting capabilities as imported records.

---

## Recurring Expenses

Support recurring financial obligations that automatically generate expense records according to a defined schedule.

Examples:

* Monthly rent
* Electricity
* Internet
* Software subscriptions
* Hosting
* Insurance
* Accounting services
* Office services
* Equipment leasing

Recurring expenses should support:

* Monthly
* Quarterly
* Annual
* Custom recurrence
* Start date
* End date
* Expected amount
* VAT percentage
* Category
* Supplier
* Payment method
* Automatic record generation
* Upcoming expense reminders

Recurring records should remain editable individually without modifying the underlying recurring expense template.

---

## Employee Payments & Payroll Expenses

Provide a unified system for recording employee-related expenses and monthly payments.

The system should support:

* Employee salary
* Monthly payment
* Hourly payments
* Bonuses
* Commissions
* Overtime
* Employer costs
* Employee benefits
* Reimbursements
* Other employee-related expenses

Each employee payment should be associated with the relevant employee and accounting period.

Support recurring monthly employee payment records so that administrators do not need to manually recreate the same expense every month.

The system should distinguish between the employee's base payment and additional employer-related costs where applicable.

Payroll records should be treated as expenses and automatically included in financial reporting.

---

## Financial Categories

Provide a flexible categorization system for organizing financial activity.

Support:

* Income categories
* Expense categories
* Subcategories
* Custom categories
* Custom VAT classifications
* Custom payment methods

Example structure:

```text
Income
├── Software Development
├── Maintenance
├── Support
├── Consulting
├── Subscriptions
└── Other Income
Expenses
├── Employees
├── Office
│   ├── Rent
│   ├── Electricity
│   ├── Water
│   └── Internet
├── Software
├── Hosting
├── Marketing
├── Equipment
├── Professional Services
└── Other Expenses
```

Categories should be configurable by administrators.

---

## VAT Management

Provide detailed VAT tracking for every financial record.

Support:

* VAT percentage
* VAT amount
* Net value
* Gross value
* VAT-exempt transactions
* Multiple VAT rates
* Custom VAT rates
* VAT-inclusive pricing
* VAT-exclusive pricing

Provide VAT reporting that allows administrators to understand:

* VAT collected from income
* VAT paid on expenses
* Net VAT position
* VAT by period
* VAT by category
* VAT by customer or supplier

---

## Payment & Settlement Tracking

Each financial record should support payment status tracking such as:

* Unpaid
* Partially Paid
* Paid
* Overdue
* Cancelled
* Refunded

Track:

* Payment date
* Payment method
* Amount paid
* Remaining balance
* Payment reference
* Related transaction

Support multiple payments against a single financial record when necessary.

---

## Financial Periods

Support financial reporting by:

* Day
* Week
* Month
* Quarter
* Year
* Custom date range

Financial records should remain historically consistent even when categories, suppliers, or other configuration settings change later.

---

## Financial Dashboard

Provide a comprehensive financial dashboard showing:

* Total income
* Total expenses
* Net profit
* Gross income
* Outstanding income
* Paid income
* Outstanding expenses
* Paid expenses
* VAT collected
* VAT paid
* Net VAT
* Recurring expenses
* Payroll expenses
* Operating expenses
* Income by category
* Expenses by category
* Monthly financial trends
* Cash flow overview

Provide separate views for:

* Accrual-based activity
* Actual cash received/paid

where applicable.

---

## Profit & Loss

Provide an automatically generated profit and loss overview based on recorded financial activity.

Include:

* Revenue
* Cost of operations
* Employee expenses
* Office expenses
* Software expenses
* Marketing expenses
* Professional expenses
* Other operating expenses
* Total expenses
* Net operating result

Allow filtering by:

* Period
* Project
* Customer
* Category
* Department
* Expense type

---

## Project Profitability

Connect income and expenses with projects to calculate project-level profitability.

For each project, show:

* Project revenue
* Payments received
* Outstanding revenue
* Direct expenses
* Employee costs
* Other project expenses
* Total project cost
* Gross profit
* Profit margin

This should allow management to understand which projects and customers are actually profitable.

---

## Search & Filtering

Provide powerful filtering and search across all financial records.

Allow filtering by:

* Income / Expense
* Category
* Subcategory
* Customer
* Employee
* Project
* Date
* Payment status
* VAT percentage
* VAT status
* Payment method
* Amount range
* Recurring / One-time
* Manual / Imported
* Invoice availability

---

## Attachments & Documentation

Every financial record should support attachments such as:

* Invoices
* Receipts
* Payment confirmations
* Contracts
* Expense documentation
* Other supporting documents

Maintain the original uploaded document alongside the financial record for future reference and auditing.

---

## Audit Trail

Maintain a complete history of financial record changes.

Track:

* Who created the record
* Who modified it
* What was changed
* Previous values
* New values
* Date and time of changes
* Uploaded documents
* Approval actions
* Payment actions

Financial records should not be silently deleted. Where deletion is permitted, the system should preserve an appropriate audit history.

---

## Automation

Automate financial workflows wherever possible.

Examples include:

* Automatically creating expenses from uploaded invoices
* Automatically categorizing known suppliers
* Automatically calculating VAT
* Automatically generating recurring expenses
* Automatically generating monthly employee payment records
* Automatically linking Stripe payments to income
* Automatically matching payments to invoices
* Automatically detecting duplicate invoices
* Automatically identifying overdue payments
* Automatically reminding administrators about upcoming expenses
* Automatically generating monthly financial summaries

---

## AI Financial Assistant

Integrate AI into the financial management system to assist with financial administration and analysis.

AI should be capable of:

* Extracting financial information from uploaded invoices
* Categorizing income and expenses
* Detecting duplicate invoices
* Identifying unusual expenses
* Suggesting expense categories
* Identifying missing financial records
* Explaining financial changes
* Summarizing monthly income and expenses
* Generating financial reports
* Identifying recurring costs
* Analyzing project profitability
* Forecasting future recurring expenses
* Identifying unusually high expenses
* Answering questions about the company's financial activity
* Generating management-level financial summaries

The financial system should ultimately provide a **single source of truth for the agency's income, expenses, VAT, invoices, recurring costs, employee payments, and profitability**, while remaining flexible enough to accommodate new expense types, income sources, categories, suppliers, employees, and financial workflows as the agency grows.
