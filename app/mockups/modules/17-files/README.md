# Files mockup

- App id: `files` · open `app-shell.html#files` (any route below: `app-shell.html#files/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/17-documents-file-management.md`](../../../../docs/features/17-documents-file-management.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (22): `DocumentSettings`, `DocumentCategory`, `DocumentStorageConnection`, `DocumentRetentionPolicy`, `FolderTemplate`, `Folder`, `Document`, `DocumentVersion`, `DocumentUploadJob`, `DocumentPreview`, `DocumentAttachment`, `DocumentFavorite`, `DocumentRecentAccess`, `DocumentShare`, `DocumentApproval`, `DocumentApprover`, `DocumentDeletionRequest`, `DocumentTemplate`, `VaultKey`, `VaultEntry`, `VaultEntryGrant`, `VaultAccessLog`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.files`; the nav panel of the app is the `files` entry in `../../core/apps.js`.
- Screens (19): `browse`, `recent`, `upload`, `doc`, `shares`, `sharenew`, `foldernew`, `tpl`, `vault`, `vaultnew`, `vaultentry`, `signatures`, `approvals`, `retention`, `trash`, `storage`, `search`, `templates`, `settings`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
