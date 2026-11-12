import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, FolderTree, MoreHorizontal, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { InlineText } from "@/components/ui/inline-edit";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CustomFieldEntityOptions, CustomFieldTypeOptions } from "@/config/constants/dropdowns/crm/custom-field.options";
import {
    useAllCustomFields, useArchiveCustomField, useCreateCustomField, useCreateCustomFieldGroup, useCustomFieldGroups, useDeleteCustomField,
    useDeleteCustomFieldGroup, useReorderCustomFields, useRestoreCustomField, useUpdateCustomField, useUpdateCustomFieldGroup,
} from "@/features/crm/custom-fields/hooks/use-custom-fields";
import type { CustomFieldDefinition, CustomFieldEntity, CustomFieldType } from "@/features/crm/custom-fields/interfaces/custom-fields.interfaces";
import { customFieldFormSchema, keyFromLabel, optionsToText, parseOptionsText, type CustomFieldFormValues } from "@/features/crm/custom-fields/validation-schemas/custom-fields.schema";

const NONE = "__none";
const OPTION_TYPES: CustomFieldType[] = ["DROPDOWN", "RADIO", "MULTI_SELECT"];
const NUMERIC_TYPES: CustomFieldType[] = ["NUMBER", "DECIMAL", "CURRENCY", "PERCENTAGE"];

/**
 * Custom fields (mockup `custom-fields`, 02 §24–26).
 * @route /crm/custom-fields?entity=CRM_COMPANY|CRM_CONTACT|CRM_LEAD|CRM_DEAL
 * @perm platform.custom_fields.manage (route gate; sensitive)
 * @api GET/POST/PATCH/DELETE /custom-fields · POST /custom-fields/:id/archive|restore · PUT /custom-fields/order · /custom-field-groups
 * @mcp platform_custom_fields_list|create|update|archive
 * @states loading · empty per entity · error · validation (key unique, snake_case, immutable)
 */
export default function CustomFieldsPage() {
    const [sp, setSp] = useSearchParams();
    const entity = (sp.get("entity") as CustomFieldEntity | null) ?? "CRM_COMPANY";
    const fields = useAllCustomFields();
    const reorder = useReorderCustomFields();
    const archive = useArchiveCustomField();
    const restore = useRestoreCustomField();
    const del = useDeleteCustomField();
    const [editing, setEditing] = useState<CustomFieldDefinition | null>(null);
    const [creating, setCreating] = useState(false);
    const [groupsOpen, setGroupsOpen] = useState(false);
    const [confirm, setConfirm] = useState<{ kind: "archive" | "delete"; field: CustomFieldDefinition } | null>(null);

    const rows = useMemo(() => (fields.data ?? []).filter((f) => f.entity_types.includes(entity)), [fields.data, entity]);
    const active = rows.filter((f) => !f.archived_at);
    const archived = rows.filter((f) => f.archived_at);

    const move = (i: number, dir: -1 | 1) => {
        const ids = active.map((r) => r.id);
        [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
        reorder.mutate(ids); // optimistic
    };

    return (
        <Page width="wide">
            <PageHeader
                title="Custom fields"
                description="Extra fields on companies, contacts, leads and deals. The key is the stable identifier for the API, imports and exports."
                actions={
                    <>
                        <Button variant="outline" onClick={() => setGroupsOpen(true)}><FolderTree /> <span className="hidden sm:inline">Groups</span></Button>
                        <Button onClick={() => setCreating(true)}><Plus /> New field</Button>
                    </>
                }
            />
            <Tabs value={entity} onValueChange={(t) => setSp({ entity: t }, { replace: true })} className="mb-3">
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <TabsList>{CustomFieldEntityOptions.map((o) => <TabsTrigger key={o.id} value={o.id}>{o.label}</TabsTrigger>)}</TabsList>
                </div>
            </Tabs>
            <div className="rounded-lg border border-border bg-card">
                {fields.isPending ? <ListSkeleton /> : fields.error ? <ErrorState error={fields.error} onRetry={() => fields.refetch()} /> : !active.length ? (
                    <EmptyState
                        compact
                        icon={SlidersHorizontal}
                        title={`No custom fields on ${getDropdownOptionLabel(CustomFieldEntityOptions, entity).toLowerCase()} yet`}
                        description="Add fields such as customer tier, region or contract end date."
                        action={<Button size="sm" onClick={() => setCreating(true)}><Plus /> New field</Button>}
                    />
                ) : (
                    <ul className="divide-y divide-border-soft">
                        {active.map((f, i) => (
                            <li key={f.id} className="flex items-center gap-2 px-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                                        <span className="font-medium text-foreground">{f.label}</span>
                                        <code className="rounded bg-muted px-1 text-[11px] text-muted-foreground">{f.key}</code>
                                        {f.is_required && <Badge variant="warning">Required</Badge>}
                                        {f.is_shared && <Badge variant="violet">Shared</Badge>}
                                    </div>
                                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                        {[getDropdownOptionLabel(CustomFieldTypeOptions, f.type), f.group?.name, f.is_shared ? f.entity_types.map((e) => getDropdownOptionLabel(CustomFieldEntityOptions, e)).join(", ") : null, `${f.usage_count} value${f.usage_count === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex" aria-label={`Move ${f.label} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                                <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex" aria-label={`Move ${f.label} down`} disabled={i === active.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${f.label}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => setEditing(f)}><Pencil /> Edit</DropdownMenuItem>
                                        <DropdownMenuItem className="sm:hidden" disabled={i === 0} onSelect={() => move(i, -1)}><ArrowUp /> Move up</DropdownMenuItem>
                                        <DropdownMenuItem className="sm:hidden" disabled={i === active.length - 1} onSelect={() => move(i, 1)}><ArrowDown /> Move down</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={() => setConfirm({ kind: "archive", field: f })}><Archive /> Archive</DropdownMenuItem>
                                        {f.usage_count === 0 && <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setConfirm({ kind: "delete", field: f })}><Trash2 /> Delete</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {!!archived.length && (
                <div className="mt-4">
                    <h3 className="mb-1 text-xs font-medium text-muted-foreground">Archived (values are kept)</h3>
                    <ul className="flex flex-wrap gap-2">
                        {archived.map((f) => (
                            <li key={f.id} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                                {f.label}
                                <Button variant="ghost" size="icon-sm" className="size-5" aria-label={`Restore ${f.label}`} onClick={() => restore.mutate(f.id)}><ArchiveRestore className="size-3" /></Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <FieldDialog open={creating || !!editing} field={editing} defaultEntity={entity} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }} />
            <GroupsDialog open={groupsOpen} onOpenChange={setGroupsOpen} />
            <ConfirmationDialog
                isOpen={confirm?.kind === "archive"}
                onClose={() => setConfirm(null)}
                title={`Archive ${confirm?.field.label}?`}
                description={`The field leaves forms, filters and exports. ${confirm?.field.usage_count ?? 0} stored value(s) are kept and come back if you restore it.`}
                confirmText="Archive"
                onConfirm={() => { if (confirm) archive.mutate(confirm.field.id); setConfirm(null); }}
            />
            <ConfirmationDialog
                isOpen={confirm?.kind === "delete"}
                onClose={() => setConfirm(null)}
                title={`Delete ${confirm?.field.label}?`}
                description="No record has a value for this field. Its key becomes free again."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (confirm) del.mutate(confirm.field.id); setConfirm(null); }}
            />
        </Page>
    );
}

function FieldDialog({ open, field, defaultEntity, onOpenChange }: { open: boolean; field: CustomFieldDefinition | null; defaultEntity: CustomFieldEntity; onOpenChange: (o: boolean) => void }) {
    const create = useCreateCustomField();
    const update = useUpdateCustomField();
    const groups = useCustomFieldGroups(open);
    const form = useForm<CustomFieldFormValues>({ resolver: zodResolver(customFieldFormSchema) });
    const [keyTouched, setKeyTouched] = useState(false);
    useEffect(() => {
        if (!open) return;
        setKeyTouched(!!field);
        form.reset({
            key: field?.key ?? "",
            label: field?.label ?? "",
            description: field?.description ?? "",
            type: field?.type ?? "TEXT",
            entity_types: field?.entity_types ?? [defaultEntity],
            group_id: field?.group_id ?? undefined,
            is_required: field?.is_required ?? false,
            options_text: optionsToText(field?.options),
            min: field?.validation?.min !== undefined ? String(field.validation.min) : "",
            max: field?.validation?.max !== undefined ? String(field.validation.max) : "",
        });
    }, [open, field, defaultEntity, form]);
    const type = form.watch("type") as CustomFieldType;
    const pending = create.isPending || update.isPending;
    const typeLocked = !!field && field.usage_count > 0;

    const submit = form.handleSubmit((v) => {
        const options = OPTION_TYPES.includes(type) ? parseOptionsText(v.options_text) : null;
        if (OPTION_TYPES.includes(type) && !options?.length) {
            form.setError("options_text", { message: "Add at least one option" });
            return;
        }
        const num = (s?: string) => (s && s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : undefined);
        const validation = NUMERIC_TYPES.includes(type) && (num(v.min) !== undefined || num(v.max) !== undefined) ? { min: num(v.min), max: num(v.max) } : null;
        const dto = {
            label: v.label,
            description: v.description || null,
            type,
            entity_types: v.entity_types as CustomFieldEntity[],
            group_id: v.group_id || null,
            is_required: v.is_required,
            options,
            validation,
        };
        // Complex multi-field definition: stays a dialog with Save; closes on success, failures toast globally.
        const opts = { onSuccess: () => onOpenChange(false) };
        if (field) update.mutate({ id: field.id, ...dto }, opts);
        else create.mutate({ key: v.key, ...dto }, opts);
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-3">
                        <DialogHeader>
                            <DialogTitle>{field ? `Edit ${field.label}` : "New custom field"}</DialogTitle>
                            <DialogDescription>Fields appear on the record forms and detail pages, in CSV export and import.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="label" render={({ field: f }) => (
                            <FormItem>
                                <FormLabel>Label</FormLabel>
                                <FormControl><Input autoFocus placeholder="Customer tier" {...f} onChange={(e) => { f.onChange(e); if (!keyTouched && !field) form.setValue("key", keyFromLabel(e.target.value)); }} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="key" render={({ field: f }) => (
                            <FormItem>
                                <FormLabel>Key</FormLabel>
                                <FormControl><Input className="font-mono" disabled={!!field} {...f} onChange={(e) => { setKeyTouched(true); f.onChange(e); }} /></FormControl>
                                <FormDescription>{field ? "The key cannot change." : "Used by the API, imports and exports. It cannot change later."}</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField control={form.control} name="type" render={({ field: f }) => (
                                <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select value={f.value} onValueChange={f.onChange} disabled={typeLocked}>
                                        <FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{CustomFieldTypeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    {typeLocked && <FormDescription>Locked: records already have values.</FormDescription>}
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="group_id" render={({ field: f }) => (
                                <FormItem>
                                    <FormLabel>Group</FormLabel>
                                    <Select value={f.value ?? NONE} onValueChange={(v) => f.onChange(v === NONE ? undefined : v)}>
                                        <FormControl><SelectTrigger aria-label="Group"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>No group</SelectItem>
                                            {groups.data?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        {OPTION_TYPES.includes(type) && (
                            <FormField control={form.control} name="options_text" render={({ field: f }) => (
                                <FormItem>
                                    <FormLabel>Options</FormLabel>
                                    <FormControl><Textarea rows={5} placeholder={"Enterprise\nMid-market\nsmb | Small business"} {...f} /></FormControl>
                                    <FormDescription>One per line. Use <code>value | Label</code> to set the stored value.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}
                        {NUMERIC_TYPES.includes(type) && (
                            <div className="grid grid-cols-2 gap-3">
                                <FormField control={form.control} name="min" render={({ field: f }) => (<FormItem><FormLabel>Minimum</FormLabel><FormControl><Input inputMode="decimal" {...f} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name="max" render={({ field: f }) => (<FormItem><FormLabel>Maximum</FormLabel><FormControl><Input inputMode="decimal" {...f} /></FormControl></FormItem>)} />
                            </div>
                        )}
                        <FormField control={form.control} name="entity_types" render={({ field: f }) => (
                            <FormItem>
                                <FormLabel>Used on</FormLabel>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-border p-2">
                                    {CustomFieldEntityOptions.map((o) => (
                                        <label key={o.id} className="flex items-center gap-1.5 text-[13px]">
                                            <Checkbox checked={f.value?.includes(o.id)} onCheckedChange={(c) => f.onChange(c ? [...(f.value ?? []), o.id] : (f.value ?? []).filter((x) => x !== o.id))} />
                                            {o.label}
                                        </label>
                                    ))}
                                </div>
                                <FormDescription>Pick several to share one field across record types; values carry over when a lead is converted.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field: f }) => (<FormItem><FormLabel>Help text</FormLabel><FormControl><Input {...f} /></FormControl></FormItem>)} />
                        <FormField control={form.control} name="is_required" render={({ field: f }) => (
                            <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                                <div><FormLabel>Required</FormLabel><FormDescription>New and edited records must have a value.</FormDescription></div>
                                <FormControl><Switch checked={f.value} onCheckedChange={f.onChange} aria-label="Required" /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{field ? "Save" : "Create field"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function GroupsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const groups = useCustomFieldGroups(open);
    const create = useCreateCustomFieldGroup();
    const update = useUpdateCustomFieldGroup();
    const del = useDeleteCustomFieldGroup();
    const [name, setName] = useState("");
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Field groups</DialogTitle>
                    <DialogDescription>Groups become sections on forms and detail pages.</DialogDescription>
                </DialogHeader>
                <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!name.trim()) return;
                        create.mutate({ name: name.trim() }, { onSuccess: () => setName("") });
                    }}
                >
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Billing details" aria-label="New group name" />
                    <Button type="submit" loading={create.isPending}><Plus /> Add</Button>
                </form>
                {groups.isPending ? <ListSkeleton className="p-0" /> : groups.error ? <ErrorState error={groups.error} onRetry={() => groups.refetch()} /> : !groups.data.length ? (
                    <EmptyState compact title="No groups yet" />
                ) : (
                    <ul className="divide-y divide-border-soft rounded-md border border-border">
                        {groups.data.map((g) => (
                            <li key={g.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                                {/* Click the name to rename (saves on blur / Enter, optimistic). */}
                                <span className="min-w-0 flex-1 text-foreground"><InlineText value={g.name} aria-label={`Rename ${g.name}`} maxLength={80} onSave={(next) => update.mutate({ id: g.id, name: next })} /></span>
                                <span className="text-xs text-muted-foreground">{g._count.fields} field{g._count.fields === 1 ? "" : "s"}</span>
                                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${g.name}`} onClick={() => del.mutate(g.id)}><Trash2 /></Button>
                            </li>
                        ))}
                    </ul>
                )}
                <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
