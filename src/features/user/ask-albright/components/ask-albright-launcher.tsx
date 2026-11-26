"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LoaderCircle, SendHorizontal, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { cn } from "@/shared/utils";
import { inlineLinks, parseAnswerBlocks } from "../lib/answer-blocks";
import type { AskVisual } from "../lib/visuals";
import { MAX_QUESTION_CHARS, normalizeQuestion } from "../lib/router";
import { AlbrightAvatar } from "./albright-avatar";

interface AskResponse {
  answer: string;
  sourceLabel: string;
  cached: boolean;
  citations: Array<{ n: number; title: string; href: string; sourceLabel?: string }>;
  tables?: AskTable[];
  followUps?: string[];
  /** True when the server answered from the user's history (asked before). */
  repeated?: boolean;
  /** Set when the question was declined without searching (nothing to rate). */
  scope?: string;
  /** The saved history entry, when there is one (needed to rate the answer). */
  historyId?: string | null;
  /** The user's rating: 1 helpful, -1 not, null none. */
  feedback?: -1 | 1 | null;
  /** True while the text is still arriving. */
  streaming?: boolean;
  /** True while the model is writing its diagram (shown as a placeholder). */
  drawing?: boolean;
  /** The one visual, if any: a diagram, library images or a linked published figure. */
  visual?: AskVisual;
}

/**
 * The text so far, without the model's trailing "Follow-ups:" line, which only
 * becomes buttons once the answer is complete.
 */
function streamingText(raw: string): string {
  // A ```mermaid block is the diagram, drawn once the answer is complete.
  const fence = raw.search(/```/);
  if (fence >= 0) raw = raw.slice(0, fence);
  const m = raw.match(/(?:^|\n|[.!?][ \t]+)[ \t>*_-]*\**follow[- ]?ups?\b[\s\S]*$/i);
  return m ? raw.slice(0, (m.index ?? 0) + (/^[.!?]/.test(m[0]) ? 1 : 0)) : raw;
}

/** Read an NDJSON response line by line. */
async function* ndjson(res: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line);
    }
  }
}

interface AskTable {
  n: number;
  headers: string[];
  rows: Array<{ name: string; cells: string[] }>;
  focusRows: string[];
}

// An active quiz must not get an answer button, and Anki owns its full screen.
const HIDDEN = [/^\/dashboard\/quiz\/(?!new$)[^/]+$/, /^\/dashboard\/anki$/];

/**
 * Colour a cell by what it says, ignoring citations and bold: positive green,
 * negative grey, partial (rare/focal/weak/variable/±) amber, "not stated" muted.
 * Shared by both tables so they read the same.
 */
function cellTone(cell: string): string {
  const t = cell
    .replace(/\[\d(?:,\s*\d)*\]|\*\*/g, "")
    .trim()
    .toLowerCase();
  if (/^not stated/.test(t)) return "italic text-muted-foreground";
  if (/^\+{3}/.test(t)) return "font-semibold text-emerald-700";
  if (/^(\+{1,2}(?!\/)|positive)/.test(t)) return "text-emerald-700";
  if (/^(-|–|negative)/.test(t)) return "text-muted-foreground";
  if (/^(±|\+\/-|rare|focal|weak|variable|patchy)/.test(t)) return "text-amber-700";
  return "";
}

/**
 * The one table style in the card, used for the model's own tables and for
 * panels rebuilt from the sources. First column is the row label (sticky when
 * the table scrolls sideways); `focus` rows are highlighted.
 */
function GridTable({
  caption,
  header,
  rows,
  focus = [],
  citations,
  pending = false,
}: {
  caption: React.ReactNode;
  header: string[];
  rows: string[][];
  focus?: string[];
  citations: AskResponse["citations"];
  /** Rows are still streaming in: show a placeholder row where the next one lands. */
  pending?: boolean;
}) {
  const focused = new Set(focus);
  return (
    <figure className="space-y-1">
      <figcaption className="text-[11px] font-medium text-muted-foreground">{caption}</figcaption>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-muted/60">
            <tr>
              {header.map((h, k) => (
                <th
                  key={k}
                  className={cn(
                    "whitespace-nowrap px-2 py-1.5 font-medium",
                    k === 0 ? "sticky left-0 bg-muted text-left" : "text-center"
                  )}
                >
                  <Inline text={h} citations={citations} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const isFocus = focused.has(row[0]);
              return (
                <tr key={r} className={cn("border-t align-top", isFocus && "bg-primary/5")}>
                  {row.map((cell, k) =>
                    k === 0 ? (
                      <th
                        key={k}
                        scope="row"
                        className={cn(
                          "sticky left-0 whitespace-nowrap px-2 py-1.5 text-left font-medium",
                          isFocus ? "bg-muted font-semibold" : "bg-background"
                        )}
                      >
                        <Inline text={cell} citations={citations} />
                      </th>
                    ) : (
                      <td key={k} className={cn("px-2 py-1.5 text-center", cellTone(cell))}>
                        <Inline text={cell.replace(/^-(?=\s|\[|$)/, "–")} citations={citations} />
                      </td>
                    )
                  )}
                </tr>
              );
            })}
            {pending && (
              <tr className="border-t" aria-hidden="true">
                {header.map((_, k) => (
                  <td key={k} className="px-2 py-2">
                    <div
                      className={cn(
                        "h-2.5 animate-pulse rounded bg-muted",
                        k === 0 ? "w-16" : "mx-auto w-8"
                      )}
                    />
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/**
 * A run of citation markers — "[1]", "[1,3]", "[1], [3]" — with the space
 * before it. Rendered as one superscript ¹·³ instead of bulky bracketed links.
 */
const CITE_RUN = /(\s*\[\d(?:,\s*\d)*\](?:\s*,?\s*\[\d(?:,\s*\d)*\])*)/g;

/**
 * Superscript citation numbers, each linking to its source. `relative` +
 * `top` raises them without `vertical-align: super`, which grew the line box
 * and pushed table-cell text down ("–" read as "_").
 */
function CiteSup({ cites }: { cites: AskResponse["citations"] }) {
  return (
    <sup className="relative -top-[0.45em] ml-px align-baseline text-[0.7em] leading-none">
      {cites.map((c, k) => (
        <span key={c.n}>
          {k > 0 && ","}
          <a
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            title={`${c.sourceLabel ? `${c.sourceLabel} · ` : ""}${c.title}`}
            className="font-medium text-primary hover:underline"
          >
            {c.n}
          </a>
        </span>
      ))}
    </sup>
  );
}

/** In-site links in a reply (see inlineLinks): page names the guide or small talk point to. */
function SiteLinks({ text }: { text: string }) {
  return (
    <>
      {inlineLinks(text).map((p, j) =>
        p.href ? (
          <Link key={j} href={p.href} className="text-primary underline underline-offset-2">
            {p.text}
          </Link>
        ) : (
          p.text
        )
      )}
    </>
  );
}

/** `**bold**`, citation markers and in-site links; everything else is plain text. */
function Inline({ text, citations }: { text: string; citations: AskResponse["citations"] }) {
  return (
    <>
      {text.split(CITE_RUN).flatMap((part, i) => {
        if (i % 2 === 1) {
          const nums = [...new Set(part.match(/\d+/g)!.map(Number))];
          const cites = nums.map((n) => citations.find((c) => c.n === n));
          if (cites.every(Boolean)) {
            return [<CiteSup key={i} cites={cites as AskResponse["citations"]} />];
          }
          return [<span key={i}>{part}</span>];
        }
        return part.split(/(\*\*[^*]+\*\*)/g).map((seg, k) => {
          const bold = seg.match(/^\*\*([^*]+)\*\*$/);
          return bold ? (
            <strong key={`${i}-${k}`}>{bold[1]}</strong>
          ) : (
            <span key={`${i}-${k}`}>
              <SiteLinks text={seg} />
            </span>
          );
        });
      })}
    </>
  );
}

/** Paragraphs, bullet lists and Markdown tables, in the order the model wrote them. */
function AnswerText({
  text,
  citations,
  streaming = false,
}: {
  text: string;
  citations: AskResponse["citations"];
  streaming?: boolean;
}) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {parseAnswerBlocks(text, { streaming }).map((b, i) => {
        if (b.kind === "list") {
          return (
            <div key={i} className="space-y-0.5">
              {b.title && (
                <p className="text-xs font-semibold text-foreground/80">
                  <Inline text={b.title} citations={citations} />
                </p>
              )}
              {b.inline ? (
                // A panel of short items flows on one line: PAX8¹ · CAIX¹ · CD10¹ …
                <p className="leading-relaxed">
                  {b.items.map((item, k) => (
                    <span key={k}>
                      {/* Real spaces around the dot: without them the line has no
                          break opportunity and runs off the card. */}
                      {k > 0 && (
                        <>
                          {" "}
                          <span className="mx-0.5 text-muted-foreground/60">·</span>{" "}
                        </>
                      )}
                      <span className={item.length <= 30 ? "whitespace-nowrap" : undefined}>
                        <Inline text={item} citations={citations} />
                      </span>
                    </span>
                  ))}
                </p>
              ) : (
                <ul className="list-disc space-y-1 pl-4">
                  {b.items.map((item, k) => (
                    <li key={k}>
                      <Inline text={item} citations={citations} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }
        if (b.kind === "table") {
          return (
            <GridTable
              key={i}
              caption="Summary table — from the cited sources"
              header={b.header}
              rows={b.rows}
              citations={citations}
              pending={b.pending}
            />
          );
        }
        return (
          <p key={i}>
            <Inline text={b.text} citations={citations} />
          </p>
        );
      })}
    </div>
  );
}

interface HistoryEntry {
  id: string;
  question: string;
  result: AskResponse;
  createdAt: string;
  feedback?: -1 | 1 | null;
}

/**
 * A Mermaid flowchart, rendered on demand (the library loads only when an
 * answer has a diagram). Strict security level: labels are text, no HTML or
 * click handlers. A diagram that fails to render is simply left out.
 */
function Diagram({ code }: { code: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "inherit",
          flowchart: { htmlLabels: false, useMaxWidth: true },
        });
        const out = await mermaid.render(`albright-diagram-${id}`, code);
        if (!cancelled) setSvg(out.svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);
  if (failed) return null;
  return (
    <figure className="space-y-1">
      <figcaption className="text-[11px] font-medium text-muted-foreground">
        Diagram — drawn from the answer above
      </figcaption>
      {svg ? (
        <div
          className="overflow-x-auto rounded-lg border bg-background p-2 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          // Mermaid output at securityLevel "strict" (sanitised, no scripts or links).
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
      )}
    </figure>
  );
}

/** Up to three library images, linked to full size, with their credit line. */
function ImageStrip({ images }: { images: Extract<AskVisual, { kind: "images" }>["images"] }) {
  return (
    <figure className="space-y-1">
      <figcaption className="text-[11px] font-medium text-muted-foreground">
        From the Pathology Bites image library
      </figcaption>
      <div className="grid grid-cols-3 gap-1.5">
        {images.map((im) => (
          <a
            key={im.url}
            href={im.url}
            target="_blank"
            rel="noopener noreferrer"
            title={im.credit ? `${im.alt} — ${im.credit}` : im.alt}
            className="group block overflow-hidden rounded-md border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- library images on the image CDN */}
            <img
              src={im.url}
              alt={im.alt}
              loading="lazy"
              className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
            />
          </a>
        ))}
      </div>
      {images.some((im) => im.credit) && (
        <p className="line-clamp-2 text-[10px] text-muted-foreground">
          {[...new Set(images.map((im) => im.credit).filter(Boolean))].join(" · ")}
        </p>
      )}
    </figure>
  );
}

/** A published figure as a link: its legend and the paper, never the image itself (publisher copyright). */
function FigureCard({ legend, href }: { legend: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block space-y-1 rounded-lg border p-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        Published figure <ExternalLink className="h-3 w-3" />
      </span>
      <span className="line-clamp-3 text-foreground/80">{legend}</span>
    </a>
  );
}

function Visual({ visual }: { visual: AskVisual }) {
  if (visual.kind === "diagram") return <Diagram code={visual.code} />;
  if (visual.kind === "images") return <ImageStrip images={visual.images} />;
  return <FigureCard legend={visual.legend} href={visual.href} />;
}

/** "Helpful?" thumbs under a saved answer. */
function Feedback({
  value,
  onRate,
}: {
  value: -1 | 1 | null;
  onRate: (rating: -1 | 0 | 1) => void;
}) {
  const btn = (rating: -1 | 1, Icon: typeof ThumbsUp, label: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={value === rating}
      onClick={() => onRate(value === rating ? 0 : rating)}
      className={cn(
        "rounded p-1 transition-colors hover:bg-muted hover:text-foreground",
        value === rating ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
  return (
    <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
      <span>{value ? "Thanks for the feedback" : "Helpful?"}</span>
      {btn(1, ThumbsUp, "Helpful")}
      {btn(-1, ThumbsDown, "Not helpful")}
    </div>
  );
}

/**
 * Recent questions saved to the user's account, shown when the card has no
 * answer on screen. Clicking one reopens its answer without asking again.
 * "Clear history" asks for a second click instead of a modal on top of the card.
 */
function RecentQuestions({
  entries,
  onPick,
  onClear,
}: {
  entries: HistoryEntry[];
  onPick: (e: HistoryEntry) => void;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Recent questions</p>
        {confirming ? (
          <span className="flex gap-2 text-xs">
            <span className="text-muted-foreground">Clear all?</span>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onClear();
              }}
              className="font-medium text-destructive hover:underline"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-muted-foreground hover:underline"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear history
          </button>
        )}
      </div>
      <ul className="max-h-48 space-y-0.5 overflow-y-auto">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e)}
              className="w-full truncate rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
              title={e.question}
            >
              {e.question}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground">Saved to your account.</p>
    </div>
  );
}

/**
 * Bottom-right "Ask a question" pill with Dr. Albright peeking over it. The pill is the card's
 * footer: opening grows the card up and out from the corner (no overlay, no
 * blur — the page stays usable), closing shrinks it back to the pill.
 */
export function AskAlbrightLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [hovered, setHovered] = useState(false);
  const [justAnswered, setJustAnswered] = useState(false);
  /** The question the answer on screen belongs to. */
  const [answeredQuestion, setAnsweredQuestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // History is fetched once, as soon as the user reaches for the pill (hover,
  // focus) — and opening waits for it, so the card grows once to its final
  // size instead of opening and then jumping when "Recent questions" lands.
  const historyLoad = useRef<Promise<void> | null>(null);
  const loadHistory = useCallback(() => {
    historyLoad.current ??= fetch("/api/user/ask-albright/history?limit=20")
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d: { entries?: HistoryEntry[] }) => setHistory(d.entries ?? []))
      .catch(() => setHistory([]));
    return historyLoad.current;
  }, []);

  if (pathname && HIDDEN.some((re) => re.test(pathname))) return null;

  async function clearAll() {
    const res = await fetch("/api/user/ask-albright/history", { method: "DELETE" });
    if (res.ok) setHistory([]);
  }

  // A question already answered isn't sent again: the one on screen can't be
  // re-submitted, and one from history is reopened from history. (The server
  // also answers repeats from history, as a backstop.)
  const isShowing = (q: string) =>
    !!result && !!answeredQuestion && normalizeQuestion(q) === normalizeQuestion(answeredQuestion);

  async function ask(text: string = question) {
    const q = text.trim();
    if (q.length < 2 || loading || isShowing(q)) return;
    const saved = history?.find((e) => normalizeQuestion(e.question) === normalizeQuestion(q));
    if (saved) {
      setQuestion(saved.question);
      setAnsweredQuestion(saved.question);
      setResult({
        ...saved.result,
        repeated: true,
        historyId: saved.id,
        feedback: saved.feedback ?? null,
      });
      setError(null);
      return;
    }
    setQuestion(q);
    setLoading(true);
    setJustAnswered(false);
    setError(null);
    setResult(null);
    const finish = (data: AskResponse) => {
      setResult({ ...data, streaming: false, feedback: data.feedback ?? null });
      setAnsweredQuestion(q);
      setJustAnswered(!data.repeated);
      if (data.historyId) {
        setHistory((h) => [
          {
            id: data.historyId!,
            question: q,
            result: data,
            createdAt: new Date().toISOString(),
            feedback: null,
          },
          ...(h ?? []).filter((e) => e.question !== q),
        ]);
      }
    };
    try {
      const res = await fetch("/api/user/ask-albright", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ question: q }),
      });
      // Errors, limits and repeats come back as plain JSON; fresh answers stream.
      if (!(res.headers.get("content-type") ?? "").includes("ndjson")) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Something went wrong. Try again.");
          return;
        }
        finish({ ...(data as AskResponse), historyId: data.historyId ?? null });
        return;
      }
      let raw = "";
      for await (const ev of ndjson(res)) {
        if (ev.type === "meta") {
          raw = "";
          setLoading(false);
          setResult({
            answer: "",
            sourceLabel: ev.sourceLabel as string,
            cached: false,
            citations: ev.citations as AskResponse["citations"],
            tables: ev.tables as AskTable[],
            streaming: true,
            visual: ev.visual as AskVisual | undefined,
          });
        } else if (ev.type === "delta" || ev.type === "reset") {
          raw = ev.type === "reset" ? "" : raw + (ev.text as string);
          const shown = streamingText(raw);
          const drawing = /```/.test(raw);
          setResult((r) => (r ? { ...r, answer: shown, drawing } : r));
        } else if (ev.type === "done") {
          finish(ev as unknown as AskResponse);
        } else if (ev.type === "error") {
          setResult(null);
          setError((ev.error as string) ?? "Something went wrong. Try again.");
        }
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function rate(rating: -1 | 0 | 1) {
    const id = result?.historyId;
    if (!id) return;
    const value = rating === 0 ? null : rating;
    setResult((r) => (r ? { ...r, feedback: value } : r));
    setHistory((h) => (h ?? []).map((e) => (e.id === id ? { ...e, feedback: value } : e)));
    await fetch("/api/user/ask-albright/history", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, rating }),
    }).catch(() => {});
  }

  async function newQuestion() {
    if (!open) {
      // Don't grow until history is here (but never hang on a slow network).
      await Promise.race([loadHistory(), new Promise((r) => setTimeout(r, 800))]);
    }
    setOpen(true);
    setJustAnswered(false);
    setAnsweredQuestion(null);
    setQuestion("");
    setResult(null);
    setError(null);
    inputRef.current?.focus();
  }

  // Tables need room: widen the card for them, up to ~600px.
  const hasTable =
    !!result &&
    ((result.tables?.length ?? 0) > 0 ||
      parseAnswerBlocks(result.answer, { streaming: result.streaming }).some(
        (b) => b.kind === "table"
      ));

  const barButton =
    "flex h-full w-full items-center justify-center text-foreground/80 transition-colors hover:text-primary focus-visible:outline-none focus-visible:text-primary";

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end"
      onMouseEnter={() => {
        setHovered(true);
        void loadHistory();
      }}
      onFocus={() => void loadHistory()}
      onMouseLeave={() => setHovered(false)}
      style={{
        marginBottom: "env(safe-area-inset-bottom)",
        marginRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Seated on the card's top edge (AlbrightAvatar, inline seated figure);
          the last few px tuck behind the card so the cut reads as him sitting
          on it. */}
      <button
        type="button"
        onClick={() => (open ? close() : void newQuestion())}
        aria-label={open ? "Close Ask Dr. Albright" : "Ask Dr. Albright"}
        className={cn(
          "relative z-0 -mb-[10px] transition-[margin,transform] duration-300 ease-out focus-visible:outline-none",
          open ? "mr-8" : "mr-[44px]" // (160 pill - 72 avatar) / 2: centred
        )}
      >
        <AlbrightAvatar
          mood={loading ? "thinking" : justAnswered ? "done" : "idle"}
          hovered={hovered}
        />
      </button>

      <div
        role="dialog"
        aria-label="Ask Dr. Albright"
        className={cn(
          "relative z-10 overflow-hidden rounded-[28px] border bg-background shadow-xl transition-[width] duration-300 ease-out",
          // From md up the dashboard sidebar is a fixed 16rem rail (when
          // expanded) on the left: never let the card grow under it.
          !open
            ? "w-[160px]"
            : hasTable
              ? "w-[min(600px,calc(100vw-2rem))] md:w-[min(600px,calc(100vw-18rem))]"
              : "w-[min(400px,calc(100vw-2rem))] md:w-[min(400px,calc(100vw-18rem))]"
        )}
      >
        {/* Body: grid-rows 0fr→1fr animates height without measuring it. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
          aria-hidden={!open}
          inert={!open}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex max-h-[min(70vh,640px)] flex-col gap-3 overflow-y-auto px-4 pb-2 pt-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Ask Dr. Albright</p>
                  <p className="text-xs text-muted-foreground">
                    Cited answers from PathOutlines, PubMed, WHO &amp; Pathology Bites
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask();
                }}
                className="relative"
              >
                <textarea
                  ref={inputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_CHARS))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void ask();
                    }
                  }}
                  placeholder="Which stains separate chromophobe RCC from oncocytoma?"
                  rows={2}
                  maxLength={MAX_QUESTION_CHARS}
                  aria-label="Your question"
                  className="w-full resize-none rounded-2xl border bg-muted/40 py-2.5 pl-3 pr-11 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="submit"
                  disabled={loading || question.trim().length < 5 || isShowing(question)}
                  aria-label="Ask"
                  className="absolute bottom-3 right-2 rounded-full bg-primary p-1.5 text-primary-foreground transition-opacity disabled:opacity-40"
                >
                  {loading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <SendHorizontal className="h-4 w-4" />
                  )}
                </button>
              </form>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {!result && !loading && !error && history && (
                <RecentQuestions
                  entries={history}
                  onPick={(e) => {
                    setQuestion(e.question);
                    setAnsweredQuestion(e.question);
                    setResult({ ...e.result, historyId: e.id, feedback: e.feedback ?? null });
                  }}
                  onClear={() => void clearAll()}
                />
              )}

              {result && (
                <div className="space-y-2.5">
                  {result.repeated && (
                    <p className="text-xs text-muted-foreground">
                      You asked this before — here&apos;s the saved answer.
                    </p>
                  )}
                  <AnswerText
                    text={result.answer}
                    citations={result.citations}
                    streaming={result.streaming}
                  />
                  {result.streaming && result.drawing && !result.visual && (
                    <div className="flex h-24 items-center justify-center rounded-lg border bg-muted/40 text-xs text-muted-foreground animate-pulse">
                      Drawing diagram…
                    </div>
                  )}
                  {result.visual && <Visual visual={result.visual} />}
                  {result.tables?.map((t) => {
                    const src = result.citations.find((c) => c.n === t.n);
                    return (
                      <GridTable
                        key={`${t.n}-${t.headers.join()}`}
                        caption={
                          <>
                            Full IHC panel from{" "}
                            <a
                              href={src?.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              source {t.n} ({src?.sourceLabel ?? "source"}
                              {src ? ` · ${src.title}` : ""})
                            </a>{" "}
                            — rebuilt from the page text; check against the original
                          </>
                        }
                        header={["", ...t.headers]}
                        rows={t.rows.map((r) => [r.name, ...r.cells])}
                        focus={t.focusRows}
                        citations={result.citations}
                      />
                    );
                  })}
                  {(result.followUps?.length ?? 0) > 0 && (
                    <div
                      className="flex flex-wrap gap-1.5"
                      aria-label="Suggested follow-up questions"
                    >
                      {result.followUps!.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => void ask(f)}
                          className="rounded-full border bg-background px-2.5 py-1 text-left text-xs text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                  {result.citations.length > 0 && (
                    <>
                      <p className="pt-1 text-[11px] font-medium text-muted-foreground">Sources</p>
                      <ol className="-mt-1.5 space-y-1">
                        {result.citations.map((c) => (
                          <li key={c.n} className="text-xs">
                            <a
                              href={c.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-start gap-1 text-muted-foreground hover:text-primary hover:underline"
                            >
                              <span className="font-medium tabular-nums">{c.n}.</span>
                              <span className="line-clamp-1">
                                {c.sourceLabel && (
                                  <span className="text-foreground/70">{c.sourceLabel} · </span>
                                )}
                                {c.title}
                              </span>
                              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                            </a>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                  {!result.streaming && result.historyId && !result.scope && (
                    <Feedback value={result.feedback ?? null} onRate={(r) => void rate(r)} />
                  )}
                  <p className="mt-3 border-t pt-2.5 text-center text-[11px] text-muted-foreground">
                    Dr. Albright can make mistakes. Check the sources; not for diagnostic use.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* The pill: always visible, becomes the card's footer when open. */}
        <div className={cn("flex h-14 items-center", open && "border-t")}>
          <button
            type="button"
            onClick={() => void newQuestion()}
            className={cn(barButton, "text-sm font-medium")}
          >
            {open && (result || error) ? "New question" : "Ask a question"}
          </button>
        </div>
      </div>
    </div>
  );
}
