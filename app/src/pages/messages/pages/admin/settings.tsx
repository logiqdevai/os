import { useMemo, useState, type ReactNode } from "react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/hooks/use-autosave";
import { useMessagingSettings, useUpdateMessagingSettings } from "@/features/messaging/hooks/use-messaging-admin";
import type { MessagingSettings } from "@/features/messaging/interfaces/messaging-admin.interfaces";
import { CallProviderOptions, PolicyLevelOptions } from "@/config/constants/dropdowns/messaging/messaging-admin.options";
import { AdminNav } from "./admin-nav";

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
                <p className="text-[13px] font-medium text-foreground">{label}</p>
                {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

const minutes = (v: string) => (v.trim() === "" ? null : Math.max(1, Number(v.replace(/\D/g, "")) || 1));

/**
 * /messages/admin/settings — organization messaging policy (MessagingSettings, one row per organization).
 * Saves as you edit (<SaveStatus /> in the header, no Save button).
 * @perm edit messaging.settings.manage (sensitive) · read-only with messaging.audit.read
 * @api GET/PATCH /messaging/settings (every change is audited with before / after)
 */
export default function MessagingSettingsPage() {
    const settings = useMessagingSettings();
    if (settings.isPending) return <PageSkeleton />;
    if (settings.error) return <Page><PageHeader title="Messaging settings" /><AdminNav /><ErrorState error={settings.error} onRetry={() => settings.refetch()} /></Page>;
    return <SettingsForm s={settings.data} />;
}

function SettingsForm({ s }: { s: MessagingSettings }) {
    const save = useUpdateMessagingSettings();
    const canEdit = usePermission("messaging.settings.manage");
    const [draft, setDraft] = useState<Partial<MessagingSettings>>(s);
    const [maxMb, setMaxMb] = useState(s.file_policy?.max_file_size_bytes ? String(Math.round(s.file_policy.max_file_size_bytes / 1048576)) : "");
    const [blocked, setBlocked] = useState((s.file_policy?.blocked_extensions ?? []).join(", "));
    const payload = useMemo(() => {
        const d = draft;
        return {
            allow_delete_own_messages: d.allow_delete_own_messages, delete_own_time_limit_minutes: d.delete_own_time_limit_minutes ?? null, allow_admin_delete_messages: d.allow_admin_delete_messages,
            edit_time_limit_minutes: d.edit_time_limit_minutes ?? null, preserve_edit_history: d.preserve_edit_history, read_receipts_direct: d.read_receipts_direct, read_receipts_group: d.read_receipts_group,
            external_access_enabled: d.external_access_enabled, guest_access_enabled: d.guest_access_enabled, guest_default_expiry_days: d.guest_default_expiry_days ?? null,
            broadcast_mention_policy: d.broadcast_mention_policy, announcement_policy: d.announcement_policy, calls_enabled: d.calls_enabled, call_provider: d.call_provider ?? "internal",
            admin_private_message_access_enabled: d.admin_private_message_access_enabled, notification_previews_include_text: d.notification_previews_include_text,
            file_policy: { max_file_size_bytes: maxMb ? Number(maxMb) * 1048576 : null, blocked_extensions: blocked.split(/[\s,]+/).map((x) => x.replace(/^\./, "").toLowerCase()).filter(Boolean) },
        };
    }, [draft, maxMb, blocked]);
    const autosave = useAutosave({ value: payload, enabled: canEdit, save: (v) => save.mutateAsync(v) });

    const set = <K extends keyof MessagingSettings>(k: K, v: MessagingSettings[K]) => setDraft((d) => ({ ...d, [k]: v }));
    const sw = (k: keyof MessagingSettings, label: string) => <Switch checked={!!draft[k]} onCheckedChange={(v) => set(k, v as never)} disabled={!canEdit} aria-label={label} />;

    return (
        <Page>
            <PageHeader title="Messaging settings" description="Rules for the whole organization. Changes are logged." meta={<SaveStatus state={autosave} />} />
            <AdminNav />
            {!canEdit && <p className="mb-4 rounded-lg border border-border bg-secondary p-3 text-[13px] text-muted-foreground">You can view these settings; changing them needs messaging.settings.manage.</p>}
            <div className="space-y-6">
                <Section title="Messages">
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        <Row label="People can delete their own messages">{sw("allow_delete_own_messages", "People can delete their own messages")}</Row>
                        <Row label="Delete window (minutes)" hint="Empty = any time"><Input className="w-28" inputMode="numeric" value={draft.delete_own_time_limit_minutes ?? ""} onChange={(e) => set("delete_own_time_limit_minutes", minutes(e.target.value))} disabled={!canEdit} aria-label="Delete window in minutes" /></Row>
                        <Row label="Edit window (minutes)" hint="Empty = any time"><Input className="w-28" inputMode="numeric" value={draft.edit_time_limit_minutes ?? ""} onChange={(e) => set("edit_time_limit_minutes", minutes(e.target.value))} disabled={!canEdit} aria-label="Edit window in minutes" /></Row>
                        <Row label="Keep edit history">{sw("preserve_edit_history", "Keep edit history")}</Row>
                        <Row label="Admins can delete any message" hint="Needs messaging.messages.delete_any">{sw("allow_admin_delete_messages", "Admins can delete any message")}</Row>
                        <Row label="Who can use @channel / @here">
                            <Select value={draft.broadcast_mention_policy ?? "admins"} onValueChange={(v) => set("broadcast_mention_policy", v as MessagingSettings["broadcast_mention_policy"])} disabled={!canEdit}>
                                <SelectTrigger className="w-44" aria-label="Who can use @channel"><SelectValue /></SelectTrigger>
                                <SelectContent>{PolicyLevelOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </Row>
                        <Row label="Who can post announcements">
                            <Select value={draft.announcement_policy ?? "admins"} onValueChange={(v) => set("announcement_policy", v as MessagingSettings["announcement_policy"])} disabled={!canEdit}>
                                <SelectTrigger className="w-44" aria-label="Who can post announcements"><SelectValue /></SelectTrigger>
                                <SelectContent>{PolicyLevelOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </Row>
                        <Row label="Read receipts in direct messages">{sw("read_receipts_direct", "Read receipts in direct messages")}</Row>
                        <Row label="Read receipts in group messages">{sw("read_receipts_group", "Read receipts in group messages")}</Row>
                        <Row label="Message text in notification previews">{sw("notification_previews_include_text", "Message text in notification previews")}</Row>
                    </div>
                </Section>
                <Section title="Calls">
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        <Row label="Huddles and calls" hint="Members with messaging.calls.start can start them from a channel.">{sw("calls_enabled", "Huddles and calls")}</Row>
                        <Row label="Meeting provider" hint="Audio / video is not hosted here; calls can carry a meeting link.">
                            <Select value={draft.call_provider ?? "internal"} onValueChange={(v) => set("call_provider", v)} disabled={!canEdit}>
                                <SelectTrigger className="w-56" aria-label="Meeting provider"><SelectValue /></SelectTrigger>
                                <SelectContent>{CallProviderOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </Row>
                    </div>
                </Section>
                <Section title="Files">
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        <Row label="Largest file in a message (MB)" hint="Empty = the Files module limit"><Input className="w-28" inputMode="numeric" value={maxMb} onChange={(e) => setMaxMb(e.target.value.replace(/\D/g, "").slice(0, 4))} disabled={!canEdit} aria-label="Largest file in MB" /></Row>
                        <Row label="Blocked file types" hint="Comma separated, e.g. exe, bat"><Input className="w-56" value={blocked} onChange={(e) => setBlocked(e.target.value)} disabled={!canEdit} aria-label="Blocked file types" /></Row>
                    </div>
                </Section>
                <Section title="Guests & privacy">
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        <Row label="External participants" hint="Customers and partners can be added to customer channels.">{sw("external_access_enabled", "External participants")}</Row>
                        <Row label="Guest accounts">{sw("guest_access_enabled", "Guest accounts")}</Row>
                        <Row label="Guest access expires after (days)" hint="Empty = no default expiry"><Input className="w-28" inputMode="numeric" value={draft.guest_default_expiry_days ?? ""} onChange={(e) => set("guest_default_expiry_days", e.target.value.trim() ? Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) : null)} disabled={!canEdit} aria-label="Guest expiry in days" /></Row>
                        <Row label="Admins may read private conversations" hint="Must be announced to employees; every access is audited.">{sw("admin_private_message_access_enabled", "Admins may read private conversations")}</Row>
                    </div>
                </Section>
            </div>
        </Page>
    );
}
