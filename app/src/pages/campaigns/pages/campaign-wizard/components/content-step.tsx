import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { useSenderIdentities, useTemplate, useTemplates } from "@/features/communications/hooks/use-communications";
import type { CampaignFormValues } from "@/features/communications/validation-schemas/communications.schema";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CommSenderIdentityStatusOptions } from "@/config/constants/dropdowns/communications/comm-compliance.options";
import { ContentPreview } from "../../../components/content-preview";
import { VariableChips } from "../../../components/variable-chips";
import { CampaignPaths } from "../../../campaign-paths";

const NONE = "__none";

/** Step 2 — content (template or inline), sender. */
export function ContentStep({ form }: { form: UseFormReturn<CampaignFormValues> }) {
    const canTemplates = usePermission("communications.templates.read");
    const channel = form.watch("channel");
    const templateId = form.watch("template_id");
    const [subject, preheader, body_html, body_text] = form.watch(["subject", "preheader", "body_html", "body_text"]);
    const templates = useTemplates({ channel, status: "ACTIVE", limit: 100 });
    const template = useTemplate(templateId && templateId !== NONE ? templateId : undefined);
    const senders = useSenderIdentities(channel);
    const lastField = useRef<"subject" | "body_html" | "body_text">(channel === "EMAIL" ? "body_html" : "body_text");
    const appliedTemplate = useRef<string | null>(null);

    // Picking a template copies its published content into the editor (the campaign keeps a snapshot).
    useEffect(() => {
        const t = template.data;
        if (!t || appliedTemplate.current === t.id) return;
        appliedTemplate.current = t.id;
        const v = t.current_version;
        if (!v) return;
        form.setValue("subject", v.subject ?? "", { shouldDirty: true });
        form.setValue("preheader", v.preheader ?? "", { shouldDirty: true });
        form.setValue("body_html", v.body_html ?? "", { shouldDirty: true });
        form.setValue("body_text", v.body_text ?? "", { shouldDirty: true });
        if (t.default_sender_identity_id && !form.getValues("sender_identity_id")) form.setValue("sender_identity_id", t.default_sender_identity_id);
    }, [template.data, form]);

    const insert = (token: string) => {
        const field = lastField.current;
        form.setValue(field, `${form.getValues(field) ?? ""}${token}`, { shouldDirty: true });
    };

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0 space-y-4">
                {canTemplates && (
                    <FormField
                        control={form.control}
                        name="template_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Start from a template</FormLabel>
                                <Select value={field.value || NONE} onValueChange={(v) => { appliedTemplate.current = null; field.onChange(v === NONE ? "" : v); }}>
                                    <FormControl><SelectTrigger aria-label="Template"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value={NONE}>No template — write it here</SelectItem>
                                        {templates.data?.data.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    Published {channel === "EMAIL" ? "email" : "SMS"} templates. <Link to={CampaignPaths.templates} className="text-primary hover:underline">Manage templates</Link>
                                </FormDescription>
                            </FormItem>
                        )}
                    />
                )}

                <FormField
                    control={form.control}
                    name="sender_identity_id"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{channel === "EMAIL" ? "From address" : "Sender"}</FormLabel>
                            <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                                <FormControl><SelectTrigger aria-label="Sender"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value={NONE}>{channel === "EMAIL" ? "Provider default from address" : "Provider default number"}</SelectItem>
                                    {senders.data?.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.display_name ? `${s.display_name} <${s.address}>` : s.address}
                                            {s.status !== "VERIFIED" && ` · ${getDropdownOptionLabel(CommSenderIdentityStatusOptions, s.status)}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormDescription>Only verified senders can send. <Link to={CampaignPaths.senders} className="text-primary hover:underline">Senders & domains</Link></FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {channel === "EMAIL" && (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="from_name" render={({ field }) => (
                                <FormItem><FormLabel>From name</FormLabel><FormControl><Input placeholder="Agency team" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="reply_to_address" render={({ field }) => (
                                <FormItem><FormLabel>Reply-to</FormLabel><FormControl><Input type="email" placeholder="hello@agency.com" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="subject" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Subject</FormLabel>
                                <FormControl><Input placeholder="What's new this month, {{first_name}}" {...field} value={field.value ?? ""} onFocus={() => { lastField.current = "subject"; }} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="preheader" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Preview text</FormLabel>
                                <FormControl><Input placeholder="Shown next to the subject in the inbox" {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="body_html" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email body (HTML)</FormLabel>
                                <FormControl>
                                    <Textarea rows={14} className="font-mono text-xs" placeholder="<p>Hi {{first_name}},</p>" {...field} value={field.value ?? ""} onFocus={() => { lastField.current = "body_html"; }} />
                                </FormControl>
                                <FormDescription>An unsubscribe footer is added automatically unless you place {"{{unsubscribe_url}}"} yourself.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </>
                )}
                {channel === "SMS" && (
                    <FormField control={form.control} name="body_text" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Message</FormLabel>
                            <FormControl><Textarea rows={6} placeholder="Hi {{first_name}}, …" {...field} value={field.value ?? ""} onFocus={() => { lastField.current = "body_text"; }} /></FormControl>
                            <FormDescription>“Reply STOP to opt out.” is added to campaign SMS.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                )}
                <VariableChips onInsert={insert} exclude={channel === "SMS" ? ["unsubscribe_url"] : []} />
            </div>
            <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
                <div className="mb-2 text-xs font-medium text-muted-foreground">Preview with sample data</div>
                <ContentPreview channel={channel} subject={subject} preheader={preheader} body_html={body_html} body_text={body_text} />
            </div>
        </div>
    );
}
