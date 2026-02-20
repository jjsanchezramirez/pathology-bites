// Helper function to format numbers without trailing zeros
export const formatNumber = (num: number): string => {
  return num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/\.?0+$/, "");
};

export const formatDuration = (seconds: number | null) => {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// Helper function to get display name for animation types
export const getAnimationDisplayName = (type: string): string => {
  const displayNames: Record<string, string> = {
    zoom: "Zoom",
    pan: "Pan",
    figure: "Shape",
    spotlight: "Spotlight",
    arrow: "Arrow",
  };
  return displayNames[type] || type;
};
