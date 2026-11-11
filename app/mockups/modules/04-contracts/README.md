# Contracts mockup

- App id: `contracts` · open `app-shell.html#contracts` (any route below: `app-shell.html#contracts/<route>`, add `?theme=dark`)
- Feature spec: [`docs/features/04-contracts.md`](../../../../docs/features/04-contracts.md) (read its "Data model (Prisma)" and "Access channels & permissions" first)
- Owned Prisma models (25): `ContractType`, `ContractTemplate`, `ContractTemplateVersion`, `ContractClause`, `ContractClauseVersion`, `ContractApprovalRule`, `Contract`, `ContractParty`, `ContractSignatory`, `ContractProject`, `ContractVersion`, `ContractSection`, `ContractReview`, `ContractComment`, `ContractAiFinding`, `ContractChangeRequest`, `ContractApproval`, `SignatureRequest`, `Signer`, `SignatureEvent`, `SignatureConsentText`, `VerificationCode`, `ContractObligation`, `ContractTermination`, `ContractRenewalDecision`
- Files: `views.js`, `styles.css`. `views.js` registers `window.VIEWS.contracts`; the nav panel of the app is the `contracts` entry in `../../core/apps.js`.
- Screens (35): `dashboard`, `list`, `create`, `detail`, `editor`, `compare`, `review-request`, `negotiation`, `approval`, `rule`, `rule-new`, `send-signature`, `signatures`, `sign-verify`, `sign-document`, `sign-done`, `certificate`, `sign-invalid`, `obligations`, `obligation`, `obligation-new`, `extraction`, `renewals`, `renew`, `amend`, `terminate`, `templates`, `template`, `template-new`, `clause`, `clause-new`, `type`, `type-new`, `ai-review`, `analytics`

Every screen function carries `@screen @route @perm @api @mcp @data @ui @states @audit @note @gap` comments (legend: `../../README.md`) and ends with a Data model footer (review-only, do not ship).
