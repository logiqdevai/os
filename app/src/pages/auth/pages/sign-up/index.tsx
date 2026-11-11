import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useInvitation, useSignUp } from "@/features/session/hooks/use-session";
import { signUpSchema, type SignUpFormValues } from "@/features/session/validation-schemas/session.schema";
import { getApiErrorMessage } from "@/lib/api-error";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { AuthCard, FieldError } from "../../components/auth-card";

export default function SignUpPage() {
    usePageMetadata({ title: "Create account" });
    const [params] = useSearchParams();
    const invitationToken = params.get("invitation");
    const invitation = useInvitation(invitationToken);
    const navigate = useNavigate();
    const signUp = useSignUp();
    const form = useForm<SignUpFormValues>({
        resolver: zodResolver(signUpSchema),
        values: { first_name: "", last_name: "", email: invitation.data?.email ?? "", password: "", organization_name: "" },
    });

    const submit = form.handleSubmit((values) => {
        if (!invitationToken && !values.organization_name) {
            form.setError("organization_name", { message: "Enter your agency's name" });
            return;
        }
        signUp.mutate(
            { ...values, organization_name: invitationToken ? undefined : values.organization_name, invitation_token: invitationToken ?? undefined },
            { onSuccess: () => navigate("/home", { replace: true }) }
        );
    });

    return (
        <AuthCard
            title={invitation.data ? `Join ${invitation.data.organization.display_name}` : "Create your workspace"}
            description={invitation.data ? `You were invited${invitation.data.role ? ` as ${invitation.data.role.name}` : ""}. Create your account to accept.` : "Run projects, clients, billing and your team from one place."}
            footer={
                <>
                    Already have an account?{" "}
                    <Link to={invitationToken ? `/auth/invite/${invitationToken}` : "/auth/sign-in"} className="font-medium text-foreground hover:underline">
                        Sign in
                    </Link>
                </>
            }
        >
            <form onSubmit={submit} className="space-y-4" noValidate>
                {signUp.isError && (
                    <Alert variant="destructive">
                        <AlertDescription>{getApiErrorMessage(signUp.error)}</AlertDescription>
                    </Alert>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="first_name">First name</Label>
                        <Input id="first_name" autoComplete="given-name" autoFocus {...form.register("first_name")} />
                        <FieldError message={form.formState.errors.first_name?.message} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="last_name">Last name</Label>
                        <Input id="last_name" autoComplete="family-name" {...form.register("last_name")} />
                        <FieldError message={form.formState.errors.last_name?.message} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="email">Work email</Label>
                    <Input id="email" type="email" autoComplete="email" readOnly={!!invitation.data} {...form.register("email")} />
                    <FieldError message={form.formState.errors.email?.message} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
                    <FieldError message={form.formState.errors.password?.message} />
                </div>
                {!invitationToken && (
                    <div className="space-y-1.5">
                        <Label htmlFor="organization_name">Agency name</Label>
                        <Input id="organization_name" autoComplete="organization" placeholder="Acme Studio" {...form.register("organization_name")} />
                        <FieldError message={form.formState.errors.organization_name?.message} />
                    </div>
                )}
                <Button type="submit" className="w-full" size="lg" loading={signUp.isPending}>
                    {invitationToken ? "Create account and join" : "Create workspace"}
                </Button>
            </form>
        </AuthCard>
    );
}
