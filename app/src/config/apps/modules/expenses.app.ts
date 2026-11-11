import { Building2, CalendarRange, CheckCircle2, Flag, LayoutDashboard, List, Percent, PieChart, ReceiptText, Repeat, Tags, TrendingUp, Wallet } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const expensesApp: AppDefinition = {
    id: "expenses",
    label: "Income & expenses",
    icon: Wallet,
    basePath: "/expenses",
    module: "INCOME_EXPENSE",
    viewPermissions: ["finance.expenses.read", "finance.income.read", "finance.expense_claims.read_own", "finance.expense_claims.read"],
    newAction: { label: "Add expense", to: "/expenses/new", permission: "finance.expenses.create" },
    nav: [
        { items: [
            { label: "Overview", to: "/expenses", icon: LayoutDashboard, permissions: ["finance.income.read", "finance.expenses.read"], end: true },
            { label: "Ledger", to: "/expenses/ledger", icon: List, permissions: ["finance.income.read", "finance.expenses.read"] },
            { label: "Recurring", to: "/expenses/recurring", icon: Repeat, permissions: ["finance.recurring_expenses.read"] },
            { label: "Vendors", to: "/expenses/vendors", icon: Building2, permissions: ["finance.expenses.read"] },
            { label: "Expense claims", to: "/expenses/claims", icon: ReceiptText, permissions: ["finance.expense_claims.read", "finance.expense_claims.read_own"] },
            { label: "Approvals", to: "/expenses/approvals", icon: CheckCircle2, permissions: ["finance.expenses.approve", "finance.expense_claims.approve"] },
        ] },
        { label: "Analysis", items: [
            { label: "Budgets", to: "/expenses/budgets", icon: Flag, permissions: ["finance.budgets.read"] },
            { label: "Profit & loss", to: "/expenses/pnl", icon: TrendingUp, permissions: ["finance.profit_loss.read"] },
            { label: "Profitability", to: "/expenses/profitability", icon: PieChart, permissions: ["finance.profitability.read"] },
            { label: "VAT", to: "/expenses/vat", icon: Percent, permissions: ["finance.vat.read"] },
        ] },
        { label: "Setup", items: [
            { label: "Periods", to: "/expenses/periods", icon: CalendarRange, permissions: ["finance.income.read", "finance.expenses.read"] },
            { label: "Categories & settings", to: "/expenses/categories", icon: Tags, permissions: ["finance.categories.manage", "finance.expenses.read", "finance.income.read"] },
        ] },
    ],
};
