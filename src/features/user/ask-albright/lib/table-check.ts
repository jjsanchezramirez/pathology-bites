/**
 * Check the answer's comparison table against the knowledge-base profiles.
 *
 * The answer model fills a table cell from whatever passage mentions the
 * marker, and PathologyOutlines pages end in a differential list written about
 * OTHER tumours. "Papillary craniopharyngioma: … negative for beta catenin",
 * from the adamantinomatous page, became "β-catenin: Negative" in the
 * adamantinomatous column three runs out of three, and three prompt rules did
 * not stop it. So the table is checked after the fact: a cell that contradicts
 * an unambiguous knowledge-base call is replaced by that call, cited to the
 * profile.
 *
 * Pattern markers are read in their own vocabulary, never as plain
 * positive/negative. β-catenin is nuclear (aberrant, which the knowledge base
 * codes "positive"), membranous only, or lost from the membrane. Membranous
 * only is the NORMAL pattern and a negative result (PathologyOutlines: "normal
 * membranous expression", "membranous staining (negative result)"); it says
 * nothing about the CTNNB1 genotype, so it is never labelled "wild-type" even
 * though the knowledge base stores it under that call. p53 is aberrant or
 * wild-type. For those, a bare "Positive"/"Negative" cell is
 * ambiguous and is rewritten in explicit terms even when it does not contradict.
 *
 * Pure: no network, unit-tested directly. Leaves the text alone when it cannot
 * tell which column is which tumour or which row is which marker.
 */

import { type ProfileRow, matchNorm } from "./entity-match";

export interface TableProfile {
  /** Entity name as the knowledge base spells it (the column header to match). */
  title: string;
  /** Citation number of this profile in the answer. */
  n: number;
  rows: ProfileRow[];
}

type CellClass =
  | "positive"
  | "negative"
  | "nuclear"
  | "wildtype"
  | "loss"
  | "retained"
  | "aberrant";
type Call = "positive" | "negative" | "loss" | "retained" | "aberrant" | "wildtype";

/** Folds β/beta and drops punctuation, so "β-catenin" = "Beta catenin" = "beta-catenin". */
function markerNorm(s: string): string {
  return matchNorm(s.replace(/β/g, "beta").replace(/\(.*?\)/g, " ")).replace(/\s+/g, " ");
}

const BETA_CATENIN = "beta catenin";
const P53 = "p53";

/** Markers whose bare positive/negative is ambiguous and gets spelled out. */
const PATTERN_MARKERS = new Set([BETA_CATENIN, P53]);

/** What a cell asserts, or null when it says nothing checkable ("Variable", "Not reported"). */
export function classifyCell(cell: string): CellClass | null {
  const t = cell
    .replace(/\[\d+\]/g, " ")
    .toLowerCase()
    .trim();
  if (!t || /not (reported|stated|described|mentioned|available)|unknown|n\/?a\b|variable/.test(t))
    return null;
  if (/nuclear/.test(t) && !/\bno(n|t)?[\s-]+nuclear|without nuclear|lacks? nuclear/.test(t))
    return "nuclear";
  // Before "membran": "loss of membranous staining" is loss, not the normal pattern.
  if (/\b(loss|lost)\b/.test(t)) return "loss";
  if (/wild[\s-]?type|membran/.test(t)) return "wildtype";
  if (/\bretained\b|\bintact\b/.test(t)) return "retained";
  if (/aberrant|mutation[\s-]type|overexpress|\bnull\b/.test(t)) return "aberrant";
  // Whichever comes first: "Positive (not diffuse)" is positive, "Negative (positive in
  // the stroma)" negative.
  const neg = t.search(/negative|absent|\bnot\b|^\s*(-|−|no)\s*$/);
  const pos = t.search(/positive|present|express|^\s*\+{1,3}\s*$/);
  if (neg < 0 && pos < 0) return null;
  if (pos < 0 || (neg >= 0 && neg < pos)) return "negative";
  return "positive";
}

/** Molecular names compared without the alteration word or HGVS "p.": "BRAF V600E mutation" = "BRAF p.V600E". */
function molNorm(s: string): string {
  return markerNorm(s)
    .replace(
      /\b(mutations?|mutated|fusions?|amplification|deletions?|rearrangements?|status|p)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** The marker's single call for this entity, or null when the rows disagree or say nothing. */
function kbCall(rows: ProfileRow[], marker: string, molecularRow: boolean): Call | null {
  const calls = new Set<Call>();
  for (const r of rows) {
    if ((molecularRow ? molNorm(r.name) : markerNorm(r.name)) !== marker) continue;
    const protein = r.kind === "protein" || r.kind === "dye";
    if (protein === molecularRow) continue;
    if (
      r.call === "positive" ||
      r.call === "negative" ||
      r.call === "loss" ||
      r.call === "retained" ||
      r.call === "aberrant" ||
      r.call === "wildtype"
    )
      calls.add(r.call);
    else return null; // mixed / index: nothing to assert
  }
  return calls.size === 1 ? [...calls][0] : null;
}

/** Cell classes each knowledge-base call rules out. */
const CONTRADICTS: Record<Call, CellClass[]> = {
  positive: ["negative", "loss", "wildtype"],
  negative: ["positive", "nuclear", "aberrant", "retained"],
  loss: ["positive", "retained", "wildtype"],
  retained: ["negative", "loss"],
  aberrant: ["wildtype", "retained"],
  wildtype: ["aberrant", "nuclear", "loss"],
};

/** The call in words a reader cannot misread, per marker. */
export function callLabel(marker: string, call: Call, molecular: boolean): string {
  if (molecular) return call === "negative" ? "Absent" : "Present";
  if (marker === BETA_CATENIN) {
    if (call === "positive" || call === "aberrant") return "Nuclear (aberrant)";
    if (call === "negative") return "No nuclear staining";
    if (call === "wildtype" || call === "retained")
      return "Membranous only, no nuclear (normal pattern)";
    if (call === "loss") return "Loss of membranous staining";
  }
  if (marker === P53) {
    if (call === "aberrant") return "Aberrant (mutation-type)";
    if (call === "wildtype") return "Wild-type";
  }
  return {
    positive: "Positive",
    negative: "Negative",
    loss: "Lost",
    retained: "Retained",
    aberrant: "Aberrant",
    wildtype: "Wild-type",
  }[call];
}

/** Which profile a header names: by the words that tell the profiles apart. */
function columnProfiles(headers: string[], profiles: TableProfile[]): Array<TableProfile | null> {
  const words = profiles.map((p) => new Set(matchNorm(p.title).split(" ")));
  const telling = words.map((w, i) =>
    [...w].filter((x) => x.length > 2 && words.every((o, j) => j === i || !o.has(x)))
  );
  return headers.map((h) => {
    const hw = new Set(matchNorm(h).split(" "));
    const hits = profiles.filter((_, i) => telling[i].length && telling[i].every((x) => hw.has(x)));
    return hits.length === 1 ? hits[0] : null;
  });
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
const isSeparator = (l: string) => /^\|(\s*:?-{3,}:?\s*\|)+$/.test(l.trim());
const MOLECULAR =
  /\b(mutation|fusion|amplification|deletion|rearrangement|translocation|v600e|methylation)\b/i;

/** Short in-list forms: "β-catenin (nuclear)" inside "CK7+, SOX2+, β-catenin+". */
function inlineLabel(name: string, marker: string, call: Call): string {
  if (marker === BETA_CATENIN) {
    const how =
      call === "positive" || call === "aberrant"
        ? "nuclear"
        : call === "negative"
          ? "no nuclear"
          : call === "loss"
            ? "membranous loss"
            : "membranous only";
    return `${name} (${how})`;
  }
  if (marker === P53) return `${name} (${call === "aberrant" ? "aberrant" : "wild-type"})`;
  if (call === "positive" || call === "retained") return `${name}+`;
  if (call === "negative" || call === "loss") return `${name}−`;
  return `${name} (${callLabel(marker, call, false).toLowerCase()})`;
}

/** "CK7+", "CD20-", "β-catenin+" tokens inside a list cell. */
const INLINE = /(^|[\s,;(])((?:β|beta)[\s-]catenin|[A-Za-z][\w/.-]*?)\s?(\+|−|-)(?=[\s,;)\[]|$)/gi;

/**
 * The same check for a cell listing several stains ("Key stains: CK7+, SOX2+,
 * β-catenin+"): each signed token is compared on its own, and a contradicted
 * or (for pattern markers) bare-signed one is rewritten and cited.
 */
function fixInline(cell: string, prof: TableProfile, fixes: TableFix[]): string {
  return cell.replace(INLINE, (whole, lead: string, name: string, sign: string) => {
    const marker = markerNorm(name);
    const call = kbCall(prof.rows, marker, false);
    if (!call) return whole;
    const said: CellClass = sign === "+" ? "positive" : "negative";
    const contradicts = CONTRADICTS[call].includes(said);
    if (!contradicts && !PATTERN_MARKERS.has(marker)) return whole;
    const to = `${inlineLabel(name, marker, call)} [${prof.n}]`;
    fixes.push({ entity: prof.title, marker: name, from: `${name}${sign}`, to });
    return `${lead}${to}`;
  });
}

export interface TableFix {
  entity: string;
  marker: string;
  from: string;
  to: string;
}

/**
 * Rewrite contradicting (and, for pattern markers, ambiguous) cells of every
 * markdown table in `answer` whose columns name profiled entities. Returns the
 * text and what changed, for the log.
 */
export function checkTables(
  answer: string,
  profiles: TableProfile[]
): { text: string; fixes: TableFix[] } {
  const fixes: TableFix[] = [];
  if (profiles.length === 0 || !answer.includes("|")) return { text: answer, fixes };
  const lines = answer.split("\n");
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i].trim().startsWith("|") || !isSeparator(lines[i + 1])) continue;
    const header = splitRow(lines[i]);
    const cols = columnProfiles(header, profiles);
    if (!cols.some(Boolean)) continue;
    for (let r = i + 2; r < lines.length && lines[r].trim().startsWith("|"); r++) {
      const cells = splitRow(lines[r]);
      const markerCell = cells[0] ?? "";
      const molecular = MOLECULAR.test(markerCell);
      const marker = molecular
        ? molNorm(markerCell)
        : markerNorm(markerCell.replace(/\b(ihc|stain(ing)?|immunostain)\b/gi, ""));
      if (!marker) continue;
      let changed = false;
      for (let c = 1; c < cells.length; c++) {
        // The profile's own heading copied into a cell reads oddly: "Absent [3]".
        const tidy = cells[c].replace(/^molecular,? reported absent\b/i, "Absent");
        if (tidy !== cells[c]) {
          cells[c] = tidy;
          changed = true;
        }
        const prof = cols[c];
        if (!prof) continue;
        const call = kbCall(prof.rows, marker, molecular);
        if (!call) {
          const fixed = fixInline(cells[c], prof, fixes);
          if (fixed !== cells[c]) {
            cells[c] = fixed;
            changed = true;
          }
          continue;
        }
        const said = classifyCell(cells[c]);
        const contradicts = said !== null && CONTRADICTS[call].includes(said);
        const ambiguous =
          !molecular &&
          PATTERN_MARKERS.has(marker) &&
          (said === "positive" || said === "negative") &&
          !contradicts;
        if (!contradicts && !ambiguous) continue;
        const to = `${callLabel(marker, call, molecular)} [${prof.n}]`;
        if (to === cells[c]) continue;
        fixes.push({ entity: prof.title, marker: markerCell, from: cells[c], to });
        cells[c] = to;
        changed = true;
      }
      // A rewrite cited to the same source the model already cited: "[3] [3]" → "[3]".
      if (changed) lines[r] = `| ${cells.join(" | ")} |`.replace(/\[(\d+)\](\s*\[\1\])+/g, "[$1]");
    }
  }
  return { text: lines.join("\n"), fixes };
}
