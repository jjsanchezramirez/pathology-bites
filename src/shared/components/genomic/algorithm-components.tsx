"use client";

import { MyVariantData, OncoKBData, ParsedVariant } from "@/shared/types/genomic";
import {
  formatSift,
  formatPolyphen,
  formatMutationTaster,
} from "@/shared/utils/genomic/format-predictions";
import { ExternalLink } from "lucide-react";

interface AlgorithmComponentsProps {
  myvariant: MyVariantData | null;
  oncokb?: OncoKBData | null;
  parsed?: ParsedVariant;
}

// Helper component for standardized "Not Available" display
const NotAvailable = () => (
  <span className="text-sm text-muted-foreground italic">Not Available</span>
);
const NoData = () => <span className="text-sm text-muted-foreground italic">No data</span>;

// Helper component for external links
const ExternalLinkButton = ({ href, label }: { href: string; label: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
  >
    {label}
    <ExternalLink className="h-3 w-3" />
  </a>
);

// Helper to ensure sentence case formatting
const toSentenceCase = (text: string): string => {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Helper to render prediction tags
const PredictionTag = ({
  value,
  color,
}: {
  value: string;
  color: "red" | "orange" | "green" | "gray";
}) => {
  const colorClasses = {
    red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${colorClasses[color]}`}>
      {value}
    </span>
  );
};

export function AlgorithmComponents({ myvariant, oncokb, parsed }: AlgorithmComponentsProps) {
  // Generate URLs for external resources
  const variantId = myvariant?.variantId;
  const gene = parsed?.gene;
  const hgvsP = parsed?.hgvs_p;

  // MyVariant.info URL
  const myvariantUrl = variantId
    ? `https://myvariant.info/v1/variant/${encodeURIComponent(variantId)}`
    : null;

  // ClinVar URL - search by gene and protein change
  const clinvarUrl =
    gene && hgvsP
      ? `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(gene)}+AND+${encodeURIComponent(hgvsP)}`
      : gene
        ? `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(gene)}`
        : null;

  // OncoKB URL - includes specific variant if available
  const oncokbUrl =
    gene && hgvsP
      ? `https://www.oncokb.org/gene/${encodeURIComponent(gene)}/somatic/${encodeURIComponent(hgvsP.replace("p.", ""))}`
      : gene
        ? `https://www.oncokb.org/gene/${encodeURIComponent(gene)}`
        : null;

  // COSMIC URL
  const cosmicUrl = gene
    ? `https://cancer.sanger.ac.uk/cosmic/gene/analysis?ln=${encodeURIComponent(gene)}`
    : null;

  // gnomAD URL
  const gnomadUrl = variantId
    ? `https://gnomad.broadinstitute.org/variant/${encodeURIComponent(variantId)}`
    : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr className="bg-muted/30">
            <th className="text-left p-3 font-semibold">Component</th>
            <th className="text-left p-3 font-semibold">Value</th>
            <th className="text-left p-3 font-semibold">Interpretation</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {/* Population Frequency */}
          <tr>
            <td className="p-3 font-medium">
              <div className="flex items-center gap-2 flex-wrap">
                <span>gnomAD Allele Frequency</span>
                {gnomadUrl && <ExternalLinkButton href={gnomadUrl} label="gnomAD" />}
              </div>
            </td>
            <td className="p-3 font-mono text-sm">
              {myvariant?.populationFrequency?.gnomadAF !== null &&
              myvariant?.populationFrequency?.gnomadAF !== undefined ? (
                `${((myvariant.populationFrequency.gnomadAF || 0) * 100).toFixed(6)}%`
              ) : (
                <NotAvailable />
              )}
            </td>
            <td className="p-3 text-sm">
              {myvariant?.populationFrequency?.gnomadAF !== null &&
              myvariant?.populationFrequency?.gnomadAF !== undefined ? (
                <span>
                  {myvariant.populationFrequency.interpretation}{" "}
                  <span className="text-muted-foreground">
                    (Ref: &gt;5% = BA1, &gt;1% = BS1, &lt;0.01% = PM2)
                  </span>
                </span>
              ) : (
                <NoData />
              )}
            </td>
          </tr>

          {/* REVEL Score */}
          <tr>
            <td className="p-3 font-medium">
              <div className="flex items-center gap-2 flex-wrap">
                <span>REVEL Score</span>
                {myvariantUrl && <ExternalLinkButton href={myvariantUrl} label="MyVariant.info" />}
              </div>
            </td>
            <td className="p-3 font-mono text-sm">
              {myvariant?.pathogenicity?.revelScore !== null &&
              myvariant?.pathogenicity?.revelScore !== undefined ? (
                Number(myvariant.pathogenicity.revelScore).toFixed(3)
              ) : (
                <NotAvailable />
              )}
            </td>
            <td className="p-3 text-sm">
              {myvariant?.pathogenicity?.revelScore !== null &&
              myvariant?.pathogenicity?.revelScore !== undefined ? (
                <span>
                  {myvariant.pathogenicity.interpretation}{" "}
                  <span className="text-muted-foreground">
                    (Ref: &gt;0.75 = pathogenic, &lt;0.4 = benign)
                  </span>
                </span>
              ) : (
                <NoData />
              )}
            </td>
          </tr>

          {/* ClinVar */}
          <tr>
            <td className="p-3 font-medium">
              <div className="flex items-center gap-2 flex-wrap">
                <span>ClinVar Significance</span>
                {clinvarUrl && <ExternalLinkButton href={clinvarUrl} label="ClinVar" />}
              </div>
            </td>
            <td className="p-3">
              {myvariant?.clinvar?.clinicalSignificance ? (
                <PredictionTag
                  value={toSentenceCase(myvariant.clinvar.clinicalSignificance)}
                  color={
                    myvariant.clinvar.clinicalSignificance.toLowerCase().includes("pathogenic") &&
                    !myvariant.clinvar.clinicalSignificance.toLowerCase().includes("likely")
                      ? "red"
                      : myvariant.clinvar.clinicalSignificance
                            .toLowerCase()
                            .includes("likely pathogenic")
                        ? "orange"
                        : myvariant.clinvar.clinicalSignificance.toLowerCase().includes("benign")
                          ? "green"
                          : "gray"
                  }
                />
              ) : (
                <NotAvailable />
              )}
            </td>
            <td className="p-3 text-sm">
              {myvariant?.clinvar?.reviewStatus ? (
                toSentenceCase(myvariant.clinvar.reviewStatus)
              ) : (
                <NoData />
              )}
            </td>
          </tr>

          {/* OncoKB Oncogenicity */}
          <tr>
            <td className="p-3 font-medium">
              <div className="flex items-center gap-2 flex-wrap">
                <span>OncoKB Oncogenicity</span>
                {oncokbUrl && <ExternalLinkButton href={oncokbUrl} label="OncoKB" />}
              </div>
            </td>
            <td className="p-3">
              {oncokb?.found && oncokb?.oncogenic ? (
                <PredictionTag
                  value={oncokb.oncogenic}
                  color={
                    oncokb.oncogenic.toLowerCase().includes("oncogenic") &&
                    !oncokb.oncogenic.toLowerCase().includes("likely") &&
                    !oncokb.oncogenic.toLowerCase().includes("predicted")
                      ? "red"
                      : oncokb.oncogenic.toLowerCase().includes("likely") ||
                          oncokb.oncogenic.toLowerCase().includes("predicted")
                        ? "orange"
                        : "gray"
                  }
                />
              ) : (
                <NotAvailable />
              )}
            </td>
            <td className="p-3 text-sm">
              {oncokb?.found && oncokb?.mutationEffect ? (
                <span>Mutation Effect: {oncokb.mutationEffect}</span>
              ) : (
                <NoData />
              )}
            </td>
          </tr>

          {/* OncoKB Therapeutic Level */}
          <tr>
            <td className="p-3 font-medium">OncoKB Therapeutic Level</td>
            <td className="p-3">
              {oncokb?.found &&
              (oncokb?.highestSensitiveLevel || oncokb?.highestResistanceLevel) ? (
                <div className="space-y-1">
                  {oncokb.highestSensitiveLevel && (
                    <PredictionTag
                      value={oncokb.highestSensitiveLevel.replace("_", " ")}
                      color={
                        oncokb.highestSensitiveLevel === "LEVEL_1"
                          ? "green"
                          : oncokb.highestSensitiveLevel === "LEVEL_2"
                            ? "green"
                            : oncokb.highestSensitiveLevel.startsWith("LEVEL_3")
                              ? "orange"
                              : "gray"
                      }
                    />
                  )}
                  {oncokb.highestResistanceLevel && (
                    <PredictionTag
                      value={`${oncokb.highestResistanceLevel} (Resistance)`}
                      color="red"
                    />
                  )}
                </div>
              ) : (
                <NotAvailable />
              )}
            </td>
            <td className="p-3 text-sm">
              {oncokb?.found && oncokb?.highestSensitiveLevel ? (
                <span>
                  {oncokb.highestSensitiveLevel === "LEVEL_1"
                    ? "FDA-recognized biomarker"
                    : oncokb.highestSensitiveLevel === "LEVEL_2"
                      ? "Standard care"
                      : oncokb.highestSensitiveLevel.startsWith("LEVEL_3")
                        ? "Clinical evidence"
                        : "Biological evidence"}
                </span>
              ) : (
                <NoData />
              )}
            </td>
          </tr>

          {/* OncoKB Therapeutic Implications */}
          {oncokb?.found &&
            oncokb?.therapeuticImplications &&
            oncokb.therapeuticImplications.length > 0 && (
              <tr>
                <td className="p-3 font-medium">OncoKB Tx Options</td>
                <td className="p-3">
                  <span className="text-sm font-medium">Available</span>
                </td>
                <td className="p-3 text-sm">
                  {oncokb.therapeuticImplications
                    .slice(0, 3)
                    .map((t) => t.drug)
                    .join(", ")}
                  {oncokb.therapeuticImplications.length > 3 &&
                    ` (+${oncokb.therapeuticImplications.length - 3} more)`}
                </td>
              </tr>
            )}

          {/* COSMIC */}
          <tr>
            <td className="p-3 font-medium">
              <div className="flex items-center gap-2 flex-wrap">
                <span>COSMIC (Cancer Driver)</span>
                {cosmicUrl && <ExternalLinkButton href={cosmicUrl} label="COSMIC" />}
              </div>
            </td>
            <td className="p-3 font-mono text-sm">
              {myvariant?.somatic?.cosmicId || <NotAvailable />}
            </td>
            <td className="p-3 text-sm">
              {myvariant?.somatic?.interpretation ? (
                toSentenceCase(myvariant.somatic.interpretation)
              ) : (
                <NoData />
              )}
            </td>
          </tr>

          {/* GERP Conservation */}
          <tr>
            <td className="p-3 font-medium">GERP Conservation Score</td>
            <td className="p-3 font-mono text-sm">
              {myvariant?.conservation?.gerpScore !== null &&
              myvariant?.conservation?.gerpScore !== undefined ? (
                Number(myvariant.conservation.gerpScore).toFixed(2)
              ) : (
                <NotAvailable />
              )}
            </td>
            <td className="p-3 text-sm">
              {myvariant?.conservation?.interpretation ? (
                <span>
                  {myvariant.conservation.interpretation}{" "}
                  <span className="text-muted-foreground">(Ref: &gt;4 = conserved)</span>
                </span>
              ) : (
                <NoData />
              )}
            </td>
          </tr>

          {/* CADD */}
          <tr>
            <td className="p-3 font-medium">CADD Score</td>
            <td className="p-3 font-mono text-sm">
              {myvariant?.pathogenicity?.cadd || <NotAvailable />}
            </td>
            <td className="p-3 text-sm">
              {myvariant?.pathogenicity?.cadd ? (
                <span>
                  {myvariant.pathogenicity.cadd > 20 ? "Likely deleterious" : "Neutral"}{" "}
                  <span className="text-muted-foreground">(Ref: &gt;20 = deleterious)</span>
                </span>
              ) : (
                <NoData />
              )}
            </td>
          </tr>

          {/* SIFT */}
          <tr>
            <td className="p-3 font-medium">SIFT</td>
            <td className="p-3">
              {myvariant?.pathogenicity?.sift ? (
                <PredictionTag
                  value={formatSift(myvariant.pathogenicity.sift)}
                  color={
                    formatSift(myvariant.pathogenicity.sift).toLowerCase().includes("deleterious")
                      ? "red"
                      : "green"
                  }
                />
              ) : (
                <NotAvailable />
              )}
            </td>
            <td className="p-3 text-sm">Protein function prediction</td>
          </tr>

          {/* PolyPhen-2 */}
          <tr>
            <td className="p-3 font-medium">PolyPhen-2</td>
            <td className="p-3">
              {myvariant?.pathogenicity?.polyphen2 ? (
                <PredictionTag
                  value={formatPolyphen(myvariant.pathogenicity.polyphen2)}
                  color={
                    formatPolyphen(myvariant.pathogenicity.polyphen2)
                      .toLowerCase()
                      .includes("damaging")
                      ? "red"
                      : formatPolyphen(myvariant.pathogenicity.polyphen2)
                            .toLowerCase()
                            .includes("possibly")
                        ? "orange"
                        : "green"
                  }
                />
              ) : (
                <NotAvailable />
              )}
            </td>
            <td className="p-3 text-sm">Protein function prediction</td>
          </tr>

          {/* MutationTaster */}
          <tr>
            <td className="p-3 font-medium">MutationTaster</td>
            <td className="p-3">
              {myvariant?.pathogenicity?.mutationTaster ? (
                Array.isArray(myvariant.pathogenicity.mutationTaster) ? (
                  <div className="flex flex-wrap gap-1">
                    {myvariant.pathogenicity.mutationTaster.map((val, idx) => (
                      <PredictionTag
                        key={idx}
                        value={formatMutationTaster(val)}
                        color={
                          formatMutationTaster(val).toLowerCase().includes("disease")
                            ? "red"
                            : "green"
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <PredictionTag
                    value={formatMutationTaster(myvariant.pathogenicity.mutationTaster)}
                    color={
                      formatMutationTaster(myvariant.pathogenicity.mutationTaster)
                        .toLowerCase()
                        .includes("disease")
                        ? "red"
                        : "green"
                    }
                  />
                )
              ) : (
                <NotAvailable />
              )}
            </td>
            <td className="p-3 text-sm">Disease-causing prediction</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
