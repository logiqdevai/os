import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DatesDialog, type DatesDialogTarget } from "./dates-dialog";
import { dayToIso, formatDay, mondays, monthLabel, monthStarts, PX_PER_DAY, toDay, todayDay, type GanttZoom } from "./gantt.utils";

export type GanttTone = "info" | "success" | "warning" | "danger" | "neutral" | "violet";

/** A dated point drawn on another row (milestones on a project row in the portfolio). */
export interface GanttMarker {
    id: string;
    label: string;
    date: string | null;
    tone: GanttTone;
    editable: boolean;
}

export interface GanttItem {
    /** Unique across the chart, e.g. `milestone:<uuid>`. */
    id: string;
    /** `bar` for date ranges, `diamond` for single dates (milestones). */
    shape: "bar" | "diamond";
    label: string;
    sublabel?: string;
    href?: string;
    start: string | null;
    end: string | null;
    tone: GanttTone;
    /** 0–100, drawn inside bars. */
    progress?: number;
    depth?: number;
    editable: boolean;
    markers?: GanttMarker[];
}

export interface GanttSection {
    id: string;
    label?: string;
    items: GanttItem[];
}

export interface GanttLink {
    id: string;
    from: string;
    to: string;
}

export interface GanttChange {
    id: string;
    start: string;
    end: string;
}

const LABEL_W = 232;
const ROW_H = 36;
const HEADER_H = 44;

const BAR_TONE: Record<GanttTone, string> = {
    info: "border-info/50 bg-info-soft text-info",
    success: "border-success/50 bg-success-soft text-success",
    warning: "border-warning/50 bg-warning-soft text-warning",
    danger: "border-danger/50 bg-danger-soft text-danger",
    violet: "border-violet/50 bg-violet-soft text-violet",
    neutral: "border-border-strong bg-secondary text-body",
};
const FILL_TONE: Record<GanttTone, string> = { info: "bg-info/25", success: "bg-success/25", warning: "bg-warning/25", danger: "bg-danger/25", violet: "bg-violet/25", neutral: "bg-ash/25" };
const DIAMOND_TONE: Record<GanttTone, string> = { info: "bg-info", success: "bg-success", warning: "bg-warning", danger: "bg-danger", violet: "bg-violet", neutral: "bg-ash" };

interface Span {
    id: string;
    label: string;
    shape: "bar" | "diamond";
    start: number;
    end: number;
    row: number;
    editable: boolean;
    tone: GanttTone;
}

/** Live change while dragging or moving with the keyboard: day deltas for start and end. */
interface Adjust {
    id: string;
    ds: number;
    de: number;
    originX?: number;
    mode?: "move" | "start" | "end";
    pointerId?: number;
}

const span = (start: string | null, end: string | null) => {
    const s = toDay(start) ?? toDay(end);
    const e = toDay(end) ?? toDay(start);
    if (s === null || e === null) return null;
    return { start: Math.min(s, e), end: Math.max(s, e) };
};

/**
 * Desktop Gantt (md and up): rows of bars and diamonds over a day grid, dependency connectors, a today line.
 * Editable items drag with pointer events (body = move, edges = resize) or move with the keyboard
 * (←/→ move, Shift+←/→ change the end, Enter saves, Esc cancels); every row also has a "Change dates…" menu.
 * Pair with `GanttMobileList` below md.
 */
export function Gantt({
    sections,
    links = [],
    zoom,
    onChange,
    todaySignal = 0,
    className,
}: {
    sections: GanttSection[];
    links?: GanttLink[];
    zoom: GanttZoom;
    onChange: (change: GanttChange) => Promise<unknown>;
    /** Change this number to scroll the chart to today. */
    todaySignal?: number;
    className?: string;
}) {
    const px = PX_PER_DAY[zoom];
    const markerId = useId().replace(/:/g, "");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [adjust, setAdjust] = useState<Adjust | null>(null);
    const [pending, setPending] = useState<Record<string, { start: number; end: number }>>({});
    const [dialog, setDialog] = useState<DatesDialogTarget | null>(null);

    // Fresh data replaces optimistic positions.
    useEffect(() => setPending({}), [sections]);

    const { rows, spans, day0, dayN } = useMemo(() => {
        const rows: ({ type: "section"; id: string; label: string } | { type: "item"; item: GanttItem })[] = [];
        const spans = new Map<string, Span>();
        for (const section of sections) {
            if (section.label) rows.push({ type: "section", id: section.id, label: section.label });
            for (const item of section.items) {
                const row = rows.length;
                rows.push({ type: "item", item });
                const s = span(item.start, item.end);
                if (s) spans.set(item.id, { id: item.id, label: item.label, shape: item.shape, ...s, row, editable: item.editable, tone: item.tone });
                for (const m of item.markers ?? []) {
                    const d = toDay(m.date);
                    if (d !== null) spans.set(m.id, { id: m.id, label: m.label, shape: "diamond", start: d, end: d, row, editable: m.editable, tone: m.tone });
                }
            }
        }
        const today = todayDay();
        let min = today;
        let max = today;
        for (const s of spans.values()) {
            min = Math.min(min, s.start);
            max = Math.max(max, s.end);
        }
        // Pad, and keep the chart to a sane length.
        const day0 = Math.max(min - 14, max - 3 * 366);
        const dayN = Math.max(max + 28, day0 + Math.ceil(900 / px));
        return { rows, spans, day0, dayN };
    }, [sections, px]);

    const width = (dayN - day0 + 1) * px;
    const height = rows.length * ROW_H;
    const today = todayDay();
    const x = (day: number) => (day - day0) * px;

    /** Current position of a span with optimistic and live changes applied. */
    const pos = (s: Span) => {
        const base = pending[s.id] ?? { start: s.start, end: s.end };
        if (adjust?.id !== s.id) return base;
        if (s.shape === "diamond") return { start: base.start + adjust.ds, end: base.start + adjust.ds };
        const start = base.start + adjust.ds;
        const end = base.end + adjust.de;
        return start <= end ? { start, end } : adjust.mode === "start" ? { start: end, end } : { start, end: start };
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollLeft = Math.max(0, x(today) - (el.clientWidth - LABEL_W) / 3);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [todaySignal, zoom]);

    const commit = async (s: Span, next: { start: number; end: number }) => {
        if (next.start === s.start && next.end === s.end) return;
        setPending((p) => ({ ...p, [s.id]: next }));
        try {
            await onChange({ id: s.id, start: dayToIso(next.start), end: dayToIso(next.end) });
        } catch {
            setPending((p) => {
                const n = { ...p };
                delete n[s.id];
                return n;
            });
        }
    };

    const onPointerDown = (e: PointerEvent<HTMLElement>, s: Span, mode: "move" | "start" | "end") => {
        if (!s.editable || e.button !== 0) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setAdjust({ id: s.id, ds: 0, de: 0, originX: e.clientX, mode, pointerId: e.pointerId });
    };
    const onPointerMove = (e: PointerEvent<HTMLElement>) => {
        if (!adjust || adjust.originX === undefined || e.pointerId !== adjust.pointerId) return;
        const delta = Math.round((e.clientX - adjust.originX) / px);
        const ds = adjust.mode === "end" ? 0 : delta;
        const de = adjust.mode === "start" ? 0 : delta;
        if (ds !== adjust.ds || de !== adjust.de) setAdjust({ ...adjust, ds, de });
    };
    const onPointerUp = (e: PointerEvent<HTMLElement>) => {
        if (!adjust || adjust.originX === undefined || e.pointerId !== adjust.pointerId) return;
        const s = spans.get(adjust.id);
        const next = s ? pos(s) : null;
        setAdjust(null);
        if (s && next) void commit({ ...s, ...(pending[s.id] ?? {}) }, next);
    };
    const onKeyDown = (e: KeyboardEvent<HTMLElement>, s: Span) => {
        if (!s.editable) return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const step = e.key === "ArrowLeft" ? -1 : 1;
            setAdjust((a) => {
                const cur = a?.id === s.id && a.originX === undefined ? a : { id: s.id, ds: 0, de: 0 };
                return e.shiftKey && s.shape === "bar" ? { ...cur, de: cur.de + step, mode: "end" } : { ...cur, ds: cur.ds + step, de: cur.de + step, mode: "move" };
            });
        } else if (e.key === "Enter" && adjust?.id === s.id) {
            e.preventDefault();
            const next = pos(s);
            setAdjust(null);
            void commit({ ...s, ...(pending[s.id] ?? {}) }, next);
        } else if (e.key === "Escape" && adjust?.id === s.id) {
            e.preventDefault();
            setAdjust(null);
        }
    };

    const openDialog = (s: Span) => {
        const p = pending[s.id] ?? s;
        setDialog({ id: s.id, label: s.label, single: s.shape === "diamond", start: dayToIso(p.start), end: dayToIso(p.end) });
    };
    const openUndated = (item: GanttItem) => setDialog({ id: item.id, label: item.label, single: item.shape === "diamond", start: null, end: null });

    const describe = (s: Span, p: { start: number; end: number }) =>
        s.shape === "diamond" ? `${s.label}, ${formatDay(p.start, true)}` : `${s.label}, ${formatDay(p.start, true)} to ${formatDay(p.end, true)}`;
    const keyboardHint = ". Use left and right arrows to move, Shift with arrows to change the end, Enter to save, Escape to cancel.";

    const renderSpan = (s: Span) => {
        const p = pos(s);
        const active = adjust?.id === s.id;
        const common = {
            role: "button" as const,
            tabIndex: s.editable ? 0 : -1,
            "aria-label": describe(s, p) + (s.editable ? keyboardHint : ""),
            title: describe(s, p),
            onKeyDown: (e: KeyboardEvent<HTMLElement>) => onKeyDown(e, s),
            onBlur: () => adjust?.id === s.id && adjust.originX === undefined && setAdjust(null),
        };
        if (s.shape === "diamond") {
            return (
                <div
                    key={s.id}
                    {...common}
                    onPointerDown={(e) => onPointerDown(e, s, "move")}
                    className={cn("absolute top-1/2 z-10 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", s.editable && "cursor-grab touch-none", active && "cursor-grabbing")}
                    style={{ left: x(p.start) + px / 2 }}
                >
                    <span className={cn("block size-3 rotate-45 rounded-[2px] ring-2 ring-card", DIAMOND_TONE[s.tone], active && "ring-ring")} />
                </div>
            );
        }
        const item = rows[s.row]?.type === "item" ? (rows[s.row] as { item: GanttItem }).item : null;
        const w = (p.end - p.start + 1) * px;
        return (
            <div
                key={s.id}
                {...common}
                onPointerDown={(e) => onPointerDown(e, s, "move")}
                className={cn(
                    "absolute top-1/2 z-10 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md border text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    BAR_TONE[s.tone],
                    s.editable && "cursor-grab touch-none",
                    active && "cursor-grabbing ring-2 ring-ring",
                )}
                style={{ left: x(p.start), width: Math.max(w, 6) }}
            >
                {item?.progress ? <span aria-hidden className={cn("absolute inset-y-0 left-0", FILL_TONE[s.tone])} style={{ width: `${Math.min(100, item.progress)}%` }} /> : null}
                {w > 56 && <span className="relative truncate px-2">{s.label}</span>}
                {s.editable && w > 12 && (
                    <>
                        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize" onPointerDown={(e) => onPointerDown(e, s, "start")} />
                        <span aria-hidden className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" onPointerDown={(e) => onPointerDown(e, s, "end")} />
                    </>
                )}
            </div>
        );
    };

    const linkPaths = links.flatMap((l) => {
        const a = spans.get(l.from);
        const b = spans.get(l.to);
        if (!a || !b) return [];
        const pa = pos(a);
        const pb = pos(b);
        const sx = a.shape === "diamond" ? x(pa.start) + px / 2 + 6 : x(pa.end + 1);
        const tx = b.shape === "diamond" ? x(pb.start) + px / 2 - 6 : x(pb.start);
        const sy = a.row * ROW_H + ROW_H / 2;
        const ty = b.row * ROW_H + ROW_H / 2;
        const conflict = (b.shape === "diamond" ? pb.start : pb.start) < (a.shape === "diamond" ? pa.start : pa.end + 1);
        const bend = Math.max(16, Math.abs(tx - sx) / 2);
        return [{ id: l.id, d: `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`, conflict, label: `${a.label} → ${b.label}` }];
    });

    const months = monthStarts(day0, dayN);
    const weeks = zoom === "quarter" ? [] : mondays(day0, dayN);

    return (
        <div className={cn("hidden rounded-lg border border-border bg-card md:block", className)}>
            <div ref={scrollRef} className="overflow-x-auto" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setAdjust(null)}>
                <div className="relative" style={{ width: LABEL_W + width }}>
                    {/* Header */}
                    <div className="flex border-b border-border" style={{ height: HEADER_H }}>
                        <div className="sticky left-0 z-30 flex flex-none items-end border-r border-border bg-card px-3 pb-1.5 text-xs font-medium text-muted-foreground" style={{ width: LABEL_W }}>Item</div>
                        <div className="relative flex-none" style={{ width }}>
                            {months.map((m) => (
                                <span key={m} className="absolute top-1.5 whitespace-nowrap pl-1.5 text-[11px] font-medium text-foreground" style={{ left: x(m) }}>{monthLabel(m)}</span>
                            ))}
                            {px * 7 >= 40 && weeks.map((w) => (
                                <span key={w} className="absolute bottom-1 whitespace-nowrap pl-1 text-[10.5px] text-muted-foreground" style={{ left: x(w) }}>{formatDay(w)}</span>
                            ))}
                        </div>
                    </div>

                    {/* Grid, today line and dependency connectors (behind the bars) */}
                    <div aria-hidden className="pointer-events-none absolute" style={{ top: HEADER_H, left: LABEL_W, width, height }}>
                        {weeks.map((w) => <span key={`w${w}`} className="absolute inset-y-0 w-px bg-border-soft" style={{ left: x(w) }} />)}
                        {months.map((m) => <span key={`m${m}`} className="absolute inset-y-0 w-px bg-border" style={{ left: x(m) }} />)}
                        {today >= day0 && today <= dayN && <span className="absolute inset-y-0 w-0.5 bg-danger/70" style={{ left: x(today) + px / 2 }} />}
                        <svg className="absolute inset-0 overflow-visible" width={width} height={height}>
                            <defs>
                                <marker id={`${markerId}-a`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                                    <path d="M0 0 L8 4 L0 8 z" fill="var(--ash)" />
                                </marker>
                                <marker id={`${markerId}-c`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                                    <path d="M0 0 L8 4 L0 8 z" fill="var(--danger)" />
                                </marker>
                            </defs>
                            {linkPaths.map((l) => (
                                <path key={l.id} d={l.d} fill="none" stroke={l.conflict ? "var(--danger)" : "var(--ash)"} strokeWidth={1.5} strokeDasharray={l.conflict ? "4 3" : undefined} markerEnd={`url(#${markerId}-${l.conflict ? "c" : "a"})`}>
                                    <title>{l.label}{l.conflict ? " (starts before its dependency ends)" : ""}</title>
                                </path>
                            ))}
                        </svg>
                    </div>

                    {/* Rows */}
                    {rows.map((r, i) => {
                        if (r.type === "section") {
                            return (
                                <div key={`s-${r.id}`} className="flex border-b border-border bg-muted/60" style={{ height: ROW_H }}>
                                    <div className="sticky left-0 z-20 flex flex-none items-center bg-muted px-3 text-xs font-medium text-foreground" style={{ width: LABEL_W }}>
                                        <span className="truncate">{r.label}</span>
                                    </div>
                                    <div className="flex-none" style={{ width }} />
                                </div>
                            );
                        }
                        const item = r.item;
                        const own = spans.get(item.id);
                        const markerSpans = (item.markers ?? []).map((m) => spans.get(m.id)).filter(Boolean) as Span[];
                        const menuTargets = [own, ...markerSpans].filter((s): s is Span => !!s && s.editable);
                        const canDateUndated = !own && item.editable;
                        return (
                            <div key={item.id} className="group flex border-b border-border-soft" style={{ height: ROW_H }} data-row={i}>
                                <div className="sticky left-0 z-20 flex flex-none items-center gap-1 border-r border-border bg-card pr-1" style={{ width: LABEL_W, paddingLeft: 12 + (item.depth ?? 0) * 14 }}>
                                    <div className="min-w-0 flex-1 leading-tight">
                                        {item.href ? (
                                            <Link to={item.href} className="block truncate text-[13px] text-foreground hover:underline">{item.label}</Link>
                                        ) : (
                                            <span className="block truncate text-[13px] text-foreground">{item.label}</span>
                                        )}
                                        {item.sublabel && <span className="block truncate text-[11px] text-muted-foreground">{item.sublabel}</span>}
                                    </div>
                                    {(menuTargets.length > 0 || canDateUndated) && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon-sm" aria-label={`Change dates of ${item.label}`} className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"><MoreHorizontal /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel className="text-xs">Change dates</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {canDateUndated && <DropdownMenuItem onSelect={() => openUndated(item)}><CalendarClock /> Set dates…</DropdownMenuItem>}
                                                {menuTargets.map((s) => (
                                                    <DropdownMenuItem key={s.id} onSelect={() => openDialog(s)}><CalendarClock /> <span className="truncate">{s.id === item.id ? "This item" : s.label}…</span></DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                                <div className="relative flex-none" style={{ width }}>
                                    {own ? renderSpan(own) : (
                                        <span className="absolute top-1/2 -translate-y-1/2 pl-2 text-[11px] italic text-muted-foreground" style={{ left: x(today) + 8 }}>No dates</span>
                                    )}
                                    {markerSpans.map(renderSpan)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <DatesDialog
                target={dialog}
                onOpenChange={(o) => !o && setDialog(null)}
                onSave={(start, end) => onChange({ id: dialog!.id, start, end })}
            />
        </div>
    );
}

/** Below md: the same items as a list grouped by month, each with a "Change dates" action. */
export function GanttMobileList({ sections, onChange }: { sections: GanttSection[]; onChange: (change: GanttChange) => Promise<unknown> }) {
    const [dialog, setDialog] = useState<DatesDialogTarget | null>(null);
    const groups = useMemo(() => {
        type Entry = { id: string; label: string; sublabel?: string; href?: string; start: number | null; end: number | null; tone: GanttTone; editable: boolean; single: boolean };
        const entries: Entry[] = [];
        for (const section of sections) {
            for (const item of section.items) {
                const s = span(item.start, item.end);
                entries.push({ id: item.id, label: item.label, sublabel: [section.label, item.sublabel].filter(Boolean).join(" · ") || undefined, href: item.href, start: s?.start ?? null, end: s?.end ?? null, tone: item.tone, editable: item.editable, single: item.shape === "diamond" });
                for (const m of item.markers ?? []) {
                    const d = toDay(m.date);
                    entries.push({ id: m.id, label: m.label, sublabel: item.label, href: item.href, start: d, end: d, tone: m.tone, editable: m.editable, single: true });
                }
            }
        }
        const dated = entries.filter((e) => e.start !== null).sort((a, b) => (a.start as number) - (b.start as number));
        const byMonth = new Map<string, Entry[]>();
        for (const e of dated) {
            const key = monthLabel(e.start as number);
            byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
        }
        const out = [...byMonth.entries()].map(([label, items]) => ({ label, items }));
        const undated = entries.filter((e) => e.start === null);
        if (undated.length) out.push({ label: "Unscheduled", items: undated });
        return out;
    }, [sections]);

    if (!groups.length) return null;
    return (
        <div className="space-y-5 md:hidden">
            {groups.map((g) => (
                <section key={g.label} aria-label={g.label}>
                    <h3 className="mb-2 text-xs font-medium text-muted-foreground">{g.label}</h3>
                    <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                        {g.items.map((e) => (
                            <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                                <span aria-hidden className={cn("size-2.5 flex-none", e.single ? "rotate-45 rounded-[2px]" : "rounded-full", DIAMOND_TONE[e.tone])} />
                                <div className="min-w-0 flex-1">
                                    {e.href ? <Link to={e.href} className="block truncate text-[13px] font-medium text-foreground">{e.label}</Link> : <span className="block truncate text-[13px] font-medium text-foreground">{e.label}</span>}
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {e.start === null ? "No dates" : e.single || e.start === e.end ? formatDay(e.start, true) : `${formatDay(e.start)} – ${formatDay(e.end as number, true)}`}
                                        {e.sublabel ? ` · ${e.sublabel}` : ""}
                                    </span>
                                </div>
                                {e.editable && (
                                    <Button variant="ghost" size="icon-sm" aria-label={`Change dates of ${e.label}`} onClick={() => setDialog({ id: e.id, label: e.label, single: e.single, start: e.start === null ? null : dayToIso(e.start), end: e.end === null ? null : dayToIso(e.end) })}>
                                        <CalendarClock />
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
            <DatesDialog target={dialog} onOpenChange={(o) => !o && setDialog(null)} onSave={(start, end) => onChange({ id: dialog!.id, start, end })} />
        </div>
    );
}
