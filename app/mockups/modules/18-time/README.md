# Time mockup

- App id: `time` · open `app-shell.html#time` (any route below: `app-shell.html#time/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/18-time-tracking.md`](../../../../docs/features/18-time-tracking.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (14): `TimeTrackingSettings`, `TimeActivityType`, `TimeProjectSettings`, `BillingRate`, `TimeEntry`, `Timer`, `TimeImportJob`, `TimeSuggestion`, `TimeEntryAdjustment`, `Timesheet`, `TimesheetAction`, `TimeUtilizationPeriod`, `TimeReportSchedule`, `TimeExport`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.time`; the nav panel of the app is the `time` entry in `../../core/apps.js`.
- Screens (18): `timer`, `week`, `day`, `entries`, `create`, `entry`, `team`, `approvals`, `sheet`, `suggestions`, `rates`, `rateNew`, `projects`, `projectEdit`, `reports`, `unbilled`, `io`, `settings`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
