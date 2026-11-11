import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import * as service from "../services/calendar.services";

export const CALENDAR_KEY = ["calendar"] as const;
type Params = Record<string, unknown>;

export const useCalendarEvents = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...CALENDAR_KEY, "events", params], queryFn: () => service.getEvents(params), placeholderData: keepPreviousData, enabled });
export const useCalendarEvent = (id: string | undefined) => useQuery({ queryKey: [...CALENDAR_KEY, "event", id], queryFn: () => service.getEvent(id as string), enabled: !!id, retry: false });
export const useCalendars = (params: Params = {}, enabled = true) => useQuery({ queryKey: [...CALENDAR_KEY, "calendars", params], queryFn: () => service.getCalendars(params), enabled });
export const useCalendarDetail = (id: string | undefined) => useQuery({ queryKey: [...CALENDAR_KEY, "calendar", id], queryFn: () => service.getCalendar(id as string), enabled: !!id });
export const useEventTypes = (enabled = true) => useQuery({ queryKey: [...CALENDAR_KEY, "event-types"], queryFn: service.getEventTypes, staleTime: 5 * 60_000, enabled });
export const useCalendarPreferences = (enabled = true) => useQuery({ queryKey: [...CALENDAR_KEY, "preferences"], queryFn: service.getPreferences, staleTime: 5 * 60_000, enabled });
export const useCalendarPeople = (search: string, enabled = true) =>
    useQuery({ queryKey: [...CALENDAR_KEY, "people", search], queryFn: () => service.getPeople({ search: search || undefined, limit: 30 }), placeholderData: keepPreviousData, enabled });
export const useCalendarTeamMembers = (teamId: string | undefined) =>
    useQuery({ queryKey: [...CALENDAR_KEY, "people", "team", teamId], queryFn: () => service.getPeople({ team_id: teamId, limit: 30 }), enabled: !!teamId });
export const useCalendarTeams = (enabled = true) => useQuery({ queryKey: [...CALENDAR_KEY, "teams"], queryFn: service.getTeams, staleTime: 5 * 60_000, enabled });
export const useSchedules = (enabled = true) => useQuery({ queryKey: [...CALENDAR_KEY, "schedules"], queryFn: service.getSchedules, enabled });
export const useFreeBusy = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...CALENDAR_KEY, "free-busy", params], queryFn: () => service.getFreeBusy(params), placeholderData: keepPreviousData, enabled });
export const useSuggestions = (params: Params, enabled = true) => useQuery({ queryKey: [...CALENDAR_KEY, "suggest", params], queryFn: () => service.getSuggestions(params), enabled });
export const useResources = (params: Params = {}, enabled = true) => useQuery({ queryKey: [...CALENDAR_KEY, "resources", params], queryFn: () => service.getResources(params), enabled });
export const useResourceRequests = (enabled = true) => useQuery({ queryKey: [...CALENDAR_KEY, "resource-requests"], queryFn: service.getResourceRequests, enabled });
export const useBookingLinks = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...CALENDAR_KEY, "booking-links", params], queryFn: () => service.getBookingLinks(params), placeholderData: keepPreviousData, enabled });
export const useBookingLink = (id: string | undefined) => useQuery({ queryKey: [...CALENDAR_KEY, "booking-link", id], queryFn: () => service.getBookingLink(id as string), enabled: !!id });
export const useBookings = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...CALENDAR_KEY, "bookings", params], queryFn: () => service.getBookings(params), placeholderData: keepPreviousData, enabled });
export const useBooking = (id: string | undefined) => useQuery({ queryKey: [...CALENDAR_KEY, "booking", id], queryFn: () => service.getBooking(id as string), enabled: !!id, retry: false });

function useCalendarMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, success: string | null, failure: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: CALENDAR_KEY });
            if (success) toast({ title: success });
        },
        onError: (e) => toast({ variant: "destructive", title: failure, description: getApiErrorMessage(e) }),
    });
}

export const useCreateEvent = () => useCalendarMutation(service.createEvent, "Event created", "Could not create event");
export const useUpdateEvent = () => useCalendarMutation(service.updateEvent, "Event updated", "Could not update event");
export const useCancelEvent = () => useCalendarMutation(service.cancelEvent, "Event cancelled", "Could not cancel event");
export const useDeleteEvent = () => useCalendarMutation(service.deleteEvent, "Event deleted", "Could not delete event");
export const useRespondEvent = () => useCalendarMutation(service.respondEvent, "Response sent", "Could not send your response");
export const useCreateCalendar = () => useCalendarMutation(service.createCalendar, "Calendar created", "Could not create calendar");
export const useUpdateCalendar = () => useCalendarMutation(service.updateCalendar, "Calendar saved", "Could not save calendar");
export const useArchiveCalendar = () => useCalendarMutation(service.archiveCalendar, "Calendar archived", "Could not archive calendar");
export const useRestoreCalendar = () => useCalendarMutation(service.restoreCalendar, "Calendar restored", "Could not restore calendar");
export const useShareCalendar = () => useCalendarMutation(service.shareCalendar, "Calendar shared", "Could not share calendar");
export const useUnshareCalendar = () => useCalendarMutation(service.unshareCalendar, "Share removed", "Could not remove share");
export const useUpdateCalendarPreferences = () => useCalendarMutation(service.updatePreferences, "Preferences saved", "Could not save preferences");
export const useCreateSchedule = () => useCalendarMutation(service.createSchedule, "Availability saved", "Could not save availability");
export const useUpdateSchedule = () => useCalendarMutation(service.updateSchedule, "Availability saved", "Could not save availability");
export const useDeleteSchedule = () => useCalendarMutation(service.deleteSchedule, "Schedule removed", "Could not remove schedule");
export const useCreateResource = () => useCalendarMutation(service.createResource, "Resource created", "Could not create resource");
export const useUpdateResource = () => useCalendarMutation(service.updateResource, "Resource saved", "Could not save resource");
export const useArchiveResource = () => useCalendarMutation(service.archiveResource, "Resource archived", "Could not archive resource");
export const useDecideResourceRequest = () => useCalendarMutation(service.decideResourceRequest, "Request handled", "Could not handle request");
export const useCreateBookingLink = () => useCalendarMutation(service.createBookingLink, "Booking link created", "Could not create booking link");
export const useUpdateBookingLink = () => useCalendarMutation(service.updateBookingLink, "Booking link saved", "Could not save booking link");
export const useBookingAction = () => useCalendarMutation(service.bookingAction, "Booking updated", "Could not update booking");

// Public booking page (no session)
export const usePublicBookingPage = (orgSlug: string | undefined, slug: string | undefined) =>
    useQuery({ queryKey: ["public-booking", orgSlug, slug], queryFn: () => service.getPublicBookingPage(orgSlug as string, slug as string), enabled: !!orgSlug && !!slug, retry: false });
export const usePublicSlots = (id: string | undefined, params: Params) =>
    useQuery({ queryKey: ["public-booking", "slots", id, params], queryFn: () => service.getPublicSlots(id as string, params), enabled: !!id, placeholderData: keepPreviousData, retry: false });
export const useCreatePublicBooking = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.createPublicBooking, onSuccess: () => qc.invalidateQueries({ queryKey: ["public-booking", "slots"] }) });
};
