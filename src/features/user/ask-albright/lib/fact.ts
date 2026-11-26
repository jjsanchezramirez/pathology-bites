/**
 * "Tell me something" — the pure half of the random-fact reply (kb-fact.ts
 * does the reads).
 *
 * A bare request for something to learn used to be declined as off-topic
 * ("I can only help with pathology questions"), after the planner had spent
 * tokens deciding so. It now gets one WHO sentence from the knowledge base,
 * chosen without any model call: the reply is the source's own words, so it
 * cannot be made up, and it is cited like any answer.
 */
import { normalizeQuestion } from "./router";

/**
 * Whole-message matches only: "tell me something about CD30" is a real
 * question and goes to the planner. Kept narrow on purpose — a false positive
 * swaps an answer for a trivia card.
 */
const FACT_REQUEST =
  /^(?:(?:please|pls|ok|okay|hi|hey|hello)[, ]+)?(?:(?:can|could|would) you |will you )?(?:tell|teach|show|give) me (?:something|anything|a (?:random |fun |cool |quick |interesting )?(?:pathology )?fact|a (?:random |fun |cool |quick )?pearl)(?: (?:new|interesting|cool|fun|random))?(?: please| pls)?$|^(?:a |any )?(?:random|fun|cool|quick) (?:pathology )?(?:fact|pearl)(?: please| pls)?$|^surprise me(?: please| pls)?$|^(?:i'?m|i am) bored$|^did you know$|^something (?:interesting|random|new)$/;

export function isFactRequest(question: string): boolean {
  const q = normalizeQuestion(question).replace(/[!?.,]+$/, "");
  return q.length <= 60 && FACT_REQUEST.test(q);
}

/** A picked tumour name as stored in marker_key_tumours, without its "(87%)" / "(variable)" tail. */
export function pickedName(raw: string): string {
  return raw.replace(/\s*\((?:\d+(?:\.\d+)?%|variable|loss)\)\s*$/i, "").trim();
}

/** The quote without WHO's inline reference braces ("{16861966}") and doubled spaces. */
export function cleanQuote(quote: string): string {
  return quote
    .replace(/\s*\{[^{}]*\}/g, "")
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Whether a quote reads as a standalone fact: a whole sentence (capital
 * start, full stop), short enough for a card, long enough to say something.
 * Fragments ("and a rearrangement involving 10q24 in a…") and sentences that
 * lean on the one before ("also", "They…") are skipped.
 */
export function quoteStandsAlone(quote: string): boolean {
  const q = cleanQuote(quote);
  return (
    /^[A-Z]/.test(q) &&
    /\.$/.test(q) &&
    q.length >= 50 &&
    q.length <= 240 &&
    // Leans on the sentence before it: "CD38 … are also positive", "They may…".
    !/\balso\b/i.test(q) &&
    !/^(?:They|It|These|This|Both|Such|Its|Their|In addition|Additionally|However)\b/.test(q)
  );
}

/** Entity names carry a few chapter-title tails the reader doesn't need. */
export function displayName(name: string): string {
  return name.replace(/:\s*general overview$/i, "").trim();
}

/** The card text: the tumour, then WHO's sentence, cited [1]. */
export function factAnswer(entity: string, quote: string): string {
  return `**Did you know?** In ${displayName(entity)}: “${cleanQuote(quote)}” [1]\n\nAsk me about any diagnosis, stain or finding.`;
}

/** Two next questions that lead from the fact into a real answer. */
export function factFollowUps(entity: string, marker: string): string[] {
  return [
    `Which tumours are ${marker} positive?`,
    `What is the IHC profile of ${displayName(entity)}?`,
  ];
}

/** Uniform pick; `rand` is injectable for tests. */
export function pickOne<T>(items: readonly T[], rand: () => number = Math.random): T | undefined {
  return items.length ? items[Math.floor(rand() * items.length)] : undefined;
}
