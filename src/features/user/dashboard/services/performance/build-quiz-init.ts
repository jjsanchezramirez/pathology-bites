// Quiz-initialization data for the /dashboard/quiz/new page: session titles,
// per-subcategory question stats (from the get_user_category_stats RPC), and
// the aggregate all / AP-only / CP-only stat buckets.

import type {
  CategoryItem,
  QuizInitCategory,
  QuizQuestionStats,
  SessionTitleItem,
  UserStatItem,
} from "./types";

export interface QuizInitInput {
  /** Windowed sessions (titles only are consumed). */
  sessions: SessionTitleItem[];
  /** Full categories list (level 1 parents + level 2 subcategories). */
  allCategories: CategoryItem[] | null;
  /** Rows from the get_user_category_stats RPC (empty/null tolerated). */
  userCategoryStats: UserStatItem[] | null;
}

export interface QuizInitData {
  sessionTitles: string[];
  categories: QuizInitCategory[];
  questionTypeStats: {
    all: QuizQuestionStats;
    ap_only: QuizQuestionStats;
    cp_only: QuizQuestionStats;
  };
  /**
   * Canonical bucket counts summed across all subcategories — also feeds the
   * dashboard block. get_user_category_stats is the canonical source (used by
   * /dashboard/quiz/new): it restricts the pool to published questions and uses
   * the canonical definitions:
   *   Mastered     = last 2 consecutive attempts correct
   *   Needs Review = most recent attempt incorrect
   *   Unused       = never attempted
   */
  overallQuizStats: QuizQuestionStats;
}

// Helper function to extract short name
const extractShortName = (name: string): string => {
  const match = name.match(/\(([^)]+)\)/);
  return match
    ? match[1]
    : name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase();
};

const EMPTY_STATS: QuizQuestionStats = {
  all: 0,
  unused: 0,
  needsReview: 0,
  marked: 0,
  mastered: 0,
};

const sumStats = (categories: QuizInitCategory[]): QuizQuestionStats =>
  categories.reduce(
    (acc, cat) => ({
      all: acc.all + cat.questionStats.all,
      unused: acc.unused + cat.questionStats.unused,
      needsReview: acc.needsReview + cat.questionStats.needsReview,
      marked: acc.marked + cat.questionStats.marked,
      mastered: acc.mastered + cat.questionStats.mastered,
    }),
    { ...EMPTY_STATS }
  );

/** Level-2 category IDs, in list order — the p_category_ids argument for the stats RPC. */
export function getSubcategoryIds(allCategories: CategoryItem[] | null): string[] {
  return (allCategories || []).filter((cat) => cat.level === 2).map((cat) => cat.id);
}

export function buildQuizInit({
  sessions,
  allCategories,
  userCategoryStats,
}: QuizInitInput): QuizInitData {
  // Extract session titles (last 100 sessions)
  const sessionTitles = sessions.slice(0, 100).map((s) => s.title || "");

  const subcategories = (allCategories || []).filter((cat) => cat.level === 2);
  const parentCategories = (allCategories || []).filter((cat) => cat.level === 1);

  // Create parent lookup
  const parentLookup = new Map<string, string>();
  for (const parent of parentCategories) {
    parentLookup.set(parent.id, parent.name);
  }

  // Create stats lookup map with proper property names
  const allStatsMap = new Map<string, QuizQuestionStats>();
  for (const stat of userCategoryStats || []) {
    const categoryId =
      typeof stat.category_id === "string" ? stat.category_id : String(stat.category_id);
    allStatsMap.set(categoryId, {
      all: stat.all_count,
      unused: stat.unused_count,
      needsReview: stat.incorrect_count,
      marked: stat.marked_count,
      mastered: stat.correct_count,
    });
  }

  // Build categories with user stats for quiz init
  const categories = subcategories.map((category) => {
    const stats = allStatsMap.get(category.id) || { ...EMPTY_STATS };

    // Determine parent type
    const parentName = parentLookup.get(category.parent_id || "");
    const parent =
      parentName === "Anatomic Pathology"
        ? "AP"
        : parentName === "Clinical Pathology"
          ? "CP"
          : "AP";

    return {
      id: category.id,
      name: category.name,
      shortName: category.short_form || extractShortName(category.name),
      parent: parent as "AP" | "CP",
      questionStats: stats,
    };
  });

  // Calculate overall statistics for quiz init
  const overallQuizStats = sumStats(categories);
  const apQuizStats = sumStats(categories.filter((cat) => cat.parent === "AP"));
  const cpQuizStats = sumStats(categories.filter((cat) => cat.parent === "CP"));

  return {
    sessionTitles,
    categories,
    questionTypeStats: {
      all: overallQuizStats,
      ap_only: apQuizStats,
      cp_only: cpQuizStats,
    },
    overallQuizStats,
  };
}
