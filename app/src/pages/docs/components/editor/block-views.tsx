import { useEffect, useId, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import katex from "katex";
import "katex/dist/katex.min.css";
import { CalendarDays, ExternalLink, FileIcon, Globe, ListTree, Loader2, Music, Sigma, Upload, Video, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { useEditorEnv } from "./editor-env";
import { CODE_LANGUAGES } from "./code-languages";
import { formatChipDate, type MediaKind } from "./block-utils";

// ---------------------------------------------------------------------------------------------------------------------
// Media: video, audio, file, embed, bookmark
// ---------------------------------------------------------------------------------------------------------------------

const MEDIA_META: Record<MediaKind, { label: string; icon: LucideIcon; accept?: string; linkHint: string }> = {
    video: { label: "video", icon: Video, accept: "video/*", linkHint: "Paste a video link (YouTube, Vimeo, Loom or a .mp4 URL)…" },
    audio: { label: "audio", icon: Music, accept: "audio/*", linkHint: "Paste an audio link…" },
    file: { label: "file", icon: FileIcon, linkHint: "Paste a file link…" },
    embed: { label: "embed", icon: Globe, linkHint: "Paste a link to embed (Figma, Google Maps, any https page)…" },
    bookmark: { label: "bookmark", icon: ExternalLink, linkHint: "Paste a link to bookmark…" },
};

/** Players that cannot be a plain <video>; everything else plays natively. */
function providerEmbed(url: string): string | null {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, "");
        if (host === "youtube.com" || host === "m.youtube.com") {
            const id = u.searchParams.get("v") ?? /^\/(?:shorts|embed|live)\/([\w-]+)/.exec(u.pathname)?.[1];
            return id ? `https://www.youtube.com/embed/${id}` : null;
        }
        if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
        if (host === "vimeo.com") { const id = /^\/(\d+)/.exec(u.pathname)?.[1]; return id ? `https://player.vimeo.com/video/${id}` : null; }
        if (host === "loom.com") { const id = /^\/share\/(\w+)/.exec(u.pathname)?.[1]; return id ? `https://www.loom.com/embed/${id}` : null; }
        if (host === "figma.com") return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
    } catch { /* not a URL */ }
    return null;
}

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
const asUrl = (raw: string) => { const t = raw.trim(); return /^https?:\/\//i.test(t) ? t : `https://${t}`; };

export function MediaView({ node, updateAttributes, selected }: ReactNodeViewProps) {
    const env = useEditorEnv();
    const kind = node.attrs.kind as MediaKind;
    const meta = MEDIA_META[kind] ?? MEDIA_META.file;
    const src = node.attrs.src as string;
    const name = (node.attrs.name as string) || src;
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [link, setLink] = useState("");

    useEffect(() => {
        if (!src) return;
        let alive = true;
        setFailed(false);
        env.resolveAttachment(src).then((u) => { if (alive) { setUrl(u); setFailed(!u); } }).catch(() => alive && setFailed(true));
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);

    const upload = () => {
        const input = document.createElement("input");
        input.type = "file";
        if (meta.accept) input.accept = meta.accept;
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file || !env.uploadFile) return;
            setBusy(true);
            const uploaded = await env.uploadFile(file).catch(() => null);
            setBusy(false);
            if (uploaded) updateAttributes({ src: uploaded, name: file.name });
        };
        input.click();
    };
    const embedLink = () => {
        if (!link.trim()) return;
        const u = asUrl(link);
        updateAttributes({ src: u, name: kind === "bookmark" || kind === "embed" ? hostOf(u) : decodeURIComponent(u.split("/").pop()?.split("?")[0] || hostOf(u)) });
    };

    // ---- Empty: Notion's "Upload / Embed link" placeholder -------------------------------------------------------------
    if (!src) {
        const uploadable = !!env.uploadFile && kind !== "embed" && kind !== "bookmark";
        return (
            <NodeViewWrapper className="my-1" data-drag-handle>
                <div contentEditable={false} className={cn("flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-secondary/50 p-3", selected && "ring-2 ring-ring")}>
                    <meta.icon className="size-5 flex-none text-muted-foreground" aria-hidden />
                    {env.editable ? (
                        <>
                            {uploadable && (
                                <Button type="button" variant="outline" size="sm" onClick={upload} disabled={busy}>
                                    {busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload {meta.label}
                                </Button>
                            )}
                            <form className="flex min-w-[14rem] flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); embedLink(); }}>
                                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder={meta.linkHint} aria-label={`${meta.label} link`} className="h-8 text-[13px]" />
                                <Button type="submit" size="sm" disabled={!link.trim()}>Embed</Button>
                            </form>
                        </>
                    ) : <span className="text-[13px] text-muted-foreground">Empty {meta.label}</span>}
                </div>
            </NodeViewWrapper>
        );
    }

    // ---- Filled ---------------------------------------------------------------------------------------------------------
    const frame = "overflow-hidden rounded-md border border-border";
    let body: React.ReactNode;
    if (failed) {
        body = <div className="flex h-20 items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary text-[13px] text-muted-foreground"><meta.icon className="size-4" /> {meta.label[0].toUpperCase() + meta.label.slice(1)} unavailable</div>;
    } else if (!url) {
        body = <div className="h-24 w-full animate-pulse rounded-md bg-secondary" />;
    } else if (kind === "video") {
        const embed = /^https?:/.test(src) ? providerEmbed(src) : null;
        body = embed
            ? <iframe src={embed} title={name} className={cn(frame, "aspect-video w-full")} allow="fullscreen; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
            : <video src={url} controls preload="metadata" className={cn(frame, "max-h-[560px] w-full bg-black")} />;
    } else if (kind === "audio") {
        body = <audio src={url} controls preload="metadata" className="w-full" />;
    } else if (kind === "embed") {
        body = <iframe src={providerEmbed(src) ?? src} title={name} className={cn(frame, "h-[420px] w-full bg-background")} loading="lazy" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms" />;
    } else if (kind === "bookmark") {
        body = (
            <a href={src} target="_blank" rel="noreferrer noopener" className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 no-underline hover:bg-accent">
                <Globe className="size-5 flex-none text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium text-foreground">{name}</span><span className="block truncate text-[12px] text-muted-foreground">{src}</span></span>
                <ExternalLink className="size-4 flex-none text-muted-foreground" aria-hidden />
            </a>
        );
    } else {
        body = (
            <a href={url} target="_blank" rel="noreferrer noopener" download={name} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 no-underline hover:bg-accent">
                <FileIcon className="size-5 flex-none text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">{name}</span>
            </a>
        );
    }
    return (
        <NodeViewWrapper className={cn("my-1 rounded-md", selected && "ring-2 ring-ring")} data-drag-handle>
            <div contentEditable={false}>{body}</div>
        </NodeViewWrapper>
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// Table of contents
// ---------------------------------------------------------------------------------------------------------------------

const headingsOf = (editor: Editor) => {
    const out: { level: number; text: string; pos: number }[] = [];
    editor.state.doc.descendants((n, pos) => { if (n.type.name === "heading" && n.textContent.trim()) out.push({ level: n.attrs.level as number, text: n.textContent, pos }); });
    return out;
};

export function TocView({ editor, selected }: ReactNodeViewProps) {
    const [items, setItems] = useState(() => headingsOf(editor));
    useEffect(() => {
        const refresh = () => setItems(headingsOf(editor));
        editor.on("update", refresh);
        return () => { editor.off("update", refresh); };
    }, [editor]);
    return (
        <NodeViewWrapper className={cn("my-1 rounded-md", selected && "ring-2 ring-ring")} data-drag-handle>
            <nav contentEditable={false} aria-label="Table of contents" className="flex flex-col gap-0.5 py-1">
                {items.length === 0 && <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><ListTree className="size-4" /> Add headings to this page and they will be listed here.</p>}
                {items.map((h) => (
                    <button key={h.pos} type="button" onClick={() => editor.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run()}
                        style={{ paddingLeft: `${(h.level - 1) * 16}px` }} className="w-fit max-w-full truncate text-left text-[13.5px] text-muted-foreground underline decoration-border underline-offset-[3px] hover:text-foreground">
                        {h.text}
                    </button>
                ))}
            </nav>
        </NodeViewWrapper>
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// Date chip
// ---------------------------------------------------------------------------------------------------------------------

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };

export function DateChipView({ node, updateAttributes, selected }: ReactNodeViewProps) {
    const env = useEditorEnv();
    const date = node.attrs.date as string;
    const chip = (
        <span contentEditable={false} className={cn("mx-px inline-flex items-center gap-1 rounded px-1 text-muted-foreground", env.editable && "cursor-pointer hover:bg-accent", selected && "bg-accent ring-1 ring-ring")}>
            <CalendarDays className="size-3.5" aria-hidden /> {date ? formatChipDate(date) : "Pick a date"}
        </span>
    );
    return (
        <NodeViewWrapper as="span" className="inline">
            {env.editable ? (
                <Popover>
                    <PopoverTrigger asChild><button type="button" className="inline" aria-label="Change date">{chip}</button></PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-2">
                        <Calendar mode="single" selected={date ? fromIso(date) : undefined} defaultMonth={date ? fromIso(date) : undefined} onSelect={(d) => d && updateAttributes({ date: toIso(d) })} />
                    </PopoverContent>
                </Popover>
            ) : chip}
        </NodeViewWrapper>
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// Equations (inline node + KaTeX preview for ```math blocks)
// ---------------------------------------------------------------------------------------------------------------------

const renderTex = (latex: string, displayMode: boolean) => katex.renderToString(latex, { displayMode, throwOnError: false, output: "html" });

export function InlineMathView({ node, updateAttributes, selected }: ReactNodeViewProps) {
    const env = useEditorEnv();
    const latex = node.attrs.latex as string;
    const [open, setOpen] = useState(env.editable && !latex);
    const shown = latex ? (
        <span dangerouslySetInnerHTML={{ __html: renderTex(latex, false) }} />
    ) : <span className="inline-flex items-center gap-1 text-muted-foreground"><Sigma className="size-3.5" aria-hidden /> Equation</span>;
    const chip = <span contentEditable={false} className={cn("mx-px rounded px-0.5", env.editable && "cursor-pointer hover:bg-accent", selected && "bg-accent ring-1 ring-ring")}>{shown}</span>;
    return (
        <NodeViewWrapper as="span" className="inline">
            {env.editable ? (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild><button type="button" className="inline" aria-label="Edit equation">{chip}</button></PopoverTrigger>
                    <PopoverContent align="start" className="w-80 space-y-2 p-2">
                        <Input autoFocus value={latex} onChange={(e) => updateAttributes({ latex: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); setOpen(false); } }} placeholder="E = mc^2" aria-label="LaTeX" className="font-mono text-[13px]" />
                        {latex && <div className="overflow-x-auto rounded-md bg-secondary px-2 py-1.5" dangerouslySetInnerHTML={{ __html: renderTex(latex, false) }} />}
                    </PopoverContent>
                </Popover>
            ) : chip}
        </NodeViewWrapper>
    );
}

// ---------------------------------------------------------------------------------------------------------------------
// Code block: language picker + live previews for Mermaid diagrams and block equations
// ---------------------------------------------------------------------------------------------------------------------

function MermaidPreview({ code }: { code: string }) {
    const { resolved } = useTheme();
    const uid = `mmd${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
    const [svg, setSvg] = useState("");
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!code.trim()) { setSvg(""); setError(null); return; }
        let alive = true;
        const timer = setTimeout(async () => {
            try {
                const { default: mermaid } = await import("mermaid");
                mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: resolved === "dark" ? "dark" : "default" });
                const out = await mermaid.render(uid, code);
                if (alive) { setSvg(out.svg); setError(null); }
            } catch (e) {
                document.getElementById(`d${uid}`)?.remove();
                if (alive) setError(e instanceof Error ? e.message.split("\n")[0] : "Invalid diagram");
            }
        }, 400);
        return () => { alive = false; clearTimeout(timer); };
    }, [code, resolved, uid]);
    if (error) return <p className="border-t border-border px-3 py-2 text-[12.5px] text-danger">{error}</p>;
    if (!svg) return null;
    return <div contentEditable={false} className="flex justify-center overflow-x-auto border-t border-border bg-background p-3 [&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
    const env = useEditorEnv();
    const lang = (node.attrs.language as string | null) ?? "";
    const known = CODE_LANGUAGES.find((l) => l.value === lang);
    const code = node.textContent;
    return (
        <NodeViewWrapper className="notion-code my-1 overflow-hidden rounded-md border border-border bg-secondary">
            <div contentEditable={false} className="flex items-center px-1.5 pt-1">
                {env.editable ? (
                    <Select value={lang || "plain"} onValueChange={(v) => updateAttributes({ language: v === "plain" ? null : v })}>
                        <SelectTrigger aria-label="Code language" className="h-6 w-auto gap-1 border-0 bg-transparent px-1.5 text-[12px] text-muted-foreground shadow-none hover:bg-accent focus:ring-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {CODE_LANGUAGES.map((l) => <SelectItem key={l.value || "plain"} value={l.value || "plain"}>{l.label}</SelectItem>)}
                            {lang && !known && <SelectItem value={lang}>{lang}</SelectItem>}
                        </SelectContent>
                    </Select>
                ) : <span className="px-1.5 text-[12px] text-muted-foreground">{known?.label ?? (lang || "Plain text")}</span>}
            </div>
            <pre><NodeViewContent className="font-mono text-[0.85em]" /></pre>
            {lang === "mermaid" && <MermaidPreview code={code} />}
            {lang === "math" && code.trim() && <div contentEditable={false} className="overflow-x-auto border-t border-border bg-background px-3 py-2" dangerouslySetInnerHTML={{ __html: renderTex(code, true) }} />}
        </NodeViewWrapper>
    );
}
