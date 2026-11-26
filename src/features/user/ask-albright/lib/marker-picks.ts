/**
 * Marker profiles — the pure half, shared by the app (kb-marker.ts) and the
 * offline picker (dev/scripts/ask-albright/precompute-marker-picks.mts), which
 * cannot import server-only modules.
 *
 * The knowledge base lists every tumour a marker stains (TTF-1: 69 positive)
 * and cannot rank them by importance (source counts are 1–4). A model picks
 * the ones a pathologist meets in practice — ONCE, offline, stored in
 * public.marker_key_tumours — so an answer never pays for that call.
 */

export interface SummaryRow {
  entity_id: string;
  call: string;
  pooled_pct: number | null;
  sources: number | null;
}

/** What the selection call sees (best-sourced first): every tumour for common markers (GATA3 has 73 positive; at 60, urothelial carcinoma was cut). */
const MAX_POSITIVE = 120;
const MAX_NEGATIVE = 40;
/** What the answer gets. */
export const PICK_POSITIVE = 12;
export const PICK_NEGATIVE = 8;
/**
 * gpt-oss-120b, not the answer model: on the same numbered lists (Nov 2026)
 * mistral-small left lung adenocarcinoma out of TTF-1's picks and filled them
 * with rarities; gpt-oss led with it on every run. It took 3–8 s and ~0.1¢ a
 * question when it ran per answer, so it now runs once per marker, offline.
 */
// Exported for dev/scripts/ask-albright/precompute-marker-picks.mts (gitignored, so knip can't see it).
export const SELECT_MODEL = "@cf/openai/gpt-oss-120b";

/** Positive/negative tumour lists from summary rows, best-sourced first (pure). */
export function profileLists(
  rows: SummaryRow[],
  names: Map<string, string>
): { positive: string[]; negative: string[] } {
  const ranked = [...rows].sort(
    (a, b) => (b.sources ?? 0) - (a.sources ?? 0) || (b.pooled_pct ?? -1) - (a.pooled_pct ?? -1)
  );
  const seen = new Set<string>();
  const positive: string[] = [];
  const negative: string[] = [];
  for (const r of ranked) {
    const name = names.get(r.entity_id)?.replace(/:\s*general overview$/i, "");
    if (!name || seen.has(name.toLowerCase())) continue;
    const pct = r.pooled_pct != null ? ` (${Math.round(r.pooled_pct)}%)` : "";
    if ((r.call === "positive" || r.call === "retained") && positive.length < MAX_POSITIVE) {
      positive.push(`${name}${pct}`);
    } else if (r.call === "mixed" && positive.length < MAX_POSITIVE) {
      positive.push(`${name} (variable)`);
    } else if ((r.call === "negative" || r.call === "loss") && negative.length < MAX_NEGATIVE) {
      negative.push(`${name}${r.call === "loss" ? " (loss)" : ""}`);
    } else continue;
    seen.add(name.toLowerCase());
  }
  return { positive, negative };
}

/**
 * Map picked ids ("P3", "N1") back to list items, in the order picked, up to
 * `max`; ids outside the list or of the other prefix are dropped (pure). Ids,
 * not names: asked for names, the model shortened them ("Breast carcinoma"
 * for "Invasive breast carcinoma (100%)") and exact matching lost the two
 * tumours GATA3 is known for.
 */
export function keepPicked(
  picked: unknown,
  list: string[],
  prefix: "P" | "N",
  max: number
): string[] {
  if (!Array.isArray(picked)) return [];
  const out: string[] = [];
  for (const p of picked) {
    const m = String(p)
      .trim()
      .match(new RegExp(`^${prefix}?(\\d+)$`, "i"));
    const item = m ? list[Number(m[1]) - 1] : undefined;
    if (item && !out.includes(item)) out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

/** "P1 name\nP2 name…" — the numbered list the picker sees (pure). */
export function numbered(list: string[], prefix: "P" | "N"): string {
  return list.map((x, i) => `${prefix}${i + 1} ${x}`).join("\n");
}

/** The picker's instructions (numbered ids, so only listed tumours can come back). */
export const SELECT_SYSTEM = `From these lists, pick the tumours this immunostain is ordered for in everyday practice: the commonest tumours and the ones in standard diagnostic panels, up to ${PICK_POSITIVE} positive and up to ${PICK_NEGATIVE} negative, most important first. One per tumour family: skip variants and near-duplicates of a tumour already picked, and rare entities while common ones remain. Reply with JSON only, listing ids: {"positive":["P1",...],"negative":["N1",...]}`;

/** The picker's prompt for one marker. */
export function selectPrompt(marker: string, positive: string[], negative: string[]): string {
  return `Marker: ${marker}\nPositive in:\n${numbered(positive, "P")}\nNegative in:\n${numbered(negative, "N")}`;
}

/** Whether a marker's lists are long enough that picking matters. */
export function needsPick(positive: string[], negative: string[]): boolean {
  return positive.length > PICK_POSITIVE || negative.length > PICK_NEGATIVE;
}

/** "Invasive breast carcinoma (100%)" -> "invasive breast carcinoma": the name a pick is stored by. */
export function itemName(item: string): string {
  return item
    .replace(/\s*\((?:\d+%|variable|loss)\)\s*$/i, "")
    .trim()
    .toLowerCase();
}

/**
 * The tumours to show: the stored picks that are still in the live list (in
 * pick order, with the live list's % labels), topped up from the best-sourced
 * head when picks are missing or have dropped out (pure).
 */
export function applyPicks(list: string[], picks: string[] | undefined, max: number): string[] {
  const byName = new Map(list.map((item) => [itemName(item), item]));
  const out: string[] = [];
  for (const p of picks ?? []) {
    const item = byName.get(itemName(p));
    if (item && !out.includes(item)) out.push(item);
    if (out.length >= max) return out;
  }
  if (out.length > 0) return out;
  return list.slice(0, max);
}
