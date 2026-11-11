import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Section } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSessionData, useUpdateProfile } from "@/features/session/hooks/use-session";
import { profileSettingsSchema, type ProfileSettingsFormValues } from "@/features/session/validation-schemas/settings.schema";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

const AUTO = "__auto";

/**
 * Personal profile — /settings/profile
 * @api PATCH /auth/me (own account only)
 */
export default function ProfileSettingsPage() {
    const session = useSessionData();
    const update = useUpdateProfile();
    const form = useForm<ProfileSettingsFormValues>({ resolver: zodResolver(profileSettingsSchema), defaultValues: { first_name: "", last_name: "", display_name: "", profile_photo_url: "", timezone: AUTO, locale: "" } });
    const preview = form.watch();

    useEffect(() => {
        const u = session?.user;
        if (u) form.reset({ first_name: u.first_name ?? "", last_name: u.last_name ?? "", display_name: u.display_name ?? "", profile_photo_url: u.profile_photo_url ?? "", timezone: u.timezone ?? AUTO, locale: u.locale ?? "" });
    }, [session?.user, form]);

    if (!session) return <PageSkeleton />;

    const submit = form.handleSubmit((v) =>
        update.mutate(
            { first_name: v.first_name, last_name: v.last_name, display_name: v.display_name || `${v.first_name} ${v.last_name}`, profile_photo_url: v.profile_photo_url, ...(v.timezone !== AUTO && { timezone: v.timezone }), ...(v.locale && { locale: v.locale }) },
            { onSuccess: () => { toast({ title: "Profile saved" }); form.reset(form.getValues()); }, onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) }
        )
    );

    return (
        <Section title="Profile" description="How you appear to colleagues and clients.">
            <Form {...form}>
                <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                        <Avatar className="size-12">
                            {preview.profile_photo_url && <AvatarImage src={preview.profile_photo_url} alt="" />}
                            <AvatarFallback className="bg-secondary text-muted-foreground">{initials(preview.display_name || `${preview.first_name ?? ""} ${preview.last_name ?? ""}`)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{preview.display_name || `${preview.first_name ?? ""} ${preview.last_name ?? ""}`.trim() || session.user.email}</div>
                            <div className="truncate text-xs text-muted-foreground">{session.user.email}</div>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField control={form.control} name="first_name" render={({ field }) => (<FormItem><FormLabel>First name</FormLabel><FormControl><Input autoComplete="given-name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="last_name" render={({ field }) => (<FormItem><FormLabel>Last name</FormLabel><FormControl><Input autoComplete="family-name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="display_name" render={({ field }) => (<FormItem><FormLabel>Display name</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Defaults to your full name.</FormDescription><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="profile_photo_url" render={({ field }) => (<FormItem><FormLabel>Photo URL</FormLabel><FormControl><Input type="url" placeholder="https://…" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="timezone" render={({ field }) => (
                            <FormItem><FormLabel>Timezone</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="Timezone"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value={AUTO}>Organization default</SelectItem>
                                        {field.value && field.value !== AUTO && !TimezoneOptions.some((t) => t.value === field.value) && <SelectItem value={field.value}>{field.value}</SelectItem>}
                                        {TimezoneOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                    </SelectContent></Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="locale" render={({ field }) => (<FormItem><FormLabel>Locale</FormLabel><FormControl><Input placeholder="en-GB" {...field} /></FormControl><FormDescription>Number and date formatting.</FormDescription><FormMessage /></FormItem>)} />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>Save profile</Button>
                    </div>
                </form>
            </Form>
        </Section>
    );
}
