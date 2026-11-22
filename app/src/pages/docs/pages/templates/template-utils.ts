import {
    Briefcase, Building2, CalendarDays, Code, Cog, FolderKanban, Handshake, LayoutTemplate, Megaphone, Rocket, User, Users, type LucideIcon,
} from "lucide-react";
import type { WikiTemplate, WikiTemplateCategory } from "@/features/docs/interfaces/docs.interfaces";
import type { EditorEnv } from "../../components/editor/editor-env";

/** Gallery chip / section icon per category (labels live in WikiTemplateCategoryFormOptions). */
export const CATEGORY_ICONS: Record<WikiTemplateCategory, LucideIcon> = {
    COMPANY: Building2,
    PROJECTS: FolderKanban,
    MEETINGS: CalendarDays,
    ENGINEERING: Code,
    PRODUCT: Rocket,
    OPERATIONS: Cog,
    PEOPLE: Users,
    SALES: Handshake,
    MARKETING: Megaphone,
    PERSONAL: User,
    OTHER: LayoutTemplate,
};
export const SourceIcon = { system: LayoutTemplate, organization: Briefcase };

/** Read-only editor environment for previews: no uploads, no links, http(s) images only. */
export const PREVIEW_ENV: EditorEnv = {
    editable: false,
    resolveAttachment: async (src) => (/^https?:\/\//.test(src) ? src : null),
    openPage: () => undefined,
    searchMentions: async () => [],
};

export interface PreviewLine { kind: "h1" | "h2" | "h3" | "todo" | "bullet" | "text" | "quote"; text: string }

/** First lines of a template as plain text for the card thumbnail (HTML wrappers, fences and markers removed). */
export function previewLines(md: string | null, max = 9): PreviewLine[] {
    const out: PreviewLine[] = [];
    let inFence = false;
    for (const raw of (md ?? "").split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith("```")) { inFence = !inFence; continue; }
        if (inFence || !line || line === "[TOC]" || line === "---" || /^<\/?(div|details)\b[^>]*>$/i.test(line) || /^\|\s*-/.test(line) || /^>\s*\[!\w+\]$/.test(line)) continue;
        const text = line
            .replace(/<\/?summary>/g, "")
            .replace(/!\[[^\]]*]\([^)]*\)/g, "")
            .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
            .replace(/[*_`]/g, "")
            .replace(/^\|\s*|\s*\|$/g, "")
            .replace(/\s*\|\s*/g, " · ")
            .trim();
        let item: PreviewLine;
        if (/^#\s/.test(line)) item = { kind: "h1", text: text.replace(/^#+\s*/, "") };
        else if (/^##\s/.test(line)) item = { kind: "h2", text: text.replace(/^#+\s*/, "") };
        else if (/^#{3,}\s/.test(line)) item = { kind: "h3", text: text.replace(/^#+\s*/, "") };
        else if (/^- \[[ x]\]/.test(line)) item = { kind: "todo", text: text.replace(/^- \[[ x]\]\s*/, "") };
        else if (/^([-*]|\d+\.)\s/.test(line)) item = { kind: "bullet", text: text.replace(/^([-*]|\d+\.)\s*/, "") };
        else if (line.startsWith(">")) item = { kind: "quote", text: text.replace(/^>\s*/, "") };
        else item = { kind: "text", text };
        if (!item.text && item.kind !== "todo" && item.kind !== "bullet") continue;
        out.push(item);
        if (out.length >= max) break;
    }
    return out;
}

/** Gallery search: name, description and category label. */
export const matchesSearch = (t: WikiTemplate, q: string, categoryLabel: string) => {
    const s = q.trim().toLowerCase();
    return !s || t.name.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s) || categoryLabel.toLowerCase().includes(s);
};
