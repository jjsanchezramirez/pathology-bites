import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KNOWLEDGE_PAGES_ENABLED } from "@/features/public/knowledge/lib/enabled";
import { createKbClient } from "@/shared/services/kb-client";
import { log } from "@/shared/utils/logging";
import {
  displayName,
  factAnswer,
  factFollowUps,
  pickOne,
  pickedName,
  quoteStandsAlone,
} from "./fact";
import { SOURCE_LABEL } from "./router";

/**
 * A random pathology fact from the knowledge base, for "tell me something"
 * (see fact.ts). No model call: costs nothing but a few reads.
 *
 * Where facts come from: the marker × tumour pairs a model already chose, once
 * and offline, as the ones a pathologist meets in practice
 * (public.marker_key_tumours, positives only). A random evidence row would not
 * do: the knowledge base also holds rarities, differentials and — as the Nov
 * 2026 subtype sweep showed — the odd misfiled row. Only WHO sentences that
 * were verified against the chapter, stated as definite, and read as a whole
 * sentence are used (~600 of them).
 *
 * Never throws: on any failure the caller falls back to the usual reply.
 */

const TIMEOUT_MS = 2000;
const ATTEMPTS = 4;
const POOL_TTL_MS = 6 * 60 * 60 * 1000;

// Public-read tables; service role because the pool is shared across requests
// (as in kb-entity.ts). Untyped: marker_key_tumours postdates the generated types.
const db = () => createKbClient() as unknown as SupabaseClient;

interface Pick {
  markerId: string;
  marker: string;
  tumour: string;
}

let pool: { at: number; value: Promise<Pick[]> } | null = null;

function loadPool(): Promise<Pick[]> {
  if (pool && Date.now() - pool.at < POOL_TTL_MS) return pool.value;
  const value = (async () => {
    const { data, error } = await db()
      .from("marker_key_tumours")
      .select("marker_id, positive, markers(name)")
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
    if (error) throw error;
    // A to-one embed; supabase-js types it as an array, PostgREST returns an object.
    const rows = (data ?? []) as unknown as Array<{
      marker_id: string;
      positive: string[] | null;
      markers: { name: string } | null;
    }>;
    return rows.flatMap((r) => {
      const marker = r.markers?.name;
      return marker
        ? (r.positive ?? []).map((p) => ({ markerId: r.marker_id, marker, tumour: pickedName(p) }))
        : [];
    });
  })();
  pool = { at: Date.now(), value };
  value.catch(() => {
    if (pool?.value === value) pool = null;
  });
  return value;
}

interface EvidenceRow {
  quote: string;
  entities: { name: string; slug: string } | null;
  sources: { kind: string; url: string | null; citation: string | null } | null;
}

/** One WHO sentence for a picked pair, or null when it has none fit to show. */
async function factFor(pick: Pick): Promise<{ row: EvidenceRow; entity: string } | null> {
  const ents = await db()
    .from("entities")
    .select("id")
    .ilike("name", pick.tumour.replace(/[%_\\]/g, "\\$&"))
    .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
  if (ents.error) throw ents.error;
  const ids = ((ents.data ?? []) as Array<{ id: string }>).map((e) => e.id);
  if (!ids.length) return null;
  const { data, error } = await db()
    .from("evidence")
    .select("quote, entities(name, slug), sources(kind, url, citation)")
    .eq("marker_id", pick.markerId)
    .in("entity_id", ids)
    .eq("call", "positive")
    .eq("quote_located", "verified")
    .eq("certainty", "definite")
    .not("review_status", "in", "(rejected,quarantined)")
    .limit(20)
    .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
  if (error) throw error;
  const fit = ((data ?? []) as unknown as EvidenceRow[]).filter(
    (r) => r.sources?.kind === "who_chapter" && r.entities && quoteStandsAlone(r.quote)
  );
  const row = pickOne(fit);
  return row ? { row, entity: row.entities!.name } : null;
}

export interface KbFact {
  answer: string;
  citations: Array<{ n: number; title: string; href: string; sourceLabel: string }>;
  followUps: string[];
}

export async function randomKbFact(): Promise<KbFact | null> {
  try {
    const picks = await loadPool();
    for (let i = 0; i < ATTEMPTS; i++) {
      const pick = pickOne(picks);
      if (!pick) return null;
      const found = await factFor(pick);
      if (!found) continue;
      const { row, entity } = found;
      // "WHO Classification of Tumours — Head and Neck Tumours (5th ed.): Granular cell tumour"
      const chapter =
        row.sources?.citation
          ?.split(/\):\s*/)
          .pop()
          ?.trim() || displayName(entity);
      const citations: KbFact["citations"] = [
        {
          n: 1,
          title: chapter,
          href: row.sources?.url ?? "https://tumourclassification.iarc.who.int/",
          sourceLabel: SOURCE_LABEL.who,
        },
      ];
      if (KNOWLEDGE_PAGES_ENABLED && row.entities?.slug) {
        citations.push({
          n: 2,
          title: displayName(entity),
          href: `/e/${row.entities.slug}`,
          sourceLabel: "Pathology Bites",
        });
      }
      return {
        answer: factAnswer(entity, row.quote),
        citations,
        followUps: factFollowUps(entity, pick.marker),
      };
    }
    return null;
  } catch (err) {
    log.warn("[ask-albright] random fact unavailable; using the usual reply", err);
    return null;
  }
}
