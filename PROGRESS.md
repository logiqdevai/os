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

## Status by area

Legend: ✅ done · 🟡 partial · ⬜ not started

| # | Area | API | App | Owner / notes |
| -- | -- | -- | -- | -- |
| — | DB: migrations + seed on staging | ✅ | — | |
| F | Foundation: auth+orgs, authz, audit, events, MCP, API keys, shell, theme, auth pages | ✅ | ✅ | coordinator |
| 01 | Admin + personal settings | ✅ | ✅ | Typechecked only (servers were down) — needs a Chrome pass. Left: sessions admin view, SSO/domains/security policy, access reviews, delegations, portal users, webhooks screens |
| 00/14/19 | Home, Notifications, Calendar | ✅ | ✅ | `api/src/modules/notifications` (inbox, preferences, activity, announcements, **event-bus fan-out**, `NotificationsService.notify()`), `api/src/modules/calendar` (events + RRULE expansion, calendars/sharing, event types, prefs, availability/free-busy/suggest, resources, booking links, bookings, public `/public/booking-links/*`, reminders job). App `pages/home`, `pages/notifications`, `pages/calendar`, public `/book/:orgSlug/:slug`, rail unread badge (30s poll). Typechecked; notifications API curl-tested before the servers stopped, calendar API not yet run live. Left: email/push delivery + digests, admin screens (event catalog, templates, org defaults, delivery rules, delivery log), announcement audience picker (API supports team/branch/member audience), resource picker in the event form, edit-one-occurrence of a series, external calendar sync + conferencing, iCal feed, projected dates (milestones/tasks/leave) on the grid. |
| 02 | CRM | ✅ | ✅ | `api/src/modules/crm` (CrmModule: companies, contacts, leads+convert, deals+board/stage/won/lost/line items, pipelines, activities, notes, settings, dashboard, forecast, platform tags + saved views; `GET /crm/companies/lookup`, `/crm/contacts/lookup`, `/crm/members`). App `pages/crm`. Left: custom fields, saved-views UI, import, merge/duplicates inbox, bulk actions, targets, assignment/scoring rules, reports. Not yet run against a live API (servers were stopped). |
| 03/04 | Proposals, Contracts | ⬜ | ⬜ | |
| 05/06 | Projects, Tasks | ⬜ | ⬜ | |
| 08/09 | Billing, Income & expenses | ⬜ | ⬜ | |
| 10/18 | People, Time | ⬜ | ⬜ | |
| 11/12 | Campaigns, Messages | ⬜ | ⬜ | |
| 07/13 | Client portal, Support | ⬜ | ⬜ | |
| 15/17/20 | Docs, Files, Automation | ⬜ | ⬜ | |
| T | Chrome testing pass (functionality, responsiveness, both themes) | — | ⬜ | |

## Log

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
