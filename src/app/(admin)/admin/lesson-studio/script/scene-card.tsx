// One scene of the script: its template, heading, picture, and sentences.
// Each sentence is one beat on screen; the fields beside it depend on the
// template (on-screen words, a smaller line, a side, a mark on the picture).

"use client";

import { memo } from "react";
import { ArrowDown, ArrowUp, Copy, Crosshair, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/utils";
import {
  TEMPLATES,
  TEMPLATE_ORDER,
  type Beat,
  type BeatMark,
  type Scene,
  type TemplateKind,
} from "@/shared/lesson/script/types";
import { useScriptStudio } from "./store";

interface SceneCardProps {
  scene: Scene;
  index: number;
  count: number;
  /** Seconds this scene lasts, for the header. */
  seconds: number;
  onPickImage: (target: { sceneId: string; beatId?: string }) => void;
  onMarkRegion: (sceneId: string, beatId: string) => void;
}

const SIDE_NONE = "closing";

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

export const SceneCard = memo(function SceneCard({
  scene,
  index,
  count,
  seconds,
  onPickImage,
  onMarkRegion,
}: SceneCardProps) {
  const selected = useScriptStudio((s) => s.selection.sceneId === scene.id);
  const selectedBeat = useScriptStudio((s) => s.selection.beatId);
  const { select, updateScene, removeScene, moveScene, duplicateScene, addBeat } =
    useScriptStudio.getState();
  const info = TEMPLATES[scene.template];

  return (
    <section
      className={cn(
        "rounded-lg border bg-card transition-shadow",
        selected ? "border-primary/50 shadow-sm" : "hover:border-foreground/20"
      )}
      onClick={() => !selected && select({ sceneId: scene.id, beatId: null })}
      aria-label={`Scene ${index + 1}`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="w-6 text-sm font-semibold tabular-nums text-muted-foreground">
          {index + 1}
        </span>
        <Select
          value={scene.template}
          onValueChange={(v) => updateScene(scene.id, { template: v as TemplateKind })}
        >
          <SelectTrigger className="h-8 w-[11.5rem] text-sm" aria-label="Template">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_ORDER.map((t) => (
              <SelectItem key={t} value={t}>
                {TEMPLATES[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={scene.heading ?? ""}
          onChange={(e) =>
            updateScene(scene.id, { heading: e.target.value }, `heading:${scene.id}`)
          }
          onFocus={() => select({ sceneId: scene.id, beatId: null })}
          placeholder={scene.template === "title" ? "Lesson title" : "Heading"}
          className="h-8 min-w-[10rem] flex-1 text-sm font-medium"
        />
        <span className="text-xs tabular-nums text-muted-foreground">{seconds.toFixed(1)} s</span>
        <div className="flex">
          <IconButton
            label="Move scene up"
            onClick={() => moveScene(scene.id, -1)}
            disabled={index === 0}
          >
            <ArrowUp />
          </IconButton>
          <IconButton
            label="Move scene down"
            onClick={() => moveScene(scene.id, 1)}
            disabled={index === count - 1}
          >
            <ArrowDown />
          </IconButton>
          <IconButton label="Duplicate scene" onClick={() => duplicateScene(scene.id)}>
            <Copy />
          </IconButton>
          <IconButton
            label="Delete scene"
            onClick={() => removeScene(scene.id)}
            disabled={count <= 1}
          >
            <Trash2 />
          </IconButton>
        </div>
      </header>

      <div className="space-y-3 px-4 py-3">
        <p className="text-xs text-muted-foreground">{info.hint}</p>

        {scene.template === "image" && (
          <div className="flex items-center gap-3">
            {scene.image?.url ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickImage({ sceneId: scene.id });
                }}
                className="shrink-0 overflow-hidden rounded border"
                title="Change picture"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scene.image.url} alt="" className="h-14 w-20 bg-muted object-cover" />
              </button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickImage({ sceneId: scene.id });
                }}
              >
                <ImagePlus className="mr-1.5" />
                Choose picture
              </Button>
            )}
            <Input
              value={scene.credit ?? ""}
              onChange={(e) =>
                updateScene(scene.id, { credit: e.target.value || undefined }, `credit:${scene.id}`)
              }
              placeholder="Credit line (optional)"
              className="h-8 flex-1 text-xs"
            />
          </div>
        )}

        <ol className="space-y-2">
          {scene.beats.map((beat, k) => (
            <BeatRow
              key={beat.id}
              scene={scene}
              beat={beat}
              index={k}
              selected={selected && selectedBeat === beat.id}
              onPickImage={onPickImage}
              onMarkRegion={onMarkRegion}
            />
          ))}
        </ol>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            addBeat(scene.id);
          }}
        >
          <Plus className="mr-1" />
          Add sentence
        </Button>
      </div>
    </section>
  );
});

function BeatRow({
  scene,
  beat,
  index,
  selected,
  onPickImage,
  onMarkRegion,
}: {
  scene: Scene;
  beat: Beat;
  index: number;
  selected: boolean;
  onPickImage: SceneCardProps["onPickImage"];
  onMarkRegion: SceneCardProps["onMarkRegion"];
}) {
  const { select, updateBeat, removeBeat, moveBeat, addBeat } = useScriptStudio.getState();
  const fields = TEMPLATES[scene.template].fields;
  const set = (patch: Partial<Beat>, field: string) =>
    updateBeat(scene.id, beat.id, patch, `${field}:${beat.id}`);
  const focus = () => select({ sceneId: scene.id, beatId: beat.id });

  return (
    <li
      className={cn(
        "group relative rounded-md border border-transparent py-2 pl-8 pr-2 transition-colors",
        selected ? "border-primary/30 bg-primary/[0.04]" : "hover:bg-muted/40"
      )}
      onClick={(e) => {
        e.stopPropagation();
        focus();
      }}
    >
      <span className="absolute left-2 top-3.5 text-xs tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <div className="flex gap-2">
        <Textarea
          value={beat.say}
          onChange={(e) => set({ say: e.target.value }, "say")}
          onFocus={focus}
          onKeyDown={(e) => {
            // Enter at the very end adds the next sentence; Shift+Enter is a new line.
            const t = e.currentTarget;
            if (e.key === "Enter" && !e.shiftKey && t.selectionStart === t.value.length) {
              e.preventDefault();
              addBeat(scene.id, beat.id);
            }
          }}
          placeholder="What the narrator says, one sentence"
          rows={1}
          className="min-h-[2.25rem] resize-none py-1.5 text-sm leading-relaxed [field-sizing:content]"
        />
        <div className="flex shrink-0 flex-col opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <IconButton
            label="Move sentence up"
            onClick={() => moveBeat(scene.id, beat.id, -1)}
            disabled={index === 0}
          >
            <ArrowUp />
          </IconButton>
          <IconButton
            label="Move sentence down"
            onClick={() => moveBeat(scene.id, beat.id, 1)}
            disabled={index === scene.beats.length - 1}
          >
            <ArrowDown />
          </IconButton>
          <IconButton
            label="Delete sentence"
            onClick={() => removeBeat(scene.id, beat.id)}
            disabled={scene.beats.length <= 1}
          >
            <X />
          </IconButton>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {fields.includes("side") && (
          <Select
            value={beat.side ?? SIDE_NONE}
            onValueChange={(v) =>
              set({ side: v === SIDE_NONE ? undefined : (v as "left" | "right") }, "side")
            }
          >
            <SelectTrigger className="h-7 w-[8.5rem] text-xs" aria-label="Where it shows">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left panel</SelectItem>
              <SelectItem value="right">Right panel</SelectItem>
              <SelectItem value={SIDE_NONE}>Closing line</SelectItem>
            </SelectContent>
          </Select>
        )}
        {fields.includes("text") && (
          <Input
            value={beat.text ?? ""}
            onChange={(e) => set({ text: e.target.value || undefined }, "text")}
            onFocus={focus}
            placeholder={scene.template === "title" ? "Subtitle on screen" : "On screen"}
            className="h-7 min-w-[9rem] flex-1 text-xs font-medium"
          />
        )}
        {fields.includes("detail") && (
          <Input
            value={beat.detail ?? ""}
            onChange={(e) => set({ detail: e.target.value || undefined }, "detail")}
            onFocus={focus}
            placeholder="Smaller line"
            className="h-7 min-w-[9rem] flex-1 text-xs"
          />
        )}
        {fields.includes("image") && beat.side && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              if (beat.image) set({ image: undefined }, "image");
              else onPickImage({ sceneId: scene.id, beatId: beat.id });
            }}
          >
            {beat.image ? "Remove picture" : "Picture"}
          </Button>
        )}
        {fields.includes("region") && (
          <Button
            type="button"
            variant={beat.region ? "secondary" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!scene.image?.url}
            onClick={(e) => {
              e.stopPropagation();
              focus();
              onMarkRegion(scene.id, beat.id);
            }}
            title={scene.image?.url ? "Mark part of the picture" : "Choose a picture first"}
          >
            <Crosshair className="mr-1 !size-3" />
            {beat.region ? "Marked" : "Mark picture"}
          </Button>
        )}
        {fields.includes("mark") && beat.region && (
          <Select
            value={beat.mark ?? "ring"}
            onValueChange={(v) => set({ mark: v as BeatMark }, "mark")}
          >
            <SelectTrigger className="h-7 w-[7.5rem] text-xs" aria-label="How to show the mark">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ring">Ring</SelectItem>
              <SelectItem value="spotlight">Spotlight</SelectItem>
              <SelectItem value="zoom">Zoom in</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </li>
  );
}
