import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForgotPassword } from "@/features/session/hooks/use-session";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/features/session/validation-schemas/session.schema";
import { getApiErrorMessage } from "@/lib/api-error";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { AuthCard, FieldError } from "../../components/auth-card";

export default function ForgotPasswordPage() {
    usePageMetadata({ title: "Reset password" });
    const forgot = useForgotPassword();
    const form = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

    if (forgot.isSuccess) {
        return (
            <AuthCard title="Check your email" footer={<Link to="/auth/sign-in" className="font-medium text-foreground hover:underline">Back to sign in</Link>}>
                <div className="flex items-start gap-3 text-[13px] text-body">
                    <MailCheck className="mt-0.5 size-5 flex-none text-success" />
                    If an account exists for {form.getValues("email")}, we sent a link to reset the password. The link expires in one hour.
                </div>
            </AuthCard>
        );
    }

    return (
        <AuthCard
            title="Reset your password"
            description="Enter the email of your account and we'll send you a reset link."
            footer={<Link to="/auth/sign-in" className="font-medium text-foreground hover:underline">Back to sign in</Link>}
        >
            <form onSubmit={form.handleSubmit((v) => forgot.mutate(v.email))} className="space-y-4" noValidate>
                {forgot.isError && (
                    <Alert variant="destructive">
                        <AlertDescription>{getApiErrorMessage(forgot.error)}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" autoComplete="email" autoFocus {...form.register("email")} />
                    <FieldError message={form.formState.errors.email?.message} />
                </div>
                <Button type="submit" className="w-full" size="lg" loading={forgot.isPending}>
                    Send reset link
                </Button>
            </form>
        </AuthCard>
    );
}
