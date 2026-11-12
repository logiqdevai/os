import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, MoreHorizontal, Pencil, Plus, ShieldCheck } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DocumentScopeOptions, RetentionActionOptions, RetentionAnchorOptions } from "@/config/constants/dropdowns/files/files.options";
import { useArchiveRetentionPolicy, useCreateRetentionPolicy, useFileCategories, useRetentionPolicies, useUpdateRetentionPolicy } from "@/features/files/hooks/use-files";
import type { DocumentScopeKind, RetentionAction, RetentionAnchor, RetentionPolicy } from "@/features/files/interfaces/files.interfaces";
import { retentionPolicySchema, type RetentionPolicyFormValues } from "@/features/files/validation-schemas/retention.schema";

const ANY = "__any";

/** "7 years", "90 days" … for the table. */
const describeDays = (d: number | null) => (d === null ? "Keep forever" : d % 365 === 0 ? `${d / 365} year${d === 365 ? "" : "s"}` : d % 30 === 0 ? `${d / 30} month${d === 30 ? "" : "s"}` : `${d} days`);

/**
 * /files/retention — retention policies (17 §13): how long documents of a category / scope are kept and what happens
 * after. Legal hold always wins; permanent deletion still needs a second person.
 * @perm VIEW + ACTION documents.retention.manage (sensitive) @api GET/POST /files/retention/policies · PATCH /:id · POST /:id/archive
 * @audit documents.retention_policy_created|updated|archived @states loading · empty · error/403 · module-enforced (read-only)
 */
export default function RetentionPage() {
    const policies = useRetentionPolicies();
    const archive = useArchiveRetentionPolicy();
    const [editing, setEditing] = useState<RetentionPolicy | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [archiving, setArchiving] = useState<RetentionPolicy | null>(null);
    const openNew = () => { setEditing(null); setFormOpen(true); };

    const columns: DataTableColumn<RetentionPolicy>[] = [
        {
            key: "name",
            header: "Policy",
            cell: (p) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="truncate font-medium text-foreground">{p.name}</span>{!p.is_active && <Badge variant="neutral">Paused</Badge>}{p.enforced_by_module && <Badge variant="info">Required by {p.enforced_by_module.toLowerCase()}</Badge>}</div>
                    {p.description && <div className="truncate text-xs text-muted-foreground">{p.description}</div>}
                </div>
            ),
        },
        { key: "applies", header: "Applies to", cell: (p) => <span className="text-[13px]">{p.category?.name ?? "Any category"}{p.scope ? ` · ${getDropdownOptionLabel(DocumentScopeOptions, p.scope)}` : ""}</span>, hideBelow: "md" },
        { key: "keep", header: "Keep", cell: (p) => <span className="text-[13px]">{describeDays(p.retain_days)}</span> },
        { key: "then", header: "Then", cell: (p) => <Badge variant={p.action === "PERMANENT_DELETE" ? "danger" : p.action === "SOFT_DELETE" ? "warning" : "neutral"}>{getDropdownOptionLabel(RetentionActionOptions, p.action)}</Badge>, hideBelow: "sm" },
        { key: "docs", header: "Documents", cell: (p) => <span className="tabular">{p._count.documents}</span>, className: "text-right", headerClassName: "text-right", hideBelow: "lg" },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-10",
            cell: (p) =>
                !p.enforced_by_module && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => { setEditing(p); setFormOpen(true); }}><Pencil /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setArchiving(p)}><Archive /> Archive</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
        },
    ];

    return (
        <Page>
            <PageHeader
                title="Retention policies"
                description="How long documents are kept and what happens afterwards. Documents on legal hold are never archived or deleted by a policy."
                actions={<Button onClick={openNew}><Plus /> New policy</Button>}
            />
            <DataTable
                columns={columns}
                data={policies.data}
                rowKey={(p) => p.id}
                loading={policies.isFetching}
                error={policies.error}
                onRetry={() => policies.refetch()}
                onRowClick={(p) => { if (!p.enforced_by_module) { setEditing(p); setFormOpen(true); } }}
                empty={{ icon: ShieldCheck, title: "No retention policies", description: "Without a policy, documents are kept until someone deletes them.", action: <Button size="sm" onClick={openNew}><Plus /> New policy</Button> }}
            />
            <RetentionPolicyDialog open={formOpen} onOpenChange={setFormOpen} policy={editing} />
            <ConfirmationDialog
                isOpen={!!archiving}
                onClose={() => setArchiving(null)}
                title={`Archive ${archiving?.name}?`}
                description="The policy stops applying. Documents it already archived or trashed stay where they are."
                confirmText="Archive"
                variant="destructive"
                isLoading={archive.isPending}
                onConfirm={() => archiving && archive.mutate(archiving.id, {
                    onSuccess: () => { toast({ title: "Policy archived" }); setArchiving(null); },
                    onError: (e) => toast({ variant: "destructive", title: "Could not archive", description: getApiErrorMessage(e) }),
                })}
            />
        </Page>
    );
}

const empty: RetentionPolicyFormValues = { name: "", description: "", category_id: ANY, scope: ANY, keep_forever: false, retain_days: "2555", anchor: "CREATED", action: "ARCHIVE", is_active: true };

function RetentionPolicyDialog({ open, onOpenChange, policy }: { open: boolean; onOpenChange: (o: boolean) => void; policy: RetentionPolicy | null }) {
    const create = useCreateRetentionPolicy();
    const update = useUpdateRetentionPolicy();
    const categories = useFileCategories(open);
    const pending = create.isPending || update.isPending;
    const form = useForm<RetentionPolicyFormValues>({ resolver: zodResolver(retentionPolicySchema), defaultValues: empty });

    useEffect(() => {
        if (!open) return;
        form.reset(policy ? {
            name: policy.name, description: policy.description ?? "", category_id: policy.category_id ?? ANY, scope: policy.scope ?? ANY,
            keep_forever: policy.retain_days === null, retain_days: policy.retain_days ? String(policy.retain_days) : "", anchor: policy.anchor, action: policy.action, is_active: policy.is_active,
        } : empty);
    }, [open, policy, form]);

    const submit = form.handleSubmit((v) => {
        const dto = {
            name: v.name,
            description: v.description || undefined,
            category_id: v.category_id === ANY ? null : v.category_id,
            scope: v.scope === ANY ? null : (v.scope as DocumentScopeKind),
            retain_days: v.keep_forever ? null : Number(v.retain_days),
            anchor: v.anchor as RetentionAnchor,
            action: v.action as RetentionAction,
            is_active: v.is_active,
        };
        const cb = {
            onSuccess: () => { toast({ title: policy ? "Policy updated" : "Policy created" }); onOpenChange(false); },
            onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Could not save the policy", description: getApiErrorMessage(e) }),
        };
        if (policy) update.mutate({ id: policy.id, ...dto }, cb);
        else create.mutate(dto, cb);
    });
    const keepForever = form.watch("keep_forever");

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{policy ? "Edit retention policy" : "New retention policy"}</DialogTitle>
                            <DialogDescription>Applies to new and existing documents that match the category and scope.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Invoices — 7 years" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="category_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={ANY}>Any category</SelectItem>
                                            {categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="scope" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Scope</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Scope"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={ANY}>Any scope</SelectItem>
                                            {DocumentScopeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="keep_forever" render={({ field }) => (
                            <FormItem className="flex items-start justify-between gap-4">
                                <div><FormLabel>Keep forever</FormLabel><FormDescription>Only legal hold rules apply.</FormDescription></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Keep forever" /></FormControl>
                            </FormItem>
                        )} />
                        {!keepForever && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="retain_days" render={({ field }) => (<FormItem><FormLabel>Keep for (days)</FormLabel><FormControl><Input inputMode="numeric" {...field} /></FormControl><FormDescription>{describeDays(Number(field.value) || null)}</FormDescription><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="anchor" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Counted from</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Counted from"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{RetentionAnchorOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="action" render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>Then</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger aria-label="Then"><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{RetentionActionOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                        {field.value === "PERMANENT_DELETE" && <FormDescription>Each permanent deletion still needs a request and approval by a second person.</FormDescription>}
                                    </FormItem>
                                )} />
                            </div>
                        )}
                        <FormField control={form.control} name="is_active" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-4"><FormLabel>Active</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Active" /></FormControl></FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{policy ? "Save" : "Create policy"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
