import { Building2, Calendar, CalendarDays, Clock, Inbox, Layers, Link, List, Users } from "lucide-react";
import type { AppDefinition } from "../app.types";

/** 19 Calendar. Every key below exists in the permission catalog (api/prisma/seed/permission-catalog.ts). */
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
            { label: "Team availability", to: "/calendar/team", icon: Users, permissions: ["calendar.availability.read"] },
        ] },
        { label: "Scheduling", items: [
            { label: "Booking links", to: "/calendar/booking-links", icon: Link, permissions: ["calendar.booking_links.manage"] },
            { label: "Bookings", to: "/calendar/bookings", icon: Inbox, permissions: ["calendar.bookings.read", "calendar.events.read_own"] },
            { label: "My availability", to: "/calendar/availability", icon: Clock, permissions: ["calendar.availability.read"] },
        ] },
        { label: "Resources", items: [
            { label: "Calendars", to: "/calendar/calendars", icon: Layers },
            { label: "Rooms & resources", to: "/calendar/resources", icon: Building2 },
        ] },
    ],
};
