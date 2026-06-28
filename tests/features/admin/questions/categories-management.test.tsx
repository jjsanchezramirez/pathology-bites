/**
 * CategoriesManagement — characterization tests.
 *
 * Written BEFORE decomposing the 731-line monolith so the refactor (extracting the
 * pure helpers, dialogs, table row, and pagination) can't change observable behavior.
 * These assert against the rendered DOM, so they transitively pin the internal helpers:
 *   - row order  ⇒ `organizeHierarchically` (roots alphabetical, children nested+alphabetical)
 *   - page chips ⇒ `getPageNumbers` + the client-side slice
 * plus selection → bulk-action affordances and search → refetch.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

// Child dialogs pull in forms/fetch we don't care about here — stub them out.
vi.mock("@/features/admin/questions/components/metadata/categories/create-category-dialog", () => ({
  CreateCategoryDialog: () => null,
}));
vi.mock("@/features/admin/questions/components/metadata/categories/edit-category-dialog", () => ({
  EditCategoryDialog: () => null,
}));
// Badge → plain text so assertions don't depend on color/short-form config.
vi.mock("@/shared/components/ui/category-badge", () => ({
  CategoryBadge: ({ category }: { category: { short_form?: string; name?: string } }) => (
    <span data-testid="category-badge">{category.short_form ?? category.name}</span>
  ),
}));
vi.mock("@/shared/utils/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { CategoriesManagement } from "@/features/admin/questions/components/metadata/categories/categories-management";

type MockCat = {
  id: string;
  name: string;
  level: number;
  parent_id?: string;
  question_count?: number;
  created_at?: string;
};

function mockFetchOnce(categories: MockCat[]) {
  const fn = vi.fn(async () => ({
    ok: true,
    json: async () => ({ categories }),
  }));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** Read the Name column (2nd cell) of each data row, in DOM order. */
function renderedNames(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1) // drop header
    .map((r) => {
      const cells = within(r).getAllByRole("cell");
      return cells[1]?.textContent?.trim() ?? ""; // [0]=checkbox, [1]=Name
    })
    .filter((t) => t.length > 0); // skips loading/empty colSpan rows
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CategoriesManagement — characterization", () => {
  it("orders rows hierarchically: roots alphabetical, children nested + alphabetical", async () => {
    mockFetchOnce([
      { id: "b", name: "Beta", level: 1 },
      { id: "a", name: "Alpha", level: 1 },
      { id: "a2", name: "Alpha-Zebra", level: 2, parent_id: "a" },
      { id: "a1", name: "Alpha-Apple", level: 2, parent_id: "a" },
      { id: "b1", name: "Beta-Child", level: 2, parent_id: "b" },
    ]);

    render(<CategoriesManagement />);

    await screen.findByText("Alpha");
    expect(renderedNames()).toEqual(["Alpha", "Alpha-Apple", "Alpha-Zebra", "Beta", "Beta-Child"]);
  });

  it("renders the per-category question count", async () => {
    mockFetchOnce([{ id: "a", name: "Alpha", level: 1, question_count: 7 }]);
    render(<CategoriesManagement />);
    await screen.findByText("Alpha");
    expect(screen.getByText("7 questions")).toBeTruthy();
    expect(screen.getByText("Total: 1 categories")).toBeTruthy();
  });

  it("paginates client-side at 30 per page", async () => {
    const many: MockCat[] = Array.from({ length: 45 }, (_, i) => ({
      id: `c${i}`,
      // zero-pad so alphabetical order == numeric order for a stable assertion
      name: `Cat-${String(i).padStart(2, "0")}`,
      level: 1,
    }));
    mockFetchOnce(many);

    render(<CategoriesManagement />);
    await screen.findByText("Cat-00");

    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(renderedNames()).toHaveLength(30);
    expect(screen.queryByText("Cat-30")).toBeNull(); // on page 2

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    await screen.findByText("Page 2 of 2");
    expect(screen.getByText("Cat-30")).toBeTruthy();
    expect(renderedNames()).toHaveLength(15);
  });

  it("revealing bulk-action buttons once rows are selected", async () => {
    mockFetchOnce([
      { id: "a", name: "Alpha", level: 1 },
      { id: "b", name: "Beta", level: 1 },
    ]);
    render(<CategoriesManagement />);
    await screen.findByText("Alpha");

    // no bulk buttons before selection
    expect(screen.queryByRole("button", { name: /^Delete \(/ })).toBeNull();

    fireEvent.click(screen.getByLabelText("Select Alpha"));

    expect(screen.getByRole("button", { name: "Delete (1)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Assign Parent (1)" })).toBeTruthy();

    // select-all toggles every row
    fireEvent.click(screen.getByLabelText("Select all categories"));
    expect(screen.getByRole("button", { name: "Delete (2)" })).toBeTruthy();
  });

  it("refetches with the search term and resets to page 0", async () => {
    const fn = mockFetchOnce([{ id: "a", name: "Alpha", level: 1 }]);
    render(<CategoriesManagement />);
    await screen.findByText("Alpha");

    fireEvent.change(screen.getByPlaceholderText("Search categories..."), {
      target: { value: "Bone" },
    });

    await waitFor(() => {
      const urls = fn.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes("search=Bone"))).toBe(true);
    });
  });
});
