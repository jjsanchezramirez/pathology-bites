/**
 * Split a model answer into the few Markdown shapes the card renders, in the
 * order they appear: paragraphs, labelled lists and pipe tables. Asked for a
 * comparison, the model writes a Markdown table; rendered as one paragraph it
 * showed raw pipes. Anything else stays plain text. Pure, so it is testable.
 *
 * Lists come back as labelled groups. A "**Positive stains:**" line (bulleted,
 * plain or "###") is the group's title, not an item, and every bullet under
 * it — at any indent — belongs to it. A group of 3+ short items (a stain
 * panel) is marked `inline`, to flow on one line instead of one per row: the
 * CCRCC immunophenotype ran to 25 single-word bullets.
 *
 * `streaming`: the text is still arriving. A table row being written is held
 * back (it showed as raw "| CD30 | Posi" text), a table is shown from its
 * header on, and a table still at the end of the text is marked `pending`.
 */

export type AnswerBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; title: string | null; items: string[]; inline: boolean }
  | { kind: "table"; header: string[]; rows: string[][]; pending?: boolean };

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;
/** Short enough to flow inline (citations and bold don't count). */
const INLINE_ITEM_MAX = 40;
const INLINE_ITEM_HARD_MAX = 80;

const plain = (s: string) =>
  s
    .replace(/\[\d(?:,\s*\d)*\]/g, "")
    .replace(/\*\*/g, "")
    .trim();

/** "**Positive stains:**", "- **Negative:**", "### Genetics" → the label; else null. */
function headingOf(line: string): string | null {
  const md = line.match(/^\s*#{1,6}\s+(.+)$/);
  if (md) return plain(md[1]).replace(/:$/, "");
  const body = line.replace(BULLET, "").trim();
  const p = plain(body);
  // "- Essential:" is a title even unbolded: the criteria format's labels,
  // which the model sometimes writes as plain bullets.
  const criteriaLabel = /^(essential|desirable):$/i.test(p);
  if (
    p.endsWith(":") &&
    p.length <= 60 &&
    (body.startsWith("**") || !BULLET.test(line) || criteriaLabel)
  ) {
    return p.slice(0, -1).trim();
  }
  return null;
}

/** A table cell that says nothing ("not stated", "—", "N/A"); citations ignored. */
const EMPTY_CELL =
  /^(?:not stated|not reported|not mentioned|not covered|n\/a|na|none|unknown|[-–—?]|)\.?$/i;

/**
 * Rows where no item has a value are filler: "CD274 | not stated | not stated |
 * not stated" ran to eight such rows in a CHL / NLPHL / PMBL table. A row
 * saying something for even one item stays — that gap is information.
 */
export function dropEmptyRows(rows: string[][]): string[][] {
  return rows.filter((r) => r.slice(1).some((c) => !EMPTY_CELL.test(plain(c))));
}

/** Placeholder bullets the model writes for empty groups ("- None"). */
const EMPTY_ITEM = /^(none|not stated|n\/a|nil|none reported|none mentioned)\.?$/i;

const CITES_AT_END = /\s*((?:\[\d+(?:,\s*\d+)*\]\s*)+)\.?$/;

/**
 * Consecutive criteria bullets that repeat one lead-in become one bullet:
 * "Immunophenotype of HRS cells: CD30+ [2]", "…: PAX5+ [2]" →
 * "Immunophenotype of HRS cells: CD30+, PAX5+ [2]". The model splits a WHO
 * criterion this way on some runs whatever the prompt says.
 */
export function mergeLeadIns(items: string[]): string[] {
  const out: string[] = [];
  let lead: string | null = null;
  let parts: string[] = [];
  let cites: string[] = [];
  let first = "";
  const flush = () => {
    if (lead === null) return;
    // A lead-in that occurs once is left exactly as written.
    if (parts.length === 1) {
      out.push(first);
      lead = null;
      parts = [];
      cites = [];
      return;
    }
    const uniq = [...new Set(cites)];
    const c = uniq.length ? `[${uniq.join(", ")}]` : "";
    out.push(`${lead}: ${parts.join(", ")}${c ? ` ${c}` : ""}`);
    lead = null;
    parts = [];
    cites = [];
  };
  for (const item of items) {
    const m = item.match(/^([^:]{3,50}):\s+(.+)$/);
    if (!m) {
      flush();
      out.push(item);
      continue;
    }
    const cite = m[2].match(CITES_AT_END);
    const body = cite ? m[2].slice(0, cite.index).trim() : m[2].trim();
    const nums = cite ? (cite[1].match(/\d+/g) ?? []) : [];
    if (lead !== m[1]) {
      flush();
      first = item;
    }
    lead = m[1];
    parts.push(body.replace(/[.;]$/, ""));
    cites.push(...nums);
  }
  flush();
  return out;
}

function listBlock(title: string | null, items: string[]): AnswerBlock {
  if (/^(essential|desirable)$/i.test(title ?? "")) items = mergeLeadIns(items);
  // Mostly-short panels flow inline; one longer note ("CAIX (diffuse,
  // membranous in 75–100%)") shouldn't push the whole panel back to one per line.
  const lens = items.map((it) => plain(it).length);
  // Criteria are read one per line, never flowed ("Essential" / "Desirable").
  const inline =
    !/^(essential|desirable)$/i.test(title ?? "") &&
    items.length >= 3 &&
    lens.filter((n) => n <= INLINE_ITEM_MAX).length >= items.length * 0.75 &&
    lens.every((n) => n <= INLINE_ITEM_HARD_MAX);
  return { kind: "list", title, items, inline };
}

const isTableLine = (l: string) => l.startsWith("|") && l.endsWith("|") && l.length > 2;
const isSeparator = (l: string) => /^\|(\s*:?-{3,}:?\s*\|)+$/.test(l);

function cells(line: string): string[] {
  return line
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

export function parseAnswerBlocks(
  text: string,
  { streaming = false }: { streaming?: boolean } = {}
): AnswerBlock[] {
  const raw = text.split(/\n+/);
  // The last line has no newline yet: if it is a table row, it is half written.
  if (streaming && !/\n\s*$/.test(text) && raw[raw.length - 1]?.trim().startsWith("|")) raw.pop();
  const lines = raw
    // Indentation is dropped: a group is everything under its label, so
    // nesting depth adds nothing (and splitting on it produced empty lines).
    .map((l) => l.trim())
    .filter(Boolean)
    // Bullets sometimes arrive run together on one line ("… foo. - Bar …").
    .flatMap((l) => (isTableLine(l) ? [l] : l.split(/\s+(?=- [A-Z*])/)))
    .filter(Boolean);

  const blocks: AnswerBlock[] = [];
  const isBullet = (l: string) => BULLET.test(l);
  for (let i = 0; i < lines.length; ) {
    const line = lines[i].trim();
    if (isTableLine(line)) {
      const group: string[] = [];
      while (i < lines.length && isTableLine(lines[i].trim())) group.push(lines[i++].trim());
      const rows = group.filter((l) => !isSeparator(l)).map(cells);
      // A real table has a header and at least one row; otherwise keep the text.
      // While streaming, the header alone is enough: the rows are on their way.
      const width = rows[0]?.length ?? 0;
      const body = dropEmptyRows(
        rows.slice(1).map((r) => Array.from({ length: width }, (_, k) => r[k] ?? ""))
      );
      if (body.length >= 1 || (streaming && rows.length >= 1 && width >= 2)) {
        blocks.push({ kind: "table", header: rows[0], rows: body });
      } else if (rows.length < 2) {
        blocks.push({ kind: "p", text: group.join(" ") });
      }
      // else: a real table whose every row was filler — nothing to show.
      continue;
    }
    const title = headingOf(lines[i]);
    if (title !== null) {
      i++;
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i]) && headingOf(lines[i]) === null) {
        items.push(lines[i++].replace(BULLET, "").trim());
      }
      const real = items.filter((it) => !EMPTY_ITEM.test(plain(it)));
      // A group that only said "None" is dropped; a bare label stays as text.
      if (real.length) blocks.push(listBlock(title, real));
      else if (!items.length) blocks.push({ kind: "p", text: `**${title}**` });
      continue;
    }
    if (isBullet(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i]) && headingOf(lines[i]) === null) {
        items.push(lines[i++].replace(BULLET, "").trim());
      }
      const real = items.filter((it) => !EMPTY_ITEM.test(plain(it)));
      if (real.length) blocks.push(listBlock(null, real));
      continue;
    }
    blocks.push({ kind: "p", text: line });
    i++;
  }
  const last = blocks[blocks.length - 1];
  if (streaming && last?.kind === "table") last.pending = true;
  return blocks;
}

/** A run of inline text, or a link to a page on this site. */
export type InlinePiece = { text: string; href?: string };

/**
 * Split text into plain runs and in-site links: Markdown `[label](/path)` and
 * the bare words "About page" (the small-talk prompt names it). Only paths on
 * this site (starting with one "/") become links — an answer must never send a
 * reader off-site through a model-written URL; anything else stays plain text.
 */
export function inlineLinks(text: string): InlinePiece[] {
  const out: InlinePiece[] = [];
  const re = /\[([^\]\n]{1,80})\]\((\/(?!\/)[\w\-./?=&#%]*)\)|\bAbout page\b/gi;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push(m[1] ? { text: m[1], href: m[2] } : { text: m[0], href: "/about" });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/**
 * Long lines read better in a wider card: true when a bullet runs past ~70
 * characters or the answer is long overall (WHO criteria wrapped to three
 * or four lines per bullet in the 400px card). Citations and bold don't count.
 */
export function hasLongLines(blocks: AnswerBlock[]): boolean {
  let total = 0;
  for (const b of blocks) {
    if (b.kind === "list") {
      for (const it of b.items) {
        const n = plain(it).length;
        if (n > 70) return true;
        total += n;
      }
    } else if (b.kind === "p") total += plain(b.text).length;
  }
  return total > 450;
}
