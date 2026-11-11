import { Mail, MessageSquareText } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { CampaignStatusFormOptions } from "@/config/constants/dropdowns/communications/campaign-status-filter.options";
import { CommChannelFormOptions } from "@/config/constants/dropdowns/communications/comm-channel-form.options";
import { CommMessageStatusFormOptions, CommRecipientStatusFormOptions } from "@/config/constants/dropdowns/communications/comm-message-status-filter.options";
import type { CampaignStatus, CommChannel, CommMessageStatus, CommRecipientStatus } from "@/features/communications/interfaces/communications.interfaces";

const campaignTone: Record<CampaignStatus, BadgeVariant> = {
    DRAFT: "neutral",
    PENDING_APPROVAL: "warning",
    APPROVED: "violet",
    SCHEDULED: "info",
    SENDING: "info",
    PAUSED: "warning",
    COMPLETED: "success",
    CANCELLED: "neutral",
    FAILED: "danger",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
    return (
        <Badge variant={campaignTone[status]} dot={status === "SENDING"}>
            {getDropdownOptionLabel(CampaignStatusFormOptions, status)}
        </Badge>
    );
}

const messageTone: Record<CommMessageStatus, BadgeVariant> = {
    DRAFT: "neutral",
    SCHEDULED: "info",
    QUEUED: "info",
    SENDING: "info",
    SENT: "violet",
    DELIVERED: "success",
    FAILED: "danger",
    BOUNCED: "danger",
    CANCELLED: "neutral",
};

export function MessageStatusBadge({ status }: { status: CommMessageStatus }) {
    return <Badge variant={messageTone[status]}>{getDropdownOptionLabel(CommMessageStatusFormOptions, status)}</Badge>;
}

const recipientTone: Record<CommRecipientStatus, BadgeVariant> = {
    PENDING: "neutral",
    EXCLUDED: "neutral",
    QUEUED: "info",
    SENT: "violet",
    DELIVERED: "success",
    OPENED: "success",
    CLICKED: "success",
    REPLIED: "success",
    BOUNCED: "danger",
    FAILED: "danger",
    UNSUBSCRIBED: "warning",
};

export function RecipientStatusBadge({ status }: { status: CommRecipientStatus }) {
    return <Badge variant={recipientTone[status]}>{getDropdownOptionLabel(CommRecipientStatusFormOptions, status)}</Badge>;
}

export function ChannelBadge({ channel }: { channel: CommChannel }) {
    const Icon = channel === "EMAIL" ? Mail : MessageSquareText;
    return (
        <Badge variant="outline">
            <Icon className="size-3" />
            {getDropdownOptionLabel(CommChannelFormOptions, channel)}
        </Badge>
    );
}

/** "42.5%" from a 0–100 number. */
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 10) / 10}%`);
