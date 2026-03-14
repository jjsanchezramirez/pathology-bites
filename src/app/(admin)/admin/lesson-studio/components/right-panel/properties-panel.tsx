import { Button } from "@/shared/components/ui/button";
import { Accordion } from "@/shared/components/ui/accordion";
import { Trash2 } from "lucide-react";
import type { SelectedImage, LibraryImage, Animation, TimeBasedText } from "../../types";
import {
  TimingSection,
  FramingSection,
  ZoomPanSection,
  AnnotationsSection,
  TextOverlaysSection,
} from "./property-sections";

interface PropertiesPanelProps {
  selectedImage: SelectedImage | null;
  selectedImageIndex: number | null;
  isLastImage: boolean;
  onUpdateImage: (
    index: number,
    field: keyof SelectedImage,
    value: SelectedImage[keyof SelectedImage]
  ) => void;
  onUpdateImageMultiple: (index: number, updates: Partial<SelectedImage>) => void;
  onCalculateCoverZoom: (image: LibraryImage) => number;
  onAddAnimation: (imageIndex: number, type: Animation["type"]) => void;
  onRemoveAnimation: (imageIndex: number, animId: string) => void;
  onUpdateAnimation: (imageIndex: number, animId: string, updates: Partial<Animation>) => void;
  onAddText: (imageIndex: number) => void;
  onRemoveText: (imageIndex: number, textId: string) => void;
  onUpdateText: (imageIndex: number, textId: string, updates: Partial<TimeBasedText>) => void;
  onDeleteSegment: () => void;
}

export function PropertiesPanel({
  selectedImage,
  selectedImageIndex,
  isLastImage,
  onUpdateImage,
  onUpdateImageMultiple,
  onCalculateCoverZoom,
  onAddAnimation,
  onRemoveAnimation,
  onUpdateAnimation,
  onAddText,
  onRemoveText,
  onUpdateText,
  onDeleteSegment,
}: PropertiesPanelProps) {
  if (selectedImageIndex === null || !selectedImage) {
    return (
      <div className="w-80 border-l bg-white overflow-y-auto flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground text-center">
            Select a segment to edit its properties
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l bg-white overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-muted/30 flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-sm">Edit Segment {selectedImageIndex + 1}</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDeleteSegment}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Accordion Sections */}
      <Accordion type="single" defaultValue="framing" collapsible className="px-4">
        <TimingSection
          selectedImage={selectedImage}
          imageIndex={selectedImageIndex}
          isLastImage={isLastImage}
          onUpdateImage={onUpdateImage}
        />

        <FramingSection
          selectedImage={selectedImage}
          imageIndex={selectedImageIndex}
          onUpdateImage={onUpdateImage}
          onUpdateImageMultiple={onUpdateImageMultiple}
          onCalculateCoverZoom={onCalculateCoverZoom}
        />

        <ZoomPanSection
          selectedImage={selectedImage}
          imageIndex={selectedImageIndex}
          onAddAnimation={onAddAnimation}
          onRemoveAnimation={onRemoveAnimation}
          onUpdateAnimation={onUpdateAnimation}
        />

        <AnnotationsSection
          selectedImage={selectedImage}
          imageIndex={selectedImageIndex}
          onAddAnimation={onAddAnimation}
          onRemoveAnimation={onRemoveAnimation}
          onUpdateAnimation={onUpdateAnimation}
        />

        <TextOverlaysSection
          selectedImage={selectedImage}
          imageIndex={selectedImageIndex}
          onAddText={onAddText}
          onRemoveText={onRemoveText}
          onUpdateText={onUpdateText}
        />
      </Accordion>
    </div>
  );
}
