import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { History, Plus, Rocket } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { SaveStatus } from "@/components/ui/save-status";
import { useFormAutosave } from "@/hooks/use-autosave";
import { formatDateTime, personName } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useCreateTemplate, usePublishTemplate, useTemplate, useUpdateTemplate } from "@/features/communications/hooks/use-communications";
import type { TemplateDetail, TemplateVersion } from "@/features/communications/interfaces/communications.interfaces";
import { templateFormSchema, type TemplateFormValues } from "@/features/communications/validation-schemas/communications.schema";
import { CommTemplateCategoryFormOptions, CommTemplateStatusFormOptions } from "@/config/constants/dropdowns/communications/comm-template-category-form.options";
import { CommChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { ContentPreview } from "../../components/content-preview";
import { VariableChips } from "../../components/variable-chips";
import { CampaignPaths } from "../../campaign-paths";

const values = (t?: TemplateDetail | null): TemplateFormValues => {
    const v = t?.draft_version ?? t?.current_version;
    return {
        name: t?.name ?? "",
        description: t?.description ?? "",
        channel: t?.channel ?? "EMAIL",
        category: t?.category ?? "MARKETING_CAMPAIGN",
        language: t?.language ?? "en",
        subject: v?.subject ?? "",
        preheader: v?.preheader ?? "",
        body_html: v?.body_html ?? "",
        body_text: v?.body_text ?? "",
        change_note: "",
    };
};

const toDto = (v: TemplateFormValues) => ({
    name: v.name,
    description: v.description || undefined,
    category: v.category,
    language: v.language,
    subject: v.channel === "EMAIL" ? v.subject ?? "" : undefined,
    preheader: v.channel === "EMAIL" ? v.preheader ?? "" : undefined,
    body_html: v.channel === "EMAIL" ? v.body_html ?? "" : undefined,
    body_text: v.channel === "SMS" ? v.body_text ?? "" : undefined,
    change_note: v.change_note || undefined,
});

const versionLabel = (v: TemplateVersion) => (v.status === "PUBLISHED" ? "Published" : v.status === "DRAFT" ? "Draft" : "Previous");

/**
 * /campaigns/templates/new and /campaigns/templates/:id — editor with live preview and versions. An existing template's
 * draft saves as you edit (<SaveStatus /> in the header, no Save draft button); Publish stays an explicit button.
 * @perm VIEW communications.templates.read · create · update (save draft / publish)
 * @api GET /communications/templates/:id · POST /templates · PATCH /templates/:id · POST /templates/:id/versions/:versionId/publish · POST /templates/preview
 */
export default function TemplateEditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const canEdit = usePermission(id ? "communications.templates.update" : "communications.templates.create");
    const template = useTemplate(id);
    const create = useCreateTemplate();
    const update = useUpdateTemplate();
    const publish = usePublishTemplate();
    const form = useForm<TemplateFormValues>({ resolver: zodResolver(templateFormSchema), defaultValues: values() });
    const lastField = useRef<"subject" | "body_html" | "body_text">("body_html");

    const loaded = template.data?.id;
    useEffect(() => {
        if (template.data) form.reset(values(template.data));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded]);

    const [channel, subject, preheader, body_html, body_text] = form.watch(["channel", "subject", "preheader", "body_html", "body_text"]);
    const canAutosave = !!template.data && canEdit && !template.data.archived_at;
    const autosave = useFormAutosave(form, (v) => update.mutateAsync({ id: template.data?.id as string, ...toDto(v) }), { enabled: canAutosave });
    const unsaved = autosave.status === "pending" || autosave.status === "saving";

    if (id && template.isPending) return <PageSkeleton />;
    if (id && template.error) return <Page><ErrorState error={template.error} onRetry={() => template.refetch()} /></Page>;
    const t = template.data;
    const readOnly = !canEdit || !!t?.archived_at;

    const save = form.handleSubmit((v) => {
        if (t) return autosave.flush();
        create.mutate({ ...toDto(v), channel: v.channel }, { onSuccess: (r) => navigate(CampaignPaths.template(r.id), { replace: true }) });
    });

    // Publishing waits until the latest edits are saved (the button is disabled meanwhile); the versions list shows the result.
    const doPublish = () => {
        const draft = t?.draft_version;
        if (!t || !draft || unsaved) return;
        publish.mutate({ id: t.id, versionId: draft.id });
    };

    const insert = (token: string) => {
        const f = lastField.current;
        form.setValue(f, `${form.getValues(f) ?? ""}${token}`, { shouldDirty: true });
    };

    return (
        <Page width="wide">
            <PageHeader
                back={{ to: CampaignPaths.templates, label: "Templates" }}
                title={t?.name ?? "New template"}
                meta={t && <><Badge variant={t.status === "ACTIVE" ? "success" : "neutral"}>{getDropdownOptionLabel(CommTemplateStatusFormOptions, t.status)}</Badge>{canAutosave && <SaveStatus state={autosave} />}</>}
                actions={
                    !readOnly && (
                        <>
                            {!t && <Button variant="outline" onClick={save} loading={create.isPending}><Plus /> Create</Button>}
                            {t?.draft_version && <Button onClick={doPublish} loading={publish.isPending} disabled={unsaved} title={unsaved ? "Saving your latest changes…" : undefined}><Rocket /> Publish v{t.draft_version.version}</Button>}
                        </>
                    )
                }
            />
            <Form {...form}>
                <form onSubmit={save} className="grid gap-6 lg:grid-cols-2">
                    <fieldset disabled={readOnly} className="min-w-0 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem className="sm:col-span-2"><FormLabel>Name</FormLabel><FormControl><Input placeholder="Monthly newsletter" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="channel" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Channel</FormLabel>
                                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); lastField.current = v === "SMS" ? "body_text" : "body_html"; }} disabled={!!t || readOnly}>
                                        <FormControl><SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{CommChannelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                        <FormControl><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{CommTemplateCategoryFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        {channel === "EMAIL" ? (
                            <>
                                <FormField control={form.control} name="subject" render={({ field }) => (
                                    <FormItem><FormLabel>Subject</FormLabel><FormControl><Input placeholder="Hi {{first_name}}, here is your update" {...field} value={field.value ?? ""} onFocus={() => { lastField.current = "subject"; }} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="preheader" render={({ field }) => (
                                    <FormItem><FormLabel>Preview text</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="body_html" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Body (HTML)</FormLabel>
                                        <FormControl><Textarea rows={16} className="font-mono text-xs" placeholder="<p>Hi {{first_name}},</p>" {...field} value={field.value ?? ""} onFocus={() => { lastField.current = "body_html"; }} /></FormControl>
                                        <FormDescription>Use {"{{variable | fallback}}"} for a default, e.g. {"{{first_name | there}}"}.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </>
                        ) : (
                            <FormField control={form.control} name="body_text" render={({ field }) => (
                                <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea rows={6} {...field} value={field.value ?? ""} onFocus={() => { lastField.current = "body_text"; }} /></FormControl><FormMessage /></FormItem>
                            )} />
                        )}
                        {!readOnly && <VariableChips onInsert={insert} exclude={channel === "SMS" ? ["unsubscribe_url"] : []} />}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl></FormItem>
                            )} />
                            {t && (
                                <FormField control={form.control} name="change_note" render={({ field }) => (
                                    <FormItem><FormLabel>Change note</FormLabel><FormControl><Input placeholder="What changed in this draft" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                                )} />
                            )}
                        </div>
                    </fieldset>
                    <div className="min-w-0 space-y-6 lg:sticky lg:top-4 lg:self-start">
                        <div>
                            <div className="mb-2 text-xs font-medium text-muted-foreground">Preview with sample data</div>
                            <ContentPreview channel={channel} subject={subject} preheader={preheader} body_html={body_html} body_text={body_text} />
                        </div>
                        {t && (
                            <Section title="Versions">
                                <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                                    {t.versions.map((v) => (
                                        <li key={v.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                                            <History className="size-3.5 text-muted-foreground" />
                                            <span className="font-medium text-foreground">v{v.version}</span>
                                            <Badge variant={v.status === "PUBLISHED" ? "success" : v.status === "DRAFT" ? "info" : "neutral"}>{versionLabel(v)}</Badge>
                                            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{v.change_note ?? ""}</span>
                                            <span className="text-xs text-muted-foreground">{formatDateTime(v.published_at ?? v.updated_at)}{v.created_by ? ` · ${personName(v.created_by.user)}` : ""}</span>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}
                    </div>
                </form>
            </Form>
        </Page>
    );
}
