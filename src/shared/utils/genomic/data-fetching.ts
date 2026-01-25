/**
 * External API data fetching utilities
 * Fetches variant data from MyVariant.info and OncoKB
 */

import { ParsedVariant, VariantData, OncoKBData } from "./types";
import { normalizeClinvarSignificance } from "./clinvar";

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
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

/**
 * Fetch variant data from MyVariant.info
 * Uses multiple strategies: gene + protein, genomic coordinates, rsID
 */
export async function fetchVariantData(parsed: ParsedVariant): Promise<VariantData> {
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
      const proteinNotation = parsed.hgvs_p.replace("p.", "");

      // Handle stop codons: * notation needs to be converted to X or Ter for MyVariant.info
      // Example: Q2288* should search for Q2288X OR Q2288Ter OR Gln2288Ter
      let query: string;
      if (proteinNotation.includes("*")) {
        // Convert Q2288* to search for Q2288X OR Q2288Ter
        const baseNotation = proteinNotation.replace("*", "");
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

/**
 * Extract variant data from MyVariant.info response
 */
function extractVariantData(data: unknown): VariantData {
  if (!data || typeof data !== "object") {
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
    ((dbnsfp?.gnomad as Record<string, unknown>)?.af as number) ||
    ((dbnsfp?.gnomad_genome as Record<string, unknown>)?.af as number) ||
    ((dbnsfp?.gnomad_exome as Record<string, unknown>)?.af as number) ||
    (((d.gnomad_genome as Record<string, unknown>)?.af as Record<string, unknown>)?.af as number) ||
    (((d.gnomad_exome as Record<string, unknown>)?.af as Record<string, unknown>)?.af as number) ||
    null;

  // Extract REVEL score
  const revelRaw = (dbnsfp?.revel as Record<string, unknown>)?.score;
  const revel = Array.isArray(revelRaw) ? revelRaw[0] : (revelRaw as number) || null;

  // Extract CADD score
  const caddScore = (cadd?.phred as number) || null;

  // Extract GERP score
  const gerpScore =
    ((cadd?.gerp as Record<string, unknown>)?.rs as number) ||
    ((dbnsfp?.gerp as Record<string, unknown>)?.rs as number) ||
    null;

  // Extract SIFT prediction
  const siftRaw =
    (dbnsfp?.sift as Record<string, unknown>)?.pred || (cadd?.sift as Record<string, unknown>)?.cat;
  const sift = Array.isArray(siftRaw) ? siftRaw[0] : (siftRaw as string) || null;

  // Extract PolyPhen2 prediction
  const polyphenRaw =
    ((dbnsfp?.polyphen2 as Record<string, unknown>)?.hdiv as Record<string, unknown>)?.pred ||
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
    clinvarReviewStatus:
      ((clinvar?.rcv as Record<string, unknown>)?.review_status as string) ||
      (clinvar?.review_status as string),
    revel,
    cadd: caddScore,
    gerp: gerpScore,
    sift,
    polyphen2,
    raw: data,
  };
}

/**
 * Fetch OncoKB data for the variant
 */
export async function fetchOncoKBData(parsed: ParsedVariant): Promise<OncoKBData | null> {
  const apiKey = process.env.ONCOKB_API_KEY;

  if (!apiKey || !parsed.gene) {
    return null;
  }

  try {
    const alteration = parsed.hgvs_p?.replace("p.", "") || parsed.mutation;
    if (!alteration) return null;

    const params = new URLSearchParams({
      hugoSymbol: parsed.gene,
      alteration: alteration,
    });

    const url = `https://www.oncokb.org/api/v1/annotate/mutations/byProteinChange?${params.toString()}`;
    console.log(`Querying OncoKB: ${parsed.gene} ${alteration}`);

    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
      10000
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          found: false,
          oncogenic: null,
          highestSensitiveLevel: null,
          highestResistanceLevel: null,
        };
      }
      return null;
    }

    const data = await response.json();

    if (!data || !data.geneExist) {
      return {
        found: false,
        oncogenic: null,
        highestSensitiveLevel: null,
        highestResistanceLevel: null,
      };
    }

    console.log("✓ Found OncoKB data:", {
      oncogenic: data.oncogenic,
      highestSensitiveLevel: data.highestSensitiveLevel,
    });

    const therapeuticImplications = [];
    if (data.treatments && Array.isArray(data.treatments)) {
      for (const treatment of data.treatments.slice(0, 5)) {
        therapeuticImplications.push({
          level: treatment.level || "Unknown",
          drug:
            treatment.drugs?.map((d: { drugName: string }) => d.drugName).join(", ") || "Unknown",
          cancerType: treatment.cancerType || "Unknown",
        });
      }
    }

    return {
      found: true,
      oncogenic: data.oncogenic || null,
      highestSensitiveLevel: data.highestSensitiveLevel || null,
      highestResistanceLevel: data.highestResistanceLevel || null,
      therapeuticImplications:
        therapeuticImplications.length > 0 ? therapeuticImplications : undefined,
    };
  } catch (error) {
    console.error("OncoKB API error:", error);
    return null;
  }
}
