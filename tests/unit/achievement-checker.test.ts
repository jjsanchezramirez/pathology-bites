// dev/test/achievement-checker.test.ts
import { describe, it, expect } from "vitest";
import {
  checkAchievements,
  checkSequentialAchievements,
  checkSpeedAchievements,
  ACHIEVEMENT_DEFINITIONS,
  type UserStats,
} from "@/features/user/achievements/services/achievement-checker";

// Helper to create base stats
const createBaseStats = (): UserStats => ({
  totalQuizzes: 0,
  perfectScores: 0,
  currentStreak: 0,
  longestStreak: 0,
  accuracyOver3: 0,
  accuracyOver5: 0,
  accuracyOver8: 0,
  accuracyOver10: 0,
  accuracyOver12: 0,
  accuracyOver15: 0,
  subjectsWith10Questions: 0,
  subjectsWith25Questions: 0,
  subjectsWith50Questions: 0,
  subjectsWith100Questions: 0,
  totalCategories: 0,
});

describe("Achievement Checker - Individual Achievements", () => {
  describe("Quiz Achievements (Diagnostic Experience)", () => {
    it("quiz-1: should unlock after completing 1 quiz", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 1, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-1")).toBe(true);
    });

    it("quiz-1: should NOT unlock with 0 quizzes", () => {
      const stats = createBaseStats();
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-1")).toBe(false);
    });

    it("quiz-5: should unlock after completing 5 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 5, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-5")).toBe(true);
    });

    it("quiz-5: should NOT unlock with 4 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 4, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-5")).toBe(false);
    });

    it("quiz-10: should unlock after completing 10 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 10, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-10")).toBe(true);
    });

    it("quiz-20: should unlock after completing 20 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 20, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-20")).toBe(true);
    });

    it("quiz-30: should unlock after completing 30 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 30, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-30")).toBe(true);
    });

    it("quiz-50: should unlock after completing 50 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 50, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-50")).toBe(true);
    });

    it("quiz-80: should unlock after completing 80 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 80, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-80")).toBe(true);
    });

    it("quiz-100: should unlock after completing 100 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 100, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-100")).toBe(true);
    });
  });

  describe("Perfect Score Achievements (Perfectionist)", () => {
    it("perfect-1: should unlock after 1 perfect score", () => {
      const stats = { ...createBaseStats(), perfectScores: 1, totalQuizzes: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "perfect-1")).toBe(true);
    });

    it("perfect-1: should NOT unlock with 0 perfect scores", () => {
      const stats = { ...createBaseStats(), perfectScores: 0, totalQuizzes: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "perfect-1")).toBe(false);
    });

    it("perfect-5: should unlock after 5 perfect scores", () => {
      const stats = { ...createBaseStats(), perfectScores: 5, totalQuizzes: 5 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "perfect-5")).toBe(true);
    });

    it("perfect-10: should unlock after 10 perfect scores", () => {
      const stats = { ...createBaseStats(), perfectScores: 10, totalQuizzes: 10 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "perfect-10")).toBe(true);
    });

    it("perfect-25: should unlock after 25 perfect scores", () => {
      const stats = { ...createBaseStats(), perfectScores: 25, totalQuizzes: 25 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "perfect-25")).toBe(true);
    });
  });

  describe("Streak Achievements (Daily Sign-Out)", () => {
    it("streak-1: should unlock after 1-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-1")).toBe(true);
    });

    it("streak-3: should unlock after 3-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 3 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-3")).toBe(true);
    });

    it("streak-5: should unlock after 5-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 5 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-5")).toBe(true);
    });

    it("streak-7: should unlock after 7-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 7 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-7")).toBe(true);
    });

    it("streak-10: should unlock after 10-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 10 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-10")).toBe(true);
    });

    it("streak-14: should unlock after 14-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 14 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-14")).toBe(true);
    });

    it("streak-30: should unlock after 30-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 30 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-30")).toBe(true);
    });

    it("streak-45: should unlock after 45-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 45 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-45")).toBe(true);
    });

    it("streak-60: should unlock after 60-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 60 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-60")).toBe(true);
    });

    it("streak-75: should unlock after 75-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 75 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-75")).toBe(true);
    });

    it("streak-90: should unlock after 90-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 90 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-90")).toBe(true);
    });

    it("streak-100: should unlock after 100-day streak", () => {
      const stats = { ...createBaseStats(), longestStreak: 100 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "streak-100")).toBe(true);
    });
  });

  describe("Speed Achievements (Pattern Recognition)", () => {
    it("speed-10in6: should unlock with 10Q in 360s at 100%", () => {
      const speedAchievements = checkSpeedAchievements(10, 360, 100, new Set());
      expect(speedAchievements).toContain("speed-10in6");
    });

    it("speed-10in6: should NOT unlock with 10Q in 361s", () => {
      const speedAchievements = checkSpeedAchievements(10, 361, 100, new Set());
      expect(speedAchievements).not.toContain("speed-10in6");
    });

    it("speed-10in6: should NOT unlock with 9Q in 360s", () => {
      const speedAchievements = checkSpeedAchievements(9, 360, 100, new Set());
      expect(speedAchievements).not.toContain("speed-10in6");
    });

    it("speed-10in6: should NOT unlock with 10Q in 360s at 99%", () => {
      const speedAchievements = checkSpeedAchievements(10, 360, 99, new Set());
      expect(speedAchievements.length).toBe(0);
    });

    it("speed-10in3: should unlock with 10Q in 180s at 100%", () => {
      const speedAchievements = checkSpeedAchievements(10, 180, 100, new Set());
      expect(speedAchievements).toContain("speed-10in3");
    });

    it("speed-25in12: should unlock with 25Q in 720s at 100%", () => {
      const speedAchievements = checkSpeedAchievements(25, 720, 100, new Set());
      expect(speedAchievements).toContain("speed-25in12");
    });

    it("speed-25in8: should unlock with 25Q in 480s at 100%", () => {
      const speedAchievements = checkSpeedAchievements(25, 480, 100, new Set());
      expect(speedAchievements).toContain("speed-25in8");
    });

    it("speed-25in4: should unlock with 25Q in 240s at 100%", () => {
      const speedAchievements = checkSpeedAchievements(25, 240, 100, new Set());
      expect(speedAchievements).toContain("speed-25in4");
    });

    it("speed-50in14: should unlock with 50Q in 840s at 100%", () => {
      const speedAchievements = checkSpeedAchievements(50, 840, 100, new Set());
      expect(speedAchievements).toContain("speed-50in14");
    });

    it("speed-50in11: should unlock with 50Q in 660s at 100%", () => {
      const speedAchievements = checkSpeedAchievements(50, 660, 100, new Set());
      expect(speedAchievements).toContain("speed-50in11");
    });

    it("speed-50in8: should unlock with 50Q in 480s at 100%", () => {
      const speedAchievements = checkSpeedAchievements(50, 480, 100, new Set());
      expect(speedAchievements).toContain("speed-50in8");
    });
  });

  describe("Accuracy Achievements (Diagnostic Accuracy)", () => {
    it("accuracy-50-3: should unlock with 50% over 3 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 3, accuracyOver3: 50 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "accuracy-50-3")).toBe(true);
    });

    it("accuracy-50-3: should NOT unlock with only 2 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 2, accuracyOver3: 60 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "accuracy-50-3")).toBe(false);
    });

    it("accuracy-50-3: should NOT unlock with 49% accuracy", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 3, accuracyOver3: 49 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "accuracy-50-3")).toBe(false);
    });

    it("accuracy-60-5: should unlock with 60% over 5 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 5, accuracyOver5: 60 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "accuracy-60-5")).toBe(true);
    });

    it("accuracy-60-5: should NOT unlock with only 4 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 4, accuracyOver5: 70 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "accuracy-60-5")).toBe(false);
    });

    it("accuracy-70-8: should unlock with 70% over 8 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 8, accuracyOver8: 70 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "accuracy-70-8")).toBe(true);
    });

    it("accuracy-80-10: should unlock with 80% over 10 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 10, accuracyOver10: 80 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "accuracy-80-10")).toBe(true);
    });

    it("accuracy-90-12: should unlock with 90% over 12 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 12, accuracyOver12: 90 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "accuracy-90-12")).toBe(true);
    });

    it("accuracy-100-15: should unlock with 100% over 15 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 15, accuracyOver15: 100 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "accuracy-100-15")).toBe(true);
    });

    it("accuracy-100-15: should NOT unlock with 99% over 15 quizzes", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 15, accuracyOver15: 99 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "accuracy-100-15")).toBe(false);
    });
  });

  describe("Differential Achievements (Subject Variety)", () => {
    it("differential-10-3: should unlock with 3 subjects having 10+ questions", () => {
      const stats = { ...createBaseStats(), subjectsWith10Questions: 3 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "differential-10-3")).toBe(true);
    });

    it("differential-10-3: should NOT unlock with 2 subjects", () => {
      const stats = { ...createBaseStats(), subjectsWith10Questions: 2 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "differential-10-3")).toBe(false);
    });

    it("differential-25-10: should unlock with 10 subjects having 25+ questions", () => {
      const stats = { ...createBaseStats(), subjectsWith25Questions: 10 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "differential-25-10")).toBe(true);
    });

    it("differential-50-20: should unlock with 20 subjects having 50+ questions", () => {
      const stats = { ...createBaseStats(), subjectsWith50Questions: 20 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "differential-50-20")).toBe(true);
    });

    it("differential-100-all: should unlock when all subjects have 100+ questions", () => {
      const stats = {
        ...createBaseStats(),
        subjectsWith100Questions: 50,
        totalCategories: 50,
      };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "differential-100-all")).toBe(true);
    });

    it("differential-100-all: should NOT unlock if not all subjects covered", () => {
      const stats = {
        ...createBaseStats(),
        subjectsWith100Questions: 49,
        totalCategories: 50,
      };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "differential-100-all")).toBe(false);
    });
  });

  describe("Sequential Unlocking Logic", () => {
    it("should enforce sequential unlocking for quiz achievements", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 100, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      const alreadyUnlocked = new Set(["quiz-1", "quiz-5", "streak-1"]);
      const sequential = checkSequentialAchievements(qualified, alreadyUnlocked);

      // Should only unlock quiz-10 (next in sequence)
      const quizAchievements = sequential.filter((a) => a.category === "quiz");
      expect(quizAchievements.length).toBe(1);
      expect(quizAchievements[0].id).toBe("quiz-10");
    });

    it("should allow unlocking multiple categories simultaneously", () => {
      const stats = {
        ...createBaseStats(),
        totalQuizzes: 10,
        perfectScores: 5,
        longestStreak: 7,
      };
      const qualified = checkAchievements(stats);
      const alreadyUnlocked = new Set([
        "quiz-1",
        "quiz-5",
        "perfect-1",
        "streak-1",
        "streak-3",
        "streak-5",
      ]);
      const sequential = checkSequentialAchievements(qualified, alreadyUnlocked);

      const categories = new Set(sequential.map((a) => a.category));
      expect(categories.size).toBeGreaterThanOrEqual(2);
    });

    it("should not re-unlock already unlocked achievements", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 10, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      const alreadyUnlocked = new Set(["quiz-1", "quiz-5", "quiz-10", "streak-1"]);
      const sequential = checkSequentialAchievements(qualified, alreadyUnlocked);

      expect(sequential.some((a) => a.id === "quiz-1")).toBe(false);
      expect(sequential.some((a) => a.id === "quiz-5")).toBe(false);
      expect(sequential.some((a) => a.id === "quiz-10")).toBe(false);
    });
  });

  describe("Achievement Definitions Integrity", () => {
    it("should have exactly 42 achievement definitions", () => {
      expect(ACHIEVEMENT_DEFINITIONS.length).toBe(42);
    });

    it("should have all unique achievement IDs", () => {
      const ids = ACHIEVEMENT_DEFINITIONS.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ACHIEVEMENT_DEFINITIONS.length);
    });

    it("should have proper categories for all achievements", () => {
      const validCategories = ["quiz", "perfect", "streak", "speed", "accuracy", "differential"];
      const allValid = ACHIEVEMENT_DEFINITIONS.every((a) => validCategories.includes(a.category));
      expect(allValid).toBe(true);
    });

    it("should have positive requirements for all achievements", () => {
      const allPositive = ACHIEVEMENT_DEFINITIONS.every((a) => a.requirement > 0);
      expect(allPositive).toBe(true);
    });

    it("should have valid animation types", () => {
      const validAnimations = [
        "badge",
        "medal",
        "star_badge",
        "star_medal",
        "crown",
        "trophy_large",
      ];
      const allValid = ACHIEVEMENT_DEFINITIONS.every((a) =>
        validAnimations.includes(a.animationType)
      );
      expect(allValid).toBe(true);
    });
  });

  describe("Edge Cases and Boundary Tests", () => {
    it("should handle exactly at threshold values", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 5, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-5")).toBe(true);
    });

    it("should not unlock just below threshold", () => {
      const stats = { ...createBaseStats(), totalQuizzes: 4, longestStreak: 1 };
      const qualified = checkAchievements(stats);
      expect(qualified.some((a) => a.id === "quiz-5")).toBe(false);
    });

    it("should handle zero stats gracefully", () => {
      const stats = createBaseStats();
      const qualified = checkAchievements(stats);
      expect(qualified.length).toBe(0);
    });

    it("should handle extremely high stats", () => {
      const stats = {
        totalQuizzes: 10000,
        perfectScores: 1000,
        currentStreak: 500,
        longestStreak: 500,
        accuracyOver3: 100,
        accuracyOver5: 100,
        accuracyOver8: 100,
        accuracyOver10: 100,
        accuracyOver12: 100,
        accuracyOver15: 100,
        subjectsWith10Questions: 100,
        subjectsWith25Questions: 100,
        subjectsWith50Questions: 100,
        subjectsWith100Questions: 100,
        totalCategories: 100,
      };
      const qualified = checkAchievements(stats);
      // Should qualify for all non-speed achievements
      expect(qualified.length).toBeGreaterThan(30);
    });
  });
});
