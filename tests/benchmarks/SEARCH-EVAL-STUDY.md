# Virtual-Slide Search — Algorithm Audit & A/B Study

**Date:** 2026-05-22
**Branch:** `fix/virtual-slide-search-p0`
**Commits:** `9c766bc` (baseline / extraction) → `bd3a2e9` (P0 fixes) → `6f97e14` (organ-terms fix)
**Subject:** `src/shared/utils/domain/virtual-slide-search.ts`, `src/shared/utils/domain/organ-terms.ts`

---

## 1. Summary

An audit of the virtual-slide search algorithm identified two priority-zero (P0)
defects. Both were fixed and the change was measured A/B against a labeled query
set run through the *real* production ranking code.

| Metric | Baseline | Final | Δ |
|---|---|---|---|
| hit@10 | 83.3% | 98.0% | +14.7 |
| hit@20 | 83.3% | 99.0% | +15.7 |
| MRR | 0.809 | 0.957 | +0.148 |
| zero-result rate | 13.7% | 0.0% | −13.7 |

102 labeled queries, 27,980-slide live dataset. **16 queries gained, 0 regressed.**

---

## 2. Background — the two P0 bugs

A read-through audit of the search algorithm (then embedded in the
`use-client-virtual-slides` React hook) found two structural defects
that silently destroyed recall:

**P0 #1 — organ terms nuked results.** `rankSlidesWithExpansion` extracted
anatomical terms ("kidney", "liver") to use as a ranking *boost*, but still sent
the **full** query to the matcher. The multi-word matcher requires every query
word to appear as a literal diagnosis token, so `"kidney carcinoma"` missed
every *"Renal cell carcinoma"* — the diagnosis text says "renal", not "kidney".
The organ boost only ever multiplied slides that had already matched textually,
so the feature was effectively dead.

**P0 #2 — one unmatched word zeroed a whole multi-word query.**
`rankSlidesByTerm` returned an empty result the moment **any** query word had no
exact token in the index. A single truncation or typo therefore wiped the entire
query: `"papillary thyroid carcinom"` (truncated) returned **zero results**.

---

## 3. Methodology

The study was designed so the only variable between measurements is the
algorithm itself.

### 3.1 Test fidelity — code extraction

The ranking algorithm lived inside a React hook and could not be exercised
outside a browser. It was extracted **verbatim** into a pure module,
`src/shared/utils/domain/virtual-slide-search.ts` (commit `9c766bc`, no
behavior change). The production hook and the offline eval harness both import
this one module — there is no second copy of the algorithm that can drift, so
the eval always measures exactly what ships.

### 3.2 Dataset

The live production dataset: `virtual-slides-v8-min.json.br` from R2 —
**27,980 slides, 13,372 distinct diagnoses**, 16 organ-system categories. The
harness downloads and caches it on first run.

### 3.3 Query set — 102 labeled queries

A hybrid set: every query is grounded in diagnoses verified to exist in the
dataset.

- **54 curated queries** (`search-queries.json`), hand-built to cover both
  normal behavior and the bug-prone cases:

  | type | n | purpose |
  |---|---|---|
  | exact | 10 | full diagnosis string — control |
  | single-word | 6 | one-token queries |
  | multi-literal | 6 | multi-word, all tokens literally present — control |
  | who-abbrev | 6 | WHO Classification abbreviations (dlbcl, rcc, idc…) |
  | organ-only | 4 | a bare organ word |
  | **organ-tumor** | 8 | organ word + tumor word — **targets P0 #1** |
  | **truncation** | 8 | last word cut short — **targets P0 #2** |
  | **typo** | 6 | a misspelled word — **targets P0 #2** |

- **48 auto-sampled queries** — 3 real diagnoses per category (deterministic
  seed), query = the diagnosis verbatim. These are a **regression guard**: both
  algorithms must score ~100% on them; a drop signals the fix broke normal
  search.

### 3.4 Metrics

A query *hits* at rank *r* if the *r*-th ranked result satisfies the query's
match spec (exact diagnosis equality, substring, or subcategory).

- **hit@10 / hit@20** — fraction of queries whose target appears in the top 10 / 20.
- **MRR** — mean reciprocal rank (1/rank of first hit; 0 if not found). Captures
  *how high* the target ranks, not just whether it is found.
- **zero-result rate** — fraction of queries returning no results at all.

### 3.5 Harness

`tests/benchmarks/search-eval.ts` — a standalone script (`npm run eval:search`). It
builds the search index, runs all 102 queries through `rankSlidesWithExpansion`,
computes metrics per query-type, and prints an A/B against the committed
baseline with a list of every query that flipped (gained / lost). See §8 for
how it is wired into ongoing testing.

---

## 4. Results

### 4.1 Per-type — baseline → final

| query type | n | hit@10 | hit@20 | MRR |
|---|---|---|---|---|
| auto (regression guard) | 48 | 100% → 100% | 100% → 100% | 1.000 → 1.000 |
| exact | 10 | 100% → 100% | 100% → 100% | 1.000 → 1.000 |
| multi-literal | 6 | 100% → 100% | 100% → 100% | 1.000 → 1.000 |
| single-word | 6 | 100% → 100% | 100% → 100% | 1.000 → 1.000 |
| who-abbrev | 6 | 100% → 100% | 100% → 100% | 1.000 → 1.000 |
| organ-only | 4 | 100% → 100% | 100% → 100% | 1.000 → 1.000 |
| **organ-tumor** | 8 | 62.5% → 75.0% | 62.5% → **87.5%** | 0.309 → **0.458** |
| **truncation** | 8 | 0% → **100%** | 0% → **100%** | 0.000 → **1.000** |
| **typo** | 6 | 0% → **100%** | 0% → **100%** | 0.000 → **1.000** |
| **OVERALL** | **102** | **83.3% → 98.0%** | **83.3% → 99.0%** | **0.809 → 0.957** |

zero-result rate: **13.7% → 0.0%**.

### 4.2 Interpretation

- The baseline failures concentrate **exactly** on the two predicted bugs:
  `truncation` and `typo` at 0% (every query returned zero results),
  `organ-tumor` at 62.5%. Every other category was already at 100% — confirming
  the bugs are localized, not systemic.
- `truncation` and `typo` went **0% → 100%**. 14 queries that returned literally
  nothing now return the right slide, 13 of them at rank 1.
- `organ-tumor` went 62.5% → 87.5% hit@20, and its MRR more than doubled
  (0.309 → 0.458) — `"kidney carcinoma"` moved from rank 11 to rank 2.
- The 48 regression-guard queries held at 100% / MRR 1.000 — normal search was
  not damaged.

---

## 5. The fixes

### 5.1 P0 #2 — additive prefix matching (`bd3a2e9`)

In the multi-word matcher, each query word is now also **prefix-matched** (its
first 3 characters) against the index, *in addition to* exact matching. A
truncated word like `"carcinom"` resolves via the `car` prefix to `"carcinoma"`.

This had to be **additive**, not a fallback gated on "no exact match found": the
truncation `"sarcom"` happens to collide with a single junk token in the data,
so an empty-set–gated fallback skipped prefix expansion and collapsed
`"clear cell sarcom"` to that one non-matching slide. A word that still matches
nothing is now **dropped** from the intersection rather than zeroing the whole
query.

### 5.2 P0 #1 — two-pass ranking with max-merge (`bd3a2e9`)

`rankSlidesWithExpansion` now ranks in two passes:

1. **Always** rank the full query — this preserves exact-diagnosis and literal
   multi-word matches even when the query contains an organ word.
2. When an organ term is present, **additionally** rank with the organ words
   removed (`"kidney carcinoma"` → search `"carcinoma"`, boosted by the kidney
   organ context) — or, if nothing else remains, rank the whole organ system.

The two passes are merged by **max score per slide**, so pass 2 can only *add*
recall — it can never demote a pass-1 match. (A first single-pass attempt that
*replaced* the query with the organ-stripped version scored +10.8 overall but
introduced 4 regressions — see §6.)

### 5.3 organ-terms subcategory alignment (`6f97e14`)

`getOrganBoostScore` compares an organ's `subcategory` against a slide's
subcategory, but `ORGAN_TERMS` used invented strings (`"kidney and urinary
tract"`, `"central nervous system"`) that never matched the dataset's real
values (`"Kidney"`, `"Brain"`). The strong 2.5× exact-subcategory boost never
fired; organ queries fell back to the weak 1.75× whole-category boost.

Every `subcategory` was set to its real dataset value. This lifted organ-tumor
MRR from 0.307 to 0.458 (`"kidney carcinoma"` rank 11 → 2). The bogus
`"cholangiocarcinoma"` alias on `"bile duct"` — a diagnosis name, not an
anatomical term — was also removed.

---

## 6. What the harness caught

Measurement caught two defects that would otherwise have shipped silently:

- The **first P0 #1 fix** scored +10.8% overall but the A/B's flipped-query list
  showed **4 regressions** — `"renal cell carcinoma"` fell from rank 1 to 57,
  because stripping the organ word destroyed exact diagnoses that *contain* an
  organ word. The two-pass max-merge design (§5.2) was the response.
- After the first P0 #2 fix, `truncation` was at 87.5% — the harness flagged
  `"clear cell sarcom"` still returning **zero results**. Root cause: a
  truncation colliding with a rare junk token. This led to the additive-prefix
  design (§5.1).

Without an eval, both would have looked like wins.

---

## 7. Residual finding (not fixed — not a P0)

`organ-tumor` finishes at 87.5%, not 100%. The one miss is `"breast carcinoma"`
→ *"Invasive ductal carcinoma"* at rank 39. Cause: the score model gives a
phrase match 90 points and a word match 80, so literal `"…breast carcinoma"`
diagnoses out-rank IDC regardless of organ boost. This is score-model tuning,
not a structural bug — the query still returns breast carcinomas, just not IDC
inside the top 20. Logged as a follow-up.

---

## 8. Ongoing testing

The study became two permanent, complementary mechanisms.

### 8.1 Behavior test — runs every `npm test`

`tests/shared/utils/domain/virtual-slide-search.test.ts` — a Vitest suite over a
small synthetic in-repo fixture. Deterministic, offline, <50 ms. It asserts the
algorithm's *mechanisms* (truncated query finds its slide, organ+alias resolves,
exact match still ranks first, …). Reverting either P0 fix turns a test red.
This is the per-compile guard — it answers *"is search broken?"*

### 8.2 Regression benchmark — run on search / dataset changes

`tests/benchmarks/search-eval.ts` — runs the 102-query set against the **current**
live dataset and compares to a committed baseline. It answers *"did this change
make search worse?"*

```bash
npm run eval:search                      # run, compare to baseline, exit 1 on regression
npm run eval:search -- --update-baseline # re-snapshot the baseline after an accepted change
```

Run it whenever the ranking algorithm changes or the dataset version is bumped
in `src/shared/config/virtual-slides.ts` (the harness reads the dataset URL from
there). A run **fails** (exit 1) if overall hit@20 drops, the zero-result rate
rises, or any query-type drops more than 2 points — suitable for a CI job gated
on changes to the search files.

Files under `tests/benchmarks/` (tracked):

- `search-eval.ts` — the benchmark harness
- `search-queries.json` — the 54 curated labeled queries
- `baseline-metrics.json` — the committed bar; updating it (a commit) records a
  new accepted baseline
- `.cache/` — cached dataset (gitignored)

The dataset is fetched from the live R2 URL and cached; it is re-fetched
automatically when the configured URL changes.
