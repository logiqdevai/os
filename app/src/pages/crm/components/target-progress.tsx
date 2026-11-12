import { Link } from "react-router-dom";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Can } from "@/components/access/can";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { TargetMetricOptions, TargetPeriodOptions } from "@/config/constants/dropdowns/crm/crm-rules.options";
import { useTargetAttainment } from "@/features/crm/rules/hooks/use-rules";
import type { SalesTarget } from "@/features/crm/rules/interfaces/rules.interfaces";
import { CrmPaths } from "../crm-paths";
import { memberLabel, Panel } from "./crm-ui";

export const targetLabel = (t: SalesTarget) => (t.owner ? memberLabel(t.owner) : t.team ? t.team.name : "Organization");

/** Ahead of pace = success, within 15 points = warning, else danger. */
export const paceTone = (t: SalesTarget): "success" | "warning" | "danger" | "default" => {
    if (t.attainment_percent === null) return "default";
    if (t.attainment_percent >= 100 || t.attainment_percent >= t.elapsed_percent) return "success";
    return t.elapsed_percent - t.attainment_percent <= 15 ? "warning" : "danger";
};

const amountText = (t: SalesTarget, v: number | null) => (t.metric === "DEALS_WON" ? formatNumber(v ?? 0) : v === null ? "—" : formatMoney(v, t.currency, { compact: true }));

/** One target row: who, metric, actual / goal, bar with a pace marker. */
export function TargetRow({ t, actions }: { t: SalesTarget; actions?: React.ReactNode }) {
    const tone = paceTone(t);
    return (
        <div className="min-w-0 py-2.5">
            <div className="flex items-start justify-between gap-2 text-[13px]">
                <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{targetLabel(t)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                        {getDropdownOptionLabel(TargetMetricOptions, t.metric)} · {getDropdownOptionLabel(TargetPeriodOptions, t.period)} {formatDate(t.period_start, t.period === "YEAR" ? "yyyy" : "MMM yyyy")}{t.pipeline ? ` · ${t.pipeline.name}` : ""}
                    </div>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                    <div className="text-right">
                        <div className="font-medium text-foreground tabular">{t.attainment_percent === null ? "—" : `${t.attainment_percent}%`}</div>
                        <div className="text-xs text-muted-foreground tabular">{amountText(t, t.actual)} / {amountText(t, t.amount)}</div>
                    </div>
                    {actions}
                </div>
            </div>
            <div className="relative mt-1.5">
                <ProgressBar value={t.attainment_percent ?? 0} tone={tone} />
                <span className="absolute -top-0.5 h-2.5 w-px bg-foreground/50" style={{ left: `${Math.min(100, t.elapsed_percent)}%` }} title={`${t.elapsed_percent}% of the period has passed`} aria-hidden />
            </div>
        </div>
    );
}

/**
 * Dashboard widget: targets active today with attainment (02 §11, §32).
 * @perm crm.targets.read (widget hidden without it) · amounts crm.financials.read
 * @api GET /crm/targets/attainment?owner=
 */
export function TargetsPanel({ owner }: { owner?: string }) {
    const q = useTargetAttainment({ owner: owner === "me" ? "me" : undefined });
    return (
        <Panel title="Targets" actions={<Button variant="ghost" size="sm" asChild><Link to={CrmPaths.targets}>All targets</Link></Button>} bodyClassName="py-1">
            {q.isPending ? <ListSkeleton rows={3} className="p-0" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data.targets.length ? (
                <EmptyState compact icon={Target} title="No targets for this period" action={<Can permission="crm.targets.manage"><Button size="sm" variant="outline" asChild><Link to={CrmPaths.targets}>Set targets</Link></Button></Can>} />
            ) : (
                <div className="divide-y divide-border-soft">{q.data.targets.slice(0, 6).map((t) => <TargetRow key={t.id} t={t} />)}</div>
            )}
        </Panel>
    );
}
