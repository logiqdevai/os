import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";

/**
 * Money charts for finance dashboards. Colors come from the theme's chart tokens (--chart-1…5), axes and grid from
 * semantic tokens, so both themes stay readable. Values are plain numbers in `currency`.
 */
export interface SeriesSpec {
    key: string;
    label: string;
    color: 1 | 2 | 3 | 4 | 5;
    type?: "bar" | "line";
}

const monthLabel = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    if (!y || !mo) return m;
    return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString(undefined, { month: "short", timeZone: "UTC" });
};

function ChartTooltip({ active, payload, label, currency, labelFormatter }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; currency: string; labelFormatter?: (l: string) => string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-pop">
            <div className="mb-1 font-medium text-foreground">{labelFormatter ? labelFormatter(String(label)) : label}</div>
            {payload.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 rounded-full" style={{ background: p.color }} />
                        {p.name}
                    </span>
                    <span className="tabular text-foreground">{formatMoney(p.value, currency)}</span>
                </div>
            ))}
        </div>
    );
}

export function MonthlyMoneyChart({ data, series, currency, height = 260, xKey = "month" }: { data: Record<string, unknown>[]; series: SeriesSpec[]; currency: string; height?: number; xKey?: string }) {
    return (
        <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey={xKey} tickFormatter={xKey === "month" ? monthLabel : undefined} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <YAxis tickFormatter={(v) => formatMoney(v, currency, { compact: true })} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                    <Tooltip cursor={{ fill: "var(--border-soft)" }} content={<ChartTooltip currency={currency} labelFormatter={xKey === "month" ? monthLabel : undefined} />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} iconType="circle" iconSize={8} />
                    {series.map((s) =>
                        s.type === "line" ? (
                            <Line key={s.key} dataKey={s.key} name={s.label} stroke={`var(--chart-${s.color})`} strokeWidth={2} dot={false} type="monotone" />
                        ) : (
                            <Bar key={s.key} dataKey={s.key} name={s.label} fill={`var(--chart-${s.color})`} radius={[3, 3, 0, 0]} maxBarSize={28} />
                        ),
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

/** Horizontal bars for categories / customers / aging buckets. */
export function HorizontalMoneyBars({ data, currency, color = 1, height }: { data: { label: string; value: number }[]; currency: string; color?: 1 | 2 | 3 | 4 | 5; height?: number }) {
    return (
        <div style={{ height: height ?? Math.max(120, data.length * 34) }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="label" width={120} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "var(--border-soft)" }} content={<ChartTooltip currency={currency} />} />
                    <Bar dataKey="value" name="Amount" fill={`var(--chart-${color})`} radius={[0, 3, 3, 0]} maxBarSize={18} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function ChartCard({ title, description, children, action }: { title: string; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
    return (
        <div className="min-w-0 rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                    <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}
