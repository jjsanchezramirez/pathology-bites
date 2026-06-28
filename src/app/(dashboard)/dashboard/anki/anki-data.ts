// Pure data layer for the Anki page: tag-name normalization + deck/category
// organization. Extracted from page.tsx so the (regex-heavy, branch-heavy) logic
// is unit-testable in isolation (see anki-data.test.ts).

import { AnkiCard, AnkomaSection } from "@/features/user/anki/types/anki-card";

export interface CategoryData {
  id: string;
  name: string;
  cards: AnkiCard[];
  subcategories: Array<{ name: string; cardCount: number }>;
}

export interface DeckData {
  id: string;
  name: string;
  type: "AP" | "CP";
  categories: CategoryData[];
  totalCards: number;
}

// Cards to ignore by ID (excluded from all views)
export const IGNORED_CARD_IDS = new Set(["e;+G?PkVD5"]);

const NAME_NORMALIZATIONS: Record<string, string> = {
  "Smooth Muscle": "Muscle",
  "Skeletal Muscle": "Muscle",
  Myfibroblastic: "Myofibroblastic",
  "Parathyroid Adenoma": "Parathyroid",
  "Natural Deaths AP": "Natural Deaths",
  Ewing: "Ewing Sarcoma",
  Gaucher: "Gaucher Disease",
  "7.1 7.2": "Molecular Biology & Techniques",
  "7.3": "Non-Neoplastic Molecular Pathology",
  "7.4": "Neoplastic Molecular Pathology",
  CLIA88: "CLIA 88",
  "Professional Component Billing": "Billing",
  "Laboratory Test Panels": "Billing",
  "Billing Regulations": "Billing",
  "Quality Assurance": "Quality Control",
  "Quality Management": "Quality Control",
  "Quality Improvement": "Quality Control",
  "Statistical Quality Control": "Quality Control",
  "Medicare & Medicaid": "Medicare & Medicaid",
  "B Cells": "B Cells",
  "T Cells": "T Cells",
  "NK cells": "NK Cells",
  "HLA Testing": "HLA Testing",
  "A PCs": "Antigen Processing Cells",
  "Quick Compendium": "General Principles",
  "Pre analytical": "General Principles",
  Miscellaneous: "General Principles",
  proteins: "Protein Analysis",
  "Special Circumstances": "General Principles",
  Extras: "General Principles",
  "Passenger Lymphocyte Syndrome": "General Principles",
  misc: "General Principles",
  Methods: "General Principles",
  "Peripheral blood smears": "Peripheral Blood Smears",
};

const PARENT_SPECIFIC_NORMALIZATIONS: Record<string, string> = {
  "Chemistry::proteins": "Protein Analysis",
  "Chemistry::Quick Compendium": "General Principles",
  "Chemistry::Pre analytical": "General Principles",
  "Chemistry::Miscellaneous": "General Principles",
  "TransfusionMedicine::Quick Compendium": "General Principles",
  "TransfusionMedicine::Special Circumstances": "General Principles",
  "TransfusionMedicine::Extras": "General Principles",
  "TransfusionMedicine::Passenger Lymphocyte Syndrome": "General Principles",
  "Hemepath-Benign::misc": "General Principles",
  "Hemepath-Benign::Methods": "General Principles",
};

const MICROBIOLOGY_VALID_SUBCATEGORIES = [
  "Bacteriology",
  "Mycology",
  "Parasitology",
  "Virology",
  "General Principles",
];

const CATEGORY_MERGES: Record<string, string> = {
  "Benign Heme": "Hemepath Benign",
  Hemepath: "Hemepath Neoplastic",
  Pulmonary: "Thoracic",
};

/** Normalize a raw Anki tag segment into a display name (with parent-aware overrides). */
export function formatTagName(tagName: string, parentCategory?: string): string {
  if (!tagName) return tagName;

  let formatted = tagName
    .replace(/([a-z])(and)([A-Z])/g, "$1 $2 $3")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/&/g, " & ")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (formatted.startsWith("#")) {
    formatted = formatted.substring(1).trim();
  }

  if (parentCategory) {
    const parentKey = `${parentCategory}::${formatted}`;
    if (PARENT_SPECIFIC_NORMALIZATIONS[parentKey]) {
      return PARENT_SPECIFIC_NORMALIZATIONS[parentKey];
    }
  }

  if (NAME_NORMALIZATIONS[formatted]) {
    formatted = NAME_NORMALIZATIONS[formatted];
  }

  if (CATEGORY_MERGES[formatted]) {
    formatted = CATEGORY_MERGES[formatted];
  }

  if (parentCategory === "Microbiology" && !MICROBIOLOGY_VALID_SUBCATEGORIES.includes(formatted)) {
    formatted = "General Principles";
  }

  formatted = formatted.replace(/\band\b/gi, "&");

  if (formatted.length > 0) {
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  return formatted;
}

/** Flatten all cards across a section tree (depth-first). */
export function getAllCards(sections: AnkomaSection[]): AnkiCard[] {
  const allCards: AnkiCard[] = [];
  for (const section of sections) {
    allCards.push(...section.cards);
    allCards.push(...getAllCards(section.subsections));
  }
  return allCards;
}

/** Group all cards into AP/CP decks → categories → subcategories by their #ANKOMA tag. */
export function organizeDecks(ankomaData: { sections: AnkomaSection[] } | null): DeckData[] {
  if (!ankomaData) return [];

  const deckMap = new Map<string, DeckData>();
  const allCards = getAllCards(ankomaData.sections);

  for (const card of allCards) {
    if (IGNORED_CARD_IDS.has(card.id)) continue;

    const ankomaTag = card.tags.find((tag) => tag.startsWith("#ANKOMA::"));
    if (!ankomaTag) continue;

    const tagParts = ankomaTag.replace("#ANKOMA::", "").split("::");
    if (tagParts.length < 2) continue;

    const deckType = tagParts[0] as "AP" | "CP";
    const rawCategoryName = tagParts[1];
    const categoryName = formatTagName(rawCategoryName);
    const subcategoryName = tagParts[2] ? formatTagName(tagParts[2], rawCategoryName) : null;

    const deckId = deckType;
    const categoryId = `${deckType}::${categoryName}`;

    if (!deckMap.has(deckId)) {
      deckMap.set(deckId, {
        id: deckId,
        name: deckType === "AP" ? "Anatomic Pathology" : "Clinical Pathology",
        type: deckType,
        categories: [],
        totalCards: 0,
      });
    }

    const deck = deckMap.get(deckId)!;
    let category = deck.categories.find((c) => c.id === categoryId);

    if (!category) {
      category = { id: categoryId, name: categoryName, cards: [], subcategories: [] };
      deck.categories.push(category);
    }

    category.cards.push(card);
    deck.totalCards++;

    if (subcategoryName) {
      const existingSubcat = category.subcategories.find((s) => s.name === subcategoryName);
      if (existingSubcat) {
        existingSubcat.cardCount++;
      } else {
        category.subcategories.push({ name: subcategoryName, cardCount: 1 });
      }
    }
  }

  return Array.from(deckMap.values());
}

/** Cards within a category that belong to a specific (normalized) subcategory. */
export function getSubcategoryCards(category: CategoryData, subcategory: string): AnkiCard[] {
  return category.cards.filter((card) => {
    const ankomaTag = card.tags.find((tag) => tag.startsWith("#ANKOMA::"));
    if (!ankomaTag) return false;
    const tagParts = ankomaTag.replace("#ANKOMA::", "").split("::");
    const rawCategoryName = tagParts[1];
    const subcatName = tagParts[2] ? formatTagName(tagParts[2], rawCategoryName) : null;
    return subcatName === subcategory;
  });
}

export interface DeckSidebarItem {
  id: string;
  name: string;
  type: "AP" | "CP";
  totalCards: number;
  categoryCount: number;
}

export function buildDeckSidebarData(organizedDecks: DeckData[]): DeckSidebarItem[] {
  return organizedDecks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    type: deck.type,
    totalCards: deck.totalCards,
    categoryCount: deck.categories.length,
  }));
}

export interface CategorySidebarItem {
  id: string;
  name: string;
  cardCount: number;
  subcategories: Array<{ name: string; cardCount: number }>;
}

export function buildCategorySidebarData(
  selectedDeck: DeckData | undefined
): CategorySidebarItem[] {
  return (
    selectedDeck?.categories
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        cardCount: cat.cards.length,
        subcategories: [...cat.subcategories].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)) || []
  );
}
