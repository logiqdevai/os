import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const ListPage = lazy(() => import("./index"));
const DashboardPage = lazy(() => import("./pages/dashboard"));
const NewPage = lazy(() => import("./pages/new"));
const DetailPage = lazy(() => import("./pages/detail"));
const SignaturesPage = lazy(() => import("./pages/signatures"));
const ObligationsPage = lazy(() => import("./pages/obligations"));
const RenewalsPage = lazy(() => import("./pages/renewals"));
const LibraryPage = lazy(() => import("./pages/library"));

const LIBRARY = ["contracts.templates.manage", "contracts.clauses.manage", "contracts.types.manage", "contracts.approval_rules.manage"];

/** /contracts/* — module 04 (app/mockups/modules/04-contracts). Every route is gated by its VIEW permission. */
export default function ContractsRoutes() {
    const read = (el: React.ReactNode) => <RequirePermission permission="contracts.contracts.read">{el}</RequirePermission>;
    return (
        <Routes>
            <Route index element={read(<ListPage />)} />
            <Route path="dashboard" element={read(<DashboardPage />)} />
            <Route path="new" element={<RequirePermission permission="contracts.contracts.create"><NewPage /></RequirePermission>} />
            <Route path="signatures" element={<RequirePermission permission="contracts.signatures.read"><SignaturesPage /></RequirePermission>} />
            <Route path="obligations" element={read(<ObligationsPage />)} />
            <Route path="renewals" element={read(<RenewalsPage />)} />
            <Route path="templates" element={<RequirePermission anyOf={LIBRARY}><LibraryPage /></RequirePermission>} />
            <Route path=":id" element={read(<DetailPage />)} />
            <Route path="*" element={read(<ListPage />)} />
        </Routes>
    );
}
