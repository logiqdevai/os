# Logiqdev OS — implementation progress

Shared hand-off file for every agent working on the full-stack build. **Read this first, update it before you stop.**
Keep entries short: what exists, where it lives, what is left. Newest notes go at the top of "Log".

Goal: implement the production app from `docs/features/*`, `api/prisma/schema.prisma`, `app/mockups/**`,
`DESIGN.MD` and the rules in `AGENTS.md` / `.cursor/rules/*`, then test in Chrome and fix UI, function and responsiveness issues.
Missing functionality may be added to DB, API and UI.

## How to run

| What | Command | Notes |
| -- | -- | -- |
| API | `cd api && npm run start:staging` | SWC watch build (fast). Port 3000. Swagger at `/api`. Uses `.env.staging` (remote Postgres + Redis). If the port is stuck after a crash, kill the process that owns :3000. |
| API (many agents editing) | `bash api/scripts/dev-forever.sh` | `nest --watch` never settles while many files change on Windows. This loop rebuilds once `src/` is quiet for 6s, restarts the API, and revives it if it dies. Currently used by the coordinator. |
| API typecheck | `bash scripts/typecheck.sh api` (app: `bash scripts/typecheck.sh app`) | Serialized with a lock: run ONLY through this script, never plain tsc, so parallel agents don't exhaust RAM. SWC does not typecheck; run this before you finish (takes ~1–2 min). |
| App | `cd app && npm run dev` | Vite on 5173, `VITE_API_URL=http://localhost:3000` in `app/.env`. |
| App typecheck | `cd app && npx tsc -b` | |
| Migrate | `cd api && npx dotenv run -f .env.staging -- npx prisma migrate dev --name <name>` | Then `npx prisma generate` and `node docs/scripts/sync-feature-schema-refs.mjs`. |
| Seed | `cd api && npx dotenv run -f .env.staging -- npx prisma db seed` | Idempotent. Slow over the remote link (~5–10 min). |

Test accounts (staging, test data only):
- `owner@logiqdev.test` / `Password123!` — owner of org "Logiqdev" (all permissions, demo data from `scripts/demo-data.mjs`).
- `portal.customer@logiqdev.test` / `PortalTest-2026!` — customer portal user of Helios Energy (open `/portal`).
- `sam.signup@logiqdev.test` / `SignupTest-2026!` — owner of a fresh, nearly empty org "Sweep Studio" (sign-up flow test).
Get a token: `curl -s -X POST localhost:3000/auth/email/login -H 'content-type: application/json' -d '{"email":"owner@logiqdev.test","password":"Password123!"}'`.

DB facts: staging DB was wiped and rebuilt from the repo migrations on 2026-11-11 (user approved).
`prisma migrate reset` fails on this server (`max_locks_per_transaction`); wipe with a batched drop script instead (ask the user first).

## Architecture (keep consistent)

### API (`api/src`)
- **Platform services** (global, no import needed) in `shared/platform.module.ts`: `AuthorizationService`, `CredentialsService`,
  `AuditService`, `EventsService`, `McpRegistry`, `PrismaService`, guards.
- **Auth context**: `JwtGuard` accepts a user JWT or an API key (`lqk_…`, `Authorization: Bearer` or `X-Api-Key`).
  `PermissionsGuard` builds the `OrgContext` (`@CurrentOrg() ctx`): org from `X-Organization-Id` (users) or from the key.
  Decorators: `@RequirePermission(...keys)` (all), `@RequireAnyPermission(...)`, `@RequireOrgMember()` (self-service), `@Public()`.
  No decorator on an org endpoint = 403 (default deny).
- **Authorization**: `ctx.can(key)`, `ctx.scopeOf(key)` → `{organization, branch_ids, team_ids, project_ids, customer_ids, resource_ids}`;
  `authorization.inScope(ctx, key, record)`; `authorization.invalidate(orgId)` after any role/assignment/grant/module/membership change.
  Role templates (org_id null) are assigned directly; org custom roles live in `roles` with the org id.
- **Audit**: `audit.record(ctx, 'event.type', { resource_type, resource_id, branch_id, metadata: { before, after } })` on every write.
  Event types live in `shared/constants/audit-event-types.ts` (module 01); other modules may use their own `<resource>.<action>` strings.
- **Events**: `events.publish(ctx, { event_key: 'crm.deal.stage_changed', module, entity_type, entity_id, payload, activity: { summary, ... } })`
  writes `PlatformEvent` (+ `ActivityEvent` when `activity` is given) and emits on `events.bus` ('event') for automation/notifications.
- **MCP**: `POST /mcp` (JSON-RPC: initialize, tools/list, tools/call). Register tools in a `<feature>.mcp.ts` provider (`OnModuleInit`)
  with the same service methods and zod schemas as REST. Name `<module>_<resource>_<action>`. `sensitive: true` for deletes/sends/money/approvals.
- **Lists**: zod query schema extending `BaseListQuerySchema`; return `paginate(items, total, query)` → `{ data, pagination }`.
- **Register a module**: add one import + one line in `api/src/modules/feature-modules.ts`.
- **REFERENCE MODULE**: `api/src/modules/admin/teams/*` (dto, query schema, service with scope + audit + events, controller, mcp, module). Copy it.

### App (`app/src`)
- Rules: `.cursor/rules/app-shadcn-code-structure-and-best-practices.mdc`, `app/AGENTS.md` (shadcn only, never `<select>`).
- **Features are data-only**: `features/<area>/<resource>/{interfaces,services,hooks,validation-schemas}`. UI lives in `pages/<area>/**`.
- **Enum labels** only in `config/constants/dropdowns/<area>/*.options.ts` + `getDropdownOptionLabel()` from `lib/dropdown-option-label.utils.ts`.
- **API routes**: `config/api/modules/<area>.routes.ts`, added to `config/api/routes.ts` (one import + one key).
- **Routing**: each area has `pages/<area>/routes.tsx` (default export with nested `<Routes>`, lazy-loaded by `routes/module-routes.tsx`).
  Public/customer routes (portal, signing pages, booking pages) go in `routes/public-routes.tsx`.
- **Navigation**: one file per app in `config/apps/modules/<app>.app.ts` (rail entry, context panel nav with per-item permissions, "New" action).
- **Session & permissions**: `useSession()`, `usePermissions()` / `usePermission(key)`, `<Can permission|anyOf|allOf>`, `<RequirePermission>` route gate.
- **Shared UI**: `components/ui/page.tsx` (Page, PageHeader, Section, KeyValueList), `data-table.tsx` (DataTable, TableToolbar),
  `states.tsx` (EmptyState, ErrorState, NoAccessState, ListSkeleton, PageSkeleton), `stat-card.tsx`, `badge.tsx` (variants info/success/warning/danger/violet/neutral),
  `confirmation-dialog.tsx`, `hooks/use-list-params.ts` (URL-synced page/search/filters), `lib/format.ts` (dates, money, minutes, names), `lib/api-error.ts`.
- **Theme**: semantic tokens only (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-info-soft text-info`, …). Never hard-code colors. Check light + dark.
- **Responsive**: rail hidden < md (sheet nav), context panel → sheet < lg. Pages must work at 375px: stack toolbars, `hideBelow` on table columns, no horizontal page scroll.
- **REFERENCE PAGE**: `pages/admin/pages/teams/*` + `features/admin/teams/*` (list with URL filters, form dialog, row actions, confirm dialog, toasts).

### Notifications payload contract (14 fan-out)

Any module gets in-app notifications for free by publishing an event with these payload fields (`api/src/modules/notifications/notifications.fanout.ts`).
Include a field only when that person should be told (e.g. send `owner_membership_id` only when ownership is newly given). The actor is never notified;
one notification per person per event (strongest reason wins, in this order):

| Payload field | Category | Default title |
| -- | -- | -- |
| `mentioned_membership_ids: string[]` | MENTION | "X mentioned you in <label>" |
| `approver_membership_ids: string[]` | APPROVAL (shows under "Waiting on you") | "X requested your approval: <label>" |
| `assignee_membership_id` / `assignee_membership_ids` | ASSIGNMENT | "X assigned <label> to you" |
| `owner_membership_id` | ASSIGNMENT | same |
| `attendee_membership_ids: string[]` | INVITATION | "X invited you to <label>" |
| `watcher_membership_ids: string[]` | STATUS_CHANGE | `activity.summary` |
| `recipient_membership_ids: string[]` | `notification_category` ?? GENERAL | `activity.summary` |

Optional: `link` (in-app path opened on click, e.g. `/tasks/WEB-142`), `notification_title`, `notification_body`, `notification_priority` (LOW/NORMAL/IMPORTANT/CRITICAL),
`entity_label` (else `activity.entity_label`), `project_id` / `company_id`. Pass `entity_type` + `entity_id` on the event so record mutes work.
Or call `NotificationsService.notify(ctx, { recipient_membership_ids, event_key, module, title, body, link, category, priority, requires_action, actions, entity_type, entity_id, entity_label, idempotency_key })`
(import `NotificationsModule`). Event types register themselves in the catalog on first use. Never put PRIVATE content in `activity` (the org feed shows it).

## Known pitfalls

- **Prisma: `{}` inside `OR` matches nothing** (verified on this Prisma 7 client: `OR: [{}]` → 0 rows). Scope helpers that
  return `{}` for organization-wide scope are safe when spread into a where object, but NOT inside `OR: [...]`. When
  combining "scope OR own records", return a real condition (e.g. `{ organization_id: ctx.organization_id }`) or skip
  the `OR` for organization-wide scope. Owner-level list totals were audited against DB counts for 30 list endpoints
  on 2026-11-11 (all match); branch/team-scoped roles still need the same audit.

## Schema change requests

Parallel agents must NOT run migrations (shared DB). If a feature truly needs a schema change, add a line here
(`module — model/field — why`) and work around it with existing fields until the coordinator applies it.

- (none yet)
- ✅ APPLIED (migration 20261111220000) 03 — `ProposalComment.author_name String?` — customers commenting on the public link are not always the CRM contact; today a non-matching name is prefixed into `body`.
- ✅ DONE (code; column already existed) 04 — store drawn signatures as a Document (17) in `Signer.signature_document_id`; until Documents storage is wired the PNG data URL lives in the `SignatureEvent` payload (SIGNED).
- ✅ APPLIED (migration 20261111220000) 06 — `Task @@unique([organization_id, number])` → `@@unique([team_id, number])` (+ per-team counter) — Linear numbers per team (WEB-1, APP-1). Today numbers are org-wide (NumberSequence `task`/`TASK`), so identifiers read WEB-12, APP-13. Workaround works; change only if per-team numbering is wanted.

## Status by area

Legend: ✅ done · 🟡 partial · ⬜ not started

| # | Area | API | App | Owner / notes |
| -- | -- | -- | -- | -- |
| — | DB: migrations + seed on staging | ✅ | — | |
| F | Foundation: auth+orgs, authz, audit, events, MCP, API keys, shell, theme, auth pages | ✅ | ✅ | coordinator |
| 01 | Admin + personal settings | ✅ | ✅ | Typechecked only (servers were down) — needs a Chrome pass. Left: sessions admin view, SSO/domains/security policy, access reviews, delegations, portal users, webhooks screens |
| 00/14/19 | Home, Notifications, Calendar | ✅ | ✅ | `api/src/modules/notifications` (inbox, preferences, activity, announcements, **event-bus fan-out**, `NotificationsService.notify()`), `api/src/modules/calendar` (events + RRULE expansion, calendars/sharing, event types, prefs, availability/free-busy/suggest, resources, booking links, bookings, public `/public/booking-links/*`, reminders job). App `pages/home`, `pages/notifications`, `pages/calendar`, public `/book/:orgSlug/:slug`, rail unread badge (30s poll). Typechecked; notifications API curl-tested before the servers stopped, calendar API not yet run live. Left: email/push delivery + digests, admin screens (event catalog, templates, org defaults, delivery rules, delivery log), announcement audience picker (API supports team/branch/member audience), resource picker in the event form, edit-one-occurrence of a series, external calendar sync + conferencing, iCal feed, projected dates (milestones/tasks/leave) on the grid. |
| 02 | CRM | ✅ | ✅ | `api/src/modules/crm` (CrmModule: companies, contacts, leads+convert, deals+board/stage/won/lost/line items, pipelines, activities, notes, settings, dashboard, forecast, platform tags + saved views; `GET /crm/companies/lookup`, `/crm/contacts/lookup`, `/crm/members`). App `pages/crm`. Left: custom fields, saved-views UI, import, merge/duplicates inbox, bulk actions, targets, assignment/scoring rules, reports. Not yet run against a live API (servers were stopped). |
| 03/04 | Proposals, Contracts | ✅ | ✅ | API+app typecheck clean; not yet exercised against a running API (servers were stopped). Left: AI generation/review, PDF (needs 17), customer reminders before expiry, tracking page across proposals, contract analytics, AI review/obligation extraction, SMS codes |
| 05/06 | Projects, Tasks | ✅ | ✅ | `api/src/modules/projects` (projects CRUD + lifecycle complete/reopen/archive, members, favorites, portfolio KPIs, cross-project milestones/RAID/workload, children: milestones, workstreams, deliverables (+submit/review, accept on behalf), risks, issues, decisions, dependencies, status updates (+publish → health), change requests (+decide), allocations; types/statuses/templates with lazy defaults + create-from-template; `GET /projects/lookup`, `/projects/people`). `api/src/modules/tasks` (tasks with atomic `<KEY>-<n>` numbering, board/move with fractional rank, bulk, comments internal/customer, checklist, links, watchers, attachments (metadata → Document), activity, workload, `GET /tasks/lookup`, `/tasks/people`; per-team workflows, types, labels; cycles + burndown + complete/carry-over; releases + deployments). App `pages/projects`, `pages/tasks` (quick create on "c"). Typechecked only (servers were stopped) — needs a live curl + Chrome pass. Left: Gantt timeline, gates/reviews/handovers/closeout screens, saved views, AI status-update draft, task reports page, release-notes AI. |
| 08/09 | Billing, Income & expenses | ✅ | ✅ | API `modules/billing` (`/finance/*`, `/webhooks/payments/:id`), `modules/ledger` (`/ledger/*`), shared `modules/finance-shared`, Stripe adapter `integrations/payments`. App `/billing/*`, `/expenses/*`, print `/print/invoices/:id`. Not yet curl-tested (servers stopped). |
| 10/18 | People, Time | ✅ | ✅ | agent 10/18 — typecheck clean, not run against a live API (servers stopped). REST under `/people/*` and `/time/*`. Left: org-chart screen, change-requests screen, onboarding/offboarding checklists (15), employee import, PIPs/feedback requests/calibration UI, HR settings + leave types/policies/holidays UI (API done), time suggestions, imports, report schedules, project time settings UI |
| 11/12 | Campaigns, Messages | ✅ | ✅ | agent 11/12 — not yet run against a live API (servers were stopped); typecheck clean. Left: A/B variants, topics/preference center UI, recurring campaigns (RRULE), recipient-timezone send, AI assistant, threads view (CommThread), message attachments upload, calls, moderation/retention/admin screens of 12 |
| 07/13 | Client portal, Support | ✅ | ✅ | agent 07/13 — typechecked only (servers stopped) — needs live curl + Chrome pass. API `modules/support` (`/support/*`, public `/help/:orgSlug`, `/help/csat/:token`, SLA cron) and `modules/portal` (agency `/portal/admin/*`, customer `/portal/*` behind `PortalGuard` + `X-Portal-Membership-Id`). App `/support/*` (3-pane inbox), `/client-portal/*`, customer shell `/portal/*`. Left: email in/out for EMAIL channels (11), widget JS + live chat realtime, automation rules tab (20), AI agent sessions/suggestion queue UI, incidents UI (API done), KB categories reorder UI, portal document upload (17), proposal accept / contract sign inside the portal (links to `/p/:token`, `/sign/:token` need the token), portal notification preferences (14). **Needs coordinator (shared files):** after accepting a CUSTOMER_PORTAL invitation, `pages/auth/pages/invite` and sign-up go to `/home`, and `components/layout/no-organization.tsx` shows "create organization" — route users with `session.customer_memberships.length` (or invite audience CUSTOMER_PORTAL) to `/portal`. |
| 15/17/20 | Docs, Files, Automation | ✅ | ✅ | API: `modules/{docs,files,automation}` · App: `pages/{docs,files,automation}`, public `/f/:formId`, `/share/:token`. Not curl-verified (servers were stopped) — typechecked only |
| T | Chrome testing pass (functionality, responsiveness, both themes) | ✅ | 🟡 | 2026-11-11: automated sweep of all 175 nav routes + ~31 detail pages at 1280px and 390px (crashes, load errors, overflow); manual flows verified (see Log). Left: drag-and-drop (not automatable here), remaining manual flows listed in Log. |

## Log

- 2026-11-11 — Integration + Chrome QA pass (coordinator). Demo data via `scripts/demo-data.mjs`. Verified in Chrome: sign-up → new org,
  task create/checklist/comment, CRM company → deal → stage change, board "Move to", invoice create → approve (number + ledger
  income) → record payment, proposal send → public link accept, contract approve → send → OTP verify → sign → certificate,
  messages send, support internal note, calendar event, timer start/stop, customer portal (Helios), automation (deal won runs
  the published workflow), file upload/download (API). Owner list totals == DB counts for 30 endpoints.
  Fixed (one commit each): Automation module not registered; profile form inputs; Campaigns/CRM/portal grid overflow (+ global
  `.grid > * { min-width: 0 }`); CRM owner placeholder; task sidebar width; board menu click-through; task descriptions as
  Markdown; Markdown renderer infinite loop (froze tabs); Tailwind v4 `w-[var(--…)]` classes (picker widths); leave activity
  'Unknown' name; contract `{{placeholders}}` reaching signers (fill on approval + guard) and header Send for signature;
  Messages conversation width + duplicate sidebar (`ownSidebar` app flag); CORS for X-Portal-Membership-Id/X-Proposal-Access;
  app-wide TooltipProvider + error boundary on public routes; automation catalog deal fields.
  Still open: scoped-role (branch/team) list audit for the Prisma `{}`-in-OR pitfall; default portal role cannot list
  requests (catalog has no portal.requests.read); manual flows not yet clicked: admin invite UI, campaign wizard send, leave
  request UI, docs editing, vault reveal, booking page; email/SMS delivery needs org Resend/Twilio keys (BYOK).
- 2026-11-11 — 13 Support + 07 Client portal (API + app). Support: settings (lazy defaults: 6 statuses, default inbox, "Standard"
  SLA), inboxes/channels/agent profiles, unified-inbox conversations (views + counts, reply vs INTERNAL_NOTE, @mentions, assign,
  snooze, pending, resolve/reopen, merge, participants), shared message engine that updates linked tickets (first/next response,
  customer reply reopens), tickets (numbering via NumberingService `ticket` → `<prefix>-<n>`, workflow transitions with history,
  assign/escalate/merge/follow/relations/link conversation, convert to task reusing `tasks/utils` numbering + TaskLink/TicketTaskLink),
  SLA policies + timers (business hours from Organization.business_hours, pause on `pauses_sla`, minute cron: at-risk, breached,
  unsnooze, auto-close), CSAT (request on resolve, public token page, portal rating), canned responses with placeholder render,
  knowledge base (versions, review/publish, public help center per org slug), incidents + updates, analytics overview, optional AI
  (org OpenAI connection; degrades to KB matches). MCP: `support_*` (19 tools). Portal: `PortalGuard` evaluates only `portal.*`
  keys of the membership's customer role on every request; agency admin (overview, settings/branding/features, clients enable/
  disable, users, invitations with audience CUSTOMER_PORTAL, profile-change review → CRM write, activity, approvals); customer API
  (me/memberships, dashboard, projects, deliverable review, requests = PORTAL tickets, conversations, documents, proposals,
  contracts, invoices with pay link, help, company + profile changes, team invites). Internal notes/SYSTEM messages never leave
  the agency API. MCP: `portal_*` (6 tools). App: Support (inbox, tickets, ticket, new ticket, KB list/editor, SLA, saved replies,
  inboxes & channels, analytics + CSAT, settings incl. statuses/categories), Client portal admin (overview, clients, client, users +
  invite, requests, approvals, profile changes, activity, settings), customer portal shell `/portal/*` (company picker, no-access
  state, branded top nav, 13 screens).

- 2026-11-11 — **15 Docs, 17 Files, 20 Automation** (API + app).
  - **Docs** (`api/src/modules/docs`): spaces + members, page tree (move/order), Markdown pages with a version per save + restore, publish/unpublish,
    page permissions, comments, favorites, acknowledgements, templates, links/backlinks (`[[Page]]`), search (title + content), trash/archive,
    view analytics, checklists + runs, custom forms (builder schema, versions on publish, assignments, submissions, review, summary) and a
    `@Public()` form endpoint (`/public/forms/:id`, published + anonymous forms only). App: home/search, spaces, space tree layout (sheet on
    mobile), page view (comments/history/backlinks sheets), Markdown editor + preview (`components/ui/markdown.tsx`, safe renderer, no deps),
    templates, checklists + runs, forms builder/responses/assign/share, fill page, public form `/f/:formId`, trash.
  - **Files** (`api/src/modules/files`): `StorageService` (local disk under `api/storage/`, GCS driver when configured), folders tree, documents +
    versions, multipart upload (size/MIME/executable checks, quota), signed download tokens, favorites/recent, shares (member/team/link with
    token + expiry + bcrypt password, public resolve/access), version-bound approvals, retention + legal hold, deletion requests (2-person),
    storage usage, vault (AES-GCM via `shared/utils/crypto/secret-box.utils.ts`, reveal/copy logged in VaultAccessLog + audit, grants). App:
    browser (folder tree, grid/list, drag & drop upload with per-file progress), document detail (preview, versions, shares, approvals, hold),
    recent & favorites, shared, approvals, trash (+ delete-forever request/approve), vault (confirm → reveal with auto-hide), public `/share/:token`.
  - **Other modules attach files** by injecting `DocumentsService` (exported by `FilesModule`): `documents.attachToEntity(ctx, { buffer, filename,
    mimetype, entity_type, entity_id, title?, folder_id?, project_id?, company_id?, role? })`, or over HTTP: `POST /files/upload` multipart with
    field `file` + optional `folder_id`, `document_id` (new version), `title`, `category_id`, `entity_type` + `entity_id`, `change_note`
    (needs `documents.documents.create` or `.update`) → the document row. Download: `GET /files/documents/:id/download-url` → `{ path }` (signed, public).
  - **Automation** (`api/src/modules/automation`): trigger catalog (+ keys discovered on the bus), action catalog — module actions run through the
    module's **MCP tool** under `AuthorizationService.contextFor(run-as service account | owner)`, so permissions are never bypassed; built-ins:
    condition gate, wait, approval, notify (NotificationsService), call webhook, run any tool. Rules: CRUD, drafts of live rules, publish →
    immutable versions, restore version, enable/disable, duplicate, import/export, templates, dry run / test run, run now. Engine consumes
    `EventsService.bus` ('event'), sets `PlatformEvent.rules_processed_at`, loop protection via AsyncLocalStorage → `causation_run_id` +
    `trigger_depth`, idempotency keys, per-rule/org rate limits, per-record locks, retries with backoff → dead letter + alert, approvals.
    Scheduled jobs on `SchedulerRegistry` (cron/interval/once, DB lease, retries); outbound webhooks (HMAC `t=…,v1=…` signing, retries,
    auto-disable, test send, secret rotation with 24 h grace); inbound webhooks `POST /automation/hooks/in/:slug` (`@Public()`, HMAC / bearer / basic,
    IP allow-list, rate limit) → event `inbound_webhook.<slug>`; event log + reprocess; usage; settings. App: overview, workflows, form-based
    builder (trigger → conditions → ordered steps → settings), workflow detail (versions, runs, test, publish), runs + run detail (steps,
    approve inline), approvals, event log, webhooks (outbound/inbound/deliveries), scheduled jobs + detail, settings + usage.
  - **For other modules**: publish events with `EventsService.publish` and add the key to `automation/catalog/trigger-catalog.ts`; expose
    actions as MCP tools and list them in `catalog/action-catalog.ts`; host recurring work with `JobHandlerRegistry.register({ key, module, name,
    description, run })` + `SchedulerService.ensureJob({ organization_id, module, key, name, handler, kind, cron_expression|interval_seconds })`
    (both exported by `AutomationModule`).

- 2026-11-11 — 08 Billing + 09 Income & expenses (API + app). Billing: catalog (products/prices/tax rates/coupons), billing profiles,
  invoices (draft → approve with FinanceApprovalRule + separation of duties → send/finalize with gap-free NumberingService numbers →
  paid/partially paid/overdue/void/write-off, Decimal line + coupon math), payments + allocations, refunds (approval rule aware,
  Stripe refund through the adapter), credit notes, subscriptions (daily `billing-daily` cron: invoice each period in advance, roll
  periods, scheduled cancel, overdue marking, dunning steps), payment links, BYOK Stripe connections (keys verified, stored encrypted in
  an IntegrationConnection via `shared/utils/crypto`), hosted checkout, signature-verified idempotent webhook, dashboard KPIs + CSV
  reports, approval inbox, MCP tools. Ledger: settings, default category tree (lazy), payment methods, suppliers (CRM vendors + profile,
  encrypted bank details), records with VAT calc / approval threshold / period lock / settlements / attachments metadata / void,
  invoice+payment sync from Billing (`LedgerSyncService`, one record per invoice, settlements rebuilt from Billing), recurring expenses
  (`ledger-recurring-expenses` cron), expense claims (own vs approve → reimbursement payroll entry → paid expense), budgets with
  actuals, periods (close/reopen/lock + stored summaries), VAT report + returns, P&L with comparison, profitability (time cost from 18),
  insights (unusual / duplicate / budget alerts, nightly cron). Bodies validated with the same zod schemas as MCP (`ZodBodyPipe`).
  Left: PDF file generation (print view only), e-mail delivery of invoices/reminders (events published for 11), Viva Wallet adapter,
  supplier invoice OCR imports, payroll schedules UI, saved report schedules, invoice templates/numbering settings UI, curl/Chrome test pass.

- 2026-11-11 — **03 Proposals + 04 Contracts** (API `modules/proposals`, `modules/contracts`; app `pages/proposals`, `pages/contracts`; public `/p/:token`, `/sign/:token`).
  Proposals: CRUD + lookups, versions (sent = locked + content hash; revisions/restore/compare), sections (markdown), line items/discounts/tax with
  server-side totals, payment schedule, templates (versioned) + approval rules → submit/approve/reject chain, send (checklist, public token link,
  Resend email when configured), public view (VIEWED tracking, optional items quote, accept with typed-name signature / decline / request changes,
  comments, EMAIL_VERIFIED code access), analytics, convert accepted → contract via `ContractsService.create`, hourly expiry job, 14 MCP tools.
  Contracts: types/templates/clauses/approval rules, contracts CRUD (confidential terms stripped without `contracts.confidential_terms.read`),
  parties/signatories, projects, versions + compare, review/approval, comments (internal/external, blocking), obligations, renewals, renew/amend/terminate,
  in-house e-signature (sequential/parallel, emailed one-time code, typed or drawn signature, consent text, event trail, certificate).
  Events carry `owner_membership_id` / `approver_membership_ids`. Shared `lib/markdown.ts` renders document bodies safely.
- 2026-11-11 — **10 People + 18 Time** (agent 10/18). API `api/src/modules/people` (PeopleModule): employees (member or new hire → pending INVITED membership, EMP numbers via NumberingService, field-level stripping with `restricted_fields`, position history, onboarding/offboarding, availability, self-service edits + change requests), emergency contacts, languages, compensation (sensitive, read audited), equipment, HR documents, HR notes, work schedules, leave types/policies/holidays (defaults created lazily), leave requests (working days = schedule − company/branch holidays, half days, overlap/notice/balance checks, approval chain from `leave_approver_strategy`, balance ledger, availability projection), leave calendar, balances + adjust, attendance (clock in/out, breaks, lateness/overtime, who-is-in board, manual edits), capacity (available − leave − holidays vs 05 allocations vs 18 logged, materialized to EmployeeCapacityPeriod), skills + find-people, performance (cycles/launch, review workflow, goals + check-ins with roll-up, feedback), HR settings, dashboard overview; 20 MCP tools `employees_*`. Time API `api/src/modules/time` (TimeModule) as built by the Time sub-agent. Events carry `owner_membership_id` / `approver_membership_ids`. App: `/people` (employees table + directory cards, add employee, profile tabs, leave requests/calendar/balances + request-leave dialog with preview, attendance clock card + board, capacity, skills, performance + review page, dashboard) and `/time` (week grid with inline hours + timer, mobile day list, entries with scopes, team timesheets, approvals, timesheet detail, rates, reports with recharts, ready to invoice, settings).
- 2026-11-11 — **11 Communication Center + 12 Messaging** (agent 11/12). Packages: `@nestjs/websockets` + `@nestjs/platform-socket.io` ~12.2.0 installed in `api/` (matches @nestjs/core 12.2.0).
  **11 API** (`api/src/modules/communications`): `/communications/campaigns` CRUD + `PUT /:id/audience`, `POST /:id/audience/resolve` (dry run), `/:id/preflight`, `/:id/test` (≤5 test sends), `/:id/submit|approve|reject` (approve = communications.campaigns.approve), `/:id/schedule` (omit scheduled_at = send now; communications.campaigns.send), `/:id/unschedule|pause|resume|cancel|duplicate|archive|restore`, `GET /:id/stats|recipients`; `/communications/templates` CRUD + versions (`POST /:id/versions` draft, `/:id/versions/:v/publish`), `POST /templates/preview` (sample or contact values, `{{var | fallback}}`, missing vars, SMS segments); `/communications/lists` (+members add/import/remove), `/communications/segments` (+`fields`, `preview`, `/:id/members`, `/:id/refresh`) — definition `{and|or:[{field,op,value}]}` evaluated read-only on crm_contacts (company fields, tags, consent, dates); `/communications/consents` (+`PUT /:contactId/:channel`), `/communications/suppressions` (+remove); `/communications/messages` (log with filters, compose/send one-off, `/:id/send|resend|cancel|archive`); `/communications/sender-domains` (Resend domain create/verify, DNS records) + `/sender-identities`; `/communications/overview`, `/analytics/summary`, `/provider-status`, `/settings` (approval policy, footer). Delivery: BYOK — `CommProviderService` resolves the org's ACTIVE `IntegrationConnection` (Resend / Twilio; PLATFORM-source rows read env) and never crashes: no connection → message FAILED "No email provider connected. Connect Resend in Admin → Integrations." Suppression + consent enforced in `CommDispatchService.dispatch` on every send. Worker: `CampaignRunnerService` `@Interval(15s)` (BullMQ queues module is not imported in AppModule) — starts due campaigns (re-checks the scheduler still holds communications.campaigns.send, via the audit trail), resolves audience, creates CampaignRun + CampaignRecipient + one CommMessage each, dispatches in batches of 100 with throttling, retries with backoff, recovers stuck SENDING, completes campaigns. Tracking (public): `GET /communications/t/o/:messageId` (pixel), `GET /t/c/:token?m=` (click redirect), `GET|POST /communications/u/:token` (unsubscribe page + RFC 8058 one-click), webhooks `POST /communications/webhooks/resend/:webhookToken` (svix-verified with the connection's webhook_secret) and `/webhooks/twilio/:webhookToken` (X-Twilio-Signature). `CommStatsService` keeps CommDeliveryEvent (idempotent), message/recipient status, Campaign counters, CommDailyStat and auto-suppression (hard bounce, complaint, unsubscribe) consistent. Every write audited (`communications.*`) + published. 33 MCP tools (`communications_campaigns_send|approve|cancel`, `communications_messages_send`, `communications_suppressions_manage`, `communications_consents_manage` sensitive).
  **11 App** (`pages/campaigns`): overview (KPIs gated by analytics.read, provider status, live/upcoming, recent, daily chart), all campaigns, wizard `/campaigns/new` + `/:id/edit` (audience → content with template + live preview → schedule/throttle/consent/tracking → review with preflight, counts, test send, submit/approve/send), detail (results + chart + top links, recipients, content, approvals & runs, pause/resume/cancel/unschedule/duplicate), analytics, segments + rule builder with live count, lists + paste/CSV import, templates + editor (versions, publish, variables, preview), suppressions & consent, message log + compose + message detail (delivery timeline, resend/cancel), senders & settings (identities, domains with DNS records, approval policy, footer). Nav: suppressions gated by suppressions.manage/consents.read, senders by sender_identities.manage/settings.manage.
  **12 API** (`api/src/modules/messaging`): channels (mine with unread/mention counts, browse, CRUD, archive, join/leave, members, preferences favorite/mute), `POST /messaging/dms` (dm_key de-dup), messages (cursor pages, post with client_message_id idempotency, mentions `@[Name](membershipId)` + @channel/@here, edit with MessageVersion, delete, reactions, pins, save, thread + follow + read), read state, drafts, search, threads/mentions/saved inboxes, directory, presence. Socket.IO namespace `/messaging` (handshake via CredentialsService + AuthorizationService, CORS = HTTP CORS): `message.created|updated|deleted`, `reaction.updated`, `typing`, `read`, `channel.created|updated|removed`, `member.updated`, `mention.created`, `saved.updated`, `presence`. 17 MCP tools `messaging_channels_list|browse|get|create|join`, `messaging_channel_members_add`, `messaging_dms_open`, `messaging_messages_list|thread|post|search|react|pin|delete`, `messaging_mentions_list`, `messaging_threads_list`, `messaging_directory_search` (messages_post sensitive=false).
  **12 App** (`pages/messages`): Slack-like layout filling the main area — in-page channel sidebar (favorites, channels, DMs, unread/mention badges, live dot), conversation (day separators, grouping, load-older on scroll, pins popover, members dialog, favorite/mute/archive/leave, join banner for public channels), composer (Enter sends, Shift+Enter newline, @mention autocomplete with Popover+Command, server-side draft autosave, typing, optimistic send), threads side panel (Sheet on mobile, follow), reactions, edit/delete, save, channel browser, create channel, new DM / group DM, threads / mentions / saved / search inboxes. Mobile: channel list and conversation are separate screens.

- 2026-11-11 — **05 Projects + 06 Tasks** (agent 05/06). Scope: org-wide holders see all; others see projects in their branch/team/project/customer scope plus projects they own or are members of; tasks additionally where they are assignee/reporter/watcher (404 out of scope). Every write audited + published (`projects.*`, `tasks.task.created|updated|status_changed|completed|assigned|commented` with `assignee_membership_ids`, `watcher_membership_ids`, `mentioned_membership_ids`). MCP: `projects_projects_list|lookup|get|create|update|complete`, `projects_portfolio_read`, `projects_milestones_list|create|update`, `projects_raid_list`, `projects_risks_create`, `projects_issues_create`, `projects_status_updates_publish`, `tasks_tasks_list|lookup|get|create|update|assign|delete`, `tasks_comments_create`, `tasks_bulk_execute`, `tasks_workload_read`, `tasks_cycles_list`, `tasks_workflows_read`. Shared UI added: `components/ui/member-avatar.tsx`, `entity-picker.tsx` (Popover+Command combobox), `progress-bar.tsx`. Nav fixed: tasks Setup uses `tasks.workflows.manage` (tasks.settings.manage does not exist). Board drag uses native HTML5 DnD + a "Move to" menu for touch (no dnd-kit dependency added).

- 2026-11-11 — **00 Home, 14 Notifications, 19 Calendar** (agent 00/14/19). API `notifications`: `GET /notifications` (state unread|read|all|archived|snoozed|action, module, category, search), `GET /notifications/unread-count`, `PATCH /notifications/:id` (read/archived/snoozed_until), `POST /notifications/:id/open|actions`, `POST /notifications/read-all|seen|bulk`; `/notifications/preferences/settings|events|events/:id|subscriptions` (notifications.preferences.manage_own); `GET /activity` (notifications.activity.read, scope-limited), `GET /activity/mine`; `/announcements` CRUD + publish/withdraw (notifications.announcements.manage*), `GET /announcements/live`, `POST /announcements/:id/acknowledge`; scheduled publish/expiry job; event-bus fan-out + `notify()`; 8 MCP tools. API `calendar`: `/calendar/events` (range list with server-side RRULE expansion DAILY/WEEKLY(BYDAY)/MONTHLY + INTERVAL/COUNT/UNTIL, CRUD, `/respond`, `/cancel` incl. one occurrence), `/calendar/calendars` (+shares, archive), `/calendar/event-types` (system types seeded per org on first use), `/calendar/preferences/me`, `/calendar/people|teams`, `/calendar/availability/schedules|free-busy|suggest`, `/calendar/resources` (+requests approve/decline, conflict 409), `/calendar/booking-links` (+slots preview, 30-day stats), `/calendar/bookings` (+confirm/cancel/no-show/complete), public `GET /public/booking-links/:orgSlug/:slug`, `GET /public/booking-links/:id/slots`, `POST /public/booking-links/:id/bookings` (re-check → 409 with fresh slots, per-IP rate limit); reminders job (60s) → 14; 10 MCP tools. Personal calendar auto-created per member. Private events are masked to "Busy" everywhere. App: Home (overview widgets gated by module read keys, my work, favorites & recent), Notifications (inbox tabs + filters + row actions + snooze, detail, preferences, activity feed, announcements), Calendar (day/week/month CSS-grid views + agenda — default on phones, event dialog, event detail with RSVP/cancel/delete, team availability, booking links, bookings, my availability, calendars + sharing, rooms & resources), public booking page.
- 2026-11-11 — **01 Admin + settings** (agent 01). API (`api/src/modules/admin/*`, bundled in `admin.module.ts`): overview `GET /admin/overview`;
  members (`/members` list+filters, detail, effective-permissions with sources, PATCH, suspend/reactivate/offboard, role-assignments with scope+expiry,
  branches, per-member module-access); invitations (`/invitations` list/create(emails[])/resend/cancel — sha256 token, email via Resend, link returned when not sent);
  branches (CRUD, hierarchy re-rooting, HQ, archive/restore); roles (templates + custom, clone, draft→publish with RoleVersion, deprecate; privilege-escalation check);
  `/permissions` catalog, `/permissions/simulate` (AuthorizationService.explain), `/permission-grants` allow/deny; `/organization` profile, `/organization/branding`,
  `/organization/modules`; `/api-keys` (secret once, rotate, revoke); `/service-accounts` (+roles, suspend/revoke); `/mcp-calls` (+confirm/reject, re-runs as the
  original caller); `/audit-events` (+types, detail); `/integrations` (BYOK, AES-256-GCM in `shared/utils/crypto/secret-box.utils.ts`, live verify for OpenAI/Resend/Stripe/Twilio,
  default per category+mode, enable/disable, disconnect). Last-owner rule = holders of `users.members.transfer_ownership`. MCP tools for each resource.
  Shared edits: `core/mcp/mcp.service.ts` stores parked args in Redis (`mcp:pending:<id>`) and updates the parked row on confirm; `AuthorizationService.compute`
  now enforces `MembershipModuleAccess` (blocked modules per member); audit types `membership.updated`, `service_account.updated`, `mcp_call.confirmed|rejected`.
  App: every /admin screen (overview, members + detail tabs, invitations, teams + team detail, branches tree, roles + editor, catalog, simulate, modules,
  API keys, service accounts + detail, MCP calls, audit + event sheet, integrations + detail, profile, branding) and /settings (profile, password, appearance, sessions).

- 2026-11-11 — CRM (02) built. API `CrmModule` (registered in feature-modules): REST + MCP (`crm_companies_*`, `crm_contacts_*`, `crm_leads_*` incl. convert, `crm_deals_*` incl. board/change_stage/assign, `crm_activities_*`, `crm_notes_*`, `crm_pipelines_*`, `crm_settings_list`, `crm_members_list`, `crm_dashboards_read`, `crm_forecast_read`). Scope = owner/secondary owner, team, branch, customer/resource ids; money fields nulled without `crm.financials.read`; CSV exports audited; 409 `possible_duplicates` on create (name/domain/email) with `allow_duplicate`. Defaults (Sales pipeline, statuses, lifecycle, sources, loss reasons) are provisioned lazily per org (`CrmDefaultsService.ensure`). Events carry `owner_membership_id` / `assignee_membership_ids` (`crm.deal.stage_changed|won|lost|assigned`, `crm.lead.*`, `crm.activity.*`, `crm.note.mentioned`, …). Other modules: import `CrmModule` and use `CrmCompaniesService.search(ctx, q)` / `CrmContactsService.search`, or the `lookup` endpoints; app hooks `useCompanyLookup` / `useContactLookup`. Platform `/tags`, `/taggings` (PUT, record update key checked), `/saved-views` live in the CRM module. App: dashboard, deals board (HTML5 drag + "Move to" menu for touch) + list, deal page (stage stepper, won/lost dialogs, line items, contacts, activities, notes, history, tags), leads list/page + convert wizard + lost-reason status, companies/contacts lists + pages, activities (open/overdue/today…), forecast, pipelines & stages editor, settings (sources, statuses, lifecycle, loss reasons, tags). Verified by typecheck only (servers stopped).
- 2026-11-11 — **Shared numbering** (`api/src/modules/numbering/`): import `NumberingModule`, inject `NumberingService`,
  call `numbering.next(tx, ctx.organization_id, 'invoice')` inside your create transaction → `INV-2026-0001` (NumberSequence;
  default prefixes PRO/CTR/INV/CN/TCK, `options.prefix|reset_policy|padding`; `peek()` previews without allocating).

- 2026-11-11 — Foundation done: API auth (register creates org + HQ branch + owner role + all modules), `/auth/me` session bootstrap,
  central authorization (Redis-cached, deny wins, API-key narrowing), audit, event bus, MCP server, API-key auth; SWC dev build.
  App: tokens from mockups (light/dark), shell (rail, context panel, app bar, ⌘K palette, mobile sheet), auth pages
  (sign in/up, forgot/reset, invitation), permission helpers, shared page/table/state components, Admin → Teams reference.
- 2026-11-11 — Staging DB rebuilt, migrations applied, permission catalog + 18 role templates seeded.
