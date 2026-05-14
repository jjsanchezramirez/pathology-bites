import { describe, expect, it } from "vitest";
import { __test__, generateSchedule, validateConfig } from "./scheduler";
import type { StudyConfig, StudyResource } from "./types";

const { computeDailyAllocations, allocateSubjectDays, buildCalendar, partitionSubjects } = __test__;

// =====================================================================
// computeDailyAllocations
// =====================================================================

describe("computeDailyAllocations", () => {
  const shapes = ["flat", "front", "middle", "end"] as const;

  it("sum equals totalUnits for every shape and reasonable input", () => {
    const cases: Array<{ units: number; days: number }> = [
      { units: 100, days: 10 },
      { units: 23, days: 7 },
      { units: 1, days: 10 },
      { units: 10, days: 1 },
      { units: 1700, days: 27 },
    ];
    for (const { units, days } of cases) {
      for (const shape of shapes) {
        const out = computeDailyAllocations(units, days, shape);
        expect(out, `${shape} ${units}/${days}`).toHaveLength(days);
        expect(
          out.reduce((a, b) => a + b, 0),
          `${shape} ${units}/${days}`
        ).toBe(units);
      }
    }
  });

  it("returns zeros for zero-unit inputs", () => {
    expect(computeDailyAllocations(0, 5, "flat")).toEqual([0, 0, 0, 0, 0]);
  });

  it("returns empty for zero-day inputs", () => {
    expect(computeDailyAllocations(5, 0, "flat")).toEqual([]);
  });

  it("flat distribution stays within 1 unit across days", () => {
    const out = computeDailyAllocations(100, 7, "flat");
    expect(Math.max(...out) - Math.min(...out)).toBeLessThanOrEqual(1);
  });

  it("end is non-decreasing on average (last >= first when days > 1)", () => {
    const out = computeDailyAllocations(100, 10, "end");
    expect(out[out.length - 1]).toBeGreaterThanOrEqual(out[0]);
  });

  it("front is non-increasing on average (first >= last when days > 1)", () => {
    const out = computeDailyAllocations(100, 10, "front");
    expect(out[0]).toBeGreaterThanOrEqual(out[out.length - 1]);
  });

  it("middle peaks somewhere in the middle, not the edges", () => {
    const out = computeDailyAllocations(100, 9, "middle");
    const mid = out[Math.floor(out.length / 2)];
    expect(mid).toBeGreaterThanOrEqual(out[0]);
    expect(mid).toBeGreaterThanOrEqual(out[out.length - 1]);
  });
});

// =====================================================================
// allocateSubjectDays
// =====================================================================

describe("allocateSubjectDays", () => {
  it("sum equals totalDays when N <= totalDays", () => {
    expect(allocateSubjectDays([100, 100, 100], 30).reduce((a, b) => a + b, 0)).toBe(30);
    expect(allocateSubjectDays([23, 23], 10).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("each non-zero unit gets at least 1 day when N <= totalDays", () => {
    const out = allocateSubjectDays([1000, 50, 50, 50], 10);
    expect(out.every((v) => v >= 1)).toBe(true);
  });

  it("zero-unit subjects get zero days", () => {
    const out = allocateSubjectDays([100, 0, 100], 10);
    expect(out[1]).toBe(0);
  });

  it("equal-size subjects are split within 1 day", () => {
    const out = allocateSubjectDays([100, 100, 100, 100], 10);
    expect(Math.max(...out) - Math.min(...out)).toBeLessThanOrEqual(1);
  });

  it("handles empty input", () => {
    expect(allocateSubjectDays([], 10)).toEqual([]);
  });

  it("returns zeros when totalDays is 0", () => {
    expect(allocateSubjectDays([100, 100], 0)).toEqual([0, 0]);
  });
});

// =====================================================================
// buildCalendar
// =====================================================================

function basicConfig(): StudyConfig {
  return {
    id: "default",
    exam_dates: [],
    days_off: {},
    recurring_off: [],
    phases: [
      {
        name: "P1",
        start_date: "2026-01-05",
        end_date: "2026-01-09",
        daily_minutes_weekday: 480,
        daily_minutes_weekend: 0,
        catchup_every: 0,
        subject_order: [],
        resources: [],
      },
    ],
  };
}

describe("buildCalendar", () => {
  it("emits one day per calendar day in the phase range", () => {
    const cal = buildCalendar(basicConfig());
    // 2026-01-05 (Mon) through 2026-01-09 (Fri) = 5 days
    expect(cal.map((d) => d.date)).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
    ]);
    expect(cal.every((d) => d.type === "study")).toBe(true);
  });

  it("marks exam days and the day before as rest", () => {
    const cfg = basicConfig();
    cfg.exam_dates = [{ name: "Mock", date: "2026-01-08" }];
    const cal = buildCalendar(cfg);
    const byDate = Object.fromEntries(cal.map((d) => [d.date, d.type]));
    expect(byDate["2026-01-07"]).toBe("rest");
    expect(byDate["2026-01-08"]).toBe("exam");
  });

  it("honors full days_off entries as gone", () => {
    const cfg = basicConfig();
    cfg.days_off = { "2026-01-07": "full" };
    const cal = buildCalendar(cfg);
    expect(cal.find((d) => d.date === "2026-01-07")?.type).toBe("gone");
  });

  it("skips days before effectiveStart but keeps catch-up counters anchored", () => {
    const cfg = basicConfig();
    cfg.phases[0].catchup_every = 3;
    cfg.phases[0].catchup_first_day = 3;
    const cal = buildCalendar(cfg, "2026-01-07");
    expect(cal.map((d) => d.date)).toEqual(["2026-01-07", "2026-01-08", "2026-01-09"]);
    // Counter advances through the 2 skipped days (Mon, Tue), so on Wed
    // it's 2 (still < first_day=3, so study). Thu has counter=3, hits the
    // first catch-up trigger. Fri counter=4, back to study.
    expect(cal.map((d) => d.type)).toEqual(["study", "rest", "study"]);
  });
});

// =====================================================================
// partitionSubjects
// =====================================================================

describe("partitionSubjects", () => {
  function makeQbank(subjectCount: number, unitsEach: number): StudyResource {
    return {
      id: "r1",
      name: "Test Qbank",
      short_name: "Test",
      type: "qbank",
      color: "#000",
      pace: 30,
      subjects: Array.from({ length: subjectCount }, (_, i) => ({
        id: `s${i + 1}`,
        name: `S${i + 1}`,
        content_amount: unitsEach,
        active: true,
      })),
    };
  }

  it("assigns every subject to one phase, no duplicates", () => {
    const r = makeQbank(6, 100);
    const cfg: StudyConfig = {
      ...basicConfig(),
      phases: [
        {
          name: "P1",
          start_date: "2026-01-05",
          end_date: "2026-01-09",
          daily_minutes_weekday: 480,
          daily_minutes_weekend: 0,
          catchup_every: 0,
          subject_order: [],
          resources: [],
        },
        {
          name: "P2",
          start_date: "2026-01-12",
          end_date: "2026-01-16",
          daily_minutes_weekday: 480,
          daily_minutes_weekend: 0,
          catchup_every: 0,
          subject_order: [],
          resources: [],
        },
        {
          name: "P3",
          start_date: "2026-01-19",
          end_date: "2026-01-23",
          daily_minutes_weekday: 480,
          daily_minutes_weekend: 0,
          catchup_every: 0,
          subject_order: [],
          resources: [],
        },
      ],
    };
    const cal = buildCalendar(cfg);
    const map = partitionSubjects(r, [0, 1, 2], cal, cfg.phases);
    expect(map.size).toBe(6);
    const phases = [...map.values()];
    expect(phases.every((p) => p === 0 || p === 1 || p === 2)).toBe(true);
  });

  it("distributes roughly proportionally to phase day counts", () => {
    const r = makeQbank(9, 100); // 9 equal subjects
    const cfg: StudyConfig = {
      ...basicConfig(),
      phases: [
        // P1 5 days, P2 5 days, P3 5 days → ~3 subjects per phase
        {
          name: "P1",
          start_date: "2026-01-05",
          end_date: "2026-01-09",
          daily_minutes_weekday: 480,
          daily_minutes_weekend: 0,
          catchup_every: 0,
          subject_order: [],
          resources: [],
        },
        {
          name: "P2",
          start_date: "2026-01-12",
          end_date: "2026-01-16",
          daily_minutes_weekday: 480,
          daily_minutes_weekend: 0,
          catchup_every: 0,
          subject_order: [],
          resources: [],
        },
        {
          name: "P3",
          start_date: "2026-01-19",
          end_date: "2026-01-23",
          daily_minutes_weekday: 480,
          daily_minutes_weekend: 0,
          catchup_every: 0,
          subject_order: [],
          resources: [],
        },
      ],
    };
    const cal = buildCalendar(cfg);
    const map = partitionSubjects(r, [0, 1, 2], cal, cfg.phases);
    const counts = [0, 0, 0];
    for (const p of map.values()) counts[p]++;
    // Each phase should have at least 2 subjects and at most 4 (3 ± 1 for tie-break drift).
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(2);
      expect(c).toBeLessThanOrEqual(4);
    }
  });
});

// =====================================================================
// validateConfig
// =====================================================================

describe("validateConfig", () => {
  it("requires at least one phase", () => {
    const errs = validateConfig([], { ...basicConfig(), phases: [] });
    expect(errs.some((e) => /Add at least one phase/.test(e.message))).toBe(true);
  });

  it("rejects start_date after end_date", () => {
    const cfg = basicConfig();
    cfg.phases[0].end_date = "2026-01-01";
    const errs = validateConfig([], cfg);
    expect(errs.some((e) => /start date is after end date/.test(e.message))).toBe(true);
  });

  it("rejects overlapping phases", () => {
    const cfg: StudyConfig = {
      ...basicConfig(),
      phases: [
        {
          name: "P1",
          start_date: "2026-01-05",
          end_date: "2026-01-15",
          daily_minutes_weekday: 480,
          daily_minutes_weekend: 0,
          catchup_every: 0,
          subject_order: [],
          resources: [{ resource_id: "r", mode: "study" }],
        },
        {
          name: "P2",
          start_date: "2026-01-10",
          end_date: "2026-01-20",
          daily_minutes_weekday: 480,
          daily_minutes_weekend: 0,
          catchup_every: 0,
          subject_order: [],
          resources: [{ resource_id: "r", mode: "study" }],
        },
      ],
    };
    const errs = validateConfig([], cfg);
    expect(errs.some((e) => /overlaps/.test(e.message))).toBe(true);
  });

  it("rejects phases with no resources assigned", () => {
    const cfg = basicConfig();
    cfg.phases[0].resources = [];
    const errs = validateConfig([], cfg);
    expect(errs.some((e) => /no resources assigned/.test(e.message))).toBe(true);
  });
});

// =====================================================================
// generateSchedule — integration
// =====================================================================

describe("generateSchedule", () => {
  const r: StudyResource = {
    id: "r1",
    name: "Test Qbank",
    short_name: "TQ",
    type: "qbank",
    color: "#000",
    pace: 30,
    subjects: [{ id: "s-all", name: "All", content_amount: 100, active: true }],
  };

  const cfg: StudyConfig = {
    id: "default",
    exam_dates: [],
    days_off: {},
    recurring_off: [],
    phases: [
      {
        name: "P1",
        start_date: "2026-01-05",
        end_date: "2026-01-09",
        daily_minutes_weekday: 480,
        daily_minutes_weekend: 0,
        catchup_every: 0,
        subject_order: [],
        resources: [{ resource_id: "r1", mode: "study" }],
      },
    ],
  };

  it("schedules total content_units equal to subject content_amount", () => {
    const { tasks } = generateSchedule([r], cfg);
    const total = tasks
      .filter((t) => t.task_type === "task")
      .reduce((s, t) => s + t.content_units, 0);
    expect(total).toBe(100);
  });

  it("applies completedProgress so done units are skipped", () => {
    const progress = { "r1::s-all": 40 };
    const { tasks } = generateSchedule([r], cfg, progress);
    const total = tasks
      .filter((t) => t.task_type === "task")
      .reduce((s, t) => s + t.content_units, 0);
    expect(total).toBe(60); // 100 - 40
  });

  it("with effectiveStart, emits no tasks before that date", () => {
    const { tasks } = generateSchedule([r], cfg, undefined, "2026-01-07");
    const studyTasks = tasks.filter((t) => t.task_type === "task");
    expect(studyTasks.every((t) => t.date >= "2026-01-07")).toBe(true);
  });

  it("assigns stable task_id that doesn't depend on activity formatting", () => {
    const { tasks: a } = generateSchedule([r], cfg);
    // Tweak the resource name (which changes the activity string).
    const r2 = { ...r, name: "Renamed Bank" };
    const { tasks: b } = generateSchedule([r2], cfg);
    const idsA = new Set(a.filter((t) => t.task_type === "task").map((t) => t.task_id));
    const idsB = new Set(b.filter((t) => t.task_type === "task").map((t) => t.task_id));
    expect(idsA).toEqual(idsB);
  });

  it("task_id survives subject rename", () => {
    const { tasks: a } = generateSchedule([r], cfg);
    const r2 = { ...r, subjects: [{ ...r.subjects[0], name: "Renamed Section" }] };
    const { tasks: b } = generateSchedule([r2], cfg);
    const idsA = new Set(a.filter((t) => t.task_type === "task").map((t) => t.task_id));
    const idsB = new Set(b.filter((t) => t.task_type === "task").map((t) => t.task_id));
    expect(idsA).toEqual(idsB);
  });
});
