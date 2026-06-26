// Genomic variant classification — evidence & detection helpers.
// Variant-type call (VAF), technical-artifact detection, and computational-evidence counting.
import { ParsedVariant, VariantData, VariantType } from "./types";

/**
 * Determine variant type based on VAF
 */
export function determineVariantType(vaf: number | null, _gnomadAF: number | null): VariantType {
  if (vaf === null || vaf === 0) return "Unknown";

  if (vaf >= 90) return "Germline (Homozygous)";
  if (vaf >= 45 && vaf <= 55) return "Germline";
  if (vaf < 45) return "Somatic";

  return "Unknown";
}

/**
 * Detect technical artifacts that should be filtered out
 */
export function detectTechnicalArtifact(parsed: ParsedVariant): {
  isArtifact: boolean;
  reason: string | null;
} {
  const vafValue = parsed.vaf || 0;

  // Low VAF threshold
  if (vafValue > 0 && vafValue < 5) {
    return { isArtifact: true, reason: "Low VAF (<5%) - below detection threshold" };
  }

  // 3'UTR variants
  if (parsed.hgvs_c?.includes("*")) {
    return { isArtifact: true, reason: "3'UTR region - low clinical significance" };
  }

  // Homopolymer indels
  if (parsed.hgvs_c && /del[ACGT]{4,}|ins[ACGT]{4,}/.test(parsed.hgvs_c)) {
    return { isArtifact: true, reason: "Homopolymer indel - high artifact risk" };
  }

  return { isArtifact: false, reason: null };
}

/**
 * Count pathogenic computational predictors
 * Uses 5 core predictors (excludes MutationTaster due to high false positive rate)
 */
export function countComputationalEvidence(data: VariantData): {
  pathogenicCount: number;
  benignCount: number;
  predictors: {
    name: string;
    value: string | number;
    interpretation: "Pathogenic" | "Benign" | "Uncertain";
  }[];
} {
  const predictors: {
    name: string;
    value: string | number;
    interpretation: "Pathogenic" | "Benign" | "Uncertain";
  }[] = [];
  let pathogenicCount = 0;
  let benignCount = 0;

  // REVEL (best single predictor)
  // Strong thresholds: >0.75 pathogenic, <0.4 benign. 0.4-0.75 is uncertain/borderline
  if (data.revel !== null) {
    let interpretation: "Pathogenic" | "Benign" | "Uncertain" = "Uncertain";
    if (data.revel > 0.75) {
      pathogenicCount++;
      interpretation = "Pathogenic";
    } else if (data.revel < 0.4) {
      benignCount++;
      interpretation = "Benign";
    }
    predictors.push({ name: "REVEL", value: data.revel.toFixed(3), interpretation });
  }

  // CADD
  if (data.cadd !== null) {
    let interpretation: "Pathogenic" | "Benign" | "Uncertain" = "Uncertain";
    if (data.cadd > 20) {
      pathogenicCount++;
      interpretation = "Pathogenic";
    } else if (data.cadd < 10) {
      benignCount++;
      interpretation = "Benign";
    }
    predictors.push({ name: "CADD", value: data.cadd.toFixed(1), interpretation });
  }

  // GERP (conservation)
  if (data.gerp !== null) {
    let interpretation: "Pathogenic" | "Benign" | "Uncertain" = "Uncertain";
    if (data.gerp > 4) {
      pathogenicCount++;
      interpretation = "Pathogenic";
    } else if (data.gerp < 2) {
      benignCount++;
      interpretation = "Benign";
    }
    predictors.push({ name: "GERP", value: data.gerp.toFixed(2), interpretation });
  }

  // SIFT
  if (data.sift) {
    const siftLower = data.sift.toLowerCase();
    let interpretation: "Pathogenic" | "Benign" | "Uncertain" = "Uncertain";
    if (siftLower.includes("deleterious") || siftLower === "d") {
      pathogenicCount++;
      interpretation = "Pathogenic";
    } else if (siftLower.includes("tolerated") || siftLower === "t") {
      benignCount++;
      interpretation = "Benign";
    }
    predictors.push({ name: "SIFT", value: data.sift, interpretation });
  }

  // PolyPhen2
  if (data.polyphen2) {
    const ppLower = data.polyphen2.toLowerCase();
    let interpretation: "Pathogenic" | "Benign" | "Uncertain" = "Uncertain";
    if (ppLower.includes("damaging") || ppLower === "d") {
      pathogenicCount++;
      interpretation = "Pathogenic";
    } else if (ppLower.includes("benign") || ppLower === "b") {
      benignCount++;
      interpretation = "Benign";
    }
    predictors.push({ name: "PolyPhen2", value: data.polyphen2, interpretation });
  }

  return { pathogenicCount, benignCount, predictors };
}
