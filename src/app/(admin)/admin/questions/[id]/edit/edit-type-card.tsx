"use client";

import { Card } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";

interface EditTypeCardProps {
  updateType: "patch" | "minor" | "major";
  isPatchEditDisabled: boolean;
  onUpdateTypeChange: (value: "patch" | "minor" | "major") => void;
}

export function EditTypeCard({
  updateType,
  isPatchEditDisabled,
  onUpdateTypeChange,
}: EditTypeCardProps) {
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Edit Type</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Select the type of changes you're making to this published question
          </p>
        </div>
        <RadioGroup value={updateType} onValueChange={onUpdateTypeChange} className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="patch" id="patch" disabled={isPatchEditDisabled} />
            <Label
              htmlFor="patch"
              className={`font-normal cursor-pointer ${isPatchEditDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Patch <span className="text-xs text-muted-foreground">(typos, formatting)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="minor" id="minor" />
            <Label htmlFor="minor" className="font-normal cursor-pointer">
              Minor <span className="text-xs text-muted-foreground">(content changes)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="major" id="major" />
            <Label htmlFor="major" className="font-normal cursor-pointer">
              Major <span className="text-xs text-muted-foreground">(answer change, overhaul)</span>
            </Label>
          </div>
        </RadioGroup>
        {isPatchEditDisabled && (
          <p className="text-xs text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
            ⚠️ Patch edit is disabled because you've changed the correct answer or modified images.
            These changes require review.
          </p>
        )}
      </div>
    </Card>
  );
}
