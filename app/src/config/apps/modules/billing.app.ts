import { BarChart3, Building2, CheckCircle2, CreditCard, DollarSign, LayoutDashboard, Link2, Package, Percent, Plug, Receipt, ReceiptText, Repeat } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const billingApp: AppDefinition = {
    id: "billing",
    label: "Billing",
    icon: DollarSign,
    basePath: "/billing",
    module: "FINANCE",
    viewPermissions: ["finance.invoices.read", "finance.dashboard.read", "finance.payments.read", "finance.catalog.read", "finance.subscriptions.read"],
    newAction: { label: "New invoice", to: "/billing/invoices/new", permission: "finance.invoices.create" },
    separatorBefore: true,
    nav: [
        { items: [
            { label: "Dashboard", to: "/billing", icon: LayoutDashboard, permissions: ["finance.dashboard.read"], end: true },
            { label: "Invoices", to: "/billing/invoices", icon: Receipt, permissions: ["finance.invoices.read"] },
            { label: "Credit notes", to: "/billing/credit-notes", icon: ReceiptText, permissions: ["finance.invoices.read"] },
            { label: "Approvals", to: "/billing/approvals", icon: CheckCircle2, permissions: ["finance.invoices.approve", "finance.refunds.approve", "finance.adjustments.approve"] },
        ] },
        { label: "Collect", items: [
            { label: "Subscriptions", to: "/billing/subscriptions", icon: Repeat, permissions: ["finance.subscriptions.read"] },
            { label: "Payments", to: "/billing/payments", icon: CreditCard, permissions: ["finance.payments.read"] },
            { label: "Payment links", to: "/billing/links", icon: Link2, permissions: ["finance.payments.read", "finance.payment_links.manage"] },
        ] },
        { label: "Catalog", items: [
            { label: "Products & prices", to: "/billing/catalog", icon: Package, permissions: ["finance.catalog.read"] },
            { label: "Customer billing", to: "/billing/customers", icon: Building2, permissions: ["finance.invoices.read"] },
        ] },
        { label: "Setup", items: [
            { label: "Tax rates", to: "/billing/tax", icon: Percent, permissions: ["finance.catalog.read"] },
            { label: "Payment providers", to: "/billing/providers", icon: Plug, permissions: ["finance.payment_providers.manage"] },
            { label: "Reports", to: "/billing/reports", icon: BarChart3, permissions: ["finance.reports.read"] },
        ] },
    ],
};
