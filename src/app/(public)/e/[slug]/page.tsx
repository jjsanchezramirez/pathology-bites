import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { EntityKindBadge } from "@/shared/components/ui/entity-kind-badge";
import { CallBadge, MarkerKindBadge } from "@/shared/components/ui/marker-kind-badge";
import { Separator } from "@/shared/components/ui/separator";
import { entityDetail, resolveEntity } from "@/features/public/knowledge/lib/queries";
import { KNOWLEDGE_PAGES_ENABLED } from "@/features/public/knowledge/lib/enabled";

/* Rendered on demand and cached for an hour. Pre-rendering all 4,001 at build
 * time would add thousands of queries to every deploy for pages most of which
 * nobody asks for that day. */
export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!KNOWLEDGE_PAGES_ENABLED) return { title: "Not found" };
  const { slug } = await params;
  const r = await resolveEntity(slug);
  if (!r || !("entity" in r)) return { title: "Not found" };
  const e = r.entity;
  return {
    title: e.name,
    description:
      e.definition?.slice(0, 160) ??
      `${e.name}: WHO classification, immunoprofile and differential diagnosis.`,
  };
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {count !== undefined && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {count}
          </Badge>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function EntityPage({ params }: Params) {
  if (!KNOWLEDGE_PAGES_ENABLED) notFound();
  const { slug } = await params;
  const resolved = await resolveEntity(slug);
  if (!resolved) notFound();
  // A slug we have retired still resolves — to its survivor, permanently, so a
  // link written before a merge keeps working and search engines follow it.
  if ("redirectTo" in resolved) permanentRedirect(`/e/${resolved.redirectTo}`);

  const entity = resolved.entity;
  const { placements, synonyms, findings, differentials, children } = await entityDetail(entity);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <EntityKindBadge kind={entity.kind} />
          {entity.icd_o && (
            <Badge
              variant="outline"
              className="border-slate-300 bg-slate-50 font-mono text-slate-700"
            >
              ICD-O {entity.icd_o}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{entity.name}</h1>
        {entity.definition && (
          <p className="max-w-2xl text-muted-foreground">{entity.definition}</p>
        )}
        {synonyms.length > 0 && (
          <p className="max-w-2xl text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Also called: </span>
            {synonyms.map((s) => s.term).join(" · ")}
          </p>
        )}
      </header>

      <Separator className="my-8" />

      <div className="flex flex-col gap-10">
        {findings.length > 0 && (
          <Section title="Immunoprofile and molecular findings" count={findings.length}>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Marker</th>
                        <th className="px-4 py-2 font-medium">Result</th>
                        <th className="px-4 py-2 font-medium">Reported in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {findings.map((f) => (
                        <tr key={f.marker.slug} className="border-b last:border-0 align-top">
                          <td className="px-4 py-2">
                            <Link
                              href={`/m/${f.marker.slug}`}
                              className="font-medium hover:underline"
                            >
                              {f.marker.name}
                            </Link>
                            <div className="mt-1">
                              <MarkerKindBadge
                                kind={f.marker.kind}
                                className="text-[10px] px-1.5 py-0"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <CallBadge call={f.call} className="text-[10px] px-1.5 py-0" />
                              {f.certainty === "variable" && (
                                <span className="text-xs text-muted-foreground">variable</span>
                              )}
                              {f.pct_low !== null && (
                                <span className="font-mono text-xs text-muted-foreground">
                                  {f.pct_low}
                                  {f.pct_high !== null && f.pct_high !== f.pct_low
                                    ? `–${f.pct_high}`
                                    : ""}
                                  %
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 tabular-nums text-muted-foreground">
                            {f.sources} {f.sources === 1 ? "source" : "sources"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </Section>
        )}

        {placements.length > 0 && (
          <Section title="Where WHO places it" count={placements.length}>
            <p className="-mt-1 text-sm text-muted-foreground">
              One row per volume. A tumour described in several books has several parents, and none
              of them is more correct than the others.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {placements.map((p) => (
                <Card key={p.volume}>
                  <CardContent className="flex flex-col gap-1.5 p-4">
                    <div className="text-sm font-medium">{p.volume}</div>
                    {p.chapter_name && (
                      <div className="text-xs text-muted-foreground">{p.chapter_name}</div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {p.parent ? (
                        <>
                          under{" "}
                          <Link
                            href={`/e/${p.parent.slug}`}
                            className="text-foreground hover:underline"
                          >
                            {p.parent.name}
                          </Link>
                        </>
                      ) : (
                        <span className="italic">top level in this volume</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {children.length > 0 && (
          <Section title="Subtypes" count={children.length}>
            <div className="flex flex-wrap gap-2">
              {children.map((c) => (
                <Link
                  key={c.slug}
                  href={`/e/${c.slug}`}
                  className="rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </Section>
        )}

        {differentials.length > 0 && (
          <Section title="Differential diagnosis" count={differentials.length}>
            <div className="flex flex-col gap-3">
              {differentials.map((d) => (
                <Card key={d.other.slug}>
                  <CardContent className="flex flex-col gap-1.5 p-4">
                    <Link href={`/e/${d.other.slug}`} className="font-medium hover:underline">
                      {d.other.name}
                    </Link>
                    {d.evidence && <p className="text-sm text-muted-foreground">{d.evidence}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>
        )}
      </div>

      <Separator className="my-10" />
      <p className="text-xs text-muted-foreground">
        Derived from the WHO Classification of Tumours. Findings are pooled across the sources that
        report them; a result shown as variable is one the literature does not agree on.
      </p>
    </div>
  );
}
