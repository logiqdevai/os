import { Building2, Calendar, CalendarDays, Clock, Inbox, Layers, Link, List } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const calendarApp: AppDefinition = {
    id: "calendar",
    label: "Calendar",
    icon: Calendar,
    basePath: "/calendar",
    module: "CALENDAR",
    viewPermissions: ["calendar.events.read", "calendar.events.read_own"],
    newAction: { label: "New event", to: "/calendar/new", permission: "calendar.events.create" },
    nav: [
        { items: [
            { label: "Calendar", to: "/calendar", icon: CalendarDays, end: true },
            { label: "Agenda", to: "/calendar/agenda", icon: List },
        ] },
        { label: "Scheduling", items: [
            { label: "Booking links", to: "/calendar/booking-links", icon: Link, permissions: ["calendar.bookings.read"] },
            { label: "Bookings", to: "/calendar/bookings", icon: Inbox, permissions: ["calendar.bookings.read"] },
            { label: "My availability", to: "/calendar/availability", icon: Clock, permissions: ["calendar.availability.read"] },
        ] },
        { label: "Resources", items: [
            { label: "Calendars", to: "/calendar/calendars", icon: Layers },
            { label: "Rooms & resources", to: "/calendar/resources", icon: Building2 },
        ] },
    ],
};
