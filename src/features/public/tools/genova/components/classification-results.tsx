"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { AnalysisResult } from "@/shared/types/genomic";

interface ClassificationResultsProps {
  variantType?: string;
  reporting?: {
    shouldReport: boolean;
    category: string;
    reasoning: string;
  };
  ampResult?: AnalysisResult;
  acmgResult?: AnalysisResult;
}

export function ClassificationResults({
  variantType,
  reporting,
  ampResult,
  acmgResult,
}: ClassificationResultsProps) {
  // Extract classification from ampResult or acmgResult
  const rawClassification =
    (ampResult as { classification?: string })?.classification ||
    acmgResult?.classification ||
    "Unknown";

  // Simplify classification text (remove parentheticals)
  const classification = rawClassification.split("(")[0].trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Classification Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Section: Single Row with All Key Information */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {/* Variant Type */}
          {variantType && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Variant Type</p>
              <p className="text-base font-semibold text-foreground">{variantType}</p>
            </div>
          )}

          {/* Variant Classification */}
          {ampResult && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Classification</p>
              <p
                className={`text-base font-semibold ${
                  classification.includes("Pathogenic") && !classification.includes("Likely")
                    ? "text-red-600 dark:text-red-400"
                    : classification.includes("Likely Pathogenic")
                      ? "text-orange-600 dark:text-orange-400"
                      : classification.includes("Benign") && !classification.includes("Likely")
                        ? "text-green-600 dark:text-green-400"
                        : classification.includes("Likely Benign")
                          ? "text-green-600 dark:text-green-500"
                          : classification.includes("VUS") || classification.includes("Uncertain")
                            ? "text-yellow-600 dark:text-yellow-400"
                            : classification.includes("Artifact")
                              ? "text-muted-foreground"
                              : "text-foreground"
                }`}
              >
                {classification}
              </p>
            </div>
          )}

          {/* Reporting Decision */}
          {reporting && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Reporting</p>
              <p
                className={`text-base font-semibold ${
                  reporting.shouldReport ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {reporting.shouldReport ? "Report" : "Don't Report"}
              </p>
            </div>
          )}

          {/* Tier */}
          {ampResult?.tier && (
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Tier (AMP/ASCO/CAP)
              </p>
              <p
                className={`text-base font-semibold ${
                  ampResult.tier?.includes("Not Detected") || ampResult.tier?.includes("Excluded")
                    ? "text-muted-foreground"
                    : ampResult.tier?.includes("Tier I") || ampResult.tier?.includes("BA1")
                      ? "text-red-600 dark:text-red-400"
                      : ampResult.tier?.includes("Tier II") || ampResult.tier?.includes("BS1")
                        ? "text-orange-600 dark:text-orange-400"
                        : ampResult.tier?.includes("Tier III")
                          ? "text-yellow-600 dark:text-yellow-400"
                          : ampResult.tier?.includes("Tier IV") ||
                              ampResult.tier?.includes("Polymorphism")
                            ? "text-green-600 dark:text-green-400"
                            : "text-foreground"
                }`}
              >
                {ampResult.tier}
              </p>
            </div>
          )}
        </div>

        {/* Reasoning Section: Full Width Below */}
        {ampResult && (
          <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-sm font-semibold mb-2 text-foreground">Reasoning</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{ampResult.reasoning}</p>
          </div>
        )}

        {/* ACMG Classification: Full Width (if present) */}
        {acmgResult && (
          <div className="border rounded-lg p-5 bg-gradient-to-br from-background to-muted/20">
            <div className="mb-4">
              <h3 className="font-semibold text-base mb-1">ACMG (5-Tier)</h3>
              <p className="text-xs text-muted-foreground">For germline variants</p>
            </div>

            {/* Classification and Criteria: 2 Columns */}
            <div className="grid gap-4 md:grid-cols-2 mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Classification</p>
                <span
                  className={`inline-block px-4 py-2 rounded-lg text-base font-semibold ${
                    acmgResult.classification?.includes("Pathogenic") &&
                    !acmgResult.classification?.includes("Likely")
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      : acmgResult.classification?.includes("Likely Pathogenic")
                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                        : acmgResult.classification?.includes("Benign") &&
                            !acmgResult.classification?.includes("Likely")
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : acmgResult.classification?.includes("Likely Benign")
                            ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-500"
                            : "bg-muted text-muted-foreground"
                  }`}
                >
                  {acmgResult.classification}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">ACMG Criteria</p>
                <span className="inline-block px-4 py-2 rounded-lg text-base font-semibold bg-secondary/80 text-secondary-foreground">
                  {acmgResult.criteria && acmgResult.criteria.length > 0
                    ? acmgResult.criteria.join(", ")
                    : "None"}
                </span>
              </div>
            </div>

            {/* Reasoning: Full Width */}
            <div className="bg-muted/50 border rounded-lg p-4">
              <p className="text-sm font-semibold mb-2 text-foreground">Reasoning</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {acmgResult.reasoning}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
