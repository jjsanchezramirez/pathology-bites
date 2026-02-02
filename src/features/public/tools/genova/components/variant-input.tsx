"use client";

import { Button } from "@/shared/components/ui/button";

interface VariantInputProps {
  rawText: string;
  setRawText: (value: string) => void;
  loading: boolean;
  error: string | null;
  onAnalyze: () => void;
}

export function VariantInput({
  rawText,
  setRawText,
  loading,
  error,
  onAnalyze,
}: VariantInputProps) {
  const exampleData = "BRAF V600E rs113488022 VAF: 25.3";

  return (
    <div className="space-y-4">
      <textarea
        placeholder="Example: BRAF V600E rs113488022 VAF: 25.3 or chr7:g.140453136A>T"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={6}
        className="w-full font-mono text-sm p-3 border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background"
      />

      <div className="flex gap-2">
        <Button onClick={onAnalyze} disabled={loading || !rawText.trim()} className="flex-1">
          {loading ? "Analyzing..." : "Analyze Variant"}
        </Button>
        <Button onClick={() => setRawText(exampleData)} disabled={loading} variant="outline">
          Load Example
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-destructive mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-destructive">Error</h3>
              <p className="text-sm text-destructive/90 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
