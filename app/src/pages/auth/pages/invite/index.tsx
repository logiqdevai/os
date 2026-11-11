import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ListSkeleton } from "@/components/ui/states";
import { useAcceptInvitation, useInvitation, useSessionData } from "@/features/session/hooks/use-session";
import { isLoggedIn, useAuthStore } from "@/stores/auth";
import { getApiErrorMessage } from "@/lib/api-error";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { AuthCard } from "../../components/auth-card";

/** /auth/invite/:token — accept an invitation (signed in) or continue to sign up / sign in. */
export default function InvitePage() {
    usePageMetadata({ title: "Invitation" });
    const { token = "" } = useParams();
    const invitation = useInvitation(token);
    const auth = useAuthStore();
    const session = useSessionData();
    const accept = useAcceptInvitation();
    const navigate = useNavigate();
    const setOrganization = useAuthStore((s) => s.setOrganization);

    if (invitation.isLoading) return <ListSkeleton rows={3} />;
    if (invitation.error || !invitation.data) {
        return (
            <AuthCard title="Invitation not found" footer={<Link to="/auth/sign-in" className="font-medium text-foreground hover:underline">Go to sign in</Link>}>
                <p className="text-[13px] text-body">This invitation link is invalid. Ask the person who invited you to send a new one.</p>
            </AuthCard>
        );
    }
    const inv = invitation.data;
    if (inv.status !== "PENDING") {
        return (
            <AuthCard title="Invitation is no longer valid" footer={<Link to="/home" className="font-medium text-foreground hover:underline">Continue</Link>}>
                <p className="text-[13px] text-body">This invitation is {inv.status.toLowerCase()}. Ask {inv.organization.display_name} for a new one.</p>
            </AuthCard>
        );
    }

    const signedIn = isLoggedIn(auth);
    const wrongAccount = signedIn && session && session.user.email.toLowerCase() !== inv.email.toLowerCase();

    return (
        <AuthCard
            title={`Join ${inv.organization.display_name}`}
            description={`Invitation for ${inv.email}${inv.role ? ` · ${inv.role.name}` : ""} · expires ${formatDate(inv.expires_at)}`}
        >
            {accept.isError && (
                <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{getApiErrorMessage(accept.error)}</AlertDescription>
                </Alert>
            )}
            {!signedIn ? (
                <div className="space-y-2">
                    <Button asChild className="w-full" size="lg">
                        <Link to={inv.has_account ? `/auth/sign-in?next=${encodeURIComponent(`/auth/invite/${token}`)}` : `/auth/sign-up?invitation=${token}`}>
                            {inv.has_account ? "Sign in to accept" : "Create account to accept"}
                        </Link>
                    </Button>
                </div>
            ) : wrongAccount ? (
                <p className="text-[13px] text-body">
                    You're signed in as {session?.user.email}. Sign out and sign in as {inv.email} to accept.
                </p>
            ) : (
                <Button
                    className="w-full"
                    size="lg"
                    loading={accept.isPending}
                    onClick={() =>
                        accept.mutate(token, {
                            onSuccess: (res: { organization_id: string }) => {
                                setOrganization(res.organization_id);
                                toast({ title: `You joined ${inv.organization.display_name}` });
                                navigate("/home", { replace: true });
                            },
                        })
                    }
                >
                    Accept invitation
                </Button>
            )}
        </AuthCard>
    );
}
