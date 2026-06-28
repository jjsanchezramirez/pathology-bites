// Pure logic extracted from the cell counter: config mapping, M:E ratio, key
// assignment, count reducers, and keyboard-action resolution. Unit-tested in
// isolation (see cell-counter-utils.test.ts).

import type { CounterConfig } from "@/shared/config/user-settings-defaults";
import type { CellType, CounterState } from "./cell-counter-data";
import { CELL_COLORS } from "./cell-counter-data";

export function extractConfig(state: CounterState): CounterConfig {
  return {
    cellTypes: state.cellTypes.map(({ id, name, key, color }) => ({ id, name, key, color })),
    settings: state.settings,
    presetType: state.presetType,
    savedPresets: state.savedPresets,
  };
}

export interface MeRatio {
  myeloidCount: number;
  erythroidCount: number;
  ratio: string;
}

const MYELOID_CELLS = [
  "Blast",
  "Promyelocyte",
  "Myelocyte",
  "Metamyelocyte",
  "Band neutrophil",
  "Segmented neutrophil",
  "Eosinophil",
  "Basophil",
  "Mast cell",
];
const ERYTHROID_CELLS = ["Nucleated erythroid"];

/** M:E (myeloid:erythroid) ratio — only for the bone-marrow preset, null otherwise. */
export function calculateMEratio(
  presetType: CounterState["presetType"],
  cellTypes: CellType[]
): MeRatio | null {
  if (presetType !== "bone-marrow") return null;

  const myeloidCount = cellTypes
    .filter((cell) => MYELOID_CELLS.includes(cell.name))
    .reduce((sum, cell) => sum + cell.count, 0);

  const erythroidCount = cellTypes
    .filter((cell) => ERYTHROID_CELLS.includes(cell.name))
    .reduce((sum, cell) => sum + cell.count, 0);

  if (erythroidCount === 0) return null;

  return { myeloidCount, erythroidCount, ratio: (myeloidCount / erythroidCount).toFixed(2) };
}

/**
 * Resolve the key for a new cell type: use the requested key, else auto-assign the
 * name's first letter, else the first free a–z0–9 key.
 */
export function assignCellKey(name: string, requestedKey: string, existingKeys: string[]): string {
  let assignedKey = requestedKey.trim().toLowerCase();
  if (!assignedKey) {
    const availableKeys = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
    const usedKeys = existingKeys.map((k) => k.toLowerCase());
    const firstLetter = name.trim()[0].toLowerCase();
    if (!usedKeys.includes(firstLetter)) {
      assignedKey = firstLetter;
    } else {
      assignedKey = availableKeys.find((key) => !usedKeys.includes(key)) || "0";
    }
  }
  return assignedKey;
}

export function pickCellColor(index: number): string {
  return CELL_COLORS[index % CELL_COLORS.length];
}

/**
 * Apply a +1/-1 count delta to the cell with `key`, recording undo history. Returns
 * the same state (no-op) for unknown keys or decrementing a zero count.
 */
export function applyCount(state: CounterState, key: string, delta: 1 | -1): CounterState {
  const cellIndex = state.cellTypes.findIndex((cell) => cell.key === key);
  if (cellIndex === -1) return state;

  const cell = state.cellTypes[cellIndex];
  if (delta < 0 && cell.count === 0) return state;

  let undoHistory = state.undoHistory;
  if (state.settings.enableUndo) {
    undoHistory = [...state.undoHistory, state.cellTypes];
    if (undoHistory.length > state.settings.maxUndoHistory) {
      undoHistory = undoHistory.slice(1);
    }
  }

  const newCellTypes = [...state.cellTypes];
  newCellTypes[cellIndex] = {
    ...cell,
    count: delta > 0 ? cell.count + 1 : Math.max(0, cell.count - 1),
  };

  return { ...state, cellTypes: newCellTypes, undoHistory };
}

/** Restore the previous cell snapshot from undo history (no-op when empty). */
export function applyUndo(state: CounterState): CounterState {
  if (state.undoHistory.length === 0) return state;
  return {
    ...state,
    cellTypes: state.undoHistory[state.undoHistory.length - 1],
    undoHistory: state.undoHistory.slice(0, -1),
  };
}

export type CounterKeyAction =
  | { type: "increment"; key: string }
  | { type: "decrement"; key: string }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "stop" }
  | null;

// Map shifted keys to their unshifted equivalents for special characters
const SHIFT_KEY_MAP: Record<string, string> = {
  ":": ";",
  '"': "'",
  "?": "/",
  L: "l",
  N: "n",
  M: "m",
  B: "b",
};

/** Translate a keydown into a counter action (or null if it isn't a recognized key). */
export function resolveKeyAction(
  event: { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  cellTypes: CellType[]
): CounterKeyAction {
  let effectiveKey = event.key;
  if (event.shiftKey && SHIFT_KEY_MAP[event.key]) {
    effectiveKey = SHIFT_KEY_MAP[event.key];
  } else {
    effectiveKey = event.key.toLowerCase();
  }

  const cellExists = cellTypes.some((cell) => cell.key === effectiveKey);

  if (event.shiftKey && cellExists) {
    return { type: "decrement", key: effectiveKey };
  }
  if (cellExists && !event.shiftKey) {
    return { type: "increment", key: effectiveKey };
  }

  switch (effectiveKey) {
    case "escape":
      return { type: "stop" };
    case "z":
      if (event.ctrlKey || event.metaKey) return { type: "undo" };
      break;
    case "backspace":
      return { type: "undo" };
    case "r":
      if (event.ctrlKey || event.metaKey) return { type: "reset" };
      break;
  }
  return null;
}
