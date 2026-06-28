"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Plus, RotateCcw, Settings, Trash2, Save } from "lucide-react";
import type { SavedPreset } from "@/shared/config/user-settings-defaults";
import type { CellType, CounterSettings, CounterState } from "./cell-counter-data";

interface CellCounterSetupPanelProps {
  cellTypes: CellType[];
  savedPresets: SavedPreset[];
  presetType: CounterState["presetType"];
  settings: CounterSettings;
  isCountingActive: boolean;
  newCellName: string;
  onNewCellName: (value: string) => void;
  newCellKey: string;
  onNewCellKey: (value: string) => void;
  onApplyPreset: (presetType: "peripheral-blood" | "bone-marrow", countLimit: number) => void;
  onLoadPreset: (preset: SavedPreset) => void;
  onDeletePreset: (id: string) => void;
  onOpenSavePreset: () => void;
  onAddCellType: () => void;
  onRemoveCellType: (id: string) => void;
  onUpdateCountLimit: (value: number) => void;
  onToggleEnableLimit: (checked: boolean) => void;
  onClearAll: () => void;
}

export function CellCounterSetupPanel({
  cellTypes,
  savedPresets,
  presetType,
  settings,
  isCountingActive,
  newCellName,
  onNewCellName,
  newCellKey,
  onNewCellKey,
  onApplyPreset,
  onLoadPreset,
  onDeletePreset,
  onOpenSavePreset,
  onAddCellType,
  onRemoveCellType,
  onUpdateCountLimit,
  onToggleEnableLimit,
  onClearAll,
}: CellCounterSetupPanelProps) {
  return (
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
              <div className="text-xs font-medium text-muted-foreground pl-1">Peripheral Blood</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onApplyPreset("peripheral-blood", 100)}
                  disabled={isCountingActive}
                  className="justify-center"
                >
                  100 cells
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onApplyPreset("peripheral-blood", 200)}
                  disabled={isCountingActive}
                  className="justify-center"
                >
                  200 cells
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground pl-1">Bone Marrow</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onApplyPreset("bone-marrow", 300)}
                  disabled={isCountingActive}
                  className="justify-center"
                >
                  300 cells
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onApplyPreset("bone-marrow", 500)}
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
        {(savedPresets.length > 0 || presetType === "custom") && (
          <div className="space-y-2">
            <Label>Saved Presets</Label>
            <div className="grid gap-1.5">
              {savedPresets.map((preset) => (
                <div key={preset.id} className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start truncate"
                    onClick={() => onLoadPreset(preset)}
                    disabled={isCountingActive}
                  >
                    {preset.name}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeletePreset(preset.id)}
                    disabled={isCountingActive}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {savedPresets.length < 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-center"
                  onClick={onOpenSavePreset}
                  disabled={isCountingActive || cellTypes.length === 0}
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
              onChange={(e) => onNewCellName(e.target.value)}
              maxLength={20}
              className="flex-1"
            />
            <Input
              placeholder="Key"
              value={newCellKey}
              onChange={(e) => onNewCellKey(e.target.value.toLowerCase())}
              maxLength={1}
              className="w-16 hidden md:block"
            />
            <Button onClick={onAddCellType} disabled={cellTypes.length >= 20} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Current Cell Types - Compact */}
        {cellTypes.length > 0 && (
          <div className="space-y-2">
            <Label>Active Types ({cellTypes.length}/20)</Label>
            <div className="grid gap-1">
              {cellTypes.map((cell) => (
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
                    onClick={() => onRemoveCellType(cell.id)}
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
                value={settings.countLimit}
                onChange={(e) => onUpdateCountLimit(parseInt(e.target.value) || 100)}
                disabled={isCountingActive || !settings.enableLimit}
                className="w-20 text-sm"
              />
              <input
                type="checkbox"
                checked={settings.enableLimit}
                onChange={(e) => onToggleEnableLimit(e.target.checked)}
                disabled={isCountingActive}
                className="rounded"
              />
            </div>
          </div>

          <Button
            variant="outline"
            onClick={onClearAll}
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
  );
}
