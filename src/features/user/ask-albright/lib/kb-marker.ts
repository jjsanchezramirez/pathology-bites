import "server-only";

import { KNOWLEDGE_PAGES_ENABLED } from "@/features/public/knowledge/lib/enabled";
import { createClient } from "@/shared/services/server";
import { log } from "@/shared/utils/logging";
import {
  PICK_NEGATIVE,
  PICK_POSITIVE,
  type SummaryRow,
  applyPicks,
  profileLists,
} from "./marker-picks";

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
 * groups were wrong (a tumour sits in several volumes). So a model picks the
 * tumours a pathologist most often meets — once per marker, offline (see
 * marker-picks.ts) — and the passage carries just those; a marker without
 * stored picks gets its best-sourced tumours. No model call at answer time.
 *
 * Never throws and never waits long: a profile improves an answer but must
 * not hold it.
 */

export interface MarkerProfile {
  title: string;
  href: string;
  text: string;
  /** Model tokens the profile used (always 0: picks are precomputed). */
  tokens: number;
}

const TIMEOUT_MS = 2500;

/** Stored picks for a marker (public.marker_key_tumours); none on any failure. */
async function storedPicks(
  sb: Awaited<ReturnType<typeof createClient>>,
  markerId: string
): Promise<{ positive?: string[]; negative?: string[] }> {
  try {
    const { data, error } = await sb
      .from("marker_key_tumours" as never)
      .select("positive, negative")
      .eq("marker_id", markerId)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS))
      .maybeSingle();
    if (error) throw error;
    return (data as { positive?: string[]; negative?: string[] } | null) ?? {};
  } catch (err) {
    log.warn("[ask-albright] stored marker picks unavailable; using best-sourced tumours", err);
    return {};
  }
}

export async function markerProfile(marker: {
  id?: string;
  slug?: string;
  name: string;
}): Promise<MarkerProfile | null> {
  if (!marker.id) return null;
  try {
    const sb = await createClient();
    const picksPromise = storedPicks(sb, marker.id);
    const { data, error } = await sb
      .from("marker_summary")
      .select("entity_id, call, pooled_pct, sources")
      .eq("marker_id", marker.id)
      .in("call", ["positive", "negative", "mixed", "loss", "retained", "aberrant", "wildtype"])
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
    if (
      lists.positive.length +
        lists.negative.length +
        lists.aberrant.length +
        lists.wildtype.length ===
      0
    )
      return null;
    const picks = await picksPromise;
    const positive = applyPicks(lists.positive, picks.positive, PICK_POSITIVE);
    const negative = applyPicks(lists.negative, picks.negative, PICK_NEGATIVE);
    const text = [
      `${marker.name} in the Pathology Bites knowledge base (WHO-derived evidence, pooled across sources; tumours only, no normal-tissue data).`,
      positive.length ? `Positive in tumours: ${positive.join("; ")}.` : "",
      negative.length ? `Negative in tumours: ${negative.join("; ")}.` : "",
      // p53-style stains: the pattern, not presence, is the finding.
      lists.aberrant.length
        ? `Aberrant (mutation-type) pattern in tumours: ${lists.aberrant.slice(0, PICK_NEGATIVE).join("; ")}.`
        : "",
      lists.wildtype.length
        ? `Wild-type pattern in tumours: ${lists.wildtype.slice(0, PICK_NEGATIVE).join("; ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    return {
      // The citation reads "Pathology Bites · TTF-1"; the label says where it is from.
      title: marker.name,
      // The marker page when knowledge pages are live; the IHC panel tool otherwise.
      href: KNOWLEDGE_PAGES_ENABLED && marker.slug ? `/m/${marker.slug}` : "/tools/ihc",
      text,
      tokens: 0,
    };
  } catch (err) {
    log.warn("[ask-albright] knowledge-base marker profile failed; continuing without", err);
    return null;
  }
}
