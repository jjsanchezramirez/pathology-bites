/**
 * Format PolyPhen-2 predictions for readability
 */
export function formatPolyphen(value: string | undefined): string {
  if (!value) return "Unknown";

  const mapping: Record<string, string> = {
    B: "Benign",
    P: "Possibly Damaging",
    D: "Probably Damaging",
  };

  return mapping[value.toUpperCase()] || value;
}

/**
 * Format SIFT predictions for readability
 */
export function formatSift(value: string | undefined): string {
  if (!value) return "Unknown";

  const mapping: Record<string, string> = {
    t: "Tolerated",
    tolerated: "Tolerated",
    d: "Deleterious",
    deleterious: "Deleterious",
  };

  const normalized = value.toLowerCase();
  return mapping[normalized] || value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Format MutationTaster predictions for readability
 */
export function formatMutationTaster(value: string | undefined): string {
  if (!value) return "Unknown";

  const mapping: Record<string, string> = {
    A: "Disease Causing Automatic",
    D: "Disease Causing",
    N: "Polymorphism",
    P: "Polymorphism Automatic",
  };

  return mapping[value.toUpperCase()] || value;
}

/**
 * Format ClinVar clinical significance for readability
 */
export function formatClinVarSignificance(value: string | undefined): string {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Format all prediction values
 */
export function formatPredictions(data: {
  sift?: string;
  polyphen2?: string;
  mutationTaster?: string;
}) {
  return {
    sift: formatSift(data.sift),
    polyphen2: formatPolyphen(data.polyphen2),
    mutationTaster: formatMutationTaster(data.mutationTaster),
  };
}
