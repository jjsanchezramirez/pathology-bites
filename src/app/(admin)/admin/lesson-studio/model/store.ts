// Editor store (zustand). Holds the Lesson document, selection, playhead time,
// mode, and a bounded undo/redo stack. Mutations push snapshots to history,
// with a drag-session bracket that coalesces rapid updates into a single entry.

import { create } from "zustand";
import type { Lesson, Slide, SlideElement, Framing, ImageElement } from "./types";
import { emptyLesson } from "./types";

const HISTORY_LIMIT = 50;

export type Selection = {
  slideId: string | null;
  elementIds: string[];
};

export type EditorMode = "edit" | "preview";

export type Tool =
  | "select"
  | "shape-rectangle"
  | "shape-circle"
  | "shape-oval"
  | "spotlight"
  | "arrow"
  | "text"
  | "svg"
  | "image"
  | "zoom"
  | "pan";

interface StoreState {
  lesson: Lesson;
  selection: Selection;
  viewTime: number;
  mode: EditorMode;
  tool: Tool;
  history: { past: Lesson[]; future: Lesson[] };
  dragSnapshot: Lesson | null;
  /** Element currently in inline-edit mode (e.g., contentEditable text). */
  editingElementId: string | null;
}

interface StoreActions {
  // Document
  setLesson: (lesson: Lesson) => void;
  setLessonMeta: (meta: Partial<Pick<Lesson, "id" | "title" | "description">>) => void;
  setAudio: (audio: Lesson["audio"]) => void;

  // Slides
  addSlide: (slide: Slide, atIndex?: number) => void;
  removeSlide: (slideId: string) => void;
  reorderSlides: (order: string[]) => void;
  updateSlide: (slideId: string, patch: Partial<Slide>) => void;
  setInitialFraming: (slideId: string, framing: Framing) => void;

  // Elements
  addElement: (slideId: string, element: SlideElement) => void;
  removeElement: (slideId: string, elementId: string) => void;
  updateElement: (slideId: string, elementId: string, patch: Partial<SlideElement>) => void;
  reorderElement: (slideId: string, fromIndex: number, toIndex: number) => void;

  // Selection & view
  selectSlide: (slideId: string | null) => void;
  selectElements: (slideId: string, elementIds: string[]) => void;
  clearSelection: () => void;
  setViewTime: (seconds: number) => void;
  setMode: (mode: EditorMode) => void;
  setTool: (tool: Tool) => void;
  startEditing: (elementId: string) => void;
  stopEditing: () => void;

  // History
  beginDrag: () => void;
  endDrag: () => void;
  undo: () => void;
  redo: () => void;

  // Internal
  _commit: (mutator: (lesson: Lesson) => Lesson) => void;
}

export type EditorStore = StoreState & StoreActions;

function cloneLesson(l: Lesson): Lesson {
  return typeof structuredClone === "function" ? structuredClone(l) : JSON.parse(JSON.stringify(l));
}

/**
 * Convert legacy `backgroundImageUrl` slides to image-as-element slides.
 * Inserts a full-canvas ImageElement at index 0 and clears the background field.
 * Idempotent: slides without `backgroundImageUrl` pass through unchanged.
 */
function migrateLessonBackgrounds(lesson: Lesson): Lesson {
  let changed = false;
  const slides = lesson.slides.map((slide) => {
    if (!slide.backgroundImageUrl) return slide;
    changed = true;
    const bgElement: ImageElement = {
      id: `image-bg-${slide.id}`,
      kind: "image",
      imageUrl: slide.backgroundImageUrl,
      rect: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
      opacity: 1,
      timing: {
        start: 0,
        fadeIn: 0,
        hold: Math.max(0.01, slide.duration),
        fadeOut: 0,
      },
    };
    return {
      ...slide,
      backgroundImageUrl: null,
      elements: [bgElement, ...slide.elements],
    };
  });
  return changed ? { ...lesson, slides } : lesson;
}

function pushHistory(past: Lesson[], snapshot: Lesson): Lesson[] {
  const next = [...past, snapshot];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  lesson: emptyLesson(),
  selection: { slideId: null, elementIds: [] },
  viewTime: 0,
  mode: "edit",
  tool: "select",
  history: { past: [], future: [] },
  dragSnapshot: null,
  editingElementId: null,

  // ---- Internal commit helper ------------------------------------------------

  _commit: (mutator) => {
    set((state) => {
      const prev = state.lesson;
      const next = mutator(prev);
      if (next === prev) return state;
      // If a drag session is active, don't push per-mutation snapshots.
      if (state.dragSnapshot) {
        return { ...state, lesson: next };
      }
      return {
        ...state,
        lesson: next,
        history: { past: pushHistory(state.history.past, prev), future: [] },
      };
    });
  },

  // ---- Document --------------------------------------------------------------

  setLesson: (lesson) => {
    const migrated = migrateLessonBackgrounds(lesson);
    set((state) => ({
      ...state,
      lesson: migrated,
      selection: { slideId: migrated.slides[0]?.id ?? null, elementIds: [] },
      viewTime: 0,
      history: { past: [], future: [] },
      dragSnapshot: null,
      editingElementId: null,
    }));
  },

  setLessonMeta: (meta) => {
    get()._commit((l) => ({ ...l, ...meta }));
  },

  setAudio: (audio) => {
    get()._commit((l) => ({ ...l, audio }));
  },

  // ---- Slides ----------------------------------------------------------------

  addSlide: (slide, atIndex) => {
    get()._commit((l) => {
      const slides = l.slides.slice();
      const idx = atIndex ?? slides.length;
      slides.splice(Math.max(0, Math.min(idx, slides.length)), 0, slide);
      return { ...l, slides };
    });
    set(() => ({ selection: { slideId: slide.id, elementIds: [] }, viewTime: 0 }));
  },

  removeSlide: (slideId) => {
    get()._commit((l) => ({
      ...l,
      slides: l.slides.filter((s) => s.id !== slideId),
    }));
    set((state) => {
      if (state.selection.slideId !== slideId) return state;
      const remaining = state.lesson.slides;
      return {
        ...state,
        selection: { slideId: remaining[0]?.id ?? null, elementIds: [] },
      };
    });
  },

  reorderSlides: (order) => {
    get()._commit((l) => {
      const byId = new Map(l.slides.map((s) => [s.id, s]));
      const next: Slide[] = [];
      for (const id of order) {
        const s = byId.get(id);
        if (s) next.push(s);
      }
      // Append any slides not mentioned (safety).
      for (const s of l.slides) if (!order.includes(s.id)) next.push(s);
      return { ...l, slides: next };
    });
  },

  updateSlide: (slideId, patch) => {
    get()._commit((l) => ({
      ...l,
      slides: l.slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s)),
    }));
  },

  setInitialFraming: (slideId, framing) => {
    get()._commit((l) => ({
      ...l,
      slides: l.slides.map((s) => (s.id === slideId ? { ...s, initialFraming: framing } : s)),
    }));
  },

  // ---- Elements --------------------------------------------------------------

  addElement: (slideId, element) => {
    get()._commit((l) => ({
      ...l,
      slides: l.slides.map((s) =>
        s.id === slideId ? { ...s, elements: [...s.elements, element] } : s
      ),
    }));
    set((state) => ({
      ...state,
      selection: { slideId, elementIds: [element.id] },
    }));
  },

  removeElement: (slideId, elementId) => {
    get()._commit((l) => ({
      ...l,
      slides: l.slides.map((s) =>
        s.id === slideId ? { ...s, elements: s.elements.filter((e) => e.id !== elementId) } : s
      ),
    }));
    set((state) => ({
      ...state,
      selection: {
        slideId: state.selection.slideId,
        elementIds: state.selection.elementIds.filter((id) => id !== elementId),
      },
    }));
  },

  updateElement: (slideId, elementId, patch) => {
    get()._commit((l) => ({
      ...l,
      slides: l.slides.map((s) =>
        s.id !== slideId
          ? s
          : {
              ...s,
              elements: s.elements.map((e) =>
                e.id === elementId ? ({ ...e, ...patch } as SlideElement) : e
              ),
            }
      ),
    }));
  },

  reorderElement: (slideId, fromIndex, toIndex) => {
    get()._commit((l) => ({
      ...l,
      slides: l.slides.map((s) => {
        if (s.id !== slideId) return s;
        const n = s.elements.length;
        if (
          fromIndex < 0 ||
          fromIndex >= n ||
          toIndex < 0 ||
          toIndex >= n ||
          fromIndex === toIndex
        ) {
          return s;
        }
        const next = s.elements.slice();
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return { ...s, elements: next };
      }),
    }));
  },

  // ---- Selection & view ------------------------------------------------------

  selectSlide: (slideId) => {
    set((state) => ({
      ...state,
      selection: { slideId, elementIds: [] },
      viewTime: 0,
    }));
  },

  selectElements: (slideId, elementIds) => {
    set((state) => ({ ...state, selection: { slideId, elementIds } }));
  },

  clearSelection: () => {
    set((state) => ({
      ...state,
      selection: { slideId: state.selection.slideId, elementIds: [] },
    }));
  },

  setViewTime: (seconds) => {
    set((state) => ({ ...state, viewTime: Math.max(0, seconds) }));
  },

  setMode: (mode) => {
    set((state) => ({ ...state, mode }));
  },

  setTool: (tool) => {
    set((state) => ({ ...state, tool }));
  },

  startEditing: (elementId) => {
    set((state) => ({ ...state, editingElementId: elementId }));
  },

  stopEditing: () => {
    set((state) => ({ ...state, editingElementId: null }));
  },

  // ---- History ---------------------------------------------------------------

  beginDrag: () => {
    set((state) => {
      if (state.dragSnapshot) return state;
      return { ...state, dragSnapshot: cloneLesson(state.lesson) };
    });
  },

  endDrag: () => {
    set((state) => {
      const snap = state.dragSnapshot;
      if (!snap) return state;
      const changed = JSON.stringify(snap) !== JSON.stringify(state.lesson);
      if (!changed) return { ...state, dragSnapshot: null };
      return {
        ...state,
        dragSnapshot: null,
        history: { past: pushHistory(state.history.past, snap), future: [] },
      };
    });
  },

  undo: () => {
    set((state) => {
      const past = state.history.past;
      if (past.length === 0) return state;
      const prev = past[past.length - 1];
      return {
        ...state,
        lesson: prev,
        history: {
          past: past.slice(0, -1),
          future: [state.lesson, ...state.history.future],
        },
      };
    });
  },

  redo: () => {
    set((state) => {
      const future = state.history.future;
      if (future.length === 0) return state;
      const next = future[0];
      return {
        ...state,
        lesson: next,
        history: {
          past: pushHistory(state.history.past, state.lesson),
          future: future.slice(1),
        },
      };
    });
  },
}));

// ---- Selectors (helpers for components) -----------------------------------

export const selectCurrentSlide = (state: EditorStore): Slide | null => {
  const id = state.selection.slideId;
  if (!id) return null;
  return state.lesson.slides.find((s) => s.id === id) ?? null;
};

export const selectCanUndo = (state: EditorStore): boolean => state.history.past.length > 0;
export const selectCanRedo = (state: EditorStore): boolean => state.history.future.length > 0;
