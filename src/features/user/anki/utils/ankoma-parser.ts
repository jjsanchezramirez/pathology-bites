// src/features/anki/utils/ankoma-parser.ts
// Thin orchestrator: parse ankoma.json into organized sections. Heavy lifting lives in
// the sibling modules (normalization, card-converter, image-utils).
import { AnkomaDeck, AnkomaSection, AnkomaData } from "../types/anki-card";
import { normalizeName, getMergeTarget, mergeSubsections } from "./ankoma-normalization";
import { convertNoteToCard } from "./ankoma-card-converter";

/**
 * Parse ankoma.json structure into organized sections
 */
export function parseAnkomaData(rawData: AnkomaDeck): AnkomaData {
  let totalCards = 0;

  function processDeck(deck: AnkomaDeck, path: string[] = []): AnkomaSection[] {
    // Normalize the deck name
    const normalizedName = normalizeName(deck.name, path);
    const currentPath = [...path, normalizedName];

    // Check if this path should be merged into another
    const mergeTarget = getMergeTarget(currentPath);
    const effectivePath = mergeTarget || currentPath;
    const effectiveName = effectivePath[effectivePath.length - 1];

    const processedSections: AnkomaSection[] = [];

    // Convert notes to cards
    const cards =
      deck.notes?.map((note, index) => convertNoteToCard(note, effectiveName, index)) || [];
    totalCards += cards.length;

    // Process subsections (children)
    let subsections: AnkomaSection[] = [];
    if (deck.children && deck.children.length > 0) {
      for (const child of deck.children) {
        const childSections = processDeck(child, effectivePath);
        subsections.push(...childSections);
      }
    }

    // Merge subsections with the same normalized name
    subsections = mergeSubsections(subsections);

    // Create section if it has cards or meaningful subsections
    if (cards.length > 0 || subsections.length > 0) {
      const section: AnkomaSection = {
        id: generateSectionId(effectivePath),
        name: effectiveName,
        path: effectivePath,
        cardCount: cards.length,
        cards,
        subsections,
      };
      processedSections.push(section);
    }

    return processedSections;
  }

  // Process the root deck
  let processedSections: AnkomaSection[] = [];
  if (rawData.children) {
    for (const child of rawData.children) {
      const childSections = processDeck(child);
      processedSections.push(...childSections);
    }
  }

  // Final merge pass for top-level sections
  processedSections = mergeSubsections(processedSections);

  return {
    sections: processedSections,
    totalCards,
    lastLoaded: new Date(),
  };
}

/**
 * Generate unique section ID from path
 */
function generateSectionId(path: string[]): string {
  return path
    .join("::")
    .toLowerCase()
    .replace(/[^a-z0-9:]/g, "-");
}
