"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ExternalLink, LoaderCircle, SendHorizontal, X } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { R2_IMAGES_PUBLIC_URL } from "@/shared/config/r2-public-urls";
import { cn } from "@/shared/utils";
import { MAX_QUESTION_CHARS } from "../lib/router";

interface AskResponse {
  answer: string;
  sourceLabel: string;
  cached: boolean;
  citations: Array<{ n: number; title: string; href: string }>;
  tables?: AskTable[];
}

interface AskTable {
  n: number;
  headers: string[];
  rows: Array<{ name: string; cells: string[] }>;
  focusRows: string[];
}

const AVATAR = `${R2_IMAGES_PUBLIC_URL}/assets/dr-albright.png`;

// An active quiz must not get an answer button, and Anki owns its full screen.
const HIDDEN = [/^\/dashboard\/quiz\/(?!new$)[^/]+$/, /^\/dashboard\/anki$/];

const CELL_TONE: Record<string, string> = {
  "+++": "font-semibold text-emerald-700",
  "++": "text-emerald-700",
  "+": "text-emerald-700",
  "-": "text-muted-foreground",
};

/**
 * A rebuilt symbol table (see lib/tables.ts). Rows the question names are
 * highlighted; the rest stay for context. Scrolls sideways in the narrow card.
 */
function PanelTable({ table, href }: { table: AskTable; href?: string }) {
  const focus = new Set(table.focusRows);
  return (
    <figure className="space-y-1">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-[11px]">
          <thead className="bg-muted/60">
            <tr>
              <th className="sticky left-0 bg-muted px-2 py-1 text-left font-medium" />
              {table.headers.map((h) => (
                <th key={h} className="px-1.5 py-1 text-center font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.name} className={cn("border-t", focus.has(r.name) && "bg-primary/5")}>
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 whitespace-nowrap bg-background px-2 py-1 text-left font-normal",
                    focus.has(r.name) && "bg-muted font-semibold"
                  )}
                >
                  {r.name}
                </th>
                {r.cells.map((c, i) => (
                  <td
                    key={i}
                    className={cn("px-1.5 py-1 text-center", CELL_TONE[c] ?? "text-amber-700")}
                  >
                    {c === "-" ? "–" : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="text-[10px] text-muted-foreground">
        Rebuilt from{" "}
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
            source [{table.n}]
          </a>
        ) : (
          `source [${table.n}]`
        )}
        ; check against the original.
      </figcaption>
    </figure>
  );
}

/** `[1]`-style markers become superscript links to the matching citation. */
function WithCitations({ text, citations }: { text: string; citations: AskResponse["citations"] }) {
  return (
    <>
      {text.split(/(\[\d\])/g).map((part, i) => {
        const m = part.match(/^\[(\d)\]$/);
        const cite = m && citations.find((c) => c.n === Number(m[1]));
        if (!cite) return <span key={i}>{part}</span>;
        return (
          <a
            key={i}
            href={cite.href}
            target="_blank"
            rel="noopener noreferrer"
            className="align-super text-[10px] font-medium text-primary hover:underline"
          >
            [{cite.n}]
          </a>
        );
      })}
    </>
  );
}

/**
 * The model sometimes answers in "- " bullets despite the prompt; render those
 * as a list (they may also arrive run together on one line).
 */
function AnswerText({ text, citations }: { text: string; citations: AskResponse["citations"] }) {
  const lines = text
    .split(/\n+|\s+(?=- [A-Z])/)
    .map((l) => l.trim())
    .filter(Boolean);
  const intro = lines.filter((l) => !l.startsWith("- "));
  const bullets = lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {intro.map((l, i) => (
        <p key={i}>
          <WithCitations text={l} citations={citations} />
        </p>
      ))}
      {bullets.length > 0 && (
        <ul className="list-disc space-y-1 pl-4">
          {bullets.map((l, i) => (
            <li key={i}>
              <WithCitations text={l} citations={citations} />
            </li>
          ))}
        </ul>
      )}
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

  if (pathname && HIDDEN.some((re) => re.test(pathname))) return null;

  async function ask() {
    const q = question.trim();
    if (q.length < 5 || loading) return;
    setLoading(true);
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
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function newQuestion() {
    setOpen(true);
    setQuestion("");
    setResult(null);
    setError(null);
    inputRef.current?.focus();
  }

  const barButton =
    "flex h-full w-full items-center justify-center text-foreground/80 transition-colors hover:text-primary focus-visible:outline-none focus-visible:text-primary";

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end"
      style={{
        marginBottom: "env(safe-area-inset-bottom)",
        marginRight: "env(safe-area-inset-right)",
      }}
    >
      {/* Peeks over the card's top edge: the source is 408x1280, so he keeps
          that ratio; the smoke trail below the pipe (lower ~35%) fades out and
          slides behind the card. */}
      <button
        type="button"
        onClick={() => (open ? close() : newQuestion())}
        aria-label={open ? "Close Ask Dr. Albright" : "Ask Dr. Albright"}
        className={cn(
          "relative z-0 -mb-[46px] transition-[margin,transform] duration-300 ease-out hover:-translate-y-1 focus-visible:outline-none",
          open ? "mr-8" : "mr-[51px]" // (160 pill - 58 avatar) / 2: centred
        )}
      >
        <Image
          src={AVATAR}
          alt=""
          width={58}
          height={182}
          className="h-[182px] w-[58px]"
          style={{
            maskImage: "linear-gradient(to bottom, #000 60%, transparent 80%)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 60%, transparent 80%)",
          }}
        />
      </button>

      <div
        role="dialog"
        aria-label="Ask Dr. Albright"
        className={cn(
          "relative z-10 overflow-hidden rounded-[28px] border bg-background shadow-xl transition-[width] duration-300 ease-out",
          open ? "w-[min(380px,calc(100vw-2rem))]" : "w-[160px]"
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
            <div className="flex max-h-[min(60vh,520px)] flex-col gap-3 overflow-y-auto px-4 pb-2 pt-6">
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
                  disabled={loading || question.trim().length < 5}
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

              {result && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-700">
                      {result.sourceLabel}
                    </Badge>
                    {result.cached && <span className="text-xs text-muted-foreground">cached</span>}
                  </div>
                  <AnswerText text={result.answer} citations={result.citations} />
                  {result.tables?.map((t) => (
                    <PanelTable
                      key={`${t.n}-${t.headers.join()}`}
                      table={t}
                      href={result.citations.find((c) => c.n === t.n)?.href}
                    />
                  ))}
                  <ol className="space-y-1">
                    {result.citations.map((c) => (
                      <li key={c.n} className="text-xs">
                        <a
                          href={c.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-start gap-1 text-muted-foreground hover:text-primary hover:underline"
                        >
                          <span className="font-medium">[{c.n}]</span>
                          <span className="line-clamp-1">{c.title}</span>
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ol>
                  <p className="text-[11px] text-muted-foreground">
                    AI-generated from the sources above. Educational use only — not for diagnosis.
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
            onClick={newQuestion}
            className={cn(barButton, "text-sm font-medium")}
          >
            {open && (result || error) ? "New question" : "Ask a question"}
          </button>
        </div>
      </div>
    </div>
  );
}
