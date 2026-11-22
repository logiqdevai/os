import { Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiTemplateCategoryFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import type { WikiTemplate } from "@/features/docs/interfaces/docs.interfaces";
import { cn } from "@/lib/utils";
import { DocIcon } from "../../components/docs-ui";
import { CATEGORY_ICONS, previewLines } from "./template-utils";

/** Notion gallery card: a miniature of the page on top, icon + name + description below. The whole card opens the preview. */
export function TemplateCard({ template, onOpen }: { template: WikiTemplate; onOpen: (t: WikiTemplate) => void }) {
    const lines = previewLines(template.content_markdown);
    const CatIcon = CATEGORY_ICONS[template.category] ?? CATEGORY_ICONS.OTHER;
    const used = template._count?.pages ?? 0;
    return (
        <button type="button" onClick={() => onOpen(template)} aria-label={`Preview template ${template.name}`}
            className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {/* Miniature page */}
            <div aria-hidden className="relative h-40 overflow-hidden border-b border-border bg-secondary/60 px-5 pt-4">
                <div className="origin-top-left space-y-1 rounded-t-md border border-b-0 border-border bg-background px-4 pt-3 shadow-sm transition-transform group-hover:-translate-y-0.5">
                    <div className="mb-1.5 flex items-center gap-1.5"><DocIcon icon={template.icon} className="size-3.5 text-foreground" /><span className="truncate text-[11px] font-semibold text-foreground">{template.name}</span></div>
                    {lines.map((l, i) => (
                        <div key={i} className={cn("flex items-center gap-1 truncate text-[9px] leading-snug text-muted-foreground",
                            l.kind === "h1" && "text-[11px] font-semibold text-foreground", l.kind === "h2" && "pt-0.5 text-[10px] font-semibold text-foreground", l.kind === "h3" && "font-semibold text-foreground",
                            l.kind === "quote" && "rounded-sm bg-secondary px-1")}>
                            {l.kind === "todo" && <Square className="size-2 flex-none" />}
                            {l.kind === "bullet" && <span className="flex-none">•</span>}
                            <span className="truncate">{l.text}</span>
                        </div>
                    ))}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-secondary/90 to-transparent" />
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3.5">
                <div className="flex min-w-0 items-center gap-2">
                    <DocIcon icon={template.icon} className="size-4 text-foreground" />
                    <span className="truncate text-[14px] font-semibold text-foreground">{template.name}</span>
                </div>
                {template.description && <p className="line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">{template.description}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-[11.5px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><CatIcon className="size-3" aria-hidden /> {getDropdownOptionLabel(WikiTemplateCategoryFormOptions, template.category)}</span>
                    {!template.is_system && <Badge variant="info" className="px-1.5 py-0 text-[10.5px]">Your organization</Badge>}
                    {used > 0 && <span className="ml-auto tabular">Used {used}×</span>}
                </div>
            </div>
        </button>
    );
}
