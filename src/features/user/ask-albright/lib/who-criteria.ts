/**
 * WHO "Essential and desirable diagnostic criteria", read straight from the
 * passage text rather than by the answer model. WHO writes them as
 * "Essential: a; b; c. Desirable: d; e." The model split, merged across
 * chapters, dropped the Desirable group or ran out of tokens on them (NLPHL:
 * 26 bullets, no Desirable); parsing gives both groups in WHO's own words, at
 * no token cost. Pure.
 */

export interface WhoCriteria {
  essential: string[];
  desirable: string[];
}

/** The section headings that follow the criteria in a WHO chapter. */
const NEXT_SECTION =
  /\s(?:Staging|Prognosis and prediction|Prognosis|Grading|Cytology|Differential diagnosis|Definition|ICD-O coding)\b/;

/** Split on ";" outside parentheses and brackets. */
function splitItems(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    else if ((ch === ")" || ch === "]") && depth > 0) depth--;
    if (ch === ";" && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out
    .map((s) =>
      s
        // WHO's internal anchors: "#20865Table 11.06" → "Table 11.06".
        .replace(/#\d+(?=[A-Z])/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[.;,]+$/, "")
        .trim()
    )
    .filter((s) => s.length > 1 && !/^(none|n\/a)$/i.test(s))
    .map((s) => s[0].toUpperCase() + s.slice(1));
}

/** The criteria in a WHO passage, or null when it lists none. */
export function parseWhoCriteria(body: string): WhoCriteria | null {
  const start = body.search(/\bEssential:\s*\S/);
  if (start < 0) return null;
  let rest = body.slice(start).replace(/^Essential:\s*/, "");
  const end = rest.search(NEXT_SECTION);
  if (end >= 0) rest = rest.slice(0, end);
  const [ess, des = ""] = rest.split(/\bDesirable:\s*/);
  const essential = splitItems(ess);
  if (!essential.length) return null;
  return { essential, desirable: splitItems(des) };
}

/** The answer text: both groups as bullets, each cited to source `n`. */
export function criteriaAnswer(c: WhoCriteria, n: number): string {
  const group = (label: string, items: string[]) =>
    items.length ? [`**${label}:**`, ...items.map((i) => `- ${i} [${n}]`)].join("\n") : "";
  return [group("Essential", c.essential), group("Desirable", c.desirable)]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The page to read criteria from: of the pages that list them, the most
 * specific one whose title is wholly in the question, else the general page
 * over its variants, else the
 * best-ranked. `pages` come best first.
 */
export function pickCriteriaPage<T extends { title: string; body: string }>(
  pages: T[],
  question: string
): { page: T; criteria: WhoCriteria } | null {
  const q = question.toLowerCase();
  const parsed = pages
    .map((page) => ({ page, criteria: parseWhoCriteria(page.body) }))
    .filter((x): x is { page: T; criteria: WhoCriteria } => x.criteria !== null);
  if (!parsed.length) return null;
  const words = (t: string) => t.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const named = parsed
    .filter((x) => words(x.page.title).every((w) => q.includes(w)))
    .sort((a, b) => b.page.title.length - a.page.title.length);
  if (named[0]) return named[0];
  // Otherwise the general page over its variants: "Classic Hodgkin lymphoma
  // of the mediastinum" ranked first for "WHO diagnostic criteria for CHL".
  const general = parsed.filter(
    (x) =>
      !parsed.some(
        (y) =>
          y !== x &&
          y.page.title.length < x.page.title.length &&
          x.page.title.toLowerCase().includes(y.page.title.toLowerCase())
      )
  );
  return general[0] ?? parsed[0];
}
