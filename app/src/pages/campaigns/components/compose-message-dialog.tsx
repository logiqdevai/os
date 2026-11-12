import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSendMessage, useSenderIdentities, useTemplates } from "@/features/communications/hooks/use-communications";
import { composeFormSchema, type ComposeFormValues } from "@/features/communications/validation-schemas/communications.schema";
import { CommChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { CommMessageKindFormOptions } from "@/config/constants/dropdowns/communications/comm-message-status-filter.options";
import { CampaignPaths } from "../campaign-paths";

const NONE = "__none";
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * One-off email / SMS (POST /communications/messages). Needs communications.messages.send.
 * Consent is not required for one-off customer messages, but suppressions are enforced by the API.
 */
export function ComposeMessageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const navigate = useNavigate();
    const send = useSendMessage();
    const form = useForm<ComposeFormValues>({ resolver: zodResolver(composeFormSchema), defaultValues: { channel: "EMAIL", to_address: "", to_name: "", template_id: "", subject: "", body: "", kind: "CUSTOMER", sender_identity_id: "" } });
    const channel = form.watch("channel");
    const templateId = form.watch("template_id");
    const templates = useTemplates({ channel, status: "ACTIVE", limit: 100 });
    const senders = useSenderIdentities(channel);
    useEffect(() => { if (open) form.reset(); }, [open, form]);

    const submit = form.handleSubmit((v) => {
        const body = v.body?.trim();
        send.mutate(
            {
                channel: v.channel,
                to_address: v.to_address,
                to_name: v.to_name || undefined,
                template_id: v.template_id || undefined,
                subject: v.channel === "EMAIL" ? v.subject || undefined : undefined,
                ...(body && (v.channel === "EMAIL" ? { body_html: escapeHtml(body).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join(""), body_text: body } : { body_text: body })),
                kind: v.kind,
                sender_identity_id: v.sender_identity_id || undefined,
            },
            // The message page shows its delivery status (or why it was not sent); no toast.
            { onSuccess: (m) => { onOpenChange(false); navigate(CampaignPaths.message(m.id)); } },
        );
    });

    return (
        <Dialog open={open} onOpenChange={(o) => !send.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>New message</DialogTitle>
                            <DialogDescription>Send a single email or SMS. It is logged in the message history.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="channel" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Channel</FormLabel>
                                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("template_id", ""); form.setValue("sender_identity_id", ""); }}>
                                        <FormControl><SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{CommChannelFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="kind" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{CommMessageKindFormOptions.filter((o) => o.id === "CUSTOMER" || o.id === "TRANSACTIONAL").map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="to_address" render={({ field }) => (
                                <FormItem><FormLabel>To</FormLabel><FormControl><Input autoFocus placeholder={channel === "EMAIL" ? "name@example.com" : "+306912345678"} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="to_name" render={({ field }) => (
                                <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Optional" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                            )} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField control={form.control} name="template_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Template</FormLabel>
                                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                                        <FormControl><SelectTrigger aria-label="Template"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>No template</SelectItem>
                                            {templates.data?.data.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="sender_identity_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>From</FormLabel>
                                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                                        <FormControl><SelectTrigger aria-label="From"><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE}>Default sender</SelectItem>
                                            {senders.data?.filter((s) => s.status === "VERIFIED").map((s) => <SelectItem key={s.id} value={s.id}>{s.address}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        {channel === "EMAIL" && (
                            <FormField control={form.control} name="subject" render={({ field }) => (
                                <FormItem><FormLabel>Subject{templateId ? " (overrides the template)" : ""}</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                            )} />
                        )}
                        <FormField control={form.control} name="body" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Message{templateId ? " (overrides the template)" : ""}</FormLabel>
                                <FormControl><Textarea rows={6} placeholder="Hi {{first_name}}, …" {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={send.isPending}>Cancel</Button>
                            <Button type="submit" loading={send.isPending}><Send /> Send</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
