import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";
import { Page } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/states";

const Overview = lazy(() => import("./pages/overview"));
const Ledger = lazy(() => import("./pages/ledger"));
const RecordForm = lazy(() => import("./pages/record-form"));
const RecordDetail = lazy(() => import("./pages/record-detail"));
const Recurring = lazy(() => import("./pages/recurring"));
const Vendors = lazy(() => import("./pages/vendors"));
const VendorDetail = lazy(() => import("./pages/vendor-detail"));
const Claims = lazy(() => import("./pages/claims"));
const ClaimDetail = lazy(() => import("./pages/claim-detail"));
const Budgets = lazy(() => import("./pages/budgets"));
const ProfitLoss = lazy(() => import("./pages/profit-loss"));
const Vat = lazy(() => import("./pages/vat"));
const Periods = lazy(() => import("./pages/periods"));
const Profitability = lazy(() => import("./pages/profitability"));
const Categories = lazy(() => import("./pages/categories"));
const Approvals = lazy(() => import("./pages/approvals"));

const READ = ["finance.income.read", "finance.expenses.read"];

/** /expenses/* — 09 Income & expenses; each route gated by its VIEW permission (app/mockups/modules/09-expenses). */
export default function ExpensesRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission anyOf={READ}><Overview /></RequirePermission>} />
            <Route path="ledger" element={<RequirePermission anyOf={READ}><Ledger /></RequirePermission>} />
            <Route path="new" element={<RequirePermission anyOf={["finance.income.create", "finance.expenses.create"]}><RecordForm /></RequirePermission>} />
            <Route path="records/:id" element={<RequirePermission anyOf={READ}><RecordDetail /></RequirePermission>} />
            <Route path="records/:id/edit" element={<RequirePermission anyOf={["finance.income.update", "finance.expenses.update"]}><RecordForm /></RequirePermission>} />
            <Route path="recurring" element={<RequirePermission permission="finance.recurring_expenses.read"><Recurring /></RequirePermission>} />
            <Route path="vendors" element={<RequirePermission permission="finance.expenses.read"><Vendors /></RequirePermission>} />
            <Route path="vendors/:id" element={<RequirePermission permission="finance.expenses.read"><VendorDetail /></RequirePermission>} />
            <Route path="claims" element={<RequirePermission anyOf={["finance.expense_claims.read", "finance.expense_claims.read_own"]}><Claims /></RequirePermission>} />
            <Route path="claims/:id" element={<RequirePermission anyOf={["finance.expense_claims.read", "finance.expense_claims.read_own"]}><ClaimDetail /></RequirePermission>} />
            <Route path="budgets" element={<RequirePermission permission="finance.budgets.read"><Budgets /></RequirePermission>} />
            <Route path="pnl" element={<RequirePermission permission="finance.profit_loss.read"><ProfitLoss /></RequirePermission>} />
            <Route path="vat" element={<RequirePermission permission="finance.vat.read"><Vat /></RequirePermission>} />
            <Route path="periods" element={<RequirePermission anyOf={READ}><Periods /></RequirePermission>} />
            <Route path="profitability" element={<RequirePermission permission="finance.profitability.read"><Profitability /></RequirePermission>} />
            <Route path="categories" element={<RequirePermission anyOf={[...READ, "finance.categories.manage"]}><Categories /></RequirePermission>} />
            <Route path="approvals" element={<RequirePermission anyOf={["finance.expenses.approve", "finance.expense_claims.approve"]}><Approvals /></RequirePermission>} />
            <Route path="*" element={<Page><EmptyState title="Page not found" description="This page does not exist in Income & expenses." /></Page>} />
        </Routes>
    );
}
