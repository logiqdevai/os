import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";

interface Point {
    label: string;
    [series: string]: number | string;
}

const SERIES: Record<string, { label: string; color: string }> = {
    sent: { label: "Sent", color: "var(--chart-1)" },
    delivered: { label: "Delivered", color: "var(--chart-2)" },
    opened: { label: "Opened", color: "var(--chart-3)" },
    clicked: { label: "Clicked", color: "var(--chart-4)" },
    bounced: { label: "Bounced", color: "var(--chart-5)" },
};

/** Area chart of delivery counts over time (theme tokens only, works in light and dark). */
export function DailySendsChart({ series, keys = ["sent", "opened", "clicked"], hourly = false }: { series: ({ date?: string; t?: string } & Record<string, unknown>)[]; keys?: string[]; hourly?: boolean }) {
    const data: Point[] = series.map((p) => {
        const at = (p.date ?? p.t) as string;
        const point: Point = { label: hourly ? formatDate(at, "d MMM HH:mm") : formatDate(at, "d MMM") };
        for (const k of keys) point[k] = Number(p[k] ?? 0);
        return point;
    });
    return (
        <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip
                        contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
                        labelStyle={{ color: "var(--muted-foreground)" }}
                    />
                    {keys.map((k) => (
                        <Area key={k} type="monotone" dataKey={k} name={SERIES[k]?.label ?? k} stroke={SERIES[k]?.color} fill={SERIES[k]?.color} fillOpacity={0.12} strokeWidth={1.75} />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
