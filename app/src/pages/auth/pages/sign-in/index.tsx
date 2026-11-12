import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSignIn, useVerifyMfa } from "@/features/session/hooks/use-session";
import { isMfaChallenge, type AuthResponse, type MfaChallenge } from "@/features/session/interfaces/session.interfaces";
import { signInSchema, type SignInFormValues } from "@/features/session/validation-schemas/session.schema";
import { getApiErrorMessage } from "@/lib/api-error";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { toast } from "@/hooks/use-toast";
import { AuthCard, FieldError } from "../../components/auth-card";

const safeNext = (next: string | null) => (next && next.startsWith("/") ? next : "/home");

/**
 * Sign in — /auth/sign-in. Password first; accounts with MFA then enter a code or a recovery code (01 §74).
 * `?reason=idle` explains a sign-out after the organization's idle timeout (01 §73).
 * @api POST /auth/email/login → session | { mfa_required, mfa_token } · POST /auth/mfa/verify
 */
export default function SignInPage() {
    usePageMetadata({ title: "Sign in" });
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const signIn = useSignIn();
    const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
    const form = useForm<SignInFormValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
    const next = params.get("next");
    const idle = params.get("reason") === "idle";
    const passwordReset = params.get("reason") === "password-reset";

    const enter = (res: AuthResponse) => {
        if (res.recovery_codes_remaining !== null && res.recovery_codes_remaining !== undefined) {
            toast({
                title: `Signed in with a recovery code — ${res.recovery_codes_remaining} left`,
                description: "Create new codes in Settings → Two-step verification if you are running low.",
                variant: res.recovery_codes_remaining <= 2 ? "destructive" : "default",
            });
        }
        navigate(res.mfa_enrollment_required ? `/mfa-setup?next=${encodeURIComponent(safeNext(next))}` : safeNext(next), { replace: true });
    };

    const submit = form.handleSubmit((values) =>
        signIn.mutate(values, { onSuccess: (res) => (isMfaChallenge(res) ? setChallenge(res) : enter(res)) })
    );

    if (challenge) return <MfaStep challenge={challenge} onBack={() => { setChallenge(null); form.setValue("password", ""); }} onSignedIn={enter} />;

    return (
        <AuthCard
            title="Sign in"
            description="Welcome back. Sign in to your agency workspace."
            footer={
                <>
                    New to Logiqdev OS?{" "}
                    <Link to={`/auth/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-foreground hover:underline">
                        Create an account
                    </Link>
                </>
            }
        >
            <form onSubmit={submit} className="space-y-4" noValidate>
                {idle && !signIn.isError && (
                    <Alert>
                        <Clock className="size-4" />
                        <AlertDescription>You were signed out after a period of inactivity. Sign in again to continue.</AlertDescription>
                    </Alert>
                )}
                {passwordReset && !signIn.isError && (
                    <Alert>
                        <AlertDescription>Your password was updated. Sign in with your new password.</AlertDescription>
                    </Alert>
                )}
                {signIn.isError && (
                    <Alert variant="destructive">
                        <AlertDescription>{getApiErrorMessage(signIn.error)}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" autoComplete="email" autoFocus {...form.register("email")} />
                    <FieldError message={form.formState.errors.email?.message} />
                </div>
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Link to="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                            Forgot password?
                        </Link>
                    </div>
                    <PasswordInput id="password" autoComplete="current-password" {...form.register("password")} />
                    <FieldError message={form.formState.errors.password?.message} />
                </div>
                <Button type="submit" className="w-full" size="lg" loading={signIn.isPending}>
                    Sign in
                </Button>
            </form>
        </AuthCard>
    );
}

function MfaStep({ challenge, onBack, onSignedIn }: { challenge: MfaChallenge; onBack: () => void; onSignedIn: (res: AuthResponse) => void }) {
    const verify = useVerifyMfa();
    const [useRecovery, setUseRecovery] = useState(false);
    const [value, setValue] = useState("");
    const expired = (verify.error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code === "mfa_challenge_expired";
    const valid = useRecovery ? value.trim().length >= 10 : value.length === 6;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        verify.mutate(
            { mfa_token: challenge.mfa_token, ...(useRecovery ? { recovery_code: value.trim() } : { code: value }) },
            { onSuccess: onSignedIn, onError: () => setValue("") }
        );
    };

    return (
        <AuthCard
            title="Two-step verification"
            description={useRecovery ? "Enter one of the recovery codes you saved when you set up two-step verification." : "Enter the 6-digit code from your authenticator app."}
            footer={<button type="button" onClick={onBack} className="font-medium text-foreground hover:underline">Back to sign in</button>}
        >
            <form onSubmit={submit} className="space-y-4" noValidate>
                {verify.isError && (
                    <Alert variant="destructive">
                        <AlertDescription>{getApiErrorMessage(verify.error)}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-1.5">
                    <Label htmlFor="mfa-code">{useRecovery ? "Recovery code" : "Code"}</Label>
                    <Input
                        id="mfa-code"
                        autoFocus
                        autoComplete="one-time-code"
                        inputMode={useRecovery ? "text" : "numeric"}
                        placeholder={useRecovery ? "abcde-fghjk" : "123456"}
                        className="font-mono text-base tracking-[0.3em]"
                        value={value}
                        disabled={expired}
                        onChange={(e) => setValue(useRecovery ? e.target.value.slice(0, 24) : e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                </div>
                {expired ? (
                    <Button type="button" className="w-full" size="lg" onClick={onBack}>Enter your password again</Button>
                ) : (
                    <Button type="submit" className="w-full" size="lg" disabled={!valid} loading={verify.isPending}>Verify</Button>
                )}
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setUseRecovery((v) => !v); setValue(""); verify.reset(); }}>
                    {useRecovery ? "Use your authenticator app instead" : "Lost your phone? Use a recovery code"}
                </button>
            </form>
        </AuthCard>
    );
}
