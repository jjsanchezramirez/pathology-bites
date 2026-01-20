// src/hooks/use-demo-questions.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/shared/utils/toast";

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

// Module-scope memory cache for in-session speed
// HTTP browser cache (via API response headers) handles persistence
interface CachedDemoQuestions {
  questions: Record<number, Question>;
  totalQuestions: number;
}

const memoryCache: CachedDemoQuestions = {
  questions: {},
  totalQuestions: 0,
};

export function useDemoQuestions() {
  const [questions, _setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasInitialized = useRef(false);

  const fetchNewQuestion = useCallback(async (index: number) => {
    // Check memory cache first (same session)
    if (memoryCache.questions[index]) {
      setCurrentQuestion(memoryCache.questions[index]);
      setCurrentIndex((index + 1) % memoryCache.totalQuestions);
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

          // Cache the question in memory for session
          const totalQuestions = _metadata?.totalQuestions || 3;
          memoryCache.questions[index] = questionData;
          memoryCache.totalQuestions = totalQuestions;

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
