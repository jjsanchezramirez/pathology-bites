import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { EntityKindBadge } from "@/shared/components/ui/entity-kind-badge";
import { CallBadge } from "@/shared/components/ui/marker-kind-badge";
import { Separator } from "@/shared/components/ui/separator";
import {
  entityDetail,
  entityMarkerRollup,
  entityMonograph,
  resolveEntity,
  type MonographAxis,
  type MonographClaim,
  type MonographClaimDissent,
} from "@/features/public/knowledge/lib/queries";
import {
  AttributedExcerpt,
  plainText,
} from "@/features/public/knowledge/components/attributed-excerpt";
import { MarkerRollupTable } from "@/features/public/knowledge/components/marker-rollup";
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
  // entities.definition is populated on 13 of 4,014 rows, so nearly every page
  // fell through to the boilerplate. WHO's own Definition section covers 2,899
  // chapters; the RPC already reduces it to one sentence, and markers are
  // stripped because this is a meta tag, not evidence. entityMonograph is
  // React-cached, so the page render reuses this same call.
  let whoDef: string | null = null;
  if (!e.definition) {
    const m = await entityMonograph(e.slug);
    const first = m?.axes.find((a) => a.axis === "definition")?.excerpts[0]?.excerpt;
    if (first) whoDef = plainText(first);
  }
  return {
    title: e.name,
    description:
      (e.definition ?? whoDef)?.slice(0, 160) ??
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

/**
 * The lede is one sentence whichever way it came. The RPC already caps an
 * excerpt at 240 characters; a curated `entities.definition` is not capped in
 * the database (four run past 240, the longest 667), so both paths are clamped
 * here, at a word boundary so a cut reads as one. generateMetadata keeps its
 * own 160-character slice of the full text.
 */
const LEDE_MAX = 240;

function clampLede(text: string): string {
  if (text.length <= LEDE_MAX) return text;
  const cut = text.slice(0, LEDE_MAX - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > LEDE_MAX / 2 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

/**
 * `dissent` holds every other claim behind a verdict, and nearly all of them
 * restate the winner. Only one that states something else — another polarity,
 * code or text — is a disagreement, and only those are printed.
 */
function disagreeing(c: MonographClaim): MonographClaimDissent[] {
  return c.dissent.filter(
    (d) => d.polarity !== c.polarity || d.code !== c.code || d.text !== c.text
  );
}

/**
 * The resolved claims on a non-marker axis — an ICD-O code, a subtype name, a
 * staging pointer — each with the source that made it. Marker claims are not
 * listed here: the rollup table below carries them per source, which is the
 * only way they should be read.
 *
 * A claim with neither text nor code falls back to its sentence, which is a
 * single attributed quote and nothing more.
 */
function ClaimList({
  claims,
  sourceName,
}: {
  claims: MonographClaim[];
  sourceName: (authority: string) => string;
}) {
  const shown = claims.filter((c) => c.text || c.code || c.quote);
  if (shown.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {shown.map((c, i) => {
        const others = disagreeing(c);
        return (
          <li
            key={`${c.predicate}-${c.object_key ?? i}-${c.authority}`}
            className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
          >
            {c.polarity === "absent" && (
              <CallBadge call="negative" className="text-[10px] px-1.5 py-0" />
            )}
            {c.text ? (
              <span>{c.text}</span>
            ) : c.code ? (
              <span className="font-mono">
                {c.code_system ? (
                  <span className="text-muted-foreground">{c.code_system} </span>
                ) : null}
                {c.code}
              </span>
            ) : (
              <span className="italic text-foreground/80">{plainText(c.quote ?? "")}</span>
            )}
            <span className="text-xs text-muted-foreground">— {sourceName(c.authority)}</span>
            {others.length > 0 && (
              <span className="text-xs text-amber-700">
                (disagrees:{" "}
                {others
                  .map(
                    (d) => `${sourceName(d.authority)}: ${d.text ?? d.code ?? d.polarity ?? "—"}`
                  )
                  .join("; ")}
                )
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Axes whose claims are marker statements; those live in the rollup table, not a list. */
const MARKER_AXES = new Set(["ihc", "molecular"]);

function axisHasContent(a: MonographAxis): boolean {
  return a.excerpts.length > 0 || (a.claims.length > 0 && !MARKER_AXES.has(a.axis));
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
  const [{ placements, synonyms, differentials, children }, monograph, rollup] = await Promise.all([
    entityDetail(entity),
    entityMonograph(entity.slug),
    entityMarkerRollup(entity.slug),
  ]);

  // The monograph axes carry one attributed excerpt per source document, never
  // the section itself. `holds` records how well any source covers each axis,
  // so an axis that is empty because WHO never writes one (Treatment,
  // Differential) can say so instead of looking broken.
  const axes = monograph?.axes ?? [];
  // entities.definition is populated on 13 of 4,014 rows. When it is empty the
  // lede is WHO's own first sentence, attributed, and that axis is not repeated
  // as a section.
  const defExcerpt = axes.find((a) => a.axis === "definition")?.excerpts[0] ?? null;
  const ledeFromWho = !entity.definition && !!defExcerpt;
  const ledeSource = entity.definition ?? (defExcerpt ? plainText(defExcerpt.excerpt) : null);
  const lede = ledeSource ? clampLede(ledeSource) : null;
  const withContent = axes.filter(
    (a) => axisHasContent(a) && !(ledeFromWho && a.axis === "definition")
  );
  const neverCovered = axes.filter((a) => a.holds === "none" && !axisHasContent(a));
  // Claims only carry the source slug; the excerpts on the same page know its name.
  const authorityNames = new Map<string, string>();
  for (const a of axes) {
    for (const x of a.excerpts) {
      if (!authorityNames.has(x.authority)) {
        authorityNames.set(x.authority, `${x.authority_name}${x.year ? ` (${x.year})` : ""}`);
      }
    }
  }
  const sourceName = (authority: string) => authorityNames.get(authority) ?? authority;

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
        {lede && <p className="max-w-2xl text-muted-foreground">{lede}</p>}
        {ledeFromWho && defExcerpt && (
          <p className="max-w-2xl text-xs text-muted-foreground/80">
            Definition after WHO {defExcerpt.authority_name}
            {defExcerpt.year ? ` (${defExcerpt.year})` : ""}
            {defExcerpt.url && (
              <>
                {" · "}
                <a
                  href={defExcerpt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground hover:underline"
                >
                  full section
                </a>
              </>
            )}
          </p>
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
        {withContent.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {entity.kind === "category"
              ? "WHO describes this as a grouping rather than a diagnosis, so the monograph sits on the entities below it rather than here."
              : "No source text has been loaded for this entity yet. Its classification and findings below come from the curated record."}
          </p>
        )}

        {withContent.map((a) => (
          <Section key={a.axis} title={a.label}>
            <div className="flex flex-col gap-4">
              {a.excerpts.map((x) => (
                <AttributedExcerpt key={`${x.authority}-${x.ref}`} excerpt={x} />
              ))}
              {a.claims.length > 0 && !MARKER_AXES.has(a.axis) && (
                <ClaimList claims={a.claims} sourceName={sourceName} />
              )}
            </div>
          </Section>
        ))}

        {neverCovered.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Not covered by WHO: </span>
            {neverCovered.map((a) => a.label).join(", ")}. The WHO Classification of Tumours has no
            such section in any of its 2,959 chapters, so this is a gap in the source, not in the
            record.
          </p>
        )}

        <Section
          title="Immunoprofile and molecular findings, by source"
          count={rollup?.markers.length ?? 0}
        >
          <p className="-mt-1 text-sm text-muted-foreground">
            Every statement is attributed to the source that printed it. Percentages and counts are
            shown as printed; nothing is pooled across sources, and disagreement is shown, not
            resolved.
          </p>
          {rollup && rollup.markers.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <MarkerRollupTable rollup={rollup} />
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              No marker statements are attributed to this entity yet.
            </p>
          )}
        </Section>

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
          <Section title="Subtype pages" count={children.length}>
            <p className="-mt-1 text-sm text-muted-foreground">
              Subtypes that have their own page here. WHO&rsquo;s own list, as printed, is under
              Subtypes above; the two can differ where a subtype has no page yet.
            </p>
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
        Derived from the WHO Classification of Tumours and the literature it cites. Statements are
        quoted, attributed and never blended; where sources disagree, both are shown.
      </p>
    </div>
  );
}
