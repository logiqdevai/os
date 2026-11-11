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

Test account (staging, test data only): `owner@logiqdev.test` / `Password123!` — owner of org "Logiqdev" (all permissions).
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

## Schema change requests

Parallel agents must NOT run migrations (shared DB). If a feature truly needs a schema change, add a line here
(`module — model/field — why`) and work around it with existing fields until the coordinator applies it.

- (none yet)
- 03 — `ProposalComment.author_name String?` — customers commenting on the public link are not always the CRM contact; today a non-matching name is prefixed into `body`.
- 04 — store drawn signatures as a Document (17) in `Signer.signature_document_id`; until Documents storage is wired the PNG data URL lives in the `SignatureEvent` payload (SIGNED).
- 06 — `Task @@unique([organization_id, number])` → `@@unique([team_id, number])` (+ per-team counter) — Linear numbers per team (WEB-1, APP-1). Today numbers are org-wide (NumberSequence `task`/`TASK`), so identifiers read WEB-12, APP-13. Workaround works; change only if per-team numbering is wanted.

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
| 07/13 | Client portal, Support | ⬜ | ⬜ | |
| 15/17/20 | Docs, Files, Automation | ⬜ | ⬜ | |
| T | Chrome testing pass (functionality, responsiveness, both themes) | — | ⬜ | |

## Log

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
