import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Archive, LayoutTemplate, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, TableToolbar, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useListParams } from "@/hooks/use-list-params";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { WikiPageTypeFormOptions } from "@/config/constants/dropdowns/docs/docs.options";
import { useArchiveDocTemplate, useCreateDocTemplate, useDocTemplates, useUpdateDocTemplate } from "@/features/docs/hooks/use-docs";
import type { WikiPageType, WikiTemplate } from "@/features/docs/interfaces/docs.interfaces";
import { DocIcon } from "../../components/docs-ui";

/**
 * /docs/templates — page templates (15 §3)
 * @perm VIEW docs.pages.read · manage docs.spaces.manage
 * @api GET/POST /docs/templates · PATCH /docs/templates/:id · POST /docs/templates/:id/archive
 */
export default function DocTemplatesPage() {
    const { params, setPage, search, setSearch } = useListParams();
    const templates = useDocTemplates(params);
    const canManage = usePermission("docs.spaces.manage");
    const archive = useArchiveDocTemplate();
    const [editing, setEditing] = useState<WikiTemplate | null>(null);
    const [open, setOpen] = useState(false);
    const [archiving, setArchiving] = useState<WikiTemplate | null>(null);

    const columns: DataTableColumn<WikiTemplate>[] = [
        { key: "name", header: "Template", cell: (t) => <div className="flex min-w-0 items-center gap-2"><DocIcon icon={t.icon} /><div className="min-w-0"><div className="truncate font-medium text-foreground">{t.name}</div>{t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}</div></div> },
        { key: "type", header: "Type", cell: (t) => <Badge variant="outline">{getDropdownOptionLabel(WikiPageTypeFormOptions, t.page_type)}</Badge>, hideBelow: "sm" },
        { key: "used", header: "Pages", cell: (t) => <span className="tabular">{t._count?.pages ?? 0}</span>, hideBelow: "md" },
        { key: "scope", header: "Scope", cell: (t) => (t.is_system ? <Badge variant="info">Built-in</Badge> : t.space?.name ?? "All spaces"), hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (t) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link to={`/docs/pages/new?template=${t.id}`}><Plus /> New page from template</Link></DropdownMenuItem>
                        {canManage && !t.is_system && <DropdownMenuItem onSelect={() => { setEditing(t); setOpen(true); }}><Pencil /> Edit</DropdownMenuItem>}
                        {canManage && !t.is_system && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(t)}><Archive /> Archive</DropdownMenuItem>}
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <Page>
            <PageHeader title="Templates" description="Start pages with a structure: policies, runbooks, meeting notes, decision records." actions={canManage && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus /> New template</Button>} />
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search templates…" />
            <DataTable
                columns={columns}
                data={templates.data?.data}
                rowKey={(t) => t.id}
                loading={templates.isFetching}
                error={templates.error}
                onRetry={() => templates.refetch()}
                pagination={templates.data?.pagination}
                onPageChange={setPage}
                empty={{ icon: LayoutTemplate, title: "No templates", description: "Templates give new pages a consistent structure." }}
            />
            <TemplateDialog open={open} onOpenChange={setOpen} template={editing} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="Existing pages keep their content; the template is no longer offered."
                confirmText="Archive"
                variant="destructive"
                isLoading={archive.isPending}
                onConfirm={() => archiving && archive.mutate(archiving.id, { onSuccess: () => { toast({ title: "Template archived" }); setArchiving(null); }, onError: (e) => toast({ variant: "destructive", title: "Could not archive", description: getApiErrorMessage(e) }) })}
            />
        </Page>
    );
}

const schema = z.object({
    name: z.string().trim().min(1, "Required").max(120),
    icon: z.string().max(8).optional(),
    description: z.string().max(1000).optional(),
    page_type: z.string(),
    content_markdown: z.string().max(200_000),
});
type Values = z.infer<typeof schema>;

function TemplateDialog({ open, onOpenChange, template }: { open: boolean; onOpenChange: (o: boolean) => void; template: WikiTemplate | null }) {
    const create = useCreateDocTemplate();
    const update = useUpdateDocTemplate();
    const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", icon: "", description: "", page_type: "GENERAL", content_markdown: "" } });
    useEffect(() => {
        if (open) form.reset({ name: template?.name ?? "", icon: template?.icon ?? "", description: template?.description ?? "", page_type: template?.page_type ?? "GENERAL", content_markdown: template?.content_markdown ?? "" });
    }, [open, template, form]);
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        const dto = { ...v, page_type: v.page_type as WikiPageType, icon: v.icon || undefined, description: v.description || undefined };
        const onError = (e: unknown) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) });
        if (template) update.mutate({ id: template.id, ...dto }, { onSuccess: () => { toast({ title: "Template updated" }); onOpenChange(false); }, onError });
        else create.mutate(dto, { onSuccess: () => { toast({ title: "Template created" }); onOpenChange(false); }, onError });
    });
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader><DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle><DialogDescription>Markdown content copied into new pages.</DialogDescription></DialogHeader>
                        <div className="grid grid-cols-[72px_1fr] gap-3">
                            <FormField control={form.control} name="icon" render={({ field }) => (<FormItem><FormLabel>Icon</FormLabel><FormControl><Input maxLength={8} {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="page_type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Page type</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <FormControl><SelectTrigger aria-label="Page type"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{WikiPageTypeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="content_markdown" render={({ field }) => (<FormItem><FormLabel>Content</FormLabel><FormControl><Textarea rows={12} className="font-mono text-xs" placeholder={"## Purpose\n\n## Steps\n1. "} {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{template ? "Save" : "Create template"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
