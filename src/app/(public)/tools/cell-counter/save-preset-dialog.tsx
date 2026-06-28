"use client";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";

interface SavePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetName: string;
  onPresetNameChange: (value: string) => void;
  onSave: () => void;
}

export function SavePresetDialog({
  open,
  onOpenChange,
  presetName,
  onPresetNameChange,
  onSave,
}: SavePresetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onChange={(e) => onPresetNameChange(e.target.value)}
            maxLength={30}
            className="mt-1.5"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={!presetName.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
