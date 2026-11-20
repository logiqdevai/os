import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Clock, ImagePlus, Loader2, MoveVertical, SmilePlus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { environments } from "@/config/environments";
import { WikiPageTypeFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { formatRelative, personName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WikiPageDetail, WikiPageType } from "@/features/docs/interfaces/docs.interfaces";
import { DOC_ICONS, DocIcon } from "./doc-icons";

/** Signed API paths (covers, images) → absolute URL for <img src>. */
export const apiUrl = (path: string) => `${environments.API_URL.replace(/\/$/, "")}${path}`;

export function pickImageFile(onFile: (f: File) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => { const f = input.files?.[0]; if (f) onFile(f); };
    input.click();
}

// ---------------------------------------------------------------------------------------------------------------------
// Breadcrumbs (top bar)
// ---------------------------------------------------------------------------------------------------------------------

export function PageBreadcrumbs({ page, title }: { page: WikiPageDetail; title: string }) {
    const crumbs = [
        { to: `/docs/spaces/${page.space.id}`, icon: page.space.icon, label: page.space.name },
        ...page.breadcrumbs.map((b) => ({ to: `/docs/pages/${b.id}`, icon: b.icon, label: b.title || "Untitled" })),
    ];
    return (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-0.5 text-[13px] text-muted-foreground">
            {crumbs.map((c, i) => (
                <span key={c.to} className={cn("flex min-w-0 items-center gap-0.5", i > 0 && i < crumbs.length - 1 && "hidden md:flex")}>
                    <Link to={c.to} className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-accent hover:text-foreground">
                        <DocIcon icon={c.icon} className="size-3.5" /><span className="max-w-40 truncate">{c.label}</span>
                    </Link>
                    <ChevronRight className="size-3 flex-none" />
                </span>
            ))}
            <span className="flex min-w-0 items-center gap-1 px-1 py-0.5 text-foreground"><DocIcon icon={page.icon} className="size-3.5" /><span className="truncate">{title || "Untitled"}</span></span>
        </nav>
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Full-bleed cover with Notion's hover controls: Change cover · Reposition (drag the image up / down, then Save) · Remove.
 * Read-only for viewers.
 */
export function PageCover({ url, position, editable, uploading, onChange, onReposition, onRemove }: {
    url: string; position: number; editable: boolean; uploading: boolean;
    onChange: (f: File) => void; onReposition: (p: number) => void; onRemove: () => void;
}) {
    const [moving, setMoving] = useState(false);
    const [pos, setPos] = useState(position);
    const drag = useRef<{ y: number; start: number; h: number } | null>(null);
    useEffect(() => { if (!moving) setPos(position); }, [position, moving]);
    return (
        <div className={cn("group/cover relative h-[30vh] max-h-80 min-h-40 w-full overflow-hidden bg-secondary", moving && "cursor-grab active:cursor-grabbing")}
            onPointerDown={(e) => { if (!moving || (e.target as HTMLElement).closest("button")) return; (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { y: e.clientY, start: pos, h: e.currentTarget.clientHeight }; }}
            onPointerMove={(e) => { if (!moving || !drag.current) return; const d = ((e.clientY - drag.current.y) / drag.current.h) * 100; setPos(Math.max(0, Math.min(100, Math.round(drag.current.start - d)))); }}
            onPointerUp={() => { drag.current = null; }}>
            <img src={url} alt="" draggable={false} className="size-full select-none object-cover" style={{ objectPosition: `50% ${pos}%` }} />
            {uploading && <div className="absolute inset-0 flex items-center justify-center bg-background/40"><Loader2 className="size-5 animate-spin text-foreground" /></div>}
            {editable && (
                <div className={cn("absolute bottom-3 right-4 flex gap-1 opacity-0 transition-opacity group-hover/cover:opacity-100 focus-within:opacity-100", moving && "opacity-100")}>
                    {moving ? (
                        <>
                            <span className="rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground">Drag image to reposition</span>
                            <Button size="sm" variant="secondary" onClick={() => { setMoving(false); setPos(position); }}>Cancel</Button>
                            <Button size="sm" onClick={() => { setMoving(false); onReposition(pos); }}>Save position</Button>
                        </>
                    ) : (
                        <>
                            <Button size="sm" variant="secondary" className="bg-background/90" onClick={() => pickImageFile(onChange)}><ImagePlus /> Change cover</Button>
                            <Button size="sm" variant="secondary" className="bg-background/90" onClick={() => setMoving(true)}><MoveVertical /> Reposition</Button>
                            <Button size="icon-sm" variant="secondary" className="bg-background/90" aria-label="Remove cover" onClick={onRemove}><Trash2 /></Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------------------------------------------------

/** The big page icon (click to change) or, when there is none, the "Add icon" hover button. */
export function PageIconPicker({ value, editable, onChange, children }: { value: string | null; editable: boolean; onChange: (v: string) => void; children?: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    if (!editable) return value ? <DocIcon icon={value} className="size-16 text-foreground" /> : null;
    const pick = (v: string) => { onChange(v); setOpen(false); };
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children ?? (
                    <button type="button" aria-label="Change icon" className="flex size-[72px] items-center justify-center rounded-lg hover:bg-accent">
                        <DocIcon icon={value} className="size-16 text-foreground" />
                    </button>
                )}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
                <div className="mb-1 flex items-center justify-between px-1"><span className="text-xs font-medium text-muted-foreground">Icon</span>{value && <Button type="button" variant="ghost" size="sm" onClick={() => pick("")}>Remove</Button>}</div>
                <div role="listbox" aria-label="Icons" className="grid grid-cols-8 gap-0.5">
                    {Object.entries(DOC_ICONS).map(([name, Icon]) => (
                        <button key={name} type="button" role="option" aria-selected={value === name} aria-label={name.replace(/-/g, " ")} title={name.replace(/-/g, " ")} onClick={() => pick(name)}
                            className={cn("flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground", value === name && "bg-accent text-foreground")}>
                            <Icon className="size-4" />
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export const AddIconButton = (props: React.ComponentProps<"button">) => (
    <button type="button" {...props} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"><SmilePlus className="size-4" /> Add icon</button>
);

// ---------------------------------------------------------------------------------------------------------------------
// Properties row (Notion's page properties): type, owner, review cadence, required reading, last edit
// ---------------------------------------------------------------------------------------------------------------------

function Prop({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
    return (
        <div className="grid min-h-8 grid-cols-[150px_minmax(0,1fr)] items-center gap-2 text-[13px]">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="size-3.5" /> {label}</span>
            <div className="min-w-0 text-foreground">{children}</div>
        </div>
    );
}

export function PageProperties({ page, editable, canManage, onPatch, onReacknowledge }: {
    page: WikiPageDetail; editable: boolean; canManage: boolean;
    onPatch: (p: { page_type?: WikiPageType; review_interval_days?: number; requires_acknowledgement?: boolean }) => void;
    onReacknowledge: () => void;
}) {
    const [review, setReview] = useState(page.review_interval_days ? String(page.review_interval_days) : "");
    useEffect(() => setReview(page.review_interval_days ? String(page.review_interval_days) : ""), [page.review_interval_days]);
    const saveReview = () => { const n = Number(review); if (review && Number.isInteger(n) && n > 0 && n <= 730 && n !== page.review_interval_days) onPatch({ review_interval_days: n }); };
    const typeLabel = WikiPageTypeFormOptions.find((o) => o.id === page.page_type)?.label ?? "Page";
    return (
        <div className="space-y-0.5 border-b border-border pb-3">
            <Prop label="Type" icon={ChevronRight}>
                {editable ? (
                    <Select value={page.page_type} onValueChange={(v) => onPatch({ page_type: v as WikiPageType })}>
                        <SelectTrigger aria-label="Page type" className="h-7 w-auto min-w-32 border-transparent px-1.5 shadow-none hover:bg-accent"><SelectValue /></SelectTrigger>
                        <SelectContent>{WikiPageTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                ) : <span className="px-1.5">{typeLabel}</span>}
            </Prop>
            <Prop label="Owner" icon={User}><span className="px-1.5">{page.owner ? personName(page.owner.user) : "No owner"}</span></Prop>
            <Prop label="Review every" icon={Clock}>
                {editable ? (
                    <span className="flex items-center gap-1.5">
                        <Input value={review} onChange={(e) => setReview(e.target.value.replace(/\D/g, ""))} onBlur={saveReview} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} inputMode="numeric" placeholder="Empty"
                            aria-label="Review every (days)" className="h-7 w-20 border-transparent px-1.5 shadow-none hover:bg-accent focus-visible:border-border" />
                        {review && <span className="text-muted-foreground">days{page.next_review_at ? ` · next ${formatRelative(page.next_review_at)}` : ""}</span>}
                    </span>
                ) : <span className="px-1.5">{page.review_interval_days ? `${page.review_interval_days} days` : "—"}</span>}
            </Prop>
            <Prop label="Required reading" icon={User}>
                <span className="flex flex-wrap items-center gap-2 px-1.5">
                    {editable ? <Switch checked={page.requires_acknowledgement} onCheckedChange={(on) => onPatch({ requires_acknowledgement: on })} aria-label="Readers must acknowledge" /> : <span>{page.requires_acknowledgement ? "Yes" : "No"}</span>}
                    {page.requires_acknowledgement && canManage && page.ack_version_number !== null && page.ack_version_number < page.current_version_number && (
                        <Button size="sm" variant="ghost" className="h-7" onClick={onReacknowledge}>Ask readers to confirm again</Button>
                    )}
                </span>
            </Prop>
            <Prop label="Last edited" icon={Clock}><span className="px-1.5 text-muted-foreground">{formatRelative(page.last_edited_at ?? page.updated_at)}</span></Prop>
        </div>
    );
}
