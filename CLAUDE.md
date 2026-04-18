# CLAUDE.md

## Stack
Next.js 15 (App Router) + React 19 + TypeScript + Supabase (auth/DB) + Cloudflare R2 (storage) + Tailwind + shadcn/ui + Vitest + Playwright

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — ESLint (uses `next lint`)
- `npm run format` — prettier (debug/ files ignored by .gitignore; use `--ignore-path .prettierignore` to format them)
- `npm run test` — Vitest unit tests
- `npm run test:e2e` — Playwright

## Project layout
```
src/
  app/
    (public)/     — public pages
    (auth)/       — login/signup
    (dashboard)/  — user dashboard
    (admin)/      — admin panel
    api/          — API routes
    debug/        — dev-only test pages (gitignored)
  features/       — domain modules (admin/, auth/, user/, public/)
  shared/         — reusable components, hooks, utils, services, config, types, contexts
```

## Conventions
- Feature code → `src/features/{domain}/`. Shared code → `src/shared/`.
- Route groups map to layouts: (admin) uses UnifiedLayoutClient with admin nav, (dashboard) with user nav.
- Auth: Supabase JWT. Middleware checks roles (admin/creator/reviewer/user). Public APIs under `api/public/*`, `api/auth/*`, `api/content/*`.
- Imports: use `@/` alias (maps to `src/`).
- Toasts: import from `@/shared/utils/toast`, never directly from `sonner` (ESLint enforced).
- Components: shadcn/ui in `src/shared/components/ui/`. Prefer existing components over new ones.

## Caching
Cloudflare CDN sits in front of Vercel. When debugging deploy/cache issues, purge BOTH caches. Don't add custom Cache-Control headers for paths Next.js already manages (`/_next/static/`).

## Lint rules
- `prettier/prettier` enforced via ESLint plugin
- `react-hooks/rules-of-hooks` is error-level
- `@next/next/no-img-element` is warn — suppress with eslint-disable comment when `<img>` is intentional (SVGs, dynamic URLs)
- Unused vars must start with `_`
