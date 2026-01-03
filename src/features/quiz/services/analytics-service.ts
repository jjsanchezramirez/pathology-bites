// Quiz Analytics Service
// Handles batch analytics updates to reduce database load and improve reliability

import { createClient } from "@/shared/services/server";

export class QuizAnalyticsService {
  private supabase;

  constructor(authenticatedSupabase?: unknown) {
    this.supabase = authenticatedSupabase;
  }

  private async getSupabase() {
    if (this.supabase) {
      return this.supabase;
    }
    return await createClient();
  }

  /**
   * Update analytics for all questions in a completed quiz session
   * Uses a SECURITY DEFINER database function to bypass RLS policies
   */
  async updateQuizSessionAnalytics(sessionId: string): Promise<void> {
    try {
      console.log("[Analytics] Starting batch analytics update for session:", sessionId);

      // Get all questions from this quiz session
      const supabase = await this.getSupabase();
      const { data: attempts, error: attemptsError } = await supabase
        .from("quiz_attempts")
        .select("question_id")
        .eq("quiz_session_id", sessionId);

      if (attemptsError) {
        console.error("[Analytics] Error fetching quiz attempts:", attemptsError);
        throw attemptsError;
      }

      if (!attempts || attempts.length === 0) {
        console.log("[Analytics] No attempts found for session:", sessionId);
        return;
      }

      // Get unique question IDs
      const questionIds = [...new Set(attempts.map((a: unknown) => a.question_id))] as string[];
      console.log("[Analytics] Updating analytics for questions:", questionIds);

      // Call database function to update analytics (bypasses RLS with SECURITY DEFINER)
      const { error: updateError } = await supabase.rpc("update_question_analytics_batch", {
        question_ids: questionIds,
      });

      if (updateError) {
        console.error("[Analytics] Error calling analytics function:", updateError);
      } else {
        console.log("[Analytics] Batch analytics update completed for session:", sessionId);
      }
    } catch (error) {
      console.error("[Analytics] Error in batch analytics update:", error);
      // Don't throw - analytics failures shouldn't break quiz completion
    }
  }

  /**
   * Update analytics for multiple questions (used by admin tools)
   * Uses a SECURITY DEFINER database function to bypass RLS policies
   */
  async updateMultipleQuestionAnalytics(questionIds: string[]): Promise<void> {
    try {
      console.log("[Analytics] Updating analytics for multiple questions:", questionIds.length);

      const supabase = await this.getSupabase();

      // Call database function to update analytics (bypasses RLS with SECURITY DEFINER)
      const { error: updateError } = await supabase.rpc("update_question_analytics_batch", {
        question_ids: questionIds,
      });

      if (updateError) {
        console.error("[Analytics] Error calling analytics function:", updateError);
      } else {
        console.log("[Analytics] Batch update completed for", questionIds.length, "questions");
      }
    } catch (error) {
      console.error("[Analytics] Error in multiple question analytics update:", error);
    }
  }

  /**
   * Recalculate all question analytics (admin tool)
   */
  async recalculateAllAnalytics(): Promise<void> {
    try {
      console.log("[Analytics] Starting full analytics recalculation");

      const supabase = await this.getSupabase();

      // Get all questions that have attempts
      const { data: questions, error: questionsError } = await supabase
        .from("quiz_attempts")
        .select("question_id");

      if (questionsError) {
        console.error("[Analytics] Error fetching questions with attempts:", questionsError);
        throw questionsError;
      }

      if (!questions || questions.length === 0) {
        console.log("[Analytics] No questions with attempts found");
        return;
      }

      // Get unique question IDs
      const questionIds = [...new Set(questions.map((q: unknown) => q.question_id))] as string[];

      // Call database function to update all analytics at once
      await this.updateMultipleQuestionAnalytics(questionIds);

      console.log(
        "[Analytics] Full analytics recalculation completed for",
        questionIds.length,
        "questions"
      );
    } catch (error) {
      console.error("[Analytics] Error in full analytics recalculation:", error);
      throw error;
    }
  }

  /**
   * Get analytics summary for a quiz session
   */
  async getSessionAnalyticsSummary(sessionId: string): Promise<{
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
    averageTimePerQuestion: number;
  } | null> {
    try {
      const supabase = await this.getSupabase();
      const { data: attempts, error } = await supabase
        .from("quiz_attempts")
        .select("is_correct, time_spent")
        .eq("quiz_session_id", sessionId);

      if (error || !attempts) {
        console.error("[Analytics] Error fetching session summary:", error);
        return null;
      }

      const totalQuestions = attempts.length;
      const correctAnswers = attempts.filter((a: unknown) => a.is_correct).length;
      const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
      const totalTime = attempts.reduce((sum: number, a: unknown) => sum + (a.time_spent || 0), 0);
      const averageTimePerQuestion = totalQuestions > 0 ? totalTime / totalQuestions : 0;

      return {
        totalQuestions,
        correctAnswers,
        accuracy,
        averageTimePerQuestion,
      };
    } catch (error) {
      console.error("[Analytics] Error calculating session summary:", error);
      return null;
    }
  }
}

// Export singleton instance
export const quizAnalyticsService = new QuizAnalyticsService();
