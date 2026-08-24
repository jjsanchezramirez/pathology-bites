"use client";

/**
 * The public knowledge cloud.
 *
 * The explorer's twin, with everything that needs a server taken out. It reads
 * one baked file and draws it: no API, no Leiden, no graphology, no detail
 * panel. Click a node and its neighbourhood lights up; that is the whole
 * interaction, and it is the whole reason the snapshot carries edges at all.
 *
 * Having no API is not only about speed. It means this cannot break when the
 * database is mid-migration, and it means a node that was deleted last Tuesday
 * simply is not in the file rather than 404ing under the cursor.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { resolveKnowledgeGraphUrl } from "@/shared/config/knowledge-graph-data";

import { Graph3D, type N3 } from "../lib/graph3d";
import { EDGE_KINDS, EDGE_RESULTS, NODE_TYPES, POLAR_KINDS, type EdgeType } from "../lib/model";
import { decodeSnapshot, type DecodedSnapshot } from "../lib/snapshot-codec";
import {
  CROSS_VOLUME,
  EDGE_HAZE,
  LABEL_HALO,
  LABEL_INK,
  ORGAN_PALETTE,
  RESULT_COLOR,
  TYPE_COLOR,
  chapterColor,
  sizeOf,
} from "../lib/palette";

/** Polarities the public cloud draws. Absences are a curation concern. */
const SHOWN = new Set(["positive", "index", "present"]);

export interface KnowledgeCloudProps {
  /** Override the snapshot URL. Normally resolved from the R2 manifest. */
  src?: string;
  className?: string;
}

export function KnowledgeCloud({ src, className }: KnowledgeCloudProps) {
  /** Where the walk has been. The last entry is the node before this one. */
  const trailRef = useRef<string[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Graph3D | null>(null);
  const [snap, setSnap] = useState<DecodedSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    /* The URL comes from the manifest, so a republished snapshot is picked up
     * without a redeploy; `resolveKnowledgeGraphUrl` falls back to a compiled
     * URL if the manifest cannot be read. Binary and brotli'd at rest, so the
     * browser inflates it from content-encoding and this just asks for bytes. */
    (src ? Promise.resolve(src) : resolveKnowledgeGraphUrl().then((r) => r.url))
      .then((url) => fetch(url))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((buf) => {
        if (cancelled) return;
        setSnap(decodeSnapshot(buf));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [src]);

  /** Degrees, sizes and colours: all derived, none of them worth shipping. */
  const model = useMemo(() => {
    if (!snap) return null;
    const count = snap.labels.length;
    const m = snap.edgeSource.length;

    /* The snapshot already carries only what the cloud draws -- negatives and
     * genes are pruned when it is baked -- so this is a safety net rather than
     * a filter, and it costs one pass. */
    const drawn: number[] = [];
    for (let k = 0; k < m; k++) {
      const kind = EDGE_KINDS[Math.floor(snap.edgeCode[k] / 9)];
      const result = EDGE_RESULTS[snap.edgeCode[k] % 9];
      if (POLAR_KINDS.has(kind) && result && !SHOWN.has(result)) continue;
      drawn.push(k);
    }

    const degree = new Int32Array(count);
    for (const k of drawn) {
      degree[snap.edgeSource[k]]++;
      degree[snap.edgeTarget[k]]++;
    }

    /* Chapter shading, exactly as the explorer computes it: within one organ,
     * the busiest chapter keeps the base hue and the rest step away from it. */
    const perOrgan = new Map<number, Map<number, number>>();
    for (let i = 0; i < count; i++) {
      if (snap.type[i] !== 0 || snap.organ[i] < 0 || snap.chapter[i] < 0) continue;
      let inner = perOrgan.get(snap.organ[i]);
      if (!inner) perOrgan.set(snap.organ[i], (inner = new Map()));
      inner.set(snap.chapter[i], (inner.get(snap.chapter[i]) ?? 0) + 1);
    }
    const shade = new Map<string, string>();
    for (const [organ, chapters] of perOrgan) {
      const base = ORGAN_PALETTE[snap.organs[organ]] ?? TYPE_COLOR.entity;
      [...chapters.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([chapter], i) => {
          shade.set(`${organ}:${chapter}`, chapterColor(base, i, chapters.size));
        });
    }

    const nodes: N3[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const kind = NODE_TYPES[snap.type[i]];
      const isEntity = kind === "entity";
      let color: string;
      if (!isEntity) color = TYPE_COLOR[kind];
      else if (snap.organ[i] < 0) color = CROSS_VOLUME;
      else {
        color =
          shade.get(`${snap.organ[i]}:${snap.chapter[i]}`) ??
          ORGAN_PALETTE[snap.organs[snap.organ[i]]] ??
          TYPE_COLOR.entity;
      }
      nodes[i] = {
        id: String(i),
        label: snap.labels[i],
        color,
        size: sizeOf(degree[i], isEntity),
        community: snap.community[i],
        kind,
      };
    }

    const edges = drawn.map((k) => {
      const kind = EDGE_KINDS[Math.floor(snap.edgeCode[k] / 9)] as EdgeType;
      const result = EDGE_RESULTS[snap.edgeCode[k] % 9];
      return {
        s: snap.edgeSource[k],
        t: snap.edgeTarget[k],
        color: (POLAR_KINDS.has(kind) && result && RESULT_COLOR[result]) || TYPE_COLOR.marker,
      };
    });

    /* Adjacency for click-to-highlight. CSR rather than a Map of Sets: it is
     * two passes over a flat array and about two milliseconds, against tens of
     * thousands of Set allocations. */
    const deg = new Int32Array(count);
    for (const e of edges) {
      deg[e.s]++;
      deg[e.t]++;
    }
    const start = new Int32Array(count + 1);
    for (let i = 0; i < count; i++) start[i + 1] = start[i] + deg[i];
    const cursor = start.slice(0, count);
    const adj = new Int32Array(edges.length * 2);
    for (const e of edges) {
      adj[cursor[e.s]++] = e.t;
      adj[cursor[e.t]++] = e.s;
    }

    /* Who each node is a subtype of. Subtype edges run child -> parent in the
     * database, and the snapshot keeps that direction in a bit of the code
     * byte, so this is the one place the graph knows which way is up. */
    const SUBTYPE = EDGE_KINDS.indexOf("subtype");
    const parentOf = new Int32Array(count).fill(-1);
    for (const k of drawn) {
      if (Math.floor(snap.edgeCode[k] / 9) !== SUBTYPE) continue;
      const low = snap.edgeSource[k];
      const high = snap.edgeTarget[k];
      // flipped means the original source -- the child -- was the high index.
      const child = snap.edgeFlipped[k] ? high : low;
      const parent = snap.edgeFlipped[k] ? low : high;
      parentOf[child] = parent;
    }

    return { nodes, edges, start, adj, parentOf };
  }, [snap]);

  useEffect(() => {
    if (!snap || !model || !stageRef.current || !labelRef.current) return;

    const engine = new Graph3D({
      container: stageRef.current,
      labelCanvas: labelRef.current,
      background: "#ffffff",
      labelInk: LABEL_INK,
      labelHalo: LABEL_HALO,
      edgeColor: EDGE_HAZE.slice(0, 7),
      onHover: () => {},
      onClick: (id) => {
        const current = trailRef.current[trailRef.current.length - 1];
        // Stepping back onto the node you just came from pops the trail rather
        // than growing it, so retracing a walk does not build a longer one.
        if (trailRef.current[trailRef.current.length - 2] === id) trailRef.current.pop();
        else if (current !== id) trailRef.current.push(id);
        select(id);
      },
      onBackground: () => {
        trailRef.current = [];
        engine.setWaypoints([]);
        engine.setHighlight(null, null);
      },
      onDoubleClick: () => {},
      onSettling: () => {},
    });
    /* One place that lights a node, so the click path and the keyboard path
     * cannot drift apart. The waypoints are the way back and the way up. */
    function select(id: string) {
      const i = Number(id);
      const near = new Set<string>([id]);
      for (let k = model.start[i]; k < model.start[i + 1]; k++) {
        near.add(String(model.adj[k]));
      }
      const marks: string[] = [];
      const parent = model.parentOf[i];
      if (parent >= 0) marks.push(String(parent));
      const back = trailRef.current[trailRef.current.length - 2];
      if (back && back !== String(parent)) marks.push(back);
      engine.setHighlight(id, near);
      engine.setWaypoints(marks);
    }

    /* Backspace and Escape walk back up the trail. Escape on the last step
     * clears the selection, which is the same thing clicking away does. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Backspace") return;
      const trail = trailRef.current;
      if (!trail.length) return;
      e.preventDefault();
      trail.pop();
      const back = trail[trail.length - 1];
      if (back) select(back);
      else {
        engine.setWaypoints([]);
        engine.setHighlight(null, null);
      }
    };
    window.addEventListener("keydown", onKey);

    engineRef.current = engine;

    engine.setNodes(model.nodes);
    engine.setEdges(model.edges);
    engine.setSizes(Float32Array.from(model.nodes, (n) => n.size));
    // The partition is already computed; this only seats it on the sphere.
    engine.applyCommunities(
      Int32Array.from(snap.community),
      snap.order,
      snap.family,
      snap.offsets
    );

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(stageRef.current);
    return () => {
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, [snap, model]);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={stageRef} style={{ position: "absolute", inset: 0 }} />
      <canvas ref={labelRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      {failed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: "#5b6675",
          }}
        >
          The map is unavailable right now.
        </div>
      )}
    </div>
  );
}
