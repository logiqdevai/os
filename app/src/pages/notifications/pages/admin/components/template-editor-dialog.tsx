import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, History } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { Switch } from "@/components/ui/switch";
import { EntityPicker } from "@/components/ui/entity-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { NotificationChannelOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { templateFormSchema, type TemplateFormValues } from "@/features/notifications/validation-schemas/notification-admin.schema";
import { useAdminEventTypes, useAdminTemplate, useCreateTemplate, usePreviewTemplate, useRestoreTemplateVersion, useUpdateTemplate } from "@/features/notifications/hooks/use-notification-admin";
import type { TemplateRow } from "@/features/notifications/interfaces/notification-admin.interfaces";

const VARIABLES = ["title", "body", "entity_label", "url", "actor.name", "recipient.name", "organization.name"];

export type TemplateEditorTarget =
    | { mode: "create"; event_type_id?: string }
    | { mode: "edit"; template: TemplateRow }
    /** Platform default → organization copy. */
    | { mode: "customize"; template: TemplateRow };

/**
 * Template editor (14 §10): subject / title / body with {{variables}}, CTA, live preview with sample data, version history.
 * Editing an organization template autosaves (each save is a new version, so the pause before saving is longer);
 * a new template or a customized copy of a platform default is created with an explicit button.
 * @perm notifications.templates.manage · @api POST/PATCH /notification-templates · POST /notification-templates/preview · POST /:id/versions/:v/restore
 */
export function TemplateEditorDialog({ target, onClose }: { target: TemplateEditorTarget | null; onClose: () => void }) {
    const editing = target?.mode === "edit" ? target.template : null;
    const source = target && target.mode !== "create" ? target.template : null;
    const types = useAdminEventTypes({ limit: 200, active: "true" }, !!target && target.mode === "create");
    const detail = useAdminTemplate(editing?.id);
    const create = useCreateTemplate();
    const update = useUpdateTemplate();
    const restore = useRestoreTemplateVersion();
    const preview = usePreviewTemplate();
    const form = useForm<TemplateFormValues>({
        resolver: zodResolver(templateFormSchema),
        defaultValues: { event_type_id: "", channel: "EMAIL", locale: "", subject: "", title: "", body: "", cta_label: "", cta_url: "", is_active: true },
    });
    const channel = useWatch({ control: form.control, name: "channel" });

    useEffect(() => {
        if (!target) return;
        preview.reset();
        form.reset(source
            ? { event_type_id: source.event_type_id, channel: source.channel === "IN_APP" ? "IN_APP" : "EMAIL", locale: source.locale ?? "", subject: source.subject ?? "", title: source.title, body: source.body, cta_label: source.cta_label ?? "", cta_url: source.cta_url ?? "", is_active: source.is_active }
            : { event_type_id: target.mode === "create" ? target.event_type_id ?? "" : "", channel: "EMAIL", locale: "", subject: "", title: "{{title}}", body: "{{body}}", cta_label: "Open", cta_url: "", is_active: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target]);

    const contentOf = (v: TemplateFormValues) => ({ subject: v.subject || null, title: v.title, body: v.body, cta_label: v.cta_label || null, cta_url: v.cta_url || null, is_active: v.is_active });
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: (editing as TemplateRow).id, ...contentOf(v) }), { enabled: !!editing, delay: 2000 });
    const pending = create.isPending;
    const close = () => { if (editing) autosave.flush(); onClose(); };
    const submit = form.handleSubmit((v) => {
        if (editing) return close();
        create.mutate({ ...contentOf(v), event_type_id: v.event_type_id, channel: v.channel, locale: v.locale || null }, { onSuccess: onClose });
    });
    const runPreview = () => {
        const v = form.getValues();
        preview.mutate({ subject: v.subject || null, title: v.title, body: v.body, cta_label: v.cta_label || null });
    };

    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && !pending && close()}>
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{editing ? `Edit template · v${editing.version}` : source ? "Customize platform template" : "New template"}</DialogTitle>
                            <DialogDescription>
                                {source?.event_type ? <code className="text-xs">{source.event_type.key}</code> : "Wording of one event on one channel and language."} Variables use {"{{name}}"}; unknown ones render empty.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                            <div className="space-y-4">
                                {!source && (
                                    <FormField control={form.control} name="event_type_id" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Event</FormLabel>
                                            <EntityPicker
                                                items={(types.data?.data ?? []).map((t) => ({ id: t.id, label: t.name, keywords: t.key, hint: <code className="text-xs">{t.key}</code> }))}
                                                value={field.value} onChange={(id) => field.onChange(id ?? "")} loading={types.isLoading}
                                                placeholder="Choose an event" searchPlaceholder="Search events…" ariaLabel="Event"
                                            />
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                                {!editing && (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField control={form.control} name="channel" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Channel</FormLabel>
                                                <Select value={field.value} onValueChange={field.onChange} disabled={!!source}>
                                                    <FormControl><SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>{NotificationChannelOptions.filter((o) => o.id === "IN_APP" || o.id === "EMAIL").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="locale" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Language</FormLabel>
                                                <FormControl><Input placeholder="Every language" disabled={!!source} {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                )}
                                {channel === "EMAIL" && (
                                    <FormField control={form.control} name="subject" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subject</FormLabel>
                                            <FormControl><Input placeholder="{{title}}" {...field} /></FormControl>
                                        </FormItem>
                                    )} />
                                )}
                                <FormField control={form.control} name="title" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Title</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="body" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Body</FormLabel>
                                        <FormControl><Textarea rows={5} className="font-mono text-xs" {...field} /></FormControl>
                                        <FormDescription className="flex flex-wrap gap-1">{VARIABLES.map((v) => <code key={v} className="rounded-xs bg-secondary px-1 text-[11px]">{`{{${v}}}`}</code>)}</FormDescription>
                                    </FormItem>
                                )} />
                                {channel === "EMAIL" && (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField control={form.control} name="cta_label" render={({ field }) => (
                                            <FormItem><FormLabel>Button label</FormLabel><FormControl><Input placeholder="Open" {...field} /></FormControl></FormItem>
                                        )} />
                                        <FormField control={form.control} name="cta_url" render={({ field }) => (
                                            <FormItem><FormLabel>Button link</FormLabel><FormControl><Input placeholder="{{url}}" {...field} /></FormControl></FormItem>
                                        )} />
                                    </div>
                                )}
                                <FormField control={form.control} name="is_active" render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Active" /></FormControl>
                                        <FormLabel className="font-normal">Active</FormLabel>
                                    </FormItem>
                                )} />
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <p className="text-xs font-medium text-muted-foreground">Preview (sample data)</p>
                                        <Button type="button" size="sm" variant="outline" loading={preview.isPending} onClick={runPreview}><Eye /> Preview</Button>
                                    </div>
                                    {preview.data ? (
                                        <div className="space-y-2 rounded-md border border-border bg-card p-3 text-[13px]">
                                            {channel === "EMAIL" && <p className="text-xs text-muted-foreground">Subject: <span className="text-foreground">{preview.data.subject}</span></p>}
                                            <p className="font-medium text-foreground">{preview.data.title}</p>
                                            <p className="whitespace-pre-wrap text-body">{preview.data.body}</p>
                                            {preview.data.missing_variables.length > 0 && <p className="text-xs text-warning">Unknown variables: {preview.data.missing_variables.join(", ")}</p>}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">Press Preview to render the template with sample values.</p>
                                    )}
                                </div>
                                {editing && (
                                    <div className="rounded-lg border border-border">
                                        <p className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground"><History className="size-3.5" /> Earlier versions</p>
                                        <ul className="max-h-48 divide-y divide-border-soft overflow-y-auto">
                                            {(detail.data?.versions ?? []).map((v) => (
                                                <li key={v.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-foreground">v{v.version} · {v.title}</p>
                                                        <p className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</p>
                                                    </div>
                                                    <Button type="button" size="sm" variant="ghost" loading={restore.isPending && restore.variables?.version === v.version} onClick={() => restore.mutate({ id: editing.id, version: v.version }, { onSuccess: onClose })}>Restore</Button>
                                                </li>
                                            ))}
                                            {!detail.isLoading && !detail.data?.versions.length && <li className="px-3 py-2 text-xs text-muted-foreground">No earlier versions.</li>}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter className="sm:items-center">
                            {editing ? (
                                <>
                                    <SaveStatus state={autosave} className="mr-auto" />
                                    <Button type="button" variant="outline" onClick={close}>Done</Button>
                                </>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
                                    <Button type="submit" loading={pending}>{source ? "Create copy" : "Create template"}</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
