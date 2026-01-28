import { NextRequest, NextResponse } from "next/server";

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
