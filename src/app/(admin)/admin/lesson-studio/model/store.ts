// Editor store (zustand). Holds the Lesson document, selection, playhead time,
// mode, and a bounded undo/redo stack. Mutations push snapshots to history,
// with a drag-session bracket that coalesces rapid updates into a single entry.

import { create } from "zustand";
import type { Lesson, Slide, SlideElement, Framing, ImageElement } from "./types";
import { newBlankLesson } from "./slide-factory";

const HISTORY_LIMIT = 50;

/**
 * History entry: a Lesson snapshot paired with the snapshot id that was
 * current when the snapshot was taken. Carrying the id alongside the lesson
 * lets undo/redo restore the correct `currentSnapshotId`, so comparing it to
 * `savedSnapshotId` gives a correct `isDirty` even after undo-to-saved.
 */
type HistoryEntry = { lesson: Lesson; id: number };

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
  history: { past: HistoryEntry[]; future: HistoryEntry[] };
  dragSnapshot: Lesson | null;
  /** Snapshot id captured at the start of the current drag session. */
  dragSnapshotId: number;
  /** Whether any mutations occurred during the current drag session. */
  dragMutated: boolean;
  /** Element currently in inline-edit mode (e.g., contentEditable text). */
  editingElementId: string | null;
  /**
   * Monotonic counter bumped on every committed mutation and on setLesson.
   * Used with `savedSnapshotId` to derive `isDirty` in a way that correctly
   * clears when the user undoes back to the last-saved state.
   */
  currentSnapshotId: number;
  /** Snapshot id that was current at the time of the last markClean/setLesson. */
  savedSnapshotId: number;
  /** True when the lesson has unsaved changes (derived from snapshot ids). */
  isDirty: boolean;
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

  // Dirty tracking
  markClean: () => void;

  // Internal
  _commit: (mutator: (lesson: Lesson) => Lesson) => void;
}

export type EditorStore = StoreState & StoreActions;

function cloneLesson(l: Lesson): Lesson {
  return structuredClone(l);
}

/**
 * Convert legacy `backgroundImageUrl` slides (from old DB records) to
 * image-as-element slides. Inserts a full-canvas ImageElement at index 0
 * and strips the legacy field. Idempotent for already-migrated slides.
 */
function migrateLessonBackgrounds(lesson: Lesson): Lesson {
  let changed = false;
  const slides = lesson.slides.map((slide) => {
    // Legacy field may still exist on data loaded from DB.
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
      timing: {
        start: 0,
        fadeIn: 0,
        hold: Math.max(0.01, slide.duration),
        fadeOut: 0,
      },
    };
    // Strip legacy fields and insert the image element.
    const { backgroundImageUrl: _, backgroundImageId: _2, backgroundImageAlt: _3, ...rest } =
      slide as Record<string, unknown> & Slide;
    return {
      ...rest,
      elements: [bgElement, ...slide.elements],
    } as Slide;
  });
  return changed ? { ...lesson, slides } : lesson;
}

function pushHistory(past: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...past, entry];
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

const INITIAL_LESSON = newBlankLesson();

export const useEditorStore = create<EditorStore>((set, get) => ({
  lesson: INITIAL_LESSON,
  selection: { slideId: INITIAL_LESSON.slides[0]?.id ?? null, elementIds: [] },
  viewTime: 0,
  mode: "edit",
  tool: "select",
  history: { past: [], future: [] },
  dragSnapshot: null,
  dragSnapshotId: 0,
  dragMutated: false,
  editingElementId: null,
  currentSnapshotId: 0,
  savedSnapshotId: 0,
  isDirty: false,

  // ---- Internal commit helper ------------------------------------------------

  _commit: (mutator) => {
    set((state) => {
      const prev = state.lesson;
      const next = mutator(prev);
      if (next === prev) return state;
      const prevId = state.currentSnapshotId;
      const nextId = prevId + 1;
      // If a drag session is active, don't push per-mutation snapshots.
      // We still bump the snapshot id so isDirty tracks in-flight edits.
      if (state.dragSnapshot) {
        return {
          ...state,
          lesson: next,
          currentSnapshotId: nextId,
          isDirty: nextId !== state.savedSnapshotId,
          dragMutated: true,
        };
      }
      return {
        ...state,
        lesson: next,
        currentSnapshotId: nextId,
        isDirty: nextId !== state.savedSnapshotId,
        history: {
          past: pushHistory(state.history.past, { lesson: prev, id: prevId }),
          future: [],
        },
      };
    });
  },

  // ---- Document --------------------------------------------------------------

  setLesson: (lesson) => {
    const migrated = migrateLessonBackgrounds(lesson);
    set((state) => {
      const nextId = state.currentSnapshotId + 1;
      return {
        ...state,
        lesson: migrated,
        selection: { slideId: migrated.slides[0]?.id ?? null, elementIds: [] },
        viewTime: 0,
        history: { past: [], future: [] },
        dragSnapshot: null,
        dragSnapshotId: 0,
        dragMutated: false,
        editingElementId: null,
        currentSnapshotId: nextId,
        savedSnapshotId: nextId,
        isDirty: false,
      };
    });
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

  // ---- Dirty tracking --------------------------------------------------------

  markClean: () => {
    set((state) => ({
      ...state,
      savedSnapshotId: state.currentSnapshotId,
      isDirty: false,
    }));
  },

  // ---- History ---------------------------------------------------------------

  beginDrag: () => {
    set((state) => {
      if (state.dragSnapshot) return state;
      return {
        ...state,
        dragSnapshot: cloneLesson(state.lesson),
        dragSnapshotId: state.currentSnapshotId,
        dragMutated: false,
      };
    });
  },

  endDrag: () => {
    set((state) => {
      const snap = state.dragSnapshot;
      if (!snap) return state;
      if (!state.dragMutated) {
        return { ...state, dragSnapshot: null, dragSnapshotId: 0, dragMutated: false };
      }
      return {
        ...state,
        dragSnapshot: null,
        dragSnapshotId: 0,
        dragMutated: false,
        history: {
          past: pushHistory(state.history.past, {
            lesson: snap,
            id: state.dragSnapshotId,
          }),
          future: [],
        },
      };
    });
  },

  undo: () => {
    set((state) => {
      const past = state.history.past;
      if (past.length === 0) return state;
      const prev = past[past.length - 1];
      const currentEntry: HistoryEntry = {
        lesson: state.lesson,
        id: state.currentSnapshotId,
      };
      return {
        ...state,
        lesson: prev.lesson,
        currentSnapshotId: prev.id,
        isDirty: prev.id !== state.savedSnapshotId,
        history: {
          past: past.slice(0, -1),
          future: [currentEntry, ...state.history.future],
        },
      };
    });
  },

  redo: () => {
    set((state) => {
      const future = state.history.future;
      if (future.length === 0) return state;
      const next = future[0];
      const currentEntry: HistoryEntry = {
        lesson: state.lesson,
        id: state.currentSnapshotId,
      };
      return {
        ...state,
        lesson: next.lesson,
        currentSnapshotId: next.id,
        isDirty: next.id !== state.savedSnapshotId,
        history: {
          past: pushHistory(state.history.past, currentEntry),
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
