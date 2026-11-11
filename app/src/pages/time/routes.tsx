import { lazy } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";
import { EntryFormDialog } from "./components/entry-form-dialog";
import { TimePaths } from "./paths";

const MyWeekPage = lazy(() => import("./pages/week"));
const EntriesPage = lazy(() => import("./pages/entries"));
const TeamPage = lazy(() => import("./pages/team"));
const ApprovalsPage = lazy(() => import("./pages/approvals"));
const TimesheetDetailPage = lazy(() => import("./pages/timesheet-detail"));
const RatesPage = lazy(() => import("./pages/rates"));
const ReportsPage = lazy(() => import("./pages/reports"));
const UnbilledPage = lazy(() => import("./pages/unbilled"));
const SettingsPage = lazy(() => import("./pages/settings"));

const READ = ["time.entries.read_own", "time.entries.read_team", "time.entries.read_all"];

/** /time/new — the week page with the "Log time" dialog open (app bar "Add entry"). */
function NewEntryRoute() {
    const navigate = useNavigate();
    return (
        <>
            <MyWeekPage />
            <EntryFormDialog open onOpenChange={(o) => !o && navigate(TimePaths.week)} />
        </>
    );
}

/** /time/* — 18 Time Tracking. Every route is gated by its VIEW permission (app/mockups/modules/18-time). */
export default function TimeRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission permission="time.entries.read_own"><MyWeekPage /></RequirePermission>} />
            <Route path="new" element={<RequirePermission permission="time.entries.create_own"><NewEntryRoute /></RequirePermission>} />
            <Route path="entries" element={<RequirePermission anyOf={READ}><EntriesPage /></RequirePermission>} />
            <Route path="team" element={<RequirePermission anyOf={["time.entries.read_team", "time.entries.read_all"]}><TeamPage /></RequirePermission>} />
            <Route path="approvals" element={<RequirePermission permission="time.timesheets.approve"><ApprovalsPage /></RequirePermission>} />
            <Route path="timesheets/:timesheetId" element={<RequirePermission anyOf={[...READ, "time.timesheets.approve"]}><TimesheetDetailPage /></RequirePermission>} />
            <Route path="rates" element={<RequirePermission permission="time.rates.read"><RatesPage /></RequirePermission>} />
            <Route path="reports" element={<RequirePermission permission="time.reports.read"><ReportsPage /></RequirePermission>} />
            <Route path="unbilled" element={<RequirePermission allOf={["time.entries.read_all", "time.reports.read"]}><UnbilledPage /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission permission="time.settings.manage"><SettingsPage /></RequirePermission>} />
            <Route path="*" element={<RequirePermission anyOf={READ}><EntriesPage /></RequirePermission>} />
        </Routes>
    );
}
