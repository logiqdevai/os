import type { ReactNode } from "react";
import { BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { PortalDigestFrequencyOptions } from "@/config/constants/dropdowns/portal/portal.options";
import { usePortalNotificationPreferences, useUpdatePortalNotificationPreferences } from "@/features/portal/hooks/use-portal";
import type { PortalDigestFrequency, PortalNotificationPreferencesDto } from "@/features/portal/interfaces/portal.interfaces";
import { PortalCard, PortalHeader } from "../components/portal-ui";

/**
 * Customer notification preferences — /portal/notifications (07 §13 on the 14 preference tables; mockup 07-portal `cp-notifications`).
 * Own preferences only, so any active portal member may open it. Topics follow the portal features switched on for the company.
 * @api GET/PATCH /portal/notification-preferences
 */
export default function PortalNotificationsPage() {
    const prefs = usePortalNotificationPreferences();
    const update = useUpdatePortalNotificationPreferences();
    // Each switch saves on change and shows its new state at once (rolled back if the API refuses).
    const save = (dto: PortalNotificationPreferencesDto) => update.mutate(dto);

    return (
        <>
            <PortalHeader title="Notifications" description="Choose how and about what the team keeps you informed." />
            {prefs.isLoading ? (
                <ListSkeleton rows={5} />
            ) : prefs.error || !prefs.data ? (
                <ErrorState error={prefs.error} onRetry={() => prefs.refetch()} />
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    <PortalCard title="How">
                        <div className="space-y-4">
                            <Row id="pref-email" label="Email" description={prefs.data.email_available ? "Get notifications by email." : "Email notifications are not available yet."}>
                                <Switch id="pref-email" checked={prefs.data.email_enabled && prefs.data.email_available} disabled={!prefs.data.email_available} onCheckedChange={(v) => save({ email_enabled: v })} />
                            </Row>
                            <Row id="pref-inapp" label="In the portal" description="Show notifications when you sign in.">
                                <Switch id="pref-inapp" checked={prefs.data.in_app_enabled} onCheckedChange={(v) => save({ in_app_enabled: v })} />
                            </Row>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="text-[13px] font-medium text-foreground">Email frequency</div>
                                    <p className="text-xs text-muted-foreground">Get one summary instead of every email.</p>
                                </div>
                                <Select value={prefs.data.digest_frequency} onValueChange={(v) => save({ digest_frequency: v as PortalDigestFrequency })} disabled={!prefs.data.email_enabled}>
                                    <SelectTrigger className="h-8 w-full sm:w-44" aria-label="Email frequency"><SelectValue /></SelectTrigger>
                                    <SelectContent>{PortalDigestFrequencyOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                    </PortalCard>
                    <PortalCard title="About">
                        {!prefs.data.topics.length ? (
                            <EmptyState compact icon={BellOff} title="No topics" description="Nothing to configure for your company yet." />
                        ) : (
                            <div className="space-y-4">
                                {prefs.data.topics.map((t) => (
                                    <Row key={t.module} id={`topic-${t.module}`} label={t.label} description={t.description}>
                                        <Switch id={`topic-${t.module}`} checked={t.enabled} onCheckedChange={(v) => save({ topics: [{ module: t.module, enabled: v }] })} />
                                    </Row>
                                ))}
                            </div>
                        )}
                    </PortalCard>
                </div>
            )}
        </>
    );
}

function Row({ id, label, description, children }: { id: string; label: string; description: string; children: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <Label htmlFor={id} className="text-[13px] font-medium text-foreground">{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            {children}
        </div>
    );
}
