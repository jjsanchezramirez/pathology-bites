"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import Image from "next/image";
import { Check, X, RotateCcw, ArrowRight, BookOpen, Play } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useImageCacheHandler } from "@/shared/hooks/use-smart-image-cache";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { Leaderboard } from "@/shared/components/leaderboard/leaderboard";
import { useClientCellQuiz } from "@/shared/hooks/use-client-cell-quiz";
import { cn } from "@/shared/utils";
import {
  QUESTIONS_PER_ROUND,
  pointsForAnswer,
  type RoundAnswer,
} from "@/features/public/tools/cell-quiz/scoring";
import { CellReferenceNote } from "@/features/public/tools/cell-quiz/components/cell-reference-note";
import { RoundResults } from "@/features/public/tools/cell-quiz/components/round-results";
import { type Question, findReferenceCellInfo, generateRandomQuestion } from "./cell-quiz-helpers";
import { CellTutorial } from "./cell-tutorial";

type Mode = "menu" | "quiz" | "tutorial" | "results";

const HERO_TITLE = "Cell Identification Quiz";
const HERO_DESC =
  "Identify blood and marrow cells, learn the features that tell them apart, and compete on the leaderboard.";
const JOIN_DESC =
  "Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone.";

function Shell({ children, hideJoin }: { children: ReactNode; hideJoin?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHero title={HERO_TITLE} description={HERO_DESC} />
      <section className="relative flex-1 py-6 md:py-10">
        <div className="container mx-auto max-w-5xl px-3 md:px-4">{children}</div>
      </section>
      <div className={hideJoin ? "hidden md:block" : ""}>
        <JoinCommunitySection description={JOIN_DESC} />
      </div>
    </div>
  );
}

export default function CellQuizPage() {
  const { cellData, bloodCellsReference, isLoading, error } = useClientCellQuiz();

  const [mode, setMode] = useState<Mode>("menu");
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<RoundAnswer[]>([]);
  const [boardKey, setBoardKey] = useState(0);
  const shownAt = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleImageLoad = useImageCacheHandler(question?.imagePath || "", true);

  const answered = selected !== null;
  const questionNumber = answers.length + (answered ? 0 : 1);
  const score = answers.reduce((sum, a) => sum + pointsForAnswer(a), 0);
  const correctCount = answers.filter((a) => a.correct).length;

  const newQuestion = useCallback(() => {
    if (!cellData || !bloodCellsReference) return;
    setQuestion(generateRandomQuestion(cellData, bloodCellsReference));
    setSelected(null);
    shownAt.current = performance.now();
  }, [cellData, bloodCellsReference]);

  const startRound = useCallback(() => {
    setAnswers([]);
    setMode("quiz");
    newQuestion();
  }, [newQuestion]);

  const selectAnswer = useCallback(
    (option: string) => {
      if (!question || selected) return;
      const ms = Math.max(400, Math.round(performance.now() - shownAt.current));
      setSelected(option);
      setAnswers((prev) => [...prev, { correct: option === question.correctAnswer, ms }]);
    },
    [question, selected]
  );

  const advance = useCallback(() => {
    if (answers.length >= QUESTIONS_PER_ROUND) {
      setMode("results");
      return;
    }
    newQuestion();
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [answers.length, newQuestion]);

  // Keyboard: 1–4 answer, Enter/Space/→ continue (desktop only).
  useEffect(() => {
    if (mode !== "quiz" || !question) return;
    const onKey = (e: KeyboardEvent) => {
      if (window.innerWidth < 768) return;
      if (e.code.startsWith("Digit")) {
        const i = parseInt(e.code.slice(5), 10) - 1;
        if (i >= 0 && i < question.options.length && !selected) {
          e.preventDefault();
          selectAnswer(question.options[i]);
        }
      } else if (["Enter", "Space", "ArrowRight"].includes(e.code) && selected) {
        e.preventDefault();
        advance();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, question, selected, selectAnswer, advance]);

  const toMenu = () => {
    setMode("menu");
    setQuestion(null);
    setSelected(null);
    setAnswers([]);
  };

  if (isLoading) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <p className="text-center text-sm text-muted-foreground">Loading cell images…</p>
        </div>
      </Shell>
    );
  }

  if (error || !cellData || !bloodCellsReference) {
    return (
      <Shell>
        <Card className="mx-auto max-w-md text-center">
          <CardContent className="space-y-4 p-8">
            <X className="mx-auto h-8 w-8 text-red-500" />
            <div>
              <h3 className="font-semibold">Couldn&apos;t load the quiz</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {error || "The cell image data is unavailable right now."}
              </p>
            </div>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (mode === "tutorial") {
    return (
      <CellTutorial onBack={toMenu} bloodCellsReference={bloodCellsReference} cellData={cellData} />
    );
  }

  const leaderboardCard = (
    <Card>
      <CardContent className="p-4 md:p-6">
        <Leaderboard
          activity="cell-quiz"
          refreshKey={boardKey}
          renderDetail={(r) =>
            `${r.meta.correct ?? "?"}/10 · ${Math.round((r.duration_ms ?? 0) / 1000)}s`
          }
        />
      </CardContent>
    </Card>
  );

  if (mode === "menu") {
    return (
      <Shell>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="flex h-full flex-col justify-center space-y-6 p-6 md:p-8">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Name that cell</h1>
                <p className="text-sm text-muted-foreground">
                  {QUESTIONS_PER_ROUND} images per round. Four look-alike choices each. Correct
                  answers earn 100 points, plus up to 50 for answering fast.
                </p>
              </div>
              <div className="space-y-3">
                <Button onClick={startRound} size="lg" className="w-full">
                  <Play className="mr-2 h-4 w-4" />
                  Start a round
                </Button>
                <Button
                  onClick={() => setMode("tutorial")}
                  size="lg"
                  variant="outline"
                  className="w-full"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Study the cells first
                </Button>
              </div>
            </CardContent>
          </Card>
          {leaderboardCard}
        </div>
      </Shell>
    );
  }

  if (mode === "results") {
    return (
      <Shell>
        <div className="grid items-start gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="p-6 md:p-8">
              <RoundResults
                answers={answers}
                onPlayAgain={startRound}
                onMenu={toMenu}
                onSubmitted={() => setBoardKey((k) => k + 1)}
              />
            </CardContent>
          </Card>
          {leaderboardCard}
        </div>
      </Shell>
    );
  }

  if (!question) return null;

  const refInfo = findReferenceCellInfo(question.cellType, bloodCellsReference);
  const isLast = answers.length >= QUESTIONS_PER_ROUND;

  return (
    <Shell hideJoin>
      <Card ref={cardRef} className="mx-auto max-w-4xl">
        <CardContent className="space-y-4 p-3 md:space-y-6 md:p-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground md:text-sm">
              <span className="font-medium text-foreground">
                Cell {Math.min(questionNumber, QUESTIONS_PER_ROUND)} of {QUESTIONS_PER_ROUND}
              </span>
              <span className="tabular-nums">
                {correctCount} correct · {score} pts
              </span>
              <Button
                onClick={toMenu}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground"
                aria-label="Quit round"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Progress value={(answers.length / QUESTIONS_PER_ROUND) * 100} className="h-1.5" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-8">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted md:aspect-square">
              <Image
                src={question.imagePath}
                alt="Cell to identify"
                fill
                className="object-contain p-1"
                unoptimized
                onLoad={() => {
                  shownAt.current = performance.now();
                  handleImageLoad();
                }}
              />
            </div>

            <div className="flex flex-col gap-2 md:gap-3">
              <h2 className="hidden text-lg font-semibold md:block">What cell is this?</h2>
              {question.options.map((option, i) => {
                const isRight = option === question.correctAnswer;
                const isPicked = selected === option;
                return (
                  <button
                    key={option}
                    onClick={() => selectAnswer(option)}
                    disabled={answered}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors md:px-4 md:py-3 md:text-base",
                      !answered && "hover:border-primary/50 hover:bg-primary/5",
                      answered &&
                        isRight &&
                        "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
                      answered &&
                        isPicked &&
                        !isRight &&
                        "border-red-400 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200",
                      answered && !isRight && !isPicked && "opacity-50"
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                      {answered && isRight ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : answered && isPicked ? (
                        <X className="h-3.5 w-3.5 text-red-600" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          {answered && (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3 md:p-4">
              <p className="text-sm font-semibold">{question.correctAnswer}</p>
              <CellReferenceNote info={refInfo} fallback={question.explanation} />
              <Button onClick={advance} size="lg" className="w-full md:w-auto">
                {isLast ? "See results" : "Next cell"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          <p className="hidden text-center text-xs text-muted-foreground md:block">
            Press <kbd className="rounded border px-1.5 py-0.5">1</kbd>–
            <kbd className="rounded border px-1.5 py-0.5">4</kbd> to answer,{" "}
            <kbd className="rounded border px-1.5 py-0.5">Enter</kbd> to continue
          </p>
        </CardContent>
      </Card>
    </Shell>
  );
}
