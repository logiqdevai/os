## API rules (`api/**`)

@.cursor/rules/api-code-structure-and-best-practices.mdc

## App rules — HeroUI starter (`app/**`)

@.cursor/rules/app-code-structure-and-best-practices.mdc

## App rules — shadcn/ui starters (`react-starter/**`, `nextjs-app/**`)

@.cursor/rules/app-shadcn-code-structure-and-best-practices.mdc

## Roles, permissions and access channels — every feature (`api/**`, `app/**`, `react-starter/**`, `nextjs-app/**`)

@.cursor/rules/roles-and-permissions-in-every-feature.mdc

Build every feature with roles, permissions, scope and tenant isolation from the first commit, and for every access channel at once: UI, REST API, MCP tools, API keys, service accounts, webhooks and automation. Permission keys go in the catalog, role templates are updated, and everything goes through the central authorization service (`docs/features/01-users-organizations-permissions.md` §136, built first). Never add any of this later. Each feature spec has a generated "Access channels & permissions" block.

## Light/dark theme — every UI section (`app/**`, `react-starter/**`, `nextjs-app/**`, `app/mockups/**`)

Always build every UI section with light and dark theme support by default. Use theme tokens / semantic colors (never hard-coded colors), and check both themes before considering a section done. Never add dark mode later.

## Feature specs ↔ database (`docs/features/**`)

Each feature spec has a generated **"Data model (Prisma)"** section near the top. It lists the tables the module owns (with schema line links), the tables it reuses from other modules, the platform tables (audit events, custom fields, tags, notes, numbering, signatures, webhooks) and the plain-id references between modules. Read it before you implement a feature in `api/` or `app/`. Reuse the existing models, services and endpoints of the owning module. Never redefine a table or build a parallel service for something another module owns.

After any change to `api/prisma/schema.prisma`, run `node docs/scripts/sync-feature-schema-refs.mjs` to refresh those sections. Don't edit them by hand.

## Local development

For local API work, use `.env.staging` (`npm run start:staging` in `api/`), not `.env.local` — `.env.local` has empty/placeholder integration keys (e.g. `RESEND_API_KEY`), so flows like email sending fail locally with it. `.env.staging` has working keys.
