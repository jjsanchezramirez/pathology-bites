/**
 * Scoring guide: how HER2 and PD-L1 are scored and which cut-offs apply,
 * served by Dr. Albright with no model call (like the site guide).
 *
 * Why curated: the knowledge base stores per-tumour findings ("HER2-negative",
 * "PD-L1 commonly expressed"), never scoring rules — of 74 HER2/PD-L1 rows
 * only one carried a score — and PathTalk does not index PathologyOutlines'
 * stain pages, so "PD-L1 22C3 cut-offs by tumour type" came back as a single
 * TNBC line. The rules are few, stable in form, and must be exact.
 *
 * Every number below was checked against its cited source (PubMed abstract or
 * the PathologyOutlines page) on 2026-11-26. Two things the abstracts do not
 * state are marked † in the table and listed in REVIEW: which assay each
 * pembrolizumab / nivolumab trial used. Cut-offs follow drug approvals, which
 * change and differ by country, so the table says "pivotal trial cut-off" and
 * carries AS_OF — it is a teaching table, not a label.
 */
import { normalizeQuestion } from "./router";

export const SCORING_AS_OF = "November 2026";

export interface ScoringSource {
  title: string;
  href: string;
  sourceLabel: "PubMed" | "PathOutlines";
}

export interface ScoringEntry {
  id: string;
  title: string;
  /** How a user would ask for it: offered as a follow-up from other entries. */
  ask: string;
  /** Markdown; cites [n] against `sources` in order. */
  answer: string;
  sources: ScoringSource[];
  related: string[];
}

const doi = (d: string) => `https://doi.org/${d}`;

const SRC = {
  ascoCap2018: {
    title: "HER2 testing in breast cancer: ASCO/CAP guideline focused update (J Clin Oncol 2018)",
    href: doi("10.1200/JCO.2018.77.8738"),
    sourceLabel: "PubMed",
  },
  ascoCap2023: {
    title: "HER2 testing in breast cancer: ASCO–CAP guideline update (J Clin Oncol 2023)",
    href: doi("10.1200/JCO.22.02864"),
    sourceLabel: "PubMed",
  },
  poHer2Breast: {
    title: "HER2 breast",
    href: "https://www.pathologyoutlines.com/topic/stainsbreasther2.html",
    sourceLabel: "PathOutlines",
  },
  poHer2Low: {
    title: "HER2 low breast cancer",
    href: "https://www.pathologyoutlines.com/topic/breastHER2lowbreastcancer.html",
    sourceLabel: "PathOutlines",
  },
  db04: {
    title: "Trastuzumab deruxtecan in HER2-low breast cancer, DESTINY-Breast04 (N Engl J Med 2022)",
    href: doi("10.1056/NEJMoa2203690"),
    sourceLabel: "PubMed",
  },
  capGea2017: {
    title:
      "HER2 testing in gastroesophageal adenocarcinoma: CAP/ASCP/ASCO guideline (J Clin Oncol 2017)",
    href: doi("10.1200/JCO.2016.69.4836"),
    sourceLabel: "PubMed",
  },
  poHer2Gi: {
    title: "HER2 stomach GEJ",
    href: "https://www.pathologyoutlines.com/topic/stainsher2GI.html",
    sourceLabel: "PathOutlines",
  },
  poTrastuzumab: {
    title: "trastuzumab",
    href: "https://www.pathologyoutlines.com/topic/breastherceptin.html",
    sourceLabel: "PathOutlines",
  },
  kn826: {
    title: "Pembrolizumab in cervical cancer, KEYNOTE-826 (N Engl J Med 2021)",
    href: doi("10.1056/NEJMoa2112435"),
    sourceLabel: "PubMed",
  },
  erber2020: {
    title: "Understanding PD-L1 testing in breast cancer (Breast Care 2020)",
    href: doi("10.1159/000510812"),
    sourceLabel: "PubMed",
  },
  kn024: {
    title: "Pembrolizumab vs chemotherapy in PD-L1-positive NSCLC, KEYNOTE-024 (N Engl J Med 2016)",
    href: doi("10.1056/NEJMoa1606774"),
    sourceLabel: "PubMed",
  },
  kn042: {
    title: "Pembrolizumab vs chemotherapy in PD-L1-expressing NSCLC, KEYNOTE-042 (Lancet 2019)",
    href: doi("10.1016/S0140-6736(18)32409-7"),
    sourceLabel: "PubMed",
  },
  imp010: {
    title: "Adjuvant atezolizumab in resected NSCLC, IMpower010 (Lancet 2021)",
    href: doi("10.1016/S0140-6736(21)02098-5"),
    sourceLabel: "PubMed",
  },
  kn048: {
    title: "Pembrolizumab in head and neck SCC, KEYNOTE-048 (Lancet 2019)",
    href: doi("10.1016/S0140-6736(19)32591-7"),
    sourceLabel: "PubMed",
  },
  kn355: {
    title: "Pembrolizumab + chemotherapy in TNBC, KEYNOTE-355 (Lancet 2020)",
    href: doi("10.1016/S0140-6736(20)32531-9"),
    sourceLabel: "PubMed",
  },
  badve2022: {
    title: "Determining PD-L1 status in TNBC: lessons from IMpassion130 (J Natl Cancer Inst 2022)",
    href: doi("10.1093/jnci/djab121"),
    sourceLabel: "PubMed",
  },
  kn590: {
    title: "Pembrolizumab + chemotherapy in oesophageal cancer, KEYNOTE-590 (Lancet 2021)",
    href: doi("10.1016/S0140-6736(21)01234-4"),
    sourceLabel: "PubMed",
  },
  kn859: {
    title:
      "Pembrolizumab + chemotherapy in HER2-negative gastric cancer, KEYNOTE-859 (Lancet Oncol 2023)",
    href: doi("10.1016/S1470-2045(23)00515-6"),
    sourceLabel: "PubMed",
  },
  cm649: {
    title:
      "Nivolumab + chemotherapy in gastric/GEJ/oesophageal adenocarcinoma, CheckMate 649 (Lancet 2021)",
    href: doi("10.1016/S0140-6736(21)00797-2"),
    sourceLabel: "PubMed",
  },
} satisfies Record<string, ScoringSource>;

export const SCORING_GUIDE: ScoringEntry[] = [
  {
    id: "her2-breast",
    title: "HER2 IHC scoring in breast cancer",
    ask: "How is HER2 IHC scored in breast cancer?",
    answer:
      "Score **membranous** staining of **invasive** tumour cells only; in situ carcinoma and cytoplasmic staining are ignored [3].\n- **3+ (positive):** complete, intense circumferential membrane staining in > 10% of tumour cells [3].\n- **2+ (equivocal):** weak to moderate complete membrane staining in > 10% of tumour cells [1]; also intense circumferential staining in ≤ 10%, or moderate–intense incomplete (basolateral) staining, as in micropapillary carcinoma [3]. Reflex to ISH.\n- **1+ (negative):** incomplete, faint membrane staining in > 10% of tumour cells [3].\n- **0 (negative):** no staining, or incomplete faint / barely perceptible staining in ≤ 10% [3].\n- **ISH (dual probe):** positive when HER2/CEP17 ≥ 2.0 with an average HER2 copy number ≥ 4.0 signals/cell; the uncommon groups 2–4 need the guideline's work-up [1, 3].\nThe 2023 update keeps these categories and stresses separating 0 from 1+ carefully, because 1+ now matters for trastuzumab deruxtecan [2].",
    sources: [SRC.ascoCap2018, SRC.ascoCap2023, SRC.poHer2Breast],
    related: ["her2-low", "her2-gastric"],
  },
  {
    id: "her2-low",
    title: "HER2-low breast cancer",
    ask: "What is HER2-low?",
    answer:
      '**HER2-low** = IHC **1+**, or IHC **2+ with ISH not amplified** — the entry criterion of DESTINY-Breast04, which made these patients eligible for trastuzumab deruxtecan [3].\n- In the report it is still **HER2-negative**: ASCO/CAP 2023 calls new categories such as "HER2-low" or "HER2-ultralow" premature, and instead adds a comment highlighting the IHC 0 vs 1+ result [1].\n- Distinguishing **0 from 1+** is therefore the critical call: 0 is no staining or faint incomplete staining in ≤ 10% of cells; 1+ is faint incomplete staining in > 10% [2].\n- No distinct prognostic behaviour of HER2-low has been established [2].',
    sources: [SRC.ascoCap2023, SRC.poHer2Low, SRC.db04],
    related: ["her2-breast", "pdl1-scores"],
  },
  {
    id: "her2-gastric",
    title: "HER2 scoring in gastric / GEJ adenocarcinoma",
    ask: "How is HER2 scored in gastric cancer?",
    answer:
      "Gastric and gastro-oesophageal junction adenocarcinoma use **their own criteria** (CAP/ASCP/ASCO 2017): **lateral or basolateral** membrane staining counts, and biopsies are judged on **clusters of ≥ 5 cohesive tumour cells** [1, 2].\n- **3+ (positive):** strong complete, basolateral or lateral membrane staining in ≥ 10% of tumour cells (resection) or a cluster of ≥ 5 cells (biopsy) [2, 3].\n- **2+ (equivocal):** weak to moderate complete or basolateral staining in ≥ 10% (resection) or ≥ 5 cohesive cells (biopsy) — reflex to ISH [3].\n- **1+ (negative):** weak staining in only part of the membrane in ≥ 10% (resection) or ≥ 5 cohesive cells (biopsy) [3].\n- **0 (negative):** no membrane staining, or staining in < 10% of cells / < 5 cohesive cells [3].\n- **ISH:** positive when HER2/CEP17 ≥ 2.0 [3].\nUse representative resection tissue or at least 6–8 biopsy fragments [3].",
    sources: [SRC.capGea2017, SRC.poHer2Gi, SRC.poTrastuzumab],
    related: ["her2-breast", "pdl1-cutoffs"],
  },
  {
    id: "pdl1-scores",
    title: "PD-L1 scores: TPS, CPS and IC",
    ask: "What is the difference between PD-L1 TPS, CPS and IC?",
    answer:
      "Three different scores — each tied to specific assays and drugs, so they are **not interchangeable**:\n- **TPS (tumour proportion score):** the percentage of tumour cells expressing PD-L1; the score behind the NSCLC cut-offs (e.g. ≥ 50%) [3].\n- **CPS (combined positive score):** the number of PD-L1-staining cells divided by the number of viable tumour cells, × 100 [1].\n- **IC score (immune cell score):** the area occupied by PD-L1-positive immune cells as a percentage of the tumour area; used with the SP142 assay [2].\nThe cut-off that matters depends on the tumour, the drug and the assay.",
    sources: [SRC.kn826, SRC.erber2020, SRC.kn024],
    related: ["pdl1-cutoffs", "her2-low"],
  },
  {
    id: "pdl1-cutoffs",
    title: "PD-L1 cut-offs by tumour type",
    ask: "What are the PD-L1 cut-offs by tumour type?",
    answer: `PD-L1 cut-offs used in the pivotal trials (as of ${SCORING_AS_OF}; approvals and labels change and differ by country — check the current label):\n\n| Setting | Score · assay | Cut-off(s) |\n|---|---|---|\n| NSCLC, 1st line (pembrolizumab) | TPS · 22C3† | ≥ 50% [1]; ≥ 1% [2] |\n| NSCLC, adjuvant (atezolizumab) | TC · SP263 | ≥ 1% [3] |\n| Head & neck SCC (pembrolizumab) | CPS · 22C3† | ≥ 1; ≥ 20 [4] |\n| Cervix (pembrolizumab) | CPS · 22C3† | ≥ 1 [5] |\n| TNBC (pembrolizumab) | CPS · 22C3 | ≥ 10 [6, 7] |\n| TNBC (atezolizumab) | IC · SP142 | ≥ 1% [7] |\n| Oesophageal SCC (pembrolizumab) | CPS · 22C3† | ≥ 10 [8] |\n| Gastric / GEJ adenocarcinoma (pembrolizumab) | CPS · 22C3† | ≥ 1; ≥ 10 [9] |\n| Gastric / GEJ / oesophageal adenocarcinoma (nivolumab) | CPS · 28-8† | ≥ 5 [10] |\n\n† Assay not named in the cited abstract.`,
    sources: [
      SRC.kn024,
      SRC.kn042,
      SRC.imp010,
      SRC.kn048,
      SRC.kn826,
      SRC.kn355,
      SRC.badve2022,
      SRC.kn590,
      SRC.kn859,
      SRC.cm649,
    ],
    related: ["pdl1-scores", "her2-gastric"],
  },
];

/**
 * Facts the cited abstracts do not state, for the owner's review before this
 * ships: the companion assay of each pembrolizumab / nivolumab trial (the
 * cells marked †). Kept here so the review list lives with the content.
 */
export const REVIEW = [
  "22C3 as the assay in KEYNOTE-024/042/048/826/590/859 (abstracts give the score and cut-off only)",
  "28-8 as the assay in CheckMate 649 (abstract gives CPS ≥ 5 only)",
] as const;

const HER2 = /\b(her-?2|erbb2|her2\/neu)\b/;
const PDL1 = /\b(pd-?l1|22c3|28-8|sp263|sp142|tps|cps)\b/;
/** Words that make it a scoring question rather than "is HER2 positive in X?". */
const SCORING =
  /\b(scor\w*|cut-?offs?|thresholds?|interpret\w*|criteria|equivocal|[0123] ?\+|her2-?low|ultra-?low|tps|cps|ic score|tumou?r proportion|combined positive|companion diagnostic|how (?:is|are|do you|to) (?:it |they )?(?:read|scored?|graded?|reported))\b|[0123]\+/;
const GASTRIC = /\b(gastric|stomach|gej|gastro-?o?esophageal|o?esophag\w*|cardia)\b/;
const LOW = /\b(low|ultra-?low|1\+ vs 0|0 vs 1\+|trastuzumab deruxtecan|t-?dxd|enhertu)\b/;
const CUTOFF =
  /\b(cut-?offs?|thresholds?|by tumou?r|which tumou?rs?|indications?|approv\w*|trials?|22c3|28-8|sp263|sp142|nsclc|lung|gastric|cervi\w*|head and neck|hnscc|tnbc|triple|o?esophag\w*|for (?:pembrolizumab|nivolumab|atezolizumab))\b/;

/** The scoring entry a question is about, or null (pure). */
export function matchScoring(question: string): ScoringEntry | null {
  const q = normalizeQuestion(question);
  if (q.length > 160 || !SCORING.test(q)) return null;
  const byId = (id: string) => SCORING_GUIDE.find((e) => e.id === id) ?? null;
  if (HER2.test(q)) {
    if (LOW.test(q)) return byId("her2-low");
    return byId(GASTRIC.test(q) ? "her2-gastric" : "her2-breast");
  }
  if (PDL1.test(q)) return byId(CUTOFF.test(q) ? "pdl1-cutoffs" : "pdl1-scores");
  return null;
}

/** Citations in the card's shape, numbered as the answer cites them. */
export function scoringCitations(entry: ScoringEntry) {
  return entry.sources.map((s, i) => ({
    n: i + 1,
    title: s.title,
    href: s.href,
    sourceLabel: s.sourceLabel,
  }));
}

export function scoringFollowUps(entry: ScoringEntry): string[] {
  return entry.related
    .map((id) => SCORING_GUIDE.find((e) => e.id === id)?.ask)
    .filter((a): a is string => !!a);
}
