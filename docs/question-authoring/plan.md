# Question authoring: current state and modernization plan

_Read-only audit, 2026-11-22. Nothing in the code or database was changed to write this._

## Summary

- **630 questions exist; every one was created by the single admin account**, all in "AI-Generated" sets. 487 sit in the "Claude Opus 4.6" set, written mostly by Claude batches through raw SQL (the `pathology-bites-qwriter` skill), not through the app.
- **There are about a dozen write paths**: the qwriter skill (raw SQL), 15+ admin API routes, three browser-side inserts and one dev tool. They disagree on how they check roles, and most of them skip versioning.
- **Versioning covers 11% of questions.** 559 of 630 have no version row at all; 365 published questions have no "initial" version; 18 were edited after their last snapshot. Snapshots leave out answer explanations and tags. One versioning function is broken (it writes a column that doesn't exist). Deleting a question deletes its history.
- **Review is a formality today.** All 397 published questions that record a reviewer list the author as reviewer, and 394 of 411 published questions have no approval record. Only one account holds an elevated role.
- **Security issue (Phase 0) — fixed 2026-11-22:** user roles came from a field users could edit themselves, and the admin APIs trusted it while writing with the service-role key. See Phase 0.

Target design (from Juan): one server write path with draft / in review / published; database versioning as the only way a question changes; server-side AI for drafting and fact-checking against WHO, PathologyOutlines and the private sources bucket, without exposing source text; one shared checker; second-admin approval with roles.

---

## 1. How questions get written today

| # | Path | Where | DB client | Role check | Versions? | Status effects |
|---|---|---|---|---|---|---|
| 1 | **qwriter skill** (Claude batches) | plugin skill `pathology-bites-qwriter/SKILL.md` | Supabase MCP `execute_sql` — raw SQL as DB owner | none | no | inserts `draft`; also inserts `tags`, `question_tags`; hard-codes `created_by` = admin and one `question_set_id` |
| 2 | POST `/api/admin/questions/create` | `create/route.ts` | service role | header role (`requireContentRole`) | no (sets 1.0.0 but no row) | new `draft` |
| 3 | PATCH `/api/admin/questions/{id}` | `[id]/route.ts` + `services/*` | service role | header role (`canEditQuestion`) | TypeScript inserts on first publish, patch and minor/major edits; **none when no `updateType`** (change-category and change-set dialogs) | any status the body asks for, including `published` directly |
| 4 | POST `/{id}/submit-for-review` | route | cookie | role re-read from `users` | no | draft/rejected → pending_review |
| 5 | POST `/{id}/approve` · POST `/bulk-approve` | routes | cookie | `users` table; admin or assigned reviewer | **no** | pending_review → published |
| 6 | POST `/{id}/reject` · `/{id}/reassign` · DELETE `/{id}/delete` | routes | cookie | `users` table | no | reject; change reviewer; delete drafts |
| 7 | POST `/api/admin/questions/bulk` | route | service role | `users` table | **no versions, no review rows, no notifications** | submit (no reviewer), approve, reject (**including published → rejected**), delete |
| 8 | POST `/{id}/version` | route | service role | **none** | calls the broken RPC | — |
| 9 | Metadata routes (tags, sets, categories, merges) | `metadata/**` | cookie | header role | no | rewrite `question_tags`, `question_set_id`, `category_id` across many questions |
| 10 | Browser inserts | `step-source-config.tsx` (tags, question sets); `question-flag-dialog.tsx` (flags → trigger flips status to `flagged`); unused `use-questions.ts` `createQuestion` | anon/cookie | RLS only | no | flag trigger: published ↔ flagged |
| 11 | Dev knowledge-graph tool | `src/app/api/debug/kg-atlas` (dev only) | service role | prod-only gate | no | writes `questions.entity_id` |

Scripts in `dev/scripts` and the corpus repo don't write questions. Historical SQL under `dev/scripts/migrations/` defines versioning triggers that are **not** live; the only live triggers on `questions` are delete cleanup, `updated_by` stamping and the question count, plus the flag-status trigger on `question_flags`.

## 2. Versioning today

- **Table `question_versions`:** `question_id`, `version_major/minor/patch`, `update_type` (initial / patch / minor / major), `question_data` (jsonb snapshot of the state *before* the change), `change_summary`, `changed_by`, `created_at`. The current state lives only in `questions`.
- **Snapshot (`get_question_snapshot_data`):** question fields, options (text, is_correct, order) and image links. **Missing: option explanations, tags, reviewer fields.** Restoring from a snapshot would lose every explanation.
- **Writers:** the PATCH route inserts rows from TypeScript. `create_question_version_simplified` (used by `/{id}/version`) inserts into a `version_string` column that doesn't exist, so it fails on every call.
- **No diffs** are stored; there's no restore endpoint; `questions_delete_cleanup_trigger` deletes a question's version history with it.
- **Coverage:** 128 version rows across 71 of 630 questions. 559 questions have none; 365 published questions have no initial version; 18 versioned questions changed after their last snapshot.
- **Inserts are locked down:** RLS on `question_versions` refuses inserts from users (`CHECK false`), so only service-role code can write versions.

## 3. Roles and permissions today

- **Roles:** enum `admin, creator, reviewer, user`. In `public.users`: 1 admin, 2,067 users; no creators or reviewers.
- **Where the app gets the role:** middleware reads it from the Supabase auth token (`app_metadata.role`, falling back to `user_metadata.role`) and forwards it in an `x-user-role` header. No account has `app_metadata.role` set, so in practice the role comes from the user-editable field. (Details withheld here because this repo is public; see Phase 0.)
- **Gating:** `/admin/*` pages are gated in middleware; `/api/admin/*` is **not** — each route checks for itself, half from the header and half by re-reading `public.users`.
- **RLS:** `questions` insert is limited to admin/creator; update to the owner on draft/rejected or the reviewer on pending_review (or admin); delete is admin only. `question_options` and `question_images` have **no** insert or update policies, so only service-role code can write them. `question_versions` inserts are blocked for users.
- **Review workflow:** statuses `draft → pending_review → published | rejected`, plus `flagged` (from learner flags) and `archived`. There's no "approved" state; approval publishes directly. Self-review is allowed, and the bulk route lets an admin approve without a review record.

## 4. Data-quality signals worth checking

- 1 question doesn't have exactly one correct option.
- 0 image references point at missing images.
- 52 questions are `flagged`, 150 `draft`, 8 `pending_review`, 9 `archived`.

## 5. Gaps against the target design

| Target | Today | Gap |
|---|---|---|
| 1. One write path, used by admin UI, in-site AI and batch scripts | ~11 paths; Claude writes raw SQL; browser inserts; service-role routes trust a forgeable role | Everything must go through one server service; direct table writes revoked |
| 2. DB versioning is the only way a question changes | Versions are optional, incomplete and deletable; one RPC broken | Write + snapshot must happen in one transaction, enforced in the database; full snapshot; restore; history survives deletion |
| 3. Server-side AI: draft and fact-check against WHO, PathologyOutlines, ExpertPath/PathPrimer, without showing source text | AI generate exists but sends only labels; AI keys are `NEXT_PUBLIC_*`; no retrieval over the private sources | Server-side AI service with retrieval over `pathology-bites-sources` and PathTalk; returns verdicts and citations only |
| 4. One shared checker (schema, answer key, image IDs, copied-wording overlap) | Partial validation per route; no overlap test | A single checker module used by every writer; an overlap index built from the sources |
| 5. Second admin approves before publish, with roles | One admin; self-review; PATCH and bulk can publish | Approver ≠ author enforced in the DB; publish only through the review transition |

---

## 6. Phased plan

Sizes: **S** ≈ 1–2 days, **M** ≈ 1 week, **L** ≈ 2–3 weeks (one developer plus Claude).

### Phase 0 — Close the role hole (S, do first)

> **Done 2026-11-22** (commit `3594718f` + migration `sync_user_role_to_app_metadata`): role mirrored from `public.users` into `app_metadata` by trigger (all accounts backfilled); middleware trusts only `app_metadata.role`, strips client identity headers on every path and gates `/api/admin/*`; `/version` route guarded; login no longer writes the role into `user_metadata`; `tests/middleware.test.ts` added. The `NEXT_PUBLIC_*` AI keys were moved to server-only names separately (`e4d4745f`); production bundles were scanned and contain no keys.
- Take the role from `public.users` on the server (or a server-set `app_metadata.role`, populated for all accounts), never from `user_metadata`.
- In middleware, always delete incoming `x-user-role` / `x-user-id` headers before setting them; gate `/api/admin/*` by role in middleware too.
- Give `/{id}/version` a role check (or remove it).
- Move the `NEXT_PUBLIC_*` AI keys to server-only variables and rotate them.
- Check the logs for any account that changed its own role.

### Phase 1 — Single write path (L)
- **QuestionService** on the server: `createDraft`, `update`, `transition(submit | approve | reject | archive | restore)`, `delete → archive`. One module, used by every route.
- **One API surface:** `POST /api/questions`, `PATCH /api/questions/{id}`, `POST /api/questions/{id}/transitions`. The existing admin routes become thin wrappers or are removed; bulk actions loop over the same service.
- **Atomic writes in Postgres:** a `SECURITY DEFINER` function `save_question(payload jsonb, actor uuid, summary text)` writes the question, options, images and tags and its version row in one transaction.
- **Batch and AI identities:** service accounts (role `bot`, distinct per source such as "claude-batch") with scoped API tokens, so Claude batches call the API instead of `execute_sql`. Rewrite the qwriter skill to post to the API (or wrap the API in a small MCP tool).
- **Revoke direct writes:** drop user insert/update on question tables in RLS; remove the browser inserts (tags, sets) and the unused `createQuestion`; stop using the service-role client for question writes outside `save_question`.

### Phase 2 — Versioning as the only change path (M)
- **Full snapshot:** all question fields, options *with explanations*, images, tags, category, set, status, reviewer.
- **Every save is a version** (create = 1.0.0), stored with author, time and summary; diffs computed on read between consecutive snapshots.
- **Restore** = save a new version whose content is an old snapshot.
- **Enforcement:** a trigger rejects any change to question content that doesn't come from `save_question` (session flag set inside the function).
- **Keep history:** delete becomes archive; change `handle_deleted_question` so it never deletes versions.
- **Backfill:** one initial version for the 559 unversioned questions; fix or drop `create_question_version_simplified`.

### Phase 3 — Shared checker (M)
- One module (Zod schema plus rules), run on every save and callable on its own:
  - schema and required fields; exactly 5 options; exactly one correct; explanations present;
  - image IDs exist and sections are valid; category, set and tags exist;
  - **copied-wording overlap:** shingle/MinHash index built server-side from `pathology-bites-sources` (ExpertPath, PathPrimer) plus PathologyOutlines and WHO; returns a score, the source name and the length of the longest matching run, never the source text.
- Errors block a save; warnings are attached to the version for the reviewer.
- Run it once over all 630 questions to set a baseline (the answer-key and wording problems become a review queue).

### Phase 4 — Server-side AI: draft and "check this question" (L)
- Endpoints `POST /api/ai/questions/draft` and `POST /api/ai/questions/{id}/check`, server only.
- Retrieval over WHO and PathologyOutlines (PathTalk) and a private index of ExpertPath/PathPrimer built from `pathology-bites-sources` (pgvector or Cloudflare Vectorize). Source passages stay on the server; the response is claims with verdicts (supported / contradicted / unclear) and citations.
- Drafts are saved as `draft` through `save_question` under an AI service identity, with the model and prompt version recorded, and always pass the checker.
- Cost and rate limits per admin.

### Phase 5 — Second-admin approval and roles (M)
- **Roles:** admin, editor (writes and submits), reviewer (approves), bot (service accounts).
- **Rule:** a question can reach `published` only through an approve transition by a user other than the author of the version being published; enforced in the database, not just the UI.
- Remove publish from PATCH and from bulk; bulk approve loops over the transition with one review row each.
- **Legacy:** decide what to do with the 397 self-reviewed questions (keep as "legacy published" or queue them for re-review).
- A break-glass path for the single-admin period, logged.

**Order and overlap:** 0 → 1 → 2 must be sequential (each depends on the previous). Phase 3 can start alongside Phase 2. Phase 4 needs 1 and 3. Phase 5 needs 1 and 2. Rough total: 7–10 weeks of focused work.

## 7. Decisions for Juan

1. How Claude batches authenticate after Phase 1: an API token used from the skill, or a small MCP tool that wraps the API?
2. Should delete become archive everywhere (recommended), or stay as a hard delete for drafts only?
3. Copied-wording threshold: what overlap counts as too close, and is it blocking or a warning?
4. Is using the licensed ExpertPath/PathPrimer data for automated fact-checking allowed under those subscriptions?
5. The 397 self-reviewed published questions: keep as legacy, or re-review once a second admin exists?
6. Until a second admin exists, may the single admin publish with a logged override?
