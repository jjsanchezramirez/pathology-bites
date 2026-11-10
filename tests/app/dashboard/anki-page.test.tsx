/**
 * AnkiPage — characterization tests.
 *
 * The page loads a small index first and a category's cards only when that
 * category is opened (anki-sections.ts / anki-loader.ts). The loader hooks,
 * card viewer, mobile hook and image prefetch are mocked; DOM assertions pin:
 *   - decks render in the left sidebar with their category counts
 *   - selecting a deck reveals its categories
 *   - selecting a category loads that category's cards (and only those)
 *   - a loading state shows while a category's cards download
 *   - ?cardId= links resolve through the card-id map
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { organizeDecks, summarizeDecks } from "@/app/(dashboard)/dashboard/anki/anki-data";

const fixture = vi.hoisted(() => {
  const cards = [
    { id: "c1", tags: ["#ANKOMA::AP::Bone"], front: "F1", back: "B1" },
    { id: "c2", tags: ["#ANKOMA::AP::Bone::Tumors"], front: "F2", back: "B2" },
    { id: "c3", tags: ["#ANKOMA::CP::Chemistry"], front: "F3", back: "B3" },
  ];
  return { cards, loading: new Set<string>(), requested: [] as string[] };
});

const fileFor = (categoryId: string) => ({
  url: `https://data.example/anki/sections/${categoryId}.json.br`,
  hash: "h",
  bytes: 1,
});

function buildIndex() {
  const decks = summarizeDecks(
    organizeDecks({
      sections: [
        {
          cards: fixture.cards,
          subsections: [],
        } as never,
      ],
    })
  );
  const categories = Object.fromEntries(
    decks.flatMap((d) => d.categories).map((c) => [c.id, fileFor(c.id)])
  );
  return {
    v: 1,
    generatedAt: "t",
    totalCards: 3,
    decks,
    categories,
    cardIds: { url: "https://data.example/anki/card-ids.json.br", hash: "h", bytes: 1 },
  };
}

vi.mock("@/app/(dashboard)/dashboard/anki/anki-loader", () => ({
  useAnkomaIndex: () => ({ data: buildIndex(), isLoading: false, error: null }),
  useCategoryCards: (file?: { url: string }) => {
    if (!file) return { cards: [], isLoading: false, error: null };
    fixture.requested.push(file.url);
    const categoryId = decodeURIComponent(file.url.split("/sections/")[1].replace(".json.br", ""));
    if (fixture.loading.has(categoryId)) return { cards: [], isLoading: true, error: null };
    const cards = fixture.cards.filter((c) => c.tags[0].startsWith(`#ANKOMA::${categoryId}`));
    return { cards, isLoading: false, error: null };
  },
  loadCardIdMap: async () => ({ c1: "AP::Bone", c2: "AP::Bone", c3: "CP::Chemistry" }),
}));
vi.mock("@/shared/hooks/use-mobile", () => ({ useMobile: () => false }));
vi.mock("@/features/user/anki/utils/prefetch-card-images", () => ({
  prefetchAroundCard: vi.fn(),
}));
vi.mock("@/features/user/anki/components/interactive-anki-viewer", () => ({
  InteractiveAnkiViewer: ({ card }: { card: { id: string } }) => (
    <div data-testid="anki-viewer">card:{card.id}</div>
  ),
}));

import AnkiPage from "@/app/(dashboard)/dashboard/anki/page";

beforeEach(() => {
  vi.clearAllMocks();
  fixture.loading.clear();
  fixture.requested.length = 0;
});

afterEach(() => {
  // Explicit: under a loaded full-suite run the previous render was leaking into the next test.
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("AnkiPage — characterization", () => {
  it("renders the decks with category counts in the left sidebar", () => {
    render(<AnkiPage />);
    expect(screen.getByText("Anatomic Pathology")).toBeTruthy();
    expect(screen.getByText("Clinical Pathology")).toBeTruthy();
    // both decks have exactly 1 category (AP→Bone, CP→Chemistry)
    expect(screen.getAllByText("1 categories")).toHaveLength(2);
  });

  it("starts on the 'Select a Category' placeholder and loads no category", () => {
    render(<AnkiPage />);
    expect(screen.getByText("Select a Category")).toBeTruthy();
    expect(fixture.requested).toHaveLength(0);
  });

  it("reveals a deck's categories when the deck is selected", () => {
    render(<AnkiPage />);
    fireEvent.click(screen.getByText("Anatomic Pathology"));
    expect(screen.getByText("Bone")).toBeTruthy();
  });

  it("loads only the chosen category and renders its first card", () => {
    render(<AnkiPage />);
    fireEvent.click(screen.getByText("Anatomic Pathology"));
    fireEvent.click(screen.getByText("Bone"));
    expect(screen.getByTestId("anki-viewer")).toBeTruthy();
    expect(screen.getByText("card:c1")).toBeTruthy();
    expect(new Set(fixture.requested)).toEqual(new Set([fileFor("AP::Bone").url]));
  });

  it("shows a loading state while the category's cards download", () => {
    fixture.loading.add("AP::Bone");
    render(<AnkiPage />);
    fireEvent.click(screen.getByText("Anatomic Pathology"));
    fireEvent.click(screen.getByText("Bone"));
    expect(screen.getByText("Loading Bone cards…")).toBeTruthy();
    expect(screen.queryByTestId("anki-viewer")).toBeNull();
  });

  it("opens a ?cardId= link in its category and subcategory", async () => {
    window.history.replaceState(null, "", "/dashboard/anki?cardId=c2");
    render(<AnkiPage />);
    await waitFor(() => expect(screen.getByText("card:c2")).toBeTruthy());
    expect(screen.getByText(/Bone → Tumors/)).toBeTruthy();
  });
});
