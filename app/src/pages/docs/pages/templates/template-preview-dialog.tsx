import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Copy, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiPageTypeFormOptions, WikiTemplateCategoryFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useDuplicateDocTemplate, useSpaces } from "@/features/docs/hooks/use-docs";
import type { WikiTemplate } from "@/features/docs/interfaces/docs.interfaces";
import { DocIcon } from "../../components/docs-ui";
import { BlockEditor } from "../../components/editor/block-editor";
import { lastSpaceId } from "../page/new-page";
import { CATEGORY_ICONS, PREVIEW_ENV } from "./template-utils";

/**
 * Notion's template preview: the full page rendered read-only, with "Use template" (pick the space, then the page is
 * created from the template and opened). Managers can duplicate a built-in template into an editable one, or edit /
 * archive their organization's templates.
 * @perm use docs.pages.create · manage docs.spaces.manage  @api POST /docs/pages (template_id) · POST /docs/templates/:id/duplicate
 */
export function TemplatePreviewDialog({ template, onOpenChange, onEdit, onArchive }: {
    template: WikiTemplate | null;
    onOpenChange: (open: boolean) => void;
    onEdit: (t: WikiTemplate) => void;
    onArchive: (t: WikiTemplate) => void;
}) {
    const navigate = useNavigate();
    const canCreate = usePermission("docs.pages.create");
    const canManage = usePermission("docs.spaces.manage");
    const spaces = useSpaces({ limit: 100 });
    const duplicate = useDuplicateDocTemplate();
    const list = spaces.data?.data ?? [];
    const [picked, setPicked] = useState<string | null>(null);
    const spaceId = picked ?? list.find((s) => s.id === lastSpaceId())?.id ?? list[0]?.id ?? null;

    if (!template) return null;
    const CatIcon = CATEGORY_ICONS[template.category] ?? CATEGORY_ICONS.OTHER;
    const use = () => spaceId && navigate(`/docs/pages/new?space=${spaceId}&template=${template.id}`);
    const used = template._count?.pages ?? 0;

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl md:flex-row">
                {/* Page preview */}
                <div className="min-h-0 flex-1 overflow-y-auto bg-background px-6 py-8 md:px-12">
                    <div className="mx-auto max-w-2xl">
                        <DocIcon icon={template.icon} className="mb-3 size-10 text-foreground" />
                        <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground">{template.name}</h1>
                        <BlockEditor value={template.content_markdown ?? ""} onChange={() => undefined} env={PREVIEW_ENV} />
                    </div>
                </div>
                {/* Details + actions */}
                <aside className="flex w-full flex-none flex-col gap-4 border-t border-border bg-card p-5 md:w-80 md:border-l md:border-t-0">
                    <div className="space-y-1.5">
                        <DialogTitle className="text-lg">{template.name}</DialogTitle>
                        <DialogDescription>{template.description || "No description."}</DialogDescription>
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[13px]">
                        <dt className="text-muted-foreground">Category</dt>
                        <dd className="flex items-center gap-1.5 text-foreground"><CatIcon className="size-3.5 text-muted-foreground" aria-hidden />{getDropdownOptionLabel(WikiTemplateCategoryFormOptions, template.category)}</dd>
                        <dt className="text-muted-foreground">Page type</dt>
                        <dd className="text-foreground">{getDropdownOptionLabel(WikiPageTypeFormOptions, template.page_type)}</dd>
                        <dt className="text-muted-foreground">From</dt>
                        <dd>{template.is_system ? <Badge variant="neutral">Built-in</Badge> : <Badge variant="info">Your organization</Badge>}</dd>
                        <dt className="text-muted-foreground">Used</dt>
                        <dd className="tabular text-foreground">{used === 1 ? "1 page" : `${used} pages`}</dd>
                    </dl>

                    {canCreate && (
                        <div className="space-y-2 border-t border-border pt-4">
                            {list.length > 1 && (
                                <Select value={spaceId ?? undefined} onValueChange={setPicked}>
                                    <SelectTrigger aria-label="Space for the new page"><SelectValue placeholder="Choose a space" /></SelectTrigger>
                                    <SelectContent>{list.map((s) => <SelectItem key={s.id} value={s.id}><span className="flex items-center gap-2"><DocIcon icon={s.icon} />{s.name}</span></SelectItem>)}</SelectContent>
                                </Select>
                            )}
                            <Button className="w-full" onClick={use} disabled={!spaceId}><Plus /> Use template</Button>
                            {spaces.data && !list.length && <p className="text-[12px] text-muted-foreground">Create a space first: pages live in spaces.</p>}
                        </div>
                    )}

                    {canManage && (
                        <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
                            {template.is_system ? (
                                <Button variant="outline" size="sm" loading={duplicate.isPending} onClick={() => duplicate.mutate(template.id, { onSuccess: (copy) => onEdit(copy) })}><Copy /> Duplicate to edit</Button>
                            ) : (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => onEdit(template)}><Pencil /> Edit</Button>
                                    <Button variant="outline" size="sm" onClick={() => duplicate.mutate(template.id, { onSuccess: (copy) => onEdit(copy) })} loading={duplicate.isPending}><Copy /> Duplicate</Button>
                                    <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => onArchive(template)}><Archive /> Archive</Button>
                                </>
                            )}
                        </div>
                    )}
                </aside>
            </DialogContent>
        </Dialog>
    );
}
