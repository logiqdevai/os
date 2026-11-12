import type { CampaignAbMetric } from "@/features/communications/interfaces/communications.interfaces";

export const CampaignAbMetricOptions: { id: CampaignAbMetric; label: string }[] = [
    { id: "OPEN", label: "Open rate" },
    { id: "CLICK", label: "Click rate" },
];

/** Share of the audience in the A/B test; the winner goes to the rest. 100 = everyone is in the test (no winner send). */
export const CampaignAbTestPercentOptions: { id: string; label: string }[] = [
    { id: "10", label: "10% test, 90% get the winner" },
    { id: "20", label: "20% test, 80% get the winner" },
    { id: "30", label: "30% test, 70% get the winner" },
    { id: "50", label: "50% test, 50% get the winner" },
    { id: "100", label: "Everyone (split only, no winner send)" },
];

export const CampaignAbWaitOptions: { id: string; label: string }[] = [
    { id: "1", label: "1 hour" },
    { id: "2", label: "2 hours" },
    { id: "4", label: "4 hours" },
    { id: "8", label: "8 hours" },
    { id: "24", label: "1 day" },
    { id: "48", label: "2 days" },
];

/** Repeat options of a recurring campaign (RRULE FREQ). */
export const CampaignRepeatOptions: { id: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY"; label: string }[] = [
    { id: "NONE", label: "Does not repeat" },
    { id: "DAILY", label: "Every day" },
    { id: "WEEKLY", label: "Every week" },
    { id: "MONTHLY", label: "Every month" },
];

export const WeekdayOptions: { id: string; label: string; short: string }[] = [
    { id: "MO", label: "Monday", short: "M" },
    { id: "TU", label: "Tuesday", short: "T" },
    { id: "WE", label: "Wednesday", short: "W" },
    { id: "TH", label: "Thursday", short: "T" },
    { id: "FR", label: "Friday", short: "F" },
    { id: "SA", label: "Saturday", short: "S" },
    { id: "SU", label: "Sunday", short: "S" },
];

/** AI writing assistant tasks (CommAiTaskKind subset) and tones. */
export const CommAiTaskOptions: { id: "SUBJECT_LINES" | "WRITE_EMAIL" | "WRITE_SMS" | "IMPROVE_TONE" | "TRANSLATE"; label: string; channel?: "EMAIL" | "SMS" }[] = [
    { id: "SUBJECT_LINES", label: "Suggest subject lines", channel: "EMAIL" },
    { id: "WRITE_EMAIL", label: "Write an email draft", channel: "EMAIL" },
    { id: "WRITE_SMS", label: "Write an SMS", channel: "SMS" },
    { id: "IMPROVE_TONE", label: "Rewrite in another tone" },
    { id: "TRANSLATE", label: "Translate" },
];

export const CommAiToneOptions: { id: "friendly" | "professional" | "formal" | "enthusiastic" | "concise"; label: string }[] = [
    { id: "friendly", label: "Friendly" },
    { id: "professional", label: "Professional" },
    { id: "formal", label: "Formal" },
    { id: "enthusiastic", label: "Enthusiastic" },
    { id: "concise", label: "Short and direct" },
];
