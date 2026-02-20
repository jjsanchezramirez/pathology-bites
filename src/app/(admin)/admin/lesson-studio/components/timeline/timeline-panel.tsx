import { forwardRef } from "react";
import type { SelectedImage } from "../../types";
import { formatNumber } from "../../utils/formatters";
import { getImageTitle } from "../../utils/image-helpers";

interface TimelinePanelProps {
  selectedImages: SelectedImage[];
  selectedImageIndex: number | null;
  audioDuration: number;
  onSegmentSelect: (index: number) => void;
}

export const TimelinePanel = forwardRef<HTMLDivElement, TimelinePanelProps>(
  ({ selectedImages, selectedImageIndex, audioDuration, onSegmentSelect }, ref) => {
    if (selectedImages.length === 0) {
      return (
        <div className="h-40 border-t bg-white pb-4">
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Timeline will appear here
          </div>
        </div>
      );
    }

    const segmentsDuration = selectedImages.reduce((sum, img) => sum + img.duration, 0);
    const baseTimelineDuration = Math.max(segmentsDuration, audioDuration);
    const endCushion = 2; // small visual breathing room on the right
    const timelineDuration = baseTimelineDuration + endCushion;

    // Generate tick marks for time ruler
    const ticks = [];
    for (let t = 0; t <= baseTimelineDuration; t += 1) {
      const isMajor = t % 5 === 0;
      const left = (t / timelineDuration) * 100;

      ticks.push(
        <div
          key={t}
          className="absolute flex flex-col items-center"
          style={{ left: `${left}%`, transform: "translateX(-50%)" }}
        >
          {/* Tick mark */}
          <div className={`${isMajor ? "h-4 w-0.5 bg-gray-400" : "h-2 w-px bg-gray-300"}`} />
          {/* Time label for major ticks */}
          {isMajor && (
            <span className="text-[10px] text-muted-foreground mt-0.5 select-none">
              {formatNumber(t)}s
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="h-40 border-t bg-white pb-4">
        <div className="h-full flex flex-col relative">
          {/* Time Ruler - wrapped in a div with padding to match segments */}
          <div className="relative h-8 border-b bg-muted/20">
            <div className="relative h-full px-8">
              <div className="relative h-full">{ticks}</div>
            </div>
          </div>

          {/* Segment Blocks */}
          <div className="flex-1 relative px-8 py-3 overflow-x-auto" ref={ref}>
            <div className="h-full flex relative">
              {/* Segments */}
              {selectedImages.map((img, index) => {
                const widthPercent = (img.duration / timelineDuration) * 100;

                // Determine text size based on segment duration/width
                // Very narrow segments (< 3% of timeline or < 2s)
                const isVeryNarrow = widthPercent < 3 || img.duration < 2;
                // Narrow segments (< 5% of timeline or < 4s)
                const isNarrow = widthPercent < 5 || img.duration < 4;

                let segmentLabel = `Segment ${index + 1}`;
                let showDetails = true;

                if (isVeryNarrow) {
                  segmentLabel = `S${index + 1}`;
                  showDetails = false;
                } else if (isNarrow) {
                  segmentLabel = `Seg ${index + 1}`;
                  showDetails = false;
                }

                return (
                  <div
                    key={index}
                    className={`
                      h-full rounded transition-all cursor-pointer relative group overflow-hidden
                      ${selectedImageIndex === index ? "ring-2 ring-blue-600 ring-offset-2" : ""}
                    `}
                    style={{ width: `${widthPercent}%`, minWidth: "40px" }}
                    onClick={() => onSegmentSelect(index)}
                  >
                    {/* Background Image */}
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${img.url})`,
                        filter: "brightness(0.7)",
                      }}
                    />

                    {/* Colored bar at top - alternating primary and yellow */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 ${index % 2 === 0 ? "bg-primary" : "bg-yellow-500"}`}
                    />

                    {/* Segment info overlay */}
                    <div className="relative h-full p-2 flex flex-col text-white">
                      <div className="text-xs font-semibold truncate drop-shadow-md">
                        {segmentLabel}
                      </div>
                      {showDetails && (
                        <>
                          <div className="text-[10px] opacity-90 mt-0.5 drop-shadow-md">
                            {formatNumber(img.duration)}s
                          </div>
                          <div className="flex-1" />
                          <div className="text-[10px] opacity-90 drop-shadow-md truncate">
                            {img.animations.length} anim
                            {img.animations.length !== 1 ? "s" : ""} • {img.textOverlays.length}{" "}
                            text
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                      <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        {getImageTitle(img)} ({formatNumber(img.duration)}s)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audio end marker - spans entire timeline height */}
          {audioDuration > 0 && (
            <div
              className="absolute top-0 bottom-0 bg-red-500 pointer-events-none z-10"
              style={{
                left: `calc(${(audioDuration / timelineDuration) * 100}% + 2rem)`,
                width: "3px",
              }}
            />
          )}
        </div>
      </div>
    );
  }
);

TimelinePanel.displayName = "TimelinePanel";
