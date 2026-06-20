// src/app/(dashboard)/dashboard/quiz/[id]/results/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { QuizResultsSummary } from "@/features/user/quiz/components/quiz-results-summary";
import { QuizResultsSkeleton } from "@/features/user/quiz/components/quiz-results-skeleton";
import { QuizResult } from "@/features/user/quiz/types/quiz";
import { toast } from "@/shared/utils/ui/toast";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLottieAnimation } from "@/shared/hooks/use-lottie-animation";
import { AlertCircle } from "lucide-react";
import { log } from "@/shared/utils/logging";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// 30 days — quiz results are immutable and small, so we keep them around for review.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Read cached results from the shared quiz-result key. This key is populated by
 * `database-sync-manager.ts` on completion sync; we read from the same place to
 * avoid the SWR cache layer that used to double-store the same data.
 */
function readCachedResults(sessionId: string): QuizResult | null {
  try {
    const raw = localStorage.getItem(`pathology-bites-quiz-result-${sessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const sessionData = parsed?.data;
    if (sessionData?.results) {
      return sessionData.results as QuizResult;
    }
    return null;
  } catch (err) {
    log.warn("[Results Page] Failed to read cached results:", err);
    return null;
  }
}

/**
 * Write fetched results back into the shared quiz-result key in the wrapped-cache
 * format that database-sync-manager.ts uses. Preserves any existing session fields.
 */
function writeCachedResults(sessionId: string, results: QuizResult): void {
  try {
    const key = `pathology-bites-quiz-result-${sessionId}`;
    const existingRaw = localStorage.getItem(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;
    const existingData = existing?.data && typeof existing.data === "object" ? existing.data : {};
    const wrapped = {
      data: { ...existingData, status: "completed", results },
      timestamp: Date.now(),
      ttl: CACHE_TTL_MS,
      key,
    };
    localStorage.setItem(key, JSON.stringify(wrapped));
  } catch (err) {
    log.warn("[Results Page] Failed to write results cache:", err);
  }
}

export default function QuizResultsPage() {
  const params = useParams();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { animationData: errorAnimation, isLoading: errorAnimationLoading } =
    useLottieAnimation("error");

  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchResults = async () => {
      // 1) Fast path: read from the shared quiz-result cache. Populated by completion sync.
      const cached = readCachedResults(sessionId);
      if (cached) {
        log.debug("[Results Page] ✅ Loaded results from local cache");
        if (!cancelled) {
          setResult(cached);
          setLoading(false);
        }
        return;
      }

      // 2) Slow path: fetch from API. Retry handles the race where the user navigates
      // to /results before the completion sync has finished writing the cache.
      const maxRetries = 3;
      const retryDelays = [500, 1000, 2000];

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (cancelled) return;

        let response: Response;
        try {
          response = await fetch(`/api/user/quiz/sessions/${sessionId}/results`);
        } catch (err) {
          // Network error — retry
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
            continue;
          }
          const msg = err instanceof Error ? err.message : "Network error";
          if (!cancelled) {
            setError(msg);
            setLoading(false);
            toast.error(msg);
          }
          return;
        }

        if (response.ok) {
          const json = await response.json().catch(() => null);
          if (json?.success && json?.data) {
            writeCachedResults(sessionId, json.data);
            if (!cancelled) {
              setResult(json.data);
              setLoading(false);
            }
            return;
          }
        }

        // Quiz not completed yet — redirect to the quiz page
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error?.includes("not completed yet")) {
            if (!cancelled) {
              setError("INCOMPLETE_QUIZ");
              setLoading(false);
            }
            return;
          }
        }

        // Retryable failure
        if (attempt < maxRetries) {
          log.debug(
            `[Results Page] Quiz not ready, retrying in ${retryDelays[attempt]}ms... (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
        } else {
          const errorText = await response.text().catch(() => "");
          const msg = `Failed to fetch results after ${maxRetries} retries${errorText ? `: ${errorText}` : ""}`;
          if (!cancelled) {
            setError(msg);
            setLoading(false);
            toast.error(msg);
          }
          return;
        }
      }
    };

    fetchResults();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <QuizResultsSkeleton />
      </div>
    );
  }

  // Error state — keep within dashboard layout
  if (error || !result) {
    // Check if quiz is incomplete
    const isIncomplete = error?.includes("INCOMPLETE_QUIZ");

    if (isIncomplete) {
      // Redirect to quiz page to complete it
      if (typeof window !== "undefined") {
        window.location.href = `/dashboard/quiz/${sessionId}`;
      }
      return (
        <div className="container mx-auto py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold">Redirecting to Quiz...</h1>
              <p className="text-muted-foreground mt-2">
                This quiz hasn&apos;t been completed yet. Taking you back to finish it.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <div
            className="w-full min-h-[400px] flex items-center justify-center relative overflow-hidden rounded-lg border bg-card"
            role="alert"
            aria-live="assertive"
          >
            {/* Subtle gradient background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.05),transparent_50%)]" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center text-center space-y-4 px-6 py-8">
              {/* Lottie animation */}
              <div className="w-32 h-32 flex items-center justify-center">
                {errorAnimationLoading || !errorAnimation ? (
                  <div className="w-full h-full bg-muted/20 rounded-full animate-pulse" />
                ) : (
                  <Lottie
                    animationData={errorAnimation}
                    loop={false}
                    autoplay={true}
                    style={{ width: "100%", height: "100%" }}
                  />
                )}
              </div>

              {/* Error message */}
              <div className="space-y-2 max-w-md">
                <h1 className="text-2xl font-bold text-destructive flex items-center justify-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  Quiz Results Not Available
                </h1>
                <p className="text-sm text-muted-foreground">
                  {error ||
                    "The quiz results you're looking for don't exist or couldn't be loaded."}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex justify-center gap-2 mt-4">
                <Button onClick={() => window.location.reload()}>Try Again</Button>
                <Link href="/dashboard">
                  <Button variant="outline">Back to Dashboard</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results display
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <QuizResultsSummary
          result={result}
          onReviewQuestions={() => {
            window.location.href = `/dashboard/quiz/${sessionId}?review=true`;
          }}
        />
      </div>
    </div>
  );
}
