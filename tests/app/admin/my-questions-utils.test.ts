/**
 * Unit tests for the pure helpers extracted from the My Questions page.
 */
import { describe, it, expect } from "vitest";
import {
  filterQuestions,
  getColSpan,
  getAgeTier,
  pickInitialTab,
  buildMyQuestions,
  type MyQuestion,
} from "@/app/(admin)/admin/my-questions/my-questions-utils";

function q(p: Partial<MyQuestion> & { id: string; status: string }): MyQuestion {
  return {
    title: `Title ${p.id}`,
    stem: `Stem ${p.id}`,
    difficulty: "medium",
    updated_at: "2024-01-01",
    ...p,
  } as unknown as MyQuestion;
}

describe("filterQuestions", () => {
  const data = [
    q({ id: "1", status: "rejected", title: "Renal", difficulty: "hard" }),
    q({ id: "2", status: "draft", title: "Hepatic", difficulty: "easy" }),
    q({ id: "3", status: "draft", title: "Renal cyst", difficulty: "medium" }),
  ];

  it("filters by tab status", () => {
    expect(
      filterQuestions(data, { activeTab: "drafts", searchTerm: "", difficultyFilter: "all" }).map(
        (x) => x.id
      )
    ).toEqual(["2", "3"]);
    expect(
      filterQuestions(data, { activeTab: "revision", searchTerm: "", difficultyFilter: "all" }).map(
        (x) => x.id
      )
    ).toEqual(["1"]);
  });

  it("applies search across title and stem (case-insensitive)", () => {
    const r = filterQuestions(data, {
      activeTab: "drafts",
      searchTerm: "renal",
      difficultyFilter: "all",
    });
    expect(r.map((x) => x.id)).toEqual(["3"]);
  });

  it("applies the difficulty filter", () => {
    const r = filterQuestions(data, {
      activeTab: "drafts",
      searchTerm: "",
      difficultyFilter: "easy",
    });
    expect(r.map((x) => x.id)).toEqual(["2"]);
  });

  it("an unknown tab applies no status filter", () => {
    expect(
      filterQuestions(data, { activeTab: "", searchTerm: "", difficultyFilter: "all" })
    ).toHaveLength(3);
  });
});

describe("getColSpan", () => {
  it("is 3 for drafts and published, else 2", () => {
    expect(getColSpan("drafts")).toBe(3);
    expect(getColSpan("published")).toBe(3);
    expect(getColSpan("revision")).toBe(2);
    expect(getColSpan("flagged")).toBe(2);
  });
});

describe("getAgeTier", () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
  it("returns urgent >7d, aging >3d, else null", () => {
    expect(getAgeTier(daysAgo(10))).toBe("urgent");
    expect(getAgeTier(daysAgo(5))).toBe("aging");
    expect(getAgeTier(daysAgo(1))).toBeNull();
  });
});

describe("pickInitialTab", () => {
  it("picks the first non-empty tab by priority (revision first)", () => {
    expect(
      pickInitialTab([q({ id: "1", status: "draft" }), q({ id: "2", status: "rejected" })])
    ).toBe("revision");
  });

  it("falls through to lower-priority tabs", () => {
    expect(pickInitialTab([q({ id: "1", status: "published" })])).toBe("published");
    expect(pickInitialTab([q({ id: "1", status: "pending_review" })])).toBe("under-review");
  });

  it("defaults to revision when there are no questions", () => {
    expect(pickInitialTab([])).toBe("revision");
  });
});

describe("buildMyQuestions", () => {
  it("merges latest resubmission notes and flag info onto questions", () => {
    const data = [
      { id: "a", status: "rejected" },
      { id: "b", status: "flagged" },
    ];
    const reviews = [
      {
        question_id: "a",
        changes_made: { resubmission_notes: "Reworded" },
        created_at: "2024-02-02",
      },
      { question_id: "a", changes_made: { resubmission_notes: "OLD" }, created_at: "2024-01-01" },
    ];
    const flags = [
      {
        question_id: "b",
        flag_type: "incorrect",
        description: "Wrong answer",
        created_at: "2024-03-03",
        flagged_by_user: { first_name: "Ada", last_name: "Lovelace" },
      },
    ];

    const result = buildMyQuestions(data, reviews, flags);
    const a = result.find((x) => x.id === "a")!;
    const b = result.find((x) => x.id === "b")!;

    expect(a.resubmission_notes).toBe("Reworded"); // first (latest) row wins
    expect(b.flag_info).toEqual({
      flag_type: "incorrect",
      description: "Wrong answer",
      flagged_by_name: "Ada Lovelace",
      created_at: "2024-03-03",
    });
  });

  it("uses 'Unknown' when a flag has no flagged_by_user", () => {
    const result = buildMyQuestions(
      [{ id: "b", status: "flagged" }],
      [],
      [{ question_id: "b", flag_type: "x", description: null, created_at: "2024-01-01" }]
    );
    expect(result[0].flag_info?.flagged_by_name).toBe("Unknown");
  });
});
