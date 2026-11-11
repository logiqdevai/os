import { useState, type ReactNode } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EntityPicker } from "@/components/ui/entity-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { ClaimStatusOptions, LedgerPaymentStatusOptions, PeriodPresetOptions, PeriodStatusOptions, RecordStatusOptions, RecurringStatusOptions, ReportBasisOptions } from "@/config/constants/dropdowns/expenses/expenses.options";
import { useCompanyLookup, useProjectLookup } from "@/features/billing/hooks/use-billing";
import { useCategories } from "@/features/expenses/hooks/use-expenses";
import type { ExpenseClaimStatus, FinancialPeriodStatus, LedgerPaymentStatus, LedgerRecordStatus, LedgerRecordType, RecurringExpenseStatus } from "@/features/expenses/interfaces/expenses.interfaces";
import { presetRange } from "../utils/ranges";

const statusTone: Record<LedgerRecordStatus, BadgeVariant> = { DRAFT: "neutral", PENDING_REVIEW: "warning", POSTED: "success", VOIDED: "neutral" };
const payTone: Record<LedgerPaymentStatus, BadgeVariant> = { UNPAID: "info", PARTIALLY_PAID: "warning", PAID: "success", OVERDUE: "danger", CANCELLED: "neutral", REFUNDED: "neutral" };
const recTone: Record<RecurringExpenseStatus, BadgeVariant> = { ACTIVE: "success", PAUSED: "warning", ENDED: "neutral", CANCELLED: "neutral" };
const claimTone: Record<ExpenseClaimStatus, BadgeVariant> = { DRAFT: "neutral", SUBMITTED: "info", APPROVED: "success", REJECTED: "danger", PAID: "violet" };
const periodTone: Record<FinancialPeriodStatus, BadgeVariant> = { OPEN: "success", CLOSED: "warning", LOCKED: "neutral" };

export const RecordStatusBadge = ({ status }: { status: LedgerRecordStatus }) => <Badge variant={statusTone[status]} dot>{getDropdownOptionLabel(RecordStatusOptions, status)}</Badge>;
export const LedgerPaymentBadge = ({ status }: { status: LedgerPaymentStatus }) => <Badge variant={payTone[status]}>{getDropdownOptionLabel(LedgerPaymentStatusOptions, status)}</Badge>;
export const RecurringStatusBadge = ({ status }: { status: RecurringExpenseStatus }) => <Badge variant={recTone[status]} dot>{getDropdownOptionLabel(RecurringStatusOptions, status)}</Badge>;
export const ClaimStatusBadge = ({ status }: { status: ExpenseClaimStatus }) => <Badge variant={claimTone[status]} dot>{getDropdownOptionLabel(ClaimStatusOptions, status)}</Badge>;
export const PeriodStatusBadge = ({ status }: { status: FinancialPeriodStatus }) => <Badge variant={periodTone[status]} dot>{getDropdownOptionLabel(PeriodStatusOptions, status)}</Badge>;
export const TypeBadge = ({ type }: { type: LedgerRecordType }) => <Badge variant={type === "INCOME" ? "success" : "info"}>{type === "INCOME" ? "Income" : "Expense"}</Badge>;

/** Category picker (with subcategories indented in the label) for one record type. */
export function CategoryPicker({ kind, value, onChange, noneLabel = "Uncategorized" }: { kind: LedgerRecordType; value: string | null | undefined; onChange: (v: string | null) => void; noneLabel?: string }) {
    const cats = useCategories({ kind });
    const rows = cats.data ?? [];
    const items = rows.filter((c) => !c.parent_category_id).flatMap((p) => [
        { id: p.id, label: p.name },
        ...rows.filter((c) => c.parent_category_id === p.id).map((c) => ({ id: c.id, label: `${p.name} / ${c.name}`, keywords: p.name })),
    ]);
    return <EntityPicker items={items} value={value} onChange={onChange} placeholder={noneLabel} noneLabel={noneLabel} ariaLabel="Category" loading={cats.isFetching} />;
}

export function CompanyPicker({ value, onChange, placeholder = "No customer / supplier" }: { value: string | null | undefined; onChange: (v: string | null) => void; placeholder?: string }) {
    const [search, setSearch] = useState("");
    const q = useCompanyLookup(search);
    return <EntityPicker items={(q.data ?? []).map((c) => ({ id: c.id, label: c.name, hint: c.type?.toLowerCase() }))} value={value} onChange={onChange} onSearch={setSearch} loading={q.isFetching} placeholder={placeholder} noneLabel={placeholder} ariaLabel="Customer or supplier" emptyText={q.isError ? "You cannot read CRM companies" : "No companies found"} />;
}

export function ProjectPicker({ value, onChange }: { value: string | null | undefined; onChange: (v: string | null) => void }) {
    const [search, setSearch] = useState("");
    const q = useProjectLookup(search);
    return <EntityPicker items={(q.data ?? []).map((p) => ({ id: p.id, label: p.name }))} value={value} onChange={onChange} onSearch={setSearch} loading={q.isFetching} placeholder="No project" noneLabel="No project" ariaLabel="Project" emptyText={q.isError ? "Projects are not available to you" : "No projects found"} />;
}

/** Period preset + basis selectors used by the report pages (URL-driven by the parent). */
export function RangeBar({ preset, onPreset, basis, onBasis, children }: { preset: string; onPreset: (v: string) => void; basis?: string; onBasis?: (v: string) => void; children?: ReactNode }) {
    const r = presetRange(preset);
    return (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5 sm:w-48">
                <Label>Period</Label>
                <Select value={preset} onValueChange={onPreset}>
                    <SelectTrigger aria-label="Period"><SelectValue /></SelectTrigger>
                    <SelectContent>{PeriodPresetOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            {onBasis && (
                <div className="space-y-1.5 sm:w-48">
                    <Label>Basis</Label>
                    <Select value={basis ?? "ACCRUAL"} onValueChange={onBasis}>
                        <SelectTrigger aria-label="Basis"><SelectValue /></SelectTrigger>
                        <SelectContent>{ReportBasisOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            )}
            {children}
            <p className="text-xs text-muted-foreground sm:pb-2">{r.from} – {r.to}</p>
        </div>
    );
}
