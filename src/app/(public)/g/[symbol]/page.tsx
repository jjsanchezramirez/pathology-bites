import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { MarkerKindBadge } from "@/shared/components/ui/marker-kind-badge";
import { Separator } from "@/shared/components/ui/separator";
import { geneDetail } from "@/features/public/knowledge/lib/queries";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { symbol } = await params;
  const d = await geneDetail(decodeURIComponent(symbol));
  if (!d) return { title: "Not found" };
  return {
    title: d.gene.symbol,
    description: d.gene.name ?? `${d.gene.symbol}: the markers and tumours that reference it.`,
  };
}

export default async function GenePage({ params }: Params) {
  const { symbol } = await params;
  const detail = await geneDetail(decodeURIComponent(symbol));
  if (!detail) notFound();
  const { gene, markers } = detail;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-700">
            Gene
          </Badge>
          {gene.locus && (
            <Badge
              variant="outline"
              className="border-slate-300 bg-slate-50 font-mono text-slate-700"
            >
              {gene.locus}
            </Badge>
          )}
        </div>
        <h1 className="font-mono text-3xl font-semibold tracking-tight md:text-4xl">
          {gene.symbol}
        </h1>
        {gene.name && <p className="max-w-2xl text-muted-foreground">{gene.name}</p>}
        <p className="text-xs text-muted-foreground">Symbol and locus per HGNC.</p>
      </header>

      <Separator className="my-8" />

      {markers.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Markers referencing it</h2>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {markers.length}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {markers.map((m) => {
              const partners: string[] = Array.isArray(m.gene_symbols) ? m.gene_symbols : [];
              const role =
                m.kind === "fusion" && partners.length > 1
                  ? partners[0] === gene.symbol
                    ? "5′ partner"
                    : "3′ partner"
                  : null;
              return (
                <Card key={m.slug}>
                  <CardContent className="flex flex-col gap-2 p-4">
                    <Link href={`/m/${m.slug}`} className="font-medium hover:underline">
                      {m.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <MarkerKindBadge kind={m.kind} className="text-[10px] px-1.5 py-0" />
                      {/* Array ORDER carries the fusion partner roles — see
                          canonicalise_targets, which reads gene_symbols[0] as 5′. */}
                      {role && <span className="text-xs text-muted-foreground">{role}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="text-muted-foreground">No marker in the corpus references this gene yet.</p>
      )}
    </div>
  );
}
