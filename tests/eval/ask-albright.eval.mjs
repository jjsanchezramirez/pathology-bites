#!/usr/bin/env node
/* eslint-disable no-console -- a CLI report: printing is its output */
/**
 * Ask Dr. Albright answer-quality eval. Not part of `npm test` (it calls live
 * PathTalk and Workers AI): run against the local dev server —
 *
 *   node tests/eval/ask-albright.eval.mjs [--base http://localhost:3000] [--out report.json] [--only regex]
 *
 * Needs a dev identity for the private API (DEBUG_USER_ID in .env.local) and
 * uses the dev-only `x-ask-albright-eval: 1` header (fresh answers: no history,
 * cache or rate limit). Each case lists facts the answer MUST contain and claims
 * it must NOT make; a case passes only if all hold. `gap: true` cases have no
 * answer in the corpora and pass when the answer says so honestly.
 *
 * Ground truth is textbook-level (WHO / PathologyOutlines); keep cases to facts
 * that are not in dispute, so a fail means the pipeline, not the key.
 */
import { writeFileSync } from "node:fs";

const NOT_COVERED =
  /(do(es)? not|don't|doesn't) (provide|contain|address|discuss|mention|cover|include|state|say|indicate|specify)|not (stated|covered|mentioned|addressed)|no information/i;

/** @type {{q: string, must: RegExp[], not?: RegExp[], gap?: boolean}[]} */
const CASES = [
  {
    q: "Are MEF2B and J chain useful in distinguishing NLPHL from classic Hodgkin lymphoma?",
    must: [/MEF2B/i, /J[- ]?chain/i, /(positive|express|highlight|sensitiv|useful)/i],
  },
  {
    q: "Is CD117 positive in renal oncocytoma?",
    must: [/(positive|express)/i],
    not: [/(CD117|KIT)[^.]{0,40}negative/i],
  },
  { q: "What is the WHO grade of atypical meningioma?", must: [/grade (2|II)\b/i] },
  {
    q: "Which IHC stains help distinguish epithelioid mesothelioma from lung adenocarcinoma?",
    must: [
      /calretinin/i,
      /(WT-?1|D2-40|podoplanin|CK5)/i,
      /(TTF-?1|napsin|claudin|MOC-?31|Ber-?EP4|CEA)/i,
    ],
  },
  { q: "What fusion defines synovial sarcoma?", must: [/SS18/i, /SSX/i] },
  { q: "What is the characteristic translocation of Ewing sarcoma?", must: [/EWSR1/i, /FLI-?1/i] },
  {
    q: "Besides KIT, which immunostain is most useful for diagnosing GIST?",
    must: [/DOG-?1|ANO1/i],
  },
  { q: "Which immunostain identifies SDH-deficient GIST?", must: [/SDHB/i] },
  {
    q: "What is the immunophenotype of hairy cell leukemia?",
    must: [/CD103|CD11c|CD25/i, /annexin|CD123|TRAP|BRAF/i],
  },
  { q: "What mutation is found in nearly all hairy cell leukemias?", must: [/BRAF/i, /V600E/i] },
  {
    q: "Is CK7 or CD10 better for separating chromophobe RCC from oncocytoma?",
    must: [/CK7/i, /(diffuse|positive|\b8\d\s?%|better)/i],
  },
  { q: "What does INSM1 immunostaining indicate?", must: [/neuroendocrine/i] },
  {
    q: "Is p16 a surrogate marker for HPV in oropharyngeal squamous cell carcinoma?",
    must: [/p16/i, /HPV/i, /(surrogate|diffuse|block|strong)/i],
  },
  {
    q: "What is the immunoprofile of solid pseudopapillary neoplasm of the pancreas?",
    must: [/(beta|β)[- ]?catenin/i, /nuclear/i],
  },
  {
    q: "What fusion characterizes secretory carcinoma of the salivary gland?",
    must: [/ETV6/i, /NTRK3/i],
  },
  {
    q: "Which protein is lost in epithelioid sarcoma and rhabdoid tumors?",
    must: [/INI-?1|SMARCB1/i],
  },
  { q: "How is PRAME used in melanocytic lesions?", must: [/melanoma/i, /(nev|benign)/i] },
  {
    q: "Which immunostains are positive in clear cell RCC but not chromophobe RCC?",
    must: [/CAIX|CA-?IX|carbonic anhydrase|vimentin|CD10/i],
  },
  {
    q: "What defines high-grade B-cell lymphoma with MYC and BCL2 rearrangements?",
    must: [/MYC/i, /BCL2/i, /(rearrange|translocation)/i],
  },
  // Harder: specifics, negatives and claims a weak answer gets backwards.
  {
    q: "Is MEF2B expressed in primary mediastinal large B-cell lymphoma?",
    must: [/(positive|express)/i],
    not: [/MEF2B[^.]{0,40}(not expressed|negative)/i],
  },
  {
    q: "Is J chain expressed by Hodgkin/Reed-Sternberg cells of classic Hodgkin lymphoma?",
    must: [/(negative|not expressed|absent|lack)/i],
  },
  {
    q: "What proportion of NLPHL cases express IgD?",
    must: [/(27|one[- ]third|a third|about a third|~?30)\s*%?/i],
  },
  {
    q: "Is calretinin as reliable in sarcomatoid mesothelioma as in epithelioid mesothelioma?",
    must: [/(less|lower|reduced|variable|fewer|subset|focal|weak)/i],
  },
  { q: "What mitotic count defines atypical (grade 2) meningioma?", must: [/(\b4\b|2\.5)/] },
  { q: "What mitotic count defines anaplastic (grade 3) meningioma?", must: [/(\b20\b|12\.5)/] },
  {
    q: "Is STAT6 nuclear staining useful for solitary fibrous tumor?",
    must: [/nuclear/i, /(positiv|express|sensitiv|specific)/i],
  },
  {
    q: "Does TTF-1 stain malignant mesothelioma?",
    must: [/(negative|not|absent|lack)/i],
    not: [/TTF-?1[^.]{0,30}(is|are) positive in (malignant )?mesothelioma/i],
  },
  {
    q: "Is SOX10 positive in desmoplastic melanoma?",
    must: [/(positive|express)/i],
    not: [/SOX10[^.]{0,30}negative in desmoplastic/i],
  },
  {
    q: "Is CD117 positive in chromophobe RCC and in oncocytoma?",
    must: [/chromophobe/i, /oncocytoma/i],
    not: [
      /(CD117|KIT)[^.]{0,60}negative[^.]{0,30}oncocytoma/i,
      /oncocytoma[^.]{0,40}(CD117|KIT)[^.]{0,20}negative/i,
    ],
  },
  // Scope: a three-way IHC table is a normal question (it was declined as
  // "too broad" under a 3-diagnosis rule); a whole field or off-topic is not.
  {
    q: "CHL vs NLPHL vs PBML IHC table",
    must: [/\|/, /CD30/i, /CD15|CD20|OCT-?2|BOB-?1|PAX5|MEF2B/i],
    not: [/covers a lot/i],
  },
  { q: "Explain all of soft tissue pathology", must: [/covers a lot/i] },
  { q: "What's a good recipe for banana bread?", must: [/only help with pathology/i] },
  // PathologyOutlines: "TRPS1 (positive in 86% of triple negative and metaplastic carcinomas)".
  // A run once answered "2%" (the adjacent GATA3 mutation rate) — keep that out.
  {
    q: "Is TRPS1 sensitive for triple-negative breast carcinoma?",
    must: [/\b86\s?%/],
    not: [/\b2\s?%/, /not (a )?sensitive/i],
  },
];

// Owner QA, 2026-11-25: "Hans algorithm" was declined as off-topic; the
// DLBCL version invented the GCB branches and borrowed a machine-learning
// classifier's "~92%" accuracy. Only what the sources state, no stray figure.
CASES.push(
  {
    q: "Hans algorithm",
    must: [/CD10/i, /MUM1|IRF4/i],
    not: [/only help with pathology/i],
  },
  {
    q: "Hans algorithm for DLBCL",
    must: [/CD10/i, /BCL6/i, /MUM1|IRF4/i],
    not: [/92\s?%/, /CD10\+\s*\/\s*BCL6[+-]\s*\/\s*MUM1-/i],
  }
);

const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3000";
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
/** --only <regex>: run the matching cases only (quick iteration). */
const only = args.includes("--only") ? new RegExp(args[args.indexOf("--only") + 1], "i") : null;

/**
 * Streams the answer (NDJSON), as the launcher does: `first` is when text
 * first appears — the launch target (≤3 s most, ≤10 s hard) — and `ms` when
 * the answer is complete.
 */
async function run(c) {
  const t0 = Date.now();
  let first = 0;
  let d = {};
  let status = 0;
  let ok = false;
  try {
    const res = await fetch(`${base}/api/user/ask-albright`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
        "x-ask-albright-eval": "1",
      },
      // A stuck request fails the case instead of stalling the whole run.
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ question: c.q }),
    });
    status = res.status;
    ok = res.ok;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const ev = JSON.parse(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
        if (ev.type === "delta" && !first) first = Date.now() - t0;
        if (ev.type === "done") d = ev;
        if (ev.type === "error") {
          ok = false;
          status = ev.status;
        }
      }
    }
  } catch (err) {
    status = `error: ${err.message}`;
  }
  const ms = Date.now() - t0;
  // Declined questions have no stream of text: the reply is the first text.
  if (!first) first = ms;
  const res = { ok, status };
  const answer = d.answer ?? "";
  const notCovered = NOT_COVERED.test(answer);
  const missing = c.must.filter((re) => !re.test(answer)).map(String);
  const wrong = (c.not ?? []).filter((re) => re.test(answer)).map(String);
  const pass = res.ok && (c.gap ? notCovered : missing.length === 0 && wrong.length === 0);
  return {
    q: c.q,
    pass,
    status: res.status,
    ms,
    tokens: d.tokens ?? 0,
    first,
    cost: d.costUsd ?? 0,
    format: d.format ?? d.scope ?? "-",
    timings: d.timings ?? null,
    notCovered,
    missing,
    wrong,
    answer,
    citations: (d.citations ?? []).map((x) => x.href),
  };
}

/** "p800 s1200x1 k300 f2100" — plan, search (count), knowledge base, first token ms (server). */
const stages = (t) =>
  t
    ? `p${t.plan} s${t.search}x${t.searches} k${t.profile} f${t.firstToken}`.padEnd(30)
    : "".padEnd(30);

const results = [];
// One at a time: measures what a single user sees, and PathTalk handles
// searches roughly serially, so parallel cases would just queue.
for (const c of CASES) if (!only || only.test(c.q)) results.push(await run(c));
const passed = results.filter((r) => r.pass).length;
const avg = (k) => Math.round(results.reduce((s, r) => s + r[k], 0) / results.length);
for (const r of results) {
  console.log(
    `${r.pass ? "PASS" : "FAIL"} first ${String(r.first).padStart(5)}ms  done ${String(r.ms).padStart(5)}ms  ${(r.cost * 100).toFixed(3)}¢  ${r.format.padEnd(9)} ${stages(r.timings)}  ${r.q}`
  );
  if (!r.pass)
    console.log(
      `      missing=${JSON.stringify(r.missing)} wrong=${JSON.stringify(r.wrong)} notCovered=${r.notCovered} status=${r.status}\n      ${r.answer.slice(0, 220).replace(/\n/g, " ")}`
    );
}
const sorted = results.map((r) => r.first).sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
const maxCost = Math.max(...results.map((r) => r.cost));
console.log(
  `\nSCORE ${passed}/${results.length}  first-text p50 ${pct(0.5)}ms p80 ${pct(0.8)}ms max ${sorted[sorted.length - 1]}ms  ` +
    `≤3s ${results.filter((r) => r.first <= 3000).length}/${results.length}  done avg ${avg("ms")}ms  ` +
    `cost avg ${((results.reduce((s, r) => s + r.cost, 0) / results.length) * 100).toFixed(3)}¢ max ${(maxCost * 100).toFixed(3)}¢`
);
if (out) writeFileSync(out, JSON.stringify({ passed, total: results.length, results }, null, 2));
