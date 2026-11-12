import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { patchEntity, removeEntity, useOptimisticMutation } from "@/lib/query/optimistic";
import * as service from "../services/calendar.services";
import type { AttendeeResponse, CalendarPreferences } from "../interfaces/calendar.interfaces";

export const CALENDAR_KEY = ["calendar"] as const;
type Params = Record<string, unknown>;

export const useCalendarEvents = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...CALENDAR_KEY, "events", params], queryFn: () => service.getEvents(params), placeholderData: keepPreviousData, enabled });
export const useProjectedDates = (params: Params, enabled = true) =>
    useQuery({ queryKey: [...CALENDAR_KEY, "projected", params], queryFn: () => service.getProjected(params), placeholderData: keepPreviousData, enabled });
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

/**
 * Non-optimistic calendar mutation (creations and server-computed results such as recurrences, feeds and conflicts):
 * refreshes the calendar when it settles. No success toasts (the UI shows the result); failures are toasted once by
 * the global MutationCache — `errorToast: false` when the form shows the error itself.
 */
function useCalendarMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, errorTitle: string, errorToast = true) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, meta: { errorTitle, errorToast }, onSettled: () => qc.invalidateQueries({ queryKey: CALENDAR_KEY }) });
}
/** Optimistic calendar mutation over the whole calendar cache (ids are unique, so patches find every copy). */
function useCalendarOptimistic<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, errorTitle: string, apply: (qc: QueryClient, args: TArgs) => void, errorToast = true) {
    return useOptimisticMutation<TResult, TArgs>({ roots: [CALENDAR_KEY], meta: { errorTitle, errorToast }, mutationFn: fn, apply });
}
const now = () => new Date().toISOString();

/** Event forms show conflicts (e.g. a booked room) on the field and toast once; creation opens the new event. */
export const useCreateEvent = () => useCalendarMutation(service.createEvent, "Could not create event");
/** Optimistic: the event (in every view and its detail page) shows the new values at once. */
export const useUpdateEvent = ({ inline = false }: { inline?: boolean } = {}) =>
    useCalendarOptimistic(service.updateEvent, "Could not update event", (qc, { id, ...dto }) => patchEntity(qc, CALENDAR_KEY, id, dto), !inline);
export const useEditOccurrence = () => useCalendarMutation(service.editOccurrence, "Could not update this occurrence");
export const useCancelEvent = () =>
    useCalendarOptimistic(service.cancelEvent, "Could not cancel event", (qc, { id, occurrence_start }) => {
        // A whole series / single event shows as cancelled at once; a single occurrence is recomputed by the refresh.
        if (!occurrence_start) patchEntity(qc, CALENDAR_KEY, id, { status: "CANCELLED" });
    });
export const useDeleteEvent = () => useCalendarOptimistic(service.deleteEvent, "Could not delete event", (qc, id) => removeEntity(qc, CALENDAR_KEY, id));
/** RSVP: the chosen answer is highlighted at once in the detail page and every view. */
export const useRespondEvent = () =>
    useCalendarOptimistic(service.respondEvent, "Could not send your response", (qc, { id, response }: { id: string; response: AttendeeResponse }) =>
        patchEntity<{ my_response?: AttendeeResponse | null; my_attendee?: { response: AttendeeResponse } | null }>(qc, CALENDAR_KEY, id, (e) => ({
            ...e,
            ...("my_response" in e && { my_response: response }),
            ...(e.my_attendee && { my_attendee: { ...e.my_attendee, response } }),
        })),
    );
export const useCreateCalendar = () => useCalendarMutation(service.createCalendar, "Could not create calendar");
export const useUpdateCalendar = ({ inline = false }: { inline?: boolean } = {}) =>
    useCalendarOptimistic(service.updateCalendar, "Could not save calendar", (qc, { id, ...dto }) => patchEntity(qc, CALENDAR_KEY, id, dto), !inline);
/** Archive: the calendar leaves the list at once (its detail cache shows it archived). */
export const useArchiveCalendar = () =>
    useCalendarOptimistic(service.archiveCalendar, "Could not archive calendar", (qc, id) => {
        removeEntity(qc, CALENDAR_KEY, id);
        patchEntity(qc, CALENDAR_KEY, id, { archived_at: now() });
    });
export const useRestoreCalendar = () =>
    useCalendarOptimistic(service.restoreCalendar, "Could not restore calendar", (qc, id) => patchEntity(qc, CALENDAR_KEY, id, { archived_at: null }));
export const useShareCalendar = () => useCalendarMutation(service.shareCalendar, "Could not share calendar");
export const useUnshareCalendar = () =>
    useCalendarOptimistic(service.unshareCalendar, "Could not remove share", (qc, { shareId }) => removeEntity(qc, CALENDAR_KEY, shareId));
/** Feed links are generated by the server: the dialog shows the new link when it arrives. */
export const useRotateCalendarFeed = () => useCalendarMutation(service.rotateCalendarFeed, "Could not create the link");
export const useRevokeCalendarFeed = () => useCalendarMutation(service.revokeCalendarFeed, "Could not turn off the link");
/** Preferences (e.g. projected modules): applied at once. */
export const useUpdateCalendarPreferences = () =>
    useCalendarOptimistic(service.updatePreferences, "Could not save preferences", (qc, dto) =>
        qc.setQueryData<CalendarPreferences>([...CALENDAR_KEY, "preferences"], (p) => (p ? { ...p, ...dto } : p)),
    );
/** Availability: the editor keeps its own draft; `inline` when it autosaves with <SaveStatus />. */
export const useCreateSchedule = ({ inline = false }: { inline?: boolean } = {}) => useCalendarMutation(service.createSchedule, "Could not save availability", !inline);
export const useUpdateSchedule = ({ inline = false }: { inline?: boolean } = {}) =>
    useCalendarOptimistic(service.updateSchedule, "Could not save availability", (qc, { id, ...dto }) => patchEntity(qc, CALENDAR_KEY, id, dto), !inline);
export const useDeleteSchedule = () => useCalendarOptimistic(service.deleteSchedule, "Could not remove schedule", (qc, id) => removeEntity(qc, CALENDAR_KEY, id));
export const useCreateResource = () => useCalendarMutation(service.createResource, "Could not create resource");
export const useUpdateResource = ({ inline = false }: { inline?: boolean } = {}) =>
    useCalendarOptimistic(service.updateResource, "Could not save resource", (qc, { id, ...dto }) => patchEntity(qc, CALENDAR_KEY, id, dto), !inline);
export const useArchiveResource = () => useCalendarOptimistic(service.archiveResource, "Could not archive resource", (qc, id) => removeEntity(qc, CALENDAR_KEY, id));
/** Approve / decline a room request: it leaves the queue at once. Pass `requestId` (never sent). */
export const useDecideResourceRequest = () =>
    useCalendarOptimistic(
        (v: Parameters<typeof service.decideResourceRequest>[0] & { requestId?: string }) => service.decideResourceRequest(v),
        "Could not handle the request",
        (qc, { requestId }) => { if (requestId) removeEntity(qc, CALENDAR_KEY, requestId); },
    );
export const useCreateBookingLink = () => useCalendarMutation(service.createBookingLink, "Could not create booking link");
export const useUpdateBookingLink = ({ inline = false }: { inline?: boolean } = {}) =>
    useCalendarOptimistic(service.updateBookingLink, "Could not save booking link", (qc, { id, ...dto }) => patchEntity(qc, CALENDAR_KEY, id, dto), !inline);
const BOOKING_STATUS: Record<string, string> = { confirm: "CONFIRMED", cancel: "CANCELLED", "no-show": "NO_SHOW", complete: "COMPLETED" };
/** Booking actions: the status badge changes at once. */
export const useBookingAction = () =>
    useCalendarOptimistic(service.bookingAction, "Could not update booking", (qc, { id, action }) => patchEntity(qc, CALENDAR_KEY, id, { status: BOOKING_STATUS[action] }));

// Public booking page (no session)
export const usePublicBookingPage = (orgSlug: string | undefined, slug: string | undefined) =>
    useQuery({ queryKey: ["public-booking", orgSlug, slug], queryFn: () => service.getPublicBookingPage(orgSlug as string, slug as string), enabled: !!orgSlug && !!slug, retry: false });
export const usePublicSlots = (id: string | undefined, params: Params) =>
    useQuery({ queryKey: ["public-booking", "slots", id, params], queryFn: () => service.getPublicSlots(id as string, params), enabled: !!id, placeholderData: keepPreviousData, retry: false });
/** The public page shows booking errors inline (slot taken, validation), so no toast. */
export const useCreatePublicBooking = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: service.createPublicBooking, meta: { errorToast: false }, onSuccess: () => qc.invalidateQueries({ queryKey: ["public-booking", "slots"] }) });
};
