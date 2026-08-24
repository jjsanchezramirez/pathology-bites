import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { EntityKindBadge } from "@/shared/components/ui/entity-kind-badge";
import { CallBadge, MarkerKindBadge } from "@/shared/components/ui/marker-kind-badge";
import { Separator } from "@/shared/components/ui/separator";
import { markerDetail } from "@/features/public/knowledge/lib/queries";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await markerDetail(slug);
  if (!d) return { title: "Not found" };
  return {
    title: d.marker.name,
    description: `${d.marker.name}: the tumours WHO reports it in, and how.`,
  };
}

export default async function MarkerPage({ params }: Params) {
  const { slug } = await params;
  const detail = await markerDetail(slug);
  if (!detail) notFound();
  const { marker, synonyms, entities } = detail;

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

      {entities.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Reported in</h2>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {entities.length}
            </Badge>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Tumour</th>
                      <th className="px-4 py-2 font-medium">Result</th>
                      <th className="px-4 py-2 font-medium">Reported in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entities.map((e) => (
                      <tr key={e.slug} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          <Link href={`/e/${e.slug}`} className="font-medium hover:underline">
                            {e.name}
                          </Link>
                          <div className="mt-1">
                            <EntityKindBadge kind={e.kind} className="text-[10px] px-1.5 py-0" />
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <CallBadge call={e.call} className="text-[10px] px-1.5 py-0" />
                        </td>
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">
                          {e.sources} {e.sources === 1 ? "source" : "sources"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : (
        <p className="text-muted-foreground">No tumour in the corpus reports this marker yet.</p>
      )}

      <Separator className="my-10" />
      <p className="text-xs text-muted-foreground">
        A marker is one row per instrument: {marker.name} as a protein and as a mutation are
        different markers, because they are different tests answering different questions.
      </p>
    </div>
  );
}
