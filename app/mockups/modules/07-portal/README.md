# Client portal mockup

- App id: `portal` · open `app-shell.html#portal` (any route below: `app-shell.html#portal/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/07-customer-portal.md`](../../../../docs/features/07-customer-portal.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (3): `CustomerPortalSettings`, `CustomerPortalClientSettings`, `CustomerPortalProfileChangeRequest`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.portal`; the nav panel of the app is the `portal` entry in `../../core/apps.js`.
- Screens (27): `dashboard`, `clients`, `enable`, `client`, `users`, `user`, `invitations`, `invite`, `requests`, `approvals`, `approval`, `profile`, `access`, `branding`, `settings`, `activity`, `cp-dashboard`, `cp-projects`, `cp-project`, `cp-approvals`, `cp-requests`, `cp-request-new`, `cp-agreements`, `cp-billing`, `cp-documents`, `cp-messages`, `cp-team`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
