"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import {
  ExternalLink,
  Sparkles,
  ChevronDown,
  Info,
  X,
  Search,
  FlaskConical,
  BookOpen,
  Shuffle,
} from "lucide-react";
import { IHC_MATRIX_URL, IHC_MOLECULAR_URL } from "@/shared/config/ihc-data";
import { buildTextIndex, rankIndexed } from "../search";
import { ImageMatches, SlideMatch } from "./reference-media";
import type { Matrix, Cell, Diagnosis, Marker, MolecularData, MolecularEntry } from "../types";
import {
  rankMarkersForPanel,
  profileForDiagnosis,
  refsForCells,
  pctTone,
  scoreDiagnoses,
  suggestNextMarker,
  minimalPanel,
  profileCompleteness,
  characteristicStains,
  relatedDiagnoses,
  type RankedMarker,
  type Observation,
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
  const title =
    cell.status === "review"
      ? "Two independent extractions disagree — not asserted"
      : variable
        ? "WHO reports this in a subset of cases, not uniformly"
        : undefined;

  return (
    <div className={`rounded-md px-2 py-1 text-center ${toneClass(tone)}`} title={title}>
      <div className="text-sm font-semibold leading-none">{cellLabel(cell)}</div>
      {/* Said out loud rather than implied by colour: a hedged call read as fact
          was the single largest inaccuracy in this table. */}
      {variable ? <div className="mt-0.5 text-[10px] opacity-70">variable</div> : null}
      {cell.n ? <div className="mt-0.5 text-[10px] opacity-70">n={cell.n.toLocaleString()}</div> : null}
    </div>
  );
}

function References({ matrix, cells }: { matrix: Matrix; cells: (Cell | undefined)[] }) {
  const [open, setOpen] = useState(false);
  const refIds = refsForCells(cells);
  const quotes = [...new Set(cells.map((c) => c?.quote).filter((q): q is string => Boolean(q)))];
  if (refIds.length === 0 && quotes.length === 0)
    return <span className="text-[11px] text-muted-foreground/50">—</span>;
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        {refIds.length} ref{refIds.length === 1 ? "" : "s"}
      </button>
      {open && (
        <div className="mt-1 space-y-2 border-l-2 border-muted pl-3">
          {quotes.map((q, i) => (
            <blockquote key={i} className="text-[11px] italic leading-snug text-muted-foreground">
              “{q}” <span className="not-italic opacity-60">— WHO</span>
            </blockquote>
          ))}
          <ul className="space-y-1.5">
          {refIds.map((id) => {
            const ref = matrix.references[id];
            if (!ref) return null;
            const href = ref.pmid
              ? `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`
              : `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(ref.citation)}`;
            return (
              <li key={id} className="text-[11px] leading-snug text-muted-foreground">
                {ref.citation}{" "}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  {ref.pmid ? `PMID ${ref.pmid}` : "PubMed"}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </li>
            );
          })}
          </ul>
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
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Index the full list once; ranking then filters. Rebuilding per keystroke
  // would re-normalize all 1,400+ diagnoses on every character typed.
  const index = useMemo(() => buildTextIndex(matrix.diagnoses), [matrix.diagnoses]);
  const results = useMemo(
    () => (q.trim() ? rankIndexed(q, index, { exclude }) : []),
    [q, index, exclude]
  );

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocus(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {focus && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
          {results.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => {
                  onPick(d.id);
                  setQ("");
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span>{d.name}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">{d.organ}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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

function DxChip({ dx, onRemove }: { dx: Diagnosis; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm text-primary">
      {dx.name}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-primary/70" aria-label={`Remove ${dx.name}`}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
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

  const ranked: RankedMarker[] = useMemo(() => rankMarkersForPanel(matrix, selected), [matrix, selected]);
  const minPanel = useMemo(() => minimalPanel(matrix, selected), [matrix, selected]);
  const selectedDx = selected.map((id) => byId.get(id)!).filter(Boolean);

  return (
    <div className="space-y-4">
      <ModeHeader
        title="Compare a differential"
        subtitle="Pick 2–3 entities; the table ranks markers by how well they separate them. Click a column to open its profile."
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

      {selected.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Search and add diagnoses — or hit Example — to build a panel.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="w-40 py-2 pr-3 text-left font-medium text-muted-foreground">Marker</th>
                {selectedDx.map((dx) => (
                  <th key={dx.id} className="px-2 py-2 text-center font-medium">
                    <button
                      onClick={() => onOpenReference(dx.id)}
                      className="hover:text-primary hover:underline"
                      title="Open full IHC profile"
                    >
                      {dx.name}
                    </button>
                  </th>
                ))}
                <th className="w-16 py-2 pl-2 text-right font-medium text-muted-foreground">Power</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ marker, byDx, spread, discriminates }) => (
                <tr key={marker.id} className="border-b align-top last:border-0">
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
                    <References matrix={matrix} cells={selected.map((id) => byDx[id])} />
                  </td>
                  {selected.map((id) => (
                    <td key={id} className="px-2 py-2">
                      <CellValue cell={byDx[id]} />
                      {byDx[id]?.pattern && (
                        <div className="mt-0.5 text-center text-[10px] text-muted-foreground">
                          {byDx[id]!.pattern}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="py-2 pl-2 text-right">
                    <span
                      className={`text-xs tabular-nums ${discriminates ? "font-semibold text-primary" : "text-muted-foreground"}`}
                    >
                      {spread}
                    </span>
                  </td>
                </tr>
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
  other: "Alteration",
};

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
              </li>
            ))}
          </ul>
        </div>
      )}
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
  const molEntry = molecular?.byDiagnosis[selected];

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
            <h3 className="text-sm font-semibold">
              {dx.name}{" "}
              <span className="font-normal text-muted-foreground">· {dx.organ} · IHC profile</span>
            </h3>
            <span
              className="text-[11px] text-muted-foreground"
              title="How completely this entity's IHC profile is characterised in the knowledge base"
            >
              {rows.length} marker{rows.length === 1 ? "" : "s"} characterised
              {completeness < 0.5 ? " · sparse" : ""}
            </span>
          </div>
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
                <tr key={marker.id} className="border-b align-top last:border-0">
                  <td className="py-2 pr-3 font-medium">{marker.name}</td>
                  <td className="py-2">
                    <CellValue cell={cell} />
                  </td>
                  <td className="py-2 pl-3 text-muted-foreground">{cell.pattern || "—"}</td>
                  <td className="py-2 text-right">
                    <References matrix={matrix} cells={[cell]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {molEntry && <MolecularPanel entry={molEntry} molRefs={molecular!.references} />}
          <div className="mt-5 space-y-4">
            <ImageMatches name={dx.name} aliases={dx.aliases} />
            <SlideMatch name={dx.name} aliases={dx.aliases} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Search box over markers; calls onPick with the marker id. */
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
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const index = useMemo(() => buildTextIndex(matrix.markers), [matrix.markers]);
  const results = useMemo(
    () => (q.trim() ? rankIndexed(q, index, { exclude }) : []),
    [q, index, exclude]
  );

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocus(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {focus && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
          {results.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => {
                  onPick(m.id);
                  setQ("");
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span>{m.name}</span>
                {m.category && <span className="ml-2 text-[10px] text-muted-foreground">{m.category}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A set stain chip: click the label to toggle Pos↔Neg, X to remove. */
function StainChip({
  marker,
  polarity,
  onToggle,
  onRemove,
}: {
  marker: Marker;
  polarity: Observation;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const pos = polarity === "positive";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${
        pos
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
      }`}
    >
      <button onClick={onToggle} className="font-medium" title="Toggle positive / negative">
        {marker.name} {pos ? "+" : "−"}
      </button>
      <button onClick={onRemove} aria-label={`Remove ${marker.name}`} className="opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
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
  const toggle = (id: string) =>
    setObs((o) => ({ ...o, [id]: o[id] === "positive" ? "negative" : "positive" }));
  const remove = (id: string) =>
    setObs((o) => {
      const next = { ...o };
      delete next[id];
      return next;
    });

  const ranked = useMemo(() => scoreDiagnoses(matrix, obs), [matrix, obs]);
  const observedIds = Object.keys(obs);
  const topCandidates = ranked.slice(0, 8).map((r) => r.diagnosis.id);
  const suggestions = useMemo(
    () => suggestNextMarker(matrix, topCandidates, observedIds).slice(0, 4),
    [matrix, topCandidates, observedIds]
  );

  return (
    <div className="space-y-4">
      <ModeHeader
        title="Enter the stains you observed"
        subtitle="The differential re-ranks live as you add results. Click a result to open its full profile."
        onShuffle={() => setObs(makeExample())}
        onClear={() => setObs({})}
        showClear={observedIds.length > 0}
      />

      <MarkerSearch
        matrix={matrix}
        onPick={(id) => setStain(id, "positive")}
        exclude={observedIds}
        placeholder="Add a stain — added positive, click the chip to flip to negative…"
      />

      {observedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(obs).map(([id, pol]) => {
            const marker = markerById.get(id);
            if (!marker) return null;
            return (
              <StainChip
                key={id}
                marker={marker}
                polarity={pol}
                onToggle={() => toggle(id)}
                onRemove={() => remove(id)}
              />
            );
          })}
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
              title={`best splits the current candidates (${s.posCount}+ / ${s.negCount}−)`}
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
        <ol className="space-y-1">
          {ranked.slice(0, 12).map((r, i) => (
            <li key={r.diagnosis.id}>
              <button
                onClick={() => onOpenReference(r.diagnosis.id)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                title="Open full IHC profile"
              >
                <span className="w-5 flex-shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="w-52 flex-shrink-0 truncate text-sm">
                  {r.diagnosis.name}
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    {r.diagnosis.organ}
                  </span>
                </span>
                <span className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
                  <span
                    className="absolute inset-y-0 left-0 rounded bg-primary/70"
                    style={{ width: `${Math.round(r.support * 100)}%` }}
                  />
                </span>
                <span className="flex w-16 flex-shrink-0 items-center justify-end gap-1.5 text-[11px]">
                  <span className="text-emerald-600" title="markers consistent with this diagnosis">
                    ✓{r.matched}
                  </span>
                  {r.conflicts > 0 && (
                    <span className="text-rose-600" title="markers that contradict this diagnosis">
                      ✕{r.conflicts}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function IhcPanelTool() {
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [molecular, setMolecular] = useState<MolecularData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("diagnose");
  // Reference selection is lifted so other modes can open a diagnosis here.
  const [referenceId, setReferenceId] = useState<string>("");

  useEffect(() => {
    fetch(IHC_MATRIX_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((m: Matrix) => {
        setMatrix(m);
        // seed Reference with a random example so it's never empty
        if (m.diagnoses.length) {
          setReferenceId(m.diagnoses[Math.floor(Math.random() * m.diagnoses.length)].id);
        }
      })
      .catch((e) => setError(String(e)));
    // Molecular companion is optional — the tool works without it.
    fetch(IHC_MOLECULAR_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((m: MolecularData | null) => m && setMolecular(m))
      .catch(() => {});
  }, []);

  const openReference = (id: string) => {
    setReferenceId(id);
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
              <PanelMode matrix={matrix} onOpenReference={openReference} />
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
                Prototype — {matrix.diagnoses.length.toLocaleString()} diagnoses,{" "}
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
