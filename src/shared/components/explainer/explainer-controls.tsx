"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Slider } from "@/shared/components/ui/slider";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Footprints,
} from "lucide-react";

interface ExplainerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isReady?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  captionsAvailable?: boolean;
  captionsVisible?: boolean;
  onToggleCaptions?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** Absolute times (seconds) to mark on the scrubber, e.g. slide boundaries. */
  markers?: number[];
  /** Preview a frame on scrubber hover without seeking (null = stop previewing). */
  onHover?: (time: number | null) => void;
  /** Step mode: advance finding-by-finding. */
  stepMode?: boolean;
  onToggleStepMode?: () => void;
  onStepPrev?: () => void;
  onStepNext?: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ExplainerControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  playbackRate,
  isReady = true,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onPlaybackRateChange,
  captionsAvailable = false,
  captionsVisible = true,
  onToggleCaptions,
  isFullscreen = false,
  onToggleFullscreen,
  markers = [],
  onHover,
  stepMode = false,
  onToggleStepMode,
  onStepPrev,
  onStepNext,
}: ExplainerControlsProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const handleSeekChange = useCallback(
    (value: number[]) => {
      onSeek(value[0]);
    },
    [onSeek]
  );

  const timeFromClientX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handleTrackMove = useCallback(
    (e: React.MouseEvent) => {
      if (!onHover || duration <= 0) return;
      const t = timeFromClientX(e.clientX);
      setHoverPct((t / duration) * 100);
      onHover(t);
    },
    [onHover, duration, timeFromClientX]
  );

  const handleTrackLeave = useCallback(() => {
    setHoverPct(null);
    onHover?.(null);
  }, [onHover]);

  const handleVolumeChange = useCallback(
    (value: number[]) => {
      onVolumeChange(value[0]);
    },
    [onVolumeChange]
  );

  const toggleMute = useCallback(() => {
    onVolumeChange(volume > 0 ? 0 : 1);
  }, [volume, onVolumeChange]);

  return (
    <div className="space-y-1.5 px-3 pb-2 pt-1">
      {/* Progress bar with slide-boundary ticks + hover-scrub preview */}
      <div
        ref={trackRef}
        className="relative w-full"
        onMouseMove={handleTrackMove}
        onMouseLeave={handleTrackLeave}
      >
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 1}
          step={0.1}
          onValueChange={handleSeekChange}
          className="w-full"
          disabled={!isReady}
        />
        {duration > 0 &&
          markers
            .filter((m) => m > 0 && m < duration)
            .map((m, i) => (
              <span
                key={i}
                className="pointer-events-none absolute top-1/2 h-2 w-px -translate-y-1/2 bg-white/50"
                style={{ left: `${(m / duration) * 100}%` }}
              />
            ))}
        {hoverPct !== null && (
          <span
            className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white"
            style={{ left: `${hoverPct}%` }}
          />
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* Previous finding (step mode) */}
        {stepMode && onStepPrev && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-white hover:bg-white/20 hover:text-white"
            onClick={onStepPrev}
            disabled={!isReady}
            title="Previous finding (←)"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
        )}

        {/* Play/Pause */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-white hover:bg-white/20 hover:text-white"
          onClick={isPlaying ? onPause : onPlay}
          disabled={!isReady}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        {/* Next finding (step mode) */}
        {stepMode && onStepNext && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-white hover:bg-white/20 hover:text-white"
            onClick={onStepNext}
            disabled={!isReady}
            title="Next finding (→)"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        )}

        {/* Time */}
        <div className="text-xs text-white/80 tabular-nums shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Volume */}
        <div className="hidden sm:flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-white hover:bg-white/20 hover:text-white"
            onClick={toggleMute}
          >
            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[volume]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={handleVolumeChange}
            className="w-16"
          />
        </div>

        {/* CC button — only shown when captions are available */}
        {captionsAvailable && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 shrink-0 text-xs font-bold hover:bg-white/20 ${
              captionsVisible ? "text-white" : "text-white/40"
            }`}
            onClick={onToggleCaptions}
            title={captionsVisible ? "Hide captions" : "Show captions"}
          >
            CC
          </Button>
        )}

        {/* Step mode toggle */}
        {onToggleStepMode && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 shrink-0 hover:bg-white/20 ${
              stepMode ? "text-white" : "text-white/40"
            }`}
            onClick={onToggleStepMode}
            title={stepMode ? "Exit step mode" : "Step mode (advance by finding)"}
          >
            <Footprints className="h-4 w-4" />
          </Button>
        )}

        {/* Speed */}
        <select
          value={playbackRate}
          onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
          className="text-xs bg-transparent text-white border border-white/30 rounded px-1.5 py-0.5 cursor-pointer hover:bg-white/20"
        >
          {SPEED_OPTIONS.map((rate) => (
            <option key={rate} value={rate} className="bg-black text-white">
              {rate}x
            </option>
          ))}
        </select>

        {/* Fullscreen toggle */}
        {onToggleFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-white hover:bg-white/20 hover:text-white"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen (f)" : "Fullscreen (f)"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
