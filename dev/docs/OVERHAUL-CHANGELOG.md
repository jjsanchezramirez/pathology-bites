# Overhaul Changelog

A running log of every change made during the codebase overhaul. Each entry
records what changed, why, the evidence it was safe, and the checks run.

## Baseline (captured before any change)

Commit `82056c3` — "Extract shared text-search core for client-side kg-atlas
index" (this also committed the in-progress, untracked text-search work so the
overhaul starts from a clean tree).

Verification at baseline:

- `npx tsc --noEmit` — **PASS** (0 errors)
- `npx eslint .` — **PASS** (0 errors, 5 warnings, all in `src/app/(debug|api/debug)` sandbox)
- `npm run build` — **PASS** (exit 0)
- `npx vitest run` — **2 pre-existing failures** (1080 tests, 1078 pass). Both
  confirmed **unrelated** to the committed text-search work:
  1. `tests/api/swagger-coverage.test.ts` — `src/app/api/user/wsi-questions/answer/route.ts`
     (added in `5cc3238`) is missing a `@swagger` JSDoc block.
  2. `tests/features/user/wsi-question-generator.test.tsx` — category-switching
     hook timing assertion.

Notes on environment discovered during baseline:

- `src/app/debug/` and `src/app/api/debug/` are **gitignored** — a local-only
  sandbox that is never committed or deployed. Present on disk; reframes how the
  debug surface is treated (Phase 5).
- `knip.json` marks most of `src/shared`, `src/features` and all hooks/services/
  utils as `entry` points, which **suppresses most dead-code findings**. Dead-code
  detection therefore relies on import-graph tracing, not knip alone.
- `.gitignore` already covers `.next/`, `.wrangler/`, `*.tsbuildinfo`, `.vercel`,
  `public/data/`, `public/ffmpeg/`, and `dev/`.

## Phase 1 — External Tools & Integrations

### 1.1 `.env.example` reconciled with actual usage
- **What**: Added 10 vars that are read in `src/` but were undocumented
  (quiz-limits ×5, text-zoom ×4, `NEXT_PUBLIC_KNOWLEDGE_PAGES`), added the
  server-side `CLOUDFLARE_R2_DATA_PUBLIC_URL`, and rewrote the AI-key section
  header to reflect that those keys are `server-only`-guarded (not actually
  client-exposed, and the un-prefixed `GROQ_API_KEY`/`CEREBRAS_API_KEY` are
  optional server fallbacks).
- **Evidence**: Extracted all 44 `process.env.*` references from `src/` and
  diffed against the example file. `src/shared/config/quiz-limits.ts` and
  `src/shared/utils/ui/text-zoom.ts` read 9 of the missing vars with defaults;
  `src/features/public/knowledge/lib/enabled.ts` reads `NEXT_PUBLIC_KNOWLEDGE_PAGES`;
  `src/app/api/public/tools/virtual-slides/route.ts` reads `CLOUDFLARE_R2_DATA_PUBLIC_URL`.
  `ai-keys.ts` is `import "server-only"` guarded.
- **Change type**: docs/completeness, no behavior change.
- **Checks**: `npx tsc --noEmit` PASS.

### 1.2 Deleted dead files + collapsed a duplicate caption builder
- **Deleted** `src/app/(admin)/admin/lesson-studio/utils/caption-builder.ts`
  (knip "unused file"; zero importers/tests/dynamic refs). Its `buildCaptionChunks`
  was a **byte-for-byte duplicate** of the same function in
  `src/shared/lesson/captions.ts` — a real duplication the knip output surfaced.
- **Deleted** `src/shared/components/common/organic-image-gallery.tsx`
  (knip "unused file"; zero importers/tests; not in `common/index.ts`). This was
  the old homepage hero gallery — superseded when the hero became the knowledge
  graph (git log `e2d3f64` "defer ... gate hero gallery to desktop", then the
  graph-hero commits). Its only other reference was a comment pointing at the
  `dev/code/scripts/r2/optimize-hero-images.ts` regeneration script, which is a
  dev artifact, not a code dependency.
- **Un-exported** `buildCaptionChunks` and `buildCaptionsFromWords` in
  `src/shared/lesson/captions.ts`: both were exported but consumed **only
  internally** by the live `captionsForAudio` (the sole external import, used by
  `explainer-player.tsx` and `element-forms.tsx`). Made them module-private; no
  behavior change, smaller public surface.
- **Evidence**: knip (files→0), grep for filename + every export name across
  src/ tests/ (zero hits outside definitions), git-log recency.
- **Checks**: `tsc --noEmit` PASS; `eslint` on changed file PASS (fixed one
  prettier line-length reflow); `knip` unused-files 2→0, unused-exports 19→17.

### 1.3 Cleared all remaining knip dead-code findings (commit baf9f8e)
Triaged all 17 unused exports + 2 unused types + 1 duplicate export from knip.
Each verified by grep for the symbol across src/ + tests/ (external importers),
plus an internal-usage count inside the defining file. **None had external
consumers.** Actions:

- **Un-exported internal-only helpers** (kept the code, removed the export):
  - `assembler-v2.ts`: `TITLE_DURATION`, `ANNOTATION_SIZES`, `computeImageDurations`,
    `buildAnnotation`, `buildBackground`, `buildCamera`, `buildTextLabel`,
    `buildTitleSlide`, `buildTextSlide`, `buildImageSlide` — only `assembleLesson`
    is imported (by `route.ts`). Removed a stale `@internal exported for testing`
    comment (no test imports them).
  - `lesson/evaluate.ts`: `DEFAULT_TRANSFORM`, `baseTransformAt`, `applyActiveCamera`
    — internal-only; the file is imported for `evaluate`/`scaleAt`/`slideStarts`/etc.
  - `lesson/types.ts`: `LESSON_SCHEMA_VERSION` — written by `emptyLesson()`, never
    read back (no migration logic); kept module-private with a note.
  - `wsi-question-events.ts` `WsiEventOutcome`, `user-dialogs.tsx` `FieldOption` —
    type-only, used internally.
  - `anki-data.ts` `IGNORED_CARD_IDS` — **used internally** (line 153); un-exported,
    NOT deleted. (knip flags unused *exports*; internal use is invisible to it.
    Caught by tsc after an initial over-deletion, then corrected.)
- **Deleted truly-dead code**:
  - `lesson/types.ts` `timingEnd()` — zero callers anywhere (count 1 = def only).
  - Shared `TablePagination` component in `data-table/table-pagination.tsx` — every
    `<TablePagination>` in the repo is a *local* per-table component (the file's own
    comment notes tables stay custom); only the `getPageNumbers` algorithm is actually
    shared (imported by svg/images/audio tables). Removed the component + its
    now-orphaned `Button` import.
- **Resolved the duplicate export**: `DEFAULT_CELL_TYPES = PERIPHERAL_BLOOD_CELL_TYPES`
  in cell-counter-data.ts was an identity alias; single use site in page.tsx updated
  to the canonical name and the alias removed.

**Checks**: `tsc --noEmit` PASS; `eslint` on all 9 changed files PASS; `knip` → 0
unused exports/types/duplicates (only the benign `index.js` "main" hint remains);
`vitest run` on lesson-studio + lesson + user suites PASS (the 1 failure is the
pre-existing, unrelated `wsi-question-generator` timing test).

**Lesson folded into standard**: knip "unused export" ≠ dead — always check for
*internal* use before deleting. Internal-only → un-export; zero-references → delete.

### 1.4 Tooling: dead tailwind script, @tailwindcss/cli dep, package.json boilerplate (commit bdc3008)
- **Removed `tailwind` npm script** — compiled `globals.css` → `styles/output.css`,
  but `output.css` is never imported (layout.tsx imports `globals.css`, built by
  `@tailwindcss/postcss`). No CI (`vercel.json`/`.github` don't exist), no docs
  reference the script. Verified: zero refs to `output.css`, the script name, or
  `@tailwindcss/cli` outside package.json.
- **Uninstalled `@tailwindcss/cli`** — a direct devDependency with no other
  dependents (`npm ls` showed only the root). Tailwind v4 compiles via
  `@tailwindcss/postcss` (see postcss.config.js), so the standalone CLI was dead weight.
- **Cleaned create-next-app boilerplate** — removed `"main": "index.js"` (file does
  not exist; cleared knip's config hint), empty `keywords`/`author`, `license: ISC`,
  and the boilerplate `description`; set a real description.
- **Duplicated-purpose libs audit**: none found. `date-fns` is the only date lib;
  `swr` the only data-fetcher; `clsx`+`tailwind-merge` are complementary (the `cn()`
  pattern), not duplicates.
- **Checks**: `npm run build` PASS (10.5s); `knip` fully clean (0 findings incl. the
  config hint). Lockfile updated via `npm uninstall`.

### Phase 1 items intentionally NOT changed (flagged, not fixed)
- **`webpack/empty-polyfill.js`** — KEEP. Referenced by live `next.config.ts` webpack
  hook (NormalModuleReplacementPlugin stubs Next's bundled polyfill-module; ~12 KiB
  Lighthouse saving). Not dead.
- **`.wrangler/`** — gitignored Wrangler R2/D1 simulator cache; regenerates. Not tracked.
- **`skills-lock.json`** — written by the external Caveman skills installer (matches
  `.claude/skills/`); not a repo artifact. Left alone (`.gitignore` already has a
  defensive Caveman section).
- **Supabase migrations vs live** — only 3 migrations exist in `dev/supabase/migrations/`
  and the live schema in `src/shared/types/supabase.ts` matches them (spot-checked
  `word_timings`, `entity_placements`). **Cannot diff against the live DB** without
  Supabase credentials / `supabase link`; migrations are gitignored dev artifacts
  applied out-of-band. Flagged as a verification gap, not a defect.
- **`next.config.ts` `ignoreDuringBuilds`/`ignoreBuildErrors: true`** — these suppress
  lint/type errors *during `next build`*. They are load-bearing "temporarily" flags.
  Since `tsc`/`eslint` are run separately and are clean, these could be re-enabled,
  but that is a deploy-behavior change deferred to a later phase (flagged).

## Phase 2 — Authentication

### 2.1 Fixed two open-redirect vulnerabilities (commit 2366702) — SECURITY
- **Root cause**: caller-controlled redirect targets were concatenated into a
  `Location` header without validating they were same-origin.
  - `src/app/api/auth/confirm/route.ts`: `const next = searchParams.get("next")`
    then `NextResponse.redirect(\`${origin}${next}\`)`. With `?next=//evil.com` the
    result is `Location: //evil.com`, which browsers resolve to the attacker
    origin — a phishing vector that fires *after* a successful email-confirm or
    password-recovery (highest-trust moment).
  - `src/features/auth/services/actions.ts` `login()`: the `redirect` form field
    was passed straight to `redirect()`. Same `//evil.com` issue post-login.
- **Fix**: added `getSafeRedirectPath(target, fallback)` to
  `src/shared/utils/route-helpers.ts` (accepts only single-leading-slash
  same-origin paths; rejects `//`, `https:`, `javascript:`, backslash-smuggling,
  and control chars) and applied it at both sites. confirm/route sanitizes `next`
  once at parse time (covers all 4 downstream `${origin}${next}` redirects);
  login() sanitizes `redirectPath` once (unsafe → null → role-based default).
- **Note**: the OAuth `callback/route.ts` was checked and is NOT vulnerable — it
  builds its redirect from a fixed allowlist (`/admin` or `/dashboard`), never
  from a request param.
- **Tests**: added `tests/shared/utils/route-helpers.test.ts` (7 cases: valid
  paths, `//evil.com`, absolute URLs, `javascript:`, backslash, no-slash,
  control chars). PASS. `tsc` + `eslint` PASS.

### 2.2 / 4.1 Enforced role checks on ALL admin API routes (commit b86c33f) — SECURITY
- **Gap found**: middleware's role gate is `pathname.startsWith("/admin")`, which
  matches admin *pages* but NOT `/api/admin/*`. On API routes middleware only
  guarantees a *session* and injects `x-user-id`/`x-user-role`; role enforcement is
  each handler's job via `api-guard`. Audit of all 56 `/api/admin` routes found 51
  already used `requireAdmin`/`requireContentRole`, but 5 relied on session-only
  middleware while their swagger docs claimed admin/content role — so any signed-in
  non-admin could invoke them:
  - `notifications/system-update` (POST broadcasts to all users; GET) → `requireAdmin`
  - `dashboard/r2-storage-stats` (uses the service-role client = bypasses RLS) → `requireAdmin`
  - `lesson-studio/vision-analyze` (spends AI credits) → `requireContentRole`
  - `library/images` → `requireAdmin`
  - `proxy-image` (was host-locked to the R2 bucket only; safe against open-proxy but
    still usable by any signed-in user) → `requireContentRole` (defense in depth)
- **Result**: 0 unguarded `/api/admin` routes. Each fix added a code comment noting
  that middleware does not role-gate API routes.
- **Checks**: `tsc` PASS; `eslint` on all 5 PASS; `tests/api` unchanged except the
  pre-existing swagger-coverage failure.

### Phase 2 architecture notes (verified, no change needed)
- **Single auth pattern already exists**: `use-auth.ts` is the one client session hook
  (sessionStorage cache is a UI convenience, not the security boundary);
  `auth-provider.tsx` is a thin context wrapper; `use-user-role.ts` builds role on top.
  No duplicate session logic. The security boundary is server-side: middleware
  (session + page-role) and `api-guard` (API role). Correct layering.
- **Supabase clients are correctly separated**: `client.ts` (browser, `createBrowserClient`),
  `server.ts` (server component, awaited cookies), `service-role-client.ts` (RLS bypass,
  documented). `service.ts` is a NotificationsService, not a client. No consolidation needed.
- **Removed stale helpers** (commit cbbc0c6): `isAdminRoute`/`isProtectedApiRoute`/
  `isPublicApiRoute` from route-helpers.ts — zero external importers, and the API
  lists were stale vs middleware. Kept `isPublicRoute` (used by use-auth/auth-provider/
  realtime-service) and documented that middleware is the single enforcement boundary.

### 2.3 Fixed the two pre-existing test failures (commit 708db39) — suite now green
The baseline had 2 failing tests (1080 total). Both were stale relative to source,
not source bugs, and both are now fixed so the "all tests passing" gate is real:
- **swagger-coverage.test.ts** — `api/user/wsi-questions/answer/route.ts` had a prose
  comment but no `@swagger` JSDoc block (the guard scans for `@swagger`). Added an
  accurate OpenAPI block for the POST. PASS.
- **wsi-question-generator.test.tsx** — the "category switching" tests asserted
  synchronous generation, but commit `01c702d` had deliberately debounced generation
  behind `SCOPE_SETTLE_MS = 900` (so categories clicked past don't each cost a
  generation). Diagnosed as a stale test, not a source bug: the debounce is the
  intended behavior. Updated the two category tests to use fake timers and advance
  the settle window. PASS. No production-code change.
- **Result**: `npx vitest run` → **1087 passed / 1087** (85 files), 0 failures.

## Phase 3 — User-Facing Features (partial) / Completeness

### 3.1 Wired up the question form's onCancel (commit 5b2539d) — COMPLETENESS
- `MultiStepQuestionForm` declared `onCancel?: () => void` and
  `create-question-client.tsx` passed `handleCancel` (navigates to
  `/admin/my-questions`), but the component never destructured it nor rendered a
  Cancel control — an admitted TODO ("Wire up cancel button"). Clicking "cancel"
  did nothing.
- Wired it: destructure `onCancel`; `handleCancelClick` reuses the existing
  unsaved-changes guard (clean → `onCancel()` at once; dirty → the same
  discard-confirmation dialog used for link/back navigation); a `CANCEL_SENTINEL`
  in `pendingExitHrefRef` makes `handleConfirmExit` route a confirmed cancel to
  `onCancel()` rather than `window.history.back()`. Footer renders a ghost Cancel
  button only when `onCancel` is provided.
- **Checks**: `tsc`/`eslint` PASS; admin test suites (161 tests) PASS. No existing
  test covered this form; the wiring reuses already-tested dialog logic.

### Remaining TODO markers — assessed, intentionally left
- `rate-limiter.ts` + `api-rate-limiter.ts`: "TODO: PRODUCTION SCALING
  CONSIDERATION" — these note that the in-memory limiter should move to Redis for
  multi-instance deploys. The code is complete and correct for the current
  single-instance deployment; this is a documented future scaling note, not a
  stub or half-feature. Left in place (rewording as a plain comment is cosmetic).
- `r2-storage-metrics.ts` "Could send to error monitoring (Sentry)": an optional
  enhancement note, not incomplete code. Left.
- The 9 `xxx` hits are all `[Src=xxx]` filename-format documentation, not markers.

## Phase 5 — API & Debug Surface

### 5.1 Debug surface: verified properly gated (no leak)
- `src/app/debug/` and `src/app/api/debug/` are **gitignored AND `.vercelignore`d**
  (zero git-tracked files), so they cannot reach a deployment. Middleware also
  returns 401 for `/api/debug/*` in production and only dev-passes them when
  `NODE_ENV !== "production"`. 3 of 10 debug-API routes additionally carry an
  in-code `NODE_ENV` 404 guard (the token-spending ones).
- **Assessment**: no data can leak in production (double-gated). The 7 debug-API
  routes without an in-code `NODE_ENV` check are still prod-401'd by middleware;
  adding per-route guards is defense-in-depth, deferred (they are dev-only tools).
- The `swagger-coverage` test intentionally excludes `debug/` and `docs/`.

### 5.2 Folded single-consumer api-response.ts into parse-body.ts (commit 532219fe)
- **Found**: `api-response.ts` defined `apiError`/`apiSuccess` but **0 of the 79**
  non-debug routes used them — the dominant convention is inline
  `NextResponse.json({ error })` (235 sites) / `{ success:false, error }` (5).
  `parse-body.ts` was the only live consumer (`apiError` for 400s); the rest was a
  test file.
- **Action**: moved `apiError` into `parse-body.ts` (its only consumer), ported the
  3 shape-pinning tests to `parse-body.test.ts`, deleted `api-response.ts` and the
  dead `apiSuccess` + its test. Removes a misleading "use this everywhere" module
  that was not actually the convention.
- **Standard (now in force)**: API errors use the body `{ error: string }`
  (optionally `{ error, details }`). Auth checks go through `api-guard`
  (`requireUser`/`requireRole`/`requireAdmin`/`requireContentRole`), input
  validation through `parse-body` (zod). `apiError` is exported from
  `parse-body.ts` for the parse path; new routes may reuse it but inline
  `NextResponse.json({ error })` is the accepted pattern.
- **Checks**: `tsc`/`eslint` PASS; api util tests PASS (14).

## Phase 6 — Dev Folder & Retirement

> NOTE: `dev/` is gitignored. The deletions below are local-only; they never touch
> the deployed app. The changelog itself is now tracked via a `.gitignore` carve-out
> (commit 5f17ffb0) so this record survives.

### Retired (each verified zero-referenced before deletion)
- `dev/split_imports.py` — ORPHANED. Zero references repo-wide (package.json, docs,
  code). Standalone Python import-splitting helper with no caller.
- `dev/tools/` (`ProfilerWrapper.tsx`, `logger.ts`, `performance-monitor.ts`) —
  ORPHANED. Self-described "dev-only, not part of the production build"; zero
  imports from `src/`/`tests/`/`package.json`.
- `dev/docs/KNOWLEDGE-GRAPH-ARCHITECTURE.md.bak` — ORPHANED backup of the current
  (itself stale-bannered) KNOWLEDGE-GRAPH-ARCHITECTURE.md. The only `.bak` in the repo.
- `.wrangler/` — Wrangler R2/D1 simulator cache (gitignored, regenerates on use).
- Completed planning docs — `dev/codebase-cleanup-plan.md` (self-labeled "PLAN ONLY —
  not executed", superseded), `dev/phase0-baseline.md` (Phase 0 complete),
  `dev/phase2-verify-checklist.md` (build-verified branch checklist). None referenced
  by any other doc; their conclusions are either done or folded into the changelog.

### Kept (referenced — documented why)
- `webpack/empty-polyfill.js` — referenced by live `next.config.ts` webpack hook.
- `dev/code/reference/` — referenced by `src/shared/config/navigation.ts:272`
  (guest-quiz pattern deliberately preserved).
- `dev/code/scripts/` — referenced by comments + dev READMEs; the `eval:search` and
  image-optimization pipelines point here.
- `dev/PathVideo.jsx` — referenced by `src/shared/lesson/easing.ts:1` (logic ported).
- `dev/supabase/migrations/` — matches live schema in `src/shared/types/supabase.ts`;
  documented in `.gitignore` as the canonical location.

### Flagged, not changed (uncertain → report per protocol)
- `skills-lock.json` — git-tracked integrity lock for the **gitignored** `.claude/`
  Caveman skills. It was committed deliberately (commit 08a6473c) and the external
  Caveman installer regenerates it. Removing it is an external-tooling decision, not
  dead code, so it is left in place and flagged here.

### Doc fixes for stale references
- `dev/code/scripts/README.md` — `npm run find-unused:custom` → corrected to the real
  `npm run find-unused` (knip).
- `dev/README.md` — removed references to nonexistent `docs/changes/` and `dev/testing/`
  (tests live at repo-root `tests/`), and the now-deleted `tools/`; added the note that
  the test suite is at `tests/`.
- `src/shared/utils/domain/virtual-slide-search.ts` — header comment pointed at a
  nonexistent `dev/code/scripts/eval/`; corrected to `tests/benchmarks/search-eval.ts`
  (commit 0568a6a9).

## Phase 7 — Documentation

- **Audited all tracked docs** (`README.md`, `CLAUDE.md`, `src/README.md`,
  `tests/README.md`, feature READMEs) for references to anything deleted in this
  overhaul — **zero stale references found**. No live doc pointed at
  split_imports, dev/tools, the .bak, the planning docs, output.css, or the
  tailwind script.
- **`README.md` is accurate and current** (architecture, security model, companion
  Workers, caching, known gaps all match the code). Its links into `dev/docs/**`
  point at gitignored files — this matches the repo's deliberate local-knowledge-base
  pattern: `CLAUDE.md` explicitly frames `dev/docs/TOOLING-INDEX.md` and
  `dev/docs/KNOWLEDGE-GRAPH.md` as "local, gitignored" prerequisites. The tracked
  docs are self-sufficient for a fresh clone; `dev/docs/` is the maintainer's local
  pipeline/reference archive.
- **No doc reorganization forced.** The existing structure is coherent and
  convention-based (tracked: onboarding/conventions at root + `src/`, `tests/`;
  feature READMEs co-located; gitignored: the KG/tooling pipeline archive in
  `dev/docs/`). Moving `dev/docs` into a tracked `docs/` would either (a) commit a
  large, partially-stale local archive to git, or (b) split related content. Neither
  improves maintainability, so the structure is kept as-is — this is a justified
  alternative to the proposed `docs/` reorg.
- Fixed stale references in gitignored dev docs (`dev/README.md`,
  `dev/code/scripts/README.md`) and a stale code comment (`virtual-slide-search.ts`).

## Standards now in force (with pointers)
- **Auth**: middleware (`src/middleware.ts`) is the single route-gating + session
  boundary. API role checks go through `api-guard` (`requireUser`/`requireRole`/
  `requireAdmin`/`requireContentRole`). Role source of truth: `auth-helpers.ts`.
  Post-auth redirects must pass through `getSafeRedirectPath` (`route-helpers.ts`).
- **API**: error body `{ error }` (+optional `details`); validation via `parse-body`
  (zod); auth via `api-guard`; every non-debug route carries an `@swagger` JSDoc
  block (enforced by `tests/api/swagger-coverage.test.ts`).
- **Logging**: `log` from `@/shared/utils/logging`, never raw `console`
  (ESLint `no-console: error`).
- **Toasts**: `@/shared/utils/toast`, never `sonner` directly (ESLint
  `no-restricted-imports`).
- **Dialogs**: always `Dialog`, never `AlertDialog` (CLAUDE.md).
- **Badges / caching / R2-manifest**: see `CLAUDE.md` conventions.
- **Dead-code rule**: knip "unused export" ≠ dead — check internal use first.
  Internal-only → un-export; zero-references → delete. (Documented in changelog 1.3.)
