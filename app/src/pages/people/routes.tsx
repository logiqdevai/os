import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const EmployeesPage = lazy(() => import("./pages/employees"));
const NewEmployeePage = lazy(() => import("./pages/employee-new"));
const EmployeeDetailPage = lazy(() => import("./pages/employee-detail"));
const DashboardPage = lazy(() => import("./pages/dashboard"));
const LeavePage = lazy(() => import("./pages/leave"));
const LeaveCalendarPage = lazy(() => import("./pages/leave-calendar"));
const LeaveBalancesPage = lazy(() => import("./pages/leave-balances"));
const AttendancePage = lazy(() => import("./pages/attendance"));
const CapacityPage = lazy(() => import("./pages/capacity"));
const SkillsPage = lazy(() => import("./pages/skills"));
const PerformancePage = lazy(() => import("./pages/performance"));
const ReviewDetailPage = lazy(() => import("./pages/review-detail"));
const OrgChartPage = lazy(() => import("./pages/org-chart"));
const ChangeRequestsPage = lazy(() => import("./pages/change-requests"));
const SettingsPage = lazy(() => import("./pages/settings"));
const ImportPage = lazy(() => import("./pages/import"));

const LEAVE_READ = ["employees.leave.read_own", "employees.leave.read_all", "employees.leave.approve"];

/** /people/* — 10 Employee Management. Every route is gated by its VIEW permission (app/mockups/modules/10-people). */
export default function PeopleRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission anyOf={["employees.employees.read", "employees.directory.read"]}><EmployeesPage /></RequirePermission>} />
            <Route path="dashboard" element={<RequirePermission anyOf={["employees.employees.read", "employees.leave.read_all", "employees.attendance.read_all", "employees.capacity.read", "employees.performance.read_all"]}><DashboardPage /></RequirePermission>} />
            <Route path="new" element={<RequirePermission permission="employees.employees.create"><NewEmployeePage /></RequirePermission>} />
            <Route path="me" element={<EmployeeDetailPage self />} />
            <Route path="employees/:employeeId" element={<RequirePermission anyOf={["employees.employees.read", "employees.directory.read"]}><EmployeeDetailPage /></RequirePermission>} />
            <Route path="org-chart" element={<RequirePermission permission="employees.directory.read"><OrgChartPage /></RequirePermission>} />
            <Route path="changes" element={<RequirePermission anyOf={["employees.employees.update", "employees.profile.update_own"]}><ChangeRequestsPage /></RequirePermission>} />
            <Route path="import" element={<RequirePermission allOf={["employees.employees.import", "employees.employees.create"]}><ImportPage /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission anyOf={["employees.settings.manage", "employees.leave.manage_policies"]}><SettingsPage /></RequirePermission>} />
            <Route path="leave" element={<RequirePermission anyOf={LEAVE_READ}><LeavePage /></RequirePermission>} />
            <Route path="leave/calendar" element={<RequirePermission anyOf={["employees.leave.read_own", "employees.leave.read_all"]}><LeaveCalendarPage /></RequirePermission>} />
            <Route path="leave/balances" element={<RequirePermission anyOf={["employees.leave.read_own", "employees.leave.read_all"]}><LeaveBalancesPage /></RequirePermission>} />
            <Route path="attendance" element={<RequirePermission anyOf={["employees.attendance.read_own", "employees.attendance.read_all", "employees.attendance.record_own"]}><AttendancePage /></RequirePermission>} />
            <Route path="capacity" element={<RequirePermission permission="employees.capacity.read"><CapacityPage /></RequirePermission>} />
            <Route path="skills" element={<RequirePermission anyOf={["employees.skills.read", "employees.profile.update_own"]}><SkillsPage /></RequirePermission>} />
            <Route path="performance" element={<RequirePermission anyOf={["employees.performance.read_own", "employees.performance.read_all", "employees.performance.manage"]}><PerformancePage /></RequirePermission>} />
            <Route path="performance/reviews/:reviewId" element={<RequirePermission anyOf={["employees.performance.read_own", "employees.performance.read_all", "employees.performance.manage"]}><ReviewDetailPage /></RequirePermission>} />
            <Route path="*" element={<RequirePermission anyOf={["employees.employees.read", "employees.directory.read"]}><EmployeesPage /></RequirePermission>} />
        </Routes>
    );
}
