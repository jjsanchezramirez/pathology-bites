/**
 * Geometry snapshots for /debug/kg-atlas's volume-lane lens.
 *
 * These exist because the layout this replaces was a force relaxation and
 * therefore untestable — its picture drifted between renders and nobody could
 * assert anything about it. `layoutLens` is pure and closed-form, so the
 * arithmetic that decides whether a real tumour FITS ON A SCREEN can be pinned.
 *
 * The three fixtures are measured against the production database, not invented:
 *   Burkitt lymphoma     6 bands, children [0,3,1,2,3,1], longest chain 1
 *   Follicular lymphoma  5 bands, children [3,5,5,1,1],   longest chain 1
 *   Vascular tumours    21 bands, 8 of them childless,    longest chain 2
 *
 * The golden heights below were RECORDED by running the function, never hand
 * computed — two of the four design passes that fed this shipped arithmetic
 * that did not survive contact with the real numbers.
 */
import { describe, expect, it } from "vitest";

import { LANE_COLOURS } from "@/app/debug/kg-atlas/model/accents";
import {
  compareVolumes,
  layoutLens,
  metricsFor,
  shortVolume,
  volumeKey,
  type LayoutLane,
} from "@/app/debug/kg-atlas/lens/geometry";
import { orthPath } from "@/app/debug/kg-atlas/lens/paths";

const lane = (key: string, kids: number, anc = 1, isSecondary = false): LayoutLane => ({
  key,
  label: key,
  isSecondary,
  placementId: `p-${key}`,
  rank: "entity",
  ancestors: Array.from({ length: anc }, (_, i) => ({
    id: `a-${key}-${i}`,
    name: `ancestor ${i}`,
    rank: "category" as const,
    placementId: `ap-${key}-${i}`,
    nChildren: 3,
  })),
  children: Array.from({ length: kids }, (_, i) => ({
    id: `c-${key}-${i}`,
    name: `child ${i}`,
    rank: "subtype" as const,
    placementId: `cp-${key}-${i}`,
    nChildren: 0,
  })),
  totalChildren: kids,
});

const BURKITT = [0, 3, 1, 2, 3, 1].map((n, i) => lane(`vol${i}`, n, 1));
const FOLLICULAR = [3, 5, 5, 1, 1].map((n, i) => lane(`vol${i}`, n, 1));
const VASCULAR = [
  ...[4, 1, 2, 2, 3, 4, 9, 12, 1, 4, 1].map((n, i) => lane(`book${i}`, n, 2)),
  ...[0, 0, 0, 0, 0, 0, 4, 1, 0, 0].map((n, i) => lane(`organ${i}`, n, 1, true)),
];

/** 1440×900 with the debug rail (224) and a collapsed index rail. */
const CANVAS_W = 1172;
const AVAIL_H = 700;

describe("metrics", () => {
  it("floors the ancestry at one slot so the orphan drop well always exists", () => {
    // 877 placements have no parent at all. If the ancestry zone collapsed to
    // zero width there would be nowhere to drop a parent onto, and the 139-row
    // orphan queue is the single commonest edit in the tool.
    expect(metricsFor(CANVAS_W, 0).ancSlots).toBe(1);
  });

  it("gives a shallow tree its width back", () => {
    // Burkitt's chain is 1 deep, so one ancestry slot is enough and the child
    // column gets the rest. This is the difference between a 348px and a 600px
    // name column on a real tumour.
    const shallow = metricsFor(CANVAS_W, 1);
    const deep = metricsFor(CANVAS_W, 3);
    expect(shallow.ancSlots).toBe(1);
    expect(deep.ancSlots).toBeGreaterThan(1);
    expect(shallow.FIXED_W).toBeLessThan(deep.FIXED_W);
  });

  it("steps the tier down rather than leaving horizontal scroll", () => {
    // Choosing the tier on width alone puts FIXED_W 808 + CHILD_MIN_W 300 into
    // a 1080px canvas, which does not fit.
    const m = metricsFor(1080, 3);
    expect(m.FIXED_W + m.CHILD_MIN_W).toBeLessThanOrEqual(1080);
  });

  it("keeps every book's direct parent in ONE column", () => {
    // The whole point of the layout: ancestry is right-aligned against the hub,
    // so "what does each book hang this off?" is a single vertical scan.
    const layout = layoutLens(VASCULAR, CANVAS_W, { childCap: 4 });
    const parents = layout.lanes
      .flatMap((l) => l.cards)
      .filter((c) => c.role === "parent")
      .map((c) => c.x);
    expect(new Set(parents).size).toBe(1);
    expect(parents[0]).toBe(layout.metrics.X_PARENT);
  });
});

describe("the three measured fixtures", () => {
  it("Burkitt lymphoma fits a 1440x900 screen with the dock open", () => {
    const l = layoutLens(BURKITT, CANVAS_W, { availH: AVAIL_H });
    expect(l.lanes).toHaveLength(6);
    // one childless band collapses to a strip; the other five stay open
    expect(l.lanes.filter((x) => x.collapsed)).toHaveLength(1);
    expect(l.lanes[0].collapsedBy).toBe("childless");
    expect(l.stackH).toBe(524);
    expect(l.autoCollapse).toBe(0);
    expect(l.metrics.ancSlots).toBe(1);
    expect(l.childW).toBe(600);
  });

  it("Follicular lymphoma fits too", () => {
    const l = layoutLens(FOLLICULAR, CANVAS_W, { availH: AVAIL_H });
    expect(l.lanes).toHaveLength(5);
    expect(l.lanes.some((x) => x.collapsed)).toBe(false);
    expect(l.stackH).toBe(578);
    expect(l.autoCollapse).toBe(0);
  });

  it("Vascular tumours (21 bands) triggers both auto-collapse steps and says so", () => {
    const l = layoutLens(VASCULAR, CANVAS_W, { availH: AVAIL_H });
    expect(l.lanes).toHaveLength(21);
    expect(l.autoCollapse).toBe(2);
    expect(l.appliedChildCap).toBe(2);
    // the 8 childless organ-layer bands close on their own rule, not the auto one
    expect(l.lanes.filter((x) => x.collapsedBy === "childless")).toHaveLength(8);
    expect(l.lanes.some((x) => x.collapsedBy === "auto")).toBe(true);
  });

  it("the all-collapsed 21-band floor still fits a 900px screen", () => {
    // This is why LANE_STRIP_H is 28 and not 34: at 34 the floor is 898px and
    // the extreme case cannot be shown at all, only scrolled.
    const l = layoutLens(VASCULAR, CANVAS_W, {
      childCap: 4,
      collapsedKeys: new Set(VASCULAR.map((x) => x.key)),
    });
    expect(l.stackH).toBe(772);
    expect(l.stackH).toBeLessThan(790);
  });

  it("the 80% case — one band — does not draw as a broken five-band layout", () => {
    // 3,186 of 4,001 entities sit in exactly one volume. This is the case that
    // will be under-tested by anyone reasoning from the interesting examples.
    const l = layoutLens([lane("only", 4, 1)], CANVAS_W, { availH: AVAIL_H });
    expect(l.lanes).toHaveLength(1);
    expect(l.lanes[0].collapsed).toBe(false);
    expect(l.stackH).toBeLessThan(200);
  });
});

describe("determinism and identity", () => {
  it("draws identically across two calls", () => {
    // A curator has to be able to find the same node twice.
    const a = layoutLens(FOLLICULAR, CANVAS_W, { availH: AVAIL_H });
    const b = layoutLens(FOLLICULAR, CANVAS_W, { availH: AVAIL_H });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("gives every card a unique key", () => {
    const l = layoutLens(VASCULAR, CANVAS_W, { childCap: 99 });
    const keys = l.lanes.flatMap((x) => x.cards.map((c) => c.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has a distinct colour for all 21 bands", () => {
    // The old laneColour() hashed the id and collided. Two same-coloured bands
    // in one view is a real failure; "Haem was blue last time" is a nicety, and
    // stable band ORDER already supplies that.
    const l = layoutLens(VASCULAR, CANVAS_W, { childCap: 4 });
    expect(new Set(l.lanes.map((x) => x.colour)).size).toBe(21);
    expect(LANE_COLOURS).toHaveLength(21);
  });

  it("emits byte-identical path strings", () => {
    const d1 = orthPath(
      [
        [0, 0],
        [10, 0],
        [10, 20],
      ],
      10
    );
    const d2 = orthPath(
      [
        [0, 0],
        [10, 0],
        [10, 20],
      ],
      10
    );
    expect(d1).toBe(d2);
    // The corner radius clamps to half the shorter adjacent segment, and below
    // half a pixel it degrades to a hard join — without that, a corner between
    // two short segments overshoots and the line visibly doubles back.
    expect(
      orthPath(
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        10
      )
    ).toContain("Q 1 0"); // 0.5px radius still curves
    expect(
      orthPath(
        [
          [0, 0],
          [0.4, 0],
          [0.4, 0.4],
        ],
        10
      )
    ).toContain("L 0.4 0"); // 0.2px does not
  });
});

describe("volume naming", () => {
  it("sorts every WHO book before the derived organ layer", () => {
    const rows = [
      { volume: "Haematolymphoid", isOrganLayer: true },
      { volume: "WHO Breast Tumours (5th ed.)", isOrganLayer: false },
      { volume: "WHO Breast Tumours (6th ed.)", isOrganLayer: false },
      { volume: "Skin", isOrganLayer: true },
    ];
    const sorted = [...rows].sort(compareVolumes).map((r) => r.volume);
    expect(sorted).toEqual([
      "WHO Breast Tumours (5th ed.)",
      "WHO Breast Tumours (6th ed.)",
      "Haematolymphoid",
      "Skin",
    ]);
  });

  it("zero-pads the edition so a 10th would sort after a 9th", () => {
    expect(volumeKey("WHO X Tumours (5th ed.)", false).ed).toBe("05");
    expect(volumeKey("WHO X Tumours (10th ed.)", false).ed).toBe("10");
    expect(
      volumeKey("WHO X Tumours (5th ed.)", false).ed <
        volumeKey("WHO X Tumours (10th ed.)", false).ed
    ).toBe(true);
  });

  it("shortens the real volume strings, including the awkward ones", () => {
    // "Genetic Tumour Syndromes" ends in "Syndromes", not "Tumours", and there
    // are two SIXTH editions in the live data.
    expect(shortVolume("WHO Haematolymphoid Tumours (5th ed.)", false)).toBe("Haematolymphoid 5e");
    expect(shortVolume("WHO Digestive System Tumours (6th ed.)", false)).toBe(
      "Digestive System 6e"
    );
    expect(shortVolume("WHO Genetic Tumour Syndromes (5th ed.)", false)).toBe(
      "Genetic Tumour Syndromes 5e"
    );
    expect(shortVolume("Haematolymphoid", true)).toBe("↳ Haematolymphoid");
  });
});
