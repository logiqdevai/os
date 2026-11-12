import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bot, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { ChannelAiModeBadge, ChannelAiModeOptions, WeekdayOptions } from "@/config/constants/dropdowns/support/support.options";
import { useAiStatus, useChannelAutomation, useSetChannelAiAgent, useSetChannelOfficeHours } from "@/features/support/hooks/use-support";
import { channelAiFormSchema, officeHoursFormSchema, type ChannelAiFormValues, type OfficeHoursFormValues } from "@/features/support/validation-schemas/support.schema";
import type { ChannelAutomation, SupportChannel, WeekdayKey } from "@/features/support/interfaces/support.interfaces";

/** Channel types the AI assistant can answer on (13 §3). */
const AI_TYPES = new Set(["WIDGET", "LIVE_CHAT", "EMAIL", "PORTAL"]);

/**
 * AI auto-answer + office hours row of a channel card (13 §3, §5).
 * @perm view support.inboxes.read · AI mode support.ai.configure · office hours support.inboxes.manage
 * @api GET /support/channels/:id/automation · PUT …/ai-agent · PUT …/office-hours
 */
export function ChannelAutomationRow({ channel }: { channel: SupportChannel }) {
    const canAi = usePermission("support.ai.configure");
    const canManage = usePermission("support.inboxes.manage");
    const isWidget = channel.type === "WIDGET" || channel.type === "LIVE_CHAT";
    const supportsAi = AI_TYPES.has(channel.type);
    const auto = useChannelAutomation(channel.id, supportsAi || isWidget);
    const [aiOpen, setAiOpen] = useState(false);
    const [hoursOpen, setHoursOpen] = useState(false);
    if (!supportsAi && !isWidget) return null;
    if (auto.isLoading) return <Skeleton className="mt-3 h-8 w-full max-w-md" />;
    if (auto.error || !auto.data) return <p className="mt-3 text-xs text-danger">Could not load AI and office-hours settings: {getApiErrorMessage(auto.error)}</p>;
    const a = auto.data;
    const mode = ChannelAiModeBadge[a.ai.mode];
    const status = a.office_hours_status;
    return (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-soft pt-3 text-[13px]">
            {supportsAi && (
                <>
                    <Badge variant={mode.variant}><Bot className="size-3" /> {mode.label}</Badge>
                    {a.ai.mode === "AUTO_REPLY" && <span className="text-xs text-muted-foreground">≥ {Math.round(a.ai.min_confidence * 100)}% confidence · max {a.ai.max_turns} answers</span>}
                    {canAi && <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>AI answers</Button>}
                </>
            )}
            {isWidget && (
                <>
                    <Badge variant={!status.enabled ? "neutral" : status.open ? "success" : "warning"}>
                        <Clock className="size-3" /> {!status.enabled ? "Always online" : status.open ? "Open now" : "Closed now"}
                    </Badge>
                    {status.enabled && !status.open && status.next_open_at && <span className="text-xs text-muted-foreground">opens {formatDateTime(status.next_open_at)}</span>}
                    {canManage && <Button size="sm" variant="outline" onClick={() => setHoursOpen(true)}>Office hours</Button>}
                </>
            )}
            {supportsAi && <AiAgentDialog channel={channel} automation={a} open={aiOpen} onOpenChange={setAiOpen} />}
            {isWidget && <OfficeHoursDialog channel={channel} automation={a} open={hoursOpen} onOpenChange={setHoursOpen} />}
        </div>
    );
}

function AiAgentDialog({ channel, automation, open, onOpenChange }: { channel: SupportChannel; automation: ChannelAutomation; open: boolean; onOpenChange: (o: boolean) => void }) {
    const save = useSetChannelAiAgent();
    const ai = useAiStatus(open);
    const form = useForm<ChannelAiFormValues>({ resolver: zodResolver(channelAiFormSchema), defaultValues: { mode: "OFF", min_confidence_pct: 75, max_turns: 3, handover_phrases: "" } });
    useEffect(() => {
        if (open) form.reset({ mode: automation.ai.mode, min_confidence_pct: Math.round(automation.ai.min_confidence * 100), max_turns: automation.ai.max_turns, handover_phrases: automation.ai.handover_phrases.join(", ") });
    }, [open, automation, form]);
    const mode = form.watch("mode");
    const submit = form.handleSubmit((v) =>
        save.mutate(
            { id: channel.id, mode: v.mode, min_confidence: v.min_confidence_pct / 100, max_turns: v.max_turns, handover_phrases: (v.handover_phrases ?? "").split(",").map((p) => p.trim()).filter((p) => p.length >= 2) },
            { onSuccess: () => { toast({ title: "AI answers saved" }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) },
        ),
    );
    const num = (v: string) => (v === "" ? Number.NaN : Number(v));
    return (
        <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>AI answers · {channel.name}</DialogTitle>
                            <DialogDescription>The AI assistant answers from your published, public help articles only. Its replies are labelled as AI, link the articles used and never include internal notes.</DialogDescription>
                        </DialogHeader>
                        {ai.data && !ai.data.configured && (
                            <div className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-foreground">
                                No AI provider is connected, so the assistant will not answer (each conversation records why). <Link className="font-medium text-info underline" to="/admin/integrations">Connect your OpenAI key</Link>.
                            </div>
                        )}
                        <FormField control={form.control} name="mode" render={({ field }) => (
                            <FormItem><FormLabel>Mode</FormLabel>
                                <Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger aria-label="AI mode"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{ChannelAiModeOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select>
                                <FormDescription>
                                    {mode === "OFF" ? "People answer every message." : mode === "SUGGEST" ? "Every customer message gets a draft in the AI review queue; nothing is sent automatically." : "The AI replies when it is confident and grounded in an article; otherwise it hands over to your team with its draft."}
                                </FormDescription>
                            </FormItem>
                        )} />
                        {mode !== "OFF" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormField control={form.control} name="min_confidence_pct" render={({ field }) => (
                                    <FormItem><FormLabel>Minimum confidence (%)</FormLabel><FormControl><Input type="number" min={50} max={99} inputMode="numeric" value={Number.isNaN(field.value) ? "" : field.value} onChange={(e) => field.onChange(num(e.target.value))} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="max_turns" render={({ field }) => (
                                    <FormItem><FormLabel>Hand over after (answers)</FormLabel><FormControl><Input type="number" min={1} max={10} inputMode="numeric" value={Number.isNaN(field.value) ? "" : field.value} onChange={(e) => field.onChange(num(e.target.value))} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        )}
                        {mode !== "OFF" && (
                            <FormField control={form.control} name="handover_phrases" render={({ field }) => (
                                <FormItem><FormLabel>Extra handover phrases</FormLabel><FormControl><Textarea rows={2} placeholder="refund, cancel my account, άνθρωπος" {...field} /></FormControl>
                                    <FormDescription>Comma separated. "human", "agent", "a person" and similar always hand over.</FormDescription><FormMessage /></FormItem>
                            )} />
                        )}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
                            <Button type="submit" loading={save.isPending}>Save</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const DEFAULT_DAY = { open: false, start: "09:00", end: "17:00" };

function OfficeHoursDialog({ channel, automation, open, onOpenChange }: { channel: SupportChannel; automation: ChannelAutomation; open: boolean; onOpenChange: (o: boolean) => void }) {
    const save = useSetChannelOfficeHours();
    const blankDays = () => Object.fromEntries(WeekdayOptions.map((d) => [d.id, { ...DEFAULT_DAY, open: !["sat", "sun"].includes(d.id) }])) as OfficeHoursFormValues["days"];
    const form = useForm<OfficeHoursFormValues>({ resolver: zodResolver(officeHoursFormSchema), defaultValues: { enabled: false, use_organization_hours: true, timezone: "", offline_message: "", days: blankDays() } });
    useEffect(() => {
        if (!open) return;
        const oh = automation.office_hours;
        const days = blankDays();
        if (oh.days) {
            for (const d of WeekdayOptions) {
                const w = oh.days[d.id];
                days[d.id] = w ? { open: true, start: w.start, end: w.end } : { ...DEFAULT_DAY, open: false };
            }
        }
        form.reset({ enabled: oh.enabled, use_organization_hours: oh.use_organization_hours, timezone: oh.timezone ?? "", offline_message: oh.offline_message ?? "", days });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, automation, form]);
    const enabled = form.watch("enabled");
    const useOrg = form.watch("use_organization_hours");
    const submit = form.handleSubmit((v) =>
        save.mutate(
            {
                id: channel.id,
                enabled: v.enabled,
                use_organization_hours: v.use_organization_hours,
                timezone: v.timezone || null,
                offline_message: v.offline_message || null,
                days: Object.fromEntries(Object.entries(v.days).map(([k, d]) => [k, d.open ? { start: d.start, end: d.end } : null])) as Partial<Record<WeekdayKey, { start: string; end: string } | null>>,
            },
            { onSuccess: () => { toast({ title: "Office hours saved" }); onOpenChange(false); }, onError: (e) => toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }) },
        ),
    );
    return (
        <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={submit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Office hours · {channel.name}</DialogTitle>
                            <DialogDescription>Outside these hours the chat shows a "we'll reply by email" form (email required). Replies then go out by email when the inbox has an email channel.</DialogDescription>
                        </DialogHeader>
                        <FormField control={form.control} name="enabled" render={({ field }) => (
                            <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><div><FormLabel>Use office hours</FormLabel><FormDescription>Off = the chat is always online.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                        )} />
                        {enabled && (
                            <>
                                <FormField control={form.control} name="use_organization_hours" render={({ field }) => (
                                    <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><div><FormLabel>Same as organization hours</FormLabel><FormDescription>Business hours and working days from Admin → Organization.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                )} />
                                {!useOrg && (
                                    <div className="space-y-2">
                                        {WeekdayOptions.map((d) => (
                                            <div key={d.id} className="flex flex-wrap items-center gap-2">
                                                <FormField control={form.control} name={`days.${d.id}.open`} render={({ field }) => (
                                                    <label className="flex w-32 items-center gap-2 text-[13px] text-foreground"><Switch checked={field.value} onCheckedChange={field.onChange} aria-label={`${d.label} open`} />{d.label}</label>
                                                )} />
                                                {form.watch(`days.${d.id}.open`) ? (
                                                    <>
                                                        <FormField control={form.control} name={`days.${d.id}.start`} render={({ field }) => (<FormItem><FormControl><Input type="time" className="w-28" aria-label={`${d.label} opens`} {...field} /></FormControl></FormItem>)} />
                                                        <span className="text-muted-foreground">–</span>
                                                        <FormField control={form.control} name={`days.${d.id}.end`} render={({ field }) => (<FormItem><FormControl><Input type="time" className="w-28" aria-label={`${d.label} closes`} {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                    </>
                                                ) : <span className="text-xs text-muted-foreground">Closed</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <FormField control={form.control} name="timezone" render={({ field }) => (<FormItem><FormLabel>Time zone</FormLabel><FormControl><Input placeholder="Organization default, e.g. Europe/Athens" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="offline_message" render={({ field }) => (<FormItem><FormLabel>Offline message</FormLabel><FormControl><Textarea rows={2} placeholder="We're away right now. Leave your email and message — we'll reply by email as soon as we're back." {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </>
                        )}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
                            <Button type="submit" loading={save.isPending}>Save</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
