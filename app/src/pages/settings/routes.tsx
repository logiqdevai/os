import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { SettingsLayout } from "./components/settings-layout";

const ProfilePage = lazy(() => import("./pages/profile"));
const PasswordPage = lazy(() => import("./pages/password"));
const AppearancePage = lazy(() => import("./pages/appearance"));
const SessionsPage = lazy(() => import("./pages/sessions"));
const SecurityPage = lazy(() => import("./pages/security"));

/** /settings/* — personal settings of the signed-in person (no organization permission needed). */
export default function SettingsRoutes() {
    return (
        <Routes>
            <Route element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/profile" replace />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="password" element={<PasswordPage />} />
                <Route path="appearance" element={<AppearancePage />} />
                <Route path="security" element={<SecurityPage />} />
                <Route path="sessions" element={<SessionsPage />} />
                <Route path="*" element={<Navigate to="/settings/profile" replace />} />
            </Route>
        </Routes>
    );
}
