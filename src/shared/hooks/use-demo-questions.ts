// src/hooks/use-demo-questions.ts
import { useState, useEffect, useCallback } from 'react';

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

export function useDemoQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  const fetchNewQuestion = useCallback(async (index: number) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/content/demo-questions?index=${index}`);

      if (response.ok) {
        const data = await response.json();

        if (data && data.id) {
          setCurrentQuestion(data);
          // Update current index for next question
          if (data._metadata?.nextIndex !== undefined) {
            setCurrentIndex(data._metadata.nextIndex);
          }
          setLoading(false);
          return;
        }
      }

      throw new Error('Failed to load question');
    } catch (err) {
      setError('Failed to load question');
      setLoading(false);
    }
  }, []);

  const refreshQuestion = () => {
    // Move to next question in sequence using current index
    fetchNewQuestion(currentIndex);
  };

  // Initial load only
  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
      fetchNewQuestion(0);
    }
  }, [fetchNewQuestion, hasInitialized]);
  
  return {
    questions,
    currentQuestion,
    loading,
    error,
    refreshQuestion
  };
}