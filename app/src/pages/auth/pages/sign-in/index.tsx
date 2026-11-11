import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSignIn } from "@/features/session/hooks/use-session";
import { signInSchema, type SignInFormValues } from "@/features/session/validation-schemas/session.schema";
import { getApiErrorMessage } from "@/lib/api-error";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { AuthCard, FieldError } from "../../components/auth-card";

export default function SignInPage() {
    usePageMetadata({ title: "Sign in" });
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const signIn = useSignIn();
    const form = useForm<SignInFormValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
    const next = params.get("next");

    const submit = form.handleSubmit((values) =>
        signIn.mutate(values, { onSuccess: () => navigate(next && next.startsWith("/") ? next : "/home", { replace: true }) })
    );

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
