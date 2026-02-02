// src/features/anki/services/anki-loader.ts
import { AnkiCard, AnkomaNote, AnkomaDeck } from "../types/anki-card";
import { ANKOMA_JSON_URL } from "@/shared/config/ankoma";

interface AnkomaJsonStructure {
  __type__: string;
  children: AnkomaDeck[];
  crowdanki_uuid: string;
  deck_config_uuid: string;
  deck_configurations: unknown[];
  desc: string;
  dyn: number;
  extendNew: number;
  extendRev: number;
  media_files: string[];
  name: string;
  note_models: Array<{
    crowdanki_uuid?: string;
    name: string;
    flds: { name: string; ord: number }[];
    tmpls: { name: string; qfmt: string; afmt: string }[];
    css: string;
  }>;
  notes: AnkomaNote[];
}

interface NoteModel {
  name: string;
  flds: { name: string; ord: number }[];
  tmpls: { name: string; qfmt: string; afmt: string }[];
  css: string;
}

let cachedAnkomaData: {
  cards: AnkiCard[];
  noteModels: Map<string, NoteModel>;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches and parses the ankoma.json file from R2
 */
export async function loadAnkomaData(): Promise<AnkiCard[]> {
  // Check cache
  if (cachedAnkomaData && Date.now() - cachedAnkomaData.timestamp < CACHE_DURATION) {
    return cachedAnkomaData.cards;
  }

  try {
    const response = await fetch(ANKOMA_JSON_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch ankoma.json: ${response.statusText}`);
    }

    const data: AnkomaJsonStructure = await response.json();

    // Build note models map
    const noteModels = new Map<string, NoteModel>();
    if (data.note_models) {
      for (const model of data.note_models) {
        noteModels.set(model.crowdanki_uuid || model.name, model);
      }
    }

    // Parse all cards from the deck structure
    const cards = parseAnkomaDeck(data, data.name, noteModels);

    // Cache the results
    cachedAnkomaData = {
      cards,
      noteModels,
      timestamp: Date.now(),
    };

    return cards;
  } catch (error) {
    console.error("Error loading ankoma data:", error);
    throw error;
  }
}

/**
 * Recursively parses a deck and its children to extract all cards
 */
function parseAnkomaDeck(
  deck: AnkomaDeck | AnkomaJsonStructure,
  deckPath: string,
  noteModels: Map<string, NoteModel>
): AnkiCard[] {
  const cards: AnkiCard[] = [];

  // Process notes in this deck
  if (deck.notes && deck.notes.length > 0) {
    for (const note of deck.notes) {
      const noteModel = noteModels.get(note.note_model_uuid);
      if (!noteModel) continue;

      // Build fields object
      const fieldsObj: Record<string, string> = {};
      noteModel.flds.forEach((fld, idx) => {
        fieldsObj[fld.name] = note.fields[idx] || "";
      });

      // Generate cards from templates
      noteModel.tmpls.forEach((template, ord) => {
        const card: AnkiCard = {
          id: `${note.guid}-${ord}`,
          cardId: 0, // Not available in CrowdAnki export
          noteId: parseInt(note.guid.substring(0, 13), 10) || 0, // Use first 13 chars of guid as noteId
          deckName: deckPath,
          modelName: noteModel.name,
          fields: fieldsObj,
          tags: note.tags || [],
          question: renderTemplate(template.qfmt, fieldsObj),
          answer: renderTemplate(template.afmt, fieldsObj),
          css: noteModel.css || "",
          interval: 0,
          due: 0,
          factor: 2500,
          reviews: 0,
          lapses: 0,
          left: 0,
          ord,
          type: 0,
          queue: 0,
          mod: 0,
          usn: 0,
          reps: 0,
          ease: 0,
        };
        cards.push(card);
      });
    }
  }

  // Process children decks
  if (deck.children && deck.children.length > 0) {
    for (const child of deck.children) {
      const childPath = `${deckPath}::${child.name}`;
      const childCards = parseAnkomaDeck(child, childPath, noteModels);
      cards.push(...childCards);
    }
  }

  return cards;
}

/**
 * Simple template renderer for Anki card templates
 */
function renderTemplate(template: string, fields: Record<string, string>): string {
  let result = template;

  // Replace field references {{FieldName}}
  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    const regex = new RegExp(`{{${fieldName}}}`, "g");
    result = result.replace(regex, fieldValue);
  }

  // Remove conditional tags {{#Field}}...{{/Field}}
  // Using a function-based approach to handle multiline content
  result = result.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, "$2");

  // Remove inverted conditional tags {{^Field}}...{{/Field}}
  result = result.replace(/{{^(\w+)}}[\s\S]*?{{\/\1}}/g, "");

  // Clean up any remaining template syntax
  result = result.replace(/{{[^}]+}}/g, "");

  return result;
}

/**
 * Searches for Anki cards by query string
 */
export async function searchAnkiCards(query: string): Promise<AnkiCard[]> {
  const cards = await loadAnkomaData();

  if (!query || query.trim() === "") {
    return cards.slice(0, 50); // Return first 50 cards if no query
  }

  const lowerQuery = query.toLowerCase();

  return cards
    .filter((card) => {
      // Search in fields
      const fieldsMatch = Object.values(card.fields).some((value) =>
        value.toLowerCase().includes(lowerQuery)
      );

      // Search in tags
      const tagsMatch = card.tags.some((tag) => tag.toLowerCase().includes(lowerQuery));

      // Search in deck name
      const deckMatch = card.deckName.toLowerCase().includes(lowerQuery);

      // Search in question/answer (stripped of HTML)
      const questionMatch = stripHtml(card.question).toLowerCase().includes(lowerQuery);
      const answerMatch = stripHtml(card.answer).toLowerCase().includes(lowerQuery);

      return fieldsMatch || tagsMatch || deckMatch || questionMatch || answerMatch;
    })
    .slice(0, 100); // Limit to 100 results
}

/**
 * Gets a specific Anki card by note ID
 */
export async function getAnkiCardByNoteId(noteId: number): Promise<AnkiCard | null> {
  const cards = await loadAnkomaData();
  return cards.find((card) => card.noteId === noteId) || null;
}

/**
 * Gets a specific Anki card by GUID
 */
export async function getAnkiCardByGuid(guid: string): Promise<AnkiCard | null> {
  const cards = await loadAnkomaData();
  // GUID might be the full card.id (guid-ord) or just the guid part
  return cards.find((card) => card.id === guid || card.id.startsWith(guid + "-")) || null;
}

/**
 * Gets all unique deck names
 */
export async function getAnkiDecks(): Promise<string[]> {
  const cards = await loadAnkomaData();
  const deckNames = new Set(cards.map((card) => card.deckName));
  return Array.from(deckNames).sort();
}

/**
 * Strips HTML tags and style blocks from a string
 */
function stripHtml(html: string): string {
  // Remove style tags and their content
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  // Remove script tags and their content
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  // Remove all HTML tags
  text = text.replace(/<[^>]*>/g, " ");
  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/**
 * Formats a card for display in search results
 */
export function formatCardForSearch(card: AnkiCard): {
  id: string;
  guid: string;
  noteId: number;
  deckName: string;
  preview: string;
  tags: string[];
  fields: Record<string, string>;
} {
  // Extract guid from card.id (format: "guid-ord")
  const guid = card.id.split("-")[0];

  return {
    id: card.id,
    guid: guid,
    noteId: card.noteId,
    deckName: card.deckName,
    preview: stripHtml(card.question).substring(0, 200),
    tags: card.tags,
    fields: card.fields,
  };
}
