# Tasks mockup

- App id: `tasks` · open `app-shell.html#tasks` (any route below: `app-shell.html#tasks/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/06-task-management.md`](../../../../docs/features/06-task-management.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (16): `TaskStatus`, `TaskType`, `TaskLabel`, `Cycle`, `Task`, `TaskAssignee`, `TaskLabelAssignment`, `TaskDependency`, `TaskChecklistItem`, `TaskComment`, `TaskAttachment`, `TaskLink`, `TaskStatusHistory`, `TaskWatcher`, `Release`, `ReleaseDeployment`
- Files: `views.js`. `views.js` registers `window.VIEWS.tasks`; the nav panel of the app is the `tasks` entry in `../../core/apps.js`.
- Screens (12): `mine`, `all`, `create`, `board`, `backlog`, `timeline`, `detail`, `cycles`, `releases`, `workload`, `reports`, `settings`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
