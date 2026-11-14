import { useMemo } from "react";
import { SearchableSelect, type SearchableGroup, type SearchableOption } from "@/components/ui/searchable-select";

/** Most-used currencies, shown first. */
const POPULAR = ["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "SEK", "NOK", "DKK", "PLN", "JPY", "CNY", "INR", "AED", "BRL", "MXN"];

let names: Intl.DisplayNames | undefined;
function currencyName(code: string): string {
    try {
        names ??= new Intl.DisplayNames(["en"], { type: "currency" });
        return names.of(code) ?? code;
    } catch {
        return code;
    }
}
const toOption = (code: string): SearchableOption => ({ value: code, label: `${code} · ${currencyName(code)}` });

let cached: SearchableGroup[] | undefined;
function buildGroups(): SearchableGroup[] {
    if (cached) return cached;
    let all: string[] = [];
    try { all = Intl.supportedValuesOf("currency"); } catch { /* old browser: popular only */ }
    cached = [
        { heading: "Most used", options: POPULAR.map(toOption) },
        { heading: "All currencies", options: all.filter((c) => !POPULAR.includes(c)).map(toOption) },
    ];
    return cached;
}

/**
 * Shared currency selector (ISO 4217): searchable, most-used currencies first.
 * `emptyLabel` adds a leading "no value" option (e.g. "Organization default") that maps to `emptyValue`.
 */
export function CurrencySelect({
    value, onChange, emptyLabel, emptyValue = "", disabled, className, id, "aria-label": ariaLabel = "Currency",
}: { value: string | null | undefined; onChange: (code: string) => void; emptyLabel?: string; emptyValue?: string; disabled?: boolean; className?: string; id?: string; "aria-label"?: string }) {
    const groups = useMemo(() => {
        const base = buildGroups();
        return emptyLabel ? [{ heading: "", options: [{ value: emptyValue, label: emptyLabel }] }, ...base] : base;
    }, [emptyLabel, emptyValue]);
    return <SearchableSelect id={id} aria-label={ariaLabel} className={className} disabled={disabled} value={value ?? emptyValue} onChange={onChange} groups={groups} placeholder="Select currency" searchPlaceholder="Search currencies..." renderValue={(v) => (v ? toOption(v.toUpperCase()).label : undefined)} />;
}
