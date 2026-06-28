/**
 * Unit tests for the pure data layer extracted from the Anki page.
 */
import { describe, it, expect } from "vitest";
import {
  formatTagName,
  getAllCards,
  organizeDecks,
  getSubcategoryCards,
  buildCategorySidebarData,
} from "@/app/(dashboard)/dashboard/anki/anki-data";
import type { AnkiCard, AnkomaSection } from "@/features/user/anki/types/anki-card";

function card(id: string, tags: string[]): AnkiCard {
  return { id, tags, front: `F${id}`, back: `B${id}` } as unknown as AnkiCard;
}
function section(cards: AnkiCard[], subsections: AnkomaSection[] = []): AnkomaSection {
  return { cards, subsections } as unknown as AnkomaSection;
}

describe("formatTagName", () => {
  it("splits camelCase and tidies separators", () => {
    expect(formatTagName("SmoothMuscle")).toBe("Muscle"); // also normalized
    expect(formatTagName("Peripheral_blood_smears")).toBe("Peripheral Blood Smears");
  });

  it("applies global name normalizations", () => {
    expect(formatTagName("Ewing")).toBe("Ewing Sarcoma");
    expect(formatTagName("Gaucher")).toBe("Gaucher Disease");
  });

  it("applies parent-specific overrides before global ones", () => {
    expect(formatTagName("proteins", "Chemistry")).toBe("Protein Analysis");
    expect(formatTagName("Quick Compendium", "Chemistry")).toBe("General Principles");
  });

  it("collapses invalid Microbiology subcategories to General Principles", () => {
    expect(formatTagName("Randomthing", "Microbiology")).toBe("General Principles");
    expect(formatTagName("Bacteriology", "Microbiology")).toBe("Bacteriology");
  });

  it("converts 'and' to & and capitalizes", () => {
    expect(formatTagName("liver and biliary")).toBe("Liver & biliary");
  });
});

describe("getAllCards", () => {
  it("flattens nested subsections depth-first", () => {
    const tree = [section([card("a", [])], [section([card("b", [])])]), section([card("c", [])])];
    expect(getAllCards(tree).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });
});

describe("organizeDecks", () => {
  const data = {
    sections: [
      section([
        card("c1", ["#ANKOMA::AP::Bone"]),
        card("c2", ["#ANKOMA::AP::Bone::Tumors"]),
        card("c3", ["#ANKOMA::CP::Chemistry"]),
        card("c4", ["no-ankoma-tag"]),
      ]),
    ],
  };

  it("groups cards into AP/CP decks → categories → subcategories", () => {
    const decks = organizeDecks(data);
    expect(decks.map((d) => d.id).sort()).toEqual(["AP", "CP"]);

    const ap = decks.find((d) => d.id === "AP")!;
    expect(ap.name).toBe("Anatomic Pathology");
    expect(ap.totalCards).toBe(2);
    const bone = ap.categories.find((c) => c.name === "Bone")!;
    expect(bone.cards).toHaveLength(2);
    expect(bone.subcategories).toEqual([{ name: "Tumors", cardCount: 1 }]);
  });

  it("skips cards without an #ANKOMA tag", () => {
    const decks = organizeDecks(data);
    const total = decks.reduce((n, d) => n + d.totalCards, 0);
    expect(total).toBe(3); // c4 excluded
  });

  it("returns [] for null data", () => {
    expect(organizeDecks(null)).toEqual([]);
  });
});

describe("getSubcategoryCards", () => {
  it("returns only cards whose normalized subcategory matches", () => {
    const decks = organizeDecks({
      sections: [
        section([card("c1", ["#ANKOMA::AP::Bone"]), card("c2", ["#ANKOMA::AP::Bone::Tumors"])]),
      ],
    });
    const bone = decks[0].categories[0];
    expect(getSubcategoryCards(bone, "Tumors").map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("buildCategorySidebarData", () => {
  it("sorts categories and their subcategories alphabetically", () => {
    const decks = organizeDecks({
      sections: [
        section([
          card("c1", ["#ANKOMA::AP::Zeta"]),
          card("c2", ["#ANKOMA::AP::Alpha::Bbb"]),
          card("c3", ["#ANKOMA::AP::Alpha::Aaa"]),
        ]),
      ],
    });
    const sidebar = buildCategorySidebarData(decks[0]);
    expect(sidebar.map((c) => c.name)).toEqual(["Alpha", "Zeta"]);
    expect(sidebar[0].subcategories.map((s) => s.name)).toEqual(["Aaa", "Bbb"]);
  });

  it("returns [] for no deck", () => {
    expect(buildCategorySidebarData(undefined)).toEqual([]);
  });
});
