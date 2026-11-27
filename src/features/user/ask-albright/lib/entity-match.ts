/**
 * Finding knowledge-base entities named in free text, and the compact profile
 * sent for each. Pure: no network, so it is unit-tested directly.
 *
 * Deliberately NOT the SQL `kb_norm` (TOOLING-INDEX T27): that one keeps
 * punctuation and accents for CHECK-enforced columns; matching needs the
 * opposite, plus British/American spellings folded ("tumour", "haem-").
 */

export interface EntityRow {
  id: string;
  slug: string;
  name: string;
}

export interface SynonymRow {
  entity_id: string;
  term: string;
  /** "alias" | "abbreviation" */
  kind: string;
}

export interface ProfileRow {
  entity_id: string;
  call: string;
  pooled_pct: number | null;
  sources: number | null;
  name: string;
  /** Marker kind: protein, mutation, fusion, … */
  kind: string;
}

interface Term {
  entities: EntityRow[];
  /** Matched only as an abbreviation (GIST, CHL): needs the question's capitals. */
  abbreviationOnly: boolean;
}

export interface EntityIndex {
  terms: Map<string, Term>;
  /** Longest term in words, bounding the n-gram scan. */
  maxWords: number;
}

export interface FoundEntity {
  /** The entity name as the knowledge base spells it (first match). */
  name: string;
  /** Every entity carrying that name or synonym (one tumour across WHO volumes). */
  entities: EntityRow[];
}

/** Lowercase, British spellings folded, punctuation to spaces. */
export function matchNorm(text: string): string {
  return text
    .toLowerCase()
    .replace(/tumour/g, "tumor")
    .replace(/aem/g, "em")
    .replace(/paed/g, "ped")
    .replace(/oesoph/g, "esoph")
    .replace(/oedem/g, "edem")
    .replace(/naev/g, "nev")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MAX_STEM_ENTITIES = 3;

export function buildEntityIndex(entities: EntityRow[], synonyms: SynonymRow[]): EntityIndex {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const terms = new Map<string, Term>();
  let maxWords = 1;
  const add = (raw: string, entity: EntityRow, abbreviation: boolean) => {
    const term = matchNorm(raw);
    if (term.length < 3) return;
    const t = terms.get(term) ?? { entities: [], abbreviationOnly: true };
    if (!t.entities.some((e) => e.id === entity.id)) t.entities.push(entity);
    t.abbreviationOnly &&= abbreviation;
    terms.set(term, t);
    maxWords = Math.max(maxWords, term.split(" ").length);
  };
  for (const e of entities) add(e.name, e, false);
  for (const s of synonyms) {
    const e = byId.get(s.entity_id);
    if (e) add(s.term, e, s.kind === "abbreviation");
  }
  // Site-qualified names also answer to their stem: nothing is named plain
  // "low-grade serous carcinoma" — only "…of the ovary" and "…of the
  // peritoneum" — so the question matched neither. Guarded, because a wrong
  // stem sends a question to the wrong tumour: 3+ words, never "other …", no
  // entity already owning the stem, at most 3 site variants, and no OTHER
  // entity whose name starts with it ("clear cell sarcoma" of the kidney must
  // not answer for clear cell sarcoma of soft tissue).
  const names = entities.map((e) => ({ id: e.id, norm: matchNorm(e.name) }));
  const stems = new Map<string, EntityRow[]>();
  for (const e of entities) {
    const m = matchNorm(e.name).match(/^(.+?) of the [a-z0-9 ]+$/);
    if (!m || m[1].split(" ").length < 3 || m[1].startsWith("other ")) continue;
    stems.set(m[1], [...(stems.get(m[1]) ?? []), e]);
  }
  for (const [stem, ents] of stems) {
    if (terms.has(stem) || ents.length > MAX_STEM_ENTITIES) continue;
    const mine = new Set(ents.map((e) => e.id));
    if (names.some((n) => !mine.has(n.id) && n.norm.startsWith(`${stem} `))) continue;
    for (const e of ents) add(stem, e, false);
  }
  return { terms, maxWords };
}

/**
 * Entities named in `text`, longest mention first, without overlaps ("solid
 * pseudopapillary neoplasm of the pancreas" is one mention, not two).
 * Abbreviations must be written in capitals in the text (GIST, not "gist"),
 * and one that stands for different tumours (AML: leukaemia or
 * angiomyolipoma) is skipped rather than guessed.
 */
export function findEntities(index: EntityIndex, text: string): FoundEntity[] {
  const raw = text.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const words = raw.map((w) => matchNorm(w)).filter(Boolean);
  const upper = new Set(raw.filter((w) => w.length >= 2 && w === w.toUpperCase()).map(matchNorm));
  const taken = new Array<boolean>(words.length).fill(false);
  const out: FoundEntity[] = [];
  const seen = new Set<string>();
  for (let n = Math.min(index.maxWords, words.length); n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      if (taken.slice(i, i + n).some(Boolean)) continue;
      const phrase = words.slice(i, i + n).join(" ");
      const t = index.terms.get(phrase);
      if (!t) continue;
      if (t.abbreviationOnly) {
        if (n !== 1 || !upper.has(phrase)) continue;
        const names = new Set(t.entities.map((e) => matchNorm(e.name).split(" ")[0]));
        if (names.size > 1) continue;
      }
      for (let k = i; k < i + n; k++) taken[k] = true;
      const key = t.entities
        .map((e) => e.id)
        .sort()
        .join();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: t.entities[0].name, entities: t.entities });
    }
  }
  return out;
}

const MAX = {
  positive: 14,
  negative: 8,
  loss: 8,
  retained: 8,
  aberrant: 6,
  wildtype: 6,
  molecular: 6,
  molecularAbsent: 6,
};

/**
 * Pattern calls get lines of their own, named in plain words. Folded into
 * Positive/Negative they misled the answer model: given "Negative: SDHB
 * (loss)" for paraganglioma it answered "SDHB is not lost; positive in 100%",
 * and p53 aberrant / wild-type calls were dropped from the profile entirely.
 */
const PATTERN_LINE: Record<"loss" | "retained" | "aberrant" | "wildtype", string> = {
  loss: "Loss of expression (stain lost in the tumour cells)",
  retained: "Retained expression (stain kept, the normal pattern)",
  aberrant: "Aberrant, mutation-type staining (e.g. p53 overexpression or null)",
  wildtype: "Wild-type, normal-pattern staining",
};

/**
 * One passage for an entity: positive and negative markers and molecular
 * alterations, best-sourced first, each marker once. Null when the knowledge
 * base has nothing for it.
 */
export function entityProfileText(name: string, rows: ProfileRow[]): string | null {
  const ranked = [...rows].sort(
    (a, b) => (b.sources ?? 0) - (a.sources ?? 0) || (b.pooled_pct ?? -1) - (a.pooled_pct ?? -1)
  );
  const seen = new Set<string>();
  const lists = {
    positive: [] as string[],
    negative: [] as string[],
    loss: [] as string[],
    retained: [] as string[],
    aberrant: [] as string[],
    wildtype: [] as string[],
    molecular: [] as string[],
    molecularAbsent: [] as string[],
  };
  for (const r of ranked) {
    const pct = r.pooled_pct != null ? ` (${Math.round(r.pooled_pct)}%)` : "";
    let group: keyof typeof lists | null = null;
    let label = r.name;
    if (r.kind === "protein" || r.kind === "dye") {
      if (r.call === "positive" || r.call === "mixed") {
        group = "positive";
        label = `${r.name}${r.call === "mixed" ? " (variable)" : pct}`;
      } else if (r.call === "negative") {
        group = "negative";
      } else if (
        r.call === "loss" ||
        r.call === "retained" ||
        r.call === "aberrant" ||
        r.call === "wildtype"
      ) {
        group = r.call;
        label = `${r.name}${pct}`;
      }
    } else if (r.call === "negative") {
      // "absence of BRAF p.V600E" in adamantinomatous craniopharyngioma: without
      // this line the model copied V600E across from the papillary column.
      group = "molecularAbsent";
      label = /\b(mutation|fusion|amplification|deletion|rearrangement|methylation)\b/i.test(r.name)
        ? r.name
        : `${r.name} ${r.kind.replace(/_/g, " ")}`;
    } else if (r.call === "positive") {
      group = "molecular";
      label = /\b(mutation|fusion|amplification|deletion|rearrangement|methylation)\b/i.test(r.name)
        ? `${r.name}${pct}`
        : `${r.name} ${r.kind.replace(/_/g, " ")}${pct}`;
    }
    if (!group) continue;
    // One row per marker — except across the pattern lines, where a marker
    // seen both ways IS the finding: "paraganglioma" pools the WHO volumes,
    // and a 34/34 SDHB-retained series hid the SDHB-loss rows, so the answer
    // was "SDHB is not lost".
    const key = group in PATTERN_LINE ? `${r.name.toLowerCase()}|${group}` : r.name.toLowerCase();
    if (seen.has(key) || lists[group].length >= MAX[group]) continue;
    lists[group].push(label);
    seen.add(key);
  }
  if (Object.values(lists).every((l) => l.length === 0)) return null;
  return [
    // The lists say WHERE a marker is reported, not how often or how strongly:
    // read as a verdict, "calretinin positive" in both mesothelioma subtypes
    // became "equally reliable in both".
    `${name} in the Pathology Bites knowledge base (WHO-derived; lists where each marker has been reported, not how often or how strongly; for frequency and reliability use the other sources).`,
    lists.positive.length ? `Positive: ${lists.positive.join("; ")}.` : "",
    lists.negative.length ? `Negative: ${lists.negative.join("; ")}.` : "",
    ...(["loss", "retained", "aberrant", "wildtype"] as const).map((k) =>
      lists[k].length ? `${PATTERN_LINE[k]}: ${lists[k].join("; ")}.` : ""
    ),
    lists.molecular.length ? `Molecular: ${lists.molecular.join("; ")}.` : "",
    lists.molecularAbsent.length
      ? `Molecular, reported absent: ${lists.molecularAbsent.join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
