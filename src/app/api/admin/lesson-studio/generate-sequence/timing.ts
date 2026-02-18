import type { CaptionChunk } from "@/shared/types/explainer";
import type { ImageInput } from "./prompt";

// ---------------------------------------------------------------------------
// Caption-to-image timing scorer
//
// Given N images and a timed caption transcript, this module determines the
// absolute startTime/endTime (in seconds) for each image segment by finding
// where in the narration the speaker shifts to describing each image.
//
// Algorithm:
//   1. Tokenise each image's title+description into a set of keywords.
//   2. For each caption chunk, score it against each image's keyword set.
//   3. Walk the caption timeline and find the transition point where the
//      dominant image changes from image[i] to image[i+1].
//   4. Return hard [startTime, endTime] pairs in absolute seconds.
// ---------------------------------------------------------------------------

export interface SegmentTiming {
  startTime: number;
  endTime: number;
}

// ---------------------------------------------------------------------------
// Tokenise helpers
// ---------------------------------------------------------------------------

/** Medical stopwords — common words that carry no discriminating signal */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "is",
  "it",
  "to",
  "with",
  "that",
  "this",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "on",
  "was",
  "were",
  "which",
  "will",
  "its",
  "also",
  "can",
  "may",
  "more",
  "these",
  "they",
  "their",
  "there",
  "been",
  "both",
  "but",
  "not",
  "so",
  "some",
  "such",
  "than",
  "then",
  "type",
  "form",
  "variant",
  "image",
  "shows",
  "show",
  "shown",
  "showing",
  "see",
  "note",
  "here",
  "example",
  "case",
]);

/**
 * Tokenise text into a normalised set of meaningful keywords.
 * - Lowercased
 * - Split on non-alphanumeric boundaries
 * - Stopwords removed
 * - Min length 3
 */
export function tokenise(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

/**
 * Jaccard-like overlap score between two token sets.
 * Returns 0–1 (1 = identical, 0 = no overlap).
 */
export function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const t of a) {
    if (b.has(t)) hits++;
  }
  // Use the smaller set as denominator — rewards precision
  return hits / Math.min(a.size, b.size);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Build keyword sets for each image from its title and description.
 */
export function buildImageKeywordSets(images: ImageInput[]): Set<string>[] {
  return images.map((img) => tokenise(`${img.title} ${img.description}`));
}

/**
 * Score each caption chunk against each image's keyword set.
 * Returns a 2D array: scores[captionIndex][imageIndex]
 */
export function scoreCaptionsAgainstImages(
  captions: CaptionChunk[],
  imageKeywords: Set<string>[]
): number[][] {
  return captions.map((caption) => {
    const captionTokens = tokenise(caption.text);
    return imageKeywords.map((imgTokens) => overlapScore(captionTokens, imgTokens));
  });
}

// ---------------------------------------------------------------------------
// Transition detection
// ---------------------------------------------------------------------------

/**
 * Given per-caption scores, find the caption index at which the narration
 * transitions from image[i] to image[i+1].
 *
 * Strategy:
 *   - Smooth scores with a small rolling window to reduce noise.
 *   - Walk forward from the midpoint of each image's expected range.
 *   - The transition is where image[i+1]'s cumulative score first exceeds
 *     image[i]'s cumulative score in a window of captions.
 *   - Clamp to ensure minimum segment duration.
 */
function smoothScores(scores: number[], windowSize: number): number[] {
  return scores.map((_, i) => {
    const half = Math.floor(windowSize / 2);
    const from = Math.max(0, i - half);
    const to = Math.min(scores.length - 1, i + half);
    const slice = scores.slice(from, to + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

/**
 * For each image boundary (i → i+1), find the caption index that best marks
 * the transition point. Returns an array of caption indices (length = N-1).
 */
export function findTransitionCaptionIndices(
  scores: number[][], // [captionIdx][imageIdx]
  numImages: number
): number[] {
  const numCaptions = scores.length;
  const transitions: number[] = [];

  for (let boundary = 0; boundary < numImages - 1; boundary++) {
    const leftImg = boundary;
    const rightImg = boundary + 1;

    // Extract per-caption scores for each side of the boundary
    const leftScores = scores.map((row) => row[leftImg]);
    const rightScores = scores.map((row) => row[rightImg]);

    // Smooth to reduce single-caption noise
    const smoothLeft = smoothScores(leftScores, 3);
    const smoothRight = smoothScores(rightScores, 3);

    // Search window: from 1/N of the way through to (N+1)/N
    // (each image gets roughly 1/N of the total captions)
    const searchFrom = Math.floor((boundary / numImages) * numCaptions);
    const searchTo = Math.min(
      numCaptions - 1,
      Math.floor(((boundary + 2) / numImages) * numCaptions)
    );

    let bestIdx = Math.floor((searchFrom + searchTo) / 2); // fallback: midpoint
    let bestDelta = -Infinity;

    for (let ci = searchFrom; ci <= searchTo; ci++) {
      // We want the point where right score rises above left score most sharply
      const delta = smoothRight[ci] - smoothLeft[ci];
      if (delta > bestDelta) {
        bestDelta = delta;
        bestIdx = ci;
      }
    }

    transitions.push(bestIdx);
  }

  return transitions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Minimum segment duration in seconds — prevents degenerate zero-length segments */
const MIN_SEGMENT_DURATION = 1.5;

/**
 * Compute absolute startTime/endTime for each image segment.
 *
 * @param images     Ordered list of images (title + description used for matching)
 * @param captions   Timed caption chunks (absolute start/end in seconds)
 * @param totalDuration  Total audio duration in seconds
 * @returns          Array of { startTime, endTime } in absolute seconds, length === images.length
 */
export function computeSegmentTimings(
  images: ImageInput[],
  captions: CaptionChunk[],
  totalDuration: number
): SegmentTiming[] {
  if (images.length === 0) return [];
  if (images.length === 1) return [{ startTime: 0, endTime: totalDuration }];
  if (captions.length === 0) {
    // No captions — equal split
    const perImage = totalDuration / images.length;
    return images.map((_, i) => ({
      startTime: Math.round(i * perImage * 100) / 100,
      endTime: Math.round((i + 1) * perImage * 100) / 100,
    }));
  }

  const imageKeywords = buildImageKeywordSets(images);
  const captionScores = scoreCaptionsAgainstImages(captions, imageKeywords);
  const transitionIndices = findTransitionCaptionIndices(captionScores, images.length);

  // Build timings from transition caption indices
  // Transition at captionIndex[k] means image[k+1] starts at captions[k].end
  const timings: SegmentTiming[] = [];
  let cursor = 0;

  for (let i = 0; i < images.length; i++) {
    const start = cursor;
    let end: number;

    if (i === images.length - 1) {
      // Last image always ends at totalDuration
      end = totalDuration;
    } else {
      const transIdx = transitionIndices[i];
      // Transition happens at the end of the transition caption
      end = captions[transIdx]?.end ?? totalDuration;
    }

    // Clamp: ensure minimum duration and no overlap
    const minEnd = start + MIN_SEGMENT_DURATION;
    // Also ensure there's room for all remaining images
    const remainingImages = images.length - i - 1;
    const maxEnd = totalDuration - remainingImages * MIN_SEGMENT_DURATION;
    end = Math.max(minEnd, Math.min(maxEnd, end));

    // Round to 2dp
    timings.push({
      startTime: Math.round(start * 100) / 100,
      endTime: Math.round(end * 100) / 100,
    });
    cursor = end;
  }

  return timings;
}
