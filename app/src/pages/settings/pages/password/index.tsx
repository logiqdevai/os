import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useChangePassword } from "@/features/session/hooks/use-session";
import { changePasswordSchema, type ChangePasswordFormValues } from "@/features/session/validation-schemas/settings.schema";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Change password — /settings/password
 * @api POST /auth/me/password (audited as user.password_changed)
 */
export default function PasswordSettingsPage() {
    const change = useChangePassword();
    const form = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: { current_password: "", new_password: "", confirm: "" } });
    /** Shown next to the button after a successful change (no toast); cleared as soon as the form is edited again. */
    const [changed, setChanged] = useState(false);
    const dirty = form.formState.isDirty;
    useEffect(() => { if (dirty) setChanged(false); }, [dirty]);

    const submit = form.handleSubmit((v) =>
        change.mutate(
            { current_password: v.current_password, new_password: v.new_password },
            {
                onSuccess: () => { form.reset(); setChanged(true); },
                onError: (e) => {
                    const message = getApiErrorMessage(e);
                    form.setError(/current password/i.test(message) ? "current_password" : "root", { message });
                },
            }
        )
    );

    return (
        <Section title="Password" description="Use a long password you do not use anywhere else.">
            <Form {...form}>
                <form onSubmit={submit} className="max-w-md space-y-4 rounded-lg border border-border bg-card p-4">
                    <FormField control={form.control} name="current_password" render={({ field }) => (<FormItem><FormLabel>Current password</FormLabel><FormControl><PasswordInput autoComplete="current-password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="new_password" render={({ field }) => (<FormItem><FormLabel>New password</FormLabel><FormControl><PasswordInput autoComplete="new-password" {...field} /></FormControl><FormDescription>At least 8 characters.</FormDescription><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="confirm" render={({ field }) => (<FormItem><FormLabel>Confirm new password</FormLabel><FormControl><PasswordInput autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    {form.formState.errors.root && <p className="text-xs text-danger">{form.formState.errors.root.message}</p>}
                    <div className="flex items-center justify-end gap-3">
                        {changed && <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3.5 text-success" /> Password changed</span>}
                        <Button type="submit" loading={change.isPending}>Change password</Button>
                    </div>
                </form>
            </Form>
        </Section>
    );
}
