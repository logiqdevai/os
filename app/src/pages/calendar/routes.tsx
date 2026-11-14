import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequirePermission } from "@/components/access/can";

const CalendarViewPage = lazy(() => import("./pages/calendar-view"));
const EventDetailPage = lazy(() => import("./pages/event-detail"));
const BookingLinksPage = lazy(() => import("./pages/booking-links"));
const BookingsPage = lazy(() => import("./pages/bookings"));
const BookingDetailPage = lazy(() => import("./pages/bookings/detail"));
const AvailabilityPage = lazy(() => import("./pages/availability"));
const CalendarsPage = lazy(() => import("./pages/calendars"));
const ResourcesPage = lazy(() => import("./pages/resources"));
const TeamAvailabilityPage = lazy(() => import("./pages/team"));

const READ = ["calendar.events.read", "calendar.events.read_own"];

/** /calendar/* (app/mockups/modules/19-calendar). Each route is gated by its VIEW permission; the API re-checks everything. */
export default function CalendarRoutes() {
    return (
        <Routes>
            <Route index element={<RequirePermission anyOf={READ}><CalendarViewPage /></RequirePermission>} />
            <Route path="new" element={<RequirePermission permission="calendar.events.create"><CalendarViewPage startCreate /></RequirePermission>} />
            <Route path="events/:id" element={<RequirePermission anyOf={READ}><EventDetailPage /></RequirePermission>} />
            <Route path="team" element={<RequirePermission permission="calendar.availability.read"><TeamAvailabilityPage /></RequirePermission>} />
            <Route path="booking-links" element={<RequirePermission permission="calendar.booking_links.manage"><BookingLinksPage /></RequirePermission>} />
            <Route path="bookings" element={<RequirePermission anyOf={["calendar.bookings.read", "calendar.events.read_own"]}><BookingsPage /></RequirePermission>} />
            <Route path="bookings/:id" element={<RequirePermission anyOf={["calendar.bookings.read", "calendar.events.read_own"]}><BookingDetailPage /></RequirePermission>} />
            <Route path="availability" element={<RequirePermission permission="calendar.availability.read"><AvailabilityPage /></RequirePermission>} />
            <Route path="calendars" element={<RequirePermission anyOf={READ}><CalendarsPage /></RequirePermission>} />
            <Route path="resources" element={<RequirePermission anyOf={READ}><ResourcesPage /></RequirePermission>} />
            <Route path="*" element={<RequirePermission anyOf={READ}><CalendarViewPage /></RequirePermission>} />
        </Routes>
    );
}
