"use client";

import { useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { Slider } from "@/shared/components/ui/slider";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

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
}: ExplainerControlsProps) {
  const handleSeekChange = useCallback(
    (value: number[]) => {
      onSeek(value[0]);
    },
    [onSeek]
  );

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
    <div className="mt-2 space-y-2">
      {/* Progress bar */}
      <Slider
        value={[currentTime]}
        min={0}
        max={duration || 1}
        step={0.1}
        onValueChange={handleSeekChange}
        className="w-full"
        disabled={!isReady}
      />

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={isPlaying ? onPause : onPlay}
          disabled={!isReady}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>

        {/* Time */}
        <div className="text-sm text-muted-foreground tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Volume */}
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={toggleMute}>
            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[volume]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={handleVolumeChange}
            className="w-20"
          />
        </div>

        {/* CC button — only shown when captions are available */}
        {captionsAvailable && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 shrink-0 text-xs font-bold ${
              captionsVisible ? "text-foreground" : "text-muted-foreground/50"
            }`}
            onClick={onToggleCaptions}
            title={captionsVisible ? "Hide captions" : "Show captions"}
          >
            CC
          </Button>
        )}

        {/* Speed */}
        <select
          value={playbackRate}
          onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
          className="text-sm bg-transparent border border-input rounded px-2 py-1 cursor-pointer hover:bg-accent"
        >
          {SPEED_OPTIONS.map((rate) => (
            <option key={rate} value={rate}>
              {rate}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
