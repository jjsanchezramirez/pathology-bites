/**
 * Rebuild the symbol tables PathTalk flattens into prose.
 *
 * PathologyOutlines IHC panels arrive as one run of text, e.g.
 *
 *   IHC panels Hale KIT CK7 S100A1 VIM CAIX AMACR SDH TFE3 Chromophobe RCC +++
 *   +++ +++ - - - - +++ - Clear cell RCC - - - - +++ +++ - +++ - Oncocytoma -
 *   +++ rare +++ - - - +++ - …
 *
 * Small models misread that (they inverted KIT in oncocytoma), and a user
 * cannot read it either. The shape is regular enough to recover: every row is
 * a short name followed by exactly N symbol cells, and the N tokens before the
 * first row's name are the column headers. The only real ambiguity is where
 * the headers stop and the first row name starts; `splitHeader` scores each
 * split by how marker-like the headers look. Anything that doesn't fit cleanly
 * is left as prose — a wrong table is worse than no table.
 *
 * Pure and zero-token: runs on every passage before the answer call.
 */

export interface SymbolTable {
  headers: string[];
  rows: Array<{ name: string; cells: string[] }>;
}

export interface ExtractedTables {
  tables: SymbolTable[];
  /** The input with each table's span removed, for excerpting the prose. */
  prose: string;
}

const CELL = /^(\+{1,3}|-|−|±|\+\/-|rare|focal|variable|weak|NA)$/i;
const MIN_COLS = 2;
const MIN_ROWS = 2;
const MAX_ROW_NAME_TOKENS = 6;
const MAX_FIRST_ROW_NAME = 4;

// Title-case or lowercase stain names that fail the shape test in `markerLike`.
export const KNOWN_STAINS = new Set(
  [
    "hale",
    "vimentin",
    "desmin",
    "actin",
    "inhibin",
    "calretinin",
    "synaptophysin",
    "chromogranin",
    "mammaglobin",
    "keratin",
    "cytokeratin",
    "myogenin",
    "napsin",
    "mucicarmine",
    "pas",
    "melan-a",
    "podoplanin",
    "caldesmon",
    "calponin",
    "cyclin",
    "beta-catenin",
    "trichrome",
    "reticulin",
    "congo",
    "iron",
  ].map((s) => s.toLowerCase())
);

/** CK7, S100A1, TFE3, D2-40, p63, KIT, VIM… or a stain from the list above. */
export function markerLike(token: string): boolean {
  const t = token.replace(/[(),;:]/g, "");
  if (!t) return false;
  if (KNOWN_STAINS.has(t.toLowerCase())) return true;
  if (/\d/.test(t)) return true; // CK7, S100A1, TFE3, D2-40, p63
  return (t.match(/[A-Z]/g) ?? []).length >= 2; // KIT, VIM, CAIX, AMACR, EMA
}

function isCell(token: string): boolean {
  return CELL.test(token);
}

/**
 * Choose how many of the tokens just before the first cell run are the first
 * row's name (the rest of the N before that are headers). Returns null when no
 * split gives headers that look like markers.
 */
export function splitHeader(
  before: string[],
  cols: number
): { headers: string[]; firstRow: string } | null {
  let best: { headers: string[]; firstRow: string; score: number } | null = null;
  for (let k = 1; k <= MAX_FIRST_ROW_NAME; k++) {
    if (before.length < cols + k) break;
    const rowTokens = before.slice(before.length - k);
    const headers = before.slice(before.length - k - cols, before.length - k);
    const markers = headers.filter(markerLike).length;
    // Headers must be (almost) all markers, and must end on one: the classic
    // wrong split swallows the row's first word ("TFE3 Chromophobe | RCC").
    if (markers < cols - 1 || !markerLike(headers[headers.length - 1])) continue;
    const score = markers * 2 - (markerLike(rowTokens[0]) ? 1 : 0);
    if (!best || score > best.score) best = { headers, firstRow: rowTokens.join(" "), score };
  }
  return best && { headers: best.headers, firstRow: best.firstRow };
}

/** Find every symbol table in a passage; return them plus the prose around them. */
export function extractSymbolTables(body: string): ExtractedTables {
  const tokens = body.replace(/\s+/g, " ").trim().split(" ");

  // Maximal runs of cell tokens: [start, end).
  const runs: Array<[number, number]> = [];
  for (let i = 0; i < tokens.length; ) {
    if (!isCell(tokens[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < tokens.length && isCell(tokens[j])) j++;
    if (j - i >= MIN_COLS) runs.push([i, j]);
    i = j;
  }

  const tables: SymbolTable[] = [];
  const cut: Array<[number, number]> = [];

  for (let r = 0; r < runs.length; ) {
    const cols = runs[r][1] - runs[r][0];
    // Extend while the next run has the same width and a short name between.
    let last = r;
    while (
      last + 1 < runs.length &&
      runs[last + 1][1] - runs[last + 1][0] === cols &&
      runs[last + 1][0] - runs[last][1] >= 1 &&
      runs[last + 1][0] - runs[last][1] <= MAX_ROW_NAME_TOKENS
    ) {
      last++;
    }

    const rowCount = last - r + 1;
    const prevEnd = r > 0 ? runs[r - 1][1] : 0;
    const before = tokens.slice(prevEnd, runs[r][0]);
    const split = rowCount >= MIN_ROWS ? splitHeader(before, cols) : null;

    if (split) {
      const rows = [{ name: split.firstRow, cells: tokens.slice(runs[r][0], runs[r][1]) }];
      for (let k = r + 1; k <= last; k++) {
        rows.push({
          name: tokens.slice(runs[k - 1][1], runs[k][0]).join(" "),
          cells: tokens.slice(runs[k][0], runs[k][1]),
        });
      }
      tables.push({ headers: split.headers, rows });
      const firstRowLen = split.firstRow.split(" ").length;
      cut.push([runs[r][0] - firstRowLen - cols, runs[last][1]]);
    }
    r = last + 1;
  }

  let prose = tokens;
  for (const [a, b] of [...cut].reverse()) prose = [...prose.slice(0, a), ...prose.slice(b)];
  return { tables, prose: prose.join(" ") };
}

function mentions(text: string, terms: string[]): boolean {
  const words = text.toLowerCase().split(/[\s/,()-]+/);
  return terms.some((t) => words.some((w) => w.startsWith(t)));
}

/**
 * Keep only tables the question is about: a row or a column it names. Rows
 * are cut to the ones it names when there are any (the chromophobe-vs-
 * oncocytoma question needs 2 of 6 rows), which keeps the answer prompt small.
 */
export function relevantTables(
  tables: SymbolTable[],
  terms: string[]
): Array<SymbolTable & { focusRows: string[] }> {
  const out: Array<SymbolTable & { focusRows: string[] }> = [];
  for (const t of tables) {
    // A term naming most rows ("rcc" in an RCC panel) singles nothing out.
    const telling = terms.filter(
      (term) => t.rows.filter((r) => mentions(r.name, [term])).length <= t.rows.length / 2
    );
    const focus = t.rows.filter((r) => mentions(r.name, telling)).map((r) => r.name);
    if (focus.length > 0 || t.headers.some((h) => mentions(h, terms))) {
      out.push({ ...t, focusRows: focus });
    }
  }
  return out;
}

/** One line per row — "Oncocytoma: Hale -, KIT +++, CK7 rare" — which small models read correctly. */
export function tableToPromptLines(table: SymbolTable, onlyRows?: string[]): string {
  const rows =
    onlyRows && onlyRows.length > 0
      ? table.rows.filter((r) => onlyRows.includes(r.name))
      : table.rows;
  return rows
    .map((r) => `${r.name}: ${r.cells.map((c, i) => `${table.headers[i]} ${c}`).join(", ")}`)
    .join("; ");
}
