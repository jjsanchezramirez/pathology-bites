import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { MarkerKindBadge } from "@/shared/components/ui/marker-kind-badge";
import { Separator } from "@/shared/components/ui/separator";
import { MarkerEntityTable } from "@/features/public/knowledge/components/marker-rollup";
import { markerDetail, markerEntityRollup } from "@/features/public/knowledge/lib/queries";
import { KNOWLEDGE_PAGES_ENABLED } from "@/features/public/knowledge/lib/enabled";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!KNOWLEDGE_PAGES_ENABLED) return { title: "Not found" };
  const { slug } = await params;
  const d = await markerDetail(slug);
  if (!d) return { title: "Not found" };
  return {
    title: d.marker.name,
    description: `${d.marker.name}: the tumours WHO reports it in, and how.`,
  };
}

export default async function MarkerPage({ params }: Params) {
  if (!KNOWLEDGE_PAGES_ENABLED) notFound();
  const { slug } = await params;
  const [detail, rollup] = await Promise.all([markerDetail(slug), markerEntityRollup(slug)]);
  if (!detail) notFound();
  const { marker, synonyms } = detail;
  const entities = rollup?.entities ?? [];

  const genes: string[] = Array.isArray(marker.gene_symbols) ? marker.gene_symbols : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MarkerKindBadge kind={marker.kind} />
          {marker.compartment && (
            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
              {marker.compartment}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{marker.name}</h1>
        {marker.definition && (
          <p className="max-w-2xl text-muted-foreground">{marker.definition}</p>
        )}

        {genes.length > 0 && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {marker.kind === "fusion" ? "Partners (5′ → 3′): " : "Genes: "}
            </span>
            {genes.map((g, i) => (
              <span key={g}>
                {i > 0 && " · "}
                <Link href={`/g/${encodeURIComponent(g)}`} className="hover:underline">
                  {g}
                </Link>
              </span>
            ))}
          </p>
        )}

        {synonyms.length > 0 && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Also written: </span>
            {synonyms.map((s) => s.term).join(" · ")}
          </p>
        )}
      </header>

      <Separator className="my-8" />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Reported in, by source</h2>
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {entities.length}
          </Badge>
        </div>
        <p className="-mt-1 text-sm text-muted-foreground">
          Every statement is attributed to the source that printed it. Figures are shown as printed;
          nothing is pooled across sources, and disagreement is shown, not resolved.
        </p>
        <Card>
          <CardContent className="p-0">
            {rollup ? (
              <MarkerEntityTable rollup={rollup} />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                No tumour in the corpus reports this marker yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator className="my-10" />
      <p className="text-xs text-muted-foreground">
        A marker is one row per instrument: {marker.name} as a protein and as a mutation are
        different markers, because they are different tests answering different questions.
        Statements are quoted, attributed and never blended; where sources disagree, both are shown.
      </p>
    </div>
  );
}
