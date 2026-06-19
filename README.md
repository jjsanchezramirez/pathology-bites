# Pathology Bites

![Pathology Bites Logo](https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/images/logo.png)

Pathology Bites is a modern, AI-powered educational platform providing free, high-quality pathology learning materials for medical students, residents, and practicing pathologists. It combines a reviewed question bank, structured lessons, a personalized study planner, interactive teaching sequences, virtual-slide viewing, and a suite of pathology tools — with detailed explanations and performance tracking across all major subspecialties.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-61DAFB)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2-orange)](https://developers.cloudflare.com/r2/)

---

## Features

- **Question bank & review workflow** — multi-role authoring (creator → reviewer → published) with versioning, resubmission notes, and an audit trail.
- **Quiz system** — configurable quizzes with a hybrid client/server state machine, results analytics, and percentile/peer comparisons.
- **Learn module** — subjects → lessons with per-user progress tracking.
- **Study plan** — a personalized scheduler that builds a dated plan from exam date, available time, and progress.
- **Interactive sequences** — step-through teaching content used by the lesson studio.
- **Virtual slides (WSI)** — OpenSeadragon-based whole-slide viewer with a same-origin tile proxy across multiple external pathology repositories.
- **Educational tools** — citations, MILAN gene lookup, Genova, ABPath specs, cell quiz/counter, lupus anticoagulant interpreter (see [Educational Tools](#educational-tools)).
- **Anki integration** — compressed deck upload + serving from R2.

## Tech Stack

| Layer          | Choice                                                            |
| -------------- | ---------------------------------------------------------------- |
| Framework      | Next.js 15 (App Router) + React 19 + TypeScript 5.8              |
| UI             | Tailwind CSS v4 + shadcn/ui                                       |
| Auth & DB      | Supabase (PostgreSQL, Auth, Row Level Security)                  |
| Storage        | Cloudflare R2 (`@aws-sdk/client-s3`), zero-egress CDN            |
| Slide viewer   | OpenSeadragon (DZI / IIIF / Aperio tile sources)                |
| Hosting / Edge | Vercel (serverless) behind Cloudflare (WAF, CDN, DDoS)          |
| Testing        | Vitest                                                           |
| API docs       | `next-swagger-doc` + Scalar, served at `/docs`                  |

## Architecture

The codebase is organized around a **4-tier access model** mirrored consistently across app routes, feature modules, and API routes:

1. **Admin** — admin / creator / reviewer only
2. **Auth** — authentication flows (no session required)
3. **User** — authenticated dashboard features
4. **Public** — no auth required

**Request path & defenses:** Cloudflare edge → Vercel → `src/middleware.ts` (JWT + role check, injects trusted `x-user-id` / `x-user-role` headers) → route handler → Supabase with RLS. App-layer security is intentionally thin; the real enforcement is Cloudflare + Supabase auth/RLS + middleware (see [Security & Performance](#security--performance)).

**Caching:** Cloudflare CDN fronts Vercel; client state uses SWR through a custom isolated provider (`swr-cache-provider.tsx`). Heavy reads (R2 datasets, demo questions) use server-side caching with TTLs.

Deeper references:

- [`dev/docs/system/project-structure.md`](./dev/docs/system/project-structure.md) — full directory map & access model
- [`dev/docs/system/auth/architecture.md`](./dev/docs/system/auth/architecture.md) — auth layering
- [`dev/docs/system/api/unified-architecture.md`](./dev/docs/system/api/unified-architecture.md) — unified data API & `useUnifiedData`
- `CLAUDE.md` — conventions, lint rules, and hard-won gotchas

## Companion services & repos

The Vercel app is the core, but a few pieces run as standalone **Cloudflare Workers** in their own private repos. The main repo is public, so anything carrying scraping credentials or that's pure infrastructure lives outside it. Each Worker is deployed independently with `wrangler deploy` — no CI, by design (low change frequency, single maintainer).

| Service | Domain | Repo (private) | What it does |
| --- | --- | --- | --- |
| **R2 Explorer** | `r2.pathologybites.com` | `pathology-bites-r2-explorer` | Admin file browser for the three R2 buckets. Hono worker (buckets bound directly) + React/Vite/Tailwind/shadcn SPA in the PB design system, cookie session auth. Replaced an abandoned `g4brym/R2-Explorer` fork. |
| **WSI tile proxy** | `wsi.pathologybites.com` | `pathology-bites-wsi-proxy` | CORS-cleans + edge-caches whole-slide-image tiles for the in-house OpenSeadragon viewer. Moved off the Vercel route to escape egress overage — see [Performance notes](#performance-notes). (`wsi-tiles.pathologybites.com` is a transitional alias, slated for removal.) |
| **Search corpus / scrapers** | — (publishes to R2) | `pathology-bites-corpus` | Scraper pipeline + brotli-compressed search-corpus build, published to the `pathology-bites-data` bucket. Symlinked into `dev/resources/scrapers`. |

**R2 buckets:** `pathology-bites-data`, `pathology-bites-images`, `pathology-bites-audio` (zero-egress; fronted by the explorer above and consumed directly by the app).

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (admin)/            # Admin pages (UnifiedLayout w/ admin nav)
│   ├── (auth)/             # Login / signup / reset
│   ├── (dashboard)/        # Authenticated user pages
│   ├── (public)/           # Public pages + tools
│   └── api/                # Route handlers (admin / auth / user / public)
│
├── features/               # Domain modules
│   ├── admin/              # questions, images, inquiries, audio, learn…
│   ├── auth/               # auth flows
│   ├── user/               # quiz, learn, study-plan, anki, performance…
│   └── public/             # tools/
│
└── shared/                 # Reusable components, hooks, services, utils, types, config
```

Feature code lives in `src/features/{domain}/`; reusable code in `src/shared/`. Imports use the `@/` alias (→ `src/`).

## Educational Tools

| Tool                       | Notes                                                                 |
| -------------------------- | --------------------------------------------------------------------- |
| **Citations**              | URL/DOI/ISBN detection, APA/MLA/AMA/Vancouver, 24h localStorage cache |
| **MILAN** (gene lookup)    | HGNC + Harmonizome, 7-day cache, common-gene pre-loading             |
| **Genova**                 | Molecular classification helper                                       |
| **Virtual Slides**         | R2-backed search over 7+ external WSI repositories + viewer          |
| **ABPath Specs**           | Full ASCP content specs with client-side AP/CP filtering + PDF export |
| **Cell Quiz / Counter**    | Blood-cell morphology practice with R2-optimized images             |
| **Lupus Anticoagulant**    | Pure client-side coagulation interpretation (PT/INR/aPTT/dRVVT)     |

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (Auth + PostgreSQL)
- A Cloudflare R2 bucket

### Setup

```bash
git clone <repo-url>
cd pathology-bites
cp .env.example .env.local   # fill in the values below
npm install                  # also runs setup-ffmpeg postinstall
npm run dev                  # http://localhost:3000
```

### Environment

Key variables (full list in `.env.example`):

| Variable                                                       | Purpose                          |
| ------------------------------------------------------------- | -------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Supabase client                  |
| `SUPABASE_SERVICE_ROLE_KEY`                                    | Server-side / SECURITY DEFINER RPC calls |
| `CLOUDFLARE_R2_*`                                             | R2 access + public URL           |
| `RESEND_API_KEY`                                              | Transactional email              |
| `NEXT_PUBLIC_TURNSTILE_SITEKEY`                              | CAPTCHA (currently disabled)     |
| AI / data provider keys (Gemini, Claude, Mistral, OncoKB…)   | Tool integrations                |

## Commands

| Command                  | Description                              |
| ------------------------ | ---------------------------------------- |
| `npm run dev`            | Local dev server                         |
| `npm run build`          | Production build                         |
| `npm run start`          | Serve the production build               |
| `npm run lint`           | ESLint (`prettier/prettier` enforced)    |
| `npm run format`         | Prettier write                           |
| `npm run type-check`     | `tsc --noEmit`                           |
| `npm run test`           | Vitest (watch); `test:run` for one-shot  |
| `npm run test:api`       | API tests (incl. swagger coverage guard) |
| `npm run find-unused`    | Dead-code / unused-export check (knip)   |

## API Documentation

Interactive API reference is served by **Scalar at [`/docs`](http://localhost:3000/docs)**, generated from `@swagger` JSDoc blocks on each route handler (`next-swagger-doc`). The raw OpenAPI spec is at `/api/docs`.

Every non-debug route under `src/app/api` is expected to carry an `@swagger` block; `tests/api/swagger-coverage.test.ts` fails the build if one drifts out of the docs. When adding a route, add a block (mirror any existing one, e.g. `src/app/api/public/demo-questions/route.ts`).

## Database

PostgreSQL via Supabase — ~32 tables, 100% RLS coverage, with `SECURITY DEFINER` functions for cross-user aggregation (percentiles, ranks). Core domains:

- **Questions** — `questions`, `question_options`, `question_images`, `question_reviews` (audit trail), `question_versions` (published-question snapshots).
- **Learning** — `subjects`, `lessons`, lesson progress, interactive sequences, study-plan config/progress.
- **Users & activity** — `users` (mirrors `auth.users`, role + status enums), quiz sessions/attempts, favorites, notifications.
- **Media** — `images`, R2 object references, SVG assets, audio.

> Cross-user aggregation must use `SECURITY DEFINER` (RLS otherwise collapses aggregates to "1st of 1") — see the gotchas in `CLAUDE.md`. Schema detail lives in `dev/docs/system/` and the Supabase dashboard.

## Security & Performance

Real defense lives at the edge and in the database, not the app layer. The app-layer is thin **on purpose**.

### Defense layers (in order of who actually does the work)

1. **Cloudflare edge** — DDoS scrubbing, WAF, bot management, TLS termination. Front of Vercel. Zero code, max value. Strongest layer.
2. **Supabase auth + RLS** — JWT session, refresh-token rotation w/ reuse detection, server-side rate limits on `/auth/v1/token`, `/auth/v1/signup`, `/auth/v1/recover` (default 30 req/5min/IP). Per-table RLS scopes reads to `auth.uid()`. Real brute-force defense lives here.
3. **Middleware** (`src/middleware.ts`) — JWT check on `/admin/*`, `/dashboard/*`, `/docs/*`, non-public `/api/*`. Role gate on `/admin` (admin/creator/reviewer). Injects trusted `x-user-id` + `x-user-role` headers downstream so handlers don't re-verify.
4. **Session cookies** — Supabase sets httpOnly, secure (prod), `sameSite: lax`. Browser blocks cross-site POST/PATCH/DELETE → automatic CSRF defense.
5. **Honeypot** — hidden `referral_source` input on signup + contact forms. Bots auto-fill, humans don't. Server-side reject on signup form. Server action silent-success on contact.
6. **App-layer rate limiters** (decorative on Vercel) — `loginRateLimiter` on login server action, `authRateLimiter` on `/api/auth/callback`. In-memory Map per lambda → effective only single-instance / dev. Supabase's server-side limits do the real work.
7. **Framework defaults** — React JSX escaping (XSS), PostgREST parameterized queries (SQL injection), Next.js CSP headers.

### Features deliberately removed (Apr–May 2026 audit)

Don't re-add without revisiting the threat model.

- **Browser fingerprinting + `security_events` table** — Client-side fingerprint (browser/timezone/screen). Bots spoof in 5 lines. Real session hijack uses victim's cookie, not a different browser env. Supabase's refresh-token reuse detection is the actual defense. Removed ~450 LOC.
- **Custom CSRF token machinery** — Double-submit cookie pattern that never validated server-side. Token roundtripped, header attached, server ignored. `sameSite: lax` on Supabase auth cookie + CORS preflight on JSON `fetch` already block real CSRF. Removed ~1000 LOC across 14 files.
- **Per-action rate limiters** (signup, password-reset, email-verify, admin-API, quiz-API) — Declared but never wired. Supabase handles `/auth/v1/*` server-side anyway. Removed ~150 LOC.
- **`generalAPIRateLimiter`** — Only consumer was `/api/public/csrf-token` (also removed). Dead after CSRF removal.

### Known gaps

- **Turnstile (CAPTCHA) currently disabled** — `isCaptchaEnabled()` returns `false` in `src/features/auth/utils/captcha-config.ts`. Plumbing intact in login/signup/forgot-password forms. Disabled because it was breaking non-Gmail auth. While off, only email verification gates bot signups.
- **App rate limiters non-functional on Vercel** — In-memory `Map` per lambda instance; doesn't shard. Not a security gap (Supabase + Cloudflare handle the real limits) but don't rely on them. If cross-instance enforcement is ever needed, migrate to Upstash KV / Vercel KV.
- **No honeypot on forgot-password form** — Low priority: Supabase rate-limits `/auth/v1/recover` per IP.

### Threat coverage

| Attack                | Defender                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| Credential stuffing   | Supabase `/auth/v1/token` rate limit + Cloudflare                         |
| Signup spam           | Supabase signup limit + email verification + honeypot                     |
| Password reset abuse  | Supabase `/auth/v1/recover` limit                                         |
| Unauthorized read     | RLS (`auth.uid()` filter) + middleware 401                                |
| Privilege escalation  | JWT `app_metadata.role` (server-set, unforgeable) + middleware role check |
| Session hijack        | Supabase refresh-token rotation + reuse detection                         |
| CSRF                  | `sameSite: lax` cookie + JSON CORS preflight                              |
| DDoS / volumetric bot | Cloudflare edge                                                           |
| SQL injection         | PostgREST parameterized queries                                           |
| XSS                   | React JSX escaping                                                        |
| Bot signup (current)  | Email verification + honeypot (Turnstile OFF)                             |

### Performance notes

- R2 zero-egress enables aggressive caching of images and datasets without bandwidth penalties; all images are served `unoptimized` to avoid Vercel transformation costs.
- **WSI tiles are served by a Cloudflare Worker (`wsi.pathologybites.com`), not the Vercel route.** This was moved off Vercel to escape origin-transfer (egress) overage — Vercel bills by the **gigabyte** (the ~20 GB/day of tile traffic blew the quota), Cloudflare Workers bill by the **request** with bandwidth free. On the $5/mo Workers Paid plan: **10M requests/month** included (~333K/day), then $0.30 per extra million; **30M CPU-ms/month** included; **egress is $0**. Recent peak was ~50K tiles/day (~1.5M/month ≈ 15% of the included 10M), so ~6–7× headroom before any overage. 10M tiles ≈ 30K–100K slide-view sessions/month (a deep-zoom session pulls a few hundred tiles); re-viewed slides hit `cf-cache-status: HIT` and cost ~nothing. Even at 3× growth (30M tiles) the bill is ~$11/mo. Bandwidth never re-enters the cost equation.
- Quiz flows are deduplicated and batched (settings/analytics calls collapsed); results cache with a short TTL + stale-while-revalidate.
- Don't set custom `Cache-Control` on paths Next.js manages (`/_next/static/`). Debugging deploy/cache issues means purging **both** Cloudflare and Vercel caches.

## Testing

```bash
npm run test         # Vitest watch
npm run test:run     # one-shot
npm run test:api     # API tests, including the swagger-coverage guard
npm run test:coverage
```

See [`tests/README.md`](./tests/README.md) for structure and conventions.

## Deployment

Deployed on **Vercel** behind **Cloudflare**. Set the environment variables from `.env.example` in the Vercel project, configure Supabase OAuth redirect URLs, and point the Cloudflare zone at the Vercel deployment. Production builds run `npm run build`; `setup-ffmpeg` runs on install to fetch the FFmpeg WASM assets.

The companion Cloudflare Workers ([Companion services & repos](#companion-services--repos)) deploy independently from their own repos via `wrangler deploy` — they are not part of the Vercel build.

## License

MIT
