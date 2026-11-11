# Calendar mockup

- App id: `calendar` · open `app-shell.html#calendar` (any route below: `app-shell.html#calendar/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/19-calendar.md`](../../../../docs/features/19-calendar.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (23): `CalendarEventType`, `CalendarPreference`, `Calendar`, `CalendarShare`, `CalendarResource`, `CalendarEvent`, `CalendarEventAttendee`, `CalendarEventResource`, `CalendarEventReminder`, `CalendarEventLink`, `CalendarEventAttachment`, `CalendarAvailabilitySchedule`, `CalendarAvailabilityRule`, `CalendarAvailabilityOverride`, `BookingLink`, `BookingLinkHost`, `CalendarBooking`, `BookingLinkStatsDaily`, `CalendarConnection`, `CalendarConnectionCalendar`, `CalendarEventSyncMapping`, `CalendarSyncRun`, `CalendarConferencingAccount`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.calendar`; the nav panel of the app is the `calendar` entry in `../../core/apps.js`.
- Screens (21): `week`, `day`, `month`, `agenda`, `quick`, `create`, `detail`, `team`, `resources`, `timeoff`, `availability`, `bookings`, `bookingList`, `bookingDetail`, `bookingNew`, `bookingPublic`, `calendars`, `calendarNew`, `calendarDetail`, `sync`, `settings`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
