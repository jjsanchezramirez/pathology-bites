// Pipeline intermediate types for AI lesson generation.

import type { ImageInput } from "../generate-sequence/prompt";

// ---------------------------------------------------------------------------
// Request / response
// ---------------------------------------------------------------------------

export interface SvgInput {
  url: string;
  name: string;
  assetId?: string;
}

export interface GenerateLessonRequest {
  images: ImageInput[];
  svgs?: SvgInput[];
  transcript: string;
  audioDuration: number;
  audioUrl: string;
  audioTitle?: string;
}

// ---------------------------------------------------------------------------
// Pass 1: Transcript analysis
// ---------------------------------------------------------------------------

export interface TranscriptSegment {
  /** Portion of transcript text */
  text: string;
  /** Topic or theme of this segment */
  topic: string;
  /** Word count (computed deterministically, not by AI) */
  wordCount: number;
}

export type TextSlideInsertionPurpose = "title" | "summary" | "transition" | "definition";

export interface TextSlideInsertion {
  /** Insert after this transcript segment index */
  afterSegmentIndex: number;
  purpose: TextSlideInsertionPurpose;
  suggestedTitle: string;
  suggestedBullets?: string[];
}

export interface TranscriptAnalysis {
  segments: TranscriptSegment[];
  suggestedTextSlideInsertions: TextSlideInsertion[];
  /** Short episode title, 2-4 words, title case (e.g. "Castleman Disease") */
  episodeTitle: string;
  /** One sentence describing the lesson theme */
  overallTheme: string;
}

// ---------------------------------------------------------------------------
// Pass 3: Lesson plan (simplified — ordering + text slides only)
// ---------------------------------------------------------------------------

export interface PlannedTextSlide {
  type: "text-only";
  /** Insert position: index into the image order where this slide appears */
  insertBeforeImage: number;
  title: string;
  bullets: string[];
  backgroundColor: string;
  /** Duration in seconds (3-6) */
  duration: number;
}

export interface PlannedSvgPlacement {
  /** Index into the svgs array from the request */
  svgIndex: number;
  /** Which image slide to place this on (index into imageOrder), or "text" for a text slide */
  onSlide: number;
  /** Position as % of canvas */
  position: { x: number; y: number };
  /** Width as % of canvas (default 15) */
  widthPercent?: number;
}

export interface LessonPlan {
  /** Ordered image indices — maps images to transcript segments in order */
  imageOrder: number[];
  /** Text-only slides to insert between image slides */
  textSlides: PlannedTextSlide[];
  /** Where to place user-provided SVGs */
  svgPlacements: PlannedSvgPlacement[];
}
