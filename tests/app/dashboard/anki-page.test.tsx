/**
 * AnkiPage — characterization tests.
 *
 * Written BEFORE decomposing the 981-line page (extract the tag-normalization +
 * deck-organization data layer and the sidebar / card-area components). The ankoma
 * data hook + card viewer + mobile hook are mocked; DOM assertions pin:
 *   - decks render in the left sidebar with their card counts
 *   - selecting a deck reveals its categories
 *   - selecting a category renders the card viewer
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const data = vi.hoisted(() => ({
  ankomaData: {
    sections: [
      {
        cards: [
          { id: "c1", tags: ["#ANKOMA::AP::Bone"], front: "F1", back: "B1" },
          { id: "c2", tags: ["#ANKOMA::AP::Bone::Tumors"], front: "F2", back: "B2" },
          { id: "c3", tags: ["#ANKOMA::CP::Chemistry"], front: "F3", back: "B3" },
        ],
        subsections: [],
      },
    ],
  },
}));

vi.mock("@/shared/hooks/use-client-ankoma", () => ({
  useClientAnkoma: () => ({ ankomaData: data.ankomaData, isLoading: false }),
}));
vi.mock("@/shared/hooks/use-mobile", () => ({ useMobile: () => false }));
vi.mock("@/features/user/anki/components/interactive-anki-viewer", () => ({
  InteractiveAnkiViewer: ({ card }: { card: { id: string } }) => (
    <div data-testid="anki-viewer">card:{card.id}</div>
  ),
}));

import AnkiPage from "@/app/(dashboard)/dashboard/anki/page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AnkiPage — characterization", () => {
  it("renders the decks with card counts in the left sidebar", () => {
    render(<AnkiPage />);
    expect(screen.getByText("Anatomic Pathology")).toBeTruthy();
    expect(screen.getByText("Clinical Pathology")).toBeTruthy();
    // both decks have exactly 1 category (AP→Bone, CP→Chemistry)
    expect(screen.getAllByText("1 categories")).toHaveLength(2);
  });

  it("starts on the 'Select a Category' placeholder", () => {
    render(<AnkiPage />);
    expect(screen.getByText("Select a Category")).toBeTruthy();
  });

  it("reveals a deck's categories when the deck is selected", () => {
    render(<AnkiPage />);
    fireEvent.click(screen.getByText("Anatomic Pathology"));
    expect(screen.getByText("Bone")).toBeTruthy();
  });

  it("renders the card viewer once a category is chosen", () => {
    render(<AnkiPage />);
    fireEvent.click(screen.getByText("Anatomic Pathology"));
    fireEvent.click(screen.getByText("Bone"));
    expect(screen.getByTestId("anki-viewer")).toBeTruthy();
    expect(screen.getByText("card:c1")).toBeTruthy();
  });
});
