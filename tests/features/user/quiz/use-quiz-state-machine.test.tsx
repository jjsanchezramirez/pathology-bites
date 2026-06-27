/**
 * useQuizStateMachine — synchronous dispatch mirror (reducer-ref staleness fix).
 *
 * Regression tests for the documented hazard (CLAUDE.md "useReducer dispatches not
 * visible to synchronous reads"): React batches `useReducer` dispatches, so reading
 * state right after a dispatch — before the next render commits — sees the old value.
 * The hook works around this by mirroring mutating dispatches into a ref synchronously
 * (`dispatchAndMirror`) and exposing it via `getCurrentState()`.
 *
 * These tests read `getCurrentState()` INSIDE the same act() tick as the dispatch —
 * i.e. before the re-render flushes — which is exactly the timing the timer-expiry
 * completion path relies on. If the mirror line is removed (plain `dispatch`), the
 * synchronous read returns stale state and these fail.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuizStateMachine } from "@/features/user/quiz/hybrid/hooks/use-quiz-state-machine";
import type { QuizQuestion } from "@/features/user/quiz/types/quiz-question";

const mockQuestions: QuizQuestion[] = [
  {
    id: "q1",
    stem: "Question 1",
    question_options: [
      { id: "opt1-1", text: "Option A", is_correct: true },
      { id: "opt1-2", text: "Option B", is_correct: false },
    ],
    explanation: "Explanation 1",
    category: "Test Category",
    difficulty: "medium",
    question_images: [],
  },
  {
    id: "q2",
    stem: "Question 2",
    question_options: [
      { id: "opt2-1", text: "Option A", is_correct: false },
      { id: "opt2-2", text: "Option B", is_correct: true },
    ],
    explanation: "Explanation 2",
    category: "Test Category",
    difficulty: "easy",
    question_images: [],
  },
];

function renderMachine() {
  return renderHook(() =>
    useQuizStateMachine({ sessionId: "test-session", enableLocalStorage: false })
  );
}

describe("useQuizStateMachine — synchronous dispatch mirror", () => {
  it("getCurrentState() reflects a just-submitted answer within the same tick (hazard 2)", () => {
    const { result } = renderMachine();
    act(() => {
      result.current.actions.initializeQuiz(mockQuestions);
      result.current.actions.startQuiz();
    });

    let synchronousState!: ReturnType<typeof result.current.actions.getCurrentState>;
    act(() => {
      const ok = result.current.actions.submitAnswer("q1", "opt1-1");
      expect(ok).toBe(true);
      // Read BEFORE act flushes the re-render — only the synchronous ref mirror makes
      // the answer visible here. Plain dispatch would still show the pre-submit state.
      synchronousState = result.current.actions.getCurrentState();
    });

    expect(synchronousState.answers.size).toBe(1);
    expect(synchronousState.answers.get("q1")?.isCorrect).toBe(true);
    expect(synchronousState.answers.get("q1")?.selectedOptionId).toBe("opt1-1");
  });

  it("a synchronous completion read sees the last-second answer, not an empty set (hazard 3: timer-expiry)", () => {
    const { result } = renderMachine();
    act(() => {
      result.current.actions.initializeQuiz(mockQuestions);
      result.current.actions.startQuiz();
      result.current.actions.submitAnswer("q1", "opt1-1");
    });

    // Simulate the timer-expiry completion path: a final pending answer is dispatched,
    // then completion reads state synchronously (runCompletion in use-hybrid-quiz).
    let stateAtCompletion!: ReturnType<typeof result.current.actions.getCurrentState>;
    act(() => {
      result.current.actions.submitAnswer("q2", "opt2-2"); // the "last second before expiry" answer
      stateAtCompletion = result.current.actions.getCurrentState(); // what /complete would ship
    });

    // Both answers must be present — the bug shipped an empty/short answer set.
    expect(stateAtCompletion.answers.size).toBe(2);
    expect(stateAtCompletion.answers.get("q2")?.isCorrect).toBe(true);
  });

  it("getCurrentState() stays consistent across multiple dispatches in one tick", () => {
    const { result } = renderMachine();
    act(() => {
      result.current.actions.initializeQuiz(mockQuestions);
      result.current.actions.startQuiz();
    });

    let afterFirst = 0;
    let afterSecond = 0;
    act(() => {
      result.current.actions.submitAnswer("q1", "opt1-2"); // incorrect
      afterFirst = result.current.actions.getCurrentState().answers.size;
      result.current.actions.submitAnswer("q2", "opt2-2"); // correct
      afterSecond = result.current.actions.getCurrentState().answers.size;
    });

    expect(afterFirst).toBe(1);
    expect(afterSecond).toBe(2);
  });
});
