// Pure helpers + constants for the WSI question generator.
// Extracted from wsi-question-generator.tsx so the repo-mapping, option labels,
// and token formatting are unit-testable in isolation (see *-utils.test.ts).

import { VirtualSlide } from "@/shared/types/virtual-slides";

// Funny loading messages shown while a question is generated.
export const LOADING_MESSAGES = [
  "Teaching AI the difference between normal and 'definitely not normal'...",
  "Consulting with virtual pathologists (they work for free)...",
  "Spinning the wheel of diagnostic confusion...",
  "Asking the slide what it wants to be when it grows up...",
  "Calibrating the microscope of artificial intelligence...",
  "Bribing the AI with virtual coffee for better questions...",
  "Translating 'pink and purple stuff' into medical terminology...",
  "Convincing the algorithm that everything isn't cancer...",
  "Teaching the computer to spot the needle in the histologic haystack...",
  "Generating questions that would make your attending proud...",
  "Channeling the spirit of Rudolf Virchow...",
  "Asking 'What would House MD diagnose?' (then ignoring the answer)...",
  "Consulting the ancient texts of Robbins and Cotran...",
  "Performing digital differential diagnosis dance...",
  "Summoning the ghost of pathology past...",
  "Teaching AI that 'it's probably fine' isn't a diagnosis...",
  "Convincing the computer that zebras do exist in pathology...",
  "Generating questions harder than your board exams...",
  "Asking the slide to reveal its deepest, darkest secrets...",
  "Calibrating the sarcasm detector for pathology humor...",
  "Teaching AI the fine art of 'consistent with'...",
  "Consulting with Dr. Google (but better)...",
  "Generating questions that won't make you cry... much...",
  "Teaching the algorithm about Wilson's disease (it's always Wilson's)...",
  "Asking 'Is it lupus?' (spoiler: it's never lupus in pathology)...",
  "Convincing AI that 'reactive changes' is a real diagnosis...",
  "Teaching the computer to appreciate the beauty of mitotic figures...",
  "Generating questions with just the right amount of existential dread...",
  "Consulting the pathology oracle (results may vary)...",
  "Teaching AI that 'atypical' means 'I have no idea'...",
];

export function getRepositoryFromId(id: string): string {
  const prefix = id.split("_")[0];
  const repoMap: Record<string, string> = {
    mgh: "MGH Pathology",
    hemepath: "Hematopathology eTutorial",
    rosai: "Rosai Collection",
    pathpresenter: "PathPresenter",
  };
  return repoMap[prefix] || prefix;
}

/** Ensure a slide has a `repository` field, deriving it from the id prefix if missing. */
export function ensureWSIRepository(wsi: VirtualSlide): VirtualSlide {
  if (!wsi.repository && wsi.id) {
    return { ...wsi, repository: getRepositoryFromId(wsi.id) };
  }
  return wsi;
}

/** Option label: the explicit id, else a letter by position (A, B, C, ...). */
export function getOptionLabel(id: string, index: number): string {
  return id || String.fromCharCode(65 + index);
}

export function formatTokenUsage(tokenUsage: { total_tokens?: number } | null | undefined): string {
  if (tokenUsage && typeof tokenUsage.total_tokens === "number") {
    return `${tokenUsage.total_tokens.toLocaleString()} tokens`;
  }
  return "Tokens: N/A";
}

/** Unique, non-empty, sorted category list from the loaded WSI data. */
export function extractCategories(wsiData: { category?: string | null }[]): string[] {
  return Array.from(new Set(wsiData.map((slide) => (slide.category || "").toString().trim())))
    .filter((val) => val.length > 0)
    .sort();
}
