"use client";

import { useRef, useCallback, useEffect } from "react";
import { cn } from "@/shared/utils";
import { useAudioSync } from "./use-audio-sync";
import { useExplainerEngine } from "./use-explainer-engine";
import { useResourcePreloader } from "./use-resource-preloader";
import { ExplainerViewport } from "./explainer-viewport";
import { ExplainerControls } from "./explainer-controls";
import type { ExplainerPlayerProps } from "@/shared/types/explainer";

export function ExplainerPlayer({
  sequence,
  audioUrl,
  autoPlay = false,
  className,
  onEnded,
  onTimeUpdate,
  onAudioLoaded,
  seekToTime,
}: ExplainerPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Preload all resources before playback
  const preloader = useResourcePreloader({
    sequence,
    audioUrl,
  });

  const audio = useAudioSync({
    audioUrl,
    onEnded,
    onTimeUpdate,
  });

  const engine = useExplainerEngine({
    sequence,
    currentTime: audio.currentTime,
  });

  // Auto-play
  useEffect(() => {
    if (autoPlay && preloader.isReady && audio.isLoaded) {
      audio.play();
    }
    // Only on mount + when loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, preloader.isReady, audio.isLoaded]);

  // Seek when seekToTime changes
  useEffect(() => {
    if (seekToTime !== undefined && audio.isLoaded) {
      audio.seek(seekToTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekToTime]);

  // Notify parent when audio duration is available
  useEffect(() => {
    if (audio.isLoaded && audio.duration > 0 && onAudioLoaded) {
      onAudioLoaded(audio.duration);
    }
  }, [audio.isLoaded, audio.duration, onAudioLoaded]);

  const handleViewportClick = useCallback(() => {
    if (preloader.isReady) {
      audio.togglePlay();
    }
  }, [audio, preloader.isReady]);

  // Keyboard controls
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          audio.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          audio.seek(Math.max(0, audio.currentTime - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          audio.seek(Math.min(audio.duration, audio.currentTime + 5));
          break;
        case "ArrowUp":
          e.preventDefault();
          audio.setVolume(Math.min(1, audio.volume + 0.05));
          break;
        case "ArrowDown":
          e.preventDefault();
          audio.setVolume(Math.max(0, audio.volume - 0.05));
          break;
        case "m":
          e.preventDefault();
          audio.setVolume(audio.volume > 0 ? 0 : 1);
          break;
      }
    },
    [audio]
  );

  return (
    <div
      ref={containerRef}
      className={cn("focus:outline-none", className)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Explanation video player"
    >
      {/* Video viewport */}
      <div className="relative rounded-lg overflow-hidden bg-black">
        <ExplainerViewport
          currentSegment={engine.currentSegment}
          incomingSegment={engine.incomingSegment}
          transform={engine.interpolatedTransform}
          highlights={engine.activeHighlights}
          arrows={engine.activeArrows}
          textOverlays={engine.activeTextOverlays}
          transitionOpacity={engine.transitionOpacity}
          incomingOpacity={engine.incomingOpacity}
          aspectRatio={sequence.aspectRatio}
          onClick={handleViewportClick}
        />

        {/* Loading overlay */}
        {preloader.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center space-y-3">
              <div className="text-white/80 text-sm">Loading...</div>
              <div className="w-32 h-0.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/60 transition-all duration-300"
                  style={{ width: `${preloader.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {preloader.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center space-y-1 max-w-md px-4">
              <div className="text-red-400 text-sm">Failed to load</div>
              <div className="text-white/50 text-xs">{preloader.error}</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls below video */}
      <ExplainerControls
        isPlaying={audio.isPlaying}
        currentTime={audio.currentTime}
        duration={audio.duration}
        volume={audio.volume}
        playbackRate={audio.playbackRate}
        isReady={preloader.isReady}
        onPlay={audio.play}
        onPause={audio.pause}
        onSeek={audio.seek}
        onVolumeChange={audio.setVolume}
        onPlaybackRateChange={audio.setPlaybackRate}
      />

      {/* Hidden audio element */}
      <audio ref={audio.audioRef} src={audioUrl} preload="auto" />
    </div>
  );
}
