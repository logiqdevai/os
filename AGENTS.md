## API rules (`api/**`)

@.cursor/rules/api-code-structure-and-best-practices.mdc

## App rules — HeroUI starter (`app/**`)

@.cursor/rules/app-code-structure-and-best-practices.mdc

## App rules — shadcn/ui starters (`react-starter/**`, `nextjs-app/**`)

@.cursor/rules/app-shadcn-code-structure-and-best-practices.mdc

## Local development

For local API work, use `.env.staging` (`npm run start:staging` in `api/`), not `.env.local` — `.env.local` has empty/placeholder integration keys (e.g. `RESEND_API_KEY`), so flows like email sending fail locally with it. `.env.staging` has working keys.
