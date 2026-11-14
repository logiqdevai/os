import { useMemo } from "react";
import { SearchableSelect, type SearchableGroup, type SearchableOption } from "@/components/ui/searchable-select";

/** Most-used zones, shown first. */
const POPULAR = [
    "UTC", "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Athens", "Europe/Istanbul",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo",
    "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
];

function offsetLabel(zone: string): string {
    try {
        const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
        return part?.value ?? "";
    } catch {
        return "";
    }
}

const toOption = (zone: string): SearchableOption => {
    const offset = offsetLabel(zone);
    const name = zone.replace(/_/g, " ");
    return { value: zone, label: offset ? `${name} (${offset})` : name, keywords: zone };
};

let cached: SearchableGroup[] | undefined;
function buildGroups(): SearchableGroup[] {
    if (cached) return cached;
    let all: string[] = [];
    try { all = Intl.supportedValuesOf("timeZone"); } catch { /* old browser: popular zones only */ }
    const byRegion = new Map<string, string[]>();
    for (const z of [...new Set(all)].sort()) {
        if (POPULAR.includes(z)) continue;
        const region = z.includes("/") ? z.split("/")[0] : "Other";
        byRegion.set(region, [...(byRegion.get(region) ?? []), z]);
    }
    cached = [
        { heading: "Most used", options: POPULAR.map(toOption) },
        ...[...byRegion.entries()].map(([heading, zones]) => ({ heading, options: zones.map(toOption) })),
    ];
    return cached;
}

/**
 * Shared IANA timezone selector: searchable, most-used zones on top, the rest grouped by region.
 * `emptyLabel` adds a leading "no value" option (e.g. "Organization default") that maps to `emptyValue`.
 */
export function TimezoneSelect({
    value, onChange, emptyLabel, emptyValue = "", disabled, className, id, "aria-label": ariaLabel = "Timezone",
}: { value: string | null | undefined; onChange: (zone: string) => void; emptyLabel?: string; emptyValue?: string; disabled?: boolean; className?: string; id?: string; "aria-label"?: string }) {
    const groups = useMemo(() => {
        const base = buildGroups();
        return emptyLabel ? [{ heading: "", options: [{ value: emptyValue, label: emptyLabel }] }, ...base] : base;
    }, [emptyLabel, emptyValue]);
    return <SearchableSelect id={id} aria-label={ariaLabel} className={className} disabled={disabled} value={value ?? emptyValue} onChange={onChange} groups={groups} placeholder="Select timezone" searchPlaceholder="Search timezones..." renderValue={(v) => (v ? toOption(v).label : undefined)} />;
}
