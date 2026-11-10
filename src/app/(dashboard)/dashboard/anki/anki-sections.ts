// Per-category publishing of the Ankoma deck.
//
// The full deck is ~16 MB of JSON (1.9 MB brotli) and every card in it used to
// be converted on page load, although a study session only ever opens one
// category. Instead the publisher (dev/scripts/anki/publish-ankoma-sections.ts)
// splits the deck into:
//
//   anki/index-<hash>.json.br            decks + categories + counts (a few KB)
//   anki/sections/<slug>-<hash>.json.br  one file per sidebar category
//   anki/card-ids-<hash>.json.br         card id → category, for ?cardId= links
//
// A category file is the original deck tree PRUNED to that category's notes:
// the same parser runs on it, so card conversion stays in the app. Two things
// make the result identical to parsing the full deck:
//   - each kept note carries `_index`, its position in its source deck node,
//     because the parser derives card numbers/fallback ids from that position;
//   - `order` lists the category's card ids as a full parse orders them, since
//     section merging can reorder a pruned tree.
// buildAnkomaSections() verifies that identity for every category and throws
// if any differs, so a publish cannot ship a category that renders differently.

import type { AnkiCard, AnkomaDeck, AnkomaNote } from "@/features/user/anki/types/anki-card";
import { parseAnkomaData } from "@/features/user/anki/utils/ankoma-parser";
import {
  organizeDecks,
  placeByTags,
  isIgnoredCard,
  summarizeDecks,
  type DeckSummary,
} from "./anki-data";

/** One category's slice of the deck. */
export interface AnkomaCategoryFile {
  v: 1;
  categoryId: string;
  /** Card ids in the order a full-deck parse gives them. */
  order: string[];
  /** The deck tree pruned to this category's notes. */
  deck: AnkomaDeck;
}

export interface PublishedFile {
  url: string;
  hash: string;
  bytes: number;
}

/** The small file the page loads first. */
export interface AnkomaIndex {
  v: 1;
  generatedAt: string;
  totalCards: number;
  decks: DeckSummary[];
  /** categoryId → its category file */
  categories: Record<string, PublishedFile>;
  /** card id → categoryId map, fetched only for ?cardId= deep links */
  cardIds: PublishedFile;
}

/** Copy of the deck tree keeping only notes that pass `keep`, with `_index` set. */
export function pruneDeck(deck: AnkomaDeck, keep: (note: AnkomaNote) => boolean): AnkomaDeck {
  const walk = (node: AnkomaDeck): AnkomaDeck | null => {
    const notes = (node.notes || [])
      .map((note, i) => ({ note, i }))
      .filter(({ note }) => keep(note))
      .map(({ note, i }) => ({ ...note, _index: note._index ?? i }));
    const children = (node.children || []).map(walk).filter((c): c is AnkomaDeck => c !== null);
    if (notes.length === 0 && children.length === 0) return null;
    return { __type__: node.__type__, name: node.name, children, notes };
  };
  // Keep the root even when empty: the parser only walks root.children.
  return walk(deck) ?? { __type__: deck.__type__, name: deck.name, children: [], notes: [] };
}

/**
 * Turn a category file into that category's cards, exactly as the page needs
 * them. This is the ONLY path the page uses, and the one the publisher verifies.
 */
export function cardsFromCategoryFile(file: AnkomaCategoryFile): AnkiCard[] {
  const decks = organizeDecks(parseAnkomaData(file.deck));
  const category = decks.flatMap((d) => d.categories).find((c) => c.id === file.categoryId);
  if (!category) return [];
  const position = new Map(file.order.map((id, i) => [id, i]));
  return [...category.cards].sort(
    (a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity)
  );
}

/** Find the category of a deep-linked card id (exact id, or `<guid>-…` card ids). */
export function findCategoryForCardId(
  cardIds: Record<string, string>,
  cardId: string
): string | null {
  if (cardIds[cardId]) return cardIds[cardId];
  const prefix = `${cardId}-`;
  for (const [id, categoryId] of Object.entries(cardIds)) {
    if (id.startsWith(prefix)) return categoryId;
  }
  return null;
}

export interface BuiltSections {
  decks: DeckSummary[];
  totalCards: number;
  files: Map<string, AnkomaCategoryFile>;
  cardIds: Record<string, string>;
}

/** A card minus the fields the converter stamps with Date.now() on every parse. */
function stable(card: AnkiCard): Omit<AnkiCard, "due" | "mod"> {
  const { due: _due, mod: _mod, ...rest } = card;
  return rest;
}

/** Split a full CrowdAnki deck into per-category files and verify each one. */
export function buildAnkomaSections(deck: AnkomaDeck): BuiltSections {
  const full = organizeDecks(parseAnkomaData(deck));
  const files = new Map<string, AnkomaCategoryFile>();
  const cardIds: Record<string, string> = {};
  let totalCards = 0;

  for (const category of full.flatMap((d) => d.categories)) {
    const file: AnkomaCategoryFile = {
      v: 1,
      categoryId: category.id,
      order: category.cards.map((c) => c.id),
      deck: pruneDeck(deck, (note) => placeByTags(note.tags)?.categoryId === category.id),
    };

    const rebuilt = cardsFromCategoryFile(file).map(stable);
    const expected = category.cards.map(stable);
    if (JSON.stringify(rebuilt) !== JSON.stringify(expected)) {
      const at = rebuilt.findIndex((c, i) => JSON.stringify(c) !== JSON.stringify(expected[i]));
      throw new Error(
        `Category file for "${category.id}" does not reproduce the full-deck cards ` +
          `(${rebuilt.length} vs ${category.cards.length} cards, first difference at #${at}).`
      );
    }

    files.set(category.id, file);
    totalCards += category.cards.length;
    for (const card of category.cards) {
      if (!isIgnoredCard(card.id)) cardIds[card.id] = category.id;
    }
  }

  return { decks: summarizeDecks(full), totalCards, files, cardIds };
}

/** Stable, URL-safe file stem for a category id, e.g. "AP::Bone & Soft Tissue" → "ap-bone-soft-tissue". */
export function categorySlug(categoryId: string): string {
  return categoryId
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
