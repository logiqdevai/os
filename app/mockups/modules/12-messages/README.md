# Messages mockup

- App id: `messages` · open `app-shell.html#messages` (any route below: `app-shell.html#messages/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/12-messaging-team-communication.md`](../../../../docs/features/12-messaging-team-communication.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (36): `MessagingSettings`, `MessagingRetentionPolicy`, `ChannelTemplate`, `Channel`, `ChannelMember`, `ChannelNotificationSetting`, `ChannelMemberRestriction`, `Message`, `MessageVersion`, `MessageReaction`, `MessageMention`, `MessageAttachment`, `MessageLinkPreview`, `MessageRecordShare`, `MessageAcknowledgement`, `ChannelReadState`, `MessageReadReceipt`, `MessageThreadFollower`, `ChannelPin`, `SavedMessage`, `MessageReminder`, `MessageDraft`, `MessagingKeyword`, `ChannelSection`, `ChannelSectionItem`, `MessagingPresence`, `MessagingMemberSettings`, `MessageReport`, `MessagingExportJob`, `MessagingIntegration`, `ChannelCall`, `ChannelCallParticipant`, `MessagingUsageDaily`, `ChannelInvitation`, `ChannelAccessRequest`, `MessagingLegalHold`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.messages`; the nav panel of the app is the `messages` entry in `../../core/apps.js`.
- Screens (26): `home`, `threads`, `mentions`, `drafts`, `saved`, `search`, `calls`, `c-acme`, `c-dev`, `c-announce`, `c-client`, `dm`, `gdm`, `thread`, `actions`, `directory`, `create`, `chset`, `prefs`, `templates`, `admin`, `moderation`, `guests`, `retention`, `settings`, `integrations`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
