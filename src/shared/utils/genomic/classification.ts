/**
 * Variant classification logic
 * Implements AMP/ASCO/CAP tiered system with ACMG criteria
 */

import { ParsedVariant, VariantData, OncoKBData, VariantType, ClassificationResult } from "./types";

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
function countComputationalEvidence(data: VariantData): {
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

/**
 * UNIFIED CLASSIFICATION SYSTEM
 *
 * Routes to appropriate classification based on variant type:
 * - Somatic variants → AMP/ASCO/CAP tiered system
 * - Germline variants → ACMG criteria
 *
 * Returns a SINGLE classification with clear reporting decision
 */
export function classifyVariant(
  parsed: ParsedVariant,
  _variantType: VariantType,
  data: VariantData | null,
  oncokb: OncoKBData | null,
  artifactCheck: { isArtifact: boolean; reason: string | null }
): ClassificationResult {
  const vaf = parsed.vaf || 0;
  const gnomadAF = data?.gnomadAF || 0;
  const cosmicCount = data?.cosmicCount || 0;
  const clinvarSig = data?.clinvarSignificance || "";

  const clinvarSigLower = clinvarSig.toLowerCase();
  const clinvarConflicting = clinvarSigLower.includes("conflicting");
  const clinvarPathogenic =
    clinvarSigLower.includes("pathogenic") &&
    !clinvarSigLower.includes("likely") &&
    !clinvarConflicting;
  const clinvarLikelyPathogenic =
    clinvarSigLower.includes("likely pathogenic") && !clinvarConflicting;

  const oncoKBOncogenic = oncokb?.oncogenic?.toLowerCase() || "";
  const isOncoKBOncogenic =
    oncoKBOncogenic.includes("oncogenic") &&
    !oncoKBOncogenic.includes("likely") &&
    !oncoKBOncogenic.includes("predicted");
  const isOncoKBLikelyOncogenic =
    oncoKBOncogenic.includes("likely oncogenic") || oncoKBOncogenic.includes("likely pathogenic");

  const computational = data
    ? countComputationalEvidence(data)
    : { pathogenicCount: 0, benignCount: 0, predictors: [] };

  // Build evidence summary
  const clinicalDatabases: string[] = [];
  if (clinvarSig) clinicalDatabases.push(`ClinVar: ${clinvarSig}`);
  if (oncokb?.found && oncokb.oncogenic) clinicalDatabases.push(`OncoKB: ${oncokb.oncogenic}`);
  if (cosmicCount > 0) clinicalDatabases.push(`COSMIC: ${cosmicCount} occurrences`);

  const populationFrequency =
    gnomadAF > 0 ? `gnomAD AF: ${(gnomadAF * 100).toFixed(4)}%` : "Not found in gnomAD";

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: TECHNICAL ARTIFACT FILTER
  // ═══════════════════════════════════════════════════════════════════════════

  if (artifactCheck.isArtifact) {
    return {
      classification: "Not Detected (Technical Artifact)",
      tier: "Excluded",
      shouldReport: false,
      reasoning: artifactCheck.reason || "Technical artifact detected",
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: POPULATION FREQUENCY FILTER
  // ═══════════════════════════════════════════════════════════════════════════

  // BA1: gnomAD AF > 5% → Benign (stand-alone)
  if (gnomadAF > 0.05) {
    return {
      classification: "Benign",
      tier: "BA1",
      shouldReport: false,
      reasoning: `Common variant (gnomAD AF=${(gnomadAF * 100).toFixed(2)}%). Stand-alone benign evidence.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // BS1: gnomAD AF > 1% → Likely Benign
  if (gnomadAF > 0.01) {
    return {
      classification: "Likely Benign",
      tier: "BS1",
      shouldReport: false,
      reasoning: `Polymorphic variant (gnomAD AF=${(gnomadAF * 100).toFixed(4)}%). Strong benign evidence.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // Germline polymorphism at ~50% VAF - ONLY if no strong pathogenic evidence
  // Don't apply this rule if there's ClinVar pathogenic, OncoKB oncogenic, or therapeutic levels
  const hasStrongPathogenicEvidence =
    clinvarPathogenic ||
    clinvarLikelyPathogenic ||
    isOncoKBOncogenic ||
    isOncoKBLikelyOncogenic ||
    (oncokb?.highestSensitiveLevel &&
      ["LEVEL_1", "LEVEL_2", "LEVEL_3A", "LEVEL_3B"].includes(oncokb.highestSensitiveLevel));

  if (vaf >= 45 && vaf <= 55 && gnomadAF > 0.0001 && !hasStrongPathogenicEvidence) {
    return {
      classification: "Likely Benign (Germline Polymorphism)",
      tier: "BS1/BP6",
      shouldReport: false,
      reasoning: `VAF ~50% with population frequency (gnomAD AF=${(gnomadAF * 100).toFixed(4)}%). Likely germline polymorphism with no pathogenic evidence.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: AMP/ASCO/CAP TIER CLASSIFICATION (Li MM, et al. J Mol Diagn 2017)
  // ═══════════════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────────
  // Tier I: Strong Clinical Significance
  // Level A: FDA-approved therapy, included in professional guidelines
  // Level B: Well-powered studies with consensus
  // ─────────────────────────────────────────────────────────────────

  // Level A: FDA-approved therapy (OncoKB Level 1/2)
  if (oncokb?.highestSensitiveLevel === "LEVEL_1" || oncokb?.highestSensitiveLevel === "LEVEL_2") {
    const drugs = oncokb.therapeuticImplications?.map((t) => t.drug).join(", ") || "available";
    return {
      classification: "Pathogenic",
      tier: "Tier I (Level A)",
      shouldReport: true,
      reasoning: `FDA-approved therapy (OncoKB ${oncokb.highestSensitiveLevel}). Drugs: ${drugs}. Strong clinical significance.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // Level B: Well-powered studies - OncoKB Oncogenic + ClinVar Pathogenic + Highly recurrent
  if (isOncoKBOncogenic && clinvarPathogenic && cosmicCount > 50) {
    return {
      classification: "Pathogenic",
      tier: "Tier I (Level B)",
      shouldReport: true,
      reasoning: `Convergent evidence from multiple sources: OncoKB oncogenic, ClinVar pathogenic, COSMIC n=${cosmicCount}. Strong clinical significance.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // Level B: ClinVar Pathogenic + Highly recurrent
  if (clinvarPathogenic && cosmicCount > 100) {
    return {
      classification: "Pathogenic",
      tier: "Tier I (Level B)",
      shouldReport: true,
      reasoning: `ClinVar pathogenic, highly recurrent driver (COSMIC n=${cosmicCount}). Strong clinical significance.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Tier II: Potential Clinical Significance
  // Level C: FDA-approved for different tumor type, or multiple small studies
  // Level D: Preclinical or case studies only
  // ─────────────────────────────────────────────────────────────────

  // Level C: Clinical trial evidence (OncoKB Level 3A/3B)
  if (
    oncokb?.highestSensitiveLevel === "LEVEL_3A" ||
    oncokb?.highestSensitiveLevel === "LEVEL_3B"
  ) {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level C)",
      shouldReport: true,
      reasoning: `Clinical evidence from trials (OncoKB ${oncokb.highestSensitiveLevel}). Potential clinical significance.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // Level D: Single strong source or preclinical evidence

  // OncoKB Oncogenic (single source)
  if (isOncoKBOncogenic) {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: true,
      reasoning: "OncoKB oncogenic. Potential clinical significance (single expert source).",
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // ClinVar Pathogenic (single source)
  if (clinvarPathogenic) {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: true,
      reasoning: "ClinVar pathogenic. Potential clinical significance (single database).",
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // OncoKB Likely Oncogenic
  if (isOncoKBLikelyOncogenic) {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: true,
      reasoning: "OncoKB likely oncogenic. Potential clinical significance.",
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // ClinVar Likely Pathogenic
  if (clinvarLikelyPathogenic) {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: true,
      reasoning: "ClinVar likely pathogenic. Potential clinical significance.",
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // Highly recurrent in COSMIC (>50)
  if (cosmicCount > 50) {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: true,
      reasoning: `Highly recurrent in cancer (COSMIC n=${cosmicCount}). Potential clinical significance.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // OncoKB Level 4 (biological evidence)
  if (oncokb?.highestSensitiveLevel === "LEVEL_4") {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: false,
      reasoning: `Biological evidence (OncoKB LEVEL_4). Potential significance, preclinical only.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // Moderately recurrent in COSMIC (10-50)
  if (cosmicCount >= 10 && cosmicCount <= 50) {
    return {
      classification: "VUS",
      tier: "Tier II (Level D)",
      shouldReport: false,
      reasoning: `Recurrent in cancer (COSMIC n=${cosmicCount}). Limited evidence, potential significance.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Extract additional scores for classification decisions
  // ═══════════════════════════════════════════════════════════════════════════
  const revel = data?.revel || 0;
  const cadd = data?.cadd || 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // Tier III: Unknown Clinical Significance (VUS)
  // ═══════════════════════════════════════════════════════════════════════════

  // Strong computational evidence only (no clinical evidence): REVEL > 0.75 AND CADD > 25 AND gnomAD < 0.001
  // This is still VUS in AMP guidelines but reportable due to strong predictions
  if (revel > 0.75 && cadd > 25 && gnomadAF < 0.001) {
    const pathogenicPredictors = computational.predictors
      .filter((p) => p.interpretation === "Pathogenic")
      .map((p) => p.name);

    return {
      classification: "VUS (Strong Computational Evidence)",
      tier: "Tier III",
      shouldReport: true,
      reasoning: `Strong computational predictions (REVEL=${revel.toFixed(3)}, CADD=${cadd}). ${computational.pathogenicCount}/${computational.pathogenicCount + computational.benignCount} predictors pathogenic${pathogenicPredictors.length > 0 ? ` (${pathogenicPredictors.join(", ")})` : ""}. Extremely rare (gnomAD AF=${(gnomadAF * 100).toFixed(4)}%). Unknown clinical significance.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // Borderline REVEL (0.5-0.75): VUS with context
  if (revel >= 0.5 && revel <= 0.75 && !clinvarSig && !oncokb?.found && cosmicCount === 0) {
    const summary = `${computational.pathogenicCount} pathogenic, ${computational.benignCount} benign`;
    const tilt =
      computational.pathogenicCount > computational.benignCount
        ? "favor pathogenicity"
        : computational.benignCount > computational.pathogenicCount
          ? "favor benign"
          : "inconclusive";

    return {
      classification: "VUS (Variant of Uncertain Significance)",
      tier: "Tier III",
      shouldReport: false,
      reasoning: `Borderline REVEL (${revel.toFixed(3)}). Computational predictors (${summary}) ${tilt}. No ClinVar, OncoKB, or COSMIC data. Clinical correlation recommended.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tier IV: Benign or Likely Benign
  // ═══════════════════════════════════════════════════════════════════════════

  // Benign: ClinVar Benign (not conflicting)
  if (clinvarSig.toLowerCase().includes("benign") && !clinvarConflicting) {
    return {
      classification: clinvarSig.toLowerCase().includes("likely") ? "Likely Benign" : "Benign",
      tier: "Tier IV",
      shouldReport: false,
      reasoning: `ClinVar classified as ${clinvarSig}. Not clinically actionable.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // Likely Benign: Conflicting ClinVar + Strong benign computational evidence
  // When ClinVar is conflicting (including minor conflicts like VUS vs Benign), rely on computational predictors
  // Requires: ClinVar conflicting AND (3+ benign predictors that outnumber pathogenic OR 4+ benign with REVEL < 0.3)
  if (clinvarConflicting) {
    // Strong evidence: 3+ benign predictors outnumbering pathogenic
    const hasStrongBenignEvidence =
      computational.benignCount >= 3 && computational.benignCount > computational.pathogenicCount;
    // Very strong evidence: 4+ benign with low REVEL
    const hasVeryStrongBenignEvidence =
      computational.benignCount >= 4 &&
      revel < 0.3 &&
      computational.benignCount >= computational.pathogenicCount * 2;

    if (hasStrongBenignEvidence || hasVeryStrongBenignEvidence) {
      const benignPredictors = computational.predictors
        .filter((p) => p.interpretation === "Benign")
        .map((p) => p.name)
        .join(", ");

      return {
        classification: "Likely Benign",
        tier: "Tier IV",
        shouldReport: false,
        reasoning: `ClinVar conflicting (excluded from analysis). Strong benign computational evidence: ${computational.benignCount}/${computational.predictors.length} predictors benign (${benignPredictors})${revel < 0.3 ? `, REVEL ${revel.toFixed(3)}` : ""}. Not clinically actionable.`,
        evidence: {
          clinicalDatabases,
          computationalPredictors: computational.predictors,
          populationFrequency,
        },
      };
    }
  }

  // Benign: OncoKB Neutral + Multiple benign computational predictors
  const isOncoKBNeutral =
    oncoKBOncogenic.includes("neutral") || oncoKBOncogenic.includes("inconclusive");
  if (isOncoKBNeutral && computational.benignCount >= 2 && computational.pathogenicCount === 0) {
    return {
      classification: "Likely Benign",
      tier: "Tier IV",
      shouldReport: false,
      reasoning: `OncoKB ${oncokb?.oncogenic}, with ${computational.benignCount} benign computational predictions and no pathogenic signals. Not clinically significant.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // Likely Benign: Strong benign computational evidence without clinical database support
  // When ClinVar/OncoKB/COSMIC are unavailable or uninformative, rely on computational predictors
  // Requires: 4+ benign predictors AND REVEL < 0.3 (strong benign) AND benign outnumbers pathogenic by 3x
  const oncoKBUninformative = !oncokb?.oncogenic || oncokb.oncogenic.toLowerCase() === "unknown";
  if (
    !clinvarSig &&
    oncoKBUninformative &&
    cosmicCount === 0 &&
    computational.benignCount >= 4 &&
    revel < 0.3 &&
    computational.benignCount >= computational.pathogenicCount * 3
  ) {
    const benignPredictors = computational.predictors
      .filter((p) => p.interpretation === "Benign")
      .map((p) => p.name)
      .join(", ");

    return {
      classification: "Likely Benign",
      tier: "Tier IV",
      shouldReport: false,
      reasoning: `No clinical database evidence (ClinVar, OncoKB, COSMIC unavailable). Strong benign computational predictions: ${computational.benignCount}/${computational.predictors.length} predictors benign (${benignPredictors}). REVEL score ${revel.toFixed(3)} supports benign interpretation. Not clinically actionable.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Default: Tier III (VUS - Insufficient Evidence)
  // ═══════════════════════════════════════════════════════════════════════════

  // VUS with <50% VAF - Don't report
  if (vaf > 0 && vaf < 50) {
    // Check if we have any data at all
    const hasOncoKBData = oncokb?.found && oncokb?.oncogenic;
    const hasAnyData = data?.found || hasOncoKBData;

    // Build detailed computational summary
    let compSummary = "";
    if (!hasAnyData) {
      compSummary = " No information found in external databases, which hinders classification.";
    } else if (computational.predictors.length > 0) {
      const totalPredictors = computational.predictors.length;
      const uncertainCount =
        totalPredictors - computational.pathogenicCount - computational.benignCount;

      // Check REVEL status specifically
      const revelPredictor = computational.predictors.find((p) => p.name === "REVEL");
      const revelNote =
        revelPredictor && revelPredictor.interpretation === "Uncertain"
          ? ` REVEL ${revelPredictor.value} (borderline).`
          : "";

      if (
        computational.pathogenicCount > 0 ||
        computational.benignCount > 0 ||
        uncertainCount > 0
      ) {
        compSummary = ` ${computational.pathogenicCount}/${totalPredictors} predictors pathogenic, ${uncertainCount} uncertain, ${computational.benignCount} benign.${revelNote}`;
      }
    }

    return {
      classification: "VUS (Variant of Uncertain Significance)",
      tier: "Tier III",
      shouldReport: false,
      reasoning: `VUS with ${vaf}% VAF.${compSummary} Insufficient evidence for reporting.`,
      evidence: {
        clinicalDatabases,
        computationalPredictors: computational.predictors,
        populationFrequency,
      },
    };
  }

  // Default - VUS, insufficient evidence
  const vusReasons: string[] = [];
  const hasSomeData = data?.found;
  const hasOncoKBData = oncokb?.found && oncokb?.oncogenic;
  const hasAnyData = hasSomeData || hasOncoKBData;

  if (!hasAnyData) {
    // No data found from any API source
    vusReasons.push("no information found in MyVariant.info, OncoKB, ClinVar, or COSMIC");
    vusReasons.push("lack of external data hinders classification");
  } else if (!hasSomeData) {
    // OncoKB found but MyVariant.info not found
    vusReasons.push("variant not found in MyVariant.info");

    // Build summary of missing data
    const missingData: string[] = [];
    if (!clinvarSig) missingData.push("ClinVar");
    if (cosmicCount === 0) missingData.push("COSMIC");

    if (missingData.length > 0) {
      vusReasons.push(`no ${missingData.join(", ")} data`);
    }
  } else {
    // MyVariant.info found, build concise summary
    const missingData: string[] = [];
    if (!clinvarSig) missingData.push("ClinVar");
    if (!oncokb?.found || !oncokb.oncogenic) missingData.push("OncoKB");
    if (cosmicCount === 0) missingData.push("COSMIC");

    if (missingData.length > 0) {
      vusReasons.push(`no ${missingData.join(", ")} data`);
    }

    // Add detailed computational summary
    if (computational.predictors.length > 0) {
      const totalPredictors = computational.predictors.length;
      const uncertainCount =
        totalPredictors - computational.pathogenicCount - computational.benignCount;

      // Check REVEL status
      const revelPredictor = computational.predictors.find((p) => p.name === "REVEL");
      const revelInfo = revelPredictor
        ? revelPredictor.interpretation === "Uncertain"
          ? `REVEL ${revelPredictor.value} (borderline), `
          : ""
        : "";

      vusReasons.push(
        `${revelInfo}${computational.pathogenicCount}/${totalPredictors} predictors pathogenic, ${uncertainCount} uncertain`
      );
    }
  }

  return {
    classification: "VUS (Variant of Uncertain Significance)",
    tier: "Tier III",
    shouldReport: false,
    reasoning:
      vusReasons.length > 0
        ? `Insufficient evidence: ${vusReasons.join("; ")}.`
        : "Insufficient clinical or functional evidence for classification.",
    evidence: {
      clinicalDatabases,
      computationalPredictors: computational.predictors,
      populationFrequency,
    },
  };
}
