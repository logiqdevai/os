import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Section } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRemoveProfilePhoto, useSessionData, useUpdateProfile, useUploadProfilePhoto } from "@/features/session/hooks/use-session";
import { profileSettingsSchema, type ProfileSettingsFormValues } from "@/features/session/validation-schemas/settings.schema";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

const AUTO = "__auto";

/**
 * Personal profile — /settings/profile
 * @api PATCH /auth/me (own account only); photo: POST / DELETE /auth/me/photo
 */
export default function ProfileSettingsPage() {
    const session = useSessionData();
    const update = useUpdateProfile();
    const form = useForm<ProfileSettingsFormValues>({ resolver: zodResolver(profileSettingsSchema), defaultValues: { first_name: "", last_name: "", display_name: "", timezone: AUTO, locale: "", phone: "" } });
    const preview = form.watch();

    useEffect(() => {
        const u = session?.user;
        if (u) form.reset({ first_name: u.first_name ?? "", last_name: u.last_name ?? "", display_name: u.display_name ?? "", timezone: u.timezone ?? AUTO, locale: u.locale ?? "", phone: u.phone ?? "" });
    }, [session?.user, form]);

    if (!session) return <PageSkeleton />;

    const submit = form.handleSubmit((v) =>
        update.mutate(
            { first_name: v.first_name, last_name: v.last_name, display_name: v.display_name || `${v.first_name} ${v.last_name}`, ...(v.timezone !== AUTO && { timezone: v.timezone }), ...(v.locale && { locale: v.locale }), phone: v.phone || null },
            { onSuccess: () => { toast({ title: "Profile saved" }); form.reset(form.getValues()); }, onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) }
        )
    );

    return (
        <Section title="Profile" description="How you appear to colleagues and clients.">
            <Form {...form}>
                <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4">
                    <ProfilePhoto
                        photoUrl={session.user.profile_photo_url}
                        name={preview.display_name || `${preview.first_name ?? ""} ${preview.last_name ?? ""}`.trim() || session.user.email}
                        email={session.user.email}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormField control={form.control} name="first_name" render={({ field }) => (<FormItem><FormLabel>First name</FormLabel><FormControl><Input autoComplete="given-name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="last_name" render={({ field }) => (<FormItem><FormLabel>Last name</FormLabel><FormControl><Input autoComplete="family-name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="display_name" render={({ field }) => (<FormItem><FormLabel>Display name</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Defaults to your full name.</FormDescription><FormMessage /></FormItem>)} />
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
                        <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Mobile phone</FormLabel><FormControl><Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+306912345678" {...field} /></FormControl><FormDescription>For SMS notifications you turn on in Notifications → Preferences.</FormDescription><FormMessage /></FormItem>)} />
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

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Upload / change / remove own profile photo. Saved right away, separately from the profile form. */
function ProfilePhoto({ photoUrl, name, email }: { photoUrl: string | null; name: string; email: string }) {
    const input = useRef<HTMLInputElement>(null);
    const upload = useUploadProfilePhoto();
    const remove = useRemoveProfilePhoto();
    const [confirmRemove, setConfirmRemove] = useState(false);

    const pick = (file: File | undefined) => {
        if (input.current) input.current.value = "";
        if (!file) return;
        if (!PHOTO_TYPES.includes(file.type)) return toast({ variant: "destructive", title: "Unsupported file", description: "Use a PNG, JPG, GIF or WebP image." });
        if (file.size > PHOTO_MAX_BYTES) return toast({ variant: "destructive", title: "File too large", description: "The photo must be 5 MB or smaller." });
        upload.mutate(file, {
            onSuccess: () => toast({ title: photoUrl ? "Photo changed" : "Photo added" }),
            onError: (e) => toast({ variant: "destructive", title: "Could not upload the photo", description: getApiErrorMessage(e) }),
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => input.current?.click()} disabled={upload.isPending} aria-label={photoUrl ? "Change photo" : "Upload photo"} className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="size-16">
                    {photoUrl && <AvatarImage src={photoUrl} alt="" className="object-cover" />}
                    <AvatarFallback className="bg-secondary text-base text-muted-foreground">{initials(name)}</AvatarFallback>
                </Avatar>
                <span className="absolute inset-0 grid place-items-center rounded-full bg-scrim text-on-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Camera className="size-5" />
                </span>
            </button>
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{name}</div>
                <div className="truncate text-xs text-muted-foreground">{email}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" loading={upload.isPending} onClick={() => input.current?.click()}>
                        <Camera /> {photoUrl ? "Change photo" : "Upload photo"}
                    </Button>
                    {photoUrl && (
                        <Button type="button" size="sm" variant="ghost" disabled={remove.isPending || upload.isPending} onClick={() => setConfirmRemove(true)}>
                            <Trash2 /> Remove
                        </Button>
                    )}
                    <span className="text-xs text-muted-foreground">PNG, JPG, GIF or WebP, up to 5 MB.</span>
                </div>
            </div>
            <input ref={input} type="file" accept={PHOTO_TYPES.join(",")} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <ConfirmationDialog
                isOpen={confirmRemove}
                onClose={() => setConfirmRemove(false)}
                onConfirm={() =>
                    remove.mutate(undefined, {
                        onSuccess: () => {
                            setConfirmRemove(false);
                            toast({ title: "Photo removed" });
                        },
                        onError: (e) => toast({ variant: "destructive", title: "Could not remove the photo", description: getApiErrorMessage(e) }),
                    })
                }
                title="Remove profile photo?"
                description="Colleagues and clients will see your initials instead."
                confirmText="Remove photo"
                variant="destructive"
                isLoading={remove.isPending}
            />
        </div>
    );
}
