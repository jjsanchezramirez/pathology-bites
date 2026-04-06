"use client";

import { useState, useEffect } from "react";
import { ExplainerSection as ExplainerSectionType } from "../../types";
import { Loader2 } from "lucide-react";

// Lazy import the ExplainerPlayer since it has heavy dependencies
import dynamic from "next/dynamic";
const ExplainerPlayer = dynamic(
  () =>
    import("@/shared/components/explainer/explainer-player").then(
      (mod) => mod.ExplainerPlayer
    ),
  { ssr: false, loading: () => <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> }
);

interface ExplainerSectionProps {
  section: ExplainerSectionType;
}

export function ExplainerSection({ section }: ExplainerSectionProps) {
  const [sequence, setSequence] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSequence() {
      try {
        const res = await fetch(
          `/api/interactive-sequences/${section.sequenceId}`
        );
        if (res.status === 404) {
          setError("Interactive sequence not found");
          return;
        }
        if (!res.ok) throw new Error("Failed to load sequence");
        const { sequence } = await res.json();
        setSequence(sequence.sequence_data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    loadSequence();
  }, [section.sequenceId]);

  return (
    <div className="space-y-2">
      {section.heading && (
        <h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>
      )}
      {section.description && (
        <p className="text-muted-foreground">{section.description}</p>
      )}
      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
          {error}
        </div>
      )}
      {sequence && (
        <div className="rounded-lg overflow-hidden border">
          <ExplainerPlayer sequence={sequence} />
        </div>
      )}
    </div>
  );
}
