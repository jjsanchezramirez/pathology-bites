// src/shared/components/layout/layout-routes.ts

const QUIZ_ACTIVE_PATTERN = /^\/dashboard\/quiz\/[^/]+$/;
const QUIZ_REVIEW_PATTERN = /^\/dashboard\/quiz\/[^/]+\/review$/;

/**
 * Pages that own their full-height layout: the shell must not pad or scroll the
 * main area, because the page renders its own scrolling regions.
 *
 * Deliberately narrower than the "special mode" checks in use-quiz-mode.ts,
 * which only drive sidebar collapse:
 *   /dashboard/quiz/[id]         -> full height (active session)
 *   /dashboard/quiz/[id]/review  -> full height
 *   /dashboard/quiz/[id]/results -> standard scrollable layout
 *   /dashboard/quiz/new          -> standard scrollable layout
 */
export function isFullHeightPath(pathname: string | null): boolean {
  if (!pathname) return false;

  // Anki has its own full-height layout; lesson studio needs full width.
  if (pathname === "/dashboard/anki" || pathname === "/admin/lesson-studio") return true;
  if (pathname === "/dashboard/quiz/new") return false;

  return QUIZ_ACTIVE_PATTERN.test(pathname) || QUIZ_REVIEW_PATTERN.test(pathname);
}
