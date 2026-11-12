import { z } from 'zod';
import { BusinessHours, isWithinBusinessHours, nextBusinessOpening, parseBusinessHours } from '../sla/business-hours.utils';

/**
 * Typed parts of SupportChannel.config (13 §3, §5). The column is free-form JSON for widget appearance; two keys are
 * owned by dedicated endpoints and validated here:
 * - `ai`            — AI auto-answer per channel (PUT /support/channels/:id/ai-agent, support.ai.configure)
 * - `office_hours`  — live-chat office hours (PUT /support/channels/:id/office-hours, support.inboxes.manage)
 * SupportChannel.ai_agent_enabled mirrors `ai.mode !== 'OFF'` so queries can filter on it.
 */

export const CHANNEL_AI_MODES = ['OFF', 'SUGGEST', 'AUTO_REPLY'] as const;
export type ChannelAiMode = (typeof CHANNEL_AI_MODES)[number];

export const ChannelAiConfigSchema = z.object({
    /** OFF · SUGGEST (draft for an agent to review) · AUTO_REPLY (answer the customer when grounded and confident). */
    mode: z.enum(CHANNEL_AI_MODES).default('OFF'),
    /** Minimum model confidence (0.5–0.99) for an automatic reply; below it the draft goes to an agent. */
    min_confidence: z.number().min(0.5).max(0.99).default(0.75),
    /** Hand over to a human after this many AI answers in one session. */
    max_turns: z.number().int().min(1).max(10).default(3),
    /** Extra phrases that make the AI hand over at once (in addition to "human", "agent", …). */
    handover_phrases: z.array(z.string().trim().min(2).max(60)).max(20).default([]),
});
export type ChannelAiConfig = z.infer<typeof ChannelAiConfigSchema>;

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24 h)');
const DayWindow = z.object({ start: HHMM, end: HHMM }).refine((d) => d.end > d.start, { message: 'End must be after start' }).nullable().optional();

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const OfficeHoursSchema = z.object({
    /** Off = the chat is always "online". */
    enabled: z.boolean().default(false),
    /** Use Organization.business_hours / working_days / default_timezone (Admin → Organization). */
    use_organization_hours: z.boolean().default(true),
    /** IANA time zone for custom hours (null = organization default). */
    timezone: z.string().trim().max(64).nullable().optional(),
    /** Custom hours per weekday; a missing / null day is closed. */
    days: z.object({ mon: DayWindow, tue: DayWindow, wed: DayWindow, thu: DayWindow, fri: DayWindow, sat: DayWindow, sun: DayWindow }).optional(),
    /** Shown to visitors outside office hours above the "we'll reply by email" form. */
    offline_message: z.string().trim().max(500).nullable().optional(),
});
export type OfficeHoursConfig = z.infer<typeof OfficeHoursSchema>;

const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Effective AI config of a channel (defaults when absent or invalid). */
export function readAiConfig(config: unknown): ChannelAiConfig {
    const parsed = ChannelAiConfigSchema.safeParse(asObject(config).ai ?? {});
    return parsed.success ? parsed.data : ChannelAiConfigSchema.parse({});
}

export function readOfficeHours(config: unknown): OfficeHoursConfig {
    const parsed = OfficeHoursSchema.safeParse(asObject(config).office_hours ?? {});
    return parsed.success ? parsed.data : OfficeHoursSchema.parse({});
}

/** Keep the keys owned by the dedicated endpoints when the generic channel update replaces `config`. */
export function mergeOwnedConfigKeys(next: Record<string, unknown>, before: unknown): Record<string, unknown> {
    const prev = asObject(before);
    const { ai: _ai, office_hours: _oh, ...rest } = next;
    void _ai;
    void _oh;
    return { ...rest, ...(prev.ai !== undefined && { ai: prev.ai }), ...(prev.office_hours !== undefined && { office_hours: prev.office_hours }) };
}

export function withConfigKey(config: unknown, key: 'ai' | 'office_hours', value: unknown): Record<string, unknown> {
    return { ...asObject(config), [key]: value };
}

export interface OrganizationHoursSource {
    business_hours: unknown;
    working_days: unknown;
    default_timezone: string | null;
}

/** Resolve the office hours to a BusinessHours window set (null = always open). */
export function officeHoursWindows(oh: OfficeHoursConfig, org: OrganizationHoursSource): BusinessHours | null {
    if (!oh.enabled) return null;
    if (oh.use_organization_hours || !oh.days) return parseBusinessHours(org.business_hours, org.working_days, oh.timezone || org.default_timezone || 'UTC');
    const days: Record<string, { start: string; end: string }> = {};
    for (const k of DAY_KEYS) {
        const d = oh.days[k];
        if (d) days[k] = d;
    }
    // No open day at all means "always closed" — parseBusinessHours would fall back to Mon–Fri, so model it explicitly.
    if (!Object.keys(days).length) return { timezone: oh.timezone || org.default_timezone || 'UTC', days: new Map() };
    return parseBusinessHours(days, null, oh.timezone || org.default_timezone || 'UTC');
}

export interface OfficeHoursStatus {
    enabled: boolean;
    open: boolean;
    /** Next opening (ISO) when closed; null when unknown or open. */
    next_open_at: string | null;
    timezone: string | null;
}

export function officeHoursStatus(oh: OfficeHoursConfig, org: OrganizationHoursSource, now = new Date()): OfficeHoursStatus {
    const windows = officeHoursWindows(oh, org);
    if (!windows) return { enabled: false, open: true, next_open_at: null, timezone: null };
    const open = isWithinBusinessHours(now, windows);
    const next = open || !windows.days.size ? null : nextBusinessOpening(now, windows);
    return { enabled: true, open, next_open_at: next ? next.toISOString() : null, timezone: windows.timezone };
}
