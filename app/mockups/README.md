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
2. **Light and dark theme** through semantic tokens only (`core/shared.css` token names map 1:1 to the app's CSS variables).
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

Icons: `core/shared.js` has a hand-drawn set. In production use **lucide-react**; each icon name has its lucide equivalent
noted next to it in `core/shared.js`.

## Folder structure (start here)

```
app/mockups/
  index.html            catalog: every module and every screen as a link
  app-shell.html        the shell (rail, panel, app bar, hash router); loads core/ then every module
  README.md             this file
  core/
    shared.css          theme tokens (light + dark) and primitives
    shell.css           app shell layout + styles of the first apps (Linear/Slack-like lists, messages)
    components.css      shared UI kit classes (.a-page, .cd, .kvr, .rowx, tables, tabs, badges...) + admin styles
    patterns.css        shared patterns: filter bar (.fchip), bulk bar, create-form helpers, editor, pager
    shared.js           icons (LQ.icon), theme toggle, avatars
    apps.js             app registry: rail entries and the nav panel + routes of every app
    views.js            window.VIEWS registry + the placeholder for apps without a mockup
  modules/
    NN-name/            one folder per feature module, NN = number of docs/features/NN-*.md
      README.md         spec link, owned Prisma models, files, list of screens (routes)
      views.js          screens; registers window.VIEWS.<appId> = { html(sub), crumb(sub), fill }
      styles.css        only if the module needs its own styles (semantic tokens only)
```

How to work with it:
1. Open `index.html` and pick a module; or go straight to `app-shell.html#<app>/<route>` (add `?theme=dark`).
2. Read `modules/NN-name/README.md`, then the spec `docs/features/NN-*.md` (Data model + Access channels), then the screen function you implement: its comment block lists route, permission keys, API, MCP tool, data, states and audit events.
3. `window.UI` (defined at the top of `modules/01-admin/views.js`) holds the shared mock helpers (`head`, `cd`, `tabs`, `dm`...); `window.UI.filters` (in `modules/06-tasks/views.js`) is the shared filter bar. They are mock shortcuts: build the real components with shadcn.
4. Cross-module screens are read-only summaries that name their owner (Home, Portal preview, customer panels). The owner module's folder is the source of truth.
5. Scripts load in this order (see `app-shell.html`): `core/` then `modules/` by number. A module file may only use `window.UI`, `LQ` and its own code.

