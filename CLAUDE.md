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
- Confirmation modals: always use `Dialog` (`shared/components/ui/dialog.tsx`) — never `AlertDialog`. The repo's `AlertDialog` ships with `slide-in-from-left-1/2` / `slide-in-from-top-[48%]` animations layered on top of a `translate-x-[-50%] translate-y-[-50%]` centering transform; the two stack and the panel ends up pinned to the upper-left instead of centered. The whole codebase uses `Dialog` for "are you sure?" flows (see `quiz/[id]/components/dialogs/*`); follow that pattern.

## Caching

Cloudflare CDN sits in front of Vercel. When debugging deploy/cache issues, purge BOTH caches. Don't add custom Cache-Control headers for paths Next.js already manages (`/_next/static/`).

## Lint rules

- `prettier/prettier` enforced via ESLint plugin
- `react-hooks/rules-of-hooks` is error-level
- `@next/next/no-img-element` is warn — suppress with eslint-disable comment when `<img>` is intentional (SVGs, dynamic URLs)
- Unused vars must start with `_`

## Gotchas

- **Cross-user aggregation needs `SECURITY DEFINER`.** Any DB function that compares the caller to other users (percentiles, ranks, leaderboards, "X% of users do Y") must be `SECURITY DEFINER`. Default `SECURITY INVOKER` runs under the caller's RLS context — if `quiz_sessions` / `quiz_attempts` / etc. RLS scopes reads to `auth.uid()`, the function only sees the caller's own data, and aggregates collapse to "1st of 1". Litmus test: if a function returns different output under the service role vs an authenticated user, RLS is mediating it — decide which behavior is correct. `get_user_percentile` is the canonical example.
- **Windowed vs lifetime counts.** `/api/user/performance-data` uses `.limit(100)` + `quiz_attempts!inner(...)` for the heavy per-attempt math. Anything that needs a true lifetime count (e.g. "completed quizzes") must use a separate `COUNT(*)` query, not the windowed `sessions.length`. See the `lifetimeCompletedQuizzes` pattern in that route.
- **`||` vs `??` for SQL fallbacks.** When mapping RPC results into API responses, use `??`. `||` treats `0` as falsy and silently overwrites legitimate zero values (e.g., 0th-percentile rank) with defaults — bakes nonsense into the SWR cache that lives forever.
- **Custom SWR provider isolates the cache.** `swr-cache-provider.tsx` gives `SWRConfig` a custom `provider` map, which creates an isolated cache instance. The **global `mutate` imported from `"swr"`** targets SWR's default cache, not this one — calling it from outside React context is a silent no-op against the cache `useSWR` hooks actually read. Use `useSWRConfig().mutate` (provider-scoped) when invalidating from inside React; pass that down to anything else that needs to invalidate.
- **SECURITY DEFINER RPC + cookie-auth client = silent 404.** Any `public.*` function that is `SECURITY DEFINER` and not granted `EXECUTE` to `authenticated` (the default we keep, to avoid the `authenticated_security_definer_function_executable` Supabase lint) **cannot** be called via the cookie-auth Supabase client. The browser/server cookie client used everywhere (`createClient` from `@/shared/services/{server,client}`) calls PostgREST as `authenticated`, gets a 404 with no error surfaced through `supabase-js`, and the caller silently sees `null`/`[]` — manifests as fallback values (50% percentile, 0% question success rate), empty admin stats, or "no data yet" empty states. **Fix pattern**: (1) **server-side caller** → inline a service-role client and call the RPC through it: `createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!).rpc(...)`. (2) **browser-side caller** → add a thin Next.js API route that gates on `x-user-id` / `x-user-role` headers from middleware, then proxies the RPC through a service-role client; have the browser `fetch()` that route. The users-stats / audio-stats routes are the canonical examples. Watch out for files that _look_ browser-side because they import `@/shared/services/client` but are actually only ever called from server route handlers (e.g. `quiz-service.ts`) — those should use the server-side service-role pattern directly, not a `fetch()` proxy. If a SECURITY DEFINER function has its own internal `auth.uid()` check, it must be dropped (or moved to the API route) since service-role calls have `auth.uid()` = NULL — see the `get_user_statistics` migration.
- **Read-then-write UPDATEs in API routes race themselves.** A route that does `select row → check status → conditionally call update` is a TOCTOU window: a second request can land between the read and the write, see the same "still in progress" state, and overwrite a terminal transition that committed in between. Bit us with `/api/user/quiz/sessions/[id]` PATCH overwriting a just-completed quiz back to `in_progress`. **Fix pattern**: push the guard into the actual `UPDATE` via a Supabase filter chain (e.g. `.eq("id", id).neq("status", "completed")`). Postgres serializes the writes, so a stale "demote me" PATCH simply matches zero rows. The read-then-check is fine for *short-circuiting early* (skip the update, return 200), but never the only barrier — the WHERE clause must enforce it too. Allow the legitimate transition by skipping the guard when the incoming update *is* the terminal one (see `quizService.updateQuizSession`).
- **`useReducer` dispatches aren't visible to synchronous reads, even after `await`.** React 18 batches reducer dispatches and only commits them on the next render — and `await` inside the same handler chain doesn't force a render. A ref assigned during render (`stateRef.current = state`) is therefore also stale until the next commit. If a flow does `dispatch(action) → await something → read state`, the read sees the pre-dispatch value. Bit us hard on the timer-expiry path (pending answer dispatched, then `runCompletion` reads state, finds 0 answers, ships an empty `/complete` POST). **Fix pattern**: mirror the dispatch into a ref synchronously by running the pure reducer right after the dispatch (`stateRef.current = reducer(stateRef.current, action)`), and expose a `getCurrentState()` accessor that reads from that ref. The on-render `stateRef.current = state` line then converges harmlessly on the next commit. See `use-quiz-state-machine.ts`'s `dispatchAndMirror`. The "proper" fix is `useSyncExternalStore` with the reducer hosted in an external store — half-day of work plus testing, not worth it without an independent trigger.
