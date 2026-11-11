# Logiqdev OS — UI mockups (read this before implementing)

Static HTML/JS mockups. They are a **design reference, not production code**: the markup, inline styles and `onclick`
handlers are shortcuts. Rebuild each screen in `app/` (shadcn/ui starter) and back it with the real API in `api/`.

Open `index.html`, or go straight to a screen: `app-shell.html#<app>[/<sub>]` (e.g. `#admin/roles`, `#tasks`).
Append `?theme=light|dark` to force a theme.

## What every comment in the code means

Each screen function and each notable element carries a comment using these tags:

| Tag | Meaning |
| -- | -- |
| `@route` | Frontend route. The mock hash `#admin/members` becomes `/admin/members`. |
| `@perm` | Permission keys (real ones live in `api/prisma/seed/permission-catalog.ts`). **VIEW** = who can open the screen, **ACTION** = per button. Gate through the central authorization service (docs/features/01 §136), never by role name. No access → the no-access state, not an empty page. |
| `@api` | Proposed REST endpoint. The organization always comes from the credential/session, never from the URL or body. Lists are filtered by the caller's branch/team/project scope. |
| `@mcp` | MCP tool name `<module>_<resource>_<action>`; thin adapter over the same service as the REST endpoint. Sensitive tools need human confirmation when an AI agent calls them. |
| `@data` | Prisma models/fields the screen reads or writes (exact names from `api/prisma/schema.prisma`). |
| `@ui` | shadcn components to use. Never a plain `<select>`/hand-rolled dropdown (see `app/AGENTS.md`). |
| `@states` | States to build: loading, empty, error, no-access (403), conflict/stale. |
| `@audit` | `AuditEvent.event_type` values to write (`api/src/shared/constants/audit-event-types.ts`). |
| `@note` | Behavior or a trap that is not visible in the picture. |
| `@gap` | The UI shows something the schema/API cannot back yet. Do not fake it. |

Every Admin screen also ends with a visible **"Data model"** footer listing the models/fields it reads. That footer is
for reviewers only; do not ship it.

## Rules the implementation must keep

1. **Roles, permissions, scope and tenant isolation from the first commit**, for every channel at once: UI, REST, MCP,
   API keys / service accounts, webhooks and automation (`.cursor/rules/roles-and-permissions-in-every-feature.mdc`).
2. **Light and dark theme** through semantic tokens only (`shared.css` token names map 1:1 to the app's CSS variables).
   Never hard-code colors.
3. **Enum values are exact.** The mock shows `Membership.status` etc. title-cased with the raw value in a tooltip; render
   labels from a shared enum→label map, keep the raw value for filters and the API.
4. **Reuse existing models and services of the owning module.** Do not build a parallel service for something another module owns.
5. **Provider keys are per organization, never in `.env`.** OpenAI, Resend, Stripe, Twilio and the other third-party
   keys are entered by each organization in Admin → Integrations (`#admin/integrations`) and stored as an
   `IntegrationConnection` (encrypted, write-only). Modules resolve a connection by category and never read a provider
   key themselves; the Integrations form is generated from `api/src/shared/constants/integration-providers.ts`.
   Spec: `docs/features/01` §156–§161. Secrets must never appear in any response, log, audit event or AI prompt.
6. After any `schema.prisma` change run `node docs/scripts/sync-feature-schema-refs.mjs`.
7. Mock-only things to drop in production: the "Data model" footer, `window.LQ`/`window.AD` helpers, inline `onclick`,
   the sample data arrays, the floating tooltips (use shadcn `Tooltip`).

## Mock helper → production component

| Mock helper | Use in production |
| -- | -- |
| `.btn`, `.btn.primary`, `.btn.ghost`, `.btn.icon` | shadcn `Button` (variants: default, outline, ghost, icon size) |
| `.badge` (+ `.green/.blue/.yellow/.red/.purple`) | shadcn `Badge` with a status→variant map |
| `.avatar`, `.avs` | shadcn `Avatar` / avatar group |
| `.sw` | shadcn `Switch` |
| `.cb` | shadcn `Checkbox` (mixed state = `indeterminate`) |
| `.sel`, `sel()` | shadcn `Select` (or `Combobox` when searchable) |
| `.inp` | shadcn `Input` / `Textarea` |
| `.seg` | shadcn `ToggleGroup` (type single) |
| `.tabs-line` + `.pane` | shadcn `Tabs` (route-synced when it changes the URL) |
| `.panel` + `table` | shadcn `Table` inside `Card`; server-side pagination/sort/filter for anything that can exceed ~50 rows |
| `.cd` (card) | shadcn `Card` |
| `.callout` | shadcn `Alert` |
| `.pop` (org/branch switcher) | shadcn `DropdownMenu` / `Popover` + `Command` |
| `.search-trigger` / ⌘K | shadcn `Command` dialog (command palette) |
| row `more()` button | shadcn `DropdownMenu` (row actions, gated per permission) |
| `.pg` (role editor groups) | shadcn `Accordion` / `Collapsible` |
| `.meter` | shadcn `Progress` |
| `.tl` (timeline) | custom list; no shadcn equivalent |
| `.tooltip` (`#tip`) | shadcn `Tooltip` |

Icons: `shared.js` has a hand-drawn set. In production use **lucide-react**; each icon name has its lucide equivalent
noted next to it in `shared.js`.

## Files

| File | Purpose |
| -- | -- |
| `shared.css` | Theme tokens (light + dark) and primitives |
| `shell.css` | App shell + the styles of the non-admin apps |
| `admin.css` | Admin (module 01) styles |
| `shared.js` | Icons, theme toggle, avatar helper |
| `apps.js` | App registry: rail entries, per-app panels, routes |
| `views.js` | Tasks, Messages, Support, Campaigns, Projects screens (**not yet schema-aligned**, see banner in the file) |
| `views-admin.js` | Admin screens (module 01), schema-aligned. Also exposes the shared mock helpers as `window.UI` |
| `views-crm.js` + `crm.css` | CRM screens (module 02), schema-aligned: dashboard, pipeline board, deal, leads and conversion, companies, Customer 360, contacts, activities, forecast, setup, import |
| `app-shell.html` | The shell: rail, panel, app bar, org/branch switcher, hash router |
