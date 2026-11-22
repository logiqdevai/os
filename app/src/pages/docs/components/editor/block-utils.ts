export const MEDIA_KINDS = ["video", "audio", "file", "embed", "bookmark"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** "2026-11-22" → "Nov 22, 2026" (local calendar date, no timezone shift). */
export const formatChipDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
