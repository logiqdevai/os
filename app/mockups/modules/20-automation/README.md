# Automation mockup

- App id: `automation` · open `app-shell.html#automation` (any route below: `app-shell.html#automation/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/20-automation-engine.md`](../../../../docs/features/20-automation-engine.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (18): `AutomationSettings`, `AutomationTriggerDefinition`, `AutomationActionDefinition`, `AutomationRuleTemplate`, `AutomationRule`, `AutomationRuleVersion`, `PlatformEvent`, `AutomationRun`, `AutomationRunStep`, `AutomationApproval`, `AutomationApprovalPolicy`, `AutomationAiStep`, `AutomationRunLock`, `ScheduledJob`, `ScheduledJobRun`, `OutboundWebhook`, `WebhookDelivery`, `AutomationInboundWebhook`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.automation`; the nav panel of the app is the `automation` entry in `../../core/apps.js`.
- Screens (21): `overview`, `workflows`, `create`, `builder`, `workflow`, `runs`, `run`, `deadletter`, `approvals`, `jobs`, `jobNew`, `job`, `events`, `triggers`, `actions`, `templates`, `webhooks`, `webhookNew`, `agents`, `usage`, `settings`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
