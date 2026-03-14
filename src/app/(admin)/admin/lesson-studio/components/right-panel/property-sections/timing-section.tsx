import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Input } from "@/shared/components/ui/input";
import { EditableLabel } from "../../editable-label";
import type { SelectedImage } from "../../../types";

interface TimingSectionProps {
  selectedImage: SelectedImage;
  imageIndex: number;
  isLastImage: boolean;
  onUpdateImage: (
    index: number,
    field: keyof SelectedImage,
    value: SelectedImage[keyof SelectedImage]
  ) => void;
}

export function TimingSection({
  selectedImage,
  imageIndex,
  isLastImage,
  onUpdateImage,
}: TimingSectionProps) {
  return (
    <AccordionItem value="timing">
      <AccordionTrigger className="text-sm font-medium py-3">Timing</AccordionTrigger>
      <AccordionContent className="space-y-2 pb-4">
        <div>
          <EditableLabel
            label="Duration"
            value={selectedImage.duration}
            min={3}
            max={60}
            step={0.1}
            suffix="s"
            onSave={(val) => onUpdateImage(imageIndex, "duration", val)}
          />
          <Input
            type="range"
            min={3}
            max={60}
            step={1}
            value={selectedImage.duration}
            onChange={(e) => onUpdateImage(imageIndex, "duration", Number(e.target.value))}
            className="w-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
          />
        </div>

        <div>
          <EditableLabel
            label="Transition"
            value={selectedImage.transitionDuration}
            min={0}
            max={5}
            step={0.1}
            suffix="s"
            onSave={(val) => onUpdateImage(imageIndex, "transitionDuration", val)}
          />
          <Input
            type="range"
            min={0}
            max={5}
            step={1}
            value={selectedImage.transitionDuration}
            onChange={(e) =>
              onUpdateImage(imageIndex, "transitionDuration", Number(e.target.value))
            }
            disabled={isLastImage}
            className="w-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
