// Draw the part of a scene's picture that one sentence points at. The box is
// stored in percent of the picture, so it stays right at any size.

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import type { ImageRegion, Scene } from "@/shared/lesson/script/types";

interface RegionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: Scene | null;
  beatId: string | null;
  onSave: (region: ImageRegion | undefined) => void;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clampPct = (n: number) => Math.min(100, Math.max(0, n));

export function RegionDialog({ open, onOpenChange, scene, beatId, onSave }: RegionDialogProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const beat = scene?.beats.find((b) => b.id === beatId);
  const [region, setRegion] = useState<ImageRegion | undefined>(beat?.region);
  const dragFrom = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (open) setRegion(beat?.region);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, beatId]);

  function pointPct(e: React.PointerEvent) {
    const r = boxRef.current!.getBoundingClientRect();
    return {
      x: clampPct(((e.clientX - r.left) / r.width) * 100),
      y: clampPct(((e.clientY - r.top) / r.height) * 100),
    };
  }

  function onDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragFrom.current = pointPct(e);
    setRegion({ ...dragFrom.current, w: 0, h: 0 });
  }

  function onMove(e: React.PointerEvent) {
    if (!dragFrom.current) return;
    const p = pointPct(e);
    const a = dragFrom.current;
    setRegion({
      x: round1(Math.min(a.x, p.x)),
      y: round1(Math.min(a.y, p.y)),
      w: round1(Math.abs(p.x - a.x)),
      h: round1(Math.abs(p.y - a.y)),
    });
  }

  function onUp() {
    dragFrom.current = null;
    setRegion((r) => (r && (r.w < 1.5 || r.h < 1.5) ? undefined : r));
  }

  const others =
    scene?.beats.map((b, i) => ({ b, n: i + 1 })).filter(({ b }) => b.id !== beatId && b.region) ??
    [];
  const n = (scene?.beats.findIndex((b) => b.id === beatId) ?? -1) + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Mark the picture for sentence {n}</DialogTitle>
          <DialogDescription>
            Drag a box around the feature. Other sentences&apos; marks show faintly.
          </DialogDescription>
        </DialogHeader>
        {scene?.image?.url ? (
          <div className="flex justify-center rounded-md bg-muted/50 p-2">
            <div
              ref={boxRef}
              className="relative cursor-crosshair touch-none select-none"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={scene.image.url}
                alt={scene.image.alt ?? ""}
                draggable={false}
                className="block max-h-[60vh] max-w-full"
              />
              {others.map(({ b, n: k }) => (
                <div
                  key={b.id}
                  className="pointer-events-none absolute rounded-sm border border-white/80 bg-white/10"
                  style={{
                    left: `${b.region!.x}%`,
                    top: `${b.region!.y}%`,
                    width: `${b.region!.w}%`,
                    height: `${b.region!.h}%`,
                  }}
                >
                  <span className="absolute -left-1 -top-5 text-xs font-semibold text-white drop-shadow">
                    {k}
                  </span>
                </div>
              ))}
              {region && (
                <div
                  className="pointer-events-none absolute rounded-sm border-2 border-[#F4BE1A]"
                  style={{
                    left: `${region.x}%`,
                    top: `${region.y}%`,
                    width: `${region.w}%`,
                    height: `${region.h}%`,
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Choose a picture for this scene first.
          </p>
        )}
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              onSave(undefined);
              onOpenChange(false);
            }}
          >
            Remove mark
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave(region);
                onOpenChange(false);
              }}
              disabled={!region}
            >
              Save mark
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
