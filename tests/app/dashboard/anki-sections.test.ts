/**
 * Per-category publishing (anki-sections.ts). The contract: a category file,
 * run through the app's normal parser, yields exactly the cards — same ids,
 * card numbers, content and order — that a full-deck parse puts in that
 * category. buildAnkomaSections() enforces it at publish time; these tests pin
 * it on a small deck where categories interleave inside the same deck node
 * (the case that would renumber cards if `_index` were lost).
 */
import { describe, it, expect } from "vitest";
import type { AnkomaDeck, AnkomaNote } from "@/features/user/anki/types/anki-card";
import { parseAnkomaData } from "@/features/user/anki/utils/ankoma-parser";
import { organizeDecks } from "@/app/(dashboard)/dashboard/anki/anki-data";
import {
  buildAnkomaSections,
  cardsFromCategoryFile,
  categorySlug,
  findCategoryForCardId,
  pruneDeck,
} from "@/app/(dashboard)/dashboard/anki/anki-sections";

const note = (guid: string, tag: string, text: string): AnkomaNote => ({
  __type__: "Note",
  guid,
  note_model_uuid: "model",
  tags: [tag],
  fields: [`Header ${guid}`, `${text} {{c1::answer ${guid}}}`, "", "", "", ""],
});

const deck: AnkomaDeck = {
  __type__: "Deck",
  name: "Ankoma",
  notes: [],
  children: [
    {
      __type__: "Deck",
      name: "Ankoma - AP",
      notes: [],
      children: [
        {
          __type__: "Deck",
          name: "Mixed",
          children: [],
          notes: [
            note("a1", "#ANKOMA::AP::Bone", "first bone"),
            note("b1", "#ANKOMA::AP::Skin", "first skin"),
            note("a2", "#ANKOMA::AP::Bone::Tumors", "second bone"),
            note("b2", "#ANKOMA::AP::Skin", "second skin"),
            note("x1", "#untagged", "no category"),
          ],
        },
        {
          __type__: "Deck",
          name: "Thorax",
          children: [],
          notes: [note("t1", "#ANKOMA::AP::Pulmonary", "lung")],
        },
      ],
    },
  ],
};

const strip = <T extends { due?: number; mod?: number }>(c: T) => {
  const { due: _d, mod: _m, ...rest } = c;
  return rest;
};

describe("buildAnkomaSections", () => {
  const built = buildAnkomaSections(deck);
  const full = organizeDecks(parseAnkomaData(deck));

  it("makes one file per sidebar category (after name merges)", () => {
    expect([...built.files.keys()].sort()).toEqual(["AP::Bone", "AP::Skin", "AP::Thoracic"]);
  });

  it("reproduces each category's cards exactly, including card numbers", () => {
    for (const category of full.flatMap((d) => d.categories)) {
      const fromFile = cardsFromCategoryFile(built.files.get(category.id)!);
      expect(fromFile.map(strip)).toEqual(category.cards.map(strip));
    }
    // b2 sits 4th in its deck node; dropping the Bone notes must not renumber it.
    const skin = cardsFromCategoryFile(built.files.get("AP::Skin")!);
    expect(skin.find((c) => c.id === "b2")?.cardId).toBe(4);
  });

  it("keeps only the category's notes, with their original positions", () => {
    const mixed = built.files.get("AP::Skin")!.deck.children[0].children[0];
    expect(mixed.notes.map((n) => [n.guid, n._index])).toEqual([
      ["b1", 1],
      ["b2", 3],
    ]);
  });

  it("summarizes decks for the index without card bodies", () => {
    const ap = built.decks.find((d) => d.id === "AP")!;
    expect(ap.totalCards).toBe(5);
    expect(ap.categories.find((c) => c.id === "AP::Bone")).toEqual({
      id: "AP::Bone",
      name: "Bone",
      cardCount: 2,
      subcategories: [{ name: "Tumors", cardCount: 1 }],
    });
    expect(built.totalCards).toBe(5);
  });

  it("maps every placed card id to its category, and skips untagged notes", () => {
    expect(built.cardIds).toEqual({
      a1: "AP::Bone",
      a2: "AP::Bone",
      b1: "AP::Skin",
      b2: "AP::Skin",
      t1: "AP::Thoracic",
    });
  });
});

describe("cardsFromCategoryFile", () => {
  it("orders cards by the published full-deck order", () => {
    const file = buildAnkomaSections(deck).files.get("AP::Bone")!;
    const reversed = { ...file, order: [...file.order].reverse() };
    expect(cardsFromCategoryFile(reversed).map((c) => c.id)).toEqual(["a2", "a1"]);
  });

  it("returns [] when the file holds no cards of its category", () => {
    const file = buildAnkomaSections(deck).files.get("AP::Bone")!;
    expect(cardsFromCategoryFile({ ...file, categoryId: "CP::Nothing" })).toEqual([]);
  });
});

describe("pruneDeck", () => {
  it("drops empty branches but keeps the root", () => {
    const pruned = pruneDeck(deck, () => false);
    expect(pruned).toEqual({ __type__: "Deck", name: "Ankoma", children: [], notes: [] });
  });
});

describe("findCategoryForCardId", () => {
  const map = { abc: "AP::Bone", "def-2": "CP::Chemistry" };
  it("matches exact ids and `<guid>-` card ids", () => {
    expect(findCategoryForCardId(map, "abc")).toBe("AP::Bone");
    expect(findCategoryForCardId(map, "def")).toBe("CP::Chemistry");
    expect(findCategoryForCardId(map, "zzz")).toBeNull();
  });
});

describe("categorySlug", () => {
  it("is URL-safe", () => {
    expect(categorySlug("AP::Bone & Soft Tissue")).toBe("ap-bone-and-soft-tissue");
    expect(categorySlug("CP::Hemepath Neoplastic")).toBe("cp-hemepath-neoplastic");
  });
});
