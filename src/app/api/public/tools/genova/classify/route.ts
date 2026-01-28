import { NextRequest, NextResponse } from "next/server";
import {
  parseVariantText,
  fetchVariantData,
  fetchOncoKBData,
  determineVariantType,
  detectTechnicalArtifact,
  classifyVariant,
  type AnalysisResult,
} from "@/shared/utils/genomic";

/**
 * POST /api/public/tools/genova/classify
 * Classify genomic variants using AMP/ASCO/CAP tiered system
 */
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
