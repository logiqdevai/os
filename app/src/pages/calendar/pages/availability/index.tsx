import { useEffect, useRef, useState } from "react";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { CalendarOff, Clock, Plus, Trash2 } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "@/components/ui/save-status";
import { useCreateSchedule, useSchedules, useUpdateSchedule } from "@/features/calendar/hooks/use-calendar";
import type { AvailabilityOverride, AvailabilityRule } from "@/features/calendar/interfaces/calendar.interfaces";
import { WeekdayLongOptions } from "@/config/constants/dropdowns/calendar/calendar.options";
import { formatDate } from "@/lib/format";

const DEFAULT_RULES: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_time: "09:00", end_time: "17:00" }));
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * /calendar/availability — my scheduling hours (19 §6): weekly windows + date overrides, used by free/busy, suggestions and booking links.
 * @perm view calendar.availability.read · edit calendar.availability.manage
 * @api GET/POST/PATCH /calendar/availability/schedules
 * Autosaves (no Save button): every valid change is saved after a short pause; <SaveStatus /> sits in the header.
 */
export default function AvailabilityPage() {
    const schedules = useSchedules();
    const create = useCreateSchedule({ inline: true });
    const update = useUpdateSchedule({ inline: true });
    const canEdit = usePermission("calendar.availability.manage");
    const current = schedules.data?.find((s) => s.is_default) ?? schedules.data?.[0] ?? null;

    const [timezone, setTimezone] = useState(browserZone());
    const [rules, setRules] = useState<AvailabilityRule[]>(DEFAULT_RULES);
    const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
    const [newDate, setNewDate] = useState("");
    const [newReason, setNewReason] = useState("");
    /** Set by the first edit; until then the page follows the saved schedule (refreshes never overwrite edits). */
    const [dirty, setDirty] = useState(false);
    const createdId = useRef<string | null>(null);

    useEffect(() => {
        if (current && !dirty) {
            setTimezone(current.timezone);
            setRules(current.rules.map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time })));
            setOverrides(current.overrides.map(({ date, kind, start_time, end_time, reason }) => ({ date: date.slice(0, 10), kind, start_time, end_time, reason })));
        }
    }, [current, dirty]);
    const invalid = rules.some((r) => r.end_time <= r.start_time);
    const autosave = useAutosave({
        value: { timezone, rules, overrides },
        enabled: canEdit && dirty && !invalid,
        save: async (v) => {
            const dto = { name: current?.name ?? "Working hours", ...v };
            const id = current?.id ?? createdId.current;
            if (id) return update.mutateAsync({ id, ...dto });
            // The first change creates my schedule; later changes update it.
            const created = await create.mutateAsync({ ...dto, is_default: true });
            createdId.current = created.id;
        },
    });
    const edit = <T,>(set: (v: T) => void) => (v: T) => { setDirty(true); set(v); };

    if (schedules.isLoading) return <PageSkeleton />;
    if (schedules.error) return <Page><PageHeader title="My availability" /><ErrorState error={schedules.error} onRetry={() => schedules.refetch()} /></Page>;

    const setDay = (weekday: number, on: boolean) => edit(setRules)(on ? [...rules, { weekday, start_time: "09:00", end_time: "17:00" }] : rules.filter((x) => x.weekday !== weekday));
    const patchRule = (idx: number, patch: Partial<AvailabilityRule>) => edit(setRules)(rules.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

    return (
        <Page width="narrow">
            <PageHeader
                title="My availability"
                description="When people can book you and when you show as free. Busy events are always respected."
                actions={canEdit && (invalid ? <span role="status" className="text-xs text-danger">Each window must end after it starts.</span> : <SaveStatus state={autosave} />)}
            />
            {!current && <p className="mb-4 rounded-lg border border-border bg-info-soft px-4 py-3 text-[13px] text-info">You have no schedule yet, so Monday to Friday 09:00–17:00 is used. Change anything to make it yours.</p>}
            <fieldset disabled={!canEdit} className="space-y-8">
                <Section title="Time zone">
                    <TimezoneSelect value={timezone} onChange={edit(setTimezone)} className="w-full sm:w-80" aria-label="Time zone" />
                </Section>
                <Section title="Weekly hours">
                    <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {WeekdayLongOptions.map((d) => {
                            const windows = rules.map((r, i) => ({ r, i })).filter((x) => x.r.weekday === d.id);
                            const on = windows.length > 0;
                            return (
                                <div key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                                    <label className="flex w-36 shrink-0 items-center gap-2 pt-1 text-[13px] text-foreground">
                                        <Switch checked={on} onCheckedChange={(v) => setDay(d.id, v)} aria-label={d.label} />
                                        {d.label}
                                    </label>
                                    <div className="flex-1 space-y-2">
                                        {!on && <p className="pt-1 text-[13px] text-muted-foreground">Unavailable</p>}
                                        {windows.map(({ r, i }) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <Input type="time" className="h-8 w-28" value={r.start_time} onChange={(e) => patchRule(i, { start_time: e.target.value })} aria-label={`${d.label} start`} />
                                                <span className="text-muted-foreground">–</span>
                                                <Input type="time" className="h-8 w-28" value={r.end_time} onChange={(e) => patchRule(i, { end_time: e.target.value })} aria-label={`${d.label} end`} aria-invalid={r.end_time <= r.start_time} />
                                                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove window" onClick={() => edit(setRules)(rules.filter((_, j) => j !== i))}><Trash2 /></Button>
                                            </div>
                                        ))}
                                        {on && <Button type="button" variant="ghost" size="sm" onClick={() => edit(setRules)([...rules, { weekday: d.id, start_time: "13:00", end_time: "17:00" }])}><Plus /> Add hours</Button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Section>
                <Section title="Days off and exceptions" description="Block a whole day (holidays, travel). Approved leave from People is respected automatically.">
                    <div className="rounded-lg border border-border bg-card">
                        {overrides.length === 0 ? (
                            <EmptyState compact icon={CalendarOff} title="No exceptions" />
                        ) : (
                            <ul className="divide-y divide-border-soft">
                                {overrides.map((o, i) => (
                                    <li key={`${o.date}-${i}`} className="flex items-center justify-between gap-2 px-4 py-2 text-[13px]">
                                        <span className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" />{formatDate(o.date, "EEE d MMM yyyy")}{o.reason ? ` · ${o.reason}` : ""}</span>
                                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove exception" onClick={() => edit(setOverrides)(overrides.filter((_, j) => j !== i))}><Trash2 /></Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row">
                            <Input type="date" className="h-8 sm:w-44" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label="Date" />
                            <Input className="h-8" placeholder="Reason (optional)" value={newReason} onChange={(e) => setNewReason(e.target.value)} aria-label="Reason" />
                            <Button type="button" variant="outline" size="sm" disabled={!newDate} onClick={() => { edit(setOverrides)([...overrides, { date: newDate, kind: "UNAVAILABLE", start_time: null, end_time: null, reason: newReason || null }]); setNewDate(""); setNewReason(""); }}><Plus /> Add day off</Button>
                        </div>
                    </div>
                </Section>
            </fieldset>
        </Page>
    );
}
