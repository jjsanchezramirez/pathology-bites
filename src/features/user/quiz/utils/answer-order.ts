/**
 * Answer-option ordering for quiz sessions.
 *
 * When a session has `config.shuffleAnswers` on, each question's options are
 * shuffled with a PRNG seeded from `sessionId + questionId`. The order is
 * therefore random across sessions but identical every time the same session
 * is loaded — the active quiz, a resumed quiz, review and results all go
 * through `quizService.getQuizSession`, so they all see the same order without
 * storing anything extra.
 *
 * Grading never depends on position: answers are stored and checked by option
 * id. Letter labels (A–E) follow the displayed order.
 */

interface OrderableOption {
  id: string;
  text?: string | null;
  order_index?: number | null;
}

// Options whose meaning depends on the others ("All of the above", "Both A and
// B", ...) must stay last, in their authored order. None exist in the bank as of
// Nov 2026; this keeps future ones safe.
const PINNED_OPTION_PATTERNS = [
  /\b(all|none|both|neither) of the (above|following|options|choices)\b/i,
  /^\s*(both|neither)\b/i,
  // The whole option is a letter combination, e.g. "A and C" or "(B) or (D) only".
  // Not a bare substring match: "A or B antigens" is an ordinary option.
  /^\s*(only\s+)?\(?[A-E]\)?\s*(,|and|&|or)\s*\(?[A-E]\)?(\s*only)?\s*\.?\s*$/i,
];

export function isPinnedOption(text: string | null | undefined): boolean {
  if (!text) return false;
  return PINNED_OPTION_PATTERNS.some((re) => re.test(text));
}

// cyrb53-style 32-bit string hash → seed.
function hashSeed(input: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

// mulberry32 PRNG: deterministic floats in [0, 1).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Authored order: order_index, then id as a stable tie-break. */
export function sortByAuthoredOrder<T extends OrderableOption>(options: T[]): T[] {
  return [...options].sort((a, b) => {
    const d = (a.order_index ?? 0) - (b.order_index ?? 0);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

/**
 * Returns the options in the order a session should display them.
 * Never mutates the input.
 */
export function orderOptionsForSession<T extends OrderableOption>(
  options: T[],
  sessionId: string,
  questionId: string,
  shuffle: boolean
): T[] {
  const authored = sortByAuthoredOrder(options);
  if (!shuffle || authored.length < 2) return authored;

  const movable = authored.filter((o) => !isPinnedOption(o.text));
  const pinned = authored.filter((o) => isPinnedOption(o.text));

  const rand = mulberry32(hashSeed(`${sessionId}:${questionId}`));
  for (let i = movable.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [movable[i], movable[j]] = [movable[j], movable[i]];
  }
  return [...movable, ...pinned];
}
