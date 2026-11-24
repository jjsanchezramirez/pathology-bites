"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ExternalLink, LoaderCircle, SendHorizontal, X } from "lucide-react";

import { cn } from "@/shared/utils";
import { parseAnswerBlocks } from "../lib/answer-blocks";
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
}: {
  caption: React.ReactNode;
  header: string[];
  rows: string[][];
  focus?: string[];
  citations: AskResponse["citations"];
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

/** `**bold**` and citation markers; everything else is plain text. */
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
            <span key={`${i}-${k}`}>{seg}</span>
          );
        });
      })}
    </>
  );
}

/** Paragraphs, bullet lists and Markdown tables, in the order the model wrote them. */
function AnswerText({ text, citations }: { text: string; citations: AskResponse["citations"] }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {parseAnswerBlocks(text).map((b, i) => {
        if (b.kind === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-4">
              {b.items.map((item, k) => (
                <li key={k}>
                  <Inline text={item} citations={citations} />
                </li>
              ))}
            </ul>
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
    if (q.length < 5 || loading || isShowing(q)) return;
    const saved = history?.find((e) => normalizeQuestion(e.question) === normalizeQuestion(q));
    if (saved) {
      setQuestion(saved.question);
      setAnsweredQuestion(saved.question);
      setResult({ ...saved.result, repeated: true });
      setError(null);
      return;
    }
    setQuestion(q);
    setLoading(true);
    setJustAnswered(false);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/user/ask-albright", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setResult(data as AskResponse);
      setAnsweredQuestion(q);
      setJustAnswered(!data.repeated);
      if (data.historyId) {
        setHistory((h) => [
          {
            id: data.historyId,
            question: q,
            result: data as AskResponse,
            createdAt: new Date().toISOString(),
          },
          ...(h ?? []).filter((e) => e.question !== q),
        ]);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
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
      parseAnswerBlocks(result.answer).some((b) => b.kind === "table"));

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
          !open
            ? "w-[160px]"
            : hasTable
              ? "w-[min(600px,calc(100vw-2rem))]"
              : "w-[min(400px,calc(100vw-2rem))]"
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
                    Short, cited answers from PathologyOutlines, PubMed or WHO.
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
                    setResult(e.result);
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
                  <AnswerText text={result.answer} citations={result.citations} />
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
