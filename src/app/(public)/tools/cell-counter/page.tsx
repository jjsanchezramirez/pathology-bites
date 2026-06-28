"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Keyboard, Target, Download } from "lucide-react";
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { toast } from "@/shared/utils/ui/toast";
import { useCounterSync } from "./use-counter-sync";
import type { SavedPreset } from "@/shared/config/user-settings-defaults";
import { log } from "@/shared/utils/logging";
import {
  type CounterState,
  DEFAULT_CELL_TYPES,
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  PERIPHERAL_BLOOD_CELL_TYPES,
  BONE_MARROW_CELL_TYPES,
} from "./cell-counter-data";
import {
  extractConfig,
  calculateMEratio,
  assignCellKey,
  pickCellColor,
  applyCount,
  applyUndo,
  resolveKeyAction,
} from "./cell-counter-utils";
import {
  buildPlainTextTabbed,
  buildPlainTextExport,
  buildHtmlTable,
  buildRtfDocument,
} from "./cell-export";
import { CellCounterSetupPanel } from "./cell-counter-setup-panel";
import { CellCountingArea } from "./cell-counting-area";
import { SavePresetDialog } from "./save-preset-dialog";

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

  const totalCount = state.cellTypes.reduce((sum, cell) => sum + cell.count, 0);
  const isComplete = state.settings.enableLimit && totalCount >= state.settings.countLimit;
  const meRatio = calculateMEratio(state.presetType, state.cellTypes);

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

  // Apply a built-in preset
  const applyPreset = (presetType: "peripheral-blood" | "bone-marrow", countLimit: number) => {
    const cells =
      presetType === "peripheral-blood" ? PERIPHERAL_BLOOD_CELL_TYPES : BONE_MARROW_CELL_TYPES;
    const label = presetType === "peripheral-blood" ? "Peripheral Blood" : "Bone Marrow";
    updateState((prev) => ({
      ...prev,
      cellTypes: cells.map((cell) => ({ ...cell, count: 0 })),
      settings: { ...prev.settings, countLimit, enableLimit: true },
      presetType,
      undoHistory: [],
    }));
    toast.success(`${label} (${countLimit} cells) preset loaded`);
  };

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
    updateState((prev) => ({ ...prev, savedPresets: [...prev.savedPresets, newPreset] }));
    setPresetName("");
    setIsSavePresetOpen(false);
    toast.success(`Preset saved: ${name}`);
  }, [presetName, state, updateState]);

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

  const addCellType = useCallback(() => {
    if (!newCellName.trim()) {
      toast.error("Please enter cell name");
      return;
    }
    if (state.cellTypes.length >= 20) {
      toast.error("Maximum 20 cell types allowed");
      return;
    }

    const assignedKey = assignCellKey(
      newCellName,
      newCellKey,
      state.cellTypes.map((cell) => cell.key)
    );

    if (state.cellTypes.some((cell) => cell.key.toLowerCase() === assignedKey)) {
      toast.error("Key already in use");
      return;
    }

    const newCell = {
      id: Date.now().toString(),
      name: newCellName.trim(),
      key: assignedKey,
      count: 0,
      color: pickCellColor(state.cellTypes.length),
    };

    updateState((prev) => ({
      ...prev,
      cellTypes: [...prev.cellTypes, newCell],
      presetType: "custom",
    }));

    setNewCellName("");
    setNewCellKey("");
  }, [newCellName, newCellKey, state.cellTypes, updateState]);

  const removeCellType = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        cellTypes: prev.cellTypes.filter((cell) => cell.id !== id),
      }));
    },
    [updateState]
  );

  const incrementCell = useCallback(
    (key: string) => {
      if (isComplete) return;
      updateState((prev) => applyCount(prev, key, 1));
    },
    [isComplete, updateState]
  );

  const decrementCell = useCallback(
    (key: string) => {
      updateState((prev) => applyCount(prev, key, -1));
    },
    [updateState]
  );

  const undoLastAction = useCallback(() => {
    if (state.undoHistory.length === 0) {
      toast.error("Nothing to undo");
      return;
    }
    updateState((prev) => applyUndo(prev));
  }, [state.undoHistory.length, updateState]);

  const resetCounts = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      cellTypes: prev.cellTypes.map((cell) => ({ ...cell, count: 0 })),
      undoHistory: [],
    }));
  }, [updateState]);

  const clearAll = () => {
    updateState((prev) => ({ ...prev, cellTypes: [], undoHistory: [], presetType: "custom" }));
  };

  // Copy results (Epic-friendly RTF table + plain text fallback)
  const exportResults = useCallback(
    async (format: "text" | "excel" = "excel") => {
      if (totalCount === 0) {
        toast.error("No data to export");
        return;
      }

      const filteredCells = state.cellTypes.filter((cell) => cell.count > 0);
      const ratio = calculateMEratio(state.presetType, state.cellTypes);

      if (format === "excel") {
        try {
          const plainText = buildPlainTextTabbed(filteredCells, totalCount, ratio);
          const htmlTable = buildHtmlTable(filteredCells, totalCount, ratio);
          const rtfDocument = buildRtfDocument(filteredCells, totalCount, ratio);

          // Prefer the browser's *native* rich-copy pipeline (renders a table, selects it).
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

          const copyWithClipboardApi = async () => {
            // Epic/Windows clipboard pipelines tend to key off RTF specifically.
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

          try {
            await copyWithClipboardApi();
            toast.success("Copied table for Epic. Paste into Epic.");
          } catch (error) {
            log.warn("ClipboardItem write failed; falling back to execCommand:", error);
            try {
              await copyWithExecCommand();
              toast.success("Copied for Epic. Paste into Epic.");
            } catch (fallbackError) {
              log.error("Copy failed:", fallbackError);
              await navigator.clipboard.writeText(plainText);
              toast.success("Copied as plain text (tab-delimited).", { duration: 5000 });
            }
          }
        } catch (error) {
          toast.error("Failed to copy table");
          log.error(error);
        }
      } else {
        const exportText = buildPlainTextExport(filteredCells, totalCount, ratio);
        try {
          await navigator.clipboard.writeText(exportText);
          toast.success("Copied as plain text!");
        } catch {
          toast.error("Failed to copy to clipboard");
        }
      }
    },
    [state.cellTypes, state.presetType, totalCount]
  );

  // Keyboard event handler
  useEffect(() => {
    if (!isCountingActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = resolveKeyAction(event, state.cellTypes);
      if (!action) return;

      event.preventDefault();
      switch (action.type) {
        case "increment":
          incrementCell(action.key);
          break;
        case "decrement":
          decrementCell(action.key);
          break;
        case "undo":
          undoLastAction();
          break;
        case "reset":
          resetCounts();
          break;
        case "stop":
          setIsCountingActive(false);
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
  ]);

  // Check for completion
  useEffect(() => {
    if (isComplete && !state.isComplete) {
      updateState((prev) => ({ ...prev, isComplete: true }));
      toast.success("Count limit reached! Counting complete.", { duration: 5000 });
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
              <CellCounterSetupPanel
                cellTypes={state.cellTypes}
                savedPresets={state.savedPresets}
                presetType={state.presetType}
                settings={state.settings}
                isCountingActive={isCountingActive}
                newCellName={newCellName}
                onNewCellName={setNewCellName}
                newCellKey={newCellKey}
                onNewCellKey={setNewCellKey}
                onApplyPreset={applyPreset}
                onLoadPreset={loadPreset}
                onDeletePreset={deletePreset}
                onOpenSavePreset={() => setIsSavePresetOpen(true)}
                onAddCellType={addCellType}
                onRemoveCellType={removeCellType}
                onUpdateCountLimit={(value) =>
                  updateState((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, countLimit: value },
                  }))
                }
                onToggleEnableLimit={(checked) =>
                  updateState((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, enableLimit: checked },
                  }))
                }
                onClearAll={clearAll}
              />
            </div>

            {/* Counting Interface */}
            <CellCountingArea
              cellTypes={state.cellTypes}
              settings={state.settings}
              presetType={state.presetType}
              totalCount={totalCount}
              isComplete={isComplete}
              meRatio={meRatio}
              undoHistoryLength={state.undoHistory.length}
              isCountingActive={isCountingActive}
              onStartCounting={() => setIsCountingActive(true)}
              onResetCounts={resetCounts}
              onIncrement={incrementCell}
              onDecrement={decrementCell}
              onUndo={undoLastAction}
              onResetAndStop={() => {
                resetCounts();
                setIsCountingActive(false);
              }}
              onExport={exportResults}
            />
          </div>
        </div>
      </section>

      {/* Join Community Section */}
      <JoinCommunitySection />

      {/* Save Preset Dialog */}
      <SavePresetDialog
        open={isSavePresetOpen}
        onOpenChange={setIsSavePresetOpen}
        presetName={presetName}
        onPresetNameChange={setPresetName}
        onSave={saveCurrentPreset}
      />
    </div>
  );
}
