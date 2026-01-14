import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// TYPES
// =============================================================================

interface ParsedVariant {
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

interface VariantData {
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

interface OncoKBData {
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

type VariantType = "Somatic" | "Germline" | "Germline (Homozygous)" | "Unknown";

interface ClassificationResult {
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

interface AnalysisResult {
  success: boolean;
  parsed: ParsedVariant;
  variantType: VariantType;
  classification: ClassificationResult;
  technicalArtifact: { isArtifact: boolean; reason: string | null };
  variantData: VariantData | null;
  oncokb: OncoKBData | null;
}

// =============================================================================
// PARSING
// =============================================================================

function parseVariantText(text: string): ParsedVariant {
  const result: ParsedVariant = {
    gene: null,
    hgvs_g: null,
    hgvs_c: null,
    hgvs_p: null,
    transcript: null,
    vaf: null,
    isComplex: false,
  };

  // Extract gene symbol
  const geneMatch = text.match(/\b([A-Z][A-Z0-9]{1,10})\b/);
  if (geneMatch) result.gene = geneMatch[1];

  // Extract VCF-style notation (chr:pos:ref:alt)
  const vcfMatch = text.match(/(\d+):(\d+):([ACGT]+):([ACGT]+)/i);
  if (vcfMatch) {
    const [, chr, pos, ref, alt] = vcfMatch;
    result.hgvs_g = `chr${chr}:g.${pos}${ref}>${alt}`;
  }

  // Extract HGVS genomic notation (fallback if VCF not found)
  if (!result.hgvs_g) {
    const hgvsGMatch = text.match(
      /(chr\d+|NC_\d+\.\d+):g\.(\d+)([A-Z]>[A-Z]|del[A-Z]+|ins[A-Z]+|dup[A-Z]*|_\d+del|_\d+dup)/i
    );
    if (hgvsGMatch) result.hgvs_g = hgvsGMatch[0];
  }

  // Extract HGVS coding notation (with c. prefix)
  const hgvsCMatch = text.match(
    /c\.(\d+(?:_\d+)?)(del(?:[A-Z]+|\d+)?|ins(?:[A-Z]+|\d+)?|dup(?:[A-Z]+|\d+)?|[A-Z]>[A-Z])/i
  );
  if (hgvsCMatch) {
    result.hgvs_c = hgvsCMatch[0];
    result.isComplex = /del|ins|dup|_/.test(hgvsCMatch[0]);
  }

  // Extract bare coding notation without c. prefix (e.g., "5266dupC", "5266dup", "185delAG", "2235_2249del15")
  if (!result.hgvs_c) {
    const bareMatch = text.match(
      /\b(\d+(?:_\d+)?)(del(?:[A-Z]+|\d+)?|ins(?:[A-Z]+|\d+)?|dup(?:[A-Z]+|\d+)?)\b/i
    );
    if (bareMatch && bareMatch[0].length >= 4) {
      // Ensure at least "1dup" minimum length to avoid false positives
      result.hgvs_c = `c.${bareMatch[0]}`;
      result.isComplex = true;
    }
  }

  // Extract HGVS protein notation
  const hgvsPMatch = text.match(
    /p\.([A-Z][a-z]{2}\d+[A-Z][a-z]{2}|[A-Z]\d+[A-Z]|[A-Z]\d+fs|[A-Z]\d+\*)/i
  );
  if (hgvsPMatch) {
    result.hgvs_p = hgvsPMatch[0];
  } else {
    // Extract short protein notation (e.g., D94H, V600E, Q1329*)
    // Pattern matches: Single letter + digits + (single letter OR fs OR *)
    const shortProtMatches = text.match(/\b([A-Z]\d+(?:[A-Z](?:fs)?|\*|fs))(?:\b|\s|$)/g);
    if (shortProtMatches) {
      for (const matchedText of shortProtMatches) {
        const cleanMatch = matchedText.match(/([A-Z]\d+(?:[A-Z](?:fs)?|\*|fs))/)?.[1];
        // Avoid matching if it's part of the gene name
        // Also avoid matching transcript IDs (they have underscores or periods nearby)
        if (cleanMatch && (!result.gene || !result.gene.includes(cleanMatch))) {
          // Additional check: make sure it's not immediately after NM_ or NP_ (within 5 chars)
          const matchIndex = text.indexOf(cleanMatch);
          const precedingText = text.substring(Math.max(0, matchIndex - 5), matchIndex);
          if (!precedingText.match(/NM_|NP_|ENST/)) {
            result.hgvs_p = `p.${cleanMatch}`;
            break;
          }
        }
      }
    }
  }

  // Extract transcript ID
  const transcriptMatch = text.match(/(NM_\d+\.\d+|ENST\d+\.\d+)/i);
  if (transcriptMatch) result.transcript = transcriptMatch[1];

  // Extract VAF
  const vafMatch = text.match(/VAF[:\s]*(\d+\.?\d*)%?/i);
  if (vafMatch) result.vaf = parseFloat(vafMatch[1]);

  // Legacy fields
  const rsidMatch = text.match(/rs\d+/i);
  if (rsidMatch) result.rsid = rsidMatch[0];

  const mutationMatches = text.match(/\b([A-Z]\d+(?:[A-Z](?:fs)?|\*|fs))(?:\b|\s|$)/g);
  if (mutationMatches) {
    for (const matchedText of mutationMatches) {
      const cleanMatch = matchedText.match(/([A-Z]\d+(?:[A-Z](?:fs)?|\*|fs))/)?.[1];
      if (cleanMatch && (!result.gene || !result.gene.includes(cleanMatch))) {
        result.mutation = cleanMatch;
        break;
      }
    }
  }

  const cdnaMatch = text.match(/c\.\d+[A-Z]>[A-Z]/i);
  if (cdnaMatch) result.cdna = cdnaMatch[0];

  return result;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function normalizeClinvarSignificance(clinicalSignificance: unknown): string | null {
  if (!clinicalSignificance) return null;

  let sigString: string | null = null;

  if (typeof clinicalSignificance === 'string') {
    sigString = clinicalSignificance;
  } else if (Array.isArray(clinicalSignificance) && clinicalSignificance.length > 0) {
    // Check for array BEFORE checking for object (since arrays are objects in JS)
    sigString = clinicalSignificance.filter(item => typeof item === 'string').join(';');
  } else if (typeof clinicalSignificance === 'object' && clinicalSignificance !== null) {
    const obj = clinicalSignificance as { description?: string };
    if (obj.description && typeof obj.description === 'string') {
      sigString = obj.description;
    }
  }

  if (!sigString) return null;

  sigString = sigString.toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1;$2')
    .replace(/_/g, ';')
    .replace(/([a-z])(drug|other|association|risk|benign|pathogenic|conflicting|uncertain)/gi, '$1;$2');

  const parts = sigString.split(/[;,|\/]+/).map(s => s.trim()).filter(Boolean);

  // Check for conflicting interpretations
  // Pathogenic/Likely Pathogenic vs Benign/Likely Benign = conflict
  const hasPathogenic = parts.some(p =>
    p.includes('pathogenic') && !p.includes('benign')
  );
  const hasBenign = parts.some(p =>
    p.includes('benign') && !p.includes('pathogenic')
  );

  // True conflict: both pathogenic AND benign interpretations present
  if (hasPathogenic && hasBenign) {
    return 'Conflicting';
  }

  // No conflict detected, return based on priority
  const priorityOrder = ['pathogenic', 'likely pathogenic', 'uncertain significance', 'likely benign', 'benign', 'conflicting'];

  for (const priority of priorityOrder) {
    const found = parts.find(part => part.includes(priority.toLowerCase()));
    if (found) {
      // Convert to sentence case: "pathogenic" -> "Pathogenic", "likely pathogenic" -> "Likely Pathogenic"
      return found
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  // Fallback: convert first part to sentence case
  const fallback = parts[0] || sigString;
  return fallback
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function fetchVariantData(parsed: ParsedVariant): Promise<VariantData> {
  const emptyResult: VariantData = {
    found: false,
    gnomadAF: null,
    cosmicCount: 0,
    clinvarSignificance: null,
    revel: null,
    cadd: null,
    gerp: null,
    sift: null,
    polyphen2: null,
  };

  // Strategy 1: Gene + Protein Change (most reliable)
  if (parsed.gene && parsed.hgvs_p) {
    try {
      const proteinNotation = parsed.hgvs_p.replace('p.', '');

      // Handle stop codons: * notation needs to be converted to X or Ter for MyVariant.info
      // Example: Q2288* should search for Q2288X OR Q2288Ter OR Gln2288Ter
      let query: string;
      if (proteinNotation.includes('*')) {
        // Convert Q2288* to search for Q2288X OR Q2288Ter
        const baseNotation = proteinNotation.replace('*', '');
        query = `dbnsfp.genename:${parsed.gene} AND (dbnsfp.hgvsp:*${baseNotation}X* OR dbnsfp.hgvsp:*${baseNotation}Ter*)`;
      } else {
        query = `dbnsfp.genename:${parsed.gene} AND dbnsfp.hgvsp:*${proteinNotation}*`;
      }

      const res = await fetch(
        `https://myvariant.info/v1/query?q=${encodeURIComponent(query)}&fields=_id,dbnsfp,clinvar,cadd,cosmic,gnomad_genome,gnomad_exome,dbsnp`,
        { headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const results = await res.json();
        if (results.hits && results.hits.length > 0) {
          console.log("✓ Found via gene + protein query");
          return extractVariantData(results.hits[0]);
        }
      }
    } catch (error) {
      console.error("Gene + protein search failed:", error);
    }
  }

  // Strategy 2: Direct HGVS Genomic
  if (parsed.hgvs_g) {
    try {
      const res = await fetch(
        `https://myvariant.info/v1/variant/${encodeURIComponent(parsed.hgvs_g)}`,
        { headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && !data.notfound) {
          console.log("✓ Found via HGVS genomic");
          return extractVariantData(data);
        }
      }
    } catch (error) {
      console.error("HGVS genomic search failed:", error);
    }
  }

  // Strategy 3: rsID
  if (parsed.rsid) {
    try {
      const res = await fetch(
        `https://myvariant.info/v1/variant/${encodeURIComponent(parsed.rsid)}`,
        { headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && !data.notfound) {
          console.log("✓ Found via rsID");
          return extractVariantData(data);
        }
      }
    } catch (error) {
      console.error("rsID search failed:", error);
    }
  }

  console.log("✗ No variant found");
  return emptyResult;
}

function extractVariantData(data: unknown): VariantData {
  if (!data || typeof data !== 'object') {
    return {
      found: false,
      gnomadAF: null,
      cosmicCount: 0,
      clinvarSignificance: null,
      revel: null,
      cadd: null,
      gerp: null,
      sift: null,
      polyphen2: null,
    };
  }

  const d = data as Record<string, unknown>;
  const dbnsfp = d.dbnsfp as Record<string, unknown> | undefined;
  const cadd = d.cadd as Record<string, unknown> | undefined;
  const cosmic = d.cosmic as Record<string, unknown> | undefined;
  // Prioritize d.clinvar (has full RCV data) over dbnsfp.clinvar (only has clnsig)
  const clinvar = (d.clinvar || dbnsfp?.clinvar) as Record<string, unknown> | undefined;

  // Extract gnomAD AF from multiple possible paths
  const gnomadAF =
    (dbnsfp?.gnomad as Record<string, unknown>)?.af as number ||
    (dbnsfp?.gnomad_genome as Record<string, unknown>)?.af as number ||
    (dbnsfp?.gnomad_exome as Record<string, unknown>)?.af as number ||
    ((d.gnomad_genome as Record<string, unknown>)?.af as Record<string, unknown>)?.af as number ||
    ((d.gnomad_exome as Record<string, unknown>)?.af as Record<string, unknown>)?.af as number ||
    null;

  // Extract REVEL score
  const revelRaw = (dbnsfp?.revel as Record<string, unknown>)?.score;
  const revel = Array.isArray(revelRaw) ? revelRaw[0] : (revelRaw as number) || null;

  // Extract CADD score
  const caddScore = (cadd?.phred as number) || null;

  // Extract GERP score
  const gerpScore = (cadd?.gerp as Record<string, unknown>)?.rs as number ||
                    (dbnsfp?.gerp as Record<string, unknown>)?.rs as number || null;

  // Extract SIFT prediction
  const siftRaw = (dbnsfp?.sift as Record<string, unknown>)?.pred ||
                  (cadd?.sift as Record<string, unknown>)?.cat;
  const sift = Array.isArray(siftRaw) ? siftRaw[0] : (siftRaw as string) || null;

  // Extract PolyPhen2 prediction
  const polyphenRaw = ((dbnsfp?.polyphen2 as Record<string, unknown>)?.hdiv as Record<string, unknown>)?.pred ||
                      (cadd?.polyphen as Record<string, unknown>)?.cat;
  const polyphen2 = Array.isArray(polyphenRaw) ? polyphenRaw[0] : (polyphenRaw as string) || null;

  // Extract ClinVar significance
  // Handle both single RCV and array of RCVs
  let clinvarSig: unknown = null;
  if (clinvar?.rcv) {
    if (Array.isArray(clinvar.rcv)) {
      // Extract all clinical_significance values from the array
      const extracted = clinvar.rcv
        .map((r: Record<string, unknown>) => r.clinical_significance)
        .filter(Boolean);
      // Only use array if it has values
      if (extracted.length > 0) {
        clinvarSig = extracted;
      }
    } else {
      clinvarSig = (clinvar.rcv as Record<string, unknown>).clinical_significance;
    }
  }
  if (!clinvarSig) {
    clinvarSig = clinvar?.clinical_significance || clinvar?.clnsig;
  }

  // Extract COSMIC count
  const cosmicCount = (cosmic?.cnt as number) || 0;

  return {
    found: true,
    variantId: d._id as string,
    gnomadAF,
    cosmicCount,
    clinvarSignificance: normalizeClinvarSignificance(clinvarSig),
    clinvarReviewStatus: (clinvar?.rcv as Record<string, unknown>)?.review_status as string || clinvar?.review_status as string,
    revel,
    cadd: caddScore,
    gerp: gerpScore,
    sift,
    polyphen2,
    raw: data,
  };
}

async function fetchOncoKBData(parsed: ParsedVariant): Promise<OncoKBData | null> {
  const apiKey = process.env.ONCOKB_API_KEY;

  if (!apiKey || !parsed.gene) {
    return null;
  }

  try {
    const alteration = parsed.hgvs_p?.replace('p.', '') || parsed.mutation;
    if (!alteration) return null;

    const params = new URLSearchParams({
      hugoSymbol: parsed.gene,
      alteration: alteration,
    });

    const url = `https://www.oncokb.org/api/v1/annotate/mutations/byProteinChange?${params.toString()}`;
    console.log(`Querying OncoKB: ${parsed.gene} ${alteration}`);

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    }, 10000);

    if (!response.ok) {
      if (response.status === 404) {
        return { found: false, oncogenic: null, highestSensitiveLevel: null, highestResistanceLevel: null };
      }
      return null;
    }

    const data = await response.json();

    if (!data || !data.geneExist) {
      return { found: false, oncogenic: null, highestSensitiveLevel: null, highestResistanceLevel: null };
    }

    console.log("✓ Found OncoKB data:", {
      oncogenic: data.oncogenic,
      highestSensitiveLevel: data.highestSensitiveLevel,
    });

    const therapeuticImplications = [];
    if (data.treatments && Array.isArray(data.treatments)) {
      for (const treatment of data.treatments.slice(0, 5)) {
        therapeuticImplications.push({
          level: treatment.level || 'Unknown',
          drug: treatment.drugs?.map((d: { drugName: string }) => d.drugName).join(', ') || 'Unknown',
          cancerType: treatment.cancerType || 'Unknown',
        });
      }
    }

    return {
      found: true,
      oncogenic: data.oncogenic || null,
      highestSensitiveLevel: data.highestSensitiveLevel || null,
      highestResistanceLevel: data.highestResistanceLevel || null,
      therapeuticImplications: therapeuticImplications.length > 0 ? therapeuticImplications : undefined,
    };
  } catch (error) {
    console.error("OncoKB API error:", error);
    return null;
  }
}

// =============================================================================
// CLASSIFICATION LOGIC
// =============================================================================

function determineVariantType(vaf: number | null, _gnomadAF: number | null): VariantType {
  if (vaf === null || vaf === 0) return "Unknown";
  
  if (vaf >= 90) return "Germline (Homozygous)";
  if (vaf >= 45 && vaf <= 55) return "Germline";
  if (vaf < 45) return "Somatic";
  
  return "Unknown";
}

function detectTechnicalArtifact(parsed: ParsedVariant): { isArtifact: boolean; reason: string | null } {
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
  predictors: { name: string; value: string | number; interpretation: "Pathogenic" | "Benign" | "Uncertain" }[];
} {
  const predictors: { name: string; value: string | number; interpretation: "Pathogenic" | "Benign" | "Uncertain" }[] = [];
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
    if (siftLower.includes('deleterious') || siftLower === 'd') {
      pathogenicCount++;
      interpretation = "Pathogenic";
    } else if (siftLower.includes('tolerated') || siftLower === 't') {
      benignCount++;
      interpretation = "Benign";
    }
    predictors.push({ name: "SIFT", value: data.sift, interpretation });
  }

  // PolyPhen2
  if (data.polyphen2) {
    const ppLower = data.polyphen2.toLowerCase();
    let interpretation: "Pathogenic" | "Benign" | "Uncertain" = "Uncertain";
    if (ppLower.includes('damaging') || ppLower === 'd') {
      pathogenicCount++;
      interpretation = "Pathogenic";
    } else if (ppLower.includes('benign') || ppLower === 'b') {
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
function classifyVariant(
  parsed: ParsedVariant,
  variantType: VariantType,
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
  const clinvarPathogenic = clinvarSigLower.includes("pathogenic") && !clinvarSigLower.includes("likely") && !clinvarConflicting;
  const clinvarLikelyPathogenic = clinvarSigLower.includes("likely pathogenic") && !clinvarConflicting;
  const _clinvarBenign = clinvarSig.includes("benign") && !clinvarSig.includes("likely") && !clinvarConflicting;
  const _clinvarLikelyBenign = clinvarSig.includes("likely benign") && !clinvarConflicting;
  
  const oncoKBOncogenic = oncokb?.oncogenic?.toLowerCase() || "";
  const isOncoKBOncogenic = oncoKBOncogenic.includes("oncogenic") &&
                            !oncoKBOncogenic.includes("likely") &&
                            !oncoKBOncogenic.includes("predicted");
  const isOncoKBLikelyOncogenic = oncoKBOncogenic.includes("likely oncogenic") ||
                                  oncoKBOncogenic.includes("likely pathogenic");
  
  const computational = data ? countComputationalEvidence(data) : { pathogenicCount: 0, benignCount: 0, predictors: [] };
  
  // Build evidence summary
  const clinicalDatabases: string[] = [];
  if (clinvarSig) clinicalDatabases.push(`ClinVar: ${clinvarSig}`);
  if (oncokb?.found && oncokb.oncogenic) clinicalDatabases.push(`OncoKB: ${oncokb.oncogenic}`);
  if (cosmicCount > 0) clinicalDatabases.push(`COSMIC: ${cosmicCount} occurrences`);
  
  const populationFrequency = gnomadAF > 0
    ? `gnomAD AF: ${(gnomadAF * 100).toFixed(4)}%`
    : "Not found in gnomAD";

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: TECHNICAL ARTIFACT FILTER
  // ═══════════════════════════════════════════════════════════════════════════
  
  if (artifactCheck.isArtifact) {
    return {
      classification: "Not Detected (Technical Artifact)",
      tier: "Excluded",
      shouldReport: false,
      reasoning: artifactCheck.reason || "Technical artifact detected",
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
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
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }
  
  // BS1: gnomAD AF > 1% → Likely Benign
  if (gnomadAF > 0.01) {
    return {
      classification: "Likely Benign",
      tier: "BS1",
      shouldReport: false,
      reasoning: `Polymorphic variant (gnomAD AF=${(gnomadAF * 100).toFixed(4)}%). Strong benign evidence.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }
  
  // Germline polymorphism at ~50% VAF - ONLY if no strong pathogenic evidence
  // Don't apply this rule if there's ClinVar pathogenic, OncoKB oncogenic, or therapeutic levels
  const hasStrongPathogenicEvidence =
    clinvarPathogenic ||
    clinvarLikelyPathogenic ||
    isOncoKBOncogenic ||
    isOncoKBLikelyOncogenic ||
    (oncokb?.highestSensitiveLevel && ["LEVEL_1", "LEVEL_2", "LEVEL_3A", "LEVEL_3B"].includes(oncokb.highestSensitiveLevel));

  if (vaf >= 45 && vaf <= 55 && gnomadAF > 0.0001 && !hasStrongPathogenicEvidence) {
    return {
      classification: "Likely Benign (Germline Polymorphism)",
      tier: "BS1/BP6",
      shouldReport: false,
      reasoning: `VAF ~50% with population frequency (gnomAD AF=${(gnomadAF * 100).toFixed(4)}%). Likely germline polymorphism with no pathogenic evidence.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
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
    const drugs = oncokb.therapeuticImplications?.map(t => t.drug).join(", ") || "available";
    return {
      classification: "Pathogenic",
      tier: "Tier I (Level A)",
      shouldReport: true,
      reasoning: `FDA-approved therapy (OncoKB ${oncokb.highestSensitiveLevel}). Drugs: ${drugs}. Strong clinical significance.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // Level B: Well-powered studies - OncoKB Oncogenic + ClinVar Pathogenic + Highly recurrent
  if (isOncoKBOncogenic && clinvarPathogenic && cosmicCount > 50) {
    return {
      classification: "Pathogenic",
      tier: "Tier I (Level B)",
      shouldReport: true,
      reasoning: `Convergent evidence from multiple sources: OncoKB oncogenic, ClinVar pathogenic, COSMIC n=${cosmicCount}. Strong clinical significance.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // Level B: ClinVar Pathogenic + Highly recurrent
  if (clinvarPathogenic && cosmicCount > 100) {
    return {
      classification: "Pathogenic",
      tier: "Tier I (Level B)",
      shouldReport: true,
      reasoning: `ClinVar pathogenic, highly recurrent driver (COSMIC n=${cosmicCount}). Strong clinical significance.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Tier II: Potential Clinical Significance
  // Level C: FDA-approved for different tumor type, or multiple small studies
  // Level D: Preclinical or case studies only
  // ─────────────────────────────────────────────────────────────────

  // Level C: Clinical trial evidence (OncoKB Level 3A/3B)
  if (oncokb?.highestSensitiveLevel === "LEVEL_3A" || oncokb?.highestSensitiveLevel === "LEVEL_3B") {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level C)",
      shouldReport: true,
      reasoning: `Clinical evidence from trials (OncoKB ${oncokb.highestSensitiveLevel}). Potential clinical significance.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
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
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // ClinVar Pathogenic (single source)
  if (clinvarPathogenic) {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: true,
      reasoning: "ClinVar pathogenic. Potential clinical significance (single database).",
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // OncoKB Likely Oncogenic
  if (isOncoKBLikelyOncogenic) {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: true,
      reasoning: "OncoKB likely oncogenic. Potential clinical significance.",
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // ClinVar Likely Pathogenic
  if (clinvarLikelyPathogenic) {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: true,
      reasoning: "ClinVar likely pathogenic. Potential clinical significance.",
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // Highly recurrent in COSMIC (>50)
  if (cosmicCount > 50) {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: true,
      reasoning: `Highly recurrent in cancer (COSMIC n=${cosmicCount}). Potential clinical significance.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // OncoKB Level 4 (biological evidence)
  if (oncokb?.highestSensitiveLevel === "LEVEL_4") {
    return {
      classification: "Likely Pathogenic",
      tier: "Tier II (Level D)",
      shouldReport: false,
      reasoning: `Biological evidence (OncoKB LEVEL_4). Potential significance, preclinical only.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // Moderately recurrent in COSMIC (10-50)
  if (cosmicCount >= 10 && cosmicCount <= 50) {
    return {
      classification: "VUS",
      tier: "Tier II (Level D)",
      shouldReport: false,
      reasoning: `Recurrent in cancer (COSMIC n=${cosmicCount}). Limited evidence, potential significance.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tier III: Unknown Clinical Significance (VUS)
  // ═══════════════════════════════════════════════════════════════════════════
  const revel = data?.revel || 0;
  const cadd = data?.cadd || 0;

  // Strong computational evidence only (no clinical evidence): REVEL > 0.75 AND CADD > 25 AND gnomAD < 0.001
  // This is still VUS in AMP guidelines but reportable due to strong predictions
  if (revel > 0.75 && cadd > 25 && gnomadAF < 0.001) {
    const pathogenicPredictors = computational.predictors
      .filter(p => p.interpretation === "Pathogenic")
      .map(p => p.name);

    return {
      classification: "VUS (Strong Computational Evidence)",
      tier: "Tier III",
      shouldReport: true,
      reasoning: `Strong computational predictions (REVEL=${revel.toFixed(3)}, CADD=${cadd}). ${computational.pathogenicCount}/${computational.pathogenicCount + computational.benignCount} predictors pathogenic${pathogenicPredictors.length > 0 ? ` (${pathogenicPredictors.join(", ")})` : ""}. Extremely rare (gnomAD AF=${(gnomadAF * 100).toFixed(4)}%). Unknown clinical significance.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // Borderline REVEL (0.5-0.75): VUS with context
  if (revel >= 0.5 && revel <= 0.75 && !clinvarSig && !oncokb?.found && cosmicCount === 0) {
    const summary = `${computational.pathogenicCount} pathogenic, ${computational.benignCount} benign`;
    const tilt = computational.pathogenicCount > computational.benignCount
      ? "favor pathogenicity"
      : computational.benignCount > computational.pathogenicCount
        ? "favor benign"
        : "inconclusive";

    return {
      classification: "VUS (Variant of Uncertain Significance)",
      tier: "Tier III",
      shouldReport: false,
      reasoning: `Borderline REVEL (${revel.toFixed(3)}). Computational predictors (${summary}) ${tilt}. No ClinVar, OncoKB, or COSMIC data. Clinical correlation recommended.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
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
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // Likely Benign: Conflicting ClinVar + Strong benign computational evidence
  // When ClinVar is conflicting, rely on computational predictors
  if (clinvarConflicting && computational.benignCount >= 3 && computational.benignCount > computational.pathogenicCount) {
    const benignPredictors = computational.predictors
      .filter(p => p.interpretation === "Benign")
      .map(p => p.name)
      .join(", ");

    return {
      classification: "Likely Benign",
      tier: "Tier IV",
      shouldReport: false,
      reasoning: `ClinVar conflicting (excluded from analysis). Strong benign computational evidence: ${computational.benignCount}/${computational.predictors.length} predictors benign (${benignPredictors}). Not clinically actionable.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
    };
  }

  // Benign: OncoKB Neutral + Multiple benign computational predictors
  const isOncoKBNeutral = oncoKBOncogenic.includes("neutral") || oncoKBOncogenic.includes("inconclusive");
  if (isOncoKBNeutral && computational.benignCount >= 2 && computational.pathogenicCount === 0) {
    return {
      classification: "Likely Benign",
      tier: "Tier IV",
      shouldReport: false,
      reasoning: `OncoKB ${oncokb?.oncogenic}, with ${computational.benignCount} benign computational predictions and no pathogenic signals. Not clinically significant.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
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
      const uncertainCount = totalPredictors - computational.pathogenicCount - computational.benignCount;

      // Check REVEL status specifically
      const revelPredictor = computational.predictors.find(p => p.name === "REVEL");
      const revelNote = revelPredictor && revelPredictor.interpretation === "Uncertain"
        ? ` REVEL ${revelPredictor.value} (borderline).`
        : "";

      if (computational.pathogenicCount > 0 || computational.benignCount > 0 || uncertainCount > 0) {
        compSummary = ` ${computational.pathogenicCount}/${totalPredictors} predictors pathogenic, ${uncertainCount} uncertain, ${computational.benignCount} benign.${revelNote}`;
      }
    }

    return {
      classification: "VUS (Variant of Uncertain Significance)",
      tier: "Tier III",
      shouldReport: false,
      reasoning: `VUS with ${vaf}% VAF.${compSummary} Insufficient evidence for reporting.`,
      evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
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
      const uncertainCount = totalPredictors - computational.pathogenicCount - computational.benignCount;

      // Check REVEL status
      const revelPredictor = computational.predictors.find(p => p.name === "REVEL");
      const revelInfo = revelPredictor
        ? revelPredictor.interpretation === "Uncertain"
          ? `REVEL ${revelPredictor.value} (borderline), `
          : ""
        : "";

      vusReasons.push(`${revelInfo}${computational.pathogenicCount}/${totalPredictors} predictors pathogenic, ${uncertainCount} uncertain`);
    }
  }

  return {
    classification: "VUS (Variant of Uncertain Significance)",
    tier: "Tier III",
    shouldReport: false,
    reasoning: vusReasons.length > 0
      ? `Insufficient evidence: ${vusReasons.join("; ")}.`
      : "Insufficient clinical or functional evidence for classification.",
    evidence: { clinicalDatabases, computationalPredictors: computational.predictors, populationFrequency },
  };
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawText } = body;

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json({ error: "rawText parameter is required" }, { status: 400 });
    }

    // Parse variant text
    const parsed = parseVariantText(rawText);

    // Check if we have sufficient identifiers
    if (!parsed.hgvs_g && !parsed.hgvs_c && !parsed.transcript && !parsed.rsid && !parsed.gene) {
      return NextResponse.json({
        success: false,
        error: "Could not extract sufficient variant identifiers",
        parsed,
      });
    }

    // Fetch variant data
    const variantData = await fetchVariantData(parsed);

    // Fetch OncoKB data
    const oncokb = await fetchOncoKBData(parsed);

    // Determine variant type
    const variantType = determineVariantType(parsed.vaf, variantData.gnomadAF);

    // Check for technical artifacts
    const artifactCheck = detectTechnicalArtifact(parsed);

    // UNIFIED CLASSIFICATION
    const classification = classifyVariant(
      parsed,
      variantType,
      variantData.found ? variantData : null,
      oncokb,
      artifactCheck
    );

    // Build response
    const result: AnalysisResult = {
      success: true,
      parsed,
      variantType,
      classification,
      technicalArtifact: artifactCheck,
      variantData: variantData.found ? variantData : null,
      oncokb,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Genomic analysis error:", error);
    return NextResponse.json({ error: "Failed to analyze genomic data" }, { status: 500 });
  }
}