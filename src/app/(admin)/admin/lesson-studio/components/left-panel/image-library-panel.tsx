import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { ImageIcon, Music, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExplainerImageSelector } from "../explainer-image-selector";
import type { LibraryImage, SelectedImage } from "../../types";
import { getImageTitle } from "../../utils/image-helpers";
import { formatNumber } from "../../utils/formatters";

interface SortableSegmentCardProps {
  img: SelectedImage;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
}

function SortableSegmentCard({ img, index, isSelected, onSelect }: SortableSegmentCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `segment-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const figureCount = img.animations.filter((a) => a.type === "figure").length;
  const spotlightCount = img.animations.filter((a) => a.type === "spotlight").length;
  const arrowCount = img.animations.filter((a) => a.type === "arrow").length;
  const zoomCount = img.animations.filter((a) => a.type === "zoom").length;
  const panCount = img.animations.filter((a) => a.type === "pan").length;

  const tags = [
    figureCount > 0 && `Fig ${figureCount}`,
    spotlightCount > 0 && `Spot ${spotlightCount}`,
    arrowCount > 0 && `Arrow ${arrowCount}`,
    zoomCount > 0 && `Zoom ${zoomCount}`,
    panCount > 0 && `Pan ${panCount}`,
    img.textOverlays.length > 0 && `Text ${img.textOverlays.length}`,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        border rounded-lg p-2 cursor-pointer transition-all
        ${isSelected ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 hover:border-gray-300"}
        ${isDragging ? "z-50" : ""}
      `}
      onClick={() => onSelect(index)}
    >
      <div className="flex gap-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.description || "Image"}
          className="w-12 h-12 object-cover rounded"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{getImageTitle(img)}</div>
          <div className="text-xs text-muted-foreground">
            Segment {index + 1} • {formatNumber(img.duration)}s
          </div>
          {tags && <div className="text-xs text-muted-foreground mt-0.5">{tags}</div>}
        </div>
      </div>
    </div>
  );
}

interface ImageLibraryPanelProps {
  selectedImages: SelectedImage[];
  selectedImageIndex: number | null;
  audioUrl: string;
  audioTitle: string;
  audioDuration: number;
  onAddImage: (image: LibraryImage) => void;
  onAddImages: (images: LibraryImage[]) => void;
  onSegmentSelect: (index: number) => void;
  onAudioPickerOpen: () => void;
  onReorderImages: (oldIndex: number, newIndex: number) => void;
}

export function ImageLibraryPanel({
  selectedImages,
  selectedImageIndex,
  audioUrl,
  audioTitle,
  audioDuration,
  onAddImage,
  onAddImages,
  onSegmentSelect,
  onAudioPickerOpen,
  onReorderImages,
}: ImageLibraryPanelProps) {
  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(active.id.toString().replace("segment-", ""));
      const newIndex = parseInt(over.id.toString().replace("segment-", ""));
      onReorderImages(oldIndex, newIndex);
    }
  };

  return (
    <div className="w-80 border-r flex flex-col bg-muted/30">
      {/* Browse Library Button */}
      <div className="p-4 border-b">
        <ExplainerImageSelector
          onSelect={onAddImage}
          onSelectMultiple={onAddImages}
          trigger={
            <Button variant="outline" className="w-full">
              <ImageIcon className="h-4 w-4 mr-2" />
              Browse Library
            </Button>
          }
        />
      </div>

      {/* Sequence List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {selectedImages.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">No images added yet</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedImages.map((_, i) => `segment-${i}`)}
              strategy={verticalListSortingStrategy}
            >
              {selectedImages.map((img, index) => (
                <SortableSegmentCard
                  key={`segment-${index}`}
                  img={img}
                  index={index}
                  isSelected={selectedImageIndex === index}
                  onSelect={onSegmentSelect}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Audio Section */}
      <div className="p-4 border-t space-y-2">
        <Label className="text-xs">Audio</Label>
        {audioUrl ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 min-w-0">
            <Music className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate flex-1">{audioTitle || audioUrl}</span>
            {audioDuration > 0 && (
              <span className="shrink-0 text-muted-foreground/70">
                {formatNumber(audioDuration)}s
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No audio selected</p>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={onAudioPickerOpen}>
          <Music className="h-4 w-4 mr-2" />
          {audioUrl ? "Change Audio" : "Select Audio"}
        </Button>
      </div>
    </div>
  );
}
