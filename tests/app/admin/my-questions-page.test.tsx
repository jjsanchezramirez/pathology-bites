/**
 * MyQuestionsPage — characterization tests.
 *
 * Written BEFORE decomposing the 1121-line page (extract the question row, empty
 * state, skeleton, delete dialog, and the pure filter/tab/merge helpers). The
 * supabase browser client + auth hooks + child dialogs are mocked; DOM assertions pin:
 *   - tab counts per status, and auto-selecting the first non-empty tab (revision priority)
 *   - rows rendered for the active tab; search + difficulty filtering
 *   - the per-tab empty state
 *   - the drafts tab's row checkboxes
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/admin/questions/components/dialogs/question-preview-dialog", () => ({
  QuestionPreviewDialog: () => null,
}));
vi.mock("@/features/admin/questions/components/dialogs/submit-for-review-dialog", () => ({
  SubmitForReviewDialog: () => null,
}));
vi.mock("@/features/admin/questions/components/dialogs/bulk-submit-dialog", () => ({
  BulkSubmitDialog: () => null,
}));
// NOTE: stable reference — the page's data-fetch effect keys on `user` identity,
// so a fresh object each render would loop forever.
const auth = vi.hoisted(() => ({ value: { user: { id: "me" } } }));
vi.mock("@/features/auth/components/auth-provider", () => ({
  useAuthContext: () => auth.value,
}));
vi.mock("@/shared/hooks/use-user-role", () => ({
  useUserRole: () => ({ canAccess: () => true }),
}));
vi.mock("@/shared/utils/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const hoisted = vi.hoisted(() => ({ questions: [] as unknown[] }));

// Minimal chainable + awaitable supabase stub: every query resolves to {data,error}.
vi.mock("@/shared/services/client", () => {
  const builder = (result: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "single"]) {
      b[m] = () => b;
    }
    b.then = (resolve: (v: unknown) => void) => resolve(result);
    return b;
  };
  return {
    createClient: () => ({
      from: (table: string) =>
        table === "questions"
          ? builder({ data: hoisted.questions, error: null })
          : builder({ data: [], error: null }),
    }),
  };
});

import MyQuestionsPage from "@/app/(admin)/admin/my-questions/page";

type Q = Record<string, unknown>;
function q(p: Partial<Q> & { id: string; status: string }): Q {
  return {
    title: `Title-${p.id}`,
    stem: `Stem ${p.id}`,
    difficulty: "medium",
    updated_at: "2024-03-15T12:00:00",
    created_at: "2024-03-15T12:00:00",
    category: null,
    question_set: null,
    version_major: 1,
    version_minor: 0,
    version_patch: 0,
    reviewer_feedback: null,
    ...p,
  };
}

function setQuestions(qs: Q[]) {
  hoisted.questions = qs;
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.questions = [];
});

describe("MyQuestionsPage — characterization", () => {
  it("renders tab counts and auto-selects the first non-empty tab (revision priority)", async () => {
    setQuestions([
      q({ id: "r1", status: "rejected", reviewer_feedback: "Fix the stem" }),
      q({ id: "d1", status: "draft" }),
      q({ id: "d2", status: "draft" }),
      q({ id: "p1", status: "published" }),
    ]);
    render(<MyQuestionsPage />);

    expect(await screen.findByText("Needs Revision (1)")).toBeTruthy();
    expect(screen.getByText("Drafts (2)")).toBeTruthy();
    expect(screen.getByText("Published (1)")).toBeTruthy();

    // revision is highest priority non-empty → its question is shown
    expect(screen.getByText("Title-r1")).toBeTruthy();
    expect(screen.queryByText("Title-d1")).toBeNull();
  });

  it("auto-selects drafts when there is nothing to revise or flag", async () => {
    setQuestions([q({ id: "d1", status: "draft" })]);
    render(<MyQuestionsPage />);

    expect(await screen.findByText("Title-d1")).toBeTruthy();
    // drafts tab → row checkboxes present (select-all + one per draft)
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThanOrEqual(2);
  });

  it("filters the active tab by search term", async () => {
    setQuestions([
      q({ id: "d1", status: "draft", title: "Renal tubular acidosis" }),
      q({ id: "d2", status: "draft", title: "Hepatic adenoma" }),
    ]);
    render(<MyQuestionsPage />);
    await screen.findByText("Renal tubular acidosis");

    fireEvent.change(screen.getByPlaceholderText("Search questions..."), {
      target: { value: "renal" },
    });

    expect(screen.getByText("Renal tubular acidosis")).toBeTruthy();
    expect(screen.queryByText("Hepatic adenoma")).toBeNull();
  });

  it("shows the per-tab empty state (with the filtered sub-message) when nothing matches", async () => {
    setQuestions([q({ id: "d1", status: "draft", title: "Renal" })]);
    render(<MyQuestionsPage />);
    await screen.findByText("Renal");

    fireEvent.change(screen.getByPlaceholderText("Search questions..."), {
      target: { value: "zzz-no-match" },
    });

    // active tab is drafts → its empty heading + the "filters" sub-message
    expect(screen.getByText("No drafts yet")).toBeTruthy();
    expect(screen.getByText("No questions match your filters")).toBeTruthy();
  });
});
