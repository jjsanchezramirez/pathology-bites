// Types + preset/default constants for the cell counter tool.

import type { SavedPreset } from "@/shared/config/user-settings-defaults";

export interface CellType {
  id: string;
  name: string;
  key: string;
  count: number;
  color: string;
}

export interface CounterSettings {
  countLimit: number;
  enableLimit: boolean;
  enableUndo: boolean;
  maxUndoHistory: number;
}

export interface CounterState {
  cellTypes: CellType[];
  settings: CounterSettings;
  undoHistory: CellType[][];
  isComplete: boolean;
  totalCount: number;
  presetType: "peripheral-blood" | "bone-marrow" | "custom";
  savedPresets: SavedPreset[];
}

// Peripheral Blood preset - no M:E ratio calculation
export const PERIPHERAL_BLOOD_CELL_TYPES: CellType[] = [
  { id: "pb1", name: "Segmented neutrophil", key: "k", count: 0, color: "bg-amber-600" },
  { id: "pb2", name: "Band neutrophil", key: "j", count: 0, color: "bg-rose-600" },
  { id: "pb3", name: "Lymphocyte", key: "l", count: 0, color: "bg-pink-600" },
  { id: "pb4", name: "Monocyte", key: ";", count: 0, color: "bg-indigo-600" },
  { id: "pb5", name: "Eosinophil", key: "n", count: 0, color: "bg-lime-600" },
  { id: "pb6", name: "Basophil", key: "m", count: 0, color: "bg-purple-600" },
];

// Bone Marrow preset - includes M:E ratio calculation
export const BONE_MARROW_CELL_TYPES: CellType[] = [
  { id: "bm1", name: "Blast", key: "t", count: 0, color: "bg-primary" },
  { id: "bm2", name: "Promyelocyte", key: "y", count: 0, color: "bg-blue-600" },
  { id: "bm3", name: "Myelocyte", key: "u", count: 0, color: "bg-emerald-600" },
  { id: "bm4", name: "Metamyelocyte", key: "h", count: 0, color: "bg-violet-600" },
  { id: "bm5", name: "Band neutrophil", key: "j", count: 0, color: "bg-rose-600" },
  { id: "bm6", name: "Segmented neutrophil", key: "k", count: 0, color: "bg-amber-600" },
  { id: "bm7", name: "Lymphocyte", key: "l", count: 0, color: "bg-pink-600" },
  { id: "bm8", name: "Monocyte", key: ";", count: 0, color: "bg-indigo-600" },
  { id: "bm9", name: "Plasma cell", key: "'", count: 0, color: "bg-teal-600" },
  { id: "bm10", name: "Macrophage", key: "/", count: 0, color: "bg-orange-600" },
  { id: "bm11", name: "Nucleated erythroid", key: "p", count: 0, color: "bg-cyan-600" },
  { id: "bm12", name: "Eosinophil", key: "n", count: 0, color: "bg-lime-600" },
  { id: "bm13", name: "Basophil", key: "m", count: 0, color: "bg-purple-600" },
  { id: "bm14", name: "Mast cell", key: "b", count: 0, color: "bg-slate-600" },
];

export const DEFAULT_CELL_TYPES = PERIPHERAL_BLOOD_CELL_TYPES;

export const DEFAULT_SETTINGS: CounterSettings = {
  countLimit: 100,
  enableLimit: true,
  enableUndo: true,
  maxUndoHistory: 50,
};

export const STORAGE_KEY = "pathology-bites-cell-counter";

export const CELL_COLORS = [
  "bg-primary",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-indigo-600",
  "bg-pink-600",
  "bg-teal-600",
  "bg-orange-600",
];
