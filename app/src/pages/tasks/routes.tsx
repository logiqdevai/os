import { lazy, type ReactElement } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";
import { QuickCreateProvider } from "./components/quick-create";

const MinePage = lazy(() => import("./pages/mine"));
const AllPage = lazy(() => import("./pages/all"));
const BoardPage = lazy(() => import("./pages/board"));
const NewPage = lazy(() => import("./pages/new"));
const DetailPage = lazy(() => import("./pages/detail"));
const CyclesPage = lazy(() => import("./pages/cycles"));
const CyclePage = lazy(() => import("./pages/cycle"));
const ReleasesPage = lazy(() => import("./pages/releases"));
const ReleasePage = lazy(() => import("./pages/release"));
const WorkloadPage = lazy(() => import("./pages/workload"));
const SettingsPage = lazy(() => import("./pages/settings"));

const read = (el: ReactElement) => <RequirePermission permission="tasks.tasks.read">{el}</RequirePermission>;

/** /tasks/* — 06 Task Management (app/mockups/modules/06-tasks). Press "c" for quick create. */
export default function TasksRoutes() {
    return (
        <QuickCreateProvider>
            <Routes>
                <Route index element={read(<MinePage />)} />
                <Route path="all" element={read(<AllPage />)} />
                <Route path="board" element={read(<BoardPage />)} />
                <Route path="new" element={<RequirePermission permission="tasks.tasks.create"><NewPage /></RequirePermission>} />
                <Route path="cycles" element={read(<CyclesPage />)} />
                <Route path="cycles/:cycleId" element={read(<CyclePage />)} />
                <Route path="releases" element={read(<ReleasesPage />)} />
                <Route path="releases/:releaseId" element={read(<ReleasePage />)} />
                <Route path="workload" element={<RequirePermission permission="tasks.workload.read"><WorkloadPage /></RequirePermission>} />
                <Route path="settings" element={<RequirePermission permission="tasks.workflows.manage"><SettingsPage /></RequirePermission>} />
                <Route path=":identifier" element={read(<DetailPage />)} />
            </Routes>
        </QuickCreateProvider>
    );
}
