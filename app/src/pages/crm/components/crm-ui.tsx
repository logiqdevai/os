import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColorBadge, ColorDot } from "@/components/ui/color-picker";
import { formatMoney, initials, personName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DealStatusFormOptions } from "@/config/constants/dropdowns/crm/deal-status-form.options";
import type { MemberRef, Money as MoneyValue, TagRef } from "@/features/crm/common/interfaces/crm-common.interfaces";
import type { DealStatus } from "@/features/crm/deals/interfaces/deals.interfaces";

const TONES: Record<string, BadgeVariant> = { neutral: "neutral", info: "info", success: "success", warning: "warning", danger: "danger", violet: "violet" };

/** Stored semantic tone (stage / status / tag color) → badge variant. Unknown values fall back to neutral. */
export const toneVariant = (tone: string | null | undefined): BadgeVariant => TONES[tone ?? ""] ?? "neutral";

/** Dot for a stored tone / color (board column headers, stage stepper). */
export const ToneDot = ({ tone }: { tone: string | null | undefined }) => <ColorDot color={tone} />;

export const ToneBadge = ({ tone, children, className }: { tone: string | null | undefined; children: ReactNode; className?: string }) => <ColorBadge color={tone} className={className}>{children}</ColorBadge>;

const STATUS_VARIANT: Record<DealStatus, BadgeVariant> = { OPEN: "info", WON: "success", LOST: "danger", ABANDONED: "neutral" };
export function DealStatusBadge({ status }: { status: DealStatus }) {
    return <Badge variant={STATUS_VARIANT[status]} dot>{getDropdownOptionLabel(DealStatusFormOptions, status)}</Badge>;
}

/** Money respecting the crm.financials.read field rule: null → lock icon with an explanation. */
export function Money({ value, currency, compact, className }: { value: MoneyValue | undefined; currency?: string | null; compact?: boolean; className?: string }) {
    if (value === null || value === undefined) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={cn("inline-flex items-center text-ash", className)} aria-label="Hidden: needs the financials permission">
                        <Lock className="size-3" />
                    </span>
                </TooltipTrigger>
                <TooltipContent>Amounts need the CRM financials permission</TooltipContent>
            </Tooltip>
        );
    }
    return <span className={cn("tabular", className)}>{formatMoney(value, currency ?? "EUR", { compact })}</span>;
}

export const memberLabel = (m: MemberRef | null | undefined) => (m ? personName(m.user) : "Unassigned");

export function MemberAvatar({ member, size = "sm" }: { member: MemberRef | null | undefined; size?: "sm" | "md" }) {
    const name = memberLabel(member);
    return (
        <Avatar className={size === "sm" ? "size-6" : "size-8"}>
            {member?.user.profile_photo_url && <AvatarImage src={member.user.profile_photo_url} alt={name} />}
            <AvatarFallback className="text-[10px] font-medium text-muted-foreground">{member ? initials(name) : "–"}</AvatarFallback>
        </Avatar>
    );
}

export function MemberChip({ member }: { member: MemberRef | null | undefined }) {
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
            <MemberAvatar member={member} />
            <span className={cn("truncate", !member && "text-muted-foreground")}>{memberLabel(member)}</span>
        </span>
    );
}

export function TagList({ tags, max = 3 }: { tags: TagRef[] | undefined; max?: number }) {
    if (!tags?.length) return null;
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            {tags.slice(0, max).map((t) => <ToneBadge key={t.id} tone={t.color}>{t.name}</ToneBadge>)}
            {tags.length > max && <span className="text-xs text-muted-foreground">+{tags.length - max}</span>}
        </span>
    );
}

/** Text link to a CRM record that does not trigger the row click of the surrounding table. */
export function RecordLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
    return (
        <Link to={to} onClick={(e) => e.stopPropagation()} className={cn("truncate text-foreground underline-offset-2 hover:underline", className)}>
            {children}
        </Link>
    );
}

/** Thin card used for side panels on detail pages. */
export function Panel({ title, actions, children, className, bodyClassName }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
    return (
        <section className={cn("min-w-0 rounded-lg border border-border bg-card", className)}>
            {(title || actions) && (
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                    {title && <h2 className="text-[13px] font-medium text-foreground">{title}</h2>}
                    {actions}
                </div>
            )}
            <div className={cn("p-4", bodyClassName)}>{children}</div>
        </section>
    );
}
