import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { EditableLabel } from "../../editable-label";
import type { SelectedImage, LibraryImage } from "../../../types";

interface FramingSectionProps {
  selectedImage: SelectedImage;
  imageIndex: number;
  onUpdateImage: (index: number, field: keyof SelectedImage, value: any) => void;
  onCalculateCoverZoom: (image: LibraryImage) => number;
}

export function FramingSection({
  selectedImage,
  imageIndex,
  onUpdateImage,
  onCalculateCoverZoom,
}: FramingSectionProps) {
  return (
    <AccordionItem value="framing">
      <AccordionTrigger className="text-sm font-medium py-3">Image & Framing</AccordionTrigger>
      <AccordionContent className="space-y-2 pb-4">
        <div className="space-y-1">
          <EditableLabel
            label="Initial Zoom"
            value={selectedImage.initialZoom}
            min={0.5}
            max={2}
            step={0.1}
            suffix="x"
            onSave={(val) => onUpdateImage(imageIndex, "initialZoom", val)}
          />
          <Input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={selectedImage.initialZoom}
            onChange={(e) => onUpdateImage(imageIndex, "initialZoom", Number(e.target.value))}
            className="w-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <EditableLabel
              label="X"
              value={selectedImage.initialX}
              min={-50}
              max={50}
              step={1}
              suffix="%"
              onSave={(val) => onUpdateImage(imageIndex, "initialX", val)}
            />
            <Input
              type="range"
              min={-50}
              max={50}
              step={1}
              value={selectedImage.initialX}
              onChange={(e) => onUpdateImage(imageIndex, "initialX", Number(e.target.value))}
              className="w-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
            />
          </div>

          <div className="space-y-1">
            <EditableLabel
              label="Y"
              value={selectedImage.initialY}
              min={-50}
              max={50}
              step={1}
              suffix="%"
              onSave={(val) => onUpdateImage(imageIndex, "initialY", val)}
            />
            <Input
              type="range"
              min={-50}
              max={50}
              step={1}
              value={selectedImage.initialY}
              onChange={(e) => onUpdateImage(imageIndex, "initialY", Number(e.target.value))}
              className="w-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onUpdateImage(imageIndex, "initialZoom", onCalculateCoverZoom(selectedImage));
            }}
            className="text-xs h-7"
          >
            Zoom to Fit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onUpdateImage(imageIndex, "initialZoom", onCalculateCoverZoom(selectedImage));
              onUpdateImage(imageIndex, "initialX", 0);
              onUpdateImage(imageIndex, "initialY", 0);
            }}
            className="text-xs h-7"
          >
            Reset to Default
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
