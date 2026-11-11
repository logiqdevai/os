import { DateTime } from 'luxon';

export interface Interval {
    start: Date;
    end: Date;
}

export interface ScheduleLike {
    timezone: string;
    rules: { weekday: number; start_time: string; end_time: string }[];
    overrides: { date: Date; kind: 'UNAVAILABLE' | 'AVAILABLE'; start_time: string | null; end_time: string | null }[];
}

/** Used when a member has no availability schedule (19 §6 falls back to working hours): Mon–Fri 09:00–17:00. */
export function defaultSchedule(timezone: string): ScheduleLike {
    return { timezone, rules: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start_time: '09:00', end_time: '17:00' })), overrides: [] };
}

export function isValidZone(tz: string | null | undefined): tz is string {
    return !!tz && DateTime.local().setZone(tz).isValid;
}

const at = (day: DateTime, hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return day.set({ hour: h, minute: m, second: 0, millisecond: 0 });
};

/** Merge overlapping / touching intervals (input in any order). */
export function mergeIntervals(list: Interval[]): Interval[] {
    const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start.getTime() - b.start.getTime());
    const out: Interval[] = [];
    for (const i of sorted) {
        const last = out[out.length - 1];
        if (last && i.start <= last.end) last.end = new Date(Math.max(last.end.getTime(), i.end.getTime()));
        else out.push({ start: new Date(i.start), end: new Date(i.end) });
    }
    return out;
}

/** a minus b (both merged). */
export function subtractIntervals(a: Interval[], b: Interval[]): Interval[] {
    let result = mergeIntervals(a);
    for (const cut of mergeIntervals(b)) {
        const next: Interval[] = [];
        for (const i of result) {
            if (cut.end <= i.start || cut.start >= i.end) next.push(i);
            else {
                if (cut.start > i.start) next.push({ start: i.start, end: cut.start });
                if (cut.end < i.end) next.push({ start: cut.end, end: i.end });
            }
        }
        result = next;
    }
    return result;
}

/** Working windows of a schedule inside [from, to): weekly rules, minus UNAVAILABLE overrides, plus AVAILABLE ones. */
export function workingIntervals(schedule: ScheduleLike, from: Date, to: Date): Interval[] {
    const tz = isValidZone(schedule.timezone) ? schedule.timezone : 'UTC';
    let day = DateTime.fromJSDate(from, { zone: tz }).startOf('day');
    const last = DateTime.fromJSDate(to, { zone: tz });
    const open: Interval[] = [];
    const closed: Interval[] = [];
    for (let guard = 0; day < last && guard < 400; guard++, day = day.plus({ days: 1 })) {
        const weekday = day.weekday % 7;
        const key = day.toISODate();
        const overrides = schedule.overrides.filter((o) => DateTime.fromJSDate(o.date, { zone: 'UTC' }).toISODate() === key);
        if (overrides.some((o) => o.kind === 'UNAVAILABLE' && !o.start_time)) continue;
        for (const r of schedule.rules.filter((x) => x.weekday === weekday)) open.push({ start: at(day, r.start_time).toJSDate(), end: at(day, r.end_time).toJSDate() });
        for (const o of overrides) {
            const span = { start: at(day, o.start_time ?? '00:00').toJSDate(), end: o.end_time ? at(day, o.end_time).toJSDate() : day.plus({ days: 1 }).toJSDate() };
            (o.kind === 'AVAILABLE' ? open : closed).push(span);
        }
    }
    const clip = { start: from, end: to };
    return subtractIntervals(open, closed)
        .map((i) => ({ start: new Date(Math.max(i.start.getTime(), clip.start.getTime())), end: new Date(Math.min(i.end.getTime(), clip.end.getTime())) }))
        .filter((i) => i.end > i.start);
}

/** Slot starts of `minutes` length, every `step` minutes, fully inside the free intervals. */
export function slotsIn(free: Interval[], minutes: number, step: number, notBefore: Date): Interval[] {
    const out: Interval[] = [];
    const len = minutes * 60_000;
    const stepMs = Math.max(5, step) * 60_000;
    for (const f of free) {
        // Align to the step grid (from midnight UTC of the interval start keeps :00/:15/:30 starts).
        let t = Math.ceil(Math.max(f.start.getTime(), notBefore.getTime()) / stepMs) * stepMs;
        for (; t + len <= f.end.getTime(); t += stepMs) out.push({ start: new Date(t), end: new Date(t + len) });
    }
    return out;
}

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;
