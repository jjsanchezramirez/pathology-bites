/**
 * ClinVar significance normalization utility
 * Handles conflicting interpretations and priority-based classification
 */

/**
 * Normalize ClinVar clinical significance from various formats
 * Handles:
 * - Single strings
 * - Arrays of significance values (multiple submissions)
 * - Objects with description fields
 * - Conflict detection between Pathogenic vs Benign, VUS vs Benign, VUS vs Pathogenic
 */
export function normalizeClinvarSignificance(clinicalSignificance: unknown): string | null {
  if (!clinicalSignificance) return null;

  let sigString: string | null = null;

  if (typeof clinicalSignificance === "string") {
    sigString = clinicalSignificance;
  } else if (Array.isArray(clinicalSignificance) && clinicalSignificance.length > 0) {
    // Check for array BEFORE checking for object (since arrays are objects in JS)
    sigString = clinicalSignificance.filter((item) => typeof item === "string").join(";");
  } else if (typeof clinicalSignificance === "object" && clinicalSignificance !== null) {
    const obj = clinicalSignificance as { description?: string };
    if (obj.description && typeof obj.description === "string") {
      sigString = obj.description;
    }
  }

  if (!sigString) return null;

  // Normalize: split camelCase, underscores, etc. into separate parts
  sigString = sigString
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1;$2")
    .replace(/_/g, ";")
    .replace(
      /([a-z])(drug|other|association|risk|benign|pathogenic|conflicting|uncertain)/gi,
      "$1;$2"
    );

  const parts = sigString
    .split(/[;,|\/]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Check for conflicting interpretations
  // Any disagreement between substantive classifications = conflict
  const hasPathogenic = parts.some(
    (p) => p.includes("pathogenic") && !p.includes("benign") && !p.includes("uncertain")
  );
  const hasBenign = parts.some((p) => p.includes("benign") && !p.includes("pathogenic"));
  const hasVUS = parts.some((p) => p.includes("uncertain"));

  // True conflict: mutually exclusive interpretations present
  // Pathogenic vs Benign = conflict
  // VUS vs Benign = minor conflict (still conflicting per ClinVar)
  // VUS vs Pathogenic = minor conflict
  if ((hasPathogenic && hasBenign) || (hasVUS && hasBenign) || (hasVUS && hasPathogenic)) {
    return "Conflicting";
  }

  // No conflict detected, return based on priority
  const priorityOrder = [
    "pathogenic",
    "likely pathogenic",
    "uncertain significance",
    "likely benign",
    "benign",
    "conflicting",
  ];

  for (const priority of priorityOrder) {
    const found = parts.find((part) => part.includes(priority.toLowerCase()));
    if (found) {
      // Convert to sentence case: "pathogenic" -> "Pathogenic", "likely pathogenic" -> "Likely Pathogenic"
      return found
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
  }

  // Fallback: convert first part to sentence case
  const fallback = parts[0] || sigString;
  return fallback
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
