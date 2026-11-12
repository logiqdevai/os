import { useState } from "react";
import { FlaskConical, Trophy } from "lucide-react";
import { Section } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useCampaignVariants, usePickCampaignWinner } from "@/features/communications/hooks/use-campaign-variants";
import type { CampaignDetail, CampaignVariant } from "@/features/communications/interfaces/communications.interfaces";
import { CampaignAbMetricOptions } from "@/config/constants/dropdowns/communications/campaign-ab.options";
import { pct } from "../../../components/comm-badges";

/**
 * A/B results of a campaign: per-variant sent / open / click rates, the test window and the winner.
 * @perm read communications.campaigns.read · pick winner communications.campaigns.send (sensitive)
 * @api GET /communications/campaigns/:id/variants · POST /communications/campaigns/:id/variants/:variantId/winner
 */
export function AbResults({ campaign }: { campaign: CampaignDetail }) {
    const live = campaign.status === "SENDING" || campaign.status === "PAUSED";
    const data = useCampaignVariants(campaign.id, live);
    const pick = usePickCampaignWinner();
    const canSend = usePermission("communications.campaigns.send");
    const [choosing, setChoosing] = useState<CampaignVariant | null>(null);
    const v = data.data;
    const canPick = canSend && live && !!v && !v.ab_winner_selected_at && v.holdout_count > 0;
    const metric = v?.ab_metric ?? "OPEN";

    const columns: DataTableColumn<CampaignVariant>[] = [
        {
            key: "label",
            header: "Variant",
            cell: (x) => (
                <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                        {x.label} {x.is_winner && <Badge variant="success"><Trophy className="size-3" /> Winner</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{x.subject ?? campaign.subject ?? (x.body_text ?? "").slice(0, 80)}</div>
                </div>
            ),
        },
        { key: "share", header: "Share", cell: (x) => <span className="tabular text-muted-foreground">{x.share_percent ?? "—"}%</span>, hideBelow: "md" },
        { key: "sent", header: "Sent", cell: (x) => <span className="tabular">{formatNumber(x.sent_count)}</span> },
        { key: "open", header: "Open rate", cell: (x) => <span className={metric === "OPEN" ? "tabular font-medium text-foreground" : "tabular text-muted-foreground"}>{pct(x.open_rate)}</span> },
        { key: "click", header: "Click rate", cell: (x) => <span className={metric === "CLICK" ? "tabular font-medium text-foreground" : "tabular text-muted-foreground"}>{pct(x.click_rate)}</span>, hideBelow: "sm" },
        {
            key: "pick",
            header: <span className="sr-only">Pick</span>,
            className: "w-28",
            cell: (x) => canPick && <Button size="sm" variant="outline" onClick={() => setChoosing(x)}>Pick winner</Button>,
        },
    ];

    const description = !v
        ? undefined
        : v.ab_winner_selected_at
            ? `Winner picked ${formatDateTime(v.ab_winner_selected_at)} by ${getDropdownOptionLabel(CampaignAbMetricOptions, metric).toLowerCase()}.`
            : v.winner_decides_at
                ? `Test group ${v.ab_test_percent ?? 100}% · the best ${getDropdownOptionLabel(CampaignAbMetricOptions, metric).toLowerCase()} wins at ${formatDateTime(v.winner_decides_at)} · ${formatNumber(v.holdout_count)} waiting for the winner.`
                : `Test group ${v.ab_test_percent ?? 100}% · winner by ${getDropdownOptionLabel(CampaignAbMetricOptions, metric).toLowerCase()} after ${v.ab_wait_hours ?? 4} h.`;

    return (
        <Section title={<span className="flex items-center gap-2"><FlaskConical className="size-4 text-muted-foreground" /> A/B test</span>} description={description}>
            <DataTable
                columns={columns}
                data={v?.variants}
                rowKey={(x) => x.id}
                loading={data.isFetching && !v}
                error={data.error}
                onRetry={() => data.refetch()}
                empty={{ icon: FlaskConical, title: "No variants", description: "Add variants in the content step of the campaign." }}
            />
            <ConfirmationDialog
                isOpen={!!choosing}
                onClose={() => setChoosing(null)}
                title={`Send variant ${choosing?.label} to everyone else?`}
                description={`The test ends now and ${formatNumber(v?.holdout_count ?? 0)} remaining recipient(s) get variant ${choosing?.label}.`}
                confirmText="Pick winner"
                isLoading={pick.isPending}
                onConfirm={() =>
                    choosing &&
                    pick.mutate({ id: campaign.id, variantId: choosing.id }, {
                        onSuccess: () => { toast({ title: `Variant ${choosing.label} is the winner` }); setChoosing(null); },
                        onError: (e) => toast({ variant: "destructive", title: "Could not pick the winner", description: getApiErrorMessage(e) }),
                    })
                }
            />
        </Section>
    );
}
