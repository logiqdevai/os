import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight, Send, ShieldCheck } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ErrorState, NoAccessState, PageSkeleton } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { useCampaign, useCampaignAction, useCreateCampaign, useUpdateCampaign } from "@/features/communications/hooks/use-communications";
import type { CampaignDetail, CampaignInput, PreflightResult } from "@/features/communications/interfaces/communications.interfaces";
import { campaignFormSchema, type CampaignFormValues } from "@/features/communications/validation-schemas/communications.schema";
import { CommChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { CampaignPaths } from "../../campaign-paths";
import { AudienceStep } from "./components/audience-step";
import { TopicField } from "./components/topic-field";
import { AbTestSection } from "./components/ab-test-section";
import { ScheduleOptions } from "./components/schedule-options";
import { AiAssistant } from "../../components/ai-assistant";
import { ContentStep } from "./components/content-step";
import { ReviewStep } from "./components/review-step";

const STEPS = ["Audience", "Content", "Schedule", "Review"] as const;
const STEP_FIELDS: (keyof CampaignFormValues)[][] = [
    ["name", "channel", "audiences"],
    ["subject", "preheader", "body_html", "body_text", "sender_identity_id", "from_name", "reply_to_address"],
    ["send_mode", "scheduled_at", "send_rate_per_hour", "tracking_enabled", "require_consent", "topic_id", "schedule_timezone", "send_in_recipient_timezone", "repeat", "repeat_interval", "repeat_days", "repeat_until"],
    [],
];

const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** RRULE subset used by campaigns: FREQ=DAILY|WEEKLY|MONTHLY;INTERVAL=n;BYDAY=MO,TU. */
function parseRule(rule: string | null): Pick<CampaignFormValues, "repeat" | "repeat_interval" | "repeat_days"> {
    const map = new Map((rule ?? "").split(";").map((p) => p.split("=") as [string, string]));
    const freq = map.get("FREQ");
    return {
        repeat: freq === "DAILY" || freq === "WEEKLY" || freq === "MONTHLY" ? freq : "NONE",
        repeat_interval: map.get("INTERVAL") ?? "1",
        repeat_days: (map.get("BYDAY") ?? "").split(",").filter(Boolean),
    };
}

function buildRule(v: CampaignFormValues): string | null {
    if (v.send_mode !== "later" || v.repeat === "NONE") return null;
    const parts = [`FREQ=${v.repeat}`];
    if (Number(v.repeat_interval) > 1) parts.push(`INTERVAL=${Number(v.repeat_interval)}`);
    if (v.repeat === "WEEKLY" && v.repeat_days.length) parts.push(`BYDAY=${v.repeat_days.join(",")}`);
    return parts.join(";");
}

function defaults(c?: CampaignDetail | null, channel: "EMAIL" | "SMS" = "EMAIL"): CampaignFormValues {
    return {
        name: c?.name ?? "",
        description: c?.description ?? "",
        channel: c?.channel ?? channel,
        audiences: c?.audiences.map((a) => ({ mode: a.mode, list_id: a.list_id ?? undefined, segment_id: a.segment_id ?? undefined })) ?? [],
        template_id: c?.template_id ?? "",
        subject: c?.subject ?? "",
        preheader: c?.preheader ?? "",
        body_html: c?.body_html ?? "",
        body_text: c?.body_text ?? "",
        sender_identity_id: c?.sender_identity_id ?? "",
        from_name: c?.from_name ?? "",
        reply_to_address: c?.reply_to_address ?? "",
        tracking_enabled: c?.tracking_enabled ?? true,
        require_consent: c?.require_consent ?? true,
        send_rate_per_hour: c?.send_rate_per_hour ? String(c.send_rate_per_hour) : "",
        topic_id: c?.topic_id ?? "none",
        schedule_timezone: c?.schedule_timezone ?? browserZone(),
        send_in_recipient_timezone: c?.send_in_recipient_timezone ?? false,
        ...parseRule(c?.recurrence_rule ?? null),
        repeat_until: c?.recurrence_ends_at ? c.recurrence_ends_at.slice(0, 10) : "",
        send_mode: c?.scheduled_at ? "later" : "now",
        scheduled_at: toLocalInput(c?.scheduled_at ?? null),
    };
}

function toInput(v: CampaignFormValues, creating: boolean): CampaignInput {
    const opt = (s?: string) => (s && s.trim() ? s : undefined);
    return {
        name: v.name,
        description: opt(v.description),
        ...(creating && { channel: v.channel }),
        audiences: v.audiences,
        template_id: opt(v.template_id),
        subject: v.channel === "EMAIL" ? v.subject ?? "" : undefined,
        preheader: v.channel === "EMAIL" ? v.preheader ?? "" : undefined,
        body_html: v.channel === "EMAIL" ? v.body_html ?? "" : undefined,
        body_text: v.channel === "SMS" ? v.body_text ?? "" : undefined,
        sender_identity_id: opt(v.sender_identity_id),
        from_name: opt(v.from_name),
        reply_to_address: opt(v.reply_to_address),
        tracking_enabled: v.tracking_enabled,
        require_consent: v.require_consent,
        send_rate_per_hour: v.send_rate_per_hour ? Number(v.send_rate_per_hour) : undefined,
        topic_id: v.topic_id && v.topic_id !== "none" ? v.topic_id : null,
        schedule_timezone: v.schedule_timezone,
        send_in_recipient_timezone: v.send_in_recipient_timezone,
        recurrence_rule: buildRule(v),
        recurrence_ends_at: v.repeat !== "NONE" && v.repeat_until ? new Date(`${v.repeat_until}T23:59:59`).toISOString() : null,
    };
}

/**
 * /campaigns/new and /campaigns/:id/edit — audience → content → schedule → review.
 * Each "Next" saves the draft (POST / PATCH /communications/campaigns). The review step runs the pre-send checks and
 * offers submit for approval (communications.campaigns.update), approve (…approve) and schedule / send now (…send).
 */
export default function CampaignWizardPage() {
    const { id: routeId } = useParams();
    const [sp] = useSearchParams();
    const navigate = useNavigate();
    const { can } = usePermissions();
    const [id, setId] = useState<string | undefined>(routeId);
    const [step, setStep] = useState(routeId ? Math.min(Number(sp.get("step") ?? 0), 3) : 0);
    const [preflight, setPreflight] = useState<PreflightResult | null>(null);
    const campaign = useCampaign(id);
    const create = useCreateCampaign();
    const update = useUpdateCampaign();
    const action = useCampaignAction();
    const form = useForm<CampaignFormValues>({ resolver: zodResolver(campaignFormSchema), defaultValues: defaults(null, sp.get("channel") === "SMS" ? "SMS" : "EMAIL") });

    const loadedId = campaign.data?.id;
    useEffect(() => {
        if (campaign.data && loadedId === routeId) form.reset(defaults(campaign.data));
        // Load once per campaign; later refetches must not overwrite unsaved edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadedId]);

    if (routeId && campaign.isPending) return <PageSkeleton />;
    if (routeId && campaign.error) return <Page><ErrorState error={campaign.error} onRetry={() => campaign.refetch()} /></Page>;
    if (campaign.data && !["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(campaign.data.status)) {
        return <Page><NoAccessState description="This campaign was already scheduled or sent and can no longer be edited. Duplicate it to send again." /></Page>;
    }

    const saving = create.isPending || update.isPending;
    const save = async (): Promise<CampaignDetail | null> => {
        const values = form.getValues();
        try {
            if (!id) {
                const c = await create.mutateAsync(toInput(values, true));
                setId(c.id);
                window.history.replaceState(null, "", CampaignPaths.edit(c.id));
                return c;
            }
            return await update.mutateAsync({ id, ...toInput(values, false) });
        } catch (e) {
            toast({ variant: "destructive", title: "Could not save the campaign", description: getApiErrorMessage(e) });
            return null;
        }
    };

    const next = async () => {
        if (!(await form.trigger(STEP_FIELDS[step]))) return;
        if (step === 0 && !form.getValues("audiences").some((a) => a.mode === "INCLUDE")) {
            form.setError("audiences", { message: "Include at least one list or segment" });
            return;
        }
        if (await save()) setStep((s) => Math.min(s + 1, 3));
    };

    const c = campaign.data;
    const values = form.watch();
    const approvalNeeded = !!(preflight?.approval_required && c?.status !== "APPROVED");
    const finish = (verb: "schedule" | "submit" | "approve") => {
        if (!c) return;
        const body = verb === "schedule"
            ? { ...(values.send_mode === "later" && values.scheduled_at ? { scheduled_at: new Date(values.scheduled_at).toISOString() } : {}), schedule_timezone: values.schedule_timezone }
            : {};
        action.mutate({ id: c.id, action: verb, body }, {
            onSuccess: () => {
                toast({ title: verb === "submit" ? "Submitted for approval" : verb === "approve" ? "Campaign approved" : values.send_mode === "now" ? "Sending started" : "Campaign scheduled" });
                if (verb !== "approve") navigate(CampaignPaths.detail(c.id));
            },
            onError: (e) => toast({ variant: "destructive", title: "Could not continue", description: getApiErrorMessage(e) }),
        });
    };

    return (
        <Page width="wide">
            <PageHeader
                title={c ? `Edit ${c.name}` : "New campaign"}
                back={{ to: c ? CampaignPaths.detail(c.id) : CampaignPaths.root, label: c ? "Campaign" : "Campaigns" }}
            />
            <ol className="mb-6 grid grid-cols-4 gap-2">
                {STEPS.map((label, i) => (
                    <li key={label}>
                        <button
                            type="button"
                            disabled={!id || i > step}
                            onClick={() => setStep(i)}
                            className={cn("flex w-full flex-col gap-1.5 text-left disabled:cursor-default", i <= step ? "text-foreground" : "text-muted-foreground")}
                        >
                            <span className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
                            <span className="flex items-center gap-1 text-xs font-medium">
                                {i < step && <Check className="size-3 text-success" />}
                                <span className="hidden sm:inline">{i + 1}.</span> {label}
                            </span>
                        </button>
                    </li>
                ))}
            </ol>
            <Form {...form}>
                <form onSubmit={(e) => { e.preventDefault(); void next(); }} className="space-y-6">
                    {step === 0 && (
                        <div className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Campaign name</FormLabel><FormControl><Input autoFocus placeholder="November newsletter" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="channel" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Channel</FormLabel>
                                        <FormControl>
                                            <RadioGroup value={field.value} onValueChange={field.onChange} disabled={!!id} className="flex h-8 items-center gap-4">
                                                {CommChannelFormOptions.map((o) => (
                                                    <label key={o.id} className="flex items-center gap-1.5 text-[13px] text-foreground">
                                                        <RadioGroupItem value={o.id} aria-label={o.label} /> {o.label}
                                                    </label>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                        {id && <FormDescription>Fixed after the first save.</FormDescription>}
                                    </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem><FormLabel>Internal note</FormLabel><FormControl><Textarea rows={2} placeholder="Goal, offer, who asked for it…" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <AudienceStep form={form} />
                        </div>
                    )}
                    {step === 1 && (
                        <div className="space-y-6">
                            <ContentStep form={form} />
                            <AiAssistant
                                channel={values.channel}
                                subject={values.subject ?? ""}
                                body={(values.channel === "EMAIL" ? values.body_html : values.body_text) ?? ""}
                                campaignId={c?.id}
                                onApply={(p) => (Object.entries(p) as [keyof typeof p, string | undefined][]).forEach(([k, v]) => v !== undefined && form.setValue(k, v, { shouldDirty: true }))}
                            />
                            {c && <AbTestSection key={c.id} campaign={c} />}
                        </div>
                    )}
                    {step === 2 && (
                        <div className="max-w-xl space-y-5">
                            <FormField control={form.control} name="send_mode" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>When</FormLabel>
                                    <FormControl>
                                        <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-2">
                                            <label className="flex items-center gap-2 text-[13px] text-foreground"><RadioGroupItem value="now" /> Send right after review</label>
                                            <label className="flex items-center gap-2 text-[13px] text-foreground"><RadioGroupItem value="later" /> Schedule for later</label>
                                        </RadioGroup>
                                    </FormControl>
                                </FormItem>
                            )} />
                            {values.send_mode === "later" && (
                                <FormField control={form.control} name="scheduled_at" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Send at (your local time)</FormLabel>
                                        <FormControl><Input type="datetime-local" className="w-full sm:w-64" {...field} value={field.value ?? ""} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}
                            <ScheduleOptions form={form} />
                            <FormField control={form.control} name="send_rate_per_hour" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Throttle (messages per hour)</FormLabel>
                                    <FormControl><Input inputMode="numeric" placeholder="No limit" className="w-full sm:w-40" {...field} value={field.value ?? ""} /></FormControl>
                                    <FormDescription>Spread large sends to protect your sender reputation.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="require_consent" render={({ field }) => (
                                <FormItem className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
                                    <div className="space-y-0.5">
                                        <FormLabel>Only contacts who opted in</FormLabel>
                                        <FormDescription>Skip CRM contacts without consent on this channel. Keep on for marketing.</FormDescription>
                                    </div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Require consent" /></FormControl>
                                </FormItem>
                            )} />
                            <TopicField form={form} />
                            {values.channel === "EMAIL" && (
                                <FormField control={form.control} name="tracking_enabled" render={({ field }) => (
                                    <FormItem className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
                                        <div className="space-y-0.5">
                                            <FormLabel>Track opens and clicks</FormLabel>
                                            <FormDescription>Adds an open pixel and rewrites links.</FormDescription>
                                        </div>
                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Track opens and clicks" /></FormControl>
                                    </FormItem>
                                )} />
                            )}
                        </div>
                    )}
                    {step === 3 && c && <ReviewStep campaign={c} values={values} onPreflight={setPreflight} />}

                    <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <Button type="button" variant="ghost" onClick={() => (step === 0 ? navigate(c ? CampaignPaths.detail(c.id) : CampaignPaths.root) : setStep(step - 1))} disabled={saving}>
                            <ChevronLeft /> {step === 0 ? "Cancel" : "Back"}
                        </Button>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {step < 3 && (
                                <>
                                    {id && <Button type="button" variant="outline" onClick={async () => { if (await form.trigger(STEP_FIELDS[step]) && await save()) toast({ title: "Draft saved" }); }} disabled={saving}>Save draft</Button>}
                                    <Button type="submit" loading={saving}>Next <ChevronRight /></Button>
                                </>
                            )}
                            {step === 3 && c && (
                                <>
                                    {approvalNeeded && c.status === "DRAFT" && can("communications.campaigns.update") && (
                                        <Button type="button" variant={can("communications.campaigns.approve") ? "outline" : "default"} onClick={() => finish("submit")} loading={action.isPending}><ShieldCheck /> Submit for approval</Button>
                                    )}
                                    {c.status === "PENDING_APPROVAL" && can("communications.campaigns.approve") && (
                                        <Button type="button" variant="outline" onClick={() => finish("approve")} loading={action.isPending}><ShieldCheck /> Approve</Button>
                                    )}
                                    {can("communications.campaigns.send") && (
                                        <Button type="button" onClick={() => finish("schedule")} loading={action.isPending} disabled={!preflight?.ok || approvalNeeded} title={approvalNeeded ? "Approval is required first" : undefined}>
                                            <Send /> {values.send_mode === "now" ? "Send now" : "Schedule"}
                                        </Button>
                                    )}
                                    {!can("communications.campaigns.send") && !approvalNeeded && <p className="text-xs text-muted-foreground sm:self-center">You can save drafts; someone with send permission sends it.</p>}
                                </>
                            )}
                        </div>
                    </div>
                </form>
            </Form>
        </Page>
    );
}
