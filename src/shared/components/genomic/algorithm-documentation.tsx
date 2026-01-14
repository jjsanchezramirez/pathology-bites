"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

export function AlgorithmDocumentation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="text-left">
            <h2 className="text-lg font-semibold">Classification Algorithms</h2>
            <p className="text-sm text-muted-foreground mt-1">
              How we calculate variant classifications (click to expand)
            </p>
          </div>
          <svg
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "transform rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-6 pt-0 border-t">
          {/* Technical Artifact Detection */}
          <div>
            <h3 className="font-semibold text-md mb-3">Step 1: Technical Artifact Detection</h3>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500">
                <p className="font-semibold text-amber-900 dark:text-amber-200">Artifact Flags</p>
                <ul className="mt-2 space-y-1 text-amber-800 dark:text-amber-300">
                  <li>
                    • <strong>Low VAF:</strong> VAF {"<"}5% → Likely sequencing noise
                  </li>
                  <li>
                    • <strong>3'UTR:</strong> HGVS contains '*' → Non-coding region
                  </li>
                  <li>
                    • <strong>Homopolymer:</strong> 4+ repeated bases in indel → Sequencing error
                    prone
                  </li>
                </ul>
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  → If flagged: <strong>Not Detected (Technical Artifact)</strong>
                </p>
              </div>
            </div>
          </div>

          {/* VAF-Based Variant Type */}
          <div>
            <h3 className="font-semibold text-md mb-3">
              Step 2: VAF-Based Variant Type Classification
            </h3>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400">
                <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                  <li>
                    • <strong>45-55% VAF:</strong> Germline (heterozygous)
                  </li>
                  <li>
                    • <strong>{">"}90% VAF:</strong> Germline (homozygous)
                  </li>
                  <li>
                    • <strong>{"<"}30% VAF:</strong> Somatic
                  </li>
                </ul>
                <p className="mt-2 text-xs">
                  <strong>Special case:</strong> 45-55% VAF + dbSNP ID + gnomAD AF {">"}
                  0.01% → Germline Polymorphism
                </p>
              </div>
            </div>
          </div>

          {/* AMP Algorithm */}
          <div>
            <h3 className="font-semibold text-md mb-3">
              Step 3a: AMP/ASCO/CAP 4-Tier Algorithm (Somatic)
            </h3>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
                <p className="font-semibold text-red-900 dark:text-red-200">
                  Tier I: Strong Clinical Significance
                </p>
                <p className="text-red-800 dark:text-red-300 mt-1">
                  • ClinVar &quot;Pathogenic&quot; + COSMIC {">"}50 occurrences
                  <br />→ <strong>Should Report: YES</strong>
                </p>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500">
                <p className="font-semibold text-orange-900 dark:text-orange-200">
                  Tier II: Potential Clinical Significance
                </p>
                <p className="text-orange-800 dark:text-orange-300 mt-1">
                  • COSMIC recurrent ({">"}10 occurrences) OR
                  <br />• REVEL {">"}0.7 + CADD {">"}20 + ClinVar pathogenic
                  <br />→ <strong>Should Report: YES</strong>
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-500">
                <p className="font-semibold text-gray-900 dark:text-gray-200">Tier III: VUS</p>
                <p className="text-gray-800 dark:text-gray-300 mt-1">
                  • Insufficient evidence for classification
                  <br />→ <strong>Should Report: NO</strong> (if VAF {"<"}50%)
                </p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500">
                <p className="font-semibold text-green-900 dark:text-green-200">
                  Tier IV: Likely Benign
                </p>
                <p className="text-green-800 dark:text-green-300 mt-1">
                  • Common in population (gnomAD AF {">"}1%)
                  <br />→ <strong>Should Report: NO</strong>
                </p>
              </div>
            </div>
          </div>

          {/* ACMG Algorithm */}
          <div>
            <h3 className="font-semibold text-md mb-3">
              Step 3b: ACMG 5-Tier Algorithm (Germline)
            </h3>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400">
                <p className="font-semibold">Key Criteria:</p>
                <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
                  <li>
                    • <strong>BA1:</strong> gnomAD AF {">"}5% → Benign (NO report)
                  </li>
                  <li>
                    • <strong>BS1:</strong> gnomAD AF {">"}1% → Likely Benign (NO report)
                  </li>
                  <li>
                    • <strong>Germline Polymorphism:</strong> ~50% VAF + dbSNP + population data →
                    NO report
                  </li>
                  <li>
                    • <strong>PM2:</strong> gnomAD AF {"<"}1% → Supports pathogenic
                  </li>
                  <li>
                    • <strong>PP3:</strong> REVEL {">"}0.75 → Supports pathogenic
                  </li>
                  <li>
                    • <strong>BP4:</strong> REVEL {"<"}0.15 → Supports benign
                  </li>
                  <li>
                    • <strong>PS1:</strong> ClinVar "Pathogenic" → Strong pathogenic (YES report)
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Reporting Decision */}
          <div>
            <h3 className="font-semibold text-md mb-3">Step 4: Final Reporting Decision</h3>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
                <p className="font-semibold text-blue-900 dark:text-blue-200">
                  Report to Clinician:
                </p>
                <ul className="mt-2 space-y-1 text-blue-800 dark:text-blue-300">
                  <li>• Pathogenic</li>
                  <li>• Likely Pathogenic</li>
                  <li>• Tier II: Potential Clinical Significance</li>
                </ul>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400">
                <p className="font-semibold text-gray-900 dark:text-gray-200">Do NOT Report:</p>
                <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
                  <li>• Benign</li>
                  <li>• Likely Benign / Germline Polymorphism</li>
                  <li>• Tier IV: Likely Benign</li>
                  <li>• VUS with VAF {"<"}50%</li>
                  <li>• Technical Artifacts</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
