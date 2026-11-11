import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import {
    CreditNoteStatusOptions, InvoiceStatusOptions, PaymentLinkStatusOptions, PaymentStatusOptions, ProviderStatusOptions, SubscriptionStatusOptions,
} from "@/config/constants/dropdowns/billing/billing.options";
import type { CreditNoteStatus, InvoiceStatus, PaymentLinkStatus, PaymentStatus, ProviderConnectionStatus, SubscriptionStatus } from "@/features/billing/interfaces/billing.interfaces";

const invoiceTone: Record<InvoiceStatus, BadgeVariant> = {
    DRAFT: "neutral", SCHEDULED: "violet", OPEN: "info", PENDING: "info", PARTIALLY_PAID: "warning", PAID: "success", OVERDUE: "danger", REFUNDED: "neutral", CANCELLED: "neutral", VOID: "neutral",
};
const paymentTone: Record<PaymentStatus, BadgeVariant> = { PENDING: "info", PROCESSING: "info", SUCCEEDED: "success", FAILED: "danger", CANCELLED: "neutral", REFUNDED: "neutral", PARTIALLY_REFUNDED: "warning" };
const subTone: Record<SubscriptionStatus, BadgeVariant> = { INCOMPLETE: "neutral", TRIALING: "violet", ACTIVE: "success", PAST_DUE: "danger", PAUSED: "warning", CANCELLED: "neutral", EXPIRED: "neutral" };
const cnTone: Record<CreditNoteStatus, BadgeVariant> = { DRAFT: "neutral", ISSUED: "info", APPLIED: "success", VOID: "neutral" };
const providerTone: Record<ProviderConnectionStatus, BadgeVariant> = { PENDING: "info", ACTIVE: "success", ERROR: "danger", DISCONNECTED: "neutral" };
const linkTone: Record<PaymentLinkStatus, BadgeVariant> = { ACTIVE: "success", EXPIRED: "neutral", DISABLED: "neutral", COMPLETED: "info" };

export const InvoiceStatusBadge = ({ status }: { status: InvoiceStatus }) => <Badge variant={invoiceTone[status]} dot>{getDropdownOptionLabel(InvoiceStatusOptions, status)}</Badge>;
export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => <Badge variant={paymentTone[status]} dot>{getDropdownOptionLabel(PaymentStatusOptions, status)}</Badge>;
export const SubscriptionStatusBadge = ({ status }: { status: SubscriptionStatus }) => <Badge variant={subTone[status]} dot>{getDropdownOptionLabel(SubscriptionStatusOptions, status)}</Badge>;
export const CreditNoteStatusBadge = ({ status }: { status: CreditNoteStatus }) => <Badge variant={cnTone[status]} dot>{getDropdownOptionLabel(CreditNoteStatusOptions, status)}</Badge>;
export const ProviderStatusBadge = ({ status }: { status: ProviderConnectionStatus }) => <Badge variant={providerTone[status]} dot>{getDropdownOptionLabel(ProviderStatusOptions, status)}</Badge>;
export const PaymentLinkStatusBadge = ({ status }: { status: PaymentLinkStatus }) => <Badge variant={linkTone[status]} dot>{getDropdownOptionLabel(PaymentLinkStatusOptions, status)}</Badge>;
