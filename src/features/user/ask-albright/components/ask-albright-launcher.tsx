"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ExternalLink, Loader2, Send } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { R2_IMAGES_PUBLIC_URL } from "@/shared/config/r2-public-urls";
import { MAX_QUESTION_CHARS } from "../lib/router";

interface AskResponse {
  answer: string;
  sourceLabel: string;
  cached: boolean;
  citations: Array<{ n: number; title: string; href: string }>;
}

const AVATAR = `${R2_IMAGES_PUBLIC_URL}/assets/dr-albright.png`;

// An active quiz must not get an answer button, and Anki owns its full screen.
const HIDDEN = [/^\/dashboard\/quiz\/(?!new$)[^/]+$/, /^\/dashboard\/anki$/];

/** Render `[1]`-style markers as superscript links to the matching citation. */
function AnswerText({ text, citations }: { text: string; citations: AskResponse["citations"] }) {
  const parts = text.split(/(\[\d\])/g);
  return (
    <p className="text-sm leading-relaxed">
      {parts.map((part, i) => {
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
    </p>
  );
}

export function AskAlbrightLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask Dr. Albright"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border bg-background shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{
          marginBottom: "env(safe-area-inset-bottom)",
          marginRight: "env(safe-area-inset-right)",
        }}
      >
        <Image
          src={AVATAR}
          alt=""
          width={56}
          height={56}
          className="h-full w-full object-contain p-1"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-background">
                <Image
                  src={AVATAR}
                  alt=""
                  width={44}
                  height={44}
                  className="h-full w-full object-contain p-0.5"
                />
              </span>
              <div>
                <DialogTitle>Ask Dr. Albright</DialogTitle>
                <DialogDescription>
                  Short answers from PathologyOutlines, PubMed or WHO, with sources.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
            className="space-y-2"
          >
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_CHARS))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask();
                }
              }}
              placeholder="e.g. Which stains separate chromophobe RCC from oncocytoma?"
              rows={3}
              maxLength={MAX_QUESTION_CHARS}
              aria-label="Your question"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {question.length}/{MAX_QUESTION_CHARS}
              </span>
              <Button type="submit" size="sm" disabled={loading || question.trim().length < 5}>
                {loading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                Ask
              </Button>
            </div>
          </form>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {result && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-700">
                  {result.sourceLabel}
                </Badge>
                {result.cached && <span className="text-xs text-muted-foreground">cached</span>}
              </div>
              <AnswerText text={result.answer} citations={result.citations} />
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
        </DialogContent>
      </Dialog>
    </>
  );
}
