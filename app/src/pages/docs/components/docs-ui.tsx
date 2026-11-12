import { useEffect, useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Check, ChevronRight, ChevronsUpDown, FileText, FolderTree, Plus } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { personName } from "@/lib/format";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ListSkeleton } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { getApiErrorMessage } from "@/lib/api-error";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CustomFormStatusOptions, FormSubmissionStatusOptions, WikiChecklistItemStatusOptions, WikiChecklistRunStatusOptions, WikiPageStatusOptions, WikiSpaceKindFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useCreateSpace, useDocsDirectory, useSpace, useSpaceTree, useUpdateSpace } from "@/features/docs/hooks/use-docs";
import type { WikiSpace, WikiTreeNode } from "@/features/docs/interfaces/docs.interfaces";

const TONE: Record<string, BadgeVariant> = {
    DRAFT: "warning", PUBLISHED: "success", NEEDS_REVIEW: "violet", ARCHIVED: "neutral", CLOSED: "neutral",
    NOT_STARTED: "neutral", IN_PROGRESS: "info", COMPLETED: "success", CANCELLED: "neutral", PENDING: "neutral", SKIPPED: "neutral",
    SUBMITTED: "info", UNDER_REVIEW: "violet", REVIEWED: "success", REJECTED: "danger", OVERDUE: "danger",
};
const LABELS = [...WikiPageStatusOptions, ...CustomFormStatusOptions, ...WikiChecklistRunStatusOptions, ...WikiChecklistItemStatusOptions, ...FormSubmissionStatusOptions];

export function DocsStatusBadge({ status }: { status: string | null | undefined }) {
    if (!status) return null;
    return <Badge variant={TONE[status] ?? "neutral"} dot>{getDropdownOptionLabel(LABELS, status)}</Badge>;
}

/** Emoji / icon of a page or space, falling back to a document glyph. */
export function DocIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
    if (icon) return <span className={cn("inline-grid size-5 shrink-0 place-items-center text-base leading-none", className)} aria-hidden>{icon}</span>;
    return <FileText className={cn("size-4 shrink-0 text-muted-foreground", className)} aria-hidden />;
}

interface TreeItem extends WikiTreeNode { children: TreeItem[] }

function buildTree(nodes: WikiTreeNode[]): TreeItem[] {
    const map = new Map<string, TreeItem>(nodes.map((n) => [n.id, { ...n, children: [] }]));
    const roots: TreeItem[] = [];
    map.forEach((n) => {
        const parent = n.parent_page_id ? map.get(n.parent_page_id) : null;
        if (parent) parent.children.push(n);
        else roots.push(n);
    });
    const sort = (list: TreeItem[]) => { list.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)); list.forEach((c) => sort(c.children)); };
    sort(roots);
    return roots;
}

function TreeNode({ node, activeId, ancestors, depth, onNavigate }: { node: TreeItem; activeId?: string; ancestors: Set<string>; depth: number; onNavigate?: () => void }) {
    const [open, setOpen] = useState(ancestors.has(node.id) || node.id === activeId);
    useEffect(() => { if (ancestors.has(node.id)) setOpen(true); }, [ancestors, node.id]);
    return (
        <li>
            <div className={cn("group flex items-center rounded-md pr-1 text-[13px]", node.id === activeId ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")} style={{ paddingLeft: depth * 12 }}>
                <button type="button" className={cn("grid size-6 shrink-0 place-items-center", !node.children.length && "invisible")} onClick={() => setOpen((o) => !o)} aria-label={open ? `Collapse ${node.title}` : `Expand ${node.title}`}>
                    <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
                </button>
                <NavLink to={`/docs/pages/${node.id}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-1.5 py-1">
                    <DocIcon icon={node.icon} className="size-4 text-sm" />
                    <span className="truncate">{node.title}</span>
                    {node.status === "DRAFT" && <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-label="Draft" />}
                </NavLink>
            </div>
            {open && node.children.length > 0 && (
                <ul>{node.children.map((c) => <TreeNode key={c.id} node={c} activeId={activeId} ancestors={ancestors} depth={depth + 1} onNavigate={onNavigate} />)}</ul>
            )}
        </li>
    );
}

/** Page tree of one space. */
export function SpaceTree({ spaceId, activeId, ancestorIds = [], onNavigate, canCreate }: { spaceId: string; activeId?: string; ancestorIds?: string[]; onNavigate?: () => void; canCreate?: boolean }) {
    const space = useSpace(spaceId);
    const tree = useSpaceTree(spaceId);
    const roots = useMemo(() => buildTree(tree.data ?? []), [tree.data]);
    const ancestors = useMemo(() => new Set(ancestorIds), [ancestorIds]);
    return (
        <nav aria-label="Pages" className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
                {space.data ? (
                    <Link to={`/docs/spaces/${spaceId}`} onClick={onNavigate} className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-foreground hover:underline">
                        <DocIcon icon={space.data.icon} />
                        <span className="truncate">{space.data.name}</span>
                    </Link>
                ) : <Skeleton className="h-5 w-32" />}
                {canCreate && (
                    <Button variant="ghost" size="icon-sm" asChild aria-label="New page">
                        <Link to={`/docs/pages/new?space=${spaceId}`} onClick={onNavigate}><Plus /></Link>
                    </Button>
                )}
            </div>
            {tree.isPending ? <ListSkeleton rows={5} className="p-0" /> : tree.error ? <p className="px-1 text-xs text-danger">{getApiErrorMessage(tree.error)}</p> : roots.length ? (
                <ul>{roots.map((n) => <TreeNode key={n.id} node={n} activeId={activeId} ancestors={ancestors} depth={0} onNavigate={onNavigate} />)}</ul>
            ) : <p className="px-1 text-xs text-muted-foreground">No pages yet.</p>}
        </nav>
    );
}

/** Two-column layout: tree on the left (lg+), in a sheet on smaller screens. */
export function SpaceLayout({ spaceId, activeId, ancestorIds, canCreate, children }: { spaceId: string; activeId?: string; ancestorIds?: string[]; canCreate?: boolean; children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden border-r border-border px-3 py-5 lg:block">
                <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto"><SpaceTree spaceId={spaceId} activeId={activeId} ancestorIds={ancestorIds} canCreate={canCreate} /></div>
            </aside>
            <div className="min-w-0">
                <div className="px-4 pt-4 lg:hidden">
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild><Button variant="outline" size="sm"><FolderTree /> Pages</Button></SheetTrigger>
                        <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto">
                            <SheetHeader><SheetTitle>Pages</SheetTitle></SheetHeader>
                            <div className="mt-4"><SpaceTree spaceId={spaceId} activeId={activeId} ancestorIds={ancestorIds} canCreate={canCreate} onNavigate={() => setOpen(false)} /></div>
                        </SheetContent>
                    </Sheet>
                </div>
                {children}
            </div>
        </div>
    );
}

const spaceSchema = z.object({
    name: z.string().trim().min(1, "Required").max(120),
    icon: z.string().max(8).optional(),
    description: z.string().max(2000).optional(),
    kind: z.enum(["DEPARTMENT", "TEAM", "BRANCH", "PROJECT", "TOPIC"]),
    is_private: z.boolean(),
    require_review_before_publish: z.boolean(),
});
type SpaceValues = z.infer<typeof spaceSchema>;

/** New space: explicit "Create space". Edit: valid changes autosave (optimistic, <SaveStatus />); "Done" closes. */
export function SpaceFormDialog({ open, onOpenChange, space, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; space?: WikiSpace | null; onCreated?: (s: WikiSpace) => void }) {
    const create = useCreateSpace();
    const update = useUpdateSpace();
    const form = useForm<SpaceValues>({ resolver: zodResolver(spaceSchema), defaultValues: { name: "", icon: "", description: "", kind: "TOPIC", is_private: false, require_review_before_publish: false } });
    // Reset when the dialog opens or another space is opened — not when the (optimistically patched) space changes.
    const spaceId = space?.id ?? null;
    useEffect(() => {
        if (open) form.reset({ name: space?.name ?? "", icon: space?.icon ?? "", description: space?.description ?? "", kind: space?.kind ?? "TOPIC", is_private: space?.is_private ?? false, require_review_before_publish: space?.require_review_before_publish ?? false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, spaceId, form]);
    const pending = create.isPending;
    const toDto = (v: SpaceValues) => ({ ...v, icon: v.icon || undefined, description: v.description || undefined });
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: spaceId as string, ...toDto(v) }), { enabled: open && !!spaceId });
    const submit = form.handleSubmit((v) => {
        if (space) { autosave.flush(); onOpenChange(false); return; }
        create.mutate(toDto(v), { onSuccess: (s) => { onOpenChange(false); onCreated?.(s); } });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{space ? "Edit space" : "New space"}</DialogTitle>
                            <DialogDescription>Spaces group pages by department, team or topic.{space ? " Changes save automatically." : ""}</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-[72px_1fr] gap-3">
                            <FormField control={form.control} name="icon" render={({ field }) => (<FormItem><FormLabel>Icon</FormLabel><FormControl><Input placeholder="📘" maxLength={8} {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus placeholder="Engineering handbook" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField
                            control={form.control}
                            name="kind"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kind</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{WikiSpaceKindFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="is_private" render={({ field }) => (<FormItem className="flex items-center justify-between gap-4"><div><FormLabel>Private</FormLabel><FormDescription>Only space members can see its pages.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="require_review_before_publish" render={({ field }) => (<FormItem className="flex items-center justify-between gap-4"><div><FormLabel>Review before publishing</FormLabel><FormDescription>Pages go to “Needs review” before they are published.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        {space ? (
                            <DialogFooter className="items-center sm:justify-between">
                                <SaveStatus state={autosave} />
                                <Button type="submit" variant="outline">Done</Button>
                            </DialogFooter>
                        ) : (
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                                <Button type="submit" loading={pending}>Create space</Button>
                            </DialogFooter>
                        )}
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Member picker backed by the docs directory endpoint (no admin permission needed). */
export function DocsMemberPicker({ value, onChange, disabled, placeholder = "Choose a member" }: { value: string | undefined; onChange: (id: string | undefined) => void; disabled?: boolean; placeholder?: string }) {
    const [open, setOpen] = useState(false);
    const directory = useDocsDirectory(open || !!value);
    const members = directory.data?.members ?? [];
    const selected = members.find((m) => m.id === value);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal">
                    <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? personName(selected.user) : value ? "Selected member" : placeholder}</span>
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search members…" />
                    <CommandList>
                        <CommandEmpty>{directory.isError ? "Members could not be loaded" : directory.isPending ? "Loading…" : "No member found"}</CommandEmpty>
                        <CommandGroup>
                            {members.map((m) => (
                                <CommandItem key={m.id} value={`${personName(m.user)} ${m.user.email}`} onSelect={() => { onChange(m.id === value ? undefined : m.id); setOpen(false); }}>
                                    <Check className={cn("size-4", m.id === value ? "opacity-100" : "opacity-0")} />
                                    <div className="min-w-0"><div className="truncate text-[13px]">{personName(m.user)}</div><div className="truncate text-xs text-muted-foreground">{m.user.email}</div></div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
