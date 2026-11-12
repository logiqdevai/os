import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { cn } from "@/lib/utils";
import { LossReasonScopeFormOptions, SettingKindOptions, ToneFormOptions } from "@/config/constants/dropdowns/crm/crm-settings.options";
import { useArchiveSettingOption, useCreateSettingOption, useCrmSettings, useReorderSettingOptions, useUpdateSettingOption } from "@/features/crm/settings/hooks/use-crm-settings";
import type { CrmSettings, SettingKind, SettingOption } from "@/features/crm/settings/interfaces/settings.interfaces";
import { settingOptionSchema, tagFormSchema, type SettingOptionValues, type TagFormValues } from "@/features/crm/settings/validation-schemas/settings.schema";
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "@/features/crm/tags/hooks/use-tags";
import type { Tag } from "@/features/crm/tags/interfaces/tags.interfaces";
import { ToneBadge, toneDot } from "../../components/crm-ui";

const LIST_KEY: Record<SettingKind, keyof CrmSettings> = { "lead-sources": "lead_sources", "lead-statuses": "lead_statuses", "lifecycle-stages": "lifecycle_stages", "loss-reasons": "loss_reasons" };

/**
 * CRM settings: lead sources, lead statuses, lifecycle stages, loss reasons, tags (mockups `pipelines` settings tabs, `tags`).
 * @route /crm/settings?tab=lead-sources|lead-statuses|lifecycle-stages|loss-reasons|tags
 * @perm crm.settings.manage (route gate) · tags tab platform.tags.manage
 * @api GET /crm/settings?archived=true · POST/PATCH /crm/settings/:kind(/:id) · PUT /crm/settings/:kind/order · /tags
 */
export default function CrmSettingsPage() {
    const [sp, setSp] = useSearchParams();
    const tab = sp.get("tab") ?? "lead-sources";
    const canTags = usePermission("platform.tags.manage");
    return (
        <Page width="wide">
            <PageHeader title="CRM settings" description="Options used across leads, deals, companies and contacts. Archived options stay on old records." />
            <Tabs value={tab} onValueChange={(t) => setSp({ tab: t }, { replace: true })}>
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <TabsList>
                        {SettingKindOptions.map((k) => <TabsTrigger key={k.id} value={k.id}>{k.label}</TabsTrigger>)}
                        {canTags && <TabsTrigger value="tags">Tags</TabsTrigger>}
                    </TabsList>
                </div>
                {SettingKindOptions.map((k) => (
                    <TabsContent key={k.id} value={k.id} className="mt-4"><OptionList kind={k.id} description={k.description} /></TabsContent>
                ))}
                {canTags && <TabsContent value="tags" className="mt-4"><TagsManager /></TabsContent>}
            </Tabs>
        </Page>
    );
}

function OptionList({ kind, description }: { kind: SettingKind; description: string }) {
    const settings = useCrmSettings(true);
    const archive = useArchiveSettingOption();
    const reorder = useReorderSettingOptions();
    const update = useUpdateSettingOption();
    const [editing, setEditing] = useState<SettingOption | null>(null);
    const [creating, setCreating] = useState(false);
    const label = getDropdownOptionLabel(SettingKindOptions, kind);

    if (settings.isPending) return <ListSkeleton className="p-0" />;
    if (settings.error) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
    const rows = settings.data[LIST_KEY[kind]];
    const active = rows.filter((r) => !r.archived_at);
    const archived = rows.filter((r) => r.archived_at);

    const move = (i: number, dir: -1 | 1) => {
        const ids = active.map((r) => r.id);
        [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
        reorder.mutate({ kind, ids }); // optimistic
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] text-muted-foreground">{description}</p>
                <Button size="sm" onClick={() => setCreating(true)}><Plus /> Add</Button>
            </div>
            <div className="rounded-lg border border-border bg-card">
                {!active.length ? <EmptyState compact title={`No ${label.toLowerCase()}`} /> : (
                    <ul className="divide-y divide-border-soft">
                        {active.map((r, i) => (
                            <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[13px]">
                                    {kind === "lead-statuses" ? <ToneBadge tone={r.color}>{r.name}</ToneBadge> : <span className="font-medium text-foreground">{r.name}</span>}
                                    {r.is_default && <Badge variant="info">Default</Badge>}
                                    {r.is_converted && <Badge variant="success">Converted</Badge>}
                                    {r.is_lost && <Badge variant="danger">Lost</Badge>}
                                    {r.is_customer && <Badge variant="success">Customer</Badge>}
                                    {kind === "loss-reasons" && r.applies_to && <Badge>{getDropdownOptionLabel(LossReasonScopeFormOptions, r.applies_to)}</Badge>}
                                </div>
                                <Button variant="ghost" size="icon-sm" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                                <Button variant="ghost" size="icon-sm" aria-label={`Move ${r.name} down`} disabled={i === active.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => setEditing(r)}><Pencil /> Edit</DropdownMenuItem>
                                        {kind !== "loss-reasons" && !r.is_default && <DropdownMenuItem onSelect={() => update.mutate({ kind, id: r.id, is_default: true })}>Make default</DropdownMenuItem>}
                                        <DropdownMenuItem onSelect={() => archive.mutate({ kind, id: r.id, archived: true })}><Archive /> Archive</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {!!archived.length && (
                <div>
                    <h3 className="mb-1 text-xs font-medium text-muted-foreground">Archived</h3>
                    <ul className="flex flex-wrap gap-2">
                        {archived.map((r) => (
                            <li key={r.id} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                                {r.name}
                                <Button variant="ghost" size="icon-sm" className="size-5" aria-label={`Restore ${r.name}`} onClick={() => archive.mutate({ kind, id: r.id, archived: false })}><ArchiveRestore className="size-3" /></Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <OptionDialog kind={kind} open={creating || !!editing} option={editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }} />
        </div>
    );
}

function OptionDialog({ kind, open, option, onOpenChange }: { kind: SettingKind; open: boolean; option: SettingOption | null; onOpenChange: (o: boolean) => void }) {
    const create = useCreateSettingOption();
    const update = useUpdateSettingOption();
    const form = useForm<SettingOptionValues>({ resolver: zodResolver(settingOptionSchema) });
    useEffect(() => {
        if (open) form.reset({ name: option?.name ?? "", color: option?.color ?? "neutral", is_default: !!option?.is_default, is_converted: !!option?.is_converted, is_lost: !!option?.is_lost, is_customer: !!option?.is_customer, applies_to: option?.applies_to ?? "BOTH" });
    }, [open, option, form]);
    const pending = create.isPending || update.isPending;
    const label = getDropdownOptionLabel(SettingKindOptions, kind);
    const submit = form.handleSubmit((v) => {
        const dto = {
            name: v.name,
            ...(kind !== "loss-reasons" && { is_default: v.is_default }),
            ...(kind === "lead-statuses" && { color: v.color, is_converted: v.is_converted, is_lost: v.is_lost }),
            ...(kind === "lifecycle-stages" && { is_customer: v.is_customer }),
            ...(kind === "loss-reasons" && { applies_to: v.applies_to }),
        };
        // Edit is optimistic, so the dialog closes at once; add closes when created. Failures toast globally.
        if (option) { update.mutate({ kind, id: option.id, ...dto }); onOpenChange(false); }
        else create.mutate({ kind, ...dto }, { onSuccess: () => onOpenChange(false) });
    });
    const flag = (name: "is_default" | "is_converted" | "is_lost" | "is_customer", title: string) => (
        <FormField control={form.control} name={name} render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <FormLabel>{title}</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label={title} /></FormControl>
            </FormItem>
        )} />
    );
    return (
        <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-3">
                        <DialogHeader>
                            <DialogTitle>{option ? `Edit ${option.name}` : `Add to ${label.toLowerCase()}`}</DialogTitle>
                            <DialogDescription>{label}</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>)} />
                        {kind === "lead-statuses" && (
                            <FormField control={form.control} name="color" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Color</FormLabel>
                                    <Select value={field.value ?? "neutral"} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Color"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{ToneFormOptions.map((o) => <SelectItem key={o.id} value={o.id}><span className={cn("mr-1.5 inline-block size-2 rounded-full", toneDot(o.id))} />{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        )}
                        {kind === "loss-reasons" && (
                            <FormField control={form.control} name="applies_to" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Applies to</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Applies to"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{LossReasonScopeFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        )}
                        {kind !== "loss-reasons" && flag("is_default", "Default for new records")}
                        {kind === "lead-statuses" && flag("is_converted", "Means the lead was converted")}
                        {kind === "lead-statuses" && flag("is_lost", "Means the lead was lost")}
                        {kind === "lifecycle-stages" && flag("is_customer", "Marks the company as a customer")}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                            <Button type="submit" loading={pending}>{option ? "Save" : "Add"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

/** Tags (mockup `tags`). @perm platform.tags.manage · @api GET/POST/PATCH/DELETE /tags */
function TagsManager() {
    const tags = useTags();
    const create = useCreateTag();
    const update = useUpdateTag();
    const del = useDeleteTag();
    const [editing, setEditing] = useState<Tag | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<Tag | null>(null);
    const form = useForm<TagFormValues>({ resolver: zodResolver(tagFormSchema), defaultValues: { name: "", color: "neutral" } });
    useEffect(() => { if (creating || editing) form.reset({ name: editing?.name ?? "", color: editing?.color ?? "neutral" }); }, [creating, editing, form]);
    const close = () => { setCreating(false); setEditing(null); };
    const pending = create.isPending || update.isPending;
    const submit = form.handleSubmit((v) => {
        // Edit is optimistic, so the dialog closes at once; create closes when created. Failures toast globally.
        if (editing) { update.mutate({ id: editing.id, ...v }); close(); }
        else create.mutate(v, { onSuccess: close });
    });

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] text-muted-foreground">Organization-wide tags for companies, contacts, leads and deals.</p>
                <Button size="sm" onClick={() => setCreating(true)}><Plus /> New tag</Button>
            </div>
            <div className="rounded-lg border border-border bg-card">
                {tags.isPending ? <ListSkeleton /> : tags.error ? <ErrorState error={tags.error} onRetry={() => tags.refetch()} /> : !tags.data.length ? <EmptyState compact icon={Tags} title="No tags yet" /> : (
                    <ul className="divide-y divide-border-soft">
                        {tags.data.map((t) => (
                            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                                <div className="flex flex-1 items-center gap-2"><ToneBadge tone={t.color}>{t.name}</ToneBadge><span className="text-xs text-muted-foreground">{t.usage} record{t.usage === 1 ? "" : "s"}</span></div>
                                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil /></Button>
                                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}><Trash2 /></Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <Dialog open={creating || !!editing} onOpenChange={(o) => !o && !pending && close()}>
                <DialogContent className="sm:max-w-sm">
                    <Form {...form}>
                        <form onSubmit={submit} className="space-y-3">
                            <DialogHeader><DialogTitle>{editing ? "Edit tag" : "New tag"}</DialogTitle><DialogDescription>Tags help filter and group records.</DialogDescription></DialogHeader>
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input autoFocus {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="color" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Color</FormLabel>
                                    <Select value={field.value ?? "neutral"} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Color"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{ToneFormOptions.map((o) => <SelectItem key={o.id} value={o.id}><span className={cn("mr-1.5 inline-block size-2 rounded-full", toneDot(o.id))} />{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
                                <Button type="submit" loading={pending}>Save</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <ConfirmationDialog
                isOpen={!!deleting}
                onClose={() => setDeleting(null)}
                title={`Delete tag ${deleting?.name}?`}
                description="It is removed from every record that has it."
                confirmText="Delete"
                variant="destructive"
                onConfirm={() => { if (deleting) del.mutate(deleting.id); setDeleting(null); }}
            />
        </div>
    );
}
