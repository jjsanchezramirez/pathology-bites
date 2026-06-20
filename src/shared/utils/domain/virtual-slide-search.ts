// Pure virtual-slide search core — no React, no network, no module side effects
// at import time.
//
// Extracted verbatim from use-client-virtual-slides.ts so the ranking
// algorithm can be exercised IDENTICALLY by the production hook and the offline
// eval harness (dev/code/scripts/eval/). Both import this module — there is no
// second copy of the algorithm that can silently drift.
//
// Usage:
//   buildSearchIndex(slides)               — call once after slides load
//   await rankSlidesWithExpansion(list, q) — rank a (possibly filtered) list

import type { VirtualSlide } from "@/shared/types/virtual-slides";
import { extractOrganTerms, getOrganBoostScore, type OrganTerm } from "./organ-terms";
import { log } from "@/shared/utils/logging";

// Pre-computed search index for faster lookups
interface SearchIndexEntry {
  slide: VirtualSlide;
  diagnosisLower: string;
  diagnosisTokens: string[];
  diagnosisAcronym: string; // Generated first-letter acronym
  whoAcronyms: string[]; // WHO medical abbreviations (ERMS, ARMS, etc.)
  frequency: number; // Number of slides with this exact diagnosis (for ranking)
}

// Module-scope index state. Rebuilt by buildSearchIndex().
let searchIndex: SearchIndexEntry[] | null = null;

// Reverse index: word → Set of slide indices
// This allows us to check ONLY relevant slides instead of ALL slides
let reverseIndex: Map<string, Set<number>> | null = null;

// Diagnosis frequency map: diagnosisLower → count
// Used for ranking ambiguous WHO abbreviations
let diagnosisFrequencies: Map<string, number> | null = null;

// Abbreviation → full term(s), for query expansion. Tier 1 is built by
// buildSearchIndex from the dataset's own diagnosis parentheticals
// ("Angiomyolipoma (AML)"). Tier 2 (WHO scrape) merges in via a future setter.
let expansionMap: Map<string, Set<string>> | null = null;

// Simple helper functions for tokenization
// CRITICAL: Normalize punctuation (hyphens, slashes) BEFORE tokenization
// This ensures reverse index and scoring use the same tokens
// Example: "EBV-positive DLBCL" → ["ebv", "positive", "dlbcl"]
export function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[-\/]/g, " ") // normalize punctuation to spaces
      .match(/[a-z0-9]+/g) || []
  );
}

function makeAcr(words: string[]): string {
  return words.map((w) => w[0]).join("");
}

// Calculate Levenshtein distance between two strings
// Used for fuzzy matching (only for queries ≥8 chars with distance 1)
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Build the search index + reverse index from a normalized slide list.
// Call once after slides are loaded; safe to call again to rebuild.
export function buildSearchIndex(processedSlides: VirtualSlide[]): void {
  // STEP 1: Calculate diagnosis frequencies (for ranking ambiguous WHO abbreviations)
  diagnosisFrequencies = new Map();
  for (const slide of processedSlides) {
    const diagnosisLower = (slide.diagnosis || "").toLowerCase();
    diagnosisFrequencies.set(diagnosisLower, (diagnosisFrequencies.get(diagnosisLower) || 0) + 1);
  }

  // STEP 2: Pre-compute search index AND reverse index for O(1) lookups
  searchIndex = [];
  reverseIndex = new Map();

  for (let i = 0; i < processedSlides.length; i++) {
    const slide = processedSlides[i];
    const diagnosisLower = (slide.diagnosis || "").toLowerCase();
    const diagnosisTokens = tokenize(diagnosisLower);
    const diagnosisAcronym = makeAcr(diagnosisTokens);
    const frequency = diagnosisFrequencies.get(diagnosisLower) || 0;

    // Extract WHO acronyms (can be string or array)
    const whoAcronyms: string[] = [];
    if (slide.acronym) {
      if (Array.isArray(slide.acronym)) {
        whoAcronyms.push(...slide.acronym.map((a) => a.toLowerCase()));
      } else {
        whoAcronyms.push(slide.acronym.toLowerCase());
      }
    }

    searchIndex.push({
      slide,
      diagnosisLower,
      diagnosisTokens,
      diagnosisAcronym,
      whoAcronyms,
      frequency,
    });

    // Build reverse index: each word → set of slide indices
    for (const token of diagnosisTokens) {
      if (!reverseIndex.has(token)) {
        reverseIndex.set(token, new Set());
      }
      reverseIndex.get(token)!.add(i);

      // Also index prefixes (3+ chars) for prefix matching
      if (token.length >= 4) {
        const prefix = token.substring(0, 3);
        const prefixKey = `prefix:${prefix}`;
        if (!reverseIndex.has(prefixKey)) {
          reverseIndex.set(prefixKey, new Set());
        }
        reverseIndex.get(prefixKey)!.add(i);
      }
    }

    // Index first-letter acronym (fallback)
    if (diagnosisAcronym.length >= 2) {
      const acrKey = `acr:${diagnosisAcronym}`;
      if (!reverseIndex.has(acrKey)) {
        reverseIndex.set(acrKey, new Set());
      }
      reverseIndex.get(acrKey)!.add(i);
    }

    // Index WHO acronyms (HIGHEST PRIORITY!)
    for (const whoAcr of whoAcronyms) {
      if (whoAcr.length >= 2) {
        const whoKey = `who:${whoAcr}`;
        if (!reverseIndex.has(whoKey)) {
          reverseIndex.set(whoKey, new Set());
        }
        reverseIndex.get(whoKey)!.add(i);
      }
    }
  }

  // Tier 1: build the abbreviation expansion map from the dataset's own
  // diagnosis parentheticals — "Angiomyolipoma (AML)" → aml → "Angiomyolipoma".
  // A query that is an abbreviation is expanded to the full term by expandQuery.
  expansionMap = new Map();
  const abbrRe = /\(([A-Za-z][A-Za-z0-9'-]{2,11})\)/;
  for (const slide of processedSlides) {
    const d = (slide.diagnosis || "").replace(/<[^>]+>/g, "").trim();
    if (!d) continue;
    const m = d.match(abbrRe);
    if (!m || m.index === undefined || !/[A-Z]/.test(m[1])) continue;
    const before = d.slice(0, m.index).trim();
    if (before.length < 2 || before.length > 50) continue; // abbr must follow a term name
    const base = d
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    // reject malformed bases, and over-long ones (a canonical term is short;
    // long qualified phrases like "Metastatic … to the thyroid" make noisy
    // expansions that demote the real diagnosis)
    if (!/^[A-Za-z][A-Za-z0-9 ,'/.-]{2,39}$/.test(base)) continue;
    const key = m[1].toLowerCase();
    if (key === base.toLowerCase()) continue;
    if (!expansionMap.has(key)) expansionMap.set(key, new Set());
    expansionMap.get(key)!.add(base);
  }

  log.debug(
    `[VirtualSlides] 💾 Cached ${processedSlides.length} slides + reverse index (${reverseIndex.size} keys) + ${expansionMap.size} abbreviations in memory`
  );
}

// HIGHLY OPTIMIZED: Uses reverse index to check ONLY relevant slides.
// Operates on the module-level searchIndex; result filtering is the caller's job.
function rankSlidesByTerm(
  term: string,
  organContext?: OrganTerm[]
): Map<string, { slide: VirtualSlide; score: number; frequency?: number }> {
  const termLower = term.toLowerCase().trim();
  const words = tokenize(termLower);

  if (!searchIndex || !reverseIndex) {
    // Fallback if indices not ready
    return new Map();
  }

  const rankedSlides = new Map<
    string,
    { slide: VirtualSlide; score: number; frequency?: number }
  >();

  // Step 1: Find ALL candidate slide indices using reverse index
  const candidateIndices = new Set<number>();

  // CRITICAL: Multi-word queries need INTERSECTION (ALL terms match)
  // Single-word queries use UNION (cast wider net)
  const isMultiWordQuery = words.length > 1;

  if (isMultiWordQuery) {
    // MULTI-WORD: Only include slides that have ALL query terms
    // Example: "dlbcl ebv" → slides with BOTH "dlbcl" AND "ebv"

    // Collect sets for each word
    const wordSets: Set<number>[] = [];

    for (const word of words) {
      // Skip very short words (but allow 2-letter WHO acronyms like "FL", "HL")
      if (word.length < 2) continue;

      const wordSet = new Set<number>();

      // Check WHO acronyms (add to set, don't replace it)
      const whoIndices = reverseIndex.get(`who:${word}`);
      if (whoIndices) {
        whoIndices.forEach((idx) => wordSet.add(idx));
      }

      // Check regular word matches in diagnosis text (CRITICAL for multi-word!)
      // Allow 2-letter words in multi-word queries (e.g., "t cell", "b cell")
      const indices = reverseIndex.get(word);
      if (indices) {
        indices.forEach((idx) => wordSet.add(idx));
      }

      // Prefix match (3+ char words): ADDITIVE, not a fallback. A truncated or
      // mistyped word ("carcinom", "sarcom") would otherwise zero out the whole
      // multi-word intersection. It must be additive because a truncation can
      // coincidentally collide with one rare junk token (e.g. "sarcom" exists
      // as a typo in a single diagnosis) — gating on wordSet being empty would
      // then skip the prefix expansion and collapse the query to that 1 slide.
      // The prefix index keys the first 3 chars of every token ≥4 chars long.
      if (word.length >= 3) {
        const prefixIndices = reverseIndex.get(`prefix:${word.substring(0, 3)}`);
        if (prefixIndices) {
          prefixIndices.forEach((idx) => wordSet.add(idx));
        }
      }

      // Word matched nothing at all — DROP it from the intersection rather than
      // returning zero results. One unmatched word no longer wipes the whole
      // query — the remaining words still constrain the search.
      if (wordSet.size === 0) {
        continue;
      }

      wordSets.push(wordSet);
    }

    // Intersect all sets: keep only slides that appear in ALL sets
    if (wordSets.length > 0) {
      let intersection = wordSets[0];
      for (let i = 1; i < wordSets.length; i++) {
        intersection = new Set([...intersection].filter((idx) => wordSets[i].has(idx)));
      }
      intersection.forEach((idx) => candidateIndices.add(idx));

      // Only use first-letter acronym fallback if intersection found SOME results
      // This prevents false matches like "scc ebv" → "se" matching random diagnoses
      if (intersection.size > 0) {
        const acr = makeAcr(words);
        const acrIndices = reverseIndex.get(`acr:${acr}`);
        if (acrIndices) {
          acrIndices.forEach((idx) => candidateIndices.add(idx));
        }
      }
    }
  } else {
    // SINGLE-WORD: Use UNION (ANY match) for broader results
    const word = words[0];

    // Check WHO acronyms
    const whoIndices = reverseIndex.get(`who:${word}`);
    if (whoIndices) {
      whoIndices.forEach((idx) => candidateIndices.add(idx));
    }

    // Check word matches
    if (word.length >= 3) {
      const indices = reverseIndex.get(word);
      if (indices) {
        indices.forEach((idx) => candidateIndices.add(idx));
      }

      // Also check prefixes for single-word queries
      const prefix = word.substring(0, 3);
      const prefixIndices = reverseIndex.get(`prefix:${prefix}`);
      if (prefixIndices) {
        prefixIndices.forEach((idx) => candidateIndices.add(idx));
      }
    }
  }

  // Early exit if no candidates found
  if (candidateIndices.size === 0) {
    return rankedSlides;
  }

  // ============================================================================
  // SHORT QUERY FILTER: For 2-char queries, ONLY match WHO abbreviations
  // For 3-char queries, prefer WHO but fallback to normal search if no match
  // This prevents noise and leverages WHO as authoritative source
  // ============================================================================
  const isVeryShortQuery = termLower.length === 2; // Strict WHO-only for 2 chars
  const isShortQuery = termLower.length === 3; // Prefer WHO, fallback for 3 chars

  // Step 2: Score ONLY the candidate slides (much smaller set!)
  for (const idx of candidateIndices) {
    const entry = searchIndex[idx];
    const {
      slide: s,
      diagnosisLower: d,
      diagnosisTokens,
      diagnosisAcronym,
      whoAcronyms,
      frequency,
    } = entry;
    if (!d) continue;

    let score = 0;

    // WHO abbreviation match - check this first for short queries
    const isWhoMatch = whoAcronyms.some((acr) => words.includes(acr));

    // STRICT FILTER: 2-char queries ONLY match WHO abbreviations
    if (isVeryShortQuery) {
      if (!isWhoMatch) {
        continue; // Skip non-WHO matches for 2-char queries
      }

      // Calculate frequency bonus (max +5 points)
      const frequencyBonus = Math.min(frequency / 100, 5);

      // Single WHO acronym (specific diagnosis)
      if (whoAcronyms.length === 1) {
        score = 98 + frequencyBonus;
      }
      // Multiple WHO acronyms (generic diagnosis)
      else {
        const baseScore = 95 - Math.min(whoAcronyms.length, 10);
        score = baseScore + frequencyBonus;
      }
    }
    // PREFER WHO: 3-char queries prefer WHO matches but allow fallback
    else if (isShortQuery && isWhoMatch) {
      // Calculate frequency bonus (max +5 points)
      const frequencyBonus = Math.min(frequency / 100, 5);

      // Single WHO acronym (specific diagnosis)
      if (whoAcronyms.length === 1) {
        score = 98 + frequencyBonus;
      }
      // Multiple WHO acronyms (generic diagnosis)
      else {
        const baseScore = 95 - Math.min(whoAcronyms.length, 10);
        score = baseScore + frequencyBonus;
      }
    }
    // FULL SCORING FOR LONGER QUERIES (4+ characters) OR 3-CHAR FALLBACK
    else {
      // ========================================================================
      // MULTI-TERM DETECTION: Count how many query terms appear in diagnosis
      // This boosts results that contain ALL terms (e.g., "dlbcl + ebv")
      // ========================================================================
      let matchedTerms = 0;

      for (const word of words) {
        if (word.length < 2) continue;

        // Check if this word is a WHO acronym
        const isWhoTerm = whoAcronyms.includes(word);
        if (isWhoTerm) {
          matchedTerms++;
          continue;
        }

        // Check if word appears in diagnosis (as whole word or part of word)
        const wordRegex = new RegExp(`\\b${word}|${word}\\b`, "i");
        if (wordRegex.test(d)) {
          matchedTerms++;
        }
      }

      const multiTermBonus = words.length > 1 && matchedTerms === words.length ? 10 : 0;
      // ========================================================================

      // Score 100: exact diagnosis match
      if (d === termLower) {
        score = 100 + multiTermBonus;
      }
      // Score 95-103+: WHO acronym exact match with frequency bonus
      else if (isWhoMatch) {
        const frequencyBonus = Math.min(frequency / 100, 5);
        const hasOnlyOneAcronym = whoAcronyms.length === 1;
        const diagnosisContainsSearchTerm = words.some(
          (word) => word.length >= 4 && d.includes(word)
        );

        // Best: Single WHO acronym + diagnosis contains search term
        if (hasOnlyOneAcronym && diagnosisContainsSearchTerm) {
          score = 98 + frequencyBonus + multiTermBonus; // "Embryonal Rhabdomyosarcoma" with q:"ERMS"
        }
        // Good: Single WHO acronym (specific diagnosis)
        else if (hasOnlyOneAcronym) {
          score = 97 + frequencyBonus + multiTermBonus;
        }
        // OK: Multiple WHO acronyms (generic diagnosis like "Rhabdomyosarcoma")
        else {
          const baseScore = 95 - Math.min(whoAcronyms.length, 10);
          score = baseScore + frequencyBonus + multiTermBonus;
        }
      }
      // Score 90+: contains exact phrase
      else if (d.includes(termLower)) {
        score = 90 + multiTermBonus;
      }
      // Score 85+: WHO acronym partial match (query contains WHO acronym)
      else if (whoAcronyms.some((acr) => termLower.includes(acr))) {
        score = 85 + multiTermBonus;
      }
      // Score 70-80+: word-level matches
      else {
        let matchedWords = 0;
        for (const word of words) {
          if (word.length >= 3 && diagnosisTokens.includes(word)) {
            matchedWords++;
          }
        }

        if (matchedWords > 0) {
          score = 70 + (matchedWords / words.length) * 10 + multiTermBonus;
        }
        // Score 60+: first-letter acronym match
        else if (words.length >= 2 && makeAcr(words) === diagnosisAcronym) {
          score = 60 + multiTermBonus;
        }
        // Score 50: prefix match. The startsWith test is part of the else-if
        // CONDITION (not nested inside) so that a single-word query which
        // fails the prefix check falls through to the fuzzy branch below —
        // otherwise fuzzy is unreachable for every single-word query.
        else if (
          words.length === 1 &&
          words[0].length >= 3 &&
          diagnosisTokens.some((w) => w.startsWith(words[0]))
        ) {
          score = 50;
        }
        // Score 30: fuzzy match (≥8 chars, distance 1 only)
        // Only for long queries to be safe - avoids dangerous medical term confusion
        else if (termLower.length >= 8) {
          for (const diagWord of diagnosisTokens) {
            if (diagWord.length >= 8 && levenshteinDistance(diagWord, termLower) === 1) {
              score = 30;
              break;
            }
          }
        }
      }
    }

    if (score > 0) {
      const slideKey = s.id || s.diagnosis || Math.random().toString();

      // Apply organ context boost
      if (organContext && organContext.length > 0) {
        const organBoost = getOrganBoostScore(s, organContext);
        score *= organBoost;
      }

      rankedSlides.set(slideKey, { slide: s, score, frequency });
    }
  }

  return rankedSlides;
}

// Rank slides purely by organ-system relevance. Used for organ-only queries
// ("breast", "kidney") where extracting the organ term leaves no diagnosis
// text to search — returning the whole organ system beats returning nothing
// (or only the few diagnoses that happen to contain the organ word literally).
function rankSlidesByOrgan(
  organs: OrganTerm[]
): Map<string, { slide: VirtualSlide; score: number; frequency?: number }> {
  const ranked = new Map<string, { slide: VirtualSlide; score: number; frequency?: number }>();
  if (!searchIndex) return ranked;

  for (const entry of searchIndex) {
    const boost = getOrganBoostScore(entry.slide, organs);
    if (boost <= 1.0) continue; // slide is not in this organ system
    const slideKey = entry.slide.id || entry.slide.diagnosis || Math.random().toString();
    ranked.set(slideKey, { slide: entry.slide, score: boost, frequency: entry.frequency });
  }

  return ranked;
}

// NCI fallback removed - using only WHO acronyms embedded in dataset
// Simplified main ranking function
// Rank ONE query string — organ extraction + two-pass — returning the raw
// ranking map (pre-sort). Extracted so each query-expansion variant can be
// ranked and the results merged.
//
// Two passes: (1) the FULL query — preserves exact-diagnosis and literal
// multi-word matches even when the query contains an organ word, e.g. "renal
// cell carcinoma" stays an exact (score 100) match. (2) When an organ term was
// found, ALSO rank with the organ words removed (or, if nothing else remains,
// rank the whole organ system) — this surfaces diagnoses that name the organ
// differently, "kidney carcinoma" → "Renal cell carcinoma". Merged by max
// score, so pass 2 can only ADD recall, never demote a pass-1 match.
function rankOneQuery(
  query: string
): Map<string, { slide: VirtualSlide; score: number; frequency?: number }> {
  const term = query.toLowerCase().trim();
  const { organs, remainingQuery } = extractOrganTerms(query);
  const organContext = organs.length > 0 ? organs : undefined;
  const searchTerm = remainingQuery.trim();

  const ranked = rankSlidesByTerm(term, organContext);
  if (organContext) {
    const organPass =
      searchTerm && searchTerm !== term
        ? rankSlidesByTerm(searchTerm, organContext)
        : rankSlidesByOrgan(organContext);
    for (const [key, val] of organPass) {
      const existing = ranked.get(key);
      if (!existing || val.score > existing.score) ranked.set(key, val);
    }
  }
  return ranked;
}

// Expand a query into variants: the original, plus one variant per known
// abbreviation token replaced by its full term ("aml liver" → "angiomyolipoma
// liver"). Bounded so cost stays predictable.
const MAX_QUERY_VARIANTS = 6;
const EXPANSIONS_PER_ABBREVIATION = 4;
function expandQuery(term: string): string[] {
  if (!expansionMap || expansionMap.size === 0) return [term];
  const tokens = tokenize(term);
  const variants = [term];
  for (let i = 0; i < tokens.length && variants.length < MAX_QUERY_VARIANTS; i++) {
    const fullTerms = expansionMap.get(tokens[i]);
    if (!fullTerms) continue;
    let used = 0;
    for (const full of fullTerms) {
      if (used >= EXPANSIONS_PER_ABBREVIATION || variants.length >= MAX_QUERY_VARIANTS) break;
      variants.push([...tokens.slice(0, i), full, ...tokens.slice(i + 1)].join(" "));
      used++;
    }
  }
  return variants;
}

// Repository tiebreak for slides of EQUAL relevance (same score + frequency). Relevance always
// wins first; this only decides the order within a genuine tie (e.g. the dozens of repos that
// each have an exact "Follicular lymphoma" slide). Lower number = surfaced earlier:
//   0  WHO Blue Books — curated reference; should lead a perfect match.
//   1  Wirtualny / Leeds — tend to carry full cases (H&E + multiple IHCs).
//   2  MGH — full cases too (more cyto-heavy, so just below Wirtualny/Leeds).
//   3  everyone else — natural search/corpus order.
//   4  PathPresenter / Recut Club — not embeddable in the in-house viewer, so they trail.
const REPOSITORY_RANK_PRIORITY: Record<string, number> = {
  "WHO Blue Books Online": 0,
  "Wirtualny Mikroskop": 1,
  "Leeds University": 1,
  "MGH Pathology": 2,
  PathPresenter: 4,
  "Recut Club": 4,
};
const DEFAULT_REPOSITORY_RANK_PRIORITY = 3;
function repositoryRankPriority(repository: string | undefined): number {
  return REPOSITORY_RANK_PRIORITY[repository ?? ""] ?? DEFAULT_REPOSITORY_RANK_PRIORITY;
}

// Main ranking entry point. Expands WHO/clinical abbreviations, ranks every
// variant, and merges by max score.
export interface ScoredSlide {
  slide: VirtualSlide;
  score: number;
  frequency?: number;
}

export async function rankSlidesWithExpansion(
  slides: VirtualSlide[],
  query: string
): Promise<{
  slides: VirtualSlide[];
  expandedTerms: string[];
  method?: string;
  confidence?: number;
  topScore?: number;
  scoredSlides?: ScoredSlide[];
}> {
  const term = (query || "").toLowerCase().trim();
  if (!term) return { slides, expandedTerms: [] };

  const variants = expandQuery(term);
  const merged = new Map<string, ScoredSlide>();
  for (const variant of variants) {
    for (const [key, val] of rankOneQuery(variant)) {
      const existing = merged.get(key);
      if (!existing || val.score > existing.score) merged.set(key, val);
    }
  }

  // Sort by score (highest first), then frequency, then repository priority, then length.
  // Repository priority only breaks ties between equally-relevant slides — it never lets a
  // preferred repo outrank a better match (see REPOSITORY_RANK_PRIORITY).
  const sorted = Array.from(merged.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((a.frequency || 0) !== (b.frequency || 0)) {
      return (b.frequency || 0) - (a.frequency || 0);
    }
    const pa = repositoryRankPriority(a.slide.repository);
    const pb = repositoryRankPriority(b.slide.repository);
    if (pa !== pb) return pa - pb;
    return a.slide.diagnosis.length - b.slide.diagnosis.length;
  });
  const sortedSlides = sorted.map((item) => item.slide);

  // Filter results to the (possibly pre-filtered) input list
  const allowedSlideIds = new Set(slides.map((s) => s.id));
  const filteredSlides = sortedSlides.filter((slide) => allowedSlideIds.has(slide.id));
  const scoredSlides = sorted.filter((item) => allowedSlideIds.has(item.slide.id));

  // Top score reflects the highest-scoring slide present in the filtered output
  // (so callers gating on confidence see the score of the slide they'd actually
  // get back). Falls back to the unfiltered top score if filtering removed it.
  const topScore = scoredSlides[0]?.score ?? sorted[0]?.score;

  return {
    slides: filteredSlides,
    expandedTerms: variants.slice(1),
    method: "standard",
    topScore,
    scoredSlides,
  };
}
