import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { DigestFrequencyFormOptions, HourOptions, NotificationLevelFormOptions, WeekdayShortOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { useOrgNotificationSettings, useUpdateOrgNotificationSettings } from "@/features/notifications/hooks/use-notification-admin";
import type { OrgSettingsDto } from "@/features/notifications/interfaces/notification-admin.interfaces";
import type { DigestFrequency, NotificationLevel } from "@/features/notifications/interfaces/notifications.interfaces";

const NONE = "__none";

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2 border-b border-border-soft px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">{title}</p>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
        </div>
    );
}

/**
 * /notifications/admin/settings — organization channels, sender, digest defaults, retries, retention (14 §5, §8, §11).
 * Autosaves (no Save button): every change is sent after a short pause; out-of-range numbers wait until they are valid.
 * @perm notifications.settings.manage · @api GET/PATCH /notification-settings
 * @states loading · error / no-access · email / SMS enabled without a connected provider (warning: deliveries skip with "No provider connected")
 * Push uses the platform's Web Push keys (no provider to connect); members turn it on per browser in Notifications → Devices.
 */
export default function NotificationSettingsPage() {
    const q = useOrgNotificationSettings();
    const save = useUpdateOrgNotificationSettings();
    // The fields changed on this visit; each autosave sends all of them (idempotent PATCH), so nothing is lost between saves.
    const [draft, setDraft] = useState<OrgSettingsDto>({});
    const valid = (draft.max_delivery_attempts === undefined || (Number.isInteger(draft.max_delivery_attempts) && draft.max_delivery_attempts >= 1 && draft.max_delivery_attempts <= 10))
        && (draft.retention_days === undefined || draft.retention_days === null || (Number.isInteger(draft.retention_days) && draft.retention_days >= 7 && draft.retention_days <= 3650));
    const autosave = useAutosave({ value: draft, enabled: !!q.data && valid, save: (dto) => save.mutateAsync(dto) });

    if (q.isLoading) return <PageSkeleton />;
    if (q.error || !q.data) return <Page><PageHeader title="Notification settings" /><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>;
    const s = { ...q.data, ...draft };
    const set = (patch: OrgSettingsDto) => setDraft((d) => ({ ...d, ...patch }));
    const emailOn = s.enabled_channels.includes("EMAIL");
    const smsOn = s.enabled_channels.includes("SMS");
    const pushOn = s.enabled_channels.includes("PUSH");
    /** Toggle one channel; IN_APP is always kept (the API enforces it too). */
    const toggle = (channel: "EMAIL" | "SMS" | "PUSH", on: boolean) =>
        set({ enabled_channels: [...new Set(["IN_APP" as const, ...s.enabled_channels.filter((c) => c !== channel), ...(on ? [channel] : [])])] });
    const providerNote = (connected: boolean, label: string, provider: string) => connected
        ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" /> {provider} connected</span>
        : <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="size-3.5" /> Not available: <Link to="/admin/integrations" className="underline">connect {provider} in Integrations</Link>. {label} are skipped until then.</span>;

    return (
        <Page width="narrow">
            <PageHeader
                title="Notification settings"
                description="Channels, sender, digests, retries and retention for the whole organization."
                actions={valid ? <SaveStatus state={autosave} /> : <span className="text-xs text-warning">Attempts must be 1–10 and retention 7–3650 days</span>}
            />
            <div className="space-y-8">
                <Section title="Channels">
                    <div className="rounded-lg border border-border bg-card">
                        <Row title="In-app" description="Always on.">
                            <Switch checked disabled aria-label="In-app" />
                        </Row>
                        <Row title="Email" description={providerNote(q.data.providers.email.connected, "Emails", "Resend")}>
                            <Switch checked={emailOn} onCheckedChange={(on) => toggle("EMAIL", on)} aria-label="Email" />
                        </Row>
                        <Row title="Sender" description="Verified sender identity from Campaigns → Senders; else the connection's default from address.">
                            <Select value={s.email_sender_identity_id ?? NONE} onValueChange={(v) => set({ email_sender_identity_id: v === NONE ? null : v })} disabled={!emailOn}>
                                <SelectTrigger className="h-8 w-full sm:w-64" aria-label="Email sender"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>Connection default</SelectItem>
                                    {q.data.sender_identities.map((i) => <SelectItem key={i.id} value={i.id}>{i.display_name ? `${i.display_name} · ${i.address}` : i.address}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Row>
                        <Row title="Push" description={`Browser notifications through Web Push. ${q.data.providers.push.active_browsers} member browser${q.data.providers.push.active_browsers === 1 ? "" : "s"} registered.`}>
                            <Switch checked={pushOn} onCheckedChange={(on) => toggle("PUSH", on)} aria-label="Push" />
                        </Row>
                        <Row title="SMS" description={<>Opt-in per member (mobile number on their profile). {providerNote(q.data.providers.sms.connected, "Texts", "Twilio")}</>}>
                            <Switch checked={smsOn} onCheckedChange={(on) => toggle("SMS", on)} aria-label="SMS" />
                        </Row>
                        <Row title="SMS sender" description="Sender from Campaigns → Senders; else the Twilio connection's number or messaging service.">
                            <Select value={s.sms_sender_identity_id ?? NONE} onValueChange={(v) => set({ sms_sender_identity_id: v === NONE ? null : v })} disabled={!smsOn}>
                                <SelectTrigger className="h-8 w-full sm:w-64" aria-label="SMS sender"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE}>Connection default</SelectItem>
                                    {q.data.sms_sender_identities.map((i) => <SelectItem key={i.id} value={i.id}>{i.display_name ? `${i.display_name} · ${i.address}` : i.address}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Row>
                    </div>
                </Section>
                <Section title="Defaults for members" description="Used until a member changes their own preferences.">
                    <div className="rounded-lg border border-border bg-card">
                        <Row title="Level">
                            <Select value={s.default_level} onValueChange={(v) => set({ default_level: v as NotificationLevel })}>
                                <SelectTrigger className="h-8 w-full sm:w-56" aria-label="Default level"><SelectValue /></SelectTrigger>
                                <SelectContent>{NotificationLevelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </Row>
                        <Row title="Email digest" description="Daily and weekly digests are sent at this local time.">
                            <Select value={s.default_digest_frequency} onValueChange={(v) => set({ default_digest_frequency: v as DigestFrequency })}>
                                <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Default digest"><SelectValue /></SelectTrigger>
                                <SelectContent>{DigestFrequencyFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={String(s.default_digest_hour)} onValueChange={(v) => set({ default_digest_hour: Number(v) })}>
                                <SelectTrigger className="h-8 w-24" aria-label="Digest hour"><SelectValue /></SelectTrigger>
                                <SelectContent>{HourOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                            {s.default_digest_frequency === "WEEKLY" && (
                                <Select value={String(s.default_digest_weekday)} onValueChange={(v) => set({ default_digest_weekday: Number(v) })}>
                                    <SelectTrigger className="h-8 w-24" aria-label="Digest weekday"><SelectValue /></SelectTrigger>
                                    <SelectContent>{WeekdayShortOptions.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            )}
                        </Row>
                        <Row title="Hide previews" description="Emails say “New notification” instead of the content.">
                            <Switch checked={s.hide_previews_by_default} onCheckedChange={(on) => set({ hide_previews_by_default: on })} aria-label="Hide previews" />
                        </Row>
                    </div>
                </Section>
                <Section title="Delivery and retention">
                    <div className="rounded-lg border border-border bg-card">
                        <Row title="Delivery attempts" description="Failed emails, texts and pushes are retried with backoff.">
                            <Input type="number" min={1} max={10} className="h-8 w-24" value={s.max_delivery_attempts} onChange={(e) => set({ max_delivery_attempts: Number(e.target.value) })} aria-label="Max attempts" />
                        </Row>
                        <Row title="Keep notifications (days)" description="Read and archived notifications older than this are deleted every night (mandatory ones are kept). Empty keeps everything.">
                            <Input type="number" min={7} max={3650} className="h-8 w-28" placeholder="Forever" value={s.retention_days ?? ""} onChange={(e) => set({ retention_days: e.target.value ? Number(e.target.value) : null })} aria-label="Retention days" />
                        </Row>
                        <Row title="Webhook events" description="Publish notification.created, .delivered, .failed and .read to outbound webhooks and automation.">
                            <Switch checked={s.webhook_events_enabled} onCheckedChange={(on) => set({ webhook_events_enabled: on })} aria-label="Webhook events" />
                        </Row>
                    </div>
                </Section>
            </div>
        </Page>
    );
}
