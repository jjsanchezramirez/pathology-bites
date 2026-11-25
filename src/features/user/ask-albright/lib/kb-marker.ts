import "server-only";

import { KNOWLEDGE_PAGES_ENABLED } from "@/features/public/knowledge/lib/enabled";
import { callOpenAICompatText } from "@/shared/services/openai-compat";
import { createClient } from "@/shared/services/server";
import { log } from "@/shared/utils/logging";

/**
 * A marker's IHC profile from the Pathology Bites knowledge base, as one
 * passage for marker questions ("TTF-1 positive tumors").
 *
 * PathTalk does not index PathologyOutlines' stain pages, so text sources only
 * list the few tumours their diagnosis pages mention. The knowledge base pools
 * WHO-derived, cited evidence per marker × tumour (`marker_summary`: TTF-1 is
 * positive in 69 tumours, negative in 35). It has no normal-tissue data.
 *
 * The lists are long and the knowledge base can't rank them by importance
 * (source counts are 1–4; lung adenocarcinoma had 1 for TTF-1). Handed all of
 * them, the answer model printed every name; grouped by WHO volume, the
 * groups were wrong (a tumour sits in several volumes). So one small call
 * picks the tumours a pathologist most often meets, by id — so only tumours
 * from the lists can survive — and the passage carries just those.
 *
 * Never throws and never waits long: a profile improves an answer but must
 * not hold it.
 */

export interface MarkerProfile {
  title: string;
  href: string;
  text: string;
  /** Workers AI tokens the selection call used. */
  tokens: number;
}

interface SummaryRow {
  entity_id: string;
  call: string;
  pooled_pct: number | null;
  sources: number | null;
}

const TIMEOUT_MS = 2500;
/** What the selection call sees (best-sourced first): every tumour for common markers (GATA3 has 73 positive; at 60, urothelial carcinoma was cut). */
const MAX_POSITIVE = 120;
const MAX_NEGATIVE = 40;
/** What the answer gets. */
const PICK_POSITIVE = 12;
const PICK_NEGATIVE = 8;
/**
 * gpt-oss-120b, not the answer model: on the same numbered lists (Nov 2026)
 * mistral-small left lung adenocarcinoma out of TTF-1's picks and filled them
 * with rarities; gpt-oss led with it on every run (3–5 s at low reasoning
 * effort, in parallel with the search; ~1.5k tokens).
 */
const SELECT_MODEL = "@cf/openai/gpt-oss-120b";

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

/** Ask for the tumours most met in practice; fall back to the ranked heads. */
async function selectKey(
  marker: string,
  positive: string[],
  negative: string[],
  apiKey: string
): Promise<{ positive: string[]; negative: string[]; tokens: number }> {
  const heads = {
    positive: positive.slice(0, PICK_POSITIVE),
    negative: negative.slice(0, PICK_NEGATIVE),
  };
  if (positive.length <= PICK_POSITIVE && negative.length <= PICK_NEGATIVE) {
    return { ...heads, tokens: 0 };
  }
  try {
    const res = await callOpenAICompatText(
      "cloudflare",
      SELECT_MODEL,
      apiKey,
      `Marker: ${marker}\nPositive in:\n${numbered(positive, "P")}\nNegative in:\n${numbered(negative, "N")}`,
      {
        system: `From these lists, pick the tumours this immunostain is ordered for in everyday practice: the commonest tumours and the ones in standard diagnostic panels, up to ${PICK_POSITIVE} positive and up to ${PICK_NEGATIVE} negative, most important first. One per tumour family: skip variants and near-duplicates of a tumour already picked, and rare entities while common ones remain. Reply with JSON only, listing ids: {"positive":["P1",...],"negative":["N1",...]}`,
        maxTokens: 1500,
        temperature: 0,
        timeoutMs: 10_000,
        jsonMode: true,
      }
    );
    const j = JSON.parse(res.content.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    const pos = keepPicked(j.positive, positive, "P", PICK_POSITIVE);
    const neg = keepPicked(j.negative, negative, "N", PICK_NEGATIVE);
    return {
      positive: pos.length ? pos : heads.positive,
      negative: neg.length ? neg : heads.negative,
      tokens: res.tokenUsage?.total_tokens ?? 0,
    };
  } catch (err) {
    log.warn("[ask-albright] marker selection failed; using best-sourced tumours", err);
    return { ...heads, tokens: 0 };
  }
}

export async function markerProfile(
  marker: { id?: string; slug?: string; name: string },
  apiKey: string
): Promise<MarkerProfile | null> {
  if (!marker.id) return null;
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("marker_summary")
      .select("entity_id, call, pooled_pct, sources")
      .eq("marker_id", marker.id)
      .in("call", ["positive", "negative", "mixed", "loss", "retained"])
      .order("entity_id")
      .limit(500)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
    if (error) throw error;
    const rows = (data ?? []) as SummaryRow[];
    if (rows.length === 0) return null;

    const ids = [...new Set(rows.map((r) => r.entity_id))].slice(0, 400);
    const ents = await sb
      .from("entities")
      .select("id, name")
      .in("id", ids)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
    if (ents.error) throw ents.error;
    const names = new Map(
      ((ents.data ?? []) as Array<{ id: string; name: string }>).map((e) => [e.id, e.name])
    );

    const lists = profileLists(rows, names);
    if (lists.positive.length + lists.negative.length === 0) return null;
    const { positive, negative, tokens } = await selectKey(
      marker.name,
      lists.positive,
      lists.negative,
      apiKey
    );
    const text = [
      `${marker.name} in the Pathology Bites knowledge base (WHO-derived evidence, pooled across sources; tumours only, no normal-tissue data).`,
      positive.length ? `Positive in tumours: ${positive.join("; ")}.` : "",
      negative.length ? `Negative in tumours: ${negative.join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return {
      title: `${marker.name} — knowledge base`,
      // The marker page when knowledge pages are live; the IHC panel tool otherwise.
      href: KNOWLEDGE_PAGES_ENABLED && marker.slug ? `/m/${marker.slug}` : "/tools/ihc",
      text,
      tokens,
    };
  } catch (err) {
    log.warn("[ask-albright] knowledge-base marker profile failed; continuing without", err);
    return null;
  }
}
