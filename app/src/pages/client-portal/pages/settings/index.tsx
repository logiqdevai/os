import { useEffect, useState } from "react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { PortalFeatureOptions, PortalPermissionOptions } from "@/config/constants/dropdowns/portal/portal.options";
import { useCustomerRoles, usePortalSettings, useUpdatePortalSettings } from "@/features/client-portal/hooks/use-client-portal";
import type { PortalFeature, PortalSettings } from "@/features/client-portal/interfaces/client-portal.interfaces";

/**
 * Portal settings & branding — /client-portal/settings (mockup 07-portal `settings`, `branding`, `access`).
 * @perm VIEW portal.users.read · edit portal.settings.manage (custom domain also organizations.domains.manage)
 */
export default function PortalSettingsPage() {
    const settings = usePortalSettings();
    if (settings.isLoading) return <PageSkeleton />;
    if (settings.error || !settings.data) return <Page><ErrorState error={settings.error} onRetry={() => settings.refetch()} /></Page>;
    return <SettingsForm s={settings.data} />;
}

function SettingsForm({ s }: { s: PortalSettings }) {
    const update = useUpdatePortalSettings();
    const roles = useCustomerRoles();
    const canEdit = usePermission("portal.settings.manage");
    const init = () => ({
        enabled: s.enabled,
        features: { ...s.features },
        default_role_slug: s.default_role_slug,
        profile_changes_require_approval: s.profile_changes_require_approval,
        welcome_message: s.welcome_message ?? "",
        support_email: s.support_email ?? "",
        portal_name: s.branding?.portal_name ?? "",
        primary_color: s.branding?.primary_color ?? "",
        logo_url: s.branding?.logo_url ?? "",
    });
    const [f, setF] = useState(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => setF(init()), [s]);

    const save = () =>
        update.mutate(
            {
                enabled: f.enabled,
                features: f.features,
                default_role_slug: f.default_role_slug,
                profile_changes_require_approval: f.profile_changes_require_approval,
                welcome_message: f.welcome_message || null,
                support_email: f.support_email || null,
                branding: Object.fromEntries(Object.entries({ portal_name: f.portal_name, primary_color: f.primary_color, logo_url: f.logo_url }).filter(([, v]) => v)) as Record<string, string>,
            },
            { onSuccess: () => toast({ title: "Portal settings saved" }), onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) },
        );

    return (
        <Page width="narrow">
            <PageHeader title="Portal settings" description="What clients see, how they join and how the portal looks." />
            <div className="space-y-6">
                <Section title="Access">
                    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                        <label className="flex items-center justify-between gap-3 text-[13px]"><span>Client portal is on<span className="block text-xs text-muted-foreground">Switch off to block every client from signing in.</span></span><Switch checked={f.enabled} disabled={!canEdit} onCheckedChange={(v) => setF({ ...f, enabled: v })} aria-label="Portal on" /></label>
                        <div className="space-y-1.5">
                            <Label>Default role for new portal users</Label>
                            <Select value={f.default_role_slug} disabled={!canEdit} onValueChange={(v) => setF({ ...f, default_role_slug: v })}>
                                <SelectTrigger aria-label="Default role"><SelectValue /></SelectTrigger>
                                <SelectContent>{roles.data?.map((r) => <SelectItem key={r.id} value={r.slug}>{r.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <label className="flex items-center justify-between gap-3 text-[13px]"><span>Review profile changes before they apply<span className="block text-xs text-muted-foreground">Otherwise client edits update the CRM immediately.</span></span><Switch checked={f.profile_changes_require_approval} disabled={!canEdit} onCheckedChange={(v) => setF({ ...f, profile_changes_require_approval: v })} aria-label="Review profile changes" /></label>
                    </div>
                </Section>

                <Section title="Features" description="Sections clients can open. Roles still decide what each person may do.">
                    <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                        {PortalFeatureOptions.map((o) => (
                            <label key={o.id} className="flex items-center justify-between gap-3 text-[13px]">
                                {o.label}
                                <Switch checked={f.features[o.id as PortalFeature] ?? true} disabled={!canEdit} onCheckedChange={(v) => setF({ ...f, features: { ...f.features, [o.id]: v } })} aria-label={o.label} />
                            </label>
                        ))}
                    </div>
                </Section>

                <Section title="Branding & welcome">
                    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label htmlFor="pname">Portal name</Label><Input id="pname" disabled={!canEdit} value={f.portal_name} onChange={(e) => setF({ ...f, portal_name: e.target.value })} placeholder={`${s.organization?.display_name ?? "Agency"} client portal`} /></div>
                            <div className="space-y-1.5"><Label htmlFor="pemail">Support email</Label><Input id="pemail" type="email" disabled={!canEdit} value={f.support_email} onChange={(e) => setF({ ...f, support_email: e.target.value })} /></div>
                            <div className="space-y-1.5"><Label htmlFor="plogo">Logo URL</Label><Input id="plogo" disabled={!canEdit} value={f.logo_url} onChange={(e) => setF({ ...f, logo_url: e.target.value })} placeholder={s.organization?.logo_url ?? "https://…"} /></div>
                            <div className="space-y-1.5"><Label htmlFor="pcolor">Accent colour</Label><Input id="pcolor" disabled={!canEdit} value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} placeholder="#2563eb" /></div>
                        </div>
                        <div className="space-y-1.5"><Label htmlFor="pwelcome">Welcome message</Label><Textarea id="pwelcome" rows={3} disabled={!canEdit} value={f.welcome_message} onChange={(e) => setF({ ...f, welcome_message: e.target.value })} placeholder="Welcome! Here you can follow your projects and reach our team." /></div>
                    </div>
                </Section>

                <Section title="Customer roles" description="What each portal role can do. Roles are managed in Admin → Roles.">
                    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                        {roles.data?.map((r) => (
                            <div key={r.id} className="text-[13px]">
                                <div className="font-medium text-foreground">{r.name}</div>
                                <div className="text-xs text-muted-foreground">{r.permissions.length ? r.permissions.map((p) => getDropdownOptionLabel(PortalPermissionOptions, p)).join(" · ") : "No permissions"}</div>
                            </div>
                        ))}
                    </div>
                </Section>

                {canEdit && <div className="flex justify-end"><Button loading={update.isPending} onClick={save}>Save settings</Button></div>}
            </div>
        </Page>
    );
}
