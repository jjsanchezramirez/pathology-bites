// src/hooks/use-demo-questions.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/shared/utils/toast";
import { unifiedCache, CACHE_NAMESPACES } from "@/shared/services/unified-cache";

export interface Option {
  id: string;
  text: string;
  correct: boolean; // Note: Demo questions use 'correct' instead of 'is_correct' for simplicity
  explanation?: string;
}

export interface QuestionImage {
  url: string;
  caption?: string;
  alt: string;
}

export interface Question {
  id: string;
  title: string;
  body: string;
  images: QuestionImage[];
  options: Option[];
  teachingPoint: string;
  incorrectExplanations: Record<string, string>;
  references: string[];
  comparativeImage?: QuestionImage;
}

// Cache key for unified cache
const CACHE_KEY = "demo-questions-dataset";

interface CachedDemoQuestions {
  questions: Record<number, Question>;
  totalQuestions: number;
}

function getCachedQuestions(): CachedDemoQuestions | null {
  if (typeof window === "undefined") return null;

  return unifiedCache.get<CachedDemoQuestions>(
    CACHE_NAMESPACES.DEMO_QUESTIONS.name,
    CACHE_KEY
  );
}

function setCachedQuestion(index: number, question: Question, totalQuestions: number): void {
  if (typeof window === "undefined") return;

  try {
    const existing = getCachedQuestions();
    const cacheEntry: CachedDemoQuestions = {
      questions: existing?.questions || {},
      totalQuestions,
    };
    cacheEntry.questions[index] = question;

    unifiedCache.set(
      CACHE_NAMESPACES.DEMO_QUESTIONS.name,
      CACHE_KEY,
      cacheEntry
    );
  } catch {
    // Cache might be unavailable, ignore
  }
}

export function useDemoQuestions() {
  const [questions, _setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasInitialized = useRef(false);
  const cachedDataRef = useRef<CachedDemoQuestions | null>(null);

  // Load cached data on mount
  useEffect(() => {
    cachedDataRef.current = getCachedQuestions();
  }, []);

  const fetchNewQuestion = useCallback(async (index: number) => {
    // Check cache first
    const cached = cachedDataRef.current;
    if (cached && cached.questions[index]) {
      setCurrentQuestion(cached.questions[index]);
      setCurrentIndex((index + 1) % cached.totalQuestions);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/content/demo-questions?index=${index}`);

      if (response.ok) {
        const data = await response.json();

        if (data && data.id) {
          // Extract just the question data (without _metadata)
          const { _metadata, ...questionData } = data;

          setCurrentQuestion(questionData);

          // Cache the question
          const totalQuestions = _metadata?.totalQuestions || 3;
          setCachedQuestion(index, questionData, totalQuestions);

          // Update cached data ref
          if (!cachedDataRef.current) {
            cachedDataRef.current = { questions: {}, totalQuestions, timestamp: Date.now() };
          }
          cachedDataRef.current.questions[index] = questionData;
          cachedDataRef.current.totalQuestions = totalQuestions;

          // Update current index for next question
          if (_metadata?.nextIndex !== undefined) {
            setCurrentIndex(_metadata.nextIndex);
          }
          setLoading(false);
          return;
        }
      }

      throw new Error("Failed to load question");
    } catch (err) {
      const errorMessage = "Failed to load question";
      setError(errorMessage);
      setLoading(false);

      // Detect network errors (laptop sleep/wake, offline, etc.)
      const isNetworkError =
        err instanceof TypeError &&
        (err.message?.includes("fetch") || err.message?.includes("network"));

      if (isNetworkError) {
        toast.error("Network connection interrupted. Please refresh the page.");
      } else {
        toast.error(errorMessage);
      }
    }
  }, []);

  const refreshQuestion = () => {
    // Move to next question in sequence using current index
    fetchNewQuestion(currentIndex);
  };

  // Initial load only
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      fetchNewQuestion(0);
    }
  }, [fetchNewQuestion]);

  return {
    questions,
    currentQuestion,
    loading,
    error,
    refreshQuestion,
  };
}
