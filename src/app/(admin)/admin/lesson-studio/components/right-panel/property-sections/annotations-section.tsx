import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Plus, Trash2, Palette } from "lucide-react";
import { EditableLabel } from "../../editable-label";
import { getAnimationDisplayName } from "../../../utils/formatters";
import type { SelectedImage, Animation } from "../../../types";

interface AnnotationsSectionProps {
  selectedImage: SelectedImage;
  imageIndex: number;
  onAddAnimation: (imageIndex: number, type: Animation["type"]) => void;
  onRemoveAnimation: (imageIndex: number, animId: string) => void;
  onUpdateAnimation: (imageIndex: number, animId: string, updates: Partial<Animation>) => void;
}

export function AnnotationsSection({
  selectedImage,
  imageIndex,
  onAddAnimation,
  onRemoveAnimation,
  onUpdateAnimation,
}: AnnotationsSectionProps) {
  const annotationAnimations = selectedImage.animations.filter(
    (a) => a.type !== "zoom" && a.type !== "pan"
  );

  return (
    <AccordionItem value="annotations">
      <AccordionTrigger className="text-sm font-medium py-3">
        Animations ({annotationAnimations.length})
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-4">
        {/* Add Annotation Buttons */}
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddAnimation(imageIndex, "figure")}
            className="w-full text-xs h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            Shapes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddAnimation(imageIndex, "spotlight")}
            className="w-full text-xs h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            Spotlight
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddAnimation(imageIndex, "arrow")}
            className="w-full text-xs h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            Arrows
          </Button>
        </div>

        {annotationAnimations.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">No annotations yet</div>
        ) : (
          <div className="space-y-2">
            {annotationAnimations.map((anim) => (
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
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Start (s)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={selectedImage.duration}
                      step={0.1}
                      defaultValue={anim.start}
                      key={`anim-start-${anim.id}-${imageIndex}`}
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
                  <div>
                    <Label className="text-xs">Duration (s)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={selectedImage.duration}
                      step={0.1}
                      defaultValue={anim.duration}
                      key={`anim-duration-${anim.id}-${imageIndex}`}
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
                  <div>
                    <Label className="text-xs">Fade (s)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      defaultValue={anim.fadeTime}
                      key={`anim-fade-${anim.id}-${imageIndex}`}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) {
                          onUpdateAnimation(imageIndex, anim.id, {
                            fadeTime: Math.max(0, Math.min(2, val)),
                          });
                        }
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                {/* Type-specific controls */}
                {(anim.type === "figure" || anim.type === "spotlight") && (
                  <>
                    <div>
                      <Label className="text-xs">Shape</Label>
                      <Select
                        value={anim.figureType}
                        onValueChange={(value) =>
                          onUpdateAnimation(imageIndex, anim.id, {
                            figureType: value as "circle" | "rectangle",
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="circle">Circle</SelectItem>
                          <SelectItem value="oval">Oval</SelectItem>
                          <SelectItem value="rectangle">Rectangle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <EditableLabel
                          label="X"
                          value={anim.position.x}
                          min={0}
                          max={100}
                          step={5}
                          suffix="%"
                          onSave={(val) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              position: { ...anim.position, x: val },
                            })
                          }
                        />
                        <Input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={anim.position.x}
                          onChange={(e) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              position: {
                                ...anim.position,
                                x: Number(e.target.value),
                              },
                            })
                          }
                          className="h-6"
                        />
                      </div>
                      <div>
                        <EditableLabel
                          label="Y"
                          value={anim.position.y}
                          min={0}
                          max={100}
                          step={5}
                          suffix="%"
                          onSave={(val) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              position: { ...anim.position, y: val },
                            })
                          }
                        />
                        <Input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={anim.position.y}
                          onChange={(e) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              position: {
                                ...anim.position,
                                y: Number(e.target.value),
                              },
                            })
                          }
                          className="h-6"
                        />
                      </div>
                    </div>
                    {anim.figureType === "circle" ? (
                      <div>
                        <EditableLabel
                          label="Radius"
                          value={anim.size.width}
                          min={10}
                          max={100}
                          step={5}
                          suffix="%"
                          onSave={(val) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              size: { ...anim.size, width: val },
                            })
                          }
                        />
                        <Input
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={anim.size.width}
                          onChange={(e) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              size: { ...anim.size, width: Number(e.target.value) },
                            })
                          }
                          className="h-6"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <EditableLabel
                            label="Width"
                            value={anim.size.width}
                            min={10}
                            max={100}
                            step={5}
                            suffix="%"
                            onSave={(val) =>
                              onUpdateAnimation(imageIndex, anim.id, {
                                size: { ...anim.size, width: val },
                              })
                            }
                          />
                          <Input
                            type="range"
                            min={10}
                            max={100}
                            step={5}
                            value={anim.size.width}
                            onChange={(e) =>
                              onUpdateAnimation(imageIndex, anim.id, {
                                size: {
                                  ...anim.size,
                                  width: Number(e.target.value),
                                },
                              })
                            }
                            className="h-6"
                          />
                        </div>
                        <div>
                          <EditableLabel
                            label="Height"
                            value={anim.size.height}
                            min={10}
                            max={100}
                            step={5}
                            suffix="%"
                            onSave={(val) =>
                              onUpdateAnimation(imageIndex, anim.id, {
                                size: { ...anim.size, height: val },
                              })
                            }
                          />
                          <Input
                            type="range"
                            min={10}
                            max={100}
                            step={5}
                            value={anim.size.height}
                            onChange={(e) =>
                              onUpdateAnimation(imageIndex, anim.id, {
                                size: {
                                  ...anim.size,
                                  height: Number(e.target.value),
                                },
                              })
                            }
                            className="h-6"
                          />
                        </div>
                      </div>
                    )}
                    {anim.type === "figure" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs mb-2 block">Border Color</Label>
                          <div className="flex gap-2 items-center flex-wrap">
                            {[
                              { color: "#FFFFFF", label: "White" },
                              { color: "#000000", label: "Black" },
                            ].map((option) => (
                              <button
                                key={option.color}
                                type="button"
                                onClick={() =>
                                  onUpdateAnimation(imageIndex, anim.id, {
                                    borderColor: option.color,
                                  })
                                }
                                className={`
                                  w-6 h-6 rounded-full border-2 transition-all
                                  ${anim.borderColor.toUpperCase() === option.color ? "ring-2 ring-primary ring-offset-1" : "hover:scale-110"}
                                `}
                                style={{
                                  backgroundColor: option.color,
                                  borderColor:
                                    option.color === "#FFFFFF" ? "#E5E7EB" : option.color,
                                }}
                                title={option.label}
                              />
                            ))}
                            <div className="relative">
                              <input
                                type="color"
                                id={`figure-color-picker-${anim.id}`}
                                value={anim.borderColor}
                                onChange={(e) =>
                                  onUpdateAnimation(imageIndex, anim.id, {
                                    borderColor: e.target.value,
                                  })
                                }
                                className="absolute opacity-0 w-0 h-0"
                              />
                              <label
                                htmlFor={`figure-color-picker-${anim.id}`}
                                className="cursor-pointer hover:scale-110 transition-all flex items-center justify-center"
                                title="Custom color"
                              >
                                <Palette className="h-5 w-5 text-gray-600" />
                              </label>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs mb-2 block">Border Style</Label>
                          <div className="flex gap-1">
                            {[
                              { style: "solid", label: "Solid" },
                              { style: "dotted", label: "Dotted" },
                              { style: "dashed", label: "Dashed" },
                            ].map((option) => (
                              <button
                                key={option.style}
                                type="button"
                                onClick={() =>
                                  onUpdateAnimation(imageIndex, anim.id, {
                                    borderStyle: option.style as typeof anim.borderStyle,
                                  })
                                }
                                className={`
                                  px-2 py-1 text-xs rounded transition-all
                                  ${
                                    anim.borderStyle === option.style
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                                  }
                                `}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {anim.type === "arrow" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <EditableLabel
                          label="X"
                          value={anim.position.x}
                          min={0}
                          max={100}
                          step={5}
                          suffix="%"
                          onSave={(val) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              position: { ...anim.position, x: val },
                            })
                          }
                        />
                        <Input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={anim.position.x}
                          onChange={(e) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              position: {
                                ...anim.position,
                                x: Number(e.target.value),
                              },
                            })
                          }
                          className="h-6"
                        />
                      </div>
                      <div>
                        <EditableLabel
                          label="Y"
                          value={anim.position.y}
                          min={0}
                          max={100}
                          step={5}
                          suffix="%"
                          onSave={(val) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              position: { ...anim.position, y: val },
                            })
                          }
                        />
                        <Input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={anim.position.y}
                          onChange={(e) =>
                            onUpdateAnimation(imageIndex, anim.id, {
                              position: {
                                ...anim.position,
                                y: Number(e.target.value),
                              },
                            })
                          }
                          className="h-6"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs mb-2 block">Direction</Label>
                        <div className="grid grid-cols-3 gap-0.5 w-fit">
                          {[
                            { dir: "up-left", label: "↖" },
                            { dir: "up", label: "↑" },
                            { dir: "up-right", label: "↗" },
                            { dir: "left", label: "←" },
                            { dir: null, label: "•" },
                            { dir: "right", label: "→" },
                            { dir: "down-left", label: "↙" },
                            { dir: "down", label: "↓" },
                            { dir: "down-right", label: "↘" },
                          ].map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              disabled={!item.dir}
                              onClick={() =>
                                item.dir &&
                                onUpdateAnimation(imageIndex, anim.id, {
                                  direction: item.dir as typeof anim.direction,
                                })
                              }
                              className={`
                                w-6 h-6 flex items-center justify-center text-sm rounded
                                ${!item.dir ? "cursor-default text-gray-400" : ""}
                                ${
                                  item.dir && anim.direction === item.dir
                                    ? "bg-primary text-primary-foreground"
                                    : item.dir
                                      ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                                      : "bg-transparent"
                                }
                                transition-all
                              `}
                              title={item.dir ? item.dir : "center"}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs mb-2 block">Color</Label>
                        <div className="flex gap-2 items-center flex-wrap">
                          {[
                            { color: "#FFFFFF", label: "White" },
                            { color: "#000000", label: "Black" },
                          ].map((option) => (
                            <button
                              key={option.color}
                              type="button"
                              onClick={() =>
                                onUpdateAnimation(imageIndex, anim.id, {
                                  color: option.color,
                                })
                              }
                              className={`
                                w-6 h-6 rounded-full border-2 transition-all
                                ${anim.color.toUpperCase() === option.color ? "ring-2 ring-primary ring-offset-1" : "hover:scale-110"}
                              `}
                              style={{
                                backgroundColor: option.color,
                                borderColor: option.color === "#FFFFFF" ? "#E5E7EB" : option.color,
                              }}
                              title={option.label}
                            />
                          ))}
                          <div className="relative">
                            <input
                              type="color"
                              id={`arrow-color-picker-${anim.id}`}
                              value={anim.color}
                              onChange={(e) =>
                                onUpdateAnimation(imageIndex, anim.id, {
                                  color: e.target.value,
                                })
                              }
                              className="absolute opacity-0 w-0 h-0"
                            />
                            <label
                              htmlFor={`arrow-color-picker-${anim.id}`}
                              className="cursor-pointer hover:scale-110 transition-all flex items-center justify-center"
                              title="Custom color"
                            >
                              <Palette className="h-5 w-5 text-gray-600" />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
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
