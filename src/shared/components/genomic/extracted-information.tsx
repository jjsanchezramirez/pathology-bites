"use client";

import { ParsedVariant } from "@/shared/types/genomic";

interface ExtractedInformationProps {
  parsed: ParsedVariant;
}

export function ExtractedInformation({ parsed }: ExtractedInformationProps) {
  return (
    <div className="pt-4 border-t">
      <h3 className="text-sm font-semibold mb-3">Extracted Information</h3>
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {parsed.gene && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Gene</dt>
            <dd className="font-mono font-semibold mt-1">{parsed.gene}</dd>
          </div>
        )}
        {parsed.hgvs_g && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">HGVS Genomic</dt>
            <dd className="font-mono mt-1 text-xs break-all">{parsed.hgvs_g}</dd>
          </div>
        )}
        {parsed.hgvs_c && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">HGVS Coding</dt>
            <dd className="font-mono mt-1">{parsed.hgvs_c}</dd>
          </div>
        )}
        {parsed.hgvs_p && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">HGVS Protein</dt>
            <dd className="font-mono mt-1">{parsed.hgvs_p}</dd>
          </div>
        )}
        {parsed.transcript && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Transcript</dt>
            <dd className="font-mono mt-1">{parsed.transcript}</dd>
          </div>
        )}
        {parsed.vaf !== null && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">VAF</dt>
            <dd className="font-mono font-semibold mt-1">{parsed.vaf}%</dd>
          </div>
        )}
        {parsed.rsid && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">rsID</dt>
            <dd className="font-mono mt-1">{parsed.rsid}</dd>
          </div>
        )}
        {parsed.isComplex && (
          <div className="col-span-2 md:col-span-3">
            <span className="inline-block px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              Complex Variant (indel/dup)
            </span>
          </div>
        )}
      </dl>
    </div>
  );
}
