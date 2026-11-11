# Projects mockup

- App id: `projects` · open `app-shell.html#projects` (any route below: `app-shell.html#projects/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/05-project-management.md`](../../../../docs/features/05-project-management.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (33): `ProjectType`, `ProjectStatus`, `ProjectTemplate`, `ProjectTemplateVersion`, `Project`, `ProjectBranch`, `ProjectMember`, `ProjectStakeholder`, `ProjectFavorite`, `ProjectObjective`, `ProjectWorkstream`, `ProjectMilestone`, `ProjectDeliverable`, `ProjectAcceptanceCriterion`, `ProjectDependency`, `ProjectRisk`, `ProjectIssue`, `ProjectDecision`, `ProjectStatusUpdate`, `ProjectChangeRequest`, `ProjectGate`, `ProjectReview`, `ProjectAllocation`, `ProjectChecklist`, `ProjectChecklistItem`, `ProjectEscalation`, `ProjectHandover`, `ProjectCloseout`, `ProjectRelation`, `ProjectExternalReference`, `ProjectDeliverableReview`, `ProjectDeliverableApprover`, `ProjectStatusUpdateComment`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.projects`; the nav panel of the app is the `projects` entry in `../../core/apps.js`.
- Screens (10): `overview`, `list`, `create`, `detail`, `updateNew`, `milestones`, `timeline`, `raid`, `workload`, `settings`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
