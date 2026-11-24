/**
 * Split a model answer into the few Markdown shapes the card renders, in the
 * order they appear: paragraphs, bullet lists and pipe tables. Asked for a
 * comparison, the model writes a Markdown table; rendered as one paragraph it
 * showed raw pipes. Anything else stays plain text. Pure, so it is testable.
 */

export type AnswerBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] };

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
    .map((l) => l.trim())
    .filter(Boolean)
    // Bullets sometimes arrive run together on one line ("… foo. - Bar …").
    .flatMap((l) => (isTableLine(l) ? [l] : l.split(/\s+(?=- [A-Z*])/)));

  const blocks: AnswerBlock[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (isTableLine(line)) {
      const group: string[] = [];
      while (i < lines.length && isTableLine(lines[i])) group.push(lines[i++]);
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
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) items.push(lines[i++].slice(2));
      blocks.push({ kind: "ul", items });
      continue;
    }
    blocks.push({ kind: "p", text: line });
    i++;
  }
  return blocks;
}
