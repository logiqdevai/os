import { useMemo, type ReactNode } from "react";
import { Lock, RotateCcw } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    DigestFrequencyFormOptions, ModuleLabelOptions, NotificationChannelOptions, NotificationLevelFormOptions, PreferenceSourceOptions, WeekdayShortOptions,
} from "@/config/constants/dropdowns/notifications/notification.options";
import { useEventPreferences, useRecipientSettings, useResetEventPreference, useSetEventPreference, useUpdateRecipientSettings } from "@/features/notifications/hooks/use-notifications";
import type { DigestFrequency, EventPreferenceRow, NotificationLevel } from "@/features/notifications/interfaces/notifications.interfaces";

function Row({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
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
 * /notifications/preferences — my settings (14 §6): level, channels, quiet hours, digest, and per event type × channel.
 * @perm notifications.preferences.manage_own · mandatory events and organization-disabled channels are locked
 * @api GET/PATCH /notifications/preferences/settings · GET /notifications/preferences/events · PUT/DELETE /notifications/preferences/events/:id
 */
export default function NotificationPreferencesPage() {
    const settings = useRecipientSettings();
    const events = useEventPreferences();
    const update = useUpdateRecipientSettings();
    const setPref = useSetEventPreference();
    const reset = useResetEventPreference();

    const grouped = useMemo(() => {
        const map = new Map<string, EventPreferenceRow[]>();
        for (const r of events.data ?? []) map.set(r.event_type.module, [...(map.get(r.event_type.module) ?? []), r]);
        return [...map.entries()];
    }, [events.data]);

    if (settings.isLoading) return <PageSkeleton />;
    if (settings.error || !settings.data) return <Page><PageHeader title="Notification preferences" /><ErrorState error={settings.error} onRetry={() => settings.refetch()} /></Page>;
    const s = settings.data;
    const save = (dto: Parameters<typeof update.mutate>[0]) => update.mutate(dto);
    const channels = NotificationChannelOptions.filter((c) => (events.data?.[0]?.channels ?? [{ channel: "IN_APP" }, { channel: "EMAIL" }]).some((x) => x.channel === c.id));

    return (
        <Page width="narrow">
            <PageHeader title="Notification preferences" description="Choose what reaches you and how. Mandatory notifications from your organization cannot be turned off." back={{ to: "/notifications", label: "Inbox" }} />
            <div className="space-y-8">
                <Section title="General">
                    <div className="rounded-lg border border-border bg-card">
                        <Row title="Notify me about" description="Applies to every module unless you change an event below.">
                            <Select value={s.level} onValueChange={(v) => save({ level: v as NotificationLevel })}>
                                <SelectTrigger className="h-8 w-full sm:w-60" aria-label="Notification level"><SelectValue /></SelectTrigger>
                                <SelectContent>{NotificationLevelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </Row>
                        <Row title="In-app notifications" description="The inbox and the badge on the rail.">
                            <Switch checked={s.in_app_enabled} onCheckedChange={(v) => save({ in_app_enabled: v })} aria-label="In-app notifications" />
                        </Row>
                        <Row title="Email notifications" description={s.organization.enabled_channels.includes("EMAIL") ? "Sent from your organization's address." : "Email is turned off by your organization."}>
                            <Switch checked={s.email_enabled} disabled={!s.organization.enabled_channels.includes("EMAIL")} onCheckedChange={(v) => save({ email_enabled: v })} aria-label="Email notifications" />
                        </Row>
                        <Row title="Show message previews" description="Include content in email and push previews.">
                            <Switch checked={s.show_previews} onCheckedChange={(v) => save({ show_previews: v })} aria-label="Show previews" />
                        </Row>
                        <Row title="Delivery" description="Batch non-urgent notifications into a digest.">
                            <Select value={s.digest_frequency} onValueChange={(v) => save({ digest_frequency: v as DigestFrequency })}>
                                <SelectTrigger className="h-8 w-full sm:w-48" aria-label="Digest frequency"><SelectValue /></SelectTrigger>
                                <SelectContent>{DigestFrequencyFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </Row>
                    </div>
                </Section>

                <Section title="Quiet hours" description="Non-critical notifications wait until quiet hours end.">
                    <div className="rounded-lg border border-border bg-card">
                        <Row title="Do not disturb on a schedule">
                            <Switch checked={s.dnd_enabled} onCheckedChange={(v) => save({ dnd_enabled: v, ...(v && !s.dnd_start_time ? { dnd_start_time: "20:00", dnd_end_time: "08:00" } : {}) })} aria-label="Quiet hours" />
                        </Row>
                        <div className={cn("space-y-3 px-4 py-3", !s.dnd_enabled && "pointer-events-none opacity-50")}>
                            <div className="flex flex-wrap items-center gap-2 text-[13px] text-body">
                                <span>From</span>
                                <Input type="time" className="h-8 w-28" defaultValue={s.dnd_start_time ?? "20:00"} key={`s-${s.dnd_start_time}`} onBlur={(e) => e.target.value && e.target.value !== s.dnd_start_time && save({ dnd_start_time: e.target.value })} aria-label="Quiet hours start" />
                                <span>to</span>
                                <Input type="time" className="h-8 w-28" defaultValue={s.dnd_end_time ?? "08:00"} key={`e-${s.dnd_end_time}`} onBlur={(e) => e.target.value && e.target.value !== s.dnd_end_time && save({ dnd_end_time: e.target.value })} aria-label="Quiet hours end" />
                            </div>
                            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
                                {WeekdayShortOptions.map((d) => {
                                    const on = !s.dnd_weekdays.length || s.dnd_weekdays.includes(d.id);
                                    return (
                                        <Button
                                            key={d.id}
                                            type="button"
                                            size="sm"
                                            variant={on ? "secondary" : "ghost"}
                                            aria-pressed={on}
                                            onClick={() => {
                                                const current = s.dnd_weekdays.length ? s.dnd_weekdays : WeekdayShortOptions.map((x) => x.id);
                                                const next = on ? current.filter((x) => x !== d.id) : [...current, d.id];
                                                save({ dnd_weekdays: next.length === 7 ? [] : next });
                                            }}
                                        >
                                            {d.label}
                                        </Button>
                                    );
                                })}
                            </div>
                            <label className="flex items-center gap-2 text-[13px] text-body">
                                <Switch checked={s.dnd_allow_critical} onCheckedChange={(v) => save({ dnd_allow_critical: v })} aria-label="Allow critical" />
                                Still notify me about critical items
                            </label>
                        </div>
                    </div>
                </Section>

                <Section title="By event" description="Switch channels per event. Changes override the default for you only.">
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                        {events.isLoading ? (
                            <ListSkeleton rows={6} />
                        ) : events.error ? (
                            <ErrorState error={events.error} onRetry={() => events.refetch()} />
                        ) : !grouped.length ? (
                            <EmptyState compact title="No events yet" description="Events appear here as modules start sending notifications." />
                        ) : (
                            grouped.map(([module, rows]) => (
                                <div key={module}>
                                    <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
                                        <span className="text-xs font-medium text-muted-foreground">{getDropdownOptionLabel(ModuleLabelOptions, module)}</span>
                                        <div className="hidden gap-6 pr-10 sm:flex">{channels.map((c) => <span key={c.id} className="w-12 text-center text-xs text-muted-foreground">{c.label}</span>)}</div>
                                    </div>
                                    {rows.map((r) => {
                                        const own = r.channels.some((c) => c.source === "own");
                                        return (
                                            <div key={r.event_type.id} className="flex flex-col gap-2 border-b border-border-soft px-4 py-3 last:border-b-0 sm:flex-row sm:items-center">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <p className="text-[13px] text-foreground">{r.event_type.name}</p>
                                                        {r.mandatory && <Badge variant="neutral"><Lock className="size-3" /> Mandatory</Badge>}
                                                    </div>
                                                    {r.event_type.description && <p className="text-xs text-muted-foreground">{r.event_type.description}</p>}
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    {r.channels.map((c) => (
                                                        <Tooltip key={c.channel}>
                                                            <TooltipTrigger asChild>
                                                                <label className="flex w-12 flex-col items-center gap-1">
                                                                    <span className="text-[11px] text-muted-foreground sm:hidden">{getDropdownOptionLabel(NotificationChannelOptions, c.channel)}</span>
                                                                    <Switch
                                                                        checked={c.enabled}
                                                                        disabled={c.locked || setPref.isPending}
                                                                        onCheckedChange={(v) => setPref.mutate({ eventTypeId: r.event_type.id, channel: c.channel, enabled: v })}
                                                                        aria-label={`${r.event_type.name} by ${getDropdownOptionLabel(NotificationChannelOptions, c.channel)}`}
                                                                    />
                                                                </label>
                                                            </TooltipTrigger>
                                                            <TooltipContent>{c.locked ? "Required by your organization" : getDropdownOptionLabel(PreferenceSourceOptions, c.source)}</TooltipContent>
                                                        </Tooltip>
                                                    ))}
                                                    <Button variant="ghost" size="icon-sm" aria-label="Reset to default" disabled={!own || reset.isPending} onClick={() => reset.mutate(r.event_type.id)} className={cn(!own && "invisible")}>
                                                        <RotateCcw />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </Section>
            </div>
        </Page>
    );
}
