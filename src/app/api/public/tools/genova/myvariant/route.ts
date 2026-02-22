import { NextRequest, NextResponse } from "next/server";

/**
 * @swagger
 * /api/public/tools/genova/myvariant:
 *   get:
 *     summary: Get variant information from MyVariant.info
 *     description: Retrieve comprehensive variant annotation data from MyVariant.info database including population frequency, pathogenicity predictions, ClinVar significance, and COSMIC cancer driver information.
 *     tags:
 *       - Public - Tools
 *     parameters:
 *       - in: query
 *         name: rsid
 *         schema:
 *           type: string
 *         description: dbSNP rsID (e.g., rs121913343)
 *         example: rs121913343
 *       - in: query
 *         name: hgvs
 *         schema:
 *           type: string
 *         description: HGVS notation (e.g., chr17:g.7577121C>T)
 *         example: chr17:g.7577121C>T
 *     responses:
 *       200:
 *         description: Successfully retrieved variant information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 found:
 *                   type: boolean
 *                   description: Whether the variant was found in the database
 *                 variantId:
 *                   type: string
 *                   description: MyVariant.info internal ID
 *                 rsid:
 *                   type: string
 *                   description: dbSNP rsID
 *                 populationFrequency:
 *                   type: object
 *                   properties:
 *                     gnomadAF:
 *                       type: number
 *                       nullable: true
 *                       description: gnomAD allele frequency
 *                     interpretation:
 *                       type: string
 *                       description: Clinical interpretation based on frequency (Common/Polymorphic/Rare)
 *                 pathogenicity:
 *                   type: object
 *                   properties:
 *                     revelScore:
 *                       type: number
 *                       nullable: true
 *                       description: REVEL pathogenicity score (0-1)
 *                     interpretation:
 *                       type: string
 *                       nullable: true
 *                       description: Pathogenicity interpretation
 *                     sift:
 *                       type: string
 *                       nullable: true
 *                       description: SIFT prediction
 *                     polyphen2:
 *                       type: string
 *                       nullable: true
 *                       description: PolyPhen-2 prediction
 *                     mutationTaster:
 *                       type: string
 *                       nullable: true
 *                       description: MutationTaster prediction
 *                 clinvar:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     clinicalSignificance:
 *                       type: string
 *                       description: ClinVar clinical significance
 *                     reviewStatus:
 *                       type: string
 *                       description: ClinVar review status
 *                     conditions:
 *                       type: string
 *                       description: Associated conditions
 *                 somatic:
 *                   type: object
 *                   properties:
 *                     cosmicId:
 *                       type: string
 *                       nullable: true
 *                       description: COSMIC database ID
 *                     isCancerDriver:
 *                       type: boolean
 *                       description: Whether this is a known cancer driver
 *                     interpretation:
 *                       type: string
 *                       description: Somatic interpretation
 *                 conservation:
 *                   type: object
 *                   properties:
 *                     gerpScore:
 *                       type: number
 *                       nullable: true
 *                       description: GERP conservation score
 *                     interpretation:
 *                       type: string
 *                       nullable: true
 *                       description: Conservation interpretation
 *                 cadd:
 *                   type: number
 *                   nullable: true
 *                   description: CADD PHRED score
 *                 gene:
 *                   type: string
 *                   nullable: true
 *                   description: Gene symbol
 *                 data:
 *                   type: object
 *                   description: Full raw data from MyVariant.info
 *                 message:
 *                   type: string
 *                   description: Message when variant not found
 *       400:
 *         description: Bad request - either rsid or hgvs parameter is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Either rsid or hgvs parameter is required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to fetch data from MyVariant.info
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rsid = searchParams.get("rsid");
    const hgvs = searchParams.get("hgvs"); // e.g., chr1:g.35367G>A

    if (!rsid && !hgvs) {
      return NextResponse.json(
        { error: "Either rsid or hgvs parameter is required" },
        { status: 400 }
      );
    }

    const query = rsid || hgvs;
    const url = `https://myvariant.info/v1/variant/${encodeURIComponent(query!)}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          found: false,
          message: "Variant not found in MyVariant.info",
        });
      }
      throw new Error(`MyVariant.info API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.notfound) {
      return NextResponse.json({
        success: true,
        found: false,
        message: "Variant not found in MyVariant.info",
      });
    }

    // Extract clinically valuable data as specified
    const clinvar = data.clinvar;
    const dbnsfp = data.dbnsfp;
    const cadd = data.cadd;
    const cosmic = data.cosmic;

    // Population frequency (for PM2, BA1, BS1 criteria)
    const gnomadAF =
      dbnsfp?.gnomad?.af?.af || data.gnomad_genome?.af?.af || data.gnomad_exome?.af?.af || null;

    // REVEL score (best single pathogenicity predictor)
    const revelScore = dbnsfp?.revel?.score || null;
    const revelInterpretation = revelScore
      ? revelScore < 0.15
        ? "Strong Benign Evidence"
        : revelScore > 0.75
          ? "Strong Pathogenic Evidence"
          : "Uncertain"
      : null;

    // Conservation (GERP-RS score)
    const gerpScore = cadd?.gerp?.rs || null;
    const conservationInterpretation = gerpScore
      ? gerpScore > 2
        ? "Functionally Important (Conserved)"
        : "Less Conserved"
      : null;

    // ClinVar from MyVariant
    const clinvarSignificance = clinvar?.rcv?.clinical_significance || null;
    const clinvarReviewStatus = clinvar?.rcv?.review_status || null;
    const clinvarConditions = clinvar?.rcv?.conditions?.name || null;

    // COSMIC (somatic/cancer driver)
    const cosmicId = cosmic?.cosmic_id || null;
    const isCancerDriver = !!cosmicId;

    // Additional predictions
    const siftPred = dbnsfp?.sift?.pred || null;
    const polyphen2Pred = dbnsfp?.polyphen2?.hdiv?.pred || null;
    const mutationTasterPred = dbnsfp?.mutationtaster?.pred || null;

    return NextResponse.json({
      success: true,
      found: true,
      // Identity
      variantId: data._id,
      rsid: data.dbsnp?.rsid || rsid,

      // Population Frequency (PM2, BA1, BS1)
      populationFrequency: {
        gnomadAF,
        interpretation: gnomadAF
          ? gnomadAF > 0.05
            ? "Common (BA1 - Benign Stand-alone)"
            : gnomadAF > 0.01
              ? "Polymorphic (BS1 - Strong Benign)"
              : "Rare (PM2 - Moderate Pathogenic)"
          : "Unknown",
      },

      // Pathogenicity (REVEL - best single predictor)
      pathogenicity: {
        revelScore,
        interpretation: revelInterpretation,
        sift: siftPred,
        polyphen2: polyphen2Pred,
        mutationTaster: mutationTasterPred,
      },

      // ClinVar
      clinvar: clinvarSignificance
        ? {
            clinicalSignificance: clinvarSignificance,
            reviewStatus: clinvarReviewStatus,
            conditions: clinvarConditions,
          }
        : null,

      // Somatic/Cancer Driver (COSMIC)
      somatic: {
        cosmicId,
        isCancerDriver,
        interpretation: isCancerDriver ? "Known Cancer Driver" : "Not in COSMIC",
      },

      // Conservation (GERP)
      conservation: {
        gerpScore,
        interpretation: conservationInterpretation,
      },

      // Additional data
      cadd: cadd?.phred || null,
      gene: cadd?.gene?.genename || dbnsfp?.genename || null,

      // Full data
      data,
    });
  } catch (error) {
    console.error("MyVariant.info lookup error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data from MyVariant.info" },
      { status: 500 }
    );
  }
}
