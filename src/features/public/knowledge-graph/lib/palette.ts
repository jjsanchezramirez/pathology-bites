/**
 * Every colour and size the cloud draws with.
 *
 * Lifted out of the explorer so the public cloud paints the same picture from
 * the same numbers. These were tuned together against a white stage -- muted,
 * mid-to-deep tones, because saturated hues at this density read as confetti
 * and it is the CLUSTERS that have to be the thing you see.
 */
import type { NodeType } from "./model";

export const TYPE_COLOR: Record<NodeType, string> = {
  entity: "#5f6bab",
  marker: "#8b95a3",
  alteration: "#a09482",
  gene: "#8a7d94",
};

export const TYPE_LABEL: Record<NodeType, string> = {
  entity: "Entities",
  marker: "Markers",
  alteration: "Alterations",
  gene: "Genes",
};

export const ORGAN_PALETTE: Record<string, string> = {
  Haematolymphoid: "#4361a5",
  "Digestive System": "#c47d3b",
  "Head and Neck": "#2d9b8a",
  "Female Genital": "#b85670",
  Skin: "#c49a3d",
  "Soft Tissue and Bone": "#6b8f4e",
  Paediatric: "#7b66a6",
  "Endocrine and Neuroendocrine": "#d4715e",
  "Eye and Orbit": "#4a90b8",
  "Urinary and Male Genital": "#8b5e9b",
  Thoracic: "#5a7f96",
  Breast: "#9b6b8a",
  "Central Nervous System": "#5b5fa3",
  "Genetic Tumour Syndromes": "#8a8c42",
};


export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    g = x;
  }
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function chapterColor(baseHex: string, chapterIndex: number, totalChapters: number): string {
  if (totalChapters <= 1) return baseHex;
  const [h, s, l] = hexToHsl(baseHex);
  const range = 24;
  const step = range / (totalChapters - 1);
  const newL = Math.max(28, Math.min(68, l - range / 2 + step * chapterIndex));
  const satDrop = (chapterIndex / (totalChapters - 1)) * 12;
  const newS = Math.max(30, s - satDrop);
  return hslToHex(h, newS, newL);
}

/**
 * Polarity carries more signal than edge class, so a finding edge takes its
 * colour from its result and only structural edges use the class colour.
 */
export const RESULT_COLOR: Record<string, string> = {
  positive: "#3f8b76",
  negative: "#a35b5a",
  index: "#7b66a6",
  present: "#a8813f",
  absent: "#a35b5a",
};

/**
 * Tumours WHO describes across several volumes with no single home.
 *
 * Measured, these are NOT spatially clustered -- they are 7% of nodes and run
 * 0-19% of each community, i.e. baseline. What made them look like their own
 * cloud was this colour being more salient than the organ hues around them. So
 * it is deliberately quiet: present enough to pick out, not enough to read as a
 * group. Claiming an organ for them instead would be invention -- Schwannoma
 * has one chapter in each of nine volumes and no home among them.
 */
export const CROSS_VOLUME = "#9aa3b0";

/** Ink for labels drawn on the stage, with a white halo behind them. */
export const LABEL_INK = "#1e2733";
export const LABEL_HALO = "rgba(255, 255, 255, 0.92)";
/**
 * Cloud-mode edge colour: one pale slate rather than the polarity hues. 26,000
 * semi-transparent lines stack, and any stronger colour turns the middle of the
 * cloud into a solid grey slab that buries the stars. Kept faint, density reads
 * as shading instead. The hues come back the moment you focus a node, which is
 * the only scale at which an individual edge's polarity is legible anyway.
 */
export const EDGE_HAZE = "#64748b26";


/**
 * Node size tracks degree on a wide, compressive scale -- roughly 25x from the
 * faintest speck to the brightest hub. sqrt flattens the top end too much to be
 * useful here: degree runs from 1 to roughly 800, and the point of the size
 * channel is that a marker used by 400 tumours should read as a bright star
 * among dust, not as a slightly larger dot.
 *
 * The ceiling is a rendering constraint, not a taste one. FA2's `adjustSizes`
 * anti-collision works in GRAPH coordinates, where the layout spans thousands
 * of units, while sigma draws nodes at a fixed size in SCREEN pixels. Sizes big
 * enough to overlap on screen are far too small to repel each other during
 * layout, so past ~16px the hubs merge into amoebas no layout setting can
 * separate.
 */
export const sizeOf = (degree: number, isEntity: boolean = true) => {
  const base = Math.min(16, 0.6 + Math.pow(degree, 0.62) * 0.72);
  return isEntity ? base : base * 0.55;
};
