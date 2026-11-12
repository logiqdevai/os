import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SESSION_QUERY_KEY, useLogout, useSession } from "@/features/session/hooks/use-session";
import { isLoggedIn, useAuthStore } from "@/stores/auth";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { MfaRequiredReasonOptions } from "@/config/constants/dropdowns/admin/security-form.options";
import { MfaEnrollment } from "../../components/mfa/mfa-enrollment";

const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("/mfa-setup") ? next : "/home");

/**
 * Forced enrolment — /mfa-setup (01 §74). Shown instead of the app when the organization's security policy requires
 * MFA and the person has not set it up. The API answers 403 `mfa_enrollment_required` everywhere else until then.
 * @api GET /auth/me (mfa.enrollment_required) · POST /auth/mfa/totp/setup|confirm
 */
export default function MfaSetupPage() {
    usePageMetadata({ title: "Set up two-step verification" });
    const auth = useAuthStore();
    const location = useLocation();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const session = useSession();
    const logout = useLogout();
    const queryClient = useQueryClient();
    const next = safeNext(params.get("next"));

    if (!isLoggedIn(auth)) return <Navigate to={`/auth/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    if (session.isPending) return <PageSkeleton />;
    if (session.error) return <ErrorState error={session.error} onRetry={() => session.refetch()} className="h-dvh" />;
    if (!session.data.mfa.enrollment_required) return <Navigate to={next} replace />;

    const reason = getDropdownOptionLabel(MfaRequiredReasonOptions, session.data.mfa.required_reason ?? "ALL").toLowerCase();
    const org = session.data.active_organization?.display_name ?? "Your organization";

    return (
        <TooltipProvider>
            <div className="flex min-h-dvh flex-col bg-background">
                <div className="flex items-center justify-between gap-2 px-4 py-4 md:px-8">
                    <div className="flex items-center gap-2">
                        <div className="grid size-8 place-items-center rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground">L</div>
                        <span className="text-[15px] font-semibold text-foreground">Logiqdev OS</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <ThemeToggle />
                        <Button variant="ghost" size="sm" loading={logout.isPending} onClick={() => logout.mutate()}><LogOut /> Sign out</Button>
                    </div>
                </div>
                <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 md:pt-12">
                    <div className="w-full max-w-[480px] space-y-6">
                        <div className="space-y-1.5">
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Set up two-step verification</h1>
                            <p className="text-[13.5px] text-muted-foreground">
                                {org} requires it {reason}. You can continue as {session.data.user.email} once it is on.
                            </p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-5">
                            <MfaEnrollment
                                onDone={async () => {
                                    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
                                    navigate(next, { replace: true });
                                }}
                            />
                        </div>
                    </div>
                </main>
            </div>
        </TooltipProvider>
    );
}
