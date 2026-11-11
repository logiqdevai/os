import type { BadgeVariant } from "@/components/ui/badge";
import type { BookingStatus } from "@/features/calendar/interfaces/calendar.interfaces";

/** Badge colors per booking status (visual map only; labels in config/constants/dropdowns/calendar). */
export const BOOKING_STATUS_VARIANT: Record<BookingStatus, BadgeVariant> = {
    PENDING: "warning",
    CONFIRMED: "success",
    RESCHEDULED: "info",
    CANCELLED: "danger",
    NO_SHOW: "danger",
    COMPLETED: "neutral",
};
