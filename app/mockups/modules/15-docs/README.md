# Docs mockup

- App id: `docs` · open `app-shell.html#docs` (any route below: `app-shell.html#docs/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/15-notion-business-docs.md`](../../../../docs/features/15-notion-business-docs.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (32): `WikiSpace`, `WikiSpaceMember`, `WikiPageTemplate`, `WikiPage`, `WikiPageReviewer`, `WikiPageVersion`, `WikiPagePermission`, `WikiPageLink`, `WikiPageAttachment`, `WikiPageComment`, `WikiPageFavorite`, `WikiPageAcknowledgement`, `WikiChecklist`, `WikiChecklistItem`, `WikiChecklistRun`, `WikiChecklistRunItem`, `CustomForm`, `CustomFormVersion`, `FormAssignment`, `FormAssignmentRecipient`, `FormSubmission`, `FormSubmissionFile`, `WikiAiIndexEntry`, `WikiAiSuggestion`, `WikiPageView`, `WikiPageViewDaily`, `WikiSearchQuery`, `WikiPageFeedback`, `WikiTransferJob`, `WikiPageAckTarget`, `WikiPageWatcher`, `WikiPageReviewRequest`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.docs`; the nav panel of the app is the `docs` entry in `../../core/apps.js`.
- Screens (26): `home`, `spaces`, `spaceNew`, `space`, `spaceSettings`, `page`, `pageNew`, `history`, `share`, `search`, `templates`, `templateEdit`, `runbooks`, `onboarding`, `checklists`, `checklistEdit`, `runs`, `runDetail`, `reviews`, `forms`, `formBuilder`, `formResponses`, `ai`, `analytics`, `importExport`, `trash`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
