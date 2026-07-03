// Normalize persisted sequence data into a canonical Lesson.
//
// The lesson is the single source of truth now. Older DB rows stored an
// ExplainerSequence with the editor Lesson embedded in `editorState.lesson`
// (or the legacy `editorState.selectedImages[0]`); we extract that. Rows with
// neither are unsupported legacy data (must be re-saved from the studio) and
// return null so callers can surface a friendly message. This replaces the old
// ~321-line keyframe reverse-engineering in from-sequence.ts.

import type { Lesson, Slide, SlideElement, ImageElement } from "./types";

export function isLessonShape(v: unknown): v is Lesson {
  if (!v || typeof v !== "object") return false;
  const l = v as { slides?: unknown; aspectRatio?: unknown };
  return Array.isArray(l.slides) && typeof l.aspectRatio === "string";
}

/** Convert legacy `backgroundImageUrl` slides to a full-canvas ImageElement. */
function migrateBackgrounds(lesson: Lesson): Lesson {
  let changed = false;
  const slides = lesson.slides.map((slide) => {
    const legacyUrl = (slide as unknown as Record<string, unknown>).backgroundImageUrl as
      | string
      | null;
    if (!legacyUrl) return slide;
    changed = true;
    const bgElement: ImageElement = {
      id: `image-bg-${slide.id}`,
      kind: "image",
      imageUrl: legacyUrl,
      rect: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
      opacity: 1,
      timing: { start: 0, fadeIn: 0, hold: Math.max(0.01, slide.duration), fadeOut: 0 },
    };
    const {
      backgroundImageUrl: _u,
      backgroundImageId: _i,
      backgroundImageAlt: _a,
      ...rest
    } = slide as Record<string, unknown> & Slide;
    return { ...rest, elements: [bgElement, ...slide.elements] } as Slide;
  });
  return changed ? { ...lesson, slides } : lesson;
}

/** Migrate legacy kind:"zoom"/"pan" elements to unified kind:"camera". */
function migrateCameras(lesson: Lesson): Lesson {
  let changed = false;
  const slides = lesson.slides.map((slide) => {
    const elements = slide.elements.map((el): SlideElement => {
      const raw = el as unknown as Record<string, unknown>;
      if (raw.kind === "zoom") {
        changed = true;
        return { ...el, kind: "camera", persistent: false } as SlideElement;
      }
      if (raw.kind === "pan") {
        changed = true;
        return { ...el, kind: "camera", persistent: true } as SlideElement;
      }
      return el;
    });
    return changed ? { ...slide, elements } : slide;
  });
  return changed ? { ...lesson, slides } : lesson;
}

/** Run all idempotent schema migrations on a Lesson. */
export function migrateLesson(lesson: Lesson): Lesson {
  return migrateCameras(migrateBackgrounds(lesson));
}

/**
 * Coerce raw stored `sequence_data` into a Lesson. Returns null when the row is
 * neither a Lesson nor a legacy ExplainerSequence carrying an embedded lesson.
 */
export function normalizeStoredLesson(raw: unknown): Lesson | null {
  if (isLessonShape(raw)) return migrateLesson(raw);
  const es = raw as
    | { editorState?: { lesson?: unknown; selectedImages?: unknown[] } }
    | null
    | undefined;
  const embedded = es?.editorState?.lesson ?? es?.editorState?.selectedImages?.[0];
  if (isLessonShape(embedded)) return migrateLesson(embedded);
  return null;
}
