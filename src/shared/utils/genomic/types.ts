/**
 * Shared types for genomic variant analysis
 */

export interface ParsedVariant {
  gene: string | null;
  hgvs_g: string | null;
  hgvs_c: string | null;
  hgvs_p: string | null;
  transcript: string | null;
  vaf: number | null;
  isComplex: boolean;
  rsid?: string | null;
  mutation?: string | null;
  cdna?: string | null;
}

export interface VariantData {
  found: boolean;
  variantId?: string;
  gnomadAF: number | null;
  cosmicCount: number;
  clinvarSignificance: string | null;
  clinvarReviewStatus?: string;
  // Computational predictors (5 core predictors, excluding MutationTaster)
  revel: number | null;
  cadd: number | null;
  gerp: number | null;
  sift: string | null;
  polyphen2: string | null;
  // Raw data for debugging
  raw?: unknown;
}

export interface OncoKBData {
  found: boolean;
  oncogenic: string | null;
  highestSensitiveLevel: string | null;
  highestResistanceLevel: string | null;
  therapeuticImplications?: Array<{
    level: string;
    drug: string;
    cancerType: string;
  }>;
}

export type VariantType = "Somatic" | "Germline" | "Germline (Homozygous)" | "Unknown";

export interface ClassificationResult {
  classification: string;
  tier: string;
  shouldReport: boolean;
  reasoning: string;
  evidence: {
    clinicalDatabases: string[];
    computationalPredictors: {
      name: string;
      value: string | number;
      interpretation: "Pathogenic" | "Benign" | "Uncertain";
    }[];
    populationFrequency: string;
  };
}

export interface AnalysisResult {
  success: boolean;
  parsed: ParsedVariant;
  variantType: VariantType;
  classification: ClassificationResult;
  technicalArtifact: { isArtifact: boolean; reason: string | null };
  variantData: VariantData | null;
  oncokb: OncoKBData | null;
}
