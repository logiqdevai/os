import { useEffect, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { AlertTriangle, ArrowUpRight, Flame, ImageOff, Info, Lightbulb, MessageSquareWarning, type LucideIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEditorEnv } from "./editor-env";

/** Callout kinds: GitHub alert names in the Markdown, semantic theme tokens on screen (light + dark). */
export const CALLOUT_META: Record<string, { label: string; icon: LucideIcon; className: string; iconClass: string }> = {
    note: { label: "Note", icon: Info, className: "bg-info-soft border-info/30", iconClass: "text-info" },
    tip: { label: "Tip", icon: Lightbulb, className: "bg-success-soft border-success/30", iconClass: "text-success" },
    important: { label: "Important", icon: MessageSquareWarning, className: "bg-violet-soft border-violet/30", iconClass: "text-violet" },
    warning: { label: "Warning", icon: AlertTriangle, className: "bg-warning-soft border-warning/30", iconClass: "text-warning" },
    caution: { label: "Caution", icon: Flame, className: "bg-danger-soft border-danger/30", iconClass: "text-danger" },
};

export function CalloutView({ node, updateAttributes }: ReactNodeViewProps) {
    const env = useEditorEnv();
    const meta = CALLOUT_META[node.attrs.type as string] ?? CALLOUT_META.note;
    const Icon = meta.icon;
    return (
        <NodeViewWrapper data-callout={node.attrs.type} className={cn("my-1 flex gap-2.5 rounded-md border px-3 py-2.5", meta.className)}>
            <div contentEditable={false} className="pt-0.5">
                {env.editable ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button type="button" aria-label={`Callout type: ${meta.label}`} className="flex size-6 items-center justify-center rounded hover:bg-background/60">
                                <Icon className={cn("size-4", meta.iconClass)} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {Object.entries(CALLOUT_META).map(([type, m]) => (
                                <DropdownMenuItem key={type} onSelect={() => updateAttributes({ type })}><m.icon className={m.iconClass} /> {m.label}</DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : <span className="flex size-6 items-center justify-center" aria-label={meta.label}><Icon className={cn("size-4", meta.iconClass)} /></span>}
            </div>
            <NodeViewContent className="min-w-0 flex-1 [&>p+p]:mt-1" />
        </NodeViewWrapper>
    );
}

export function PageRefView({ node, selected }: ReactNodeViewProps) {
    const env = useEditorEnv();
    const title = (node.attrs.title as string) || "Untitled";
    return (
        <NodeViewWrapper as="span" className="inline">
            <button
                type="button"
                contentEditable={false}
                onClick={() => env.openPage({ id: (node.attrs.id as string | null) ?? null, title })}
                className={cn("mx-px inline-flex items-baseline gap-1 rounded px-0.5 font-medium text-foreground underline decoration-border underline-offset-[3px] hover:bg-accent", selected && "bg-accent ring-1 ring-ring")}
            >
                <ArrowUpRight className="size-3.5 self-center text-muted-foreground" aria-hidden />
                {title}
            </button>
        </NodeViewWrapper>
    );
}

export function ImageView({ node, selected }: ReactNodeViewProps) {
    const env = useEditorEnv();
    const src = node.attrs.src as string;
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let alive = true;
        setFailed(false);
        env.resolveImage(src).then((u) => { if (alive) { setUrl(u); setFailed(!u); } }).catch(() => alive && setFailed(true));
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);
    return (
        <NodeViewWrapper as="figure" className="my-2" data-drag-handle>
            {failed ? (
                <div className="flex h-32 items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary text-[13px] text-muted-foreground"><ImageOff className="size-4" /> Image unavailable</div>
            ) : url ? (
                <img src={url} alt={(node.attrs.alt as string) ?? ""} className={cn("max-h-[560px] max-w-full rounded-md", selected && "ring-2 ring-ring")} draggable={false} />
            ) : <div className="h-40 w-full animate-pulse rounded-md bg-secondary" />}
        </NodeViewWrapper>
    );
}
