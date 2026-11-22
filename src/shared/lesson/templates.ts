// Scene templates for the canvas editor.
//
// A template is a starting layout, not a locked one: it turns a scene (a
// heading plus one sentence per beat, the script-lesson format) into ordinary
// canvas elements on a clean-look slide. Every element can then be moved,
// restyled or deleted like any other. Each sentence becomes a narration line,
// and each element is tied to its sentence with a cue, so the slide times
// itself from the narration (see auto-timing.ts): no keyframes needed.
//
// Geometry mirrors the script-lesson stage (script/draw.ts): sizes are in
// percent of the frame width, and converted to the element rect's units
// (x and width in percent of width, y and height in percent of height).

import { autoTimeLesson, autoTimeSlide } from "./auto-timing";
import { DRAW_THEME as T } from "./script/draw";
import type { Beat, ImageRegion, Scene, ScriptLesson, TemplateKind } from "./script/types";
import { DEFAULT_FRAMING, emptyLesson } from "./types";
import type {
  CameraElement,
  ElementCue,
  ImageElement,
  Lesson,
  NarrationLine,
  ShapeElement,
  Slide,
  SlideElement,
  SpotlightElement,
  TextElement,
} from "./types";

export const TEMPLATE_THEME = T;

/** Frame height in percent-of-width units (16:9). */
const STAGE_H = 56.25;
const PAD_X = 6;
const HEADING_TOP = 4.6;
const CONTENT_TOP = 13;
/** cqw per rem for text (matches the renderers). */
const CQW_PER_REM = 1.67;

const toY = (v: number) => (v / STAGE_H) * 100;
const round = (n: number) => Math.round(n * 100) / 100;

let counter = 0;
function uid(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const PLACEHOLDER_TIMING = { start: 0, fadeIn: 0, hold: 1, fadeOut: 0 };

// ---- Text measurement (approximate, so layout needs no canvas) --------------

/** Rough advance width of a character, as a fraction of the font size (Instrument Sans). */
function charWidth(ch: string, weight: 400 | 600): number {
  const bold = weight === 600 ? 1.05 : 1;
  if (ch === " ") return 0.25 * bold;
  if (/[iljtfrI.,:;'!|]/.test(ch)) return 0.3 * bold;
  if (/[mwMW]/.test(ch)) return 0.8 * bold;
  if (/[A-Z0-9]/.test(ch)) return 0.64 * bold;
  return 0.52 * bold;
}

function textWidth(s: string, size: number, weight: 400 | 600): number {
  let w = 0;
  for (const ch of s) w += charWidth(ch, weight);
  return w * size;
}

/** Number of wrapped lines for `text` at `size` (width units) in a box `maxW` wide. */
export function estimateLines(text: string, size: number, weight: 400 | 600, maxW: number): number {
  let lines = 0;
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines++;
      continue;
    }
    let line = words[0];
    lines++;
    for (const w of words.slice(1)) {
      const next = `${line} ${w}`;
      if (textWidth(next, size, weight) <= maxW) line = next;
      else {
        lines++;
        line = w;
      }
    }
  }
  return Math.max(1, lines);
}

interface Block {
  el: TextElement;
  height: number;
}

// ---- Element builders (all sizes in width units) -----------------------------

function textEl(
  text: string,
  x: number,
  y: number,
  w: number,
  size: number,
  weight: 400 | 600,
  color: string,
  cue: ElementCue,
  lineHeight = 1.25,
  align: TextElement["align"] = "left"
): Block {
  const lines = estimateLines(text, size, weight, w);
  const height = lines * size * lineHeight;
  return {
    height,
    el: {
      id: uid("text"),
      kind: "text",
      text,
      rect: { x: round(x), y: round(toY(y)), w: round(w), h: round(toY(height)), rotation: 0 },
      fontSize: round(size / CQW_PER_REM),
      fontWeight: weight === 600 ? "semibold" : "normal",
      color,
      align,
      animation: "fade",
      shadow: false,
      cue,
      timing: { ...PLACEHOLDER_TIMING },
    },
  };
}

function boxEl(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    fill?: string;
    stroke?: string;
    strokeW?: number;
    radius?: number;
    shape?: ShapeElement["shape"];
  },
  cue: ElementCue
): ShapeElement {
  return {
    id: uid("shape"),
    kind: "shape",
    shape: opts.shape ?? "rectangle",
    rect: { x: round(x), y: round(toY(y)), w: round(w), h: round(toY(h)), rotation: 0 },
    stroke: {
      color: opts.stroke ?? "transparent",
      width: opts.stroke ? round((opts.strokeW ?? 0.3) / 0.1) : 0,
      style: "solid",
    },
    fill: opts.fill,
    radius: opts.radius,
    shadow: false,
    cue,
    timing: { ...PLACEHOLDER_TIMING },
  };
}

/** A numbered disc: the circle and its centred number. */
function badge(
  cx: number,
  cy: number,
  d: number,
  n: number,
  size: number,
  colors: { fill?: string; stroke?: string; strokeW?: number; ink: string },
  cue: ElementCue
): SlideElement[] {
  const disc = boxEl(cx - d / 2, cy - d / 2, d, d, { ...colors, shape: "circle" }, cue);
  const num = textEl(
    String(n),
    cx - d / 2,
    cy - (size * 1.25) / 2,
    d,
    size,
    600,
    colors.ink,
    cue,
    1.25,
    "center"
  );
  return [disc, num.el];
}

function headingEl(text: string | undefined): SlideElement[] {
  if (!text?.trim()) return [];
  return [textEl(text, PAD_X, HEADING_TOP, 100 - 2 * PAD_X, 3.3, 600, T.ink, "build", 1.15).el];
}

// ---- Scenes → slides ----------------------------------------------------------

interface Built {
  elements: SlideElement[];
  /** Elements each beat reveals, by beat index. */
  byBeat: Map<number, string[]>;
}

function link(byBeat: Map<number, string[]>, k: number, els: SlideElement[]) {
  const list = byBeat.get(k) ?? [];
  list.push(...els.map((e) => e.id));
  byBeat.set(k, list);
}

function buildTitle(scene: Scene): Built {
  const byBeat = new Map<number, string[]>();
  const left = PAD_X + 2;
  const width = 100 - left - (PAD_X + 6);
  const head = scene.heading ?? "";
  const headH = estimateLines(head, 5.4, 600, width) * 5.4 * 1.08;
  const subs = scene.beats
    .map((b, k) => ({ b, k }))
    .filter(({ b }) => b.text?.trim())
    .map(({ b, k }) => ({
      k,
      text: b.text!,
      h: estimateLines(b.text!, 2.4, 400, width) * 2.4 * 1.3,
    }));
  const total = 0.4 + 2.2 + headH + subs.reduce((n, s) => n + 1.6 + s.h, 0);
  let y = (STAGE_H - total) / 2;
  const elements: SlideElement[] = [
    boxEl(left, y, 6, 0.4, { fill: T.accent, radius: 0.2 }, "build"),
  ];
  y += 0.4 + 2.2;
  elements.push(textEl(head, left, y, width, 5.4, 600, T.ink, "build", 1.08).el);
  y += headH;
  for (const s of subs) {
    y += 1.6;
    const t = textEl(s.text, left, y, width, 2.4, 400, T.inkSoft, "build", 1.3);
    elements.push(t.el);
    link(byBeat, s.k, [t.el]);
    y += s.h;
  }
  elements.push(
    textEl("Pathology Bites", left, STAGE_H - 4 - 1.44, width, 1.2, 600, T.accent, "build", 1.2).el
  );
  return { elements, byBeat };
}

function imageBox(scene: Scene) {
  const aspect =
    scene.image?.width && scene.image?.height ? scene.image.width / scene.image.height : 4 / 3;
  const maxW = 58;
  const maxH = STAGE_H - CONTENT_TOP - 6;
  let boxW = maxW;
  let boxH = boxW / aspect;
  if (boxH > maxH) {
    boxH = maxH;
    boxW = boxH * aspect;
  }
  return { boxW, boxH };
}

/** Camera move that frames `r` (width units on the stage), clamped to the frame. */
export function cameraFor(
  r: { x: number; y: number; w: number; h: number },
  maxZoom = 2
): CameraElement["to"] {
  const s = Math.max(
    1,
    Math.min(maxZoom, (0.85 * 100) / Math.max(1, r.w), (0.85 * STAGE_H) / Math.max(1, r.h))
  );
  const cx = r.x + r.w / 2;
  const cy = toY(r.y + r.h / 2);
  const lim = 50 * (s - 1);
  const clampT = (v: number) => Math.max(-lim, Math.min(lim, v));
  return {
    x: round(50 + clampT(-s * (cx - 50))),
    y: round(50 + clampT(-s * (cy - 50))),
    scale: round(s),
  };
}

function buildImage(scene: Scene): Built {
  const byBeat = new Map<number, string[]>();
  const { boxW, boxH } = imageBox(scene);
  const elements: SlideElement[] = [];
  const picture: ImageElement = {
    id: uid("img"),
    kind: "image",
    imageUrl: scene.image?.url ?? "",
    rect: {
      x: PAD_X,
      y: round(toY(CONTENT_TOP)),
      w: round(boxW),
      h: round(toY(boxH)),
      rotation: 0,
    },
    shadow: false,
    cue: "build",
    timing: { ...PLACEHOLDER_TIMING },
  };
  elements.push(picture);

  const onStage = (r: ImageRegion) => ({
    x: PAD_X + (r.x / 100) * boxW,
    y: CONTENT_TOP + (r.y / 100) * boxH,
    w: (r.w / 100) * boxW,
    h: (r.h / 100) * boxH,
  });

  // Marks on the picture: rings with a number, spotlights, zooms.
  let n = 0;
  const numbers = scene.beats.map((b) => (b.region ? ++n : null));
  scene.beats.forEach((b, k) => {
    if (!b.region) return;
    const r = onStage(b.region);
    const mark = b.mark ?? "ring";
    if (mark === "zoom") {
      const cam: CameraElement = {
        id: uid("camera"),
        kind: "camera",
        to: cameraFor(r),
        persistent: false,
        cue: "beat",
        timing: { ...PLACEHOLDER_TIMING },
      };
      elements.push(cam);
      link(byBeat, k, [cam]);
    } else if (mark === "spotlight") {
      const spot: SpotlightElement = {
        id: uid("spot"),
        kind: "spotlight",
        shape: "rectangle",
        rect: { x: round(r.x), y: round(toY(r.y)), w: round(r.w), h: round(toY(r.h)), rotation: 0 },
        dimOpacity: 0.62,
        within: { ...picture.rect },
        cue: "beat",
        timing: { ...PLACEHOLDER_TIMING },
      };
      const outline = boxEl(
        r.x - 0.15,
        r.y - 0.15,
        r.w + 0.3,
        r.h + 0.3,
        { stroke: T.mark, strokeW: 0.3, radius: 0.6 },
        "beat"
      );
      elements.push(spot, outline);
      link(byBeat, k, [spot, outline]);
    } else {
      const ring = boxEl(
        r.x,
        r.y,
        r.w,
        r.h,
        { stroke: T.mark, strokeW: 0.3, shape: "oval" },
        "beat"
      );
      const num = badge(
        r.x + r.w * 0.96,
        r.y + r.h * 0.04,
        2,
        numbers[k]!,
        1.15,
        { fill: T.mark, ink: T.ink },
        "beat"
      );
      elements.push(ring, ...num);
      link(byBeat, k, [ring, ...num]);
    }
  });

  // Heading after the marks, so a spotlight never dims it.
  elements.push(...headingEl(scene.heading));
  if (scene.credit) {
    elements.push(
      textEl(
        scene.credit,
        PAD_X,
        CONTENT_TOP + boxH + 0.8,
        boxW,
        1.05,
        400,
        T.inkSoft,
        "build",
        1.2
      ).el
    );
  }

  // Callout list beside the picture.
  const listLeft = PAD_X + boxW + 3.5;
  const listW = 100 - PAD_X - listLeft;
  let y = CONTENT_TOP + 0.4;
  scene.beats.forEach((b, k) => {
    if (!b.text?.trim()) return;
    const num = numbers[k];
    const textX = num != null ? listLeft + 3.3 : listLeft;
    const textW = listW - (textX - listLeft);
    const main = textEl(
      b.text,
      textX,
      y,
      textW,
      1.9,
      num == null ? 600 : 400,
      T.ink,
      "build",
      1.28
    );
    const det = b.detail
      ? textEl(b.detail, textX, y + main.height + 0.3, textW, 1.5, 400, T.inkSoft, "build", 1.2)
      : null;
    const textH = main.height + (det ? 0.3 + det.height : 0);
    const row: SlideElement[] = [];
    if (num != null) {
      const cy = y + 0.05 + 1.15;
      row.push(
        ...badge(
          listLeft + 1.15,
          cy,
          2.3,
          num,
          1.3,
          { stroke: T.accent, strokeW: 0.18, ink: T.accent },
          "build"
        )
      );
      // The current callout's number fills in while its sentence plays.
      const active = badge(
        listLeft + 1.15,
        cy,
        2.3,
        num,
        1.3,
        { fill: T.accent, stroke: T.accent, strokeW: 0.18, ink: "#FFFFFF" },
        "beat"
      );
      row.push(...active);
    }
    row.push(main.el);
    if (det) row.push(det.el);
    elements.push(...row);
    link(byBeat, k, row);
    y += Math.max(num != null ? 2.35 : 0, textH) + 1.5;
  });
  return { elements, byBeat };
}

function buildCompare(scene: Scene): Built {
  const byBeat = new Map<number, string[]>();
  const elements: SlideElement[] = [...headingEl(scene.heading)];
  const hasImages = scene.beats.some((b) => b.side && b.image?.url);
  const gap = 3.5;
  const panelW = (100 - 2 * PAD_X - gap) / 2;
  const padX = hasImages ? 0 : 2.4;
  const padY = hasImages ? 0 : 2.2;
  const sides = (["left", "right"] as const).map((side) =>
    scene.beats.map((b, k) => ({ b, k })).filter(({ b }) => b.side === side)
  );

  const measure = (rows: Array<{ b: Beat; k: number }>) => {
    const textW = panelW - 2 * padX;
    const image = rows.find(({ b }) => b.image?.url)?.b.image;
    const imgH = image ? panelW / (16 / 9) + 1.4 : 0;
    const hs = rows.map(({ b }, idx) => {
      const t = b.text
        ? estimateLines(b.text, idx === 0 ? 2.5 : 2, 600, textW) * (idx === 0 ? 2.5 : 2) * 1.2
        : 0;
      const d = b.detail ? 0.6 + estimateLines(b.detail, 2, 400, textW) * 2 * 1.32 : 0;
      return t + d;
    });
    const content = hs.reduce((n, h, idx) => n + h + (idx > 0 ? 1.2 : 0), 0);
    const boxH = hasImages ? content : Math.max(15, content + 2 * padY);
    return { image, imgH, boxH, height: imgH + boxH };
  };
  const m = sides.map(measure);
  const rowH = Math.max(m[0].height, m[1].height);
  // Panels share a height so they line up.
  const boxH = hasImages ? 0 : Math.max(m[0].boxH, m[1].boxH);

  sides.forEach((rows, si) => {
    if (!rows.length) return;
    const x = PAD_X + si * (panelW + gap);
    const first = rows[0].k;
    let y = CONTENT_TOP;
    const panel: SlideElement[] = [];
    if (m[si].image) {
      const h = panelW / (16 / 9);
      panel.push({
        id: uid("img"),
        kind: "image",
        imageUrl: m[si].image!.url,
        rect: { x: round(x), y: round(toY(y)), w: round(panelW), h: round(toY(h)), rotation: 0 },
        shadow: false,
        cue: "build",
        timing: { ...PLACEHOLDER_TIMING },
      });
      y += m[si].imgH;
    }
    if (!hasImages)
      panel.push(boxEl(x, y, panelW, boxH, { fill: T.accentSoft, radius: 1 }, "build"));
    elements.push(...panel);
    link(byBeat, first, panel);
    let ty = y + padY;
    rows.forEach(({ b, k }, idx) => {
      if (idx > 0) ty += 1.2;
      const size = idx === 0 ? 2.5 : 2;
      const row: SlideElement[] = [];
      let h = 0;
      if (b.text) {
        const t = textEl(
          b.text,
          x + padX,
          ty,
          panelW - 2 * padX,
          size,
          600,
          idx === 0 ? T.accent : T.ink,
          "build",
          1.2
        );
        row.push(t.el);
        h += t.height;
      }
      if (b.detail) {
        const d = textEl(
          b.detail,
          x + padX,
          ty + h + (h ? 0.6 : 0),
          panelW - 2 * padX,
          2,
          400,
          T.ink,
          "build",
          1.32
        );
        row.push(d.el);
        h += (h ? 0.6 : 0) + d.height;
      }
      elements.push(...row);
      link(byBeat, k, row);
      ty += h;
    });
  });

  let y = CONTENT_TOP + rowH + 2.6;
  scene.beats.forEach((b, k) => {
    if (b.side || !b.text?.trim()) return;
    const t = textEl(b.text, PAD_X, y, 100 - 2 * PAD_X, 2.3, 600, T.ink, "build", 1.25);
    const row: SlideElement[] = [t.el];
    let h = t.height;
    if (b.detail) {
      const d = textEl(
        b.detail,
        PAD_X,
        y + h + 0.4,
        100 - 2 * PAD_X,
        1.8,
        400,
        T.inkSoft,
        "build",
        1.2
      );
      row.push(d.el);
      h += 0.4 + d.height;
    }
    elements.push(...row);
    link(byBeat, k, row);
    y += h + 2.6;
  });
  return { elements, byBeat };
}

function buildLadder(scene: Scene): Built {
  const byBeat = new Map<number, string[]>();
  const elements: SlideElement[] = [...headingEl(scene.heading)];
  const rungs = scene.beats.map((b, k) => ({ b, k })).filter(({ b }) => b.text?.trim());
  const d = rungs.length <= 4 ? 1 : rungs.length === 5 ? 0.92 : 0.84;
  const width = 100 - 2 * PAD_X;
  const circleD = 2.8 * d;
  const textX = PAD_X + 1.4 + circleD + 1.6;
  const textW = width - 1.4 * 2 - circleD - 1.6;
  let y = CONTENT_TOP;
  rungs.forEach(({ b, k }, idx) => {
    const tH = estimateLines(b.text!, 2.2 * d, 600, textW) * 2.2 * d * 1.2;
    const dH = b.detail ? estimateLines(b.detail, 1.75 * d, 400, textW) * 1.75 * d * 1.3 : 0;
    const textH = tH + (b.detail ? 0.25 + dH : 0);
    const rowH = Math.max(circleD, textH) + 2 * 0.9 * d;
    const midY = y + rowH / 2;
    const textTop = midY - textH / 2;
    // The band and the filled number mark the step being spoken.
    const band = boxEl(PAD_X, y, width, rowH, { fill: T.accentSoft, radius: 0.8 }, "beat");
    const cx = PAD_X + 1.4 + circleD / 2;
    const ring = badge(
      cx,
      midY,
      circleD,
      idx + 1,
      1.45 * d,
      { stroke: T.accent, strokeW: 0.2, ink: T.accent },
      "build"
    );
    const filled = badge(
      cx,
      midY,
      circleD,
      idx + 1,
      1.45 * d,
      { fill: T.accent, stroke: T.accent, strokeW: 0.2, ink: "#FFFFFF" },
      "beat"
    );
    const t = textEl(b.text!, textX, textTop, textW, 2.2 * d, 600, T.ink, "build", 1.2);
    const row: SlideElement[] = [band, ...ring, ...filled, t.el];
    if (b.detail)
      row.push(
        textEl(b.detail, textX, textTop + tH + 0.25, textW, 1.75 * d, 400, T.inkSoft, "build", 1.3)
          .el
      );
    elements.push(...row);
    link(byBeat, k, row);
    y += rowH + 0.9 * d;
  });
  return { elements, byBeat };
}

function buildTakeHome(scene: Scene): Built {
  const byBeat = new Map<number, string[]>();
  const elements: SlideElement[] = [...headingEl(scene.heading)];
  const left = PAD_X + 0.4;
  const width = 100 - left - (PAD_X + 4);
  const textX = left + 2.8;
  const textW = width - 2.8;
  let y = CONTENT_TOP + 2;
  scene.beats.forEach((b, k) => {
    if (!b.text?.trim()) return;
    const dot = boxEl(left, y + 1.05, 1, 1, { fill: T.accent, shape: "circle" }, "build");
    const t = textEl(b.text, textX, y, textW, 2.8, 600, T.ink, "build", 1.22);
    const row: SlideElement[] = [dot, t.el];
    let h = t.height;
    if (b.detail) {
      const det = textEl(b.detail, textX, y + h + 0.5, textW, 2, 400, T.inkSoft, "build", 1.3);
      row.push(det.el);
      h += 0.5 + det.height;
    }
    elements.push(...row);
    link(byBeat, k, row);
    y += h + 2.4;
  });
  return { elements, byBeat };
}

const BUILDERS: Record<TemplateKind, (scene: Scene) => Built> = {
  title: buildTitle,
  image: buildImage,
  compare: buildCompare,
  ladder: buildLadder,
  takehome: buildTakeHome,
};

/** One scene as a clean-look slide: editable elements, narration lines and cues. */
export function slideFromScene(scene: Scene): Slide {
  const { elements, byBeat } = BUILDERS[scene.template](scene);
  const lines: NarrationLine[] = scene.beats.map((b, k) => ({
    id: uid("line"),
    text: b.say,
    elementIds: byBeat.get(k) ?? [],
  }));
  const slide: Slide = {
    id: uid("slide"),
    backgroundColor: T.background,
    imageCategory: "blank",
    duration: 6,
    transitionIn: { kind: "crossfade", duration: 0.5 },
    initialFraming: { ...DEFAULT_FRAMING },
    elements,
    narration: { lines },
    look: "clean",
    autoDuration: true,
    template: scene.template,
  };
  return autoTimeSlide(slide);
}

/** A whole script lesson as an editable canvas lesson. Narration audio is not carried over. */
export function lessonFromScript(script: ScriptLesson): Lesson {
  return autoTimeLesson({
    ...emptyLesson(),
    title: script.title,
    description: script.description,
    slides: script.scenes.map(slideFromScene),
  });
}

/** Starter content for "Add scene", one per template. */
export function starterScene(kind: TemplateKind): Scene {
  const id = uid("scene");
  const beat = (say: string, extra: Partial<Beat> = {}): Beat => ({
    id: uid("beat"),
    say,
    ...extra,
  });
  switch (kind) {
    case "title":
      return {
        id,
        template: kind,
        heading: "Lesson title",
        beats: [
          beat("One sentence on what this lesson covers.", { text: "What this lesson covers" }),
        ],
      };
    case "image":
      return {
        id,
        template: kind,
        heading: "Picture heading",
        beats: [
          beat("First, point at one feature.", {
            text: "First feature",
            region: { x: 30, y: 30, w: 20, h: 20 },
          }),
          beat("Then point at another.", {
            text: "Second feature",
            region: { x: 60, y: 55, w: 20, h: 20 },
          }),
          beat("And sum up what the picture shows.", { text: "What it adds up to" }),
        ],
      };
    case "compare":
      return {
        id,
        template: kind,
        heading: "Side by side",
        beats: [
          beat("On the left, the first thing.", {
            side: "left",
            text: "First",
            detail: "What sets it apart",
          }),
          beat("On the right, the second.", {
            side: "right",
            text: "Second",
            detail: "What sets it apart",
          }),
          beat("The difference that matters.", { text: "The difference that matters" }),
        ],
      };
    case "ladder":
      return {
        id,
        template: kind,
        heading: "Steps",
        beats: [
          beat("The first step.", { text: "First step", detail: "One line on it" }),
          beat("The second step.", { text: "Second step", detail: "One line on it" }),
          beat("The third step.", { text: "Third step", detail: "One line on it" }),
        ],
      };
    case "takehome":
    default:
      return {
        id,
        template: "takehome",
        heading: "Take-home",
        beats: [
          beat("The first point to remember.", { text: "First point" }),
          beat("The second point to remember.", { text: "Second point" }),
        ],
      };
  }
}
