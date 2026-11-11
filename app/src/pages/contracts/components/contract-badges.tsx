import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatMoney, initials, personName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ContractStatusFormOptions, ContractVersionStatusOptions } from "@/config/constants/dropdowns/contracts/contract-status.options";
import { SignatureRequestStatusFormOptions, SignerStatusOptions } from "@/config/constants/dropdowns/contracts/signature.options";
import { ObligationStatusFormOptions } from "@/config/constants/dropdowns/contracts/contract-obligation.options";
import { useContractLookup } from "@/features/contracts/hooks/use-contracts";
import type {
    ContractObligationStatus, ContractStatus, ContractVersionStatus, LookupItem, MemberRef, SignatureRequestStatus, SignerStatus,
} from "@/features/contracts/interfaces/contracts.interfaces";

const STATUS_TONE: Record<ContractStatus, BadgeVariant> = {
    DRAFT: "neutral", INTERNAL_REVIEW: "warning", CUSTOMER_REVIEW: "warning", APPROVAL_REQUIRED: "warning", READY_FOR_SIGNATURE: "info", PARTIALLY_SIGNED: "violet",
    FULLY_SIGNED: "success", ACTIVE: "success", EXPIRING: "warning", RENEWED: "info", SUPERSEDED: "neutral", TERMINATED: "danger", EXPIRED: "neutral", CANCELLED: "neutral", ARCHIVED: "neutral",
};
const VERSION_TONE: Record<ContractVersionStatus, BadgeVariant> = { DRAFT: "warning", IN_REVIEW: "warning", APPROVED: "info", LOCKED_FOR_SIGNATURE: "violet", SIGNED: "success", SUPERSEDED: "neutral" };
const REQUEST_TONE: Record<SignatureRequestStatus, BadgeVariant> = {
    NOT_SENT: "neutral", SENT: "info", DELIVERED: "info", VIEWED: "violet", PARTIALLY_SIGNED: "violet", FULLY_SIGNED: "success", DECLINED: "danger", EXPIRED: "neutral", CANCELLED: "neutral", FAILED: "danger",
};
const SIGNER_TONE: Record<SignerStatus, BadgeVariant> = { PENDING: "neutral", SENT: "info", DELIVERED: "info", VIEWED: "violet", SIGNED: "success", DECLINED: "danger", BOUNCED: "danger" };
const OBLIGATION_TONE: Record<ContractObligationStatus, BadgeVariant> = { OPEN: "info", IN_PROGRESS: "violet", FULFILLED: "success", OVERDUE: "danger", WAIVED: "neutral", CANCELLED: "neutral" };

export const ContractStatusBadge = ({ status }: { status: ContractStatus }) => <Badge variant={STATUS_TONE[status]} title={status}>{getDropdownOptionLabel(ContractStatusFormOptions, status)}</Badge>;
export const ContractVersionBadge = ({ status }: { status: ContractVersionStatus }) => <Badge variant={VERSION_TONE[status]} title={status}>{getDropdownOptionLabel(ContractVersionStatusOptions, status)}</Badge>;
export const SignatureStatusBadge = ({ status }: { status: SignatureRequestStatus }) => <Badge variant={REQUEST_TONE[status]} title={status}>{getDropdownOptionLabel(SignatureRequestStatusFormOptions, status)}</Badge>;
export const SignerStatusBadge = ({ status }: { status: SignerStatus }) => <Badge variant={SIGNER_TONE[status]} title={status}>{getDropdownOptionLabel(SignerStatusOptions, status)}</Badge>;
export const ObligationStatusBadge = ({ status, overdue }: { status: ContractObligationStatus; overdue?: boolean }) =>
    overdue && status !== "OVERDUE" ? <Badge variant="danger">Overdue</Badge> : <Badge variant={OBLIGATION_TONE[status]} title={status}>{getDropdownOptionLabel(ObligationStatusFormOptions, status)}</Badge>;

export function Member({ member, sub }: { member: MemberRef | null | undefined; sub?: string }) {
    if (!member?.user) return <span className="text-muted-foreground">—</span>;
    const name = personName(member.user);
    return (
        <span className="inline-flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">{initials(name)}</span>
            <span className="min-w-0">
                <span className="block truncate text-[13px] text-foreground">{name}</span>
                {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
            </span>
        </span>
    );
}

/** Contract value cell: hidden values (no contracts.confidential_terms.read) render as a lock note. */
export const contractValue = (value: string | number | null | undefined, currency: string | null | undefined, hidden?: boolean) =>
    hidden ? "Confidential" : value === null || value === undefined ? "—" : formatMoney(value, currency ?? "EUR");

interface PickerProps {
    kind: "members" | "companies" | "contacts" | "projects";
    value: string | null | undefined;
    valueLabel?: string | null;
    onChange: (id: string | null, item?: LookupItem) => void;
    placeholder?: string;
    companyId?: string | null;
    ariaLabel: string;
    clearable?: boolean;
    disabled?: boolean;
}

/** Searchable picker (Popover + Command) over GET /contracts/lookups/:kind. */
export function ContractLookupPicker({ kind, value, valueLabel, onChange, placeholder = "Select…", companyId, ariaLabel, clearable = true, disabled }: PickerProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const q = useContractLookup(kind, search, open || (!!value && !valueLabel), companyId ?? undefined);
    const items = q.data?.data ?? [];
    const label = items.find((i) => i.id === value)?.label ?? valueLabel;
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className="flex w-full items-center gap-1">
                <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={ariaLabel} disabled={disabled} className="h-9 w-full min-w-0 justify-between font-normal">
                        <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? (label ?? "Selected") : placeholder}</span>
                        <ChevronsUpDown className="size-3.5 opacity-50" />
                    </Button>
                </PopoverTrigger>
                {clearable && value && !disabled && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Clear ${ariaLabel}`} onClick={() => onChange(null)}><X /></Button>}
            </div>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Search…" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>{q.isFetching ? "Searching…" : "Nothing found"}</CommandEmpty>
                        <CommandGroup>
                            {items.map((i) => (
                                <CommandItem key={i.id} value={i.id} onSelect={() => { onChange(i.id, i); setOpen(false); }}>
                                    <Check className={cn("size-4", i.id === value ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{i.label}</span>
                                    {(i.sub || i.email) && <span className="ml-auto truncate text-xs text-muted-foreground">{i.sub ?? i.email}</span>}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
