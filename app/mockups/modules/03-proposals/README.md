# Proposals mockup

- App id: `proposals` · open `app-shell.html#proposals` (any route below: `app-shell.html#proposals/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/03-proposal-quotation-generator.md`](../../../../docs/features/03-proposal-quotation-generator.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (15): `NumberSequence`, `ProposalTemplate`, `ProposalTemplateVersion`, `Proposal`, `ProposalVersion`, `ProposalSection`, `ProposalLineItem`, `ProposalPaymentScheduleItem`, `ProposalApproval`, `ProposalApprovalRule`, `ProposalComment`, `ProposalDelivery`, `ProposalEvent`, `ProposalAcceptance`, `ProposalAiFinding`
- Files: `views.js`. `views.js` registers `window.VIEWS.proposals`; the nav panel of the app is the `proposals` entry in `../../core/apps.js`.
- Screens (21): `list`, `create`, `editor`, `send`, `customer`, `accept`, `signed`, `compare`, `review-request`, `approval`, `comments`, `convert`, `ai`, `tracking`, `templates`, `template`, `template-new`, `rule`, `rule-new`, `analytics`, `analytics-pipeline`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
