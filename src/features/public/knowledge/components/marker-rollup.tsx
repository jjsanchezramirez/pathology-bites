/**
 * The immunoprofile of one entity, one line per (marker, source).
 *
 * This is deliberately not a summary table. Each attestation is what one source
 * printed — its polarity, its figure in the units it used, its own sentence —
 * with the source named beside it. Nothing is summed, averaged or voted on; the
 * only aggregate on the page is how many sources speak and whether they agree.
 * Where they do not, both statements are listed and the row says so.
 *
 * Server component. Expand/collapse is native <details>, so no client JS ships.
 */
import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { EntityKindBadge } from "@/shared/components/ui/entity-kind-badge";
import { CallBadge, MarkerKindBadge } from "@/shared/components/ui/marker-kind-badge";
import { ProseText, PubMedLink } from "@/features/public/knowledge/components/attributed-excerpt";
import type {
  MarkerAttestation,
  MarkerEntityRollup,
  MarkerRollup,
  MarkerRollupRow,
} from "@/features/public/knowledge/lib/queries";

/** What the agreement badge and the attestation list need: either side's row. */
type AttestedRow = { agreement: MarkerRollupRow["agreement"]; attestations: MarkerAttestation[] };

const TABLE_BADGE = "text-[10px] px-1.5 py-0";
/** Lines per entity on the marker page. Ki-67 is reported in ~250 tumours; the
 *  page serialises every rendered element, so it stays compact and defers the
 *  quotes to the entity pages. */
const MARKER_PAGE_CAP = 3;

/** Map polarity + nuance onto the CallBadge vocabulary. */
function callOf(a: MarkerAttestation): string {
  if (
    a.nuance === "loss" ||
    a.nuance === "retained" ||
    a.nuance === "wildtype" ||
    a.nuance === "index"
  ) {
    return a.nuance;
  }
  if (a.polarity === "present") return "positive";
  if (a.polarity === "absent") return "negative";
  return "index";
}

const MODALITY_WORD: Record<MarkerAttestation["modality"], string | null> = {
  asserted: null,
  typical: "typically",
  frequent: "usually",
  occasional: "sometimes",
  rare: "rarely",
  reported: "reported",
  disputed: "disputed",
};

/**
 * "<5%", ">90%", "~40%", "30–70%", "40%" — the figure the way the source wrote it.
 *
 * Legacy rows arrive with `pct_bound` always null (the RPC's legacy branch does
 * not derive it), so a stored quote that printed "> 95%" shows as "95%" until
 * that is fixed upstream. Nothing here rounds a figure or infers a bound.
 */
function pctText(a: MarkerAttestation): string | null {
  const lo = a.pct_low;
  const hi = a.pct_high;
  if (lo === null && hi === null) return null;
  if (a.pct_bound === "upper") return `<${hi ?? lo}%`;
  if (a.pct_bound === "lower") return `>${lo ?? hi}%`;
  if (a.pct_bound === "approx") return `~${lo ?? hi}%`;
  if (lo !== null && hi !== null && lo !== hi) return `${lo}–${hi}%`;
  return `${lo ?? hi}%`;
}

/** The printed figure(s): "56/58 cases", "30–70% of cases", "56/58 cases · 97%". */
function figureText(a: MarkerAttestation): string | null {
  const parts: string[] = [];
  if (a.n_positive !== null && a.n_total !== null) {
    parts.push(`${a.n_positive}/${a.n_total}${a.denominator ? ` ${a.denominator}` : ""}`);
  }
  const pct = pctText(a);
  if (pct) {
    // "of cases" only when the fraction has not already said so.
    parts.push(a.denominator && parts.length === 0 ? `${pct} of ${a.denominator}` : pct);
  }
  return parts.length ? parts.join(" · ") : null;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** True when the name already ends in that year, so it must not be printed twice. */
function endsWithYear(name: string, year: number | null): boolean {
  return year !== null && new RegExp(`\\b${year}\\s*$`).test(name);
}

/**
 * Compact "who printed this" label plus where to read it.
 *
 * `sibling` is another attestation in the same row with the same document_ref
 * — the same chapter or paper, so its URL and year are this document's too. A
 * legacy row whose source record lacks them borrows those two fields and
 * nothing else; a chapter URL is never synthesised.
 */
function sourceOf(
  a: MarkerAttestation,
  sibling?: MarkerAttestation
): { text: string; href: string | null } {
  const url = a.url ?? sibling?.url ?? null;
  const year = a.year ?? sibling?.year ?? null;
  const yearText = year !== null && !endsWithYear(a.authority_name, year) ? ` ${year}` : "";

  // A paper. Legacy rows say `pubmed` and carry the PMID; claim rows say
  // `lit-pmid-<n>` and the PMID is their document_ref. A journal-style name
  // ("Kosmahl M Virchows Arch 2000") already ends with the year.
  if (a.authority === "pubmed" || a.pmid || a.authority.startsWith("lit-pmid-")) {
    const pmid = a.pmid ?? a.document_ref;
    return {
      text: `${a.authority_name}${yearText} · PMID ${pmid}`,
      href: url ?? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    };
  }
  if (a.authority === "pathoutlines") return { text: "PathologyOutlines", href: url };

  // A WHO volume. Legacy rows name it "WHO Classification of Tumours — Digestive
  // System Tumours (5th ed.): <chapter>"; the prefix is the page's footer and
  // the chapter is the page itself, so the volume is what remains.
  let name = a.authority_name
    .replace(/^WHO Classification of Tumours\s*[—–-]\s*/, "")
    .replace(/(\(\d+(?:st|nd|rd|th) ed\.\))\s*:\s.*$/, "$1");
  if (a.edition && !/\bed\./i.test(name)) name += `, ${ordinal(a.edition)} ed.`;
  if (yearText) name += ` (${year})`;
  return { text: name, href: url };
}

/**
 * Distinct source documents behind a row — the one count the page may show.
 *
 * Keyed on document_ref alone. The same document arrives under two authority
 * strings across the claim/legacy boundary (`who-digestive-ed6` and
 * `who_chapter` for chapter 72/123; `lit-pmid-10881741` and `pubmed` for the
 * paper), and a chapter ref ("31/128") can never collide with a PMID.
 */
function sourceCount(row: AttestedRow): number {
  return new Set(row.attestations.map((a) => a.document_ref)).size;
}

function AgreementBadge({ row }: { row: AttestedRow }) {
  const n = sourceCount(row);
  // The RPC judges agreement over attestation rows, and one chapter can hand
  // in several (one per scope). Two rows from one document agreeing is that
  // source repeating itself, not corroboration, so it is shown as one source;
  // two rows from one document disagreeing is that source contradicting
  // itself, and the label says so rather than implying a second source.
  const repeated = row.agreement === "unanimous" && n < 2;
  const s = {
    split: {
      label: n < 2 ? "One source, both results" : "Sources disagree",
      className: "border-amber-300 bg-amber-50 text-amber-700",
      title:
        n < 2
          ? "The only source for this marker states more than one result. Both are listed; nothing is resolved."
          : "At least two sources state different results for this marker. Both are listed; nothing is resolved.",
    },
    unanimous: {
      label: `${n} ${n === 1 ? "source" : "sources"} agree`,
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
      title: "Every source that mentions this marker states the same result.",
    },
    single: {
      label: "1 source",
      className: "border-slate-300 bg-slate-50 text-slate-700",
      title: repeated
        ? "One source states this more than once; nothing else corroborates it."
        : "Only one source mentions this marker for this entity.",
    },
    none: {
      label: "No sources",
      className: "border-slate-300 bg-slate-50 text-slate-700",
      title: "No source is attributed for this marker.",
    },
  }[repeated ? "single" : row.agreement];
  return (
    <Badge variant="outline" className={`${s.className} ${TABLE_BADGE}`} title={s.title}>
      {s.label}
    </Badge>
  );
}

function Attestation({
  a,
  sibling,
  compact = false,
}: {
  a: MarkerAttestation;
  sibling?: MarkerAttestation;
  /** No quote or citation list — for the marker page, where a common marker
   *  has hundreds of lines and the quotes live on each entity's own page. */
  compact?: boolean;
}) {
  const modality = MODALITY_WORD[a.modality] ?? null;
  const figure = figureText(a);
  const source = sourceOf(a, sibling);
  const legacyLabel =
    a.kind === "legacy"
      ? `stored quote${a.quote_located === "unverified" ? " (unverified)" : ""}`
      : null;

  return (
    <li className="flex flex-col gap-1 py-1.5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <CallBadge call={callOf(a)} className={TABLE_BADGE} />
        {a.nuance === "aberrant" && (
          <span className="text-xs text-muted-foreground">aberrant</span>
        )}
        {modality && <span className="text-xs text-muted-foreground">{modality}</span>}
        {figure && <span className="font-mono text-xs">{figure}</span>}
        {a.pattern && <span className="text-xs text-muted-foreground">({a.pattern})</span>}
        {a.scope && <span className="text-xs text-muted-foreground">({a.scope})</span>}
        <span className="text-xs text-muted-foreground/60" aria-hidden="true">
          ·
        </span>
        {source.href ? (
          <a
            href={source.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-foreground/80 hover:text-foreground hover:underline"
          >
            {source.text}
          </a>
        ) : (
          <span className="text-xs text-foreground/80">{source.text}</span>
        )}
        {a.contested && (
          <Badge
            variant="outline"
            className={`border-amber-300 bg-amber-50 text-amber-700 ${TABLE_BADGE}`}
            title="This source states both polarities for this marker"
          >
            Contested
          </Badge>
        )}
        {legacyLabel && (
          <Badge
            variant="outline"
            className={`border-slate-300 bg-slate-50 text-slate-700 ${TABLE_BADGE}`}
            title="Older extraction: the quote has not been re-verified as a character span"
          >
            {legacyLabel}
          </Badge>
        )}
      </div>
      {!compact && (
      <details className="text-xs">
        <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
          quote
        </summary>
        <blockquote className="mt-1 border-l-2 border-muted-foreground/30 pl-2 italic leading-relaxed text-foreground/90">
          <ProseText body={a.quote} />
        </blockquote>
        {a.pmids.length > 0 && (
          <p className="mt-1 pl-2 text-muted-foreground">
            Cites{" "}
            {a.pmids.map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <PubMedLink id={id} />
              </span>
            ))}
          </p>
        )}
      </details>
      )}
    </li>
  );
}

export function MarkerRollupTable({ rollup }: { rollup: MarkerRollup }) {
  if (rollup.markers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No marker statements are attributed to this entity yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">Marker</th>
            <th className="px-4 py-2 font-medium">Agreement</th>
            <th className="px-4 py-2 font-medium">What each source states</th>
          </tr>
        </thead>
        <tbody>
          {rollup.markers.map((row) => {
            // The first attestation per document that knows its URL, so a
            // legacy row from the same chapter can borrow it (see sourceOf).
            const located = new Map<string, MarkerAttestation>();
            for (const a of row.attestations) {
              if (a.url && !located.has(a.document_ref)) located.set(a.document_ref, a);
            }
            return (
              <tr key={row.marker.id} className="border-b align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-2">
                  <Link href={`/m/${row.marker.slug}`} className="font-medium hover:underline">
                    {row.marker.name}
                  </Link>
                  <div className="mt-1">
                    <MarkerKindBadge kind={row.marker.kind} className={TABLE_BADGE} />
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  <AgreementBadge row={row} />
                </td>
                <td className="min-w-[24rem] px-4 py-2">
                  <ul className="divide-y divide-border/60">
                    {row.attestations.map((a) => (
                      <Attestation
                        key={a.claim_id ?? a.evidence_id ?? a.document_ref}
                        a={a}
                        sibling={located.get(a.document_ref)}
                      />
                    ))}
                  </ul>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The marker side: one row per entity the marker is reported in, each
 * source's own statement. Same rules as the entity side; the RPC is
 * `kb_marker_entity_rollup`.
 */
export function MarkerEntityTable({ rollup }: { rollup: MarkerEntityRollup }) {
  if (rollup.entities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tumour in the corpus reports this marker yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">Tumour</th>
            <th className="px-4 py-2 font-medium">Agreement</th>
            <th className="px-4 py-2 font-medium">What each source states</th>
          </tr>
        </thead>
        <tbody>
          {rollup.entities.map((row) => {
            const located = new Map<string, MarkerAttestation>();
            for (const a of row.attestations) {
              if (a.url && !located.has(a.document_ref)) located.set(a.document_ref, a);
            }
            return (
              <tr key={row.entity.id} className="border-b align-top last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/e/${row.entity.slug}`} className="font-medium hover:underline">
                    {row.entity.name}
                  </Link>
                  <div className="mt-1">
                    <EntityKindBadge kind={row.entity.kind} className={TABLE_BADGE} />
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  <AgreementBadge row={row} />
                </td>
                <td className="min-w-[24rem] px-4 py-2">
                  <ul className="divide-y divide-border/60">
                    {row.attestations.slice(0, MARKER_PAGE_CAP).map((a) => (
                      <Attestation
                        key={a.claim_id ?? a.evidence_id ?? a.document_ref}
                        a={a}
                        sibling={located.get(a.document_ref)}
                        compact
                      />
                    ))}
                  </ul>
                  {row.attestations.length > MARKER_PAGE_CAP && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      +{row.attestations.length - MARKER_PAGE_CAP} more —{" "}
                      <Link href={`/e/${row.entity.slug}`} className="hover:underline">
                        every statement, with its quote, on the entity page
                      </Link>
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
