import { formatDate } from "@/lib/format";
import { WeekdayOptions } from "@/config/constants/dropdowns/communications/campaign-ab.options";

/** Human text for a campaign RRULE ("Every 2 weeks on Monday, Friday · until 31 Dec 2026"). */
export function describeRepeat(rule: string | null, endsAt: string | null): string {
    if (!rule) return "Does not repeat";
    const map = new Map(rule.split(";").map((p) => p.split("=") as [string, string]));
    const freq = map.get("FREQ");
    const n = Number(map.get("INTERVAL") ?? 1);
    const unit = freq === "DAILY" ? "day" : freq === "WEEKLY" ? "week" : "month";
    const days = (map.get("BYDAY") ?? "").split(",").filter(Boolean).map((d) => WeekdayOptions.find((w) => w.id === d)?.label ?? d);
    const base = n > 1 ? `Every ${n} ${unit}s` : `Every ${unit}`;
    return `${base}${days.length ? ` on ${days.join(", ")}` : ""}${endsAt ? ` · until ${formatDate(endsAt)}` : ""}`;
}
