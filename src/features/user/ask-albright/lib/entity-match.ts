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
  /** WHO organ systems the entity is placed in (entity_placements.organ_system). */
  organs?: string[];
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

/**
 * How a term reaches an entity. "stem" is the bare name of a site-qualified
 * entity ("oncocytoma" for Oncocytoma of the kidney) that another entity
 * already owns or that is unsafe on its own: it wins only when the question
 * points at its organ.
 */
type How = "name" | "alias" | "abbreviation" | "stem";

interface Candidate {
  entity: EntityRow;
  how: How;
}

interface Term {
  candidates: Candidate[];
}

export interface EntityIndex {
  terms: Map<string, Term>;
  /** Longest term in words, bounding the n-gram scan. */
  maxWords: number;
  /**
   * Terms the knowledge base records as naming different diseases
   * (entity_homonyms), matchNorm'd. Null until that table exists: the matcher
   * then falls back to the organ-system proxy (`resolveByOrgan`).
   */
  homonyms: Set<string> | null;
}

export interface FoundEntity {
  /** The entity name as the knowledge base spells it (first match). */
  name: string;
  /** Every entity carrying that name or synonym (one tumour across WHO volumes). */
  entities: EntityRow[];
  /**
   * Set when the question used a homonym without saying which organ: the
   * shared term ("oncocytoma"). The entity is one of several unrelated
   * diseases answering to it, profiled apart.
   */
  namesakeOf?: string;
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

/**
 * Volumes that are not an organ: a tumour placed in Paediatric or Genetic
 * Tumour Syndromes says nothing about where it arises, so these never decide
 * between namesakes.
 */
const NOT_AN_ORGAN = new Set(["Paediatric", "Genetic Tumour Syndromes"]);

/**
 * Words that put a question in one WHO organ system (matchNorm'd). Only used
 * to choose between entities that share a name across organ systems:
 * "oncocytoma" is a salivary tumour, a renal one and an adrenal adenoma.
 */
const ORGAN_WORDS: Record<string, string[]> = {
  "Urinary and Male Genital": [
    "genitourinary",
    "kidney",
    "kidneys",
    "renal",
    "rcc",
    "ccrcc",
    "chrcc",
    "nephric",
    "bladder",
    "urothelial",
    "ureter",
    "urethra",
    "urethral",
    "urinary",
    "prostate",
    "prostatic",
    "testis",
    "testicular",
    "testes",
    "penis",
    "penile",
    "scrotal",
    "epididymis",
  ],
  "Head and Neck": [
    "salivary",
    "parotid",
    "submandibular",
    "sublingual",
    "larynx",
    "laryngeal",
    "pharynx",
    "pharyngeal",
    "nasopharyngeal",
    "oropharyngeal",
    "oral",
    "nasal",
    "sinonasal",
    "tongue",
    "gingiva",
    "gingival",
    "jaw",
    "odontogenic",
    "head and neck",
    "middle ear",
  ],
  "Endocrine and Neuroendocrine": [
    "endocrine",
    "adrenal",
    "adrenocortical",
    "thyroid",
    "parathyroid",
    "pituitary",
    "adenohypophysis",
  ],
  "Digestive System": [
    "gastrointestinal",
    "stomach",
    "gastric",
    "colon",
    "colonic",
    "colorectal",
    "rectal",
    "rectum",
    "esophagus",
    "esophageal",
    "liver",
    "hepatic",
    "pancreas",
    "pancreatic",
    "gallbladder",
    "biliary",
    "bile duct",
    "intestinal",
    "small bowel",
    "duodenal",
    "duodenum",
    "appendix",
    "appendiceal",
    "anal",
    "ampullary",
  ],
  Thoracic: [
    "lung",
    "thoracic",
    "thorax",
    "lungs",
    "pulmonary",
    "pleura",
    "pleural",
    "thymus",
    "thymic",
    "mediastinal",
    "mediastinum",
    "heart",
    "cardiac",
    "bronchial",
    "tracheal",
  ],
  Breast: ["breast", "breasts", "mammary"],
  "Female Genital": [
    "gynecologic",
    "gynaecologic",
    "ovary",
    "ovaries",
    "ovarian",
    "uterus",
    "uterine",
    "endometrial",
    "endometrium",
    "cervix",
    "vulva",
    "vulvar",
    "vagina",
    "vaginal",
    "fallopian",
    "placenta",
    "placental",
    "myometrial",
  ],
  Skin: ["skin", "cutaneous", "dermal", "epidermal", "subcutaneous"],
  "Central Nervous System": [
    "brain",
    "cerebral",
    "spinal cord",
    "cns",
    "intracranial",
    "cerebellar",
    "meningeal",
  ],
  "Eye and Orbit": [
    "eye",
    "ocular",
    "orbit",
    "orbital",
    "conjunctiva",
    "conjunctival",
    "retina",
    "retinal",
    "uveal",
    "eyelid",
    "lacrimal",
    "choroidal",
    "intraocular",
  ],
  "Soft Tissue and Bone": ["bone", "bones", "osseous", "soft tissue", "soft tissues"],
  Haematolymphoid: ["haematolymphoid", "lymph node", "nodal", "marrow", "spleen", "splenic"],
};

/**
 * One word per organ system that ORGAN_WORDS reads back as that system, to
 * qualify a namesake whose own name is the bare term ("head and neck
 * oncocytoma").
 */
const ORGAN_LABEL: Record<string, string> = {
  "Urinary and Male Genital": "genitourinary",
  "Head and Neck": "head and neck",
  "Endocrine and Neuroendocrine": "endocrine",
  "Digestive System": "gastrointestinal",
  Thoracic: "thoracic",
  Breast: "breast",
  "Female Genital": "gynaecologic",
  Skin: "cutaneous",
  "Central Nervous System": "CNS",
  "Eye and Orbit": "ocular",
  "Soft Tissue and Bone": "soft tissue",
  Haematolymphoid: "haematolymphoid",
};

/** Organ systems a question names in plain words. */
export function organsNamed(text: string): Set<string> {
  const t = ` ${matchNorm(text)} `;
  const out = new Set<string>();
  for (const [organ, words] of Object.entries(ORGAN_WORDS))
    if (words.some((w) => t.includes(` ${w} `))) out.add(organ);
  return out;
}

const organsOf = (e: EntityRow) => (e.organs ?? []).filter((o) => !NOT_AN_ORGAN.has(o));

export function buildEntityIndex(
  entities: EntityRow[],
  synonyms: SynonymRow[],
  homonyms: string[] | null = null
): EntityIndex {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const terms = new Map<string, Term>();
  let maxWords = 1;
  const add = (raw: string, entity: EntityRow, how: How) => {
    const term = matchNorm(raw);
    if (term.length < 3) return;
    const t = terms.get(term) ?? { candidates: [] };
    if (!t.candidates.some((c) => c.entity.id === entity.id)) t.candidates.push({ entity, how });
    terms.set(term, t);
    maxWords = Math.max(maxWords, term.split(" ").length);
  };
  for (const e of entities) add(e.name, e, "name");
  for (const s of synonyms) {
    const e = byId.get(s.entity_id);
    if (e) add(s.term, e, s.kind === "abbreviation" ? "abbreviation" : "alias");
  }
  // Site-qualified names also answer to their stem: nothing is named plain
  // "low-grade serous carcinoma" — only "…of the ovary" and "…of the
  // peritoneum" — so the question matched neither. Unconditionally only when
  // safe, because a wrong stem sends a question to the wrong tumour: 3+ words,
  // never "other …", no entity already owning the stem, at most 3 site
  // variants, and no OTHER entity whose name starts with it ("clear cell
  // sarcoma" of the kidney must not answer for clear cell sarcoma of soft
  // tissue). Every other stem is kept as a "stem" candidate, which needs the
  // question to name its organ (findEntities).
  const names = entities.map((e) => ({ id: e.id, norm: matchNorm(e.name) }));
  const stems = new Map<string, EntityRow[]>();
  for (const e of entities) {
    const m = matchNorm(e.name).match(/^(.+?) of (?:the )?[a-z0-9 ]+$/);
    if (!m || m[1].startsWith("other ")) continue;
    stems.set(m[1], [...(stems.get(m[1]) ?? []), e]);
  }
  for (const [stem, ents] of stems) {
    const mine = new Set(ents.map((e) => e.id));
    const safe =
      ents.every((e) => / of the /.test(matchNorm(e.name))) &&
      stem.split(" ").length >= 3 &&
      !terms.has(stem) &&
      ents.length <= MAX_STEM_ENTITIES &&
      !names.some((n) => !mine.has(n.id) && n.norm.startsWith(`${stem} `));
    for (const e of ents) add(stem, e, safe ? "name" : "stem");
  }
  const hom = homonyms ? new Set(homonyms.map(matchNorm).filter(Boolean)) : null;
  return { terms, maxWords, homonyms: hom };
}

/** At most this many namesakes are profiled separately for one unqualified mention. */
const MAX_NAMESAKES = 3;

/**
 * The entities a matched term stands for in this question, as groups: one
 * group is one disease (its rows are pooled into one profile). Empty when the
 * term stands for nothing here.
 *
 * The knowledge base says which shared names are namesakes (entity_homonyms:
 * Oncocytoma is a salivary tumour and, of the kidney, a renal one). Same-
 * disease rows are merged in the knowledge base and junk aliases deleted, so a
 * term that is NOT a homonym is one disease and pools — including a stem when
 * the question names its organ. A homonym is read in the organ the question
 * points to; with no pointer each namesake gets its own group, never pooled.
 */
function resolve(
  term: string,
  t: Term,
  context: Set<string>,
  homonyms: Set<string> | null
): EntityRow[][] {
  if (!homonyms) {
    const legacy = resolveByOrgan(term, t, context);
    return legacy.length ? [legacy] : [];
  }
  const direct = t.candidates.filter((c) => c.how !== "stem");
  const inContext = (c: Candidate) => organsOf(c.entity).some((o) => context.has(o));
  if (homonyms.has(term)) {
    // Each row is a different disease, so each is its own group — even when the
    // question names both organs. Without a pointer the stems count too: bare
    // "oncocytoma" is the kidney tumour as often as the salivary one, and
    // leaving "Oncocytoma of the kidney" out sent the answer to the salivary
    // and adrenal profiles with renal markers copied in from the literature.
    // A stem is still named for the term, so it ranks above an alias.
    const here = context.size ? t.candidates.filter(inContext) : [];
    const order: Record<How, number> = { name: 0, stem: 1, alias: 2, abbreviation: 3 };
    return [...(here.length ? here : t.candidates)]
      .sort((x, y) => order[x.how] - order[y.how])
      .slice(0, MAX_NAMESAKES)
      .map((c) => [c.entity]);
  }
  const stems = context.size ? t.candidates.filter((c) => c.how === "stem" && inContext(c)) : [];
  const one = [...direct, ...stems].map((c) => c.entity);
  return one.length ? [one] : [];
}

/**
 * The organ-system proxy, used only until entity_homonyms exists (PR #69).
 * When the candidates span organ systems and the question names one — in words
 * ("renal") or through another diagnosis it names (chromophobe RCC) — only
 * that organ's entities are kept. Without such a pointer, stems are dropped and
 * names and aliases pool, except an alias the entity's own name does not
 * contain and that shares no organ with the entities carrying the name
 * ("oncocytoma" for Adrenal cortical adenoma).
 */
function resolveByOrgan(term: string, t: Term, context: Set<string>): EntityRow[] {
  const organsInPlay = new Set(t.candidates.flatMap((c) => organsOf(c.entity)));
  if (organsInPlay.size > 1 && context.size) {
    const here = t.candidates.filter((c) => organsOf(c.entity).some((o) => context.has(o)));
    if (here.length) return here.map((c) => c.entity);
  }
  const direct = t.candidates.filter((c) => c.how !== "stem");
  const named = direct.filter((c) => c.how === "name");
  const namedOrgans = new Set(named.flatMap((c) => organsOf(c.entity)));
  return direct
    .filter((c) => {
      if (c.how !== "alias" || !namedOrgans.size) return true;
      if (` ${matchNorm(c.entity.name)} `.includes(` ${term} `)) return true;
      const own = organsOf(c.entity);
      return !own.length || own.some((o) => namedOrgans.has(o));
    })
    .map((c) => c.entity);
}

function scan(index: EntityIndex, text: string, context: Set<string>): FoundEntity[] {
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
      if (t.candidates.every((c) => c.how === "abbreviation")) {
        if (n !== 1 || !upper.has(phrase)) continue;
        const names = new Set(t.candidates.map((c) => matchNorm(c.entity.name).split(" ")[0]));
        if (names.size > 1) continue;
      }
      const groups = resolve(phrase, t, context, index.homonyms);
      if (!groups.length) continue;
      const namesakeOf = groups.length > 1 ? phrase : undefined;
      for (let k = i; k < i + n; k++) taken[k] = true;
      for (const entities of groups) {
        const key = entities
          .map((e) => e.id)
          .sort()
          .join();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: entities[0].name, entities, ...(namesakeOf && { namesakeOf }) });
      }
    }
  }
  return out;
}

/**
 * Abbreviations used inside names rather than for a whole entity: no synonym
 * says "chromophobe RCC", so "chromophobe RCC vs oncocytoma" found only the
 * oncocytoma. Capitals only, as for entity abbreviations.
 */
const IN_NAME_ABBREVIATIONS: Record<string, string> = {
  RCC: "renal cell carcinoma",
  ccRCC: "clear cell renal cell carcinoma",
};

function expandAbbreviations(text: string): string {
  return text.replace(/\b(?:cc)?RCCs?\b/g, (m) => IN_NAME_ABBREVIATIONS[m.replace(/s$/, "")] ?? m);
}

/**
 * Entities named in `text`, longest mention first, without overlaps ("solid
 * pseudopapillary neoplasm of the pancreas" is one mention, not two).
 * Abbreviations must be written in capitals in the text (GIST, not "gist"),
 * and one that stands for different tumours (AML: leukaemia or
 * angiomyolipoma) is skipped rather than guessed. A namesake (`resolve`) is
 * read in the organ the question points to: organ words first, then the organ
 * of every other diagnosis it names that sits in one organ system only.
 */
export function findEntities(index: EntityIndex, rawText: string): FoundEntity[] {
  const text = expandAbbreviations(rawText);
  const context = organsNamed(text);
  const first = scan(index, text, context);
  const fromMentions = new Set(context);
  for (const f of first) {
    // Namesakes found for want of a pointer point nowhere: their organs would
    // steer every other name in the question.
    if (f.namesakeOf) continue;
    const organs = new Set(f.entities.flatMap(organsOf));
    if (organs.size === 1) fromMentions.add([...organs][0]);
  }
  return fromMentions.size > context.size ? scan(index, text, fromMentions) : first;
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
export function entityProfileText(
  name: string,
  rows: ProfileRow[],
  namesakeOf?: string
): string | null {
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
    namesakeOf
      ? `"${namesakeOf}" also names other, unrelated tumours in other organs; this profile is ${name} only. Answer each one separately, saying which organ it is, and never move a marker from one to another.`
      : "",
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

export interface NamesakeChoice {
  /** The entity's name in the knowledge base. */
  name: string;
  /** Its WHO organ system ("" when it has none). */
  organ: string;
  /** The question rewritten so it names this one; asking it is unambiguous. */
  question: string;
}

/** `phrase` in place of the first `term` in `question`, else appended. */
function rewriteTerm(question: string, term: string, phrase: string): string {
  const words = term.split(" ").map((w) => w.replace(/tumor/, "tumou?r"));
  const re = new RegExp(`\\b${words.join("[^A-Za-z0-9]+")}\\b`, "i");
  const m = question.match(re);
  if (!m || m.index === undefined) return `${question.trim()} (${phrase})`;
  const cased = /^[A-Z]/.test(m[0]) ? phrase[0].toUpperCase() + phrase.slice(1) : phrase;
  return question.slice(0, m.index) + cased + question.slice(m.index + m[0].length);
}

/**
 * When the question uses a homonym without saying which organ, the
 * namesakes to choose between, each with the question rewritten to name it.
 * Null when nothing is ambiguous, or fewer than two rewrites come out
 * unambiguous (then the answer goes ahead with every namesake profiled).
 */
export function namesakeChoices(
  index: EntityIndex,
  question: string
): { term: string; choices: NamesakeChoice[] } | null {
  const found = findEntities(index, question);
  const term = found.find((f) => f.namesakeOf)?.namesakeOf;
  if (!term) return null;
  const choices: NamesakeChoice[] = [];
  for (const f of found.filter((x) => x.namesakeOf === term)) {
    const e = f.entities[0];
    const organ = organsOf(e)[0] ?? "";
    // An acronym-led name keeps its capitals; others read mid-sentence.
    const name = /^[A-Z]{2}/.test(e.name) ? e.name : e.name[0].toLowerCase() + e.name.slice(1);
    const phrase =
      matchNorm(e.name) !== term
        ? name
        : ORGAN_LABEL[organ]
          ? `${ORGAN_LABEL[organ]} ${name}`
          : null;
    if (!phrase) continue;
    const rewritten = rewriteTerm(question, term, phrase);
    const again = findEntities(index, rewritten);
    if (again.some((g) => g.namesakeOf)) continue;
    if (!again.some((g) => g.entities.some((x) => x.id === e.id))) continue;
    choices.push({ name: e.name, organ, question: rewritten });
  }
  return choices.length >= 2 ? { term, choices } : null;
}

/** The reply that asks which namesake: the choices, each one a tap away. */
export function namesakeReply(
  term: string,
  choices: NamesakeChoice[]
): {
  answer: string;
  followUps: string[];
} {
  const shown = term.replace(/\btumor\b/g, "tumour");
  return {
    answer: [
      `"${shown[0].toUpperCase()}${shown.slice(1)}" names ${choices.length} different tumours. Which one do you mean?`,
      choices.map((c) => `- **${c.name}**${c.organ ? ` (${c.organ})` : ""}`).join("\n"),
      "Pick one below. Asking me which one you meant doesn't use up a question.",
    ].join("\n\n"),
    followUps: choices.map((c) => c.question),
  };
}
