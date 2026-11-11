import { Building2, Flag, LayoutDashboard, List, Percent, ReceiptText, Repeat, Tags, TrendingUp, Wallet } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const expensesApp: AppDefinition = {
    id: "expenses",
    label: "Income & expenses",
    icon: Wallet,
    basePath: "/expenses",
    module: "INCOME_EXPENSE",
    viewPermissions: ["finance.expenses.read", "finance.income.read"],
    newAction: { label: "Add expense", to: "/expenses/new", permission: "finance.expenses.create" },
    nav: [
        { items: [
            { label: "Overview", to: "/expenses", icon: LayoutDashboard, end: true },
            { label: "Ledger", to: "/expenses/ledger", icon: List },
            { label: "Recurring", to: "/expenses/recurring", icon: Repeat, permissions: ["finance.recurring_expenses.read"] },
            { label: "Vendors", to: "/expenses/vendors", icon: Building2 },
            { label: "Expense claims", to: "/expenses/claims", icon: ReceiptText, permissions: ["finance.expense_claims.read", "finance.expense_claims.read_own"] },
        ] },
        { label: "Analysis", items: [
            { label: "Budgets", to: "/expenses/budgets", icon: Flag, permissions: ["finance.budgets.read"] },
            { label: "Profit & loss", to: "/expenses/pnl", icon: TrendingUp, permissions: ["finance.profit_loss.read"] },
            { label: "VAT", to: "/expenses/vat", icon: Percent, permissions: ["finance.vat.read"] },
        ] },
        { label: "Setup", items: [
            { label: "Categories", to: "/expenses/categories", icon: Tags, permissions: ["finance.settings.manage"] },
        ] },
    ],
};
