"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { AnalysisResponse } from "@/shared/types/genomic";
import {
  VariantInput,
  ExtractedInformation,
  TechnicalArtifactWarning,
  ClassificationResults,
  AlgorithmComponents,
} from "@/shared/components/genomic";
import { Dna, Database, Rocket } from "lucide-react";
import Link from "next/link";

export default function GenomicAnalysisPage() {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!rawText.trim()) {
      setError("Please enter variant data to analyze");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/public/genomic/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      // Adapt the new /classify response to match the old structure
      const adaptedResult = {
        ...data,
        // Map classification to ampResult for compatibility
        ampResult: {
          classification: data.classification?.classification,
          tier: data.classification?.tier,
          action: data.classification?.shouldReport ? "Report" : "Don't Report",
          reasoning: data.classification?.reasoning,
          reportingStatus: data.classification?.shouldReport ? "DETECTED_REPORT" : "VUS",
        },
        // Keep acmgResult empty for now (somatic-focused)
        acmgResult: null,
        // Map classification.shouldReport to reporting structure
        reporting: {
          shouldReport: data.classification?.shouldReport || false,
          category: data.classification?.shouldReport
            ? "Detected (Report)"
            : "Detected, Not Reported",
          reasoning: data.classification?.reasoning || "",
        },
        // Map variantData to myvariant for AlgorithmComponents
        myvariant: data.variantData
          ? {
              found: data.variantData.found,
              populationFrequency: {
                gnomadAF: data.variantData.gnomadAF,
                interpretation:
                  data.variantData.gnomadAF > 0.01 ? "Common (PM2 not applicable)" : "Rare (PM2)",
              },
              pathogenicity: {
                revelScore: data.variantData.revel,
                interpretation:
                  data.variantData.revel > 0.75
                    ? "Strong Pathogenic Evidence"
                    : data.variantData.revel < 0.4
                      ? "Strong Benign Evidence"
                      : "Uncertain",
                cadd: data.variantData.cadd,
                sift: data.variantData.sift,
                polyphen2: data.variantData.polyphen2,
              },
              clinvar: data.variantData.clinvarSignificance
                ? {
                    clinicalSignificance: data.variantData.clinvarSignificance,
                    reviewStatus: data.variantData.clinvarReviewStatus,
                  }
                : null,
              somatic: {
                cosmicCount: data.variantData.cosmicCount,
                isCancerDriver: data.variantData.cosmicCount > 10,
                interpretation:
                  data.variantData.cosmicCount > 50
                    ? "Known Cancer Driver"
                    : data.variantData.cosmicCount > 10
                      ? "Potential Driver"
                      : "Not in COSMIC",
              },
              conservation: {
                gerpScore: data.variantData.gerp,
                interpretation:
                  data.variantData.gerp > 4
                    ? "Functionally Important (Conserved)"
                    : "Not conserved",
              },
            }
          : null,
      };

      setResult(adaptedResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Genova"
        description="GENOmic Variant Analysis - Automated variant classification tool integrating clinical databases (ClinVar, OncoKB, COSMIC) with computational predictors (REVEL, GERP, CADD, SIFT, PolyPhen-2) following AMP/ASCO/CAP 2017 guidelines."
        actions={
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Dna className="h-4 w-4" />
              <span>ClinVar</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              <span>OncoKB</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Rocket className="h-4 w-4" />
              <span>COSMIC</span>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <section className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Input and Extracted Information Combined */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Variant Analysis</CardTitle>
              <div className="space-y-2 mt-1">
                <p className="text-sm text-muted-foreground">
                  Paste variant information below. The system will automatically extract gene, rsID,
                  VAF, and other details.
                </p>
                <p className="text-sm text-muted-foreground">
                  Need gene information?{" "}
                  <Link
                    href="/tools/gene-lookup"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Use MILAN
                    <Dna className="h-3 w-3" />
                  </Link>
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <VariantInput
                rawText={rawText}
                setRawText={setRawText}
                loading={loading}
                error={error}
                onAnalyze={handleAnalyze}
              />

              {/* Extracted Information - shown inline after analysis */}
              {result && <ExtractedInformation parsed={result.parsed} />}
            </CardContent>
          </Card>

          {/* Results Section */}
          {result && (
            <div className="space-y-6">
              {/* Technical Artifact Warning */}
              {result.technicalArtifact?.isArtifact && (
                <TechnicalArtifactWarning reason={result.technicalArtifact.reason} />
              )}

              {/* Combined Classification Systems */}
              <ClassificationResults
                variantType={result.variantType}
                reporting={result.reporting}
                ampResult={result.ampResult}
                acmgResult={result.acmgResult}
              />

              {/* Algorithm Components Table */}
              {(result.myvariant?.found || result.oncokb?.found) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Algorithm Components</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Transparent view of all data points used in classification
                    </p>
                  </CardHeader>
                  <CardContent>
                    <AlgorithmComponents
                      myvariant={result.myvariant}
                      oncokb={result.oncokb}
                      parsed={result.parsed}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />
    </div>
  );
}
