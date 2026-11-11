# Home mockup

- App id: `home` · open `app-shell.html#home` (any route below: `app-shell.html#home/<route>`, add `?theme=dark`)
- No spec and no tables: Home aggregates read-only summaries of other modules.
- Files: `views.js`. `views.js` registers `window.VIEWS.home`; the nav panel of the app is the `home` entry in `../../core/apps.js`.
- Screens (3): `overview`, `my-work`, `favorites`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
