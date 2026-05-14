/** Convert hex to HSL */
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

/** Convert HSL to hex */
function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * For pastel backgrounds (L > 70%), returns a darker hue-matched text color.
 * For darker backgrounds, returns white or black.
 */
export function textColorFor(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  if (l > 0.7) {
    return hslToHex(h, Math.min(s + 0.3, 0.9), 0.25);
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#000000" : "#ffffff";
}

/** Pastel resource swatches — used by color picker and as default resource colors */
export const RESOURCE_SWATCHES = [
  "#D1FAE5",
  "#CFFAFE",
  "#DBEAFE",
  "#C7D2FE",
  "#E0E7FF",
  "#F3E8FF",
  "#F5F3FF",
  "#FCE7F3",
  "#FEE2E2",
  "#FFEDD5",
  "#FEF3C7",
];

/** Phase color palette — designed for UI */
export const PHASE_PALETTE = [
  { bg: "#D1FAE5", text: "#065F46", accent: "#34D399" },
  { bg: "#FEF3C7", text: "#92400E", accent: "#FBBF24" },
  { bg: "#FEE2E2", text: "#991B1B", accent: "#FCA5A5" },
  { bg: "#DBEAFE", text: "#1E3A8A", accent: "#93C5FD" },
  { bg: "#F3E8FF", text: "#6B21A8", accent: "#C4B5FD" },
];

export function buildColorMap(resources: { name: string; color: string }[]) {
  const colors: Record<string, { bg: string; text: string }> = {};
  resources.forEach((r) => {
    colors[r.name] = { bg: r.color, text: textColorFor(r.color) };
  });
  colors["REST"] = { bg: "#E2EFDA", text: "#375623" };
  colors["GONE"] = { bg: "#FFF2CC", text: "#854D0E" };
  colors["EXAM"] = { bg: "#EF4444", text: "#ffffff" };
  return colors;
}
