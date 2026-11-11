import axiosInstance from "@/config/api/axios";
import { ApiRoutes } from "@/config/api/routes";
import type {
    AttendeeResponse, AvailabilitySchedule, Booking, BookingLink, BookingLinkDto, CalendarDetail, CalendarDto, CalendarEventDetail, CalendarEventsResponse, CalendarPreferences,
    CalendarRole, CalendarRow, EventDto, EventType, FreeBusyRow, Paginated, Person, PublicBookingDto, PublicBookingPage, PublicBookingResult, Resource, ResourceDto, ResourceRequest,
    ScheduleDto, Slot,
} from "../interfaces/calendar.interfaces";

const R = ApiRoutes.calendar;
type Params = Record<string, unknown>;

export const getEvents = async (params: Params): Promise<CalendarEventsResponse> => (await axiosInstance.get(R.events, { params })).data;
export const getEvent = async (id: string): Promise<CalendarEventDetail> => (await axiosInstance.get(R.event(id))).data;
export const createEvent = async (dto: EventDto): Promise<CalendarEventDetail> => (await axiosInstance.post(R.events, dto)).data;
export const updateEvent = async ({ id, ...dto }: Partial<EventDto> & { id: string }): Promise<CalendarEventDetail> => (await axiosInstance.patch(R.event(id), dto)).data;
export const cancelEvent = async ({ id, ...dto }: { id: string; reason?: string; occurrence_start?: string }): Promise<CalendarEventDetail> => (await axiosInstance.post(R.eventCancel(id), dto)).data;
export const deleteEvent = async (id: string) => (await axiosInstance.delete(R.event(id))).data;
export const respondEvent = async ({ id, ...dto }: { id: string; response: AttendeeResponse; comment?: string }): Promise<CalendarEventDetail> =>
    (await axiosInstance.post(R.eventRespond(id), dto)).data;

export const getCalendars = async (params: Params): Promise<CalendarRow[]> => (await axiosInstance.get(R.calendars, { params })).data;
export const getCalendar = async (id: string): Promise<CalendarDetail> => (await axiosInstance.get(R.calendar(id))).data;
export const createCalendar = async (dto: CalendarDto) => (await axiosInstance.post(R.calendars, dto)).data;
export const updateCalendar = async ({ id, ...dto }: Partial<CalendarDto> & { id: string }) => (await axiosInstance.patch(R.calendar(id), dto)).data;
export const archiveCalendar = async (id: string) => (await axiosInstance.post(R.calendarArchive(id))).data;
export const restoreCalendar = async (id: string) => (await axiosInstance.post(R.calendarRestore(id))).data;
export const shareCalendar = async ({ id, ...dto }: { id: string; membership_id?: string; team_id?: string; role: CalendarRole }) => (await axiosInstance.post(R.calendarShares(id), dto)).data;
export const unshareCalendar = async ({ id, shareId }: { id: string; shareId: string }) => (await axiosInstance.delete(R.calendarShare(id, shareId))).data;

export const getEventTypes = async (): Promise<EventType[]> => (await axiosInstance.get(R.eventTypes)).data;
export const getPreferences = async (): Promise<CalendarPreferences> => (await axiosInstance.get(R.preferences)).data;
export const updatePreferences = async (dto: Partial<CalendarPreferences>): Promise<CalendarPreferences> => (await axiosInstance.put(R.preferences, dto)).data;
export const getPeople = async (params: Params): Promise<Person[]> => (await axiosInstance.get(R.people, { params })).data;
export const getTeams = async (): Promise<{ id: string; name: string }[]> => (await axiosInstance.get(R.teams)).data;

export const getSchedules = async (): Promise<AvailabilitySchedule[]> => (await axiosInstance.get(R.schedules)).data;
export const createSchedule = async (dto: ScheduleDto): Promise<AvailabilitySchedule> => (await axiosInstance.post(R.schedules, dto)).data;
export const updateSchedule = async ({ id, ...dto }: Partial<ScheduleDto> & { id: string }): Promise<AvailabilitySchedule> => (await axiosInstance.patch(R.schedule(id), dto)).data;
export const deleteSchedule = async (id: string) => (await axiosInstance.delete(R.schedule(id))).data;
export const getFreeBusy = async (params: Params): Promise<FreeBusyRow[]> => (await axiosInstance.get(R.freeBusy, { params })).data;
export const getSuggestions = async (params: Params): Promise<Slot[]> => (await axiosInstance.get(R.suggest, { params })).data;

export const getResources = async (params: Params): Promise<Resource[]> => (await axiosInstance.get(R.resources, { params })).data;
export const createResource = async (dto: ResourceDto): Promise<Resource> => (await axiosInstance.post(R.resources, dto)).data;
export const updateResource = async ({ id, ...dto }: Partial<ResourceDto> & { id: string }): Promise<Resource> => (await axiosInstance.patch(R.resource(id), dto)).data;
export const archiveResource = async (id: string) => (await axiosInstance.post(R.resourceArchive(id))).data;
export const getResourceRequests = async (): Promise<ResourceRequest[]> => (await axiosInstance.get(R.resourceRequests)).data;
export const decideResourceRequest = async ({ resourceId, eventId, decision }: { resourceId: string; eventId: string; decision: "approve" | "decline" }) =>
    (await axiosInstance.post(R.resourceDecide(resourceId, eventId, decision), {})).data;

export const getBookingLinks = async (params: Params): Promise<Paginated<BookingLink>> => (await axiosInstance.get(R.bookingLinks, { params })).data;
export const getBookingLink = async (id: string): Promise<BookingLink> => (await axiosInstance.get(R.bookingLink(id))).data;
export const createBookingLink = async (dto: BookingLinkDto): Promise<BookingLink> => (await axiosInstance.post(R.bookingLinks, dto)).data;
export const updateBookingLink = async ({ id, ...dto }: Partial<BookingLinkDto> & { id: string }): Promise<BookingLink> => (await axiosInstance.patch(R.bookingLink(id), dto)).data;
export const getBookings = async (params: Params): Promise<Paginated<Booking>> => (await axiosInstance.get(R.bookings, { params })).data;
export const getBooking = async (id: string): Promise<Booking> => (await axiosInstance.get(R.booking(id))).data;
export const bookingAction = async ({ id, action, reason }: { id: string; action: "confirm" | "cancel" | "no-show" | "complete"; reason?: string }): Promise<Booking> =>
    (await axiosInstance.post(R.bookingAction(id, action), { reason })).data;

export const getPublicBookingPage = async (orgSlug: string, slug: string): Promise<PublicBookingPage> => (await axiosInstance.get(R.public.page(orgSlug, slug))).data;
export const getPublicSlots = async (id: string, params: Params): Promise<Slot[]> => (await axiosInstance.get(R.public.slots(id), { params })).data;
export const createPublicBooking = async ({ id, ...dto }: PublicBookingDto & { id: string }): Promise<PublicBookingResult> => (await axiosInstance.post(R.public.book(id), dto)).data;
