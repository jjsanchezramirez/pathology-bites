"use client";

import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Slider } from "@/shared/components/ui/slider";
import {
  OUTPUT_FORMATS,
  formatSpec,
  type ConvertOptions,
  type OutputFormat,
  type PageSelection,
} from "./converter-types";

interface ConverterSettingsProps {
  options: ConvertOptions;
  /** MIME types this browser proved it can encode. TIFF is always available. */
  supportedFormats: Set<string>;
  onChange: (patch: Partial<ConvertOptions>) => void;
  hasTiffInput: boolean;
}

export function ConverterSettings({
  options,
  supportedFormats,
  onChange,
  hasTiffInput,
}: ConverterSettingsProps) {
  const spec = formatSpec(options.format);
  const available = OUTPUT_FORMATS.filter(
    (format) => format.value === "image/tiff" || supportedFormats.has(format.value)
  );

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="output-format">Convert to</Label>
        <Select
          value={options.format}
          onValueChange={(value) => onChange({ format: value as OutputFormat })}
        >
          <SelectTrigger id="output-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {available.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
                {format.note ? ` — ${format.note}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="max-dimension">Longest edge (px)</Label>
        <Input
          id="max-dimension"
          type="number"
          min={16}
          step={1}
          inputMode="numeric"
          placeholder="Original size"
          value={options.maxDimension ?? ""}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            onChange({ maxDimension: Number.isFinite(parsed) && parsed > 0 ? parsed : null });
          }}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to keep the original size. Images are never enlarged.
        </p>
      </div>

      {spec.lossy && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="quality">Quality</Label>
            <span className="text-sm tabular-nums text-muted-foreground">
              {Math.round(options.quality * 100)}%
            </span>
          </div>
          <Slider
            id="quality"
            min={10}
            max={100}
            step={1}
            value={[Math.round(options.quality * 100)]}
            onValueChange={([value]) => onChange({ quality: value / 100 })}
          />
        </div>
      )}

      {!spec.alpha && (
        <div className="space-y-2">
          <Label htmlFor="background">Background</Label>
          <div className="flex items-center gap-2">
            <Input
              id="background"
              type="color"
              className="h-10 w-16 cursor-pointer p-1"
              value={options.background}
              onChange={(event) => onChange({ background: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {spec.label} has no transparency — this colour is painted underneath.
            </p>
          </div>
        </div>
      )}

      {hasTiffInput && (
        <div className="space-y-2">
          <Label htmlFor="pages">Multi-page TIFFs</Label>
          <Select
            value={options.pages}
            onValueChange={(value) => onChange({ pages: value as PageSelection })}
          >
            <SelectTrigger id="pages">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first">First page only</SelectItem>
              <SelectItem value="largest">Largest page only</SelectItem>
              <SelectItem value="all">Every page</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Pyramidal TIFFs store each zoom level as a page — &ldquo;largest&rdquo; picks the
            full-resolution one.
          </p>
        </div>
      )}
    </div>
  );
}
