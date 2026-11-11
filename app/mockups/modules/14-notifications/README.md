# Notifications mockup

- App id: `notifications` · open `app-shell.html#notifications` (any route below: `app-shell.html#notifications/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/14-notifications-activity-center.md`](../../../../docs/features/14-notifications-activity-center.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (17): `NotificationEventType`, `NotificationEvent`, `Notification`, `NotificationDelivery`, `NotificationTemplate`, `NotificationOrgSettings`, `NotificationOrgDefault`, `NotificationRecipientSettings`, `NotificationPreference`, `NotificationKeyword`, `NotificationDigest`, `NotificationPushDevice`, `NotificationDeliveryRule`, `NotificationTemplateVersion`, `Announcement`, `AnnouncementAcknowledgement`, `ActivityEvent`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.notifications`; the nav panel of the app is the `notifications` entry in `../../core/apps.js`.
- Screens (21): `inbox`, `approvals`, `detail`, `bell`, `activity`, `activity-project`, `activity-customer`, `prefs`, `schedule`, `keywords`, `follows`, `devices`, `announcements`, `catalog`, `event`, `templates`, `defaults`, `rules`, `log`, `delivery`, `settings`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
