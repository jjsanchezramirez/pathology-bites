import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { EditableLabel } from "../../editable-label";
import { getAnimationDisplayName } from "../../../utils/formatters";
import type { SelectedImage, Animation } from "../../../types";

interface ZoomPanSectionProps {
  selectedImage: SelectedImage;
  imageIndex: number;
  onAddAnimation: (imageIndex: number, type: Animation["type"]) => void;
  onRemoveAnimation: (imageIndex: number, animId: string) => void;
  onUpdateAnimation: (imageIndex: number, animId: string, updates: Partial<Animation>) => void;
}

export function ZoomPanSection({
  selectedImage,
  imageIndex,
  onAddAnimation,
  onRemoveAnimation,
  onUpdateAnimation,
}: ZoomPanSectionProps) {
  const zoomPanAnimations = selectedImage.animations.filter(
    (a) => a.type === "zoom" || a.type === "pan"
  );

  return (
    <AccordionItem value="zoom">
      <AccordionTrigger className="text-sm font-medium py-3">
        Zoom & Pan ({zoomPanAnimations.length})
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-4">
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddAnimation(imageIndex, "zoom")}
            className="w-full text-xs h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            Zoom
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddAnimation(imageIndex, "pan")}
            className="w-full text-xs h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            Pan
          </Button>
        </div>

        {zoomPanAnimations.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            No camera animations yet
          </div>
        ) : (
          <div className="space-y-2">
            {zoomPanAnimations.map((anim) => (
              <div key={anim.id} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{getAnimationDisplayName(anim.type)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveAnimation(imageIndex, anim.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Timing controls */}
                <div
                  className={`grid ${anim.type === "pan" ? "grid-cols-2" : "grid-cols-3"} gap-2`}
                >
                  <div>
                    <Label className="text-xs">Start (s)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={selectedImage.duration}
                      step={0.1}
                      defaultValue={anim.start}
                      key={`anim-start-${anim.id}`}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) {
                          onUpdateAnimation(imageIndex, anim.id, {
                            start: Math.max(0, Math.min(selectedImage.duration, val)),
                          });
                        }
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                  {anim.type === "zoom" && (
                    <div>
                      <Label className="text-xs">Duration (s)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={selectedImage.duration}
                        step={0.1}
                        defaultValue={anim.duration}
                        key={`anim-duration-${anim.id}`}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (!isNaN(val)) {
                            onUpdateAnimation(imageIndex, anim.id, {
                              duration: Math.max(0, Math.min(selectedImage.duration, val)),
                            });
                          }
                        }}
                        className="h-7 text-xs"
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Fade (s)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={anim.type === "pan" ? selectedImage.duration : 2}
                      step={0.1}
                      defaultValue={anim.fadeTime}
                      key={`anim-fade-${anim.id}`}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) {
                          const maxFade = anim.type === "pan" ? selectedImage.duration : 2;
                          onUpdateAnimation(imageIndex, anim.id, {
                            fadeTime: Math.max(0, Math.min(maxFade, val)),
                          });
                        }
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                {/* Type-specific controls */}
                {(anim.type === "zoom" || anim.type === "pan") && (
                  <>
                    <div>
                      <EditableLabel
                        label="Target Scale"
                        value={anim.targetScale}
                        min={0.5}
                        max={3}
                        step={0.1}
                        suffix="x"
                        onSave={(val) =>
                          onUpdateAnimation(imageIndex, anim.id, {
                            targetScale: val,
                          })
                        }
                      />
                      <Input
                        type="range"
                        min={0.5}
                        max={3}
                        step={0.1}
                        value={anim.targetScale}
                        onChange={(e) =>
                          onUpdateAnimation(imageIndex, anim.id, {
                            targetScale: Number(e.target.value),
                          })
                        }
                        className="h-6 [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <EditableLabel
                          label="Target X"
                          value={50 - anim.targetX}
                          min={0}
                          max={100}
                          step={5}
                          suffix="%"
                          onSave={(val) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              targetX: 50 - val,
                            })
                          }
                        />
                        <Input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={50 - anim.targetX}
                          onChange={(e) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              targetX: 50 - Number(e.target.value),
                            })
                          }
                          className="h-6"
                        />
                      </div>
                      <div>
                        <EditableLabel
                          label="Target Y"
                          value={50 - anim.targetY}
                          min={0}
                          max={100}
                          step={5}
                          suffix="%"
                          onSave={(val) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              targetY: 50 - val,
                            })
                          }
                        />
                        <Input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={50 - anim.targetY}
                          onChange={(e) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              targetY: 50 - Number(e.target.value),
                            })
                          }
                          className="h-6"
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => {
                        onUpdateAnimation(imageIndex, anim.id, {
                          targetScale: selectedImage.initialZoom,
                          targetX: selectedImage.initialX,
                          targetY: selectedImage.initialY,
                        });
                      }}
                    >
                      Reset to Default
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
