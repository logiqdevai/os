import { formatMoney } from "@/lib/format";
import type { ProposalDetail } from "@/features/proposals/interfaces/proposals.interfaces";

/** Version totals as computed by the API (never in the client). */
export function TotalsCard({ proposal }: { proposal: ProposalDetail }) {
    const v = proposal.version!;
    const c = proposal.currency;
    const row = (label: string, value: string, strong = false) => (
        <div className="flex items-center justify-between gap-3 py-1 text-[13px]">
            <span className="text-muted-foreground">{label}</span>
            <span className={strong ? "font-medium text-foreground tabular" : "text-foreground tabular"}>{value}</span>
        </div>
    );
    return (
        <div className="h-fit rounded-lg border border-border bg-card p-4">
            <div className="mb-2 text-[13px] font-medium text-foreground">Totals · v{v.version_number}</div>
            {row("Net subtotal", formatMoney(v.net_total, c))}
            {Number(v.discount_total) > 0 && row("Discounts", `−${formatMoney(v.discount_total, c)}`)}
            {row("Tax", formatMoney(v.tax_total, c))}
            <div className="my-1 border-t border-border" />
            {row("Total (gross)", formatMoney(v.gross_total, c), true)}
            {Number(v.recurring_monthly) > 0 && row("Recurring", `${formatMoney(v.recurring_monthly, c)} / month`)}
            {v.optional_total > 0 && row("Optional, not included", formatMoney(v.optional_total, c))}
        </div>
    );
}
