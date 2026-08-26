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
  `dev/scripts/r2/optimize-hero-images.ts` regeneration script, which is a
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
- `dev/reference/` — referenced by `src/shared/config/navigation.ts:272`
  (guest-quiz pattern deliberately preserved).
- `dev/scripts/` — referenced by comments + dev READMEs; the `eval:search` and
  image-optimization pipelines point here.
- `dev/reference/PathVideo.jsx` — referenced by `src/shared/lesson/easing.ts:1` (logic ported).
- `dev/supabase/migrations/` — matches live schema in `src/shared/types/supabase.ts`;
  documented in `.gitignore` as the canonical location.

### Flagged, not changed (uncertain → report per protocol)
- `skills-lock.json` — git-tracked integrity lock for the **gitignored** `.claude/`
  Caveman skills. It was committed deliberately (commit 08a6473c) and the external
  Caveman installer regenerates it. Removing it is an external-tooling decision, not
  dead code, so it is left in place and flagged here.

### Doc fixes for stale references
- `dev/scripts/README.md` — `npm run find-unused:custom` → corrected to the real
  `npm run find-unused` (knip).
- `dev/README.md` — removed references to nonexistent `docs/changes/` and `dev/testing/`
  (tests live at repo-root `tests/`), and the now-deleted `tools/`; added the note that
  the test suite is at `tests/`.
- `src/shared/utils/domain/virtual-slide-search.ts` — header comment pointed at a
  nonexistent `dev/scripts/eval/`; corrected to `tests/benchmarks/search-eval.ts`
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
  `dev/scripts/README.md`) and a stale code comment (`virtual-slide-search.ts`).

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

---

# FINAL REPORT

## 1. Changelog summary (by phase)

**Baseline** — committed in-progress text-search work; captured the starting
verification state (tsc ✓, eslint ✓, build ✓, vitest 2 pre-existing failures).

**Phase 1 — External tools & integrations**: reconciled `.env.example` with the 44
env vars actually read (added 10 undocumented vars incl. quiz-limits ×5, text-zoom
×4, `NEXT_PUBLIC_KNOWLEDGE_PAGES`, `CLOUDFLARE_R2_DATA_PUBLIC_URL`); removed the
dead `tailwind` CLI script + `@tailwindcss/cli` dep + create-next-app package.json
boilerplate; cleared **all** knip findings (17 unused exports, 2 unused files, 2
types, 1 duplicate export) down to zero.

**Phase 2 — Authentication**: fixed **two open-redirect vulnerabilities**
(`getSafeRedirectPath` added; applied to `/api/auth/confirm` `next` param and the
login `redirect` field); removed stale middleware-mirroring helpers
(`isAdminRoute`/`isProtectedApiRoute`/`isPublicApiRoute`).

**Phase 3 — User-facing**: wired up the question form's `onCancel` prop (was an
admitted TODO; now renders a Cancel button routed through the unsaved-changes
dialog). Knip clean; TODO scan done.

**Phase 4 — Admin**: closed a real authorization gap — middleware only guarantees
a *session* on `/api/admin/*` (its role gate matches `/admin` pages only), so 5 of
56 admin API routes enforced **no role** despite swagger docs promising one. All 56
now enforce a role via `api-guard`. Highest-impact: `notifications/system-update`
(broadcasts to users) and `r2-storage-stats` (service-role, bypasses RLS).

**Phase 5 — API & debug**: verified debug surface cannot leak in production
(gitignored + `.vercelignore`d + middleware prod-401 on `/api/debug/*`); folded the
single-consumer `api-response.ts` into `parse-body.ts` (0 of 79 routes used it).

**Phase 6 — Dev folder**: retired orphaned `dev/` items (split_imports.py, dev/tools/,
the .bak, .wrangler cache, 3 completed planning docs); fixed stale references in dev
docs + a stale code comment; carved the changelog out of the `dev/` gitignore so it
is version-controlled.

**Phase 7 — Documentation**: audited all tracked docs — zero stale references to
deleted items; kept the existing coherent structure (a justified alternative to a
forced `docs/` reorg); recorded the standards in force.

## 2. Deletion log (with evidence)

| Deleted | Evidence it was unused |
|---|---|
| `src/app/(admin)/admin/lesson-studio/utils/caption-builder.ts` | knip unused-file; 0 importers/tests/dynamic refs; byte-duplicate of `shared/lesson/captions.ts` |
| `src/shared/components/common/organic-image-gallery.tsx` | knip unused-file; 0 importers/tests; not in `common/index.ts`; superseded homepage hero |
| `src/shared/lesson/types.ts` `timingEnd()` | 0 callers repo-wide (1 occurrence = its own definition) |
| `src/shared/components/data-table/table-pagination.tsx` `TablePagination` component (+ orphaned `Button` import) | every `<TablePagination>` is a local per-table component; only `getPageNumbers` (same file) is shared |
| `cell-counter` `DEFAULT_CELL_TYPES` alias | identity alias for `PERIPHERAL_BLOOD_CELL_TYPES`; 1 use site updated |
| `route-helpers.ts` `isAdminRoute`/`isProtectedApiRoute`/`isPublicApiRoute` | 0 external importers; API lists stale vs middleware |
| `src/shared/utils/api/api-response.ts` + `apiSuccess` | 0 of 79 routes used it; only live consumer was `parse-body.ts` (folded in) |
| `tests/shared/utils/api/api-response.test.ts` | covered the deleted module; apiError cases moved to `parse-body.test.ts` |
| `@tailwindcss/cli` dep + `tailwind` script + package.json boilerplate | script wrote to never-imported `output.css`; dep had no dependents; `main:index.js` nonexistent |
| `dev/split_imports.py`, `dev/tools/*`, `*.md.bak`, `.wrangler/`, 3 planning docs | all gitignored (local-only); 0 references; verified before deletion |

**Un-exported (kept, internal-only — not deleted):** 9 helpers in `assembler-v2.ts`,
3 in `lesson/evaluate.ts`, `LESSON_SCHEMA_VERSION`, `IGNORED_CARD_IDS`,
`buildCaptionChunks`/`buildCaptionsFromWords`, `WsiEventOutcome`, `FieldOption`.

## 3. Verification (final full run)

- `npx tsc --noEmit` — **PASS** (0 errors)
- `npx eslint .` — **PASS** (0 errors; 6 warnings, all pre-existing in the gitignored
  debug sandbox)
- `npx vitest run` — **PASS, 1081/1081** (baseline was 1080 with 2 failing; both
  fixed, plus net new tests for the redirect-safety helper)
- `npm run build` — **PASS** (exit 0)
- `npx knip` — **clean** (0 findings)

## 4. Remaining risks / flagged-not-changed

> **Resolved in follow-up** (see the post-report section below): the Supabase
> migration gap was addressed by connecting to the live project and regenerating a
> schema snapshot; the debug-API `NODE_ENV` guards were added (10/10 routes);
> `skills-lock.json` and the Caveman skills were removed (no longer used). The items
> below are the ones still open.

- **`next.config.ts` `ignoreDuringBuilds`/`ignoreBuildErrors: true`** — suppress
  lint/type errors during `next build`. `tsc`/`eslint` are run separately and clean,
  so these can be re-enabled, but that is a deploy-behavior change I deferred.
- **Schema snapshot is documentation, not a rebuildable migration** — the regenerated
  `dev/supabase/migrations/*_schema_snapshot.sql` covers tables/columns/types/
  defaults/PK-FK markers but not indexes, triggers, RLS policies, or function bodies
  (PostgREST doesn't expose them). A true dump needs the DB password; path documented
  in `dev/supabase/README.md`. No live migration-history table exists, so future
  schema drift won't be caught automatically.
- **Rate-limiter "production scaling" TODOs** — in-memory limiters are correct for
  single-instance deploy; the TODO is a documented multi-instance scaling note, not
  incomplete code. Left.
- **In-memory `use-auth` sessionStorage cache** — a UI/perf convenience only; the
  real enforcement is server-side (middleware + api-guard + RLS). Verified correct,
  not a security issue.
- **5 eslint warnings** in the gitignored debug sandbox (dead vars / a useMemo dep in
  `src/app/debug/*`) — dev-only pages, warnings not errors, never deployed. Left.

---

# POST-REPORT FOLLOW-UP (Supabase connection + debug guards)

## Supabase: connected, verified migrations vs live schema

Connected read-only via the project's PostgREST OpenAPI spec (service-role key,
`htsnkuudinrcgfqlqmpi`). 58 tables/views live. Result: **the 3 migration files in
`dev/supabase/migrations/` are OUT OF DATE relative to the live schema** — the
knowledge-graph schema was consolidated after they were written.

- **Applied & current**: `20260629_audio_word_timings` (`audio.word_timings` jsonb
  ✓ present). Partially: `20260819_knowledge_graph` created `sources/assays/genes/
  entities/markers/entity_synonyms/marker_synonyms/surrogates` (all ✓ present).
- **Live schema DIVERGED from the migration files**:
  - `markers` **absorbed** `alterations` — live `markers` has a `kind` column;
    `topology.ts:132` documents "markers absorbed alterations: one noun,
    distinguished by kind".
  - **Dropped** (in migration files, absent live): `alterations`, `entity_relations`,
    `alteration_genes`, `expression_findings`, `alteration_findings`,
    `alteration_synonyms`, `concepts` (migration 3).
  - **Added live, not in any migration file**: `entity_placements` (heavily used),
    `entity_differentials`, `entity_merge_redirects`, `marker_summary`.
- **Impact on code**: none for live features — every table the production code
  queries (`entities`, `entity_placements`, `entity_synonyms`, `marker_synonyms`,
  `markers`, `surrogates`) exists live. Only the gitignored debug
  `knowledge-graph/route.ts` and `topology.ts` reference the consolidated-away
  tables (they read live-shape columns, so they work).
- **Action taken**: none to the migrations themselves — they are gitignored dev
  artifacts and rewriting them blind (no live migration history table was
  introspectable) risks falsifying history. This divergence is now documented here
  as the record. Recommend regenerating the migration files from the live schema
  (or adopting a proper migration-history table) as a separate, deliberate task.

## Debug-API guards: hardened all unguarded debug routes

### Debug-API hardening (per-route production guards)
- **Added** `if (process.env.NODE_ENV === "production") return 404` to the 7 debug-API
  routes that previously lacked an in-code guard: `ask-question`, `relation-review`
  (GET+POST), `audio-upload`, `knowledge-graph`, `ai-ping` (GET+POST),
  `generate-text`, `entity-search`. Several spend AI credits or write to R2, so the
  in-code guard matters.
- **Context**: these routes were never exploitable in production — they are
  gitignored + `.vercelignore`d (not in any deploy) and middleware 401s `/api/debug/*`
  in prod. This is defense-in-depth so a route stays safe even if that outer gating
  is ever bypassed or the file is copied out of the sandbox. 10/10 debug-API routes
  now carry the guard.
- **Checks**: 0 unguarded debug-API routes; `tsc` PASS; full `eslint` 0 errors (fixed
  the inserted-guard indentation via `--fix`); full `vitest` PASS; `npm run build` PASS.

## skills-lock.json + Caveman skills — REMOVED (supersedes the earlier "keep" note)
The maintainer confirmed the Caveman skills are no longer used. Removed:
- `skills-lock.json` (was the only git-tracked artifact — an integrity lock for skills
  that were never actually committed; `.claude/` has always been gitignored).
- `.claude/skills/` locally (the 7 caveman/cavecrew skill dirs).
- Caveman-specific ignore entries (`.agents/`, `AGENTS.md`) from `.gitignore`,
  `.vercelignore`, `.prettierignore` — neither existed on disk, nothing referenced them.
Kept: `.claude/` itself (still used for local agents/settings — `agents/`, `launch.json`,
`settings.local.json` are unrelated to Caveman) and the other AI-tool ignore entries
(`.cursor`/`.windsurf`/`.clinerules`/`.opencode`). Commit 5d6ea419. tsc passes.

### Schema snapshot regeneration (follow-up; DB-password-free path)
- **Context**: a faithful `pg_dump`/`supabase db dump` needs the DB password, which
  the maintainer chose not to provide/reset (and Docker is unavailable for the CLI
  path). So instead of a rebuildable dump, I generated a **clearly-labeled schema
  snapshot** from the live PostgREST OpenAPI spec.
- **What the spec actually exposes** (richer than expected): columns, types,
  nullability, defaults, AND PK/FK markers (PostgREST appends `<pk/>` /
  `<fk table='…' column='…'/>` to column descriptions). 58 tables/views, 577
  columns, 56 PKs, 73 FKs, 164 defaults.
- **Built** `dev/supabase/generate-schema-snapshot.mjs` (fetches the live spec via
  the service-role key, or reads a cached `/tmp/live_spec.json`; maps OpenAPI formats
  to SQL types; quotes string defaults; emits PK/FK as comments). Regeneratable any
  time with one command.
- **Replaced** the 3 stale migration files (`_audio_word_timings`, `_knowledge_graph`,
  `_entity_concepts`) — they had drifted from the live schema (KG consolidation) and
  presented a false history — with `20260826141723_schema_snapshot.sql` (58/58 tables
  covered, verified against the live spec).
- **Documented** the caveat + how to produce a true dump in `dev/supabase/README.md`.
- **All under gitignored `dev/`** (local-only). `tsc` unaffected. The honest record of
  the live schema now exists without touching the DB.

## Final cleanup: eslint warnings + rate-limiter comment accuracy

**ESLint → 0 problems.** Cleared the 5 warnings (all in the gitignored debug sandbox):
- `api/debug/knowledge-graph/route.ts` — deleted dead `citationWork` (the `citation`
  fn already handles the volume label; `citationWork` had zero callers).
- `app/debug/relations/page.tsx` — removed unused `useMemo` import, unused `stats`
  state (its `setStats` was set but never read), and unused `remaining` var. Kept
  `decided` (drives the progress bar).
- `app/debug/entity-cloud/page.tsx` — fixed the `exhaustive-deps` warning by binding
  `nodesPayload?.nodes` to a `payloadNodes` variable (an optional chain is not a valid
  dep entry) and pointing both `nodeById` and `organs` memos at it. The `organs` memo
  previously had a genuinely wrong dep (`[payload]` while reading `nodesPayload?.nodes`).
  Debug tests pass (16); the deleted-function change to knowledge-graph/route.ts is
  covered by `tests/debug/kg-atlas-geometry.test.ts`.

**Rate limiters — clarified, not re-engineered.** The two limiters
(`loginRateLimiter`, `authRateLimiter`) are deliberately in-memory and decorative on
Vercel; the real brute-force defense is Supabase's server-side `/auth/v1/*` limits +
Cloudflare (README.md "Security & Performance"). The only defect was the `TODO:
PRODUCTION SCALING CONSIDERATION` header, which read as unfinished work. Reworded both
headers to state plainly that in-memory is a **design decision**, point at the real
defense, and name the migration path (Upstash/Vercel KV) only if cross-instance
enforcement is ever actually needed. No behavior change.

Checks: `tsc` 0 errors, `eslint` 0 problems, `vitest` 1081/1081, `build` PASS.

---

# DOCS MAINTENANCE PASS — 2026-08-26

dev/docs audited against the live code (14,022 → 12,234 lines, 33 → 28 files).
All changes local-only (dev/docs is gitignored except this file). Fact-checking
done by 4 parallel read-only agents (doc-line → claim → src/ evidence); edits
applied by 6 parallel writer agents + orchestrator, each verifying against src/
before writing.

## Consolidated (6 → 2 docs)

- **Anki**: `anki.md` + `anki-quick-start.md` + `anki-workflow.md` → `anki.md`.
  Rewritten against reality: `upload-anki.sh` calls the deleted
  `/api/media/r2/upload-anki-media` route (documented as stale; Wrangler mode
  of `compress-and-upload-anki.sh` is the supported path); app consumption is
  the R2 manifest pattern (`src/shared/config/ankoma.ts` →
  `anki/manifest.json` → `ankoma.json.br`), so the doc adds the mandatory
  manifest-republish step (`r2_migrate_to_manifest.mjs --prefix anki/`).
  Dropped duplicated perf tables, the hand-rolled "batch script" (a worse
  reimplementation of the real scripts), changelog/FAQ filler.
- **Genova**: `genova-algorithm.md` + `genova-quickstart.md` → `genova.md`.
  Endpoint corrected to `/api/public/tools/genova/classify` (+ new
  `myvariant` route); file list corrected to the 8 real files
  (added format-predictions.ts, variant-evidence.ts); dropped the placeholder
  `github.com/your-repo` link and the dangling `docs/genomic-analysis-algorithm.md`.
- **API**: `api-data-flow.md` absorbed into `api-unified-architecture.md` as
  two new sections ("Client Storage & Quiz Lifecycle" with the corrected
  localStorage key catalog — per-key `pathology-bites-swr-<key>` {data,timestamp,
  ttl,version:"v3"} 30-day TTL, quiz `-result-`/`-draft-`/`-strikes-` keys,
  `migrateLegacyQuizKeys()`; "Cache Helper Inventory & Invalidation" with
  mutate-first helpers + `useCacheHelpers()`); redundant flow diagrams and the
  fictional `quiz_{sessionId}`/`cleanupLegacyQuizData()` content dropped.
  Unified doc also fixed: `/api/user/performance/all` →
  `/api/user/performance-data` (SWR key "user-data"), 32 → 42 achievement
  definitions, `makeServiceRoleClient` → `createServiceRoleClient`, removed
  the nonexistent "Check for New Achievements" button claim, reload-is-a-HIT
  correction, `dashboard`/`quizInit` response blocks, hook-vs-provider SWR
  config override. api-data-flow.md deleted.

## Deleted (1)

- `audit-checklist-2026-05-17.md` — closed May-2026 security-audit record.
  Its durable rationale already lives in README.md "Security & Performance" +
  CLAUDE.md "Security"; the commit SHAs and issue resolutions are in git
  history (dev/docs itself is gitignored, so the record wasn't versioned
  anyway). Per docs rule: no recaps.

## Updated (against live code)

- `system/project-structure.md` — 19 fixes: added tests/, webpack/, configs,
  dev/{reference,resources,scripts,supabase}; removed dead `dev/docs/{database,
  setup,testing,tools}`; (public) adds maintenance/, short-links e/[slug] g/
  [symbol] m/[slug], tools/{ihc,image-converter}; `robots.txt`/`sitemap.xml` →
  `.ts` generators; dropped api/docs + api/public/csrf-token (both removed
  deliberately); features adds knowledge/, knowledge-graph/, tools/ihc/;
  shared/ tree rebuilt (config/, fonts/, lesson/; real contexts/hooks/services
  — old names like auth-context.tsx, cache-service.ts, database-sync-manager.ts
  gone); example import paths fixed; postcss.config.js; dates reconciled.
- `system/auth-architecture.md` — middleware DOES gate /dashboard (redirect to
  /login?redirect=); no /docs handling exists; `enableSecurity` is a no-op.
- `system/toast-system.md` — wrapper at `shared/utils/ui/toast.ts`; sonner.tsx
  doesn't exist (Toaster inline in layout.tsx, sonner defaults — the claimed
  position/duration/visibleToasts/richColors config was fictional); theme
  forcing is ConditionalThemeProvider, not the dead `data-public-layout-enforced`
  attribute.
- `system/IMAGES_README.md` + `system/R2_README.md` — exported wrappers
  (uploadToR2 etc., not PutObject); r2-direct-access/r2-url-transformer live in
  utils/r2/; middleware = auth-only for API routes, roles per-route.
- `system/EXPLAINER-SYSTEM.md` — full rewrite: old ExplainerSequence/Segment/
  Keyframe layer removed upstream; rebuilt on the Lesson/Slide/SlideElement
  model (src/shared/lesson/*), evaluate()-based engine, zustand studio store
  with HISTORY_LIMIT=50 undo/redo; removed the fictional 5s audio cushion,
  explainer-image-selector.tsx, /test/explainer-player.
- `features/logging-guide.md` — getClientIP import/signature; `[Database Query]`
  prefix; secureLog only wraps info/warn/error in production; no credit-card/
  SSN redaction.
- `features/runtime-warnings.md` — Next 15.5.18; removed the dead
  MIDDLEWARE_NODEJS_RUNTIME.md reference.
- `features/virtual-slides-organ-systems-final.md` → renamed
  `virtual-slides-organ-systems.md` and rewritten to the 63-entry v8 taxonomy
  in `organ_aliases.json` (old 62-entry list matched no data file); v4-era
  stats labeled historical.
- `features/virtual-slides-v7-production.md` — field spec kept (app still
  validates json.bases && json.data); added superseded-by-v9–v15-manifest
  header; WHO-abbreviation matching is exact-match only (no partial/first-letter
  fallback); dead input/output paths marked historical.
- `filename-parsing-guide.md` — magnification is bracketed `[40x]`; documented
  the `[Src=xxx]` tag → images.source_ref.
- `question-versions-json.md` — buildQuestionSnapshot() shape (added tag_ids,
  removed id/status); SQL example fixed (no version_string column);
  dual producers (code + get_question_snapshot_data RPC) noted.
- `knip-annotation-guide.md` — removed @scalar/nextjs-api-reference from the
  embedded config; softened the CI claim (knip is advisory, --no-exit-code).
- `manual-testing-plan.md` — quiz localStorage keys corrected to -result-/
  -draft-/-strikes-; auto-save is every answer (periodicSaveInterval: 1).
- `quick-reference.md` — localStorage cheat sheet rewritten (unified-cache
  per-key entries, real quiz prefixes, pathology-bites-theme); real
  [Storage Cleanup] log strings; removed fictional keys.
- `AUDIT-PROMPT.md` — added header noting "Current state"/"What is open" are
  point-in-time snapshots from the kgaudit dump; traps/methodology timeless.

## Added (1)

- `DOCS-MAINTENANCE-PROMPT.md` — reusable, self-contained prompt for auditing
  and repairing this docs tree (survey → parallel fact-check → consolidate →
  update → delete → index/changelog close-out), with explicit keep-vs-delete
  criteria. Supersedes the one-off prompts used for earlier passes.

## Index updates

- `README.md` / `system/README.md` / `features/README.md` — file lists,
  one-liners, and the API/data-flow entry updated; docs now advertise the
  maintenance prompt.

## Verification

- Dangling-reference grep across dev/docs + README.md + CLAUDE.md + src/ +
  tests/: zero live hits (only two intentional historical mentions).
- No code touched; docs-only. `tsc`/`eslint`/`vitest` unaffected (not rerun;
  no source changes).

---

# DOCS REORG — 2026-08-26 (folder layout)

`dev/docs/` reorganized into six subfolders; the root now holds only
`README.md` (the index). No content changes beyond path references.

- `system/` — project-structure, auth-architecture, api-unified-architecture,
  toast-system, R2_README, IMAGES_README, EXPLAINER-SYSTEM, + moved in:
  `filename-parsing-guide.md`, `question-versions-json.md`
- `features/` — unchanged (anki, genova, logging-guide, runtime-warnings,
  virtual-slides ×2)
- `knowledge-graph/` — KNOWLEDGE-GRAPH.md, KNOWLEDGE-GRAPH-ARCHITECTURE.md,
  AUDIT-PROMPT.md, OPEN-ITEMS-orphan-markers.md
- `tooling/` — TOOLING-INDEX.md, knip-annotation-guide.md
- `testing/` — manual-testing-plan.md, quick-reference.md
- `meta/` — OVERHAUL-CHANGELOG.md, DOCS-MAINTENANCE-PROMPT.md

Ripple updates:
- `.gitignore` — changelog carve-out extended for the new path
  (`!dev/docs/meta/` + `!dev/docs/meta/OVERHAUL-CHANGELOG.md`), keeping it
  the only git-tracked doc.
- `CLAUDE.md` — TOOLING-INDEX / KNOWLEDGE-GRAPH pointers → new paths.
- `src/features/public/tools/ihc/aggregate.ts` — comment path updated.
- `dev/docs/README.md` — rewritten as the single root index (layout +
  start-here + rules).
- Cross-references fixed: `knowledge-graph/` → `../tooling/TOOLING-INDEX.md`;
  `testing/quick-reference.md` → `../system/api-unified-architecture.md`;
  `features/README.md` auth link; `meta/DOCS-MAINTENANCE-PROMPT.md` and
  `system/project-structure.md` dev/docs subtrees updated to the new layout.
- Historical entries above keep their original paths (accurate at the time).

---

# FEATURE-DOC GAP FILL + KG SECTION REFRAME — 2026-08-26

Coverage audit (every feature dir + route vs dev/docs) found five gaps and one
category confusion. All new docs fact-checked against src/ by parallel
research agents; written to match existing doc voice.

## Added — 5 feature docs

- `features/question-authoring.md` — roles, status lifecycle (draft →
  pending_review → published/flagged/rejected) with per-transition enforcement
  routes, versioning rules (applyQuestionVersioning: initial 1.0.0, semver
  bumps, backfill via get_question_snapshot_data RPC), resubmission/feedback
  flow (notes live in question_reviews.changes_made — no column on questions),
  distributed audit trail (question_reviews / question_versions /
  question_flags + DB trigger), API route table. Flagged: `archived` status is
  dead; POST [id]/version uses requireUser despite swagger saying admin.
- `features/learning-features.md` — Learn module (two content formats:
  markdown + :::image/:::explainer/:::key-points directives; legacy JSONB),
  progress recording, study-plan scheduler pipeline (calendar → resources →
  work-items → distribution → merge/glue → stable task ids), persistence
  tables, and the three distinct "progress" surfaces. Flagged:
  /dashboard/progress is a placeholder; "completed: false" never clears
  completed_at; src/shared/lesson `Lesson` ≠ Learn-module `Lesson`.
- `features/wsi-questions.md` — client-driven flow (client picks the slide,
  pendingSlide before generation), generate/answer API, TEXT_FALLBACK_CHAIN
  (Groq → CF Workers AI → Mistral → Gemini), contract enforcement, events-only
  data model (no wsi_questions table), 900ms debounce rationale. Flagged: the
  slide image is never sent to any model; no per-user rate limiter.
- `features/ihc-panel-builder.md` — three modes, log₂-LR scoring model,
  coverage discount, merge rules (entity_merge_redirects + canonical-name
  fold), R2 manifest data path (no API route), pipeline scripts + the
  acronym-pass trap. Flagged: page disclaimer counts are dynamic per build
  and unreproducible from current artifacts; live manifest lacks
  entityGroups (newer than last publish → ~76 curated merges inactive).
- `features/knowledge-graph.md` — runtime feature: hero cloud (dynamic import,
  not flag-gated) vs /e /m /g pages (NEXT_PUBLIC_KNOWLEDGE_PAGES === "1",
  request-time read), two disjoint data paths (R2 snapshot binary vs anon+
  RLS server components), graph3d/community rendering, snapshot build/publish
  (90%-regression gate), hero interactions, public-vs-debug boundary.

## KG section restructured (reframe, not move)

- `knowledge-graph/README.md` added: the folder is the WHO dataset **pipeline
  + design rationale**, not the runtime feature; runtime → ../features/
  knowledge-graph.md; KNOWLEDGE-GRAPH-ARCHITECTURE.md labeled stale-bannered
  (its own header already says so); AUDIT-PROMPT/OPEN-ITEMS framed as
  point-in-time / work-queue.
- Root `dev/docs/README.md`: layout + start-here updated (pipeline vs runtime
  pointers).
- `features/README.md`: all 11 feature docs listed.

## Code-comment fix (documentation-only)

- `.env.example`: NEXT_PUBLIC_KNOWLEDGE_PAGES comment corrected — routes are
  /e /m /g (not /knowledge), read at request time (not build time), "1" is the
  only enabling value, hero cloud not gated.

## Verification

- Every claim in the 5 new docs traced to a src/ file by the research agents;
  unverifiable items are flagged inline in the docs.
- No code changes (one comment-only .env.example edit).

---

# KG FOLDER RETIRED — PIPELINE DOCS MERGED INTO tooling/ — 2026-08-26

`dev/docs/knowledge-graph/` removed. The folder misnamed its content: it never
held "the graph" (that's the runtime feature, documented in
`features/knowledge-graph.md`) — it held the WHO **dataset pipeline** (build
map, audit brief, work queue, stale design rationale). Those are tooling docs,
and TOOLING-INDEX already treats KNOWLEDGE-GRAPH as its sibling pillar
("the log" / "the map"). Both now live side by side:

- `tooling/KNOWLEDGE-GRAPH.md` + `KNOWLEDGE-GRAPH-ARCHITECTURE.md` +
  `AUDIT-PROMPT.md` + `OPEN-ITEMS-orphan-markers.md` (moved from
  `knowledge-graph/`)
- `tooling/README.md` added: frames the two pillars, labels
  KNOWLEDGE-GRAPH-ARCHITECTURE stale-bannered, AUDIT-PROMPT point-in-time,
  OPEN-ITEMS as the active queue

Ripple updates: `CLAUDE.md` + `ihc/aggregate.ts` comment → `dev/docs/tooling/`;
root `dev/docs/README.md` (five subfolders, pipeline/runtime pointers);
`system/project-structure.md` subtree; `features/{knowledge-graph,ihc-panel-builder}.md`
cross-links → `../tooling/`; `KNOWLEDGE-GRAPH.md` internal TOOLING-INDEX refs →
same-folder; `meta/DOCS-MAINTENANCE-PROMPT.md` cluster lists.
No code changes.
