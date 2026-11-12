import { useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { SaveStatus } from "@/components/ui/save-status";
import { formatMoney } from "@/lib/format";
import { BillingFrequencyFormOptions } from "@/config/constants/dropdowns/proposals/proposal-content.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { useVersionAutosave } from "@/features/proposals/hooks/use-version-autosave";
import type { BillingFrequency, LineItemInput, ProposalDetail } from "@/features/proposals/interfaces/proposals.interfaces";
import { TotalsCard } from "./totals-card";

interface Row {
    key: string;
    group_name: string;
    name: string;
    description: string;
    quantity: string;
    unit: string;
    unit_price: string;
    discount_percent: string;
    tax_percent: string;
    is_optional: boolean;
    is_recurring: boolean;
    billing_frequency: BillingFrequency;
    product_id: string | null;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(Number(v)));
const toRows = (p: ProposalDetail): Row[] =>
    (p.version?.line_items ?? []).map((l) => ({
        key: l.id,
        group_name: l.group_name ?? "",
        name: l.name,
        description: l.description ?? "",
        quantity: str(l.quantity),
        unit: l.unit ?? "",
        unit_price: str(l.unit_price),
        discount_percent: l.discount_percent === null ? "" : str(l.discount_percent),
        tax_percent: l.tax_percent === null ? "" : str(l.tax_percent),
        is_optional: l.is_optional,
        is_recurring: l.is_recurring,
        billing_frequency: l.billing_frequency ?? "monthly",
        product_id: l.product_id,
    }));
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const toInput = (r: Row): LineItemInput => ({
    product_id: r.product_id,
    group_name: r.group_name || null,
    name: r.name.trim(),
    description: r.description || null,
    quantity: num(r.quantity) ?? 0,
    unit: r.unit || null,
    unit_price: num(r.unit_price) ?? 0,
    discount_percent: num(r.discount_percent),
    tax_percent: num(r.tax_percent),
    is_optional: r.is_optional,
    is_recurring: r.is_recurring,
    billing_frequency: r.is_recurring ? r.billing_frequency : null,
});
/** Display-only estimate of a line while editing; the saved amounts always come from the API. */
const lineNet = (r: Row) => {
    const base = (num(r.quantity) ?? 0) * (num(r.unit_price) ?? 0);
    return base - (base * (num(r.discount_percent) ?? 0)) / 100;
};

const isInvalid = (rows: Row[]) => rows.some((r) => !r.name.trim() || num(r.quantity) === null || Number.isNaN(num(r.quantity)) || Number.isNaN(num(r.unit_price) ?? 0));

/**
 * Pricing builder: editable line items that autosave (no Save / Discard); the API recalculates the totals after each
 * save. Incomplete lines are not sent until they are valid.
 */
export function PricingEditor({ proposal, editable, onDirtyChange }: { proposal: ProposalDetail; editable: boolean; onDirtyChange: (d: boolean) => void }) {
    const { draft: rows, setDraft: setRows, autosave, dirty } = useVersionAutosave({
        proposal, editable, toDraft: toRows, toPayload: (all: Row[]) => ({ line_items: all.map(toInput) }), valid: (all) => !isInvalid(all),
    });
    const invalid = isInvalid(rows);
    const v = proposal.version!;

    useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

    const set = (key: string, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    const add = () =>
        setRows((all) => [
            ...all,
            { key: `new-${Date.now()}`, group_name: all.at(-1)?.group_name ?? "", name: "", description: "", quantity: "1", unit: "", unit_price: "0", discount_percent: "", tax_percent: all.at(-1)?.tax_percent ?? "", is_optional: false, is_recurring: false, billing_frequency: "monthly", product_id: null },
        ]);

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-[13px] font-medium text-foreground">Line items</span>
                    {editable && <Button size="sm" variant="ghost" onClick={add}><Plus /> Add line</Button>}
                </div>
                {rows.length === 0 ? (
                    <EmptyState compact title="No line items" description="Add the work, products and recurring services you are quoting." action={editable ? <Button size="sm" onClick={add}><Plus /> Add line</Button> : undefined} />
                ) : editable ? (
                    <div className="overflow-x-auto">
                        <Table className="min-w-[860px]">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-[30%] text-xs">Item</TableHead>
                                    <TableHead className="w-20 text-right text-xs">Qty</TableHead>
                                    <TableHead className="w-24 text-xs">Unit</TableHead>
                                    <TableHead className="w-28 text-right text-xs">Unit price</TableHead>
                                    <TableHead className="w-20 text-right text-xs">Disc. %</TableHead>
                                    <TableHead className="w-20 text-right text-xs">Tax %</TableHead>
                                    <TableHead className="w-40 text-xs">Options</TableHead>
                                    <TableHead className="w-28 text-right text-xs">Net</TableHead>
                                    <TableHead className="w-10" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((r) => (
                                    <TableRow key={r.key} className="align-top">
                                        <TableCell className="space-y-1 py-2">
                                            <Input aria-label="Item name" placeholder="Item" value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} className="h-8" />
                                            <Input aria-label="Group" placeholder="Group (optional)" value={r.group_name} onChange={(e) => set(r.key, { group_name: e.target.value })} className="h-7 text-xs" />
                                        </TableCell>
                                        <TableCell className="py-2"><Input aria-label="Quantity" inputMode="decimal" value={r.quantity} onChange={(e) => set(r.key, { quantity: e.target.value })} className="h-8 text-right" /></TableCell>
                                        <TableCell className="py-2"><Input aria-label="Unit" placeholder="day" value={r.unit} onChange={(e) => set(r.key, { unit: e.target.value })} className="h-8" /></TableCell>
                                        <TableCell className="py-2"><Input aria-label="Unit price" inputMode="decimal" value={r.unit_price} onChange={(e) => set(r.key, { unit_price: e.target.value })} className="h-8 text-right" /></TableCell>
                                        <TableCell className="py-2"><Input aria-label="Discount percent" inputMode="decimal" placeholder="0" value={r.discount_percent} onChange={(e) => set(r.key, { discount_percent: e.target.value })} className="h-8 text-right" /></TableCell>
                                        <TableCell className="py-2"><Input aria-label="Tax percent" inputMode="decimal" placeholder="0" value={r.tax_percent} onChange={(e) => set(r.key, { tax_percent: e.target.value })} className="h-8 text-right" /></TableCell>
                                        <TableCell className="space-y-1.5 py-2 text-[12.5px]">
                                            <label className="flex items-center gap-2"><Checkbox checked={r.is_optional} onCheckedChange={(c) => set(r.key, { is_optional: c === true })} /> Optional</label>
                                            <label className="flex items-center gap-2"><Checkbox checked={r.is_recurring} onCheckedChange={(c) => set(r.key, { is_recurring: c === true })} /> Recurring</label>
                                            {r.is_recurring && (
                                                <Select value={r.billing_frequency} onValueChange={(f) => set(r.key, { billing_frequency: f as BillingFrequency })}>
                                                    <SelectTrigger className="h-7" aria-label="Billing frequency"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{BillingFrequencyFormOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-3 text-right tabular text-[13px]">{formatMoney(lineNet(r), proposal.currency)}</TableCell>
                                        <TableCell className="py-2"><Button variant="ghost" size="icon-sm" aria-label="Remove line" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}><Trash2 /></Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {v.line_items.map((l) => (
                            <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
                                <div className="min-w-0">
                                    <div className="text-[13px] font-medium text-foreground">{l.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {Number(l.quantity)} {l.unit ?? "×"} · {formatMoney(l.unit_price, proposal.currency)}
                                        {l.discount_percent ? ` · −${Number(l.discount_percent)}%` : ""}
                                        {l.tax_percent ? ` · tax ${Number(l.tax_percent)}%` : ""}
                                        {l.is_optional ? (l.selected_by_customer ? " · optional, selected" : " · optional") : ""}
                                        {l.is_recurring ? ` · ${getDropdownOptionLabel(BillingFrequencyFormOptions, l.billing_frequency ?? "monthly").toLowerCase()}` : ""}
                                    </div>
                                </div>
                                <span className="tabular text-[13px] text-foreground">{formatMoney(l.net_amount, proposal.currency)}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {editable && (
                    <div className="flex min-h-9 items-center justify-end gap-2 border-t border-border px-3 py-2">
                        {invalid && <span className="mr-auto text-xs text-warning">Every line needs a name, quantity and price to be saved</span>}
                        <SaveStatus state={autosave} />
                    </div>
                )}
            </div>
            <TotalsCard proposal={proposal} />
        </div>
    );
}
