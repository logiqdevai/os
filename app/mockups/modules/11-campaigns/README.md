# Campaigns mockup

- App id: `campaigns` · open `app-shell.html#campaigns` (any route below: `app-shell.html#campaigns/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/11-communication-center.md`](../../../../docs/features/11-communication-center.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (30): `CommProviderAccount`, `CommSenderDomain`, `CommSenderIdentity`, `CommSignature`, `CommTemplate`, `CommTemplateVersion`, `CommTemplateTranslation`, `CommThread`, `CommMessage`, `CommMessageRecipient`, `CommMessageAttachment`, `CommMessageLink`, `CommDeliveryEvent`, `CommTrackedLink`, `CommRecipientList`, `CommRecipientListMember`, `Segment`, `CommConsent`, `CommSuppression`, `Campaign`, `CampaignAudience`, `CampaignRecipient`, `CampaignRun`, `CampaignApproval`, `CommDailyStat`, `CommAiGeneration`, `CampaignVariant`, `CommTopic`, `CommTopicSubscription`, `CommSettings`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.campaigns`; the nav panel of the app is the `campaigns` entry in `../../core/apps.js`.
- Screens (19): `overview`, `list`, `create`, `detail`, `segments`, `segment`, `segment-new`, `lists`, `templates`, `template`, `automations`, `messages`, `message`, `threads`, `consent`, `suppressions`, `analytics`, `senders`, `settings`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
