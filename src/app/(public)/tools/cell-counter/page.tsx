"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import {
  Plus,
  Minus,
  RotateCcw,
  Settings,
  Keyboard,
  Target,
  CheckCircle,
  Trash2,
  Download,
  Hash,
  FileText,
  Table,
  Save,
} from "lucide-react";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { KeyboardVisualizer } from "@/shared/components/common/keyboard-visualizer";
import { toast } from "@/shared/utils/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { useCounterSync } from "./use-counter-sync";
import type { CounterConfig, SavedPreset } from "@/shared/config/user-settings-defaults";

interface CellType {
  id: string;
  name: string;
  key: string;
  count: number;
  color: string;
}

interface CounterSettings {
  countLimit: number;
  enableLimit: boolean;
  enableUndo: boolean;
  maxUndoHistory: number;
}

interface CounterState {
  cellTypes: CellType[];
  settings: CounterSettings;
  undoHistory: CellType[][];
  isComplete: boolean;
  totalCount: number;
  presetType: "peripheral-blood" | "bone-marrow" | "custom";
  savedPresets: SavedPreset[];
}

// Peripheral Blood preset - no M:E ratio calculation
const PERIPHERAL_BLOOD_CELL_TYPES: CellType[] = [
  { id: "pb1", name: "Segmented neutrophil", key: "k", count: 0, color: "bg-amber-600" },
  { id: "pb2", name: "Band neutrophil", key: "j", count: 0, color: "bg-rose-600" },
  { id: "pb3", name: "Lymphocyte", key: "l", count: 0, color: "bg-pink-600" },
  { id: "pb4", name: "Monocyte", key: ";", count: 0, color: "bg-indigo-600" },
  { id: "pb5", name: "Eosinophil", key: "n", count: 0, color: "bg-lime-600" },
  { id: "pb6", name: "Basophil", key: "m", count: 0, color: "bg-purple-600" },
];

// Bone Marrow preset - includes M:E ratio calculation
const BONE_MARROW_CELL_TYPES: CellType[] = [
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

const DEFAULT_CELL_TYPES = PERIPHERAL_BLOOD_CELL_TYPES;

const DEFAULT_SETTINGS: CounterSettings = {
  countLimit: 100,
  enableLimit: true,
  enableUndo: true,
  maxUndoHistory: 50,
};

const STORAGE_KEY = "pathology-bites-cell-counter";

function extractConfig(state: CounterState): CounterConfig {
  return {
    cellTypes: state.cellTypes.map(({ id, name, key, color }) => ({ id, name, key, color })),
    settings: state.settings,
    presetType: state.presetType,
    savedPresets: state.savedPresets,
  };
}

export default function CellCounterPage() {
  const [state, setState] = useState<CounterState>({
    cellTypes: DEFAULT_CELL_TYPES,
    settings: DEFAULT_SETTINGS,
    undoHistory: [],
    isComplete: false,
    totalCount: 0,
    presetType: "peripheral-blood",
    savedPresets: [],
  });

  const [newCellName, setNewCellName] = useState("");
  const [newCellKey, setNewCellKey] = useState("");
  const [isCountingActive, setIsCountingActive] = useState(false);
  const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSavedConfigRef = useRef<string>("");

  const { serverConfig, isLoadingServer, isAuthenticated, saveConfigToServer } = useCounterSync();

  // Calculate total count
  const totalCount = state.cellTypes.reduce((sum, cell) => sum + cell.count, 0);

  // Check if counting is complete
  const isComplete = state.settings.enableLimit && totalCount >= state.settings.countLimit;

  // Calculate M:E ratio only for Bone Marrow preset - wrapped in useCallback to avoid dependency issues
  const calculateMEratio = useCallback(() => {
    if (state.presetType !== "bone-marrow") return null;

    const myeloidCells = [
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

    const erythroidCells = ["Nucleated erythroid"];

    const myeloidCount = state.cellTypes
      .filter((cell) => myeloidCells.includes(cell.name))
      .reduce((sum, cell) => sum + cell.count, 0);

    const erythroidCount = state.cellTypes
      .filter((cell) => erythroidCells.includes(cell.name))
      .reduce((sum, cell) => sum + cell.count, 0);

    if (erythroidCount === 0) return null;

    return {
      myeloidCount,
      erythroidCount,
      ratio: (myeloidCount / erythroidCount).toFixed(2),
    };
  }, [state.presetType, state.cellTypes]);

  const meRatio = calculateMEratio();

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedState = JSON.parse(saved);
        setState((prevState) => ({
          ...prevState,
          ...parsedState,
          savedPresets: parsedState.savedPresets ?? [],
          undoHistory: [], // Don't restore undo history
          isComplete: false,
        }));
      }
    } catch {
      // Failed to load saved state - will use defaults
    }
  }, []);

  // When authenticated and server config loads, override local config but preserve counts
  useEffect(() => {
    if (isLoadingServer || !isAuthenticated || !serverConfig) return;

    // Initialize the lastSavedConfigRef so the first save doesn't re-sync unchanged config
    lastSavedConfigRef.current = JSON.stringify(serverConfig);

    setState((prev) => {
      const countMap = new Map(prev.cellTypes.map((ct) => [ct.id, ct.count]));
      const cellTypesWithCounts = serverConfig.cellTypes.map((ct) => ({
        ...ct,
        count: countMap.get(ct.id) ?? 0,
      }));

      return {
        ...prev,
        cellTypes: cellTypesWithCounts,
        settings: serverConfig.settings,
        presetType: serverConfig.presetType,
        savedPresets: serverConfig.savedPresets ?? [],
      };
    });
  }, [isLoadingServer, isAuthenticated, serverConfig]);

  // Save state to localStorage and sync config to server when config changes
  const saveState = useCallback(
    (newState: CounterState) => {
      try {
        const stateToSave = {
          cellTypes: newState.cellTypes,
          settings: newState.settings,
          presetType: newState.presetType,
          savedPresets: newState.savedPresets,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch {
        // Failed to save state - operation will continue
      }

      // Only sync config to server when config changes (not on count increments)
      const config = extractConfig(newState);
      const configJson = JSON.stringify(config);
      if (configJson !== lastSavedConfigRef.current) {
        lastSavedConfigRef.current = configJson;
        saveConfigToServer(config);
      }
    },
    [saveConfigToServer]
  );

  // Update state and save
  const updateState = useCallback(
    (updater: (prev: CounterState) => CounterState) => {
      setState((prev) => {
        const newState = updater(prev);
        saveState(newState);
        return newState;
      });
    },
    [saveState]
  );

  // Save current config as a named preset
  const saveCurrentPreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) {
      toast.error("Please enter a preset name");
      return;
    }
    if (state.savedPresets.length >= 3) {
      toast.error("Maximum 3 saved presets");
      return;
    }
    const newPreset: SavedPreset = {
      id: crypto.randomUUID(),
      name,
      cellTypes: extractConfig(state).cellTypes,
      settings: state.settings,
    };
    updateState((prev) => ({
      ...prev,
      savedPresets: [...prev.savedPresets, newPreset],
    }));
    setPresetName("");
    setIsSavePresetOpen(false);
    toast.success(`Preset saved: ${name}`);
  }, [presetName, state, updateState]);

  // Load a saved preset
  const loadPreset = useCallback(
    (preset: SavedPreset) => {
      updateState((prev) => ({
        ...prev,
        cellTypes: preset.cellTypes.map((ct) => ({ ...ct, count: 0 })),
        settings: preset.settings,
        presetType: "custom",
        undoHistory: [],
      }));
      toast.success(`Preset loaded: ${preset.name}`);
    },
    [updateState]
  );

  // Delete a saved preset
  const deletePreset = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        savedPresets: prev.savedPresets.filter((p) => p.id !== id),
      }));
      toast.success("Preset removed");
    },
    [updateState]
  );

  // Add cell type
  const addCellType = useCallback(() => {
    if (!newCellName.trim()) {
      toast.error("Please enter cell name");
      return;
    }

    if (state.cellTypes.length >= 20) {
      toast.error("Maximum 20 cell types allowed");
      return;
    }

    // Auto-assign key if not provided (mobile case)
    let assignedKey = newCellKey.trim().toLowerCase();
    if (!assignedKey) {
      // Try first letter of cell name, then available letters
      const availableKeys = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
      const usedKeys = state.cellTypes.map((cell) => cell.key.toLowerCase());

      // Try first letter of name first
      const firstLetter = newCellName.trim()[0].toLowerCase();
      if (!usedKeys.includes(firstLetter)) {
        assignedKey = firstLetter;
      } else {
        // Find first available key
        assignedKey = availableKeys.find((key) => !usedKeys.includes(key)) || "0";
      }
    }

    const keyExists = state.cellTypes.some((cell) => cell.key.toLowerCase() === assignedKey);
    if (keyExists) {
      toast.error("Key already in use");
      return;
    }

    const colors = [
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

    const newCell: CellType = {
      id: Date.now().toString(),
      name: newCellName.trim(),
      key: assignedKey,
      count: 0,
      color: colors[state.cellTypes.length % colors.length],
    };

    updateState((prev) => ({
      ...prev,
      cellTypes: [...prev.cellTypes, newCell],
      presetType: "custom",
    }));

    setNewCellName("");
    setNewCellKey("");
    // toast.success(`Added ${newCell.name} (${newCell.key})`)
  }, [newCellName, newCellKey, state.cellTypes, updateState]);

  // Remove cell type
  const removeCellType = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        cellTypes: prev.cellTypes.filter((cell) => cell.id !== id),
      }));
      // toast.success('Cell type removed')
    },
    [updateState]
  );

  // Increment cell count
  const incrementCell = useCallback(
    (key: string) => {
      if (isComplete) {
        return; // Don't show toast for key presses when limit reached
      }

      const cellIndex = state.cellTypes.findIndex((cell) => cell.key === key);
      if (cellIndex === -1) return;

      // Save current state to undo history
      if (state.settings.enableUndo) {
        updateState((prev) => {
          const newUndoHistory = [...prev.undoHistory, prev.cellTypes];
          if (newUndoHistory.length > prev.settings.maxUndoHistory) {
            newUndoHistory.shift();
          }

          const newCellTypes = [...prev.cellTypes];
          newCellTypes[cellIndex] = {
            ...newCellTypes[cellIndex],
            count: newCellTypes[cellIndex].count + 1,
          };

          return {
            ...prev,
            cellTypes: newCellTypes,
            undoHistory: newUndoHistory,
          };
        });
      } else {
        updateState((prev) => {
          const newCellTypes = [...prev.cellTypes];
          newCellTypes[cellIndex] = {
            ...newCellTypes[cellIndex],
            count: newCellTypes[cellIndex].count + 1,
          };
          return {
            ...prev,
            cellTypes: newCellTypes,
          };
        });
      }

      // No toast for individual key presses - removed for better UX
    },
    [state.cellTypes, state.settings, isComplete, updateState]
  );

  // Decrement specific cell count
  const decrementCell = useCallback(
    (key: string) => {
      const cellIndex = state.cellTypes.findIndex((cell) => cell.key === key);
      if (cellIndex === -1) return;

      const cell = state.cellTypes[cellIndex];
      if (cell.count === 0) return;

      // Save current state to undo history
      if (state.settings.enableUndo) {
        updateState((prev) => {
          const newUndoHistory = [...prev.undoHistory, prev.cellTypes];
          if (newUndoHistory.length > prev.settings.maxUndoHistory) {
            newUndoHistory.shift();
          }

          const newCellTypes = [...prev.cellTypes];
          newCellTypes[cellIndex] = {
            ...newCellTypes[cellIndex],
            count: Math.max(0, newCellTypes[cellIndex].count - 1),
          };

          return {
            ...prev,
            cellTypes: newCellTypes,
            undoHistory: newUndoHistory,
          };
        });
      } else {
        updateState((prev) => {
          const newCellTypes = [...prev.cellTypes];
          newCellTypes[cellIndex] = {
            ...newCellTypes[cellIndex],
            count: Math.max(0, newCellTypes[cellIndex].count - 1),
          };
          return {
            ...prev,
            cellTypes: newCellTypes,
          };
        });
      }
    },
    [state.cellTypes, state.settings, updateState]
  );

  // Undo last action
  const undoLastAction = useCallback(() => {
    if (state.undoHistory.length === 0) {
      toast.error("Nothing to undo");
      return;
    }

    updateState((prev) => ({
      ...prev,
      cellTypes: prev.undoHistory[prev.undoHistory.length - 1],
      undoHistory: prev.undoHistory.slice(0, -1),
    }));

    // toast.success('Undone last action')
  }, [state.undoHistory, updateState]);

  // Reset all counts
  const resetCounts = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      cellTypes: prev.cellTypes.map((cell) => ({ ...cell, count: 0 })),
      undoHistory: [],
    }));
    // toast.success('All counts reset')
  }, [updateState]);

  // Copy results (Epic-friendly RTF table + plain text fallback)
  const exportResults = useCallback(
    async (format: "text" | "excel" = "excel") => {
      if (totalCount === 0) {
        toast.error("No data to export");
        return;
      }

      const escapeRtf = (value: string) =>
        value
          .replace(/\\/g, "\\\\")
          .replace(/{/g, "\\{")
          .replace(/}/g, "\\}")
          // RTF uses \par for line breaks.
          .replace(/\r\n|\r|\n/g, "\\par ");

      const filteredCells = state.cellTypes.filter((cell) => cell.count > 0);

      if (format === "excel") {
        // Epic: ensure the clipboard contains a real RTF table (text/rtf) + a plain-text fallback.
        try {
          // Build data rows with Excel HTML format
          let dataRows = "";

          // Add header row
          dataRows += ` <tr height=21 style='height:16.0pt'>
  <td height=21 class=xl65 width=175 style='height:16.0pt;width:131pt' data-t=s data-v="Cell Type">Cell Type</td>
  <td class=xl65 width=53 style='width:40pt' data-t=s data-v=Count>Count</td>
  <td class=xl65 width=93 style='width:70pt' data-t=s data-v=Percentage>Percentage</td>
 </tr>\n`;

          // Add data rows
          filteredCells.forEach((cell) => {
            const percentage = ((cell.count / totalCount) * 100).toFixed(2) + "%";
            dataRows += ` <tr height=21 style='height:16.0pt'>
  <td height=21 class=xl65 style='height:16.0pt' data-t=s data-v="${cell.name}">${cell.name}</td>
  <td class=xl66 align=right data-t=n data-v=${cell.count}>${cell.count}</td>
  <td class=xl67 align=right data-t=s data-v="${percentage}">${percentage}</td>
 </tr>\n`;
          });

          // Add total row
          dataRows += ` <tr height=21 style='height:16.0pt'>
  <td height=21 class=xl65 style='height:16.0pt' data-t=s data-v="Total Count">Total Count</td>
  <td class=xl66 align=right data-t=n data-v=${totalCount}>${totalCount}</td>
  <td class=xl68 align=right data-t=s data-v="">100%</td>
 </tr>\n`;

          // Add M:E ratio if bone marrow preset
          if (state.presetType === "bone-marrow") {
            const ratio = calculateMEratio();
            if (ratio) {
              dataRows += ` <tr height=21 style='height:16.0pt'>
  <td height=21 class=xl65 style='height:16.0pt' data-t=s data-v="M:E Ratio">M:E Ratio</td>
  <td class=xl66 align=right data-t=s data-v="${ratio.ratio}:1">${ratio.ratio}:1</td>
  <td class=xl67 align=right data-t=s data-v="(${ratio.myeloidCount}:${ratio.erythroidCount})">(${ratio.myeloidCount}:${ratio.erythroidCount})</td>
 </tr>\n`;
            }
          }

          // Create complete Excel HTML format matching Microsoft Office structure
          const _excelHtml = `<html xmlns:v="urn:schemas-microsoft-com:vml"
xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel"
xmlns="http://www.w3.org/TR/REC-html40">

<head>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<meta name=ProgId content=Excel.Sheet>
<meta name=Generator content="Microsoft Excel 15">
<style>
<!--table
	{mso-displayed-decimal-separator:"\.";
	mso-displayed-thousand-separator:"\,";}
@page
	{margin:.75in .7in .75in .7in;
	mso-header-margin:.3in;
	mso-footer-margin:.3in;}
tr
	{mso-height-source:auto;}
col
	{mso-width-source:auto;}
br
	{mso-data-placement:same-cell;}
td
	{padding-top:1px;
	padding-right:1px;
	padding-left:1px;
	mso-ignore:padding;
	color:black;
	font-size:12.0pt;
	font-weight:400;
	font-style:normal;
	text-decoration:none;
	font-family:Calibri, sans-serif;
	mso-font-charset:0;
	mso-number-format:General;
	text-align:general;
	vertical-align:bottom;
	border:none;
	mso-background-source:auto;
	mso-pattern:auto;
	mso-protection:locked visible;
	white-space:nowrap;
	mso-rotate:0;}
.xl65
	{font-weight:700;
	font-family:Aptos;
	mso-generic-font-family:auto;
	mso-font-charset:0;}
.xl66
	{font-family:Aptos;
	mso-generic-font-family:auto;
	mso-font-charset:0;}
.xl67
	{font-family:Aptos;
	mso-generic-font-family:auto;
	mso-font-charset:0;
	mso-number-format:Percent;}
.xl68
	{font-family:Aptos;
	mso-generic-font-family:auto;
	mso-font-charset:0;
	mso-number-format:0%;}
-->
</style>
</head>

<body link="#0563C1" vlink="#954F72">

<table border=0 cellpadding=0 cellspacing=0 width=321 style='border-collapse:
 collapse;width:241pt'>
<!--StartFragment-->
 <col width=175 style='mso-width-source:userset;mso-width-alt:5589;width:131pt'>
 <col width=53 style='mso-width-source:userset;mso-width-alt:1706;width:40pt'>
 <col width=93 style='mso-width-source:userset;mso-width-alt:2986;width:70pt'>
${dataRows}<!--EndFragment-->
</table>

</body>

</html>`;

          // Create plain text tab-delimited format
          const plainTextRows = [
            "Cell Type\tCount\tPercentage",
            ...filteredCells.map((cell) => {
              const percentage = ((cell.count / totalCount) * 100).toFixed(2) + "%";
              return `${cell.name}\t${cell.count}\t${percentage}`;
            }),
            `Total Count\t${totalCount}\t100%`,
          ];

          if (state.presetType === "bone-marrow") {
            const ratio = calculateMEratio();
            if (ratio) {
              plainTextRows.push(
                `M:E Ratio\t${ratio.ratio}:1\t(${ratio.myeloidCount}:${ratio.erythroidCount})`
              );
            }
          }

          const plainText = plainTextRows.join("\n");

          // Prefer the browser's *native* rich-copy pipeline: render an actual HTML table,
          // select it, and let the browser generate the clipboard payload (often includes RTF).
          // This tends to match what works when users manually copy a table.
          const ratio = state.presetType === "bone-marrow" ? calculateMEratio() : null;
          const htmlTable = `<table border="1" cellspacing="0" cellpadding="5">
<tr><th>Cell Type</th><th>Count</th><th>Percentage</th></tr>
${filteredCells
  .map((cell) => {
    const percentage = ((cell.count / totalCount) * 100).toFixed(2) + "%";
    return `<tr><td>${cell.name}</td><td>${cell.count}</td><td>${percentage}</td></tr>`;
  })
  .join("\n")}
<tr><td><strong>Total Count</strong></td><td><strong>${totalCount}</strong></td><td><strong>100%</strong></td></tr>
${
  ratio
    ? `<tr><td><strong>M:E Ratio</strong></td><td><strong>${ratio.ratio}:1</strong></td><td>(${ratio.myeloidCount}:${ratio.erythroidCount})</td></tr>`
    : ""
}
</table>`;

          const copyViaNativeSelection = () => {
            const container = document.createElement("div");
            container.setAttribute("contenteditable", "true");
            container.style.position = "fixed";
            container.style.left = "-9999px";
            container.style.top = "0";
            container.style.opacity = "0";
            container.innerHTML = htmlTable;
            document.body.appendChild(container);

            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(container);
            selection?.removeAllRanges();
            selection?.addRange(range);
            container.focus();

            const ok = document.execCommand("copy");

            selection?.removeAllRanges();
            document.body.removeChild(container);
            return ok;
          };

          if (copyViaNativeSelection()) {
            toast.success("Copied table for Epic. Paste into Epic.");
            return;
          }

          // Generate a standards-friendly RTF table.
          // Epic is often picky about malformed RTF; keep the header minimal and use \ansi.
          const rtfCellWidths = [3500, 4500, 6200];
          const rtfCellBorders =
            "\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10";
          const rtfRowHeader =
            `\\trowd\\trgaph108\\trleft0${rtfCellBorders}\\cellx${rtfCellWidths[0]}` +
            `${rtfCellBorders}\\cellx${rtfCellWidths[1]}` +
            `${rtfCellBorders}\\cellx${rtfCellWidths[2]}`;

          const rtfRow = (cells: Array<{ text: string; align?: "ql" | "qr"; bold?: boolean }>) => {
            const renderedCells = cells
              .map(({ text, align = "ql", bold = false }) => {
                const bStart = bold ? "\\b " : "";
                const bEnd = bold ? "\\b0 " : "";
                return `\\pard\\intbl\\${align} ${bStart}${escapeRtf(text)} ${bEnd}\\cell`;
              })
              .join(" ");

            return `${rtfRowHeader} ${renderedCells} \\row`;
          };

          const rtfRows = [
            rtfRow([
              { text: "Cell Type", bold: true },
              { text: "Count", bold: true, align: "qr" },
              { text: "Percentage", bold: true, align: "qr" },
            ]),
            ...filteredCells.map((cell) => {
              const percentage = ((cell.count / totalCount) * 100).toFixed(2) + "%";
              return rtfRow([
                { text: cell.name },
                { text: String(cell.count), align: "qr" },
                { text: percentage, align: "qr" },
              ]);
            }),
            rtfRow([
              { text: "Total Count", bold: true },
              { text: String(totalCount), bold: true, align: "qr" },
              { text: "100%", bold: true, align: "qr" },
            ]),
          ];

          if (state.presetType === "bone-marrow") {
            const ratio = calculateMEratio();
            if (ratio) {
              rtfRows.push(
                rtfRow([
                  { text: "M:E Ratio", bold: true },
                  { text: `${ratio.ratio}:1`, bold: true, align: "qr" },
                  { text: `(${ratio.myeloidCount}:${ratio.erythroidCount})`, align: "qr" },
                ])
              );
            }
          }

          // Use an explicit Windows codepage to improve interoperability with Windows apps.
          const rtfDocument =
            `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Calibri;}}` +
            `\\viewkind4\\uc1\\pard\\f0\\fs22 ` +
            rtfRows.join(" ") +
            "}";

          const copyWithClipboardApi = async () => {
            // IMPORTANT: Epic/Windows clipboard pipelines tend to key off RTF specifically.
            const clipboardItem = new ClipboardItem({
              "text/rtf": new Blob([rtfDocument], { type: "text/rtf" }),
              "text/plain": new Blob([plainText], { type: "text/plain" }),
            });
            await navigator.clipboard.write([clipboardItem]);
          };

          const copyWithExecCommand = async () => {
            const copyHandler = (e: ClipboardEvent) => {
              e.preventDefault();
              e.clipboardData?.setData("text/plain", plainText);
              e.clipboardData?.setData("text/rtf", rtfDocument);

              document.removeEventListener("copy", copyHandler);
            };

            document.addEventListener("copy", copyHandler);
            try {
              const successful = document.execCommand("copy");
              if (!successful) throw new Error("execCommand copy failed");
            } finally {
              document.removeEventListener("copy", copyHandler);
            }
          };

          // Prefer Clipboard API (more reliable for cross-app paste), then fallback.
          try {
            await copyWithClipboardApi();
            toast.success("Copied table for Epic. Paste into Epic.");
          } catch (error) {
            console.warn("ClipboardItem write failed; falling back to execCommand:", error);
            try {
              await copyWithExecCommand();
              toast.success("Copied for Epic. Paste into Epic.");
            } catch (fallbackError) {
              console.error("Copy failed:", fallbackError);
              await navigator.clipboard.writeText(plainText);
              toast.success("Copied as plain text (tab-delimited).", {
                duration: 5000,
              });
            }
          }
        } catch (error) {
          toast.error("Failed to copy table");
          console.error(error);
        }
      } else {
        // Plain text format (human-readable)
        const rows = filteredCells
          .map((cell) => {
            const percentage = ((cell.count / totalCount) * 100).toFixed(1);
            const paddedName = cell.name.padEnd(30, " ");
            const paddedCount = cell.count.toString().padEnd(8, " ");
            return `${paddedName} ${paddedCount} ${percentage}%`;
          })
          .join("\n");

        const footer = `\n${"=".repeat(60)}\n${"Total Count:".padEnd(30, " ")} ${totalCount}`;

        // Add M:E ratio if bone marrow preset
        let meRatioText = "";
        if (state.presetType === "bone-marrow") {
          const ratio = calculateMEratio();
          if (ratio) {
            meRatioText = `\n${"M:E Ratio:".padEnd(30, " ")} ${ratio.ratio}:1 (${ratio.myeloidCount}:${ratio.erythroidCount})`;
          }
        }

        const exportText = rows + footer + meRatioText;

        try {
          await navigator.clipboard.writeText(exportText);
          toast.success("Copied as plain text!");
        } catch (_error) {
          toast.error("Failed to copy to clipboard");
        }
      }
    },
    [state.cellTypes, state.presetType, totalCount, calculateMEratio]
  );

  // Keyboard event handler
  useEffect(() => {
    if (!isCountingActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Map of shifted keys to their unshifted equivalents for special characters
      const shiftKeyMap: Record<string, string> = {
        ":": ";", // Shift + ;
        '"': "'", // Shift + '
        "?": "/", // Shift + /
        L: "l", // Shift + l
        N: "n", // Shift + n
        M: "m", // Shift + m
        B: "b", // Shift + b
      };

      // Get the effective key - if shift is pressed, try to map back to unshifted key
      let effectiveKey = event.key;
      if (event.shiftKey && shiftKeyMap[event.key]) {
        effectiveKey = shiftKeyMap[event.key];
      } else {
        effectiveKey = event.key.toLowerCase();
      }

      // Handle Shift + cell key for decrementing first
      if (event.shiftKey) {
        const cellExists = state.cellTypes.some((cell) => cell.key === effectiveKey);
        if (cellExists) {
          event.preventDefault();
          decrementCell(effectiveKey);
          return;
        }
      }

      // Check if it's a cell type key (without shift)
      const cellExists = state.cellTypes.some((cell) => cell.key === effectiveKey);
      if (cellExists && !event.shiftKey) {
        event.preventDefault();
        incrementCell(effectiveKey);
        return;
      }

      // Handle special keys
      switch (effectiveKey) {
        case "escape":
          event.preventDefault();
          setIsCountingActive(false);
          // toast.info('Counting stopped')
          break;
        case "z":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            undoLastAction();
          }
          break;
        case "backspace":
          event.preventDefault();
          undoLastAction();
          break;
        case "r":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            resetCounts();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isCountingActive,
    state.cellTypes,
    incrementCell,
    decrementCell,
    undoLastAction,
    resetCounts,
    exportResults,
  ]);

  // Check for completion
  useEffect(() => {
    if (isComplete && !state.isComplete) {
      updateState((prev) => ({ ...prev, isComplete: true }));
      toast.success("Count limit reached! Counting complete.", {
        duration: 5000,
      });
    }
  }, [isComplete, state.isComplete, updateState]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Cell Counter Tool"
        description="Efficient cell counting with customizable keyboard shortcuts. Perfect for differential counts, cell morphology studies, and laboratory work."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Keyboard className="h-4 w-4" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Configurable Limits</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Download className="h-4 w-4" />
              <span>Export Results</span>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <section className="relative py-4 md:py-8">
        <div className="container mx-auto px-4 max-w-6xl" ref={containerRef}>
          <div className="grid gap-4 md:gap-6 lg:grid-cols-5">
            {/* Simplified Setup Panel */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Quick Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  {/* Quick Presets */}
                  <div className="space-y-2">
                    <Label>Common Presets</Label>
                    <div className="grid gap-2">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground pl-1">
                          Peripheral Blood
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateState((prev) => ({
                                ...prev,
                                cellTypes: PERIPHERAL_BLOOD_CELL_TYPES.map((cell) => ({
                                  ...cell,
                                  count: 0,
                                })),
                                settings: { ...prev.settings, countLimit: 100, enableLimit: true },
                                presetType: "peripheral-blood",
                                undoHistory: [],
                              }));
                              toast.success("Peripheral Blood (100 cells) preset loaded");
                            }}
                            disabled={isCountingActive}
                            className="justify-center"
                          >
                            100 cells
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateState((prev) => ({
                                ...prev,
                                cellTypes: PERIPHERAL_BLOOD_CELL_TYPES.map((cell) => ({
                                  ...cell,
                                  count: 0,
                                })),
                                settings: { ...prev.settings, countLimit: 200, enableLimit: true },
                                presetType: "peripheral-blood",
                                undoHistory: [],
                              }));
                              toast.success("Peripheral Blood (200 cells) preset loaded");
                            }}
                            disabled={isCountingActive}
                            className="justify-center"
                          >
                            200 cells
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground pl-1">
                          Bone Marrow
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateState((prev) => ({
                                ...prev,
                                cellTypes: BONE_MARROW_CELL_TYPES.map((cell) => ({
                                  ...cell,
                                  count: 0,
                                })),
                                settings: { ...prev.settings, countLimit: 300, enableLimit: true },
                                presetType: "bone-marrow",
                                undoHistory: [],
                              }));
                              toast.success("Bone Marrow (300 cells) preset loaded");
                            }}
                            disabled={isCountingActive}
                            className="justify-center"
                          >
                            300 cells
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateState((prev) => ({
                                ...prev,
                                cellTypes: BONE_MARROW_CELL_TYPES.map((cell) => ({
                                  ...cell,
                                  count: 0,
                                })),
                                settings: { ...prev.settings, countLimit: 500, enableLimit: true },
                                presetType: "bone-marrow",
                                undoHistory: [],
                              }));
                              toast.success("Bone Marrow (500 cells) preset loaded");
                            }}
                            disabled={isCountingActive}
                            className="justify-center"
                          >
                            500 cells
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Saved Presets */}
                  {(state.savedPresets.length > 0 || state.presetType === "custom") && (
                    <div className="space-y-2">
                      <Label>Saved Presets</Label>
                      <div className="grid gap-1.5">
                        {state.savedPresets.map((preset) => (
                          <div key={preset.id} className="flex gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 justify-start truncate"
                              onClick={() => loadPreset(preset)}
                              disabled={isCountingActive}
                            >
                              {preset.name}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => deletePreset(preset.id)}
                              disabled={isCountingActive}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        {state.savedPresets.length < 3 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-center"
                            onClick={() => setIsSavePresetOpen(true)}
                            disabled={isCountingActive || state.cellTypes.length === 0}
                          >
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            Save Current Config
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Add Cell Type - Simplified */}
                  <div className="space-y-3">
                    <Label>Add Cell Type</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Cell name"
                        value={newCellName}
                        onChange={(e) => setNewCellName(e.target.value)}
                        maxLength={20}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Key"
                        value={newCellKey}
                        onChange={(e) => setNewCellKey(e.target.value.toLowerCase())}
                        maxLength={1}
                        className="w-16 hidden md:block"
                      />
                      <Button
                        onClick={addCellType}
                        disabled={state.cellTypes.length >= 20}
                        size="icon"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Current Cell Types - Compact */}
                  {state.cellTypes.length > 0 && (
                    <div className="space-y-2">
                      <Label>Active Types ({state.cellTypes.length}/20)</Label>
                      <div className="grid gap-1">
                        {state.cellTypes.map((cell) => (
                          <div
                            key={cell.id}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{cell.name}</span>
                              <kbd className="px-1.5 py-0.5 bg-background border border-gray-300 rounded text-xs font-medium shadow-sm hidden md:inline-flex">
                                {cell.key}
                              </kbd>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeCellType(cell.id)}
                              disabled={isCountingActive}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Simple Settings */}
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <Label>Count Limit:</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="10"
                          max="10000"
                          value={state.settings.countLimit}
                          onChange={(e) =>
                            updateState((prev) => ({
                              ...prev,
                              settings: {
                                ...prev.settings,
                                countLimit: parseInt(e.target.value) || 100,
                              },
                            }))
                          }
                          disabled={isCountingActive || !state.settings.enableLimit}
                          className="w-20 text-sm"
                        />
                        <input
                          type="checkbox"
                          checked={state.settings.enableLimit}
                          onChange={(e) =>
                            updateState((prev) => ({
                              ...prev,
                              settings: { ...prev.settings, enableLimit: e.target.checked },
                            }))
                          }
                          disabled={isCountingActive}
                          className="rounded"
                        />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => {
                        updateState((prev) => ({
                          ...prev,
                          cellTypes: [],
                          undoHistory: [],
                          presetType: "custom",
                        }));
                        // toast.success('Cleared all cell types')
                      }}
                      disabled={isCountingActive}
                      className="w-full"
                      size="sm"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Counting Interface */}
            <div className="lg:col-span-3 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Cell Counter
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      Total: {totalCount}
                      {state.settings.enableLimit && <span>/ {state.settings.countLimit}</span>}
                      {isComplete && <CheckCircle className="h-4 w-4 text-green-500 ml-2" />}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!isCountingActive ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Click "Start Counting" to begin. Use keyboard shortcuts to count cells
                        efficiently.
                      </p>
                      <Button
                        size="lg"
                        onClick={() => setIsCountingActive(true)}
                        disabled={state.cellTypes.length === 0}
                      >
                        Start Counting
                      </Button>
                      {state.cellTypes.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Add cell types first to start counting
                        </p>
                      )}
                      {totalCount > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => resetCounts()}
                          className="mt-4"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Reset Counts
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Active Counting Display - Mobile Optimized */}
                      <div className="grid gap-2 md:gap-3 grid-cols-2 lg:grid-cols-3">
                        {state.cellTypes.map((cell) => (
                          <div
                            key={cell.id}
                            className="w-full p-1.5 md:p-3 border rounded-lg bg-card"
                          >
                            <div className="flex items-center justify-between gap-1 md:gap-2">
                              <div className="min-w-0 flex-1 pr-1">
                                <div className="font-medium text-xs leading-none sm:leading-tight break-words">
                                  {cell.name}
                                </div>
                                <div className="text-xs text-muted-foreground hidden md:block">
                                  Press "{cell.key}"
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg md:text-xl font-bold">{cell.count}</div>
                                <div className="text-xs text-muted-foreground">
                                  {totalCount > 0
                                    ? ((cell.count / totalCount) * 100).toFixed(1)
                                    : "0.0"}
                                  %
                                </div>
                              </div>
                            </div>
                            {/* Manual increment/decrement buttons */}
                            <div className="flex gap-1 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => decrementCell(cell.key)}
                                disabled={cell.count === 0}
                                className="flex-1 h-7 px-2"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => incrementCell(cell.key)}
                                disabled={isComplete}
                                className="flex-1 h-7 px-2"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        {/* M:E Ratio Card - Non-interactable */}
                        {state.presetType === "bone-marrow" && meRatio && (
                          <div className="w-full p-1.5 md:p-3 border rounded-lg bg-accent/50 text-left cursor-default">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1 pr-1">
                                <div className="font-medium text-xs leading-none sm:leading-tight break-words">
                                  M:E Ratio
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg md:text-xl font-bold">
                                  {meRatio.ratio}:1
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {meRatio.myeloidCount}:{meRatio.erythroidCount}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {state.settings.enableLimit && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>
                              {totalCount} / {state.settings.countLimit}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                isComplete ? "bg-emerald-600" : "bg-primary"
                              }`}
                              style={{
                                width: `${Math.min((totalCount / state.settings.countLimit) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Control Buttons */}
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button
                          variant="outline"
                          onClick={undoLastAction}
                          disabled={state.undoHistory.length === 0}
                          size="sm"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Undo
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            resetCounts();
                            setIsCountingActive(false);
                          }}
                          disabled={totalCount === 0}
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Reset
                        </Button>
                      </div>

                      {/* Export Buttons */}
                      <div className="pt-2 border-t">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2 justify-center">
                            <Button
                              onClick={() => exportResults("excel")}
                              disabled={totalCount === 0}
                              size="sm"
                              className="font-semibold"
                            >
                              <Table className="h-4 w-4 mr-2" />
                              Copy Table (Epic)
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => exportResults("text")}
                              disabled={totalCount === 0}
                              size="sm"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Copy Plain Text
                            </Button>
                          </div>
                          <p className="text-center text-xs text-muted-foreground">
                            For best results, paste into Word/Excel first, then copy from there into
                            Epic.
                          </p>
                        </div>
                      </div>

                      {/* Keyboard Instructions - Desktop only */}
                      <div className="border-t pt-6 mt-4 hidden md:block">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">
                            <strong>Instructions:</strong>{" "}
                            <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                              Ctrl+Z
                            </kbd>{" "}
                            or{" "}
                            <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                              Backspace
                            </kbd>{" "}
                            to undo, and{" "}
                            <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">
                              Shift+key
                            </kbd>{" "}
                            to decrement
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Keyboard Visualizer - Always visible */}
              <KeyboardVisualizer cellTypes={state.cellTypes} />
            </div>
          </div>
        </div>
      </section>

      {/* Join Community Section */}
      <JoinCommunitySection />

      {/* Save Preset Dialog */}
      <Dialog open={isSavePresetOpen} onOpenChange={setIsSavePresetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              placeholder="e.g. My PB Config"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              maxLength={30}
              className="mt-1.5"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrentPreset();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsSavePresetOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveCurrentPreset} disabled={!presetName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
