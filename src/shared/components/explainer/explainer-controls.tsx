"use client";

import { useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { Slider } from "@/shared/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/shared/utils";

interface ExplainerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  visible?: boolean;
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
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onPlaybackRateChange,
  visible = true,
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
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm border-t transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Seekbar — full width above controls */}
      <div className="px-3 pt-2">
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 1}
          step={0.1}
          onValueChange={handleSeekChange}
          className="w-full"
        />
      </div>

      {/* Control buttons row */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Play/Pause */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        {/* Time display */}
        <span className="text-xs text-muted-foreground tabular-nums shrink-0 min-w-[80px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Volume — hidden on small screens */}
        <div className="hidden sm:block">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleMute}
              >
                {volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="center"
              className="w-10 p-2"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <Slider
                value={[volume]}
                min={0}
                max={1}
                step={0.05}
                orientation="vertical"
                onValueChange={handleVolumeChange}
                className="h-24"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Speed selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs tabular-nums"
            >
              {playbackRate}x
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            {SPEED_OPTIONS.map((rate) => (
              <DropdownMenuItem
                key={rate}
                onClick={() => onPlaybackRateChange(rate)}
                className={cn(
                  "text-xs tabular-nums",
                  rate === playbackRate && "font-bold"
                )}
              >
                {rate}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
