import { useEffect, useState } from "react";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { useUpdateCampaign } from "@/features/communications/hooks/use-communications";
import { useSetCampaignVariants } from "@/features/communications/hooks/use-campaign-variants";
import type { CampaignAbMetric, CampaignDetail, CampaignVariantInput } from "@/features/communications/interfaces/communications.interfaces";
import { CampaignAbMetricOptions, CampaignAbTestPercentOptions, CampaignAbWaitOptions } from "@/config/constants/dropdowns/communications/campaign-ab.options";

const LABELS = ["A", "B", "C", "D", "E"];

type Draft = { subject: string; preheader: string; body: string; share: string };

const fromCampaign = (c: CampaignDetail): Draft[] =>
    c.variants.map((v) => ({ subject: v.subject ?? "", preheader: v.preheader ?? "", body: (c.channel === "EMAIL" ? v.body_html : v.body_text) ?? "", share: v.share_percent ? String(v.share_percent) : "" }));

/**
 * A/B test of a draft campaign (11 "Marketing Campaigns"): 2–5 variants of subject / content, the share of the audience in
 * the test, the winning metric and the test window. Empty variant fields fall back to the main content.
 * @perm communications.campaigns.update
 * @api PUT /communications/campaigns/:id/variants · PATCH /communications/campaigns/:id (ab_metric, ab_test_percent, ab_wait_hours)
 */
export function AbTestSection({ campaign }: { campaign: CampaignDetail }) {
    const canEdit = usePermission("communications.campaigns.update");
    const setVariants = useSetCampaignVariants();
    const update = useUpdateCampaign();
    const [enabled, setEnabled] = useState(campaign.ab_test_enabled);
    const [metric, setMetric] = useState<CampaignAbMetric>(campaign.ab_metric ?? "OPEN");
    const [percent, setPercent] = useState(String(campaign.ab_test_percent ?? 20));
    const [wait, setWait] = useState(String(campaign.ab_wait_hours ?? 4));
    const [drafts, setDrafts] = useState<Draft[]>(() => fromCampaign(campaign));
    const recurring = !!campaign.recurrence_rule;
    const email = campaign.channel === "EMAIL";

    useEffect(() => {
        if (enabled && drafts.length < 2) setDrafts((d) => [...d, ...Array.from({ length: 2 - d.length }, () => ({ subject: "", preheader: "", body: "", share: "" }))]);
    }, [enabled, drafts.length]);

    const patch = (i: number, key: keyof Draft, value: string) => setDrafts((d) => d.map((x, idx) => (idx === i ? { ...x, [key]: value } : x)));
    const saving = setVariants.isPending || update.isPending;

    const save = async () => {
        const variants: CampaignVariantInput[] = enabled
            ? drafts.map((d) => ({
                subject: email ? d.subject || null : null,
                preheader: email ? d.preheader || null : null,
                body_html: email ? d.body || null : null,
                body_text: email ? null : d.body || null,
                share_percent: d.share ? Number(d.share) : null,
            }))
            : [];
        try {
            if (enabled) await update.mutateAsync({ id: campaign.id, ab_metric: metric, ab_test_percent: Number(percent), ab_wait_hours: Number(wait) });
            await setVariants.mutateAsync({ id: campaign.id, variants });
            toast({ title: enabled ? "A/B test saved" : "A/B test turned off" });
        } catch (e) {
            toast({ variant: "destructive", title: "Could not save the A/B test", description: getApiErrorMessage(e) });
        }
    };

    return (
        <section className="space-y-4 rounded-lg border border-border bg-card p-4" aria-labelledby="ab-title">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                    <h3 id="ab-title" className="flex items-center gap-2 text-sm font-medium text-foreground"><FlaskConical className="size-4 text-muted-foreground" /> A/B test</h3>
                    <p className="text-[13px] text-muted-foreground">
                        {recurring ? "Not available for recurring campaigns." : "Send variants to part of the audience, then the best one to everyone else."}
                    </p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!canEdit || recurring} aria-label="A/B test" />
            </div>
            {enabled && (
                <>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label>Winner by</Label>
                            <Select value={metric} onValueChange={(v) => setMetric(v as CampaignAbMetric)} disabled={!canEdit}>
                                <SelectTrigger aria-label="Winner metric"><SelectValue /></SelectTrigger>
                                <SelectContent>{CampaignAbMetricOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Test group</Label>
                            <Select value={percent} onValueChange={setPercent} disabled={!canEdit}>
                                <SelectTrigger aria-label="Test group size"><SelectValue /></SelectTrigger>
                                <SelectContent>{CampaignAbTestPercentOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Pick the winner after</Label>
                            <Select value={wait} onValueChange={setWait} disabled={!canEdit || percent === "100"}>
                                <SelectTrigger aria-label="Test window"><SelectValue /></SelectTrigger>
                                <SelectContent>{CampaignAbWaitOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {drafts.map((d, i) => (
                            <div key={i} className="space-y-3 rounded-md border border-border p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-foreground">Variant {LABELS[i]}</span>
                                    <div className="flex items-center gap-2">
                                        <Input className="h-8 w-20" inputMode="numeric" placeholder="auto %" value={d.share} onChange={(e) => patch(i, "share", e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label={`Share of variant ${LABELS[i]} (%)`} disabled={!canEdit} />
                                        {drafts.length > 2 && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove variant ${LABELS[i]}`} onClick={() => setDrafts(drafts.filter((_, idx) => idx !== i))} disabled={!canEdit}><Trash2 /></Button>}
                                    </div>
                                </div>
                                {email && (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <Input placeholder="Subject (empty = main subject)" value={d.subject} onChange={(e) => patch(i, "subject", e.target.value)} aria-label={`Subject of variant ${LABELS[i]}`} disabled={!canEdit} maxLength={300} />
                                        <Input placeholder="Preheader (optional)" value={d.preheader} onChange={(e) => patch(i, "preheader", e.target.value)} aria-label={`Preheader of variant ${LABELS[i]}`} disabled={!canEdit} maxLength={300} />
                                    </div>
                                )}
                                <Textarea rows={3} className="font-mono text-xs" placeholder={email ? "HTML body (empty = main content)" : "SMS text (empty = main text)"} value={d.body} onChange={(e) => patch(i, "body", e.target.value)} aria-label={`Content of variant ${LABELS[i]}`} disabled={!canEdit} />
                            </div>
                        ))}
                    </div>
                </>
            )}
            {canEdit && (
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    {enabled && drafts.length < 5 ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => setDrafts([...drafts, { subject: "", preheader: "", body: "", share: "" }])}><Plus /> Add variant</Button>
                    ) : <span />}
                    {(enabled || campaign.ab_test_enabled) && <Button type="button" size="sm" onClick={save} loading={saving}>Save A/B test</Button>}
                </div>
            )}
        </section>
    );
}
