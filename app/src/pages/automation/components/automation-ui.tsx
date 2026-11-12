import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Copy } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatDateTime, personName } from "@/lib/format";
import type { ScheduledJob } from "@/features/automation/interfaces/automation.interfaces";
import { cn } from "@/lib/utils";
import { useMembers } from "@/features/admin/members/hooks/use-members";
import {
    DeliveryStatusOptions, JobRunStatusOptions, JobStatusOptions, OutboundWebhookStatusOptions, RuleStatusFormOptions, RunModeFormOptions, RunStatusFormOptions,
    StepStatusOptions, ApprovalDecisionOptions, InboundWebhookStatusOptions,
} from "@/config/constants/dropdowns/automation/automation.options";

/** Status colour per enum value (semantic tokens only). Same map everywhere so a status always looks the same. */
const TONE: Record<string, BadgeVariant> = {
    SUCCEEDED: "success", FAILED: "danger", DEAD_LETTERED: "danger", TIMED_OUT: "danger", RUNNING: "info", WAITING: "warning",
    AWAITING_APPROVAL: "violet", RETRY_SCHEDULED: "warning", PENDING: "neutral", SKIPPED: "neutral", CANCELLED: "neutral",
    PUBLISHED: "success", DRAFT: "warning", ARCHIVED: "neutral", ACTIVE: "success", PAUSED: "warning", DISABLED: "neutral", COMPLETED: "info",
    REVOKED: "danger", APPROVED: "success", REJECTED: "danger", EXPIRED: "neutral", LIVE: "neutral", TEST: "info", DRY_RUN: "violet",
};

const LABELS = [
    ...RunStatusFormOptions, ...StepStatusOptions, ...RuleStatusFormOptions, ...RunModeFormOptions, ...DeliveryStatusOptions, ...JobStatusOptions,
    ...JobRunStatusOptions, ...OutboundWebhookStatusOptions, ...InboundWebhookStatusOptions, ...ApprovalDecisionOptions,
];

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
    if (!status) return <span className="text-muted-foreground">—</span>;
    return (
        <Badge variant={TONE[status] ?? "neutral"} dot className={className}>
            {getDropdownOptionLabel(LABELS, status)}
        </Badge>
    );
}

/** Copy to the clipboard; `copied` is true for 1.5 s so the button itself shows the result (no toast). */
function useCopy() {
    const [copied, setCopied] = useState(false);
    const copy = (text: string) =>
        void navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    return { copied, copy };
}

/** Read-only JSON block (payloads, step inputs/outputs). Long payloads scroll inside the block, never the page. */
export function JsonBlock({ value, className, maxHeight = "max-h-80" }: { value: unknown; className?: string; maxHeight?: string }) {
    const text = useMemo(() => (value === undefined ? "" : JSON.stringify(value, null, 2)), [value]);
    const { copied, copy } = useCopy();
    if (value === undefined || value === null) return <p className="text-xs text-muted-foreground">Empty</p>;
    return (
        <div className={cn("relative", className)}>
            <pre className={cn("overflow-auto rounded-md border border-border bg-secondary p-3 font-mono text-xs leading-relaxed text-foreground", maxHeight)}>{text}</pre>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1.5 top-1.5"
                aria-label={copied ? "Copied" : "Copy JSON"}
                onClick={() => copy(text)}
            >
                {copied ? <Check className="text-success" /> : <Copy />}
            </Button>
        </div>
    );
}

export const formatDuration = (ms: number | null | undefined) => {
    if (ms === null || ms === undefined) return "—";
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
    return `${Math.round(ms / 60_000)} min`;
};

/** Secret shown once (webhook secrets): copy + warning. */
export function SecretReveal({ secret }: { secret: string }) {
    const { copied, copy } = useCopy();
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning-soft p-2">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">{secret}</code>
                <Button size="sm" variant="outline" onClick={() => copy(secret)}>
                    {copied ? <><Check /> Copied</> : <><Copy /> Copy</>}
                </Button>
            </div>
            <p className="text-xs text-muted-foreground">Store it now: it is shown only once. Rotate it if it leaks.</p>
        </div>
    );
}

interface MemberPickerProps {
    value: string[];
    onChange: (ids: string[]) => void;
    multiple?: boolean;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
}

/** Searchable member picker (Popover + Command), single or multiple. Members come from 01 Admin. */
export function MemberPicker({ value, onChange, multiple, placeholder = "Choose a member", disabled, id }: MemberPickerProps) {
    const [open, setOpen] = useState(false);
    const members = useMembers({ limit: 200, status: "ACTIVE" });
    const rows = members.data?.data ?? [];
    const selected = rows.filter((m) => value.includes(m.id));
    const label = selected.length ? selected.map((m) => personName(m.user)).join(", ") : value.length ? `${value.length} selected` : placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal">
                    <span className={cn("truncate", !selected.length && !value.length && "text-muted-foreground")}>{label}</span>
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search members…" />
                    <CommandList>
                        <CommandEmpty>{members.isError ? "Members could not be loaded" : members.isPending ? "Loading…" : "No member found"}</CommandEmpty>
                        <CommandGroup>
                            {rows.map((m) => {
                                const on = value.includes(m.id);
                                return (
                                    <CommandItem
                                        key={m.id}
                                        value={`${personName(m.user)} ${m.user.email}`}
                                        onSelect={() => {
                                            if (multiple) onChange(on ? value.filter((v) => v !== m.id) : [...value, m.id]);
                                            else {
                                                onChange([m.id]);
                                                setOpen(false);
                                            }
                                        }}
                                    >
                                        <Check className={cn("size-4", on ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0">
                                            <div className="truncate text-[13px]">{personName(m.user)}</div>
                                            <div className="truncate text-xs text-muted-foreground">{m.user.email}</div>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

interface OptionMultiPickerProps {
    options: { id: string; name: string; hint?: string }[];
    value: string[];
    onChange: (ids: string[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
    id?: string;
    loading?: boolean;
}

/** Searchable multi-select over a fetched list (teams, roles …). Popover + Command, never a plain <select>. */
export function OptionMultiPicker({ options, value, onChange, placeholder = "Choose…", searchPlaceholder = "Search…", emptyText = "Nothing found", disabled, id, loading }: OptionMultiPickerProps) {
    const [open, setOpen] = useState(false);
    const selected = options.filter((o) => value.includes(o.id));
    const label = selected.length ? selected.map((o) => o.name).join(", ") : value.length ? `${value.length} selected` : placeholder;
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal">
                    <span className={cn("truncate", !value.length && "text-muted-foreground")}>{label}</span>
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{loading ? "Loading…" : emptyText}</CommandEmpty>
                        <CommandGroup>
                            {options.map((o) => {
                                const on = value.includes(o.id);
                                return (
                                    <CommandItem key={o.id} value={`${o.name} ${o.id}`} onSelect={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}>
                                        <Check className={cn("size-4", on ? "opacity-100" : "opacity-0")} />
                                        <span className="min-w-0 flex-1 truncate text-[13px]">{o.name}</span>
                                        {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export const describeSchedule = (j: Pick<ScheduledJob, "kind" | "cron_expression" | "interval_seconds" | "run_at" | "timezone">) =>
    j.kind === "CRON" ? `${j.cron_expression} (${j.timezone})` : j.kind === "INTERVAL" ? `every ${j.interval_seconds}s` : j.run_at ? `once at ${formatDateTime(j.run_at)}` : "—";
