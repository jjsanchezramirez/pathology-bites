/**
 * TagsManagementGrid — characterization tests.
 *
 * Written BEFORE decomposing the 1038-line monolith (extract TagCard, the four
 * dialogs, pagination, and the pure sort/pagination helpers). fetch + child dialogs
 * are mocked; DOM assertions pin:
 *   - a card per tag with its question count, default alphabetical order (sortBy "name")
 *   - the empty state
 *   - selection → bulk-action bar, with Merge gated on ≥2 selected, and select-all
 *   - debounced (300ms) search → refetch with the search param
 *   - the pagination "Showing X to Y of Z tags" summary
 *
 * Non-default sort branches + radix dropdown/dialog interactions aren't driveable in
 * happy-dom; those are covered by direct unit tests on the extracted helpers + batch QA.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/features/admin/questions/components/metadata/tags/create-tag-dialog", () => ({
  CreateTagDialog: () => null,
}));
vi.mock("@/features/admin/questions/components/metadata/tags/edit-tag-dialog", () => ({
  EditTagDialog: () => null,
}));
vi.mock("@/features/admin/questions/components/metadata/tags/tag-stats-cards", () => ({
  TagStatsCards: () => null,
}));
vi.mock("@/shared/services/client", () => ({ createClient: vi.fn() }));
vi.mock("@/shared/utils/api/api-client", () => ({ apiClient: { delete: vi.fn() } }));
vi.mock("@/shared/utils/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { TagsManagementGrid } from "@/features/admin/questions/components/metadata/tags/tags-management-grid";

type MockTag = { id: string; name: string; created_at?: string; question_count?: number };

function mockFetch(tags: MockTag[], extra: { totalTags?: number; totalPages?: number } = {}) {
  const fn = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      tags,
      totalTags: extra.totalTags ?? tags.length,
      totalPages: extra.totalPages ?? 1,
    }),
  }));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function cardNames(): string[] {
  return screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent!.trim());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TagsManagementGrid — characterization", () => {
  it("renders a card per tag with its count, default alphabetical order", async () => {
    mockFetch([
      { id: "b", name: "Beta", question_count: 3 },
      { id: "a", name: "Alpha", question_count: 0 },
      { id: "c", name: "Gamma", question_count: 12 },
    ]);
    render(<TagsManagementGrid />);

    await screen.findByText("Alpha");
    expect(cardNames()).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(screen.getByText("12 questions")).toBeTruthy();
    expect(screen.getByText("0 questions")).toBeTruthy();
  });

  it("shows the empty state when there are no tags", async () => {
    mockFetch([], { totalTags: 0, totalPages: 0 });
    render(<TagsManagementGrid />);
    expect(await screen.findByText("No tags found")).toBeTruthy();
  });

  it("reveals the bulk bar on selection; Merge needs ≥2, Delete needs ≥1", async () => {
    mockFetch([
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ]);
    render(<TagsManagementGrid />);
    await screen.findByText("Alpha");

    const checkboxes = screen.getAllByRole("checkbox"); // [0]=select-all, [1..]=cards
    fireEvent.click(checkboxes[1]); // select Alpha

    expect(screen.getByText("1 tag selected")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Merge Selected/ }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /Delete Selected/ }) as HTMLButtonElement).disabled
    ).toBe(false);

    fireEvent.click(screen.getAllByRole("checkbox")[2]); // select Beta too
    expect(screen.getByText("2 tags selected")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Merge Selected/ }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it("select-all toggles every card", async () => {
    mockFetch([
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
      { id: "c", name: "Gamma" },
    ]);
    render(<TagsManagementGrid />);
    await screen.findByText("Alpha");

    fireEvent.click(screen.getAllByRole("checkbox")[0]); // select-all
    expect(screen.getByText("3 of 3 selected")).toBeTruthy();
  });

  it("debounces search then refetches with the search param", async () => {
    const fn = mockFetch([{ id: "a", name: "Alpha" }]);
    render(<TagsManagementGrid />);
    await screen.findByText("Alpha");

    fireEvent.change(screen.getByPlaceholderText("Search tags..."), {
      target: { value: "Renal" },
    });

    await waitFor(
      () => {
        const urls = fn.mock.calls.map((c) => String(c[0]));
        expect(urls.some((u) => u.includes("search=Renal"))).toBe(true);
      },
      { timeout: 2000 }
    );
  });

  it("renders the pagination summary", async () => {
    mockFetch([{ id: "a", name: "Alpha" }], { totalTags: 1, totalPages: 1 });
    render(<TagsManagementGrid />);
    await screen.findByText("Alpha");
    expect(screen.getByText("Showing 1 to 1 of 1 tags")).toBeTruthy();
  });
});
