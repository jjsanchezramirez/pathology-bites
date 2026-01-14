export interface ParsedVariant {
  gene: string | null;
  hgvs_g: string | null;
  hgvs_c: string | null;
  hgvs_p: string | null;
  transcript: string | null;
  vaf: number | null;
  isComplex: boolean;
  // Legacy fields
  rsid?: string | null;
  mutation?: string | null;
  cdna?: string | null;
}

export interface AnalysisResult {
  // AMP/ASCO/CAP fields
  tier?: string;
  action?: string;
  reportingStatus?: "NOT_DETECTED" | "DETECTED_NOT_REPORTED" | "DETECTED_REPORT" | "VUS";
  // ACMG fields
  classification?: string;
  criteria?: string[];
  // Common
  reasoning: string;
  shouldReport?: boolean;
}

export interface MyVariantData {
  success: boolean;
  found: boolean;
  variantId?: string;
  populationFrequency?: {
    gnomadAF: number | null;
    interpretation: string;
  };
  pathogenicity?: {
    revelScore: number | null;
    interpretation: string | null;
    sift?: string;
    polyphen2?: string;
    mutationTaster?: string | string[];
    cadd?: number;
  };
  clinvar?: {
    clinicalSignificance?: string;
    reviewStatus?: string;
    conditions?: string;
  } | null;
  somatic?: {
    cosmicId?: string;
    isCancerDriver: boolean;
    interpretation: string;
  };
  conservation?: {
    gerpScore: number | null;
    interpretation: string | null;
  };
  data?: unknown;
}

export interface OncoKBData {
  found: boolean;
  oncogenic?: string;
  mutationEffect?: string;
  highestSensitiveLevel?: string;
  highestResistanceLevel?: string;
  therapeuticImplications?: Array<{
    level: string;
    drug: string;
    cancerType: string;
  }>;
}

export interface AnalysisResponse {
  success: boolean;
  parsed: ParsedVariant;
  variantType?: string;
  technicalArtifact?: {
    isArtifact: boolean;
    reason: string | null;
  };
  ampResult?: AnalysisResult;
  acmgResult?: AnalysisResult;
  reporting?: {
    shouldReport: boolean;
    category: string;
    reasoning: string;
  };
  myvariant: MyVariantData | null;
  oncokb?: OncoKBData | null;
  error?: string;
}
