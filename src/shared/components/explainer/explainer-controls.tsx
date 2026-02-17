"use client";

import { useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { Slider } from "@/shared/components/ui/slider";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

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
    <div className="space-y-1.5 px-3 pb-2 pt-1">
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
      <div className="flex items-center gap-2">
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
