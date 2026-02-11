"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/shared/utils";
import { useAudioSync } from "./use-audio-sync";
import { useExplainerEngine } from "./use-explainer-engine";
import { ExplainerViewport } from "./explainer-viewport";
import { ExplainerControls } from "./explainer-controls";
import type { ExplainerPlayerProps } from "@/shared/types/explainer";

const CONTROLS_HIDE_DELAY = 3000;

export function ExplainerPlayer({
  sequence,
  audioUrl,
  autoPlay = false,
  className,
  onEnded,
  onTimeUpdate,
}: ExplainerPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

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
    if (autoPlay && audio.isLoaded) {
      audio.play();
    }
    // Only on mount + when loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, audio.isLoaded]);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      if (audio.isPlaying) {
        setControlsVisible(false);
      }
    }, CONTROLS_HIDE_DELAY);
  }, [audio.isPlaying]);

  // Show controls when paused
  useEffect(() => {
    if (!audio.isPlaying) {
      setControlsVisible(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    } else {
      resetHideTimer();
    }
  }, [audio.isPlaying, resetHideTimer]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const handleViewportClick = useCallback(() => {
    audio.togglePlay();
    resetHideTimer();
  }, [audio, resetHideTimer]);

  const handleMouseMove = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

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
      resetHideTimer();
    },
    [audio, resetHideTimer]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-lg overflow-hidden bg-black group focus:outline-none",
        className
      )}
      onMouseMove={handleMouseMove}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="application"
      aria-label="Explanation video player"
    >
      <ExplainerViewport
        currentSegment={engine.currentSegment}
        incomingSegment={engine.incomingSegment}
        transform={engine.interpolatedTransform}
        highlights={engine.activeHighlights}
        textOverlays={engine.activeTextOverlays}
        transitionOpacity={engine.transitionOpacity}
        aspectRatio={sequence.aspectRatio}
        onClick={handleViewportClick}
      />

      <ExplainerControls
        isPlaying={audio.isPlaying}
        currentTime={audio.currentTime}
        duration={audio.duration}
        volume={audio.volume}
        playbackRate={audio.playbackRate}
        onPlay={audio.play}
        onPause={audio.pause}
        onSeek={audio.seek}
        onVolumeChange={audio.setVolume}
        onPlaybackRateChange={audio.setPlaybackRate}
        visible={controlsVisible}
      />

      {/* Hidden audio element */}
      <audio ref={audio.audioRef} src={audioUrl} preload="auto" />
    </div>
  );
}
