import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";
import { Page } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/states";

const Dashboard = lazy(() => import("./pages/dashboard"));
const Invoices = lazy(() => import("./pages/invoices"));
const InvoiceEditor = lazy(() => import("./pages/invoice-editor"));
const InvoiceDetail = lazy(() => import("./pages/invoice-detail"));
const CreditNotes = lazy(() => import("./pages/credit-notes"));
const Payments = lazy(() => import("./pages/payments"));
const PaymentDetail = lazy(() => import("./pages/payment-detail"));
const Subscriptions = lazy(() => import("./pages/subscriptions"));
const SubscriptionDetail = lazy(() => import("./pages/subscription-detail"));
const Catalog = lazy(() => import("./pages/catalog"));
const Customers = lazy(() => import("./pages/customers"));
const CustomerDetail = lazy(() => import("./pages/customer-detail"));
const TaxRates = lazy(() => import("./pages/tax-rates"));
const Providers = lazy(() => import("./pages/providers"));
const PaymentLinks = lazy(() => import("./pages/payment-links"));
const Reports = lazy(() => import("./pages/reports"));
const Approvals = lazy(() => import("./pages/approvals"));

/** /billing/* — each route gated by its VIEW permission (app/mockups/modules/08-billing). */
export default function BillingRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission permission="finance.dashboard.read"><Dashboard /></RequirePermission>} />
            <Route path="invoices" element={<RequirePermission permission="finance.invoices.read"><Invoices /></RequirePermission>} />
            <Route path="invoices/new" element={<RequirePermission permission="finance.invoices.create"><InvoiceEditor /></RequirePermission>} />
            <Route path="invoices/:id" element={<RequirePermission permission="finance.invoices.read"><InvoiceDetail /></RequirePermission>} />
            <Route path="invoices/:id/edit" element={<RequirePermission permission="finance.invoices.update"><InvoiceEditor /></RequirePermission>} />
            <Route path="credit-notes" element={<RequirePermission permission="finance.invoices.read"><CreditNotes /></RequirePermission>} />
            <Route path="payments" element={<RequirePermission permission="finance.payments.read"><Payments /></RequirePermission>} />
            <Route path="payments/:id" element={<RequirePermission permission="finance.payments.read"><PaymentDetail /></RequirePermission>} />
            <Route path="subscriptions" element={<RequirePermission permission="finance.subscriptions.read"><Subscriptions /></RequirePermission>} />
            <Route path="subscriptions/:id" element={<RequirePermission permission="finance.subscriptions.read"><SubscriptionDetail /></RequirePermission>} />
            <Route path="catalog" element={<RequirePermission permission="finance.catalog.read"><Catalog /></RequirePermission>} />
            <Route path="customers" element={<RequirePermission permission="finance.invoices.read"><Customers /></RequirePermission>} />
            <Route path="customers/:id" element={<RequirePermission permission="finance.invoices.read"><CustomerDetail /></RequirePermission>} />
            <Route path="tax" element={<RequirePermission permission="finance.catalog.read"><TaxRates /></RequirePermission>} />
            <Route path="providers" element={<RequirePermission permission="finance.payment_providers.manage"><Providers /></RequirePermission>} />
            <Route path="links" element={<RequirePermission anyOf={["finance.payments.read", "finance.payment_links.manage"]}><PaymentLinks /></RequirePermission>} />
            <Route path="reports" element={<RequirePermission permission="finance.reports.read"><Reports /></RequirePermission>} />
            <Route path="approvals" element={<RequirePermission anyOf={["finance.invoices.approve", "finance.refunds.approve", "finance.adjustments.approve"]}><Approvals /></RequirePermission>} />
            <Route path="*" element={<Page><EmptyState title="Page not found" description="This billing page does not exist." /></Page>} />
        </Routes>
    );
}
