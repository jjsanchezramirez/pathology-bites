"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  ExternalLink,
  Sparkles,
  ChevronDown,
  Info,
  X,
  FlaskConical,
  BookOpen,
  Shuffle,
} from "lucide-react";
import { resolveIhcUrls } from "@/shared/config/ihc-data";
import { buildTextIndex, rankIndexed } from "../search";
import { aggregateMatrix, withoutSyndromes, poolCells, type RedirectMap } from "../aggregate";
import { mergePatternMarkers, orderableStains } from "../marker-vocabulary";
import { compareMarkerNames } from "../marker-order";
import { ImageMatches, SlideMatch } from "./reference-media";
import { PickerInput } from "./picker-input";
import type { Matrix, Cell, Diagnosis, Marker, MolecularData, MolecularEntry } from "../types";
import {
  rankMarkersForPanel,
  profileForDiagnosis,
  refsForCells,
  pctTone,
  scoreDiagnoses,
  explainScore,
  suggestNextMarker,
  minimalPanel,
  profileCompleteness,
  characteristicStains,
  relatedDiagnoses,
  OBSERVATIONS,
  OBSERVATION_SYMBOL,
  type RankedMarker,
  type Observation,
  type DiagnosisScore,
} from "../panel-engine";

/** Diagnosis ids with a reasonably characterised profile (≥4 cells). */
function useRichDiagnoses(matrix: Matrix) {
  return useMemo(() => {
    const count = new Map<string, number>();
    for (const c of matrix.cells) count.set(c.d, (count.get(c.d) ?? 0) + 1);
    return matrix.diagnoses.filter((d) => (count.get(d.id) ?? 0) >= 4);
  }, [matrix]);
}

function randomOf<T>(arr: T[]): T | undefined {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}

/**
 * How to caption a merged entity's organ context.
 *
 * After ./aggregate.ts folds a tumour's chapter rows together, one row can span
 * nine WHO volumes. Printing all nine crowds the line, and printing only the
 * representative one hides that the entry is broader than that book — so name
 * up to two and count the rest.
 */
function organLabel(dx: Diagnosis): string {
  const organs = dx.organs?.length ? dx.organs : [dx.organ];
  if (organs.length <= 2) return organs.join(" · ");
  return `${organs.slice(0, 2).join(" · ")} +${organs.length - 2}`;
}

const MAX_PANEL = 3;
type Mode = "diagnose" | "panel" | "profile";

function toneClass(tone: "pos" | "partial" | "neg" | "unsettled"): string {
  if (tone === "pos") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (tone === "partial") return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  // Deliberately colourless: the two extractions disagreed, so the table has no
  // claim to make and should not look like it does.
  if (tone === "unsettled") return "bg-muted text-muted-foreground";
  return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
}

/** Legend clarifying that "—" means unstated in WHO, NOT reported-negative. */
function ResultLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          Pos
        </span>
        expressed
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          Neg
        </span>
        reported negative
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-muted-foreground/50">—</span>
        not stated in WHO (unknown, ≠ negative)
      </span>
    </div>
  );
}

function cellLabel(cell: Cell): string {
  if (cell.status === "review") return "?";
  // An index is a number, not a call: "Ki-67 < 5%" is not Ki-67 negative.
  if (cell.polarity === "index") return cell.pct !== null && cell.pct !== undefined ? `${cell.pct}%` : "index";
  if (cell.pct !== null && cell.pct !== undefined) return `${cell.pct}%`;
  return cell.polarity === "positive" ? "Pos" : "Neg";
}

function CellValue({ cell }: { cell?: Cell }) {
  if (!cell) return <span className="text-xs text-muted-foreground/40">—</span>;
  const tone = pctTone(cell);
  const variable = cell.certainty === "variable" && cell.status !== "review";
  const title = cell.conflicted
    ? `WHO volumes disagree about this stain (${cell.sourceCount} chapters pooled) — not asserted`
    : cell.status === "review"
      ? "Two independent extractions disagree — not asserted"
      : variable
        ? "WHO reports this in a subset of cases, not uniformly"
        : undefined;

  return (
    <div className={`rounded-md px-2 py-1 text-center ${toneClass(tone)}`} title={title}>
      <div className="text-sm font-semibold leading-none">{cellLabel(cell)}</div>
      {/* Said out loud rather than implied by colour: a hedged call read as fact
          was the single largest inaccuracy in this table. */}
      {cell.conflicted ? (
        <div className="mt-0.5 text-[10px] opacity-70">books differ</div>
      ) : variable ? (
        <div className="mt-0.5 text-[10px] opacity-70">variable</div>
      ) : null}
      {cell.n ? <div className="mt-0.5 text-[10px] opacity-70">n={cell.n.toLocaleString()}</div> : null}
    </div>
  );
}

/**
 * A reference line, with the PMID said once.
 *
 * `citation` is usually "WHO-cited (PMID 9888704)", so printing it next to a
 * "PMID 9888704" link stated the same number twice and cost two wrapped lines to
 * do it. The number is the link; the citation keeps only whatever it says that
 * the link does not.
 */
function refParts(ref: { citation: string; pmid?: string }) {
  const label = ref.pmid
    ? ref.citation.replace(/\s*[([]?\s*PMID:?\s*\d+\s*[)\]]?\s*/i, " ").trim().replace(/[·,;:—-]\s*$/, "")
    : ref.citation;
  return {
    label,
    text: ref.pmid ? `PMID ${ref.pmid}` : "PubMed",
    href: ref.pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`
      : `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(ref.citation)}`,
  };
}

function useRefs(matrix: Matrix, cells: (Cell | undefined)[]) {
  const refIds = refsForCells(cells);
  // A merged cell carries every volume's sentence, not just the first one —
  // that is the whole point of pooling the evidence rather than picking a book.
  const quotes = [
    ...new Set(cells.flatMap((c) => (c ? (c.quotes ?? [c.quote]) : [])).filter((q): q is string => Boolean(q))),
  ];
  return { refIds, quotes, any: refIds.length > 0 || quotes.length > 0 };
}

/**
 * One marker row in the single-diagnosis profile, plus the evidence row it opens.
 *
 * Two <tr>s rather than one: the toggle belongs in the narrow Refs column, but
 * the evidence it reveals needs the whole table width. Rendering the panel inside
 * that 80px cell is what made a WHO sentence wrap at four words a line.
 */
function ProfileRow({
  matrix, marker, cell,
}: { matrix: Matrix; marker: Marker; cell: Cell }) {
  const [open, setOpen] = useState(false);
  const { refIds, quotes, any } = useRefs(matrix, [cell]);
  return (
    <>
      <tr className={`align-top ${open ? "" : "border-b"} last:border-0`}>
        <td className="py-2 pr-3 font-medium">{marker.name}</td>
        <td className="py-2">
          <CellValue cell={cell} />
        </td>
        <td className="py-2 pl-3 text-muted-foreground">{cell.pattern || "\u2014"}</td>
        <td className="py-2 text-right">
          {any ? (
            <RefsToggle count={refIds.length} open={open} onToggle={() => setOpen((o) => !o)} />
          ) : (
            <span className="text-[11px] text-muted-foreground/50">&mdash;</span>
          )}
        </td>
      </tr>
      {open && any && (
        <tr className="border-b last:border-0">
          <td colSpan={4} className="pb-2">
            <RefsPanel matrix={matrix} refIds={refIds} quotes={quotes} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * One marker row in the comparison table, plus the evidence row it opens.
 *
 * Same two-<tr> shape as ProfileRow. The column count is 1 (marker) + one per
 * selected diagnosis + 1 (power), so the evidence row can span the table exactly
 * rather than being squeezed into the marker cell.
 */
function CompareRow({
  matrix, marker, cells, spread, discriminates, partialCoverage, testedCount, arms,
}: {
  matrix: Matrix;
  marker: Marker;
  cells: (Cell | undefined)[];
  spread: number;
  discriminates: boolean;
  partialCoverage: boolean;
  testedCount: number;
  arms: number;
}) {
  const [open, setOpen] = useState(false);
  const { refIds, quotes, any } = useRefs(matrix, cells);
  return (
    <>
      <tr className={`align-top ${open ? "" : "border-b"} last:border-0`}>
        <td className="py-2 pr-3">
          <div className="flex items-center gap-1.5 font-medium">
            {marker.name}
            {discriminates && (
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-label="discriminates" />
            )}
          </div>
          {marker.aliases && marker.aliases[0] && marker.aliases[0] !== marker.name && (
            <div className="text-[10px] text-muted-foreground">{marker.aliases[0]}</div>
          )}
          {any && (
            <div className="mt-1">
              <RefsToggle count={refIds.length} open={open} onToggle={() => setOpen((o) => !o)} />
            </div>
          )}
        </td>
        {cells.map((c, i) => (
          <td key={i} className="px-2 py-2">
            <CellValue cell={c} />
            {c?.pattern && (
              <div className="mt-0.5 text-center text-[10px] text-muted-foreground">{c.pattern}</div>
            )}
          </td>
        ))}
        <td className="py-2 pl-2 text-right">
          <span
            className={`text-xs tabular-nums ${discriminates ? "font-semibold text-primary" : "text-muted-foreground"}`}
            title={
              discriminates
                ? `Power ${spread}: WHO records this marker for every entity here and their results are far apart — a true discriminator.`
                : partialCoverage
                  ? `Power ${spread}: WHO records this marker for only ${testedCount} of the ${arms} entities, so its power is scaled down by that coverage — the untested arms are unknown, not negative.`
                  : `Power ${spread}: recorded for every entity here, but their results are close together, so it separates them poorly.`
            }
          >
            {spread}
            {partialCoverage && <span className="ml-0.5 opacity-60">*</span>}
          </span>
        </td>
      </tr>
      {open && any && (
        <tr className="border-b last:border-0">
          <td colSpan={cells.length + 2} className="pb-2">
            <RefsPanel matrix={matrix} refIds={refIds} quotes={quotes} />
          </td>
        </tr>
      )}
    </>
  );
}

/** The narrow-column control. The panel it opens is rendered by the row, full width. */
function RefsToggle({
  count, open, onToggle,
}: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground"
    >
      <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      {count} ref{count === 1 ? "" : "s"}
    </button>
  );
}

/**
 * The expanded evidence, laid out across the FULL table width.
 *
 * It used to render inside the 80px right-aligned "Refs" cell, so a WHO sentence
 * wrapped at about four words a line and three citations occupied most of a
 * screen while the middle of the row sat empty. As an expandable row it reads
 * left-to-right at normal measure, and references that share a label (nearly all
 * are "WHO-cited") state it once and list their PMIDs inline.
 */
function RefsPanel({
  matrix, refIds, quotes,
}: { matrix: Matrix; refIds: string[]; quotes: string[] }) {
  const refs = refIds.map((id) => matrix.references[id]).filter(Boolean).map(refParts);
  const labels = [...new Set(refs.map((r) => r.label).filter(Boolean))];
  const shared = labels.length === 1 && refs.every((r) => r.label === labels[0]) ? labels[0] : null;
  const link = (r: ReturnType<typeof refParts>, key: string) => (
    <a
      key={key}
      href={r.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 whitespace-nowrap text-primary hover:underline"
    >
      {r.text}
      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
    </a>
  );
  return (
    <div className="border-l-2 border-muted py-2 pl-3 text-left">
      {quotes.map((q, i) => (
        <blockquote key={i} className="max-w-prose text-[11px] italic leading-relaxed text-muted-foreground">
          &ldquo;{q}&rdquo; <span className="not-italic opacity-60">&mdash; WHO</span>
        </blockquote>
      ))}
      {refs.length > 0 && (
        <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-muted-foreground ${quotes.length ? "mt-1.5" : ""}`}>
          {shared && <span className="opacity-70">{shared}</span>}
          {refs.map((r, i) =>
            shared ? (
              link(r, String(i))
            ) : (
              <span key={i} className="inline-flex items-baseline gap-1">
                {r.label && <span className="opacity-70">{r.label}</span>}
                {link(r, String(i))}
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}
/** Search box that filters diagnoses and calls onPick when one is chosen. */
function DiagnosisSearch({
  matrix,
  onPick,
  placeholder,
  exclude = [],
}: {
  matrix: Matrix;
  onPick: (id: string) => void;
  placeholder: string;
  exclude?: string[];
}) {
  // Index the full list once; ranking then filters. Rebuilding per keystroke
  // would re-normalize all 1,400+ diagnoses on every character typed.
  const index = useMemo(() => buildTextIndex(matrix.diagnoses), [matrix.diagnoses]);
  const excludeKey = exclude.join("|");
  const search = useCallback(
    (q: string) => rankIndexed(q, index, { exclude: excludeKey ? excludeKey.split("|") : [] }),
    [index, excludeKey]
  );

  return (
    <PickerInput
      placeholder={placeholder}
      search={search}
      onPick={(d) => onPick(d.id)}
      renderRow={(d) => (
        <>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="min-w-0 break-words">{d.name}</span>
            <KindBadge kind={d.kind} />
          </span>
          <span className="ml-2 shrink-0 text-right text-[10px] text-muted-foreground">
            {organLabel(d)}
          </span>
        </>
      )}
    />
  );
}

/** PubMed link for a diagnosis (images + slides are embedded below, not linked). */
function LearnLinks({ name }: { name: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(name)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <BookOpen className="h-3.5 w-3.5" />
        PubMed
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}

/**
 * A genetic tumour syndrome is not a tumour, and the difference is not cosmetic
 * here: the stains listed under one are SURROGATES for a germline defect (SDHB
 * loss standing in for an SDHx mutation, MMR-protein loss for Lynch), performed
 * on the tumour but read as evidence about the patient. Markers that merely
 * belong to a tumour the syndrome predisposes to are re-homed onto that tumour,
 * because "MEN2 is positive for calcitonin" is false -- the medullary carcinoma
 * is. Canonical outline badge per the repo's badge rules.
 */
function KindBadge({ kind }: { kind?: Diagnosis["kind"] }) {
  if (!kind || kind === "neoplasm") return null;
  const label = kind === "syndrome" ? "syndrome" : "non-neoplastic";
  const tone =
    kind === "syndrome"
      ? "border-purple-300 bg-purple-50 text-purple-700"
      : "border-sky-300 bg-sky-50 text-sky-700";
  return (
    <Badge variant="outline" className={`${tone} text-[10px] px-1.5 py-0 font-normal`}>
      {label}
    </Badge>
  );
}

function SyndromeNote({ name }: { name: string }) {
  return (
    <div className="mt-2 flex gap-2 rounded-md border border-purple-200 bg-purple-50/60 px-3 py-2 text-[11px] leading-relaxed text-purple-900 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-200">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        <strong>{name}</strong> is a genetic tumour syndrome, not a tumour. The stains below are
        surrogates for the underlying germline defect — performed on tissue, but read as evidence
        about the patient. Markers belonging to the tumours this syndrome predisposes to are listed
        under those tumours instead.
      </span>
    </div>
  );
}

function DxChip({ dx, onRemove }: { dx: Diagnosis; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm text-primary">
      {dx.name}
      <KindBadge kind={dx.kind} />
      {onRemove && (
        <button onClick={onRemove} className="hover:text-primary/70" aria-label={`Remove ${dx.name}`}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

type MarkerOrder = "power" | "name";

/** A column header that is also the control for ordering by that column. */
function SortToggle({
  label,
  active,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`underline decoration-dotted underline-offset-2 hover:text-foreground ${
        active ? "font-semibold text-foreground decoration-solid" : ""
      }`}
    >
      {label}
    </button>
  );
}

/**
 * What the Power column means. Sits ABOVE the table, because a legend printed
 * under a long scrolling table is read after the thing it explains, if at all.
 */
function PowerNote({ hasStars }: { hasStars: boolean }) {
  return (
    <p className="rounded-lg border p-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">Power (0–100)</span> is how far apart these
      entities&rsquo; results are for a marker: positive in one and negative in another scores ~83,
      positive in all of them ~0. A marker WHO records for only some of them is scaled by that
      coverage and marked <span className="font-medium">*</span> — unstated is unknown, not
      negative.
      {hasStars && (
        <>
          {" "}
          <Sparkles className="inline h-3 w-3 text-primary" /> = every arm tested, gap ≥ 60.
        </>
      )}
    </p>
  );
}

function randomDifferential(matrix: Matrix, rich: Diagnosis[]): string[] {
  const seed = randomOf(rich);
  if (!seed) return matrix.diagnoses.slice(0, 2).map((d) => d.id);
  return [seed.id, ...relatedDiagnoses(matrix, seed.id, MAX_PANEL - 1)].slice(0, MAX_PANEL);
}

function PanelMode({
  matrix,
  onOpenReference,
}: {
  matrix: Matrix;
  onOpenReference: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(matrix.diagnoses.map((d) => [d.id, d])), [matrix]);
  const rich = useRichDiagnoses(matrix);
  const [selected, setSelected] = useState<string[]>(() => randomDifferential(matrix, rich));
  const add = (id: string) =>
    setSelected((cur) => (cur.includes(id) || cur.length >= MAX_PANEL ? cur : [...cur, id]));
  const remove = (id: string) => setSelected((cur) => cur.filter((x) => x !== id));

  const [order, setOrder] = useState<MarkerOrder>("power");
  const byPower: RankedMarker[] = useMemo(
    () => rankMarkersForPanel(matrix, selected),
    [matrix, selected]
  );
  // Power ranking answers "what should I order?"; marker order answers "what
  // does this entity look like?". Both are wanted, and neither is a default the
  // other can live without — so it is a control, not a decision.
  const ranked = useMemo(
    () =>
      order === "power"
        ? byPower
        : [...byPower].sort((a, b) => compareMarkerNames(a.marker.name, b.marker.name)),
    [byPower, order]
  );
  const minPanel = useMemo(() => minimalPanel(matrix, selected), [matrix, selected]);
  const selectedDx = selected.map((id) => byId.get(id)!).filter(Boolean);

  return (
    <div className="space-y-4">
      <ModeHeader
        title="Compare a differential"
        subtitle="Pick 2–3 entities — listed per WHO volume, so you can compare a specific chapter. Click a column to open its profile."
        onShuffle={() => setSelected(randomDifferential(matrix, rich))}
        onClear={() => setSelected([])}
        showClear={selected.length > 0}
      />
      <div className="flex flex-wrap items-center gap-2">
        {selectedDx.map((dx) => (
          <DxChip key={dx.id} dx={dx} onRemove={() => remove(dx.id)} />
        ))}
      </div>
      {selected.length < MAX_PANEL && (
        <DiagnosisSearch
          matrix={matrix}
          onPick={add}
          exclude={selected}
          placeholder={`Add a diagnosis to the differential (${selected.length}/${MAX_PANEL})…`}
        />
      )}

      {selected.length > 1 && <PowerNote hasStars={ranked.some((r) => r.discriminates)} />}

      {selected.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Search and add diagnoses — or hit Example — to build a panel.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="w-40 py-2 pr-3 text-left font-medium text-muted-foreground">
                  <SortToggle
                    label="Marker"
                    active={order === "name"}
                    onClick={() => setOrder("name")}
                    title="Order rows by marker name (CD3 · CD5 · CD10 · CD20)"
                  />
                </th>
                {selectedDx.map((dx) => (
                  <th key={dx.id} className="px-2 py-2 text-center font-medium">
                    <button
                      onClick={() => onOpenReference(dx.id)}
                      className="hover:text-primary hover:underline"
                      title="Open full IHC profile"
                    >
                      {dx.name}
                    </button>
                    <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                      {organLabel(dx)}
                    </div>
                  </th>
                ))}
                <th className="w-16 py-2 pl-2 text-right font-medium text-muted-foreground">
                  <SortToggle
                    label="Power"
                    active={order === "power"}
                    onClick={() => setOrder("power")}
                    title="Order rows by discriminating power — see the note under the table"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ marker, byDx, spread, discriminates, partialCoverage, testedCount }) => (
                <CompareRow
                  key={marker.id}
                  matrix={matrix}
                  marker={marker}
                  cells={selected.map((id) => byDx[id])}
                  spread={spread}
                  discriminates={discriminates}
                  partialCoverage={partialCoverage}
                  testedCount={testedCount}
                  arms={selected.length}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected.length > 1 && ranked.some((r) => r.discriminates) && (
        <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
          <span>
            <span className="font-medium text-foreground">
              {ranked.filter((r) => r.discriminates).slice(0, 6).map((r) => r.marker.name).join(" · ")}
            </span>{" "}
            best separate this differential (largest positivity gap). Markers concordant across all
            diagnoses add little here even when strongly positive.
          </span>
        </div>
      )}

      {minPanel.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 p-3 text-xs text-muted-foreground">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
          <span>
            <span className="font-medium text-foreground">Minimal panel:</span>{" "}
            <span className="font-medium text-foreground">
              {minPanel.map((p) => p.marker.name).join(" · ")}
            </span>{" "}
            — the fewest stains that pairwise-separate these {selected.length} entities.
          </span>
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  fusion: "Fusion",
  mutation: "Mutation",
  amplification: "Amplification",
  deletion: "Deletion",
  methylation: "Methylation",
  aneuploidy: "Aneuploidy",
  other: "Alteration",
};

/** WHO prints inline footnote markers as `{9923922; 21307665}`. They are the
 *  citation, which already renders as reference links, so they are stripped from
 *  the displayed sentence rather than shown as noise inside it. */
const displayQuote = (q: string) =>
  q.replace(/\{[^}]*\}/g, "").replace(/\s+([,.;:])/g, "$1").replace(/\s+/g, " ").trim();

/** Molecular alterations + therapeutic/predictive markers for one diagnosis. */
function MolecularPanel({ entry, molRefs }: { entry: MolecularEntry; molRefs: MolecularData["references"] }) {
  const refLink = (id: string) => {
    const r = molRefs[id];
    const href = r?.pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`
      : `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(id)}`;
    return (
      <a
        key={id}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {r?.pmid ? r.pmid : "ref"}
      </a>
    );
  };
  return (
    <div className="mt-5 space-y-3">
      {entry.molecular.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Molecular alterations
          </h4>
          <ul className="mt-1.5 space-y-1.5">
            {entry.molecular.map((m, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                  {KIND_LABEL[m.kind] ?? "Alteration"}
                </span>
                {m.presence === "absent" && (
                  <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    Absent
                  </span>
                )}
                <span className="font-medium">{m.alteration}</span>
                {m.significance && <span className="text-muted-foreground">— {m.significance}</span>}
                {m.detection && (
                  <span className="text-[11px] text-muted-foreground">· {m.detection}</span>
                )}
                {m.refs.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    [
                    {m.refs.slice(0, 3).map((id, j) => (
                      <span key={id}>
                        {j > 0 ? ", " : ""}
                        {refLink(id)}
                      </span>
                    ))}
                    ]
                  </span>
                )}
                {m.quote && (
                  <span className="w-full text-[11px] italic leading-snug text-muted-foreground">
                    &ldquo;{displayQuote(m.quote)}&rdquo;
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {entry.therapeutic.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Therapeutic / predictive
          </h4>
          <ul className="mt-1.5 space-y-1.5">
            {entry.therapeutic.map((t, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Predictive
                </span>
                <span className="font-medium">{t.marker}</span>
                {t.implication && <span className="text-muted-foreground">— {t.implication}</span>}
                {t.refs.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    [
                    {t.refs.slice(0, 3).map((id, j) => (
                      <span key={id}>
                        {j > 0 ? ", " : ""}
                        {refLink(id)}
                      </span>
                    ))}
                    ]
                  </span>
                )}
                {t.quote && (
                  <span className="w-full text-[11px] italic leading-snug text-muted-foreground">
                    &ldquo;{displayQuote(t.quote)}&rdquo;
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Pool the molecular companion across the chapter rows an entity was merged
 * from. Alterations are deduped on (kind, alteration) and predictive markers on
 * the marker name, with references unioned — the same read-time pooling the IHC
 * cells get, for the same reason: two books making the same claim is one claim
 * with two citations, not two entries.
 */
function mergeMolecular(
  molecular: MolecularData | null,
  memberIds: string[]
): MolecularEntry | undefined {
  if (!molecular) return undefined;
  const entries = memberIds.map((id) => molecular.byDiagnosis[id]).filter(Boolean);
  if (entries.length === 0) return undefined;
  if (entries.length === 1) return entries[0];

  const molByKey = new Map<string, MolecularEntry["molecular"][number]>();
  for (const e of entries) {
    for (const m of e.molecular) {
      const key = `${m.kind}|${m.alteration.toLowerCase()}|${m.presence ?? "present"}`;
      const seen = molByKey.get(key);
      if (seen) seen.refs = [...new Set([...seen.refs, ...m.refs])];
      else molByKey.set(key, { ...m, refs: [...m.refs] });
    }
  }
  const thByKey = new Map<string, MolecularEntry["therapeutic"][number]>();
  for (const e of entries) {
    for (const t of e.therapeutic) {
      const key = t.marker.toLowerCase();
      const seen = thByKey.get(key);
      if (seen) seen.refs = [...new Set([...seen.refs, ...t.refs])];
      else thByKey.set(key, { ...t, refs: [...t.refs] });
    }
  }
  return {
    name: entries[0].name,
    organ: entries[0].organ,
    molecular: [...molByKey.values()],
    therapeutic: [...thByKey.values()],
  };
}

/**
 * Said out loud when a profile is built from more than one WHO volume, because
 * the alternative is a silent merge: the reader would see one CD20 row with
 * three citations and no way to know it was three books agreeing.
 */
function MergedNote({ dx }: { dx: Diagnosis }) {
  const books = dx.books ?? [];
  return (
    <div className="mt-2 flex gap-2 rounded-md border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        WHO describes this entity in {books.length} volumes and this profile pools all of them:{" "}
        <span className="text-foreground">{books.join(" · ")}</span>. Where two volumes make the
        same call the references are combined; where they disagree the row is shown as unsettled
        rather than picking one.
      </span>
    </div>
  );
}

function ProfileMode({
  matrix,
  molecular,
  selected,
  onSelect,
}: {
  matrix: Matrix;
  molecular: MolecularData | null;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const rows = useMemo(() => profileForDiagnosis(matrix, selected), [matrix, selected]);
  const dx = matrix.diagnoses.find((d) => d.id === selected);
  const completeness = useMemo(() => profileCompleteness(matrix, selected), [matrix, selected]);
  // The molecular companion is keyed on the CHAPTER-level slug, so after the
  // entity merge a lookup on the representative id alone would silently drop
  // every alteration the other volumes contributed.
  const molEntry = useMemo(
    () => mergeMolecular(molecular, dx?.memberIds ?? [selected]),
    [molecular, dx, selected]
  );

  const pickRandom = () => {
    const r = randomOf(matrix.diagnoses);
    if (r) onSelect(r.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <DiagnosisSearch matrix={matrix} onPick={onSelect} placeholder="Search a diagnosis…" />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={pickRandom}
          title="Jump to a random WHO diagnosis"
        >
          <Shuffle className="mr-1.5 h-4 w-4" /> Example
        </Button>
      </div>
      {dx && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex flex-wrap items-baseline gap-1.5 text-sm font-semibold">
              {dx.name}
              <KindBadge kind={dx.kind} />
              <span className="font-normal text-muted-foreground">
                · {organLabel(dx)} · {dx.kind === "syndrome" ? "surrogate markers" : "IHC profile"}
              </span>
            </h3>
            <span
              className="text-[11px] text-muted-foreground"
              title="How completely this entity's IHC profile is characterised in the knowledge base"
            >
              {rows.length} marker{rows.length === 1 ? "" : "s"} characterised
              {completeness < 0.5 ? " · sparse" : ""}
            </span>
          </div>
          {dx.kind === "syndrome" && <SyndromeNote name={dx.name} />}
          {dx.books && dx.books.length > 1 && <MergedNote dx={dx} />}
          <div className="mt-2">
            <LearnLinks name={dx.name} />
          </div>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="w-40 py-2 pr-3 text-left font-medium">Marker</th>
                <th className="w-20 py-2 text-center font-medium">Result</th>
                <th className="py-2 pl-3 text-left font-medium">Pattern</th>
                <th className="w-20 py-2 text-right font-medium">Refs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ marker, cell }) => (
                <ProfileRow key={marker.id} matrix={matrix} marker={marker} cell={cell} />
              ))}
            </tbody>
          </table>
          {molEntry && molecular && <MolecularPanel entry={molEntry} molRefs={molecular.references} />}
          <div className="mt-5 space-y-4">
            <ImageMatches name={dx.name} aliases={dx.aliases} />
            <SlideMatch name={dx.name} aliases={dx.aliases} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * How many entities the knowledge base records a marker for. Used both to rank
 * the marker picker and to caption each row.
 */
function useMarkerUsage(matrix: Matrix): Map<string, number> {
  return useMemo(() => {
    const count = new Map<string, number>();
    for (const c of matrix.cells) count.set(c.m, (count.get(c.m) ?? 0) + 1);
    return count;
  }, [matrix]);
}

/**
 * Search box over markers; calls onPick with the marker id.
 *
 * Each row used to be captioned with `marker.category`, which sounds like a
 * lineage class and is not one: it is the WHO ORGAN VOLUME whose chapter the
 * marker was first extracted from. So CD3 was labelled "Digestive System",
 * which is meaningless — an antibody is not an organ system, and the label was
 * an artefact of extraction order rather than a fact about the stain. The
 * caption is now what a marker actually has: the other names it goes by, and
 * how widely the knowledge base uses it.
 */
function MarkerSearch({
  matrix,
  onPick,
  exclude = [],
  placeholder,
}: {
  matrix: Matrix;
  onPick: (id: string) => void;
  exclude?: string[];
  placeholder: string;
}) {
  const usage = useMarkerUsage(matrix);
  // Only stains you can actually order. "Melanoma markers" and "neuroendocrine
  // markers" are WHO's category phrases, not antibodies — they stay in the data
  // and still show in a Reference profile, but offering them here invites a
  // panel that double-counts the specific stains it already contains.
  const index = useMemo(() => buildTextIndex(orderableStains(matrix.markers)), [matrix.markers]);
  const excludeKey = exclude.join("|");
  const search = useCallback(
    (q: string) =>
      rankIndexed(q, index, {
        exclude: excludeKey ? excludeKey.split("|") : [],
        // Tiebreak toward stains in wide use. Capped at 6 points, well under
        // the gap between adjacent match tiers, so this reorders equally-good
        // matches and never promotes a worse one.
        boost: (m) => Math.min(6, Math.log2(1 + (usage.get(m.id) ?? 0))),
      }),
    [index, excludeKey, usage]
  );

  return (
    <PickerInput
      placeholder={placeholder}
      search={search}
      onPick={(m) => onPick(m.id)}
      renderRow={(m) => (
        <>
          <span className="min-w-0">
            {m.name}
            {m.aliases?.[0] && m.aliases[0] !== m.name && (
              <span className="ml-1.5 text-[10px] text-muted-foreground">{m.aliases[0]}</span>
            )}
          </span>
          <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
            {(usage.get(m.id) ?? 0).toLocaleString()} entities
          </span>
        </>
      )}
    />
  );
}

const OBS_STYLE: Record<Observation, string> = {
  positive:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  variable:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  negative:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

const OBS_LABEL: Record<Observation, string> = {
  positive: "positive",
  variable: "variable (patchy / subset)",
  negative: "negative",
};

/** positive → variable → negative → positive. */
const nextObservation = (o: Observation): Observation =>
  OBSERVATIONS[(OBSERVATIONS.indexOf(o) + 1) % OBSERVATIONS.length];

/**
 * A set stain: click the chip to cycle its result, X to drop it.
 *
 * It used to be a two-state toggle, which meant a patchy or subset-only stain —
 * the commonest thing to be unsure about at the scope, and the thing WHO itself
 * hedges on in 19.7% of its own calls — had to be entered as a clean positive
 * or a clean negative and was then scored as one. `variable` is a real observed
 * outcome in the engine now (panel-engine.ts `outcomeProbs`), so the chip cycles
 * through three. The result is carried by the symbol and the colour rather than
 * by extra controls: +, +/−, −, in green, amber and red.
 */
function StainChip({
  marker,
  polarity,
  onSet,
  onRemove,
}: {
  marker: Marker;
  polarity: Observation;
  onSet: (next: Observation) => void;
  onRemove: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors ${OBS_STYLE[polarity]}`}
    >
      <button
        type="button"
        onClick={() => onSet(nextObservation(polarity))}
        className="font-medium"
        title={`${marker.name} ${OBS_LABEL[polarity]} — click for ${OBS_LABEL[nextObservation(polarity)]}`}
        aria-label={`${marker.name}: ${OBS_LABEL[polarity]}. Activate to change.`}
      >
        {marker.name}{" "}
        <span className="tabular-nums">{OBSERVATION_SYMBOL[polarity]}</span>
      </button>
      <button
        onClick={onRemove}
        aria-label={`Remove ${marker.name}`}
        className="opacity-60 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

const pctText = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Why a candidate ranks where it does, stain by stain.
 *
 * The ranking is a sum of log-likelihood RATIOS (panel-engine.ts
 * `scoreDiagnoses`), and the ratio is the part that is not self-evident: a
 * result is only evidence to the extent it is *unusual*. Showing the two rates
 * the ratio is built from — how often this entity gives that result, against
 * how often anything in the knowledge base does — is what makes "CD20+ told us
 * almost nothing here" legible instead of surprising.
 */
function ScoreBreakdown({
  matrix,
  diagnosisId,
  observations,
}: {
  matrix: Matrix;
  diagnosisId: string;
  observations: Record<string, Observation>;
}) {
  const rows = useMemo(
    () => explainScore(matrix, diagnosisId, observations),
    [matrix, diagnosisId, observations]
  );
  if (!rows.length) return null;
  return (
    <div className="border-l-2 border-muted py-2 pl-3">
      <table className="w-full text-left text-[11px]">
        <thead className="text-muted-foreground">
          <tr>
            <th className="pr-3 font-medium">Stain</th>
            <th className="pr-3 font-medium">You saw</th>
            <th className="pr-3 font-medium">This entity</th>
            <th className="pr-3 font-medium" title="How often any entity recorded for this marker gives that result">
              Any entity
            </th>
            <th className="pr-3 text-right font-medium" title="Evidence contributed, in bits. 0 = this result told us nothing here.">
              Evidence
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.marker.id} className="align-top">
              <td className="py-0.5 pr-3 font-medium">{r.marker.name}</td>
              <td className="py-0.5 pr-3">{OBSERVATION_SYMBOL[r.observation]}</td>
              <td className="py-0.5 pr-3 text-muted-foreground">
                {r.cell ? pctText(r.diagnosisRate) : <span className="opacity-60">not stated</span>}
              </td>
              <td className="py-0.5 pr-3 text-muted-foreground">{pctText(r.baseRate)}</td>
              <td
                className={`py-0.5 pr-3 text-right tabular-nums ${
                  r.agreement === "supports"
                    ? "text-emerald-600"
                    : r.agreement === "against"
                      ? "text-rose-600"
                      : "text-muted-foreground"
                }`}
              >
                {r.bits > 0 ? "+" : ""}
                {r.bits.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        Evidence is measured in bits: <strong>+1 bit doubles</strong> the odds of this diagnosis,
        −1 bit halves them. A result common across the whole knowledge base scores near zero
        however well it matches — CD20 positive separates almost nothing among B-cell entities.
        A stain WHO does not record for this entity scores exactly zero: unstated is not negative.
        The row total is then discounted for how many of your stains are unstated here, so a
        candidate known for two of eight is not ranked as if it were known for eight.
      </p>
    </div>
  );
}

/**
 * Shown when even the best candidate is characterised for under half the panel.
 *
 * Without it the tool presents a confident-looking twelve-row list built on two
 * matching stains out of seven, and nothing on screen says that the knowledge
 * base simply has little to say about this combination. A ranking of noise
 * should announce itself.
 */
function ThinCoverageNote({ best, total }: { best: number; total: number }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span>
        <span className="font-medium">Thin evidence for this panel.</span> WHO records at most{" "}
        {best} of your {total} stains for any entity here, so this ranking rests on a small part of
        what you entered — read it as a shortlist, not a differential. Stains WHO tends to
        characterise (broad lineage and keratin markers) will separate candidates better than
        entity-defining ones, which its chapters often assert without listing.
      </span>
    </div>
  );
}

/** The ranking rules, said once, above the results rather than in a tooltip. */
function ScoringNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border p-3 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <span>
        <span className="font-medium text-foreground">How the ranking works.</span> Each entity is
        scored on how much better its WHO profile explains your stains than an average entity does
        — the sum, in bits, of{" "}
        <span className="whitespace-nowrap">log₂(this entity ÷ any entity)</span> for each result.
        Rare results dominate; commonplace ones contribute almost nothing; a marker WHO never
        records for an entity contributes exactly zero rather than counting against it — but a
        candidate WHO describes for only a few of your stains is discounted for the ones it says
        nothing about, so it cannot ride one lucky match to the top of a long panel. Open{" "}
        <span className="font-medium text-foreground">why?</span> on any row for the stain-by-stain
        arithmetic.
      </span>
    </div>
  );
}

function ModeHeader({
  title,
  subtitle,
  onShuffle,
  onClear,
  showClear,
}: {
  title: string;
  subtitle: string;
  onShuffle: () => void;
  onClear?: () => void;
  showClear?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-shrink-0 gap-1.5">
        {showClear && onClear && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onShuffle} title="Load a random worked example">
          <Shuffle className="mr-1.5 h-4 w-4" /> Example
        </Button>
      </div>
    </div>
  );
}

/**
 * One candidate in the ranked differential.
 *
 * The name used to live in a fixed `w-52 truncate` column, which is 208px — too
 * narrow for almost every WHO name, so the list read as a column of clipped
 * fragments ("Extranodal marginal zone lymphoma of mucosa-asso…") that were
 * frequently indistinguishable from one another. The name now takes the width
 * it needs and wraps; the bar and counts are what get a fixed column.
 */
function CandidateRow({
  matrix,
  rank,
  score,
  observations,
  total,
  onOpenReference,
}: {
  matrix: Matrix;
  rank: number;
  score: DiagnosisScore;
  observations: Record<string, Observation>;
  /** How many stains were entered, for the coverage caption. */
  total: number;
  onOpenReference: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dx = score.diagnosis;
  return (
    <li className="border-b last:border-0">
      <div className="flex items-start gap-3 py-1.5">
        <span className="w-5 flex-shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onOpenReference(dx.id)}
            className="text-left text-sm hover:text-primary hover:underline"
            title="Open full IHC profile"
          >
            {dx.name}
          </button>
          <KindBadge kind={dx.kind} />
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
            <span>{organLabel(dx)}</span>
            {/* Said out loud, because it is doing real work in the ranking: a
                candidate WHO characterises for two of your eight stains is
                discounted for the six it says nothing about. */}
            <span
              className={score.coverage < 0.5 ? "text-amber-600" : undefined}
              title={`WHO records ${score.tested} of your ${total} stains for this entity. The rest are unstated — not negative — so its score is discounted for them.`}
            >
              {score.tested}/{total} stains
            </span>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-0.5 hover:text-foreground"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
              why?
            </button>
          </div>
        </div>
        <div className="flex w-40 flex-shrink-0 items-center gap-2 pt-1 sm:w-56">
          <span className="relative h-3 flex-1 overflow-hidden rounded bg-muted">
            <span
              className="absolute inset-y-0 left-0 rounded bg-primary/70"
              style={{ width: `${Math.max(2, Math.round(score.support * 100))}%` }}
            />
          </span>
          <span className="flex w-16 flex-shrink-0 items-center justify-end gap-1 text-[11px]">
            <span className="text-emerald-600" title="stains consistent with this entity">
              ✓{score.matched}
            </span>
            {score.partial > 0 && (
              <span className="text-amber-600" title="stains WHO reports as variable here">
                ~{score.partial}
              </span>
            )}
            {score.conflicts > 0 && (
              <span className="text-rose-600" title="stains that contradict this entity">
                ✕{score.conflicts}
              </span>
            )}
          </span>
        </div>
      </div>
      {open && (
        <div className="pb-2 pl-8">
          <ScoreBreakdown matrix={matrix} diagnosisId={dx.id} observations={observations} />
        </div>
      )}
    </li>
  );
}

function DiagnoseMode({
  matrix,
  onOpenReference,
}: {
  matrix: Matrix;
  onOpenReference: (id: string) => void;
}) {
  const markerById = useMemo(() => new Map(matrix.markers.map((m) => [m.id, m])), [matrix]);
  const richDx = useRichDiagnoses(matrix);

  const makeExample = useCallback((): Record<string, Observation> => {
    const seed = randomOf(richDx);
    if (!seed) return {};
    return Object.fromEntries(
      characteristicStains(matrix, seed.id, 4).map((s) => [s.markerId, s.polarity])
    );
  }, [matrix, richDx]);

  const [obs, setObs] = useState<Record<string, Observation>>(() => makeExample());

  const setStain = (id: string, polarity: Observation) => setObs((o) => ({ ...o, [id]: polarity }));
  const remove = (id: string) =>
    setObs((o) => {
      const next = { ...o };
      delete next[id];
      return next;
    });

  const ranked = useMemo(() => scoreDiagnoses(matrix, obs), [matrix, obs]);
  const observedIds = Object.keys(obs);
  // Deliberately NOT sorted. These are the stains the user typed, in the order
  // they typed them — that order is their working notes, and re-sorting it
  // under them makes the panel they just entered unrecognisable. (Ordering is
  // wanted in the comparison table, where the rows are ours, not theirs.)
  const chips = observedIds
    .map((id) => markerById.get(id))
    .filter((m): m is Marker => Boolean(m));
  // Weight the candidates by their current support so the suggestion splits the
  // entities still in play, not two no-hopers that happen to differ.
  const candidates = useMemo(
    () => ranked.slice(0, 12).map((r) => ({ id: r.diagnosis.id, weight: r.support })),
    [ranked]
  );
  const suggestions = useMemo(
    () => suggestNextMarker(matrix, candidates, observedIds).slice(0, 4),
    [matrix, candidates, observedIds]
  );

  return (
    <div className="space-y-4">
      <ModeHeader
        title="Enter the stains you observed"
        subtitle="Set each stain positive, variable (patchy/subset) or negative. The differential re-ranks live."
        onShuffle={() => setObs(makeExample())}
        onClear={() => setObs({})}
        showClear={observedIds.length > 0}
      />

      <MarkerSearch
        matrix={matrix}
        onPick={(id) => setStain(id, "positive")}
        exclude={observedIds}
        placeholder="Add a stain — added positive; click a chip to cycle + → +/− → −…"
      />

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((marker) => (
            <StainChip
              key={marker.id}
              marker={marker}
              polarity={obs[marker.id]}
              onSet={(next) => setStain(marker.id, next)}
              onRemove={() => remove(marker.id)}
            />
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary/5 p-3 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Order next:
          </span>
          {suggestions.map((s) => (
            <button
              key={s.marker.id}
              onClick={() => setStain(s.marker.id, "positive")}
              className="rounded-full border border-primary/40 bg-background px-2.5 py-0.5 text-primary hover:bg-primary/10"
              title={`Best splits the candidates still in play (${s.posCount} positive / ${s.negCount} negative among them)`}
            >
              {s.marker.name}
            </button>
          ))}
        </div>
      )}

      {observedIds.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Add the stains you observed — or hit Example — to rank the differential.
        </p>
      ) : ranked.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No diagnosis in the knowledge base has data for these markers.
        </p>
      ) : (
        <>
          {ranked[0].coverage < 0.5 && (
            <ThinCoverageNote best={ranked[0].tested} total={observedIds.length} />
          )}
          <ScoringNote />
          <ol>
            {ranked.slice(0, 12).map((r, i) => (
              <CandidateRow
                key={r.diagnosis.id}
                matrix={matrix}
                rank={i + 1}
                score={r}
                observations={obs}
                total={observedIds.length}
                onOpenReference={onOpenReference}
              />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

export function IhcPanelTool() {
  // TWO views of the same data, on purpose.
  //
  //   merged — one row per tumour. What Diagnose and Reference use, because a
  //            differential listing the same disease once per book that
  //            describes it is noise the reader has to undo.
  //   raw    — one row per (tumour, WHO volume). What the Differential uses,
  //            because comparing profiles is precisely where you may want a
  //            SPECIFIC chapter — the digestive-tract MALT lymphoma rather than
  //            a pooling of every book that mentions it.
  //
  // `idMap` carries a raw id to the merged entity that absorbed it, so opening
  // a Reference from a Differential column still lands somewhere that exists.
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [rawMatrix, setRawMatrix] = useState<Matrix | null>(null);
  const [idMap, setIdMap] = useState<Record<string, string>>({});
  const [molecular, setMolecular] = useState<MolecularData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("diagnose");
  // Reference selection is lifted so other modes can open a diagnosis here.
  const [referenceId, setReferenceId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    // URLs come from the R2 manifest, so a republished dataset is picked up
    // without an app redeploy. Falls back to the compiled URLs if unreachable.
    resolveIhcUrls().then(({ matrixUrl, molecularUrl, entityGroupsUrl }) => {
      if (cancelled) return;

      // The merge map is an optional refinement, so it must never delay or
      // fail the matrix: a rejected fetch resolves to an empty map and the
      // aggregation falls back to grouping by canonical name alone.
      const groups: Promise<RedirectMap> = entityGroupsUrl
        ? fetch(entityGroupsUrl)
            .then((r) => (r.ok ? r.json() : null))
            .then((g: { redirects?: RedirectMap } | null) => g?.redirects ?? {})
            .catch(() => ({}))
        : Promise.resolve({});

      Promise.all([
        fetch(matrixUrl).then((r) =>
          r.ok ? (r.json() as Promise<Matrix>) : Promise.reject(new Error(`HTTP ${r.status}`))
        ),
        groups,
      ])
        .then(([loaded, redirects]) => {
          if (cancelled) return;
          // One antibody per marker: `cytoplasmic NPM1` and `abnormal
          // cytoplasmic NPM1` are NPM1 with a pattern, and the picker was
          // offering all three as separate stains.
          const raw = mergePatternMarkers(loaded, poolCells);
          // The shipped artifact carries one row per (tumour, WHO volume); the
          // tool shows one row per tumour. Without this, a search for a common
          // entity returned it once per book that describes it — seven rows of
          // extranodal marginal zone lymphoma, all with identical support.
          const { matrix: merged, idMap: map } = aggregateMatrix(raw, redirects);
          // Syndromes are excluded from every search and every ranking — see
          // withoutSyndromes(). Applied to BOTH views so the Differential's
          // per-volume picker cannot offer one either.
          setRawMatrix(withoutSyndromes(raw));
          setIdMap(map);
          setMatrix(withoutSyndromes(merged));
          // seed Reference with a random example so it's never empty
          if (merged.diagnoses.length) {
            setReferenceId(
              merged.diagnoses[Math.floor(Math.random() * merged.diagnoses.length)].id
            );
          }
        })
        .catch((e) => !cancelled && setError(String(e)));

      // Molecular companion is optional — the tool works without it.
      fetch(molecularUrl)
        .then((r) => (r.ok ? r.json() : null))
        .then((m: MolecularData | null) => !cancelled && m && setMolecular(m))
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openReference = (id: string) => {
    // Reference shows merged entities, so a raw per-volume id from the
    // Differential has to be resolved to the entity that absorbed it.
    setReferenceId(idMap[id] ?? id);
    setMode("profile");
  };

  return (
    <Card className="w-full max-w-4xl shadow-lg">
      <CardContent className="p-4 md:p-6">
        {error ? (
          <p className="py-10 text-center text-sm text-rose-600">Failed to load data: {error}</p>
        ) : !matrix ? (
          <div className="space-y-3 py-10">
            <div className="mx-auto h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="mx-auto h-4 w-64 animate-pulse rounded bg-muted" />
            <p className="text-center text-sm text-muted-foreground">Loading IHC data…</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Button
                variant={mode === "diagnose" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("diagnose")}
              >
                <FlaskConical className="mr-1.5 h-4 w-4" /> Diagnose
              </Button>
              <Button
                variant={mode === "panel" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("panel")}
              >
                Differential
              </Button>
              <Button
                variant={mode === "profile" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("profile")}
              >
                Reference
              </Button>
            </div>

            {mode === "diagnose" ? (
              <DiagnoseMode matrix={matrix} onOpenReference={openReference} />
            ) : mode === "panel" ? (
              <PanelMode matrix={rawMatrix ?? matrix} onOpenReference={openReference} />
            ) : (
              <ProfileMode
                matrix={matrix}
                molecular={molecular}
                selected={referenceId}
                onSelect={setReferenceId}
              />
            )}

            {mode !== "diagnose" && (
              <div className="mt-4 border-t pt-3">
                <ResultLegend />
              </div>
            )}

            <div className="mt-6 flex items-start gap-2 border-t pt-4 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Prototype — {matrix.diagnoses.length.toLocaleString()} tumours (from{" "}
                {(rawMatrix ?? matrix).diagnoses.length.toLocaleString()} WHO chapter entries),{" "}
                {matrix.markers.length} markers, {matrix.cells.length.toLocaleString()} cells, each
                anchored to a primary reference (many resolved to a verified PubMed ID; case counts
                where quantified). Most cells are qualitative (Pos/Neg); percentages are reported
                rates. Decision support only — verify against the cited source.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
