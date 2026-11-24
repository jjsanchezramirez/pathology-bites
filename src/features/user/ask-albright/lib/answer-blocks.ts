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
 */

export type AnswerBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; title: string | null; items: string[]; inline: boolean }
  | { kind: "table"; header: string[]; rows: string[][] };

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
  if (p.endsWith(":") && p.length <= 60 && (body.startsWith("**") || !BULLET.test(line))) {
    return p.slice(0, -1).trim();
  }
  return null;
}

function listBlock(title: string | null, items: string[]): AnswerBlock {
  // Mostly-short panels flow inline; one longer note ("CAIX (diffuse,
  // membranous in 75–100%)") shouldn't push the whole panel back to one per line.
  const lens = items.map((it) => plain(it).length);
  const inline =
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

export function parseAnswerBlocks(text: string): AnswerBlock[] {
  const lines = text
    .split(/\n+/)
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
      if (rows.length >= 2) {
        const width = rows[0].length;
        blocks.push({
          kind: "table",
          header: rows[0],
          rows: rows.slice(1).map((r) => Array.from({ length: width }, (_, k) => r[k] ?? "")),
        });
      } else {
        blocks.push({ kind: "p", text: group.join(" ") });
      }
      continue;
    }
    const title = headingOf(lines[i]);
    if (title !== null) {
      i++;
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i]) && headingOf(lines[i]) === null) {
        items.push(lines[i++].replace(BULLET, "").trim());
      }
      blocks.push(items.length ? listBlock(title, items) : { kind: "p", text: `**${title}**` });
      continue;
    }
    if (isBullet(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i]) && headingOf(lines[i]) === null) {
        items.push(lines[i++].replace(BULLET, "").trim());
      }
      blocks.push(listBlock(null, items));
      continue;
    }
    blocks.push({ kind: "p", text: line });
    i++;
  }
  return blocks;
}
