/**
 * Unit tests for the pure helpers extracted from setup-sheet.tsx.
 */
import { describe, it, expect } from "vitest";
import {
  fmtH,
  orderedSubjectIds,
  aggregateRebalanceProgress,
  surplusColor,
  surplusBarColor,
} from "@/features/user/study-plan/components/setup-sheet-utils";
import type { ScheduleTask, StudyResource } from "@/features/user/study-plan/lib/types";

describe("fmtH", () => {
  it("formats whole hours, minutes, and combos", () => {
    expect(fmtH(0)).toBe("0m");
    expect(fmtH(2)).toBe("2h");
    expect(fmtH(0.5)).toBe("30m");
    expect(fmtH(1.5)).toBe("1h 30m");
  });

  it("preserves a negative sign", () => {
    expect(fmtH(-1.5)).toBe("-1h 30m");
    expect(fmtH(-0.25)).toBe("-15m");
  });
});

describe("orderedSubjectIds", () => {
  it("keeps the saved order (filtered to known ids), then appends the rest", () => {
    expect(orderedSubjectIds(["c", "x", "a"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });

  it("returns the full canonical list when nothing is saved", () => {
    expect(orderedSubjectIds([], ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("aggregateRebalanceProgress", () => {
  const resources = [
    { id: "r1", name: "Robbins", subjects: [{ id: "s1", name: "Cardiac" }] },
  ] as unknown as StudyResource[];

  function task(p: Partial<ScheduleTask>): ScheduleTask {
    return {
      task_id: "t",
      task_type: "task",
      content_units: 0,
      resource_id: "r1",
      subject_id: "s1",
      ...p,
    } as ScheduleTask;
  }

  it("sums content_units of completed tasks per resource::subject", () => {
    const schedule = [
      task({ task_id: "a", content_units: 3 }),
      task({ task_id: "b", content_units: 2 }),
      task({ task_id: "c", content_units: 5 }), // not completed
    ];
    const completed = { a: "2024-01-01", b: "2024-01-02" };
    expect(aggregateRebalanceProgress(schedule, completed, resources)).toEqual({ "r1::s1": 5 });
  });

  it("ignores break/zero-unit tasks", () => {
    const schedule = [
      task({ task_id: "a", task_type: "break", content_units: 3 }),
      task({ task_id: "b", content_units: 0 }),
    ];
    expect(aggregateRebalanceProgress(schedule, { a: "x", b: "y" }, resources)).toEqual({});
  });

  it("recovers ids by name for pre-migration rows", () => {
    const schedule = [
      task({
        task_id: "a",
        content_units: 4,
        resource_id: undefined,
        subject_id: undefined,
        resource_name: "Robbins",
        subject: "Cardiac",
      }),
    ];
    expect(aggregateRebalanceProgress(schedule, { a: "x" }, resources)).toEqual({ "r1::s1": 4 });
  });
});

describe("surplus colors", () => {
  it("text color tiers on surplus ratio", () => {
    expect(surplusColor(0, 100)).toBe("text-emerald-500");
    expect(surplusColor(-10, 100)).toBe("text-amber-400");
    expect(surplusColor(-30, 100)).toBe("text-destructive");
    expect(surplusColor(5, 0)).toBe("text-muted-foreground");
  });

  it("bar color tiers on surplus ratio", () => {
    expect(surplusBarColor(0, 100)).toBe("bg-emerald-300");
    expect(surplusBarColor(-10, 100)).toBe("bg-amber-300");
    expect(surplusBarColor(-30, 100)).toBe("bg-destructive");
    expect(surplusBarColor(5, 0)).toBe("bg-muted");
  });
});
