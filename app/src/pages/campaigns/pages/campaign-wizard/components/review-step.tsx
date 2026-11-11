import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Info, RefreshCw, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { KeyValueList, Section } from "@/components/ui/page";
import { ErrorState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { AudienceExclusionReasonOptions, CommMessageStatusFormOptions } from "@/config/constants/dropdowns/communications/comm-message-status-filter.options";
import { usePreflight, useTestSend } from "@/features/communications/hooks/use-communications";
import type { CampaignDetail, PreflightResult } from "@/features/communications/interfaces/communications.interfaces";
import type { CampaignFormValues } from "@/features/communications/validation-schemas/communications.schema";

const ICON = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;
const TONE = { error: "text-danger", warning: "text-warning", info: "text-info" } as const;

/** Step 4 — pre-send checks (POST /:id/preflight), audience counts and a test send. */
export function ReviewStep({ campaign, values, onPreflight }: { campaign: CampaignDetail; values: CampaignFormValues; onPreflight: (r: PreflightResult | null) => void }) {
    const preflight = usePreflight();
    const test = useTestSend();
    const canUpdate = usePermission("communications.campaigns.update");
    const [testTo, setTestTo] = useState("");
    const { mutate } = preflight;
    const run = () => mutate(campaign.id, { onSuccess: onPreflight, onError: () => onPreflight(null) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(run, [campaign.id, campaign.updated_at]);

    const r = preflight.data;
    const sendTest = () => {
        const addresses = testTo.split(/[,\s]+/).filter(Boolean).slice(0, 5);
        if (!addresses.length) return;
        test.mutate({ id: campaign.id, addresses }, {
            onSuccess: ({ results }) => {
                const failed = results.filter((x) => !["SENT", "DELIVERED"].includes(x.status));
                if (failed.length) toast({ variant: "destructive", title: "Test not sent", description: failed.map((f) => `${f.address}: ${f.reason ?? getDropdownOptionLabel(CommMessageStatusFormOptions, f.status)}`).join(" · ") });
                else toast({ title: `Test sent to ${results.length} address${results.length === 1 ? "" : "es"}` });
            },
            onError: (e) => toast({ variant: "destructive", title: "Could not send test", description: getApiErrorMessage(e) }),
        });
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-6">
                <Section title="Summary">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <KeyValueList
                            items={[
                                { label: "Name", value: campaign.name },
                                { label: "Channel", value: campaign.channel === "EMAIL" ? "Email" : "SMS" },
                                { label: campaign.channel === "EMAIL" ? "Subject" : "Message", value: campaign.channel === "EMAIL" ? campaign.subject : campaign.body_text?.slice(0, 120) },
                                { label: "From", value: campaign.sender_identity ? campaign.sender_identity.address : "Provider default" },
                                { label: "Audience", value: campaign.audiences.map((a) => `${a.mode === "EXCLUDE" ? "− " : ""}${a.list?.name ?? a.segment?.name}`).join(", ") || "—" },
                                { label: "When", value: values.send_mode === "now" ? "Immediately" : formatDateTime(values.scheduled_at) },
                            ]}
                        />
                    </div>
                </Section>
                <Section title="Pre-send checks" actions={<Button variant="ghost" size="sm" onClick={run} loading={preflight.isPending}><RefreshCw /> Re-check</Button>}>
                    {preflight.isPending && !r ? (
                        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                    ) : preflight.error ? (
                        <ErrorState error={preflight.error} onRetry={run} />
                    ) : r && (
                        <ul className="divide-y divide-border-soft rounded-lg border border-border bg-card">
                            {r.issues.length === 0 && (
                                <li className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-foreground"><CircleCheck className="size-4 text-success" /> Everything looks good.</li>
                            )}
                            {r.issues.map((i, n) => {
                                const Icon = ICON[i.severity];
                                return (
                                    <li key={n} className="flex items-start gap-2 px-3 py-2.5 text-[13px] text-foreground">
                                        <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[i.severity]}`} />
                                        {i.message}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Section>
            </div>
            <div className="min-w-0 space-y-6">
                <Section title="Recipients">
                    <div className="rounded-lg border border-border bg-card p-4">
                        {r?.counts ? (
                            <div className="space-y-3">
                                <div>
                                    <div className="text-2xl font-medium text-foreground tabular">{formatNumber(r.counts.included)}</div>
                                    <div className="text-xs text-muted-foreground">will receive the campaign</div>
                                </div>
                                {r.counts.excluded > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(r.counts.by_reason).map(([k, v]) => (
                                            <Badge key={k} variant="neutral">{getDropdownOptionLabel(AudienceExclusionReasonOptions, k)}: {formatNumber(v)}</Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Skeleton className="h-12 w-full" />
                        )}
                    </div>
                </Section>
                {canUpdate && (
                    <Section title="Send a test" description="Up to 5 addresses, rendered with sample data. Tests are not counted.">
                        <div className="flex gap-2">
                            <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={campaign.channel === "EMAIL" ? "you@agency.com" : "+306912345678"} aria-label="Test recipients" />
                            <Button variant="outline" onClick={sendTest} loading={test.isPending} disabled={!testTo.trim()}><Send /> Send</Button>
                        </div>
                    </Section>
                )}
            </div>
        </div>
    );
}
