/**
 * Ask Dr. Albright — the one visual an answer may carry. Pure: the lookups
 * that feed these live in ask.ts.
 *
 * The cascade, chosen by the planner's `visual` (planner.ts PlanVisual):
 *   diagram → a Mermaid flowchart the answer model writes after its answer,
 *             restating only the answer's steps; if it is missing or
 *             malformed → a published figure.
 *   images  → up to MAX_IMAGES images from the site's own library (licence
 *             clean, credited); if none match → a published figure.
 *   none    → nothing, and no lookups.
 * A published figure (PathTalk figure search) is only ever a fallback, and is
 * shown as a linked card (legend + paper), never embedded: copyright on
 * literature figures belongs to the publishers.
 */

export interface AskImage {
  url: string;
  alt: string;
  /** Source/credit line from the library. */
  credit: string | null;
}

export type AskVisual =
  | { kind: "diagram"; code: string }
  | { kind: "images"; images: AskImage[] }
  | { kind: "figure"; legend: string; href: string; doi?: string };

export const MAX_IMAGES = 3;
/** Output room the diagram may add to the answer (held against the cost cap). */
export const DIAGRAM_TOKENS = 260;

/**
 * Appended to the answer's system prompt for diagram questions. Generic on
 * purpose: concrete markers or numbers in instructions leak into answers.
 */
export const DIAGRAM_INSTRUCTION =
  'After the answer, always add a Mermaid flowchart of it in a ```mermaid code block: first line "flowchart TD"; at most 10 nodes; every label in double quotes and under 8 words; decisions as {"...?"} with labelled edges such as -->|Yes| and -->|No|. Draw exactly the steps and outcomes your answer states and nothing else; when the answer gives only part of a scheme, draw only that part. No citations in the diagram. Put the Follow-ups line after the code block.';

const FENCE = /```\s*mermaid\s*\n([\s\S]*?)(```|$)/i;

/**
 * Split the model's ```mermaid block off its answer. A block cut off by the
 * token cap (no closing fence) is removed and yields no diagram.
 */
export function splitDiagram(text: string): { text: string; code: string | null } {
  const m = text.match(FENCE);
  if (!m || m.index === undefined) return { text, code: null };
  const closed = m[2] === "```";
  const rest = (text.slice(0, m.index) + text.slice(m.index + m[0].length))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: rest, code: closed ? validDiagram(m[1]) : null };
}

/** A node as the model wrote it: `A`, `A["x"]`, `A{"x"}`, `["x"]`, `{"x"}`, `"x"`. */
const NODE =
  /^\s*([A-Za-z][\w]*)?\s*(?:(\[\[|\[\(|\(\(|\[|\{\{|\{|\(|>)\s*"?([^"\]}\)]*?)"?\s*(\]\]|\)\]|\)\)|\]|\}\}|\}|\))|"([^"]*)")?\s*$/;
const ARROW =
  /\s*-{2,}>\s*(?:\|\s*"?([^|"]*?)"?\s*\|\s*)?|\s*-{2,}\s*"?([^>"-][^>"]*?)"?\s*-{2,}>\s*/;

/** Label text safe for a quoted Mermaid label: no quotes, brackets, pipes or markup. */
function cleanLabel(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/["`|[\]{}()<>#;]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Rebuild the model's flowchart as canonical Mermaid, or null. The model
 * writes near-Mermaid (`"DLBCL" --> {"CD10+"}`: no node ids, which Mermaid
 * rejects), so instead of trusting its syntax every edge is parsed, each label
 * gets one id, decisions keep their diamond, and everything else — styling,
 * click handlers, comments, other diagram types — is dropped. Only plain
 * labelled nodes and edges reach the renderer.
 */
export function validDiagram(raw: string): string | null {
  const lines = raw
    .replace(/\[\d+(?:,\s*\d+)*\]/g, "") // citations inside labels
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!/^(flowchart|graph)\s+(TD|TB|LR)\b/i.test(lines[0] ?? "")) return null;
  if (raw.length > 3000) return null;

  const ids = new Map<string, string>(); // model id or label key → our id
  const nodes = new Map<string, { label: string; decision: boolean }>();
  const edges: string[] = [];
  const node = (token: string): string | null => {
    const m = token.match(NODE);
    if (!m) return null;
    const [, modelId, open, inner, , bare] = m;
    const labelRaw = inner ?? bare;
    const label = labelRaw !== undefined ? cleanLabel(labelRaw) : "";
    if (!modelId && !label) return null;
    const key = modelId ? `id:${modelId}` : `label:${label.toLowerCase()}`;
    let id = ids.get(key) ?? (label ? ids.get(`label:${label.toLowerCase()}`) : undefined);
    if (!id) {
      id = `n${nodes.size + 1}`;
      nodes.set(id, { label: label || modelId!, decision: open === "{" || open === "{{" });
    } else if (label && nodes.get(id)!.label === modelId) {
      nodes.set(id, { label, decision: open === "{" || open === "{{" }); // first sighting was a bare id
    }
    ids.set(key, id);
    if (label) ids.set(`label:${label.toLowerCase()}`, id);
    if (modelId) ids.set(`id:${modelId}`, id);
    return id;
  };

  for (const line of lines.slice(1)) {
    // A chain "A --> B -->|x| C": alternate node, arrow, node…
    const parts: string[] = [];
    const labels: string[] = [];
    let rest = line.replace(/;$/, "");
    for (;;) {
      const m = rest.match(ARROW);
      if (!m || m.index === undefined) {
        parts.push(rest);
        break;
      }
      parts.push(rest.slice(0, m.index));
      labels.push(cleanLabel(m[1] ?? m[2] ?? ""));
      rest = rest.slice(m.index + m[0].length);
    }
    if (parts.length < 2) {
      node(line); // a lone node definition: register its label for later edges
      continue;
    }
    const chain = parts.map(node);
    if (chain.some((x) => x === null)) continue;
    for (let i = 0; i < labels.length; i++) {
      edges.push(`  ${chain[i]} --${labels[i] ? `>|${labels[i]}|` : ">"} ${chain[i + 1]}`);
    }
  }
  if (edges.length < 2 || nodes.size > 16) return null;
  const defs = [...nodes].map(([id, n]) =>
    n.decision ? `  ${id}{"${n.label}"}` : `  ${id}["${n.label}"]`
  );
  return ["flowchart TD", ...defs, ...edges].join("\n");
}

/**
 * Whether a figure legend is about the question: most (≥60%) of the key
 * terms appear in it. Legends are long, so a single shared word is not enough.
 */
export function legendCovers(legend: string, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const l = legend.toLowerCase();
  const hit = terms.filter((t) =>
    new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(l)
  ).length;
  return hit / terms.length >= 0.6;
}

/** Words that name the kind of question, not the diagnosis ("histology of X"). */
const NOT_A_NAME =
  /\b(what|does|do|look|looks|like|appearance|histology|histologic|morphology|morphologic|gross|cytology|cytologic|microscopic|features?|immunostains?|ihc|stains?|images?|pictures?|show|of|the|a|an|in)\b/gi;

/** The diagnosis to look up images for: the planner's first item, else its query minus question words. */
export function imageSubject(items: string[], query: string): string {
  if (items[0]) return items[0];
  return query
    .replace(/\bh\s*(&|and)\s*e\b|\bh&e\b/gi, " ") // "on H&E" names the stain, not the diagnosis
    .replace(NOT_A_NAME, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The library images that are really of the subject, best first. Full-text
 * search matches the subject's words anywhere in an image's text, so "gross
 * appearance of clear cell RCC" returned ELOC-mutated and TFE3-rearranged RCC.
 * An image's title (alt text) must contain every word of the subject (or of
 * an alias); a question about gross appearance puts gross images first.
 */
export function pickImages<T extends { alt_text: string | null; category: string | null }>(
  images: T[],
  names: string[],
  question: string
): T[] {
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(/tumour/g, "tumor")
      .match(/[a-z0-9]+/g)
      ?.filter((w) => w.length >= 3) ?? [];
  // The subject drops its parentheticals ("(MCL)"); a title keeps them, so a
  // question that says "DLBCL" still matches "Diffuse large B cell lymphoma (DLBCL)".
  const wanted = names.map((n) => words(n.replace(/\([^)]*\)/g, " "))).filter((w) => w.length > 0);
  const named = images.filter((im) => {
    const title = new Set(words(im.alt_text ?? ""));
    return wanted.some((ws) => ws.every((w) => title.has(w)));
  });
  const prefer = /\bgross|macroscop|cut surface/i.test(question) ? "gross" : "microscopic";
  return [...named].sort((a, b) => Number(b.category === prefer) - Number(a.category === prefer));
}

/**
 * A short credit line. Library credits are sometimes a whole (mangled) URL —
 * "https:-www.virtualpathology.leeds.ac.uk:slides:library:view.php?path=…" —
 * which is shown as its site name; anything else is kept, trimmed.
 */
export function shortCredit(credit: string | null): string | null {
  if (!credit) return null;
  const c = credit.trim();
  if (/^(https?[:/-]|www\.)/i.test(c)) {
    const host = c
      .replace(/^https?[:/-]*/i, "")
      .replace(/^www\./i, "")
      .match(/^([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i);
    return host ? host[1].toLowerCase() : null;
  }
  return c.length > 80 ? `${c.slice(0, 79).trimEnd()}…` : c;
}

/** Shorten a legend for the card, at a sentence end where possible. */
export function shortLegend(legend: string, max = 280): string {
  const flat = legend.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const end = cut.lastIndexOf(". ");
  return `${end > max * 0.5 ? cut.slice(0, end + 1) : cut.trimEnd()}…`;
}
