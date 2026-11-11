import { DateTime } from 'luxon';
import { NotificationDigestFrequency } from 'generated/prisma';

const validZone = (tz: string | null | undefined): tz is string => !!tz && DateTime.local().setZone(tz).isValid;
export const zoneOr = (...zones: (string | null | undefined)[]) => zones.find(validZone) ?? 'UTC';

export interface QuietHoursSettings {
    dnd_enabled: boolean;
    dnd_start_time: string | null;
    dnd_end_time: string | null;
    /** 0 = Sunday … 6 = Saturday; empty = every day. */
    dnd_weekdays: number[];
    dnd_until: Date | null;
}

const hm = (v: string | null) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(v ?? '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * 14 §6 — when Do Not Disturb ends, or null when `now` is outside quiet hours. Handles schedules over midnight
 * (22:00 → 07:00: the weekday is the day the window started) and the temporary "pause until" (dnd_until).
 */
export function quietHoursEnd(s: QuietHoursSettings | null | undefined, tz: string, now = new Date()): Date | null {
    if (!s) return null;
    let end: Date | null = s.dnd_until && s.dnd_until > now ? s.dnd_until : null;
    const start = hm(s.dnd_start_time);
    const stop = hm(s.dnd_end_time);
    if (s.dnd_enabled && start !== null && stop !== null && start !== stop) {
        const local = DateTime.fromJSDate(now, { zone: tz });
        const minute = local.hour * 60 + local.minute;
        const appliesOn = (d: DateTime) => !s.dnd_weekdays.length || s.dnd_weekdays.includes(d.weekday % 7);
        let windowEnd: DateTime | null = null;
        if (start < stop) {
            if (minute >= start && minute < stop && appliesOn(local)) windowEnd = local.startOf('day').plus({ minutes: stop });
        } else if (minute >= start && appliesOn(local)) {
            windowEnd = local.startOf('day').plus({ days: 1, minutes: stop });
        } else if (minute < stop && appliesOn(local.minus({ days: 1 }))) {
            windowEnd = local.startOf('day').plus({ minutes: stop });
        }
        if (windowEnd) {
            const w = windowEnd.toJSDate();
            end = !end || w > end ? w : end;
        }
    }
    return end;
}

/** 14 §8 — when the current digest period of this cadence is sent (local hour / weekday of the recipient). */
export function nextDigestAt(frequency: NotificationDigestFrequency, tz: string, hour: number, weekday: number, now = new Date()): Date {
    const local = DateTime.fromJSDate(now, { zone: tz });
    if (frequency === NotificationDigestFrequency.HOURLY) return local.startOf('hour').plus({ hours: 1 }).toJSDate();
    let at = local.set({ hour: Math.min(23, Math.max(0, hour)), minute: 0, second: 0, millisecond: 0 });
    if (frequency === NotificationDigestFrequency.WEEKLY) {
        const target = ((weekday % 7) + 7) % 7; // 0 = Sunday
        const diff = (target - (at.weekday % 7) + 7) % 7;
        at = at.plus({ days: diff });
        if (at <= local) at = at.plus({ weeks: 1 });
    } else if (at <= local) at = at.plus({ days: 1 });
    return at.toJSDate();
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
export { escHtml };

/** `{{ a.b }}` → value from the context (missing variables render empty). HTML-escaped when `html`. */
export function renderVars(template: string | null | undefined, ctx: Record<string, unknown>, html = false): string {
    if (!template) return '';
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
        const v = path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), ctx);
        const s = v === undefined || v === null ? '' : String(v);
        return html ? escHtml(s) : s;
    });
}

/** Neutral transactional layout (inline styles only: email clients ignore CSS classes and theme tokens). */
export function emailLayout(opts: { orgName: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string } | null; items?: { title: string; body?: string | null; url?: string | null; when?: string }[]; footer: string }) {
    const p = opts.paragraphs.filter(Boolean).map((t) => `<p style="margin:0 0 12px">${escHtml(t).replace(/\n/g, '<br>')}</p>`).join('');
    const items = (opts.items ?? []).map((i) => `<tr><td style="padding:10px 0;border-top:1px solid #e5e7eb"><div style="font-weight:600">${i.url ? `<a href="${escHtml(i.url)}" style="color:#111827;text-decoration:none">${escHtml(i.title)}</a>` : escHtml(i.title)}</div>${i.body ? `<div style="color:#4b5563;margin-top:2px">${escHtml(i.body)}</div>` : ''}${i.when ? `<div style="color:#9ca3af;font-size:12px;margin-top:2px">${escHtml(i.when)}</div>` : ''}</td></tr>`).join('');
    const cta = opts.cta ? `<p style="margin:16px 0"><a href="${escHtml(opts.cta.url)}" style="display:inline-block;padding:10px 16px;background:#111827;color:#ffffff;border-radius:6px;text-decoration:none">${escHtml(opts.cta.label)}</a></p>` : '';
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#111827;max-width:560px;margin:0 auto;padding:16px"><div style="color:#6b7280;font-size:12px;margin-bottom:8px">${escHtml(opts.orgName)}</div><h1 style="font-size:18px;margin:0 0 12px">${escHtml(opts.heading)}</h1>${p}${items ? `<table role="presentation" style="width:100%;border-collapse:collapse">${items}</table>` : ''}${cta}<p style="color:#9ca3af;font-size:12px;margin-top:24px">${escHtml(opts.footer)}</p></div>`;
}
