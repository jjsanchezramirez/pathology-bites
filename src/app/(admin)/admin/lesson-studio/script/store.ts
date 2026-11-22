// Script studio store (zustand): the script lesson being edited, the selected
// scene and sentence, and undo/redo. Typing in one field coalesces into a
// single undo step.

import { create } from "zustand";
import {
  emptyBeat,
  emptyScene,
  emptyScriptLesson,
  newId,
  type Beat,
  type Scene,
  type ScriptLesson,
  type TemplateKind,
} from "@/shared/lesson/script/types";

const HISTORY_LIMIT = 60;
const COALESCE_MS = 900;

interface Selection {
  sceneId: string | null;
  beatId: string | null;
}

interface ScriptStudioState {
  lesson: ScriptLesson;
  selection: Selection;
  /** Sentence whose picture region is being drawn in the preview. */
  drawingBeatId: string | null;
  past: ScriptLesson[];
  future: ScriptLesson[];
  savedLesson: ScriptLesson | null;
  lastKey: string | null;
  lastAt: number;

  setLesson: (lesson: ScriptLesson, opts?: { clean?: boolean }) => void;
  markClean: () => void;
  /** Apply a change. Changes with the same `key` within a moment share one undo step. */
  change: (fn: (l: ScriptLesson) => ScriptLesson, key?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (sel: Partial<Selection>) => void;
  setDrawing: (beatId: string | null) => void;

  setMeta: (patch: Partial<Pick<ScriptLesson, "title" | "description" | "id">>) => void;
  addScene: (template: TemplateKind, afterSceneId?: string | null) => void;
  updateScene: (sceneId: string, patch: Partial<Scene>, key?: string) => void;
  removeScene: (sceneId: string) => void;
  moveScene: (sceneId: string, dir: -1 | 1) => void;
  duplicateScene: (sceneId: string) => void;
  addBeat: (sceneId: string, afterBeatId?: string | null) => string;
  updateBeat: (sceneId: string, beatId: string, patch: Partial<Beat>, key?: string) => void;
  removeBeat: (sceneId: string, beatId: string) => void;
  moveBeat: (sceneId: string, beatId: string, dir: -1 | 1) => void;
}

function mapScene(l: ScriptLesson, sceneId: string, fn: (s: Scene) => Scene): ScriptLesson {
  return { ...l, scenes: l.scenes.map((s) => (s.id === sceneId ? fn(s) : s)) };
}

function move<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

/** Drop undefined keys so cleared fields don't linger as `"key": undefined`. */
function clean<T extends object>(o: T): T {
  const out = { ...o };
  for (const k of Object.keys(out) as (keyof T)[]) if (out[k] === undefined) delete out[k];
  return out;
}

const initialLesson = emptyScriptLesson();

export const useScriptStudio = create<ScriptStudioState>((set, get) => ({
  lesson: initialLesson,
  selection: { sceneId: null, beatId: null },
  drawingBeatId: null,
  past: [],
  future: [],
  savedLesson: initialLesson,
  lastKey: null,
  lastAt: 0,

  setLesson: (lesson, opts) =>
    set({
      lesson,
      past: [],
      future: [],
      savedLesson: opts?.clean === false ? null : lesson,
      selection: { sceneId: lesson.scenes[0]?.id ?? null, beatId: null },
      drawingBeatId: null,
      lastKey: null,
    }),

  markClean: () => set({ savedLesson: get().lesson }),

  change: (fn, key) => {
    const { lesson, past, lastKey, lastAt } = get();
    const next = fn(lesson);
    if (next === lesson) return;
    const now = Date.now();
    const coalesce = !!key && key === lastKey && now - lastAt < COALESCE_MS;
    set({
      lesson: next,
      past: coalesce ? past : [...past, lesson].slice(-HISTORY_LIMIT),
      future: [],
      lastKey: key ?? null,
      lastAt: now,
    });
  },

  undo: () => {
    const { past, lesson, future } = get();
    if (!past.length) return;
    set({
      lesson: past[past.length - 1],
      past: past.slice(0, -1),
      future: [lesson, ...future].slice(0, HISTORY_LIMIT),
      lastKey: null,
    });
  },

  redo: () => {
    const { past, lesson, future } = get();
    if (!future.length) return;
    set({
      lesson: future[0],
      past: [...past, lesson].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      lastKey: null,
    });
  },

  select: (sel) => set({ selection: { ...get().selection, ...sel } }),
  setDrawing: (beatId) => set({ drawingBeatId: beatId }),

  setMeta: (patch) =>
    get().change((l) => ({ ...l, ...patch }), `meta:${Object.keys(patch).join()}`),

  addScene: (template, afterSceneId) => {
    const scene = emptyScene(template);
    get().change((l) => {
      const i = afterSceneId
        ? l.scenes.findIndex((s) => s.id === afterSceneId)
        : l.scenes.length - 1;
      const scenes = l.scenes.slice();
      scenes.splice(i + 1, 0, scene);
      return { ...l, scenes };
    });
    set({ selection: { sceneId: scene.id, beatId: scene.beats[0].id } });
  },

  updateScene: (sceneId, patch, key) =>
    get().change((l) => mapScene(l, sceneId, (s) => clean({ ...s, ...patch })), key),

  removeScene: (sceneId) =>
    get().change((l) =>
      l.scenes.length <= 1 ? l : { ...l, scenes: l.scenes.filter((s) => s.id !== sceneId) }
    ),

  moveScene: (sceneId, dir) =>
    get().change((l) => {
      const i = l.scenes.findIndex((s) => s.id === sceneId);
      return { ...l, scenes: move(l.scenes, i, dir) };
    }),

  duplicateScene: (sceneId) =>
    get().change((l) => {
      const i = l.scenes.findIndex((s) => s.id === sceneId);
      if (i < 0) return l;
      const src = l.scenes[i];
      const copy: Scene = {
        ...src,
        id: newId("scene"),
        beats: src.beats.map((b) => ({ ...b, id: newId("beat") })),
      };
      const scenes = l.scenes.slice();
      scenes.splice(i + 1, 0, copy);
      return { ...l, scenes };
    }),

  addBeat: (sceneId, afterBeatId) => {
    const beat = emptyBeat();
    get().change((l) =>
      mapScene(l, sceneId, (s) => {
        const i = afterBeatId ? s.beats.findIndex((b) => b.id === afterBeatId) : s.beats.length - 1;
        const beats = s.beats.slice();
        beats.splice(i + 1, 0, beat);
        return { ...s, beats };
      })
    );
    set({ selection: { sceneId, beatId: beat.id } });
    return beat.id;
  },

  updateBeat: (sceneId, beatId, patch, key) =>
    get().change(
      (l) =>
        mapScene(l, sceneId, (s) => ({
          ...s,
          beats: s.beats.map((b) => (b.id === beatId ? clean({ ...b, ...patch }) : b)),
        })),
      key
    ),

  removeBeat: (sceneId, beatId) =>
    get().change((l) =>
      mapScene(l, sceneId, (s) =>
        s.beats.length <= 1 ? s : { ...s, beats: s.beats.filter((b) => b.id !== beatId) }
      )
    ),

  moveBeat: (sceneId, beatId, dir) =>
    get().change((l) =>
      mapScene(l, sceneId, (s) => {
        const i = s.beats.findIndex((b) => b.id === beatId);
        return { ...s, beats: move(s.beats, i, dir) };
      })
    ),
}));

export const selectIsDirty = (s: ScriptStudioState) => s.savedLesson !== s.lesson;
