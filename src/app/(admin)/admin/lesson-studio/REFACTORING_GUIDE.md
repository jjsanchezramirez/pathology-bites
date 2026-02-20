# Lesson Studio Refactoring Guide

This document explains the refactoring of the lesson studio from a single 4,077-line file into a well-organized, modular structure.

## Directory Structure

```
src/app/(admin)/admin/lesson-studio/
├── page.tsx (main orchestrator)
├── types/
│   └── index.ts
├── utils/
│   ├── interpolation.ts
│   ├── formatters.ts
│   ├── image-helpers.ts
│   ├── caption-builder.ts
│   ├── sequence-generator.ts
│   └── sequence-loader.ts
├── services/
│   └── export-engine.ts
└── components/
    ├── editable-label.tsx
    ├── delete-confirm-dialog.tsx
    ├── audio-picker-dialog.tsx
    ├── export-dialog.tsx
    ├── left-panel/
    │   └── image-library-panel.tsx
    ├── center-panel/
    │   └── preview-panel.tsx
    └── right-panel/
        ├── properties-panel.tsx
        └── property-sections/
            ├── index.ts
            ├── timing-section.tsx
            ├── framing-section.tsx
            ├── zoom-pan-section.tsx
            ├── annotations-section.tsx
            └── text-overlays-section.tsx
```

## Files Created

### Types (`/types/index.ts`)
- `LibraryImage` - Image metadata interface
- `BaseAnimation`, `ZoomAnimation`, `PanAnimation`, `FigureAnimation`, `SpotlightAnimation`, `ArrowAnimation` - Animation type definitions
- `Animation` - Union type of all animations
- `TimeBasedText` - Text overlay interface
- `SelectedImage` - Extended image with animations
- `ExportPhase`, `ExportResolution` - Export-related types

### Utils

#### `/utils/interpolation.ts`
- `lerp()` - Linear interpolation
- `lerpTransform()` - Transform interpolation
- `findKeyframePair()` - Find keyframes for interpolation
- `lerpHighlight()` - Highlight interpolation
- `interpolateHighlights()` - Batch highlight interpolation
- `interpolateArrows()` - Arrow interpolation
- `interpolateTextOverlays()` - Text overlay interpolation

#### `/utils/formatters.ts`
- `formatNumber()` - Format numbers without trailing zeros
- `formatDuration()` - Format seconds as MM:SS
- `getAnimationDisplayName()` - Get display name for animation types

#### `/utils/image-helpers.ts`
- `getImageTitle()` - Extract title from image
- `calculateCoverZoom()` - Calculate initial zoom to cover viewport

#### `/utils/caption-builder.ts`
- `buildCaptionChunks()` - Build caption chunks from transcript

#### `/utils/sequence-generator.ts`
- `generateSequence()` - Generate complete ExplainerSequence from selected images
  - Handles all animation types (zoom, pan, figures, spotlights, arrows)
  - Manages keyframe generation
  - Integrates caption generation

#### `/utils/sequence-loader.ts`
- `loadFromJSON()` - Load sequence from JSON (reverse-engineers animations)
- `saveToJSON()` - Save current state as downloadable JSON
- `handleStageDrop()` - Handle JSON file drop

### Services

#### `/services/export-engine.ts`
- `computeFrameState()` - Compute frame state at given time
- `drawExportFrame()` - Draw frame to canvas
- Used by export-dialog for video rendering

### Components

#### Core Components
- `/components/editable-label.tsx` - Inline editable label with validation
- `/components/delete-confirm-dialog.tsx` - Delete confirmation dialog
- `/components/audio-picker-dialog.tsx` - Audio selection dialog with search
- `/components/export-dialog.tsx` - Complete export dialog with FFmpeg integration

#### Panel Components
- `/components/left-panel/image-library-panel.tsx` - Image library and sequence list
- `/components/center-panel/preview-panel.tsx` - Preview player with drag-drop support
- `/components/right-panel/properties-panel.tsx` - Properties editor container

#### Property Section Components
- `/components/right-panel/property-sections/timing-section.tsx` - Duration/transition controls
- `/components/right-panel/property-sections/framing-section.tsx` - Initial zoom/position controls
- `/components/right-panel/property-sections/zoom-pan-section.tsx` - Zoom/pan animation management
- `/components/right-panel/property-sections/annotations-section.tsx` - Figures/spotlights/arrows
- `/components/right-panel/property-sections/text-overlays-section.tsx` - Text overlay management

## Integration Steps

### Step 1: Update Imports in page.tsx

At the top of `page.tsx`, add these imports and remove old function definitions:

```typescript
// Type imports
import type { LibraryImage, SelectedImage, Animation, TimeBasedText } from "./types";

// Utility imports
import { formatNumber, getAnimationDisplayName } from "./utils/formatters";
import { getImageTitle, calculateCoverZoom } from "./utils/image-helpers";
import { buildCaptionChunks } from "./utils/caption-builder";
import { generateSequence } from "./utils/sequence-generator";
import { loadFromJSON, saveToJSON } from "./utils/sequence-loader";

// Component imports
import { DeleteConfirmDialog } from "./components/delete-confirm-dialog";
import { AudioPickerDialog } from "./components/audio-picker-dialog";
import { ExportDialog } from "./components/export-dialog";
import { ImageLibraryPanel } from "./components/left-panel/image-library-panel";
import { PreviewPanel } from "./components/center-panel/preview-panel";
import { PropertiesPanel } from "./components/right-panel/properties-panel";
```

### Step 2: Remove Redundant Code

Delete these sections from `page.tsx`:

1. **Type definitions** (lines 61-241):
   - `LibraryImage`, `BaseAnimation`, all animation interfaces
   - `Animation` union type
   - `TimeBasedText`, `SelectedImage`
   - Move to using imports from `./types`

2. **Constants** (lines 627-632):
   - `EXPORT_RESOLUTIONS`, `EXPORT_FPS_OPTIONS`
   - These are now exported from `export-dialog.tsx`

3. **Helper functions** (lines 76-79, 898-978):
   - `formatNumber`
   - `formatDuration`
   - `getAnimationDisplayName`
   - `getImageTitle`
   - `calculateCoverZoom`
   - Now imported from utils

4. **Canvas export engine** (lines 247-625):
   - All interpolation functions
   - `computeFrameState`
   - `drawExportFrame`
   - Now in `services/export-engine.ts` and used by `export-dialog.tsx`

5. **Sequence functions** (lines 693-1618):
   - `loadFromJSON`
   - `saveToJSON`
   - `buildCaptionChunks`
   - `generateSequence`
   - `handleAIGenerate` - Keep this but use imported `generateSequence`
   - Now imported from utils

6. **EditableLabel component** (lines 82-164):
   - Now imported from `./components/editable-label`

### Step 3: Update State Management

Remove export-related state (now managed internally by ExportDialog):
```typescript
// REMOVE these:
const [exportOpen, setExportOpen] = useState(false);
const [exportPhase, setExportPhase] = useState<ExportPhase>("idle");
const [exportProgress, setExportProgress] = useState(0);
const [exportStatus, setExportStatus] = useState("");
const [exportUrl, setExportUrl] = useState<string | null>(null);
const [exportName, setExportName] = useState("");
const exportCancelRef = useRef(false);
const [exportResolution, setExportResolution] = useState(1);
const [exportFps, setExportFps] = useState(30);

// KEEP these:
const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
const [audioUrl, setAudioUrl] = useState(DEFAULT_AUDIO_URL);
const [previewSequence, setPreviewSequence] = useState<ExplainerSequence | null>(null);
const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
const [seekTime, setSeekTime] = useState<number | undefined>(undefined);
const [audioDuration, setAudioDuration] = useState<number>(0);
const [audioPickerOpen, setAudioPickerOpen] = useState(false);
const [audioRecords, setAudioRecords] = useState<AudioRecord[]>([]);
const [audioSearch, setAudioSearch] = useState("");
const [audioLoading, setAudioLoading] = useState(false);
const [audioTitle, setAudioTitle] = useState("");
const [audioTranscript, setAudioTranscript] = useState("");
const [captionChunks, setCaptionChunks] = useState<CaptionChunk[]>([]);
const [isDragOver, setIsDragOver] = useState(false);
const [isGenerating, setIsGenerating] = useState(false);
const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
const timelineRef = useRef<HTMLDivElement>(null);
const playerContainerRef = useRef<HTMLDivElement>(null);
```

Add state for export dialog:
```typescript
const [exportDialogOpen, setExportDialogOpen] = useState(false);
```

### Step 4: Update CRUD Functions

Keep these functions as-is (they're used by multiple components):
- `addImage()`
- `addImages()`
- `removeImage()`
- `updateImage()`
- `addAnimation()`
- `removeAnimation()`
- `updateAnimation()`
- `addText()`
- `removeText()`
- `updateText()`
- `handleSegmentSelect()`
- `loadAudioRecords()`
- `handleSelectAudio()`

Update these to use imported utilities:
```typescript
// Replace inline logic with:
const generateSequence = () => {
  const sequence = generateSequenceUtil(selectedImages, audioUrl, audioTranscript, audioDuration);
  if (sequence) {
    setPreviewSequence(sequence);
    if (audioTranscript && audioDuration > 0) {
      setCaptionChunks(buildCaptionChunks(audioTranscript, audioDuration));
    }
  }
};

const saveToJSON = () => {
  saveToJSONUtil(selectedImages, audioUrl, audioTranscript, audioDuration);
};

const handleStageDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragOver(false);
  const file = e.dataTransfer.files?.[0];
  if (!file || !file.name.endsWith(".json")) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const raw = JSON.parse(ev.target?.result as string);
      const parsed: ExplainerSequence = raw?.sequence ?? raw;
      if (!parsed.segments || !Array.isArray(parsed.segments)) {
        alert("Invalid sequence JSON — missing segments array.");
        return;
      }
      const loadedImages = loadFromJSON(parsed);
      setSelectedImages(loadedImages);
      setSelectedImageIndex(null);
      setPreviewSequence(parsed);
      if (parsed.audioUrl) setAudioUrl(parsed.audioUrl);
      if (parsed.captions && parsed.captions.length > 0) {
        setCaptionChunks(parsed.captions);
      }
    } catch {
      alert("Failed to parse JSON file.");
    }
  };
  reader.readAsText(file);
};
```

### Step 5: Replace JSX with Components

Replace the main content area (lines 2023-4074) with:

```typescript
return (
  <div className="h-screen flex flex-col">
    {/* Header */}
    <div className="border-b px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold">Lesson Studio</h1>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => saveToJSON(selectedImages, audioUrl, audioTranscript, audioDuration)}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Save to JSON
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => setExportDialogOpen(true)}
          disabled={selectedImages.length === 0}
          className="flex items-center gap-2"
        >
          <Video className="h-4 w-4" />
          Export MP4
        </Button>
      </div>
    </div>

    {/* Main Content Area */}
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {/* Left Panel */}
      <ImageLibraryPanel
        selectedImages={selectedImages}
        selectedImageIndex={selectedImageIndex}
        audioUrl={audioUrl}
        audioTitle={audioTitle}
        audioDuration={audioDuration}
        onAddImage={addImage}
        onAddImages={addImages}
        onSegmentSelect={handleSegmentSelect}
        onAudioPickerOpen={() => setAudioPickerOpen(true)}
      />

      {/* Center Panel */}
      <div className="flex-1 flex overflow-hidden">
        <PreviewPanel
          ref={playerContainerRef}
          previewSequence={previewSequence}
          audioUrl={audioUrl}
          audioTranscript={audioTranscript}
          seekTime={seekTime}
          captionChunks={captionChunks}
          selectedImagesCount={selectedImages.length}
          isGenerating={isGenerating}
          isDragOver={isDragOver}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
          }}
          onDrop={handleStageDrop}
          onAudioLoaded={setAudioDuration}
          onAIGenerate={handleAIGenerate}
          onManualPreview={() => {
            const seq = generateSequence(selectedImages, audioUrl, audioTranscript, audioDuration);
            if (seq) {
              setPreviewSequence(seq);
              if (audioTranscript && audioDuration > 0) {
                setCaptionChunks(buildCaptionChunks(audioTranscript, audioDuration));
              }
            }
          }}
        />

        {/* Right Panel */}
        <PropertiesPanel
          selectedImage={selectedImageIndex !== null ? selectedImages[selectedImageIndex] : null}
          selectedImageIndex={selectedImageIndex}
          isLastImage={selectedImageIndex === selectedImages.length - 1}
          onUpdateImage={updateImage}
          onCalculateCoverZoom={calculateCoverZoom}
          onAddAnimation={addAnimation}
          onRemoveAnimation={removeAnimation}
          onUpdateAnimation={updateAnimation}
          onAddText={addText}
          onRemoveText={removeText}
          onUpdateText={updateText}
          onDeleteSegment={() => setDeleteConfirmIndex(selectedImageIndex)}
        />
      </div>
    </div>

    {/* Dialogs */}
    <DeleteConfirmDialog
      open={deleteConfirmIndex !== null}
      onOpenChange={() => setDeleteConfirmIndex(null)}
      segmentIndex={deleteConfirmIndex}
      onConfirm={() => {
        if (deleteConfirmIndex !== null) {
          removeImage(deleteConfirmIndex);
          setDeleteConfirmIndex(null);
        }
      }}
    />

    <AudioPickerDialog
      open={audioPickerOpen}
      onOpenChange={setAudioPickerOpen}
      audioRecords={audioRecords}
      audioSearch={audioSearch}
      onSearchChange={setAudioSearch}
      audioLoading={audioLoading}
      selectedAudioUrl={audioUrl}
      onSelectAudio={handleSelectAudio}
    />

    <ExportDialog
      open={exportDialogOpen}
      onOpenChange={setExportDialogOpen}
      previewSequence={previewSequence}
      audioUrl={audioUrl}
    />
  </div>
);
```

### Step 6: Update Auto-preview Effect

Update the auto-preview effect to use the imported utility:

```typescript
useEffect(() => {
  if (selectedImages.length > 0 && audioUrl && previewSequence) {
    const timer = setTimeout(() => {
      const seq = generateSequence(selectedImages, audioUrl, audioTranscript, audioDuration);
      if (seq) setPreviewSequence(seq);
    }, 500);

    return () => clearTimeout(timer);
  }
}, [selectedImages]);
```

## Benefits of Refactoring

1. **Modularity**: Each component has a single, well-defined responsibility
2. **Reusability**: Components can be used independently or in other contexts
3. **Maintainability**: Changes to one component don't affect others
4. **Testability**: Individual functions and components can be tested in isolation
5. **Readability**: Main page.tsx is now ~300-400 lines instead of 4,077
6. **Type Safety**: All components are properly typed with TypeScript
7. **Performance**: Easier to optimize specific parts without affecting the whole

## File Size Reduction

- **Original**: 1 file, 4,077 lines
- **Refactored**: 25+ files, averaging ~100-500 lines each
- **Main page.tsx**: Reduced to ~300-400 lines (>90% reduction)

## Testing Checklist

After integration, test these features:

- [ ] Add images to sequence
- [ ] Select and configure audio
- [ ] AI Generate sequence
- [ ] Manual Preview
- [ ] Edit segment timing
- [ ] Edit initial framing (zoom, X, Y)
- [ ] Add/remove/edit zoom animations
- [ ] Add/remove/edit pan animations
- [ ] Add/remove/edit figures
- [ ] Add/remove/edit spotlights
- [ ] Add/remove/edit arrows
- [ ] Add/remove/edit text overlays
- [ ] Delete segments
- [ ] Save to JSON
- [ ] Load from JSON (drag & drop)
- [ ] Export MP4 video
- [ ] Audio picker search
- [ ] Segment selection and timeline sync

## Troubleshooting

If you encounter issues:

1. **Import errors**: Check that all imports use correct relative paths
2. **Type errors**: Ensure types are imported from `./types` not redefined
3. **Missing functions**: Verify all utility functions are imported
4. **State not updating**: Check that prop callbacks are correctly passed down
5. **Export dialog not working**: Ensure `export-dialog.tsx` has all FFmpeg dependencies

## Next Steps

1. Test the refactored application thoroughly
2. Consider extracting more hooks if state management becomes complex
3. Add unit tests for utility functions
4. Add integration tests for components
5. Document any additional helper functions
