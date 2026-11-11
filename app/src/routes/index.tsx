import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthLayout from "@/pages/auth/layout";
import SignInPage from "@/pages/auth/pages/sign-in";
import SignUpPage from "@/pages/auth/pages/sign-up";
import ForgotPasswordPage from "@/pages/auth/pages/forgot-password";
import ResetPasswordPage from "@/pages/auth/pages/reset-password";
import InvitePage from "@/pages/auth/pages/invite";
import AppShell from "@/components/layout/app-shell";
import { PageSkeleton } from "@/components/ui/states";
import ErrorBoundary from "@/components/ui/error-boundary";
import { MODULE_ROUTES } from "./module-routes";
import { PUBLIC_ROUTES } from "./public-routes";

export default function AppRoutes() {
    return (
        <Routes>
            <Route path="/auth" element={<AuthLayout />}>
                <Route path="sign-in" element={<SignInPage />} />
                <Route path="sign-up" element={<SignUpPage />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />
                <Route path="reset-password" element={<ResetPasswordPage />} />
                <Route path="invite/:token" element={<InvitePage />} />
                <Route index element={<Navigate to="/auth/sign-in" replace />} />
            </Route>

            {PUBLIC_ROUTES.map(({ path, Component }) => (
                <Route
                    key={path}
                    path={path}
                    element={
                        <Suspense fallback={<PageSkeleton />}>
                            <Component />
                        </Suspense>
                    }
                />
            ))}

            <Route element={<AppShell />}>
                {MODULE_ROUTES.map(({ path, Component }) => (
                    <Route
                        key={path}
                        path={path}
                        element={
                            <ErrorBoundary>
                                <Suspense fallback={<PageSkeleton />}>
                                    <Component />
                                </Suspense>
                            </ErrorBoundary>
                        }
                    />
                ))}
                <Route index element={<Navigate to="/home" replace />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
            </Route>
        </Routes>
    );
}
