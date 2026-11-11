import { Building2, CreditCard, DollarSign, LayoutDashboard, Package, Percent, Plug, Receipt, ReceiptText, Repeat } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const billingApp: AppDefinition = {
    id: "billing",
    label: "Billing",
    icon: DollarSign,
    basePath: "/billing",
    module: "FINANCE",
    viewPermissions: ["finance.invoices.read", "finance.dashboard.read"],
    newAction: { label: "New invoice", to: "/billing/invoices/new", permission: "finance.invoices.create" },
    separatorBefore: true,
    nav: [
        { items: [
            { label: "Dashboard", to: "/billing", icon: LayoutDashboard, permissions: ["finance.dashboard.read"], end: true },
            { label: "Invoices", to: "/billing/invoices", icon: Receipt, permissions: ["finance.invoices.read"] },
            { label: "Credit notes", to: "/billing/credit-notes", icon: ReceiptText, permissions: ["finance.invoices.read"] },
        ] },
        { label: "Collect", items: [
            { label: "Subscriptions", to: "/billing/subscriptions", icon: Repeat, permissions: ["finance.subscriptions.read"] },
            { label: "Payments", to: "/billing/payments", icon: CreditCard, permissions: ["finance.payments.read"] },
        ] },
        { label: "Catalog", items: [
            { label: "Products & prices", to: "/billing/catalog", icon: Package, permissions: ["finance.catalog.read"] },
            { label: "Customer billing", to: "/billing/customers", icon: Building2, permissions: ["finance.invoices.read"] },
        ] },
        { label: "Setup", items: [
            { label: "Tax rates", to: "/billing/tax", icon: Percent, permissions: ["finance.settings.manage"] },
            { label: "Payment providers", to: "/billing/providers", icon: Plug, permissions: ["finance.settings.manage"] },
        ] },
    ],
};
