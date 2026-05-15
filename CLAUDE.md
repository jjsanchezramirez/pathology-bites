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
- Route groups map to layouts: (admin) uses UnifiedLayoutClient w/ admin nav, (dashboard) w/ user nav.
- Auth: Supabase JWT. Middleware checks roles (admin/creator/reviewer/user). Public APIs under `api/public/*`, `api/auth/*`, `api/content/*`.
- Imports: use `@/` alias (maps to `src/`).
- Toasts: import from `@/shared/utils/toast`, never direct from `sonner` (ESLint enforced).
- Components: shadcn/ui in `src/shared/components/ui/`. Prefer existing over new.
- Confirmation modals: always use `Dialog` (`shared/components/ui/dialog.tsx`) — never `AlertDialog`. Repo `AlertDialog` ships `slide-in-from-left-1/2` / `slide-in-from-top-[48%]` animations layered on `translate-x-[-50%] translate-y-[-50%]` centering transform; two stack, panel pinned upper-left not centered. Whole codebase uses `Dialog` for "are you sure?" flows (see `quiz/[id]/components/dialogs/*`); follow pattern.
- **Badges.** Visual reference live at `/debug/badges` (gitignored). Three rules:
  - **Status/type/category w/ text label** → canonical outline: `variant="outline"` + `border-X-300 bg-X-50 text-X-700`. Use existing wrappers when possible: `CategoryBadge`, `StatusBadge`, `DifficultyBadge`, `RoleBadge`, `UserStatusBadge`, `ImageTypeBadge`, `InquiryStatusBadge`. New domain badge → new wrapper in `shared/components/ui/`, not inline.
  - **Single-number / counter chips** (tab counts, quick-action counts, sidebar nav counters) → solid Shadcn variant: `variant="secondary"` (neutral), `variant="destructive"` (alert). No border (cva sets `border-transparent`). Never apply canonical outline to a single-number badge.
  - **Sidebar/dashboard nav pills** ("New", "Soon", count dots) → inline `<span>` w/ `rounded-full bg-X-100 text-X-700 px-2 py-0.5` (no border), not `Badge` component. See `unified-sidebar.tsx` + `student-quick-actions.tsx`.
  - Sizes: tables use `text-[10px] px-1.5 py-0`. Cards/dialogs use Badge cva default (`text-xs px-2.5 py-0.5`). Tab counters use `h-5 px-1.5 text-xs`.

## Caching

Cloudflare CDN front of Vercel. Debug deploy/cache issues → purge BOTH caches. No custom Cache-Control headers for paths Next.js manages (`/_next/static/`).

## Lint rules

- `prettier/prettier` enforced via ESLint plugin
- `react-hooks/rules-of-hooks` error-level
- `@next/next/no-img-element` warn — suppress w/ eslint-disable comment when `<img>` intentional (SVGs, dynamic URLs)
- Unused vars must start w/ `_`

## Gotchas

- **Cross-user aggregation needs `SECURITY DEFINER`.** Any DB function comparing caller to other users (percentiles, ranks, leaderboards, "X% of users do Y") must be `SECURITY DEFINER`. Default `SECURITY INVOKER` runs under caller's RLS context — if `quiz_sessions` / `quiz_attempts` / etc. RLS scopes reads to `auth.uid()`, function only sees caller's own data, aggregates collapse to "1st of 1". Litmus test: function returns different output under service role vs authenticated user → RLS mediating → decide which correct. `get_user_percentile` canonical example.
- **Windowed vs lifetime counts.** `/api/user/performance-data` uses `.limit(100)` + `quiz_attempts!inner(...)` for heavy per-attempt math. Anything needing true lifetime count (e.g. "completed quizzes") must use separate `COUNT(*)` query, not windowed `sessions.length`. See `lifetimeCompletedQuizzes` pattern in route.
- **`||` vs `??` for SQL fallbacks.** Mapping RPC results into API responses → use `??`. `||` treats `0` as falsy, silently overwrites legit zero values (e.g., 0th-percentile rank) w/ defaults — bakes nonsense into SWR cache that lives forever.
- **Custom SWR provider isolates cache.** `swr-cache-provider.tsx` gives `SWRConfig` custom `provider` map → isolated cache instance. **Global `mutate` imported from `"swr"`** targets SWR's default cache, not this one — calling from outside React context = silent no-op against cache `useSWR` hooks read. Use `useSWRConfig().mutate` (provider-scoped) when invalidating from inside React; pass down to anything else that invalidates.
- **SECURITY DEFINER RPC + cookie-auth client = silent 404.** Any `public.*` function `SECURITY DEFINER` and not granted `EXECUTE` to `authenticated` (default we keep, avoid `authenticated_security_definer_function_executable` Supabase lint) **cannot** be called via cookie-auth Supabase client. Browser/server cookie client used everywhere (`createClient` from `@/shared/services/{server,client}`) calls PostgREST as `authenticated`, gets 404 w/ no error surfaced through `supabase-js`, caller silently sees `null`/`[]` — manifests as fallback values (50% percentile, 0% question success rate), empty admin stats, or "no data yet" empty states. **Fix pattern**: (1) **server-side caller** → inline service-role client, call RPC through it: `createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!).rpc(...)`. (2) **browser-side caller** → add thin Next.js API route gating on `x-user-id` / `x-user-role` headers from middleware, proxy RPC through service-role client; browser `fetch()` route. users-stats / audio-stats routes canonical examples. Watch files that _look_ browser-side because import `@/shared/services/client` but only called from server route handlers (e.g. `quiz-service.ts`) — use server-side service-role pattern direct, not `fetch()` proxy. If SECURITY DEFINER function has internal `auth.uid()` check, must drop (or move to API route) — service-role calls have `auth.uid()` = NULL — see `get_user_statistics` migration.
- **Read-then-write UPDATEs in API routes race themselves.** Route doing `select row → check status → conditionally call update` = TOCTOU window: second request lands between read and write, sees same "still in progress" state, overwrites terminal transition committed between. Bit us w/ `/api/user/quiz/sessions/[id]` PATCH overwriting just-completed quiz back to `in_progress`. **Fix pattern**: push guard into actual `UPDATE` via Supabase filter chain (e.g. `.eq("id", id).neq("status", "completed")`). Postgres serializes writes → stale "demote me" PATCH matches zero rows. Read-then-check fine for *short-circuiting early* (skip update, return 200), never only barrier — WHERE clause must enforce. Allow legit transition by skipping guard when incoming update *is* terminal one (see `quizService.updateQuizSession`).
- **`useReducer` dispatches not visible to synchronous reads, even after `await`.** React 18 batches reducer dispatches, commits on next render — `await` inside same handler chain doesn't force render. Ref assigned during render (`stateRef.current = state`) also stale until next commit. Flow doing `dispatch(action) → await something → read state` reads pre-dispatch value. Bit us hard on timer-expiry path (pending answer dispatched, `runCompletion` reads state, finds 0 answers, ships empty `/complete` POST). **Fix pattern**: mirror dispatch into ref synchronously by running pure reducer right after dispatch (`stateRef.current = reducer(stateRef.current, action)`), expose `getCurrentState()` accessor reading from ref. On-render `stateRef.current = state` line converges harmlessly next commit. See `use-quiz-state-machine.ts`'s `dispatchAndMirror`. "Proper" fix = `useSyncExternalStore` w/ reducer hosted in external store — half-day work plus testing, not worth without independent trigger.
