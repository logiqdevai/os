import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useResetPassword } from "@/features/session/hooks/use-session";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/features/session/validation-schemas/session.schema";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/hooks/use-toast";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { AuthCard, FieldError } from "../../components/auth-card";

export default function ResetPasswordPage() {
    usePageMetadata({ title: "Choose a new password" });
    const [params] = useSearchParams();
    const token = params.get("token") ?? "";
    const navigate = useNavigate();
    const reset = useResetPassword();
    const form = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirm: "" } });

    if (!token) {
        return (
            <AuthCard title="Link is invalid" footer={<Link to="/auth/forgot-password" className="font-medium text-foreground hover:underline">Request a new link</Link>}>
                <p className="text-[13px] text-body">This reset link is missing its token. Request a new one.</p>
            </AuthCard>
        );
    }

    return (
        <AuthCard title="Choose a new password">
            <form
                onSubmit={form.handleSubmit((v) =>
                    reset.mutate(
                        { token, password: v.password },
                        {
                            onSuccess: () => {
                                toast({ title: "Password updated", description: "Sign in with your new password." });
                                navigate("/auth/sign-in", { replace: true });
                            },
                        }
                    )
                )}
                className="space-y-4"
                noValidate
            >
                {reset.isError && (
                    <Alert variant="destructive">
                        <AlertDescription>{getApiErrorMessage(reset.error)}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-1.5">
                    <Label htmlFor="password">New password</Label>
                    <PasswordInput id="password" autoComplete="new-password" autoFocus {...form.register("password")} />
                    <FieldError message={form.formState.errors.password?.message} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <PasswordInput id="confirm" autoComplete="new-password" {...form.register("confirm")} />
                    <FieldError message={form.formState.errors.confirm?.message} />
                </div>
                <Button type="submit" className="w-full" size="lg" loading={reset.isPending}>
                    Update password
                </Button>
            </form>
        </AuthCard>
    );
}
