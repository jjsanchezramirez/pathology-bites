/**
 * EditQuestionClient — characterization tests.
 *
 * Written BEFORE decomposing the 789-line orchestrator (extract the skeleton, the
 * published edit-type card, the reviewer dialog, and the pure banner/patch helpers).
 * The form hook + tab components + content loaders are mocked; DOM assertions pin:
 *   - the error state when the fetch fails
 *   - the draft context banner + which footer actions show for a draft
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const hooks = vi.hoisted(() => ({
  form: {
    handleSubmit: (fn: (d: unknown) => void) => (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      return fn({});
    },
    watch: () => "patch",
    getValues: () => "patch",
    setValue: vi.fn(),
    formState: { errors: {} },
    control: {},
    register: vi.fn(),
  },
}));

vi.mock("@/features/admin/questions/hooks/use-edit-question-form", () => ({
  useEditQuestionForm: () => ({
    form: hooks.form,
    isSubmitting: false,
    hasUnsavedChanges: true,
    selectedTagIds: [],
    answerOptions: [],
    questionImages: [],
    isPatchEdit: false,
    patchEditReason: "",
    setSelectedTagIds: vi.fn(),
    setAnswerOptions: vi.fn(),
    setQuestionImages: vi.fn(),
    setIsPatchEdit: vi.fn(),
    setPatchEditReason: vi.fn(),
    setReviewerId: vi.fn(),
    handleSubmit: vi.fn(),
    handleUnsavedChanges: vi.fn(),
  }),
}));
vi.mock("@/shared/components/ui/form", () => ({
  Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/admin/questions/components/edit/tab-navigation", () => ({
  TabNavigation: () => <div data-testid="tab-nav" />,
}));
vi.mock("@/features/admin/questions/components/edit/source-tab", () => ({
  SourceTab: () => <div data-testid="source-tab" />,
}));
vi.mock("@/features/admin/questions/components/edit/content-tab", () => ({
  ContentTab: () => null,
}));
vi.mock("@/features/admin/questions/components/edit/images-tab", () => ({
  ImagesTab: () => null,
}));
vi.mock("@/features/admin/questions/components/edit/metadata-tab", () => ({
  MetadataTab: () => null,
}));
vi.mock("@/features/admin/questions/components/edit/save-confirmation-dialog", () => ({
  SaveConfirmationDialog: () => null,
}));
vi.mock("@/features/admin/questions/components/create/content-selector", () => ({
  loadContentFromR2: vi.fn(),
}));
vi.mock("@/shared/config/content-index", () => ({ getContentFileInfo: vi.fn() }));
vi.mock("@/shared/utils/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { EditQuestionClient } from "@/app/(admin)/admin/questions/[id]/edit/edit-question-client";

function mockFetchQuestion(question: Record<string, unknown> | null, ok = true) {
  global.fetch = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 404,
    json: async () => (ok ? { question } : { error: "Question not found" }),
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditQuestionClient — characterization", () => {
  it("renders the error state when the question fetch fails", async () => {
    mockFetchQuestion(null, false);
    render(<EditQuestionClient questionId="q1" />);
    expect(await screen.findByText("Question not found")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Back/ })).toBeTruthy();
  });

  it("shows the draft context banner and the submit-for-review action for a draft", async () => {
    mockFetchQuestion({
      id: "q1",
      status: "draft",
      question_options: [],
      reviewer_id: null,
    });
    render(<EditQuestionClient questionId="q1" />);

    expect(await screen.findByText("Editing Draft")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save & Submit for Review/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save Changes/ })).toBeTruthy();
  });

  it("shows reviewer feedback for a flagged question", async () => {
    mockFetchQuestion({
      id: "q1",
      status: "flagged",
      reviewer_feedback: "Please fix the stem wording",
      question_options: [],
      reviewer_id: null,
    });
    render(<EditQuestionClient questionId="q1" />);

    expect(await screen.findByText("Editing Flagged Question")).toBeTruthy();
    expect(screen.getByText("Please fix the stem wording")).toBeTruthy();
  });
});
