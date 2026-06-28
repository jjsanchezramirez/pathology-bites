"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Plus, Minus, RotateCcw, CheckCircle, Trash2, Hash, FileText, Table } from "lucide-react";
import { KeyboardVisualizer } from "@/shared/components/common/keyboard-visualizer";
import type { CellType, CounterSettings, CounterState } from "./cell-counter-data";
import type { MeRatio } from "./cell-counter-utils";

interface CellCountingAreaProps {
  cellTypes: CellType[];
  settings: CounterSettings;
  presetType: CounterState["presetType"];
  totalCount: number;
  isComplete: boolean;
  meRatio: MeRatio | null;
  undoHistoryLength: number;
  isCountingActive: boolean;
  onStartCounting: () => void;
  onResetCounts: () => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onUndo: () => void;
  onResetAndStop: () => void;
  onExport: (format: "text" | "excel") => void;
}

export function CellCountingArea({
  cellTypes,
  settings,
  presetType,
  totalCount,
  isComplete,
  meRatio,
  undoHistoryLength,
  isCountingActive,
  onStartCounting,
  onResetCounts,
  onIncrement,
  onDecrement,
  onUndo,
  onResetAndStop,
  onExport,
}: CellCountingAreaProps) {
  return (
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
              {settings.enableLimit && <span>/ {settings.countLimit}</span>}
              {isComplete && <CheckCircle className="h-4 w-4 text-green-500 ml-2" />}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isCountingActive ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Click "Start Counting" to begin. Use keyboard shortcuts to count cells efficiently.
              </p>
              <Button size="lg" onClick={onStartCounting} disabled={cellTypes.length === 0}>
                Start Counting
              </Button>
              {cellTypes.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Add cell types first to start counting
                </p>
              )}
              {totalCount > 0 && (
                <Button variant="outline" onClick={onResetCounts} className="mt-4" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Reset Counts
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Counting Display - Mobile Optimized */}
              <div className="grid gap-2 md:gap-3 grid-cols-2 lg:grid-cols-3">
                {cellTypes.map((cell) => (
                  <div key={cell.id} className="w-full p-1.5 md:p-3 border rounded-lg bg-card">
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
                          {totalCount > 0 ? ((cell.count / totalCount) * 100).toFixed(1) : "0.0"}%
                        </div>
                      </div>
                    </div>
                    {/* Manual increment/decrement buttons */}
                    <div className="flex gap-1 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDecrement(cell.key)}
                        disabled={cell.count === 0}
                        className="flex-1 h-7 px-2"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onIncrement(cell.key)}
                        disabled={isComplete}
                        className="flex-1 h-7 px-2"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* M:E Ratio Card - Non-interactable */}
                {presetType === "bone-marrow" && meRatio && (
                  <div className="w-full p-1.5 md:p-3 border rounded-lg bg-accent/50 text-left cursor-default">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-1">
                        <div className="font-medium text-xs leading-none sm:leading-tight break-words">
                          M:E Ratio
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg md:text-xl font-bold">{meRatio.ratio}:1</div>
                        <div className="text-xs text-muted-foreground">
                          {meRatio.myeloidCount}:{meRatio.erythroidCount}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {settings.enableLimit && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>
                      {totalCount} / {settings.countLimit}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isComplete ? "bg-emerald-600" : "bg-primary"
                      }`}
                      style={{
                        width: `${Math.min((totalCount / settings.countLimit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={onUndo}
                  disabled={undoHistoryLength === 0}
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Undo
                </Button>
                <Button
                  variant="outline"
                  onClick={onResetAndStop}
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
                      onClick={() => onExport("excel")}
                      disabled={totalCount === 0}
                      size="sm"
                      className="font-semibold"
                    >
                      <Table className="h-4 w-4 mr-2" />
                      Copy Table (Epic)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onExport("text")}
                      disabled={totalCount === 0}
                      size="sm"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Copy Plain Text
                    </Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    For best results, paste into Word/Excel first, then copy from there into Epic.
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
      <KeyboardVisualizer cellTypes={cellTypes} />
    </div>
  );
}
