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
 * @swagger
 * /api/public/tools/genova/classify:
 *   post:
 *     summary: Classify genomic variants
 *     description: Classify genomic variants using AMP/ASCO/CAP tiered system. Analyzes variant text to determine pathogenicity, clinical significance, and detects technical artifacts.
 *     tags:
 *       - Public - Tools
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rawText
 *             properties:
 *               rawText:
 *                 type: string
 *                 description: Raw variant text containing gene, variant, and VAF information
 *                 example: "TP53 c.524G>A (p.Arg175His) VAF 45%"
 *     responses:
 *       200:
 *         description: Successfully classified genomic variant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 parsed:
 *                   type: object
 *                   description: Parsed variant information
 *                   properties:
 *                     gene:
 *                       type: string
 *                     hgvs_c:
 *                       type: string
 *                     hgvs_p:
 *                       type: string
 *                     hgvs_g:
 *                       type: string
 *                     transcript:
 *                       type: string
 *                     rsid:
 *                       type: string
 *                     vaf:
 *                       type: number
 *                 variantType:
 *                   type: string
 *                   enum: [somatic, germline, artifact, unknown]
 *                   description: Determined variant type based on VAF and population frequency
 *                 classification:
 *                   type: object
 *                   description: AMP/ASCO/CAP classification
 *                   properties:
 *                     tier:
 *                       type: string
 *                     level:
 *                       type: string
 *                     interpretation:
 *                       type: string
 *                 technicalArtifact:
 *                   type: object
 *                   description: Technical artifact detection results
 *                   properties:
 *                     isArtifact:
 *                       type: boolean
 *                     reason:
 *                       type: string
 *                 variantData:
 *                   type: object
 *                   description: External variant database information (if found)
 *                   nullable: true
 *                 oncokb:
 *                   type: object
 *                   description: OncoKB annotation data
 *                   nullable: true
 *       400:
 *         description: Bad request - rawText is required or insufficient variant identifiers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: rawText parameter is required
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 parsed:
 *                   type: object
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to analyze genomic data
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
