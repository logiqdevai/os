import { Lock } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { DeliveryStatusOptions, DigestStatusOptions, EventStatusOptions, NotificationChannelOptions, SkipReasonOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import type { NotificationChannel } from "@/features/notifications/interfaces/notifications.interfaces";
import type { DeliveryStatus, DigestStatus, EventStatus, Scope, SkipReason } from "@/features/notifications/interfaces/notification-admin.interfaces";

/** Channels the delivery engine supports today (SMS / push / desktop need providers that do not exist yet). */
export const ADMIN_CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL"];

export function ChannelBadges({ channels }: { channels: NotificationChannel[] }) {
    if (!channels.length) return <span className="text-muted-foreground">—</span>;
    return (
        <span className="flex flex-wrap gap-1">
            {channels.map((c) => <Badge key={c} variant={c === "EMAIL" ? "info" : "neutral"}>{getDropdownOptionLabel(NotificationChannelOptions, c)}</Badge>)}
        </span>
    );
}

export function ScopeBadge({ scope }: { scope: Scope }) {
    return scope === "organization" ? <Badge variant="violet">Organization</Badge> : <Badge variant="neutral"><Lock className="size-3" /> Platform</Badge>;
}

/** In-app is always on; the other supported channels are checkboxes. */
export function ChannelChecks({ value, onChange, allowed = ADMIN_CHANNELS, disabled }: { value: NotificationChannel[]; onChange: (v: NotificationChannel[]) => void; allowed?: NotificationChannel[]; disabled?: boolean }) {
    return (
        <div className="flex flex-wrap gap-4">
            {ADMIN_CHANNELS.map((c) => {
                const locked = c === "IN_APP";
                const off = !allowed.includes(c);
                return (
                    <label key={c} className="flex items-center gap-2 text-[13px] text-foreground">
                        <Checkbox
                            checked={locked || value.includes(c)}
                            disabled={disabled || locked || off}
                            onCheckedChange={(on) => onChange(on ? [...new Set([...value, c])] : value.filter((x) => x !== c))}
                            aria-label={getDropdownOptionLabel(NotificationChannelOptions, c)}
                        />
                        {getDropdownOptionLabel(NotificationChannelOptions, c)}
                        {off && <span className="text-xs text-muted-foreground">(off for the organization)</span>}
                    </label>
                );
            })}
        </div>
    );
}

const DELIVERY_VARIANT: Record<DeliveryStatus, BadgeVariant> = {
    PENDING: "neutral", QUEUED: "info", SENT: "success", DELIVERED: "success", FAILED: "danger", SKIPPED: "warning", DIGESTED: "violet", EXPIRED: "neutral", CANCELLED: "neutral",
};
export function DeliveryStatusBadge({ status, skip }: { status: DeliveryStatus; skip?: SkipReason | null }) {
    return (
        <span className="flex flex-wrap items-center gap-1">
            <Badge variant={DELIVERY_VARIANT[status]}>{getDropdownOptionLabel(DeliveryStatusOptions, status)}</Badge>
            {skip && <Badge variant="warning">{getDropdownOptionLabel(SkipReasonOptions, skip)}</Badge>}
        </span>
    );
}

const EVENT_VARIANT: Record<EventStatus, BadgeVariant> = { RECEIVED: "neutral", PROCESSING: "info", PROCESSED: "success", IGNORED: "neutral", FAILED: "danger" };
export const EventStatusBadge = ({ status }: { status: EventStatus }) => <Badge variant={EVENT_VARIANT[status]}>{getDropdownOptionLabel(EventStatusOptions, status)}</Badge>;

const DIGEST_VARIANT: Record<DigestStatus, BadgeVariant> = { OPEN: "info", SCHEDULED: "info", SENDING: "info", SENT: "success", EMPTY: "neutral", FAILED: "danger" };
export const DigestStatusBadge = ({ status }: { status: DigestStatus }) => <Badge variant={DIGEST_VARIANT[status]}>{getDropdownOptionLabel(DigestStatusOptions, status)}</Badge>;
