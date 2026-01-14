import { formatSift, formatPolyphen } from "@/shared/utils/genomic/format-predictions";

interface MyVariantData {
  success: boolean;
  found: boolean;
  variantId?: string;
  populationFrequency?: {
    gnomadAF: number | null;
    interpretation: string;
  };
  pathogenicity?: {
    revelScore: number | null;
    interpretation: string | null;
    sift?: string;
    polyphen2?: string;
    mutationTaster?: string;
    cadd?: number;
  };
  clinvar?: {
    clinicalSignificance?: string;
    reviewStatus?: string;
    conditions?: string;
  } | null;
  somatic?: {
    cosmicId?: string;
    isCancerDriver: boolean;
    interpretation: string;
  };
  conservation?: {
    gerpScore: number | null;
    interpretation: string | null;
  };
  data?: unknown;
}

interface Props {
  data: MyVariantData | null;
  rsid: string | null;
}

export function DatabaseCardMyVariant({ data, rsid: _rsid }: Props) {
  if (!data) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border dark:border-gray-700">
      <div className="p-6 border-b dark:border-gray-700">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Variant Analysis Details
        </h2>
      </div>
      <div className="p-6">
        {data.found ? (
          <dl className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Aggregated ClinVar Data */}
            {data.clinvar && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg md:col-span-2 lg:col-span-3">
                <dt className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  ClinVar
                </dt>
                <dd className="space-y-1">
                  {data.clinvar.clinicalSignificance && (
                    <div className="text-sm">
                      <span className="font-medium">Significance:</span>{" "}
                      {data.clinvar.clinicalSignificance}
                    </div>
                  )}
                  {data.clinvar.reviewStatus && (
                    <div className="text-sm">
                      <span className="font-medium">Review:</span> {data.clinvar.reviewStatus}
                    </div>
                  )}
                  {data.clinvar.conditions && (
                    <div className="text-sm">
                      <span className="font-medium">Conditions:</span> {data.clinvar.conditions}
                    </div>
                  )}
                </dd>
              </div>
            )}

            {data.populationFrequency && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Population Frequency (ACMG)
                </dt>
                <dd className="mt-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      data.populationFrequency.interpretation.includes("BA1") ||
                      data.populationFrequency.interpretation.includes("BS1")
                        ? "bg-green-100 text-green-800"
                        : data.populationFrequency.interpretation.includes("PM2")
                          ? "bg-orange-100 text-orange-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {data.populationFrequency.interpretation}
                  </span>
                  {data.populationFrequency.gnomadAF && (
                    <div className="text-xs mt-1 text-muted-foreground">
                      AF: {(data.populationFrequency.gnomadAF * 100).toFixed(6)}%
                    </div>
                  )}
                </dd>
              </div>
            )}
            {data.pathogenicity?.revelScore && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  REVEL Score (Best Predictor)
                </dt>
                <dd className="mt-1">
                  <div className="font-mono font-semibold">
                    {typeof data.pathogenicity.revelScore === "number"
                      ? data.pathogenicity.revelScore.toFixed(3)
                      : parseFloat(String(data.pathogenicity.revelScore)).toFixed(3)}
                  </div>
                  <span
                    className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                      data.pathogenicity.interpretation === "Strong Pathogenic Evidence"
                        ? "bg-red-100 text-red-800"
                        : data.pathogenicity.interpretation === "Strong Benign Evidence"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {data.pathogenicity.interpretation}
                  </span>
                </dd>
              </div>
            )}
            {data.somatic && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Cancer Driver Status</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      data.somatic.isCancerDriver
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {data.somatic.interpretation}
                  </span>
                  {data.somatic.cosmicId && (
                    <div className="text-xs mt-1 text-muted-foreground font-mono">
                      COSMIC ID: {data.somatic.cosmicId}
                    </div>
                  )}
                </dd>
              </div>
            )}
            {data.conservation?.gerpScore && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Conservation (GERP)</dt>
                <dd className="mt-1">
                  <div className="font-mono">
                    {typeof data.conservation.gerpScore === "number"
                      ? data.conservation.gerpScore.toFixed(2)
                      : parseFloat(String(data.conservation.gerpScore)).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.conservation.interpretation}
                  </div>
                </dd>
              </div>
            )}
            {data.pathogenicity && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Additional Predictions
                </dt>
                <dd className="mt-1 space-y-1 text-sm">
                  {data.pathogenicity.sift && (
                    <div>SIFT: {formatSift(data.pathogenicity.sift)}</div>
                  )}
                  {data.pathogenicity.polyphen2 && (
                    <div>PolyPhen-2: {formatPolyphen(data.pathogenicity.polyphen2)}</div>
                  )}
                  {data.pathogenicity.cadd && <div>CADD: {data.pathogenicity.cadd}</div>}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No variant data available</p>
        )}
      </div>
    </div>
  );
}
