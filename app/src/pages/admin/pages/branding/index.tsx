import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageOff, Trash2, Upload } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { useFormAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useOrganization, useRemoveLogo, useUpdateBranding, useUploadLogo } from "@/features/admin/organization/hooks/use-organization";
import type { LogoVariant } from "@/features/admin/organization/interfaces/organization.interfaces";
import { brandingSchema, type BrandingFormValues } from "@/features/admin/organization/validation-schemas/organization.schema";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Color input + hex text field. The brand color is user data, so the swatch is the one place we render a raw color. */
function ColorField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <input type="color" aria-label={`${label} picker`} value={HEX.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="size-8 flex-none cursor-pointer rounded-md border border-border bg-transparent p-0.5" />
            <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#2563eb" maxLength={7} className="font-mono" />
        </div>
    );
}

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** Upload / replace / remove one logo. Saved right away (separately from the autosaved form); stored in Google Cloud Storage. */
function LogoUpload({ variant, label, hint, url, dark }: { variant: LogoVariant; label: string; hint: string; url?: string | null; dark?: boolean }) {
    const input = useRef<HTMLInputElement>(null);
    const upload = useUploadLogo();
    const remove = useRemoveLogo();
    const pick = (file?: File) => {
        if (input.current) input.current.value = "";
        if (!file) return;
        if (!LOGO_TYPES.includes(file.type)) return toast({ variant: "destructive", title: "Unsupported file", description: "Use a PNG, JPG or WebP image." });
        if (file.size > LOGO_MAX_BYTES) return toast({ variant: "destructive", title: "File too large", description: "The logo must be 5 MB or smaller." });
        upload.mutate({ variant, file });
    };
    return (
        <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">{label}</div>
            <div className={`flex h-20 items-center justify-center rounded-md border border-border p-3 ${dark ? "dark" : ""} bg-background`}>
                {url ? <img src={url} alt={`${label} preview`} className="max-h-full max-w-full object-contain" /> : <span className="flex items-center gap-2 text-[13px] text-muted-foreground"><ImageOff className="size-4" /> No logo</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" loading={upload.isPending} disabled={remove.isPending} onClick={() => input.current?.click()}>
                    <Upload /> {url ? "Replace" : "Upload"}
                </Button>
                {url && <Button type="button" size="sm" variant="ghost" loading={remove.isPending} disabled={upload.isPending} onClick={() => remove.mutate(variant)}><Trash2 /> Remove</Button>}
            </div>
            <p className="text-xs text-muted-foreground">{hint} PNG, JPG or WebP, up to 5 MB.</p>
            <input ref={input} type="file" accept={LOGO_TYPES.join(",")} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
    );
}

/**
 * Branding — /admin/branding
 * @perm organizations.branding.manage
 * @api GET /organization · PATCH /organization/branding (empty string clears a field) · logos: POST / DELETE /organization/branding/logo/:variant (light | dark → Google Cloud Storage)
 */
export default function BrandingPage() {
    const org = useOrganization();
    const update = useUpdateBranding();
    const form = useForm<BrandingFormValues>({ resolver: zodResolver(brandingSchema), defaultValues: { primary_color: "", accent_color: "", email_footer: "", apply_to_portal: true } });
    const v = form.watch();

    // Loaded once; afterwards the form is the source of truth (a refresh after an autosave never overwrites typing).
    const loaded = useRef(false);
    useEffect(() => {
        const b = org.data?.branding ?? {};
        if (!org.data || loaded.current) return;
        loaded.current = true;
        form.reset({ primary_color: b.primary_color ?? "", accent_color: b.accent_color ?? "", email_footer: b.email_footer ?? "", apply_to_portal: b.apply_to_portal ?? true });
    }, [org.data, form]);

    /** Autosave (no Save button): valid changes are saved after a short pause; failures show in <SaveStatus />. */
    const autosave = useFormAutosave(form, (values) => update.mutateAsync(values), { enabled: !!org.data });

    if (org.isPending) return <PageSkeleton />;
    if (org.error) return <Page><PageHeader title="Branding" /><ErrorState error={org.error} onRetry={() => org.refetch()} /></Page>;

    const submit = (e: React.FormEvent) => { e.preventDefault(); autosave.flush(); };
    const primary = HEX.test(v.primary_color) ? v.primary_color : undefined;

    return (
        <Page width="wide">
            <PageHeader title="Branding" description="Logo and colors used on proposals, invoices, emails and the client portal." actions={<SaveStatus state={autosave} />} />
            <Form {...form}>
                <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
                    <div className="space-y-6">
                        <Section title="Logo">
                            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                                <LogoUpload variant="light" label="Logo" hint="For light backgrounds." url={org.data?.logo_url} />
                                <LogoUpload variant="dark" label="Logo (dark)" hint="Optional, for dark backgrounds." url={org.data?.branding?.logo_dark_url} dark />
                            </div>
                        </Section>
                        <Section title="Colors">
                            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                                <FormField control={form.control} name="primary_color" render={({ field }) => (
                                    <FormItem><FormLabel>Primary color</FormLabel><FormControl><ColorField label="Primary color" value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="accent_color" render={({ field }) => (
                                    <FormItem><FormLabel>Accent color</FormLabel><FormControl><ColorField label="Accent color" value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        </Section>
                        <Section title="Documents & emails">
                            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                                <FormField control={form.control} name="email_footer" render={({ field }) => (
                                    <FormItem><FormLabel>Footer text</FormLabel><FormControl><Textarea rows={2} placeholder="Logiqdev Ltd · VAT EL123456789 · Athens" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="apply_to_portal" render={({ field }) => (
                                    <FormItem className="flex items-center justify-between gap-3">
                                        <div><FormLabel>Use in the client portal</FormLabel><FormDescription>Clients see your logo and colors when they sign in.</FormDescription></div>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Use in the client portal" /></FormControl>
                                    </FormItem>
                                )} />
                            </div>
                        </Section>
                    </div>
                    <Section title="Preview">
                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                            <div className="flex h-16 items-center border-b border-border px-4">
                                {org.data?.logo_url ? <img src={org.data.logo_url} alt="Logo preview" className="max-h-9 max-w-[180px] object-contain" /> : <span className="flex items-center gap-2 text-[13px] text-muted-foreground"><ImageOff className="size-4" /> No logo</span>}
                            </div>
                            <div className="space-y-3 p-4">
                                <p className="text-[15px] font-medium text-foreground">Proposal for Acme Ltd</p>
                                <p className="text-[13px] text-muted-foreground">Website redesign · 3 milestones</p>
                                <span className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground" style={primary ? { backgroundColor: primary, color: "#fff" } : undefined}>Accept proposal</span>
                                {v.email_footer && <p className="border-t border-border pt-3 text-xs text-muted-foreground">{v.email_footer}</p>}
                            </div>
                        </div>
                    </Section>
                </form>
            </Form>
        </Page>
    );
}
