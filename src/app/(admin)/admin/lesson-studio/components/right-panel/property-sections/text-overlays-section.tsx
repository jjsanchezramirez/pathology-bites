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
import { formatNumber } from "../../../utils/formatters";
import type { SelectedImage, TimeBasedText } from "../../../types";

interface TextOverlaysSectionProps {
  selectedImage: SelectedImage;
  imageIndex: number;
  onAddText: (imageIndex: number) => void;
  onRemoveText: (imageIndex: number, textId: string) => void;
  onUpdateText: (imageIndex: number, textId: string, updates: Partial<TimeBasedText>) => void;
}

export function TextOverlaysSection({
  selectedImage,
  imageIndex,
  onAddText,
  onRemoveText,
  onUpdateText,
}: TextOverlaysSectionProps) {
  return (
    <AccordionItem value="text">
      <AccordionTrigger className="text-sm font-medium py-3">
        Text ({selectedImage.textOverlays.length})
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-4">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAddText(imageIndex)}
          className="w-full text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Text
        </Button>

        {selectedImage.textOverlays.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">No text overlays yet</div>
        ) : (
          <div className="space-y-2">
            {selectedImage.textOverlays.map((text) => (
              <div key={text.id} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Text</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveText(imageIndex, text.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div>
                  <Input
                    value={text.text}
                    onChange={(e) =>
                      onUpdateText(imageIndex, text.id, {
                        text: e.target.value,
                      })
                    }
                    className="h-7 text-xs"
                  />
                </div>

                {/* Timing controls */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Start (s)</Label>
                    <Input
                      key={`start-${text.id}-${imageIndex}`}
                      type="number"
                      min={0}
                      max={selectedImage.duration}
                      step={0.1}
                      defaultValue={text.start}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) {
                          onUpdateText(imageIndex, text.id, {
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
                      key={`duration-${text.id}-${imageIndex}`}
                      type="number"
                      min={0}
                      max={selectedImage.duration}
                      step={0.1}
                      defaultValue={text.duration}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) {
                          onUpdateText(imageIndex, text.id, {
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
                      key={`fade-${text.id}-${imageIndex}`}
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      defaultValue={text.fadeTime}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val)) {
                          onUpdateText(imageIndex, text.id, {
                            fadeTime: Math.max(0, Math.min(2, val)),
                          });
                        }
                      }}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <EditableLabel
                      label="X"
                      value={text.position.x}
                      min={0}
                      max={100}
                      step={5}
                      suffix="%"
                      onSave={(val) =>
                        onUpdateText(imageIndex, text.id, {
                          position: { ...text.position, x: val },
                        })
                      }
                    />
                    <Input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={text.position.x}
                      onChange={(e) =>
                        onUpdateText(imageIndex, text.id, {
                          position: { ...text.position, x: Number(e.target.value) },
                        })
                      }
                      className="h-6"
                    />
                  </div>
                  <div>
                    <EditableLabel
                      label="Y"
                      value={text.position.y}
                      min={0}
                      max={100}
                      step={5}
                      suffix="%"
                      onSave={(val) =>
                        onUpdateText(imageIndex, text.id, {
                          position: { ...text.position, y: val },
                        })
                      }
                    />
                    <Input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={text.position.y}
                      onChange={(e) =>
                        onUpdateText(imageIndex, text.id, {
                          position: { ...text.position, y: Number(e.target.value) },
                        })
                      }
                      className="h-6"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Font Size: {formatNumber(text.fontSize)}rem</Label>
                    <Input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={text.fontSize}
                      onChange={(e) =>
                        onUpdateText(imageIndex, text.id, {
                          fontSize: Number(e.target.value),
                        })
                      }
                      className="h-6 [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight</Label>
                    <Select
                      value={text.fontWeight}
                      onValueChange={(value) =>
                        onUpdateText(imageIndex, text.id, {
                          fontWeight: value as "normal" | "bold" | "semibold",
                        })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="semibold">Semibold</SelectItem>
                        <SelectItem value="bold">Bold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs mb-2 block">Text Color</Label>
                    <div className="flex gap-2 items-center">
                      {[
                        { color: "#FFFFFF", label: "White" },
                        { color: "#000000", label: "Black" },
                      ].map((option) => (
                        <button
                          key={option.color}
                          type="button"
                          onClick={() =>
                            onUpdateText(imageIndex, text.id, {
                              color: option.color,
                            })
                          }
                          className={`
                            w-6 h-6 rounded-full border-2 transition-all
                            ${text.color.toUpperCase() === option.color ? "ring-2 ring-primary ring-offset-1" : "hover:scale-110"}
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
                          id={`text-color-picker-${text.id}`}
                          value={text.color}
                          onChange={(e) =>
                            onUpdateText(imageIndex, text.id, {
                              color: e.target.value,
                            })
                          }
                          className="absolute opacity-0 w-0 h-0"
                        />
                        <label
                          htmlFor={`text-color-picker-${text.id}`}
                          className="cursor-pointer hover:scale-110 transition-all flex items-center justify-center"
                          title="Custom color"
                        >
                          <Palette className="h-5 w-5 text-gray-600" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">Background Color</Label>
                    <div className="flex gap-2 items-center">
                      {[
                        {
                          color: undefined,
                          label: "Transparent",
                          display: "transparent",
                        },
                        { color: "#FFFFFF", label: "White", display: "#FFFFFF" },
                        { color: "#000000", label: "Black", display: "#000000" },
                        {
                          color: "rgba(0, 0, 0, 0.7)",
                          label: "Semi-transparent",
                          display: "rgba(0, 0, 0, 0.7)",
                        },
                      ].map((option, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            onUpdateText(imageIndex, text.id, {
                              backgroundColor: option.color,
                            })
                          }
                          className={`
                            w-6 h-6 rounded-full border-2 transition-all relative
                            ${text.backgroundColor === option.color ? "ring-2 ring-primary ring-offset-1" : "hover:scale-110"}
                          `}
                          style={{
                            backgroundColor: option.display,
                            borderColor:
                              option.display === "#FFFFFF"
                                ? "#E5E7EB"
                                : option.display === "transparent"
                                  ? "#E5E7EB"
                                  : option.display,
                            backgroundImage:
                              option.display === "transparent"
                                ? "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)"
                                : undefined,
                            backgroundSize:
                              option.display === "transparent" ? "6px 6px" : undefined,
                            backgroundPosition:
                              option.display === "transparent" ? "0 0, 3px 3px" : undefined,
                          }}
                          title={option.label}
                        />
                      ))}
                      <div className="relative">
                        <input
                          type="color"
                          id={`bg-color-picker-${text.id}`}
                          value={text.backgroundColor || "#000000"}
                          onChange={(e) =>
                            onUpdateText(imageIndex, text.id, {
                              backgroundColor: e.target.value,
                            })
                          }
                          className="absolute opacity-0 w-0 h-0"
                        />
                        <label
                          htmlFor={`bg-color-picker-${text.id}`}
                          className="cursor-pointer hover:scale-110 transition-all flex items-center justify-center"
                          title="Custom color"
                        >
                          <Palette className="h-5 w-5 text-gray-600" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
