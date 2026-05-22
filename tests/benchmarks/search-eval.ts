// Virtual-slide search — regression benchmark.
//
// The "did this update downgrade search?" gate. Runs a 102-query labeled set
// through the REAL ranking algorithm (src/shared/utils/domain/virtual-slide-search.ts)
// against the CURRENT production dataset, and compares the result to a committed
// baseline (baseline-metrics.json).
//
//   npm run eval:search                       run, compare to baseline, exit 1 on regression
//   npm run eval:search -- --update-baseline   re-snapshot the baseline (then commit it)
//
// Run this whenever you change the ranking algorithm OR bump the dataset
// version. The dataset URL is read from src/shared/config/virtual-slides.ts,
// so a version bump there is picked up automatically.
//
// This is NOT a unit test — it needs the network and is non-deterministic as
// the dataset evolves. The per-compile CI guard is
// tests/shared/utils/domain/virtual-slide-search.test.ts.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { brotliDecompressSync } from "zlib";
import {
  buildSearchIndex,
  rankSlidesWithExpansion,
} from "../../src/shared/utils/domain/virtual-slide-search";
import { VIRTUAL_SLIDES_JSON_URL } from "../../src/shared/config/virtual-slides";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, ".cache");
const DATASET_CACHE = join(CACHE_DIR, "dataset.json");
const URL_MARKER = join(CACHE_DIR, "dataset.url");
const BASELINE = join(HERE, "baseline-metrics.json");
const QUERIES = join(HERE, "search-queries.json");

const updateBaseline = process.argv.includes("--update-baseline");
const AUTO_PER_CATEGORY = 3;
const AUTO_SEED = 20260522; // fixed seed -> auto query sampling is reproducible

// Regression tolerances. A run FAILS the gate if any is breached.
const TOL = {
  overallHit20Drop: 0.0, // overall hit@20 may not drop at all
  zeroResultRise: 0.0, // zero-result rate may not rise at all
  perTypeHit20Drop: 0.02, // any single query-type may not drop > 2 points
};

// ---------------------------------------------------------------------------
// Dataset load — cached, re-fetched when the config URL changes
// ---------------------------------------------------------------------------
async function loadDataset() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const cachedUrl = existsSync(URL_MARKER) ? readFileSync(URL_MARKER, "utf8") : "";
  if (existsSync(DATASET_CACHE) && cachedUrl === VIRTUAL_SLIDES_JSON_URL) {
    return JSON.parse(readFileSync(DATASET_CACHE, "utf8"));
  }
  console.log(`fetching dataset: ${VIRTUAL_SLIDES_JSON_URL}`);
  const res = await fetch(VIRTUAL_SLIDES_JSON_URL);
  if (!res.ok) throw new Error(`dataset fetch failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  let text: string;
  try {
    text = brotliDecompressSync(buf).toString("utf8");
  } catch {
    text = buf.toString("utf8");
  }
  const json = JSON.parse(text);
  writeFileSync(DATASET_CACHE, JSON.stringify(json));
  writeFileSync(URL_MARKER, VIRTUAL_SLIDES_JSON_URL);
  return json;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Match = { equals?: string; contains?: string; subcategory?: string };
function satisfies(slide: { diagnosis?: string; subcategory?: string }, match: Match): boolean {
  const d = (slide.diagnosis || "").toLowerCase().trim();
  if (match.equals != null) return d === match.equals.toLowerCase().trim();
  if (match.contains != null) return d.includes(match.contains.toLowerCase().trim());
  if (match.subcategory != null)
    return (
      (slide.subcategory || "").toLowerCase().trim() === match.subcategory.toLowerCase().trim()
    );
  return false;
}

type QueryRow = {
  id: string;
  type: string;
  query: string;
  rank: number;
  resultCount: number;
  top: string | null;
};
type Agg = { n: number; hit10: number; hit20: number; mrr: number; zero: number; found: number };
type Metrics = {
  meta: { dateRun: string; datasetUrl: string; slideCount: number; queryCount: number };
  overall: Agg;
  byType: Record<string, Agg>;
  perQuery: QueryRow[];
};

function agg(rows: QueryRow[]): Agg {
  const n = rows.length;
  if (n === 0) return { n: 0, hit10: 0, hit20: 0, mrr: 0, zero: 0, found: 0 };
  let hit10 = 0,
    hit20 = 0,
    mrrSum = 0,
    zero = 0,
    found = 0;
  for (const r of rows) {
    if (r.rank > 0 && r.rank <= 10) hit10++;
    if (r.rank > 0 && r.rank <= 20) hit20++;
    if (r.rank > 0) {
      mrrSum += 1 / r.rank;
      found++;
    }
    if (r.resultCount === 0) zero++;
  }
  return {
    n,
    hit10: hit10 / n,
    hit20: hit20 / n,
    mrr: mrrSum / n,
    zero: zero / n,
    found: found / n,
  };
}

const pct = (x: number) => (x * 100).toFixed(1).padStart(6) + "%";
const f3 = (x: number) => x.toFixed(3);

// ---------------------------------------------------------------------------
async function main() {
  const json = await loadDataset();
  const data: Array<{ x: string; d?: string; c?: string; s?: string; q?: string | string[] }> =
    json.data;

  // Minimal slide objects — search reads id/diagnosis/category/subcategory/acronym.
  const slides = data.map((e) => ({
    id: e.x,
    repository: "",
    category: e.c || "",
    subcategory: e.s || "",
    diagnosis: e.d || "",
    acronym: e.q,
    patient_info: "",
    age: null,
    gender: null,
    clinical_history: "",
    stain_type: "",
    preview_image_url: "",
    slide_url: "",
    case_url: "",
    other_urls: [] as string[],
    source_metadata: {},
  }));
  buildSearchIndex(slides);

  // --- query set: curated (committed) + auto-sampled (seeded) ---
  const curated: Array<{ id: string; type: string; query: string; match: Match }> = JSON.parse(
    readFileSync(QUERIES, "utf8")
  ).queries;

  const freq = new Map<string, number>();
  for (const s of slides) {
    const d = s.diagnosis.trim();
    if (d) freq.set(d, (freq.get(d) || 0) + 1);
  }
  const diagsByCat = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const s of slides) {
    const d = s.diagnosis.trim();
    const key = `${s.category}||${d}`;
    if (!d || seen.has(key) || (freq.get(d) || 0) < 3) continue;
    seen.add(key);
    if (!diagsByCat.has(s.category)) diagsByCat.set(s.category, []);
    diagsByCat.get(s.category)!.push(d);
  }
  const rng = mulberry32(AUTO_SEED);
  const auto: Array<{ id: string; type: string; query: string; match: Match }> = [];
  for (const cat of [...diagsByCat.keys()].sort()) {
    for (const d of seededShuffle(diagsByCat.get(cat)!, rng).slice(0, AUTO_PER_CATEGORY)) {
      // id is content-derived so it stays stable across dataset versions
      auto.push({ id: `auto:${d}`, type: "auto", query: d, match: { equals: d } });
    }
  }
  const allQueries = [...curated, ...auto];

  // --- run ---
  const perQuery: QueryRow[] = [];
  for (const q of allQueries) {
    const { slides: results } = await rankSlidesWithExpansion(slides, q.query);
    let rank = 0;
    for (let i = 0; i < results.length; i++) {
      if (satisfies(results[i], q.match)) {
        rank = i + 1;
        break;
      }
    }
    perQuery.push({
      id: q.id,
      type: q.type,
      query: q.query,
      rank,
      resultCount: results.length,
      top: results[0] ? results[0].diagnosis : null,
    });
  }

  const types = [...new Set(allQueries.map((q) => q.type))].sort();
  const byType: Record<string, Agg> = {};
  for (const t of types) byType[t] = agg(perQuery.filter((r) => r.type === t));
  const current: Metrics = {
    meta: {
      dateRun: new Date().toISOString(),
      datasetUrl: VIRTUAL_SLIDES_JSON_URL,
      slideCount: slides.length,
      queryCount: allQueries.length,
    },
    overall: agg(perQuery),
    byType,
    perQuery,
  };

  // --- report current ---
  console.log(`\n=== SEARCH EVAL — ${allQueries.length} queries, ${slides.length} slides ===\n`);
  console.log("type             n   hit@10  hit@20    MRR   zero-result");
  console.log("─".repeat(62));
  for (const t of types) {
    const a = byType[t];
    console.log(
      `${t.padEnd(15)} ${String(a.n).padStart(3)}  ${pct(a.hit10)}  ${pct(a.hit20)}  ${f3(a.mrr)}  ${pct(a.zero)}`
    );
  }
  console.log("─".repeat(62));
  const o = current.overall;
  console.log(
    `${"OVERALL".padEnd(15)} ${String(o.n).padStart(3)}  ${pct(o.hit10)}  ${pct(o.hit20)}  ${f3(o.mrr)}  ${pct(o.zero)}`
  );

  // --- update-baseline mode ---
  if (updateBaseline) {
    writeFileSync(BASELINE, JSON.stringify(current, null, 2));
    console.log(`\n✅ baseline updated -> ${BASELINE}`);
    console.log("   commit this file — it is the bar future runs are checked against.");
    return;
  }

  // --- regression check ---
  if (!existsSync(BASELINE)) {
    console.error(
      `\n❌ no baseline-metrics.json found.\n   Run:  npm run eval:search -- --update-baseline`
    );
    process.exit(1);
  }
  const base: Metrics = JSON.parse(readFileSync(BASELINE, "utf8"));

  console.log(`\n=== A/B vs baseline (${base.meta.dateRun.slice(0, 10)}) ===\n`);
  console.log("type            hit@20            MRR           zero-result");
  console.log("─".repeat(62));
  const dl = (x: number, y: number) => {
    const d = (y - x) * 100;
    return (d >= 0 ? "+" : "") + d.toFixed(1);
  };
  for (const t of types) {
    const b = base.byType[t];
    const c = byType[t];
    if (!b) {
      console.log(`${t.padEnd(14)} (new type — no baseline)`);
      continue;
    }
    console.log(
      `${t.padEnd(14)} ${pct(b.hit20)}->${pct(c.hit20)} (${dl(b.hit20, c.hit20).padStart(6)})  ${f3(b.mrr)}->${f3(c.mrr)}  ${pct(b.zero)}->${pct(c.zero)}`
    );
  }
  console.log("─".repeat(62));
  console.log(
    `${"OVERALL".padEnd(14)} ${pct(base.overall.hit20)}->${pct(o.hit20)} (${dl(base.overall.hit20, o.hit20).padStart(6)})  ${f3(base.overall.mrr)}->${f3(o.mrr)}  ${pct(base.overall.zero)}->${pct(o.zero)}`
  );

  // flipped queries (matched by id; ids absent on either side are skipped)
  const baseById = new Map(base.perQuery.map((r) => [r.id, r]));
  const gained: QueryRow[] = [];
  const lost: QueryRow[] = [];
  for (const r of perQuery) {
    const b = baseById.get(r.id);
    if (!b) continue;
    const bHit = b.rank > 0 && b.rank <= 20;
    const cHit = r.rank > 0 && r.rank <= 20;
    if (!bHit && cHit) gained.push(r);
    if (bHit && !cHit) lost.push(r);
  }
  if (gained.length) {
    console.log(`\nGAINED (miss->hit@20): ${gained.length}`);
    for (const r of gained) console.log(`  + [${r.type}] "${r.query}"  rank ${r.rank}`);
  }
  if (lost.length) {
    console.log(`\nLOST (hit->miss@20): ${lost.length}`);
    for (const r of lost)
      console.log(
        `  - [${r.type}] "${r.query}"  rank ${baseById.get(r.id)!.rank} -> ${r.rank || "none"}`
      );
  }

  // --- verdict ---
  const failures: string[] = [];
  if (o.hit20 < base.overall.hit20 - TOL.overallHit20Drop) {
    failures.push(`overall hit@20 dropped ${dl(base.overall.hit20, o.hit20)} pts`);
  }
  if (o.zero > base.overall.zero + TOL.zeroResultRise) {
    failures.push(`overall zero-result rose ${dl(base.overall.zero, o.zero)} pts`);
  }
  for (const t of types) {
    const b = base.byType[t];
    if (!b) continue;
    if (byType[t].hit20 < b.hit20 - TOL.perTypeHit20Drop) {
      failures.push(`type "${t}" hit@20 dropped ${dl(b.hit20, byType[t].hit20)} pts`);
    }
  }

  console.log();
  if (failures.length) {
    console.error("❌ VERDICT: FAIL — search quality regressed:");
    for (const f of failures) console.error(`   - ${f}`);
    console.error(
      "\n   If this change is an intentional, accepted trade-off, re-baseline:\n" +
        "   npm run eval:search -- --update-baseline"
    );
    process.exit(1);
  }
  console.log("✅ VERDICT: PASS — no search-quality regression.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
