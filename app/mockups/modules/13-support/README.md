# Support mockup

- App id: `support` · open `app-shell.html#support` (any route below: `app-shell.html#support/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/13-customer-support-communication-hub.md`](../../../../docs/features/13-customer-support-communication-hub.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (30): `SupportSettings`, `SupportInbox`, `SupportChannel`, `SupportConversation`, `SupportConversationParticipant`, `SupportMessage`, `SupportMessageAttachment`, `TicketStatus`, `TicketCategory`, `SlaPolicy`, `SlaPolicyTarget`, `Ticket`, `TicketConversation`, `TicketStatusHistory`, `TicketSlaTimer`, `TicketRelation`, `TicketTaskLink`, `TicketFollower`, `TicketAttachment`, `SupportIncident`, `SupportCsatRating`, `SupportCannedResponse`, `KnowledgeCategory`, `KnowledgeArticle`, `KnowledgeArticleVersion`, `KnowledgeArticleFeedback`, `SupportAiSession`, `SupportAiSuggestion`, `SupportIncidentUpdate`, `SupportAgentProfile`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.support`; the nav panel of the app is the `support` entry in `../../core/apps.js`.
- Screens (21): `inbox`, `conversation`, `tickets`, `ticket`, `ticket-create`, `knowledge`, `article`, `kb-categories`, `sla`, `sla-edit`, `setup`, `macros`, `channels`, `channel-create`, `widget`, `incidents`, `csat`, `analytics`, `automation`, `ai`, `settings`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
