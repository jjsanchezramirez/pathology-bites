import { describe, it, expect, vi } from "vitest";
import {
  orderOptionsForSession,
  isPinnedOption,
  sortByAuthoredOrder,
} from "@/features/user/quiz/utils/answer-order";

vi.mock("@/shared/services/service-role-client", () => ({
  createServiceRoleClient: vi.fn(),
}));

import { QuizService } from "@/features/user/quiz/services/quiz-service";

const opts = (n: number, correctAt = 1) =>
  Array.from({ length: n }, (_, i) => ({
    id: `opt-${i}`,
    text: `Option ${i}`,
    is_correct: i === correctAt,
    explanation: null,
    order_index: i,
  }));

describe("orderOptionsForSession", () => {
  it("returns authored order when shuffle is off, even if the input is scrambled", () => {
    const scrambled = [...opts(5)].reverse();
    const out = orderOptionsForSession(scrambled, "s1", "q1", false);
    expect(out.map((o) => o.id)).toEqual(["opt-0", "opt-1", "opt-2", "opt-3", "opt-4"]);
  });

  it("gives the same order for the same session and question every time", () => {
    const a = orderOptionsForSession(opts(5), "session-abc", "question-1", true);
    const b = orderOptionsForSession([...opts(5)].reverse(), "session-abc", "question-1", true);
    expect(b.map((o) => o.id)).toEqual(a.map((o) => o.id));
  });

  it("keeps every option exactly once and does not mutate the input", () => {
    const input = opts(5);
    const snapshot = input.map((o) => o.id);
    const out = orderOptionsForSession(input, "s", "q", true);
    expect(input.map((o) => o.id)).toEqual(snapshot);
    expect([...out.map((o) => o.id)].sort()).toEqual([...snapshot].sort());
  });

  it("varies across sessions and spreads the correct answer over all positions", () => {
    const counts = [0, 0, 0, 0, 0];
    const orders = new Set<string>();
    for (let s = 0; s < 2000; s++) {
      const out = orderOptionsForSession(opts(5, 1), `session-${s}`, "q-fixed", true);
      counts[out.findIndex((o) => o.is_correct)]++;
      orders.add(out.map((o) => o.id).join(","));
    }
    expect(orders.size).toBeGreaterThan(60);
    // Uniform would be 400 each; allow generous slack.
    for (const c of counts) {
      expect(c).toBeGreaterThan(300);
      expect(c).toBeLessThan(500);
    }
  });

  it("keeps 'All of the above' style options last, in authored order", () => {
    const input = [
      ...opts(3),
      { id: "both", text: "Both A and B", is_correct: false, explanation: null, order_index: 3 },
      {
        id: "none",
        text: "None of the above",
        is_correct: false,
        explanation: null,
        order_index: 4,
      },
    ];
    for (let s = 0; s < 50; s++) {
      const out = orderOptionsForSession(input, `s${s}`, "q", true);
      expect(out.slice(3).map((o) => o.id)).toEqual(["both", "none"]);
    }
  });

  it("leaves single-option and empty lists alone", () => {
    expect(orderOptionsForSession([], "s", "q", true)).toEqual([]);
    expect(orderOptionsForSession(opts(1), "s", "q", true).map((o) => o.id)).toEqual(["opt-0"]);
  });
});

describe("isPinnedOption", () => {
  it("recognises dependent options but not ordinary text that mentions letters", () => {
    expect(isPinnedOption("All of the above")).toBe(true);
    expect(isPinnedOption("none of the following")).toBe(true);
    expect(isPinnedOption("Both A and C")).toBe(true);
    expect(isPinnedOption("A and C")).toBe(true);
    expect(isPinnedOption("(B) or (D) only")).toBe(true);
    expect(
      isPinnedOption(
        "The presence of A or B antigens impairs the fibrinolytic system, leading to decreased clot breakdown."
      )
    ).toBe(false);
    expect(isPinnedOption("Vitamin A deficiency")).toBe(false);
    expect(isPinnedOption(null)).toBe(false);
  });
});

describe("sortByAuthoredOrder", () => {
  it("breaks order_index ties by id", () => {
    const out = sortByAuthoredOrder([
      { id: "b", order_index: 0 },
      { id: "a", order_index: 0 },
    ]);
    expect(out.map((o) => o.id)).toEqual(["a", "b"]);
  });
});

// Review/resume mapping: getQuizSession is the single loader for the active
// quiz, resume and review. Same session → same order; selected answers and
// correctness are carried by option id, so highlighting is position-free.
describe("QuizService.getQuizSession answer order", () => {
  function makeClient(shuffleAnswers: boolean | undefined) {
    const sessionRow = {
      id: "11111111-2222-3333-4444-555555555555",
      user_id: "u1",
      title: "T",
      config: shuffleAnswers === undefined ? { mode: "tutor" } : { mode: "tutor", shuffleAnswers },
      question_ids: ["q1", "q2"],
      current_question_index: 0,
      status: "completed",
      total_questions: 2,
    };
    const questions = ["q1", "q2"].map((id) => ({
      id,
      title: id,
      stem: id,
      // PostgREST hands options back in arbitrary order.
      question_options: [...opts(5, 1)].reverse().map((o) => ({ ...o, id: `${id}-${o.id}` })),
      question_images: [],
    }));
    const attempts = [
      {
        question_id: "q1",
        selected_answer_id: "q1-opt-1",
        is_correct: true,
        time_spent: 5,
        attempted_at: "2026-11-20T00:00:00Z",
      },
    ];
    const builder = (table: string) => {
      const result =
        table === "quiz_sessions"
          ? { data: sessionRow, error: null }
          : table === "questions"
            ? { data: questions, error: null }
            : { data: attempts, error: null };
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in"]) chain[m] = () => chain;
      chain.single = () => Promise.resolve(result);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(res, rej);
      return chain;
    };
    return { from: vi.fn(builder) } as never;
  }

  it("returns identical option order on repeated loads when shuffling", async () => {
    const svc = new QuizService();
    const first = await svc.getQuizSession("s", makeClient(true));
    const second = await svc.getQuizSession("s", makeClient(true));
    const ids = (s: typeof first) =>
      s!.questions.map((q) => q.question_options.map((o: { id: string }) => o.id));
    expect(ids(second)).toEqual(ids(first));

    // The recorded answer still points at the correct option by id, wherever it sits.
    const q1 = first!.questions[0];
    const selected = first!.answers!.find((a) => a.questionId === "q1")!.selectedOptionId;
    const chosen = q1.question_options.find((o: { id: string }) => o.id === selected);
    expect(chosen?.is_correct).toBe(true);
  });

  it("uses authored order when shuffle is off or missing (older sessions)", async () => {
    const svc = new QuizService();
    for (const flag of [false, undefined]) {
      const s = await svc.getQuizSession("s", makeClient(flag));
      expect(s!.questions[0].question_options.map((o: { id: string }) => o.id)).toEqual([
        "q1-opt-0",
        "q1-opt-1",
        "q1-opt-2",
        "q1-opt-3",
        "q1-opt-4",
      ]);
    }
  });
});
