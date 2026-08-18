/**
 * Answer options built in code, not asked for in prose.
 *
 * An immunophenotype question has a fixed shape: five options over ONE marker
 * set, in one order, differing only in the +/- signs. That is arithmetic, and
 * asking a language model to do it produced the single most common defect we
 * measured — 11 of 16 IHC questions built each option from a different marker
 * set, so the odd one out was findable without ever looking at the slide.
 *
 * Building them here makes that failure impossible rather than detectable: the
 * model receives the finished options and writes only the prose around them.
 */

export type MarkerCall = { marker: string; positive: boolean };

/** "CD20+, CD10-, BCL2+" -> calls. Tolerates the spacing and dashes WHO text uses. */
export function parseImmunoProfile(profile: string): MarkerCall[] {
  const calls: MarkerCall[] = [];
  const seen = new Set<string>();

  for (const part of (profile || "").split(/[,;]/)) {
    const text = part.trim();
    if (!text) continue;
    // The sign is the last character; anything else is not a marker call.
    const sign = text.slice(-1);
    const positive = sign === "+";
    if (!positive && !"-−–—".includes(sign)) continue;

    const marker = text.slice(0, -1).trim().replace(/\s+/g, " ");
    if (!marker || marker.length > 22) continue;
    const key = marker.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push({ marker, positive });
  }

  return calls;
}

const format = (calls: MarkerCall[]) =>
  calls.map((c) => `${c.marker}${c.positive ? "+" : "-"}`).join(", ");

/**
 * Five options over one marker set — and, crucially, a distractor design the
 * reader cannot solve by looking at the options alone.
 *
 * The first version emitted the truth plus four ONE-flip variants. That makes
 * the true sign the majority in every column, so taking the most common sign per
 * marker reconstructs the answer without ever opening the slide. Verified
 * against the live corpus: 117 of 117 option sets were solvable that way.
 *
 * The fix is to flip each column a varying number of times. With four
 * distractors, flipping a column twice leaves the truth in 3 of 5 options (a
 * majority), while flipping it three times leaves it in 2 of 5 (a minority) — so
 * alternating produces a "majority answer" that matches no option and is wrong
 * wherever it counts. Each distractor still differs from the truth in only a few
 * markers, which is what a competing entity's phenotype looks like.
 */
function flipMatrix(markers: number, distractors: number): boolean[][] {
  const flips = Array.from({ length: distractors }, () => new Array(markers).fill(false));
  const half = Math.floor(distractors / 2);
  let row = 0;

  for (let col = 0; col < markers; col++) {
    // Alternating: a majority of options carry the truth in this column, then a
    // minority in the next. Neither the truth nor its inverse survives a vote.
    const flipsHere = col % 2 === 0 ? half : half + 1;
    for (let n = 0; n < flipsHere; n++) {
      flips[row % distractors][col] = true;
      row++;
    }
  }

  return flips;
}

export function buildImmunoOptions(
  profile: string,
  { optionCount = 5, markerCount = 5 } = {}
): { correct: string; options: string[] } | null {
  const calls = parseImmunoProfile(profile);
  if (calls.length < 4) return null;

  // Compose the set to CARRY both polarities rather than hoping the first few do.
  // Profiles are written positives-first, so taking the leading five often took
  // five positives — leaving nothing for a distractor to disagree about, and
  // declining perfectly good cases.
  const positives = calls.filter((c) => c.positive);
  const negatives = calls.filter((c) => !c.positive);
  if (!positives.length || !negatives.length) return null;

  // Aim for roughly a third negatives, then top up from whichever polarity has
  // more. Without the top-up a profile like "ERG+, SMA-, Thyroglobulin-, TTF-1-"
  // is thrown away: one positive is available, so the first slice yields one
  // marker, the negatives contribute one, and the set falls under the minimum —
  // even though four perfectly good calls were sitting there. That shape is
  // common in WHO-derived profiles, where an entity is defined by a single
  // positive against several excluded markers.
  const negativesWanted = Math.min(negatives.length, Math.max(1, Math.floor(markerCount / 3)));
  const positivesTaken = Math.min(positives.length, markerCount - negativesWanted);
  const negativesTaken = Math.min(negatives.length, markerCount - positivesTaken);
  const chosen = [...positives.slice(0, positivesTaken), ...negatives.slice(0, negativesTaken)];
  if (chosen.length < 4) return null;

  const correct = format(chosen);
  const flips = flipMatrix(chosen.length, optionCount - 1);
  const options = [correct];
  const seen = new Set([correct]);

  for (const row of flips) {
    const variant = chosen.map((call, i) =>
      row[i] ? { ...call, positive: !call.positive } : call
    );
    let text = format(variant);
    // A collision would leave fewer than five options; nudge one more sign until
    // it is distinct, keeping the whole thing deterministic.
    for (let i = 0; seen.has(text) && i < variant.length; i++) {
      variant[i] = { ...variant[i], positive: !variant[i].positive };
      text = format(variant);
    }
    if (seen.has(text)) return null;
    seen.add(text);
    options.push(text);
  }

  return options.length === optionCount ? { correct, options } : null;
}

/**
 * The clinical history, with anything that would defeat the question removed.
 *
 * Sources write history and microscopy into the same field — "Tonsil (H&E).
 * Partial involvement by the lymphoma with follicular and diffuse architecture."
 * is a real example — and handing that to a writer told not to describe the
 * slide sets two instructions against each other. Cheaper to remove it than to
 * ask the model to unsee it.
 */
const MORPHOLOGY_SENTENCE =
  /\b(architectur\w*|infiltrat\w*|involvement by|nuclei|nucleoli|cytoplasm\w*|chromatin|mitos\w*|sheets?|nests?|follicular|diffuse|spindle|epithelioid|pleomorph\w*|atypia|necrosis|fibros\w*|stain(?:ed|ing)?|h&e|giemsa|section\w*|slide|magnification|microscop\w*)\b/i;

export function sanitizeHistory(history: string, diagnosis: string): string {
  const entity = (diagnosis || "").toLowerCase().split(/[,(]/)[0].trim();
  const entityWords = entity.split(/\s+/).filter((w) => w.length > 4);

  return (history || "")
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const text = sentence.trim();
      if (!text) return false;
      if (MORPHOLOGY_SENTENCE.test(text)) return false;
      // A history naming the entity, or most of its distinctive words, hands the
      // answer over as surely as the stem doing it.
      const lower = text.toLowerCase();
      if (entity.length > 6 && lower.includes(entity)) return false;
      if (entityWords.length && entityWords.every((w) => lower.includes(w))) return false;
      return true;
    })
    .join(" ")
    .trim();
}

/**
 * Does this molecular text name an alteration a question can key on?
 *
 * The gate used to be length alone, so a profile reading "No specific or
 * diagnostic molecular abnormaility" passed and was handed to the writer as the
 * correct answer. It also lets a percentage be mistaken for a variant: a corpus
 * string "(seen in ~57%)" produced a fabricated "MAP2K1 p.K57N".
 *
 * An alteration looks like a gene symbol, a fusion, a karyotype or a variant —
 * so require one of those shapes, and reject text whose whole point is absence.
 */
const ABSENCE =
  /\b(no (?:specific|known|recurrent|consistent|diagnostic)|not (?:been )?(?:identified|described|reported|detected)|none (?:identified|known)|absent|lacks?)\b/i;

// Method words, not alterations. "FISH: 13q14 deletions" names one; "FISH" alone
// does not.
const NOT_A_GENE = new Set([
  "FISH",
  "PCR",
  "NGS",
  "IHC",
  "WHO",
  "CGH",
  "SNP",
  "MLPA",
  "ISH",
  "DNA",
  "RNA",
  "PANEL",
  "SEQUENCING",
]);
const GENE_LIKE = /\b[A-Z][A-Z0-9]{2,}\b/g;
// Cytoband or karyotype: 13q14, 16q, t(8;21), inv(16), trisomy 8.
const LOCUS_OR_KARYOTYPE =
  /\b\d{1,2}[pq]\d*(?:\.\d+)?\b|\bt\(\d+;\d+\)|\b(?:inv|del|dup|der|add)\(\d+|\b(?:trisomy|monosomy|tetrasomy)\b|\bchromosome\s+\d{1,2}\b/i;

// Gene names are not all shouted: "Jagged1 gene", "Alpha1-AT gene". A capitalised
// word carrying one of these nouns is a named alteration too.
const NAMED_GENE =
  /\b[A-Z][A-Za-z0-9-]{2,}\s+(?:gene|mutation|fusion|rearrangement|deletion|amplification)\b/;

export function hasUsableMolecularProfile(profile: string): boolean {
  const text = (profile || "").trim();
  if (text.length < 5) return false;
  // Text whose point is that there is nothing to find cannot be an answer key.
  if (ABSENCE.test(text)) return false;
  // A named locus or karyotype is a complete alteration however short — "trisomy
  // 8" is nine characters and is the whole answer.
  if (LOCUS_OR_KARYOTYPE.test(text) || NAMED_GENE.test(text)) return true;
  // Otherwise the text has to be substantial enough to be more than a fragment,
  // and name something gene-shaped.
  if (text.length < 12) return false;
  return (text.match(GENE_LIKE) ?? []).some((symbol) => !NOT_A_GENE.has(symbol));
}

/**
 * Real alterations from other entities in the same chapter, to offer as
 * distractors.
 *
 * Left to itself the writer reached for stock haematolymphoid translocations —
 * RUNX1::RUNX1T1 and IGH::BCL2 under a breast carcinoma — which nobody weighing
 * a breast mass would consider, so the on-topic option was the answer.
 *
 * The candidates come from the corpus rather than a curated list, because the
 * corpus already holds each entity's defining alteration and we key answers on
 * it. That makes every candidate real, attributable to a named entity, and from
 * the differential the reader is actually in. Supplying material beats policing
 * the choice: it cannot reject a question, and it costs nothing at runtime.
 */
/**
 * The first alteration in a free-text profile, kept intact.
 *
 * Splitting on ";" alone cuts through nomenclature: "Fusions: YWHAE-NUTM2A/B
 * fusions (t(10;17)(q22;p13))" became "Fusions: YWHAE-NUTM2A/B fusions (t(10",
 * and a truncated karyotype offered as distractor material teaches the writer to
 * emit broken ones. Separators only count at bracket depth zero.
 */
export function leadingAlteration(profile: string): string {
  const text = (profile || "")
    // Corpus prose carries markdown bullets and method prefixes that are not part
    // of the alteration: "* Often has loss of 16q", "FISH: 13q14 deletions".
    .replace(/^\s*[*\-\u2022]+\s*/, "")
    .replace(/^(?:FISH|PCR|NGS|IHC|Sequencing)\s*:\s*/i, "")
    .trim();
  let depth = 0;
  let cut = text.length;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    else if ((ch === ";" || ch === "\n") && depth === 0) {
      cut = i;
      break;
    }
  }

  let alteration = text.slice(0, cut).trim();

  // Standard cytogenetic nomenclature puts the karyotype and its fusion either
  // side of a semicolon — "t(8;21)(q22;q22); RUNX1::RUNX1T1" is ONE alteration,
  // and cutting at the separator throws away the half that names the genes.
  const remainder = text.slice(cut + 1).trim();
  const fusion = remainder.match(/^[A-Z][A-Z0-9-]*::[A-Z][A-Z0-9-]*/);
  if (fusion && /^(?:t|inv|del|dup|der)\(/i.test(alteration)) {
    alteration = `${alteration}; ${fusion[0]}`;
  }

  // An unclosed bracket means the clause was cut short upstream; drop the tail
  // rather than emit half a karyotype.
  let open = 0;
  let lastBalanced = alteration.length;
  for (let i = 0; i < alteration.length; i++) {
    const ch = alteration[i];
    if (ch === "(" || ch === "[") open++;
    else if (ch === ")" || ch === "]") open = Math.max(0, open - 1);
    if (open === 0) lastBalanced = i + 1;
  }
  if (open > 0) alteration = alteration.slice(0, lastBalanced).trim();

  // Trailing significance or prevalence: "(defining)", "(seen in 60% of cases)".
  // Only these words — a trailing bracket is part of the nomenclature in
  // "t(10;17)(q22;p13)" and must survive.
  return alteration
    .replace(
      /\s*\((?:defining|diagnostic|characteristic|hallmark|recurrent|common|frequent|rare|seen|found|present|reported|in|~|\d+\s*%)\b[^)]*\)\s*$/i,
      ""
    )
    .trim();
}

/** Susceptibility and risk associations are not tumour alterations. */
const ASSOCIATION = /\b(polymorphism|susceptibilit|predispos|risk allele|associated with)\b/i;

/**
 * A distractor has to read like an answer. Corpus profiles are free text, so
 * plenty of them open with prose — "Approximately 2/3 rd will have a PIK3CA
 * mutation", "No MYC overexpression" — and an option in that voice is pickable
 * on shape alone, quite apart from being wrong when it is a negation.
 */
const STARTS_WITH_ALTERATION =
  /^(?:[A-Z][A-Z0-9-]{1,}|t\(|inv\(|del\(|dup\(|der\(|trisomy|monosomy|chromosome|\d{1,2}[pq])/;
const OPENS_WITH_NEGATION = /^(?:no|not|lack|lacks|absence|absent|without)\b/i;

export function candidateAlterations(
  pool: { category?: string | null; diagnosis?: string | null; source_metadata?: unknown }[],
  slide: { category?: string | null; diagnosis?: string | null },
  max = 8
): string[] {
  const chapter = (slide.category || "").trim().toLowerCase();
  if (!chapter) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const other of pool) {
    if ((other.category || "").trim().toLowerCase() !== chapter) continue;
    if ((other.diagnosis || "") === (slide.diagnosis || "")) continue;

    const profile = String(
      (other.source_metadata as Record<string, unknown>)?.molecular_profile ?? ""
    ).trim();
    if (!profile) continue;

    // Bracket-aware, so a karyotype survives intact (see leadingAlteration).
    const alteration = leadingAlteration(profile);
    if (alteration.length < 5 || alteration.length > 60) continue;
    // Candidates are held to the same bar as an answer key: a real alteration,
    // not an absence, a method, or a susceptibility association.
    if (!hasUsableMolecularProfile(alteration) || ASSOCIATION.test(alteration)) continue;
    if (OPENS_WITH_NEGATION.test(alteration) || !STARTS_WITH_ALTERATION.test(alteration)) continue;

    // One per gene: four flavours of BRCA make one distractor, not four.
    const gene =
      alteration.match(/([A-Z][A-Z0-9-]{1,})::/)?.[1] ??
      alteration.match(/\b(t\(\d+;\d+\)|inv\(\d+\)|trisomy \d+)/i)?.[1] ??
      alteration.match(/\b[A-Z][A-Z0-9]{2,}\b/)?.[0] ??
      alteration.toLowerCase();
    if (seen.has(gene.toLowerCase())) continue;
    seen.add(gene.toLowerCase());

    out.push(`${alteration} (${other.diagnosis})`);
    if (out.length >= max) break;
  }

  return out;
}
