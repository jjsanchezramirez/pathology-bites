import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { KNOWLEDGE_PAGES_ENABLED } from "@/features/public/knowledge/lib/enabled";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";
import {
  type EntityIndex,
  type EntityRow,
  type ProfileRow,
  type SynonymRow,
  buildEntityIndex,
  entityProfileText,
  findEntities,
} from "./entity-match";

/**
 * Knowledge-base profiles for the diagnoses a question names ("immunoprofile
 * of solid pseudopapillary neoplasm"): the markers WHO-derived evidence calls
 * positive, negative and the molecular alterations, pooled across the WHO
 * volumes that carry the tumour. Sent to the answer model as one more
 * numbered source, like the marker profile.
 *
 * Names are matched in memory: ~8.5k names and synonyms load once per
 * instance (a SQL matcher cost ~400 ms a question). Never throws and never
 * waits long — a profile improves an answer but must not hold it.
 */

export interface EntityProfile {
  title: string;
  href: string;
  text: string;
  /** The rows behind `text`, for checking the answer's table (table-check.ts). */
  rows: ProfileRow[];
}

const PAGE = 1000;
const LOAD_TIMEOUT_MS = 4000;
const QUERY_TIMEOUT_MS = 2000;
/** Reload names this often; the knowledge base changes rarely and a stale index is harmless. */
const INDEX_TTL_MS = 6 * 60 * 60 * 1000;
const KINDS = ["neoplasm", "non_neoplastic", "syndrome"];

// The tables are public-read; service role because this runs outside any
// request's cookie scope (the index is shared by every request on the instance).
// Untyped: these tables postdate the generated Database types (as in history.ts).
const db = () => createServiceRoleClient() as unknown as SupabaseClient;

/** Every row of a public table, paged in key order (unordered paging drops rows). */
async function allRows<T>(table: string, select: string, kinds?: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db().from(table).select(select);
    if (kinds) q = q.in("kind", kinds);
    const { data, error } = await q
      .order("id")
      .range(from, from + PAGE - 1)
      .abortSignal(AbortSignal.timeout(LOAD_TIMEOUT_MS));
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

let index: { at: number; value: Promise<EntityIndex> } | null = null;

function loadIndex(): Promise<EntityIndex> {
  if (index && Date.now() - index.at < INDEX_TTL_MS) return index.value;
  const value = (async () => {
    const [entities, synonyms] = await Promise.all([
      allRows<EntityRow>("entities", "id, slug, name", KINDS),
      allRows<SynonymRow>("entity_synonyms", "id, entity_id, term, kind"),
    ]);
    return buildEntityIndex(entities, synonyms);
  })();
  index = { at: Date.now(), value };
  // A failed load is retried on the next question, not cached for six hours.
  value.catch(() => {
    if (index?.value === value) index = null;
  });
  return value;
}

/** Start loading names before the first question needs them. */
export function warmEntityIndex(): void {
  void loadIndex().catch(() => {});
}

/**
 * Profiles for the diagnoses named in `text` (the question plus the planner's
 * spelled-out items), at most `max`, longest name first.
 */
export async function entityProfiles(text: string, max: number): Promise<EntityProfile[]> {
  if (max <= 0) return [];
  try {
    const idx = await Promise.race([
      loadIndex(),
      new Promise<null>((r) => setTimeout(() => r(null), QUERY_TIMEOUT_MS)),
    ]);
    if (!idx) return []; // still loading: skip this time, the next question gets it
    const found = findEntities(idx, text).slice(0, max);
    if (found.length === 0) return [];

    const ids = found.flatMap((f) => f.entities.map((e) => e.id));
    // A view: no embedded join, so marker names come in a second query.
    const { data, error } = await db()
      .from("marker_summary")
      .select("entity_id, marker_id, call, pooled_pct, sources")
      .in("entity_id", ids)
      .order("entity_id")
      .limit(1000)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));
    if (error) throw error;
    const summary = (data ?? []) as unknown as Array<
      Omit<ProfileRow, "name" | "kind"> & { marker_id: string }
    >;
    const markerIds = [...new Set(summary.map((r) => r.marker_id))];
    const markers = markerIds.length
      ? await db()
          .from("markers")
          .select("id, name, kind")
          .in("id", markerIds)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      : { data: [], error: null };
    if (markers.error) throw markers.error;
    const byId = new Map(
      ((markers.data ?? []) as unknown as Array<{ id: string; name: string; kind: string }>).map(
        (m) => [m.id, m]
      )
    );
    const rows: ProfileRow[] = summary.flatMap((r) => {
      const m = byId.get(r.marker_id);
      return m ? [{ ...r, name: m.name, kind: m.kind }] : [];
    });

    return found.flatMap((f) => {
      const mine = new Set(f.entities.map((e) => e.id));
      const own = rows.filter((r) => mine.has(r.entity_id));
      const text = entityProfileText(f.name, own);
      if (!text) return [];
      const slug = f.entities[0].slug;
      return [
        {
          title: f.name,
          href: KNOWLEDGE_PAGES_ENABLED ? `/e/${slug}` : "/tools/ihc",
          text,
          rows: own,
        },
      ];
    });
  } catch (err) {
    log.warn("[ask-albright] knowledge-base entity profile failed; continuing without", err);
    return [];
  }
}
